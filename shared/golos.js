/* Голос ответов помощника: общий для сайта и калькулятора.
   1) Если включены записи живого голоса (window.MEBEL_GOLOS_CLIPS = true; папка golos/ рядом с сайтом, список в golos/index.json) и фраза
      целиком собирается из записанных кусков (фразы + числа + валюта) - играем записи.
   2) Иначе - синтез речи браузера, но с лучшим доступным русским голосом:
      Edge "... Online (Natural)" > Google русский > улучшенные голоса Apple > сетевые > остальные.
   Настройки: mk2_tts_voice (имя голоса), mk2_tts_rate (скорость), mk2_ed_mute (звук выкл.), mk2_tts_clips (0 - не играть записи). */
(function () {
  if (window.MebelVoice) return;
  var LSG = function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  var LSS = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };

  // ---------- выбор голоса ----------
  function score(v) {
    if (!/^ru/i.test(v.lang || "")) return -1;
    var n = v.name || "", s = 10;
    if (/natural|neural|нейро/i.test(n)) s += 60;          // Edge: Svetlana / Dmitry Online (Natural)
    else if (/online/i.test(n)) s += 45;
    if (/google/i.test(n)) s += 40;                          // Chrome: Google русский
    if (/enhanced|premium|улучш|высок/i.test(n)) s += 30;    // Apple: Milena (улучшенный)
    if (v.localService === false) s += 15;                   // сетевые обычно живее
    if (/svetlana|dmitry|dariya|milena|yuri|katya|алёна|алена/i.test(n)) s += 5;
    if (/espeak|irina|pavel|desktop|compact/i.test(n)) s -= 25; // старые "роботы"
    return s;
  }
  function voices() {
    var all = [];
    try { all = window.speechSynthesis ? speechSynthesis.getVoices() : []; } catch (e) {}
    return all.filter(function (v) { return score(v) >= 0; }).sort(function (a, b) { return score(b) - score(a); });
  }
  function voice() {
    var list = voices(), want = LSG("mk2_tts_voice", "");
    return (want && list.filter(function (v) { return v.name === want; })[0]) || list[0] || null;
  }
  if (window.speechSynthesis) try { speechSynthesis.getVoices(); speechSynthesis.addEventListener("voiceschanged", function () {}); } catch (e) {}

  // ---------- подготовка текста для синтеза ----------
  function plural(n, f) { n = Math.abs(n) % 100; var d = n % 10; return n > 10 && n < 20 ? f[2] : d === 1 ? f[0] : d >= 2 && d <= 4 ? f[1] : f[2]; }
  function prep(t) {
    t = String(t || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/["«»]/g, "");
    t = t.replace(/(\d)[\s  ](?=\d{3}(\D|$))/g, "$1");          // 983 000 -> 983000
    t = t.replace(/(\d+)\s*₽/g, function (m, n) { return n + " " + plural(+n, ["рубль", "рубля", "рублей"]); });
    t = t.replace(/(\d+)\s*₸/g, "$1 тенге").replace(/₸/g, "тенге").replace(/₽/g, "рублей");
    t = t.replace(/за шт(\.?)/g, "за штуку$1");
    var W = function (w) { return new RegExp("(^|[^а-яёА-ЯЁa-zA-Z])" + w + "(?![а-яёА-ЯЁa-zA-Z])", "g"); }; // \b не работает с кириллицей
    t = t.replace(/(\d+)\s*мм(?![а-яё])/g, "$1 миллиметров").replace(W("шт\\.?"), "$1штук").replace(W("3D"), "$1три дэ");
    t = t.replace(W("ЛДСП"), "$1эл дэ эс пэ").replace(W("МДФ"), "$1эм дэ эф").replace(W("КП"), "$1кэ пэ").replace(W("ДСП"), "$1дэ эс пэ");
    return t.replace(/\s+/g, " ").trim();
  }

  // ---------- записи живого голоса ----------
  // Фразы ответов помощника. key - имя файла (golos/<key>.mp3), t - что сказать.
  var PHRASES = [
    ["gotovo", "Готово"], ["otmenil", "Отменил"], ["ne-ponyal", "Не понял, скажите иначе"],
    ["cena-dlya-klienta", "Цена для клиента"], ["predoplata", "Предоплата"], ["sebestoimost", "Себестоимость"], ["pribyl", "Прибыль"],
    ["za-sht", "за штуку"], ["za-list", "за лист"], ["za-metr", "за метр"], ["za-kvadrat", "за квадратный метр"],
    ["poka-nechego", "Пока нечего считать"], ["otkryvayu", "Открываю"], ["nazad", "Назад"],
    ["vniz", "Прокручиваю вниз"], ["vverh", "Прокручиваю вверх"], ["skachivayu", "Скачиваю файл заказа"],
    ["peredayu", "Передаю заказ"], ["nazhimayu", "Нажимаю"], ["vy-uzhe-zdes", "Вы уже здесь"], ["zakaz-uzhe-zdes", "Заказ уже здесь"],
    ["sohranil", "Сохранил расчёт"], ["novyj", "Начинаю новый расчёт"], ["vatsap", "Нажмите кнопку WhatsApp в панели"],
    ["prajs-startovyj", "Сейчас стоят примерные стартовые цены"], ["prajs-svoj", "Прайс свой"],
    ["kalkulyator", "калькулятор"], ["konfigurator", "конфигуратор"], ["kp", "КП и договор"], ["raskroj", "раскрой"], ["zakazy", "учёт заказов"],
    ["glavnaya", "главная"], ["prajs", "прайс"], ["kuhnya", "кухня"], ["kupe", "шкаф-купе"], ["izdelie", "изделие"]
  ];
  var NUM = {
    0: "nol", 1: "odin", 2: "dva", 3: "tri", 4: "chetyre", 5: "pyat", 6: "shest", 7: "sem", 8: "vosem", 9: "devyat", 10: "desyat",
    11: "odinnadcat", 12: "dvenadcat", 13: "trinadcat", 14: "chetyrnadcat", 15: "pyatnadcat", 16: "shestnadcat", 17: "semnadcat", 18: "vosemnadcat", 19: "devyatnadcat",
    20: "dvadcat", 30: "tridcat", 40: "sorok", 50: "pyatdesyat", 60: "shestdesyat", 70: "semdesyat", 80: "vosemdesyat", 90: "devyanosto",
    100: "sto", 200: "dvesti", 300: "trista", 400: "chetyresta", 500: "pyatsot", 600: "shestsot", 700: "semsot", 800: "vosemsot", 900: "devyatsot"
  };
  var NUM_T = { 1: "odna", 2: "dve" }; // одна тысяча, две тысячи
  var NUM_WORDS = {
    nol: "ноль", odin: "один", dva: "два", tri: "три", chetyre: "четыре", pyat: "пять", shest: "шесть", sem: "семь", vosem: "восемь", devyat: "девять", desyat: "десять",
    odinnadcat: "одиннадцать", dvenadcat: "двенадцать", trinadcat: "тринадцать", chetyrnadcat: "четырнадцать", pyatnadcat: "пятнадцать", shestnadcat: "шестнадцать",
    semnadcat: "семнадцать", vosemnadcat: "восемнадцать", devyatnadcat: "девятнадцать", dvadcat: "двадцать", tridcat: "тридцать", sorok: "сорок",
    pyatdesyat: "пятьдесят", shestdesyat: "шестьдесят", semdesyat: "семьдесят", vosemdesyat: "восемьдесят", devyanosto: "девяносто",
    sto: "сто", dvesti: "двести", trista: "триста", chetyresta: "четыреста", pyatsot: "пятьсот", shestsot: "шестьсот", semsot: "семьсот", vosemsot: "восемьсот", devyatsot: "девятьсот",
    odna: "одна", dve: "две", tysyacha: "тысяча", tysyachi: "тысячи", tysyach: "тысяч", million: "миллион", milliona: "миллиона", millionov: "миллионов",
    tenge: "тенге", rubl: "рубль", rublya: "рубля", rubley: "рублей", procentov: "процентов", dnej: "дней"
  };
  function tri(n, fem) { // 0..999 -> ключи
    var r = [], h = Math.floor(n / 100) * 100, rest = n % 100;
    if (h) r.push(NUM[h]);
    if (rest >= 10 && rest < 20) r.push(NUM[rest]);
    else { var t = Math.floor(rest / 10) * 10, u = rest % 10; if (t) r.push(NUM[t]); if (u) r.push(fem && NUM_T[u] ? NUM_T[u] : NUM[u]); }
    return r;
  }
  function numKeys(n) {
    n = Math.round(n); if (!(n >= 0) || n >= 1e9) return null; if (n === 0) return ["nol"];
    var r = [], m = Math.floor(n / 1e6), k = Math.floor(n / 1000) % 1000, u = n % 1000;
    if (m) r = r.concat(tri(m), [plural(m, ["million", "milliona", "millionov"])]);
    if (k === 1 && !m) r.push("tysyacha"); // "тысяча двести", а не "одна тысяча двести"
    else if (k) r = r.concat(tri(k, true), [plural(k, ["tysyacha", "tysyachi", "tysyach"])]);
    if (u) r = r.concat(tri(u));
    return r;
  }
  var norm = function (s) { return String(s).toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9 -]/g, " ").replace(/\s+/g, " ").trim(); };
  var PH = PHRASES.map(function (p) { return [p[0], norm(p[1]).split(" ")]; }).sort(function (a, b) { return b[1].length - a[1].length; });
  // разложить фразу на ключи записей; null - если какое-то слово не записано
  function toKeys(text, have) {
    var w = norm(prep(text)).split(" ").filter(Boolean), out = [], i = 0;
    while (i < w.length) {
      if (/^\d+$/.test(w[i])) { var nk = numKeys(+w[i]); if (!nk) return null; out = out.concat(nk); i++; continue; }
      var hit = null;
      for (var j = 0; j < PH.length && !hit; j++) { var p = PH[j][1]; if (w.slice(i, i + p.length).join(" ") === p.join(" ")) hit = PH[j]; }
      if (hit) { out.push(hit[0]); i += hit[1].length; continue; }
      var wk = null; for (var k in NUM_WORDS) if (NUM_WORDS[k] === w[i]) { wk = k; break; }
      if (wk) { out.push(wk); i++; continue; }
      return null;
    }
    for (var q = 0; q < out.length; q++) if (!have[out[q]]) return null;
    return out.length ? out : null;
  }
  var clips = { base: null, have: null, ext: "mp3", loading: null };
  function clipBase() {
    if (window.MEBEL_GOLOS_BASE != null) return window.MEBEL_GOLOS_BASE;
    var s = document.querySelector('script[src*="shared/site.js"]');
    return s ? s.src.replace(/shared\/site\.js.*$/, "golos/") : "golos/";
  }
  function loadClips() {
    if (clips.loading) return clips.loading;
    clips.base = clipBase();
    clips.loading = (window.MEBEL_GOLOS_CLIPS && window.fetch && location.protocol !== "file:" ? fetch(clips.base + "index.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }) : Promise.resolve(null))
      .then(function (j) { clips.have = {}; if (j) { clips.ext = j.ext || "mp3"; (j.keys || []).forEach(function (k) { clips.have[k] = 1; }); } return clips.have; })
      .catch(function () { clips.have = {}; return clips.have; });
    return clips.loading;
  }
  var cur = null; // текущая очередь воспроизведения
  function playKeys(keys, done) {
    var my = cur = { stop: false, a: null }, i = 0;
    (function next() {
      if (my.stop) return; if (i >= keys.length) { cur = null; done && done(); return; }
      var a = my.a = new Audio(clips.base + keys[i++] + "." + clips.ext);
      a.onended = next; a.onerror = next; a.play().catch(next);
    })();
  }
  function stop() {
    if (cur) { cur.stop = true; try { cur.a && cur.a.pause(); } catch (e) {} cur = null; }
    try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
  }

  // ---------- синтез ----------
  function synth(text, done) {
    var ss = window.speechSynthesis; if (!ss) { done && done(); return; }
    var t = prep(text).slice(0, 400); if (!t) { done && done(); return; }
    // по предложениям: Chrome обрывает длинные фразы сетевого голоса
    var parts = t.match(/[^.!?;]+[.!?;]*/g) || [t], v = voice(), rate = +LSG("mk2_tts_rate", "1") || 1;
    parts.forEach(function (p, i) {
      var u = new SpeechSynthesisUtterance(p.trim()); u.lang = v ? v.lang : "ru-RU"; if (v) u.voice = v; u.rate = rate; u.pitch = 1;
      if (i === parts.length - 1) { u.onend = function () { done && done(); }; u.onerror = u.onend; }
      ss.speak(u);
    });
  }
  function muted() { return LSG("mk2_ed_mute", "1") !== "0"; } // по умолчанию молчит: ответы текстом
  // сказать вслух; done - когда договорил (чтобы снова включить микрофон)
  function say(text, done, force) {
    if (muted() && !force) { done && done(); return; }
    stop();
    if (LSG("mk2_tts_clips", "1") === "0") { synth(text, done); return; }
    loadClips().then(function (have) { var k = toKeys(text, have); if (k) playKeys(k, done); else synth(text, done); });
  }

  // ---------- маленькие настройки голоса (вставляются в панель помощника) ----------
  function settings(box) {
    if (!box) return;
    var list = voices(), cv = voice();
    var opts = list.map(function (v) { return '<option value="' + v.name.replace(/"/g, "") + '"' + (cv && v.name === cv.name ? " selected" : "") + ">" + v.name.replace(/</g, "") + (v.localService === false ? " (сеть)" : "") + "</option>"; }).join("");
    var on = '<label><input type="checkbox" class="mv-on"' + (muted() ? "" : " checked") + '> отвечать вслух</label> ';
    box.innerHTML = on + (list.length
      ? '<label>Голос <select class="mv-voice">' + opts + '</select></label> <label>Скорость <input class="mv-rate" type="range" min="0.7" max="1.4" step="0.05" value="' + (+LSG("mk2_tts_rate", "1") || 1) + '"></label> <button type="button" class="mv-test">Проверить</button>' +
        (clips.have && Object.keys(clips.have).length ? ' <label><input type="checkbox" class="mv-clips"' + (LSG("mk2_tts_clips", "1") !== "0" ? " checked" : "") + "> живой голос</label>" : "") +
        (/natural|google|online|enhanced/i.test(cv ? cv.name : "") ? "" : '<div class="mv-tip">Самые живые бесплатные голоса - в браузере Edge (Светлана, Дмитрий) и в Chrome на компьютере (Google русский).</div>')
      : '<div class="mv-tip">В этом браузере нет русского голоса. Лучше открыть сайт в Chrome или Edge.</div>');
    var q = function (c) { return box.querySelector(c); };
    if (q(".mv-voice")) q(".mv-voice").onchange = function () { LSS("mk2_tts_voice", this.value); say("Цена для клиента 983 000 ₸", null, true); };
    if (q(".mv-rate")) q(".mv-rate").onchange = function () { LSS("mk2_tts_rate", this.value); say("Готово", null, true); };
    if (q(".mv-test")) q(".mv-test").onclick = function () { say("Цена для клиента 983 000 ₸. Предоплата 492 000 ₸.", null, true); };
    q(".mv-on").onchange = function () { LSS("mk2_ed_mute", this.checked ? "0" : "1"); if (this.checked) say("Готово", null, true); };
    if (q(".mv-clips")) q(".mv-clips").onchange = function () { LSS("mk2_tts_clips", this.checked ? "1" : "0"); };
  }
  function settingsLater(box) { // голоса в Chrome приходят не сразу
    settings(box); loadClips().then(function () { settings(box); });
    if (window.speechSynthesis) speechSynthesis.addEventListener("voiceschanged", function () { settings(box); });
  }

  window.MebelVoice = {
    say: say, stop: stop, muted: muted, voices: voices, voice: voice, prep: prep, settings: settingsLater, toKeys: toKeys, numKeys: numKeys,
    // полный список того, что нужно записать: [ключ, текст]
    recordList: function () {
      var r = PHRASES.slice(), seen = {};
      for (var k in NUM_WORDS) if (!seen[k]) { seen[k] = 1; r.push([k, NUM_WORDS[k]]); }
      return r;
    }
  };
})();
