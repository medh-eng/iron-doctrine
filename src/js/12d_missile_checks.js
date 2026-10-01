/* ==== 12d MISSILE CHECKS ==== */
// Test-only checks of designed missiles (Part 5b), called from the smoke test.
/*TEST:BEGIN*/
function designedMissileCheck(n = 40) {
  const add = (d, cells) => { d.cells.push(...cells.map(([p, x, y]) => ({ p, x, y }))); return d; };
  const clearAll = () => {
    missiles.forEachAlive((m) => { m.alive = false; });
    shells.forEachAlive((s) => { s.alive = false; });
    firePatches.forEachAlive((f) => { f.alive = false; });
  };
  const shooter = (B, missile, extra = []) => {
    const d = add(designFromTemplate('light'), [['rack', 8, 1], ['fc', 1, 2], ...extra]);
    d.missile = missile;
    const S = makeVehicle(d, 0, 100, 1, B.T);
    B.units = [S]; B.squad = [S]; B.me = S;
    return S;
  };
  const target = (B, extra) => makeVehicle(add(designFromTemplate('light'), extra), 1, 190, -1, B.T);
  // Fire one missile at a fresh target and fly it out; returns what happened.
  const shot = (B, S, T, secs = 5) => {
    const w = S.weapons.find((x) => x.def.secondary === 'launcher');
    B.units = [S, T];
    w.reload = 0; w.rounds = 9;
    const hits0 = B.stats.missileHits || 0;
    launchDesigned(B, S, w, T);
    for (let t = 0; t < secs; t += SIM_STEP) {
      stepWarheadEffects(B, T, SIM_STEP);
      stepMissiles(B, SIM_STEP);
      stepFirePatches(B, SIM_STEP);
      let live = 0;
      missiles.forEachAlive(() => live++);
      if (!live && t > 1) break;
    }
    clearAll();
    return (B.stats.missileHits || 0) > hits0;
  };
  const rate = (missile, extra) => {
    const B = createBattle(4);
    const S = shooter(B, missile);
    let hits = 0;
    for (let i = 0; i < n; i++) if (shot(B, S, target(B, extra))) hits++;
    return hits / n;
  };
  const out = {};
  // Designs: the library's all fly; broken ones say why.
  out.library = Object.values(MISSILE_TEMPLATES).map((d) => ({ id: d.id, errors: validateMissile(d), speed: missileStats(d).speed, range: missileStats(d).range, turn: +missileStats(d).turn.toFixed(2) }));
  out.noMotor = validateMissile({ class: 'missile_s', cells: [['mw_he', 0, 0], ['mseek_heat', 5, 0]] });
  out.seekerBack = validateMissile({ class: 'missile_s', cells: [['mmotor', 1, 0], ['mw_he', 3, 0], ['mseek_heat', 0, 0]] });
  out.clusterSmall = validateMissile({ class: 'missile_s', cells: [['mmotor', 0, 0], ['mw_cluster', 2, 0]] });
  out.mixed = validateMissile({ class: 'missile_m', cells: [['mmotor', 0, 0], ['mw_he', 2, 0], ['mw_acid', 4, 0]] });
  // Guidance against flares and ECM (hit rates on a parked tank 90 m away).
  const flare = [['flare', 6, 2]];
  out.rates = {
    heat: rate('msl_s_heat', []),
    heatFlares: rate('msl_s_heat', flare),
    heatEcm: rate('msl_s_heat', [['ecm', 8, 1]]),
    radar: rate('msl_s_radar', []),
    radarFlares: rate('msl_s_radar', flare),
    radarEcm: rate('msl_s_radar', [['ecm', 8, 1]]),
    unguided: rate('msl_s_rocket', []),
  };
  // Warheads: each leaves its own mark on the target.
  const B = createBattle(4);
  const hitWith = (missile) => {
    const S = shooter(B, missile, [['vls', 1, 0]]);
    const w = S.weapons.find((x) => x.def.secondary === 'launcher' && x.msl && x.msl.id === missile) || S.weapons.find((x) => x.def.secondary === 'launcher');
    const T = target(B, []);
    B.units = [S, T];
    w.reload = 0; w.rounds = 9;
    launchDesigned(B, S, w, T);
    missiles.forEachAlive((m) => { m.locked = true; m.ang = Math.atan2(T.body.y + 1 - m.y, T.body.x - m.x); });   // a sure hit: this checks the warhead
    let split = 0, patch = false;
    const hp0 = T.parts.reduce((s, p) => s + Math.max(0, p.hp), 0);
    for (let t = 0; t < 6; t += SIM_STEP) {
      stepWarheadEffects(B, T, SIM_STEP);
      stepMissiles(B, SIM_STEP);
      stepFirePatches(B, SIM_STEP);
      let live = 0;
      missiles.forEachAlive(() => live++);
      split = Math.max(split, live);
      firePatches.forEachAlive(() => { patch = true; });
    }
    const r = {
      launcher: w.def.id, carried: w.msl && w.msl.id,
      damage: Math.round(hp0 - T.parts.reduce((s, p) => s + Math.max(0, p.hp), 0)),
      fires: (T.fires || []).length, patch, emp: +(T.empT || 0).toFixed(1),
      corroded: T.parts.filter((p) => p.corrode !== undefined && p.corrode < 0.99).length,
      split, gunsDead: T.empT > 0 && !fireWeapon(B, T, T.weapons.find((x) => !x.def.secondary), 0, 1),
    };
    clearAll();
    return r;
  };
  out.warheads = { he: hitWith('msl_s_radar'), napalm: hitWith('msl_m_napalm'), acid: hitWith('msl_m_acid'), emp: hitWith('msl_m_emp'), cluster: hitWith('msl_l_cluster') };
  // Launchers: capacity by size, a VLS fires straight up, a magazine refills an empty rack.
  const S = shooter(B, 'msl_s_heat', [['vls', 1, 0], ['mag', 12, 2]]);
  const rack = S.weapons.find((x) => x.def.id === 'rack'), vls = S.weapons.find((x) => x.def.id === 'vls');
  out.capacity = { rack: rack.rounds, vls: vls.rounds, mag: S.magUnits };
  const T = target(B, []);
  B.units = [S, T];
  launchDesigned(B, S, vls, T);
  let ang = 0;
  missiles.forEachAlive((m) => { ang = m.ang; });
  out.vlsUp = Math.abs(ang - Math.PI / 2) < 0.01;
  clearAll();
  rack.rounds = 0; rack.reload = 0;
  refillLauncher(S, rack);
  out.refill = { rounds: rack.rounds, mag: S.magUnits, reload: +rack.reload.toFixed(1) };
  // A medium missile doesn't fit... a rack takes medium (2), a large one goes to the VLS only.
  const L = shooter(B, 'msl_l_cluster', [['vls', 1, 0]]);
  out.large = { rack: L.weapons.find((x) => x.def.id === 'rack').msl.cls, vls: L.weapons.find((x) => x.def.id === 'vls').msl.id, vlsRounds: L.weapons.find((x) => x.def.id === 'vls').rounds };
  return out;
}

// Screenshots: an enemy missile of design id, 16 m out and locked on your ship (or your ship's
// flares, with 'flares'). Returns the target's x.
function missileShowcase(id) {
  const B = SCREENS.battle.B;
  const U = B.me, foe = B.units.find((V) => V.side === 1 && !V.destroyed && !V.gone);
  if (!U || !foe) return null;
  if (id === 'flares') { U.flares = 1; U.flareDecoy = 0.7; U.flareCd = 0; popFlares(B, U); return U.body.x; }
  const m = missiles.take();
  m.kind = 'designed'; m.def = PARTS.rack; m.msl = missileStats(MISSILE_TEMPLATES[id]);
  m.x = U.body.x + 16; m.y = U.body.y + 7; m.ang = Math.atan2(U.body.y + 1 - m.y, U.body.x - m.x);
  m.target = U; m.locked = true; m.shooter = foe; m.side = 1; m.B = B; m.t = 0; m.trail = 0;
  m.fooled = false; m.split = false; m.vert = 0; m.hot = false;
  return U.body.x;
}
// Part 5c: drones. A light tank with a hangar and a drone computer against parked targets.
function droneCheck() {
  const out = {};
  out.library = Object.values(DRONE_TEMPLATES).map((d) => ({ id: d.id, errors: validateDrone(d), speed: droneStats(d).speed }));
  out.noCore = validateDrone({ class: 'drone_1', cells: [['drotor', 0, 0], ['dgun', 0, 1]] });
  out.heavy = validateDrone({ class: 'drone_1', cells: [['drotor', 0, 0], ['dcore', 0, 1], ['dcharge', 1, 1], ['dcharge', 3, 1], ['dcharge', 5, 1], ['dcharge', 0, 2]] });
  out.tooBig = validateDrone({ class: 'drone_1', cells: [['drotor', 0, 0], ['dcore', 7, 3], ['dgun', 8, 0]] });
  const carrier = (B, drone, cpu = 'dcpu1') => {
    const d = designFromTemplate('light');
    d.h += 2; for (const c of d.cells) c.y += 2;
    d.cells.push({ p: 'hangar_d', x: 4, y: 0 }, { p: cpu, x: 7, y: 1 });
    d.drone = drone;
    const V = makeVehicle(d, 0, 100, 1, B.T);
    V.ai = makeAI('squad', B.cfg);
    return V;
  };
  const run = (B, secs, extra) => { for (let t = 0; t < secs; t += SIM_STEP) { stepDrones(B, SIM_STEP); stepShells(B, SIM_STEP); if (extra) extra(); } };
  const hpOf = (V) => Math.round(V.parts.reduce((a, p) => a + Math.max(0, p.hp), 0));
  // Gun drones attack: two in the air with drone computer I, the rest wait; the target takes hits.
  let B = createBattle(4);
  let V = carrier(B, 'drn_gun');
  let T = makeVehicle(designFromTemplate('light'), 1, 200, -1, B.T);
  T.seen = true;
  B.units = [V, T]; B.squad = [V]; B.me = V;
  const hp0 = hpOf(T);
  out.carrier = { cap: V.hangarCap, cpu: V.droneCpu, aboard: V.dronesAboard, design: V.droneSt && V.droneSt.id };
  let maxFlying = 0;
  run(B, 20, () => { maxFlying = Math.max(maxFlying, dronesFlying(B, V)); });
  out.attack = { launched: B.stats.drones || 0, maxFlying, shots: B.stats.droneShots || 0, damage: hp0 - hpOf(T), aboard: V.dronesAboard };
  // Recall: they come home to the hangar.
  droneOrder(B, V, 'recall');
  run(B, 25);
  out.recall = { aboard: V.dronesAboard, flying: dronesFlying(B, V) };
  // A lost carrier loses its drones.
  droneOrder(B, V, 'attack');
  run(B, 8);
  const up = dronesFlying(B, V);
  V.destroyed = true;
  run(B, 8);
  out.lost = { up, after: dronesFlying(B, V), lost: B.stats.dronesLost || 0 };
  // Strike drones dive into the target.
  B = createBattle(4);
  V = carrier(B, 'drn_charge');
  T = makeVehicle(designFromTemplate('light'), 1, 180, -1, B.T);
  T.seen = true;
  B.units = [V, T]; B.squad = [V]; B.me = V;
  const hp1 = hpOf(T);
  run(B, 20);
  out.strike = { hits: B.stats.droneHits || 0, damage: hp1 - hpOf(T) };
  // Scout: the camera spots a target nobody else can see.
  B = createBattle(4);
  V = carrier(B, 'drn_scout');
  T = makeVehicle(designFromTemplate('light'), 1, 175, -1, B.T);
  B.units = [V, T]; B.squad = [V]; B.me = V;
  droneOrder(B, V, 'scout');
  run(B, 12, () => { T.seen = false; droneSpotting(B); });
  out.scout = { seen: T.seen };
  // Machine guns shoot drones down (unarmed scouts sent to attack).
  B = createBattle(4);
  V = carrier(B, 'drn_scout');
  const E = makeVehicle(designFromTemplate('mgcar'), 1, 150, -1, B.T);
  E.seen = true; E.ai = makeAI('attack', B.cfg);
  B.units = [V, E]; B.squad = [V]; B.me = V;
  run(B, 30, () => runWeapons(B, E, SIM_STEP, true));
  out.aa = { launched: B.stats.drones || 0, lost: B.stats.dronesLost || 0 };
  // Drone computer II flies four, and a drone design too big for the computer isn't used.
  B = createBattle(4);
  V = carrier(B, 'drn_heavy', 'dcpu2');
  T = makeVehicle(designFromTemplate('light'), 1, 200, -1, B.T); T.seen = true;
  B.units = [V, T]; B.squad = [V]; B.me = V;
  let four = 0;
  run(B, 15, () => { four = Math.max(four, dronesFlying(B, V)); });
  out.cpu2 = { design: V.droneSt.id, maxFlying: four };
  const V1 = carrier(createBattle(4), 'drn_heavy', 'dcpu1');
  out.cpu1Heavy = V1.droneSt && V1.droneSt.id;
  return out;
}
// Part 5c2: an escort carrier's air wing at sea: launches up to its hangar, fights, lands on
// recall, and is lost with its carrier; wings are never objectives.
// Flying an airship or a helicopter: Fire aims at the target within each gun's arc (not just
// straight ahead); a target on the other side is out of arc.
function airAimCheck() {
  const out = {};
  for (const id of ['gunship_t0', 'heli']) {
    const B = createBattle(0, { squad: [designFromTemplate(id)], cfg: simulatorConfig({ field: 'inland', weather: 'clear', light: 'day', seed: 77 }), reserves: true, enemyForce: ['light'] });
    for (let t = 0; t < 1; t += SIM_STEP) updateBattle(B, SIM_STEP);
    const V = B.me;
    const x = V.body.x + V.dir * 60, y = B.T.height(x) + 1;
    for (const w of V.weapons) w.reload = 0;
    V.shells = 50;
    const said = playerFire(B, x, y, false);
    const angs = [];
    shells.forEachAlive((s) => { if (s.shooter === V) angs.push(Math.atan2(s.vy - V.body.vy, s.vx - V.body.vx)); });
    const want = Math.atan2(y - V.body.y, x - V.body.x);
    for (const w of V.weapons) w.reload = 0;
    const behind = playerFire(B, V.body.x - V.dir * 60, B.T.height(V.body.x - V.dir * 60) + 1, false);
    out[id] = { said, shots: angs.length, err: angs.length ? Math.round(Math.max(...angs.map((a) => Math.abs(a - want))) * 180 / Math.PI) : null, down: angs.length ? angs.every((a) => Math.sin(a) < -0.05) : false, behind };
    shells.forEachAlive((s) => { s.alive = false; });
  }
  return out;
}
function wingCheck() {
  const B = createBattle(0, { squad: [designFromTemplate('carrier_t3')], cfg: simulatorConfig({ field: 'sea', weather: 'clear', light: 'day', seed: 77 }), reserves: true, enemyForce: [designFromTemplate('gunboat')] });
  const C = B.me;
  const out = { cap: C.wingCap, aboard: C.wingAboard, design: C.wingDesign && C.wingDesign.id };
  let maxUp = 0, engaged = false, t = 0;
  const run = (secs, fn) => { for (let k = 0; k < secs; k += SIM_STEP) { if (B.result) break; updateBattle(B, SIM_STEP); t += SIM_STEP; if (fn && fn()) break; } };
  // Launch, then recall before any enemy is near: they land back aboard.
  run(14, () => { maxUp = Math.max(maxUp, wingsFlying(B, C)); return false; });
  const launched = B.stats.wings || 0;
  droneOrder(B, C, 'recall');
  run(60);
  out.recall = { launched, maxUp, aboard: C.wingAboard, flying: wingsFlying(B, C) };
  // Attack an enemy brought within reach.
  droneOrder(B, C, 'attack');
  for (const U of B.units) if (U.side === 1) { U.body.x = C.body.x + 200; U.ai.hold = U.body.x; }
  run(30, () => { for (const U of B.units) if (U.wing === C && !U.destroyed && U.ai.target && !U.ai.target.pseudo) engaged = true; return engaged; });
  out.fight = { engaged, result: B.result || null };
  // The carrier leaves: its aircraft still flying leave too, and are lost.
  const up = wingsFlying(B, C);
  C.withdrawn = true;
  run(40);
  out.lost = { up, after: wingsFlying(B, C), lost: B.stats.wingLost || 0 };
  out.notInSquad = !B.squad.some((V) => V.wing);
  return out;
}
// Part 5d: energy weapons, flamethrowers and damage types.
function energyCheck() {
  const out = {};
  const B = createBattle(4);
  const make = (extra, x, dir, side, base = 'light') => {
    const d = designFromTemplate(base);
    d.h += 2; for (const c of d.cells) c.y += 2;
    d.cells.push(...extra.map(([p, cx, cy]) => ({ p, x: cx, y: cy })));
    const V = makeVehicle(d, side, x, dir, B.T);
    V.ai = makeAI(side ? 'attack' : 'squad', B.cfg);
    return V;
  };
  const hpOf = (V) => V.parts.reduce((a, p) => a + Math.max(0, p.hp), 0);
  const run = (secs, fn) => { for (let t = 0; t < secs; t += SIM_STEP) fn(); };
  // Lasers need no shells; each shot adds heat; a full gauge locks them until half cooled.
  const S = make([['laser', 4, 1]], 100, 1, 0);
  const T = make([], 160, -1, 1);
  B.units = [S, T]; B.squad = [S]; B.me = S; T.seen = true;
  const w = S.weapons.find((q) => q.def.id === 'laser');
  S.shells = 0;
  let shots = 0;
  while (shots < 20 && fireWeapon(B, S, w, 0, 1)) shots++;
  out.heat = { shots, locked: S.wheatLock, heat: Math.round(S.wheat) };
  let cool = 0;
  while (S.wheatLock && cool < 30) { stepEnergy(B, S, SIM_STEP); cool += SIM_STEP; }
  out.heat.coolSecs = +cool.toFixed(1);
  shells.forEachAlive((q) => { q.alive = false; });
  // Recharge: limited by spare power; a capacitor covers the shortfall.
  const recharge = (V) => { const x = V.weapons.find((q) => q.def.energy); x.reload = x.def.reload; let t = 0; while (x.reload > 0 && t < 30) { stepEnergy(B, V, SIM_STEP); x.reload -= SIM_STEP * V.energyFactor; t += SIM_STEP; } return +t.toFixed(2); };
  const weak = make([['hlaser', 0, 1]], 100, 1, 0);
  const capped = make([['hlaser', 0, 1], ['cap', 5, 1]], 100, 1, 0);
  const strong = make([['hlaser', 0, 1], ['reactor', 5, 0]], 100, 1, 0);
  out.power = { made: weak.powerMade, need: weak.energyNeed, weak: recharge(weak), capped: recharge(capped), strong: recharge(strong), reload: PARTS.hlaser.reload };
  // A laser beam hits at once and shows a beam; a plasma bolt barely drops and hits hard.
  const fireAt = (V, id, target) => {
    const x = V.weapons.find((q) => q.def.id === id);
    V.wheat = 0; V.wheatLock = false;
    aimWeapon(V, x, target.body.x, target.body.y + target.height * 0.4, _aim);
    x.angle = _aim.angle;
    const h0 = hpOf(target);
    let beam = 0;
    fireWeapon(B, V, x, _aim.angle, 0.01);
    beams.forEachAlive(() => beam++);
    let t = 0;
    for (; t < 3; t += SIM_STEP) { stepShells(B, SIM_STEP); let live = 0; shells.forEachAlive(() => live++); if (!live) break; }
    return { damage: Math.round(h0 - hpOf(target)), beam, secs: +t.toFixed(2) };
  };
  const P = make([['laser', 4, 1], ['plasma', 0, 0]], 100, 1, 0);
  B.units = [P, T];
  out.laser = fireAt(P, 'laser', T);
  out.plasma = fireAt(P, 'plasma', T);
  // Flamethrower: burns and ignites within reach, burns fuel; nothing beyond it.
  const F = make([['flame', 4, 1]], 100, 1, 0);
  const near = make([], 110, -1, 1), far = make([], 140, -1, 1);
  near.seen = far.seen = true;
  B.units = [F, near]; B.squad = [F]; B.me = F;
  const fw = F.weapons.find((q) => q.def.id === 'flame');
  const fuel0 = F.fuel, n0 = hpOf(near);
  run(4, () => stepFlame(B, F, fw, SIM_STEP, false));
  out.flame = { damage: Math.round(n0 - hpOf(near)), fires: (near.fires || []).length, fuelUsed: +(fuel0 - F.fuel).toFixed(1) };
  B.units = [F, far];
  const f0 = hpOf(far);
  run(4, () => stepFlame(B, F, fw, SIM_STEP, false));
  out.flame.farDamage = Math.round(f0 - hpOf(far));
  // Damage types: composite armour takes half the fire damage plate takes; kinetic is the same.
  const R = make([['composite', 0, 0], ['plate', 1, 0]], 200, 1, 1);
  const ci = R.parts.findIndex((p) => p.def.id === 'composite'), pi = R.parts.findIndex((p) => p.def.id === 'plate');
  const lose = (i, type) => { const h = R.parts[i].hp; damagePart(B, R, i, 20, null, type); const d = h - R.parts[i].hp; R.parts[i].hp = h; return +d.toFixed(1); };
  out.resist = { compositeFire: lose(ci, 'fire'), plateFire: lose(pi, 'fire'), compositeKinetic: lose(ci, null), compositePlasma: lose(ci, 'plasma') };
  return out;
}
// Part 5e: fabricators rebuild lost drones, then missiles, then shells, from goods aboard;
// clamps release a section that becomes its own unit.
function fabClampCheck() {
  const out = {};
  const B = createBattle(4);
  const run = (V, secs) => { for (let t = 0; t < secs; t += SIM_STEP) stepFab(B, V, SIM_STEP); };
  const d = designFromTemplate('drone_truck');
  d.h += 2; for (const c of d.cells) c.y += 2;
  d.cells.push({ p: 'fab', x: 0, y: 0 }, { p: 'rack', x: 2, y: 1 });
  const V = makeVehicle(d, 0, 100, 1, B.T);
  B.units = [V]; B.squad = [V]; B.me = V;
  const rack = V.weapons.find((w) => w.def.id === 'rack');
  V.dronesAboard = 2; rack.rounds = 2; V.shells = V.shellsMax - 20;
  const g0 = Object.assign({}, V.fabGoods);
  run(V, 120);
  out.drones = { aboard: V.dronesAboard, rate: V.fabRate };
  run(V, 150);
  out.after = { aboard: V.dronesAboard, rounds: rack.rounds, shells: V.shellsMax - V.shells, made: B.stats.fabricated || 0, metalUsed: +(g0.metal - V.fabGoods.metal).toFixed(1), elecUsed: +(g0.elec - V.fabGoods.elec).toFixed(1) };
  // No goods aboard: nothing is made.
  const V2 = makeVehicle(d, 0, 100, 1, B.T);
  V2.dronesAboard = 2; V2.fabGoods = { metal: 0, elec: 0 };
  run(V2, 120);
  out.noGoods = V2.dronesAboard;
  // Clamps: the drop-ship lets its armoured car go; it lands and can drive.
  const D = makeVehicle(designFromTemplate('dropship'), 0, 100, 1, B.T);
  launchFlier(D, B.T, 30);
  B.units = [D]; B.squad = [D]; B.me = D;
  const m0 = D.body.m;
  out.sections = clampSections(D).map((q) => q.mass);
  out.release = releaseSections(B, D);
  const U = B.units.find((q) => q.detached);
  out.released = { units: B.units.length, lighter: +(m0 - D.body.m).toFixed(0), again: releaseSections(B, D) };
  for (let t = 0; t < 10; t += SIM_STEP) { for (const q of B.units) { if (q.flier) flightControl(q, B.T, SIM_STEP); stepVehicle(q, B.T, SIM_STEP); } }
  out.car = U ? { onGround: U.body.y - B.T.height(U.body.x) < 3, canDrive: U.canDrive, destroyed: U.destroyed, crew: U.crew } : null;
  // One clamp holds 2 t: too little for the 2.5 t car.
  const one = designFromTemplate('dropship');
  one.cells = one.cells.filter((c, i, a) => !(c.p === 'clamp' && a.findIndex((q) => q.p === 'clamp') !== i));
  const D1 = makeVehicle(one, 0, 100, 1, B.T);
  out.oneClamp = releaseSections(B, D1);
  // Music era: tier 3–4 parts on the field bring in the synth bass.
  out.era = { laser: battleEra({ units: [makeVehicle(designFromTemplate('laser_tank'), 0, 100, 1, B.T)], reserve: [[], []] }), light: battleEra({ units: [makeVehicle(designFromTemplate('light'), 0, 100, 1, B.T)], reserve: [[], []] }) };
  return out;
}
/*TEST:END*/
