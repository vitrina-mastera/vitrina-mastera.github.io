/* Дом на фото (пробная главная Краснодара, krasnodar/glavnaya/, 2026-11-27, по голосовым мастера).
   Под шапкой - длинное фото дома (по ширине экрана, по высоте 2-3 экрана). Ведёшь пальцем вниз - фото едет,
   комнаты проявляются одна за другой; остановил палец - всё стоит; ведёшь быстрее - проявляются быстрее.
   Проявление - не анимация по времени, а прямое следствие прокрутки: у каждой комнаты степень проявления p (0..1)
   считается из её места на экране. Там, где браузер умеет анимации по прокрутке (animation-timeline: view()),
   их считает сам браузер на видеокарте - движение идёт ровно с пальцем; в остальных браузерах p считает этот файл
   на каждом кадре прокрутки. Проверка запасного пути: ?fdjs=1.
   Комнаты и вход в них - из puteshestvie.js (window.VP_HOUSE), порядок - D.poryadok или window.VP_PORYADOK.
   Фото дома: dizajn2/dom-foto/ (сгенерировано нейросетью Z-Image, Apache 2.0; небо и газон продлены, увеличено).
   Стили - foto-dom.css (html[data-fd]). Подключается после d2.js и puteshestvie.js. */
(function () {
  "use strict";
  var H = document.documentElement, $ = function (id) { return document.getElementById(id); };
  var home = $("home"), house = $("house");
  if (!home || !house || !window.VP_HOUSE) return;
  H.setAttribute("data-fd", "");
  var BASE = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/[^/]*$/, "") : "../../vitrina/dizajn2/"; })();
  var FOTO = { w: 1170, h: 6204 }; // пропорции фото дома (все размеры одинаковой формы)
  var Q = new URLSearchParams(location.search);
  var CSSV = !Q.has("fdjs") && window.CSS && CSS.supports && CSS.supports("animation-timeline: view()") && CSS.supports("animation-range: entry 0% cover 50%");
  if (CSSV) H.setAttribute("data-fdv", "");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) H.setAttribute("data-fdr", "");

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  // ---------- сцена: фото дома + слой комнат ----------
  var sec = el("section", "fd", null); sec.id = "fdom"; sec.setAttribute("aria-label", "Комнаты дома");
  sec.innerHTML =
    '<div class="fd-side" aria-hidden="true"></div>' +
    '<div class="fd-col">' +
      '<img class="fd-img" alt="" draggable="false" decoding="async" fetchpriority="high" width="' + FOTO.w + '" height="' + FOTO.h + '"' +
      ' src="' + BASE + 'dom-foto/dom-780.jpg" srcset="' + BASE + 'dom-foto/dom-780.jpg 780w, ' + BASE + 'dom-foto/dom-1170.jpg 1170w" sizes="(min-width: 700px) 600px, 100vw">' +
      '<i class="fd-veil" aria-hidden="true"></i>' +
      '<div class="fd-rooms" id="fdRooms"></div>' +
      '<p class="fd-hint" aria-hidden="true"><i></i><span>Ведите вниз</span></p>' +
    "</div>";
  sec.querySelector(".fd-side").style.backgroundImage = 'url("' + BASE + 'dom-foto/dom-mini.jpg")';
  house.parentNode.insertBefore(sec, house.nextSibling);
  var col = sec.querySelector(".fd-col"), box = $("fdRooms"), img = sec.querySelector(".fd-img");

  // ---------- комнаты ----------
  var CARDS = [], BY = {};
  function plur(n, f) { n = Math.abs(n) % 100; var d = n % 10; return n > 10 && n < 20 ? f[2] : d === 1 ? f[0] : d >= 2 && d <= 4 ? f[1] : f[2]; }
  function render() {
    var rs = window.VP_HOUSE.rooms().filter(function (k) { return k.n > 0; });
    var sig = JSON.stringify(rs);
    if (sig === render.sig) return; render.sig = sig;
    box.innerHTML = ""; CARDS = []; BY = {};
    rs.forEach(function (k, i) {
      var b = el("button", "fd-card " + (i % 2 ? "r" : "l"));
      b.type = "button"; b.setAttribute("data-k", k.id);
      b.setAttribute("aria-label", k.nazvanie + ", " + k.n + " " + plur(k.n, ["работа", "работы", "работ"]));
      b.innerHTML = '<span class="fd-in"><span class="fd-ph"><img src="' + esc(k.cover) + '" alt="" draggable="false" decoding="async"' + (i > 1 ? ' loading="lazy"' : "") + '><i class="fd-dk"></i></span>' +
        '<span class="fd-t"><b>' + esc(k.nazvanie) + '</b><i class="fd-ln"></i><small>' + k.n + " " + plur(k.n, ["работа", "работы", "работ"]) + "</small></span></span>";
      b.onclick = function () { window.VP_HOUSE.open(k.id); };
      box.appendChild(b); CARDS.push(b); BY[k.id] = b;
    });
    place(); tick();
  }
  // места комнат на фото: сверху вниз, по очереди слева и справа; первая - в небе над крышей, последняя - на газоне.
  // Доли - от высоты фото, так что на любом экране комната стоит на том же месте дома.
  function place() {
    var n = CARDS.length; if (!n) return;
    var top = 0.11, bot = 0.82; // откуда и докуда (доля высоты фото) - верх первой и верх последней карточки
    CARDS.forEach(function (c, i) {
      var y = n === 1 ? top : top + (bot - top) * i / (n - 1);
      c.style.top = (y * 100).toFixed(3) + "%";
    });
  }
  // свой элемент вместо плитки дома: от карточки комната "вырастает" на весь экран и в неё же "сжимается" обратно
  window.VP_TILE = function (id) { var c = BY[id]; return c ? c.querySelector(".fd-ph") : null; };

  // ---------- проявление по прокрутке (запасной путь без animation-timeline) ----------
  // p: 0 - карточка только показалась снизу, 1 - её верх дошёл до середины экрана. Ничего не идёт само по времени.
  var raf = 0, VH = innerHeight;
  function prog(c) {
    var r = c.getBoundingClientRect();
    return Math.max(0, Math.min(1, (VH - r.top) / (VH * 0.65)));
  }
  function tick() {
    raf = 0;
    if (CSSV || reduce) return;
    for (var i = 0; i < CARDS.length; i++) {
      var c = CARDS[i], p = prog(c), q = Math.round(p * 1000) / 1000;
      if (c._p !== q) { c._p = q; c.style.setProperty("--p", q); }
    }
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }
  home.addEventListener("scroll", kick, { passive: true });
  addEventListener("resize", function () { VH = innerHeight; kick(); });

  // подсказка "ведите вниз" - пока человек не начал вести; гаснет от прокрутки (тоже без таймера)
  var hint = sec.querySelector(".fd-hint");
  home.addEventListener("scroll", function () { if (home.scrollTop > 40) hint.classList.add("off"); }, { passive: true });

  // где начинается фото: верх фото - примерно на 36% высоты экрана, чтобы под надписями сразу было видно небо над домом,
  // а первая комната уже начала проявляться. Считаем только при смене ширины: на телефоне при прокрутке меняется
  // высота окна (адресная строка), и пересчёт по высоте двигал бы фото прямо под пальцем.
  var padW = 0;
  function pad() {
    padW = innerWidth;
    var t = sec.parentNode; if (!t) return;
    H.style.setProperty("--fdm", "0px");
    var y = sec.getBoundingClientRect().top + home.scrollTop - home.getBoundingClientRect().top;
    H.style.setProperty("--fdm", Math.max(0, Math.round(innerHeight * 0.36 - y)) + "px");
  }
  pad();
  addEventListener("resize", function () { if (Math.abs(innerWidth - padW) > 1) pad(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(pad);
  setTimeout(pad, 0);

  document.addEventListener("vp-house", render);
  render();
  // фото комнат грузятся по мере надобности; когда фото дома загрузилось - ещё раз пересчитать (высота сцены)
  img.addEventListener("load", kick);
})();
