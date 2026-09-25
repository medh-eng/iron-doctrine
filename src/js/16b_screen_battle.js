/* ==== 16b SCREEN: BATTLE ==== */
// The battle screen (design/02 §3): world full screen, top bar, drive pad,
// action cluster, order chips, world gestures and keyboard.

const ORDERS = ['Follow', 'Escort', 'Hold', 'Attack', 'Back'];
const BASE_PX_PER_M = 12;       // at 360 px screen height and zoom 1
const DEFAULT_ZOOM = 0.75;
const MIN_AUTO_ZOOM = 0.55;     // how far the follow camera may pull back to frame a target

SCREENS.battle = {
  pausable: true,
  B: null,
  level: 1,
  cam: { x: 0, y: 0, zoom: DEFAULT_ZOOM, follow: true },
  frozen: false,
  aim: null,
  drive: 0,
  controls: [],
  c: {},
  resultShown: false,

  enter(level) {
    this.level = level || 1;
    for (const pool of [shells, particles, debris, smokeScreens, smokeColumns, floaters]) pool.forEachAlive((p) => { p.alive = false; });
    const B = createBattle(this.level);
    this.B = B;
    view.B = B;
    B.panOf = (wx) => clamp((view.sx(wx) / layout.w) * 2 - 1, -1, 1) * 0.8;
    this.cam.x = B.me.body.x + 25;
    this.cam.y = B.me.body.y + 3;
    this.cam.zoom = DEFAULT_ZOOM;
    this.cam.follow = true;
    this.cam.manual = false;
    this.frozen = false;
    game.frozen = false;
    this.aim = null;
    this.drive = 0;
    this.resultShown = false;
    this.buildControls();
    this.layout();
    audio.setIntensity(0);
    audio.playTheme('battle');
    ui.toast(`Level ${this.level} · ${B.cfg.name}: ${B.cfg.goal.toLowerCase()}.`, 3200);
  },

  exit() { game.frozen = false; this.B = null; },

  pauseOpts() {
    return {
      restart: () => this.enter(this.level),
      quit: () => screens.go('title'),
    };
  },

  // ---------- controls
  buildControls() {
    const C = this.c;
    const drive = () => this.updateDrive();
    C.left = makeControl('left', { glyph: 'left', down: drive, up: drive });
    C.right = makeControl('right', { glyph: 'right', down: drive, up: drive });
    C.fire = makeControl('fire', {
      label: 'Fire',
      down: (p) => { p.fireAim = false; },
      move: (p) => this.fireDrag(p),
      up: (p, cancelled) => this.fireUp(p, cancelled),
    });
    C.alt = makeControl('alt', { label: 'Alt', hidden: true });
    C.swap = makeControl('swap', { label: 'Swap', up: (p, x) => { if (!x) this.swap(); } });
    C.special = makeControl('special', { label: 'Smoke', up: (p, x) => { if (!x) this.smoke(); } });
    C.chips = ORDERS.map((o, i) => makeControl('order' + i, { shape: 'rect', label: o, pad: 2, up: (p, x) => { if (!x) this.setOrder(o); } }));
    C.time = makeControl('time', { shape: 'rect', glyph: 'stop', pad: 4, up: (p, x) => { if (!x) this.toggleTime(); } });
    C.pause = makeControl('pause', { shape: 'rect', glyph: 'pause', pad: 4, up: (p, x) => { if (!x) togglePause(); } });
    C.settings = makeControl('settings', { shape: 'rect', glyph: 'gear', pad: 4, up: (p, x) => { if (!x) openSettingsPaused(); } });
    C.recenter = makeControl('recenter', { shape: 'rect', label: 'Recenter', hidden: true, up: (p, x) => { if (!x) this.recenter(); } });
    C.cards = [0, 1, 2].map((i) => makeControl('card' + i, { shape: 'rect', pad: 2, up: (p, x) => { if (!x) this.takeControl(i); } }));
    this.controls = [C.left, C.right, C.special, C.alt, C.swap, C.fire, ...C.chips, C.recenter, ...C.cards, C.time, C.pause, C.settings];
  },

  layout() {
    const C = this.c;
    if (!C.fire) return;
    const { w, h, safe } = layout;
    const s = BTN_SCALE[save.settings.btnSize] || 1;
    const L = save.settings.leftHanded;
    const mx = (x) => (L ? w - x : x);
    const top = safe.t;
    const barH = 34;
    let bx = w - safe.r - 6;
    for (const b of [C.settings, C.pause, C.time]) { bx -= 44; b.x = bx; b.y = top + 3; b.w = 42; b.h = 28; bx -= 4; }
    for (let i = 0; i < 3; i++) { const cd = C.cards[i]; cd.x = safe.l + 6 + i * 50; cd.y = top + 3; cd.w = 46; cd.h = 28; }
    this.mini = { x: C.time.x - 10 - clamp(w * 0.18, 90, 200), y: top + 5, w: clamp(w * 0.18, 90, 200), h: 24 };

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
    const chipTop = top + barH + 8;
    const chipBottom = C.swap.y - C.swap.r - 8;
    const chipH = clamp(Math.floor((chipBottom - chipTop - 16) / 5), 24, 36);
    for (let i = 0; i < 5; i++) {
      const cp = C.chips[i];
      cp.w = chipW; cp.h = chipH;
      cp.x = L ? safe.l + 10 : w - edgeR - chipW;
      cp.y = chipTop + i * (chipH + 4);
    }
    const Rp = 34 * s;
    const padY = h - safe.b - 14 - Rp;
    const lx = safe.l + 18 + Rp;
    C.left.x = mx(lx); C.left.y = padY; C.left.r = Rp;
    C.right.x = mx(lx + Rp * 2 + 18); C.right.y = padY; C.right.r = Rp;
    if (L) { const t = C.left.x; C.left.x = C.right.x; C.right.x = t; }
    C.recenter.w = 92; C.recenter.h = 30;
    C.recenter.x = w / 2 - 46; C.recenter.y = top + barH + 8;
  },

  // ---------- commands
  updateDrive() {
    const k = input.keys;
    const l = this.c.left.pressCount > 0 || k.has('KeyA') || k.has('ArrowLeft');
    const r = this.c.right.pressCount > 0 || k.has('KeyD') || k.has('ArrowRight');
    this.c.left.held = k.has('KeyA') || k.has('ArrowLeft');
    this.c.right.held = k.has('KeyD') || k.has('ArrowRight');
    const before = this.drive;
    this.drive = l && r ? 0 : l ? -1 : r ? 1 : 0;      // both together = halt/brake
    if (this.B && this.drive !== before && this.drive !== 0) audio.sfx('engineRev', this.B.panOf(this.B.me.body.x));
  },

  takeControl(i) {
    const B = this.B;
    const V = B.squad[i];
    if (!V || V === B.me) return;
    if (V.destroyed) { audio.sfx('error'); return; }
    takeVehicle(B, V);
    this.cam.follow = true;
    audio.sfx('swap');
    haptic('tap');
    floatText(V.name, V.body.x, V.body.y + V.height + 1);
  },

  swap() {
    const B = this.B;
    const i = B.squad.indexOf(B.me);
    for (let k = 1; k <= 3; k++) {
      const V = B.squad[(i + k) % B.squad.length];
      if (!V.destroyed && V !== B.me) { this.takeControl(B.squad.indexOf(V)); return; }
    }
    audio.sfx('error');
  },

  setOrder(o) {
    const B = this.B;
    B.order = o;
    for (const V of B.squad) V.ai.hold = null;
    audio.sfx('order');
    haptic('tap');
    floatText(o, B.me.body.x, B.me.body.y + B.me.height + 1);
  },

  recenter() { this.cam.follow = true; audio.sfx('tap'); },

  toggleTime() {
    this.frozen = !this.frozen;
    game.frozen = this.frozen;
    this.c.time.glyph = this.frozen ? 'play' : 'stop';
    this.c.time.glyphLines = null;
    audio.sfx(this.frozen ? 'timeStop' : 'timeStart');
    haptic('tap');
  },

  say(reason) {
    if (!reason) return;
    audio.sfx('error');
    const V = this.B.me;
    floatText(reason, V.body.x, V.body.y + V.height + 1.5);
  },

  fireDrag(p) {
    const C = this.c.fire;
    if (this.frozen) return;
    const off = dist(p.x, p.y, C.x, C.y);
    if (!p.fireAim && off > C.r * 0.6) p.fireAim = true;
    if (!p.fireAim) return;
    if (off < C.r * 0.8) { this.aim = null; return; }    // back on the button cancels
    const wx = view.wx(p.x);
    this.aim = this.aim || { x: 0, y: 0 };
    this.aim.x = wx;
    this.aim.y = Math.max(view.wy(p.y), this.B.T.height(wx));
  },

  fireUp(p, cancelled) {
    const aim = this.aim;
    this.aim = null;
    if (cancelled || this.frozen || this.B.me.destroyed) return;
    if (p.fireAim) {
      if (aim) this.say(playerFire(this.B, aim.x, aim.y, true));
      else audio.sfx('back');
      return;
    }
    this.fireAuto();
  },

  fireAuto() {
    const B = this.B;
    if (this.frozen || B.me.destroyed) return;
    const T = autoTarget(B);
    if (T) { this.say(playerFire(B, T.body.x, T.body.y + T.height * 0.15, false)); return; }
    const x = B.me.body.x + B.me.dir * 60;
    this.say(playerFire(B, x, B.T.height(x) + 1.5, false));
  },

  smoke() {
    if (this.frozen || this.B.me.destroyed) return;
    const r = playerSmoke(this.B);
    if (r) this.say(r); else { audio.sfx('smoke', this.B.panOf(this.B.me.body.x)); haptic('tap'); }
  },

  // ---------- camera
  // While following, the camera may pull back to frame the target, unless you pinched a zoom yourself.
  scale() { return BASE_PX_PER_M * (layout.h / 360) * (this.cam.follow && !this.cam.manual ? Math.min(this.cam.zoom, this.cam.fit || 9) : this.cam.zoom); },

  world: {
    tap(x, y) {
      const S = SCREENS.battle;
      const B = S.B;
      const wx = view.wx(x), wy = view.wy(y);
      const hit = (V) => Math.abs(wx - V.body.x) < V.len / 2 + 1.5 && wy > V.body.y - 2.5 && wy < V.body.y + V.height + 1.5;
      for (let i = 0; i < B.squad.length; i++) if (!B.squad[i].destroyed && hit(B.squad[i])) { S.takeControl(i); return; }
      for (const V of B.units) {
        if (V.side !== 1 || V.destroyed || !V.seen || !hit(V)) continue;
        B.target = B.target === V ? null : V;
        audio.sfx(B.target ? 'toggleOn' : 'toggleOff');
        haptic('tap');
        if (B.target) floatText('Target', V.body.x, V.body.y + V.height + 1.5, true);
        return;
      }
    },
    doubleTap() { const c = SCREENS.battle.cam; c.zoom = DEFAULT_ZOOM; c.manual = false; audio.sfx('tap'); },
    longPress(x) {
      const S = SCREENS.battle;
      const B = S.B;
      const wx = clamp(view.wx(x), 5, B.T.length - 5);
      let k = 0;
      for (const V of B.squad) if (V !== B.me && !V.destroyed) { V.ai.hold = wx + (k++ ? -7 : 0); }
      audio.sfx('order');
      haptic('tap');
      floatText('Move here', wx, B.T.height(wx) + 3);
    },
    pan(dx, dy) {
      const S = SCREENS.battle;
      S.cam.follow = false;
      S.cam.x -= dx / S.scale();
      S.cam.y += dy / S.scale();
    },
    pinch(f, cx, cy) {
      const S = SCREENS.battle;
      const bx = view.wx(cx);
      const seen = S.scale() / (BASE_PX_PER_M * (layout.h / 360));
      S.cam.follow = false;
      S.cam.manual = true;
      S.cam.zoom = clamp(seen * f, ZOOM_MIN * 0.7, ZOOM_MAX);
      view.S = S.scale();
      S.cam.x += bx - view.wx(cx);
    },
  },

  key(code, down) {
    if (/^(KeyA|KeyD|ArrowLeft|ArrowRight)$/.test(code)) { this.updateDrive(); return; }
    const hold = (c) => { c.held = down; if (!down) c.releasedAt = performance.now(); };
    if (code === 'Space') { hold(this.c.fire); if (down) this.fireAuto(); return; }
    if (code === 'KeyE' || code === 'Tab') { hold(this.c.swap); if (down) this.swap(); return; }
    if (code === 'KeyQ') { hold(this.c.special); if (down) this.smoke(); return; }
    const n = /^Digit([1-5])$/.exec(code);
    if (n) { const c = this.c.chips[+n[1] - 1]; hold(c); if (down) this.setOrder(ORDERS[+n[1] - 1]); return; }
    if (!down) return;
    if (code === 'KeyT') this.toggleTime();
    else if (code === 'KeyC') this.recenter();
  },

  // ---------- update
  update(dt, simRunning) {
    const B = this.B;
    if (!B) return;
    B.me.throttle = B.me.destroyed ? 0 : this.drive;
    if (simRunning && !this.frozen) {
      // Level clear: time slows to 30% for 0.6 s (design/03 §5).
      const slow = B.result === 'win' && B.resultT < 0.6 ? 0.3 : 1;
      updateBattle(B, dt * slow);
      if (this.aim) trainPlayerGun(B, dt, this.aim.x, this.aim.y); else trainPlayerGun(B, dt);
      updateFloaters(dt);
    }
    this.updateCamera(dt);
    const C = this.c;
    for (let i = 0; i < 5; i++) C.chips[i].lit = ORDERS[i] === B.order;
    for (let i = 0; i < 3; i++) { C.cards[i].lit = B.squad[i] === B.me; C.cards[i].disabled = !B.squad[i] || B.squad[i].destroyed; }
    C.recenter.hidden = this.cam.follow;
    C.fire.disabled = this.frozen || B.me.destroyed;
    C.special.disabled = this.frozen || !B.me.smoke;
    C.special.hidden = B.me.smoke === 0 && !B.squad.some((V) => V.smoke);
    if (B.result && B.resultT > 1.4 && !this.resultShown) this.showResult();
  },

  updateCamera(dt) {
    const cam = this.cam;
    const B = this.B;
    const idle = (performance.now() - input.lastWorldTouch) / 1000;
    if (!cam.follow && save.settings.autoRecenter && idle > RECENTER_AFTER && input.world.length === 0) cam.follow = true;
    // While following, pull back so your target (or the nearest spotted enemy) stays in view.
    const me = B.me.body;
    const T = autoTarget(B);
    const base = BASE_PX_PER_M * (layout.h / 360);
    let fit = 9;
    let midX = me.x;
    if (T && !B.me.destroyed) {
      const span = Math.abs(T.body.x - me.x) + 26;
      fit = Math.max(MIN_AUTO_ZOOM, (layout.w * 0.8) / span / base);
      midX = (me.x + T.body.x) / 2;
    }
    cam.fit = cam.fit === undefined ? fit : cam.fit + (fit - cam.fit) * (1 - Math.pow(0.2, dt));
    view.S = this.scale();
    const viewW = layout.w / view.S;
    if (cam.follow) {
      const k = 1 - Math.pow(0.03, dt);
      const wantX = T && !cam.manual && fit < cam.zoom ? midX : me.x + B.me.dir * viewW * 0.18;
      cam.x += (wantX - cam.x) * k;
      cam.y += (me.y + 2 - cam.y) * k;
    }
    cam.x = clamp(cam.x, viewW * 0.3, B.T.length - viewW * 0.3);
    view.cx = cam.x;
    view.cy = cam.y;
    view.horizon = layout.h * 0.62;
    shakeOffset(B, view.shake);
  },

  showResult() {
    this.resultShown = true;
    const B = this.B;
    const win = B.result === 'win';
    const p = save.profile;
    if (win) {
      haptic('clear');
      audio.sfx('objective');
      p.highestLevel = Math.max(p.highestLevel, this.level + 1);
      p.continueLevel = this.level + 1;
      save.touch('profile');
    }
    const c = ui.card('', 'card-result');
    c.appendChild(el('div', 'stamp' + (win ? '' : ' stamp-red'), win ? 'OBJECTIVE COMPLETE' : 'SQUAD LOST'));
    const facts = el('div', 'result-facts');
    const secs = Math.round(B.time);
    const row = (k, v) => { const r = el('div', 'fact'); r.appendChild(el('span', '', k)); r.appendChild(el('b', '', String(v))); facts.appendChild(r); };
    row('Time', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
    row('Enemies destroyed', `${B.goalDone} of ${B.goalTotal}`);
    row('Shots fired', B.stats.shots);
    row('Penetrations', B.stats.pens);
    row('Squad vehicles lost', B.stats.lost);
    c.appendChild(facts);
    const btns = el('div', 'card-row');
    let close = null;
    btns.appendChild(button('Title', () => { close(); screens.go('title'); }, 'btn', 'back'));
    if (win) btns.appendChild(button('Next battle', () => { close(); this.enter(this.level + 1); }, 'btn btn-primary'));
    else btns.appendChild(button('Retry', () => { close(); this.enter(this.level); }, 'btn btn-primary'));
    c.appendChild(btns);
    close = ui.open(c);
  },

  // ---------- drawing
  render(g, nowMs) {
    const B = this.B;
    if (!B) return;
    renderBattle(g, B);
    const S = view.S;
    // Selected target bracket.
    if (B.target && !B.target.destroyed && B.target.seen) {
      const T = B.target;
      const x = view.sx(T.body.x), y = view.sy(T.body.y + T.height * 0.4);
      const r = Math.max(14, (T.len / 2 + 0.8) * S);
      g.strokeStyle = PAL.amber; g.lineWidth = 2;
      g.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        g.moveTo(x + sx * r, y + sy * r * 0.7 - sy * 6); g.lineTo(x + sx * r, y + sy * r * 0.7); g.lineTo(x + sx * r - sx * 6, y + sy * r * 0.7);
      }
      g.stroke();
    }
    // Your vehicle: small amber marker.
    if (!B.me.destroyed) {
      const x = view.sx(B.me.body.x), y = view.sy(B.me.body.y + B.me.height) - 8;
      g.fillStyle = PAL.amber;
      g.beginPath(); g.moveTo(x - 5, y - 6); g.lineTo(x + 5, y - 6); g.lineTo(x, y); g.closePath(); g.fill();
    }
    // Spotted enemies beyond the screen edge.
    for (const V of B.units) {
      if (V.side !== 1 || V.destroyed || !V.seen) continue;
      const x = view.sx(V.body.x);
      if (x > 0 && x < layout.w) continue;
      const ex = x <= 0 ? layout.safe.l + 8 : layout.w - layout.safe.r - 8;
      const ey = clamp(view.sy(V.body.y + 1), layout.safe.t + 60, layout.h * 0.55);
      g.fillStyle = PAL.directorate;
      g.beginPath();
      if (x <= 0) { g.moveTo(ex, ey); g.lineTo(ex + 9, ey - 6); g.lineTo(ex + 9, ey + 6); }
      else { g.moveTo(ex, ey); g.lineTo(ex - 9, ey - 6); g.lineTo(ex - 9, ey + 6); }
      g.closePath(); g.fill();
    }
    // Manual-aim trajectory preview.
    if (this.aim && save.settings.aimAssist && !B.me.destroyed) this.drawAimPreview(g);
    drawFloaters(g, (x) => view.sx(x), (y) => view.sy(y));
    if (this.frozen) {
      const { w, h, safe } = layout;
      g.fillStyle = 'rgba(19,70,107,0.18)';
      g.fillRect(0, 0, w, h);
      g.font = `700 16px ${FONT_UI}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      drawAcetate(g, w / 2 - 75, safe.t + 42, 150, 26);
      g.fillStyle = PAL.linen;
      g.fillText('Time stopped', w / 2, safe.t + 55);
    }
    this.drawHud(g, nowMs);
  },

  drawAimPreview(g) {
    const B = this.B;
    const V = B.me;
    const w = mainWeapon(V);
    if (!w) return;
    aimWeapon(V, w, this.aim.x, this.aim.y, _aim);
    const tmp = { x: 0, y: 0 };
    weaponPivot(V, w, tmp);
    const L = barrelLength(w.def);
    let x = tmp.x + Math.cos(_aim.angle) * L, y = tmp.y + Math.sin(_aim.angle) * L;
    let vx = Math.cos(_aim.angle) * w.def.vel, vy = Math.sin(_aim.angle) * w.def.vel;
    g.fillStyle = _aim.ok ? 'rgba(255,178,62,0.9)' : 'rgba(224,83,61,0.9)';
    const dt = 0.03;
    for (let i = 0; i < 160; i++) {
      vy -= GRAVITY * dt; x += vx * dt; y += vy * dt;
      if (y < B.T.height(x)) break;
      if (i % 3 === 0) { g.beginPath(); g.arc(view.sx(x), view.sy(y), 2, 0, Math.PI * 2); g.fill(); }
    }
    g.strokeStyle = PAL.amber; g.lineWidth = 1.5;
    g.beginPath(); g.arc(view.sx(this.aim.x), view.sy(this.aim.y), 7, 0, Math.PI * 2); g.stroke();
  },

  drawHud(g, nowMs) {
    const { w, safe } = layout;
    const B = this.B;
    const C = this.c;
    drawAcetate(g, 0, 0, w, safe.t + 34);
    const ghost = controlsGhost(nowMs);
    // Squad cards: silhouette with health, fuel and ammo bars.
    for (let i = 0; i < 3; i++) {
      const cd = C.cards[i];
      const V = B.squad[i];
      if (!V) { cd.hidden = true; continue; }
      drawControl(g, cd, nowMs, 1);
      g.fillStyle = V.destroyed ? '#5b5e66' : V === B.me ? PAL.league : 'rgba(230,220,195,0.7)';
      g.fillRect(cd.x + 7, cd.y + 7, 20, 5);
      g.fillRect(cd.x + 12, cd.y + 4, 8, 3);
      let hp = 0;
      for (const p of V.parts) if (p.alive) hp += p.hp;
      const bars = [[hp / V.hpMax, PAL.good], [V.fuelMax ? V.fuel / V.fuelMax : 0, PAL.warning], [V.shellsMax ? V.shells / V.shellsMax : 0, PAL.linen]];
      bars.forEach(([f, col], k) => {
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(cd.x + 6, cd.y + 15 + k * 4, 34, 2.5);
        g.fillStyle = V.destroyed ? '#5b5e66' : col; g.fillRect(cd.x + 6, cd.y + 15 + k * 4, 34 * clamp(f, 0, 1), 2.5);
      });
      g.font = `700 12px ${FONT_UI}`;
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillStyle = PAL.linen;
      g.fillText(String(i + 1), cd.x + 33, cd.y + 9);
    }
    // Objective with a progress bar.
    const left = C.cards[2].x + C.cards[2].w + 10;
    const right = this.mini.x - 10;
    if (right - left > 70) {
      g.font = `400 14px ${FONT_UI}`;
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillStyle = PAL.linen;
      g.fillText(`${B.cfg.goal} ${B.goalDone}/${B.goalTotal}`, left, safe.t + 13, right - left);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(left, safe.t + 24, right - left, 3);
      g.fillStyle = PAL.amber; g.fillRect(left, safe.t + 24, (right - left) * (B.goalDone / Math.max(1, B.goalTotal)), 3);
    }
    this.drawMinimap(g);
    for (const c of [C.time, C.pause, C.settings, C.recenter]) drawControl(g, c, nowMs, 1);
    for (const c of [C.left, C.right, C.special, C.alt, C.swap, C.fire, ...C.chips]) drawControl(g, c, nowMs, ghost);
    const mw = mainWeapon(B.me);
    if (mw && !B.me.destroyed) drawRing(g, C.fire, 1 - Math.max(0, mw.reload) / (mw.def.reload * (B.me.crew < 3 ? 1.6 : 1)), ghost);
  },

  // Minimap strip: terrain line, spotted units, camera window.
  drawMinimap(g) {
    const B = this.B;
    const m = this.mini;
    const T = B.T;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(m.x, m.y, m.w, m.h);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < T.n; i += 8) { lo = Math.min(lo, T.h[i]); hi = Math.max(hi, T.h[i]); }
    const span = Math.max(4, hi - lo);
    const X = (x) => m.x + (x / T.length) * m.w;
    const Y = (y) => m.y + m.h - 4 - ((y - lo) / span) * (m.h - 10);
    g.strokeStyle = 'rgba(230,220,195,0.55)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < T.n; i += 8) { const x = i * CELL; if (i === 0) g.moveTo(X(x), Y(T.h[i])); else g.lineTo(X(x), Y(T.h[i])); }
    g.stroke();
    for (const V of B.units) {
      if (V.side === 1 && !V.seen && !(V.destroyed && V.everSeen)) continue;
      g.fillStyle = V.destroyed ? '#6b6e76' : V.side === 0 ? (V === B.me ? PAL.amber : '#7fb0ea') : PAL.directorate;
      g.fillRect(X(V.body.x) - 1.5, Y(V.body.y) - 4, 3, 3);
    }
    const vw = layout.w / view.S;
    g.strokeStyle = 'rgba(230,220,195,0.8)';
    g.strokeRect(X(view.cx - vw / 2), m.y + 1, (vw / T.length) * m.w, m.h - 2);
  },
};
