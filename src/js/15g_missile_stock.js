/* ==== 15g MISSILE, DRONE AND AIRCRAFT STOCK ==== */
// Missiles, drones and air-wing aircraft as campaign items (Parts 5b2 and 5c2; design/01 §5, §8;
// design/04 Cargo). Each is made from its design's goods: missiles and drones at a metropolis
// workshop, aircraft at a city or metropolis yard. They wait in a warehouse or hold
// (store.missiles / store.drones / store.wings = {designId: n}), taking cargo space by mass.
// Each ship carries one design of each kind it can (ship.missiles / ship.drones / ship.air =
// {id, n}), up to what its launchers, magazines and hangars hold; a docked fleet loads them from
// stock. In battle a ship has only what it carries; what isn't lost comes home. Other factions'
// ships don't count them yet.

// ---------- the three kinds
function droneLoadout(d) {
  const cap = d.cells.reduce((a, c) => a + (PARTS[c.p] && PARTS[c.p].hangar === 'drone' ? PARTS[c.p].capacity : 0), 0);
  if (!cap) return null;
  const cpus = d.cells.map((c) => PARTS[c.p]).filter((P) => P && P.droneCpu).sort((a, b) => b.effect - a.effect);
  const fits = (md) => md && !validateDrone(md).length && cpus.length && droneClassIndex(md.class) <= droneClassIndex(cpus[0].droneCpu);
  const md = [droneDesign(d.drone || DEFAULT_DRONE), droneDesign(DEFAULT_DRONE), ...Object.values(DRONE_TEMPLATES)].find(fits);
  return md ? { id: md.id, name: md.name, cap } : null;
}
function wingLoadout(d) {
  const cap = d.cells.reduce((a, c) => a + (PARTS[c.p] && PARTS[c.p].hangar === 'aircraft' ? PARTS[c.p].capacity : 0), 0);
  if (!cap) return null;
  const id = wingDesignOf(d.wing || DEFAULT_WING) ? d.wing || DEFAULT_WING : DEFAULT_WING;
  return { id, name: wingDesignOf(id).name, cap };
}
const designMass = (d) => (d ? d.cells.reduce((a, c) => a + (PARTS[Array.isArray(c) ? c[0] : c.p] || { mass: 0 }).mass, 0) : 100);
const STOCK_KINDS = {
  missiles: { ship: 'missiles', noun: 'missiles', loadout: (d) => missileLoadout(d), get: (id) => missileDesign(id) },
  drones: { ship: 'drones', noun: 'drones', loadout: (d) => droneLoadout(d), get: (id) => droneDesign(id) },
  wings: { ship: 'air', noun: 'aircraft', loadout: (d) => wingLoadout(d), get: (id) => wingDesignOf(id) },
};
const stockAt = (c, kind) => c[kind] || (c[kind] = {});
const stockUnits = (kind, id) => designMass(STOCK_KINDS[kind].get(id)) / 100;
function stockUsed(c) { let n = 0; for (const kind in STOCK_KINDS) for (const [id, k] of Object.entries(c[kind] || {})) n += k * stockUnits(kind, id); return n; }
const stockName = (kind, id) => (STOCK_KINDS[kind].get(id) || { name: id }).name;

// What a ship carries of a kind now (of its loadout's design; any other design counts as none).
function shipStock(ship, kind) {
  const K = STOCK_KINDS[kind];
  const lo = K.loadout(shipDesign(ship));
  if (!lo) return null;
  const m = ship[K.ship];
  return { ...lo, n: m && m.id === lo.id ? Math.min(m.n, lo.cap) : 0 };
}
function stockOnHand(s, kind, id) {
  let n = ownStore(s) ? stockAt(s.store, kind)[id] || 0 : 0;
  for (const fl of dockedHere(s)) n += stockAt(fl.hold, kind)[id] || 0;
  return n;
}
function takeStock(s, kind, id, n) {
  const spots = (ownStore(s) ? [s.store] : []).concat(dockedHere(s).map((fl) => fl.hold));
  let got = 0;
  for (const c of spots) {
    const st = stockAt(c, kind), k = Math.min(n - got, st[id] || 0);
    if (k > 0) { st[id] -= k; got += k; if (!st[id]) delete st[id]; }
  }
  return got;
}
// Fill every ship of a docked fleet with its design of this kind; other designs go to the warehouse.
function loadStock(fl, s, kind) {
  const K = STOCK_KINDS[kind];
  if (!ownStore(s) || fl.docked !== s.id) return 'The fleet is not docked at your settlement.';
  let loaded = 0, want = 0, name = '';
  for (const ship of fleetShips(fl)) {
    const lo = K.loadout(shipDesign(ship));
    if (!lo) continue;
    const m = ship[K.ship];
    if (m && m.id !== lo.id && m.n > 0) stockAt(s.store, kind)[m.id] = (stockAt(s.store, kind)[m.id] || 0) + m.n;
    const have = m && m.id === lo.id ? m.n : 0;
    const got = takeStock(s, kind, lo.id, Math.max(0, lo.cap - have));
    ship[K.ship] = { id: lo.id, n: have + got };
    loaded += got; want += Math.max(0, lo.cap - have); name = lo.name;
  }
  if (!want) return name ? `${K.noun[0].toUpperCase()}${K.noun.slice(1)}: full.` : `No ship in this fleet carries ${K.noun}.`;
  if (!loaded) return `No ${name} here.`;
  return '';
}
// Move all stock of every kind that fits from one cargo to another (with Load / Unload parts).
function moveStock(from, to, room) {
  let moved = 0;
  for (const kind in STOCK_KINDS) {
    for (const [id, n] of Object.entries(stockAt(from, kind))) {
      const u = stockUnits(kind, id), k = Math.min(n, Math.floor(room / u));
      if (k <= 0) continue;
      from[kind][id] -= k; if (!from[kind][id]) delete from[kind][id];
      stockAt(to, kind)[id] = (stockAt(to, kind)[id] || 0) + k; room -= k * u; moved += k;
    }
  }
  return moved;
}

// ---------- making them
function stockBlock(s, kind, d) {
  const why = servicesBlock(s);
  if (why) return why;
  if (kind === 'wings') { if (!hasWorkshop(s)) return 'Aircraft are built at a city or metropolis yard.'; }
  else if (s.type !== 'metropolis') return `${kind === 'drones' ? 'Drones' : 'Missiles'} are made at a metropolis.`;
  const bad = kind === 'missiles' ? validateMissile(d) : kind === 'drones' ? validateDrone(d) : [];
  if (bad.length) return bad[0];
  const locked = (kind === 'wings' ? d.cells : missileCells(d)).find((c) => PARTS[c.p].cat !== 'structure' && !partUnlocked(c.p));
  return locked ? `${PARTS[locked.p].name} is not researched.` : '';
}
function stockQuote(s, kind, d, n) {
  const cells = kind === 'wings' ? d.cells : missileCells(d);
  const cost = {};
  for (const c of cells) addCost(cost, PARTS[c.p].cost, n);
  const each = kind === 'wings' ? 2 + designMass(d) / 1000 : 0.5 + 0.15 * cells.length;
  const hours = n * each * (s.type === 'metropolis' ? 0.75 : 1) * (perk('master_crafters') ? 0.75 : 1);
  return { cost: withFee(cost), hours };
}
function makeStock(s, kind, id, n) {
  const d = STOCK_KINDS[kind].get(id);
  if (!d) return 'Unknown design.';
  const why = stockBlock(s, kind, d);
  if (why) return why;
  const q = stockQuote(s, kind, d, n);
  const lack = lackOf(s, q.cost);
  if (lack) return lack;
  consume(s, q.cost);
  // Missiles and drones in the workshop queue; aircraft in the yard.
  const q2 = kind === 'wings' ? (s.yard = s.yard || []) : (s.queue = s.queue || []);
  q2.push({ kind: 'stock', stock: kind, m: id, n, hours: q.hours, left: q.hours });
  return '';
}
function finishStock(s, j) {
  stockAt(s.store, j.stock)[j.m] = (stockAt(s.store, j.stock)[j.m] || 0) + j.n;
  return `${s.name}: ${j.n} × ${stockName(j.stock, j.m)} made.`;
}

// Missile names kept from 5b2.
const missilesAt = (c) => stockAt(c, 'missiles');
const missileUnits = (id) => stockUnits('missiles', id);
const shipMissiles = (ship) => shipStock(ship, 'missiles');
const missilesOnHand = (s, id) => stockOnHand(s, 'missiles', id);
const loadMissiles = (fl, s) => loadStock(fl, s, 'missiles');
const missileQuote = (s, md, n) => stockQuote(s, 'missiles', md, n);
const missileBlock = (s, md) => stockBlock(s, 'missiles', md);
const craftMissiles = (s, id, n) => makeStock(s, 'missiles', id, n);

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
// Drones and aircraft a campaign carrier takes in (its hangars start with what it carries).
function loadVehicleAir(V, drones, wing) {
  if (drones !== null && drones !== undefined && V.hangarCap) V.dronesAboard = Math.min(V.hangarCap, drones);
  if (wing !== null && wing !== undefined && V.wingCap) V.wingAboard = Math.min(V.wingCap, wing);
}
// What comes home: aboard, plus drones and aircraft still flying when the battle ends (they land);
// null when the design carries none. A carrier that is gone has lost what was flying.
function dronesHome(B, V) { if (!V.hangarCap && !droneLoadout(V.design)) return null; return (V.dronesAboard || 0) + (V.gone ? 0 : dronesFlying(B, V)); }
function wingsHome(B, V) { if (!V.wingCap && !wingLoadout(V.design)) return null; return (V.wingAboard || 0) + (V.gone ? 0 : wingsFlying(B, V)); }
