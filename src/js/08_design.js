/* ==== 08 DESIGN ==== */
// Grid model, placement rules and derived numbers (design/01 §8, design/05 §7).
// Design = { id, name, w, h, cells:[{p, x, y}] }; grid y = 0 is the top row.

function designFromTemplate(id) {
  const t = TEMPLATES[id];
  return {
    id,
    name: t.name,
    w: t.w,
    h: t.h,
    soft: !!t.soft,
    mark: 1,
    cells: t.cells.map(([p, x, y]) => ({ p, x, y })),
  };
}

// Occupancy grid: index of the cell entry in design.cells, or -1.
function occupancy(design, alive) {
  const g = new Int16Array(design.w * design.h).fill(-1);
  design.cells.forEach((c, i) => {
    if (alive && !alive[i]) return;
    const d = PARTS[c.p];
    for (let yy = c.y; yy < c.y + d.h; yy++) {
      for (let xx = c.x; xx < c.x + d.w; xx++) {
        if (xx >= 0 && yy >= 0 && xx < design.w && yy < design.h) g[yy * design.w + xx] = i;
      }
    }
  });
  return g;
}

// Parts that touch along an edge are connected. Returns an array of neighbour lists.
function adjacency(design, grid, alive) {
  const n = design.cells.length;
  const adj = Array.from({ length: n }, () => new Set());
  const W = design.w, H = design.h;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = grid[y * W + x];
      if (a < 0 || (alive && !alive[a])) continue;
      if (x + 1 < W) { const b = grid[y * W + x + 1]; if (b >= 0 && b !== a) { adj[a].add(b); adj[b].add(a); } }
      if (y + 1 < H) { const b = grid[(y + 1) * W + x]; if (b >= 0 && b !== a) { adj[a].add(b); adj[b].add(a); } }
    }
  }
  return adj;
}

// Connected groups of parts (each an array of cell indices).
function components(design, grid, alive) {
  const adj = adjacency(design, grid, alive);
  const seen = new Uint8Array(design.cells.length);
  const groups = [];
  for (let i = 0; i < design.cells.length; i++) {
    if (seen[i] || (alive && !alive[i])) continue;
    const group = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const a = stack.pop();
      group.push(a);
      for (const b of adj[a]) if (!seen[b]) { seen[b] = 1; stack.push(b); }
    }
    groups.push(group);
  }
  return groups;
}

// The domain comes from the parts used (design/01 §8.1): watertight hull parts make a ship.
// Ballast tanks make a watertight hull a submarine.
function domainOf(design) {
  let sealed = false;
  for (const c of design.cells) {
    const d = PARTS[c.p];
    if (!d) continue;
    if (d.ballast) return 'sub';
    if (d.sealed) sealed = true;
  }
  return sealed ? 'naval' : 'ground';
}
const DOMAIN_NAMES = { ground: 'Ground', naval: 'Ship', sub: 'Submarine' };
const seaDomain = (domain) => domain === 'naval' || domain === 'sub';

// Placement rules (design/01 §8.1). Messages state facts only.
function validateDesign(design) {
  const errors = [];
  const W = design.w, H = design.h;
  const count = new Int16Array(W * H);
  const domain = domainOf(design);
  let lowest = -1;
  let crew = 0, needCrew = 1, engines = 0, loco = 0, keels = 0, props = 0;
  for (const c of design.cells) {
    const d = PARTS[c.p];
    if (!d) { errors.push(`Unknown part ${c.p}.`); continue; }
    if (c.x < 0 || c.y < 0 || c.x + d.w > W || c.y + d.h > H) errors.push(`${d.name} is outside the grid.`);
    for (let yy = c.y; yy < c.y + d.h; yy++) for (let xx = c.x; xx < c.x + d.w; xx++) {
      if (xx >= 0 && yy >= 0 && xx < W && yy < H) count[yy * W + xx]++;
    }
    lowest = Math.max(lowest, c.y + d.h - 1);
    if (d.crew) crew += d.crew;
    if (d.cat === 'weapon' && d.id !== 'smoke' && !d.auto && !d.secondary) needCrew++;
    if (d.power > 0) engines++;
    if (d.loco) loco++;
    if (d.keel) keels++;
    if (d.propeller) props++;
  }
  if (count.some((n) => n > 1)) errors.push('Two parts overlap.');
  if (domain === 'ground') {
    // Track segments need a run of 3 or more side by side (design/05 §2).
    const runs = design.cells.filter((c) => PARTS[c.p] && PARTS[c.p].loco === 'track').map((c) => c.x).sort((a, b) => a - b);
    for (let i = 0, run = 1; i < runs.length; i++) {
      if (i + 1 < runs.length && runs[i + 1] === runs[i] + 2) { run++; continue; }
      if (run < 3) { errors.push(`A run of ${run} track segment${run > 1 ? 's' : ''}; tracks need 3 in a row.`); break; }
      run = 1;
    }
    for (const c of design.cells) {
      const d = PARTS[c.p];
      if (d && d.loco && c.y + d.h - 1 !== lowest) errors.push(`${d.name} does not touch the lowest row.`);
    }
    if (!loco) errors.push(props ? 'Propellers need a ship hull; no wheels or tracks.' : 'No wheels or tracks.');
  } else {
    // Ships need a sealed hull with a keel (design/01 §8.1), a propeller in the water, and must float.
    if (!keels) errors.push('No keel.');
    for (const c of design.cells) {
      const d = PARTS[c.p];
      if (d && d.keel && c.y + d.h - 1 !== lowest) errors.push('A keel does not touch the lowest row.');
    }
    const st = statsOf(design);
    if (!props) errors.push('No propeller.');
    else if (!st.propsWet) errors.push('No propeller below the waterline.');
    if (st.reserve <= 0) errors.push(`Mass ${(st.mass / 1000).toFixed(1)} t; the hull displaces ${(st.dispMax / 1000).toFixed(1)} t. It sinks.`);
    else if (domain === 'sub' && st.diveNeed > st.ballastCap) errors.push(`Diving needs ${(st.diveNeed / 1000).toFixed(1)} t of ballast; the tanks hold ${(st.ballastCap / 1000).toFixed(1)} t.`);
  }
  if (!engines) errors.push('No engine.');
  if (crew < needCrew) errors.push(`Crew needed ${needCrew}, crew space ${crew}.`);
  const groups = components(design, occupancy(design));
  if (groups.length > 1) errors.push(`${groups.length - 1} part group(s) are not connected to the rest.`);
  return { ok: errors.length === 0, errors, domain };
}

// Ships (design/05 §7.3): beam from the hull length; a watertight cell displaces 0.25 m² × beam.
// Always measured on the whole design, so the beam doesn't change as parts are shot away.
function hullOf(design) {
  let x0 = Infinity, x1 = -Infinity;
  for (const c of design.cells) { const d = PARTS[c.p]; if (d && d.sealed) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x + d.w); } }
  if (x1 <= x0) return null;
  const length = (x1 - x0) * CELL;
  const beam = clamp(length * 0.18, 2.5, 12);
  return { length, beam, cellVol: 0.25 * beam };
}

// Derived numbers (design/01 §8.2, design/05 §7). Pure; `alive` optional.
function statsOf(design, alive) {
  let mass = 0, mx = 0, my = 0, power = 0, drawn = 0, contact = 0, cap = Infinity;
  let wheels = 0, tracks = 0, minX = Infinity, maxX = -Infinity, top = 0, fuel = 0, shells = 0, crew = 0;
  design.cells.forEach((c, i) => {
    if (alive && !alive[i]) return;
    const d = PARTS[c.p];
    const cx = (c.x + d.w / 2) * CELL;
    const cy = (design.h - c.y - d.h / 2) * CELL;
    mass += d.mass;
    mx += d.mass * cx;
    my += d.mass * cy;
    if (d.power > 0) power += d.power; else drawn -= d.power;
    if (d.loco) {
      contact += d.contact;
      cap = Math.min(cap, d.cap);
      if (d.loco === 'track') tracks++; else wheels++;
      minX = Math.min(minX, c.x * CELL);
      maxX = Math.max(maxX, (c.x + d.w) * CELL);
    }
    top = Math.max(top, (design.h - c.y) * CELL);
    if (d.fuel) fuel += d.fuel;
    if (d.shells) shells += d.shells;
    if (d.crew) crew += d.crew;
  });
  const com = mass ? { x: mx / mass, y: my / mass } : { x: 0, y: 0 };
  const loco = tracks && !wheels ? 'track' : 'wheel';
  const ship = shipNumbers(design, alive, mass);
  const pressure = contact ? (mass * GRAVITY) / contact / 1000 : Infinity;   // kPa
  const base = maxX > minX ? maxX - minX : 0;
  return {
    mass,
    com,
    power,
    drawn,
    powerToWeight: mass ? power / (mass / 1000) : 0,   // kW per tonne
    contact,
    pressure,
    loco,
    cap: cap === Infinity ? 0 : cap,
    tipAngle: com.y > 0 ? (Math.atan(base / 2 / com.y) * 180) / Math.PI : 0,
    height: top,
    fuel,
    shells,
    crew,
    ...ship,
  };
}

// Waterline, draft, reserve buoyancy and centre of buoyancy for a ship floating level (design/05 §7.3).
function shipNumbers(design, alive, mass) {
  const hull = hullOf(design);
  if (!hull) return { hull: null, reserve: 0, dispMax: 0, propsWet: 0 };
  const H = design.h;
  const rowVol = new Float64Array(H), rowX = new Float64Array(H);
  let bottom = Infinity, top = -Infinity, props = [], ballastCap = 0, electric = 0;
  design.cells.forEach((c, i) => {
    const d = PARTS[c.p];
    if (d.ballast && (!alive || alive[i])) ballastCap += d.ballast;
    if (d.electric && (!alive || alive[i])) electric += d.power;
    bottom = Math.min(bottom, (H - c.y - d.h) * CELL);
    if (d.propeller && (!alive || alive[i])) props.push((H - c.y - d.h) * CELL);
    if (!d.sealed || (alive && !alive[i])) return;
    top = Math.max(top, (H - c.y) * CELL);
    for (let yy = c.y; yy < c.y + d.h; yy++) for (let xx = c.x; xx < c.x + d.w; xx++) {
      const r = H - 1 - yy;
      const v = hull.cellVol * d.sealed;
      rowVol[r] += v;
      rowX[r] += v * (xx + 0.5) * CELL;
    }
  });
  let dispMax = 0;
  for (let r = 0; r < H; r++) dispMax += rowVol[r] * 1000;
  // Fill rows from the bottom until the displaced water weighs as much as the ship.
  let acc = 0, wl = top, bx = 0, by = 0, bv = 0;
  for (let r = 0; r < H; r++) {
    const m = rowVol[r] * 1000;
    if (!m) continue;
    const f = acc + m >= mass ? (mass - acc) / m : 1;
    bv += rowVol[r] * f; bx += rowX[r] * f; by += rowVol[r] * f * (r + f / 2) * CELL;
    acc += m * f;
    if (f < 1) { wl = (r + f) * CELL; break; }
  }
  return {
    hull,
    dispMax,
    reserve: dispMax ? (dispMax - mass) / dispMax : 0,
    waterline: wl,                                // metres above the grid's bottom edge
    draft: Math.max(0, wl - bottom),
    freeboard: top - wl,
    cob: bv ? { x: bx / bv, y: by / bv } : { x: 0, y: 0 },
    propsWet: props.filter((y) => y < wl).length,
    ballastCap,
    diveNeed: dispMax - mass,                     // kg of ballast water to hang level under water
    electric,                                     // kW that works submerged
  };
}

// Top speed submerged (km/h, design sheet): electric motors only, the whole hull under water.
function subSpeed(st) {
  if (!st.hull || !st.electric || !st.propsWet) return 0;
  const P = st.electric * 1000 * PROP_EFF;
  const A = st.dispMax / 1000 / st.hull.length;
  return Math.cbrt(P / (0.5 * 1000 * SHIP_CD * A)) * 3.6;
}

// Top speed at sea (km/h, design sheet): propeller thrust against hull resistance on the
// submerged cross-section (displaced volume ÷ hull length). Heavier ships sit deeper and go slower.
function shipSpeed(st) {
  if (!st.hull || !st.propsWet || !st.power || st.reserve <= 0) return 0;
  const avail = st.power >= st.drawn ? 1 : st.power / Math.max(1, st.drawn);
  const P = st.power * 1000 * PROP_EFF * avail;
  const A = st.mass / 1000 / st.hull.length;
  return Math.cbrt(P / (0.5 * 1000 * SHIP_CD * A)) * 3.6;
}

// ---------- Drafting Office numbers (design/01 §8.2, design/05 §7). Design-sheet units, not battle units.
const CLASSES = {
  light: { name: 'Light ground', w: 16, h: 8, domain: 'ground' },
  heavy: { name: 'Heavy ground', w: 28, h: 12, domain: 'ground' },
  ship: { name: 'Ship', w: 44, h: 16, domain: 'naval' },
  sub: { name: 'Submarine', w: 44, h: 16, domain: 'sub' },
};

function partCost(d) { let s = 0; for (const k in d.cost) s += d.cost[k]; return s; }
function costOf(design) { return design.cells.reduce((s, c) => s + partCost(PARTS[c.p]), 0); }

// Top speed (km/h) on a terrain: where drive force meets rolling resistance and drag.
function topSpeed(st, ter) {
  if (!st.power || !st.contact || !st.mass) return 0;
  const pf = clamp(st.pressure / 100, 0.3, 3);
  const crr = st.loco === 'track' ? 0.04 + ter.soft * 0.08 * pf : 0.015 + ter.soft * 0.25 * pf;
  const m = st.mass, g = GRAVITY;
  const P = st.power * 1000 * (DRIVE_EFF[st.loco] || 0.8) * (st.power >= st.drawn ? 1 : st.power / Math.max(1, st.drawn));
  if (ter.grip * m * g <= crr * m * g || P / 2.5 <= crr * m * g) return 0;       // bogged down
  const A = st.height * 2.5;
  let v = 1;
  for (let i = 0; i < 60; i++) {
    const res = crr * m * g + 0.5 * 1.225 * 0.9 * A * v * v;
    const drive = Math.min(P / Math.max(v, 2.5), ter.grip * m * g);
    v = clamp(v + (drive - res) / (m * 0.5), 0, 200);
  }
  return Math.min(v * 3.6, st.cap);
}

// Steepest slope (degrees) the design can start up on plains.
function climbLimit(st) {
  if (!st.power || !st.mass) return 0;
  const ter = TERRAIN[T_PLAINS];
  const pf = clamp(st.pressure / 100, 0.3, 3);
  const crr = st.loco === 'track' ? 0.04 + ter.soft * 0.08 * pf : 0.015 + ter.soft * 0.25 * pf;
  const P = st.power * 1000 * (DRIVE_EFF[st.loco] || 0.8);
  let best = 0;
  for (let deg = 0; deg <= 60; deg++) {
    const a = (deg * Math.PI) / 180;
    const need = st.mass * GRAVITY * (Math.sin(a) + crr * Math.cos(a));
    const have = Math.min(P / 2.5, ter.grip * st.mass * GRAVITY * Math.cos(a));
    if (have >= need) best = deg;
  }
  return best;
}

// Armour (mm) met first by a level shot at the height of the centre of mass (front, rear)
// and by a shot straight down through it (top). Sloped plates are marked.
function armourFacings(design) {
  const g = occupancy(design);
  const W = design.w, H = design.h;
  const st = statsOf(design);
  const at = (x, y) => { const i = g[y * W + x]; return i >= 0 ? PARTS[design.cells[i].p] : null; };
  const row = clamp(H - 1 - Math.floor(st.com.y / CELL), 0, H - 1);
  const col = clamp(Math.floor(st.com.x / CELL), 0, W - 1);
  const label = (d) => (d ? `${d.armor} mm${d.sloped ? ' sloped' : ''}` : '—');
  const scan = (xs) => { for (const x of xs) { const d = at(x, row); if (d) return d; } return null; };
  let top = null;
  for (let y = 0; y < H && !top; y++) top = at(col, y);
  return { front: label(scan([...Array(W).keys()].reverse())), rear: label(scan([...Array(W).keys()])), top: label(top) };
}

// Everything the stats drawer shows, plus factual warnings.
function designReport(design) {
  const st = statsOf(design);
  const v = validateDesign(design);
  const domain = v.domain;
  const speeds = {};
  if (seaDomain(domain)) {
    speeds[domain === 'sub' ? 'Surfaced' : 'Sea'] = Math.round(shipSpeed(st));
    if (domain === 'sub') speeds.Submerged = Math.round(subSpeed(st));
  } else for (const t of [T_ROAD, T_PLAINS, T_FOREST, T_MUD]) speeds[TERRAIN[t].name] = Math.round(topSpeed(st, TERRAIN[t]));
  let load = 0;
  const weapons = [];
  for (const c of design.cells) {
    const d = PARTS[c.p];
    if (d.maxLoad) load += d.maxLoad;
    if (d.cat === 'weapon' && d.id !== 'smoke') weapons.push(d);
  }
  const main = weapons.filter((d) => !d.auto && !d.secondary);
  const warnings = [];
  if (st.drawn > st.power) warnings.push(`Power drawn exceeds power produced by ${st.drawn - st.power} kW.`);
  if (load && st.mass > load) warnings.push(`Mass ${(st.mass / 1000).toFixed(1)} t on running gear rated ${(load / 1000).toFixed(1)} t.`);
  if (!main.length && !weapons.some((d) => d.secondary)) warnings.push('No main gun fitted.');
  if (domain === 'ground' && speeds.Mud === 0 && st.power) warnings.push('Top speed in mud is 0 km/h.');
  if (seaDomain(domain) && st.hull) {
    // Parts below the waterline that aren't watertight add weight but no buoyancy.
    const wet = new Set();
    for (const c of design.cells) {
      const d = PARTS[c.p];
      if (!d.sealed && !d.propeller && !d.wet && (design.h - c.y - d.h) * CELL < st.waterline) wet.add(d.name);
    }
    if (domain === 'sub' && !st.electric) warnings.push('No electric motor: no drive when submerged.');
    for (const n of wet) warnings.push(`${n} sits below the waterline and is not watertight.`);
    if (!design.cells.some((c) => PARTS[c.p].bulkhead)) warnings.push('No watertight bulkheads: a hole floods the whole hull.');
  }
  return {
    st, valid: v, speeds, weapons, warnings, domain,
    topSpeed: domain === 'naval' ? speeds.Sea : domain === 'sub' ? speeds.Surfaced : speeds.Plains,
    climb: climbLimit(st),
    armour: armourFacings(design),
    cost: costOf(design),
  };
}

// Change log between two designs: part counts and mass.
function changeLog(before, after) {
  const count = (d) => { const m = {}; for (const c of d.cells) m[c.p] = (m[c.p] || 0) + 1; return m; };
  const a = count(before), b = count(after);
  const lines = [];
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const n = (b[id] || 0) - (a[id] || 0);
    if (n) lines.push(`${n > 0 ? '+' : '−'}${Math.abs(n)} ${PARTS[id].name}`);
  }
  const dm = (statsOf(after).mass - statsOf(before).mass) / 1000;
  if (Math.abs(dm) >= 0.05) lines.push(`Mass ${dm > 0 ? '+' : '−'}${Math.abs(dm).toFixed(1)} t`);
  return lines;
}

// Trim empty rows and columns (saved designs are stored tight).
function cropDesign(design) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (const c of design.cells) {
    const d = PARTS[c.p];
    x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x + d.w); y1 = Math.max(y1, c.y + d.h);
  }
  if (x1 < 0) return Object.assign({}, design, { w: 1, h: 1, cells: [] });
  return Object.assign({}, design, { w: x1 - x0, h: y1 - y0, cells: design.cells.map((c) => ({ p: c.p, x: c.x - x0, y: c.y - y0 })) });
}

// Randomise (design/01 §8.3): a valid design for a class, seeded. Re-rolls until valid.
function randomDesign(seed, cls) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const d = tryRandomDesign(makeRng(seed + attempt * 7919), cls);
    if (validateDesign(d).ok) return d;
  }
  return designFromTemplate(cls === 'ship' ? 'gunboat' : cls === 'sub' ? 'sub' : 'light');
}

function tryRandomDesign(rng, cls) {
  if (cls === 'ship') return tryRandomShip(rng);
  if (cls === 'sub') return tryRandomSub(rng);
  const C = CLASSES[cls];
  const heavy = cls === 'heavy';
  const cells = [];
  const W = C.w, H = C.h;
  const grid = new Int8Array(W * H);
  const put = (p, x, y) => {
    const d = PARTS[p];
    if (x < 0 || y < 0 || x + d.w > W || y + d.h > H) return false;
    for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) if (grid[yy * W + xx]) return false;
    for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) grid[yy * W + xx] = 1;
    cells.push({ p, x, y });
    return true;
  };
  const tracks = rng.next() < (heavy ? 0.85 : 0.6);
  const span = heavy ? rng.int(14, 22) : rng.int(8, 13);
  const x0 = 1;
  let hullBottom;               // lowest hull row
  if (tracks) {
    for (let x = x0; x + 2 <= x0 + span; x += 2) put('track', x, H - 1);
    hullBottom = H - 2;
  } else {
    const big = rng.next() < 0.5;
    const wd = big ? 'wheel_l' : 'wheel_s';
    const ww = PARTS[wd].w;
    const n = rng.int(3, Math.max(3, Math.floor(span / (ww + 1))));
    for (let k = 0; k < n; k++) put(wd, x0 + Math.round((k * (span - ww)) / Math.max(1, n - 1)), H - PARTS[wd].h);
    hullBottom = H - PARTS[wd].h - 1;
  }
  const hullTop = hullBottom - 1;
  const grade = rng.pick(heavy ? ['arm40', 'arm80', 'arm40'] : ['plate', 'arm20', 'arm20', 'arm40']);
  // Engine at the rear, crew in the middle, stores beside them.
  const eng = heavy ? rng.pick(['eng_m', 'eng_h', 'eng_h']) : rng.pick(['eng_s', 'eng_m', 'eng_m']);
  put(eng, x0, hullTop);
  let x = x0 + PARTS[eng].w;
  put('crew2', x, hullTop); x += 2;
  put(rng.pick(['fuel_s', 'fuel_ss']), x, hullTop);
  put(rng.pick(['ammo', 'ammo_p']), x, hullBottom);
  x += 1;
  for (; x < x0 + span; x++) { put(x === x0 + span - 1 ? 'slope40' : grade, x, hullTop); put(grade, x, hullBottom); }
  if (rng.next() < 0.6) put('mg', x0 + span, hullBottom);
  // Turret or casemate gun.
  const gun = heavy ? rng.pick(['c75', 'c105', 'c105']) : rng.pick(['c37', 'c37', 'c75']);
  const mid = x0 + Math.floor(span / 2) - 1;
  if (rng.next() < 0.7) {
    put('turret', mid, hullTop - 1);
    put('crew2', mid, hullTop - 3);
    put(grade, mid + 2, hullTop - 2);
    put(gun, mid + 3, hullTop - 2);
    put(grade, mid - 1, hullTop - 2);
    if (rng.next() < 0.7) put('optics', mid + 1, hullTop - 4);
    if (rng.next() < 0.5) put('radio', mid, hullTop - 4);
  } else {
    put('crew2', mid, hullTop - 2);
    put(gun, mid + 2, hullTop - 2);
    if (rng.next() < 0.6) put('optics', mid, hullTop - 3);
  }
  if (rng.next() < 0.4) put(rng.pick(['fc', 'stab', 'nsight', 'smoke']), x0 + 1, hullTop - 1);
  if (rng.next() < 0.5) put('radiator', x0, hullTop - 1);
  return cropDesign({ id: 'random', name: `${C.name} (random)`, w: W, h: H, cells });
}

// A random ship: keel, one or two hull layers with bulkheads, a bow, propellers at the stern,
// an engine, a bridge and guns on deck. Stern on the left, like the templates.
function tryRandomShip(rng) {
  const C = CLASSES.ship;
  const W = C.w, H = C.h;
  const cells = [];
  const grid = new Int8Array(W * H);
  const put = (p, x, y) => {
    const d = PARTS[p];
    if (x < 0 || y < 0 || x + d.w > W || y + d.h > H) return false;
    for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) if (grid[yy * W + xx]) return false;
    for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) grid[yy * W + xx] = 1;
    cells.push({ p, x, y });
    return true;
  };
  const big = rng.next() < 0.45;
  const x0 = 3;
  const len = big ? 2 * rng.int(16, 19) : 2 * rng.int(9, 13);        // hull length in cells, even
  const layers = big ? 2 : rng.pick([1, 1, 2]);
  const bottom = H - 1;
  for (let x = x0; x + 2 <= x0 + len - 2; x += 2) put('keel', x, bottom);
  put('prop', x0 - 1, bottom - 1);
  if (big) put('prop', x0 - 2, bottom - 1);
  const every = rng.int(7, 11);
  let deck = bottom - 2 * layers;                                        // row just above the hull
  const marine = big && rng.next() < 0.8;
  const engX = x0 + 2 * rng.int(2, Math.max(2, Math.floor(len / 6)));
  for (let L = 0; L < layers; L++) {
    const y = bottom - 2 - 2 * L;
    let sinceBulk = 0;
    for (let x = x0; x < x0 + len;) {
      const last = x + 2 >= x0 + len;
      if (L === 0 && marine && x === engX && put('marine', x, bottom - 3)) { x += 4; sinceBulk += 4; continue; }
      if (grid[y * W + x]) { x++; continue; }
      if (sinceBulk >= every && !last && put('bulk', x, y)) { x++; sinceBulk = 0; continue; }
      if (last) { put(L === layers - 1 || layers === 1 ? 'bow' : 'hull', x, y); if (L < layers - 1) put('bow', x + 2, y - 2); x += 2; continue; }
      if (!put('hull', x, y)) put('plate', x, y + 1);
      x += 2; sinceBulk += 2;
    }
  }
  if (marine) { for (let x = engX; x < engX + 4; x++) put('plate', x, bottom - 4); deck = Math.min(deck, bottom - 5); }
  if (layers === 2 && !marine) deck = bottom - 5;
  // Deck: engine (if not below), bridge, main gun on a turret, machine guns.
  let x = x0;
  if (!marine) { const e = rng.pick(['eng_m', 'eng_m', 'eng_h']); put(e, x, deck - 1); x += PARTS[e].w; }
  else x += 1;
  put('fuel_s', x, deck); x += 1;
  const bridgeX = x0 + Math.floor(len * 0.45);
  for (; x < bridgeX; x++) put('plate', x, deck);
  put('crew2', bridgeX, deck - 1);
  put('optics', bridgeX, deck - 2);
  if (rng.next() < 0.6) put('radio', bridgeX + 1, deck - 2);
  x = bridgeX + 2;
  const gun = big ? rng.pick(['ngun', 'c105', 'ngun']) : rng.pick(['c37', 'c75', 'c75']);
  put('ammo', x, deck); x++;
  put('turret', x, deck);
  put('crew2', x, deck - 2);
  put(gun, x + 2, deck - PARTS[gun].h);
  x += 3;
  for (; x < x0 + len - 3; x++) put('plate', x, deck);
  put(rng.pick(['mg', 'hmg', 'hmg']), x, deck);
  if (rng.next() < 0.5) put('fc', bridgeX + 1, deck - 3) || put('fc', bridgeX - 1, deck);
  return cropDesign({ id: 'random', name: `${C.name} (random)`, w: W, h: H, cells });
}

// A random submarine: a keel, a pressure hull of one or two layers with ballast tanks fore
// and aft, an electric motor and a diesel, a bow tube and a sail with a periscope. Then trim
// weights (80 mm plates) go on the upper deck until the tanks can take it under.
function tryRandomSub(rng) {
  const C = CLASSES.sub;
  const W = C.w, H = C.h;
  const cells = [];
  const grid = new Int8Array(W * H);
  const put = (p, x, y) => {
    const d = PARTS[p];
    if (x < 0 || y < 0 || x + d.w > W || y + d.h > H) return false;
    for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) if (grid[yy * W + xx]) return false;
    for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) grid[yy * W + xx] = 1;
    cells.push({ p, x, y });
    return true;
  };
  const x0 = 4, len = 2 * rng.int(9, 14), bottom = H - 1;
  const lower = bottom - 2, upper = bottom - 4;
  for (let x = x0 + 1; x + 2 <= x0 + len - 1; x += 2) put('keel', x, bottom);
  put('prop', x0 - 1, bottom - 1);
  // Lower layer: tank, motor, hull with bulkheads, tank, bow, tube.
  put('ballast', x0, lower);
  put('emotor', x0 + 2, lower);
  let x = x0 + 4;
  const tankMid = rng.next() < 0.5 ? x0 + 2 * Math.floor(len / 4) : -1;
  while (x < x0 + len - 4) {
    if (x === tankMid) { put('ballast', x, lower); x += 2; continue; }
    if (rng.next() < 0.18 && put('bulk', x, lower)) { x++; continue; }
    if (!put('phull', x, lower)) put('plate', x, lower + 1);
    x += 2;
  }
  put('ballast', x, lower); x += 2;
  put('bow', x, lower);
  put('torp', x + 2, lower + 1);
  if (rng.next() < 0.6) put('sonar', x + 1, bottom);
  // Upper layer: tank, hull, diesel, fuel, the sail with the crew and periscope.
  put('ballast', x0 + 2, upper);
  const sail = x0 + 2 * Math.floor(len / 4) + 2;
  for (let u = x0 + 4; u < x0 + len - 6;) {
    if (u === sail) { put('crew2', u, upper); put('optics', u, upper - 1); if (rng.next() < 0.7) put('radio', u + 1, upper - 1); u += 2; continue; }
    if (u === x0 + 4) { const e = rng.pick(['eng_s', 'eng_m']); if (put(e, u, upper)) { u += PARTS[e].w; continue; } }
    if (!put('phull', u, upper)) put('fuel_s', u, upper + 1);
    u += 2;
  }
  put('fuel_s', sail + 2, upper + 1);
  let d = cropDesign({ id: 'random', name: `${C.name} (random)`, w: W, h: H, cells });
  // Trim weights until diving is possible with 2 t of ballast to spare for depth keeping.
  for (let k = 0; k < 40; k++) {
    const st = statsOf(d);
    if (st.diveNeed <= st.ballastCap - 2000) break;
    let placed = false;
    for (let yy = upper + 1; yy >= upper - 1 && !placed; yy--) for (let xx = x0; xx < x0 + len && !placed; xx++) {
      if (grid[yy * W + xx]) continue;
      const touches = (grid[(yy + 1) * W + xx] || (xx > 0 && grid[yy * W + xx - 1]) || grid[yy * W + xx + 1]);
      if (touches) placed = put('arm80', xx, yy);
    }
    if (!placed) break;
    d = cropDesign({ id: 'random', name: `${C.name} (random)`, w: W, h: H, cells });
  }
  return d;
}
