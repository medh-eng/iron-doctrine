/* ==== 15b RESEARCH ==== */
// The tech tree, Command Points and perks (design/01 §12; design/08 §10–§12). The Grand Admiral
// earns 2 CP a level; CP buy tech nodes (researched at a city or metropolis for money,
// electronics, scrap and days) and perks. Tier 0 is known from the start. The tree only
// applies to campaigns: the Gauntlet and the Battle Simulator have every part.

const TECH = {};
for (const [id, name, tier, pre] of TECH_NODES) TECH[id] = { id, name, tier, pre };
const PERK = {};
for (const [id, group, name, cp, text] of PERKS) PERK[id] = { id, group, name, cp, text };

// The tech node that unlocks a part (null: known from the start).
function partTech(id) {
  if (MATERIAL_TECH[id]) return MATERIAL_TECH[id];
  const lib = PART_LIBRARY.parts[id];
  return lib && lib.unlock && lib.unlock.tech ? lib.unlock.tech : null;
}
const techParts = (node) => Object.keys(PARTS).filter((id) => partTech(id) === node);
const knows = (node) => !!campaign && (campaign.tech || []).includes(node);
const hasPerk = (id) => !!campaign && (campaign.perks || []).includes(id);

// Is a part available to your campaign? Tier 0 and start parts, researched nodes, your
// faction's own parts, and reverse-engineered families.
function partUnlocked(id) {
  const lib = PART_LIBRARY.parts[id];
  if (lib && lib.unlock && lib.unlock.faction) return lib.unlock.faction === campaign.faction || (campaign.unlocked || []).includes(id);
  const node = partTech(id);
  if (!node || knows(node)) return true;
  const known = campaign.unlocked || [];
  return known.includes(id) || (!!lib && known.some((k) => PART_LIBRARY.parts[k] && PART_LIBRARY.parts[k].family === lib.family));
}

// ---------- Command Points
const gaOfficer = () => byId('officers', campaign.ga);
const cpEarned = () => CP_PER_LEVEL * ((gaOfficer() || { level: 1 }).level - 1);
const cpSpent = () => campaign.cpSpent || 0;
const cpFree = () => cpEarned() - cpSpent();
function gaXp(n) { const ga = gaOfficer(); if (ga && ga.alive !== false) gainXp(ga, n); }

// ---------- research
const researching = (node) => world.settlements.some((s) => (s.queue || []).some((j) => j.kind === 'research' && j.node === node));
function techState(node) {
  if (knows(node)) return 'known';
  if (researching(node)) return 'researching';
  return TECH[node].pre.every(knows) ? 'open' : 'locked';
}
function researchBlock(node, s) {
  const T = TECH[node], C = TECH_COST[T.tier];
  const st = techState(node);
  if (st === 'known') return 'Already known.';
  if (st === 'researching') return 'Already being researched.';
  if (st === 'locked') return `Needs ${T.pre.filter((p) => !knows(p)).map((p) => TECH[p].name).join(' and ')} first.`;
  if (cpFree() < C.cp) return `Needs ${C.cp} Command Points (you have ${cpFree()}).`;
  if (!s) return C.at === 'metropolis' ? 'Research it at one of your metropolises.' : 'Research it at one of your cities or metropolises.';
  const why = servicesBlock(s);
  if (why) return why;
  if (!hasWorkshop(s) || (C.at === 'metropolis' && s.type !== 'metropolis')) return C.at === 'metropolis' ? 'Tier 3–4 needs a metropolis.' : 'Needs a city or metropolis.';
  return lackOf(s, { money: C.money, elec: C.elec, scrap: C.scrap });
}
// The best of your settlements to research a node at: one that can pay, else any that could.
function researchSite(node) {
  const C = TECH_COST[TECH[node].tier];
  const sites = world.settlements.filter((s) => s.faction === campaign.faction && hasWorkshop(s) && (C.at !== 'metropolis' || s.type === 'metropolis'));
  return sites.find((s) => !researchBlock(node, s)) || sites[0] || null;
}
function research(node, s) {
  const why = researchBlock(node, s);
  if (why) return why;
  const C = TECH_COST[TECH[node].tier];
  consume(s, { money: C.money, elec: C.elec, scrap: C.scrap });
  campaign.cpSpent = cpSpent() + C.cp;
  (s.queue = s.queue || []).push({ kind: 'research', node, hours: C.days * 24, left: C.days * 24 });
  return '';
}
function finishResearch(s, node) {
  (campaign.tech = campaign.tech || []).push(node);
  const n = techParts(node).length;
  return `${s.name}: ${TECH[node].name} researched${n ? ` (${n} part${n > 1 ? 's' : ''})` : ''}.`;
}

// ---------- perks
function perkBlock(id) {
  if (hasPerk(id)) return 'Already taken.';
  if (cpFree() < PERK[id].cp) return `Needs ${PERK[id].cp} Command Points (you have ${cpFree()}).`;
  return '';
}
function takePerk(id) {
  const why = perkBlock(id);
  if (why) return why;
  (campaign.perks = campaign.perks || []).push(id);
  campaign.cpSpent = cpSpent() + PERK[id].cp;
  return '';
}

// ---------- officers (08 §10)
// Fleet size: admirals by level; the Grand Admiral as an admiral of level ⌈L ÷ 3⌉; perks.
function fleetCap(fl) {
  if (fl.convoy) return CONVOY_SIZE;
  const a = fleetAdmiral(fl);
  const L = a ? a.level : 1;
  const mine = fl.faction === campaign.faction;
  if (a && a.rank === 'grand') return FLEET_SIZE[Math.min(10, Math.ceil(L / 3)) - 1] + (mine && hasPerk('wider') ? 2 : 0);
  return FLEET_SIZE[Math.min(9, L - 1)] + (mine && hasPerk('second') ? 1 : 0);
}
// A captain commands ships of classes up to their level (1 small, 3 medium, 5 large, 8 extra-large).
const canCommand = (o, ship) => !o || o.rank !== 'captain' || o.level >= shipStats(ship).captain;

// Captains' level and your perks, on a vehicle in a campaign battle.
function crewBonus(V) {
  const id = V.design._shipId;
  if (!id || !V.ai) return;
  const ship = byId('ships', id);
  const o = ship && byId('officers', ship.captainId);
  const L = o ? o.level : 1;
  V.ai.accuracy *= 1 + CAPTAIN_LEVEL.accuracy * (L - 1);
  V.ai.reaction *= Math.max(0.3, 1 - CAPTAIN_LEVEL.reaction * (L - 1));
  if (ship.faction === campaign.faction) {
    if (hasPerk('veteran')) V.ai.accuracy *= 1.05;
    if (hasPerk('discipline')) V.ai.reaction *= 0.8;
  }
}
