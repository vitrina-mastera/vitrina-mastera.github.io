/* Быстрый расчёт стоимости для клиента - цены и сам счёт. Без экрана: один и тот же файл берут
   страница расчёта (kalk.js) и Мастерская (вкладка "Цены"), поэтому формулы живут только здесь.

   Цены мастера лежат в данных витрины: VITRINA.kalk (мастер публикует их из Мастерской, поле kalk в слое правок, sloj.js).
   Пока мастер своих цен не поставил, берутся примерные (DEF ниже, primerno: true) - клиенту это честно написано.
   Все суммы - в валюте витрины (VITRINA.valyuta: "₽" или "₸"); для тенге стартовые цены умножаются на KZT_K.

   Модель простая и понятная мастеру:
     изделие = размер (погонные метры или кв. метры фасада) x цена мастера за единицу
               x фасады (+% к цене) x фурнитура (+%) x особенности (верхние шкафы, встроенный и т.п.)
             + доплаты в деньгах (углы, пеналы, столешница за метр, подсветка за метр, ящики...)
             + доставка и сборка (% от суммы, 0 - входит в цену);
     клиенту показываем вилку: сумма -/+ разброс (по умолчанию 15%), округлённая. */
(function (root) {
  "use strict";

  // ---------- изделия ----------
  // ed: "pm" - погонный метр, "m2" - кв. метр фасада (ширина x высота), komnaty - комнаты витрины с похожими работами
  var IZD = [
    { id: "kuhnya", nazv: "Кухня", opis: "прямая, угловая, П-образная, с островом", ed: "pm", komnaty: ["kuhni"],
      cenaOpis: "за метр по стене: нижние и верхние шкафы, корпус ЛДСП, простые фасады, обычная фурнитура" },
    { id: "kupe", nazv: "Шкаф-купе", opis: "в нишу или отдельный, двери-купе", ed: "m2", komnaty: ["garderobnye", "prihozhie", "spalni"],
      cenaOpis: "за кв. метр фасада (ширина x высота): корпус, полки и штанги, двери ЛДСП" },
    { id: "shkaf", nazv: "Распашной шкаф", opis: "с дверями на петлях, до потолка", ed: "m2", komnaty: ["garderobnye", "spalni"],
      cenaOpis: "за кв. метр фасада (ширина x высота): корпус, полки, простые фасады" },
    { id: "garderob", nazv: "Гардеробная", opis: "полки и штанги по стенам", ed: "pm", komnaty: ["garderobnye"],
      cenaOpis: "за метр по стенам: открытая система из ЛДСП до потолка" },
    { id: "prihozhaya", nazv: "Прихожая", opis: "шкаф, обувница, вешалка", ed: "pm", komnaty: ["prihozhie"],
      cenaOpis: "за метр ширины: шкаф с обувницей и открытой вешалкой" },
    { id: "tv", nazv: "ТВ-зона и стеллажи", opis: "тумба, полки, стеновые панели", ed: "pm", komnaty: ["gostinye"],
      cenaOpis: "за метр ширины: тумба и навесные полки или шкафы" },
    { id: "vannaya", nazv: "Мебель в санузел", opis: "тумба под раковину, пенал", ed: "pm", komnaty: ["vannye"],
      cenaOpis: "за метр тумбы под раковину, влагостойкие материалы" }
  ];
  var BY = {}; IZD.forEach(function (x) { BY[x.id] = x; });

  // ---------- варианты (названия - для клиента, цены - у мастера в conf) ----------
  var FASAD = [
    { id: "ldsp", nazv: "ЛДСП", opis: "Практично и недорого: однотонные и под дерево", ris: "ldsp" },
    { id: "plenka", nazv: "МДФ в плёнке", opis: "Фрезеровка, матовые и под дерево, мягкие углы", ris: "plenka" },
    { id: "plastik", nazv: "Пластик или акрил", opis: "Ровный глянец или мат, тонкая кромка", ris: "plastik" },
    { id: "emal", nazv: "МДФ в эмали", opis: "Крашеные фасады любого цвета, бархатный мат", ris: "emal" },
    { id: "shpon", nazv: "Шпон или рейка", opis: "Натуральное дерево, премиальный вид", ris: "shpon" }
  ];
  var DVER = [ // двери шкафа-купе
    { id: "ldsp", nazv: "ЛДСП", opis: "Однотонные или под дерево", ris: "ldsp" },
    { id: "zerkalo", nazv: "Зеркало", opis: "Серебро, бронза или графит", ris: "zerkalo" },
    { id: "kombi", nazv: "Комбинированные", opis: "ЛДСП и зеркало вставками", ris: "kombi" },
    { id: "lakobel", nazv: "Цветное стекло", opis: "Лакобель - стекло, окрашенное с обратной стороны", ris: "lakobel" },
    { id: "foto", nazv: "С рисунком", opis: "Пескоструй или фотопечать на стекле", ris: "foto" }
  ];
  var FURN = [
    { id: "std", nazv: "Обычная", opis: "Надёжные петли и направляющие без доводчиков" },
    { id: "dovod", nazv: "С доводчиками", opis: "Двери и ящики закрываются мягко и без стука" },
    { id: "prem", nazv: "Премиум", opis: "Blum или Hettich: тихие ящики полного выдвижения, подъёмники" }
  ];
  var STOL = [
    { id: "ldsp", nazv: "ЛДСП 38 мм", opis: "Классика: под дерево, камень, однотонные", ris: "stol-ldsp" },
    { id: "kompakt", nazv: "Компакт-плита", opis: "Тонкая 12 мм, не боится воды и горячего", ris: "stol-kompakt" },
    { id: "kamen", nazv: "Искусственный камень", opis: "Без швов, мойка может быть из того же камня", ris: "stol-kamen" }
  ];
  var FARTUK = [
    { id: "net", nazv: "Не нужен", opis: "Плитка или уже есть" },
    { id: "panel", nazv: "Стеновая панель", opis: "В цвет столешницы" },
    { id: "steklo", nazv: "Стекло", opis: "Скинали: однотонные или с рисунком" }
  ];
  var FORMA = [
    { id: "pryamaya", nazv: "Прямая", sten: 1, ugly: 0 },
    { id: "uglovaya", nazv: "Угловая", sten: 2, ugly: 1 },
    { id: "p", nazv: "П-образная", sten: 3, ugly: 2 }
  ];
  var VERH = [
    { id: "odin", nazv: "Один ряд", opis: "Обычные верхние шкафы" },
    { id: "potolok", nazv: "До потолка", opis: "Два ряда или высокие шкафы - больше места" },
    { id: "net", nazv: "Без верхних", opis: "Только нижние шкафы, полки по желанию" }
  ];

  // ---------- стартовые (примерные) цены, ₽ ----------
  // Ориентир - средние цены корпусной мебели на заказ в Краснодаре на конец 2026 года. Мастер ставит свои в Мастерской.
  var DEF = {
    v: 1, primerno: true, vkl: true,
    razbros: 15,   // % вилки: от суммы минус, до суммы плюс
    montazh: 10,   // % за доставку и сборку; 0 - входит в цену
    izd: { kuhnya: 32000, kupe: 15000, shkaf: 16000, garderob: 20000, prihozhaya: 28000, tv: 24000, vannaya: 34000 },
    skryt: [],     // id изделий, которые мастер не делает (клиент их не увидит)
    fasad: { ldsp: 0, plenka: 30, plastik: 45, emal: 90, shpon: 130 },          // % к цене изделия
    dver: { ldsp: 0, zerkalo: 10, kombi: 15, lakobel: 25, foto: 30 },           // % к цене шкафа-купе
    furn: { std: 0, dovod: 8, prem: 20 },                                        // % к сумме шкафов
    stol: { ldsp: 4000, kompakt: 14000, kamen: 28000 },                          // за метр столешницы
    fartuk: { panel: 4000, steklo: 12000 },                                      // за метр по стене
    k: { verh_potolok: 20, verh_net: -40, vstroennyj: -15, garderob_dveri: 45, ostrov: 70 }, // % (остров - от цены метра кухни)
    sht: { ugol: 9000, penal: 28000, podsvetka: 4500, yashik: 3500, zerkalo: 7000, reiki: 6000, nad_installyaciej: 18000, demontazh: 6000 }
  };
  var KZT_K = 6; // примерно тенге за рубль - только для стартовых цен витрины в тенге

  // Что видит мастер во вкладке "Цены": группы, строки, единицы ("%" или "cur" + подпись за что)
  var SCHEMA = [
    { zag: "Изделия", opis: "Цена за единицу размера - с простыми фасадами ЛДСП и обычной фурнитурой. Остальное добавится ниже.",
      rows: IZD.map(function (x) { return { k: "izd." + x.id, nazv: x.nazv, ed: "cur", za: x.ed === "m2" ? "за м² фасада" : "за метр", hint: x.cenaOpis, izd: x.id }; }) },
    { zag: "Фасады", opis: "Насколько дороже изделие с такими фасадами, в процентах.",
      rows: FASAD.map(function (x) { return { k: "fasad." + x.id, nazv: x.nazv, ed: "%" }; }) },
    { zag: "Двери шкафа-купе", opis: "Насколько дороже шкаф-купе с такими дверями.",
      rows: DVER.map(function (x) { return { k: "dver." + x.id, nazv: x.nazv, ed: "%" }; }) },
    { zag: "Фурнитура", opis: "Добавка к сумме шкафов.",
      rows: FURN.map(function (x) { return { k: "furn." + x.id, nazv: x.nazv, ed: "%" }; }) },
    { zag: "Кухня", opis: "Столешница и фартук считаются по длине стен, остров - от цены метра кухни.",
      rows: STOL.map(function (x) { return { k: "stol." + x.id, nazv: "Столешница: " + x.nazv, ed: "cur", za: "за метр" }; }).concat([
        { k: "fartuk.panel", nazv: "Фартук: стеновая панель", ed: "cur", za: "за метр" },
        { k: "fartuk.steklo", nazv: "Фартук: стекло", ed: "cur", za: "за метр" },
        { k: "sht.ugol", nazv: "Угловой шкаф", ed: "cur", za: "за угол" },
        { k: "sht.penal", nazv: "Пенал под технику", ed: "cur", za: "за штуку" },
        { k: "k.verh_potolok", nazv: "Верхние до потолка", ed: "%" },
        { k: "k.verh_net", nazv: "Без верхних шкафов", ed: "%", hint: "Обычно минус" },
        { k: "k.ostrov", nazv: "Остров, метр", ed: "%", hint: "Процент от цены метра кухни" }]) },
    { zag: "Шкафы и гардеробные", opis: "",
      rows: [
        { k: "k.vstroennyj", nazv: "Встроенный в нишу", ed: "%", hint: "Без боковин и крыши - обычно минус" },
        { k: "k.garderob_dveri", nazv: "Гардеробная с дверями", ed: "%" },
        { k: "sht.yashik", nazv: "Выдвижной ящик", ed: "cur", za: "за штуку" },
        { k: "sht.zerkalo", nazv: "Зеркало", ed: "cur", za: "за штуку" }] },
    { zag: "Разное", opis: "",
      rows: [
        { k: "sht.podsvetka", nazv: "Подсветка", ed: "cur", za: "за метр" },
        { k: "sht.reiki", nazv: "Декоративные рейки на стену", ed: "cur", za: "за метр" },
        { k: "sht.nad_installyaciej", nazv: "Шкаф над инсталляцией", ed: "cur", za: "за штуку" },
        { k: "sht.demontazh", nazv: "Демонтаж старой мебели", ed: "cur", za: "за изделие" }] },
    { zag: "Общее", opis: "",
      rows: [
        { k: "montazh", nazv: "Доставка и сборка", ed: "%", hint: "0 - входит в цену" },
        { k: "razbros", nazv: "Вилка цены", ed: "%", hint: "Клиент видит сумму минус и плюс столько процентов", min: 0, max: 40 }] }
  ];

  // "МДФ в плёнке" -> "МДФ в плёнке", "Обычная" -> "обычная": аббревиатуры не трогаем
  function low(s) { s = String(s || ""); return /^[A-ZА-ЯЁ]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function cur(V) { var v = String((V && V.valyuta) || "₽").trim(); return v === "₸" || /тенге|kzt/i.test(v) ? "₸" : v === "₽" || /руб|rub/i.test(v) ? "₽" : v; }
  function defaults(V) {
    var d = clone(DEF);
    if (cur(V) === "₸") {
      var mul = function (o) { Object.keys(o).forEach(function (k) { o[k] = Math.round(o[k] * KZT_K / 500) * 500; }); };
      mul(d.izd); mul(d.stol); mul(d.fartuk); mul(d.sht);
    }
    return d;
  }
  // цены витрины: стартовые, поверх - то, что опубликовал мастер (только числа на своих местах, чужое не берём)
  function conf(V) {
    var d = defaults(V), m = V && V.kalk;
    if (!m || typeof m !== "object") return d;
    ["izd", "fasad", "dver", "furn", "stol", "fartuk", "k", "sht"].forEach(function (g) {
      if (!m[g] || typeof m[g] !== "object") return;
      Object.keys(d[g]).forEach(function (k) { var n = +m[g][k]; if (m[g][k] !== "" && m[g][k] != null && isFinite(n)) d[g][k] = n; });
    });
    ["razbros", "montazh"].forEach(function (k) { var n = +m[k]; if (m[k] !== "" && m[k] != null && isFinite(n)) d[k] = n; });
    d.razbros = Math.max(0, Math.min(40, d.razbros)); d.montazh = Math.max(0, Math.min(50, d.montazh));
    if (Array.isArray(m.skryt)) d.skryt = m.skryt.filter(function (id) { return BY[id]; });
    d.primerno = m.primerno === true;
    d.vkl = m.vkl !== false;
    return d;
  }
  function get(c, path) { var p = path.split("."), o = c; for (var i = 0; i < p.length; i++) { if (o == null) return undefined; o = o[p[i]]; } return o; }
  function set(c, path, v) { var p = path.split("."), o = c; for (var i = 0; i < p.length - 1; i++) { o = o[p[i]] = o[p[i]] || {}; } o[p[p.length - 1]] = v; }

  // ---------- изделие по умолчанию (что клиент видит до своих правок) ----------
  function novoe(id) {
    var b = { iz: id, fasad: "plenka", furn: "dovod", dop: {} };
    if (id === "kuhnya") { b.forma = "uglovaya"; b.steny = [3, 2, 2]; b.verh = "odin"; b.ostrov = 0; b.stol = "ldsp"; b.fartuk = "net"; b.penal = 1; }
    else if (id === "kupe") { b.w = 2.4; b.h = 2.6; b.vstroennyj = false; b.dver = "zerkalo"; b.yashiki = 2; }
    else if (id === "shkaf") { b.w = 2; b.h = 2.6; b.yashiki = 2; }
    else if (id === "garderob") { b.l = 4; b.dveri = false; b.yashiki = 3; b.zerkalo = 1; b.fasad = "ldsp"; }
    else if (id === "prihozhaya") { b.w = 1.8; b.zerkalo = 1; }
    else if (id === "tv") { b.w = 3; b.reiki = false; }
    else if (id === "vannaya") { b.w = 0.8; b.penal = 1; b.nad = false; b.fasad = "plastik"; }
    return b;
  }
  // границы размеров (м) - и для полей ввода, и чтобы счёт не взорвался от опечатки
  var LIM = { stena: [0.6, 8, 0.1], ostrov: [0, 4, 0.1], w: [0.6, 6, 0.1], h: [1.8, 3.2, 0.05], l: [1, 15, 0.1], vw: [0.4, 2, 0.05] };
  function clamp(v, a, b) { v = +v; if (!isFinite(v)) v = a; return Math.max(a, Math.min(b, v)); }
  function cnt(v, max) { v = Math.round(+v || 0); return Math.max(0, Math.min(max, v)); }

  // ---------- счёт ----------
  // Возвращает { sum, lo, hi, lines: [{nazv, sum}], razmer: "...", opis: "..." }. lines - разбивка для клиента.
  function schet(b, c) {
    var it = BY[b.iz]; if (!it) return null;
    var P = c.izd[b.iz] || 0, L = [], pc = function (x) { return 1 + (+x || 0) / 100; };
    var fasK = pc(c.fasad[b.fasad]), furnP = (+c.furn[b.furn] || 0) / 100, base = 0, extra = 0, ed = 0, razmer = "", opis = [];
    var nm = function (list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].nazv; return ""; };
    function add(nazv, s) { s = Math.round(s); if (s) L.push({ nazv: nazv, sum: s }); return s; }
    if (b.iz === "kuhnya") {
      var F = FORMA.filter(function (x) { return x.id === b.forma; })[0] || FORMA[0];
      var st = (b.steny || []).slice(0, F.sten).map(function (x) { return clamp(x, LIM.stena[0], LIM.stena[1]); });
      while (st.length < F.sten) st.push(2);
      ed = st.reduce(function (a, x) { return a + x; }, 0);
      var vk = b.verh === "potolok" ? pc(c.k.verh_potolok) : b.verh === "net" ? pc(c.k.verh_net) : 1;
      var os = clamp(b.ostrov || 0, LIM.ostrov[0], LIM.ostrov[1]);
      base = add("Шкафы: " + fmtM(ed) + " по стене, фасады " + low(nm(FASAD, b.fasad)), ed * P * fasK * vk);
      if (os) base += add("Остров " + fmtM(os), os * P * (+c.k.ostrov || 0) / 100 * fasK);
      if (F.ugly) extra += add(F.ugly === 1 ? "Угловой шкаф" : "Угловые шкафы: 2", F.ugly * c.sht.ugol);
      var pn = cnt(b.penal, 4); if (pn) extra += add("Пенал под технику" + (pn > 1 ? ": " + pn : ""), pn * c.sht.penal * fasK);
      var fu = add("Фурнитура: " + low(nm(FURN, b.furn)), (base + (pn ? pn * c.sht.penal * fasK : 0)) * furnP);
      extra += fu;
      extra += add("Столешница: " + low(nm(STOL, b.stol)) + ", " + fmtM(ed + os), (ed + os) * (c.stol[b.stol] || 0));
      if (b.fartuk && b.fartuk !== "net") extra += add("Фартук: " + low(nm(FARTUK, b.fartuk)), ed * (c.fartuk[b.fartuk] || 0));
      if (b.dop.podsvetka) extra += add("Подсветка", ed * c.sht.podsvetka);
      razmer = F.nazv + ", " + st.map(fmtNum).join(" + ") + " м" + (os ? ", остров " + fmtM(os) : "");
      opis.push(razmer, "верхние: " + low(nm(VERH, b.verh)), "фасады " + low(nm(FASAD, b.fasad)), "столешница " + low(nm(STOL, b.stol)));
      if (b.fartuk !== "net") opis.push("фартук: " + low(nm(FARTUK, b.fartuk)));
      if (pn) opis.push("пенал под технику: " + pn);
    } else if (b.iz === "kupe" || b.iz === "shkaf") {
      var w = clamp(b.w, LIM.w[0], LIM.w[1]), h = clamp(b.h, LIM.h[0], LIM.h[1]); ed = w * h;
      var kk = b.iz === "kupe" && b.vstroennyj ? pc(c.k.vstroennyj) : 1;
      var dk = b.iz === "kupe" ? pc(c.dver[b.dver]) : fasK;
      base = add("Шкаф " + fmtNum(w) + " x " + fmtNum(h) + " м, " + (b.iz === "kupe" ? "двери " + low(nm(DVER, b.dver)) : "фасады " + low(nm(FASAD, b.fasad))), ed * P * kk * dk);
      extra += add("Фурнитура: " + low(nm(FURN, b.furn)), base * furnP);
      var ya = cnt(b.yashiki, 12); if (ya) extra += add("Выдвижные ящики: " + ya, ya * c.sht.yashik);
      if (b.dop.podsvetka) extra += add("Подсветка", w * c.sht.podsvetka);
      razmer = fmtNum(w) + " x " + fmtNum(h) + " м";
      opis.push(razmer + (b.iz === "kupe" ? (b.vstroennyj ? ", в нишу" : ", с боковинами") : ""), b.iz === "kupe" ? "двери: " + low(nm(DVER, b.dver)) : "фасады " + low(nm(FASAD, b.fasad)));
      if (ya) opis.push("ящиков: " + ya);
    } else if (b.iz === "garderob") {
      var l = clamp(b.l, LIM.l[0], LIM.l[1]); ed = l;
      var gk = b.dveri ? pc(c.k.garderob_dveri) * fasK : 1;
      base = add("Система " + fmtM(l) + " по стенам" + (b.dveri ? ", с дверями " + low(nm(FASAD, b.fasad)) : ", открытая"), l * P * gk);
      extra += add("Фурнитура: " + low(nm(FURN, b.furn)), base * furnP);
      var yg = cnt(b.yashiki, 20); if (yg) extra += add("Выдвижные ящики: " + yg, yg * c.sht.yashik);
      var zg = cnt(b.zerkalo, 4); if (zg) extra += add("Зеркало" + (zg > 1 ? ": " + zg : ""), zg * c.sht.zerkalo);
      if (b.dop.podsvetka) extra += add("Подсветка", l * c.sht.podsvetka);
      razmer = fmtM(l) + " по стенам";
      opis.push(razmer, b.dveri ? "с дверями, фасады " + low(nm(FASAD, b.fasad)) : "открытая");
      if (yg) opis.push("ящиков: " + yg);
    } else { // prihozhaya, tv, vannaya - по ширине
      var lw = b.iz === "vannaya" ? LIM.vw : LIM.w, ww = clamp(b.w, lw[0], lw[1]); ed = ww;
      base = add((b.iz === "vannaya" ? "Тумба под раковину " : "Мебель ") + fmtM(ww) + ", фасады " + low(nm(FASAD, b.fasad)), ww * P * fasK);
      var pv = b.iz === "vannaya" ? cnt(b.penal, 3) : 0;
      if (pv) base += add("Пенал" + (pv > 1 ? ": " + pv : ""), pv * c.sht.penal * 0.75 * fasK);
      extra += add("Фурнитура: " + low(nm(FURN, b.furn)), base * furnP);
      if (b.iz === "vannaya" && b.nad) extra += add("Шкаф над инсталляцией", c.sht.nad_installyaciej * fasK);
      var zp = b.iz === "prihozhaya" ? cnt(b.zerkalo, 3) : 0; if (zp) extra += add("Зеркало" + (zp > 1 ? ": " + zp : ""), zp * c.sht.zerkalo);
      if (b.iz === "tv" && b.reiki) extra += add("Рейки на стену", ww * c.sht.reiki);
      if (b.dop.podsvetka) extra += add("Подсветка", ww * c.sht.podsvetka);
      razmer = (b.iz === "vannaya" ? "тумба " : "ширина ") + fmtM(ww);
      opis.push(razmer, "фасады " + low(nm(FASAD, b.fasad)));
      if (pv) opis.push("пенал: " + pv);
      if (b.iz === "vannaya" && b.nad) opis.push("шкаф над инсталляцией");
    }
    opis.push("фурнитура " + low(nm(FURN, b.furn)));
    if (b.dop.podsvetka) opis.push("подсветка");
    if (b.dop.demontazh) extra += add("Демонтаж старой мебели", c.sht.demontazh);
    if (b.dop.demontazh) opis.push("демонтаж старой");
    var sum = L.reduce(function (a, x) { return a + x.sum; }, 0);
    if (c.montazh > 0) { var mz = Math.round(sum * c.montazh / 100); L.push({ nazv: "Доставка и сборка", sum: mz }); sum += mz; }
    var r = c.razbros / 100;
    return { sum: sum, lo: okr(sum * (1 - r)), hi: okr(sum * (1 + r)), lines: L, razmer: razmer, opis: opis.filter(Boolean).join(", "), ed: ed, montazhVhodit: !(c.montazh > 0) };
  }
  function okr(v) { var q = v >= 1e6 ? 10000 : v >= 2e5 ? 5000 : 1000; return Math.max(0, Math.round(v / q) * q); }
  function fmtNum(v) { return (Math.round(v * 100) / 100).toString().replace(".", ","); }
  function fmtM(v) { return fmtNum(v) + " м"; }
  // 186000 -> "186 000 ₽"
  function money(v, sym) { return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " " + (sym || "₽"); }
  // вилка компактно: "138 - 186 тыс ₽" (или "1,25 - 1,6 млн ₽")
  function vilka(lo, hi, sym) {
    sym = sym || "₽";
    if (hi >= 1e6) { var f = function (x) { return (Math.round(x / 1e4) / 100).toString().replace(".", ","); }; return f(lo) + " - " + f(hi) + " млн " + sym; }
    if (hi >= 1e4) return Math.round(lo / 1000) + " - " + Math.round(hi / 1000) + " тыс " + sym;
    return money(lo, "").trim() + " - " + money(hi, sym);
  }

  var api = { IZD: IZD, BY: BY, FASAD: FASAD, DVER: DVER, FURN: FURN, STOL: STOL, FARTUK: FARTUK, FORMA: FORMA, VERH: VERH, LIM: LIM,
    DEF: DEF, SCHEMA: SCHEMA, defaults: defaults, conf: conf, get: get, set: set, novoe: novoe, schet: schet, money: money, vilka: vilka, cur: cur, low: low, fmtNum: fmtNum, fmtM: fmtM, clamp: clamp };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KalkCeny = api;
})(typeof self !== "undefined" ? self : this);
