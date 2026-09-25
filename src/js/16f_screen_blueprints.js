/* ==== 16f SCREEN: BLUEPRINTS AND MEDALS ==== */
// Captured boss blueprints and medals (design/01 §15). Facts only.

SCREENS.blueprints = {
  root: null,
  enter() { this.build(); },
  exit() { if (this.root) this.root.remove(); this.root = null; },

  build() {
    if (this.root) this.root.remove();
    const p = save.profile;
    const r = el('div', 'workshop blueprints');
    this.root = r;
    const top = el('div', 'ws-top');
    top.appendChild(button('‹ Title', () => screens.go('title'), 'btn btn-small', 'back'));
    top.appendChild(el('h2', 'ws-title', 'Blueprints and medals'));
    r.appendChild(top);
    const body = el('div', 'bp-body');
    body.appendChild(el('div', 'ws-label', 'Captured blueprints'));
    const list = el('div', 'ws-lib bp-list');
    if (!p.blueprints.length) list.appendChild(el('p', 'bp-empty', 'None captured yet. The first boss is at level 10; every 5th level after 15 has another.'));
    for (const b of p.blueprints) {
      const d = TEMPLATES[b.id] ? Object.assign(designFromTemplate(b.id), { family: b.name, mark: 1 }) : null;
      if (!d) continue;
      const st = statsOf(d);
      const guns = d.cells.map((c) => PARTS[c.p]).filter((x) => x.cat === 'weapon' && !x.auto && x.id !== 'smoke').map((x) => x.name).join(', ');
      const card = el('div', 'ws-card ws-libcard bp-card');
      card.appendChild(designThumb(d, 150, 54));
      card.appendChild(el('b', '', b.name));
      card.appendChild(el('small', '', `Captured: level ${b.level} boss`));
      card.appendChild(el('small', '', `${(st.mass / 1000).toFixed(1)} t · ${st.powerToWeight.toFixed(1)} kW/t · ${guns || 'no gun'}`));
      card.appendChild(button('Open in Workshop', () => { SCREENS.designer.returnTo = 'blueprints'; screens.go('designer', { design: d, base: d, owned: true }); }, 'btn btn-small'));
      list.appendChild(card);
    }
    body.appendChild(list);
    body.appendChild(el('div', 'ws-label', `Medals · ${p.medals.length} of ${MEDALS.length}`));
    const medals = el('div', 'bp-medals');
    for (const m of MEDALS) {
      const got = p.medals.includes(m.id);
      const row = el('div', 'bp-medal' + (got ? ' got' : ''));
      row.appendChild(el('span', 'bp-dot', got ? '★' : '·'));
      const t = el('span', 'bp-medal-txt');
      t.appendChild(el('b', '', m.name));
      t.appendChild(el('small', '', m.how));
      row.appendChild(t);
      medals.appendChild(row);
    }
    body.appendChild(medals);
    body.appendChild(el('p', 'bp-empty', `Battles ${p.stats.battles} · levels cleared ${p.stats.cleared} · enemies destroyed ${p.stats.kills}`));
    r.appendChild(body);
    uiLayer.insertBefore(r, ui.toastBox);
  },

  update() {},
  render(g) { SCREENS.workshop.render(g); },
};
