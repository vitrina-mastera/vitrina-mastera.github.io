/* Рисунки-заглушки вместо фото, пока мастер не прислал свои. Простые интерьеры в SVG:
   по ним видно, как будет выглядеть витрина, и сразу понятно, что это не настоящие фото.
   VitrinaRis(vid) -> адрес картинки (data:image/svg+xml). Виды: kuhnya, shkaf, krovat, prihozhaya, detskaya,
   garderob, их вторые ракурсы (kuhnya2 ...) и detal (крупный план). */
(function () {
  var W = 1200, H = 900, FL = 690; // линия пола
  function r(x, y, w, h, f, ex) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '"' + (ex || "") + "/>"; }
  function room(wall, floor) {
    return '<defs><linearGradient id="wl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + wall[0] + '"/><stop offset="1" stop-color="' + wall[1] + '"/></linearGradient>' +
      '<linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + floor[0] + '"/><stop offset="1" stop-color="' + floor[1] + '"/></linearGradient>' +
      '<radialGradient id="gl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe2a8" stop-opacity=".85"/><stop offset="1" stop-color="#ffe2a8" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="mr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9f0f2"/><stop offset=".5" stop-color="#b9c7cc"/><stop offset="1" stop-color="#dfe7ea"/></linearGradient></defs>' +
      r(0, 0, W, FL, "url(#wl)") + r(0, FL, W, H - FL, "url(#fl)") + r(0, FL, W, 4, "rgba(0,0,0,.08)");
  }
  // ряд фасадов: x, y, ширина, высота, сколько, цвет, ручки (h - гориз., v - вертик., "" - без), рейка
  function fronts(x, y, w, h, n, c, hand, reika) {
    var s = "", fw = w / n;
    for (var i = 0; i < n; i++) {
      var fx = x + i * fw;
      s += r(fx + 2, y + 2, fw - 4, h - 4, c, ' rx="3"');
      if (reika) for (var k = fx + 14; k < fx + fw - 10; k += 16) s += r(k, y + 6, 5, h - 12, "rgba(0,0,0,.09)");
      if (hand === "h") s += r(fx + fw / 2 - 30, y + 14, 60, 6, "#5b4d40", ' rx="3"');
      if (hand === "v") s += r(i % 2 ? fx + 14 : fx + fw - 20, y + h / 2 - 40, 6, 80, "#5b4d40", ' rx="3"');
    }
    return s;
  }
  function glow(cx, cy, rx, ry) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="url(#gl)"/>'; }
  function plant(x) { return r(x, FL - 70, 46, 70, "#c9b9a4", ' rx="6"') + '<ellipse cx="' + (x + 23) + '" cy="' + (FL - 110) + '" rx="46" ry="60" fill="#6f8a63"/><ellipse cx="' + (x + 8) + '" cy="' + (FL - 140) + '" rx="22" ry="36" fill="#7f9b72"/>'; }

  var D = {
    kuhnya: function () {
      return room(["#efe7dc", "#e4d8c8"], ["#b99a7a", "#a3845f"]) +
        r(120, 90, 960, 250, "#f3efe8") + fronts(120, 90, 960, 250, 6, "#f7f4ee", "", true) +
        glow(600, 356, 520, 34) + r(120, 340, 960, 8, "#d8c7ae") +
        r(120, 348, 960, 140, "#efe5d6") + r(470, 380, 260, 80, "#2c2622", ' rx="6"') +
        r(100, 488, 1000, 26, "#e9e5df") + fronts(120, 514, 960, 176, 6, "#3c4a44", "h", false) + r(120, 690, 960, 6, "#2a2622");
    },
    kuhnya2: function () {
      return room(["#ece3d6", "#e0d2bf"], ["#b99a7a", "#a3845f"]) +
        r(0, 140, 700, 300, "#f6f2ec") + fronts(0, 140, 700, 300, 4, "#f7f4ee", "", true) + glow(350, 455, 380, 30) +
        r(0, 470, 760, 30, "#ebe7e1") + fronts(0, 500, 760, 190, 4, "#3c4a44", "h") +
        r(820, 380, 300, 310, "#3c4a44", ' rx="4"') + r(800, 360, 340, 26, "#ebe7e1") + plant(1050);
    },
    shkaf: function () {
      return room(["#e9e3dc", "#ddd3c8"], ["#c4ab8c", "#ad906c"]) +
        r(150, 70, 900, 620, "#d9c9b3") + r(160, 80, 293, 600, "#e8dccb", ' rx="3"') + r(453, 80, 294, 600, "url(#mr)", ' rx="3"') + r(747, 80, 293, 600, "#e8dccb", ' rx="3"') +
        '<path d="M520 110 L600 110 L560 650 L480 650 Z" fill="rgba(255,255,255,.35)"/>' + r(150, 70, 900, 10, "#b8a184") + r(150, 680, 900, 10, "#b8a184") + plant(1080);
    },
    shkaf2: function () {
      var s = room(["#3a332d", "#2e2823"], ["#6b5844", "#5a4938"]) + r(200, 60, 800, 630, "#efe6d8");
      s += r(200, 60, 800, 14, "#cdbfa9") + r(600, 60, 12, 630, "#cdbfa9") + r(220, 160, 370, 8, "#8a7b6a") + r(220, 400, 370, 8, "#8a7b6a");
      for (var i = 0; i < 9; i++) s += r(240 + i * 38, 168, 20, 150 + (i % 3) * 25, ["#7b8b9a", "#b9846a", "#d8c8b0"][i % 3], ' rx="6"');
      for (var j = 0; j < 4; j++) s += r(612, 90 + j * 90, 378, 70, "#e3d6c3", ' rx="3"') + r(770, 120 + j * 90, 60, 6, "#5b4d40", ' rx="3"');
      return s + r(612, 470, 378, 210, "#e8dccb") + glow(600, 80, 380, 40);
    },
    krovat: function () {
      return room(["#d9cfc4", "#cbbfb2"], ["#9c8169", "#866c55"]) +
        r(150, 180, 900, 320, "#8d7a6b", ' rx="10"') + fronts(160, 190, 880, 300, 5, "#9d8a7a", "") + glow(600, 175, 480, 40) +
        r(80, 430, 170, 260, "#efe6d8", ' rx="4"') + r(950, 430, 170, 260, "#efe6d8", ' rx="4"') + r(95, 520, 140, 6, "#5b4d40") + r(965, 520, 140, 6, "#5b4d40") +
        r(260, 470, 680, 130, "#f4efe8", ' rx="18"') + r(250, 590, 700, 100, "#efe6d8", ' rx="4"') + r(330, 380, 220, 110, "#fbf8f3", ' rx="30"') + r(650, 380, 220, 110, "#fbf8f3", ' rx="30"') +
        r(250, 600, 340, 80, "#e3d6c3", ' rx="3"') + r(610, 600, 340, 80, "#e3d6c3", ' rx="3"');
    },
    krovat2: function () {
      return room(["#d9cfc4", "#cbbfb2"], ["#9c8169", "#866c55"]) +
        r(80, 420, 1040, 170, "#f4efe8", ' rx="18"') + r(60, 560, 1080, 130, "#efe6d8", ' rx="4"') +
        r(120, 575, 420, 105, "#e3d6c3", ' rx="3"') + r(120, 640, 470, 40, "#d9c9b3", ' transform="translate(0,40)"') + r(660, 575, 420, 105, "#e3d6c3", ' rx="3"') + r(300, 600, 70, 7, "#5b4d40") + r(840, 600, 70, 7, "#5b4d40");
    },
    prihozhaya: function () {
      return room(["#e6ded3", "#d8cdbf"], ["#8f7f6f", "#7a6a5a"]) +
        r(120, 60, 520, 630, "#c9ab84") + fronts(120, 60, 520, 630, 2, "#d3b892", "v") +
        r(700, 470, 380, 120, "#c9ab84", ' rx="4"') + r(700, 440, 380, 34, "#8a9a8c", ' rx="12"') + r(720, 500, 160, 70, "#d3b892") + r(900, 500, 160, 70, "#d3b892") +
        '<circle cx="890" cy="240" r="130" fill="url(#gl)"/><circle cx="890" cy="240" r="110" fill="url(#mr)" stroke="#f6e3b8" stroke-width="8"/>';
    },
    prihozhaya2: function () {
      return room(["#e6ded3", "#d8cdbf"], ["#8f7f6f", "#7a6a5a"]) + '<circle cx="600" cy="380" r="300" fill="url(#gl)"/><circle cx="600" cy="380" r="250" fill="url(#mr)" stroke="#f6e3b8" stroke-width="14"/>' + r(200, 640, 800, 50, "#c9ab84", ' rx="4"');
    },
    detskaya: function () {
      return room(["#e9f0ec", "#dbe6e0"], ["#c9b49a", "#b39c80"]) +
        r(560, 120, 560, 200, "#ffffff", ' rx="6"') + r(560, 300, 560, 30, "#9fcfbd") + r(560, 120, 560, 24, "#9fcfbd") + r(1080, 120, 30, 570, "#ffffff") +
        r(870, 330, 210, 360, "#f4f7f5") + fronts(870, 330, 210, 360, 1, "#bfe2d5", "h") +
        r(80, 120, 360, 300, "#cfe3f1") + r(255, 120, 10, 300, "#ffffff") + r(70, 470, 420, 24, "#ffffff") + r(90, 494, 18, 196, "#ffffff") + r(452, 494, 18, 196, "#ffffff") + r(330, 494, 120, 150, "#bfe2d5");
    },
    detskaya2: function () {
      return room(["#e9f0ec", "#dbe6e0"], ["#c9b49a", "#b39c80"]) + r(140, 380, 920, 200, "#ffffff", ' rx="10"') + r(160, 400, 880, 90, "#f7f3ee", ' rx="14"') +
        r(150, 590, 900, 90, "#bfe2d5", ' rx="6"') + r(180, 600, 840, 60, "#f7f3ee", ' rx="10"') + r(560, 610, 80, 8, "#5b6b64");
    },
    garderob: function () {
      var s = room(["#2f2a27", "#25211e"], ["#5a4a3c", "#4a3c30"]);
      for (var i = 0; i < 3; i++) {
        var x = 140 + i * 320; s += r(x, 70, 300, 620, "#1a1715") + r(x + 8, 78, 284, 604, "rgba(120,140,150,.25)");
        for (var k = 0; k < 4; k++) s += r(x + 14, 170 + k * 130, 272, 6, "#f3d9a0") + glow(x + 150, 176 + k * 130, 140, 16) + r(x + 70 + (k % 2) * 60, 120 + k * 130, 90, 46, ["#b98a68", "#d9cbb4", "#8b5b45", "#c9b7a0"][k], ' rx="10"');
      }
      return s;
    },
    garderob2: function () {
      return room(["#2f2a27", "#25211e"], ["#5a4a3c", "#4a3c30"]) + r(300, 470, 600, 220, "#e8dccb", ' rx="4"') + r(290, 450, 620, 26, "#1a1715") +
        fronts(300, 476, 600, 214, 3, "#efe4d3", "h") + glow(600, 450, 340, 30) + r(100, 80, 1000, 300, "rgba(120,140,150,.18)");
    },
    detal: function () {
      var s = '<defs><linearGradient id="wd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d5b48d"/><stop offset="1" stop-color="#b08559"/></linearGradient><radialGradient id="gl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe2a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffe2a8" stop-opacity="0"/></radialGradient></defs>' + r(0, 0, W, H, "url(#wd)");
      for (var i = 0; i < 14; i++) s += '<path d="M0 ' + (40 + i * 66) + ' C 300 ' + (10 + i * 66) + ', 800 ' + (90 + i * 66) + ', 1200 ' + (50 + i * 66) + '" stroke="rgba(90,60,30,.12)" stroke-width="3" fill="none"/>';
      return s + r(0, 560, W, 340, "#efe6d8") + r(0, 556, W, 10, "#a37d55") + '<ellipse cx="600" cy="600" rx="560" ry="60" fill="url(#gl)"/>' + r(470, 700, 260, 16, "#4b3f35", ' rx="8"');
    }
  };
  var cache = {};
  window.VitrinaRis = function (vid) {
    vid = D[vid] ? vid : "detal";
    if (cache[vid]) return cache[vid];
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '">' + D[vid]() +
      '<rect x="24" y="24" width="264" height="40" rx="20" fill="rgba(20,17,15,.55)"/><text x="156" y="50" font-family="system-ui,sans-serif" font-size="20" fill="#fff" text-anchor="middle">Пример - здесь будет фото</text></svg>';
    return (cache[vid] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
  };
})();
