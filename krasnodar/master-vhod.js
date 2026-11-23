/* Скрытый вход мастера в чистой версии для клиентов (krasnodar/klient/).
   Клиент не видит никаких кнопок "Мастерская" или "Войти". Мастер удерживает знак с названием вверху слева
   (около секунды) или большой знак на заставке - появляется окно "Вход мастера", он вводит КОД МАСТЕРА (12 цифр, не пин витрины: пин знают клиенты).
   Верный код запоминается на этом устройстве (публикация из Мастерской сразу включена), дальше - Мастерская.
   Если код уже запомнен - удержание сразу открывает Мастерскую. Подключает zamok.js на странице kr-klient. */
(function () {
  "use strict";
  if (window.KrMasterVhod) return; window.KrMasterVhod = true;
  var Z = window.KrZamok, BASE = Z.base, HOLD = 800, SEL = ".d2-brand, .d2-dmark, [data-master-vhod]";
  var st = document.createElement("style");
  st.textContent = SEL.split(", ").map(function (s) { return s + "{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}"; }).join("") +
    // вид - как окно пин-кода: общий stil.css (--kr-*), тонкие линии, без заливок
    "#krMv{position:fixed;inset:0;z-index:2147483100;background:rgba(18,18,17,.97);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;font-family:var(--kr-sans,system-ui,sans-serif);font-weight:300;color:var(--kr-ink,#F1EEE8);-webkit-font-smoothing:antialiased;animation:krMvIn .35s cubic-bezier(.22,1,.36,1) both}" +
    "@keyframes krMvIn{from{opacity:0}}" +
    "#krMv form{width:100%;max-width:340px;text-align:center}" +
    "#krMv .c{font-weight:500;font-size:10.5px;letter-spacing:.26em;text-transform:uppercase;color:var(--kr-muted,#A6A198);margin:0 0 14px}" +
    "#krMv h2{font-family:var(--kr-serif,Georgia,serif);font-size:30px;line-height:1.1;font-weight:400;margin:0 0 10px}" +
    "#krMv p{margin:0 0 24px;color:var(--kr-muted,#A6A198);font-size:14.5px;line-height:1.55}" +
    "#krMv input{width:100%;box-sizing:border-box;font:inherit;font-weight:300;font-size:22px;letter-spacing:.18em;text-align:center;padding:12px 6px;border:0;border-bottom:1px solid var(--kr-line2,#4A4743);border-radius:0;background:transparent;color:var(--kr-ink,#F1EEE8);outline:none;transition:border-color .3s}" +
    "#krMv input:focus{border-bottom-color:var(--kr-ink,#F1EEE8)}#krMv input::placeholder{color:var(--kr-faint,#77726B)}" +
    "#krMv .b{display:flex;gap:10px;margin-top:26px}" +
    "#krMv button{flex:1;font:inherit;font-weight:500;font-size:11px;letter-spacing:.22em;text-transform:uppercase;min-height:48px;border:1px solid var(--kr-ink,#F1EEE8);border-radius:0;background:transparent;color:var(--kr-ink,#F1EEE8);cursor:pointer;transition:background-color .3s,color .3s,border-color .3s}" +
    "#krMv button.l{border-color:var(--kr-line2,#4A4743);color:var(--kr-muted,#A6A198)}" +
    "@media (hover:hover){#krMv button:not(.l):not(:disabled):hover{background:var(--kr-ink,#F1EEE8);color:var(--kr-bg,#121211)}#krMv button.l:hover{border-color:var(--kr-ink,#F1EEE8);color:var(--kr-ink,#F1EEE8)}}" +
    "#krMv button:disabled{opacity:.4}#krMv .m{min-height:20px;margin-top:14px;font-size:13.5px;color:var(--kr-err,#E3A08F)}";
  document.head.appendChild(st);

  var pubP = null;
  function pub() {
    if (window.KrPub) return Promise.resolve(window.KrPub);
    if (!pubP) pubP = new Promise(function (ok, no) { var s = document.createElement("script"); s.src = BASE + "masterskaya/publik.js"; s.onload = function () { ok(window.KrPub); }; s.onerror = function () { pubP = null; no(new Error("нет связи")); }; document.head.appendChild(s); });
    return pubP;
  }
  function goMs() { try { sessionStorage.setItem("kr-iz-klienta", "1"); } catch (e) {} location.href = BASE + "masterskaya/"; } // "назад" из Мастерской - сюда же
  function close() { var e = document.getElementById("krMv"); if (e) e.remove(); }
  function open() {
    if (document.getElementById("krMv")) return;
    var P, PJ;
    pub().then(function (p) { P = p; return P.cfg(); }).then(function (pj) {
      PJ = pj;
      return pj ? P.saved(pj) : null;
    }).then(function (B) {
      if (B) return goMs(); // код уже на этом устройстве
      var el = document.createElement("div"); el.id = "krMv"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
      el.innerHTML = PJ ? '<form autocomplete="off"><div class="c">Для мастера</div><h2>Вход в Мастерскую</h2><p>Код мастера - 12 цифр.</p>' +
        '<input id="krMvC" type="password" inputmode="numeric" maxlength="20" placeholder="0000-0000-0000" aria-label="Код мастера">' +
        '<div class="b"><button type="button" class="l" id="krMvX">Отмена</button><button type="submit" id="krMvGo">Войти</button></div><div class="m" id="krMvM" role="status"></div></form>' :
        '<form><div class="c">Для мастера</div><h2>Вход в Мастерскую</h2><p>Вход для мастера ещё не настроен.</p><div class="b"><button type="button" class="l" id="krMvX">Понятно</button></div></form>';
      document.body.appendChild(el);
      el.querySelector("#krMvX").onclick = close;
      el.addEventListener("click", function (e) { if (e.target === el) close(); });
      document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", k); } });
      var inp = el.querySelector("#krMvC"); if (!inp) return;
      setTimeout(function () { inp.focus(); }, 30);
      el.querySelector("form").onsubmit = function (e) {
        e.preventDefault();
        var c = P.digits(inp.value), m = el.querySelector("#krMvM"), go = el.querySelector("#krMvGo");
        if (c.length !== 12) { m.textContent = "В коде 12 цифр"; return; }
        go.disabled = true; m.textContent = "";
        P.unlock(c, PJ, true).then(goMs, function (er) { go.disabled = false; inp.value = ""; inp.focus(); m.textContent = er.message || "Неверный код"; });
      };
    }).catch(function () {});
  }

  // удержание: палец или мышь на знаке ~0.8 с без сдвига; обычное нажатие работает как раньше
  var t = 0, sx = 0, sy = 0, fired = false;
  function cancel() { clearTimeout(t); t = 0; }
  document.addEventListener("pointerdown", function (e) {
    var b = e.target.closest && e.target.closest(SEL); if (!b || e.button > 0) return;
    fired = false; sx = e.clientX; sy = e.clientY; cancel();
    t = setTimeout(function () { t = 0; fired = true; if (navigator.vibrate) try { navigator.vibrate(15); } catch (x) {} open(); }, HOLD);
  }, true);
  document.addEventListener("pointermove", function (e) { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) cancel(); }, true);
  ["pointerup", "pointercancel", "scroll"].forEach(function (n) { document.addEventListener(n, cancel, true); });
  // после удержания не прокручивать наверх и не показывать меню телефона
  document.addEventListener("click", function (e) { if (fired && e.target.closest && e.target.closest(SEL)) { e.stopPropagation(); e.preventDefault(); fired = false; } }, true);
  document.addEventListener("contextmenu", function (e) { if (e.target.closest && e.target.closest(SEL)) e.preventDefault(); }, true);
})();
