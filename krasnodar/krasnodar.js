/* Закрытая витрина для Краснодара: главная страница после входа по пин-коду.
   Данные (витрина мастера, вопросы, приветствие, номер WhatsApp) приходят расшифрованными из zamok.js.
   Ответы мастера хранятся только в этом браузере (localStorage kr-otvety) и уходят текстом
   в WhatsApp Александру, копией или файлом - сервера у сайта нет. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var LS = "kr-otvety";
  var D, V, A, S;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function toast(t) { var el = $("toast"); el.textContent = t; el.className = "on"; clearTimeout(toast.t); toast.t = setTimeout(function () { el.className = ""; }, 2600); }
  function load() { try { var o = JSON.parse(localStorage.getItem(LS) || "null"); if (o && typeof o === "object") return o; } catch (e) {} return {}; }
  function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} counts(); }
  var MON = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  function month(s) { var m = /^(\d{4})-(\d{2})/.exec(s || ""); return m ? MON[+m[2] - 1] + " " + m[1] : (s || ""); }

  var MIC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function area(key, ph) {
    return '<div class="ta"><textarea data-k="' + esc(key) + '" placeholder="' + esc(ph || "Ваш ответ") + '" rows="3"></textarea>' +
      (SR ? '<button type="button" class="mic" data-mic="' + esc(key) + '" aria-label="Сказать голосом" title="Сказать голосом">' + MIC + "</button>" : "") + "</div>";
  }
  function chips(key, list, multi) {
    return '<div class="chips" data-ch="' + esc(key) + '"' + (multi ? ' data-multi="1"' : "") + ">" +
      list.map(function (v) { return '<button type="button" data-v="' + esc(v) + '">' + esc(v) + "</button>"; }).join("") + "</div>";
  }

  // мессенджеры: отметить, какими пользуется (q:<id>), для каждого номер или ссылка (q:<id>:<имя>), какой основной (q:<id>:osn)
  function mess(q) {
    var k = "q:" + q.id, list = q.var || [];
    return '<div class="chips" data-ch="' + esc(k) + '" data-multi="1" data-mess="' + esc(q.id) + '">' +
      list.map(function (v) { return '<button type="button" data-v="' + esc(v) + '">' + esc(v) + "</button>"; }).join("") + "</div>" +
      list.map(function (v) {
        return '<label class="mrow" data-mr="' + esc(v) + '" hidden><span>' + esc(v) + '</span><input type="text" data-k="' + esc(k + ":" + v) +
          '" placeholder="' + esc((q.mph && q.mph[v]) || "Номер или ссылка") + '" autocomplete="off"></label>';
      }).join("") +
      '<div class="mosn" hidden><p class="h">Куда клиентам писать в первую очередь?</p>' + chips(k + ":osn", list) + "</div>";
  }
  function paintMess(box) {
    var id = box.getAttribute("data-mess"), k = "q:" + id, a = sel(k), card = box.parentNode;
    [].forEach.call(card.querySelectorAll("[data-mr]"), function (r) {
      var v = r.getAttribute("data-mr"); r.hidden = a.indexOf(v) < 0 && !txt(k + ":" + v);
    });
    var o = card.querySelector(".mosn"); if (o) o.hidden = a.length < 2 && !sel(k + ":osn").length;
  }
  function messAns(q) {
    var k = "q:" + q.id, a = sel(k), out = [];
    (q.var || []).forEach(function (v) {
      var t = txt(k + ":" + v).trim();
      if (a.indexOf(v) >= 0 || t) out.push(v + (t ? " " + t : ""));
    });
    var o = sel(k + ":osn")[0];
    return (out.length ? "Пользуется: " + out.join(", ") : "") + (o ? (out.length ? ". " : "") + "Основной: " + o : "");
  }

  // ---------- ключи ответов: q:<id> - текст, c:<id> - выбор, w:<id> - работа, r:<id> - отзыв ----------
  function txt(k) { return (S.t && S.t[k]) || ""; }
  function setTxt(k, v) { S.t = S.t || {}; if (v) S.t[k] = v; else delete S.t[k]; }
  function sel(k) { return (S.c && S.c[k]) || []; }
  function setSel(k, a) { S.c = S.c || {}; if (a.length) S.c[k] = a; else delete S.c[k]; }

  // ---------- отзыв: вопросы постоянные ----------
  var REV = [
    { id: "zvezdy", q: "Как вам витрина в целом?", tip: "stars" },
    { id: "nravitsya", q: "Что понравилось?" },
    { id: "pomenyat", q: "Что поменять или убрать?" },
    { id: "ne_hvataet", q: "Чего не хватает? Что ещё хотели бы на сайте?" },
    { id: "budete", q: "Будете отправлять такую витрину клиентам?", tip: "chips", var: ["Да", "Скорее да", "Пока не знаю", "Нет"] },
    { id: "pokazat", q: "Можно показать ваш отзыв другим мастерам?", tip: "chips", var: ["Да, с именем", "Да, без имени", "Нет"] }
  ];

  // ---------- отрисовка ----------
  function renderHead() {
    var m = V.master || {};
    $("ttl").textContent = A.zagolovok || "Закрытая витрина";
    $("sub").textContent = [A.zagolovok === m.imya ? "" : m.imya, m.gorod].filter(Boolean).join(" · ");
    document.title = (A.zagolovok || "Закрытая витрина");
    $("privet").textContent = A.privet || "";
    var R = V.raboty || [];
    var f1 = R[0] && R[0].foto && R[0].foto[0], f2 = R[1] && R[1].foto && R[1].foto[0];
    if (f1 && f1.src) $("bg1").style.backgroundImage = 'url("' + f1.src + '")';
    if (f2 && f2.src && $("bg2")) $("bg2").style.backgroundImage = 'url("' + f2.src + '")';
    try { if (window.MebelSite && MebelSite.isStaff()) $("staff").hidden = false; } catch (e) {}
  }
  function renderWorks() {
    $("works").innerHTML = (V.raboty || []).map(function (w) {
      var meta = [w.gde, month(w.kogda), w.srok, w.material].filter(Boolean).join(" · ");
      var pics = (w.foto || []).filter(function (f) { return f && f.src; });
      return '<div class="card work" data-w="' + esc(w.id) + '">' +
        (pics.length ? '<div class="pics">' + pics.map(function (f) { return '<img src="' + esc(f.src) + '" alt="' + esc(f.podpis || w.nazvanie) + '" loading="lazy" data-zoom>'; }).join("") + "</div>" : "") +
        '<div class="bd"><h3>' + esc(w.nazvanie) + "</h3>" + (meta ? '<div class="meta">' + esc(meta) + "</div>" : "") +
        (w.rasskaz ? '<p class="story">' + esc(w.rasskaz) + "</p>" : "") +
        ((w.resheniya || []).length ? "<ul>" + w.resheniya.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
        pics.map(function (f, i) { return f.podpis ? '<p class="cap"><b>Фото ' + (i + 1) + ":</b> " + esc(f.podpis) + "</p>" : ""; }).join("") +
        '<div class="verdict" data-wv="' + esc(w.id) + '"><button type="button" data-v="ok">Всё верно</button><button type="button" data-v="fix">Есть правка</button></div>' +
        '<div class="fixbox" hidden>' + area("w:" + w.id, "Что поправить или добавить: подпись, текст, сроки, материалы, район") + "</div>" +
        "</div></div>";
    }).join("") || '<div class="card">Работ пока нет.</div>';
  }
  function renderQs() {
    var n = 0;
    $("qs").innerHTML = (A.gruppy || []).map(function (g) {
      return '<div class="grp">' + esc(g.zag) + "</div>" + (g.voprosy || []).map(function (q) {
        n++;
        return '<div class="card q" data-q="' + esc(q.id) + '"><h3>' + n + ". " + esc(q.q) + "</h3>" + (q.h ? '<p class="h">' + esc(q.h) + "</p>" : "") +
          (q.tip === "chips" ? chips("q:" + q.id, q.var || [], q.multi) : "") +
          (q.tip === "mess" ? mess(q) : "") +
          area("q:" + q.id, q.ph || (q.tip ? "Можно добавить словами" : "Ваш ответ")) + "</div>";
      }).join("");
    }).join("");
  }
  function renderRev() {
    $("rev").innerHTML = REV.map(function (q) {
      var body = q.tip === "stars" ? '<div class="stars" data-ch="r:' + q.id + '">' + [1, 2, 3, 4, 5].map(function (i) { return '<button type="button" data-v="' + i + '" aria-label="' + i + ' из 5">★</button>'; }).join("") + "</div>" + area("r:" + q.id, "Пару слов, почему так")
        : q.tip === "chips" ? chips("r:" + q.id, q.var) : area("r:" + q.id);
      return '<div class="card q" data-q="r:' + q.id + '"><h3>' + esc(q.q) + "</h3>" + body + "</div>";
    }).join("");
  }
  function fill() {
    [].forEach.call(document.querySelectorAll("textarea[data-k], input[data-k]"), function (t) { t.value = txt(t.getAttribute("data-k")); });
    [].forEach.call(document.querySelectorAll("[data-ch]"), paintChips);
    [].forEach.call(document.querySelectorAll("[data-wv]"), paintVerdict);
    counts();
  }
  function paintChips(box) {
    var k = box.getAttribute("data-ch"), a = sel(k), stars = box.classList.contains("stars");
    if (box.hasAttribute("data-mess")) paintMess(box);
    [].forEach.call(box.querySelectorAll("button"), function (b) {
      var v = b.getAttribute("data-v");
      b.classList.toggle("on", stars ? a.length && +v <= +a[0] : a.indexOf(v) >= 0);
    });
  }
  function verdict(id) { return (S.w && S.w[id]) || ""; }
  function paintVerdict(box) {
    var id = box.getAttribute("data-wv"), v = verdict(id);
    [].forEach.call(box.querySelectorAll("button"), function (b) { b.classList.toggle("on", b.getAttribute("data-v") === v); });
    box.nextElementSibling.hidden = !(v === "fix" || txt("w:" + id));
  }

  // ---------- сколько сделано ----------
  function qList() { var a = []; (A.gruppy || []).forEach(function (g) { (g.voprosy || []).forEach(function (q) { a.push(q); }); }); return a; }
  function answered(k) {
    if (txt(k).trim() || sel(k).length) return true;
    var p = k + ":", t = S.t || {}, c = S.c || {};
    return Object.keys(t).concat(Object.keys(c)).some(function (x) { return x.indexOf(p) === 0; });
  }
  function counts() {
    var R = V.raboty || [], Q = qList();
    var wd = R.filter(function (w) { return verdict(w.id) || txt("w:" + w.id); }).length;
    var qd = Q.filter(function (q) { return answered("q:" + q.id); }).length;
    var rd = REV.filter(function (q) { return answered("r:" + q.id); }).length;
    $("cR").textContent = wd + "/" + R.length;
    $("cQ").textContent = qd + "/" + Q.length;
    $("st1s").textContent = R.length ? "Проверено " + wd + " из " + R.length : "Работ пока нет";
    $("st2s").textContent = "Отвечено " + qd + " из " + Q.length;
    $("st3s").textContent = rd ? "Заполнено " + rd + " из " + REV.length : "Пара минут";
    $("st1").classList.toggle("done", R.length > 0 && wd === R.length);
    $("st2").classList.toggle("done", qd === Q.length);
    $("st3").classList.toggle("done", rd > 0);
    [].forEach.call(document.querySelectorAll(".q[data-q]"), function (el) {
      var k = el.getAttribute("data-q"); el.classList.toggle("done", answered(/^r:/.test(k) ? k : "q:" + k));
    });
    sendUpd(wd + qd + rd);
  }

  // ---------- текст для отправки ----------
  function compose() {
    var blocks = [], m = V.master || {};
    var head = (A.zagolovok || "Закрытая витрина") + ": ответы" + ((m.chelovek || m.imya) ? " - " + (m.chelovek || m.imya) : "") + " (" + new Date().toLocaleDateString("ru-RU") + ")";
    var w = (V.raboty || []).map(function (x) {
      var v = verdict(x.id), t = txt("w:" + x.id).trim();
      if (!v && !t) return "";
      return "- " + x.nazvanie + ": " + (v === "ok" && !t ? "всё верно" : (v === "ok" ? "всё верно. " : "правка: ") + t);
    }).filter(Boolean);
    if (w.length) blocks.push("ПОДПИСИ РАБОТ\n" + w.join("\n"));
    var n = 0, q = [];
    qList().forEach(function (x) {
      n++;
      var a = x.tip === "mess" ? messAns(x) : sel("q:" + x.id).join(", "), t = txt("q:" + x.id).trim();
      if (a || t) q.push(n + ". " + x.q + "\n" + [a, t].filter(Boolean).join(". "));
    });
    if (q.length) blocks.push("ВОПРОСЫ\n" + q.join("\n\n"));
    var r = REV.map(function (x) {
      var a = sel("r:" + x.id), t = txt("r:" + x.id).trim();
      if (x.tip === "stars" && a.length) a = [a[0] + " из 5"];
      a = a.join(", ");
      return a || t ? x.q + "\n" + [a, t].filter(Boolean).join(". ") : "";
    }).filter(Boolean);
    if (r.length) blocks.push("ОТЗЫВ\n" + r.join("\n\n"));
    return { head: head, blocks: blocks };
  }
  // WhatsApp не любит очень длинные ссылки: делим на сообщения по ~1500 знаков, по границам блоков и абзацев
  var LIM = 1500;
  function parts() {
    var c = compose(); if (!c.blocks.length) return [];
    var pieces = [];
    c.blocks.forEach(function (b) {
      if (b.length <= LIM) { pieces.push(b); return; }
      var cur = "";
      b.split("\n\n").forEach(function (p) {
        while (p.length > LIM) { if (cur) { pieces.push(cur); cur = ""; } pieces.push(p.slice(0, LIM)); p = p.slice(LIM); }
        if (cur && (cur + "\n\n" + p).length > LIM) { pieces.push(cur); cur = p; } else cur = cur ? cur + "\n\n" + p : p;
      });
      if (cur) pieces.push(cur);
    });
    var out = [], cur = c.head;
    pieces.forEach(function (p) {
      if ((cur + "\n\n" + p).length > LIM && cur !== c.head) { out.push(cur); cur = p; }
      else cur = cur + "\n\n" + p;
    });
    out.push(cur);
    if (out.length > 1) out = out.map(function (t, i) { return "(" + (i + 1) + " из " + out.length + ") " + t; });
    return out;
  }
  function full() { var c = compose(); return c.blocks.length ? c.head + "\n\n" + c.blocks.join("\n\n") : ""; }
  function waUrl(t) { var n = String(A.whatsapp || "").replace(/\D/g, ""); return "https://wa.me/" + n + "?text=" + encodeURIComponent(t); }

  var TAB = "glav";
  function sendUpd(done) {
    var show = TAB !== "glav" || done > 0;
    $("send").hidden = !show;
    var P = parts();
    var who = A.komu || "нам";
    $("waT").textContent = P.length > 1 ? "В WhatsApp (" + P.length + ")" : "В WhatsApp";
    $("wa").title = "Отправить " + who + " в WhatsApp";
    $("wa").href = P.length === 1 ? waUrl(P[0]) : "#";
    $("wa").setAttribute("aria-disabled", P.length ? "false" : "true");
    $("parts").innerHTML = P.length > 1 ? P.map(function (t, i) { return '<a class="btn" target="_blank" rel="noopener" href="' + esc(waUrl(t)) + '">Сообщение ' + (i + 1) + " из " + P.length + "</a>"; }).join("") : "";
    if (P.length < 2) $("parts").hidden = true;
    $("sendNote").textContent = !P.length ? "Сначала ответьте хотя бы на один вопрос." : S.sent ? "Последний раз отправляли " + S.sent + ". Новые ответы можно отправить ещё раз." : "Ответы уйдут " + who + ": откроется WhatsApp с готовым текстом, останется нажать «Отправить».";
  }

  // ---------- голос ----------
  var rec = null, recKey = null;
  function micStop() { if (rec) { try { rec.stop(); } catch (e) {} } }
  function micStart(k) {
    micStop();
    var t = document.querySelector('textarea[data-k="' + k + '"]'), b = document.querySelector('[data-mic="' + k + '"]');
    if (!t || !SR) return;
    var r = new SR(); r.lang = "ru-RU"; r.continuous = true; r.interimResults = true;
    var base = t.value ? t.value.replace(/\s*$/, " ") : "";
    r.onresult = function (e) {
      var fin = "", tmp = "";
      for (var i = 0; i < e.results.length; i++) { var s = e.results[i][0].transcript; if (e.results[i].isFinal) fin += s; else tmp += s; }
      fin = fin.replace(/^\s+/, ""); if (fin) fin = fin.charAt(0).toUpperCase() + fin.slice(1);
      t.value = base + fin + (tmp ? " " + tmp : "");
      setTxt(k, (base + fin).trim()); save();
    };
    r.onerror = function (e) { if (e.error === "not-allowed") toast("Нет доступа к микрофону. Разрешите его в настройках браузера."); };
    r.onend = function () { if (b) b.classList.remove("on"); setTxt(k, t.value.trim()); save(); if (rec === r) { rec = null; recKey = null; } };
    try { r.start(); rec = r; recKey = k; if (b) b.classList.add("on"); toast("Говорите. Нажмите микрофон ещё раз, чтобы закончить."); } catch (e) { toast("Не получилось включить микрофон"); }
  }

  // ---------- вкладки ----------
  function route() {
    var h = (location.hash || "").replace("#", "");
    TAB = ["raboty", "voprosy", "otzyv"].indexOf(h) >= 0 ? h : "glav";
    ["glav", "raboty", "voprosy", "otzyv"].forEach(function (t) { $("s-" + t).hidden = t !== TAB; });
    [].forEach.call(document.querySelectorAll("[data-tab]"), function (a) { a.classList.toggle("on", a.getAttribute("data-tab") === TAB); });
    micStop(); counts();
    window.scrollTo(0, 0);
  }

  // ---------- события ----------
  function bind() {
    document.addEventListener("input", function (e) {
      var k = e.target.getAttribute && e.target.getAttribute("data-k");
      if (k) { setTxt(k, e.target.value.trim()); save(); }
    });
    document.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target : null; if (!b) return;
      var mic = b.closest("[data-mic]");
      if (mic) { var k = mic.getAttribute("data-mic"); if (recKey === k) micStop(); else micStart(k); return; }
      var ch = b.closest("[data-ch] button");
      if (ch) {
        var box = ch.parentNode, key = box.getAttribute("data-ch"), v = ch.getAttribute("data-v"), a = sel(key).slice();
        if (box.classList.contains("stars")) a = a[0] === v ? [] : [v];
        else if (box.getAttribute("data-multi")) { var i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else a.push(v); }
        else a = a[0] === v ? [] : [v];
        setSel(key, a); paintChips(box); save(); return;
      }
      var wv = b.closest("[data-wv] button");
      if (wv) {
        var bx = wv.parentNode, id = bx.getAttribute("data-wv"), val = wv.getAttribute("data-v");
        S.w = S.w || {}; if (S.w[id] === val) delete S.w[id]; else S.w[id] = val;
        paintVerdict(bx); save();
        if (S.w[id] === "fix") { var ta = bx.nextElementSibling.querySelector("textarea"); if (ta) ta.focus(); }
        return;
      }
      var z = b.closest("[data-zoom]");
      if (z) { $("zoom").querySelector("img").src = z.src; $("zoom").hidden = false; return; }
      if (b.closest("#zoom")) { $("zoom").hidden = true; return; }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") $("zoom").hidden = true; });
    $("wa").addEventListener("click", function (e) {
      var P = parts();
      if (!P.length) { e.preventDefault(); toast("Сначала ответьте хотя бы на один вопрос"); return; }
      if (P.length > 1) { e.preventDefault(); $("parts").hidden = !$("parts").hidden; if (!$("parts").hidden) toast("Отправьте сообщения по очереди"); return; }
      S.sent = new Date().toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }); save();
    });
    $("parts").addEventListener("click", function (e) {
      if (e.target.closest("a")) { e.target.closest("a").style.opacity = ".55"; S.sent = new Date().toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }); save(); }
    });
    $("copy").addEventListener("click", function () {
      var t = full(); if (!t) { toast("Пока нечего копировать"); return; }
      var done = function () { toast("Скопировано. Вставьте в сообщение Александру."); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fallback); else fallback();
      function fallback() { var a = document.createElement("textarea"); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); done(); } catch (e) { toast("Не получилось скопировать"); } a.remove(); }
    });
    $("file").addEventListener("click", function () {
      var t = full(); if (!t) { toast("Пока нечего сохранять"); return; }
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([t], { type: "text/plain;charset=utf-8" }));
      a.download = "otvety-mastera-" + new Date().toISOString().slice(0, 10) + ".txt";
      document.body.appendChild(a); a.click(); a.remove();
      toast("Файл сохранён. Его можно отправить Александру.");
    });
    $("out").addEventListener("click", function () { KrZamok.logout(); });
    window.addEventListener("hashchange", route);
  }

  KrZamok.unlock().then(function (r) {
    D = r.data; V = D.vitrina || {}; A = D.anketa || {}; S = load();
    renderHead(); renderWorks(); renderQs(); renderRev(); fill(); bind(); route();
    if (KrZamok.otkryto && $("out")) $("out").remove(); // открытый вход: выходить не из чего
    document.body.classList.remove("locked");
  });
})();
