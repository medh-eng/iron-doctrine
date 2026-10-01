/* ==== 15j RELATIONS: REPUTATION, TRUCES, WAR, CHARTERS ==== */
// Part 6c (design/09 Relations, 01 §7.2). Your reputation with each faction is a number from
// −100 to 100 that moves with what you do to them and drifts back towards 0. A truce allows
// trade but no attacks. You can offer a truce (paying tribute) or declare war; a faction breaks a
// truce when your borders stay contested or your reputation falls too far, and offers one when it
// rises high enough. AI factions make and break truces among themselves on the same borders.
// Neutral villages can be bought with a charter: money, and reputation with nearby factions.

const relKey = (a, b) => [a, b].sort().join('|');
function setRelation(a, b, r) { campaign.relations[relKey(a, b)] = r; }
function relState() {
  if (!campaign.rep) {
    campaign.rep = {};
    for (const F of FACTIONS) if (F.id !== campaign.faction) campaign.rep[F.id] = relation(F.id, campaign.faction) === 'truce' ? REL.startTruce : REL.startWar;
  }
  campaign.tension = campaign.tension || {};      // days of contested border, by pair key
  campaign.lastFought = campaign.lastFought || {}; // day you last fought each faction
  return campaign.rep;
}
const repOf = (fid) => Math.round(relState()[fid] || 0);
function addRep(fid, n) {
  if (!fid || fid === campaign.faction) return;
  const R = relState();
  R[fid] = clamp((R[fid] || 0) + n, -100, 100);
}

// ---------- what moves reputation
// After a battle with you (applyBattleOutcome).
function relationsAfterBattle(theirFleets, win) {
  const who = new Set(theirFleets.map((fl) => fl.faction));
  for (const fid of who) {
    relState();
    campaign.lastFought[fid] = campaign.day;
    if (!win) continue;
    const convoy = theirFleets.some((fl) => fl.faction === fid && fl.aiConvoy);
    addRep(fid, convoy ? REL.convoyRaided : REL.battleWon);
    // Their enemies think a little better of you.
    for (const F of FACTIONS) if (F.id !== fid && F.id !== campaign.faction && relation(F.id, fid) === 'war') addRep(F.id, REL.enemyBeaten);
  }
}
// From captureSettlement: you took one of theirs.
function relationsAfterCapture(was, faction) {
  if (faction === campaign.faction && was && was !== campaign.faction) addRep(was, REL.captured);
}

// ---------- your moves
function truceTribute(fid) { return REL.tribute + REL.tributePerSettlement * settlementsOf(fid).length; }
function truceBlock(fid) {
  if (relation(fid, campaign.faction) !== 'war') return 'Not at war.';
  if (repOf(fid) < REL.truceRep) return `Reputation ${repOf(fid)}; they talk at ${REL.truceRep} or more.`;
  relState();
  const last = campaign.lastFought[fid];
  const since = last === undefined ? Infinity : campaign.day - last;
  if (since < REL.quietDays) return `You fought them ${since === 0 ? 'today' : `${since} day${since > 1 ? 's' : ''} ago`}; they talk after ${REL.quietDays} quiet days.`;
  if (campaign.treasury < truceTribute(fid)) return `Tribute ${truceTribute(fid)}; you have ${Math.floor(campaign.treasury)}.`;
  return '';
}
function proposeTruce(fid) {
  const why = truceBlock(fid);
  if (why) return why;
  campaign.treasury -= truceTribute(fid);
  makeTruce(campaign.faction, fid);
  addRep(fid, REL.truceMade);
  warCount('truces');
  campaign.journal.push(`Day ${campaign.day}: truce with the ${factionOf(fid).name} (tribute ${truceTribute(fid)}).`);
  return '';
}
function declareWar(fid) {
  if (relation(fid, campaign.faction) !== 'truce') return 'Not in truce.';
  setRelation(campaign.faction, fid, 'war');
  addRep(fid, REL.warDeclared);
  campaign.journal.push(`Day ${campaign.day}: you declared war on the ${factionOf(fid).name}.`);
  return '';
}
function makeTruce(a, b) {
  setRelation(a, b, 'truce');
  relState();
  campaign.tension[relKey(a, b)] = 0;
  // Fleets of the two stop what they were doing to each other.
  for (const fl of campaign.fleets) if (fl.ai && (fl.faction === a || fl.faction === b)) { fl.ai.siegeAi = null; fl.ai.siege = null; fl.ai.target = null; }
}

// ---------- charters (neutral villages)
function charterFactions(s) {
  return FACTIONS.filter((F) => F.id !== campaign.faction && settlementsOf(F.id).some((o) => Math.hypot(o.x - s.x, o.y - s.y) <= REL.charterReach)).map((F) => F.id);
}
function charterBlock(s) {
  if (s.faction || s.type !== 'village') return 'Only neutral villages sell charters.';
  if (!playerFleets().some((fl) => fl.docked === s.id && fl.shipIds.length)) return 'A fleet of yours must be docked here.';
  if (campaign.treasury < REL.charterPrice) return `Charter ${REL.charterPrice}; you have ${Math.floor(campaign.treasury)}.`;
  return '';
}
function buyCharter(s) {
  const why = charterBlock(s);
  if (why) return why;
  campaign.treasury -= REL.charterPrice;
  for (const fid of charterFactions(s)) addRep(fid, REL.charterRep);
  captureSettlement(s, campaign.faction);
  delete s.plunder;                                    // bought, not taken
  warCount('charters');
  campaign.journal.push(`Day ${campaign.day}: bought the charter of ${s.name}.`);
  return '';
}

// ---------- once a day (from aiDay)
// Two factions' borders are contested while a settlement of each lies within REL.borderCells.
function contested(a, b) {
  const A = settlementsOf(a), B = settlementsOf(b);
  return A.some((s) => B.some((t) => Math.hypot(s.x - t.x, s.y - t.y) <= REL.borderCells));
}
function relationsDay(news) {
  const R = relState();
  const me = campaign.faction;
  for (const fid of Object.keys(R)) {
    // Drift back towards 0.
    R[fid] += R[fid] > 0 ? -Math.min(R[fid], REL.drift) : Math.min(-R[fid], REL.drift);
    if (!settlementsOf(fid).length) continue;
    const key = relKey(me, fid), rel = relation(me, fid);
    if (rel === 'truce') {
      const t = campaign.tension[key] = contested(me, fid) ? (campaign.tension[key] || 0) + 1 : Math.max(0, (campaign.tension[key] || 0) - REL.tensionFade);
      if (R[fid] <= REL.breakRep || (t >= REL.tensionDays && R[fid] < 0)) {
        setRelation(me, fid, 'war');
        const msg = `The ${factionOf(fid).name} ended the truce (reputation ${repOf(fid)}, ${Math.round(t)} days of contested border).`;
        campaign.journal.push(`Day ${campaign.day}: ${msg}`);
        news.push(msg);
      }
    } else if (rel === 'war' && R[fid] >= REL.offerRep) {
      makeTruce(me, fid);
      const msg = `The ${factionOf(fid).name} offered a truce, and it holds (reputation ${repOf(fid)}).`;
      campaign.journal.push(`Day ${campaign.day}: ${msg}`);
      news.push(msg);
    }
  }
  // AI factions among themselves, every REL.aiDays.
  if (campaign.day % REL.aiDays) return;
  const ids = aiFactionIds().filter((f) => settlementsOf(f).length);
  const rng = aiRng(4242);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j], key = relKey(a, b);
    const border = contested(a, b);
    if (relation(a, b) === 'truce') {
      campaign.tension[key] = border ? (campaign.tension[key] || 0) + REL.aiDays : 0;
      if (campaign.tension[key] >= REL.tensionDays && rng.next() < REL.aiBreak) {
        setRelation(a, b, 'war');
        campaign.journal.push(`Day ${campaign.day}: the ${factionOf(a).name} and the ${factionOf(b).name} are at war.`);
      }
    } else if (rng.next() < (border ? REL.aiTruceBorder : REL.aiTruce)) {
      makeTruce(a, b);
      campaign.journal.push(`Day ${campaign.day}: the ${factionOf(a).name} and the ${factionOf(b).name} made a truce.`);
    }
  }
}
