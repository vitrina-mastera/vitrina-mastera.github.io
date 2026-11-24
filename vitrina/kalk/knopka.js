/* Вход в быстрый расчёт с витрины "Просто" (krasnodar/proba/ - пробная копия клиентской версии).
   Ничего не меняет в коде витрины: добавляет пункт в меню и кнопку на экране работы, когда они появились на странице.
   Расчёт - отдельная страница ../raschet/ (там же, за тем же пин-кодом). Если мастер выключил расчёт - кнопок нет. */
(function () {
  "use strict";
  var V = window.VITRINA || {}, KC = window.KalkCeny;
  if (KC && KC.conf(V).vkl === false) return;
  var BASE = "../raschet/?ot=proba";
  // комната работы -> изделие для расчёта (кухни - сразу кухня, остальное - выбрать на первом шаге)
  var BY_ROOM = { kuhni: "kuhnya", prihozhie: "prihozhaya", gostinye: "tv", vannye: "vannaya" };
  function workId() { var m = /^#rabota=(.+)$/.exec(location.hash); try { return m ? decodeURIComponent(m[1]) : ""; } catch (e) { return ""; } }
  function workUrl() {
    var id = workId(), w = null; (V.raboty || []).forEach(function (x) { if (x.id === id) w = x; });
    var u = BASE; if (w) { u += "&rabota=" + encodeURIComponent(w.id); if (BY_ROOM[w.komnata]) u += "&iz=" + BY_ROOM[w.komnata]; }
    return u;
  }
  var st = document.createElement("style");
  st.textContent =
    "html[data-d2p] .kk-mi button:first-child{border-top:0}" +
    "html[data-d2p] #kkWant{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;background:transparent;color:var(--ink,#F1EEE8);border:1px solid rgba(241,238,232,.22);box-shadow:none;min-height:46px;font-weight:500;font-size:11px;letter-spacing:.24em;transition:background-color .3s,border-color .3s}" +
    "@media (hover:hover){html[data-d2p] #kkWant:hover{background:rgba(241,238,232,.06);border-color:rgba(241,238,232,.6)}}";
  document.head.appendChild(st);
  function addMenu() {
    var nav = document.querySelector(".d2-mnav"); if (!nav || document.querySelector(".kk-mi")) return !!nav;
    var box = document.createElement("div"); box.className = "d2-mnav kk-mi";
    box.innerHTML = '<button type="button" style="--i:4"><span>Расчёт стоимости</span></button>';
    box.firstChild.onclick = function () { location.href = BASE; };
    nav.parentNode.insertBefore(box, nav.nextSibling);
    return true;
  }
  function addWant() {
    var b = document.getElementById("wantBtn"); if (!b || document.getElementById("kkWant")) return !!b;
    var a = document.createElement("a"); a.id = "kkWant"; a.className = (b.className || "btn").replace(/\bmain\b/, "").trim() + " kk-want"; a.href = BASE;
    a.textContent = "Сколько будет стоить";
    a.addEventListener("click", function () { a.href = workUrl(); });
    b.parentNode.insertBefore(a, b.nextSibling);
    return true;
  }
  var n = 0;
  (function wait() { var ok = addMenu() & addWant(); if (!ok && ++n < 60) setTimeout(wait, 500); })();
})();
