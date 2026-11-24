/* Шрифты витрины на выбор мастера (Мастерская, вкладка "Шрифты", просьба мастера 2026-11-24).
   Пары "заголовок + текст" в духе минимализма, все с кириллицей, свободная лицензия OFL (fonts/LICENSE.txt), файлы лежат
   рядом (fonts/), с внешних сайтов ничего не грузится. Браузер скачивает файл шрифта, только когда он нужен на странице.
   Выбор хранится в правках мастера: shrift = { titul, kartochki } (см. krasnodar/sloj.js):
     titul     - титульная страница: заставка, дом, меню, разделы;
     kartochki - комната с работами (журнал) и экран работы (название, описание, рассказ).
   window.D2Shrift = { LIST, get(id), face(), apply(cfg), ready(cfg) }. */
(function () {
  "use strict";
  var me = document.currentScript && document.currentScript.src;
  var BASE = me ? me.replace(/[^\/]*(\?.*)?$/, "") + "fonts/" : "../../vitrina/dizajn2/fonts/";
  var CYR = "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116";
  var LAT = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
  // семейство: [имя для CSS, файл, [вес в CSS, вес файла]...]. Для заголовков гротеском берём тонкое начертание
  // под весом 400 ("Строгий", "Современный"): крупные заголовки в обычном весе выглядят тяжело.
  var FACES = [
    ["S Playfair", "playfair-display", [[400, "400"]], "400 800"],
    ["S Cormorant", "cormorant", [[300, "300"]], "300 800"],
    ["S Tenor", "tenor-sans", [[400, "400"]]],
    ["S Prata", "prata", [[400, "400"]]],
    ["S Lora", "lora", [[400, "400"]]],
    ["S PT Serif", "pt-serif", [[400, "400"]]],
    ["S Jost", "jost", [[300, "300"], [400, "400"], [500, "500"]]],
    ["S Inter", "inter", [[300, "300"], [400, "400"], [500, "500"]]],
    ["S PT Sans", "pt-sans", [[400, "400"], [700, "700"]]],
    ["S Manrope", "manrope", [[300, "300"], [400, "400"], [500, "500"]]],
    ["S Manrope Head", "manrope", [[400, "300"]]],
    ["S Montserrat", "montserrat", [[300, "300"], [400, "400"], [500, "500"]]],
    ["S Montserrat Head", "montserrat", [[400, "300"]]]
  ];
  var SERIF = ',Georgia,"Times New Roman",serif', SANS = ',system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  var LIST = [
    { id: "klassika", nazvanie: "Классика", opis: "Как сейчас: изящная антиква и спокойный текст", head: '"S Playfair"' + SERIF, text: '"S Jost"' + SANS },
    { id: "tonkaya", nazvanie: "Тонкая антиква", opis: "Лёгкие высокие буквы, как в журналах об интерьере", head: '"S Cormorant"' + SERIF, text: '"S Jost"' + SANS },
    { id: "arhitektura", nazvanie: "Архитектура", opis: "Строгие ровные буквы, спокойно и дорого", head: '"S Tenor"' + SANS, text: '"S Jost"' + SANS },
    { id: "moda", nazvanie: "Мода", opis: "Контрастная антиква, как у мебельных салонов", head: '"S Prata"' + SERIF, text: '"S Jost"' + SANS },
    { id: "zhurnal", nazvanie: "Журнал", opis: "Мягкая антиква и чёткий современный текст", head: '"S Lora"' + SERIF, text: '"S Inter"' + SANS },
    { id: "kniga", nazvanie: "Книга", opis: "Привычные русские шрифты, легко читать", head: '"S PT Serif"' + SERIF, text: '"S PT Sans"' + SANS },
    { id: "strogij", nazvanie: "Строгий", opis: "Один гротеск везде: тонкие заголовки, чистый текст", head: '"S Manrope Head"' + SANS, text: '"S Manrope"' + SANS },
    { id: "sovremennyj", nazvanie: "Современный", opis: "Широкие геометричные буквы, как у дизайн-студий", head: '"S Montserrat Head"' + SANS, text: '"S Montserrat"' + SANS }
  ];
  var BY = {}; LIST.forEach(function (x) { BY[x.id] = x; });
  function get(id) { return BY[id] || null; }
  function face() {
    if (document.getElementById("s-shrifty")) return;
    var css = "";
    FACES.forEach(function (f) {
      f[2].forEach(function (w) {
        [["cyrillic", CYR], ["latin", LAT]].forEach(function (sub) {
          css += '@font-face{font-family:"' + f[0] + '";src:url("' + BASE + f[1] + "-" + w[1] + "-normal-" + sub[0] + '.woff2") format("woff2");font-weight:' +
            (f[2].length === 1 && f[3] ? f[3] : w[0]) + ";font-display:swap;unicode-range:" + sub[1] + "}";
        });
      });
    });
    var st = document.createElement("style"); st.id = "s-shrifty"; st.textContent = css; document.head.appendChild(st);
  }
  // применить на витрине (слой dizajn2): титульная - переменные всей страницы, карточки - комната и экран работы
  function apply(cfg) {
    cfg = cfg || {};
    var t = get(cfg.titul), k = get(cfg.kartochki);
    if ((!t || t.id === "klassika") && (!k || k.id === "klassika")) return false;
    t = t || BY.klassika; k = k || BY.klassika;
    face();
    var st = document.getElementById("s-shr-apply") || document.createElement("style"); st.id = "s-shr-apply";
    st.textContent = "html[data-d2][data-shr]:root{--serif:" + t.head + ";--sans:" + t.text + "}" +
      "html[data-d2][data-shr] #room,html[data-d2][data-shr] #work,html[data-d2][data-shr] #d2scena{--serif:" + k.head + ";--sans:" + k.text + ";font-family:var(--sans)}";
    document.head.appendChild(st);
    document.documentElement.setAttribute("data-shr", t.id + "-" + k.id);
    return true;
  }
  // дождаться файлов шрифтов (до 2,5 с), чтобы заставка не меняла буквы на ходу
  function ready(cfg) {
    cfg = cfg || {};
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var fams = []; [get(cfg.titul), get(cfg.kartochki)].forEach(function (x) { if (x) fams.push(x.head.split(",")[0], x.text.split(",")[0]); });
    var p = Promise.all(fams.map(function (f) { return document.fonts.load("400 32px " + f, "Кухня Ая").catch(function () {}); }));
    return Promise.race([p, new Promise(function (ok) { setTimeout(ok, 2500); })]);
  }
  window.D2Shrift = { LIST: LIST, get: get, face: face, apply: apply, ready: ready };
})();
