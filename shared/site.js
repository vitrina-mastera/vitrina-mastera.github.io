/*
 * Общая часть сайта "Мебельный конструктор".
 * Подключается в каждый инструмент перед его адаптером.
 *
 * Что делает:
 *  - рисует верхнюю полоску: на главную, название инструмента, кнопка "Передать заказ";
 *  - передаёт заказ (общий формат mebel-order) между инструментами через память браузера
 *    (localStorage, один сайт - одна память), без копирования текста;
 *  - когда инструмент открыт с ?from=..., сам открывает в нём переданный заказ.
 *
 * Инструмент сообщает о себе так:
 *   MebelSite.register({
 *     get(),      // текущий заказ инструмента в общем формате, или null
 *     put(order), // открыть переданный заказ (можно бросить Error с понятным текстом)
 *     empty,      // что сказать, если get() вернул null
 *     extra       // [{label, run}] - дополнительные пункты меню
 *   });
 */
(function () {
  "use strict";
  var KEY = "mebel-site-order";      // {order, from, at}
  var STAFF = "mebel-site-staff";    // "1" - этим браузером пользуется мастер, а не клиент

  var TOOLS = [
    { id: "kalkulyator", name: "Калькулятор", full: "Калькулятор мебели", desc: "Шкафы-купе, кухни и любые корпусные изделия: детали, материалы и цена в рублях, тенге или другой валюте. Можно описать заказ голосом." },
    { id: "konfigurator", name: "Конфигуратор", full: "Конфигуратор для клиента", desc: "Клиент сам подбирает размеры, цвета фасадов и столешницу в 3D и отправляет заявку в WhatsApp." },
    { id: "kp", name: "КП и договор", full: "КП и договор в PDF", desc: "Коммерческое предложение и договор с вашими реквизитами - готовый PDF для клиента." },
    { id: "raskroy", name: "Раскрой", full: "Карта раскроя", desc: "Раскладка деталей по листам ЛДСП с учётом пропила, текстуры и остатков. Этикетки на детали." },
    { id: "zakazy", name: "Учёт заказов", full: "Учёт заказов", desc: "Все заказы по этапам: замер, договор, производство, монтаж. Оплаты, расходы и напоминания." }
  ];

  // Варианты продукта на одном сайте. Каждый собран по пожеланиям своего мастера; потом из всех
  // соберём одно итоговое. Новый вариант = одна запись здесь + его папка в site/ (см. build.py).
  // pages - какие страницы сайта относятся к варианту (по MEBEL_TOOL), path - адрес от корня сайта.
  var VARIANTS = [
    { id: "v1", n: 1, name: "Мебельный конструктор", short: "Конструктор", path: "konstruktor/",
      pages: ["home", "kalkulyator", "konfigurator", "kp", "raskroy", "zakazy"],
      who: "Полный набор для мастерской: точный расчёт и документы",
      points: ["Точный расчёт деталей и листов", "Конфигуратор 3D для клиента", "КП и договор в PDF, карта раскроя", "Учёт заказов, оплаты, напоминания"] },
    { id: "v2", n: 2, name: "Блокнот мастера", short: "Блокнот", path: "bloknot/", isNew: true,
      pages: ["bloknot"],
      who: "Для мастера, который работает по эскизу: гибко и без бухгалтерии",
      points: ["Любые замеры и нюансы голосом: выступы, тайники, ящик длиннее", "Вопросы по нюансам: бок, подсветка, вентиляция, фрезеровка", "Правки клиента списком и как менялась цена", "ТЗ для цеха с \"Внимание\", запрос для ИИ-рендера"] },
    { id: "v3", n: 3, name: "Витрина мастера", short: "Мастера", path: "vitrina/", isNew: true, group: "vg",
      pages: ["vitrina", "vitrina-red"],
      who: "Сайт для клиентов: работы, отзывы и расчёт по одной ссылке из мессенджера",
      points: ["Работы как сторис: фото с водяным знаком и рассказ", "Отзывы с кодом заказа и ссылкой на фото работы", "Быстрый расчёт вилки цены и заявка в WhatsApp", "Мастерская: фото и рассказ голосом с телефона"] },
    { id: "v4", n: 4, name: "Витрина: путешествие по дому", sub: "Путешествие по дому", short: "Путешествие", path: "vitrina/puteshestvie/", isNew: true, group: "vg",
      pages: ["vitrina-put"],
      who: "Та же витрина, но клиент не листает, а ходит по дому мастера: комната за комнатой",
      points: ["Дом в разрезе: каждая комната - раздел работ", "Работы 3D-лентой, фото на весь экран", "Точки на фото: наезд на деталь и рассказ", "\"Хочу так же\" - готовое сообщение в WhatsApp"] },
    { id: "v5", n: 5, name: "Витрина для Краснодара", sub: "Для Краснодара", short: "Краснодар", path: "krasnodar/", isNew: true, locked: true, group: "vg",
      pages: ["krasnodar", "kr-vitrina", "kr-dom", "kr-dizajn"],
      who: "Закрытая витрина с настоящими работами мастера: вход только по пин-коду",
      points: ["Главная - путешествие по дому с работами мастера, под домом видео", "Фото и тексты зашифрованы, без пин-кода их не открыть", "Мастер проверяет подписи работ и отвечает на вопросы", "Отзыв и ответы уходят Александру в WhatsApp"] }
  ];
  // В верхней полосе витрины собраны в одну вкладку "Витрины": нажал - экран выбора (vitriny/),
  // а на странице любой витрины под полосой - вторая строка: мастера / путешествие / Краснодар.
  var VG = { id: "vg", n: 3, name: "Витрины", short: "Витрины", path: "vitriny/", pages: ["vitriny"],
    kids: VARIANTS.filter(function (v) { return v.group === "vg"; }) };
  var TABS = VARIANTS.filter(function (v) { return !v.group; }).concat([VG]);
  VG.n = TABS.length;
  var LOCK = '<svg class="ms-lock" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/></svg>';

  var me = window.MEBEL_TOOL || "home";
  // единый вид сайта: общая палитра из site.css (всегда светлая) и метка инструмента для точечных правок
  try { document.documentElement.setAttribute("data-theme", "light"); document.documentElement.setAttribute("data-tool", me); } catch (e) {}
  var adapter = null, queued = [];

  // --- память ---
  function read() { try { var v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && v.order ? v : null; } catch (e) { return null; } }
  function write(order, from) {
    var rec = { order: order, from: from, at: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(rec)); return true; }
    catch (e) { toast("Не хватило памяти браузера, чтобы передать заказ. Сохраните его файлом."); return false; }
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  function isStaff() { try { return localStorage.getItem(STAFF) === "1"; } catch (e) { return false; } }
  function setStaff() { try { localStorage.setItem(STAFF, "1"); } catch (e) {} }

  // --- мелочи ---
  function tool(id) { for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i].id === id) return TOOLS[i]; return null; }
  function toolName(id) { var t = tool(id); return t ? t.name : id === "home" ? "Конструктор" : id === "start" ? "Главная" : id === "instrumenty" ? "Инструменты" : id === "file" ? "Файл" : id === "bloknot" ? "Блокнот мастера" : id === "vitrina" ? "Витрина мастера" : id === "vitrina-red" ? "Мастерская витрины" : id === "vitrina-put" ? "Витрина: путешествие" : id === "vitriny" ? "Витрины" : /^(krasnodar|kr-)/.test(id) ? "Витрина для Краснодара" : id; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // "start" - стартовая страница (корень сайта), "home" - главная Конструктора (konstruktor/, в ней <base href="../">)
  function root() { return me === "home" || me === "start" ? "./" : me === "vitrina-red" || me === "vitrina-put" || me === "kr-vitrina" || me === "krasnodar" || me === "kr-dizajn-list" || me === "kr-masterskaya" || me === "kr-klient" || me === "kr-proba" || me === "kr-novaya" || me === "kr-raschet" ? "../../" : me === "kr-dizajn" ? "../../../" : "../"; } // krasnodar = вопросы мастеру (krasnodar/master/), kr-dom = главная krasnodar/, kr-dizajn-list = krasnodar/dizajn/, kr-dizajn = krasnodar/dizajn/vN/
  function urlOf(id) { return id === "start" ? root() : root() + (id === "home" ? "konstruktor" : id) + "/"; }
  function money(n, cur) {
    if (window.MebelOrder) return MebelOrder.money(n, cur || MebelOrder.region().currency);
    n = Math.round(+n || 0); return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸";
  }
  function summary(order) {
    if (!order) return null;
    var p = (order.products || [])[0] || {};
    var title = order.title || p.name || "Заказ";
    if (order.number) title = "№ " + order.number + " - " + title;
    var q = order.quote || {};
    return { title: title, client: (order.client && order.client.name) || "", total: q.total || 0, cur: order.currency || "KZT", products: (order.products || []).length };
  }
  function ago(iso) {
    var d = (Date.now() - new Date(iso).getTime()) / 60000;
    if (!(d >= 0)) return "";
    if (d < 1) return "только что";
    if (d < 60) return Math.round(d) + " мин. назад";
    if (d < 60 * 24) return Math.round(d / 60) + " ч. назад";
    return new Date(iso).toLocaleDateString("ru-RU");
  }
  var toastT = 0;
  function toast(text) {
    var el = document.getElementById("msToast");
    if (!el) { el = document.createElement("div"); el.id = "msToast"; document.body.appendChild(el); }
    el.textContent = text; el.className = "on";
    clearTimeout(toastT); toastT = setTimeout(function () { el.className = ""; }, 3200);
  }

  // --- пометка "Обновление" и подсказка "Доступно обновление" ---
  // VER вшивает build.py при сборке; version.json на сервере - номер самой свежей сборки.
  var VER = {"v": "20261128022754", "at": "2026-11-28T02:27:54Z", "note": "Быстрый расчёт стоимости для клиента (пробно): krasnodar/raschet/, вход krasnodar/proba/, цены в Мастерской"};
  var MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  function verDate(v, withTime) {
    var d = v && new Date(v.at);
    if (!d || isNaN(d)) return "";
    var s = d.getDate() + " " + MONTHS[d.getMonth()];
    if (d.getFullYear() !== new Date().getFullYear()) s += " " + d.getFullYear();
    if (withTime) s += ", " + d.getHours() + ":" + ("0" + d.getMinutes()).slice(-2);
    return s;
  }
  // на главной - видная строка "Обновление: 15 ноября, 23:40" и что нового
  function updLabel() {
    var el = document.getElementById("msUpd");
    if (!el || !VER) return;
    el.innerHTML = '<b>Обновление: ' + esc(verDate(VER, true)) + "</b>" + (VER.note ? "<span>" + esc(VER.note) + "</span>" : "");
    el.hidden = false;
  }
  var lastCheck = 0;
  function checkUpdate() {
    if (!VER || !window.fetch || location.protocol === "file:" || document.getElementById("msNew") || me === "kr-klient" || me === "kr-proba" || me === "kr-novaya" || me === "kr-raschet") return; // клиенту мастера служебная подсказка не нужна
    if (Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    fetch(root() + "version.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (nv) { if (nv && nv.v && nv.v > VER.v) showNew(nv); })
      .catch(function () {});
  }
  function showNew(nv) {
    try { if (sessionStorage.getItem("ms-new-skip") === nv.v) return; } catch (e) {}
    if (document.getElementById("msNew")) return;
    var el = document.createElement("div");
    el.id = "msNew"; el.setAttribute("role", "status");
    el.innerHTML = '<div class="msn-t"><b>Доступно обновление сайта</b> от ' + esc(verDate(nv, true)) + (nv.note ? "<span>" + esc(nv.note) + "</span>" : "") + "</div>" +
      '<button type="button" class="msn-go">Обновить</button><button type="button" class="msn-x" aria-label="Позже">×</button>';
    el.querySelector(".msn-go").onclick = function () { reloadFresh(this); };
    el.querySelector(".msn-x").onclick = function () { try { sessionStorage.setItem("ms-new-skip", nv.v); } catch (e) {} el.remove(); };
    // под верхней полоской сайта, чтобы не закрывать "Передать заказ"
    var bar = document.getElementById("msBar"), r = bar && bar.getBoundingClientRect();
    if (r && r.bottom > 0) el.style.top = Math.round(r.bottom + 8) + "px";
    document.body.appendChild(el);
  }
  // Браузер мог запомнить старую страницу (GitHub Pages разрешает хранить её 10 минут),
  // поэтому сначала просим свежие файлы с сервера, потом перезагружаем.
  function reloadFresh(btn) {
    if (btn) { btn.disabled = true; btn.textContent = "Обновляю..."; }
    var urls = [location.href.split("#")[0], root() + "shared/site.js", root() + "shared/site.css", root() + "shared/golos.js"];
    var done = function () { location.reload(); };
    Promise.all(urls.map(function (u) { return fetch(u, { cache: "reload" }).catch(function () {}); })).then(done, done);
    setTimeout(done, 4000);
  }
  function watchUpdates() {
    updLabel();
    setTimeout(checkUpdate, 2500);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") checkUpdate(); });
    setInterval(checkUpdate, 10 * 60000);
  }

  // --- передача ---
  function currentOrder() {
    // свежий заказ из инструмента; если инструмент сам заказ не собирает - тот, что в него пришёл
    if (adapter && adapter.get) {
      var o = adapter.get();
      if (o) return o;
      if (!adapter.fallback) return null;
    }
    var rec = read();
    return rec ? rec.order : null;
  }
  function send(target) {
    var o;
    try { o = currentOrder(); } catch (e) { toast(e.message || "Не получилось собрать заказ"); return; }
    if (!o) { toast((adapter && adapter.empty) || "Здесь пока нет заказа, который можно передать"); return; }
    if (!write(o, me)) return;
    location.href = urlOf(target) + "?from=" + encodeURIComponent(me);
  }
  function download() {
    var o;
    try { o = currentOrder(); } catch (e) { toast(e.message); return; }
    if (!o) { toast((adapter && adapter.empty) || "Здесь пока нет заказа"); return; }
    saveFile(o);
  }
  function saveFile(o) {
    var name = window.MebelOrder && MebelOrder.fileName ? MebelOrder.fileName(o) : "zakaz.mebel.json";
    var blob = new Blob([JSON.stringify(o, null, 1)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }
  function receive(rec, quiet) {
    if (!adapter || !adapter.put) return;
    try {
      var r = adapter.put(rec.order);
      Promise.resolve(r).then(function (res) {
        if (res !== false && !quiet) toast("Открыт заказ из инструмента \"" + toolName(rec.from) + "\"");
      }, function (e) { toast(e && e.message ? e.message : "Не получилось открыть заказ"); });
    } catch (e) { toast(e && e.message ? e.message : "Не получилось открыть заказ"); }
  }
  function incoming() {
    var m = /[?&]from=([^&#]*)/.exec(location.search);
    if (!m) return;
    // убираем ?from= из адреса, чтобы обновление страницы не открывало заказ ещё раз
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
    var rec = read();
    if (!rec) return;
    // даём инструменту закончить свой запуск
    setTimeout(function () { receive(rec); }, 60);
  }

  // --- полоска сверху и меню ---
  function bar() {
    var t = tool(me);
    var el = document.createElement("div");
    el.id = "msBar";
    var host = adapter && adapter.mount ? document.querySelector(adapter.mount) : null;
    if (host) el.className = "inline";
    el.innerHTML =
      '<a class="ms-home" href="' + urlOf("home") + '" title="Назад: все инструменты Конструктора">' + BACK + '<span>Конструктор</span></a>' +
      '<a class="ms-home ms-start" href="' + urlOf("start") + '" title="На главную" aria-label="На главную">' + HOME + '</a>' +
      '<span class="ms-name">' + esc(t ? t.full : "") + "</span>" +
      '<button type="button" class="ms-send" id="msSend" title="Передать заказ в другой инструмент"><svg class="ms-ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M14 4l7 7-7 7v-4c-5 0-8.5 1.6-11 5 1-5 4-10 11-11z"/></svg><span>Передать заказ</span><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg></button>';
    if (host) host.insertBefore(el, host.firstChild); else document.body.insertBefore(el, document.body.firstChild);
    document.getElementById("msSend").onclick = openMenu;
  }
  function openMenu() {
    closeMenu();
    var rec = read();
    var h = '<div class="ms-card" role="dialog" aria-label="Передать заказ"><div class="ms-head"><b>Передать заказ</b><button type="button" class="ms-x" data-x aria-label="Закрыть">×</button></div>';
    h += '<p class="ms-note">Заказ откроется в выбранном инструменте. Копировать ничего не нужно.</p><div class="ms-list">';
    TOOLS.forEach(function (t) {
      if (t.id === me) return;
      h += '<button type="button" data-to="' + t.id + '"><b>' + esc(t.full) + "</b><span>" + esc(t.desc) + "</span></button>";
    });
    h += "</div>";
    var extra = (adapter && adapter.extra) || [];
    h += '<div class="ms-more">';
    extra.forEach(function (x, i) { h += '<button type="button" data-extra="' + i + '">' + esc(x.label) + "</button>"; });
    h += '<button type="button" data-dl>Скачать файл заказа (.mebel.json)</button>';
    h += '<a class="ms-fb" href="' + root() + 'otzyv/">Оставить отзыв о тестовой версии</a>';
    if (VER) h += '<p class="ms-ver">Обновление сайта: ' + esc(verDate(VER, true)) + "</p>";
    if (rec && rec.from !== me && adapter && adapter.put) {
      var s = summary(rec.order);
      h += '<button type="button" data-last>Открыть здесь последний переданный заказ: ' + esc(s.title) + (s.client ? ", " + esc(s.client) : "") + " (" + esc(toolName(rec.from)) + ", " + esc(ago(rec.at)) + ")</button>";
    }
    h += '<p class="ms-author">' + signHTML() + "</p>";
    h += "</div></div>";
    var wrap = document.createElement("div");
    wrap.id = "msMenu"; wrap.innerHTML = h;
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || e.target.closest("[data-x]")) return closeMenu();
      var b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-terms")) return; // окно условий откроет общий обработчик, меню закроется само
      if (b.dataset.to) { closeMenu(); send(b.dataset.to); }
      else if (b.hasAttribute("data-dl")) { closeMenu(); download(); }
      else if (b.hasAttribute("data-last")) { closeMenu(); receive(read()); }
      else if (b.dataset.extra) { closeMenu(); try { Promise.resolve(extra[+b.dataset.extra].run()).catch(function (er) { toast(er.message || String(er)); }); } catch (er) { toast(er.message || String(er)); } }
    });
    document.body.appendChild(wrap);
    document.addEventListener("keydown", escClose);
  }
  function escClose(e) { if (e.key === "Escape") closeMenu(); }
  function closeMenu() { var m = document.getElementById("msMenu"); if (m) m.remove(); document.removeEventListener("keydown", escClose); }


  // --- тихая подпись и условия использования ---
  // Имя автора на сайте не показываем (просьба Александра, 2026-11-21): внизу страниц только
  // неброская строка SIGN. Любой элемент с атрибутом data-terms открывает окно условий.
  var SIGN = "Разработка в тестовом режиме. Все права защищены.", YEAR = "2026";
  function signHTML() {
    return SIGN + ' <button type="button" class="ms-tlink" data-terms>Условия</button>';
  }
  // маленькая строка в самом низу страницы инструмента (у главной, Блокнота и витрины - свой подвал)
  function signLine() {
    if (document.getElementById("msSign") || document.querySelector("[data-sign]")) return;
    var p = document.createElement("p");
    p.id = "msSign"; p.innerHTML = signHTML();
    document.body.appendChild(p);
  }
  var TERMS = [
    'Сайт "Мебельный конструктор" и его инструменты - калькулятор, замер голосом, конфигуратор для клиента, КП и договор, карта раскроя, учёт заказов, Блокнот мастера, витрина мастера - работают в тестовом режиме.',
    "Тексты, расчёты и формулы, дизайн, интерфейс и код сайта защищены, все права на них сохраняются.",
    "Инструменты в свободном доступе. <b>Можно:</b> пользоваться ими в работе, давать клиентам ссылку на конфигуратор, делиться ссылкой на сайт.",
    "<b>Нельзя:</b> перепродавать инструменты или доступ к ним, копировать и выкладывать у себя, выдавать за своё.",
    "Ваши заказы, цены и клиенты хранятся в вашем браузере и остаются вашими.",
    "Сторонние части остаются под своими лицензиями: three.js (MIT) - 3D, pdfmake (MIT) - PDF документов, pdf.js (Apache 2.0) - чтение PDF, Tesseract.js (Apache 2.0) - чтение текста с фото, SheetJS (Apache 2.0) - таблицы Excel, шрифты Inter, Golos Text, Manrope, Cormorant Garamond и JetBrains Mono (SIL Open Font License 1.1).",
    "История разработки с датами правок сохраняется."
  ];
  function openTerms() {
    closeTerms(); closeMenu();
    var w = document.createElement("div");
    w.id = "msTerms";
    w.innerHTML = '<div class="ms-card" role="dialog" aria-modal="true" aria-labelledby="msTermsH"><div class="ms-head"><b id="msTermsH">Условия использования</b><button type="button" class="ms-x" data-tx aria-label="Закрыть">×</button></div>' +
      "<ul>" + TERMS.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>" +
      '<p class="ms-copy">© ' + YEAR + ". " + SIGN + "</p>" +
      '<button type="button" class="ms-ok" data-tx>Понятно</button></div>';
    w.addEventListener("click", function (e) { if (e.target === w || e.target.closest("[data-tx]")) closeTerms(); });
    document.body.appendChild(w);
    document.addEventListener("keydown", termsEsc, true);
    try { w.querySelector(".ms-ok").focus({ preventScroll: true }); } catch (e) {}
  }
  function termsEsc(e) { if (e.key === "Escape") { e.stopPropagation(); closeTerms(); } }
  function closeTerms() { var m = document.getElementById("msTerms"); if (m) m.remove(); document.removeEventListener("keydown", termsEsc, true); }
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-terms]") : null;
    if (t) { e.preventDefault(); openTerms(); }
  });

  // --- голос по всему сайту: переходы между инструментами, кнопки по названию ---
  // Работает в браузере (Web Speech API). Сам разбор фраз - здесь, на странице, без серверов.
  var NAV = [
    [/калькулятор|расчет|посчитать|смет/, "kalkulyator"], [/конфигуратор/, "konfigurator"],
    [/(^|\s)кп(\s|$)|коммерческ|договор|pdf|пдф/, "kp"], [/раскро|распил|раскладк/, "raskroy"],
    [/учет|заказы|список заказов|журнал/, "zakazy"], [/блокнот|вариант (2|два)|второй вариант/, "bloknot"], [/витрин|вариант (3|три)|третий вариант/, "vitriny"], [/главн|(^|\s)домой|начальн|выбор продукт|стартов/, "start"], [/^(все )?инструменты( мастера)?$/, "instrumenty"], [/меню сайта|конструктор|основно[йм] продукт|вариант (1|один)|первый вариант/, "home"]
  ];
  var VSTOP = { "нажми": 1, "нажать": 1, "кликни": 1, "кнопку": 1, "кнопка": 1, "на": 1, "открой": 1, "вкладку": 1, "вкладка": 1, "перейди": 1, "в": 1, "во": 1, "выбери": 1, "включи": 1, "пожалуйста": 1, "давай": 1, "покажи": 1, "раздел": 1, "пункт": 1 };
  function vn(t) { return String(t || "").toLowerCase().replace(/ё/g, "е").replace(/[.,!?;:"«»]/g, " ").replace(/\s+/g, " ").trim(); }
  function vstem(w) { return w.length > 5 ? w.slice(0, w.length > 7 ? 5 : 4) : w.length > 3 ? w.slice(0, 4) : w; }
  function visible(el) { if (!el || el.closest("#msVoice,#msMenu,#edBar,.hide")) return false; var r = el.getBoundingClientRect(); return (r.width > 0 || r.height > 0) && getComputedStyle(el).visibility !== "hidden"; }
  function labelOf(el) { return vn(el.getAttribute("aria-label") || el.innerText || el.value || el.title || ""); }
  function clickables() {
    var els = document.querySelectorAll("button,a[href],[role=tab],[role=button],summary,label,input[type=button],input[type=submit]");
    var out = [];
    for (var i = 0; i < els.length; i++) { var l = labelOf(els[i]); if (l && l.length < 60 && visible(els[i])) out.push({ el: els[i], l: l }); }
    return out;
  }
  function findButton(q) {
    var ws = vn(q).split(" ").filter(function (w) { return w.length > 1 && !VSTOP[w]; }).map(vstem);
    if (!ws.length) return null;
    var best = null;
    clickables().forEach(function (c) {
      var sc = 0; ws.forEach(function (w) { if ((" " + c.l).indexOf(" " + w) >= 0) sc += 1; else if (c.l.indexOf(w) >= 0) sc += 0.5; });
      if (c.l === ws.join(" ")) sc += 1;
      if (sc > 0 && (!best || sc > best.sc || (sc === best.sc && c.l.length < best.l.length))) best = { el: c.el, l: c.l, sc: sc };
    });
    return best && best.sc >= Math.max(1, Math.ceil(ws.length * 0.6)) ? best : null;
  }
  function voiceNav(text) {
    var t = vn(text), m, i;
    if (!t) return null;
    if (/^(назад|вернись назад|предыдущая страница)$/.test(t)) { history.back(); return "Назад"; }
    if (/^(прокрути|листай|промотай)[а-я]* (вниз|ниже)/.test(t) || t === "вниз") { window.scrollBy({ top: innerHeight * 0.7, behavior: "smooth" }); return "Прокручиваю вниз"; }
    if (/^(прокрути|листай|промотай)[а-я]* (вверх|выше|наверх)/.test(t) || t === "вверх" || t === "наверх") { window.scrollBy({ top: -innerHeight * 0.7, behavior: "smooth" }); return "Прокручиваю вверх"; }
    if (/^(скачай|сохрани)[а-я]* файл[а-я]* заказ/.test(t) && adapter) { download(); return "Скачиваю файл заказа"; }
    if (/^(какие|что) (здесь|тут) (есть )?(кнопки|можно (нажать|сделать))|^что на экране/.test(t)) {
      var ls = clickables().map(function (c) { return c.l; }).filter(function (l, k, a) { return a.indexOf(l) === k && l.length > 2; }).slice(0, 14);
      return "Можно нажать: " + ls.join(", ");
    }
    // правки самого инструмента (раньше переходов: "посудомойку" не должна открыть главную) (конфигуратор: "добавь верхние шкафы", "сдвинь мойку влево")
    if (adapter && adapter.voice) { try { var r = adapter.voice(t); if (r) return r; } catch (e) { return e.message; } }
    // передать заказ: "передай заказ в раскрой", "отправь в КП"
    if ((m = t.match(/^(передай|отправь|перекинь|перенеси)[а-я]*( заказ| расчет| проект)?( в| во)?(?=\s) (.+)$/))) {
      for (i = 0; i < NAV.length; i++) if (NAV[i][0].test(m[4]) && NAV[i][1] !== "home" && NAV[i][1] !== "start" && sameProduct(NAV[i][1])) {
        if (NAV[i][1] === me) return "Заказ уже здесь";
        setTimeout(function (id) { return function () { send(id); }; }(NAV[i][1]), 400); return "Передаю заказ в \"" + toolName(NAV[i][1]) + "\"";
      }
    }
    // переход: "открой раскрой", "перейди в учёт заказов", "на главную", или просто "раскрой"
    m = t.match(/^(открой|перейди|иди|пошли|давай|зайди|покажи|переключись)?[а-я]*( на| в| во| к)?(?=\s|$)\s*(.+)$/);
    var what = m ? m[3] : t, bare = !m || !m[1];
    if (!bare || what.split(" ").length <= 3) for (i = 0; i < NAV.length; i++) if (NAV[i][0].test(what) && !(bare && what.split(" ").length > 2)) {
      var id = NAV[i][1];
      if (id === me) return "Вы уже здесь: " + toolName(id);
      if (!sameProduct(id)) return "Это другой продукт. Скажите \"на главную\" и выберите его там.";
      setTimeout(function () { location.href = urlOf(id); }, 400);
      return "Открываю: " + toolName(id);
    }
    if (/^(открой |покажи )?(условия( использования)?|лицензи[а-я]*|об авторе|кто автор[а-я ]*|автор[а-я]* (сайта|разработки))$/.test(t)) { setTimeout(openTerms, 300); return "Открываю условия использования"; }
    if (/^отзыв|оставить отзыв|написать отзыв/.test(t)) { setTimeout(function () { location.href = root() + "otzyv/"; }, 400); return "Открываю отзыв"; }
    // кнопка по названию на текущей странице
    if ((m = t.match(/^(нажми|нажать|кликни|открой|выбери|включи|покажи|перейди)[а-я]*( на)?\s+(.+)$/)) || t.split(" ").length <= 3) {
      var b = findButton(m ? m[3] : t);
      if (b) { setTimeout(function () { try { b.el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {} b.el.click(); if (b.el.focus) try { b.el.focus(); } catch (e) {} }, 150); return "Нажимаю: " + b.l; }
    }
    return null;
  }
  // панель голоса (на страницах без своего голосового помощника)
  var VS = { rec: null, want: false, on: false, gen: 0 };
  // ответ вслух (shared/golos.js): пока говорит - микрофон на паузе, чтобы не услышать сам себя
  function speak(text, after) { if (window.MebelVoice) MebelVoice.say(text, after); else if (after) after(); }
  function voicePanel() {
    if (document.getElementById("msVoice")) return;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var mic = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
    var w = document.createElement("div"); w.id = "msVoice";
    w.innerHTML = '<button type="button" class="msv-pill" id="msvPill">' + mic + ' Голосом</button>' +
      '<div class="msv-panel" id="msvPanel" hidden><div class="msv-top"><b>Голосовой помощник</b><span id="msvSt"></span><button type="button" class="msv-set" id="msvSet" title="Отвечать вслух и каким голосом">звук</button><button type="button" class="msv-x" id="msvX" aria-label="Свернуть">&times;</button></div>' +
      '<div class="msv-tts" id="msvTts" hidden></div>' +
      '<div class="msv-log" id="msvLog"><div class="msv-info">' + (adapter && adapter.voiceHint ? esc(adapter.voiceHint) + " Или куда перейти: \"" + (me === "bloknot" ? "на главную" : "открой калькулятор") + "\"." : 'Скажите, куда перейти или что нажать: "открой калькулятор", "передай заказ в раскрой", "нажми сохранить", "что здесь можно нажать".') + '</div></div>' +
      '<div class="msv-live" id="msvLive" hidden></div>' +
      '<div class="msv-row">' + (SR ? '<button type="button" class="msv-mic" id="msvMic" title="Включить или выключить микрофон">' + mic + '<span> Говорить</span></button>' : '') + '<input id="msvIn" placeholder="' + (adapter && adapter.voiceHint ? "Что поменять или куда перейти" : "Куда перейти или что нажать") + '" autocomplete="off"><button type="button" class="msv-go" id="msvGo">OK</button></div></div>';
    document.body.appendChild(w);
    var $ = function (id) { return document.getElementById(id); }, log = $("msvLog");
    function add(cls, html) { var d = document.createElement("div"); d.className = cls; d.innerHTML = html; log.appendChild(d); while (log.children.length > 6) log.removeChild(log.firstChild); log.scrollTop = log.scrollHeight; }
    function run(text, byVoice) {
      text = String(text || "").trim(); if (!text) return;
      add("msv-q", "&laquo;" + esc(text) + "&raquo;");
      if (/^(стоп|хватит|выключи микрофон)$/.test(vn(text))) { stop(); return; }
      var r = voiceNav(text);
      if (r) { add("msv-ok", esc(r)); if (byVoice) talk(r); } else { add("msv-err", "Не понял. " + (adapter && adapter.voiceHint ? esc(adapter.voiceHint) : "Скажите, например: \"открой учёт заказов\" или \"нажми сохранить\".")); if (byVoice) talk("Не понял, скажите иначе"); }
    }
    function talk(t) { if (!window.MebelVoice || (MebelVoice.muted && MebelVoice.muted())) return; var was = VS.want; if (was) { VS.want = false; try { VS.rec && VS.rec.stop(); } catch (e) {} } speak(t, function () { if (was && !$("msvPanel").hidden) start(); }); }
    function show(o) { $("msvPanel").hidden = !o; $("msvPill").hidden = o; try { localStorage.setItem("ms-voice-open", o ? "1" : "0"); } catch (e) {} if (!o) stop(); }
    function setOn(o) { VS.on = o; var b = $("msvMic"); if (b) { b.className = "msv-mic" + (o ? " on" : ""); b.lastChild.textContent = o ? " Стоп" : " Говорить"; } $("msvSt").textContent = o ? "Микрофон включён" : ""; wait(); }
    // пока слушает - строка "Говорите..." видна всё время, между фразами не мигает
    function wait(txt) { var l = $("msvLive"); if (txt) { l.textContent = txt; l.hidden = false; return; } if (VS.want) { l.innerHTML = '<span class="msv-wait">Слушаю - говорите...</span>'; l.hidden = false; } else l.hidden = true; }
    function spawn() {
      var my = ++VS.gen, r = new SR(); VS.rec = r; r.lang = "ru-RU"; r.interimResults = true; r.continuous = !/android/i.test(navigator.userAgent);
      var done = -1;
      r.onresult = function (ev) { if (my !== VS.gen) return; var im = "";
        for (var i = ev.resultIndex; i < ev.results.length; i++) { var x = ev.results[i]; if (x.isFinal) { if (i > done) { done = i; wait("Принял: " + x[0].transcript.trim()); run(x[0].transcript, true); setTimeout(function () { if (VS.want) wait(); }, 1800); } } else im += x[0].transcript; }
        if (im) wait(im); };
      r.onerror = function (e) { if (my !== VS.gen) return; if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture" || e.error === "network") { VS.want = false; add("msv-err", e.error === "network" ? "Для распознавания речи нужен интернет." : "Нет доступа к микрофону - разрешите его для сайта или пишите текстом."); } };
      r.onend = function () { if (my !== VS.gen) return; if (VS.want) setTimeout(function () { if (VS.want && my === VS.gen) spawn(); }, 150); else setOn(false); };
      try { r.start(); } catch (e) { VS.want = false; setOn(false); }
    }
    function start() { if (!SR) return; VS.want = true; setOn(true); spawn(); }
    function stop() { VS.want = false; try { VS.rec && VS.rec.stop(); } catch (e) {} setOn(false); }
    $("msvPill").onclick = function () { show(true); if (SR && !VS.on) start(); else $("msvIn").focus(); };
    $("msvX").onclick = function () { show(false); };
    $("msvSet").onclick = function () { var b = $("msvTts"); b.hidden = !b.hidden; if (!b.hidden && window.MebelVoice) MebelVoice.settings(b); };
    $("msvGo").onclick = function () { run($("msvIn").value); $("msvIn").value = ""; };
    $("msvIn").addEventListener("keydown", function (e) { if (e.key === "Enter") { run($("msvIn").value); $("msvIn").value = ""; } });
    if ($("msvMic")) $("msvMic").onclick = function () { if (VS.on) stop(); else start(); };
    try { if (localStorage.getItem("ms-voice-open") === "1") show(true); } catch (e) {}
  }

  // --- навигация: любой <nav data-variants> заполняется сам ---
  function variantOf(page) { for (var i = 0; i < VARIANTS.length; i++) if (VARIANTS[i].pages.indexOf(page) >= 0) return VARIANTS[i]; return VARIANTS[0]; }
  function variantUrl(v) { return root() + v.path; }
  // Продукты разделены (просьба Александра, 2026-11-21): переходы между ними - только через
  // стартовую страницу и разделы. Внутри продукта вкладок с другими продуктами нет.
  function prodOf(page) { if (page === "vitriny") return "vg"; var v = variantOf(page); return v.group || v.id; }
  function sameProduct(id) { return me === "start" || me === "instrumenty" || id === "start" || id === "instrumenty" || prodOf(me) === prodOf(id); }
  // Дерево сайта (2026-11-23, просьба Александра: понятный путь и везде "назад" и "на главную").
  //   Главная -> Инструменты -> Конструктор (калькулятор, конфигуратор, КП, раскрой, учёт) / Блокнот мастера
  //   Главная -> Витрины -> Витрина мастера (-> Мастерская витрины) / Путешествие по дому /
  //                         Витрина для Краснодара (-> Варианты дизайна -> Вариант N, Мастерская, Вопросы и правки)
  // [название, адрес от корня сайта, родитель]
  var TREE = {
    start: ["Главная", "", null],
    instr: ["Инструменты", "instrumenty/", "start"],
    home: ["Конструктор", "konstruktor/", "instr"],
    bloknot: ["Блокнот мастера", "bloknot/", "instr"],
    vitriny: ["Витрины", "vitriny/", null],
    vitrina: ["Витрина мастера", "vitrina/", "vitriny"],
    "vitrina-red": ["Мастерская витрины", "vitrina/redaktor/", "vitrina"],
    "vitrina-put": ["Путешествие по дому", "vitrina/puteshestvie/", "vitriny"],
    kr: ["Витрина для Краснодара", "krasnodar/", "vitriny"],
    "kr-dz": ["Варианты дизайна", "krasnodar/dizajn/", "kr"],
    "kr-v": ["Вариант", "", "kr-dz"],
    "kr-ms": ["Мастерская", "krasnodar/masterskaya/", "kr"],
    "kr-q": ["Вопросы и правки", "krasnodar/master/", "kr"],
    "kr-calc": ["Расчёт", "krasnodar/vitrina/", "kr"]
  };
  var NODE = { start: "start", instrumenty: "instr", home: "home", bloknot: "bloknot", vitriny: "vitriny", vitrina: "vitrina", "vitrina-red": "vitrina-red", "vitrina-put": "vitrina-put",
    "kr-dom": "kr", "kr-dizajn-list": "kr-dz", "kr-dizajn": "kr-v", "kr-masterskaya": "kr-ms", krasnodar: "kr-q", "kr-vitrina": "kr-calc" };
  function nodeName(id) {
    if (id === "kr-v") { var m = /\/v(\d+)\/?$/.exec(location.pathname.replace(/index\.html$/, "")); return "Вариант" + (m ? " " + m[1] : ""); }
    // мастер из Краснодара (без пометки "мастер сайта") видит только свою витрину - для него она просто "Витрина"
    if (id === "kr" && !isStaff()) return "Витрина";
    return TREE[id][0];
  }
  // путь от текущей страницы вверх: [текущая, родитель, ..., верх]
  function trail() {
    var id = NODE[me] || (tool(me) ? "home" : null), out = [];
    if (!id) return out;
    if (tool(me)) out.push({ id: me, name: tool(me).full, href: "" });
    var staff = isStaff();
    while (id) {
      out.push({ id: id, name: nodeName(id), href: root() + TREE[id][1] });
      if (id === "kr" && !staff) break; // мастеру Краснодара остальной сайт не показываем
      id = TREE[id][2];
    }
    return out;
  }
  var BACK = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M14.7 5.3a1 1 0 0 1 0 1.4L9.4 12l5.3 5.3a1 1 0 0 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0z"/></svg>';
  var HOME = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 3.2 2.6 11H5v9h5.5v-6h3v6H19v-9h2.4z"/></svg>';
  function navCss() {
    if (document.getElementById("msNavCss")) return;
    var st = document.createElement("style"); st.id = "msNavCss";
    // цвета от currentColor: одна и та же кнопка читается и на тёмной шапке, и на светлой
    st.textContent = ".ms-prod{display:flex;flex-wrap:wrap;align-items:center;gap:6px;max-width:100%;min-width:0;font:600 13.5px/1.2 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;letter-spacing:0;text-transform:none}" +
      ".ms-prod a{flex:none;display:inline-flex;align-items:center;gap:5px;min-height:34px;padding:5px 13px 5px 9px;color:inherit;text-decoration:none;white-space:nowrap;border:1px solid rgba(127,127,127,.4);border:1px solid color-mix(in srgb,currentColor 28%,transparent);border-radius:999px;background:color-mix(in srgb,currentColor 7%,transparent);transition:background .15s,border-color .15s}" +
      ".ms-prod a:hover{background:color-mix(in srgb,currentColor 15%,transparent);border-color:color-mix(in srgb,currentColor 45%,transparent)}" +
      ".ms-prod a:focus-visible{outline:2px solid currentColor;outline-offset:2px}" +
      ".ms-prod a.ms-hm{padding-left:11px}.ms-prod svg{flex:none}" +
      ".ms-prod .ms-where{margin-left:6px;font-weight:500;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}" +
      ".ms-prod .ms-where b{font-weight:700;opacity:1}" +
      "@media(max-width:899px){.ms-prod .ms-where{display:none}}" +
      "@media(max-width:480px){.ms-prod a.ms-hm span{display:none}.ms-prod a.ms-hm{padding:5px 11px}}";
    document.head.appendChild(st);
  }
  // Кнопки: "← Родитель" (на уровень выше) и "Главная" (если она не совпадает с родителем),
  // на широком экране ещё строка "где вы": Витрины › Краснодар › Вариант 9.
  function navHTML() {
    var t = trail();
    if (t.length < 2) return "";
    var up = t[1], top = t[t.length - 1], h = "";
    h += '<a class="ms-back" href="' + esc(up.href) + '" title="Назад: ' + esc(up.name) + '" aria-label="Назад: ' + esc(up.name) + '">' + BACK + "<span>" + esc(up.name) + "</span></a>";
    if (top !== up) h += '<a class="ms-back ms-hm" href="' + esc(top.href) + '" title="На главную">' + HOME + "<span>" + (top.id === "start" ? "Главная" : esc(top.name)) + "</span></a>";
    if (t.length > 2) h += '<span class="ms-where">' + t.slice(0, -1).reverse().map(function (x, i, a) { return i === a.length - 1 ? "<b>" + esc(x.name) + "</b>" : esc(x.name); }).join(" › ") + "</span>";
    return h;
  }
  function navInto(el) {
    if (!el) return;
    navCss();
    el.classList.add("ms-prod");
    el.setAttribute("aria-label", "Переход");
    el.innerHTML = navHTML();
  }
  function variantsNav() { [].forEach.call(document.querySelectorAll("[data-variants]"), navInto); }

  // --- запуск ---
  function start() {
    variantsNav();
    watchUpdates();
    if (me === "home" || me === "vitriny" || me === "instrumenty") { setStaff(); voicePanel(); return; }
    // стартовая страница: выбор продукта, голос - общий
    if (me === "start") { setStaff(); voicePanel(); return; }
    // Блокнот мастера - отдельный продукт со своей шапкой: без полоски "Передать заказ", голос - общий
    if (me === "bloknot") { setStaff(); voicePanel(); return; }
    // Витрина - страница для клиентов: ничего не добавляем и мастером не помечаем. Мастерская витрины - для мастера.
    if (me === "vitrina" || me === "vitrina-put") return;
    // Закрытая витрина для Краснодара: страница для одного мастера, вход по пин-коду - тоже ничего не добавляем
    if (/^(krasnodar|kr-)/.test(me)) return;
    if (me === "vitrina-red") { setStaff(); return; }
    var fromHub = /[?&]from=/.test(location.search);
    // конфигуратор - страница для клиента: полоску видит только мастер (кто уже заходил на сайт)
    if (me !== "konfigurator" || isStaff() || fromHub) { setStaff(); bar(); signLine(); if (!(adapter && adapter.voicePanel)) voicePanel(); }
    incoming();
  }

  window.MebelSite = {
    TOOLS: TOOLS, tool: tool, toolName: toolName, read: read, write: write, clear: clear,
    summary: summary, ago: ago, money: money, toast: toast, saveFile: saveFile, urlOf: urlOf, isStaff: isStaff,
    voiceNav: voiceNav, version: VER, VARIANTS: VARIANTS, sameProduct: sameProduct, TABS: TABS, VG: VG, variantOf: variantOf, variantUrl: variantUrl, nav: navInto, trail: trail, checkUpdate: checkUpdate, terms: openTerms, sign: SIGN,
    register: function (a) {
      adapter = a || {};
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
      else start();
    }
  };
  // страница без адаптера (главная) запускается сама
  if (me === "home" || me === "start" || me === "vitriny" || me === "vitrina" || me === "vitrina-red" || me === "vitrina-put" || me === "instrumenty" || /^(krasnodar|kr-)/.test(me)) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  }
})();
