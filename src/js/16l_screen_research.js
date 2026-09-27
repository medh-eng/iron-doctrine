/* ==== 16l SCREEN: RESEARCH ==== */
// Tech tree and perks (design/02 §7; design/08 §11–§12), opened from the world map. Branches run
// down the page, tiers left to right; each node shows its parts, cost and where it can be
// researched. Numbers and facts only: no advice on what to pick.

SCREENS.research = {
  root: null,
  tab: 'tech',

  enter() { this.build(); },
  exit() { if (this.root) this.root.remove(); this.root = null; },

  build() {
    const keep = this.root ? this.root.scrollTop : 0;
    if (this.root) this.root.remove();
    const r = el('div', 'workshop sim research');
    this.root = r;
    const ga = gaOfficer();
    const top = el('div', 'ws-top');
    top.appendChild(button('‹ Map', () => screens.go('map'), 'btn btn-small', 'back'));
    top.appendChild(el('h2', 'ws-title', 'Research'));
    const next = ga && ga.level < 30 ? Math.round(150 * Math.pow(ga.level, 1.7)) : null;
    top.appendChild(el('span', 'ws-fact', `Grand Admiral L${ga ? ga.level : 1}${next ? ` · XP ${Math.round(ga.xp)}/${next}` : ''} · Command Points ${cpFree()} of ${cpEarned()}`));
    r.appendChild(top);
    const tabs = el('div', 'sim-row');
    for (const [id, label] of [['tech', 'Tech tree'], ['perks', 'Perks']]) {
      tabs.appendChild(button(label, () => { this.tab = id; audio.sfx('tap'); this.build(); }, 'btn btn-small sim-chip' + (this.tab === id ? ' on' : '')));
    }
    r.appendChild(tabs);
    if (this.tab === 'tech') this.techList(r); else this.perkList(r);
    uiLayer.appendChild(r);
    r.scrollTop = keep;
  },

  done(why, ok) { if (why) ui.toast(why); else { audio.sfx('order'); if (ok) ui.toast(ok); } this.build(); },

  techList(r) {
    // Research in progress.
    const jobs = world.settlements.flatMap((s) => (s.queue || []).filter((j) => j.kind === 'research').map((j) => `${TECH[j.node].name} at ${s.name} (${hoursText(j.left)} left${s.queue[0] === j ? '' : ', queued'})`));
    if (jobs.length) r.appendChild(el('p', 'card-text', `Researching: ${jobs.join('; ')}.`));
    for (const [branch, nodes] of Object.entries(TECH_BRANCH)) {
      r.appendChild(el('div', 'ws-label', branch));
      const row = el('div', 'sim-row research-row');
      for (const id of nodes.slice().sort((a, b) => TECH[a].tier - TECH[b].tier)) row.appendChild(this.nodeCard(id));
      r.appendChild(row);
    }
  },

  nodeCard(id) {
    const T = TECH[id], C = TECH_COST[T.tier];
    const st = techState(id);
    const c = el('div', `research-node ${st}`);
    c.appendChild(el('b', '', `T${T.tier} · ${T.name}`));
    const parts = techParts(id).map((p) => PARTS[p].name);
    c.appendChild(el('small', '', parts.length ? parts.join(', ') : 'No parts in the game yet'));
    if (T.pre.length) c.appendChild(el('small', '', `After: ${T.pre.map((p) => TECH[p].name).join(' + ')}`));
    const label = { known: 'Known', researching: 'Being researched', open: '', locked: 'Locked' }[st];
    if (st !== 'open') { c.appendChild(el('small', 'research-state', label)); return c; }
    c.appendChild(el('small', '', `${C.cp} CP · money ${C.money}${C.elec ? ` · electronics ${C.elec}` : ''}${C.scrap ? ` · scrap ${C.scrap}` : ''} · ${C.days} days · ${C.at === 'metropolis' ? 'metropolis' : 'city+'}`));
    const s = researchSite(id);
    const why = researchBlock(id, s);
    if (why) c.appendChild(el('small', 'research-state', why));
    else c.appendChild(button(`Research at ${s.name}`, () => this.done(research(id, s), `${T.name}: research started at ${s.name}.`), 'btn btn-small btn-primary'));
    return c;
  },

  perkList(r) {
    let group = null, row = null;
    for (const P of Object.values(PERK)) {
      if (P.group !== group) { group = P.group; r.appendChild(el('div', 'ws-label', group)); row = el('div', 'sim-row research-row'); r.appendChild(row); }
      const has = hasPerk(P.id);
      const c = el('div', `research-node ${has ? 'known' : 'open'}`);
      c.appendChild(el('b', '', P.name));
      c.appendChild(el('small', '', P.text));
      c.appendChild(el('small', '', `${P.cp} CP`));
      if (has) c.appendChild(el('small', 'research-state', 'Taken'));
      else {
        const why = perkBlock(P.id);
        if (why) c.appendChild(el('small', 'research-state', why));
        else c.appendChild(button('Take', () => this.done(takePerk(P.id)), 'btn btn-small btn-primary'));
      }
      row.appendChild(c);
    }
  },
};
