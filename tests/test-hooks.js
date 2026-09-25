// Injected ONLY into build-test/index.html (node build.mjs --test).
// The game exposes its internals via window.__GAME__ inside /*TEST:BEGIN*/ blocks:
//   state, layout, save, input, audio, screens, SCREENS, ui,
//   go(screen, arg), togglePause(), pauseGame(), toggleTime(), setSetting(k, v),
//   flush(), setHidden(bool), controlRects()
// Extend this as parts are built: autoplay, forced events (winLevel, loseSquad,
// gameOver, setLevel), time scale, fixed seeds.
window.__TEST__ = {
  startedAt: Date.now(),
  autoplay: false,
  timeScale: 1,
  seed: 12345,
};
