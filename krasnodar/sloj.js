/* Слой правок мастера поверх данных витрины. Один и тот же код работает:
   - в браузере (zamok.js подмешивает enc/m.bin - то, что мастер опубликовал сам из Мастерской);
   - в Node (site/tools/zashifrovat-krasnodar.js подмешивает pravki*.json - пакеты, присланные файлом).

   Формат правок P (pravki.json из пакета и расшифрованный m.bin - одинаковые):
     master, kontakty  - поля "О мастере" и контакты; пустые строки ничего не затирают;
     logo              - знак мастера (путь foto/... или "@id" зашифрованного файла);
     novye_raboty      - [{ id, nazvanie, komnata, rasskaz, foto: [{src}], video: [{fajl, oblozhka}] }] - в начало списка;
     k_rabotam         - [{ rabota, nazvanie?, rasskaz?, foto: [...], video: [...] }] - правка готовой работы и новые фото к ней;
                         у обеих ещё поля описания material, cvet, razmery, god (строки; пустая в k_rabotam - стереть);
     skryt             - [id работы, ...] - убрать работы с витрины (вместе с их видео);
     fon               - фон первого экрана: { tip: "video", video?, video_tel?, kadr?, kadr_tel? } - своё видео (для
                         компьютера / для телефона, нет одного - берётся другое), { tip: "foto", rabota, foto } - фото
                         работы (номер фото с 0), { tip: "podborka" } или нет поля - подборка из данных витрины.
   С 2026-11-24 (отзыв мастера):
     komnaty           - { novye: [{ id, nazvanie, hint?, posle? }], udalit: [id, ...] } - свои комнаты (posle - id комнаты,
                         после которой стоит новая; нет - в конце) и удалённые. Работы удалённой комнаты, которые мастер
                         не перенёс, уходят в первую оставшуюся комнату - ничего не пропадает молча. Новая комната без работ
                         клиенту не показывается (в доме не висит пустая), Мастерская видит её через KR_SLOJ.
     k_rabotam[].komnata, novye_raboty[].komnata - перенос работы в другую комнату;
     udalit_raboty     - [id, ...] - удалённые работы (в Мастерской их больше нет, вернуть может только Александр);
     udalit_foto       - { id работы: [src, ...] } - удалённые фото (src как в данных: "@id" или путь);
     tochki            - { id работы: { src фото: [{ x, y, nazvanie, tekst }] } } - точки-детали на фото (x, y в %);
                         пустой список - убрать точки. Точки 1-го фото живут и в w.tochki (так их читает витрина);
     shrift            - { titul, kartochki } - шрифты титульной страницы и карточек работ (список - vitrina/dizajn2/shrifty.js).
   С 2026-11-24 (быстрый расчёт):
     kalk              - цены быстрого расчёта для клиента (Мастерская, "Цены"; формат и формулы - vitrina/kalk/kalk-ceny.js).
   С 2026-11-27 (дом на фото):
     poryadok          - [id комнаты, ...] - порядок комнат в доме сверху вниз (остальные - следом, как были);
     titul             - { id комнаты: src фото } - титульное фото комнаты в доме ("@id" или путь; пустая строка - снова
                         первое фото первой работы). Фото должно быть у работы этой комнаты, иначе берётся первое.
   Функция меняет V на месте и возвращает счётчики. */
(function (root) {
  "use strict";
  function apply(V, P, warn) {
    var cnt = { raboty: 0, foto: 0, video: 0, skryto: 0, udaleno: 0 };
    if (!V || !P) return cnt;
    var keep = function (o, src) {
      Object.keys(src || {}).forEach(function (k) { if (typeof src[k] === "string" && src[k].trim() !== "") o[k] = src[k].trim(); });
    };
    V.master = V.master || {}; V.kontakty = V.kontakty || {}; V.video = V.video || []; V.raboty = V.raboty || [];
    keep(V.master, P.master); keep(V.kontakty, P.kontakty);
    if (P.logo) V.master.logo = P.logo;
    V.komnaty = V.komnaty || [];
    // точки 1-го фото: в исходных данных они у работы (w.tochki) - переносим на само фото, чтобы удаление и перестановка
    // фото не пересаживали их на другое фото; в конце возвращаем в w.tochki
    V.raboty.forEach(function (w) { var f0 = w && w.foto && w.foto[0]; if (f0 && !f0.tochki && w.tochki && w.tochki.length) f0.tochki = w.tochki; });
    var KM = P.komnaty && typeof P.komnaty === "object" ? P.komnaty : null, svoi = {};
    if (KM) {
      var changed = false;
      (KM.novye || []).forEach(function (k) {
        if (!k || !k.id || !String(k.nazvanie || "").trim()) return;
        if (V.komnaty.some(function (x) { return x.id === k.id; })) return;
        var nk = { id: k.id, nazvanie: String(k.nazvanie).trim(), hint: String(k.hint || "").trim() };
        var at = -1; if (k.posle) V.komnaty.forEach(function (x, j) { if (x.id === k.posle) at = j; });
        if (k.posle === "^") V.komnaty.unshift(nk); else if (at >= 0) V.komnaty.splice(at + 1, 0, nk); else V.komnaty.push(nk);
        svoi[k.id] = 1; changed = true;
      });
      var del = {}; (KM.udalit || []).forEach(function (id) { del[id] = 1; });
      if (Object.keys(del).length && V.komnaty.some(function (k) { return !del[k.id]; })) {
        var n0 = V.komnaty.length; V.komnaty = V.komnaty.filter(function (k) { return !del[k.id]; }); if (V.komnaty.length !== n0) changed = true;
      }
      // раскладка этажей посчитается заново по порядку списка (у старых комнат были свои col/row)
      if (changed) V.komnaty.forEach(function (k) { delete k.col; delete k.row; delete k.span; });
    }
    var rooms = {}; V.komnaty.forEach(function (k) { rooms[k.id] = k; });
    var vids = {}; V.video.forEach(function (v) { if (v.fajl) vids[v.fajl] = 1; });
    function addVideo(list, w) {
      (list || []).forEach(function (v) {
        if (!v || !v.fajl || vids[v.fajl]) return; vids[v.fajl] = 1;
        V.video.unshift({ nazvanie: w.nazvanie || "Видео", fajl: v.fajl, oblozhka: v.oblozhka || "", rabota: w.id });
      });
    }
    // новые работы: в начало списка, порядок как у мастера (первая в списке - первая на витрине)
    (P.novye_raboty || []).slice().reverse().forEach(function (r) {
      if (!r || !r.id) return;
      var komnata = rooms[r.komnata] ? r.komnata : (V.komnaty && V.komnaty[0] ? V.komnaty[0].id : "");
      var room = rooms[komnata];
      var foto = (r.foto || []).filter(function (f) { return f && f.src; }).map(function (f) { return { src: f.src, znak: true }; });
      if (!foto.length) foto = (r.video || []).filter(function (v) { return v && v.oblozhka; }).slice(0, 1).map(function (v) { return { src: v.oblozhka, znak: true }; });
      var w = { id: r.id, komnata: komnata, vid: room ? room.nazvanie : "", nazvanie: r.nazvanie || "Новая работа", gde: "", kogda: "", srok: "", material: "", cena: "", rasskaz: r.rasskaz || "", foto: foto };
      ["material", "cvet", "razmery", "god"].forEach(function (k) { if (typeof r[k] === "string" && r[k].trim()) w[k] = r[k].trim(); });
      var i = -1; V.raboty.forEach(function (x, j) { if (x.id === r.id) i = j; });
      if (i >= 0) V.raboty[i] = Object.assign(V.raboty[i], w); else { V.raboty.unshift(w); cnt.raboty++; }
      cnt.foto += foto.length; cnt.video += (r.video || []).length; addVideo(r.video, w);
    });
    (P.k_rabotam || []).forEach(function (r) {
      var w = null; V.raboty.forEach(function (x) { if (x.id === r.rabota) w = x; });
      if (!w) { if (warn) warn("нет работы " + r.rabota + " - пропускаю"); return; }
      if (typeof r.nazvanie === "string" && r.nazvanie.trim()) w.nazvanie = r.nazvanie.trim();
      if (typeof r.rasskaz === "string" && r.rasskaz.trim()) w.rasskaz = r.rasskaz.trim();
      if (r.komnata && rooms[r.komnata]) { w.komnata = r.komnata; w.vid = rooms[r.komnata].nazvanie; }
      ["material", "cvet", "razmery", "god"].forEach(function (k) { if (typeof r[k] === "string") { if (r[k].trim()) w[k] = r[k].trim(); else delete w[k]; } });
      w.foto = w.foto || [];
      var have = {}; w.foto.forEach(function (f) { have[f.src] = 1; });
      (r.foto || []).forEach(function (f) { if (f && f.src && !have[f.src]) { have[f.src] = 1; w.foto.push({ src: f.src, znak: true }); cnt.foto++; } });
      cnt.video += (r.video || []).length; addVideo(r.video, w);
    });
    if (P.skryt && P.skryt.length) {
      var hide = {}; P.skryt.forEach(function (id) { hide[id] = 1; });
      var n = V.raboty.length;
      V.raboty = V.raboty.filter(function (w) { return !hide[w.id]; });
      V.video = V.video.filter(function (v) { return !hide[v.rabota]; });
      cnt.skryto = n - V.raboty.length;
    }
    if (P.udalit_raboty && P.udalit_raboty.length) {
      var gone = {}; P.udalit_raboty.forEach(function (id) { gone[id] = 1; });
      var n1 = V.raboty.length;
      V.raboty = V.raboty.filter(function (w) { return !gone[w.id]; });
      V.video = V.video.filter(function (v) { return !gone[v.rabota]; });
      cnt.udaleno = n1 - V.raboty.length;
    }
    var UF = P.udalit_foto && typeof P.udalit_foto === "object" ? P.udalit_foto : null;
    if (UF) V.raboty.forEach(function (w) {
      var d = UF[w.id]; if (!d || !d.length || !w.foto) return;
      var dd = {}; d.forEach(function (s) { dd[s] = 1; });
      w.foto = w.foto.filter(function (f) { return !(f && dd[f.src]); });
    });
    var TP = P.tochki && typeof P.tochki === "object" ? P.tochki : null;
    if (TP) V.raboty.forEach(function (w) {
      var m = TP[w.id]; if (!m || typeof m !== "object") return;
      (w.foto || []).forEach(function (f) {
        if (!f || !f.src || !Array.isArray(m[f.src])) return;
        f.tochki = m[f.src].filter(function (t) { return t && isFinite(t.x) && isFinite(t.y) && String(t.nazvanie || "").trim(); }).map(function (t) {
          return { x: Math.max(0, Math.min(100, +t.x)), y: Math.max(0, Math.min(100, +t.y)), nazvanie: String(t.nazvanie).trim(), tekst: String(t.tekst || "").trim() };
        });
      });
    });
    V.raboty.forEach(function (w) { var f0 = w.foto && w.foto[0]; w.tochki = (f0 && f0.tochki) || []; });
    if (KM) {
      // работы из удалённых комнат (не перенесённые мастером) - в первую комнату; свои пустые комнаты клиенту не показываем
      var first = V.komnaty[0];
      V.raboty.forEach(function (w) { if (first && !rooms[w.komnata]) { w.komnata = first.id; w.vid = first.nazvanie; } });
      var used = {}; V.raboty.forEach(function (w) { used[w.komnata] = 1; });
      V.komnaty = V.komnaty.filter(function (k) { return !svoi[k.id] || used[k.id]; });
    }
    if (P.kalk && typeof P.kalk === "object") V.kalk = JSON.parse(JSON.stringify(P.kalk));
    // порядок комнат в доме (сверху вниз) и титульные фото комнат - см. описание формата вверху
    if (Array.isArray(P.poryadok)) {
      var po = P.poryadok.filter(function (id) { return typeof id === "string" && rooms[id]; });
      if (po.length) V.poryadok = po;
    }
    if (P.titul && typeof P.titul === "object") V.komnaty.forEach(function (k) {
      var t = P.titul[k.id]; if (typeof t !== "string") return;
      // только фото, которое ещё есть у работы этой комнаты (фото удалили или работу перенесли - снова первое фото)
      var ok = t && V.raboty.some(function (w) { return w.komnata === k.id && (w.foto || []).some(function (f) { return f && f.src === t; }); });
      if (ok) k.titul = t; else delete k.titul;
    });
    if (P.shrift && typeof P.shrift === "object") V.shrift = { titul: String(P.shrift.titul || ""), kartochki: String(P.shrift.kartochki || "") };
    var F = P.fon;
    if (F && typeof F === "object") {
      if (F.tip === "video" && (F.video || F.video_tel)) {
        V.fon = { video: F.video || F.video_tel, video_tel: F.video_tel || F.video, kadr: F.kadr || F.kadr_tel || "", kadr_tel: F.kadr_tel || F.kadr || "" };
      } else if (F.tip === "foto") {
        var fw = null; V.raboty.forEach(function (x) { if (x.id === F.rabota) fw = x; });
        var ff = fw && fw.foto && (fw.foto[F.foto | 0] || fw.foto[0]);
        if (ff && ff.src) V.fon = { kadr: ff.src, kadr_tel: ff.src };
        else if (warn) warn("фон: нет фото работы " + F.rabota + " - остаётся прежний фон");
      }
    }
    return cnt;
  }
  // все ссылки на зашифрованные файлы ("@id") внутри правок - чтобы сборка их не удалила
  function refs(x, out) {
    out = out || {};
    if (typeof x === "string") { if (/^@[0-9a-f]{8,}$/.test(x)) out[x.slice(1)] = 1; }
    else if (Array.isArray(x)) x.forEach(function (y) { refs(y, out); });
    else if (x && typeof x === "object") Object.keys(x).forEach(function (k) { refs(x[k], out); });
    return out;
  }
  var api = { apply: apply, refs: refs };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KrSloj = api;
})(typeof self !== "undefined" ? self : this);
