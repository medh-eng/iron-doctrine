/* ==== 15h FACTION STRATEGIC AI ==== */
// Part 6a (design/01 §13, design/09). Each AI faction keeps an abstract treasury (campaign.ai):
// its settlements' money each day, less upkeep per ship. It builds ships from its own designs
// within its tech tier (rising with the days), takes neutral villages (the League buys them), runs
// trade convoys that earn money and can be raided, fights the factions it is at war with (AI
// against AI resolved on the map), besieges and captures, and comes home to defend. Personalities
// (AI_PERSONA) set what each prefers. Everything here runs on the map clock; nothing is shown
// that the player couldn't see, except captures, which the journal reports.

const aiFactionIds = () => FACTIONS.map((F) => F.id).filter((id) => id !== campaign.faction);
const persona = (fid) => AI_PERSONA[fid] || AI_PERSONA.directorate;
function aiState(fid) {
  campaign.ai = campaign.ai || {};
  return campaign.ai[fid] || (campaign.ai[fid] = { money: AI.startMoney, tier: 0, built: 0, bought: 0 });
}
const aiTierOf = (fid) => Math.min(4, Math.floor(campaign.day / persona(fid).tierDays));
// Calm: this faction doesn't go looking for fights yet (the Lumen defend until strong).
const aiCalm = (fid) => campaign.day < persona(fid).calmUntil && aiTierOf(fid) < 3;
const settlementsOf = (fid) => world.settlements.filter((s) => s.faction === fid);
const fleetsOf = (fid) => campaign.fleets.filter((f) => f.faction === fid && f.shipIds.length);
const aiRng = (salt) => makeRng((campaign.seed ^ (campaign.day * 7919 + Math.floor(campaign.hour * 13) + salt)) >>> 0);
const nearestOwn = (fid, x, y) => settlementsOf(fid).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0] || null;

// A design's price to an AI faction (money only: its goods are abstracted).
function aiPrice(id) { const d = aiDesignOf(id); return d ? costOf(d) * 3 : Infinity; }

// ---------- once a day (from dailyEconomy)
function aiDay(news) {
  relationsDay(news);
  intelDay();
  aiFactionIds().forEach((fid, k) => { if ((campaign.day + k) % INTEL.reviewDays === 0 && settlementsOf(fid).length) aiReview(fid, news); });
  for (const fid of aiFactionIds()) {
    const own = settlementsOf(fid);
    if (!own.length) continue;
    const st = aiState(fid), P = persona(fid);
    const ships = campaign.ships.filter((s) => s.faction === fid).length;
    st.money += own.reduce((a, s) => a + Math.max(0, SETTLEMENT_TYPES[s.type].money), 0) - ships * AI.upkeep;
    const tier = aiTierOf(fid);
    if (tier > st.tier) { st.tier = tier; campaign.journal.push(`Day ${campaign.day}: the ${factionOf(fid).name} field tier ${tier} technology.`); }
    const rng = aiRng(fid.length * 101);
    // The League buys neutral villages near its own instead of taking them: it saves for the
    // next one (once it has two fleets out) rather than building.
    let saving = false;
    if (P.buyVillages && own.length) {
      const v = world.settlements.filter((s) => !s.faction && s.type === 'village' && own.some((o) => Math.hypot(o.x - s.x, o.y - s.y) < AI.expandReach))
        .sort((a, b) => Math.hypot(a.x - own[0].x, a.y - own[0].y) - Math.hypot(b.x - own[0].x, b.y - own[0].y))[0];
      if (v && st.money >= AI.villagePrice) { st.money -= AI.villagePrice; st.bought++; captureSettlement(v, fid); news.push(`${v.name} joined the ${factionOf(fid).name} (bought).`); }
      else if (v) saving = fleetsOf(fid).filter((f) => !f.aiConvoy).length >= 2;
    }
    if (!saving) aiBuild(fid, rng);
    aiKeepConvoys(fid, rng);
  }
}

// Build one ship if money and fleet limits allow: domain by personality, design by tier.
function aiBuild(fid, rng) {
  const st = aiState(fid), P = persona(fid), own = settlementsOf(fid);
  const yards = own.filter((s) => s.type === 'city' || s.type === 'metropolis' || s.capital);
  if (!yards.length) return;
  const weights = Object.entries(P.domains).filter(([dom]) => dom !== 'sea' || yards.some((s) => portCell(s, 'sea')));
  // The faction picks what to build next by its domain weights, then saves up for it.
  if (!st.next || !weights.some(([d]) => d === st.next.dom)) {
    let r = rng.next() * weights.reduce((a, [, w]) => a + w, 0), dom = weights[0][0];
    for (const [d, w] of weights) { r -= w; if (r <= 0) { dom = d; break; } }
    const tier = aiTierOf(fid);
    const own0 = `${fid}_${START_DESIGN_KIND[dom]}_t0`;
    const pool = tier >= 1 && AI_DESIGNS[tier] ? AI_DESIGNS[tier][dom].filter((id) => TEMPLATES[id]) : [];
    // Its own faction design of its tier (1–2; batch L1/L2), when there is one, half the time.
    // From tier 2, sometimes its large design of that domain (batch M1).
    const big = tier >= 3 && rng.next() < 0.5 ? `${fid}_${XL_DESIGN_KIND[dom]}_t3` : tier >= 2 ? `${fid}_${BIG_DESIGN_KIND[dom]}_t2` : null;
    const ownT = tier >= 1 ? `${fid}_${START_DESIGN_KIND[dom]}_t${Math.min(2, tier)}` : null;
    const id = big && TEMPLATES[big] && rng.next() < 0.25 ? big
      : ownT && TEMPLATES[ownT] && rng.next() < 0.5 ? ownT
      : pool.length && rng.next() < 0.75 ? rng.pick(pool) : TEMPLATES[own0] ? own0 : (AI_DESIGNS[1][dom] || [])[0];
    if (!id) return;
    st.next = { dom, id };
  }
  const { dom } = st.next;
  const id = aiBuildId(fid, st.next.id);                     // its latest refit of that design (6b)
  if (st.money < aiPrice(id)) return;
  st.next = null;
  const yard = rng.pick(yards.filter((s) => dom !== 'sea' || portCell(s, 'sea')));
  const at = portCell(yard, dom) || [yard.x + 0.5, yard.y + 0.5];
  // Join a fleet of that domain at this yard, or start one if the faction may have another.
  let fl = fleetsOf(fid).find((f) => f.domain === dom && !f.aiConvoy && f.shipIds.length < AI.fleetMax && Math.hypot(f.x - at[0], f.y - at[1]) < 4);
  const maxFleets = AI.fleetsBase + Math.floor(own.length / AI.fleetsPerSettlements);
  if (!fl && fleetsOf(fid).filter((f) => !f.aiConvoy).length >= maxFleets) {
    // No room for another fleet: the new ship joins the yard's garrison instead.
    const s = makeShip(id, fid, rng);
    s.garrison = yard.id; byId('officers', s.captainId).garrisonedAt = yard.id;
  } else if (!fl) {
    fl = makeFleet(fid, dom, at[0], at[1], [id], rng);
    fl.docked = yard.id;
  } else {
    const s = makeShip(id, fid, rng);
    s.fleetId = fl.id; byId('officers', s.captainId).fleetId = fl.id; fl.shipIds.push(s.id);
  }
  st.money -= aiPrice(id);
  st.built++;
  st.byDomain = st.byDomain || { land: 0, sea: 0, air: 0 };
  st.byDomain[dom]++;
}

// Trade convoys between two of the faction's settlements: they earn money on each delivery.
function aiKeepConvoys(fid, rng) {
  const own = settlementsOf(fid);
  const want = own.length >= 2 ? persona(fid).convoys : 0;
  const have = fleetsOf(fid).filter((f) => f.aiConvoy).length;
  if (have >= want || aiState(fid).money < 150) return;
  const a = rng.pick(own), b = rng.pick(own.filter((s) => s !== a));
  for (const dom of ['land', 'sea']) {
    const pa = portCell(a, dom), pb = portCell(b, dom);
    if (!pa || !pb || !fleetPath(world, dom, pa[0], pa[1], pb[0], pb[1])) continue;
    const fl = makeFleet(fid, dom, pa[0], pa[1], AI_CONVOY[dom], rng);
    fl.aiConvoy = { a: a.id, b: b.id, to: 'b' };
    fl.name = `${factionOf(fid).name} convoy`;
    aiState(fid).money -= 150;
    return;
  }
}

// ---------- fleet thinking (from aiThink)
function aiConvoyThink(fl) {
  const c = fl.aiConvoy;
  const to = byId('settlements', c.to === 'b' ? c.b : c.a);
  if (!to || to.faction !== fl.faction) { c.to = c.to === 'b' ? 'a' : 'b'; return; }
  const at = portCell(to, fl.domain);
  if (!at) return;
  if (Math.hypot(fl.x - at[0], fl.y - at[1]) < 1) {
    aiState(fl.faction).money += AI.convoyIncome;
    c.to = c.to === 'b' ? 'a' : 'b';
    c.trips = (c.trips || 0) + 1;
    return;
  }
  if (!fl.path.length) { const p = fleetPath(world, fl.domain, fl.x, fl.y, at[0], at[1]); if (p) fl.path = p; }
}

// Defend: an enemy fleet near our settlements (the capital first) draws the nearest fleets home.
function aiDefend(fl) {
  if (fl.domain === 'air' && persona(fl.faction).raid > 1.5) return false;   // raiders don't garrison
  let best = null, bd = Infinity;
  for (const s of settlementsOf(fl.faction)) {
    for (const E of campaign.fleets) {
      if (!E.shipIds.length || relation(fl.faction, E.faction) !== 'war' || E.aiConvoy) continue;
      const d = Math.hypot(E.x - s.x, E.y - s.y);
      if (d > AI.defendReach * (s.capital ? 1.5 : 1)) continue;
      const k = d * (s.capital ? 0.5 : 1) + Math.hypot(fl.x - E.x, fl.y - E.y) * 0.3;
      if (k < bd && (s.capital || fleetStrength(fl) >= fleetStrength(E) * 0.6)) { bd = k; best = E; }
    }
  }
  if (!best || Math.hypot(fl.x - best.x, fl.y - best.y) > 30) return false;
  const plan = fleetPath(world, fl.domain, fl.x, fl.y, best.x, best.y);
  if (!plan) return false;
  fl.path = plan; fl.ai.target = best.id; fl.ai.defending = true;
  return true;
}

// Hunt: the enemy fleet (yours or another faction's) it most wants and can beat: convoys and
// stranded fleets look closer to raiders, damaged ones to scavengers.
function aiHunt(fl) {
  const P = persona(fl.faction), mine = fleetStrength(fl);
  let best = null, bd = 26;
  for (const E of campaign.fleets) {
    if (!E.shipIds.length || E === fl || relation(fl.faction, E.faction) !== 'war') continue;
    let d = Math.hypot(E.x - fl.x, E.y - fl.y);
    if (E.convoy || E.aiConvoy || E.stranded) d *= RAID_PULL / P.raid;
    if (P.prey) { const h = fleetShips(E).reduce((a, s) => a + shipHealth(s), 0) / Math.max(1, E.shipIds.length); d *= 1 - Math.min(0.8, P.prey * (1 - h)); }
    if (d >= bd || mine < fleetStrength(E) * P.intercept) continue;
    const plan = fleetPath(world, fl.domain, fl.x, fl.y, E.x, E.y);
    if (plan) { best = { E, plan }; bd = d; }
  }
  if (!best) return false;
  fl.path = best.plan; fl.ai.target = best.E.id;
  return true;
}

// Besiege another AI faction's settlement it is strong enough for (yours: aiSiegeTarget).
function aiSiegeAI(fl) {
  const P = persona(fl.faction);
  if (campaign.day < P.siegeFrom || fl.domain !== 'land' || (fl.ai.restUntil || 0) > hoursNow()) return false;
  let best = null, bd = 30;
  for (const s of world.settlements) {
    if (!s.faction || s.faction === campaign.faction || relation(fl.faction, s.faction) !== 'war') continue;
    const d = Math.hypot(s.x - fl.x, s.y - fl.y);
    if (d < bd && fleetStrength(fl) >= defenceStrength(s) * P.edge) { best = s; bd = d; }
  }
  const at = best && portCell(best, 'land');
  const plan = at && fleetPath(world, fl.domain, fl.x, fl.y, at[0], at[1]);
  if (!plan) return false;
  fl.path = plan; fl.ai.siegeAi = best.id;
  return true;
}

// Expand: take an unguarded neutral settlement nearby (land and air fleets).
function aiExpand(fl) {
  if (fl.domain === 'sea') return false;
  let best = null, bd = AI.expandReach;
  for (const s of world.settlements) {
    if (s.faction || (s.type === 'village' && persona(fl.faction).buyVillages)) continue;
    const d = Math.hypot(s.x - fl.x, s.y - fl.y);
    if (d < bd && fleetStrength(fl) >= defenceStrength(s) * 0.8) { best = s; bd = d; }
  }
  const at = best && portCell(best, fl.domain === 'air' ? 'air' : 'land');
  const plan = at && fleetPath(world, fl.domain, fl.x, fl.y, at[0], at[1]);
  if (!plan) return false;
  fl.path = plan; fl.ai.expand = best.id;
  return true;
}

// ---------- on the map clock (from campaignTick)
// Fleets that reached what they marched on: take a neutral settlement, or besiege an AI one.
function aiArrivals(news) {
  for (const fl of campaign.fleets) {
    if (!fl.ai || !fl.shipIds.length) continue;
    for (const key of ['expand', 'siegeAi']) {
      const id = fl.ai[key];
      if (!id) continue;
      const s = byId('settlements', id);
      const still = s && (key === 'expand' ? !s.faction : s.faction && s.faction !== campaign.faction && relation(fl.faction, s.faction) === 'war');
      if (!still) { fl.ai[key] = null; continue; }
      if (Math.hypot(fl.x - s.x - 0.5, fl.y - s.y - 0.5) > 1.6) continue;
      fl.ai[key] = null;
      fl.path = [];
      if (key === 'expand') { const m = captureSettlement(s, fl.faction); if (nearPlayer(s.x, s.y)) news.push(m); continue; }
      news.push(aiSiegeResolve(fl, s));
    }
  }
}
const nearPlayer = (x, y) => (campaign.eyes || []).some(([ex, ey, r]) => Math.hypot(ex - x, ey - y) <= r);

// An AI siege of another AI faction's settlement, settled on the map: strength against the walls,
// keep and garrison. Either way the fleet loses ships and rests.
function aiSiegeResolve(fl, s) {
  const rng = aiRng(s.x * 17 + s.y);
  const atk = fleetStrength(fl) * rng.range(0.8, 1.2), def = defenceStrength(s);
  const won = atk > def;
  aiLosses(fl, (won ? 0.5 : 1) * AI.clashLoss * def / (atk + def), rng);
  fl.ai.restUntil = hoursNow() + SIEGE.aiRest;
  if (won && fl.shipIds.length) return captureSettlement(s, fl.faction);
  const msg = `The ${factionOf(fl.faction).name} failed to take ${s.name}.`;
  campaign.journal.push(`Day ${campaign.day}: ${msg}`);
  return msg;
}

// Each ship of fl is lost with chance p.
function aiLosses(fl, p, rng) {
  for (const id of fl.shipIds.slice()) if (rng.next() < p) removeShip(byId('ships', id), rng);
  if (!fl.shipIds.length) fleetLost(fl);
}

// AI fleets at war that meet fight it out on the map (01 §13): each side's ships are lost in
// proportion to the other side's share of the strength; the weaker side falls back.
function aiClashes(news) {
  const list = campaign.fleets.filter((f) => f.faction !== campaign.faction && f.shipIds.length && !(f.cooldown > 0));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j];
      if (!A.shipIds.length || !B.shipIds.length || relation(A.faction, B.faction) !== 'war') continue;
      if (Math.hypot(A.x - B.x, A.y - B.y) > CONTACT_CELLS) continue;
      const rng = aiRng(i * 31 + j);
      const sA = fleetStrength(A) * rng.range(0.85, 1.15), sB = fleetStrength(B) * rng.range(0.85, 1.15);
      aiLosses(A, AI.clashLoss * sB / (sA + sB), rng);
      aiLosses(B, AI.clashLoss * sA / (sA + sB), rng);
      campaign.aiClashes = (campaign.aiClashes || 0) + 1;
      A.cooldown = B.cooldown = AI.clashCooldown;
      const loser = sA < sB ? A : B;
      const home = loser.shipIds.length && nearestOwn(loser.faction, loser.x, loser.y);
      const at = home && portCell(home, loser.domain);
      if (at) { const p = fleetPath(world, loser.domain, loser.x, loser.y, at[0], at[1]); if (p) loser.path = p; }
      if (nearPlayer(A.x, A.y)) news.push(`The ${factionOf(A.faction).name} and the ${factionOf(B.faction).name} fought nearby.`);
    }
  }
}
