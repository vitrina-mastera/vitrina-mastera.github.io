/* Служебный работник закрытой витрины: отдаёт расшифрованные фото по адресу f/<id>.jpg.
   Берёт зашифрованный enc/<id>.bin и ключ из IndexedDB (его кладёт zamok.js после ввода пин-кода).
   Нет ключа - нет фото. Все остальные запросы не трогает. */
"use strict";
var BASE = self.registration.scope; // .../krasnodar/
var memo = new Map(), MAX = 60;

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

function getKey() {
  return new Promise(function (ok) {
    var r = indexedDB.open("kr-zamok", 1);
    r.onupgradeneeded = function () { r.result.createObjectStore("k"); };
    r.onerror = function () { ok(null); };
    r.onsuccess = function () {
      try {
        var q = r.result.transaction("k").objectStore("k").get("aes");
        q.onsuccess = function () { ok(q.result || null); };
        q.onerror = function () { ok(null); };
      } catch (e) { ok(null); }
    };
  });
}
function mime(buf) {
  var u = new Uint8Array(buf, 0, Math.min(16, buf.byteLength));
  if (u[0] === 0x89 && u[1] === 0x50) return "image/png";
  if (u[8] === 0x57 && u[9] === 0x45 && u[10] === 0x42 && u[11] === 0x50) return "image/webp";
  if (u[4] === 0x66 && u[5] === 0x74 && u[6] === 0x79 && u[7] === 0x70) return "video/mp4"; // ....ftyp
  if (u[0] === 0x1A && u[1] === 0x45 && u[2] === 0xDF && u[3] === 0xA3) return "video/webm";
  if (u[0] === 0x3C) return "image/svg+xml"; // "<svg" или "<?xml"
  return "image/jpeg";
}
function photo(id) {
  // ключ читаем каждый раз заново: после "Выйти" или нового пина старый не должен работать
  return getKey().then(function (rec) {
    if (!rec || !rec.key) { memo.clear(); throw new Error("нет ключа"); }
    var c = memo.get(id);
    if (c && c.salt === rec.salt) return c;
    return fetch(BASE + "enc/" + id + ".bin").then(function (r) {
      if (!r.ok) throw new Error("нет файла");
      return r.arrayBuffer();
    }).then(function (buf) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(buf, 0, 12) }, rec.key, new Uint8Array(buf, 12));
    }).then(function (plain) {
      var it = { body: plain, type: mime(plain), salt: rec.salt };
      memo.set(id, it);
      if (memo.size > MAX) memo.delete(memo.keys().next().value);
      return it;
    });
  });
}

self.addEventListener("message", function (e) { if (e.data === "kr-forget") { memo.clear(); } });

self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (u.href.indexOf(BASE + "f/") !== 0) return;
  var m = /f\/([0-9a-f]{8,})\.jpg$/.exec(u.pathname);
  if (!m) return;
  var range = e.request.headers.get("range");
  e.respondWith(photo(m[1]).then(function (it) {
    // видео: Safari просит файл кусками (Range) и без ответа 206 не играет
    var r = range && /^bytes=(\d*)-(\d*)$/.exec(range), n = it.body.byteLength;
    if (r && (r[1] || r[2])) {
      var a = r[1] ? +r[1] : Math.max(0, n - +r[2]), b = r[1] && r[2] ? Math.min(+r[2], n - 1) : n - 1;
      if (a >= n || a > b) return new Response("", { status: 416, headers: { "Content-Range": "bytes */" + n } });
      return new Response(it.body.slice(a, b + 1), { status: 206, headers: { "Content-Type": it.type, "Content-Range": "bytes " + a + "-" + b + "/" + n, "Content-Length": String(b - a + 1), "Accept-Ranges": "bytes", "Cache-Control": "no-store" } });
    }
    return new Response(it.body.slice(0), { headers: { "Content-Type": it.type, "Accept-Ranges": "bytes", "Cache-Control": "no-store" } });
  }).catch(function () {
    return new Response("", { status: 403 });
  }));
});
