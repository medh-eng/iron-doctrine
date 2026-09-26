/* ==== 16 SCREENS ==== */
// Screen manager, the title screen, and pause/settings/fullscreen helpers.
// A screen may define: enter(arg), exit(), layout(), update(dt, simRunning),
// render(g, nowMs), controls[], world{tap, doubleTap, longPress, pan, panEnd, pinch},
// key(code, down), pausable, pauseOpts().

const screens = {
  cur: null,
  name: '',
  go(name, arg) {
    input.releaseAll();
    while (ui.stack.length) ui.closeTop();
    if (this.cur && this.cur.exit) this.cur.exit();
    this.cur = SCREENS[name];
    this.name = name;
    if (this.cur.enter) this.cur.enter(arg);
    if (this.cur.layout) this.cur.layout();
  },
};

const SCREENS = {};

// ---------- Title (design/02 §6)
SCREENS.title = {
  root: null,
  t: 0,
  enter() {
    this.root = el('div', 'title-screen');
    this.build();
    uiLayer.insertBefore(this.root, ui.toastBox);
    audio.playTheme('title');
    audio.quiet = true;
    this.demo = null;
  },
  exit() {
    if (this.root) this.root.remove();
    this.root = null;
    audio.quiet = false;
    this.demo = null;
  },
  build() {
    const r = this.root;
    const p = save.profile;
    r.textContent = '';
    const fs = el('button', 'fs-btn');
    fs.type = 'button';
    fs.setAttribute('aria-label', 'Full screen');
    fs.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    fs.addEventListener('click', () => { audio.sfx('tap'); toggleFullscreen(); });
    r.appendChild(fs);

    r.appendChild(el('h1', 'logo', 'IRON DOCTRINE'));
    r.appendChild(el('p', 'tagline', "No manual tells you how to win this war. You'll write your own."));

    const menu = el('div', 'menu');
    const pg = el('div', 'menu-group');
    pg.appendChild(el('div', 'menu-label', 'Gauntlet'));
    const pgRow = el('div', 'menu-row');
    const run = p.run;
    const contLevel = run.active ? run.level : p.continueLevel;
    if (contLevel > 1) {
      const label = run.active ? `Continue at level ${contLevel} · ${run.lives} ${run.lives === 1 ? 'life' : 'lives'}` : `Continue at level ${contLevel}`;
      pgRow.appendChild(button(label, () => ladder.resume(), 'btn btn-primary'));
    }
    pgRow.appendChild(button('Play from level 1', () => ladder.start(1, true), contLevel > 1 ? 'btn' : 'btn btn-primary'));
    pg.appendChild(pgRow);
    menu.appendChild(pg);

    const row2 = el('div', 'menu-row');
    row2.appendChild(button('Workshop', () => screens.go('workshop')));
    row2.appendChild(button('Blueprints', () => screens.go('blueprints')));
    row2.appendChild(button('Settings', () => ui.openSettings()));
    menu.appendChild(row2);
    r.appendChild(menu);

    r.appendChild(el('p', 'title-stats', `Best score ${p.bestScore} · Highest level ${p.highestLevel}`));
    r.appendChild(el('p', 'title-version', `v${GAME_VERSION}`));
  },
  // AI-vs-AI demo battle behind the menu (design/02 §6), camera slowly tracking the fight.
  newDemo() {
    this.demoN = (this.demoN || 0) + 1;
    const cfg = Object.assign(levelConfig(3), {
      name: 'Demo', seed: 5000 + this.demoN * 131, length: 250, hills: 0.35, forest: 1, mud: 1, gaps: 0,
      enemies: [['light', 2, 'attack', 0], ['medium', 1, 'attack', 0]], accuracy: 0.5, reaction: 1, holdFire: false,
    });
    for (const pool of [shells, particles, debris, smokeScreens, smokeColumns]) pool.forEachAlive((p) => { p.alive = false; });
    const squad = ['medium', 'assault', 'light'].map(designFromTemplate);
    this.demo = createBattle(3, { demo: true, cfg, squad });
    this.demo.panOf = () => 0;
    this.camX = 180;   // snaps to the lead tank on the first frame
  },
  update(dt) {
    this.t += dt;
    if (!this.demo || this.demo.result && this.demo.resultT > 4 || this.demo.time > 100) this.newDemo();
    updateBattle(this.demo, dt);
  },
  render(g) {
    const B = this.demo;
    if (!B) return;
    const { w, h } = layout;
    // Follow the lead tank, looking a little ahead toward the fight.
    const lead = B.squad.find((V) => !V.destroyed) || B.units[0];
    const want = lead.body.x + 30;
    this.camX += (want - this.camX) * (this.camX === 180 ? 1 : 0.02);
    view.S = BASE_PX_PER_M * (h / 360) * 0.5;
    view.cx = clamp(this.camX, w / view.S / 2, B.T.length - w / view.S / 2);
    view.cy = B.T.height(view.cx) + 1;
    view.horizon = h * 0.8;
    view.shake.x = view.shake.y = 0;
    B.revealAll = true;
    renderBattle(g, B);
    // Veil so the menu stays readable over the fight.
    g.fillStyle = 'rgba(12,14,20,0.42)';
    g.fillRect(0, 0, w, h);
  },
};

// ---------- pause, settings, fullscreen helpers used by screens and main
function togglePause() {
  if (game.paused) { ui.closeTop(); return; }
  pauseGame();
}

function pauseGame() {
  const scr = screens.cur;
  if (!scr || !scr.pausable || game.paused) return;
  game.paused = true;
  audio.setPaused(true);
  save.flush();
  ui.openPause(Object.assign(scr.pauseOpts(), {
    onClose: () => { game.paused = false; audio.setPaused(false); },
  }));
}

// P / Esc: close the top card if one is open, otherwise pause.
function onPauseKey() {
  if (ui.modalOpen()) { audio.sfx('back'); ui.closeTop(); return; }
  if (screens.cur && screens.cur.pausable) { audio.sfx('tap'); pauseGame(); }
}

// Settings from inside a battle pauses the game while open.
function openSettingsPaused() {
  const scr = screens.cur;
  if (scr && scr.pausable && !game.paused) {
    game.paused = true;
    audio.setPaused(true);
    ui.openSettings(() => { game.paused = false; audio.setPaused(false); });
  } else {
    ui.openSettings();
  }
}

function toggleFullscreen() {
  const d = document;
  try {
    if (d.fullscreenElement) { d.exitFullscreen().catch(() => {}); return; }
    enterFullscreen();
  } catch (_e) { /* ignore */ }
}

function enterFullscreen() {
  const root = document.documentElement;
  if (!root.requestFullscreen || document.fullscreenElement) return;
  root.requestFullscreen({ navigationUI: 'hide' })
    .then(() => {
      if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape');
      return null;
    })
    .catch(() => {});
}
