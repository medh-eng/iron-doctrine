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
