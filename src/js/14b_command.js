/* ==== 14b COMMAND ==== */
// Officers, ships and fleets on the campaign map (design/01 §4, §6; design/08 §10, §13).
// `campaign` is the whole running campaign as plain JSON-safe data (design/04 §7); the terrain
// comes from its seed (`world`). Saved to irondoctrine.campaign.slot1.

const CAMPAIGN_VERSION = 2;
const CAMPAIGN_KEY = 'irondoctrine.campaign.slot1';
let campaign = null;
let world = null;

// ---------- save and load (design/04 §8): the blob format and try/catch rules of 02_save
const campaignStore = {
  exists() { try { return !!localStorage.getItem(CAMPAIGN_KEY); } catch (_e) { return false; } },
  save() {
    if (!campaign) return false;
    try {
      localStorage.setItem(CAMPAIGN_KEY, JSON.stringify({ v: CAMPAIGN_VERSION, t: Date.now(), data: campaign }));
      return true;
    } catch (_e) { ui.toast('The campaign could not be saved (storage full or blocked).'); return false; }
  },
  load() {
    let blob = null;
    try { blob = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) || 'null'); } catch (_e) { blob = null; }
    if (blob && blob.data && blob.v < CAMPAIGN_VERSION) {
      try { localStorage.setItem('irondoctrine.backup.campaign', JSON.stringify(blob)); } catch (_e) { /* ignore */ }
      migrateCampaign(blob.data, blob.v);
      blob.v = CAMPAIGN_VERSION;
    }
    if (!blob || !blob.data || blob.v !== CAMPAIGN_VERSION) {
      if (blob) { try { localStorage.setItem('irondoctrine.backup.campaign', JSON.stringify(blob)); } catch (_e) { /* ignore */ } ui.toast('This campaign save is from another version; it was kept as a backup.'); }
      return false;
    }
    campaign = blob.data;
    world = generateWorld(campaign.seed, campaign.faction);
    world.settlements = campaign.settlements;       // the saved state replaces the generated one
    computeTerritory(world);
    return true;
  },
};

// Older saves are brought forward, never wiped (a copy is kept as irondoctrine.backup.campaign).
function migrateCampaign(c, v) {
  if (v < 2) {
    // v2 (Part 4a): warehouses, all goods in markets and holds, unpaid-days counter.
    for (const s of c.settlements) {
      s.store = Object.assign(emptyCargo(), s.store || {});
      for (const k of GOODS) if (s.market[k] === undefined) s.market[k] = SELL_ONLY[k] ? 0 : SETTLEMENT_TYPES[s.type].stock[k];
      if (s.faction === c.faction && s.capital) Object.assign(s.store, HOME_STORE);
    }
    for (const fl of c.fleets) fl.hold = Object.assign(emptyCargo(), fl.hold || {});
    c.unpaid = 0;
  }
  c.v = CAMPAIGN_VERSION;
}

const newId = (p) => p + (campaign.nextId++).toString(36);
const byId = (list, id) => campaign[list].find((o) => o.id === id) || null;
const factionOf = (id) => FACTIONS.find((F) => F.id === id) || null;

function officerName(rng) { return `${rng.pick(NAME_FIRST)} ${rng.pick(NAME_LAST)}`; }

// ---------- ships: derived numbers from the design, cached by design id
const _shipStats = {};
function shipDesign(ship) {
  if (TEMPLATES[ship.design]) return Object.assign(designFromTemplate(ship.design), { family: TEMPLATES[ship.design].name });
  const d = save.designs.list.find((x) => x.id === ship.design);
  return d ? JSON.parse(JSON.stringify(d)) : designFromTemplate('light');
}
function shipStats(ship) {
  if (!_shipStats[ship.design]) {
    const d = shipDesign(ship);
    const rep = designReport(d);
    let burn = 0;
    for (const c of d.cells) { const P = PARTS[c.p]; if (P.fuelUse && (P.power > 0 || P.liftForce)) burn += P.fuelUse; }
    const cls = classFor(d);
    _shipStats[ship.design] = {
      name: markName(d), domain: mapDomain(rep.domain), speed: Math.max(5, rep.topSpeed || 0),
      fuelCap: Math.max(0.5, rep.st.fuel / 100), burn: (burn * 0.25) / 100, cost: rep.cost,
      cls: cls ? cls.id : null, clsName: cls ? cls.name : 'Outside class limits', captain: cls ? cls.captain : 99,
    };
  }
  return _shipStats[ship.design];
}
// Map domains: land, sea, air (airships and aircraft fly).
function mapDomain(dom) { return seaDomain(dom) ? 'sea' : airDomain(dom) ? 'air' : 'land'; }

function makeShip(designId, faction, rng) {
  const ship = { id: newId('h'), design: designId, faction, captainId: null, fleetId: null, hp: null, fuel: 0, ammo: 1, xp: 0, kills: 0, battles: 0 };
  ship.fuel = shipStats(ship).fuelCap;
  campaign.ships.push(ship);
  const cap = { id: newId('o'), name: officerName(rng), rank: 'captain', faction, level: 1, xp: 0, alive: true, shipId: ship.id, fleetId: null };
  campaign.officers.push(cap);
  ship.captainId = cap.id;
  return ship;
}

function makeFleet(faction, domain, x, y, designs, rng, admiral) {
  const fleet = { id: newId('f'), faction, domain, x, y, path: [], dest: null, hold: emptyCargo(), shipIds: [], admiralId: null, stranded: false, docked: null, ai: faction === campaign.faction ? null : { t: 0 } };
  if (admiral) fleet.admiralId = admiral.id;
  else {
    const a = { id: newId('o'), name: officerName(rng), rank: 'admiral', faction, level: 1, xp: 0, alive: true, fleetId: fleet.id };
    campaign.officers.push(a);
    fleet.admiralId = a.id;
  }
  for (const id of designs) {
    const s = makeShip(id, faction, rng);
    s.fleetId = fleet.id;
    byId('officers', s.captainId).fleetId = fleet.id;
    fleet.shipIds.push(s.id);
  }
  fleet.name = `${factionOf(faction).name} ${domain} fleet`;
  campaign.fleets.push(fleet);
  return fleet;
}

// Where a fleet of a domain can sit next to a settlement: land on it, sea in the water beside it.
function portCell(s, domain) {
  if (domain !== 'sea') return [s.x + 0.5, s.y + 0.5];
  let best = null, bd = Infinity;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (isSeaCell(world, s.x + dx, s.y + dy) && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = [s.x + dx + 0.5, s.y + dy + 0.5]; }
  }
  return best;
}

// ---------- a new campaign (01 §4.3; 08 §13; 09 relations)
function newCampaign(factionId, seed) {
  world = generateWorld(seed, factionId);
  campaign = {
    v: CAMPAIGN_VERSION, seed, faction: factionId, day: 1, hour: 6, speed: 1, running: false,
    treasury: START_MONEY, nextId: 1, ships: [], fleets: [], officers: [], outposts: [], journal: [],
    settlements: world.settlements, relations: {}, ga: null, gaXp: 0, unpaid: 0,
  };
  const home = world.settlements.find((s) => s.faction === factionId && s.capital);
  if (home) Object.assign(home.store, HOME_STORE);
  const rng = makeRng(seed + 7);
  // Relations: the player is at war with the two nearest factions and in truce with the others;
  // AI factions are at war with each other except one seeded pair.
  const me = FACTIONS.find((F) => F.id === factionId);
  const others = FACTIONS.filter((F) => F !== me).sort((a, b) => Math.hypot(a.at[0] - me.at[0], a.at[1] - me.at[1]) - Math.hypot(b.at[0] - me.at[0], b.at[1] - me.at[1]));
  const rel = (a, b, r) => { campaign.relations[[a, b].sort().join('|')] = r; };
  others.forEach((F, i) => rel(me.id, F.id, i < 2 ? 'war' : 'truce'));
  for (const a of others) for (const b of others) if (a !== b) rel(a.id, b.id, 'war');
  const pair = [rng.pick(others), rng.pick(others)];
  if (pair[0] !== pair[1]) rel(pair[0].id, pair[1].id, 'truce');
  initWeather(rng);
  // The Grand Admiral commands the land fleet from the flagship.
  const ga = { id: newId('o'), name: officerName(rng), rank: 'grand', faction: factionId, level: 1, xp: 0, alive: true };
  campaign.officers.push(ga);
  campaign.ga = ga.id;
  for (const F of FACTIONS) {
    const home = world.settlements.find((s) => s.faction === F.id && s.capital);
    const player = F.id === factionId;
    for (const spec of player ? START_FLEETS : AI_FLEETS) {
      // Sea fleets start at the capital if it's coastal, otherwise at the faction's coastal settlement.
      const base = spec.domain === 'sea' && !portCell(home, 'sea') ? world.settlements.find((s) => s.faction === F.id && portCell(s, 'sea')) : home;
      if (!base) continue;
      const at = portCell(base, spec.domain) || [base.x + 0.5, base.y + 0.5];
      const fl = makeFleet(F.id, spec.domain, at[0], at[1], spec.ships, rng, player && spec.domain === 'land' ? ga : null);
      if (player && spec.domain === 'land') { ga.fleetId = fl.id; fl.name = 'Flag fleet'; }
      else if (player) fl.name = spec.domain === 'sea' ? 'Sea fleet' : 'Air fleet';
      fl.docked = base.id;
    }
  }
  campaignStore.save();
  return campaign;
}

const relation = (a, b) => (a === b ? 'own' : !a || !b ? 'neutral' : campaign.relations[[a, b].sort().join('|')] || 'war');
const fleetShips = (fl) => fl.shipIds.map((id) => byId('ships', id)).filter(Boolean);
const playerFleets = () => campaign.fleets.filter((fl) => fl.faction === campaign.faction);
const fleetAdmiral = (fl) => byId('officers', fl.admiralId);
const levelFromXp = (xp, table) => { let l = 1; for (let i = 0; i < table.length; i++) if (xp >= table[i]) l = i + 1; return l; };

// March speed (km/h): the slowest ship, × MARCH; League sea ships +10% (09).
function fleetSpeed(fl) {
  let v = Infinity;
  for (const s of fleetShips(fl)) v = Math.min(v, shipStats(s).speed);
  if (!Number.isFinite(v)) return 0;
  v *= MARCH;
  if (fl.domain === 'sea' && fl.faction === 'league') v *= 1.1;
  return v;
}
// Fuel units per hour on the map (08 §8): Σ engines × 0.25 ÷ 100; air × 1.3 (Skyreach −15%).
function fleetBurn(fl) {
  let b = 0;
  for (const s of fleetShips(fl)) b += shipStats(s).burn;
  if (fl.domain === 'air') b *= AIR_MAP_FUEL * (fl.faction === 'skyreach' ? 0.85 : 1);
  return b;
}
function fleetFuel(fl) {
  let f = fl.hold.fuel || 0, cap = 0;
  for (const s of fleetShips(fl)) { f += s.fuel; cap += shipStats(s).fuelCap; }
  return { fuel: f, cap };
}

// ---------- movement (01 §6)
// Travel hours and fuel for a path, from the fleet's speed and burn over each cell.
function pathCost(fl, path) {
  const v = fleetSpeed(fl), burn = fleetBurn(fl);
  let hours = 0, fuel = 0, x = fl.x, y = fl.y;
  for (const [px, py] of path) {
    const i = cellAt(world, px, py);
    const s = cellSpeed(world, i, fl.domain);
    const h = (Math.hypot(px - x, py - y) * WORLD_KM) / Math.max(0.1, v * s);
    hours += h;
    fuel += h * burn * (world.road[i] && fl.domain === 'land' ? 0.85 : 1);
    x = px; y = py;
  }
  return { hours, fuel };
}

// Order a fleet to a cell. Returns the preview { path, hours, fuel, held, strands } or a reason.
function planMove(fl, tx, ty) {
  if (!fleetShips(fl).length) return { why: 'This fleet has no ships.' };
  const path = fleetPath(world, fl.domain, fl.x, fl.y, tx, ty);
  if (!path || !path.length) return { why: fl.domain === 'sea' ? 'Sea fleets stay on water.' : fl.domain === 'land' ? 'No land route there (sea or mountains).' : 'Out of reach.' };
  const c = pathCost(fl, path);
  const held = fleetFuel(fl).fuel;
  return { path, hours: c.hours, fuel: c.fuel, held, strands: c.fuel > held };
}
function orderMove(fl, plan) {
  fl.path = plan.path.slice();
  fl.dest = plan.path[plan.path.length - 1];
  fl.docked = null;
}

// Burn fuel shared across the fleet's tanks (and its hold), keeping every tank at the same share.
function burnFuel(fl, units) {
  const ships = fleetShips(fl);
  let tot = fl.hold.fuel || 0, cap = 0;
  for (const s of ships) { tot += s.fuel; cap += shipStats(s).fuelCap; }
  tot = Math.max(0, tot - units);
  const inTanks = Math.min(tot, cap);
  fl.hold.fuel = tot - inTanks;
  for (const s of ships) s.fuel = cap ? (inTanks * shipStats(s).fuelCap) / cap : 0;
  return tot;
}

// Move a fleet along its path for dt hours. Returns 'arrived' when it reaches the end.
function stepFleet(fl, dt) {
  if (!fl.path.length || !fl.shipIds.length) return '';
  const { fuel } = fleetFuel(fl);
  fl.stranded = fuel <= 0;
  if (fl.stranded && fl.domain === 'air') return '';
  let v = fleetSpeed(fl) * (fl.stranded ? STRANDED_SPEED : 1) * weatherSpeed(fl);
  let left = dt;
  while (left > 0 && fl.path.length) {
    const [px, py] = fl.path[0];
    const i = cellAt(world, px, py);
    const cs = Math.max(0.1, cellSpeed(world, i, fl.domain)) * v / WORLD_KM;   // cells per hour
    const d = Math.hypot(px - fl.x, py - fl.y);
    const t = d / cs;
    const used = Math.min(left, t);
    if (!fl.stranded) burnFuel(fl, used * fleetBurn(fl) * (world.road[i] && fl.domain === 'land' ? 0.85 : 1));
    if (t <= left) { fl.x = px; fl.y = py; fl.path.shift(); } else { fl.x += ((px - fl.x) * left) / t; fl.y += ((py - fl.y) * left) / t; }
    left -= used;
  }
  if (!fl.path.length) {
    fl.dest = null;
    const s = world.settlements.find((q) => Math.hypot(q.x + 0.5 - fl.x, q.y + 0.5 - fl.y) < 2.2 && relation(q.faction, fl.faction) !== 'war');
    fl.docked = s ? s.id : null;
    return 'arrived';
  }
  return '';
}

// ---------- weather (01 §2.2): a few fronts drift across the map
const WEATHER_KINDS = ['rain', 'fog', 'storm', 'snow', 'sandstorm'];
function initWeather(rng) {
  campaign.weather = [];
  for (let k = 0; k < 5; k++) campaign.weather.push({ kind: rng.pick(WEATHER_KINDS), x: rng.range(0, WORLD_W), y: rng.range(0, WORLD_H), r: rng.range(8, 16), vx: rng.range(-1.2, 1.2), vy: rng.range(-0.6, 0.6) });
}
function stepWeather(dt) {
  for (const f of campaign.weather) {
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.x < -20) f.x = WORLD_W + 19; if (f.x > WORLD_W + 20) f.x = -19;
    if (f.y < -20) f.y = WORLD_H + 19; if (f.y > WORLD_H + 20) f.y = -19;
  }
}
function weatherAt(x, y) {
  for (const f of campaign.weather || []) if (Math.hypot(f.x - x, f.y - y) < f.r) {
    const t = terrainId(world, x, y);
    if (f.kind === 'snow' && !['ice', 'tundra', 'mountains', 'pass'].includes(t)) return 'rain';
    if (f.kind === 'sandstorm' && !['desert', 'ruins'].includes(t)) return 'storm';
    return f.kind;
  }
  return 'clear';
}
// Storms slow and push air fleets; any bad weather slows everyone a little.
function weatherSpeed(fl) {
  const w = weatherAt(fl.x, fl.y);
  if (w === 'clear') return 1;
  if (fl.domain === 'air' && (w === 'storm' || w === 'sandstorm')) return 0.6;
  return 0.85;
}
