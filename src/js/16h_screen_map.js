/* ==== 16h SCREEN: WORLD MAP ==== */
// The campaign map (design/02 §4, design/03 §4): a painted topographic map, faction territory,
// roads, settlements and fleet counters; the top bar (date, treasury, the selected fleet's
// cargo); thumb buttons to cycle fleets, clock speeds and Start/Stop; fleet and settlement
// panels; tap a destination for a path preview with time and fuel; the pre-battle card on contact.

const MAP_PX = 6;                 // pre-rendered pixels per cell

SCREENS.map = {
  pausable: true,
  cam: { x: 0, y: 0, z: 6 },
  sel: null,                      // { kind: 'fleet'|'settlement', id }
  plan: null,                     // move preview for the selected fleet
  base: null, terr: null, fog: null,
  root: null,

  enter() {
    if (!campaign) { screens.go('title'); return; }
    this.base = renderBaseMap();
    this.terr = renderTerritory();
    const flag = playerFleets().find((fl) => fl.shipIds.length) || campaign.fleets[0];
    this.cam.x = flag.x; this.cam.y = flag.y;
    this.cam.z = clamp(layout.h / 46, 5, 14);
    this.sel = { kind: 'fleet', id: flag.id };
    this.tab = 'ships';
    this.plan = null;
    campaign.running = false;
    updateVisibility();
    this.build();
    audio.playTheme('title');
  },
  exit() { if (this.root) this.root.remove(); this.root = null; campaignStore.save(); },
  pauseOpts() {
    return { restartLabel: 'Save now', restart: () => { campaignStore.save(); ui.toast('Campaign saved.'); }, quitLabel: 'Save and quit to title', quit: () => { campaignStore.save(); screens.go('title'); } };
  },

  // ---------- DOM: top bar, thumbs, panel, move bar
  build() {
    if (this.root) this.root.remove();
    const r = el('div', 'mapui');
    this.root = r;
    const top = el('div', 'map-top');
    this.dateEl = el('span', 'map-fact map-date');
    this.moneyEl = el('span', 'map-fact');
    this.cargoEl = el('span', 'map-fact map-cargo');
    top.appendChild(this.dateEl); top.appendChild(this.moneyEl); top.appendChild(this.cargoEl);
    const sp = el('span', 'map-spacer'); top.appendChild(sp);
    top.appendChild(button('❚❚', () => pauseGame(), 'btn btn-small map-icon'));
    top.appendChild(button('⚙', () => openSettingsPaused(), 'btn btn-small map-icon'));
    r.appendChild(top);
    const bot = el('div', 'map-bottom');
    bot.appendChild(button('◀ Fleet', () => this.cycle(-1), 'btn btn-small'));
    bot.appendChild(button('Fleet ▶', () => this.cycle(1), 'btn btn-small'));
    const sp2 = el('span', 'map-spacer'); bot.appendChild(sp2);
    this.speedBtns = CLOCK_SPEEDS.map((v) => { const b = button(`${v}×`, () => { campaign.speed = v; this.refresh(); }, 'btn btn-small map-speed'); bot.appendChild(b); return b; });
    this.goBtn = button('Start ▶', () => this.toggleClock(), 'btn btn-primary map-go');
    bot.appendChild(this.goBtn);
    r.appendChild(bot);
    this.panel = el('div', 'map-panel');
    r.appendChild(this.panel);
    this.moveBar = el('div', 'map-move');
    r.appendChild(this.moveBar);
    uiLayer.insertBefore(r, ui.toastBox);
    this.refresh();
  },

  toggleClock() {
    campaign.running = !campaign.running;
    if (campaign.running) { this.plan = null; }
    audio.sfx(campaign.running ? 'toggleOn' : 'toggleOff');
    this.refresh();
  },

  cycle(k) {
    const list = playerFleets().filter((fl) => fl.shipIds.length);
    if (!list.length) return;
    const i = this.sel && this.sel.kind === 'fleet' ? list.findIndex((fl) => fl.id === this.sel.id) : -1;
    const fl = list[(i + k + list.length) % list.length];
    this.select('fleet', fl.id);
    this.cam.x = fl.x; this.cam.y = fl.y;
  },

  select(kind, id) {
    this.sel = { kind, id };
    this.plan = null;
    this.tab = kind === 'fleet' ? 'ships' : 'overview';
    audio.sfx('tap');
    this.refresh();
  },

  selFleet() { return this.sel && this.sel.kind === 'fleet' ? byId('fleets', this.sel.id) : null; },

  refresh() {
    if (!this.root) return;
    const hh = Math.floor(campaign.hour), mm = Math.floor((campaign.hour % 1) * 60);
    this.dateEl.textContent = `Day ${campaign.day}, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    this.moneyEl.textContent = `Treasury ${Math.floor(campaign.treasury).toLocaleString('en-US')}`;
    const fl = this.selFleet();
    if (fl) {
      const f = fleetFuel(fl);
      this.cargoEl.textContent = `${fl.name} · fuel ${f.fuel.toFixed(1)}/${f.cap.toFixed(1)} · hold ${holdUsed(fl).toFixed(1)}/${holdCap(fl).toFixed(0)}`;
    } else this.cargoEl.textContent = '';
    this.cargoEl.hidden = !this.cargoEl.textContent;
    this.speedBtns.forEach((b, i) => b.classList.toggle('on', campaign.speed === CLOCK_SPEEDS[i]));
    this.goBtn.textContent = campaign.running ? 'Stop ❚❚' : 'Start ▶';
    this.buildPanel();
    this.buildMoveBar();
  },

  buildMoveBar() {
    const m = this.moveBar;
    m.textContent = '';
    const p = this.plan, fl = this.selFleet();
    if (!p || !fl) { m.hidden = true; return; }
    m.hidden = false;
    if (p.why) { m.appendChild(el('span', 'map-fact', p.why)); m.appendChild(button('OK', () => { this.plan = null; this.refresh(); }, 'btn btn-small')); return; }
    const txt = `${Math.round(p.hours)} h · fuel ${p.fuel.toFixed(1)} needed, ${p.held.toFixed(1)} held${p.strands ? ' · strands on the way' : ''}`;
    m.appendChild(el('span', 'map-fact' + (p.strands ? ' map-warn' : ''), txt));
    m.appendChild(button('Cancel', () => { this.plan = null; this.refresh(); }, 'btn btn-small', 'back'));
    m.appendChild(button('Move', () => { orderMove(fl, p); this.plan = null; audio.sfx('order'); this.refresh(); }, 'btn btn-small btn-primary'));
  },

  // ---------- panels (02 §4.3, §4.4)
  buildPanel() {
    const P = this.panel;
    P.textContent = '';
    if (!this.sel) { P.hidden = true; return; }
    P.hidden = false;
    const tabs = el('div', 'map-tabs');
    const tab = (id, label) => { const b = button(label, () => { this.tab = id; this.refresh(); }, 'btn btn-small map-tab' + (this.tab === id ? ' on' : '')); tabs.appendChild(b); };
    const body = el('div', 'map-body');
    const row = (k, v) => { const r = el('div', 'fact'); r.appendChild(el('span', '', k)); r.appendChild(el('b', '', String(v))); body.appendChild(r); };
    if (this.sel.kind === 'fleet') {
      const fl = byId('fleets', this.sel.id);
      if (!fl) { this.sel = null; P.hidden = true; return; }
      const mine = fl.faction === campaign.faction;
      P.appendChild(el('h3', 'map-title', mine ? fl.name : `${factionOf(fl.faction).name} ${fl.domain} fleet`));
      if (!mine) {
        const rel = relation(fl.faction, campaign.faction);
        row('Relation', rel === 'war' ? 'At war' : 'Truce');
        row('Ships', fl.shipIds.length);
        row('Domain', fl.domain);
        P.appendChild(body);
        return;
      }
      tab('ships', 'Ships'); tab('cargo', 'Cargo'); tab('admiral', 'Admiral');
      P.appendChild(tabs);
      const adm = fleetAdmiral(fl);
      if (this.tab === 'ships') {
        for (const sh of fleetShips(fl)) {
          const st = shipStats(sh), cap = byId('officers', sh.captainId);
          const r = el('div', 'map-ship');
          r.appendChild(el('b', '', st.name));
          r.appendChild(el('small', '', `${st.clsName} · ${cap ? `${cap.rank === 'grand' ? 'Grand Admiral' : 'Capt.'} ${cap.name} L${cap.level}` : 'no captain'} · hull ${Math.round(shipHealth(sh) * 100)}% · fuel ${Math.round((sh.fuel / st.fuelCap) * 100)}% · ammo ${Math.round(sh.ammo * 100)}%`));
          r.appendChild(button('Detach', () => { const why = detachShip(fl, sh); ui.toast(why || `${st.name} detached.`); this.refresh(); }, 'btn btn-small'));
          body.appendChild(r);
        }
        if (!fl.shipIds.length) body.appendChild(el('p', 'card-text', 'No ships.'));
        // Ships left at a field outpost here can rejoin (same domain).
        for (const o of (campaign.outposts || []).filter((q) => q.faction === fl.faction && q.domain === fl.domain && Math.hypot(q.x - fl.x, q.y - fl.y) < 1.5)) {
          for (const sh of campaign.ships.filter((s) => s.outpost === o.id)) body.appendChild(button(`Take ${shipStats(sh).name} from the outpost`, () => { const why = pickUp(fl, sh); ui.toast(why || 'Taken aboard.'); this.refresh(); }, 'btn btn-small'));
        }
        const spare = campaign.officers.filter((o) => o.alive && o.fleetId === fl.id && o.rank === 'captain' && !o.shipId);
        if (spare.length) row('Captains without a ship', spare.map((o) => o.name).join(', '));
      } else if (this.tab === 'cargo') {
        const f = fleetFuel(fl);
        row('Fuel in tanks and hold', `${f.fuel.toFixed(1)} of ${f.cap.toFixed(1)} units`);
        row('Burn on the move', `${fleetBurn(fl).toFixed(2)} units/h`);
        row('March speed', `${Math.round(fleetSpeed(fl))} km/h`);
        row('Hold', `${holdUsed(fl).toFixed(1)} of ${holdCap(fl).toFixed(0)} units (fuel ${(fl.hold.fuel || 0).toFixed(1)}, ammo ${(fl.hold.ammo || 0).toFixed(1)})`);
        row('State', fl.stranded ? 'Stranded: no fuel' : fl.path.length ? 'Moving' : fl.docked ? `Docked at ${byId('settlements', fl.docked).name}` : 'Holding');
        if (fl.path.length) body.appendChild(button('Stop here', () => { fl.path = []; fl.dest = null; this.refresh(); }, 'btn btn-small'));
      } else {
        const lvl = adm ? adm.level : 1;
        row('Commander', adm ? `${adm.rank === 'grand' ? 'Grand Admiral' : 'Admiral'} ${adm.name}` : '—');
        row('Level', lvl);
        row('XP', adm ? Math.round(adm.xp) : 0);
        row('Fleet size', `${fl.shipIds.length} of ${FLEET_SIZE[Math.min(9, lvl - 1)]}`);
      }
      P.appendChild(body);
      return;
    }
    const s = byId('settlements', this.sel.id);
    const T = SETTLEMENT_TYPES[s.type];
    P.appendChild(el('h3', 'map-title', `${s.name}${s.capital ? ' (capital)' : ''}`));
    tab('overview', 'Overview'); tab('market', 'Market');
    P.appendChild(tabs);
    const rel = relation(s.faction, campaign.faction);
    if (this.tab === 'overview') {
      row('Type', T.name + (s.coastal ? ', coastal' : ''));
      row('Owner', s.faction ? factionOf(s.faction).name : 'Neutral');
      row('Relation', { own: 'Yours', war: 'At war', truce: 'Truce', neutral: 'Neutral' }[rel]);
      row('Terrain', MAP_TERRAIN[s.biome].name);
      if (s.faction === campaign.faction) row('Money per day', Math.round(T.money * (T.money > 0 && s.coastal ? COASTAL_MONEY : 1)));
      const gar = campaign.ships.filter((sh) => sh.garrison === s.id);
      row('Garrison', `${gar.length} of ${T.garrison}${gar.length ? `: ${gar.map((sh) => shipStats(sh).name).join(', ')}` : ''}`);
      const docked = playerFleets().filter((fl) => fl.docked === s.id && fl.shipIds.length);
      for (const fl of docked) {
        const room = FLEET_SIZE[Math.min(9, (fleetAdmiral(fl) || { level: 1 }).level - 1)] - fl.shipIds.length;
        for (const sh of gar.filter((g) => mapDomain(designReport(shipDesign(g)).domain) === fl.domain)) {
          if (room > 0) body.appendChild(button(`${fl.name}: take ${shipStats(sh).name}`, () => { const why = pickUp(fl, sh); ui.toast(why || 'Taken aboard.'); this.refresh(); }, 'btn btn-small'));
        }
      }
    } else {
      for (const good of ['fuel', 'ammo']) {
        const b = buyPrice(s, good, campaign.faction);
        row(good === 'fuel' ? 'Fuel (100 L)' : 'Ammo (100 kg)', b === null ? 'No trade (at war)' : `buy ${b.toFixed(1)} · sell ${(b * SELL_SHARE).toFixed(1)} · stock ${Math.floor(s.market[good])}`);
      }
      const docked = playerFleets().filter((fl) => fl.docked === s.id && fl.shipIds.length);
      if (!docked.length) body.appendChild(el('p', 'card-text', 'Dock a fleet here to trade: move it onto the settlement (ships to the water beside it).'));
      for (const fl of docked) {
        body.appendChild(el('div', 'ws-label', fl.name));
        const rf = refuelQuote(fl, s), ra = rearmQuote(fl, s);
        const act = el('div', 'map-row');
        act.appendChild(button(rf.why ? 'Refuel' : rf.units < 0.05 ? 'Tanks full' : `Refuel ${rf.units.toFixed(1)} units for ${Math.ceil(rf.cost)}`, () => { const why = refuel(fl, s); if (why) ui.toast(why); else audio.sfx('order'); this.refresh(); }, 'btn btn-small'));
        act.appendChild(button(ra.why ? 'Rearm' : ra.units < 0.005 ? 'Magazines full' : `Rearm ${ra.units.toFixed(2)} units for ${Math.ceil(ra.cost)}`, () => { const why = rearm(fl, s); if (why) ui.toast(why); else audio.sfx('order'); this.refresh(); }, 'btn btn-small'));
        if (holdCap(fl) > 0) for (const good of ['fuel', 'ammo']) {
          act.appendChild(button(`Buy 5 ${good}`, () => { const why = trade(fl, s, good, 5); if (why) ui.toast(why); this.refresh(); }, 'btn btn-small'));
          act.appendChild(button(`Sell 5 ${good}`, () => { const why = trade(fl, s, good, -5); if (why) ui.toast(why); this.refresh(); }, 'btn btn-small'));
        }
        body.appendChild(act);
      }
    }
    P.appendChild(body);
  },

  // ---------- clock and events
  update(dt, simRunning) {
    if (!campaign || !simRunning) return;
    const was = campaign.running;
    const events = campaignTick(dt);
    for (const e of events) if (e.msg) ui.toast(e.msg, 3500);
    const contact = events.find((e) => e.contact);
    if (contact) this.preBattle(contact.contact);
    this.t = (this.t || 0) + dt;
    if (was !== campaign.running || this.t > 0.25) { this.t = 0; this.refresh(); }
  },

  // ---------- gestures
  world: {
    tap(x, y) {
      const S = SCREENS.map;
      const cx = S.toCellX(x), cy = S.toCellY(y);
      const r = 1.2 * Math.max(1, 12 / S.cam.z);
      const fl = campaign.fleets.find((f) => f.shipIds.length && (f.faction === campaign.faction || f.seen) && Math.abs(S.sx(f.x) + (f.drawDx || 0) - x) < 16 && Math.abs(S.sy(f.y) - y) < 14);
      const s = world.settlements.find((q) => Math.hypot(q.x + 0.5 - cx, q.y + 0.5 - cy) < r);
      const mine = S.selFleet();
      // With one of your fleets selected, a tap elsewhere plans a move there (a settlement: dock at it).
      if (mine && mine.faction === campaign.faction && !(fl && fl.faction === campaign.faction)) {
        if (s && (!fl || fl.faction !== campaign.faction) && S.plan && S.plan.target === s.id) { S.select('settlement', s.id); return; }
        const to = s ? portCell(s, mine.domain) || [cx, cy] : [cx, cy];
        S.plan = planMove(mine, to[0], to[1]);
        if (s) S.plan.target = s.id;
        audio.sfx('tap');
        S.refresh();
        return;
      }
      if (fl) { S.select('fleet', fl.id); return; }
      if (s) { S.select('settlement', s.id); return; }
      S.sel = null; S.plan = null; S.refresh();
    },
    doubleTap() { const S = SCREENS.map; S.cam.z = clamp(layout.h / 46, 5, 14); },
    pan(dx, dy) { const S = SCREENS.map; S.cam.x -= dx / S.cam.z; S.cam.y -= dy / S.cam.z; S.clampCam(); },
    pinch(f, cx, cy) {
      const S = SCREENS.map;
      const bx = S.toCellX(cx), by = S.toCellY(cy);
      S.cam.z = clamp(S.cam.z * f, 2.5, 40);
      S.cam.x += bx - S.toCellX(cx); S.cam.y += by - S.toCellY(cy);
      S.clampCam();
    },
  },
  clampCam() { this.cam.x = clamp(this.cam.x, 0, WORLD_W); this.cam.y = clamp(this.cam.y, 0, WORLD_H); },
  toCellX(sx) { return (sx - layout.w / 2) / this.cam.z + this.cam.x; },
  toCellY(sy) { return (sy - layout.h / 2) / this.cam.z + this.cam.y; },
  sx(cx) { return (cx - this.cam.x) * this.cam.z + layout.w / 2; },
  sy(cy) { return (cy - this.cam.y) * this.cam.z + layout.h / 2; },

  key(code, down) {
    if (!down) return;
    if (code === 'Space' || code === 'KeyT') this.toggleClock();
    else if (code === 'KeyE' || code === 'Tab') this.cycle(1);
    else if (code === 'KeyQ') this.cycle(-1);
    else if (/^Digit[123]$/.test(code)) { campaign.speed = CLOCK_SPEEDS[+code[5] - 1]; this.refresh(); }
  },

  // ---------- drawing
  render(g) {
    const { w, h } = layout;
    const z = this.cam.z;
    g.fillStyle = MAP_TERRAIN.sea.color;
    g.fillRect(0, 0, w, h);
    const ox = this.sx(0), oy = this.sy(0);
    g.drawImage(this.base, ox, oy, WORLD_W * z, WORLD_H * z);
    g.drawImage(this.terr, ox, oy, WORLD_W * z, WORLD_H * z);
    // Weather fronts.
    for (const f of campaign.weather || []) {
      g.fillStyle = f.kind === 'storm' || f.kind === 'sandstorm' ? 'rgba(60,64,80,0.2)' : f.kind === 'snow' || f.kind === 'fog' ? 'rgba(235,240,245,0.12)' : 'rgba(120,140,170,0.14)';
      g.beginPath(); g.arc(this.sx(f.x), this.sy(f.y), f.r * z, 0, Math.PI * 2); g.fill();
    }
    // Paths of your fleets and the move preview.
    g.lineWidth = 2;
    for (const fl of playerFleets()) if (fl.path.length) this.drawPath(g, fl.x, fl.y, fl.path, 'rgba(123,196,127,0.8)');
    if (this.plan && this.plan.path && this.selFleet()) this.drawPath(g, this.selFleet().x, this.selFleet().y, this.plan.path, this.plan.strands ? PAL.danger : PAL.amber, true);
    // Settlements.
    for (const s of world.settlements) this.drawSettlement(g, s);
    // Fog of war over what your fleets and settlements can't see.
    this.drawFog(g);
    // Fleets: yours, and the enemy fleets you can see.
    // Counters at the same spot stand side by side.
    const shown = campaign.fleets.filter((fl) => fl.shipIds.length && (fl.faction === campaign.faction || fl.seen));
    const placed = [];
    for (const fl of shown) {
      const k = placed.filter((p) => Math.hypot(p.x - fl.x, p.y - fl.y) * this.cam.z < 24).length;
      placed.push(fl);
      fl.drawDx = k * 30;
      this.drawFleet(g, fl);
    }
    for (const o of campaign.outposts || []) { g.fillStyle = PAL.amber; g.fillRect(this.sx(o.x) - 4, this.sy(o.y) - 4, 8, 8); }
  },

  drawPath(g, x, y, path, col, dashed) {
    g.strokeStyle = col;
    g.setLineDash(dashed ? [6, 4] : []);
    g.beginPath(); g.moveTo(this.sx(x), this.sy(y));
    for (const [px, py] of path) g.lineTo(this.sx(px), this.sy(py));
    g.stroke();
    g.setLineDash([]);
  },

  drawSettlement(g, s) {
    const x = this.sx(s.x + 0.5), y = this.sy(s.y + 0.5);
    if (x < -40 || y < -40 || x > layout.w + 40 || y > layout.h + 40) return;
    const F = s.faction ? factionOf(s.faction) : null;
    const k = { village: 5, city: 7, metropolis: 9, fort: 7, citadel: 9 }[s.type];
    g.fillStyle = '#2A2622';
    g.strokeStyle = PAL.linen; g.lineWidth = 1.5;
    if (s.type === 'fort' || s.type === 'citadel') {
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, r = i % 2 ? k * 0.55 : k; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      g.closePath(); g.fill(); g.stroke();
    } else {
      g.fillRect(x - k, y - k * 0.7, k * 2, k * 1.4); g.strokeRect(x - k, y - k * 0.7, k * 2, k * 1.4);
      if (s.type !== 'village') { g.fillStyle = PAL.linen; g.fillRect(x - k * 0.6, y - k * 1.2, k * 0.4, k * 0.6); g.fillRect(x + k * 0.2, y - k * 1.5, k * 0.4, k * 0.9); }
    }
    // Pennant in the owner's colour.
    g.fillStyle = F ? F.color : '#9A9DA1';
    g.beginPath(); g.moveTo(x - k, y - k * 0.7); g.lineTo(x - k, y - k * 2); g.lineTo(x - k + 8, y - k * 1.7); g.lineTo(x - k, y - k * 1.4); g.fill();
    if (this.cam.z >= 5 || s.capital) {
      g.font = `${s.capital ? 700 : 400} 12px ${FONT_UI}`;
      g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillStyle = 'rgba(10,14,20,0.7)';
      const tw = g.measureText(s.name).width;
      g.fillRect(x - tw / 2 - 3, y + k + 1, tw + 6, 15);
      g.fillStyle = PAL.linen;
      g.fillText(s.name, x, y + k + 2);
    }
    if (this.sel && this.sel.kind === 'settlement' && this.sel.id === s.id) { g.strokeStyle = PAL.amber; g.lineWidth = 2; g.strokeRect(x - k - 4, y - k * 2 - 2, k * 2 + 8, k * 3); }
  },

  drawFleet(g, fl) {
    const x = this.sx(fl.x) + (fl.drawDx || 0), y = this.sy(fl.y);
    const F = factionOf(fl.faction);
    const W = 26, H = 18;
    g.fillStyle = 'rgba(12,14,20,0.85)';
    roundRect(g, x - W / 2, y - H / 2, W, H, 4); g.fill();
    g.strokeStyle = F.color; g.lineWidth = 2;
    roundRect(g, x - W / 2, y - H / 2, W, H, 4); g.stroke();
    // Domain glyph: tank, hull or envelope.
    g.fillStyle = F.color;
    if (fl.domain === 'land') { g.fillRect(x - 9, y - 1, 12, 5); g.fillRect(x - 6, y - 4, 6, 3); g.fillRect(x, y - 3, 6, 1.5); }
    else if (fl.domain === 'sea') { g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x + 4, y); g.lineTo(x + 1, y + 4); g.lineTo(x - 8, y + 4); g.fill(); g.fillRect(x - 5, y - 4, 4, 4); }
    else { g.beginPath(); g.ellipse(x - 3, y - 1, 7, 3.5, 0, 0, Math.PI * 2); g.fill(); g.fillRect(x - 5, y + 3, 4, 2); }
    g.font = `700 12px ${FONT_UI}`; g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillStyle = PAL.linen;
    g.fillText(String(fl.shipIds.length), x + W / 2 - 2, y);
    if (fl.faction === campaign.faction) {
      const f = fleetFuel(fl);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - W / 2, y + H / 2 + 1, W, 3);
      g.fillStyle = f.fuel <= 0 ? PAL.danger : f.fuel / f.cap < LOW_FUEL ? PAL.warning : PAL.good;
      g.fillRect(x - W / 2, y + H / 2 + 1, W * clamp(f.fuel / Math.max(0.01, f.cap), 0, 1), 3);
    }
    if (this.sel && this.sel.kind === 'fleet' && this.sel.id === fl.id) { g.strokeStyle = PAL.amber; g.lineWidth = 2; g.strokeRect(x - W / 2 - 4, y - H / 2 - 4, W + 8, H + 12); }
  },

  drawFog(g) {
    const { w, h } = layout;
    if (!this.fog || this.fog.width !== Math.ceil(w) || this.fog.height !== Math.ceil(h)) { this.fog = document.createElement('canvas'); this.fog.width = Math.ceil(w); this.fog.height = Math.ceil(h); }
    const f = this.fog.getContext('2d');
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, this.fog.width, this.fog.height);
    f.fillStyle = 'rgba(8,12,22,0.42)';
    f.fillRect(0, 0, this.fog.width, this.fog.height);
    f.globalCompositeOperation = 'destination-out';
    f.fillStyle = '#000';
    for (const [x, y, r] of campaign.eyes || []) { f.beginPath(); f.arc(this.sx(x), this.sy(y), r * this.cam.z, 0, Math.PI * 2); f.fill(); }
    g.drawImage(this.fog, 0, 0);
  },

  // ---------- contact and the pre-battle card (01 §10.1)
  preBattle(contact) {
    const mine = byId('fleets', contact.mine), theirs = byId('fleets', contact.theirs);
    if (!mine || !theirs) return;
    const place = battlePlace(mine.x, mine.y);
    const c = ui.card('Contact', 'card-prebattle');
    const facts = el('div', 'result-facts');
    const row = (k, v) => { const r = el('div', 'fact'); r.appendChild(el('span', '', k)); r.appendChild(el('b', '', String(v))); facts.appendChild(r); };
    const sides = battleSides(mine, theirs);
    row('Battlefield', `${SIM_FIELDS[place.field]} · ${place.weather}`);
    row('Your ships', sides.mine.map((sh) => shipStats(sh).name).join(', ') || 'none that can fight here');
    row('Enemy (spotted)', sides.theirs.map((sh) => shipStats(sh).clsName).join(', '));
    const esc = retreatCheck(sides.mine, sides.theirs);
    row('Retreat', esc.free ? 'Your slowest ship outpaces them' : `Costs your rearmost ship (${esc.lose ? shipStats(esc.lose).name : '—'})`);
    c.appendChild(facts);
    const btns = el('div', 'card-row');
    let close = null;
    btns.appendChild(button('Retreat', () => { close(); retreat(mine, theirs, esc); this.refresh(); }, 'btn', 'back'));
    btns.appendChild(button('Auto-resolve', () => { close(); const res = autoResolve(mine, theirs); this.afterBattle(res); }));
    const fight = button('Fight', () => { close(); screens.go('battle', { campaign: { mine: mine.id, theirs: theirs.id } }); }, 'btn btn-primary');
    if (!sides.mine.length) fight.classList.add('btn-disabled'), fight.disabled = true;
    btns.appendChild(fight);
    c.appendChild(btns);
    close = ui.open(c);
  },

  afterBattle(res) {
    if (!res) return;
    ui.toast(res.summary, 5000);
    this.refresh();
  },
};

// ---------- pre-rendered layers
function renderBaseMap() {
  const c = document.createElement('canvas');
  c.width = WORLD_W * MAP_PX; c.height = WORLD_H * MAP_PX;
  const g = c.getContext('2d');
  const P = MAP_PX;
  for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
    const i = y * WORLD_W + x;
    const t = T_IDS[world.ter[i]];
    const h = world.height[i];
    let col = MAP_TERRAIN[t].color;
    // Hill shading from the height difference to the north-west neighbour; deeper sea is darker.
    const nw = world.height[Math.max(0, y - 1) * WORLD_W + Math.max(0, x - 1)];
    const k = t === 'sea' ? clamp(0.75 + (h - world.seaLevel) * 2.2, 0.55, 1.05) : clamp(1 + (h - nw) * 4, 0.8, 1.2);
    g.fillStyle = shade(col, k);
    g.fillRect(x * P, y * P, P, P);
    if (t === 'mountains') { g.strokeStyle = 'rgba(40,36,32,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x * P + 1, y * P + P - 1); g.lineTo(x * P + P / 2, y * P + 1); g.lineTo(x * P + P - 1, y * P + P - 1); g.stroke(); }
    if (t === 'forest' && (x + y) % 2 === 0) { g.fillStyle = 'rgba(20,40,20,0.35)'; g.beginPath(); g.arc(x * P + P / 2, y * P + P / 2, P * 0.3, 0, Math.PI * 2); g.fill(); }
    if (t === 'ruins' && (x * 7 + y) % 3 === 0) { g.fillStyle = 'rgba(40,30,24,0.5)'; g.fillRect(x * P + 1, y * P + 2, P - 3, 2); }
  }
  // Coastline and roads in ink.
  g.strokeStyle = 'rgba(20,24,30,0.55)'; g.lineWidth = 1;
  for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
    const sea = world.ter[y * WORLD_W + x] === T_SEA;
    if (x + 1 < WORLD_W && sea !== (world.ter[y * WORLD_W + x + 1] === T_SEA)) { g.beginPath(); g.moveTo((x + 1) * P, y * P); g.lineTo((x + 1) * P, (y + 1) * P); g.stroke(); }
    if (y + 1 < WORLD_H && sea !== (world.ter[(y + 1) * WORLD_W + x] === T_SEA)) { g.beginPath(); g.moveTo(x * P, (y + 1) * P); g.lineTo((x + 1) * P, (y + 1) * P); g.stroke(); }
  }
  g.strokeStyle = 'rgba(60,40,24,0.8)'; g.lineWidth = 1.5;
  for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
    if (!world.road[y * WORLD_W + x]) continue;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < WORLD_W && ny >= 0 && ny < WORLD_H && world.road[ny * WORLD_W + nx]) { g.beginPath(); g.moveTo((x + 0.5) * P, (y + 0.5) * P); g.lineTo((nx + 0.5) * P, (ny + 0.5) * P); g.stroke(); }
    }
  }
  return c;
}

// Territory: a faint tint and a grease-pencil border in each faction's colour.
function renderTerritory() {
  const c = document.createElement('canvas');
  c.width = WORLD_W * MAP_PX; c.height = WORLD_H * MAP_PX;
  const g = c.getContext('2d');
  const P = MAP_PX;
  for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
    const o = world.owner[y * WORLD_W + x];
    if (o < 0 || world.ter[y * WORLD_W + x] === T_SEA) continue;
    const col = FACTIONS[o].color;
    g.globalAlpha = 0.14; g.fillStyle = col; g.fillRect(x * P, y * P, P, P);
    g.globalAlpha = 0.85; g.strokeStyle = col; g.lineWidth = 2;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= WORLD_W || ny >= WORLD_H) continue;
      if (world.owner[ny * WORLD_W + nx] === o) continue;
      g.beginPath();
      if (dx) { const X = (dx > 0 ? x + 1 : x) * P; g.moveTo(X, y * P); g.lineTo(X, (y + 1) * P); } else { const Y = (dy > 0 ? y + 1 : y) * P; g.moveTo(x * P, Y); g.lineTo((x + 1) * P, Y); }
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  return c;
}
