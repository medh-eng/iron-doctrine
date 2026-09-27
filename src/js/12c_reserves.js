/* ==== 12c RESERVES ==== */
// Three on the field (design/01 §10.3). In battles created with opts.reserves (the Battle
// Simulator; later the campaign) each side keeps at most FIELD_MAX ships in battle. The rest
// wait in line and enter from their own rear edge ENTRY_DELAY seconds after a slot frees up:
// a ship destroyed, or pulled back off the rear edge. Pulled-back ships keep their damage,
// fuel and shells and join the end of the line. A side loses when it has no ship on the
// field, none on the way in and none in reserve. The Gauntlet keeps its v1 waves.

const FIELD_MAX = 3;
const ENTRY_DELAY = 5;            // seconds between a slot freeing up and the next ship entering
const EDGE_EXIT = 6;              // metres from the rear edge at which a pulling-back ship leaves
const AIR_EXIT_SECS = 3;          // aircraft pulling back fly off after this long
const ENEMY_PULL_HEALTH = 0.35;   // enemy captains pull back below this share of hit points

function vehicleHealth(V) {
  let hp = 0;
  for (const p of V.parts) if (p.alive) hp += p.hp;
  return V.hpMax ? hp / V.hpMax : 0;
}

// A reserve entry: the design, plus the state of a ship that has pulled back.
function reserveEntry(design, V) {
  const e = { design, name: markName(design), health: 1, hp: null, fuel: null, shells: null };
  if (!V && design._state && design._state.hp) {
    let a = 0, b = 0;
    design.cells.forEach((c, i) => { a += design._state.hp[i]; b += PARTS[c.p].hp; });
    e.health = b ? a / b : 1;
  }
  if (V) {
    e.hp = V.parts.map((p) => (p.alive ? p.hp : 0));
    e.health = vehicleHealth(V);
    e.fuel = V.fuel; e.shells = V.shells;
  }
  return e;
}

// Can this design fight on this battlefield? (ships need sea; sea battles take no land units)
function canDeploy(B, d) {
  const naval = seaDomain(domainOf(d));
  if (naval && B.T.seaX0 === undefined) return false;
  if (!naval && B.cfg.fleet && !airDomain(domainOf(d))) return false;
  return true;
}

function setupReserves(B, squadRest, enemyRest) {
  B.rotation = true;
  B.reserve = [squadRest.filter((d) => canDeploy(B, d)).map((d) => reserveEntry(d)), enemyRest.filter((d) => canDeploy(B, d)).map((d) => reserveEntry(d))];
  B.entering = [];
  B.pulledBack = [0, 0];
  B.lostShips = [];
}

// Where a side's reinforcements enter: their own rear edge, in their own layer.
function entryX(B, side, d) {
  const T = B.T, dom = domainOf(d);
  const L = cropDesign(d).w * CELL;
  if (side === 0) {
    if (airDomain(dom)) return 30;
    if (seaDomain(dom)) return T.seaX0 + 10 + L / 2;
    return 14;
  }
  if (airDomain(dom)) return T.length - 30;
  if (seaDomain(dom)) return T.length - 10 - L / 2;
  return T.seaX0 !== undefined ? T.seaX0 - 14 : T.length - 14;
}

function restoreDamage(V, e) {
  if (!e.hp) return;
  let lost = false;
  V.parts.forEach((p, i) => {
    if (e.hp[i] <= 0) { p.alive = false; V.alive[i] = 0; lost = true; } else p.hp = e.hp[i];
  });
  if (lost) rebuildVehicle(V);
  if (e.fuel !== null) V.fuel = e.fuel;
  if (e.shells !== null) V.shells = e.shells;
}

function enterFromReserve(B, side, slot) {
  const e = B.reserve[side].shift();
  if (!e) return null;
  const x = entryX(B, side, e.design);
  let V;
  if (side === 0) {
    V = makeVehicle(e.design, 0, x, 1, B.T);
    if (V.flier) launchFlier(V, B.T, V.domain === 'heli' ? 18 : V.domain === 'airship' ? AIRSHIP_ALT : 45);
    V.ai = makeAI('squad', B.cfg);
    V.label = String(slot + 1);
    B.units.push(V);
    B.squad[slot] = V;
    if (B.me.destroyed || B.me.withdrawn) takeVehicle(B, V);
  } else {
    V = spawnEnemy(B, e.design, 'attack', x);
    B.enemySlots[slot] = V;
  }
  restoreDamage(V, e);
  if (!e.hp) applyShipState(V);        // a campaign ship's damage, fuel and ammo
  if (!B.demo) floatText(side === 0 ? `${V.name} enters` : 'Enemy reinforcement', V.body.x, V.body.y + V.height + 1.5, side === 1);
  return V;
}

// Order a ship back to reserve (design/02 §3.4 "Pull back"). Returns a reason when it can't.
function pullBack(B, V) {
  if (!B.rotation) return 'No reserve line in this battle';
  if (V.destroyed || V.withdrawn) return 'Out of action';
  if (V.pulling) return '';
  V.pulling = true;
  V.pullT = 0;
  V.ai.hold = null;
  V.ai.fireAt = null;
  if (V === B.me) {
    const next = B.squad.find((U) => U !== V && !U.destroyed && !U.pulling);
    if (next) takeVehicle(B, next);
  }
  return '';
}

function withdraw(B, V) {
  const side = V.side;
  B.reserve[side].push(reserveEntry(V.design, V));
  B.pulledBack[side]++;
  V.withdrawn = true;
  V.destroyed = true;              // out of the fight: no longer targeted or simulated
  V.gone = true;
  V.throttle = 0;
  const i = B.units.indexOf(V);
  if (i >= 0) B.units.splice(i, 1);
  if (B.target === V) B.target = null;
  const slots = side === 0 ? B.squad : B.enemySlots;
  const slot = slots.indexOf(V);
  if (slot >= 0) B.entering.push({ side, slot, at: B.time + ENTRY_DELAY });
  if (V === B.me) {
    const next = B.squad.find((U) => !U.destroyed);
    if (next) takeVehicle(B, next);
  }
}

// Once per frame, after the captains have chosen their throttle.
function stepReserves(B, dt) {
  if (!B.rotation) return;
  const T = B.T;
  for (const side of [0, 1]) {
    const slots = side === 0 ? B.squad : B.enemySlots;
    for (let slot = 0; slot < slots.length; slot++) {
      const V = slots[slot];
      if (!V) continue;
      if (V.destroyed && !V.withdrawn && !V.replaced) {
        V.replaced = true;
        B.entering.push({ side, slot, at: B.time + ENTRY_DELAY });
        continue;
      }
      if (V.destroyed) continue;
      // Enemy captains pull back badly damaged ships while they have others waiting.
      if (side === 1 && !V.pulling && B.reserve[1].length && vehicleHealth(V) < ENEMY_PULL_HEALTH) pullBack(B, V);
      if (!V.pulling) continue;
      V.pullT += dt;
      if (V !== B.me) V.throttle = side === 0 ? -1 : 1;
      const out = V.flier ? V.pullT > AIR_EXIT_SECS : side === 0 ? V.body.x < EDGE_EXIT : V.body.x > T.length - EDGE_EXIT;
      if (out) withdraw(B, V);
    }
  }
  for (let i = B.entering.length - 1; i >= 0; i--) {
    const en = B.entering[i];
    if (B.time < en.at) continue;
    B.entering.splice(i, 1);
    enterFromReserve(B, en.side, en.slot);
  }
}

// A side is beaten when it has nothing left to fight with.
function sideBeaten(B, side) {
  if (B.siege && B.siege.defender === side && B.siege.keep && B.siege.keep.destroyed) return true;   // the keep has fallen (01 §11)
  const slots = side === 0 ? B.squad : B.enemySlots;
  if (slots.some((V) => V && !V.destroyed)) return false;
  if (B.entering.some((en) => en.side === side)) return false;
  return !B.reserve[side].length;
}
