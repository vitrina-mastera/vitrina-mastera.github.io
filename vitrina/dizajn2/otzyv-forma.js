/* "Оставить отзыв" (пробная главная Краснодара, 2026-11-27, по голосовым мастера).
   Форма: имя и фамилия (обязательно), текст (написать или вставить), откуда узнали, контакт (видит только мастер,
   на сайт не попадает), фото и видео готовой мебели.
   У сайта нет своего сервера, поэтому отзыв уходит мастеру в WhatsApp: на телефоне - через меню "Поделиться" вместе
   с фото и видео, иначе - текстом в чат мастера (фото человек прикладывает в тот же чат). Мастер вставляет сообщение
   в Мастерскую (вкладка "Отзывы"), поля заполняются сами; там же он правит, удаляет и отвечает. На сайт отзыв попадает
   только после его публикации - это и есть проверка. Текст сообщения разбирает Мастерская по меткам строк ниже (METKI). */
(function () {
  "use strict";
  var D = window.VITRINA || {}, K = D.kontakty || {}, M = D.master || {};
  var WA = String(K.whatsapp || "").replace(/\D/g, "");
  var OTK = ["По рекомендации знакомых", "Увидел(а) рекламу", "Из соцсетей (ВК, Telegram, Instagram)"];
  var MAXF = 10;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function $(id) { return document.getElementById(id); }
  window.KrOtzyv = { METKI: { zag: "Отзыв для сайта", imya: "Имя:", otkuda: "Откуда узнал(а):", kontakt: "Контакт:", tekst: "Отзыв:", media: "Фото и видео:" } };

  var css = [
    ".kotz{position:fixed;inset:0;z-index:80;background:#0F0F0E;color:#F1EEE8;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;opacity:0;visibility:hidden;transition:opacity .35s ease,visibility 0s .35s}",
    ".kotz.on{opacity:1;visibility:visible;transition:opacity .35s ease}",
    ".kotz-in{max-width:560px;margin:0 auto;padding:calc(20px + env(safe-area-inset-top)) 22px calc(40px + env(safe-area-inset-bottom))}",
    ".kotz-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:26px}",
    ".kotz-top i{flex:1;height:1px;background:rgba(241,238,232,.25)}",
    ".kotz-x{width:44px;height:44px;border:1px solid rgba(241,238,232,.3);background:none;color:#F1EEE8;font-size:22px;line-height:1;cursor:pointer}",
    ".kotz h2{font-family:var(--serif,Georgia,serif);font-weight:400;font-size:32px;line-height:1.15;margin:0 0 8px}",
    ".kotz .lead{color:rgba(241,238,232,.7);margin:0 0 26px;font-size:14.5px}",
    ".kotz label.f,.kotz fieldset{display:block;margin:0 0 22px;border:0;padding:0}",
    ".kotz .lb,.kotz legend{display:block;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(241,238,232,.62);margin:0 0 8px;padding:0}",
    ".kotz .lb em{font-style:normal;color:#F1EEE8}",
    ".kotz input[type=text],.kotz input[type=tel],.kotz textarea{width:100%;box-sizing:border-box;background:transparent;border:0;border-bottom:1px solid rgba(241,238,232,.35);color:#F1EEE8;font:400 16px/1.45 var(--sans,system-ui,sans-serif);padding:10px 0;border-radius:0;outline:none}",
    ".kotz textarea{min-height:130px;resize:vertical;border:1px solid rgba(241,238,232,.35);padding:12px}",
    ".kotz input:focus,.kotz textarea:focus{border-color:#F1EEE8}",
    ".kotz small{display:block;margin-top:6px;font-size:12.5px;color:rgba(241,238,232,.55)}",
    ".kotz .rad{display:flex;align-items:center;gap:12px;min-height:44px;cursor:pointer;font-size:15px}",
    ".kotz .rad input{appearance:none;-webkit-appearance:none;flex:none;width:18px;height:18px;margin:0;border:1px solid rgba(241,238,232,.55);border-radius:50%;display:grid;place-items:center}",
    ".kotz .rad input:checked::after{content:'';width:8px;height:8px;border-radius:50%;background:#F1EEE8}",
    ".kotz .rad input:focus-visible{outline:1px solid #F1EEE8;outline-offset:3px}",
    ".kotz #kotzDr{margin:2px 0 0 30px;width:calc(100% - 30px)}",
    ".kotz .add{display:flex;align-items:center;justify-content:center;gap:10px;min-height:52px;border:1px dashed rgba(241,238,232,.4);cursor:pointer;font-size:12px;letter-spacing:.16em;text-transform:uppercase}",
    ".kotz .add input{position:absolute;width:1px;height:1px;opacity:0}",
    ".kotz .med{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:6px;margin-top:8px}",
    ".kotz .med div{position:relative;aspect-ratio:1;background:#1B1A18;overflow:hidden}",
    ".kotz .med img,.kotz .med video{width:100%;height:100%;object-fit:cover;display:block}",
    ".kotz .med span{position:absolute;left:4px;bottom:4px;font-size:10px;letter-spacing:.1em;background:rgba(0,0,0,.6);padding:2px 5px}",
    ".kotz .med button{position:absolute;top:2px;right:2px;width:30px;height:30px;border:0;background:rgba(0,0,0,.6);color:#fff;font-size:18px;cursor:pointer}",
    ".kotz .go{width:100%;min-height:54px;border:1px solid #F1EEE8;background:#F1EEE8;color:#0F0F0E;font:500 12.5px/1 var(--sans,system-ui,sans-serif);letter-spacing:.18em;text-transform:uppercase;cursor:pointer;margin-top:6px}",
    ".kotz .go2{background:transparent;color:#F1EEE8;margin-top:10px}",
    ".kotz .err{color:#F0A08C;font-size:13.5px;margin:8px 0 0;min-height:1em}",
    ".kotz .how{font-size:13px;color:rgba(241,238,232,.6);margin:12px 0 0}",
    ".kotz .done{text-align:center;padding-top:8vh}.kotz .done h2{margin-bottom:14px}.kotz .done p{color:rgba(241,238,232,.72);margin:0 0 26px}",
    ".kotz .orn{display:block;width:120px;height:1px;margin:0 auto 28px;background:linear-gradient(90deg,transparent,#F1EEE8,transparent)}",
    ".klb{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.94);display:flex;align-items:center;justify-content:center;cursor:zoom-out}",
    ".klb img{max-width:100%;max-height:100%;object-fit:contain}"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var ov = document.createElement("div"); ov.className = "kotz"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-labelledby", "kotzT");
  document.body.appendChild(ov);
  var FILES = [], back = null, KEY = "kr-otz-chernovik";

  function form() {
    var d = {}; try { d = JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch (e) {}
    ov.innerHTML = '<div class="kotz-in"><div class="kotz-top"><i></i><button type="button" class="kotz-x" aria-label="Закрыть">&times;</button></div>' +
      '<h2 id="kotzT">Оставить отзыв</h2><p class="lead">Расскажите, как вам мебель. Отзыв появится на сайте после того, как мастер его посмотрит.</p>' +
      '<label class="f"><span class="lb">Имя и фамилия <em>*</em></span><input type="text" id="kotzN" autocomplete="name" maxlength="80" value="' + esc(d.n || "") + '"></label>' +
      '<label class="f"><span class="lb">Отзыв <em>*</em></span><textarea id="kotzTx" maxlength="4000" placeholder="Напишите своими словами или вставьте готовый текст">' + esc(d.t || "") + "</textarea></label>" +
      '<fieldset><legend>Откуда вы узнали о мастере</legend>' +
      OTK.map(function (o, i) { return '<label class="rad"><input type="radio" name="kotzO" value="' + esc(o) + '"' + (d.o === o ? " checked" : "") + ">" + esc(o) + "</label>"; }).join("") +
      '<label class="rad"><input type="radio" name="kotzO" value="*"' + (d.o === "*" ? " checked" : "") + '>Другое</label><input type="text" id="kotzDr" maxlength="80" placeholder="Напишите, откуда" value="' + esc(d.dr || "") + '"' + (d.o === "*" ? "" : " hidden") + "></fieldset>" +
      '<label class="f"><span class="lb">Телефон или ник для связи</span><input type="text" id="kotzK" autocomplete="tel" maxlength="60" value="' + esc(d.k || "") + '"><small>Увидит только мастер, на сайте не показывается. Можно не заполнять.</small></label>' +
      '<div class="f" style="margin-bottom:24px"><span class="lb">Фото и видео готовой мебели</span><label class="add"><input type="file" id="kotzF" accept="image/*,video/*" multiple>+ Добавить фото или видео</label><div class="med" id="kotzM"></div></div>' +
      '<button type="button" class="go" id="kotzGo">Отправить мастеру</button><p class="err" id="kotzE" role="alert"></p>' +
      '<p class="how">Отзыв уйдёт мастеру в WhatsApp' + (WA ? " (" + esc(nice(WA)) + ")" : "") + '. Если откроется меню «Поделиться» - выберите WhatsApp и чат мастера.</p></div>';
    ov.querySelector(".kotz-x").onclick = close;
    var keep = function () { try { sessionStorage.setItem(KEY, JSON.stringify(val())); } catch (e) {} };
    ["kotzN", "kotzTx", "kotzK", "kotzDr"].forEach(function (id) { $(id).addEventListener("input", keep); });
    [].forEach.call(ov.querySelectorAll("[name=kotzO]"), function (r) { r.onchange = function () { $("kotzDr").hidden = r.value !== "*" || !r.checked; if (r.value === "*") $("kotzDr").focus(); keep(); }; });
    $("kotzF").onchange = function () {
      var fs = [].slice.call(this.files); this.value = "";
      fs.forEach(function (f) { if (FILES.length < MAXF && /^(image|video)\//.test(f.type)) FILES.push(f); });
      if (FILES.length >= MAXF) $("kotzE").textContent = "Можно до " + MAXF + " файлов."; else $("kotzE").textContent = "";
      drawM();
    };
    $("kotzGo").onclick = send;
    drawM();
  }
  function nice(d) { return d.length === 11 ? "+7 " + d.slice(1, 4) + " " + d.slice(4, 7) + "-" + d.slice(7, 9) + "-" + d.slice(9) : "+" + d; }
  var URLS = [];
  function drawM() {
    URLS.forEach(function (u) { URL.revokeObjectURL(u); }); URLS = [];
    $("kotzM").innerHTML = FILES.map(function (f, i) {
      var u = URL.createObjectURL(f); URLS.push(u);
      return "<div>" + (/^video/.test(f.type) ? '<video src="' + u + '#t=0.5" muted playsinline preload="metadata"></video><span>ВИДЕО</span>' : '<img src="' + u + '" alt="">') + '<button type="button" data-i="' + i + '" aria-label="Убрать">&times;</button></div>';
    }).join("");
    [].forEach.call($("kotzM").querySelectorAll("button"), function (b) { b.onclick = function () { FILES.splice(+b.getAttribute("data-i"), 1); drawM(); }; });
  }
  function val() {
    var r = ov.querySelector("[name=kotzO]:checked");
    return { n: $("kotzN").value.trim(), t: $("kotzTx").value.trim(), k: $("kotzK").value.trim(), o: r ? r.value : "", dr: $("kotzDr").value.trim() };
  }
  function text(v) {
    var m = window.KrOtzyv.METKI, otk = v.o === "*" ? v.dr : v.o;
    var n = FILES.filter(function (f) { return /^image/.test(f.type); }).length, nv = FILES.length - n;
    return m.zag + (M.imya ? " «" + M.imya + "»" : "") + "\n" + m.imya + " " + v.n + "\n" + (otk ? m.otkuda + " " + otk + "\n" : "") + (v.k ? m.kontakt + " " + v.k + "\n" : "") +
      (FILES.length ? m.media + " " + (n ? n + " фото" : "") + (n && nv ? ", " : "") + (nv ? nv + " видео" : "") + "\n" : "") + m.tekst + "\n" + v.t;
  }
  function send() {
    var v = val(), e = $("kotzE");
    if (v.n.length < 2) { e.textContent = "Напишите имя и фамилию."; $("kotzN").focus(); return; }
    if (v.t.length < 10) { e.textContent = "Напишите отзыв - хотя бы пару предложений."; $("kotzTx").focus(); return; }
    if (v.o === "*" && !v.dr) { e.textContent = "Напишите, откуда вы узнали о мастере, или выберите вариант."; $("kotzDr").focus(); return; }
    e.textContent = "";
    var t = text(v), wa = WA ? "https://wa.me/" + WA + "?text=" + encodeURIComponent(t) : "";
    var share = FILES.length && navigator.canShare && (function () { try { return navigator.canShare({ files: FILES, text: t }); } catch (x) { return false; } })();
    if (share) {
      navigator.share({ files: FILES, text: t, title: "Отзыв" }).then(function () { done(t, wa, true); }, function (x) {
        if (x && x.name === "AbortError") return; // человек закрыл меню - остаёмся в форме
        e.textContent = "Не получилось приложить файлы. Отправьте текст, а фото - в тот же чат."; if (wa) openWa(wa); done(t, wa, false);
      });
      return;
    }
    if (wa) openWa(wa);
    done(t, wa, false);
  }
  function openWa(u) { if (window.KrSvyaz) window.KrSvyaz.open(u); else window.open(u, "_blank", "noopener"); }
  function done(t, wa, shared) {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    var left = FILES.length && !shared;
    ov.innerHTML = '<div class="kotz-in"><div class="kotz-top"><i></i><button type="button" class="kotz-x" aria-label="Закрыть">&times;</button></div><div class="done"><i class="orn"></i>' +
      '<h2 id="kotzT">Спасибо!</h2><p>' + (left ? "Текст отзыва открылся в чате с мастером. Отправьте его и приложите туда же фото и видео." : shared || !wa ? "Отзыв появится на сайте после того, как мастер его посмотрит." : "В чате с мастером открылось готовое сообщение - нажмите «Отправить». Отзыв появится на сайте после того, как мастер его посмотрит.") + "</p>" +
      (wa ? '<button type="button" class="go" id="kotzWa">' + (shared ? "Не отправилось? Открыть чат" : "Открыть чат с мастером") + "</button>" : "") +
      '<button type="button" class="go go2" id="kotzCp">Скопировать текст отзыва</button><button type="button" class="go go2" id="kotzOk">Вернуться на сайт</button></div></div>';
    ov.querySelector(".kotz-x").onclick = close; $("kotzOk").onclick = close;
    if ($("kotzWa")) $("kotzWa").onclick = function () { openWa(wa); };
    $("kotzCp").onclick = function () {
      var b = this, ok = function (y) { b.textContent = y ? "Скопировано" : "Не вышло"; };
      if (window.KrSvyaz) window.KrSvyaz.copy(t, ok); else if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { ok(true); }, function () { ok(false); });
    };
    FILES = [];
  }
  function open() {
    back = document.activeElement; FILES = []; form();
    ov.classList.add("on"); ov.scrollTop = 0;
    setTimeout(function () { $("kotzN") && $("kotzN").focus({ preventScroll: true }); }, 80);
  }
  function close() {
    if (!ov.classList.contains("on")) return;
    ov.classList.remove("on");
    if (back && back.focus) back.focus({ preventScroll: true });
  }
  // "назад" на телефоне закрывает раздел под формой - закрываем и форму (черновик текста сохранён)
  addEventListener("popstate", function () { ov.classList.remove("on"); }, true);
  addEventListener("keydown", function (e) { if (e.key === "Escape" && ov.classList.contains("on")) { e.stopImmediatePropagation(); close(); } }, true);
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-otz-new]");
    if (b) { e.preventDefault(); open(); return; }
    var a = e.target.closest && e.target.closest("[data-otz-ph]");
    if (a) {
      e.preventDefault();
      var lb = document.createElement("div"); lb.className = "klb"; lb.innerHTML = '<img alt="" src="' + esc(a.getAttribute("href")) + '">';
      lb.onclick = function () { lb.remove(); }; document.body.appendChild(lb);
    }
  });
  window.KrOtzyv.open = open;
})();
