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
/*TEST:END*/
