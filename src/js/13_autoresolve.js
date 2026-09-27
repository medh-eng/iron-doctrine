/* ==== 13 AUTO-RESOLVE ==== */
// Campaign battles (design/01 §10): the battlefield from the map location and weather, who can
// deploy, the line-ups, and writing the results back to the map (damage, losses, captain
// survival, XP, bounties). Auto-resolve runs the same battle rules headless and silent.

const AUTO_SECS = 240;            // an auto-resolved battle runs at most this long
const CAPTAIN_SURVIVES = 0.5;     // chance a captain survives the loss of their ship
const BOUNTY = 0.05;              // money per destroyed enemy ship: 5% of its cost index (08 §6)

// Where a battle at a map point is fought: open sea, coast or inland; the weather; the light.
function battlePlace(x, y) {
  let sea = 0, land = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) (isSeaCell(world, x + dx, y + dy) ? sea++ : land++);
  const field = !land ? 'sea' : !sea ? 'inland' : 'coast';
  const w = weatherAt(x, y);
  const h = campaign.hour;
  const light = h >= 20 || h < 5 ? 'night' : h >= 18 || h < 7 ? 'dusk' : 'day';
  return { field, weather: w === 'clear' ? 'clear' : 'rain', weatherName: w, light, biome: terrainId(world, x, y) };
}

const DEPLOY = { inland: ['land', 'air'], sea: ['sea', 'air'], coast: ['land', 'sea', 'air'] };

// Both sides' ships: every fleet within reinforcement range joins (01 §10.2); ships of domains
// that can't fight here stay out.
function battleSides(mine, theirs) {
  const place = battlePlace(mine.x, mine.y);
  const ok = DEPLOY[place.field];
  const near = (fl, at) => fl.shipIds.length && Math.hypot(fl.x - at.x, fl.y - at.y) <= REINFORCE_CELLS;
  const myFleets = [mine, ...playerFleets().filter((fl) => fl !== mine && near(fl, mine))];
  const theirFleets = [theirs, ...campaign.fleets.filter((fl) => fl !== theirs && fl.faction !== campaign.faction && relation(fl.faction, campaign.faction) === 'war' && near(fl, theirs))];
  const ships = (fleets) => fleets.filter((fl) => ok.includes(fl.domain)).flatMap((fl) => fleetShips(fl));
  return { place, myFleets, theirFleets, mine: ships(myFleets), theirs: ships(theirFleets) };
}

function campaignBattleConfig(place) {
  const c = simulatorConfig({ field: place.field, weather: place.weather, light: place.light, seed: (campaign.seed + campaign.day * 97 + Math.floor(campaign.hour) * 13) >>> 0 });
  c.name = `${SIM_FIELDS[place.field]} · ${MAP_TERRAIN[place.biome] ? MAP_TERRAIN[place.biome].name : ''} · ${place.weatherName}`;
  if (place.biome === 'forest') c.forest = 4;
  if (place.biome === 'hills' || place.biome === 'pass') c.hills = 0.8;
  if (place.biome === 'marsh') c.mud = 4;
  c.how = 'Three ships a side on the field; the rest wait in reserve. Long-press a ship or its card for orders.';
  return c;
}

// A ship's design for battle, carrying its damage, fuel and ammo.
function battleDesign(ship) {
  const d = shipDesign(ship);
  d._shipId = ship.id;
  d.paint = d.paint || { scheme: ship.faction };            // each faction's own colours (09)
  d._state = {
    hp: ship.hp ? ship.hp.map((f, i) => f * PARTS[d.cells[i].p].hp) : null,
    fuel: ship.fuel / Math.max(0.01, shipStats(ship).fuelCap),
    ammo: ship.ammo,
  };
  return d;
}

// Apply a design's carried state to a vehicle made from it (the campaign's persistent damage).
function applyShipState(V) {
  const s = V.design._state;
  if (!s) return;
  if (s.hp) {
    let lost = false;
    V.parts.forEach((p, i) => { if (s.hp[i] <= 0) { p.alive = false; V.alive[i] = 0; lost = true; } else p.hp = Math.min(p.def.hp, s.hp[i]); });
    if (lost) rebuildVehicle(V);
  }
  if (V.fuelMax) V.fuel = V.fuelMax * clamp(s.fuel, 0, 1);
  if (V.shellsMax) V.shells = Math.round(V.shellsMax * clamp(s.ammo, 0, 1));
}

function createCampaignBattle(contact, headless) {
  if (contact.siege) return createSiegeBattle(contact, headless);
  const mine = byId('fleets', contact.mine), theirs = byId('fleets', contact.theirs);
  const sides = battleSides(mine, theirs);
  const B = createBattle(0, {
    cfg: campaignBattleConfig(sides.place), reserves: true, demo: !!headless,
    squad: sides.mine.map(battleDesign), enemyForce: sides.theirs.map(battleDesign),
  });
  for (const V of B.units) { applyShipState(V); crewBonus(V); }
  B.rotationMul = hasPerk('rotation') ? 0.6 : 1;
  B.contact = contact;
  B.sides = sides;
  return B;
}

// Run a battle headless and silent (01 §10.1 Auto-resolve), then write the results back.
function autoResolve(mine, theirs) {
  const quiet = audio.quiet;
  audio.quiet = true;
  const B = createCampaignBattle({ mine: mine.id, theirs: theirs.id }, true);
  for (let t = 0; t < AUTO_SECS && !B.result; t += SIM_STEP) updateBattle(B, SIM_STEP);
  audio.quiet = quiet;
  for (const pool of [shells, torpedoes, charges, missiles, salvos, particles, debris, smokeScreens, smokeColumns, floaters, confetti]) pool.forEachAlive((p) => { p.alive = false; });
  if (!B.result) {
    // Undecided when time runs out: the side with more of its strength left holds the field.
    const left = (side) => B.units.filter((V) => V.side === side && !V.destroyed).reduce((a, V) => a + vehicleHealth(V), 0) + B.reserve[side].length;
    B.result = left(0) >= left(1) ? 'win' : 'lost';
  }
  return applyBattleOutcome(B);
}

// Write a battle back to the campaign.
function applyBattleOutcome(B) {
  const win = B.result === 'win';
  const rng = makeRng((campaign.seed ^ (campaign.day * 7919 + Math.floor(campaign.hour * 60))) >>> 0);
  const rec = new Map();
  for (const V of B.units) if (V.design._shipId) rec.set(V.design._shipId, { lost: V.destroyed && !V.withdrawn, hp: V.parts.map((p) => (p.alive ? p.hp : 0)), fuel: V.fuelMax ? V.fuel / V.fuelMax : null, ammo: V.shellsMax ? V.shells / V.shellsMax : null });
  for (const side of [0, 1]) for (const e of B.reserve[side]) if (e.design._shipId && (!rec.has(e.design._shipId) || !rec.get(e.design._shipId).lost)) {
    if (e.hp) rec.set(e.design._shipId, { lost: false, hp: e.hp, fuel: null, ammo: null });
  }
  let lostMine = 0, lostTheirs = 0, bounty = 0, gaXp = 0;
  const wrecks = [];
  for (const [id, r] of rec) {
    const ship = byId('ships', id);
    if (!ship) continue;
    const d = shipDesign(ship);
    const cap = byId('officers', ship.captainId);
    const st = shipStats(ship);
    ship.battles++;
    if (r.lost) {
      wrecks.push({ design: d, own: ship.faction === campaign.faction });
      if (ship.faction === campaign.faction) lostMine++;
      else { lostTheirs++; bounty += st.cost * BOUNTY; const cls = classById(st.cls); gaXp += 40 * Math.pow(2, cls ? [1, 3, 5, 8].indexOf(cls.captain) : 0); }
      removeShip(ship, rng);
      continue;
    }
    ship.hp = r.hp.map((hp, i) => hp / PARTS[d.cells[i].p].hp);
    if (r.fuel !== null) ship.fuel = st.fuelCap * r.fuel;
    if (r.ammo !== null) ship.ammo = r.ammo;
    if (cap && cap.faction === campaign.faction) gainXp(cap, 20 + 30 + (win ? 20 : 0));
  }
  if (!win) gaXp /= 2;
  const ga = byId('officers', campaign.ga);
  if (ga) gainXp(ga, gaXp);
  campaign.treasury += win ? bounty : 0;
  // Fleets that fought: emptied ones are gone; the losing side falls back; nobody meets again at once.
  const sides = B.sides;
  for (const fl of [...sides.myFleets, ...sides.theirFleets]) {
    fl.cooldown = CONTACT_COOLDOWN;
    if (!fl.shipIds.length) { fleetLost(fl); continue; }
    const losing = (fl.faction === campaign.faction) !== win;
    if (losing) fallBack(fl, fl.faction === campaign.faction ? sides.theirFleets[0] : sides.myFleets[0]);
  }
  // Salvage (08 §9): the winner holds the field; what doesn't fit in the holds stays for a day.
  let salvage = '';
  const winners = sides.myFleets.filter((fl) => fl.shipIds.length);
  if (win && wrecks.length && winners.length) {
    const got = takeSalvage(salvageFrom(wrecks, winners.flatMap(fleetShips), rng), winners, winners[0].x, winners[0].y);
    salvage = ` Salvage: scrap ${got.scrap.toFixed(1)}, parts ${got.items}${got.leftScrap > 0.05 || got.leftItems ? ` (left on the field: scrap ${got.leftScrap.toFixed(1)}, parts ${got.leftItems})` : ''}.`;
  }
  const siegeNote = B.siege ? applySiege(B, win) : '';
  const summary = `${win ? 'Victory' : 'Defeat'}: enemy ships destroyed ${lostTheirs}, yours lost ${lostMine}${win && bounty ? `, bounty ${Math.round(bounty)}` : ''}.${salvage}${siegeNote}`;
  campaign.journal.push(`Day ${campaign.day}: ${summary}`);
  campaignStore.save();
  return { win, lostMine, lostTheirs, bounty, summary, salvage: salvage.trim(), siege: siegeNote.trim() };
}

function gainXp(o, xp) {
  o.xp += xp;
  const table = o.rank === 'admiral' ? CAPTAIN_XP.map((v) => v * 2) : CAPTAIN_XP;
  if (o.rank !== 'grand') o.level = levelFromXp(o.xp, table);
  else { let L = 1; while (L < 30 && o.xp >= Math.round(150 * Math.pow(L, 1.7))) L++; o.level = L; }
}

// A ship is gone; its captain survives half the time (01 §4.1) and stays with the fleet.
function removeShip(ship, rng) {
  const fl = byId('fleets', ship.fleetId);
  if (fl) fl.shipIds = fl.shipIds.filter((id) => id !== ship.id);
  campaign.ships = campaign.ships.filter((s) => s !== ship);
  const cap = byId('officers', ship.captainId);
  if (cap && cap.rank === 'captain') {
    if (rng.next() < CAPTAIN_SURVIVES) { cap.shipId = null; cap.fleetId = fl ? fl.id : null; }
    else cap.alive = false;
  }
}

// An emptied fleet: its commander goes to the nearest own settlement (the Grand Admiral escapes
// there, losing 20% of the treasury, 01 §14).
function fleetLost(fl) {
  campaign.fleets = campaign.fleets.filter((f) => f !== fl);
  const own = world.settlements.filter((s) => s.faction === fl.faction).sort((a, b) => Math.hypot(a.x - fl.x, a.y - fl.y) - Math.hypot(b.x - fl.x, b.y - fl.y))[0];
  for (const o of campaign.officers) {
    if (o.fleetId !== fl.id) continue;
    o.fleetId = null;
    if (own) o.garrisonedAt = own.id; else o.alive = false;
  }
  if (fl.faction === campaign.faction && fl.admiralId === campaign.ga) {
    campaign.treasury *= 0.8;
    campaign.journal.push(`Day ${campaign.day}: the flag fleet was lost; the Grand Admiral escaped to ${own ? own.name : 'the wilds'}.`);
  }
}

// Move a fleet a few cells away from an enemy along a passable line.
function fallBack(fl, from) {
  if (!from) return;
  const dx = fl.x - from.x, dy = fl.y - from.y, d = Math.hypot(dx, dy) || 1;
  for (let k = 4; k >= 1; k--) {
    const x = fl.x + (dx / d) * k, y = fl.y + (dy / d) * k;
    if (cellSpeed(world, cellAt(world, x, y), fl.domain) > 0) { fl.x = x; fl.y = y; break; }
  }
  fl.path = []; fl.dest = null;
}

// Retreat (01 §10.1): free if your slowest ship outpaces their fastest; otherwise the rearmost ship is lost.
function retreatCheck(mineShips, theirShips) {
  const slow = Math.min(...mineShips.map((s) => shipStats(s).speed), Infinity);
  const fast = Math.max(...theirShips.map((s) => shipStats(s).speed), 0);
  return { free: !mineShips.length || slow > fast, lose: mineShips[mineShips.length - 1] || null };
}
function retreat(mine, theirs, esc) {
  if (!esc.free && esc.lose) {
    const rng = makeRng(campaign.seed + campaign.day);
    ui.toast(`${shipStats(esc.lose).name} was caught covering the retreat.`, 4000);
    removeShip(esc.lose, rng);
  }
  mine.cooldown = theirs.cooldown = CONTACT_COOLDOWN;
  if (!mine.shipIds.length) fleetLost(mine); else fallBack(mine, theirs);
  campaignStore.save();
}

// ---------- garrisons and field outposts (01 §4.1): captains never move alone
function detachShip(fl, ship) {
  const s = fl.docked ? byId('settlements', fl.docked) : null;
  if (s && s.faction === fl.faction) {
    const gar = campaign.ships.filter((sh) => sh.garrison === s.id).length;
    if (gar >= SETTLEMENT_TYPES[s.type].garrison) return `${s.name}'s garrison is full (${gar}).`;
    ship.garrison = s.id;
  } else {
    let o = (campaign.outposts || []).find((q) => q.faction === fl.faction && Math.hypot(q.x - fl.x, q.y - fl.y) < 1);
    if (!o) { o = { id: newId('p'), x: fl.x, y: fl.y, faction: fl.faction, domain: fl.domain }; campaign.outposts.push(o); }
    ship.outpost = o.id;
  }
  fl.shipIds = fl.shipIds.filter((id) => id !== ship.id);
  ship.fleetId = null;
  const cap = byId('officers', ship.captainId);
  if (cap) { cap.fleetId = null; cap.garrisonedAt = ship.garrison || ship.outpost; }
  return '';
}

function pickUp(fl, ship) {
  if (mapDomain(designReport(shipDesign(ship)).domain) !== fl.domain) return 'Only ships of the fleet’s domain can join it.';
  const cap = fleetCap(fl);
  if (fl.shipIds.length >= cap) return `The fleet is full (${cap} ships).`;
  delete ship.garrison;
  if (ship.outpost) { const id = ship.outpost; delete ship.outpost; if (!campaign.ships.some((s) => s.outpost === id)) campaign.outposts = campaign.outposts.filter((o) => o.id !== id); }
  ship.fleetId = fl.id;
  fl.shipIds.push(ship.id);
  const o = byId('officers', ship.captainId);
  if (o) { o.fleetId = fl.id; delete o.garrisonedAt; }
  return '';
}
