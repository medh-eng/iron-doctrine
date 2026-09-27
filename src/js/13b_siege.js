/* ==== 13b SIEGES ==== */
// Attacking a settlement (design/01 §11; design/08 §7). The defenders stand behind wall sections
// and a keep (fixed, destructible structures), with weapon parts in the emplacement slots, and
// fight with the garrison ships (three on the field) plus the settlement's militia. The attacker
// wins by destroying the garrison or the keep; the settlement then changes owner, restarts
// production after two days and hands the captor plunder. A failed siege leaves the walls
// damaged; they mend over days. Sieges work both ways: AI fleets besiege your settlements.

// Siege state on a settlement: walls (share of full HP), keep (share), emplacement part ids.
function siegeState(s) {
  const T = SETTLEMENT_TYPES[s.type];
  if (s.wallHp === undefined) s.wallHp = 1;
  if (s.keepHp === undefined) s.keepHp = 1;
  if (!s.emplace) s.emplace = [];
  while (s.emplace.length < T.slots) s.emplace.push(s.faction && s.faction !== campaign.faction ? AI_EMPLACE[Math.min(AI_EMPLACE.length - 1, s.emplace.length % AI_EMPLACE.length)] : null);
  if (s.emplace.length > T.slots) s.emplace.length = T.slots;
  return s;
}

// ---------- structures
// The armour material nearest the walls' rating (08 §7), and blocks of it adding up to the HP.
function wallMaterial(armor) {
  let best = 'plate', bd = Infinity;
  for (const id of ['plate', 'arm20', 'arm40', 'arm80']) { const d = Math.abs(PARTS[id].armor - armor); if (d <= bd) { bd = d; best = id; } }
  return best;
}
function blockDesign(id, name, mat, hp, wide, maxH) {
  const n = Math.max(wide, Math.round(hp / PARTS[mat].hp));
  const h = clamp(Math.ceil(n / wide), 6, maxH);
  const cells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < wide; x++) cells.push({ p: mat, x, y });
  return { id, name, w: wide, h, cells, mark: 1, structure: true };
}
// A weapon emplacement: an armoured casemate with a crew and the installed weapon.
function emplacementDesign(partId) {
  const d = designFromTemplate('bunker');
  const gun = d.cells.find((c) => PARTS[c.p].cat === 'weapon');
  if (gun) gun.p = partId;
  d.id = 'emplacement_' + partId; d.name = `${PARTS[partId].name} emplacement`;
  return d;
}
function placeStructure(B, d, side, x, damage) {
  const V = makeVehicle(d, side, x, side === 0 ? 1 : -1, B.T);
  V.ai = makeAI('fixed', B.cfg);
  V.structure = true;
  V.template = d.id;
  V.label = '';
  // Settle on the ground, then stand fixed.
  for (let t = 0; t < 1; t += SIM_STEP) stepVehicle(V, B.T, SIM_STEP);
  // Upright, founded at the lowest ground under it (dug in on the higher side).
  let ground = Infinity;
  for (let dx = -V.len / 2; dx <= V.len / 2; dx += 0.5) ground = Math.min(ground, B.T.height(V.body.x + dx));
  V.body.a = 0; V.body.w = 0; V.body.vx = 0; V.body.vy = 0;
  V.body.y = ground - (V.bounds.minY - V.com.y);
  V.anchored = true;
  if (damage < 1) for (const p of V.parts) p.hp *= Math.max(0.35, damage);
  B.units.push(V);
  return V;
}

// Build the defences of settlement s for the defending side of battle B.
function buildDefences(B, s, side) {
  siegeState(s);
  const T = SETTLEMENT_TYPES[s.type];
  const end = B.T.seaX0 !== undefined ? B.T.seaX0 : B.T.length;
  const at = (d) => (side === 0 ? d : end - d);        // distance from the defender's own edge
  B.siege = { s: s.id, defender: side, walls: [], emplacements: [], keep: null };
  if (T.walls > 0) {
    const mat = wallMaterial(T.armor);
    B.siege.keep = placeStructure(B, blockDesign('keep', `${s.name} keep`, mat, T.walls * SIEGE.keepMul, 5, 16), side, at(22), s.keepHp);
    B.siege.keep.keep = true;
    for (let k = 0; k < SIEGE.sections; k++) {
      B.siege.walls.push(placeStructure(B, blockDesign('wall', 'Wall', mat, T.walls / SIEGE.sections, 2, 14), side, at(46 + k * 16), s.wallHp));
    }
  }
  s.emplace.forEach((p, k) => {
    if (!p || !PARTS[p]) return;
    const V = placeStructure(B, emplacementDesign(p), side, at(38 + k * 9), 1);
    V.ai.accuracy *= SIEGE.emplaceAcc;                    // a stable platform (08 §7)
    B.siege.emplacements.push(V);
  });
}

// ---------- who fights
const militiaDesigns = (s) => {
  const out = [];
  for (let k = 0; k < SETTLEMENT_TYPES[s.type].militia; k++) {
    const d = designFromTemplate(MILITIA[Math.min(MILITIA.length - 1, Math.floor(k / 2))]);
    d.name = `Militia ${d.name}`;
    d.paint = { scheme: s.faction || 'league' };
    out.push(d);
  }
  return out;
};
// attackerFleet besieges s. The defending side: garrison ships, fleets of the owner nearby, militia.
function siegeSides(s, attacker) {
  const place = battlePlace(s.x, s.y);
  const ok = DEPLOY[place.field];
  const near = (fl) => fl.shipIds.length && ok.includes(fl.domain) && Math.hypot(fl.x - s.x - 0.5, fl.y - s.y - 0.5) <= REINFORCE_CELLS;
  const atk = [attacker, ...campaign.fleets.filter((fl) => fl !== attacker && fl.faction === attacker.faction && near(fl))].filter((fl) => ok.includes(fl.domain));
  const defFleets = s.faction ? campaign.fleets.filter((fl) => fl.faction === s.faction && near(fl)) : [];
  const garrison = campaign.ships.filter((sh) => sh.garrison === s.id && ok.includes(shipStats(sh).domain));
  const atkShips = atk.flatMap(fleetShips), defShips = garrison.concat(defFleets.flatMap(fleetShips));
  return { place, atk, defFleets, atkShips, defShips };
}

function createSiegeBattle(contact, headless) {
  const s = byId('settlements', contact.siege), attacker = byId('fleets', contact.fleet);
  contact.faction = attacker.faction;
  const sides = siegeSides(s, attacker);
  const playerDefends = s.faction === campaign.faction;
  const def = sides.defShips.map(battleDesign).concat(militiaDesigns(s));
  const atk = sides.atkShips.map(battleDesign);
  const cfg = campaignBattleConfig(sides.place);
  cfg.name = `Siege of ${s.name} · ${cfg.name}`;
  cfg.how = playerDefends ? 'Hold the walls: the enemy wins by destroying your keep or every defender.' : 'Destroy the keep, or every defender, to take the settlement.';
  const B = createBattle(0, { cfg, reserves: true, demo: !!headless, squad: playerDefends ? def : atk, enemyForce: playerDefends ? atk : def });
  for (const V of B.units) if (!V.structure) { applyShipState(V); crewBonus(V); }
  B.rotationMul = hasPerk('rotation') ? 0.6 : 1;
  buildDefences(B, s, playerDefends ? 0 : 1);
  B.contact = contact;
  // applyBattleOutcome's fleet bookkeeping: your fleets and theirs.
  B.sides = playerDefends ? { myFleets: sides.defFleets, theirFleets: sides.atk } : { myFleets: sides.atk, theirFleets: sides.defFleets };
  return B;
}

function autoResolveSiege(contact) {
  const quiet = audio.quiet;
  audio.quiet = true;
  const B = createSiegeBattle(contact, true);
  for (let t = 0; t < AUTO_SECS && !B.result; t += SIM_STEP) updateBattle(B, SIM_STEP);
  audio.quiet = quiet;
  for (const pool of [shells, torpedoes, charges, missiles, salvos, particles, debris, smokeScreens, smokeColumns, floaters, confetti, beams, flames]) pool.forEachAlive((p) => { p.alive = false; });
  if (!B.result) {
    // Time runs out: the defenders hold.
    B.result = B.siege.defender === 0 ? 'win' : 'lost';
  }
  return applyBattleOutcome(B);
}

// ---------- after the battle (called from applyBattleOutcome)
function applySiege(B, win) {
  const s = byId('settlements', B.siege.s);
  const share = (list) => { let a = 0, b = 0; for (const V of list) { for (const p of V.parts) { b += p.def.hp; if (p.alive) a += p.hp; } } return b ? a / b : 1; };
  s.wallHp = B.siege.walls.length ? share(B.siege.walls) : 1;
  s.keepHp = B.siege.keep ? share([B.siege.keep]) : 1;
  const defenderWon = (B.siege.defender === 0) === win;
  if (defenderWon) return ` ${s.name} holds; walls at ${Math.round(s.wallHp * 100)}%.`;
  return ' ' + captureSettlement(s, B.contact.faction);
}

// A settlement changes hands (01 §11; 08 §6 plunder).
function captureSettlement(s, faction) {
  const was = s.faction;
  s.faction = faction;
  s.restart = campaign.day + SIEGE.restartDays;
  s.queue = []; s.yard = []; delete s.upgrade; delete s.offers;
  s.wallHp = Math.max(0.25, s.wallHp || 0); s.keepHp = Math.max(0.25, s.keepHp || 0);
  if (faction === campaign.faction) s.plunder = campaign.day + SIEGE.plunderDays; else delete s.plunder;
  // Garrison ships of the old owner that didn't fight here are lost with it.
  const rng = makeRng(campaign.seed + campaign.day * 5 + s.x);
  for (const sh of campaign.ships.filter((q) => q.garrison === s.id)) removeShip(sh, rng);
  for (const o of campaign.officers) if (o.garrisonedAt === s.id && o.faction !== faction) { o.alive = false; delete o.garrisonedAt; }
  for (const fl of campaign.fleets) if (fl.docked === s.id && relation(fl.faction, faction) === 'war') fl.docked = null;
  computeTerritory(world);
  if (SCREENS.map) SCREENS.map.territoryDirty = true;
  if (faction === campaign.faction) gaXp(GA_XP.capture[s.type] || 0);
  const who = factionOf(faction);
  const msg = `${s.name} was taken by ${faction === campaign.faction ? 'your forces' : who.name}${was ? '' : ' (it was neutral)'}.`;
  campaign.journal.push(`Day ${campaign.day}: ${msg}`);
  return msg;
}

// Plunder (08 §6): 25% of a captured settlement's production value, daily, for 10 days.
function plunderValue(s) {
  let v = Math.max(0, SETTLEMENT_TYPES[s.type].money);
  for (const [g, n] of Object.entries(production(s))) v += n * PRICES[g];
  return v * SIEGE.plunder;
}

// ---------- Walls tab: install weapon items from the warehouse in the emplacement slots
function installEmplacement(s, k, partId) {
  siegeState(s);
  if (s.faction !== campaign.faction) return 'Only your own settlements.';
  const it = partId ? itemsAt(s.store).find((q) => q.p === partId) : null;
  if (partId && !it) return 'That part is not in the warehouse.';
  if (s.emplace[k]) itemsAt(s.store).push({ p: s.emplace[k], cond: 1 });      // the old weapon goes back to stock
  s.emplace[k] = partId || null;
  if (it) itemsAt(s.store).splice(itemsAt(s.store).indexOf(it), 1);
  return '';
}
const emplaceable = (id) => PARTS[id] && PARTS[id].cat === 'weapon' && PARTS[id].w <= 3 && PARTS[id].h <= 2 && !PARTS[id].secondary;

// ---------- the siege order for your fleet, and AI sieges of your settlements
function siegeBlock(fl, s) {
  if (!fl || fl.faction !== campaign.faction) return 'Select one of your fleets.';
  const rel = relation(s.faction, campaign.faction);
  if (rel === 'own') return 'This is yours.';
  if (rel === 'truce') return 'You have a truce with them.';
  if (Math.hypot(fl.x - s.x - 0.5, fl.y - s.y - 0.5) > REINFORCE_CELLS) return 'Move a fleet next to it first.';
  if (fl.convoy) return 'Convoys don’t lay sieges.';
  if (!siegeSides(s, fl).atkShips.length) return 'None of this fleet’s ships can fight there.';
  return '';
}

// AI: a strong fleet at war marches on a weakly held settlement of yours, and besieges it on arrival.
function defenceStrength(s) {
  const T = SETTLEMENT_TYPES[s.type];
  let v = (T.walls * (1 + SIEGE.keepMul)) / 10 + T.militia * 400;
  for (const sh of campaign.ships.filter((q) => q.garrison === s.id)) v += shipStats(sh).cost * shipHealth(sh);
  return v * (s.wallHp === undefined ? 1 : 0.5 + s.wallHp / 2);
}
function aiSiegeTarget(fl) {
  if (campaign.day < SIEGE.aiFrom || fl.domain !== 'land' || (fl.ai.restUntil || 0) > hoursNow()) return null;
  let best = null, bd = 30;
  for (const s of world.settlements) {
    if (s.faction !== campaign.faction || relation(fl.faction, s.faction) !== 'war') continue;
    const d = Math.hypot(s.x - fl.x, s.y - fl.y);
    if (d < bd && fleetStrength(fl) >= defenceStrength(s) * SIEGE.aiEdge) { best = s; bd = d; }
  }
  return best;
}
