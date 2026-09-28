/* ==== 16i MAP: WORKSHOP AND YARD TABS ==== */
// The settlement panel's Workshop and Yard tabs (design/02 §4.4), built on 15a_workshop.

const hoursText = (h) => (h < 24 ? `${Math.max(1, Math.round(h))} h` : `${(h / 24).toFixed(1)} days`);

function jobList(body, q, label) {
  if (!q || !q.length) { body.appendChild(el('p', 'card-text map-note', `${label}: idle.`)); return; }
  body.appendChild(el('div', 'ws-label', label));
  q.forEach((j, i) => {
    const g = el('div', 'map-good');
    g.appendChild(el('span', '', jobName(j)));
    g.appendChild(el('small', '', i === 0 ? `${hoursText(j.left)} left` : `waiting · ${hoursText(j.hours)}`));
    body.appendChild(g);
  });
}

// Where the goods for this settlement's work come from.
function onHandText(s) {
  const fleets = dockedHere(s).filter((fl) => holdUsed(fl) > 0.05);
  return `On hand: ${['wood', 'metal', 'elec', 'scrap'].map((g) => `${GOOD_NAMES[g].toLowerCase()} ${Math.floor(onHand(s, g))}`).join(' · ')}` +
    ` (warehouse${fleets.length ? ` and ${fleets.map((fl) => fl.name).join(', ')}` : ''}).`;
}

Object.assign(SCREENS.map, {
  workshopTab(s, body, row, act, done) {
    const block = servicesBlock(s);
    if (block) body.appendChild(el('p', 'card-text map-note', block));
    jobList(body, s.queue, 'Workshop queue');
    body.appendChild(el('p', 'card-text map-note', onHandText(s)));
    // Refinery: scrap → electronics.
    const R = refineRate(s);
    if (R) {
      body.appendChild(el('div', 'ws-label', 'Refinery'));
      const g = el('div', 'map-good');
      g.appendChild(el('span', '', `${R.scrap} scrap → 1 electronics`));
      g.appendChild(el('small', '', `${hoursText(R.hours)} each`));
      const r = el('div', 'map-row');
      r.appendChild(button('×1', () => done(refine(s, 1)), 'btn btn-small'));
      r.appendChild(button('×5', () => done(refine(s, 5)), 'btn btn-small'));
      g.appendChild(r);
      body.appendChild(g);
    }
    // Craft parts: output goes to the warehouse as items.
    body.appendChild(el('div', 'ws-label', 'Craft parts'));
    const ids = Object.keys(PART_LIBRARY.parts).filter((id) => PARTS[id] && craftableAt(s, id) && partUnlocked(id));
    ids.sort((a, b) => (PARTS[a].cat < PARTS[b].cat ? -1 : PARTS[a].cat > PARTS[b].cat ? 1 : PARTS[a].tier - PARTS[b].tier));
    for (const id of ids) {
      const q = craftQuote(s, id), n = itemCount(s, id);
      const g = el('div', 'map-good');
      g.appendChild(el('span', '', `${PARTS[id].name}${n ? ` (${n} in stock)` : ''}`));
      g.appendChild(el('small', '', `${costText(q.cost)} · ${hoursText(q.hours)}`));
      const r = el('div', 'map-row');
      r.appendChild(button('Craft', () => done(craft(s, id)), 'btn btn-small'));
      g.appendChild(r);
      body.appendChild(g);
    }
    // Missiles (5b2): crafted from their parts' goods at a metropolis; they go to the warehouse.
    if (s.type === 'metropolis') {
      const list = missileDesigns().filter((md) => !validateMissile(md).length && missileCells(md).every((c) => partUnlocked(c.p)));
      if (list.length) body.appendChild(el('div', 'ws-label', 'Craft missiles'));
      for (const md of list) {
        const q = missileQuote(s, md, 1), n = missilesOnHand(s, md.id);
        const g = el('div', 'map-good');
        g.appendChild(el('span', '', `${md.name}${n ? ` (${n} in stock)` : ''}`));
        g.appendChild(el('small', '', `each: ${costText(q.cost)} · ${hoursText(q.hours)}`));
        const r = el('div', 'map-row');
        r.appendChild(button('×1', () => done(craftMissiles(s, md.id, 1)), 'btn btn-small'));
        r.appendChild(button('×4', () => done(craftMissiles(s, md.id, 4)), 'btn btn-small'));
        g.appendChild(r);
        body.appendChild(g);
      }
      const locked = missileDesigns().length - list.length;
      if (locked) body.appendChild(el('p', 'card-text map-note', `${locked} missile designs need research.`));
    }
    // Reverse-engineering (08 §4): salvaged enemy parts studied at a metropolis.
    if (s.type === 'metropolis') {
      const spots = [s.store].concat(dockedHere(s).map((fl) => fl.hold));
      const seen = new Set();
      for (const it of spots.flatMap((c) => itemsAt(c))) {
        if (!it.salvaged || seen.has(it.p) || partUnlocked(studyTarget(it.p))) continue;
        seen.add(it.p);
        if (seen.size === 1) body.appendChild(el('div', 'ws-label', 'Reverse-engineer'));
        const g = el('div', 'map-good');
        g.appendChild(el('span', '', PARTS[it.p].name));
        g.appendChild(el('small', '', `money ${Math.ceil(studyPrice(it.p))} · ${STUDY_DAYS} days · uses the item`));
        const r = el('div', 'map-row');
        r.appendChild(button('Study', () => done(study(s, it)), 'btn btn-small'));
        g.appendChild(r);
        body.appendChild(g);
      }
    }
    const locked = Object.keys(PART_LIBRARY.parts).filter((id) => PARTS[id] && craftableAt(s, id) && !partUnlocked(id)).length;
    if (locked) body.appendChild(el('p', 'card-text map-note', `${locked} more parts need research.`));
  },

  yardTab(s, body, row, act, done) {
    const block = servicesBlock(s);
    if (block) body.appendChild(el('p', 'card-text map-note', block));
    jobList(body, s.yard, 'Yard queue');
    body.appendChild(el('p', 'card-text map-note', onHandText(s)));
    const docked = dockedHere(s);
    // Dock repair and refits for the fleets here.
    for (const fl of docked) {
      body.appendChild(el('div', 'ws-label', fl.name));
      const q = repairQuote(s, fl);
      if (q.hours > 0.001) {
        const g = el('div', 'map-good');
        g.appendChild(el('span', '', 'Repair every ship'));
        g.appendChild(el('small', '', `${costText(q.cost)} · ${hoursText(q.hours)}`));
        const r = el('div', 'map-row');
        r.appendChild(button('Repair', () => done(repairFleet(s, fl)), 'btn btn-small'));
        g.appendChild(r);
        body.appendChild(g);
      } else body.appendChild(el('p', 'card-text map-note', 'No damage to repair.'));
      for (const sh of fleetShips(fl)) {
        const g = el('div', 'map-good');
        g.appendChild(el('span', '', shipStats(sh).name));
        g.appendChild(el('small', '', this.refitShip === sh.id ? 'Choose the new design below.' : `${shipStats(sh).clsName}`));
        const r = el('div', 'map-row');
        r.appendChild(button(this.refitShip === sh.id ? 'Cancel' : 'Refit', () => { this.refitShip = this.refitShip === sh.id ? null : sh.id; this.refresh(); }, 'btn btn-small'));
        g.appendChild(r);
        body.appendChild(g);
        if (this.refitShip !== sh.id) continue;
        for (const id of yardDesigns(s)) {
          const d = shipDesign({ design: id });
          if (id === sh.design || mapDomain(designReport(d).domain) !== fl.domain) continue;
          const rq = refitQuote(s, sh, id);
          const o = el('div', 'map-good');
          o.appendChild(el('span', '', `→ ${markName(d)}`));
          o.appendChild(el('small', '', `${costText(rq.cost)} · ${hoursText(rq.hours)}`));
          const rr = el('div', 'map-row');
          rr.appendChild(button('Refit', () => { this.refitShip = null; done(refitShip(s, fl, sh, id)); }, 'btn btn-small'));
          o.appendChild(rr);
          body.appendChild(o);
        }
      }
    }
    if (!docked.length) body.appendChild(el('p', 'card-text map-note', 'Dock a fleet here to repair or refit it.'));
    // Build ships: they join this settlement's garrison with a new level-1 captain.
    body.appendChild(el('div', 'ws-label', 'Build a ship'));
    body.appendChild(el('p', 'card-text map-note', `New ships wait in the garrison with a new captain (${RECRUIT.captain} included). Parts in stock are used first.`));
    for (const id of yardDesigns(s)) {
      const d = shipDesign({ design: id });
      const q = buildQuote(s, d);
      const cls = classFor(d);
      const g = el('div', 'map-good');
      g.appendChild(el('span', '', `${markName(d)} (${cls.name})`));
      g.appendChild(el('small', '', `${costText(q.cost)} · ${hoursText(q.hours)}`));
      const r = el('div', 'map-row');
      r.appendChild(button('Build', () => done(buildShip(s, id)), 'btn btn-small'));
      g.appendChild(r);
      body.appendChild(g);
    }
  },
});

Object.assign(SCREENS.map, {
  // Barracks (02 §4.4): officers for hire, officers waiting here, forming a fleet.
  barracks(s, body, row, act, done) {
    const offers = offersAt(s);
    if (offers.length) body.appendChild(el('div', 'ws-label', 'For hire'));
    for (const o of offers) {
      const g = el('div', 'map-good');
      const what = o.kind === 'captain' ? `Capt. ${o.name} L${o.level} with a ${markName(shipDesign({ design: o.design }))}` : o.kind === 'admiral' ? `Adm. ${o.name} L${o.level}` : `Quartermaster ${o.name}`;
      g.appendChild(el('span', '', what));
      g.appendChild(el('small', '', `money ${Math.ceil(offerPrice(o))} · wages ${o.kind === 'quartermaster' ? WAGES.quartermaster : WAGES[o.kind] * o.level}/day`));
      const r = el('div', 'map-row');
      r.appendChild(button('Hire', () => done(hire(s, o)), 'btn btn-small'));
      g.appendChild(r);
      body.appendChild(g);
    }
    const here = ['admiral', 'quartermaster', 'captain'].flatMap((rank) => idleAt(s, rank));
    if (here.length) row('Officers here', here.map((o) => `${o.rank === 'admiral' ? 'Adm.' : o.rank === 'captain' ? 'Capt.' : 'QM'} ${o.name}`).join(', '));
    const gar = campaign.ships.filter((sh) => sh.garrison === s.id);
    const domains = [...new Set(gar.map((sh) => shipStats(sh).domain))];
    for (const a of idleAt(s, 'admiral')) for (const dom of domains) {
      act().appendChild(button(`Adm. ${a.name}: form a ${dom} fleet`, () => done(formFleet(s, a, dom)), 'btn btn-small'));
    }
    for (const q of idleAt(s, 'quartermaster')) for (const dom of domains) {
      act().appendChild(button(`QM ${q.name}: form a ${dom} convoy`, () => done(formConvoy(s, q, dom)), 'btn btn-small'));
    }
    if ((idleAt(s, 'admiral').length || idleAt(s, 'quartermaster').length) && !domains.length) body.appendChild(el('p', 'card-text map-note', 'Officers here can form a fleet or a convoy from ships in the garrison.'));
  },
});

// Designs this yard can build: the templates and your saved designs.
function yardDesigns(s) {
  const ids = Object.keys(TEMPLATES).concat(save.designs.list.map((d) => d.id));
  return ids.filter((id) => !yardBlock(s, shipDesign({ design: id })));
}
