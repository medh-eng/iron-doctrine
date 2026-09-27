/* ==== 09c PHYSICS: WATER ==== */
// Ships (design/01 §7.3, design/05 §7.3, design/04 §6): every watertight cell below the
// surface pushes up with the weight of the water it displaces, so draft, trim and list
// come from where the parts sit. Propellers in the water push the hull; the hull drags
// on its submerged cross-section. Holed watertight parts below the waterline let water
// in, which spreads through the hull until a bulkhead stops it.

// Battle speeds are scaled like ground speed caps (BATTLE_SPEED_SCALE): top speed goes
// with the cube root of power ÷ drag, so the drag is raised by 1 ÷ scale³.
const SHIP_BATTLE_DRAG = 1 / (BATTLE_SPEED_SCALE * BATTLE_SPEED_SCALE * BATTLE_SPEED_SCALE);
const WATER_DAMPING = 0.6;        // damping ratio of the heave and pitch motion
const FLOOD_TICK = 0.1;           // seconds between flooding updates
const MAX_HOLES = 3;              // shell holes remembered per part

// A shell went through a watertight part: remember the hole (grid cell, y counted from the bottom).
function addHole(V, idx, cx, cy) {
  const p = V.parts[idx];
  p.holes = p.holes || [];
  if (p.holes.length < MAX_HOLES) p.holes.push({ gx: (cx + 0.5) * CELL, gy: (cy + 0.5) * CELL });
}

// Is there sea at world x? (The sea runs from T.seaX0 to the right edge.)
function seaAt(T, x) { return T.seaX0 !== undefined && x >= T.seaX0; }

// Called from rebuildVehicle: the watertight cells, propellers and thrusters of the live parts.
function buildWaterParts(V) {
  const D = V.design;
  if (V.hull === undefined) {
    V.hull = hullOf(D);
    V.fullAdj = V.hull ? adjacency(D, occupancy(D)) : null;       // all parts, alive or not
  }
  V.compCache = null;
  if (!V.hull) { V.wcells = null; V.props = null; return; }
  const wcells = [], props = [], ballast = [], engines = [];
  let thrusters = 0, n = 0;
  const tmp = { x: 0, y: 0 };
  V.parts.forEach((p, i) => {
    const d = p.def;
    if (d.sealed) {
      p.cap = d.w * d.h * V.hull.cellVol * d.sealed * 1000;       // kg of water it can hold
      if (p.water === undefined) p.water = 0;
    }
    if (!p.alive) return;
    if (d.sealed) {
      for (let yy = p.y; yy < p.y + d.h; yy++) for (let xx = p.x; xx < p.x + d.w; xx++) {
        gridToLocal(V, (xx + 0.5) * CELL, (D.h - yy - 0.5) * CELL, tmp);
        wcells.push({ lx: tmp.x, ly: tmp.y, vol: V.hull.cellVol * d.sealed, part: i });
        n++;
      }
    }
    if (d.propeller) {
      gridToLocal(V, (p.x + 0.5) * CELL, (D.h - p.y - d.h + 0.25) * CELL, tmp);
      props.push({ lx: tmp.x, ly: tmp.y, part: i });
    }
    if (d.thruster) thrusters++;
    if (d.ballast) { ballast.push(i); if (p.bw === undefined) p.bw = 0; }
    if (d.power > 0) engines.push(i);
  });
  V.ballast = ballast.length ? ballast : null;
  V.engineParts = engines;
  V.wcells = wcells;
  V.props = props;
  V.buoyFull = wcells.reduce((sum, w) => sum + w.vol * 1000, 0);    // kg of water the live hull displaces fully under
  V.thrusters = thrusters;
  // Per-cell damping: a share of the critical damping of the whole hull.
  const k = (1000 * GRAVITY * V.hull.cellVol) / CELL;
  V.wDamp = 2 * WATER_DAMPING * Math.sqrt((k * V.body.m) / Math.max(1, n * 0.4));
  V.draftNeed = (V.stats.draft || 0) + 0.8;
}

// Buoyancy, flooding weight, water drag and propeller thrust for one physics substep.
// Adds into out.fx, out.fy, out.tq. h = substep length.
function waterForces(V, T, ca, sa, throttle, h, out) {
  const b = V.body;
  const sea = T.sea;
  let fx = 0, fy = 0, tq = 0, sub = 0;
  if (V.wcells) {
    const c = V.wDamp;
    for (let i = 0; i < V.wcells.length; i++) {
      const w = V.wcells[i];
      const rx = w.lx * ca - w.ly * sa, ry = w.lx * sa + w.ly * ca;
      if (b.x + rx < T.seaX0) continue;
      const f = clamp((sea - (b.y + ry)) / CELL + 0.5, 0, 1);
      if (f <= 0) continue;
      // Damping is strongest for cells cutting the surface (waves carry the energy away);
      // cells deep under only feel ordinary drag.
      const vpy = b.vy + b.w * rx;
      const Fy = 1000 * GRAVITY * w.vol * f - c * 4 * f * (1 - f) * vpy - 125 * V.hull.beam * f * vpy * Math.abs(vpy);
      fy += Fy;
      tq += rx * Fy;
      sub += w.vol * f;
    }
    // Water inside flooded parts and ballast tanks weighs on them where they are.
    for (let i = 0; i < V.parts.length; i++) {
      const p = V.parts[i];
      if (!(p.water || p.bw) || !p.alive) continue;
      const lx = ((p.x + p.def.w / 2) * CELL - V.com.x) * V.dir, ly = (V.design.h - p.y - p.def.h / 2) * CELL - V.com.y;
      const rx = lx * ca - ly * sa;
      const F = ((p.water || 0) + (p.bw || 0)) * GRAVITY;
      fy -= F;
      tq -= rx * F;
    }
    // Hull resistance on the submerged cross-section.
    if (sub > 0) {
      const A = sub / V.hull.length;
      fx -= 0.5 * 1000 * SHIP_CD * SHIP_BATTLE_DRAG * A * b.vx * Math.abs(b.vx);
    }
    // Propellers push along the hull while they are in the water.
    const vAlong = b.vx * ca + b.vy * sa;
    let wet = 0;
    for (const p of V.props) {
      if (!V.parts[p.part].alive) continue;
      const px = b.x + p.lx * ca - p.ly * sa, py = b.y + p.lx * sa + p.ly * ca;
      if (px >= T.seaX0 && py < sea - 0.1) wet++;
    }
    // Submerged, only electric motors run (design/05 §2); on the surface everything does.
    let power = V.power * (V.heatMul || 1), fuelled = V.fuelMax === 0 || V.fuel > 0;
    if (V.submerged) {
      power = 0;
      for (const i of V.engineParts) if (V.parts[i].alive && V.parts[i].def.electric) power += V.parts[i].def.power;
      fuelled = true;
    }
    const avail = power >= V.stats.drawn ? 1 : power / Math.max(V.stats.drawn, 1);
    if (throttle !== 0 && wet && V.canDrive && fuelled && power > 0) {
      const sign = throttle > 0 ? 1 : -1;
      const sm = V.speedMul || 1;
      const P = power * 1000 * PROP_EFF * avail * sm * sm * sm * (wet / V.props.length);
      let F = (P / Math.max(Math.abs(vAlong), 1.5)) * Math.abs(throttle);
      if (sign !== V.dir) F *= REVERSE_CAP;
      fx += ca * F * sign; fy += sa * F * sign;
    }
    // Manoeuvre thrusters: quicker stops and reversals.
    if (V.thrusters && V.canDrive && Math.abs(vAlong) > 0.05 && (throttle === 0 || Math.sign(throttle) !== Math.sign(vAlong))) {
      const F = Math.min(V.thrusters * THRUSTER_FORCE, (b.m * Math.abs(vAlong)) / h) * -Math.sign(vAlong);
      fx += ca * F; fy += sa * F;
    }
  } else {
    // Vehicles without a hull: the water only slows them down; they sink.
    const f = clamp((sea - (b.y - V.height / 2)) / Math.max(1, V.height), 0, 1);
    if (f > 0) {
      fx -= 1.5 * f * b.m * b.vx;
      fy -= 1.5 * f * b.m * b.vy;
      tq -= 1.5 * f * b.I * b.w;
    }
  }
  out.fx += fx; out.fy += fy; out.tq += tq;
}

// Parts reachable by water from part i (a breach or a holed part): through holed
// watertight parts and live parts that flood; bulkheads, keels and everything else stop it.
function floodCompartment(V, i) {
  V.compCache = V.compCache || {};
  if (V.compCache[i]) return V.compCache[i];
  const seen = new Uint8Array(V.parts.length);
  const out = [];
  const stack = [i];
  seen[i] = 1;
  if (V.parts[i].alive) out.push(i);
  while (stack.length) {
    const a = stack.pop();
    for (const k of V.fullAdj[a]) {
      if (seen[k]) continue;
      const p = V.parts[k];
      const pass = p.alive ? !!p.def.floods : !!p.def.sealed;
      if (!pass) continue;
      seen[k] = 1;
      stack.push(k);
      if (p.alive) out.push(k);
    }
  }
  // Water finds the lowest parts first.
  out.sort((a, b) => (V.parts[b].y + V.parts[b].def.h) - (V.parts[a].y + V.parts[a].def.h));
  V.compCache[i] = out;
  return out;
}

// How far under the surface a grid point (metres, y up) is, as a share of a cell (0..1).
function underWater(V, T, gx, gy, tmp) {
  gridToLocal(V, gx, gy, tmp);
  localToWorld(V, tmp.x, tmp.y, tmp);
  return tmp.x >= T.seaX0 ? clamp((T.sea - tmp.y) / CELL + 0.5, 0, 1) : 0;
}

// Flooding (design/05 §7.3): each holed-through (destroyed) watertight cell below the
// surface lets in FLOOD_RATE kg/s, and each shell hole HOLE_RATE; the water fills the
// compartment from the bottom up.
function stepFlooding(B, V, dt) {
  if (!V.hull || V.gone || !seaAt(B.T, V.body.x + V.len)) return;
  V.floodT = (V.floodT || 0) + dt;
  if (V.floodT < FLOOD_TICK) return;
  const step = V.floodT;
  V.floodT = 0;
  const T = B.T;
  const tmp = { x: 0, y: 0 };
  const D = V.design;
  for (let i = 0; i < V.parts.length; i++) {
    const p = V.parts[i];
    if (!p.def.sealed) continue;
    let rate = 0;
    if (!p.alive) {
      for (let yy = p.y; yy < p.y + p.def.h; yy++) for (let xx = p.x; xx < p.x + p.def.w; xx++) rate += FLOOD_RATE * underWater(V, T, (xx + 0.5) * CELL, (D.h - yy - 0.5) * CELL, tmp);
    } else if (p.holes && p.def.floods) {
      for (const h of p.holes) rate += HOLE_RATE * underWater(V, T, h.gx, h.gy, tmp);
    }
    if (rate <= 0) continue;
    let water = rate * step;
    for (const k of floodCompartment(V, i)) {
      const q = V.parts[k];
      const add = Math.min(water, q.cap - q.water);
      if (add <= 0) continue;
      q.water += add;
      water -= add;
      if (!p.flooding) {
        p.flooding = true;
        const at = gridCellToWorld(V, p.x, D.h - p.y - 1);
        if (V.side === 0 || V.seen) floatText('Flooding', at.x, at.y + 2, false);
        audio.sfx('flood', B.panOf(at.x));
      }
      if (water <= 0) break;
    }
  }
}

// Submarines (design/01 §7.3): the ballast tanks trim to hold the depth order.
// V.depthCmd = world height for the centre of mass, or null to surface (tanks blown).
// Also works out V.submerged (the whole hull under water) for the engines and sensors.
function subControl(V, T, dt) {
  if (!V.hull || V.gone) return;
  const b = V.body;
  V.submerged = seaAt(T, b.x) && b.y + (V.bounds.maxY - V.com.y) * Math.cos(b.a) < T.sea - 0.05;
  if (!V.ballast) return;
  let cap = 0, now = 0, flood = 0;
  for (const i of V.ballast) { const p = V.parts[i]; if (p.alive) { cap += p.def.ballast; now += p.bw; } }
  for (const p of V.parts) if (p.alive && p.water) flood += p.water;
  let want = 0;
  if (V.depthCmd !== null && V.depthCmd !== undefined && !V.destroyed) {
    // Level trim under water, plus a push toward the ordered depth, damped by the rate of climb.
    const neutral = V.buoyFull - b.m - flood;
    want = clamp(neutral + 1500 * (b.y - V.depthCmd) + 5000 * b.vy, 0, cap);
  }
  // Fore and aft tanks also trim the boat level: bow up takes water forward.
  const step = BALLAST_RATE * dt;
  const trim = V.depthCmd === null || V.depthCmd === undefined ? 0 : 3000 * b.a + 3000 * b.w;
  for (const i of V.ballast) {
    const p = V.parts[i];
    if (!p.alive) continue;
    const lx = ((p.x + p.def.w / 2) * CELL - V.com.x) * V.dir;
    const target = clamp((cap ? (want * p.def.ballast) / cap : 0) + trim * lx, 0, p.def.ballast);
    p.bw += clamp(target - p.bw, -step, step);
  }
}

// Sinking and drowning: a ship whose highest point is under water has sunk; a capsized
// ship is out; a land vehicle with its crew compartments under water is flooded.
function waterChecks(B, V) {
  const T = B.T;
  if (V.destroyed || V.gone || !seaAt(T, V.body.x + V.len / 2)) return;
  const b = V.body;
  const tmp = { x: 0, y: 0 };
  if (V.hull) {
    let top = -Infinity;
    for (const [gx, gy] of [[V.bounds.minX, V.bounds.maxY], [V.bounds.maxX, V.bounds.maxY], [(V.bounds.minX + V.bounds.maxX) / 2, V.bounds.maxY]]) {
      gridToLocal(V, gx, gy, tmp);
      localToWorld(V, tmp.x, tmp.y, tmp);
      top = Math.max(top, tmp.y);
    }
    if (V.ballast) {
      // A submarine is lost when, even with its tanks blown, it is too heavy to come up.
      let flood = 0;
      for (const p of V.parts) if (p.alive && p.water) flood += p.water;
      if (top < T.sea && b.m + flood > V.buoyFull) knockOut(B, V, V.lastHitBy, 'Sunk', true);
    } else if (top < T.sea - 0.1) knockOut(B, V, V.lastHitBy, 'Sunk', true);
    else if (Math.abs(b.a) > 1.35 && b.y < T.sea + 1) knockOut(B, V, V.lastHitBy, 'Capsized', true);
    return;
  }
  let crew = 0, wet = 0;
  V.parts.forEach((p) => {
    if (!p.alive || !p.def.crew) return;
    crew++;
    gridToLocal(V, (p.x + p.def.w / 2) * CELL, (V.design.h - p.y - p.def.h / 2) * CELL, tmp);
    localToWorld(V, tmp.x, tmp.y, tmp);
    if (tmp.x >= T.seaX0 && tmp.y < T.sea) wet++;
  });
  if (crew && wet === crew) knockOut(B, V, V.lastHitBy, 'Flooded', true);
}

// Ships keep to water deep enough for their keel; land vehicles stay out of the sea.
// Used for AI-driven vehicles only: the player may run aground or drive in.
function domainGuard(B, V) {
  if (!V.throttle) return;
  const T = B.T;
  const ahead = V.body.x + Math.sign(V.throttle) * (V.len / 2 + 4);
  if (V.hull) {
    if (!seaAt(T, ahead) || T.height(ahead) > T.sea - V.draftNeed) V.throttle = 0;
  } else if (seaAt(T, ahead) && T.height(ahead) < T.sea - 0.6) {
    V.throttle = 0;
  }
}
