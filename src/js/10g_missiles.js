/* ==== 10g DESIGNED MISSILES ==== */
// Missiles built in the Drafting Office's Missile tab (design/02 §6; design/05 §3.4; design/06
// Part 5). A missile design's parts set its speed (motors), reach (fuel), turn (fins and
// seeker), guidance (seeker: radar, heat, laser, or none) and warheads (HE, napalm, acid, EMP,
// cluster). Racks carry small missiles; VLS blocks carry any size, fewer when bigger;
// magazines add missiles. Flares decoy heat seekers far more than radar seekers; ECM spoils
// radar locks; laser seekers need the launcher to keep the target in sight.

const MISSILE_SIZE = { missile_s: 1, missile_m: 2, missile_l: 3 };
const SEEKER_LOCK = { radar: 0.55, heat: 0.65, laser: 0.6 };
const FLARE_DECOY = { heat: 1, radar: 0.3, laser: 0 };   // × the flare's decoy chance
const FLARE_RANGE = 30;          // metres: a locked missile this close sets off the target's flares
const FLARE_COOLDOWN = 2.5;      // seconds between flare salvos
const CLUSTER_SPLIT = 22;        // metres from the target where a cluster warhead opens
const NAPALM = { secs: 8, width: 7, dps: 18 };
const EMP_SECS = 5, EMP_RADIUS = 8;
const ACID_RADIUS = 2.5;

// Built-in missiles, used by launchers with nothing loaded: [id, name, class, cells].
const DEFAULT_MISSILES = {
  1: { id: 'm_std_s', name: 'Standard missile S', kind: 'missile', w: 6, h: 1, cells: [['mseek_heat', 4, 0], ['mw_he', 3, 0], ['mfuel', 2, 0], ['mmotor', 1, 0]] },
  2: { id: 'm_std_m', name: 'Standard missile M', kind: 'missile', w: 10, h: 2, cells: [['mseek_radar', 9, 0], ['mw_he', 8, 0], ['mw_he', 8, 1], ['mfins', 7, 0], ['mfuel', 6, 0], ['mfuel', 5, 0], ['mmotor', 4, 0], ['mmotor', 4, 1]] },
  3: { id: 'm_std_l', name: 'Standard missile L', kind: 'missile', w: 16, h: 3, cells: [['mseek_radar', 15, 1], ['mw_he', 14, 0], ['mw_he', 14, 1], ['mw_he', 14, 2], ['mfins', 13, 1], ['mfuel', 12, 1], ['mfuel', 11, 1], ['mfuel', 10, 1], ['mmotor', 9, 0], ['mmotor', 9, 1], ['mmotor', 9, 2]] },
};
for (const k of Object.keys(DEFAULT_MISSILES)) { const d = DEFAULT_MISSILES[k]; d.cells = d.cells.map(([p, x, y]) => ({ p, x, y })); }

function missileDesign(id) {
  for (const k of Object.keys(DEFAULT_MISSILES)) if (DEFAULT_MISSILES[k].id === id) return DEFAULT_MISSILES[k];
  const d = save.designs.list.find((x) => x.id === id && x.kind === 'missile');
  return d || null;
}

// Numbers from a missile design (battle units: m/s, m, rad/s).
const _mstats = new Map();
function missileStats(d) {
  const key = d.id + ':' + d.cells.length + ':' + d.cells.map((c) => c.p).join(',');
  if (_mstats.has(key)) return _mstats.get(key);
  let mass = 0, motors = 0, fuel = 0, fins = 0, seeker = null, seekTurn = 0, dmg = 0, pen = 0;
  const warheads = [];
  for (const c of d.cells) {
    const P = PARTS[c.p];
    if (!P) continue;
    mass += P.mass;
    if (P.speed) motors++;
    if (P.rangeAdd) fuel += P.rangeAdd;
    if (P.seeker) { seeker = P.seeker; seekTurn = Math.max(seekTurn, P.turn || 0); } else if (P.turn) fins += P.turn;
    if (P.warhead) { warheads.push(P.warhead); dmg += P.dmg || 0; pen = Math.max(pen, P.pen || 0); }
  }
  const cls = classFor(d);
  const vel = motors ? clamp(25 + 20 * motors * Math.sqrt((40 * motors) / Math.max(20, mass)), 25, 110) : 0;
  const reach = (1000 + fuel) * BATTLE_DISTANCE_SCALE;
  const errors = [];
  if (!motors) errors.push('Needs a motor.');
  if (!warheads.length) errors.push('Needs a warhead.');
  if (!cls) errors.push('Outside the missile grids.');
  const out = {
    mass, motors, vel, reach, life: vel ? reach / vel : 0, turn: seeker ? 0.35 * (fins + seekTurn) : 0.2 * fins,
    seeker, warheads, dmg, pen, size: cls ? MISSILE_SIZE[cls.id] : 3, cls: cls ? cls.id : null, errors,
    cost: d.cells.reduce((a, c) => a + (PARTS[c.p] ? partCost(PARTS[c.p]) : 0), 0),
  };
  _mstats.set(key, out);
  return out;
}

// Launchers get their loaded missile when a vehicle is made (design.load: a missile design id).
function initLaunchers(V) {
  const load = V.design.load ? missileDesign(V.design.load) : null;
  let mags = 0;
  for (const p of V.parts) if (p.def.magazine) mags += p.def.magazine;
  for (const w of V.weapons) {
    if (w.def.secondary !== 'missile') continue;
    const fits = load && missileStats(load).size <= w.def.size && !missileStats(load).errors.length;
    const md = fits ? load : DEFAULT_MISSILES[Math.min(w.def.size, 1)];
    w.missile = md;
    const size = missileStats(md).size;
    w.rounds = Math.max(1, Math.floor(w.def.rounds / size)) + (w.def.size > 1 ? Math.floor(mags * 2 / size) : 0);
    if (w.def.size > 1) mags = 0;           // magazines feed the first VLS
    w.maxRounds = w.rounds;
  }
  V.flareSalvos = 0;
  for (const p of V.parts) if (p.def.salvos) V.flareSalvos += p.def.salvos;
  V.flareDecoy = V.parts.reduce((a, p) => Math.max(a, p.def.decoy || 0), 0);
  V.flareT = 0;
}

// Lock chance of a designed missile (design/05 §3.4 seekers).
function seekerLock(V, U, ms) {
  if (!ms.seeker) return 0;
  let p = SEEKER_LOCK[ms.seeker] + (V.fc > 1 ? LOCK_FC : 0);
  if (ms.seeker === 'radar') { p += V.radarLock || 0; if (U.ecm) p *= 1 - LOCK_ECM; }
  return clamp(p, 0, 0.97);
}

function launchDesigned(B, V, w, U) {
  if (w.rounds <= 0 || w.reload > 0 || !U || (V.empT > 0)) return false;
  const ms = missileStats(w.missile);
  weaponPivot(V, w, _p);
  const m = missiles.take();
  m.x = _p.x; m.y = _p.y + 0.3;
  m.kind = 'designed'; m.def = w.def; m.ms = ms; m.md = w.missile; m.target = U; m.t = 0; m.trail = 0;
  m.shooter = V; m.side = V.side; m.decoyed = false; m.split = false;
  m.ang = w.def.vertical ? Math.PI / 2 : Math.atan2(U.body.y + U.height * 0.3 - m.y, U.body.x - m.x);
  m.locked = B.rng.next() < seekerLock(V, U, ms);
  if (!m.locked && !w.def.vertical) m.ang += (B.rng.next() < 0.5 ? -1 : 1) * B.rng.range(0.1, 0.25);
  w.rounds--;
  w.reload = w.def.reload;
  V.revealT = Math.max(V.revealT, 3);
  B.stats.missiles = (B.stats.missiles || 0) + 1;
  audio.sfx('rocket', B.panOf(m.x));
  return true;
}

// Flight of a designed missile. Returns nothing; kills m when it's done.
function stepDesigned(B, m, dt) {
  const T = B.T, ms = m.ms, U = m.target;
  m.t += dt;
  if (m.t > ms.life + 0.5 || m.x < 0 || m.x > T.length || m.y > 400) { m.alive = false; return; }
  // Laser seekers ride the launcher's beam: it must live and see the target.
  if (m.locked && ms.seeker === 'laser' && (m.shooter.destroyed || !U || !U.seen)) m.locked = false;
  // Flares: the target answers the first time a locked missile closes in; flares in the air
  // may pull it off (heat seekers most, radar little, laser not at all).
  if (m.locked && U && !m.decoyed && Math.hypot(U.body.x - m.x, U.body.y - m.y) < FLARE_RANGE) {
    m.decoyed = true;
    let airborne = B.time < (U.flareT || 0);
    if (!airborne && U.flareSalvos > 0) { U.flareSalvos--; U.flareT = B.time + FLARE_COOLDOWN; fxFlares(B, U); airborne = true; }
    if (airborne && B.rng.next() < (U.flareDecoy || 0) * FLARE_DECOY[ms.seeker]) {
      m.locked = false;
      B.stats.decoyed = (B.stats.decoyed || 0) + 1;
      if (U === B.me || m.shooter === B.me) floatText('Decoyed', m.x, m.y + 1.5, false);
    }
  }
  const steer = m.locked && U && !U.gone && !U.destroyed && m.t > (m.def.vertical ? 0.5 : 0.25);
  if (steer) {
    let want = Math.atan2(U.body.y + U.height * 0.3 + U.body.vy * 0.3 - m.y, U.body.x + U.body.vx * 0.3 - m.x) - m.ang;
    while (want > Math.PI) want -= Math.PI * 2;
    while (want < -Math.PI) want += Math.PI * 2;
    m.ang += clamp(want, -ms.turn * dt * (m.def.vertical && m.t < 1.2 ? 2.5 : 1), ms.turn * dt * (m.def.vertical && m.t < 1.2 ? 2.5 : 1));
  } else if (m.def.vertical && m.t > 0.5 && m.t < 1.4 && U) {
    // A VLS missile without a lock still turns over toward the target's side.
    const side = U.body.x >= m.x ? 0 : Math.PI;
    m.ang += clamp(side - m.ang, -2 * dt, 2 * dt);
  }
  m.x += Math.cos(m.ang) * ms.vel * dt;
  m.y += Math.sin(m.ang) * ms.vel * dt;
  m.trail += dt;
  if (m.trail > 0.05) { m.trail = 0; const p = spawnParticle(FX_SMOKE, m.x - Math.cos(m.ang) * 0.6, m.y - Math.sin(m.ang) * 0.6, 0, 0.3, 1.1, 0.35); if (p) { p.grow = 0.6; p.shade = 0.8; } }
  // Cluster warheads open near the target into bomblets.
  if (!m.split && ms.warheads.includes('cluster') && U && Math.hypot(U.body.x - m.x, U.body.y - m.y) < CLUSTER_SPLIT) { m.split = true; m.alive = false; splitCluster(B, m); return; }
  if (m.y <= T.height(m.x) || (seaAt(T, m.x) && m.y < T.sea)) { m.alive = false; warheadHit(B, m, null); return; }
  for (const V of B.units) {
    if (V.gone || (V.side === m.side && !V.destroyed) || V === m.shooter) continue;
    if (Math.abs(V.body.x - m.x) > V.radius + 1 || Math.abs(V.body.y - m.y) > V.radius + 1) continue;
    m.alive = false;
    B.stats.missileHits = (B.stats.missileHits || 0) + 1;
    warheadHit(B, m, V);
    return;
  }
}

// What each warhead does where the missile ends (a vehicle V, or the ground).
function warheadHit(B, m, V) {
  const ms = m.ms, x = m.x, y = m.y;
  const each = ms.warheads.length ? ms.dmg / ms.warheads.length : 0;
  for (const wh of ms.warheads) {
    if (wh === 'he' || wh === 'bomblet') {
      if (V) {
        // A shaped charge in the last metre: the ordinary armour rules apply.
        const s = shells.take();
        s.px = s.sx = x; s.py = s.sy = y;
        s.vx = Math.cos(m.ang) * 150; s.vy = Math.sin(m.ang) * 150;
        s.x = x + s.vx * 0.016; s.y = y + s.vy * 0.016;
        s.t = 0; s.side = m.side; s.shooter = m.shooter; s.def = { pen: ms.pen || 120, dmg: each, range: 1000, heat: true, burst: each * 0.5, burstR: 1.4 };
        s.dmg = each; s.mg = false; s.he = false; s.dtype = ''; s.plasma = false; s.beam = false; s.ignore = null; s.ignoreT = 0; s.whistled = true; s.wet = false;
      }
      explode(B, x, y, each * 0.4, 2.5, m.shooter);
    } else if (wh === 'napalm') {
      explode(B, x, y, each * 0.5, 2, m.shooter);
      addFirePatch(B, x, m.shooter);
    } else if (wh === 'acid') {
      explode(B, x, y, each * 0.5, 2, m.shooter);
      corrode(B, x, y, m.shooter);
    } else if (wh === 'emp') {
      explode(B, x, y, each, 2, m.shooter);
      empBurst(B, x, y);
    }
  }
}

function splitCluster(B, m) {
  const bomb = { vel: m.ms.vel * 0.8, life: 3, turn: 0, seeker: null, warheads: ['bomblet'], dmg: 60, pen: 60, size: 1, reach: 60 };
  for (let k = 0; k < 4; k++) {
    const b = missiles.take();
    Object.assign(b, { x: m.x, y: m.y, kind: 'designed', def: m.def, ms: bomb, md: m.md, target: m.target, t: 0, trail: 0, shooter: m.shooter, side: m.side, locked: false, decoyed: true, split: true });
    b.ang = m.ang + (k - 1.5) * 0.12 - 0.15;
  }
  fxExplosion(B, m.x, m.y, 0.5);
  audio.sfx('boom', B.panOf(m.x), 0.5);
}

// ---------- lasting effects: fire patches, corrosion, EMP
const firePatches = makePool(() => ({ alive: false, x: 0, t: 0, src: null, emit: 0 }), 8);
function addFirePatch(B, x, src) {
  const f = firePatches.take();
  Object.assign(f, { x, t: 0, src, emit: 0 });
}
function stepMissileFx(B, dt) {
  firePatches.forEachAlive((f) => {
    f.t += dt;
    if (f.t >= NAPALM.secs) { f.alive = false; return; }
    const gy = B.T.height(f.x);
    f.emit -= dt;
    if (f.emit <= 0) {
      f.emit = 0.08;
      const p = flames.take();
      Object.assign(p, { x: f.x + (B.rng.next() - 0.5) * NAPALM.width, y: gy + 0.2, vx: (B.rng.next() - 0.5) * 2, vy: 2 + B.rng.next() * 3, t: 0, life: 0.6 + B.rng.next() * 0.5 });
    }
    // Vehicles standing in the fire burn from below.
    for (const V of B.units) {
      if (V.destroyed || V.flier || Math.abs(V.body.x - f.x) > NAPALM.width / 2 + V.len / 2 || V.body.y - gy > V.height + 2) continue;
      let low = -1, ly = -Infinity;
      for (let i = 0; i < V.parts.length; i++) { const p = V.parts[i]; if (p.alive && p.y + p.def.h > ly) { ly = p.y + p.def.h; low = i; } }
      if (low >= 0) damagePart(B, V, low, NAPALM.dps * dt, f.src, 'fire');
    }
  });
  for (const V of B.units) if (V.empT > 0) V.empT -= dt;
  decoys.forEachAlive((d) => { d.t += dt; d.vy -= 6 * dt; d.x += d.vx * dt; d.y += d.vy * dt; if (d.t >= d.life) d.alive = false; });
}
function corrode(B, x, y, src) {
  for (const V of B.units) {
    if (V.gone || Math.hypot(V.body.x - x, V.body.y - y) > V.radius + ACID_RADIUS) continue;
    V.parts.forEach((p, i) => {
      if (!p.alive) return;
      const o = gridCellToWorld(V, p.x, V.design.h - p.y - 1);
      if (Math.hypot(o.x - x, o.y - y) <= ACID_RADIUS + 0.5) { p.corroded = true; p.scorch = Math.min(1, p.scorch + 0.2); damagePart(B, V, i, 8, src, 'acid'); }
    });
  }
  for (let k = 0; k < 14; k++) { const d = decoys.take(); Object.assign(d, { x, y, vx: (B.rng.next() - 0.5) * 6, vy: B.rng.next() * 4, t: 0, life: 1.2, col: '#9CFF6B', r: 0.35 }); }
}
function empBurst(B, x, y) {
  for (const V of B.units) {
    if (V.gone || V.destroyed || Math.hypot(V.body.x - x, V.body.y - y) > EMP_RADIUS + V.radius) continue;
    // Precursor plating (resist emp 0.5) halves the time.
    V.empT = EMP_SECS * (V.parts.some((p) => p.alive && p.def.resist && p.def.resist.emp !== undefined) ? 0.5 : 1);
    floatText('EMP', V.body.x, V.body.y + V.height + 1, V.side === 1);
  }
  for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; const d = decoys.take(); Object.assign(d, { x, y, vx: Math.cos(a) * 14, vy: Math.sin(a) * 14 + 6, t: 0, life: 0.45, col: '#8FD8FF', r: 0.25 }); }
  audio.sfx('clunk', B.panOf(x), 1.4);
}

// Flares: bright sparks thrown up and back.
const decoys = makePool(() => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0, col: '', r: 0 }), 60);
function fxFlares(B, V) {
  for (let k = 0; k < 6; k++) { const d = decoys.take(); Object.assign(d, { x: V.body.x, y: V.body.y + V.height, vx: -V.dir * (4 + B.rng.next() * 6) + (B.rng.next() - 0.5) * 6, vy: 8 + B.rng.next() * 6, t: 0, life: 2.2, col: '#FFF6D0', r: 0.3 }); }
  if (V.side === 0 || V.seen) floatText('Flares', V.body.x, V.body.y + V.height + 1.5, false);
  audio.sfx('tick', B.panOf(V.body.x), 2);
}

function drawMissileFx(g) {
  const S = view.S;
  decoys.forEachAlive((d) => {
    g.globalAlpha = 1 - d.t / d.life;
    g.fillStyle = d.col;
    g.beginPath(); g.arc(view.sx(d.x), view.sy(d.y), d.r * S, 0, Math.PI * 2); g.fill();
  });
  g.globalAlpha = 1;
}
