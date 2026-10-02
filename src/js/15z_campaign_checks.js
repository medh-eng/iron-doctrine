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
  techState().known = TECH.filter((n) => n.tier === 1).map((n) => n.id);   // an established campaign: tier 1 researched
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
  const light = fleetShips(land)[0];      // starting designs vary by faction; refit from a v1 light tank
  if (light) { light.design = 'light'; light.hp = null; }
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
  const flag = playerFleets().find((fl) => fl.domain === 'land');
  const land = makeFleet('league', 'land', flag.x, flag.y, ['light'], makeRng(2));   // no hold: salvage is left on the field
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
// Research and perks (Part 5a): Command Points come from rank; a node costs CP, money and
// warehouse goods and takes days; it unlocks parts for crafting and the Drafting Office;
// prerequisites hold; the tree costs far more CP than a Grand Admiral earns; perks act.
function researchCheck() {
  newCampaign('league', 6161);
  const out = {};
  const home = world.settlements.find((s) => s.faction === 'league' && s.capital);
  const ga = grandAdmiral();
  const gm = TECH_BY_ID.guns_medium;
  out.cp1 = cpEarned();
  out.noCp = researchBlock(gm, home);
  gainXp(ga, Math.round(150 * Math.pow(3, 1.7)));            // level 4
  out.level = ga.level;
  out.cp4 = cpEarned();
  out.lockedBefore = !partUnlocked('c75');
  out.craftBefore = craft(home, 'c75');
  out.heavyBlocked = researchBlock(TECH_BY_ID.guns_heavy, home);
  const m0 = campaign.treasury;
  out.start = startResearch(gm, home);
  out.paid = Math.round(m0 - campaign.treasury);
  out.cpAfter = cpFree();
  out.busy = researchBlock(TECH_BY_ID.radio, home);
  for (let d = 0; d < TECH_TIERS[1].days; d++) { campaign.day++; dailyEconomy(); }
  out.known = techKnown('guns_medium');
  out.unlocked = partUnlocked('c75');
  out.craftAfter = craft(home, 'c75');
  const D = SCREENS.designer;
  const was = { lock: D.lockParts, st: D.st };
  D.st = { d: { w: 20, h: 10, cells: [] }, cls: 'light' };
  D.lockParts = true;
  out.designerLocked = D.placeCheck('c105', 0, 0);
  out.designerOk = D.placeCheck('c75', 0, 0);
  D.lockParts = was.lock; D.st = was.st;
  // The whole tree against the most CP a Grand Admiral can earn.
  out.treeCp = TECH.reduce((a, n) => a + nodeCp(n), 0);
  out.maxCp = CP_PER_LEVEL * 29;
  // Perks: Merchant charter lowers buy prices 8%; Wider command needs 3 CP.
  const b0 = buyPrice(home, 'metal', 'league');
  out.perk = buyPerk('merchant_charter');
  out.priceRatio = +(buyPrice(home, 'metal', 'league') / b0).toFixed(3);
  out.wider = buyPerk('wider_command');
  const flag = campaign.fleets.find((f) => f.faction === 'league' && f.admiralId === campaign.ga);
  out.gaCap = flag ? fleetCap(flag) : null;
  // Captain skill: a level 5 captain aims 8% better in battle.
  const ship = campaign.ships.find((s) => s.faction === 'league' && s.captainId);
  byId('officers', ship.captainId).level = 5;
  const V = { design: { _shipId: ship.id }, ai: { accuracy: 0.5, reaction: 1 } };
  applyCaptain(V);
  out.acc = +(V.ai.accuracy / 0.5).toFixed(3);
  out.react = +V.ai.reaction.toFixed(3);
  // A research job stops when its city is lost; the CP come back.
  const city = world.settlements.find((s) => s.faction === 'league' && s.type === 'city') || home;
  city.store.elec = 50;
  const free0 = cpFree();
  out.start2 = startResearch(TECH_BY_ID.radio, city);
  city.faction = 'directorate';
  campaign.day++; dailyEconomy();
  out.stopped = !techState().job && cpFree() === free0 && !techKnown('radio');
  city.faction = 'league';
  // Grand Admiral XP from a capture.
  const x0 = ga.xp;
  gaXpFor('capture', 'city');
  out.captureXp = ga.xp - x0;
  return out;
}
// Part 5b2: missiles as items: crafted at a metropolis, stocked, loaded, carried into battle.
function missileStockCheck() {
  newCampaign('league', 7272);
  const out = {};
  const home = world.settlements.find((s) => s.faction === 'league' && s.capital);
  const run = (h) => { for (let t = 0; t < h; t += 0.5) stepWorks(0.5); };
  out.city = craftMissiles(home, 'msl_s_heat', 4);
  home.type = 'metropolis';
  out.locked = craftMissiles(home, 'msl_s_heat', 4);
  techState().known.push('missiles');
  for (const g of GOODS) home.store[g] = 50;
  campaign.treasury += 5000;
  const q = missileQuote(home, missileDesign('msl_s_heat'), 4);
  const used0 = storeUsed(home);
  out.craft = craftMissiles(home, 'msl_s_heat', 4);
  run(q.hours + 1);
  out.made = missilesAt(home.store).msl_s_heat || 0;
  out.space = +(storeUsed(home) - used0 + (q.cost.metal || 0) + (q.cost.elec || 0)).toFixed(2);
  out.unitEach = +missileUnits('msl_s_heat').toFixed(2);
  // A ship with a rack, docked at home, loads them.
  const d = Object.assign(designFromTemplate('light'), { id: 'test_msl', missile: 'msl_s_heat' });
  d.cells.push({ p: 'rack', x: 0, y: 0 });
  save.designs.list.push(d);
  const fl = makeFleet('league', 'land', home.x + 0.5, home.y + 0.5, ['test_msl'], makeRng(3));
  fl.docked = home.id;
  const ship = fleetShips(fl)[0];
  out.before = shipMissiles(ship);
  out.load = loadMissiles(fl, home);
  out.after = shipMissiles(ship);
  out.stockAfter = missilesAt(home.store).msl_s_heat || 0;
  out.full = loadMissiles(fl, home);
  // Battle: only what she carries goes in; what she didn't fire comes home.
  const B = createBattle(4);
  const V = makeVehicle(battleDesign(ship), 0, 100, 1, B.T);
  applyShipState(V);
  const rack = V.weapons.find((w) => w.def.id === 'rack');
  out.inBattle = rack.rounds;
  const T = makeVehicle(designFromTemplate('light'), 1, 190, -1, B.T);
  B.units = [V, T];
  launchDesigned(B, V, rack, T);
  missiles.forEachAlive((m) => { m.alive = false; });
  out.left = missilesLeft(V);
  applyBattleOutcome({ units: [V], reserve: [[], []], result: 'win', sides: { myFleets: [], theirFleets: [] } });
  out.home = ship.missiles;
  // An empty ship takes in none.
  ship.missiles = { id: 'msl_s_heat', n: 0 };
  const V2 = makeVehicle(battleDesign(ship), 0, 100, 1, B.T);
  applyShipState(V2);
  out.emptyRounds = V2.weapons.find((w) => w.def.id === 'rack').rounds;
  // Missiles move between the warehouse and a hold with the parts.
  missilesAt(home.store).msl_s_heat = 2;
  const trucks = makeFleet('league', 'land', home.x + 0.5, home.y + 0.5, ['truck'], makeRng(2));
  trucks.docked = home.id;
  out.transfer = transferItems(trucks, home, 1);
  out.inHold = missilesAt(trucks.hold).msl_s_heat || 0;
  save.designs.list.splice(save.designs.list.indexOf(d), 1);
  return out;
}
// Part 5c2: drones and air-wing aircraft as items: made, stocked, loaded, carried, coming home.
function airStockCheck() {
  newCampaign('league', 8383);
  const out = {};
  const home = world.settlements.find((s) => s.faction === 'league' && s.capital);
  const run = (h) => { for (let t = 0; t < h; t += 0.5) stepWorks(0.5); };
  out.cityDrones = makeStock(home, 'drones', 'drn_gun', 4);
  techState().known = TECH.map((n) => n.id);
  out.cityWing = makeStock(home, 'wings', 'fighter', 1);
  home.type = 'metropolis';
  for (const g of GOODS) home.store[g] = 300;
  campaign.treasury += 20000;
  out.drones = makeStock(home, 'drones', 'drn_gun', 4);
  const hq = stockQuote(home, 'drones', droneDesign('drn_gun'), 4).hours + stockQuote(home, 'wings', wingDesignOf('fighter'), 1).hours;
  run(hq + 2);
  out.made = { drones: stockAt(home.store, 'drones').drn_gun || 0, wings: stockAt(home.store, 'wings').fighter || 0 };
  // A drone truck and an escort carrier, docked at home, load them.
  const land = makeFleet('league', 'land', home.x + 0.5, home.y + 0.5, ['drone_truck'], makeRng(3));
  const sea = makeFleet('league', 'sea', home.x + 0.5, home.y + 0.5, ['carrier_t3'], makeRng(4));
  land.docked = sea.docked = home.id;
  const truck = fleetShips(land)[0], carrier = fleetShips(sea)[0];
  out.loadD = loadStock(land, home, 'drones');
  out.loadW = loadStock(sea, home, 'wings');
  out.carried = { drones: shipStock(truck, 'drones'), wing: shipStock(carrier, 'wings') };
  // Battle: they start with what they carry; flying ones that survive come home.
  const B = createBattle(4);
  const V = makeVehicle(battleDesign(truck), 0, 100, 1, B.T);
  applyShipState(V);
  const C = makeVehicle(battleDesign(carrier), 0, 60, 1, B.T);
  applyShipState(C);
  out.inBattle = { drones: V.dronesAboard, wing: C.wingAboard };
  B.units = [V, C];
  launchDrone(B, V); launchDrone(B, V);
  B.drones[0].alive = false;                  // one shot down
  launchWing(B, C);
  out.home = { drones: dronesHome(B, V), wing: wingsHome(B, C) };
  Object.assign(B, { result: 'win', reserve: [[], []], sides: { myFleets: [], theirFleets: [] } });
  applyBattleOutcome(B);
  out.after = { drones: truck.drones, wing: carrier.air };
  // An empty carrier takes none in.
  truck.drones = { id: 'drn_gun', n: 0 };
  const V2 = makeVehicle(battleDesign(truck), 0, 100, 1, B.T);
  applyShipState(V2);
  out.empty = V2.dronesAboard;
  out.space = +stockUnits('wings', 'fighter').toFixed(1);
  return out;
}
// Part 6a: thirty days of the AI factions on their own (your fleets stay out of it).
// Faction signature parts (design/09): own faction once the family is researched, others only by
// reverse-engineering that part.
function factionPartCheck() {
  const out = {};
  newCampaign('lumen', 4242);
  out.lumenBefore = partUnlocked('laser_prism');
  techState().known.push('lasers');
  out.lumenAfter = partUnlocked('laser_prism') && partUnlocked('cap_spine');
  newCampaign('league', 4242);
  techState().known.push('lasers');
  out.leagueLaser = partUnlocked('laser_prism');
  out.leagueHoldBefore = partUnlocked('hold_convoy');
  techState().known.push(PART_LIBRARY.parts.hold.unlock.tech);
  out.leagueHold = partUnlocked('hold_convoy');
  out.leagueBoiler = partUnlocked('steam_foundry');
  out.study = studyTarget('laser_prism');
  campaign.unlocked.push('laser_prism');
  out.leagueStudied = partUnlocked('laser_prism');
  return out;
}
// AI designs that evolve (6b): a heavily armoured, air-heavy player; the Directorate refits.
function evolveCheck() {
  newCampaign('league', 5151);
  const out = {};
  const armoured = designFromTemplate('light');
  armoured.cells.forEach((c) => { if (PARTS[c.p].cat === 'structure') c.p = 'arm40'; });
  out.traits = designTraits(armoured);
  noteFielded([armoured, armoured, armoured, designFromTemplate('gunship_t0'), designFromTemplate('gunship_t0')]);
  out.seen = Math.round(intelState().n);
  campaign.day = 28;                                        // tier 2
  const news = [];
  aiReview('directorate', news);
  const st = aiState('directorate');
  out.counters = st.counters.slice();
  out.refits = Object.keys(st.refit).length;
  out.news = news[0] || '';
  const pen = (d) => Math.max(0, ...d.cells.map((c) => (PARTS[c.p].cat === 'weapon' && !PARTS[c.p].auto ? PARTS[c.p].pen || 0 : 0)));
  const pairs = Object.entries(st.refit).map(([b, r]) => ({ b, r, base: designFromTemplate(b), d: campaign.aiDesigns[r] }));
  out.penUp = pairs.filter((p) => pen(p.d) > pen(p.base)).map((p) => p.b);
  out.aaAdded = pairs.filter((p) => p.d.cells.some((c) => PARTS[c.p].aa) && !p.base.cells.some((c) => PARTS[c.p].aa)).map((p) => p.b);
  out.valid = pairs.every((p) => validateDesign(p.d).ok);
  out.names = pairs.map((p) => p.d.name).slice(0, 3);
  // It builds the refit.
  const pick = pairs[0];
  st.money = 1e6; st.next = { dom: mapDomain(domainOf(pick.base)), id: pick.b };
  const n0 = campaign.ships.length;
  aiBuild('directorate', aiRng(1));
  const ship = campaign.ships[n0];
  out.builtRefit = !!ship && ship.design === pick.r && shipDesign(ship).cells.length === pick.d.cells.length && shipStats(ship).cost > 0;
  // The threat fades: counters are dropped at the next review.
  for (let d = 0; d < 60; d++) intelDay();
  noteFielded([designFromTemplate('gunboat'), designFromTemplate('gunboat'), designFromTemplate('gunboat'), designFromTemplate('gunboat')]);
  aiReview('directorate', []);
  out.later = st.counters.slice();
  return out;
}
// Relations (6c): reputation, truces, war, charters, AI truces.
function relationsCheck() {
  newCampaign('league', 6161);
  const out = {};
  const others = FACTIONS.map((F) => F.id).filter((f) => f !== 'league');
  const war = others.filter((f) => relation(f, 'league') === 'war'), truce = others.filter((f) => relation(f, 'league') === 'truce');
  out.start = { war: war.map(repOf), truce: truce.map(repOf) };
  campaign.treasury = 5000;
  const a = war[0], b = war[1];
  out.tribute = truceTribute(a);
  out.offer = proposeTruce(a);
  out.afterOffer = { rel: relation(a, 'league'), money: campaign.treasury, rep: repOf(a) };
  // A battle won against b: reputation falls; b won't talk for a few days.
  const fb = campaign.fleets.find((fl) => fl.faction === b && fl.shipIds.length);
  relationsAfterBattle([fb], true);
  out.battle = { rep: repOf(b), block: truceBlock(b) };
  // You take one of b's settlements.
  const sb = settlementsOf(b).find((s) => !s.capital);
  const r0 = repOf(b);
  captureSettlement(sb, 'league');
  out.capture = repOf(b) - r0;
  // A charter: a docked fleet at a neutral village.
  const vs = world.settlements.filter((s) => !s.faction && s.type === 'village');
  const v = vs.find((s) => charterFactions(s).length) || vs[0];
  const fl = playerFleets()[0];
  out.charterNoFleet = charterBlock(v);
  fl.docked = v.id;
  const near = charterFactions(v), before = near.map(repOf), m0 = campaign.treasury;
  out.charter = buyCharter(v);
  out.charterOwner = v.faction;
  out.charterRep = near.map((f, i) => repOf(f) - before[i]);
  out.charterPaid = m0 - campaign.treasury;
  // In truce: they break it when reputation falls too far; at war: they offer one when it's high.
  const t = truce[0];
  campaign.rep[t] = -60;
  campaign.rep[b] = 45;
  const news = [];
  relationsDay(news);
  out.broke = relation(t, 'league');
  out.offered = relation(b, 'league');
  out.news = news.length;
  // Declare war on a truce partner.
  out.declare = declareWar(a);
  out.declared = { rel: relation(a, 'league'), rep: repOf(a) };
  // AI factions among themselves over 200 days.
  const j0 = campaign.journal.length;
  for (let d = 1; d <= 200; d++) { campaign.day = d; relationsDay([]); }
  out.aiChanges = campaign.journal.slice(j0).filter((m) => /made a truce|are at war/.test(m)).length;
  out.drift = repOf(b);
  return out;
}
// Starting fleets (v0.6.4): each has a support vehicle with fuel in its hold that doesn't count
// towards the fleet size; base designs and recruits' ships use researched parts only; ships
// have their hull bunkers and cruise economically.
function startFleetCheck() {
  newCampaign('league', 7171);
  const out = { fleets: playerFleets().map((fl) => ({ domain: fl.domain, ships: fl.shipIds.length, count: fleetCount(fl), cap: fleetCap(fl), fuel: fl.hold.fuel, support: fleetShips(fl).filter(isSupport).map((s) => s.design) })) };
  out.valid = Object.values(START_SUPPORT).every((id) => validateDesign(designFromTemplate(id)).ok && designResearched(designFromTemplate(id)));
  out.base = campaignBaseDesigns();
  out.baseOk = out.base.every((id) => designResearched(designFromTemplate(id))) && !out.base.includes('medium');
  // The support vehicles in battle: the wagon drives, the tender floats, the airship flies.
  const run = (id, field) => {
    const B = createBattle(0, { squad: [designFromTemplate(id)], cfg: simulatorConfig({ field, weather: 'clear', light: 'day', seed: 77 }), reserves: true, enemyForce: [] });
    const V = B.me, x0 = V.body.x;
    V.throttle = 1;
    for (let t = 0; t < 15; t += SIM_STEP) { V.throttle = 1; updateBattle(B, SIM_STEP); }
    return { moved: Math.round(Math.abs(V.body.x - x0)), up: Math.round(V.body.y - Math.max(B.T.height(V.body.x), B.T.sea || -1e9)), ok: !V.destroyed };
  };
  out.wagon = run('supply_wagon', 'inland');
  out.tender = run('fuel_tender', 'sea');
  out.airship = run('supply_airship', 'inland');
  const sea = playerFleets().find((fl) => fl.domain === 'sea');
  out.seaRange = sea ? Math.round(fleetFuel(sea).fuel / fleetBurn(sea) * fleetSpeed(sea) / WORLD_KM) : 0;
  return out;
}
// Flagships (v0.6.5): the admiral's ship goes first, is the one you drive, flies a pennant;
// when it's lost the admiral moves to another ship (the Grand Admiral at a cost).
// Officers (v0.6.5): levelling by hand with an upgrade; captains' upgrades in battle; admirals'
// doctrines (combined arms, size, march, fuel); recruits with upgrades; upgrades owed.
// The war record (6d): battles counted, medals, the gallery, winning and losing.
// The new faction art at work (v0.6.8): materials for their own faction, patchwork varying
// cell by cell, sail vanes in wind and storm, the magnet crane's salvage, faction designs used.
function factionArtCheck() {
  const out = {};
  newCampaign('league', 4141);
  out.mat = { clipper: partUnlocked('clipper'), slab: partUnlocked('slab'), patchwork: partUnlocked('patchwork'), plate: partUnlocked('plate') };
  // Patchwork: armour differs between cells.
  const pd = designFromTemplate('clans_tank_t2');
  const V = makeVehicle(pd, 0, 50, 1, makeTerrain(simulatorConfig({ field: 'inland', weather: 'clear', light: 'day', seed: 1 })));
  out.patch = [...new Set(V.parts.filter((p) => p.def.id === 'patchwork').map((p) => p.def.armor))].sort((a, b) => a - b);
  // Sail vanes: an airship with its propellers taken off still validates and moves on the wind,
  // with no fuel; in rain the vanes wear out.
  // (The Skyreach gunship with its air propeller swapped for a vane.)
  const sd = designFromTemplate('skyreach_gunship_t1');
  const bare = Object.assign({}, sd, { cells: sd.cells.filter((c) => c.p !== 'aprop').concat([{ p: 'sail_vane', x: 0, y: 5 }]) });
  out.sails = bare.cells.filter((c) => c.p === 'sail_vane').length;
  out.noProp = validateDesign(Object.assign({}, sd, { cells: sd.cells.filter((c) => c.p !== 'aprop') })).ok;
  out.bareValid = validateDesign(bare).ok;
  const fly = (weather) => {
    const B = createBattle(0, { squad: [bare], cfg: simulatorConfig({ field: 'inland', weather, light: 'day', seed: 77 }), reserves: true, enemyForce: [] });
    const A = B.me, x0 = A.body.x;
    A.fuel = 0;
    for (let t = 0; t < 40; t += SIM_STEP) { A.moveCmd = 1; updateBattle(B, SIM_STEP); }
    return { moved: Math.round(A.body.x - x0), vanes: A.parts.filter((p) => p.alive && p.def.sail).length };
  };
  out.clear = fly('clear');
  out.rain = fly('rain');
  // Magnet crane: salvage rates with one against a plain crane.
  const mk = (id) => ({ design: id });
  const fakeShip = (cells) => { const d = { id: 'x', name: 'x', w: 4, h: 2, cells }; campaign.aiDesigns = campaign.aiDesigns || {}; campaign.aiDesigns['_t' + cells[0].p] = d; return { design: '_t' + cells[0].p }; };
  const rc = salvageRates([fakeShip([{ p: 'crane', x: 0, y: 0 }])]), rm = salvageRates([fakeShip([{ p: 'magnet_crane', x: 0, y: 0 }])]);
  out.magnet = +(rm.part / rc.part).toFixed(2);
  // Faction designs in the AI's pool and the Drafting Office.
  out.aiPool = aiDesignPool('directorate').filter((id) => /_t[12]$/.test(id) && id.startsWith('directorate'));
  out.baseStart = campaignBaseDesigns().filter((id) => /^league_.*_t[12]$/.test(id)).length;
  techState().known.push(...TECH.map((n) => n.id));
  out.baseAll = campaignBaseDesigns().filter((id) => /^league_.*_t[12]$/.test(id)).length;
  return out;
}
// AI missiles and airfields (5b3/5c3, v0.7.0).
// Stuck without a fleet (v0.7.2): the Grand Admiral forms one from a garrison; an admiral can be
// appointed anywhere you own; hints say what can be done.
function garrisonCheck() {
  newCampaign('league', 6363);
  const out = {};
  const land = playerFleets().find((fl) => fl.domain === 'land');
  const home = world.settlements.find((s) => s.faction === 'league' && s.capital);
  // The flag fleet's tanks go to the garrison, then the fleet is lost: the Grand Admiral waits there.
  land.docked = home.id;
  for (const sh of fleetShips(land).slice()) { if (flagshipOf(land) === sh) continue; detachShip(land, sh); }
  const flag = flagshipOf(land);
  land.flagshipId = null; land.admiralId = null;
  detachShip(land, flag);
  fleetLost(land);
  const ga = grandAdmiral();
  out.gaHere = ga.garrisonedAt;
  out.garrison = campaign.ships.filter((sh) => sh.garrison === ga.garrisonedAt).length;
  const s = byId('settlements', ga.garrisonedAt);
  out.commanders = commandersAt(s).map((o) => o.rank);
  out.hintsNoFleet = campaignHints().some((h) => /Garrison/.test(h) || /garrison/.test(h));
  out.form = formFleet(s, ga, 'land');
  const nf = playerFleets().find((fl) => fl.admiralId === ga.id);
  out.formed = nf ? { name: nf.name, ships: nf.shipIds.length } : null;
  // Appointing an admiral elsewhere.
  const other = world.settlements.find((q) => q.faction === 'league' && q !== s);
  const m0 = campaign.treasury;
  out.appoint = appointAdmiral(other);
  out.paid = Math.round(m0 - campaign.treasury);
  out.appointed = commandersAt(other).length;
  out.hints = campaignHints().length;
  return out;
}
function airPowerCheck() {
  const out = {};
  // AI factions at tech tier 3 refit with missile racks.
  newCampaign('league', 5252);
  campaign.day = 42;
  const news = [];
  aiReview('directorate', news);
  const st = aiState('directorate');
  const racked = Object.values(st.refit).map((id) => campaign.aiDesigns[id]).filter((d) => d.cells.some((c) => c.p === 'rack'));
  out.racks = { designs: racked.length, missile: racked.length ? racked[0].missile : null, news: news.some((m) => /missile racks/.test(m)), valid: racked.every((d) => validateDesign(d).ok) };
  if (racked.length) {
    const B = createBattle(0, { squad: [designFromTemplate('light')], cfg: simulatorConfig({ field: 'inland', weather: 'clear', light: 'day', seed: 77 }), reserves: true, enemyForce: [JSON.parse(JSON.stringify(racked[0]))] });
    const E = B.units.find((u) => u.side === 1) || null;
    const w = E && E.weapons.find((x) => x.def.id === 'rack');
    out.racks.loaded = w ? { msl: w.msl && w.msl.id, rounds: w.rounds } : null;
  }
  // Your airfield: fighters from a city's warehouse join a battle near it; survivors return.
  newCampaign('league', 5253);
  const land = playerFleets().find((fl) => fl.domain === 'land');
  const city = world.settlements.find((s) => s.faction === 'league' && AIRFIELD.types.includes(s.type));
  stockAt(city.store, 'wings').fighter = 2;
  const en = campaign.fleets.find((fl) => fl.faction !== 'league' && fl.domain === 'land' && relation(fl.faction, 'league') === 'war');
  land.x = city.x + 0.5; land.y = city.y + 0.5; en.x = land.x + 1; en.y = land.y;
  const B = createCampaignBattle({ mine: land.id, theirs: en.id }, true);
  out.mine = { fields: (B.airfields || []).filter((a) => a.side === 0).map((a) => ({ n: a.wingCap, id: a.wingId })), stockLeft: stockAt(city.store, 'wings').fighter || 0 };
  for (let t = 0; t < 30; t += SIM_STEP) updateBattle(B, SIM_STEP);
  out.mine.launched = B.stats.wings || 0;
  out.mine.flying = B.units.filter((u) => u.wing && u.wing.airfield && !u.destroyed).length;
  const note = airfieldsAfterBattle(B);
  out.mine.back = stockAt(city.store, 'wings').fighter || 0;
  out.mine.note = /Air support from/.test(note);
  // An AI airfield at tech tier 2 sends fighters into a battle next to its city.
  newCampaign('league', 5254);
  campaign.day = 30;
  const foe = world.settlements.find((s) => s.faction && s.faction !== 'league' && relation(s.faction, 'league') === 'war' && AIRFIELD.types.includes(s.type));
  const l2 = playerFleets().find((fl) => fl.domain === 'land');
  const e2 = campaign.fleets.find((fl) => fl.faction === foe.faction && fl.shipIds.length && !fl.aiConvoy);
  l2.x = foe.x + 0.5; l2.y = foe.y + 0.5; e2.x = l2.x + 0.5; e2.y = l2.y;
  const B2 = createCampaignBattle({ mine: l2.id, theirs: e2.id }, true);
  out.ai = (B2.airfields || []).filter((a) => a.side === 1).map((a) => a.wingCap);
  return out;
}
function warCheck() {
  newCampaign('league', 3131);
  const out = {};
  const p = save.profile, cap0 = p.captured.length, won0 = p.campaigns.won, lost0 = p.campaigns.lost;
  out.capitals = world.settlements.filter((s) => s.capital).every((s) => s.capitalOf === s.faction);
  // A battle: counted, enemy designs to the gallery.
  const land = playerFleets().find((fl) => fl.domain === 'land');
  const en = campaign.fleets.find((fl) => fl.faction !== 'league' && fl.domain === 'land' && relation(fl.faction, 'league') === 'war');
  en.x = land.x + 1; en.y = land.y;
  const res = autoResolve(land, en);
  const st = warStats();
  out.battle = { counted: st.won + st.lost === 1, destroyed: st.destroyed === res.lostTheirs, gallery: p.captured.length - cap0 >= (res.lostTheirs ? 1 : 0) };
  // Medals.
  st.won = Math.max(st.won, 1);
  const news = [];
  awardMedals(news);
  out.medal = (campaign.medals || []).includes('c_first') && campaign.journal.some((j) => /Medal: First victory/.test(j));
  awardMedals(news);
  out.once = campaign.journal.filter((j) => /Medal: First victory/.test(j)).length === 1;
  // Not over yet; 60% of settlements wins.
  out.notYet = checkWarEnd([]) === null;
  const v = victoryProgress();
  const others = world.settlements.filter((s) => s.faction !== 'league' && !s.capital);
  for (const s of others.slice(0, Math.max(0, v.need - v.held))) s.faction = 'league';
  out.share = checkWarEnd([]);
  out.shareWin = !!out.share && out.share.result === 'win' && /settlements held/.test(out.share.how) && !campaign.running && p.campaigns.won === won0 + 1;
  // Every rival capital wins.
  newCampaign('league', 3132);
  for (const s of rivalCapitals()) s.faction = 'league';
  const c = checkWarEnd([]);
  out.capitalWin = !!c && c.result === 'win' && /capital/.test(c.how);
  // No settlements and no fleets loses.
  newCampaign('league', 3133);
  for (const s of world.settlements) if (s.faction === 'league') s.faction = null;
  for (const fl of playerFleets()) fl.shipIds = [];
  const l = checkWarEnd([]);
  out.lose = !!l && l.result === 'lost' && p.campaigns.lost === lost0 + 1;
  // Reverse-engineered parts.
  galleryPart('c105');
  out.studied = p.studied.includes('c105');
  return out;
}
function officersCheck() {
  newCampaign('league', 9292);
  const out = {};
  const land = playerFleets().find((fl) => fl.domain === 'land'), air = playerFleets().find((fl) => fl.domain === 'air');
  const sh = fleetShips(land).find((s) => byId('officers', s.captainId)), cap = byId('officers', sh.captainId);
  gainXp(cap, 150);
  out.auto = cap.level;                                   // stays 1 until levelled by hand
  out.can = canLevelUp(cap);
  out.noPick = levelUp(cap, null);
  out.up = levelUp(cap, 'loaders');
  out.after = { level: cap.level, traits: cap.traits.slice(), can: canLevelUp(cap) };
  // In battle: faster reload for that ship.
  const en = campaign.fleets.find((fl) => fl.faction !== 'league' && fl.domain === 'land' && relation(fl.faction, 'league') === 'war');
  const B = createCampaignBattle({ mine: land.id, theirs: en.id }, true);
  const V = B.units.find((u) => u.design._shipId === sh.id);
  out.reload = V ? +(V.reloadRate || 1).toFixed(2) : 'reserve';
  // The Grand Admiral's doctrine: combined arms land and air.
  const ga = grandAdmiral();
  gainXp(ga, Math.round(150 * Math.pow(3, 1.7)) + 1);    // level 4: command level 2
  out.gaOwed = picksOwed(ga);
  const cap0 = fleetCap(land), sp0 = fleetSpeed(land), b0 = fleetBurn(land);
  out.mixBefore = pickUp(land, fleetShips(air).find((s) => !isSupport(s) && s !== flagshipOf(air)));
  out.take = takeTrait(ga, 'land_air');
  const gs = fleetShips(air).find((s) => !isSupport(s) && s !== flagshipOf(air));
  air.shipIds = air.shipIds.filter((id) => id !== gs.id);
  out.mix = pickUp(land, gs);
  out.mixed = fleetShips(land).some((s) => shipStats(s).domain === 'air');
  const place = world.settlements.find((q) => !q.coastal && battlePlace(q.x, q.y).field === 'inland');
  const was = [land.x, land.y, en.x, en.y];
  land.x = place.x + 0.5; land.y = place.y + 0.5; en.x = land.x + 0.5; en.y = land.y;
  out.deploys = battleSides(land, en).mine.some((s) => s === gs);
  [land.x, land.y, en.x, en.y] = was;
  // Doctrines that change numbers (a level-3 admiral given three by hand).
  ga.traits.push('wide', 'march', 'logistics');
  out.doctrine = { cap: fleetCap(land) - cap0, speed: +(fleetSpeed(land) / sp0).toFixed(2), burnDrop: fleetBurn(land) < b0 * 1.5 };
  // Recruits bring upgrades.
  const fort = world.settlements.find((q) => q.faction === 'league' && q.type === 'fort');
  makeOffers(fort);
  out.recruits = fort.offers.filter((o) => o.kind !== 'quartermaster').map((o) => ({ kind: o.kind, level: o.level, traits: o.traits.length }));
  out.recruitsOk = fort.offers.every((o) => o.traits.length >= o.level - 1 && o.traits.length <= o.level);
  // An officer from an older save: level 3, no upgrades → 2 owed.
  const old = { rank: 'captain', level: 3, xp: 300 };
  out.oldOwed = picksOwed(old);
  return out;
}
function flagshipCheck() {
  newCampaign('league', 8181);
  const out = {};
  const land = playerFleets().find((fl) => fl.domain === 'land');
  const f = flagshipOf(land);
  out.flag = { id: f && f.design, support: isSupport(f), first: battleOrder(land)[0] === f, lastSupport: isSupport(battleOrder(land).slice(-1)[0]) };
  out.supportFlag = setFlagship(land, fleetShips(land).find(isSupport));
  out.detach = detachShip(land, f);
  // In battle: the flagship is the vehicle you drive, with the admiral's pennant.
  const en = campaign.fleets.find((fl) => fl.faction !== 'league' && fl.domain === 'land' && relation(fl.faction, 'league') === 'war');
  en.x = land.x + 1; en.y = land.y;
  const B = createCampaignBattle({ mine: land.id, theirs: en.id }, true);
  out.battle = { me: B.me.design._shipId === f.id, pennant: !!B.me.flagship && B.me.flagship.grand, enemyFlag: B.units.some((V) => V.side === 1 && V.flagship) || B.reserve[1].some((e) => e.design._flag) };
  // The flagship is lost; the Grand Admiral escapes to another ship.
  const other = fleetShips(land).find((s) => s !== f && !isSupport(s));
  const t0 = campaign.treasury, ga = grandAdmiral();
  ga.xp = 100;
  const before = [[land, land.flagshipId]];
  removeShip(f, makeRng(1));
  const news = [];
  flagshipsAfterBattle(before, news);
  out.lost = { newFlag: flagshipOf(land) === other, money: +(campaign.treasury / t0).toFixed(2), xp: Math.round(ga.xp), news: news.length };
  // Move the flag by hand.
  const third = fleetShips(land).find((s) => s !== other && !isSupport(s));
  out.move = third ? setFlagship(land, third) === '' && flagshipOf(land) === third : null;
  return out;
}
function aiCheck(days = 30, as = 'league') {
  newCampaign(as, 9191);
  const t0 = performance.now();
  const ids = aiFactionIds();
  const snap = () => Object.fromEntries(ids.map((f) => [f, { settlements: settlementsOf(f).length, ships: campaign.ships.filter((s) => s.faction === f).length }]));
  const before = snap();
  const neutral0 = world.settlements.filter((s) => !s.faction).length;
  let messages = 0;
  for (let d = 0; d < days; d++) {
    for (const fl of playerFleets()) fl.cooldown = 1e9;         // no contacts with you
    campaign.running = true;
    messages += campaignTick(24).filter((e) => e.msg).length;
  }
  const after = snap();
  const convoys = campaign.fleets.filter((f) => f.aiConvoy);
  const built = Object.fromEntries(ids.map((f) => [f, aiState(f).built]));
  const dom = (f) => { const c = { land: 0, sea: 0, air: 0 }; for (const s of campaign.ships) if (s.faction === f && !(s.fleetId && byId('fleets', s.fleetId) && byId('fleets', s.fleetId).aiConvoy)) { const d = domainOf(shipDesign(s)); c[airDomain(d) ? 'air' : seaDomain(d) ? 'sea' : 'land']++; } return c; };
  return {
    day: campaign.day, ms: Math.round(performance.now() - t0), before, after, built,
    money: Object.fromEntries(ids.map((f) => [f, Math.round(aiState(f).money)])),
    tiers: Object.fromEntries(ids.map((f) => [f, aiState(f).tier])),
    neutral: { before: neutral0, after: world.settlements.filter((s) => !s.faction).length },
    bought: aiState('league') ? aiState('league').bought : 0,
    clashes: campaign.aiClashes || 0,
    convoys: { count: convoys.length, trips: convoys.reduce((a, f) => a + (f.aiConvoy.trips || 0), 0) },
    leagueDomains: campaign.faction === 'league' ? null : dom('league'),
    leagueFleets: campaign.faction === 'league' ? null : fleetsOf('league').filter((f) => !f.aiConvoy).map((f) => f.domain),
    directorateDomains: dom('directorate'), skyreachDomains: dom('skyreach'),
    builtDomains: Object.fromEntries(ids.map((f) => [f, aiState(f).byDomain])),
    messages,
  };
}
/*TEST:END*/
