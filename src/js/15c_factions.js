/* ==== 15c FACTIONS ==== */
// The campaign clock, fog of war, contacts and the factions' strategic AI (design/01 §2.2,
// §6, §13; design/09). One in-game hour per second at 1×. The clock stops itself on contact,
// arrival and low fuel. AI fleets patrol their faction's settlements; from day 2 they intercept
// a player fleet they can see and think they can beat (convoys first: raiding); from day 4 a
// strong land fleet marches on a weakly held settlement of yours and besieges it. AI fleets
// don't burn map fuel yet. Part 6a (15h) adds AI economies, building, expansion, convoys,
// AI-against-AI war, defence of home and personalities.

const TICK_HOURS = 0.25;          // campaign sub-step
const AI_THINK_HOURS = 3;
const CONTACT_COOLDOWN = 4;       // hours after a battle before the same fleets meet again

// A fleet's fighting strength: Σ ship cost × condition.
function fleetStrength(fl) {
  let s = 0;
  for (const sh of fleetShips(fl)) s += shipStats(sh).cost * shipHealth(sh);
  return s;
}
function shipHealth(sh) {
  if (!sh.hp) return 1;
  let a = 0;
  for (const v of sh.hp) a += v;
  return sh.hp.length ? a / sh.hp.length : 1;
}

// Fog of war (01 §2.2): enemy fleets are seen within reach of your fleets and settlements.
function updateVisibility() {
  const eyes = [];
  for (const fl of playerFleets()) if (fl.shipIds.length) eyes.push([fl.x, fl.y, DETECT_CELLS.fleet * (fl.domain === 'air' ? 1.3 : 1)]);
  for (const s of world.settlements) if (s.faction === campaign.faction) eyes.push([s.x + 0.5, s.y + 0.5, DETECT_CELLS.settlement]);
  campaign.eyes = eyes;
  for (const fl of campaign.fleets) {
    if (fl.faction === campaign.faction) { fl.seen = true; continue; }
    fl.seen = eyes.some(([x, y, r]) => Math.hypot(fl.x - x, fl.y - y) <= r);
  }
}

function aiThink(fl) {
  if (!fl.shipIds.length) return;
  const rng = makeRng(campaign.seed + campaign.day * 131 + Math.floor(campaign.hour) * 7 + fl.id.length * 31 + fl.shipIds.length);
  // AI fleets top up at their own settlements (abstracted until Part 4).
  for (const s of fleetShips(fl)) { s.fuel = shipStats(s).fuelCap; s.ammo = 1; }
  // Part 6a (15h): convoys run their route; fleets defend home, then hunt, besiege, expand.
  if (fl.aiConvoy) { aiConvoyThink(fl); return; }
  if (fl.ai.expand || fl.ai.siegeAi) { if (fl.path.length) return; }
  fl.ai.defending = false;
  if (aiDefend(fl)) return;
  const calm = aiCalm(fl.faction);
  // Hunt an enemy fleet it can beat (yours or another faction's), from day 2.
  if (campaign.day >= 2 && !calm && aiHunt(fl)) return;
  fl.ai.target = null;
  // Besiege a weakly held settlement of yours (01 §11, §13).
  if (calm) {
    // The Lumen and other calm factions stay at home.
  } else if (!fl.ai.siege) {
    const t = aiSiegeTarget(fl);
    const at = t && portCell(t, 'land');
    const plan = at && fleetPath(world, fl.domain, fl.x, fl.y, at[0], at[1]);
    if (plan) { fl.path = plan; fl.ai.siege = t.id; return; }
  } else {
    const t = byId('settlements', fl.ai.siege);
    if (t && t.faction === campaign.faction) { if (!fl.path.length) { const p = fleetPath(world, fl.domain, fl.x, fl.y, t.x + 0.5, t.y + 0.5); if (p) fl.path = p; } return; }
    fl.ai.siege = null;
  }
  if (fl.path.length) return;
  // Another AI faction's settlement to besiege, or a neutral one to take.
  if (!calm && aiSiegeAI(fl)) return;
  if (aiExpand(fl)) return;
  // Patrol: another settlement of its own faction.
  const own = world.settlements.filter((s) => s.faction === fl.faction);
  const s = rng.pick(own);
  if (!s) return;
  const at = portCell(s, fl.domain);
  if (!at) return;
  const plan = fleetPath(world, fl.domain, fl.x, fl.y, at[0], at[1]);
  if (plan) fl.path = plan;
}

// Advance the campaign by real seconds × speed. Returns events: { stop, msg, contact? }.
function campaignTick(dtReal) {
  const events = [];
  if (!campaign.running) return events;
  let hours = dtReal * (campaign.speed || 1);             // 1 in-game hour per second × 1, 3 or 10
  while (hours > 1e-6 && campaign.running) {
    const dt = Math.min(TICK_HOURS, hours);
    hours -= dt;
    campaign.hour += dt;
    stepWeather(dt);
    for (const fl of campaign.fleets) {
      if (fl.cooldown > 0) fl.cooldown -= dt;
      const mine = fl.faction === campaign.faction;
      const f0 = mine ? fleetFuel(fl) : null;
      if (mine) { if (stepFleet(fl, dt) === 'arrived' && !fl.route) events.push({ stop: true, msg: `${fl.name} arrived${fl.docked ? ` at ${byId('settlements', fl.docked).name}` : ''}.` }); }
      else {
        const keep = fl.shipIds.map((id) => byId('ships', id).fuel);
        stepFleet(fl, dt);
        fleetShips(fl).forEach((s, i) => { s.fuel = keep[i]; });
        fl.ai.t = (fl.ai.t || 0) - dt;
        if (fl.ai.t <= 0) { fl.ai.t = AI_THINK_HOURS; aiThink(fl); }
      }
      if (mine && f0 && f0.cap) {
        const f1 = fleetFuel(fl);
        if (f0.fuel / f0.cap >= LOW_FUEL && f1.fuel / f1.cap < LOW_FUEL) events.push({ stop: true, msg: `${fl.name}: fuel below ${Math.round(LOW_FUEL * 100)}%.` });
        if (f1.fuel <= 0 && f0.fuel > 0) events.push({ stop: true, msg: `${fl.name} is stranded: no fuel.` });
      }
    }
    for (const fl of playerFleets()) if (!fl.path.length) fieldRepair(fl, dt);
    stepSalvage(dt);
    for (const n of stepConvoys(dt)) { campaign.journal.push(`Day ${campaign.day}: ${n}`); events.push({ msg: n }); }
    for (const n of stepWorks(dt)) { campaign.journal.push(`Day ${campaign.day}: ${n}`); events.push({ msg: n }); }
    updateVisibility();
    // Contact (01 §6, §10.1): a player fleet meets a hostile fleet.
    for (const P of playerFleets()) {
      if (!P.shipIds.length || P.cooldown > 0) continue;
      const E = campaign.fleets.find((fl) => fl.faction !== campaign.faction && fl.shipIds.length && !(fl.cooldown > 0) && relation(fl.faction, P.faction) === 'war' && Math.hypot(fl.x - P.x, fl.y - P.y) <= CONTACT_CELLS);
      if (E) { events.push({ stop: true, msg: `Contact: ${factionOf(E.faction).name} ${E.domain} fleet.`, contact: { mine: P.id, theirs: E.id } }); break; }
    }
    // AI fleets taking neutral settlements, besieging each other, and meeting in battle (6a).
    if (!events.some((e) => e.contact)) {
      const news = [];
      aiArrivals(news);
      aiClashes(news);
      for (const m of news) events.push({ msg: m });
    }
    // An AI fleet reaching the settlement it marched on lays siege.
    if (!events.some((e) => e.contact)) for (const fl of campaign.fleets) {
      if (!fl.ai || !fl.ai.siege || !fl.shipIds.length) continue;
      const s = byId('settlements', fl.ai.siege);
      if (!s || s.faction !== campaign.faction) { fl.ai.siege = null; continue; }
      if (Math.hypot(fl.x - s.x - 0.5, fl.y - s.y - 0.5) > 1.6) continue;
      fl.ai.siege = null; fl.ai.restUntil = hoursNow() + SIEGE.aiRest; fl.path = [];
      events.push({ stop: true, msg: `${s.name} is under siege by the ${factionOf(fl.faction).name}.`, contact: { siege: s.id, fleet: fl.id, defend: true } });
      break;
    }
    if (campaign.hour >= 24) {
      while (campaign.hour >= 24) { campaign.hour -= 24; campaign.day++; }
      const { income, wages, news } = dailyEconomy();
      campaign.journal.push(`Day ${campaign.day}: income ${Math.round(income)}, wages ${Math.round(wages)}.`);
      for (const n of news) { campaign.journal.push(`Day ${campaign.day}: ${n}`); events.push({ msg: n }); }
      // Medals and the end of the war (6d); these write their own journal entries.
      const late = [];
      awardMedals(late);
      if (checkWarEnd(late)) events.push({ stop: true, over: true });
      for (const n of late) events.push({ msg: n });
      while (campaign.journal.length > JOURNAL_MAX) campaign.journal.shift();
      campaignStore.save();
    }
    if (events.some((e) => e.stop)) campaign.running = false;
  }
  return events;
}
