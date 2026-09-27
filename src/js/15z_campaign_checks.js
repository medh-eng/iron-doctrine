/* ==== 15z CAMPAIGN CHECKS ==== */
// Test-only checks of the campaign economy, called from the smoke test.
/*TEST:BEGIN*/
// Part 4a (design/01 §8; 08 §6–§7): warehouses, production, markets for every good, loading
// docked holds, refuelling from stores, upgrades, running out of money, and older saves.
function economyCheck() {
  newCampaign('league', 4242);
  const out = {};
  const home = world.settlements.find((s) => s.faction === 'league' && s.capital);
  out.kit = { wood: home.store.wood, metal: home.store.metal, elec: home.store.elec };
  // Production: one day into the warehouse, by type and biome; neutral villages make nothing.
  const vil = world.settlements.find((s) => s.faction === 'league' && s.type === 'village');
  const neutral = world.settlements.find((s) => !s.faction);
  const w0 = vil.store.wood, n0 = cargoUsed(neutral.store);
  dailyEconomy();
  out.production = { made: +(vil.store.wood - w0).toFixed(2), expect: production(vil).wood, neutral: cargoUsed(neutral.store) - n0 };
  // A warehouse never overfills.
  vil.store.wood += storeCap(vil) - storeUsed(vil) - 1;
  dailyEconomy();
  out.capped = storeUsed(vil) <= storeCap(vil) + 1e-6;
  vil.store.wood = 0;
  // Markets sell every good but scrap, which they only buy.
  const t0 = campaign.treasury;
  const e1 = trade(home, home, 'metal', 10);
  out.buy = { why: e1, metal: home.store.metal, paid: +(t0 - campaign.treasury).toFixed(2), price: +(buyPrice(home, 'metal', 'league') * 10).toFixed(2) };
  out.scrap = { buy: trade(home, home, 'scrap', 5), sell: trade(home, home, 'scrap', -5), left: home.store.scrap };
  // A truck fleet docks, loads metal, and the warehouse loses exactly that.
  const trucks = makeFleet('league', 'land', home.x + 0.5, home.y + 0.5, ['truck', 'truck'], makeRng(3));
  trucks.docked = home.id;
  const m0 = home.store.metal;
  const e2 = transfer(trucks, home, 'metal', 10);
  out.load = { why: e2, cap: holdCap(trucks), hold: trucks.hold.metal, store: +(m0 - home.store.metal).toFixed(2) };
  trucks.docked = null;
  out.undocked = transfer(trucks, home, 'metal', -5) !== '';
  // Refuelling at home takes the warehouse's fuel first, free of charge.
  const land = playerFleets().find((fl) => fl.domain === 'land');
  for (const sh of fleetShips(land)) sh.fuel = 0;
  land.docked = home.id;
  const f0 = home.store.fuel, t1 = campaign.treasury;
  const q = refuelQuote(land, home);
  refuel(land, home);
  out.stores = { fromStore: +q.fromStore.toFixed(2), used: +(f0 - home.store.fuel).toFixed(2), paid: +(t1 - campaign.treasury).toFixed(2), cost: +q.cost.toFixed(2) };
  // A field rearm draws the hold's ammo.
  trucks.hold.ammo = 5;
  for (const sh of fleetShips(trucks)) sh.ammo = 0;
  const trucksAmmo = rearmQuote(trucks, null);
  out.fieldRearm = { needs: trucksAmmo.units > 0 || shipAmmoFull(fleetShips(trucks)[0]) < 0.1, why: rearm(trucks, null) };
  // Upgrades: blocked without materials; with them, done after the stated days.
  const u = upgradesFor(vil).find((x) => x.to === 'city');
  out.upBlocked = upgradeBlock(vil, u) !== '';
  vil.store.wood = u.wood; vil.store.metal = u.metal; campaign.treasury = u.money + 500;
  const e3 = startUpgrade(vil, u);
  for (let d = 0; d < u.days; d++) { campaign.day++; dailyEconomy(); }
  out.upgrade = { why: e3, type: vil.type, money: Math.round(campaign.treasury) };
  // Running dry: no money → unpaid days; after DESERT_DAYS captains may desert; forts close.
  for (let d = 0; d < 8; d++) { campaign.day++; campaign.treasury = -1000; dailyEconomy(); }
  const fort = world.settlements.find((s) => s.faction === 'league' && s.type === 'fort');
  out.dry = { unpaid: campaign.unpaid, deserted: campaign.officers.filter((o) => o.deserted).length, closed: tradeBlock(fort, 'league') !== '' };
  // An older (v1) save is brought forward, not wiped.
  newCampaign('league', 99);
  const old = JSON.parse(JSON.stringify(campaign));
  for (const s of old.settlements) { delete s.store; s.market = { fuel: s.market.fuel, ammo: s.market.ammo }; }
  for (const fl of old.fleets) fl.hold = { fuel: 1, ammo: 0 };
  delete old.unpaid; old.v = 1;
  try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify({ v: 1, t: Date.now(), data: old })); } catch (_e) { /* ignore */ }
  const ok = campaignStore.load();
  const h2 = world.settlements.find((s) => s.faction === 'league' && s.capital);
  out.migrate = { ok, v: campaign.v, store: h2.store.wood, market: GOODS.every((k) => h2.market[k] !== undefined), hold: campaign.fleets[0].hold.fuel === 1 && campaign.fleets[0].hold.metal === 0 };
  return out;
}


// Part 4b (08 §4–§5): crafting needs goods physically here, refining, building ships into the
// garrison, dock repair, refits returning parts, field repair from the hold.
function workshopCheck() {
  newCampaign('league', 5151);
  const out = {};
  const home = world.settlements.find((s) => s.faction === 'league' && s.capital);
  const run = (h) => { for (let t = 0; t < h; t += 0.5) stepWorks(0.5); };
  // Crafting with nothing on hand fails; with the goods in the warehouse it queues and finishes.
  for (const g of GOODS) home.store[g] = 0;
  out.empty = craft(home, 'c37');
  const q = craftQuote(home, 'c37');
  addCost(home.store, q.cost);
  delete home.store.money;
  const m0 = campaign.treasury;
  out.craft = craft(home, 'c37');
  out.queued = home.queue.length;
  run(q.hours + 0.5);
  out.made = { items: itemCount(home, 'c37'), metal: +home.store.metal.toFixed(3), paid: +(m0 - campaign.treasury).toFixed(2), fee: +q.cost.money.toFixed(2) };
  // Goods in a docked hold count; goods in a hold elsewhere don't.
  const trucks = makeFleet('league', 'land', home.x + 0.5, home.y + 0.5, ['truck'], makeRng(2));
  trucks.hold.metal = 30;
  out.away = craft(home, 'mg');
  trucks.docked = home.id;
  out.docked = craft(home, 'mg');
  // Refining: scrap → electronics.
  home.store.scrap = REFINE.city.scrap * 2;
  const e0 = home.store.elec;
  out.refine = refine(home, 2);
  run(30);
  out.refined = +(home.store.elec - e0).toFixed(2);
  // Building a ship: it joins the garrison with a captain.
  for (const g of ['wood', 'metal', 'elec']) home.store[g] = 1000;
  campaign.treasury = 20000;
  const d = shipDesign({ design: 'light' });
  const bq = buildQuote(home, d);
  const ships0 = campaign.ships.length;
  out.build = buildShip(home, 'light');
  run(bq.hours + 1);
  const built = campaign.ships.find((sh) => sh.garrison === home.id && sh.design === 'light');
  out.built = { ships: campaign.ships.length - ships0, garrison: !!built, captain: !!(built && byId('officers', built.captainId)) };
  // Sea ships need a coastal yard; big classes need a metropolis.
  const inland = world.settlements.find((s) => !s.coastal);
  out.seaInland = inland ? yardBlock(Object.assign({}, inland, { type: 'city' }), shipDesign({ design: 'gunboat' })) : 'Ships need a coastal yard.';
  // Dock repair: damage the land fleet, repair it here.
  const land = playerFleets().find((fl) => fl.domain === 'land');
  land.x = home.x + 0.5; land.y = home.y + 0.5; land.path = []; land.docked = home.id;
  const sh = fleetShips(land)[0];
  sh.hp = shipDesign(sh).cells.map((c, i) => (i % 3 === 0 ? 0.5 : 1));
  const rq = repairQuote(home, land);
  out.repair = repairFleet(home, land);
  run(rq.hours + 1);
  out.repaired = sh.hp === null;
  // Refit: light → medium keeps parts that stay, returns removed parts as items.
  const it0 = itemsAt(home.store).length;
  const light = fleetShips(land).find((x) => x.design === 'light');
  const fq = light ? refitQuote(home, light, 'scout') : null;
  out.refit = light ? refitShip(home, land, light, 'scout') : 'no light tank';
  run((fq ? fq.hours : 0) + 1);
  out.refitted = { design: light && light.design, returned: itemsAt(home.store).length - it0, removed: fq ? Object.keys(fq.remove).filter((id) => PARTS[id].cat !== 'structure').length : 0 };
  // Field repair: a repair bay mends from the hold's goods only.
  const rep = makeFleet('league', 'land', 20, 20, ['light'], makeRng(4));
  const rs = fleetShips(rep)[0];
  const dd = shipDesign(rs);
  rs.design = 'light';
  const bay = dd.cells.findIndex((c) => PARTS[c.p].cat === 'structure');
  rs.hp = dd.cells.map((c, i) => (i === bay ? 0.5 : 1));
  const before = rs.hp[bay];
  fieldRepair(rep, 5);
  out.noBay = rs.hp[bay] === before;
  // The same ship with a repair bay: mends only while the hold has the goods.
  const withBay = Object.assign(designFromTemplate('light'), { id: 'test_repairbay' });
  withBay.cells.push({ p: 'repair', x: 0, y: 0 });
  save.designs.list.push(withBay);
  rs.design = 'test_repairbay';
  rs.hp = withBay.cells.map((c, i) => (i === bay ? 0.5 : 1));
  fieldRepair(rep, 5);
  out.dryHold = rs.hp[bay] === 0.5;
  for (const g of GOODS) rep.hold[g] = 50;
  fieldRepair(rep, 5);
  out.fieldRepaired = rs.hp === null || rs.hp[bay] > 0.5;
  save.designs.list.pop();
  return out;
}
/*TEST:END*/
