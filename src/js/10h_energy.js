/* ==== 10h ENERGY WEAPONS, FLAMETHROWERS, DAMAGE TYPES ==== */
// Part 5d (design/01 §7, design/05 §3.4, design/08 §7). Lasers and plasma use no ammo: they
// recharge from the ship's spare power (engine power, less what its systems draw), a capacitor
// bank covers a shortfall and refills from the surplus, and every shot adds weapon heat that
// radiators shed; a full heat gauge locks the energy weapons until it has cooled to half.
// Flamethrowers burn fuel and fire by themselves at close range, setting parts alight.
// Damage types: fire, laser, plasma, acid and EMP; materials resist them by type.

// Set up from the live parts (from rebuildVehicle).
function setupEnergy(V) {
  let made = 0, draw = 0, weap = 0, cap = 0;
  for (const p of V.parts) {
    if (!p.alive) continue;
    const d = p.def;
    if (d.power > 0) made += d.power;
    else if (d.power < 0) { if (d.energy) weap -= d.power; else draw -= d.power; }
    if (d.capacitor) cap += d.effect * EN.capKJ;
  }
  V.powerMade = made; V.powerDraw = draw; V.energyNeed = weap; V.capMax = cap;
  if (V.capCharge === undefined) V.capCharge = cap;         // capacitors start charged
  V.capCharge = Math.min(V.capCharge, cap);
  if (V.wheat === undefined) { V.wheat = 0; V.wheatLock = false; }
  if (V.energyFactor === undefined) V.energyFactor = 1;
}

// Every step (from stepSystems): recharge rate, capacitor, weapon heat.
function stepEnergy(B, V, dt) {
  if (!V.energyNeed) return;
  const surplus = Math.max(0, V.powerMade * (V.heatMul || 1) - V.powerDraw);
  let need = 0;
  for (const w of V.weapons) if (w.def.energy && w.reload > 0 && V.parts[w.part].alive) need -= w.def.power;
  let f = need ? Math.min(1, surplus / need) : 1;
  if (need && f < 1 && V.capCharge > 0) {
    // The capacitor makes up the shortfall while it lasts.
    const short = (need - surplus) * dt;
    const take = Math.min(short, V.capCharge);
    V.capCharge -= take;
    f = Math.min(1, (surplus * dt + take) / (need * dt));
  } else if (V.capCharge < V.capMax) V.capCharge = Math.min(V.capMax, V.capCharge + Math.max(0, surplus - need) * dt);
  V.energyFactor = V.empT > 0 ? 0 : f;
  // Weapon heat.
  if (V.wheat > 0) V.wheat = Math.max(0, V.wheat - (EN.cool + (V.radiators || 0) * EN.coolRadiator) * dt);
  if (V.wheatLock && V.wheat <= EN.heatResume) {
    V.wheatLock = false;
    if (V.side === 0) floatText('Energy weapons ready', V.body.x, V.body.y + V.height + 1, false);
  }
}

// From fireWeapon: may an energy weapon fire now? Adds its heat if so.
function energyShot(B, V, w) {
  if (V.wheatLock) return false;
  V.wheat += w.def.heat || 0;
  if (V.wheat >= EN.heatMax) {
    V.wheatLock = true;
    if (V.side === 0 || V.seen) floatText('Energy weapons overheated', V.body.x, V.body.y + V.height + 1.5, V.side !== 0);
  }
  return true;
}

// A laser shot's glowing line, from the muzzle to the first thing it meets (the damage itself is
// done by a very fast shell).
const beams = makePool(() => ({ alive: false, x0: 0, y0: 0, x1: 0, y1: 0, t: 0, side: 0, w: 1 }), 16);
function laserBeam(B, V, x, y, ang, d) {
  const range = weaponRange(d);
  const cx = Math.cos(ang), cy = Math.sin(ang);
  let L = range;
  for (let k = 1; k < range; k += 1) {
    const px = x + cx * k, py = y + cy * k;
    if (py <= B.T.height(px) || (seaAt(B.T, px) && py < B.T.sea)) { L = k; break; }
    let hit = false;
    for (const U of B.units) if (U !== V && !U.gone && U.side !== V.side && Math.hypot(U.body.x - px, U.body.y + U.height * 0.4 - py) < U.radius * 0.6) { hit = true; break; }
    if (hit) { L = k; break; }
  }
  const b = beams.take();
  b.x0 = x; b.y0 = y; b.x1 = x + cx * L; b.y1 = y + cy * L; b.t = 0; b.side = V.side; b.w = d.cal / 20;
  // Heat shimmer at the impact point.
  const p = spawnParticle(FX_FLASH, b.x1, b.y1, 0, 0, 0.08, 0.6 + b.w * 0.3);
  if (p) p.shade = ang;
  audio.sfx('laser', B.panOf(x), b.w);
}
function stepBeams(dt) { beams.forEachAlive((b) => { b.t += dt; if (b.t > 0.14) b.alive = false; }); }

// ---------- flamethrowers: automatic, close range; they burn fuel and set parts alight.
function stepFlame(B, V, w, dt, aiControlled) {
  const d = w.def, reach = d.range * EN.flameReach;
  w.flameT = (w.flameT || 0) - dt;
  if (V.fuelMax > 0 && V.fuel <= 0) return;
  if (B.cfg.holdFire && V.side === 1) return;
  const T = nearestTarget(B, V, reach + 4, (U) => !U.flier || U.domain === 'airship');
  if (!T) return;
  weaponPivot(V, w, _p);
  const tx = T.body.x, ty = T.body.y + T.height * 0.4;
  if (Math.hypot(tx - _p.x, ty - _p.y) > reach + T.radius * 0.5) return;
  const ang = Math.atan2(ty - _p.y, tx - _p.x);
  aimWeapon(V, w, tx, ty, _aim);
  if (!trainWeapon(V, w, _aim.angle, _aim.face, dt) || !_aim.ok) return;
  if (V.fuelMax > 0) V.fuel = Math.max(0, V.fuel - EN.flameFuel * dt);
  // The stream: orange turning to smoke.
  if (B.rng.next() < dt * 40) {
    const a = w.angle + (gauss(B.rng) * d.spread * Math.PI) / 180, sp = B.rng.range(10, 16);
    const f = spawnParticle(FX_FIRE, _p.x + Math.cos(a) * 1.2, _p.y + Math.sin(a) * 1.2, Math.cos(a) * sp + V.body.vx, Math.sin(a) * sp, reach / sp, B.rng.range(0.5, 1));
    if (f) f.grow = 1.2;
  }
  if (w.flameT <= 0) { w.flameT = 0.5; audio.sfx('flame', B.panOf(_p.x)); }
  // Burn the two parts nearest where the stream strikes (30 per second each, less fire resistance).
  const hx = tx - Math.cos(ang) * T.len * 0.3, hy = ty;
  let i1 = -1, i2 = -1, d1 = Infinity, d2 = Infinity;
  for (let i = 0; i < T.parts.length; i++) {
    const p = T.parts[i];
    if (!p.alive) continue;
    gridToLocal(T, (p.x + p.def.w / 2) * CELL, (T.design.h - p.y - p.def.h / 2) * CELL, _q);
    localToWorld(T, _q.x, _q.y, _q);
    const k = Math.hypot(_q.x - hx, _q.y - hy);
    if (k < d1) { i2 = i1; d2 = d1; i1 = i; d1 = k; } else if (k < d2) { i2 = i; d2 = k; }
  }
  for (const i of [i1, i2]) {
    if (i < 0) continue;
    const p = T.parts[i];
    damagePart(B, T, i, d.dmg * dt, V, 'fire');
    if (B.rng.next() < EN.igniteChance * dt * (1 - resistOf(p.def, 'fire'))) {
      T.fires = T.fires || [];
      if (T.fires.length < 6) T.fires.push({ gx: (p.x + p.def.w / 2) * CELL, gy: (T.design.h - p.y - p.def.h / 2) * CELL, t: 8 });
    }
  }
  T.revealT = Math.max(T.revealT || 0, 1);
  V.revealT = Math.max(V.revealT, 2);
}
const _q = { x: 0, y: 0 };

// ---------- damage types
const resistOf = (def, type) => (type && def.resist && def.resist[type]) || 0;

// ---------- drawing
function drawBeams(g) {
  const S = view.S;
  beams.forEachAlive((b) => {
    const k = 1 - b.t / 0.14;
    const x0 = view.sx(b.x0), y0 = view.sy(b.y0), x1 = view.sx(b.x1), y1 = view.sy(b.y1);
    g.globalAlpha = 0.45 * k;
    g.strokeStyle = b.side === 0 ? '#7FD3FF' : '#FF8A6B';        // the side's glow
    g.lineWidth = Math.max(3, S * 0.25 * b.w);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.globalAlpha = k;
    g.strokeStyle = '#FFFFFF';
    g.lineWidth = Math.max(1.2, S * 0.07 * b.w);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  });
  g.globalAlpha = 1;
}
// A plasma bolt (from drawShells): violet glow, hot core.
function drawPlasmaBolt(g, s) {
  const S = view.S, x = view.sx(s.x), y = view.sy(s.y), r = Math.max(2, S * 0.18 * (s.def.cal / 90));
  g.globalAlpha = 0.5;
  g.fillStyle = '#B784FF';
  g.beginPath(); g.arc(x, y, r * 2.2, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1;
  g.fillStyle = '#FFE08A';
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}
