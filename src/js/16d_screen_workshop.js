/* ==== 16d SCREEN: WORKSHOP ==== */
// Between ladder levels (design/01 §14.4, §8.6): choose the squad of 3 within the
// level budget, open designs in the Drafting Office, then start the next level.

// Everything the player can field: starting templates, saved designs, captured blueprints.
function designLibrary() {
  const out = [];
  for (const id of ['medium', 'light', 'scout', 'assault', 'truck']) out.push({ id, src: 'Starting template', design: Object.assign(designFromTemplate(id), { family: TEMPLATES[id].name, mark: 1 }) });
  for (const d of save.designs.list) out.push({ id: d.id, src: 'Your design', design: JSON.parse(JSON.stringify(d)) });
  for (const b of save.profile.blueprints) if (TEMPLATES[b.id] && !out.some((o) => o.id === b.id)) out.push({ id: b.id, src: `Blueprint · level ${b.level}`, design: Object.assign(designFromTemplate(b.id), { family: b.name, mark: 1 }) });
  return out;
}

SCREENS.workshop = {
  root: null,
  slot: 0,

  enter() {
    if (!save.profile.squad.length) save.profile.squad = ['medium', 'light', 'scout'];
    this.slot = 0;
    this.build();
    audio.playTheme('title');
  },

  exit() { if (this.root) this.root.remove(); this.root = null; },

  level() { const r = save.profile.run; return r.active ? r.level : save.profile.continueLevel; },

  build() {
    if (this.root) this.root.remove();
    const p = save.profile;
    const lib = designLibrary();
    const find = (id) => lib.find((o) => o.id === id);
    const level = this.level();
    const budget = levelConfig(level).budget;
    const squad = p.squad.map((id) => find(id) || find('light'));
    const used = squad.reduce((s, o) => s + costOf(o.design), 0);

    const r = el('div', 'workshop');
    this.root = r;
    const top = el('div', 'ws-top');
    top.appendChild(button('‹ Title', () => screens.go('title'), 'btn btn-small', 'back'));
    top.appendChild(el('h2', 'ws-title', 'Workshop'));
    top.appendChild(el('span', 'ws-fact', `Requisition ${p.requisition}`));
    top.appendChild(el('span', 'ws-fact' + (used > budget ? ' bad' : ''), `Level ${level} budget: ${used} of ${budget}`));
    r.appendChild(top);

    // Squad slots.
    const slots = el('div', 'ws-slots');
    squad.forEach((o, i) => {
      const card = el('button', 'ws-card ws-slot' + (i === this.slot ? ' on' : ''));
      card.type = 'button';
      card.appendChild(el('span', 'ws-num', String(i + 1)));
      card.appendChild(designThumb(o.design, 120, 44));
      card.appendChild(el('b', '', markName(o.design)));
      const st = statsOf(o.design);
      card.appendChild(el('small', '', `${(st.mass / 1000).toFixed(1)} t · ${st.powerToWeight.toFixed(1)} kW/t · cost ${costOf(o.design)}`));
      card.addEventListener('click', () => { audio.sfx('tap'); this.slot = i; this.build(); });
      slots.appendChild(card);
    });
    r.appendChild(slots);

    // Library: tap to put into the selected slot; Edit opens the Drafting Office.
    r.appendChild(el('div', 'ws-label', `Designs · tap one to put it in slot ${this.slot + 1}`));
    const list = el('div', 'ws-lib');
    for (const o of lib) {
      const card = el('div', 'ws-card ws-libcard');
      const pick = el('button', 'ws-pick');
      pick.type = 'button';
      pick.appendChild(designThumb(o.design, 104, 38));
      pick.appendChild(el('b', '', markName(o.design)));
      pick.appendChild(el('small', '', `${o.src} · cost ${costOf(o.design)}`));
      pick.addEventListener('click', () => {
        audio.sfx('order');
        p.squad[this.slot] = o.id;
        save.touch('profile');
        this.slot = (this.slot + 1) % 3;
        this.build();
      });
      card.appendChild(pick);
      card.appendChild(button('Edit', () => this.edit(o), 'btn btn-small ws-edit'));
      list.appendChild(card);
    }
    r.appendChild(list);

    const bottom = el('div', 'ws-bottom');
    bottom.appendChild(button('New design', () => { SCREENS.designer.returnTo = 'workshop'; screens.go('designer'); }, 'btn btn-small'));
    const go = button(`Start level ${level}`, () => {
      if (used > budget) { audio.sfx('error'); ui.toast(`The squad costs ${used}; level ${level} allows ${budget}.`); return; }
      ladder.resume();
    }, 'btn btn-primary');
    if (used > budget) go.classList.add('btn-disabled');
    bottom.appendChild(go);
    r.appendChild(bottom);
    uiLayer.insertBefore(r, ui.toastBox);
  },

  edit(o) {
    SCREENS.designer.returnTo = 'workshop';
    screens.go('designer', { design: o.design, base: o.design, owned: true });
  },

  update() {},

  render(g) {
    const { w, h } = layout;
    g.fillStyle = BLUEPRINT.bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(42,106,146,0.6)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x < w; x += 24) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); }
    for (let y = 0; y < h; y += 24) { g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); }
    g.stroke();
  },
};
