/* Кнопки связи WhatsApp и Telegram, которые открываются всегда (пробная главная Краснодара, 2026-11-27).
   Мастер: "нажимаю WhatsApp, Telegram - ничего не подгружается" (в России wa.me / t.me через браузер часто висят,
   даже с VPN). Поэтому на телефоне открываем сразу приложение (whatsapp://, tg://), минуя сайты-переходники.
   Если приложение так и не открылось (страница осталась на экране) - снизу появляется окошко: скопировать номер или ник,
   скопировать текст сообщения, открыть через браузер. На компьютере - веб-версия в новой вкладке и то же окошко.
   Работает для всех ссылок wa.me / api.whatsapp.com / t.me на странице и для window.open с такими адресами. */
(function () {
  "use strict";
  var ua = navigator.userAgent || "";
  var MOB = /Android|iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ""));
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function nicePhone(d) { return d.length === 11 && /^[78]/.test(d) ? "+7 " + d.slice(1, 4) + " " + d.slice(4, 7) + "-" + d.slice(7, 9) + "-" + d.slice(9) : "+" + d; }
  function parse(href) {
    var u; try { u = new URL(href, location.href); } catch (e) { return null; }
    var h = u.hostname.replace(/^www\./, "");
    if (h === "wa.me" || h === "api.whatsapp.com" || h === "web.whatsapp.com") {
      var ph = (h === "wa.me" ? u.pathname : u.searchParams.get("phone") || "").replace(/\D/g, ""), t = u.searchParams.get("text") || "";
      if (!ph) return null;
      var q = "?phone=" + ph + (t ? "&text=" + encodeURIComponent(t) : "");
      return { k: "wa", name: "WhatsApp", id: nicePhone(ph), copy: "+" + ph, text: t, app: "whatsapp://send" + q, web: (MOB ? "https://api.whatsapp.com/send" : "https://web.whatsapp.com/send") + q };
    }
    if (h === "t.me" || h === "telegram.me") {
      var n = u.pathname.replace(/^\/+/, "").split("/")[0];
      if (!n || !/^[A-Za-z0-9_]{3,}$/.test(n)) return null;
      return { k: "tg", name: "Telegram", id: "@" + n, copy: "@" + n, text: "", app: "tg://resolve?domain=" + n, web: "https://t.me/" + n };
    }
    return null;
  }

  // ---------- окошко "не открылось?" ----------
  var css = ".ksv{position:fixed;left:50%;bottom:max(14px,env(safe-area-inset-bottom));z-index:9999;width:min(440px,calc(100vw - 24px));transform:translate(-50%,24px);opacity:0;pointer-events:none;" +
    "background:#141413;color:#F1EEE8;border:1px solid rgba(241,238,232,.18);box-shadow:0 20px 50px -10px rgba(0,0,0,.7);padding:18px 18px 14px;font:400 14px/1.45 var(--sans,system-ui,sans-serif);transition:opacity .3s ease,transform .3s ease}" +
    ".ksv.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}" +
    ".ksv b{display:block;font-weight:500;font-size:12px;letter-spacing:.18em;text-transform:uppercase;margin:0 28px 8px 0}" +
    ".ksv p{margin:0 0 12px;color:rgba(241,238,232,.75)}.ksv p span{color:#F1EEE8;white-space:nowrap}" +
    ".ksv .r{display:flex;flex-wrap:wrap;gap:8px}" +
    ".ksv button,.ksv a{flex:1 1 auto;min-height:42px;padding:0 14px;border:1px solid rgba(241,238,232,.35);background:transparent;color:#F1EEE8;font:500 11.5px/1 var(--sans,system-ui,sans-serif);letter-spacing:.14em;text-transform:uppercase;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;cursor:pointer}" +
    ".ksv button:active,.ksv a:active{background:rgba(241,238,232,.08)}" +
    ".ksv .x{position:absolute;top:8px;right:8px;flex:none;width:36px;min-height:36px;padding:0;border:0;font-size:20px;letter-spacing:0}";
  var box = null, hideT = 0;
  function sheet(c) {
    if (!box) {
      var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
      box = document.createElement("div"); box.className = "ksv"; box.setAttribute("role", "dialog"); box.setAttribute("aria-live", "polite");
      document.body.appendChild(box);
    }
    box.innerHTML = '<button type="button" class="x" aria-label="Закрыть">&times;</button><b>' + (MOB ? "Не открылось?" : "Открываю " + esc(c.name)) + "</b>" +
      "<p>" + (MOB ? esc(c.name) + " не открылся сам. " : "Если вкладка не открылась или висит - ") + esc(c.name) + ' мастера: <span>' + esc(c.id) + "</span></p>" +
      '<div class="r"><button type="button" data-c="id">Скопировать ' + (c.k === "wa" ? "номер" : "ник") + "</button>" +
      (c.text ? '<button type="button" data-c="text">Скопировать сообщение</button>' : "") +
      '<a href="' + esc(MOB ? c.web : c.app) + '" target="_blank" rel="noopener" data-raw>' + (MOB ? "Через браузер" : "Через приложение") + "</a></div>";
    box.querySelector(".x").onclick = close;
    [].forEach.call(box.querySelectorAll("[data-c]"), function (b) { b.onclick = function () {
      var t = b.getAttribute("data-c") === "id" ? c.copy : c.text;
      copy(t, function (ok) { b.textContent = ok ? "Скопировано" : "Не вышло - выделите вручную"; });
    }; });
    box.classList.add("on");
    clearTimeout(hideT); hideT = setTimeout(close, 20000);
  }
  function close() { if (box) box.classList.remove("on"); clearTimeout(hideT); }
  function copy(t, cb) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { cb(true); }, function () { cb(old(t)); });
    else cb(old(t));
  }
  function old(t) {
    var a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(a); a.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} a.remove(); return ok;
  }

  // ---------- открыть ----------
  var nativeOpen = window.open;
  function go(c) {
    if (MOB) {
      // приложение открылось - страница ушла в фон (или окно потеряло фокус: на iPhone спрашивает "Открыть в ...?")
      var gone = false, mark = function (e) { if (document.hidden || (e && (e.type === "blur" || e.type === "pagehide"))) gone = true; };
      document.addEventListener("visibilitychange", mark); addEventListener("pagehide", mark); addEventListener("blur", mark);
      location.href = c.app;
      setTimeout(function () {
        document.removeEventListener("visibilitychange", mark); removeEventListener("pagehide", mark); removeEventListener("blur", mark);
        if (!gone && !document.hidden) sheet(c);
      }, 1700);
    } else {
      nativeOpen.call(window, c.web, "_blank", "noopener");
      sheet(c);
    }
  }
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.hasAttribute("data-raw")) return;
    var c = parse(a.href); if (!c) return;
    e.preventDefault(); e.stopPropagation(); go(c);
  }, true);
  window.open = function (u) {
    var c = typeof u === "string" ? parse(u) : null;
    if (c) { go(c); return null; }
    return nativeOpen.apply(window, arguments);
  };
  window.KrSvyaz = { parse: parse, open: function (href) { var c = parse(href); if (c) go(c); else nativeOpen.call(window, href, "_blank", "noopener"); }, copy: copy };
})();
