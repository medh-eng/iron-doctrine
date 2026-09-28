/* ==== 16m MISSILE DESIGNER ==== */
// The Drafting Office's Missile tab (design/02 §6, design/01 §5): pick a size (small 6×1,
// medium 10×2, large 16×3), place missile parts on its grid, read the numbers, save the design,
// and choose it as the missile this ship's racks and VLS carry. Numbers only.

const MSL_SHORT = { mw_he: 'HE', mw_napalm: 'Napalm', mw_acid: 'Acid', mw_emp: 'EMP', mw_cluster: 'Cluster', mmotor: 'Motor', mfuel: 'Fuel', mfins: 'Fins', mseek_radar: 'Rdr', mseek_heat: 'Heat' };

function openMissileDesigner(D) {
  const ship = D && D.st && D.st.d;
  const start = missileDesign((ship && ship.missile) || DEFAULT_MISSILE) || Object.values(MISSILE_TEMPLATES)[0];
  const st = { d: { id: start.id, name: start.name, class: start.class, cells: missileCells(start) }, brush: 'mmotor', own: !MISSILE_TEMPLATES[start.id], dirty: false };
  const c = ui.card('', 'card-missile');
  let close = null;
  const fresh = () => { delete st.d._stats; return missileStats(st.d); };
  const draw = () => {
    c.textContent = '';
    const cls = missileClass(st.d.class);
    const head = el('div', 'rs-head');
    head.appendChild(el('h2', 'card-title', 'Missiles'));
    head.appendChild(el('span', 'ws-fact', st.d.name));
    c.appendChild(head);
    // Size chips and the designs to start from.
    const row = el('div', 'card-row ms-row');
    for (const K of MISSILE_CLASSES) {
      row.appendChild(button(`${K.name.replace(' missile', '')} ${K.grid[0]}×${K.grid[1]}`, () => {
        if (st.d.class === K.id) return;
        st.d = { id: '', name: `New ${K.name.toLowerCase()}`, class: K.id, cells: [] }; st.own = true; st.dirty = true; draw();
      }, 'btn btn-small map-tab' + (st.d.class === K.id ? ' on' : '')));
    }
    const pick = document.createElement('select');
    pick.className = 'ms-pick';
    for (const md of missileDesigns()) {
      const o = document.createElement('option');
      o.value = md.id; o.textContent = md.name;
      if (md.id === st.d.id) o.selected = true;
      pick.appendChild(o);
    }
    if (!st.d.id) { const o = document.createElement('option'); o.value = ''; o.textContent = st.d.name; o.selected = true; pick.appendChild(o); }
    pick.addEventListener('change', () => {
      const md = missileDesign(pick.value);
      if (md) { st.d = { id: md.id, name: md.name, class: md.class, cells: missileCells(md) }; st.own = !MISSILE_TEMPLATES[md.id]; st.dirty = false; draw(); }
    });
    row.appendChild(pick);
    c.appendChild(row);
    // The grid: tap a cell to place the brush there, tap a part to take it off.
    const box = el('div', 'ms-grid-wrap');
    const grid = el('div', 'ms-grid');
    const cs = Math.floor(Math.min(34, (Math.min(layout.w, 900) - 60) / cls.grid[0]));
    grid.style.width = `${cs * cls.grid[0]}px`;
    grid.style.height = `${cs * cls.grid[1]}px`;
    grid.style.backgroundSize = `${cs}px ${cs}px`;
    for (let y = 0; y < cls.grid[1]; y++) for (let x = 0; x < cls.grid[0]; x++) {
      const cell = el('button', 'ms-cell');
      cell.type = 'button';
      cell.dataset.x = x; cell.dataset.y = y;
      Object.assign(cell.style, { left: `${x * cs}px`, top: `${y * cs}px`, width: `${cs}px`, height: `${cs}px` });
      cell.addEventListener('click', () => {
        const P = PARTS[st.brush];
        if (!P) return;
        const cand = st.d.cells.concat([{ p: P.id, x, y }]);
        const why = validateMissile({ class: st.d.class, cells: cand }).find((e) => /sticks out|overlaps|parts; a|fits/.test(e));
        if (why) { ui.toast(why); return; }
        st.d.cells = cand; st.dirty = true; audio.sfx('tap'); draw();
      });
      grid.appendChild(cell);
    }
    st.d.cells.forEach((q, i) => {
      const P = PARTS[q.p];
      const b = el('button', `ms-part ms-${P.warhead || (P.seeker ? 'seeker' : P.motor ? 'motor' : q.p)}`, MSL_SHORT[q.p] || P.name);
      b.type = 'button';
      b.dataset.part = q.p;
      Object.assign(b.style, { left: `${q.x * cs + 1}px`, top: `${q.y * cs + 1}px`, width: `${P.w * cs - 2}px`, height: `${P.h * cs - 2}px` });
      b.addEventListener('click', () => { st.d.cells.splice(i, 1); st.dirty = true; audio.sfx('tap'); draw(); });
      grid.appendChild(b);
    });
    box.appendChild(grid);
    c.appendChild(box);
    // Parts palette.
    const pal = el('div', 'ms-palette');
    for (const P of Object.values(PARTS)) {
      if (P.cat !== 'missile' || (D && D.lockParts && !partUnlocked(P.id))) continue;
      const b = button(`${P.name.replace(' warhead', '').replace(' seeker', '')} ${P.w}×${P.h}`, () => { st.brush = P.id; draw(); }, 'btn btn-small ms-brush' + (st.brush === P.id ? ' on' : ''));
      b.dataset.part = P.id;
      b.title = P.name;
      pal.appendChild(b);
    }
    c.appendChild(pal);
    // Numbers.
    const ms = fresh();
    const facts = el('div', 'result-facts ms-facts');
    const fact = (k, v) => { const r = el('div', 'fact'); r.appendChild(el('span', '', k)); r.appendChild(el('b', '', String(v))); facts.appendChild(r); };
    fact('Mass', `${ms.mass} kg`);
    fact('Speed', `${ms.speed} m/s`);
    fact('Range', `${ms.range} m`);
    fact('Guidance', ms.seeker ? `${ms.seeker} seeker, turn ${ms.turn.toFixed(2)} rad/s` : 'unguided');
    fact('Warhead', ms.warhead ? `${ms.warhead}, ${ms.dmg} dmg${ms.bomblets ? ` × ${ms.bomblets}` : ''}` : '—');
    fact('Space', `${ms.units} (rack 4, VLS 8, magazine 8)`);
    fact('Cost', ms.cost);
    c.appendChild(facts);
    if (ms.errors.length) c.appendChild(el('p', 'card-text bad ms-errors', ms.errors.join(' ')));
    // Actions.
    const act = el('div', 'card-row ms-row');
    act.appendChild(button('Save as new', () => {
      if (ms.errors.length) { ui.toast(ms.errors[0]); return; }
      const list = save.designs.missiles;
      const n = list.length + 1;
      const d = { id: 'm' + Date.now().toString(36), name: `${missileClass(st.d.class).name.replace(' missile', '')} ${ms.seeker || 'unguided'} ${ms.warhead} ${n}`, domain: 'missile', class: st.d.class, cells: st.d.cells.map((q) => [q.p, q.x, q.y]) };
      list.push(d);
      save.touch('designs');
      st.d = { id: d.id, name: d.name, class: d.class, cells: missileCells(d) }; st.own = true; st.dirty = false;
      audio.sfx('medal');
      ui.toast(`Saved ${d.name}.`);
      draw();
    }, 'btn btn-small'));
    if (ship) {
      const on = ship.missile === st.d.id || (!ship.missile && st.d.id === DEFAULT_MISSILE);
      const use = button(on ? 'Carried by this ship' : 'Carry on this ship', () => {
        if (!st.d.id || st.dirty || ms.errors.length) { ui.toast(ms.errors[0] || 'Save the changed missile first.'); return; }
        ship.missile = st.d.id;
        audio.sfx('tap');
        D.refresh();
        draw();
      }, 'btn btn-small' + (on ? '' : ' btn-primary'));
      if (on || st.dirty || !st.d.id || ms.errors.length) use.disabled = true;
      act.appendChild(use);
    }
    act.appendChild(button('Close', () => close(), 'btn btn-small', 'back'));
    c.appendChild(act);
  };
  draw();
  close = ui.open(c);
}
