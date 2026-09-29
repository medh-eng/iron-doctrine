/* ==== 10g DRONES ==== */
// Drones (Part 5c; design/01 §5, §10.5, design/05 §3.4). A drone is designed on a small grid set
// by the drone computer (I 8×4 / 6 parts, II 10×5 / 10, III 12×6 / 16) from a core, rotors and
// guns, charges or a camera. A carrier's drone hangars hold its drone design and launch one at
// a time; its best drone computer sets how many fly at once. Drones follow the carrier's drone
// order (attack, defend the carrier, scout, recall), don't count towards the three on the field,
// and are lost when their carrier is destroyed or leaves. They are light bodies of their own
// (B.drones), not vehicles: guns, blasts and machine guns hit them; they have no armour.

const DRONE_CLASSES = PART_LIBRARY.classes.drone || [];
const droneClass = (id) => DRONE_CLASSES.find((c) => c.id === id) || null;
const droneClassIndex = (id) => DRONE_CLASSES.findIndex((c) => c.id === id);
const ownDrones = () => (save.designs && Array.isArray(save.designs.drones) ? save.designs.drones : []);
function droneDesigns() { return [...Object.values(DRONE_TEMPLATES), ...ownDrones()]; }
function droneDesign(id) { return DRONE_TEMPLATES[id] || ownDrones().find((d) => d.id === id) || null; }
const DEFAULT_DRONE = 'drn_gun';

// Rule problems with a drone design, as plain sentences ([] = it flies).
function validateDrone(d) {
  const out = [];
  const cls = droneClass(d.class);
  if (!cls) return ['Choose a drone size.'];
  const cells = missileCells(d);
  const occ = new Set();
  let cores = 0, rotors = 0, mass = 0, lift = 0;
  for (const c of cells) {
    const P = PARTS[c.p];
    if (!P || !P.domains || !P.domains.includes('drone')) { out.push(`${P ? P.name : c.p} is not a drone part.`); continue; }
    for (let dy = 0; dy < P.h; dy++) for (let dx = 0; dx < P.w; dx++) {
      const k = `${c.x + dx},${c.y + dy}`;
      if (c.x + dx < 0 || c.y + dy < 0 || c.x + dx >= cls.grid[0] || c.y + dy >= cls.grid[1]) out.push(`${P.name} sticks out of the ${cls.name} grid.`);
      else if (occ.has(k)) out.push(`${P.name} overlaps another part.`);
      occ.add(k);
    }
    mass += P.mass;
    if (P.droneCore) cores++;
    if (P.droneRotor) { rotors++; lift += P.liftForce; }
  }
  if (cells.length > cls.parts) out.push(`${cells.length} parts; a ${cls.name} holds ${cls.parts}.`);
  if (cores !== 1) out.push(cores ? 'One drone core only.' : 'Needs a drone core.');
  if (!rotors) out.push('Needs a rotor.');
  else if (lift < mass * GRAVITY * DRN.liftMargin) out.push(`Too heavy for its rotors: lift ${Math.round(lift)} N, needs ${Math.round(mass * GRAVITY * DRN.liftMargin)} N.`);
  return [...new Set(out)];
}

// A drone design's numbers (cached on the design object; the Drone tab clears the cache).
function droneStats(d) {
  if (d._stats) return d._stats;
  let mass = 0, hp = 0, lift = 0, guns = 0, charge = 0, blast = 0, spot = 0, cost = 0;
  for (const c of missileCells(d)) {
    const P = PARTS[c.p];
    if (!P) continue;
    mass += P.mass; hp += P.hp; cost += partCost(P);
    if (P.droneRotor) lift += P.liftForce;
    if (P.droneGun && !P.beam) guns++;
    if (P.droneCharge) { charge += P.dmg; blast = Math.max(blast, P.blast); }
    if (P.droneCam) spot = Math.max(spot, P.spot);
  }
  const ratio = mass ? lift / (mass * GRAVITY) : 0;
  const cls = droneClass(d.class) || DRONE_CLASSES[0];
  const st = {
    id: d.id, name: d.name, cls: cls.id, mass, hp, cost, lift, ratio, guns, charge, blast, spot,
    speed: +(DRN.speed * clamp(Math.sqrt(ratio / 2), 0.5, 1.4)).toFixed(1),
    w: cls.grid[0], h: cls.grid[1], errors: validateDrone(d),
  };
  Object.defineProperty(d, '_stats', { value: st, configurable: true, enumerable: false });
  return st;
}

// ---------- carriers: set up when a vehicle is built (from rebuildVehicle)
function setupCarrier(V) {
  let cap = 0, cpu = 0, cpuCls = null, rate = 0, wcap = 0, wrate = 0;
  for (const p of V.parts) {
    if (!p.alive) continue;
    if (p.def.hangar === 'drone') { cap += p.def.capacity; rate += p.def.rate; }
    if (p.def.hangar === 'aircraft') { wcap += p.def.capacity; wrate += p.def.rate; }
    if (p.def.droneCpu && p.def.effect > cpu) { cpu = p.def.effect; cpuCls = p.def.droneCpu; }
  }
  V.hangarCap = cap; V.droneCpu = cpu; V.launchRate = rate;
  setupWing(V, wcap, wrate);
  if (!cap) return;
  if (V.dronesAboard === undefined) {
    V.dronesAboard = cap;                     // outside the campaign hangars start full
    V.droneOrder = 'attack';
    V.launchT = 1;
    // The design's drone if the computer can fly it, else the first library design that fits.
    const fits = (md) => md && !validateDrone(md).length && cpuCls && droneClassIndex(md.class) <= droneClassIndex(cpuCls);
    let md = droneDesign(V.design.drone || DEFAULT_DRONE);
    if (!fits(md)) md = [droneDesign(DEFAULT_DRONE), ...Object.values(DRONE_TEMPLATES)].find(fits) || null;
    V.droneSt = md ? droneStats(md) : null;
  }
  V.dronesAboard = Math.min(V.dronesAboard, cap);
}

const dronesOf = (B, V) => (B.drones || []).filter((d) => d.alive && d.carrier === V);
function dronesFlying(B, V) { let n = 0; for (const d of B.drones || []) if (d.alive && d.carrier === V) n++; return n; }

// Set a carrier's drone order ('attack', 'defend', 'scout' or 'recall').
function droneOrder(B, V, order) {
  if (!V.hangarCap && !V.wingCap) return 'No hangar';
  if (!V.wingCap && !V.droneCpu) return 'No drone computer';
  if (!V.wingCap && !V.droneSt) return 'No drone design fits the drone computer';
  V.wingT = Math.min(V.wingT || 0, 0.3);
  V.droneOrder = order;
  V.launchT = Math.min(V.launchT || 0, 0.3);
  return '';
}

function launchDrone(B, V) {
  const hi = V.parts.findIndex((p) => p.alive && p.def.hangar === 'drone');
  if (hi < 0) return false;
  const p = V.parts[hi];
  const at = gridCellToWorld(V, p.x + p.def.w / 2 - 0.5, V.design.h - p.y - 0.5);
  const st = V.droneSt;
  const d = { alive: true, x: at.x, y: at.y + 0.5, vx: V.body.vx, vy: 6, side: V.side, carrier: V, st, hp: st.hp, t: 0, gunT: 0.5, dir: V.dir, target: null, falling: false, seen: V.side === 0, flash: 0 };
  (B.drones = B.drones || []).push(d);
  V.dronesAboard--;
  B.stats.drones = (B.stats.drones || 0) + 1;
  const s = spawnParticle(FX_SMOKE, d.x, d.y, 0, 1, 0.8, 0.8);
  if (s) { s.grow = 1; s.shade = 0.8; }
  audio.sfx('clunk', B.panOf(d.x));       // the drone launch clack (design/03)
  return true;
}

// Nearest enemy the drones of carrier V may go for (seen, within reach of the carrier).
function droneTarget(B, dr) {
  let best = null, bd = Infinity;
  for (const U of B.units) {
    if (U.side === dr.side || U.destroyed || U.gone || !U.seen && dr.side === 0 || U.submerged) continue;
    const d = Math.abs(U.body.x - dr.x);
    if (d < bd && Math.abs(U.body.x - dr.carrier.body.x) < DRN.reach) { bd = d; best = U; }
  }
  return best;
}
function enemyDroneNear(B, side, x, y, r) {
  let best = null, bd = r;
  for (const d of B.drones || []) {
    if (!d.alive || d.side === side || d.falling) continue;
    const k = Math.hypot(d.x - x, d.y - y);
    if (k < bd) { bd = k; best = d; }
  }
  return best;
}

// Every step: carriers launch, drones fly their order, fight, return or fall.
function stepDrones(B, dt) {
  stepWings(B, dt);
  for (const V of B.units) {
    if (!V.hangarCap || V.destroyed || V.gone || V.withdrawn || !V.droneSt || V.empT > 0) continue;
    V.launchT -= dt;
    if (V.droneOrder === 'recall' || V.dronesAboard <= 0 || V.launchT > 0 || dronesFlying(B, V) >= V.droneCpu) continue;
    // AI carriers launch once an enemy is in reach; yours whenever the order stands.
    if (V.side === 1 && !B.units.some((U) => U.side === 0 && !U.destroyed && Math.abs(U.body.x - V.body.x) < DRN.reach)) continue;
    if (B.cfg && B.cfg.holdFire && V.side === 1) continue;
    if (launchDrone(B, V)) V.launchT = 1 / Math.max(0.05, V.launchRate);
  }
  const list = B.drones;
  if (!list || !list.length) return;
  for (const dr of list) if (dr.alive) stepDrone(B, dr, dt);
  if (list.length > 24) B.drones = list.filter((d) => d.alive);
}

function stepDrone(B, dr, dt) {
  const T = B.T, C = dr.carrier, st = dr.st;
  dr.t += dt;
  if (dr.flash > 0) dr.flash -= dt;
  // A drone whose carrier is gone falls (design/01 §10.5).
  if (!dr.falling && (C.destroyed || C.gone || C.withdrawn)) {
    dr.falling = true;
    if (!C.droneLossNoted && (C.side === 0 || C.seen)) { C.droneLossNoted = true; floatText('Drones lost', dr.x, dr.y + 2, C.side !== 0); }
  }
  const gy = Math.max(T.height(dr.x), seaAt(T, dr.x) ? T.sea : -1e9);
  if (dr.falling) {
    dr.vy -= GRAVITY * dt; dr.x += dr.vx * dt; dr.y += dr.vy * dt;
    if (dr.y <= gy) droneDown(B, dr, null);
    return;
  }
  // Where to go, by the carrier's order.
  let gx = C.body.x, gyGoal = C.body.y + C.height + DRN.alt * 0.6, shootAt = null;
  const order = C.droneOrder;
  if (order === 'recall') {
    gyGoal = C.body.y + C.height + 1;
    if (Math.hypot(dr.x - C.body.x, dr.y - gyGoal) < 2.5) { dr.alive = false; C.dronesAboard++; return; }
  } else if (order === 'scout') {
    const foe = B.units.find((U) => U.side !== dr.side && !U.destroyed);
    const dir = foe ? Math.sign(foe.body.x - C.body.x) || C.dir : C.dir;
    gx = C.body.x + dir * DRN.scoutAhead; gyGoal = T.height(gx) + DRN.alt * 1.5;
  } else {
    const U = droneTarget(B, dr);
    const guard = order === 'defend';
    // Defending: stay over the carrier and take on what comes close; attacking: go for the target.
    const foeDrone = enemyDroneNear(B, dr.side, dr.x, dr.y, DRN.gunRange);
    if (guard) {
      gx = C.body.x + Math.sin(dr.t * 0.7) * 8; gyGoal = C.body.y + C.height + DRN.alt;
      const near = U && Math.abs(U.body.x - C.body.x) < DRN.defend ? U : null;
      shootAt = foeDrone || near;
    } else if (U) {
      dr.target = U;
      if (st.charge) { gx = U.body.x; gyGoal = U.body.y + U.height * 0.4; }
      else { const side = Math.sign(dr.x - U.body.x) || -U.dir; gx = U.body.x + side * DRN.standoff; gyGoal = U.body.y + U.height + DRN.alt * 0.7; }
      shootAt = foeDrone || U;
    } else shootAt = foeDrone;
  }
  // Fly: steer the velocity toward the goal, keep clear of the ground.
  gyGoal = Math.max(gyGoal, gy + 3);
  const ex = gx - dr.x, ey = gyGoal - dr.y, dist = Math.hypot(ex, ey) || 1;
  const want = st.speed * Math.min(1, dist / 6);
  const k = Math.min(1, dt * 2.5);
  dr.vx += ((ex / dist) * want - dr.vx) * k;
  dr.vy += ((ey / dist) * want - dr.vy) * k + Math.sin(dr.t * 3) * 0.3 * dt;
  dr.x += dr.vx * dt; dr.y += dr.vy * dt;
  if (dr.y < gy + 1.5) { dr.y = gy + 1.5; dr.vy = Math.max(0, dr.vy); }
  if (Math.abs(dr.vx) > 0.5) dr.dir = Math.sign(dr.vx);
  // A strike drone dives into its target.
  if (st.charge && dr.target && !dr.target.destroyed && order === 'attack') {
    const U = dr.target;
    if (Math.abs(dr.x - U.body.x) < U.len * 0.5 + 0.5 && Math.abs(dr.y - (U.body.y + U.height * 0.4)) < U.height * 0.6 + 0.5) {
      B.stats.droneHits = (B.stats.droneHits || 0) + 1;
      droneDown(B, dr, C);
      explode(B, dr.x, dr.y, st.charge, st.blast, C);
      return;
    }
  }
  // Guns: short bursts at whatever it was told to fight.
  dr.gunT -= dt;
  if (st.guns && shootAt && dr.gunT <= 0 && !(C.empT > 0)) {
    const tx = shootAt.body ? shootAt.body.x : shootAt.x, ty = shootAt.body ? shootAt.body.y + shootAt.height * 0.5 : shootAt.y;
    if (Math.hypot(tx - dr.x, ty - dr.y) < DRN.gunRange) {
      dr.gunT = PARTS.dgun.reload;
      for (let i = 0; i < st.guns; i++) droneShot(B, dr, tx, ty, i);
    }
  }
}

function droneShot(B, dr, tx, ty, i) {
  const d = PARTS.dgun;
  const a = Math.atan2(ty - dr.y, tx - dr.x) + (gauss(B.rng) * d.spread * Math.PI) / 180 + i * 0.01;
  const s = shells.take();
  s.x = s.px = s.sx = dr.x + Math.cos(a) * 0.6; s.y = s.py = s.sy = dr.y + Math.sin(a) * 0.6;
  s.vx = Math.cos(a) * d.vel + dr.vx; s.vy = Math.sin(a) * d.vel + dr.vy;
  s.t = 0; s.side = dr.side; s.shooter = dr.carrier; s.def = d;
  s.dmg = d.dmg; s.mg = true; s.he = false; s.ignore = dr.carrier; s.ignoreT = 0.2; s.whistled = false; s.wet = false;
  B.stats.droneShots = (B.stats.droneShots || 0) + 1;
  audio.sfx('cannon', B.panOf(dr.x), 8);
}

// A drone destroyed: a small burst and falling bits.
function droneDown(B, dr, source) {
  dr.alive = false;
  fxSparks(B, dr.x, dr.y, Math.PI / 2, 6);
  const p = spawnParticle(FX_SMOKE, dr.x, dr.y, 0, 0.5, 1, 0.9);
  if (p) { p.grow = 1; p.shade = 0.3; }
  audio.sfx('crunch', B.panOf(dr.x), 0.6);
  if (!source) B.stats.dronesLost = (B.stats.dronesLost || 0) + 1;
}

function damageDrone(B, dr, dmg) {
  if (!dr.alive || dr.falling) return;
  dr.hp -= dmg;
  dr.flash = 0.1;
  if (dr.hp <= 0) { droneDown(B, dr, null); if (dr.side === 1) B.stats.dronesShot = (B.stats.dronesShot || 0) + 1; }
}

// From stepShells: a shell passing within half a metre of an enemy drone hits it.
function shellVsDrones(B, s) {
  for (const dr of B.drones) {
    if (!dr.alive || dr.side === s.side || dr.falling) continue;
    const ex = s.x - s.px, ey = s.y - s.py, l2 = ex * ex + ey * ey || 1;
    const t = clamp(((dr.x - s.px) * ex + (dr.y - s.py) * ey) / l2, 0, 1);
    if (Math.hypot(s.px + ex * t - dr.x, s.py + ey * t - dr.y) > DRN.hitR + (dr.st.w * 0.08)) continue;
    damageDrone(B, dr, s.he ? (s.def.heDmg || s.dmg) : s.dmg);
    fxSparks(B, dr.x, dr.y, Math.atan2(-s.vy, -s.vx), 3);
    return true;
  }
  return false;
}
// From explode: blasts hurt drones too.
function blastDrones(B, x, y, dmg, radius) {
  for (const dr of B.drones) {
    if (!dr.alive) continue;
    const k = Math.hypot(dr.x - x, dr.y - y);
    if (k < radius) damageDrone(B, dr, dmg * (1 - k / radius));
  }
}
// Machine guns and anti-aircraft guns go for drones in range (from runWeapons).
function droneInRange(B, V, range) {
  const top = V.body.y + V.height;
  return enemyDroneNear(B, V.side, V.body.x, top, range);
}
// Drone cameras spot enemies near them (from updateSpotting).
function droneSpotting(B) {
  for (const dr of B.drones || []) {
    if (!dr.alive || dr.falling) continue;
    if (dr.side === 0 || B.units.some((O) => O.side === 0 && !O.destroyed && Math.abs(O.body.x - dr.x) < spotRange(B, O, O))) dr.seen = true;
    if (!dr.st.spot) continue;
    for (const U of B.units) if (U.side !== dr.side && !U.destroyed && Math.abs(U.body.x - dr.x) < DRN.camRange * dr.st.spot / 1.5 && !U.submerged) { U.seen = true; U.lastSeenX = U.body.x; U.everSeen = true; }
  }
}

// ---------- air wings (Part 5c2; design/01 §5): aircraft and helicopters from an aircraft hangar.
// They are ordinary aircraft in the fight, flown by the air AI toward what the carrier's order
// allows, but they don't count towards the three on the field or the win; a wing whose carrier is
// destroyed or leaves heads for its own edge of the field and is lost (no airfield in battle yet).
function wingDesignOf(id) {
  const d = TEMPLATES[id] ? designFromTemplate(id) : (save.designs.list.find((x) => x.id === id) ? JSON.parse(JSON.stringify(save.designs.list.find((x) => x.id === id))) : null);
  if (!d) return null;
  const dom = domainOf(d);
  return (dom === 'air' || dom === 'heli') && validateDesign(d).ok ? d : null;
}
function setupWing(V, cap, rate) {
  V.wingCap = cap; V.wingRate = rate;
  if (!cap) return;
  if (V.wingAboard === undefined) {
    V.wingAboard = cap;                         // outside the campaign hangars start full
    V.droneOrder = V.droneOrder || 'attack';
    V.wingT = 2;
    V.wingDesign = wingDesignOf(V.design.wing || DEFAULT_WING) || wingDesignOf(DEFAULT_WING);
  }
  V.wingAboard = Math.min(V.wingAboard, cap);
}
const DEFAULT_WING = 'fighter';
function wingsFlying(B, V) { let n = 0; for (const U of B.units) if (U.wing === V && !U.destroyed) n++; return n; }

function launchWing(B, V) {
  const d = JSON.parse(JSON.stringify(V.wingDesign));
  const U = makeVehicle(d, V.side, V.body.x + V.dir * 3, V.dir, B.T);
  launchFlier(U, B.T, U.domain === 'heli' ? 12 : 30);
  U.body.y = Math.max(U.body.y, V.body.y + V.height + 6);
  U.ai = makeAI(V.side === 0 ? 'squad' : 'attack', B.cfg);
  U.wing = V;
  U.name = d.name;
  U.template = d.id;
  U.seen = V.side === 0 || V.seen;
  B.units.push(U);
  V.wingAboard--;
  B.stats.wings = (B.stats.wings || 0) + 1;
  const s = spawnParticle(FX_SMOKE, U.body.x, U.body.y, 0, 1, 1, 1.2);
  if (s) { s.grow = 1.2; s.shade = 0.8; }
  audio.sfx('clunk', B.panOf(U.body.x));
  if (V.side === 0) floatText(`${d.name} launched`, U.body.x, U.body.y + 3, false);
}

function stepWings(B, dt) {
  for (const V of B.units) {
    if (!V.wingCap || V.destroyed || V.gone || V.withdrawn || !V.wingDesign || V.empT > 0) continue;
    V.wingT -= dt;
    if (V.droneOrder === 'recall' || V.wingAboard <= 0 || V.wingT > 0) continue;
    if (V.side === 1 && !B.units.some((U) => U.side === 0 && !U.destroyed && Math.abs(U.body.x - V.body.x) < DRN.reach * 2)) continue;
    if (B.cfg && B.cfg.holdFire && V.side === 1) continue;
    launchWing(B, V);
    V.wingT = 1 / Math.max(0.02, V.wingRate);
  }
}

// What an air-wing aircraft flies at (from airThink): a real enemy its order allows, or a point.
function wingTarget(B, V, bomber) {
  const C = V.wing, T = B.T;
  const pt = V._pt || (V._pt = { body: { x: 0, y: 0, vx: 0, vy: 0 }, height: 0, flier: true, pseudo: true, destroyed: false, seen: false });
  const at = (x) => { pt.body.x = x; pt.body.y = Math.max(T.height(clamp(x, 0, T.length)), T.sea || -1e9) + 40; return pt; };
  if (C.destroyed || C.gone || C.withdrawn) {
    // No carrier: the wing leaves by its own edge and is lost.
    if (!V.leaving) { V.leaving = true; if (V.side === 0) floatText('Air wing lost with its carrier', V.body.x, V.body.y + 3, false); }
    const edge = V.side === 0 ? -80 : T.length + 80;
    if (V.side === 0 ? V.body.x < 30 : V.body.x > T.length - 30) wingGone(B, V, false);   // off its own edge (the edge guard turns aircraft back at the very edge)
    return at(edge);
  }
  const order = C.droneOrder;
  if (order === 'recall') {
    if (Math.abs(V.body.x - C.body.x) < 10) wingGone(B, V, true);
    return at(C.body.x);
  }
  const bomb = (U) => !bomber || !U.flier;
  if (order === 'scout') {
    const foe = B.units.find((U) => U.side !== V.side && !U.destroyed);
    return at(C.body.x + (foe ? Math.sign(foe.body.x - C.body.x) || C.dir : C.dir) * DRN.scoutAhead * 1.5);
  }
  const reach = order === 'defend' ? DRN.defend * 2 : DRN.reach * 1.5;
  const tgt = nearestTarget(B, V, 500, (U) => bomb(U) && Math.abs(U.body.x - C.body.x) < reach);
  return tgt || at(C.body.x);
}

// An aircraft of the wing leaves the fight: landed back aboard, or lost.
function wingGone(B, V, landed) {
  if (V.gone) return;
  V.gone = true; V.destroyed = true; V.withdrawn = true;
  const i = B.units.indexOf(V);
  if (i >= 0) B.units.splice(i, 1);
  if (landed) V.wing.wingAboard++;
  else B.stats.wingLost = (B.stats.wingLost || 0) + 1;
}

// ---------- drawing: each drone design is drawn once per side into a small sprite.
const _droneSprites = {};
function droneSprite(st, side) {
  const key = `${st.id}|${side}`;
  if (_droneSprites[key]) return _droneSprites[key];
  const md = droneDesign(st.id);
  const cs = 16;
  const c = document.createElement('canvas');
  c.width = st.w * cs; c.height = st.h * cs;
  const g = c.getContext('2d');
  for (const q of missileCells(md)) drawPart(g, { def: PARTS[q.p], scorch: 0 }, q.x * cs, q.y * cs, cs, 0, 1);
  _droneSprites[key] = c;
  return c;
}
function drawDrones(g, B) {
  if (!B.drones || !B.drones.length) return;
  const S = view.S;
  for (const dr of B.drones) {
    if (!dr.alive || (dr.side === 1 && !dr.seen)) continue;
    const spr = droneSprite(dr.st, dr.side);
    const w = dr.st.w * CELL * S * DRN.scale, h = dr.st.h * CELL * S * DRN.scale;
    const x = view.sx(dr.x), y = view.sy(dr.y);
    g.save();
    g.translate(x, y);
    if (dr.dir < 0) g.scale(-1, 1);
    g.rotate(dr.falling ? dr.t * 4 : clamp(dr.vx * 0.02, -0.3, 0.3) * dr.dir);
    g.drawImage(spr, -w / 2, -h / 2, w, h);
    // Rotor blur over the top.
    g.globalAlpha = 0.35;
    g.strokeStyle = '#D6EEFF'; g.lineWidth = Math.max(1, S * 0.05);
    g.beginPath(); g.ellipse(0, -h / 2, w * 0.45, Math.max(1, h * 0.08), 0, 0, Math.PI * 2); g.stroke();
    if (dr.flash > 0) { g.globalAlpha = 0.6; g.fillStyle = '#FFE9B8'; g.fillRect(-w / 2, -h / 2, w, h); }
    g.globalAlpha = 1;
    // Side marker: a small dot in the side's colour, so drones read at a glance.
    g.fillStyle = dr.side === 0 ? '#7FD3FF' : '#FF6B5A';
    g.beginPath(); g.arc(0, h / 2 + 3, 2.2, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}
