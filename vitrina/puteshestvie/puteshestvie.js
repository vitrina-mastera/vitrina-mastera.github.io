/* Витрина мастера, вариант 4 - "Путешествие по дому".
   Экраны: двери (первый заход) -> дом в разрезе -> комната (3D-лента работ) -> работа на весь экран.
   Данные - ../dannye.js (window.VITRINA), те же, что у варианта 3. Новые поля необязательные:
     komnaty[] {id, nazvanie, hint, col, span, row} - комнаты дома; если нет - строятся из vid работ;
     raboty[].komnata - id комнаты (если нет - по vid), raboty[].tochki[] {x, y, nazvanie, tekst} - точки на 1-м фото в %;
     raboty[].panorama - на будущее (обзор 360), сейчас только метка "обзор" на комнате.
   Ссылки: #komnata=<id>, #rabota=<id>. История браузера повторяет путь по дому: дом -> комната -> работа,
   поэтому "назад" и Esc всегда возвращают на шаг вверх.
   Черновик из Мастерской: ?chernovik=1 (данные и фото из памяти этого браузера), полоска мастера: ?master. */
(function () {
  "use strict";
  var D = window.VITRINA || {};
  var $ = function (id) { return document.getElementById(id); };
  var Q = new URLSearchParams(location.search);
  var DRAFT = Q.get("chernovik") === "1";
  var STAFF = Q.has("master") || DRAFT || (window.MebelSite && MebelSite.isStaff && MebelSite.isStaff());
  var PH = {}; // фото черновика: id -> адрес
  var mq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  var reduce = !!(mq && mq.matches);
  if (mq && mq.addEventListener) mq.addEventListener("change", function () { reduce = mq.matches; });
  function T(ms) { return reduce ? 0 : ms; }

  // ---------- качество под устройство ----------
  // "max" - всё: размытие под панелями, тени, тени на сгибе листа, лист приподнимается.
  // "lite" - для слабых телефонов: без размытия под панелями, лёгкие тени, лист проще; анимации те же, но дешевле.
  // Сначала угадываем по железу (память, ядра, экономия трафика), потом смотрим на живую плавность:
  // если во время листания кадры заметно запаздывают - переходим на "lite" и запоминаем на неделю.
  // Для проверки: ?kach=lite или ?kach=max.
  var QKEY = "vp-kach", LITE = false;
  (function () {
    var f = Q.get("kach"), nav_ = navigator, mem = nav_.deviceMemory || 0, cores = nav_.hardwareConcurrency || 0;
    var save = !!(nav_.connection && nav_.connection.saveData);
    if (f === "lite" || f === "max") { LITE = f === "lite"; return; }
    LITE = save || (mem && mem <= 2) || (mem && mem <= 4 && cores && cores <= 4);
    try { var s = JSON.parse(localStorage.getItem(QKEY) || "null"); if (s && s.lite && Date.now() - s.at < 7 * 864e5) LITE = true; } catch (e) {}
  })();
  document.documentElement.classList.toggle("vp-lite", LITE);
  // замер плавности: rAF во время анимации; медленные кадры (> 28 мс) больше трети - устройство не тянет
  var pwBad = 0;
  function perfWatch(ms) {
    if (LITE || reduce || Q.get("kach")) return;
    var t0 = performance.now(), last = t0, n = 0, slow = 0;
    requestAnimationFrame(function fr(now) {
      var d = now - last; last = now;
      if (d > 0 && document.visibilityState === "visible") { n++; if (d > 28) slow++; }
      if (now - t0 < ms) { requestAnimationFrame(fr); return; }
      if (n >= 8 && slow / n > .34) {
        if (++pwBad >= 2) {
          LITE = true; document.documentElement.classList.add("vp-lite");
          try { localStorage.setItem(QKEY, JSON.stringify({ lite: true, at: Date.now() })); } catch (e) {}
        }
      } else if (n >= 8) pwBad = Math.max(0, pwBad - 1);
    });
  }
  var SWIFT = "cubic-bezier(.7,0,.2,1)", EASE = "cubic-bezier(.22,1,.36,1)";
  function eSwift(t) { return bez(.7, 0, .2, 1, t); }
  function eEase(t) { return bez(.22, 1, .36, 1, t); }
  // кубическая Безье для своих анимаций (те же кривые, что в CSS)
  function bez(x1, y1, x2, y2, x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    var t = x;
    for (var i = 0; i < 8; i++) {
      var cx = 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t - x;
      var d = 3 * x1 * (1 - t) * (1 - t) + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
      if (Math.abs(cx) < 1e-5 || !d) break; t -= cx / d; t = Math.max(0, Math.min(1, t));
    }
    return 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t;
  }

  var IC = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    open: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>'
  };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function toast(t) { var e = $("toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove("on"); }, 2200); }
  function plural(n, f) { n = Math.abs(n) % 100; var d = n % 10; return n > 10 && n < 20 ? f[2] : d === 1 ? f[0] : d >= 2 && d <= 4 ? f[1] : f[2]; }
  function initials(n) { var w = String(n || "?").trim().split(/\s+/), l = w.filter(function (x) { return x.length > 1; }); return (l.length ? l : w).slice(0, 2).map(function (x) { return x.charAt(0).toUpperCase(); }).join(""); }
  var MON2 = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  function day(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? +m[3] + " " + MON2[+m[2] - 1] + " " + m[1] : (s || ""); }
  function low(s) { return String(s || "").trim().toLowerCase(); }
  var TR = { "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya" };
  function slug(s) { return low(s).replace(/[а-яё]/g, function (c) { return TR[c]; }).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "komnata"; }

  // ---------- контакты ----------
  var K = {};
  var digits = function (s) { return String(s || "").replace(/\D/g, ""); };
  function waUrl(text) { var n = digits(K.whatsapp); return n ? "https://wa.me/" + n + (text ? "?text=" + encodeURIComponent(text) : "") : ""; }
  // Max (мессенджер): ссылка на профиль или чат, как её даёт приложение (max.ru/...). Номер в ссылку не превращаем.
  function maxUrl() { var u = String(K.max || "").trim(); return !u ? "" : /^https?:\/\//.test(u) ? u : /^(www\.)?max\.ru\//.test(u) ? "https://" + u : ""; }
  function tgUrl() { var u = String(K.telegram || "").replace(/^@|^https?:\/\/t\.me\//, ""); return u ? "https://t.me/" + u : ""; }

  // ---------- фото ----------
  function ris(v) { return window.VitrinaRis ? VitrinaRis(v || "detal") : ""; }
  // адреса фото в dannye.js - от папки vitrina/, а эта страница лежит на уровень глубже
  function srcOf(f) {
    if (!f) return ris("detal");
    var s = f.src;
    if (s && /^idb:/.test(s)) return PH[s.slice(4)] || ris(f.ris);
    if (s) return /^(data:|blob:|https?:|\/)/.test(s) ? s : "../" + s;
    return ris(f.ris);
  }
  function fotos(w) { return (w.foto && w.foto.length) ? w.foto : [null]; }
  function cover(w) { return srcOf(fotos(w)[0]); }
  // титульное фото комнаты: k.titul (мастер выбрал в Мастерской любое фото) или первое фото первой работы
  function roomCover(k) { return k.titul ? srcOf({ src: k.titul }) : k.works.length ? cover(k.works[0]) : ""; }
  var WM = "";
  function makeWM() {
    var t = esc((D.master && D.master.znak) || (D.master && D.master.imya) || "");
    if (!t) return "";
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260"><g transform="rotate(-24 210 130)" font-family="system-ui,sans-serif" font-size="19" font-weight="600" text-anchor="middle">' +
      '<text x="210" y="138" fill="rgba(0,0,0,.18)">' + t + '</text><text x="209" y="137" fill="rgba(255,255,255,.3)">' + t + "</text></g></svg>";
    return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22") + '")';
  }
  function wmHTML(f) { return WM && !(f && f.znak) ? '<i class="wm" style="background-image:' + WM.replace(/"/g, "&quot;") + '"></i>' : ""; }
  // размеры картинки (нужны для "как cover" в анимациях); кэш по адресу
  var SIZE = {};
  function loadImg(src, cb) {
    if (SIZE[src]) return cb(SIZE[src]);
    var im = new Image(); var done = false;
    var fin = function () { if (done) return; done = true; SIZE[src] = { w: im.naturalWidth || 1200, h: im.naturalHeight || 900 }; cb(SIZE[src]); };
    im.onload = fin; im.onerror = fin; im.src = src;
    if (im.complete && im.naturalWidth) fin();
  }
  document.addEventListener("contextmenu", function (e) { if (e.target.closest && e.target.closest(".stage,.wcard,.room,.thumbs")) { e.preventDefault(); toast("Фото защищены - напишите мастеру, если нужно"); } });

  // ---------- комнаты и работы ----------
  var ROOMS = [], WORKS = [], BYID = {}, ROOMBY = {}, ROWS = 3;
  function otzyvy(w) { return (D.otzyvy || []).filter(function (o) { return o && o.rabota === w.id; }); }
  function prep() {
    var R = (D.raboty || []).filter(function (w) { return w && w.id; });
    var src = Array.isArray(D.komnaty) && D.komnaty.length ? D.komnaty : null;
    ROOMS = [];
    if (src) src.forEach(function (k) { if (k && (k.id || k.nazvanie)) ROOMS.push({ id: String(k.id || slug(k.nazvanie)), nazvanie: k.nazvanie || k.id, hint: k.hint || "", col: +k.col || 0, span: +k.span || 1, row: +k.row || 0, titul: typeof k.titul === "string" ? k.titul : "", works: [] }); });
    ROOMBY = {}; ROOMS.forEach(function (k) { ROOMBY[k.id] = k; });
    R.forEach(function (w) {
      var k = (w.komnata && ROOMBY[w.komnata]) || null;
      if (!k && w.vid) for (var i = 0; i < ROOMS.length; i++) if (low(ROOMS[i].nazvanie) === low(w.vid)) { k = ROOMS[i]; break; }
      if (!k) { var id = slug(w.vid || "Работы"); k = ROOMBY[id]; if (!k) { k = { id: id, nazvanie: w.vid || "Работы", hint: "", col: 0, span: 1, row: 0, works: [] }; ROOMS.push(k); ROOMBY[id] = k; } }
      k.works.push(w); w._k = k;
    });
    // порядок комнат: D.poryadok (Мастерская) или порядок по умолчанию страницы (window.VP_PORYADOK) - список id сверху вниз;
    // остальные комнаты - следом, как были. При своём порядке раскладка этажей строится заново (по две на этаж).
    var PO = Array.isArray(D.poryadok) && D.poryadok.length ? D.poryadok : Array.isArray(window.VP_PORYADOK) ? window.VP_PORYADOK : null;
    if (PO) {
      var pos = {}; PO.forEach(function (id, i) { if (pos[id] == null) pos[id] = i; });
      var o0 = ROOMS.slice(), before = ROOMS.map(function (k) { return k.id; }).join();
      ROOMS.sort(function (a, b) { var x = pos[a.id] != null ? pos[a.id] : 1e3 + o0.indexOf(a), y = pos[b.id] != null ? pos[b.id] : 1e3 + o0.indexOf(b); return x - y; });
      if (ROOMS.map(function (k) { return k.id; }).join() !== before) ROOMS.forEach(function (k) { k.col = 0; k.row = 0; });
    }
    // раскладка по умолчанию: по две комнаты на этаж, широкая то слева, то справа; нечётная последняя - во весь этаж
    var bad = ROOMS.some(function (k) { return !k.col || !k.row || k.col + k.span - 1 > 3; });
    if (bad) ROOMS.forEach(function (k, i) {
      var r = Math.floor(i / 2), first = i % 2 === 0, alone = first && i === ROOMS.length - 1;
      k.row = r + 1;
      if (alone) { k.col = 1; k.span = 3; }
      else if (r % 2 === 0) { k.col = first ? 1 : 3; k.span = first ? 2 : 1; }
      else { k.col = first ? 1 : 2; k.span = first ? 1 : 2; }
    });
    ROWS = Math.max.apply(null, ROOMS.map(function (k) { return k.row; }).concat([1]));
    // порядок обхода: по этажам сверху вниз, слева направо
    var ord = ROOMS.slice().sort(function (a, b) { return a.row - b.row || a.col - b.col; });
    WORKS = []; BYID = {};
    ord.forEach(function (k) { k.works.forEach(function (w) { WORKS.push(w); BYID[w.id] = w; }); });
  }
  function firstRoom() { var o = ROOMS.slice().sort(function (a, b) { return a.row - b.row || a.col - b.col; }); for (var i = 0; i < o.length; i++) if (o[i].works.length) return o[i]; return null; }

  // ---------- экраны ----------
  var SCREENS = ["doors", "home", "room", "work"], cur = "", S = { room: null, work: null, foto: 0 };
  var kbd = false;
  addEventListener("keydown", function () { kbd = true; }, true);
  addEventListener("pointerdown", function () { kbd = false; }, true);
  function show(id, inst) {
    SCREENS.forEach(function (s) {
      var e = $(s), on = s === id;
      if (inst) e.classList.add("inst");
      e.classList.toggle("on", on);
      e.inert = !on; if (!on) e.setAttribute("aria-hidden", "true"); else e.removeAttribute("aria-hidden");
      if (inst) requestAnimationFrame(function () { requestAnimationFrame(function () { e.classList.remove("inst"); }); });
    });
    cur = id;
    document.body.setAttribute("data-vp", id); // закрытая витрина прячет свою кнопку "Назад" вне дома
  }
  function restart(e, cls) { e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); }

  // ---------- мастер ----------
  function renderMaster() {
    var m = D.master || {};
    var role = [m.rol, m.gorod].filter(Boolean).join(", ");
    $("dName").textContent = m.imya || "Мастер";
    $("dRole").textContent = (window.VP_ZAST_ROL ? (m.rol || "") : role).toLowerCase(); // слой может оставить на заставке только род занятий
    $("hName").textContent = m.imya || "Мастер";
    $("hRole").textContent = role;
    var av = $("hAv");
    if (m.foto) { av.style.backgroundImage = 'url("' + srcOf({ src: m.foto }).replace(/"/g, "%22") + '")'; av.textContent = ""; }
    else av.textContent = initials(m.imya);
    // надпись на крыше: полная и короткая (если полная не влезает даже мелким шрифтом)
    ROOF = [!m.imya ? "дом мастера" : m.chelovek ? "дом мастерской «" + m.imya + "»" : "дом мастера " + m.imya, m.imya ? "«" + m.imya + "»" : "дом мастера"];
    fitRoof();
    var n = WORKS.length;
    $("hLead").textContent = n ? "Нажмите на комнату - войдёте и посмотрите работы вблизи." : "Работы скоро появятся.";
    $("allCnt").textContent = n || "";
    $("fUpd").textContent = ((D.master || {}).chelovek ? "Мастер - " + D.master.chelovek + ". " : "") + (D.obnovleno ? "Сайт обновлён " + day(D.obnovleno) + "." : "");
    // закрытая витрина Краснодара: на главной своя полоса (kr-dom.js), на пробном дизайне - "← Варианты дизайна"
    // всегда (и мастеру тоже); ссылки на демо-Мастерскую там нет - у Краснодара своя Мастерская
    var KR = /^kr-/.test(window.MEBEL_TOOL || "");
    if (KR) {
      var ed = document.querySelector("#staff a.ed"); if (ed) ed.remove();
      if (window.MEBEL_TOOL === "kr-dizajn" && !window.VP_TRY) { // у вариантов 1-4 "назад" стоит в их полосе (dizajn.js)
        $("staff").hidden = false;
        var vn = (/\/v(\d+)\/?$/.exec(location.pathname.replace(/index\.html$/, "")) || [])[1];
        $("staffNote").innerHTML = "<b>Пробный дизайн" + (vn ? " " + vn : "") + ".</b> Главную витрину он не меняет.";
      }
    } else if (STAFF) {
      $("staff").hidden = false;
      $("staffNote").innerHTML = DRAFT ? "<b>Черновик</b> из Мастерской - так увидит клиент после публикации." :
        D.shablon ? "<b>Вариант 4, путешествие по дому.</b> Шаблон: фото нарисованы, тексты - пример. Клиент эту полоску не видит." :
        "<b>Витрина: путешествие по дому.</b> Клиент эту полоску не видит.";
    }
  }

  // ---------- крыша: надпись в одну строку, ровно по центру ----------
  // Крыша - треугольник: чем выше строка, тем она уже. Ставим строку у основания и уменьшаем шрифт,
  // пока она не влезет в ширину крыши на своей высоте (с полями). Не влезла и мелкой - короткий текст.
  var ROOF = ["", ""];
  function fitRoof() {
    var r = $("roof"), t = $("roofT");
    if (!r || !t) return;
    var W = r.clientWidth, H = r.clientHeight;
    if (!W || !H) return;
    var pb = Math.round(Math.max(8, H * .13)), max = Math.min(21, H * .26), min = 11, best = null;
    // полный текст, если он читается (от 14 px); иначе тот вариант, что крупнее
    for (var v = 0; v < ROOF.length; v++) {
      t.textContent = ROOF[v];
      for (var fs = max; fs >= min; fs -= .5) {
        t.style.setProperty("--rf", fs + "px");
        var top = H - pb - fs * 1.15, room = W * Math.max(0, top) / H * .86;
        if (t.scrollWidth <= room) break;
      }
      fs = Math.max(fs, min);
      if (!best || fs > best.fs + .01) best = { v: v, fs: fs };
      if (v === 0 && fs >= 14) break;
    }
    t.textContent = ROOF[best.v]; t.style.setProperty("--rf", best.fs + "px");
    r.style.setProperty("--rb", pb + "px");
    t.classList.add("fit");
  }
  if (window.ResizeObserver) new ResizeObserver(function () { fitRoof(); }).observe($("roof"));
  else addEventListener("resize", fitRoof);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitRoof);

  // ---------- 0. двери ----------
  var SEEN = "vp-byl";
  // window.VP_ZASTAVKA (krasnodar/klient/): заставка при каждом открытии страницы, а не только в первый раз
  function seen() { if (window.VP_ZASTAVKA) return false; try { return localStorage.getItem(SEEN) === "1"; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(SEEN, "1"); } catch (e) {} }
  function openDoors() {
    var d = $("doors");
    if (d.classList.contains("open")) return;
    markSeen();
    // дом виден сразу за створками: "шагаем" внутрь, пока они разъезжаются
    $("home").classList.add("on"); $("home").inert = false; $("home").removeAttribute("aria-hidden");
    restart($("home"), "enter");
    d.classList.add("open");
    setTimeout(function () { show("home", true); d.classList.remove("open"); fitRoof(); if (kbd) $("tourBtn").focus({ preventScroll: true }); }, T(1750));
  }
  $("enterBtn").onclick = openDoors;

  // ---------- 1. дом ----------
  var TILES = {};
  function renderHouse() {
    var f = $("floors"); f.innerHTML = ""; TILES = {}; f.classList.toggle("r4", ROWS > 3);
    ROOMS.forEach(function (k) {
      var ws = k.works, b = el("button", "room" + (ws.length ? "" : " empty"));
      b.type = "button";
      b.style.gridColumn = k.col + " / span " + k.span; b.style.gridRow = String(k.row);
      var rv = ws.some(function (w) { return otzyvy(w).length; }), pn = ws.some(function (w) { return w.panorama; });
      b.innerHTML = '<div class="ph"' + (ws.length ? ' style="background-image:url(&quot;' + esc(roomCover(k)) + '&quot;)"' : "") + '></div><div class="dark"></div><div class="lamp"></div>' +
        (ws.length ? '<div class="tags"><span>' + ws.length + " " + plural(ws.length, ["работа", "работы", "работ"]) + "</span>" + (rv ? '<span class="rv">отзыв</span>' : "") + (pn ? '<span class="pn">обзор</span>' : "") + "</div>" : "") +
        '<div class="t"><b>' + esc(k.nazvanie) + "</b><span>" + esc(ws.length ? (k.hint || "") : "скоро здесь появятся работы") + "</span></div>";
      b.setAttribute("aria-label", k.nazvanie + (ws.length ? ", " + ws.length + " " + plural(ws.length, ["работа", "работы", "работ"]) : ", пока пусто"));
      b.onclick = function () { if (!ws.length) { toast("В этой комнате работы появятся позже"); return; } nav({ s: "room", k: k }); };
      // для слоя оформления (d2.js, дом с поворотом): другие фото этой комнаты и переход прямо к работе
      b.vpN = ws.length; b.vpCover = function (j) { return ws[j] ? cover(ws[j]) : ""; }; b.vpGo = function (j) { if (ws[j]) nav({ s: "work", w: ws[j] }); };
      b.style.setProperty("--i", (k.row - 1) * 3 + k.col - 1);
      if (k.span === 1 && String(k.nazvanie || "").length > 16) b.classList.add("long"); // на телефоне - мельче, чтобы не налезало
      b.setAttribute("data-k", k.id);
      f.appendChild(b); TILES[k.id] = b;
    });
    if (!WORKS.length) { $("tourBtn").hidden = true; $("allBtn").hidden = true; }
    try { document.dispatchEvent(new CustomEvent("vp-house")); } catch (e) {}
  }
  // для слоя оформления (dizajn2/foto-dom.js - дом на фото): комнаты по порядку обхода и вход в комнату.
  // VP_TILE(k) - свой элемент вместо плитки дома: от него комната "вырастает" и в него "сжимается".
  window.VP_HOUSE = {
    rooms: function () { return ROOMS.slice().sort(function (a, b) { return a.row - b.row || a.col - b.col; }).map(function (k) { return { id: k.id, nazvanie: k.nazvanie, hint: k.hint, n: k.works.length, cover: roomCover(k) }; }); },
    open: function (id) { var t = TILES[id]; if (t) t.click(); }
  };
  function tileOf(k) { var t = window.VP_TILE && window.VP_TILE(k.id); return t || TILES[k.id]; }
  $("tourBtn").onclick = function () { var k = firstRoom(); if (k) nav({ s: "room", k: k }); };
  $("writeBtn").onclick = function () { openModal(null); };
  // на телефоне нет наведения: свет включается в комнате, которая сейчас посередине экрана
  var touch = window.matchMedia && matchMedia("(hover: none)").matches;
  function litByScroll() {
    if (!touch || cur !== "home") return;
    var mid = innerHeight * 0.5, best = null, bd = 1e9;
    ROOMS.forEach(function (k) { if (!k.works.length) return; var r = TILES[k.id].getBoundingClientRect(); var d = Math.abs((r.top + r.bottom) / 2 - mid); if (r.bottom > 0 && r.top < innerHeight && d < bd) { bd = d; best = k.id; } });
    ROOMS.forEach(function (k) { TILES[k.id].classList.toggle("lit", k.id === best); });
  }
  var litT = 0;
  $("home").addEventListener("scroll", function () { if (!litT) litT = requestAnimationFrame(function () { litT = 0; litByScroll(); }); }, { passive: true });

  // ---------- разделы поверх дома: все работы, отзывы, о мастере ----------
  // Открытый раздел - отдельный шаг в истории браузера (#razdel=...): кнопка "назад" на телефоне его закрывает.
  var PN = null, PN_T = { raboty: "Все работы", otzyvy: "Отзывы", master: "О мастере" }, pnFrom = null;
  // закрытие раздела делает history.back() - он срабатывает не сразу. Если за это время открыли другой раздел
  // или видео, ждём, пока шаг назад закончится, и только потом открываем (иначе шаг назад закроет новое).
  var BACKING = false, AFTER = null;
  function ordRooms() { return ROOMS.filter(function (k) { return k.works.length; }).sort(function (a, b) { return a.row - b.row || a.col - b.col; }); }
  function pRaboty(sel) {
    var rs = ordRooms(), list = sel ? (ROOMBY[sel] || { works: [] }).works : WORKS;
    var h = '<div class="pchips" role="group" aria-label="Комнаты"><button type="button" data-k=""' + (sel ? "" : ' class="on"') + ">Все<i>" + WORKS.length + "</i></button>" +
      rs.map(function (k) { return '<button type="button" data-k="' + esc(k.id) + '"' + (sel === k.id ? ' class="on"' : "") + ">" + esc(k.nazvanie) + "<i>" + k.works.length + "</i></button>"; }).join("") + "</div>";
    h += list.length ? '<div class="pgrid">' + list.map(function (w, i) {
      return '<button type="button" class="pw" data-w="' + esc(w.id) + '" style="--i:' + Math.min(i, 14) + '"><img src="' + esc(cover(w)) + '" alt="" loading="lazy" decoding="async" draggable="false">' + wmHTML(fotos(w)[0]) +
        '<span class="pt"><small>' + esc(w._k ? w._k.nazvanie : "") + "</small><b>" + esc(w.nazvanie) + "</b></span></button>";
    }).join("") + "</div>" : '<div class="pempty"><b>Скоро</b>Работы появятся позже.</div>';
    return h;
  }
  function stars(n) { n = Math.max(0, Math.min(5, Math.round(+n || 0))); return n ? new Array(n + 1).join("★") + '<span style="opacity:.25">' + new Array(6 - n).join("★") + "</span>" : ""; }
  function pOtzyvy() {
    var L = (D.otzyvy || []).filter(function (o) { return o && o.tekst; });
    if (!L.length) return '<div class="pempty"><b>Отзывов пока нет</b>Они появятся здесь после первых заказов: мастер даёт клиенту ссылку с кодом заказа, и клиент пишет отзыв сам.</div>';
    var h = L.map(function (o) {
      var w = BYID[o.rabota];
      return '<div class="prev">' + (o.ocenka ? '<div class="st" aria-label="Оценка ' + esc(o.ocenka) + ' из 5">' + stars(o.ocenka) + "</div>" : "") + "<p>" + esc(o.tekst) + '</p><div class="by"><b>' + esc(o.imya || "Клиент") + "</b>" +
        (o.data ? "<span>" + esc(day(o.data)) + "</span>" : "") + (o.kod ? '<span class="ok">✓ заказ подтверждён</span>' : "") +
        (w ? '<button type="button" class="go" data-w="' + esc(w.id) + '">Смотреть работу →</button>' : "") + "</div></div>";
    }).join("");
    if (L.some(function (o) { return o.kod; })) h += '<p class="pnote">«Заказ подтверждён» - отзыв оставлен по личной ссылке с кодом заказа, которую мастер выдаёт после сдачи работы.</p>';
    return h;
  }
  function pMaster() {
    var m = D.master || {}, n = WORKS.length, ov = (D.otzyvy || []).filter(function (o) { return o && o.tekst; }).length;
    var av = m.foto ? '<span class="av" style="background-image:url(&quot;' + esc(srcOf({ src: m.foto })) + '&quot;)"></span>' : '<span class="av">' + esc(initials(m.imya)) + "</span>";
    var h = '<div class="pme">' + av + "<div><b>" + esc(m.imya || "Мастер") + "</b><span>" + esc([m.rol, m.gorod].filter(Boolean).join(", ")) + "</span>" +
      (m.chelovek ? "<span>Мастер - " + esc(m.chelovek) + "</span>" : "") + "</div></div>";
    if (m.o_sebe) h += '<p class="ptext">' + esc(m.o_sebe) + "</p>";
    var st = [];
    if (m.opyt) st.push("<div><b>" + esc(m.opyt) + "</b>делаю мебель</div>");
    if (n) st.push("<div><b>" + esc(m.rabot || n) + "</b>" + (m.rabot ? "работ" : plural(n, ["работа", "работы", "работ"]) + " на сайте") + "</div>");
    if (ov) st.push("<div><b>" + ov + "</b>" + plural(ov, ["отзыв", "отзыва", "отзывов"]) + "</div>");
    if (st.length) h += '<div class="pstats">' + st.join("") + "</div>";
    var ot = (D.otlichiya || []).filter(function (o) { return o && (o.zag || o.tekst); });
    if (ot.length) h += '<div class="ph4">Почему со мной удобно</div><div class="plist">' + ot.map(function (o) { return "<div><b>" + esc(o.zag || "") + "</b><span>" + esc(o.tekst || "") + "</span></div>"; }).join("") + "</div>";
    var c = [], wa = waUrl(""), tg = tgUrl(), tel = digits(K.telefon);
    if (wa) c.push('<a class="btn wa" href="' + esc(waUrl("Здравствуйте! Пишу с вашего сайта.")) + '" target="_blank" rel="noopener">Написать в WhatsApp</a>');
    if (tg) c.push('<a class="btn ghost" href="' + esc(tg) + '" target="_blank" rel="noopener">Telegram</a>');
    if (tel) c.push('<a class="btn ghost" href="tel:+' + esc(tel) + '">Позвонить ' + esc(K.telefon) + "</a>");
    var vk = String(K.vk || "").trim();
    if (vk) c.push('<div class="ln">ВКонтакте: <a href="' + esc(/^https?:/.test(vk) ? vk : "https://" + vk) + '" target="_blank" rel="noopener">' + esc(vk.replace(/^https?:\/\//, "")) + "</a></div>");
    if (K.adres) c.push('<div class="ln">' + esc(K.adres) + "</div>");
    if (K.chasy) c.push('<div class="ln">' + esc(K.chasy) + "</div>");
    if (c.length) h += '<div class="ph4">Связаться</div><div class="pcont">' + c.join("") + "</div>";
    return h;
  }
  function fillPanel(id, sel) {
    $("pnT").textContent = PN_T[id] || "";
    $("pnSc").innerHTML = id === "raboty" ? pRaboty(sel) : id === "otzyvy" ? pOtzyvy() : pMaster();
    $("pnSc").scrollTop = 0;
  }
  function markNav() { [].forEach.call($("tnav").querySelectorAll("button[data-p]"), function (b) { b.classList.toggle("on", b.getAttribute("data-p") === PN); }); }
  function openPanel(id, noPush, sel) {
    if (!PN_T[id]) return;
    if (cur !== "home") return;
    if (BACKING && !noPush) { AFTER = function () { openPanel(id, false, sel); }; return; }
    if (!noPush) {
      if (PN) history.replaceState({ vp: 0, pn: id }, "", urlOf({ s: "home" }) + "#razdel=" + id);
      else history.pushState({ vp: 0, pn: id }, "", urlOf({ s: "home" }) + "#razdel=" + id);
    }
    if (!PN) pnFrom = document.activeElement;
    fillPanel(id, sel); PN = id; markNav();
    var p = $("panel"); p.classList.add("on"); p.removeAttribute("aria-hidden"); p.inert = false;
    document.body.classList.add("pn-open"); $("home").inert = true;
    setTimeout(function () { if (PN) $("pnX").focus({ preventScroll: true }); }, T(80));
  }
  // fromPop: шаг "назад" уже сделан браузером; иначе убираем шаг раздела из истории сами
  function closePanel(fromPop) {
    if (!PN) return false;
    PN = null; markNav();
    var p = $("panel"); p.classList.remove("on"); p.setAttribute("aria-hidden", "true"); p.inert = true;
    document.body.classList.remove("pn-open"); $("home").inert = false;
    if (!fromPop && history.state && history.state.pn) { BACKING = true; history.back(); }
    if (pnFrom && pnFrom.focus && kbd) pnFrom.focus({ preventScroll: true });
    pnFrom = null;
    return true;
  }
  $("panel").inert = true;
  $("pnX").onclick = function () { closePanel(); };
  $("pnBack").onclick = function () { closePanel(); };
  // работа из раздела: раздел убираем из истории, дальше обычный путь дом -> комната -> работа
  function workFromPanel(id) {
    var w = BYID[id]; if (!w) return;
    PN = null; markNav();
    var p = $("panel"); p.classList.remove("on"); p.setAttribute("aria-hidden", "true"); p.inert = true;
    document.body.classList.remove("pn-open"); $("home").inert = false;
    history.replaceState({ vp: 0 }, "", urlOf({ s: "home" }));
    S.ri = w._k.works.indexOf(w);
    renderRoom(w._k, S.ri, false);
    nav({ s: "work", w: w });
  }
  $("pnSc").addEventListener("click", function (e) {
    var c = e.target.closest("[data-k]");
    if (c && c.parentNode.classList.contains("pchips")) {
      var k = c.getAttribute("data-k") || "";
      var x = $("pnSc").querySelector(".pchips").scrollLeft;
      $("pnSc").innerHTML = pRaboty(k); $("pnSc").querySelector(".pchips").scrollLeft = x;
      var on = $("pnSc").querySelector(".pchips .on"); if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest", inline: "nearest" });
      return;
    }
    var w = e.target.closest("[data-w]");
    if (w) workFromPanel(w.getAttribute("data-w"));
  });
  // свайп вниз по шапке раздела на телефоне - закрыть
  (function () {
    var y0 = null, box = $("pnBox");
    $("pnBox").querySelector(".pn-head").addEventListener("pointerdown", function (e) { if (e.target.closest("button")) return; y0 = e.clientY; box.style.transition = "none"; });
    addEventListener("pointermove", function (e) { if (y0 == null) return; var d = Math.max(0, e.clientY - y0); if (innerWidth <= 860) box.style.transform = "translateY(" + d + "px)"; });
    addEventListener("pointerup", function (e) {
      if (y0 == null) return; var d = e.clientY - y0; y0 = null; box.style.transition = ""; box.style.transform = "";
      if (innerWidth <= 860 && d > 90) closePanel();
    });
    addEventListener("pointercancel", function () { if (y0 == null) return; y0 = null; box.style.transition = ""; box.style.transform = ""; });
  })();
  $("tnav").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-p]"); if (!b) return;
    var id = b.getAttribute("data-p");
    if (id === "video") { toReels(); return; }
    openPanel(id);
  });
  $("whoBtn").onclick = function () { openPanel("master"); };
  $("allBtn").onclick = function () { openPanel("raboty"); };
  function toReels() {
    var hm = $("home"), r = $("reels"); if (r.hidden) return;
    var y = r.getBoundingClientRect().top - hm.getBoundingClientRect().top + hm.scrollTop - $("htop").offsetHeight + 10;
    hm.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  }

  // ---------- видео под домом (лента как рилс) ----------
  // D.video: [{ nazvanie, ssylka (ВК, YouTube, Rutube), oblozhka ("foto/..."), rabota, fajl ("video/....mp4" - маленький файл рядом с сайтом) }]
  function embedOf(u) {
    u = String(u || "").trim(); var m;
    if ((m = /(?:youtube\.com\/(?:shorts\/|watch\?(?:.*&)?v=|embed\/)|youtu\.be\/)([\w-]{6,})/.exec(u))) return { src: "https://www.youtube-nocookie.com/embed/" + m[1] + "?autoplay=1&playsinline=1&rel=0", site: "YouTube" };
    if ((m = /rutube\.ru\/(?:video|shorts|play\/embed)\/([\w]{10,})/.exec(u))) return { src: "https://rutube.ru/play/embed/" + m[1] + "?autoplay=1", site: "Rutube" };
    if ((m = /(?:vk\.com|vk\.ru|vkvideo\.ru)\/.*?(?:video|clip)(-?\d+)_(\d+)/.exec(u))) return { src: "https://vk.com/video_ext.php?oid=" + m[1] + "&id=" + m[2] + "&hd=2&autoplay=1", site: "ВК" };
    if ((m = /video_ext\.php\?(.+)/.exec(u))) return { src: "https://vk.com/video_ext.php?" + m[1], site: "ВК" };
    return null;
  }
  var VIDS = [];
  var PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
  function renderReels() {
    VIDS = (D.video || []).filter(function (v) { return v && (v.fajl || embedOf(v.ssylka)); });
    var row = $("reelRow"), sec = $("reels");
    var preview = D.shablon || STAFF || window.VP_PREVIEW;
    if (!VIDS.length && !preview) { sec.hidden = true; $("tnVideo").hidden = true; return; }
    sec.hidden = false; $("tnVideo").hidden = false;
    if (!VIDS.length) {
      $("reelsSub").textContent = "Здесь будут короткие вертикальные видео мастера: как идёт работа, монтаж, обзор готовой мебели. Достаточно ссылки на ролик в ВК, YouTube или Rutube.";
      row.innerHTML = [["Здесь будут видео мастера", "процесс работы"], ["Монтаж", "как собираем на месте"], ["Готовая мебель", "обзор в квартире у клиента"], ["Детали", "фурнитура, подсветка, механизмы"]].map(function (t, i) {
        return '<div class="reel ph-empty" style="--i:' + i + '"><span class="pl">' + PLAY + '</span><span class="rt"><b>' + esc(t[0]) + "</b><span>" + esc(t[1]) + "</span></span></div>";
      }).join("");
    } else {
      $("reelsSub").textContent = "Короткие видео: нажмите, чтобы посмотреть.";
      row.innerHTML = VIDS.map(function (v, i) {
        var w = BYID[v.rabota], po = v.oblozhka ? srcOf({ src: v.oblozhka }) : w ? cover(w) : "";
        var e = embedOf(v.ssylka);
        return '<button type="button" class="reel" data-v="' + i + '" style="--i:' + Math.min(i, 8) + (po ? ";background-image:url(&quot;" + esc(po) + "&quot;)" : "") + '"><span class="pl">' + PLAY + '</span><span class="rt"><b>' + esc(v.nazvanie || "Видео") + "</b><span>" + esc(w ? w._k.nazvanie : e ? e.site : "") + "</span></span></button>";
      }).join("");
    }
    if (window.IntersectionObserver && !reduce) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { sec.classList.add("in"); io.disconnect(); } }, { root: $("home"), threshold: .15 });
      io.observe(sec);
    }
  }
  $("reelRow").addEventListener("click", function (e) { var b = e.target.closest("[data-v]"); if (b) openVideo(+b.getAttribute("data-v")); });
  var VID = false;
  function openVideo(i) {
    var v = VIDS[i]; if (!v) return;
    if (BACKING) { AFTER = function () { openVideo(i); }; return; }
    var e = embedOf(v.ssylka), f = $("vpFrame");
    if (v.fajl) f.innerHTML = '<video src="' + esc(srcOf({ src: v.fajl })) + '" controls autoplay playsinline' + (v.oblozhka ? ' poster="' + esc(srcOf({ src: v.oblozhka })) + '"' : "") + "></video>";
    else f.innerHTML = '<iframe src="' + esc(e.src) + '" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="' + esc(v.nazvanie || "Видео") + '"></iframe>';
    $("vpT").textContent = v.nazvanie || "";
    var a = $("vpOpen"); a.hidden = !v.ssylka; if (v.ssylka) { a.href = v.ssylka; a.textContent = "Открыть в " + (e ? e.site : "браузере"); }
    var p = $("vplayer"); p.classList.add("on"); p.removeAttribute("aria-hidden");
    if (!VID) history.pushState({ vp: 0, vid: 1 }, "", location.href);
    VID = true;
    setTimeout(function () { $("vpX").focus({ preventScroll: true }); }, 50);
  }
  function closeVideo(fromPop) {
    if (!VID) return false;
    VID = false;
    var p = $("vplayer"); p.classList.remove("on"); p.setAttribute("aria-hidden", "true");
    setTimeout(function () { if (!VID) $("vpFrame").innerHTML = ""; }, T(400));
    if (!fromPop && history.state && history.state.vid) { BACKING = true; history.back(); }
    return true;
  }
  $("vpX").onclick = function () { closeVideo(); };
  $("vplayer").addEventListener("click", function (e) { if (e.target === this) closeVideo(); });

  // влёт: плитка растёт на весь экран, фото на ходу светлеет
  function coverBox(sz, x, y, w, h) { var s = Math.max(w / sz.w, h / sz.h); return { s: s, x: x + (w - sz.w * s) / 2, y: y + (h - sz.h * s) / 2 }; }
  function insetOf(r) { return "inset(" + r.top + "px " + (innerWidth - r.right) + "px " + (innerHeight - r.bottom) + "px " + r.left + "px round 4px)"; }
  function makeFly(src, sz) {
    var f = el("div", "fly"), im = new Image(); im.src = src; im.alt = ""; im.style.width = sz.w + "px"; im.style.height = sz.h + "px";
    f.appendChild(im); f.appendChild(el("i")); document.body.appendChild(f); return f;
  }
  function flyInto(k, done) {
    var tile = tileOf(k), src = roomCover(k);
    loadImg(src, function (sz) {
      if (reduce || !tile || !tile.animate) { done(); return; }
      var r = tile.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) { done(); return; }
      // плитка под светом чуть приближена (scale 1.1) - начинаем ровно с того кадра, что виден в окне
      var a = coverBox(sz, r.left - r.width * .05, r.top - r.height * .05, r.width * 1.1, r.height * 1.1);
      var b = coverBox(sz, 0, 0, innerWidth, innerHeight);
      var f = makeFly(src, sz), im = f.firstChild, dk = f.lastChild, dur = 900;
      f.animate([{ clipPath: insetOf(r) }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], { duration: dur, easing: SWIFT, fill: "forwards" });
      im.animate([{ transform: "translate(" + a.x + "px," + a.y + "px) scale(" + a.s + ")" }, { transform: "translate(" + b.x + "px," + b.y + "px) scale(" + b.s + ")" }], { duration: dur, easing: SWIFT, fill: "forwards" });
      dk.animate([{ opacity: .1 }, { opacity: 0 }], { duration: dur, easing: SWIFT, fill: "forwards" }).onfinish = function () {
        done();
        f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 550, easing: EASE, fill: "forwards" }).onfinish = function () { f.remove(); };
      };
    });
  }
  // обратно: комната сжимается в свою плитку на доме, свет гаснет
  function flyOut(k, done) {
    var src = roomCover(k);
    loadImg(src, function (sz) {
      var tile = tileOf(k);
      done();
      if (reduce || !tile || !tile.animate) return;
      var hm = $("home"), r0 = tile.getBoundingClientRect();
      if (r0.top < 0 || r0.bottom > innerHeight) hm.scrollTop += r0.top - (innerHeight - r0.height) / 2;
      var r = tile.getBoundingClientRect();
      var a = coverBox(sz, 0, 0, innerWidth, innerHeight), b = coverBox(sz, r.left, r.top, r.width, r.height);
      var f = makeFly(src, sz), im = f.firstChild, dk = f.lastChild, dur = 750;
      f.animate([{ clipPath: "inset(0px 0px 0px 0px round 0px)" }, { clipPath: insetOf(r) }], { duration: dur, easing: SWIFT, fill: "forwards" });
      im.animate([{ transform: "translate(" + a.x + "px," + a.y + "px) scale(" + a.s + ")" }, { transform: "translate(" + b.x + "px," + b.y + "px) scale(" + b.s + ")" }], { duration: dur, easing: SWIFT, fill: "forwards" });
      dk.animate([{ opacity: .7 }, { opacity: .62 }], { duration: dur, easing: SWIFT, fill: "forwards" }).onfinish = function () {
        f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" }).onfinish = function () { f.remove(); };
      };
    });
  }

  // ---------- мини-карта и крошки ----------
  function mini(box) {
    box.innerHTML = "";
    var here = S.work ? S.work._k : S.room;
    box.style.gridTemplateRows = "repeat(" + ROWS + "," + (ROWS > 3 ? 11 : 15) + "px)";
    ROOMS.forEach(function (k) {
      var b = el("button", k === here ? "on" : (k.works.length ? "has" : ""));
      b.type = "button"; b.style.gridColumn = k.col + " / span " + k.span; b.style.gridRow = String(k.row);
      b.setAttribute("aria-label", k.nazvanie + (k === here ? " - вы здесь" : k.works.length ? "" : " - пока пусто"));
      b.title = k.nazvanie;
      b.onclick = function () { if (!k.works.length) { toast(k.nazvanie + ": работы появятся позже"); return; } if (k === here && cur === "room") return; nav({ s: "room", k: k }); };
      box.appendChild(b);
    });
  }
  function crumbs(box, lvl) {
    var k = lvl > 1 ? S.work._k : S.room;
    box.innerHTML = "";
    var home = el("button", "", "Весь дом"); home.type = "button"; home.onclick = function () { nav({ s: "home" }); }; box.appendChild(home);
    if (lvl > 1) { var rb = el("button", "", esc(k.nazvanie)); rb.type = "button"; rb.onclick = function () { nav({ s: "room", k: k }); }; box.appendChild(rb); }
    box.appendChild(el("span", "", esc(lvl > 1 ? S.work.nazvanie : k.nazvanie)));
  }

  // ---------- 2. комната: работы карусель / лента / плитки / журнал ----------
  // Вид выбирает клиент переключателем под названием комнаты, выбор запоминается (localStorage vp-vid).
  var VIEWS = ["karusel", "lenta", "plitki", "zhurnal"], VKEY = "vp-vid", RV = "karusel";
  try { var v0 = localStorage.getItem(VKEY); if (VIEWS.indexOf(v0) >= 0) RV = v0; } catch (e) {}
  // слой оформления может закрепить один вид (window.VP_VID) и спрятать переключатель - тогда выбор клиента не читаем
  if (VIEWS.indexOf(window.VP_VID) >= 0) RV = window.VP_VID;
  var SUB = { karusel: "листайте и открывайте", lenta: "прокручивайте вниз", plitki: "все сразу - нажмите на любую", zhurnal: "листайте страницы" };
  function renderRoom(k, idx, anim) {
    S.room = k; S.work = null;
    $("roomTitle").textContent = k.nazvanie;
    S.ri = Math.max(0, Math.min(k.works.length - 1, idx || 0));
    crumbs($("crumbsR"), 1); mini($("miniR"));
    buildView(anim);
  }
  function buildView(anim) {
    var n = S.room.works.length;
    $("room").setAttribute("data-view", RV);
    markViews(RV, !anim);
    $("roomSub").textContent = n + " " + plural(n, ["работа", "работы", "работ"]) + " - " + SUB[RV];
    $("rlist").hidden = !(RV === "lenta" || RV === "plitki");
    $("book").hidden = RV !== "zhurnal";
    $("roomMain").scrollTop = 0;
    if (RV === "karusel") buildDeck(S.ri, anim);
    else if (RV === "zhurnal") buildBook(S.ri, anim);
    else buildList(S.ri, anim);
  }
  // подсветка выбранного вида едет к кнопке
  function markViews(v, inst) {
    var on = null, pill = $("vpill");
    [].forEach.call($("views").querySelectorAll("button"), function (b) { var a = b.getAttribute("data-v") === v; b.setAttribute("aria-checked", a ? "true" : "false"); b.tabIndex = a ? 0 : -1; if (a) on = b; });
    if (!on) return;
    var put = function () { pill.style.width = on.offsetWidth + "px"; pill.style.transform = "translateX(" + (on.offsetLeft - 4) + "px)"; };
    if (inst) { pill.classList.add("inst"); put(); void pill.offsetWidth; pill.classList.remove("inst"); } else put();
  }
  function setView(v) {
    if (v === RV || VIEWS.indexOf(v) < 0 || !S.room) return;
    try { localStorage.setItem(VKEY, v); } catch (e) {}
    markViews(v);
    var stg = $("roomStage");
    if (reduce || !stg.animate) { RV = v; buildView(false); return; }
    // старый вид тает, новый собирается своей анимацией
    stg.getAnimations().forEach(function (a) { a.cancel(); });
    stg.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.97)" }], { duration: 200, easing: "ease-in", fill: "forwards" }).onfinish = function () {
      RV = v; flipKill(); buildView(true);
      stg.getAnimations().forEach(function (a) { a.cancel(); });
    };
  }
  // экран комнаты сам не прокручивается (иначе фокус или 3D-карточки сдвигают его); прокручивается только лента/плитки
  $("room").addEventListener("scroll", function () { if (this.scrollTop || this.scrollLeft) { this.scrollTop = 0; this.scrollLeft = 0; } });
  $("roomMain").addEventListener("scroll", function () {
    if (this.scrollLeft) this.scrollLeft = 0;
    if (this.scrollTop && (RV === "karusel" || RV === "zhurnal")) this.scrollTop = 0;
    $("room").classList.toggle("sc", this.scrollTop > 8);
  }, { passive: true });
  $("views").addEventListener("click", function (e) { var b = e.target.closest("button[data-v]"); if (b) setView(b.getAttribute("data-v")); });
  $("views").addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault(); e.stopPropagation();
    var i = (VIEWS.indexOf(RV) + (e.key === "ArrowRight" ? 1 : -1) + VIEWS.length) % VIEWS.length;
    setView(VIEWS[i]); $("views").querySelector('[data-v="' + VIEWS[i] + '"]').focus();
  });
  // точки под каруселью и журналом; если работ много - "3 / 36"
  function setDots(n) { $("dots").innerHTML = n > 12 ? '<span class="dn"></span>' : new Array(n + 1).join("<i></i>"); }
  function updDots(i, n) {
    var d = $("dots"), dn = d.firstChild;
    if (dn && dn.className === "dn") { dn.textContent = (i + 1) + " / " + n; return; }
    [].forEach.call(d.children, function (e, j) { e.classList.toggle("on", j === i); });
  }

  // --- карусель (3D) ---
  var deckP = 0, deckT = 0, deckEls = [], deckN = 0, deckList = [], deckRaf = 0, deckLast = 0, deckCenter = -1;
  function buildDeck(idx, sweep) {
    var ws = S.room.works;
    var d = $("deck"); d.innerHTML = ""; deckEls = [];
    deckList = ws.map(function (w) { return { w: w }; });
    if (ws.length < 3) {
      deckList.push({ ph: "Здесь будет следующая работа", sub: "Портфолио пополняется" });
      if (ws.length < 2) deckList.push({ ph: "И ещё одна", sub: "Мастер добавит её после сдачи заказа" });
    }
    deckList.forEach(function (it, i) {
      var c;
      if (it.w) {
        var w = it.w, f0 = fotos(w)[0], nt = (w.tochki || []).length, nf = (w.foto || []).length, rv = otzyvy(w).length;
        c = el("button", "wcard");
        c.type = "button";
        c.innerHTML = '<img src="' + esc(cover(w)) + '" alt="" draggable="false" decoding="async">' + wmHTML(f0) + '<i class="shade"></i>' +
          '<div class="tag">' + (nf > 1 ? "<span>" + nf + " фото</span>" : "") + (nt ? "<span>" + nt + " " + plural(nt, ["деталь", "детали", "деталей"]) + "</span>" : "") + (rv ? "<span>отзыв</span>" : "") + "</div>" +
          '<div class="meta"><b>' + esc(w.nazvanie) + "</b><span>" + esc(w.gde || "") + '</span></div><span class="open">' + IC.open + "</span>";
        c.setAttribute("aria-label", w.nazvanie);
        c.addEventListener("click", function (e) { if (e.detail === 0) deckAct(i); });
        c.addEventListener("focus", function () { if (kbd && Math.round(deckT) !== i) { deckT = i; kick(); } });
      } else {
        c = el("div", "wcard ph", "<div><b>" + esc(it.ph) + '</b><span style="font-size:13px">' + esc(it.sub) + "</span></div>");
        c.setAttribute("aria-hidden", "true");
      }
      d.appendChild(c); deckEls.push(c);
    });
    deckN = deckList.length;
    deckT = Math.max(0, Math.min(ws.length - 1, idx || 0));
    deckP = sweep && !reduce ? deckT - 1.6 : deckT;
    deckCenter = -1;
    setDots(deckN);
    deckRender(); kick();
  }
  // Фон комнаты - размытое и затемнённое фото работы. Раньше размывал браузер (filter: blur) на весь экран
  // при каждой смене работы - это главный тормоз на телефонах. Теперь фото один раз сжимается до 40 точек,
  // размывается и затемняется на холсте; браузер только растягивает маленькую картинку и плавно меняет прозрачность.
  var BG = {}, BGW = {}, bgWant = "";
  function bgSize(im) { return { W: 40, H: Math.max(8, Math.round(40 * (im.naturalHeight || im.height || 3) / (im.naturalWidth || im.width || 4))) }; }
  function blurMake(im) {
    try {
      var sz = bgSize(im);
      var W = sz.W, H = sz.H, c = document.createElement("canvas");
      c.width = W; c.height = H;
      var x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0, W, H); var d = x.getImageData(0, 0, W, H);
      var p = d.data, n = W * H, a = new Float32Array(n * 3), t = new Float32Array(n * 3), r = 2, D = 2 * r + 1, i, j, k, s, q, o;
      for (i = 0; i < n; i++) { a[i * 3] = p[i * 4]; a[i * 3 + 1] = p[i * 4 + 1]; a[i * 3 + 2] = p[i * 4 + 2]; }
      // размытие "коробкой" по строкам, потом по столбцам (скользящая сумма); три прохода дают почти гауссово
      for (var pass = 0; pass < 3; pass++) {
        for (j = 0; j < H; j++) for (k = 0; k < 3; k++) {
          o = j * W; s = 0;
          for (q = -r; q <= r; q++) s += a[(o + Math.max(0, Math.min(W - 1, q))) * 3 + k];
          for (i = 0; i < W; i++) { t[(o + i) * 3 + k] = s / D; s += a[(o + Math.min(W - 1, i + r + 1)) * 3 + k] - a[(o + Math.max(0, i - r)) * 3 + k]; }
        }
        for (i = 0; i < W; i++) for (k = 0; k < 3; k++) {
          s = 0;
          for (q = -r; q <= r; q++) s += t[(Math.max(0, Math.min(H - 1, q)) * W + i) * 3 + k];
          for (j = 0; j < H; j++) { a[(j * W + i) * 3 + k] = s / D; s += t[(Math.min(H - 1, j + r + 1) * W + i) * 3 + k] - t[(Math.max(0, j - r) * W + i) * 3 + k]; }
        }
      }
      // затемнение (как brightness .32) и чуть больше цвета
      for (i = 0; i < n; i++) {
        var m = (a[i * 3] + a[i * 3 + 1] + a[i * 3 + 2]) / 3;
        for (k = 0; k < 3; k++) p[i * 4 + k] = Math.max(0, Math.min(255, (m + (a[i * 3 + k] - m) * 1.15) * .32));
        p[i * 4 + 3] = 255;
      }
      x.putImageData(d, 0, 0);
      return c.toDataURL("image/png");
    } catch (e) { return ""; } // фото с чужого адреса без разрешения - тогда просто тёмный фон
  }
  // later = заранее, для соседних страниц: считаем, когда телефон свободен
  function blurSrc(src, cb, later) {
    if (BG[src] !== undefined) { if (cb) cb(BG[src]); return; }
    var w = BGW[src];
    if (w) { if (cb) { w.q.push(cb); w.make(); } return; } // фон нужен сейчас - не ждём свободной минуты
    w = BGW[src] = { q: cb ? [cb] : [], go: false };
    var fin = function (url) { if (BG[src] !== undefined) return; BG[src] = url; delete BGW[src]; w.q.forEach(function (f) { f(url); }); };
    // запасной путь (старые браузеры): обычная картинка
    var viaImg = function () {
      var im = new Image(), done = function () { fin(blurMake(im)); };
      im.onload = done; im.onerror = function () { fin(""); }; im.src = src;
    };
    // Фото разжимается и уменьшается до 40 точек вне основного потока (fetch + createImageBitmap),
    // фото уже в кэше браузера, так что сеть не тратится. Основному потоку остаётся крошечная картинка.
    w.make = function () {
      if (w.go) return; w.go = true;
      if (!window.fetch || !window.createImageBitmap) { viaImg(); return; }
      fetch(src).then(function (r) { if (!r.ok) throw 0; return r.blob(); })
        .then(function (bl) { return createImageBitmap(bl, { resizeWidth: 40, resizeQuality: "medium" }); })
        .then(function (bm) { fin(blurMake(bm)); if (bm.close) bm.close(); })
        .catch(viaImg);
    };
    if (later && !w.q.length && window.requestIdleCallback) requestIdleCallback(w.make, { timeout: 1500 }); else w.make();
  }
  function setRoomBg(src) {
    bgWant = src;
    blurSrc(src, function (url) {
      if (bgWant !== src) return; // пока считали, пользователь уже листнул дальше
      var a = $("roomBgA"), b = $("roomBgB"), on = a.classList.contains("on") ? a : b.classList.contains("on") ? b : null, off = on === a ? b : a;
      if (on && on._src === src) return;
      off._src = src; off.style.backgroundImage = url ? 'url("' + url + '")' : "none";
      off.classList.add("on"); if (on) on.classList.remove("on");
    });
  }
  function deckRender() {
    if (RV !== "karusel") return;
    deckEls.forEach(function (c, i) {
      var d = i - deckP, ad = Math.abs(d);
      c.style.transform = "translateX(" + (-50 + d * 68) + "%) translateZ(" + (-ad * 220) + "px) rotateY(" + Math.max(-50, Math.min(50, -d * 32)) + "deg)";
      c.style.opacity = ad < 1.4 ? 1 : Math.max(0, 1 - (ad - 1.4) / 1);
      c.style.zIndex = 100 - Math.round(ad * 10);
      c.style.visibility = ad > 2.6 ? "hidden" : "visible";
      var sh = c.querySelector(".shade"); if (sh) sh.style.opacity = Math.min(ad, 2) * .3;
      c.classList.toggle("center", ad < .3);
      if (c.tagName === "BUTTON") c.tabIndex = Math.round(deckT) === i ? 0 : -1;
    });
    var ci = Math.max(0, Math.min(deckN - 1, Math.round(deckP)));
    updDots(ci, deckN);
    if (ci !== deckCenter) {
      deckCenter = ci;
      var it = deckList[ci];
      if (it && it.w) { S.ri = ci; setRoomBg(cover(it.w)); $("deckLive").textContent = it.w.nazvanie + ", " + (ci + 1) + " из " + S.room.works.length; }
    }
  }
  function kick() { if (!deckRaf) { deckLast = performance.now(); deckRaf = requestAnimationFrame(deckFrame); } }
  function deckFrame(now) {
    deckRaf = 0;
    var dt = Math.min(64, now - deckLast); deckLast = now;
    if (!deckDrag) {
      var k = reduce ? 1 : 1 - Math.pow(1 - 0.13, dt / 16.7);
      deckP += (deckT - deckP) * k;
      if (Math.abs(deckT - deckP) < 0.0015) deckP = deckT;
    }
    deckRender();
    if (cur === "room" && RV === "karusel" && (deckDrag || deckP !== deckT)) deckRaf = requestAnimationFrame(deckFrame);
  }
  function deckGo(i) { deckT = Math.max(0, Math.min(deckN - 1, i)); kick(); }
  function deckAct(i) {
    var it = deckList[i]; if (!it) return;
    if (!it.w) { deckGo(i); return; }
    if (Math.round(deckT) === i && Math.abs(deckP - i) < .35) nav({ s: "work", w: it.w });
    else deckGo(i);
  }
  var deckDrag = false, dSX = 0, dSP = 0, dMoved = false, dV = 0, dLX = 0, dLT = 0, dDown = null, dId = null;
  $("deck").addEventListener("pointerdown", function (e) {
    if (e.button > 0) return;
    deckDrag = true; dMoved = false; dSX = dLX = e.clientX; dSP = deckP; dV = 0; dLT = performance.now(); dDown = e.target; dId = e.pointerId;
    kick();
  });
  addEventListener("pointermove", function (e) {
    if (!deckDrag || e.pointerId !== dId) return;
    var dx = e.clientX - dSX;
    if (!dMoved && Math.abs(dx) > 7) { dMoved = true; $("deck").classList.add("drag"); try { $("deck").setPointerCapture(dId); } catch (er) {} }
    if (!dMoved) return;
    var now = performance.now(); dV = (e.clientX - dLX) / Math.max(1, now - dLT); dLX = e.clientX; dLT = now;
    var w = Math.min(innerWidth * .6, 320);
    deckP = deckT = Math.max(-.4, Math.min(deckN - .6, dSP - dx / w));
  });
  function deckUp(e) {
    if (!deckDrag || (e && e.pointerId !== dId)) return;
    deckDrag = false; $("deck").classList.remove("drag");
    if (dMoved) { var fl = performance.now() - dLT > 90 ? 0 : dV; deckGo(Math.round(deckP - fl * 1.6)); }
    else if (e && e.type === "pointerup") { var c = dDown && dDown.closest ? dDown.closest(".wcard") : null; var i = deckEls.indexOf(c); if (i >= 0) deckAct(i); kick(); }
  }
  addEventListener("pointerup", deckUp); addEventListener("pointercancel", deckUp);
  var wheelAcc = 0, wheelT = 0;
  $("deck").addEventListener("wheel", function (e) {
    var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    e.preventDefault();
    var now = performance.now(); if (now - wheelT > 260) wheelAcc = 0;
    wheelAcc += d;
    if (Math.abs(wheelAcc) > 50 && now - wheelT > 260) { deckGo(Math.round(deckT) + (wheelAcc > 0 ? 1 : -1)); wheelAcc = 0; wheelT = now; }
  }, { passive: false });
  $("dPrev").onclick = function () { if (RV === "zhurnal") turn(-1); else deckGo(Math.round(deckT) - 1); };
  $("dNext").onclick = function () { if (RV === "zhurnal") turn(1); else deckGo(Math.round(deckT) + 1); };

  // --- лента и плитки ---
  var listIO = null;
  function buildList(idx, anim) {
    var box = $("rlist"), ws = S.room.works, mode = RV, go = !!anim && !reduce;
    box.className = "rlist " + mode; box.innerHTML = "";
    if (listIO) { listIO.disconnect(); listIO = null; }
    ws.forEach(function (w, i) {
      var f0 = fotos(w)[0], nt = (w.tochki || []).length, nf = (w.foto || []).length, rv = otzyvy(w).length;
      var c = el("button", "rcard" + (mode === "lenta" && go ? "" : " in"));
      c.type = "button"; c.style.setProperty("--i", i);
      c.innerHTML = '<span class="ri"><img src="' + esc(cover(w)) + '" alt="" draggable="false" decoding="async"' + (i > 7 ? ' loading="lazy"' : "") + ">" + wmHTML(f0) + "</span>" +
        '<span class="tag">' + (nf > 1 ? "<span>" + nf + " фото</span>" : "") + (nt ? "<span>" + nt + " " + plural(nt, ["деталь", "детали", "деталей"]) + "</span>" : "") + (rv ? "<span>отзыв</span>" : "") + "</span>" +
        '<span class="rm"><b>' + esc(w.nazvanie) + "</b><span>" + esc(w.gde || "") + '</span></span><span class="open">' + IC.open + "</span>";
      c.setAttribute("aria-label", w.nazvanie);
      c.onclick = function () { S.ri = i; nav({ s: "work", w: w }); };
      box.appendChild(c);
    });
    if (mode === "lenta" && go) {
      if (window.IntersectionObserver) {
        listIO = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); listIO.unobserve(en.target); } }); }, { root: $("roomMain"), rootMargin: "0px 0px -5% 0px" });
        [].forEach.call(box.children, function (c) { listIO.observe(c); });
      } else [].forEach.call(box.children, function (c) { c.classList.add("in"); });
    }
    box.classList.remove("go"); if (go) { void box.offsetWidth; box.classList.add("go"); }
    if (idx > 0) roomEl(idx, true);
    if (ws[idx]) setRoomBg(cover(ws[idx]));
  }
  // элемент работы i в текущем виде (с ним связаны анимации открытия и возврата)
  function roomEl(i, reveal) {
    if (RV === "karusel") return deckEls[i] || null;
    if (RV === "zhurnal" && zx()) return i === JP ? zx().el() : null;
    if (RV === "zhurnal") return i === JP ? (bookSingle ? $("pgR") : $("pgL")).querySelector(".pim") : null;
    var c = $("rlist").children[i]; if (!c) return null;
    if (reveal) {
      var m = $("roomMain"), r = c.getBoundingClientRect(), mr = m.getBoundingClientRect();
      if (r.top < mr.top + 80 || r.bottom > mr.bottom - 10) m.scrollTop += r.top - mr.top - (mr.height - r.height) / 2;
      c.classList.add("in");
    }
    return c;
  }
  function srcEl(w) {
    if (!S.room) return null;
    var i = S.room.works.indexOf(w); if (i < 0) return null;
    if (RV === "karusel" && Math.round(deckT) !== i) return null;
    var e = roomEl(i); if (!e) return null;
    var r = e.getBoundingClientRect();
    return r.width > 20 && r.bottom > 0 && r.top < innerHeight ? e : null;
  }

  // --- журнал: страница переворачивается ---
  // Широкий экран - разворот: слева фото, справа рассказ; лист переворачивается через корешок.
  // Телефон - одна страница (фото сверху, текст снизу), лист уходит влево. Можно тянуть пальцем/мышью.
  var JP = 0, flip = null, bookSingle = false;
  var bd = null, pend = { dir: 0, n: 0 }; // сколько ещё страниц перелистнуть после текущей (быстрые нажатия подряд)
  var BLANK = '<div class="paper"></div><i class="lsh"></i>';
  var ARR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  function bookSize() {
    var r = $("roomStage").getBoundingClientRect(), W = r.width - 28, H = r.height - 10, bw, bh;
    bookSingle = innerWidth <= 860 || W < 700;
    if (!bookSingle) { bw = Math.min(W, H * 1.5, 1180); bh = bw / 1.5; }
    else { bw = Math.min(W, H / 1.38, 540); bh = Math.min(H, bw * 1.45); }
    var b = $("book"); b.classList.toggle("single", bookSingle);
    b.style.width = Math.round(bw) + "px"; b.style.height = Math.round(bh) + "px";
  }
  function folio(i) { return '<div class="fol"><span>' + esc(S.room.nazvanie) + "</span><span>" + (i + 1) + " / " + S.room.works.length + "</span></div>"; }
  function pim(w, i) { return '<div class="pim" data-open="' + i + '"><img src="' + esc(cover(w)) + '" alt="" draggable="false" decoding="async">' + wmHTML(fotos(w)[0]) + "</div>"; }
  function jText(w) {
    var t = chist(w.rasskaz) || (w.resheniya || []).join(". "), ov = otzyvy(w)[0];
    return '<h3 class="ttl">' + esc(w.nazvanie) + '</h3><div class="mt">' + metaShort(w).map(function (c) { return "<span>" + esc(c) + "</span>"; }).join("") + "</div>" +
      '<div class="txt">' + esc(t) + (ov ? "<q>" + esc(ov.tekst) + "</q>" : "") + "</div>";
  }
  function jGo(i) { return '<button type="button" class="jgo" data-open="' + i + '">Смотреть работу' + ARR + "</button>"; }
  function pgPhoto(i) { var w = S.room.works[i]; return w ? '<div class="jp jph">' + folio(i) + pim(w, i) + '<div class="pcap">' + esc(w.gde || w.nazvanie) + "</div></div><i class=\"lsh\"></i>" : BLANK; }
  function pgText(i) { var w = S.room.works[i]; return w ? '<div class="jp jtx">' + folio(i) + jText(w) + jGo(i) + '</div><i class="lsh"></i>' : BLANK; }
  function pgOne(i) { var w = S.room.works[i]; return w ? '<div class="jp jph jtx jone">' + folio(i) + pim(w, i) + jText(w) + jGo(i) + '</div><i class="lsh"></i>' : BLANK; }
  // Страница рисуется заново, только если на ней должно быть другое (иначе браузер заново декодирует и
  // перерисовывает фото - это давало рывок в конце каждого переворота).
  function pgKey(t, i) { return S.room.id + ":" + t + ":" + i; }
  function pgSet(e, t, i) {
    var k = pgKey(t, i); if (e._k === k) return;
    e._k = k; e.innerHTML = t === "P" ? pgPhoto(i) : t === "T" ? pgText(i) : t === "O" ? pgOne(i) : BLANK;
  }
  // перенести готовое содержимое (уже декодированное фото) с листа на страницу под ним
  function pgMove(from, to) {
    if (!from._k) return;
    to.innerHTML = ""; while (from.firstChild) to.appendChild(from.firstChild);
    to._k = from._k; from._k = "";
  }
  // фото соседних страниц грузим и декодируем заранее, чтобы переворот не ждал картинку
  var PRE = {};
  function preload(i) {
    var ws = S.room && S.room.works;
    for (var d = -1; d <= 2; d++) {
      var w = ws && ws[i + d]; if (!w) continue;
      var src = cover(w); if (PRE[src]) continue;
      var im = new Image(); im.decoding = "async"; im.src = src; PRE[src] = im;
      if (im.decode) im.decode().catch(function () {});
      blurSrc(src, null, true);
    }
  }
  function bookStatic() {
    if (bookSingle) pgSet($("pgR"), "O", JP);
    else { pgSet($("pgL"), "P", JP); pgSet($("pgR"), "T", JP); }
    $("leaf").hidden = true; $("book").classList.remove("fl");
    var n = S.room.works.length, w = S.room.works[JP];
    S.ri = JP; updDots(JP, n); preload(JP);
    if (w) { setRoomBg(cover(w)); $("deckLive").textContent = "Страница " + (JP + 1) + " из " + n + ": " + w.nazvanie; }
    [].forEach.call($("book").querySelectorAll(".jgo"), function (b) { b.tabIndex = cur === "room" || !cur ? 0 : -1; });
  }
  // остановить переворот без последствий (сменили вид или комнату посреди анимации)
  function flipKill() {
    if (flip) { flip.done = flip.killed = true; (flip.anims || []).forEach(function (a) { a.cancel(); }); flip.anims = null; }
    pend.n = 0;
    flip = null; bd = null; $("book").classList.remove("drag");
  }
  // Свой показ журнала (window.VP_ZHURNAL задаёт слой оформления, например dizajn2/d2.js): вместо книги - "сцена".
  // Здесь остаются номер страницы, точки, фон комнаты и открытие работы; рисует и анимирует слой.
  function zx() { return window.VP_ZHURNAL || null; }
  function zxSync() {
    var n = S.room.works.length, w = S.room.works[JP];
    S.ri = JP; updDots(JP, n); preload(JP);
    if (w) { setRoomBg(cover(w)); $("deckLive").textContent = "Работа " + (JP + 1) + " из " + n + ": " + w.nazvanie; }
  }
  var ZAPI = {
    turn: function (dir) { turn(dir); },
    open: function (i) { var w = S.room && S.room.works[i]; if (w) { JP = i; S.ri = i; nav({ s: "work", w: w }); } },
    cover: cover, fotos: fotos, src: srcOf, wm: wmHTML, otzyvy: otzyvy, esc: esc, chist: chist, meta: metaShort,
    lite: function () { return LITE || reduce; }
  };
  function buildBook(idx, anim) {
    flipKill(); JP = Math.max(0, Math.min(S.room.works.length - 1, idx || 0));
    if (zx()) { setDots(S.room.works.length); zx().build(S.room, JP, !!anim && !reduce, ZAPI); zxSync(); return; }
    var b = $("book"); b.classList.remove("go", "wait");
    bookSize(); setDots(S.room.works.length); bookStatic();
    if (!anim || reduce) return;
    // появление начинаем, когда фото страницы уже декодировано (не дольше 0,4 с), - иначе анимация дёргается
    b.classList.add("wait");
    var ims = [].slice.call(b.querySelectorAll(".pg img")), go = false;
    var start = function () { if (go) return; go = true; b.classList.remove("wait"); void b.offsetWidth; b.classList.add("go"); perfWatch(900); };
    Promise.all(ims.map(function (im) { return im.decode ? im.decode().catch(function () {}) : null; })).then(start);
    setTimeout(start, 400);
  }
  function flipSetup(dir) {
    var to = JP + dir; if (to < 0 || to >= S.room.works.length) return null;
    var lf = $("leaf"), F = $("lfF"), B = $("lfB"), pr = $("pgR"), pl = $("pgL"), i = JP, f = { dir: dir, to: to, p: 0, under: pr };
    $("book").classList.remove("go", "wait");
    if (!bookSingle) {
      if (dir > 0) { lf.className = "leaf r"; pgMove(pr, F); pgSet(F, "T", i); pgSet(B, "P", to); pgSet(pr, "T", to); }
      else { lf.className = "leaf l"; pgMove(pl, F); pgSet(F, "P", i); pgSet(B, "T", to); pgSet(pl, "P", to); f.under = pl; }
    } else {
      lf.className = "leaf s"; pgSet(B, "-", 0);
      if (dir > 0) { pgMove(pr, F); pgSet(F, "O", i); pgSet(pr, "O", to); } else pgSet(F, "O", to);
    }
    f.fs = F.querySelector(".lsh"); f.bs = B.querySelector(".lsh"); f.us = LITE ? null : f.under.querySelector(".lsh");
    $("book").classList.add("fl");
    lf.hidden = false; flipApply(f, 0);
    return f;
  }
  // положение листа при прогрессе p (0..1): поворот, подъём, прозрачность, тени на сгибе
  function flipState(f, p) {
    var a, op = 1;
    if (!bookSingle) a = f.dir > 0 ? -180 * p : 180 * p;
    else { var q = f.dir > 0 ? p : 1 - p; a = -180 * q; op = q < .5 ? 1 : Math.max(0, 1 - (q - .5) / .38); }
    var t = Math.abs(a) / 180;
    return {
      tr: (LITE ? "" : "translateZ(" + (Math.sin(t * Math.PI) * 30).toFixed(1) + "px) ") + "rotateY(" + a.toFixed(2) + "deg)",
      op: op,
      fs: t < .5 ? Math.min(1, t * 2) : 0,
      bs: t > .5 ? Math.min(1, (1 - t) * 2) : 0,
      us: +(Math.sin(t * Math.PI) * .85 * (bookSingle && f.dir > 0 ? 1 - t * .5 : 1)).toFixed(3)
    };
  }
  function flipApply(f, p) {
    f.p = p;
    var s = flipState(f, p), lf = $("leaf");
    lf.style.transform = s.tr; lf.style.opacity = s.op;
    if (f.fs) f.fs.style.opacity = s.fs;
    if (f.bs) f.bs.style.opacity = s.bs;
    if (f.us) f.us.style.opacity = s.us;
  }
  // Переворот до конца (или назад) - анимацией браузера (Web Animations): она идёт в отдельном потоке
  // и остаётся плавной, даже если телефон в этот момент занят. Ключевые кадры считаем по той же формуле.
  function flipAnim(f, to, dur, cb) {
    var p0 = f.p, ease = to === 1 && p0 === 0 ? eSwift : eEase, lf = $("leaf");
    var fin = function () { if (f.done) return; f.done = true; (f.anims || []).forEach(function (a) { a.cancel(); }); f.anims = null; flipApply(f, to); cb(); };
    if (!lf.animate || dur < 30) { fin(); return; }
    var N = Math.max(8, Math.round(dur / 40)), kl = [], kf = [], kb = [], ku = [];
    for (var j = 0; j <= N; j++) {
      var s = flipState(f, p0 + (to - p0) * ease(j / N));
      kl.push({ transform: s.tr, opacity: s.op }); kf.push({ opacity: s.fs }); kb.push({ opacity: s.bs }); ku.push({ opacity: s.us });
    }
    var o = { duration: dur, easing: "linear", fill: "forwards" };
    f.anims = [lf.animate(kl, o)];
    if (f.fs) f.anims.push(f.fs.animate(kf, o));
    if (f.bs) f.anims.push(f.bs.animate(kb, o));
    if (f.us) f.anims.push(f.us.animate(ku, o));
    f.done = false;
    f.anims[0].onfinish = fin;
    setTimeout(fin, dur / (f.rate || 1) + 600); // на случай, если вкладку свернули посреди переворота
    perfWatch(Math.min(dur, 700));
  }
  function flipEnd(f, done) {
    if (done) {
      JP = f.to;
      // то, что лежит на перевёрнутом листе, становится страницей - без перерисовки
      if (!bookSingle) pgMove($("lfB"), f.dir > 0 ? $("pgL") : $("pgR"));
      else if (f.dir < 0) pgMove($("lfF"), $("pgR"));
    } else if (!bookSingle || f.dir > 0) pgMove($("lfF"), f.dir < 0 && !bookSingle ? $("pgL") : $("pgR")); // передумали - лист возвращается на место
    flip = null; bookSize(); bookStatic(); // размер - вдруг повернули телефон посреди переворота
    if (pend.n > 0 && !f.killed) { pend.n--; turn(pend.dir, true); } else pend.n = 0;
  }
  function bump(dir) {
    var b = $("book"); if (reduce || !b.animate) return;
    b.animate([{ transform: "translate(-50%,-50%)" }, { transform: "translate(-50%,-50%) translateX(" + (-dir * 12) + "px) rotateY(" + (dir * 5) + "deg)" }, { transform: "translate(-50%,-50%)" }], { duration: 420, easing: EASE });
    toast(dir > 0 ? "Это последняя страница" : "Это первая страница");
  }
  function turn(dir, quick) {
    if (RV !== "zhurnal") return;
    if (zx()) {
      var zn = S.room.works.length;
      if (JP + dir < 0 || JP + dir >= zn) { zx().bump(dir); toast(dir > 0 ? "Это последняя работа" : "Это первая работа"); return; }
      if (zx().go(JP + dir, dir) === false) return; // сцена ещё занята прошлым переходом
      JP += dir; zxSync(); return;
    }
    if (flip) {
      // нажали ещё раз во время переворота: этот лист докручиваем быстрее, следующий - сразу за ним
      if (flip.anims && !bd && flip.dir === dir) {
        var left = dir > 0 ? S.room.works.length - 1 - flip.to : flip.to;
        if (pend.dir !== dir) pend.n = 0;
        pend.dir = dir; pend.n = Math.min(left, pend.n + 1);
        flip.rate = 2; flip.anims.forEach(function (a) { a.playbackRate = 2; });
      }
      return;
    }
    var f = flipSetup(dir); if (!f) { bump(dir); return; }
    flip = f;
    if (reduce) { $("book").animate && $("book").animate([{ opacity: .4 }, { opacity: 1 }], { duration: 250 }); flipApply(f, 1); flipEnd(f, true); return; }
    flipAnim(f, 1, quick ? 560 : LITE ? 720 : 860, function () { flipEnd(f, true); });
  }
  function openPage() { var w = S.room && S.room.works[JP]; if (w && !flip) { S.ri = JP; nav({ s: "work", w: w }); } }
  $("book").addEventListener("pointerdown", function (e) {
    if (e.button > 0 || flip) return;
    bd = { x: e.clientX, y: e.clientY, id: e.pointerId, m: false, t: performance.now(), lx: e.clientX, v: 0, tgt: e.target };
  });
  $("book").addEventListener("pointermove", function (e) {
    if (!bd || e.pointerId !== bd.id) return;
    var dx = e.clientX - bd.x;
    if (!bd.m) {
      if (Math.abs(dx) < 9 || Math.abs(dx) < Math.abs(e.clientY - bd.y)) return;
      var f = flipSetup(dx < 0 ? 1 : -1);
      if (!f) { var d0 = dx < 0 ? 1 : -1; bd = null; bump(d0); return; }
      bd.m = true; bd.f = flip = f; $("book").classList.add("drag");
      try { $("book").setPointerCapture(bd.id); } catch (er) {}
    }
    var now = performance.now(); bd.v = (e.clientX - bd.lx) / Math.max(1, now - bd.t); bd.lx = e.clientX; bd.t = now;
    var w = $("book").offsetWidth * (bookSingle ? 1 : .5);
    flipApply(bd.f, Math.max(0, Math.min(1, (bd.f.dir > 0 ? -dx : dx) / (w * 1.05))));
  });
  function bookUp(e) {
    if (!bd || e.pointerId !== bd.id) return;
    var b = bd; bd = null; $("book").classList.remove("drag");
    if (b.m) {
      var fl = performance.now() - b.t < 120 ? -b.v * b.f.dir : 0, done = e.type === "pointerup" && (b.f.p > .33 || fl > .35);
      flipAnim(b.f, done ? 1 : 0, Math.round(220 + 480 * (done ? 1 - b.f.p : b.f.p)), function () { flipEnd(b.f, done); });
      return;
    }
    if (e.type !== "pointerup") return;
    // нажатие: фото или кнопка - открыть работу; иначе правая половина - дальше, левая - назад
    if (b.tgt.closest && b.tgt.closest("[data-open]")) { openPage(); return; }
    var r = $("book").getBoundingClientRect();
    turn(e.clientX > r.left + r.width / 2 ? 1 : -1);
  }
  $("book").addEventListener("pointerup", bookUp); $("book").addEventListener("pointercancel", bookUp);
  $("book").addEventListener("click", function (e) { if (e.detail === 0 && e.target.closest("[data-open]")) openPage(); }); // клавиатура
  var bWheel = 0, bWheelT = 0;
  $("book").addEventListener("wheel", function (e) {
    e.preventDefault();
    var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY, now = performance.now();
    if (now - bWheelT > 300) bWheel = 0;
    bWheel += d;
    if (Math.abs(bWheel) > 50 && now - bWheelT > 300 && !flip) { turn(bWheel > 0 ? 1 : -1); bWheel = 0; bWheelT = now; }
  }, { passive: false });
  $("roomBack").onclick = function () { up(); };

  // ---------- 3. работа: сцена, масштаб, точки ----------
  // Фото по умолчанию целиком - вписано в свободную часть экрана (не под панелями и кнопками).
  // Масштаб: колесо, щипок, кнопки +/-, двойное нажатие. Одно нажатие по фото убирает все панели (или возвращает).
  var st = { s: 1, x: 0, y: 0, base: 1, min: 1, max: 4, iw: 1200, ih: 900 }, note = -1, pano = false, tw = null, glide = null, wRaf = 0;
  var bare = false, sheetMode = "compact"; // compact | open | hidden
  var stage = $("stage"), wImg = $("wImg");
  function pts() { var w = S.work; if (!w) return []; return S.foto === 0 ? (w.tochki || []) : ((fotos(w)[S.foto] || {}).tochki || []); }
  var wide = function () { return innerWidth > 860; };
  // свободная часть экрана, куда вписываем фото
  function view() {
    var W = innerWidth, H = innerHeight;
    if (bare) return { l: 0, t: 0, r: W, b: H };
    if (pano) {
      var pm = wide() ? 24 : 0, pt = $("workTop").offsetHeight || 70, pb = ($("workUi").offsetHeight || 46) + (wide() ? 36 : 28);
      return { l: pm, t: pt, r: W - pm, b: Math.max(pt + 160, H - pb) };
    }
    var m = wide() ? Math.max(12, Math.min(24, W * .02)) : 10;
    var top = $("workTop").offsetHeight;
    var ui = $("workUi").offsetHeight || 46;
    if (wide()) {
      var r = sheetMode === "hidden" ? W - 48 : W - $("sheet").offsetWidth - m * 2;
      return { l: m, t: top, r: Math.max(m + 200, r), b: H - ui - m * 2 };
    }
    var sh = sheetMode === "hidden" ? 48 : sheetH;
    return { l: 0, t: top, r: W, b: Math.max(top + 160, H - sh - ui - 30) };
  }
  function clampSt(o) {
    var v = bare ? { l: 0, t: 0, r: innerWidth, b: innerHeight } : view(), w = st.iw * o.s, h = st.ih * o.s, vw = v.r - v.l, vh = v.b - v.t;
    // увеличенное фото может заходить под панели, но не дальше краёв экрана
    var L = w > vw ? 0 : v.l, R = w > vw ? innerWidth : v.r, T0 = h > vh ? 0 : v.t, B = h > vh ? innerHeight : v.b;
    if (w > vw && w <= innerWidth) { L = v.l; R = v.r; }
    if (h > vh && h <= innerHeight) { T0 = v.t; B = v.b; }
    o.x = w <= R - L ? L + (R - L - w) / 2 : Math.min(L, Math.max(R - w, o.x));
    o.y = h <= B - T0 ? T0 + (B - T0 - h) / 2 : Math.min(T0, Math.max(B - h, o.y));
    return o;
  }
  var lastLvl = "";
  function applySt() {
    stage.style.transform = "translate(" + st.x + "px," + st.y + "px) scale(" + st.s + ")";
    var P = pts();
    [].forEach.call($("spots").children, function (b, i) {
      var t = P[i]; if (!t) return;
      b.style.transform = "translate(" + (st.x + st.iw * st.s * t.x / 100) + "px," + (st.y + st.ih * st.s * t.y / 100) + "px)";
    });
    var fit = st.s <= st.base * 1.01, l = fit ? "Целиком" : Math.round(st.s / st.base * 100) + "%";
    if (l !== lastLvl) {
      lastLvl = l; $("zLvl").textContent = l;
      $("zOut").disabled = fit; $("zIn").disabled = st.s >= st.max * .99;
      $("zLvl").setAttribute("aria-label", fit ? "Фото целиком" : "Масштаб " + l + ", показать целиком");
    }
  }
  function wKick() { if (!wRaf) wRaf = requestAnimationFrame(wFrame); }
  function wFrame(now) {
    wRaf = 0;
    if (tw) {
      var p = tw.dur ? Math.min(1, (now - tw.t0) / tw.dur) : 1, e = tw.ease(p);
      st.s = tw.a.s + (tw.b.s - tw.a.s) * e; st.x = tw.a.x + (tw.b.x - tw.a.x) * e; st.y = tw.a.y + (tw.b.y - tw.a.y) * e;
      if (p >= 1) { var cb = tw.done; tw = null; if (cb) cb(); }
    } else if (glide) {
      glide.vx *= 0.92; glide.vy *= 0.92;
      var o = clampSt({ s: st.s, x: st.x + glide.vx * 16, y: st.y + glide.vy * 16 });
      if (o.x !== st.x + glide.vx * 16) glide.vx = 0; if (o.y !== st.y + glide.vy * 16) glide.vy = 0;
      st.x = o.x; st.y = o.y;
      if (Math.abs(glide.vx) + Math.abs(glide.vy) < 0.02) glide = null;
    }
    applySt();
    if (tw || glide) wKick();
  }
  function animTo(o, dur, ease, done, noClamp) {
    glide = null;
    var b = noClamp ? o : clampSt({ s: o.s, x: o.x, y: o.y });
    if (!dur || reduce) { st.s = b.s; st.x = b.x; st.y = b.y; tw = null; applySt(); if (done) done(); return; }
    tw = { t0: performance.now(), dur: dur, a: { s: st.s, x: st.x, y: st.y }, b: b, ease: ease || eEase, done: done };
    wKick();
  }
  // "целиком": фото вписано в свободную часть; в обзоре - заполняет экран с запасом, чтобы было куда тянуть
  function restSt() {
    var W = innerWidth, H = innerHeight;
    var v = view();
    st.base = st.min = Math.min((v.r - v.l) / st.iw, (v.b - v.t) / st.ih);
    st.max = Math.max(st.base * 5, Math.max(W / st.iw, H / st.ih) * 2.5);
    sizeWM();
    return clampSt({ s: st.base, x: 0, y: 0 });
  }
  function sizeWM() { $("wWm").style.backgroundSize = (420 / Math.max(.1, st.base)) + "px auto"; }
  // заново вписать (после смены панелей): если фото было целиком - плавно к новому "целиком", иначе только поджать к краям
  function refit(dur) {
    if (cur !== "work") return;
    var wasFit = st.s <= st.base * 1.02, old = { s: st.s, x: st.x, y: st.y };
    var r = restSt();
    if (note >= 0) { var n = note; note = -1; focusSpot(n); return; }
    if (wasFit) animTo(r, dur == null ? 650 : dur, eEase);
    else { var o = clampSt({ s: Math.max(st.min, old.s), x: old.x, y: old.y }); animTo(o, dur == null ? 650 : dur, eEase); }
  }
  function zoomAt(s, px, py, dur) {
    s = Math.max(st.min, Math.min(st.max, s));
    var cx = (px - st.x) / st.s, cy = (py - st.y) / st.s;
    var o = { s: s, x: px - cx * s, y: py - cy * s };
    if (dur) animTo(o, dur, eEase); else { tw = null; glide = null; o = clampSt(o); st.s = o.s; st.x = o.x; st.y = o.y; applySt(); }
    $("dragHint").classList.add("gone"); panoHint(false);
  }
  function vCenter() { var v = view(); return { x: (v.l + v.r) / 2, y: (v.t + v.b) / 2 }; }
  function zoomStep(dir) {
    if (note >= 0) closeNote(true);
    var c = vCenter(), s = dir > 0 ? st.s * 1.6 : st.s / 1.6;
    if (dir < 0 && s < st.base * 1.08) { animTo(restSt(), 450, eEase); pill("Целиком"); return; }
    zoomAt(s, c.x, c.y, 380);
    pill(Math.round(Math.max(st.min, Math.min(st.max, s)) / st.base * 100) + "%");
  }
  function pill(t) { var p = $("zPill"); p.textContent = t; p.classList.add("on"); clearTimeout(pill.t); pill.t = setTimeout(function () { p.classList.remove("on"); }, 700); }
  $("zIn").onclick = function () { zoomStep(1); };
  $("zOut").onclick = function () { zoomStep(-1); };
  $("zLvl").onclick = function () { if (note >= 0) closeNote(true); animTo(restSt(), 500, eEase); };

  function setFotoImg(f, cb) {
    var src = srcOf(f);
    loadImg(src, function (sz) {
      st.iw = sz.w; st.ih = sz.h;
      stage.style.width = sz.w + "px"; stage.style.height = sz.h + "px";
      wImg.src = src; wImg.alt = (f && f.podpis) || (S.work && S.work.nazvanie) || "";
      $("wWm").style.backgroundImage = WM && !(f && f.znak) ? WM : "none";
      cb && cb(sz);
    });
  }
  function renderSpots() {
    var sp = $("spots"); sp.innerHTML = ""; $("sDetails").innerHTML = "";
    var P = pts();
    P.forEach(function (t, i) {
      var b = el("button", "spot", "<i></i>" + IC.plus); b.type = "button"; b.setAttribute("aria-label", "Деталь: " + t.nazvanie);
      b.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      b.onclick = function (e) { e.stopPropagation(); focusSpot(i); };
      sp.appendChild(b);
      var d = el("button", "", "<i>" + (i + 1) + "</i>" + esc(t.nazvanie)); d.type = "button"; d.onclick = function () { focusSpot(i); };
      $("sDetails").appendChild(d);
    });
    $("sDetWrap").hidden = !P.length;
    sp.classList.toggle("off", pano);
  }
  // служебные пометки из черновика ("Название рабочее, уточнить у мастера", "дополнит мастер" и т.п.) клиенту не показываем:
  // такие предложения убираются только при показе, в данных у мастера они остаются
  var SLUZH = /(уточнить у мастера|дополнит мастер|заполнит мастер|название рабочее|из альбома мастера|фото из альбома|уточнить название)/i;
  function chist(t) {
    t = String(t || "").trim(); if (!t) return "";
    return (t.match(/[^.!?]+[.!?]*/g) || [t]).filter(function (x) { return x.trim() && !SLUZH.test(x); }).join("").trim();
  }
  // поля описания из Мастерской: [подпись, текст], пустые не показываем
  function godT(w) { var g = String(w.god || "").trim(); return g ? g + (/^\d{4}$/.test(g) ? " год" : "") : ""; }
  function spec(w) {
    return [["Материалы", w.material], ["Цвет и отделка", w.cvet], ["Размеры", w.razmery], ["Год", godT(w)]]
      .map(function (r) { return [r[0], chist(r[1])]; }).filter(function (r) { return r[1]; });
  }
  // короткая строка под названием в журнале: длинные описания (целое предложение про материалы) туда не идут
  function metaShort(w) { return [w.gde, w.material, w.cvet, w.razmery, godT(w), w.srok ? "Срок: " + w.srok : ""].filter(function (x) { return x && String(x).length <= 40; }); }
  function renderSheet(w) {
    $("sheetSc").scrollTop = 0;
    $("sVid").textContent = w._k.nazvanie;
    $("sTitle").textContent = w.nazvanie;
    $("sChips").innerHTML = [w.gde, w.srok ? "Срок: " + w.srok : ""].filter(Boolean).map(function (c) { return "<span>" + esc(c) + "</span>"; }).join("");
    $("sChips").hidden = !$("sChips").innerHTML;
    var rk = chist(w.rasskaz);
    $("sStory").textContent = rk; $("sStoryWrap").hidden = !rk;
    var sp = spec(w);
    $("sSpec").innerHTML = sp.map(function (r) { return "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>"; }).join(""); $("sSpecWrap").hidden = !sp.length;
    var rs = w.resheniya || [];
    $("sSol").innerHTML = rs.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join(""); $("sSolWrap").hidden = !rs.length;
    var ov = otzyvy(w);
    $("sRevWrap").hidden = !ov.length;
    $("sRev").innerHTML = ov.map(function (o) {
      var n = Math.max(1, Math.min(5, Math.round(+o.ocenka || 5)));
      return '<div class="review"><q>' + esc(o.tekst) + '</q><div class="by"><span><b>' + esc(o.imya || "") + '</b> <span class="st" aria-label="Оценка ' + n + ' из 5">' + "★★★★★".slice(0, n) + "</span></span>" + (o.kod && o.zakaz ? '<span class="ok">по заказу ' + esc(o.zakaz) + "</span>" : "") + "</div></div>";
    }).join("");
    var F = w.foto || [];
    $("sFotoWrap").hidden = F.length < 2;
    $("sThumbs").innerHTML = F.length < 2 ? "" : F.map(function (f, i) { return '<button type="button" data-foto="' + i + '" aria-label="Фото ' + (i + 1) + (f && f.podpis ? ": " + esc(f.podpis) : "") + '"><img src="' + esc(srcOf(f)) + '" alt="" loading="lazy" draggable="false"></button>'; }).join("");
    markThumbs();
    // нечего разворачивать - кнопки "Подробнее" нет
    var any = [].some.call($("sheetSc").children, function (c) { return !c.hidden; });
    $("sheetMore").hidden = !any;
    if (!any && sheetMode === "open") setSheet("compact", true);
    measureSheet();
  }
  // высота компактной панели на телефоне: под неё не заходит фото и над ней стоят кнопки
  var sheetH = 150;
  function measureSheet() {
    var sh = $("sheet"), h = $("sheetHead").offsetHeight + sh.querySelector(".sheet-foot").offsetHeight + 2;
    if (h > 40) { sheetH = h; $("work").style.setProperty("--sh", h + "px"); }
  }
  function markThumbs() {
    [].forEach.call($("sThumbs").children, function (b, i) { b.classList.toggle("on", i === S.foto); });
    var f = fotos(S.work)[S.foto];
    $("sCap").textContent = (S.work.foto || []).length > 1 ? "Фото " + (S.foto + 1) + " из " + S.work.foto.length + (f && f.podpis ? ": " + f.podpis : "") : "";
    navArrows();
  }
  $("sThumbs").addEventListener("click", function (e) { var b = e.target.closest("[data-foto]"); if (b) showFoto(+b.getAttribute("data-foto")); });
  function showFoto(i) {
    var F = fotos(S.work); i = (i + F.length) % F.length; if (i === S.foto) return;
    closeNote(true);
    stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(220), fill: "forwards" }).onfinish = function () {
      S.foto = i;
      setFotoImg(F[i], function () {
        var r = restSt(); st.s = r.s; st.x = r.x; st.y = r.y; renderSpots(); applySt(); markThumbs();
        stage.getAnimations().forEach(function (a) { a.cancel(); });
        stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T(420), easing: EASE });
      });
    };
  }
  function focusSpot(i) {
    var t = pts()[i]; if (!t) return;
    if (note === i) { closeNote(); return; }
    note = i;
    $("noteT").textContent = t.nazvanie; $("noteD").textContent = t.tekst || "";
    $("note").classList.add("on");
    [].forEach.call($("spots").children, function (b, j) { b.classList.toggle("on", j === i); });
    [].forEach.call($("sDetails").children, function (b, j) { b.classList.toggle("on", j === i); });
    var v = view(), cx = (v.l + v.r) / 2, cy = (v.t + v.b) / 2;
    if (!wide()) { var nb = $("note").offsetTop + $("note").offsetHeight; cy = (Math.max(v.t, nb) + v.b) / 2; }
    var s = Math.min(st.max, st.base * 2.4);
    animTo({ s: s, x: cx - st.iw * s * t.x / 100, y: cy - st.ih * s * t.y / 100 }, 900, eEase);
    $("dragHint").classList.add("gone");
  }
  function closeNote(quiet) {
    if (note < 0 && !$("note").classList.contains("on")) return;
    note = -1; $("note").classList.remove("on");
    [].forEach.call($("spots").children, function (b) { b.classList.remove("on"); });
    [].forEach.call($("sDetails").children, function (b) { b.classList.remove("on"); });
    if (cur === "work" && !quiet) animTo(restSt(), 800, eEase);
  }
  $("noteX").onclick = function () { closeNote(); };

  // ----- жесты на фото: тянуть, щипок, двойное нажатие, одно нажатие - убрать/вернуть панели -----
  var ptrs = {}, nP = 0, pd = null, pinch = null, lastTap = null, tapTimer = 0;
  function two() { var a = []; for (var k in ptrs) a.push(ptrs[k]); return a; }
  function startPinch() {
    var a = two(); if (a.length < 2) return;
    pinch = { d: Math.max(20, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)), mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2, s: st.s, x: st.x, y: st.y };
    pd = null; lastTap = null; clearTimeout(tapTimer);
    $("dragHint").classList.add("gone");
  }
  $("area").addEventListener("pointerdown", function (e) {
    if (e.button > 0 || cur !== "work") return;
    if (!ptrs[e.pointerId]) nP++;
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    tw = null; glide = null;
    try { $("area").setPointerCapture(e.pointerId); } catch (er) {}
    if (nP >= 2) startPinch();
    else pd = { x: e.clientX, y: e.clientY, sx: st.x, sy: st.y, m: false, id: e.pointerId, lt: performance.now(), vx: 0, vy: 0, swipe: false, fit: st.s <= st.base * 1.02 && !pano };
  });
  $("area").addEventListener("pointermove", function (e) {
    if (!ptrs[e.pointerId]) return;
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (pinch) {
      var a = two(); if (a.length < 2) return;
      var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
      var s = pinch.s * d / pinch.d;
      // за пределами - с сопротивлением, после отпускания вернётся
      if (s < st.min) s = st.min * Math.pow(s / st.min, .35); else if (s > st.max) s = st.max * Math.pow(s / st.max, .35);
      st.s = s; st.x = mx - (pinch.mx - pinch.x) * (s / pinch.s); st.y = my - (pinch.my - pinch.y) * (s / pinch.s);
      applySt(); return;
    }
    if (!pd || e.pointerId !== pd.id) return;
    var dx = e.clientX - pd.x, dy = e.clientY - pd.y;
    if (!pd.m && Math.abs(dx) + Math.abs(dy) > 8) {
      pd.m = true; $("work").classList.add("dragging"); $("dragHint").classList.add("gone");
      pd.swipe = pd.fit && Math.abs(dx) > Math.abs(dy) && WORKS.length > 1;
    }
    if (!pd.m) return;
    if (pd.swipe) { st.x = pd.sx + dx * .55; applySt(); return; } // фото целиком: листаем работы
    var now = performance.now(), o = clampSt({ s: st.s, x: pd.sx + dx, y: pd.sy + dy }), dtt = Math.max(1, now - pd.lt);
    pd.vx = (o.x - st.x) / dtt; pd.vy = (o.y - st.y) / dtt; pd.lt = now;
    st.x = o.x; st.y = o.y; applySt();
  });
  function areaUp(e) {
    if (!ptrs[e.pointerId]) return;
    delete ptrs[e.pointerId]; nP = Math.max(0, nP - 1);
    if (pinch) {
      if (nP < 2) {
        pinch = null;
        var s = Math.max(st.min, Math.min(st.max, st.s)), c = vCenter();
        if (s <= st.base * 1.04) animTo(restSt(), 380, eEase);
        else { var a = two()[0], px = a ? a.x : c.x, py = a ? a.y : c.y; zoomAt(s, px, py, 300); }
        pd = null; // оставшийся палец больше ничего не делает до следующего касания
      }
      return;
    }
    if (!pd || e.pointerId !== pd.id) return;
    var p = pd; pd = null; $("work").classList.remove("dragging");
    if (p.m) {
      if (p.swipe) {
        var dx = e.clientX - p.x;
        if (Math.abs(dx) > Math.min(90, innerWidth * .18) && e.type === "pointerup") stepWork(dx < 0 ? 1 : -1);
        else animTo(restSt(), 380, eEase);
      } else if (!reduce && performance.now() - p.lt < 90) { glide = { vx: p.vx, vy: p.vy }; wKick(); }
      return;
    }
    if (e.type !== "pointerup") return;
    var now = performance.now(), x = e.clientX, y = e.clientY;
    if (lastTap && now - lastTap.t < 320 && Math.hypot(x - lastTap.x, y - lastTap.y) < 40) {
      // двойное нажатие: крупно в эту точку / обратно целиком
      clearTimeout(tapTimer); lastTap = null;
      if (note >= 0) closeNote(true);
      if (st.s > st.base * 1.05) animTo(restSt(), 500, eEase);
      else { zoomAt(st.base * 2.5, x, y, 500); }
      return;
    }
    lastTap = { t: now, x: x, y: y };
    clearTimeout(tapTimer);
    tapTimer = setTimeout(function () { lastTap = null; if (note >= 0) closeNote(); else if (!pano) setBare(!bare); else panoHint(false); }, 300);
  }
  $("area").addEventListener("pointerup", areaUp); $("area").addEventListener("pointercancel", areaUp);
  // Колесо мыши - приблизить/отдалить. Тачпад ноутбука: щипок (браузер присылает его как колесо с Ctrl) - масштаб,
  // движение двумя пальцами - двигать увеличенное фото. Тачпад узнаём по мелким шагам и боковому сдвигу.
  var padT = 0;
  function isPad(e) {
    var now = performance.now();
    if (e.deltaMode === 0 && (Math.abs(e.deltaX) > 0.5 || (Math.abs(e.deltaY) < 40 && e.deltaY % 1 !== 0) || Math.abs(e.deltaY) < 16)) padT = now;
    return now - padT < 400;
  }
  $("area").addEventListener("wheel", function (e) {
    if (cur !== "work") return;
    e.preventDefault();
    var k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1, dy = e.deltaY * k, dx = e.deltaX * k;
    if (note >= 0) closeNote(true);
    if (!e.ctrlKey && isPad(e)) {
      if (st.s > st.base * 1.02) {
        tw = null; glide = null;
        var o = clampSt({ s: st.s, x: st.x - dx, y: st.y - dy }); st.x = o.x; st.y = o.y; applySt(); panoHint(false);
      } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 2) {
        // фото целиком: два пальца вверх-вниз тоже приближают, чтобы было понятно, что можно
        zoomAt(st.s * Math.exp(-dy * .006), e.clientX, e.clientY);
      }
      return;
    }
    zoomAt(st.s * Math.exp(-dy * (e.ctrlKey ? .01 : .0022)), e.clientX, e.clientY);
  }, { passive: false });
  // Safari на Mac: щипок тачпада приходит отдельными событиями
  var gS = 0;
  $("area").addEventListener("gesturestart", function (e) { e.preventDefault(); gS = st.s; });
  $("area").addEventListener("gesturechange", function (e) { e.preventDefault(); if (cur === "work") zoomAt(gS * e.scale, e.clientX || innerWidth / 2, e.clientY || innerHeight / 2); });
  $("area").addEventListener("gestureend", function (e) { e.preventDefault(); });
  addEventListener("resize", function () {
    if (cur === "work") { measureSheet(); var r = restSt(); tw = null; st.s = r.s; st.x = r.x; st.y = r.y; if (note >= 0) { var n = note; note = -1; focusSpot(n); } else applySt(); }
    if (cur === "room") {
      markViews(RV, true);
      if (RV === "karusel") deckRender();
      else if (RV === "zhurnal" && !flip) { bookSize(); bookStatic(); }
    }
  });

  // ----- панели: убрать всё / вернуть; описание: компактно / подробно / убрано -----
  function setBare(on) {
    bare = on; $("work").classList.toggle("bare", on);
    if (on) { closeNote(true); $("dragHint").classList.add("gone"); }
    if (kbd) (on ? $("uiShow") : $("uiTg")).focus({ preventScroll: true });
    refit(700);
  }
  $("uiTg").onclick = function () { setBare(true); };
  $("uiShow").onclick = function () { setBare(false); };
  function setSheet(mode, quiet) {
    var was = sheetMode; sheetMode = mode;
    var sh = $("sheet"), wk = $("work");
    sh.classList.toggle("open", mode === "open"); sh.classList.toggle("hide", mode === "hidden");
    wk.classList.toggle("sh-open", mode === "open"); wk.classList.toggle("sh-hidden", mode === "hidden");
    $("sheetMore").setAttribute("aria-expanded", mode === "open" ? "true" : "false");
    $("sheetMore").firstChild.textContent = mode === "open" ? "Свернуть" : "Подробнее";
    sh.inert = mode === "hidden";
    if (mode !== "open") $("sheetSc").scrollTop = 0;
    // на широком экране колонка описания та же в любом виде - фото не двигаем; убрали панель - фото расширяется
    if (!quiet && (was === "hidden" || mode === "hidden" || !wide())) refit(650);
    if (!quiet && kbd) (mode === "hidden" ? $("sheetTab") : $("sheetMore")).focus({ preventScroll: true });
  }
  $("sheetMore").onclick = function (e) { e.stopPropagation(); setSheet(sheetMode === "open" ? "compact" : "open"); };
  $("sheetHide").onclick = function (e) { e.stopPropagation(); setSheet("hidden"); };
  $("sheetTab").onclick = function () { setSheet("compact"); };
  // нажатие на шапку окна: развёрнуто - свернуть, компактно - убрать за край; на телефоне ещё и смахивание
  var hd = null;
  $("sheetHead").addEventListener("pointerdown", function (e) { hd = { y: e.clientY, t: performance.now() }; });
  $("sheetHead").addEventListener("pointerup", function (e) {
    if (!hd) return; var dy = e.clientY - hd.y; hd = null;
    if (Math.abs(dy) < 30) return;
    hd = "swipe";
    if (dy < 0) setSheet("open"); else setSheet(sheetMode === "open" ? "compact" : "hidden");
  });
  $("sheetHead").addEventListener("click", function (e) {
    if (hd === "swipe") { hd = null; return; }
    if (e.target.closest("button")) return;
    // слой оформления (window.VP_RUCHKA, "Просто" на телефоне): у панели одна ручка - нажатие разворачивает и сворачивает,
    // убрать панель совсем - смахнуть вниз
    if (window.VP_RUCHKA && !wide() && !$("sheetMore").hidden) { setSheet(sheetMode === "open" ? "compact" : "open"); return; }
    setSheet(sheetMode === "open" ? "compact" : "hidden");
  });

  function fillWork(w) {
    S.work = w; S.room = w._k; S.foto = Math.min(NEXT_FOTO || 0, Math.max(0, (w.foto || []).length - 1)); NEXT_FOTO = 0; note = -1;
    if (cur !== "work") { pano = false; $("work").classList.remove("pano"); panoHint(false); } // в обзоре листаем работы, не выходя из него
    $("note").classList.remove("on");
    renderSheet(w); renderSpots(); crumbs($("crumbsW"), 2); mini($("miniW"));
    $("wantBtn").textContent = window.VP_HOCHU || "Хочу так же";
  }
  // панели выезжают каждая со своего края
  function chromeIn(delay) {
    if (reduce || !$("work").animate) return;
    var o = { duration: 700, delay: delay || 0, easing: EASE, fill: "backwards" };
    $("workTop").animate([{ opacity: 0, transform: "translateY(-24px)" }, { opacity: 1, transform: "none" }], o);
    $("workUi").animate([{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }], o);
    if (sheetMode !== "hidden") $("sheet").animate([{ opacity: 0, transform: wide() ? "translateX(60px)" : "translateY(60px)" }, { opacity: 1, transform: "none" }], { duration: 800, delay: (delay || 0) + 80, easing: EASE, fill: "backwards" });
  }
  var HINT = "vp-zoom-hint";
  function zoomHint() {
    var h = $("dragHint"); h.classList.remove("gone");
    var n = 0; try { n = +localStorage.getItem(HINT) || 0; localStorage.setItem(HINT, n + 1); } catch (e) {}
    if (n >= 3) { h.classList.add("gone"); return; }
    if (!wide() && n < 2) setTimeout(function () { if (cur === "work") toast("Щипок или двойное нажатие - приблизить"); }, 1200);
    clearTimeout(zoomHint.t); zoomHint.t = setTimeout(function () { h.classList.add("gone"); }, 6000);
  }
  // открыть работу: из карточки ленты (разворот рамки на весь экран) или просто проявлением
  function openWork(w, fromCard, done) {
    fillWork(w);
    setFotoImg(fotos(w)[S.foto], function (sz) {
      measureSheet();
      var r = restSt();
      zoomHint();
      if (fromCard && !reduce && $("work").animate) {
        var c = fromCard.getBoundingClientRect(), a = coverBox(sz, c.left, c.top, c.width, c.height);
        st.s = a.s; st.x = a.x; st.y = a.y; applySt();
        $("spots").style.opacity = 0;
        show("work", true);
        $("work").animate([{ clipPath: "inset(" + c.top + "px " + (innerWidth - c.right) + "px " + (innerHeight - c.bottom) + "px " + c.left + "px round 22px)" }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], { duration: 800, easing: SWIFT });
        chromeIn(380);
        animTo(r, 800, eSwift, function () { $("spots").style.opacity = ""; $("spots").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 }); done && done(); }, true);
      } else {
        st.s = r.s; st.x = r.x; st.y = r.y; applySt();
        show("work");
        stage.animate([{ opacity: 0, transform: stage.style.transform + " scale(1.04)" }, { opacity: 1, transform: stage.style.transform }], { duration: T(700), easing: EASE });
        chromeIn(200);
        done && done();
      }
    });
  }
  // назад в комнату: кадр сжимается обратно в свою карточку
  function closeWorkToRoom(k, done) {
    var w = S.work, i = k.works.indexOf(w);
    renderRoom(k, i < 0 ? 0 : i, false);
    var card = i >= 0 ? roomEl(i, true) : null;
    closeNote(true);
    if (!card || reduce || !$("work").animate) { show("room"); done && done(); return; }
    $("room").classList.add("inst"); $("room").classList.add("on"); $("room").inert = false; $("room").removeAttribute("aria-hidden");
    var c = card.getBoundingClientRect(), a = coverBox({ w: st.iw, h: st.ih }, c.left, c.top, c.width, c.height);
    $("work").classList.add("closing");
    $("spots").style.opacity = 0;
    var an = $("work").animate([{ clipPath: "inset(0px 0px 0px 0px round 0px)" }, { clipPath: "inset(" + c.top + "px " + (innerWidth - c.right) + "px " + (innerHeight - c.bottom) + "px " + c.left + "px round 22px)" }], { duration: 700, easing: SWIFT, fill: "forwards" });
    animTo(a, 700, eSwift, null, true);
    an.onfinish = function () {
      show("room", true); an.cancel(); $("work").classList.remove("closing"); $("spots").style.opacity = "";
      restart($("room"), "enter");
      done && done();
    };
  }
  function switchWork(w, dir) {
    closeNote(true);
    var sg = stage, dx = (dir || 1) * 60;
    sg.getAnimations().forEach(function (a) { a.cancel(); });
    sg.animate([{ opacity: 1, transform: sg.style.transform }, { opacity: 0, transform: "translateX(" + (-dx) + "px) " + sg.style.transform }], { duration: T(240), easing: "ease-in", fill: "forwards" }).onfinish = function () {
      fillWork(w);
      setFotoImg(fotos(w)[S.foto], function () {
        var r = restSt(); st.s = r.s; st.x = r.x; st.y = r.y; applySt();
        sg.getAnimations().forEach(function (a) { a.cancel(); });
        sg.animate([{ opacity: 0, transform: "translateX(" + dx + "px) " + sg.style.transform }, { opacity: 1, transform: sg.style.transform }], { duration: T(520), easing: EASE });
        $("sheetHead").animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: T(450), easing: EASE });
        if (sheetMode === "open") $("sheetSc").animate([{ opacity: 0 }, { opacity: 1 }], { duration: T(400) });
      });
    };
  }
  function stepWork(dir) { if (!S.work || WORKS.length < 2) return; var i = WORKS.indexOf(S.work); nav({ s: "work", w: WORKS[(i + dir + WORKS.length) % WORKS.length] }, { dir: dir }); }
  // Стрелки (кнопки и клавиши) листают фото внутри работы, а свайп по фото - работы (просьба мастера 2026-11-24:
  // клиент листает работы и не догадывается открыть описание, чтобы увидеть остальные фото).
  // После последнего фото стрелка ведёт к следующей работе, с первого фото назад - к последнему фото предыдущей.
  var NEXT_FOTO = 0;
  function stepFoto(dir) {
    var n = (S.work && S.work.foto || []).length, j = S.foto + dir;
    if (n > 1 && j >= 0 && j < n) { showFoto(j); return; }
    if (!S.work || WORKS.length < 2) { if (n > 1) showFoto(j); return; }
    var i = WORKS.indexOf(S.work), w = WORKS[(i + dir + WORKS.length) % WORKS.length];
    NEXT_FOTO = dir < 0 ? Math.max(0, (w.foto || []).length - 1) : 0;
    nav({ s: "work", w: w }, { dir: dir });
  }
  function navArrows() {
    var n = (S.work && S.work.foto || []).length, c = $("wCnt");
    c.hidden = n < 2; c.innerHTML = n < 2 ? "" : "<b>" + (S.foto + 1) + "</b> / " + n;
    var more = WORKS.length > 1;
    $("wNext").setAttribute("aria-label", n > 1 && S.foto < n - 1 ? "Следующее фото" : more ? "Следующая работа" : "Следующее фото");
    $("wPrev").setAttribute("aria-label", n > 1 && S.foto > 0 ? "Предыдущее фото" : more ? "Предыдущая работа" : "Предыдущее фото");
    $("wNext").title = $("wNext").getAttribute("aria-label"); $("wPrev").title = $("wPrev").getAttribute("aria-label");
  }
  $("wNext").onclick = function () { stepFoto(1); };
  $("wPrev").onclick = function () { stepFoto(-1); };
  $("workBack").onclick = function () { up(); };

  // Просмотр на весь экран (кнопка "На весь экран"): фото сразу целиком на тёмном фоне, крестик сверху и Esc - закрыть,
  // внизу - / Целиком / +, колесо, щипок, двойное нажатие. Подсказка сама пропадает.
  // Настоящие панорамы 360 (raboty[].panorama) - следующий шаг, тогда здесь будет круговой обзор.
  function setPano(on) {
    if (on === pano) return;
    closeNote(true);
    if (on && bare) { bare = false; $("work").classList.remove("bare"); }
    pano = on; $("work").classList.toggle("pano", on); $("spots").classList.toggle("off", on);
    if (on) $("toast").classList.remove("on");
    panoHint(on);
    animTo(restSt(), 650, eEase); // фото плавно переезжает и вписывается целиком
    if (kbd) (on ? $("exitPano") : $("panoBtn")).focus({ preventScroll: true });
  }
  var PHINT = "vp-pano-hint";
  function panoHint(on) {
    var b = $("badge360");
    clearTimeout(panoHint.t);
    if (!on) { b.classList.remove("on"); return; }
    var n = 0; try { n = +localStorage.getItem(PHINT) || 0; localStorage.setItem(PHINT, n + 1); } catch (e) {}
    var fine = window.matchMedia && matchMedia("(pointer: fine)").matches;
    b.innerHTML = fine ?
      "<b>Приблизить</b> - колесо мыши, щипок на тачпаде или кнопка +. <b>Двигать</b> - тяните фото. <b>Закрыть</b> - крестик или Esc" :
      "<b>Приблизить</b> - разведите два пальца или нажмите дважды. <b>Двигать</b> - тяните. <b>Закрыть</b> - крестик вверху";
    b.classList.add("on");
    panoHint.t = setTimeout(function () { b.classList.remove("on"); }, n < 2 ? 6000 : 3000);
  }
  $("panoBtn").onclick = function () { setPano(true); };
  $("exitPano").onclick = function () { setPano(false); };

  // ---------- "Хочу так же" ----------
  var lastFocus = null;
  function openModal(w) {
    var t = "Здравствуйте! Посмотрел(а) вашу витрину.";
    if (w) {
      t += '\nХочу так же, как в работе "' + w.nazvanie + '".';
      if (note >= 0 && pts()[note]) t += "\nОсобенно понравилось: " + pts()[note].nazvanie.toLowerCase() + ".";
      t += "\nСсылка: " + location.origin + location.pathname + "#rabota=" + encodeURIComponent(w.id);
    }
    t += "\nМой город: ...\nПримерные размеры: ...";
    $("mT").textContent = w ? "Хочу так же" : "Написать мастеру";
    $("mMsg").textContent = t;
    var wa = waUrl(t);
    $("mWa").href = wa || "#"; $("mWa").hidden = !wa;
    $("mTg").hidden = !tgUrl();
    $("mTg").onclick = function () {
      var go = function () { window.open(tgUrl(), "_blank", "noopener"); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast("Текст скопирован - вставьте его в чат"); setTimeout(go, 600); }, go);
      else go();
    };
    $("mMax").hidden = !maxUrl();
    $("mMax").onclick = function () {
      var go = function () { window.open(maxUrl(), "_blank", "noopener"); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast("Текст скопирован - вставьте его в чат"); setTimeout(go, 600); }, go);
      else go();
    };
    // быстрый расчёт - в витрине варианта 3 (та же страница данных)
    $("mCalc").href = "../#raschet";
    $("mCalc").hidden = !((D.raschet && D.raschet.izdeliya) || []).length; // цен ещё нет - кнопку не показываем
    lastFocus = document.activeElement;
    $("modal").classList.add("on");
    setTimeout(function () { (wa ? $("mWa") : $("mX")).focus({ preventScroll: true }); }, 60);
  }
  function closeModal() { if (!$("modal").classList.contains("on")) return false; $("modal").classList.remove("on"); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); return true; }
  $("wantBtn").onclick = function () { openModal(S.work); };
  $("mX").onclick = closeModal;
  $("modal").addEventListener("click", function (e) { if (e.target === this) closeModal(); });
  $("modal").addEventListener("keydown", function (e) {
    if (e.key !== "Tab") return;
    var f = [].filter.call(this.querySelectorAll("a[href],button"), function (x) { return !x.hidden && x.offsetParent; });
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  // ---------- навигация: история = путь по дому ----------
  // Уровень 0 - дом, 1 - комната, 2 - работа. В истории браузера всегда лежит ровно этот путь,
  // поэтому "назад" (кнопка браузера, стрелка, Esc) поднимает на уровень выше.
  function lvl(t) { return t.s === "work" ? 2 : t.s === "room" ? 1 : 0; }
  function hashOf(t) { return t.s === "work" ? "#rabota=" + encodeURIComponent(t.w.id) : t.s === "room" ? "#komnata=" + encodeURIComponent(t.k.id) : ""; }
  function urlOf(t) { return location.pathname + location.search + hashOf(t); }
  function parse(h) {
    var m; try { h = decodeURIComponent(h || ""); } catch (e) {}
    if ((m = /^#rabota=(.+)$/.exec(h)) && BYID[m[1]]) return { s: "work", w: BYID[m[1]] };
    if ((m = /^#komnata=(.+)$/.exec(h)) && ROOMBY[m[1]] && ROOMBY[m[1]].works.length) return { s: "room", k: ROOMBY[m[1]] };
    return { s: "home" };
  }
  function curLvl() { return cur === "work" ? 2 : cur === "room" ? 1 : 0; }
  var PENDING = null, BUSY = false, QUEUE = null;
  function nav(t, o) {
    var L = lvl(t), C = (history.state && typeof history.state.vp === "number") ? history.state.vp : curLvl();
    if (L > C) {
      if (L === 2 && C === 0) history.pushState({ vp: 1 }, "", urlOf({ s: "room", k: t.w._k }));
      history.pushState({ vp: L }, "", urlOf(t));
      go(t, o);
    } else if (L === C) { history.replaceState({ vp: L }, "", urlOf(t)); go(t, o); }
    else { PENDING = { t: t, o: o }; history.go(L - C); }
  }
  function up() {
    if (cur === "work") nav({ s: "room", k: S.work._k });
    else if (cur === "room") nav({ s: "home" });
  }
  addEventListener("popstate", function (e) {
    var t, o = {}, es = e.state || {};
    if (BACKING) { BACKING = false; var af = AFTER; AFTER = null; if (af) af(); return; }
    // видео и разделы поверх дома: шаг назад их закрывает, шаг вперёд - открывает раздел снова
    if (VID && !es.vid) { closeVideo(true); if (!PENDING && cur === "home" && !es.pn && !PN) return; }
    if (PN && !es.pn) { closePanel(true); if (!PENDING && cur === "home") return; }
    if (es.pn && !PENDING && cur === "home") { openPanel(es.pn, true); return; }
    if (es.vid && !VID) { history.back(); return; }
    if (!e.state) { // адрес поменяли руками: ...#razdel=raboty
      var rz = (/^#razdel=(\w+)$/.exec(location.hash) || [])[1];
      if (rz && cur === "home") { history.replaceState({ vp: 0 }, "", urlOf({ s: "home" })); if (rz === "video") toReels(); else openPanel(rz); return; }
      if (/^#(raboty|voprosy|otzyv)$/.test(location.hash) && window.KrZamok) { location.replace("master/" + location.hash); return; } // старые ссылки закрытой витрины
    }
    if (PENDING) { t = PENDING.t; o = PENDING.o || {}; PENDING = null; history.replaceState({ vp: lvl(t) }, "", urlOf(t)); }
    else {
      t = parse(location.hash);
      // шаг назад из работы - в комнату этой работы (даже если по пути листали работы других комнат)
      if (t.s === "room" && cur === "work" && S.work && S.work._k !== t.k) { t = { s: "room", k: S.work._k }; history.replaceState({ vp: 1 }, "", urlOf(t)); }
      else if (!e.state || typeof e.state.vp !== "number") history.replaceState({ vp: lvl(t) }, "", urlOf(t));
    }
    go(t, o);
  });
  // переходы между экранами (во время анимации следующий шаг ждёт её конца)
  function go(t, o) {
    if (BUSY) { QUEUE = [t, o]; return; }
    o = o || {};
    closeModal();
    var fin = function () {
      BUSY = false;
      if (kbd) { var f = cur === "room" ? (RV === "zhurnal" ? $("pgR").querySelector(".jgo") : roomEl(S.ri || 0)) : cur === "work" ? $("workBack") : null; if (f && f.focus) f.focus({ preventScroll: true }); }
      if (QUEUE) { var q = QUEUE; QUEUE = null; go(q[0], q[1]); }
    };
    BUSY = true;
    if (t.s !== "home") { if (PN) closePanel(true); if (VID) closeVideo(true); }
    if (t.s === "home") {
      closeNote(true);
      if (cur === "home") return fin();
      if (cur === "room" && S.room) { var k = S.room; flyOut(k, function () { show("home", true); litByScroll(); }); setTimeout(fin, T(760)); }
      else { show("home"); litByScroll(); fin(); }
    } else if (t.s === "room") {
      if (cur === "home") {
        flyInto(t.k, function () { renderRoom(t.k, 0, true); show("room", true); restart($("room"), "enter"); fin(); });
      } else if (cur === "work" && S.work && S.work._k === t.k) {
        closeWorkToRoom(t.k, fin);
      } else if (cur === "room" && S.room === t.k) { fin(); }
      else {
        renderRoom(t.k, 0, true); show("room"); restart($("room"), "enter"); fin();
      }
    } else if (t.s === "work") {
      if (cur === "work" && S.work === t.w) return fin();
      if (cur === "work") { switchWork(t.w, o.dir); setTimeout(fin, T(300)); }
      else openWork(t.w, cur === "room" ? srcEl(t.w) : null, fin);
    } else fin();
  }

  // ---------- клавиатура ----------
  addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var k = e.key;
    if (k === "Escape") {
      if (closeModal()) return;
      if (closeVideo()) return;
      if (closePanel()) return;
      if (cur === "doors") { openDoors(); return; }
      if (cur === "work" && pano) { setPano(false); return; }
      if (cur === "work" && note >= 0) { closeNote(); return; }
      if (cur === "work" && bare) { setBare(false); return; }
      if (cur === "work" && sheetMode === "open") { setSheet("compact"); return; }
      if (cur === "work" && st.s > st.base * 1.02) { animTo(restSt(), 450, eEase); return; }
      up(); return;
    }
    if ($("modal").classList.contains("on")) return;
    var tag = (document.activeElement && document.activeElement.tagName) || "";
    if (cur === "room" && RV === "zhurnal") {
      if (k === "ArrowRight") { turn(1); e.preventDefault(); }
      else if (k === "ArrowLeft") { turn(-1); e.preventDefault(); }
      else if ((k === "Enter" || k === " ") && tag !== "BUTTON") { openPage(); e.preventDefault(); }
    } else if (cur === "room" && RV === "karusel") {
      if (k === "ArrowRight") { deckGo(Math.round(deckT) + 1); e.preventDefault(); }
      else if (k === "ArrowLeft") { deckGo(Math.round(deckT) - 1); e.preventDefault(); }
      else if ((k === "Enter" || k === " ") && tag !== "BUTTON") { deckAct(Math.round(deckT)); e.preventDefault(); }
    } else if (cur === "work") {
      if (k === "+" || k === "=") zoomStep(1);
      else if (k === "-" || k === "_") zoomStep(-1);
      else if (k === "0") animTo(restSt(), 450, eEase);
      else if (k === "ArrowRight") stepFoto(1);
      else if (k === "ArrowLeft") stepFoto(-1);
      else if (k === "ArrowDown" && (S.work.foto || []).length > 1 && !e.target.closest(".sheet-sc")) { showFoto(S.foto + 1); e.preventDefault(); }
      else if (k === "ArrowUp" && (S.work.foto || []).length > 1 && !e.target.closest(".sheet-sc")) { showFoto(S.foto - 1); e.preventDefault(); }
    }
  });

  // ---------- черновик из Мастерской ----------
  function loadDraft() {
    if (!DRAFT) return Promise.resolve();
    try { var d = JSON.parse(localStorage.getItem("vt-draft") || "null"); if (d) D = d; } catch (e) {}
    return new Promise(function (ok) {
      if (!window.indexedDB) return ok();
      var rq = indexedDB.open("vt-photos", 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore("p"); };
      rq.onerror = function () { ok(); };
      rq.onsuccess = function () {
        try {
          var c = rq.result.transaction("p").objectStore("p").openCursor();
          c.onsuccess = function () { var r = c.result; if (!r) return ok(); PH[r.key] = URL.createObjectURL(r.value); r.continue(); };
          c.onerror = function () { ok(); };
        } catch (e) { ok(); }
      };
    });
  }

  // ---------- запуск ----------
  function start() {
    try { sessionStorage.setItem("vp-dom", location.pathname + location.search); } catch (e) {} // лента работ покажет "назад в путешествие"
    K = D.kontakty || {};
    WM = makeWM();
    prep(); renderMaster(); renderHouse(); renderReels();
    var t0 = parse(location.hash), st0 = history.state;
    var RZ = (/^#razdel=(\w+)$/.exec(location.hash) || [])[1] || "";
    if (st0 && (st0.pn || st0.vid)) { st0 = { vp: 0 }; history.replaceState(st0, "", urlOf({ s: "home" })); } // обновили страницу с открытым разделом
    // по ссылке на работу или комнату - сразу туда, без дверей; путь по дому кладём в историю,
    // чтобы "назад" вёл в комнату и дом, а не прочь с сайта
    if (!st0 || typeof st0.vp !== "number") {
      if (t0.s === "work") { history.replaceState({ vp: 0 }, "", urlOf({ s: "home" })); history.pushState({ vp: 1 }, "", urlOf({ s: "room", k: t0.w._k })); history.pushState({ vp: 2 }, "", urlOf(t0)); }
      else if (t0.s === "room") { history.replaceState({ vp: 0 }, "", urlOf({ s: "home" })); history.pushState({ vp: 1 }, "", urlOf(t0)); }
      else history.replaceState({ vp: 0 }, "", urlOf(t0));
    } else if (st0.vp !== lvl(t0)) history.replaceState({ vp: lvl(t0) }, "", urlOf(t0));
    if (t0.s === "work") { renderRoom(t0.w._k, t0.w._k.works.indexOf(t0.w), false); openWork(t0.w, null); markSeen(); }
    else if (t0.s === "room") { renderRoom(t0.k, 0, true); show("room"); restart($("room"), "enter"); markSeen(); }
    else if (!seen() && !DRAFT && !RZ) { show("doors"); if (!reduce) setTimeout(function () { $("enterBtn").focus({ preventScroll: true }); }, 50); }
    else { show("home"); restart($("home"), "enter"); litByScroll(); }
    // ссылка сразу на раздел: ...#razdel=raboty | otzyvy | master | video
    if (RZ && t0.s === "home") {
      markSeen();
      if (RZ === "video") { history.replaceState({ vp: 0 }, "", urlOf({ s: "home" })); setTimeout(toReels, T(400)); }
      else if (PN_T[RZ]) { history.replaceState({ vp: 0 }, "", urlOf({ s: "home" })); openPanel(RZ); }
    }
  }
  loadDraft().then(start);
})();
