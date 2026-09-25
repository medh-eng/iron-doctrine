/* ==== 05b ART ==== */
// Imported part art (design/07 contract). ART_MANIFEST is embedded by the build from
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

  init() {
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

  get(partId) {
    const e = this.byPart[partId];
    return e && e.img ? e : null;
  },
};

// Draw imported art for a part into a footprint rectangle at (x, y), cell size cs. Returns false if none.
function drawPartArt(g, p, x, y, cs) {
  const A = art.get(p.def.id);
  if (!A) return false;
  const m = A.meta;
  const k = cs / m.pxPerCell;
  const img = p.scorch > 0.5 && A.dmg ? A.dmg : A.img;
  g.drawImage(img, x - m.origin[0] * k, y - m.origin[1] * k, m.canvas[0] * k, m.canvas[1] * k);
  return true;
}

// Barrel image rotated about its pivot. (px, py) = pivot on screen, ang = world angle, len = barrel length in px.
function drawBarrelArt(g, d, px, py, ang, lenPx) {
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
