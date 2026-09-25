// Injected ONLY into build-test/index.html (node build.mjs --test).
// The game exposes its internals via window.__GAME__ inside /*TEST:BEGIN*/ blocks.
// Extend this as parts are built: autoplay, forced events (winLevel, loseSquad,
// gameOver, togglePause, toggleTime, setLevel), time scale, fixed seeds.
window.__TEST__ = {
  startedAt: Date.now(),
  autoplay: false,
  timeScale: 1,
  seed: 12345,
};
