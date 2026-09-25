/* ==== 16e SCREEN: DRAFTING OFFICE ==== */
// The Workshop's designer (design/02 §5, design/01 §8, §8.6): a cyanotype grid,
// a parts palette, a numbers-only stats drawer, balance markers, undo/redo,
// templates, randomise, scratch build, test drive and saving marks.

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const markName = (d) => `${d.family || d.name} Mk.${ROMAN[d.mark || 1] || d.mark}`;
const PART_CATS = [['structure', 'Struct'], ['mobility', 'Mobil'], ['weapon', 'Weapon'], ['system', 'System'], ['logistics', 'Logist']];
const BLUEPRINT = { bg: '#13466B', grid: '#2A6A92', line: 'rgba(214,238,255,0.85)', valid: '#7FD3FF', invalid: '#FF6B5A' };

// A thumbnail of a design, drawn with the battle part art.
function designThumb(design, w, h) {
  const c = document.createElement('canvas');
  const dpr = layout.dpr;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  c.style.width = w + 'px'; c.style.height = h + 'px';
  const d = cropDesign(design);
  const V = { design: d, parts: d.cells.map((cl) => ({ def: PARTS[cl.p], x: cl.x, y: cl.y, hp: 1, alive: true, scorch: 0 })), side: 0, id: 1 };
  const ppm = Math.max(4, Math.floor(Math.min((w * dpr) / (d.w * CELL), (h * dpr) / (d.h * CELL))));
  const img = paintParts(V, V.parts.map((_, i) => i), ppm, 0);
  const g = c.getContext('2d');
  g.drawImage(img, (c.width - img.width) / 2, (c.height - img.height) / 2);
  return c;
}

SCREENS.designer = {
  root: null,
  st: null,             // { d, cls, base, baseOwned, undo, redo, brush, sel, cat, zoom, panX, panY }
  gridRect: { x: 0, y: 0, w: 1, h: 1 },
  hover: null,          // {x, y} cell under the pointer while placing
  move: null,           // {idx, dx, dy, x, y} while dragging a placed part
  msg: '',
  controls: [],

  // arg: { design, base } to edit, { restore } to come back from a test drive, or nothing for a scratch build.
  enter(arg = {}) {
    if (arg.restore) this.st = arg.restore;
    else this.load(arg.design || this.scratch(), arg.base || null, arg.owned !== false && !!arg.design);
    this.build();
    audio.playTheme(null);
    // Desktop: show the ghost under the mouse while a part is picked up.
    this.onHover = (e) => { if (e.pointerType === 'mouse') this.hoverAt(e.clientX - layout.x, e.clientY - layout.y); };
    canvas.addEventListener('pointermove', this.onHover);
  },

  exit() {
    if (this.root) this.root.remove();
    this.root = null;
    canvas.removeEventListener('pointermove', this.onHover);
  },

  // Put a design into a class-sized grid, bottom-aligned.
  load(design, base, owned) {
    const d0 = cropDesign(design);
    const dom = domainOf(d0);
    const cls = dom === 'sub' ? 'sub' : dom === 'naval' ? 'ship' : d0.w <= CLASSES.light.w - 2 && d0.h <= CLASSES.light.h ? 'light' : 'heavy';
    const C = CLASSES[cls];
    const W = Math.max(C.w, d0.w + 2), H = Math.max(C.h, d0.h);
    const ox = 1, oy = H - d0.h;
    this.st = {
      cls,
      d: { w: W, h: H, cells: d0.cells.map((c) => ({ p: c.p, x: c.x + ox, y: c.y + oy })), name: design.name, family: design.family || design.name, mark: design.mark || 1, id: design.id },
      base: base || design,
      baseOwned: owned,
      undo: [], redo: [],
      brush: null, sel: -1, cat: 'structure', zoom: 1, panX: 0, panY: 0,
    };
    this.msg = '';
  },

  // An empty grid with a starter frame (ground) or a starter keel (ship).
  scratch(cls = 'light') {
    const C = CLASSES[cls];
    const cells = [];
    if (cls === 'ship') for (let x = 4; x < 20; x += 2) cells.push(['keel', x, C.h - 1]);
    else for (let x = 2; x < 10; x++) cells.push(['frame', x, C.h - 2]);
    return { id: 'scratch', name: 'New design', family: 'New design', w: C.w, h: C.h, cells: cells.map(([p, x, y]) => ({ p, x, y })) };
  },

  snapshot() { this.st.undo.push(JSON.stringify(this.st.d.cells)); if (this.st.undo.length > 60) this.st.undo.shift(); this.st.redo.length = 0; },

  // Why a part can't go at (x, y), or '' if it can. ignore = index of a part being moved.
  placeCheck(id, x, y, ignore = -1) {
    const d = this.st.d, P = PARTS[id];
    if (x < 0 || y < 0 || x + P.w > d.w || y + P.h > d.h) return 'Outside the grid.';
    let touches = false, others = 0;
    for (let i = 0; i < d.cells.length; i++) {
      if (i === ignore) continue;
      others++;
      const c = d.cells[i], Q = PARTS[c.p];
      if (x < c.x + Q.w && x + P.w > c.x && y < c.y + Q.h && y + P.h > c.y) return `Overlaps the ${Q.name.toLowerCase()}.`;
      const hTouch = (x === c.x + Q.w || x + P.w === c.x) && y < c.y + Q.h && y + P.h > c.y;
      const vTouch = (y === c.y + Q.h || y + P.h === c.y) && x < c.x + Q.w && x + P.w > c.x;
      if (hTouch || vTouch) touches = true;
    }
    if (P.loco && y + P.h !== d.h) return 'Wheels and tracks go on the bottom row.';
    if (P.keel && y + P.h !== d.h) return 'Keels go on the bottom row.';
    if (others && !touches) return 'Parts must touch the rest of the vehicle.';
    return '';
  },

  place(id, x, y) {
    const why = this.placeCheck(id, x, y);
    if (why) { this.say(why, true); return false; }
    this.snapshot();
    this.st.d.cells.push({ p: id, x, y });
    this.st.sel = -1;
    audio.sfx('tap');
    haptic('tap');
    this.msg = '';
    this.refresh();
    return true;
  },

  remove(i) {
    if (i < 0) return;
    this.snapshot();
    this.st.d.cells.splice(i, 1);
    this.st.sel = -1;
    audio.sfx('back');
    this.refresh();
  },

  say(text, bad) {
    this.msg = text;
    if (bad) audio.sfx('error');
    if (this.msgEl) { this.msgEl.textContent = text; this.msgEl.classList.toggle('bad', !!bad); }
  },

  cellAt(sx, sy) {
    const r = this.gridRect, cs = this.cs;
    return { x: Math.floor((sx - r.ox) / cs), y: Math.floor((sy - r.oy) / cs) };
  },

  partAt(cx, cy) {
    const cells = this.st.d.cells;
    for (let i = cells.length - 1; i >= 0; i--) {
      const c = cells[i], P = PARTS[c.p];
      if (cx >= c.x && cx < c.x + P.w && cy >= c.y && cy < c.y + P.h) return i;
    }
    return -1;
  },

  // Brush anchor: the part's bottom-left sits on the cell you touch.
  anchor(id, cell) { return { x: cell.x, y: cell.y - PARTS[id].h + 1 }; },

  world: {
    tap(x, y) {
      const S = SCREENS.designer;
      const cell = S.cellAt(x, y);
      if (S.st.brush) { const a = S.anchor(S.st.brush, cell); S.place(S.st.brush, a.x, a.y); return; }
      const i = S.partAt(cell.x, cell.y);
      S.st.sel = i === S.st.sel ? -1 : i;
      if (i >= 0) { audio.sfx('tap'); S.say(`${PARTS[S.st.d.cells[i].p].name}. Drag to move it.`); }
      S.refresh();
    },
    doubleTap() { const S = SCREENS.designer; S.st.zoom = 1; S.st.panX = S.st.panY = 0; S.layout(); },
    longPress(x, y) {
      const S = SCREENS.designer;
      const c = S.cellAt(x, y);
      const i = S.partAt(c.x, c.y);
      if (i >= 0) S.remove(i);
    },
    panStart(x, y) {
      const S = SCREENS.designer;
      const c = S.cellAt(x, y);
      const i = S.partAt(c.x, c.y);
      if (i >= 0 && !S.st.brush) {
        const cl = S.st.d.cells[i];
        S.st.sel = i;
        S.move = { idx: i, dx: c.x - cl.x, dy: c.y - cl.y, x: cl.x, y: cl.y, sx: x, sy: y };
      }
    },
    pan(dx, dy) {
      const S = SCREENS.designer;
      if (S.move) {
        S.move.sx += dx; S.move.sy += dy;
        const c = S.cellAt(S.move.sx, S.move.sy);
        S.move.x = c.x - S.move.dx; S.move.y = c.y - S.move.dy;
        return;
      }
      S.st.panX += dx; S.st.panY += dy;
      S.layout();
    },
    panEnd() {
      const S = SCREENS.designer;
      const m = S.move;
      if (!m) return;
      S.move = null;
      const cl = S.st.d.cells[m.idx];
      if (m.x === cl.x && m.y === cl.y) return;
      const why = S.placeCheck(cl.p, m.x, m.y, m.idx);
      if (why) { S.say(why, true); return; }
      S.snapshot();
      cl.x = m.x; cl.y = m.y;
      audio.sfx('tap');
      S.refresh();
    },
    pinch(f) {
      const S = SCREENS.designer;
      S.st.zoom = clamp(S.st.zoom * f, 0.6, 3);
      S.layout();
    },
  },

  key(code, down) {
    if (!down) return;
    if (code === 'Delete' || code === 'Backspace') this.remove(this.st.sel);
    if ((code === 'KeyZ') && (input.keys.has('ControlLeft') || input.keys.has('MetaLeft'))) this.undo();
  },

  undo() {
    const s = this.st;
    if (!s.undo.length) { audio.sfx('error'); return; }
    s.redo.push(JSON.stringify(s.d.cells));
    s.d.cells = JSON.parse(s.undo.pop());
    s.sel = -1;
    audio.sfx('back');
    this.refresh();
  },

  redo() {
    const s = this.st;
    if (!s.redo.length) { audio.sfx('error'); return; }
    s.undo.push(JSON.stringify(s.d.cells));
    s.d.cells = JSON.parse(s.redo.pop());
    s.sel = -1;
    audio.sfx('tap');
    this.refresh();
  },

  // ---------- DOM
  build() {
    if (this.root) this.root.remove();
    const r = el('div', 'designer');
    this.root = r;
    // Top strip.
    const top = el('div', 'dz-top');
    top.appendChild(button('‹ Back', () => this.back(), 'btn btn-small', 'back'));
    this.nameBtn = button('', () => this.rename(), 'btn btn-small dz-name');
    top.appendChild(this.nameBtn);
    this.chips = el('div', 'dz-chips');
    top.appendChild(this.chips);
    top.appendChild(button('New…', () => this.newMenu(), 'btn btn-small'));
    r.appendChild(top);
    // Palette.
    const pal = el('div', 'dz-palette');
    this.palette = pal;
    const tabs = el('div', 'dz-tabs');
    for (const [cat, label] of PART_CATS) {
      const t = el('button', 'dz-tab', label);
      t.type = 'button';
      t.dataset.cat = cat;
      t.addEventListener('click', () => { this.st.cat = cat; audio.sfx('tap'); this.fillPalette(); });
      tabs.appendChild(t);
    }
    pal.appendChild(tabs);
    this.partList = el('div', 'dz-parts');
    pal.appendChild(this.partList);
    r.appendChild(pal);
    // Stats drawer.
    this.stats = el('div', 'dz-stats');
    r.appendChild(this.stats);
    // Bottom corners.
    const bl = el('div', 'dz-bl');
    bl.appendChild(button('Undo', () => this.undo(), 'btn btn-small'));
    bl.appendChild(button('Redo', () => this.redo(), 'btn btn-small'));
    this.delBtn = button('Delete', () => this.remove(this.st.sel), 'btn btn-small btn-warn');
    bl.appendChild(this.delBtn);
    r.appendChild(bl);
    const br = el('div', 'dz-br');
    this.testBtn = button('Test drive', () => this.testDrive(), 'btn btn-small');
    this.saveBtn = button('Save', () => this.saveDesign(), 'btn btn-small btn-primary');
    br.appendChild(this.testBtn);
    br.appendChild(this.saveBtn);
    r.appendChild(br);
    this.msgEl = el('div', 'dz-msg');
    r.appendChild(this.msgEl);
    uiLayer.insertBefore(r, ui.toastBox);
    this.fillPalette();
    this.refresh();
    requestAnimationFrame(() => this.layout());
  },

  fillPalette() {
    const list = this.partList;
    list.textContent = '';
    for (const t of this.palette.querySelectorAll('.dz-tab')) t.setAttribute('aria-selected', String(t.dataset.cat === this.st.cat));
    for (const P of Object.values(PARTS)) {
      if (P.cat !== this.st.cat) continue;
      const b = el('button', 'dz-part');
      b.type = 'button';
      b.dataset.part = P.id;
      const icon = document.createElement('canvas');
      icon.width = 64; icon.height = 32;
      const g = icon.getContext('2d');
      const cs = Math.min(64 / P.w, 32 / P.h) * 0.85;
      drawPart(g, { def: P, scorch: 0 }, (64 - P.w * cs) / 2, (32 - P.h * cs) / 2 + (P.id === 'radio' ? 6 : 0), cs, 0, 1);
      b.appendChild(icon);
      const txt = el('span', 'dz-part-txt');
      txt.appendChild(el('b', '', P.name));
      txt.appendChild(el('small', '', `${P.w}×${P.h} · ${P.mass} kg · cost ${partCost(P)}`));
      b.appendChild(txt);
      if (this.st.brush === P.id) b.classList.add('on');
      // Tap to pick up the part as a brush; drag it straight onto the grid.
      b.addEventListener('pointerdown', (e) => this.paletteDown(e, P.id, b));
      list.appendChild(b);
    }
  },

  paletteDown(e, id, btn) {
    audio.unlock();
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    const move = (ev) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 12) { dragging = true; this.st.brush = id; }
      if (dragging) this.hoverAt(ev.clientX - layout.x, ev.clientY - layout.y);
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (dragging) {
        const x = ev.clientX - layout.x, y = ev.clientY - layout.y;
        const R = this.gridRect;
        if (x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h) {
          const a = this.anchor(id, this.cellAt(x, y));
          this.place(id, a.x, a.y);
        }
        this.st.brush = null;
        this.hover = null;
      } else {
        this.st.brush = this.st.brush === id ? null : id;
        this.st.sel = -1;
        audio.sfx(this.st.brush ? 'toggleOn' : 'toggleOff');
        this.say(this.st.brush ? `${PARTS[id].name}: tap the grid to place it. Tap it again to put it down.` : '');
      }
      this.fillPalette();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  },

  hoverAt(x, y) {
    const R = this.gridRect;
    if (!this.st.brush || x < R.x || x > R.x + R.w || y < R.y || y > R.y + R.h) { this.hover = null; return; }
    const a = this.anchor(this.st.brush, this.cellAt(x, y));
    this.hover = a;
    const why = this.placeCheck(this.st.brush, a.x, a.y);
    this.say(why || `${PARTS[this.st.brush].name}: release to place.`, false);
    if (this.msgEl) this.msgEl.classList.toggle('bad', !!why);
  },

  // Recompute numbers after any change.
  refresh() {
    const s = this.st;
    const d = s.d;
    this.nameBtn.textContent = markName(d) + (this.changed() ? ' *' : '');
    this.delBtn.hidden = s.sel < 0;
    const rep = designReport(d);
    this.rep = rep;
    const st = rep.st;
    this.chips.textContent = '';
    const chip = (t) => this.chips.appendChild(el('span', 'dz-chip', t));
    const naval = seaDomain(rep.domain);
    chip(`${(st.mass / 1000).toFixed(1)} t`);
    chip(`${st.power}/${st.drawn} kW`);
    if (naval) chip(`reserve ${Math.round(st.reserve * 100)}%`);
    else chip(`${st.powerToWeight.toFixed(1)} kW/t`);
    chip(`${rep.topSpeed} km/h`);
    chip(`cost ${rep.cost}`);
    // Stats drawer: numbers only.
    const S = this.stats;
    S.textContent = '';
    const head = (t) => S.appendChild(el('div', 'dz-h', t));
    const row = (k, v) => { const r = el('div', 'dz-row'); r.appendChild(el('span', '', k)); r.appendChild(el('b', '', String(v))); S.appendChild(r); };
    head(`Stats · ${DOMAIN_NAMES[rep.domain]}`);
    row('Mass', `${(st.mass / 1000).toFixed(2)} t`);
    row('Centre of mass', `${st.com.x.toFixed(1)}, ${st.com.y.toFixed(1)} m`);
    row('Power', `${st.power} kW made, ${st.drawn} kW drawn`);
    row('Power to weight', `${st.powerToWeight.toFixed(1)} kW/t`);
    if (naval && st.hull) {
      row('Hull length', `${st.hull.length.toFixed(1)} m`);
      row('Beam', `${st.hull.beam.toFixed(1)} m`);
      row('Displacement, hull full', `${(st.dispMax / 1000).toFixed(1)} t`);
      row('Draft', `${st.draft.toFixed(2)} m`);
      row('Freeboard', `${st.freeboard.toFixed(2)} m`);
      row('Reserve buoyancy', `${Math.round(st.reserve * 100)}%`);
      row('Centre of buoyancy (B)', `${st.cob.x.toFixed(1)}, ${st.cob.y.toFixed(1)} m`);
      row('Centre of mass from B', `${Math.abs(st.com.x - st.cob.x).toFixed(2)} m ${st.com.x >= st.cob.x ? 'forward' : 'aft'}`);
      if (rep.domain === 'sub') {
        row('Ballast tanks hold', `${(st.ballastCap / 1000).toFixed(1)} t`);
        row('Ballast to dive', `${(Math.max(0, st.diveNeed) / 1000).toFixed(1)} t`);
        row('Electric power', `${st.electric} kW`);
      }
    } else {
      row('Ground pressure', Number.isFinite(st.pressure) ? `${Math.round(st.pressure)} kPa` : '—');
      row('Tip angle', `${Math.round(st.tipAngle)}°`);
      row('Climb limit', `${rep.climb}°`);
    }
    row('Crew space', `${st.crew}`);
    row('Fuel', `${st.fuel} L`);
    row('Shells', `${st.shells + 10}`);
    head('Top speed');
    for (const [k, v] of Object.entries(rep.speeds)) row(k, `${v} km/h`);
    head('Armour');
    row('Front (at centre of mass)', rep.armour.front);
    row('Rear', rep.armour.rear);
    row('Top', rep.armour.top);
    head('Weapons');
    if (!rep.weapons.length) row('None', '');
    for (const w of rep.weapons) row(w.name, `${w.pen} mm · ${Math.round(weaponRange(w))} m`);
    head('Cost');
    row('Parts', rep.cost);
    row('Requisition to build', this.buildCost());
    row('Requisition held', save.profile.requisition);
    const cmp = s.baseOwned ? changeLog(s.base, cropDesign(d)) : [];
    if (cmp.length) { head(`Changes vs ${markName(s.base)}`); for (const l of cmp) S.appendChild(el('div', 'dz-note', l)); }
    const errs = rep.valid.errors;
    if (errs.length || rep.warnings.length) {
      head('Notes');
      for (const e of errs) S.appendChild(el('div', 'dz-note bad', e));
      for (const w of rep.warnings) S.appendChild(el('div', 'dz-note', w));
    }
    const valid = rep.valid.ok;
    this.testBtn.disabled = !valid;
    const need = this.buildCost();
    this.saveBtn.disabled = !valid || !this.changed() || need > save.profile.requisition;
    if (!this.msg) this.say(valid ? (need > save.profile.requisition ? `Saving needs ${need} Requisition; you have ${save.profile.requisition}.` : 'Tap a part in the list, then tap the grid.') : errs[0], !valid);
  },

  changed() {
    const a = cropDesign(this.st.d), b = cropDesign(this.st.base);
    if (a.cells.length !== b.cells.length) return true;
    const key = (d) => d.cells.map((c) => `${c.p}@${c.x},${c.y}`).sort().join('|');
    return key(a) !== key(b);
  },

  // Requisition to build: the price difference from a design you already own, or the full cost.
  buildCost() {
    const now = costOf(this.st.d);
    const before = this.st.baseOwned ? costOf(this.st.base) : 0;
    return Math.max(0, now - before);
  },

  newMenu() {
    const c = ui.card('New design');
    const col = el('div', 'card-col');
    let close = null;
    for (const id of STARTING_TEMPLATES) {
      col.appendChild(button(`Template: ${TEMPLATES[id].name} Mk.I`, () => { close(); this.load(designFromTemplate(id), null, true); this.build(); }));
    }
    for (const cls of Object.keys(CLASSES)) col.appendChild(button(`Randomise (${CLASSES[cls].name.toLowerCase()})`, () => { close(); this.randomise(cls); }));
    col.appendChild(button('Scratch build (ground)', () => { close(); this.load(this.scratch(), null, false); this.build(); }));
    col.appendChild(button('Scratch build (ship)', () => { close(); this.load(this.scratch('ship'), null, false); this.build(); }));
    col.appendChild(button('Cancel', () => close(), 'btn', 'back'));
    c.appendChild(col);
    c.classList.add('card-scroll');
    close = ui.open(c);
  },

  randomise(cls) {
    this.seed = (this.seed || 1000) + 1;
    const d = randomDesign(this.seed * 104729, cls);
    d.name = d.family = { heavy: 'Heavy design', ship: 'Ship design', sub: 'Submarine design' }[cls] || 'Light design';
    this.load(d, null, false);
    this.build();
    audio.sfx('swap');
  },

  rename() {
    const c = ui.card('Rename design');
    const inp = el('input', 'text-in');
    inp.type = 'text';
    inp.maxLength = 28;
    inp.value = this.st.d.family;
    c.appendChild(inp);
    const row = el('div', 'card-row');
    let close = null;
    row.appendChild(button('Cancel', () => close(), 'btn', 'back'));
    row.appendChild(button('Rename', () => {
      const v = inp.value.trim();
      if (v) { this.st.d.family = v; this.st.d.name = v; }
      close();
      this.refresh();
    }, 'btn btn-primary'));
    c.appendChild(row);
    close = ui.open(c);
    setTimeout(() => inp.focus(), 50);
  },

  saveDesign() {
    const s = this.st;
    const rep = designReport(s.d);
    if (!rep.valid.ok) { this.say(rep.valid.errors[0], true); return; }
    const need = this.buildCost();
    if (need > save.profile.requisition) { this.say(`Saving needs ${need} Requisition; you have ${save.profile.requisition}.`, true); return; }
    const out = cropDesign(s.d);
    const fromSaved = save.designs.list.find((x) => x.id === s.base.id);
    const sameFamily = s.baseOwned && s.d.family === (s.base.family || s.base.name);
    const mark = sameFamily ? (s.base.mark || 1) + 1 : 1;
    const design = {
      id: 'd' + Date.now().toString(36),
      family: s.d.family,
      name: '',
      mark,
      w: out.w, h: out.h,
      cells: out.cells,
      changelog: s.baseOwned ? changeLog(s.base, out) : ['New design'],
      parent: fromSaved ? fromSaved.id : s.base.id,
      cost: rep.cost,
      created: Date.now(),
    };
    design.name = markName(design);
    save.designs.list.push(design);
    save.profile.requisition -= need;
    // A refit replaces the older mark in the squad.
    const sq = save.profile.squad;
    for (let i = 0; i < sq.length; i++) if (sq[i] === s.base.id) sq[i] = design.id;
    save.touch('designs');
    save.touch('profile');
    save.flush();
    audio.sfx('medal');
    ui.toast(`Saved ${design.name}.${need ? ` ${need} Requisition spent.` : ''}`);
    this.load(design, design, true);
    this.build();
  },

  testDrive() {
    const d = cropDesign(this.st.d);
    if (!validateDesign(d).ok) { this.say('Test drive needs a valid design.', true); return; }
    d.name = markName(this.st.d);
    screens.go('battle', { test: d, back: { restore: this.st } });
  },

  back() {
    if (this.changed()) {
      ui.confirm('Leave without saving? The changes will be lost.', 'Leave', () => screens.go(this.returnTo || 'workshop'), 'Keep editing');
    } else screens.go(this.returnTo || 'workshop');
  },

  // ---------- layout and drawing
  layout() {
    if (!this.root) return;
    const ui0 = uiLayer.getBoundingClientRect();
    const top = this.root.querySelector('.dz-top').getBoundingClientRect();
    const pal = this.palette.getBoundingClientRect();
    const sta = this.stats.getBoundingClientRect();
    const bl = this.root.querySelector('.dz-bl').getBoundingClientRect();
    const x = pal.right - ui0.left + 8;
    const y = top.bottom - ui0.top + 6;
    const w = sta.left - ui0.left - 8 - x;
    const h = bl.top - ui0.top - 22 - y;
    const d = this.st.d;
    const cs = Math.max(4, Math.min(w / d.w, h / d.h)) * this.st.zoom;
    this.cs = cs;
    this.gridRect = { x, y, w, h, ox: x + (w - d.w * cs) / 2 + this.st.panX, oy: y + (h - d.h * cs) / 2 + this.st.panY };
  },

  update() {},

  render(g) {
    const { w, h } = layout;
    g.fillStyle = BLUEPRINT.bg;
    g.fillRect(0, 0, w, h);
    if (!this.st || !this.cs) return;
    const d = this.st.d, cs = this.cs, R = this.gridRect;
    const ox = R.ox, oy = R.oy;
    g.save();
    g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip();
    // Grid.
    g.strokeStyle = BLUEPRINT.grid;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= d.w; x++) { g.moveTo(ox + x * cs + 0.5, oy); g.lineTo(ox + x * cs + 0.5, oy + d.h * cs); }
    for (let y = 0; y <= d.h; y++) { g.moveTo(ox, oy + y * cs + 0.5); g.lineTo(ox + d.w * cs, oy + y * cs + 0.5); }
    g.stroke();
    g.strokeStyle = BLUEPRINT.line;
    g.strokeRect(ox + 0.5, oy + 0.5, d.w * cs, d.h * cs);
    // Ground line under the bottom row (land designs).
    if (!this.rep || !seaDomain(this.rep.domain)) {
      g.fillStyle = 'rgba(214,238,255,0.25)';
      g.fillRect(ox, oy + d.h * cs, d.w * cs, 3);
    }
    // Parts: structure first.
    const order = d.cells.map((_, i) => i).sort((a, b) => (PARTS[d.cells[a].p].cat === 'structure' ? 0 : 1) - (PARTS[d.cells[b].p].cat === 'structure' ? 0 : 1));
    for (const i of order) {
      if (this.move && this.move.idx === i) continue;
      const c = d.cells[i];
      drawPart(g, { def: PARTS[c.p], scorch: 0 }, ox + c.x * cs, oy + c.y * cs, cs, 0, i);
      if (PARTS[c.p].cat === 'weapon' && PARTS[c.p].id !== 'smoke' && !PARTS[c.p].secondary) {
        // Barrel preview at zero elevation.
        const P = PARTS[c.p];
        const px = ox + (c.x + 0.5) * cs, py = oy + (c.y + P.h / 2) * cs;
        const len = barrelLength(P) * cs * 2;
        if (art.debug) { drawArtMarker(g, 'pivot', px, py); drawArtMarker(g, 'muzzle', px + len, py); }
        if (drawBarrelArt(g, P, px, py, 0, len)) continue;
        g.strokeStyle = '#30343b';
        g.lineWidth = Math.max(2, (P.auto ? 0.07 : 0.06 + P.cal / 900) * cs * 2);
        g.beginPath();
        g.moveTo(ox + (c.x + 0.5) * cs, oy + (c.y + P.h / 2) * cs);
        g.lineTo(ox + (c.x + 0.5) * cs + barrelLength(P) * cs * 2, oy + (c.y + P.h / 2) * cs);
        g.stroke();
      }
    }
    if (art.debug) for (const c of d.cells) if (art.get(c.p)) drawArtMarker(g, 'origin', ox + c.x * cs, oy + c.y * cs);
    // Selected part outline.
    if (this.st.sel >= 0 && d.cells[this.st.sel]) {
      const c = d.cells[this.st.sel], P = PARTS[c.p];
      g.strokeStyle = PAL.amber; g.lineWidth = 2;
      g.strokeRect(ox + c.x * cs + 1, oy + c.y * cs + 1, P.w * cs - 2, P.h * cs - 2);
    }
    // Ghost: placing from the palette, or moving a part.
    const ghost = this.move ? { id: d.cells[this.move.idx].p, x: this.move.x, y: this.move.y, ignore: this.move.idx }
      : this.hover && this.st.brush ? { id: this.st.brush, x: this.hover.x, y: this.hover.y, ignore: -1 } : null;
    if (ghost) {
      const P = PARTS[ghost.id];
      const why = this.placeCheck(ghost.id, ghost.x, ghost.y, ghost.ignore);
      g.globalAlpha = 0.6;
      drawPart(g, { def: P, scorch: 0 }, ox + ghost.x * cs, oy + ghost.y * cs, cs, 0, 1);
      g.globalAlpha = 1;
      g.fillStyle = why ? 'rgba(255,107,90,0.35)' : 'rgba(127,211,255,0.35)';
      g.fillRect(ox + ghost.x * cs, oy + ghost.y * cs, P.w * cs, P.h * cs);
      g.strokeStyle = why ? BLUEPRINT.invalid : BLUEPRINT.valid;
      g.lineWidth = 2;
      g.strokeRect(ox + ghost.x * cs, oy + ghost.y * cs, P.w * cs, P.h * cs);
    }
    this.drawBalance(g, ox, oy, cs);
    g.restore();
  },

  // Balance markers (design/01 §8.6): centre of mass, contact base and tip angle (ground),
  // waterline and centre of buoyancy (ships).
  drawBalance(g, ox, oy, cs) {
    const rep = this.rep;
    if (!rep || !rep.st.mass) return;
    const st = rep.st, d = this.st.d;
    const px = ox + (st.com.x / CELL) * cs;
    const py = oy + (d.h - st.com.y / CELL) * cs;
    if (seaDomain(rep.domain) && st.hull) {
      // Waterline across the grid, with the water below it tinted.
      const wy = oy + (d.h - st.waterline / CELL) * cs;
      g.fillStyle = 'rgba(127,211,255,0.12)';
      g.fillRect(ox, wy, d.w * cs, oy + d.h * cs - wy);
      g.strokeStyle = BLUEPRINT.valid; g.lineWidth = 2;
      g.setLineDash([8, 5]);
      g.beginPath(); g.moveTo(ox, wy); g.lineTo(ox + d.w * cs, wy); g.stroke();
      g.setLineDash([]);
      g.font = `700 12px ${FONT_UI}`;
      g.textAlign = 'right'; g.textBaseline = 'bottom';
      g.fillStyle = BLUEPRINT.valid;
      g.fillText(st.reserve > 0 ? `waterline · draft ${st.draft.toFixed(2)} m` : 'hull under water', Math.min(ox + d.w * cs, this.gridRect.x + this.gridRect.w) - 4, wy - 2);
      g.textAlign = 'left';
      // Centre of buoyancy: a ring with a cross.
      const bx = ox + (st.cob.x / CELL) * cs, by = oy + (d.h - st.cob.y / CELL) * cs;
      if (st.reserve > 0) {
        g.strokeStyle = BLUEPRINT.valid; g.lineWidth = 2;
        g.beginPath(); g.arc(bx, by, 6, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.moveTo(bx - 9, by); g.lineTo(bx + 9, by); g.moveTo(bx, by - 9); g.lineTo(bx, by + 9); g.stroke();
        g.textBaseline = 'top';
        g.fillText('B', bx + 8, by + 3);
        // Vertical line from the centre of mass: the horizontal gap between them is the trim moment.
        g.setLineDash([3, 4]);
        g.strokeStyle = 'rgba(255,178,62,0.6)';
        g.beginPath(); g.moveTo(px, py); g.lineTo(px, by); g.stroke();
        g.setLineDash([]);
      }
    }
    // Contact base.
    let x0 = Infinity, x1 = -Infinity;
    for (const c of d.cells) { const P = PARTS[c.p]; if (P.loco) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x + P.w); } }
    if (x1 > x0) {
      const by = oy + d.h * cs + 6;
      g.strokeStyle = PAL.amber; g.lineWidth = 2;
      g.beginPath(); g.moveTo(ox + x0 * cs, by - 4); g.lineTo(ox + x0 * cs, by); g.lineTo(ox + x1 * cs, by); g.lineTo(ox + x1 * cs, by - 4); g.stroke();
      // Tip lines: from the base corners up through the centre of mass.
      g.setLineDash([4, 4]);
      g.strokeStyle = 'rgba(255,178,62,0.6)';
      g.beginPath(); g.moveTo(ox + x0 * cs, by); g.lineTo(px, py); g.lineTo(ox + x1 * cs, by); g.stroke();
      g.setLineDash([]);
    }
    g.strokeStyle = PAL.amber; g.fillStyle = BLUEPRINT.bg; g.lineWidth = 2;
    g.beginPath(); g.arc(px, py, 7, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = PAL.amber;
    g.beginPath(); g.moveTo(px, py); g.arc(px, py, 7, -Math.PI / 2, 0); g.lineTo(px, py); g.fill();
    g.beginPath(); g.moveTo(px, py); g.arc(px, py, 7, Math.PI / 2, Math.PI); g.lineTo(px, py); g.fill();
    g.font = `700 12px ${FONT_UI}`;
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = PAL.linen;
    if (!seaDomain(rep.domain)) g.fillText(`tip ${Math.round(st.tipAngle)}°`, px + 11, py);
  },
};
