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
   Функция меняет V на месте и возвращает счётчики. */
(function (root) {
  "use strict";
  function apply(V, P, warn) {
    var cnt = { raboty: 0, foto: 0, video: 0, skryto: 0 };
    if (!V || !P) return cnt;
    var keep = function (o, src) {
      Object.keys(src || {}).forEach(function (k) { if (typeof src[k] === "string" && src[k].trim() !== "") o[k] = src[k].trim(); });
    };
    V.master = V.master || {}; V.kontakty = V.kontakty || {}; V.video = V.video || []; V.raboty = V.raboty || [];
    keep(V.master, P.master); keep(V.kontakty, P.kontakty);
    if (P.logo) V.master.logo = P.logo;
    var rooms = {}; (V.komnaty || []).forEach(function (k) { rooms[k.id] = k; });
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
