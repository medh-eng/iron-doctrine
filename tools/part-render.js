/* Iron Doctrine part renderer (browser, no dependencies).
 * Used by tools/preview-parts.mjs. The game should port this logic into src/js (design/07 §6):
 *  - component parts are SVG sprites with paint tokens replaced by a scheme
 *  - structure cells are drawn procedurally from materials.json "look" rules (auto-tiling)
 * Units: u = pixels per cell. SVG art is authored at 32 units per cell.
 */
(function (global) {
  'use strict';
  var CELL = 32;
  var TOKENS = [['#FF00FF', 'p1'], ['#00FFFF', 'p2'], ['#FFFF00', 'p3']];
  var C = {
    outline: '#14171B', steelDark: '#2E3339', steelHi: '#C4CAD0', woodLo: '#6E4A26', woodHi: '#CF9D63',
    glow: '#4FD1C5',
  };

  function applyScheme(svg, scheme) {
    var s = svg;
    for (var i = 0; i < TOKENS.length; i++) {
      var hex = TOKENS[i][0];
      var col = scheme[TOKENS[i][1]];
      s = s.split(hex).join(col).split(hex.toLowerCase()).join(col);
    }
    return s;
  }

  function loadImage(svgText) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('SVG failed to load')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    });
  }

  var cache = new Map();
  function partImage(lib, id, scheme) {
    var key = id + '|' + scheme.p1 + scheme.p2 + scheme.p3;
    if (!cache.has(key)) cache.set(key, loadImage(applyScheme(lib.svg[id], scheme)));
    return cache.get(key);
  }

  function overhang(def) {
    var o = def.overhang || {};
    return { l: o.left || 0, r: o.right || 0, t: o.top || 0, b: o.bottom || 0 };
  }

  // Draw a component with its footprint's top-left at cell (x, y). flip mirrors around the footprint centre.
  function drawPart(ctx, img, def, x, y, flip, u) {
    var o = overhang(def);
    var w = def.footprint.w;
    var W = (w + o.l + o.r) * u;
    var H = (def.footprint.h + o.t + o.b) * u;
    ctx.save();
    if (flip) {
      ctx.translate((x + w / 2) * u, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -(w / 2 + o.l) * u, (y - o.t) * u, W, H);
    } else {
      ctx.drawImage(img, (x - o.l) * u, (y - o.t) * u, W, H);
    }
    ctx.restore();
  }

  function expandCells(v) {
    var out = [];
    (v.cells || []).forEach(function (c) {
      var w = c.w || 1; var h = c.h || 1;
      for (var dy = 0; dy < h; dy++) for (var dx = 0; dx < w; dx++) out.push({ m: c.m, x: c.x + dx, y: c.y + dy, o: c.o || 0 });
    });
    return out;
  }

  // Triangle corners for sloped cells: o 0 = bottom-left filled, 1 = bottom-right, 2 = top-left, 3 = top-right.
  function slopePts(c) {
    var x = c.x; var y = c.y;
    return [
      [[x, y], [x, y + 1], [x + 1, y + 1]],
      [[x + 1, y], [x + 1, y + 1], [x, y + 1]],
      [[x, y], [x + 1, y], [x, y + 1]],
      [[x, y], [x + 1, y], [x + 1, y + 1]],
    ][c.o || 0];
  }

  function addCellPath(ctx, c, mat, u) {
    if (mat.shape === 'slope') {
      var p = slopePts(c);
      ctx.moveTo(p[0][0] * u, p[0][1] * u); ctx.lineTo(p[1][0] * u, p[1][1] * u); ctx.lineTo(p[2][0] * u, p[2][1] * u); ctx.closePath();
    } else {
      ctx.rect(c.x * u, c.y * u, u, u);
    }
  }

  function line(ctx, x1, y1, x2, y2, col, w) {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function rivet(ctx, x, y, s) {
    ctx.fillStyle = C.steelDark; ctx.beginPath(); ctx.arc(x, y, 1.15 * s, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(196,202,208,0.8)'; ctx.beginPath(); ctx.arc(x - 0.35 * s, y - 0.35 * s, 0.45 * s, 0, 6.2832); ctx.fill();
  }

  function texture(ctx, c, mat, u, s) {
    var L = mat.look; var x = c.x * u; var y = c.y * u;
    ctx.save(); ctx.beginPath(); addCellPath(ctx, c, mat, u); ctx.clip();
    if (L.kind === 'wood') {
      for (var i = 1; i < 4; i++) line(ctx, x, y + i * 8 * s, x + u, y + i * 8 * s, 'rgba(110,74,38,0.55)', 0.8 * s);
      line(ctx, x, y + 2 * s, x + u, y + 2 * s, 'rgba(207,157,99,0.35)', 0.7 * s);
      if ((c.x + c.y) % 2 === 0) line(ctx, x + 16 * s, y + 8 * s, x + 16 * s, y + 16 * s, 'rgba(110,74,38,0.5)', 0.7 * s);
      ctx.fillStyle = 'rgba(40,30,20,0.55)';
      ctx.fillRect(x + 3 * s, y + 4 * s, 1.2 * s, 1.2 * s); ctx.fillRect(x + 27 * s, y + 20 * s, 1.2 * s, 1.2 * s);
    } else if (L.kind === 'heavy') {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1 * s; ctx.strokeRect(x + 4 * s, y + 4 * s, u - 8 * s, u - 8 * s);
      line(ctx, x + 4 * s, y + 4.8 * s, x + u - 4 * s, y + 4.8 * s, 'rgba(255,255,255,0.18)', 0.8 * s);
    } else if (L.kind === 'composite') {
      for (var k = -1; k < 3; k++) line(ctx, x + k * 12 * s, y + u, x + k * 12 * s + u, y, 'rgba(0,0,0,0.14)', 0.8 * s);
    } else if (L.kind === 'envelope') {
      for (var r = 8; r < 32; r += 8) line(ctx, x + r * s, y, x + r * s, y + u, 'rgba(0,0,0,0.12)', 0.7 * s);
      line(ctx, x, y + 3 * s, x + u, y + 3 * s, 'rgba(255,255,255,0.22)', 1 * s);
    } else if (L.kind === 'frame') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 7 * s, y + 7 * s, u - 14 * s, u - 14 * s);
      line(ctx, x + 7 * s, y + 7 * s, x + u - 7 * s, y + u - 7 * s, 'rgba(138,145,153,0.9)', 2.2 * s);
    } else if (L.kind === 'precursor') {
      line(ctx, x + 6 * s, y + 16 * s, x + u - 6 * s, y + 16 * s, 'rgba(79,209,197,0.55)', 1 * s);
      line(ctx, x + 16 * s, y + 6 * s, x + 16 * s, y + 12 * s, 'rgba(79,209,197,0.35)', 0.8 * s);
    }
    ctx.restore();
  }

  function drawStructure(ctx, cells, lib, scheme, u) {
    if (!cells.length) return;
    var s = u / CELL;
    var map = new Map();
    cells.forEach(function (c) { map.set(c.x + ',' + c.y, c); });
    var at = function (x, y) { return map.get(x + ',' + y); };
    var minY = Infinity; var maxY = -Infinity;
    cells.forEach(function (c) { minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y + 1); });

    // 1. base fills and material texture
    cells.forEach(function (c) {
      var mat = lib.materials[c.m]; var L = mat.look;
      ctx.fillStyle = L.paintable ? scheme[L.paint || 'p1'] : L.color;
      ctx.beginPath(); addCellPath(ctx, c, mat, u); ctx.fill();
      texture(ctx, c, mat, u, s);
    });

    // 2. shared top-left key light: one vertical gradient over the whole structure
    ctx.save();
    ctx.beginPath();
    cells.forEach(function (c) { addCellPath(ctx, c, lib.materials[c.m], u); });
    ctx.clip();
    var g = ctx.createLinearGradient(0, minY * u, 0, maxY * u);
    g.addColorStop(0, 'rgba(255,255,255,0.20)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.36)');
    ctx.fillStyle = g;
    ctx.fillRect(-100000, minY * u, 200000, (maxY - minY) * u);
    ctx.restore();

    // 3. edges, seams and rivets
    cells.forEach(function (c) {
      var mat = lib.materials[c.m]; var L = mat.look;
      var x = c.x * u; var y = c.y * u;
      var bw = (L.kind === 'heavy' ? 2.4 : 1.6) * s;
      if (mat.shape === 'slope') {
        var p = slopePts(c);
        var hyp = [[p[0], p[2]], [p[0], p[2]], [p[2], p[1]], [p[0], p[2]]][c.o || 0];
        var up = (c.o || 0) < 2;
        line(ctx, hyp[0][0] * u, hyp[0][1] * u, hyp[1][0] * u, hyp[1][1] * u, up ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)', bw * 1.6);
        line(ctx, hyp[0][0] * u, hyp[0][1] * u, hyp[1][0] * u, hyp[1][1] * u, C.outline, 1 * s);
      }
      var sides = [
        ['top', at(c.x, c.y - 1), x, y, x + u, y],
        ['bottom', at(c.x, c.y + 1), x, y + u, x + u, y + u],
        ['left', at(c.x - 1, c.y), x, y, x, y + u],
        ['right', at(c.x + 1, c.y), x + u, y, x + u, y + u],
      ];
      sides.forEach(function (sd) {
        var name = sd[0]; var nb = sd[1];
        if (mat.shape === 'slope') {
          var o = c.o || 0;
          var solid = { 0: ['bottom', 'left'], 1: ['bottom', 'right'], 2: ['top', 'left'], 3: ['top', 'right'] }[o];
          if (solid.indexOf(name) < 0) return;
        }
        if (!nb) {
          var inset = bw / 2;
          var col = name === 'top' || name === 'left' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)';
          var dx = name === 'left' ? inset : name === 'right' ? -inset : 0;
          var dy = name === 'top' ? inset : name === 'bottom' ? -inset : 0;
          line(ctx, sd[2] + dx, sd[3] + dy, sd[4] + dx, sd[5] + dy, col, bw);
          line(ctx, sd[2], sd[3], sd[4], sd[5], C.outline, 1 * s);
          if (L.rivets) {
            var horiz = name === 'top' || name === 'bottom';
            for (var t = 4; t < 32; t += 8) {
              var rx = horiz ? sd[2] + t * s : sd[2] + (name === 'left' ? 3.2 : -3.2) * s;
              var ry = horiz ? sd[3] + (name === 'top' ? 3.2 : -3.2) * s : sd[3] + t * s;
              rivet(ctx, rx, ry, s);
            }
          }
        } else if (nb.m !== c.m) {
          if (name === 'bottom' || name === 'right') line(ctx, sd[2], sd[3], sd[4], sd[5], 'rgba(0,0,0,0.38)', 0.9 * s);
        } else {
          var seam = L.seam || 2;
          if (name === 'right' && (c.x + 1) % seam === 0) line(ctx, sd[2], sd[3], sd[4], sd[5], 'rgba(0,0,0,0.24)', 0.7 * s);
          if (name === 'bottom' && (c.y + 1) % seam === 0) line(ctx, sd[2], sd[3], sd[4], sd[5], 'rgba(0,0,0,0.24)', 0.7 * s);
        }
      });
    });
  }

  // Draw a whole vehicle design: back-layer parts, structure, then front-layer parts.
  function drawVehicle(ctx, v, lib, scheme, u) {
    var cells = expandCells(v);
    var parts = v.parts || [];
    var back = parts.filter(function (p) { return (lib.parts[p.p] || {}).layer === 'back'; });
    var front = parts.filter(function (p) { return (lib.parts[p.p] || {}).layer !== 'back'; });
    return Promise.all(parts.map(function (p) { return partImage(lib, p.p, scheme); })).then(function () {
      var draw = function (p) {
        return partImage(lib, p.p, scheme).then(function (img) { drawPart(ctx, img, lib.parts[p.p], p.x, p.y, p.f, u); });
      };
      return back.reduce(function (pr, p) { return pr.then(function () { return draw(p); }); }, Promise.resolve())
        .then(function () { drawStructure(ctx, cells, lib, scheme, u); })
        .then(function () { return front.reduce(function (pr, p) { return pr.then(function () { return draw(p); }); }, Promise.resolve()); });
    });
  }

  global.PartRender = {
    CELL: CELL, applyScheme: applyScheme, loadImage: loadImage, partImage: partImage,
    drawPart: drawPart, drawStructure: drawStructure, drawVehicle: drawVehicle, expandCells: expandCells,
  };
})(typeof window !== 'undefined' ? window : globalThis);
