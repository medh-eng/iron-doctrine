/* ==== 16m DRAFTING OFFICE: MISSILE AND DRONE TABS ==== */
// The Missile tab (design/02 §6; design/05 §3.4): missiles are drawn on the missile grids
// from missile parts; the stats drawer shows the numbers the flight uses. Ships with launchers
// choose which missile design their launchers carry.

Object.assign(SCREENS.designer, {
  refreshKind() {
    const s = this.st, d = s.d;
    let cls = classById(s.cls);
    const list = classesOf(d.kind);
    if (!cls || cls.cat !== d.kind) { cls = classFor(d) || list[list.length - 1]; s.cls = cls.id; }
    this.classBtn.textContent = `${cls.name} ▾`;
    this.chips.textContent = '';
    const chip = (t, cl = '') => this.chips.appendChild(el('span', 'dz-chip' + cl, t));
    chip(`parts ${partCount(d)}/${cls.parts}`);
    const errs = this.kindErrors();
    const S = this.stats;
    S.textContent = '';
    const head = (t) => S.appendChild(el('div', 'dz-h', t));
    const row = (k, v) => { const r = el('div', 'dz-row'); r.appendChild(el('span', '', k)); r.appendChild(el('b', '', String(v))); S.appendChild(r); };
    if (d.kind === 'missile') {
      const ms = missileStats(Object.assign({}, d, { id: 'draft' + d.cells.length }));
      chip(`${ms.mass} kg`); chip(`${Math.round(ms.vel)} m/s`); chip(`cost ${ms.cost}`);
      head('Stats · Missile');
      row('Mass', `${ms.mass} kg`);
      row('Speed', `${Math.round(ms.vel)} m/s (${ms.motors} motor${ms.motors === 1 ? '' : 's'})`);
      row('Reach', `${Math.round(ms.reach)} m, ${ms.life.toFixed(1)} s of flight`);
      row('Turn', `${ms.turn.toFixed(2)} rad/s`);
      row('Guidance', ms.seeker ? { radar: 'Radar seeker', heat: 'Heat seeker', laser: 'Laser seeker' }[ms.seeker] : 'None (unguided)');
      row('Lock chance', ms.seeker ? `${Math.round(SEEKER_LOCK[ms.seeker] * 100)}% base${ms.seeker === 'radar' ? ', −40% against ECM' : ''}` : '—');
      row('Flares', ms.seeker ? `decoyed by ${Math.round(0.7 * FLARE_DECOY[ms.seeker] * 100)}% of salvos` : '—');
      row('Warheads', ms.warheads.length ? ms.warheads.join(', ') : 'none');
      row('Damage', ms.dmg);
      row('Carried by', ms.size === 1 ? 'racks (4) and VLS (8)' : ms.size === 2 ? 'VLS (4)' : 'VLS (2)');
    }
    for (const e of errs) S.appendChild(el('div', 'dz-warn', e));
    this.saveBtn.disabled = !!errs.length;
    this.nameBtn.textContent = markName(d) + (this.changed() ? ' *' : '');
  },

  kindErrors() {
    const d = this.st.d;
    if (!d.cells.length) return ['Empty grid.'];
    if (d.kind === 'missile') return missileStats(Object.assign({}, d, { id: 'draft' + d.cells.length })).errors;
    return [];
  },
  kindCost() { return this.st.d.cells.reduce((a, c) => a + partCost(PARTS[c.p]), 0); },

  // Which missile design the ship's launchers carry.
  loadMenu() {
    const s = this.st;
    const c = ui.card('Missiles for the launchers');
    const col = el('div', 'card-col');
    let close = null;
    const racks = s.d.cells.some((q) => PARTS[q.p].secondary === 'missile' && PARTS[q.p].size === 1);
    const opts = [DEFAULT_MISSILES[1], DEFAULT_MISSILES[2], DEFAULT_MISSILES[3]].concat(save.designs.list.filter((x) => x.kind === 'missile'));
    col.appendChild(button(`Standard (by launcher)${!s.d.load ? ' ✓' : ''}`, () => { s.d.load = undefined; close(); this.refresh(); }, 'btn' + (!s.d.load ? ' btn-primary' : '')));
    for (const md of opts) {
      const ms = missileStats(md);
      if (ms.errors.length) continue;
      const note = ms.size === 1 ? 'small: racks and VLS' : `${ms.size === 2 ? 'medium' : 'large'}: VLS only${racks ? ' (racks keep the standard small missile)' : ''}`;
      col.appendChild(button(`${markName(md)} · ${note} · ${Math.round(ms.vel)} m/s · ${ms.seeker || 'unguided'} · ${ms.warheads.join('+')}${s.d.load === md.id ? ' ✓' : ''}`, () => { s.d.load = md.id; close(); this.refresh(); }, 'btn' + (s.d.load === md.id ? ' btn-primary' : '')));
    }
    col.appendChild(button('Cancel', () => close(), 'btn', 'back'));
    c.appendChild(col);
    c.classList.add('card-scroll');
    close = ui.open(c);
  },
});
