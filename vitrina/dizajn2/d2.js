/* Новые пробные дизайны "Путешествия по дому" (варианты 5-8). Грузится ПЕРЕД puteshestvie.js,
   логику витрины не трогает: только вид, объёмный дом, меню на весь экран, фон (видео) и проявление фото.

   Варианты (window.D2_TEMA): galereya - светлая галерея; kino - видео на фоне (как у Gruppo Euromobil);
   grafit - тёмный, строгий; liniya - дом нарисован тонкими линиями, фото проявляют цвет.
   Данные (необязательные): D.master.logo - знак мастера (svg/png, "foto/..."), D.fon - фон для "Кино":
   { video, video_tel, kadr, kadr_tel } (16:9 для компьютера и 9:16 для телефона). Без видео "Кино" показывает
   медленную смену фото работ.

   Качество под устройство: data-d2q 2 (всё), 1 (без постоянного движения), 0 (без анимаций и видео).
   Сначала считаем по железу и настройкам (экономия трафика, "меньше движения"), потом меряем кадры при входе.
   Весь цикл анимации стоит, когда дом не на экране: в комнате, в работе, при открытом разделе или меню. */
(function () {
  "use strict";
  var H = document.documentElement, B = document.body;
  var $ = function (id) { return document.getElementById(id); };
  var home = $("home"), house = $("house"), roof = $("roof"), floors = $("floors");
  if (!home || !house || !roof || !floors) return;
  var D = window.VITRINA || {}, M = D.master || {}, K = D.kontakty || {};
  var TEMY = { galereya: 1, kino: 1, grafit: 1, liniya: 1 };
  var tema = TEMY[window.D2_TEMA] ? window.D2_TEMA : "galereya";
  H.setAttribute("data-d2", ""); H.setAttribute("data-d2t", tema);
  // шрифты на выбор мастера (Мастерская - "Шрифты", правки shrift; список - shrifty.js рядом)
  var SHR = !!(window.D2Shrift && D.shrift && window.D2Shrift.apply(D.shrift));

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function mm(q) { return window.matchMedia ? matchMedia(q) : { matches: false, addEventListener: function () {} }; }
  function digits(s) { return String(s || "").replace(/\D/g, ""); }
  function url(s) { return !s ? "" : /^(data:|blob:|https?:|\/)/.test(s) ? s : "../" + s; } // как srcOf в puteshestvie.js

  // ---------- качество ----------
  var mqR = mm("(prefers-reduced-motion: reduce)"), FINE = mm("(hover: hover) and (pointer: fine)").matches;
  var cn = navigator.connection || {};
  var Q = (function () {
    var f = (/[?&]kach=(\w+)/.exec(location.search) || [])[1];
    if (f === "max") return 2; if (f === "lite") return 0;
    if (mqR.matches || cn.saveData) return 0;
    var c = navigator.hardwareConcurrency || 4, m = navigator.deviceMemory || 4;
    if (m <= 2 || c <= 2) return 0;
    if (m <= 3 || c <= 4) return 1;
    try { var s = sessionStorage.getItem("d2-q"); if (s != null && s !== "") return Math.min(2, +s); } catch (e) {}
    return 2;
  })();
  function setQ(q) { Q = q; H.setAttribute("data-d2q", q); try { sessionStorage.setItem("d2-q", q); } catch (e) {} }
  H.setAttribute("data-d2q", Q);

  // ---------- знак и название ----------
  var NAME = M.imya || "Мастер";
  var LOGO = null; // готовая разметка svg или <img>
  var brandSlots = [];
  function brand(cls) {
    var b = el("button", "d2-brand" + (cls ? " " + cls : ""), "<i hidden></i><b>" + esc(NAME) + "</b>");
    b.type = "button"; b.setAttribute("aria-label", NAME + " - наверх");
    brandSlots.push(b.firstChild);
    if (LOGO) fillLogo(b.firstChild);
    return b;
  }
  function fillLogo(i) { if (!LOGO) return; i.innerHTML = LOGO; i.hidden = false; }
  function loadLogo(cb) {
    var s = url(M.logo);
    if (!s) return;
    if (/\.(png|jpe?g|webp)(\?|$)/i.test(M.logo) && !/^@/.test(M.logo)) { LOGO = '<img src="' + esc(s) + '" alt="" style="width:100%;height:100%;object-fit:contain">'; cb(); return; }
    fetch(s).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (t) {
      if (/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(t)) {
        // свой файл, но на всякий случай без скриптов и обработчиков
        t = t.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<\?xml[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<!--[\s\S]*?-->/gi, "").replace(/<(metadata|title|desc|foreignObject)[\s\S]*?<\/\1>/gi, "").replace(/(href\s*=\s*["'])\s*javascript:[^"']*/gi, "$1#").replace(/\son\w+\s*=\s*(["']).*?\1/gi, "");
        LOGO = t.replace(/<svg/i, '<svg aria-hidden="true" focusable="false"');
      } else LOGO = '<img src="' + esc(s) + '" alt="" style="width:100%;height:100%;object-fit:contain">';
      cb();
    }).catch(function () {});
  }

  // шапка: знак + название слева, разделы, "Написать", меню
  var htopIn = home.querySelector(".htop-in");
  var hb = brand();
  hb.onclick = function () { home.scrollTo({ top: 0, behavior: Q ? "smooth" : "auto" }); };
  htopIn.insertBefore(hb, htopIn.firstChild);
  var burger = el("button", "d2-burger", "<i></i>"); burger.type = "button"; burger.setAttribute("aria-label", "Меню"); burger.setAttribute("aria-expanded", "false");
  htopIn.appendChild(burger);

  // вход: знак над названием
  var dui = document.querySelector("#doors .door-ui"), dmark = null;
  if (dui) { dmark = el("div", "d2-dmark"); dmark.hidden = true; dui.insertBefore(dmark, dui.firstChild); }
  // "Просто": на заставке лёгкий "космос" сзади и завитки по углам кнопки "Войти в дом" (стили в d2.css)
  if (window.D2_P && dui) {
    var sp = el("div", "d2-space", '<i class="neb"></i><i class="neb2"></i><i class="s1"></i><i class="s2"></i>'); sp.setAttribute("aria-hidden", "true");
    dui.parentNode.insertBefore(sp, dui);
    // звёзды случайно рассыпаны по большой плитке (SVG), чтобы не было заметного повтора
    var stars = function (n, sz, rmax, amax) {
      var c = "";
      for (var si = 0; si < n; si++) c += '<circle cx="' + (Math.random() * sz).toFixed(0) + '" cy="' + (Math.random() * sz).toFixed(0) + '" r="' + (.4 + Math.random() * rmax).toFixed(2) + '" fill-opacity="' + (.25 + Math.random() * amax).toFixed(2) + '"/>';
      return 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + sz + '" height="' + sz + '" fill="#fff">' + c + "</svg>") + '")';
    };
    sp.children[2].style.backgroundImage = stars(70, 700, .6, .5); sp.children[2].style.backgroundSize = "700px 700px";
    sp.children[3].style.backgroundImage = stars(16, 900, 1.1, .7); sp.children[3].style.backgroundSize = "900px 900px";
    var eb = $("enterBtn");
    if (eb) {
      var C = '<path pathLength="1" d="M3 44 C2 28 8 15 22 9 C34 4 52 6 76 3"/><path pathLength="1" d="M8 31 C9 22 15 17 22 17.5 C28 18 30 23.5 26.5 26.5 C23.5 29 19 27.5 19.6 24 C20 22 22 21 23.6 22 M30 12 C38 10 46 10.5 54 9.5"/>';
      var orn = el("span", "d2-orn", ["c1", "c2", "c3", "c4"].map(function (c) { return '<svg class="' + c + '" viewBox="0 0 78 46">' + C + "</svg>"; }).join("") + '<i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i>');
      orn.setAttribute("aria-hidden", "true"); eb.appendChild(orn);
    }
  }

  // главная: мелкая строка над заголовком
  var h1 = home.querySelector(".hero-t h1");
  if (h1) {
    var city = String(M.gorod || "").split(/\s+и\s+|,/)[0].trim();
    var eye = [M.rol ? String(M.rol).replace(/\s+на заказ$/i, "") : "", city].filter(Boolean).join(" · ");
    if (eye) h1.parentNode.insertBefore(el("span", "d2-eye", esc(eye)), h1);
  }

  loadLogo(function () {
    brandSlots.forEach(fillLogo);
    if (dmark) { dmark.innerHTML = LOGO; dmark.hidden = false; }
  });

  // ---------- меню на весь экран ----------
  var menu = el("div", "d2-menu"); menu.id = "d2menu"; menu.setAttribute("role", "dialog"); menu.setAttribute("aria-modal", "true"); menu.setAttribute("aria-label", "Меню"); menu.inert = true;
  var mtop = el("div", "d2-mtop"), mb = brand(); mtop.appendChild(mb);
  var mx = el("button", "d2-mx", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>'); mx.type = "button"; mx.setAttribute("aria-label", "Закрыть меню");
  // "Просто": вместо крестика тонкая длинная стрелка вправо - меню уезжает туда же, откуда выехало
  if (window.D2_P) { mx.innerHTML = '<svg viewBox="0 0 40 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h33M29 5.5L36 12l-7 6.5"/></svg>'; mx.classList.add("d2-mxa"); }
  mtop.appendChild(mx); menu.appendChild(mtop);
  var mbody = el("div", "d2-mbody"), mnav = el("nav", "d2-mnav"); mnav.setAttribute("aria-label", "Разделы");
  var ITEMS = [["raboty", "Работы"], ["video", "Видео"], ["otzyvy", "Отзывы"], ["master", "О мастере"], ["write", "Написать мастеру"]];
  if (window.D2_P) ITEMS.pop(); // "Просто": ниже в меню ряд мессенджеров, отдельный пункт "Написать мастеру" лишний
  mbody.appendChild(mnav);
  var side = el("div", "d2-mside"), wa = digits(K.whatsapp), tg = String(K.telegram || "").replace(/^@|^https?:\/\/t\.me\//, ""), tel = digits(K.telefon), vk = String(K.vk || "").trim();
  // значки для ряда контактов в "Просто" (в остальных вариантах значки скрыты стилями)
  var MI = {
    wa: '<svg class="d2-mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.4 18.6z"/><path d="M9.2 8.6c.2 2.9 2.4 5.3 5.6 6l1.1-1.3-1.8-1-1 .8a4.6 4.6 0 0 1-2.4-2.4l.8-1-1-1.8z"/></svg>',
    tg: '<svg class="d2-mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 4.5L3.5 11l6 2.2L20.5 4.5l-8.3 10.2.4 5 2.7-3.7 4.2 3z"/></svg>',
    mx: '<svg class="d2-mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M12 4a8 8 0 0 0-6.9 12.1L4 20l3.9-1.1A8 8 0 1 0 12 4z"/><path d="M8.5 14.5v-5l3.5 3.2 3.5-3.2v5" stroke-linecap="round"/></svg>',
    tel: '<svg class="d2-mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/></svg>',
    vk: '<svg class="d2-mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M7 9c.4 3.6 2.2 6 5.3 6v-2.2c1.2.2 2.1 1.1 2.5 2.2H17c-.5-1.7-1.6-2.8-2.6-3.3 1-.6 1.9-1.8 2.2-3.2h-1.9c-.4 1.3-1.4 2.4-2.4 2.5V9h-1.9v4.6C9.3 13.2 8.9 11 8.8 9z" stroke-width="1.1"/></svg>'
  };
  if (wa) side.innerHTML += '<a class="d2-ln" target="_blank" rel="noopener" href="https://wa.me/' + wa + '">' + MI.wa + 'WhatsApp</a>';
  if (tg) side.innerHTML += '<a class="d2-ln" target="_blank" rel="noopener" href="https://t.me/' + esc(tg) + '">' + MI.tg + 'Telegram</a>';
  var mxu = String(K.max || "").trim(); mxu = /^https?:\/\//.test(mxu) ? mxu : /^(www\.)?max\.ru\//.test(mxu) ? "https://" + mxu : "";
  if (mxu) side.innerHTML += '<a class="d2-ln" target="_blank" rel="noopener" href="' + esc(mxu) + '">' + MI.mx + 'Max</a>';
  if (tel) side.innerHTML += '<a class="d2-ln" href="tel:+' + tel + '">' + MI.tel + 'Позвонить</a>';
  if (vk) side.innerHTML += '<a class="d2-ln" target="_blank" rel="noopener" href="' + esc(/^https?:/.test(vk) ? vk : "https://" + vk) + '">' + MI.vk + 'ВКонтакте</a>';
  if (window.D2_P) { // "Просто": одной строкой в порядке WhatsApp, ВКонтакте, Позвонить, Telegram, Max
    var ord = ["wa.me", "vk", "tel:", "t.me", "max"], ls = [].slice.call(side.children);
    ls.sort(function (a, b) { var f = function (x) { var h = x.getAttribute("href"); for (var i = 0; i < ord.length; i++) if (h.indexOf(ord[i]) >= 0) return i; return 9; }; return f(a) - f(b); });
    ls.forEach(function (x, i) { x.style.setProperty("--i", i); side.appendChild(x); });
    side.style.setProperty("--n", ls.length);
  }
  mbody.appendChild(side);
  var foot = [M.chelovek ? "Мастер - " + M.chelovek : "", M.gorod || ""].filter(Boolean).join(". ");
  if (foot) mbody.appendChild(el("div", "d2-mfoot", esc(foot)));
  menu.appendChild(mbody);
  B.appendChild(menu);
  if (window.D2_P) { // меню на полстраницы: нажатие мимо него (по видео слева) закрывает меню
    var mshade = el("div", "d2-mshade"); mshade.setAttribute("aria-hidden", "true");
    mshade.addEventListener("click", function () { closeMenu(); }); B.insertBefore(mshade, menu);
  }
  var MON = false, mFrom = null;
  function drawMenu() {
    var vh = $("tnVideo") && $("tnVideo").hidden;
    mnav.innerHTML = ITEMS.filter(function (x) { return !(x[0] === "video" && vh); }).map(function (x, i) {
      return '<button type="button" data-go="' + x[0] + '" style="--i:' + i + '"><span>' + x[1] + "</span></button>";
    }).join("");
  }
  function openMenu() {
    if (MON) return; drawMenu(); MON = true; mFrom = document.activeElement;
    menu.inert = false; menu.classList.add("on"); burger.setAttribute("aria-expanded", "true"); H.classList.add("d2-mopen");
    setTimeout(function () { if (MON) mx.focus({ preventScroll: true }); }, 60);
    loopCheck();
  }
  function closeMenu(then) {
    if (!MON) return; MON = false;
    menu.classList.remove("on"); menu.inert = true; burger.setAttribute("aria-expanded", "false"); H.classList.remove("d2-mopen");
    if (!then && mFrom && mFrom.focus) mFrom.focus({ preventScroll: true });
    if (then) setTimeout(then, Q ? 380 : 0);
    loopCheck();
  }
  burger.onclick = openMenu; mx.onclick = function () { closeMenu(); }; mb.onclick = function () { closeMenu(); };
  mnav.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-go]"); if (!b) return;
    var go = b.getAttribute("data-go");
    closeMenu(function () {
      if (go === "write") { var w = $("writeBtn"); if (w) w.click(); return; }
      var t = $("tnav").querySelector('button[data-p="' + go + '"]'); if (t) t.click();
    });
  });
  addEventListener("keydown", function (e) { if (e.key === "Escape" && MON) { e.stopImmediatePropagation(); closeMenu(); } }, true);

  // ---------- шапка при прокрутке ----------
  var HT = $("htop"); // в "Просто" доля подложки (--hk) ставится на самой шапке - пересчёт стилей только у неё
  var scT = 0;
  home.addEventListener("scroll", function () {
    if (scT) return;
    scT = requestAnimationFrame(function () { scT = 0; home.classList.toggle("d2-sc", home.scrollTop > 8); if (PROSTO && HT) HT.style.setProperty("--hk", Math.min(1, home.scrollTop / 220).toFixed(3)); if (!FINE) kick(); });
  }, { passive: true });

  // ---------- "Просто" (window.D2_P, вариант 13): человек зашёл первый раз - сразу понятно, куда нажать ----------
  // Крупные подписи комнат с числом работ, в комнате все работы сразу плиткой (вид закреплён через VP_VID),
  // без переключателя видов, мини-карты и лишних кнопок. Правила - в d2.css (html[data-d2p]).
  var PROSTO = !!window.D2_P;
  // подсветка названия разом: копия текста в data-t (её показывает ::after в d2.css)
  function litT() { [].forEach.call(document.querySelectorAll("#dName, .d2-brand b"), function (e) { var t = e.textContent; if (e.getAttribute("data-t") !== t) e.setAttribute("data-t", t); }); }
  if (PROSTO) { litT(); setTimeout(litT, 0); setTimeout(litT, 1500); }
  function plur(n, f) { n = Math.abs(n) % 100; var d = n % 10; return n > 10 && n < 20 ? f[2] : d === 1 ? f[0] : d >= 2 && d <= 4 ? f[1] : f[2]; }
  if (PROSTO) {
    H.setAttribute("data-d2p", "");
    if (window.D2_KLIENT) H.setAttribute("data-d2k", ""); // krasnodar/klient/: как у настоящего клиента - без подвала с именем и пометкой о тесте
    var hl = $("hLead"), HL = "Выберите комнату - внутри все её работы сразу.";
    if (hl) { hl.textContent = HL; new MutationObserver(function () { if (hl.textContent !== HL) hl.textContent = HL; }).observe(hl, { childList: true, characterData: true, subtree: true }); } // текст ставит и puteshestvie.js
  }

  // ---------- подписи комнат: номер работ рядом с названием ----------
  function decorRooms() {
    [].forEach.call(floors.querySelectorAll(".room"), function (r) {
      var t = r.querySelector(".t"); if (!t || t.querySelector(".d2n")) return;
      var tg = r.querySelector(".tags span"), n = tg ? parseInt(tg.textContent, 10) : 0;
      if (n) t.querySelector("b").insertAdjacentHTML("afterend", '<i class="d2n">' + (PROSTO ? n + " " + plur(n, ["работа", "работы", "работ"]) : (n < 10 ? "0" : "") + n) + "</i>");
    });
    layout(); d3faces(); build3D(); fitPhotos();
  }
  new MutationObserver(decorRooms).observe(floors, { childList: true });

  // ---------- другие формы дома (window.D2_DOM, варианты 9-11) ----------
  // razrez - дом в разрезе: ровная сетка одинаковых комнат, в каждой фото висит как картина в раме;
  // okna   - фасад с одинаковыми окнами, фото - за стеклом и чуть сдвигается при повороте (как будто смотришь в комнату);
  // linii  - вариант 12: дом белыми линиями (как siluet), в комнатах фото-окна с подписью снизу (как okna);
  // siluet - дом контуром, внутри названия комнат; фото комнаты при наведении (на телефоне - при прокрутке) - на весь фон.
  // Комнаты одного размера, по порядку из dannye.js: на компьютере 4 в ряд, на телефоне 2.
  var DOM = { razrez: 1, okna: 1, siluet: 1, linii: 1 }[window.D2_DOM] ? window.D2_DOM : "";
  if (DOM) H.setAttribute("data-d2dom", DOM);
  // v14 "Просто: поворот" (пробный, window.D2_3D): дом - объёмная коробка с комнатами на всех четырёх стенах,
  // поворачивается пальцем/мышью и кнопками. На других стенах - другие фото тех же комнат, нажатие открывает эту работу.
  var D3 = !!window.D2_3D && PROSTO && DOM === "linii", D3R = 0, D3F = null, D3K = null;
  if (D3) H.setAttribute("data-d23", "");
  var NARROW = mm("(max-width: 640px)");
  function layout() {
    if (!DOM) return;
    var rs = [].slice.call(floors.querySelectorAll(".room")), n = rs.length;
    if (!n) return;
    if (PROSTO && !NARROW.matches && n >= 7) return layout3(rs, n);
    floors.classList.remove("d2-e3");
    var cols = NARROW.matches ? 2 : n <= 4 ? n : n % 4 === 0 || n > 9 ? 4 : n % 3 === 0 ? 3 : 4;
    var rem = n % cols, full = n - rem;
    floors.style.gridTemplateColumns = "repeat(" + cols + ",minmax(0,1fr))";
    floors.classList.toggle("r4", Math.ceil(n / cols) > 3);
    rs.forEach(function (r, i) {
      r.style.gridRow = String(Math.floor(i / cols) + 1);
      r.style.setProperty("--rb", Math.ceil(n / cols) - Math.floor(i / cols) - 1); r.style.setProperty("--cx", i % cols);
      r.style.setProperty("--fx", (((i % cols) - (cols - 1) / 2) * 55).toFixed(0) + "%"); r.style.setProperty("--fy", ((Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * 40).toFixed(0) + "%");
      var span = 1;
      if (rem && i >= full) span = cols % rem === 0 ? cols / rem : (i === n - 1 ? cols - rem + 1 : 1); // неполный последний ряд - без дыр
      r.style.gridColumn = "auto / span " + span;
      r.style.setProperty("--i", i);
      var tb = r.querySelector(".t b"); if (tb) r.classList.toggle("long", tb.textContent.length > 15);
    });
  }
  // "13. Просто" на широком экране: дом в три этажа и выше (просьба Александра 2026-11-23).
  // Сетка из 6 долей: в ряду по 3 комнаты, неполный ряд - наверху, под крышей, комнаты в нём крупнее
  // (при 8 комнатах: Кухни и Гостиные наверху, по 3 ниже).
  function layout3(rs, n) {
    var rem = n % 3, top = rem ? 6 / rem : 2;
    floors.style.gridTemplateColumns = "repeat(6,minmax(0,1fr))";
    floors.classList.toggle("r4", Math.ceil(n / 3) > 3);
    floors.classList.add("d2-e3");
    rs.forEach(function (r, i) {
      var j = rem ? i - rem : i; // номер среди "полных" рядов
      r.style.gridRow = String(i < rem ? 1 : Math.floor(j / 3) + 1 + (rem ? 1 : 0));
      r.style.gridColumn = "auto / span " + (i < rem ? top : 2);
      var R3 = Math.ceil(n / 3), row3 = i < rem ? 1 : Math.floor(j / 3) + 1 + (rem ? 1 : 0);
      r.style.setProperty("--rb", R3 - row3); r.style.setProperty("--cx", i < rem ? i : j % 3);
      var inRow = i < rem ? rem : 3, cxx = i < rem ? i : j % 3; // откуда "летит" комната при сборке: от центра наружу
      r.style.setProperty("--fx", ((cxx - (inRow - 1) / 2) * 55).toFixed(0) + "%"); r.style.setProperty("--fy", ((row3 - (R3 + 1) / 2) * 45).toFixed(0) + "%");
      r.style.setProperty("--i", i);
      var tb = r.querySelector(".t b"); if (tb) r.classList.toggle("long", tb.textContent.length > (i < rem ? 26 : 15));
    });
  }
  if (NARROW.addEventListener) NARROW.addEventListener("change", function () { layout(); build3D(); });
  // "Просто": фото комнаты почти целиком. Масштаб - между "вписать" и "заполнить" (ближе к "вписать"),
  // чтобы было понятно, что на фото, и при этом без широких пустых полос по краям (их закрывает размытое фото).
  var PHN = {};
  function fitPhotos() {
    if (!PROSTO || DOM !== "linii") return;
    [].forEach.call(house.querySelectorAll(".room .ph"), function (ph) {
      var m = /url\(["']?([^"')]+)["']?\)/.exec(ph.style.backgroundImage || ""); if (!m) return;
      var src = m[1], nat = PHN[src];
      if (!nat) {
        PHN[src] = "wait"; var im = new Image();
        im.onload = function () { PHN[src] = { w: im.naturalWidth, h: im.naturalHeight }; fitPhotos(); };
        im.src = src; return;
      }
      if (nat === "wait" || !nat.w) return;
      var W = ph.clientWidth - 8, Hh = ph.clientHeight - 8; if (W <= 0 || Hh <= 0) return;
      var sc = Math.min(W / nat.w, Hh / nat.h), sv = Math.max(W / nat.w, Hh / nat.h), k = sc * Math.pow(sv / sc, .3);
      ph.style.setProperty("--bs", Math.round(nat.w * k) + "px " + Math.round(nat.h * k) + "px");
    });
  }
  if (PROSTO && window.ResizeObserver) new ResizeObserver(function () { fitPhotos(); }).observe(floors);

  // ---------- объёмный дом ----------
  var F = {}; // грани: wl, wr - боковые стены; sl, sr - скаты крыши; gr - тень на земле
  ["gr", "wl", "wr", "sl", "sr"].forEach(function (k) { F[k] = el("i", "d2-f " + k); F[k].setAttribute("aria-hidden", "true"); house.appendChild(F[k]); });
  var GEO = null;
  function px(v) { return Math.round(v * 10) / 10 + "px"; }
  function place(e, l, t, w, h, origin, tr) { var s = e.style; s.left = px(l); s.top = px(t); s.width = px(w); s.height = px(h); s.transformOrigin = origin; s.transform = tr; }
  function build3D() {
    var W = floors.offsetWidth, Hf = floors.offsetHeight, fl = floors.offsetLeft, ft = floors.offsetTop;
    var Wr = roof.offsetWidth, Hr = roof.offsetHeight, rl = roof.offsetLeft, rt = roof.offsetTop;
    if (!W || !Hf) return;
    var Dp = D3 ? W : Math.max(56, Math.min(190, W * .24));
    var rows = 1; [].forEach.call(floors.children, function (r) { rows = Math.max(rows, parseInt(r.style.gridRow, 10) || 1); });
    house.style.setProperty("--rh", ((Hf - 4) / rows) + "px");
    place(F.wr, fl + W, ft, Dp, Hf, "0 0", "rotateY(90deg)");
    place(F.wl, fl - Dp, ft, Dp, Hf, "100% 0", "rotateY(-90deg)");
    var th = Math.atan2(Hr, Wr / 2), L = Math.hypot(Wr / 2, Hr);
    place(F.sr, rl + Wr / 2, rt - Dp, L + .5, Dp, "0 100%", "rotateZ(" + th + "rad) rotateX(90deg)");
    place(F.sl, rl, rt + Hr - Dp, L + .5, Dp, "0 100%", "rotateZ(" + (-th) + "rad) rotateX(90deg)");
    place(F.gr, fl - Dp * .9, ft + Hf, W + Dp * 1.8, Dp * 2.4, "50% 0", "translateZ(" + px(Dp * .7) + ") rotateX(-90deg)");
    house.style.transformOrigin = "50% 62% " + px(-Dp / 2);
    GEO = { W: W, D: Dp };
    if (D3) d3place(W, Hf, fl, ft, Hr);
  }
  if (window.ResizeObserver) new ResizeObserver(function () { build3D(); }).observe(house);
  else addEventListener("resize", build3D);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build3D);

  // поворот: мышь (компьютер), лёгкое покачивание и прокрутка (телефон), разворот при входе
  var RY0 = -14, RX0 = -3, AMP = DOM === "okna" || DOM === "linii" ? .45 : DOM === "siluet" ? .5 : 1; // фасад и контур поворачиваются меньше
  if (DOM === "okna" || DOM === "linii") RY0 = -5; else if (DOM === "siluet") RY0 = -8;
  var cur = { ry: RY0, rx: RX0, tz: 0 }, ptr = null, raf = 0, last = 0, intro = null, live = true;
  function ease4(t) { return 1 - Math.pow(1 - t, 4); }
  function target(now) {
    var ry = RY0, rx = RX0, tz = 0;
    if (ptr && FINE) { ry += (ptr.x - .5) * -24 * AMP; rx += (ptr.y - .5) * 7 * AMP; }
    else if (!FINE && !PROSTO) { // в "Просто" дом при прокрутке не наклоняется - стоит спокойно под пальцем
      var s = Math.min(1.2, home.scrollTop / Math.max(1, innerHeight));
      ry += s * 14 * AMP; rx -= s * 7 * AMP;
      if (Q >= 2) ry += Math.sin(now / 2300) * 5 * AMP;
    } else if (Q >= 2) ry += Math.sin(now / 2600) * 4 * AMP;
    if (intro) {
      var k = Math.min(1, (now - intro.t0) / intro.dur), e = ease4(k);
      ry = -58 + (ry + 58) * e; rx = -14 + (rx + 14) * e; tz = -240 * (1 - e);
      if (k >= 1) intro = null;
    }
    return { ry: ry, rx: rx, tz: tz };
  }
  function apply() {
    house.style.transform = "translateZ(" + cur.tz.toFixed(1) + "px) rotateX(" + cur.rx.toFixed(2) + "deg) rotateY(" + (cur.ry + D3R).toFixed(2) + "deg)" + d3scale();
    if (D3) d3shade();
    if (DOM === "okna" || DOM === "linii") { // фото за стеклом сдвигается против поворота - глубина комнаты
      house.style.setProperty("--px", Math.max(-1, Math.min(1, (cur.ry - RY0) / 12)).toFixed(3));
      house.style.setProperty("--py", Math.max(-1, Math.min(1, (cur.rx - RX0) / 4)).toFixed(3));
    }
  }
  var slow = 0, frames = 0;
  function frame(now) {
    raf = 0;
    if (!live) return;
    var dt = last ? now - last : 16; last = now;
    if (intro) { frames++; if (dt > 34) slow++; }
    var t = target(now), k = intro ? 1 : 1 - Math.pow(.0016, Math.min(dt, 64) / 1000 * 1.0);
    cur.ry += (t.ry - cur.ry) * k; cur.rx += (t.rx - cur.rx) * k; cur.tz += (t.tz - cur.tz) * k;
    apply();
    var moving = intro || Math.abs(t.ry - cur.ry) > .02 || Math.abs(t.rx - cur.rx) > .02 || (Q >= 2) || (FINE && ptr);
    if (!intro && frames > 40) { // замер кадров во время входа: телефон не успевает - убираем постоянное движение
      if (slow / frames > .3) setQ(Q >= 2 ? 1 : 0);
      frames = 0; slow = 0;
    }
    if (moving && Q > 0) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function kick() { if (!raf && live && Q > 0) { raf = requestAnimationFrame(frame); } else if (Q === 0) { var t = target(performance.now()); cur.ry = t.ry; cur.rx = t.rx; cur.tz = 0; apply(); } }
  if (FINE) {
    addEventListener("pointermove", function (e) { if (e.pointerType !== "mouse") return; ptr = { x: e.clientX / innerWidth, y: e.clientY / innerHeight }; kick(); }, { passive: true });
    document.addEventListener("mouseleave", function () { ptr = null; kick(); });
  }
  // ---------- v14: дом с поворотом (D3) ----------
  // Три стены-копии фасада (справа, сзади, слева) и четырёхскатная крыша. Коробка квадратная в плане (глубина = ширина),
  // поэтому каждая стена - та же сетка комнат. Поворот: D3R прибавляется к повороту дома в apply() без сглаживания.
  function d3faces() {
    if (!D3) return;
    var rs = floors.querySelectorAll(".room"); if (!rs.length) return;
    if (!D3F) {
      D3F = []; D3K = [];
      // стена - обёртка .d2-3s (на ней положение и поворот), внутри копия сетки: у .floors своя анимация входа,
      // и её transform перекрыл бы поворот, если ставить его на саму копию
      for (var j = 1; j < 4; j++) { var sd = el("div", "d2-3s"), f = el("div", "floors d2-3w"); sd.setAttribute("aria-hidden", "true"); sd.appendChild(f); house.appendChild(sd); f.sd = sd; D3F.push(f); }
      for (var q = 0; q < 4; q++) {
        var r = el("div", "d2-3r", '<svg class="d2-rl" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="50,0.8 99.6,99.6 0.4,99.6" vector-effect="non-scaling-stroke"/></svg>');
        r.setAttribute("aria-hidden", "true"); house.appendChild(r); D3K.push(r);
      }
    }
    D3F.forEach(function (f, j0) {
      var j = j0 + 1; f.innerHTML = "";
      f.className = floors.className + " d2-3w"; f.style.gridTemplateColumns = floors.style.gridTemplateColumns;
      [].forEach.call(rs, function (r) {
        var c = r.cloneNode(true), n = r.vpN || 0, idx = n ? j % n : 0, src = r.vpCover ? r.vpCover(idx) : "", ph = c.querySelector(".ph");
        c.tabIndex = -1; c.classList.remove("lit");
        if (src && ph) ph.style.backgroundImage = 'url("' + src + '")';
        c.onclick = function () { if (r.vpGo && n) r.vpGo(idx); else r.click(); };
        f.appendChild(c);
      });
    });
  }
  function d3place(W, Hf, fl, ft, Hr) {
    if (!D3F) return;
    place(D3F[0].sd, fl + W, ft, W, Hf, "0 0", "rotateY(90deg)");
    place(D3F[1].sd, fl, ft, W, Hf, "50% 50%", "translateZ(" + px(-W) + ") rotateY(180deg)");
    place(D3F[2].sd, fl - W, ft, W, Hf, "100% 0", "rotateY(-90deg)");
    var L = Math.hypot(Hr, W / 2), th = Math.atan2(W / 2, Hr) + "rad";
    place(D3K[0], fl, ft - L, W, L, "50% 100%", "rotateX(" + th + ")");
    place(D3K[1], fl + W, ft - L, W, L, "0 100%", "rotateY(90deg) rotateX(" + th + ")");
    place(D3K[2], fl, ft - L, W, L, "50% 100%", "translateZ(" + px(-W) + ") rotateY(180deg) rotateX(" + th + ")");
    place(D3K[3], fl - W, ft - L, W, L, "100% 100%", "rotateY(-90deg) rotateX(" + th + ")");
  }
  // повёрнутая коробка шире фасада (по диагонали) - чуть уменьшаем, чтобы на телефоне дом не вылезал за экран
  function d3scale() {
    if (!D3 || !D3R) return "";
    var a = D3R * Math.PI / 180, k = Math.pow(1 / (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a))), NARROW.matches ? 1 : .55);
    return " scale3d(" + k.toFixed(4) + "," + k.toFixed(4) + "," + k.toFixed(4) + ")";
  }
  // стена темнеет, когда отворачивается: так коробка читается объёмной (только прозрачность слоя - дёшево)
  function d3shade() {
    if (!D3F) return;
    [floors].concat(D3F).forEach(function (f, j) {
      var a = (cur.ry + D3R + 90 * j) * Math.PI / 180, v = Math.max(0, Math.min(.62, (1 - Math.cos(a)) * .6));
      f.style.setProperty("--sh", v.toFixed(3));
      if (!j) { var cf = Math.max(0, Math.cos(a)); roof.style.opacity = (cf * cf).toFixed(3); } // надпись на фронтоне - только спереди
    });
  }
  if (D3) (function () {
    var tw = 0, touched = false;
    function to(goal, dur) {
      cancelAnimationFrame(tw); var a = D3R, t0 = performance.now();
      (function st(now) {
        var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        D3R = a + (goal - a) * e; apply();
        if (k < 1) tw = requestAnimationFrame(st); else tw = 0;
      })(t0);
    }
    function snap(v) { return Math.round(v / 90) * 90; }
    var dr = null, moved = false;
    house.addEventListener("pointerdown", function (e) {
      if (e.button) return;
      cancelAnimationFrame(tw); tw = 0;
      dr = { x: e.clientX, y: e.clientY, r: D3R, t: performance.now(), lx: e.clientX, v: 0, id: e.pointerId }; moved = false;
    });
    addEventListener("pointermove", function (e) {
      if (!dr || e.pointerId !== dr.id) return;
      var dx = e.clientX - dr.x;
      if (!moved) {
        if (Math.abs(e.clientY - dr.y) > 10 && Math.abs(dx) < 10) { dr = null; return; } // вертикально - это прокрутка
        if (Math.abs(dx) < 8) return;
        moved = true; touched = true; H.classList.add("d2-3go");
        try { house.setPointerCapture(e.pointerId); } catch (x) {}
      }
      var now = performance.now(), k = 200 / Math.max(280, house.offsetWidth);
      D3R = dr.r + dx * k;
      var dt = Math.max(8, now - dr.t); dr.v = dr.v * .4 + ((e.clientX - dr.lx) * k / dt) * .6; dr.lx = e.clientX; dr.t = now;
      apply();
    }, { passive: true });
    function up() {
      if (!dr) return;
      var d = dr; dr = null; H.classList.remove("d2-3go");
      if (!moved) return;
      var v = performance.now() - d.t > 90 ? 0 : d.v; // палец остановился - без разгона
      to(snap(D3R + Math.max(-140, Math.min(140, v * 260))), 650);
    }
    addEventListener("pointerup", up); addEventListener("pointercancel", up);
    // после поворота отпускание пальца над комнатой - не нажатие
    house.addEventListener("click", function (e) { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    house.addEventListener("dragstart", function (e) { e.preventDefault(); });
    // кнопки под домом
    var c = el("div", "d2-3c", '<button type="button" class="d2-3b" data-d="1" aria-label="Повернуть дом влево"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<span>Поверните дом</span><button type="button" class="d2-3b" data-d="-1" aria-label="Повернуть дом вправо"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>');
    house.parentNode.insertBefore(c, house.nextSibling);
    c.addEventListener("click", function (e) {
      var b = e.target.closest(".d2-3b"); if (!b) return;
      touched = true; to(snap(D3R) + 90 * (+b.getAttribute("data-d")), 900);
    });
    // подсказка: когда дом построился и опустился, он сам чуть поворачивается и возвращается - видно, что он объёмный
    var hintT = 0;
    new MutationObserver(function () {
      if (!home.classList.contains("enter") || hintT) return;
      hintT = setTimeout(function () {
        if (touched || mqR.matches) return;
        to(-32, 1100); setTimeout(function () { if (!touched && !dr) to(0, 1300); }, 1250);
      }, 5600);
    }).observe(home, { attributes: true, attributeFilter: ["class"] });
  })();
  // ---------- плавный вход: сначала фото комнат и кадр фона, потом анимация ----------
  // Фото закрытой витрины расшифровываются по одному; если начать вход сразу, анимация дёргается, а фото
  // появляются рывком. Поэтому грузим и декодируем их заранее (не дольше 3,5 с), вход держим на паузе (html.d2-wait).
  var READY = false, readyCbs = [];
  function whenReady(f) { if (READY) f(); else readyCbs.push(f); }
  (function () {
    var list = [], seen = {};
    (D.komnaty || []).forEach(function (k) {
      var w = (D.raboty || []).filter(function (r) { return r.komnata === k.id; })[0], f = w && (w.foto || [])[0];
      if (f && f.src) list.push(url(f.src));
    });
    if (tema === "kino") {
      var F1 = D.fon || {}, tall1 = innerHeight > innerWidth * 1.05, kd = tall1 ? (F1.kadr_tel || F1.kadr) : (F1.kadr || F1.kadr_tel);
      if (kd) list.unshift(url(kd));
    }
    var done = function () { if (READY) return; READY = true; var c = readyCbs; readyCbs = []; c.forEach(function (f) { f(); }); };
    var left = 0;
    list.forEach(function (u) {
      if (seen[u]) return; seen[u] = 1; left++;
      var im = new Image(), fin = function () { if (im) { im = null; if (--left <= 0) done(); } };
      im.decoding = "async"; im.onload = function () { if (im && im.decode) im.decode().then(fin, fin); else fin(); }; im.onerror = fin; im.src = u;
      (home.d2pre = home.d2pre || []).push(im); // держим ссылку, чтобы браузер не выбросил декодированное фото
    });
    if (SHR) { left++; window.D2Shrift.ready(D.shrift).then(function () { if (--left <= 0) done(); }); } // заставка - уже своими буквами
    if (!left) done();
    setTimeout(done, 3500);
  })();
  function enterGate() {
    if (READY) { startIntro(); return; }
    H.classList.add("d2-wait");
    whenReady(function () {
      // два кадра на раскладку, затем снимаем паузу - анимации входа идут с начала и без рывка
      requestAnimationFrame(function () { requestAnimationFrame(function () { H.classList.remove("d2-wait"); H.classList.add("d2-in"); setTimeout(function () { H.classList.remove("d2-in"); }, 1200); if (home.classList.contains("enter")) startIntro(); }); });
    });
  }
  // "Просто": дом сразу в своей проекции, без разворота (Александр: "резко, как лаг")
  function startIntro() { if (Q === 0 || PROSTO) { kick(); return; } intro = { t0: performance.now(), dur: 2300 }; frames = 0; slow = 0; cur = { ry: -58, rx: -14, tz: -240 }; apply(); kick(); }
  // puteshestvie.js добавляет #home.enter при входе на главную (после дверей или по прямой ссылке)
  // "Просто": надписи первого экрана появляются по буквам (подзаголовок - как печать) и по словам (заголовок)
  function splitHero() {
    if (!PROSTO || home.d2split) return; home.d2split = 1;
    var ht = home.querySelector(".hero-t"); if (!ht) return;
    var eye = ht.querySelector(".d2-eye"), h1 = ht.querySelector("h1"), c = 0;
    if (eye && eye.textContent.trim()) {
      eye.setAttribute("aria-label", eye.textContent);
      eye.innerHTML = eye.textContent.split(/(\s+)/).map(function (w) {
        if (/^\s+$/.test(w) || !w) return w;
        return '<span class="d2-w" aria-hidden="true">' + w.split("").map(function (ch) { return '<span class="d2-ch" style="--c:' + (c++) + '">' + esc(ch) + "</span>"; }).join("") + "</span>";
      }).join("");
    }
    if (h1 && h1.textContent.trim()) {
      var k = 0; h1.setAttribute("aria-label", h1.textContent);
      h1.innerHTML = h1.textContent.trim().split(/\s+/).map(function (w) { return '<span class="d2-wd" aria-hidden="true"><span style="--c:' + (k++) + '">' + esc(w) + "</span></span>"; }).join(" ");
    }
  }
  new MutationObserver(function () { if (home.classList.contains("enter") && !home.d2in) { home.d2in = 1; splitHero(); enterGate(); } if (!home.classList.contains("enter")) home.d2in = 0; })
    .observe(home, { attributes: true, attributeFilter: ["class"] });
  // цикл работает только когда дом виден
  function loopCheck() {
    var vis = B.getAttribute("data-vp") === "home" && !B.classList.contains("pn-open") && (!MON || PROSTO) && !document.hidden; // в "Просто" меню полупрозрачное - видео за ним идёт
    if (vis) vgoLater();
    live = vis;
    if (vis) kick(); else if (raf) { cancelAnimationFrame(raf); raf = 0; last = 0; }
    video(vis);
  }
  new MutationObserver(loopCheck).observe(B, { attributes: true, attributeFilter: ["data-vp", "class"] });
  document.addEventListener("visibilitychange", loopCheck);
  apply();

  // ---------- "Линия" и "Силуэт": контур фронтона ----------
  if (tema === "liniya" || DOM === "siluet" || DOM === "linii") {
    roof.insertAdjacentHTML("afterbegin", '<svg class="d2-rl" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="50,0.8 99.6,99.6 0.4,99.6" pathLength="1" vector-effect="non-scaling-stroke"/></svg>');
  }

  // ---------- разделы: фото проявляются при прокрутке ----------
  var pnSc = $("pnSc"), io = null;
  function reveal() {
    var av = pnSc.querySelector(".pme .av");
    if (av && LOGO && !av.style.backgroundImage) { av.innerHTML = LOGO; av.classList.add("d2-av"); }
    if (io) io.disconnect();
    var pws = pnSc.querySelectorAll(".pw");
    if (!pws.length) return;
    if (Q === 0 || !window.IntersectionObserver) { [].forEach.call(pws, function (p) { p.classList.add("in"); }); return; }
    var cols = innerWidth > 900 ? 3 : 2;
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var p = e.target, i = [].indexOf.call(pws, p);
        p.style.transitionDelay = ""; [].forEach.call(p.querySelectorAll("img,.pt"), function (x) { x.style.transitionDelay = ((i % cols) * 0.09) + "s"; });
        p.classList.add("in"); io.unobserve(p);
      });
    }, { root: pnSc, rootMargin: "0px 0px -6% 0px", threshold: .12 });
    [].forEach.call(pws, function (p) { io.observe(p); });
  }
  if (pnSc) new MutationObserver(reveal).observe(pnSc, { childList: true });

  // ---------- "Кино": видео на фоне первого экрана ----------
  var KV = null;
  // "Просто": видео фона запускается, когда дом уже собрался и опустился - старт видео (декодер) во время
  // анимации входа давал рывки на телефоне. До этого виден неподвижный кадр.
  var VGO = !PROSTO, vgoT = 0;
  function vgoLater() { if (VGO || vgoT) return; vgoT = setTimeout(function () { VGO = true; loopCheck(); }, Q === 0 || mqR.matches ? 600 : 5600); }
  function video(on) {
    if (!KV || !KV.v) return;
    if (on && KV.ok && VGO) { var p = KV.v.play(); if (p && p.catch) p.catch(function () {
      // встроенный браузер мессенджера может не дать играть само - запускаем при первом касании
      if (KV.retry) return; KV.retry = 1;
      var f = function () { removeEventListener("touchend", f, true); removeEventListener("click", f, true); if (live && VGO) { var q = KV.v.play(); if (q && q.catch) q.catch(function () {}); } };
      addEventListener("touchend", f, true); addEventListener("click", f, true);
    }); }
    else if (!on) KV.v.pause();
  }
  if (tema === "kino") {
    var layer = el("div", "d2-kino", '<div class="d2-kbg"></div><i class="d2-veil"></i>'); layer.setAttribute("aria-hidden", "true");
    home.insertBefore(layer, home.firstChild);
    var reels = $("reels"), ft = home.querySelector(".foot");
    if (reels) reels.classList.add("d2-light"); if (ft) ft.classList.add("d2-light");
    // "13. Просто": одна тёмная страница. Фон (кадр/видео) тянется под весь первый экран вместе с высоким домом,
    // а раздел видео и подвал остаются тёмными, со своим медленным фоном из фото работ (.d2-low, стили в d2.css)
    if (PROSTO) {
      if (reels) reels.classList.remove("d2-light"); if (ft) ft.classList.remove("d2-light");
      var hero0 = home.querySelector(".hero");
      var kh = function () { if (hero0) layer.style.height = Math.max(innerHeight, hero0.offsetTop + hero0.offsetHeight) + "px"; };
      kh(); addEventListener("resize", kh);
      if (window.ResizeObserver && hero0) new ResizeObserver(kh).observe(hero0);
      // дом ниже: при входе на экране только чердак, над ним видно фон. Дом рисуется выше и плавно опускается
      // (обёртка .d2-hw: на ней сдвиг и перспектива, поворот остаётся на самом доме)
      var hw = el("div", "d2-hw"); house.parentNode.insertBefore(hw, house); hw.appendChild(house);
      var drop = function () {
        hw.style.marginTop = "0px";
        var top = house.offsetTop + roof.offsetTop; // от верха страницы (#home), без учёта сдвигов и прокрутки
        for (var op = hw; op && op !== home; op = op.offsetParent) top += op.offsetTop;
        var want = innerHeight * (NARROW.matches ? .75 : .72), d = Math.max(0, Math.round(want - top));
        hw.style.marginTop = d + "px"; hw.style.setProperty("--hd", d + "px");
      };
      // пересчёт только при смене ширины: на телефоне при прокрутке прячется адресная строка, меняется высота окна,
      // и пересчёт по высоте двигал дом прямо под пальцем ("дом подпрыгивает")
      var dropW = innerWidth; drop();
      addEventListener("resize", function () { if (Math.abs(innerWidth - dropW) > 1) { dropW = innerWidth; drop(); } }); if (document.fonts && document.fonts.ready) document.fonts.ready.then(drop);
      new MutationObserver(drop).observe(hero0.querySelector(".hero-t") || hero0, { childList: true, subtree: true, characterData: true });
      // чем ближе к дому, тем спокойнее фон: поверх видео темнеет слой (только прозрачность - дёшево и на слабых)
      var calm = el("i", "d2-calm"); layer.appendChild(calm);
      var calmT = 0, calmF = function () {
        calmT = 0;
        var hd = parseFloat(hw.style.marginTop) || innerHeight * .5, k = Math.max(0, Math.min(1, home.scrollTop / Math.max(120, hd * .9)));
        calm.style.opacity = (k * .62).toFixed(3);
      };
      home.addEventListener("scroll", function () { if (!calmT) calmT = requestAnimationFrame(calmF); }, { passive: true });
      if (reels) {
        reels.classList.add("d2-low");
        var low = el("div", "d2-lbg", '<i class="d2-lglow"></i><i class="d2-lveil"></i>'); low.setAttribute("aria-hidden", "true");
        reels.insertBefore(low, reels.firstChild);
        // фото берём с конца списка работ, чтобы не повторять первый экран; грузим, только когда до раздела докрутили
        var lows = [], ws = D.raboty || [];
        for (var li = ws.length - 1; li >= 0 && lows.length < 3; li--) { var lf = (ws[li].foto || [])[0]; if (lf && lf.src) lows.push(url(lf.src)); }
        if (Q === 0) lows = lows.slice(0, 1);
        var lowOn = function () {
          lows.forEach(function (c, k) { var s = el("i", "d2-ls"); s.style.backgroundImage = 'url("' + c.replace(/"/g, "%22") + '")'; s.style.setProperty("--k", k); s.style.setProperty("--n", lows.length); low.insertBefore(s, low.firstChild); });
          low.classList.toggle("one", lows.length === 1);
          requestAnimationFrame(function () { low.classList.add("on"); });
        };
        if (window.IntersectionObserver) new IntersectionObserver(function (es, o) { es.forEach(function (e) { if (e.isIntersecting) { lowOn(); o.disconnect(); } }); }, { rootMargin: "60% 0px" }).observe(reels);
        else lowOn();
      }
      // раздел видео проявляется, когда до него докрутили (без IntersectionObserver - сразу виден)
      if (reels) {
        if (window.IntersectionObserver) new IntersectionObserver(function (es, o) { es.forEach(function (e) { if (e.isIntersecting) { reels.classList.add("d2-vis"); o.disconnect(); } }); }, { rootMargin: "0px 0px -18% 0px" }).observe(reels);
        else reels.classList.add("d2-vis");
      }
    }
    var F0 = D.fon || {}, tall = innerHeight > innerWidth * 1.05;
    var vsrc = url(tall ? (F0.video_tel || F0.video) : (F0.video || F0.video_tel));
    var kadr = url(tall ? (F0.kadr_tel || F0.kadr) : (F0.kadr || F0.kadr_tel));
    var bg = layer.firstChild;
    if (vsrc) {
      if (kadr) bg.style.backgroundImage = 'url("' + kadr.replace(/"/g, "%22") + '")';
      whenReady(function () { bg.classList.add("rdy"); });
      // видео (1-1,6 МБ) качаем после входа, чтобы оно не отнимало канал и процессор у фото комнат
      // видео-фон и на "слабом" уровне: его декодирует сам телефон, это дёшево; без видео только при экономии трафика
      // или просьбе системы меньше движения (раньше Q=0 выключал видео - на части айфонов фон стоял картинкой)
      if (!mqR.matches && !cn.saveData) whenReady(function () { setTimeout(function () {
        var v = el("video"); v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("muted", ""); v.preload = "auto";
        if (kadr) v.poster = kadr;
        KV = { v: v, ok: false };
        // закрытая витрина отдаёт файлы через служебный работник без "кусочных" ответов - Safari такое видео не играет.
        // Поэтому скачиваем целиком (1-1,6 МБ) и играем из памяти.
        // без служебного работника видео расшифровывается в фоне - ждём, когда будет готово (KrZamok.when)
        (window.KrZamok && KrZamok.when ? KrZamok.when(vsrc) : Promise.resolve(vsrc)).then(function (u) { return fetch(u); }).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(function (buf) {
          // своё видео мастера из Мастерской может быть записано в WebM (Chrome на Android) - тип по первым байтам
          var u8 = new Uint8Array(buf, 0, Math.min(4, buf.byteLength)), webm = u8[0] === 0x1A && u8[1] === 0x45 && u8[2] === 0xDF && u8[3] === 0xA3;
          v.src = URL.createObjectURL(new Blob([buf], { type: webm ? "video/webm" : "video/mp4" }));
          v.addEventListener("playing", function () { layer.classList.add("vid"); }, { once: true });
          bg.appendChild(v); KV.ok = true; loopCheck();
        }).catch(function () {});
      }, 1600); });
    } else if (kadr) {
      // фон - одно фото (мастер выбрал в Мастерской фото работы вместо видео)
      bg.style.backgroundImage = 'url("' + kadr.replace(/"/g, "%22") + '")';
      layer.classList.add("vid"); whenReady(function () { bg.classList.add("rdy"); });
    } else {
      // запасной фон без видео: медленная смена фото работ
      var covers = [];
      (D.raboty || []).forEach(function (w) { var f = (w.foto || [])[0]; if (f && f.src && covers.length < 5) covers.push(url(f.src)); });
      for (var ci = 0; covers.length && covers.length < 5; ci++) covers.push(covers[ci]);
      covers.forEach(function (c, i) { var s = el("i", "d2-ks"); s.style.backgroundImage = 'url("' + c.replace(/"/g, "%22") + '")'; s.style.setProperty("--k", i); bg.appendChild(s); });
      layer.classList.add("vid", "slides"); whenReady(function () { bg.classList.add("rdy"); });
    }
  }

  // ---------- "Силуэт": фото комнаты на весь фон ----------
  if (DOM === "siluet") {
    var host = home.querySelector(".d2-kino") || home, rph = el("div", "d2-rph"), shown = null, hideT = 0;
    rph.setAttribute("aria-hidden", "true");
    var veil = host.querySelector(".d2-veil"); if (veil) host.insertBefore(rph, veil); else host.appendChild(rph);
    var LAY = {};
    function photoOf(r) { var ph = r.querySelector(".ph"); return ph && ph.style.backgroundImage; }
    function showRoom(r) {
      clearTimeout(hideT);
      if (r === shown) return; shown = r;
      [].forEach.call(floors.querySelectorAll(".room"), function (x) { x.classList.toggle("d2-on", x === r); });
      home.classList.toggle("d2-rph-on", !!r);
      var bgi = r && photoOf(r);
      [].forEach.call(rph.children, function (x) { x.classList.remove("on"); });
      if (!bgi) return;
      var k = r.getAttribute("aria-label") || bgi, lay = LAY[k];
      if (!lay) { lay = LAY[k] = el("i"); lay.style.backgroundImage = bgi; rph.appendChild(lay); }
      void lay.offsetWidth; lay.classList.add("on");
    }
    floors.addEventListener("pointerover", function (e) { if (e.pointerType !== "mouse") return; var r = e.target.closest(".room:not(.empty)"); if (r) showRoom(r); });
    floors.addEventListener("pointerleave", function (e) { if (e.pointerType !== "mouse") return; hideT = setTimeout(function () { showRoom(null); }, 350); });
    floors.addEventListener("focusin", function (e) { var r = e.target.closest(".room:not(.empty)"); if (r) showRoom(r); });
    floors.addEventListener("focusout", function () { hideT = setTimeout(function () { if (!floors.contains(document.activeElement)) showRoom(null); }, 200); });
    // телефон: puteshestvie.js отмечает .lit комнату посередине экрана при прокрутке
    new MutationObserver(function () { if (FINE) return; var l = floors.querySelector(".room.lit"); showRoom(l && home.scrollTop > 40 ? l : null); })
      .observe(floors, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  // ---------- журнал-"сцена" (window.D2_ZH): вместо перелистывания страниц ----------
  // Кадр стоит на месте, меняется содержимое: новое фото входит сбоку косой шторкой с лёгким сдвигом глубины,
  // маленькая плитка с деталью и подписи сменяются внутри своих рамок. Листание - горизонтально: палец, колесо, стрелки.
  // Рисует d2.js, а номер страницы, точки и открытие работы ведёт puteshestvie.js (хук window.VP_ZHURNAL).
  if (window.D2_ZH) (function () {
    H.setAttribute("data-d2zh", "1");
    var stage = $("roomStage"), sc = el("div", "d2-zs"), api = null, room = null, cur = 0, busy = null, drag = null;
    sc.id = "d2scena"; sc.setAttribute("role", "group"); sc.setAttribute("aria-roledescription", "журнал"); sc.setAttribute("aria-label", "Работы в комнате");
    sc.innerHTML = '<div class="d2-sf"><div class="d2-sl a"></div><div class="d2-sl b"></div><i class="d2-sv"></i>' +
      '<div class="d2-sn"><span></span></div><div class="d2-st"><i></i></div>' +
      '<div class="d2-sx"></div><i class="d2-sp"><i></i></i></div>';
    stage.appendChild(sc);
    var fr = sc.firstChild, LA = fr.querySelector(".d2-sl.a"), LB = fr.querySelector(".d2-sl.b"), top = LA,
      num = fr.querySelector(".d2-sn"), tile = fr.querySelector(".d2-st"), txt = fr.querySelector(".d2-sx"), bar = fr.querySelector(".d2-sp i");
    var ARR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    function e2(x) { return api.esc(x); }
    function layer(l, w) { l.innerHTML = '<img src="' + e2(api.cover(w)) + '" alt="" draggable="false" decoding="async">' + api.wm(api.fotos(w)[0]); l._w = w; }
    function tileSrc(w) { var f = (w.foto || [])[1]; return f && f.src ? { u: api.src(f), zoom: false } : { u: api.cover(w), zoom: true }; }
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function textHTML(w, i) {
      var t = (api.chist ? api.chist(w.rasskaz) : w.rasskaz) || (w.resheniya || []).join(". "), meta = api.meta ? api.meta(w) : [w.gde, w.material, w.cvet, w.srok ? "Срок: " + w.srok : ""].filter(Boolean);
      return '<div class="d2-sxi"><h3>' + e2(w.nazvanie) + "</h3>" + (meta.length ? '<p class="m">' + meta.map(e2).join(" · ") + "</p>" : "") +
        (t ? '<p class="x">' + e2(t) + "</p>" : "") + '<button type="button" class="d2-ln d2-sgo" data-open="' + i + '">Смотреть работу' + ARR + "</button></div>";
    }
    function setSide(i, dir, anim) { // номер, плитка, текст: старое уезжает, новое въезжает с той же стороны, что и фото
      var w = room.works[i], n = room.works.length, ts = tileSrc(w), cls = anim ? (dir > 0 ? " in-r" : " in-l") : "";
      var oldN = num.lastChild, nn = el("span", cls.trim(), "[ " + pad(i + 1) + " / " + pad(n) + " ]");
      var oldT = tile.lastChild, nt = el("i", (ts.zoom ? "z" : "") + cls); nt.style.backgroundImage = 'url("' + ts.u.replace(/"/g, "%22") + '")';
      var oldX = txt.lastChild, nx = el("div", "d2-sxw" + cls, textHTML(w, i));
      num.appendChild(nn); tile.appendChild(nt); txt.appendChild(nx);
      [oldN, oldT, oldX].forEach(function (o) {
        if (!o) return;
        if (!anim) { o.remove(); return; }
        o.classList.remove("in-r", "in-l"); o.classList.add(dir > 0 ? "out-l" : "out-r");
        setTimeout(function () { o.remove(); }, 700);
      });
      tile.setAttribute("data-open", i);
      bar.style.transform = "scaleX(" + ((i + 1) / n).toFixed(4) + ")";
    }
    function setP(l, p, dir) { l.style.setProperty("--p", p.toFixed(4)); l.style.setProperty("--d", dir); }
    function lite() { return api.lite() || Q === 0; }
    function finish(b, done) {
      var nw = b.nw, old = b.old;
      nw.classList.remove("en"); old.classList.remove("ex"); nw.style.removeProperty("--p"); old.style.removeProperty("--p");
      if (done) { old.classList.remove("on"); old.innerHTML = ""; nw.classList.add("on"); top = nw; }
      else { nw.classList.remove("on"); nw.innerHTML = ""; }
      fr.classList.remove("mv"); busy = null;
    }
    function prep(i, dir) {
      var nw = top === LA ? LB : LA, old = top;
      layer(nw, room.works[i]);
      nw.classList.add("en", "on"); old.classList.add("ex"); fr.classList.add("mv"); fr.setAttribute("data-dir", dir);
      setP(nw, 0, dir); setP(old, 0, dir);
      return { nw: nw, old: old, i: i, dir: dir, p: 0 };
    }
    function run(b, to, dur, cb) {
      var p0 = b.p, t0 = 0;
      function ease(t) { return 1 - Math.pow(1 - t, 3.2); }
      b.raf = requestAnimationFrame(function step(now) {
        if (b.dead) return;
        if (!t0) t0 = now;
        var k = Math.min(1, (now - t0) / dur), p = p0 + (to - p0) * ease(k);
        b.p = p; setP(b.nw, p, b.dir); setP(b.old, p, b.dir);
        if (k < 1) b.raf = requestAnimationFrame(step); else cb();
      });
    }
    function go(i, dir) {
      if (busy) return false;
      if (lite()) { // слабый телефон или "без анимаций": мягкая смена без шторки
        var nw = top === LA ? LB : LA, old = top; layer(nw, room.works[i]);
        nw.classList.add("on", "fade"); top = nw; setSide(i, dir, false); cur = i;
        setTimeout(function () { old.classList.remove("on"); old.innerHTML = ""; nw.classList.remove("fade"); }, 380);
        return true;
      }
      var b = busy = prep(i, dir); cur = i; setSide(i, dir, true);
      var im = b.nw.querySelector("img"), started = false;
      var start = function () { if (started || b.dead) return; started = true; run(b, 1, 1150, function () { finish(b, true); }); };
      if (im && im.decode) im.decode().then(start, start); else start();
      setTimeout(start, 260);
      return true;
    }
    function bump(dir) {
      if (!fr.animate || lite()) return;
      fr.animate([{ transform: "none" }, { transform: "translateX(" + (-dir * 14) + "px)" }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(.22,1,.36,1)" });
    }
    function size() {
      var r = stage.getBoundingClientRect(), W = r.width, Hh = r.height, narrow = W < 720;
      var w = narrow ? W - 20 : Math.min(W - 48, 1240, (Hh - 8) * 1.9), h = narrow ? Hh - 6 : Math.min(Hh - 8, w / 1.62);
      fr.style.width = Math.round(w) + "px"; fr.style.height = Math.round(Math.max(200, h)) + "px";
      sc.classList.toggle("nar", narrow);
    }
    window.VP_ZHURNAL = {
      build: function (r, i, anim, a) {
        api = a; room = r; cur = i;
        if (busy) { busy.dead = true; cancelAnimationFrame(busy.raf); busy = null; }
        [LA, LB].forEach(function (l) { l.className = "d2-sl " + (l === LA ? "a" : "b"); l.innerHTML = ""; l.style.removeProperty("--p"); });
        num.innerHTML = ""; tile.innerHTML = ""; txt.innerHTML = ""; fr.classList.remove("mv");
        top = LA; layer(LA, r.works[i]); LA.classList.add("on");
        size(); setSide(i, 1, false);
        sc.classList.remove("go"); if (anim) { void sc.offsetWidth; sc.classList.add("go"); }
      },
      go: go, bump: bump,
      el: function () { return top.querySelector("img"); }
    };
    if (window.ResizeObserver) new ResizeObserver(function () { if (room && !stage.hidden) size(); }).observe(stage);
    // палец или мышь: шторка идёт за движением, отпустили - доезжает или возвращается
    fr.addEventListener("pointerdown", function (e) { if (e.button > 0 || busy || !room) return; drag = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now(), lx: e.clientX, v: 0, tgt: e.target }; });
    fr.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x;
      if (!drag.b) {
        if (Math.abs(dx) < 9 || Math.abs(dx) < Math.abs(e.clientY - drag.y)) return;
        var dir = dx < 0 ? 1 : -1, ni = cur + dir;
        if (ni < 0 || ni >= room.works.length) { drag = null; api.turn(dir); return; } // край: подскок и подсказка
        if (lite()) { drag = null; api.turn(dir); return; }
        drag.b = busy = prep(ni, dir); fr.classList.add("drag");
        try { fr.setPointerCapture(drag.id); } catch (er) {}
      }
      var now = performance.now(); drag.v = (e.clientX - drag.lx) / Math.max(1, now - drag.t); drag.lx = e.clientX; drag.t = now;
      var b = drag.b; b.p = Math.max(0, Math.min(1, (-dx * b.dir) / (fr.offsetWidth * .8)));
      setP(b.nw, b.p, b.dir); setP(b.old, b.p, b.dir);
    });
    function up(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag; drag = null; fr.classList.remove("drag");
      if (d.b) {
        var b = d.b, fl = performance.now() - d.t < 120 ? -d.v * b.dir : 0, done = e.type === "pointerup" && (b.p > .3 || fl > .35);
        if (done) {
          // страницу ведёт puteshestvie.js: сообщаем ему о смене, а шторку доводим сами
          busy = null; var keep = b; window.VP_ZHURNAL.go = function () { window.VP_ZHURNAL.go = go; busy = keep; cur = keep.i; setSide(keep.i, keep.dir, true); return true; };
          api.turn(b.dir);
          run(keep, 1, Math.round(260 + 520 * (1 - keep.p)), function () { finish(keep, true); });
        } else run(b, 0, Math.round(200 + 360 * b.p), function () { finish(b, false); });
        return;
      }
      if (e.type !== "pointerup" || busy) return;
      if (d.tgt.closest && d.tgt.closest("[data-open]")) { api.open(cur); return; }
      var r = fr.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
      if (x > .72) api.turn(1); else if (x < .28) api.turn(-1); else api.open(cur);
    }
    fr.addEventListener("pointerup", up); fr.addEventListener("pointercancel", up);
    fr.addEventListener("click", function (e) { if (e.detail === 0 && e.target.closest("[data-open]")) api.open(cur); }); // клавиатура
    var wA = 0, wT = 0;
    fr.addEventListener("wheel", function (e) {
      e.preventDefault();
      var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY, now = performance.now();
      if (now - wT > 320) wA = 0;
      wA += d;
      if (Math.abs(wA) > 50 && now - wT > 320 && !busy) { api.turn(wA > 0 ? 1 : -1); wA = 0; wT = now; }
    }, { passive: false });
  })();

  // ---------- "Просто": экран работы (Александр, 2026-11-23, телефон) ----------
  // Панель описания: одна ручка посередине (без "Подробнее/Свернуть" и стрелок), тонкая кнопка "Обсудить такую же",
  // "На весь экран" - значок в углу. Во весь экран нажатие на фото показывает описание: материал, цвет, размеры, год,
  // рассказ (только то, что мастер заполнил; служебные пометки черновика убирает puteshestvie.js).
  if (PROSTO) (function () {
    window.VP_RUCHKA = true; window.VP_HOCHU = "Обсудить такую же"; window.VP_ZAST_ROL = true; // на заставке без города
    var wk = $("work"), pb = $("panoBtn"); if (!wk || !pb) return;
    var FS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
    var fs = el("button", "d2-fs", FS); fs.type = "button"; fs.setAttribute("aria-label", "Фото на весь экран"); fs.title = "На весь экран";
    fs.onclick = function () { pb.click(); };
    wk.appendChild(fs);
    var cap = el("div", "d2-cap"); cap.setAttribute("aria-live", "polite"); wk.appendChild(cap);
    var ib = el("button", "d2-cib", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></svg><span>Описание</span>');
    ib.type = "button"; wk.appendChild(ib);
    function capHTML() {
      var t = $("sTitle") ? $("sTitle").textContent : "", ch = [].map.call(document.querySelectorAll("#sChips span"), function (x) { return x.textContent; });
      var st = $("sStoryWrap") && !$("sStoryWrap").hidden ? $("sStory").textContent : "";
      var sp = $("sSpecWrap") && !$("sSpecWrap").hidden ? [].map.call(document.querySelectorAll("#sSpec div"), function (d) { return "<span>" + esc(d.firstChild.textContent) + ":</span> " + esc(d.lastChild.textContent); }) : [];
      if (!ch.length && !st && !sp.length) return "";
      return "<b>" + esc(t) + "</b>" + (ch.length ? '<p class="m">' + ch.map(esc).join(" · ") + "</p>" : "") + (st ? '<p class="x">' + esc(st) + "</p>" : "") +
        (sp.length ? '<p class="x sp">' + sp.join("<br>") + "</p>" : "");
    }
    function sync() { // в полноэкранном режиме - есть ли что показать; при смене работы описание прячется
      var on = wk.classList.contains("pano"), h = on ? capHTML() : "";
      ib.classList.toggle("on", !!h);
      if (!on || !h) cap.classList.remove("on");
      else if (cap._h !== h) { cap.innerHTML = h; cap._h = h; cap.classList.remove("on"); }
      if (!cap.classList.contains("on") && wk.classList.contains("d2-capon")) wk.classList.remove("d2-capon"); // без лишней записи в class - иначе наблюдатель зациклится
    }
    function toggle() { sync(); if (!ib.classList.contains("on")) return; cap.classList.toggle("on"); wk.classList.toggle("d2-capon", cap.classList.contains("on")); }
    ib.onclick = function (e) { e.stopPropagation(); toggle(); };
    cap.onclick = function () { cap.classList.remove("on"); wk.classList.remove("d2-capon"); };
    new MutationObserver(sync).observe(wk, { attributes: true, attributeFilter: ["class"] });
    var st = $("sTitle"); if (st) new MutationObserver(sync).observe(st, { childList: true, characterData: true, subtree: true });
    // одиночное нажатие на фото (не перетаскивание и не двойное - оно приближает)
    var tp = null, tT = 0;
    wk.addEventListener("pointerdown", function (e) {
      if (!wk.classList.contains("pano") || e.target.closest("button,a,.d2-cap")) { tp = null; return; }
      if (tT) { clearTimeout(tT); tT = 0; tp = null; return; } // второе нажатие - двойное
      tp = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    wk.addEventListener("pointerup", function (e) {
      if (!tp) return; var d = tp; tp = null;
      if (Math.abs(e.clientX - d.x) > 8 || Math.abs(e.clientY - d.y) > 8 || performance.now() - d.t > 350) return;
      tT = setTimeout(function () { tT = 0; toggle(); }, 300);
    });
  })();

  // ---------- пробные страницы ----------
  // Варианты открываются по одному (просьба Александра, 2026-11-23): листать варианты внутри варианта
  // больше нельзя. Вернуться к списку - кнопка "← Варианты дизайна" в полосе сверху (#staff, shared/site.js).
})();
