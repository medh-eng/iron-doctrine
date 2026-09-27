/* ==== 15 ECONOMY ==== */
// The basic economy of Part 3 (design/01 §7–§8; design/08 §6–§8, §13): the universal treasury,
// fuel and ammo markets at every settlement, refuelling and rearming a docked fleet, the fleet
// hold, and the daily income, wages and upkeep. Warehouses, crafting and convoys are Part 4.

// Buy price per unit at a settlement for a faction; null when there's no trade (war).
function buyPrice(s, good, faction) {
  const rel = relation(s.faction, faction);
  if (rel === 'war') return null;
  let p = PRICES[good] * SETTLEMENT_TYPES[s.type].price * (rel === 'own' ? OWN_PRICE : rel === 'truce' ? TRUCE_PRICE : 1);
  const normal = SETTLEMENT_TYPES[s.type].stock[good];
  if (s.market[good] < normal * 0.2) p *= 1.5;
  if (good === 'fuel' && faction === 'directorate') p *= 1.15;
  if (faction === 'league' && rel === 'own') p *= 0.85;
  return p;
}
const sellPrice = (s, good, faction) => { const b = buyPrice(s, good, faction); return b === null ? null : b * SELL_SHARE; };

// Ammo units to refill a ship's magazine from its current share (08 §8 per-shot table).
function ammoPerShot(cal) { let u = AMMO_PER_SHOT[0][1]; for (const [c, v] of AMMO_PER_SHOT) if (cal >= c) u = v; return u; }
const _ammoFull = {};
function shipAmmoFull(ship) {
  if (_ammoFull[ship.design] === undefined) {
    const d = shipDesign(ship);
    const st = statsOf(d);
    let cal = 0;
    for (const c of d.cells) { const P = PARTS[c.p]; if (P.cat === 'weapon' && P.cal && !P.auto) cal = Math.max(cal, P.cal); }
    _ammoFull[ship.design] = (st.shells || 0) * ammoPerShot(cal || 8) + 0.05;
  }
  return _ammoFull[ship.design];
}

// Fleet hold capacity in units (cargo parts, kg ÷ 100).
function holdCap(fl) {
  let kg = 0;
  for (const s of fleetShips(fl)) for (const c of shipDesign(s).cells) kg += PARTS[c.p].cargo || 0;
  return kg / 100;
}
const holdUsed = (fl) => (fl.hold.fuel || 0) + (fl.hold.ammo || 0);

function spend(amount) {
  if (amount > campaign.treasury + 1e-6) return false;
  campaign.treasury -= amount;
  return true;
}

// What refuelling or rearming the whole fleet needs here: { units, cost } or { why }.
function refuelQuote(fl, s) {
  let need = 0;
  for (const sh of fleetShips(fl)) need += shipStats(sh).fuelCap - sh.fuel;
  const price = buyPrice(s, 'fuel', fl.faction);
  if (price === null) return { why: 'No trade: at war.' };
  const units = Math.min(need, s.market.fuel);
  return { units, cost: units * price };
}
function rearmQuote(fl, s) {
  let need = 0;
  for (const sh of fleetShips(fl)) need += (1 - sh.ammo) * shipAmmoFull(sh);
  const price = buyPrice(s, 'ammo', fl.faction);
  if (price === null) return { why: 'No trade: at war.' };
  const units = Math.min(need, s.market.ammo);
  return { units, cost: units * price };
}
function refuel(fl, s) {
  const q = refuelQuote(fl, s);
  if (q.why || q.units <= 0) return q.why || 'Tanks are full.';
  if (!spend(q.cost)) return `Needs ${Math.ceil(q.cost)}; the treasury has ${Math.floor(campaign.treasury)}.`;
  s.market.fuel -= q.units;
  let left = q.units;
  for (const sh of fleetShips(fl)) { const add = Math.min(left, shipStats(sh).fuelCap - sh.fuel); sh.fuel += add; left -= add; }
  fl.stranded = false;
  return '';
}
function rearm(fl, s) {
  const q = rearmQuote(fl, s);
  if (q.why || q.units <= 0) return q.why || 'Magazines are full.';
  if (!spend(q.cost)) return `Needs ${Math.ceil(q.cost)}; the treasury has ${Math.floor(campaign.treasury)}.`;
  s.market.ammo -= q.units;
  let left = q.units;
  for (const sh of fleetShips(fl)) { const full = shipAmmoFull(sh); const add = Math.min(left, (1 - sh.ammo) * full); sh.ammo += add / full; left -= add; }
  return '';
}
// Buy or sell goods for the fleet hold, n units at a time.
function trade(fl, s, good, n) {
  if (n > 0) {
    const price = buyPrice(s, good, fl.faction);
    if (price === null) return 'No trade: at war.';
    n = Math.min(n, s.market[good], holdCap(fl) - holdUsed(fl));
    if (n <= 0) return holdCap(fl) - holdUsed(fl) <= 0 ? 'The hold is full.' : 'The market has none left.';
    if (!spend(n * price)) return `Needs ${Math.ceil(n * price)}; the treasury has ${Math.floor(campaign.treasury)}.`;
    s.market[good] -= n; fl.hold[good] = (fl.hold[good] || 0) + n;
  } else {
    const price = sellPrice(s, good, fl.faction);
    if (price === null) return 'No trade: at war.';
    n = Math.min(-n, fl.hold[good] || 0);
    if (n <= 0) return 'Nothing to sell.';
    fl.hold[good] -= n; s.market[good] += n; campaign.treasury += n * price;
  }
  return '';
}

// Once per in-game day: settlement income and upkeep, wages, markets refill.
function dailyEconomy() {
  let income = 0, wages = 0;
  for (const s of world.settlements) {
    const T = SETTLEMENT_TYPES[s.type];
    for (const [k, v] of Object.entries(T.stock)) s.market[k] = Math.min(v, s.market[k] + v * STOCK_REFILL);
    if (s.faction !== campaign.faction) continue;
    income += T.money * (T.money > 0 && s.coastal ? COASTAL_MONEY : 1);
  }
  for (const o of campaign.officers) {
    if (!o.alive || o.faction !== campaign.faction) continue;
    if (o.rank === 'captain') wages += WAGES.captain * o.level;
    else if (o.rank === 'admiral') wages += WAGES.admiral * o.level;
  }
  campaign.treasury += income - wages;
  return { income, wages };
}
