/* ==== 10a COMBAT ==== */
// Projectiles, ballistics, grid raycast, penetration, ricochet, per-part damage
// and part effects (design/01 §7.4, design/05 §3, design/04 §6).

const MAX_PROJECTILES = 300;
const RICOCHET_ANGLE = 70;          // degrees from the surface normal
const MG_RANGE_BONUS = 1;

const shells = makePool(() => ({
  alive: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, sx: 0, sy: 0, t: 0,
  side: 0, shooter: null, def: null, pen: 0, dmg: 0, mg: false, he: false, ignore: null, ignoreT: 0,
}), MAX_PROJECTILES);

// Battlefield range of a weapon (design sheet range × distance scale).
const weaponRange = (d) => d.range * BATTLE_DISTANCE_SCALE;

// Penetration at a battlefield distance (design/05 §3), using the nominal sheet range.
function penAt(d, worldDist) {
  const r = worldDist / BATTLE_DISTANCE_SCALE;
  if (d.auto) return d.pen * Math.max(0.2, 1 - 0.25 * (r / 500));
  if (d.he) return d.pen;
  return d.pen * Math.max(0.5, 1 - (0.12 * (r - 500)) / 500);
}

// Barrel pivot and muzzle in world space.
const _p = { x: 0, y: 0 };
function weaponPivot(V, w, out) {
  gridToLocal(V, w.pivotGx, w.pivotGy, out);
  return localToWorld(V, out.x, out.y, out);
}
function barrelLength(d) { return d.w * CELL * 1.25 + (d.auto ? 0.3 : 0.6); }
const TWIN_GAP = 0.2;             // metres between the barrels of a twin mount and its centre line

// World-angle limits of a weapon. Turrets aim to either side; hull guns only forward.
function weaponArc(V, w) {
  const d = w.def;
  if (d.indirect) return { lo: -5, hi: 80, both: false };
  return w.turret ? { lo: -10, hi: 35, both: true } : d.auto ? { lo: -10, hi: 30, both: false } : { lo: -6, hi: 18, both: false };
}

// Elevation (degrees) of world angle `ang` relative to the body, facing `face` (+1 right, −1 left).
function elevationOf(V, ang, face) {
  const base = face > 0 ? V.body.a : V.body.a + Math.PI;
  let e = face > 0 ? ang - base : base - ang;
  while (e > Math.PI) e -= Math.PI * 2;
  while (e < -Math.PI) e += Math.PI * 2;
  return (e * 180) / Math.PI;
}
function angleFromElevation(V, elevDeg, face) {
  const e = (elevDeg * Math.PI) / 180;
  return face > 0 ? V.body.a + e : V.body.a + Math.PI - e;
}

// Low-angle ballistic solution; returns the world angle or NaN when out of reach.
function ballisticAngle(x, y, tx, ty, v, high) {
  const dx = tx - x, dy = ty - y;
  const ax = Math.max(0.01, Math.abs(dx));
  const v2 = v * v;
  const disc = v2 * v2 - GRAVITY * (GRAVITY * ax * ax + 2 * dy * v2);
  if (disc < 0) return NaN;
  const up = Math.atan((v2 + (high ? 1 : -1) * Math.sqrt(disc)) / (GRAVITY * ax));
  return dx >= 0 ? up : Math.PI - up;
}

// Work out where weapon w must point to hit (tx, ty). Returns {ok, angle, face, reason}.
function aimWeapon(V, w, tx, ty, out) {
  const d = w.def;
  weaponPivot(V, w, _p);
  const face = tx >= _p.x ? 1 : -1;
  out.face = face;
  out.ok = false;
  out.reason = '';
  if (!w.turret && face !== V.dir) { out.reason = 'Out of arc'; out.angle = angleFromElevation(V, 0, V.dir); out.face = V.dir; return out; }
  let ang = d.auto ? Math.atan2(ty - _p.y, tx - _p.x) : ballisticAngle(_p.x, _p.y, tx, ty, d.vel, !!d.indirect);
  if (Number.isNaN(ang)) { ang = angleFromElevation(V, 35, face); out.reason = 'Out of range'; }
  const arc = weaponArc(V, w);
  // Howitzers lob when the high arc fits the mount, otherwise they fire the flat solution.
  if (d.indirect && !out.reason && elevationOf(V, ang, face) > arc.hi) ang = ballisticAngle(_p.x, _p.y, tx, ty, d.vel, false);
  const el = elevationOf(V, ang, face);
  const cl = clamp(el, arc.lo, arc.hi);
  out.angle = angleFromElevation(V, cl, face);
  out.ok = !out.reason && Math.abs(cl - el) < 0.5;
  if (!out.reason && !out.ok) out.reason = 'Out of arc';
  return out;
}

// Gaussian-ish error from the seeded battle RNG (sum of three uniforms).
function gauss(rng) { return (rng.next() + rng.next() + rng.next() - 1.5) * 1.15; }

// Fire weapon w of V along world angle `ang`. spreadMul scales the aiming error.
function fireWeapon(B, V, w, ang, spreadMul) {
  const d = w.def;
  if (!d.auto) {
    if (V.shells <= 0) return false;
    V.shells--;
  }
  let spread = d.spread / V.fc;
  const moving = Math.abs(V.speed) > 0.4;
  if (moving) spread *= V.stab ? 1.6 : 2.5;
  spread *= spreadMul;
  weaponPivot(V, w, _p);
  const L = barrelLength(d);
  // Twin mounts fire both barrels, each with its own aiming error.
  let mx = 0, my = 0, a = ang;
  for (let k = 0; k < (d.twin ? 2 : 1); k++) {
    a = ang + (gauss(B.rng) * spread * Math.PI) / 180;
    const off = d.twin ? (k ? -1 : 1) * TWIN_GAP : 0;
    mx = _p.x + Math.cos(a) * L - Math.sin(ang) * off;
    my = _p.y + Math.sin(a) * L + Math.cos(ang) * off;
    const s = shells.take();
    s.x = s.px = s.sx = mx; s.y = s.py = s.sy = my;
    s.vx = Math.cos(a) * d.vel + V.body.vx;
    s.vy = Math.sin(a) * d.vel + V.body.vy;
    s.t = 0; s.side = V.side; s.shooter = V; s.def = d;
    s.dmg = d.dmg; s.mg = !!d.auto; s.he = !!d.he; s.ignore = V; s.ignoreT = 0.25; s.whistled = false; s.wet = false;
  }
  // Recoil: impulse cal² × 0.9 N·s at the barrel base (design/05 §3).
  if (!d.auto) {
    const J = d.cal * d.cal * 0.9 * (d.twin ? 2 : 1);
    const jx = -Math.cos(a) * J, jy = -Math.sin(a) * J;
    const b = V.body;
    b.vx += jx / b.m; b.vy += jy / b.m;
    b.w += ((_p.x - b.x) * jy - (_p.y - b.y) * jx) / b.I;
    w.kick = 1;
  }
  V.revealT = d.auto ? 1.5 : 4;
  if (V.side === 1 && B.stats) B.stats.enemyShots++;
  const pan = B.panOf ? B.panOf(mx) : 0;
  if (d.auto) {
    if ((w.burst & 1) === 0) audio.sfx('tick', pan, 1.2);
  } else {
    audio.sfx('cannon', pan, d.cal / 75);
    fxMuzzle(B, mx, my, a, d.cal);
    if (V === B.me) { haptic('fire'); B.trauma = Math.min(1, B.trauma + d.cal / 400); }
  }
  return true;
}

// ---------- grid raycast (DDA) through a vehicle's cells
// Walks cells from (x0, y0) to (x1, y1) in grid cell units (y up). cb(index, axis) returns true to stop.
function traceGrid(V, x0, y0, x1, y1, cb) {
  const W = V.design.w, H = V.design.h;
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1, axis = 'x';
  // Slab clip against the grid box.
  for (const [p, dp, max, ax] of [[x0, dx, W, 'x'], [y0, dy, H, 'y']]) {
    if (Math.abs(dp) < 1e-9) { if (p < 0 || p >= max) return false; continue; }
    let ta = (0 - p) / dp, tb = (max - p) / dp;
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    if (ta > t0) { t0 = ta; axis = ax; }
    t1 = Math.min(t1, tb);
  }
  if (t0 > t1) return false;
  const sx = x0 + dx * t0, sy = y0 + dy * t0;
  let cx = clamp(Math.floor(sx + (dx > 0 ? 1e-7 : -1e-7)), 0, W - 1);
  let cy = clamp(Math.floor(sy + (dy > 0 ? 1e-7 : -1e-7)), 0, H - 1);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
  const tdx = Math.abs(dx) > 1e-9 ? Math.abs(1 / dx) : Infinity;
  const tdy = Math.abs(dy) > 1e-9 ? Math.abs(1 / dy) : Infinity;
  let tmx = Math.abs(dx) > 1e-9 ? ((dx > 0 ? cx + 1 : cx) - x0) / dx : Infinity;
  let tmy = Math.abs(dy) > 1e-9 ? ((dy > 0 ? cy + 1 : cy) - y0) / dy : Infinity;
  for (let guard = 0; guard < 200; guard++) {
    const row = H - 1 - cy;
    const idx = V.grid[row * W + cx];
    if (idx >= 0 && cb(idx, axis, cx, cy)) return true;
    if (tmx < tmy) { if (tmx > t1) break; cx += stepX; tmx += tdx; axis = 'x'; }
    else { if (tmy > t1) break; cy += stepY; tmy += tdy; axis = 'y'; }
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) break;
  }
  return false;
}

const _g0 = { x: 0, y: 0 }, _g1 = { x: 0, y: 0 };

// Resolve a shell against vehicle V along its current step. Returns true if the shell is used up.
function shellVsVehicle(B, s, V) {
  const len = V.radius * 2.2;
  const sp = Math.hypot(s.vx, s.vy) || 1;
  worldToGrid(V, s.px, s.py, _g0);
  worldToGrid(V, s.px + (s.vx / sp) * (len + Math.hypot(s.x - s.px, s.y - s.py)), s.py + (s.vy / sp) * (len + Math.hypot(s.x - s.px, s.y - s.py)), _g1);
  const gx0 = _g0.x / CELL, gy0 = _g0.y / CELL, gx1 = _g1.x / CELL, gy1 = _g1.y / CELL;
  // Only a hit if the first occupied cell lies within this step's travel.
  const stepLen = Math.hypot(s.x - s.px, s.y - s.py) / CELL;
  const total = Math.hypot(gx1 - gx0, gy1 - gy0) || 1;
  let firstT = -1;
  traceGrid(V, gx0, gy0, gx1, gy1, (idx, axis, cx, cy) => {
    firstT = Math.hypot(cx + 0.5 - gx0, cy + 0.5 - gy0) - 0.75;
    return true;
  });
  if (firstT < 0 || firstT > stepLen + 0.5) return false;

  const ddx = (gx1 - gx0) / total, ddy = (gy1 - gy0) / total;
  const travelled = Math.hypot(s.x - s.sx, s.y - s.sy);
  let pen = s.he ? s.def.pen : penAt(s.def, travelled);
  let dmg = s.dmg;
  let last = -1, first = true, penetrated = false, exitCell = null, used = false;
  let hitName = '';
  let hx = 0, hy = 0;
  traceGrid(V, gx0, gy0, gx1, gy1, (idx, axis, cx, cy) => {
    exitCell = [cx, cy];
    if (idx === last) return false;
    last = idx;
    const part = V.parts[idx];
    if (!part.alive) return false;
    const d = part.def;
    // Surface normal of the face entered, in grid space.
    let nx = axis === 'x' ? -Math.sign(ddx) : 0;
    let ny = axis === 'y' ? -Math.sign(ddy) : 0;
    if (d.sloped && ddx * 0.7071 + ddy * 0.7071 < 0) { nx = 0.7071; ny = 0.7071; }
    const cos = Math.max(0.05, Math.abs(ddx * nx + ddy * ny));
    const eff = d.armor / cos;
    if (first) {
      first = false;
      hx = cx; hy = cy;
      const angle = (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
      if (!s.he && !s.mg && d.armor >= 8 && angle > RICOCHET_ANGLE) {
        ricochet(B, s, V, cx, cy, nx, ny);
        used = true;
        return true;
      }
      if (s.he) {
        used = true;
        return true;       // HE bursts on the surface
      }
    }
    if (pen >= eff) {
      pen -= eff;
      if (!penetrated) { penetrated = true; hitName = d.name; }
      if (d.floods && V.hull && !s.mg) addHole(V, idx, cx, cy);
      damagePart(B, V, idx, dmg, s.shooter);
      dmg *= 0.65;
      if (dmg < 4 || pen <= 1) { used = true; return true; }
      return false;
    }
    // Stopped by armour.
    damagePart(B, V, idx, dmg * (s.mg ? 0.02 : 0.08), s.shooter);
    if (!penetrated && !s.mg) {
      stoppedAt(B, V, cx, cy, s);
    }
    used = true;
    return true;
  });
  const hitWorld = gridCellToWorld(V, hx, hy);
  if (s.he) {
    explode(B, hitWorld.x, hitWorld.y, s.def.heDmg || s.dmg, s.def.heRadius || 3, s.shooter);
    return true;
  }
  if (penetrated && s.def.burst && !V.destroyed) {
    // Bursting charge inside the vehicle: damages the parts around the first penetration.
    const cx = hx, cy = hy;
    V.parts.forEach((p, i) => {
      if (!p.alive) return;
      const px = p.x + p.def.w / 2, py = V.design.h - p.y - p.def.h / 2;
      const dd = Math.hypot(px - (cx + 0.5), py - (cy + 0.5)) * CELL;
      if (dd < s.def.burstR) damagePart(B, V, i, s.def.burst * (1 - dd / s.def.burstR), s.shooter);
    });
  }
  if (penetrated) {
    if (!s.mg) {
      if (s.shooter === B.me || V === B.me) floatText(`Penetrated · ${hitName}`, hitWorld.x, hitWorld.y + 1.5, false);
      fxSparks(B, hitWorld.x, hitWorld.y, Math.atan2(s.vy, s.vx), 10);
      audio.sfx('clunk', B.panOf(hitWorld.x), 1);
      if (s.shooter && s.shooter.side === 0) B.stats.pens++;
    } else if (B.rng.next() < 0.3) {
      fxSparks(B, hitWorld.x, hitWorld.y, Math.atan2(s.vy, s.vx), 2);
    }
  }
  V.lastHitT = B.time;
  if (V === B.me) { haptic('hit'); B.trauma = Math.min(1, B.trauma + 0.25); }
  if (!used && exitCell) {
    // Over-penetration: the shell leaves the far side and keeps flying.
    s.ignore = V; s.ignoreT = 0.3; s.dmg = dmg;
    return false;
  }
  return true;
}

function gridCellToWorld(V, cx, cy) {
  const o = { x: 0, y: 0 };
  gridToLocal(V, (cx + 0.5) * CELL, (cy + 0.5) * CELL, o);
  return localToWorld(V, o.x, o.y, o);
}

function ricochet(B, s, V, cx, cy, nx, ny) {
  const p = gridCellToWorld(V, cx, cy);
  // Reflect the velocity about the surface normal (turned into world space).
  const ang = V.body.a;
  const wnx = nx * V.dir * Math.cos(ang) - ny * Math.sin(ang);
  const wny = nx * V.dir * Math.sin(ang) + ny * Math.cos(ang);
  const vn = s.vx * wnx + s.vy * wny;
  s.vx = (s.vx - 2 * vn * wnx) * 0.55;
  s.vy = (s.vy - 2 * vn * wny) * 0.55;
  s.x = p.x + wnx * 0.4; s.y = p.y + wny * 0.4;
  s.px = s.x; s.py = s.y;
  s.ignore = V; s.ignoreT = 0.5;
  s.dmg *= 0.3;
  if (s.shooter === B.me || V === B.me) floatText('Ricochet', p.x, p.y + 1.5, false);
  fxSparks(B, p.x, p.y, Math.atan2(s.vy, s.vx), 7);
  audio.sfx('ricochet', B.panOf(p.x));
  if (V === B.me) B.stats.ricochetsTaken++;
}

function stoppedAt(B, V, cx, cy, s) {
  const p = gridCellToWorld(V, cx, cy);
  if (s.shooter === B.me || V === B.me) floatText('No penetration', p.x, p.y + 1.5, false);
  fxSparks(B, p.x, p.y, B.rng.range(0, 6.28), 4);
  audio.sfx('clunk', B.panOf(p.x), 0.6);
}

// ---------- damage
function damagePart(B, V, idx, dmg, source) {
  const p = V.parts[idx];
  if (!p.alive || dmg <= 0) return;
  p.hp -= dmg;
  p.scorch = Math.min(1, p.scorch + dmg / p.def.hp);
  if (source) V.lastHitBy = source;
  V.dirty = true;
  if (p.hp <= 0) destroyPart(B, V, idx, source);
  else if (!V.destroyed) checkVehicleState(B, V, source);
}

function destroyPart(B, V, idx, source) {
  const p = V.parts[idx];
  if (!p.alive) return;
  p.alive = false;
  V.alive[idx] = 0;
  const d = p.def;
  const at = gridCellToWorld(V, p.x + d.w / 2 - 0.5, V.design.h - p.y - d.h / 2 - 0.5);
  spawnDebris(B, V, [idx], at, 5);
  if (source && source.side === 0) scoreCritical(B, V, p, at);
  audio.sfx('crunch', B.panOf(at.x));
  if (V === B.me) haptic('part');
  // Part effects (design/01 §7.4).
  if (d.detonate && B.rng.next() < d.detonate) {
    rebuildVehicle(V);
    detonate(B, V, source);
    return;
  }
  if (d.fire && B.rng.next() < d.fire) {
    V.fires = V.fires || [];
    V.fires.push({ gx: (p.x + d.w / 2) * CELL, gy: (V.design.h - p.y - d.h / 2) * CELL, t: 12 });
    floatText('Fire', at.x, at.y + 2, true);
  }
  if (d.power > 0 && d.cat === 'mobility') floatText('Engine destroyed', at.x, at.y + 2.5, false);
  else if (d.cat === 'weapon') floatText(`${d.name} silenced`, at.x, at.y + 2.5, false);
  else if (d.ring) floatText('Turret ring jammed', at.x, at.y + 2.5, false);

  // Parts no longer connected to the main body fall off (turret toss, lost wheels).
  const groups = components(V.design, occupancy(V.design, V.alive), V.alive);
  if (groups.length > 1) {
    const score = (g) => g.reduce((s, i) => s + (V.parts[i].def.crew ? 1e6 : 0) + (V.parts[i].def.loco ? 1e4 : 0) + V.parts[i].def.mass, 0);
    groups.sort((a, b) => score(b) - score(a));
    for (let k = 1; k < groups.length; k++) {
      for (const i of groups[k]) { V.parts[i].alive = false; V.alive[i] = 0; }
      const g = groups[k];
      const c = V.parts[g[0]];
      spawnDebris(B, V, g, gridCellToWorld(V, c.x, V.design.h - c.y - 1), 7);
    }
  }
  rebuildVehicle(V);
  checkVehicleState(B, V, source);
}

function checkVehicleState(B, V, source) {
  if (V.destroyed) return;
  let hp = 0;
  for (const p of V.parts) if (p.alive) hp += p.hp;
  if (V.crew <= 0 || V.parts.every((p) => !p.alive || p.def.cat === 'mobility')) {
    knockOut(B, V, source, 'Knocked out');
  } else if (hp < V.hpMax * 0.3) {
    knockOut(B, V, source, 'Wrecked');
  } else if (V.immobile && !V.wasImmobile) {
    V.wasImmobile = true;
    floatText('Immobilised', V.body.x, V.body.y + V.height, false);
  }
}

// quiet: sunk or flooded, so no fireball.
function knockOut(B, V, source, label, quiet) {
  if (V.destroyed) return;
  V.destroyed = true;
  V.throttle = 0;
  V.canDrive = false;
  B.hitStop = 0.05;
  if (quiet) {
    fxSplash(B, V.body.x, B.T.sea, 2);
    audio.sfx('flood', B.panOf(V.body.x), 1.5);
  } else {
    fxExplosion(B, V.body.x, V.body.y + 0.5, 1.2);
    fxSmokeColumn(B, V);
    audio.sfx('boom', B.panOf(V.body.x));
  }
  B.trauma = Math.min(1, B.trauma + 0.35);
  floatText(label, V.body.x, V.body.y + V.height + 1, true);
  if (V.side === 0) haptic('lost');
  if (B.onDestroyed) B.onDestroyed(V, source);
}

// Ammo detonation: the vehicle comes apart.
function detonate(B, V, source) {
  const alive = [];
  V.parts.forEach((p, i) => { if (p.alive) alive.push(i); });
  for (const i of alive) {
    if (B.rng.next() < 0.55 || V.parts[i].def.ring || V.parts[i].y < 3) {
      V.parts[i].alive = false; V.alive[i] = 0;
      const c = V.parts[i];
      spawnDebris(B, V, [i], gridCellToWorld(V, c.x, V.design.h - c.y - 1), 11);
    }
  }
  rebuildVehicle(V);
  fxExplosion(B, V.body.x, V.body.y + 1, 2.2);
  audio.sfx('boom', B.panOf(V.body.x), 1.6);
  knockOut(B, V, source, 'Ammo detonated');
}

// High-explosive burst: damage falls off with distance; heavy armour shrugs most of it off.
function explode(B, x, y, dmg, radius, source) {
  fxExplosion(B, x, y, radius / 3);
  audio.sfx('boom', B.panOf(x), 0.7 + radius / 8);
  const gy = B.T.height(x);
  if (y - gy < radius * 0.6 && !seaAt(B.T, x)) B.T.carve(x, radius * 0.6, 0.35 + radius * 0.06);
  const tmp = { x: 0, y: 0 };
  for (const V of B.units) {
    if (Math.hypot(V.body.x - x, V.body.y - y) > radius + V.radius) continue;
    V.parts.forEach((p, i) => {
      if (!p.alive) return;
      gridToLocal(V, (p.x + p.def.w / 2) * CELL, (V.design.h - p.y - p.def.h / 2) * CELL, tmp);
      localToWorld(V, tmp.x, tmp.y, tmp);
      const dd = Math.hypot(tmp.x - x, tmp.y - y);
      if (dd >= radius) return;
      const armourCut = p.def.armor > 20 ? 20 / p.def.armor : 1;
      damagePart(B, V, i, dmg * (1 - dd / radius) * armourCut, source);
    });
  }
  // Trees near the blast fall.
  for (const tr of B.T.trees) if (tr.alive && Math.abs(tr.x - x) < radius * 0.7) breakTree(B, tr, tr.x > x ? 1 : -1);
}

function breakTree(B, tr, dir) {
  tr.alive = false;
  tr.fallDir = dir;
  fxDirt(B, tr.x, B.T.height(tr.x) + 0.5, 6);
  audio.sfx('crunch', B.panOf(tr.x), 0.6);
}

// Detach a group of parts as a tumbling debris body.
function spawnDebris(B, V, idxs, at, kick) {
  const dd = debris.take();
  const img = renderPartsSprite(V, idxs);
  dd.img = img.canvas; dd.iw = img.w; dd.ih = img.h;
  dd.x = at.x; dd.y = at.y; dd.a = V.body.a;
  dd.vx = V.body.vx + B.rng.range(-kick, kick) * 0.6;
  dd.vy = V.body.vy + B.rng.range(kick * 0.4, kick);
  dd.w = B.rng.range(-5, 5);
  dd.t = 0;
  dd.r = Math.max(img.w, img.h) * 0.25;
  dd.dir = V.dir;
}

// ---------- projectile update
function stepShells(B, dt) {
  const T = B.T;
  shells.forEachAlive((s) => {
    s.px = s.x; s.py = s.y;
    s.t += dt;
    if (!s.mg) s.vy -= GRAVITY * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.ignoreT > 0) { s.ignoreT -= dt; if (s.ignoreT <= 0) s.ignore = null; }
    // Incoming artillery whistles for its last second and a half.
    if (s.def.indirect && !s.whistled && s.vy < 0 && (s.y - T.height(s.x)) / -s.vy < 1.5) { s.whistled = true; audio.sfx('whistle', B.panOf(s.x)); }
    const maxT = s.mg ? weaponRange(s.def) * MG_RANGE_BONUS / s.def.vel * 1.3 : 8;
    if (s.t > maxT || s.x < 0 || s.x > T.length || s.y < -50) { s.alive = false; return; }
    // Vehicles.
    for (const V of B.units) {
      if (V === s.ignore) continue;
      if (V.side === s.side && !V.destroyed) continue;       // no friendly fire on live allies
      const b = V.body;
      // Distance from the vehicle centre to this step's segment.
      const ex = s.x - s.px, ey = s.y - s.py;
      const l2 = ex * ex + ey * ey || 1;
      const t = clamp(((b.x - s.px) * ex + (b.y - s.py) * ey) / l2, 0, 1);
      if (Math.hypot(s.px + ex * t - b.x, s.py + ey * t - b.y) > V.radius) continue;
      if (shellVsVehicle(B, s, V)) { s.alive = false; return; }
    }
    // Water: bullets stop at the surface, high explosive bursts on it, and shells
    // slow sharply and die 1.5 m down (design/01 §7.1 sea layer).
    if (seaAt(T, s.x) && s.y < T.sea) {
      if (!s.wet) {
        s.wet = true;
        fxSplash(B, s.x, T.sea, s.mg ? 0.3 : s.he ? 1.6 : 1);
        if (s.mg) { s.alive = false; return; }
        if (s.he) { s.alive = false; explode(B, s.x, T.sea, s.def.heDmg || s.dmg, s.def.heRadius || 3, s.shooter); return; }
        audio.sfx('splash', B.panOf(s.x), 0.7);
        s.vx *= 0.2; s.vy *= 0.2;
      }
      if (s.y < T.sea - 1.5) { s.alive = false; return; }
    }
    // Ground.
    const gh = T.height(s.x);
    if (s.y <= gh) {
      s.alive = false;
      if (s.he) explode(B, s.x, gh, s.def.heDmg || s.dmg, s.def.heRadius || 3, s.shooter);
      else fxDirt(B, s.x, gh, s.mg ? 1 : 5);
      if (!s.mg && !s.he) audio.sfx('thud', B.panOf(s.x), 0.8);
    }
  });
}
