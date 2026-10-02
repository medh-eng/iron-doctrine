/* ==== 15d RECRUITMENT AND SALVAGE ==== */
// Officers and ships for hire (design/01 §4; design/08 §13), salvage after battles, wreck sites,
// scrap fields and reverse-engineering (design/01 §9; design/08 §4, §9).

// Cost index (08 §3): Σ amount × reference price, money at 1.
function costIndex(cost) { let v = 0; for (const [g, n] of Object.entries(cost || {})) v += n * (g === 'money' ? 1 : PRICES[g] || 0); return v; }
const designCostIndex = (d) => d.cells.reduce((v, c) => v + costIndex(PARTS[c.p].cost), 0);
const hoursNow = () => campaign.day * 24 + campaign.hour;

// ---------- recruitment offers at forts and citadels, renewed weekly
const OFFER_RANK = { fort: { cap: [1, 4], adm: [1, 2], cls: [1, 3] }, citadel: { cap: [3, 8], adm: [1, 5], cls: [5, 8] } };
function makeOffers(s) {
  const R = OFFER_RANK[s.type];
  s.offers = [];
  if (!R) return;
  const rng = makeRng(campaign.seed + campaign.day * 17 + s.x * 131 + s.y);
  const pool = Object.keys(TEMPLATES).filter((id) => {
    const d = designFromTemplate(id), cls = classFor(d);
    if (!cls || cls.captain < R.cls[0] || cls.captain > R.cls[1] || !designResearched(d) || isSupport({ design: id })) return false;
    return !seaDomain(domainOf(d)) || s.coastal;
  });
  // Citadels with no large designs to offer fall back to the medium ones.
  const designs = pool.length ? pool : campaignBaseDesigns().filter((id) => { const c = classFor(designFromTemplate(id)); return c && c.captain <= 3 && !isSupport({ design: id }) && (!seaDomain(domainOf(designFromTemplate(id))) || s.coastal); });
  // Recruits come with the upgrades of their level, and sometimes one more (15l).
  for (let k = 0; k < 3 && designs.length; k++) {
    const level = rng.int(R.cap[0], R.cap[1]);
    s.offers.push({ kind: 'captain', level, design: rng.pick(designs), name: officerName(rng), traits: recruitTraits('captain', level, rng) });
  }
  const al = rng.int(R.adm[0], R.adm[1]);
  s.offers.push({ kind: 'admiral', level: al, name: officerName(rng), traits: recruitTraits('admiral', al, rng) });
  s.offersDay = campaign.day;
}
function offersAt(s) {
  if (s.faction !== campaign.faction) return [];
  const list = [];
  if (OFFER_RANK[s.type]) {
    if (!s.offers || campaign.day - (s.offersDay || 0) >= OFFER_DAYS) makeOffers(s);
    list.push(...s.offers);
  }
  if (hasWorkshop(s)) list.push({ kind: 'quartermaster', level: 1, name: officerName(makeRng(campaign.seed + s.x * 7 + s.y * 13 + campaign.day)) });
  return list;
}
function offerPrice(o) {
  const gifted = 1 + RECRUIT_TRAIT_PRICE * Math.max(0, (o.traits || []).length - (o.level - 1));   // an upgrade beyond their level costs extra
  if (o.kind === 'captain') return RECRUIT.captain * o.level * o.level * gifted + designCostIndex(shipDesign({ design: o.design })) * RECRUIT.listPrice;
  if (o.kind === 'admiral') return RECRUIT.admiral * o.level * gifted;
  return RECRUIT.quartermaster;
}
// Hire: captains arrive with their ship in the garrison; admirals and quartermasters wait there.
function hire(s, o) {
  const why = servicesBlock(s);
  if (why) return why;
  const price = offerPrice(o);
  if (o.kind === 'captain') {
    const gar = campaign.ships.filter((sh) => sh.garrison === s.id).length;
    if (gar >= SETTLEMENT_TYPES[s.type].garrison) return `${s.name}'s garrison is full (${gar}).`;
  }
  if (!spend(price)) return noMoney(price);
  const rng = makeRng(campaign.seed + campaign.nextId * 3);
  if (o.kind === 'captain') {
    const sh = makeShip(o.design, campaign.faction, rng);
    const cap = byId('officers', sh.captainId);
    Object.assign(cap, { name: o.name, level: o.level, xp: CAPTAIN_XP[o.level - 1] || 0, garrisonedAt: s.id, traits: (o.traits || []).slice() });
    sh.garrison = s.id;
  } else campaign.officers.push({ id: newId('o'), name: o.name, rank: o.kind, faction: campaign.faction, level: o.level, xp: o.kind === 'admiral' ? (CAPTAIN_XP[o.level - 1] || 0) * 2 : 0, alive: true, garrisonedAt: s.id, traits: (o.traits || []).slice() });
  if (s.offers) s.offers = s.offers.filter((x) => x !== o);
  return '';
}
// Who can lead a garrison out as a fleet here: idle admirals, and the Grand Admiral when waiting
// here without a fleet (after the flag fleet was lost; v0.7.2).
const commandersAt = (s) => idleAt(s, 'admiral').concat(idleAt(s, 'grand'));
// Appoint a level 1 admiral at any of your settlements, so a garrison is never stuck (v0.7.2).
function appointAdmiral(s) {
  if (s.faction !== campaign.faction) return 'Only at your own settlements.';
  if (!spend(RECRUIT.admiral)) return noMoney(RECRUIT.admiral);
  const rng = makeRng(campaign.seed + campaign.nextId * 7);
  campaign.officers.push({ id: newId('o'), name: officerName(rng), rank: 'admiral', faction: campaign.faction, level: 1, xp: 0, alive: true, garrisonedAt: s.id, traits: [] });
  return '';
}
const idleAt = (s, rank) => campaign.officers.filter((o) => o.alive && o.faction === campaign.faction && o.rank === rank && o.garrisonedAt === s.id && !o.fleetId && !o.shipId);

// An idle admiral takes the garrison's ships of one domain out as a new fleet.
function formFleet(s, admiral, domain) {
  const ships = campaign.ships.filter((sh) => sh.garrison === s.id && shipStats(sh).domain === domain);
  if (!ships.length) return 'No ships of that domain in the garrison.';
  const at = portCell(s, domain);
  if (!at) return 'No water here for ships.';
  delete admiral.garrisonedAt;
  const fl = makeFleet(campaign.faction, domain, at[0], at[1], [], null, admiral);
  admiral.fleetId = fl.id;
  fl.name = admiral.rank === 'grand' ? 'Flag fleet' : `${admiral.name.split(' ')[1]}'s ${domain} fleet`;
  fl.docked = s.id;
  for (const sh of ships) if (pickUp(fl, sh)) break;
  return '';
}
// A spare captain in the fleet takes command of a ship that has none.
function assignCaptain(fl, ship, o) {
  if (ship.captainId && byId('officers', ship.captainId)) return 'The ship has a captain.';
  if (o.fleetId !== fl.id || o.shipId) return 'That captain is not free here.';
  ship.captainId = o.id; o.shipId = ship.id;
  return '';
}
// Promotion (08 §13): a captain of level 6 or above becomes an admiral, leaving their ship.
function promote(s, fl, ship) {
  const o = byId('officers', ship.captainId);
  if (!o || o.rank !== 'captain' || o.level < PROMOTE_LEVEL) return `Captains of level ${PROMOTE_LEVEL} or above can be promoted.`;
  if (fl.docked !== s.id || s.faction !== campaign.faction) return 'Dock at your own settlement to promote.';
  const price = RECRUIT.promote * o.level;
  if (!spend(price)) return noMoney(price);
  o.rank = 'admiral'; o.level = 1; o.xp = 0; o.traits = []; o.shipId = null; o.fleetId = null; o.garrisonedAt = s.id;   // a new admiral starts their doctrines afresh
  ship.captainId = null;
  return '';
}

// ---------- salvage (08 §9): only when you win and hold the field
function salvageRates(ships) {
  let cranes = 0, magnet = false;
  for (const sh of ships) for (const c of shipDesign(sh).cells) {
    if (PARTS[c.p].salvage || c.p === 'crane' || c.p === 'magnet_crane') cranes++;
    if (c.p === 'magnet_crane') magnet = true;                // the Clans' magnet crane: +25% (v0.6.8)
  }
  cranes = Math.min(SALVAGE.maxCranes, cranes);
  const clan = (campaign.faction === 'clans' ? SALVAGE.clans : 1) * (magnet ? SALVAGE.magnet : 1);
  // Scavengers (08 §12): +4% part chance, +20% scrap.
  const sc = perk('scavengers');
  return { part: (SALVAGE.part + cranes * SALVAGE.crane + (sc ? 0.04 : 0)) * clan, scrap: SALVAGE.scrap * (1 + cranes * SALVAGE.craneScrap) * clan * (sc ? 1.2 : 1) };
}
// wrecks: [{ design, own }] of ships destroyed. Returns { scrap, items }.
function salvageFrom(wrecks, winners, rng) {
  const R = salvageRates(winners);
  const out = { scrap: 0, items: [] };
  for (const w of wrecks) {
    let kg = 0;
    for (const c of w.design.cells) {
      const P = PARTS[c.p];
      kg += P.mass;
      if (P.cat === 'structure' || !PART_LIBRARY.parts[c.p]) continue;
      if (rng.next() < R.part * (w.own ? 0.5 : 1)) out.items.push({ p: c.p, cond: rng.range(0.25, 0.6), salvaged: !w.own });
    }
    if (!w.own) out.scrap += (kg / 100) * R.scrap;
  }
  return out;
}
// Load what fits into the winners' holds; the rest stays as a wreck site for a day.
function takeSalvage(loot, fleets, x, y) {
  let scrap = loot.scrap, left = [];
  for (const fl of fleets) { const k = Math.min(scrap, Math.max(0, holdCap(fl) - holdUsed(fl))); fl.hold.scrap += k; scrap -= k; }
  for (const it of loot.items) {
    const fl = fleets.find((f) => holdCap(f) - holdUsed(f) >= PARTS[it.p].mass / 100);
    if (fl) itemsAt(fl.hold).push(it); else left.push(it);
  }
  if (scrap > 0.05 || left.length) (campaign.wrecks = campaign.wrecks || []).push({ id: newId('w'), x, y, scrap, items: left, until: hoursNow() + WRECK_HOURS });
  return { scrap: loot.scrap - scrap, items: loot.items.length - left.length, leftScrap: scrap, leftItems: left.length };
}
const wreckNear = (fl) => (campaign.wrecks || []).find((w) => Math.hypot(w.x - fl.x, w.y - fl.y) < 1.5);
function collectWreck(fl, w) {
  const got = takeSalvage({ scrap: w.scrap, items: w.items }, [fl], w.x, w.y);
  campaign.wrecks = campaign.wrecks.filter((q) => q !== w);
  // takeSalvage leaves a new site for what didn't fit; keep its original expiry.
  const again = campaign.wrecks[campaign.wrecks.length - 1];
  if (again && again.x === w.x && again.y === w.y && (got.leftScrap > 0.05 || got.leftItems)) again.until = w.until;
  return got.scrap > 0.05 || got.items ? '' : 'The hold is full.';
}

// ---------- scrap fields: a fleet with a salvage crane, holding still, gathers scrap
function makeScrapFields(rng) {
  campaign.scrapFields = [];
  const wanted = ['ruins', 'desert'];
  for (let k = 0; k < 4000 && campaign.scrapFields.length < SCRAP_FIELDS; k++) {
    const x = rng.int(3, WORLD_W - 4), y = rng.int(3, WORLD_H - 4);
    const t = terrainId(world, x, y);
    if (isSeaCell(world, x, y) || (k < 3000 && !wanted.includes(t)) || t === 'mountains') continue;
    if (campaign.scrapFields.some((f) => Math.hypot(f.x - x, f.y - y) < 12) || world.settlements.some((s) => Math.hypot(s.x - x, s.y - y) < 4)) continue;
    campaign.scrapFields.push({ x: x + 0.5, y: y + 0.5, left: rng.int(SCRAP_FIELD_SIZE[0], SCRAP_FIELD_SIZE[1]) });
  }
}
const fieldNear = (fl) => (campaign.scrapFields || []).find((f) => f.left > 0 && Math.hypot(f.x - fl.x, f.y - fl.y) < 1.5);
const hasCrane = (fl) => fleetShips(fl).some((sh) => shipDesign(sh).cells.some((c) => c.p === 'crane' || c.p === 'magnet_crane' || PARTS[c.p].salvage));
function stepSalvage(dt) {
  const t = hoursNow();
  if (campaign.wrecks) campaign.wrecks = campaign.wrecks.filter((w) => w.until > t);
  for (const fl of playerFleets()) {
    if (fl.path.length || !hasCrane(fl)) continue;
    const f = fieldNear(fl);
    if (!f) continue;
    const k = Math.min(SCRAP_FIELD_RATE * dt, f.left, Math.max(0, holdCap(fl) - holdUsed(fl)));
    fl.hold.scrap += k; f.left -= k;
  }
}

// ---------- reverse-engineering (08 §4): a salvaged enemy item studied at a metropolis
function studyTarget(id) {
  const lib = PART_LIBRARY.parts[id];
  if (!lib || (lib.unlock && lib.unlock.faction)) return id;   // a signature part is studied as itself
  const std = Object.values(PART_LIBRARY.parts).find((p) => p.family === lib.family && p.variant === 'std');
  return std ? std.id : id;
}
function studyPrice(id) { return (2 * costIndex(PARTS[id].cost)) / 10; }
function study(s, item) {
  const why = servicesBlock(s) || (s.type !== 'metropolis' ? 'Reverse-engineering needs a metropolis workshop.' : '');
  if (why) return why;
  const target = studyTarget(item.p);
  if (partUnlocked(target)) return 'That family is already known.';
  const price = studyPrice(item.p);
  if (!spend(price)) return noMoney(price);
  const c = [s.store].concat(dockedHere(s).map((fl) => fl.hold)).find((q) => itemsAt(q).includes(item));
  if (c) itemsAt(c).splice(itemsAt(c).indexOf(item), 1);
  (s.queue = s.queue || []).push({ kind: 'study', p: target, hours: STUDY_DAYS * 24, left: STUDY_DAYS * 24 });
  return '';
}
