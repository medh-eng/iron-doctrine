/* ==== 10f DESIGNED MISSILES ==== */
// Missiles built from missile parts in the Missile tab (Part 5b; design/01 §5, §10.5,
// design/05 §3.4): racks and VLS blocks fire the ship's missile design, magazines refill them,
// flares and ECM fight the seekers, and five warheads each leave their own mark.
// Guidance: no seeker = unguided (flies where it was aimed); a radar seeker's lock is helped by
// fire control and radar and cut by ECM, and flares rarely fool it; a heat seeker's lock is
// helped by fire control only, ECM can't touch it, and flares often fool it.

const MISSILE_CLASSES = PART_LIBRARY.classes.missile || [];
const missileClass = (id) => MISSILE_CLASSES.find((c) => c.id === id) || null;

// The player's missile designs sit in save.designs.missiles, beside the library's.
const ownMissiles = () => (save.designs && Array.isArray(save.designs.missiles) ? save.designs.missiles : []);
function missileDesigns() { return [...Object.values(MISSILE_TEMPLATES), ...ownMissiles()]; }
function missileDesign(id) { return MISSILE_TEMPLATES[id] || ownMissiles().find((d) => d.id === id) || null; }
const DEFAULT_MISSILE = 'msl_s_radar';

// Cells as {p, x, y} whether stored as [p, x, y] (library) or objects.
function missileCells(d) { return (d.cells || []).map((c) => (Array.isArray(c) ? { p: c[0], x: c[1], y: c[2] } : c)); }

// Rule problems with a missile design, as plain sentences ([] = it flies).
function validateMissile(d) {
  const out = [];
  const cls = missileClass(d.class);
  if (!cls) return ['Choose a missile size.'];
  const cells = missileCells(d);
  const occ = new Set();
  let motors = 0, seekers = 0;
  const heads = new Set();
  for (const c of cells) {
    const P = PARTS[c.p];
    if (!P || P.cat !== 'missile') { out.push(`${c.p} is not a missile part.`); continue; }
    for (let dy = 0; dy < P.h; dy++) for (let dx = 0; dx < P.w; dx++) {
      const k = `${c.x + dx},${c.y + dy}`;
      if (c.x + dx < 0 || c.y + dy < 0 || c.x + dx >= cls.grid[0] || c.y + dy >= cls.grid[1]) out.push(`${P.name} sticks out of the ${cls.name} grid.`);
      else if (occ.has(k)) out.push(`${P.name} overlaps another part.`);
      occ.add(k);
    }
    if (P.motor) motors++;
    if (P.seeker) { seekers++; if (c.x + P.w !== cls.grid[0]) out.push('The seeker must sit at the nose (the right end).'); }
    if (P.warhead) heads.add(P.warhead);
    if (P.sizes && !P.sizes.includes(cls.id)) out.push(`${P.name} fits ${P.sizes.map((s) => missileClass(s).name).join(', ')} only.`);
  }
  if (cells.length > cls.parts) out.push(`${cells.length} parts; a ${cls.name} holds ${cls.parts}.`);
  if (!motors) out.push('Needs a rocket motor.');
  if (!heads.size) out.push('Needs a warhead.');
  if (heads.size > 1) out.push('All warheads must be the same kind.');
  if (seekers > 1) out.push('One seeker at most.');
  return [...new Set(out)];
}

// A design's flying numbers. Cached on the design object (designs don't change once saved;
// the Missile tab clears the cache while editing).
function missileStats(d) {
  if (d._stats) return d._stats;
  const cls = missileClass(d.class) || MISSILE_CLASSES[0];
  let mass = 0, motors = 0, speed = 0, range = MSL.baseRange, turn = 0, seeker = '', warhead = '', dmg = 0, hp = 0, cost = 0;
  let blast = 0, burn = 0, corrode = 1, time = 0, stun = 0, bomblets = 0, warheadCount = 0;
  for (const c of missileCells(d)) {
    const P = PARTS[c.p];
    if (!P) continue;
    mass += P.mass; hp += P.hp; cost += partCost(P);
    if (P.motor) { motors++; speed = Math.max(speed, P.speed); }
    if (P.range) range += P.range;
    if (P.turn) turn += P.turn;
    if (P.seeker) seeker = P.seeker;
    if (P.warhead) {
      warhead = P.warhead; dmg += P.dmg; warheadCount++;
      blast = Math.max(blast, P.blast || 0); burn = Math.max(burn, P.burn || 0); time = Math.max(time, P.time || 0);
      stun = Math.max(stun, P.stun || 0); bomblets += P.bomblets || 0;
      if (P.corrode) corrode = Math.min(corrode, P.corrode);
    }
  }
  const push = motors ? Math.sqrt((motors * MSL.motorLoad) / Math.max(1, mass)) : 0;
  const top = Math.round(speed * clamp(push, MSL.speedMin, MSL.speedMax));
  const vel = top * MSL.velScale;
  const st = {
    id: d.id, name: d.name, cls: cls.id, units: MSL.units[cls.id] || 1, mass, hp, cost, seeker, warhead, dmg,
    speed: top, vel, range, life: vel ? (range * BATTLE_DISTANCE_SCALE * 1.25) / vel + 0.5 : 0,
    turn: seeker ? MSL.turnScale * turn * Math.min(1, Math.sqrt(150 / Math.max(1, mass))) : 0,
    blast, burn, corrode, time, stun, bomblets, length: cls.grid[0] * 0.22, errors: validateMissile(d),
  };
  // A cluster warhead splits into small HE missiles that keep the parent's seeker.
  if (warhead === 'cluster') st.sub = Object.assign({}, st, { warhead: 'he', dmg: Math.round(dmg / Math.max(1, warheadCount)), blast: Math.max(1.5, blast), vel: vel * 1.1, life: 3, turn: st.turn * 1.2, length: 1.2, units: 1, sub: null });
  Object.defineProperty(d, '_stats', { value: st, configurable: true, enumerable: false });
  return st;
}

// The missile a launcher carries: the ship design's choice if it fits, else the first library
// design that does. Called when the vehicle is built.
function armLauncher(V, w) {
  const sizes = w.def.sizes || ['missile_s'];
  let md = missileDesign(V.design.missile || DEFAULT_MISSILE);
  if (!md || !sizes.includes(md.class) || validateMissile(md).length) md = Object.values(MISSILE_TEMPLATES).find((m) => sizes.includes(m.class)) || null;
  w.msl = md ? missileStats(md) : null;
  w.rounds = w.msl ? Math.floor(w.def.capacity / w.msl.units) : 0;
  if (V.magUnits === undefined) V.magUnits = V.parts.reduce((s, p) => s + (p.def.magazine ? p.def.capacity : 0), 0);
}

// An empty launcher takes one missile from a live magazine, and loads it at double reload time.
function refillLauncher(V, w) {
  if (w.rounds > 0 || !w.msl || !(V.magUnits >= w.msl.units) || w.reload > 0) return;
  if (!V.parts.some((p) => p.alive && p.def.magazine)) { V.magUnits = 0; return; }
  V.magUnits -= w.msl.units;
  w.rounds = 1;
  w.reload = w.def.reload * 2;
}

// Lock chance of V's seeker against U.
function seekerLock(V, U, msl) {
  if (!msl.seeker) return 0;
  const fc = V.fc > 1 ? LOCK_FC : 0;
  if (msl.seeker === 'heat') return clamp(MSL.lock.heat + fc, 0, 0.97);
  const p = MSL.lock.radar + fc + (V.empT > 0 ? 0 : V.radarLock || 0);
  return clamp(p * (U && U.ecm ? 1 - LOCK_ECM : 1), 0, 0.97);
}

function launchDesigned(B, V, w, U) {
  const msl = w.msl;
  if (!msl || w.rounds <= 0 || w.reload > 0 || !U || V.empT > 0) return false;
  weaponPivot(V, w, _p);
  const m = missiles.take();
  m.x = _p.x; m.y = _p.y + 0.3;
  m.kind = 'designed'; m.def = w.def; m.msl = msl; m.target = U; m.t = 0; m.trail = 0;
  m.shooter = V; m.side = V.side; m.B = B; m.fooled = false; m.split = false; m.hot = false;
  m.vert = w.def.vertical ? 0.5 : 0;
  const tx = U.body.x + U.body.vx * 0.6, ty = U.body.y + U.height * 0.4 + U.body.vy * 0.6;
  m.ang = m.vert ? Math.PI / 2 : Math.atan2(ty - m.y, tx - m.x);
  m.locked = !!msl.seeker && B.rng.next() < seekerLock(V, U, msl);
  // A seeker without a lock wanders off by 6–14°; an unguided missile flies true where aimed.
  // (A VLS still leaves straight up; without a lock it simply never turns onto the target.)
  if (msl.seeker && !m.locked) { const off = (B.rng.next() < 0.5 ? -1 : 1) * B.rng.range(0.1, 0.25); if (!m.vert) m.ang += off; }
  w.rounds--;
  w.reload = w.def.reload;
  V.revealT = Math.max(V.revealT, 3);
  B.stats.missiles = (B.stats.missiles || 0) + 1;
  audio.sfx('rocket', B.panOf(m.x));
  if (V === B.me) haptic('fire');
  return true;
}

// Split a cluster missile into its small missiles.
function splitCluster(B, m) {
  const sub = m.msl.sub;
  for (let i = 0; i < m.msl.bomblets; i++) {
    const s = missiles.take();
    s.x = m.x; s.y = m.y; s.kind = 'designed'; s.def = m.def; s.msl = sub; s.target = m.target; s.t = 0; s.trail = 0;
    s.shooter = m.shooter; s.side = m.side; s.B = B; s.fooled = m.fooled; s.fx = m.fx; s.fy = m.fy; s.split = true; s.vert = 0; s.hot = false;
    s.locked = m.locked;
    s.ang = m.ang + (i - (m.msl.bomblets - 1) / 2) * 0.12;
  }
  spawnParticle(FX_FLASH, m.x, m.y, 0, 0, 0.08, 1.2);
  audio.sfx('tap', B.panOf(m.x));
  m.alive = false;
}

// One designed missile, each step (from stepMissiles).
function stepDesigned(B, m, dt) {
  if (m.B !== B) { m.alive = false; return; }
  const M = m.msl, T = B.T, U = m.target;
  m.t += dt;
  if (m.t > M.life || m.x < 0 || m.x > T.length) { m.alive = false; puff(B, m.x, m.y); return; }
  if (m.vert > 0) m.vert -= dt;
  else if (m.locked && m.t > 0.2) {
    // Steer at the target (or the flare that fooled it), within the turn rate.
    let tx, ty;
    if (m.fooled) { m.fy -= 3 * dt; tx = m.fx; ty = m.fy; }
    else if (U && !U.gone && !U.destroyed) { tx = U.body.x + U.body.vx * 0.3; ty = U.body.y + U.height * 0.4 + U.body.vy * 0.3; }
    if (tx !== undefined) {
      let want = Math.atan2(ty - m.y, tx - m.x) - m.ang;
      while (want > Math.PI) want -= Math.PI * 2;
      while (want < -Math.PI) want += Math.PI * 2;
      m.ang += clamp(want, -M.turn * dt, M.turn * dt);
    }
  }
  m.x += Math.cos(m.ang) * M.vel * dt;
  m.y += Math.sin(m.ang) * M.vel * dt;
  m.trail += dt;
  if (m.trail > 0.04) {
    m.trail = 0;
    const p = spawnParticle(FX_SMOKE, m.x - Math.cos(m.ang) * M.length * 0.6, m.y - Math.sin(m.ang) * M.length * 0.6, 0, 0.3, 1.2, 0.3 + M.units * 0.08);
    if (p) { p.grow = 0.7; p.shade = 0.85; }
  }
  if (M.warhead === 'cluster' && !m.split && U && !U.destroyed && Math.hypot(U.body.x - m.x, U.body.y - m.y) < MSL.clusterAt) { splitCluster(B, m); return; }
  if (m.y <= T.height(m.x) || (seaAt(T, m.x) && m.y < T.sea)) {
    m.alive = false;
    if (seaAt(T, m.x) && m.y < T.sea) { fxSplash(B, m.x, T.sea, 1); if (M.warhead !== 'napalm') return; }
    warheadBurst(B, m, m.x, Math.max(m.y, T.height(m.x)), null);
    return;
  }
  for (const V of B.units) {
    if (V.gone || V.destroyed || V.side === m.side) continue;
    const dx = m.x - V.body.x, dy = m.y - (V.body.y + V.height * 0.35);
    if (Math.abs(dx) > V.len * 0.5 + 0.4 || Math.abs(dy) > V.height * 0.6 + 0.4) continue;
    m.alive = false;
    B.stats.missileHits = (B.stats.missileHits || 0) + 1;
    if (m.shooter === B.me || V === B.me) floatText('Missile hit', m.x, m.y + 2, m.shooter === B.me);
    warheadBurst(B, m, m.x, m.y, V);
    return;
  }
}

function puff(B, x, y) {
  const p = spawnParticle(FX_SMOKE, x, y, 0, 0.4, 1, 0.9);
  if (p) { p.grow = 1; p.shade = 0.7; }
}

// ---------- warheads (design/01 §10.5, design/03 §6)
const firePatches = makePool(() => ({ alive: false, x: 0, y: 0, r: 0, t: 0, src: null, B: null, acc: 0 }), 8);

function warheadBurst(B, m, x, y, hit) {
  const M = m.msl;
  B.stats.warheads = B.stats.warheads || {};
  B.stats.warheads[M.warhead] = (B.stats.warheads[M.warhead] || 0) + 1;
  const src = m.shooter;
  switch (M.warhead) {
    case 'napalm': {
      explode(B, x, y, M.dmg, M.blast, src, 'fire');
      if (hit) igniteNear(B, hit, x, y, 2);
      const gy = B.T.height(x);
      if (y - gy < 4 || !hit) {
        const f = firePatches.take();
        f.x = x; f.y = seaAt(B.T, x) ? B.T.sea : gy; f.r = M.blast + 1.5; f.t = M.burn; f.src = src; f.B = B; f.acc = 0;
      }
      for (let i = 0; i < 14; i++) {
        const p = spawnParticle(FX_FIRE, x + B.rng.range(-1.5, 1.5), y + B.rng.range(0, 1), B.rng.range(-4, 4), B.rng.range(1, 6), B.rng.range(0.5, 1.1), B.rng.range(0.8, 1.6));
        if (p) p.g = 0.3;
      }
      break;
    }
    case 'acid': {
      explode(B, x, y, M.dmg, M.blast, src, 'acid');
      for (const V of B.units) {
        if (V.gone || Math.hypot(V.body.x - x, V.body.y - y) > M.blast * 1.5 + V.radius) continue;
        let n = 0;
        V.parts.forEach((p) => {
          if (!p.alive || n >= 8) return;
          gridToLocal(V, (p.x + p.def.w / 2) * CELL, (V.design.h - p.y - p.def.h / 2) * CELL, _p);
          localToWorld(V, _p.x, _p.y, _p);
          if (Math.hypot(_p.x - x, _p.y - y) > M.blast * 1.5) return;
          p.acidT = M.time; p.acidTo = M.corrode; if (p.corrode === undefined) p.corrode = 1;
          n++;
        });
        if (n) V.acidT = 1;
        if (n && (V.side === 0 || V.seen)) floatText('Armour corroding', V.body.x, V.body.y + V.height + 1.5, false);
      }
      for (let i = 0; i < 12; i++) {
        const p = spawnParticle(FX_ACID, x + B.rng.range(-1, 1), y + B.rng.range(0, 1), B.rng.range(-3, 3), B.rng.range(0, 4), B.rng.range(0.6, 1.2), B.rng.range(0.25, 0.45));
        if (p) p.g = 0.6;
      }
      break;
    }
    case 'emp': {
      explode(B, x, y, M.dmg, 1.5, src, 'emp');
      for (const V of B.units) {
        if (V.gone || V.destroyed || Math.hypot(V.body.x - x, V.body.y - y) > M.blast + V.radius * 0.5) continue;
        V.empT = Math.max(V.empT || 0, M.stun);
        if (V.side === 0 || V.seen) floatText('Electronics down', V.body.x, V.body.y + V.height + 1.5, V.side !== 0);
      }
      const r = spawnParticle(FX_RING, x, y, 0, 0, 0.45, 0.5);
      if (r) { r.grow = M.blast * 3; r.shade = 1; }
      for (let i = 0; i < 10; i++) arcAt(B, x, y, M.blast * 0.8);
      audio.sfx('tap', B.panOf(x), 1.2);
      break;
    }
    default:
      // HE, a cluster that never split, and each small missile of a split cluster.
      explode(B, x, y, M.warhead === 'cluster' ? M.dmg * 2 : M.dmg, M.blast, src);
  }
}

// Set up to n parts of V near (x, y) burning.
function igniteNear(B, V, x, y, n) {
  V.fires = V.fires || [];
  let lit = 0;
  for (const p of V.parts) {
    if (!p.alive || lit >= n) continue;
    gridToLocal(V, (p.x + p.def.w / 2) * CELL, (V.design.h - p.y - p.def.h / 2) * CELL, _p);
    localToWorld(V, _p.x, _p.y, _p);
    if (Math.hypot(_p.x - x, _p.y - y) > 3) continue;
    V.fires.push({ gx: (p.x + p.def.w / 2) * CELL, gy: (V.design.h - p.y - p.def.h / 2) * CELL, t: 8 });
    lit++;
  }
  if (lit && (V.side === 0 || V.seen)) floatText('Fire', V.body.x, V.body.y + V.height + 2, true);
}

// A blue electric arc particle near (x, y).
function arcAt(B, x, y, r) {
  const a = B.rng.range(0, Math.PI * 2), d = B.rng.range(0.2, 1) * r;
  const p = spawnParticle(FX_ARC, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.cos(a + 1.5) * 20, Math.sin(a + 1.5) * 20, B.rng.range(0.12, 0.25), 1);
  if (p) p.shade = B.rng.next();
}

// ---------- flares (design/02 §3.3, design/05 §3.3)
// A salvo breaks the lock of each seeker chasing V: a heat seeker's with the launcher's decoy
// chance, a radar seeker's with a quarter of it. A fooled missile chases the falling flares.
function popFlares(B, V) {
  if (!V.flares) return 'No flares';
  if (V.flareCd > 0) return 'Flares reloading';
  if (V.empT > 0) return 'Electronics down';
  V.flares--;
  V.flareCd = MSL.flareGap;
  const fx = V.body.x - V.dir * 2, fy = V.body.y + V.height + 1;
  for (let i = 0; i < 6; i++) {
    const p = spawnParticle(FX_FLARE, fx, fy, -V.dir * B.rng.range(3, 9) + V.body.vx * 0.5, B.rng.range(4, 10), B.rng.range(1.6, 2.4), 0.5);
    if (p) p.g = 0.35;
  }
  let fooled = 0;
  missiles.forEachAlive((m) => {
    if (!m.msl || m.target !== V || !m.locked || m.fooled) return;
    const chance = V.flareDecoy * (m.msl.seeker === 'heat' ? 1 : MSL.flareRadar);
    if (B.rng.next() < chance) { m.fooled = true; m.fx = fx - V.dir * 4; m.fy = fy + 2; fooled++; }
  });
  B.stats.flares = (B.stats.flares || 0) + 1;
  B.stats.fooled = (B.stats.fooled || 0) + fooled;
  audio.sfx('tap', B.panOf(fx), 0.8);
  return '';
}

// ---------- per-vehicle effects, every battle step (from stepSystems)
function stepWarheadEffects(B, V, dt) {
  if (V.flareCd > 0) V.flareCd -= dt;
  if (V.empT > 0) {
    V.empT -= dt;
    if (B.rng.next() < dt * 12) arcAt(B, V.body.x + B.rng.range(-0.5, 0.5) * V.len, V.body.y + B.rng.range(0.2, 1) * V.height, 0.6);
  }
  if (V.acidT !== 0) {
    let any = false;
    for (const p of V.parts) {
      if (!(p.acidT > 0)) continue;
      any = true;
      p.acidT -= dt;
      p.corrode = Math.max(p.acidTo, p.corrode - ((1 - p.acidTo) / 6) * dt);
      const pit = (1 - p.corrode) * 1.2;
      if (p.scorch < pit) { p.scorch = pit; V.dirty = true; }
      if (B.rng.next() < dt * 1.5) {
        gridToLocal(V, (p.x + p.def.w * B.rng.next()) * CELL, (V.design.h - p.y - p.def.h) * CELL, _p);
        localToWorld(V, _p.x, _p.y, _p);
        const q = spawnParticle(FX_ACID, _p.x, _p.y, 0, -0.5, 0.8, 0.22);
        if (q) q.g = 0.4;
      }
    }
    V.acidT = any ? 1 : 0;
  }
  // The crew fire flares when a locked seeker closes in.
  if (V.flares && !(V.flareCd > 0) && !V.destroyed) {
    let near = false;
    missiles.forEachAlive((m) => { if (m.msl && m.target === V && m.locked && !m.fooled && Math.hypot(m.x - V.body.x, m.y - V.body.y) < MSL.flareReact) near = true; });
    if (near) popFlares(B, V);
  }
}

// Burning napalm patches: damage whatever stands in them, and flicker.
function stepFirePatches(B, dt) {
  firePatches.forEachAlive((f) => {
    if (f.B !== B) { f.alive = false; return; }
    f.t -= dt;
    if (f.t <= 0) { f.alive = false; return; }
    if (B.rng.next() < dt * 20) {
      const p = spawnParticle(FX_FIRE, f.x + B.rng.range(-1, 1) * f.r, f.y + 0.2, 0, B.rng.range(1, 3), B.rng.range(0.4, 0.8), B.rng.range(0.6, 1.2));
      if (p) p.g = 0;
    }
    f.acc += dt;
    if (f.acc < 0.5) return;
    for (const V of B.units) {
      if (V.gone || V.destroyed || Math.abs(V.body.x - f.x) > f.r + V.len * 0.5 || V.body.y - f.y > 3) continue;
      V.parts.forEach((p, i) => {
        if (!p.alive || p.y + p.def.h < V.design.h - 2) return;      // the lowest two rows burn
        damagePart(B, V, i, MSL.burnDps * f.acc * (p.def.armor > 20 ? 20 / p.def.armor : 1), f.src, 'fire');
      });
    }
    f.acc = 0;
  });
}

// ---------- drawing
const WARHEAD_BAND = { he: '#C9A23A', napalm: '#E0602D', acid: '#B5D334', emp: '#5FB4FF', cluster: '#9AA0A8' };

function drawDesignedMissile(g, m, S) {
  const L = m.msl.length * S;
  g.fillStyle = '#3a3f47';
  g.fillRect(-L / 2, -0.09 * S, L, 0.18 * S);
  g.fillStyle = WARHEAD_BAND[m.msl.warhead] || PAL.amber;
  g.fillRect(L * 0.18, -0.09 * S, L * 0.16, 0.18 * S);
  g.fillStyle = PAL.amber;
  g.beginPath(); g.arc(-L / 2 - 0.05 * S, 0, 0.13 * S, 0, Math.PI * 2); g.fill();
}

// Burning ground under the napalm patches.
function drawFirePatches(g) {
  const S = view.S;
  firePatches.forEachAlive((f) => {
    g.globalAlpha = 0.5 * Math.min(1, f.t / 2);
    g.fillStyle = '#E0602D';
    g.fillRect(view.sx(f.x - f.r), view.sy(f.y + 0.15), f.r * 2 * S, 0.3 * S);
  });
  g.globalAlpha = 1;
}
