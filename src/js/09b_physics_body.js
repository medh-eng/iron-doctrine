/* ==== 09b PHYSICS: VEHICLE BODIES ==== */
// A vehicle is one rigid body made of its parts (design/01 §7.3, design/04 §6).
// Wheels and track units are spring-damper contacts on the heightfield; engines
// drive them. Mass, centre of mass, inertia, grip and resistance all come from
// the parts, so tipping, stalling and bogging down emerge from the numbers.

const DRIVE_EFF = { wheel: 0.85, track: 0.75 };
const SUSPENSION_HZ = 2.2;       // natural frequency of the contact springs
const SUSPENSION_DAMP = 0.7;     // damping ratio
const PHYS_SUBSTEPS = 2;
const REVERSE_CAP = 0.45;        // reverse speed as a share of the forward cap
const LOW_GEAR_SPEED = 2.5;      // m/s: below this, drive force stops rising (lowest gear), design/05 §7.1

let nextVehicleId = 1;

function makeVehicle(design, side, x, dir, terrain) {
  const V = {
    id: nextVehicleId++,
    design,
    name: design.name,
    side,                       // 0 = player (League), 1 = enemy (Directorate)
    dir,                        // +1 faces right, −1 faces left
    parts: design.cells.map((c) => {
      const d = PARTS[c.p];
      return { def: d, x: c.x, y: c.y, hp: d.hp, alive: true, burn: 0, scorch: 0 };
    }),
    alive: null,                // Uint8Array mirror of parts[i].alive
    grid: null,
    body: { x, y: 0, a: 0, vx: 0, vy: 0, w: 0, m: 1, I: 1 },
    com: { x: 0, y: 0 },
    contacts: [],
    weapons: [],
    throttle: 0,
    speed: 0,
    destroyed: false,           // knocked out or blown up
    immobile: false,
    canDrive: true,
    crew: 0,
    fuel: 0,
    fuelMax: 0,
    shells: 0,
    shellsMax: 0,
    hpMax: 0,
    stuckT: 0,
    bogNoteT: 0,
    spotted: 0,                 // seconds left visible to the other side
    revealT: 0,                 // muzzle flash reveals the shooter
    lastHitT: -99,
    dirty: true,                // sprite needs redrawing
    ai: null,
  };
  V.alive = new Uint8Array(V.parts.length).fill(1);
  for (const p of V.parts) V.hpMax += p.hp;
  rebuildVehicle(V, true);
  V.fuel = V.fuelMax;
  V.shells = V.shellsMax;
  // Rest on the ground: lowest contact touching the terrain. Ships float level on their waterline.
  const b = V.body;
  b.x = x;
  if (V.hull && seaAt(terrain, x - V.len / 2) && terrain.height(x) < terrain.sea - V.stats.draft) {
    b.a = 0;
    b.y = terrain.sea - (V.stats.waterline - V.com.y);
    return V;
  }
  b.a = Math.atan(terrain.slope(x));
  let low = Infinity;
  for (const c of V.contacts) low = Math.min(low, c.ly - c.r);
  b.y = terrain.height(x) - low / Math.cos(b.a) + 0.05;
  return V;
}

// Local (body) coordinates of a grid-space point (metres from the grid's bottom-left).
function gridToLocal(V, gx, gy, out) {
  out.x = (gx - V.com.x) * V.dir;
  out.y = gy - V.com.y;
  return out;
}

function localToWorld(V, lx, ly, out) {
  const b = V.body;
  const c = Math.cos(b.a), s = Math.sin(b.a);
  out.x = b.x + lx * c - ly * s;
  out.y = b.y + lx * s + ly * c;
  return out;
}

// World point -> grid space (metres, origin bottom-left of the grid, y up).
function worldToGrid(V, wx, wy, out) {
  const b = V.body;
  const c = Math.cos(b.a), s = Math.sin(b.a);
  const dx = wx - b.x, dy = wy - b.y;
  const lx = dx * c + dy * s;
  const ly = -dx * s + dy * c;
  out.x = lx * V.dir + V.com.x;
  out.y = ly + V.com.y;
  return out;
}

// Recompute mass, centre of mass, inertia, contacts and weapons from the live parts.
// Keeps the world position of the parts unchanged when the centre of mass moves.
function rebuildVehicle(V, first) {
  const D = V.design;
  // Every part shot away: nothing left to simulate.
  if (!V.parts.some((p) => p.alive)) {
    V.gone = true;
    V.contacts = []; V.weapons = []; V.wcells = null; V.props = null;
    V.canDrive = false; V.immobile = true; V.crew = 0;
    V.dirty = true;
    return;
  }
  const st = statsOf(D, V.alive);
  const b = V.body;
  if (!first && st.mass > 0) {
    const tmp = { x: 0, y: 0 };
    gridToLocal(V, st.com.x, st.com.y, tmp);
    localToWorld(V, tmp.x, tmp.y, tmp);
    b.x = tmp.x; b.y = tmp.y;
  }
  V.com.x = st.com.x;
  V.com.y = st.com.y;
  V.stats = st;
  b.m = Math.max(st.mass, 1);
  V.grid = occupancy(D, V.alive);

  let I = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let engines = 0, crew = 0, fuelMax = 0, shellsMax = 10, loco = 0, spot = 1, fc = 1, stab = false, smoke = 0, sonar = 0;
  const contacts = [];
  const weapons = [];
  V.night = 0;
  V.parts.forEach((p, i) => {
    if (!p.alive) return;
    const d = p.def;
    const cx = (p.x + d.w / 2) * CELL;
    const cy = (D.h - p.y - d.h / 2) * CELL;
    const rx = cx - st.com.x, ry = cy - st.com.y;
    I += d.mass * (rx * rx + ry * ry) + (d.mass * ((d.w * CELL) ** 2 + (d.h * CELL) ** 2)) / 12;
    minX = Math.min(minX, p.x * CELL); maxX = Math.max(maxX, (p.x + d.w) * CELL);
    minY = Math.min(minY, (D.h - p.y - d.h) * CELL); maxY = Math.max(maxY, (D.h - p.y) * CELL);
    if (d.power > 0) engines += d.power;
    if (d.crew) crew += d.crew;
    if (d.fuel) fuelMax += d.fuel;
    if (d.shells) shellsMax += d.shells;
    if (d.spot) spot = Math.max(spot, d.spot);
    if (d.night) V.night = Math.max(V.night || 0, d.night);
    if (d.accuracy) fc = Math.max(fc, d.accuracy);
    if (d.sonar) sonar = Math.max(sonar, d.sonar * BATTLE_DISTANCE_SCALE);
    if (d.id === 'stab') stab = true;
    if (d.id === 'smoke') smoke += d.salvos;
    if (d.propeller) loco++;
    if (d.loco) {
      loco++;
      const pts = d.loco === 'track' ? [cx - 0.25, cx + 0.25] : [cx];
      for (const px of pts) contacts.push({ gx: px, gy: cy, r: d.radius, loco: d.loco, part: i, lx: 0, ly: 0, N: 0 });
    }
    if (d.cat === 'weapon' && d.id !== 'smoke') {
      // Turret weapons sit on parts connected to the hull through a turret ring.
      const old = V.weapons.find((w) => w.part === i);
      weapons.push(old || {
        part: i, def: d, reload: 0, angle: V.dir > 0 ? 0 : Math.PI, face: V.dir, swing: 0, burst: 0, gap: 0,
        pivotGx: p.x * CELL + CELL * 0.5, pivotGy: cy, turret: false, rounds: d.rounds || 0,
      });
    }
  });
  // Hull contacts: corners of the body, so tipped or wrecked vehicles still rest on the ground.
  const hullPts = [[minX, minY + 0.3], [maxX, minY + 0.3], [(minX + maxX) / 2, minY + 0.3], [minX, maxY], [maxX, maxY], [(minX + maxX) / 2, maxY]];
  for (const [gx, gy] of hullPts) contacts.push({ gx, gy, r: 0, loco: null, part: -1, lx: 0, ly: 0, N: 0 });
  const tmp = { x: 0, y: 0 };
  for (const c of contacts) { gridToLocal(V, c.gx, c.gy, tmp); c.lx = tmp.x; c.ly = tmp.y; }

  // Turret weapons: a weapon whose part group, without the ring, sits above a live turret ring.
  const ring = V.parts.findIndex((p) => p.alive && p.def.ring);
  if (ring >= 0) {
    const rp = V.parts[ring];
    for (const w of weapons) w.turret = V.parts[w.part].y < rp.y;
  }

  b.I = Math.max(I, 1);
  V.contacts = contacts;
  V.weapons = weapons;
  V.nLoco = Math.max(1, contacts.filter((c) => c.loco).length);
  const K = b.m * (2 * Math.PI * SUSPENSION_HZ) ** 2;
  V.k = K / Math.max(V.nLoco, 3);
  V.c = (2 * SUSPENSION_DAMP * Math.sqrt(K * b.m)) / Math.max(V.nLoco, 3);
  V.power = engines;
  V.crew = crew;
  V.canDrive = engines > 0 && crew > 0 && loco > 0;
  V.immobile = !V.canDrive;
  V.fuelMax = fuelMax;
  V.fuel = Math.min(V.fuel, fuelMax);
  V.shellsMax = Math.max(V.shellsMax, shellsMax);
  V.spot = spot;
  V.fc = fc;
  V.sonar = sonar;
  V.stab = stab;
  V.smoke = V.smoke === undefined ? smoke : Math.min(V.smoke, smoke);
  V.bounds = { minX, maxX, minY, maxY };
  V.len = maxX - minX;
  V.height = maxY - minY;
  V.radius = Math.hypot(V.len, V.height) / 2 + 0.5;
  V.soft = V.parts.every((p) => !p.alive || p.def.armor <= 15);
  V.dirty = true;
  buildWaterParts(V);
}

const _wf = { fx: 0, fy: 0, tq: 0 };

function stepVehicle(V, T, dt) {
  if (V.gone) return;
  const b = V.body;
  const h = dt / PHYS_SUBSTEPS;
  const st = V.stats;
  const pf = clamp(st.pressure / 100, 0.3, 3);
  const eff = DRIVE_EFF[st.loco] || 0.8;
  const avail = V.power >= st.drawn ? 1 : V.power / Math.max(st.drawn, 1);
  const hasFuel = V.fuelMax === 0 || V.fuel > 0;
  const Peff = V.canDrive && hasFuel ? V.power * 1000 * eff * avail : 0;
  const capBase = (st.cap / 3.6) * BATTLE_SPEED_SCALE * (V.speedMul || 1);
  const dragA = V.height * 2.5;
  const throttle = V.canDrive ? V.throttle : 0;

  for (let s = 0; s < PHYS_SUBSTEPS; s++) {
    const ca = Math.cos(b.a), sa = Math.sin(b.a);
    let fx = 0, fy = -b.m * GRAVITY, tq = 0;
    let nGround = 0, sumMuN = 0;
    // Normal forces.
    for (const c of V.contacts) {
      const rx = c.lx * ca - c.ly * sa;
      const ry = c.lx * sa + c.ly * ca;
      const px = b.x + rx, py = b.y + ry;
      c.N = 0;
      const pen = T.height(px) - (py - c.r);
      if (pen <= 0) continue;
      const sl = T.slope(px);
      const inv = 1 / Math.sqrt(1 + sl * sl);
      const nx = -sl * inv, ny = inv;
      const vpx = b.vx - b.w * ry, vpy = b.vy + b.w * rx;
      const vn = vpx * nx + vpy * ny;
      const N = Math.max(0, V.k * Math.min(pen, 0.6) - V.c * vn);
      c.N = N; c.rx = rx; c.ry = ry; c.nx = nx; c.ny = ny;
      c.vt = vpx * ny - vpy * nx;          // along the tangent (ny, −nx)
      c.ter = T.terrainAt(px);
      fx += nx * N; fy += ny * N;
      tq += rx * ny * N - ry * nx * N;
      if (c.loco) { nGround++; sumMuN += c.ter.grip * N; }
    }
    // Drive force (design/05 §7.1): min(P ÷ v, μ × load), faded out at the speed cap.
    const vAlong = b.vx * ca + b.vy * sa;
    let drive = 0;
    if (throttle !== 0 && nGround > 0) {
      const sign = throttle > 0 ? 1 : -1;
      const cap = capBase * (sign === V.dir ? 1 : REVERSE_CAP);
      const fwd = vAlong * sign;
      drive = Math.min(Peff / Math.max(Math.abs(vAlong), LOW_GEAR_SPEED), sumMuN) * Math.abs(throttle);
      if (fwd > cap) drive = -Math.min(sumMuN * 0.4, (b.m * (fwd - cap)) / h);   // engine braking downhill
      else if (fwd > cap - 0.6) drive *= (cap - fwd) / 0.6;
      drive *= sign;
    }
    const mShare = b.m / Math.max(1, nGround);
    for (const c of V.contacts) {
      if (c.N <= 0) continue;
      const tx = c.ny, ty = -c.nx;
      let resist;
      let Ft = 0;
      if (c.loco) {
        const ter = c.ter;
        const crr = c.loco === 'track' ? 0.04 + ter.soft * 0.08 * pf : 0.015 + ter.soft * 0.25 * pf;
        resist = crr * c.N;
        Ft = sumMuN > 0 ? (drive * ter.grip * c.N) / sumMuN : 0;
        // Brakes hold when there's no throttle, or when throttle opposes the motion.
        if (throttle === 0 || (Math.abs(c.vt) > 0.3 && Math.sign(throttle) !== Math.sign(c.vt))) resist += ter.grip * c.N * 0.8;
      } else {
        resist = 0.55 * c.N;           // hull scraping along the ground
      }
      // Coulomb-style: resistance can stop a contact but never push it backwards.
      let F;
      if (Math.abs(c.vt) > 0.05) {
        F = Ft - Math.sign(c.vt) * Math.min(resist, (Math.abs(c.vt) * mShare) / h + Math.abs(Ft));
      } else if (Math.abs(Ft) <= resist) {
        F = (-c.vt * mShare) / h * 0.5;
      } else {
        F = Ft - Math.sign(Ft) * resist;
      }
      fx += tx * F; fy += ty * F;
      tq += c.rx * ty * F - c.ry * tx * F;
    }
    // Water: buoyancy, flooding, hull drag and propellers (09c).
    if (seaAt(T, b.x + V.radius) && b.y - V.radius < T.sea) {
      _wf.fx = fx; _wf.fy = fy; _wf.tq = tq;
      waterForces(V, T, ca, sa, throttle, h, _wf);
      fx = _wf.fx; fy = _wf.fy; tq = _wf.tq;
    }
    // Air drag.
    const v2 = b.vx * b.vx + b.vy * b.vy;
    if (v2 > 0.01) {
      const v = Math.sqrt(v2);
      const fd = 0.5 * 1.225 * 0.9 * dragA * v2;
      fx -= (fd * b.vx) / v; fy -= (fd * b.vy) / v;
    }
    // Semi-implicit Euler.
    b.vx += (fx / b.m) * h;
    b.vy += (fy / b.m) * h;
    b.w += (tq / b.I) * h;
    b.w *= 0.998;
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.a += b.w * h;
  }
  // Keep inside the battlefield.
  const lo = 3 + V.len / 2, hi = T.length - 3 - V.len / 2;
  if (b.x < lo) { b.x = lo; if (b.vx < 0) b.vx = 0; }
  if (b.x > hi) { b.x = hi; if (b.vx > 0) b.vx = 0; }
  if (b.a > Math.PI) b.a -= Math.PI * 2;
  if (b.a < -Math.PI) b.a += Math.PI * 2;
  V.speed = b.vx * Math.cos(b.a) + b.vy * Math.sin(b.a);
  // Fuel: litres per hour at full load, from the live engines.
  if (throttle !== 0 && V.fuelMax > 0) {
    let use = 0;
    for (const p of V.parts) if (p.alive && p.def.fuelUse) use += p.def.fuelUse;
    V.fuel = Math.max(0, V.fuel - (use * Math.abs(throttle) * dt) / 3600 * 20);
  }
}

// Soft push so vehicles don't drive through each other.
function separateVehicles(list) {
  for (let i = 0; i < list.length; i++) {
    const A = list[i];
    if (A.gone) continue;
    for (let j = i + 1; j < list.length; j++) {
      const B = list[j];
      if (B.gone) continue;
      const dx = B.body.x - A.body.x;
      const need = (A.len + B.len) / 2 * 0.85;
      if (Math.abs(dx) >= need || Math.abs(B.body.y - A.body.y) > (A.height + B.height) / 2) continue;
      const push = (need - Math.abs(dx)) / 2;
      const s = dx >= 0 ? 1 : -1;
      const ma = A.body.m, mb = B.body.m;
      A.body.x -= s * push * (mb / (ma + mb)) * 2;
      B.body.x += s * push * (ma / (ma + mb)) * 2;
      const rel = (B.body.vx - A.body.vx) * s;
      if (rel < 0) {
        const vcm = (A.body.vx * ma + B.body.vx * mb) / (ma + mb);
        A.body.vx = vcm; B.body.vx = vcm;
      }
    }
  }
}

// ---------- debris: detached parts tumble, bounce and fade after 6 s (design/03 §4)
const debris = makePool(() => ({ alive: false, x: 0, y: 0, a: 0, vx: 0, vy: 0, w: 0, t: 0, img: null, iw: 0, ih: 0, r: 0.5 }), 48);

function stepDebris(T, dt) {
  debris.forEachAlive((d) => {
    d.t += dt;
    if (d.t > 6) { d.alive = false; return; }
    d.vy -= GRAVITY * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.a += d.w * dt;
    const g = T.height(d.x);
    if (d.y - d.r < g) {
      d.y = g + d.r;
      if (d.vy < 0) d.vy = -d.vy * 0.3;
      d.vx *= 0.7;
      d.w *= 0.6;
    }
  });
}
