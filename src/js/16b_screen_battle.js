/* ==== 16b SCREEN: BATTLE ==== */
// The battle screen (design/02 §3): world full screen, top bar, drive pad,
// action cluster, order chips, world gestures and keyboard.

const ORDERS = ['Follow', 'Escort', 'Hold', 'Attack', 'Back'];
const ALT_LABEL = { torpedo: 'Torp', depth: 'Charge', bomb: 'Bomb', atgm: 'Missile', rockets: 'Rocket', launcher: 'Missile' };
const TEST_RANGE_HOW = { land: 'Mud, hills and a trench.', sea: 'Open water off a beach.', air: 'Open air over hills.', heli: 'Open air over hills.' };
const FLIGHT_HOW = { air: '▶ ◀ throttle, ▲ ▼ pitch; hold ▲ to loop round.', heli: '◀ ▶ move, ▲ ▼ height.', sub: '▲ ▼ depth.' };
// The test range that suits a design's domain.
const rangeFor = (domain) => (seaDomain(domain) ? 'sea' : domain === 'air' ? 'air' : domain === 'heli' ? 'heli' : 'land');
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
  climb: 0,
  controls: [],
  c: {},
  resultShown: false,

  // arg: a level number, or { level } for the ladder, or { test: design } for a test drive.
  enter(arg) {
    const opts = typeof arg === 'object' && arg ? arg : { level: arg || 1 };
    this.opts = opts;
    this.level = opts.level || 1;
    for (const pool of [shells, torpedoes, charges, missiles, salvos, particles, debris, smokeScreens, smokeColumns, floaters, confetti, beams]) pool.forEachAlive((p) => { p.alive = false; });
    const B = opts.test
      ? createBattle(1, { squad: [opts.test], test: true, cfg: testDriveConfig(opts.range || rangeFor(domainOf(opts.test))) })
      : opts.campaign
        ? createCampaignBattle(opts.campaign, false)
        : opts.sim
        ? createBattle(0, { squad: opts.sim.squad(), cfg: simulatorConfig(opts.sim), reserves: true, enemyForce: opts.sim.enemy() })
        : createBattle(this.level, { squad: ladder.squadDesigns() });
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
    this.climb = 0;
    this.resultShown = false;
    this.pick = null;
    this.closeWheel();
    this.buildControls();
    this.layout();
    audio.setIntensity(0);
    audio.playTheme('battle');
    this.showHowTo();
    if (B.loaned) ui.toast(`Sea battle: a fleet is lent to you (${B.squad.map((V) => V.name).join(', ')}).`, 4000);
    else if (B.ashore.length) ui.toast(`Sea battle: ${B.ashore.map((d) => d.name).join(', ')} stay${B.ashore.length > 1 ? '' : 's'} ashore.`, 3500);
    if (B.inPort.length) ui.toast(`No sea on this map: ${B.inPort.map((d) => d.name).join(', ')} stay${B.inPort.length > 1 ? '' : 's'} in port.`, 3500);
  },

  // Two-line how-to at the start of each level (design/06 acceptance: level 1 with only this).
  showHowTo() {
    const B = this.B;
    if (this.howEl) this.howEl.remove();
    const box = el('div', 'howto');
    box.appendChild(el('div', 'howto-1', B.test ? `Test drive · ${B.squad[0].name}` : this.opts.campaign ? `Battle · ${B.cfg.name}` : this.opts.sim ? `Battle Simulator · ${B.cfg.name}` : `Level ${this.level} · ${B.cfg.name} · ${B.cfg.goal.text}`));
    const how = B.test ? `${TEST_RANGE_HOW[B.cfg.range] || TEST_RANGE_HOW.land} ${FLIGHT_HOW[B.me.domain] || ''} Pause to go back to the Workshop.`.replace('  ', ' ') : B.cfg.how;
    if (how) box.appendChild(el('div', 'howto-2', how));
    uiLayer.insertBefore(box, ui.toastBox);
    uiLayer.classList.add('has-howto');
    this.howEl = box;
    setTimeout(() => box.classList.add('out'), 6500);
    setTimeout(() => { if (box.isConnected) box.remove(); uiLayer.classList.remove('has-howto'); }, 7000);
  },

  exit() {
    game.frozen = false;
    this.closeWheel();
    this.B = null;
    if (this.howEl) { this.howEl.remove(); this.howEl = null; }
    uiLayer.classList.remove('has-howto');
  },

  pauseOpts() {
    if (this.opts.campaign) return { restartLabel: 'Keep fighting', restart: () => {}, quitLabel: 'Retreat to the map (counts as a loss)', quit: () => { this.B.result = 'lost'; const res = applyBattleOutcome(this.B); ui.toast(res.summary, 5000); screens.go('map'); } };
    if (this.opts.sim) return { restartLabel: 'Restart battle', restart: () => this.enter(this.opts), quitLabel: 'Back to the Simulator', quit: () => screens.go('simulator') };
    if (this.opts.test) return { restartLabel: 'Restart test drive', restart: () => this.enter(this.opts), quitLabel: 'Back to the Workshop', quit: () => screens.go('designer', this.opts.back) };
    return {
      restart: () => this.enter(this.opts),
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
    C.alt = makeControl('alt', { label: 'Alt', hidden: true, up: (p, x) => { if (!x) this.altFire(); } });
    C.up = makeControl('up', { glyph: 'up', hidden: true, down: drive, up: drive });
    C.down = makeControl('down', { glyph: 'down', hidden: true, down: drive, up: drive });
    C.swap = makeControl('swap', { label: 'Swap', up: (p, x) => { if (!x) this.swap(); } });
    C.special = makeControl('special', { label: 'Smoke', up: (p, x) => { if (!x) this.smoke(); } });
    C.chips = ORDERS.map((o, i) => makeControl('order' + i, { shape: 'rect', label: o, pad: 2, up: (p, x) => { if (!x) this.setOrder(o); } }));
    C.time = makeControl('time', { shape: 'rect', glyph: 'stop', pad: 4, up: (p, x) => { if (!x) this.toggleTime(); } });
    C.pause = makeControl('pause', { shape: 'rect', glyph: 'pause', pad: 4, up: (p, x) => { if (!x) togglePause(); } });
    C.settings = makeControl('settings', { shape: 'rect', glyph: 'gear', pad: 4, up: (p, x) => { if (!x) openSettingsPaused(); } });
    C.recenter = makeControl('recenter', { shape: 'rect', label: 'Recenter', hidden: true, up: (p, x) => { if (!x) this.recenter(); } });
    // Ship cards: tap to drive; long-press for the command wheel (design/02 §3.1, §3.4).
    C.cards = [0, 1, 2].map((i) => {
      const cd = makeControl('card' + i, {
        shape: 'rect', pad: 2,
        down: () => { cd.downAt = performance.now(); cd.longDone = false; },
        up: (p, x) => { if (!x && !cd.longDone) this.takeControl(i); cd.downAt = 0; },
      });
      return cd;
    });
    C.reserve = makeControl('reserve', { shape: 'rect', label: 'Reserve', pad: 2, hidden: true, up: (p, x) => { if (!x) this.openReserve(); } });
    this.controls = [C.left, C.right, C.up, C.down, C.special, C.alt, C.swap, C.fire, ...C.chips, C.recenter, ...C.cards, C.reserve, C.time, C.pause, C.settings];
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
    C.reserve.x = C.cards[2].x + 52; C.reserve.y = top + 3; C.reserve.w = 78; C.reserve.h = 28;
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
    // ▲ ▼ (climb and dive) sit above the middle of the pad, shown only for vehicles that use them.
    const midX = (C.left.x + C.right.x) / 2;
    C.down.r = C.up.r = r2;
    C.down.x = C.up.x = midX;
    C.down.y = padY - Rp - r2 - 6;
    C.up.y = C.down.y - r2 * 2 - 6;
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
    const up = this.c.up.pressCount > 0 || k.has('KeyW') || k.has('ArrowUp');
    const down = this.c.down.pressCount > 0 || k.has('KeyS') || k.has('ArrowDown');
    this.c.up.held = k.has('KeyW') || k.has('ArrowUp');
    this.c.down.held = k.has('KeyS') || k.has('ArrowDown');
    this.climb = up && down ? 0 : up ? 1 : down ? -1 : 0;
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

  // ---------- command wheel (design/02 §3.4): orders for one of your ships
  openWheel(V, sub) {
    const B = this.B;
    if (!B || !V || V.destroyed || V.side !== 0 || B.demo) return;
    this.closeWheel();
    const r = el('div', 'cmd-wheel');
    // Two columns of three orders, with a close button above, kept clear of the screen edges.
    r.style.left = `${clamp(view.sx(V.body.x), layout.safe.l + 116, layout.w - layout.safe.r - 116)}px`;
    r.style.top = `${clamp(view.sy(V.body.y + V.height / 2), layout.safe.t + 124, layout.h - layout.safe.b - 80)}px`;
    const drone = (order, label) => [label, () => { const why = droneOrder(B, V, order); if (why) this.say(why); else this.orderDone(V, `${V.wingCap ? 'Air' : 'Drones'}: ${order}`); }];
    const items = sub === 'drones' ? [
      drone('attack', 'Attack'), drone('defend', 'Defend'), drone('scout', 'Scout'), drone('recall', 'Recall'),
      ['Back', () => this.openWheel(V)],
    ] : [
      ['Drive', () => this.takeControl(B.squad.indexOf(V))],
      ['Move to', () => this.startPick(V, 'move')],
      ['Fire at', () => this.startPick(V, 'fire')],
      ['Hold', () => { V.ai.hold = V.body.x; V.ai.fireAt = null; this.orderDone(V, 'Hold'); }],
      ['Pull back', () => { const why = pullBack(B, V); if (why) this.say(why); else this.orderDone(V, 'Pulling back'); }, !B.rotation],
      ['Smoke', () => { const why = playerSmoke(B, V); if (why) this.say(why); else this.orderDone(V, 'Smoke'); }],
    ];
    // A carrier (Part 5c): drone orders, with how many are aboard and flying.
    if (!sub && (V.hangarCap || V.wingCap)) {
      const aboard = (V.dronesAboard || 0) + (V.wingAboard || 0), up = dronesFlying(B, V) + wingsFlying(B, V);
      items.push([`${V.wingCap ? 'Air' : 'Drones'} ${aboard}+${up}`, () => this.openWheel(V, 'drones')]);
    }
    const rows = Math.ceil(items.length / 2);
    items.forEach(([label, fn, off], i) => {
      const b = button(label, () => { this.closeWheel(); fn(); }, 'btn btn-small cmd-item');
      b.disabled = !!off;
      const col = i < rows ? 0 : 1, row = i < rows ? i : i - rows;
      b.style.left = `${col ? 56 : -56}px`;
      b.style.top = `${(row - (rows - 1) / 2) * 50}px`;
      r.appendChild(b);
    });
    const x = button('✕', () => this.closeWheel(), 'btn btn-small cmd-close', 'back');
    x.setAttribute('aria-label', `Close orders for ${V.name}`);
    const nm = el('div', 'cmd-name', sub === 'drones' ? `${V.name} · ${V.wingCap ? 'air' : 'drones'}` : V.name);
    if (rows > 3) x.style.top = nm.style.top = `${-98 - (rows - 3) * 25}px`;   // a fourth row: lift the header
    r.appendChild(x);
    r.appendChild(nm);
    uiLayer.appendChild(r);
    this.wheel = r;
    input.releaseAll();
    audio.sfx('toggleOn');
    haptic('tap');
  },

  closeWheel() { if (this.wheel) { this.wheel.remove(); this.wheel = null; } },

  // Move to / Fire at: the next tap on the world picks the point or the target.
  startPick(V, kind) {
    this.pick = { V, kind };
    ui.toast(kind === 'move' ? `${V.name}: tap where to go.` : `${V.name}: tap an enemy to fire at.`, 2200);
  },

  finishPick(wx, wy, hit) {
    const B = this.B;
    const { V, kind } = this.pick;
    this.pick = null;
    if (V.destroyed) return;
    if (kind === 'move') {
      const x = clamp(wx, 5, B.T.length - 5);
      V.ai.hold = x;
      V.pulling = false;
      this.orderDone(V, 'Moving', x, B.T.height(x) + 3);
      return;
    }
    const U = B.units.find((E) => E.side === 1 && !E.destroyed && E.seen && hit(E));
    if (!U) { this.say('No enemy there'); return; }
    V.ai.fireAt = U;
    this.orderDone(V, 'Fire at', U.body.x, U.body.y + U.height + 1.5);
  },

  orderDone(V, label, x, y) {
    audio.sfx('order');
    haptic('tap');
    floatText(label, x !== undefined ? x : V.body.x, y !== undefined ? y : V.body.y + V.height + 1);
  },

  // ---------- reserve drawer (design/02 §3.1): the line-up, reorder, "Send in"
  openReserve() {
    const B = this.B;
    if (!B || !B.rotation) return;
    const c = ui.card('Reserve line-up', 'card-reserve');
    const list = el('div', 'rsv-list');
    c.appendChild(list);
    const btns = el('div', 'card-row');
    let close = null;
    const build = (sending) => {
      list.textContent = '';
      const R = B.reserve[0];
      if (!R.length) list.appendChild(el('p', 'card-text', 'No ships in reserve.'));
      R.forEach((e, i) => {
        const row = el('div', 'rsv-row');
        row.appendChild(el('span', 'rsv-num', String(i + 1)));
        const t = el('span', 'rsv-name');
        t.appendChild(el('b', '', e.name));
        t.appendChild(el('small', '', `hull ${Math.round(e.health * 100)}%`));
        row.appendChild(t);
        if (i > 0) row.appendChild(button('▲', () => { R.splice(i - 1, 0, R.splice(i, 1)[0]); build(); }, 'btn btn-small'));
        row.appendChild(button('Send in', () => { R.unshift(R.splice(i, 1)[0]); build(true); }, 'btn btn-small'));
        list.appendChild(row);
      });
      if (sending) {
        list.appendChild(el('p', 'card-text', `${R[0].name} goes in next. Which ship pulls back for it?`));
        const row = el('div', 'card-row');
        for (const V of B.squad) {
          if (!V.destroyed && !V.pulling) row.appendChild(button(`Pull back ${V.name}`, () => { pullBack(B, V); this.orderDone(V, 'Pulling back'); close(); }, 'btn btn-small'));
        }
        list.appendChild(row);
      }
    };
    build();
    btns.appendChild(button('Close', () => close(), 'btn btn-primary', 'back'));
    c.appendChild(btns);
    close = ui.open(c);
  },

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
    if (T) { const a = aimPoint(B, T, { x: 0, y: 0 }); this.say(playerFire(B, a.x, a.y, false)); return; }
    const x = B.me.body.x + B.me.dir * 60;
    this.say(playerFire(B, x, B.T.height(x) + 1.5, false));
  },

  altFire() {
    if (this.frozen || this.B.me.destroyed) return;
    const r = playerSecondary(this.B);
    if (r) this.say(r);
  },

  smoke() {
    if (this.frozen || this.B.me.destroyed) return;
    const r = playerSmoke(this.B);
    if (r) this.say(r); else { audio.sfx('smoke', this.B.panOf(this.B.me.body.x)); haptic('tap'); }
  },

  ownShipAt(x, y) {
    const B = this.B;
    const wx = view.wx(x), wy = view.wy(y);
    return B.squad.find((V) => !V.destroyed && Math.abs(wx - V.body.x) < V.len / 2 + 1.5 && wy > V.body.y - 2.5 && wy < V.body.y + V.height + 1.5) || null;
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
      if (S.wheel) { S.closeWheel(); return; }
      if (S.pick) { S.finishPick(wx, wy, hit); return; }
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
    // Desktop: right-click one of your ships for its command wheel.
    contextMenu(x, y) { const S = SCREENS.battle; const own = S.ownShipAt(x, y); if (own) S.openWheel(own); },
    doubleTap() { const c = SCREENS.battle.cam; c.zoom = DEFAULT_ZOOM; c.manual = false; audio.sfx('tap'); },
    longPress(x, y) {
      const S = SCREENS.battle;
      const B = S.B;
      const own = S.ownShipAt(x, y);
      if (own) { S.openWheel(own); return; }
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
    if (/^(KeyA|KeyD|KeyW|KeyS|ArrowLeft|ArrowRight|ArrowUp|ArrowDown)$/.test(code)) { this.updateDrive(); return; }
    if (code === 'KeyF') { this.c.alt.held = down; if (down) this.altFire(); return; }
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
    const me0 = B.me;
    if (me0.flier) {
      // Aircraft: ◀ ▶ throttle, ▲ ▼ pitch (let go: level flight). Helicopters: ◀ ▶ move, ▲ ▼ height.
      if (!me0.destroyed && simRunning && !this.frozen) {
        if (me0.domain === 'air') {
          me0.throttle = clamp(me0.throttle + this.drive * dt * 0.6, 0, 1);
          me0.pitchOrder = this.climb || null;
          if (!this.climb) me0.gammaCmd = 0;
        } else {
          me0.moveCmd = this.drive;
          const floor = B.T.height(me0.body.x) + 0.5;
          const from = me0.altCmd === undefined || me0.altCmd === null ? me0.body.y : me0.altCmd;
          if (this.climb) me0.altCmd = Math.max(floor, from + this.climb * CLIMB_RATE * dt);
        }
      }
    } else B.me.throttle = B.me.destroyed ? 0 : this.drive;
    // Submarines: ▲ ▼ move the depth order; above the surfaced level it means "surface".
    const me = B.me;
    if (me.ballast && !me.destroyed && simRunning && !this.frozen && this.climb) {
      const surfaced = B.T.sea - (me.stats.waterline - me.com.y);
      const floor = B.T.height(me.body.x) + me.com.y + 1;
      const from = me.depthCmd === null || me.depthCmd === undefined ? Math.min(me.body.y, surfaced) : me.depthCmd;
      const next = Math.max(floor, from + this.climb * DIVE_RATE * dt);
      me.depthCmd = next >= surfaced ? null : next;
    }
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
    for (let i = 0; i < 3; i++) {
      const cd = C.cards[i];
      cd.lit = B.squad[i] === B.me; cd.disabled = !B.squad[i] || B.squad[i].destroyed;
      if (cd.pressCount > 0 && cd.downAt && !cd.longDone && performance.now() - cd.downAt >= LONG_PRESS_MS) { cd.longDone = true; this.openWheel(B.squad[i]); }
    }
    C.reserve.hidden = !B.rotation;
    if (B.rotation) C.reserve.label = `Reserve ${B.reserve[0].length}`;
    C.recenter.hidden = this.cam.follow;
    C.fire.disabled = this.frozen || B.me.destroyed;
    C.special.disabled = this.frozen || !B.me.smoke;
    C.special.hidden = B.me.smoke === 0 && !B.squad.some((V) => V.smoke);
    // Alt: the secondary weapon and what is left (SAMs fire by themselves).
    const sec = B.me.weapons.filter((w) => w.def.secondary && w.def.secondary !== 'sam' && B.me.parts[w.part].alive);
    C.alt.hidden = !sec.length;
    if (sec.length) {
      const n = sec.reduce((a, w) => a + w.rounds, 0);
      const label = `${ALT_LABEL[sec[0].def.secondary] || 'Alt'} ${n}`;
      if (C.alt.label !== label) { C.alt.label = label; C.alt.glyphLines = null; }
      C.alt.disabled = this.frozen || n === 0;
    }
    C.up.hidden = C.down.hidden = !B.me.ballast && !B.me.flier;
    if (B.result && B.resultT > 1.4 && !this.resultShown) this.showResult();
    stepConfetti(dt);
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
    // In the air, pull back far enough to keep the ground under you in view.
    let midY = me.y + 2;
    if (B.me.flier && !B.me.destroyed) {
      const ground = Math.max(B.T.height(me.x), seaAt(B.T, me.x) ? B.T.sea : -Infinity);
      const alt = me.y - ground;
      fit = Math.min(fit, Math.max(0.5, (layout.h * 0.7) / (alt + 14) / base));
      midY = (me.y + ground) / 2 + 2;
    }
    cam.fit = cam.fit === undefined ? fit : cam.fit + (fit - cam.fit) * (1 - Math.pow(0.2, dt));
    view.S = this.scale();
    const viewW = layout.w / view.S;
    if (cam.follow) {
      const k = 1 - Math.pow(0.03, dt);
      const wantX = T && !cam.manual && fit < cam.zoom ? midX : me.x + B.me.dir * viewW * 0.18;
      cam.x += (wantX - cam.x) * k;
      cam.y += (midY - cam.y) * k;
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
    audio.playTheme(null);
    const c = ui.card('', 'card-result');
    const facts = el('div', 'result-facts');
    const row = (k, v, cls) => { const r = el('div', 'fact' + (cls ? ' ' + cls : '')); r.appendChild(el('span', '', k)); r.appendChild(el('b', '', String(v))); facts.appendChild(r); };
    const btns = el('div', 'card-row');
    let close = null;
    const secs = Math.round(B.time);
    const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    if (this.opts.campaign) {
      // Campaign battle (design/01 §10.6): damage, losses and XP go back to the map.
      const res = applyBattleOutcome(B);
      if (win) { audio.sfx('fanfare'); haptic('clear'); spawnConfetti(); } else { audio.sfx('lifeLost'); haptic('lost'); }
      c.appendChild(el('div', win ? 'stamp' : 'stamp stamp-red', win ? 'VICTORY' : 'DEFEAT'));
      row('Enemy ships destroyed', res.lostTheirs);
      row('Your ships lost', res.lostMine);
      if (res.bounty) row('Bounty', `+${Math.round(res.bounty)}`);
      row('Time', time);
      c.appendChild(facts);
      if (res.salvage) c.appendChild(el('p', 'card-text', res.salvage));
      if (res.siege) c.appendChild(el('p', 'card-text', res.siege));
      btns.appendChild(button('Back to the map', () => { close(); screens.go('map'); }, 'btn btn-primary'));
    } else if (this.opts.sim) {
      // Battle Simulator (design/01 §15): facts only, no campaign effects.
      if (win) { audio.sfx('fanfare'); haptic('clear'); spawnConfetti(); } else { audio.sfx('lifeLost'); haptic('lost'); }
      c.appendChild(el('div', win ? 'stamp' : 'stamp stamp-red', win ? 'VICTORY' : 'DEFEAT'));
      row('Enemy ships destroyed', `${B.goalDone} of ${B.goalTotal}`);
      row('Your ships lost', B.stats.lost);
      row('Pulled back (yours / theirs)', `${B.pulledBack[0]} / ${B.pulledBack[1]}`);
      row('Shots fired, penetrations', `${B.stats.shots}, ${B.stats.pens}`);
      row('Time', time);
      c.appendChild(facts);
      btns.appendChild(button('Title', () => { close(); screens.go('title'); }, 'btn', 'back'));
      btns.appendChild(button('Simulator', () => { close(); screens.go('simulator'); }));
      btns.appendChild(button('Fight again', () => { close(); this.enter(this.opts); }, 'btn btn-primary'));
    } else if (win) {
      const res = ladder.onWin(B);
      haptic('clear');
      audio.sfx('fanfare');
      spawnConfetti();
      c.appendChild(el('div', 'stamp', 'OBJECTIVE COMPLETE'));
      for (const [k, v] of res.bonus.rows) row(k, `+${v}`);
      row('Score this run', save.profile.run.score, 'fact-total');
      row('Requisition earned', `+${res.earned}`);
      row('Time', time);
      c.appendChild(facts);
      for (const r of res.rewards) c.appendChild(el('div', 'reward', r));
      btns.appendChild(button('Title', () => { close(); screens.go('title'); }, 'btn', 'back'));
      btns.appendChild(button('Workshop', () => { close(); screens.go('workshop'); }));
      btns.appendChild(button(`Level ${this.level + 1}`, () => { close(); ladder.start(this.level + 1, false); }, 'btn btn-primary'));
    } else {
      const res = ladder.onLose(B);
      audio.sfx('lifeLost');
      haptic('lost');
      const p = save.profile;
      if (res.over) {
        c.appendChild(el('div', 'stamp stamp-red', 'GAME OVER'));
        row('Score', p.run.score);
        row('Level reached', this.level);
        row('Best score', p.bestScore);
        c.appendChild(facts);
        btns.appendChild(button('Title', () => { close(); screens.go('title'); }, 'btn', 'back'));
        btns.appendChild(button('Play from level 1', () => { close(); ladder.start(1, true); }));
        btns.appendChild(button(`Continue at level ${this.level}`, () => { close(); ladder.start(this.level, true); }, 'btn btn-primary'));
      } else {
        c.appendChild(el('div', 'stamp stamp-red', 'LIFE LOST'));
        if (B.lostReason) c.appendChild(el('p', 'card-text', B.lostReason));
        row('Lives left', p.run.lives);
        row('Enemies destroyed', `${B.goalDone} of ${B.goalTotal}`);
        row('Time', time);
        c.appendChild(facts);
        btns.appendChild(button('Title', () => { close(); screens.go('title'); }, 'btn', 'back'));
        btns.appendChild(button('Workshop', () => { close(); screens.go('workshop'); }));
        btns.appendChild(button('Retry', () => { close(); ladder.start(this.level, false); }, 'btn btn-primary'));
      }
    }
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
    drawConfetti(g);
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
    if (!C.reserve.hidden) drawControl(g, C.reserve, nowMs, 1);
    // Objective with a progress bar.
    const left = (C.reserve.hidden ? C.cards[2].x + C.cards[2].w : C.reserve.x + C.reserve.w) + 10;
    const right = this.mini.x - 10;
    if (right - left > 70) {
      const goal = B.cfg.goal;
      let text, f;
      if (B.test) { text = `Test drive · ${Math.round(B.me.body.x)} m`; f = B.me.body.x / B.T.length; }
      else if (B.rotation) { text = `Enemy ${B.goalTotal - B.goalDone}/${B.goalTotal} · reserve ${B.reserve[1].length}`; f = B.goalDone / Math.max(1, B.goalTotal); }
      else if (goal.type === 'hold') { text = `${goal.text} ${Math.floor(B.holdT)}/${goal.time} s`; f = B.holdT / goal.time; }
      else if (goal.type === 'escort' && B.escort) { const m = Math.max(0, Math.round(B.depot - B.escort.body.x)); text = `${goal.text}: ${m} m`; f = 1 - m / (B.depot - 62); }
      else { text = `${goal.text} ${B.goalDone}/${B.goalTotal}`; f = B.goalDone / Math.max(1, B.goalTotal); }
      g.font = `400 13px ${FONT_UI}`;
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillStyle = PAL.linen;
      g.fillText(text, left, safe.t + 9, right - left);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(left, safe.t + 17, right - left, 3);
      g.fillStyle = PAL.amber; g.fillRect(left, safe.t + 17, (right - left) * clamp(f, 0, 1), 3);
      if (!B.test && !this.opts.sim && !this.opts.campaign) {
        // Level, score and lives (dog tags).
        const run = save.profile.run;
        g.font = `700 12px ${FONT_UI}`;
        g.fillStyle = PAL.linen;
        const sc = `L${this.level}  ${(run.score + B.score).toLocaleString('en-US')}`;
        g.fillText(sc, left, safe.t + 27);
        let tx = left + g.measureText(sc).width + 8;
        for (let i = 0; i < run.lives && tx + 8 < right; i++, tx += 10) {
          g.fillStyle = '#b9b3a2';
          roundRect(g, tx, safe.t + 22, 7, 10, 2); g.fill();
          g.fillStyle = '#4b4a45';
          g.beginPath(); g.arc(tx + 3.5, safe.t + 24.5, 1, 0, Math.PI * 2); g.fill();
        }
      }
    }
    this.drawMinimap(g);
    for (const c of [C.time, C.pause, C.settings, C.recenter]) drawControl(g, c, nowMs, 1);
    for (const c of [C.left, C.right, C.up, C.down, C.special, C.alt, C.swap, C.fire, ...C.chips]) drawControl(g, c, nowMs, ghost);
    // Aircraft: throttle, height over the ground and a stall warning. Helicopters: height and order.
    if (B.me.flier && !C.up.hidden) {
      const me = B.me;
      const ground = Math.max(B.T.height(me.body.x), seaAt(B.T, me.body.x) ? B.T.sea : -Infinity);
      const alt = Math.round(me.body.y - ground);
      const text = me.domain === 'air' ? `Throttle ${Math.round(me.throttle * 100)}% · height ${alt} m`
        : `Height ${alt} m · order ${Math.round((me.altCmd === undefined || me.altCmd === null ? me.body.y : me.altCmd) - ground)} m`;
      g.font = `700 12px ${FONT_UI}`;
      g.textAlign = 'center'; g.textBaseline = 'bottom';
      g.fillStyle = PAL.linen;
      g.fillText(text, C.up.x, C.up.y - C.up.r - 4);
      if (me.domain === 'air' && !me.destroyed && Math.abs((me.alpha || 0) * 180 / Math.PI) > STALL_DEG) {
        g.fillStyle = PAL.danger; g.font = `700 16px ${FONT_UI}`;
        g.fillText('STALL', C.up.x, C.up.y - C.up.r - 20);
      }
    }
    // Submarine depth: metres below the surface, and the order.
    if (B.me.ballast && !C.up.hidden) {
      const me = B.me;
      const depth = Math.max(0, B.T.sea - (me.body.y + (me.bounds.maxY - me.com.y)));
      const order = me.depthCmd === null || me.depthCmd === undefined ? 'surface' : `${Math.max(0, Math.round(B.T.sea - me.depthCmd - (me.bounds.maxY - me.com.y)))} m`;
      g.font = `700 12px ${FONT_UI}`;
      g.textAlign = 'center'; g.textBaseline = 'bottom';
      g.fillStyle = PAL.linen;
      g.fillText(`Depth ${Math.round(depth)} m · order ${order}`, C.up.x, C.up.y - C.up.r - 4);
    }
    const mw = mainWeapon(B.me);
    if (mw && !B.me.destroyed) drawRing(g, C.fire, 1 - Math.max(0, mw.reload) / (mw.def.reload * (B.me.loaderShort && mw.def.cal >= 75 ? 1.6 : 1)), ghost);
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
    if (T.seaX0 !== undefined) {
      g.strokeStyle = 'rgba(127,176,234,0.8)';
      g.beginPath(); g.moveTo(X(T.seaX0), Y(T.sea)); g.lineTo(X(T.length), Y(T.sea)); g.stroke();
    }
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
