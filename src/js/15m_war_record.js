/* ==== 15m WAR RECORD: MEDALS, CAPTURES, WINNING AND LOSING ==== */
// Part 6d (design/01 §14, §16; 02 §8). The campaign keeps a war record (campaign.stats) of
// battles, wrecks, convoys, flagships, captures, charters, truces and studies; campaign medals are
// feats from it (07_data CAMPAIGN_MEDALS). Enemy designs you destroy and parts you reverse-
// engineer go to the blueprint gallery (save.profile, kept across campaigns). Each day the game
// checks the end of the war: you win by taking every rival capital or holding 60% of all
// settlements, and lose with no settlements and no fleets. Facts only.

function warStats() {
  campaign.stats = campaign.stats || {};
  for (const m of CAMPAIGN_MEDALS) if (campaign.stats[m.stat] === undefined) campaign.stats[m.stat] = 0;
  if (campaign.stats.lost === undefined) campaign.stats.lost = 0;
  return campaign.stats;
}
function warCount(stat, n = 1) { warStats()[stat] += n; }

// New medals from the record; their names go into the news and the journal.
function awardMedals(news) {
  const st = warStats();
  campaign.medals = campaign.medals || [];
  for (const m of CAMPAIGN_MEDALS) {
    if (campaign.medals.includes(m.id) || st[m.stat] < m.n) continue;
    campaign.medals.push(m.id);
    const msg = `Medal: ${m.name}.`;
    campaign.journal.push(`Day ${campaign.day}: ${msg}`);
    if (news) news.push(msg);
  }
}

// ---------- the gallery (save.profile)
function galleryDesign(ship, faction) {
  const p = save.profile;
  const id = ship.design;
  if (p.captured.some((c) => c.id === id)) return;
  const d = shipDesign(ship);
  const entry = { id, name: markName(Object.assign({ family: d.family || d.name }, d)), faction, day: campaign.day };
  if (!TEMPLATES[id]) entry.design = d;                 // an AI refit: kept whole
  p.captured.push(entry);
  if (p.captured.length > 80) p.captured.shift();
  save.touch('profile');
}
function galleryPart(partId) {
  const p = save.profile;
  if (!p.studied.includes(partId)) { p.studied.push(partId); save.touch('profile'); }
}

// ---------- after a battle (applyBattleOutcome)
// destroyed: enemy ships lost (the ship objects, read before removal); flagsSunk: enemy flagships.
function warAfterBattle(win, destroyed, theirFleets, flagsSunk, lostMine) {
  const st = warStats();
  if (win) st.won++; else st.lost++;
  st.destroyed += destroyed.length;
  st.flagships += flagsSunk;
  if (win && theirFleets.some((fl) => fl.aiConvoy)) st.convoys++;
  st.lostShips = (st.lostShips || 0) + lostMine;
  for (const sh of destroyed) galleryDesign(sh, sh.faction);
}

// ---------- the end of the war (checked each day and after captures)
// Capitals of the rivals (older saves: the capital's present owner, if it isn't you).
const rivalCapitals = () => world.settlements.filter((s) => s.capital && (s.capitalOf || s.faction) !== campaign.faction);
function victoryProgress() {
  const all = world.settlements.length;
  const mine = world.settlements.filter((s) => s.faction === campaign.faction).length;
  const caps = rivalCapitals();
  return {
    capitals: caps.filter((s) => s.faction === campaign.faction).length, capitalsAll: caps.length,
    held: mine, all, share: all ? mine / all : 0, need: Math.ceil(all * WIN_SHARE),
    fleets: playerFleets().filter((fl) => fl.shipIds.length).length,
  };
}
function checkWarEnd(news) {
  if (campaign.over) return null;
  const v = victoryProgress();
  let res = null;
  if (v.capitalsAll && v.capitals === v.capitalsAll) res = { result: 'win', how: `every rival capital taken (${v.capitals})` };
  else if (v.held >= v.need) res = { result: 'win', how: `${v.held} of ${v.all} settlements held` };
  else if (!v.held && !v.fleets) res = { result: 'lost', how: 'no settlements and no fleets left' };
  if (!res) return null;
  campaign.over = Object.assign(res, { day: campaign.day });
  campaign.running = false;
  const msg = `${res.result === 'win' ? 'Victory' : 'Defeat'} on day ${campaign.day}: ${res.how}.`;
  campaign.journal.push(`Day ${campaign.day}: ${msg}`);
  if (news) news.push(msg);
  const p = save.profile;
  p.campaigns[res.result === 'win' ? 'won' : 'lost']++;
  save.touch('profile');
  return campaign.over;
}
