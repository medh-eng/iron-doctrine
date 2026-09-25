/* ==== 06 UI ==== */
// DOM overlays: menus, cards, Settings, toasts. Floating text is drawn on canvas.

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// A button that clicks, buzzes and calls fn.
function button(label, fn, cls = 'btn', sound = 'tap') {
  const b = el('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', () => {
    audio.unlock();
    audio.sfx(sound);
    haptic('tap');
    fn();
  });
  return b;
}

const ui = {
  stack: [],            // open modal cards, top last
  toastBox: null,

  init() {
    this.toastBox = el('div', 'toasts');
    this.toastBox.setAttribute('aria-live', 'polite');
    uiLayer.appendChild(this.toastBox);
    bus.on('toast', (msg) => this.toast(msg));
  },

  modalOpen() { return this.stack.length > 0; },

  toast(msg, ms = 2800) {
    const t = el('div', 'toast', msg);
    this.toastBox.appendChild(t);
    while (this.toastBox.children.length > 3) this.toastBox.firstChild.remove();
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
  },

  // Opens a modal card. Returns a close function.
  open(card, onClose) {
    const scrim = el('div', 'scrim');
    scrim.appendChild(card);
    uiLayer.appendChild(scrim);
    const entry = { scrim, onClose };
    this.stack.push(entry);
    input.releaseAll();
    // Focus the main button after a moment, so a key held for the game (Space to fire) can't click it.
    const first = card.querySelector('.btn-primary') || card.querySelector('button');
    if (first && FINE_POINTER.matches) setTimeout(() => { if (first.isConnected) first.focus({ preventScroll: true }); }, 450);
    return () => this.close(entry);
  },

  close(entry) {
    const i = this.stack.indexOf(entry);
    if (i < 0) return;
    this.stack.splice(i, 1);
    entry.scrim.remove();
    if (entry.onClose) entry.onClose();
  },

  closeTop() {
    if (this.stack.length) this.close(this.stack[this.stack.length - 1]);
  },

  card(title, cls = '') {
    const c = el('div', 'card ' + cls);
    c.setAttribute('role', 'dialog');
    c.setAttribute('aria-label', title);
    if (title) c.appendChild(el('h2', 'card-title', title));
    return c;
  },

  confirm(text, yesLabel, onYes, noLabel = 'Cancel') {
    const c = this.card('');
    c.appendChild(el('p', 'card-text', text));
    const row = el('div', 'card-row');
    let close = null;
    row.appendChild(button(noLabel, () => close(), 'btn', 'back'));
    row.appendChild(button(yesLabel, () => { close(); onYes(); }, 'btn btn-warn'));
    c.appendChild(row);
    close = this.open(c);
  },

  // ---------- Pause card (design/02 §6)
  openPause(opts) {
    const c = this.card('Paused', 'card-pause');
    const col = el('div', 'card-col');
    let close = null;
    col.appendChild(button('Resume', () => close(), 'btn btn-primary'));
    col.appendChild(button('Settings', () => this.openSettings()));
    if (opts.restart) col.appendChild(button(opts.restartLabel || 'Restart level', () => { close(); opts.restart(); }));
    col.appendChild(button(opts.quitLabel || 'Quit to title', () => { close(); opts.quit(); }, 'btn', 'back'));
    c.appendChild(col);
    close = this.open(c, opts.onClose);
    return close;
  },

  // ---------- Settings (design/02 §7)
  openSettings(onClose) {
    const s = save.settings;
    const c = this.card('', 'card-settings');
    const head = el('div', 'settings-head');
    head.appendChild(el('h2', 'card-title', 'Settings'));
    let close = null;
    const done = button('Done', () => close(), 'btn btn-small', 'back');
    head.appendChild(done);
    c.appendChild(head);

    const body = el('div', 'settings-body');
    const tabs = el('div', 'settings-tabs');
    tabs.setAttribute('role', 'tablist');
    const pane = el('div', 'settings-pane');
    body.appendChild(tabs);
    body.appendChild(pane);
    c.appendChild(body);

    const row = (label, control, note) => {
      const r = el('div', 'set-row');
      const l = el('div', 'set-label', label);
      if (note) l.appendChild(el('span', 'set-note', note));
      r.appendChild(l);
      r.appendChild(control);
      return r;
    };
    const toggle = (name) => {
      const b = el('button', 'switch');
      b.type = 'button';
      b.setAttribute('role', 'switch');
      b.dataset.setting = name;
      const sync = () => { b.setAttribute('aria-checked', String(!!s[name])); };
      sync();
      b.addEventListener('click', () => {
        save.setSetting(name, !s[name]);
        audio.unlock();
        audio.sfx(s[name] ? 'toggleOn' : 'toggleOff');
        if (name === 'vibration' && s.vibration) haptic('tap');
        sync();
      });
      return b;
    };
    const slider = (name, min, max, step, fmt) => {
      const wrap = el('div', 'slider');
      const inp = el('input');
      inp.type = 'range';
      inp.min = min; inp.max = max; inp.step = step;
      inp.value = s[name];
      inp.dataset.setting = name;
      const out = el('span', 'slider-val', fmt(s[name]));
      inp.addEventListener('input', () => {
        save.setSetting(name, parseFloat(inp.value));
        out.textContent = fmt(s[name]);
      });
      inp.addEventListener('change', () => audio.sfx('tick', 0, 2));
      wrap.appendChild(inp);
      wrap.appendChild(out);
      return wrap;
    };
    const segmented = (name, options) => {
      const wrap = el('div', 'seg');
      wrap.setAttribute('role', 'radiogroup');
      const btns = options.map((o) => {
        const b = el('button', 'seg-btn', o);
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.dataset.setting = name;
        b.dataset.value = o;
        b.addEventListener('click', () => {
          audio.sfx('tap');
          save.setSetting(name, o);
          for (const x of btns) x.setAttribute('aria-checked', String(x.dataset.value === s[name]));
        });
        b.setAttribute('aria-checked', String(o === s[name]));
        wrap.appendChild(b);
        return b;
      });
      return wrap;
    };
    const pct = (v) => Math.round(v * 100) + '%';

    const sections = {
      Audio: () => [
        row('Music', toggle('music')),
        row('Music volume', slider('musicVol', 0, 1, 0.05, pct)),
        row('Sound', toggle('sound')),
        row('Sound volume', slider('soundVol', 0, 1, 0.05, pct)),
        row('Vibration', toggle('vibration')),
      ],
      Controls: () => [
        row('Button opacity', slider('btnOpacity', 0.1, 0.8, 0.05, pct)),
        row('Button size', segmented('btnSize', ['S', 'M', 'L'])),
        row('Left-handed', toggle('leftHanded'), 'Fire on the left, drive on the right'),
        row('Auto-recenter camera', toggle('autoRecenter'), 'After 4 s without touching the world'),
        row('Aim assist line', toggle('aimAssist')),
      ],
      Display: () => [
        row('Full screen', toggle('fullscreen'), 'Goes full screen on your first tap'),
        row('Graphics quality', segmented('quality', ['Low', 'Medium', 'High'])),
        row('Reduced motion', toggle('reducedMotion'), 'No shake, fewer flashes'),
        row('Show FPS', toggle('showFps')),
      ],
      Data: () => this.dataSection(row),
    };

    const tabBtns = [];
    const show = (name) => {
      pane.textContent = '';
      for (const r of sections[name]()) pane.appendChild(r);
      pane.scrollTop = 0;
      for (const t of tabBtns) t.setAttribute('aria-selected', String(t.dataset.tab === name));
      this.settingsTab = name;
    };
    for (const name of Object.keys(sections)) {
      const t = el('button', 'tab', name);
      t.type = 'button';
      t.setAttribute('role', 'tab');
      t.dataset.tab = name;
      t.addEventListener('click', () => { audio.sfx('tap'); show(name); });
      tabs.appendChild(t);
      tabBtns.push(t);
    }
    show(this.settingsTab || 'Audio');
    close = this.open(c, () => { save.flush(); if (onClose) onClose(); });
    return close;
  },

  dataSection(row) {
    const rows = [];
    // Export
    const exp = el('div', 'data-box');
    const expArea = el('textarea', 'code');
    expArea.readOnly = true;
    expArea.rows = 2;
    expArea.hidden = true;
    const copy = button('Copy', () => {
      expArea.select();
      const done = () => this.toast('Save code copied.');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(expArea.value).then(done, () => { try { document.execCommand('copy'); done(); } catch (_e) { this.toast('Select the code and copy it by hand.'); } });
      } else {
        try { document.execCommand('copy'); done(); } catch (_e) { this.toast('Select the code and copy it by hand.'); }
      }
    }, 'btn btn-small');
    copy.hidden = true;
    const showCode = button('Show save code', () => {
      save.flush();
      expArea.value = save.exportCode();
      expArea.hidden = false;
      copy.hidden = false;
      showCode.hidden = true;
    }, 'btn btn-small');
    const expBtns = el('div', 'data-btns');
    expBtns.appendChild(showCode);
    expBtns.appendChild(copy);
    exp.appendChild(expBtns);
    exp.appendChild(expArea);
    rows.push(row('Export save', exp, 'Copy this code to keep a backup'));

    // Import
    const imp = el('div', 'data-box');
    const impArea = el('textarea', 'code');
    impArea.rows = 2;
    impArea.placeholder = 'Paste a save code';
    const impBtn = button('Import', () => {
      const res = save.parseCode(impArea.value);
      if (!res.ok) { audio.sfx('error'); this.toast(res.error); return; }
      this.confirm(`Replace your current progress and settings with this save? ${res.summary}`, 'Import', () => {
        res.apply();
        this.toast('Save imported.');
        impArea.value = '';
        bus.emit('profile');
      });
    }, 'btn btn-small');
    imp.appendChild(impArea);
    imp.appendChild(impBtn);
    rows.push(row('Import save', imp));

    // Reset (confirm twice)
    rows.push(row('Reset progress', button('Reset', () => {
      this.confirm('Reset best score, levels, Requisition, designs, blueprints and medals? Settings are kept.', 'Reset', () => {
        this.confirm("Are you sure? This can't be undone.", 'Yes, reset', () => {
          save.resetProgress();
          bus.emit('profile');
          this.toast('Progress reset.');
        });
      });
    }, 'btn btn-small btn-warn')));

    const ver = el('p', 'set-version', `Iron Doctrine v${GAME_VERSION} · save format ${SAVE_VERSION}` + (store.ok ? '' : ' · saving unavailable in this browser'));
    rows.push(ver);
    return rows;
  },
};

// ---------- floating text on canvas (design/03 §5): rises 40 px over 0.9 s, 1.2 -> 1.0 scale, max 8
const floaters = makePool(() => ({ alive: false, text: '', x: 0, y: 0, t: 0, amber: false }), MAX_FLOATING_TEXT);

function floatText(text, x, y, amber) {
  // Stack above recent texts at the same spot so they stay readable.
  for (let k = 0; k < 4; k++) {
    let clash = false;
    floaters.forEachAlive((o) => { if (o.t < 0.6 && Math.abs(o.x - x) < 6 && Math.abs(o.y - y) < 1.2) clash = true; });
    if (!clash) break;
    y += 1.6;
  }
  const f = floaters.take();
  f.text = text; f.x = x; f.y = y; f.t = 0; f.amber = !!amber;
}

function updateFloaters(dt) {
  floaters.forEachAlive((f) => { f.t += dt; if (f.t >= 0.9) f.alive = false; });
}

// toScreen(x, y) maps the stored position to screen px (world or screen space).
function drawFloaters(g, toScreenX, toScreenY) {
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(10,12,16,0.7)';
  floaters.forEachAlive((f) => {
    const p = f.t / 0.9;
    const e = easeOutCubic(p);
    const size = Math.round(15 * lerp(1.2, 1, clamp(p * 3, 0, 1)));
    g.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
    g.font = `700 ${size}px ${FONT_UI}`;
    g.fillStyle = f.amber ? PAL.amber : PAL.linen;
    const half = g.measureText(f.text).width / 2 + 8;
    const sx = clamp(toScreenX(f.x), layout.safe.l + half, layout.w - layout.safe.r - half);
    const sy = toScreenY(f.y) - 40 * e;
    g.strokeText(f.text, sx, sy);
    g.fillText(f.text, sx, sy);
  });
  g.restore();
}
