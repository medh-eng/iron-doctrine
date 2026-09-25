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

// Placement rules (design/01 §8.1). Messages state facts only.
function validateDesign(design) {
  const errors = [];
  const W = design.w, H = design.h;
  const count = new Int16Array(W * H);
  let lowest = -1;
  let crew = 0, needCrew = 1, engines = 0, loco = 0;
  for (const c of design.cells) {
    const d = PARTS[c.p];
    if (!d) { errors.push(`Unknown part ${c.p}.`); continue; }
    if (c.x < 0 || c.y < 0 || c.x + d.w > W || c.y + d.h > H) errors.push(`${d.name} is outside the grid.`);
    for (let yy = c.y; yy < c.y + d.h; yy++) for (let xx = c.x; xx < c.x + d.w; xx++) {
      if (xx >= 0 && yy >= 0 && xx < W && yy < H) count[yy * W + xx]++;
    }
    lowest = Math.max(lowest, c.y + d.h - 1);
    if (d.crew) crew += d.crew;
    if (d.cat === 'weapon' && d.id !== 'smoke' && !d.auto) needCrew++;
    if (d.power > 0) engines++;
    if (d.loco) loco++;
  }
  if (count.some((n) => n > 1)) errors.push('Two parts overlap.');
  for (const c of design.cells) {
    const d = PARTS[c.p];
    if (d && d.loco && c.y + d.h - 1 !== lowest) errors.push(`${d.name} does not touch the lowest row.`);
  }
  if (!loco) errors.push('No wheels or tracks.');
  if (!engines) errors.push('No engine.');
  if (crew < needCrew) errors.push(`Crew needed ${needCrew}, crew space ${crew}.`);
  const groups = components(design, occupancy(design));
  if (groups.length > 1) errors.push(`${groups.length - 1} part group(s) are not connected to the rest.`);
  return { ok: errors.length === 0, errors };
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
  };
}
