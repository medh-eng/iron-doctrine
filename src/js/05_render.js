/* ==== 05 RENDER ==== */
// Canvas, pixel ratio, pre-drawn background layers and the thumb controls.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const uiLayer = document.getElementById('ui');
const FINE_POINTER = window.matchMedia('(pointer: fine)');
const PORTRAIT_TOUCH = window.matchMedia('(orientation: portrait) and (pointer: coarse)');

// Safe-area insets in CSS px, read from the CSS custom properties.
const layout = { x: 0, y: 0, w: 1, h: 1, dpr: 1, safe: { t: 0, r: 0, b: 0, l: 0 } };
const bg = { sky: null, mid: null, midW: 0 };

function readSafeAreas() {
  const cs = getComputedStyle(document.documentElement);
  const px = (n) => parseFloat(cs.getPropertyValue(n)) || 0;
  layout.safe.t = px('--safe-t');
  layout.safe.r = px('--safe-r');
  layout.safe.b = px('--safe-b');
  layout.safe.l = px('--safe-l');
}

function resize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let w = vw;
  let h = vh;
  if (FINE_POINTER.matches) {
    // Desktop: 16:9 letterbox, max 1280 wide, centred.
    w = Math.min(vw, DESKTOP_MAX_W, Math.floor((vh * 16) / 9));
    h = Math.min(vh, Math.floor((w * 9) / 16));
  }
  layout.w = w;
  layout.h = h;
  layout.x = Math.floor((vw - w) / 2);
  layout.y = Math.floor((vh - h) / 2);
  const q = QUALITY[save.settings.quality] || QUALITY.High;
  layout.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR, q.dpr);

  for (const el of [canvas, uiLayer]) {
    el.style.left = layout.x + 'px';
    el.style.top = layout.y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
  }
  canvas.width = Math.round(w * layout.dpr);
  canvas.height = Math.round(h * layout.dpr);
  ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
  readSafeAreas();

  game.portrait = PORTRAIT_TOUCH.matches;
  buildBackground();
  if (screens.cur && screens.cur.layout) screens.cur.layout();
}

// Pre-render static layers once per resize (design/04 §3).
function makeLayer(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * layout.dpr));
  c.height = Math.max(1, Math.round(h * layout.dpr));
  const g = c.getContext('2d');
  g.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
  return { c, g };
}

// A silhouette ridge. With `period`, the frequencies snap to whole cycles so
// the layer tiles seamlessly every `period` px.
function ridge(g, w, h, baseY, amp, seed, color, period) {
  const rng = makeRng(seed);
  let f1 = rng.range(0.004, 0.008);
  let f2 = rng.range(0.012, 0.02);
  if (period) {
    const snap = (f) => (Math.max(1, Math.round((f * period) / (Math.PI * 2))) * Math.PI * 2) / period;
    f1 = snap(f1);
    f2 = snap(f2);
  }
  const p1 = rng.range(0, 6.28);
  const p2 = rng.range(0, 6.28);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) {
    const y = baseY - amp * (0.6 * Math.sin(x * f1 + p1) + 0.4 * Math.sin(x * f2 + p2));
    g.lineTo(x, y);
  }
  g.lineTo(w, h);
  g.closePath();
  g.fill();
}

function buildBackground() {
  const { w, h } = layout;
  const sky = makeLayer(w, h);
  const grad = sky.g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, PAL.skyTop);
  grad.addColorStop(0.45, PAL.sky2);
  grad.addColorStop(0.72, PAL.sky3);
  grad.addColorStop(0.9, PAL.horizon);
  sky.g.fillStyle = grad;
  sky.g.fillRect(0, 0, w, h);
  ridge(sky.g, w, h, h * 0.74, h * 0.07, 11, PAL.ridgeFar);
  bg.sky = sky.c;

  // Mid ridge is twice as wide and repeats every screen width, so it can scroll and wrap.
  bg.midW = w * 2;
  const mid = makeLayer(bg.midW, h);
  ridge(mid.g, bg.midW, h, h * 0.84, h * 0.06, 29, PAL.ridgeMid, w);
  bg.mid = mid.c;
}

// Sky plus a mid ridge scrolled by `offset` px (wraps).
function drawBackground(g, offset) {
  const { w, h } = layout;
  g.drawImage(bg.sky, 0, 0, w, h);
  let off = offset % (bg.midW / 2);
  if (off < 0) off += bg.midW / 2;
  g.drawImage(bg.mid, -off, 0, bg.midW, h);
}

// ---------- grease-pencil glyphs (design/02 §8)
// Unit-space polylines (-1..1). Each control gets its own seeded wobble once,
// so glyphs look hand-drawn but never shimmer.
const GLYPH_SHAPES = {
  left: [[[0.4, -0.55], [-0.45, 0], [0.4, 0.55], [0.4, -0.55]]],
  right: [[[-0.4, -0.55], [0.45, 0], [-0.4, 0.55], [-0.4, -0.55]]],
  up: [[[-0.55, 0.4], [0, -0.45], [0.55, 0.4], [-0.55, 0.4]]],
  down: [[[-0.55, -0.4], [0, 0.45], [0.55, -0.4], [-0.55, -0.4]]],
  pause: [[[-0.3, -0.55], [-0.3, 0.55]], [[0.3, -0.55], [0.3, 0.55]]],
  stop: [[[-0.45, -0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, 0.45], [-0.45, -0.45]]],
  play: [[[-0.35, -0.55], [0.5, 0], [-0.35, 0.55], [-0.35, -0.55]]],
  gear: (() => {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = i % 4 < 2 ? 0.62 : 0.45;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const hub = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      hub.push([Math.cos(a) * 0.18, Math.sin(a) * 0.18]);
    }
    return [pts, hub];
  })(),
  recenter: [[[-0.6, 0], [0.6, 0]], [[0, -0.6], [0, 0.6]], (() => {
    const c = [];
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; c.push([Math.cos(a) * 0.38, Math.sin(a) * 0.38]); }
    return c;
  })()],
};

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function wobbleGlyph(name, seed) {
  const shape = GLYPH_SHAPES[name];
  if (!shape) return null;
  const rng = makeRng(hashStr(name) ^ seed);
  return shape.map((line) => {
    const out = [];
    for (let i = 0; i < line.length; i++) {
      const [x, y] = line[i];
      if (i > 0) {
        // Two in-between points per segment, nudged a little off the line.
        const [px, py] = line[i - 1];
        for (const f of [0.33, 0.66]) {
          out.push(lerp(px, x, f) + rng.range(-0.04, 0.04), lerp(py, y, f) + rng.range(-0.04, 0.04));
        }
      }
      out.push(x + rng.range(-0.03, 0.03), y + rng.range(-0.03, 0.03));
    }
    return out;
  });
}

function strokeGlyph(g, lines, cx, cy, s) {
  g.beginPath();
  for (const pts of lines) {
    g.moveTo(cx + pts[0] * s, cy + pts[1] * s);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(cx + pts[i] * s, cy + pts[i + 1] * s);
  }
  g.stroke();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Ghost mode: 4 s after the last control touch, controls fade to 60%.
function controlsGhost(nowMs) {
  const idle = (nowMs - input.lastControlTouch) / 1000 - CONTROL_GHOST_AFTER;
  return idle <= 0 ? 1 : lerp(1, CONTROL_GHOST_ALPHA, clamp(idle / 0.4, 0, 1));
}

// Draws one control in the smoked-acetate style (design/02 §8).
// The opacity setting scales everything; the default 30% gives the values in the table.
function drawControl(g, c, nowMs, ghost) {
  if (c.hidden) return;
  const k = save.settings.btnOpacity / 0.3;
  const held = !c.disabled && (c.pressCount > 0 || c.held);
  const press = c.disabled ? 0 : held ? 1 : c.releasedAt < 0 ? 0 : clamp(1 - (nowMs - c.releasedAt) / 1000 / CONTROL_RELEASE_TIME, 0, 1);
  const sc = 1 - 0.06 * press;
  const a = ghost * (c.disabled ? 0.6 : 1);
  if (!c.glyphLines && c.glyph) c.glyphLines = wobbleGlyph(c.glyph, hashStr(c.id));

  g.save();
  g.globalAlpha = a;
  let cx, cy, gs;
  if (c.shape === 'circle') {
    cx = c.x; cy = c.y;
    const r = c.r * sc;
    if (press > 0) {
      g.strokeStyle = `rgba(255,178,62,${0.35 * press})`;
      g.lineWidth = 8;
      g.beginPath(); g.arc(cx, cy, r + 3, 0, Math.PI * 2); g.stroke();
    }
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
    gs = r * 0.5;
  } else {
    cx = c.x + c.w / 2; cy = c.y + c.h / 2;
    const w = c.w * sc, h = c.h * sc;
    if (press > 0) {
      g.strokeStyle = `rgba(255,178,62,${0.35 * press})`;
      g.lineWidth = 6;
      roundRect(g, cx - w / 2 - 2, cy - h / 2 - 2, w + 4, h + 4, h / 2 + 2);
      g.stroke();
    }
    roundRect(g, cx - w / 2, cy - h / 2, w, h, Math.min(h / 2, 12));
    gs = h * 0.34;
  }
  // Fill: staff ink at 18% idle, warming to tracer amber at 45% when pressed.
  const fa = clamp(0.18 * k, 0.03, 0.6);
  g.fillStyle = press > 0
    ? `rgba(${Math.round(lerp(34, 255, press))},${Math.round(lerp(48, 178, press))},${Math.round(lerp(63, 62, press))},${lerp(fa, 0.45, press)})`
    : `rgba(34,48,63,${fa})`;
  g.fill();
  // Outline: a dark under-stroke keeps it visible on bright skies, linen on top for dark ground.
  if (c.disabled) g.setLineDash([5, 4]);
  g.lineWidth = 3;
  g.strokeStyle = `rgba(10,12,16,${clamp(0.3 * k, 0.1, 0.6)})`;
  g.stroke();
  g.lineWidth = 1.5;
  g.strokeStyle = c.lit ? PAL.amber : `rgba(230,220,195,${clamp(0.5 * k, 0.15, 1)})`;
  g.stroke();
  if (c.disabled) g.setLineDash([]);

  // Glyph or label at 70%, full when pressed.
  const ga = clamp(lerp(0.7 * k, 1, press), 0.25, 1);
  const col = c.lit ? '255,178,62' : '230,220,195';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (c.glyphLines) {
    g.lineWidth = 4;
    g.strokeStyle = `rgba(10,12,16,${ga * 0.45})`;
    strokeGlyph(g, c.glyphLines, cx, cy, gs);
    g.lineWidth = 2.2;
    g.strokeStyle = `rgba(${col},${ga})`;
    strokeGlyph(g, c.glyphLines, cx, cy, gs);
  } else if (c.label) {
    const size = c.shape === 'circle' ? clamp(Math.round(c.r * 0.42), 12, 18) : 14;
    g.font = `700 ${size}px ${FONT_UI}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 3;
    g.strokeStyle = `rgba(10,12,16,${ga * 0.5})`;
    g.strokeText(c.label, cx, cy + 1);
    g.fillStyle = `rgba(${col},${ga})`;
    g.fillText(c.label, cx, cy + 1);
  }
  g.restore();
}

// Reload ring around a round control, progress 0..1.
function drawRing(g, c, progress, ghost) {
  if (c.hidden || progress >= 1) return;
  g.save();
  g.globalAlpha = ghost;
  g.strokeStyle = PAL.amber;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(c.x, c.y, c.r + 5, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  g.stroke();
  g.restore();
}

// Acetate panel (HUD bars).
function drawAcetate(g, x, y, w, h) {
  g.fillStyle = 'rgba(18,24,32,0.62)';
  g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(230,220,195,0.25)';
  g.fillRect(x, y + h - 1, w, 1);
}
