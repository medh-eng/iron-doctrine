/* ==== 05b ART ==== */
// Part art, in order of preference (design/07 §6, design/04 §9):
//   1. SVG from PART_LIBRARY.svg: paint tokens swapped for the side's scheme, then the body
//      and the barrel rasterised separately at SVG_PX pixels per cell;
//   2. the legacy PNG route (design/07_ART_INTEGRATION), below;
//   3. the code drawing in drawPart().
// Legacy PNG art: ART_MANIFEST is embedded by the build from
// src/assets/parts/**/<name>.json. Images load in the background; until one has
// loaded (or if it fails, or its size is wrong) the procedural drawing is used.
// Art is drawn at the part's footprint: canvas scaled by (cell px ÷ pxPerCell),
// with the record's origin pixel on the footprint's top-left corner.

const ART_LIVE_STATUS = ['prepared', 'visually-approved', 'integration-tested'];

const art = {
  byPart: {},          // partId → { meta, img, dmg, barrel, barrelImg }
  version: 0,          // bumps when an image finishes loading, so sprites redraw
  usePlaceholders: false,
  debug: false,        // draw origin, pivot and muzzle markers
  failed: [],

  painted: {},         // paint key → partId → { body, barrel, l, t, W, H, barrelBehind }

  init() {
    this.initSvg();
    this.byPart = {};
    for (const m of ART_MANIFEST) {
      const live = ART_LIVE_STATUS.includes(m.status) || (m.status === 'placeholder' && this.usePlaceholders);
      if (!live) continue;
      const entry = { meta: m, img: null, dmg: null, barrelImg: null };
      const load = (src, size, done) => {
        const im = new Image();
        im.onload = () => {
          if (im.naturalWidth !== size[0] || im.naturalHeight !== size[1]) { this.failed.push(`${src}: size ${im.naturalWidth}×${im.naturalHeight}`); return; }
          done(im);
          this.version++;
        };
        im.onerror = () => this.failed.push(`${src}: failed to load`);
        im.src = src;
      };
      load(m.file, m.canvas, (im) => { entry.img = im; });
      if (m.damaged) load(m.damaged, m.canvas, (im) => { entry.dmg = im; });
      if (m.barrel) load(m.barrel.file, m.barrel.canvas, (im) => { entry.barrelImg = im; });
      this.byPart[m.part] = entry;
    }
  },

  // SVG art for every part that has it, painted for both sides' schemes; other paints (a
  // design's own colours, camouflage) are prepared the first time they're asked for. Images
  // load in the background; `version` bumps as each one is ready, so cached sprites redraw.
  initSvg() {
    this.painted = {};
    for (let side = 0; side < 2; side++) this.prepare(sideScheme(side));
  },

  prepare(paint) {
    const set = {};
    this.painted[paint.key] = set;
    if (typeof DOMParser === 'undefined') return set;
    for (const id of Object.keys(PART_LIBRARY.svg)) {
      const def = PART_LIBRARY.parts[id];
      if (def && PARTS[id]) this.loadSvg(id, def, paintSvg(PART_LIBRARY.svg[id], paint), set);
    }
    return set;
  },

  loadSvg(id, def, text, set) {
    const o = def.overhang || {};
    const l = o.left || 0, t = o.top || 0;
    const W = def.footprint.w + l + (o.right || 0), H = def.footprint.h + t + (o.bottom || 0);
    const root = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
    if (root.nodeName !== 'svg') { this.failed.push(`${id}.svg: not an SVG`); return; }
    root.setAttribute('width', W * SVG_PX);
    root.setAttribute('height', H * SVG_PX);
    const groups = [...root.children].filter((n) => n.nodeName === 'g');
    const isBarrel = (n) => n.getAttribute('data-role') === 'barrel';
    const barrel = groups.find(isBarrel);
    const body = groups.find((n) => n.getAttribute('id') === 'body');
    // A barrel group written before the body sits behind it (document order, design/07 §5.2).
    const entry = { body: null, barrel: null, l, t, W, H, barrelBehind: !!barrel && groups.indexOf(barrel) < groups.indexOf(body) };
    set[id] = entry;
    const raster = (keep, done) => {
      const svg = root.cloneNode(true);
      for (const n of [...svg.children]) if (n.nodeName === 'g' && !keep(n)) svg.removeChild(n);
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = W * SVG_PX; c.height = H * SVG_PX;
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        done(c);
        this.version++;
      };
      im.onerror = () => this.failed.push(`${id}.svg: failed to rasterise`);
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    };
    // The body image holds every group except the barrel (other moving groups stay still for now).
    raster((n) => !isBarrel(n), (c) => { entry.body = c; });
    if (barrel) raster(isBarrel, (c) => { entry.barrel = c; });
  },

  get(partId) {
    const e = this.byPart[partId];
    return e && e.img ? e : null;
  },
};

const SVG_PX = 64;                 // raster pixels per cell for SVG part art
const PAINT_TOKENS = [['#FF00FF', 'p1'], ['#00FFFF', 'p2'], ['#FFFF00', 'p3']];

function paintSvg(text, scheme) {
  for (const [token, k] of PAINT_TOKENS) text = text.split(token).join(scheme[k]).split(token.toLowerCase()).join(scheme[k]);
  return text;
}

// A part's SVG art in a paint ({ p1, p2, p3, key }), or null until it has loaded.
function svgArt(id, paint) {
  const set = art.painted[paint.key] || art.prepare(paint);
  const e = set[id];
  return e && e.body ? e : null;
}

// Whether a part is drawn from art (SVG or PNG) rather than code.
function hasPartArt(id, paint) { return !!(svgArt(id, paint) || art.get(id)); }

// Whether a weapon's SVG barrel sits behind its body, so it's drawn before the vehicle sprite.
function barrelBehind(d, paint) {
  const e = svgArt(d.id, paint);
  return !!(e && e.barrel && e.barrelBehind);
}

// Draw a part's art into a footprint rectangle at (x, y), cell size cs. Returns false if none.
function drawPartArt(g, p, x, y, cs, paint) {
  const S = svgArt(p.def.id, paint);
  if (S) {
    g.drawImage(S.body, x - S.l * cs, y - S.t * cs, S.W * cs, S.H * cs);
    return true;
  }
  const A = art.get(p.def.id);
  if (!A) return false;
  const m = A.meta;
  const k = cs / m.pxPerCell;
  const img = p.scorch > 0.5 && A.dmg ? A.dmg : A.img;
  g.drawImage(img, x - m.origin[0] * k, y - m.origin[1] * k, m.canvas[0] * k, m.canvas[1] * k);
  return true;
}

// Barrel image rotated about its pivot. (px, py) = pivot on screen, ang = world angle, len = barrel length in px.
function drawBarrelArt(g, d, px, py, ang, lenPx, paint) {
  const S = svgArt(d.id, paint);
  const geo = barrelGeometry(d);
  if (S && S.barrel && geo) {
    // SVG barrels are never stretched: pixels per cell come from the pivot-to-muzzle distance.
    const cs = lenPx / geo.len;
    g.save();
    g.translate(px, py);
    g.rotate(-ang);
    if (Math.cos(ang) < 0) g.scale(1, -1);     // keep the top of the barrel up when it points left
    g.drawImage(S.barrel, -(S.l + geo.pivot[0]) * cs, -(S.t + geo.pivot[1]) * cs, S.W * cs, S.H * cs);
    g.restore();
    return true;
  }
  const A = art.byPart[d.id];
  if (!A || !A.barrelImg) return false;
  const b = A.meta.barrel;
  const k = lenPx / Math.max(1, b.muzzle[0] - b.pivot[0]);
  g.save();
  g.translate(px, py);
  g.rotate(-ang);
  if (Math.cos(ang) < 0) g.scale(1, -1);       // keep the top of the barrel up when it points left
  g.drawImage(A.barrelImg, -b.pivot[0] * k, -b.pivot[1] * k, b.canvas[0] * k, b.canvas[1] * k);
  g.restore();
  return true;
}

// Debug markers: black cross = footprint origin, amber = barrel pivot, cyan = muzzle.
function drawArtMarker(g, kind, x, y) {
  g.save();
  g.lineWidth = 2;
  if (kind === 'origin') {
    g.strokeStyle = '#111'; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.moveTo(x, y - 6); g.lineTo(x, y + 6); g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x + 5, y); g.moveTo(x, y - 5); g.lineTo(x, y + 5); g.stroke();
  } else {
    g.strokeStyle = kind === 'pivot' ? PAL.amber : '#1ec8e6';
    g.beginPath(); g.arc(x, y, kind === 'pivot' ? 5 : 7, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
}
