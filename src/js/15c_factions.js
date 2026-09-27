/* ==== 15c FACTIONS ==== */
// The campaign clock, fog of war, contacts and the factions' strategic AI (design/01 §2.2,
// §6, §13; design/09). One in-game hour per second at 1×. The clock stops itself on contact,
// arrival and low fuel. Part 3 AI: each AI fleet patrols its faction's settlements and, from
// day 2, intercepts a player fleet it can see and thinks it can beat. AI fleets don't burn
// map fuel yet (their logistics come with the economy in Part 4), and AI factions don't fight
// each other on the map yet.

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
  // Intercept a visible player fleet it can beat, from day 2.
  if (campaign.day >= 2) {
    let best = null, bd = 26;
    for (const P of playerFleets()) {
      if (!P.shipIds.length || relation(fl.faction, P.faction) !== 'war') continue;
      const d = Math.hypot(P.x - fl.x, P.y - fl.y);
      if (d < bd && fleetStrength(fl) >= fleetStrength(P) * 0.7) {
        const plan = fleetPath(world, fl.domain, fl.x, fl.y, P.x, P.y);
        if (plan) { best = { P, plan }; bd = d; }
      }
    }
    if (best) { fl.path = best.plan; fl.ai.target = best.P.id; return; }
  }
  fl.ai.target = null;
  if (fl.path.length) return;
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
      if (mine) { if (stepFleet(fl, dt) === 'arrived') events.push({ stop: true, msg: `${fl.name} arrived${fl.docked ? ` at ${byId('settlements', fl.docked).name}` : ''}.` }); }
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
    updateVisibility();
    // Contact (01 §6, §10.1): a player fleet meets a hostile fleet.
    for (const P of playerFleets()) {
      if (!P.shipIds.length || P.cooldown > 0) continue;
      const E = campaign.fleets.find((fl) => fl.faction !== campaign.faction && fl.shipIds.length && !(fl.cooldown > 0) && relation(fl.faction, P.faction) === 'war' && Math.hypot(fl.x - P.x, fl.y - P.y) <= CONTACT_CELLS);
      if (E) { events.push({ stop: true, msg: `Contact: ${factionOf(E.faction).name} ${E.domain} fleet.`, contact: { mine: P.id, theirs: E.id } }); break; }
    }
    if (campaign.hour >= 24) {
      while (campaign.hour >= 24) { campaign.hour -= 24; campaign.day++; }
      const { income, wages } = dailyEconomy();
      campaign.journal.push(`Day ${campaign.day}: income ${Math.round(income)}, wages ${Math.round(wages)}.`);
      if (campaign.journal.length > 60) campaign.journal.shift();
      campaignStore.save();
    }
    if (events.some((e) => e.stop)) campaign.running = false;
  }
  return events;
}
