/* Витрина мастера: рисует страницу из window.VITRINA (dannye.js).
   Ссылки, которые можно слать клиенту:
     .../vitrina/                    - вся витрина
     .../vitrina/#rabota=<id>        - сразу открыть одну работу
     .../vitrina/#story=<id>         - сразу показать работу как сторис
     .../vitrina/#otzyv=<код>        - форма отзыва с кодом заказа (выдаётся после сдачи)
   Черновик из Мастерской: ?chernovik=1 - берёт данные и фото из памяти этого браузера. */
(function () {
  "use strict";
  var D = window.VITRINA || {};
  var $ = function (id) { return document.getElementById(id); };
  var Q = new URLSearchParams(location.search);
  var DRAFT = Q.get("chernovik") === "1";
  var STAFF = Q.has("master") || DRAFT || (window.MebelSite && MebelSite.isStaff && MebelSite.isStaff());
  var PH = {}; // фото черновика: id -> адрес

  // ---------- мелочи ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function toast(t) { var el = $("toast"); el.textContent = t; el.className = "on"; clearTimeout(toast.t); toast.t = setTimeout(function () { el.className = ""; }, 2600); }
  var MON = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  var MON2 = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  function month(s) { var m = /^(\d{4})-(\d{2})/.exec(s || ""); return m ? MON[+m[2] - 1] + " " + m[1] : (s || ""); }
  function day(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? +m[3] + " " + MON2[+m[2] - 1] + " " + m[1] : month(s); }
  function initials(n) { var w = String(n || "?").trim().split(/\s+/), l = w.filter(function (x) { return x.length > 1; }); return (l.length ? l : w).slice(0, 2).map(function (x) { return x.charAt(0).toUpperCase(); }).join(""); }
  function money(n) {
    n = Math.round(+n || 0);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " " + (D.valyuta || "₸");
  }
  function plural(n, f) { n = Math.abs(n) % 100; var d = n % 10; return n > 10 && n < 20 ? f[2] : d === 1 ? f[0] : d >= 2 && d <= 4 ? f[1] : f[2]; }
  var IC = {
    wa: '<svg class="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>',
    tg: '<svg class="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3 18.8 19c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-1 .5l.3-4.7 8.6-7.8c.4-.3-.1-.5-.6-.2L7 13l-4.6-1.4c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3z"/></svg>',
    vk: '<svg class="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.8 17.5C6.6 17.5 3.1 13.3 3 6.2h3.1c.1 5.2 2.4 7.4 4.2 7.9V6.2h2.9v4.5c1.8-.2 3.7-2.2 4.3-4.5h2.9a8.6 8.6 0 0 1-3.9 5.6 8.9 8.9 0 0 1 4.6 5.7h-3.2c-.7-2.2-2.4-3.9-4.7-4.1v4.1z"/></svg>',
    ig: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    tel: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
    calc: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8"/></svg>',
    mic: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    link: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>'
  };

  // ---------- контакты ----------
  var K = D.kontakty || {};
  var digits = function (s) { return String(s || "").replace(/\D/g, ""); };
  function waUrl(text) { var n = digits(K.whatsapp); return n ? "https://wa.me/" + n + (text ? "?text=" + encodeURIComponent(text) : "") : ""; }
  function tgUrl() { var u = String(K.telegram || "").replace(/^@|^https?:\/\/t\.me\//, ""); return u ? "https://t.me/" + u : ""; }
  function webUrl(s) { s = String(s || "").trim(); return s ? (/^https?:\/\//.test(s) ? s : "https://" + s) : ""; }
  function hello(about) { return "Здравствуйте! Пишу с вашего сайта." + (about ? " " + about : ""); }

  // ---------- фото и водяной знак ----------
  function srcOf(f) {
    if (!f) return window.VitrinaRis ? VitrinaRis("detal") : "";
    if (f.src && /^idb:/.test(f.src)) return PH[f.src.slice(4)] || (window.VitrinaRis ? VitrinaRis(f.ris || "detal") : "");
    if (f.src) return f.src;
    return window.VitrinaRis ? VitrinaRis(f.ris || "detal") : "";
  }
  // Повторяющаяся надпись поверх фото: попадает и на снимок экрана. Сам файл тоже лучше подписывать
  // в Мастерской - тогда знак есть и в картинке, которую скачали по прямой ссылке.
  var WM = "";
  function makeWM() {
    var t = esc((D.master && D.master.znak) || (D.master && D.master.imya) || "");
    if (!t) return "";
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260"><g transform="rotate(-24 210 130)" font-family="system-ui,sans-serif" font-size="19" font-weight="600" text-anchor="middle">' +
      '<text x="210" y="138" fill="rgba(0,0,0,.18)">' + t + '</text><text x="209" y="137" fill="rgba(255,255,255,.34)">' + t + "</text></g></svg>";
    return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22") + '")';
  }
  function photo(f, alt, eager) {
    return '<div class="ph"><img src="' + esc(srcOf(f)) + '" alt="' + esc(alt || (f && f.podpis) || "") + '"' + (eager ? "" : ' loading="lazy"') + ' draggable="false">' +
      (WM && !(f && f.znak) ? '<i class="wm" style="background-image:' + WM.replace(/"/g, "&quot;") + '"></i>' : "") + "</div>";
  }
  document.addEventListener("contextmenu", function (e) { if (e.target.closest && e.target.closest(".ph")) { e.preventDefault(); toast("Фото защищены - напишите мастеру, если нужно"); } });

  // ---------- работы ----------
  var R = D.raboty || [];
  function work(id) { for (var i = 0; i < R.length; i++) if (R[i].id === id) return i; return -1; }
  function metaOf(w) { return [w.gde, month(w.kogda)].filter(Boolean).join(" · "); }

  // быстрый расчёт есть, только если мастер указал цены изделий
  function hasCalc() { return !!((D.raschet && D.raschet.izdeliya) || []).length; }
  function renderHero() {
    var m = D.master || {};
    document.title = (m.imya ? m.imya + " - " : "") + (m.rol || "мебель на заказ") + (m.gorod ? ", " + m.gorod : "");
    $("mName").textContent = m.imya || "";
    $("mRol").textContent = [m.rol, m.gorod].filter(Boolean).join(", ");
    $("ava").innerHTML = m.foto ? '<img src="' + esc(srcOf({ src: m.foto })) + '" alt="">' : esc(initials(m.imya));
    var f = [];
    if (m.opyt) f.push("<b>" + esc(m.opyt) + "</b> делаю мебель");
    if (m.rabot) f.push("<b>" + esc(m.rabot) + "</b> работ");
    var rv = D.otzyvy || [];
    if (rv.length) { var avg = rv.reduce(function (s, r) { return s + (+r.ocenka || 5); }, 0) / rv.length; f.push("<b>" + avg.toFixed(1).replace(".", ",") + " ★</b> " + rv.length + " " + plural(rv.length, ["отзыв", "отзыва", "отзывов"])); }
    $("facts").innerHTML = f.map(function (x) { return "<li>" + x + "</li>"; }).join("");
    $("mPitch").textContent = m.o_sebe || "";
    if (R[0]) $("cover").style.backgroundImage = 'url("' + srcOf(R[0].foto && R[0].foto[0]).replace(/"/g, "%22") + '")';
    var c = [];
    if (waUrl()) c.push('<a class="btn wa" target="_blank" rel="noopener" href="' + esc(waUrl(hello())) + '">' + IC.wa + "WhatsApp</a>");
    if (tgUrl()) c.push('<a class="btn tg" target="_blank" rel="noopener" href="' + esc(tgUrl()) + '">' + IC.tg + "Telegram</a>");
    if (hasCalc()) c.push('<a class="btn gh" href="#raschet">' + IC.calc + "Посчитать стоимость</a>");
    $("cta").innerHTML = c.join("");
    // сторис
    var seen = {}; try { seen = JSON.parse(localStorage.getItem("vt-seen") || "{}"); } catch (e) {}
    $("stories").innerHTML = R.map(function (w, i) {
      return '<button type="button" class="st' + (seen[w.id] ? " seen" : "") + '" data-story="' + i + '"><span class="ring"><span style="background-image:url(&quot;' + esc(srcOf(w.foto && w.foto[0])).replace(/"/g, "%22") + '&quot;)"></span></span><small>' + esc(w.nazvanie) + "</small></button>";
    }).join("");
  }

  var VID = "";
  function renderWorks() {
    var vids = [];
    R.forEach(function (w) { if (w.vid && vids.indexOf(w.vid) < 0) vids.push(w.vid); });
    $("vids").innerHTML = vids.length > 1 ? ['<button type="button" class="chip' + (VID ? "" : " on") + '" data-vid="">Все</button>'].concat(vids.map(function (v) {
      return '<button type="button" class="chip' + (VID === v ? " on" : "") + '" data-vid="' + esc(v) + '">' + esc(v) + "</button>";
    })).join("") : "";
    $("grid").innerHTML = R.map(function (w, i) {
      if (VID && w.vid !== VID) return "";
      var n = (w.foto || []).length;
      return '<button type="button" class="card w" data-work="' + i + '">' + photo(w.foto && w.foto[0], w.nazvanie).replace('</div>', (n > 1 ? '<span class="cnt">' + n + " фото</span>" : "") + "</div>") +
        '<span class="tx"><span class="vid">' + esc(w.vid || "") + "</span><b>" + esc(w.nazvanie) + '</b><span class="meta">' + esc(metaOf(w)) + "</span><p>" + esc(w.rasskaz || "") + "</p></span></button>";
    }).join("") || '<p class="muted">Работы скоро появятся.</p>';
  }

  // ---------- окно одной работы ----------
  var CUR = { wi: -1, fi: 0 };
  function openWork(i, fi) {
    var w = R[i]; if (!w) return;
    CUR = { wi: i, fi: fi || 0 };
    var rv = (D.otzyvy || []).filter(function (r) { return r.rabota === w.id; });
    var p = [];
    if (w.material) p.push("<div><small>Материалы</small>" + esc(w.material) + "</div>");
    if (w.srok) p.push("<div><small>Срок</small>" + esc(w.srok) + "</div>");
    if (w.cena) p.push("<div><small>Стоимость</small>" + esc(w.cena) + "</div>");
    $("workIn").innerHTML = '<div class="gal" id="gal"></div><div class="dots" id="dots"></div><div class="wbody">' +
      "<h3>" + esc(w.nazvanie) + '</h3><div class="meta">' + esc([w.vid, metaOf(w)].filter(Boolean).join(" · ")) + "</div>" +
      (w.rasskaz ? '<p class="story">' + esc(w.rasskaz) + "</p>" : "") +
      (p.length ? '<div class="params">' + p.join("") + "</div>" : "") +
      ((w.resheniya || []).length ? "<h4>Почему так</h4><ul>" + w.resheniya.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
      (rv.length ? "<h4>Отзыв клиента</h4>" + rv.map(function (r) { return '<p style="margin:0 0 8px"><span class="stars">' + stars(r.ocenka) + "</span> <b>" + esc(r.imya) + "</b>" + (r.zakaz ? ' <span class="tag ok">по заказу ' + esc(r.zakaz) + "</span>" : "") + "<br>" + esc(r.tekst) + "</p>"; }).join("") : "") +
      '<div class="cta">' + (waUrl() ? '<a class="btn wa" target="_blank" rel="noopener" href="' + esc(waUrl(hello("Понравилась работа \"" + w.nazvanie + "\". Хочу похожее, подскажите по цене и срокам."))) + '">' + IC.wa + "Хочу похожее</a>" : "") +
      '<button type="button" class="btn" data-share="' + esc(w.id) + '">' + IC.link + "Ссылка на эту работу</button></div></div>";
    gal();
    $("work").hidden = false; document.body.style.overflow = "hidden";
    if (location.hash !== "#rabota=" + w.id) history.replaceState(null, "", "#rabota=" + w.id);
  }
  function gal() {
    var w = R[CUR.wi], f = w.foto || [], i = CUR.fi, x = f[i] || {};
    $("gal").innerHTML = photo(x, w.nazvanie, true) + (x.podpis ? '<div class="cap">' + esc(x.podpis) + "</div>" : "") +
      (f.length > 1 ? '<button type="button" class="nav2 pv" data-g="-1" aria-label="Предыдущее фото">&#8249;</button><button type="button" class="nav2 nx" data-g="1" aria-label="Следующее фото">&#8250;</button>' : "");
    $("dots").innerHTML = f.length > 1 ? f.map(function (_, k) { return "<i" + (k === i ? ' class="on"' : "") + "></i>"; }).join("") : "";
  }
  function galStep(d) { var n = (R[CUR.wi].foto || []).length; if (n < 2) return; CUR.fi = (CUR.fi + d + n) % n; gal(); }
  function closeWork() { $("work").hidden = true; document.body.style.overflow = ""; CUR.wi = -1; if (/^#rabota=/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search); }
  swipe($("work"), function (d) { if (CUR.wi >= 0 && document.activeElement.tagName !== "INPUT") galStep(d); }, null, ".gal");

  // ---------- сторис ----------
  var S = null, raf = 0;
  function slides(w) {
    var f = (w.foto && w.foto.length) ? w.foto : [{}];
    return f.map(function (x, i) { return { f: x, cap: i === 0 && w.rasskaz ? w.rasskaz : (x.podpis || "") }; });
  }
  function openStory(wi) {
    if (!R[wi]) return;
    S = { wi: wi, si: 0, t: 0, last: 0, paused: false, list: slides(R[wi]) };
    $("story").hidden = false; document.body.style.overflow = "hidden";
    try { var seen = JSON.parse(localStorage.getItem("vt-seen") || "{}"); seen[R[wi].id] = 1; localStorage.setItem("vt-seen", JSON.stringify(seen)); } catch (e) {}
    var b = document.querySelector('.st[data-story="' + wi + '"]'); if (b) b.classList.add("seen");
    var m = D.master || {}, w = R[wi];
    $("sAva").innerHTML = m.foto ? '<img src="' + esc(srcOf({ src: m.foto })) + '" alt="">' : esc(initials(m.imya));
    $("sName").textContent = w.nazvanie; $("sMeta").textContent = metaOf(w);
    $("sWant").href = waUrl(hello("Посмотрел(а) работу \"" + w.nazvanie + "\". Хочу похожее.")) || tgUrl() || "#kontakty";
    $("sBars").innerHTML = S.list.map(function () { return "<i><b></b></i>"; }).join("");
    show();
    cancelAnimationFrame(raf); S.last = performance.now(); raf = requestAnimationFrame(tick);
  }
  function dur() { var c = S.list[S.si].cap || ""; return Math.min(13000, 4000 + c.length * 45); }
  function show() {
    var s = S.list[S.si];
    $("sPh").innerHTML = photo(s.f, R[S.wi].nazvanie, true);
    $("sCap").textContent = s.cap;
    S.t = 0;
    [].forEach.call($("sBars").children, function (b, k) { b.firstChild.style.width = k < S.si ? "100%" : "0"; });
  }
  function tick(now) {
    if (!S) return;
    if (!S.paused) S.t += now - S.last;
    S.last = now;
    var p = Math.min(1, S.t / dur()), bar = $("sBars").children[S.si];
    if (bar) bar.firstChild.style.width = (p * 100) + "%";
    if (p >= 1) step(1);
    raf = requestAnimationFrame(tick);
  }
  function step(d) {
    if (!S) return;
    var n = S.si + d;
    if (n < 0) { if (S.wi > 0) openStory(S.wi - 1); else { S.t = 0; } return; }
    if (n >= S.list.length) { if (S.wi < R.length - 1) openStory(S.wi + 1); else closeStory(); return; }
    S.si = n; show();
  }
  function closeStory() { S = null; cancelAnimationFrame(raf); $("story").hidden = true; document.body.style.overflow = ""; if (/^#story=/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search); }
  (function () {
    var st = $("story"), hold = 0, held = false;
    // нажал и держит - пауза; короткое нажатие - листаем
    st.addEventListener("pointerdown", function (e) { if (!S || !e.target.closest(".tap")) return; held = false; hold = setTimeout(function () { held = true; if (S) S.paused = true; }, 220); });
    var up = function () { clearTimeout(hold); if (S) S.paused = false; };
    st.addEventListener("pointerup", up); st.addEventListener("pointercancel", up); st.addEventListener("pointerleave", up);
    $("sPrev").addEventListener("click", function () { if (!held) step(-1); });
    $("sNext").addEventListener("click", function () { if (!held) step(1); });
    $("sPrevW").addEventListener("click", function () { if (S && S.wi > 0) openStory(S.wi - 1); });
    $("sNextW").addEventListener("click", function () { if (S) { if (S.wi < R.length - 1) openStory(S.wi + 1); else closeStory(); } });
    $("sX").addEventListener("click", closeStory);
    $("sMore").addEventListener("click", function () { var i = S.wi, k = S.si; closeStory(); openWork(i, k); });
    swipe(st, function (d) { if (S) { if (d > 0 && S.wi < R.length - 1) openStory(S.wi + 1); else if (d < 0 && S.wi > 0) openStory(S.wi - 1); } }, closeStory);
  })();
  // свайп: влево/вправо - onX(+1/-1), вниз - onDown
  function swipe(el, onX, onDown, within) {
    var x0 = null, y0 = 0;
    el.addEventListener("touchstart", function (e) { if (within && !e.target.closest(within)) { x0 = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener("touchend", function (e) {
      if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) onX(dx < 0 ? 1 : -1);
      else if (onDown && dy > 90 && dy > Math.abs(dx) * 1.3) onDown();
    }, { passive: true });
  }

  // ---------- чем отличаюсь ----------
  function renderWhy() {
    var o = D.otlichiya || [];
    $("otlichiya").classList.toggle("hide", !o.length);
    $("why").innerHTML = o.map(function (x, i) { return '<div class="card"><b><span>' + (i + 1) + "</span>" + esc(x.zag) + "</b><p>" + esc(x.tekst) + "</p></div>"; }).join("");
  }

  // ---------- быстрый расчёт ----------
  var C = D.raschet || {}, CS = { iz: 0, size: 0, lv: 1, dop: {} };
  function renderCalc() {
    var iz = C.izdeliya || [];
    if (!iz.length) {
      // цен мастера ещё нет: прячем блок и пункт "Расчёт" в меню
      $("raschet").classList.add("hide");
      document.querySelectorAll('a[href="#raschet"]:not(.btn)').forEach(function (a) { a.classList.add("hide"); });
      return;
    }
    $("cIzd").innerHTML = iz.map(function (x, i) { return '<button type="button" class="chip' + (i === CS.iz ? " on" : "") + '" data-iz="' + i + '">' + esc(x.nazv) + "</button>"; }).join("");
    $("cLv").innerHTML = (C.urovni || []).map(function (x, i) { return '<button type="button" data-lv="' + i + '"' + (i === CS.lv ? ' class="on"' : "") + "><b>" + esc(x.nazv) + "</b><span>" + esc(x.opis || "") + "</span></button>"; }).join("");
    $("cDop").innerHTML = (C.dop || []).map(function (x, i) { return '<label><input type="checkbox" data-dop="' + i + '"' + (CS.dop[i] ? " checked" : "") + ">" + esc(x.nazv) + "</label>"; }).join("");
    var it = iz[CS.iz], r = $("cSize");
    r.min = it.min; r.max = it.max; r.step = it.shag || 0.1;
    if (!CS.size || CS.size < it.min || CS.size > it.max) CS.size = it.def || it.min;
    r.value = CS.size;
    $("cNote").textContent = C.zamecanie || "";
    calc();
  }
  function num(n) { return (Math.round(n * 10) / 10).toString().replace(".", ","); }
  function calc() {
    var it = (C.izdeliya || [])[CS.iz]; if (!it) return;
    var base = (it.cena || [])[CS.lv] || 0, k = 1, dops = [];
    (C.dop || []).forEach(function (x, i) { if (CS.dop[i]) { k += +x.plus || 0; dops.push(x.nazv.toLowerCase()); } });
    var sum = base * CS.size * k, rz = C.razbros == null ? 0.15 : +C.razbros;
    var rnd = function (v) { var q = v >= 1e6 ? 50000 : v >= 2e5 ? 10000 : 1000; return Math.round(v / q) * q; };
    var lo = rnd(sum * (1 - rz)), hi = rnd(sum * (1 + rz));
    var sz = it.ed === "шт" ? CS.size + " шт" : num(CS.size) + " " + it.ed;
    $("cSizeV").textContent = sz;
    $("cSum").textContent = lo === hi ? money(lo) : money(lo).replace(/\s\S+$/, "") + " - " + money(hi);
    var lv = (C.urovni || [])[CS.lv] || {};
    var what = it.nazv + ", " + sz + ", " + (lv.nazv || "").toLowerCase() + (dops.length ? ", " + dops.join(", ") : "");
    $("cWhat").textContent = what;
    var msg = hello("Посчитал(а) на сайте: " + what + ". Вышло примерно " + $("cSum").textContent + ". Хочу точный расчёт.");
    var u = waUrl(msg);
    $("cSend").href = u || tgUrl() || "#kontakty";
    $("cSend").className = "btn " + (u ? "wa" : "tg");
    $("cSend").textContent = u ? "Отправить мастеру на точный расчёт" : "Написать мастеру";
    $("c3d").classList.add("hide");
  }
  $("cSize").addEventListener("input", function () { CS.size = +this.value; calc(); });

  // ---------- отзывы ----------
  function stars(n) { n = Math.max(1, Math.min(5, Math.round(+n || 5))); return "★★★★★".slice(0, n) + '<span style="color:#ddd0bf">' + "★★★★★".slice(n) + "</span>"; }
  function renderReviews() {
    var rv = D.otzyvy || [];
    $("revs").innerHTML = rv.map(function (r) {
      var wi = work(r.rabota), o = [];
      if (r.kod && r.zakaz) o.push('<span class="tag ok" title="Отзыв пришёл по ссылке с кодом этого заказа">✓ по заказу ' + esc(r.zakaz) + "</span>");
      else if (r.zakaz) o.push("<span>заказ " + esc(r.zakaz) + "</span>");
      if (wi >= 0) o.push('<a href="#rabota=' + esc(r.rabota) + '" data-work="' + wi + '">Фото этой работы</a>');
      if (r.stranica) o.push('<a href="' + esc(webUrl(r.stranica)) + '" target="_blank" rel="noopener nofollow">Страница клиента</a>');
      return '<div class="card rv"><div class="top"><span class="av">' + esc(initials(r.imya)) + "</span><span><b>" + esc(r.imya) + '</b><span class="stars">' + stars(r.ocenka) + '</span></span></div><p>' + esc(r.tekst) + '</p><div class="ord"><span>' + esc(day(r.data)) + "</span>" + o.join("") + "</div></div>";
    }).join("") || '<p class="muted">Отзывов пока нет - будьте первым.</p>';
    var pl = D.ploshchadki || [];
    $("plosh").innerHTML = pl.map(function (p) { return '<a class="chip" target="_blank" rel="noopener" href="' + esc(webUrl(p.url)) + '">Отзывы на ' + esc(p.nazv) + " ↗</a>"; }).join("");
    $("trustPl").classList.toggle("hide", !pl.length);
  }

  // Код заказа: сравниваем отпечаток (SHA-256) с отпечатками из dannye.js - сам код в файле не хранится.
  function normKod(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9А-ЯЁ]/g, ""); }
  function hashKod(s) {
    var n = normKod(s);
    if (!n || !window.crypto || !crypto.subtle) return Promise.resolve("");
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode("vitrina:" + n)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("").slice(0, 16);
    });
  }
  var FK = null, RATE = 5;
  function checkKod() {
    var v = $("fKod").value;
    if (!normKod(v)) { FK = null; $("fKodSt").className = "kodst"; $("fKodSt").textContent = "Без кода отзыв тоже можно отправить - я сверю его по своим заказам."; msg(); return; }
    hashKod(v).then(function (h) {
      if (normKod($("fKod").value) !== normKod(v)) return;
      FK = null;
      (D.kody || []).forEach(function (k) { if (k.h === h) FK = k; });
      var st = $("fKodSt");
      if (FK) {
        st.className = "kodst ok"; st.textContent = "✓ Заказ найден: " + [FK.zakaz, FK.chto, month(FK.kogda)].filter(Boolean).join(", ");
        if (!$("fWhat").value && FK.chto) $("fWhat").value = FK.chto;
      } else if (!h) { st.className = "kodst"; st.textContent = "Этот браузер не может проверить код - отправьте как есть, я сверю сам."; }
      else { st.className = "kodst"; st.textContent = "Код не нашёлся. Проверьте буквы и цифры - или отправьте без кода."; }
      msg();
    });
  }
  function msg() {
    var t = "Отзыв для сайта\n" +
      (FK ? "Заказ: " + FK.zakaz + " (код подтверждён: " + normKod($("fKod").value) + ")\n" : normKod($("fKod").value) ? "Код: " + $("fKod").value.trim() + " (не подтвердился)\n" : "") +
      "Имя: " + ($("fName").value.trim() || "-") + "\n" +
      "Что делали: " + ($("fWhat").value.trim() || "-") + "\n" +
      "Оценка: " + RATE + " из 5\n" +
      ($("fLink").value.trim() ? "Моя страница: " + $("fLink").value.trim() + "\n" : "") +
      "Публиковать с именем: " + ($("fOk").checked ? "да" : "нет, без имени") + "\n\n" + ($("fText").value.trim() || "");
    var u = waUrl(t);
    $("fWa").classList.toggle("hide", !u);
    if (u) $("fWa").href = u;
    $("fCopy").textContent = u ? "Скопировать для Telegram" : "Скопировать и открыть Telegram";
    return t;
  }
  function renderForm() {
    $("fRate").innerHTML = [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-rate="' + n + '" aria-label="' + n + " из 5" + '"' + (n <= RATE ? ' class="on"' : "") + ">★</button>"; }).join("");
    $("fMic").innerHTML = IC.mic;
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) $("fMic").classList.add("hide");
    ["fName", "fWhat", "fText", "fLink"].forEach(function (id) { $(id).addEventListener("input", msg); });
    $("fOk").addEventListener("change", msg);
    var t = 0; $("fKod").addEventListener("input", function () { clearTimeout(t); t = setTimeout(checkKod, 250); });
    $("fCopy").addEventListener("click", function () {
      if (!$("fText").value.trim()) { toast("Напишите пару слов в отзыве"); $("fText").focus(); return; }
      var text = msg(), go = function () { toast("Отзыв скопирован - вставьте его в чат"); var u = tgUrl(); if (u) window.open(u, "_blank", "noopener"); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(go, function () { prompt("Скопируйте отзыв:", text); });
      else prompt("Скопируйте отзыв:", text);
    });
    $("fWa").addEventListener("click", function (e) { if (!$("fText").value.trim()) { e.preventDefault(); toast("Напишите пару слов в отзыве"); $("fText").focus(); } });
    $("fMic").addEventListener("click", function () { dictate(this, $("fText")); });
    msg();
  }
  // диктовка в поле: фразы дописываются в конец
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, DICT = null;
  function dictate(btn, field) {
    if (DICT) { DICT.want = false; try { DICT.rec.stop(); } catch (e) {} if (DICT.btn === btn) { DICT = null; return; } }
    var st = { btn: btn, want: true }; DICT = st; btn.classList.add("on");
    var spawn = function () {
      var r = new SR(); st.rec = r; r.lang = "ru-RU"; r.interimResults = false; r.continuous = !/android/i.test(navigator.userAgent);
      r.onresult = function (ev) {
        for (var i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) {
          var t = ev.results[i][0].transcript.trim(); if (!t) continue;
          var v = field.value.replace(/\s+$/, "");
          t = (!v || /[.!?]$/.test(v)) ? t.charAt(0).toUpperCase() + t.slice(1) : t;
          field.value = v + (v ? " " : "") + t + (/[.!?]$/.test(t) ? "" : ".");
          field.dispatchEvent(new Event("input"));
        }
      };
      r.onerror = function (e) { if (/not-allowed|service-not-allowed|audio-capture|network/.test(e.error)) { st.want = false; toast(e.error === "network" ? "Для голоса нужен интернет" : "Нет доступа к микрофону - можно написать текстом"); } };
      r.onend = function () { if (st.want && DICT === st) { try { spawn(); } catch (e) { off(); } } else off(); };
      try { r.start(); } catch (e) { off(); }
    };
    var off = function () { btn.classList.remove("on"); if (DICT === st) DICT = null; };
    spawn();
  }

  // ---------- контакты ----------
  function renderContacts() {
    var b = [];
    if (waUrl()) b.push('<a class="btn wa" target="_blank" rel="noopener" href="' + esc(waUrl(hello())) + '">' + IC.wa + "WhatsApp</a>");
    if (tgUrl()) b.push('<a class="btn tg" target="_blank" rel="noopener" href="' + esc(tgUrl()) + '">' + IC.tg + "Telegram</a>");
    if (K.vk) b.push('<a class="btn vk" target="_blank" rel="noopener" href="' + esc(webUrl(K.vk)) + '">' + IC.vk + "ВКонтакте</a>");
    if (K.instagram) b.push('<a class="btn" target="_blank" rel="noopener" href="' + esc(webUrl(K.instagram)) + '">' + IC.ig + "Instagram</a>");
    if (K.telefon) b.push('<a class="btn" href="tel:' + esc(String(K.telefon).replace(/[^\d+]/g, "")) + '">' + IC.tel + esc(K.telefon) + "</a>");
    $("cBtns").innerHTML = b.join("");
    var l = [];
    if ((D.master || {}).gorod) l.push(["Город", esc(D.master.gorod)]);
    if (K.chasy) l.push(["Когда", esc(K.chasy)]);
    if (K.adres) l.push(["Где", esc(K.adres) + (K.karta ? ' <a href="' + esc(webUrl(K.karta)) + '" target="_blank" rel="noopener">на карте</a>' : "")]);
    l.push(["Замер", "Приеду, сниму размеры, обсудим материалы и решения"]);
    $("cList").innerHTML = l.map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + x[1] + "</dd>"; }).join("");
    var d = [];
    if (waUrl()) d.push('<a class="btn wa" target="_blank" rel="noopener" href="' + esc(waUrl(hello())) + '">' + IC.wa + "WhatsApp</a>");
    if (tgUrl()) d.push('<a class="btn tg" target="_blank" rel="noopener" href="' + esc(tgUrl()) + '">' + IC.tg + "Telegram</a>");
    if (hasCalc()) d.push('<a class="btn" href="#raschet">' + IC.calc + "Цена</a>");
    $("dock").innerHTML = d.join("");
    $("fUpd").textContent = ((D.master || {}).chelovek ? "Мастер - " + D.master.chelovek + ". " : "") + (D.obnovleno ? "Сайт обновлён " + day(D.obnovleno) + "." : "");
  }

  // ---------- полоска мастера ----------
  function renderStaff() {
    if (!STAFF) return;
    $("staff").classList.remove("hide");
    $("staffNote").innerHTML = DRAFT ? "<b>Черновик</b> из Мастерской - так увидит клиент после публикации." :
      D.shablon ? "<b>Вариант 3, Витрина мастера.</b> Сейчас это шаблон: фото нарисованы, тексты - пример. Клиент эту полоску не видит." :
      "<b>Витрина мастера.</b> Клиент эту полоску не видит.";
  }

  // ---------- нажатия ----------
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-work],[data-story],[data-vid],[data-g],[data-close],[data-share],[data-iz],[data-lv],[data-rate],[data-dop]") : null;
    if (!t) { if (e.target === $("work")) closeWork(); return; }
    if (t.hasAttribute("data-dop")) { CS.dop[+t.getAttribute("data-dop")] = t.checked; calc(); return; }
    if (t.hasAttribute("data-work")) { e.preventDefault(); openWork(+t.getAttribute("data-work")); }
    else if (t.hasAttribute("data-story")) openStory(+t.getAttribute("data-story"));
    else if (t.hasAttribute("data-vid")) { VID = t.getAttribute("data-vid"); renderWorks(); }
    else if (t.hasAttribute("data-g")) galStep(+t.getAttribute("data-g"));
    else if (t.hasAttribute("data-close")) closeWork();
    else if (t.hasAttribute("data-share")) {
      var u = location.origin + location.pathname + "#rabota=" + t.getAttribute("data-share");
      var ok = function () { toast("Ссылка скопирована - можно отправить в чат"); };
      if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) navigator.share({ title: R[CUR.wi].nazvanie, url: u }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(u).then(ok, function () { prompt("Ссылка на работу:", u); });
      else prompt("Ссылка на работу:", u);
    }
    else if (t.hasAttribute("data-iz")) { CS.iz = +t.getAttribute("data-iz"); CS.size = 0; renderCalc(); }
    else if (t.hasAttribute("data-lv")) { CS.lv = +t.getAttribute("data-lv"); renderCalc(); }
    else if (t.hasAttribute("data-rate")) { RATE = +t.getAttribute("data-rate"); renderForm.stars(); msg(); }
  });
  renderForm.stars = function () { [].forEach.call($("fRate").children, function (b, i) { b.classList.toggle("on", i < RATE); }); };
  document.addEventListener("keydown", function (e) {
    if (S) { if (e.key === "Escape") closeStory(); else if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1); else if (e.key === " ") { S.paused = !S.paused; e.preventDefault(); } return; }
    if (CUR.wi >= 0) { if (e.key === "Escape") closeWork(); else if (e.key === "ArrowRight") galStep(1); else if (e.key === "ArrowLeft") galStep(-1); }
  });

  // ---------- ссылки с решёткой ----------
  function route() {
    var h = decodeURIComponent(location.hash || ""), m;
    if ((m = /^#rabota=(.+)$/.exec(h)) && work(m[1]) >= 0) { if (CUR.wi !== work(m[1])) openWork(work(m[1])); }
    else if ((m = /^#story=(.+)$/.exec(h)) && work(m[1]) >= 0) openStory(work(m[1]));
    else if ((m = /^#otzyv=(.*)$/.exec(h))) {
      if (m[1]) { $("fKod").value = m[1]; checkKod(); }
      setTimeout(function () { $("revForm").scrollIntoView({ behavior: "smooth", block: "start" }); $("fName").focus({ preventScroll: true }); }, 60);
    } else if (CUR.wi >= 0 && !/^#rabota=/.test(h)) closeWork();
  }
  window.addEventListener("hashchange", route);

  // ---------- черновик из Мастерской ----------
  function loadDraft() {
    if (!DRAFT) return Promise.resolve();
    try { var d = JSON.parse(localStorage.getItem("vt-draft") || "null"); if (d) { D = d; K = D.kontakty || {}; R = D.raboty || []; C = D.raschet || {}; } } catch (e) {}
    return new Promise(function (ok) {
      if (!window.indexedDB) return ok();
      var rq = indexedDB.open("vt-photos", 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore("p"); };
      rq.onerror = function () { ok(); };
      rq.onsuccess = function () {
        try {
          var st = rq.result.transaction("p").objectStore("p"), c = st.openCursor();
          c.onsuccess = function () { var cur = c.result; if (!cur) return ok(); PH[cur.key] = URL.createObjectURL(cur.value); cur.continue(); };
          c.onerror = function () { ok(); };
        } catch (e) { ok(); }
      };
    });
  }

  // кнопка назад в "Путешествие по дому": закрытая витрина - всегда (дом рядом, ../dom/),
  // открытая - если в этой вкладке заходили в путешествие (puteshestvie.js запоминает свой адрес)
  function renderToDom() {
    var href = "";
    if (window.MEBEL_TOOL === "kr-vitrina") href = "../dom/";
    else { try { href = sessionStorage.getItem("vp-dom") || ""; } catch (e) {} if (!/\/vitrina\/puteshestvie\//.test(href)) href = ""; } // из закрытой витрины в открытую не ведём
    if (!href) return;
    var a = $("toDom"); a.href = href; a.hidden = false;
  }
  function start() {
    renderToDom(); renderStaff(); renderHero(); renderWorks(); renderWhy(); renderCalc(); renderReviews(); renderContacts();
    if (location.hash) route();
  }
  // данные черновика читаем до отрисовки (WM и K берутся из D)
  loadDraft().then(function () { WM = makeWM(); start(); msg(); });
  renderForm();
})();
