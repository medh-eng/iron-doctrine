/* ==== 16 SCREENS ==== */
// Screen manager plus the Part 1a screens: title and the controls test range.
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
      pgRow.appendChild(button(`Continue at level ${p.continueLevel}`, () => screens.go('range', p.continueLevel), 'btn btn-primary'));
    }
    pgRow.appendChild(button('Play from level 1', () => screens.go('range', 1), p.continueLevel > 1 ? 'btn' : 'btn btn-primary'));
    pg.appendChild(pgRow);
    menu.appendChild(pg);

    const row2 = el('div', 'menu-row');
    row2.appendChild(button('Drafting Office', () => ui.toast('The Drafting Office opens in a later update.')));
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

// ---------- Controls test range (stand-in for the battle until Part 1b)
// A flat range with three placeholder vehicles and target boards, so every
// thumb control, gesture and key can be tried and tested.
const PX_PER_M = 10;            // at 360 px screen height; scales with the screen
const RANGE_GRAVITY = 20;
const SHELL_SPEED = 55;
const RELOAD_TIME = 1.2;
const ORDERS = ['Follow', 'Escort', 'Hold', 'Attack', 'Back'];

function rangeGroundY(x) { return 1.2 * Math.sin(x * 0.035) + 0.5 * Math.sin(x * 0.11); }

SCREENS.range = {
  pausable: true,
  level: 1,
  cam: { x: 0, y: 4, zoom: 1, follow: true },
  squad: [],
  active: 0,
  order: 'Follow',
  targets: [],
  target: -1,
  hits: 0,
  shots: 0,
  reload: 0,
  aim: null,          // {x, y} world point while manually aiming
  drive: 0,
  frozen: false,
  simTime: 0,
  tracers: makePool(() => ({ alive: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, life: 0, rocket: false }), MAX_TRACERS),
  puffs: makePool(() => ({ alive: false, x: 0, y: 0, r: 0, t: 0, life: 1 }), 60),
  controls: [],
  c: {},

  enter(level) {
    this.level = level || 1;
    this.squad = [0, 1, 2].map((i) => ({ x: 10 - i * 9, v: 0, hold: null, flip: false }));
    this.active = 0;
    this.order = 'Follow';
    this.targets = [55, 85, 120].map((x) => ({ x, hitT: -9 }));
    this.target = -1;
    this.hits = 0;
    this.shots = 0;
    this.reload = 0;
    this.aim = null;
    this.drive = 0;
    this.frozen = false;
    this.simTime = 0;
    this.cam.x = this.squad[0].x + 12;
    this.cam.y = 4;
    this.cam.zoom = 1;
    this.cam.follow = true;
    this.tracers.forEachAlive((t) => { t.alive = false; });
    this.puffs.forEachAlive((p) => { p.alive = false; });
    this.buildControls();
    audio.playTheme(null);
    game.frozen = false;
    ui.toast('Controls test range. Battles arrive in the next update.', 3500);
  },

  exit() { game.frozen = false; },

  pauseOpts() {
    return {
      restartLabel: 'Restart',
      restart: () => this.enter(this.level),
      quit: () => screens.go('title'),
    };
  },

  // ---------- controls
  buildControls() {
    const C = this.c;
    const drivePress = () => { this.updateDrive(); };
    C.left = makeControl('left', { glyph: 'left', down: drivePress, up: drivePress });
    C.right = makeControl('right', { glyph: 'right', down: drivePress, up: drivePress });
    C.upBtn = makeControl('up', { glyph: 'up', hidden: true });
    C.downBtn = makeControl('down', { glyph: 'down', hidden: true });
    C.fire = makeControl('fire', {
      label: 'Fire',
      down: (p) => { p.fireAim = false; },
      move: (p) => this.fireDrag(p),
      up: (p, cancelled) => this.fireUp(p, cancelled),
    });
    C.alt = makeControl('alt', { label: 'Alt', up: (p, x) => { if (!x) this.fireRocket(); } });
    C.swap = makeControl('swap', { label: 'Swap', up: (p, x) => { if (!x) this.swap(); } });
    C.special = makeControl('special', { label: 'Smoke', up: (p, x) => { if (!x) this.smoke(); } });
    C.chips = ORDERS.map((o, i) => makeControl('order' + i, {
      shape: 'rect', label: o, pad: 2, up: (p, x) => { if (!x) this.setOrder(o); },
    }));
    C.time = makeControl('time', { shape: 'rect', glyph: 'stop', pad: 4, up: (p, x) => { if (!x) this.toggleTime(); } });
    C.pause = makeControl('pause', { shape: 'rect', glyph: 'pause', pad: 4, up: (p, x) => { if (!x) togglePause(); } });
    C.settings = makeControl('settings', { shape: 'rect', glyph: 'gear', pad: 4, up: (p, x) => { if (!x) openSettingsPaused(); } });
    C.recenter = makeControl('recenter', { shape: 'rect', label: 'Recenter', hidden: true, up: (p, x) => { if (!x) this.recenter(); } });
    C.cards = [0, 1, 2].map((i) => makeControl('card' + i, {
      shape: 'rect', pad: 2, up: (p, x) => { if (!x) this.takeControl(i); },
    }));
    this.controls = [C.left, C.right, C.upBtn, C.downBtn, C.special, C.alt, C.swap, C.fire, ...C.chips,
      C.recenter, ...C.cards, C.time, C.pause, C.settings];
  },

  layout() {
    const C = this.c;
    if (!C.fire) return;
    const { w, h, safe } = layout;
    const s = BTN_SCALE[save.settings.btnSize] || 1;
    const L = save.settings.leftHanded;
    const mx = (x) => (L ? w - x : x);   // mirror for left-handed

    const top = safe.t;
    const barH = 34;
    // Top bar buttons, right side (44 px wide targets).
    let bx = w - safe.r - 6;
    for (const b of [C.settings, C.pause, C.time]) {
      bx -= 44;
      b.x = bx; b.y = top + 3; b.w = 42; b.h = 28;
      bx -= 4;
    }
    // Squad cards, left side.
    for (let i = 0; i < 3; i++) {
      const cd = C.cards[i];
      cd.x = safe.l + 6 + i * 50; cd.y = top + 3; cd.w = 46; cd.h = 28;
    }

    // Right thumb cluster.
    const R = (FIRE_DIAMETER / 2) * s;
    const r2 = 24 * s;
    const edgeR = safe.r + 10;
    const chipW = 72;
    const fireX = w - edgeR - chipW - 6 - R;
    const fireY = h - safe.b - 12 - R;
    C.fire.x = mx(fireX); C.fire.y = fireY; C.fire.r = R;
    C.alt.x = mx(fireX - R * 1.25); C.alt.y = fireY - R * 1.35; C.alt.r = r2;
    C.special.x = mx(fireX - R * 1.95); C.special.y = fireY + R * 0.25; C.special.r = r2;
    C.swap.x = mx(w - edgeR - chipW / 2); C.swap.y = fireY - R * 0.35; C.swap.r = Math.max(r2, 26 * s);

    // Order chips: a column on the edge above Swap.
    const chipTop = top + barH + 8;
    const chipBottom = C.swap.y - C.swap.r - 8;
    const gap = 4;
    const chipH = clamp(Math.floor((chipBottom - chipTop - gap * 4) / 5), 24, 36);
    for (let i = 0; i < 5; i++) {
      const cp = C.chips[i];
      cp.w = chipW; cp.h = chipH;
      cp.x = L ? safe.l + 10 : w - edgeR - chipW;
      cp.y = chipTop + i * (chipH + gap);
    }

    // Left thumb: drive pad.
    const Rp = 34 * s;
    const padY = h - safe.b - 14 - Rp;
    const lx = safe.l + 18 + Rp;
    C.left.x = mx(lx); C.left.y = padY; C.left.r = Rp;
    C.right.x = mx(lx + Rp * 2 + 18); C.right.y = padY; C.right.r = Rp;
    if (L) { const t = C.left.x; C.left.x = C.right.x; C.right.x = t; }

    C.recenter.w = 92; C.recenter.h = 30;
    C.recenter.x = w / 2 - 46; C.recenter.y = top + barH + 8;
  },

  // ---------- squad and orders
  get me() { return this.squad[this.active]; },

  updateDrive() {
    const k = input.keys;
    const l = this.c.left.pressCount > 0 || k.has('KeyA') || k.has('ArrowLeft');
    const r = this.c.right.pressCount > 0 || k.has('KeyD') || k.has('ArrowRight');
    this.c.left.held = k.has('KeyA') || k.has('ArrowLeft');
    this.c.right.held = k.has('KeyD') || k.has('ArrowRight');
    const before = this.drive;
    this.drive = l && r ? 2 : l ? -1 : r ? 1 : 0;   // 2 = halt/brake
    if (this.drive !== before && (this.drive === 1 || this.drive === -1)) audio.sfx('engineRev', this.panOf(this.me.x));
  },

  takeControl(i) {
    if (i === this.active) return;
    this.active = i;
    this.me.hold = null;
    this.cam.follow = true;
    audio.sfx('swap');
    haptic('tap');
    floatText(`Vehicle ${i + 1}`, this.me.x, rangeGroundY(this.me.x) + 5);
  },

  swap() { this.takeControl((this.active + 1) % 3); },

  setOrder(o) {
    this.order = o;
    for (const s of this.squad) s.hold = null;
    audio.sfx('order');
    haptic('tap');
    floatText(o, this.me.x, rangeGroundY(this.me.x) + 5);
  },

  recenter() {
    this.cam.follow = true;
    audio.sfx('tap');
  },

  toggleTime() {
    this.frozen = !this.frozen;
    game.frozen = this.frozen;
    this.c.time.glyph = this.frozen ? 'play' : 'stop';
    this.c.time.glyphLines = null;
    audio.sfx(this.frozen ? 'timeStop' : 'timeStart');
    haptic('tap');
  },

  // ---------- weapons (placeholder ballistics; real combat is Part 1b)
  muzzle(v) {
    const dir = v.flip ? -1 : 1;
    return { x: v.x + dir * 4.2, y: rangeGroundY(v.x) + 2.6, dir };
  },

  // Low-angle firing solution to hit (tx, ty) from (x, y); out of range fires at 45°.
  solve(x, y, tx, ty, speed) {
    const dx = tx - x;
    const dy = ty - y;
    const ax = Math.max(0.01, Math.abs(dx));
    const v2 = speed * speed;
    const disc = v2 * v2 - RANGE_GRAVITY * (RANGE_GRAVITY * ax * ax + 2 * dy * v2);
    const ang = disc < 0 ? Math.PI / 4 : Math.atan((v2 - Math.sqrt(disc)) / (RANGE_GRAVITY * ax));
    return { vx: Math.cos(ang) * speed * (dx < 0 ? -1 : 1), vy: Math.sin(ang) * speed };
  },

  fireDrag(p) {
    const C = this.c.fire;
    if (this.frozen) return;
    const off = dist(p.x, p.y, C.x, C.y);
    if (!p.fireAim && off > C.r * 0.6) p.fireAim = true;
    if (!p.fireAim) return;
    if (off < C.r * 0.8) { this.aim = null; return; }   // back on the button: cancel
    const wx = this.toWorldX(p.x);
    const wy = Math.max(this.toWorldY(p.y), rangeGroundY(wx));
    this.aim = this.aim || { x: 0, y: 0 };
    this.aim.x = wx; this.aim.y = wy;
  },

  fireUp(p, cancelled) {
    const aim = this.aim;
    this.aim = null;
    if (cancelled || this.frozen) return;
    if (p.fireAim) {
      if (aim) this.fireShell(aim.x, aim.y);
      else audio.sfx('back');
      return;
    }
    this.fireAuto();
  },

  fireAuto() {
    if (this.frozen) return;
    const me = this.me;
    let tx;
    if (this.target >= 0) tx = this.targets[this.target].x;
    else {
      // Nearest board in front, else a point 40 m ahead.
      const dir = me.flip ? -1 : 1;
      tx = me.x + dir * 40;
      let best = Infinity;
      for (const t of this.targets) {
        const d = (t.x - me.x) * dir;
        if (d > 5 && d < best) { best = d; tx = t.x; }
      }
    }
    this.fireShell(tx, rangeGroundY(tx) + 1.5);
  },

  fireShell(tx, ty) {
    if (this.reload > 0) { audio.sfx('error'); return; }
    const me = this.me;
    me.flip = tx < me.x;
    const m = this.muzzle(me);
    const v = this.solve(m.x, m.y, tx, ty, SHELL_SPEED);
    this.spawnTracer(m.x, m.y, v.vx, v.vy, false);
    this.reload = RELOAD_TIME;
    this.shots++;
    audio.sfx('cannon', this.panOf(m.x), 1);
    haptic('fire');
    this.puff(m.x, m.y, 0.8);
  },

  fireRocket() {
    if (this.frozen) return;
    const me = this.me;
    const m = this.muzzle(me);
    this.spawnTracer(m.x, m.y + 0.5, m.dir * 70, 6, true);
    audio.sfx('rocket', this.panOf(m.x));
    haptic('fire');
  },

  smoke() {
    if (this.frozen) return;
    const me = this.me;
    for (let i = 0; i < 6; i++) this.puff(me.x + (i - 2.5) * 1.6, rangeGroundY(me.x) + 1.5 + (i % 2), 2.2);
    audio.sfx('smoke', this.panOf(me.x));
    haptic('tap');
  },

  spawnTracer(x, y, vx, vy, rocket) {
    const t = this.tracers.take();
    t.x = t.px = x; t.y = t.py = y; t.vx = vx; t.vy = vy; t.life = 4; t.rocket = rocket;
  },

  puff(x, y, r) {
    const p = this.puffs.take();
    p.x = x; p.y = y; p.r = r; p.t = 0; p.life = 1.4 + r * 0.3;
  },

  panOf(wx) { return clamp((this.toScreenX(wx) / layout.w) * 2 - 1, -1, 1) * 0.8; },

  // ---------- camera
  scale() { return PX_PER_M * (layout.h / 360) * this.cam.zoom; },
  toScreenX(wx) { return (wx - this.cam.x) * this.scale() + layout.w / 2; },
  toScreenY(wy) { return layout.h * 0.62 - (wy - this.cam.y) * this.scale(); },
  toWorldX(sx) { return (sx - layout.w / 2) / this.scale() + this.cam.x; },
  toWorldY(sy) { return (layout.h * 0.62 - sy) / this.scale() + this.cam.y; },

  world: {
    tap(x, y) {
      const R = SCREENS.range;
      const wx = R.toWorldX(x);
      const wy = R.toWorldY(y);
      // Own vehicle: take control.
      for (let i = 0; i < 3; i++) {
        const v = R.squad[i];
        if (Math.abs(wx - v.x) < 4 && wy > rangeGroundY(v.x) - 1 && wy < rangeGroundY(v.x) + 5) { R.takeControl(i); return; }
      }
      // Target board: set as target (tap again to clear).
      for (let i = 0; i < R.targets.length; i++) {
        const t = R.targets[i];
        if (Math.abs(wx - t.x) < 3 && wy > rangeGroundY(t.x) - 1 && wy < rangeGroundY(t.x) + 6) {
          R.target = R.target === i ? -1 : i;
          audio.sfx(R.target === i ? 'toggleOn' : 'toggleOff');
          haptic('tap');
          if (R.target === i) floatText('Target', t.x, rangeGroundY(t.x) + 6.5, true);
          return;
        }
      }
    },
    doubleTap() {
      const R = SCREENS.range;
      R.cam.zoom = 1;
      audio.sfx('tap');
    },
    longPress(x) {
      const R = SCREENS.range;
      const wx = R.toWorldX(x);
      for (let i = 0; i < 3; i++) if (i !== R.active) R.squad[i].hold = wx + (i - 1) * 6;
      audio.sfx('order');
      haptic('tap');
      floatText('Move here', wx, rangeGroundY(wx) + 3);
    },
    pan(dx, dy) {
      const R = SCREENS.range;
      R.cam.follow = false;
      R.cam.x -= dx / R.scale();
      R.cam.y = clamp(R.cam.y + dy / R.scale(), -2, 30);
    },
    pinch(f, cx, cy) {
      const R = SCREENS.range;
      const bx = R.toWorldX(cx), by = R.toWorldY(cy);
      R.cam.zoom = clamp(R.cam.zoom * f, ZOOM_MIN, ZOOM_MAX);
      R.cam.x += bx - R.toWorldX(cx);
      R.cam.y = clamp(R.cam.y + by - R.toWorldY(cy), -2, 30);
    },
  },

  key(code, down) {
    if (/^(KeyA|KeyD|ArrowLeft|ArrowRight)$/.test(code)) { this.updateDrive(); return; }
    const hold = (c) => { c.held = down; if (!down) c.releasedAt = performance.now(); };
    if (code === 'Space') { hold(this.c.fire); if (down) this.fireAuto(); return; }
    if (code === 'KeyF') { hold(this.c.alt); if (down) this.fireRocket(); return; }
    if (code === 'KeyE' || code === 'Tab') { hold(this.c.swap); if (down) this.swap(); return; }
    if (code === 'KeyQ') { hold(this.c.special); if (down) this.smoke(); return; }
    const n = /^Digit([1-5])$/.exec(code);
    if (n) { const c = this.c.chips[+n[1] - 1]; hold(c); if (down) this.setOrder(ORDERS[+n[1] - 1]); return; }
    if (!down) return;
    if (code === 'KeyT') this.toggleTime();
    else if (code === 'KeyC') this.recenter();
  },

  // ---------- simulation
  update(dt, simRunning) {
    if (simRunning && !this.frozen) this.step(dt);
    this.updateCamera(dt);
    updateFloaters(dt);
    const C = this.c;
    for (let i = 0; i < 5; i++) C.chips[i].lit = ORDERS[i] === this.order;
    for (let i = 0; i < 3; i++) C.cards[i].lit = i === this.active;
    C.recenter.hidden = this.cam.follow;
    C.fire.disabled = this.frozen;
    C.alt.disabled = this.frozen;
    C.special.disabled = this.frozen;
  },

  step(dt) {
    this.simTime += dt;
    this.reload = Math.max(0, this.reload - dt);
    const me = this.me;
    // Controlled vehicle: simple kinematic drive (real physics arrive in Part 1b).
    const accel = 9;
    if (this.drive === 2) me.v *= Math.pow(0.02, dt);
    else if (this.drive) { me.v += this.drive * accel * dt; me.flip = this.drive < 0; }
    else me.v *= Math.pow(0.3, dt);
    me.v = clamp(me.v, -8, 12);
    // Squad-mates follow the order.
    for (let i = 0; i < 3; i++) {
      if (i === this.active) continue;
      const v = this.squad[i];
      const slot = i < this.active ? i + 1 : i;   // 1 or 2 behind
      const dir = me.flip ? 1 : -1;
      let goal = null;
      if (v.hold !== null) goal = v.hold;
      else if (this.order === 'Follow') goal = me.x + dir * 10 * slot;
      else if (this.order === 'Escort') goal = me.x + dir * 5 * slot - dir * (slot === 2 ? 10 : 0);
      else if (this.order === 'Attack') goal = this.target >= 0 ? this.targets[this.target].x - 25 - slot * 6 : me.x - dir * 8 * slot;
      else if (this.order === 'Back') goal = me.x + dir * 25 * slot;
      if (goal === null) v.v *= Math.pow(0.05, dt);
      else {
        const d = goal - v.x;
        const want = clamp(d * 0.8, -9, 9);
        v.v += clamp(want - v.v, -8 * dt, 8 * dt);
        if (Math.abs(d) > 1) v.flip = d < 0;
      }
    }
    for (const v of this.squad) v.x = clamp(v.x + v.v * dt, -60, 220);

    // Tracers.
    this.tracers.forEachAlive((t) => {
      t.px = t.x; t.py = t.y;
      if (!t.rocket) t.vy -= RANGE_GRAVITY * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.life -= dt;
      for (const b of this.targets) {
        const gy = rangeGroundY(b.x);
        if (Math.abs(t.x - b.x) < 1.2 && t.y > gy && t.y < gy + 5) {
          t.alive = false;
          b.hitT = this.simTime;
          this.hits++;
          floatText(t.rocket ? 'Rocket hit' : 'Hit', b.x, gy + 6.5, true);
          audio.sfx('clunk', this.panOf(b.x));
          this.puff(t.x, t.y, 1);
          return;
        }
      }
      if (t.y < rangeGroundY(t.x) || t.life <= 0) {
        t.alive = false;
        this.puff(t.x, rangeGroundY(t.x) + 0.5, 1.2);
        audio.sfx('tick', this.panOf(t.x), 1.5);
      }
    });
    this.puffs.forEachAlive((p) => { p.t += dt; p.y += dt * 0.8; if (p.t > p.life) p.alive = false; });
  },

  updateCamera(dt) {
    const cam = this.cam;
    const idle = (performance.now() - input.lastWorldTouch) / 1000;
    if (!cam.follow && save.settings.autoRecenter && idle > RECENTER_AFTER && input.world.length === 0) cam.follow = true;
    if (cam.follow) {
      const me = this.me;
      const lead = me.flip ? -12 : 12;
      const k = 1 - Math.pow(0.02, dt);
      cam.x += (me.x + lead - cam.x) * k;
      cam.y += (4 - cam.y) * k;
    }
  },

  // ---------- drawing
  render(g, nowMs) {
    const { w, h, safe } = layout;
    const S = this.scale();
    drawBackground(g, this.cam.x * this.scale() * 0.25);

    // Ground, drawn as one polygon across the screen.
    const x0 = this.toWorldX(-10);
    const x1 = this.toWorldX(w + 10);
    const stepM = 8 / S;
    g.fillStyle = PAL.ground;
    g.beginPath();
    g.moveTo(-10, h);
    for (let x = x0; x <= x1 + stepM; x += stepM) g.lineTo(this.toScreenX(x), this.toScreenY(rangeGroundY(x)));
    g.lineTo(w + 10, h);
    g.closePath();
    g.fill();
    g.strokeStyle = PAL.groundEdge;
    g.lineWidth = 2;
    g.beginPath();
    for (let x = x0; x <= x1 + stepM; x += stepM) {
      const sx = this.toScreenX(x), sy = this.toScreenY(rangeGroundY(x));
      if (x === x0) g.moveTo(sx, sy); else g.lineTo(sx, sy);
    }
    g.stroke();

    // Distance posts every 10 m.
    g.font = `400 12px ${FONT_UI}`;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillStyle = 'rgba(230,220,195,0.55)';
    for (let m = Math.ceil(x0 / 10) * 10; m <= x1; m += 10) {
      const sx = this.toScreenX(m), sy = this.toScreenY(rangeGroundY(m));
      g.fillRect(sx - 1, sy - 8, 2, 8);
      if (m % 20 === 0) g.fillText(m + ' m', sx, sy + 4);
    }

    // Target boards.
    for (let i = 0; i < this.targets.length; i++) {
      const t = this.targets[i];
      const sx = this.toScreenX(t.x), sy = this.toScreenY(rangeGroundY(t.x));
      const flash = clamp(1 - (this.simTime - t.hitT) / 0.25, 0, 1);
      g.fillStyle = flash > 0 ? PAL.amber : PAL.directorate;
      g.fillRect(sx - 0.4 * S, sy - 5 * S, 0.8 * S, 5 * S);
      g.fillRect(sx - 1.4 * S, sy - 5 * S, 2.8 * S, 2.4 * S);
      if (i === this.target) {
        g.strokeStyle = PAL.amber;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(sx, sy - 3.8 * S, 2.4 * S, 0, Math.PI * 2);
        g.stroke();
      }
    }

    // Squad vehicles (placeholder silhouettes).
    for (let i = 0; i < 3; i++) this.drawVehicle(g, this.squad[i], i === this.active, S);

    // Smoke.
    this.puffs.forEachAlive((p) => {
      const k = p.t / p.life;
      g.globalAlpha = 0.5 * (1 - k);
      g.fillStyle = '#8b8a90';
      g.beginPath();
      g.arc(this.toScreenX(p.x), this.toScreenY(p.y), (p.r + k * p.r) * S * 0.6, 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;

    // Tracers.
    g.lineCap = 'round';
    this.tracers.forEachAlive((t) => {
      const ax = this.toScreenX(t.px), ay = this.toScreenY(t.py);
      const bx = this.toScreenX(t.x), by = this.toScreenY(t.y);
      g.strokeStyle = 'rgba(255,178,62,0.35)';
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(ax - (bx - ax) * 2, ay - (by - ay) * 2); g.lineTo(bx, by); g.stroke();
      g.strokeStyle = '#FFE2A8';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(ax - (bx - ax), ay - (by - ay)); g.lineTo(bx, by); g.stroke();
    });

    // Manual-aim trajectory preview.
    if (this.aim && save.settings.aimAssist) {
      const m = this.muzzle(this.me);
      const v = this.solve(m.x, m.y, this.aim.x, this.aim.y, SHELL_SPEED);
      g.fillStyle = 'rgba(255,178,62,0.85)';
      let x = m.x, y = m.y, vx = v.vx, vy = v.vy;
      for (let i = 0; i < 60; i++) {
        const dt = 0.05;
        vy -= RANGE_GRAVITY * dt; x += vx * dt; y += vy * dt;
        if (y < rangeGroundY(x)) break;
        if (i % 2 === 0) { g.beginPath(); g.arc(this.toScreenX(x), this.toScreenY(y), 2, 0, Math.PI * 2); g.fill(); }
      }
      g.strokeStyle = PAL.amber;
      g.lineWidth = 1.5;
      const ax = this.toScreenX(this.aim.x), ay = this.toScreenY(this.aim.y);
      g.beginPath(); g.arc(ax, ay, 7, 0, Math.PI * 2); g.stroke();
    }

    drawFloaters(g, (x) => this.toScreenX(x), (y) => this.toScreenY(y));

    // Time stopped banner.
    if (this.frozen) {
      g.fillStyle = 'rgba(19,70,107,0.18)';
      g.fillRect(0, 0, w, h);
      g.font = `700 16px ${FONT_UI}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const bw = 150;
      drawAcetate(g, w / 2 - bw / 2, safe.t + 42, bw, 26);
      g.fillStyle = PAL.linen;
      g.fillText('Time stopped', w / 2, safe.t + 55);
    }

    this.drawHud(g, nowMs);
  },

  drawVehicle(g, v, active, S) {
    const gy = rangeGroundY(v.x);
    const slope = Math.atan((rangeGroundY(v.x + 1) - rangeGroundY(v.x - 1)) / 2);
    const sx = this.toScreenX(v.x), sy = this.toScreenY(gy);
    const dir = v.flip ? -1 : 1;
    g.save();
    g.translate(sx, sy);
    g.rotate(-slope);
    g.scale(dir, 1);
    g.fillStyle = active ? PAL.league : '#23507f';
    // Tracks and wheels.
    g.fillRect(-3.4 * S, -1.1 * S, 6.8 * S, 1.1 * S);
    // Hull.
    g.beginPath();
    g.moveTo(-3.6 * S, -1.1 * S);
    g.lineTo(3.9 * S, -1.1 * S);
    g.lineTo(3.2 * S, -2.2 * S);
    g.lineTo(-3.4 * S, -2.2 * S);
    g.closePath();
    g.fill();
    // Turret and barrel.
    g.fillRect(-1.6 * S, -3.2 * S, 3 * S, 1.1 * S);
    g.fillRect(1.2 * S, -2.9 * S, 3 * S, 0.35 * S);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.arc(k * 1.4 * S, -0.5 * S, 0.45 * S, 0, Math.PI * 2); g.fill(); }
    g.restore();
    if (active) {
      g.fillStyle = PAL.amber;
      g.beginPath();
      g.moveTo(sx - 5, sy - 3.9 * S - 10);
      g.lineTo(sx + 5, sy - 3.9 * S - 10);
      g.lineTo(sx, sy - 3.9 * S - 4);
      g.closePath();
      g.fill();
    }
  },

  drawHud(g, nowMs) {
    const { w, safe } = layout;
    const C = this.c;
    drawAcetate(g, 0, 0, w, safe.t + 34);
    const ghost = controlsGhost(nowMs);
    // Squad cards: silhouette plus a health bar.
    for (let i = 0; i < 3; i++) {
      const cd = C.cards[i];
      drawControl(g, cd, nowMs, 1);
      g.fillStyle = i === this.active ? PAL.league : 'rgba(230,220,195,0.6)';
      g.fillRect(cd.x + 10, cd.y + 9, 22, 6);
      g.fillRect(cd.x + 16, cd.y + 6, 9, 3);
      g.fillStyle = PAL.good;
      g.fillRect(cd.x + 8, cd.y + 19, 30, 3);
      g.font = `700 12px ${FONT_UI}`;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillStyle = PAL.linen;
      g.fillText(String(i + 1), cd.x + 36, cd.y + 11);
    }
    // Objective text between the cards and the buttons.
    const left = C.cards[2].x + C.cards[2].w + 12;
    const right = C.time.x - 10;
    g.font = `400 14px ${FONT_UI}`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = PAL.linen;
    const txt = `Controls test · hits ${this.hits} of ${this.shots}`;
    if (right - left > 80) g.fillText(txt, left, safe.t + 17, right - left);

    for (const c of [C.time, C.pause, C.settings, C.recenter]) drawControl(g, c, nowMs, 1);
    for (const c of [C.left, C.right, C.upBtn, C.downBtn, C.special, C.alt, C.swap, C.fire, ...C.chips]) drawControl(g, c, nowMs, ghost);
    drawRing(g, C.fire, 1 - this.reload / RELOAD_TIME, ghost);
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
