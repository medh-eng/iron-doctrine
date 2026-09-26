// Iron Doctrine part library: loads, validates and balance-checks src/parts and src/vehicles.
// Used by build.mjs, tools/check-parts.mjs and tools/preview-parts.mjs. Rules: design/07 and design/08.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename, extname, relative, sep } from 'node:path';

export const CELL = 32;
export const TOKENS = { p1: '#FF00FF', p2: '#00FFFF', p3: '#FFFF00' };
export const PALETTE = {
  outline: '#14171B', steel_dark: '#2E3339', gunmetal: '#3A3F45', steel_lo: '#4F565E', steel: '#8A9199',
  steel_hi: '#C4CAD0', heavy: '#4A4E55', heavy_hi: '#6B7079', alloy: '#B7C3CF', alloy_lo: '#8E9BA8',
  rubber: '#23201E', rubber_hi: '#4A4540', brass: '#C9A04A', brass_lo: '#8A6A2A', copper: '#B8733F',
  glass: '#7FB7C9', glass_hi: '#D8F0F7', wood: '#A8743F', wood_lo: '#6E4A26', wood_hi: '#CF9D63',
  wood_dark: '#8E6035', canvas: '#B9A77A', canvas_lo: '#857650', canvas_hi: '#D8CCAA', rust: '#9A4E2A',
  rust_hi: '#C2713D', oil: '#1B1712', soot: '#2A2622', precursor: '#2B3440', precursor_glow: '#4FD1C5',
  energy_hot: '#FFE08A', plasma: '#B784FF', lamp_amber: '#FFB23E', lamp_red: '#E0533D', lamp_green: '#7BC47F',
  white: '#FFFFFF', black: '#000000',
};
const ALLOWED_COLOURS = new Set([...Object.values(PALETTE), ...Object.values(TOKENS)].map((c) => c.toUpperCase()));

export const CATEGORIES = ['mobility', 'lift', 'weapon', 'missile', 'system', 'logistics', 'crew', 'special'];
export const MOVING_ROLES = ['barrel', 'turret', 'wheel', 'rotor', 'prop', 'radar', 'track', 'door'];
export const DOMAINS = ['land', 'sea', 'air', 'drone', 'missile'];
export const COST_KEYS = ['wood', 'metal', 'elec', 'scrap', 'money'];
// Market reference prices (design/08 §6). Cost index = sum(amount x price).
export const PRICE = { wood: 4, metal: 10, elec: 40, scrap: 3, money: 1 };
// Balance weights per category (design/08 §2). Negative = lower is better.
export const WEIGHTS = {
  weapon: { pen: 3, damage: 2, reload: -2, range: 1, accuracy: 2, mass: -1, hp: 0.5, draw: -1, heat: -1, reliability: 1 },
  mobility: { power: 3, thrust: 3, mass: -1.5, fuel: -1.5, heat: -1, reliability: 1, hp: 0.5, speedCap: 1, load: 1, grip: 1 },
  lift: { lift: 3, mass: -1, hp: 1, draw: -1, fuel: -1, reliability: 1 },
  missile: { damage: 2, speed: 1, range: 1, turn: 1, mass: -1, hp: 0.5 },
  system: { effect: 3, range: 1, draw: -1, mass: -1, hp: 0.5, heat: -1, reliability: 1 },
  logistics: { capacity: 3, mass: -1, hp: 1, fireChance: -1, detChance: -1 },
  crew: { crewSlots: 2, armor: 1, hp: 1, mass: -1 },
  special: { effect: 3, rate: 2, capacity: 1, draw: -1, mass: -1, hp: 0.5, reliability: 1 },
};
export const BANDS = {
  variant: { p: [0.9, 1.15], value: [0.88, 1.12] },
  mk2: { p: [1.06, 1.2], cost: 1.3 },
  mk3: { p: [1.15, 1.38], cost: 1.7 },
};

const clampR = (r) => Math.max(0.25, Math.min(4, r));
export const costIndex = (cost = {}) => Object.entries(cost).reduce((t, [k, v]) => t + (PRICE[k] || 0) * v, 0);

// Performance index of `stats` relative to `base` stats, using the category weights.
export function perfIndex(category, stats, base) {
  const w = WEIGHTS[category] || {};
  let num = 0;
  let den = 0;
  const ratios = {};
  for (const [k, wt] of Object.entries(w)) {
    let s = stats[k];
    let b = base[k];
    if (typeof s !== 'number' || typeof b !== 'number') continue;
    let r;
    if (k === 'reliability') {
      s = 1 - s; b = 1 - b;
      if (s <= 0 || b <= 0) continue;
      r = clampR(b / s);
    } else {
      if (s <= 0 || b <= 0) continue;
      r = clampR(wt > 0 ? s / b : b / s);
    }
    ratios[k] = r;
    num += Math.abs(wt) * r;
    den += Math.abs(wt);
  }
  return { p: den ? num / den : 1, ratios };
}

// Apply an upgrade option: mods multiply (reliability mods multiply the failure rate), adds add.
export function applyUpgrade(stats, opt) {
  const out = { ...stats };
  for (const [k, m] of Object.entries(opt.mods || {})) {
    if (typeof out[k] !== 'number') continue;
    out[k] = k === 'reliability' ? 1 - (1 - out[k]) / m : out[k] * m;
  }
  for (const [k, a] of Object.entries(opt.adds || {})) out[k] = (out[k] || 0) + a;
  return out;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function readJson(path, errors) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch (e) { errors.push(`${path}: invalid JSON (${e.message})`); return null; }
}

export function expandCells(v) {
  const out = [];
  for (const c of v.cells || []) {
    const w = c.w || 1;
    const h = c.h || 1;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push({ m: c.m, x: c.x + dx, y: c.y + dy, o: c.o });
  }
  return out;
}

function checkSvg(id, svg, def, where, errors, warnings) {
  const E = (m) => errors.push(`${where}: ${m}`);
  if (!/^\s*<svg[\s>]/.test(svg)) E('must start with <svg');
  if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) E('missing xmlns');
  if (!new RegExp(`data-part="${id}"`).test(svg)) E(`data-part must be "${id}"`);
  if (!/data-cell="32"/.test(svg)) E('data-cell must be "32"');
  const vb = svg.match(/viewBox="([^"]+)"/);
  if (!vb) E('missing viewBox');
  else if (def && def.footprint) {
    const [x, y, w, h] = vb[1].trim().split(/[\s,]+/).map(Number);
    const o = def.overhang || {};
    const want = [-(o.left || 0) * CELL, -(o.top || 0) * CELL,
      (def.footprint.w + (o.left || 0) + (o.right || 0)) * CELL, (def.footprint.h + (o.top || 0) + (o.bottom || 0)) * CELL];
    const got = [x, y, w, h];
    if (got.some((v, i) => Math.abs(v - want[i]) > 0.01)) E(`viewBox "${vb[1]}" should be "${want.join(' ')}" (footprint + overhang x 32)`);
  }
  if (!/<g\s+id="body"/.test(svg)) E('missing <g id="body">');
  const bad = svg.match(/<(image|text|script|foreignObject|filter|style|use\s[^>]*href="http)[\s>]/i);
  if (bad) E(`forbidden element <${bad[1]}>`);
  if (/(href|xlink:href)="(?!#)/.test(svg)) E('external href (only #local references allowed)');
  if (/url\((?!#)/.test(svg)) E('external url() (only url(#id) allowed)');
  if (/\son[a-z]+=/i.test(svg)) E('event handler attributes are not allowed');
  const colours = svg.match(/#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/g) || [];
  const off = [...new Set(colours.map((c) => c.toUpperCase()).filter((c) => !ALLOWED_COLOURS.has(c)))];
  if (off.length) E(`colours not in the palette: ${off.join(', ')}`);
  const stops = svg.match(/<(linear|radial)Gradient[\s\S]*?<\/\1Gradient>/g) || [];
  for (const g of stops) if ((g.match(/<stop/g) || []).length > 5) E('gradients may have at most 5 stops');
  const area = def && def.footprint ? def.footprint.w * def.footprint.h : 1;
  const limit = area >= 12 ? 28 * 1024 : 16 * 1024;
  const bytes = Buffer.byteLength(svg);
  if (bytes > limit) E(`file is ${(bytes / 1024).toFixed(1)} KB (limit ${limit / 1024} KB)`);
  const roles = [...svg.matchAll(/data-role="([a-z]+)"/g)].map((m) => m[1]);
  for (const r of roles) if (!MOVING_ROLES.includes(r)) E(`unknown data-role "${r}"`);
  const groups = [...svg.matchAll(/<g\s+id="([a-z0-9_]+)"\s+data-role="([a-z]+)"([^>]*)>/g)];
  for (const g of groups) if (!/data-pivot="[-\d.]+ [-\d.]+"/.test(g[3])) E(`moving group "${g[1]}" needs data-pivot="x y"`);
  const svgMoving = groups.map((g) => g[1]).sort();
  const jsonMoving = Object.keys((def && def.moving) || {}).sort();
  if (svgMoving.join() !== jsonMoving.join()) E(`moving groups in SVG [${svgMoving}] must match JSON "moving" [${jsonMoving}]`);
  if (!/class="paint"/.test(svg)) warnings.push(`${where}: no class="paint" group (fine only for bare-metal parts)`);
}

function checkPartJson(d, file, folder, errors, warnings) {
  const where = file;
  const E = (m) => errors.push(`${where}: ${m}`);
  for (const k of ['id', 'name', 'family', 'variant', 'category', 'tier', 'domains', 'footprint', 'stats', 'cost', 'pros', 'cons']) {
    if (d[k] === undefined) E(`missing "${k}"`);
  }
  if (d.id !== basename(file, '.json')) E(`id "${d.id}" must match file name`);
  if (!CATEGORIES.includes(d.category)) E(`category must be one of ${CATEGORIES.join(', ')}`);
  else if (folder !== d.category) E(`file must live in src/parts/${d.category}/`);
  if (!(Number.isInteger(d.tier) && d.tier >= 0 && d.tier <= 4)) E('tier must be 0-4');
  if (!Array.isArray(d.domains) || !d.domains.length || d.domains.some((x) => !DOMAINS.includes(x))) E(`domains must be from ${DOMAINS.join(', ')}`);
  const f = d.footprint || {};
  if (!(Number.isInteger(f.w) && f.w >= 1 && Number.isInteger(f.h) && f.h >= 1)) E('footprint w/h must be whole numbers >= 1');
  for (const k of Object.keys(d.cost || {})) if (!COST_KEYS.includes(k)) E(`unknown cost key "${k}"`);
  for (const [k, v] of Object.entries(d.stats || {})) if (typeof v !== 'number') E(`stat "${k}" must be a number`);
  if (d.stats && d.stats.mass === undefined) E('stats.mass is required');
  if (d.stats && d.stats.hp === undefined) E('stats.hp is required');
  if (!Array.isArray(d.pros) || !Array.isArray(d.cons)) E('pros and cons must be arrays');
  if (d.variant !== 'std' && (!(d.pros || []).length || !(d.cons || []).length)) E('variants need at least one pro and one con');
  const o = d.overhang || {};
  const minX = -(o.left || 0); const maxX = f.w + (o.right || 0);
  const minY = -(o.top || 0); const maxY = f.h + (o.bottom || 0);
  const pts = [];
  for (const [name, a] of Object.entries(d.anchors || {})) {
    const list = Array.isArray(a[0]) ? a : [a];
    for (const p of list) pts.push([name, p]);
  }
  for (const m of Object.values(d.moving || {})) if (m.pivot) pts.push(['pivot', m.pivot]);
  for (const [name, [x, y]] of pts) {
    if (!(x >= minX && x <= maxX && y >= minY && y <= maxY)) E(`anchor "${name}" [${x}, ${y}] is outside the drawing area`);
  }
  for (const u of d.upgrades || []) {
    if (![2, 3].includes(u.mark)) E('upgrade mark must be 2 or 3');
    if (!Array.isArray(u.options) || u.options.length < 2) warnings.push(`${where}: Mk ${u.mark} should offer 2 options (branches, not a ladder)`);
  }
}

function checkVehicle(v, file, lib, classes, errors, warnings) {
  const E = (m) => errors.push(`${file}: ${m}`);
  for (const k of ['id', 'name', 'domain', 'class', 'cells', 'parts']) if (v[k] === undefined) E(`missing "${k}"`);
  if (v.id !== basename(file, '.json')) E(`id "${v.id}" must match file name`);
  const cls = (classes[v.domain] || []).find((c) => c.id === v.class);
  if (!cls) { E(`unknown class "${v.class}" for domain "${v.domain}"`); return; }
  const occ = new Map();
  const mark = (x, y, what) => {
    if (x < 0 || y < 0 || x >= cls.grid[0] || y >= cls.grid[1]) E(`${what} at ${x},${y} is outside the ${cls.name} grid ${cls.grid.join('x')}`);
    const k = x + ',' + y;
    if (occ.has(k)) E(`${what} overlaps ${occ.get(k)} at ${x},${y}`);
    else occ.set(k, what);
  };
  for (const c of expandCells(v)) {
    if (!lib.materials[c.m]) E(`unknown material "${c.m}"`);
    mark(c.x, c.y, c.m);
  }
  if ((v.parts || []).length > cls.parts) E(`${v.parts.length} parts exceeds the ${cls.name} limit of ${cls.parts}`);
  for (const p of v.parts || []) {
    const def = lib.parts[p.p];
    if (!def) { E(`unknown part "${p.p}"`); continue; }
    if (!def.domains.includes(v.domain)) warnings.push(`${file}: part ${p.p} is not listed for domain ${v.domain}`);
    for (let dy = 0; dy < def.footprint.h; dy++) for (let dx = 0; dx < def.footprint.w; dx++) mark(p.x + dx, p.y + dy, p.p);
  }
}

export function vehicleSummary(v, lib) {
  let mass = 0; let mx = 0; let my = 0; let cost = 0; let cells = 0;
  const add = (m, x, y) => { mass += m; mx += m * x; my += m * y; };
  for (const c of expandCells(v)) {
    const m = lib.materials[c.m]; if (!m) continue;
    cells++; add(m.mass, c.x + 0.5, c.y + 0.5); cost += costIndex(m.cost);
  }
  for (const p of v.parts || []) {
    const d = lib.parts[p.p]; if (!d) continue;
    add(d.stats.mass, p.x + d.footprint.w / 2, p.y + d.footprint.h / 2); cost += costIndex(d.cost);
  }
  return { mass, com: mass ? [mx / mass, my / mass] : [0, 0], cost, cells, parts: (v.parts || []).length };
}

// Balance report: variants vs family base (variant "std"), upgrades vs their own part.
export function balanceReport(lib) {
  const rows = [];
  const warnings = [];
  const bases = {};
  for (const d of Object.values(lib.parts)) if (d.variant === 'std') bases[d.family] = d;
  for (const d of Object.values(lib.parts)) {
    const c = costIndex(d.cost);
    const base = bases[d.family];
    let p = 1; let value = 1;
    if (base && base !== d) {
      p = perfIndex(d.category, d.stats, base.stats).p;
      const cr = c / Math.max(1, costIndex(base.cost));
      value = p / cr;
      const b = BANDS.variant;
      const flag = p < b.p[0] || p > b.p[1] || value < b.value[0] || value > b.value[1];
      if (flag && !d.balanceNote) warnings.push(`${d.id}: variant outside band (P ${p.toFixed(2)}, value ${value.toFixed(2)}); tune or add "balanceNote"`);
      const r = perfIndex(d.category, d.stats, base.stats).ratios;
      if (!Object.values(r).some((x) => x >= 1.08) || !Object.values(r).some((x) => x <= 0.93)) {
        if (!d.balanceNote) warnings.push(`${d.id}: needs a real pro (a stat >= +8%) and a real con (a stat <= -7%) vs ${base.id}`);
      }
    } else if (!base) {
      warnings.push(`${d.id}: family "${d.family}" has no "std" base part yet`);
    }
    rows.push({ id: d.id, family: d.family, variant: d.variant, tier: d.tier, p, cost: c, value });
    for (const u of d.upgrades || []) {
      const band = u.mark === 2 ? BANDS.mk2 : BANDS.mk3;
      for (const opt of u.options || []) {
        const up = perfIndex(d.category, applyUpgrade(d.stats, opt), d.stats).p;
        const cr = (c + costIndex(opt.cost)) / Math.max(1, c);
        const ok = up >= band.p[0] && up <= band.p[1] && cr >= band.cost;
        if (!ok && !opt.balanceNote) warnings.push(`${d.id} Mk ${u.mark} "${opt.id}": P ${up.toFixed(2)} (want ${band.p.join('-')}), cost x${cr.toFixed(2)} (want >= ${band.cost})`);
        rows.push({ id: `${d.id} Mk${u.mark}:${opt.id}`, family: d.family, variant: d.variant, tier: d.tier, p: up, cost: c + costIndex(opt.cost), value: up / cr });
      }
    }
  }
  return { rows, warnings };
}

export function loadLibrary(root) {
  const errors = [];
  const warnings = [];
  const partsDir = join(root, 'src', 'parts');
  const vehDir = join(root, 'src', 'vehicles');
  const lib = { materials: {}, paints: {}, classes: {}, parts: {}, svg: {}, vehicles: {} };
  if (!existsSync(partsDir)) return { lib, errors, warnings };

  for (const [key, file] of [['materials', 'materials.json'], ['paints', 'paints.json'], ['classes', 'classes.json']]) {
    const p = join(partsDir, file);
    if (existsSync(p)) {
      const d = readJson(p, errors);
      if (d) { delete d._about; lib[key] = d; }
    } else errors.push(`src/parts/${file} is missing`);
  }

  const files = walk(partsDir).filter((p) => extname(p) === '.json' && relative(partsDir, p).includes(sep));
  for (const file of files) {
    const rel = relative(root, file);
    const folder = relative(partsDir, file).split(sep)[0];
    const d = readJson(file, errors);
    if (!d) continue;
    checkPartJson(d, rel, folder, errors, warnings);
    if (lib.parts[d.id]) errors.push(`${rel}: duplicate id "${d.id}"`);
    lib.parts[d.id] = d;
    const svgPath = file.replace(/\.json$/, '.svg');
    if (!existsSync(svgPath)) { errors.push(`${rel}: matching .svg file is missing`); continue; }
    const svg = readFileSync(svgPath, 'utf8');
    checkSvg(d.id, svg, d, relative(root, svgPath), errors, warnings);
    lib.svg[d.id] = svg.trim();
  }
  for (const svgPath of walk(partsDir).filter((p) => extname(p) === '.svg')) {
    if (!existsSync(svgPath.replace(/\.svg$/, '.json'))) errors.push(`${relative(root, svgPath)}: matching .json file is missing`);
  }

  for (const file of walk(vehDir).filter((p) => extname(p) === '.json')) {
    const v = readJson(file, errors);
    if (!v) continue;
    checkVehicle(v, relative(root, file), lib, lib.classes, errors, warnings);
    lib.vehicles[v.id] = v;
  }
  return { lib, errors, warnings };
}
