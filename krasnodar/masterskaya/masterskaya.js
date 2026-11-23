/* Мастерская закрытой витрины (Краснодар).
   - "О мастере": название, имя, чем занимается, город, опыт, текст о себе, контакты, знак (логотип).
   - "Лента": новая работа или новые фото/видео к готовой работе. Водяной знак впечатывается сам:
       фото - на холсте (canvas), видео - кадр за кадром на холсте с записью MediaRecorder (идёт столько же, сколько
       длится ролик; звук сохраняется). Оригиналы фото храним, чтобы при смене знака пересобрать их.
   - "Водяной знак": что ставить (знак, надпись или оба), где (9 мест или узор по всему фото), размер, прозрачность, цвет.
   - Готовые работы: поправить название и рассказ, добавить фото, скрыть с сайта (и вернуть).
   - Голос: у текстовых полей "Надиктовать" (Web Speech API, где браузер умеет) и "Вставить" (текст из буфера -
       например, продиктованный в другой программе).
   - "Опубликовать": если Александр включил публикацию (publik.js) и мастер ввёл код мастера - правки уходят на сайт
       сами, одним коммитом в репозиторий (enc/m.bin + новые зашифрованные файлы). Иначе - ZIP-пакет pravki.json + foto/*:
       его кладут в /mnt/project-files/vitrina-vk/, site/tools/zashifrovat-krasnodar.js сам подмешивает правки.
   Черновик живёт в этом браузере: тексты - localStorage "kr-ms", файлы - IndexedDB "kr-ms". */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var D = window.VITRINA || {}, M0 = D.master || {}, K0 = D.kontakty || {};
  var KEY = "kr-ms";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function toast(t, ms) { var e = $("toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove("on"); }, ms || 2600); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function plural(n, f) { n = Math.abs(n) % 100; var d = n % 10; return n > 10 && n < 20 ? f[2] : d === 1 ? f[0] : d >= 2 && d <= 4 ? f[1] : f[2]; }
  var IC_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // ---------- черновик ----------
  var S;
  try { S = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  S = S || {};
  S.master = S.master || {}; S.kontakty = S.kontakty || {};
  S.znak = Object.assign({ chto: "oba", pos: "np", razmer: 11, prozr: 70, cvet: "#ffffff", tekst: M0.znak || M0.imya || "" }, S.znak || {});
  if (!/^(uzor|[vcn][lcp])$/.test(S.znak.pos)) S.znak.pos = "np";
  S.novye = S.novye || []; S.k = S.k || []; // k - добавки к готовым работам: [{ rabota, media: [...] }]
  var saveT = 0;
  function save() { clearTimeout(saveT); saveT = setTimeout(function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("Браузеру не хватило памяти - скачайте пакет"); } counts(); }, 250); }

  // ---------- IndexedDB для файлов ----------
  var DBP = null;
  function db() {
    if (DBP) return DBP;
    DBP = new Promise(function (ok, no) { var r = indexedDB.open(KEY, 1); r.onupgradeneeded = function () { r.result.createObjectStore("f"); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; });
    return DBP;
  }
  function put(id, blob) { return db().then(function (d) { return new Promise(function (ok, no) { var t = d.transaction("f", "readwrite"); t.objectStore("f").put(blob, id); t.oncomplete = function () { ok(); }; t.onerror = function () { no(t.error); }; }); }); }
  function get(id) { return db().then(function (d) { return new Promise(function (ok) { var q = d.transaction("f").objectStore("f").get(id); q.onsuccess = function () { ok(q.result || null); }; q.onerror = function () { ok(null); }; }); }); }
  function del(id) { return db().then(function (d) { d.transaction("f", "readwrite").objectStore("f").delete(id); }).catch(function () {}); }
  var URLS = {};
  function blobUrl(id) { if (URLS[id]) return Promise.resolve(URLS[id]); return get(id).then(function (b) { if (!b) return ""; URLS[id] = URL.createObjectURL(b); return URLS[id]; }); }

  // ---------- знак мастера (svg) ----------
  var LOGO_SVG = ""; // текст svg с currentColor
  function cleanSvg(t) { return String(t || "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<\?xml[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<!--[\s\S]*?-->/gi, "").replace(/<(metadata|title|desc|foreignObject)[\s\S]*?<\/\1>/gi, "").replace(/(href\s*=\s*["'])\s*javascript:[^"']*/gi, "$1#").replace(/\son\w+\s*=\s*(["']).*?\1/gi, ""); }
  function loadLogo() {
    var p = S.logo ? get("logo").then(function (b) { return b ? b.text() : ""; }) :
      M0.logo ? fetch(M0.logo).then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; }) : Promise.resolve("");
    return p.then(function (t) {
      LOGO_SVG = /<svg[\s>]/i.test(t) ? cleanSvg(t) : "";
      if (!LOGO_SVG && S.logo) return get("logo").then(function (b) { if (b) LOGO_RASTER = b; });
    }).then(function () { logoImgP = null; drawTop(); });
  }
  var LOGO_RASTER = null, logoImgP = null;
  function drawTop() {
    var i = $("logoTop");
    $("nmTop").textContent = val("master", "imya") || "Мастерская";
    if (LOGO_SVG) { i.innerHTML = LOGO_SVG; i.hidden = false; } else i.hidden = true;
  }
  // знак для холста: svg перекрашиваем в выбранный цвет и задаём размер (без него некоторые браузеры не рисуют)
  function logoImg() {
    if (logoImgP) return logoImgP;
    logoImgP = new Promise(function (ok) {
      var src;
      if (LOGO_SVG) {
        var t = LOGO_SVG.replace(/currentColor/g, S.znak.cvet);
        if (!/<svg[^>]*\swidth=/i.test(t)) t = t.replace(/<svg/i, '<svg width="512" height="512"');
        if (!/xmlns=/.test(t)) t = t.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
        src = URL.createObjectURL(new Blob([t], { type: "image/svg+xml" }));
      } else if (LOGO_RASTER) src = URL.createObjectURL(LOGO_RASTER);
      else return ok(null);
      var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = src;
    });
    return logoImgP;
  }

  // ---------- водяной знак на холсте ----------
  // Один и тот же рисунок для фото, видео и предпросмотра. Размер - доля короткой стороны кадра.
  function drawWM(ctx, W, H, Z, logo) {
    var base = Math.min(W, H), h = Math.max(14, base * Z.razmer / 100), m = base * .035;
    var txt = Z.chto !== "logo" ? String(Z.tekst || "").trim() : "", useLogo = Z.chto !== "tekst" && logo;
    if (!txt && !useLogo) return;
    var fs = h * (useLogo ? .36 : .5), gap = useLogo && txt ? h * .28 : 0;
    ctx.save();
    ctx.font = "400 " + fs + "px Playfair, Georgia, serif";
    var tw = txt ? ctx.measureText(txt).width : 0, lw = useLogo ? h : 0, bw = lw + gap + tw, bh = Math.max(lw ? h : 0, fs * 1.2);
    ctx.globalAlpha = Z.prozr / 100;
    ctx.fillStyle = Z.cvet; ctx.textBaseline = "middle";
    var dark = Z.cvet.toLowerCase() === "#ffffff";
    ctx.shadowColor = dark ? "rgba(0,0,0,.35)" : "rgba(255,255,255,.3)"; ctx.shadowBlur = h * .08;
    function one(x, y) { if (useLogo) ctx.drawImage(logo, x, y + (bh - h) / 2, h, h); if (txt) ctx.fillText(txt, x + lw + gap, y + bh / 2); }
    if (Z.pos === "uzor") {
      ctx.globalAlpha = Z.prozr / 100 * .55;
      ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 7.5);
      var sx = bw + h * 2.2, sy = bh + h * 2.4, R = Math.hypot(W, H) / 2 + sx;
      for (var y = -R, row = 0; y < R; y += sy, row++) for (var x = -R + (row % 2 ? sx / 2 : 0); x < R; x += sx) one(x - bw / 2, y - bh / 2);
    } else {
      var px = Z.pos.charAt(1), py = Z.pos.charAt(0); // pos: "vl" "vc" "vp" / "cl" ... / "nl" "nc" "np" (верх/центр/низ, лево/центр/право)
      var x0 = px === "l" ? m : px === "c" ? (W - bw) / 2 : W - m - bw;
      var y0 = py === "v" ? m : py === "c" ? (H - bh) / 2 : H - m - bh;
      one(x0, y0);
    }
    ctx.restore();
  }
  function fontsReady() { return document.fonts && document.fonts.load ? document.fonts.load('400 40px Playfair').catch(function () {}) : Promise.resolve(); }

  // ---------- фото ----------
  function loadBitmap(blob) {
    if (window.createImageBitmap) return createImageBitmap(blob).catch(function () { return viaImg(blob); });
    return viaImg(blob);
  }
  function viaImg(blob) { return new Promise(function (ok, no) { var u = URL.createObjectURL(blob), im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { no(new Error("Не получилось открыть фото (формат HEIC открывается не во всех браузерах - снимите в JPEG или пришлите с телефона)")); }; im.src = u; }); }
  function toBlob(c, q) { return new Promise(function (ok, no) { c.toBlob(function (b) { b ? ok(b) : no(new Error("Не получилось сохранить фото")); }, "image/jpeg", q); }); }
  function fit(w, h, max) { var k = Math.min(1, max / Math.max(w, h)); return { w: Math.round(w * k), h: Math.round(h * k) }; }
  function renderPhoto(orig) {
    return Promise.all([loadBitmap(orig), logoImg(), fontsReady()]).then(function (a) {
      var bm = a[0], s = fit(bm.width, bm.height, 1600), c = document.createElement("canvas"); c.width = s.w; c.height = s.h;
      var x = c.getContext("2d"); x.drawImage(bm, 0, 0, s.w, s.h); drawWM(x, s.w, s.h, S.znak, a[1]);
      return toBlob(c, .86).then(function (b) { return { blob: b, w: s.w, h: s.h }; });
    });
  }
  function addPhoto(file, list, card) {
    var it = { id: uid(), tip: "foto", ext: "jpg", st: "work" }; list.push(it); drawMedia(card, list);
    // оригинал уменьшаем до 2000 px (без знака) - из него пересобираем, если мастер поменяет знак
    return loadBitmap(file).then(function (bm) {
      var s = fit(bm.width, bm.height, 2000), c = document.createElement("canvas"); c.width = s.w; c.height = s.h;
      c.getContext("2d").drawImage(bm, 0, 0, s.w, s.h);
      return toBlob(c, .9);
    }).then(function (o) { return put("o:" + it.id, o).then(function () { return renderPhoto(o); }); })
      .then(function (r) { return put("m:" + it.id, r.blob).then(function () { it.st = "ok"; it.w = r.w; it.h = r.h; it.znak = sig(); }); })
      .catch(function (e) { it.st = "err"; it.err = e.message || String(e); })
      .then(function () { save(); drawMedia(card, list); });
  }
  function sig() { var z = S.znak; return [z.chto, z.pos, z.razmer, z.prozr, z.cvet, z.tekst, S.logoV || 0].join("|"); }

  // ---------- видео: знак кадр за кадром ----------
  var REC = null; // идущая запись (для кнопки "Остановить")
  function recMime() {
    if (!window.MediaRecorder) return "";
    var L = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    for (var i = 0; i < L.length; i++) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(L[i])) return L[i];
    return "";
  }
  function videoOk() { var c = document.createElement("canvas"); return !!(c.captureStream && recMime()); }
  function addVideo(file, list, card) {
    if (!videoOk()) { toast("Этот браузер не умеет записывать видео со знаком. Откройте Мастерскую в Chrome или Safari 15+", 5000); return Promise.resolve(); }
    var it = { id: uid(), tip: "video", st: "work", p: 0 }; list.push(it); drawMedia(card, list);
    var v = document.createElement("video"), src = URL.createObjectURL(file);
    v.src = src; v.playsInline = true; v.setAttribute("playsinline", ""); v.preload = "auto"; v.crossOrigin = "anonymous";
    var busy = $("busy"), stop = false, actx = null;
    function fin(e) {
      busy.hidden = true; REC = null;
      try { v.pause(); } catch (x) {}
      if (actx) try { actx.close(); } catch (x) {}
      URL.revokeObjectURL(src);
      if (e) { it.st = "err"; it.err = e.message || String(e); }
      save(); drawMedia(card, list);
    }
    return new Promise(function (done) {
      v.onerror = function () { fin(new Error("Не получилось открыть видео: формат не поддерживается этим браузером")); done(); };
      v.onloadedmetadata = function () {
        var dur = v.duration;
        if (!isFinite(dur) || dur <= 0) dur = 0;
        if (dur > 180) { fin(new Error("Ролик длиннее 3 минут - обрежьте его в галерее телефона")); done(); return; }
        Promise.all([logoImg(), fontsReady()]).then(function (a) {
          var s = fit(v.videoWidth, v.videoHeight, innerWidth < 900 ? 1280 : 1920), c = document.createElement("canvas"); c.width = s.w; c.height = s.h;
          var x = c.getContext("2d"), logo = a[0], mime = recMime();
          var stream = c.captureStream(30), tracks = stream.getVideoTracks().slice();
          // звук ролика - через Web Audio в запись (в динамики не идёт)
          try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (AC) { actx = new AC(); var srcN = actx.createMediaElementSource(v), dst = actx.createMediaStreamDestination(); srcN.connect(dst); tracks = tracks.concat(dst.stream.getAudioTracks()); }
          } catch (e) { v.muted = true; }
          var rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: s.w * s.h > 1e6 ? 4.5e6 : 2.5e6, audioBitsPerSecond: 128000 });
          var parts = [];
          rec.ondataavailable = function (e) { if (e.data && e.data.size) parts.push(e.data); };
          rec.onstop = function () {
            if (stop) { fin(new Error("Остановлено")); list.splice(list.indexOf(it), 1); drawMedia(card, list); done(); return; }
            var type = (mime.split(";")[0]) || "video/webm", blob = new Blob(parts, { type: type });
            it.ext = /mp4/.test(type) ? "mp4" : "webm"; it.w = s.w; it.h = s.h; it.dur = Math.round(dur);
            put("m:" + it.id, blob).then(function () { return put("k:" + it.id, kadr || new Blob()); }).then(function () { it.st = "ok"; it.znak = sig(); it.size = blob.size; fin(); done(); })
              .catch(function (e) { fin(e); done(); });
          };
          var kadr = null, kadrT = Math.min(1, dur / 3);
          function paint() {
            x.drawImage(v, 0, 0, s.w, s.h); drawWM(x, s.w, s.h, S.znak, logo);
            if (!kadr && v.currentTime >= kadrT) { kadr = "wait"; c.toBlob(function (b) { kadr = b; }, "image/jpeg", .82); }
            var p = dur ? Math.min(1, v.currentTime / dur) : 0; it.p = p; $("busyP").style.width = (p * 100).toFixed(1) + "%";
            $("busyS").textContent = "Знак впечатывается в каждый кадр, это занимает столько же, сколько длится ролик (" + Math.round(dur) + " с). Не сворачивайте страницу и не гасите экран.";
          }
          var useRVFC = "requestVideoFrameCallback" in HTMLVideoElement.prototype;
          function loop() { if (v.ended || stop) return; paint(); if (useRVFC) v.requestVideoFrameCallback(loop); else requestAnimationFrame(loop); }
          v.onended = function () { paint(); setTimeout(function () { if (rec.state !== "inactive") rec.stop(); }, 120); };
          REC = { stop: function () { stop = true; try { v.pause(); } catch (e) {} if (rec.state !== "inactive") rec.stop(); } };
          $("busyT").textContent = "Видео со знаком"; $("busyP").style.width = "0"; busy.hidden = false;
          rec.start(1000);
          var pl = v.play();
          if (pl && pl.then) pl.then(loop).catch(function (e) { REC.stop(); fin(new Error("Браузер не дал проиграть ролик: " + (e.message || e))); done(); });
          else loop();
        }).catch(function (e) { fin(e); done(); });
      };
    });
  }
  $("busyX").onclick = function () { if (REC) REC.stop(); };

  // ---------- общие значения: черновик поверх данных витрины ----------
  function val(sec, k) { var s = S[sec] || {}, b = sec === "master" ? M0 : K0; return s[k] != null ? s[k] : (b[k] || ""); }
  function fld(sec, k, label, o) {
    o = o || {}; var v = val(sec, k), ch = S[sec][k] != null && S[sec][k] !== ((sec === "master" ? M0 : K0)[k] || "");
    var inp = o.area ? '<textarea data-s="' + sec + '" data-k="' + k + '" rows="4">' + esc(v) + "</textarea>" :
      '<input data-s="' + sec + '" data-k="' + k + '" value="' + esc(v) + '"' + (o.voice ? " data-voice" : "") + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : "") + (o.mode ? ' inputmode="' + o.mode + '"' : "") + ">";
    return '<div class="f' + (o.w ? " w" : "") + '"><label>' + label + "</label>" + inp + (o.hint ? "<small>" + o.hint + "</small>" : "") + (ch ? '<span class="was">Было: ' + esc((sec === "master" ? M0 : K0)[k] || "пусто") + "</span>" : "") + "</div>";
  }
  document.addEventListener("input", function (e) {
    var t = e.target, sec = t.getAttribute && t.getAttribute("data-s"); if (!sec) return;
    var k = t.getAttribute("data-k"), base = ((sec === "master" ? M0 : K0)[k] || "");
    if (t.value.trim() === String(base).trim()) delete S[sec][k]; else S[sec][k] = t.value; // лишний пробел - не правка
    if (k === "imya") drawTop();
    if (k === "znak" && sec === "master") { S.znak.tekst = t.value; }
    save();
  });

  // ---------- вкладки ----------
  var TAB = "master";
  [].forEach.call(document.querySelectorAll(".tabs button"), function (b) { b.onclick = function () { go(b.getAttribute("data-t")); }; });
  function go(t) {
    TAB = t;
    [].forEach.call(document.querySelectorAll(".tabs button"), function (b) { b.setAttribute("aria-selected", b.getAttribute("data-t") === t); });
    ({ master: vMaster, lenta: vLenta, znak: vZnak, paket: vPaket })[t]();
    scrollTo(0, 0);
  }
  function counts() {
    var n = 0; S.novye.concat(S.k).forEach(function (w) { n += (w.media || []).filter(function (m) { return m.st === "ok"; }).length; });
    $("cntL").textContent = n || "";
    var c = changes(), ch = c.m + c.k + (c.logo ? 1 : 0) + n + c.raboty + c.pravka + c.skryt + c.vernut;
    $("cntP").textContent = ch || "";
  }

  // ---------- О мастере ----------
  function vMaster() {
    $("main").innerHTML = '<section role="tabpanel"><h1>О мастере</h1><p class="lead">Что видит клиент на витрине: название, кто вы, чем занимаетесь, контакты и знак. Меняйте прямо здесь - всё сохраняется в этом браузере, пока вы не нажмёте «Опубликовать». Текст можно надиктовать кнопкой под полем или вставить готовый - например, продиктованный в WhatsApp или заметках.</p>' +
      '<div class="eyebrow">Знак</div><div class="card"><div class="logo-row"><div class="logo-box" id="lgBox"></div><div><p style="margin-bottom:10px;max-width:420px">Лучше SVG (чёткий при любом размере). Подойдёт и PNG с прозрачным фоном. Знак стоит в шапке витрины и в водяном знаке.</p>' +
      '<div class="btns" style="margin-top:0"><span class="btn l sm file">Загрузить знак<input type="file" id="lgIn" accept=".svg,image/svg+xml,image/png"></span>' + (S.logo ? '<button type="button" class="btn l sm" id="lgDel">Вернуть прежний</button>' : "") + "</div></div></div></div>" +
      '<div class="eyebrow">Мастерская</div><div class="card g2">' +
      fld("master", "imya", "Название (главное на витрине)") + fld("master", "chelovek", "Имя мастера", { hint: "Мелко внизу страницы" }) +
      fld("master", "rol", "Чем занимаетесь", { voice: 1 }) + fld("master", "gorod", "Город, район") +
      fld("master", "opyt", "Опыт", { ph: "7+ лет" }) + fld("master", "rabot", "Сколько работ сделано", { ph: "300+" }) +
      fld("master", "o_sebe", "О себе", { area: 1, w: 1, hint: "2-4 предложения простыми словами: что делаете и чем удобно работать с вами" }) +
      fld("master", "znak", "Надпись водяного знака", { w: 1, hint: "Для новых фото и видео. Где и как стоит знак - во вкладке «Водяной знак»" }) + "</div>" +
      '<div class="eyebrow">Контакты</div><div class="card g2">' +
      fld("kontakty", "whatsapp", "WhatsApp (номер)", { mode: "tel", ph: "79990000000" }) + fld("kontakty", "telegram", "Telegram", { ph: "@имя" }) +
      fld("kontakty", "max", "Max (ссылка)", { ph: "max.ru/...", hint: "В приложении Max: профиль - поделиться - скопировать ссылку" }) +
      fld("kontakty", "telefon", "Телефон для звонка", { mode: "tel" }) + fld("kontakty", "vk", "ВКонтакте", { ph: "vk.ru/..." }) +
      fld("kontakty", "adres", "Адрес или район") + fld("kontakty", "chasy", "Часы работы", { ph: "Пн-Сб 9-19" }) + "</div></section>";
    var box = $("lgBox"); box.innerHTML = LOGO_SVG || (LOGO_RASTER ? "" : '<span style="color:var(--muted);font-size:12px">нет</span>');
    if (!LOGO_SVG && LOGO_RASTER) { var im = new Image(); im.src = URL.createObjectURL(LOGO_RASTER); box.appendChild(im); }
    $("lgIn").onchange = function () {
      var f = this.files[0]; if (!f) return;
      if (f.size > 600 * 1024) { toast("Файл знака больше 600 КБ - нужен попроще"); return; }
      put("logo", f).then(function () { S.logo = { name: f.name, type: f.type || (/\.svg$/i.test(f.name) ? "image/svg+xml" : "image/png") }; S.logoV = (S.logoV || 0) + 1; LOGO_RASTER = null; save(); return loadLogo(); })
        .then(function () { toast("Знак загружен"); vMaster(); });
    };
    if ($("lgDel")) $("lgDel").onclick = function () { del("logo"); delete S.logo; S.logoV = (S.logoV || 0) + 1; LOGO_RASTER = null; save(); loadLogo().then(vMaster); };
    voiceUp($("main"));
  }

  // ---------- Лента ----------
  // поля описания работы: клиент видит их чипами под названием и по нажатию на фото во весь экран (пустые не показываются)
  var WF = [["material", "Материал", "ЛДСП Egger, МДФ эмаль"], ["cvet", "Цвет и отделка", "Тёмно-синий матовый, дуб"], ["razmery", "Размеры", "3,2 x 2,4 м"], ["god", "Год", "2025"]];
  function wfHas(w) { return WF.some(function (f) { return w[f[0]] != null && String(w[f[0]]).trim(); }); }
  function wfInputs(w, base) { return '<div class="g2">' + WF.map(function (f) { var v = w[f[0]] != null ? w[f[0]] : (base && base[f[0]]) || ""; return '<div class="f"><label>' + f[1] + '</label><input data-w="' + f[0] + '" value="' + esc(v) + '" placeholder="' + f[2] + '"></div>'; }).join("") + "</div>"; }
  function ordRooms() { return (D.komnaty || []).slice(); }
  function workById(id) { return (D.raboty || []).filter(function (r) { return r.id === id; })[0] || null; }
  function workCard(w, isNew, i) {
    var rs = ordRooms(), base = isNew ? null : (workById(w.rabota) || {}), title = isNew ? (w.nazvanie || "Новая работа") : (base.nazvanie || w.rabota);
    var h = '<div class="card' + (!isNew && w.skryt ? " hidden-w" : "") + '" data-card="' + (isNew ? "n" : "k") + i + '">';
    if (isNew) {
      h += '<div class="g2"><div class="f"><label>Название работы</label><input data-w="nazvanie" data-voice value="' + esc(w.nazvanie || "") + '" placeholder="Кухня с островом в ЖК ..."></div>' +
        '<div class="f"><label>Комната на витрине</label><select data-w="komnata">' + rs.map(function (k) { return '<option value="' + esc(k.id) + '"' + (w.komnata === k.id ? " selected" : "") + ">" + esc(k.nazvanie) + "</option>"; }).join("") + "</select></div>" +
        '<div class="f w"><label>Рассказ о работе</label><textarea data-w="rasskaz" rows="3" placeholder="Что хотел заказчик, что придумали, сроки, материалы">' + esc(w.rasskaz || "") + "</textarea></div></div>" + wfInputs(w, null);
    } else {
      h += '<div class="g2"><div class="f w"><label>Название работы</label><input data-w="nazvanie" data-voice value="' + esc(w.nazvanie != null ? w.nazvanie : base.nazvanie || "") + '"></div>' +
        '<div class="f w"><label>Рассказ о работе</label><textarea data-w="rasskaz" rows="3" placeholder="Что хотел заказчик, что придумали, сроки, материалы">' + esc(w.rasskaz != null ? w.rasskaz : base.rasskaz || "") + "</textarea></div></div>" + wfInputs(w, base) +
        '<label class="chk"><input type="checkbox" data-skryt' + (w.skryt ? " checked" : "") + "> Скрыть эту работу с витрины (потом можно вернуть)</label>";
    }
    h += '<div class="media"></div><div class="btns"><span class="btn sm file">Добавить фото и видео<input type="file" accept="image/*,video/*" multiple data-add></span>' +
      '<button type="button" class="btn l sm" data-rm>' + (isNew ? "Убрать работу" : "Отменить правки") + "</button></div></div>";
    return h;
  }
  function vLenta() {
    var opts = (D.raboty || []).map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.nazvanie) + "</option>"; }).join("");
    var SL = window.KR_SLOJ || {}, hid = (SL.skryt || []).filter(function (id) { return !workById(id); });
    $("main").innerHTML = '<section role="tabpanel"><h1>Работы</h1><p class="lead">Добавляйте фото и видео с телефона - водяной знак впечатается сам. Фото уменьшаются до 1600 px, видео - до 1280 px на телефоне и 1920 px на компьютере.</p>' +
      (videoOk() ? "" : '<p class="note">Этот браузер не умеет записывать видео со знаком - фото добавляются как обычно. Для видео откройте Мастерскую в <b>Chrome</b> или <b>Safari 15+</b>.</p>') +
      '<div class="eyebrow">Новые работы</div><div id="nw">' + S.novye.map(function (w, i) { return workCard(w, true, i); }).join("") + "</div>" +
      '<div class="btns"><button type="button" class="btn" id="addW">Новая работа</button></div>' +
      '<div class="eyebrow">Готовые работы</div><p class="lead" style="margin-bottom:14px">Поправить название или рассказ, добавить фото, скрыть с витрины.</p><div id="kw">' + S.k.map(function (w, i) { return workCard(w, false, i); }).join("") + "</div>" +
      '<div class="card"><div class="f"><label>Работа на витрине</label><select id="kSel"><option value="">Выберите работу</option>' + opts + "</select></div></div>" +
      (hid.length ? '<div class="eyebrow">Скрыты с витрины</div><div class="card"><div class="list">' + hid.map(function (id) {
        var back = (S.vernut || []).indexOf(id) >= 0;
        return '<div class="row"><span class="sp"><b>' + esc((SL.imena || {})[id] || "Работа") + "</b>" + (back ? "<br><span>Вернётся после публикации</span>" : "") + '</span><button type="button" class="btn l sm" data-vernut="' + esc(id) + '">' + (back ? "Оставить скрытой" : "Вернуть") + "</button></div>";
      }).join("") + "</div></div>" : "") + "</section>";
    S.novye.forEach(function (w, i) { bindCard(document.querySelector('[data-card="n' + i + '"]'), w, true, i); });
    S.k.forEach(function (w, i) { bindCard(document.querySelector('[data-card="k' + i + '"]'), w, false, i); });
    $("addW").onclick = function () { var k = (ordRooms()[0] || {}).id || ""; S.novye.push({ id: "ms-" + uid(), nazvanie: "", komnata: k, rasskaz: "", media: [] }); save(); vLenta(); var c = document.querySelector('[data-card="n' + (S.novye.length - 1) + '"] input'); if (c) c.focus(); };
    $("kSel").onchange = function () { if (!this.value) return; var id = this.value; var ex = S.k.filter(function (w) { return w.rabota === id; })[0]; if (!ex) { S.k.push({ rabota: id, media: [] }); save(); } vLenta(); var c = document.querySelector('[data-card="k' + (ex ? S.k.indexOf(ex) : S.k.length - 1) + '"]'); if (c) c.scrollIntoView({ block: "center" }); };
    [].forEach.call(document.querySelectorAll("[data-vernut]"), function (b) { b.onclick = function () {
      var id = b.getAttribute("data-vernut"); S.vernut = S.vernut || []; var j = S.vernut.indexOf(id);
      if (j >= 0) S.vernut.splice(j, 1); else S.vernut.push(id); save(); vLenta();
    }; });
    voiceUp($("main"));
  }
  function bindCard(card, w, isNew, i) {
    if (!card) return;
    w.media = w.media || [];
    drawMedia(card, w.media);
    var base = isNew ? null : (workById(w.rabota) || {});
    [].forEach.call(card.querySelectorAll("[data-w]"), function (e) { e.addEventListener(e.tagName === "SELECT" ? "change" : "input", function () {
      var k = e.getAttribute("data-w");
      if (!isNew && e.value.trim() === String(base[k] || "").trim()) delete w[k]; else w[k] = e.value; // у готовой работы храним только изменённое
      save();
    }); });
    var sk = card.querySelector("[data-skryt]");
    if (sk) sk.onchange = function () { if (sk.checked) w.skryt = true; else delete w.skryt; card.classList.toggle("hidden-w", sk.checked); save(); };
    card.querySelector("[data-add]").onchange = function () {
      var fs = [].slice.call(this.files); this.value = "";
      // по одному: видео пишутся в реальном времени, фото - быстро
      fs.reduce(function (p, f) { return p.then(function () { return /^video\//.test(f.type) ? addVideo(f, w.media, card) : addPhoto(f, w.media, card); }); }, Promise.resolve())
        .then(function () { var bad = w.media.filter(function (m) { return m.st === "err"; }).length; toast(bad ? "Готово, но не всё получилось - см. отметки" : "Добавлено со знаком"); });
    };
    card.querySelector("[data-rm]").onclick = function () {
      if (w.media.length && !confirm("Убрать вместе с " + w.media.length + " " + plural(w.media.length, ["файлом", "файлами", "файлами"]) + "?")) return;
      w.media.forEach(function (m) { del("m:" + m.id); del("o:" + m.id); del("k:" + m.id); });
      (isNew ? S.novye : S.k).splice(i, 1); save(); vLenta();
    };
  }
  function drawMedia(card, list) {
    var box = card && card.querySelector(".media"); if (!box) return;
    box.innerHTML = list.map(function (m, j) {
      var st = m.st === "work" ? (m.tip === "video" ? "Видео: впечатываю знак..." : "Фото: впечатываю знак...") : m.st === "err" ? esc(m.err || "Ошибка") : m.tip === "video" ? (m.dur || 0) + " с, " + Math.round((m.size || 0) / 1048576 * 10) / 10 + " МБ" : "";
      return '<div class="m' + (m.st === "err" ? " err" : "") + '" data-j="' + j + '"><span class="tip">' + (m.tip === "video" ? "Видео" : "Фото") + "</span>" +
        (m.st === "work" ? "" : '<button type="button" class="x" aria-label="Убрать">' + IC_X + "</button>") + (st ? '<span class="st">' + st + "</span>" : "") + "</div>";
    }).join("");
    list.forEach(function (m, j) {
      var el = box.querySelector('[data-j="' + j + '"]'); if (!el) return;
      if (m.st === "ok") blobUrl(m.tip === "video" ? "k:" + m.id : "m:" + m.id).then(function (u) { if (u && el.isConnected) el.insertAdjacentHTML("afterbegin", '<img src="' + u + '" alt="">'); });
      var x = el.querySelector(".x"); if (x) x.onclick = function () { del("m:" + m.id); del("o:" + m.id); del("k:" + m.id); list.splice(j, 1); save(); drawMedia(card, list); };
    });
  }

  // ---------- Водяной знак ----------
  var PV = null; // картинка для предпросмотра
  function pvImage() {
    if (PV) return Promise.resolve(PV);
    var src = ""; (D.raboty || []).some(function (w) { var f = (w.foto || [])[0]; if (f && f.src) { src = f.src; return true; } return false; });
    return new Promise(function (ok) {
      if (!src) { var c = document.createElement("canvas"); c.width = 1200; c.height = 900; var x = c.getContext("2d"); var g = x.createLinearGradient(0, 0, 1200, 900); g.addColorStop(0, "#8a8173"); g.addColorStop(1, "#3c3a36"); x.fillStyle = g; x.fillRect(0, 0, 1200, 900); PV = c; return ok(c); }
      var im = new Image(); im.onload = function () { PV = im; ok(im); }; im.onerror = function () { PV = null; ok(null); }; im.src = src;
    });
  }
  function vZnak() {
    var Z = S.znak, POS = [["vl", "вверху слева"], ["vc", "вверху"], ["vp", "вверху справа"], ["cl", "слева"], ["cc", "в центре"], ["cp", "справа"], ["nl", "внизу слева"], ["nc", "внизу"], ["np", "внизу справа"]];
    $("main").innerHTML = '<section role="tabpanel"><h1>Водяной знак</h1><p class="lead">Впечатывается в новые фото и видео, которые вы добавляете во вкладке «Работы». Защищает от того, чтобы ваши работы выдавали за свои.</p><p class="note">Название на витрине здесь не меняется - оно во вкладке «О мастере», поле «Название». Уже выложенные фото тоже остаются как были.</p>' +
      '<div class="wm-grid"><div class="wm-pv"><div class="pv"><canvas id="pvC" width="1200" height="900"></canvas></div><p class="note">Так знак ляжет на фото. На видео - так же, в каждом кадре.</p></div><div>' +
      '<div class="eyebrow" style="margin-top:0">Что ставить</div><div class="seg" id="zChto">' + [["oba", "Знак и надпись"], ["logo", "Только знак"], ["tekst", "Только надпись"]].map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (Z.chto === o[0]) + '">' + o[1] + "</button>"; }).join("") + "</div>" +
      '<div class="f" style="margin-top:12px"><label>Надпись</label><input id="zTekst" value="' + esc(Z.tekst) + '"></div>' +
      '<div class="eyebrow">Где</div><div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap"><div class="pos" id="zPos">' + POS.map(function (p) { return '<button type="button" data-v="' + p[0] + '" aria-label="' + p[1] + '" aria-pressed="' + (Z.pos === p[0]) + '"></button>'; }).join("") + "</div>" +
      '<div class="seg"><button type="button" id="zUzor" aria-pressed="' + (Z.pos === "uzor") + '">Узор по всему фото</button></div></div>' +
      '<div class="eyebrow">Размер</div><div class="rng"><input type="range" id="zR" min="5" max="40" step="1" value="' + Z.razmer + '"><output id="zRo">' + Z.razmer + "%</output></div>" +
      '<div class="eyebrow">Прозрачность</div><div class="rng"><input type="range" id="zP" min="10" max="100" step="5" value="' + Z.prozr + '"><output id="zPo">' + Z.prozr + "%</output></div>" +
      '<div class="eyebrow">Цвет</div><div class="seg" id="zCv"><button type="button" data-v="#ffffff" aria-pressed="' + (Z.cvet === "#ffffff") + '">Белый</button><button type="button" data-v="#1d1c1a" aria-pressed="' + (Z.cvet === "#1d1c1a") + '">Тёмный</button></div>' +
      '<div id="zRe"></div></div></div></section>';
    function redraw() {
      pvImage().then(function (im) {
        var c = $("pvC"); if (!c) return;
        var w = im ? (im.naturalWidth || im.width) : 1200, h = im ? (im.naturalHeight || im.height) : 900, s = fit(w, h, 1400);
        c.width = s.w; c.height = s.h; var x = c.getContext("2d");
        if (im) x.drawImage(im, 0, 0, s.w, s.h);
        return Promise.all([logoImg(), fontsReady()]).then(function (a) { drawWM(x, s.w, s.h, S.znak, a[0]); });
      });
      var old = 0; S.novye.concat(S.k).forEach(function (w) { (w.media || []).forEach(function (m) { if (m.st === "ok" && m.tip === "foto" && m.znak !== sig()) old++; }); });
      $("zRe").innerHTML = old ? '<p class="note">Уже добавлено ' + old + " " + plural(old, ["фото", "фото", "фото"]) + ' со старым знаком.</p><button type="button" class="btn l sm" id="zReB">Наложить новый знак на них</button>' : "";
      if ($("zReB")) $("zReB").onclick = rewm;
    }
    function set(k, v) { S.znak[k] = v; if (k === "cvet") logoImgP = null; save(); redraw(); }
    function seg(id, k) { var g = $(id); g.onclick = function (e) { var b = e.target.closest("button[data-v]"); if (!b) return; [].forEach.call(g.querySelectorAll("button"), function (x) { x.setAttribute("aria-pressed", x === b); }); if (k === "pos") $("zUzor").setAttribute("aria-pressed", "false"); set(k, b.getAttribute("data-v")); }; }
    seg("zChto", "chto"); seg("zPos", "pos"); seg("zCv", "cvet");
    $("zUzor").onclick = function () { [].forEach.call($("zPos").querySelectorAll("button"), function (x) { x.setAttribute("aria-pressed", "false"); }); this.setAttribute("aria-pressed", "true"); set("pos", "uzor"); };
    $("zTekst").oninput = function () { S.znak.tekst = this.value; save(); redraw(); };
    $("zR").oninput = function () { $("zRo").textContent = this.value + "%"; set("razmer", +this.value); };
    $("zP").oninput = function () { $("zPo").textContent = this.value + "%"; set("prozr", +this.value); };
    redraw();
  }
  function rewm() {
    var L = []; S.novye.concat(S.k).forEach(function (w) { (w.media || []).forEach(function (m) { if (m.st === "ok" && m.tip === "foto" && m.znak !== sig()) L.push(m); }); });
    var i = 0; $("busy").hidden = false; $("busyT").textContent = "Новый знак на фото"; $("busyX").hidden = true;
    (function next() {
      if (i >= L.length) { $("busy").hidden = true; $("busyX").hidden = false; save(); toast("Готово"); vZnak(); return; }
      var m = L[i++]; $("busyP").style.width = (i / L.length * 100) + "%"; $("busyS").textContent = i + " из " + L.length;
      get("o:" + m.id).then(function (o) { if (!o) return; return renderPhoto(o).then(function (r) { return put("m:" + m.id, r.blob).then(function () { m.znak = sig(); if (URLS["m:" + m.id]) { URL.revokeObjectURL(URLS["m:" + m.id]); delete URLS["m:" + m.id]; } }); }); })
        .catch(function () {}).then(next);
    })();
  }

  // ---------- голос и вставка у полей ----------
  // "Надиктовать" - распознавание речи браузера (Chrome, Edge, Safari; в Firefox нет - кнопки не будет).
  // Распознаём по фразе (continuous=false) и сами перезапускаем, пока не нажали "Стоп": на Android
  // непрерывный режим повторяет одни и те же слова. Слова "точка", "запятая", "новая строка" превращаются в знаки.
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, DICT = null;
  var IC_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
  var IC_PASTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="6" y="4" width="12" height="17" rx="1.5"/><path d="M9 4V3h6v1M9.5 10h5M9.5 13.5h5M9.5 17h3"/></svg>';
  function voiceUp(root) {
    [].forEach.call(root.querySelectorAll("textarea, input[data-voice]"), function (f) {
      var n = f.nextElementSibling; if (n && n.classList.contains("vt")) return;
      var d = document.createElement("div"); d.className = "vt";
      d.innerHTML = (SR ? '<button type="button" data-mic>' + IC_MIC + "<span>Надиктовать</span></button>" : "") +
        '<button type="button" data-paste>' + IC_PASTE + '<span>Вставить</span></button><div class="live" aria-live="polite"></div>';
      f.insertAdjacentElement("afterend", d);
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".vt button"); if (!b) return;
    var f = b.parentNode.previousElementSibling; if (!f) return;
    if (b.hasAttribute("data-mic")) dictate(f, b); else paste(f);
  });
  function tidy(t, one) {
    t = " " + String(t || "").replace(/\s+/g, " ").trim() + " ";
    [[/ (запятая) /gi, ", "], [/ (точка) /gi, ". "], [/ (вопросительный знак) /gi, "? "], [/ (восклицательный знак) /gi, "! "],
     [/ (двоеточие) /gi, ": "], [/ (тире) /gi, " - "], [/ (новая строка|с новой строки|новый абзац|абзац) /gi, one ? " " : "\n"]].forEach(function (r) { t = t.replace(r[0], r[1]).replace(r[0], r[1]); });
    t = t.replace(/[ \t]+/g, " ").replace(/ ([,.!?:])/g, "$1").replace(/ *\n */g, "\n").trim();
    return t.replace(/([.!?]\s+|\n)([а-яёa-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
  }
  function addText(f, t) {
    if (!t) return;
    var v = f.value, one = f.tagName !== "TEXTAREA";
    if (!v.trim() || /[.!?]\s*$|\n$/.test(v)) t = t.charAt(0).toUpperCase() + t.slice(1);
    f.value = v + (!v || /\s$/.test(v) || /^[,.!?:]/.test(t) ? "" : " ") + (one ? t.replace(/\n+/g, " ") : t);
    f.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function dictate(f, b) {
    if (DICT) { var same = DICT.b === b; DICT.stop(); if (same) return; }
    var live = b.parentNode.querySelector(".live"), lab = b.querySelector("span"), quiet = 0;
    var st = { b: b, on: true, stop: function () { st.on = false; try { st.r.abort(); } catch (e) {} done(); } };
    function done() { b.classList.remove("on"); lab.textContent = "Надиктовать"; live.textContent = ""; if (DICT === st) DICT = null; }
    function run() {
      var r = new SR(); st.r = r; r.lang = "ru-RU"; r.continuous = false; r.interimResults = true; r.maxAlternatives = 1;
      r.onresult = function (e) {
        var mid = ""; quiet = 0;
        for (var i = e.resultIndex; i < e.results.length; i++) { var x = e.results[i]; if (x.isFinal) addText(f, tidy(x[0].transcript, f.tagName !== "TEXTAREA")); else mid += x[0].transcript; }
        live.textContent = mid ? "… " + mid : "Слушаю…";
      };
      r.onerror = function (e) {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") { st.on = false; toast("Нет доступа к микрофону - разрешите его для этого сайта в настройках браузера", 5000); }
        else if (e.error === "no-speech") { if (++quiet >= 2) { st.on = false; toast("Не слышно речи - нажмите «Надиктовать» ещё раз"); } }
        else if (e.error === "network") { st.on = false; toast("Распознаванию нужен интернет - проверьте связь"); }
        else if (e.error !== "aborted") { st.on = false; toast("Голос не сработал (" + e.error + ")"); }
      };
      r.onend = function () { if (st.on && DICT === st) { try { run(); } catch (e) { done(); } } else done(); };
      r.start();
    }
    DICT = st; b.classList.add("on"); lab.textContent = "Стоп"; live.textContent = "Слушаю… говорите, потом нажмите «Стоп»";
    try { run(); } catch (e) { st.on = false; done(); toast("Не удалось включить микрофон"); }
  }
  function paste(f) {
    function manual() { f.focus(); toast("Нажмите в поле и удерживайте палец (или правый клик) - выберите «Вставить»", 5000); }
    if (!navigator.clipboard || !navigator.clipboard.readText) return manual();
    navigator.clipboard.readText().then(function (t) {
      t = String(t || "").trim();
      if (!t) { toast("В буфере нет текста - сначала скопируйте его"); return; }
      var had = !!f.value.trim();
      if (had) f.value = f.value.replace(/\s+$/, "") + (f.tagName === "TEXTAREA" ? "\n" : " ");
      f.value += f.tagName === "TEXTAREA" ? t : t.replace(/\s*\n\s*/g, " ");
      f.dispatchEvent(new Event("input", { bubbles: true }));
      toast(had ? "Текст добавлен в конец поля" : "Текст вставлен");
    }, manual);
  }

  // ---------- Опубликовать ----------
  function changes() {
    var nm = 0, nv = 0;
    S.novye.concat(S.k).forEach(function (w) { (w.media || []).forEach(function (m) { if (m.st !== "ok") return; if (m.tip === "video") nv++; else nm++; }); });
    return { m: Object.keys(S.master).length, k: Object.keys(S.kontakty).length, logo: !!S.logo, foto: nm, video: nv,
      raboty: S.novye.filter(function (w) { return (w.media || []).some(function (m) { return m.st === "ok"; }) || w.nazvanie || w.rasskaz || wfHas(w); }).length,
      pravka: S.k.filter(function (w) { return w.nazvanie != null || w.rasskaz != null || WF.some(function (f) { return w[f[0]] != null; }); }).length,
      skryt: S.k.filter(function (w) { return w.skryt; }).length, vernut: (S.vernut || []).length };
  }
  function changeLines(c) {
    var L = [];
    if (c.m) L.push("Данные мастера: " + c.m + " " + plural(c.m, ["поле", "поля", "полей"]));
    if (c.k) L.push("Контакты: " + c.k + " " + plural(c.k, ["поле", "поля", "полей"]));
    if (c.logo) L.push("Новый знак");
    if (c.raboty) L.push("Новые работы: " + c.raboty);
    if (c.pravka) L.push("Правка готовых работ: " + c.pravka);
    if (c.foto) L.push("Фото со знаком: " + c.foto);
    if (c.video) L.push("Видео со знаком: " + c.video);
    if (c.skryt) L.push("Скрыть с витрины: " + c.skryt);
    if (c.vernut) L.push("Вернуть на витрину: " + c.vernut);
    return L;
  }
  var PJ, PB = null; // PJ - настройка публикации с сайта (enc/p.json, зашифрована), PB - она же расшифрованная (код введён)
  function pubState(force) {
    if (PJ !== undefined && !force) return Promise.resolve();
    return KrPub.cfg().then(function (pj) { PJ = pj; return pj ? KrPub.saved(pj) : null; }).then(function (b) { PB = b; });
  }
  function vPaket() {
    // без промежуточного экрана "Проверяю": он и давал мигание. Состояние публикации грузится при старте.
    if (PJ !== undefined) return drawPaket();
    $("main").innerHTML = "";
    pubState().then(function () { drawPaket(); }, function () { drawPaket(); });
  }
  // настройку публикации видит только Александр: браузер с отметкой "свой" (заходил на главную сайта) или ссылка #nastrojka
  function owner() { try { if (localStorage.getItem("mebel-site-staff")) return true; } catch (e) {} return location.hash === "#nastrojka" || /[?&]vladelec\b/.test(location.search); }
  function drawPaket(done, still) {
    if (TAB !== "paket") return;
    var c = changes(), L = changeLines(c), any = L.length > 0, share = !!(navigator.canShare && navigator.share), on = !!(PJ && PB);
    var list = any ? '<div class="list">' + L.map(function (t) { return '<div class="row"><span class="sp">' + esc(t) + "</span></div>"; }).join("") + "</div>" :
      '<p style="margin:0;color:var(--muted)">Пока нечего публиковать: вы ничего не меняли.</p>';
    var wait = KrPub.zhdat(PB);
    var h = '<section role="tabpanel"' + (still ? ' class="still"' : "") + "><h1>Опубликовать</h1>";
    if (done) h += '<div class="card pub-ok"><h2>Опубликовано</h2><p>Правки ушли на сайт. Клиенты увидят их через ' + esc(wait) + ' - столько сайт обновляется. Если откроете витрину раньше и не увидите правок - просто обновите страницу чуть позже.</p><div class="btns"><a class="btn" href="../klient/">Открыть витрину</a></div></div>';
    if (on) {
      h += '<p class="lead">Всё, что вы поменяли в Мастерской, уходит на витрину одной кнопкой.</p><div class="card"><div class="eyebrow" style="margin-top:0">Что изменится</div>' + list +
        '<div class="btns"><button type="button" class="btn" id="pGo"' + (any ? "" : " disabled") + ">Опубликовать на сайт</button></div></div>";
    } else if (PJ) {
      h += '<p class="lead">Один раз на этом телефоне введите код мастера - 12 цифр, его дал Александр. Потом публикация - одной кнопкой.</p>' +
        '<div class="card"><div class="f"><label for="pCode">Код мастера</label><input id="pCode" inputmode="numeric" enterkeyhint="go" autocomplete="off" placeholder="0000-0000-0000" maxlength="20"></div>' +
        '<label class="chk"><input type="checkbox" id="pRem" checked> Запомнить на этом устройстве (на чужом телефоне снимите галочку)</label>' +
        '<div class="btns"><button type="button" class="btn" id="pUn">Включить публикацию</button></div><p class="save" id="pMsg" role="status"></p></div>' +
        '<div class="card"><div class="eyebrow" style="margin-top:0">Что изменится</div>' + list + "</div>";
    } else {
      h += '<p class="lead">Публикация прямо на сайт пока не включена - её включает Александр. А пока правки можно отправить ему файлом: «Дополнительно» внизу.</p><div class="card"><div class="eyebrow" style="margin-top:0">Что изменится</div>' + list + "</div>";
    }
    h += '<div class="eyebrow">Как это работает</div><ol class="how">' +
      (PJ && !PB ? "<li>Введите код мастера выше. Это нужно один раз на этом телефоне.</li>" : "") +
      "<li>Поменяйте, что нужно, во вкладках «О мастере», «Работы» и «Знак». Всё сохраняется само, даже если закрыть страницу.</li>" +
      "<li>Вернитесь сюда и нажмите «Опубликовать на сайт». Дождитесь надписи «Опубликовано».</li>" +
      "<li>Через " + esc(wait) + " откройте витрину и проверьте. Не видно правок - обновите страницу.</li></ol>";
    h += '<details class="more"' + (!PJ ? " open" : "") + "><summary>Дополнительно</summary>" +
      '<div class="mi"><b>Отправить правки файлом</b><p>Если публикация не работает: файл с правками, фото и видео уже со знаком. Отправьте его Александру в WhatsApp или Telegram.</p>' +
      '<div class="btns"><button type="button" class="btn l sm" id="pDl"' + (any ? "" : " disabled") + ">Скачать файл</button>" + (share ? '<button type="button" class="btn l sm" id="pSh"' + (any ? "" : " disabled") + ">Отправить файлом</button>" : "") + "</div></div>" +
      '<div class="mi"><b>Очистить черновик</b><p>Стереть всё, что вы поменяли, но ещё не опубликовали. Опубликованное на сайте останется.</p><div class="btns"><button type="button" class="btn l sm" id="pClr">Очистить черновик</button></div></div>' +
      (PB ? '<div class="mi"><b>Чужой телефон?</b><p>Забыть код мастера на этом устройстве.</p><div class="btns"><button type="button" class="btn l sm" id="pOff">Отключить публикацию здесь</button></div></div>' : "") +
      (owner() ? '<div class="mi"><b>Для Александра</b><p>Ключ GitHub, репозиторий и код мастера.</p><div class="btns"><button type="button" class="btn l sm" id="pSet">Настройка публикации</button></div></div>' : "") +
      "</details></section>";
    $("main").innerHTML = h;
    if ($("pGo")) $("pGo").onclick = function () { publish().then(function () { drawPaket(true, true); scrollTo(0, 0); }, err); };
    if ($("pUn")) {
      var inp = $("pCode");
      inp.oninput = function () { var d = KrPub.digits(inp.value).slice(0, 12); var f = KrPub.fmtCode(d); if (f !== inp.value) inp.value = f; };
      $("pUn").onclick = function () {
        var code = KrPub.digits(inp.value);
        if (code.length !== 12) { $("pMsg").textContent = "В коде 12 цифр"; return; }
        $("pUn").disabled = true; $("pMsg").textContent = "Проверяю код…";
        KrPub.unlock(code, PJ, $("pRem").checked).then(function (b) { PB = b; toast("Публикация включена"); drawPaket(false, true); },
          function (e) { $("pUn").disabled = false; $("pMsg").textContent = e.message || String(e); });
      };
      inp.onkeydown = function (e) { if (e.key === "Enter") $("pUn").click(); };
    }
    $("pDl").onclick = function () { pack().then(function (r) { var a = document.createElement("a"); a.href = URL.createObjectURL(r.blob); a.download = r.name; document.body.appendChild(a); a.click(); a.remove(); toast("Файл скачан: " + r.name); }).catch(err); };
    if ($("pSh")) $("pSh").onclick = function () {
      pack().then(function (r) {
        var f = new File([r.blob], r.name, { type: "application/zip" });
        if (!navigator.canShare({ files: [f] })) { toast("Этот телефон не умеет отправлять файл - нажмите «Скачать файл»"); return; }
        return navigator.share({ files: [f], title: "Правки витрины", text: "Правки витрины из Мастерской" }).catch(function (e) { if (e && e.name !== "AbortError") throw e; });
      }).catch(err);
    };
    $("pClr").onclick = function () {
      if (!confirm("Стереть все неопубликованные правки и файлы из этого браузера?")) return;
      clearDraft(); toast("Черновик очищен"); go("paket");
    };
    if ($("pOff")) $("pOff").onclick = function () { KrPub.forget().then(function () { PB = null; toast("На этом устройстве публикация отключена"); drawPaket(false, true); }); };
    if ($("pSet")) $("pSet").onclick = vSetup;
  }
  function clearDraft() {
    S.novye.concat(S.k).forEach(function (w) { (w.media || []).forEach(function (m) { del("m:" + m.id); del("o:" + m.id); del("k:" + m.id); }); });
    if (S.logo) del("logo");
    S = { master: {}, kontakty: {}, znak: S.znak, novye: [], k: [], logoV: S.logoV || 0 };
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
    LOGO_RASTER = null; counts();
  }
  function err(e) { $("busy").hidden = true; $("busyX").hidden = false; toast("Не получилось: " + (e && e.message || e), 6000); }
  function busy(t, sub, p) { $("busy").hidden = false; $("busyX").hidden = true; $("busyT").textContent = t; $("busyS").textContent = sub || ""; $("busyP").style.width = ((p || 0) * 100).toFixed(1) + "%"; }
  function wTitle(id) { var w = workById(id); return w ? w.nazvanie : ""; }

  // Публикация: свежие правки с GitHub + черновик -> новые зашифрованные файлы и m.bin одним коммитом.
  function publish() {
    var B = PB, key, L, files = [], c = changes(), nF = c.foto + c.video * 2 + (c.logo ? 1 : 0), iF = 0;
    var MAX = 95 * 1048576; // GitHub не принимает файлы больше 100 МБ
    busy("Публикую", "Проверяю доступ", .02);
    function enc(id) {
      return get(id).then(function (b) {
        if (!b) throw new Error("Файл пропал из черновика - добавьте его заново");
        if (!b.size) return "";
        if (b.size > MAX) throw new Error("Видео " + Math.round(b.size / 1048576) + " МБ - слишком большое для сайта (до 95 МБ). Обрежьте ролик");
        iF++; busy("Публикую", "Шифрую файлы: " + iF + " из " + nF, .05 + .25 * iF / Math.max(1, nF));
        return b.arrayBuffer();
      }).then(function (ab) {
        if (!ab) return "";
        return KrPub.seal(key, ab).then(function (u) { var n = KrPub.rnd(12); files.push({ name: n + ".bin", data: u }); return "@" + n; });
      });
    }
    function media(list) {
      var out = { foto: [], video: [] };
      return list.filter(function (m) { return m.st === "ok"; }).reduce(function (p, m) {
        return p.then(function () {
          if (m.tip === "video") return enc("m:" + m.id).then(function (f) { return enc("k:" + m.id).then(function (k) { out.video.push({ fajl: f, oblozhka: k, w: m.w, h: m.h, sek: m.dur }); }); });
          return enc("m:" + m.id).then(function (f) { out.foto.push({ src: f, znak: true }); });
        });
      }, Promise.resolve()).then(function () { return out; });
    }
    return KrPub.siteKey(B.pin).then(function (k) {
      key = k; busy("Публикую", "Беру с сайта то, что уже опубликовано", .04);
      return KrPub.readSloj(B, k);
    }).then(function (cur) {
      L = cur || {};
      L.v = 1; L.master = L.master || {}; L.kontakty = L.kontakty || {}; L.novye_raboty = L.novye_raboty || []; L.k_rabotam = L.k_rabotam || []; L.skryt = L.skryt || []; L.imena = L.imena || {};
      Object.keys(S.master).forEach(function (k) { L.master[k] = String(S.master[k]).trim(); });
      Object.keys(S.kontakty).forEach(function (k) { L.kontakty[k] = String(S.kontakty[k]).trim(); });
      L.znak = S.znak;
      var chain = S.logo ? enc("logo").then(function (r) { if (r) L.logo = r; }) : Promise.resolve(), neu = [];
      S.novye.forEach(function (w) {
        chain = chain.then(function () { return media(w.media || []); }).then(function (md) {
          if (!md.foto.length && !md.video.length && !w.nazvanie && !w.rasskaz && !wfHas(w)) return;
          var nw = { id: w.id, nazvanie: w.nazvanie || "Новая работа", komnata: w.komnata, rasskaz: w.rasskaz || "", foto: md.foto, video: md.video };
          WF.forEach(function (f) { if (w[f[0]] && String(w[f[0]]).trim()) nw[f[0]] = String(w[f[0]]).trim(); });
          neu.push(nw);
        });
      });
      chain = chain.then(function () { L.novye_raboty = neu.concat(L.novye_raboty); });
      S.k.forEach(function (w) {
        chain = chain.then(function () { return media(w.media || []); }).then(function (md) {
          var txt = (w.nazvanie != null && w.nazvanie.trim()) || (w.rasskaz != null && w.rasskaz.trim()) || WF.some(function (f) { return w[f[0]] != null; });
          if (txt || md.foto.length || md.video.length) {
            // своя опубликованная работа - правим её запись, чужая (из исходных данных) - запись в k_rabotam
            var t = L.novye_raboty.filter(function (x) { return x.id === w.rabota; })[0] || L.k_rabotam.filter(function (x) { return x.rabota === w.rabota; })[0];
            if (!t) { t = { rabota: w.rabota, foto: [], video: [] }; L.k_rabotam.push(t); }
            if (w.nazvanie != null && w.nazvanie.trim()) t.nazvanie = w.nazvanie.trim();
            if (w.rasskaz != null && w.rasskaz.trim()) t.rasskaz = w.rasskaz.trim();
            WF.forEach(function (f) { if (w[f[0]] != null) t[f[0]] = String(w[f[0]]).trim(); }); // пустое значение - стереть поле
            t.foto = (t.foto || []).concat(md.foto); t.video = (t.video || []).concat(md.video);
          }
          if (w.skryt && L.skryt.indexOf(w.rabota) < 0) { L.skryt.push(w.rabota); L.imena[w.rabota] = (w.nazvanie && w.nazvanie.trim()) || wTitle(w.rabota) || "Работа"; }
        });
      });
      return chain;
    }).then(function () {
      (S.vernut || []).forEach(function (id) { L.skryt = L.skryt.filter(function (x) { return x !== id; }); delete L.imena[id]; });
      L.sobrano = new Date().toISOString();
      return KrPub.seal(key, new TextEncoder().encode(JSON.stringify(L)));
    }).then(function (m) {
      files.push({ name: "m.bin", data: m });
      var msg = "Мастерская: " + changeLines(c).join(", ").toLowerCase();
      return KrPub.commit(B, files, msg, function (t, p) { busy("Публикую", t, .3 + .68 * p); });
    }).then(function () {
      try { localStorage.setItem("kr-ms-pub", JSON.stringify({ at: Date.now(), sobrano: L.sobrano })); } catch (e) {}
      afterPublish(L);
      $("busy").hidden = true; $("busyX").hidden = false;
    });
  }
  // сайт обновится не сразу (1-2 или 10-20 минут, см. KrPub.zhdat), а Мастерская должна сразу показывать опубликованное как "было"
  function afterPublish(L) {
    Object.keys(S.master).forEach(function (k) { if (S.master[k].trim()) M0[k] = S.master[k].trim(); });
    Object.keys(S.kontakty).forEach(function (k) { if (S.kontakty[k].trim()) K0[k] = S.kontakty[k].trim(); });
    D.raboty = D.raboty || [];
    S.novye.forEach(function (w) { if (w.nazvanie || w.rasskaz || wfHas(w) || (w.media || []).length) { var x = { id: w.id, komnata: w.komnata, nazvanie: w.nazvanie || "Новая работа", rasskaz: w.rasskaz || "", foto: [] }; WF.forEach(function (f) { if (w[f[0]]) x[f[0]] = String(w[f[0]]).trim(); }); D.raboty.unshift(x); } });
    S.k.forEach(function (w) { var x = workById(w.rabota); if (!x) return; if (w.nazvanie && w.nazvanie.trim()) x.nazvanie = w.nazvanie.trim(); if (w.rasskaz && w.rasskaz.trim()) x.rasskaz = w.rasskaz.trim(); WF.forEach(function (f) { if (w[f[0]] != null) x[f[0]] = String(w[f[0]]).trim(); }); });
    D.raboty = D.raboty.filter(function (x) { return L.skryt.indexOf(x.id) < 0; });
    window.KR_SLOJ = L;
    clearDraft(); banner();
  }
  function banner() {
    var b = $("banner"), P = null;
    try { P = JSON.parse(localStorage.getItem("kr-ms-pub") || "null"); } catch (e) {}
    var SL = window.KR_SLOJ || {};
    var wait = P && Date.now() - P.at < 40 * 60000 && String(SL.sobrano || "") < String(P.sobrano || "");
    b.hidden = !wait;
    if (wait) b.textContent = "Последняя публикация ещё появляется на витрине - обычно это " + KrPub.zhdat(PB) + ". Если здесь не видно новых правок, обновите страницу чуть позже.";
  }

  // ---------- Настройка публикации (Александр) ----------
  function vSetup() {
    TAB = "setup";
    [].forEach.call(document.querySelectorAll(".tabs button"), function (b) { b.setAttribute("aria-selected", "false"); });
    var g = KrPub.guess();
    $("main").innerHTML = '<section role="tabpanel"><h1>Настройка публикации</h1><p class="lead">Один раз, делает Александр. После неё мастер публикует правки сам: вводит код мастера и нажимает «Опубликовать».</p>' +
      (PJ ? '<p class="note"><b>Публикация уже настроена.</b> Новая настройка выдаст новый код мастера - старый перестанет работать.</p>' : "") +
      '<div class="card"><p style="margin-bottom:8px"><b style="font-weight:500">1. Токен GitHub.</b> Откройте <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com → Fine-grained token</a>:</p>' +
      '<ul style="margin:0 0 6px 20px;color:var(--muted);font-size:14.5px"><li>Token name - «Мастерская», Expiration - на год;</li><li>Repository access - <b>Only select repositories</b>, выбрать только репозиторий сайта;</li><li>Permissions → Repository → <b>Contents: Read and write</b> (остальное не трогать);</li><li>Generate token, скопировать и вставить ниже.</li></ul></div>' +
      '<div class="card g2"><div class="f w"><label for="sTok">Токен GitHub</label><input id="sTok" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></div>' +
      '<div class="f"><label for="sRepo">Репозиторий сайта</label><input id="sRepo" spellcheck="false" value="' + esc(g.repo) + '" placeholder="владелец/название"></div>' +
      '<div class="f"><label for="sBr">Ветка</label><input id="sBr" spellcheck="false" value="' + esc(g.branch) + '"></div>' +
      '<div class="f w"><label for="sPath">Папки для файлов</label><textarea id="sPath" rows="2" spellcheck="false">' + esc(g.paths) + "</textarea><small>Первая - та, что видит сайт; вторая - копия в исходниках, чтобы наша следующая сборка не потеряла правки. Менять только при переезде сайта.</small></div>" +
      '<div class="f"><label for="sPin">Пин-код витрины</label><input id="sPin" type="password" inputmode="numeric" autocomplete="off"><small>Тот же, что на входе. Нужен, чтобы новые фото шифровались так же.</small></div>' +
      '<div class="f"><label>&nbsp;</label><label class="chk" style="margin-top:0"><input type="checkbox" id="sRem"> Сразу включить публикацию на этом устройстве</label></div></div>' +
      '<div class="btns"><button type="button" class="btn" id="sGo">Проверить и включить</button><button type="button" class="btn l" id="sBack">Назад</button></div><p class="save" id="sMsg" role="status" style="margin-top:10px"></p><div id="sOut"></div></section>';
    $("sBack").onclick = function () { go("paket"); };
    $("sGo").onclick = function () {
      $("sGo").disabled = true;
      KrPub.setup({ token: $("sTok").value, repo: $("sRepo").value, branch: $("sBr").value, paths: $("sPath").value, pin: $("sPin").value, remember: $("sRem").checked },
        function (t) { $("sMsg").textContent = t + "…"; }).then(function (r) {
        $("sTok").value = ""; $("sPin").value = ""; $("sMsg").textContent = "";
        PJ = r.pj; PB = $("sRem").checked ? r.B : null;
        $("sOut").innerHTML = '<div class="card pub-ok"><h2>Готово</h2><p>Код мастера:</p><div class="code" id="sCode">' + esc(r.code) + "</div>" +
          '<div class="btns"><button type="button" class="btn l sm" id="sCopy">Скопировать код</button></div>' +
          '<p class="note">Передайте код мастеру лично или в личном сообщении. Он вводит его в Мастерской во вкладке «Опубликовать» один раз на своём телефоне. Код больше нигде не показывается - сохраните его. Потеряли - пройдите настройку заново. Сайт подхватит настройку через ' + esc(KrPub.zhdat(r.B)) + '.</p></div>';
        $("sCopy").onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(r.code) : Promise.reject()).then(function () { toast("Код скопирован"); }, function () { toast("Выделите код и скопируйте вручную"); }); };
        $("sGo").disabled = false;
      }, function (e) { $("sGo").disabled = false; $("sMsg").textContent = e.message || String(e); });
    };
    scrollTo(0, 0);
  }

  function pack() {
    $("busy").hidden = false; $("busyT").textContent = "Собираю файл"; $("busyX").hidden = true; $("busyS").textContent = ""; $("busyP").style.width = "10%";
    var files = [], P = { v: 1, sobrano: new Date().toISOString(), master: S.master, kontakty: S.kontakty, znak: S.znak, novye_raboty: [], k_rabotam: [], skryt: [] };
    function media(list) {
      var out = { foto: [], video: [] };
      list.forEach(function (m) {
        if (m.st !== "ok") return;
        if (m.tip === "video") { var n = "foto/ms-" + m.id + "." + m.ext, k = "foto/ms-" + m.id + "-kadr.jpg"; files.push([n, "m:" + m.id], [k, "k:" + m.id]); out.video.push({ fajl: n, oblozhka: k, w: m.w, h: m.h, sek: m.dur }); }
        else { var f = "foto/ms-" + m.id + ".jpg"; files.push([f, "m:" + m.id]); out.foto.push({ src: f, znak: true }); }
      });
      return out;
    }
    S.novye.forEach(function (w) { var md = media(w.media || []); if (!md.foto.length && !md.video.length && !w.nazvanie && !w.rasskaz && !wfHas(w)) return; var nw = { id: w.id, nazvanie: w.nazvanie || "Новая работа", komnata: w.komnata, rasskaz: w.rasskaz || "", foto: md.foto, video: md.video }; WF.forEach(function (f) { if (w[f[0]] && String(w[f[0]]).trim()) nw[f[0]] = String(w[f[0]]).trim(); }); P.novye_raboty.push(nw); });
    S.k.forEach(function (w) {
      var md = media(w.media || []), e = { rabota: w.rabota, foto: md.foto, video: md.video };
      if (w.nazvanie != null) e.nazvanie = w.nazvanie; if (w.rasskaz != null) e.rasskaz = w.rasskaz;
      var wf = false; WF.forEach(function (f) { if (w[f[0]] != null) { e[f[0]] = String(w[f[0]]).trim(); wf = true; } });
      if (md.foto.length || md.video.length || e.nazvanie != null || e.rasskaz != null || wf) P.k_rabotam.push(e);
      if (w.skryt) P.skryt.push(w.rabota);
    });
    var lg = S.logo ? get("logo").then(function (b) { if (b) { var n = "foto/logo-" + (S.logoV || 1) + (/svg/.test(S.logo.type) ? ".svg" : ".png"); P.logo = n; files.push([n, "logo"]); } }) : Promise.resolve();
    return lg.then(function () {
      return Promise.all(files.map(function (f) { return get(f[1]).then(function (b) { return b ? b.arrayBuffer() : new ArrayBuffer(0); }).then(function (ab) { return [f[0], new Uint8Array(ab)]; }); }));
    }).then(function (arr) {
      $("busyP").style.width = "70%";
      arr.unshift(["pravki.json", new TextEncoder().encode(JSON.stringify(P, null, 2))]);
      var d = new Date(), name = "pravki-" + d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) + "-" + ("0" + d.getHours()).slice(-2) + ("0" + d.getMinutes()).slice(-2) + ".zip";
      var blob = zip(arr); $("busy").hidden = true; $("busyX").hidden = false;
      return { blob: blob, name: name };
    });
  }
  // ZIP без сжатия (фото и видео уже сжаты): локальные заголовки + центральный каталог
  var CRC = (function () { var t = [], c; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u) { var c = -1; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
  function zip(files) {
    var parts = [], cd = [], off = 0, enc = new TextEncoder();
    function u16(v) { return [v & 255, (v >>> 8) & 255]; } function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var nm = enc.encode(f[0]), data = f[1], crc = crc32(data);
      var h = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nm.length), u16(0));
      parts.push(new Uint8Array(h), nm, data);
      cd.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), nm);
      off += h.length + nm.length + data.length;
    });
    var cdl = cd.reduce(function (s, p) { return s + p.length; }, 0);
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdl), u32(off), u16(0)));
    return new Blob(parts.concat(cd, [end]), { type: "application/zip" });
  }

  // ---------- старт ----------
  // незаконченные записи (закрыли страницу посреди обработки) - помечаем ошибкой
  S.novye.concat(S.k).forEach(function (w) { (w.media || []).forEach(function (m) { if (m.st === "work") { m.st = "err"; m.err = "Обработка прервалась - добавьте файл ещё раз"; } }); });
  // мастер пришёл из клиентской версии (вход удержанием знака) - "назад" ведёт туда, а не на черновик
  try { if (sessionStorage.getItem("kr-iz-klienta")) setTimeout(function () { [].forEach.call(document.querySelectorAll("nav.kn a"), function (a) { if (/krasnodar\/?$/.test(a.pathname)) a.href = "../klient/"; }); }, 0); } catch (e) {}
  function hh() { var t = document.querySelector(".top"); if (t) document.documentElement.style.setProperty("--hh", t.offsetHeight + "px"); }
  hh(); addEventListener("resize", hh);
  pubState().catch(function () {}); // заранее: вкладка "Опубликовать" откроется сразу, без мигания
  loadLogo().then(function () { counts(); banner(); go(/^#(opublikovat|paket)$/.test(location.hash) ? "paket" : /^#nastrojka$/.test(location.hash) ? "paket" : "master"); if (location.hash === "#nastrojka") pubState().then(vSetup, vSetup); });
  addEventListener("beforeunload", function (e) { if (REC) { e.preventDefault(); e.returnValue = ""; } });
})();
