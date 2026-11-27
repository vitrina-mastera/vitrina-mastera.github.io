/* Замок закрытой витрины: вход по пин-коду и расшифровка в браузере.
   Репозиторий публичный, поэтому на сайте лежат только зашифрованные файлы (enc/):
   d.bin - все тексты, <id>.bin - фото. Без пин-кода из них ничего не достать.
   Ключ выводится из пин-кода (PBKDF2-SHA256, 600 000 повторов, соль из enc/meta.json),
   расшифровка - AES-256-GCM (Web Crypto). Пин-код нигде не хранится. После входа ключ
   (без возможности его выгрузить) лежит в IndexedDB этого браузера - чтобы не вводить пин
   каждый раз; "Выйти" его стирает.
   Фото: служебный работник sw.js отдаёт расшифрованное фото по адресу f/<id>.jpg (по мере
   прокрутки). Если браузер его не поддерживает - все фото расшифровываются сразу.
   Шифрует файлы site/tools/zashifrovat-krasnodar.js. */
(function () {
  "use strict";
  if (window.KrZamok) return;
  var me = document.currentScript && document.currentScript.src;
  var BASE = me ? me.replace(/[^/]*$/, "") : new URL("./", location.href).href; // .../krasnodar/
  var DB = "kr-zamok", ST = "k", TRIES = "kr-tries";
  var subtle = window.crypto && crypto.subtle;

  // ---------- IndexedDB: ключ ----------
  function idb() {
    return new Promise(function (ok, no) {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { no(r.error); };
    });
  }
  function getKey() {
    return idb().then(function (db) {
      return new Promise(function (ok) {
        var q = db.transaction(ST).objectStore(ST).get("aes");
        q.onsuccess = function () { ok(q.result || null); };
        q.onerror = function () { ok(null); };
      });
    }).catch(function () { return null; });
  }
  function putKey(rec) {
    return idb().then(function (db) {
      return new Promise(function (ok) {
        var t = db.transaction(ST, "readwrite"); t.objectStore(ST).put(rec, "aes");
        t.oncomplete = function () { ok(true); }; t.onerror = function () { ok(false); };
      });
    }).catch(function () { return false; });
  }
  function dropKey() {
    return idb().then(function (db) {
      return new Promise(function (ok) {
        var t = db.transaction(ST, "readwrite"); t.objectStore(ST).delete("aes"); t.objectStore(ST).delete("pub"); // pub - ключ публикации мастера
        t.oncomplete = function () { ok(); }; t.onerror = function () { ok(); };
      });
    }).catch(function () {});
  }

  // ---------- шифр ----------
  function b64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function derive(pin, meta) {
    return subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]).then(function (k) {
      return subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: b64(meta.salt), iterations: meta.iter }, k, 512);
    }).then(function (bits) {
      return subtle.importKey("raw", new Uint8Array(bits, 0, 32), { name: "AES-GCM" }, false, ["decrypt"]);
    });
  }
  function fetchBin(name) {
    return fetch(BASE + "enc/" + name, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("нет файла " + name);
      return r.arrayBuffer();
    });
  }
  function open(key, buf) {
    return subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(buf, 0, 12) }, key, new Uint8Array(buf, 12));
  }
  function mime(buf) {
    var u = new Uint8Array(buf, 0, Math.min(16, buf.byteLength));
    if (u[0] === 0x89 && u[1] === 0x50) return "image/png";
    if (u[8] === 0x57 && u[9] === 0x45 && u[10] === 0x42 && u[11] === 0x50) return "image/webp";
    if (u[4] === 0x66 && u[5] === 0x74 && u[6] === 0x79 && u[7] === 0x70) return "video/mp4"; // ....ftyp
    if (u[0] === 0x1A && u[1] === 0x45 && u[2] === 0xDF && u[3] === 0xA3) return "video/webm";
    if (u[0] === 0x3C) return "image/svg+xml"; // "<svg" или "<?xml"
    return "image/jpeg";
  }

  // ---------- окно входа ----------
  var CSS = [
    // цвета и шрифты - из общего stil.css (--kr-*), запасные значения на случай, если он ещё не загрузился
    "#krLock{position:fixed;inset:0;z-index:2147483000;background:var(--kr-bg,#121211);color:var(--kr-ink,#F1EEE8);display:flex;align-items:center;justify-content:center;padding:24px;font-family:var(--kr-sans,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif);font-weight:300;-webkit-font-smoothing:antialiased}",
    "#krLock .box{width:100%;max-width:340px;text-align:center}",
    // телефон: форма ближе к верху и в видимой части над клавиатурой (см. fitVV)
    "@media (max-height:760px),(pointer:coarse){#krLock{align-items:flex-start;padding-top:max(28px,9vh);overflow-y:auto}#krLock .ic{margin-bottom:16px}}",
    "#krLock .ic{width:44px;height:44px;border:1px solid var(--kr-line2,#4A4743);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:22px}",
    "#krLock h1{font-family:var(--kr-serif,Georgia,serif);font-size:30px;line-height:1.1;margin:0 0 10px;font-weight:400}",
    "#krLock p{margin:0 0 26px;color:var(--kr-muted,#A6A198);font-size:14.5px;line-height:1.55}",
    "#krLock input{width:100%;box-sizing:border-box;font:inherit;font-weight:300;font-size:24px;letter-spacing:.4em;text-indent:.4em;text-align:center;padding:12px 10px;border:0;border-bottom:1px solid var(--kr-line2,#4A4743);border-radius:0;background:transparent;color:var(--kr-ink,#F1EEE8);outline:none;transition:border-color .3s}",
    "#krLock input:focus{border-bottom-color:var(--kr-ink,#F1EEE8)}",
    "#krLock input::placeholder{color:var(--kr-faint,#77726B)}",
    "#krLock button{margin-top:26px;width:100%;font:inherit;font-weight:500;font-size:11px;letter-spacing:.24em;text-transform:uppercase;min-height:48px;border:1px solid var(--kr-ink,#F1EEE8);border-radius:0;background:transparent;color:var(--kr-ink,#F1EEE8);cursor:pointer;transition:background-color .3s,color .3s}",
    "@media (hover:hover){#krLock button:not(:disabled):hover{background:var(--kr-ink,#F1EEE8);color:var(--kr-bg,#121211)}}",
    "#krLock button:disabled{opacity:.4;cursor:default}",
    "#krLock .msg{min-height:22px;margin-top:14px;font-size:13.5px;color:var(--kr-err,#E3A08F)}",
    "#krLock .msg.ok{color:var(--kr-muted,#A6A198)}",
    "#krLock .foot{margin-top:34px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--kr-faint,#77726B)}",
    "#krBack{position:fixed;right:10px;top:calc(10px + env(safe-area-inset-top));z-index:2147482000;display:inline-flex;align-items:center;gap:6px;background:rgba(18,18,17,.85);color:var(--kr-ink,#F1EEE8);border:1px solid rgba(255,255,255,.18);border-radius:0;padding:8px 14px;font:500 10.5px var(--kr-sans,system-ui,sans-serif);letter-spacing:.2em;text-transform:uppercase;text-decoration:none;box-shadow:0 4px 18px rgba(0,0,0,.25);backdrop-filter:blur(6px)}",
    "#krBack.bl{top:auto;right:auto;left:12px;bottom:calc(14px + env(safe-area-inset-bottom))}",
    // путешествие по дому: кнопка видна только на экране дома, в комнате и работе есть свои "назад" - ничего не налезает
    "#krBack{transition:opacity .4s cubic-bezier(.22,1,.36,1),transform .5s cubic-bezier(.22,1,.36,1),visibility 0s}",
    "body[data-vp]:not([data-vp=home]) #krBack{opacity:0;transform:translateY(-16px) scale(.9);pointer-events:none;visibility:hidden;transition:opacity .3s,transform .4s,visibility 0s linear .4s}",
    "@media (prefers-reduced-motion:reduce){#krBack{transition:none!important}}"
  ].join("\n");
  function style() {
    if (document.getElementById("krCss")) return;
    if (!document.getElementById("krStil")) { var l = document.createElement("link"); l.id = "krStil"; l.rel = "stylesheet"; l.href = BASE + "stil.css"; document.head.appendChild(l); } // общий стиль
    var s = document.createElement("style"); s.id = "krCss"; s.textContent = CSS; document.head.appendChild(s); }
  function lockScreen() {
    style();
    var el = document.getElementById("krLock");
    if (el) return el;
    el = document.createElement("div"); el.id = "krLock";
    el.innerHTML = '<form class="box" autocomplete="off">' +
      '<div class="ic"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div>' +
      "<h1>Закрытая витрина</h1><p>Вход только по пин-коду. Его выдаёт тот, кто прислал вам эту ссылку.</p>" +
      '<input id="krPin" type="password" inputmode="numeric" enterkeyhint="go" pattern="[0-9]*" autocomplete="one-time-code" maxlength="16" placeholder="••••••••" aria-label="Пин-код">' +
      '<button type="submit" id="krGo">Войти</button><div class="msg" id="krMsg" role="status" aria-live="polite"></div>' +
      (/^kr-(klient|proba|raschet)$/.test(window.MEBEL_TOOL) ? "" : '<div class="foot">Разработка в тестовом режиме. Все права защищены.</div>') + "</form>"; // клиенту пометка о тесте не нужна
    (document.body || document.documentElement).appendChild(el);
    var vv = window.visualViewport;
    if (vv) { var f = function () { if (!el.isConnected) { vv.removeEventListener("resize", f); vv.removeEventListener("scroll", f); return; } el.style.top = vv.offsetTop + "px"; el.style.height = vv.height + "px"; el.style.bottom = "auto"; }; vv.addEventListener("resize", f); vv.addEventListener("scroll", f); f(); }
    return el;
  }
  function msg(t, ok) { var m = document.getElementById("krMsg"); if (m) { m.textContent = t || ""; m.className = "msg" + (ok ? " ok" : ""); } }
  function unlockScreen() { var el = document.getElementById("krLock"); if (el) el.remove(); }

  // попытки: на статическом сайте надёжно ограничить их нельзя (можно перебирать файлы и без страницы),
  // поэтому здесь только пауза от случайного перебора руками. Защиту даёт длина пина и 600 000 повторов.
  function tries() { try { return JSON.parse(localStorage.getItem(TRIES) || "{}"); } catch (e) { return {}; } }
  function setTries(o) { try { localStorage.setItem(TRIES, JSON.stringify(o)); } catch (e) {} }

  function askPin(meta, dataBuf) {
    var el = lockScreen(), f = el.querySelector("form"), inp = el.querySelector("#krPin"), go = el.querySelector("#krGo");
    setTimeout(function () { inp.focus(); }, 30);
    return new Promise(function (done) {
      f.onsubmit = function (e) {
        e.preventDefault();
        var pin = inp.value.replace(/\D/g, "");
        var t = tries(), now = Date.now();
        if (t.until && now < t.until) { msg("Подождите " + Math.ceil((t.until - now) / 1000) + " с и попробуйте снова."); return; }
        if (pin.length < 6) { msg("Пин-код - не меньше 6 цифр."); return; }
        go.disabled = true; msg("Проверяю...", true);
        var key;
        derive(pin, meta).then(function (k) { key = k; return open(k, dataBuf); }).then(function (plain) {
          setTries({});
          return putKey({ key: key, salt: meta.salt }).then(function () { done({ key: key, plain: plain }); });
        }).catch(function () {
          var n = (t.n || 0) + 1;
          setTries({ n: n, until: n >= 5 ? Date.now() + 30000 * Math.pow(2, Math.min(n - 5, 5)) : 0 });
          go.disabled = false; inp.value = ""; inp.focus();
          msg(n >= 5 ? "Неверный пин-код. Следующая попытка через " + Math.round(30 * Math.pow(2, Math.min(n - 5, 5))) + " с." : "Неверный пин-код.");
        });
      };
    });
  }

  // ---------- фото ----------
  function isRef(x) { return typeof x === "string" && /^@[0-9a-f]{8,}$/.test(x); }
  function ids(x, out) {
    if (typeof x === "string") { if (isRef(x)) out[x.slice(1)] = 1; }
    else if (Array.isArray(x)) x.forEach(function (y) { ids(y, out); });
    else if (x && typeof x === "object") Object.keys(x).forEach(function (k) { ids(x[k], out); });
    return out;
  }
  function swReady() {
    if (!("serviceWorker" in navigator)) return Promise.resolve(false);
    return navigator.serviceWorker.register(BASE + "sw.js", { scope: BASE, updateViaCache: "none" }).then(function () {
      if (navigator.serviceWorker.controller) return true;
      return new Promise(function (ok) {
        var t = setTimeout(function () { ok(!!navigator.serviceWorker.controller); }, 4000);
        navigator.serviceWorker.addEventListener("controllerchange", function () { clearTimeout(t); ok(true); });
      });
    }).catch(function () { return false; });
  }
  // первое нужное на экране: картинка фона и знак, затем обложки комнат (первое фото первой работы в каждой комнате).
  // Видео фона и остальные фото - сразу следом, уже после показа.
  function prio(data, all) {
    var V = data.vitrina || {}, F = V.fon || {}, out = [], seen = {}, rooms = {};
    function add(x) { Object.keys(ids(x, {})).forEach(function (id) { if (!seen[id] && all.indexOf(id) >= 0) { seen[id] = 1; out.push(id); } }); }
    add([F.kadr, F.kadr_tel]); add(V.master && V.master.logo);
    (V.raboty || []).forEach(function (w) { if (!rooms[w.komnata]) { rooms[w.komnata] = 1; add((w.foto || [])[0]); } });
    return out;
  }
  function soon(data, all) { var F = (data.vitrina || {}).fon || {}; return Object.keys(ids([F.video, F.video_tel], {})).filter(function (id) { return all.indexOf(id) >= 0; }); }
  var WAIT = {};
  // адрес фото, когда оно готово (для видео фона, которое скачивается целиком)
  function when(u) {
    var m = /#kr=([0-9a-f]{8,})$/.exec(String(u || ""));
    if (!m) return Promise.resolve(u);
    if (MAPREF && MAPREF[m[1]]) return Promise.resolve(MAPREF[m[1]]);
    return new Promise(function (ok) { (WAIT[m[1]] = WAIT[m[1]] || []).push(ok); });
  }
  var PH = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", SWT = 0, SWO = null;
  var SEL = '[src*="#kr="],[poster*="#kr="],[style*="#kr="],[href*="#kr="]', RX = /data:image\/gif;base64,[A-Za-z0-9+\/=]+#kr=([0-9a-f]{8,})/g;
  var MAPREF = null;
  // обратно: адрес фото на странице -> ссылка в данных ("@id"). Нужно Мастерской, чтобы удалять фото и ставить на них точки.
  window.KR_REF = function (u) {
    u = String(u || ""); var m = /#kr=([0-9a-f]{8,})$/.exec(u) || /\/f\/([0-9a-f]{8,})\.jpg(?:[?#].*)?$/.exec(u);
    if (m) return "@" + m[1];
    if (MAPREF) for (var id in MAPREF) if (MAPREF[id] === u) return "@" + id;
    return u;
  };
  function swapSoon() { if (!SWT) SWT = setTimeout(swapNow, 120); }
  function swapNow() {
    SWT = 0; if (!MAPREF) return;
    [].forEach.call(document.querySelectorAll(SEL), function (el) {
      ["src", "poster", "style", "href"].forEach(function (a) {
        var v = el.getAttribute(a); if (!v || v.indexOf("#kr=") < 0) return;
        var n = v.replace(RX, function (m, id) { return MAPREF[id] || m; });
        if (n !== v) el.setAttribute(a, n); // меняем только то, что уже готово - без бесконечного круга
      });
    });
  }
  function watchSwap() {
    if (SWO || !window.MutationObserver) return;
    SWO = new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) { if (ms[i].type === "childList" ? ms[i].addedNodes.length : true) { swapSoon(); return; } } });
    SWO.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "poster", "style", "href"] });
  }
  function photoMap(key, data, progress) {
    var all = Object.keys(ids(data, {}));
    var map = {}, lazy = false; MAPREF = map;
    if (!all.length) return Promise.resolve(function (r) { return r; });
    return swReady().then(function (sw) {
      if (sw) {
        all.forEach(function (id) { map[id] = BASE + "f/" + id + ".jpg"; });
        return;
      }
      // запасной путь (нет служебного работника: встроенный браузер WhatsApp/Telegram, старый браузер).
      // Раньше здесь до показа расшифровывались ВСЕ фото (14 МБ) - на мобильном это полминуты и больше.
      // Теперь до показа - только первое нужное (фон, знак, первые фото работ), остальное в фоне по 6 сразу.
      // Пока фото не готово, в данных стоит прозрачная заглушка с меткой "#kr=<id>"; когда фото готово,
      // заглушка меняется на настоящий адрес во всех элементах страницы (и в тех, что появятся позже).
      lazy = true;
      var first = prio(data, all), sn = soon(data, all), head = first.concat(sn.filter(function (id) { return first.indexOf(id) < 0; })), queue = head.concat(all.filter(function (id) { return head.indexOf(id) < 0; }));
      var need = {}; first.forEach(function (id) { need[id] = 1; });
      var left = first.length, done = 0, gate;
      var gateP = new Promise(function (ok) { gate = ok; if (!left) ok(); setTimeout(ok, 15000); });
      var qi = 0;
      function next() {
        if (qi >= queue.length) return Promise.resolve();
        var id = queue[qi++];
        return fetchBin(id + ".bin").then(function (buf) { return open(key, buf); }).then(function (p) {
          map[id] = URL.createObjectURL(new Blob([p], { type: mime(p) }));
          (WAIT[id] || []).forEach(function (f) { f(map[id]); }); delete WAIT[id];
          swapSoon();
        }).catch(function () {}).then(function () {
          if (need[id]) { done++; if (progress) progress(done, first.length); if (--left <= 0) gate(); }
          return next();
        });
      }
      for (var w = 0; w < 6; w++) next();
      watchSwap();
      return gateP;
    }).then(function () {
      // ссылка на фото - только "@" + шестнадцатеричный id; остальные строки с "@" (Telegram "@имя") не трогаем
      if (lazy) return function (ref) { if (!isRef(ref)) return ref; var id = ref.slice(1); return map[id] || PH + "#kr=" + id; };
      return function (ref) { return isRef(ref) ? (map[ref.slice(1)] || "") : ref; };
    });
  }
  function mapDeep(x, fn) {
    if (typeof x === "string") return fn(x);
    if (Array.isArray(x)) return x.map(function (y) { return mapDeep(y, fn); });
    if (x && typeof x === "object") { var o = {}; Object.keys(x).forEach(function (k) { o[k] = mapDeep(x[k], fn); }); return o; }
    return x;
  }

  // ---------- вход ----------
  function unlock() {
    if (!subtle) {
      lockScreen(); msg("Этот браузер не умеет расшифровывать. Откройте ссылку в Chrome, Safari или Edge.");
      document.getElementById("krGo").disabled = true;
      return new Promise(function () {});
    }
    var meta, dataBuf;
    return Promise.all([
      fetch(BASE + "enc/meta.json", { cache: "no-cache" }).then(function (r) { return r.json(); }),
      fetchBin("d.bin"), getKey()
    ]).then(function (a) {
      meta = a[0]; dataBuf = a[1];
      var rec = a[2];
      if (rec && rec.key && rec.salt === meta.salt) {
        return open(rec.key, dataBuf).then(function (plain) { return { key: rec.key, plain: plain }; }, function () { return askPin(meta, dataBuf); });
      }
      return askPin(meta, dataBuf);
    }).then(function (r) {
      var data = JSON.parse(new TextDecoder().decode(r.plain));
      return sloj(r.key, data).then(function () { r.data = data; return r; });
    }).then(function (r) {
      var data = r.data;
      var el = document.getElementById("krLock");
      if (el) msg("Открываю фото...", true);
      return photoMap(r.key, data, function (d, n) { if (el) msg("Открываю фото: " + d + " из " + n, true); }).then(function (fn) {
        unlockScreen();
        return { data: mapDeep(data, fn), photo: fn };
      });
    }).catch(function (e) {
      lockScreen(); msg("Не удалось открыть витрину: " + (e && e.message || e) + ". Проверьте интернет и обновите страницу.");
      throw e;
    });
  }
  // ---------- правки мастера ----------
  // enc/m.bin - то, что мастер опубликовал сам из Мастерской (тексты, новые работы, фото, скрытые работы).
  // Нет файла - витрина как была. Не читается - показываем витрину без правок (и пишем в консоль).
  function loadScript(src) {
    return new Promise(function (ok, no) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { no(new Error("нет " + src)); }; document.head.appendChild(s); });
  }
  function sloj(key, data) {
    window.KR_SLOJ = null;
    return fetch(BASE + "enc/m.bin", { cache: "no-cache" }).then(function (r) {
      if (!r.ok) return null;
      return r.arrayBuffer().then(function (buf) { return open(key, buf); }).then(function (p) {
        var L = JSON.parse(new TextDecoder().decode(p));
        return (window.KrSloj ? Promise.resolve() : loadScript(BASE + "sloj.js")).then(function () {
          window.KR_SLOJ = JSON.parse(JSON.stringify(L)); // как есть, со ссылками "@id" - для Мастерской
          if (data.vitrina) window.KrSloj.apply(data.vitrina, L);
        });
      });
    }).catch(function (e) { try { console.warn("Правки мастера не подмешаны:", e); } catch (x) {} });
  }

  function logout() {
    try { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage("kr-forget"); } catch (e) {}
    return dropKey().then(function () { location.href = BASE; });
  }

  // страница витрины (вариант 3 или 4) внутри закрытой части: данные - из расшифровки, дальше - обычные скрипты
  function page(opts) {
    style();
    var hide = document.createElement("style"); hide.id = "krHide"; hide.textContent = "body>*:not(#krLock){visibility:hidden}"; document.head.appendChild(hide);
    return unlock().then(function (r) {
      window.VITRINA = r.data.vitrina;
      var list = (opts && opts.scripts) || [];
      window.KR_DATA = r.data; // для kr-dom.js: приветствие и т.п.
      return list.reduce(function (p, src) {
        return p.then(function () {
          return new Promise(function (ok, no) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.body.appendChild(s); });
        });
      }, Promise.resolve()).then(function () {
        hide.remove();
        // чистая версия для клиентов: скрытый вход мастера удержанием знака (master-vhod.js)
        if (window.MEBEL_TOOL === "kr-klient" || window.MEBEL_TOOL === "kr-proba" || window.MEBEL_TOOL === "kr-novaya") loadScript(BASE + "master-vhod.js").catch(function () {});
        if (opts && opts.back === "none") return; // главная (дом): возвращаться некуда
        var a = document.createElement("a"); a.id = "krBack"; a.href = BASE; a.textContent = "← Назад"; a.title = "Назад к дому"; if (opts && opts.back === "bl") a.className = "bl";
        document.body.appendChild(a);
      });
    });
  }

  window.KrZamok = { when: when, unlock: unlock, page: page, logout: logout, base: BASE, idb: idb, b64: b64, fetchBin: fetchBin, mime: mime };
})();
