/* Оформления "Путешествия по дому" - пробные дизайны (вечер, утро, графит и латунь, живой дом).
   Грузится ПЕРЕД puteshestvie.js и логику витрины не трогает: только фон за домом, украшения дома,
   вид входа и переключатель дизайнов.

   Как устроено:
   - <html data-tema="..."> выбирает оформление (стили - tema-*.css), data-svet="light|dark" - светлый или тёмный вид.
   - #scene - фон за домом (небо, холмы, деревья, частицы на canvas). Он живёт только на экране дома:
     в комнате, в работе, при открытом разделе и в свёрнутой вкладке всё стоит и не тратит батарею.
   - Качество подстраивается под телефон: data-q 2 (всё), 1 (лёгкое), 0 (фон без движения).
     Сначала считаем по железу, потом меряем кадры: если телефон не успевает - сами опускаем уровень.
     prefers-reduced-motion и "экономия трафика" - сразу 0.
   - Переключение дизайна - на месте, без перезагрузки: круг расходится от нажатой кнопки (View Transitions API). */
(function () {
  "use strict";
  var H = document.documentElement, B = document.body;
  var $ = function (id) { return document.getElementById(id); };
  var home = $("home"), house = $("house");
  if (!home || !house) return;

  var THEMES = [
    { id: "vecher", n: 1, name: "Тёплый вечер", short: "Вечер", svet: "dark", tc: "#0D1020" },
    { id: "utro", n: 2, name: "Светлое утро", short: "Утро", svet: "light", tc: "#EAF0F0" },
    { id: "premium", n: 3, name: "Графит и латунь", short: "Премиум", svet: "dark", tc: "#0B0B0C" },
    { id: "zhivoj", n: 4, name: "Живой дом", short: "Живой", svet: "auto", tc: "#BFE3F2" }
  ];
  var BY = {}; THEMES.forEach(function (t) { BY[t.id] = t; });
  var tema = BY[window.VP_TEMA] ? window.VP_TEMA : "vecher";
  var TRY = !!window.VP_TRY; // пробная страница: показать переключатель

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function mm(q) { return window.matchMedia ? matchMedia(q) : { matches: false }; }

  // ---------- качество ----------
  var mqR = mm("(prefers-reduced-motion: reduce)");
  var FINE = mm("(hover: hover) and (pointer: fine)").matches;
  var QK = "vp-q", QA = "vp-qa";
  var mode = ls(QK) || "auto"; // auto | max | lite
  function hw() {
    var c = navigator.hardwareConcurrency || 4, m = navigator.deviceMemory || 4, cn = navigator.connection;
    if (cn && cn.saveData) return 0;
    if (m <= 2 || c <= 2) return 0;
    return 2; // остальное решит замер кадров
  }
  function calcQ() {
    if (mqR.matches) return 0;
    if (mode === "max") return 2;
    if (mode === "lite") return 1;
    var a = ss(QA);
    return a != null && a !== "" ? Math.min(hw(), +a) : hw();
  }
  var Q = calcQ();
  H.setAttribute("data-q", Q);

  // ---------- время суток и сезон (для "Живого дома") ----------
  var TODS = ["utro", "den", "vecher", "noch"], TOD_N = { utro: "Утро", den: "День", vecher: "Вечер", noch: "Ночь" };
  function todNow() { var h = new Date().getHours(); return h >= 5 && h < 10 ? "utro" : h >= 10 && h < 17 ? "den" : h >= 17 && h < 21 ? "vecher" : "noch"; }
  var todSel = ss("vp-tod") || "auto";
  function tod() { return todSel === "auto" ? todNow() : todSel; }
  var M = new Date().getMonth(), SEZON = M >= 2 && M <= 4 ? "vesna" : M >= 5 && M <= 7 ? "leto" : M >= 8 && M <= 10 ? "osen" : "zima";
  H.setAttribute("data-sezon", SEZON);

  function svetOf(id) { var t = BY[id]; return t.svet === "auto" ? (tod() === "utro" || tod() === "den" ? "light" : "dark") : t.svet; }
  function setMeta() {
    var m = document.querySelector('meta[name="theme-color"]');
    var c = tema === "zhivoj" ? { utro: "#F6D7C3", den: "#BFE3F2", vecher: "#2C2346", noch: "#0B1430" }[tod()] : BY[tema].tc;
    if (m) m.setAttribute("content", c);
  }

  // ---------- рисунки фона ----------
  function svg(vb, inner, cls, par) { return '<svg class="' + cls + '" viewBox="' + vb + '" preserveAspectRatio="' + (par || "none") + '" aria-hidden="true" focusable="false">' + inner + "</svg>"; }
  // плавная линия холмов по случайным точкам
  function hill(r, w, h, y0, amp, n) {
    var pts = [], i, x, d;
    for (i = 0; i <= n; i++) pts.push([w * i / n, y0 + (r() - .5) * 2 * amp]);
    d = "M0," + h + " L0," + pts[0][1].toFixed(1);
    for (i = 0; i < n; i++) { x = (pts[i][0] + pts[i + 1][0]) / 2; d += " Q" + pts[i][0].toFixed(1) + "," + pts[i][1].toFixed(1) + " " + x.toFixed(1) + "," + ((pts[i][1] + pts[i + 1][1]) / 2).toFixed(1); }
    return d + " L" + w + "," + pts[n][1].toFixed(1) + " L" + w + "," + h + " Z";
  }
  // ели: ярусы треугольников
  function pines(r, w, h, n, minH, maxH, skipMid) {
    var d = "", i, x, th, bw, k;
    for (i = 0; i < n; i++) {
      x = w * (i + .2 + r() * .6) / n;
      if (skipMid && x > w * .3 && x < w * .7 && r() < .8) continue;
      th = minH + r() * (maxH - minH); bw = th * (.22 + r() * .08);
      for (k = 0; k < 3; k++) {
        var top = h - th + th * k * .22, base = h - th * (.42 - k * .2), ww = bw * (.62 + k * .26);
        d += "M" + (x - ww).toFixed(1) + "," + base.toFixed(1) + " L" + x.toFixed(1) + "," + top.toFixed(1) + " L" + (x + ww).toFixed(1) + "," + base.toFixed(1) + " Z";
      }
      d += "M" + (x - 3).toFixed(1) + "," + (h - th * .05).toFixed(1) + " h6 V" + h + " h-6 Z";
    }
    return d;
  }
  function starShadow(r, n, maxY) {
    var a = [];
    for (var i = 0; i < n; i++) a.push((r() * 100).toFixed(2) + "vw " + (r() * maxY).toFixed(2) + "vh 0 " + (r() < .12 ? "1px" : "0") + " rgba(255,248,235," + (.35 + r() * .65).toFixed(2) + ")");
    return a.join(",");
  }
  function cloud(cls, w) {
    return '<svg class="' + cls + '" viewBox="0 0 220 90" aria-hidden="true" focusable="false" style="width:' + w + 'px"><path fill="currentColor" d="M30 78c-16 0-26-10-26-22s11-21 24-20c3-15 16-25 31-24 9-11 26-14 39-6 10-9 30-8 40 5 17-3 33 9 33 25 14 1 25 10 25 22s-10 20-24 20z"/></svg>';
  }
  // круглые деревья (живой дом)
  function roundTrees(r, w, h, n, minH, maxH) {
    var g = "", i, x, th, cr;
    for (i = 0; i < n; i++) {
      x = w * (i + .15 + r() * .7) / n; th = minH + r() * (maxH - minH); cr = th * (.3 + r() * .08);
      g += '<g class="tr" style="animation-delay:-' + (r() * 6).toFixed(1) + 's"><rect class="trunk" x="' + (x - 3).toFixed(1) + '" y="' + (h - th * .45).toFixed(1) + '" width="6" height="' + (th * .45).toFixed(1) + '" rx="3"/>' +
        '<circle class="crown c' + (i % 3) + '" cx="' + x.toFixed(1) + '" cy="' + (h - th * .45 - cr * .7).toFixed(1) + '" r="' + cr.toFixed(1) + '"/>' +
        '<circle class="crown hi" cx="' + (x - cr * .3).toFixed(1) + '" cy="' + (h - th * .45 - cr * 1.05).toFixed(1) + '" r="' + (cr * .45).toFixed(1) + '"/></g>';
    }
    return g;
  }
  // деревья-свечки (скандинавская иллюстрация): вытянутые кроны по краям, середина свободна под дом
  function slimTrees(r, w, h) {
    // какая часть рисунка видна на этом экране (рисунок обрезается по краям, "slice")
    var sc = Math.max(innerWidth / w, innerHeight * .46 / h), vw = Math.min(w, innerWidth / sc), l = (w - vw) / 2;
    var xs = [.03, .11, .19, .81, .89, .97].map(function (f) { return l + vw * f; }), g = "", i;
    for (i = 0; i < xs.length; i++) {
      var x = xs[i] + (r() - .5) * 30, th = 150 + r() * 170, rw = 18 + r() * 14, cy = h - th * .62;
      g += '<g class="tr" style="animation-delay:-' + (r() * 7).toFixed(1) + 's"><rect class="trunk" x="' + (x - 2.5).toFixed(1) + '" y="' + (h - th * .3).toFixed(1) + '" width="5" height="' + (th * .3).toFixed(1) + '" rx="2"/>' +
        '<ellipse class="crown c' + (i % 3) + '" cx="' + x.toFixed(1) + '" cy="' + cy.toFixed(1) + '" rx="' + rw.toFixed(1) + '" ry="' + (th * .36).toFixed(1) + '"/>' +
        '<ellipse class="crown hi" cx="' + (x - rw * .35).toFixed(1) + '" cy="' + (cy - th * .08).toFixed(1) + '" rx="' + (rw * .32).toFixed(1) + '" ry="' + (th * .2).toFixed(1) + '"/></g>';
    }
    return g;
  }
  var NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")";

  H.style.setProperty("--noise", NOISE); // зерно бумаги/плёнки - один раз отрисованный шум

  // ---------- сцены ----------
  // каждая сцена: html - слои фона; parts - какие частицы; kpar - параллакс (k - прокрутка, pk - указатель)
  function ly(cls, k, pk, inner) { return '<div class="ly ' + cls + '" style="--k:' + k + ";--pk:" + pk + '">' + (inner || "") + "</div>"; }
  var SC = {
    vecher: function () {
      var r = rnd(7);
      return {
        html: ly("sky", 0, 0) +
          ly("stars s1", .02, 3, '<i style="box-shadow:' + starShadow(r, 70, 62) + '"></i>') +
          ly("stars s2", .03, 5, '<i style="box-shadow:' + starShadow(r, 40, 55) + '"></i>') +
          ly("moon-l", .04, 8, '<i class="moon"></i>') +
          ly("far", .06, 10, svg("0 0 1440 300", '<path d="' + hill(r, 1440, 300, 150, 40, 7) + '"/><g class="town">' + (function () { var s = ""; for (var i = 0; i < 26; i++) s += '<rect x="' + (40 + r() * 1360).toFixed(0) + '" y="' + (150 + r() * 70).toFixed(0) + '" width="3" height="3" rx="1"/>'; return s; })() + "</g>", "hills")) +
          ly("near", .12, 18, svg("0 0 1440 260", '<path d="' + pines(r, 1440, 260, 22, 110, 230, true) + '"/><rect y="240" width="1440" height="20"/>', "pines", "xMidYMax slice")) +
          ly("fog", .16, 22, "<i></i><i></i>") +
          '<canvas class="pc"></canvas>' + (FINE ? '<i class="lantern"></i>' : ""),
        parts: "glow", glim: true
      };
    },
    utro: function () {
      var r = rnd(11);
      return {
        html: ly("sky", 0, 0) +
          ly("sun-l", .03, 6, '<i class="sun"></i><i class="rays"></i>') +
          ly("clouds c1", .05, 10, cloud("cl a", 240) + cloud("cl b", 160)) +
          ly("clouds c2", .08, 16, cloud("cl c", 300) + cloud("cl d", 190)) +
          ly("far", .07, 10, svg("0 0 1440 300", '<path class="h1" d="' + hill(r, 1440, 300, 160, 34, 5) + '"/><path class="h2" d="' + hill(r, 1440, 300, 215, 26, 6) + '"/>', "hills")) +
          ly("birches", .13, 18, svg("0 0 1440 360", slimTrees(r, 1440, 360), "bir", "xMidYMax slice")) +
          '<canvas class="pc"></canvas><i class="grain"></i>',
        parts: "dust"
      };
    },
    premium: function () {
      return {
        html: ly("base", 0, 0) +
          ly("aur", .02, 14, '<i class="b1"></i><i class="b2"></i><i class="b3"></i>') +
          ly("grid", .05, 6, '<i class="sweep"></i>') +
          '<canvas class="pc"></canvas><i class="grain"></i>' + (FINE ? '<i class="spot"></i>' : ""),
        parts: "brass"
      };
    },
    zhivoj: function () {
      var r = rnd(5);
      return {
        html: ly("sky", 0, 0) +
          ly("stars s1", .02, 3, '<i style="box-shadow:' + starShadow(r, 60, 55) + '"></i>') +
          ly("orb-l", .03, 8, '<i class="orb"><b class="sun"></b><b class="moon"></b></i>') +
          ly("clouds c1", .05, 10, cloud("cl a", 200) + cloud("cl b", 140)) +
          ly("birds", .06, 12, '<i class="bd b1"></i><i class="bd b2"></i><i class="bd b3"></i>') +
          ly("far", .06, 10, svg("0 0 1440 320", '<path class="m1" d="' + hill(r, 1440, 320, 120, 60, 4) + '"/><path class="m2" d="' + hill(r, 1440, 320, 190, 40, 6) + '"/>', "hills")) +
          ly("mid", .1, 16, svg("0 0 1440 300", '<path class="g1" d="' + hill(r, 1440, 300, 220, 22, 5) + '"/>' + roundTrees(r, 1440, 250, 16, 70, 150), "trees", "xMidYMax slice")) +
          ly("clouds c2", .09, 18, cloud("cl c", 260)) +
          '<canvas class="pc"></canvas>',
        parts: "zhivoj", glim: true
      };
    }
  };

  // ---------- частицы на canvas ----------
  function Parts(cv, kind) {
    var ctx = cv.getContext("2d"), dpr = 1, W = 0, Hh = 0, list = [], spr = {};
    function sprite(col) {
      if (spr[col]) return spr[col];
      var c = document.createElement("canvas"), x = c.getContext("2d"); c.width = c.height = 64;
      var g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "rgba(" + col + ",1)"); g.addColorStop(.25, "rgba(" + col + ",.55)"); g.addColorStop(1, "rgba(" + col + ",0)");
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      return (spr[col] = c);
    }
    var phone = innerWidth < 700, n = Q >= 2 ? (phone ? 16 : 34) : (phone ? 7 : 12);
    var K = kind;
    if (K === "zhivoj") K = tod() === "noch" || tod() === "vecher" ? (SEZON === "zima" ? "snow" : "glow") : ({ osen: "leaf", zima: "snow", vesna: "petal", leto: "dust" })[SEZON];
    if (K === "leaf" || K === "petal") n = Math.round(n * .6);
    if (K === "dust") n = Math.round(n * .7);
    var LEAF = ["#E0892F", "#C9562C", "#E9B23C", "#B5452A", "#D9A441"], PET = ["#F7C9D4", "#F2AFC0", "#FFE1E8"];
    function size() {
      dpr = Q >= 2 ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      W = innerWidth; Hh = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(p, first) {
      var R = Math.random;
      p.x = R() * W; p.ph = R() * 6.28; p.a = 0;
      if (K === "glow") { p.y = first ? R() * Hh : Hh + 20; p.r = 5 + R() * 12; p.vy = -(6 + R() * 14); p.vx = 0; p.al = .35 + R() * .55; p.f = .6 + R() * 1.6; p.c = R() < .8 ? "255,196,110" : "255,236,180"; }
      else if (K === "brass") { p.y = first ? R() * Hh : -20; p.r = 4 + R() * (R() < .15 ? 26 : 9); p.vy = 4 + R() * 9; p.vx = (R() - .5) * 6; p.al = p.r > 14 ? .08 + R() * .1 : .25 + R() * .45; p.f = .4 + R() * .8; p.c = "222,186,120"; }
      else if (K === "dust") { p.y = first ? R() * Hh : Hh + 10; p.r = 3 + R() * 6; p.vy = -(2 + R() * 5); p.vx = (R() - .3) * 6; p.al = .25 + R() * .4; p.f = .3 + R() * .6; p.c = H.getAttribute("data-svet") === "light" ? "255,214,140" : "255,230,170"; }
      else if (K === "snow") { p.y = first ? R() * Hh : -10; p.r = 1.5 + R() * 2.5; p.vy = 18 + R() * 26; p.vx = 0; p.al = .6 + R() * .4; p.f = .5 + R(); }
      else { p.y = first ? R() * Hh : -20; p.r = 5 + R() * 5; p.vy = 22 + R() * 26; p.vx = 0; p.al = .9; p.f = .6 + R() * .8; p.rot = R() * 6.28; p.vr = (R() - .5) * 2.4; p.c = K === "leaf" ? LEAF[(R() * LEAF.length) | 0] : PET[(R() * PET.length) | 0]; }
      return p;
    }
    size();
    for (var i = 0; i < n; i++) list.push(spawn({}, true));
    function step(dt, t) {
      var s = dt / 1000;
      ctx.clearRect(0, 0, W, Hh);
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        p.a = Math.min(1, p.a + s * .8); // мягкое появление
        if (K === "glow" || K === "dust" || K === "brass") {
          p.y += p.vy * s; p.x += (p.vx + Math.sin(t / 1000 * p.f + p.ph) * 8) * s;
          var fl = K === "glow" ? .55 + .45 * Math.sin(t / 1000 * p.f * 2.2 + p.ph) : 1;
          ctx.globalAlpha = p.al * fl * p.a;
          ctx.drawImage(sprite(p.c), p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
          if (p.y < -40 || p.y > Hh + 40 || p.x < -40 || p.x > W + 40) spawn(p);
        } else if (K === "snow") {
          p.y += p.vy * s; p.x += Math.sin(t / 1000 * p.f + p.ph) * 14 * s;
          ctx.globalAlpha = p.al * p.a; ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
          if (p.y > Hh + 10) spawn(p);
        } else {
          p.y += p.vy * s; p.x += Math.sin(t / 1000 * p.f + p.ph) * 30 * s; p.rot += p.vr * s;
          ctx.globalAlpha = p.a * p.al; ctx.fillStyle = p.c;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.max(.25, Math.abs(Math.cos(t / 1000 * p.f + p.ph))));
          ctx.beginPath(); ctx.moveTo(-p.r, 0); ctx.quadraticCurveTo(0, -p.r * .75, p.r, 0); ctx.quadraticCurveTo(0, p.r * .75, -p.r, 0); ctx.fill();
          ctx.restore();
          if (p.y > Hh + 20) spawn(p);
        }
      }
      ctx.globalAlpha = 1;
    }
    return { step: step, size: size, clear: function () { ctx.clearRect(0, 0, W, Hh); } };
  }

  // ---------- сцена: сборка, жизнь, пауза ----------
  var scene = el("div"); scene.id = "scene"; scene.setAttribute("aria-hidden", "true");
  B.insertBefore(scene, home);
  var S = null, P = null;
  function build() {
    var def = SC[tema]();
    scene.className = "sc-" + tema + (active ? " on" : "") + (paused ? " paused" : "");
    scene.innerHTML = def.html;
    S = def; P = null;
    var cv = scene.querySelector("canvas.pc");
    if (cv && Q > 0) P = Parts(cv, def.parts);
    else if (cv) cv.remove();
    kick();
  }

  // активна, только пока виден дом; пауза - при открытом разделе, видео, свёрнутой вкладке
  var active = false, paused = false, hidden = document.hidden;
  function sync() {
    var a = home.classList.contains("on"), p = B.classList.contains("pn-open") || !!document.querySelector(".vplayer.on");
    if (a !== active || p !== paused) {
      active = a; paused = p;
      scene.classList.toggle("on", active);
      scene.classList.toggle("paused", paused || hidden);
      if (active && !paused) gov.reset();
      kick();
    }
  }
  if (window.MutationObserver) {
    var mo = new MutationObserver(sync);
    mo.observe(home, { attributes: true, attributeFilter: ["class"] });
    mo.observe(B, { attributes: true, attributeFilter: ["class"] });
    var vp = $("vplayer"); if (vp) mo.observe(vp, { attributes: true, attributeFilter: ["class"] });
  }
  document.addEventListener("visibilitychange", function () { hidden = document.hidden; scene.classList.toggle("paused", paused || hidden); if (!hidden) gov.reset(); kick(); });

  // параллакс: прокрутка дома и указатель мыши (только на сильном уровне)
  var sy = 0, syD = -1, px = 0, py = 0, tx = 0, ty = 0;
  home.addEventListener("scroll", function () { sy = home.scrollTop; if (Q >= 2) kick(); }, { passive: true });
  if (FINE) addEventListener("pointermove", function (e) {
    tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1;
    if (Q >= 2 && active) {
      kick();
      var l = scene.querySelector(".lantern,.spot");
      if (l) l.style.transform = "translate3d(" + (e.clientX - 300) + "px," + (e.clientY - 300) + "px,0)";
    }
  }, { passive: true });

  // замер кадров: телефон не успевает - опускаем уровень (только в режиме "Авто")
  var gov = {
    t0: 0, n: 0, sum: 0, slow: 0,
    reset: function () { this.t0 = 0; this.n = 0; this.sum = 0; this.slow = 0; },
    add: function (t, dt) {
      if (mode !== "auto" || Q === 0) return;
      if (!this.t0) { this.t0 = t; return; }
      if (t - this.t0 < 1200 || dt < 4) return; // первые мгновения - загрузка фото и вход, их не считаем
      // на максимуме ждём ~60 кадров в секунду; на лёгком уровне 30 - это нормально (так же ведёт себя режим экономии батареи)
      var lim = Q >= 2 ? 34 : 50;
      this.n++; this.sum += dt; if (dt > lim) this.slow++;
      if (t - this.t0 > 3600 && this.n > 20) {
        var avg = this.sum / this.n, bad = avg > (Q >= 2 ? 26 : 40) || this.slow / this.n > .25;
        this.reset();
        if (bad) { setQ(Q - 1, true); }
        else this.t0 = Infinity; // всё хорошо - больше не меряем
      }
    }
  };
  function setQ(q, auto) {
    q = Math.max(0, Math.min(2, q));
    if (auto) ss(QA, String(q));
    if (q === Q) return;
    Q = q; H.setAttribute("data-q", Q);
    if (Q < 2) { scene.style.removeProperty("--sy"); scene.style.removeProperty("--px"); scene.style.removeProperty("--py"); }
    build(); deco(); bar();
  }

  var raf = 0, last = 0, acc = 0, glimT = 0;
  function want() { return active && !paused && !hidden && Q > 0 && S; }
  function kick() { if (!raf && want()) { last = 0; raf = requestAnimationFrame(loop); } }
  function loop(t) {
    raf = 0;
    if (!want()) return;
    var dt = last ? Math.min(60, t - last) : 16; last = t;
    gov.add(t, dt);
    var more = false;
    if (Q >= 2) {
      if (sy !== syD) { syD = sy; scene.style.setProperty("--sy", Math.min(sy, 1600).toFixed(1)); }
      if (FINE) {
        px += (tx - px) * Math.min(1, dt / 220); py += (ty - py) * Math.min(1, dt / 220);
        scene.style.setProperty("--px", px.toFixed(4)); scene.style.setProperty("--py", py.toFixed(4));
      }
    }
    if (P) {
      // на лёгком уровне частицы рисуем 30 раз в секунду
      acc += dt;
      if (Q >= 2 || acc >= 30) { P.step(acc, t); acc = 0; }
      more = true;
    }
    // окна сами зажигаются то тут, то там (вечер, ночь)
    if (S.glim && Q >= 2 && (tema === "vecher" || (tema === "zhivoj" && (tod() === "noch" || tod() === "vecher")))) {
      glimT -= dt;
      if (glimT <= 0) { glimT = 2600 + Math.random() * 2600; glim(); }
      more = true;
    }
    if ((more || Q >= 2) && !raf) raf = requestAnimationFrame(loop); // raf уже мог запустить build() при смене уровня
  }
  function glim() {
    var rs = house.querySelectorAll(".room:not(.empty):not(.lit):not(.glim)");
    if (!rs.length) return;
    var e = rs[(Math.random() * rs.length) | 0];
    e.classList.add("glim");
    setTimeout(function () { e.classList.remove("glim"); }, 2400);
  }
  addEventListener("resize", function () { if (P) P.size(); outline(); }, { passive: true });

  // ---------- украшения дома и входа ----------
  // Всё лишнее (дым из трубы, земля, контур-чертёж) - отдельные элементы без нажатия, у каждого оформления свои.
  var OUT = null;
  function deco() {
    [].forEach.call(document.querySelectorAll(".dz-deco"), function (e) { e.remove(); });
    OUT = null;
    var d = $("doors"), roof = $("roof");
    var add = function (parent, cls, html, first) { var e = el("div", "dz-deco " + cls, html || ""); e.setAttribute("aria-hidden", "true"); if (first) parent.insertBefore(e, first === true ? parent.firstChild : first); else parent.appendChild(e); return e; };
    var dui = d.querySelector(".door-ui");
    if (tema === "vecher") {
      add(house, "spill", "", true);
      add(house, "chim", "<i></i><b></b><b></b><b></b>");
      add(house, "ground", "");
      add(dui, "porch", "<i></i><b></b>", true);
    } else if (tema === "utro") {
      add(house, "ground", '<i class="bush b1"></i><i class="bush b2"></i><i class="bush b3"></i><i class="pot"></i>');
      OUT = add(house, "outline", "");
      add(dui, "sketch", svg("0 0 200 160", '<path pathLength="1" d="M20 70 L100 14 L180 70"/><path pathLength="1" d="M34 64 V146 H166 V64"/><path pathLength="1" d="M48 82 H92 V112 H48 Z M108 82 H152 V112 H108 Z"/><path pathLength="1" d="M86 146 V122 H114 V146"/><path pathLength="1" d="M10 146 H190"/>', "sk", "xMidYMid meet"), true);
    } else if (tema === "premium") {
      OUT = add(house, "outline", "");
      add(house, "floor", "", true);
      add(house, "ticks", "<i></i><i></i><i></i><i></i>");
      add(d, "seam", "<i></i>", dui);
    } else if (tema === "zhivoj") {
      add(house, "chim", "<i></i><b></b><b></b><b></b>");
      add(house, "ground", '<i class="fence"></i><i class="path"></i><i class="fl f1"></i><i class="fl f2"></i><i class="fl f3"></i><i class="fl f4"></i><i class="mail"></i>');
      add(d, "sky", cloud("dc a", 360) + cloud("dc b", 300) + '<i class="dsun"></i>', true);
      todChip();
    }
    if (tema !== "zhivoj") { var c = $("dzTod"); if (c) c.remove(); }
    outline();
    roofNudge();
  }
  // контур дома "чертёжом": крыша, стены, комнаты - рисуются линией при входе
  function outline() {
    if (!OUT) return;
    var roof = $("roof"), fl = $("floors"); if (!roof || !fl) return;
    var W = house.clientWidth, Hh = house.clientHeight; if (!W || !Hh) return;
    var rh = roof.offsetHeight, rl = roof.offsetLeft, rw = roof.offsetWidth, ft = fl.offsetTop;
    var p = '<path pathLength="1" style="--i:0" d="M' + rl + "," + rh + " L" + (rl + rw / 2) + ",1 L" + (rl + rw) + "," + rh + '"/>' +
      '<path pathLength="1" style="--i:1" d="M1,' + ft + " V" + (Hh - 1) + " H" + (W - 1) + " V" + ft + ' Z"/>';
    [].forEach.call(fl.querySelectorAll(".room"), function (e, i) {
      var inF = e.offsetParent === fl, x = e.offsetLeft + (inF ? fl.offsetLeft : 0), y = e.offsetTop + (inF ? ft : 0), w = e.offsetWidth, h = e.offsetHeight;
      p += '<path pathLength="1" style="--i:' + (i + 2) + '" d="M' + x + "," + y + " h" + w + " v" + h + " h-" + w + ' Z"/>';
    });
    OUT.innerHTML = svg("0 0 " + W + " " + Hh, p, "ol", "none");
  }
  if (window.ResizeObserver) new ResizeObserver(function () { outline(); }).observe(house);
  // надпись на крыше подбирается по ширине (fitRoof в puteshestvie.js следит за размером крыши):
  // после смены шрифта чуть "шевелим" крышу, чтобы надпись подобралась заново
  function roofNudge() {
    var r = $("roof"); if (!r) return;
    r.style.paddingTop = "1px";
    requestAnimationFrame(function () { requestAnimationFrame(function () { r.style.paddingTop = ""; }); });
  }

  // кнопка времени суток (живой дом)
  function todChip() {
    var h = document.querySelector(".hero-t"); if (!h) return;
    var c = $("dzTod");
    if (!c) {
      c = el("button", "dz-tod"); c.type = "button"; c.id = "dzTod";
      h.insertBefore(c, h.firstChild);
      c.onclick = function (e) {
        var i = TODS.indexOf(tod()), nx = TODS[(i + 1) % 4];
        todSel = nx === todNow() ? "auto" : nx; ss("vp-tod", todSel);
        var r = c.getBoundingClientRect();
        swap(function () { applyTod(); }, r.left + r.width / 2, r.top + r.height / 2, "tod");
      };
    }
    c.innerHTML = '<i class="ti"></i><span>' + TOD_N[tod()] + "</span><small>" + (todSel === "auto" ? "как сейчас" : "сменить") + "</small>";
    c.setAttribute("aria-label", "Время суток: " + TOD_N[tod()] + ". Нажмите, чтобы сменить");
  }
  function applyTod() {
    H.setAttribute("data-tod", tod());
    H.setAttribute("data-svet", svetOf(tema));
    setMeta();
    if (tema === "zhivoj") { var cv = scene.querySelector("canvas.pc"); if (cv && Q > 0) P = Parts(cv, "zhivoj"); todChip(); }
  }

  // смена с View Transition: новый вид раскрывается кругом от нажатой кнопки
  function swap(fn, x, y, kind) {
    if (!document.startViewTransition || Q === 0 || mqR.matches) { fn(); return; }
    var r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    H.style.setProperty("--vx", x + "px"); H.style.setProperty("--vy", y + "px"); H.style.setProperty("--vr", r + "px");
    H.classList.add("dz-vt"); if (kind) H.classList.add("dz-vt-" + kind);
    try {
      var vt = document.startViewTransition(fn);
      vt.finished.then(done, done);
    } catch (e) { fn(); done(); }
    function done() { H.classList.remove("dz-vt", "dz-vt-tod"); }
  }

  // ---------- применить оформление ----------
  function apply(id) {
    tema = id;
    H.setAttribute("data-tema", tema);
    H.setAttribute("data-tod", tod());
    H.setAttribute("data-svet", svetOf(tema));
    setMeta();
    build(); deco(); bar();
  }
  function setTema(id, x, y) {
    if (!BY[id] || id === tema) return;
    swap(function () {
      apply(id);
      // адрес страницы - этого варианта, чтобы после обновления открылся он же
      var p = location.pathname.replace(/\/v[1-4]\/(index\.html)?$/, "/v" + BY[id].n + "/");
      if (p !== location.pathname) try { history.replaceState(history.state, "", p + location.search + location.hash); } catch (e) {}
      // вход в дом проигрывается заново - в новом оформлении
      home.classList.remove("enter"); void home.offsetWidth; home.classList.add("enter");
    }, x, y);
    if (document.fonts && document.fonts.load) document.fonts.load('800 20px Nunito').then(roofNudge, function () {});
  }

  // ---------- переключатель (только на пробных страницах) ----------
  var BAR = null;
  function bar() {
    if (!TRY) return;
    var t = BY[tema], qn = ["без движения фона", "лёгкая", "максимум"][Q];
    if (!BAR) {
      BAR = el("div", "dzbar"); BAR.id = "dzbar";
      var top = $("htop"); home.insertBefore(BAR, top);
      BAR.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        if (b.hasAttribute("data-t")) { var r = b.getBoundingClientRect(); setTema(b.getAttribute("data-t"), r.left + r.width / 2, r.top + r.height / 2); }
        else if (b.id === "dzMore") { var m = $("dzMenu"), o = m.hidden; m.hidden = !o; b.setAttribute("aria-expanded", o ? "true" : "false"); }
        else if (b.hasAttribute("data-q")) { mode = b.getAttribute("data-q"); ls(QK, mode === "auto" ? null : mode); if (mode === "auto") ss(QA, null); setQ(calcQ()); bar(); }
        else if (b.id === "dzIntro") { ls("vp-byl", null); location.reload(); }
      });
      document.addEventListener("click", function (e) { var m = $("dzMenu"); if (m && !m.hidden && !e.target.closest("#dzbar")) { m.hidden = true; $("dzMore").setAttribute("aria-expanded", "false"); } });
    }
    var open = $("dzMenu") && !$("dzMenu").hidden;
    // Варианты открываются по одному (просьба Александра, 2026-11-23): посмотрел - "← Варианты дизайна" -
    // открыл другой. Листать варианты внутри варианта больше нельзя, остались только настройки анимации.
    BAR.innerHTML =
      '<nav class="dz-nav"></nav>' +
      '<div class="dz-t"><b>Пробный дизайн ' + t.n + '</b><span>' + t.name + " - главную витрину не меняет</span></div>" +
      '<button type="button" class="dz-more" id="dzMore" aria-haspopup="true" aria-expanded="' + (open ? "true" : "false") + '" aria-label="Настройки анимации"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>' +
      '<div class="dz-menu" id="dzMenu"' + (open ? "" : " hidden") + ">" +
      '<div class="dz-mh">Анимация фона</div><div class="dz-q">' +
      [["auto", "Авто"], ["max", "Максимум"], ["lite", "Лёгкая"]].map(function (a) { return '<button type="button" data-q="' + a[0] + '"' + (mode === a[0] ? ' class="on"' : "") + ">" + a[1] + "</button>"; }).join("") +
      '</div><p class="dz-qn">Сейчас: ' + qn + (mode === "auto" ? " (подобрано под это устройство)" : "") + (mqR.matches ? ". В настройках телефона включено «уменьшить движение»" : "") + "</p>" +
      '<button type="button" class="dz-mi" id="dzIntro">Показать вход в дом ещё раз</button></div>';
    if (window.MebelSite && MebelSite.nav) MebelSite.nav(BAR.querySelector(".dz-nav"));
  }

  // ---------- заголовок по словам (для появления слово за словом) ----------
  (function () {
    var h1 = home.querySelector("h1"); if (!h1 || h1.querySelector(".w")) return;
    var words = h1.textContent.trim().split(/\s+/);
    h1.setAttribute("aria-label", h1.textContent.trim());
    h1.innerHTML = words.map(function (w, i) { return '<span class="w" aria-hidden="true" style="--w:' + i + '">' + w.replace(/[&<>]/g, "") + "</span>"; }).join(" ");
  })();

  // ---------- 3D-наклон комнат и "магнитные" кнопки (компьютер, сильный уровень, графит и латунь) ----------
  if (FINE) {
    house.addEventListener("pointermove", function (e) {
      if (tema !== "premium" || Q < 2) return;
      var rm = e.target.closest(".room"); if (!rm) return;
      var r = rm.getBoundingClientRect();
      rm.style.setProperty("--rx", ((e.clientY - r.top) / r.height - .5).toFixed(3));
      rm.style.setProperty("--ry", ((e.clientX - r.left) / r.width - .5).toFixed(3));
    });
    house.addEventListener("pointerout", function (e) { var rm = e.target.closest(".room"); if (rm && !rm.contains(e.relatedTarget)) { rm.style.removeProperty("--rx"); rm.style.removeProperty("--ry"); } });
    home.addEventListener("pointermove", function (e) {
      if (tema !== "premium" || Q < 2) return;
      var b = e.target.closest(".btn"); if (!b) return;
      var r = b.getBoundingClientRect();
      b.style.translate = ((e.clientX - r.left - r.width / 2) * .18).toFixed(1) + "px " + ((e.clientY - r.top - r.height / 2) * .3).toFixed(1) + "px";
    });
    home.addEventListener("pointerout", function (e) { var b = e.target.closest(".btn"); if (b && !b.contains(e.relatedTarget)) b.style.translate = ""; });
  }

  if (mqR.addEventListener) mqR.addEventListener("change", function () { setQ(calcQ()); });

  apply(tema);
  sync();
  window.VpDizajn = { THEMES: THEMES, set: setTema, q: function () { return Q; }, tema: function () { return tema; } };
})();
