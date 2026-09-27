/* ==== 16j MAP: CONVOY ROUTES AND THE LOGISTICS VIEW ==== */
// The convoy Route tab and the Supply layer of the world map (design/02 §5).

// A fleet's average ammo share.
function fleetAmmo(fl) {
  const ships = fleetShips(fl);
  return ships.length ? ships.reduce((a, sh) => a + sh.ammo, 0) / ships.length : 0;
}

Object.assign(SCREENS.map, {
  routeTab(fl, body, row) {
    const done = (why, ok) => { if (why) ui.toast(why); else { audio.sfx('order'); if (ok) ui.toast(ok); } this.refresh(); };
    row('Standing route', routeText(fl));
    if (fl.route) body.appendChild(button('Stop the route', () => { stopRoute(fl); done(''); }, 'btn btn-small'));
    // Setting up a route: where to load, where to deliver, which goods.
    const own = world.settlements.filter((s) => s.faction === campaign.faction).sort((a, b) => Math.hypot(a.x - fl.x, a.y - fl.y) - Math.hypot(b.x - fl.x, b.y - fl.y));
    if (!this.rt || this.rt.fleet !== fl.id) {
      const r = fl.route;
      this.rt = { fleet: fl.id, a: r ? r.a : (fl.docked && own.some((s) => s.id === fl.docked) ? fl.docked : own[0] && own[0].id), b: r ? (r.fleet ? { fleet: r.fleet } : { settlement: r.b }) : null, goods: r ? r.goods.slice() : ['fuel', 'ammo'], pick: null };
    }
    const rt = this.rt;
    body.appendChild(el('div', 'ws-label', fl.route ? 'Change the route' : 'Set a route'));
    const A = byId('settlements', rt.a);
    const B = rt.b ? (rt.b.fleet ? byId('fleets', rt.b.fleet) : byId('settlements', rt.b.settlement)) : null;
    const choice = (label, value, which) => {
      const g = el('div', 'map-good');
      g.appendChild(el('span', '', label));
      g.appendChild(el('small', '', value));
      const r = el('div', 'map-row');
      r.appendChild(button(rt.pick === which ? 'Close' : 'Change', () => { rt.pick = rt.pick === which ? null : which; this.refresh(); }, 'btn btn-small'));
      g.appendChild(r);
      body.appendChild(g);
    };
    const list = (items) => {
      const r = el('div', 'map-row');
      for (const [name, pickIt] of items) r.appendChild(button(name, () => { pickIt(); rt.pick = null; this.refresh(); }, 'btn btn-small'));
      body.appendChild(r);
    };
    choice('Load at', A ? A.name : 'choose', 'a');
    if (rt.pick === 'a') list(own.map((s) => [s.name, () => { rt.a = s.id; }]));
    choice('Deliver to', B ? B.name : 'choose', 'b');
    if (rt.pick === 'b') {
      const fleets = playerFleets().filter((q) => q !== fl && !q.convoy && q.shipIds.length && q.domain === fl.domain);
      list(own.filter((s) => s.id !== rt.a).map((s) => [s.name, () => { rt.b = { settlement: s.id }; }]).concat(fleets.map((q) => [q.name, () => { rt.b = { fleet: q.id }; }])));
    }
    const chips = el('div', 'map-row');
    for (const g of GOODS) {
      chips.appendChild(button(GOOD_NAMES[g], () => { rt.goods = rt.goods.includes(g) ? rt.goods.filter((x) => x !== g) : rt.goods.concat(g); this.refresh(); }, 'btn btn-small map-tab' + (rt.goods.includes(g) ? ' on' : '')));
    }
    body.appendChild(chips);
    body.appendChild(el('p', 'card-text map-note', `The hold (${holdCap(fl).toFixed(0)} units) is shared between the chosen goods. Carried fuel also feeds the convoy's own engines.`));
    body.appendChild(button(fl.route ? 'Use this route' : 'Start the route', () => done(setRoute(fl, rt.a, rt.b, rt.goods), 'The route is running; start the clock.'), 'btn btn-small btn-primary'));
  },

  // The Supply layer: routes, warehouse stock, and under each of your fleets its ammo bar and
  // days of fuel on the march.
  drawLogistics(g) {
    g.save();
    g.lineWidth = 2;
    g.setLineDash([6, 4]);
    g.strokeStyle = PAL.amber;
    g.fillStyle = PAL.amber;
    for (const fl of playerFleets()) {
      const r = fl.route;
      if (!r) continue;
      const A = byId('settlements', r.a), T = routeTarget(r);
      if (!A || !T) continue;
      const x0 = this.sx(A.x + 0.5), y0 = this.sy(A.y + 0.5), x1 = this.sx(T.shipIds ? T.x : T.x + 0.5), y1 = this.sy(T.shipIds ? T.y : T.y + 0.5);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      const a = Math.atan2(y1 - y0, x1 - x0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      g.beginPath(); g.moveTo(mx + Math.cos(a) * 8, my + Math.sin(a) * 8);
      g.lineTo(mx + Math.cos(a + 2.5) * 8, my + Math.sin(a + 2.5) * 8); g.lineTo(mx + Math.cos(a - 2.5) * 8, my + Math.sin(a - 2.5) * 8); g.fill();
    }
    g.setLineDash([]);
    // Warehouse stock: a bar under each of your settlements.
    for (const s of world.settlements) {
      if (s.faction !== campaign.faction) continue;
      const x = this.sx(s.x + 0.5) - 14, y = this.sy(s.y + 0.5) + 20;
      g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(x, y, 28, 4);
      g.fillStyle = PAL.linen; g.fillRect(x, y, 28 * clamp(storeUsed(s) / storeCap(s), 0, 1), 4);
    }
    // Fleets: fuel in days of marching, ammo share; amber when low, red when stranded.
    g.font = `600 10px ${FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'top';
    for (const fl of playerFleets()) {
      if (!fl.shipIds.length) continue;
      const f = fleetFuel(fl), burn = fleetBurn(fl), am = fleetAmmo(fl);
      const days = burn > 0 ? f.fuel / (burn * 24) : Infinity;
      const low = f.cap && (f.fuel / f.cap < LOW_FUEL || am < 0.25);
      const x = this.sx(fl.x) + (fl.drawDx || 0), y = this.sy(fl.y);
      if (fl.stranded || f.fuel <= 0 || low) {
        g.strokeStyle = fl.stranded || f.fuel <= 0 ? PAL.danger : PAL.warning; g.lineWidth = 3;
        g.beginPath(); g.arc(x, y, 20, 0, Math.PI * 2); g.stroke();
      }
      // Under the counter's fuel bar: an ammo bar, then days of fuel on the march.
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 13, y + 14, 26, 3);
      g.fillStyle = am < 0.25 ? PAL.warning : PAL.linen; g.fillRect(x - 13, y + 14, 26 * clamp(am, 0, 1), 3);
      const txt = Number.isFinite(days) ? `${days < 10 ? days.toFixed(1) : Math.round(days)}d` : '—';
      g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x - 13, y + 18, 26, 12);
      g.fillStyle = PAL.linen; g.fillText(txt, x, y + 18);
    }
    g.restore();
  },
});
