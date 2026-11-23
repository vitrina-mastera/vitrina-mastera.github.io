/* Публикация из Мастерской прямо на сайт - без нас.
   Сайт статический (GitHub Pages), поэтому "сохранить на сайт" = сделать коммит в репозиторий через GitHub API.
   Для этого нужен токен GitHub (fine-grained, только одно репо, только "Contents: Read and write").

   Где токен: enc/p.json в репозитории, зашифрован ключом из КОДА МАСТЕРА (12 цифр, не равен пин-коду витрины -
   пин знают и клиенты). PBKDF2-SHA256 600 000 повторов + AES-256-GCM, как у самой витрины. Внутри:
   { repo: "владелец/репо", branch, paths: ["krasnodar/enc/", ...], token, pin }.
   pin нужен, чтобы шифровать новые фото и правки тем же ключом, что и вся витрина.
   paths - куда класть файлы: первая папка - та, что отдаёт сайт; остальные - копии (исходники site/krasnodar/enc/,
   чтобы следующая наша сборка их не потеряла). Одинаковые файлы git хранит один раз, места это не занимает.
   После переезда в другое репо настройку проходят заново - в коде ничего менять не нужно.

   Что пишет мастер: enc/m.bin (все его правки одним зашифрованным файлом, формат - site/krasnodar/sloj.js)
   и enc/<случайное имя>.bin - каждое новое фото, видео, знак. Всё одним коммитом: сайт пересобирается один раз.
   На устройстве мастера после ввода кода хранится только ключ (без возможности выгрузить) в IndexedDB "kr-zamok",
   запись "pub". "Выйти" на витрине и "Отключить на этом устройстве" его стирают. */
(function () {
  "use strict";
  var Z = window.KrZamok, BASE = Z.base, ITER = 600000, API = "https://api.github.com";
  var subtle = crypto.subtle, te = new TextEncoder(), td = new TextDecoder();

  // ---------- мелочи ----------
  function u8b64(u) { var s = "", CH = 0x8000; for (var i = 0; i < u.length; i += CH) s += String.fromCharCode.apply(null, u.subarray(i, i + CH)); return btoa(s); }
  function blobB64(b) {
    return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(String(r.result).replace(/^data:[^,]*,/, "")); }; r.onerror = function () { no(r.error); }; r.readAsDataURL(b); });
  }
  function rnd(n) { var u = crypto.getRandomValues(new Uint8Array(n)); return [].map.call(u, function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
  function digits(s) { return String(s || "").replace(/\D/g, ""); }
  function newCode() { var u = crypto.getRandomValues(new Uint32Array(12)), s = ""; for (var i = 0; i < 12; i++) s += u[i] % 10; return s; }
  function fmtCode(c) { return digits(c).replace(/(\d{4})(?=\d)/g, "$1-"); }

  function pbkdf(secret, salt, iter, use) {
    return subtle.importKey("raw", te.encode(secret), "PBKDF2", false, ["deriveBits"]).then(function (k) {
      return subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: iter }, k, 512);
    }).then(function (bits) { return subtle.importKey("raw", new Uint8Array(bits, 0, 32), { name: "AES-GCM" }, false, use); });
  }
  function seal(key, data) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return subtle.encrypt({ name: "AES-GCM", iv: iv }, key, data).then(function (c) { var o = new Uint8Array(12 + c.byteLength); o.set(iv); o.set(new Uint8Array(c), 12); return o; });
  }
  function unseal(key, buf) { return subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(buf, 0, 12) }, key, new Uint8Array(buf, 12)); }

  function idbGet() {
    return Z.idb().then(function (db) { return new Promise(function (ok) { var q = db.transaction("k").objectStore("k").get("pub"); q.onsuccess = function () { ok(q.result || null); }; q.onerror = function () { ok(null); }; }); }).catch(function () { return null; });
  }
  function idbPut(v) {
    return Z.idb().then(function (db) { return new Promise(function (ok) { var t = db.transaction("k", "readwrite"); if (v) t.objectStore("k").put(v, "pub"); else t.objectStore("k").delete("pub"); t.oncomplete = function () { ok(true); }; t.onerror = function () { ok(false); }; }); }).catch(function () { return false; });
  }

  // ---------- настройка (p.json) ----------
  function cfg() {
    return fetch(BASE + "enc/p.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  // код мастера -> настройки; remember: оставить ключ на этом устройстве
  function unlock(code, pj, remember) {
    code = digits(code);
    return pbkdf(code, Z.b64(pj.salt), pj.iter || ITER, ["decrypt"]).then(function (key) {
      return unseal(key, Z.b64(pj.d).buffer).then(function (p) {
        var B = JSON.parse(td.decode(p));
        return (remember ? idbPut({ key: key, salt: pj.salt }) : Promise.resolve()).then(function () { return B; });
      }, function () { throw new Error("Неверный код мастера"); });
    });
  }
  // настройки без ввода кода: ключ уже на устройстве
  function saved(pj) {
    return idbGet().then(function (rec) {
      if (!rec || !rec.key || !pj || rec.salt !== pj.salt) return null;
      return unseal(rec.key, Z.b64(pj.d).buffer).then(function (p) { return JSON.parse(td.decode(p)); }, function () { return null; });
    });
  }
  function forget() { return idbPut(null); }

  // ключ витрины (шифровать новые файлы) из пин-кода в настройках; проверяем на d.bin, что пин не сменился
  var SK = {};
  function siteKey(pin) {
    if (SK[pin]) return SK[pin];
    SK[pin] = Promise.all([fetch(BASE + "enc/meta.json", { cache: "no-cache" }).then(function (r) { return r.json(); }), Z.fetchBin("d.bin")]).then(function (a) {
      return pbkdf(digits(pin), Z.b64(a[0].salt), a[0].iter, ["encrypt", "decrypt"]).then(function (k) {
        return unseal(k, a[1]).then(function () { return k; }, function () { throw new Error("Пин-код витрины поменялся - Александру нужно заново пройти настройку публикации"); });
      });
    });
    SK[pin].catch(function () { delete SK[pin]; });
    return SK[pin];
  }

  // ---------- GitHub API ----------
  function gh(B, method, url, body, raw) {
    var h = { "Accept": raw ? "application/vnd.github.raw" : "application/vnd.github+json", "Authorization": "Bearer " + B.token, "X-GitHub-Api-Version": "2022-11-28" };
    if (body) h["Content-Type"] = "application/json";
    return fetch(API + "/repos/" + B.repo + url, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: "no-store" }).then(function (r) {
      if (raw && r.status === 404) return null;
      if (!r.ok) return r.text().then(function (t) {
        var m = ""; try { m = JSON.parse(t).message || ""; } catch (e) {}
        var e = new Error(r.status === 401 ? "GitHub не принял токен (истёк или отозван) - Александру нужно выпустить новый и пройти настройку" :
          r.status === 403 || (r.status === 404 && method !== "GET") ? "У токена нет права записи в репозиторий " + B.repo + " (нужно Contents: Read and write)" :
          r.status === 404 ? "Не найдено репо или ветка: " + B.repo + " / " + B.branch : "GitHub ответил " + r.status + (m ? ": " + m : ""));
        e.status = r.status; throw e;
      });
      return raw ? r.arrayBuffer() : r.json();
    }, function () { throw new Error("Нет связи с GitHub - проверьте интернет"); });
  }
  function enc(p) { return p.split("/").map(encodeURIComponent).join("/"); }
  // свежий m.bin прямо из репозитория (сайт после публикации обновляется 1-2 минуты, а правки нельзя потерять)
  function readSloj(B, key) {
    return gh(B, "GET", "/contents/" + enc(B.paths[0] + "m.bin") + "?ref=" + encodeURIComponent(B.branch), null, true).then(function (buf) {
      if (!buf) return null;
      return unseal(key, buf).then(function (p) { return JSON.parse(td.decode(p)); });
    });
  }
  // files: [{ name, data: Uint8Array | Blob }] -> один коммит, каждый файл во все папки paths
  function commit(B, files, message, progress) {
    var total = files.reduce(function (s, f) { return s + (f.data.size || f.data.byteLength || 0); }, 0), sent = 0, shas = [];
    progress = progress || function () {};
    var chain = Promise.resolve();
    files.forEach(function (f, i) {
      chain = chain.then(function () {
        progress("Загружаю " + (i + 1) + " из " + files.length, sent / Math.max(1, total));
        return (f.data instanceof Blob ? blobB64(f.data) : Promise.resolve(u8b64(f.data))).then(function (b64) {
          return gh(B, "POST", "/git/blobs", { content: b64, encoding: "base64" });
        }).then(function (r) { shas[i] = r.sha; sent += f.data.size || f.data.byteLength || 0; });
      });
    });
    function attempt(n) {
      progress("Сохраняю на сайт", 1);
      var ref = "/git/ref/heads/" + enc(B.branch), head;
      return gh(B, "GET", ref).then(function (r) {
        head = r.object.sha;
        return gh(B, "GET", "/git/commits/" + head);
      }).then(function (c) {
        var tree = [];
        files.forEach(function (f, i) { B.paths.forEach(function (p) { tree.push({ path: p + f.name, mode: "100644", type: "blob", sha: shas[i] }); }); });
        return gh(B, "POST", "/git/trees", { base_tree: c.tree.sha, tree: tree });
      }).then(function (t) {
        return gh(B, "POST", "/git/commits", { message: message, tree: t.sha, parents: [head] });
      }).then(function (c) {
        return gh(B, "PATCH", "/git/refs/heads/" + enc(B.branch), { sha: c.sha, force: false }).then(function () { return c.sha; });
      }).catch(function (e) {
        // ветку успели сдвинуть (наша сборка или вторая вкладка) - пробуем ещё раз поверх нового состояния
        if (e.status === 422 && n < 3) return attempt(n + 1);
        throw e;
      });
    }
    return chain.then(function () { return attempt(1); });
  }

  // ---------- первая настройка (Александр) ----------
  // Проверяет токен и репо, пин витрины; делает код мастера, шифрует настройки и кладёт p.json одним коммитом.
  function setup(o, progress) {
    var B = { repo: String(o.repo || "").trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$|\/+$/g, ""), branch: String(o.branch || "main").trim(),
      paths: String(o.paths || "").split(/[\s,]+/).map(function (p) { p = p.trim().replace(/^\/+/, ""); return p && !/\/$/.test(p) ? p + "/" : p; }).filter(Boolean),
      token: String(o.token || "").trim(), pin: digits(o.pin), sozdano: new Date().toISOString() };
    if (!/^[\w.-]+\/[\w.-]+$/.test(B.repo)) return Promise.reject(new Error("Репозиторий - в виде владелец/название"));
    if (!B.paths.length) return Promise.reject(new Error("Нужна хотя бы одна папка"));
    if (B.token.length < 20) return Promise.reject(new Error("Вставьте токен GitHub целиком"));
    progress = progress || function () {};
    progress("Проверяю пин-код витрины");
    var code = newCode();
    return siteKey(B.pin).catch(function () { throw new Error("Пин-код витрины не подходит"); }).then(function () {
      progress("Проверяю токен и репозиторий");
      return gh(B, "GET", "/git/ref/heads/" + enc(B.branch));
    }).then(function () {
      progress("Шифрую настройки кодом мастера");
      var salt = crypto.getRandomValues(new Uint8Array(16));
      return pbkdf(code, salt, ITER, ["encrypt", "decrypt"]).then(function (k) {
        return seal(k, te.encode(JSON.stringify(B))).then(function (c) {
          return { pj: { v: 1, iter: ITER, salt: u8b64(salt), d: u8b64(c) }, key: k };
        });
      });
    }).then(function (r) {
      return commit(B, [{ name: "p.json", data: te.encode(JSON.stringify(r.pj) + "\n") }], "Мастерская: настройка публикации", progress).then(function () {
        return (o.remember ? idbPut({ key: r.key, salt: r.pj.salt }) : Promise.resolve()).then(function () { return { code: fmtCode(code), B: B, pj: r.pj }; });
      });
    });
  }

  // где витрина живёт в репо: https://<владелец>.github.io/<репо>/krasnodar/ -> владелец/репо и "krasnodar/enc/"
  function guess() {
    var h = location.hostname, m = /^([\w-]+)\.github\.io$/i.exec(h), segs = location.pathname.split("/").filter(Boolean);
    var base = new URL(BASE).pathname.split("/").filter(Boolean);
    var repo = "", rel = base.join("/");
    if (m) {
      if (segs.length && base.length) { repo = m[1] + "/" + base[0]; rel = base.slice(1).join("/"); }
      else repo = m[1] + "/" + m[1] + ".github.io";
    }
    rel = rel ? rel + "/" : "";
    return { repo: repo, branch: "main", paths: rel + "enc/\n" + "site/" + (rel || "krasnodar/") + "enc/" };
  }

  window.KrPub = { cfg: cfg, unlock: unlock, saved: saved, forget: forget, siteKey: siteKey, readSloj: readSloj, commit: commit, setup: setup, guess: guess,
    seal: seal, rnd: rnd, fmtCode: fmtCode, digits: digits };
})();
