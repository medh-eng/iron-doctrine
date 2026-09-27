/* ==== 10i FABRICATORS AND RELEASE CLAMPS ==== */
// Fabricators make missiles and drones during a battle (design/05 §3.4): one every 1/rate
// seconds for a launcher or hangar that isn't full, while the vehicle has the power.
// Release clamps hold detachable sections: Release drops what the clamps held (up to 2 t per
// clamp). A section with crew that can move carries on as a vehicle of its own; anything else
// is jettisoned.

function stepFabricator(B, V, dt) {
  if (!V.fabRate || V.destroyed || V.empT > 0) return;
  if (V.power < V.stats.drawn * 0.5) return;           // not enough power to run it
  V.fabT = (V.fabT || 0) + V.fabRate * dt;
  if (V.fabT < 1) return;
  V.fabT -= 1;
  const w = V.weapons.find((q) => q.def.secondary === 'missile' && V.parts[q.part].alive && q.rounds < (q.maxRounds || 0));
  if (w) { w.rounds++; if (V.side === 0 || V.seen) floatText('Missile made', V.body.x, V.body.y + V.height + 1, false); return; }
  if (V.droneCap && V.droneStock + (V.drones || []).filter((D) => !D.destroyed && !D.gone).length < V.droneCap) {
    V.droneStock++;
    if (V.side === 0 || V.seen) floatText('Drone made', V.body.x, V.body.y + V.height + 1, false);
  }
}

// Why V can't release, or '' after releasing.
function releaseClamps(B, V) {
  const clamps = [];
  V.parts.forEach((p, i) => { if (p.alive && p.def.clamp) clamps.push(i); });
  if (!clamps.length) return 'No release clamp';
  // Without the clamps, what is no longer joined to the crewed body?
  const alive = Uint8Array.from(V.alive);
  for (const i of clamps) alive[i] = 0;
  const groups = components(V.design, occupancy(V.design, alive), alive);
  if (groups.length < 2) return 'Nothing held by the clamps';
  const score = (g) => g.reduce((s, i) => s + (V.parts[i].def.crew ? 1e6 : 0) + (V.parts[i].def.loco ? 1e4 : 0) + V.parts[i].def.mass, 0);
  groups.sort((a, b) => score(b) - score(a));
  const sections = groups.slice(1);
  const mass = sections.reduce((s, g) => s + g.reduce((a, i) => a + V.parts[i].def.mass, 0), 0);
  const cap = clamps.reduce((s, i) => s + V.parts[i].def.capacity * 1000, 0);
  if (mass > cap) return `The section weighs ${(mass / 1000).toFixed(1)} t; the clamps hold ${(cap / 1000).toFixed(1)} t`;
  for (const i of clamps) { V.parts[i].alive = false; V.alive[i] = 0; }
  for (const g of sections) {
    const crewed = g.some((i) => V.parts[i].def.crew);
    const moves = g.some((i) => { const d = V.parts[i].def; return d.loco || d.power > 0 || d.liftForce || d.lift || d.propeller; });
    const c0 = V.parts[g[0]];
    const at = gridCellToWorld(V, c0.x, V.design.h - c0.y - 1);
    for (const i of g) { V.parts[i].alive = false; V.alive[i] = 0; }
    if (crewed && moves) spawnSection(B, V, g, at);
    else spawnDebris(B, V, g, at, 3);
  }
  rebuildVehicle(V);
  floatText('Released', V.body.x, V.body.y + V.height + 1, V.side === 1);
  audio.sfx('clunk', B.panOf(V.body.x), 1.2);
  return '';
}

// A released section with crew becomes a vehicle of its own, keeping its damage.
function spawnSection(B, V, idxs, at) {
  const cells = idxs.map((i) => ({ p: V.parts[i].def.id, x: V.parts[i].x, y: V.parts[i].y }));
  const d = cropDesign({ id: V.design.id + '_sec', name: `${V.name} section`, w: V.design.w, h: V.design.h, cells, paint: V.design.paint });
  const S = makeVehicle(d, V.side, at.x, V.dir, B.T);
  S.body.y = Math.max(S.body.y, at.y);
  S.body.vx = V.body.vx;
  S.ai = makeAI(V.side === 0 ? 'squad' : 'attack', B.cfg);
  S.label = '';
  S.seen = V.seen;
  idxs.forEach((i, k) => { S.parts[k].hp = Math.min(S.parts[k].hp, V.parts[i].hp || S.parts[k].hp); });
  B.units.push(S);
  if (V.side === 0 || V.seen) floatText(`${S.name} away`, at.x, at.y + 2, V.side === 1);
  return S;
}

// Enemy captains release their sections when a target is close.
function aiRelease(B, V) {
  if (V.side === 0 || V.released || !V.parts.some((p) => p.alive && p.def.clamp)) return;
  const t = V.ai && V.ai.target;
  if (t && Math.abs(t.body.x - V.body.x) < 60) { V.released = true; releaseClamps(B, V); }
}
