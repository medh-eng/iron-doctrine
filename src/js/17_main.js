/* ==== 17 MAIN ==== */
// Starter boot: layout, pixel ratio, fixed-step loop, pause on hide/portrait,
// and a placeholder title scene. Part 1a replaces the scene with real screens.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const uiLayer = document.getElementById('ui');
const FINE_POINTER = window.matchMedia('(pointer: fine)');
const PORTRAIT_TOUCH = window.matchMedia('(orientation: portrait) and (pointer: coarse)');

const layout = { x: 0, y: 0, w: 1, h: 1, dpr: 1 };
const state = { time: 0, paused: false, hidden: false, portrait: false, frames: 0 };
const bg = { sky: null, far: null, mid: null, midW: 0 };

function resize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let w = vw;
  let h = vh;
  if (FINE_POINTER.matches) {
    // Desktop: 16:9 letterbox, max 1280 wide, centred.
    w = Math.min(vw, DESKTOP_MAX_W, Math.floor((vh * 16) / 9));
    h = Math.min(vh, Math.floor((w * 9) / 16));
  }
  layout.w = w;
  layout.h = h;
  layout.x = Math.floor((vw - w) / 2);
  layout.y = Math.floor((vh - h) / 2);
  layout.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

  for (const el of [canvas, uiLayer]) {
    el.style.left = layout.x + 'px';
    el.style.top = layout.y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
  }
  canvas.width = Math.round(w * layout.dpr);
  canvas.height = Math.round(h * layout.dpr);
  ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);

  state.portrait = PORTRAIT_TOUCH.matches;
  buildBackground();
}

// Pre-render static layers once per resize (design/04 §3).
function makeLayer(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * layout.dpr));
  c.height = Math.max(1, Math.round(h * layout.dpr));
  const g = c.getContext('2d');
  g.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
  return { c, g };
}

function ridge(g, w, h, baseY, amp, seed, color) {
  const rng = makeRng(seed);
  const f1 = rng.range(0.004, 0.008);
  const f2 = rng.range(0.012, 0.02);
  const p1 = rng.range(0, 6.28);
  const p2 = rng.range(0, 6.28);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) {
    const y = baseY - amp * (0.6 * Math.sin(x * f1 + p1) + 0.4 * Math.sin(x * f2 + p2));
    g.lineTo(x, y);
  }
  g.lineTo(w, h);
  g.closePath();
  g.fill();
}

function buildBackground() {
  const { w, h } = layout;
  const sky = makeLayer(w, h);
  const grad = sky.g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, PAL.skyTop);
  grad.addColorStop(0.45, PAL.sky2);
  grad.addColorStop(0.72, PAL.sky3);
  grad.addColorStop(0.9, PAL.horizon);
  sky.g.fillStyle = grad;
  sky.g.fillRect(0, 0, w, h);
  ridge(sky.g, w, h, h * 0.74, h * 0.07, 11, PAL.ridgeFar);
  bg.sky = sky.c;

  // Mid ridge is twice as wide so it can drift and wrap seamlessly.
  bg.midW = w * 2;
  const mid = makeLayer(bg.midW, h);
  ridge(mid.g, bg.midW, h, h * 0.84, h * 0.06, 29, PAL.ridgeMid);
  bg.mid = mid.c;
}

function update(dt) {
  state.time += dt;
}

function render() {
  const { w, h } = layout;
  ctx.drawImage(bg.sky, 0, 0, w, h);

  // Drifting mid ridge (parallax placeholder).
  const off = (state.time * 12) % (bg.midW / 2);
  ctx.drawImage(bg.mid, -off, 0, bg.midW, h);

  // Near ground band.
  ctx.fillStyle = PAL.ground;
  ctx.fillRect(0, h * 0.9, w, h * 0.1);
  ctx.fillStyle = PAL.groundEdge;
  ctx.fillRect(0, h * 0.9, w, 2);

  // Title placeholder (the stencil font arrives in Part 1a).
  const titleSize = clamp(Math.round(h * 0.13), 32, 76);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = Math.round(titleSize * 0.08) + 'px';
  ctx.font = `800 ${titleSize}px ${FONT_UI}`;
  ctx.fillStyle = PAL.linen;
  ctx.fillText('IRON DOCTRINE', w / 2, h * 0.36);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  ctx.font = `400 ${clamp(Math.round(h * 0.045), 14, 20)}px ${FONT_UI}`;
  ctx.fillStyle = 'rgba(230, 220, 195, 0.9)';
  ctx.fillText("No manual tells you how to win this war. You'll write your own.", w / 2, h * 0.36 + titleSize * 0.85);

  ctx.font = `400 ${clamp(Math.round(h * 0.036), 12, 15)}px ${FONT_UI}`;
  ctx.fillStyle = 'rgba(230, 220, 195, 0.7)';
  ctx.fillText(`Starter build v${GAME_VERSION}. Part 1a is next.`, w / 2, h * 0.95);
}

let lastT = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.25) dt = 0.25;
  const running = !state.paused && !state.hidden && !state.portrait;
  if (running) {
    acc += dt;
    let steps = 0;
    while (acc >= SIM_STEP && steps < MAX_SIM_STEPS) {
      update(SIM_STEP);
      acc -= SIM_STEP;
      steps++;
    }
    if (steps === MAX_SIM_STEPS) acc = 0;
  }
  if (!state.hidden) render();
  state.frames++;
}

let resizeTimer = 0;
function scheduleResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 100);
}
window.addEventListener('resize', scheduleResize);
window.addEventListener('orientationchange', scheduleResize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleResize);
document.addEventListener('visibilitychange', () => {
  state.hidden = document.visibilityState === 'hidden';
  lastT = performance.now();
});
window.addEventListener('contextmenu', (e) => e.preventDefault());

/*TEST:BEGIN*/
window.__GAME__ = { state, layout, version: GAME_VERSION };
/*TEST:END*/

resize();
requestAnimationFrame(frame);
