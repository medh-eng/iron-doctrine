/* ==== 04 INPUT ==== */
// One pointer router on the canvas (design/04 §5, design/02 §3.6):
// - a touch that starts inside a control belongs to it until released (pointer capture)
// - every other touch goes to the world; two world touches are a pinch
// - touches starting within 24 px of a screen edge are ignored by the world
// - timing uses event.timeStamp

// A control is a thumb button, chip or top-bar button drawn on the canvas.
function makeControl(id, opts) {
  return Object.assign({
    id,
    shape: 'circle',    // 'circle' (x, y, r) or 'rect' (x, y, w, h; x/y = top-left)
    x: 0, y: 0, r: 30, w: 0, h: 0,
    pad: 6,             // extra hit area around the drawn shape
    label: '',
    glyph: null,        // name in GLYPHS
    hidden: false,
    disabled: false,
    lit: false,         // e.g. the active order chip
    held: false,        // pressed from the keyboard
    pressCount: 0,
    releasedAt: -1,
    down: null,         // (pointer) =>
    move: null,         // (pointer) =>
    up: null,           // (pointer, cancelled) =>
  }, opts);
}

function hitControl(c, x, y) {
  if (c.hidden) return false;
  if (c.shape === 'circle') return dist(x, y, c.x, c.y) <= c.r + c.pad;
  return x >= c.x - c.pad && x <= c.x + c.w + c.pad && y >= c.y - c.pad && y <= c.y + c.h + c.pad;
}

const input = {
  pointers: new Map(),
  world: [],                 // world pointers, oldest first
  pinch: null,               // {d0, cx, cy}
  keys: new Set(),
  lastTap: { t: -1e9, x: 0, y: 0 },
  lastControlTouch: 0,       // performance.now() ms, for the controls' ghost mode
  lastWorldTouch: 0,

  local(e) { return [e.clientX - layout.x, e.clientY - layout.y]; },

  nearEdge(x, y) {
    return x < EDGE_IGNORE_PX || y < EDGE_IGNORE_PX || x > layout.w - EDGE_IGNORE_PX || y > layout.h - EDGE_IGNORE_PX;
  },

  down(e) {
    const scr = screens.cur;
    if (!scr) return;
    const [x, y] = this.local(e);
    const p = { id: e.pointerId, x, y, sx: x, sy: y, lx: x, ly: y, t0: e.timeStamp, owner: null, moved: false, long: false, type: e.pointerType, button: e.button };
    this.pointers.set(e.pointerId, p);

    const controls = scr.controls || [];
    for (let i = controls.length - 1; i >= 0; i--) {
      const c = controls[i];
      if (!hitControl(c, x, y)) continue;
      p.owner = c;
      this.capture(e);
      this.lastControlTouch = e.timeStamp;
      c.pressCount++;
      if (!c.disabled && c.down) c.down(p);
      return;
    }
    if (!scr.world) return;
    if (p.type === 'touch' && this.nearEdge(x, y)) return;
    p.owner = 'world';
    this.capture(e);
    this.lastWorldTouch = e.timeStamp;
    this.world.push(p);
    if (this.world.length === 2) {
      const [a, b] = this.world;
      a.moved = b.moved = true;   // a pinch is never a tap
      this.pinch = { d0: Math.max(1, dist(a.x, a.y, b.x, b.y)), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    }
  },

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const [x, y] = this.local(e);
    p.lx = p.x; p.ly = p.y;
    p.x = x; p.y = y;
    const scr = screens.cur;
    if (p.owner && p.owner !== 'world') {
      if (!p.owner.disabled && p.owner.move) p.owner.move(p);
      return;
    }
    if (p.owner !== 'world' || !scr || !scr.world) return;
    this.lastWorldTouch = e.timeStamp;
    if (this.pinch && this.world.length >= 2) {
      const [a, b] = this.world;
      if (p !== a && p !== b) return;
      const d = Math.max(1, dist(a.x, a.y, b.x, b.y));
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      if (scr.world.pinch) scr.world.pinch(d / this.pinch.d0, cx, cy);
      if (scr.world.pan) scr.world.pan(cx - this.pinch.cx, cy - this.pinch.cy);
      this.pinch.d0 = d; this.pinch.cx = cx; this.pinch.cy = cy;
      return;
    }
    if (!p.moved && dist(p.sx, p.sy, x, y) > TAP_MOVE_PX) {
      p.moved = true;
      p.lx = p.sx; p.ly = p.sy;   // include the slop so the pan doesn't jump
    }
    if (p.moved && !p.long && scr.world.pan) scr.world.pan(x - p.lx, y - p.ly);
  },

  up(e, cancelled) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    const scr = screens.cur;
    if (p.owner && p.owner !== 'world') {
      const c = p.owner;
      c.pressCount = Math.max(0, c.pressCount - 1);
      c.releasedAt = performance.now();
      this.lastControlTouch = e.timeStamp;
      if (!c.disabled && c.up) c.up(p, cancelled);
      return;
    }
    if (p.owner !== 'world') return;
    const i = this.world.indexOf(p);
    if (i >= 0) this.world.splice(i, 1);
    if (this.pinch) {
      this.pinch = null;
      for (const q of this.world) q.moved = true;
    }
    if (!scr || !scr.world || cancelled) return;
    if (p.moved && scr.world.panEnd) scr.world.panEnd();
    const dur = e.timeStamp - p.t0;
    if (!p.moved && !p.long && dur <= TAP_MAX_MS) {
      const lt = this.lastTap;
      if (e.timeStamp - lt.t <= DOUBLE_TAP_MS && dist(lt.x, lt.y, p.x, p.y) < 30 && scr.world.doubleTap) {
        lt.t = -1e9;
        scr.world.doubleTap(p.x, p.y);
      } else {
        lt.t = e.timeStamp; lt.x = p.x; lt.y = p.y;
        if (scr.world.tap) scr.world.tap(p.x, p.y);
      }
    }
  },

  capture(e) {
    try { canvas.setPointerCapture(e.pointerId); } catch (_e) { /* ignore */ }
  },

  // Called every frame: long-press detection.
  update(now) {
    const scr = screens.cur;
    if (this.world.length !== 1 || !scr || !scr.world) return;
    const p = this.world[0];
    if (!p.moved && !p.long && now - p.t0 >= LONG_PRESS_MS) {
      p.long = true;
      if (scr.world.longPress) scr.world.longPress(p.x, p.y);
    }
  },

  wheel(e) {
    const scr = screens.cur;
    if (!scr || !scr.world || !scr.world.pinch) return;
    e.preventDefault();
    const [x, y] = this.local(e);
    scr.world.pinch(Math.exp(-e.deltaY * 0.0015), x, y);
    this.lastWorldTouch = e.timeStamp;
  },

  // Drop every touch and key (used when pausing, hiding or changing screen) so nothing sticks.
  releaseAll() {
    for (const p of this.pointers.values()) {
      if (p.owner && p.owner !== 'world') {
        const c = p.owner;
        c.pressCount = Math.max(0, c.pressCount - 1);
        c.releasedAt = performance.now();
        if (!c.disabled && c.up) c.up(p, true);
      }
    }
    this.pointers.clear();
    this.world.length = 0;
    this.pinch = null;
    const scr = screens.cur;
    for (const code of this.keys) if (scr && scr.key) scr.key(code, false);
    this.keys.clear();
  },

  keyDown(e) {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const code = e.code;
    audio.unlock();
    if (code === 'KeyP' || code === 'Escape') { if (!e.repeat) onPauseKey(); return; }
    const scr = screens.cur;
    // Menus keep normal keyboard navigation; only in-game keys are captured.
    if (ui.modalOpen() || !scr || !scr.key) return;
    if (/^(Space|Tab|Arrow)/.test(code)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(code);
    scr.key(code, true);
  },

  keyUp(e) {
    const code = e.code;
    if (!this.keys.has(code)) return;
    this.keys.delete(code);
    const scr = screens.cur;
    if (scr && scr.key) scr.key(code, false);
  },

  init() {
    canvas.addEventListener('pointerdown', (e) => { audio.unlock(); this.down(e); });
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e, false));
    canvas.addEventListener('pointercancel', (e) => this.up(e, true));
    canvas.addEventListener('lostpointercapture', (e) => { if (this.pointers.has(e.pointerId)) this.up(e, true); });
    canvas.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keyUp(e));
  },
};
