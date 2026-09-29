/* ==== 15a WORKSHOP AND YARD ==== */
// Making things on the campaign map (design/01 §7.1, §9; design/08 §4–§5). Everything is made
// from goods physically present: the settlement's own warehouse, then the holds of your fleets
// docked there. Each settlement has one workshop queue (parts, refining) and one yard queue
// (ships, repairs, refits); only the first job in each queue advances.

// ---------- what can be made where
// Tier 0 parts are known from the start; the rest need their tech node (Part 5a, 15f) or a
// reverse-engineered family (campaign.unlocked).
const partUnlocked = (id) => {
  const lib = PART_LIBRARY.parts[id];
  if (!lib || PARTS[id].tier <= 0) return true;
  if (lib.unlock && lib.unlock.tech && techKnown(lib.unlock.tech)) return true;
  const known = campaign.unlocked || [];
  return known.includes(id) || known.some((k) => PART_LIBRARY.parts[k] && PART_LIBRARY.parts[k].family === lib.family);
};
const hasWorkshop = (s) => s.type === 'city' || s.type === 'metropolis';
// City: tier 0–2 parts marked for cities; metropolis: everything.
function craftableAt(s, id) {
  const P = PARTS[id], lib = PART_LIBRARY.parts[id];
  if (!lib || !hasWorkshop(s)) return false;
  return s.type === 'metropolis' || (lib.craftAt !== 'metropolis' && P.tier <= 2);
}
// Yard: cities build classes 1–2 (captain level up to 3), metropolises everything; ships need a coast.
function yardBlock(s, design) {
  if (!hasWorkshop(s)) return 'No yard here.';
  const cls = classFor(design);
  if (!cls) return 'Outside class limits.';
  if (s.type === 'city' && cls.captain > 3) return `${cls.name}: a metropolis yard.`;
  if (seaDomain(domainOf(design)) && !s.coastal) return 'Ships need a coastal yard.';
  const locked = design.cells.find((c) => PARTS[c.p].cat !== 'structure' && !partUnlocked(c.p));
  if (locked) return `${PARTS[locked.p].name} is not researched.`;
  return '';
}

// ---------- costs: { wood, metal, elec, scrap, money }
function addCost(to, cost, k = 1) { for (const [g, v] of Object.entries(cost || {})) to[g] = (to[g] || 0) + v * k; return to; }
// Money fee on top of any money in the recipe: CRAFT_FEE of the goods' base value.
function withFee(cost) {
  let value = 0;
  for (const g of GOODS) value += (cost[g] || 0) * PRICES[g];
  cost.money = (cost.money || 0) + value * CRAFT_FEE;
  return cost;
}
const craftHours = (s, id) => { const P = PARTS[id]; return (1 + P.mass / 250 + ((P.cost && P.cost.elec) || 0) * 0.3) * (s.type === 'metropolis' ? 0.75 : 1) * (perk('master_crafters') ? 0.75 : 1); };
function costText(c) {
  const parts = GOODS.filter((g) => c[g] > 0.005).map((g) => `${GOOD_NAMES[g].toLowerCase()} ${+c[g].toFixed(1)}`);
  if (c.money > 0.5) parts.push(`money ${Math.ceil(c.money)}`);
  return parts.join(' · ') || 'nothing';
}

// ---------- goods on hand at a settlement: its warehouse, then docked fleet holds
const dockedHere = (s) => playerFleets().filter((fl) => fl.docked === s.id && fl.shipIds.length);
function onHand(s, good) {
  let n = ownStore(s) ? s.store[good] || 0 : 0;
  for (const fl of dockedHere(s)) n += fl.hold[good] || 0;
  return n;
}
const itemsAt = (c) => c.items || (c.items = []);
function itemCount(s, id) {
  let n = ownStore(s) ? itemsAt(s.store).filter((it) => it.p === id).length : 0;
  for (const fl of dockedHere(s)) n += itemsAt(fl.hold).filter((it) => it.p === id).length;
  return n;
}
// Why this cost can't be paid here ('' when it can).
function lackOf(s, cost) {
  for (const g of GOODS) if ((cost[g] || 0) > onHand(s, g) + 1e-6) return `Needs ${+cost[g].toFixed(1)} ${GOOD_NAMES[g].toLowerCase()} here (has ${Math.floor(onHand(s, g))}).`;
  if ((cost.money || 0) > campaign.treasury + 1e-6) return noMoney(cost.money);
  return '';
}
function consume(s, cost) {
  for (const g of GOODS) {
    let left = cost[g] || 0;
    const spots = (ownStore(s) ? [s.store] : []).concat(dockedHere(s).map((fl) => fl.hold));
    for (const c of spots) { const k = Math.min(left, c[g] || 0); c[g] -= k; left -= k; }
  }
  campaign.treasury -= cost.money || 0;
}
function takeItem(s, id) {
  const spots = (ownStore(s) ? [s.store] : []).concat(dockedHere(s).map((fl) => fl.hold));
  for (const c of spots) { const i = itemsAt(c).findIndex((it) => it.p === id); if (i >= 0) return itemsAt(c).splice(i, 1)[0]; }
  return null;
}
const itemsUsed = (c) => (c.items || []).reduce((n, it) => n + PARTS[it.p].mass / 100, 0);

// Move all part items between the warehouse and a docked hold (dir 1 loads, −1 unloads).
function transferItems(fl, s, dir) {
  if (!ownStore(s) || fl.docked !== s.id) return 'The fleet is not docked at your settlement.';
  const [from, to] = dir > 0 ? [place(s), place(fl)] : [place(fl), place(s)];
  const src = itemsAt(from.c);
  let room = to.free, moved = 0;
  // Missiles, drones and aircraft (5b2, 5c2) move with the parts.
  moved += moveStock(from.c, to.c, room);
  room = dir > 0 ? holdCap(fl) - holdUsed(fl) : storeCap(s) - storeUsed(s);   // what's left
  if (!src.length && !moved) return `${from.name}: no parts.`;
  for (let i = src.length - 1; i >= 0; i--) {
    const u = PARTS[src[i].p].mass / 100;
    if (u > room) continue;
    itemsAt(to.c).push(src.splice(i, 1)[0]); room -= u; moved++;
  }
  return moved ? '' : `${to.name}: no room.`;
}

// ---------- workshop: craft a part, refine scrap
function servicesBlock(s) {
  if (!ownStore(s)) return 'Only your own settlements.';
  if (servicesStopped(s)) return 'Services stopped: upkeep unpaid.';
  return '';
}
function craftQuote(s, id) {
  const cost = withFee(addCost({}, PARTS[id].cost));
  return { cost, hours: craftHours(s, id) };
}
function craft(s, id) {
  const why = servicesBlock(s) || (!craftableAt(s, id) ? 'Not made here.' : !partUnlocked(id) ? 'Not researched.' : '');
  if (why) return why;
  const q = craftQuote(s, id);
  const lack = lackOf(s, q.cost);
  if (lack) return lack;
  consume(s, q.cost);
  (s.queue = s.queue || []).push({ kind: 'part', p: id, hours: q.hours, left: q.hours });
  return '';
}
const refineRate = (s) => (REFINE[s.type] ? { scrap: REFINE[s.type].scrap - (perk('refinery_knowhow') ? 1 : 0), hours: REFINE[s.type].hours } : null);
function refine(s, n) {
  const R = refineRate(s);
  const why = servicesBlock(s) || (!R ? 'No refinery here.' : '');
  if (why) return why;
  const cost = { scrap: R.scrap * n };
  const lack = lackOf(s, cost);
  if (lack) return lack;
  consume(s, cost);
  (s.queue = s.queue || []).push({ kind: 'refine', n, hours: R.hours * n, left: R.hours * n });
  return '';
}

// ---------- yard: build, repair, refit
// A design's cost: structure cells from goods; other parts from items in stock, else crafted.
function buildQuote(s, design) {
  const cost = {}, used = {};
  let hours = 0, mass = 0;
  for (const c of design.cells) {
    const P = PARTS[c.p];
    mass += P.mass;
    if (P.cat !== 'structure') {
      used[c.p] = (used[c.p] || 0) + 1;
      if (used[c.p] <= itemCount(s, c.p)) continue;
      hours += craftHours(s, c.p);
    }
    addCost(cost, P.cost);
  }
  withFee(cost);
  cost.money += RECRUIT.captain;                 // a level-1 captain takes command
  hours += mass / 400;
  return { cost, hours, items: Object.values(used).reduce((a, n) => a + n, 0) };
}
function buildShip(s, designId) {
  const d = shipDesign({ design: designId });
  const why = servicesBlock(s) || yardBlock(s, d);
  if (why) return why;
  const gar = campaign.ships.filter((sh) => sh.garrison === s.id).length + (s.yard || []).filter((j) => j.kind === 'ship').length;
  if (gar >= SETTLEMENT_TYPES[s.type].garrison) return `${s.name}'s garrison is full (${gar}).`;
  const q = buildQuote(s, d);
  const lack = lackOf(s, q.cost);
  if (lack) return lack;
  for (const c of d.cells) if (PARTS[c.p].cat !== 'structure') takeItem(s, c.p);   // stock first
  consume(s, q.cost);
  (s.yard = s.yard || []).push({ kind: 'ship', design: designId, hours: q.hours, left: q.hours });
  return '';
}

// Dock repair (08 §5): damaged share × part cost × 0.5, a 10% money fee; destroyed parts need
// a replacement item (or are made new at full cost).
function repairQuote(s, fl) {
  const cost = {};
  let hours = 0;
  for (const sh of fleetShips(fl)) {
    if (!sh.hp) continue;
    shipDesign(sh).cells.forEach((c, i) => {
      const f = 1 - sh.hp[i], P = PARTS[c.p];
      if (f <= 0.001) return;
      if (sh.hp[i] <= 0 && P.cat !== 'structure') addCost(cost, P.cost);
      else addCost(cost, P.cost, f * 0.5);
      hours += (f * P.mass) / 200;
    });
  }
  let value = 0;
  for (const g of GOODS) value += (cost[g] || 0) * PRICES[g];
  cost.money = (cost.money || 0) + value * 0.1;
  const T = s.type === 'fort' || s.type === 'citadel' ? 0.6 : s.type === 'village' ? 1.5 : 1;
  return { cost, hours: hours * T };
}
function repairFleet(s, fl) {
  const why = servicesBlock(s) || (fl.docked !== s.id ? 'The fleet is not docked here.' : (s.yard || []).some((j) => j.kind === 'repair' && j.fleet === fl.id) ? 'Already being repaired.' : '');
  if (why) return why;
  const q = repairQuote(s, fl);
  if (q.hours <= 0.001) return 'Nothing to repair.';
  const lack = lackOf(s, q.cost);
  if (lack) return lack;
  consume(s, q.cost);
  (s.yard = s.yard || []).push({ kind: 'repair', fleet: fl.id, hours: q.hours, left: q.hours });
  return '';
}

// Refit (08 §5): swap a ship to another design of its domain. Time = Σ mass added and removed ÷ 400 h.
// Removed parts go to the warehouse as items; added ones come from stock or are made.
function refitDiff(from, to) {
  const count = (d) => { const m = {}; for (const c of d.cells) m[c.p] = (m[c.p] || 0) + 1; return m; };
  const a = count(from), b = count(to), add = {}, remove = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const n = (b[k] || 0) - (a[k] || 0);
    if (n > 0) add[k] = n; else if (n < 0) remove[k] = -n;
  }
  return { add, remove };
}
function refitQuote(s, ship, designId) {
  const from = shipDesign(ship), to = shipDesign({ design: designId });
  const { add, remove } = refitDiff(from, to);
  const cost = {};
  let mass = 0, hours = 0;
  for (const [id, n] of Object.entries(add)) {
    const P = PARTS[id];
    mass += P.mass * n;
    const make = P.cat === 'structure' ? n : Math.max(0, n - itemCount(s, id));
    addCost(cost, P.cost, make);
    if (P.cat !== 'structure') hours += craftHours(s, id) * make;
  }
  for (const [id, n] of Object.entries(remove)) mass += PARTS[id].mass * n;
  withFee(cost);
  return { cost, hours: hours + mass / 400, add, remove };
}
function refitShip(s, fl, ship, designId) {
  const to = shipDesign({ design: designId });
  const why = servicesBlock(s) || yardBlock(s, to) || (fl.docked !== s.id ? 'The fleet is not docked here.' : '') ||
    (mapDomain(designReport(to).domain) !== fl.domain ? 'A refit keeps the ship in its domain.' : '') ||
    (ship.hp && ship.hp.some((v) => v < 1) ? 'Repair the ship first.' : '') || ((s.yard || []).some((j) => j.ship === ship.id) ? 'Already in the yard.' : '');
  if (why) return why;
  const q = refitQuote(s, ship, designId);
  const lack = lackOf(s, q.cost);
  if (lack) return lack;
  for (const [id, n] of Object.entries(q.add)) if (PARTS[id].cat !== 'structure') for (let k = 0; k < n; k++) takeItem(s, id);
  consume(s, q.cost);
  (s.yard = s.yard || []).push({ kind: 'refit', fleet: fl.id, ship: ship.id, design: designId, remove: q.remove, hours: q.hours, left: q.hours });
  return '';
}

// ---------- jobs advance with the clock; returns news for finished jobs
function jobName(j) {
  if (j.kind === 'part') return PARTS[j.p].name;
  if (j.kind === 'refine') return `${j.n} electronics`;
  if (j.kind === 'missile') return `${j.n} × ${(missileDesign(j.m) || { name: 'missile' }).name}`;
  if (j.kind === 'stock') return `${j.n} × ${stockName(j.stock, j.m)}`;
  if (j.kind === 'study') return `Study: ${PARTS[j.p].name}`;
  if (j.kind === 'ship') return shipDesign({ design: j.design }).name;
  if (j.kind === 'repair') { const fl = byId('fleets', j.fleet); return `Repairs: ${fl ? fl.name : 'a fleet'}`; }
  const sh = byId('ships', j.ship); return `Refit: ${sh ? shipStats(sh).name : 'a ship'}`;
}
function finishJob(s, j, rng) {
  if (j.kind === 'part') { itemsAt(s.store).push({ p: j.p, cond: 1 }); return `${s.name}: ${PARTS[j.p].name} made.`; }
  if (j.kind === 'refine') { s.store.elec += j.n; return `${s.name}: ${j.n} electronics refined.`; }
  if (j.kind === 'stock') return finishStock(s, j);
  if (j.kind === 'missile') { missilesAt(s.store)[j.m] = (missilesAt(s.store)[j.m] || 0) + j.n; return `${s.name}: ${jobName(j)} made.`; }
  if (j.kind === 'study') { (campaign.unlocked = campaign.unlocked || []).push(j.p); gaXpFor('reverse'); return `${s.name}: the ${PARTS[j.p].name} family can now be made.`; }
  if (j.kind === 'ship') {
    const sh = makeShip(j.design, campaign.faction, rng);
    sh.garrison = s.id;
    byId('officers', sh.captainId).garrisonedAt = s.id;
    return `${s.name}: ${shipStats(sh).name} launched; she waits in the garrison.`;
  }
  const fl = byId('fleets', j.fleet);
  if (!fl || fl.docked !== s.id) return `${s.name}: ${jobName(j).toLowerCase()} stopped: the fleet left.`;
  if (j.kind === 'repair') { for (const sh of fleetShips(fl)) sh.hp = null; return `${s.name}: ${fl.name} repaired.`; }
  const sh = byId('ships', j.ship);
  if (!sh || sh.fleetId !== fl.id) return `${s.name}: refit stopped: the ship left.`;
  for (const [id, n] of Object.entries(j.remove)) if (PARTS[id].cat !== 'structure') for (let k = 0; k < n; k++) itemsAt(s.store).push({ p: id, cond: 1 });
  sh.design = j.design; sh.hp = null;
  sh.fuel = Math.min(sh.fuel, shipStats(sh).fuelCap);
  return `${s.name}: ${shipStats(sh).name} refitted.`;
}
function stepWorks(dt) {
  const news = [];
  for (const s of world.settlements) {
    for (const q of [s.queue, s.yard]) {
      if (!q || !q.length) continue;
      if (s.faction !== campaign.faction) { q.length = 0; continue; }   // captured: the work is lost
      if (servicesStopped(s)) continue;
      q[0].left -= dt;
      if (q[0].left <= 0) news.push(finishJob(s, q.shift(), makeRng(campaign.seed + campaign.nextId)));
    }
  }
  return news;
}

// ---------- field repair (08 §5): repair bays mend 200 HP/h across the fleet for 0.6 × the
// dock repair goods, from the hold. Destroyed parts can't be mended in the field.
function repairBays(fl) {
  let n = 0;
  for (const sh of fleetShips(fl)) for (const c of shipDesign(sh).cells) if (c.p === 'repair') n++;
  return n;
}
function fieldRepair(fl, dt) {
  const bays = repairBays(fl);
  if (!bays) return;
  let hp = FIELD_REPAIR_HP * dt * bays * (fl.faction === campaign.faction && perk('field_engineers') ? 1.3 : 1);
  for (const sh of fleetShips(fl)) {
    if (!sh.hp) continue;
    const cells = shipDesign(sh).cells;
    for (let i = 0; i < cells.length && hp > 0; i++) {
      const f = sh.hp[i];
      if (f <= 0 || f >= 1) continue;
      const P = PARTS[cells[i].p];
      let add = Math.min(1 - f, hp / P.hp);
      // Goods for this share: 0.6 × dock repair (share × cost × 0.5).
      for (const [g, v] of Object.entries(P.cost || {})) if (GOODS.includes(g) && v > 0) add = Math.min(add, (fl.hold[g] || 0) / (v * 0.5 * FIELD_REPAIR_COST));
      if (add <= 0) continue;
      for (const [g, v] of Object.entries(P.cost || {})) if (GOODS.includes(g)) fl.hold[g] -= add * v * 0.5 * FIELD_REPAIR_COST;
      sh.hp[i] = f + add;
      hp -= add * P.hp;
    }
    if (sh.hp.every((v) => v >= 0.999)) sh.hp = null;
  }
}
