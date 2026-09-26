/* ==== 10d AIR WEAPONS ==== */
// Guns fixed along an aircraft's nose, bombs, flak and aiming at aircraft
// (design/01 §7.4, design/05 §3). Only heavy machine guns, autocannons and AA guns
// can engage aircraft (their def.aa); AA guns burst near them (def.flak).

const FLAK_FUSE = 3;              // metres from an aircraft at which a flak shell bursts
const FLAK = { dmg: 30, radius: 3 };

// Can V's weapons fight U? Aircraft only by weapons that can hit aircraft, or by other aircraft.
function canEngage(V, U) {
  if (!U.flier || V.flier) return true;
  return V.weapons.some((w) => w.def.aa && V.parts[w.part].alive);
}

// Lead a moving aircraft: aim where it will be when the shot arrives.
function leadTarget(V, w, U, out) {
  if (!U.flier) return out;
  weaponPivot(V, w, _p);
  const t = Math.hypot(out.x - _p.x, out.y - _p.y) / w.def.vel;
  out.x += U.body.vx * t;
  out.y += U.body.vy * t;
  return out;
}

// The player's Fire on an aircraft: every gun fixed along the nose fires straight ahead.
function fireForward(B, V) {
  let fired = false, loading = false, any = false;
  const ang = angleFromElevation(V, 0, V.dir);
  for (const w of V.weapons) {
    if (w.def.secondary || w.turret || !V.parts[w.part].alive) continue;
    any = true;
    if (w.reload > 0) { loading = true; continue; }
    if (!w.def.auto && V.shells <= 0) continue;
    w.angle = ang;
    fireWeapon(B, V, w, ang, 1);
    w.reload = w.def.auto ? (60 / w.def.rpm) * 3 : w.def.reload;
    fired = true;
  }
  if (fired) { B.stats.shots++; return ''; }
  return !any ? (V.weapons.some((w) => w.def.secondary) ? playerSecondary(B) : 'No gun') : loading ? 'Reloading' : 'Out of shells';
}

// Release one bomb from rack w, falling with the aircraft's speed.
function dropBomb(B, V, w) {
  if (w.rounds <= 0 || w.reload > 0) return false;
  weaponPivot(V, w, _p);
  const s = shells.take();
  s.x = s.px = s.sx = _p.x; s.y = s.py = s.sy = _p.y - 0.4;
  s.vx = V.body.vx; s.vy = V.body.vy - 0.5;
  s.t = 0; s.side = V.side; s.shooter = V; s.def = w.def;
  s.dmg = BOMB.dmg; s.mg = false; s.he = true; s.ignore = V; s.ignoreT = 0.6; s.whistled = false; s.wet = false;
  w.rounds--;
  w.reload = w.def.reload;
  V.dropped = (V.dropped || 0) + w.def.bombMass;
  V.body.m = Math.max(1, V.body.m - w.def.bombMass);
  audio.sfx('tap', B.panOf(s.x));
  return true;
}

// Where a bomb let go now would land (x), falling to height y.
function bombImpactX(V, y) {
  const b = V.body;
  const h = b.y - y;
  if (h <= 0) return b.x;
  const t = (b.vy + Math.sqrt(b.vy * b.vy + 2 * GRAVITY * h)) / GRAVITY;
  return b.x + b.vx * t;
}

// A flak shell bursts when it passes near an enemy aircraft. Returns true if it burst.
function flakCheck(B, s) {
  for (const V of B.units) {
    if (!V.flier || V.destroyed || V.side === s.side) continue;
    if (Math.abs(V.body.x - s.x) < FLAK_FUSE + V.radius && Math.abs(V.body.y - s.y) < FLAK_FUSE + V.radius &&
        Math.hypot(V.body.x - s.x, V.body.y - s.y) < FLAK_FUSE + V.radius * 0.5) {
      flakBurst(B, s.x, s.y, s.shooter);
      return true;
    }
  }
  return false;
}

function flakBurst(B, x, y, source) {
  explode(B, x, y, FLAK.dmg, FLAK.radius, source);
  const p = spawnParticle(FX_SMOKE, x, y, 0, 0.2, 2.2, 1.2);
  if (p) { p.grow = 0.8; p.shade = 0.05; }
}
