/* Быстрый расчёт для клиента: по шагам "что делаем - размеры - материалы - наполнение - итог".
   Цены и формулы - в kalk-ceny.js (window.KalkCeny), данные витрины - window.VITRINA (имя мастера, контакты, работы, kalk).
   Клиент видит вилку "от - до" и отправляет итог мастеру в WhatsApp (Telegram и Max - текст копируется).
   Прогресс хранится в этом браузере (localStorage "kalk-v1"): можно уйти на витрину и вернуться.
   Ссылки: ?iz=kuhnya - сразу размеры кухни; ?rabota=<id> - "понравилась работа" (с экрана работы на витрине);
   ?ot=proba - куда вести "К витрине" (пробный вход), иначе ../klient/. */
(function () {
  "use strict";
  var K = window.KalkCeny, V = window.VITRINA || {}, M = V.master || {}, KT = V.kontakty || {};
  var C = K.conf(V), SYM = K.cur(V);
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var QS = {}; location.search.replace(/^\?/, "").split("&").forEach(function (p) { var i = p.indexOf("="); if (i > 0) try { QS[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1).replace(/\+/g, " ")); } catch (e) {} });
  var IZD = K.IZD.filter(function (x) { return C.skryt.indexOf(x.id) < 0; });
  var WORKS = (V.raboty || []).filter(function (w) { return w && w.foto && w.foto[0] && w.foto[0].src; });

  // мастер выключил расчёт в Мастерской - только приглашение написать
  if (C.vkl === false) {
    var w0 = String(KT.whatsapp || "").replace(/\D/g, "");
    $("kalk").innerHTML = '<main class="k-main"><p class="k-cap">Расчёт стоимости</p><h1 class="k-h">Напишите мастеру</h1><p class="k-lead">Расскажите, что хотите сделать - мастер подскажет цену и сроки.</p>' +
      (w0 ? '<a class="k-btn p" href="https://wa.me/' + w0 + '" target="_blank" rel="noopener">WhatsApp</a> ' : "") + '<a class="k-btn" href="../' + (QS.ot === "proba" ? "proba/" : "klient/") + '">К работам</a></main>';
    return;
  }

  // ---------- состояние ----------
  var KEY = "kalk-v1", ST;
  try { ST = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (!ST || ST.v !== 1 || !Array.isArray(ST.items)) ST = { v: 1, items: [], cur: -1, step: 1, k: {} };
  ST.items = ST.items.filter(function (b) { return b && K.BY[b.iz] && C.skryt.indexOf(b.iz) < 0; });
  ST.items.forEach(function (b) { b.dop = b.dop || {}; });
  if (ST.cur >= ST.items.length) ST.cur = -1;
  ST.k = ST.k || {};
  function save() { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) {} }
  function item() { return ST.items[ST.cur] || null; }
  // по ссылке с витрины: работа и/или изделие
  if (QS.rabota) { var wk = workById(QS.rabota); if (wk) ST.rabota = wk.id; }
  var iz0 = QS.iz && K.BY[QS.iz] && C.skryt.indexOf(QS.iz) < 0 ? QS.iz : "";
  if (iz0) {
    var j = -1; ST.items.forEach(function (b, i) { if (b.iz === iz0) j = i; });
    if (j < 0) { ST.items.push(K.novoe(iz0)); j = ST.items.length - 1; }
    ST.cur = j; ST.step = 2;
  } else if (!ST.items.length) { ST.cur = -1; ST.step = 1; }
  else if (QS.rabota) { ST.cur = -1; ST.step = 1; } // с экрана работы - выбрать, что считаем под неё (уже посчитанное остаётся в итоге)
  if (ST.step > 1 && ST.step < 5 && !item()) ST.step = ST.items.length ? 5 : 1;
  if (ST.step === 5 && !ST.items.length && !ST.other) ST.step = 1;
  save();
  function workById(id) { for (var i = 0; i < WORKS.length; i++) if (WORKS[i].id === id) return WORKS[i]; return null; }

  // ---------- значки ----------
  var I = {
    kuhnya: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M5 26h38v16H5zM5 30h38M18 30v12M31 30v12M7 6h34v12H7zM24 6v12"/><path d="M14 35v2M22 35v2M26 35v2M34 35v2M20 13v2M28 13v2" stroke-linecap="round"/><path d="M33 26v-3h5v3"/></svg>',
    kupe: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M6 5h36v38H6zM6 9h36"/><path d="M8 11h17v30H8zM23 11h17v30H23z"/><path d="M27 15l9 9M27 21l6 6" stroke-linecap="round" opacity=".6"/></svg>',
    shkaf: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M8 4h32v38H8zM24 4v38M8 42v3M40 42v3"/><path d="M21 20v5M27 20v5" stroke-linecap="round"/></svg>',
    garderob: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"><path d="M4 8h40M4 8v34M44 8v34M24 8v34M4 30h20"/><path d="M6 13h16M10 13v9M15 13v11M19 13v8"/><path d="M26 15h16M26 22h16M26 29h16M26 36h16"/></svg>',
    prihozhaya: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"><path d="M5 5h18v37H5zM14 5v37"/><path d="M27 8h16M30 8v4M35 8v4M40 8v4"/><path d="M27 34h16v8H27zM27 38h16"/><rect x="29" y="15" width="12" height="15" rx="6"/></svg>',
    tv: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 12h24v14H12zM4 34h40v8H4zM17 34v8M31 34v8"/><path d="M4 8h6M38 8h6M4 18h5M39 18h5"/></svg>',
    vannaya: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"><path d="M6 24h26v18H6zM6 24c2-3 24-3 26 0M19 22v-5h4M19 33v3"/><path d="M36 6h8v36h-8zM36 24h8"/><rect x="12" y="5" width="14" height="10" rx="1"/></svg>',
    other: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"><path d="M10 38l4-12L34 6l8 8-20 20zM14 26l8 8M30 10l8 8"/><path d="M6 44h36"/></svg>',
    arr: '<svg viewBox="0 0 40 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M37 12H4M11 5.5L4 12l7 6.5"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M14 6l6 6-6 6"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12H5M10 6l-6 6 6 6"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.4 18.6z"/><path d="M9.2 8.6c.2 2.9 2.4 5.3 5.6 6l1.1-1.3-1.8-1-1 .8a4.6 4.6 0 0 1-2.4-2.4l.8-1-1-1.8z"/></svg>',
    tg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 4.5L3.5 11l6 2.2L20.5 4.5l-8.3 10.2.4 5 2.7-3.7 4.2 3z"/></svg>',
    mx: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M12 4a8 8 0 0 0-6.9 12.1L4 20l3.9-1.1A8 8 0 1 0 12 4z"/><path d="M8.5 14.5v-5l3.5 3.2 3.5-3.2v5" stroke-linecap="round"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/></svg>',
    tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/></svg>'
  };

  // ---------- каркас страницы ----------
  var BACK = "../" + (QS.ot === "proba" ? "proba/" : "klient/") + (ST.rabota && QS.rabota ? "#rabota=" + encodeURIComponent(ST.rabota) : "");
  var root = $("kalk");
  root.innerHTML = '<div class="k-glow" aria-hidden="true"></div>' +
    '<header class="k-top" id="kTop"><a class="k-back" id="kBack" href="' + esc(BACK) + '">' + I.arr + "<span>К работам</span></a>" +
    '<span class="k-brand">' + esc(M.imya || "") + "</span></header>" +
    '<div class="k-steps" id="kSteps" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>' +
    '<main class="k-main" id="kMain" tabindex="-1"></main>' +
    '<div class="k-bar" id="kBar"><div class="in"><button type="button" class="k-btn ic" id="kPrev" aria-label="Назад">' + I.prev + '</button>' +
    '<div class="k-price" aria-live="polite"><small id="kPL">Предварительно</small><b id="kP"></b></div>' +
    '<button type="button" class="k-btn p" id="kNext"><span>Дальше</span>' + I.next + "</button></div></div>" +
    '<div class="k-toast" id="kToast" role="status"></div>';
  document.title = "Расчёт стоимости" + (M.imya ? " - " + M.imya : "");
  addEventListener("scroll", function () { $("kTop").classList.toggle("sc", scrollY > 8); }, { passive: true });
  // "К работам": если пришли с витрины - вернуться по истории (витрина откроется там же, без заставки), иначе по ссылке
  var PUSHED = 0, FROMV = false;
  try { FROMV = !!document.referrer && new URL(document.referrer).origin === location.origin && /\/(klient|proba)\//.test(new URL(document.referrer).pathname); } catch (e) {}
  $("kBack").onclick = function (e) { if (FROMV && history.length > 1) { e.preventDefault(); history.go(-(PUSHED + 1)); } };
  function toast(t, ms) { var e = $("kToast"); e.textContent = t; e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove("on"); }, ms || 2600); }

  // ---------- шаги ----------
  var STEPS = [null, s1, s2, s3, s4, s5];
  function go(n, how) {
    if (n > 1 && n < 5 && !item()) n = 1;
    ST.step = n; save(); $("kToast").classList.remove("on");
    if (how !== "pop") { history.pushState({ kalk: n }, ""); PUSHED++; }
    draw(); scrollTo(0, 0);
    if (how !== "first") { var m = $("kMain"); try { m.focus({ preventScroll: true }); } catch (e) {} }
  }
  history.replaceState({ kalk: ST.step }, "");
  addEventListener("popstate", function (e) {
    if (e.state && e.state.kalk) { PUSHED = Math.max(0, PUSHED - 1); go(e.state.kalk, "pop"); }
  });
  function draw() {
    var n = ST.step;
    [].forEach.call($("kSteps").children, function (x, i) { x.classList.toggle("on", i < n); });
    $("kMain").innerHTML = '<div class="k-step">' + STEPS[n]() + "</div>";
    (STEPS[n].bind || function () {})();
    bar();
  }
  function bar() {
    var n = ST.step, b = item();
    $("kPrev").hidden = n === 1;
    $("kNext").hidden = n === 1 || n === 5;
    $("kNext").firstChild.textContent = n === 4 ? "Итог" : "Дальше";
    var lo = 0, hi = 0;
    if (n === 5) ST.items.forEach(function (x) { var r = K.schet(x, C); if (r) { lo += r.lo; hi += r.hi; } });
    else if (b) { var r = K.schet(b, C); lo = r.lo; hi = r.hi; }
    var P = $("kP"), t = lo || hi ? K.vilka(lo, hi, SYM) : "";
    $("kPL").textContent = n === 5 && ST.items.length > 1 ? "Всего, предварительно" : t ? "Предварительно" : "";
    if (!t && n === 1) $("kPL").textContent = "";
    if (P.textContent !== t) { P.textContent = t; P.classList.remove("bump"); void P.offsetWidth; if (t) P.classList.add("bump"); }
    $("kBar").hidden = n === 1 && !t;
  }
  // назад по шагам: по истории, если шаг открывали здесь; если пришли по ссылке сразу на шаг - просто предыдущий шаг
  $("kPrev").onclick = function () { if (PUSHED > 0) history.back(); else go(Math.max(1, ST.step - 1)); };
  $("kNext").onclick = function () { go(Math.min(5, ST.step + 1)); };

  // ---------- общие кусочки ----------
  function seg(key, list, cur, cls) {
    return '<div class="k-seg' + (cls ? " " + cls : "") + '" role="group">' + list.map(function (x) {
      return '<button type="button" data-set="' + key + '" data-v="' + esc(x.id) + '" aria-pressed="' + (x.id === cur) + '">' + (x.svg || "") + "<b>" + esc(x.nazv) + "</b>" + (x.opis ? "<span>" + esc(x.opis) + "</span>" : "") + "</button>";
    }).join("") + "</div>";
  }
  // "дороже" значками по месту в ряду цен: самый дешёвый - один знак, дальше больше (не больше четырёх)
  function rub(p, all) {
    var u = Object.keys(all || {}).map(function (k) { return +all[k] || 0; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
    var r = Math.max(0, u.indexOf(+p || 0)), n = u.length <= 4 ? r + 1 : 1 + Math.round(3 * r / (u.length - 1));
    return new Array(n + 1).join(SYM);
  }
  function swatches(key, list, cur, pct) {
    return '<div class="k-sw" role="group">' + list.map(function (x) {
      return '<button type="button" data-set="' + key + '" data-v="' + x.id + '" aria-pressed="' + (x.id === cur) + '"><span class="pic r-' + x.ris + '"></span><span class="tx"><b>' + esc(x.nazv) + (pct ? "<i>" + rub(pct[x.id], pct) + "</i>" : "") + "</b><span>" + esc(x.opis) + "</span></span></button>";
    }).join("") + "</div>";
  }
  function num(key, label, v, lim, hint) {
    return '<div class="k-f"><label for="n-' + key + '">' + esc(label) + '</label><div class="k-num"><button type="button" data-step="' + key + '" data-d="-1" aria-label="Меньше">' + I.minus + '</button>' +
      '<input id="n-' + key + '" type="text" inputmode="decimal" autocomplete="off" data-num="' + key + '" value="' + K.fmtNum(v) + '" aria-describedby="h-' + key + '"><em>м</em>' +
      '<button type="button" data-step="' + key + '" data-d="1" aria-label="Больше">' + I.plus + "</button></div>" +
      '<input class="k-rng" type="range" data-rng="' + key + '" min="' + lim[0] + '" max="' + lim[1] + '" step="' + lim[2] + '" value="' + v + '" aria-label="' + esc(label) + '">' +
      '<small id="h-' + key + '">' + esc(hint || "От " + K.fmtNum(lim[0]) + " до " + K.fmtNum(lim[1]) + " м") + "</small></div>";
  }
  function cntRow(key, nazv, opis, v, max) {
    return '<div class="k-opt"><div class="t"><b>' + esc(nazv) + "</b>" + (opis ? "<span>" + esc(opis) + "</span>" : "") + '</div><div class="k-cnt"><button type="button" data-cnt="' + key + '" data-d="-1" aria-label="Меньше"' + (v <= 0 ? " disabled" : "") + ">" + I.minus +
      '</button><output aria-live="polite">' + v + '</output><button type="button" data-cnt="' + key + '" data-d="1" data-max="' + max + '" aria-label="Больше"' + (v >= max ? " disabled" : "") + ">" + I.plus + "</button></div></div>";
  }
  function tgRow(key, nazv, opis, on) {
    return '<div class="k-opt"><div class="t"><b id="t-' + key + '">' + esc(nazv) + "</b>" + (opis ? "<span>" + esc(opis) + "</span>" : "") + '</div><button type="button" class="k-tg" role="switch" data-tg="' + key + '" aria-checked="' + !!on + '" aria-labelledby="t-' + key + '"></button></div>';
  }
  // путь "steny.1" / "dop.podsvetka" внутри изделия
  function getP(b, p) { return K.get(b, p); }
  function setP(b, p, v) { K.set(b, p, v); }
  // общий обработчик кнопок на шагах 2-4
  function bindCommon(after) {
    var m = $("kMain"), b = item();
    m.onclick = function (e) {
      var t = e.target.closest("button"); if (!t || !b) return;
      if (t.hasAttribute("data-set")) {
        var k = t.getAttribute("data-set"), v = t.getAttribute("data-v");
        setP(b, k, v === "true" ? true : v === "false" ? false : v);
        [].forEach.call(m.querySelectorAll('[data-set="' + k + '"]'), function (x) { x.setAttribute("aria-pressed", x === t); });
        changed(after, k);
      } else if (t.hasAttribute("data-step")) {
        var key = t.getAttribute("data-step"), lim = limOf(key), d = +t.getAttribute("data-d");
        var nv = Math.round((K.clamp(getP(b, key), lim[0], lim[1]) + d * lim[2]) * 100) / 100;
        setNum(key, K.clamp(nv, lim[0], lim[1])); changed(after, key);
      } else if (t.hasAttribute("data-cnt")) {
        var ck = t.getAttribute("data-cnt"), mx = +(m.querySelector('[data-cnt="' + ck + '"][data-max]').getAttribute("data-max"));
        var cv = Math.max(0, Math.min(mx, (+getP(b, ck) || 0) + +t.getAttribute("data-d")));
        setP(b, ck, cv);
        var box = t.parentNode; box.querySelector("output").textContent = cv;
        box.firstChild.disabled = cv <= 0; box.lastChild.disabled = cv >= mx;
        changed(after, ck);
      } else if (t.hasAttribute("data-tg")) {
        var tk = t.getAttribute("data-tg"), on = t.getAttribute("aria-checked") !== "true";
        setP(b, tk, on); t.setAttribute("aria-checked", on); changed(after, tk);
      }
    };
    [].forEach.call(m.querySelectorAll("[data-rng]"), function (r) {
      r.oninput = function () { var k = r.getAttribute("data-rng"); setNum(k, +r.value, "rng"); changed(after, k); };
    });
    [].forEach.call(m.querySelectorAll("[data-num]"), function (inp) {
      var k = inp.getAttribute("data-num");
      inp.oninput = function () { var v = parseFloat(inp.value.replace(",", ".").replace(/[^\d.]/g, "")); var lim = limOf(k); if (isFinite(v) && v >= lim[0] && v <= lim[1]) { setP(b, k, v); syncRng(k, v); changed(after, k); } };
      inp.onchange = inp.onblur = function () { var v = parseFloat(inp.value.replace(",", ".").replace(/[^\d.]/g, "")), lim = limOf(k); if (!isFinite(v)) v = getP(b, k); var c2 = K.clamp(v, lim[0], lim[1]); if (c2 !== v) toast("Можно от " + K.fmtNum(lim[0]) + " до " + K.fmtNum(lim[1]) + " м"); setNum(k, c2); changed(after, k); };
      inp.onkeydown = function (e) { if (e.key === "Enter") inp.blur(); };
      inp.onfocus = function () { setTimeout(function () { try { inp.select(); } catch (e) {} }, 0); };
    });
  }
  function limOf(key) {
    var b = item(); if (/^steny/.test(key)) return K.LIM.stena; if (key === "ostrov") return K.LIM.ostrov; if (key === "h") return K.LIM.h; if (key === "l") return K.LIM.l;
    return b && b.iz === "vannaya" ? K.LIM.vw : K.LIM.w;
  }
  function setNum(key, v, from) {
    var b = item(); setP(b, key, v);
    var inp = document.querySelector('[data-num="' + key + '"]'); if (inp && document.activeElement !== inp) inp.value = K.fmtNum(v);
    if (from !== "rng") syncRng(key, v);
  }
  function syncRng(key, v) { var r = document.querySelector('[data-rng="' + key + '"]'); if (r) r.value = v; }
  function changed(after, key) { save(); bar(); var sk = $("kSk"); if (sk) sk.innerHTML = sketch(item()); if (after) after(key); }

  // ---------- шаг 1: что делаем ----------
  function s1() {
    var b = item(), hint = hintIzd();
    var wk = ST.rabota && workById(ST.rabota);
    return '<p class="k-cap">Расчёт стоимости · шаг 1 из 5</p><h1 class="k-h">Что хотите сделать?</h1>' +
      '<p class="k-lead">' + (wk ? "Посчитаем примерно, сколько будет стоить мебель как в работе «" + esc(wk.nazvanie) + "» - но под ваши размеры. " : "Пять простых шагов - и вы увидите примерную стоимость. ") + "Точную цену мастер назовёт после замера.</p>" +
      '<div class="k-izd" role="group" aria-label="Изделие">' + IZD.map(function (x) {
        return '<button type="button" data-iz="' + x.id + '" aria-pressed="' + (!!b && b.iz === x.id) + '"' + (hint.indexOf(x.id) >= 0 && !b ? ' class="hint"' : "") + ">" + I[x.id] + "<span><b>" + esc(x.nazv) + "</b><span>" + esc(x.opis) + "</span></span></button>";
      }).join("") +
      '<button type="button" class="k-other" data-iz="other">' + I.other + "<span><b>Что-то другое</b><span>Подоконник, столешница, офис - опишите мастеру</span></span></button></div>" +
      (ST.items.length && ST.cur < 0 ? '<p class="k-small">В расчёте уже есть: ' + ST.items.map(function (x) { return K.BY[x.iz].nazv.toLowerCase(); }).join(", ") + '. <a href="#" id="kToRes">Вернуться к итогу</a></p>' : "");
  }
  s1.bind = function () {
    $("kMain").onclick = function (e) {
      var t = e.target.closest("[data-iz]"); if (!t) return;
      var id = t.getAttribute("data-iz");
      if (id === "other") { ST.other = true; save(); go(5); return; }
      var b = item();
      if (!b || b.iz !== id) {
        var nb = K.novoe(id);
        if (b) ST.items[ST.cur] = nb; else { ST.items.push(nb); ST.cur = ST.items.length - 1; }
      }
      save(); go(2);
    };
    var r = $("kToRes"); if (r) r.onclick = function (e) { e.preventDefault(); go(5); };
  };
  // изделия, похожие на работу, с которой пришли (подсветка на шаге 1)
  function hintIzd() {
    var w = ST.rabota && workById(ST.rabota); if (!w) return [];
    return K.IZD.filter(function (x) { return x.komnaty.indexOf(w.komnata) >= 0; }).map(function (x) { return x.id; }).slice(0, w.komnata === "kuhni" ? 1 : 3);
  }

  // ---------- шаг 2: размеры ----------
  var FSVG = {
    pryamaya: '<svg viewBox="0 0 54 40" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M6 8h42M6 8v8h42V8"/></svg>',
    uglovaya: '<svg viewBox="0 0 54 40" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M6 6h42v8H14v22H6z"/></svg>',
    p: '<svg viewBox="0 0 54 40" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M6 6h42v30h-8V14H14v22H6z"/></svg>'
  };
  function s2() {
    var b = item(), it = K.BY[b.iz], h = '<p class="k-cap">' + esc(it.nazv) + ' · шаг 2 из 5</p><h1 class="k-h">Размеры</h1>' +
      '<p class="k-lead">Достаточно примерно, на глаз или по рулетке. Мастер всё равно всё перемерит.</p><div class="k-sz"><div class="k-sk" id="kSk" aria-hidden="true">' + sketch(b) + "</div><div>";
    if (b.iz === "kuhnya") {
      var F = K.FORMA.filter(function (x) { return x.id === b.forma; })[0] || K.FORMA[0];
      h += '<div class="k-f"><span class="lb">Форма</span>' + seg("forma", K.FORMA.map(function (x) { return { id: x.id, nazv: x.nazv, svg: FSVG[x.id] }; }), b.forma, "forma") + "</div>";
      var nm = F.sten === 1 ? ["Длина стены"] : F.sten === 2 ? ["Длинная стена", "Вторая стена"] : ["Левая стена", "Средняя стена", "Правая стена"];
      if (F.sten === 3) nm = ["Средняя стена", "Левая стена", "Правая стена"];
      for (var i = 0; i < F.sten; i++) h += num("steny." + i, nm[i], b.steny[i] || 2, K.LIM.stena, i === 0 ? "По стене, где будут шкафы. Угол считается в обе стены" : "");
      h += '<div class="k-f"><span class="lb">Верхние шкафы</span>' + seg("verh", K.VERH, b.verh) + "</div>";
      h += '<div class="k-opts">' + tgRow("ostrovOn", "Остров", "Отдельный стол-тумба посередине кухни", b.ostrov > 0) + "</div>";
      if (b.ostrov > 0) h += '<div style="margin-top:18px">' + num("ostrov", "Длина острова", b.ostrov, [0.6, 4, 0.1]) + "</div>";
    } else if (b.iz === "kupe" || b.iz === "shkaf") {
      h += num("w", "Ширина", b.w, K.LIM.w) + num("h", "Высота", b.h, K.LIM.h, "Чаще всего до потолка: 2,5-2,8 м");
      if (b.iz === "kupe") h += '<div class="k-f"><span class="lb">Как стоит</span>' + seg("vstroennyj", [{ id: "false", nazv: "Отдельно", opis: "Со своими стенками и крышей" }, { id: "true", nazv: "В нишу", opis: "Стены и потолок комнаты вместо боковин - дешевле" }], String(!!b.vstroennyj)) + "</div>";
    } else if (b.iz === "garderob") {
      h += num("l", "Длина по стенам", b.l, K.LIM.l, "Сложите длину всех стен, где будут полки и штанги");
    } else {
      h += num("w", b.iz === "vannaya" ? "Ширина тумбы" : "Ширина", b.w, b.iz === "vannaya" ? K.LIM.vw : K.LIM.w);
    }
    return h + "</div></div>";
  }
  s2.bind = function () {
    bindCommon(function (k) {
      var b = item();
      if (k === "forma") { var F = K.FORMA.filter(function (x) { return x.id === b.forma; })[0]; while (b.steny.length < F.sten) b.steny.push(2); save(); draw(); }
      if (k === "ostrovOn") { b.ostrov = b.ostrovOn ? 1.8 : 0; delete b.ostrovOn; save(); draw(); }
    });
  };

  // ---------- шаг 3: материалы ----------
  function s3() {
    var b = item(), it = K.BY[b.iz], h = '<p class="k-cap">' + esc(it.nazv) + ' · шаг 3 из 5</p><h1 class="k-h">' + (b.iz === "kupe" ? "Двери" : "Фасады") + "</h1>";
    if (b.iz === "kupe") {
      h += '<p class="k-lead">Двери-купе - то, что видно в комнате. Значки ' + SYM + " показывают, дороже вариант или дешевле.</p>" + swatches("dver", K.DVER, b.dver, C.dver);
    } else if (b.iz === "garderob") {
      h += '<p class="k-lead">Гардеробная может быть открытой или за дверями.</p>' + seg("dveri", [{ id: "false", nazv: "Открытая", opis: "Полки и штанги без дверей" }, { id: "true", nazv: "С дверями", opis: "Распашные двери, всё убрано" }], String(!!b.dveri));
      if (b.dveri) h += '<div class="k-sub">Фасады дверей</div>' + swatches("fasad", K.FASAD, b.fasad, C.fasad);
    } else {
      h += '<p class="k-lead">Фасады - лицо мебели. Значки ' + SYM + " показывают, дороже вариант или дешевле. Корпус - из ЛДСП, как у большинства мастеров.</p>" + swatches("fasad", K.FASAD, b.fasad, C.fasad);
    }
    if (b.iz === "kuhnya") {
      h += '<div class="k-sub">Столешница</div>' + swatches("stol", K.STOL, b.stol, pctStol());
      h += '<div class="k-sub">Фартук над столешницей</div>' + seg("fartuk", K.FARTUK, b.fartuk);
    }
    return h;
  }
  function pctStol() { var o = {}, b0 = C.stol.ldsp || 1; Object.keys(C.stol).forEach(function (k) { o[k] = (C.stol[k] / b0 - 1) * 100; }); return o; }
  s3.bind = function () { bindCommon(function (k) { if (k === "dveri") draw(); }); };

  // ---------- шаг 4: наполнение ----------
  function s4() {
    var b = item(), it = K.BY[b.iz];
    var h = '<p class="k-cap">' + esc(it.nazv) + ' · шаг 4 из 5</p><h1 class="k-h">Фурнитура и удобства</h1><p class="k-lead">Петли, ящики и мелочи, от которых зависит, как мебель служит каждый день.</p>' +
      '<div class="k-lvl" role="group">' + K.FURN.map(function (x) { return '<button type="button" data-set="furn" data-v="' + x.id + '" aria-pressed="' + (b.furn === x.id) + '"><b>' + esc(x.nazv) + "<i>" + rub(C.furn[x.id], C.furn) + "</i></b><span>" + esc(x.opis) + "</span></button>"; }).join("") + "</div>" +
      '<div class="k-sub">Дополнительно</div><div class="k-opts">';
    if (b.iz === "kuhnya") h += cntRow("penal", "Пенал под технику", "Высокий шкаф под духовку, микроволновку или холодильник", b.penal || 0, 4);
    if (b.iz === "kupe" || b.iz === "shkaf" || b.iz === "garderob") h += cntRow("yashiki", "Выдвижные ящики", "Для белья и мелочей", b.yashiki || 0, b.iz === "garderob" ? 20 : 12);
    if (b.iz === "garderob" || b.iz === "prihozhaya") h += cntRow("zerkalo", "Зеркало", "В полный рост", b.zerkalo || 0, b.iz === "garderob" ? 4 : 3);
    if (b.iz === "vannaya") h += cntRow("penal", "Пенал", "Высокий узкий шкаф для полотенец и бытовой химии", b.penal || 0, 3) + tgRow("nad", "Шкаф над инсталляцией", "Закрывает бачок и трубы над унитазом", b.nad);
    if (b.iz === "tv") h += tgRow("reiki", "Рейки на стену", "Декоративные деревянные рейки за телевизором", b.reiki);
    h += tgRow("dop.podsvetka", "Подсветка", b.iz === "kuhnya" ? "Светодиодная лента под верхними шкафами" : "Светодиодная лента внутри или снаружи", b.dop.podsvetka);
    h += tgRow("dop.demontazh", "Демонтаж старой мебели", "Разберём и вынесем старую", b.dop.demontazh);
    return h + "</div>";
  }
  s4.bind = function () { bindCommon(); };

  // ---------- шаг 5: итог ----------
  function s5() {
    var lo = 0, hi = 0, h = "", rs = ST.items.map(function (b) { var r = K.schet(b, C); lo += r.lo; hi += r.hi; return r; });
    var wk = ST.rabota && workById(ST.rabota);
    h += '<p class="k-cap">Итог · шаг 5 из 5</p><h1 class="k-h">' + (ST.items.length ? "Примерная стоимость" : "Напишите мастеру") + "</h1>";
    h += '<div class="k-res"><div>';
    if (ST.items.length) {
      h += '<div class="k-total"><p class="k-cap" style="margin:0">' + (ST.items.length > 1 ? "Всего, предварительно" : "Предварительно") + '</p><div class="sum">' + esc(K.vilka(lo, hi, SYM)) + "</div>";
      h += ST.items.map(function (b, i) {
        var r = rs[i];
        return '<div class="k-item"><h3>' + esc(K.BY[b.iz].nazv) + "<span>" + esc(K.vilka(r.lo, r.hi, SYM)) + "</span></h3><p>" + esc(r.opis) + "</p>" +
          "<details><summary>Из чего складывается</summary><ul>" + r.lines.map(function (l) { return "<li><span>" + esc(l.nazv) + "</span><span>≈ " + esc(K.money(Math.round(l.sum / 100) * 100, SYM)) + "</span></li>"; }).join("") + "</ul></details>" +
          '<div class="acts"><button type="button" data-edit="' + i + '">Изменить</button><button type="button" data-del="' + i + '">Убрать</button></div></div>';
      }).join("");
      h += '<button type="button" class="k-btn k-add" id="kAdd">' + I.plus + "Добавить ещё мебель</button>";
      h += '<p class="pre">Это предварительный расчёт по средним ценам' + (C.primerno ? "" : " мастера") + ". Точную стоимость мастер назовёт после замера: она зависит от стен, ниш, техники и выбранной фурнитуры.</p>";
      if (C.primerno) h += '<p class="k-warn">Цены пока примерные: мастер ещё не поставил свои.</p>';
      h += '<div class="k-inc"><div><b>Входит</b><ul><li>Изготовление по вашим размерам</li>' + (C.montazh > 0 ? "<li>Доставка и сборка</li>" : "<li>Доставка и сборка - уже в цене</li>") + "<li>Замер</li></ul></div>" +
        "<div><b>Не входит</b><ul><li>Техника, мойка, смесители</li><li>Электрика и сантехника</li><li>Ремонт стен</li></ul></div></div></div>";
    } else {
      h += '<div class="k-total"><p class="pre" style="margin:0">Расскажите мастеру, что нужно сделать - он подскажет цену и сроки. Можно приложить фото и размеры прямо в переписке.</p>' +
        '<button type="button" class="k-btn k-add" id="kAdd">' + I.plus + "Посчитать мебель</button></div>";
    }
    // похожие работы
    var kom = {}; ST.items.forEach(function (b) { K.BY[b.iz].komnaty.forEach(function (k, j) { if (!j || b.iz !== "kupe") kom[k] = 1; }); });
    var ws = WORKS.filter(function (w) { return kom[w.komnata] && w.id !== ST.rabota; }).slice(0, 6);
    if (ws.length) {
      h += '<div class="k-sub">Похожие работы мастера</div><div class="k-works">' + ws.map(function (w) {
        return '<a href="' + esc(backTo(w.id)) + '"><img src="' + esc(w.foto[0].src) + '" alt="" loading="lazy" draggable="false"><span>' + esc(w.nazvanie || "") + "</span></a>";
      }).join("") + "</div>";
    }
    h += "</div><div>";
    // отправить мастеру
    h += '<div class="k-total"><p class="k-cap" style="margin:0 0 12px">Отправить мастеру</p>';
    if (wk) h += '<div class="k-like"><img src="' + esc(wk.foto[0].src) + '" alt=""><span><b>Понравилась работа</b>' + esc(wk.nazvanie || "") + '</span></div>';
    var k = ST.k;
    h += '<div class="k-form"><div class="k-in"><label for="kfI">Как к вам обращаться</label><input id="kfI" data-k="imya" autocomplete="given-name" value="' + esc(k.imya || "") + '" placeholder="Имя"></div>' +
      '<div class="k-in"><label for="kfG">Где делать</label><input id="kfG" data-k="gde" autocomplete="address-level2" value="' + esc(k.gde || "") + '" placeholder="Город, район или посёлок"></div>' +
      '<div class="k-in"><span class="lb" style="font-weight:500;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--k-muted)">Когда нужен замер</span>' +
      seg("kogda", [{ id: "skoro", nazv: "На этой неделе" }, { id: "mesyac", nazv: "В течение месяца" }, { id: "pricen", nazv: "Пока прицениваюсь" }], k.kogda) + "</div>" +
      '<div class="k-in"><label for="kfC">Комментарий</label><textarea id="kfC" data-k="kom" placeholder="Например: есть проект, нужен цвет как на фото, кухня под потолок 2,7 м">' + esc(k.kom || "") + "</textarea></div></div>";
    var wa = digits(KT.whatsapp), tg = tgName(KT.telegram), mx = maxUrl(KT.max), tel = digits(KT.telefon);
    h += '<div class="k-send">';
    if (wa) h += '<a class="k-btn wa" id="kWa" target="_blank" rel="noopener" href="#">' + I.wa + "Отправить в WhatsApp</a>";
    if (tg || mx) h += '<div class="row">' + (tg ? '<button type="button" class="k-btn" id="kTg">' + I.tg + "Telegram</button>" : "") + (mx ? '<button type="button" class="k-btn" id="kMx">' + I.mx + "Max</button>" : "") + "</div>";
    h += '<div class="row"><button type="button" class="k-btn" id="kCopy">' + I.copy + "Скопировать текст</button>" + (tel ? '<a class="k-btn" href="tel:+' + tel + '">' + I.tel + "Позвонить</a>" : "") + "</div>";
    if (!wa && !tg && !mx && !tel) h += '<p class="k-small">Контакты мастера ещё не указаны - скопируйте текст и отправьте ему любым способом.</p>';
    h += '</div><p class="k-small">' + (wa ? "Откроется WhatsApp с готовым сообщением - останется нажать «Отправить». " : "") + (tg || mx ? "В Telegram и Max текст скопируется - вставьте его в чат с мастером." : "") + "</p></div>";
    return h + "</div></div>";
  }
  s5.bind = function () {
    var m = $("kMain");
    m.onclick = function (e) {
      var t = e.target.closest("button"); if (!t) return;
      if (t.hasAttribute("data-edit")) { ST.cur = +t.getAttribute("data-edit"); save(); go(2); }
      else if (t.hasAttribute("data-del")) {
        var i = +t.getAttribute("data-del"), was = ST.items[i];
        ST.items.splice(i, 1); ST.cur = -1; save();
        if (!ST.items.length && !ST.other) { go(1); return; }
        draw(); bar(); toast("Убрано: " + K.BY[was.iz].nazv.toLowerCase());
      } else if (t.id === "kAdd") { ST.cur = -1; ST.other = false; save(); go(1); }
      else if (t.getAttribute("data-set") === "kogda") {
        ST.k.kogda = ST.k.kogda === t.getAttribute("data-v") ? "" : t.getAttribute("data-v"); save();
        [].forEach.call(m.querySelectorAll('[data-set="kogda"]'), function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-v") === ST.k.kogda); });
        link();
      } else if (t.id === "kCopy") copy(text()).then(function (ok) { toast(ok ? "Текст скопирован" : "Не получилось скопировать - выделите текст вручную"); });
      else if (t.id === "kTg") send("https://t.me/" + tgName(KT.telegram), "Telegram");
      else if (t.id === "kMx") send(maxUrl(KT.max), "Max");
    };
    [].forEach.call(m.querySelectorAll("[data-k]"), function (f) { f.oninput = function () { ST.k[f.getAttribute("data-k")] = f.value; save(); link(); }; });
    link();
  };
  function link() { var a = $("kWa"); if (a) a.href = "https://wa.me/" + digits(KT.whatsapp) + "?text=" + encodeURIComponent(text()); }
  function send(url, name) {
    var w = window.open("about:blank", "_blank"); // окно открываем сразу (по нажатию), иначе браузер его заблокирует
    copy(text()).then(function (ok) {
      toast(ok ? "Текст скопирован - вставьте его в чат " + name : "Скопируйте текст кнопкой ниже и вставьте в чат", 4200);
      if (w) w.location.href = url; else location.href = url;
    });
  }
  function backTo(id) { return "../" + (QS.ot === "proba" ? "proba/" : "klient/") + "#rabota=" + encodeURIComponent(id); }

  // текст для мастера
  function text() {
    var L = [], lo = 0, hi = 0, k = ST.k;
    L.push("Здравствуйте! Посчитал(а) на вашем сайте примерную стоимость:");
    ST.items.forEach(function (b, i) {
      var r = K.schet(b, C); lo += r.lo; hi += r.hi;
      L.push((ST.items.length > 1 ? i + 1 + ". " : "") + K.BY[b.iz].nazv + ": " + K.low(r.opis) + ". Примерно " + K.vilka(r.lo, r.hi, SYM).replace(/ /g, " ") + ".");
    });
    if (ST.items.length > 1) L.push("Всего примерно " + K.vilka(lo, hi, SYM).replace(/ /g, " ") + ".");
    if (!ST.items.length) L[0] = "Здравствуйте! Хочу узнать стоимость мебели.";
    var wk = ST.rabota && workById(ST.rabota);
    if (wk) L.push("Понравилась ваша работа: «" + wk.nazvanie + "».");
    var kg = { skoro: "на этой неделе", mesyac: "в течение месяца", pricen: "пока прицениваюсь" }[k.kogda];
    var tail = [];
    if (k.imya && k.imya.trim()) tail.push("Меня зовут " + k.imya.trim() + ".");
    if (k.gde && k.gde.trim()) tail.push("Где: " + k.gde.trim() + ".");
    if (kg) tail.push("Замер: " + kg + ".");
    if (k.kom && k.kom.trim()) tail.push(k.kom.trim());
    if (tail.length) L.push("", tail.join("\n"));
    L.push("", ST.items.length ? "Хочу точный расчёт." : "Подскажите, пожалуйста, цену и сроки.");
    return L.join("\n");
  }
  function copy(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return old(); });
    return Promise.resolve(old());
    function old() { var a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;top:0;left:0;opacity:0"; document.body.appendChild(a); a.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} a.remove(); return ok; }
  }
  function digits(s) { return String(s || "").replace(/\D/g, ""); }
  function tgName(s) { return String(s || "").trim().replace(/^@|^https?:\/\/t\.me\//, "").replace(/[^\w]/g, ""); }
  function maxUrl(s) { s = String(s || "").trim(); return /^https?:\/\//.test(s) ? s : /^(www\.)?max\.ru\//.test(s) ? "https://" + s : ""; }

  // ---------- эскиз ----------
  // Кухня - вид сверху, остальное - вид спереди с человеком 1,75 м для масштаба. Всё тонкими линиями, размеры подписаны.
  function sketch(b) {
    if (!b) return "";
    var ink = "#F1EEE8", mut = "#A6A198", warm = "#D9B98C";
    var lab = function (x, y, t, a, rot) { return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" fill="' + mut + '" font-size="11" font-family="Jost,system-ui,sans-serif" text-anchor="' + (a || "middle") + '"' + (rot ? ' transform="rotate(-90 ' + x.toFixed(1) + " " + y.toFixed(1) + ')"' : "") + ">" + esc(t) + "</text>"; };
    var W = 400, H = 300;
    if (b.iz === "kuhnya") {
      var F = K.FORMA.filter(function (x) { return x.id === b.forma; })[0] || K.FORMA[0];
      var st = b.steny.slice(0, F.sten).map(function (x) { return K.clamp(x, K.LIM.stena[0], K.LIM.stena[1]); });
      var A = st[0], B = st[1] || 0, Cc = st[2] || 0, d = 0.6, os = +b.ostrov || 0;
      var spanX = A, spanY = Math.max(B, Cc, d) + (os ? 1.6 : 0.4);
      var s = Math.min((W - 80) / spanX, (H - 70) / Math.max(spanY, 1.6)), ox = (W - spanX * s) / 2, oy = 34;
      var g = "", px = function (v) { return v * s; };
      // стены
      var wall = "M" + ox + " " + (oy + (F.sten > 1 ? px(B) : 0)) + (F.sten > 1 ? " V" + oy : "") + " H" + (ox + px(A)) + (F.sten > 2 ? " V" + (oy + px(Cc)) : "");
      if (F.sten === 1) wall = "M" + ox + " " + oy + " H" + (ox + px(A));
      g += '<path d="' + wall + '" stroke="' + ink + '" stroke-width="3" fill="none" stroke-linecap="square"/>';
      // нижние шкафы полосой глубиной 0,6
      var cab = function (x, y, w, h) { return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(1, w).toFixed(1) + '" height="' + Math.max(1, h).toFixed(1) + '" fill="rgba(217,185,140,.10)" stroke="' + warm + '" stroke-width="1"/>'; };
      g += cab(ox, oy, px(A), px(d));
      if (F.sten > 1) g += cab(ox, oy + px(d), px(d), px(B - d));
      if (F.sten > 2) g += cab(ox + px(A - d), oy + px(d), px(d), px(Cc - d));
      // деления на модули примерно по 0,6 м
      var ticks = function (x1, y1, len, horiz) { var n = Math.max(1, Math.round(len / 0.6)), t = ""; for (var i = 1; i < n; i++) { var p = len * i / n; t += horiz ? '<path d="M' + (x1 + px(p)).toFixed(1) + " " + y1 + " v" + px(d).toFixed(1) + '" stroke="' + warm + '" stroke-width=".6" opacity=".6"/>' : '<path d="M' + x1 + " " + (y1 + px(p)).toFixed(1) + " h" + px(d).toFixed(1) + '" stroke="' + warm + '" stroke-width=".6" opacity=".6"/>'; } return t; };
      g += ticks(ox, oy, A, true);
      if (F.sten > 1) g += ticks(ox, oy + px(d), B - d, false);
      if (F.sten > 2) g += ticks(ox + px(A - d), oy + px(d), Cc - d, false);
      // верхние - пунктир
      if (b.verh !== "net") g += '<path d="M' + (ox + 2) + " " + (oy + px(0.32)) + " H" + (ox + px(A) - 2) + '" stroke="' + ink + '" stroke-width="1" stroke-dasharray="4 4" opacity=".55"/>';
      // остров
      if (os) { var iw = px(Math.min(os, A - 0.4)), ix = ox + (px(A) - iw) / 2, iy = oy + px(Math.max(B, Cc, d) + 0.9); if (F.sten === 1) iy = oy + px(d + 0.9); g += cab(ix, iy, iw, px(0.9)) + lab(ix + iw / 2, iy + px(0.9) + 15, "остров " + K.fmtNum(os) + " м"); }
      // размеры
      g += lab(ox + px(A) / 2, oy - 12, K.fmtNum(A) + " м");
      if (F.sten > 1) g += lab(ox - 12, oy + px(B) / 2, K.fmtNum(B) + " м", "middle", true);
      if (F.sten > 2) g += lab(ox + px(A) + 16, oy + px(Cc) / 2, K.fmtNum(Cc) + " м", "middle", true);
      return '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet" role="img">' + g + "</svg>" + '<span class="note">Вид сверху' + (b.verh !== "net" ? " · пунктир - верхние шкафы" : "") + "</span>";
    }
    // вид спереди
    var w = 0, h = 0, kind = b.iz;
    if (kind === "kupe" || kind === "shkaf") { w = K.clamp(b.w, K.LIM.w[0], K.LIM.w[1]); h = K.clamp(b.h, K.LIM.h[0], K.LIM.h[1]); }
    else if (kind === "garderob") { w = K.clamp(b.l, K.LIM.l[0], K.LIM.l[1]); h = 2.6; }
    else if (kind === "prihozhaya") { w = K.clamp(b.w, K.LIM.w[0], K.LIM.w[1]); h = 2.4; }
    else if (kind === "tv") { w = K.clamp(b.w, K.LIM.w[0], K.LIM.w[1]); h = 2.2; }
    else { w = K.clamp(b.w, K.LIM.vw[0], K.LIM.vw[1]); h = 2.1; }
    var man = 0.55, gap = 0.35, total = w + gap + man, s2 = Math.min((W - 70) / total, (H - 60) / Math.max(h, 1.9));
    var x0 = (W - total * s2) / 2 + 14, floor = H - 30, P = function (v) { return v * s2; };
    var g2 = '<path d="M20 ' + floor + " H" + (W - 20) + '" stroke="' + mut + '" stroke-width=".8" opacity=".5"/>';
    var R = function (x, y, ww, hh, fill, sw) { return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(1, ww).toFixed(1) + '" height="' + Math.max(1, hh).toFixed(1) + '" fill="' + (fill || "none") + '" stroke="' + warm + '" stroke-width="' + (sw || 1) + '"/>'; };
    var top = floor - P(h), L2 = function (x1, y1, x2, y2, o) { return '<path d="M' + x1.toFixed(1) + " " + y1.toFixed(1) + " L" + x2.toFixed(1) + " " + y2.toFixed(1) + '" stroke="' + warm + '" stroke-width=".8" opacity="' + (o || 1) + '"/>'; };
    var mirror = function (x, y, ww, hh) { return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + ww.toFixed(1) + '" height="' + hh.toFixed(1) + '" fill="rgba(200,212,218,.14)"/>' + L2(x + ww * 0.2, y + hh * 0.35, x + ww * 0.6, y + hh * 0.15, 0.5) + L2(x + ww * 0.3, y + hh * 0.5, x + ww * 0.75, y + hh * 0.27, 0.35); };
    if (kind === "kupe") {
      var n = Math.max(2, Math.min(5, Math.round(w / 0.9))), dw = P(w) / n;
      g2 += R(x0, top, P(w), P(h), "rgba(217,185,140,.06)", 1.2);
      for (var i = 0; i < n; i++) {
        var dx = x0 + i * dw, dv = b.dver;
        if (dv === "zerkalo" || (dv === "kombi" && i % 2 === 1)) g2 += mirror(dx + 2, top + 4, dw - 4, P(h) - 8);
        else if (dv === "kombi") g2 += mirror(dx + 2, top + P(h) * 0.38, dw - 4, P(h) * 0.24);
        else if (dv === "lakobel") g2 += '<rect x="' + (dx + 2).toFixed(1) + '" y="' + (top + 4).toFixed(1) + '" width="' + (dw - 4).toFixed(1) + '" height="' + (P(h) - 8).toFixed(1) + '" fill="rgba(185,162,127,.25)"/>';
        else if (dv === "foto") g2 += mirror(dx + 2, top + 4, dw - 4, P(h) - 8) + '<circle cx="' + (dx + dw / 2).toFixed(1) + '" cy="' + (top + P(h) * 0.4).toFixed(1) + '" r="' + (dw * 0.22).toFixed(1) + '" fill="none" stroke="' + warm + '" stroke-width=".7" opacity=".6"/>';
        if (i) g2 += L2(dx, top, dx, floor);
      }
      if (!b.vstroennyj) g2 += R(x0 - 3, top - 3, P(w) + 6, P(h) + 3, "none", 1);
    } else if (kind === "shkaf") {
      var nd = Math.max(2, Math.min(10, Math.round(w / 0.45))), dw2 = P(w) / nd, ant = h > 2.45 ? P(0.45) : 0;
      g2 += R(x0, top, P(w), P(h), "rgba(217,185,140,.06)", 1.2);
      if (ant) g2 += L2(x0, top + ant, x0 + P(w), top + ant);
      for (var j = 1; j < nd; j++) g2 += L2(x0 + j * dw2, top, x0 + j * dw2, floor);
      for (var q = 0; q < nd; q += 2) { var hx = x0 + q * dw2 + dw2; g2 += L2(hx - 4, top + ant + P(1.0), hx - 4, top + ant + P(1.0) + 14) + L2(hx + 4, top + ant + P(1.0), hx + 4, top + ant + P(1.0) + 14); }
    } else if (kind === "garderob") {
      g2 += L2(x0, top, x0 + P(w), top) + L2(x0, top, x0, floor) + L2(x0 + P(w), top, x0 + P(w), floor);
      var sec = Math.max(2, Math.round(w / 0.9)), sw2 = P(w) / sec;
      for (var k2 = 0; k2 < sec; k2++) {
        var sx = x0 + k2 * sw2; if (k2) g2 += L2(sx, top, sx, floor, 0.8);
        g2 += L2(sx + 4, top + P(0.35), sx + sw2 - 4, top + P(0.35), 0.8);
        if (k2 % 2 === 0) { g2 += L2(sx + 6, top + P(0.55), sx + sw2 - 6, top + P(0.55)); for (var c = 0; c < 4; c++) { var cx = sx + 10 + c * (sw2 - 20) / 3; g2 += L2(cx, top + P(0.55), cx, top + P(0.55) + P(0.9 + (c % 2) * 0.25), 0.5); } }
        else for (var sh = 1; sh < 5; sh++) g2 += L2(sx + 4, top + P(0.35) + sh * P(0.42), sx + sw2 - 4, top + P(0.35) + sh * P(0.42), 0.7);
        if (k2 % 2 === 0) g2 += R(sx + 4, floor - P(0.5), sw2 - 8, P(0.45), "none", 0.7);
      }
      if (b.dveri) for (var dd = 0; dd < sec * 2; dd++) g2 += L2(x0 + dd * sw2 / 2, top + 2, x0 + dd * sw2 / 2, floor, 0.35);
    } else if (kind === "prihozhaya") {
      var sw3 = Math.min(P(w) * 0.55, P(1.0)), rest = P(w) - sw3;
      g2 += R(x0, top, sw3, P(h), "rgba(217,185,140,.06)", 1.2) + L2(x0 + sw3 / 2, top, x0 + sw3 / 2, floor);
      g2 += L2(x0 + sw3, top + P(0.3), x0 + P(w), top + P(0.3));
      for (var hk = 0; hk < 4; hk++) { var hx2 = x0 + sw3 + rest * (hk + 0.5) / 4; g2 += L2(hx2, top + P(0.3), hx2, top + P(0.42)); }
      g2 += R(x0 + sw3 + 4, floor - P(0.5), rest - 8, P(0.5), "rgba(217,185,140,.06)") + L2(x0 + sw3 + 4, floor - P(0.25), x0 + P(w) - 4, floor - P(0.25), 0.6);
      if (b.zerkalo) g2 += mirror(x0 + sw3 + rest * 0.25, top + P(0.6), rest * 0.5, P(1.0));
    } else if (kind === "tv") {
      g2 += R(x0, floor - P(0.5), P(w), P(0.45), "rgba(217,185,140,.06)", 1.2);
      var tw = Math.min(P(1.4), P(w) * 0.6); g2 += '<rect x="' + (x0 + (P(w) - tw) / 2).toFixed(1) + '" y="' + (floor - P(1.45)).toFixed(1) + '" width="' + tw.toFixed(1) + '" height="' + (tw * 0.56).toFixed(1) + '" fill="rgba(0,0,0,.4)" stroke="' + mut + '" stroke-width="1"/>';
      g2 += L2(x0, floor - P(1.75), x0 + (P(w) - tw) / 2 - 10, floor - P(1.75)) + L2(x0 + (P(w) + tw) / 2 + 10, floor - P(1.75), x0 + P(w), floor - P(1.75));
      if (b.reiki) for (var rk = 0; rk < 9; rk++) { var rx = x0 + (P(w) - tw) / 2 - 8 + rk * (tw + 16) / 8; g2 += L2(rx, top + 4, rx, floor - P(0.55), 0.45); }
    } else { // санузел
      var tw2 = P(w);
      g2 += R(x0, floor - P(0.85), tw2, P(0.7), "rgba(217,185,140,.06)", 1.2) + '<ellipse cx="' + (x0 + tw2 / 2).toFixed(1) + '" cy="' + (floor - P(0.85)).toFixed(1) + '" rx="' + (tw2 * 0.32).toFixed(1) + '" ry="5" fill="none" stroke="' + mut + '"/>';
      g2 += R(x0 + tw2 * 0.15, floor - P(1.75), tw2 * 0.7, P(0.65), "none", 0.8);
      var pn = Math.min(3, +b.penal || 0); for (var pp = 0; pp < pn; pp++) g2 += R(x0 + tw2 + 8 + pp * P(0.42), floor - P(1.9), P(0.38), P(1.85), "rgba(217,185,140,.06)");
    }
    // размеры и человек для масштаба
    g2 += lab(x0 + P(w) / 2, floor + 18, K.fmtNum(w) + " м" + (kind === "garderob" ? " по стенам" : ""));
    if (kind === "kupe" || kind === "shkaf") g2 += lab(x0 - 12, top + P(h) / 2, K.fmtNum(h) + " м", "middle", true);
    var mx2 = W - 30 - P(man) / 2 - (W - 70 - total * s2) / 2 + 6, mh = P(1.75), my = floor - mh;
    if (kind === "vannaya") mx2 = x0 + P(w) + P(0.42) * Math.min(3, +b.penal || 0) + P(gap) + P(man) / 2;
    else mx2 = x0 + P(w) + P(gap) + P(man) / 2;
    var hr = mh * 0.065;
    g2 += '<g stroke="' + mut + '" stroke-width="1" fill="none" opacity=".7"><circle cx="' + mx2.toFixed(1) + '" cy="' + (my + hr).toFixed(1) + '" r="' + hr.toFixed(1) + '"/><path d="M' + mx2.toFixed(1) + " " + (my + 2 * hr).toFixed(1) + " v" + (mh * 0.42).toFixed(1) + " M" + (mx2 - mh * 0.12).toFixed(1) + " " + (my + mh * 0.22).toFixed(1) + " h" + (mh * 0.24).toFixed(1) + " M" + mx2.toFixed(1) + " " + (my + 2 * hr + mh * 0.42).toFixed(1) + " l" + (-mh * 0.08).toFixed(1) + " " + (mh * 0.45).toFixed(1) + " M" + mx2.toFixed(1) + " " + (my + 2 * hr + mh * 0.42).toFixed(1) + " l" + (mh * 0.08).toFixed(1) + " " + (mh * 0.45).toFixed(1) + '"/></g>';
    return '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet" role="img">' + g2 + "</svg>" + '<span class="note top">Вид спереди · человек ростом 1,75 м для масштаба</span>';
  }

  // ---------- старт ----------
  draw();
  try { $("kMain").focus({ preventScroll: true }); } catch (e) {}
})();
