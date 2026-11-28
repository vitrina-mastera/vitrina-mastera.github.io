/* Закрытая витрина: главная = путешествие по дому (krasnodar/index.html).
   Этот файл грузится перед puteshestvie.js и добавляет только то, что нужно в закрытой витрине:
   полоску "Черновик": "назад" в раздел Витрины (только для Александра), три раздела мастера -
   варианты дизайна (dizajn/), Мастерская (masterskaya/), вопросы и правки (master/) - и кнопку "Выйти".
   Клиенты эту полоску не увидят: в открытой витрине файла нет. */
(function () {
  "use strict";
  window.VP_PREVIEW = true; // показать место под видео, даже пока роликов нет
  var home = document.getElementById("home"), top = document.getElementById("htop");
  if (!home || !top) return;
  var css = document.createElement("style");
  css.textContent = [
    ".krbar{max-width:1240px;margin:0 auto;padding:calc(8px + env(safe-area-inset-top,0px)) clamp(14px,3vw,32px) 8px;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;font-size:13px;color:#BDB2A2}",
    ".krbar .ms-prod{color:#EDE4D6}.krbar .ms-prod:empty{display:none}.krbar .ms-where{display:none}",
    ".krbar .t{flex:1 1 0;min-width:0;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".krbar .t b{color:var(--kr-ink,#F1EEE8);font-weight:500}",
    ".krbar .krsec{display:flex;gap:8px}",
    ".krbar .krsec a,.krbar button{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;padding:0 14px;border-radius:0;letter-spacing:.18em;text-transform:uppercase;font:500 10.5px/1.1 var(--kr-sans,Jost),system-ui,sans-serif;text-decoration:none;white-space:nowrap;text-align:center}",
    ".krbar .krsec a{background:none;color:var(--kr-ink,#F1EEE8);border:1px solid var(--kr-line2,#4A4743);transition:border-color .3s}",
    ".krbar .krsec a:hover{border-color:var(--kr-ink,#F1EEE8)}",
    ".krbar .krsec a svg{flex:none;width:15px;height:15px}",
    ".krbar button{border:1px solid rgba(244,238,228,.25);color:#BDB2A2;background:none;cursor:pointer}",
    "#home.enter .krbar{animation:rise .8s cubic-bezier(.22,1,.36,1) .2s both}",
    // телефон: сверху "назад" и "Выйти", ниже три раздела мастера ровной сеткой
    "@media (max-width:760px){.krbar .t{display:none}.krbar .ms-prod{flex:1 1 auto}.krbar .krsec{order:3;flex:1 1 100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.krbar .krsec a{padding:6px 6px;white-space:normal;min-height:40px;font-size:12.5px}.krbar .krsec a svg{display:none}.krbar>button{margin-left:auto}}"
  ].join("\n");
  document.head.appendChild(css);
  var I = function (d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>"; };
  var bar = document.createElement("div");
  bar.className = "krbar";
  bar.innerHTML = '<nav class="krnav"></nav><div class="t"><b>Черновик витрины.</b> <span>Видите только вы - вход по пин-коду.</span></div>' +
    '<div class="krsec" aria-label="Разделы для мастера">' +
    '<a href="dizajn/">' + I('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>') + "Варианты дизайна</a>" +
    '<a href="masterskaya/">' + I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>') + "Мастерская</a>" +
    '<a href="master/">' + I('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>') + "Вопросы и правки</a></div>" +
    '<button type="button" id="krOut">Выйти</button>';
  // открытый вход (enc/otkryto.json): пин-кода нет, "Выйти" не нужен - после выхода витрина тут же открылась бы снова
  if (window.KrZamok && KrZamok.otkryto) { bar.querySelector(".t span").textContent = "Открыта для всех по ссылке, без пин-кода."; bar.querySelector("#krOut").remove(); }
  home.insertBefore(bar, top);
  if (window.MebelSite && MebelSite.nav) MebelSite.nav(bar.querySelector(".krnav"));
  if (document.getElementById("krOut")) document.getElementById("krOut").onclick = function () { if (window.KrZamok) KrZamok.logout(); };
})();
