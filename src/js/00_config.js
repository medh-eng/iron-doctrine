/* ==== 00 CONFIG ==== */
// Version shown in Settings. Minor = build part (Part 1 = 0.1.x), patch = fixes.
const GAME_VERSION = '0.2.1';
// Bump when the save format changes, and add a migration in 02_save.js.
const SAVE_VERSION = 2;
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
  blueprints: [],          // captured boss design ids
  medals: [],              // medal ids
  run: { active: false, level: 1, lives: 3, score: 0 },   // the ladder run in progress (v2)
  requisition: 150,        // earned from score, spent in the Workshop (v2); new players start with 150
  squad: [],               // design ids fielded in the ladder (v2)
  stats: { battles: 0, kills: 0, cleared: 0 },            // (v2)
};

// Saved designs (v2). Stored under irondoctrine.designs.
const DEFAULT_DESIGNS = { list: [] };

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
