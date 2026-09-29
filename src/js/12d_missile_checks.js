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
/*TEST:END*/
