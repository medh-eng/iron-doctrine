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
    mapTips();                                  // first visit only (16q)
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
    top.appendChild(button('War room', () => openRelations(), 'btn btn-small map-research'));
    top.appendChild(button('Research', () => openResearch(), 'btn btn-small map-research'));
    top.appendChild(button('❚❚', () => pauseGame(), 'btn btn-small map-icon'));
    top.appendChild(button('⚙', () => openSettingsPaused(), 'btn btn-small map-icon'));
    r.appendChild(top);
    const bot = el('div', 'map-bottom');
    bot.appendChild(button('◀ Fleet', () => this.cycle(-1), 'btn btn-small'));
    this.nextFleetBtn = button('Fleet ▶', () => this.cycle(1), 'btn btn-small');
    bot.appendChild(this.nextFleetBtn);
    this.detailsBtn = button('Details', () => { this.panelOpen = true; this.refresh(); }, 'btn btn-small');
    bot.appendChild(this.detailsBtn);
    this.supplyBtn = button('Supply', () => { this.logistics = !this.logistics; this.refresh(); }, 'btn btn-small map-speed');
    bot.appendChild(this.supplyBtn);
    this.hintBtn = button('Hint', () => openHints(), 'btn btn-small map-speed');   // Settings → Help → Hints (v0.7.2)
    bot.appendChild(this.hintBtn);
    const sp2 = el('span', 'map-spacer'); bot.appendChild(sp2);
    this.speedBtns = CLOCK_SPEEDS.map((v) => { const b = button(`${v}×`, () => { campaign.speed = v; this.refresh(); }, 'btn btn-small map-speed'); bot.appendChild(b); return b; });
    this.goBtn = button('Start ▶', () => this.toggleClock(), 'btn btn-primary map-go');
    bot.appendChild(this.goBtn);
    r.appendChild(bot);
    this.panel = el('div', 'map-panel');
    r.appendChild(this.panel);
    this.moveBar = el('div', 'map-move');
    r.appendChild(this.moveBar);
    // The next step (16r, v0.8.0): a banner under the top bar; tap it for more ideas.
    this.coachEl = el('button', 'map-coach');
    this.coachEl.type = 'button';
    this.coachEl.appendChild(el('b', 'map-coach-label', 'Next'));
    this.coachTxt = el('span', 'map-coach-text');
    this.coachEl.appendChild(this.coachTxt);
    this.coachEl.addEventListener('click', () => { audio.sfx('tap'); openHints(); });
    this.coachHi = null;
    r.appendChild(this.coachEl);
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
    this.panelOpen = true;
    audio.sfx('tap');
    this.refresh();
  },

  selFleet() { return this.sel && this.sel.kind === 'fleet' ? byId('fleets', this.sel.id) : null; },

  refresh() {
    if (!this.root) return;
    if (campaign.over && !campaign.overSeen) openWarEnd();      // the end of the war (6d), once
    if (this.hintBtn) this.hintBtn.hidden = !save.settings.hints;
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
    this.supplyBtn.classList.toggle('on', !!this.logistics);
    this.goBtn.textContent = campaign.running ? 'Stop ❚❚' : 'Start ▶';
    this.buildPanel();
    this.buildMoveBar();
    updateMapCoach(this);
  },

  buildMoveBar() {
    const m = this.moveBar;
    const p = this.plan, fl = this.selFleet();
    // Rebuild only when the plan or its fleet changes, so its buttons stay put while the clock runs.
    if (p && fl && p === this.movePlan && fl === this.moveFleet && m.childNodes.length) return;
    this.movePlan = p; this.moveFleet = fl;
    m.textContent = '';
    if (!p || !fl) { m.hidden = true; return; }
    m.hidden = false;
    if (p.why) { m.appendChild(el('span', 'map-fact', p.why)); m.appendChild(button('OK', () => { this.plan = null; this.refresh(); }, 'btn btn-small')); return; }
    const txt = `${Math.round(p.hours)} h · fuel ${p.fuel.toFixed(1)} needed, ${p.held.toFixed(1)} held${p.strands ? ' · strands on the way' : ''}`;
    m.appendChild(el('span', 'map-fact' + (p.strands ? ' map-warn' : ''), txt));
    m.appendChild(button('Cancel', () => { this.plan = null; this.refresh(); }, 'btn btn-small', 'back'));
    m.appendChild(button('Move', () => { orderMove(fl, p); this.plan = null; audio.sfx('order'); this.refresh(); }, 'btn btn-small btn-primary'));
  },

  // ---------- panels (02 §4.3, §4.4)
  // Rebuilt on every refresh; the list keeps its scroll position while the same tab stays open.
  buildPanel() {
    const old = this.panel.querySelector('.map-body');
    const key = this.sel ? `${this.sel.kind}|${this.sel.id}|${this.tab}` : '';
    const oldTabs = this.panel.querySelector('.map-tabs');
    const top = old && key === this.panelKey ? old.scrollTop : 0;
    const left = oldTabs && this.sel && this.panelKey && this.panelKey.startsWith(`${this.sel.kind}|${this.sel.id}|`) ? oldTabs.scrollLeft : 0;
    this.panelKey = key;
    this.buildPanelBody();
    const body = this.panel.querySelector('.map-body'), tabs = this.panel.querySelector('.map-tabs');
    if (body && top) body.scrollTop = top;
    if (tabs && left) tabs.scrollLeft = left;
  },
  buildPanelBody() {
    const P = this.panel;
    P.textContent = '';
    // The panel can be closed so the whole map can be tapped; it also steps aside while a move is planned.
    const open = this.sel && this.panelOpen !== false && !this.plan;
    this.detailsBtn.hidden = !this.sel || open;
    if (!open) { P.hidden = true; return; }
    P.hidden = false;
    const close = button('✕', () => { this.panelOpen = false; this.refresh(); }, 'btn btn-small map-close', 'back');
    close.setAttribute('aria-label', 'Close the panel');
    P.appendChild(close);
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
        const of = enemyOfficerFacts(fl);       // their officers' levels and upgrades (v0.7.5)
        row('Admiral', of.admiral);
        row('Captains', of.captains);
        P.appendChild(body);
        return;
      }
      if (fl.convoy && this.tab === 'admiral') this.tab = 'route';
      if (!fl.convoy && this.tab === 'route') this.tab = 'admiral';
      tab('ships', 'Ships'); tab('cargo', 'Cargo'); tab(fl.convoy ? 'route' : 'admiral', fl.convoy ? 'Route' : 'Admiral');
      P.appendChild(tabs);
      const adm = fleetAdmiral(fl);
      if (this.tab === 'ships') {
        const flag = flagshipOf(fl);
        for (const sh of battleOrder(fl)) {
          const st = shipStats(sh), cap = byId('officers', sh.captainId);
          const r = el('div', 'map-ship');
          r.appendChild(el('b', '', sh === flag ? `⚑ ${st.name} (flagship: ${adm && adm.id === campaign.ga ? 'Grand Admiral' : 'Adm.'} ${adm ? adm.name : ''})` : isSupport(sh) ? `${st.name} (support)` : st.name));
          r.appendChild(el('small', '', `${st.clsName} · ${cap ? `${cap.rank === 'grand' ? 'Grand Admiral' : 'Capt.'} ${cap.name} L${cap.level}` : 'no captain'} · hull ${Math.round(shipHealth(sh) * 100)}% · fuel ${Math.round((sh.fuel / st.fuelCap) * 100)}% · ammo ${Math.round(sh.ammo * 100)}%`));
          const btns = el('div', 'map-row');
          if (cap) btns.appendChild(button(`${canLevelUp(cap) || picksOwed(cap) > 0 ? '★ ' : ''}Capt. ${cap.name.split(' ')[1] || cap.name}`, () => openOfficer(cap, fl), 'btn btn-small'));
          if (sh !== flag && !isSupport(sh) && adm) btns.appendChild(button('Fly the flag here', () => { const why = setFlagship(fl, sh); ui.toast(why || `The flag moves to the ${st.name}.`); this.refresh(); }, 'btn btn-small'));
          if (sh !== flag) btns.appendChild(button('Detach', () => { const why = detachShip(fl, sh); ui.toast(why || `${st.name} detached.`); this.refresh(); }, 'btn btn-small'));
          if (!cap) for (const o of campaign.officers.filter((q) => q.alive && q.fleetId === fl.id && q.rank === 'captain' && !q.shipId)) {
            btns.appendChild(button(`Give command to ${o.name}`, () => { const why = assignCaptain(fl, sh, o); if (why) ui.toast(why); this.refresh(); }, 'btn btn-small'));
          }
          if (cap && cap.rank === 'captain' && cap.level >= PROMOTE_LEVEL && fl.docked) {
            const s = byId('settlements', fl.docked);
            if (s && s.faction === campaign.faction) btns.appendChild(button(`Promote to admiral (${RECRUIT.promote * cap.level})`, () => { const why = promote(s, fl, sh); ui.toast(why || `${cap.name} is now an admiral at ${s.name}.`); this.refresh(); }, 'btn btn-small'));
          }
          r.appendChild(btns);
          body.appendChild(r);
        }
        if (!fl.shipIds.length) body.appendChild(el('p', 'card-text', 'No ships.'));
        // Ships left at a field outpost here can rejoin (same domain).
        for (const o of (campaign.outposts || []).filter((q) => q.faction === fl.faction && q.domain === fl.domain && Math.hypot(q.x - fl.x, q.y - fl.y) < 1.5)) {
          for (const sh of campaign.ships.filter((s) => s.outpost === o.id)) body.appendChild(button(`Take ${shipStats(sh).name} from the outpost`, () => { const why = pickUp(fl, sh); ui.toast(why || 'Taken aboard.'); this.refresh(); }, 'btn btn-small'));
        }
        const spare = campaign.officers.filter((o) => o.alive && o.fleetId === fl.id && o.rank === 'captain' && !o.shipId);
        if (spare.length) {
          row('Captains without a ship', spare.map((o) => o.name).join(', '));
          const r = el('div', 'map-row');
          for (const o of spare) r.appendChild(button(`Capt. ${o.name.split(' ')[1] || o.name}`, () => openOfficer(o, fl), 'btn btn-small'));
          body.appendChild(r);
        }
      } else if (this.tab === 'cargo') {
        const f = fleetFuel(fl);
        row('Fuel in tanks and hold', `${f.fuel.toFixed(1)} of ${f.cap.toFixed(1)} units`);
        row('Burn on the move', `${fleetBurn(fl).toFixed(2)} units/h`);
        row('March speed', `${Math.round(fleetSpeed(fl))} km/h`);
        row('Hold', `${holdUsed(fl).toFixed(1)} of ${holdCap(fl).toFixed(0)} units`);
        const inHold = GOODS.filter((k) => fl.hold[k] > 0.05).map((k) => `${GOOD_NAMES[k].toLowerCase()} ${fl.hold[k].toFixed(1)}`).join(' · ');
        if (inHold) row('In the hold', inHold);
        const ra = rearmQuote(fl, null);
        if (ra.fromHold > 0.005) body.appendChild(button(`Rearm ${ra.fromHold.toFixed(2)} from the hold`, () => { const why = rearm(fl, null); if (why) ui.toast(why); else audio.sfx('order'); this.refresh(); }, 'btn btn-small'));
        row('State', fl.stranded ? 'Stranded: no fuel' : fl.path.length ? 'Moving' : fl.docked ? `Docked at ${byId('settlements', fl.docked).name}` : 'Holding');
        if (fl.path.length) body.appendChild(button('Stop here', () => { fl.path = []; fl.dest = null; this.refresh(); }, 'btn btn-small'));
        const w = wreckNear(fl);
        if (w) body.appendChild(button(`Collect salvage (scrap ${w.scrap.toFixed(1)}, parts ${w.items.length})`, () => { const why = collectWreck(fl, w); if (why) ui.toast(why); else audio.sfx('order'); this.refresh(); }, 'btn btn-small'));
        const sf = fieldNear(fl);
        if (sf) row('Scrap field', `${Math.floor(sf.left)} left · ${hasCrane(fl) ? (fl.path.length ? 'gathers when the fleet holds still' : `gathering ${SCRAP_FIELD_RATE}/h`) : 'needs a salvage crane'}`);
        const items = {};
        for (const it of itemsAt(fl.hold)) items[it.p] = (items[it.p] || 0) + 1;
        if (Object.keys(items).length) row('Parts aboard', Object.entries(items).map(([k, n]) => `${PARTS[k].name} ×${n}`).join(', '));
        for (const kind in STOCK_KINDS) {
          const held = Object.entries(stockAt(fl.hold, kind));
          if (held.length) row(`${STOCK_KINDS[kind].noun[0].toUpperCase()}${STOCK_KINDS[kind].noun.slice(1)} in the hold`, held.map(([k, n]) => `${stockName(kind, k)} ×${n}`).join(', '));
        }
        for (const sh of fleetShips(fl)) for (const kind in STOCK_KINDS) { const m = shipStock(sh, kind); if (m) row(`${shipStats(sh).name}: ${STOCK_KINDS[kind].noun}`, `${m.n} of ${m.cap} · ${m.name}`); }
      } else if (this.tab === 'route') {
        this.routeTab(fl, body, row);
      } else {
        const lvl = adm ? adm.level : 1;
        row('Commander', adm ? `${adm.rank === 'grand' ? 'Grand Admiral' : 'Admiral'} ${adm.name}` : '—');
        row('Level', lvl);
        row('XP', adm ? Math.round(adm.xp) : 0);
        { const f = flagshipOf(fl); row('Flagship', f ? `${shipStats(f).name} (${shipStats(f).clsName})` : '—'); }
        { const sup = fl.shipIds.length - fleetCount(fl); row('Fleet size', `${fleetCount(fl)} of ${fleetCap(fl)}${sup ? ` + ${sup} support` : ''}`); }
        if (adm) {
          const docs = traitsOf(adm);
          row('Doctrines', docs.length ? docs.map((t) => t.name).join(', ') : 'none');
          const mixed = fleetShips(fl).filter((s) => shipStats(s).domain !== fl.domain).length;
          if (mixed) row('Combined arms', `${mixed} aircraft with the ${fl.domain} ships`);
          body.appendChild(button(`${canLevelUp(adm) || picksOwed(adm) > 0 ? '★ ' : ''}Open the ${adm.rank === 'grand' ? 'Grand Admiral' : 'admiral'}'s card`, () => openOfficer(adm, fl), 'btn btn-small btn-primary'));
        }
      }
      P.appendChild(body);
      return;
    }
    const s = byId('settlements', this.sel.id);
    const T = SETTLEMENT_TYPES[s.type];
    const own = s.faction === campaign.faction;
    P.appendChild(el('h3', 'map-title', `${s.name}${s.capital ? ' (capital)' : ''}`));
    const tabsHere = [['overview', 'Info'], ['market', 'Market']];
    if (own) tabsHere.push(['warehouse', 'Stores']);
    if (own && hasWorkshop(s)) tabsHere.push(['workshop', 'Workshop'], ['yard', 'Yard']);
    if (own && OFFER_RANK[s.type]) tabsHere.push(['barracks', 'Barracks']);
    if (!tabsHere.some(([id]) => id === this.tab)) this.tab = 'overview';
    for (const [id, label] of tabsHere) tab(id, label);
    P.appendChild(tabs);
    const rel = relation(s.faction, campaign.faction);
    const docked = playerFleets().filter((fl) => fl.docked === s.id && fl.shipIds.length);
    const act = () => { const r = el('div', 'map-row'); body.appendChild(r); return r; };
    const done = (why) => { if (why) ui.toast(why); else audio.sfx('order'); this.refresh(); };
    if (this.tab === 'overview') {
      if (!own && rel !== 'truce') this.siegeButtons(s, body);
      row('Type', T.name + (s.coastal ? ', coastal' : ''));
      row('Owner', s.faction ? factionOf(s.faction).name : 'Neutral');
      row('Relation', { own: 'Yours', war: 'At war', truce: 'Truce', neutral: 'Neutral' }[rel]);
      row('Terrain', MAP_TERRAIN[s.biome].name);
      if (s.faction && !own) row('Reputation', `${repOf(s.faction) > 0 ? '+' : ''}${repOf(s.faction)}`);
      // A neutral village sells its charter (6c): money, and reputation with factions nearby.
      if (!s.faction && s.type === 'village') {
        const near = charterFactions(s);
        row('Charter', `${REL.charterPrice}${near.length ? `; reputation ${REL.charterRep} with ${near.map((f) => factionOf(f).name).join(', ')}` : ''}`);
        const why = charterBlock(s);
        if (why) body.appendChild(el('p', 'card-text map-note', why));
        else act().appendChild(button(`Buy charter: ${REL.charterPrice}`, () => done(buyCharter(s)), 'btn btn-small btn-primary'));
      }
      if (own) row('Money per day', Math.round(settlementMoney(s)));
      if (own && servicesStopped(s)) row('Services', 'Stopped: upkeep unpaid');
      const gar = campaign.ships.filter((sh) => sh.garrison === s.id);
      row('Garrison', `${gar.length} of ${T.garrison}${gar.length ? `: ${gar.map((sh) => shipStats(sh).name).join(', ')}` : ''}`);
      for (const fl of docked) {
        const room = fleetCap(fl) - fleetCount(fl);
        for (const sh of gar.filter((g) => fleetAccepts(fl, mapDomain(designReport(shipDesign(g)).domain)))) {
          if (room > 0) body.appendChild(button(`${fl.name}: take ${shipStats(sh).name}`, () => { const why = pickUp(fl, sh); ui.toast(why || 'Taken aboard.'); this.refresh(); }, 'btn btn-small'));
        }
      }
      if (own && !OFFER_RANK[s.type]) this.barracks(s, body, row, act, done);
      if (own) this.garrisonSection(s, body, row, act, done);
      if (own) this.defences(s, body, row, done);
      if (s.plunder >= campaign.day && own) row('Plunder', `${Math.round(plunderValue(s))} a day until day ${s.plunder}`);
      if (s.restart > campaign.day) row('Production', `restarts on day ${s.restart}`);
      // Upgrades (08 §7): resources from this warehouse, money, days.
      if (own) {
        if (s.upgrade) row('Upgrading', `to ${SETTLEMENT_TYPES[s.upgrade.to].name}, ready on day ${s.upgrade.day}`);
        else for (const u of upgradesFor(s)) {
          body.appendChild(el('div', 'ws-label', `Upgrade to ${SETTLEMENT_TYPES[u.to].name}`));
          row('Needs', `wood ${u.wood} · metal ${u.metal}${u.elec ? ` · electronics ${u.elec}` : ''} · money ${u.money} · ${u.days} days`);
          const why = upgradeBlock(s, u);
          if (why) body.appendChild(el('p', 'card-text map-note', why));
          else act().appendChild(button(`Start: ${SETTLEMENT_TYPES[u.to].name}`, () => done(startUpgrade(s, u)), 'btn btn-small btn-primary'));
        }
      }
    } else if (this.tab === 'market') {
      // Buy into or sell from: this warehouse (yours) or a docked fleet's hold.
      const spots = (own ? [s] : []).concat(docked.filter((fl) => holdCap(fl) > 0));
      let at = spots.find((q) => q.id === this.tradeAt) || spots[0] || null;
      const block = tradeBlock(s, campaign.faction);
      if (block) body.appendChild(el('p', 'card-text map-note', block));
      if (spots.length > 1) {
        const r = act();
        for (const q of spots) r.appendChild(button(q === s ? 'Warehouse' : q.name, () => { this.tradeAt = q.id; this.refresh(); }, 'btn btn-small map-tab' + (q === at ? ' on' : '')));
      }
      if (at) body.appendChild(el('p', 'card-text map-note', `Trading for ${place(at).name} (${place(at).free.toFixed(0)} units free).`));
      for (const good of GOODS) {
        const b = buyPrice(s, good, campaign.faction), sp = sellPrice(s, good, campaign.faction);
        const g = el('div', 'map-good');
        const have = at ? ` · have ${Math.floor(place(at).c[good] || 0)}` : '';
        g.appendChild(el('span', '', `${GOOD_NAMES[good]} (${GOOD_UNITS[good]})`));
        g.appendChild(el('small', '', sp === null ? '—' : `${b === null ? 'buys only' : `buy ${b.toFixed(1)}`} · sell ${sp.toFixed(1)}${b === null ? '' : ` · stock ${Math.floor(s.market[good])}`}${have}`));
        if (at && sp !== null) {
          const r = el('div', 'map-row');
          if (b !== null) r.appendChild(button('Buy 10', () => done(trade(at, s, good, 10)), 'btn btn-small'));
          r.appendChild(button('Sell 10', () => done(trade(at, s, good, -10)), 'btn btn-small'));
          g.appendChild(r);
        }
        body.appendChild(g);
      }
      if (!docked.length) body.appendChild(el('p', 'card-text map-note', 'Dock a fleet here to refuel and rearm: move it onto the settlement (ships to the water beside it).'));
      for (const fl of docked) {
        body.appendChild(el('div', 'ws-label', fl.name));
        const rf = refuelQuote(fl, s), ra = rearmQuote(fl, s);
        const r = act();
        const label = (q, verb, full) => (q.why ? verb : q.units < 0.005 ? full : `${verb} ${q.units.toFixed(q.units < 1 ? 2 : 1)}${q.cost ? ` for ${Math.ceil(q.cost)}` : ' (stores)'}`);
        r.appendChild(button(label(rf, 'Refuel', 'Tanks full'), () => done(refuel(fl, s)), 'btn btn-small'));
        r.appendChild(button(label(ra, 'Rearm', 'Magazines full'), () => done(rearm(fl, s)), 'btn btn-small'));
        // Missiles (5b2): fill the launchers from missiles in stock here.
        for (const kind in STOCK_KINDS) {
          const lo = fleetShips(fl).map((sh) => shipStock(sh, kind)).filter(Boolean);
          if (!lo.length) continue;
          const have = lo.reduce((a, m) => a + m.n, 0), cap = lo.reduce((a, m) => a + m.cap, 0), noun = STOCK_KINDS[kind].noun;
          r.appendChild(button(have >= cap ? `${noun[0].toUpperCase()}${noun.slice(1)} ${have}/${cap}` : `Load ${noun} ${have}/${cap}`, () => done(loadStock(fl, s, kind)), 'btn btn-small'));
        }
      }
    } else if (this.tab === 'barracks') {
      this.barracks(s, body, row, act, done);
    } else if (this.tab === 'workshop') {
      this.workshopTab(s, body, row, act, done);
    } else if (this.tab === 'yard') {
      this.yardTab(s, body, row, act, done);
    } else {
      // Warehouse (01 §8.1): what's here, what it makes, loading docked fleets.
      row('Stored', `${Math.floor(storeUsed(s))} of ${storeCap(s)} units`);
      const make = Object.entries(production(s)).map(([k, v]) => `${GOOD_NAMES[k].toLowerCase()} ${+v.toFixed(1)}`).join(' · ');
      row('Makes per day', s.restart > campaign.day ? `nothing until day ${s.restart}` : make || 'nothing');
      const withHold = docked.filter((fl) => holdCap(fl) > 0);
      let fl = withHold.find((q) => q.id === this.tradeAt) || withHold[0] || null;
      if (withHold.length > 1) {
        const r = act();
        for (const q of withHold) r.appendChild(button(q.name, () => { this.tradeAt = q.id; this.refresh(); }, 'btn btn-small map-tab' + (q === fl ? ' on' : '')));
      }
      if (fl) row(`${fl.name} hold`, `${holdUsed(fl).toFixed(0)} of ${holdCap(fl).toFixed(0)} units`);
      for (const good of GOODS) {
        const g = el('div', 'map-good');
        g.appendChild(el('span', '', GOOD_NAMES[good]));
        g.appendChild(el('small', '', `here ${Math.floor(s.store[good] || 0)}${fl ? ` · hold ${Math.floor(fl.hold[good] || 0)}` : ''}`));
        if (fl) {
          const r = el('div', 'map-row');
          r.appendChild(button('Load 10', () => done(transfer(fl, s, good, 10)), 'btn btn-small'));
          r.appendChild(button('Unload', () => done(transfer(fl, s, good, -1e9)), 'btn btn-small'));
          g.appendChild(r);
        }
        body.appendChild(g);
      }
      const items = {};
      for (const it of itemsAt(s.store)) items[it.p] = (items[it.p] || 0) + 1;
      row('Parts', Object.keys(items).length ? Object.entries(items).map(([k, n]) => `${PARTS[k].name} ×${n}`).join(', ') : 'none');
      for (const kind in STOCK_KINDS) {
        const stock = Object.entries(stockAt(s.store, kind));
        if (stock.length) row(`${STOCK_KINDS[kind].noun[0].toUpperCase()}${STOCK_KINDS[kind].noun.slice(1)}`, stock.map(([k, n]) => `${stockName(kind, k)} ×${n}`).join(', '));
      }
      if (fl) {
        const r = act();
        r.appendChild(button('Load parts', () => done(transferItems(fl, s, 1)), 'btn btn-small'));
        r.appendChild(button('Unload parts', () => done(transferItems(fl, s, -1)), 'btn btn-small'));
      }
      if (!fl) body.appendChild(el('p', 'card-text map-note', docked.length ? 'The docked fleets have no cargo bays.' : 'Dock a fleet with cargo bays here to load or unload.'));
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
    if (contact) { if (contact.contact.siege) this.preSiege(contact.contact); else this.preBattle(contact.contact); }
    this.t = (this.t || 0) + dt;
    // Numbers move only while the clock runs; a stopped map isn't rebuilt under the player's finger.
    if (was !== campaign.running || (campaign.running && this.t > 0.25)) { this.t = 0; this.refresh(); }
  },

  // ---------- gestures
  world: {
    tap(x, y) {
      const S = SCREENS.map;
      const cx = S.toCellX(x), cy = S.toCellY(y);
      const r = 1.2 * Math.max(1, 12 / S.cam.z);
      // What's under the finger: the nearest fleet and the nearest settlement (by screen distance).
      let fl = null, fd = 1e9, s = null, sd = 1e9;
      for (const f of campaign.fleets) {
        if (!f.shipIds.length || !(f.faction === campaign.faction || f.seen)) continue;
        const dx = S.sx(f.x) + (f.drawDx || 0) - x, dy = S.sy(f.y) - y;
        if (Math.abs(dx) < 16 && Math.abs(dy) < 14 && Math.hypot(dx, dy) < fd) { fl = f; fd = Math.hypot(dx, dy); }
      }
      for (const q of world.settlements) {
        const d = Math.hypot(q.x + 0.5 - cx, q.y + 0.5 - cy);
        if (d < r && d * S.cam.z < sd) { s = q; sd = d * S.cam.z; }
      }
      // Both under the finger: the closer one, and a second tap on the same spot switches between them.
      if (fl && s) {
        const cur = S.sel;
        if (cur && cur.kind === 'fleet' && cur.id === fl.id && !(S.plan && S.plan.target === s.id)) { S.plan = null; S.select('settlement', s.id); return; }
        const onSettlement = cur && cur.kind === 'settlement' && cur.id === s.id;
        if (!onSettlement && sd <= fd) fl = null;
      }
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
      if (fl && S.sel && S.sel.kind === 'fleet' && S.sel.id === fl.id) { S.sel = null; S.plan = null; audio.sfx('back'); S.refresh(); return; }   // tap the selected fleet again to deselect
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
    if (this.territoryDirty) { this.terr = renderTerritory(); this.territoryDirty = false; }
    g.drawImage(this.terr, ox, oy, WORLD_W * z, WORLD_H * z);
    // Weather fronts.
    for (const f of campaign.weather || []) {
      g.fillStyle = f.kind === 'storm' || f.kind === 'sandstorm' ? 'rgba(60,64,80,0.2)' : f.kind === 'snow' || f.kind === 'fog' ? 'rgba(235,240,245,0.12)' : 'rgba(120,140,170,0.14)';
      g.beginPath(); g.arc(this.sx(f.x), this.sy(f.y), f.r * z, 0, Math.PI * 2); g.fill();
    }
    // Paths of your fleets and the move preview.
    g.lineWidth = 2;
    for (const fl of playerFleets()) if (fl.path.length) this.drawPath(g, fl.x, fl.y, fl.path, 'rgba(123,196,127,0.8)');
    if (this.plan && this.plan.path && this.selFleet()) this.drawPath(g, this.selFleet().x, this.selFleet().y, this.plan.path, this.plan.strands ? PAL.danger : PAL.amber, this.plan.strands ? [2, 5] : [6, 4]);
    // Settlements.
    for (const s of world.settlements) this.drawSettlement(g, s);
    // Fog of war over what your fleets and settlements can't see.
    // Scrap fields (grey heaps) and battle wreckage (an amber cross, gone after a day).
    for (const f of campaign.scrapFields || []) {
      if (f.left <= 0) continue;
      const x = this.sx(f.x), y = this.sy(f.y);
      g.fillStyle = '#6B6660'; g.fillRect(x - 6, y - 1, 5, 4); g.fillRect(x + 1, y - 2, 5, 5); g.fillStyle = '#9A948A'; g.fillRect(x - 2, y - 5, 5, 5);
    }
    g.strokeStyle = PAL.amber; g.lineWidth = 2;
    for (const w of campaign.wrecks || []) {
      const x = this.sx(w.x), y = this.sy(w.y);
      g.beginPath(); g.moveTo(x - 5, y - 5); g.lineTo(x + 5, y + 5); g.moveTo(x + 5, y - 5); g.lineTo(x - 5, y + 5); g.stroke();
    }
    this.drawFog(g);
    if (this.logistics) this.drawLogistics(g);
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
    g.setLineDash(dashed || []);   // a dash pattern; a stranding plan is dotted (6f)
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
    if (F) drawFactionMark(g, F.id, x - k + 12, y - k * 1.7, 3.5);
    if (this.cam.z >= 5 || s.capital) {
      g.font = `${s.capital ? 700 : 400} ${fontPx(12)}px ${FONT_UI}`;
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
    g.font = `700 ${fontPx(12)}px ${FONT_UI}`; g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillStyle = PAL.linen;
    g.fillText(String(fl.shipIds.length), x + W / 2 - 2, y);
    drawFactionMark(g, fl.faction, x - W / 2, y - H / 2, 3.5);
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
    if (res.win === undefined) { ui.toast(res.summary, 5000); this.refresh(); return; }   // not a battle (a settlement let fall)
    openBattleReport(res, () => this.refresh());   // the report first, then (if it ended) the war's end
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
