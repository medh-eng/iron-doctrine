/* ==== 00 CONFIG ==== */
// Version shown in Settings. Minor = build part (Part 1 = 0.1.x), patch = fixes.
const GAME_VERSION = '0.0.1';
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
};

const FONT_UI = '"Roboto Condensed", "sans-serif-condensed", "Arial Narrow", system-ui, sans-serif';
