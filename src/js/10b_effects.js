/* ==== 10b EFFECTS ==== */
// The joy layer (design/03 §5): muzzle flashes, sparks, dirt, explosions, smoke,
// fire, shockwave rings. Particles are pooled and capped by the quality setting.

const FX_FLASH = 0, FX_SMOKE = 1, FX_SPARK = 2, FX_DIRT = 3, FX_FIRE = 4, FX_RING = 5, FX_EMBER = 6, FX_SPRAY = 7;

const particles = makePool(() => ({
  alive: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, size: 1, grow: 0, g: 0, shade: 0,
}), 300);

// Smoke screens block spotting for 20 s (design/05 smoke launcher).
const smokeScreens = makePool(() => ({ alive: false, x: 0, y: 0, r: 0, t: 0 }), 12);
// Smoke columns from wrecks: at most 3 at once.
const smokeColumns = makePool(() => ({ alive: false, V: null, t: 0, acc: 0 }), 3);

let particleCount = 0;
function particleCap() { return (QUALITY[save.settings.quality] || QUALITY.High).particles; }

function spawnParticle(kind, x, y, vx, vy, life, size) {
  if (particleCount >= particleCap()) return null;
  const p = particles.take();
  p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.t = 0; p.life = life; p.size = size;
  p.grow = 0; p.g = 0; p.shade = 0;
  return p;
}

function fxMuzzle(B, x, y, ang, cal) {
  const k = cal / 75;
  const f = spawnParticle(FX_FLASH, x, y, 0, 0, 0.07, 1.4 * k + 0.4);
  if (f) f.shade = ang;
  for (let i = 0; i < 3 + k * 3; i++) {
    const a = ang + B.rng.range(-0.5, 0.5);
    const sp = B.rng.range(1, 4) * (0.6 + k);
    const p = spawnParticle(FX_SMOKE, x, y, Math.cos(a) * sp, Math.sin(a) * sp + 0.5, B.rng.range(0.9, 1.6), 0.5 + k * 0.4);
    if (p) { p.grow = 1.2; p.shade = 0.55; }
  }
}

function fxSparks(B, x, y, ang, n) {
  for (let i = 0; i < n; i++) {
    const a = ang + B.rng.range(-0.8, 0.8);
    const sp = B.rng.range(6, 16);
    const p = spawnParticle(FX_SPARK, x, y, Math.cos(a) * sp, Math.sin(a) * sp, B.rng.range(0.15, 0.35), 1);
    if (p) p.g = 1;
  }
  spawnParticle(FX_FLASH, x, y, 0, 0, 0.05, 0.8);
}

// Shell splash on the sea: a white column of spray and a ring (Part 2a).
function fxSplash(B, x, y, size) {
  const n = Math.round(4 + size * 8);
  for (let i = 0; i < n; i++) {
    const p = spawnParticle(FX_SPRAY, x + B.rng.range(-0.3, 0.3) * size, y, B.rng.range(-1.5, 1.5) * size, B.rng.range(4, 11) * Math.sqrt(size), B.rng.range(0.5, 1.1), B.rng.range(0.25, 0.5) * (0.6 + size * 0.4));
    if (p) p.g = 1;
  }
  const r = spawnParticle(FX_RING, x, y, 0, 0, 0.5, 0.4 * size);
  if (r) r.grow = 4 * size;
}

function fxDirt(B, x, y, n) {
  for (let i = 0; i < n; i++) {
    const p = spawnParticle(FX_DIRT, x, y, B.rng.range(-3, 3), B.rng.range(2, 7), B.rng.range(0.6, 1.1), B.rng.range(0.12, 0.3));
    if (p) p.g = 1;
  }
  const s = spawnParticle(FX_SMOKE, x, y + 0.3, 0, 0.6, 1.2, 0.6 + n * 0.05);
  if (s) { s.grow = 1; s.shade = 0.35; }
}

function fxExplosion(B, x, y, size) {
  spawnParticle(FX_FLASH, x, y, 0, 0, 0.09, 2.5 * size);
  const ring = spawnParticle(FX_RING, x, y, 0, 0, 0.35, 0.5);
  if (ring) ring.grow = 7 * size;
  for (let i = 0; i < 6 * size + 4; i++) {
    const a = B.rng.range(0.2, Math.PI - 0.2);
    const sp = B.rng.range(2, 6) * size;
    const f = spawnParticle(FX_FIRE, x, y, Math.cos(a) * sp, Math.sin(a) * sp, B.rng.range(0.35, 0.7), 0.6 * size + 0.3);
    if (f) f.grow = 0.8;
  }
  for (let i = 0; i < 5 * size + 3; i++) {
    const s = spawnParticle(FX_SMOKE, x + B.rng.range(-1, 1) * size, y + B.rng.range(0, 1) * size,
      B.rng.range(-1, 1), B.rng.range(0.5, 2), B.rng.range(1.5, 2.8), 0.8 * size + 0.4);
    if (s) { s.grow = 1.3; s.shade = 0.25; }
  }
  fxDirt(B, x, B.T.height(x) + 0.2, Math.round(4 + size * 4));
}

function fxSmokeColumn(B, V) {
  let n = 0;
  smokeColumns.forEachAlive(() => n++);
  if (n >= 3) {
    // Recycle the oldest column.
    let oldest = null;
    smokeColumns.forEachAlive((c) => { if (!oldest || c.t > oldest.t) oldest = c; });
    if (oldest) oldest.alive = false;
  }
  const c = smokeColumns.take();
  c.V = V; c.t = 0; c.acc = 0;
}

function fxSmokeScreen(B, x, y) {
  const s = smokeScreens.take();
  s.x = x; s.y = y; s.r = 5; s.t = 0;
  for (let i = 0; i < 10; i++) {
    const p = spawnParticle(FX_SMOKE, x + B.rng.range(-4, 4), y + B.rng.range(0, 3), B.rng.range(-0.6, 0.6), B.rng.range(0.1, 0.5), B.rng.range(6, 9), B.rng.range(1.5, 2.6));
    if (p) { p.grow = 0.25; p.shade = 0.75; }
  }
}

function stepEffects(B, dt) {
  particleCount = 0;
  particles.forEachAlive((p) => {
    p.t += dt;
    if (p.t >= p.life) { p.alive = false; return; }
    particleCount++;
    if (p.g) p.vy -= GRAVITY * dt * p.g;
    if (p.kind === FX_SMOKE) { p.vx *= 0.98; p.vy = p.vy * 0.98 + 0.25 * dt; }
    if (p.kind === FX_FIRE) { p.vx *= 0.9; p.vy = p.vy * 0.9 + 3 * dt; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.size += p.grow * dt;
    if (p.kind === FX_DIRT && p.y < B.T.height(p.x)) p.alive = false;
    if (p.kind === FX_SPRAY && p.vy < 0 && seaAt(B.T, p.x) && p.y < B.T.sea) p.alive = false;
  });
  smokeScreens.forEachAlive((s) => {
    s.t += dt;
    s.r = Math.min(9, s.r + dt * 2);
    if (s.t > 20) s.alive = false;
  });
  smokeColumns.forEachAlive((c) => {
    c.t += dt;
    if (c.t > 25) { c.alive = false; return; }
    c.acc += dt;
    if (c.acc > 0.18) {
      c.acc = 0;
      const b = c.V.body;
      const p = spawnParticle(FX_SMOKE, b.x + B.rng.range(-0.6, 0.6), b.y + c.V.height * 0.5, B.rng.range(-0.3, 0.3) + 0.4, B.rng.range(1.2, 2), 5, 0.8);
      if (p) { p.grow = 0.6; p.shade = 0.15; }
      if (c.t < 8 && B.rng.next() < 0.6) {
        const f = spawnParticle(FX_FIRE, b.x + B.rng.range(-0.8, 0.8), b.y + c.V.height * 0.3, 0, 1.2, 0.5, 0.5);
        if (f) f.grow = 0.4;
      }
    }
  });
}

// Is the straight line between two points blocked by a smoke screen?
function smokeBlocks(ax, ay, bx, by) {
  let blocked = false;
  smokeScreens.forEachAlive((s) => {
    if (blocked) return;
    const ex = bx - ax, ey = by - ay;
    const l2 = ex * ex + ey * ey || 1;
    const t = clamp(((s.x - ax) * ex + (s.y - ay) * ey) / l2, 0, 1);
    if (Math.hypot(ax + ex * t - s.x, ay + ey * t - s.y) < s.r) blocked = true;
  });
  return blocked;
}

// Screen shake: trauma model, shake = trauma², capped at 8 px; off with reduced motion.
function shakeOffset(B, out) {
  const s = save.settings.reducedMotion ? 0 : B.trauma * B.trauma * 8;
  out.x = s ? Math.sin(B.time * 71) * s : 0;
  out.y = s ? Math.cos(B.time * 53) * s : 0;
  return out;
}

// ---------- level-clear confetti: 80 paper scraps in linen, blue and amber (screen space)
const CONFETTI_COLORS = ['#E6DCC3', '#2E6DB4', '#FFB23E'];
const confetti = makePool(() => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, a: 0, w: 0, c: 0, t: 0 }), 80);

function spawnConfetti() {
  const rng = makeRng(Math.floor(performance.now()));
  for (let i = 0; i < 80; i++) {
    const p = confetti.take();
    p.x = rng.range(0, layout.w); p.y = rng.range(-layout.h * 0.5, -10);
    p.vx = rng.range(-30, 30); p.vy = rng.range(40, 110);
    p.a = rng.range(0, 6.28); p.w = rng.range(-6, 6); p.c = i % 3; p.t = 0;
  }
}

function stepConfetti(dt) {
  confetti.forEachAlive((p) => {
    p.t += dt;
    p.x += p.vx * dt + Math.sin(p.t * 3 + p.a) * 20 * dt;
    p.y += p.vy * dt;
    p.a += p.w * dt;
    if (p.y > layout.h + 20 || p.t > 6) p.alive = false;
  });
}

function drawConfetti(g) {
  confetti.forEachAlive((p) => {
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.a);
    g.fillStyle = CONFETTI_COLORS[p.c];
    g.fillRect(-4, -2.5 * Math.abs(Math.cos(p.t * 5)) - 0.5, 8, 5 * Math.abs(Math.cos(p.t * 5)) + 1);
    g.restore();
  });
}
