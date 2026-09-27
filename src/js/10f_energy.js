/* ==== 10f ENERGY WEAPONS AND FIRE ==== */
// Lasers, plasma and flamethrowers (design/05 §3.3–§3.4; design/06 Part 5). Energy weapons use
// no ammo: they recharge from the vehicle's spare power (engines' output minus what the other
// parts draw), topped up by capacitor banks, and every shot heats the vehicle. Overheating slows
// the recharge and, at 90%, stops it. Lasers hit at once along a beam; plasma flies as a slow
// straight bolt. Flamethrowers burn fuel and set parts alight. Damage types meet the materials'
// resistances (materials.json `resist`: fire, plasma, acid, laser, emp; 1 = full damage).

const beams = makePool(() => ({ alive: false, x0: 0, y0: 0, x1: 0, y1: 0, t: 0, life: 0, w: 1, col: '' }), 16);
const flames = makePool(() => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0 }), 90);
const ENERGY_LOCK = 0.9;          // overheat share at which energy weapons stop recharging
const HEAT_POOL_SECS = 2;         // a shot's heat is shed into the heat balance over about this long
const BEAM_STEP = 3;              // metres per beam trace step

// Resistance multiplier of a part against a damage type.
const resistOf = (def, type) => (type && def.resist && def.resist[type] !== undefined ? def.resist[type] : 1);

// Per vehicle, each step: charge rate for energy weapons, capacitors, and shot heat.
function stepEnergy(B, V, dt) {
  if (V.heatPool > 0) { const out = Math.min(V.heatPool, (V.heatPool / HEAT_POOL_SECS) * dt); V.heatPool -= out; }
  if (!V.energyDraw) { V.energyRate = 1; return; }
  let demand = 0;
  for (const w of V.weapons) if (w.def.energy && w.reload > 0 && V.parts[w.part].alive) demand += -w.def.power;
  const spare = Math.max(0, V.power * (V.heatMul || 1) - V.stats.drawn);
  let rate = demand ? Math.min(1, spare / demand) : 1;
  if (demand && rate < 1 && V.cap > 0) {
    const need = demand * (1 - rate) * dt;          // kJ this step
    const got = Math.min(V.cap, need);
    V.cap -= got;
    rate += got / (demand * dt);
  } else if (V.capMax) V.cap = Math.min(V.capMax, V.cap + (spare - demand * rate) * dt);
  const over = V.overheat || 0;
  V.energyRate = over >= ENERGY_LOCK ? 0 : rate * (1 - over);
  if (V.side === 0 && over >= ENERGY_LOCK && B.time - (V.lockNoteT || -99) > 8) {
    V.lockNoteT = B.time;
    floatText('Energy weapons: too hot', V.body.x, V.body.y + V.height + 1.5, false);
  }
}

// A laser shot: trace the beam until it stops in a vehicle or the ground.
const _beam = { x: 0, y: 0, px: 0, py: 0, sx: 0, sy: 0, vx: 0, vy: 0, def: null, dmg: 0, he: false, mg: false, beam: true, shooter: null, side: 0, ignore: null, ignoreT: 0, dtype: '' };
function fireBeam(B, V, w, a, x0, y0) {
  const d = w.def, T = B.T, range = weaponRange(d);
  const s = _beam;
  Object.assign(s, { sx: x0, sy: y0, vx: Math.cos(a) * 1000, vy: Math.sin(a) * 1000, def: d, dmg: d.dmg, shooter: V, side: V.side, ignore: V, dtype: d.dtype });
  let x = x0, y = y0, end = range;
  for (let t = 0; t < range; t += BEAM_STEP) {
    s.px = x; s.py = y;
    x = x0 + Math.cos(a) * (t + BEAM_STEP); y = y0 + Math.sin(a) * (t + BEAM_STEP);
    s.x = x; s.y = y;
    let hit = false;
    for (const U of B.units) {
      if (U === V || U.gone || (U.side === V.side && !U.destroyed)) continue;
      if (Math.hypot(U.body.x - x, U.body.y - y) > U.radius + BEAM_STEP) continue;
      if (shellVsVehicle(B, s, U)) { hit = true; break; }
    }
    if (hit) { end = t + BEAM_STEP; break; }
    if (y <= T.height(x) || (seaAt(T, x) && y < T.sea - 1)) { end = t + BEAM_STEP; fxDirt(B, x, T.height(x), 2); break; }
  }
  const b = beams.take();
  if (b) Object.assign(b, { x0, y0, x1: x0 + Math.cos(a) * end, y1: y0 + Math.sin(a) * end, t: 0, life: d.pen > 100 ? 0.22 : 0.14, w: d.pen > 100 ? 3.2 : 1.8, col: '#7FF3FF' });
  fxSparks(B, x0 + Math.cos(a) * end, y0 + Math.sin(a) * end, a + Math.PI, 4);
}

// Flamethrowers fire by themselves at the nearest enemy in reach, burning fuel.
function stepFlame(B, V, w, dt, aiControlled) {
  const d = w.def;
  if (V.destroyed || (B.cfg.holdFire && V.side === 1)) return;
  if (V.fuelMax && V.fuel <= 0) return;
  const T = nearestTarget(B, V, weaponRange(d), () => true);
  if (!T) { w.burning = false; return; }
  const tmp = _flameAim;
  aimPoint(B, T, tmp);
  aimWeapon(V, w, tmp.x, tmp.y, _aim);
  if (!trainWeapon(V, w, _aim.angle, _aim.face, dt) || !_aim.ok) return;
  w.burning = true;
  if (V.fuelMax) V.fuel = Math.max(0, V.fuel - d.fuelBurn * dt);
  weaponPivot(V, w, _p);
  const L = barrelLength(d), a = w.angle;
  const mx = _p.x + Math.cos(a) * L, my = _p.y + Math.sin(a) * L;
  // The stream: fire particles that live as long as it takes to cross the reach.
  for (let k = 0; k < 2; k++) {
    const f = flames.take();
    if (!f) break;
    const sp = 22 + B.rng.next() * 6, aa = a + (B.rng.next() - 0.5) * (d.spread * Math.PI) / 90;
    Object.assign(f, { x: mx, y: my, vx: Math.cos(aa) * sp + V.body.vx, vy: Math.sin(aa) * sp + V.body.vy, t: 0, life: weaponRange(d) / sp });
  }
  // Damage: the parts of the target facing the nozzle, if in reach.
  if (Math.hypot(tmp.x - mx, tmp.y - my) <= weaponRange(d) + T.radius) {
    // The nozzle in the target's grid; the nearest live part burns.
    worldToGrid(T, mx, my, _flameAim);
    const gx = _flameAim.x / CELL, gy = T.design.h - _flameAim.y / CELL;
    let best = -1, bd = Infinity;
    for (let i = 0; i < T.parts.length; i++) {
      const p = T.parts[i];
      if (!p.alive) continue;
      const dd = Math.hypot(p.x + p.def.w / 2 - gx, p.y + p.def.h / 2 - gy);
      if (dd < bd) { bd = dd; best = i; }
    }
    if (best >= 0) {
      damagePart(B, T, best, d.dmg * dt * aiAccuracyFactor(V), V, d.dtype);
      T.lastHitT = B.time;
      if (T === B.me && B.rng.next() < dt * 2) haptic('hit');
    }
  }
  if ((w.hiss = (w.hiss || 0) - dt) <= 0) { w.hiss = 0.5; audio.sfx('tick', B.panOf(mx), 0.6); }
  V.revealT = 2;
}
const _flameAim = { x: 0, y: 0 };
const aiAccuracyFactor = (V) => (V.ai ? clamp(V.ai.accuracy, 0.5, 1.5) : 1);

function stepFlames(B, dt) {
  flames.forEachAlive((f) => {
    f.t += dt;
    f.vy += 3 * dt;                        // flames rise a little
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.t >= f.life || f.y <= B.T.height(f.x)) f.alive = false;
  });
  beams.forEachAlive((b) => { b.t += dt; if (b.t >= b.life) b.alive = false; });
}

// ---------- drawing (called from the battle renderer)
function drawEnergy(g) {
  g.lineCap = 'round';
  beams.forEachAlive((b) => {
    const k = 1 - b.t / b.life;
    g.globalAlpha = k * 0.45;
    g.strokeStyle = b.col; g.lineWidth = b.w * 3;
    g.beginPath(); g.moveTo(view.sx(b.x0), view.sy(b.y0)); g.lineTo(view.sx(b.x1), view.sy(b.y1)); g.stroke();
    g.globalAlpha = k;
    g.strokeStyle = '#FFFFFF'; g.lineWidth = b.w;
    g.beginPath(); g.moveTo(view.sx(b.x0), view.sy(b.y0)); g.lineTo(view.sx(b.x1), view.sy(b.y1)); g.stroke();
  });
  const S = view.S;
  flames.forEachAlive((f) => {
    const k = f.t / f.life;
    g.globalAlpha = 0.85 * (1 - k);
    g.fillStyle = k < 0.3 ? '#FFE9A0' : k < 0.65 ? '#FF9A2E' : '#C8461E';
    g.beginPath(); g.arc(view.sx(f.x), view.sy(f.y), (0.25 + k * 0.9) * S, 0, Math.PI * 2); g.fill();
  });
  g.globalAlpha = 1;
}
