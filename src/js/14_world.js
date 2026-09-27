/* ==== 14 WORLD ==== */
// The campaign world (design/01 §2, §7; design/09 layout). One seeded, generated map of
// WORLD_W × WORLD_H cells (WORLD_KM each). The terrain is regenerated from the seed when a
// campaign loads, so saves hold only what changes: settlements, fleets, ships, officers, time.
// Also: path finding by domain, the map clock and weather.

const T_IDS = Object.keys(MAP_TERRAIN);          // terrain index ↔ id
const T_SEA = T_IDS.indexOf('sea'), T_MOUNT = T_IDS.indexOf('mountains'), T_PASS = T_IDS.indexOf('pass');

// Smooth value noise in [0, 1], seeded.
function makeNoise(seed) {
  const rng = makeRng(seed);
  const N = 256, perm = new Uint8Array(N * 2), val = new Float32Array(N);
  for (let i = 0; i < N; i++) { perm[i] = i; val[i] = rng.next(); }
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < N; i++) perm[N + i] = perm[i];
  const at = (x, y) => val[perm[(perm[x & 255] + y) & 511]];
  const s = (t) => t * t * (3 - 2 * t);
  const one = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = s(x - xi), fy = s(y - yi);
    return lerp(lerp(at(xi, yi), at(xi + 1, yi), fx), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), fx), fy);
  };
  return (x, y, oct = 4) => {
    let a = 0, amp = 1, f = 1, tot = 0;
    for (let o = 0; o < oct; o++) { a += one(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2; }
    return a / tot;
  };
}

// ---------- generation
function generateWorld(seed, playerFaction) {
  const W = WORLD_W, H = WORLD_H;
  const hN = makeNoise(seed), mN = makeNoise(seed + 11), rN = makeNoise(seed + 23);
  const height = new Float32Array(W * H), ter = new Uint8Array(W * H);
  const f = (id) => FACTIONS.find((x) => x.id === id);
  const near = (x, y, fx, fy, r) => Math.exp(-(((x / W - fx) ** 2) + ((y / H - fy) ** 2)) / (2 * r * r));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let h = hN(x / 26, y / 26, 5);
    const edge = Math.min(x, W - 1 - x, y, H - 1 - y) / 14;
    h -= (1 - clamp(edge, 0, 1)) * 0.45;                                 // ocean around the edge
    h -= near(x, y, 0.1, 0.9, 0.12) * 0.32;                              // the south-western gulf and archipelago
    h += near(x, y, 0.8, 0.22, 0.12) * (0.22 + rN(x / 7, y / 7) * 0.25); // Skyreach highlands
    h += near(x, y, 0.5, 0.5, 0.18) * 0.1;                               // the central plains rise a little
    height[y * W + x] = h;
  }
  // Sea level: about 38% of the map is water.
  const sorted = Array.from(height).sort((a, b) => a - b);
  const seaLevel = sorted[Math.floor(sorted.length * 0.38)];
  const mountLevel = sorted[Math.floor(sorted.length * 0.95)], hillLevel = sorted[Math.floor(sorted.length * 0.86)];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, h = height[i], m = mN(x / 18, y / 18, 3);
    const lat = y / H;
    let t;
    if (h < seaLevel) t = 'sea';
    else if (h > mountLevel) t = 'mountains';
    else if (h > hillLevel) t = 'hills';
    else if (lat < 0.16 + (m - 0.5) * 0.1) t = 'ice';
    else if (lat < 0.3 + (m - 0.5) * 0.1) t = 'tundra';
    else if (near(x, y, 0.8, 0.8, 0.14) > 0.45 && m < 0.62) t = rN(x / 5, y / 5) > 0.68 ? 'ruins' : 'desert';
    else if (m > 0.66 && h < seaLevel + 0.05) t = 'marsh';
    else if (m > 0.56) t = 'forest';
    else t = rN(x / 6, y / 6) > 0.86 ? 'ruins' : 'plains';
    ter[i] = T_IDS.indexOf(t);
  }
  // Small enclosed waters become marsh, so every sea fleet can reach the open sea.
  const seen = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || ter[i] !== T_SEA) continue;
    const comp = [i];
    seen[i] = 1;
    for (let k = 0; k < comp.length; k++) {
      const j = comp[k], x = j % W, y = (j / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (!seen[n] && ter[n] === T_SEA) { seen[n] = 1; comp.push(n); }
      }
    }
    if (comp.length < 400) for (const j of comp) ter[j] = T_IDS.indexOf('marsh');
  }
  const world = { seed, W, H, height, ter, seaLevel, road: new Uint8Array(W * H), owner: new Int8Array(W * H).fill(-1) };
  world.settlements = placeSettlements(world, seed, playerFaction);
  buildRoads(world);
  computeTerritory(world);
  return world;
}

const cellAt = (w, x, y) => clamp(Math.floor(y), 0, w.H - 1) * w.W + clamp(Math.floor(x), 0, w.W - 1);
const isSeaCell = (w, x, y) => w.ter[cellAt(w, x, y)] === T_SEA;
function isCoastal(w, x, y) {
  if (isSeaCell(w, x, y)) return false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isSeaCell(w, x + dx, y + dy)) return true;
  return false;
}
const terrainId = (w, x, y) => T_IDS[w.ter[cellAt(w, x, y)]];

function placeName(rng, used) {
  for (let k = 0; k < 50; k++) {
    const n = rng.pick(PLACE_A) + rng.pick(PLACE_B);
    if (!used.has(n)) { used.add(n); return n; }
  }
  return 'Outpost ' + used.size;
}

// Every faction: a capital (the player's is a coastal home city, 01 §4.3), another coastal
// settlement, 2 villages and a fort. Neutral villages fill the gaps (09).
function placeSettlements(w, seed, playerFaction) {
  const rng = makeRng(seed + 101);
  const out = [], used = new Set();
  const free = (x, y, gap) => !isSeaCell(w, x, y) && terrainId(w, x, y) !== 'mountains' && out.every((s) => Math.hypot(s.x - x, s.y - y) >= gap);
  const find = (cx, cy, rMin, rMax, gap, want) => {
    for (let k = 0; k < 600; k++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(rMin, rMax + k / 40);
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
      if (x < 3 || y < 3 || x > w.W - 4 || y > w.H - 4) continue;
      if (free(x, y, gap) && (!want || want(x, y))) return [x, y];
    }
    return null;
  };
  const add = (x, y, type, faction, name) => {
    const s = { id: 's' + out.length, name: name || placeName(rng, used), type, faction, x, y, coastal: isCoastal(w, x, y), biome: terrainId(w, x, y), market: {}, store: emptyCargo() };
    for (const k of GOODS) s.market[k] = SELL_ONLY[k] ? 0 : SETTLEMENT_TYPES[type].stock[k];
    out.push(s);
    return s;
  };
  for (const F of FACTIONS) {
    const cx = F.at[0] * w.W, cy = F.at[1] * w.H;
    const player = F.id === playerFaction;
    used.add(F.capital);
    const capType = player ? 'city' : F.capType;
    // The player's home city must be coastal (01 §4.3): search outwards until a coast turns up.
    let capAt = null;
    if (player || F.coastal) for (let r = 6; r <= 60 && !capAt; r += 6) capAt = find(cx, cy, 0, r, 10, (x, y) => isCoastal(w, x, y));
    if (!capAt) capAt = find(cx, cy, 0, 30, 8, null);
    const cap = add(capAt[0], capAt[1], capType, F.id, F.capital);
    cap.capital = true;
    // AI factions get a coastal city too; the player's home city is already on the coast (01 §4.3).
    const coast = player ? null : find(cx, cy, 6, 24, 7, (x, y) => isCoastal(w, x, y));
    if (coast) add(coast[0], coast[1], 'city', F.id);
    for (let k = 0; k < 2; k++) { const p = find(cap.x, cap.y, 6, 16, 7, null); if (p) add(p[0], p[1], 'village', F.id); }
    // The fort faces the middle of the map.
    const mx = w.W / 2 - cap.x, my = w.H / 2 - cap.y, ml = Math.hypot(mx, my) || 1;
    const fp = find(cap.x + (mx / ml) * 12, cap.y + (my / ml) * 12, 0, 8, 7, null);
    if (fp) add(fp[0], fp[1], 'fort', F.id);
  }
  for (let k = 0; k < 14; k++) {
    const p = find(rng.range(20, w.W - 20), rng.range(16, w.H - 16), 0, 30, 11, null);
    if (p) add(p[0], p[1], 'village', null);
  }
  return out;
}

// Roads join each settlement to its two nearest land neighbours; a road through mountains is a pass.
function buildRoads(w) {
  const S = w.settlements;
  const cost = (i) => {
    const t = T_IDS[w.ter[i]];
    return t === 'sea' ? Infinity : t === 'mountains' ? 9 : t === 'plains' || t === 'desert' ? 1 : t === 'tundra' ? 1.4 : 2.2;
  };
  const done = new Set();
  for (const a of S) {
    const others = S.filter((b) => b !== a).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y)).slice(0, 2);
    for (const b of others) {
      const key = [a.id, b.id].sort().join('-');
      if (done.has(key) || Math.hypot(a.x - b.x, a.y - b.y) > 40) continue;
      done.add(key);
      const path = gridPath(w, a.x, a.y, b.x, b.y, cost, 30000);
      if (!path) continue;
      for (const i of path) { w.road[i] = 1; if (w.ter[i] === T_MOUNT) w.ter[i] = T_PASS; }
    }
  }
}

// Territory: each land cell belongs to the nearest settlement's faction within 14 cells.
function computeTerritory(w) {
  const ids = FACTIONS.map((F) => F.id);
  w.owner.fill(-1);
  for (let y = 0; y < w.H; y++) for (let x = 0; x < w.W; x++) {
    let best = 14 * 14, who = -1;
    for (const s of w.settlements) {
      if (!s.faction) continue;
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < best) { best = d; who = ids.indexOf(s.faction); }
    }
    w.owner[y * w.W + x] = who;
  }
}

// ---------- path finding (A* on the cell grid, 8 neighbours). cost(i): per-cell cost, Infinity = blocked.
function gridPath(w, x0, y0, x1, y1, cost, maxNodes = 60000) {
  const W = w.W, N = W * w.H;
  const start = cellAt(w, x0, y0), goal = cellAt(w, x1, y1);
  if (cost(goal) === Infinity) return null;
  const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), shut = new Uint8Array(N);
  const heap = [];   // [f, i] binary heap
  const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const hx = x1 | 0, hy = y1 | 0;
  g[start] = 0; push(0, start);
  let n = 0;
  while (heap.length && n++ < maxNodes) {
    const [, i] = pop();
    if (i === goal) break;
    if (shut[i]) continue;
    shut[i] = 1;
    const x = i % W, y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= w.H) continue;
      const j = ny * W + nx;
      if (shut[j]) continue;
      const c = cost(j);
      if (c === Infinity) continue;
      const step = (dx && dy ? 1.414 : 1) * c;
      if (g[i] + step < g[j]) { g[j] = g[i] + step; from[j] = i; push(g[j] + Math.hypot(hx - nx, hy - ny) * 0.9, j); }
    }
  }
  if (from[goal] < 0 && goal !== start) return null;
  const path = [];
  for (let i = goal; i !== -1; i = from[i]) path.push(i);
  return path.reverse();
}

// How slow a cell is for a domain (1 = the fleet's full march speed), 0 = can't enter.
function cellSpeed(w, i, domain) {
  const t = T_IDS[w.ter[i]];
  if (domain === 'air') return 1;
  if (domain === 'sea') return t === 'sea' ? 1 : 0;
  if (t === 'sea') return 0;
  return (MAP_TERRAIN[t].speed || 0) * (w.road[i] ? ROAD_SPEED : 1);
}

// Path for a fleet: cells to cross, as [[x, y], ...] cell centres (start excluded).
function fleetPath(w, domain, x0, y0, x1, y1) {
  const path = gridPath(w, x0, y0, x1, y1, (i) => { const s = cellSpeed(w, i, domain); return s > 0 ? 1 / s : Infinity; });
  if (!path) return null;
  return path.slice(1).map((i) => [(i % w.W) + 0.5, ((i / w.W) | 0) + 0.5]);
}
