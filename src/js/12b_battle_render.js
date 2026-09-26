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

// Parts whose drawn shape isn't their full box get no outline.
const NO_OUTLINE = new Set(['wheel_s', 'wheel_l', 'slope40', 'frame', 'optics', 'bow', 'prop', 'sonar', 'wing', 'tail', 'aero', 'jet', 'aprop', 'rotor', 'trotor', 'skirt', 'atgm', 'sam', 'radar_s', 'radar_n', 'crane', 'blade', 'bridge', 'ramp']);

// Draw one part with its top-left at (x, y), cell size cs px.
function drawPart(g, p, x, y, cs, side, seed) {
  const d = p.def;
  const w = d.w * cs, h = d.h * cs;
  const steel = FACTION_STEEL[side];
  const r = Math.max(0.8, cs * 0.05);
  g.save();
  if (drawPartArt(g, p, x, y, cs)) {
    // Imported art: only the procedural damage overlay is added below.
  } else switch (d.id) {
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
    // Ship parts (Part 2a).
    case 'hull':
      bevel(g, x, y, w, h, shade(steel, 0.9), 1);
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = Math.max(1, cs * 0.05);
      g.beginPath(); g.moveTo(x, y + h * 0.5); g.lineTo(x + w, y + h * 0.5); g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.4)';
      for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + w * (0.12 + k * 0.25), y + h * 0.5 - cs * 0.12, r, 0, Math.PI * 2); g.fill(); }
      break;
    case 'bow':
      g.fillStyle = shade(steel, 0.9);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w * 0.3, y + h); g.lineTo(x, y + h); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = Math.max(1, cs * 0.1);
      g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w * 0.3, y + h); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = Math.max(1, cs * 0.05);
      g.beginPath(); g.moveTo(x, y + h * 0.5); g.lineTo(x + w * 0.65, y + h * 0.5); g.stroke();
      break;
    case 'keel':
      bevel(g, x, y, w, h, '#5c3129', 1.4);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y + h * 0.7, w, h * 0.3);
      break;
    case 'bulk':
      bevel(g, x, y, w, h, shade(steel, 0.75), 1.4);
      g.strokeStyle = PAL.amber; g.lineWidth = Math.max(1, cs * 0.07);
      g.setLineDash([cs * 0.18, cs * 0.14]);
      g.beginPath(); g.moveTo(x + w / 2, y + cs * 0.1); g.lineTo(x + w / 2, y + h - cs * 0.1); g.stroke();
      g.setLineDash([]);
      break;
    case 'marine': {
      bevel(g, x, y, w, h, shade(steel, 0.8), 1);
      g.fillStyle = '#15181d'; g.fillRect(x + cs * 0.3, y + cs * 0.4, w - cs * 0.6, h - cs * 0.9);
      g.fillStyle = shade(steel, 0.65);
      for (let k = 0; k < 6; k++) { g.fillRect(x + cs * (0.45 + k * 0.55), y + cs * 0.55, cs * 0.3, h * 0.35); }
      g.fillStyle = '#2b2d31'; g.fillRect(x + w - cs * 0.9, y - cs * 1.2, cs * 0.5, cs * 1.3);
      g.fillStyle = 'rgba(20,20,20,0.5)'; g.beginPath(); g.arc(x + w - cs * 0.65, y - cs * 1.3, cs * 0.3, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'prop': {
      g.fillStyle = '#2b2d31'; g.fillRect(x + w * 0.4, y, w * 0.2, h * 0.7);
      g.fillStyle = '#b08d4a';
      const cy = y + h * 0.72;
      g.beginPath(); g.ellipse(x + w * 0.5, cy - cs * 0.28, cs * 0.14, cs * 0.3, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x + w * 0.5, cy + cs * 0.22, cs * 0.14, cs * 0.3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#6f5a30'; g.beginPath(); g.arc(x + w * 0.5, cy, cs * 0.1, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'phull':
      bevel(g, x, y, w, h, shade(steel, 0.72), 1.5);
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = Math.max(1, cs * 0.08);
      for (const f of [0.33, 0.66]) { g.beginPath(); g.moveTo(x, y + h * f); g.lineTo(x + w, y + h * f); g.stroke(); }
      rivets(g, x, y, w, h, r * 1.2, 'rgba(0,0,0,0.5)');
      break;
    case 'ballast':
      bevel(g, x, y, w, h, '#3c4a52', 1);
      g.strokeStyle = 'rgba(160,200,220,0.5)'; g.lineWidth = Math.max(1, cs * 0.06);
      g.strokeRect(x + cs * 0.25, y + cs * 0.25, w - cs * 0.5, h - cs * 0.5);
      g.fillStyle = 'rgba(0,0,0,0.5)';
      for (let k = 0; k < 3; k++) g.fillRect(x + w * (0.25 + k * 0.2), y + h - cs * 0.2, cs * 0.12, cs * 0.12);
      break;
    case 'emotor':
      bevel(g, x, y, w, h, shade(steel, 0.8), 1);
      g.fillStyle = '#1d2a38'; g.fillRect(x + cs * 0.2, y + cs * 0.2, w - cs * 0.4, h * 0.4);
      g.fillStyle = PAL.amber; g.fillRect(x + cs * 0.3, y + cs * 0.3, cs * 0.15, cs * 0.2);
      g.fillStyle = '#6a7a50';
      for (let k = 0; k < 3; k++) g.fillRect(x + cs * (0.25 + k * 0.5), y + h * 0.62, cs * 0.35, h * 0.28);
      break;
    case 'torp':
      g.fillStyle = shade(steel, 0.7);
      roundRect(g, x, y + h * 0.15, w, h * 0.7, h * 0.35); g.fill();
      g.fillStyle = '#15181d'; g.beginPath(); g.arc(x + w - h * 0.35, y + h * 0.5, h * 0.25, 0, Math.PI * 2); g.fill();
      break;
    case 'dc':
      g.fillStyle = '#2b2d31'; g.fillRect(x, y + h * 0.75, w, h * 0.25);
      g.fillStyle = '#3a3f47';
      for (let k = 0; k < 3; k++) { g.fillRect(x + w * (0.05 + k * 0.32), y + h * 0.15, w * 0.26, h * 0.6); }
      g.fillStyle = PAL.amber;
      for (let k = 0; k < 3; k++) g.fillRect(x + w * (0.05 + k * 0.32), y + h * 0.4, w * 0.26, h * 0.08);
      break;
    case 'sonar':
      g.fillStyle = shade(steel, 0.7);
      g.beginPath(); g.ellipse(x + w / 2, y + h * 0.5, w * 0.48, h * 0.42, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(159,211,255,0.7)'; g.lineWidth = 1;
      for (const k of [0.15, 0.28]) { g.beginPath(); g.arc(x + w / 2, y + h * 0.5, w * k, -0.9, 0.9); g.stroke(); }
      break;
    // Aircraft parts (Part 2c).
    case 'wing':
      g.fillStyle = shade(steel, 0.95);
      g.beginPath(); g.moveTo(x, y + h * 0.55); g.quadraticCurveTo(x + w * 0.2, y + h * 0.15, x + w * 0.55, y + h * 0.25);
      g.lineTo(x + w, y + h * 0.55); g.lineTo(x + w, y + h * 0.7); g.lineTo(x, y + h * 0.7); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x + w * 0.1, y + h * 0.62); g.lineTo(x + w * 0.95, y + h * 0.62); g.stroke();
      break;
    case 'tail':
      g.fillStyle = shade(steel, 0.9);
      g.beginPath(); g.moveTo(x + w * 0.1, y + h); g.lineTo(x + w * 0.2, y + h * 0.05); g.lineTo(x + w * 0.55, y + h * 0.05); g.lineTo(x + w, y + h); g.closePath(); g.fill();
      g.fillStyle = FACTION_MARK[side]; g.fillRect(x + w * 0.25, y + h * 0.2, w * 0.25, h * 0.14);
      g.fillStyle = shade(steel, 0.75); g.fillRect(x, y + h * 0.78, w, h * 0.12);
      break;
    case 'aero':
      g.fillStyle = shade(steel, 0.8);
      roundRect(g, x, y + h * 0.08, w, h * 0.84, h * 0.4); g.fill();
      g.fillStyle = '#15181d';
      for (let k = 0; k < 4; k++) g.fillRect(x + w * (0.15 + k * 0.2), y + h * 0.3, w * 0.08, h * 0.4);
      g.fillStyle = 'rgba(20,20,20,0.5)'; g.fillRect(x + w * 0.05, y + h * 0.85, w * 0.3, h * 0.15);
      break;
    case 'jet':
      g.fillStyle = shade(steel, 0.75);
      g.beginPath(); g.moveTo(x, y + h * 0.3); g.lineTo(x + w * 0.85, y + h * 0.12); g.lineTo(x + w, y + h * 0.3); g.lineTo(x + w, y + h * 0.7); g.lineTo(x + w * 0.85, y + h * 0.88); g.lineTo(x, y + h * 0.7); g.closePath(); g.fill();
      g.fillStyle = '#15181d'; g.fillRect(x, y + h * 0.35, w * 0.08, h * 0.3);
      g.fillStyle = 'rgba(255,178,62,0.5)'; g.fillRect(x + w * 0.02, y + h * 0.42, w * 0.05, h * 0.16);
      break;
    case 'turb':
      bevel(g, x, y, w, h, shade(steel, 0.8), 1);
      g.fillStyle = '#15181d'; g.beginPath(); g.arc(x + w * 0.3, y + h / 2, h * 0.3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#7c828d'; g.lineWidth = 1;
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.beginPath(); g.moveTo(x + w * 0.3, y + h / 2); g.lineTo(x + w * 0.3 + Math.cos(a) * h * 0.28, y + h / 2 + Math.sin(a) * h * 0.28); g.stroke(); }
      g.fillStyle = '#2b2d31'; g.fillRect(x + w * 0.6, y + h * 0.3, w * 0.35, h * 0.4);
      break;
    case 'aprop':
      g.fillStyle = '#5a5f68'; g.beginPath(); g.moveTo(x, y + h * 0.4); g.lineTo(x + w * 0.7, y + h * 0.45); g.lineTo(x + w * 0.7, y + h * 0.55); g.lineTo(x, y + h * 0.6); g.closePath(); g.fill();
      g.fillStyle = 'rgba(200,205,215,0.28)';
      g.beginPath(); g.ellipse(x + w * 0.7, y + h / 2, w * 0.2, h * 0.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(40,42,48,0.7)'; g.lineWidth = Math.max(1, cs * 0.12);
      g.beginPath(); g.moveTo(x + w * 0.7, y + h * 0.05); g.lineTo(x + w * 0.7, y + h * 0.95); g.stroke();
      break;
    case 'rotor':
      g.fillStyle = '#2b2d31'; g.fillRect(x + w * 0.45, y + h * 0.4, w * 0.1, h * 0.6);
      g.fillStyle = 'rgba(200,205,215,0.25)';
      g.beginPath(); g.ellipse(x + w / 2, y + h * 0.35, w * 0.62, h * 0.22, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2b2d31'; g.lineWidth = Math.max(1.5, cs * 0.1);
      g.beginPath(); g.moveTo(x - w * 0.1, y + h * 0.35); g.lineTo(x + w * 1.1, y + h * 0.35); g.stroke();
      break;
    case 'trotor':
      g.fillStyle = 'rgba(200,205,215,0.3)'; g.beginPath(); g.arc(x + w / 2, y + h / 2, w * 0.6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2b2d31'; g.lineWidth = Math.max(1, cs * 0.08);
      g.beginPath(); g.moveTo(x + w / 2, y - h * 0.05); g.lineTo(x + w / 2, y + h * 1.05); g.stroke();
      break;
    case 'bomb':
      g.fillStyle = '#2b2d31'; g.fillRect(x, y, w, h * 0.2);
      g.fillStyle = '#3d423a';
      for (let k = 0; k < 2; k++) { g.beginPath(); g.ellipse(x + w * (0.27 + k * 0.46), y + h * 0.6, w * 0.2, h * 0.32, 0, 0, Math.PI * 2); g.fill(); }
      break;
    case 'ac20': case 'aa40':
      g.fillStyle = shade(steel, 0.7);
      roundRect(g, x + w * 0.1, y + h * (d.id === 'aa40' ? 0.45 : 0.3), w * 0.6, h * (d.id === 'aa40' ? 0.5 : 0.6), cs * 0.1); g.fill();
      if (d.id === 'aa40') { g.fillStyle = '#2b2d31'; g.fillRect(x, y + h * 0.9, w, h * 0.1); g.fillStyle = PAL.amber; g.fillRect(x + w * 0.15, y + h * 0.55, w * 0.12, h * 0.1); }
      break;
    // Systems, missiles and logistics (Part 2d).
    case 'skirt':
      g.fillStyle = shade(steel, 0.85); g.fillRect(x, y + h * 0.1, w, h * 0.8);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      for (let k = 0; k < 3; k++) g.fillRect(x + w * (0.15 + k * 0.3), y + h * 0.2, w * 0.08, h * 0.6);
      break;
    case 'rpod':
      g.fillStyle = shade(steel, 0.7); roundRect(g, x, y + h * 0.15, w, h * 0.7, h * 0.2); g.fill();
      g.fillStyle = '#15181d';
      for (let r0 = 0; r0 < 2; r0++) for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + w - cs * 0.12 - r0 * cs * 0.05, y + h * (0.28 + k * 0.15), cs * 0.05, 0, Math.PI * 2); g.fill(); }
      break;
    case 'atgm':
      g.fillStyle = '#4a5a3a'; g.fillRect(x + w * 0.1, y + h * 0.35, w * 0.8, h * 0.35);
      g.fillStyle = '#2b2d31'; g.fillRect(x + w * 0.3, y + h * 0.7, w * 0.15, h * 0.3);
      g.fillStyle = PAL.amber; g.fillRect(x + w * 0.85, y + h * 0.4, w * 0.08, h * 0.25);
      break;
    case 'sam':
      g.fillStyle = '#2b2d31'; g.fillRect(x + w * 0.35, y + h * 0.55, w * 0.3, h * 0.45);
      g.save(); g.translate(x + w * 0.5, y + h * 0.6); g.rotate(-0.6);
      g.fillStyle = '#4a5a3a';
      for (const o of [-0.22, 0.22]) g.fillRect(-w * 0.45, o * h - h * 0.09, w * 0.9, h * 0.18);
      g.restore();
      break;
    case 'radar_s': case 'radar_n': {
      g.fillStyle = '#2b2d31'; g.fillRect(x + w * 0.45, y + h * 0.4, w * 0.1, h * 0.6);
      g.strokeStyle = '#c9d1dc'; g.lineWidth = Math.max(1.5, cs * 0.12);
      g.beginPath(); g.arc(x + w / 2, y + h * 0.55, w * 0.42, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      if (d.id === 'radar_n') { g.fillStyle = shade(steel, 0.8); g.fillRect(x + w * 0.2, y + h * 0.75, w * 0.6, h * 0.25); }
      break;
    }
    case 'ecm':
      bevel(g, x, y, w, h, '#3d4552', 1);
      g.strokeStyle = PAL.amber; g.lineWidth = 1;
      g.beginPath();
      for (let k = 0; k <= 8; k++) { const px = x + w * (0.1 + k * 0.1), py = y + h * (k % 2 ? 0.3 : 0.7); if (k) g.lineTo(px, py); else g.moveTo(px, py); }
      g.stroke();
      break;
    case 'cradio':
      bevel(g, x, y, w, h, '#3f4a3a', 1);
      g.fillStyle = '#b8c28a'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + w * (0.2 + k * 0.15), y + h * 0.45, cs * 0.08, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = '#1b1d21'; g.lineWidth = Math.max(1, cs * 0.05);
      for (const f of [0.7, 0.85]) { g.beginPath(); g.moveTo(x + w * f, y + h * 0.2); g.lineTo(x + w * f - cs * 0.2, y - cs * 3.6); g.stroke(); }
      break;
    case 'gen':
      bevel(g, x, y, w, h, shade(steel, 0.8), 1);
      g.fillStyle = '#15181d'; g.beginPath(); g.arc(x + w * 0.3, y + h / 2, h * 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = PAL.amber; g.fillRect(x + w * 0.6, y + h * 0.35, w * 0.25, h * 0.3);
      break;
    case 'troop':
      bevel(g, x, y, w, h, shade(steel, 0.9), 1);
      g.fillStyle = '#12151a';
      for (let k = 0; k < 3; k++) g.fillRect(x + w * (0.12 + k * 0.28), y + h * 0.25, w * 0.18, h * 0.16);
      g.fillStyle = FACTION_MARK[side]; g.fillRect(x + w * 0.1, y + h * 0.7, w * 0.8, h * 0.08);
      break;
    case 'tank_c':
      g.fillStyle = '#56613a'; roundRect(g, x + w * 0.02, y + h * 0.1, w * 0.96, h * 0.8, h * 0.4); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
      for (const f of [0.33, 0.66]) { g.beginPath(); g.moveTo(x + w * f, y + h * 0.1); g.lineTo(x + w * f, y + h * 0.9); g.stroke(); }
      g.fillStyle = PAL.danger; g.fillRect(x + w * 0.42, y + h * 0.4, w * 0.16, h * 0.2);
      break;
    case 'repair':
      bevel(g, x, y, w, h, '#4a4f3a', 1);
      g.strokeStyle = PAL.linen; g.lineWidth = Math.max(1.5, cs * 0.12);
      g.beginPath(); g.moveTo(x + w * 0.3, y + h * 0.7); g.lineTo(x + w * 0.65, y + h * 0.35); g.stroke();
      g.beginPath(); g.arc(x + w * 0.7, y + h * 0.3, cs * 0.18, 0, Math.PI * 2); g.stroke();
      break;
    case 'crane':
      bevel(g, x, y, w, h, shade(steel, 0.8), 1);
      g.strokeStyle = '#2b2d31'; g.lineWidth = Math.max(1.5, cs * 0.12);
      g.beginPath(); g.moveTo(x + w * 0.2, y + h * 0.8); g.lineTo(x + w * 0.9, y - h * 0.3); g.lineTo(x + w * 0.9, y + h * 0.3); g.stroke();
      break;
    case 'blade':
      g.fillStyle = shade(steel, 0.7);
      g.beginPath(); g.moveTo(x + w * 0.6, y); g.quadraticCurveTo(x + w, y + h * 0.5, x + w * 0.7, y + h); g.lineTo(x, y + h); g.lineTo(x, y + h * 0.3); g.closePath(); g.fill();
      break;
    case 'bridge':
      g.fillStyle = shade(steel, 0.85); g.fillRect(x, y + h * 0.3, w, h * 0.4);
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1;
      g.beginPath(); for (let k = 0; k <= 8; k++) { g.moveTo(x + (w * k) / 8, y + h * 0.3); g.lineTo(x + (w * (k + 0.5)) / 8, y + h * 0.7); } g.stroke();
      break;
    case 'ramp':
      g.fillStyle = shade(steel, 0.85);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * 0.3, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); g.fill();
      break;
    case 'thrust':
      bevel(g, x, y, w, h, shade(steel, 0.8), 1);
      g.fillStyle = '#15181d'; g.beginPath(); g.arc(x + w / 2, y + h / 2, cs * 0.28, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#7c828d'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x + w / 2 - cs * 0.25, y + h / 2); g.lineTo(x + w / 2 + cs * 0.25, y + h / 2); g.stroke();
      break;
    case 'ngun':
      // Gun house; the twin barrels are drawn live.
      g.fillStyle = shade(steel, 0.8);
      g.beginPath();
      g.moveTo(x + w * 0.05, y + h); g.lineTo(x + w * 0.05, y + h * 0.45); g.quadraticCurveTo(x + w * 0.1, y + h * 0.15, x + w * 0.4, y + h * 0.15);
      g.lineTo(x + w * 0.8, y + h * 0.2); g.lineTo(x + w * 0.95, y + h * 0.5); g.lineTo(x + w * 0.95, y + h); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = Math.max(1, cs * 0.08);
      g.beginPath(); g.moveTo(x + w * 0.4, y + h * 0.15); g.lineTo(x + w * 0.8, y + h * 0.2); g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + w * 0.15, y + h * 0.6, w * 0.7, h * 0.08);
      rivets(g, x + w * 0.05, y + h * 0.3, w * 0.9, h * 0.7, r, 'rgba(0,0,0,0.45)');
      break;
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
    case 'fuel_s': case 'fuel_ss': case 'fuel_l':
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
  if (!art.get(d.id) && !NO_OUTLINE.has(d.id) && d.cat !== 'weapon') g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
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
  // Directorate vehicles get a light red wash, so imported art (painted in League colours)
  // still reads as enemy until faction paint masks arrive (design/07 §4).
  if (V.side === 1) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(170,45,30,0.16)';
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
  }
  return c;
}

function vehicleSprite(V, S) {
  const ppm = clamp(Math.round(S * 1.3 * layout.dpr), 10, 64);
  if (!V.sprite || V.dirty || V.sprite.artV !== art.version || Math.abs(V.sprite.ppm - ppm) / V.sprite.ppm > 0.3) {
    const idxs = [];
    V.parts.forEach((p, i) => { if (p.alive) idxs.push(i); });
    V.sprite = { canvas: paintParts(V, idxs, ppm, SPRITE_PAD), ppm, artV: art.version };
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
  if (V.gone) return;
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
  const tmp = { x: 0, y: 0 };
  if (art.debug) {
    for (const p of V.parts) {
      if (!p.alive || !art.get(p.def.id)) continue;
      gridToLocal(V, p.x * CELL, (V.design.h - p.y) * CELL, tmp);   // the image's origin pixel, mirrored with the vehicle
      localToWorld(V, tmp.x, tmp.y, tmp);
      drawArtMarker(g, 'origin', view.sx(tmp.x), view.sy(tmp.y));
    }
  }
  // Barrels, drawn live.
  for (const w of V.weapons) {
    if (!V.parts[w.part].alive || w.def.secondary) continue;
    const d = w.def;
    weaponPivot(V, w, tmp);
    const ang = w.angle !== undefined ? w.angle : angleFromElevation(V, 0, V.dir);
    const kick = (w.kick || 0) * 0.35;
    const L = barrelLength(d);
    const x0 = tmp.x - Math.cos(ang) * kick, y0 = tmp.y - Math.sin(ang) * kick;
    const x1 = x0 + Math.cos(ang) * L, y1 = y0 + Math.sin(ang) * L;
    if (drawBarrelArt(g, d, view.sx(x0), view.sy(y0), ang, L * view.S)) {
      if (art.debug) { drawArtMarker(g, 'pivot', view.sx(x0), view.sy(y0)); drawArtMarker(g, 'muzzle', view.sx(x1), view.sy(y1)); }
      continue;
    }
    if (art.debug) { drawArtMarker(g, 'pivot', view.sx(x0), view.sy(y0)); drawArtMarker(g, 'muzzle', view.sx(x1), view.sy(y1)); }
    g.strokeStyle = V.destroyed ? '#26282c' : '#30343b';
    g.lineCap = 'butt';
    for (let k = 0; k < (d.twin ? 2 : 1); k++) {
      const ox = d.twin ? -Math.sin(ang) * TWIN_GAP * (k ? -1 : 1) : 0, oy = d.twin ? Math.cos(ang) * TWIN_GAP * (k ? -1 : 1) : 0;
      g.lineWidth = Math.max(1.5, (d.auto ? 0.07 : 0.06 + d.cal / 900) * S);
      g.beginPath(); g.moveTo(view.sx(x0 + ox), view.sy(y0 + oy)); g.lineTo(view.sx(x1 + ox), view.sy(y1 + oy)); g.stroke();
      if (!d.auto && d.cal >= 75) {
        g.lineWidth = Math.max(2.5, (0.1 + d.cal / 700) * S);
        const bx = x1 - Math.cos(ang) * 0.3, by = y1 - Math.sin(ang) * 0.3;
        g.beginPath(); g.moveTo(view.sx(bx + ox), view.sy(by + oy)); g.lineTo(view.sx(x1 + ox), view.sy(y1 + oy)); g.stroke();
      }
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
    const bx = view.sx(s.x), by = view.sy(s.y);
    if (s.def.secondary === 'bomb') {
      // A falling bomb: body along its path, fins at the back.
      const a = Math.atan2(-s.vy, s.vx), S = view.S;
      g.save(); g.translate(bx, by); g.rotate(a);
      g.fillStyle = '#2d3036';
      g.beginPath(); g.ellipse(0, 0, 0.45 * S, 0.16 * S, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(-0.62 * S, -0.16 * S, 0.14 * S, 0.32 * S);
      g.restore();
      return;
    }
    const ax = view.sx(s.x - s.vx * 0.025), ay = view.sy(s.y - s.vy * 0.025);
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
      case FX_SPRAY:
        g.globalAlpha = 0.85 * (1 - k);
        g.fillStyle = '#DCEBF2';
        g.beginPath(); g.arc(x, y, Math.max(1, p.size * S * 0.5), 0, Math.PI * 2); g.fill();
        break;
      case FX_BUBBLE:
        g.globalAlpha = 0.6 * (1 - k);
        g.strokeStyle = '#CFE6F0'; g.lineWidth = 1;
        g.beginPath(); g.arc(x, y, Math.max(1, p.size * S), 0, Math.PI * 2); g.stroke();
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

// Flags for the hold zone and the depot; red circles where artillery will land.
function drawMarkers(g, B) {
  const flag = (x, col) => {
    const sx = view.sx(x), sy = view.sy(B.T.height(x));
    g.fillStyle = '#1b1d21'; g.fillRect(sx - 1, sy - 34, 2, 34);
    g.fillStyle = col;
    g.beginPath(); g.moveTo(sx + 1, sy - 34); g.lineTo(sx + 17, sy - 29); g.lineTo(sx + 1, sy - 24); g.closePath(); g.fill();
  };
  if (B.zone) {
    const a = view.sx(B.zone.x0), b = view.sx(B.zone.x1);
    g.fillStyle = 'rgba(255,178,62,0.08)';
    g.fillRect(a, 0, b - a, layout.h);
    flag(B.zone.x0, PAL.amber); flag(B.zone.x1, PAL.amber);
  }
  if (B.depot) flag(B.depot, PAL.league);
  g.setLineDash([5, 4]);
  g.lineWidth = 2;
  for (const w of B.warnings) {
    const sx = view.sx(w.x), sy = view.sy(B.T.height(w.x));
    const r = Math.max(10, 6 * view.S) * (0.8 + 0.2 * Math.sin(B.time * 10));
    g.strokeStyle = PAL.danger;
    g.beginPath(); g.ellipse(sx, sy, r, r * 0.35, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = PAL.danger; g.font = `700 14px ${FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillText('!', sx, sy - r * 0.4);
  }
  g.setLineDash([]);
}

// Rain streaks, dusk and night (design/03 §4 weather), in screen space.
function drawWeather(g, B) {
  const { w, h } = layout;
  if (B.cfg.light === 'dusk') { g.fillStyle = 'rgba(40,20,50,0.25)'; g.fillRect(0, 0, w, h); }
  if (B.cfg.light === 'night') { g.fillStyle = 'rgba(6,9,22,0.55)'; g.fillRect(0, 0, w, h); }
  if (B.cfg.weather === 'rain') {
    g.strokeStyle = 'rgba(200,210,230,0.28)';
    g.lineWidth = 1;
    g.beginPath();
    const t = B.time;
    for (let i = 0; i < 90; i++) {
      const x = ((i * 97.3 + t * 60) % (w + 40)) - 20;
      const y = ((i * 57.1 + t * 520) % (h + 40)) - 20;
      g.moveTo(x, y); g.lineTo(x - 4, y + 14);
    }
    g.stroke();
  }
}

// The sea (Part 2a): a translucent layer over everything below the surface, with a
// small moving swell on top and darker water further down. Drawn over the ships, so
// what sits below the waterline reads as under water.
function drawWater(g, B) {
  const T = B.T;
  if (T.seaX0 === undefined) return;
  const { w, h } = layout;
  const x0 = Math.max(-4, view.sx(T.seaX0));
  const sy = view.sy(T.sea);
  if (x0 > w || sy > h) return;
  const t = B.time;
  const S = view.S;
  const step = 10;
  const wave = (x) => sy - Math.sin(view.wx(x) * 0.45 + t * 1.6) * 0.14 * S - Math.sin(view.wx(x) * 0.17 - t * 0.9) * 0.08 * S;
  g.fillStyle = 'rgba(26,64,94,0.56)';
  g.beginPath();
  g.moveTo(x0, h);
  for (let x = x0; x <= w + step; x += step) g.lineTo(x, wave(x));
  g.lineTo(w + step, h);
  g.closePath();
  g.fill();
  const deep = view.sy(T.sea - 5);
  if (deep < h) { g.fillStyle = 'rgba(8,22,38,0.35)'; g.fillRect(x0, deep, w - x0 + step, h - deep); }
  g.strokeStyle = 'rgba(205,228,238,0.6)';
  g.lineWidth = 1.5;
  g.beginPath();
  for (let x = x0; x <= w + step; x += step) { if (x === x0) g.moveTo(x, wave(x)); else g.lineTo(x, wave(x)); }
  g.stroke();
}

// Whole battlefield, back to front (design/04 §3).
function renderBattle(g, B) {
  drawBackground(g, view.cx * view.S * 0.25);
  drawTrees(g, B);
  drawTerrain(g, B);
  drawMarkers(g, B);
  for (const V of B.units) {
    const visible = V.side === 0 || V.seen || (V.destroyed && V.everSeen) || B.revealAll;
    if (!visible) continue;
    const sx = view.sx(V.body.x);
    if (sx < -V.radius * 2 * view.S || sx > layout.w + V.radius * 2 * view.S) continue;
    drawVehicle(g, V);
  }
  drawDebris(g);
  drawUnderwater(g);
  drawWater(g, B);
  drawShells(g);
  drawMissiles(g);
  drawParticles(g);
  drawWeather(g, B);
}
