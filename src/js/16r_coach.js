/* ==== 16r COACH: DIRECT HINTS IN BATTLE AND ON THE MAP ==== */
// Producer's request (v0.8.0): "more direct hints in game". With Settings → Help → Hints on
// (the default), a battle shows one short tip at a time in an amber pill, with a pulsing ring
// round the control it is about; the campaign map shows a "Next" banner with the next step and
// highlights its button. Tips explain controls and state facts (distances, ranges, health); they
// never say which choice is better (the no-meta rule).

const COACH = { every: 0.5, show: 5, gap: 2 };

// ---------- battle
// The nearest enemy you can see, and the main gun's reach.
function coachFacts(S) {
  const B = S.B, me = B.me;
  let foe = null, fd = Infinity;
  for (const U of B.units) {
    if (U.side !== 1 || U.destroyed || U.gone || !U.seen) continue;
    const d = Math.abs(U.body.x - me.body.x);
    if (d < fd) { fd = d; foe = U; }
  }
  const mw = mainWeapon(me);
  return { foe, d: Math.round(fd), reach: mw ? Math.round(weaponRange(mw.def)) : 0, ready: !!mw && mw.reload <= 0, toward: foe ? Math.sign(foe.body.x - me.body.x) || 1 : 1 };
}
const driveCtl = (S, dir) => (dir > 0 ? S.c.right : S.c.left);

// In priority order. when(S, B, k, f) → true to show; text and ctl may use the facts f.
const BATTLE_TIPS = [
  { id: 'swap', every: 40, when: (S, B) => !B.me.destroyed && vehicleHealth(B.me) < 0.35 && B.squad.some((V) => V !== B.me && !V.destroyed),
    text: (S, B) => `Your vehicle is at ${Math.round(vehicleHealth(B.me) * 100)}%: tap Swap (or a card at the top) to drive another.`, ctl: (S) => S.c.swap },
  { id: 'reserve', every: 40, when: (S, B) => !S.c.reserve.hidden && B.squad.some((V) => V.destroyed) && B.reserve[0].length > 0,
    text: () => 'A vehicle is out: tap Reserve to send in another.', ctl: (S) => S.c.reserve },
  { id: 'fire', every: 15, when: (S, B, k, f) => f.foe && f.reach && f.d <= f.reach && f.ready && B.time - k.lastShot > 5 && k.fireTips < 4,
    text: (S, B, k, f) => `Enemy in range (${f.d} m): tap Fire.`, ctl: (S) => S.c.fire, after: (k) => { k.fireTips++; } },
  { id: 'closer', every: 20, when: (S, B, k, f) => f.foe && f.reach && f.d > f.reach,
    text: (S, B, k, f) => `Enemy at ${f.d} m; your gun reaches ${f.reach} m. ${f.toward > 0 ? 'Hold ▶' : 'Hold ◀'} to close in.`, ctl: (S, B, k, f) => driveCtl(S, f.toward) },
  { id: 'drive', once: true, when: (S, B, k, f) => !f.foe && B.time > 1.5 && Math.abs(B.me.body.x - k.x0) < 4,
    text: () => 'Hold ▶ to drive toward the enemy.', ctl: (S) => S.c.right },
  { id: 'search', every: 30, when: (S, B, k, f) => !f.foe && B.time > 10 && Math.abs(B.me.body.vx) < 1,
    text: () => 'No enemy in sight: drive on to find them.', ctl: (S) => S.c.right },
  { id: 'aim', once: true, when: (S, B, k) => B.stats.shots >= 3 && !k.aimed && B.time > 20,
    text: () => 'Tip: hold Fire and slide into the battlefield to aim by hand, then let go.', ctl: (S) => S.c.fire },
  { id: 'time', once: true, when: (S, B, k) => B.time > 40 && !k.froze,
    text: () => 'Tip: tap the stopwatch to freeze time while you plan.', ctl: (S) => S.c.time },
  { id: 'orders', once: true, when: (S, B, k) => B.time > 60 && B.order === k.order0 && B.squad.filter((V) => !V.destroyed).length > 1,
    text: () => 'Tip: tap an order (Follow, Hold, Attack…) for the vehicles you aren’t driving.', ctl: (S) => S.c.chips.find((c) => !c.hidden) || null },
];

const coachOn = (S) => save.settings.hints && !S.opts.tutorial && S.B && !S.B.result && !S.B.test;   // not in test drives

function setupCoach(S) {
  const B = S.B;
  S.coach = { t: 0, cur: null, curT: 0, idle: COACH.gap, last: {}, x0: B.me.body.x, shots: 0, lastShot: -99, fireTips: 0, aimed: false, froze: false, order0: B.order };
}

// Every frame from the battle screen's update().
function stepCoach(S, dt) {
  const k = S.coach, B = S.B;
  if (!k || !coachOn(S)) { if (k) k.cur = null; return; }
  if (B.stats.shots !== k.shots) { k.shots = B.stats.shots; k.lastShot = B.time; }
  if (S.aim) k.aimed = true;
  if (S.frozen) k.froze = true;
  if (k.cur) {
    k.curT += dt;
    if (k.curT >= COACH.show) { k.cur = null; k.idle = 0; }
    return;
  }
  k.idle += dt;
  k.t += dt;
  if (k.idle < COACH.gap || k.t < COACH.every) return;
  k.t = 0;
  const f = coachFacts(S);
  for (const tip of BATTLE_TIPS) {
    const seen = k.last[tip.id];
    if (seen !== undefined && (tip.once || B.time - seen < tip.every)) continue;
    if (!tip.when(S, B, k, f)) continue;
    k.last[tip.id] = B.time;
    k.cur = { id: tip.id, text: tip.text(S, B, k, f), ctl: tip.ctl(S, B, k, f) };
    k.curT = 0;
    if (tip.after) tip.after(k);
    return;
  }
}

// The pill between the drive buttons and Fire (or under the top bar on narrow screens), and a
// pulsing ring round the control the tip is about.
function drawCoach(g, S, nowMs) {
  const k = S.coach;
  if (!k || !k.cur || !coachOn(S)) return;
  const { w, h, safe } = layout;
  const C = S.c;
  const a = Math.min(1, k.curT * 4, (COACH.show - k.curT) * 2);
  g.save();
  g.globalAlpha = clamp(a, 0, 1);
  // Ring.
  const c = k.cur.ctl;
  if (c && !c.hidden) {
    const pulse = save.settings.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(nowMs / 160);
    g.strokeStyle = PAL.amber; g.lineWidth = 3;
    g.shadowColor = 'rgba(255,178,62,0.8)'; g.shadowBlur = 10;
    g.beginPath();
    if (c.shape === 'circle') g.arc(c.x, c.y, c.r + 5 + pulse * 5, 0, Math.PI * 2);
    else { const p = 4 + pulse * 4; roundRect(g, c.x - p, c.y - p, c.w + p * 2, c.h + p * 2, 12); }
    g.stroke();
    g.shadowBlur = 0;
  }
  // Pill.
  const left = C.right.hidden ? safe.l + 10 : C.right.x + C.right.r + 12;
  const right = C.fire.x - C.fire.r - 12;
  const room = right - left;
  g.font = `700 ${fontPx(14, 1.15)}px ${FONT_UI}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const tw = g.measureText(k.cur.text).width;
  let pw, px, py;
  if (room >= 180) { pw = Math.min(room, tw + 28); px = left + room / 2; py = h - safe.b - 34; }
  else { pw = Math.min(w - safe.l - safe.r - 20, tw + 28); px = w / 2; py = safe.t + 86; }
  const ph = fontPx(14, 1.15) + 16;
  g.fillStyle = 'rgba(20,32,52,0.55)';
  roundRect(g, px - pw / 2 + 2, py - ph / 2 + 3, pw, ph, ph / 2); g.fill();
  const grad = g.createLinearGradient(0, py - ph / 2, 0, py + ph / 2);
  grad.addColorStop(0, '#FFD06A'); grad.addColorStop(1, '#F5961C');
  g.fillStyle = grad;
  roundRect(g, px - pw / 2, py - ph / 2, pw, ph, ph / 2); g.fill();
  g.fillStyle = '#2B1A04';
  g.fillText(k.cur.text, px, py + 1, pw - 20);
  g.restore();
}

// ---------- campaign map: the next step
// The next thing to do, as { text, el } (el: the button to highlight, or null).
function mapNextStep(S) {
  if (!campaign || campaign.over) return null;
  const mine = playerFleets().filter((fl) => fl.shipIds.length);
  const sel = S.selFleet();
  const moveBtn = S.moveBar && !S.moveBar.hidden ? [...S.moveBar.querySelectorAll('button')].find((b) => b.textContent === 'Move') : null;
  if (moveBtn) return { text: 'Tap Move to send the fleet along this route.', el: moveBtn };
  if (sel && sel.faction === campaign.faction && !sel.path.length && !campaign.running) return { text: 'Now tap a spot on the map, or a settlement, to plan where this fleet goes.', el: null };
  if (mine.length && !mine.some((fl) => fl.path.length) && !campaign.running && !sel) return { text: 'Tap one of your fleets (the blue counters) to select it.', el: S.nextFleetBtn || null };
  if (mine.some((fl) => fl.path.length) && !campaign.running) return { text: 'Press Start ▶ to run the clock: your fleets move while it runs.', el: S.goBtn };
  const ideas = campaignHints();
  if (ideas.length) return { text: ideas[0], el: null };
  return campaign.running ? { text: 'The clock is running. A fleet that meets an enemy opens a battle card.', el: null } : null;
}

// Called from the map's refresh(): fills the banner and moves the highlight.
function updateMapCoach(S) {
  if (!S.coachEl) return;
  const step = save.settings.hints ? mapNextStep(S) : null;
  if (S.coachHi && (!step || step.el !== S.coachHi)) { S.coachHi.classList.remove('coach-pulse'); S.coachHi = null; }
  S.coachEl.hidden = !step;
  if (!step) return;
  if (S.coachTxt.textContent !== step.text) S.coachTxt.textContent = step.text;
  if (step.el && step.el !== S.coachHi) { step.el.classList.add('coach-pulse'); S.coachHi = step.el; }
}
