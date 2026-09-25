/* ==== 11 AI ==== */
// Spotting, squad orders, enemy tactics and automatic weapons (design/01 §7.2, §7.4).

const SPOT_BASE = 95;              // battlefield metres a crew can see without optics
const SPOT_INTERVAL = 0.25;
const TURRET_SWING = 1.0;          // seconds to swing a turret to the other side
const ELEVATION_RATE = 40;         // degrees per second
const _aim = { ok: false, angle: 0, face: 1, reason: '' };

// Light and weather (design/01 §14.2): rain and dusk shorten sight; at night a night sight helps.
function sightFactor(B, O) {
  let k = 1;
  if (B.cfg.weather === 'rain') k *= 0.75;
  if (B.cfg.light === 'dusk') k *= 0.85;
  if (B.cfg.light === 'night') k *= O.night || 0.4;
  return k;
}

function spotRange(B, O, V) {
  let r = SPOT_BASE * O.spot * sightFactor(B, O);
  if (B.T.inForest(V.body.x)) r *= 1 - TERRAIN[T_FOREST].conceal;
  if (V.revealT > 0) r = Math.max(r, SPOT_BASE * 1.6);
  return r;
}

// Every 0.25 s: who can each side see? Wrecks stay visible once seen.
function updateSpotting(B) {
  for (const V of B.units) {
    if (V.destroyed && V.seen) continue;
    let seen = false;
    for (const O of B.units) {
      if (O.side === V.side || O.destroyed || O.crew <= 0) continue;
      const d = Math.abs(O.body.x - V.body.x);
      if (d > spotRange(B, O, V)) continue;
      if (smokeBlocks(O.body.x, O.body.y + O.height, V.body.x, V.body.y + V.height * 0.5)) continue;
      seen = true;
      break;
    }
    V.seen = seen || (V.destroyed && V.seen);
    if (seen) { V.lastSeenX = V.body.x; V.everSeen = true; }
  }
}

function nearestTarget(B, V, maxRange, filter) {
  let best = null, bd = Infinity;
  for (const U of B.units) {
    if (U.side === V.side || U.destroyed || !U.seen) continue;
    if (filter && !filter(U)) continue;
    const d = Math.abs(U.body.x - V.body.x);
    if (d < bd && d <= maxRange) { bd = d; best = U; }
  }
  return best;
}

function mainWeapon(V) {
  let best = null;
  for (const w of V.weapons) if (!w.def.auto && V.parts[w.part].alive && (!best || w.def.pen > best.def.pen)) best = w;
  return best;
}

// Target point on a vehicle: a little above its centre of mass.
function aimPoint(U, out) {
  out.x = U.body.x;
  out.y = U.body.y + U.height * 0.15;
  return out;
}

// Turn the barrel toward `angle` (world) at the elevation rate; handles swinging sides.
function trainWeapon(V, w, angle, face, dt) {
  if (w.face === undefined) { w.face = V.dir; w.angle = angleFromElevation(V, 0, V.dir); w.swing = 0; }
  if (face !== w.face) {
    if (!w.turret) return false;
    w.face = face;
    w.swing = TURRET_SWING;
  }
  if (w.swing > 0) { w.swing -= dt; w.angle = angleFromElevation(V, 0, w.face); return false; }
  const cur = elevationOf(V, w.angle, w.face);
  const want = elevationOf(V, angle, w.face);
  const step = ELEVATION_RATE * dt;
  const next = Math.abs(want - cur) <= step ? want : cur + Math.sign(want - cur) * step;
  w.angle = angleFromElevation(V, next, w.face);
  return Math.abs(want - next) < 0.6;
}

// Reloading, automatic weapons and (for AI) the main gun.
function runWeapons(B, V, dt, aiControlled) {
  const loaderPenalty = V.crew < 3 ? 1.6 : 1;
  const tmp = { x: 0, y: 0 };
  for (const w of V.weapons) {
    if (!V.parts[w.part].alive) continue;
    const d = w.def;
    if (w.kick) w.kick = Math.max(0, w.kick - dt * 6);
    if (w.reload > 0) w.reload -= dt;
    if (d.auto) {
      // Machine guns fire by themselves at soft targets (AI guns at anything in range).
      const T = nearestTarget(B, V, weaponRange(d), aiControlled ? null : (U) => U.soft);
      if (!T || B.cfg.holdFire && V.side === 1) { w.burst = 0; continue; }
      aimPoint(T, tmp);
      aimWeapon(V, w, tmp.x, tmp.y, _aim);
      const ready = trainWeapon(V, w, _aim.angle, _aim.face, dt);
      if (!_aim.ok || !ready || w.reload > 0) continue;
      fireWeapon(B, V, w, w.angle, aiControlled ? 1 / (V.ai ? V.ai.accuracy : 1) : 1);
      w.burst++;
      w.reload = 60 / d.rpm * 1.5;
      if (w.burst >= d.burst) { w.burst = 0; w.reload = 1.4; }
      continue;
    }
    if (!aiControlled) continue;
    const tgt = V.ai && V.ai.target;
    if (!tgt || tgt.destroyed || !tgt.seen) continue;
    aimPoint(tgt, tmp);
    aimWeapon(V, w, tmp.x, tmp.y, _aim);
    const ready = trainWeapon(V, w, _aim.angle, _aim.face, dt);
    if (B.cfg.holdFire && V.side === 1) continue;
    if (!_aim.ok || !ready || w.reload > 0 || V.ai.react > 0 || V.shells <= 0) continue;
    if (Math.abs(tgt.body.x - V.body.x) > weaponRange(d)) continue;
    if (fireWeapon(B, V, w, w.angle, 1 / V.ai.accuracy)) {
      w.reload = d.reload * loaderPenalty;
      if (d.indirect && B.warnings) {
        const vx = Math.abs(Math.cos(w.angle)) * d.vel;
        B.warnings.push({ x: tmp.x, t: Math.abs(tmp.x - V.body.x) / Math.max(1, vx) });
      }
    }
  }
}

// ---------- squad-mates (design/02 §3.4)
function squadThink(B, V, dt) {
  const me = B.me;
  const ai = V.ai;
  const slot = B.squad.indexOf(V) < B.squad.indexOf(me) ? B.squad.indexOf(V) + 1 : B.squad.indexOf(V);
  const dir = 1;                      // the squad advances to the right
  let goal = null;
  if (ai.hold !== null) goal = ai.hold;
  else if (B.order === 'Follow') goal = me.body.x - dir * 12 * slot;
  else if (B.order === 'Escort') goal = me.body.x + dir * (slot === 1 ? 10 : -10);
  else if (B.order === 'Attack') goal = B.target && !B.target.destroyed ? B.target.body.x - dir * (weaponRange(mainWeapon(V) ? mainWeapon(V).def : PARTS.mg) * 0.7) : me.body.x - dir * 10 * slot;
  else if (B.order === 'Back') goal = me.body.x - dir * 30 * slot;
  V.throttle = goal === null ? 0 : Math.abs(goal - V.body.x) < 2 ? 0 : clamp((goal - V.body.x) * 0.25, -1, 1);
  // Engage: the Attack order uses your target; otherwise the nearest enemy in range.
  const mw = mainWeapon(V);
  const range = mw ? weaponRange(mw.def) : 0;
  let tgt = null;
  if (B.order === 'Attack' && B.target && !B.target.destroyed && B.target.seen) tgt = B.target;
  else tgt = nearestTarget(B, V, range);
  if (tgt !== ai.target) { ai.target = tgt; ai.react = 0.6; }
  if (ai.react > 0) ai.react -= dt;
}

// ---------- enemy tactics
function enemyThink(B, V, dt) {
  const ai = V.ai;
  const mw = mainWeapon(V);
  const range = mw ? weaponRange(mw.def) : V.weapons.length ? weaponRange(V.weapons[0].def) : 0;
  const tgt = nearestTarget(B, V, Math.max(range, SPOT_BASE * 2));
  if (tgt !== ai.target) { ai.target = tgt; ai.react = ai.reaction; }
  if (ai.react > 0) ai.react -= dt;
  const x = V.body.x;
  if (ai.mode === 'parked' || ai.mode === 'fixed') {
    V.throttle = 0;
  } else if (ai.mode === 'convoy') {
    // Drive between two points; run for the far edge once shot at.
    if (B.time - V.lastHitT < 20) V.throttle = 0.8;
    else {
      if (x < ai.a) ai.leg = 1;
      if (x > ai.b) ai.leg = -1;
      V.throttle = 0.45 * ai.leg;
    }
  } else if (tgt) {
    const d = Math.abs(tgt.body.x - x);
    const want = range * 0.65;
    const toward = Math.sign(tgt.body.x - x);
    if (d > want + 8) V.throttle = 0.8 * toward;
    else if (d < want - 15) V.throttle = -0.5 * toward;
    else V.throttle = 0;
  } else {
    V.throttle = 0.5 * V.dir;           // advance
  }
}

// The escort truck drives for the depot and waits while an enemy is close ahead.
function escortThink(B, V) {
  const ahead = B.units.some((U) => U.side !== V.side && !U.destroyed && U.seen && U.body.x > V.body.x && U.body.x - V.body.x < 45);
  V.throttle = V.body.x >= B.depot ? 0 : ahead ? 0 : 0.5;
}

function makeAI(mode, cfg) {
  return {
    mode,
    target: null,
    react: 0,
    hold: null,
    leg: -1,
    a: 0, b: 0,
    accuracy: cfg ? cfg.accuracy : 0.6,
    reaction: cfg ? cfg.reaction : 0.8,
  };
}

// Messages about what the ground is doing (facts only).
function mobilityNotes(B, V, dt) {
  if (V.destroyed || !V.canDrive || V.throttle === 0) { V.stuckT = 0; return; }
  if (Math.abs(V.speed) < 0.15) V.stuckT += dt; else V.stuckT = 0;
  if (V.stuckT > 1.5 && B.time - V.bogNoteT > 6) {
    V.bogNoteT = B.time;
    const ter = B.T.terrainAt(V.body.x);
    const slope = Math.abs(Math.atan(B.T.slope(V.body.x)) * 180 / Math.PI);
    const text = ter.soft >= 0.5 ? 'Bogged down' : slope > 8 ? `Stalled on a ${Math.round(slope)}° slope` : V.fuel <= 0 && V.fuelMax > 0 ? 'Out of fuel' : 'Stopped';
    if (V.side === 0) floatText(text, V.body.x, V.body.y + V.height + 1, false);
  }
}
