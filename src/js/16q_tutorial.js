/* ==== 16q TUTORIAL ==== */
// Producer's request (v0.7.1). A guided practice battle: a banner gives one step at a time and
// moves on when you have done it (drive, fire, aim by hand, swap, give an order, stop time, then
// win). The enemy holds fire until the last step. Offered once on the first launch, and any time
// from Settings → Help. The campaign map shows a few first-time tips once.

const TUTORIAL = [
  { text: 'Drive: hold ▶ (or D) to move forward.', done: (S, B, t) => Math.abs(B.me.body.x - t.x0) > 12 },
  { text: 'Fire: tap Fire (or Space). It aims at the nearest enemy in reach.', done: (S, B) => B.stats.shots >= 1 },
  { text: 'Aim by hand: press and hold Fire, slide your finger out into the battlefield to aim, and let go to fire.', done: (S, B, t) => t.dragged && B.stats.shots >= 2 },
  { text: 'Swap: tap Swap (or E) to drive your other vehicle.', done: (S, B, t) => B.me !== t.first },
  { text: 'Orders: tap an order such as Attack or Hold (keys 1–5) for the vehicles you aren’t driving.', done: (S, B, t) => B.order !== t.order0 },
  { text: 'Time stop: tap the stopwatch (or T) to freeze the battle, then tap it again to carry on.', done: (S, B, t) => t.froze && !S.frozen },
  { text: 'Now win: destroy the enemy armoured car. It fires back from now on.', done: (S, B) => B.result === 'win' },
];
const TUTORIAL_SIM = {
  field: 'inland', weather: 'clear', light: 'day', seed: 7,
  squad: () => ['light', 'scout'].map(designFromTemplate),
  enemy: () => [designFromTemplate('mgcar')],
};

function startTutorial() {
  audio.unlock();
  screens.go('battle', { sim: TUTORIAL_SIM, tutorial: true });
}

// From the battle screen's enter().
function setupTutorial(S) {
  const B = S.B;
  B.cfg.holdFire = true;                    // the enemy waits until the last step
  S.tut = { i: 0, x0: B.me.body.x, first: B.me, order0: B.order, dragged: false, froze: false, el: null };
  const bar = el('div', 'tut-banner');
  const txt = el('div', 'tut-text');
  bar.appendChild(txt);
  bar.appendChild(button('Skip', () => { save.profile.tutorial.done = true; save.touch('profile'); screens.go('title'); }, 'btn btn-small'));
  uiLayer.insertBefore(bar, ui.toastBox);
  S.tut.el = bar; S.tut.txt = txt;
  showTutorialStep(S);
}
function showTutorialStep(S) {
  const t = S.tut;
  t.txt.textContent = `${t.i + 1}/${TUTORIAL.length} · ${TUTORIAL[t.i].text}`;
  if (t.i === TUTORIAL.length - 1) S.B.cfg.holdFire = false;
}
// Every frame (from the battle screen's update()).
function stepTutorial(S) {
  const t = S.tut, B = S.B;
  if (!t || B.result === 'lost') return;
  if (S.aim) t.dragged = true;
  if (S.frozen) t.froze = true;
  if (t.i < TUTORIAL.length - 1 && TUTORIAL[t.i].done(S, B, t)) {
    t.i++;
    audio.sfx('objective');
    haptic('tap');
    showTutorialStep(S);
  }
}
function endTutorial(S) {
  if (S.tut && S.tut.el) S.tut.el.remove();
  if (S.tut) S.tut.el = null;
}

// Offered once, on the title screen, to a player with no battles yet.
function offerTutorial() {
  const p = save.profile;
  if (p.tutorial.offered || p.tutorial.done || p.stats.battles > 0) return;
  p.tutorial.offered = true;
  save.touch('profile');
  const c = ui.card('New to Iron Doctrine?');
  c.appendChild(el('p', 'card-text', 'A short practice battle shows how to drive, aim, fire, swap vehicles and give orders. You can play it later from Settings → Help.'));
  const row = el('div', 'card-row');
  let close = null;
  row.appendChild(button('Not now', () => close(), 'btn', 'back'));
  row.appendChild(button('Play the tutorial', () => { close(); startTutorial(); }, 'btn btn-primary'));
  c.appendChild(row);
  close = ui.open(c);
}

// First visit to the campaign map: a few tips, once.
const MAP_TIPS = [
  'Tap a fleet, then tap where it should go. The path shows time and fuel; tap Move, then Start ▶ to run the clock.',
  'Tap a settlement for its market, warehouse, workshop, yard and barracks. Your capital is where you start.',
  'Meeting an enemy fleet starts a battle: fight it yourself or auto-resolve it.',
  'War room (top bar) holds relations, the journal, medals and victory progress. Help is in Settings (⚙).',
];
function mapTips() {
  const p = save.profile;
  if (p.tutorial.mapTips) return;
  p.tutorial.mapTips = true;
  save.touch('profile');
  const c = ui.card('The campaign map');
  for (const t of MAP_TIPS) c.appendChild(el('p', 'card-text help-p', t));
  const row = el('div', 'card-row');
  let close = null;
  row.appendChild(button('Got it', () => close(), 'btn btn-primary', 'back'));
  c.appendChild(row);
  close = ui.open(c);
}
