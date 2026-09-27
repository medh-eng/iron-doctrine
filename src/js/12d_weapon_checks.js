/* ==== 12d WEAPON CHECKS ==== */
// Test-only checks of the Part 5 weapons, called from the smoke test.
/*TEST:BEGIN*/
// Energy weapons use power and heat, not ammo; beams hit at once; plasma flies straight;
// flamethrowers burn fuel and parts; materials resist damage types (design/06 Part 5).
function energyCheck() {
  const out = {};
  const swap = (tid, gun) => { const d = designFromTemplate(tid); const c = d.cells.find((q) => PARTS[q.p].cat === 'weapon' && !PARTS[q.p].auto); c.p = gun; d.id = tid + '_' + gun; return d; };
  const make = (d, e) => {
    const B = createBattle(0, { cfg: simulatorConfig({ field: 'inland', weather: 'clear', light: 'day', seed: 77 }), reserves: true, demo: true, squad: [d], enemyForce: [e || designFromTemplate('light')] });
    const V = B.squad[0], T = B.enemySlots[0];
    T.body.x = V.body.x + 18; T.body.y = B.T.height(T.body.x) + 2;
    for (let t = 0; t < 1; t += SIM_STEP) { stepVehicle(V, B.T, SIM_STEP); stepVehicle(T, B.T, SIM_STEP); }
    T.seen = true;
    return { B, V, T };
  };
  // Laser: no shells used, beam damage at once.
  let { B, V, T } = make(swap('medium', 'laser'));
  const w = V.weapons.find((q) => q.def.id === 'laser');
  V.shells = 0;
  const hp0 = T.parts.reduce((a, p) => a + p.hp, 0);
  aimWeapon(V, w, T.body.x, T.body.y, _aim);
  const fired = fireWeapon(B, V, w, _aim.angle, 0.01);
  out.laser = { fired, shells: V.shells, dmg: Math.round(hp0 - T.parts.reduce((a, p) => a + p.hp, 0)), heat: V.heatPool };
  // Recharge: with spare power it recharges; with the engine gone it doesn't; a capacitor bridges.
  w.reload = 1; stepEnergy(B, V, 0.1); out.rateOn = +V.energyRate.toFixed(2);
  const power = V.power; V.power = 0; V.cap = 0; V.capMax = 0;
  stepEnergy(B, V, 0.1); out.rateOff = V.energyRate;
  V.capMax = 30000; V.cap = 30000; stepEnergy(B, V, 0.1); out.rateCap = +V.energyRate.toFixed(2); out.capUsed = Math.round(30000 - V.cap);
  V.power = power;
  // Heat: many shots overheat the vehicle until the weapon can't recharge.
  V.heatPool = 0;
  for (let k = 0; k < 40; k++) V.heatPool += w.def.shotHeat;
  stepSystems(B, V, 0.05);
  out.hot = { over: +V.overheat.toFixed(2), rate: V.energyRate };
  // Plasma bolts fly straight (no drop).
  ({ B, V, T } = make(swap('medium', 'plasma')));
  const pw = V.weapons.find((q) => q.def.id === 'plasma');
  let bolt = null;
  fireWeapon(B, V, pw, 0, 0.01);
  shells.forEachAlive((s) => { if (s.plasma) bolt = s; });
  const vy0 = bolt ? bolt.vy : null;
  stepShells(B, 0.05);
  out.plasma = { bolt: !!bolt, straight: bolt ? Math.abs(bolt.vy - vy0) < 1e-6 : false, dtype: bolt ? bolt.dtype : '' };
  // Flamethrower: burns fuel and the nearest parts of a target in reach.
  ({ B, V, T } = make(swap('medium', 'flame')));
  const fw = V.weapons.find((q) => q.def.id === 'flame');
  T.body.x = V.body.x + 10;
  const f0 = V.fuel, t0 = T.parts.reduce((a, p) => a + p.hp, 0);
  for (let t = 0; t < 2; t += SIM_STEP) stepFlame(B, V, fw, SIM_STEP, true);
  out.flame = { fuel: +(f0 - V.fuel).toFixed(2), dmg: Math.round(t0 - T.parts.reduce((a, p) => a + p.hp, 0)), particles: (() => { let n = 0; flames.forEachAlive(() => n++); return n; })() };
  // Resistances: composite armour takes half from fire.
  const comp = { def: PARTS.composite }, plate = { def: PARTS.plate };
  out.resist = { compositeFire: resistOf(comp.def, 'fire'), compositeLaser: resistOf(comp.def, 'laser'), plateFire: resistOf(plate.def, 'fire') };
  // Stats: energy draw doesn't count against driving.
  const st = statsOf(swap('medium', 'hlaser'));
  out.stats = { energy: st.energy, drawnSame: st.drawn === statsOf(designFromTemplate('medium')).drawn };
  for (const pool of [shells, particles, debris, beams, flames, floaters]) pool.forEachAlive((p) => { p.alive = false; });
  return out;
}

// Missiles (design/06 Part 5): launchers carry designed missiles; flares beat heat seekers more
// than radar seekers; ECM spoils radar locks only; every warhead has its own effect.
function designedMissileCheck() {
  const out = {};
  const B = createBattle(0, { cfg: simulatorConfig({ field: 'inland', weather: 'clear', light: 'day', seed: 91 }), reserves: true, demo: true, squad: [designFromTemplate('medium')], enemyForce: [designFromTemplate('medium')] });
  const V = B.squad[0], T = B.enemySlots[0];
  T.body.x = V.body.x + 30; T.body.y = B.T.height(T.body.x) + 2; T.seen = true;
  out.defaults = [1, 2, 3].map((k) => { const ms = missileStats(DEFAULT_MISSILES[k]); return `${ms.size}:${ms.errors.length}`; }).join(',');
  const md = (warhead, seeker) => ({ id: 'mtest_' + warhead + seeker, kind: 'missile', w: 6, h: 1, cells: [[seeker, 4, 0], [warhead, 3, 0], ['mfuel', 2, 0], ['mmotor', 1, 0]].filter((c) => c[0]).map(([p, x, y]) => ({ p, x, y })) });
  // Launchers: a rack carries 4 small; a VLS 4 medium.
  const ship = designFromTemplate('medium');
  ship.cells.push({ p: 'rack', x: 0, y: 0 }, { p: 'vls', x: 2, y: 0 });
  ship.load = 'm_std_m';
  const L = makeVehicle(ship, 0, 40, 1, B.T);
  const rack = L.weapons.find((w) => w.def.id === 'rack'), vls = L.weapons.find((w) => w.def.id === 'vls');
  out.launchers = { rack: rack.rounds, rackMissile: rack.missile.id, vls: vls.rounds, vlsMissile: vls.missile.id };
  // A launched missile flies and hits.
  const w = rack;
  const hp0 = T.parts.reduce((a, p) => a + p.hp, 0);
  w.reload = 0;
  launchDesigned(B, L, w, T);
  let n = 0; missiles.forEachAlive((m) => { m.locked = true; n++; });
  for (let t = 0; t < 4; t += SIM_STEP) { stepMissiles(B, SIM_STEP); stepShells(B, SIM_STEP); }
  out.hit = { launched: n, dmg: Math.round(hp0 - T.parts.reduce((a, p) => a + p.hp, 0)) };
  // Flares: many locked missiles of each seeker type at close range against a flare-armed target.
  const rates = {};
  for (const seeker of ['heat', 'radar', 'laser']) {
    let lost = 0;
    const ms = missileStats(md('mw_he', 'mseek_' + seeker));
    for (let k = 0; k < 200; k++) {
      T.flareSalvos = 99; T.flareDecoy = 0.7; T.flareT = 0;
      const m = missiles.take();
      Object.assign(m, { x: T.body.x - 20, y: T.body.y + 1, ang: 0, kind: 'designed', def: rack.def, ms, target: T, t: 0.5, trail: 0, shooter: L, side: 0, locked: true, decoyed: false, split: false });
      stepDesigned(B, m, 0.001);
      if (!m.locked) lost++;
      m.alive = false;
      B.time += FLARE_COOLDOWN + 0.1;
    }
    rates[seeker] = +(lost / 200).toFixed(2);
  }
  out.flares = rates;
  // ECM: radar locks drop, heat locks don't.
  const rs = missileStats(md('mw_he', 'mseek_radar')), hs = missileStats(md('mw_he', 'mseek_heat'));
  T.ecm = false; const r0 = seekerLock(L, T, rs), h0 = seekerLock(L, T, hs);
  T.ecm = true; const r1 = seekerLock(L, T, rs), h1 = seekerLock(L, T, hs);
  T.ecm = false;
  out.ecm = { radar: +(r1 / r0).toFixed(2), heat: +(h1 / h0).toFixed(2) };
  // Warheads.
  const hitWith = (warhead) => {
    const m = missiles.take();
    Object.assign(m, { x: T.body.x - 1, y: T.body.y, ang: 0, kind: 'designed', def: rack.def, ms: missileStats(md(warhead, 'mseek_heat')), target: T, t: 1, trail: 0, shooter: L, side: 0, locked: true, decoyed: true, split: false });
    m.alive = false;
    return m;
  };
  warheadHit(B, hitWith('mw_napalm'), T);
  let patches = 0; firePatches.forEachAlive(() => patches++);
  const n0 = T.parts.reduce((a, p) => a + p.hp, 0);
  T.body.y = B.T.height(T.body.x) + T.height / 2;
  for (let t = 0; t < 2; t += SIM_STEP) stepMissileFx(B, SIM_STEP);
  out.napalm = { patches, burn: Math.round(n0 - T.parts.reduce((a, p) => a + p.hp, 0)) };
  warheadHit(B, hitWith('mw_acid'), T);
  out.acid = T.parts.filter((p) => p.corroded).length;
  // EMP on an undamaged tank: electronics off, its gun stays silent.
  const E = makeVehicle(designFromTemplate('medium'), 1, T.body.x + 12, -1, B.T);
  E.ai = makeAI('attack', B.cfg); B.units.push(E); E.seen = true;
  const em = hitWith('mw_emp'); em.x = E.body.x; em.y = E.body.y;
  warheadHit(B, em, E);
  out.emp = { t: +(E.empT || 0).toFixed(1) };
  const tw = E.weapons.find((q) => !q.def.auto);
  tw.reload = 0; E.ai.target = V; E.ai.react = 0;
  const s0 = E.shells;
  for (let t = 0; t < 1; t += SIM_STEP) runWeapons(B, E, SIM_STEP, true);
  out.emp.silent = E.shells === s0;
  B.units.splice(B.units.indexOf(E), 1);
  let before = 0; missiles.forEachAlive(() => before++);
  const cm = hitWith('mw_cluster'); cm.alive = true; cm.x = T.body.x - 15; cm.decoyed = true;
  stepDesigned(B, cm, 0.001);
  let bomblets = 0; missiles.forEachAlive((m) => { if (m.ms && m.ms.warheads[0] === 'bomblet') bomblets++; });
  out.cluster = bomblets;
  for (const pool of [shells, missiles, particles, debris, beams, flames, firePatches, decoys, floaters]) pool.forEachAlive((p) => { p.alive = false; });
  return out;
}
/*TEST:END*/
