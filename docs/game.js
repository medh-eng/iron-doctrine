(() => {
'use strict';
/* ---------- 00_config.js ---------- */
/* ==== 00 CONFIG ==== */
// Version shown in Settings. Minor = build part (Part 1 = 0.1.x), patch = fixes.
const GAME_VERSION = '0.1.2';
// Bump when the save format changes, and add a migration in 02_save.js.
const SAVE_VERSION = 1;
const STORE_PREFIX = 'irondoctrine.';

// Rendering
const MAX_DPR = 2;            // device pixel ratio cap (quality setting may lower it)
const DESKTOP_MAX_W = 1280;   // desktop letterbox width limit (16:9)
const SIM_STEP = 1 / 60;      // fixed simulation step in seconds
const MAX_SIM_STEPS = 4;      // per frame; extra time is dropped when behind

// Palette (design/03 §2)
const PAL = {
  linen: '#E6DCC3',
  ink: '#22303F',
  league: '#2E6DB4',
  directorate: '#C43C2C',
  amber: '#FFB23E',
  cyanotype: '#13466B',
  skyTop: '#2F2946',
  sky2: '#8A4B5A',
  sky3: '#D9855A',
  horizon: '#F2C17A',
  ridgeFar: '#3B3F52',
  ridgeMid: '#2A2D3B',
  ground: '#1A1C24',
  groundEdge: '#4A4F63',
  good: '#7BC47F',
  warning: '#E8B04B',
  danger: '#E0533D',
};

const FONT_UI = '"Roboto Condensed", "sans-serif-condensed", "Arial Narrow", system-ui, sans-serif';
const FONT_STENCIL = '"Saira Stencil One", ' + FONT_UI;

// Settings defaults (design/02 §7). Stored under irondoctrine.settings.
const DEFAULT_SETTINGS = {
  music: true,
  musicVol: 0.7,
  sound: true,
  soundVol: 0.8,
  vibration: true,
  btnOpacity: 0.3,        // 0.1 to 0.8
  btnSize: 'M',           // S, M, L
  leftHanded: false,
  autoRecenter: true,
  aimAssist: true,
  fullscreen: true,
  quality: 'High',        // Low, Medium, High
  reducedMotion: false,   // first run copies the system preference
  showFps: false,
};

// Profile defaults (design/01 §14.4). Stored under irondoctrine.profile.
const DEFAULT_PROFILE = {
  bestScore: 0,
  highestLevel: 1,
  continueLevel: 1,
  blueprints: [],
  medals: [],
};

// Graphics quality (design/02 §7)
const QUALITY = {
  Low: { dpr: 1, particles: 120 },
  Medium: { dpr: 1.5, particles: 200 },
  High: { dpr: 2, particles: 300 },
};

// Thumb controls (design/02 §1, §8)
const BTN_SCALE = { S: 0.85, M: 1, L: 1.15 };  // FIRE is 64 / 76 / 88 px across
const FIRE_DIAMETER = 76;
const CONTROL_GHOST_AFTER = 4;     // seconds untouched before controls fade
const CONTROL_GHOST_ALPHA = 0.6;
const CONTROL_RELEASE_TIME = 0.12; // pressed look eases back over 120 ms

// Gestures (design/02 §3.5, §3.6)
const EDGE_IGNORE_PX = 24;
const TAP_MAX_MS = 300;
const TAP_MOVE_PX = 10;
const DOUBLE_TAP_MS = 320;
const LONG_PRESS_MS = 500;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const RECENTER_AFTER = 4;          // seconds without touching the world

// Haptic patterns in ms (design/02 §10)
const HAPTICS = {
  tap: 8,
  fire: 12,
  hit: 35,
  part: [20, 30, 20],
  lost: [80, 40, 80],
  clear: [30, 40, 30, 40, 120],
};

// Audio (design/03 §6, §7)
const AUDIO_MAX_VOICES = 24;
const AUDIO_LOOKAHEAD = 0.12;      // seconds scheduled ahead
const AUDIO_TICK_MS = 25;

// Pools
const MAX_FLOATING_TEXT = 8;
const MAX_TRACERS = 48;

/* ---------- 01_util.js ---------- */
/* ==== 01 UTIL ==== */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// Seeded RNG (mulberry32). All simulation randomness must come from one of these.
function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => Math.floor(a + (b - a + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

// Simple object pool to avoid per-frame garbage.
function makePool(create, size) {
  const items = [];
  for (let i = 0; i < size; i++) items.push(create());
  let cursor = 0;
  return {
    items,
    // Returns the next free item, or recycles the oldest if all are busy.
    take() {
      for (let i = 0; i < items.length; i++) {
        const it = items[(cursor + i) % items.length];
        if (!it.alive) { cursor = (cursor + i + 1) % items.length; it.alive = true; return it; }
      }
      const it = items[cursor];
      cursor = (cursor + 1) % items.length;
      it.alive = true;
      return it;
    },
    forEachAlive(fn) { for (let i = 0; i < items.length; i++) if (items[i].alive) fn(items[i]); },
  };
}

const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Tiny event bus for loose coupling between systems (e.g. settings changes).
function makeBus() {
  const map = new Map();
  return {
    on(name, fn) {
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(fn);
    },
    emit(name, arg) {
      const list = map.get(name);
      if (list) for (let i = 0; i < list.length; i++) list[i](arg);
    },
  };
}
const bus = makeBus();

/* ---------- 02_save.js ---------- */
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
const MIGRATIONS = { settings: {}, profile: {} };

const SAVE_KEYS = {
  settings: DEFAULT_SETTINGS,
  profile: DEFAULT_PROFILE,
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
    const payload = { game: 'irondoctrine', v: SAVE_VERSION, t: Date.now(), settings: this.settings, profile: this.profile };
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
      return {
        ok: true,
        summary: `Best score ${profile.bestScore}, highest level ${profile.highestLevel}.`,
        apply: () => {
          this.settings = settings;
          this.profile = profile;
          this.dirty.add('settings'); this.dirty.add('profile');
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
    this.touch('profile');
    this.flush();
  },
};

/* ---------- 03_audio.js ---------- */
/* ==== 03 AUDIO ==== */
// Web Audio only (design/03 §6, §7). Routing:
//   sfx bus ─────────────┐
//   music bus → duck ────┴→ master → compressor → speakers
// Unlocks on the first tap; suspends while the page is hidden.

const audio = {
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  duck: null,
  noise: null,
  voices: [],
  want: null,        // theme the current screen wants (plays once unlocked and music is on)
  theme: null,
  themeRng: null,
  nextStep: 0,
  stepIdx: 0,
  timer: 0,

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !game.hidden) this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (_e) { return; }
    const c = this.ctx;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    comp.connect(c.destination);
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp);
    this.sfxBus = c.createGain();
    this.sfxBus.connect(this.master);
    this.duck = c.createGain();
    this.duck.connect(this.master);
    this.musicBus = c.createGain();
    this.musicBus.connect(this.duck);

    // Two seconds of white noise, shared by every noisy sound.
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    const rng = makeRng(7);
    for (let i = 0; i < len; i++) d[i] = rng.next() * 2 - 1;

    this.applySettings();
    this.timer = setInterval(() => this.tick(), AUDIO_TICK_MS);
    if (c.state === 'suspended') c.resume().catch(() => {});
  },

  applySettings() {
    if (!this.ctx) return;
    const s = save.settings;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(s.sound ? s.soundVol : 0, t, 0.02);
    this.musicBus.gain.setTargetAtTime(s.music ? s.musicVol * 0.55 : 0, t, 0.05);
    this.syncTheme();
  },

  // Page hidden: suspend everything. Visible again: resume.
  setHidden(hidden) {
    if (!this.ctx) return;
    if (hidden) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  },

  // Pause card open: music drops to 40%, UI sounds still play.
  setPaused(paused) {
    if (!this.ctx) return;
    this.duck.gain.setTargetAtTime(paused ? 0.4 : 1, this.ctx.currentTime, 0.08);
  },

  // ---------- voices (max AUDIO_MAX_VOICES; the oldest quiet voice is stolen first)
  voice(bus, t, dur, peak, pan) {
    const c = this.ctx;
    const now = c.currentTime;
    let live = 0;
    for (let i = this.voices.length - 1; i >= 0; i--) {
      if (this.voices[i].end < now) this.voices.splice(i, 1);
      else live++;
    }
    if (live >= AUDIO_MAX_VOICES) {
      let victim = null;
      for (const v of this.voices) if (v.peak < 0.3 && (!victim || v.start < victim.start)) victim = v;
      if (!victim) for (const v of this.voices) if (!victim || v.start < victim.start) victim = v;
      if (victim) {
        victim.out.gain.cancelScheduledValues(now);
        victim.out.gain.setTargetAtTime(0, now, 0.01);
        victim.end = now;
        this.voices.splice(this.voices.indexOf(victim), 1);
      }
    }
    const out = c.createGain();
    if (pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      out.connect(p);
      p.connect(bus);
    } else {
      out.connect(bus);
    }
    this.voices.push({ out, start: t, end: t + dur + 0.05, peak });
    return out;
  },

  env(param, t, attack, peak, decay) {
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  },

  osc(type, hz, t, stop, dest) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(hz, t);
    o.connect(dest);
    o.start(t);
    o.stop(stop);
    return o;
  },

  noiseSrc(t, stop, dest) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.connect(dest);
    s.start(t, (t * 7.31) % 1.5);
    s.stop(stop);
    return s;
  },

  filter(type, hz, q, dest) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    if (q) f.Q.value = q;
    f.connect(dest);
    return f;
  },

  gain(dest) {
    const g = this.ctx.createGain();
    g.connect(dest);
    return g;
  },

  // ---------- instruments (design/03 §6.2)
  snare(bus, t, vel) {
    const out = this.voice(bus, t, 0.2, vel);
    const g = this.gain(out);
    this.env(g.gain, t, 0.002, vel * 0.5, 0.14);
    this.noiseSrc(t, t + 0.2, this.filter('bandpass', 1800, 0.9, g));
    const b = this.gain(out);
    this.env(b.gain, t, 0.001, vel * 0.3, 0.07);
    const o = this.osc('triangle', 190, t, t + 0.1, b);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.06);
  },

  timpani(bus, t, hz, vel) {
    const out = this.voice(bus, t, 1.3, vel);
    const g = this.gain(out);
    this.env(g.gain, t, 0.005, vel * 0.6, 1.1);
    const o = this.osc('sine', hz, t, t + 1.3, g);
    o.frequency.exponentialRampToValueAtTime(hz * 0.7, t + 0.3);
    const n = this.gain(out);
    this.env(n.gain, t, 0.002, vel * 0.35, 0.12);
    this.noiseSrc(t, t + 0.2, this.filter('lowpass', 180, 0, n));
  },

  kick(bus, t, vel) {
    const out = this.voice(bus, t, 0.4, vel);
    const g = this.gain(out);
    this.env(g.gain, t, 0.002, vel * 0.8, 0.35);
    const o = this.osc('sine', 120, t, t + 0.4, g);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
  },

  brass(bus, t, hz, dur, vel) {
    const c = this.ctx;
    const out = this.voice(bus, t, dur + 0.2, vel);
    const g = this.gain(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel * 0.2, t + 0.04);
    g.gain.setValueAtTime(vel * 0.2, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
    const f = this.filter('lowpass', 350, 1.5, g);
    f.frequency.setValueAtTime(350, t);
    f.frequency.linearRampToValueAtTime(2600, t + 0.06);
    f.frequency.linearRampToValueAtTime(1300, t + 0.25);
    const lfo = c.createOscillator();
    lfo.frequency.value = 5;
    lfo.start(t);
    lfo.stop(t + dur + 0.2);
    const depth = c.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(hz * 0.006, t + 0.3);
    lfo.connect(depth);
    for (const cents of [-8, 0, 8]) {
      const o = this.osc('sawtooth', hz, t, t + dur + 0.2, f);
      o.detune.value = cents;
      depth.connect(o.frequency);
    }
  },

  strings(bus, t, hz, dur, vel) {
    const c = this.ctx;
    const out = this.voice(bus, t, dur + 0.6, vel * 0.5);
    const g = this.gain(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel * 0.11, t + 0.35);
    g.gain.setValueAtTime(vel * 0.11, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
    const f = this.filter('lowpass', 1200, 0.5, g);
    const a = this.osc('sawtooth', hz, t, t + dur + 0.6, f);
    a.detune.value = -9;
    const b = this.osc('sawtooth', hz, t, t + dur + 0.6, f);
    b.detune.value = 9;
    // Light chorus: a slow wobble on one voice's tuning.
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.6;
    const depth = c.createGain();
    depth.gain.value = 6;
    lfo.connect(depth);
    depth.connect(b.detune);
    lfo.start(t);
    lfo.stop(t + dur + 0.6);
  },

  bugle(bus, t, hz, dur, vel) {
    const out = this.voice(bus, t, dur + 0.1, vel);
    const g = this.gain(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel * 0.18, t + 0.02);
    g.gain.linearRampToValueAtTime(vel * 0.14, t + 0.1);
    g.gain.setValueAtTime(vel * 0.14, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    const f = this.filter('lowpass', 3800, 0.7, g);
    this.osc('square', hz, t, t + dur + 0.1, f);
    this.osc('sawtooth', hz, t, t + dur + 0.1, f);
  },

  cymbal(bus, t, vel) {
    const out = this.voice(bus, t, 1.7, vel * 0.5);
    const g = this.gain(out);
    this.env(g.gain, t, 0.005, vel * 0.25, 1.6);
    this.noiseSrc(t, t + 1.7, this.filter('highpass', 5500, 0, g));
  },

  // ---------- music scheduler (look-ahead, design/03 §6.1)
  playTheme(name) {
    this.want = name;
    this.syncTheme();
  },

  syncTheme() {
    if (!this.ctx) return;
    const name = save.settings.music ? this.want : null;
    const theme = name ? THEMES[name] : null;
    if (theme === this.theme) return;
    this.theme = theme;
    if (theme) {
      this.stepIdx = 0;
      this.nextStep = this.ctx.currentTime + 0.1;
      this.themeRng = makeRng(theme.seed);
    }
  },

  tick() {
    const c = this.ctx;
    if (!c || c.state !== 'running' || !this.theme) return;
    const th = this.theme;
    const sd = 60 / th.bpm / 4;               // one 16th note
    if (this.nextStep < c.currentTime) this.nextStep = c.currentTime + 0.02;
    while (this.nextStep < c.currentTime + AUDIO_LOOKAHEAD) {
      th.step(this, this.stepIdx, this.nextStep, sd, this.themeRng);
      this.nextStep += sd;
      this.stepIdx++;
    }
  },

  // Battle music intensity 0..3 (design/03 §6.3).
  intensity: 0,
  setIntensity(n) { this.intensity = clamp(n, 0, 3); },

  // ---------- sound effects (design/03 §7)
  sfx(name, pan = 0, vel = 1) {
    if (!this.ctx || this.ctx.state !== 'running' || !save.settings.sound) return;
    const fn = SFX[name];
    if (fn) fn(this, this.ctx.currentTime + 0.005, pan, vel);
  },
};

// Themes: step(a, i, t, sd, rng) is called once per 16th note.
const THEMES = {
  // Battle: D natural minor, 100 bpm at intensity 0 rising to 132 at 3. Layers:
  // 0 snare ostinato + string drone; 1 + bass drum + string ostinato; 2 + brass motif; 3 + full brass + timpani rolls.
  battle: {
    bpm: 100,
    seed: 100,
    roots: [38, 34, 36, 33],            // Dm, Bb, C, Am (one per bar)
    thirds: [3, 4, 4, 3],
    motifs: [
      [[0, 62, 3], [3, 65, 1], [4, 69, 4], [8, 67, 2], [10, 65, 2], [12, 64, 4]],
      [[0, 69, 2], [2, 67, 2], [4, 65, 2], [6, 64, 2], [8, 62, 6], [14, 60, 2]],
      [[0, 62, 2], [2, 62, 2], [4, 65, 4], [8, 70, 4], [12, 69, 4]],
    ],
    motif: null,
    step(a, i, t, sd, rng) {
      const lvl = a.intensity;
      this.bpm = 100 + lvl * 10.67;
      const bus = a.musicBus;
      const bar = Math.floor(i / 16) % 4;
      const s = i % 16;
      const root = this.roots[bar];
      if (s === 0 && bar === 0) this.motif = rng.pick(this.motifs);
      // Snare ostinato with accents.
      if (s % 2 === 0) a.snare(bus, t, s % 8 === 4 ? 0.34 : 0.13);
      else if (lvl >= 2 && rng.next() < 0.25) a.snare(bus, t, 0.08);
      // String drone: root and fifth, a bar long.
      if (s === 0) {
        a.strings(bus, t, midiToHz(root), sd * 16, 0.9);
        a.strings(bus, t, midiToHz(root + 7), sd * 16, 0.7);
      }
      if (lvl >= 1) {
        if (s === 0 || s === 8 || (s === 11 && rng.next() < 0.5)) a.kick(bus, t, 0.7);
        if (s % 2 === 0) {
          const n = s % 4 === 0 ? root + 12 : root + 12 + (s % 8 === 2 ? this.thirds[bar] : 7);
          a.strings(bus, t, midiToHz(n), sd * 1.6, 0.55);
        }
      }
      if (lvl >= 2 && this.motif && (bar === 1 || bar === 3)) {
        for (const n of this.motif) if (n[0] === s) a.brass(bus, t, midiToHz(n[1]), n[2] * sd * 0.9, 0.8);
      }
      if (lvl >= 3) {
        if (s === 0 || s === 6 || s === 12) {
          a.brass(bus, t, midiToHz(root + 24), sd * 1.5, 0.6);
          a.brass(bus, t, midiToHz(root + 24 + this.thirds[bar]), sd * 1.5, 0.5);
        }
        if (bar === 3 && s >= 12) { a.timpani(bus, t, midiToHz(root + 12), 0.4); a.timpani(bus, t + sd / 2, midiToHz(root + 12), 0.3); }
      }
    },
  },
  // Title: slow march, 84 bpm, D Dorian. Strings, snare ruffs, brass motif.
  title: {
    bpm: 84,
    seed: 84,
    // One chord per bar, 8-bar loop. Midi notes: low root, fifth, third above.
    chords: [
      [38, 45, 53, 57], [38, 45, 53, 57], [36, 43, 52, 55], [43, 50, 55, 59],
      [38, 45, 53, 57], [41, 48, 53, 57], [43, 50, 55, 59], [45, 52, 57, 60],
    ],
    // Brass phrases, [step, midi, length in steps], two bars each.
    motifsA: [
      [[0, 64, 6], [6, 67, 2], [8, 72, 8], [16, 71, 6], [22, 69, 2], [24, 67, 8]],
      [[0, 67, 4], [4, 64, 4], [8, 67, 4], [12, 69, 4], [16, 71, 8], [24, 74, 8]],
      [[0, 60, 6], [6, 64, 2], [8, 67, 8], [16, 67, 4], [20, 71, 4], [24, 69, 8]],
    ],
    motifsB: [
      [[0, 65, 6], [6, 69, 2], [8, 72, 8], [16, 71, 6], [22, 74, 2], [24, 74, 8]],
      [[0, 69, 4], [4, 67, 4], [8, 65, 4], [12, 64, 4], [16, 62, 8], [24, 67, 8]],
      [[0, 72, 6], [6, 69, 2], [8, 65, 8], [16, 67, 6], [22, 71, 2], [24, 74, 8]],
    ],
    phraseA: null,
    phraseB: null,
    octave: 0,
    step(a, i, t, sd, rng) {
      const bus = a.musicBus;
      const bar = Math.floor(i / 16) % 8;
      const s = i % 16;
      if (i % 128 === 0) {
        // New loop: pick fresh phrases so the repeat isn't obvious.
        this.phraseA = rng.pick(this.motifsA);
        this.phraseB = rng.pick(this.motifsB);
        this.octave = i > 0 && rng.next() < 0.3 ? -12 : 0;
      }
      if (s === 0) {
        const ch = this.chords[bar];
        const dur = sd * 16;
        for (let k = 0; k < ch.length; k++) a.strings(bus, t, midiToHz(ch[k]), dur, k === 0 ? 1 : 0.8);
        if (bar === 0 || bar === 4) a.timpani(bus, t, midiToHz(ch[0]), 0.45);
      }
      // March snare: ghost taps on beats 2 and 4, a ruff leading into every other bar.
      if (s === 4 || s === 12) a.snare(bus, t, 0.18);
      if (s === 14 && bar % 2 === 1) {
        a.snare(bus, t - 0.06, 0.12);
        a.snare(bus, t - 0.03, 0.16);
        a.snare(bus, t, 0.42);
        if (rng.next() < 0.35) a.snare(bus, t + sd, 0.22);
      }
      if (bar === 7 && s === 8) a.timpani(bus, t, midiToHz(45), 0.35);
      // Brass motif over bars 3-4 and 7-8 of the loop.
      const phrase = bar === 2 || bar === 3 ? this.phraseA : bar === 6 || bar === 7 ? this.phraseB : null;
      if (phrase) {
        const local = (bar === 2 || bar === 6 ? 0 : 16) + s;
        for (let k = 0; k < phrase.length; k++) {
          const n = phrase[k];
          if (n[0] === local) a.brass(bus, t, midiToHz(n[1] + this.octave), n[2] * sd * 0.92, 0.9);
        }
      }
    },
  },
};

const SFX = {
  tap(a, t, pan, vel) {
    const out = a.voice(a.sfxBus, t, 0.06, 0.25, pan);
    const g = a.gain(out);
    a.env(g.gain, t, 0.001, 0.25 * vel, 0.04);
    const o = a.osc('sine', 1500, t, t + 0.06, g);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.03);
  },
  back(a, t, pan, vel) {
    const out = a.voice(a.sfxBus, t, 0.08, 0.25, pan);
    const g = a.gain(out);
    a.env(g.gain, t, 0.001, 0.25 * vel, 0.06);
    const o = a.osc('sine', 800, t, t + 0.08, g);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.05);
  },
  toggleOn(a, t, pan) { SFX.blips(a, t, pan, 660, 990); },
  toggleOff(a, t, pan) { SFX.blips(a, t, pan, 990, 660); },
  blips(a, t, pan, f1, f2) {
    const out = a.voice(a.sfxBus, t, 0.14, 0.2, pan);
    const g1 = a.gain(out);
    a.env(g1.gain, t, 0.002, 0.2, 0.05);
    a.osc('sine', f1, t, t + 0.07, g1);
    const g2 = a.gain(out);
    a.env(g2.gain, t + 0.06, 0.002, 0.2, 0.06);
    a.osc('sine', f2, t + 0.06, t + 0.14, g2);
  },
  error(a, t, pan) {
    const out = a.voice(a.sfxBus, t, 0.24, 0.3, pan);
    const g = a.gain(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.01);
    g.gain.setValueAtTime(0.16, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    const f = a.filter('lowpass', 1200, 0, g);
    a.osc('square', 150, t, t + 0.24, f);
    a.osc('square', 157, t, t + 0.24, f);
  },
  // Cannon: noise burst plus a low thump; bigger calibre (vel > 1) is lower and longer.
  cannon(a, t, pan, cal) {
    const k = clamp(cal, 0.5, 2);
    const out = a.voice(a.sfxBus, t, 0.6 * k, 0.9, pan);
    const n = a.gain(out);
    a.env(n.gain, t, 0.002, 0.8, 0.3 * k);
    const f = a.filter('lowpass', 2000 / k, 0, n);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.25 * k);
    a.noiseSrc(t, t + 0.6 * k, f);
    const b = a.gain(out);
    a.env(b.gain, t, 0.003, 0.9, 0.4 * k);
    const o = a.osc('sine', 95 / k, t, t + 0.6 * k, b);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.35 * k);
    const cr = a.gain(out);
    a.env(cr.gain, t, 0.001, 0.35, 0.03);
    a.noiseSrc(t, t + 0.05, a.filter('highpass', 3000, 0, cr));
  },
  rocket(a, t, pan) {
    const out = a.voice(a.sfxBus, t, 0.8, 0.5, pan);
    const g = a.gain(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.45, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    const f = a.filter('bandpass', 600, 1.2, g);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.5);
    a.noiseSrc(t, t + 0.8, f);
  },
  smoke(a, t, pan) {
    const out = a.voice(a.sfxBus, t, 0.6, 0.4, pan);
    const g = a.gain(out);
    a.env(g.gain, t, 0.03, 0.35, 0.5);
    const f = a.filter('lowpass', 1400, 0, g);
    f.frequency.exponentialRampToValueAtTime(250, t + 0.5);
    a.noiseSrc(t, t + 0.6, f);
    const p = a.gain(out);
    a.env(p.gain, t, 0.001, 0.3, 0.05);
    a.osc('sine', 220, t, t + 0.08, p);
  },
  swap(a, t, pan) {
    for (let k = 0; k < 2; k++) {
      const tt = t + k * 0.07;
      const out = a.voice(a.sfxBus, tt, 0.04, 0.2, pan);
      const g = a.gain(out);
      a.env(g.gain, tt, 0.001, 0.2, 0.025);
      a.noiseSrc(tt, tt + 0.04, a.filter('bandpass', 2600 + k * 600, 3, g));
    }
  },
  // Order acknowledged: radio squelch, then a beep.
  order(a, t, pan) {
    const out = a.voice(a.sfxBus, t, 0.22, 0.3, pan);
    const s = a.gain(out);
    a.env(s.gain, t, 0.003, 0.25, 0.07);
    a.noiseSrc(t, t + 0.1, a.filter('bandpass', 1300, 2, s));
    const b = a.gain(out);
    a.env(b.gain, t + 0.1, 0.003, 0.18, 0.08);
    a.osc('sine', 1000, t + 0.1, t + 0.22, b);
  },
  clunk(a, t, pan) {
    const out = a.voice(a.sfxBus, t, 0.2, 0.5, pan);
    const g = a.gain(out);
    a.env(g.gain, t, 0.002, 0.5, 0.14);
    const o = a.osc('sine', 120, t, t + 0.2, g);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const n = a.gain(out);
    a.env(n.gain, t, 0.001, 0.3, 0.05);
    a.noiseSrc(t, t + 0.08, a.filter('lowpass', 700, 0, n));
  },
  tick(a, t, pan, vel) {
    const out = a.voice(a.sfxBus, t, 0.03, 0.15, pan);
    const g = a.gain(out);
    a.env(g.gain, t, 0.001, 0.15 * vel, 0.015);
    a.noiseSrc(t, t + 0.03, a.filter('highpass', 2500, 0, g));
  },
  timeStop(a, t, pan) { SFX.clunk(a, t, pan); },
  timeStart(a, t, pan) {
    SFX.clunk(a, t, pan);
    for (let k = 0; k < 3; k++) SFX.tick(a, t + 0.18 + k * 0.2, pan, 1 - k * 0.2);
  },
  // Ricochet ping: 2.4 kHz sine with a fast pitch bend.
  ricochet(a, t, pan) {
    const out = a.voice(a.sfxBus, t, 0.35, 0.3, pan);
    const g = a.gain(out);
    a.env(g.gain, t, 0.002, 0.22, 0.3);
    const o = a.osc('sine', 2400, t, t + 0.35, g);
    o.frequency.exponentialRampToValueAtTime(1500, t + 0.3);
  },
  // Part destroyed: metallic crunch.
  crunch(a, t, pan, vel) {
    const out = a.voice(a.sfxBus, t, 0.3, 0.5, pan);
    const g = a.gain(out);
    a.env(g.gain, t, 0.002, 0.45 * vel, 0.22);
    a.noiseSrc(t, t + 0.3, a.filter('bandpass', 900, 1.5, g));
    const m = a.gain(out);
    a.env(m.gain, t, 0.001, 0.2 * vel, 0.15);
    const o = a.osc('square', 180, t, t + 0.2, a.filter('lowpass', 1400, 0, m));
    o.frequency.exponentialRampToValueAtTime(70, t + 0.15);
  },
  // Explosions: noise plus low sine with a long tail.
  boom(a, t, pan, vel) {
    const k = clamp(vel, 0.5, 2);
    const out = a.voice(a.sfxBus, t, 1.4 * k, 1, pan);
    const n = a.gain(out);
    a.env(n.gain, t, 0.004, 0.9, 0.9 * k);
    const f = a.filter('lowpass', 1600, 0, n);
    f.frequency.exponentialRampToValueAtTime(160, t + 0.9 * k);
    a.noiseSrc(t, t + 1.4 * k, f);
    const b = a.gain(out);
    a.env(b.gain, t, 0.005, 1, 0.8 * k);
    const o = a.osc('sine', 70, t, t + 1.2 * k, b);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.8 * k);
  },
  thud(a, t, pan, vel) {
    const out = a.voice(a.sfxBus, t, 0.25, 0.3, pan);
    const g = a.gain(out);
    a.env(g.gain, t, 0.002, 0.3 * vel, 0.18);
    a.noiseSrc(t, t + 0.25, a.filter('lowpass', 500, 0, g));
  },
  // Objective progress tick.
  objective(a, t, pan) {
    const out = a.voice(a.sfxBus, t, 0.3, 0.25, pan);
    for (const [dt, f] of [[0, 880], [0.09, 1320]]) {
      const g = a.gain(out);
      a.env(g.gain, t + dt, 0.003, 0.2, 0.12);
      a.osc('triangle', f, t + dt, t + dt + 0.2, g);
    }
  },
  engineRev(a, t, pan) {
    const out = a.voice(a.sfxBus, t, 0.5, 0.25, pan);
    const g = a.gain(out);
    a.env(g.gain, t, 0.05, 0.14, 0.4);
    const f = a.filter('lowpass', 400, 2, g);
    f.frequency.linearRampToValueAtTime(900, t + 0.3);
    const o = a.osc('sawtooth', 48, t, t + 0.5, f);
    o.frequency.linearRampToValueAtTime(70, t + 0.3);
  },
};

function haptic(name) {
  if (!save.settings.vibration || !navigator.vibrate) return;
  try { navigator.vibrate(HAPTICS[name] || 8); } catch (_e) { /* ignore */ }
}

/* ---------- 04_input.js ---------- */
/* ==== 04 INPUT ==== */
// One pointer router on the canvas (design/04 §5, design/02 §3.6):
// - a touch that starts inside a control belongs to it until released (pointer capture)
// - every other touch goes to the world; two world touches are a pinch
// - touches starting within 24 px of a screen edge are ignored by the world
// - timing uses event.timeStamp

// A control is a thumb button, chip or top-bar button drawn on the canvas.
function makeControl(id, opts) {
  return Object.assign({
    id,
    shape: 'circle',    // 'circle' (x, y, r) or 'rect' (x, y, w, h; x/y = top-left)
    x: 0, y: 0, r: 30, w: 0, h: 0,
    pad: 6,             // extra hit area around the drawn shape
    label: '',
    glyph: null,        // name in GLYPHS
    hidden: false,
    disabled: false,
    lit: false,         // e.g. the active order chip
    held: false,        // pressed from the keyboard
    pressCount: 0,
    releasedAt: -1,
    down: null,         // (pointer) =>
    move: null,         // (pointer) =>
    up: null,           // (pointer, cancelled) =>
  }, opts);
}

function hitControl(c, x, y) {
  if (c.hidden) return false;
  if (c.shape === 'circle') return dist(x, y, c.x, c.y) <= c.r + c.pad;
  return x >= c.x - c.pad && x <= c.x + c.w + c.pad && y >= c.y - c.pad && y <= c.y + c.h + c.pad;
}

const input = {
  pointers: new Map(),
  world: [],                 // world pointers, oldest first
  pinch: null,               // {d0, cx, cy}
  keys: new Set(),
  lastTap: { t: -1e9, x: 0, y: 0 },
  lastControlTouch: 0,       // performance.now() ms, for the controls' ghost mode
  lastWorldTouch: 0,

  local(e) { return [e.clientX - layout.x, e.clientY - layout.y]; },

  nearEdge(x, y) {
    return x < EDGE_IGNORE_PX || y < EDGE_IGNORE_PX || x > layout.w - EDGE_IGNORE_PX || y > layout.h - EDGE_IGNORE_PX;
  },

  down(e) {
    const scr = screens.cur;
    if (!scr) return;
    const [x, y] = this.local(e);
    const p = { id: e.pointerId, x, y, sx: x, sy: y, lx: x, ly: y, t0: e.timeStamp, owner: null, moved: false, long: false, type: e.pointerType, button: e.button };
    this.pointers.set(e.pointerId, p);

    const controls = scr.controls || [];
    for (let i = controls.length - 1; i >= 0; i--) {
      const c = controls[i];
      if (!hitControl(c, x, y)) continue;
      p.owner = c;
      this.capture(e);
      this.lastControlTouch = e.timeStamp;
      c.pressCount++;
      if (!c.disabled && c.down) c.down(p);
      return;
    }
    if (!scr.world) return;
    if (p.type === 'touch' && this.nearEdge(x, y)) return;
    p.owner = 'world';
    this.capture(e);
    this.lastWorldTouch = e.timeStamp;
    this.world.push(p);
    if (this.world.length === 2) {
      const [a, b] = this.world;
      a.moved = b.moved = true;   // a pinch is never a tap
      this.pinch = { d0: Math.max(1, dist(a.x, a.y, b.x, b.y)), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    }
  },

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const [x, y] = this.local(e);
    p.lx = p.x; p.ly = p.y;
    p.x = x; p.y = y;
    const scr = screens.cur;
    if (p.owner && p.owner !== 'world') {
      if (!p.owner.disabled && p.owner.move) p.owner.move(p);
      return;
    }
    if (p.owner !== 'world' || !scr || !scr.world) return;
    this.lastWorldTouch = e.timeStamp;
    if (this.pinch && this.world.length >= 2) {
      const [a, b] = this.world;
      if (p !== a && p !== b) return;
      const d = Math.max(1, dist(a.x, a.y, b.x, b.y));
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      if (scr.world.pinch) scr.world.pinch(d / this.pinch.d0, cx, cy);
      if (scr.world.pan) scr.world.pan(cx - this.pinch.cx, cy - this.pinch.cy);
      this.pinch.d0 = d; this.pinch.cx = cx; this.pinch.cy = cy;
      return;
    }
    if (!p.moved && dist(p.sx, p.sy, x, y) > TAP_MOVE_PX) {
      p.moved = true;
      p.lx = p.sx; p.ly = p.sy;   // include the slop so the pan doesn't jump
    }
    if (p.moved && !p.long && scr.world.pan) scr.world.pan(x - p.lx, y - p.ly);
  },

  up(e, cancelled) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    const scr = screens.cur;
    if (p.owner && p.owner !== 'world') {
      const c = p.owner;
      c.pressCount = Math.max(0, c.pressCount - 1);
      c.releasedAt = performance.now();
      this.lastControlTouch = e.timeStamp;
      if (!c.disabled && c.up) c.up(p, cancelled);
      return;
    }
    if (p.owner !== 'world') return;
    const i = this.world.indexOf(p);
    if (i >= 0) this.world.splice(i, 1);
    if (this.pinch) {
      this.pinch = null;
      for (const q of this.world) q.moved = true;
    }
    if (!scr || !scr.world || cancelled) return;
    if (p.moved && scr.world.panEnd) scr.world.panEnd();
    const dur = e.timeStamp - p.t0;
    if (!p.moved && !p.long && dur <= TAP_MAX_MS) {
      const lt = this.lastTap;
      if (e.timeStamp - lt.t <= DOUBLE_TAP_MS && dist(lt.x, lt.y, p.x, p.y) < 30 && scr.world.doubleTap) {
        lt.t = -1e9;
        scr.world.doubleTap(p.x, p.y);
      } else {
        lt.t = e.timeStamp; lt.x = p.x; lt.y = p.y;
        if (scr.world.tap) scr.world.tap(p.x, p.y);
      }
    }
  },

  capture(e) {
    try { canvas.setPointerCapture(e.pointerId); } catch (_e) { /* ignore */ }
  },

  // Called every frame: long-press detection.
  update(now) {
    const scr = screens.cur;
    if (this.world.length !== 1 || !scr || !scr.world) return;
    const p = this.world[0];
    if (!p.moved && !p.long && now - p.t0 >= LONG_PRESS_MS) {
      p.long = true;
      if (scr.world.longPress) scr.world.longPress(p.x, p.y);
    }
  },

  wheel(e) {
    const scr = screens.cur;
    if (!scr || !scr.world || !scr.world.pinch) return;
    e.preventDefault();
    const [x, y] = this.local(e);
    scr.world.pinch(Math.exp(-e.deltaY * 0.0015), x, y);
    this.lastWorldTouch = e.timeStamp;
  },

  // Drop every touch and key (used when pausing, hiding or changing screen) so nothing sticks.
  releaseAll() {
    for (const p of this.pointers.values()) {
      if (p.owner && p.owner !== 'world') {
        const c = p.owner;
        c.pressCount = Math.max(0, c.pressCount - 1);
        c.releasedAt = performance.now();
        if (!c.disabled && c.up) c.up(p, true);
      }
    }
    this.pointers.clear();
    this.world.length = 0;
    this.pinch = null;
    const scr = screens.cur;
    for (const code of this.keys) if (scr && scr.key) scr.key(code, false);
    this.keys.clear();
  },

  keyDown(e) {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const code = e.code;
    audio.unlock();
    if (code === 'KeyP' || code === 'Escape') { if (!e.repeat) onPauseKey(); return; }
    const scr = screens.cur;
    // Menus keep normal keyboard navigation; only in-game keys are captured.
    if (ui.modalOpen() || !scr || !scr.key) return;
    if (/^(Space|Tab|Arrow)/.test(code)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(code);
    scr.key(code, true);
  },

  keyUp(e) {
    const code = e.code;
    if (!this.keys.has(code)) return;
    this.keys.delete(code);
    const scr = screens.cur;
    if (scr && scr.key) scr.key(code, false);
  },

  init() {
    canvas.addEventListener('pointerdown', (e) => { audio.unlock(); this.down(e); });
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e, false));
    canvas.addEventListener('pointercancel', (e) => this.up(e, true));
    canvas.addEventListener('lostpointercapture', (e) => { if (this.pointers.has(e.pointerId)) this.up(e, true); });
    canvas.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keyUp(e));
  },
};

/* ---------- 05_render.js ---------- */
/* ==== 05 RENDER ==== */
// Canvas, pixel ratio, pre-drawn background layers and the thumb controls.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const uiLayer = document.getElementById('ui');
const FINE_POINTER = window.matchMedia('(pointer: fine)');
const PORTRAIT_TOUCH = window.matchMedia('(orientation: portrait) and (pointer: coarse)');

// Safe-area insets in CSS px, read from the CSS custom properties.
const layout = { x: 0, y: 0, w: 1, h: 1, dpr: 1, safe: { t: 0, r: 0, b: 0, l: 0 } };
const bg = { sky: null, mid: null, midW: 0 };

function readSafeAreas() {
  const cs = getComputedStyle(document.documentElement);
  const px = (n) => parseFloat(cs.getPropertyValue(n)) || 0;
  layout.safe.t = px('--safe-t');
  layout.safe.r = px('--safe-r');
  layout.safe.b = px('--safe-b');
  layout.safe.l = px('--safe-l');
}

function resize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let w = vw;
  let h = vh;
  if (FINE_POINTER.matches) {
    // Desktop: 16:9 letterbox, max 1280 wide, centred.
    w = Math.min(vw, DESKTOP_MAX_W, Math.floor((vh * 16) / 9));
    h = Math.min(vh, Math.floor((w * 9) / 16));
  }
  layout.w = w;
  layout.h = h;
  layout.x = Math.floor((vw - w) / 2);
  layout.y = Math.floor((vh - h) / 2);
  const q = QUALITY[save.settings.quality] || QUALITY.High;
  layout.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR, q.dpr);

  for (const el of [canvas, uiLayer]) {
    el.style.left = layout.x + 'px';
    el.style.top = layout.y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
  }
  canvas.width = Math.round(w * layout.dpr);
  canvas.height = Math.round(h * layout.dpr);
  ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
  readSafeAreas();

  game.portrait = PORTRAIT_TOUCH.matches;
  buildBackground();
  if (screens.cur && screens.cur.layout) screens.cur.layout();
}

// Pre-render static layers once per resize (design/04 §3).
function makeLayer(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * layout.dpr));
  c.height = Math.max(1, Math.round(h * layout.dpr));
  const g = c.getContext('2d');
  g.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
  return { c, g };
}

// A silhouette ridge. With `period`, the frequencies snap to whole cycles so
// the layer tiles seamlessly every `period` px.
function ridge(g, w, h, baseY, amp, seed, color, period) {
  const rng = makeRng(seed);
  let f1 = rng.range(0.004, 0.008);
  let f2 = rng.range(0.012, 0.02);
  if (period) {
    const snap = (f) => (Math.max(1, Math.round((f * period) / (Math.PI * 2))) * Math.PI * 2) / period;
    f1 = snap(f1);
    f2 = snap(f2);
  }
  const p1 = rng.range(0, 6.28);
  const p2 = rng.range(0, 6.28);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) {
    const y = baseY - amp * (0.6 * Math.sin(x * f1 + p1) + 0.4 * Math.sin(x * f2 + p2));
    g.lineTo(x, y);
  }
  g.lineTo(w, h);
  g.closePath();
  g.fill();
}

function buildBackground() {
  const { w, h } = layout;
  const sky = makeLayer(w, h);
  const grad = sky.g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, PAL.skyTop);
  grad.addColorStop(0.45, PAL.sky2);
  grad.addColorStop(0.72, PAL.sky3);
  grad.addColorStop(0.9, PAL.horizon);
  sky.g.fillStyle = grad;
  sky.g.fillRect(0, 0, w, h);
  ridge(sky.g, w, h, h * 0.74, h * 0.07, 11, PAL.ridgeFar);
  bg.sky = sky.c;

  // Mid ridge is twice as wide and repeats every screen width, so it can scroll and wrap.
  bg.midW = w * 2;
  const mid = makeLayer(bg.midW, h);
  ridge(mid.g, bg.midW, h, h * 0.84, h * 0.06, 29, PAL.ridgeMid, w);
  bg.mid = mid.c;
}

// Sky plus a mid ridge scrolled by `offset` px (wraps).
function drawBackground(g, offset) {
  const { w, h } = layout;
  g.drawImage(bg.sky, 0, 0, w, h);
  let off = offset % (bg.midW / 2);
  if (off < 0) off += bg.midW / 2;
  g.drawImage(bg.mid, -off, 0, bg.midW, h);
}

// ---------- grease-pencil glyphs (design/02 §8)
// Unit-space polylines (-1..1). Each control gets its own seeded wobble once,
// so glyphs look hand-drawn but never shimmer.
const GLYPH_SHAPES = {
  left: [[[0.4, -0.55], [-0.45, 0], [0.4, 0.55], [0.4, -0.55]]],
  right: [[[-0.4, -0.55], [0.45, 0], [-0.4, 0.55], [-0.4, -0.55]]],
  up: [[[-0.55, 0.4], [0, -0.45], [0.55, 0.4], [-0.55, 0.4]]],
  down: [[[-0.55, -0.4], [0, 0.45], [0.55, -0.4], [-0.55, -0.4]]],
  pause: [[[-0.3, -0.55], [-0.3, 0.55]], [[0.3, -0.55], [0.3, 0.55]]],
  stop: [[[-0.45, -0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, 0.45], [-0.45, -0.45]]],
  play: [[[-0.35, -0.55], [0.5, 0], [-0.35, 0.55], [-0.35, -0.55]]],
  gear: (() => {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = i % 4 < 2 ? 0.62 : 0.45;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const hub = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      hub.push([Math.cos(a) * 0.18, Math.sin(a) * 0.18]);
    }
    return [pts, hub];
  })(),
  recenter: [[[-0.6, 0], [0.6, 0]], [[0, -0.6], [0, 0.6]], (() => {
    const c = [];
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; c.push([Math.cos(a) * 0.38, Math.sin(a) * 0.38]); }
    return c;
  })()],
};

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function wobbleGlyph(name, seed) {
  const shape = GLYPH_SHAPES[name];
  if (!shape) return null;
  const rng = makeRng(hashStr(name) ^ seed);
  return shape.map((line) => {
    const out = [];
    for (let i = 0; i < line.length; i++) {
      const [x, y] = line[i];
      if (i > 0) {
        // Two in-between points per segment, nudged a little off the line.
        const [px, py] = line[i - 1];
        for (const f of [0.33, 0.66]) {
          out.push(lerp(px, x, f) + rng.range(-0.04, 0.04), lerp(py, y, f) + rng.range(-0.04, 0.04));
        }
      }
      out.push(x + rng.range(-0.03, 0.03), y + rng.range(-0.03, 0.03));
    }
    return out;
  });
}

function strokeGlyph(g, lines, cx, cy, s) {
  g.beginPath();
  for (const pts of lines) {
    g.moveTo(cx + pts[0] * s, cy + pts[1] * s);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(cx + pts[i] * s, cy + pts[i + 1] * s);
  }
  g.stroke();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Ghost mode: 4 s after the last control touch, controls fade to 60%.
function controlsGhost(nowMs) {
  const idle = (nowMs - input.lastControlTouch) / 1000 - CONTROL_GHOST_AFTER;
  return idle <= 0 ? 1 : lerp(1, CONTROL_GHOST_ALPHA, clamp(idle / 0.4, 0, 1));
}

// Draws one control in the smoked-acetate style (design/02 §8).
// The opacity setting scales everything; the default 30% gives the values in the table.
function drawControl(g, c, nowMs, ghost) {
  if (c.hidden) return;
  const k = save.settings.btnOpacity / 0.3;
  const held = !c.disabled && (c.pressCount > 0 || c.held);
  const press = c.disabled ? 0 : held ? 1 : c.releasedAt < 0 ? 0 : clamp(1 - (nowMs - c.releasedAt) / 1000 / CONTROL_RELEASE_TIME, 0, 1);
  const sc = 1 - 0.06 * press;
  const a = ghost * (c.disabled ? 0.6 : 1);
  if (!c.glyphLines && c.glyph) c.glyphLines = wobbleGlyph(c.glyph, hashStr(c.id));

  g.save();
  g.globalAlpha = a;
  let cx, cy, gs;
  if (c.shape === 'circle') {
    cx = c.x; cy = c.y;
    const r = c.r * sc;
    if (press > 0) {
      g.strokeStyle = `rgba(255,178,62,${0.35 * press})`;
      g.lineWidth = 8;
      g.beginPath(); g.arc(cx, cy, r + 3, 0, Math.PI * 2); g.stroke();
    }
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
    gs = r * 0.5;
  } else {
    cx = c.x + c.w / 2; cy = c.y + c.h / 2;
    const w = c.w * sc, h = c.h * sc;
    if (press > 0) {
      g.strokeStyle = `rgba(255,178,62,${0.35 * press})`;
      g.lineWidth = 6;
      roundRect(g, cx - w / 2 - 2, cy - h / 2 - 2, w + 4, h + 4, h / 2 + 2);
      g.stroke();
    }
    roundRect(g, cx - w / 2, cy - h / 2, w, h, Math.min(h / 2, 12));
    gs = h * 0.34;
  }
  // Fill: staff ink at 18% idle, warming to tracer amber at 45% when pressed.
  const fa = clamp(0.18 * k, 0.03, 0.6);
  g.fillStyle = press > 0
    ? `rgba(${Math.round(lerp(34, 255, press))},${Math.round(lerp(48, 178, press))},${Math.round(lerp(63, 62, press))},${lerp(fa, 0.45, press)})`
    : `rgba(34,48,63,${fa})`;
  g.fill();
  // Outline: a dark under-stroke keeps it visible on bright skies, linen on top for dark ground.
  if (c.disabled) g.setLineDash([5, 4]);
  g.lineWidth = 3;
  g.strokeStyle = `rgba(10,12,16,${clamp(0.3 * k, 0.1, 0.6)})`;
  g.stroke();
  g.lineWidth = 1.5;
  g.strokeStyle = c.lit ? PAL.amber : `rgba(230,220,195,${clamp(0.5 * k, 0.15, 1)})`;
  g.stroke();
  if (c.disabled) g.setLineDash([]);

  // Glyph or label at 70%, full when pressed.
  const ga = clamp(lerp(0.7 * k, 1, press), 0.25, 1);
  const col = c.lit ? '255,178,62' : '230,220,195';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (c.glyphLines) {
    g.lineWidth = 4;
    g.strokeStyle = `rgba(10,12,16,${ga * 0.45})`;
    strokeGlyph(g, c.glyphLines, cx, cy, gs);
    g.lineWidth = 2.2;
    g.strokeStyle = `rgba(${col},${ga})`;
    strokeGlyph(g, c.glyphLines, cx, cy, gs);
  } else if (c.label) {
    const size = c.shape === 'circle' ? clamp(Math.round(c.r * 0.42), 12, 18) : 14;
    g.font = `700 ${size}px ${FONT_UI}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 3;
    g.strokeStyle = `rgba(10,12,16,${ga * 0.5})`;
    g.strokeText(c.label, cx, cy + 1);
    g.fillStyle = `rgba(${col},${ga})`;
    g.fillText(c.label, cx, cy + 1);
  }
  g.restore();
}

// Reload ring around a round control, progress 0..1.
function drawRing(g, c, progress, ghost) {
  if (c.hidden || progress >= 1) return;
  g.save();
  g.globalAlpha = ghost;
  g.strokeStyle = PAL.amber;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(c.x, c.y, c.r + 5, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  g.stroke();
  g.restore();
}

// Acetate panel (HUD bars).
function drawAcetate(g, x, y, w, h) {
  g.fillStyle = 'rgba(18,24,32,0.62)';
  g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(230,220,195,0.25)';
  g.fillRect(x, y + h - 1, w, 1);
}

/* ---------- 06_ui.js ---------- */
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
      this.confirm('Reset best score, levels, blueprints and medals? Settings are kept.', 'Reset', () => {
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

/* ---------- 07_data.js ---------- */
/* ==== 07 DATA ==== */
// Part catalogue (design/05), terrain types, templates and battle setups.
// Numbers here are tuning data: raw numbers only, never shown as ratings.

const CELL = 0.5;                 // metres per grid cell
const GRAVITY = 9.81;

// Battles compress distance: 1 km on the design sheet = 50 m on the battlefield,
// so fights happen on screen. Penetration fall-off uses the nominal (sheet) range.
const BATTLE_DISTANCE_SCALE = 0.05;
// Locomotion speed caps are multiplied by this in battle (design/05 §7.1 BATTLE_TIME_SCALE).
const BATTLE_SPEED_SCALE = 0.5;

// Weapon extras used in battle. vel = muzzle speed on the battlefield (m/s),
// dmg = damage to a part per hit, spread = aiming error in degrees (1 sigma),
// cal = calibre in mm (recoil = cal² × 0.9 N·s), auto = automatic weapon.
const WEAPON_STATS = {
  mg: { vel: 260, dmg: 6, spread: 1.4, cal: 8, auto: true, burst: 6 },
  hmg: { vel: 250, dmg: 11, spread: 1.2, cal: 13, auto: true, burst: 5 },
  // burst / burstR: the shell's small bursting charge after it penetrates (damage, radius in m).
  c37: { vel: 180, dmg: 45, spread: 0.55, cal: 37, shells: 40, burst: 25, burstR: 1.0 },
  c75: { vel: 165, dmg: 95, spread: 0.5, cal: 75, shells: 30, burst: 55, burstR: 1.6, heDmg: 70, heRadius: 3 },
  c105: { vel: 155, dmg: 150, spread: 0.45, cal: 105, shells: 20, burst: 80, burstR: 2.0, heDmg: 110, heRadius: 4 },
  how: { vel: 95, dmg: 180, spread: 0.9, cal: 150, shells: 12, heDmg: 180, heRadius: 6, indirect: true },
};

// id: [name, category, w, h, mass, hp, armour, extras]
const PART_ROWS = [
  // Structure
  ['frame', 'Light frame', 'structure', 1, 1, 60, 40, 5, { cost: { metal: 1 } }],
  ['timber', 'Timber frame', 'structure', 1, 1, 40, 25, 3, { cost: { wood: 1 }, burns: true }],
  ['plate', 'Hull plate', 'structure', 1, 1, 120, 60, 15, { cost: { metal: 2 } }],
  ['arm20', 'Armour 20 mm', 'structure', 1, 1, 190, 80, 20, { cost: { metal: 3 } }],
  ['arm40', 'Armour 40 mm', 'structure', 1, 1, 380, 120, 40, { cost: { metal: 5 } }],
  ['arm80', 'Armour 80 mm', 'structure', 1, 1, 760, 180, 80, { cost: { metal: 9 } }],
  ['slope40', 'Sloped armour 40 mm', 'structure', 1, 1, 300, 110, 40, { cost: { metal: 5 }, sloped: true }],
  ['crew2', 'Crew compartment', 'structure', 2, 2, 300, 80, 10, { cost: { metal: 3 }, crew: 2 }],
  ['turret', 'Turret ring', 'structure', 3, 1, 250, 90, 20, { cost: { metal: 3 }, power: -5, ring: true }],
  // Mobility
  ['eng_s', 'Petrol engine S', 'mobility', 2, 2, 450, 60, 5, { cost: { metal: 3 }, power: 110, heat: 12, fuelUse: 30, rel: 0.990 }],
  ['eng_m', 'Diesel engine M', 'mobility', 3, 2, 1100, 90, 5, { cost: { metal: 7 }, power: 300, heat: 25, fuelUse: 55, rel: 0.994 }],
  ['eng_h', 'Diesel engine H', 'mobility', 4, 2, 1900, 120, 5, { cost: { metal: 12 }, power: 520, heat: 45, fuelUse: 95, rel: 0.992 }],
  ['radiator', 'Radiator', 'mobility', 1, 1, 70, 20, 2, { cost: { metal: 1 }, heat: -12 }],
  ['wheel_s', 'Road wheel', 'mobility', 1, 1, 80, 30, 5, { cost: { metal: 1, rubber: 1 }, loco: 'wheel', contact: 0.04, maxLoad: 2000, cap: 90, radius: 0.25 }],
  ['wheel_l', 'Off-road wheel', 'mobility', 2, 2, 200, 50, 5, { cost: { metal: 1, rubber: 3 }, loco: 'wheel', contact: 0.12, maxLoad: 5000, cap: 75, radius: 0.5 }],
  ['track', 'Track segment', 'mobility', 2, 1, 450, 70, 10, { cost: { metal: 3, rubber: 1 }, loco: 'track', contact: 0.35, maxLoad: 10000, cap: 55, radius: 0.25 }],
  // Weapons
  ['mg', 'Machine gun', 'weapon', 1, 1, 40, 20, 5, { cost: { metal: 1 }, pen: 8, rpm: 600, range: 600 }],
  ['hmg', 'Heavy machine gun', 'weapon', 1, 1, 80, 25, 5, { cost: { metal: 2 }, pen: 20, rpm: 450, range: 1000 }],
  ['c37', 'Cannon 37 mm', 'weapon', 2, 1, 250, 40, 10, { cost: { metal: 4 }, pen: 50, reload: 2.5, range: 1500 }],
  ['c75', 'Cannon 75 mm', 'weapon', 3, 1, 600, 60, 10, { cost: { metal: 7 }, pen: 90, reload: 5, range: 2000 }],
  ['c105', 'Cannon 105 mm', 'weapon', 4, 1, 1300, 80, 10, { cost: { metal: 12 }, pen: 150, reload: 8, range: 2500 }],
  ['how', 'Howitzer 150 mm', 'weapon', 4, 2, 2500, 100, 10, { cost: { metal: 18 }, pen: 40, reload: 12, range: 8000, he: true }],
  ['smoke', 'Smoke launcher', 'weapon', 1, 1, 30, 15, 2, { cost: { metal: 1, fuel: 1 }, salvos: 3 }],
  // Systems
  ['radio', 'Radio', 'system', 1, 1, 50, 15, 2, { cost: { metal: 1, elec: 1 }, power: -1 }],
  ['optics', 'Optics', 'system', 1, 1, 30, 10, 2, { cost: { metal: 1, elec: 1 }, spot: 1.4 }],
  ['fc', 'Fire-control computer', 'system', 1, 1, 60, 15, 2, { cost: { metal: 1, elec: 5 }, power: -5, accuracy: 1.35 }],
  ['stab', 'Gun stabiliser', 'system', 1, 1, 90, 15, 2, { cost: { metal: 2, elec: 4 }, power: -8 }],
  // Logistics
  ['fuel_s', 'Fuel tank 200 L', 'logistics', 1, 1, 220, 30, 3, { cost: { metal: 1 }, fuel: 200, fire: 0.35 }],
  ['fuel_ss', 'Self-sealing tank 150 L', 'logistics', 1, 1, 210, 40, 3, { cost: { metal: 1, rubber: 2 }, fuel: 150, fire: 0.10 }],
  ['ammo', 'Ammo rack', 'logistics', 1, 1, 250, 30, 3, { cost: { metal: 1 }, shells: 20, detonate: 0.40 }],
  ['ammo_p', 'Protected ammo storage', 'logistics', 1, 1, 320, 50, 10, { cost: { metal: 2 }, shells: 20, detonate: 0.10 }],
  ['cargo', 'Cargo bay', 'logistics', 2, 2, 200, 40, 3, { cost: { metal: 2, wood: 1 }, cargo: 2000 }],
];

const PARTS = {};
for (const [id, name, cat, w, h, mass, hp, armor, extra] of PART_ROWS) {
  PARTS[id] = Object.assign({ id, name, cat, w, h, mass, hp, armor, power: 0, rel: 0.998 }, extra);
  if (WEAPON_STATS[id]) Object.assign(PARTS[id], WEAPON_STATS[id]);
}

// Terrain types (design/05 §6). softness, grip μ, concealment, colour of the top soil.
const TERRAIN = [
  { id: 'plains', name: 'Plains', soft: 0.1, grip: 0.75, conceal: 0.1, color: '#2B3029' },
  { id: 'road', name: 'Road', soft: 0, grip: 0.9, conceal: 0, color: '#3A3A40' },
  { id: 'forest', name: 'Forest floor', soft: 0.3, grip: 0.6, conceal: 0.5, color: '#1F2A22' },
  { id: 'mud', name: 'Mud', soft: 1.0, grip: 0.4, conceal: 0.1, color: '#3B2E25' },
  { id: 'rock', name: 'Rock', soft: 0, grip: 0.8, conceal: 0.3, color: '#34363E' },
];
const T_PLAINS = 0, T_ROAD = 1, T_FOREST = 2, T_MUD = 3, T_ROCK = 4;

// ---------- templates (design/05 §8). Grid rows go top (y = 0) to bottom; front faces right.
// cells: [partId, x, y]
const TEMPLATES = {
  scout: {
    name: 'Scout car', w: 10, h: 5, soft: true,
    cells: [
      ['wheel_s', 1, 4], ['wheel_s', 3, 4], ['wheel_s', 6, 4], ['wheel_s', 8, 4],
      ['plate', 0, 3], ['eng_s', 1, 2], ['crew2', 3, 2], ['fuel_s', 5, 3], ['radio', 5, 2],
      ['plate', 6, 3], ['plate', 7, 3], ['plate', 8, 3], ['arm20', 6, 2], ['arm20', 7, 2], ['slope40', 8, 2],
      ['hmg', 4, 1], ['optics', 3, 1],
    ],
  },
  mgcar: {
    name: 'Machine-gun car', w: 10, h: 5, soft: true,
    cells: [
      ['wheel_s', 1, 4], ['wheel_s', 3, 4], ['wheel_s', 6, 4], ['wheel_s', 8, 4],
      ['plate', 0, 3], ['eng_s', 1, 2], ['crew2', 3, 2], ['fuel_s', 5, 3], ['plate', 5, 2],
      ['plate', 6, 3], ['plate', 7, 3], ['plate', 8, 3], ['plate', 6, 2], ['plate', 7, 2], ['slope40', 8, 2],
      ['mg', 4, 1],
    ],
  },
  light: {
    name: 'Light tank', w: 12, h: 6,
    cells: [
      ['track', 2, 5], ['track', 4, 5], ['track', 6, 5], ['track', 8, 5],
      ['arm20', 1, 3], ['arm20', 1, 4], ['eng_m', 2, 3], ['crew2', 5, 3], ['fuel_s', 7, 3], ['ammo', 7, 4],
      ['arm20', 8, 3], ['arm20', 8, 4], ['slope40', 9, 3], ['arm20', 9, 4], ['mg', 10, 4],
      ['turret', 4, 2], ['radio', 3, 1], ['arm20', 4, 1], ['arm20', 5, 1], ['c37', 6, 1], ['optics', 5, 0],
    ],
  },
  medium: {
    name: 'Medium tank', w: 14, h: 7,
    cells: [
      ['track', 2, 6], ['track', 4, 6], ['track', 6, 6], ['track', 8, 6], ['track', 10, 6],
      ['arm20', 1, 4], ['arm20', 1, 5], ['eng_m', 2, 4], ['fuel_s', 5, 4], ['fuel_s', 5, 5], ['crew2', 6, 4],
      ['ammo', 8, 4], ['plate', 8, 5], ['arm40', 9, 4], ['arm40', 9, 5], ['arm40', 10, 4], ['arm40', 10, 5],
      ['slope40', 11, 4], ['arm40', 11, 5], ['mg', 12, 5],
      ['turret', 5, 3], ['arm20', 4, 1], ['arm20', 4, 2], ['crew2', 5, 1], ['arm40', 7, 1], ['arm40', 7, 2],
      ['c75', 8, 2], ['optics', 6, 0], ['radio', 4, 0],
    ],
  },
  assault: {
    name: 'Assault gun', w: 13, h: 5,
    cells: [
      ['track', 1, 4], ['track', 3, 4], ['track', 5, 4], ['track', 7, 4], ['track', 9, 4],
      ['arm20', 0, 2], ['arm20', 0, 3], ['eng_m', 1, 2], ['ammo', 4, 2], ['fuel_s', 4, 3], ['crew2', 5, 2],
      ['arm40', 7, 2], ['arm40', 7, 3], ['slope40', 8, 2], ['arm80', 8, 3], ['slope40', 9, 2], ['arm80', 9, 3],
      ['arm40', 5, 1], ['arm40', 6, 1], ['arm40', 7, 1], ['c105', 8, 1], ['optics', 6, 0],
    ],
  },
  truck: {
    name: 'Supply truck', w: 11, h: 5, soft: true,
    cells: [
      ['wheel_l', 1, 3], ['wheel_l', 5, 3], ['wheel_l', 8, 3],
      ['timber', 0, 2], ['timber', 1, 2], ['timber', 2, 2], ['timber', 3, 2], ['timber', 4, 2], ['timber', 5, 2],
      ['timber', 6, 2], ['timber', 7, 2], ['timber', 8, 2], ['timber', 9, 2], ['timber', 10, 2],
      ['cargo', 1, 0], ['cargo', 3, 0], ['fuel_s', 5, 1], ['timber', 5, 0], ['crew2', 6, 0], ['eng_s', 8, 0],
    ],
  },
};

// ---------- battle setups for Part 1b (the ladder's full levelConfig arrives in Part 1c)
// enemies: [template, count, behaviour]; behaviour: 'parked' | 'convoy' | 'attack'
const BATTLES = [
  { name: 'Farmland', goal: 'Destroy the trucks', seed: 101, length: 420, hills: 0.15, rough: 0.2, mud: 0, forest: 0, gaps: 0,
    enemies: [['truck', 3, 'parked']], holdFire: true },
  { name: 'Supply road', goal: 'Destroy the convoy', seed: 202, length: 460, hills: 0.25, rough: 0.3, mud: 0, forest: 1, gaps: 0,
    enemies: [['truck', 2, 'convoy'], ['mgcar', 1, 'attack']] },
  { name: 'Hills', goal: 'Destroy the enemy', seed: 303, length: 480, hills: 0.8, rough: 0.4, mud: 1, forest: 1, gaps: 0,
    enemies: [['mgcar', 1, 'attack'], ['light', 1, 'attack']] },
  { name: 'Armour', goal: 'Destroy the tanks', seed: 404, length: 520, hills: 0.5, rough: 0.4, mud: 2, forest: 1, gaps: 1,
    enemies: [['light', 2, 'attack']] },
];

function battleConfig(level) {
  const base = BATTLES[(level - 1) % BATTLES.length];
  return Object.assign({ level, squad: ['medium', 'light', 'scout'] }, base, { seed: base.seed + (level - 1) * 7919 });
}

/* ---------- 08_design.js ---------- */
/* ==== 08 DESIGN ==== */
// Grid model, placement rules and derived numbers (design/01 §8, design/05 §7).
// Design = { id, name, w, h, cells:[{p, x, y}] }; grid y = 0 is the top row.

function designFromTemplate(id) {
  const t = TEMPLATES[id];
  return {
    id,
    name: t.name,
    w: t.w,
    h: t.h,
    soft: !!t.soft,
    mark: 1,
    cells: t.cells.map(([p, x, y]) => ({ p, x, y })),
  };
}

// Occupancy grid: index of the cell entry in design.cells, or -1.
function occupancy(design, alive) {
  const g = new Int16Array(design.w * design.h).fill(-1);
  design.cells.forEach((c, i) => {
    if (alive && !alive[i]) return;
    const d = PARTS[c.p];
    for (let yy = c.y; yy < c.y + d.h; yy++) {
      for (let xx = c.x; xx < c.x + d.w; xx++) {
        if (xx >= 0 && yy >= 0 && xx < design.w && yy < design.h) g[yy * design.w + xx] = i;
      }
    }
  });
  return g;
}

// Parts that touch along an edge are connected. Returns an array of neighbour lists.
function adjacency(design, grid, alive) {
  const n = design.cells.length;
  const adj = Array.from({ length: n }, () => new Set());
  const W = design.w, H = design.h;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = grid[y * W + x];
      if (a < 0 || (alive && !alive[a])) continue;
      if (x + 1 < W) { const b = grid[y * W + x + 1]; if (b >= 0 && b !== a) { adj[a].add(b); adj[b].add(a); } }
      if (y + 1 < H) { const b = grid[(y + 1) * W + x]; if (b >= 0 && b !== a) { adj[a].add(b); adj[b].add(a); } }
    }
  }
  return adj;
}

// Connected groups of parts (each an array of cell indices).
function components(design, grid, alive) {
  const adj = adjacency(design, grid, alive);
  const seen = new Uint8Array(design.cells.length);
  const groups = [];
  for (let i = 0; i < design.cells.length; i++) {
    if (seen[i] || (alive && !alive[i])) continue;
    const group = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const a = stack.pop();
      group.push(a);
      for (const b of adj[a]) if (!seen[b]) { seen[b] = 1; stack.push(b); }
    }
    groups.push(group);
  }
  return groups;
}

// Placement rules (design/01 §8.1). Messages state facts only.
function validateDesign(design) {
  const errors = [];
  const W = design.w, H = design.h;
  const count = new Int16Array(W * H);
  let lowest = -1;
  let crew = 0, needCrew = 1, engines = 0, loco = 0;
  for (const c of design.cells) {
    const d = PARTS[c.p];
    if (!d) { errors.push(`Unknown part ${c.p}.`); continue; }
    if (c.x < 0 || c.y < 0 || c.x + d.w > W || c.y + d.h > H) errors.push(`${d.name} is outside the grid.`);
    for (let yy = c.y; yy < c.y + d.h; yy++) for (let xx = c.x; xx < c.x + d.w; xx++) {
      if (xx >= 0 && yy >= 0 && xx < W && yy < H) count[yy * W + xx]++;
    }
    lowest = Math.max(lowest, c.y + d.h - 1);
    if (d.crew) crew += d.crew;
    if (d.cat === 'weapon' && d.id !== 'smoke' && !d.auto) needCrew++;
    if (d.power > 0) engines++;
    if (d.loco) loco++;
  }
  if (count.some((n) => n > 1)) errors.push('Two parts overlap.');
  for (const c of design.cells) {
    const d = PARTS[c.p];
    if (d && d.loco && c.y + d.h - 1 !== lowest) errors.push(`${d.name} does not touch the lowest row.`);
  }
  if (!loco) errors.push('No wheels or tracks.');
  if (!engines) errors.push('No engine.');
  if (crew < needCrew) errors.push(`Crew needed ${needCrew}, crew space ${crew}.`);
  const groups = components(design, occupancy(design));
  if (groups.length > 1) errors.push(`${groups.length - 1} part group(s) are not connected to the rest.`);
  return { ok: errors.length === 0, errors };
}

// Derived numbers (design/01 §8.2, design/05 §7). Pure; `alive` optional.
function statsOf(design, alive) {
  let mass = 0, mx = 0, my = 0, power = 0, drawn = 0, contact = 0, cap = Infinity;
  let wheels = 0, tracks = 0, minX = Infinity, maxX = -Infinity, top = 0, fuel = 0, shells = 0, crew = 0;
  design.cells.forEach((c, i) => {
    if (alive && !alive[i]) return;
    const d = PARTS[c.p];
    const cx = (c.x + d.w / 2) * CELL;
    const cy = (design.h - c.y - d.h / 2) * CELL;
    mass += d.mass;
    mx += d.mass * cx;
    my += d.mass * cy;
    if (d.power > 0) power += d.power; else drawn -= d.power;
    if (d.loco) {
      contact += d.contact;
      cap = Math.min(cap, d.cap);
      if (d.loco === 'track') tracks++; else wheels++;
      minX = Math.min(minX, c.x * CELL);
      maxX = Math.max(maxX, (c.x + d.w) * CELL);
    }
    top = Math.max(top, (design.h - c.y) * CELL);
    if (d.fuel) fuel += d.fuel;
    if (d.shells) shells += d.shells;
    if (d.crew) crew += d.crew;
  });
  const com = mass ? { x: mx / mass, y: my / mass } : { x: 0, y: 0 };
  const loco = tracks && !wheels ? 'track' : 'wheel';
  const pressure = contact ? (mass * GRAVITY) / contact / 1000 : Infinity;   // kPa
  const base = maxX > minX ? maxX - minX : 0;
  return {
    mass,
    com,
    power,
    drawn,
    powerToWeight: mass ? power / (mass / 1000) : 0,   // kW per tonne
    contact,
    pressure,
    loco,
    cap: cap === Infinity ? 0 : cap,
    tipAngle: com.y > 0 ? (Math.atan(base / 2 / com.y) * 180) / Math.PI : 0,
    height: top,
    fuel,
    shells,
    crew,
  };
}

/* ---------- 09a_physics_terrain.js ---------- */
/* ==== 09a PHYSICS: TERRAIN ==== */
// Heightfield sampled every 0.5 m, with a material per sample (design/04 §6).
// Generator: plains, hills, mud patches, forest, gaps (design/06 Part 1b).

function makeTerrain(cfg) {
  const rng = makeRng(cfg.seed);
  const L = cfg.length;
  const n = Math.round(L / CELL) + 1;
  const h = new Float32Array(n);
  const mat = new Uint8Array(n);
  const trees = [];
  const gaps = [];
  const mudZones = [];
  const forestZones = [];

  // Value noise: random heights every `step` metres, smoothly interpolated.
  const noise = (step, amp) => {
    const k = Math.ceil(L / step) + 2;
    const v = [];
    for (let i = 0; i < k; i++) v.push(rng.range(-1, 1) * amp);
    return (x) => {
      const f = x / step;
      const i = Math.floor(f);
      const t = f - i;
      const s = t * t * (3 - 2 * t);
      return v[i] + (v[i + 1] - v[i]) * s;
    };
  };
  const hillsA = noise(90, 10 * cfg.hills);
  const hillsB = noise(37, 3.5 * cfg.hills);
  const rough = noise(6, 0.35 * cfg.rough);
  for (let i = 0; i < n; i++) {
    const x = i * CELL;
    // Keep the two start zones calmer so squads don't spawn on a cliff.
    const edge = Math.min(1, Math.min(x - 10, L - 10 - x) / 60);
    h[i] = (hillsA(x) + hillsB(x)) * clamp(0.35 + edge, 0.35, 1) + rough(x);
  }

  const free = (x0, x1) => x0 > 95 && x1 < L - 110 &&
    !gaps.some((g) => x1 > g.x0 - 25 && x0 < g.x1 + 25) &&
    !mudZones.some((z) => x1 > z.x0 - 10 && x0 < z.x1 + 10);

  // Gaps: a trench with steep walls. Long vehicles bridge them; short ones fall in.
  for (let k = 0, tries = 0; k < (cfg.gaps || 0) && tries < 50; tries++) {
    const w = rng.range(3.2, 4.6);
    const x0 = rng.range(110, L - 150);
    if (!free(x0, x0 + w)) continue;
    const i0 = Math.round(x0 / CELL);
    const i1 = Math.round((x0 + w) / CELL);
    const rim = Math.min(h[i0], h[i1]);
    for (let i = i0 + 1; i < i1; i++) h[i] = rim - 3.2;
    gaps.push({ x0: i0 * CELL, x1: i1 * CELL });
    k++;
  }
  // Mud: soft, slightly sunken ground.
  for (let k = 0, tries = 0; k < (cfg.mud || 0) && tries < 50; tries++) {
    const w = rng.range(14, 26);
    const x0 = rng.range(100, L - 130);
    if (!free(x0, x0 + w)) continue;
    const i0 = Math.round(x0 / CELL), i1 = Math.round((x0 + w) / CELL);
    for (let i = i0; i <= i1; i++) {
      const t = (i - i0) / (i1 - i0);
      mat[i] = T_MUD;
      h[i] -= 0.45 * Math.sin(t * Math.PI);
    }
    mudZones.push({ x0, x1: x0 + w });
    k++;
  }
  // Forest: concealment and trees.
  for (let k = 0, tries = 0; k < (cfg.forest || 0) && tries < 50; tries++) {
    const w = rng.range(30, 50);
    const x0 = rng.range(90, L - 120);
    if (forestZones.some((z) => x0 + w > z.x0 - 10 && x0 < z.x1 + 10)) continue;
    const i0 = Math.round(x0 / CELL), i1 = Math.round((x0 + w) / CELL);
    for (let i = i0; i <= i1; i++) if (mat[i] === T_PLAINS) mat[i] = T_FOREST;
    for (let x = x0 + 2; x < x0 + w - 2; x += rng.range(3.5, 7)) {
      if (gaps.some((g) => x > g.x0 - 1 && x < g.x1 + 1)) continue;
      trees.push({ x, h: rng.range(6, 10), r: rng.range(1.6, 2.6), alive: true, fall: 0, fallDir: 1, seed: rng.int(0, 1e6) });
    }
    forestZones.push({ x0, x1: x0 + w });
    k++;
  }

  const T = {
    length: L, n, h, mat, trees, gaps, mudZones, forestZones,
    version: 0,          // bumped when craters change the ground
    height(x) {
      const f = clamp(x / CELL, 0, n - 1.001);
      const i = Math.floor(f);
      const t = f - i;
      return h[i] + (h[i + 1] - h[i]) * t;
    },
    slope(x) { return (this.height(x + 0.25) - this.height(x - 0.25)) / 0.5; },
    matAt(x) { return mat[clamp(Math.round(x / CELL), 0, n - 1)]; },
    terrainAt(x) { return TERRAIN[this.matAt(x)]; },
    inForest(x) { return this.matAt(x) === T_FOREST; },
    // High-explosive craters carve the ground.
    carve(x, r, depth) {
      const i0 = Math.max(1, Math.floor((x - r) / CELL));
      const i1 = Math.min(n - 2, Math.ceil((x + r) / CELL));
      for (let i = i0; i <= i1; i++) {
        const d = Math.abs(i * CELL - x) / r;
        if (d < 1) h[i] -= depth * (1 - d * d);
      }
      this.version++;
    },
  };
  return T;
}

/* ---------- 09b_physics_body.js ---------- */
/* ==== 09b PHYSICS: VEHICLE BODIES ==== */
// A vehicle is one rigid body made of its parts (design/01 §7.3, design/04 §6).
// Wheels and track units are spring-damper contacts on the heightfield; engines
// drive them. Mass, centre of mass, inertia, grip and resistance all come from
// the parts, so tipping, stalling and bogging down emerge from the numbers.

const DRIVE_EFF = { wheel: 0.85, track: 0.75 };
const SUSPENSION_HZ = 2.2;       // natural frequency of the contact springs
const SUSPENSION_DAMP = 0.7;     // damping ratio
const PHYS_SUBSTEPS = 2;
const REVERSE_CAP = 0.45;        // reverse speed as a share of the forward cap
const LOW_GEAR_SPEED = 2.5;      // m/s: below this, drive force stops rising (lowest gear), design/05 §7.1

let nextVehicleId = 1;

function makeVehicle(design, side, x, dir, terrain) {
  const V = {
    id: nextVehicleId++,
    design,
    name: design.name,
    side,                       // 0 = player (League), 1 = enemy (Directorate)
    dir,                        // +1 faces right, −1 faces left
    parts: design.cells.map((c) => {
      const d = PARTS[c.p];
      return { def: d, x: c.x, y: c.y, hp: d.hp, alive: true, burn: 0, scorch: 0 };
    }),
    alive: null,                // Uint8Array mirror of parts[i].alive
    grid: null,
    body: { x, y: 0, a: 0, vx: 0, vy: 0, w: 0, m: 1, I: 1 },
    com: { x: 0, y: 0 },
    contacts: [],
    weapons: [],
    throttle: 0,
    speed: 0,
    destroyed: false,           // knocked out or blown up
    immobile: false,
    canDrive: true,
    crew: 0,
    fuel: 0,
    fuelMax: 0,
    shells: 0,
    shellsMax: 0,
    hpMax: 0,
    stuckT: 0,
    bogNoteT: 0,
    spotted: 0,                 // seconds left visible to the other side
    revealT: 0,                 // muzzle flash reveals the shooter
    lastHitT: -99,
    dirty: true,                // sprite needs redrawing
    ai: null,
  };
  V.alive = new Uint8Array(V.parts.length).fill(1);
  for (const p of V.parts) V.hpMax += p.hp;
  rebuildVehicle(V, true);
  V.fuel = V.fuelMax;
  V.shells = V.shellsMax;
  // Rest on the ground: lowest contact touching the terrain.
  const b = V.body;
  b.x = x;
  b.a = Math.atan(terrain.slope(x));
  let low = Infinity;
  for (const c of V.contacts) low = Math.min(low, c.ly - c.r);
  b.y = terrain.height(x) - low / Math.cos(b.a) + 0.05;
  return V;
}

// Local (body) coordinates of a grid-space point (metres from the grid's bottom-left).
function gridToLocal(V, gx, gy, out) {
  out.x = (gx - V.com.x) * V.dir;
  out.y = gy - V.com.y;
  return out;
}

function localToWorld(V, lx, ly, out) {
  const b = V.body;
  const c = Math.cos(b.a), s = Math.sin(b.a);
  out.x = b.x + lx * c - ly * s;
  out.y = b.y + lx * s + ly * c;
  return out;
}

// World point -> grid space (metres, origin bottom-left of the grid, y up).
function worldToGrid(V, wx, wy, out) {
  const b = V.body;
  const c = Math.cos(b.a), s = Math.sin(b.a);
  const dx = wx - b.x, dy = wy - b.y;
  const lx = dx * c + dy * s;
  const ly = -dx * s + dy * c;
  out.x = lx * V.dir + V.com.x;
  out.y = ly + V.com.y;
  return out;
}

// Recompute mass, centre of mass, inertia, contacts and weapons from the live parts.
// Keeps the world position of the parts unchanged when the centre of mass moves.
function rebuildVehicle(V, first) {
  const D = V.design;
  const st = statsOf(D, V.alive);
  const b = V.body;
  if (!first && st.mass > 0) {
    const tmp = { x: 0, y: 0 };
    gridToLocal(V, st.com.x, st.com.y, tmp);
    localToWorld(V, tmp.x, tmp.y, tmp);
    b.x = tmp.x; b.y = tmp.y;
  }
  V.com.x = st.com.x;
  V.com.y = st.com.y;
  V.stats = st;
  b.m = Math.max(st.mass, 1);
  V.grid = occupancy(D, V.alive);

  let I = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let engines = 0, crew = 0, fuelMax = 0, shellsMax = 10, loco = 0, spot = 1, fc = 1, stab = false, smoke = 0;
  const contacts = [];
  const weapons = [];
  V.parts.forEach((p, i) => {
    if (!p.alive) return;
    const d = p.def;
    const cx = (p.x + d.w / 2) * CELL;
    const cy = (D.h - p.y - d.h / 2) * CELL;
    const rx = cx - st.com.x, ry = cy - st.com.y;
    I += d.mass * (rx * rx + ry * ry) + (d.mass * ((d.w * CELL) ** 2 + (d.h * CELL) ** 2)) / 12;
    minX = Math.min(minX, p.x * CELL); maxX = Math.max(maxX, (p.x + d.w) * CELL);
    minY = Math.min(minY, (D.h - p.y - d.h) * CELL); maxY = Math.max(maxY, (D.h - p.y) * CELL);
    if (d.power > 0) engines += d.power;
    if (d.crew) crew += d.crew;
    if (d.fuel) fuelMax += d.fuel;
    if (d.shells) shellsMax += d.shells;
    if (d.spot) spot = Math.max(spot, d.spot);
    if (d.accuracy) fc = Math.max(fc, d.accuracy);
    if (d.id === 'stab') stab = true;
    if (d.id === 'smoke') smoke += d.salvos;
    if (d.loco) {
      loco++;
      const pts = d.loco === 'track' ? [cx - 0.25, cx + 0.25] : [cx];
      for (const px of pts) contacts.push({ gx: px, gy: cy, r: d.radius, loco: d.loco, part: i, lx: 0, ly: 0, N: 0 });
    }
    if (d.cat === 'weapon' && d.id !== 'smoke') {
      // Turret weapons sit on parts connected to the hull through a turret ring.
      const old = V.weapons.find((w) => w.part === i);
      weapons.push(old || {
        part: i, def: d, reload: 0, angle: 0, burst: 0, gap: 0,
        pivotGx: p.x * CELL + CELL * 0.5, pivotGy: cy, turret: false,
      });
    }
  });
  // Hull contacts: corners of the body, so tipped or wrecked vehicles still rest on the ground.
  const hullPts = [[minX, minY + 0.3], [maxX, minY + 0.3], [(minX + maxX) / 2, minY + 0.3], [minX, maxY], [maxX, maxY], [(minX + maxX) / 2, maxY]];
  for (const [gx, gy] of hullPts) contacts.push({ gx, gy, r: 0, loco: null, part: -1, lx: 0, ly: 0, N: 0 });
  const tmp = { x: 0, y: 0 };
  for (const c of contacts) { gridToLocal(V, c.gx, c.gy, tmp); c.lx = tmp.x; c.ly = tmp.y; }

  // Turret weapons: a weapon whose part group, without the ring, sits above a live turret ring.
  const ring = V.parts.findIndex((p) => p.alive && p.def.ring);
  if (ring >= 0) {
    const rp = V.parts[ring];
    for (const w of weapons) w.turret = V.parts[w.part].y < rp.y;
  }

  b.I = Math.max(I, 1);
  V.contacts = contacts;
  V.weapons = weapons;
  V.nLoco = Math.max(1, contacts.filter((c) => c.loco).length);
  const K = b.m * (2 * Math.PI * SUSPENSION_HZ) ** 2;
  V.k = K / Math.max(V.nLoco, 3);
  V.c = (2 * SUSPENSION_DAMP * Math.sqrt(K * b.m)) / Math.max(V.nLoco, 3);
  V.power = engines;
  V.crew = crew;
  V.canDrive = engines > 0 && crew > 0 && loco > 0;
  V.immobile = !V.canDrive;
  V.fuelMax = fuelMax;
  V.fuel = Math.min(V.fuel, fuelMax);
  V.shellsMax = Math.max(V.shellsMax, shellsMax);
  V.spot = spot;
  V.fc = fc;
  V.stab = stab;
  V.smoke = V.smoke === undefined ? smoke : Math.min(V.smoke, smoke);
  V.bounds = { minX, maxX, minY, maxY };
  V.len = maxX - minX;
  V.height = maxY - minY;
  V.radius = Math.hypot(V.len, V.height) / 2 + 0.5;
  V.soft = V.parts.every((p) => !p.alive || p.def.armor <= 15);
  V.dirty = true;
}

function stepVehicle(V, T, dt) {
  const b = V.body;
  const h = dt / PHYS_SUBSTEPS;
  const st = V.stats;
  const pf = clamp(st.pressure / 100, 0.3, 3);
  const eff = DRIVE_EFF[st.loco] || 0.8;
  const avail = V.power >= st.drawn ? 1 : V.power / Math.max(st.drawn, 1);
  const hasFuel = V.fuelMax === 0 || V.fuel > 0;
  const Peff = V.canDrive && hasFuel ? V.power * 1000 * eff * avail : 0;
  const capBase = (st.cap / 3.6) * BATTLE_SPEED_SCALE;
  const dragA = V.height * 2.5;
  const throttle = V.canDrive ? V.throttle : 0;

  for (let s = 0; s < PHYS_SUBSTEPS; s++) {
    const ca = Math.cos(b.a), sa = Math.sin(b.a);
    let fx = 0, fy = -b.m * GRAVITY, tq = 0;
    let nGround = 0, sumMuN = 0;
    // Normal forces.
    for (const c of V.contacts) {
      const rx = c.lx * ca - c.ly * sa;
      const ry = c.lx * sa + c.ly * ca;
      const px = b.x + rx, py = b.y + ry;
      c.N = 0;
      const pen = T.height(px) - (py - c.r);
      if (pen <= 0) continue;
      const sl = T.slope(px);
      const inv = 1 / Math.sqrt(1 + sl * sl);
      const nx = -sl * inv, ny = inv;
      const vpx = b.vx - b.w * ry, vpy = b.vy + b.w * rx;
      const vn = vpx * nx + vpy * ny;
      const N = Math.max(0, V.k * Math.min(pen, 0.6) - V.c * vn);
      c.N = N; c.rx = rx; c.ry = ry; c.nx = nx; c.ny = ny;
      c.vt = vpx * ny - vpy * nx;          // along the tangent (ny, −nx)
      c.ter = T.terrainAt(px);
      fx += nx * N; fy += ny * N;
      tq += rx * ny * N - ry * nx * N;
      if (c.loco) { nGround++; sumMuN += c.ter.grip * N; }
    }
    // Drive force (design/05 §7.1): min(P ÷ v, μ × load), faded out at the speed cap.
    const vAlong = b.vx * ca + b.vy * sa;
    let drive = 0;
    if (throttle !== 0 && nGround > 0) {
      const sign = throttle > 0 ? 1 : -1;
      const cap = capBase * (sign === V.dir ? 1 : REVERSE_CAP);
      const fwd = vAlong * sign;
      drive = Math.min(Peff / Math.max(Math.abs(vAlong), LOW_GEAR_SPEED), sumMuN) * Math.abs(throttle);
      if (fwd > cap) drive = -Math.min(sumMuN * 0.4, (b.m * (fwd - cap)) / h);   // engine braking downhill
      else if (fwd > cap - 0.6) drive *= (cap - fwd) / 0.6;
      drive *= sign;
    }
    const mShare = b.m / Math.max(1, nGround);
    for (const c of V.contacts) {
      if (c.N <= 0) continue;
      const tx = c.ny, ty = -c.nx;
      let resist;
      let Ft = 0;
      if (c.loco) {
        const ter = c.ter;
        const crr = c.loco === 'track' ? 0.04 + ter.soft * 0.08 * pf : 0.015 + ter.soft * 0.25 * pf;
        resist = crr * c.N;
        Ft = sumMuN > 0 ? (drive * ter.grip * c.N) / sumMuN : 0;
        // Brakes hold when there's no throttle, or when throttle opposes the motion.
        if (throttle === 0 || (Math.abs(c.vt) > 0.3 && Math.sign(throttle) !== Math.sign(c.vt))) resist += ter.grip * c.N * 0.8;
      } else {
        resist = 0.55 * c.N;           // hull scraping along the ground
      }
      // Coulomb-style: resistance can stop a contact but never push it backwards.
      let F;
      if (Math.abs(c.vt) > 0.05) {
        F = Ft - Math.sign(c.vt) * Math.min(resist, (Math.abs(c.vt) * mShare) / h + Math.abs(Ft));
      } else if (Math.abs(Ft) <= resist) {
        F = (-c.vt * mShare) / h * 0.5;
      } else {
        F = Ft - Math.sign(Ft) * resist;
      }
      fx += tx * F; fy += ty * F;
      tq += c.rx * ty * F - c.ry * tx * F;
    }
    // Air drag.
    const v2 = b.vx * b.vx + b.vy * b.vy;
    if (v2 > 0.01) {
      const v = Math.sqrt(v2);
      const fd = 0.5 * 1.225 * 0.9 * dragA * v2;
      fx -= (fd * b.vx) / v; fy -= (fd * b.vy) / v;
    }
    // Semi-implicit Euler.
    b.vx += (fx / b.m) * h;
    b.vy += (fy / b.m) * h;
    b.w += (tq / b.I) * h;
    b.w *= 0.998;
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.a += b.w * h;
  }
  // Keep inside the battlefield.
  const lo = 3 + V.len / 2, hi = T.length - 3 - V.len / 2;
  if (b.x < lo) { b.x = lo; if (b.vx < 0) b.vx = 0; }
  if (b.x > hi) { b.x = hi; if (b.vx > 0) b.vx = 0; }
  if (b.a > Math.PI) b.a -= Math.PI * 2;
  if (b.a < -Math.PI) b.a += Math.PI * 2;
  V.speed = b.vx * Math.cos(b.a) + b.vy * Math.sin(b.a);
  // Fuel: litres per hour at full load, from the live engines.
  if (throttle !== 0 && V.fuelMax > 0) {
    let use = 0;
    for (const p of V.parts) if (p.alive && p.def.fuelUse) use += p.def.fuelUse;
    V.fuel = Math.max(0, V.fuel - (use * Math.abs(throttle) * dt) / 3600 * 20);
  }
}

// Soft push so vehicles don't drive through each other.
function separateVehicles(list) {
  for (let i = 0; i < list.length; i++) {
    const A = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const B = list[j];
      const dx = B.body.x - A.body.x;
      const need = (A.len + B.len) / 2 * 0.85;
      if (Math.abs(dx) >= need || Math.abs(B.body.y - A.body.y) > (A.height + B.height) / 2) continue;
      const push = (need - Math.abs(dx)) / 2;
      const s = dx >= 0 ? 1 : -1;
      const ma = A.body.m, mb = B.body.m;
      A.body.x -= s * push * (mb / (ma + mb)) * 2;
      B.body.x += s * push * (ma / (ma + mb)) * 2;
      const rel = (B.body.vx - A.body.vx) * s;
      if (rel < 0) {
        const vcm = (A.body.vx * ma + B.body.vx * mb) / (ma + mb);
        A.body.vx = vcm; B.body.vx = vcm;
      }
    }
  }
}

// ---------- debris: detached parts tumble, bounce and fade after 6 s (design/03 §4)
const debris = makePool(() => ({ alive: false, x: 0, y: 0, a: 0, vx: 0, vy: 0, w: 0, t: 0, img: null, iw: 0, ih: 0, r: 0.5 }), 48);

function stepDebris(T, dt) {
  debris.forEachAlive((d) => {
    d.t += dt;
    if (d.t > 6) { d.alive = false; return; }
    d.vy -= GRAVITY * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.a += d.w * dt;
    const g = T.height(d.x);
    if (d.y - d.r < g) {
      d.y = g + d.r;
      if (d.vy < 0) d.vy = -d.vy * 0.3;
      d.vx *= 0.7;
      d.w *= 0.6;
    }
  });
}

/* ---------- 10a_combat.js ---------- */
/* ==== 10a COMBAT ==== */
// Projectiles, ballistics, grid raycast, penetration, ricochet, per-part damage
// and part effects (design/01 §7.4, design/05 §3, design/04 §6).

const MAX_PROJECTILES = 300;
const RICOCHET_ANGLE = 70;          // degrees from the surface normal
const MG_RANGE_BONUS = 1;

const shells = makePool(() => ({
  alive: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, sx: 0, sy: 0, t: 0,
  side: 0, shooter: null, def: null, pen: 0, dmg: 0, mg: false, he: false, ignore: null, ignoreT: 0,
}), MAX_PROJECTILES);

// Battlefield range of a weapon (design sheet range × distance scale).
const weaponRange = (d) => d.range * BATTLE_DISTANCE_SCALE;

// Penetration at a battlefield distance (design/05 §3), using the nominal sheet range.
function penAt(d, worldDist) {
  const r = worldDist / BATTLE_DISTANCE_SCALE;
  if (d.auto) return d.pen * Math.max(0.2, 1 - 0.25 * (r / 500));
  if (d.he) return d.pen;
  return d.pen * Math.max(0.5, 1 - (0.12 * (r - 500)) / 500);
}

// Barrel pivot and muzzle in world space.
const _p = { x: 0, y: 0 };
function weaponPivot(V, w, out) {
  gridToLocal(V, w.pivotGx, w.pivotGy, out);
  return localToWorld(V, out.x, out.y, out);
}
function barrelLength(d) { return d.w * CELL * 1.25 + (d.auto ? 0.3 : 0.6); }

// World-angle limits of a weapon. Turrets aim to either side; hull guns only forward.
function weaponArc(V, w) {
  const d = w.def;
  return w.turret ? { lo: -10, hi: 35, both: true } : d.auto ? { lo: -10, hi: 30, both: false } : { lo: -6, hi: 18, both: false };
}

// Elevation (degrees) of world angle `ang` relative to the body, facing `face` (+1 right, −1 left).
function elevationOf(V, ang, face) {
  const base = face > 0 ? V.body.a : V.body.a + Math.PI;
  let e = face > 0 ? ang - base : base - ang;
  while (e > Math.PI) e -= Math.PI * 2;
  while (e < -Math.PI) e += Math.PI * 2;
  return (e * 180) / Math.PI;
}
function angleFromElevation(V, elevDeg, face) {
  const e = (elevDeg * Math.PI) / 180;
  return face > 0 ? V.body.a + e : V.body.a + Math.PI - e;
}

// Low-angle ballistic solution; returns the world angle or NaN when out of reach.
function ballisticAngle(x, y, tx, ty, v, high) {
  const dx = tx - x, dy = ty - y;
  const ax = Math.max(0.01, Math.abs(dx));
  const v2 = v * v;
  const disc = v2 * v2 - GRAVITY * (GRAVITY * ax * ax + 2 * dy * v2);
  if (disc < 0) return NaN;
  const up = Math.atan((v2 + (high ? 1 : -1) * Math.sqrt(disc)) / (GRAVITY * ax));
  return dx >= 0 ? up : Math.PI - up;
}

// Work out where weapon w must point to hit (tx, ty). Returns {ok, angle, face, reason}.
function aimWeapon(V, w, tx, ty, out) {
  const d = w.def;
  weaponPivot(V, w, _p);
  const face = tx >= _p.x ? 1 : -1;
  out.face = face;
  out.ok = false;
  out.reason = '';
  if (!w.turret && face !== V.dir) { out.reason = 'Out of arc'; out.angle = angleFromElevation(V, 0, V.dir); out.face = V.dir; return out; }
  let ang = d.auto ? Math.atan2(ty - _p.y, tx - _p.x) : ballisticAngle(_p.x, _p.y, tx, ty, d.vel, !!d.indirect);
  if (Number.isNaN(ang)) { ang = angleFromElevation(V, 35, face); out.reason = 'Out of range'; }
  const arc = weaponArc(V, w);
  const el = elevationOf(V, ang, face);
  const cl = clamp(el, arc.lo, arc.hi);
  out.angle = angleFromElevation(V, cl, face);
  out.ok = !out.reason && Math.abs(cl - el) < 0.5;
  if (!out.reason && !out.ok) out.reason = 'Out of arc';
  return out;
}

// Gaussian-ish error from the seeded battle RNG (sum of three uniforms).
function gauss(rng) { return (rng.next() + rng.next() + rng.next() - 1.5) * 1.15; }

// Fire weapon w of V along world angle `ang`. spreadMul scales the aiming error.
function fireWeapon(B, V, w, ang, spreadMul) {
  const d = w.def;
  if (!d.auto) {
    if (V.shells <= 0) return false;
    V.shells--;
  }
  let spread = d.spread / V.fc;
  const moving = Math.abs(V.speed) > 0.4;
  if (moving) spread *= V.stab ? 1.6 : 2.5;
  spread *= spreadMul;
  const a = ang + (gauss(B.rng) * spread * Math.PI) / 180;
  weaponPivot(V, w, _p);
  const L = barrelLength(d);
  const mx = _p.x + Math.cos(a) * L, my = _p.y + Math.sin(a) * L;
  const s = shells.take();
  s.x = s.px = s.sx = mx; s.y = s.py = s.sy = my;
  s.vx = Math.cos(a) * d.vel + V.body.vx;
  s.vy = Math.sin(a) * d.vel + V.body.vy;
  s.t = 0; s.side = V.side; s.shooter = V; s.def = d;
  s.dmg = d.dmg; s.mg = !!d.auto; s.he = !!d.he; s.ignore = V; s.ignoreT = 0.25;
  // Recoil: impulse cal² × 0.9 N·s at the barrel base (design/05 §3).
  if (!d.auto) {
    const J = d.cal * d.cal * 0.9;
    const jx = -Math.cos(a) * J, jy = -Math.sin(a) * J;
    const b = V.body;
    b.vx += jx / b.m; b.vy += jy / b.m;
    b.w += ((_p.x - b.x) * jy - (_p.y - b.y) * jx) / b.I;
    w.kick = 1;
  }
  V.revealT = d.auto ? 1.5 : 4;
  if (V.side === 1 && B.stats) B.stats.enemyShots++;
  const pan = B.panOf ? B.panOf(mx) : 0;
  if (d.auto) {
    if ((w.burst & 1) === 0) audio.sfx('tick', pan, 1.2);
  } else {
    audio.sfx('cannon', pan, d.cal / 75);
    fxMuzzle(B, mx, my, a, d.cal);
    if (V === B.me) { haptic('fire'); B.trauma = Math.min(1, B.trauma + d.cal / 400); }
  }
  return true;
}

// ---------- grid raycast (DDA) through a vehicle's cells
// Walks cells from (x0, y0) to (x1, y1) in grid cell units (y up). cb(index, axis) returns true to stop.
function traceGrid(V, x0, y0, x1, y1, cb) {
  const W = V.design.w, H = V.design.h;
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1, axis = 'x';
  // Slab clip against the grid box.
  for (const [p, dp, max, ax] of [[x0, dx, W, 'x'], [y0, dy, H, 'y']]) {
    if (Math.abs(dp) < 1e-9) { if (p < 0 || p >= max) return false; continue; }
    let ta = (0 - p) / dp, tb = (max - p) / dp;
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    if (ta > t0) { t0 = ta; axis = ax; }
    t1 = Math.min(t1, tb);
  }
  if (t0 > t1) return false;
  const sx = x0 + dx * t0, sy = y0 + dy * t0;
  let cx = clamp(Math.floor(sx + (dx > 0 ? 1e-7 : -1e-7)), 0, W - 1);
  let cy = clamp(Math.floor(sy + (dy > 0 ? 1e-7 : -1e-7)), 0, H - 1);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
  const tdx = Math.abs(dx) > 1e-9 ? Math.abs(1 / dx) : Infinity;
  const tdy = Math.abs(dy) > 1e-9 ? Math.abs(1 / dy) : Infinity;
  let tmx = Math.abs(dx) > 1e-9 ? ((dx > 0 ? cx + 1 : cx) - x0) / dx : Infinity;
  let tmy = Math.abs(dy) > 1e-9 ? ((dy > 0 ? cy + 1 : cy) - y0) / dy : Infinity;
  for (let guard = 0; guard < 200; guard++) {
    const row = H - 1 - cy;
    const idx = V.grid[row * W + cx];
    if (idx >= 0 && cb(idx, axis, cx, cy)) return true;
    if (tmx < tmy) { if (tmx > t1) break; cx += stepX; tmx += tdx; axis = 'x'; }
    else { if (tmy > t1) break; cy += stepY; tmy += tdy; axis = 'y'; }
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) break;
  }
  return false;
}

const _g0 = { x: 0, y: 0 }, _g1 = { x: 0, y: 0 };

// Resolve a shell against vehicle V along its current step. Returns true if the shell is used up.
function shellVsVehicle(B, s, V) {
  const len = V.radius * 2.2;
  const sp = Math.hypot(s.vx, s.vy) || 1;
  worldToGrid(V, s.px, s.py, _g0);
  worldToGrid(V, s.px + (s.vx / sp) * (len + Math.hypot(s.x - s.px, s.y - s.py)), s.py + (s.vy / sp) * (len + Math.hypot(s.x - s.px, s.y - s.py)), _g1);
  const gx0 = _g0.x / CELL, gy0 = _g0.y / CELL, gx1 = _g1.x / CELL, gy1 = _g1.y / CELL;
  // Only a hit if the first occupied cell lies within this step's travel.
  const stepLen = Math.hypot(s.x - s.px, s.y - s.py) / CELL;
  const total = Math.hypot(gx1 - gx0, gy1 - gy0) || 1;
  let firstT = -1;
  traceGrid(V, gx0, gy0, gx1, gy1, (idx, axis, cx, cy) => {
    firstT = Math.hypot(cx + 0.5 - gx0, cy + 0.5 - gy0) - 0.75;
    return true;
  });
  if (firstT < 0 || firstT > stepLen + 0.5) return false;

  const ddx = (gx1 - gx0) / total, ddy = (gy1 - gy0) / total;
  const travelled = Math.hypot(s.x - s.sx, s.y - s.sy);
  let pen = s.he ? s.def.pen : penAt(s.def, travelled);
  let dmg = s.dmg;
  let last = -1, first = true, penetrated = false, exitCell = null, used = false;
  let hitName = '';
  let hx = 0, hy = 0;
  traceGrid(V, gx0, gy0, gx1, gy1, (idx, axis, cx, cy) => {
    exitCell = [cx, cy];
    if (idx === last) return false;
    last = idx;
    const part = V.parts[idx];
    if (!part.alive) return false;
    const d = part.def;
    // Surface normal of the face entered, in grid space.
    let nx = axis === 'x' ? -Math.sign(ddx) : 0;
    let ny = axis === 'y' ? -Math.sign(ddy) : 0;
    if (d.sloped && ddx * 0.7071 + ddy * 0.7071 < 0) { nx = 0.7071; ny = 0.7071; }
    const cos = Math.max(0.05, Math.abs(ddx * nx + ddy * ny));
    const eff = d.armor / cos;
    if (first) {
      first = false;
      hx = cx; hy = cy;
      const angle = (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
      if (!s.he && !s.mg && d.armor >= 8 && angle > RICOCHET_ANGLE) {
        ricochet(B, s, V, cx, cy, nx, ny);
        used = true;
        return true;
      }
      if (s.he) {
        used = true;
        return true;       // HE bursts on the surface
      }
    }
    if (pen >= eff) {
      pen -= eff;
      if (!penetrated) { penetrated = true; hitName = d.name; }
      damagePart(B, V, idx, dmg, s.shooter);
      dmg *= 0.65;
      if (dmg < 4 || pen <= 1) { used = true; return true; }
      return false;
    }
    // Stopped by armour.
    damagePart(B, V, idx, dmg * (s.mg ? 0.02 : 0.08), s.shooter);
    if (!penetrated && !s.mg) {
      stoppedAt(B, V, cx, cy, s);
    }
    used = true;
    return true;
  });
  const hitWorld = gridCellToWorld(V, hx, hy);
  if (s.he) {
    explode(B, hitWorld.x, hitWorld.y, s.def.heDmg || s.dmg, s.def.heRadius || 3, s.shooter);
    return true;
  }
  if (penetrated && s.def.burst && !V.destroyed) {
    // Bursting charge inside the vehicle: damages the parts around the first penetration.
    const cx = hx, cy = hy;
    V.parts.forEach((p, i) => {
      if (!p.alive) return;
      const px = p.x + p.def.w / 2, py = V.design.h - p.y - p.def.h / 2;
      const dd = Math.hypot(px - (cx + 0.5), py - (cy + 0.5)) * CELL;
      if (dd < s.def.burstR) damagePart(B, V, i, s.def.burst * (1 - dd / s.def.burstR), s.shooter);
    });
  }
  if (penetrated) {
    if (!s.mg) {
      if (s.shooter === B.me || V === B.me) floatText(`Penetrated · ${hitName}`, hitWorld.x, hitWorld.y + 1.5, false);
      fxSparks(B, hitWorld.x, hitWorld.y, Math.atan2(s.vy, s.vx), 10);
      audio.sfx('clunk', B.panOf(hitWorld.x), 1);
      if (s.shooter && s.shooter.side === 0) B.stats.pens++;
    } else if (B.rng.next() < 0.3) {
      fxSparks(B, hitWorld.x, hitWorld.y, Math.atan2(s.vy, s.vx), 2);
    }
  }
  V.lastHitT = B.time;
  if (V === B.me) { haptic('hit'); B.trauma = Math.min(1, B.trauma + 0.25); }
  if (!used && exitCell) {
    // Over-penetration: the shell leaves the far side and keeps flying.
    s.ignore = V; s.ignoreT = 0.3; s.dmg = dmg;
    return false;
  }
  return true;
}

function gridCellToWorld(V, cx, cy) {
  const o = { x: 0, y: 0 };
  gridToLocal(V, (cx + 0.5) * CELL, (cy + 0.5) * CELL, o);
  return localToWorld(V, o.x, o.y, o);
}

function ricochet(B, s, V, cx, cy, nx, ny) {
  const p = gridCellToWorld(V, cx, cy);
  // Reflect the velocity about the surface normal (turned into world space).
  const ang = V.body.a;
  const wnx = nx * V.dir * Math.cos(ang) - ny * Math.sin(ang);
  const wny = nx * V.dir * Math.sin(ang) + ny * Math.cos(ang);
  const vn = s.vx * wnx + s.vy * wny;
  s.vx = (s.vx - 2 * vn * wnx) * 0.55;
  s.vy = (s.vy - 2 * vn * wny) * 0.55;
  s.x = p.x + wnx * 0.4; s.y = p.y + wny * 0.4;
  s.px = s.x; s.py = s.y;
  s.ignore = V; s.ignoreT = 0.5;
  s.dmg *= 0.3;
  if (s.shooter === B.me || V === B.me) floatText('Ricochet', p.x, p.y + 1.5, false);
  fxSparks(B, p.x, p.y, Math.atan2(s.vy, s.vx), 7);
  audio.sfx('ricochet', B.panOf(p.x));
  if (V === B.me) B.stats.ricochetsTaken++;
}

function stoppedAt(B, V, cx, cy, s) {
  const p = gridCellToWorld(V, cx, cy);
  if (s.shooter === B.me || V === B.me) floatText('No penetration', p.x, p.y + 1.5, false);
  fxSparks(B, p.x, p.y, B.rng.range(0, 6.28), 4);
  audio.sfx('clunk', B.panOf(p.x), 0.6);
}

// ---------- damage
function damagePart(B, V, idx, dmg, source) {
  const p = V.parts[idx];
  if (!p.alive || dmg <= 0) return;
  p.hp -= dmg;
  p.scorch = Math.min(1, p.scorch + dmg / p.def.hp);
  V.dirty = true;
  if (p.hp <= 0) destroyPart(B, V, idx, source);
  else if (!V.destroyed) checkVehicleState(B, V, source);
}

function destroyPart(B, V, idx, source) {
  const p = V.parts[idx];
  if (!p.alive) return;
  p.alive = false;
  V.alive[idx] = 0;
  const d = p.def;
  const at = gridCellToWorld(V, p.x + d.w / 2 - 0.5, V.design.h - p.y - d.h / 2 - 0.5);
  spawnDebris(B, V, [idx], at, 5);
  audio.sfx('crunch', B.panOf(at.x));
  if (V === B.me) haptic('part');
  // Part effects (design/01 §7.4).
  if (d.detonate && B.rng.next() < d.detonate) {
    rebuildVehicle(V);
    detonate(B, V, source);
    return;
  }
  if (d.fire && B.rng.next() < d.fire) {
    V.fires = V.fires || [];
    V.fires.push({ gx: (p.x + d.w / 2) * CELL, gy: (V.design.h - p.y - d.h / 2) * CELL, t: 12 });
    floatText('Fire', at.x, at.y + 2, true);
  }
  if (d.power > 0 && d.cat === 'mobility') floatText('Engine destroyed', at.x, at.y + 2.5, false);
  else if (d.cat === 'weapon') floatText(`${d.name} silenced`, at.x, at.y + 2.5, false);
  else if (d.ring) floatText('Turret ring jammed', at.x, at.y + 2.5, false);

  // Parts no longer connected to the main body fall off (turret toss, lost wheels).
  const groups = components(V.design, occupancy(V.design, V.alive), V.alive);
  if (groups.length > 1) {
    const score = (g) => g.reduce((s, i) => s + (V.parts[i].def.crew ? 1e6 : 0) + (V.parts[i].def.loco ? 1e4 : 0) + V.parts[i].def.mass, 0);
    groups.sort((a, b) => score(b) - score(a));
    for (let k = 1; k < groups.length; k++) {
      for (const i of groups[k]) { V.parts[i].alive = false; V.alive[i] = 0; }
      const g = groups[k];
      const c = V.parts[g[0]];
      spawnDebris(B, V, g, gridCellToWorld(V, c.x, V.design.h - c.y - 1), 7);
    }
  }
  rebuildVehicle(V);
  checkVehicleState(B, V, source);
}

function checkVehicleState(B, V, source) {
  if (V.destroyed) return;
  let hp = 0;
  for (const p of V.parts) if (p.alive) hp += p.hp;
  if (V.crew <= 0 || V.parts.every((p) => !p.alive || p.def.cat === 'mobility')) {
    knockOut(B, V, source, 'Knocked out');
  } else if (hp < V.hpMax * 0.3) {
    knockOut(B, V, source, 'Wrecked');
  } else if (V.immobile && !V.wasImmobile) {
    V.wasImmobile = true;
    floatText('Immobilised', V.body.x, V.body.y + V.height, false);
  }
}

function knockOut(B, V, source, label) {
  if (V.destroyed) return;
  V.destroyed = true;
  V.throttle = 0;
  V.canDrive = false;
  B.hitStop = 0.05;
  fxExplosion(B, V.body.x, V.body.y + 0.5, 1.2);
  fxSmokeColumn(B, V);
  audio.sfx('boom', B.panOf(V.body.x));
  B.trauma = Math.min(1, B.trauma + 0.35);
  floatText(label, V.body.x, V.body.y + V.height + 1, true);
  if (V.side === 0) haptic('lost');
  if (B.onDestroyed) B.onDestroyed(V, source);
}

// Ammo detonation: the vehicle comes apart.
function detonate(B, V, source) {
  const alive = [];
  V.parts.forEach((p, i) => { if (p.alive) alive.push(i); });
  for (const i of alive) {
    if (B.rng.next() < 0.55 || V.parts[i].def.ring || V.parts[i].y < 3) {
      V.parts[i].alive = false; V.alive[i] = 0;
      const c = V.parts[i];
      spawnDebris(B, V, [i], gridCellToWorld(V, c.x, V.design.h - c.y - 1), 11);
    }
  }
  rebuildVehicle(V);
  fxExplosion(B, V.body.x, V.body.y + 1, 2.2);
  audio.sfx('boom', B.panOf(V.body.x), 1.6);
  knockOut(B, V, source, 'Ammo detonated');
}

// High-explosive burst: damage falls off with distance; heavy armour shrugs most of it off.
function explode(B, x, y, dmg, radius, source) {
  fxExplosion(B, x, y, radius / 3);
  audio.sfx('boom', B.panOf(x), 0.7 + radius / 8);
  const gy = B.T.height(x);
  if (y - gy < radius * 0.6) B.T.carve(x, radius * 0.6, 0.35 + radius * 0.06);
  const tmp = { x: 0, y: 0 };
  for (const V of B.units) {
    if (Math.hypot(V.body.x - x, V.body.y - y) > radius + V.radius) continue;
    V.parts.forEach((p, i) => {
      if (!p.alive) return;
      gridToLocal(V, (p.x + p.def.w / 2) * CELL, (V.design.h - p.y - p.def.h / 2) * CELL, tmp);
      localToWorld(V, tmp.x, tmp.y, tmp);
      const dd = Math.hypot(tmp.x - x, tmp.y - y);
      if (dd >= radius) return;
      const armourCut = p.def.armor > 20 ? 20 / p.def.armor : 1;
      damagePart(B, V, i, dmg * (1 - dd / radius) * armourCut, source);
    });
  }
  // Trees near the blast fall.
  for (const tr of B.T.trees) if (tr.alive && Math.abs(tr.x - x) < radius * 0.7) breakTree(B, tr, tr.x > x ? 1 : -1);
}

function breakTree(B, tr, dir) {
  tr.alive = false;
  tr.fallDir = dir;
  fxDirt(B, tr.x, B.T.height(tr.x) + 0.5, 6);
  audio.sfx('crunch', B.panOf(tr.x), 0.6);
}

// Detach a group of parts as a tumbling debris body.
function spawnDebris(B, V, idxs, at, kick) {
  const dd = debris.take();
  const img = renderPartsSprite(V, idxs);
  dd.img = img.canvas; dd.iw = img.w; dd.ih = img.h;
  dd.x = at.x; dd.y = at.y; dd.a = V.body.a;
  dd.vx = V.body.vx + B.rng.range(-kick, kick) * 0.6;
  dd.vy = V.body.vy + B.rng.range(kick * 0.4, kick);
  dd.w = B.rng.range(-5, 5);
  dd.t = 0;
  dd.r = Math.max(img.w, img.h) * 0.25;
  dd.dir = V.dir;
}

// ---------- projectile update
function stepShells(B, dt) {
  const T = B.T;
  shells.forEachAlive((s) => {
    s.px = s.x; s.py = s.y;
    s.t += dt;
    if (!s.mg) s.vy -= GRAVITY * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.ignoreT > 0) { s.ignoreT -= dt; if (s.ignoreT <= 0) s.ignore = null; }
    const maxT = s.mg ? weaponRange(s.def) * MG_RANGE_BONUS / s.def.vel * 1.3 : 8;
    if (s.t > maxT || s.x < 0 || s.x > T.length || s.y < -50) { s.alive = false; return; }
    // Vehicles.
    for (const V of B.units) {
      if (V === s.ignore) continue;
      if (V.side === s.side && !V.destroyed) continue;       // no friendly fire on live allies
      const b = V.body;
      // Distance from the vehicle centre to this step's segment.
      const ex = s.x - s.px, ey = s.y - s.py;
      const l2 = ex * ex + ey * ey || 1;
      const t = clamp(((b.x - s.px) * ex + (b.y - s.py) * ey) / l2, 0, 1);
      if (Math.hypot(s.px + ex * t - b.x, s.py + ey * t - b.y) > V.radius) continue;
      if (shellVsVehicle(B, s, V)) { s.alive = false; return; }
    }
    // Trees stop machine-gun rounds and sometimes shells.
    // Ground.
    const gh = T.height(s.x);
    if (s.y <= gh) {
      s.alive = false;
      if (s.he) explode(B, s.x, gh, s.def.heDmg || s.dmg, s.def.heRadius || 3, s.shooter);
      else fxDirt(B, s.x, gh, s.mg ? 1 : 5);
      if (!s.mg && !s.he) audio.sfx('thud', B.panOf(s.x), 0.8);
    }
  });
}

/* ---------- 10b_effects.js ---------- */
/* ==== 10b EFFECTS ==== */
// The joy layer (design/03 §5): muzzle flashes, sparks, dirt, explosions, smoke,
// fire, shockwave rings. Particles are pooled and capped by the quality setting.

const FX_FLASH = 0, FX_SMOKE = 1, FX_SPARK = 2, FX_DIRT = 3, FX_FIRE = 4, FX_RING = 5, FX_EMBER = 6;

const particles = makePool(() => ({
  alive: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, size: 1, grow: 0, g: 0, shade: 0,
}), 300);

// Smoke screens block spotting for 20 s (design/05 smoke launcher).
const smokeScreens = makePool(() => ({ alive: false, x: 0, y: 0, r: 0, t: 0 }), 12);
// Smoke columns from wrecks: at most 3 at once.
const smokeColumns = makePool(() => ({ alive: false, V: null, t: 0, acc: 0 }), 3);

let particleCount = 0;
function particleCap() { return (QUALITY[save.settings.quality] || QUALITY.High).particles; }

function spawnParticle(kind, x, y, vx, vy, life, size) {
  if (particleCount >= particleCap()) return null;
  const p = particles.take();
  p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.t = 0; p.life = life; p.size = size;
  p.grow = 0; p.g = 0; p.shade = 0;
  return p;
}

function fxMuzzle(B, x, y, ang, cal) {
  const k = cal / 75;
  const f = spawnParticle(FX_FLASH, x, y, 0, 0, 0.07, 1.4 * k + 0.4);
  if (f) f.shade = ang;
  for (let i = 0; i < 3 + k * 3; i++) {
    const a = ang + B.rng.range(-0.5, 0.5);
    const sp = B.rng.range(1, 4) * (0.6 + k);
    const p = spawnParticle(FX_SMOKE, x, y, Math.cos(a) * sp, Math.sin(a) * sp + 0.5, B.rng.range(0.9, 1.6), 0.5 + k * 0.4);
    if (p) { p.grow = 1.2; p.shade = 0.55; }
  }
}

function fxSparks(B, x, y, ang, n) {
  for (let i = 0; i < n; i++) {
    const a = ang + B.rng.range(-0.8, 0.8);
    const sp = B.rng.range(6, 16);
    const p = spawnParticle(FX_SPARK, x, y, Math.cos(a) * sp, Math.sin(a) * sp, B.rng.range(0.15, 0.35), 1);
    if (p) p.g = 1;
  }
  spawnParticle(FX_FLASH, x, y, 0, 0, 0.05, 0.8);
}

function fxDirt(B, x, y, n) {
  for (let i = 0; i < n; i++) {
    const p = spawnParticle(FX_DIRT, x, y, B.rng.range(-3, 3), B.rng.range(2, 7), B.rng.range(0.6, 1.1), B.rng.range(0.12, 0.3));
    if (p) p.g = 1;
  }
  const s = spawnParticle(FX_SMOKE, x, y + 0.3, 0, 0.6, 1.2, 0.6 + n * 0.05);
  if (s) { s.grow = 1; s.shade = 0.35; }
}

function fxExplosion(B, x, y, size) {
  spawnParticle(FX_FLASH, x, y, 0, 0, 0.09, 2.5 * size);
  const ring = spawnParticle(FX_RING, x, y, 0, 0, 0.35, 0.5);
  if (ring) ring.grow = 7 * size;
  for (let i = 0; i < 6 * size + 4; i++) {
    const a = B.rng.range(0.2, Math.PI - 0.2);
    const sp = B.rng.range(2, 6) * size;
    const f = spawnParticle(FX_FIRE, x, y, Math.cos(a) * sp, Math.sin(a) * sp, B.rng.range(0.35, 0.7), 0.6 * size + 0.3);
    if (f) f.grow = 0.8;
  }
  for (let i = 0; i < 5 * size + 3; i++) {
    const s = spawnParticle(FX_SMOKE, x + B.rng.range(-1, 1) * size, y + B.rng.range(0, 1) * size,
      B.rng.range(-1, 1), B.rng.range(0.5, 2), B.rng.range(1.5, 2.8), 0.8 * size + 0.4);
    if (s) { s.grow = 1.3; s.shade = 0.25; }
  }
  fxDirt(B, x, B.T.height(x) + 0.2, Math.round(4 + size * 4));
}

function fxSmokeColumn(B, V) {
  let n = 0;
  smokeColumns.forEachAlive(() => n++);
  if (n >= 3) {
    // Recycle the oldest column.
    let oldest = null;
    smokeColumns.forEachAlive((c) => { if (!oldest || c.t > oldest.t) oldest = c; });
    if (oldest) oldest.alive = false;
  }
  const c = smokeColumns.take();
  c.V = V; c.t = 0; c.acc = 0;
}

function fxSmokeScreen(B, x, y) {
  const s = smokeScreens.take();
  s.x = x; s.y = y; s.r = 5; s.t = 0;
  for (let i = 0; i < 10; i++) {
    const p = spawnParticle(FX_SMOKE, x + B.rng.range(-4, 4), y + B.rng.range(0, 3), B.rng.range(-0.6, 0.6), B.rng.range(0.1, 0.5), B.rng.range(6, 9), B.rng.range(1.5, 2.6));
    if (p) { p.grow = 0.25; p.shade = 0.75; }
  }
}

function stepEffects(B, dt) {
  particleCount = 0;
  particles.forEachAlive((p) => {
    p.t += dt;
    if (p.t >= p.life) { p.alive = false; return; }
    particleCount++;
    if (p.g) p.vy -= GRAVITY * dt * p.g;
    if (p.kind === FX_SMOKE) { p.vx *= 0.98; p.vy = p.vy * 0.98 + 0.25 * dt; }
    if (p.kind === FX_FIRE) { p.vx *= 0.9; p.vy = p.vy * 0.9 + 3 * dt; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.size += p.grow * dt;
    if (p.kind === FX_DIRT && p.y < B.T.height(p.x)) p.alive = false;
  });
  smokeScreens.forEachAlive((s) => {
    s.t += dt;
    s.r = Math.min(9, s.r + dt * 2);
    if (s.t > 20) s.alive = false;
  });
  smokeColumns.forEachAlive((c) => {
    c.t += dt;
    if (c.t > 25) { c.alive = false; return; }
    c.acc += dt;
    if (c.acc > 0.18) {
      c.acc = 0;
      const b = c.V.body;
      const p = spawnParticle(FX_SMOKE, b.x + B.rng.range(-0.6, 0.6), b.y + c.V.height * 0.5, B.rng.range(-0.3, 0.3) + 0.4, B.rng.range(1.2, 2), 5, 0.8);
      if (p) { p.grow = 0.6; p.shade = 0.15; }
      if (c.t < 8 && B.rng.next() < 0.6) {
        const f = spawnParticle(FX_FIRE, b.x + B.rng.range(-0.8, 0.8), b.y + c.V.height * 0.3, 0, 1.2, 0.5, 0.5);
        if (f) f.grow = 0.4;
      }
    }
  });
}

// Is the straight line between two points blocked by a smoke screen?
function smokeBlocks(ax, ay, bx, by) {
  let blocked = false;
  smokeScreens.forEachAlive((s) => {
    if (blocked) return;
    const ex = bx - ax, ey = by - ay;
    const l2 = ex * ex + ey * ey || 1;
    const t = clamp(((s.x - ax) * ex + (s.y - ay) * ey) / l2, 0, 1);
    if (Math.hypot(ax + ex * t - s.x, ay + ey * t - s.y) < s.r) blocked = true;
  });
  return blocked;
}

// Screen shake: trauma model, shake = trauma², capped at 8 px; off with reduced motion.
function shakeOffset(B, out) {
  const s = save.settings.reducedMotion ? 0 : B.trauma * B.trauma * 8;
  out.x = s ? Math.sin(B.time * 71) * s : 0;
  out.y = s ? Math.cos(B.time * 53) * s : 0;
  return out;
}

/* ---------- 11_ai.js ---------- */
/* ==== 11 AI ==== */
// Spotting, squad orders, enemy tactics and automatic weapons (design/01 §7.2, §7.4).

const SPOT_BASE = 95;              // battlefield metres a crew can see without optics
const SPOT_INTERVAL = 0.25;
const TURRET_SWING = 1.0;          // seconds to swing a turret to the other side
const ELEVATION_RATE = 40;         // degrees per second
const _aim = { ok: false, angle: 0, face: 1, reason: '' };

function spotRange(B, O, V) {
  let r = SPOT_BASE * O.spot;
  if (B.T.inForest(V.body.x)) r *= 1 - TERRAIN[T_FOREST].conceal;
  if (V.revealT > 0) r = Math.max(r, SPOT_BASE * 1.6);
  return r;
}

// Every 0.25 s: who can each side see? Wrecks stay visible once seen.
function updateSpotting(B) {
  for (const V of B.units) {
    if (V.destroyed && V.seen) continue;
    let seen = false;
    for (const O of B.units) {
      if (O.side === V.side || O.destroyed || O.crew <= 0) continue;
      const d = Math.abs(O.body.x - V.body.x);
      if (d > spotRange(B, O, V)) continue;
      if (smokeBlocks(O.body.x, O.body.y + O.height, V.body.x, V.body.y + V.height * 0.5)) continue;
      seen = true;
      break;
    }
    V.seen = seen || (V.destroyed && V.seen);
    if (seen) { V.lastSeenX = V.body.x; V.everSeen = true; }
  }
}

function nearestTarget(B, V, maxRange, filter) {
  let best = null, bd = Infinity;
  for (const U of B.units) {
    if (U.side === V.side || U.destroyed || !U.seen) continue;
    if (filter && !filter(U)) continue;
    const d = Math.abs(U.body.x - V.body.x);
    if (d < bd && d <= maxRange) { bd = d; best = U; }
  }
  return best;
}

function mainWeapon(V) {
  let best = null;
  for (const w of V.weapons) if (!w.def.auto && V.parts[w.part].alive && (!best || w.def.pen > best.def.pen)) best = w;
  return best;
}

// Target point on a vehicle: a little above its centre of mass.
function aimPoint(U, out) {
  out.x = U.body.x;
  out.y = U.body.y + U.height * 0.15;
  return out;
}

// Turn the barrel toward `angle` (world) at the elevation rate; handles swinging sides.
function trainWeapon(V, w, angle, face, dt) {
  if (w.face === undefined) { w.face = V.dir; w.angle = angleFromElevation(V, 0, V.dir); w.swing = 0; }
  if (face !== w.face) {
    if (!w.turret) return false;
    w.face = face;
    w.swing = TURRET_SWING;
  }
  if (w.swing > 0) { w.swing -= dt; w.angle = angleFromElevation(V, 0, w.face); return false; }
  const cur = elevationOf(V, w.angle, w.face);
  const want = elevationOf(V, angle, w.face);
  const step = ELEVATION_RATE * dt;
  const next = Math.abs(want - cur) <= step ? want : cur + Math.sign(want - cur) * step;
  w.angle = angleFromElevation(V, next, w.face);
  return Math.abs(want - next) < 0.6;
}

// Reloading, automatic weapons and (for AI) the main gun.
function runWeapons(B, V, dt, aiControlled) {
  const loaderPenalty = V.crew < 3 ? 1.6 : 1;
  const tmp = { x: 0, y: 0 };
  for (const w of V.weapons) {
    if (!V.parts[w.part].alive) continue;
    const d = w.def;
    if (w.kick) w.kick = Math.max(0, w.kick - dt * 6);
    if (w.reload > 0) w.reload -= dt;
    if (d.auto) {
      // Machine guns fire by themselves at soft targets (AI guns at anything in range).
      const T = nearestTarget(B, V, weaponRange(d), aiControlled ? null : (U) => U.soft);
      if (!T || B.cfg.holdFire && V.side === 1) { w.burst = 0; continue; }
      aimPoint(T, tmp);
      aimWeapon(V, w, tmp.x, tmp.y, _aim);
      const ready = trainWeapon(V, w, _aim.angle, _aim.face, dt);
      if (!_aim.ok || !ready || w.reload > 0) continue;
      fireWeapon(B, V, w, w.angle, aiControlled ? 1 / (V.ai ? V.ai.accuracy : 1) : 1);
      w.burst++;
      w.reload = 60 / d.rpm * 1.5;
      if (w.burst >= d.burst) { w.burst = 0; w.reload = 1.4; }
      continue;
    }
    if (!aiControlled) continue;
    const tgt = V.ai && V.ai.target;
    if (!tgt || tgt.destroyed || !tgt.seen) continue;
    aimPoint(tgt, tmp);
    aimWeapon(V, w, tmp.x, tmp.y, _aim);
    const ready = trainWeapon(V, w, _aim.angle, _aim.face, dt);
    if (B.cfg.holdFire && V.side === 1) continue;
    if (!_aim.ok || !ready || w.reload > 0 || V.ai.react > 0 || V.shells <= 0) continue;
    if (Math.abs(tgt.body.x - V.body.x) > weaponRange(d)) continue;
    if (fireWeapon(B, V, w, w.angle, 1 / V.ai.accuracy)) w.reload = d.reload * loaderPenalty;
  }
}

// ---------- squad-mates (design/02 §3.4)
function squadThink(B, V, dt) {
  const me = B.me;
  const ai = V.ai;
  const slot = B.squad.indexOf(V) < B.squad.indexOf(me) ? B.squad.indexOf(V) + 1 : B.squad.indexOf(V);
  const dir = 1;                      // the squad advances to the right
  let goal = null;
  if (ai.hold !== null) goal = ai.hold;
  else if (B.order === 'Follow') goal = me.body.x - dir * 12 * slot;
  else if (B.order === 'Escort') goal = me.body.x + dir * (slot === 1 ? 10 : -10);
  else if (B.order === 'Attack') goal = B.target && !B.target.destroyed ? B.target.body.x - dir * (weaponRange(mainWeapon(V) ? mainWeapon(V).def : PARTS.mg) * 0.7) : me.body.x - dir * 10 * slot;
  else if (B.order === 'Back') goal = me.body.x - dir * 30 * slot;
  V.throttle = goal === null ? 0 : Math.abs(goal - V.body.x) < 2 ? 0 : clamp((goal - V.body.x) * 0.25, -1, 1);
  // Engage: the Attack order uses your target; otherwise the nearest enemy in range.
  const mw = mainWeapon(V);
  const range = mw ? weaponRange(mw.def) : 0;
  let tgt = null;
  if (B.order === 'Attack' && B.target && !B.target.destroyed && B.target.seen) tgt = B.target;
  else tgt = nearestTarget(B, V, range);
  if (tgt !== ai.target) { ai.target = tgt; ai.react = 0.6; }
  if (ai.react > 0) ai.react -= dt;
}

// ---------- enemy tactics
function enemyThink(B, V, dt) {
  const ai = V.ai;
  const mw = mainWeapon(V);
  const range = mw ? weaponRange(mw.def) : V.weapons.length ? weaponRange(V.weapons[0].def) : 0;
  const tgt = nearestTarget(B, V, Math.max(range, SPOT_BASE * 2));
  if (tgt !== ai.target) { ai.target = tgt; ai.react = ai.reaction; }
  if (ai.react > 0) ai.react -= dt;
  const x = V.body.x;
  if (ai.mode === 'parked') {
    V.throttle = 0;
  } else if (ai.mode === 'convoy') {
    // Drive between two points; run for the far edge once shot at.
    if (B.time - V.lastHitT < 20) V.throttle = 0.8;
    else {
      if (x < ai.a) ai.leg = 1;
      if (x > ai.b) ai.leg = -1;
      V.throttle = 0.45 * ai.leg;
    }
  } else if (tgt) {
    const d = Math.abs(tgt.body.x - x);
    const want = range * 0.65;
    const toward = Math.sign(tgt.body.x - x);
    if (d > want + 8) V.throttle = 0.8 * toward;
    else if (d < want - 15) V.throttle = -0.5 * toward;
    else V.throttle = 0;
  } else {
    V.throttle = -0.5;                  // advance toward the player's side
  }
}

function makeAI(mode, level) {
  return {
    mode,
    target: null,
    react: 0,
    hold: null,
    leg: -1,
    a: 0, b: 0,
    accuracy: clamp(0.45 + level * 0.03, 0.3, 0.7),
    reaction: Math.max(0.35, 1.4 - level * 0.08),
  };
}

// Messages about what the ground is doing (facts only).
function mobilityNotes(B, V, dt) {
  if (V.destroyed || !V.canDrive || V.throttle === 0) { V.stuckT = 0; return; }
  if (Math.abs(V.speed) < 0.15) V.stuckT += dt; else V.stuckT = 0;
  if (V.stuckT > 1.5 && B.time - V.bogNoteT > 6) {
    V.bogNoteT = B.time;
    const ter = B.T.terrainAt(V.body.x);
    const slope = Math.abs(Math.atan(B.T.slope(V.body.x)) * 180 / Math.PI);
    const text = ter.soft >= 0.5 ? 'Bogged down' : slope > 8 ? `Stalled on a ${Math.round(slope)}° slope` : V.fuel <= 0 && V.fuelMax > 0 ? 'Out of fuel' : 'Stopped';
    if (V.side === 0) floatText(text, V.body.x, V.body.y + V.height + 1, false);
  }
}

/* ---------- 12_battle.js ---------- */
/* ==== 12 BATTLE ==== */
// Battlefield setup, battle state, player commands, objectives and results.

function createBattle(level) {
  const cfg = battleConfig(level);
  const T = makeTerrain(cfg);
  const B = {
    cfg, T, level,
    rng: makeRng((cfg.seed ^ 0x9e3779b9) >>> 0),
    units: [], squad: [], me: null,
    order: 'Follow',
    target: null,
    time: 0,
    trauma: 0,
    hitStop: 0,
    spotT: 0,
    result: null,
    resultT: 0,
    heat: 0,                 // recent combat near the camera, for music intensity
    intensity: 0,
    goalTotal: 0,
    goalDone: 0,
    stats: { shots: 0, pens: 0, kills: 0, lost: 0, ricochetsTaken: 0, enemyShots: 0 },
    panOf: () => 0,
    onDestroyed: null,
  };
  cfg.squad.forEach((t, i) => {
    const V = makeVehicle(designFromTemplate(t), 0, 46 - i * 15, 1, T);
    V.ai = makeAI('squad', level);
    V.label = String(i + 1);
    B.units.push(V);
    B.squad.push(V);
  });
  B.me = B.squad[0];

  // Enemies: parked trucks sit within the first stretch so level 1 is quick; others start far right.
  let x = cfg.enemies[0][2] === 'parked' ? 125 : cfg.length - 45;
  for (const [t, count, mode] of cfg.enemies) {
    for (let k = 0; k < count; k++) {
      const V = makeVehicle(designFromTemplate(t), 1, x, -1, T);
      V.ai = makeAI(mode, level);
      if (mode === 'convoy') { V.ai.a = x - 70; V.ai.b = x + 10; }
      B.units.push(V);
      B.goalTotal++;
      x += mode === 'parked' ? 22 : -18;
    }
    if (cfg.enemies[0][2] !== 'parked') x -= 10;
  }

  B.onDestroyed = (V) => {
    if (V.side === 1) {
      B.goalDone++;
      B.stats.kills++;
      if (B.target === V) B.target = null;
      audio.sfx('objective', B.panOf(V.body.x));
      B.heat = Math.min(3, B.heat + 1);
    } else {
      B.stats.lost++;
      if (V === B.me) B.pendingSwap = 1.2;
    }
  };
  updateSpotting(B);
  return B;
}

function updateBattle(B, dt) {
  if (B.hitStop > 0) { B.hitStop -= dt; return; }
  B.time += dt;
  B.spotT -= dt;
  if (B.spotT <= 0) { B.spotT = SPOT_INTERVAL; updateSpotting(B); }

  for (const V of B.units) {
    if (V.destroyed) { V.throttle = 0; continue; }
    if (V.revealT > 0) V.revealT -= dt;
    if (V === B.me) {
      if (V.ai.react > 0) V.ai.react -= dt;
    } else if (V.side === 0) squadThink(B, V, dt);
    else enemyThink(B, V, dt);
    mobilityNotes(B, V, dt);
  }
  for (const V of B.units) stepVehicle(V, B.T, dt);
  separateVehicles(B.units);

  for (const V of B.units) {
    // Burning parts damage their neighbours.
    if (V.fires && V.fires.length) {
      for (let i = V.fires.length - 1; i >= 0; i--) {
        const f = V.fires[i];
        f.t -= dt;
        if (f.t <= 0) { V.fires.splice(i, 1); continue; }
        V.parts.forEach((p, k) => {
          if (!p.alive) return;
          const cx = (p.x + p.def.w / 2) * CELL, cy = (V.design.h - p.y - p.def.h / 2) * CELL;
          if (Math.hypot(cx - f.gx, cy - f.gy) < 1.3) damagePart(B, V, k, 7 * dt, null);
        });
        if (B.rng.next() < dt * 8) {
          const o = { x: 0, y: 0 };
          gridToLocal(V, f.gx, f.gy, o);
          localToWorld(V, o.x, o.y, o);
          const p = spawnParticle(FX_FIRE, o.x + B.rng.range(-0.3, 0.3), o.y, 0, 1.2, 0.45, 0.35);
          if (p) p.grow = 0.5;
        }
      }
    }
    // Tall vehicles push over trees.
    if (Math.abs(V.speed) > 0.8) {
      for (const tr of B.T.trees) {
        if (tr.alive && Math.abs(tr.x - V.body.x) < V.len / 2 && V.body.m > 3000) breakTree(B, tr, Math.sign(V.speed) || 1);
      }
    }
    if (!V.destroyed) runWeapons(B, V, dt, V !== B.me);
  }
  stepShells(B, dt);
  stepDebris(B.T, dt);
  stepEffects(B, dt);
  B.trauma = Math.max(0, B.trauma - dt * 0.9);

  // Take over the next squad vehicle when yours is lost.
  if (B.pendingSwap !== undefined) {
    B.pendingSwap -= dt;
    if (B.pendingSwap <= 0) {
      delete B.pendingSwap;
      const next = B.squad.find((V) => !V.destroyed);
      if (next) takeVehicle(B, next);
    }
  }

  // Music intensity: enemies nearby and recent kills (design/03 §6.3).
  B.heat = Math.max(0, B.heat - dt * 0.05);
  let near = 0;
  for (const V of B.units) if (V.side === 1 && !V.destroyed && V.seen && Math.abs(V.body.x - B.me.body.x) < 200) near++;
  const want = clamp(Math.floor(near * 0.8 + B.heat), 0, 3);
  if (want !== B.intensity) { B.intensity = want; audio.setIntensity(want); }

  // Objectives.
  if (!B.result) {
    if (B.goalDone >= B.goalTotal) { B.result = 'win'; B.resultT = 0; }
    else if (B.squad.every((V) => V.destroyed)) { B.result = 'lost'; B.resultT = 0; }
  } else {
    B.resultT += dt;
  }
}

// ---------- player commands
function takeVehicle(B, V) {
  if (V.destroyed || V === B.me) return false;
  B.me.throttle = 0;
  B.me = V;
  V.ai.hold = null;
  return true;
}

// Fire the main gun of the controlled vehicle at a world point (or the target).
// Returns a short reason when it can't.
function playerFire(B, tx, ty, manual) {
  const V = B.me;
  const w = mainWeapon(V);
  if (!w) return 'No gun';
  if (w.reload > 0) return 'Reloading';
  if (V.shells <= 0) return 'Out of shells';
  aimWeapon(V, w, tx, ty, _aim);
  if (!_aim.ok) return _aim.reason || 'Out of arc';
  if (w.face !== _aim.face) { trainWeapon(V, w, _aim.angle, _aim.face, 0); return 'Turret turning'; }
  w.angle = _aim.angle;
  if (!fireWeapon(B, V, w, _aim.angle, manual ? 0.6 : 1)) return 'Out of shells';
  w.reload = w.def.reload * (V.crew < 3 ? 1.6 : 1);
  B.stats.shots++;
  B.heat = Math.min(3, B.heat + 0.2);
  return '';
}

// Auto-aim target: the selected target, else the nearest spotted enemy in range, else straight ahead.
function autoTarget(B) {
  const V = B.me;
  if (B.target && !B.target.destroyed && B.target.seen) return B.target;
  const w = mainWeapon(V);
  return nearestTarget(B, V, w ? weaponRange(w.def) * 1.2 : 200);
}

// Keep the controlled vehicle's gun pointed at its target (or at the aim point while aiming).
function trainPlayerGun(B, dt, aimX, aimY) {
  const V = B.me;
  const w = mainWeapon(V);
  if (!w || V.destroyed) return;
  let tx = aimX, ty = aimY;
  if (tx === undefined) {
    const T = autoTarget(B);
    if (T) { tx = T.body.x; ty = T.body.y + T.height * 0.15; }
    else { tx = V.body.x + V.dir * 60; ty = B.T.height(V.body.x + V.dir * 60) + 1.5; }
  }
  aimWeapon(V, w, tx, ty, _aim);
  trainWeapon(V, w, _aim.angle, _aim.face, dt);
}

// Smoke launcher: a screen in front of the vehicle.
function playerSmoke(B) {
  const V = B.me;
  if (!V.smoke) return 'No smoke launcher';
  V.smoke--;
  const x = V.body.x + V.dir * 8;
  fxSmokeScreen(B, x, B.T.height(x) + 1);
  return '';
}

// Test-only helpers.


/* ---------- 12b_battle_render.js ---------- */
/* ==== 12b BATTLE RENDER ==== */
// Vehicles are drawn from their part grids as detailed industrial modules
// (design/03 §4, §1: HighFleet influence). Each vehicle is cached to an
// offscreen canvas and redrawn only when its damage changes.

const SPRITE_PAD = 2.2;          // metres of padding around a sprite (antennas, barrels)
const FACTION_STEEL = ['#586a80', '#735f56'];
const FACTION_MARK = ['#2E6DB4', '#C43C2C'];

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => clamp(Math.round(c * k), 0, 255);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function rivets(g, x, y, w, h, r, col) {
  g.fillStyle = col;
  const o = Math.max(1.5, r * 2);
  for (const [px, py] of [[x + o, y + o], [x + w - o, y + o], [x + o, y + h - o], [x + w - o, y + h - o]]) {
    g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
  }
}

function bevel(g, x, y, w, h, base, k) {
  g.fillStyle = base;
  g.fillRect(x, y, w, h);
  const b = Math.max(1, Math.min(w, h) * 0.12 * k);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(x, y, w, b);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(x, y + h - b, w, b);
  g.fillRect(x + w - b, y, b, h);
}

// Draw one part with its top-left at (x, y), cell size cs px.
function drawPart(g, p, x, y, cs, side, seed) {
  const d = p.def;
  const w = d.w * cs, h = d.h * cs;
  const steel = FACTION_STEEL[side];
  const r = Math.max(0.8, cs * 0.05);
  g.save();
  switch (d.id) {
    case 'frame':
      g.strokeStyle = shade(steel, 0.75); g.lineWidth = Math.max(1, cs * 0.12);
      g.strokeRect(x + 1, y + 1, w - 2, h - 2);
      g.beginPath(); g.moveTo(x + 1, y + 1); g.lineTo(x + w - 1, y + h - 1); g.moveTo(x + w - 1, y + 1); g.lineTo(x + 1, y + h - 1); g.stroke();
      break;
    case 'timber':
      g.fillStyle = '#6b4f33'; g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
      for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(x, y + (h * k) / 3); g.lineTo(x + w, y + (h * k) / 3); g.stroke(); }
      rivets(g, x, y, w, h, r * 0.8, '#2a2118');
      break;
    case 'plate':
      bevel(g, x, y, w, h, steel, 1);
      rivets(g, x, y, w, h, r, 'rgba(0,0,0,0.45)');
      break;
    case 'arm20': case 'arm40': case 'arm80': {
      const k = d.id === 'arm20' ? 0.92 : d.id === 'arm40' ? 0.8 : 0.68;
      bevel(g, x, y, w, h, shade(steel, k), 1.6);
      rivets(g, x, y, w, h, r * 1.2, 'rgba(0,0,0,0.5)');
      if (d.id === 'arm80') { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.strokeRect(x + cs * 0.18, y + cs * 0.18, w - cs * 0.36, h - cs * 0.36); }
      break;
    }
    case 'slope40':
      g.fillStyle = shade(steel, 0.8);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = Math.max(1, cs * 0.1);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + h); g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(x + w * 0.3, y + h * 0.7, r, 0, Math.PI * 2); g.fill();
      break;
    case 'crew2':
      bevel(g, x, y, w, h, shade(steel, 0.95), 1);
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = Math.max(1, cs * 0.08);
      g.beginPath(); g.arc(x + w * 0.35, y + h * 0.3, cs * 0.28, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#12151a'; g.fillRect(x + w * 0.55, y + h * 0.28, w * 0.35, cs * 0.12);
      g.fillStyle = 'rgba(255,178,62,0.5)'; g.fillRect(x + w * 0.58, y + h * 0.3, w * 0.1, cs * 0.06);
      // Faction chevron (fictional marking).
      g.fillStyle = FACTION_MARK[side];
      g.beginPath();
      g.moveTo(x + w * 0.3, y + h * 0.62); g.lineTo(x + w * 0.45, y + h * 0.78); g.lineTo(x + w * 0.6, y + h * 0.62);
      g.lineTo(x + w * 0.6, y + h * 0.7); g.lineTo(x + w * 0.45, y + h * 0.86); g.lineTo(x + w * 0.3, y + h * 0.7); g.closePath(); g.fill();
      rivets(g, x, y, w, h, r, 'rgba(0,0,0,0.45)');
      break;
    case 'turret':
      g.fillStyle = '#23262c'; g.fillRect(x, y + h * 0.2, w, h * 0.6);
      g.fillStyle = '#6f7582';
      for (let k = 0; k < d.w * 2; k++) { g.beginPath(); g.arc(x + (k + 0.5) * (w / (d.w * 2)), y + h * 0.5, r, 0, Math.PI * 2); g.fill(); }
      break;
    case 'eng_s': case 'eng_m': case 'eng_h': {
      bevel(g, x, y, w, h, shade(steel, 0.85), 1);
      g.fillStyle = '#15181d'; g.fillRect(x + cs * 0.2, y + cs * 0.3, w - cs * 0.4, h - cs * 0.7);
      g.strokeStyle = shade(steel, 0.7); g.lineWidth = Math.max(1, cs * 0.07);
      for (let sx = x + cs * 0.35; sx < x + w - cs * 0.25; sx += cs * 0.22) { g.beginPath(); g.moveTo(sx, y + cs * 0.32); g.lineTo(sx, y + h - cs * 0.42); g.stroke(); }
      // Exhaust stack with soot.
      g.fillStyle = '#2b2d31'; g.fillRect(x + cs * 0.15, y - cs * 0.35, cs * 0.22, cs * 0.45);
      g.fillStyle = 'rgba(20,20,20,0.5)'; g.beginPath(); g.arc(x + cs * 0.26, y - cs * 0.4, cs * 0.18, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'radiator':
      bevel(g, x, y, w, h, shade(steel, 0.8), 1);
      g.strokeStyle = '#15181d'; g.lineWidth = 1;
      for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(x + 2, y + (h * k) / 5); g.lineTo(x + w - 2, y + (h * k) / 5); g.stroke(); }
      break;
    case 'wheel_s': case 'wheel_l': {
      const cx = x + w / 2, cy = y + h / 2, rr = Math.min(w, h) / 2;
      g.fillStyle = '#1f2125'; g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#474b54'; g.beginPath(); g.arc(cx, cy, rr * 0.62, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8b919c'; g.beginPath(); g.arc(cx, cy, rr * 0.22, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2b2e34';
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * rr * 0.42, cy + Math.sin(a) * rr * 0.42, rr * 0.07, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'track': {
      g.fillStyle = '#26282c';
      roundRect(g, x, y + h * 0.05, w, h * 0.9, h * 0.45); g.fill();
      g.fillStyle = '#3b3f47';
      for (const f of [0.28, 0.72]) { g.beginPath(); g.arc(x + w * f, y + h / 2, h * 0.32, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#7c828d';
      for (const f of [0.28, 0.72]) { g.beginPath(); g.arc(x + w * f, y + h / 2, h * 0.1, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = '#15171a'; g.lineWidth = 1;
      for (let k = 0; k <= 6; k++) { const lx = x + (w * k) / 6; g.beginPath(); g.moveTo(lx, y + h * 0.05); g.lineTo(lx, y + h * 0.18); g.moveTo(lx, y + h * 0.82); g.lineTo(lx, y + h * 0.95); g.stroke(); }
      break;
    }
    case 'mg': case 'hmg':
      g.fillStyle = '#2c2f35'; g.fillRect(x + w * 0.15, y + h * 0.35, w * 0.7, h * 0.35);
      g.fillStyle = '#4a5a3a'; g.fillRect(x + w * 0.2, y + h * 0.7, w * 0.35, h * 0.25);
      break;
    case 'c37': case 'c75': case 'c105': case 'how': {
      // Mantlet and breech; the barrel is drawn live so it can elevate and recoil.
      const mw = Math.min(w, cs * (d.id === 'c37' ? 0.9 : 1.2));
      g.fillStyle = shade(steel, 0.75);
      roundRect(g, x, y + h * 0.1, mw, h * 0.8, Math.min(mw, h) * 0.3); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + mw * 0.55, y + h * 0.25, mw * 0.35, h * 0.5);
      break;
    }
    case 'smoke':
      g.fillStyle = '#2f3237';
      for (let k = 0; k < 3; k++) g.fillRect(x + w * (0.1 + k * 0.3), y + h * 0.2, w * 0.2, h * 0.7);
      break;
    case 'radio':
      bevel(g, x, y, w, h, '#3f4a3a', 1);
      g.fillStyle = '#b8c28a'; g.beginPath(); g.arc(x + w * 0.35, y + h * 0.45, cs * 0.1, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#1b1d21'; g.lineWidth = Math.max(1, cs * 0.05);
      g.beginPath(); g.moveTo(x + w * 0.75, y + h * 0.2); g.lineTo(x + w * 0.55, y - cs * 3.2); g.stroke();
      break;
    case 'optics':
      g.fillStyle = shade(steel, 0.7); g.fillRect(x + w * 0.2, y + h * 0.3, w * 0.6, h * 0.7);
      g.fillStyle = 'rgba(159,211,255,0.85)'; g.fillRect(x + w * 0.55, y + h * 0.38, w * 0.22, h * 0.18);
      break;
    case 'fc': case 'stab':
      bevel(g, x, y, w, h, '#3d4552', 1);
      g.strokeStyle = '#c9d1dc'; g.lineWidth = 1;
      g.beginPath(); g.arc(x + w / 2, y + h / 2, cs * 0.22, 0, Math.PI * 2); g.stroke();
      break;
    case 'fuel_s': case 'fuel_ss':
      g.fillStyle = d.id === 'fuel_s' ? '#56613a' : '#4c5530';
      roundRect(g, x + w * 0.08, y + h * 0.08, w * 0.84, h * 0.84, cs * 0.1); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x + w * 0.2, y + h * 0.3); g.lineTo(x + w * 0.8, y + h * 0.8); g.moveTo(x + w * 0.8, y + h * 0.3); g.lineTo(x + w * 0.2, y + h * 0.8); g.stroke();
      g.fillStyle = '#9aa06b'; g.fillRect(x + w * 0.6, y + h * 0.02, w * 0.2, h * 0.12);
      break;
    case 'ammo': case 'ammo_p':
      bevel(g, x, y, w, h, d.id === 'ammo' ? '#5d5033' : shade(steel, 0.7), 1);
      g.fillStyle = '#caa551';
      for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + w * (0.2 + k * 0.2), y + h * 0.35, cs * 0.07, 0, Math.PI * 2); g.fill(); }
      if (d.id === 'ammo_p') { g.fillStyle = PAL.amber; g.fillRect(x + w * 0.1, y + h * 0.7, w * 0.8, h * 0.1); }
      break;
    case 'cargo':
      g.fillStyle = '#7b7456';
      roundRect(g, x, y + h * 0.05, w, h * 0.95, cs * 0.35); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = Math.max(1, cs * 0.06);
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + (w * k) / 4, y + h * 0.1); g.lineTo(x + (w * k) / 4, y + h); g.stroke(); }
      break;
    default:
      bevel(g, x, y, w, h, steel, 1);
  }
  // Damage: scorch and holes.
  if (p.scorch > 0.05) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(12,10,8,${Math.min(0.65, p.scorch * 0.7)})`;
    g.fillRect(x, y, w, h);
    g.globalCompositeOperation = 'source-over';
    if (p.scorch > 0.3) {
      const rng = makeRng(seed);
      g.fillStyle = '#0b0c0e';
      const n = p.scorch > 0.7 ? 3 : 1;
      for (let k = 0; k < n; k++) { g.beginPath(); g.arc(x + rng.range(0.2, 0.8) * w, y + rng.range(0.2, 0.8) * h, cs * rng.range(0.06, 0.12), 0, Math.PI * 2); g.fill(); }
    }
  }
  g.strokeStyle = 'rgba(8,10,14,0.55)';
  g.lineWidth = 1;
  if (d.id !== 'wheel_s' && d.id !== 'wheel_l' && d.id !== 'slope40' && d.id !== 'frame' && d.cat !== 'weapon' && d.id !== 'optics') g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.restore();
}

// Draw the chosen parts of V into a new canvas (grid space, facing right). ppm = device px per metre.
function paintParts(V, idxs, ppm, pad) {
  const D = V.design;
  const cs = CELL * ppm;
  const c = document.createElement('canvas');
  c.width = Math.ceil((D.w * CELL + pad * 2) * ppm);
  c.height = Math.ceil((D.h * CELL + pad * 2) * ppm);
  const g = c.getContext('2d');
  const o = pad * ppm;
  // Structure first, then everything else, so fittings sit on top of plates.
  const order = idxs.slice().sort((a, b) => (V.parts[a].def.cat === 'structure' ? 0 : 1) - (V.parts[b].def.cat === 'structure' ? 0 : 1));
  for (const i of order) {
    const p = V.parts[i];
    drawPart(g, p, o + p.x * cs, o + p.y * cs, cs, V.side, V.id * 97 + i);
  }
  return c;
}

function vehicleSprite(V, S) {
  const ppm = clamp(Math.round(S * 1.3 * layout.dpr), 10, 64);
  if (!V.sprite || V.dirty || Math.abs(V.sprite.ppm - ppm) / V.sprite.ppm > 0.3) {
    const idxs = [];
    V.parts.forEach((p, i) => { if (p.alive) idxs.push(i); });
    V.sprite = { canvas: paintParts(V, idxs, ppm, SPRITE_PAD), ppm };
    V.dirty = false;
  }
  return V.sprite;
}

// Debris image for a group of parts: cropped to their bounds.
function renderPartsSprite(V, idxs) {
  const ppm = 24;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of idxs) {
    const p = V.parts[i];
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + p.def.w); y1 = Math.max(y1, p.y + p.def.h);
  }
  const cs = CELL * ppm;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil((x1 - x0) * cs));
  c.height = Math.max(1, Math.ceil((y1 - y0) * cs));
  const g = c.getContext('2d');
  for (const i of idxs) {
    const p = V.parts[i];
    drawPart(g, Object.assign({}, p, { scorch: Math.max(0.5, p.scorch) }), (p.x - x0) * cs, (p.y - y0) * cs, cs, V.side, i);
  }
  return { canvas: c, w: (x1 - x0) * CELL, h: (y1 - y0) * CELL };
}

// ---------- battle view
const view = {
  B: null, S: 10, cx: 0, cy: 0, horizon: 0, shake: { x: 0, y: 0 },
  sx(wx) { return (wx - this.cx) * this.S + layout.w / 2 + this.shake.x; },
  sy(wy) { return this.horizon - (wy - this.cy) * this.S + this.shake.y; },
  wx(sx) { return (sx - layout.w / 2 - this.shake.x) / this.S + this.cx; },
  wy(sy) { return (this.horizon + this.shake.y - sy) / this.S + this.cy; },
};

function drawVehicle(g, V) {
  const S = view.S;
  const spr = vehicleSprite(V, S);
  const b = V.body;
  const k = S / spr.ppm;
  g.save();
  g.translate(view.sx(b.x), view.sy(b.y));
  g.rotate(-b.a);
  g.scale(V.dir, 1);
  const ox = -(V.com.x + SPRITE_PAD) * S;
  const oy = -(V.design.h * CELL - V.com.y + SPRITE_PAD) * S;
  if (V.destroyed) g.filter = 'brightness(0.55) saturate(0.5)';
  g.drawImage(spr.canvas, ox, oy, spr.canvas.width * k, spr.canvas.height * k);
  g.filter = 'none';
  g.restore();
  // Barrels, drawn live.
  const tmp = { x: 0, y: 0 };
  for (const w of V.weapons) {
    if (!V.parts[w.part].alive) continue;
    const d = w.def;
    weaponPivot(V, w, tmp);
    const ang = w.angle !== undefined ? w.angle : angleFromElevation(V, 0, V.dir);
    const kick = (w.kick || 0) * 0.35;
    const L = barrelLength(d);
    const x0 = tmp.x - Math.cos(ang) * kick, y0 = tmp.y - Math.sin(ang) * kick;
    const x1 = x0 + Math.cos(ang) * L, y1 = y0 + Math.sin(ang) * L;
    g.strokeStyle = V.destroyed ? '#26282c' : '#30343b';
    g.lineCap = 'butt';
    g.lineWidth = Math.max(1.5, (d.auto ? 0.07 : 0.06 + d.cal / 900) * S);
    g.beginPath(); g.moveTo(view.sx(x0), view.sy(y0)); g.lineTo(view.sx(x1), view.sy(y1)); g.stroke();
    if (!d.auto && d.cal >= 75) {
      g.lineWidth = Math.max(2.5, (0.1 + d.cal / 700) * S);
      const bx = x1 - Math.cos(ang) * 0.3, by = y1 - Math.sin(ang) * 0.3;
      g.beginPath(); g.moveTo(view.sx(bx), view.sy(by)); g.lineTo(view.sx(x1), view.sy(y1)); g.stroke();
    }
  }
}

function drawTerrain(g, B) {
  const T = B.T;
  const { w, h } = layout;
  const S = view.S;
  const x0 = Math.max(0, view.wx(-20));
  const x1 = Math.min(T.length, view.wx(w + 20));
  const step = Math.max(CELL, 3 / S);
  // Ground fill: slightly lighter just under the surface, cached per screen size.
  if (!view.grad || view.gradH !== h || view.gradTop !== Math.round(view.horizon)) {
    view.grad = g.createLinearGradient(0, view.horizon - 60, 0, h);
    view.grad.addColorStop(0, '#2B2F3A');
    view.grad.addColorStop(0.5, PAL.ground);
    view.grad.addColorStop(1, '#121318');
    view.gradH = h;
    view.gradTop = Math.round(view.horizon);
  }
  g.fillStyle = view.grad;
  g.beginPath();
  g.moveTo(view.sx(x0), h + 20);
  for (let x = x0; x <= x1 + step; x += step) g.lineTo(view.sx(x), view.sy(T.height(x)));
  g.lineTo(view.sx(Math.min(x1 + step, T.length)), h + 20);
  g.closePath();
  g.fill();
  // Top soil, coloured by material, in runs.
  g.lineWidth = Math.max(2, 0.5 * S);
  g.lineJoin = 'round';
  let x = x0;
  while (x <= x1) {
    const m = T.matAt(x);
    g.strokeStyle = TERRAIN[m].color;
    g.beginPath();
    g.moveTo(view.sx(x), view.sy(T.height(x)) + g.lineWidth / 2);
    while (x <= x1 && T.matAt(x) === m) { x += step; g.lineTo(view.sx(x), view.sy(T.height(x)) + g.lineWidth / 2); }
    g.stroke();
  }
  g.strokeStyle = PAL.groundEdge;
  g.lineWidth = 1.5;
  g.beginPath();
  for (let xx = x0; xx <= x1 + step; xx += step) {
    const sx = view.sx(xx), sy = view.sy(T.height(xx));
    if (xx === x0) g.moveTo(sx, sy); else g.lineTo(sx, sy);
  }
  g.stroke();
  // Battlefield edges.
  g.fillStyle = 'rgba(10,12,16,0.5)';
  if (view.sx(0) > 0) g.fillRect(0, 0, view.sx(0), h);
  if (view.sx(T.length) < w) g.fillRect(view.sx(T.length), 0, w - view.sx(T.length), h);
}

function drawTrees(g, B) {
  const S = view.S;
  for (const tr of B.T.trees) {
    const sx = view.sx(tr.x);
    if (sx < -tr.h * S || sx > layout.w + tr.h * S) continue;
    const sy = view.sy(B.T.height(tr.x));
    g.save();
    g.translate(sx, sy);
    if (!tr.alive) g.rotate(tr.fallDir * 1.35);
    g.fillStyle = '#1b1f1c';
    g.fillRect(-0.18 * S, -tr.h * 0.45 * S, 0.36 * S, tr.h * 0.45 * S);
    g.fillStyle = '#18231d';
    for (let k = 0; k < 3; k++) {
      const by = -tr.h * (0.3 + k * 0.22) * S;
      const rw = tr.r * (1 - k * 0.22) * S;
      g.beginPath(); g.moveTo(-rw, by); g.lineTo(0, by - tr.h * 0.35 * S); g.lineTo(rw, by); g.closePath(); g.fill();
    }
    g.restore();
  }
}

function drawShells(g) {
  g.lineCap = 'round';
  shells.forEachAlive((s) => {
    const ax = view.sx(s.x - s.vx * 0.025), ay = view.sy(s.y - s.vy * 0.025);
    const bx = view.sx(s.x), by = view.sy(s.y);
    if (!s.mg) {
      g.strokeStyle = 'rgba(255,178,62,0.35)'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    }
    g.strokeStyle = s.mg ? 'rgba(255,214,140,0.9)' : '#FFE2A8';
    g.lineWidth = s.mg ? 1.2 : 2;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  });
}

function drawParticles(g) {
  const S = view.S;
  particles.forEachAlive((p) => {
    const k = p.t / p.life;
    const x = view.sx(p.x), y = view.sy(p.y);
    switch (p.kind) {
      case FX_FLASH:
        g.globalAlpha = 1 - k;
        g.fillStyle = '#FFE9B8';
        g.beginPath(); g.arc(x, y, p.size * S * 0.6, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,178,62,0.6)';
        g.beginPath(); g.arc(x, y, p.size * S, 0, Math.PI * 2); g.fill();
        break;
      case FX_SMOKE: {
        const c = Math.round(60 + p.shade * 110);
        g.globalAlpha = 0.55 * (1 - k);
        g.fillStyle = `rgb(${c},${c},${c + 6})`;
        g.beginPath(); g.arc(x, y, p.size * S * 0.5, 0, Math.PI * 2); g.fill();
        break;
      }
      case FX_FIRE:
        g.globalAlpha = 1 - k;
        g.fillStyle = k < 0.4 ? '#FFD27A' : '#E0602D';
        g.beginPath(); g.arc(x, y, p.size * S * 0.4 * (1 - k * 0.5), 0, Math.PI * 2); g.fill();
        break;
      case FX_SPARK:
        g.globalAlpha = 1 - k;
        g.strokeStyle = '#FFD27A'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - p.vx * 0.02 * S, y + p.vy * 0.02 * S); g.stroke();
        break;
      case FX_DIRT:
        g.globalAlpha = 1;
        g.fillStyle = '#3a3026';
        g.fillRect(x - p.size * S / 2, y - p.size * S / 2, p.size * S, p.size * S);
        break;
      case FX_RING:
        g.globalAlpha = 0.6 * (1 - k);
        g.strokeStyle = '#FFE9B8'; g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, p.size * S, 0, Math.PI * 2); g.stroke();
        break;
    }
  });
  g.globalAlpha = 1;
}

function drawDebris(g) {
  const S = view.S;
  debris.forEachAlive((d) => {
    g.save();
    g.globalAlpha = d.t > 5 ? 6 - d.t : 1;
    g.translate(view.sx(d.x), view.sy(d.y));
    g.rotate(-d.a);
    g.scale(d.dir || 1, 1);
    g.drawImage(d.img, (-d.iw / 2) * S, (-d.ih / 2) * S, d.iw * S, d.ih * S);
    g.restore();
  });
}

// Whole battlefield, back to front (design/04 §3).
function renderBattle(g, B) {
  drawBackground(g, view.cx * view.S * 0.25);
  drawTrees(g, B);
  drawTerrain(g, B);
  for (const V of B.units) {
    const visible = V.side === 0 || V.seen || (V.destroyed && V.everSeen);
    if (!visible) continue;
    const sx = view.sx(V.body.x);
    if (sx < -V.radius * 2 * view.S || sx > layout.w + V.radius * 2 * view.S) continue;
    drawVehicle(g, V);
  }
  drawDebris(g);
  drawShells(g);
  drawParticles(g);
}

/* ---------- 16a_screens.js ---------- */
/* ==== 16 SCREENS ==== */
// Screen manager, the title screen, and pause/settings/fullscreen helpers.
// A screen may define: enter(arg), exit(), layout(), update(dt, simRunning),
// render(g, nowMs), controls[], world{tap, doubleTap, longPress, pan, panEnd, pinch},
// key(code, down), pausable, pauseOpts().

const screens = {
  cur: null,
  name: '',
  go(name, arg) {
    input.releaseAll();
    while (ui.stack.length) ui.closeTop();
    if (this.cur && this.cur.exit) this.cur.exit();
    this.cur = SCREENS[name];
    this.name = name;
    if (this.cur.enter) this.cur.enter(arg);
    if (this.cur.layout) this.cur.layout();
  },
};

const SCREENS = {};

// ---------- Title (design/02 §6)
SCREENS.title = {
  root: null,
  t: 0,
  enter() {
    this.root = el('div', 'title-screen');
    this.build();
    uiLayer.insertBefore(this.root, ui.toastBox);
    audio.playTheme('title');
  },
  exit() {
    if (this.root) this.root.remove();
    this.root = null;
  },
  build() {
    const r = this.root;
    const p = save.profile;
    r.textContent = '';
    const fs = el('button', 'fs-btn');
    fs.type = 'button';
    fs.setAttribute('aria-label', 'Full screen');
    fs.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    fs.addEventListener('click', () => { audio.sfx('tap'); toggleFullscreen(); });
    r.appendChild(fs);

    r.appendChild(el('h1', 'logo', 'IRON DOCTRINE'));
    r.appendChild(el('p', 'tagline', "No manual tells you how to win this war. You'll write your own."));

    const menu = el('div', 'menu');
    const pg = el('div', 'menu-group');
    pg.appendChild(el('div', 'menu-label', 'Proving Ground'));
    const pgRow = el('div', 'menu-row');
    if (p.continueLevel > 1) {
      pgRow.appendChild(button(`Continue at level ${p.continueLevel}`, () => screens.go('battle', p.continueLevel), 'btn btn-primary'));
    }
    pgRow.appendChild(button('Play from level 1', () => screens.go('battle', 1), p.continueLevel > 1 ? 'btn' : 'btn btn-primary'));
    pg.appendChild(pgRow);
    menu.appendChild(pg);

    const row2 = el('div', 'menu-row');
    row2.appendChild(button('Workshop', () => ui.toast('The Workshop opens in the next update (Part 1c).')));
    row2.appendChild(button('Blueprints', () => ui.toast('No captured blueprints yet. Bosses start at level 10.')));
    row2.appendChild(button('Settings', () => ui.openSettings()));
    menu.appendChild(row2);
    r.appendChild(menu);

    r.appendChild(el('p', 'title-stats', `Best score ${p.bestScore} · Highest level ${p.highestLevel}`));
    r.appendChild(el('p', 'title-version', `v${GAME_VERSION}`));
  },
  update(dt) { this.t += dt; },
  render(g) {
    const { w, h } = layout;
    drawBackground(g, save.settings.reducedMotion ? 0 : this.t * 12);
    g.fillStyle = PAL.ground;
    g.fillRect(0, h * 0.9, w, h * 0.1);
    g.fillStyle = PAL.groundEdge;
    g.fillRect(0, h * 0.9, w, 2);
  },
};

// ---------- pause, settings, fullscreen helpers used by screens and main
function togglePause() {
  if (game.paused) { ui.closeTop(); return; }
  pauseGame();
}

function pauseGame() {
  const scr = screens.cur;
  if (!scr || !scr.pausable || game.paused) return;
  game.paused = true;
  audio.setPaused(true);
  save.flush();
  ui.openPause(Object.assign(scr.pauseOpts(), {
    onClose: () => { game.paused = false; audio.setPaused(false); },
  }));
}

// P / Esc: close the top card if one is open, otherwise pause.
function onPauseKey() {
  if (ui.modalOpen()) { audio.sfx('back'); ui.closeTop(); return; }
  if (screens.cur && screens.cur.pausable) { audio.sfx('tap'); pauseGame(); }
}

// Settings from inside a battle pauses the game while open.
function openSettingsPaused() {
  const scr = screens.cur;
  if (scr && scr.pausable && !game.paused) {
    game.paused = true;
    audio.setPaused(true);
    ui.openSettings(() => { game.paused = false; audio.setPaused(false); });
  } else {
    ui.openSettings();
  }
}

function toggleFullscreen() {
  const d = document;
  try {
    if (d.fullscreenElement) { d.exitFullscreen().catch(() => {}); return; }
    enterFullscreen();
  } catch (_e) { /* ignore */ }
}

function enterFullscreen() {
  const root = document.documentElement;
  if (!root.requestFullscreen || document.fullscreenElement) return;
  root.requestFullscreen({ navigationUI: 'hide' })
    .then(() => {
      if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape');
      return null;
    })
    .catch(() => {});
}

/* ---------- 16b_screen_battle.js ---------- */
/* ==== 16b SCREEN: BATTLE ==== */
// The battle screen (design/02 §3): world full screen, top bar, drive pad,
// action cluster, order chips, world gestures and keyboard.

const ORDERS = ['Follow', 'Escort', 'Hold', 'Attack', 'Back'];
const BASE_PX_PER_M = 12;       // at 360 px screen height and zoom 1
const DEFAULT_ZOOM = 0.75;
const MIN_AUTO_ZOOM = 0.55;     // how far the follow camera may pull back to frame a target

SCREENS.battle = {
  pausable: true,
  B: null,
  level: 1,
  cam: { x: 0, y: 0, zoom: DEFAULT_ZOOM, follow: true },
  frozen: false,
  aim: null,
  drive: 0,
  controls: [],
  c: {},
  resultShown: false,

  enter(level) {
    this.level = level || 1;
    for (const pool of [shells, particles, debris, smokeScreens, smokeColumns, floaters]) pool.forEachAlive((p) => { p.alive = false; });
    const B = createBattle(this.level);
    this.B = B;
    view.B = B;
    B.panOf = (wx) => clamp((view.sx(wx) / layout.w) * 2 - 1, -1, 1) * 0.8;
    this.cam.x = B.me.body.x + 25;
    this.cam.y = B.me.body.y + 3;
    this.cam.zoom = DEFAULT_ZOOM;
    this.cam.follow = true;
    this.cam.manual = false;
    this.frozen = false;
    game.frozen = false;
    this.aim = null;
    this.drive = 0;
    this.resultShown = false;
    this.buildControls();
    this.layout();
    audio.setIntensity(0);
    audio.playTheme('battle');
    ui.toast(`Level ${this.level} · ${B.cfg.name}: ${B.cfg.goal.toLowerCase()}.`, 3200);
  },

  exit() { game.frozen = false; this.B = null; },

  pauseOpts() {
    return {
      restart: () => this.enter(this.level),
      quit: () => screens.go('title'),
    };
  },

  // ---------- controls
  buildControls() {
    const C = this.c;
    const drive = () => this.updateDrive();
    C.left = makeControl('left', { glyph: 'left', down: drive, up: drive });
    C.right = makeControl('right', { glyph: 'right', down: drive, up: drive });
    C.fire = makeControl('fire', {
      label: 'Fire',
      down: (p) => { p.fireAim = false; },
      move: (p) => this.fireDrag(p),
      up: (p, cancelled) => this.fireUp(p, cancelled),
    });
    C.alt = makeControl('alt', { label: 'Alt', hidden: true });
    C.swap = makeControl('swap', { label: 'Swap', up: (p, x) => { if (!x) this.swap(); } });
    C.special = makeControl('special', { label: 'Smoke', up: (p, x) => { if (!x) this.smoke(); } });
    C.chips = ORDERS.map((o, i) => makeControl('order' + i, { shape: 'rect', label: o, pad: 2, up: (p, x) => { if (!x) this.setOrder(o); } }));
    C.time = makeControl('time', { shape: 'rect', glyph: 'stop', pad: 4, up: (p, x) => { if (!x) this.toggleTime(); } });
    C.pause = makeControl('pause', { shape: 'rect', glyph: 'pause', pad: 4, up: (p, x) => { if (!x) togglePause(); } });
    C.settings = makeControl('settings', { shape: 'rect', glyph: 'gear', pad: 4, up: (p, x) => { if (!x) openSettingsPaused(); } });
    C.recenter = makeControl('recenter', { shape: 'rect', label: 'Recenter', hidden: true, up: (p, x) => { if (!x) this.recenter(); } });
    C.cards = [0, 1, 2].map((i) => makeControl('card' + i, { shape: 'rect', pad: 2, up: (p, x) => { if (!x) this.takeControl(i); } }));
    this.controls = [C.left, C.right, C.special, C.alt, C.swap, C.fire, ...C.chips, C.recenter, ...C.cards, C.time, C.pause, C.settings];
  },

  layout() {
    const C = this.c;
    if (!C.fire) return;
    const { w, h, safe } = layout;
    const s = BTN_SCALE[save.settings.btnSize] || 1;
    const L = save.settings.leftHanded;
    const mx = (x) => (L ? w - x : x);
    const top = safe.t;
    const barH = 34;
    let bx = w - safe.r - 6;
    for (const b of [C.settings, C.pause, C.time]) { bx -= 44; b.x = bx; b.y = top + 3; b.w = 42; b.h = 28; bx -= 4; }
    for (let i = 0; i < 3; i++) { const cd = C.cards[i]; cd.x = safe.l + 6 + i * 50; cd.y = top + 3; cd.w = 46; cd.h = 28; }
    this.mini = { x: C.time.x - 10 - clamp(w * 0.18, 90, 200), y: top + 5, w: clamp(w * 0.18, 90, 200), h: 24 };

    const R = (FIRE_DIAMETER / 2) * s;
    const r2 = 24 * s;
    const edgeR = safe.r + 10;
    const chipW = 72;
    const fireX = w - edgeR - chipW - 6 - R;
    const fireY = h - safe.b - 12 - R;
    C.fire.x = mx(fireX); C.fire.y = fireY; C.fire.r = R;
    C.alt.x = mx(fireX - R * 1.25); C.alt.y = fireY - R * 1.35; C.alt.r = r2;
    C.special.x = mx(fireX - R * 1.95); C.special.y = fireY + R * 0.25; C.special.r = r2;
    C.swap.x = mx(w - edgeR - chipW / 2); C.swap.y = fireY - R * 0.35; C.swap.r = Math.max(r2, 26 * s);
    const chipTop = top + barH + 8;
    const chipBottom = C.swap.y - C.swap.r - 8;
    const chipH = clamp(Math.floor((chipBottom - chipTop - 16) / 5), 24, 36);
    for (let i = 0; i < 5; i++) {
      const cp = C.chips[i];
      cp.w = chipW; cp.h = chipH;
      cp.x = L ? safe.l + 10 : w - edgeR - chipW;
      cp.y = chipTop + i * (chipH + 4);
    }
    const Rp = 34 * s;
    const padY = h - safe.b - 14 - Rp;
    const lx = safe.l + 18 + Rp;
    C.left.x = mx(lx); C.left.y = padY; C.left.r = Rp;
    C.right.x = mx(lx + Rp * 2 + 18); C.right.y = padY; C.right.r = Rp;
    if (L) { const t = C.left.x; C.left.x = C.right.x; C.right.x = t; }
    C.recenter.w = 92; C.recenter.h = 30;
    C.recenter.x = w / 2 - 46; C.recenter.y = top + barH + 8;
  },

  // ---------- commands
  updateDrive() {
    const k = input.keys;
    const l = this.c.left.pressCount > 0 || k.has('KeyA') || k.has('ArrowLeft');
    const r = this.c.right.pressCount > 0 || k.has('KeyD') || k.has('ArrowRight');
    this.c.left.held = k.has('KeyA') || k.has('ArrowLeft');
    this.c.right.held = k.has('KeyD') || k.has('ArrowRight');
    const before = this.drive;
    this.drive = l && r ? 0 : l ? -1 : r ? 1 : 0;      // both together = halt/brake
    if (this.B && this.drive !== before && this.drive !== 0) audio.sfx('engineRev', this.B.panOf(this.B.me.body.x));
  },

  takeControl(i) {
    const B = this.B;
    const V = B.squad[i];
    if (!V || V === B.me) return;
    if (V.destroyed) { audio.sfx('error'); return; }
    takeVehicle(B, V);
    this.cam.follow = true;
    audio.sfx('swap');
    haptic('tap');
    floatText(V.name, V.body.x, V.body.y + V.height + 1);
  },

  swap() {
    const B = this.B;
    const i = B.squad.indexOf(B.me);
    for (let k = 1; k <= 3; k++) {
      const V = B.squad[(i + k) % B.squad.length];
      if (!V.destroyed && V !== B.me) { this.takeControl(B.squad.indexOf(V)); return; }
    }
    audio.sfx('error');
  },

  setOrder(o) {
    const B = this.B;
    B.order = o;
    for (const V of B.squad) V.ai.hold = null;
    audio.sfx('order');
    haptic('tap');
    floatText(o, B.me.body.x, B.me.body.y + B.me.height + 1);
  },

  recenter() { this.cam.follow = true; audio.sfx('tap'); },

  toggleTime() {
    this.frozen = !this.frozen;
    game.frozen = this.frozen;
    this.c.time.glyph = this.frozen ? 'play' : 'stop';
    this.c.time.glyphLines = null;
    audio.sfx(this.frozen ? 'timeStop' : 'timeStart');
    haptic('tap');
  },

  say(reason) {
    if (!reason) return;
    audio.sfx('error');
    const V = this.B.me;
    floatText(reason, V.body.x, V.body.y + V.height + 1.5);
  },

  fireDrag(p) {
    const C = this.c.fire;
    if (this.frozen) return;
    const off = dist(p.x, p.y, C.x, C.y);
    if (!p.fireAim && off > C.r * 0.6) p.fireAim = true;
    if (!p.fireAim) return;
    if (off < C.r * 0.8) { this.aim = null; return; }    // back on the button cancels
    const wx = view.wx(p.x);
    this.aim = this.aim || { x: 0, y: 0 };
    this.aim.x = wx;
    this.aim.y = Math.max(view.wy(p.y), this.B.T.height(wx));
  },

  fireUp(p, cancelled) {
    const aim = this.aim;
    this.aim = null;
    if (cancelled || this.frozen || this.B.me.destroyed) return;
    if (p.fireAim) {
      if (aim) this.say(playerFire(this.B, aim.x, aim.y, true));
      else audio.sfx('back');
      return;
    }
    this.fireAuto();
  },

  fireAuto() {
    const B = this.B;
    if (this.frozen || B.me.destroyed) return;
    const T = autoTarget(B);
    if (T) { this.say(playerFire(B, T.body.x, T.body.y + T.height * 0.15, false)); return; }
    const x = B.me.body.x + B.me.dir * 60;
    this.say(playerFire(B, x, B.T.height(x) + 1.5, false));
  },

  smoke() {
    if (this.frozen || this.B.me.destroyed) return;
    const r = playerSmoke(this.B);
    if (r) this.say(r); else { audio.sfx('smoke', this.B.panOf(this.B.me.body.x)); haptic('tap'); }
  },

  // ---------- camera
  // While following, the camera may pull back to frame the target, unless you pinched a zoom yourself.
  scale() { return BASE_PX_PER_M * (layout.h / 360) * (this.cam.follow && !this.cam.manual ? Math.min(this.cam.zoom, this.cam.fit || 9) : this.cam.zoom); },

  world: {
    tap(x, y) {
      const S = SCREENS.battle;
      const B = S.B;
      const wx = view.wx(x), wy = view.wy(y);
      const hit = (V) => Math.abs(wx - V.body.x) < V.len / 2 + 1.5 && wy > V.body.y - 2.5 && wy < V.body.y + V.height + 1.5;
      for (let i = 0; i < B.squad.length; i++) if (!B.squad[i].destroyed && hit(B.squad[i])) { S.takeControl(i); return; }
      for (const V of B.units) {
        if (V.side !== 1 || V.destroyed || !V.seen || !hit(V)) continue;
        B.target = B.target === V ? null : V;
        audio.sfx(B.target ? 'toggleOn' : 'toggleOff');
        haptic('tap');
        if (B.target) floatText('Target', V.body.x, V.body.y + V.height + 1.5, true);
        return;
      }
    },
    doubleTap() { const c = SCREENS.battle.cam; c.zoom = DEFAULT_ZOOM; c.manual = false; audio.sfx('tap'); },
    longPress(x) {
      const S = SCREENS.battle;
      const B = S.B;
      const wx = clamp(view.wx(x), 5, B.T.length - 5);
      let k = 0;
      for (const V of B.squad) if (V !== B.me && !V.destroyed) { V.ai.hold = wx + (k++ ? -7 : 0); }
      audio.sfx('order');
      haptic('tap');
      floatText('Move here', wx, B.T.height(wx) + 3);
    },
    pan(dx, dy) {
      const S = SCREENS.battle;
      S.cam.follow = false;
      S.cam.x -= dx / S.scale();
      S.cam.y += dy / S.scale();
    },
    pinch(f, cx, cy) {
      const S = SCREENS.battle;
      const bx = view.wx(cx);
      const seen = S.scale() / (BASE_PX_PER_M * (layout.h / 360));
      S.cam.follow = false;
      S.cam.manual = true;
      S.cam.zoom = clamp(seen * f, ZOOM_MIN * 0.7, ZOOM_MAX);
      view.S = S.scale();
      S.cam.x += bx - view.wx(cx);
    },
  },

  key(code, down) {
    if (/^(KeyA|KeyD|ArrowLeft|ArrowRight)$/.test(code)) { this.updateDrive(); return; }
    const hold = (c) => { c.held = down; if (!down) c.releasedAt = performance.now(); };
    if (code === 'Space') { hold(this.c.fire); if (down) this.fireAuto(); return; }
    if (code === 'KeyE' || code === 'Tab') { hold(this.c.swap); if (down) this.swap(); return; }
    if (code === 'KeyQ') { hold(this.c.special); if (down) this.smoke(); return; }
    const n = /^Digit([1-5])$/.exec(code);
    if (n) { const c = this.c.chips[+n[1] - 1]; hold(c); if (down) this.setOrder(ORDERS[+n[1] - 1]); return; }
    if (!down) return;
    if (code === 'KeyT') this.toggleTime();
    else if (code === 'KeyC') this.recenter();
  },

  // ---------- update
  update(dt, simRunning) {
    const B = this.B;
    if (!B) return;
    B.me.throttle = B.me.destroyed ? 0 : this.drive;
    if (simRunning && !this.frozen) {
      // Level clear: time slows to 30% for 0.6 s (design/03 §5).
      const slow = B.result === 'win' && B.resultT < 0.6 ? 0.3 : 1;
      updateBattle(B, dt * slow);
      if (this.aim) trainPlayerGun(B, dt, this.aim.x, this.aim.y); else trainPlayerGun(B, dt);
      updateFloaters(dt);
    }
    this.updateCamera(dt);
    const C = this.c;
    for (let i = 0; i < 5; i++) C.chips[i].lit = ORDERS[i] === B.order;
    for (let i = 0; i < 3; i++) { C.cards[i].lit = B.squad[i] === B.me; C.cards[i].disabled = !B.squad[i] || B.squad[i].destroyed; }
    C.recenter.hidden = this.cam.follow;
    C.fire.disabled = this.frozen || B.me.destroyed;
    C.special.disabled = this.frozen || !B.me.smoke;
    C.special.hidden = B.me.smoke === 0 && !B.squad.some((V) => V.smoke);
    if (B.result && B.resultT > 1.4 && !this.resultShown) this.showResult();
  },

  updateCamera(dt) {
    const cam = this.cam;
    const B = this.B;
    const idle = (performance.now() - input.lastWorldTouch) / 1000;
    if (!cam.follow && save.settings.autoRecenter && idle > RECENTER_AFTER && input.world.length === 0) cam.follow = true;
    // While following, pull back so your target (or the nearest spotted enemy) stays in view.
    const me = B.me.body;
    const T = autoTarget(B);
    const base = BASE_PX_PER_M * (layout.h / 360);
    let fit = 9;
    let midX = me.x;
    if (T && !B.me.destroyed) {
      const span = Math.abs(T.body.x - me.x) + 26;
      fit = Math.max(MIN_AUTO_ZOOM, (layout.w * 0.8) / span / base);
      midX = (me.x + T.body.x) / 2;
    }
    cam.fit = cam.fit === undefined ? fit : cam.fit + (fit - cam.fit) * (1 - Math.pow(0.2, dt));
    view.S = this.scale();
    const viewW = layout.w / view.S;
    if (cam.follow) {
      const k = 1 - Math.pow(0.03, dt);
      const wantX = T && !cam.manual && fit < cam.zoom ? midX : me.x + B.me.dir * viewW * 0.18;
      cam.x += (wantX - cam.x) * k;
      cam.y += (me.y + 2 - cam.y) * k;
    }
    cam.x = clamp(cam.x, viewW * 0.3, B.T.length - viewW * 0.3);
    view.cx = cam.x;
    view.cy = cam.y;
    view.horizon = layout.h * 0.62;
    shakeOffset(B, view.shake);
  },

  showResult() {
    this.resultShown = true;
    const B = this.B;
    const win = B.result === 'win';
    const p = save.profile;
    if (win) {
      haptic('clear');
      audio.sfx('objective');
      p.highestLevel = Math.max(p.highestLevel, this.level + 1);
      p.continueLevel = this.level + 1;
      save.touch('profile');
    }
    const c = ui.card('', 'card-result');
    c.appendChild(el('div', 'stamp' + (win ? '' : ' stamp-red'), win ? 'OBJECTIVE COMPLETE' : 'SQUAD LOST'));
    const facts = el('div', 'result-facts');
    const secs = Math.round(B.time);
    const row = (k, v) => { const r = el('div', 'fact'); r.appendChild(el('span', '', k)); r.appendChild(el('b', '', String(v))); facts.appendChild(r); };
    row('Time', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
    row('Enemies destroyed', `${B.goalDone} of ${B.goalTotal}`);
    row('Shots fired', B.stats.shots);
    row('Penetrations', B.stats.pens);
    row('Squad vehicles lost', B.stats.lost);
    c.appendChild(facts);
    const btns = el('div', 'card-row');
    let close = null;
    btns.appendChild(button('Title', () => { close(); screens.go('title'); }, 'btn', 'back'));
    if (win) btns.appendChild(button('Next battle', () => { close(); this.enter(this.level + 1); }, 'btn btn-primary'));
    else btns.appendChild(button('Retry', () => { close(); this.enter(this.level); }, 'btn btn-primary'));
    c.appendChild(btns);
    close = ui.open(c);
  },

  // ---------- drawing
  render(g, nowMs) {
    const B = this.B;
    if (!B) return;
    renderBattle(g, B);
    const S = view.S;
    // Selected target bracket.
    if (B.target && !B.target.destroyed && B.target.seen) {
      const T = B.target;
      const x = view.sx(T.body.x), y = view.sy(T.body.y + T.height * 0.4);
      const r = Math.max(14, (T.len / 2 + 0.8) * S);
      g.strokeStyle = PAL.amber; g.lineWidth = 2;
      g.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        g.moveTo(x + sx * r, y + sy * r * 0.7 - sy * 6); g.lineTo(x + sx * r, y + sy * r * 0.7); g.lineTo(x + sx * r - sx * 6, y + sy * r * 0.7);
      }
      g.stroke();
    }
    // Your vehicle: small amber marker.
    if (!B.me.destroyed) {
      const x = view.sx(B.me.body.x), y = view.sy(B.me.body.y + B.me.height) - 8;
      g.fillStyle = PAL.amber;
      g.beginPath(); g.moveTo(x - 5, y - 6); g.lineTo(x + 5, y - 6); g.lineTo(x, y); g.closePath(); g.fill();
    }
    // Spotted enemies beyond the screen edge.
    for (const V of B.units) {
      if (V.side !== 1 || V.destroyed || !V.seen) continue;
      const x = view.sx(V.body.x);
      if (x > 0 && x < layout.w) continue;
      const ex = x <= 0 ? layout.safe.l + 8 : layout.w - layout.safe.r - 8;
      const ey = clamp(view.sy(V.body.y + 1), layout.safe.t + 60, layout.h * 0.55);
      g.fillStyle = PAL.directorate;
      g.beginPath();
      if (x <= 0) { g.moveTo(ex, ey); g.lineTo(ex + 9, ey - 6); g.lineTo(ex + 9, ey + 6); }
      else { g.moveTo(ex, ey); g.lineTo(ex - 9, ey - 6); g.lineTo(ex - 9, ey + 6); }
      g.closePath(); g.fill();
    }
    // Manual-aim trajectory preview.
    if (this.aim && save.settings.aimAssist && !B.me.destroyed) this.drawAimPreview(g);
    drawFloaters(g, (x) => view.sx(x), (y) => view.sy(y));
    if (this.frozen) {
      const { w, h, safe } = layout;
      g.fillStyle = 'rgba(19,70,107,0.18)';
      g.fillRect(0, 0, w, h);
      g.font = `700 16px ${FONT_UI}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      drawAcetate(g, w / 2 - 75, safe.t + 42, 150, 26);
      g.fillStyle = PAL.linen;
      g.fillText('Time stopped', w / 2, safe.t + 55);
    }
    this.drawHud(g, nowMs);
  },

  drawAimPreview(g) {
    const B = this.B;
    const V = B.me;
    const w = mainWeapon(V);
    if (!w) return;
    aimWeapon(V, w, this.aim.x, this.aim.y, _aim);
    const tmp = { x: 0, y: 0 };
    weaponPivot(V, w, tmp);
    const L = barrelLength(w.def);
    let x = tmp.x + Math.cos(_aim.angle) * L, y = tmp.y + Math.sin(_aim.angle) * L;
    let vx = Math.cos(_aim.angle) * w.def.vel, vy = Math.sin(_aim.angle) * w.def.vel;
    g.fillStyle = _aim.ok ? 'rgba(255,178,62,0.9)' : 'rgba(224,83,61,0.9)';
    const dt = 0.03;
    for (let i = 0; i < 160; i++) {
      vy -= GRAVITY * dt; x += vx * dt; y += vy * dt;
      if (y < B.T.height(x)) break;
      if (i % 3 === 0) { g.beginPath(); g.arc(view.sx(x), view.sy(y), 2, 0, Math.PI * 2); g.fill(); }
    }
    g.strokeStyle = PAL.amber; g.lineWidth = 1.5;
    g.beginPath(); g.arc(view.sx(this.aim.x), view.sy(this.aim.y), 7, 0, Math.PI * 2); g.stroke();
  },

  drawHud(g, nowMs) {
    const { w, safe } = layout;
    const B = this.B;
    const C = this.c;
    drawAcetate(g, 0, 0, w, safe.t + 34);
    const ghost = controlsGhost(nowMs);
    // Squad cards: silhouette with health, fuel and ammo bars.
    for (let i = 0; i < 3; i++) {
      const cd = C.cards[i];
      const V = B.squad[i];
      if (!V) { cd.hidden = true; continue; }
      drawControl(g, cd, nowMs, 1);
      g.fillStyle = V.destroyed ? '#5b5e66' : V === B.me ? PAL.league : 'rgba(230,220,195,0.7)';
      g.fillRect(cd.x + 7, cd.y + 7, 20, 5);
      g.fillRect(cd.x + 12, cd.y + 4, 8, 3);
      let hp = 0;
      for (const p of V.parts) if (p.alive) hp += p.hp;
      const bars = [[hp / V.hpMax, PAL.good], [V.fuelMax ? V.fuel / V.fuelMax : 0, PAL.warning], [V.shellsMax ? V.shells / V.shellsMax : 0, PAL.linen]];
      bars.forEach(([f, col], k) => {
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(cd.x + 6, cd.y + 15 + k * 4, 34, 2.5);
        g.fillStyle = V.destroyed ? '#5b5e66' : col; g.fillRect(cd.x + 6, cd.y + 15 + k * 4, 34 * clamp(f, 0, 1), 2.5);
      });
      g.font = `700 12px ${FONT_UI}`;
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillStyle = PAL.linen;
      g.fillText(String(i + 1), cd.x + 33, cd.y + 9);
    }
    // Objective with a progress bar.
    const left = C.cards[2].x + C.cards[2].w + 10;
    const right = this.mini.x - 10;
    if (right - left > 70) {
      g.font = `400 14px ${FONT_UI}`;
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillStyle = PAL.linen;
      g.fillText(`${B.cfg.goal} ${B.goalDone}/${B.goalTotal}`, left, safe.t + 13, right - left);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(left, safe.t + 24, right - left, 3);
      g.fillStyle = PAL.amber; g.fillRect(left, safe.t + 24, (right - left) * (B.goalDone / Math.max(1, B.goalTotal)), 3);
    }
    this.drawMinimap(g);
    for (const c of [C.time, C.pause, C.settings, C.recenter]) drawControl(g, c, nowMs, 1);
    for (const c of [C.left, C.right, C.special, C.alt, C.swap, C.fire, ...C.chips]) drawControl(g, c, nowMs, ghost);
    const mw = mainWeapon(B.me);
    if (mw && !B.me.destroyed) drawRing(g, C.fire, 1 - Math.max(0, mw.reload) / (mw.def.reload * (B.me.crew < 3 ? 1.6 : 1)), ghost);
  },

  // Minimap strip: terrain line, spotted units, camera window.
  drawMinimap(g) {
    const B = this.B;
    const m = this.mini;
    const T = B.T;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(m.x, m.y, m.w, m.h);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < T.n; i += 8) { lo = Math.min(lo, T.h[i]); hi = Math.max(hi, T.h[i]); }
    const span = Math.max(4, hi - lo);
    const X = (x) => m.x + (x / T.length) * m.w;
    const Y = (y) => m.y + m.h - 4 - ((y - lo) / span) * (m.h - 10);
    g.strokeStyle = 'rgba(230,220,195,0.55)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < T.n; i += 8) { const x = i * CELL; if (i === 0) g.moveTo(X(x), Y(T.h[i])); else g.lineTo(X(x), Y(T.h[i])); }
    g.stroke();
    for (const V of B.units) {
      if (V.side === 1 && !V.seen && !(V.destroyed && V.everSeen)) continue;
      g.fillStyle = V.destroyed ? '#6b6e76' : V.side === 0 ? (V === B.me ? PAL.amber : '#7fb0ea') : PAL.directorate;
      g.fillRect(X(V.body.x) - 1.5, Y(V.body.y) - 4, 3, 3);
    }
    const vw = layout.w / view.S;
    g.strokeStyle = 'rgba(230,220,195,0.8)';
    g.strokeRect(X(view.cx - vw / 2), m.y + 1, (vw / T.length) * m.w, m.h - 2);
  },
};

/* ---------- 17_main.js ---------- */
/* ==== 17 MAIN ==== */
// Boot, resize/orientation, the fixed-step loop, and pause on hide, blur and portrait.
// Loop states (design/04 §4): running, frozen (tactical time stop: the screen
// halts its own simulation), paused (Pause card), hidden (auto-pause, audio suspended).

const game = { time: 0, paused: false, frozen: false, hidden: false, portrait: false, frames: 0, fps: 60 };

let lastT = performance.now();
let acc = 0;
let fpsAcc = 0;
let fpsFrames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.25) dt = 0.25;
  const scr = screens.cur;
  const simRunning = !game.paused && !game.hidden && !game.portrait;
  input.update(now);
  acc += dt;
  
  let steps = 0;
  let maxSteps = MAX_SIM_STEPS;
  
  while (acc >= SIM_STEP && steps < maxSteps) {
    if (simRunning) game.time += SIM_STEP;
    if (scr && scr.update) scr.update(SIM_STEP, simRunning);
    acc -= SIM_STEP;
    steps++;
  }
  if (steps === maxSteps) acc = 0;
  if (!game.hidden && scr && scr.render) {
    scr.render(ctx, now);
    if (save.settings.showFps) drawFps(dt);
  }
  game.frames++;
}

function drawFps(dt) {
  fpsAcc += dt;
  fpsFrames++;
  if (fpsAcc >= 0.5) { game.fps = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }
  const { h, safe } = layout;
  ctx.font = `400 12px ${FONT_UI}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(230,220,195,0.8)';
  ctx.fillText(game.fps + ' fps', safe.l + 6, h - safe.b - 2);
}

// ---------- lifecycle
function setHidden(hidden) {
  if (game.hidden === hidden) return;
  game.hidden = hidden;
  lastT = performance.now();
  if (hidden) {
    input.releaseAll();
    pauseGame();
    save.flush();
  }
  audio.setHidden(hidden);
}

let resizeTimer = 0;
function scheduleResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const wasPortrait = game.portrait;
    resize();
    if (game.portrait && !wasPortrait) { input.releaseAll(); pauseGame(); }
  }, 100);
}

// First tap anywhere: unlock audio and, on phones, go full screen if the setting is on.
// pointerup (not pointerdown) counts as a user gesture for full screen on touch devices.
let firstGestureDone = false;
function firstGesture() {
  audio.unlock();
  if (firstGestureDone) return;
  firstGestureDone = true;
  if (save.settings.fullscreen && !FINE_POINTER.matches && screens.name === 'title') enterFullscreen();
}

function applySettings(name) {
  audio.applySettings();
  if (name === 'quality' || name === 'btnSize' || name === 'leftHanded' || name === '*') resize();
  document.documentElement.classList.toggle('reduced-motion', save.settings.reducedMotion);
}

function boot() {
  save.load();
  if (save.firstRun) {
    save.settings.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  ui.init();
  input.init();
  bus.on('settings', applySettings);
  bus.on('profile', () => { if (screens.name === 'title') SCREENS.title.build(); });
  applySettings('');

  window.addEventListener('resize', scheduleResize);
  window.addEventListener('orientationchange', scheduleResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleResize);
  document.addEventListener('visibilitychange', () => setHidden(document.visibilityState === 'hidden'));
  window.addEventListener('blur', () => { input.releaseAll(); pauseGame(); save.flush(); });
  window.addEventListener('pagehide', () => save.flush());
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('pointerup', firstGesture, true);
  window.addEventListener('keydown', firstGesture, true);

  resize();
  screens.go('title');
  for (const msg of save.notices) ui.toast(msg, 6000);
  requestAnimationFrame(frame);

  // The stencil font arrives as base64; redraw anything cached once it is ready.
  if (document.fonts && document.fonts.load) document.fonts.load(`44px ${FONT_STENCIL}`).catch(() => {});
}



boot();

})();
