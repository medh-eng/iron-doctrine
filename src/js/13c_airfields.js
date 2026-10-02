/* ==== 13c AIRFIELDS IN CAMPAIGN BATTLES ==== */
// Part 5c3 (design/01 §5, roadmap 5c3; v0.7.0). A campaign battle within AIRFIELD.reach cells of
// a city, metropolis, fort or citadel lets that settlement's owner send aircraft in from their own
// edge of the field, as an air wing with no carrier: yours are the aircraft stored in that
// settlement's warehouse (built at a yard for air wings), up to AIRFIELD.max, and the ones that
// survive go back to the warehouse; an AI faction from tech tier AIRFIELD.aiTier sends
// AIRFIELD.aiWing fighters. They don't count towards the three on the field or the win.

// The airfield nearest the battle for each side, if any.
function battleAirfields(sides) {
  const at = sides.myFleets[0] || sides.theirFleets[0];
  if (!at) return [];
  const near = (fid) => world.settlements
    .filter((s) => s.faction === fid && AIRFIELD.types.includes(s.type) && Math.hypot(s.x + 0.5 - at.x, s.y + 0.5 - at.y) <= AIRFIELD.reach)
    .sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y))[0] || null;
  const out = [];
  const mine = near(campaign.faction);
  if (mine) {
    // The aircraft type the warehouse holds most of.
    const stock = Object.entries(stockAt(mine.store, 'wings')).filter(([id, n]) => n > 0 && wingDesignOf(id)).sort((a, b) => b[1] - a[1])[0];
    if (stock) out.push({ side: 0, s: mine, id: stock[0], n: Math.min(AIRFIELD.max, stock[1]) });
  }
  const foe = sides.theirFleets[0] && sides.theirFleets[0].faction;
  const theirs = foe && foe !== campaign.faction && aiTierOf(foe) >= AIRFIELD.aiTier ? near(foe) : null;
  if (theirs) out.push({ side: 1, s: theirs, id: DEFAULT_WING, n: AIRFIELD.aiWing });
  return out;
}

// Each airfield is a carrier that never enters the field: it sits just off its side's edge.
function setupAirfields(B, list) {
  B.airfields = [];
  for (const a of list) {
    const d = wingDesignOf(a.id);
    if (!d || a.n <= 0) continue;
    if (a.side === 0) takeStock(a.s, 'wings', a.id, a.n);       // they leave the warehouse
    const x = a.side === 0 ? -15 : B.T.length + 15;
    B.airfields.push({
      airfield: true, side: a.side, dir: a.side === 0 ? 1 : -1, name: a.s.name, settlement: a.s.id, wingId: a.id,
      body: { x, y: B.T.height(clamp(x, 0, B.T.length)) + 35, vx: 0, vy: 0, a: 0 }, height: 0,
      seen: a.side === 0, droneOrder: 'attack', wingCap: a.n, wingAboard: a.n, wingRate: AIRFIELD.rate, wingT: AIRFIELD.delay,
      wingDesign: d, destroyed: false, gone: false, withdrawn: false, empT: 0, launched: 0,
    });
  }
}

// After the battle: your aircraft still aboard or in the air go back to the warehouse.
function airfieldsAfterBattle(B) {
  let note = '';
  for (const C of B.airfields || []) {
    if (C.side !== 0) continue;
    let back = C.wingAboard;
    for (const U of B.units) if (U.wing === C && !U.destroyed) back++;
    const s = byId('settlements', C.settlement);
    if (s && back > 0) { const st = stockAt(s.store, 'wings'); st[C.wingId] = (st[C.wingId] || 0) + back; }
    note += ` Air support from ${C.name}: ${C.wingCap - back} of ${C.wingCap} aircraft lost.`;
  }
  return note;
}
