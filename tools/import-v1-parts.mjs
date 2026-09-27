#!/usr/bin/env node
// One-off bridge (design/06, step 2.5a): copies the parts and templates defined in
// src/js/07_data.js (PART_ROWS, WEAPON_STATS, TEMPLATES) into the part library:
//   src/parts/<category>/<id>.json   and   src/vehicles/<id>.json
// Numbers are copied exactly, so the game plays the same once it reads PART_LIBRARY.
// Existing JSON files keep their art fields (overhang, anchors, moving, upgrades, pros, cons, notes).
// Delete this script once 07_data.js no longer defines parts (after step 2.5b).
//   node tools/import-v1-parts.mjs            write files
//   node tools/import-v1-parts.mjs --dry      report only
import vm from 'node:vm';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry');
const src = readFileSync(join(ROOT, 'src/js/07_data.js'), 'utf8') +
  '\n;globalThis.__out = { PART_ROWS, WEAPON_STATS, TEMPLATES, PARTS };';
const ctx = { console, Math, Object, Array, JSON, Number, String, Set, Map };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const { PARTS, TEMPLATES } = ctx.__out;
const materials = JSON.parse(readFileSync(join(ROOT, 'src/parts/materials.json'), 'utf8'));

// Tier and unlock node (design/08 §11). Tier 0 parts are known from the start.
const TECH = {
  frame: [0], timber: [0], crew2: [0], turret: [0], keel: [0], prop: [0], aprop: [0], mg: [0], c37: [0],
  smoke: [0], optics: [0], fuel_s: [0], ammo: [0], cargo: [0],
  plate: [1, 'hull_iron'], arm20: [1, 'hull_iron'], hull: [1, 'hull_iron'], bow: [1, 'hull_iron'], bulk: [1, 'hull_iron'],
  eng_s: [1, 'prop_petrol'], radiator: [1, 'prop_petrol'], wheel_s: [1, 'prop_petrol'], wheel_l: [1, 'prop_petrol'],
  eng_m: [1, 'prop_diesel'], track: [1, 'prop_diesel'], hmg: [1, 'guns_medium'], c75: [1, 'guns_medium'],
  radio: [1, 'radio'], fc: [1, 'fire_control'], fuel_ss: [1, 'cargo_2'], ammo_p: [1, 'cargo_2'], fuel_l: [1, 'cargo_2'],
  arm40: [2, 'hull_heavy'], arm80: [2, 'hull_heavy'], slope40: [2, 'hull_heavy'],
  eng_h: [2, 'prop_heavy'], marine: [2, 'prop_heavy'], thrust: [2, 'prop_heavy'], turb: [2, 'prop_turbine'],
  ac20: [2, 'guns_heavy'], c105: [2, 'guns_heavy'], ngun: [2, 'guns_heavy'], aa40: [2, 'guns_heavy'], how: [2, 'guns_heavy'],
  phull: [2, 'submarines'], emotor: [2, 'submarines'], ballast: [2, 'submarines'], torp: [2, 'submarines'],
  dc: [2, 'sonar'], sonar: [2, 'sonar'], nsight: [2, 'radar'], stab: [2, 'stabiliser'],
  wing: [2, 'aviation'], tail: [2, 'aviation'], aero: [2, 'aviation'], bomb: [2, 'aviation'],
  rotor: [2, 'rotorcraft'], trotor: [2, 'rotorcraft'], jet: [3, 'jets'],
};
const LAND = ['wheel_s', 'wheel_l', 'track'];
const SEA = ['hull', 'bow', 'keel', 'phull', 'bulk', 'marine', 'prop', 'emotor', 'ballast', 'thrust', 'torp', 'dc', 'sonar'];
const AIRCRAFT = ['wing', 'tail', 'aero', 'jet', 'rotor', 'trotor', 'bomb'];
function domainsOf(id, d) {
  if (LAND.includes(id)) return ['land'];
  if (SEA.includes(id)) return ['sea'];
  if (AIRCRAFT.includes(id)) return ['aircraft'];
  if (id === 'aprop') return ['aircraft', 'airship'];
  if (id === 'ngun') return ['sea', 'land'];
  const all = ['land', 'sea', 'airship', 'aircraft'];
  return d.cat === 'weapon' ? [...all, 'wall'] : all;
}
// v2 resources: rubber and fuel are no longer crafting costs (rubber -> metal, fuel -> wood, 1:1,
// so the Requisition cost, which sums the amounts, is unchanged).
function convertCost(c) {
  const out = {};
  for (const [k, v] of Object.entries(c || {})) {
    const k2 = k === 'rubber' ? 'metal' : k === 'fuel' ? 'wood' : k;
    out[k2] = (out[k2] || 0) + v;
  }
  return out;
}
const TOP = new Set(['id', 'name', 'cat', 'w', 'h', 'cost']);

const report = { parts: 0, materials: 0, vehicles: 0, missingTech: [] };
for (const [id, d] of Object.entries(PARTS)) {
  if (materials[id]) {
    // 1x1 structure lives in materials.json; check it agrees with the game.
    const m = materials[id];
    for (const k of ['mass', 'hp', 'armor']) if (m[k] !== d[k]) console.log(`! materials.json ${id}.${k} = ${m[k]}, game has ${d[k]}`);
    report.materials++;
    continue;
  }
  const stats = {};
  const behaviour = {};
  for (const [k, v] of Object.entries(d)) {
    if (TOP.has(k)) continue;
    if (typeof v === 'number') stats[k] = v;
    else behaviour[k] = v;
  }
  const t = TECH[id];
  if (!t) report.missingTech.push(id);
  const [tier, tech] = t || [1, 'unassigned'];
  const file = join(ROOT, 'src/parts', d.cat, `${id}.json`);
  const old = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const rec = {
    id, name: d.name, family: id, variant: 'std', category: d.cat, tier,
    domains: domainsOf(id, d), footprint: { w: d.w, h: d.h },
    ...(old.overhang ? { overhang: old.overhang } : {}),
    ...(old.mount ? { mount: old.mount } : {}),
    ...(old.layer ? { layer: old.layer } : {}),
    ...(old.anchors ? { anchors: old.anchors } : {}),
    ...(old.moving ? { moving: old.moving } : {}),
    stats, ...(Object.keys(behaviour).length ? { behaviour } : {}),
    cost: convertCost(d.cost),
    craftAt: tier >= 3 ? 'metropolis' : 'city',
    unlock: tier === 0 ? { start: true } : { tech },
    pros: old.pros || [], cons: old.cons || [],
    ...(old.upgrades ? { upgrades: old.upgrades } : {}),
    notes: old.notes || 'Imported from v1 07_data.js.',
  };
  if (!dry) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(rec, null, 2) + '\n'); }
  report.parts++;
}

function vehicleDomain(t) {
  let wing = false, sub = false, sealed = false, rotor = false;
  for (const [p] of t.cells) {
    const d = PARTS[p];
    if (!d) continue;
    if (d.rotor) rotor = true;
    if (d.lift) wing = true;
    if (d.ballast) sub = true;
    if (d.sealed) sealed = true;
  }
  return rotor || wing ? 'aircraft' : sub || sealed ? 'sea' : 'land';
}
const classes = JSON.parse(readFileSync(join(ROOT, 'src/parts/classes.json'), 'utf8'));
for (const [id, t] of Object.entries(TEMPLATES)) {
  const domain = vehicleDomain(t);
  const cls = classes[domain].find((c) => t.w <= c.grid[0] && t.h <= c.grid[1]);
  const rec = { id, name: t.name, domain, class: cls ? cls.id : '?', w: t.w, h: t.h };
  for (const k of Object.keys(t)) if (!['name', 'w', 'h', 'cells'].includes(k)) rec[k] = t[k];
  rec.source = 'v1 template (07_data.js TEMPLATES)';
  rec.cells = t.cells;
  const file = join(ROOT, 'src/vehicles', `${id}.json`);
  const cells = rec.cells.map((c) => '    ' + JSON.stringify(c)).join(',\n');
  const head = JSON.stringify({ ...rec, cells: '__CELLS__' }, null, 2).replace('"__CELLS__"', `[\n${cells}\n  ]`);
  if (!dry) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, head + '\n'); }
  report.vehicles++;
}
console.log(`${dry ? 'Would write' : 'Wrote'} ${report.parts} parts and ${report.vehicles} vehicles; ${report.materials} parts are materials.json cells.`);
if (report.missingTech.length) console.log('No tier assigned (set in TECH): ' + report.missingTech.join(', '));
