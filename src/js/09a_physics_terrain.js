/* ==== 09a PHYSICS: TERRAIN ==== */
// Heightfield sampled every 0.5 m, with a material per sample (design/04 §6).
// Generator: plains, hills, mud patches, forest, gaps (design/06 Part 1b).

function makeTerrain(cfg) {
  const rng = makeRng(cfg.seed);
  const L = cfg.length;
  const n = Math.round(L / CELL) + 1;
  const h = new Float32Array(n);
  const mat = new Uint8Array(n);
  const trees = [];
  const gaps = [];
  const mudZones = [];
  const forestZones = [];

  // Value noise: random heights every `step` metres, smoothly interpolated.
  const noise = (step, amp) => {
    const k = Math.ceil(L / step) + 2;
    const v = [];
    for (let i = 0; i < k; i++) v.push(rng.range(-1, 1) * amp);
    return (x) => {
      const f = x / step;
      const i = Math.floor(f);
      const t = f - i;
      const s = t * t * (3 - 2 * t);
      return v[i] + (v[i + 1] - v[i]) * s;
    };
  };
  const hillsA = noise(90, 10 * cfg.hills);
  const hillsB = noise(37, 3.5 * cfg.hills);
  const rough = noise(6, 0.35 * cfg.rough);
  for (let i = 0; i < n; i++) {
    const x = i * CELL;
    // Keep the two start zones calmer so squads don't spawn on a cliff.
    const edge = Math.min(1, Math.min(x - 10, L - 10 - x) / 60);
    h[i] = (hillsA(x) + hillsB(x)) * clamp(0.35 + edge, 0.35, 1) + rough(x);
  }

  const free = (x0, x1) => x0 > 95 && x1 < L - 110 &&
    !gaps.some((g) => x1 > g.x0 - 25 && x0 < g.x1 + 25) &&
    !mudZones.some((z) => x1 > z.x0 - 10 && x0 < z.x1 + 10);

  // Gaps: a trench with steep walls. Long vehicles bridge them; short ones fall in.
  for (let k = 0, tries = 0; k < (cfg.gaps || 0) && tries < 50; tries++) {
    const w = rng.range(3.2, 4.6);
    const x0 = rng.range(110, L - 150);
    if (!free(x0, x0 + w)) continue;
    const i0 = Math.round(x0 / CELL);
    const i1 = Math.round((x0 + w) / CELL);
    const rim = Math.min(h[i0], h[i1]);
    for (let i = i0 + 1; i < i1; i++) h[i] = rim - 3.2;
    gaps.push({ x0: i0 * CELL, x1: i1 * CELL });
    k++;
  }
  // Mud: soft, slightly sunken ground.
  for (let k = 0, tries = 0; k < (cfg.mud || 0) && tries < 50; tries++) {
    const w = rng.range(14, 26);
    const x0 = rng.range(100, L - 130);
    if (!free(x0, x0 + w)) continue;
    const i0 = Math.round(x0 / CELL), i1 = Math.round((x0 + w) / CELL);
    for (let i = i0; i <= i1; i++) {
      const t = (i - i0) / (i1 - i0);
      mat[i] = T_MUD;
      h[i] -= 0.45 * Math.sin(t * Math.PI);
    }
    mudZones.push({ x0, x1: x0 + w });
    k++;
  }
  // Forest: concealment and trees.
  for (let k = 0, tries = 0; k < (cfg.forest || 0) && tries < 50; tries++) {
    const w = rng.range(30, 50);
    const x0 = rng.range(90, L - 120);
    if (forestZones.some((z) => x0 + w > z.x0 - 10 && x0 < z.x1 + 10)) continue;
    const i0 = Math.round(x0 / CELL), i1 = Math.round((x0 + w) / CELL);
    for (let i = i0; i <= i1; i++) if (mat[i] === T_PLAINS) mat[i] = T_FOREST;
    for (let x = x0 + 2; x < x0 + w - 2; x += rng.range(3.5, 7)) {
      if (gaps.some((g) => x > g.x0 - 1 && x < g.x1 + 1)) continue;
      trees.push({ x, h: rng.range(6, 10), r: rng.range(1.6, 2.6), alive: true, fall: 0, fallDir: 1, seed: rng.int(0, 1e6) });
    }
    forestZones.push({ x0, x1: x0 + w });
    k++;
  }

  const T = {
    length: L, n, h, mat, trees, gaps, mudZones, forestZones,
    version: 0,          // bumped when craters change the ground
    height(x) {
      const f = clamp(x / CELL, 0, n - 1.001);
      const i = Math.floor(f);
      const t = f - i;
      return h[i] + (h[i + 1] - h[i]) * t;
    },
    slope(x) { return (this.height(x + 0.25) - this.height(x - 0.25)) / 0.5; },
    matAt(x) { return mat[clamp(Math.round(x / CELL), 0, n - 1)]; },
    terrainAt(x) { return TERRAIN[this.matAt(x)]; },
    inForest(x) { return this.matAt(x) === T_FOREST; },
    // High-explosive craters carve the ground.
    carve(x, r, depth) {
      const i0 = Math.max(1, Math.floor((x - r) / CELL));
      const i1 = Math.min(n - 2, Math.ceil((x + r) / CELL));
      for (let i = i0; i <= i1; i++) {
        const d = Math.abs(i * CELL - x) / r;
        if (d < 1) h[i] -= depth * (1 - d * d);
      }
      this.version++;
    },
  };
  return T;
}
