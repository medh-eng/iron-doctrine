/* ==== 15 ECONOMY ==== */
// The campaign economy (design/01 §7–§8; design/08 §6–§8, §13). Money is the only global
// resource: the treasury. Every other good is physical and sits in one settlement's warehouse
// or one fleet's hold (01 §8.1). Owned settlements produce goods into their warehouse each day;
// markets buy and sell every good; docked fleets load and unload; settlements can be upgraded.

// A cargo: units of each good, plus part items [{ p, cond }] that take their mass ÷ 100 in units.
function emptyCargo() { const c = { items: [] }; for (const k of GOODS) c[k] = 0; return c; }
const cargoUsed = (c) => { let n = itemsUsed(c); for (const k of GOODS) n += c[k] || 0; return n; };

// ---------- prices (08 §6)
// Why this settlement won't trade with a faction right now ('' when it will).
function tradeBlock(s, faction) {
  const rel = relation(s.faction, faction);
  if (rel === 'war') return 'No trade: at war.';
  if (rel === 'own' && faction === campaign.faction && servicesStopped(s)) return 'Services stopped: upkeep unpaid.';
  return '';
}
// The market's price per unit before the sell share; null when there's no trade.
function marketPrice(s, good, faction) {
  if (tradeBlock(s, faction)) return null;
  const rel = relation(s.faction, faction);
  let p = PRICES[good] * SETTLEMENT_TYPES[s.type].price * (rel === 'own' ? OWN_PRICE : rel === 'truce' ? TRUCE_PRICE : 1);
  const normal = SETTLEMENT_TYPES[s.type].stock[good];
  if (!SELL_ONLY[good] && s.market[good] < normal * 0.2) p *= 1.5;
  if (good === 'fuel' && faction === 'directorate') p *= 1.15;
  if (faction === 'league' && rel === 'own') p *= 0.85;
  return p;
}
const charter = (faction) => (faction === campaign.faction && hasPerk('charter') ? 0.08 : 0);   // Merchant charter perk
const buyPrice = (s, good, faction) => { const b = SELL_ONLY[good] ? null : marketPrice(s, good, faction); return b === null ? null : b * (1 - charter(faction)); };
const sellPrice = (s, good, faction) => { const b = marketPrice(s, good, faction); return b === null ? null : (SELL_ONLY[good] ? b : b * SELL_SHARE) * (1 + charter(faction)); };

// Forts and citadels cost upkeep; unpaid, their services stop (01 §8.5).
const servicesStopped = (s) => campaign.unpaid > 0 && SETTLEMENT_TYPES[s.type].money < 0;

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

// ---------- holds and warehouses
// Fleet hold capacity in units (cargo parts, kg ÷ 100).
function holdCap(fl) {
  let kg = 0;
  for (const s of fleetShips(fl)) for (const c of shipDesign(s).cells) kg += PARTS[c.p].cargo || 0;
  return (kg / 100) * (fl.faction === campaign.faction ? (hasPerk('holds') ? 1.1 : 1) * (fl.convoy && hasPerk('qmcorps') ? 1.1 : 1) : 1);
}
const holdUsed = (fl) => cargoUsed(fl.hold);
const storeCap = (s) => SETTLEMENT_TYPES[s.type].store;
const storeUsed = (s) => cargoUsed(s.store);
const ownStore = (s) => s.faction === campaign.faction;
// Where goods can go: a fleet's hold or a settlement's warehouse.
const place = (at) => (at.shipIds ? { c: at.hold, free: holdCap(at) - holdUsed(at), name: at.name } : { c: at.store, free: storeCap(at) - storeUsed(at), name: `${at.name} warehouse` });

function spend(amount) {
  if (amount > campaign.treasury + 1e-6) return false;
  campaign.treasury -= amount;
  return true;
}
const noMoney = (cost) => `Needs ${Math.ceil(cost)}; the treasury has ${Math.floor(campaign.treasury)}.`;

// ---------- refuel and rearm a docked fleet: own warehouse first (free), then the market
function need(fl, good) {
  let n = 0;
  for (const sh of fleetShips(fl)) n += good === 'fuel' ? shipStats(sh).fuelCap - sh.fuel : (1 - sh.ammo) * shipAmmoFull(sh);
  return Math.max(0, n);
}
// { units, fromStore, fromHold, cost } or { why }.
function supplyQuote(fl, s, good) {
  let left = need(fl, good);
  const fromHold = good === 'ammo' ? Math.min(left, fl.hold.ammo || 0) : 0;   // hold fuel is already in use
  left -= fromHold;
  const fromStore = s && ownStore(s) ? Math.min(left, s.store[good] || 0) : 0;
  left -= fromStore;
  let cost = 0, bought = 0;
  if (left > 1e-6 && s) {
    const price = buyPrice(s, good, fl.faction);
    if (price === null && !fromStore && !fromHold) return { why: tradeBlock(s, fl.faction) };
    if (price !== null) { bought = Math.min(left, s.market[good]); cost = bought * price; }
  }
  return { units: fromHold + fromStore + bought, fromHold, fromStore, bought, cost };
}
const refuelQuote = (fl, s) => supplyQuote(fl, s, 'fuel');
const rearmQuote = (fl, s) => supplyQuote(fl, s, 'ammo');
function supply(fl, s, good) {
  const q = supplyQuote(fl, s, good);
  if (q.why) return q.why;
  if (q.units <= 1e-6) return good === 'fuel' ? 'Tanks are full.' : 'Magazines are full.';
  if (!spend(q.cost)) return noMoney(q.cost);
  fl.hold[good] -= q.fromHold;
  if (s) { s.store[good] -= q.fromStore; s.market[good] -= q.bought; }
  let left = q.units;
  for (const sh of fleetShips(fl)) {
    if (good === 'fuel') { const add = Math.min(left, shipStats(sh).fuelCap - sh.fuel); sh.fuel += add; left -= add; }
    else { const full = shipAmmoFull(sh); const add = Math.min(left, (1 - sh.ammo) * full); sh.ammo += add / full; left -= add; }
  }
  if (good === 'fuel') fl.stranded = false;
  return '';
}
const refuel = (fl, s) => supply(fl, s, 'fuel');
const rearm = (fl, s) => supply(fl, s, 'ammo');

// ---------- markets: buy into or sell from a hold or an own warehouse, n units at a time
function trade(at, s, good, n) {
  const P = place(at);
  const faction = campaign.faction;
  if (n > 0) {
    const price = buyPrice(s, good, faction);
    if (price === null) return SELL_ONLY[good] ? 'The market only buys this.' : tradeBlock(s, faction);
    n = Math.min(n, s.market[good], P.free);
    if (n <= 1e-6) return P.free <= 1e-6 ? `${P.name}: no room.` : 'The market has none left.';
    if (!spend(n * price)) return noMoney(n * price);
    s.market[good] -= n; P.c[good] = (P.c[good] || 0) + n;
  } else {
    const price = sellPrice(s, good, faction);
    if (price === null) return tradeBlock(s, faction);
    n = Math.min(-n, P.c[good] || 0);
    if (n <= 1e-6) return 'Nothing to sell.';
    P.c[good] -= n; s.market[good] += n; campaign.treasury += n * price;
  }
  return '';
}

// Load (n > 0) from the warehouse into a docked fleet's hold, or unload (n < 0).
function transfer(fl, s, good, n) {
  if (!ownStore(s)) return 'Only your own warehouses.';
  if (fl.docked !== s.id) return 'The fleet is not docked here.';
  const [from, to] = n > 0 ? [place(s), place(fl)] : [place(fl), place(s)];
  const k = Math.min(Math.abs(n), from.c[good] || 0, to.free);
  if (k <= 1e-6) return !(from.c[good] > 0) ? `${from.name}: none.` : `${to.name}: no room.`;
  from.c[good] -= k; to.c[good] = (to.c[good] || 0) + k;
  return '';
}

// ---------- production (08 §7)
function production(s) {
  const T = SETTLEMENT_TYPES[s.type], B = BIOME_MAKE[s.biome] || {};
  const out = {};
  for (const k of ['wood', 'metal', 'elec']) if (T.make[k]) out[k] = T.make[k] * (B[k] || 1);
  if (B.scrap) out.scrap = B.scrap;
  return out;
}
const settlementMoney = (s) => { const m = SETTLEMENT_TYPES[s.type].money; return m * (m > 0 && s.coastal ? COASTAL_MONEY : 1) * (m > 0 && s.faction === campaign.faction && hasPerk('tax') ? 1.15 : 1); };

// ---------- upgrades (08 §7)
const upgradesFor = (s) => UPGRADES.filter((u) => u.from === s.type);
function upgradeBlock(s, u) {
  if (!ownStore(s)) return 'Only your own settlements.';
  if (s.upgrade) return 'An upgrade is already under way.';
  if (servicesStopped(s)) return 'Services stopped: upkeep unpaid.';
  for (const k of ['wood', 'metal', 'elec']) if ((s.store[k] || 0) < u[k]) return `The warehouse needs ${u[k]} ${GOOD_NAMES[k].toLowerCase()} (has ${Math.floor(s.store[k] || 0)}).`;
  if (campaign.treasury < u.money) return noMoney(u.money);
  return '';
}
function startUpgrade(s, u) {
  const why = upgradeBlock(s, u);
  if (why) return why;
  for (const k of ['wood', 'metal', 'elec']) s.store[k] -= u[k];
  spend(u.money);
  s.upgrade = { to: u.to, day: campaign.day + u.days };
  return '';
}

// ---------- once per in-game day: production, markets, upgrades, income, wages (01 §8.5)
function dailyEconomy() {
  let income = 0, wages = 0;
  const news = [];
  for (const s of world.settlements) {
    const T = SETTLEMENT_TYPES[s.type];
    for (const k of GOODS) if (!SELL_ONLY[k]) s.market[k] = Math.min(T.stock[k], s.market[k] + T.stock[k] * STOCK_REFILL);
    else s.market[k] = Math.max(0, s.market[k] - T.stock[k] * STOCK_REFILL);   // bought scrap leaves the market
    if (!s.faction) continue;
    if (!(s.restart > campaign.day)) {
      let room = storeCap(s) - storeUsed(s);
      for (const [k, v] of Object.entries(production(s))) { const add = Math.max(0, Math.min(v, room)); s.store[k] += add; room -= add; }
    }
    if (s.upgrade && campaign.day >= s.upgrade.day) {
      s.type = s.upgrade.to;
      delete s.upgrade;
      if (s.faction === campaign.faction) news.push(`${s.name} is now a ${SETTLEMENT_TYPES[s.type].name.toLowerCase()}.`);
    }
    if (s.faction === campaign.faction) income += settlementMoney(s);
    // Walls mend over days; a captured settlement pays plunder for ten days (08 §6).
    if (s.wallHp !== undefined && s.wallHp < 1) s.wallHp = Math.min(1, s.wallHp + SIEGE.wallRepair);
    if (s.keepHp !== undefined && s.keepHp < 1) s.keepHp = Math.min(1, s.keepHp + SIEGE.wallRepair);
    if (s.plunder >= campaign.day && s.faction === campaign.faction) income += plunderValue(s);
  }
  for (const o of campaign.officers) {
    if (!o.alive || o.faction !== campaign.faction) continue;
    if (o.rank === 'captain') wages += WAGES.captain * o.level;
    else if (o.rank === 'admiral') wages += WAGES.admiral * o.level;
    else if (o.rank === 'quartermaster') wages += WAGES.quartermaster;
  }
  campaign.treasury += income - wages;
  if (campaign.treasury < 0) {
    // Running dry: whatever can't be paid stays unpaid; after DESERT_DAYS captains may leave.
    campaign.treasury = 0;
    campaign.unpaid = (campaign.unpaid || 0) + 1;
    news.push(`Wages and upkeep unpaid (${campaign.unpaid} day${campaign.unpaid > 1 ? 's' : ''}).`);
    if (campaign.unpaid >= DESERT_DAYS) {
      const rng = makeRng(campaign.seed + campaign.day * 131);
      for (const o of campaign.officers) {
        if (!o.alive || o.faction !== campaign.faction || o.rank !== 'captain' || rng.next() >= DESERT_CHANCE) continue;
        o.alive = false; o.deserted = true;
        const sh = campaign.ships.find((x) => x.captainId === o.id);
        if (sh) sh.captainId = null;
        news.push(`Captain ${o.name} deserted.`);
      }
    }
  } else campaign.unpaid = 0;
  return { income, wages, news };
}
