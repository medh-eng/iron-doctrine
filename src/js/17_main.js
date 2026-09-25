/* ==== 17 MAIN ==== */
// Boot, resize/orientation, the fixed-step loop, and pause on hide, blur and portrait.
// Loop states (design/04 §4): running, frozen (tactical time stop: the screen
// halts its own simulation), paused (Pause card), hidden (auto-pause, audio suspended).

const game = { time: 0, paused: false, frozen: false, hidden: false, portrait: false, frames: 0, fps: 60 };

let lastT = performance.now();
let acc = 0;
let fpsAcc = 0;
let fpsFrames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.25) dt = 0.25;
  const scr = screens.cur;
  const simRunning = !game.paused && !game.hidden && !game.portrait;
  input.update(now);
  acc += dt;
  let steps = 0;
  while (acc >= SIM_STEP && steps < MAX_SIM_STEPS) {
    if (simRunning) game.time += SIM_STEP;
    if (scr && scr.update) scr.update(SIM_STEP, simRunning);
    acc -= SIM_STEP;
    steps++;
  }
  if (steps === MAX_SIM_STEPS) acc = 0;
  if (!game.hidden && scr && scr.render) {
    scr.render(ctx, now);
    if (save.settings.showFps) drawFps(dt);
  }
  game.frames++;
}

function drawFps(dt) {
  fpsAcc += dt;
  fpsFrames++;
  if (fpsAcc >= 0.5) { game.fps = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }
  const { h, safe } = layout;
  ctx.font = `400 12px ${FONT_UI}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(230,220,195,0.8)';
  ctx.fillText(game.fps + ' fps', safe.l + 6, h - safe.b - 2);
}

// ---------- lifecycle
function setHidden(hidden) {
  if (game.hidden === hidden) return;
  game.hidden = hidden;
  lastT = performance.now();
  if (hidden) {
    input.releaseAll();
    pauseGame();
    save.flush();
  }
  audio.setHidden(hidden);
}

let resizeTimer = 0;
function scheduleResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const wasPortrait = game.portrait;
    resize();
    if (game.portrait && !wasPortrait) { input.releaseAll(); pauseGame(); }
  }, 100);
}

// First tap anywhere: unlock audio and, on phones, go full screen if the setting is on.
// pointerup (not pointerdown) counts as a user gesture for full screen on touch devices.
let firstGestureDone = false;
function firstGesture() {
  audio.unlock();
  if (firstGestureDone) return;
  firstGestureDone = true;
  if (save.settings.fullscreen && !FINE_POINTER.matches && screens.name === 'title') enterFullscreen();
}

function applySettings(name) {
  audio.applySettings();
  if (name === 'quality' || name === 'btnSize' || name === 'leftHanded' || name === '*') resize();
  document.documentElement.classList.toggle('reduced-motion', save.settings.reducedMotion);
}

function boot() {
  save.load();
  if (save.firstRun) {
    save.settings.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  ui.init();
  input.init();
  bus.on('settings', applySettings);
  bus.on('profile', () => { if (screens.name === 'title') SCREENS.title.build(); });
  applySettings('');

  window.addEventListener('resize', scheduleResize);
  window.addEventListener('orientationchange', scheduleResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleResize);
  document.addEventListener('visibilitychange', () => setHidden(document.visibilityState === 'hidden'));
  window.addEventListener('blur', () => { input.releaseAll(); pauseGame(); save.flush(); });
  window.addEventListener('pagehide', () => save.flush());
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('pointerup', firstGesture, true);
  window.addEventListener('keydown', firstGesture, true);

  resize();
  screens.go('title');
  for (const msg of save.notices) ui.toast(msg, 6000);
  requestAnimationFrame(frame);

  // The stencil font arrives as base64; redraw anything cached once it is ready.
  if (document.fonts && document.fonts.load) document.fonts.load(`44px ${FONT_STENCIL}`).catch(() => {});
}

/*TEST:BEGIN*/
window.__GAME__ = {
  state: game,
  layout,
  version: GAME_VERSION,
  saveVersion: SAVE_VERSION,
  save,
  input,
  audio,
  screens,
  SCREENS,
  ui,
  togglePause,
  pauseGame,
  go: (name, arg) => screens.go(name, arg),
  toggleTime: () => { if (screens.cur && screens.cur.toggleTime) screens.cur.toggleTime(); },
  setSetting: (k, v) => save.setSetting(k, v),
  flush: () => save.flush(),
  setHidden,
  controlRects: () => (screens.cur && screens.cur.controls ? screens.cur.controls : []).filter((c) => !c.hidden)
    .map((c) => ({ id: c.id, shape: c.shape, x: c.x, y: c.y, r: c.r, w: c.w, h: c.h, cx: c.shape === 'circle' ? c.x : c.x + c.w / 2, cy: c.shape === 'circle' ? c.y : c.y + c.h / 2 })),
};
/*TEST:END*/

boot();
