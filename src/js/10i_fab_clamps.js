/* ==== 10i FABRICATORS AND RELEASE CLAMPS ==== */
// Part 5e (design/01 §10.5, design/05 §3.4).
// Fabricators build during battle from the ship's own metal and electronics: first drones its
// hangars have lost, then missiles its launchers and magazines have room for, then shells. Work
// comes at the fabricators' rate (0.02 units a second each, slower when power runs short); a
// drone costs 2 units, a missile its size (1, 2 or 4), 10 shells 1 unit.
// Release clamps hold a detachable section: parts that touch the ship only through clamps. On
// Release the section becomes its own unit (it drives, flies and fights if it can; otherwise it
// falls), if its mass is within what the clamps hold (2 t each).

// ---------- fabricators
function setupFab(V) {
  let rate = 0;
  for (const p of V.parts) if (p.alive && p.def.id === 'fab') rate += p.def.rate;
  V.fabRate = rate;
  if (!rate) return;
  if (V.fabGoods === undefined) { V.fabGoods = { metal: FAB.kit.metal, elec: FAB.kit.elec }; V.fabUsed = { metal: 0, elec: 0 }; V.fabWork = 0; V.fabJob = null; }
}

// What to make next, and its goods: a lost drone, a missile, or shells. null if nothing is needed.
function fabNext(B, V) {
  const goodsOf = (cells) => { const c = { metal: 0, elec: 0 }; for (const q of cells) { const P = PARTS[q.p]; if (P && P.cost) { c.metal += P.cost.metal || 0; c.elec += P.cost.elec || 0; } } return c; };
  if (V.hangarCap && V.droneSt && V.dronesAboard + dronesFlying(B, V) < V.hangarCap) {
    return { kind: 'drone', units: FAB.droneUnits, cost: goodsOf(missileCells(droneDesign(V.droneSt.id))), name: V.droneSt.name };
  }
  for (const w of V.weapons) {
    if (w.def.secondary !== 'launcher' || !w.msl || !V.parts[w.part].alive) continue;
    const room = Math.floor(w.def.capacity / w.msl.units) - w.rounds;
    const magRoom = V.parts.reduce((s, p) => s + (p.alive && p.def.magazine ? p.def.capacity : 0), 0) - (V.magUnits || 0);
    if (room > 0 || magRoom >= w.msl.units) return { kind: 'missile', w, units: w.msl.units, cost: goodsOf(missileCells(missileDesign(w.msl.id))), name: w.msl.name };
  }
  if (V.shellsMax && V.shells < V.shellsMax) return { kind: 'shells', units: 1, cost: { metal: FAB.shellMetal, elec: 0 }, name: `${FAB.shells} shells` };
  return null;
}

// Every step (from stepSystems).
function stepFab(B, V, dt) {
  if (!V.fabRate || V.destroyed || V.empT > 0) return;
  if (!V.fabJob) {
    const job = fabNext(B, V);
    if (!job) return;
    if (V.fabGoods.metal < job.cost.metal || V.fabGoods.elec < job.cost.elec) return;   // not enough aboard
    V.fabGoods.metal -= job.cost.metal; V.fabGoods.elec -= job.cost.elec;
    V.fabUsed.metal += job.cost.metal; V.fabUsed.elec += job.cost.elec;
    V.fabJob = job; V.fabWork = 0;
  }
  // Short of power, the work slows.
  const made = V.powerMade * (V.heatMul || 1);
  const f = V.powerDraw > made ? Math.max(0.2, made / V.powerDraw) : 1;
  V.fabWork += V.fabRate * f * dt;
  if (V.fabWork < V.fabJob.units) return;
  const j = V.fabJob;
  V.fabJob = null;
  if (j.kind === 'drone') V.dronesAboard++;
  else if (j.kind === 'missile') {
    const room = Math.floor(j.w.def.capacity / j.w.msl.units) - j.w.rounds;
    if (room > 0 && V.parts[j.w.part].alive) j.w.rounds++; else V.magUnits = (V.magUnits || 0) + j.units;
  } else V.shells = Math.min(V.shellsMax, V.shells + FAB.shells);
  B.stats.fabricated = (B.stats.fabricated || 0) + 1;
  if (V.side === 0) floatText(`Fabricated: ${j.name}`, V.body.x, V.body.y + V.height + 1, false);
  const p = V.parts.find((q) => q.alive && q.def.id === 'fab');
  if (p) { const at = gridCellToWorld(V, p.x + 0.5, V.design.h - p.y - 1); fxSparks(B, at.x, at.y, Math.PI / 2, 5); }
}

// ---------- release clamps
// The sections a vehicle could release now: groups that stay together once the clamps are taken
// out, other than the main body, and that touch a clamp. Each: {idx: [part indices], mass}.
function clampSections(V) {
  const clamps = [];
  V.parts.forEach((p, i) => { if (p.alive && p.def.id === 'clamp') clamps.push(i); });
  if (!clamps.length) return [];
  const alive = Uint8Array.from(V.alive);
  for (const i of clamps) alive[i] = 0;
  const groups = components(V.design, occupancy(V.design, alive), alive);
  if (groups.length < 2) return [];
  // The main body: most crew, then most mass (as when parts fall off).
  const score = (g) => g.reduce((s, i) => s + (V.parts[i].def.crew ? 1e6 : 0) + V.parts[i].def.mass, 0);
  groups.sort((a, b) => score(b) - score(a));
  const touch = (g) => { const adj = adjacency(V.design, occupancy(V.design, V.alive), V.alive); return g.some((i) => clamps.some((c) => adj[i].has(c))); };
  return groups.slice(1).filter(touch).map((g) => ({ idx: g, mass: g.reduce((s, i) => s + V.parts[i].def.mass, 0) }));
}
function clampHold(V) { return V.parts.reduce((s, p) => s + (p.alive && p.def.id === 'clamp' ? p.def.capacity * 1000 : 0), 0); }

// Release every section the clamps can let go of. Returns a reason, or ''.
function releaseSections(B, V) {
  const secs = clampSections(V);
  if (!secs.length) return 'Nothing on the clamps';
  const hold = clampHold(V);
  const total = secs.reduce((s, q) => s + q.mass, 0);
  if (total > hold) return `Too heavy for the clamps: ${(total / 1000).toFixed(1)} t on ${(hold / 1000).toFixed(1)} t`;
  const o = { x: 0, y: 0 };
  for (const sec of secs) {
    // The section's own design, cropped to its parts, and where its centre of mass is now.
    let m = 0, gx = 0, gy = 0;
    for (const i of sec.idx) { const p = V.parts[i]; const w = p.def.mass; m += w; gx += w * (p.x + p.def.w / 2) * CELL; gy += w * (V.design.h - p.y - p.def.h / 2) * CELL; }
    gridToLocal(V, gx / m, gy / m, o);
    localToWorld(V, o.x, o.y, o);
    const sub = cropDesign(Object.assign({}, V.design, { cells: sec.idx.map((i) => V.design.cells[i]) }));
    sub.name = `${V.name}: released section`;
    delete sub._shipId; delete sub._state;
    for (const i of sec.idx) { V.parts[i].alive = false; V.alive[i] = 0; }
    const U = makeVehicle(sub, V.side, o.x, V.dir, B.T);
    U.body.x = o.x; U.body.y = o.y; U.body.a = V.body.a;
    U.body.vx = V.body.vx; U.body.vy = V.body.vy;
    if (U.flier) launchFlier(U, B.T, Math.max(5, o.y - Math.max(B.T.height(o.x), B.T.sea || -1e9)));
    U.body.y = o.y;
    U.ai = makeAI(V.side === 0 ? 'squad' : 'attack', B.cfg);
    U.detached = true;
    U.seen = V.side === 0 || V.seen;
    U.fuel = U.fuelMax;
    U.shells = U.shellsMax;
    B.units.push(U);
    B.stats.released = (B.stats.released || 0) + 1;
    fxSparks(B, o.x, o.y + 1, Math.PI / 2, 6);
    audio.sfx('clunk', B.panOf(o.x), 1.2);
  }
  rebuildVehicle(V);
  if (V.side === 0) floatText('Section released', V.body.x, V.body.y + V.height + 1, false);
  return '';
}

// ---------- music era (design/03 §8): 1 when any ship in the battle, on the field or in reserve,
// carries a tier 3–4 part.
function battleEra(B) {
  const hi = (cells) => cells.some((c) => PARTS[c.p] && PARTS[c.p].tier >= 3);
  if (B.units.some((V) => hi(V.design.cells))) return 1;
  return (B.reserve || []).some((side) => side.some((e) => hi(e.design.cells))) ? 1 : 0;
}
