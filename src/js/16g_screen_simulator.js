/* ==== 16g SCREEN: BATTLE SIMULATOR ==== */
// The Battle Simulator (design/01 §15, design/06 step 2.6): pick your line-up (any number;
// three fight at a time, the rest wait in reserve in this order), a battlefield, weather and
// time of day, and the enemy force; then fight. No campaign effects: the result card shows
// facts only. Choices are remembered in save.profile.sim.

const SIM_SIZE_MAX = 9;

SCREENS.simulator = {
  root: null,

  enter() {
    this.build();
    audio.playTheme('title');
  },

  exit() { if (this.root) this.root.remove(); this.root = null; },

  opts() { return save.profile.sim; },

  // Enemy templates the player can pick (fixed positions such as bunkers are left out).
  enemyChoices() { return Object.keys(TEMPLATES).filter((id) => !TEMPLATES[id].fixed); },

  // The battle's inputs, read when the battle starts (and again on "Fight again").
  battleArg() {
    const o = this.opts();
    const lib = designLibrary();
    return {
      sim: {
        field: o.field, weather: o.weather, light: o.light, seed: (Date.now() & 0xffff) + 1,
        squad: () => o.lineup.map((id) => lib.find((d) => d.id === id)).filter(Boolean).map((d) => JSON.parse(JSON.stringify(d.design))),
        enemy: () => {
          const pool = o.enemy.length ? o.enemy : SIM_MIXED[o.field] || SIM_MIXED.inland;
          const n = o.enemy.length ? o.enemy.length : o.size;
          const out = [];
          for (let i = 0; i < n; i++) out.push(designFromTemplate(pool[i % pool.length]));
          return out;
        },
      },
    };
  },

  build() {
    if (this.root) this.root.remove();
    const o = this.opts();
    const lib = designLibrary();
    const find = (id) => lib.find((d) => d.id === id);
    o.lineup = o.lineup.filter((id) => find(id));
    const set = (k, v) => { o[k] = v; save.touch('profile'); audio.sfx('tap'); this.build(); };

    const r = el('div', 'workshop sim');
    this.root = r;
    const top = el('div', 'ws-top');
    top.appendChild(button('‹ Title', () => screens.go('title'), 'btn btn-small', 'back'));
    top.appendChild(el('h2', 'ws-title', 'Battle Simulator'));
    top.appendChild(el('span', 'ws-fact', 'No campaign effects'));
    r.appendChild(top);
    const fightSlot = el('span', 'sim-fight');
    top.appendChild(fightSlot);

    // Battlefield, weather and time of day.
    const chips = (label, key, names) => {
      const row = el('div', 'sim-row');
      row.appendChild(el('span', 'sim-label', label));
      for (const [k, name] of Object.entries(names)) {
        const b = button(name, () => set(key, k), 'btn btn-small sim-chip' + (o[key] === k ? ' on' : ''));
        b.setAttribute('aria-pressed', String(o[key] === k));
        row.appendChild(b);
      }
      return row;
    };
    r.appendChild(chips('Battlefield', 'field', SIM_FIELDS));
    r.appendChild(chips('Weather', 'weather', SIM_WEATHER));
    r.appendChild(chips('Time', 'light', SIM_LIGHT));
    // Your colours (design/06 step 2.8): the scheme for designs without their own paint.
    const schemes = {};
    for (const [id, sc] of Object.entries(PART_LIBRARY.paints.schemes)) schemes[id] = sc.name;
    if (!o.scheme) o.scheme = 'league';
    r.appendChild(chips('Colours', 'scheme', schemes));

    // Your line-up, in order.
    const fits = (d) => {
      const naval = seaDomain(domainOf(d));
      if (naval) return o.field !== 'inland';
      return o.field !== 'sea' || airDomain(domainOf(d));
    };
    const idle = o.lineup.filter((id) => !fits(find(id).design)).length;
    r.appendChild(el('div', 'ws-label', `Your line-up: ${o.lineup.length} ships · the first 3 start, the rest wait in reserve in this order${idle ? ` · ${idle} can't fight on this battlefield` : ''}`));
    const line = el('div', 'ws-slots sim-line');
    o.lineup.forEach((id, i) => {
      const d = find(id).design;
      const card = el('div', 'ws-card sim-slot' + (fits(d) ? '' : ' sim-idle'));
      card.appendChild(el('span', 'ws-num', String(i + 1)));
      card.appendChild(designThumb(d, 104, 38));
      card.appendChild(el('b', '', markName(d)));
      const btns = el('div', 'ws-btns');
      if (i > 0) btns.appendChild(button('▲', () => { o.lineup.splice(i - 1, 0, o.lineup.splice(i, 1)[0]); set('lineup', o.lineup); }, 'btn btn-small'));
      btns.appendChild(button('✕', () => { o.lineup.splice(i, 1); set('lineup', o.lineup); }, 'btn btn-small', 'back'));
      card.appendChild(btns);
      line.appendChild(card);
    });
    if (!o.lineup.length) line.appendChild(el('p', 'card-text', 'Tap designs below to add them.'));
    r.appendChild(line);

    r.appendChild(el('div', 'ws-label', 'Your designs · tap to add to the line-up'));
    const list = el('div', 'ws-lib');
    for (const d of lib) {
      const pick = el('button', 'ws-card ws-pick');
      pick.type = 'button';
      pick.appendChild(designThumb(d.design, 104, 38));
      pick.appendChild(el('b', '', markName(d.design)));
      pick.appendChild(el('small', '', `${d.src} · ${DOMAIN_NAMES[domainOf(d.design)]} · cost ${costOf(d.design)}`));
      pick.addEventListener('click', () => { audio.sfx('order'); o.lineup.push(d.id); set('lineup', o.lineup); });
      list.appendChild(pick);
    }
    r.appendChild(list);

    // Enemy force: a number of ships picked by the Simulator for this battlefield, or your own picks.
    const er = el('div', 'sim-row');
    er.appendChild(el('span', 'sim-label', 'Enemy'));
    if (!o.enemy.length) {
      er.appendChild(button('−', () => set('size', Math.max(1, o.size - 1)), 'btn btn-small'));
      er.appendChild(el('b', 'sim-count', `${o.size} ships, mixed for the battlefield`));
      er.appendChild(button('+', () => set('size', Math.min(SIM_SIZE_MAX, o.size + 1)), 'btn btn-small'));
    } else {
      er.appendChild(el('b', 'sim-count', `${o.enemy.length}: ${o.enemy.map((id) => TEMPLATES[id].name).join(', ')}`));
      er.appendChild(button('Clear', () => set('enemy', []), 'btn btn-small', 'back'));
    }
    r.appendChild(er);
    r.appendChild(el('div', 'ws-label', 'Or pick the enemy yourself · tap to add'));
    const en = el('div', 'sim-row sim-wrap');
    for (const id of this.enemyChoices()) {
      en.appendChild(button(TEMPLATES[id].name, () => { if (o.enemy.length < SIM_SIZE_MAX) { o.enemy.push(id); set('enemy', o.enemy); } else audio.sfx('error'); }, 'btn btn-small sim-chip'));
    }
    r.appendChild(en);

    const ready = o.lineup.some((id) => fits(find(id).design));
    const go = button('Fight', () => {
      if (!ready) { audio.sfx('error'); ui.toast('Add a ship that can fight on this battlefield.'); return; }
      screens.go('battle', this.battleArg());
    }, 'btn btn-primary');
    if (!ready) go.classList.add('btn-disabled');
    fightSlot.appendChild(go);
    uiLayer.insertBefore(r, ui.toastBox);
  },
};
