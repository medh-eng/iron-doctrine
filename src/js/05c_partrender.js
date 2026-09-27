/* ==== 05c PART RENDER ==== */
// Structure cells (materials.json) are auto-tiled from their "look" rules (design/07 §4):
// painted or bare fills, a material texture, one light-to-dark overlay over the whole
// shape, bevels and outlines on outside edges, seams between cells, and rivets.
// A port of tools/part-render.js. Drawn only when a sprite is rebuilt, never per frame.
// Paint schemes come from PART_LIBRARY.paints: the player uses league, the enemy directorate.

const TILE_UNITS = 32;             // look sizes are authored at 32 units per cell
const SIDE_SCHEMES = ['league', 'directorate'];
const TILE_OUTLINE = '#14171B', TILE_STEEL_DARK = '#2E3339';
// Slope corners: o 0 = bottom-left filled, 1 = bottom-right, 2 = top-left, 3 = top-right.
const SLOPE_PTS = [
  [[0, 0], [0, 1], [1, 1]],
  [[1, 0], [1, 1], [0, 1]],
  [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [1, 1]],
];
const SLOPE_SOLID = [['bottom', 'left'], ['bottom', 'right'], ['top', 'left'], ['top', 'right']];
const SLOPE_HYP = [[0, 2], [0, 2], [2, 1], [0, 2]];

// Paint (design/07 §3, step 2.8): a design's own paint, or the player's scheme (chosen in the
// Battle Simulator for now); the enemy is the Directorate. { p1, p2, p3, camo, key }.
function playerScheme() { return (save.profile.sim && save.profile.sim.scheme) || SIDE_SCHEMES[0]; }
function resolvePaint(design, side) {
  const S = PART_LIBRARY.paints.schemes;
  const p = (design && design.paint) || { scheme: side === 0 ? playerScheme() : SIDE_SCHEMES[1] };
  const base = S[p.scheme] || S[SIDE_SCHEMES[side] || SIDE_SCHEMES[0]];
  const out = { p1: p.p1 || base.p1, p2: p.p2 || base.p2, p3: p.p3 || base.p3, camo: p.camo || 'none' };
  out.key = out.p1 + out.p2 + out.p3;
  return out;
}
function sideScheme(side) { return resolvePaint(null, side); }

// Camouflage (design/07 §3.2): the second colours are P1 and P2 darkened; P3 accents stay.
function darken(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.round(c * k).toString(16).padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`.toUpperCase();
}
function camoPaint(paint) {
  const out = { p1: darken(paint.p1, 0.66), p2: darken(paint.p2, 0.7), p3: paint.p3, camo: 'none' };
  out.key = out.p1 + out.p2 + out.p3;
  return out;
}

// One path of pattern shapes over the design's grid (cells from (ox, oy), u px per cell).
function camoPath(g, pattern, ox, oy, u, w, h, seed) {
  const rng = makeRng(seed);
  g.beginPath();
  if (pattern === 'bands') {
    for (let x = -h; x < w + h; x += 3.2) { g.moveTo(ox + x * u, oy + h * u); g.lineTo(ox + (x + 1.4) * u, oy + h * u); g.lineTo(ox + (x + 1.4 + h * 0.6) * u, oy); g.lineTo(ox + (x + h * 0.6) * u, oy); g.closePath(); }
  } else if (pattern === 'blotch') {
    for (let k = 0; k < (w * h) / 5; k++) g.ellipse(ox + rng.range(0, w) * u, oy + rng.range(0, h) * u, rng.range(0.6, 1.4) * u, rng.range(0.4, 0.9) * u, rng.range(0, 3), 0, Math.PI * 2);
  } else if (pattern === 'splinter') {
    for (let k = 0; k < (w * h) / 4; k++) {
      const x = rng.range(0, w), y = rng.range(0, h);
      g.moveTo(ox + x * u, oy + y * u); g.lineTo(ox + (x + rng.range(0.8, 2.2)) * u, oy + (y + rng.range(-0.6, 0.6)) * u); g.lineTo(ox + (x + rng.range(0.2, 1.2)) * u, oy + (y + rng.range(0.6, 1.4)) * u); g.closePath();
    }
  } else if (pattern === 'stripes') {
    for (let x = 0; x < w; x += 1.8) g.rect(ox + x * u, oy, 0.6 * u, h * u);
  }
}

function isTiled(id) {
  const m = PART_LIBRARY.materials[id];
  return !!(m && m.look);
}

function tileCellPath(g, c, mat, u) {
  if (mat.shape === 'slope') {
    const p = SLOPE_PTS[c.o || 0];
    g.moveTo((c.x + p[0][0]) * u, (c.y + p[0][1]) * u);
    g.lineTo((c.x + p[1][0]) * u, (c.y + p[1][1]) * u);
    g.lineTo((c.x + p[2][0]) * u, (c.y + p[2][1]) * u);
    g.closePath();
  } else {
    g.rect(c.x * u, c.y * u, u, u);
  }
}

function tileLine(g, x1, y1, x2, y2, col, w) {
  g.strokeStyle = col; g.lineWidth = w;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}

function tileRivet(g, x, y, s) {
  g.fillStyle = TILE_STEEL_DARK; g.beginPath(); g.arc(x, y, 1.15 * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(196,202,208,0.8)'; g.beginPath(); g.arc(x - 0.35 * s, y - 0.35 * s, 0.45 * s, 0, Math.PI * 2); g.fill();
}

function tileTexture(g, c, mat, u, s) {
  const L = mat.look, x = c.x * u, y = c.y * u;
  g.save(); g.beginPath(); tileCellPath(g, c, mat, u); g.clip();
  if (L.kind === 'wood') {
    for (let i = 1; i < 4; i++) tileLine(g, x, y + i * 8 * s, x + u, y + i * 8 * s, 'rgba(110,74,38,0.55)', 0.8 * s);
    tileLine(g, x, y + 2 * s, x + u, y + 2 * s, 'rgba(207,157,99,0.35)', 0.7 * s);
    if ((c.x + c.y) % 2 === 0) tileLine(g, x + 16 * s, y + 8 * s, x + 16 * s, y + 16 * s, 'rgba(110,74,38,0.5)', 0.7 * s);
    g.fillStyle = 'rgba(40,30,20,0.55)';
    g.fillRect(x + 3 * s, y + 4 * s, 1.2 * s, 1.2 * s); g.fillRect(x + 27 * s, y + 20 * s, 1.2 * s, 1.2 * s);
  } else if (L.kind === 'heavy') {
    g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = s; g.strokeRect(x + 4 * s, y + 4 * s, u - 8 * s, u - 8 * s);
    tileLine(g, x + 4 * s, y + 4.8 * s, x + u - 4 * s, y + 4.8 * s, 'rgba(255,255,255,0.18)', 0.8 * s);
  } else if (L.kind === 'composite') {
    for (let k = -1; k < 3; k++) tileLine(g, x + k * 12 * s, y + u, x + k * 12 * s + u, y, 'rgba(0,0,0,0.14)', 0.8 * s);
  } else if (L.kind === 'envelope') {
    for (let r = 8; r < 32; r += 8) tileLine(g, x + r * s, y, x + r * s, y + u, 'rgba(0,0,0,0.12)', 0.7 * s);
    tileLine(g, x, y + 3 * s, x + u, y + 3 * s, 'rgba(255,255,255,0.22)', s);
  } else if (L.kind === 'frame') {
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 7 * s, y + 7 * s, u - 14 * s, u - 14 * s);
    tileLine(g, x + 7 * s, y + 7 * s, x + u - 7 * s, y + u - 7 * s, 'rgba(138,145,153,0.9)', 2.2 * s);
  } else if (L.kind === 'precursor') {
    tileLine(g, x + 6 * s, y + 16 * s, x + u - 6 * s, y + 16 * s, 'rgba(79,209,197,0.55)', s);
    tileLine(g, x + 16 * s, y + 6 * s, x + 16 * s, y + 12 * s, 'rgba(79,209,197,0.35)', 0.8 * s);
  }
  g.restore();
}

// Draw structure cells as one auto-tiled shape. cells: [{ m: materialId, x, y, o }] in grid
// cells; (ox, oy) = screen position of grid cell (0, 0); u = pixels per cell.
function drawStructureCells(g, cells, scheme, ox, oy, u) {
  if (!cells.length) return;
  const mats = PART_LIBRARY.materials;
  const s = u / TILE_UNITS;
  const at = new Map();
  let minY = Infinity, maxY = -Infinity;
  for (const c of cells) { at.set(c.x + ',' + c.y, c); minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y + 1); }
  g.save();
  g.translate(ox, oy);
  g.lineCap = 'butt';
  // 1. base fills and material texture
  for (const c of cells) {
    const mat = mats[c.m], L = mat.look;
    g.fillStyle = L.paintable ? scheme[L.paint || 'p1'] : L.color;
    g.beginPath(); tileCellPath(g, c, mat, u); g.fill();
    tileTexture(g, c, mat, u, s);
  }
  // 2. shared top-left key light: one vertical gradient over the whole structure
  g.save();
  g.beginPath();
  for (const c of cells) tileCellPath(g, c, mats[c.m], u);
  g.clip();
  const gr = g.createLinearGradient(0, minY * u, 0, maxY * u);
  gr.addColorStop(0, 'rgba(255,255,255,0.20)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.36)');
  g.fillStyle = gr;
  g.fillRect(-100000, minY * u, 200000, (maxY - minY) * u);
  g.restore();
  // 3. edges, seams and rivets
  for (const c of cells) {
    const mat = mats[c.m], L = mat.look, o = c.o || 0;
    const x = c.x * u, y = c.y * u;
    const bw = (L.kind === 'heavy' ? 2.4 : 1.6) * s;
    if (mat.shape === 'slope') {
      const p = SLOPE_PTS[o], h = SLOPE_HYP[o];
      const x1 = (c.x + p[h[0]][0]) * u, y1 = (c.y + p[h[0]][1]) * u, x2 = (c.x + p[h[1]][0]) * u, y2 = (c.y + p[h[1]][1]) * u;
      tileLine(g, x1, y1, x2, y2, o < 2 ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)', bw * 1.6);
      tileLine(g, x1, y1, x2, y2, TILE_OUTLINE, s);
    }
    for (const [name, nb, x1, y1, x2, y2] of [
      ['top', at.get(c.x + ',' + (c.y - 1)), x, y, x + u, y],
      ['bottom', at.get(c.x + ',' + (c.y + 1)), x, y + u, x + u, y + u],
      ['left', at.get((c.x - 1) + ',' + c.y), x, y, x, y + u],
      ['right', at.get((c.x + 1) + ',' + c.y), x + u, y, x + u, y + u],
    ]) {
      if (mat.shape === 'slope' && !SLOPE_SOLID[o].includes(name)) continue;
      if (!nb) {
        const inset = bw / 2;
        const dx = name === 'left' ? inset : name === 'right' ? -inset : 0;
        const dy = name === 'top' ? inset : name === 'bottom' ? -inset : 0;
        tileLine(g, x1 + dx, y1 + dy, x2 + dx, y2 + dy, name === 'top' || name === 'left' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)', bw);
        tileLine(g, x1, y1, x2, y2, TILE_OUTLINE, s);
        if (L.rivets) {
          const horiz = name === 'top' || name === 'bottom';
          for (let t = 4; t < 32; t += 8) {
            const rx = horiz ? x1 + t * s : x1 + (name === 'left' ? 3.2 : -3.2) * s;
            const ry = horiz ? y1 + (name === 'top' ? 3.2 : -3.2) * s : y1 + t * s;
            tileRivet(g, rx, ry, s);
          }
        }
      } else if (nb.m !== c.m) {
        if (name === 'bottom' || name === 'right') tileLine(g, x1, y1, x2, y2, 'rgba(0,0,0,0.38)', 0.9 * s);
      } else {
        const seam = L.seam || 2;
        if (name === 'right' && (c.x + 1) % seam === 0) tileLine(g, x1, y1, x2, y2, 'rgba(0,0,0,0.24)', 0.7 * s);
        if (name === 'bottom' && (c.y + 1) % seam === 0) tileLine(g, x1, y1, x2, y2, 'rgba(0,0,0,0.24)', 0.7 * s);
      }
    }
  }
  g.restore();
}

// Draw a list of placed parts: auto-tiled structure first (as one shape, so seams and edges
// join up), then every other part on top. items: [{ p: { def, scorch }, x, y, seed }] with
// x, y in grid cells. Structure cells still get their own damage marks.
function drawPlacedParts(g, items, side, ox, oy, cs, paint = sideScheme(side)) {
  const cells = [];
  for (const it of items) if (isTiled(it.p.def.id)) cells.push({ m: it.p.def.id, x: it.x, y: it.y, o: 0 });
  drawStructureCells(g, cells, paint, ox, oy, cs);
  for (const it of items) {
    if (isTiled(it.p.def.id)) drawPartDamage(g, it.p, ox + it.x * cs, oy + it.y * cs, cs, it.seed);
  }
  for (const it of items) {
    if (!isTiled(it.p.def.id)) drawPart(g, it.p, ox + it.x * cs, oy + it.y * cs, cs, side, it.seed, paint);
  }
}

// Placed parts in their paint, with camouflage over the P1 and P2 areas: the parts are drawn a
// second time in the darker camouflage colours, cut to the pattern, and laid on top. Anything
// not painted is the same in both, so only painted areas change. w, h: the grid in cells.
function drawPainted(g, items, side, ox, oy, cs, paint, w, h, seed) {
  drawPlacedParts(g, items, side, ox, oy, cs, paint);
  if (!paint.camo || paint.camo === 'none') return;
  const cp = camoPaint(paint);
  // Wait for the camouflage-coloured art; the sprite is redrawn when it arrives.
  if (!items.every((it) => !PART_LIBRARY.svg[it.p.def.id] || svgArt(it.p.def.id, cp))) return;
  const c2 = document.createElement('canvas');
  c2.width = g.canvas.width; c2.height = g.canvas.height;
  const g2 = c2.getContext('2d');
  drawPlacedParts(g2, items, side, ox, oy, cs, cp);
  g2.globalCompositeOperation = 'destination-in';
  camoPath(g2, paint.camo, ox, oy, cs, w, h, seed);
  g2.fillStyle = '#000';
  g2.fill();
  g.drawImage(c2, 0, 0);
}
