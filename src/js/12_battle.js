/* ==== 12 BATTLE ==== */
// Battlefield setup, battle state, player commands, objectives and results.

function createBattle(level) {
  const cfg = battleConfig(level);
  const T = makeTerrain(cfg);
  const B = {
    cfg, T, level,
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
    stats: { shots: 0, pens: 0, kills: 0, lost: 0, ricochetsTaken: 0, enemyShots: 0 },
    panOf: () => 0,
    onDestroyed: null,
  };
  cfg.squad.forEach((t, i) => {
    const V = makeVehicle(designFromTemplate(t), 0, 46 - i * 15, 1, T);
    V.ai = makeAI('squad', level);
    V.label = String(i + 1);
    B.units.push(V);
    B.squad.push(V);
  });
  B.me = B.squad[0];

  // Enemies: parked trucks sit within the first stretch so level 1 is quick; others start far right.
  let x = cfg.enemies[0][2] === 'parked' ? 125 : cfg.length - 45;
  for (const [t, count, mode] of cfg.enemies) {
    for (let k = 0; k < count; k++) {
      const V = makeVehicle(designFromTemplate(t), 1, x, -1, T);
      V.ai = makeAI(mode, level);
      if (mode === 'convoy') { V.ai.a = x - 70; V.ai.b = x + 10; }
      B.units.push(V);
      B.goalTotal++;
      x += mode === 'parked' ? 22 : -18;
    }
    if (cfg.enemies[0][2] !== 'parked') x -= 10;
  }

  B.onDestroyed = (V) => {
    if (V.side === 1) {
      B.goalDone++;
      B.stats.kills++;
      if (B.target === V) B.target = null;
      audio.sfx('objective', B.panOf(V.body.x));
      B.heat = Math.min(3, B.heat + 1);
    } else {
      B.stats.lost++;
      if (V === B.me) B.pendingSwap = 1.2;
    }
  };
  updateSpotting(B);
  return B;
}

function updateBattle(B, dt) {
  if (B.hitStop > 0) { B.hitStop -= dt; return; }
  B.time += dt;
  B.spotT -= dt;
  if (B.spotT <= 0) { B.spotT = SPOT_INTERVAL; updateSpotting(B); }

  for (const V of B.units) {
    if (V.destroyed) { V.throttle = 0; continue; }
    if (V.revealT > 0) V.revealT -= dt;
    if (V === B.me) {
      if (V.ai.react > 0) V.ai.react -= dt;
    } else if (V.side === 0) squadThink(B, V, dt);
    else enemyThink(B, V, dt);
    mobilityNotes(B, V, dt);
  }
  for (const V of B.units) stepVehicle(V, B.T, dt);
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
    if (Math.abs(V.speed) > 0.8) {
      for (const tr of B.T.trees) {
        if (tr.alive && Math.abs(tr.x - V.body.x) < V.len / 2 && V.body.m > 3000) breakTree(B, tr, Math.sign(V.speed) || 1);
      }
    }
    if (!V.destroyed) runWeapons(B, V, dt, V !== B.me);
  }
  stepShells(B, dt);
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

  // Objectives.
  if (!B.result) {
    if (B.goalDone >= B.goalTotal) { B.result = 'win'; B.resultT = 0; }
    else if (B.squad.every((V) => V.destroyed)) { B.result = 'lost'; B.resultT = 0; }
  } else {
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
  if (!w) return 'No gun';
  if (w.reload > 0) return 'Reloading';
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

// Keep the controlled vehicle's gun pointed at its target (or at the aim point while aiming).
function trainPlayerGun(B, dt, aimX, aimY) {
  const V = B.me;
  const w = mainWeapon(V);
  if (!w || V.destroyed) return;
  let tx = aimX, ty = aimY;
  if (tx === undefined) {
    const T = autoTarget(B);
    if (T) { tx = T.body.x; ty = T.body.y + T.height * 0.15; }
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
