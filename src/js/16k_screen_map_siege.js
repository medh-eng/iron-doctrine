/* ==== 16k MAP: SIEGES ==== */
// The siege card, the "Lay siege" order and the Defences section of your settlements
// (design/01 §11; design/02 §4.4 Walls).

Object.assign(SCREENS.map, {
  preSiege(contact) {
    const s = byId('settlements', contact.siege), fl = byId('fleets', contact.fleet);
    if (!s || !fl) return;
    const defend = s.faction === campaign.faction;
    const sides = siegeSides(s, fl);
    const T = SETTLEMENT_TYPES[s.type];
    siegeState(s);
    const c = ui.card(defend ? `${s.name} under siege` : `Siege of ${s.name}`, 'card-prebattle');
    const facts = el('div', 'result-facts');
    const row = (k, v) => { const r = el('div', 'fact'); r.appendChild(el('span', '', k)); r.appendChild(el('b', '', String(v))); facts.appendChild(r); };
    row('Battlefield', `${SIM_FIELDS[sides.place.field]} · ${sides.place.weather}`);
    row('Walls', T.walls ? `${T.walls} HP, ${T.armor} mm · at ${Math.round(s.wallHp * 100)}% · keep ${Math.round(s.keepHp * 100)}%` : 'none');
    row('Emplacements', s.emplace.filter(Boolean).map((p) => PARTS[p].name).join(', ') || 'none');
    row('Defenders', [...sides.defShips.map((sh) => shipStats(sh).clsName), ...militiaDesigns(s).map((d) => d.name)].join(', ') || 'none');
    row('Attackers', sides.atkShips.map((sh) => (defend ? shipStats(sh).clsName : shipStats(sh).name)).join(', ') || 'none');
    c.appendChild(facts);
    const btns = el('div', 'card-row');
    let close = null;
    if (defend) btns.appendChild(button('Let it fall', () => { close(); this.afterBattle({ summary: captureSettlement(s, fl.faction) }); }, 'btn', 'back'));
    else btns.appendChild(button('Not now', () => close(), 'btn', 'back'));
    btns.appendChild(button('Auto-resolve', () => { close(); this.afterBattle(autoResolveSiege(contact)); }));
    btns.appendChild(button('Fight', () => { close(); screens.go('battle', { campaign: contact }); }, 'btn btn-primary'));
    c.appendChild(btns);
    close = ui.open(c);
  },

  // Your fleets that can lay siege to s, with a button each; or why none can.
  siegeButtons(s, body) {
    const fleets = playerFleets().filter((fl) => fl.shipIds.length && !siegeBlock(fl, s));
    if (!fleets.length) {
      const why = siegeBlock(this.selFleet() || playerFleets().find((fl) => fl.shipIds.length && !fl.convoy), s);
      body.appendChild(el('p', 'card-text map-note', `Siege: ${why || 'no fleet ready.'}`));
      return;
    }
    const r = el('div', 'map-row');
    for (const fl of fleets) r.appendChild(button(`Lay siege: ${fl.name}`, () => this.preSiege({ siege: s.id, fleet: fl.id }), 'btn btn-small btn-primary'));
    body.appendChild(r);
  },

  // Walls, keep and emplacement slots; weapon parts from the warehouse go in the slots.
  defences(s, body, row, done) {
    const T = SETTLEMENT_TYPES[s.type];
    siegeState(s);
    body.appendChild(el('div', 'ws-label', 'Defences'));
    row('Walls', T.walls ? `${T.walls} HP, ${T.armor} mm · ${Math.round(s.wallHp * 100)}% · keep ${Math.round(s.keepHp * 100)}%` : 'none');
    row('Militia', `${T.militia}`);
    const stock = [...new Set(itemsAt(s.store).map((it) => it.p).filter(emplaceable))];
    s.emplace.forEach((p, k) => {
      const g = el('div', 'map-good');
      g.appendChild(el('span', '', `Slot ${k + 1}: ${p ? PARTS[p].name : 'empty'}`));
      g.appendChild(el('small', '', stock.length ? 'Install from the warehouse:' : 'Craft or bring a gun to install.'));
      const r = el('div', 'map-row');
      for (const id of stock.slice(0, 3)) if (id !== p) r.appendChild(button(PARTS[id].name, () => done(installEmplacement(s, k, id)), 'btn btn-small'));
      if (p) r.appendChild(button('Remove', () => done(installEmplacement(s, k, null)), 'btn btn-small'));
      g.appendChild(r);
      body.appendChild(g);
    });
  },
});
