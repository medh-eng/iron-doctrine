/* ==== 15k FLAGSHIPS ==== */
// Every fleet's admiral (your Grand Admiral too) rides in one of its ships: the flagship
// (design/01 §4.2; producer's play test, v0.6.5). It goes onto the field first and flies a
// pennant; you start a battle driving your Grand Admiral's. Its crew fights at the admiral's
// command level when that's above its captain's. The admiral picks the flagship among the classes
// their level allows (your choice on the fleet panel). When a flagship is destroyed the admiral
// escapes to another ship of the fleet; the Grand Admiral's escape costs 20% of the treasury and
// 10% of the XP towards the next level (01 §14).

function flagshipAllowed(fl, ship) {
  const c = classById(shipStats(ship).cls);
  return !isSupport(ship) && (!c || c.captain <= commandLevel(fleetAdmiral(fl)));
}
function bestFlagship(fl) {
  const ships = fleetShips(fl).filter((s) => !isSupport(s));
  const ok = ships.filter((s) => flagshipAllowed(fl, s));
  return (ok.length ? ok : ships).sort((a, b) => shipStats(b).cost - shipStats(a).cost)[0] || fleetShips(fl)[0] || null;
}
// The fleet's flagship (chosen when there is none, e.g. in an older save).
function flagshipOf(fl) {
  if (!fl || !fl.admiralId || !fl.shipIds.length) return null;
  if (fl.flagshipId && fl.shipIds.includes(fl.flagshipId)) return byId('ships', fl.flagshipId);
  const pick = bestFlagship(fl);
  fl.flagshipId = pick ? pick.id : null;
  return pick;
}
const isFlagship = (ship) => { const fl = ship && ship.fleetId && byId('fleets', ship.fleetId); return !!fl && flagshipOf(fl) === ship; };
function setFlagship(fl, ship) {
  if (!fl.shipIds.includes(ship.id)) return 'Not in this fleet.';
  if (isSupport(ship)) return 'A support vehicle can’t carry the flag.';
  if (!flagshipAllowed(fl, ship)) return `${shipStats(ship).clsName} is above what the admiral's level commands.`;
  fl.flagshipId = ship.id;
  return '';
}
// A fleet's ships in battle order: the flagship first, support vehicles last.
function battleOrder(fl) {
  const f = flagshipOf(fl);
  const ships = fleetShips(fl);
  const rank = (s) => (s === f ? 0 : isSupport(s) ? 2 : 1);
  return ships.map((s, i) => [s, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((e) => e[0]);
}

// The Grand Admiral escaping a lost flagship or fleet (01 §14): 20% of the treasury, 10% of the XP
// towards the next level.
function gaEscapePenalty() {
  campaign.treasury *= 0.8;
  const ga = grandAdmiral();
  if (!ga) return;
  // XP made since the current level was reached (the level itself is kept).
  const prev = ga.level > 1 ? Math.round(150 * Math.pow(ga.level - 1, 1.7)) : 0;
  ga.xp -= 0.1 * Math.max(0, ga.xp - prev);
}

// After a battle (applyBattleOutcome): fleets whose flagship went down but that still have ships.
function flagshipsAfterBattle(before, news) {
  for (const [fl, id] of before) {
    if (!id || !fl.shipIds.length || fl.shipIds.includes(id)) continue;
    fl.flagshipId = null;
    const next = flagshipOf(fl);
    const adm = fleetAdmiral(fl);
    if (!adm || !next) continue;
    if (fl.faction === campaign.faction) {
      const grand = adm.id === campaign.ga;
      if (grand) gaEscapePenalty();
      const msg = `${grand ? 'The Grand Admiral' : `Adm. ${adm.name}`} escaped the lost flagship to the ${shipStats(next).name}${grand ? ' (treasury −20%, XP −10% to the next level)' : ''}.`;
      campaign.journal.push(`Day ${campaign.day}: ${msg}`);
      news.push(msg);
    }
  }
}
