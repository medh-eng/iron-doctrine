#!/usr/bin/env node
// Step 2.5a check: builds the game part table from PART_LIBRARY the way the adapter does (design/04 §9)
// and compares it with PART_ROWS/WEAPON_STATS/TEMPLATES in src/js/07_data.js. Expect 0 differences.
// Run it BEFORE removing those tables from 07_data.js; delete it together with import-v1-parts.mjs.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { loadLibrary } from './part-lib.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'));
const src = readFileSync('src/js/07_data.js', 'utf8') + '\n;globalThis.__out = { PARTS, TEMPLATES };';
const ctx = { console, Math, Object, Array, JSON }; vm.createContext(ctx); vm.runInContext(src, ctx);
const { PARTS, TEMPLATES } = ctx.__out;
const { lib } = loadLibrary('.');
// The adapter described in design/04 §9.
const P2 = {};
for (const [id, m] of Object.entries(lib.materials)) {
  if (m.planned) continue;
  const { name, mass, hp, armor, cost, burns, shape } = m;
  P2[id] = { id, name, cat: 'structure', w: 1, h: 1, mass, hp, armor, power: 0, rel: 0.998, cost, ...(burns ? { burns } : {}), ...(shape === 'slope' ? { sloped: true } : {}) };
}
for (const [id, d] of Object.entries(lib.parts)) P2[id] = { id, name: d.name, cat: d.category, w: d.footprint.w, h: d.footprint.h, cost: d.cost, ...d.stats, ...(d.behaviour || {}) };
const sum = (c) => Object.values(c || {}).reduce((a, b) => a + b, 0);
let diffs = 0;
for (const [id, a] of Object.entries(PARTS)) {
  const b = P2[id];
  if (!b) { console.log('missing', id); diffs++; continue; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k === 'cost') { if (sum(a.cost) !== sum(b.cost)) { console.log(id, 'cost total', sum(a.cost), sum(b.cost)); diffs++; } continue; }
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) { console.log(id, k, a[k], b[k]); diffs++; }
  }
}
const extra = Object.keys(P2).filter((k) => !PARTS[k]);
let tdiff = 0;
for (const [id, t] of Object.entries(TEMPLATES)) { const v = lib.vehicles[id]; if (JSON.stringify(t.cells) !== JSON.stringify(v.cells) || t.w !== v.w || t.h !== v.h) { console.log('template', id); tdiff++; } }
console.log(`parts compared: ${Object.keys(PARTS).length}, differences: ${diffs}; extra in library (new v2 cells): ${extra.join(', ')}; template differences: ${tdiff}`);
