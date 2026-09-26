/* ==== 10c NAVAL WEAPONS ==== */
// Torpedoes and depth charges (design/01 §7.4, design/05 §3), fired with Alt.
// A torpedo runs straight at a set depth and bursts against a hull below the
// waterline; a depth charge rolls off the stern, sinks, and bursts at its set depth.
// Both do their damage with the ordinary blast, so holed hull parts flood.

const torpedoes = makePool(() => ({ alive: false, x: 0, y: 0, vy: 0, dir: 1, depth: 0, t: 0, life: 0, shooter: null, side: 0, bub: 0 }), 12);
const charges = makePool(() => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, depth: 0, t: 0, shooter: null, side: 0 }), 16);

// Guns can't fire with their mount under water (a submerged submarine's deck gun).
function gunUnderWater(B, V, w) {
  if (!V.hull || !seaAt(B.T, V.body.x)) return false;
  weaponPivot(V, w, _p);
  return _p.y < B.T.sea;
}

// Battlefield range for engaging: the main gun, or a torpedo tube.
function engageRange(V) {
  const mw = mainWeapon(V);
  let r = mw ? weaponRange(mw.def) : 0;
  for (const w of V.weapons) if (w.def.secondary === 'torpedo' && w.rounds > 0 && V.parts[w.part].alive) r = Math.max(r, weaponRange(w.def) * 0.9);
  if (!r && V.weapons.length) r = weaponRange(V.weapons[0].def);
  return r;
}

// Depth a torpedo should run at to hit U: just above its keel; with no ship to aim at,
// the launch depth (at least 1.5 m down).
function runDepth(B, U, launchY) {
  const T = B.T;
  if (U && U.hull && seaAt(T, U.body.x)) return Math.min(T.sea - 0.6, U.body.y - (U.com.y - 0.6));
  return Math.min(launchY, T.sea - 1.5);
}

function launchTorpedo(B, V, w, tgt) {
  if (w.rounds <= 0 || w.reload > 0) return false;
  weaponPivot(V, w, _p);
  const t = torpedoes.take();
  const face = tgt ? (tgt.body.x >= V.body.x ? 1 : -1) : V.dir;
  t.x = _p.x + face * w.def.w * CELL;
  t.y = _p.y;
  t.vy = 0;
  t.dir = face;
  t.depth = runDepth(B, tgt, _p.y);
  t.t = 0;
  t.life = weaponRange(w.def) / TORPEDO.speed;
  t.shooter = V; t.side = V.side; t.bub = 0;
  w.rounds--;
  w.reload = w.def.reload;
  V.revealT = Math.max(V.revealT, 2);
  audio.sfx('torpedo', B.panOf(t.x));
  if (V === B.me) haptic('fire');
  return true;
}

function dropCharge(B, V, w, depth) {
  if (w.rounds <= 0 || w.reload > 0) return false;
  weaponPivot(V, w, _p);
  const c = charges.take();
  c.x = _p.x - V.dir * 0.4; c.y = _p.y + 0.2;
  c.vx = V.body.vx - V.dir * 1.5; c.vy = 1;
  c.depth = depth; c.t = 0;
  c.shooter = V; c.side = V.side;
  w.rounds--;
  w.reload = w.def.reload;
  audio.sfx('tap', B.panOf(c.x));
  return true;
}

// The player's Alt button: a torpedo at the target, or depth charges over a submarine.
// Returns a short reason when nothing can be fired.
function playerSecondary(B) {
  const V = B.me;
  const list = V.weapons.filter((w) => w.def.secondary && V.parts[w.part].alive);
  if (!list.length) return 'No secondary weapon';
  const bomb = list.find((w) => w.def.secondary === 'bomb' && w.rounds > 0) || list.find((w) => w.def.secondary === 'bomb');
  if (bomb) {
    if (bomb.rounds <= 0) return 'Out of bombs';
    if (bomb.reload > 0) return 'Reloading';
    dropBomb(B, V, bomb);
    return '';
  }
  const tgt = autoTarget(B);
  const sub = nearestTarget(B, V, 40, (U) => !!U.ballast);
  const dc = list.find((w) => w.def.secondary === 'depth' && w.rounds > 0);
  const tp = list.find((w) => w.def.secondary === 'torpedo' && w.rounds > 0);
  if (dc && (sub || !tp)) {
    if (dc.reload > 0) return 'Reloading';
    if (!seaAt(B.T, V.body.x)) return 'Not at sea';
    dropCharge(B, V, dc, sub ? sub.body.y : B.T.sea - DEPTH_CHARGE.depth);
    return '';
  }
  if (tp) {
    if (tp.reload > 0) return 'Reloading';
    if (!seaAt(B.T, V.body.x)) return 'Not at sea';
    launchTorpedo(B, V, tp, tgt);
    return '';
  }
  return 'Out of torpedoes and charges';
}

// AI use: torpedoes at ships and submarines in range, depth charges over a spotted submarine.
function aiSecondary(B, V, w) {
  if (w.rounds <= 0 || w.reload > 0 || V.destroyed || (B.cfg.holdFire && V.side === 1) || !seaAt(B.T, V.body.x)) return;
  const ai = V.ai;
  if (w.def.secondary === 'torpedo') {
    const tgt = ai && ai.target;
    if (!tgt || tgt.destroyed || !tgt.seen || !tgt.hull || ai.react > 0) return;
    if (Math.abs(tgt.body.x - V.body.x) > weaponRange(w.def) * 0.9) return;
    launchTorpedo(B, V, w, tgt);
  } else {
    const sub = nearestTarget(B, V, 12, (U) => !!U.ballast && U.body.y < V.body.y);
    if (sub) dropCharge(B, V, w, sub.body.y);
  }
}

// Underwater burst: the ordinary blast (holes flood), a white column on the surface.
function underwaterBurst(B, x, y, dmg, radius, source) {
  explode(B, x, y, dmg, radius, source);
  if (y > B.T.sea - radius * 1.5) fxSplash(B, x, B.T.sea, 2.5);
  B.trauma = Math.min(1, B.trauma + 0.2);
}

function stepUnderwater(B, dt) {
  const T = B.T;
  torpedoes.forEachAlive((t) => {
    t.t += dt;
    if (t.t > t.life || !seaAt(T, t.x) || t.x < 1 || t.x > T.length - 1) { t.alive = false; return; }
    // Falls in from a deck tube, then runs level at its set depth.
    if (t.y > T.sea) { t.vy -= GRAVITY * dt; t.y += t.vy * dt; t.x += t.dir * 4 * dt; return; }
    t.vy = 0;
    t.x += t.dir * TORPEDO.speed * dt;
    t.y += clamp(t.depth - t.y, -TORPEDO.depthRate * dt, TORPEDO.depthRate * dt);
    t.bub += dt;
    if (t.bub > 0.08) { t.bub = 0; const p = spawnParticle(FX_BUBBLE, t.x - t.dir * 0.8, t.y, 0, 0.8, 0.9, 0.18); if (p) p.grow = 0.1; }
    if (t.y <= T.height(t.x) + 0.2) { t.alive = false; underwaterBurst(B, t.x, t.y, TORPEDO.dmg, TORPEDO.radius, t.shooter); return; }
    for (const V of B.units) {
      if (V === t.shooter && t.t < 1.5) continue;
      if (V.gone || (V.side === t.side && !V.destroyed)) continue;
      if (Math.abs(V.body.x - t.x) > V.radius || Math.abs(V.body.y - t.y) > V.radius) continue;
      worldToGrid(V, t.x + t.dir * 0.4, t.y, _g0);
      const cx = Math.floor(_g0.x / CELL), cy = V.design.h - 1 - Math.floor(_g0.y / CELL);
      if (cx < 0 || cy < 0 || cx >= V.design.w || cy >= V.design.h || V.grid[cy * V.design.w + cx] < 0) continue;
      t.alive = false;
      if (t.shooter === B.me || V === B.me) floatText('Torpedo hit', t.x, T.sea + 2, true);
      underwaterBurst(B, t.x, t.y, TORPEDO.dmg, TORPEDO.radius, t.shooter);
      return;
    }
  });
  charges.forEachAlive((c) => {
    c.t += dt;
    if (c.y > T.sea || !seaAt(T, c.x)) {
      c.vy -= GRAVITY * dt;
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (seaAt(T, c.x) && c.y <= T.sea) { fxSplash(B, c.x, T.sea, 0.6); c.vx *= 0.2; }
      else if (c.y <= T.height(c.x)) { c.alive = false; }
      return;
    }
    c.vx *= 1 - 2 * dt;
    c.x += c.vx * dt;
    c.y -= DEPTH_CHARGE.sink * dt;
    let hit = c.y <= c.depth || c.y <= T.height(c.x) + 0.3 || c.t > 20;
    for (const V of B.units) {
      if (hit) break;
      if (V.gone || V.side === c.side || V.destroyed) continue;
      if (Math.abs(V.body.x - c.x) < V.len / 2 && Math.abs(V.body.y - c.y) < 1) hit = true;
    }
    if (hit) { c.alive = false; underwaterBurst(B, c.x, c.y, DEPTH_CHARGE.dmg, DEPTH_CHARGE.radius, c.shooter); }
  });
}

// Drawn under the water layer, so they read as under water.
function drawUnderwater(g) {
  const S = view.S;
  torpedoes.forEachAlive((t) => {
    const x = view.sx(t.x), y = view.sy(t.y);
    g.fillStyle = '#2b2f36';
    roundRect(g, x - (t.dir > 0 ? 0.9 : 0.1) * S, y - 0.12 * S, S, 0.24 * S, 0.12 * S); g.fill();
    g.fillStyle = '#9aa06b';
    g.fillRect(x + (t.dir > 0 ? 0 : -0.1) * S, y - 0.1 * S, 0.1 * S, 0.2 * S);
  });
  charges.forEachAlive((c) => {
    const x = view.sx(c.x), y = view.sy(c.y);
    g.fillStyle = '#3a3f47';
    g.fillRect(x - 0.18 * S, y - 0.25 * S, 0.36 * S, 0.5 * S);
    g.fillStyle = PAL.amber;
    g.fillRect(x - 0.18 * S, y - 0.05 * S, 0.36 * S, 0.1 * S);
  });
}
