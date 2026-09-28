/* ==== 15f RESEARCH, PERKS AND RANKS ==== */
// The tech tree, perks and Command Points (design/01 §12, design/08 §10–12).
// The Grand Admiral earns 2 CP per level from level 2. A node costs CP, money from the
// treasury, and electronics and scrap from the warehouse of the city or metropolis doing the
// research, and takes days; one research job runs at a time. A finished node unlocks its parts
// for the workshops, yards and the campaign Drafting Office. Perks cost CP only and act at once.
// The whole tree costs about 160 CP against 58 at level 30, so choosing is unavoidable.

const TECH_BY_ID = Object.fromEntries(TECH.map((n) => [n.id, n]));
const PERK_BY_ID = Object.fromEntries(PERKS.map((p) => [p.id, p]));

function techState() {
  if (!campaign.tech) campaign.tech = { known: [], perks: [], job: null };
  return campaign.tech;
}
const techKnown = (id) => techState().known.includes(id);
const perk = (id) => !!campaign && !!campaign.tech && campaign.tech.perks.includes(id);
const grandAdmiral = () => byId('officers', campaign.ga);

// Command Points: earned, spent (known nodes, the node being researched, perks), free.
function cpEarned() { const ga = grandAdmiral(); return ga ? CP_PER_LEVEL * (ga.level - 1) : 0; }
function nodeCp(n) {
  const mod = TECH_FACTION_CP[campaign.faction] || {};
  let cp = TECH_TIERS[n.tier].cp + (mod[n.id] || 0);
  if (mod.tier4Energy && n.tier === 4 && n.branch === 'Energy') cp = Math.round(cp * mod.tier4Energy);
  return Math.max(1, cp);
}
function cpSpent() {
  const t = techState();
  let cp = 0;
  for (const id of t.known) if (TECH_BY_ID[id]) cp += nodeCp(TECH_BY_ID[id]);
  if (t.job) cp += nodeCp(TECH_BY_ID[t.job.node]);
  for (const id of t.perks) if (PERK_BY_ID[id]) cp += PERK_BY_ID[id].cp;
  return cp;
}
const cpFree = () => cpEarned() - cpSpent();

// The library parts a node unlocks.
function nodeParts(id) {
  return Object.values(PART_LIBRARY.parts).filter((P) => P.unlock && P.unlock.tech === id).map((P) => P.id);
}

// 'known', 'researching', 'ready' (prerequisites met) or 'locked'.
function nodeStatus(n) {
  const t = techState();
  if (t.known.includes(n.id)) return 'known';
  if (t.job && t.job.node === n.id) return 'researching';
  return n.needs.every(techKnown) ? 'ready' : 'locked';
}

// Where a tier can be researched: cities and metropolises for T1–T2, metropolises for T3–T4.
// The Lumen Collective research every tier at their cities (09).
function researchPlaces(n) {
  const metro = TECH_TIERS[n.tier].at === 'metropolis' && campaign.faction !== 'lumen';
  return world.settlements.filter((s) => s.faction === campaign.faction && (s.type === 'metropolis' || (!metro && s.type === 'city')));
}

// Why node n can't be researched at settlement s now, or ''.
function researchBlock(n, s) {
  const t = techState(), T = TECH_TIERS[n.tier];
  if (t.known.includes(n.id)) return 'Already known.';
  if (t.job) return `${TECH_BY_ID[t.job.node].name} is being researched.`;
  const missing = n.needs.filter((id) => !techKnown(id));
  if (missing.length) return `Needs ${missing.map((id) => TECH_BY_ID[id].name).join(' and ')}.`;
  if (cpFree() < nodeCp(n)) return `Needs ${nodeCp(n)} Command Points; ${cpFree()} free.`;
  if (!s) return T.at === 'metropolis' ? 'Needs one of your metropolises.' : 'Needs one of your cities or metropolises.';
  if (!researchPlaces(n).includes(s)) return `${s.name} can’t research tier ${n.tier}.`;
  if (campaign.treasury < T.money) return `Needs ${T.money} money; the treasury holds ${Math.round(campaign.treasury)}.`;
  if ((s.store.elec || 0) < T.elec) return `Needs ${T.elec} electronics in ${s.name}’s warehouse; it holds ${Math.floor(s.store.elec || 0)}.`;
  if ((s.store.scrap || 0) < T.scrap) return `Needs ${T.scrap} scrap in ${s.name}’s warehouse; it holds ${Math.floor(s.store.scrap || 0)}.`;
  return '';
}

function startResearch(n, s) {
  const why = researchBlock(n, s);
  if (why) return why;
  const T = TECH_TIERS[n.tier];
  campaign.treasury -= T.money;
  s.store.elec -= T.elec;
  s.store.scrap -= T.scrap;
  techState().job = { node: n.id, at: s.id, daysLeft: T.days };
  campaign.journal.push(`Day ${campaign.day}: research on ${n.name} began at ${s.name}.`);
  return '';
}

// Once a day (from dailyEconomy): the research job moves on. If the settlement is lost the job
// stops; its Command Points come back, the money and goods don't.
function researchDay(news) {
  const t = techState();
  if (!t.job) return;
  const s = world.settlements.find((q) => q.id === t.job.at);
  const n = TECH_BY_ID[t.job.node];
  if (!s || s.faction !== campaign.faction) {
    t.job = null;
    news.push(`Research on ${n.name} stopped: ${s ? s.name : 'the settlement'} was lost.`);
    return;
  }
  if (--t.job.daysLeft > 0) return;
  t.job = null;
  t.known.push(n.id);
  const parts = nodeParts(n.id).map((id) => PARTS[id] && PARTS[id].name).filter(Boolean);
  news.push(`Research complete: ${n.name}${parts.length ? ` (${parts.join(', ')})` : ''}.`);
  campaign.journal.push(`Day ${campaign.day}: research complete: ${n.name}.`);
}

function buyPerk(id) {
  const P = PERK_BY_ID[id], t = techState();
  if (!P) return 'Unknown perk.';
  if (t.perks.includes(id)) return 'Already taken.';
  if (cpFree() < P.cp) return `Needs ${P.cp} Command Points; ${cpFree()} free.`;
  t.perks.push(id);
  campaign.journal.push(`Day ${campaign.day}: perk taken: ${P.name}.`);
  return '';
}

// ---------- ranks (08 §10)
// Grand Admiral: fleet size and flagship class as for an admiral of level min(10, ⌈L ÷ 3⌉).
function commandLevel(o) { return !o ? 1 : o.rank === 'grand' ? Math.min(10, Math.ceil(o.level / 3)) : o.level; }
// Ships a fleet may hold: by its commander's level, plus perks for your own fleets.
function fleetCap(fl) {
  const o = fleetAdmiral(fl);
  let cap = FLEET_SIZE[Math.min(9, commandLevel(o) - 1)];
  if (fl.faction === campaign.faction && o) {
    if (o.rank === 'grand' && perk('wider_command')) cap += 2;
    if (o.rank === 'admiral' && perk('second_in_command')) cap += 1;
  }
  return cap;
}

// Captain skill in battle (08 §10): +2% accuracy and −3% reaction time per level above 1, and
// your perks. Called once for each ship as it enters a campaign battle.
function applyCaptain(V) {
  const id = V.design && V.design._shipId;
  if (!id || !campaign || !V.ai) return;
  const ship = byId('ships', id);
  const cap = ship && byId('officers', ship.captainId);
  const L = cap ? cap.level : 1;
  V.ai.accuracy *= 1 + CAPTAIN_ACC_PER_LEVEL * (L - 1) + (ship && ship.faction === campaign.faction && perk('veteran_eye') ? 0.05 : 0);
  V.ai.reaction *= Math.max(0.4, 1 - CAPTAIN_REACT_PER_LEVEL * (L - 1)) * (ship && ship.faction === campaign.faction && perk('iron_discipline') ? 0.8 : 1);
  V.captainLevel = L;
}

// Grand Admiral XP from outside battle (08 §10): captures, convoy deliveries, reverse-engineering.
function gaXpFor(kind, arg) {
  const ga = grandAdmiral();
  if (!ga) return;
  const xp = kind === 'capture' ? GA_XP.capture[arg] || 0 : GA_XP[kind] || 0;
  if (xp) gainXp(ga, xp);
}
