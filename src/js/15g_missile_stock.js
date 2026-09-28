/* ==== 15g MISSILE STOCK ==== */
// Missiles as campaign items (Part 5b2; design/01 §5, §8; design/04 Cargo.missiles). A missile
// design is crafted at a metropolis workshop from its parts' goods; the missiles wait in the
// warehouse (store.missiles = {designId: n}) or a hold, and take cargo space by mass. Each ship
// carries missiles of one design (ship.missiles = {id, n}), up to what its launchers and
// magazines hold; a docked fleet loads them from stock. In battle a ship has only what it
// carries, and what it didn't fire comes home. Other factions' ships don't count missiles yet.

const missilesAt = (c) => c.missiles || (c.missiles = {});
function missileUnits(id) { const md = missileDesign(id); return md ? missileStats(md).mass / 100 : 1; }
function missilesUsed(c) { let n = 0; for (const [id, k] of Object.entries(c.missiles || {})) n += k * missileUnits(id); return n; }

// The missile a design carries and how many it holds: its launchers that take that size, plus
// magazines. null when it has no launcher.
function missileLoadout(d) {
  const launchers = d.cells.map((c) => PARTS[c.p]).filter((P) => P && P.secondary === 'launcher');
  if (!launchers.length) return null;
  let md = missileDesign(d.missile || DEFAULT_MISSILE);
  if (!md || validateMissile(md).length || !launchers.some((P) => P.sizes.includes(md.class))) md = Object.values(MISSILE_TEMPLATES).find((m) => launchers[0].sizes.includes(m.class));
  const ms = missileStats(md);
  let cap = 0;
  for (const P of launchers) if (P.sizes.includes(ms.cls)) cap += Math.floor(P.capacity / ms.units);
  const mag = d.cells.reduce((s, c) => s + (PARTS[c.p] && PARTS[c.p].magazine ? PARTS[c.p].capacity : 0), 0);
  return { id: md.id, name: md.name, cap: cap + Math.floor(mag / ms.units) };
}
// What a ship carries now (of its loadout's design; any other kind counts as none).
function shipMissiles(ship) {
  const lo = missileLoadout(shipDesign(ship));
  if (!lo) return null;
  const m = ship.missiles;
  return { ...lo, n: m && m.id === lo.id ? Math.min(m.n, lo.cap) : 0 };
}

// Missiles of design id on hand at a settlement: its warehouse, then docked holds.
function missilesOnHand(s, id) {
  let n = ownStore(s) ? missilesAt(s.store)[id] || 0 : 0;
  for (const fl of dockedHere(s)) n += missilesAt(fl.hold)[id] || 0;
  return n;
}
function takeMissiles(s, id, n) {
  const spots = (ownStore(s) ? [s.store] : []).concat(dockedHere(s).map((fl) => fl.hold));
  let got = 0;
  for (const c of spots) {
    const k = Math.min(n - got, missilesAt(c)[id] || 0);
    if (k > 0) { c.missiles[id] -= k; got += k; if (!c.missiles[id]) delete c.missiles[id]; }
  }
  return got;
}

// Fill every ship of a docked fleet with its missile; missiles of another kind go to the warehouse.
function loadMissiles(fl, s) {
  if (!ownStore(s) || fl.docked !== s.id) return 'The fleet is not docked at your settlement.';
  let loaded = 0, want = 0, name = '';
  for (const ship of fleetShips(fl)) {
    const lo = missileLoadout(shipDesign(ship));
    if (!lo) continue;
    const m = ship.missiles;
    if (m && m.id !== lo.id && m.n > 0) missilesAt(s.store)[m.id] = (missilesAt(s.store)[m.id] || 0) + m.n;
    const have = m && m.id === lo.id ? m.n : 0;
    const got = takeMissiles(s, lo.id, Math.max(0, lo.cap - have));
    ship.missiles = { id: lo.id, n: have + got };
    loaded += got; want += Math.max(0, lo.cap - have); name = lo.name;
  }
  if (!want) return name ? 'Launchers full.' : 'No ship in this fleet has a missile launcher.';
  if (!loaded) return `No ${name} missiles here.`;
  return '';
}

// ---------- crafting at a metropolis workshop
function missileBlock(s, md) {
  const why = servicesBlock(s);
  if (why) return why;
  if (s.type !== 'metropolis') return 'Missiles are made at a metropolis.';
  if (validateMissile(md).length) return validateMissile(md)[0];
  const locked = missileCells(md).find((c) => !partUnlocked(c.p));
  return locked ? `${PARTS[locked.p].name} is not researched.` : '';
}
function missileQuote(s, md, n) {
  const cost = {};
  for (const c of missileCells(md)) addCost(cost, PARTS[c.p].cost, n);
  const hours = n * (0.5 + 0.15 * missileCells(md).length) * (s.type === 'metropolis' ? 0.75 : 1) * (perk('master_crafters') ? 0.75 : 1);
  return { cost: withFee(cost), hours };
}
function craftMissiles(s, id, n) {
  const md = missileDesign(id);
  if (!md) return 'Unknown missile design.';
  const why = missileBlock(s, md);
  if (why) return why;
  const q = missileQuote(s, md, n);
  const lack = lackOf(s, q.cost);
  if (lack) return lack;
  consume(s, q.cost);
  (s.queue = s.queue || []).push({ kind: 'missile', m: id, n, hours: q.hours, left: q.hours });
  return '';
}

// ---------- battle: what a campaign ship takes in, and what comes home
// Load a vehicle's launchers and magazines with n missiles of its carried design.
function loadVehicleMissiles(V, n) {
  const lo = missileLoadout(V.design);
  if (!lo) return;
  let units = 1;
  for (const w of V.weapons) {
    if (w.def.secondary !== 'launcher') continue;
    if (!w.msl || w.msl.id !== lo.id) { w.rounds = 0; continue; }
    units = w.msl.units;
    w.rounds = Math.min(Math.floor(w.def.capacity / units), n);
    n -= w.rounds;
  }
  const magCap = V.parts.reduce((s, p) => s + (p.alive && p.def.magazine ? p.def.capacity : 0), 0);
  V.magUnits = Math.min(magCap, Math.max(0, n) * units);
}
// Missiles still aboard: in live launchers, and in the magazines if one survives.
function missilesLeft(V) {
  const lo = missileLoadout(V.design);
  if (!lo) return null;
  let n = 0, units = 1;
  for (const w of V.weapons) {
    if (w.def.secondary !== 'launcher' || !w.msl || w.msl.id !== lo.id) continue;
    units = w.msl.units;
    if (V.parts[w.part].alive) n += w.rounds;
  }
  if (V.parts.some((p) => p.alive && p.def.magazine)) n += Math.floor((V.magUnits || 0) / units);
  return n;
}
