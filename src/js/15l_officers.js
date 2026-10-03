/* ==== 15l OFFICERS: LEVELS, UPGRADES, DOCTRINES ==== */
// Producer's play test (v0.6.5). Your captains and admirals gain XP as before, but you level them
// up by hand on their officer card once they have enough, choosing an upgrade each time (07_data
// OFFICER_TRAITS). Captains' upgrades act on their own ship in battle and on the map; admirals'
// doctrines act on their whole fleet, and the combined-arms doctrines let aircraft and airships
// join a land or a sea fleet. The Grand Admiral's level still rises by itself (it sets Command
// Points); they choose a doctrine each time their command level rises. Other factions' officers
// level up by themselves.

const traitKind = (o) => (o.rank === 'captain' ? 'captain' : 'admiral');
const traitById = (kind, id) => OFFICER_TRAITS[kind].find((t) => t.id === id) || null;
const traitsOf = (o) => (o && o.traits ? o.traits.map((id) => traitById(traitKind(o), id)).filter(Boolean) : []);
// Sum of one effect over an officer's upgrades.
const traitSum = (o, key) => traitsOf(o).reduce((a, t) => a + (t[key] || 0), 0);

// XP needed for the next level (captains and admirals; admirals need twice a captain's).
function nextLevelXp(o) {
  if (o.rank === 'grand') return Math.round(150 * Math.pow(o.level, 1.7));
  const table = o.rank === 'admiral' ? CAPTAIN_XP.map((v) => v * 2) : CAPTAIN_XP;
  return o.level < table.length ? table[o.level] : null;
}
const canLevelUp = (o) => o.rank !== 'grand' && nextLevelXp(o) !== null && o.xp >= nextLevelXp(o);
// Upgrades still to choose: one per level above 1 (the Grand Admiral: per command level above 1).
function picksOwed(o) {
  const lv = o.rank === 'grand' ? commandLevel(o) : o.level;
  return Math.max(0, lv - 1 - (o.traits ? o.traits.length : 0));
}
// The upgrades an officer may still take.
function traitChoices(o) {
  const kind = traitKind(o), have = o.traits || [];
  return OFFICER_TRAITS[kind].filter((t) => have.filter((x) => x === t.id).length < TRAIT_STACK[kind]);
}
function takeTrait(o, id) {
  if (!traitChoices(o).some((t) => t.id === id)) return 'Not available.';
  (o.traits = o.traits || []).push(id);
  return '';
}
// Level up by hand: the next level and an upgrade.
function levelUp(o, traitId) {
  if (!canLevelUp(o)) return o.rank === 'grand' ? 'The Grand Admiral rises by XP alone.' : `Needs ${nextLevelXp(o) === null ? 'nothing: top level' : `${nextLevelXp(o)} XP`}.`;
  if (picksOwed(o) > 0) return 'Choose the upgrades already owed first.';
  const choices = traitChoices(o);
  if (choices.length && !choices.some((t) => t.id === traitId)) return 'Choose an upgrade.';
  o.level++;
  if (choices.length) (o.traits = o.traits || []).push(traitId);
  campaign.journal.push(`Day ${campaign.day}: ${o.rank === 'admiral' ? 'Adm.' : 'Capt.'} ${o.name} reached level ${o.level}${choices.length ? ` (${traitById(traitKind(o), traitId).name})` : ''}.`);
  return '';
}

// ---------- effects
// Doctrine effects of a fleet's commander.
const fleetDoctrine = (fl, key) => traitSum(fleetAdmiral(fl), key);
// Which domains a fleet takes: its own, and air with a combined-arms doctrine.
function fleetAccepts(fl, domain) {
  if (domain === fl.domain) return true;
  return domain === 'air' && traitsOf(fleetAdmiral(fl)).some((t) => t.mix === fl.domain);
}
// A captain's effect on their ship in battle (from applyCaptain).
function applyTraits(V, ship) {
  const cap = ship && byId('officers', ship.captainId);
  const fl = ship && ship.fleetId && byId('fleets', ship.fleetId);
  const acc = traitSum(cap, 'acc') + (fl ? fleetDoctrine(fl, 'acc') : 0);
  V.ai.accuracy *= 1 + acc;
  V.ai.reaction *= Math.max(0.4, 1 - traitSum(cap, 'react'));
  V.reloadRate = 1 + traitSum(cap, 'reload');
}
// A ship's map burn multiplier from its captain.
const shipBurnMul = (ship) => 1 - traitSum(byId('officers', ship.captainId), 'burn');

// ---------- recruits with upgrades already
// The upgrades a recruit brings: one per level above 1, and sometimes one more.
function recruitTraits(kind, level, rng) {
  const o = { rank: kind, level, traits: [] };
  const n = level - 1 + (rng.next() < RECRUIT_GIFTED ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const c = traitChoices(o);
    if (!c.length) break;
    o.traits.push(rng.pick(c).id);
  }
  return o.traits;
}

// ---------- other factions' officers (v0.7.5)
// They level up by themselves (gainXp) and take an upgrade for each level, picked by a seeded roll.
function aiTakeTraits(o) {
  if (o.rank === 'grand') return;
  let n = picksOwed(o);
  if (n <= 0) return;
  let h = 0;
  for (const ch of String(o.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = makeRng((campaign.seed ^ h ^ (o.level * 7919)) >>> 0);
  while (n-- > 0) {
    const c = traitChoices(o);
    if (!c.length) break;
    (o.traits = o.traits || []).push(rng.pick(c).id);
  }
}
// What you can learn of another faction's fleet's officers: levels and upgrades.
function enemyOfficerFacts(fl) {
  const a = fleetAdmiral(fl);
  const caps = fleetShips(fl).map((sh) => byId('officers', sh.captainId)).filter((o) => o && o.rank === 'captain');
  return {
    admiral: a ? `Adm. ${a.name} L${a.level}${a.traits && a.traits.length ? ` · ${traitsOf(a).map((t) => t.name).join(', ')}` : ''}` : 'none',
    captains: caps.length ? caps.map((o) => `L${o.level}${o.traits && o.traits.length ? ` (${traitsOf(o).map((t) => t.name).join(', ')})` : ''}`).join(' · ') : 'none',
  };
}
