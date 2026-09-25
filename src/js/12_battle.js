/* ==== 12 BATTLE ==== */
// Battlefield setup, battle state, player commands, objectives and results.

// opts: { squad: [Design, …] (default: the three starting templates), test: true for a test drive, demo: true for the title }
function createBattle(level, opts = {}) {
  const cfg = opts.cfg || levelConfig(level);
  const T = makeTerrain(cfg);
  const B = {
    cfg, T, level,
    test: !!opts.test,
    demo: !!opts.demo,
    rng: makeRng((cfg.seed ^ 0x9e3779b9) >>> 0),
    units: [], squad: [], me: null,
    order: 'Follow',
    target: null,
    time: 0,
    trauma: 0,
    hitStop: 0,
    spotT: 0,
    result: null,
    resultT: 0,
    heat: 0,                 // recent combat near the camera, for music intensity
    intensity: 0,
    goalTotal: 0,
    goalDone: 0,
    holdT: 0,
    score: 0,                // points earned in this attempt
    combo: 0,
    lastKillT: -99,
    bestCombo: 0,
    warnings: [],            // artillery impact markers: {x, t}
    pending: [],             // enemies waiting for their wave
    escort: null,
    depot: 0,
    zone: null,
    stats: { shots: 0, pens: 0, kills: 0, lost: 0, ricochetsTaken: 0, enemyShots: 0, crits: 0 },
    panOf: () => 0,
    onDestroyed: null,
  };
  // Each squad design deploys in its own layer: land vehicles on the left, ships at the
  // near edge of the sea. Ships stay in port on maps without sea.
  // Sea battles (cfg.fleet) take only ships and submarines; without any, a fleet is lent.
  let squad = opts.squad || ['medium', 'light', 'scout'].map(designFromTemplate);
  B.inPort = squad.filter((d) => seaDomain(domainOf(d)) && T.seaX0 === undefined);
  B.ashore = cfg.fleet ? squad.filter((d) => !seaDomain(domainOf(d))) : [];
  squad = squad.filter((d) => !B.inPort.includes(d) && !B.ashore.includes(d));
  B.loaned = !squad.length && cfg.fleet;
  if (!squad.length) squad = (cfg.fleet ? LOAN_FLEET : ['medium', 'light', 'scout']).map(designFromTemplate);
  let landX = 46, seaX = T.seaX0 + 16;
  squad.forEach((d, i) => {
    const naval = seaDomain(domainOf(d));
    const L = cropDesign(d).w * CELL;
    const x = naval ? seaX + L / 2 : landX;
    if (naval) seaX += L + 8; else landX -= 15;
    const V = makeVehicle(d, 0, x, 1, T);
    V.ai = makeAI('squad', cfg);
    V.label = String(i + 1);
    B.units.push(V);
    B.squad.push(V);
  });
  B.me = B.squad[0];

  // Goal set-up.
  if (cfg.goal.type === 'escort') {
    const V = makeVehicle(designFromTemplate('truck'), 0, 62, 1, T);
    V.ai = makeAI('escort', cfg);
    V.escort = true;
    B.units.push(V);
    B.escort = V;
    B.depot = T.length - 40;
  }
  if (cfg.goal.type === 'hold') {
    let best = T.length * 0.45, bh = -Infinity;
    for (let x = T.length * 0.38; x < T.length * 0.62; x += 2) if (T.height(x) > bh) { bh = T.height(x); best = x; }
    B.zone = { x0: best - 12, x1: best + 12 };
  }

  // Enemies: wave 0 now, later waves from the right edge every cfg.wave seconds.
  let x = cfg.enemies[0] && cfg.enemies[0][2] === 'parked' ? 125 : T.length - 50;
  let fixedX = T.length - 70;
  for (const [t, count, mode, wave] of cfg.enemies) {
    for (let k = 0; k < count; k++) {
      B.goalTotal++;
      if (wave > 0) { B.pending.push({ t, mode, at: wave * cfg.wave }); continue; }
      let px;
      if (t === 'howitzer') px = T.length - 14 - k * 12;
      else if (mode === 'fixed') { px = fixedX; fixedX -= 45; }
      else { px = x; x += mode === 'parked' ? 22 : -18; }
      spawnEnemy(B, t, mode, px);
    }
  }
  if (cfg.goal.type === 'destroy' && B.goalTotal === 0) B.goalTotal = 0;

  B.onDestroyed = (V, source) => {
    if (V.side === 1) {
      B.goalDone++;
      B.stats.kills++;
      if (B.target === V) B.target = null;
      audio.sfx('objective', B.panOf(V.body.x));
      B.heat = Math.min(3, B.heat + 1);
      if (!source || source.side === 0) scoreKill(B, V);
    } else {
      if (V.escort) { if (!B.result) { B.result = 'lost'; B.resultT = 0; B.lostReason = 'The supply truck was destroyed.'; } return; }
      B.stats.lost++;
      if (V === B.me) B.pendingSwap = 1.2;
    }
  };
  updateSpotting(B);
  return B;
}

function spawnEnemy(B, t, mode, x) {
  const d = designFromTemplate(t);
  // Ships spawn at sea; land vehicles on land (Part 2a).
  const T = B.T;
  if (T.seaX0 !== undefined) {
    if (seaDomain(domainOf(d))) x = Math.max(x, T.seaX0 + 40);
    else x = Math.min(x, T.seaX0 - 12);
  }
  const V = makeVehicle(d, 1, x, -1, B.T);
  V.ai = makeAI(mode, B.cfg);
  V.template = t;
  V.speedMul = B.cfg.speedMul;
  if (mode === 'convoy') { V.ai.a = x - 70; V.ai.b = x + 10; }
  if (t === B.cfg.boss) { V.boss = true; V.name = B.cfg.bossName || d.name; }
  B.units.push(V);
  return V;
}

// Score (design/01 §14.4): kills, combos within 4 s, precision on critical parts.
function scoreKill(B, V) {
  if (B.test || B.demo) return;
  const base = ENEMY_VALUE[V.template] || 200;
  B.combo = B.time - B.lastKillT <= COMBO_WINDOW ? B.combo + 1 : 1;
  B.lastKillT = B.time;
  B.bestCombo = Math.max(B.bestCombo, B.combo);
  const pts = base * B.combo;
  B.score += pts;
  floatText(`Destroyed +${pts}`, V.body.x, V.body.y + V.height + 2, true);
  if (B.combo > 1) {
    floatText(`×${B.combo} combo`, V.body.x, V.body.y + V.height + 3.6, true);
    audio.sfx('combo', B.panOf(V.body.x), B.combo);
  }
}

// A precise hit that destroys a critical part of an enemy.
function scoreCritical(B, V, part, at) {
  if (B.test || B.demo || V.side !== 1 || V.destroyed) return;
  const d = part.def;
  if (!(d.power > 0 || d.detonate || d.crew || (d.cat === 'weapon' && d.id !== 'smoke'))) return;
  B.score += 50;
  B.stats.crits++;
  floatText(`Critical · ${d.name} +50`, at.x, at.y + 3, true);
}

// End-of-level bonuses (facts for the level-clear card).
function levelBonuses(B) {
  const par = 60 + B.level * 5;
  const rows = [['Kills and combos', B.score]];
  const clear = 200 + 50 * B.level;
  rows.push(['Level clear', clear]);
  if (B.stats.lost === 0) rows.push(['No losses', 300]);
  const timeBonus = Math.max(0, Math.round((par - B.time) * 5));
  if (timeBonus) rows.push([`Time under ${par} s`, timeBonus]);
  const total = rows.reduce((s, r) => s + r[1], 0);
  return { rows, total };
}

function updateBattle(B, dt) {
  if (B.hitStop > 0) { B.hitStop -= dt; return; }
  B.time += dt;
  B.spotT -= dt;
  if (B.spotT <= 0) { B.spotT = SPOT_INTERVAL; updateSpotting(B); }

  for (const V of B.units) {
    if (V.destroyed) { V.throttle = 0; continue; }
    if (V.revealT > 0) V.revealT -= dt;
    if (V.escort) { /* escortThink runs below */ }
    else if (V === B.me && !B.demo) {
      if (V.ai.react > 0) V.ai.react -= dt;
    } else if (V === B.me && B.demo) { V.ai.mode = 'attack'; enemyThink(B, V, dt); }
    else if (V.side === 0) squadThink(B, V, dt);
    else enemyThink(B, V, dt);
    if (V !== B.me || B.demo) domainGuard(B, V);
    mobilityNotes(B, V, dt);
  }
  if (B.T.seaX0 !== undefined) for (const V of B.units) subControl(V, B.T, dt);
  for (const V of B.units) stepVehicle(V, B.T, dt);
  if (B.T.seaX0 !== undefined) for (const V of B.units) { stepFlooding(B, V, dt); waterChecks(B, V); }
  if (!B.me.destroyed && B.me.speed * B.me.dir > 0.5 && Math.abs(B.T.slope(B.me.body.x)) >= 0.839) B.climbed40 = true;   // tan 40°
  separateVehicles(B.units);

  for (const V of B.units) {
    // Burning parts damage their neighbours.
    if (V.fires && V.fires.length) {
      for (let i = V.fires.length - 1; i >= 0; i--) {
        const f = V.fires[i];
        f.t -= dt;
        if (f.t <= 0) { V.fires.splice(i, 1); continue; }
        V.parts.forEach((p, k) => {
          if (!p.alive) return;
          const cx = (p.x + p.def.w / 2) * CELL, cy = (V.design.h - p.y - p.def.h / 2) * CELL;
          if (Math.hypot(cx - f.gx, cy - f.gy) < 1.3) damagePart(B, V, k, 7 * dt, null);
        });
        if (B.rng.next() < dt * 8) {
          const o = { x: 0, y: 0 };
          gridToLocal(V, f.gx, f.gy, o);
          localToWorld(V, o.x, o.y, o);
          const p = spawnParticle(FX_FIRE, o.x + B.rng.range(-0.3, 0.3), o.y, 0, 1.2, 0.45, 0.35);
          if (p) p.grow = 0.5;
        }
      }
    }
    // Tall vehicles push over trees.
    if (Math.abs(V.speed) > 0.8 && !V.hull) {
      for (const tr of B.T.trees) {
        if (tr.alive && Math.abs(tr.x - V.body.x) < V.len / 2 && V.body.m > 3000) breakTree(B, tr, Math.sign(V.speed) || 1);
      }
    }
    if (!V.destroyed) runWeapons(B, V, dt, V !== B.me || B.demo);
  }
  stepShells(B, dt);
  stepUnderwater(B, dt);
  stepDebris(B.T, dt);
  stepEffects(B, dt);
  B.trauma = Math.max(0, B.trauma - dt * 0.9);

  // Take over the next squad vehicle when yours is lost.
  if (B.pendingSwap !== undefined) {
    B.pendingSwap -= dt;
    if (B.pendingSwap <= 0) {
      delete B.pendingSwap;
      const next = B.squad.find((V) => !V.destroyed);
      if (next) takeVehicle(B, next);
    }
  }

  // Music intensity: enemies nearby and recent kills (design/03 §6.3).
  B.heat = Math.max(0, B.heat - dt * 0.05);
  let near = 0;
  for (const V of B.units) if (V.side === 1 && !V.destroyed && V.seen && Math.abs(V.body.x - B.me.body.x) < 200) near++;
  const want = clamp(Math.floor(near * 0.8 + B.heat), 0, 3);
  if (want !== B.intensity) { B.intensity = want; audio.setIntensity(want); }

  // Waves: spawn at the right edge when their time comes and the on-screen cap allows.
  if (B.pending.length) {
    let alive = 0;
    for (const V of B.units) if (V.side === 1 && !V.destroyed) alive++;
    for (let i = 0; i < B.pending.length && alive < LADDER_CAPS.onScreen; i++) {
      const p = B.pending[i];
      if (B.time < p.at) continue;
      spawnEnemy(B, p.t, p.mode, B.T.length - 30 - (i % 3) * 14);
      B.pending.splice(i--, 1);
      alive++;
      if (!B.waveNoted || B.time - B.waveNoted > 3) { B.waveNoted = B.time; if (!B.demo) ui.toast('Enemy reinforcements arriving.', 2200); }
    }
  }
  for (let i = B.warnings.length - 1; i >= 0; i--) { B.warnings[i].t -= dt; if (B.warnings[i].t <= 0) B.warnings.splice(i, 1); }
  if (B.escort && !B.escort.destroyed) escortThink(B, B.escort);

  // Objectives.
  if (!B.result && !B.test) {
    const g = B.cfg.goal;
    if (g.type === 'hold' && B.zone) {
      const inside = B.squad.some((V) => !V.destroyed && V.body.x >= B.zone.x0 && V.body.x <= B.zone.x1);
      if (inside) B.holdT += dt;
      if (B.holdT >= g.time) { B.result = 'win'; B.resultT = 0; }
    }
    if (g.type === 'escort' && B.escort && !B.escort.destroyed && B.escort.body.x >= B.depot - 1) { B.result = 'win'; B.resultT = 0; }
    if (!B.result && B.goalDone >= B.goalTotal && B.goalTotal > 0 && !B.pending.length) { B.result = 'win'; B.resultT = 0; }
    if (!B.result && B.squad.every((V) => V.destroyed)) { B.result = 'lost'; B.resultT = 0; }
  } else if (B.result) {
    B.resultT += dt;
  }
}

// ---------- player commands
function takeVehicle(B, V) {
  if (V.destroyed || V === B.me) return false;
  B.me.throttle = 0;
  B.me = V;
  V.ai.hold = null;
  return true;
}

// Fire the main gun of the controlled vehicle at a world point (or the target).
// Returns a short reason when it can't.
function playerFire(B, tx, ty, manual) {
  const V = B.me;
  const w = mainWeapon(V);
  if (!w) return V.weapons.some((x) => x.def.secondary) ? playerSecondary(B) : 'No gun';
  if (w.reload > 0) return 'Reloading';
  if (gunUnderWater(B, V, w)) return 'Gun under water';
  if (V.shells <= 0) return 'Out of shells';
  aimWeapon(V, w, tx, ty, _aim);
  if (!_aim.ok) return _aim.reason || 'Out of arc';
  if (w.face !== _aim.face) { trainWeapon(V, w, _aim.angle, _aim.face, 0); return 'Turret turning'; }
  w.angle = _aim.angle;
  if (!fireWeapon(B, V, w, _aim.angle, manual ? 0.6 : 1)) return 'Out of shells';
  w.reload = w.def.reload * (V.crew < 3 ? 1.6 : 1);
  B.stats.shots++;
  B.heat = Math.min(3, B.heat + 0.2);
  return '';
}

// Auto-aim target: the selected target, else the nearest spotted enemy in range, else straight ahead.
function autoTarget(B) {
  const V = B.me;
  if (B.target && !B.target.destroyed && B.target.seen) return B.target;
  const w = mainWeapon(V);
  return nearestTarget(B, V, w ? weaponRange(w.def) * 1.2 : 200);
}

const _tp = { x: 0, y: 0 };
// Keep the controlled vehicle's gun pointed at its target (or at the aim point while aiming).
function trainPlayerGun(B, dt, aimX, aimY) {
  const V = B.me;
  const w = mainWeapon(V);
  if (!w || V.destroyed) return;
  let tx = aimX, ty = aimY;
  if (tx === undefined) {
    const T = autoTarget(B);
    if (T) { aimPoint(B, T, _tp); tx = _tp.x; ty = _tp.y; }
    else { tx = V.body.x + V.dir * 60; ty = B.T.height(V.body.x + V.dir * 60) + 1.5; }
  }
  aimWeapon(V, w, tx, ty, _aim);
  trainWeapon(V, w, _aim.angle, _aim.face, dt);
}

// Smoke launcher: a screen in front of the vehicle.
function playerSmoke(B) {
  const V = B.me;
  if (!V.smoke) return 'No smoke launcher';
  V.smoke--;
  const x = V.body.x + V.dir * 8;
  fxSmokeScreen(B, x, B.T.height(x) + 1);
  return '';
}

// Test-only helpers.
/*TEST:BEGIN*/
function battleSelfCheck() {
  const out = {};
  for (const id of Object.keys(TEMPLATES)) {
    if (TEMPLATES[id].fixed) continue;          // enemy-only positions have no engine by design
    const d = designFromTemplate(id);
    const v = validateDesign(d);
    const s = statsOf(d);
    out[id] = { ok: v.ok, errors: v.errors, mass: Math.round(s.mass), kW: s.power, pressure: Math.round(s.pressure), tip: Math.round(s.tipAngle) };
  }
  return out;
}
// Emergent-physics checks (design/06 Part 1 acceptance). Each case runs a vehicle alone on shaped ground.
function physicsCheck() {
  const run = (templateOrDesign, shape, mat, throttle, secs, startX = 40) => {
    const T = makeTerrain({ seed: 1, length: 400, hills: 0, rough: 0, mud: 0, forest: 0, gaps: 0 });
    for (let i = 0; i < T.n; i++) { T.h[i] = shape(i * CELL); T.mat[i] = mat(i * CELL); }
    const d = typeof templateOrDesign === 'string' ? designFromTemplate(templateOrDesign) : templateOrDesign;
    const V = makeVehicle(d, 0, startX, 1, T);
    V.throttle = throttle;
    let maxTilt = 0;
    for (let t = 0; t < secs; t += SIM_STEP) {
      stepVehicle(V, T, SIM_STEP);
      if (t > 0.5) maxTilt = Math.max(maxTilt, Math.abs((V.body.a - Math.atan(T.slope(V.body.x))) * 180 / Math.PI));
    }
    return { x: V.body.x - startX, speed: V.speed, tilt: maxTilt };
  };
  const flat = () => 0;
  const plains = () => T_PLAINS;
  const mud = () => T_MUD;
  const hill = (deg) => (x) => (x > 50 ? (x - 50) * Math.tan((deg * Math.PI) / 180) : 0);
  // Underpowered: the medium tank with the small petrol engine and a spare plate where the rest of the engine was.
  const weak = designFromTemplate('medium');
  weak.cells = weak.cells.filter((c) => c.p !== 'eng_m').concat([{ p: 'eng_s', x: 2, y: 4 }, { p: 'arm80', x: 4, y: 4 }, { p: 'arm80', x: 4, y: 5 }]);
  // Top-heavy: the light tank with a tall armoured mast on top.
  const tall = designFromTemplate('light');
  tall.h = 14;
  for (const c of tall.cells) c.y += 8;
  for (let y = 0; y < 8; y++) { tall.cells.push({ p: 'arm80', x: 5, y }); tall.cells.push({ p: 'arm80', x: 6, y }); }
  return {
    wheelsFlat: run('scout', flat, plains, 1, 20),
    tracksFlat: run('light', flat, plains, 1, 20),
    wheelsMud: run('scout', flat, mud, 1, 20),
    tracksMud: run('light', flat, mud, 1, 20),
    normalHill: run('medium', hill(22), plains, 1, 25),
    weakHill: run(weak, hill(22), plains, 1, 25),
    normalSlope: run('light', hill(30), plains, 0, 6, 80),
    tallSlope: run(tall, hill(30), plains, 0, 6, 80),
    weakValid: validateDesign(weak).ok,
    tallValid: validateDesign(tall).ok,
  };
}

// Howitzer aim: a battery can reach targets from close range out to its full range.
function howitzerCheck() {
  const B = createBattle(7);
  const H = B.units.find((u) => u.template === 'howitzer');
  const w = mainWeapon(H);
  const out = {};
  for (const d of [40, 120, 250, 390]) {
    const tx = H.body.x - d;
    aimWeapon(H, w, tx, B.T.height(tx) + 1, _aim);
    out[d] = _aim.ok;
  }
  return out;
}

// Ships (design/06 Part 2 acceptance): over-armoured ships sit low and slow down; a holed
// ship lists and bulkheads contain the water; without bulkheads it sinks; the drive pad drives it.
function navalCheck() {
  const T = makeTerrain({ seed: 7, length: 520, hills: 0.2, rough: 0.2, mud: 0, forest: 0, gaps: 0, sea: { from: 50, depth: 14 } });
  const B = { T, panOf: () => 0 };
  const run = (d, throttle, secs, holes = []) => {
    const V = makeVehicle(d, 0, 150, 1, T);
    for (const [x, y] of holes) { const i = V.parts.findIndex((p) => p.x === x && p.y === y); V.parts[i].alive = false; V.alive[i] = 0; }
    rebuildVehicle(V);
    V.throttle = throttle;
    for (let t = 0; t < secs; t += SIM_STEP) { stepVehicle(V, T, SIM_STEP); stepFlooding(B, V, SIM_STEP); }
    const tmp = { x: 0, y: 0 };
    let low = Infinity, top = -Infinity;
    for (const [gx, gy] of [[V.bounds.minX, V.bounds.minY], [V.bounds.maxX, V.bounds.minY], [V.bounds.minX, V.bounds.maxY], [V.bounds.maxX, V.bounds.maxY]]) {
      gridToLocal(V, gx, gy, tmp); localToWorld(V, tmp.x, tmp.y, tmp);
      low = Math.min(low, tmp.y); top = Math.max(top, tmp.y);
    }
    const wet = V.parts.filter((p) => p.water > 1).map((p) => p.x);
    return { dx: V.body.x - 150, speed: V.speed, draft: T.sea - low, sunk: top < T.sea, angle: (V.body.a * 180) / Math.PI, wet };
  };
  const base = designFromTemplate('gunboat');
  const heavy = designFromTemplate('gunboat');
  heavy.cells = heavy.cells.map((c) => (c.p === 'plate' ? { p: 'arm80', x: c.x, y: c.y } : c)).concat([12, 13, 14, 19, 20].map((x) => ({ p: 'arm80', x, y: 4 })));
  const open = designFromTemplate('gunboat');
  open.cells = open.cells.filter((c) => !(c.y === 6 && (c.p === 'hull' || c.p === 'bulk')));
  for (let x = 4; x < 24; x += 2) open.cells.push({ p: 'hull', x, y: 6 });
  return {
    valid: validateDesign(heavy).ok && validateDesign(open).ok,
    base: run(base, 1, 25),
    heavy: run(heavy, 1, 25),
    holed: run(base, 0, 30, [[6, 6]]),
    open: run(open, 0, 40, [[6, 6]]),
    reverse: run(designFromTemplate('destroyer'), -1, 8),
  };
}

// Submarines (Part 2b): dive to the ordered depth and surface again; a torpedo holes and
// floods a gunboat; a depth charge damages a submarine under the destroyer.
function subCheck() {
  const T = makeTerrain({ seed: 7, length: 520, hills: 0.2, rough: 0.2, mud: 0, forest: 0, gaps: 0, sea: { from: 50, depth: 22 } });
  const V = makeVehicle(designFromTemplate('sub'), 0, 200, 1, T);
  const top = () => V.body.y + (V.bounds.maxY - V.com.y) - T.sea;
  const run = (secs) => { for (let t = 0; t < secs; t += SIM_STEP) { subControl(V, T, SIM_STEP); stepVehicle(V, T, SIM_STEP); } };
  const out = { valid: validateDesign(designFromTemplate('sub')).ok };
  V.depthCmd = T.sea - 8;
  run(25);
  out.dived = { top: top(), com: V.body.y - T.sea, angle: (V.body.a * 180) / Math.PI, submerged: V.submerged };
  V.depthCmd = null;
  run(25);
  out.surfaced = { top: top(), submerged: V.submerged };
  // Weapons in a sea battle.
  const B = createBattle(16);
  const me = B.me;
  const gb = B.units.find((u) => u.template === 'gunboat');
  const water = (U) => U.parts.reduce((a, p) => a + (p.water || 0), 0);
  const hp = (U) => U.parts.reduce((a, p) => a + (p.alive ? p.hp : 0), 0);
  const hp0 = hp(gb);
  me.body.x = gb.body.x - 80;
  for (const U of B.squad) if (U !== me) U.body.x = Math.min(U.body.x, 90);
  const tw = me.weapons.find((w) => w.def.secondary === 'torpedo');
  tw.reload = 0; tw.rounds = 2;
  torpedoes.forEachAlive((t) => { t.alive = false; });
  launchTorpedo(B, me, tw, gb);
  for (let t = 0; t < 12; t += SIM_STEP) updateBattle(B, SIM_STEP);
  out.torpedo = { hpLost: hp0 - hp(gb), water: water(gb), destroyed: gb.destroyed };
  const sub = B.units.find((u) => u.template === 'sub' && !u.destroyed) || spawnEnemy(B, 'sub', 'fixed', 400);
  sub.depthCmd = B.T.sea - 8;
  for (let t = 0; t < 10; t += SIM_STEP) updateBattle(B, SIM_STEP);
  const hs = hp(sub);
  me.body.x = sub.body.x;
  const dc = me.weapons.find((w) => w.def.secondary === 'depth');
  dc.reload = 0;
  dropCharge(B, me, dc, sub.body.y);
  for (let t = 0; t < 8; t += SIM_STEP) updateBattle(B, SIM_STEP);
  out.charge = { hpLost: hs - hp(sub), destroyed: sub.destroyed };
  return out;
}

// Part effects: engine, gun, turret ring, ammo detonation.
function damageCheck() {
  const B = createBattle(4);
  const find = (V, id) => V.parts.findIndex((p) => p.alive && p.def.id === id);
  const V = B.units.find((u) => u.side === 1);
  const out = {};
  destroyPart(B, V, find(V, 'eng_m'), null);
  out.engineImmobile = !V.canDrive;
  const gunBefore = !!mainWeapon(V);
  destroyPart(B, V, find(V, 'c37'), null);
  out.gunSilenced = gunBefore && !mainWeapon(V);
  let deb = 0;
  debris.forEachAlive(() => deb++);
  destroyPart(B, V, find(V, 'turret'), null);
  let deb2 = 0;
  debris.forEachAlive(() => deb2++);
  out.turretTossed = deb2 >= deb + 2 && V.parts.every((p) => !p.alive || p.y >= 3);
  const W = B.units.filter((u) => u.side === 1)[1];
  const real = B.rng.next;
  B.rng.next = () => 0;           // force the 40% detonation roll
  destroyPart(B, W, find(W, 'ammo'), null);
  B.rng.next = real;
  out.ammoDetonated = W.destroyed;
  return out;
}
/*TEST:END*/
