/* ==== 15e CONVOYS ==== */
// Quartermasters and standing supply routes (design/01 §8.3–§8.4). A convoy is a fleet led by a
// quartermaster: support ships and at most CONVOY_COMBAT combat ships. On a standing route it
// loads at settlement A, delivers to settlement B or meets a named fleet wherever it is,
// returns, and repeats, by itself. The goods travel physically in its holds, so a convoy that
// is sunk takes its cargo with it, and the fleet it was feeding runs dry.

const isCombat = (sh) => shipDesign(sh).cells.some((c) => PARTS[c.p].cat === 'weapon');

// A quartermaster in a settlement forms a convoy from garrison ships of one domain.
function formConvoy(s, qm, domain) {
  const ships = campaign.ships.filter((sh) => sh.garrison === s.id && shipStats(sh).domain === domain);
  const support = ships.filter((sh) => !isCombat(sh)), escort = ships.filter(isCombat).slice(0, CONVOY_COMBAT);
  if (!support.length) return 'A convoy needs a support ship (no weapons) in the garrison.';
  const at = portCell(s, domain);
  if (!at) return 'No water here for ships.';
  delete qm.garrisonedAt;
  const fl = makeFleet(campaign.faction, domain, at[0], at[1], [], null, qm);
  qm.fleetId = fl.id;
  fl.convoy = true;
  fl.name = `${qm.name.split(' ')[1]}'s convoy`;
  fl.docked = s.id;
  for (const sh of support.concat(escort).slice(0, CONVOY_SIZE)) pickUp(fl, sh);
  return '';
}

// ---------- routes: { a: settlement id, b: settlement id or null, fleet: fleet id or null, goods, step }
function setRoute(fl, a, b, goods) {
  if (!fl.convoy) return 'Only convoys run supply routes.';
  const A = byId('settlements', a);
  if (!A || A.faction !== campaign.faction) return 'Load at one of your own settlements.';
  if (!b || (!b.settlement && !b.fleet)) return 'Choose where to deliver.';
  if (b.settlement === a) return 'Deliver somewhere else.';
  if (!goods.length) return 'Choose at least one good.';
  if (!holdCap(fl)) return 'The convoy has no cargo bays.';
  fl.route = { a, b: b.settlement || null, fleet: b.fleet || null, goods: goods.slice(), step: 'toA', wait: 0, trips: 0 };
  fl.path = []; fl.dest = null;
  return '';
}
function stopRoute(fl) { delete fl.route; }
const routeTarget = (r) => (r.fleet ? byId('fleets', r.fleet) : byId('settlements', r.b));
function routeText(fl) {
  const r = fl.route;
  if (!r) return 'No standing route.';
  const A = byId('settlements', r.a), T = routeTarget(r);
  const to = T ? T.name : 'gone';
  const step = r.wait > 0 ? `waiting at ${A.name} for goods` : r.step === 'toA' ? `going to load at ${A.name}` : `taking ${r.goods.map((g) => GOOD_NAMES[g].toLowerCase()).join(', ')} to ${to}`;
  return `${A.name} → ${to}: ${step}. Trips: ${r.trips}.`;
}

// Head for a point; returns false when there's no way there.
function convoyGo(fl, x, y) {
  const path = fleetPath(world, fl.domain, fl.x, fl.y, x, y);
  if (!path || !path.length) return false;
  fl.path = path; fl.dest = path[path.length - 1]; fl.docked = null;
  return true;
}
const nearTo = (fl, x, y) => Math.hypot(fl.x - x, fl.y - y) < 1.5;

// Load at A: the convoy's own tanks from the warehouse, then the route goods, sharing the hold.
function convoyLoad(fl, A) {
  for (const sh of fleetShips(fl)) { const k = Math.min(shipStats(sh).fuelCap - sh.fuel, A.store.fuel); sh.fuel += k; A.store.fuel -= k; }
  fl.stranded = false;
  const r = fl.route;
  let loaded = 0;
  for (let i = 0; i < r.goods.length; i++) {
    const g = r.goods[i];
    const free = holdCap(fl) - holdUsed(fl);
    const share = free / (r.goods.length - i);
    const k = Math.min(share, A.store[g] || 0);
    A.store[g] -= k; fl.hold[g] += k; loaded += k;
  }
  return loaded;
}
// Deliver to a settlement's warehouse, or into a fleet's tanks, magazines and hold.
function convoyDeliver(fl, T) {
  const r = fl.route;
  let given = 0;
  for (const g of r.goods) {
    let k = fl.hold[g] || 0;
    if (k <= 0) continue;
    const before = k;
    if (T.shipIds) {
      for (const sh of fleetShips(T)) {
        if (g === 'fuel') { const add = Math.min(k, shipStats(sh).fuelCap - sh.fuel); sh.fuel += add; k -= add; }
        if (g === 'ammo') { const full = shipAmmoFull(sh), add = Math.min(k, (1 - sh.ammo) * full); sh.ammo += add / full; k -= add; }
      }
      if (g === 'fuel' && k < before) T.stranded = false;
      const room = Math.max(0, holdCap(T) - holdUsed(T)), put = Math.min(k, room);
      T.hold[g] += put; k -= put;
    } else {
      const room = Math.max(0, storeCap(T) - storeUsed(T)), put = Math.min(k, room);
      T.store[g] += put; k -= put;
    }
    fl.hold[g] = k;
    given += before - k;
  }
  return given;
}

// Runs every clock tick for your convoys on a route. Returns news.
function stepConvoys(dt) {
  const news = [];
  for (const fl of playerFleets()) {
    const r = fl.route;
    if (!r || !fl.shipIds.length || fl.path.length) continue;
    const A = byId('settlements', r.a), T = routeTarget(r);
    if (!A || A.faction !== campaign.faction || !T || (!T.shipIds && T.faction !== campaign.faction) || (T.shipIds && !T.shipIds.length)) {
      news.push(`${fl.name}: route ended (${!A || A.faction !== campaign.faction ? 'the loading point is lost' : 'the delivery point is gone'}).`);
      stopRoute(fl);
      continue;
    }
    if (r.wait > 0) { r.wait -= dt; continue; }
    if (r.step === 'toA') {
      const at = portCell(A, fl.domain);
      if (!at) { news.push(`${fl.name}: ${A.name} can't be reached.`); stopRoute(fl); continue; }
      if (!nearTo(fl, at[0], at[1])) { if (!convoyGo(fl, at[0], at[1])) { news.push(`${fl.name}: no way to ${A.name}.`); stopRoute(fl); } continue; }
      fl.docked = A.id;
      const onBoard = r.goods.reduce((n, g) => n + (fl.hold[g] || 0), 0);
      if (convoyLoad(fl, A) + onBoard < 0.5) { r.wait = CONVOY_WAIT; continue; }
      r.step = 'toB';
    }
    if (r.step === 'toB') {
      const at = T.shipIds ? [T.x, T.y] : portCell(T, fl.domain);
      if (!at) { news.push(`${fl.name}: ${T.name} can't be reached.`); stopRoute(fl); continue; }
      if (!nearTo(fl, at[0], at[1])) {
        if (!convoyGo(fl, at[0], at[1])) { news.push(`${fl.name}: no way to ${T.name}.`); stopRoute(fl); continue; }
        // A moving fleet: head for where it is now, then look again.
        if (T.shipIds && fl.path.length > CONVOY_REPLAN) fl.path.length = CONVOY_REPLAN;
        continue;
      }
      if (!T.shipIds) fl.docked = T.id;
      convoyDeliver(fl, T);
      r.trips++;
      gaXp(GA_XP.convoy);
      r.step = 'toA';
    }
  }
  return news;
}
