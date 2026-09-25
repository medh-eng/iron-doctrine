(() => {
'use strict';
/* ---------- 00_config.js ---------- */
/* ==== 00 CONFIG ==== */
// Version shown in Settings. Minor = build part (Part 1 = 0.1.x), patch = fixes.
const GAME_VERSION = '0.1.1';
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

  // ---------- sound effects (design/03 §7)
  sfx(name, pan = 0, vel = 1) {
    if (!this.ctx || this.ctx.state !== 'running' || !save.settings.sound) return;
    const fn = SFX[name];
    if (fn) fn(this, this.ctx.currentTime + 0.005, pan, vel);
  },
};

// Themes: step(a, i, t, sd, rng) is called once per 16th note.
const THEMES = {
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
    const first = card.querySelector('button');
    if (first && FINE_POINTER.matches) first.focus({ preventScroll: true });
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
    const sx = toScreenX(f.x);
    const sy = toScreenY(f.y) - 40 * e;
    g.strokeText(f.text, sx, sy);
    g.fillText(f.text, sx, sy);
  });
  g.restore();
}

/* ---------- 16_screens.js ---------- */
/* ==== 16 SCREENS ==== */
// Screen manager plus the Part 1a screens: title and the controls test range.
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
      pgRow.appendChild(button(`Continue at level ${p.continueLevel}`, () => screens.go('range', p.continueLevel), 'btn btn-primary'));
    }
    pgRow.appendChild(button('Play from level 1', () => screens.go('range', 1), p.continueLevel > 1 ? 'btn' : 'btn btn-primary'));
    pg.appendChild(pgRow);
    menu.appendChild(pg);

    const row2 = el('div', 'menu-row');
    row2.appendChild(button('Drafting Office', () => ui.toast('The Drafting Office opens in a later update.')));
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

// ---------- Controls test range (stand-in for the battle until Part 1b)
// A flat range with three placeholder vehicles and target boards, so every
// thumb control, gesture and key can be tried and tested.
const PX_PER_M = 10;            // at 360 px screen height; scales with the screen
const RANGE_GRAVITY = 20;
const SHELL_SPEED = 55;
const RELOAD_TIME = 1.2;
const ORDERS = ['Follow', 'Escort', 'Hold', 'Attack', 'Back'];

function rangeGroundY(x) { return 1.2 * Math.sin(x * 0.035) + 0.5 * Math.sin(x * 0.11); }

SCREENS.range = {
  pausable: true,
  level: 1,
  cam: { x: 0, y: 4, zoom: 1, follow: true },
  squad: [],
  active: 0,
  order: 'Follow',
  targets: [],
  target: -1,
  hits: 0,
  shots: 0,
  reload: 0,
  aim: null,          // {x, y} world point while manually aiming
  drive: 0,
  frozen: false,
  simTime: 0,
  tracers: makePool(() => ({ alive: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, life: 0, rocket: false }), MAX_TRACERS),
  puffs: makePool(() => ({ alive: false, x: 0, y: 0, r: 0, t: 0, life: 1 }), 60),
  controls: [],
  c: {},

  enter(level) {
    this.level = level || 1;
    this.squad = [0, 1, 2].map((i) => ({ x: 10 - i * 9, v: 0, hold: null, flip: false }));
    this.active = 0;
    this.order = 'Follow';
    this.targets = [55, 85, 120].map((x) => ({ x, hitT: -9 }));
    this.target = -1;
    this.hits = 0;
    this.shots = 0;
    this.reload = 0;
    this.aim = null;
    this.drive = 0;
    this.frozen = false;
    this.simTime = 0;
    this.cam.x = this.squad[0].x + 12;
    this.cam.y = 4;
    this.cam.zoom = 1;
    this.cam.follow = true;
    this.tracers.forEachAlive((t) => { t.alive = false; });
    this.puffs.forEachAlive((p) => { p.alive = false; });
    this.buildControls();
    audio.playTheme(null);
    game.frozen = false;
    ui.toast('Controls test range. Battles arrive in the next update.', 3500);
  },

  exit() { game.frozen = false; },

  pauseOpts() {
    return {
      restartLabel: 'Restart',
      restart: () => this.enter(this.level),
      quit: () => screens.go('title'),
    };
  },

  // ---------- controls
  buildControls() {
    const C = this.c;
    const drivePress = () => { this.updateDrive(); };
    C.left = makeControl('left', { glyph: 'left', down: drivePress, up: drivePress });
    C.right = makeControl('right', { glyph: 'right', down: drivePress, up: drivePress });
    C.upBtn = makeControl('up', { glyph: 'up', hidden: true });
    C.downBtn = makeControl('down', { glyph: 'down', hidden: true });
    C.fire = makeControl('fire', {
      label: 'Fire',
      down: (p) => { p.fireAim = false; },
      move: (p) => this.fireDrag(p),
      up: (p, cancelled) => this.fireUp(p, cancelled),
    });
    C.alt = makeControl('alt', { label: 'Alt', up: (p, x) => { if (!x) this.fireRocket(); } });
    C.swap = makeControl('swap', { label: 'Swap', up: (p, x) => { if (!x) this.swap(); } });
    C.special = makeControl('special', { label: 'Smoke', up: (p, x) => { if (!x) this.smoke(); } });
    C.chips = ORDERS.map((o, i) => makeControl('order' + i, {
      shape: 'rect', label: o, pad: 2, up: (p, x) => { if (!x) this.setOrder(o); },
    }));
    C.time = makeControl('time', { shape: 'rect', glyph: 'stop', pad: 4, up: (p, x) => { if (!x) this.toggleTime(); } });
    C.pause = makeControl('pause', { shape: 'rect', glyph: 'pause', pad: 4, up: (p, x) => { if (!x) togglePause(); } });
    C.settings = makeControl('settings', { shape: 'rect', glyph: 'gear', pad: 4, up: (p, x) => { if (!x) openSettingsPaused(); } });
    C.recenter = makeControl('recenter', { shape: 'rect', label: 'Recenter', hidden: true, up: (p, x) => { if (!x) this.recenter(); } });
    C.cards = [0, 1, 2].map((i) => makeControl('card' + i, {
      shape: 'rect', pad: 2, up: (p, x) => { if (!x) this.takeControl(i); },
    }));
    this.controls = [C.left, C.right, C.upBtn, C.downBtn, C.special, C.alt, C.swap, C.fire, ...C.chips,
      C.recenter, ...C.cards, C.time, C.pause, C.settings];
  },

  layout() {
    const C = this.c;
    if (!C.fire) return;
    const { w, h, safe } = layout;
    const s = BTN_SCALE[save.settings.btnSize] || 1;
    const L = save.settings.leftHanded;
    const mx = (x) => (L ? w - x : x);   // mirror for left-handed

    const top = safe.t;
    const barH = 34;
    // Top bar buttons, right side (44 px wide targets).
    let bx = w - safe.r - 6;
    for (const b of [C.settings, C.pause, C.time]) {
      bx -= 44;
      b.x = bx; b.y = top + 3; b.w = 42; b.h = 28;
      bx -= 4;
    }
    // Squad cards, left side.
    for (let i = 0; i < 3; i++) {
      const cd = C.cards[i];
      cd.x = safe.l + 6 + i * 50; cd.y = top + 3; cd.w = 46; cd.h = 28;
    }

    // Right thumb cluster.
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

    // Order chips: a column on the edge above Swap.
    const chipTop = top + barH + 8;
    const chipBottom = C.swap.y - C.swap.r - 8;
    const gap = 4;
    const chipH = clamp(Math.floor((chipBottom - chipTop - gap * 4) / 5), 24, 36);
    for (let i = 0; i < 5; i++) {
      const cp = C.chips[i];
      cp.w = chipW; cp.h = chipH;
      cp.x = L ? safe.l + 10 : w - edgeR - chipW;
      cp.y = chipTop + i * (chipH + gap);
    }

    // Left thumb: drive pad.
    const Rp = 34 * s;
    const padY = h - safe.b - 14 - Rp;
    const lx = safe.l + 18 + Rp;
    C.left.x = mx(lx); C.left.y = padY; C.left.r = Rp;
    C.right.x = mx(lx + Rp * 2 + 18); C.right.y = padY; C.right.r = Rp;
    if (L) { const t = C.left.x; C.left.x = C.right.x; C.right.x = t; }

    C.recenter.w = 92; C.recenter.h = 30;
    C.recenter.x = w / 2 - 46; C.recenter.y = top + barH + 8;
  },

  // ---------- squad and orders
  get me() { return this.squad[this.active]; },

  updateDrive() {
    const k = input.keys;
    const l = this.c.left.pressCount > 0 || k.has('KeyA') || k.has('ArrowLeft');
    const r = this.c.right.pressCount > 0 || k.has('KeyD') || k.has('ArrowRight');
    this.c.left.held = k.has('KeyA') || k.has('ArrowLeft');
    this.c.right.held = k.has('KeyD') || k.has('ArrowRight');
    const before = this.drive;
    this.drive = l && r ? 2 : l ? -1 : r ? 1 : 0;   // 2 = halt/brake
    if (this.drive !== before && (this.drive === 1 || this.drive === -1)) audio.sfx('engineRev', this.panOf(this.me.x));
  },

  takeControl(i) {
    if (i === this.active) return;
    this.active = i;
    this.me.hold = null;
    this.cam.follow = true;
    audio.sfx('swap');
    haptic('tap');
    floatText(`Vehicle ${i + 1}`, this.me.x, rangeGroundY(this.me.x) + 5);
  },

  swap() { this.takeControl((this.active + 1) % 3); },

  setOrder(o) {
    this.order = o;
    for (const s of this.squad) s.hold = null;
    audio.sfx('order');
    haptic('tap');
    floatText(o, this.me.x, rangeGroundY(this.me.x) + 5);
  },

  recenter() {
    this.cam.follow = true;
    audio.sfx('tap');
  },

  toggleTime() {
    this.frozen = !this.frozen;
    game.frozen = this.frozen;
    this.c.time.glyph = this.frozen ? 'play' : 'stop';
    this.c.time.glyphLines = null;
    audio.sfx(this.frozen ? 'timeStop' : 'timeStart');
    haptic('tap');
  },

  // ---------- weapons (placeholder ballistics; real combat is Part 1b)
  muzzle(v) {
    const dir = v.flip ? -1 : 1;
    return { x: v.x + dir * 4.2, y: rangeGroundY(v.x) + 2.6, dir };
  },

  // Low-angle firing solution to hit (tx, ty) from (x, y); out of range fires at 45°.
  solve(x, y, tx, ty, speed) {
    const dx = tx - x;
    const dy = ty - y;
    const ax = Math.max(0.01, Math.abs(dx));
    const v2 = speed * speed;
    const disc = v2 * v2 - RANGE_GRAVITY * (RANGE_GRAVITY * ax * ax + 2 * dy * v2);
    const ang = disc < 0 ? Math.PI / 4 : Math.atan((v2 - Math.sqrt(disc)) / (RANGE_GRAVITY * ax));
    return { vx: Math.cos(ang) * speed * (dx < 0 ? -1 : 1), vy: Math.sin(ang) * speed };
  },

  fireDrag(p) {
    const C = this.c.fire;
    if (this.frozen) return;
    const off = dist(p.x, p.y, C.x, C.y);
    if (!p.fireAim && off > C.r * 0.6) p.fireAim = true;
    if (!p.fireAim) return;
    if (off < C.r * 0.8) { this.aim = null; return; }   // back on the button: cancel
    const wx = this.toWorldX(p.x);
    const wy = Math.max(this.toWorldY(p.y), rangeGroundY(wx));
    this.aim = this.aim || { x: 0, y: 0 };
    this.aim.x = wx; this.aim.y = wy;
  },

  fireUp(p, cancelled) {
    const aim = this.aim;
    this.aim = null;
    if (cancelled || this.frozen) return;
    if (p.fireAim) {
      if (aim) this.fireShell(aim.x, aim.y);
      else audio.sfx('back');
      return;
    }
    this.fireAuto();
  },

  fireAuto() {
    if (this.frozen) return;
    const me = this.me;
    let tx;
    if (this.target >= 0) tx = this.targets[this.target].x;
    else {
      // Nearest board in front, else a point 40 m ahead.
      const dir = me.flip ? -1 : 1;
      tx = me.x + dir * 40;
      let best = Infinity;
      for (const t of this.targets) {
        const d = (t.x - me.x) * dir;
        if (d > 5 && d < best) { best = d; tx = t.x; }
      }
    }
    this.fireShell(tx, rangeGroundY(tx) + 1.5);
  },

  fireShell(tx, ty) {
    if (this.reload > 0) { audio.sfx('error'); return; }
    const me = this.me;
    me.flip = tx < me.x;
    const m = this.muzzle(me);
    const v = this.solve(m.x, m.y, tx, ty, SHELL_SPEED);
    this.spawnTracer(m.x, m.y, v.vx, v.vy, false);
    this.reload = RELOAD_TIME;
    this.shots++;
    audio.sfx('cannon', this.panOf(m.x), 1);
    haptic('fire');
    this.puff(m.x, m.y, 0.8);
  },

  fireRocket() {
    if (this.frozen) return;
    const me = this.me;
    const m = this.muzzle(me);
    this.spawnTracer(m.x, m.y + 0.5, m.dir * 70, 6, true);
    audio.sfx('rocket', this.panOf(m.x));
    haptic('fire');
  },

  smoke() {
    if (this.frozen) return;
    const me = this.me;
    for (let i = 0; i < 6; i++) this.puff(me.x + (i - 2.5) * 1.6, rangeGroundY(me.x) + 1.5 + (i % 2), 2.2);
    audio.sfx('smoke', this.panOf(me.x));
    haptic('tap');
  },

  spawnTracer(x, y, vx, vy, rocket) {
    const t = this.tracers.take();
    t.x = t.px = x; t.y = t.py = y; t.vx = vx; t.vy = vy; t.life = 4; t.rocket = rocket;
  },

  puff(x, y, r) {
    const p = this.puffs.take();
    p.x = x; p.y = y; p.r = r; p.t = 0; p.life = 1.4 + r * 0.3;
  },

  panOf(wx) { return clamp((this.toScreenX(wx) / layout.w) * 2 - 1, -1, 1) * 0.8; },

  // ---------- camera
  scale() { return PX_PER_M * (layout.h / 360) * this.cam.zoom; },
  toScreenX(wx) { return (wx - this.cam.x) * this.scale() + layout.w / 2; },
  toScreenY(wy) { return layout.h * 0.62 - (wy - this.cam.y) * this.scale(); },
  toWorldX(sx) { return (sx - layout.w / 2) / this.scale() + this.cam.x; },
  toWorldY(sy) { return (layout.h * 0.62 - sy) / this.scale() + this.cam.y; },

  world: {
    tap(x, y) {
      const R = SCREENS.range;
      const wx = R.toWorldX(x);
      const wy = R.toWorldY(y);
      // Own vehicle: take control.
      for (let i = 0; i < 3; i++) {
        const v = R.squad[i];
        if (Math.abs(wx - v.x) < 4 && wy > rangeGroundY(v.x) - 1 && wy < rangeGroundY(v.x) + 5) { R.takeControl(i); return; }
      }
      // Target board: set as target (tap again to clear).
      for (let i = 0; i < R.targets.length; i++) {
        const t = R.targets[i];
        if (Math.abs(wx - t.x) < 3 && wy > rangeGroundY(t.x) - 1 && wy < rangeGroundY(t.x) + 6) {
          R.target = R.target === i ? -1 : i;
          audio.sfx(R.target === i ? 'toggleOn' : 'toggleOff');
          haptic('tap');
          if (R.target === i) floatText('Target', t.x, rangeGroundY(t.x) + 6.5, true);
          return;
        }
      }
    },
    doubleTap() {
      const R = SCREENS.range;
      R.cam.zoom = 1;
      audio.sfx('tap');
    },
    longPress(x) {
      const R = SCREENS.range;
      const wx = R.toWorldX(x);
      for (let i = 0; i < 3; i++) if (i !== R.active) R.squad[i].hold = wx + (i - 1) * 6;
      audio.sfx('order');
      haptic('tap');
      floatText('Move here', wx, rangeGroundY(wx) + 3);
    },
    pan(dx, dy) {
      const R = SCREENS.range;
      R.cam.follow = false;
      R.cam.x -= dx / R.scale();
      R.cam.y = clamp(R.cam.y + dy / R.scale(), -2, 30);
    },
    pinch(f, cx, cy) {
      const R = SCREENS.range;
      const bx = R.toWorldX(cx), by = R.toWorldY(cy);
      R.cam.zoom = clamp(R.cam.zoom * f, ZOOM_MIN, ZOOM_MAX);
      R.cam.x += bx - R.toWorldX(cx);
      R.cam.y = clamp(R.cam.y + by - R.toWorldY(cy), -2, 30);
    },
  },

  key(code, down) {
    if (/^(KeyA|KeyD|ArrowLeft|ArrowRight)$/.test(code)) { this.updateDrive(); return; }
    const hold = (c) => { c.held = down; if (!down) c.releasedAt = performance.now(); };
    if (code === 'Space') { hold(this.c.fire); if (down) this.fireAuto(); return; }
    if (code === 'KeyF') { hold(this.c.alt); if (down) this.fireRocket(); return; }
    if (code === 'KeyE' || code === 'Tab') { hold(this.c.swap); if (down) this.swap(); return; }
    if (code === 'KeyQ') { hold(this.c.special); if (down) this.smoke(); return; }
    const n = /^Digit([1-5])$/.exec(code);
    if (n) { const c = this.c.chips[+n[1] - 1]; hold(c); if (down) this.setOrder(ORDERS[+n[1] - 1]); return; }
    if (!down) return;
    if (code === 'KeyT') this.toggleTime();
    else if (code === 'KeyC') this.recenter();
  },

  // ---------- simulation
  update(dt, simRunning) {
    if (simRunning && !this.frozen) this.step(dt);
    this.updateCamera(dt);
    updateFloaters(dt);
    const C = this.c;
    for (let i = 0; i < 5; i++) C.chips[i].lit = ORDERS[i] === this.order;
    for (let i = 0; i < 3; i++) C.cards[i].lit = i === this.active;
    C.recenter.hidden = this.cam.follow;
    C.fire.disabled = this.frozen;
    C.alt.disabled = this.frozen;
    C.special.disabled = this.frozen;
  },

  step(dt) {
    this.simTime += dt;
    this.reload = Math.max(0, this.reload - dt);
    const me = this.me;
    // Controlled vehicle: simple kinematic drive (real physics arrive in Part 1b).
    const accel = 9;
    if (this.drive === 2) me.v *= Math.pow(0.02, dt);
    else if (this.drive) { me.v += this.drive * accel * dt; me.flip = this.drive < 0; }
    else me.v *= Math.pow(0.3, dt);
    me.v = clamp(me.v, -8, 12);
    // Squad-mates follow the order.
    for (let i = 0; i < 3; i++) {
      if (i === this.active) continue;
      const v = this.squad[i];
      const slot = i < this.active ? i + 1 : i;   // 1 or 2 behind
      const dir = me.flip ? 1 : -1;
      let goal = null;
      if (v.hold !== null) goal = v.hold;
      else if (this.order === 'Follow') goal = me.x + dir * 10 * slot;
      else if (this.order === 'Escort') goal = me.x + dir * 5 * slot - dir * (slot === 2 ? 10 : 0);
      else if (this.order === 'Attack') goal = this.target >= 0 ? this.targets[this.target].x - 25 - slot * 6 : me.x - dir * 8 * slot;
      else if (this.order === 'Back') goal = me.x + dir * 25 * slot;
      if (goal === null) v.v *= Math.pow(0.05, dt);
      else {
        const d = goal - v.x;
        const want = clamp(d * 0.8, -9, 9);
        v.v += clamp(want - v.v, -8 * dt, 8 * dt);
        if (Math.abs(d) > 1) v.flip = d < 0;
      }
    }
    for (const v of this.squad) v.x = clamp(v.x + v.v * dt, -60, 220);

    // Tracers.
    this.tracers.forEachAlive((t) => {
      t.px = t.x; t.py = t.y;
      if (!t.rocket) t.vy -= RANGE_GRAVITY * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.life -= dt;
      for (const b of this.targets) {
        const gy = rangeGroundY(b.x);
        if (Math.abs(t.x - b.x) < 1.2 && t.y > gy && t.y < gy + 5) {
          t.alive = false;
          b.hitT = this.simTime;
          this.hits++;
          floatText(t.rocket ? 'Rocket hit' : 'Hit', b.x, gy + 6.5, true);
          audio.sfx('clunk', this.panOf(b.x));
          this.puff(t.x, t.y, 1);
          return;
        }
      }
      if (t.y < rangeGroundY(t.x) || t.life <= 0) {
        t.alive = false;
        this.puff(t.x, rangeGroundY(t.x) + 0.5, 1.2);
        audio.sfx('tick', this.panOf(t.x), 1.5);
      }
    });
    this.puffs.forEachAlive((p) => { p.t += dt; p.y += dt * 0.8; if (p.t > p.life) p.alive = false; });
  },

  updateCamera(dt) {
    const cam = this.cam;
    const idle = (performance.now() - input.lastWorldTouch) / 1000;
    if (!cam.follow && save.settings.autoRecenter && idle > RECENTER_AFTER && input.world.length === 0) cam.follow = true;
    if (cam.follow) {
      const me = this.me;
      const lead = me.flip ? -12 : 12;
      const k = 1 - Math.pow(0.02, dt);
      cam.x += (me.x + lead - cam.x) * k;
      cam.y += (4 - cam.y) * k;
    }
  },

  // ---------- drawing
  render(g, nowMs) {
    const { w, h, safe } = layout;
    const S = this.scale();
    drawBackground(g, this.cam.x * this.scale() * 0.25);

    // Ground, drawn as one polygon across the screen.
    const x0 = this.toWorldX(-10);
    const x1 = this.toWorldX(w + 10);
    const stepM = 8 / S;
    g.fillStyle = PAL.ground;
    g.beginPath();
    g.moveTo(-10, h);
    for (let x = x0; x <= x1 + stepM; x += stepM) g.lineTo(this.toScreenX(x), this.toScreenY(rangeGroundY(x)));
    g.lineTo(w + 10, h);
    g.closePath();
    g.fill();
    g.strokeStyle = PAL.groundEdge;
    g.lineWidth = 2;
    g.beginPath();
    for (let x = x0; x <= x1 + stepM; x += stepM) {
      const sx = this.toScreenX(x), sy = this.toScreenY(rangeGroundY(x));
      if (x === x0) g.moveTo(sx, sy); else g.lineTo(sx, sy);
    }
    g.stroke();

    // Distance posts every 10 m.
    g.font = `400 12px ${FONT_UI}`;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillStyle = 'rgba(230,220,195,0.55)';
    for (let m = Math.ceil(x0 / 10) * 10; m <= x1; m += 10) {
      const sx = this.toScreenX(m), sy = this.toScreenY(rangeGroundY(m));
      g.fillRect(sx - 1, sy - 8, 2, 8);
      if (m % 20 === 0) g.fillText(m + ' m', sx, sy + 4);
    }

    // Target boards.
    for (let i = 0; i < this.targets.length; i++) {
      const t = this.targets[i];
      const sx = this.toScreenX(t.x), sy = this.toScreenY(rangeGroundY(t.x));
      const flash = clamp(1 - (this.simTime - t.hitT) / 0.25, 0, 1);
      g.fillStyle = flash > 0 ? PAL.amber : PAL.directorate;
      g.fillRect(sx - 0.4 * S, sy - 5 * S, 0.8 * S, 5 * S);
      g.fillRect(sx - 1.4 * S, sy - 5 * S, 2.8 * S, 2.4 * S);
      if (i === this.target) {
        g.strokeStyle = PAL.amber;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(sx, sy - 3.8 * S, 2.4 * S, 0, Math.PI * 2);
        g.stroke();
      }
    }

    // Squad vehicles (placeholder silhouettes).
    for (let i = 0; i < 3; i++) this.drawVehicle(g, this.squad[i], i === this.active, S);

    // Smoke.
    this.puffs.forEachAlive((p) => {
      const k = p.t / p.life;
      g.globalAlpha = 0.5 * (1 - k);
      g.fillStyle = '#8b8a90';
      g.beginPath();
      g.arc(this.toScreenX(p.x), this.toScreenY(p.y), (p.r + k * p.r) * S * 0.6, 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;

    // Tracers.
    g.lineCap = 'round';
    this.tracers.forEachAlive((t) => {
      const ax = this.toScreenX(t.px), ay = this.toScreenY(t.py);
      const bx = this.toScreenX(t.x), by = this.toScreenY(t.y);
      g.strokeStyle = 'rgba(255,178,62,0.35)';
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(ax - (bx - ax) * 2, ay - (by - ay) * 2); g.lineTo(bx, by); g.stroke();
      g.strokeStyle = '#FFE2A8';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(ax - (bx - ax), ay - (by - ay)); g.lineTo(bx, by); g.stroke();
    });

    // Manual-aim trajectory preview.
    if (this.aim && save.settings.aimAssist) {
      const m = this.muzzle(this.me);
      const v = this.solve(m.x, m.y, this.aim.x, this.aim.y, SHELL_SPEED);
      g.fillStyle = 'rgba(255,178,62,0.85)';
      let x = m.x, y = m.y, vx = v.vx, vy = v.vy;
      for (let i = 0; i < 60; i++) {
        const dt = 0.05;
        vy -= RANGE_GRAVITY * dt; x += vx * dt; y += vy * dt;
        if (y < rangeGroundY(x)) break;
        if (i % 2 === 0) { g.beginPath(); g.arc(this.toScreenX(x), this.toScreenY(y), 2, 0, Math.PI * 2); g.fill(); }
      }
      g.strokeStyle = PAL.amber;
      g.lineWidth = 1.5;
      const ax = this.toScreenX(this.aim.x), ay = this.toScreenY(this.aim.y);
      g.beginPath(); g.arc(ax, ay, 7, 0, Math.PI * 2); g.stroke();
    }

    drawFloaters(g, (x) => this.toScreenX(x), (y) => this.toScreenY(y));

    // Time stopped banner.
    if (this.frozen) {
      g.fillStyle = 'rgba(19,70,107,0.18)';
      g.fillRect(0, 0, w, h);
      g.font = `700 16px ${FONT_UI}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const bw = 150;
      drawAcetate(g, w / 2 - bw / 2, safe.t + 42, bw, 26);
      g.fillStyle = PAL.linen;
      g.fillText('Time stopped', w / 2, safe.t + 55);
    }

    this.drawHud(g, nowMs);
  },

  drawVehicle(g, v, active, S) {
    const gy = rangeGroundY(v.x);
    const slope = Math.atan((rangeGroundY(v.x + 1) - rangeGroundY(v.x - 1)) / 2);
    const sx = this.toScreenX(v.x), sy = this.toScreenY(gy);
    const dir = v.flip ? -1 : 1;
    g.save();
    g.translate(sx, sy);
    g.rotate(-slope);
    g.scale(dir, 1);
    g.fillStyle = active ? PAL.league : '#23507f';
    // Tracks and wheels.
    g.fillRect(-3.4 * S, -1.1 * S, 6.8 * S, 1.1 * S);
    // Hull.
    g.beginPath();
    g.moveTo(-3.6 * S, -1.1 * S);
    g.lineTo(3.9 * S, -1.1 * S);
    g.lineTo(3.2 * S, -2.2 * S);
    g.lineTo(-3.4 * S, -2.2 * S);
    g.closePath();
    g.fill();
    // Turret and barrel.
    g.fillRect(-1.6 * S, -3.2 * S, 3 * S, 1.1 * S);
    g.fillRect(1.2 * S, -2.9 * S, 3 * S, 0.35 * S);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.arc(k * 1.4 * S, -0.5 * S, 0.45 * S, 0, Math.PI * 2); g.fill(); }
    g.restore();
    if (active) {
      g.fillStyle = PAL.amber;
      g.beginPath();
      g.moveTo(sx - 5, sy - 3.9 * S - 10);
      g.lineTo(sx + 5, sy - 3.9 * S - 10);
      g.lineTo(sx, sy - 3.9 * S - 4);
      g.closePath();
      g.fill();
    }
  },

  drawHud(g, nowMs) {
    const { w, safe } = layout;
    const C = this.c;
    drawAcetate(g, 0, 0, w, safe.t + 34);
    const ghost = controlsGhost(nowMs);
    // Squad cards: silhouette plus a health bar.
    for (let i = 0; i < 3; i++) {
      const cd = C.cards[i];
      drawControl(g, cd, nowMs, 1);
      g.fillStyle = i === this.active ? PAL.league : 'rgba(230,220,195,0.6)';
      g.fillRect(cd.x + 10, cd.y + 9, 22, 6);
      g.fillRect(cd.x + 16, cd.y + 6, 9, 3);
      g.fillStyle = PAL.good;
      g.fillRect(cd.x + 8, cd.y + 19, 30, 3);
      g.font = `700 12px ${FONT_UI}`;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillStyle = PAL.linen;
      g.fillText(String(i + 1), cd.x + 36, cd.y + 11);
    }
    // Objective text between the cards and the buttons.
    const left = C.cards[2].x + C.cards[2].w + 12;
    const right = C.time.x - 10;
    g.font = `400 14px ${FONT_UI}`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = PAL.linen;
    const txt = `Controls test · hits ${this.hits} of ${this.shots}`;
    if (right - left > 80) g.fillText(txt, left, safe.t + 17, right - left);

    for (const c of [C.time, C.pause, C.settings, C.recenter]) drawControl(g, c, nowMs, 1);
    for (const c of [C.left, C.right, C.upBtn, C.downBtn, C.special, C.alt, C.swap, C.fire, ...C.chips]) drawControl(g, c, nowMs, ghost);
    drawRing(g, C.fire, 1 - this.reload / RELOAD_TIME, ghost);
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
  while (acc >= SIM_STEP && steps < MAX_SIM_STEPS) {
    if (simRunning) game.time += SIM_STEP;
    if (scr && scr.update) scr.update(SIM_STEP, simRunning);
    acc -= SIM_STEP;
    steps++;
  }
  if (steps === MAX_SIM_STEPS) acc = 0;
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
