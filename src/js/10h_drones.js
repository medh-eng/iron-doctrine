/* ==== 10h DRONES AND CARRIERS ==== */
// Drones, drone hangars and aircraft carriers (design/01 §5; design/05 §3.4; design/06 Part 5).
// Drones are designed in the Drafting Office's Drone tab; the carrier's drone computers set how
// many fly at once and the largest drone grid they can handle. Hangars hold and launch them.
// Drones fly by simple steering (no aerodynamics): they hover near their target and use their
// guns, lasers or charges. Orders: Attack, Guard (circle the carrier), Recall (land and rearm).
// When the carrier retreats or is lost, its drones and its air wing are lost with it.

const DRONE_GRID = { drone_1: 1, drone_2: 2, drone_3: 3 };
const DRONE_ORDERS = ['attack', 'guard', 'recall'];
const DRONE_ALT = 14;             // metres above ground a drone hovers at
const DRONE_STAND_OFF = 12;       // metres from its target a gun drone hovers
const DRONE_DOWN = 0.5;           // a drone falls below this share of its hit points

const DEFAULT_DRONE = { id: 'dr_std', name: 'Standard drone', kind: 'drone', w: 8, h: 4,
  cells: [['drotor', 1, 0], ['drotor', 4, 0], ['dcam', 2, 1], ['dcore', 3, 1], ['dgun', 4, 1]].map(([p, x, y]) => ({ p, x, y })) };

function droneDesign(id) {
  if (!id || id === DEFAULT_DRONE.id) return DEFAULT_DRONE;
  return save.designs.list.find((x) => x.id === id && x.kind === 'drone') || null;
}

const _dstats = new Map();
function droneStats(d) {
  const key = d.id + ':' + d.cells.map((c) => c.p + c.x + c.y).join(',');
  if (_dstats.has(key)) return _dstats.get(key);
  let mass = 0, lift = 0, core = 0, guns = 0, charge = 0, lasers = 0;
  for (const c of d.cells) {
    const P = PARTS[c.p];
    if (!P) continue;
    mass += P.mass;
    if (P.liftForce) lift += P.liftForce;
    if (P.core) core++;
    if (P.kamikaze) charge += P.dmg;
    if (P.auto) guns++;
    if (P.beam) lasers++;
  }
  const ratio = mass ? lift / (mass * GRAVITY) : 0;
  const cls = classFor(d);
  const errors = [];
  if (!core) errors.push('Needs a drone core.');
  if (ratio < 1.2) errors.push(`Lift ${ratio.toFixed(2)} × its weight; needs 1.2 or more.`);
  if (!cls) errors.push('Outside the drone grids.');
  const out = { mass, lift, ratio, speed: clamp(8 + 5 * (ratio - 1), 6, 26), guns, lasers, charge, grid: cls ? DRONE_GRID[cls.id] : 9, cls: cls ? cls.id : null, errors,
    cost: d.cells.reduce((a, c) => a + (PARTS[c.p] ? partCost(PARTS[c.p]) : 0), 0) };
  _dstats.set(key, out);
  return out;
}

// Carriers: hangars, computers and what they carry (called when a vehicle is made).
function initHangars(V) {
  let dcap = 0, drate = 0, control = 0, grid = 0, acap = 0, arate = 0;
  for (const p of V.parts) {
    const d = p.def;
    if (d.hangar === 'drone') { dcap += d.capacity; drate += d.rate; }
    if (d.hangar === 'aircraft') { acap += d.capacity; arate += d.rate; }
    if (d.control) { control += d.control; grid = Math.max(grid, d.grid); }
  }
  V.droneCap = dcap;
  if (!dcap && !acap) return;
  const want = droneDesign(V.design.drone);
  const ok = want && !droneStats(want).errors.length && droneStats(want).grid <= grid;
  V.droneDesign = ok ? want : DEFAULT_DRONE;
  V.droneStock = dcap; V.droneRate = drate; V.droneControl = control; V.drones = []; V.droneOrder = 'attack'; V.launchT = 1;
  V.wingDesign = V.design.wing && (TEMPLATES[V.design.wing] || save.designs.list.find((x) => x.id === V.design.wing)) ? V.design.wing : 'fighter';
  V.wingStock = acap; V.wingRate = arate; V.wing = []; V.wingT = 2;
}

// Once per battle step: launches, losses when the carrier goes, drones landing.
function stepCarriers(B, dt) {
  const n = B.units.length;
  for (let i = 0; i < n; i++) {
    const V = B.units[i];
    if (V.destroyed || V.pulling || (!V.droneCap && !V.wingStock)) continue;
    const enemy = B.units.some((U) => U.side !== V.side && !U.destroyed && U.seen && !U.drone);
    // Drones: up to what the computers control, one per 1/rate seconds.
    if (V.droneCap && V.droneControl && V.droneOrder !== 'recall' && V.droneStock > 0 && enemy) {
      V.launchT -= dt;
      const up = V.drones.filter((D) => !D.destroyed && !D.gone).length;
      if (V.launchT <= 0 && up < V.droneControl) { V.launchT = 1 / Math.max(0.05, V.droneRate); launchDrone(B, V); }
    }
    // Air wing: aircraft take off from the deck.
    if (V.wingStock > 0 && enemy) {
      V.wingT -= dt;
      if (V.wingT <= 0) { V.wingT = 1 / Math.max(0.02, V.wingRate); launchWing(B, V); }
    }
  }
  // Drones and aircraft whose carrier retreated or was lost go down with it.
  for (const U of B.units) {
    if (!U.carrier || U.destroyed) continue;
    const C = U.carrier;
    if (C.destroyed || C.withdrawn || C.gone) {
      if (!U.lostShown) { U.lostShown = true; if (U.side === 0 || U.seen) floatText(U.drone ? 'Drone lost' : 'Aircraft lost', U.body.x, U.body.y + 1.5, U.side === 1); }
      if (U.drone) droneDown(B, U, 'Carrier gone'); else knockOut(B, U, null, 'Carrier gone');
    }
  }
  for (const U of B.units) if (U.drone && U.destroyed && !U.gone) droneThink(B, U, dt);   // falling
  for (let i = B.units.length - 1; i >= 0; i--) if (B.units[i].drone && B.units[i].gone) B.units.splice(i, 1);
}

function launchDrone(B, V) {
  const d = JSON.parse(JSON.stringify(V.droneDesign));
  d.paint = V.design.paint;
  const D = makeVehicle(d, V.side, V.body.x, V.dir, B.T);
  D.drone = true; D.kinematic = true; D.flier = true; D.carrier = V;
  D.body.y = V.body.y + V.height + 1.5; D.body.a = 0;
  D.ai = makeAI('drone', B.cfg);
  D.droneSpeed = droneStats(V.droneDesign).speed;
  D.label = '';
  D.seen = V.side === 0;
  B.units.push(D);
  V.drones.push(D);
  V.droneStock--;
  if (V.side === 0 || V.seen) floatText('Drone launched', V.body.x, V.body.y + V.height + 2, false);
  audio.sfx('tick', B.panOf(V.body.x), 1.6);
}

function launchWing(B, V) {
  const d = TEMPLATES[V.wingDesign] ? designFromTemplate(V.wingDesign) : JSON.parse(JSON.stringify(save.designs.list.find((x) => x.id === V.wingDesign)));
  d.paint = V.design.paint;
  const A = makeVehicle(d, V.side, V.body.x, V.dir, B.T);
  launchFlier(A, B.T, 30);
  A.ai = makeAI(V.side === 0 ? 'squad' : 'attack', B.cfg);
  A.carrier = V;
  A.label = '';
  B.units.push(A);
  V.wing.push(A);
  V.wingStock--;
  if (V.side === 0 || V.seen) floatText('Aircraft launched', V.body.x, V.body.y + V.height + 2, false);
}

// A drone's steering and choices.
function droneThink(B, D, dt) {
  const b = D.body, T = B.T;
  const ground = Math.max(T.height(b.x), seaAt(T, b.x) ? T.sea : -Infinity);
  if (D.destroyed) {
    b.vy -= GRAVITY * dt; b.y += b.vy * dt; b.x += b.vx * dt; b.a += dt * 2;
    if (b.y <= ground) { D.gone = true; fxDirt(B, b.x, ground, 3); }
    return;
  }
  const C = D.carrier;
  const order = C.side === 0 ? C.droneOrder : 'attack';
  const tgt = nearestTarget(B, D, 250, (U) => !U.drone);
  if (tgt !== D.ai.target) { D.ai.target = tgt; D.ai.react = 0.3; }
  if (D.ai.react > 0) D.ai.react -= dt;
  let gx = C.body.x, gy = C.body.y + C.height + DRONE_ALT;
  const kamikaze = D.parts.some((p) => p.alive && p.def.kamikaze);
  if (order === 'attack' && tgt) {
    if (kamikaze) { gx = tgt.body.x; gy = tgt.body.y + tgt.height * 0.3; }
    else { const side = D.body.x <= tgt.body.x ? -1 : 1; gx = tgt.body.x + side * DRONE_STAND_OFF; gy = Math.max(T.height(gx), tgt.body.y) + DRONE_ALT * 0.7; }
  } else if (order === 'guard' || (order === 'attack' && !tgt)) {
    gx = C.body.x + Math.sin(B.time * 0.8 + D.id) * 8; gy = C.body.y + C.height + DRONE_ALT;
  }
  const dx = gx - b.x, dy = gy - b.y, dist = Math.hypot(dx, dy);
  const v = Math.min(D.droneSpeed, dist * 2);
  b.vx = dist > 0.01 ? (dx / dist) * v : 0; b.vy = dist > 0.01 ? (dy / dist) * v : 0;
  b.x += b.vx * dt; b.y = Math.max(ground + 2.5, b.y + b.vy * dt);
  b.a = clamp(-b.vx * 0.02, -0.3, 0.3);
  D.dir = tgt ? (tgt.body.x >= b.x ? 1 : -1) : C.dir;
  // Recall: land on the carrier and go back in the hangar.
  if (order === 'recall' && dist < 2.5) { D.gone = true; D.destroyed = true; C.droneStock++; return; }
  // A charge drone strikes.
  if (kamikaze && tgt && order === 'attack' && Math.hypot(tgt.body.x - b.x, tgt.body.y - b.y) < tgt.radius * 0.8 + 1) {
    const dmg = D.parts.reduce((a, p) => a + (p.alive && p.def.kamikaze ? p.def.dmg : 0), 0);
    explode(B, b.x, b.y, dmg, 2.5, D);
    droneDown(B, D, '');
    D.gone = true;
  }
}

// A drone out of action: a small burst, then it falls.
function droneDown(B, D, label) {
  if (D.destroyed) return;
  D.destroyed = true; D.koLabel = label || 'Drone down'; D.throttle = 0;
  fxExplosion(B, D.body.x, D.body.y, 0.35);
  if (label && (D.side === 0 || D.seen)) floatText(label, D.body.x, D.body.y + 1.2, D.side === 1);
  if (B.onDestroyed && D.side === 1) B.stats.kills++;
}

function setDroneOrder(V, order) { if (V.droneCap) V.droneOrder = order; }
