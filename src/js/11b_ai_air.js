/* ==== 11b AI: AIRCRAFT ==== */
// Fighters strafe: they dive along a line to the target and pull out low. Bombers fly level
// and release when the bomb would land on the target. Past the target they loop round.
// Helicopters hover at a stand-off distance and use their guns.

function airThink(B, V, dt) {
  const ai = V.ai;
  const b = V.body;
  const T = B.T;
  const bomber = V.weapons.some((w) => w.def.secondary === 'bomb' && w.rounds > 0 && V.parts[w.part].alive);
  const tgt = nearestTarget(B, V, 500, bomber ? (U) => !U.flier : null);
  if (tgt !== ai.target) { ai.target = tgt; ai.react = ai.reaction; }
  if (ai.react > 0) ai.react -= dt;
  const ground = Math.max(T.height(b.x), seaAt(T, b.x) ? T.sea : -Infinity);
  if (V.domain === 'heli') { heliThink(B, V, tgt, ground); return; }
  const cruise = ground + (bomber ? 55 : 45);
  V.throttle = 0.9;
  V.pitchOrder = null;
  let gamma = clamp((cruise - b.y) * 0.03, -0.3, 0.3);
  if (tgt) {
    const ahead = (tgt.body.x - b.x) * V.dir;
    const alt = b.y - ground;
    if (ahead < -45 && alt > 22) {
      V.pitchOrder = 1;                                   // loop round
    } else if (!bomber && ahead > 8 && ahead < 120) {
      gamma = clamp(Math.atan2(tgt.body.y + tgt.height * 0.5 - b.y, ahead), -0.7, 0.2);
      if (alt < 14) gamma = 0.35;                         // pull out
    }
  }
  if (b.y - ground < 10) { V.pitchOrder = null; gamma = 0.45; }
  V.gammaCmd = gamma;
}

function heliThink(B, V, tgt, ground) {
  const b = V.body;
  V.altCmd = ground + 20;
  if (!tgt) { V.moveCmd = V.dir * 0.5; return; }
  const d = tgt.body.x - b.x;
  const want = engageRange(V) * 0.6;
  V.moveCmd = Math.abs(d) > want + 6 ? Math.sign(d) : Math.abs(d) < want - 10 ? -Math.sign(d) * 0.6 : 0;
}

// Bombers release when a bomb let go now would land on their target.
function aiBomb(B, V, w) {
  const tgt = V.ai && V.ai.target;
  if (!tgt || tgt.destroyed || tgt.flier || w.rounds <= 0 || w.reload > 0) return;
  if (Math.abs(bombImpactX(V, tgt.body.y) - tgt.body.x) < 2.5) dropBomb(B, V, w);
}
