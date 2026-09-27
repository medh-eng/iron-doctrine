/* ==== 09d PHYSICS: AIR ==== */
// Aircraft and helicopters (design/01 §7.3, design/05 §7.4, design/04 §6).
// Aircraft: wing lift at the centre of lift, from the airflow over the wing; beyond 12° the
// wing stalls. The tail steadies the nose and carries the elevator. Thrust from jets, or
// engine power through air propellers, against drag. Helicopters: rotor lift along the
// mast, tilted to move; the tail rotor keeps them pointing.
// Battle speeds are × AIR_SPEED_SCALE (07_data): the air is denser by 1 ÷ scale² and
// propeller power is × scale, so the sheet numbers hold at the scaled speed.

const AIR_RHO_BATTLE = AIR_RHO / (AIR_SPEED_SCALE * AIR_SPEED_SCALE);
const CRASH_SPEED = 7;            // m/s: touching the ground faster than this is a crash
const HELI_TILT = 0.26;           // radians of tilt at full ◀ or ▶ (15°)
const CLIMB_RATE = 6;             // m/s the helicopter height order moves while ▲ or ▼ is held

// Called from rebuildVehicle: lift, tail, thrust and rotors of the live parts, in body space.
function buildAirParts(V) {
  if (V.domain === undefined) V.domain = domainOf(V.design);
  V.flier = airDomain(V.domain);
  if (!V.flier) return;
  const st = V.stats;
  const D = V.design;
  let tailA = 0, tx = 0, ty = 0, rotors = 0, trotors = 0, airprops = 0, jet = 0;
  V.parts.forEach((p) => {
    if (!p.alive) return;
    const d = p.def;
    const cx = (p.x + d.w / 2) * CELL, cy = (D.h - p.y - d.h / 2) * CELL;
    if (d.tail) { tailA += d.tail; tx += d.tail * cx; ty += d.tail * cy; }
    if (d.rotor) rotors++;
    if (d.trotor) trotors++;
    if (d.airprop) airprops++;
    if (d.jet) jet += d.jet;
  });
  const tmp = { x: 0, y: 0 };
  V.wingArea = st.wingArea || 0;
  if (st.col) { gridToLocal(V, st.col.x, st.col.y, tmp); V.colL = { x: tmp.x, y: tmp.y }; } else V.colL = null;
  V.tailArea = tailA;
  if (tailA) { gridToLocal(V, tx / tailA, ty / tailA, tmp); V.tailL = { x: tmp.x, y: tmp.y }; } else V.tailL = null;
  V.jetThrust = jet;
  V.airPower = airprops ? V.power : 0;
  V.rotors = rotors;
  V.trotors = trotors;
  V.rotorLift = rotors ? rotors * ROTOR_LIFT * Math.min(1, V.power / (ROTOR_POWER * rotors)) : 0;
  V.CdA = AIR_CD_WING * V.wingArea + AIR_CD_FRONT * V.height * 1.2;
  if (V.throttle === undefined) V.throttle = 0;
}

// Angle of attack of airflow (vx, vy) against the body: positive when the nose is above it.
function attackAngle(V, vx, vy, ca, sa) {
  const fx = V.dir * ca, fy = V.dir * sa;       // nose direction
  const ux = -sa, uy = ca;                      // body up
  return Math.atan2(-(vx * ux + vy * uy), vx * fx + vy * fy);
}

// Lift coefficient: 0.1 per degree up to 1.2 at 12°, falling away beyond (the stall).
function liftCoeff(alpha) {
  const deg = (alpha * 180) / Math.PI;
  const a = Math.abs(deg);
  const cl = a <= STALL_DEG ? CL_PER_DEG * a : Math.max(0, CL_MAX - 0.07 * (a - STALL_DEG));
  return Math.sign(deg) * cl;
}

// A surface of area A at body point L, flown through the air: lift across the local airflow
// plus induced drag along it. extra = added angle (elevator). Adds into out.
function surfaceForce(V, L, A, cl0, extra, ca, sa, out, induced) {
  const b = V.body;
  const rx = L.x * ca - L.y * sa, ry = L.x * sa + L.y * ca;
  const vx = b.vx - b.w * ry, vy = b.vy + b.w * rx;
  const v2 = vx * vx + vy * vy;
  if (v2 < 0.01) return 0;
  const v = Math.sqrt(v2);
  const alpha = attackAngle(V, vx, vy, ca, sa) + extra;
  const CL = cl0 ? cl0(alpha) : clamp(((alpha * 180) / Math.PI) * 0.08, -1, 1);
  const q = 0.5 * AIR_RHO_BATTLE * v2 * A;
  // Lift is square to the airflow, on the side of the body's up.
  let nx = -vy / v, ny = vx / v;
  if (nx * -sa + ny * ca < 0) { nx = -nx; ny = -ny; }
  const Fl = q * CL, Fd = induced ? q * INDUCED_K * CL * CL : 0;
  const Fx = nx * Fl - (vx / v) * Fd, Fy = ny * Fl - (vy / v) * Fd;
  out.fx += Fx; out.fy += Fy;
  out.tq += rx * Fy - ry * Fx;
  return alpha;
}

// Air forces for one physics substep; adds into out. Replaces the ground air drag.
function airForces(V, T, ca, sa, out) {
  const b = V.body;
  const v2 = b.vx * b.vx + b.vy * b.vy;
  const v = Math.sqrt(v2);
  const live = !V.destroyed && V.canDrive && (V.fuelMax === 0 || V.fuel > 0);
  if (V.domain === 'air') {
    V.alpha = V.colL ? surfaceForce(V, V.colL, V.wingArea, liftCoeff, 0, ca, sa, out, true) : 0;
    if (V.tailL) surfaceForce(V, V.tailL, V.tailArea, null, live ? -(V.pitchCmd || 0) * (ELEVATOR_DEG * Math.PI) / 180 : 0, ca, sa, out, false);
    if (v > 0.1) { const D = 0.5 * AIR_RHO_BATTLE * V.CdA * dragRise(v / AIR_SPEED_SCALE) * v2; out.fx -= (D * b.vx) / v; out.fy -= (D * b.vy) / v; }
    if (live && V.throttle > 0) {
      const T = V.throttle * (V.heatMul || 1) * (V.jetThrust + (V.airPower * 1000 * AIRPROP_EFF * AIR_SPEED_SCALE) / Math.max(v, 8 * AIR_SPEED_SCALE));
      out.fx += V.dir * ca * T; out.fy += V.dir * sa * T;
    }
  } else {
    // Helicopter: rotor lift along the mast; drag on the body; attitude held by the tail rotor.
    const L = live && V.rotors ? clamp(V.collective || 0, 0, 1) * V.rotorLift * (V.heatMul || 1) : 0;
    out.fx += -sa * L; out.fy += ca * L;
    if (v > 0.1) { const D = 0.5 * AIR_RHO_BATTLE * HELI_CDA * v2; out.fx -= (D * b.vx) / v; out.fy -= (D * b.vy) / v; }
    if (live && V.rotors) {
      if (V.trotors) out.tq += b.I * (8 * ((V.tiltCmd || 0) - b.a) - 5 * b.w);
      else out.tq += b.I * 1.5;                 // no tail rotor: the body spins
    }
  }
}

// Controls, once per battle step. Aircraft: an autopilot holds level flight when there is no
// pitch order. Helicopters: the collective holds the height order. Also turns fliers round.
function flightControl(V, T, dt) {
  if (!V.flier || V.gone) return;
  const b = V.body;
  if (V.domain === 'air') {
    const gamma = Math.atan2(b.vy, b.vx * V.dir);            // climb angle, facing forward
    if (V.pitchOrder === undefined || V.pitchOrder === null) {
      // Proportional on the climb angle, damped by the pitch rate, with trim that builds up
      // to hold it (an integral term).
      const err = (V.gammaCmd || 0) - gamma;
      V.trim = clamp((V.trim || 0) + err * 1.5 * dt, -1, 1);
      V.pitchCmd = clamp(2.5 * err + V.trim - 0.6 * b.w * V.dir, -1, 1);
    } else { V.pitchCmd = V.pitchOrder; V.trim = 0; }
    // Past the vertical in a loop: roll level, now facing the other way (a half loop and roll).
    if (Math.abs(b.a * V.dir) > 1.75 && !V.destroyed) flipFlier(V);
  } else {
    if (V.altCmd === undefined || V.altCmd === null) V.altCmd = b.y;
    const W = b.m * GRAVITY;
    const want = W + b.m * (1.2 * (V.altCmd - b.y) - 1.8 * b.vy);
    V.collective = V.rotorLift ? clamp(want / Math.max(0.2, Math.cos(b.a)) / V.rotorLift, 0, 1) : 0;
    const move = V.moveCmd || 0;
    V.tiltCmd = -move * HELI_TILT;
    if (move && Math.sign(move) !== V.dir && b.vx * move > 1) flipFlier(V);
  }
}

// Mirror the flier to face the other way, keeping its place and motion.
function flipFlier(V) {
  const b = V.body;
  V.dir = -V.dir;
  if (V.domain === 'air') {
    b.a += Math.PI;
    while (b.a > Math.PI) b.a -= Math.PI * 2;
    while (b.a < -Math.PI) b.a += Math.PI * 2;
  }
  for (const w of V.weapons) { w.face = V.dir; w.angle = angleFromElevation(V, 0, V.dir); }
  rebuildVehicle(V);
}

// Put a flier in the air at a height over the ground, flying (aircraft) or hovering.
function launchFlier(V, T, alt) {
  const b = V.body;
  b.y = Math.max(T.height(b.x), seaAt(T, b.x) ? T.sea : -Infinity) + alt;
  b.a = 0; b.w = 0; b.vy = 0;
  if (V.domain === 'air') {
    const st = V.stats;
    const stall = (st.stallSpeed || 10) * AIR_SPEED_SCALE;
    const top = (st.topSpeed || 10) * AIR_SPEED_SCALE;
    b.vx = V.dir * Math.max(stall * 1.4, Math.min(top * 0.8, stall * 2));
    V.throttle = 0.8;
    V.gammaCmd = 0;
  } else {
    b.vx = 0;
    V.altCmd = b.y;
  }
}

// Touching the ground too fast is a crash; coming down on the sea is ditching.
function airChecks(B, V) {
  if (!V.flier || V.gone) return;
  const b = V.body;
  const T = B.T;
  const v = Math.hypot(b.vx, b.vy);
  let touch = false;
  for (const c of V.contacts) if (c.N > 0) touch = true;
  if (seaAt(T, b.x) && b.y - V.height * 0.3 < T.sea) {
    if (!V.destroyed) knockOut(B, V, V.lastHitBy, 'Ditched', true);
    return;
  }
  if (!touch) { V.lastAirV = v; return; }
  const hard = (V.lastAirV || 0) > CRASH_SPEED || Math.abs(b.a) > 0.8;
  if (hard && !V.crashed) {
    V.crashed = true;
    if (!V.destroyed) knockOut(B, V, V.lastHitBy, 'Crashed');
    else { fxExplosion(B, b.x, b.y, 1.4); audio.sfx('boom', B.panOf(b.x), 1.2); B.trauma = Math.min(1, B.trauma + 0.2); }
    fxDirt(B, b.x, T.height(b.x), 10);
    for (let i = 0; i < V.parts.length; i++) if (V.parts[i].alive && B.rng.next() < 0.4) damagePart(B, V, i, 999, null);
  }
  V.lastAirV = v;
}
