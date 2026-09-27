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
/*TEST:END*/
