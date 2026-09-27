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

// Part 4c (08 §9, §13): hiring at forts, forming a fleet, promotion, salvage rates, wreck
// sites, scrap fields, reverse-engineering.
function recruitCheck() {
  newCampaign('league', 6161);
  const out = {};
  campaign.treasury = 1e6;
  const fort = world.settlements.find((s) => s.faction === 'league' && s.type === 'fort');
  const city = world.settlements.find((s) => s.faction === 'league' && s.capital);
  const offers = offersAt(fort);
  const capOffer = offers.find((o) => o.kind === 'captain');
  const t0 = campaign.treasury;
  out.hireCap = hire(fort, capOffer);
  const hired = campaign.ships.find((sh) => sh.garrison === fort.id);
  const cap = hired && byId('officers', hired.captainId);
  out.captain = { ok: !!hired, level: cap && cap.level, want: capOffer.level, paid: Math.round(t0 - campaign.treasury), price: Math.round(offerPrice(capOffer)) };
  out.hireAdm = hire(fort, offers.find((o) => o.kind === 'admiral'));
  out.qmAtFort = offersAt(fort).some((o) => o.kind === 'quartermaster');
  out.hireQm = hire(city, offersAt(city).find((o) => o.kind === 'quartermaster'));
  const adm = idleAt(fort, 'admiral')[0];
  const fleets0 = campaign.fleets.length;
  out.form = formFleet(fort, adm, shipStats(hired).domain);
  const nf = campaign.fleets[campaign.fleets.length - 1];
  out.formed = { fleets: campaign.fleets.length - fleets0, ships: nf.shipIds.length, admiral: nf.admiralId === adm.id, docked: nf.docked === fort.id };
  // Promotion: level 6 captain in a docked fleet.
  const sh = fleetShips(nf)[0], c = byId('officers', sh.captainId);
  c.level = 5;
  out.promoteLow = promote(fort, nf, sh) !== '';
  c.level = 6;
  out.promote = promote(fort, nf, sh);
  out.promoted = { rank: c.rank, ship: sh.captainId === null, idle: idleAt(fort, 'admiral').includes(c) };
  // Salvage: rates over many wrecks are near 12% of parts and 30% of mass.
  const rng = makeRng(9);
  const d = designFromTemplate('medium');
  const wrecks = [];
  for (let k = 0; k < 200; k++) wrecks.push({ design: d, own: false });
  const loot = salvageFrom(wrecks, [], rng);
  const parts = d.cells.filter((q) => PARTS[q.p].cat !== 'structure' && PART_LIBRARY.parts[q.p]).length * 200;
  const kg = d.cells.reduce((a, q) => a + PARTS[q.p].mass, 0) * 200;
  out.salvage = { partRate: +(loot.items.length / parts).toFixed(3), scrap: +(loot.scrap / (kg / 100)).toFixed(3), cond: loot.items.every((it) => it.cond >= 0.25 && it.cond <= 0.6) };
  // Wreck sites: what doesn't fit stays for a day, and can be collected.
  const land = playerFleets().find((fl) => fl.domain === 'land');
  const got = takeSalvage({ scrap: 12, items: [{ p: 'mg', cond: 0.4, salvaged: true }] }, [land], land.x, land.y);
  out.wreck = { left: got.leftScrap, sites: campaign.wrecks.length };
  const trucks = makeFleet('league', 'land', land.x, land.y, ['truck'], makeRng(1));
  out.collect = collectWreck(trucks, wreckNear(trucks));
  out.collected = { scrap: trucks.hold.scrap, items: itemsAt(trucks.hold).length, sites: campaign.wrecks.length };
  takeSalvage({ scrap: 5, items: [] }, [land], land.x + 3, land.y);
  campaign.hour += WRECK_HOURS + 1;
  stepSalvage(0.1);
  out.expired = campaign.wrecks.length === 0;
  // Scrap fields: a fleet with a crane gathers; without one, nothing.
  const f = campaign.scrapFields[0];
  out.fields = campaign.scrapFields.length;
  trucks.x = f.x; trucks.y = f.y; trucks.path = [];
  const s0 = trucks.hold.scrap;
  stepSalvage(2);
  out.noCrane = trucks.hold.scrap === s0;
  const craneD = Object.assign(designFromTemplate('truck'), { id: 'test_crane' });
  craneD.cells.push({ p: 'crane', x: 0, y: 0 });
  save.designs.list.push(craneD);
  fleetShips(trucks)[0].design = 'test_crane';
  const left0 = f.left;
  stepSalvage(2);
  out.gather = { got: +(trucks.hold.scrap - s0).toFixed(2), field: +(left0 - f.left).toFixed(2) };
  save.designs.list.pop();
  // Reverse-engineering at a metropolis: consumes the item, takes 3 days, unlocks the family.
  const it = { p: 'c105', cond: 0.4, salvaged: true };
  itemsAt(city.store).push(it);
  out.studyCity = study(city, it) !== '';
  city.type = 'metropolis';
  out.lockedBefore = partUnlocked('c105');
  out.study = study(city, it);
  out.consumed = !itemsAt(city.store).includes(it);
  for (let h = 0; h < STUDY_DAYS * 24 + 1; h++) stepWorks(1);
  out.unlocked = partUnlocked('c105');
  return out;
}

// Part 4d (01 §8.4): a quartermaster's convoy on a standing route keeps a stranded fleet going,
// runs by itself, is raided by preference, and its loss stops the deliveries.
function convoyCheck() {
  newCampaign('league', 7272);
  const out = {};
  campaign.treasury = 1e6;
  const home = world.settlements.find((s) => s.faction === 'league' && s.capital);
  home.store.fuel = 300; home.store.ammo = 60;
  // Keep the enemy away while the route runs.
  for (const fl of campaign.fleets) if (fl.faction !== 'league') { fl.x = fl.y = 1; fl.path = []; fl.cooldown = 1e6; fl.ai.t = 1e6; }
  hire(home, offersAt(home).find((o) => o.kind === 'quartermaster'));
  for (let k = 0; k < 2; k++) { const t = makeShip('truck', 'league', makeRng(k)); t.garrison = home.id; }
  const esc = makeShip('light', 'league', makeRng(5)); esc.garrison = home.id;
  const qm = idleAt(home, 'quartermaster')[0];
  out.form = formConvoy(home, qm, 'land');
  const cv = campaign.fleets.find((fl) => fl.convoy);
  out.convoy = { ships: cv.shipIds.length, combat: fleetShips(cv).filter(isCombat).length, cap: holdCap(cv) };
  // The land fleet sits dry at another of your settlements.
  const land = playerFleets().find((fl) => fl.domain === 'land' && !fl.convoy);
  const far = world.settlements.filter((s) => s.faction === 'league' && s !== home && fleetPath(world, 'land', home.x + 0.5, home.y + 0.5, s.x + 0.5, s.y + 0.5)).sort((a, b) => Math.hypot(b.x - home.x, b.y - home.y) - Math.hypot(a.x - home.x, a.y - home.y))[0];
  land.x = far.x + 0.5; land.y = far.y + 0.5; land.path = []; land.docked = far.id;
  for (const sh of fleetShips(land)) { sh.fuel = 0; sh.ammo = 0; }
  land.stranded = true;
  out.noGoods = setRoute(cv, home.id, { fleet: land.id }, []) !== '';
  out.route = setRoute(cv, home.id, { fleet: land.id }, ['fuel', 'ammo']);
  const f0 = fleetFuel(land).fuel, s0 = home.store.fuel;
  let hours = 0;
  while (hours < 240 && cv.route && cv.route.trips < 2) { campaign.running = true; campaignTick(1); hours++; }
  out.run = { trips: cv.route ? cv.route.trips : -1, hours, fuelGot: +(fleetFuel(land).fuel - f0).toFixed(2), ammo: +fleetAmmo(land).toFixed(2), stranded: land.stranded, storeUsed: +(s0 - home.store.fuel).toFixed(1) };
  // Raiders prefer the convoy over a slightly closer fleet.
  const raider = campaign.fleets.find((fl) => fl.faction !== 'league' && fl.domain === 'land' && relation(fl.faction, 'league') === 'war');
  raider.cooldown = 0;
  campaign.day = 3;
  const cx = cv.x, cy = cv.y;
  cv.path = []; cv.x = cx; cv.y = cy;
  land.x = cx + 8; land.y = cy; land.path = [];
  raider.x = cx + 5; raider.y = cy; raider.path = [];   // land 3 cells away, convoy 5 × 0.6 = 3 … closer by the pull
  land.x = cx + 8.4;
  aiThink(raider);
  out.raid = raider.ai.target === cv.id;
  // Interception: contact, then the convoy is beaten and its cargo lost with it.
  raider.x = cv.x + 1; raider.y = cv.y; raider.path = []; cv.cooldown = 0; land.x = cv.x + 30;
  campaign.running = true;
  const ev = campaignTick(0.25);
  const c = ev.find((e) => e.contact);
  out.contact = !!(c && c.contact.mine === cv.id);
  for (const sh of fleetShips(cv)) sh.hp = shipDesign(sh).cells.map(() => 0.05);
  autoResolve(cv, raider);
  out.lost = { gone: !campaign.fleets.includes(cv) || !cv.shipIds.length };
  return out;
}

// Part 4e (01 §11): siege battles with walls, keep and emplacements; capture restarts production
// after two days with plunder; a failed siege leaves walls damaged that mend; AI sieges you.
function siegeCheck() {
  newCampaign('league', 8383);
  const out = {};
  const land = playerFleets().find((fl) => fl.domain === 'land');
  const target = world.settlements.find((s) => s.faction && s.faction !== 'league' && relation(s.faction, 'league') === 'war' && s.type === 'city');
  land.x = target.x + 1.5; land.y = target.y + 0.5; land.path = [];
  out.block = siegeBlock(land, target);
  const contact = { siege: target.id, fleet: land.id };
  const B = createSiegeBattle(contact, true);
  const S = B.siege;
  out.structures = { walls: S.walls.length, keep: !!S.keep, emplacements: S.emplacements.length, slots: SETTLEMENT_TYPES.city.slots, side: S.defender, anchored: S.walls.every((V) => V.anchored && V.structure), militia: B.units.filter((V) => V.design.name && V.design.name.startsWith('Militia')).length };
  // A wall stands still after a few seconds of battle, and blocks the attackers but not its own side.
  const wx = S.walls[0].body.x;
  for (let t = 0; t < 3; t += SIM_STEP) updateBattle(B, SIM_STEP);
  out.wallStill = Math.abs(S.walls[0].body.x - wx) < 0.01;
  // Knock the keep down: the attacker wins and the city changes hands.
  for (const p of S.keep.parts) p.hp = 1;
  checkVehicleState(B, S.keep, null);
  for (let t = 0; t < 0.2 && !B.result; t += SIM_STEP) updateBattle(B, SIM_STEP);
  out.keepWin = B.result;
  const res = applyBattleOutcome(B);
  out.captured = { owner: target.faction, restart: target.restart - campaign.day, plunder: target.plunder - campaign.day, text: res.siege };
  // Production restarts after two days; plunder pays meanwhile.
  const w0 = target.store.wood, t0 = campaign.treasury;
  campaign.day++; dailyEconomy();
  const w1 = target.store.wood;
  campaign.day++; dailyEconomy();
  out.restart = { day1: +(w1 - w0).toFixed(2), day2: +(target.store.wood - w1).toFixed(2), plunderPaid: campaign.treasury - t0 > plunderValue(target) };
  // Emplacements: a gun from the warehouse goes into a slot and fights for you.
  itemsAt(target.store).push({ p: 'c37', cond: 1 });
  out.install = installEmplacement(target, 0, 'c37');
  out.installed = target.emplace[0] === 'c37' && !itemsAt(target.store).some((it) => it.p === 'c37');
  // You defend: an enemy fleet besieges; you hold; the walls are left damaged and mend.
  const enemy = campaign.fleets.find((fl) => fl.faction !== 'league' && fl.domain === 'land' && relation(fl.faction, 'league') === 'war' && fl.shipIds.length);
  enemy.x = target.x + 1.5; enemy.y = target.y + 0.5; enemy.path = [];
  const D = createSiegeBattle({ siege: target.id, fleet: enemy.id }, true);
  out.defend = { side: D.siege.defender, empl: D.siege.emplacements.length && D.siege.emplacements[0].side === 0, squad: D.squad.length };
  for (const V of D.siege.walls) for (const p of V.parts) p.hp *= 0.5;
  D.result = 'win';
  applyBattleOutcome(D);
  const hurt = target.wallHp;
  campaign.day++; dailyEconomy();
  out.held = { owner: target.faction, walls: +hurt.toFixed(2), mended: target.wallHp > hurt };
  // Auto-resolve a siege end to end.
  const r2 = autoResolveSiege({ siege: target.id, fleet: enemy.id });
  out.auto = !!r2.summary;
  // AI siege: a strong enemy fleet marches on a weak settlement of yours and lays siege.
  newCampaign('league', 8384);
  campaign.day = SIEGE.aiFrom + 1;
  const vil = world.settlements.find((s) => s.faction === 'league' && s.type === 'village');
  const ai = campaign.fleets.find((fl) => fl.faction !== 'league' && fl.domain === 'land' && relation(fl.faction, 'league') === 'war');
  for (const fl of campaign.fleets) if (fl !== ai && fl.faction !== 'league') { fl.x = fl.y = 1; fl.cooldown = 1e6; fl.ai.t = 1e6; }
  for (const fl of playerFleets()) { fl.x = 2; fl.y = WORLD_H - 2; fl.path = []; fl.cooldown = 1e6; }
  const at = portCell(vil, 'land');
  ai.x = at[0] + 3; ai.y = at[1]; ai.path = []; ai.cooldown = 0;
  for (let k = 0; k < 4; k++) { const sh = makeShip('medium', ai.faction, makeRng(k)); sh.fleetId = ai.id; ai.shipIds.push(sh.id); }
  aiThink(ai);
  out.aiTarget = ai.ai.siege === vil.id;
  let ev = null;
  for (let h = 0; h < 48 && !ev; h++) { campaign.running = true; ev = campaignTick(1).find((e) => e.contact && e.contact.siege); }
  out.aiSiege = !!(ev && ev.contact.siege === vil.id && ev.contact.defend);
  return out;
}
/*TEST:END*/
