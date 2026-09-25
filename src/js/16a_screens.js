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
  },
  exit() {
    if (this.root) this.root.remove();
    this.root = null;
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
    pg.appendChild(el('div', 'menu-label', 'Proving Ground'));
    const pgRow = el('div', 'menu-row');
    if (p.continueLevel > 1) {
      pgRow.appendChild(button(`Continue at level ${p.continueLevel}`, () => screens.go('battle', p.continueLevel), 'btn btn-primary'));
    }
    pgRow.appendChild(button('Play from level 1', () => screens.go('battle', 1), p.continueLevel > 1 ? 'btn' : 'btn btn-primary'));
    pg.appendChild(pgRow);
    menu.appendChild(pg);

    const row2 = el('div', 'menu-row');
    row2.appendChild(button('Workshop', () => ui.toast('The Workshop opens in the next update (Part 1c).')));
    row2.appendChild(button('Blueprints', () => ui.toast('No captured blueprints yet. Bosses start at level 10.')));
    row2.appendChild(button('Settings', () => ui.openSettings()));
    menu.appendChild(row2);
    r.appendChild(menu);

    r.appendChild(el('p', 'title-stats', `Best score ${p.bestScore} · Highest level ${p.highestLevel}`));
    r.appendChild(el('p', 'title-version', `v${GAME_VERSION}`));
  },
  update(dt) { this.t += dt; },
  render(g) {
    const { w, h } = layout;
    drawBackground(g, save.settings.reducedMotion ? 0 : this.t * 12);
    g.fillStyle = PAL.ground;
    g.fillRect(0, h * 0.9, w, h * 0.1);
    g.fillStyle = PAL.groundEdge;
    g.fillRect(0, h * 0.9, w, 2);
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
