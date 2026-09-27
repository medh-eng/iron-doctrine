/* ==== 10e SYSTEMS ==== */
// Rockets, guided missiles, radar, ECM, heat, breakdowns and field repair
// (design/01 §7.4, §8.2, design/05 §3, §4, §7.5, §7.6).
// A guided missile rolls for a lock when it is fired: fire control and radar raise the
// chance, the target's ECM cuts it. Locked, it steers at the target within its turn rate;
// unlocked, it flies straight on a bad heading and misses. That is what makes the sensors matter.

const missiles = makePool(() => ({ alive: false, x: 0, y: 0, ang: 0, t: 0, kind: '', def: null, target: null, locked: false, shooter: null, side: 0, trail: 0 }), 24);
const salvos = makePool(() => ({ alive: false, V: null, w: null, n: 0, gap: 0, tx: 0, ty: 0 }), 8);

// Lock chance of V's missiles of this kind against U.
function lockChance(V, U, kind) {
  const p = MISSILE[kind].base + (V.fc > 1 ? LOCK_FC : 0) + (V.radarLock || 0);
  return clamp(p * (U && U.ecm ? 1 - LOCK_ECM : 1), 0, 0.97);
}

function launchMissile(B, V, w, U) {
  if (w.rounds <= 0 || w.reload > 0 || !U) return false;
  const kind = w.def.secondary;
  weaponPivot(V, w, _p);
  const m = missiles.take();
  m.x = _p.x; m.y = _p.y + 0.2;
  m.kind = kind; m.def = w.def; m.target = U; m.t = 0; m.trail = 0;
  m.shooter = V; m.side = V.side;
  // SAMs leave the rail steeply toward the target's side; anti-tank missiles straight at it.
  m.ang = kind === 'sam' ? (U.body.x >= m.x ? 0.35 : 0.65) * Math.PI : Math.atan2(U.body.y + U.height * 0.3 - m.y, U.body.x - m.x);
  m.locked = B.rng.next() < lockChance(V, U, kind);
  // Without a lock the missile doesn't steer and leaves 6–14° off.
  if (!m.locked) m.ang += (B.rng.next() < 0.5 ? -1 : 1) * B.rng.range(0.1, 0.25);
  w.rounds--;
  w.reload = w.def.reload;
  V.revealT = Math.max(V.revealT, 3);
  B.stats.missiles = (B.stats.missiles || 0) + 1;
  audio.sfx('rocket', B.panOf(m.x));
  return true;
}

// A rocket-pod salvo: 8 unguided rockets, one every 0.1 s, at the aim point.
function fireSalvo(B, V, w, tx, ty) {
  if (w.rounds <= 0 || w.reload > 0) return false;
  const s = salvos.take();
  s.V = V; s.w = w; s.n = w.def.salvo; s.gap = 0; s.tx = tx; s.ty = ty;
  w.rounds--;
  w.reload = w.def.reload;
  return true;
}

function stepSalvos(B, dt) {
  salvos.forEachAlive((s) => {
    const V = s.V;
    if (V.destroyed || !V.parts[s.w.part].alive) { s.alive = false; return; }
    s.gap -= dt;
    if (s.gap > 0) return;
    s.gap = ROCKET_SALVO_GAP;
    aimWeapon(V, s.w, s.tx, s.ty, _aim);
    const d = s.w.def;
    const a = _aim.angle + (gauss(B.rng) * d.spread * Math.PI) / 180;
    weaponPivot(V, s.w, _p);
    const r = shells.take();
    r.x = r.px = r.sx = _p.x + Math.cos(a) * 0.8; r.y = r.py = r.sy = _p.y + Math.sin(a) * 0.8;
    r.vx = Math.cos(a) * d.vel + V.body.vx; r.vy = Math.sin(a) * d.vel + V.body.vy;
    r.t = 0; r.side = V.side; r.shooter = V; r.def = d;
    r.dmg = d.dmg; r.mg = false; r.he = false; r.ignore = V; r.ignoreT = 0.3; r.whistled = false; r.wet = false;
    audio.sfx('rocket', B.panOf(r.x), 0.6);
    const p = spawnParticle(FX_SMOKE, r.x, r.y, 0, 0.4, 0.8, 0.5);
    if (p) { p.grow = 0.8; p.shade = 0.6; }
    if (--s.n <= 0) s.alive = false;
  });
}

function stepMissiles(B, dt) {
  const T = B.T;
  missiles.forEachAlive((m) => {
    const M = MISSILE[m.kind];
    m.t += dt;
    const U = m.target;
    if (m.t > M.life || m.x < 0 || m.x > T.length) { m.alive = false; if (m.kind === 'sam') flakBurst(B, m.x, m.y, m.shooter); return; }
    // Locked: steer at where the target will be, within the turn rate.
    if (m.locked && U && !U.gone && !U.destroyed && m.t > 0.25) {
      let want = Math.atan2(U.body.y + U.height * 0.3 + U.body.vy * 0.3 - m.y, U.body.x + U.body.vx * 0.3 - m.x) - m.ang;
      while (want > Math.PI) want -= Math.PI * 2;
      while (want < -Math.PI) want += Math.PI * 2;
      m.ang += clamp(want, -M.turn * dt, M.turn * dt);
    }
    const v = m.def.vel;
    m.x += Math.cos(m.ang) * v * dt;
    m.y += Math.sin(m.ang) * v * dt;
    m.trail += dt;
    if (m.trail > 0.05) { m.trail = 0; const p = spawnParticle(FX_SMOKE, m.x - Math.cos(m.ang) * 0.6, m.y - Math.sin(m.ang) * 0.6, 0, 0.3, 1.1, 0.35); if (p) { p.grow = 0.6; p.shade = 0.8; } }
    if (m.y <= T.height(m.x) || (seaAt(T, m.x) && m.y < T.sea)) {
      m.alive = false;
      if (seaAt(T, m.x) && m.y < T.sea) fxSplash(B, m.x, T.sea, 1); else fxDirt(B, m.x, T.height(m.x), 5);
      audio.sfx('thud', B.panOf(m.x));
      return;
    }
    // SAM: proximity fuse against aircraft.
    if (M.fuse) {
      for (const V of B.units) {
        if (!V.flier || V.destroyed || V.side === m.side) continue;
        if (Math.hypot(V.body.x - m.x, V.body.y - m.y) < M.fuse + V.radius * 0.5) {
          m.alive = false;
          B.stats.missileHits = (B.stats.missileHits || 0) + 1;
          explode(B, m.x, m.y, M.dmg, M.radius, m.shooter);
          if (m.shooter === B.me || V === B.me) floatText('Missile hit', m.x, m.y + 2, true);
          return;
        }
      }
      return;
    }
    // Anti-tank missile: becomes a shaped-charge shell in its last metre, so the ordinary
    // armour and penetration rules apply.
    for (const V of B.units) {
      if (V.gone || V.side === m.side && !V.destroyed || V === m.shooter) continue;
      if (Math.abs(V.body.x - m.x) > V.radius + 1 || Math.abs(V.body.y - m.y) > V.radius + 1) continue;
      const s = shells.take();
      s.px = s.sx = m.x; s.py = s.sy = m.y;
      s.vx = Math.cos(m.ang) * 150; s.vy = Math.sin(m.ang) * 150;
      s.x = m.x + s.vx * dt; s.y = m.y + s.vy * dt;
      s.t = 0; s.side = m.side; s.shooter = m.shooter; s.def = m.def;
      s.dmg = m.def.dmg; s.mg = false; s.he = false; s.ignore = null; s.ignoreT = 0; s.whistled = true; s.wet = false;
      m.alive = false;
      B.stats.missileHits = (B.stats.missileHits || 0) + 1;
      return;
    }
  });
}

// SAM launchers fire by themselves at aircraft in range, for either side.
function autoSam(B, V, w) {
  if (w.rounds <= 0 || w.reload > 0 || V.destroyed || (B.cfg.holdFire && V.side === 1)) return;
  const U = nearestTarget(B, V, weaponRange(w.def), (U) => U.flier);
  if (U) launchMissile(B, V, w, U);
}

// ---------- heat, breakdowns, field repair (per vehicle, every battle step)
function stepSystems(B, V, dt) {
  if (V.destroyed || V.gone) return;
  // Heat: engines only run hot while driving (fliers always).
  const running = V.flier || V.throttle !== 0;
  const ter = B.T.terrainAt(V.body.x);
  const inWater = V.hull && seaAt(B.T, V.body.x);
  const made = (running ? V.heatEngines * (ter.heat || 1) : 0) + V.heatOther;
  const removed = V.radiators + V.engineCount * (ENGINE_COOLING + (inWater || V.flier ? EXTRA_COOLING : 0));
  const over = made > removed ? (made - removed) / Math.max(1, made) : 0;
  V.overheat = over;
  V.heatMul = 1 - 0.5 * over;
  V.overheatT = over > 0 ? (V.overheatT || 0) + dt : 0;
  if (V.overheatT > OVERHEAT_FIRE_SECS && over >= 0.5 && B.rng.next() < dt * 0.05) {
    const i = V.parts.findIndex((p) => p.alive && p.def.power > 0);
    if (i >= 0) {
      const p = V.parts[i];
      V.fires = V.fires || [];
      V.fires.push({ gx: (p.x + p.def.w / 2) * CELL, gy: (V.design.h - p.y - p.def.h / 2) * CELL, t: 10 });
      if (V.side === 0 || V.seen) floatText('Engine fire', V.body.x, V.body.y + V.height, false);
      V.overheatT = 0;
    }
  }
  if (V.side === 0 && over > 0 && B.time - (V.heatNoteT || -99) > 12) {
    V.heatNoteT = B.time;
    floatText(`Overheating · power ${Math.round(V.heatMul * 100)}%`, V.body.x, V.body.y + V.height + 1, false);
  }
  // Breakdowns: every 30 s, 1/120 of the hourly rate; one part fails, weighted by (1 − rel).
  V.breakT = (V.breakT || 0) + dt;
  if (V.breakT >= BREAKDOWN_CHECK) {
    V.breakT = 0;
    let sum = 0;
    for (const p of V.parts) if (p.alive) sum += 1 - p.def.rel;
    if (B.rng.next() < (sum * 0.5) / 120) {
      let r = B.rng.next() * sum;
      for (let i = 0; i < V.parts.length; i++) {
        const p = V.parts[i];
        if (!p.alive) continue;
        r -= 1 - p.def.rel;
        if (r <= 0) {
          if (V.side === 0 || V.seen) floatText(`Breakdown · ${p.def.name}`, V.body.x, V.body.y + V.height + 1, false);
          destroyPart(B, V, i, null);
          break;
        }
      }
    }
  }
  // Field repair: damaged (not destroyed) parts of this vehicle and allies within 12 m.
  if (V.repair && Math.abs(V.speed) < 0.5) {
    for (const U of B.units) {
      if (U.side !== V.side || U.destroyed || U.gone || Math.abs(U.body.x - V.body.x) > 12) continue;
      let left = V.repair * dt;
      for (const p of U.parts) {
        if (!p.alive || p.hp >= p.def.hp || left <= 0) continue;
        const add = Math.min(left, p.def.hp - p.hp);
        p.hp += add; left -= add;
        p.scorch = Math.max(0, p.scorch - add / p.def.hp);
        U.dirty = true;
      }
    }
  }
}

function drawMissiles(g) {
  const S = view.S;
  missiles.forEachAlive((m) => {
    g.save();
    g.translate(view.sx(m.x), view.sy(m.y));
    g.rotate(-m.ang);
    g.fillStyle = '#3a3f47';
    g.fillRect(-0.5 * S, -0.08 * S, S, 0.16 * S);
    g.fillStyle = PAL.amber;
    g.beginPath(); g.arc(-0.55 * S, 0, 0.12 * S, 0, Math.PI * 2); g.fill();
    g.restore();
  });
}
