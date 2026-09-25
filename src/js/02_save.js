/* ==== 02 SAVE ==== */
// Blob format: {v: SAVE_VERSION, t: timestamp, data}. Every storage call is
// wrapped in try/catch; the game runs without storage (e.g. private mode).

// Low-level storage. Never throws.
const store = {
  ok: (() => {
    try {
      const k = STORE_PREFIX + '__probe';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (_e) { return false; }
  })(),
  read(key) {
    try { return localStorage.getItem(STORE_PREFIX + key); } catch (_e) { return null; }
  },
  write(key, text) {
    try { localStorage.setItem(STORE_PREFIX + key, text); return true; } catch (_e) { return false; }
  },
  remove(key) {
    try { localStorage.removeItem(STORE_PREFIX + key); } catch (_e) { /* ignore */ }
  },
};

// Migrations: MIGRATIONS[key][v] turns version v data into version v+1 data.
// Add one whenever SAVE_VERSION goes up. Example for a future v2:
//   MIGRATIONS.profile[1] = (d) => ({ ...d, newField: 0 });
const MIGRATIONS = {
  settings: {
    1: (d) => d,
  },
  profile: {
    // v1 -> v2: the ladder run, Requisition, squad and stats arrive. An unfinished v1
    // ladder (continueLevel > 1) becomes a run to continue with 3 lives.
    1: (d) => Object.assign({}, d, {
      run: { active: (d.continueLevel || 1) > 1, level: d.continueLevel || 1, lives: 3, score: 0 },
      requisition: 150,
      squad: [],
      stats: { battles: 0, kills: 0, cleared: Math.max(0, (d.highestLevel || 1) - 1) },
    }),
  },
  designs: {},
};

const SAVE_KEYS = {
  settings: DEFAULT_SETTINGS,
  profile: DEFAULT_PROFILE,
  designs: DEFAULT_DESIGNS,
};

const clone = (o) => JSON.parse(JSON.stringify(o));

// Keep only known fields whose type matches the default, so a damaged or
// older blob can never put a wrong-typed value into the game.
function mergeDefaults(defaults, data) {
  const out = clone(defaults);
  if (!data || typeof data !== 'object') return out;
  for (const k of Object.keys(defaults)) {
    const d = defaults[k];
    const v = data[k];
    if (v === undefined || v === null) continue;
    if (Array.isArray(d)) { if (Array.isArray(v)) out[k] = v; }
    else if (typeof v === typeof d) out[k] = v;
  }
  return out;
}

// Migrate a {v, data} pair up to SAVE_VERSION. Throws if it can't.
function migrate(key, v, data) {
  if (typeof v !== 'number' || v < 1) throw new Error('bad version');
  if (v > SAVE_VERSION) throw new Error('made by a newer version of the game');
  while (v < SAVE_VERSION) {
    const fn = MIGRATIONS[key] && MIGRATIONS[key][v];
    if (fn) data = fn(data);
    v++;
  }
  return data;
}

const save = {
  settings: clone(DEFAULT_SETTINGS),
  profile: clone(DEFAULT_PROFILE),
  designs: clone(DEFAULT_DESIGNS),
  notices: [],          // messages for the player, shown as toasts at boot
  firstRun: false,
  dirty: new Set(),
  timer: 0,
  failedOnce: false,

  load() {
    this.firstRun = store.read('settings') === null;
    for (const key of Object.keys(SAVE_KEYS)) this[key] = this.loadKey(key);
  },

  loadKey(key) {
    const defaults = SAVE_KEYS[key];
    const raw = store.read(key);
    if (raw === null) return clone(defaults);
    try {
      const blob = JSON.parse(raw);
      const data = migrate(key, blob.v, blob.data);
      return mergeDefaults(defaults, data);
    } catch (e) {
      // Never wipe silently: keep the old blob, start fresh for this key only, tell the player.
      store.write('backup.' + key, raw);
      store.remove(key);
      const what = key === 'settings' ? 'settings' : 'progress';
      const why = /newer/.test(e.message) ? 'they were made by a newer version of the game' : 'the save was damaged';
      this.notices.push(`Your saved ${what} couldn't be read because ${why}. A backup was kept, and your ${what} start fresh.`);
      return clone(defaults);
    }
  },

  // Mark a key as changed; it is written within 1 s.
  touch(key) {
    this.dirty.add(key);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 1000);
  },

  flush() {
    clearTimeout(this.timer);
    for (const key of this.dirty) {
      const text = JSON.stringify({ v: SAVE_VERSION, t: Date.now(), data: this[key] });
      if (!store.write(key, text) && !this.failedOnce) {
        this.failedOnce = true;
        bus.emit('toast', store.ok
          ? "Couldn't save: storage is full."
          : "Saving is blocked in this browser, so progress won't be kept.");
      }
    }
    this.dirty.clear();
  },

  setSetting(name, value) {
    if (this.settings[name] === value) return;
    this.settings[name] = value;
    this.touch('settings');
    bus.emit('settings', name);
  },

  // Export: JSON -> base64 text the player can copy.
  exportCode() {
    const payload = { game: 'irondoctrine', v: SAVE_VERSION, t: Date.now(), settings: this.settings, profile: this.profile, designs: this.designs };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  },

  // Import: returns {ok, error, apply}. Nothing changes until apply() is called.
  parseCode(code) {
    try {
      const bin = atob(String(code).replace(/\s+/g, ''));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const p = JSON.parse(new TextDecoder().decode(bytes));
      if (!p || p.game !== 'irondoctrine') return { ok: false, error: "That code isn't an Iron Doctrine save." };
      const settings = mergeDefaults(DEFAULT_SETTINGS, migrate('settings', p.v, p.settings));
      const profile = mergeDefaults(DEFAULT_PROFILE, migrate('profile', p.v, p.profile));
      const designs = mergeDefaults(DEFAULT_DESIGNS, p.designs ? migrate('designs', p.v, p.designs) : null);
      return {
        ok: true,
        summary: `Best score ${profile.bestScore}, highest level ${profile.highestLevel}.`,
        apply: () => {
          this.settings = settings;
          this.profile = profile;
          this.designs = designs;
          this.dirty.add('settings'); this.dirty.add('profile'); this.dirty.add('designs');
          this.flush();
          bus.emit('settings', '*');
        },
      };
    } catch (e) {
      return { ok: false, error: e && /newer/.test(e.message) ? 'That save was made by a newer version of the game.' : "That code couldn't be read. Check it was copied in full." };
    }
  },

  resetProgress() {
    this.profile = clone(DEFAULT_PROFILE);
    this.designs = clone(DEFAULT_DESIGNS);
    this.touch('profile');
    this.touch('designs');
    this.flush();
  },
};
