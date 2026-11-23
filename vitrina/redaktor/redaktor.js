/* Мастерская витрины. Правит копию window.VITRINA и хранит её черновиком в браузере.
   Поля форм связаны с данными через data-p="путь.в.данных" (например raboty.2.nazvanie).
   Фото: уменьшаем до 1600 px, впечатываем водяной знак, сохраняем JPEG в IndexedDB; в данных - src "idb:<id>", znak: true.
   Выгрузка: ZIP без сжатия (dannye.js + foto/*.jpg) - его кладут в site/vitrina/ репозитория. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var KEY = "vt-draft", KODY = "vt-kody"; // KODY - выданные коды (сами коды только у мастера, в файл идут отпечатки)
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function toast(t) { var el = $("toast"); el.textContent = t; el.className = "on"; clearTimeout(toast.t); toast.t = setTimeout(function () { el.className = ""; }, 2800); }
  var D;
  try { D = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (!D) D = clone(window.VITRINA || {});
  ["raboty", "otzyvy", "kody", "otlichiya", "ploshchadki"].forEach(function (k) { if (!Array.isArray(D[k])) D[k] = []; });
  D.master = D.master || {}; D.kontakty = D.kontakty || {}; D.raschet = D.raschet || { izdeliya: [], urovni: [], dop: [] };
  var LK = {}; try { LK = JSON.parse(localStorage.getItem(KODY) || "{}"); } catch (e) {}

  // ---------- сохранение ----------
  var saveT = 0;
  function save(now) {
    clearTimeout(saveT); $("st").textContent = "Сохраняю...";
    saveT = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(D)); $("st").textContent = "Черновик сохранён в этом браузере"; }
      catch (e) { $("st").textContent = "Не хватило памяти браузера"; toast("Не хватило памяти браузера - скачайте файлы для сайта"); }
    }, now ? 0 : 400);
  }
  function getP(path) { return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, D); }
  function setP(path, v) { var ks = path.split("."), o = D; for (var i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = v; }
  document.addEventListener("input", function (e) {
    var el = e.target, p = el.getAttribute && el.getAttribute("data-p"); if (!p) return;
    var v = el.type === "checkbox" ? el.checked : el.value;
    if (el.hasAttribute("data-num")) v = +String(v).replace(/\s/g, "").replace(",", ".") || 0;
    if (el.hasAttribute("data-lines")) v = String(v).split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    setP(p, v); D.shablon = false; save();
    if (el.hasAttribute("data-re")) softRender();
  });
  document.addEventListener("change", function (e) { if (e.target.type === "checkbox" && e.target.getAttribute("data-p")) e.target.dispatchEvent(new Event("input", { bubbles: true })); });
  function fld(label, p, o) {
    o = o || {}; var v = getP(p);
    if (o.lines) v = (v || []).join("\n");
    var a = ' class="t" data-p="' + p + '"' + (o.num ? " data-num" : "") + (o.lines ? " data-lines" : "") + (o.re ? " data-re" : "") + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : "") + (o.type ? ' type="' + o.type + '"' : "") + (o.mode ? ' inputmode="' + o.mode + '"' : "");
    var ctl = o.area ? "<textarea" + a + (o.id ? ' id="' + o.id + '"' : "") + ">" + esc(v) + "</textarea>" : "<input" + a + ' value="' + esc(v == null ? "" : v) + '">';
    return '<label class="f">' + esc(label) + ctl + (o.hint ? '<span class="small" style="margin:0">' + esc(o.hint) + "</span>" : "") + "</label>";
  }

  // ---------- фото (IndexedDB) ----------
  var DB = null, PH = {};
  function db() {
    if (DB) return Promise.resolve(DB);
    return new Promise(function (ok, no) {
      var rq = indexedDB.open("vt-photos", 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore("p"); };
      rq.onsuccess = function () { DB = rq.result; ok(DB); }; rq.onerror = function () { no(rq.error); };
    });
  }
  function idbPut(id, blob) { return db().then(function (d) { return new Promise(function (ok, no) { var tx = d.transaction("p", "readwrite"); tx.objectStore("p").put(blob, id); tx.oncomplete = function () { ok(); }; tx.onerror = function () { no(tx.error); }; }); }); }
  function idbGet(id) { return db().then(function (d) { return new Promise(function (ok) { var r = d.transaction("p").objectStore("p").get(id); r.onsuccess = function () { ok(r.result); }; r.onerror = function () { ok(null); }; }); }); }
  function idbDel(id) { return db().then(function (d) { d.transaction("p", "readwrite").objectStore("p").delete(id); }).catch(function () {}); }
  function idbAll() {
    return db().then(function (d) { return new Promise(function (ok) { var c = d.transaction("p").objectStore("p").openCursor(); c.onsuccess = function () { var x = c.result; if (!x) return ok(); PH[x.key] = URL.createObjectURL(x.value); x.continue(); }; c.onerror = function () { ok(); }; }); }).catch(function () {});
  }
  function srcOf(f) {
    if (!f) return VitrinaRis("detal");
    if (f.src && /^idb:/.test(f.src)) return PH[f.src.slice(4)] || VitrinaRis("detal");
    if (f.src) return "../" + f.src;
    return VitrinaRis(f.ris || "detal");
  }
  // уменьшить и впечатать водяной знак: надпись по диагонали повторяется по всему фото + подпись в углу
  function prepPhoto(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1600, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
        var c = document.createElement("canvas"); c.width = w; c.height = h;
        var g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h);
        var t = (D.master.znak || D.master.imya || "").trim();
        if (t) {
          var fs = Math.max(16, Math.round(Math.min(w, h) / 26));
          g.save(); g.translate(w / 2, h / 2); g.rotate(-24 * Math.PI / 180);
          g.font = "600 " + fs + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
          var tw = g.measureText(t).width + fs * 4, R = Math.hypot(w, h);
          for (var y = -R / 2; y < R / 2; y += fs * 7) for (var x = -R / 2 + ((y / (fs * 7)) % 2 ? tw / 2 : 0); x < R / 2; x += tw) {
            g.fillStyle = "rgba(0,0,0,.16)"; g.fillText(t, x + 1, y + 1);
            g.fillStyle = "rgba(255,255,255,.30)"; g.fillText(t, x, y);
          }
          g.restore();
          g.font = "700 " + Math.round(fs * 0.9) + "px system-ui, sans-serif"; g.textAlign = "right"; g.textBaseline = "bottom";
          g.fillStyle = "rgba(0,0,0,.35)"; g.fillText(t, w - fs * 0.8 + 1, h - fs * 0.6 + 1);
          g.fillStyle = "rgba(255,255,255,.85)"; g.fillText(t, w - fs * 0.8, h - fs * 0.6);
        }
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? ok(b) : no(new Error("jpeg")); }, "image/jpeg", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error("Не получилось открыть фото")); };
      img.src = url;
    });
  }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---------- диктовка и "привести в порядок" ----------
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, DICT = null;
  function dictate(btn, field, live) {
    if (!SR) { toast("Этот браузер не распознаёт речь - нажмите микрофон на клавиатуре телефона"); return; }
    if (DICT) { DICT.want = false; try { DICT.rec.stop(); } catch (e) {} if (DICT.btn === btn) { DICT = null; return; } }
    var st = { btn: btn, want: true }; DICT = st; btn.classList.add("on");
    var spawn = function () {
      var r = new SR(); st.rec = r; r.lang = "ru-RU"; r.interimResults = true; r.continuous = !/android/i.test(navigator.userAgent);
      r.onresult = function (ev) {
        var im = "";
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          var x = ev.results[i];
          if (x.isFinal) { var v = field.value.replace(/\s+$/, ""); field.value = v + (v ? " " : "") + x[0].transcript.trim(); field.dispatchEvent(new Event("input", { bubbles: true })); }
          else im += x[0].transcript;
        }
        if (live) live.textContent = im ? "Слышу: " + im : "Говорите...";
      };
      r.onerror = function (e) { if (/not-allowed|service-not-allowed|audio-capture|network/.test(e.error)) { st.want = false; toast(e.error === "network" ? "Для распознавания речи нужен интернет" : "Нет доступа к микрофону"); } };
      r.onend = function () { if (st.want && DICT === st) { try { spawn(); } catch (e) { off(); } } else off(); };
      try { r.start(); } catch (e) { off(); }
    };
    var off = function () { btn.classList.remove("on"); if (live) live.textContent = ""; if (DICT === st) { DICT = null; field.value = tidy(field.value); field.dispatchEvent(new Event("input", { bubbles: true })); } };
    if (live) live.textContent = "Говорите...";
    spawn();
  }
  // Голосом говорят без знаков: расставляем точки, заглавные, понимаем "точка", "запятая", "новый абзац"
  function tidy(t) {
    t = " " + String(t || "") + " ";
    var W = [[/\s+(новый абзац|новая строка|с новой строки)\s+/gi, "\n"], [/\s+вопросительный знак\s+/gi, "? "], [/\s+восклицательный знак\s+/gi, "! "],
      [/\s+двоеточие\s+/gi, ": "], [/\s+запятая\s+/gi, ", "], [/\s+точка\s+/gi, ". "], [/\s+тире\s+/gi, " - "]];
    W.forEach(function (w) { t = t.replace(w[0], w[1]); });
    t = t.replace(/[ \t]+/g, " ").replace(/ ([.,!?:])/g, "$1").replace(/([.,!?:])(?=[^\s\d])/g, "$1 ").replace(/ *\n */g, "\n").trim();
    t = t.replace(/(^|[.!?]\s+|\n)([a-zа-яё])/g, function (m, a, b) { return a + b.toUpperCase(); });
    t = t.split("\n").map(function (s) { s = s.trim(); return s && !/[.!?:]$/.test(s) ? s + "." : s; }).join("\n");
    return t;
  }

  // ---------- работы ----------
  var CUR = -1; // открытая работа
  var MON = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  function mon(s) { var m = /^(\d{4})-(\d{2})/.exec(s || ""); return m ? MON[+m[2] - 1] + " " + m[1] : ""; }
  function slug(s) {
    var map = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ы: "y", э: "e", ю: "yu", я: "ya" };
    return String(s || "").toLowerCase().split("").map(function (c) { return map[c] != null ? map[c] : /[a-z0-9]/.test(c) ? c : "-"; }).join("").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "rabota";
  }
  function viewRaboty() {
    var v = $("v-raboty");
    if (CUR >= 0 && D.raboty[CUR]) return viewWork(v);
    v.innerHTML = '<h2>Работы <span class="small">' + D.raboty.length + '</span></h2><div class="btns" style="margin:0 0 12px"><button type="button" class="btn p" data-a="addWork">+ Новая работа</button></div><div class="list">' +
      D.raboty.map(function (w, i) {
        return '<button type="button" class="it" data-open="' + i + '"><img src="' + esc(srcOf((w.foto || [])[0])) + '" alt=""><span class="x"><b>' + esc(w.nazvanie || "Без названия") + "</b><span>" + esc([w.vid, mon(w.kogda), (w.foto || []).length + " фото"].filter(Boolean).join(" · ")) + "</span></span>" +
          '<span class="btn sm l" data-mv="' + i + '" title="Выше">↑</span></button>';
      }).join("") + "</div>" +
      '<p class="small">Порядок здесь = порядок на сайте и в сторис. Первое фото работы - обложка.</p>';
  }
  function viewWork(v) {
    var i = CUR, w = D.raboty[i], P = "raboty." + i + ".";
    v.innerHTML = '<div class="btns" style="margin:0 0 6px"><button type="button" class="btn l" data-a="back">← Все работы</button></div>' +
      "<h2>" + esc(w.nazvanie || "Новая работа") + "</h2>" +
      '<div class="card"><b>Фото</b><p class="small">Можно сразу с камеры. Фото уменьшаются для быстрого сайта и получают водяной знак "' + esc(D.master.znak || D.master.imya || "") + '".</p>' +
      '<div class="photos">' + (w.foto || []).map(function (f, k) {
        return '<div class="pf"><img src="' + esc(srcOf(f)) + '" alt=""><textarea data-p="' + P + "foto." + k + '.podpis" placeholder="Что на фото">' + esc(f.podpis || "") + '</textarea><div class="r"><button type="button" class="btn sm l" data-fmv="' + k + '" title="Сделать раньше">← раньше</button><button type="button" class="btn sm l del" data-fdel="' + k + '">Удалить</button></div></div>';
      }).join("") + '</div><div class="btns"><button type="button" class="btn p" data-a="addPhoto">+ Добавить фото</button></div></div>' +
      '<div class="card"><b>Рассказ</b><p class="small">Как в голосовом клиенту: что за заказ, где, что было сложно, почему решили так. Три-четыре предложения. Можно говорить "точка", "запятая", "новый абзац".</p>' +
      fld("", P + "rasskaz", { area: true, id: "wRas", ph: "Например: Семья с двумя детьми, кухня 9 метров..." }) +
      '<div class="live" id="wLive"></div><div class="btns" style="margin-top:6px"><button type="button" class="btn mic" id="wMic">Надиктовать</button><button type="button" class="btn" data-a="tidy">Привести в порядок</button></div></div>' +
      '<div class="card"><div class="g2">' + fld("Название", P + "nazvanie", { re: 1, ph: "Кухня с рейкой" }) + fld("Раздел", P + "vid", { ph: "Кухни, Шкафы, Спальни..." }) +
      fld("Где", P + "gde", { ph: "Квартира, 12 м²" }) + fld("Когда сделали", P + "kogda", { type: "month" }) + fld("Срок", P + "srok", { ph: "4 недели" }) + fld("Стоимость (по желанию)", P + "cena", { ph: "от 900 000 ₸" }) + "</div>" +
      '<div style="margin-top:10px">' + fld("Материалы", P + "material", { ph: "МДФ эмаль, фурнитура Blum" }) + "</div>" +
      '<div style="margin-top:10px">' + fld("Почему так - решения, по одному в строке", P + "resheniya", { area: true, lines: true, ph: "Короб для газовой трубы со съёмной панелью" }) + "</div></div>" +
      '<div class="btns"><a class="btn" target="_blank" href="../?chernovik=1#rabota=' + esc(w.id) + '">Посмотреть на сайте</a><button type="button" class="btn del" data-a="delWork">Удалить работу</button></div>';
    $("wMic").addEventListener("click", function () { dictate(this, $("wRas"), $("wLive")); });
  }
  function softRender() { if (CUR >= 0) { var h = document.querySelector("#v-raboty h2"); if (h) h.textContent = D.raboty[CUR].nazvanie || "Новая работа"; } }

  // ---------- отзывы и коды ----------
  function normKod(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9А-ЯЁ]/g, ""); }
  function hashKod(s) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode("vitrina:" + normKod(s))).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("").slice(0, 16);
    });
  }
  function makeKod() {
    var A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", a = new Uint32Array(8), s = ""; crypto.getRandomValues(a);
    for (var i = 0; i < 8; i++) s += A[a[i] % A.length] + (i === 3 ? "-" : "");
    return s;
  }
  function siteUrl() { return location.href.replace(/redaktor\/.*$/, ""); }
  function reviewLink(kod) { return siteUrl() + "#otzyv=" + kod; }
  function viewOtzyvy() {
    var v = $("v-otzyvy"), opts = '<option value="">-</option>' + D.raboty.map(function (w) { return '<option value="' + esc(w.id) + '">' + esc(w.nazvanie) + "</option>"; }).join("");
    v.innerHTML = '<h2>Ссылка на отзыв для клиента</h2><div class="card"><p class="small" style="margin:0 0 10px">После сдачи заказа отправьте клиенту ссылку с личным кодом. Отзыв по такой ссылке получит пометку "по заказу" - так видно, что он от настоящего клиента.</p>' +
      '<div class="g3"><label class="f">Номер заказа<input class="t" id="kZak" placeholder="№ 2026-012"></label><label class="f">Что делали<input class="t" id="kChto" placeholder="Кухня"></label><label class="f">Когда сдали<input class="t" id="kKog" type="month"></label></div>' +
      '<div class="btns"><button type="button" class="btn p" data-a="kod">Создать ссылку</button></div><div id="kOut"></div></div>' +
      (D.kody.length ? '<div class="card"><b>Выданные коды</b><div class="list" style="margin-top:8px">' + D.kody.map(function (k, i) {
        var kod = LK[k.h];
        return '<div class="it" style="cursor:default"><span class="x"><b>' + esc(k.zakaz || "Заказ") + " · " + esc(k.chto || "") + "</b><span>" + (kod ? '<span class="kod" style="font-size:14px;padding:1px 8px">' + esc(kod) + "</span>" : "код выдан на другом устройстве") + "</span></span>" +
          (kod ? '<button type="button" class="btn sm" data-klink="' + esc(kod) + '">Ссылка</button>' : "") + '<button type="button" class="btn sm l del" data-kdel="' + i + '">×</button></div>';
      }).join("") + "</div></div>" : "") +
      '<h2>Отзывы на сайте</h2><div class="card"><p class="small" style="margin:0 0 8px">Клиент присылает отзыв сообщением. Вставьте его сюда целиком - поля заполнятся сами.</p><textarea class="t" id="rPaste" placeholder="Вставьте сообщение \'Отзыв для сайта...\'"></textarea><div class="btns"><button type="button" class="btn p" data-a="paste">Добавить отзыв из сообщения</button><button type="button" class="btn" data-a="addRev">Добавить вручную</button></div></div>' +
      D.otzyvy.map(function (r, i) {
        var P = "otzyvy." + i + ".";
        return '<div class="card"><div class="g3">' + fld("Имя", P + "imya") + fld("Номер заказа", P + "zakaz") + fld("Дата", P + "data", { type: "date" }) + "</div>" +
          '<div class="g3" style="margin-top:10px"><label class="f">Работа на сайте<select class="t" data-p="' + P + 'rabota">' + opts.replace('value="' + esc(r.rabota) + '"', 'value="' + esc(r.rabota) + '" selected') + "</select></label>" +
          fld("Оценка 1-5", P + "ocenka", { num: 1, mode: "numeric" }) + fld("Страница клиента", P + "stranica", { ph: "vk.com/..." }) + "</div>" +
          '<div style="margin-top:10px">' + fld("Отзыв", P + "tekst", { area: true }) + "</div>" +
          '<div class="btns"><label class="small" style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" data-p="' + P + 'kod"' + (r.kod ? " checked" : "") + '> Пришёл по ссылке с кодом заказа</label><button type="button" class="btn sm l del" data-rdel="' + i + '" style="margin-left:auto">Удалить отзыв</button></div></div>';
      }).join("") +
      '<h2>Отзывы на картах</h2><div class="card"><p class="small" style="margin:0 0 8px">Ссылки на 2ГИС, Яндекс Карты - там отзывы не может править сам мастер, поэтому им больше верят.</p>' +
      D.ploshchadki.map(function (p, i) { return '<div class="g2" style="margin-bottom:8px">' + fld("Площадка", "ploshchadki." + i + ".nazv") + fld("Ссылка", "ploshchadki." + i + ".url") + "</div>"; }).join("") +
      '<div class="btns"><button type="button" class="btn" data-a="addPl">+ Площадка</button></div></div>';
  }
  function showKod(kod, zak) {
    var u = reviewLink(kod), txt = "Здравствуйте! Спасибо за заказ. Если не трудно, оставьте отзыв - это займёт минуту: " + u;
    $("kOut").innerHTML = '<p style="margin:12px 0 6px">Код: <span class="kod">' + esc(kod) + '</span></p><p class="small" style="word-break:break-all">' + esc(u) + '</p><div class="btns"><a class="btn ok" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(txt) + '">Отправить клиенту в WhatsApp</a><button type="button" class="btn" data-copy="' + esc(txt) + '">Скопировать сообщение</button></div>' +
      '<p class="small">Код заработает на сайте после публикации (вкладка "Опубликовать").' + (zak ? "" : "") + "</p>";
  }
  // разбор сообщения, которое собирает форма отзыва на витрине
  function parseReview(t) {
    var g = function (re) { var m = re.exec(t); return m ? m[1].trim() : ""; };
    var body = t.split(/\n\s*\n/).slice(1).join("\n\n").trim();
    var r = { imya: g(/Имя:\s*(.+)/), zakaz: g(/Заказ:\s*([^\(\n]+)/), ocenka: +g(/Оценка:\s*(\d)/) || 5, stranica: g(/Моя страница:\s*(.+)/),
      kod: /код подтвержд/i.test(t), data: new Date().toISOString().slice(0, 10), tekst: body || t.trim(), rabota: "" };
    if (r.imya === "-") r.imya = "";
    if (/Публиковать с именем:\s*нет/i.test(t)) r.imya = "Клиент";
    var chto = g(/Что делали:\s*(.+)/).toLowerCase();
    if (chto) D.raboty.forEach(function (w) { if (!r.rabota && (w.nazvanie + " " + (w.vid || "")).toLowerCase().indexOf(chto.slice(0, 5)) >= 0) r.rabota = w.id; });
    return r;
  }

  // ---------- о себе и контакты ----------
  function viewMaster() {
    $("v-master").innerHTML = '<h2>О себе</h2><div class="card"><div class="g2">' + fld("Имя или название мастерской", "master.imya") + fld("Имя мастера мелко внизу", "master.chelovek", { hint: "Если выше название мастерской. Можно оставить пустым." }) + fld("Чем занимаетесь", "master.rol") +
      fld("Город", "master.gorod") + fld("Опыт", "master.opyt", { ph: "12 лет" }) + fld("Сколько работ сделано", "master.rabot", { ph: "300+" }) + fld("Водяной знак на фото", "master.znak", { hint: "Для новых фото. Уже добавленные не меняются." }) + "</div>" +
      '<div style="margin-top:10px">' + fld("О себе - одна-две строки от первого лица", "master.o_sebe", { area: true }) + "</div></div>" +
      '<h2>Контакты</h2><div class="card"><div class="g2">' + fld("WhatsApp - номер с кодом страны", "kontakty.whatsapp", { mode: "tel", ph: "77001234567" }) + fld("Telegram - имя без @", "kontakty.telegram") +
      fld("ВКонтакте", "kontakty.vk", { ph: "vk.com/..." }) + fld("Instagram", "kontakty.instagram") + fld("Телефон", "kontakty.telefon", { mode: "tel" }) + fld("Часы работы", "kontakty.chasy") +
      fld("Адрес мастерской", "kontakty.adres") + fld("Ссылка на карту", "kontakty.karta") + "</div></div>" +
      '<h2>Чем отличаюсь</h2>' + D.otlichiya.map(function (o, i) { return '<div class="card"><div class="g2">' + fld("Коротко", "otlichiya." + i + ".zag") + fld("Пояснение", "otlichiya." + i + ".tekst") + '</div><div class="btns" style="margin-top:6px"><button type="button" class="btn sm l del" data-odel="' + i + '">Убрать</button></div></div>'; }).join("") +
      '<div class="btns"><button type="button" class="btn" data-a="addOt">+ Добавить пункт</button></div>';
  }

  // ---------- цены ----------
  function viewCeny() {
    var C = D.raschet, U = C.urovni || [];
    $("v-ceny").innerHTML = '<h2>Цены для быстрого расчёта</h2><div class="card"><p class="small" style="margin:0 0 10px">Цена за единицу (метр по стене, метр ширины или штуку). Клиент увидит вилку ±' + Math.round((C.razbros == null ? 0.15 : C.razbros) * 100) + '% и кнопку "отправить мастеру".</p>' +
      '<div style="overflow-x:auto"><table class="pr"><tr><th>Изделие</th><th>Единица</th>' + U.map(function (u, k) { return "<th>" + esc(u.nazv) + "</th>"; }).join("") + "</tr>" +
      (C.izdeliya || []).map(function (x, i) { var P = "raschet.izdeliya." + i + "."; return "<tr><td><input class=\"t\" data-p=\"" + P + "nazv\" value=\"" + esc(x.nazv) + "\"></td><td><input class=\"t\" data-p=\"" + P + "ed\" value=\"" + esc(x.ed) + "\"></td>" + U.map(function (u, k) { return '<td><input class="t" data-num inputmode="numeric" data-p="' + P + "cena." + k + '" value="' + esc((x.cena || [])[k] || "") + '"></td>'; }).join("") + "</tr>"; }).join("") +
      "</table></div>" + '<div class="g3" style="margin-top:12px">' + fld("Валюта", "valyuta") + fld("Вилка, доля (0.15 = ±15%)", "raschet.razbros", { num: 1, mode: "decimal" }) + "</div>" +
      '<div style="margin-top:10px">' + fld("Пояснение под ценой", "raschet.zamecanie", { area: true }) + "</div></div>" +
      '<h2>Уровни материалов</h2><div class="card">' + U.map(function (u, k) { return '<div class="g2" style="margin-bottom:8px">' + fld("Название", "raschet.urovni." + k + ".nazv") + fld("Что входит", "raschet.urovni." + k + ".opis") + "</div>"; }).join("") + "</div>" +
      '<h2>Дополнительно</h2><div class="card">' + (C.dop || []).map(function (d, k) { return '<div class="g2" style="margin-bottom:8px">' + fld("Что", "raschet.dop." + k + ".nazv") + fld("Надбавка, доля (0.08 = +8%)", "raschet.dop." + k + ".plus", { num: 1, mode: "decimal" }) + "</div>"; }).join("") + "</div>";
  }

  // ---------- ZIP (без сжатия: фото уже сжаты) ----------
  var CRC = (function () { var t = [], c; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u) { var c = -1; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
  function zip(files) { // files: [{name, data: Uint8Array}]
    var parts = [], cen = [], off = 0, enc = new TextEncoder();
    var d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)), dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate());
    files.forEach(function (f) {
      var nm = enc.encode(f.name), crc = crc32(f.data), n = f.data.length;
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, dt, true); h.setUint16(12, dd, true);
      h.setUint32(14, crc, true); h.setUint32(18, n, true); h.setUint32(22, n, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      parts.push(h.buffer, nm, f.data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, dt, true); c.setUint16(14, dd, true);
      c.setUint32(16, crc, true); c.setUint32(20, n, true); c.setUint32(24, n, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      cen.push(c.buffer, nm);
      off += 30 + nm.length + n;
    });
    var cs = cen.reduce(function (s, p) { return s + (p.byteLength || p.length); }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(cen, [e.buffer]), { type: "application/zip" });
  }
  function exportZip() {
    var out = clone(D), files = [], jobs = [], used = {};
    out.shablon = false; out.obnovleno = new Date().toISOString().slice(0, 10);
    out.raboty.forEach(function (w, i) {
      // временный id новой работы меняем на понятный по названию (по нему же ссылки #rabota=...)
      if (!w.id || (/^rabota-/.test(w.id) && w.nazvanie)) {
        var base = slug(w.nazvanie), id2 = base, n = 2;
        while (out.raboty.some(function (x) { return x !== w && x.id === id2; })) id2 = base + "-" + n++;
        out.otzyvy.forEach(function (r) { if (r.rabota === w.id) r.rabota = id2; });
        w.id = id2;
      }
      (w.foto || []).forEach(function (f, k) {
        if (!f.src || !/^idb:/.test(f.src)) return;
        var id = f.src.slice(4), name = "foto/" + w.id + "-" + (k + 1) + ".jpg";
        while (used[name]) name = name.replace(/\.jpg$/, "x.jpg"); used[name] = 1;
        f.src = name;
        jobs.push(idbGet(id).then(function (b) { return b ? b.arrayBuffer().then(function (a) { files.push({ name: name, data: new Uint8Array(a) }); }) : null; }));
      });
    });
    return Promise.all(jobs).then(function () {
      var js = "/* Содержимое витрины мастера - выгружено из Мастерской " + out.obnovleno + ". Положить в site/vitrina/ вместе с папкой foto/. */\nwindow.VITRINA = " + JSON.stringify(out, null, 2) + ";\n";
      files.unshift({ name: "dannye.js", data: new TextEncoder().encode(js) });
      var a = document.createElement("a"); a.href = URL.createObjectURL(zip(files)); a.download = "vitrina-" + out.obnovleno + ".zip";
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      toast("Архив скачан: тексты и " + (files.length - 1) + " фото");
    });
  }

  // ---------- вкладки и нажатия ----------
  var TAB = "raboty";
  function render() {
    if (TAB === "raboty") viewRaboty(); else if (TAB === "otzyvy") viewOtzyvy(); else if (TAB === "master") viewMaster(); else if (TAB === "ceny") viewCeny();
    [].forEach.call(document.querySelectorAll("#tabs button"), function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === TAB); });
    [].forEach.call(document.querySelectorAll(".view"), function (v) { v.classList.toggle("on", v.id === "v-" + TAB); });
  }
  $("fPhoto").addEventListener("change", function () {
    var fs = [].slice.call(this.files || []), w = D.raboty[CUR]; this.value = "";
    if (!w || !fs.length) return;
    toast("Готовлю фото: " + fs.length);
    fs.reduce(function (p, f) {
      return p.then(function () { return prepPhoto(f).then(function (b) { var id = newId(); PH[id] = URL.createObjectURL(b); w.foto = w.foto || []; w.foto.push({ src: "idb:" + id, znak: true, podpis: "" }); return idbPut(id, b); }); });
    }, Promise.resolve()).then(function () { D.shablon = false; save(true); render(); toast("Фото добавлены"); })
      .catch(function (e) { save(true); render(); toast(e.message || "Не получилось добавить фото"); });
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-tab],[data-a],[data-open],[data-mv],[data-fmv],[data-fdel],[data-kdel],[data-klink],[data-copy],[data-rdel],[data-odel]");
    if (!t) return;
    var a = t.getAttribute("data-a");
    if (t.hasAttribute("data-tab")) { TAB = t.getAttribute("data-tab"); render(); scrollTo(0, 0); return; }
    if (t.hasAttribute("data-mv")) { e.stopPropagation(); var i = +t.getAttribute("data-mv"); if (i > 0) { D.raboty.splice(i - 1, 0, D.raboty.splice(i, 1)[0]); save(); render(); } return; }
    if (t.hasAttribute("data-open")) { CUR = +t.getAttribute("data-open"); render(); scrollTo(0, 0); return; }
    if (t.hasAttribute("data-fmv")) { var k = +t.getAttribute("data-fmv"), f = D.raboty[CUR].foto; if (k > 0) { f.splice(k - 1, 0, f.splice(k, 1)[0]); save(); render(); } return; }
    if (t.hasAttribute("data-fdel")) { var fk = +t.getAttribute("data-fdel"), ff = D.raboty[CUR].foto[fk]; if (!confirm("Удалить это фото?")) return; D.raboty[CUR].foto.splice(fk, 1); if (ff && /^idb:/.test(ff.src || "")) idbDel(ff.src.slice(4)); save(); render(); return; }
    if (t.hasAttribute("data-kdel")) { if (!confirm("Убрать код? Отзыв по старой ссылке перестанет подтверждаться.")) return; D.kody.splice(+t.getAttribute("data-kdel"), 1); save(); render(); return; }
    if (t.hasAttribute("data-klink")) { showKod(t.getAttribute("data-klink")); $("kOut").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (t.hasAttribute("data-copy")) { var tx = t.getAttribute("data-copy"); if (navigator.clipboard) navigator.clipboard.writeText(tx).then(function () { toast("Скопировано"); }); else prompt("Скопируйте:", tx); return; }
    if (t.hasAttribute("data-rdel")) { if (!confirm("Удалить отзыв?")) return; D.otzyvy.splice(+t.getAttribute("data-rdel"), 1); save(); render(); return; }
    if (t.hasAttribute("data-odel")) { D.otlichiya.splice(+t.getAttribute("data-odel"), 1); save(); render(); return; }
    if (a === "addWork") { D.raboty.unshift({ id: "rabota-" + newId(), vid: "", nazvanie: "", gde: "", kogda: new Date().toISOString().slice(0, 7), srok: "", material: "", cena: "", foto: [], rasskaz: "", resheniya: [] }); CUR = 0; D.shablon = false; save(); render(); }
    else if (a === "back") { CUR = -1; render(); }
    else if (a === "addPhoto") $("fPhoto").click();
    else if (a === "tidy") { var r = $("wRas"); r.value = tidy(r.value); r.dispatchEvent(new Event("input", { bubbles: true })); toast("Готово: точки и заглавные расставлены"); }
    else if (a === "delWork") { if (!confirm("Удалить работу целиком?")) return; (D.raboty[CUR].foto || []).forEach(function (f) { if (/^idb:/.test(f.src || "")) idbDel(f.src.slice(4)); }); D.raboty.splice(CUR, 1); CUR = -1; save(); render(); }
    else if (a === "kod") {
      if (!window.crypto || !crypto.subtle) { toast("Этот браузер не умеет делать коды - откройте сайт в Chrome или Safari"); return; }
      var kod = makeKod(), zak = $("kZak").value.trim(), chto = $("kChto").value.trim(), kog = $("kKog").value;
      hashKod(kod).then(function (h) {
        D.kody.unshift({ h: h, zakaz: zak, chto: chto, kogda: kog }); LK[h] = kod;
        try { localStorage.setItem(KODY, JSON.stringify(LK)); } catch (er) {}
        save(true); render(); showKod(kod, zak);
      });
    }
    else if (a === "paste") { var pt = $("rPaste").value.trim(); if (!pt) { toast("Вставьте сообщение с отзывом"); return; } D.otzyvy.unshift(parseReview(pt)); save(); render(); toast("Отзыв добавлен - проверьте поля"); }
    else if (a === "addRev") { D.otzyvy.unshift({ imya: "", rabota: "", zakaz: "", data: new Date().toISOString().slice(0, 10), ocenka: 5, kod: false, stranica: "", tekst: "" }); save(); render(); }
    else if (a === "addPl") { D.ploshchadki.push({ nazv: "", url: "" }); save(); render(); }
    else if (a === "addOt") { D.otlichiya.push({ zag: "", tekst: "" }); save(); render(); }
    else if (a === "zip") { save(true); exportZip().catch(function () { toast("Не получилось собрать архив"); }); }
    else if (a === "reset") { if (!confirm("Удалить черновик и начать с витрины, которая сейчас на сайте?")) return; localStorage.removeItem(KEY); location.reload(); }
  });
  // при уходе со страницы черновик уже сохранён; на всякий случай - сразу
  window.addEventListener("pagehide", function () { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} });

  idbAll().then(render);
  render();
})();
