/* ==== 16m MISSILE AND DRONE DESIGNERS ==== */
// The Drafting Office's Missile and Drone tabs (design/02 §6, design/01 §5): pick a size, place
// parts on its small grid, read the numbers, save the design, and choose it as the missile this
// ship's racks and VLS carry or the drone its hangars hold. Numbers only. Both tabs share one
// card; SMALL_KINDS says what differs.

const MSL_SHORT = { mw_he: 'HE', mw_napalm: 'Napalm', mw_acid: 'Acid', mw_emp: 'EMP', mw_cluster: 'Cluster', mmotor: 'Motor', mfuel: 'Fuel', mfins: 'Fins', mseek_radar: 'Rdr', mseek_heat: 'Heat', dcore: 'Core', drotor: 'Rotor', dgun: 'Gun', dcharge: 'Charge', dcam: 'Cam', dlaser: 'Laser' };

const SMALL_KINDS = {
  missile: {
    title: 'Missiles', field: 'missile', def: () => DEFAULT_MISSILE, store: 'missiles', idPrefix: 'm', domain: 'missile', brush: 'mmotor',
    classes: () => MISSILE_CLASSES, classOf: (id) => missileClass(id), label: (K) => K.name.replace(' missile', ''),
    designs: () => missileDesigns(), get: (id) => missileDesign(id), templates: () => MISSILE_TEMPLATES,
    validate: (d) => validateMissile(d), stats: (d) => missileStats(d),
    isPart: (P) => P.cat === 'missile',
    look: (P) => P.warhead || (P.seeker ? 'seeker' : P.motor ? 'motor' : P.id),
    facts: (ms, fact) => {
      fact('Mass', `${ms.mass} kg`);
      fact('Speed', `${ms.speed} m/s`);
      fact('Range', `${ms.range} m`);
      fact('Guidance', ms.seeker ? `${ms.seeker} seeker, turn ${ms.turn.toFixed(2)} rad/s` : 'unguided');
      fact('Warhead', ms.warhead ? `${ms.warhead}, ${ms.dmg} dmg${ms.bomblets ? ` × ${ms.bomblets}` : ''}` : '—');
      fact('Space', `${ms.units} (rack 4, VLS 8, magazine 8)`);
      fact('Cost', ms.cost);
    },
    newName: (st, ms, n) => `${missileClass(st.d.class).name.replace(' missile', '')} ${ms.seeker || 'unguided'} ${ms.warhead} ${n}`,
    carried: 'Carried by this ship', carry: 'Carry on this ship',
  },
  drone: {
    title: 'Drones', field: 'drone', def: () => DEFAULT_DRONE, store: 'drones', idPrefix: 'u', domain: 'drone', brush: 'dcore',
    classes: () => DRONE_CLASSES, classOf: (id) => droneClass(id), label: (K) => K.name.replace('Drone (computer ', '').replace(')', ''),
    designs: () => droneDesigns(), get: (id) => droneDesign(id), templates: () => DRONE_TEMPLATES,
    validate: (d) => validateDrone(d), stats: (d) => droneStats(d),
    isPart: (P) => P.domains && P.domains.includes('drone'),
    look: (P) => (P.droneCore ? 'seeker' : P.droneRotor ? 'motor' : P.droneCharge ? 'napalm' : P.droneGun ? 'he' : P.droneCam ? 'emp' : P.id),
    facts: (ds, fact) => {
      fact('Mass', `${ds.mass} kg`);
      fact('Lift', `${Math.round(ds.lift)} N (${ds.ratio.toFixed(2)} × weight)`);
      fact('Speed', `${ds.speed} m/s`);
      fact('HP', ds.hp);
      fact('Weapons', [ds.guns ? `${ds.guns} gun${ds.guns > 1 ? 's' : ''}` : '', ds.charge ? `charge ${ds.charge} dmg` : ''].filter(Boolean).join(', ') || 'none');
      fact('Camera', ds.spot ? `spots ${Math.round(DRN.camRange * ds.spot / 1.5)} m around` : 'none');
      fact('Cost', ds.cost);
    },
    newName: (st, ds, n) => `${ds.charge ? 'Strike' : ds.guns ? 'Gun' : 'Scout'} drone ${n}`,
    carried: 'In this ship’s hangars', carry: 'Use in this ship’s hangars',
  },
};

function openMissileDesigner(D) { openSmallDesigner(D, SMALL_KINDS.missile); }
function openDroneDesigner(D) { openSmallDesigner(D, SMALL_KINDS.drone); }

function openSmallDesigner(D, K) {
  const ship = D && D.st && D.st.d;
  const start = K.get((ship && ship[K.field]) || K.def()) || Object.values(K.templates())[0];
  const copy = (md) => ({ id: md.id, name: md.name, class: md.class, cells: missileCells(md) });
  const st = { d: copy(start), brush: K.brush, dirty: false };
  const c = ui.card('', 'card-missile');
  let close = null;
  const fresh = () => { delete st.d._stats; return K.stats(st.d); };
  const draw = () => {
    c.textContent = '';
    const cls = K.classOf(st.d.class);
    const head = el('div', 'rs-head');
    head.appendChild(el('h2', 'card-title', K.title));
    head.appendChild(el('span', 'ws-fact', st.d.name));
    c.appendChild(head);
    // Size chips and the designs to start from.
    const row = el('div', 'card-row ms-row');
    for (const Q of K.classes()) {
      row.appendChild(button(`${K.label(Q)} ${Q.grid[0]}×${Q.grid[1]}`, () => {
        if (st.d.class === Q.id) return;
        st.d = { id: '', name: `New ${Q.name.toLowerCase()}`, class: Q.id, cells: [] }; st.dirty = true; draw();
      }, 'btn btn-small map-tab' + (st.d.class === Q.id ? ' on' : '')));
    }
    const pick = document.createElement('select');
    pick.className = 'ms-pick';
    for (const md of K.designs()) {
      const o = document.createElement('option');
      o.value = md.id; o.textContent = md.name;
      if (md.id === st.d.id) o.selected = true;
      pick.appendChild(o);
    }
    if (!st.d.id) { const o = document.createElement('option'); o.value = ''; o.textContent = st.d.name; o.selected = true; pick.appendChild(o); }
    pick.addEventListener('change', () => {
      const md = K.get(pick.value);
      if (md) { st.d = copy(md); st.dirty = false; draw(); }
    });
    row.appendChild(pick);
    c.appendChild(row);
    // The grid: tap a cell to place the brush there, tap a part to take it off.
    const box = el('div', 'ms-grid-wrap');
    const grid = el('div', 'ms-grid');
    const cs = Math.floor(Math.min(34, (Math.min(layout.w, 900) - 60) / cls.grid[0], cls.grid[1] > 3 ? 26 : 34));
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
        const why = K.validate({ class: st.d.class, cells: cand }).find((e) => /sticks out|overlaps|parts; a|fits/.test(e));
        if (why) { ui.toast(why); return; }
        st.d.cells = cand; st.dirty = true; audio.sfx('tap'); draw();
      });
      grid.appendChild(cell);
    }
    st.d.cells.forEach((q, i) => {
      const P = PARTS[q.p];
      const b = el('button', `ms-part ms-${K.look(P)}`, MSL_SHORT[q.p] || P.name);
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
      if (!K.isPart(P) || (D && D.lockParts && !partUnlocked(P.id))) continue;
      const nm = P.name.replace(' warhead', '').replace(' seeker', '').replace('Drone ', '');
      const b = button(`${nm[0].toUpperCase()}${nm.slice(1)} ${P.w}×${P.h}`, () => { st.brush = P.id; draw(); }, 'btn btn-small ms-brush' + (st.brush === P.id ? ' on' : ''));
      b.dataset.part = P.id;
      b.title = P.name;
      pal.appendChild(b);
    }
    c.appendChild(pal);
    // Numbers.
    const ms = fresh();
    const facts = el('div', 'result-facts ms-facts');
    K.facts(ms, (k, v) => { const r = el('div', 'fact'); r.appendChild(el('span', '', k)); r.appendChild(el('b', '', String(v))); facts.appendChild(r); });
    c.appendChild(facts);
    if (ms.errors.length) c.appendChild(el('p', 'card-text bad ms-errors', ms.errors.join(' ')));
    // Actions.
    const act = el('div', 'card-row ms-row');
    act.appendChild(button('Save as new', () => {
      if (ms.errors.length) { ui.toast(ms.errors[0]); return; }
      const list = save.designs[K.store] = save.designs[K.store] || [];
      const d = { id: K.idPrefix + Date.now().toString(36), name: K.newName(st, ms, list.length + 1), domain: K.domain, class: st.d.class, cells: st.d.cells.map((q) => [q.p, q.x, q.y]) };
      list.push(d);
      save.touch('designs');
      st.d = copy(d); st.dirty = false;
      audio.sfx('medal');
      ui.toast(`Saved ${d.name}.`);
      draw();
    }, 'btn btn-small'));
    if (ship) {
      const on = ship[K.field] === st.d.id || (!ship[K.field] && st.d.id === K.def());
      const use = button(on ? K.carried : K.carry, () => {
        if (!st.d.id || st.dirty || ms.errors.length) { ui.toast(ms.errors[0] || 'Save the changed design first.'); return; }
        ship[K.field] = st.d.id;
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
