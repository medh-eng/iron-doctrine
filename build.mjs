#!/usr/bin/env node
// Iron Doctrine build: turns src/ into a small static site.
//   node build.mjs          -> docs/        (release, served by GitHub Pages)
//   node build.mjs --test   -> build-test/  (test hooks included)
// Output: index.html, game.js, game.css, assets/, manifest.webmanifest and icons.
// Uses only Node built-ins, so no npm install is needed to build.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, copyFileSync, statSync, cpSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { png as writePng, pngInfo } from './tools/png.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const TEST = process.argv.includes('--test');
const OUT_DIR = join(ROOT, TEST ? 'build-test' : 'docs');

const read = (p) => readFileSync(p, 'utf8');
const fail = (msg) => { console.error('\nBUILD FAILED: ' + msg + '\n'); process.exit(1); };

// ---------- 1. JavaScript: every src/js/*.js in filename order, inside one strict IIFE
const jsDir = join(SRC, 'js');
const jsFiles = readdirSync(jsDir).filter((f) => f.endsWith('.js')).sort();
if (!jsFiles.length) fail('no files in src/js');

let js = jsFiles.map((f) => `/* ---------- ${f} ---------- */\n${read(join(jsDir, f))}`).join('\n');
const TEST_BLOCK = /\/\*TEST:BEGIN\*\/[\s\S]*?\/\*TEST:END\*\//g;
if (!TEST) js = js.replace(TEST_BLOCK, '');
// ---------- 1b. Part art (design/07): every src/assets/parts/**/<name>.json describes one image.
// The build checks each record against its PNG and embeds the list as ART_MANIFEST.
// Placeholders (folder _placeholder) go into test builds only.
const partsDir = join(SRC, 'assets', 'parts');
const artManifest = [];
const ART_STATUS = ['placeholder', 'raw-generated', 'prepared', 'visually-approved', 'integration-tested'];
if (existsSync(partsDir)) {
  for (const rel of readdirSync(partsDir, { recursive: true })) {
    if (!String(rel).endsWith('.json')) continue;
    const isPlaceholder = String(rel).startsWith('_placeholder');
    if (isPlaceholder && !TEST) continue;
    const where = `src/assets/parts/${rel}`;
    let m;
    try { m = JSON.parse(read(join(partsDir, rel))); } catch (e) { fail(`${where} is not valid JSON: ${e.message}`); }
    for (const k of ['artId', 'part', 'revision', 'status', 'pxPerCell', 'footprint', 'canvas', 'origin', 'file']) {
      if (m[k] === undefined) fail(`${where} is missing "${k}"`);
    }
    if (!ART_STATUS.includes(m.status)) fail(`${where}: status must be one of ${ART_STATUS.join(', ')}`);
    const dir = dirname(join(partsDir, rel));
    const checkPng = (file, size, label) => {
      const p = join(dir, file);
      if (!existsSync(p)) fail(`${where}: ${label} file ${file} not found`);
      const info = pngInfo(readFileSync(p));
      if (!info) fail(`${where}: ${file} is not a PNG`);
      if (!info.hasAlpha) fail(`${where}: ${file} has no alpha channel (transparent background needed)`);
      if (info.width !== size[0] || info.height !== size[1]) fail(`${where}: ${file} is ${info.width}×${info.height}, the record says ${size[0]}×${size[1]}`);
    };
    checkPng(m.file, m.canvas, 'image');
    if (m.damaged) checkPng(m.damaged, m.canvas, 'damaged image');
    if (m.barrel) {
      for (const k of ['file', 'canvas', 'pivot', 'muzzle']) if (m.barrel[k] === undefined) fail(`${where}: barrel is missing "${k}"`);
      checkPng(m.barrel.file, m.barrel.canvas, 'barrel');
    }
    const base = 'assets/parts/' + relative(partsDir, dir).split('\\').join('/');
    const url = (f) => `${base}/${f}`.replace('//', '/');
    artManifest.push(Object.assign({}, m, { file: url(m.file), damaged: m.damaged ? url(m.damaged) : undefined,
      barrel: m.barrel ? Object.assign({}, m.barrel, { file: url(m.barrel.file) }) : undefined }));
  }
}
// Later revisions come last, so they win when the game maps part → image.
artManifest.sort((a, b) => a.part.localeCompare(b.part) || String(a.revision).localeCompare(String(b.revision)));
js = `const ART_MANIFEST = ${JSON.stringify(artManifest)};\n` + js;
js = `(() => {\n'use strict';\n${js}\n})();\n`;
const version = (js.match(/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] || '0';

// ---------- 2. CSS: url(assets/<file>) stays relative; the files are copied next to it
const css = read(join(SRC, 'styles.css'));
const assetsDir = join(SRC, 'assets');
const assets = existsSync(assetsDir) ? readdirSync(assetsDir).filter((f) => !f.startsWith('.') && statSync(join(assetsDir, f)).isFile()) : [];
for (const m of css.matchAll(/url\((['"]?)assets\/([^'")]+)\1\)/g)) {
  if (!assets.includes(m[2])) fail(`missing asset src/assets/${m[2]}`);
}

// ---------- 3. Icons: drawn in code and written as PNG (no image tools needed)
// Icon: a tank silhouette on a dusk sky with an amber tracer. Kept inside the
// central 80% so it also works as a maskable (cropped) icon.
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const SKY = [hex('#2F2946'), hex('#8A4B5A'), hex('#D9855A'), hex('#F2C17A')];
const NIGHT = hex('#1A1C24'), AMBER = hex('#FFB23E'), RIDGE = hex('#3B3F52');
function iconPixel(u, v) {
  const inBox = (x0, y0, x1, y1) => u >= x0 && u <= x1 && v >= y0 && v <= y1;
  const tracerDist = Math.abs((v - 0.36) - (u - 0.66) * -0.28);
  if (u > 0.66 && u < 0.86 && tracerDist < 0.012) return AMBER;
  if (v > 0.66) return NIGHT;
  // Tank: hull, turret, barrel, tracks.
  if (inBox(0.22, 0.52, 0.72, 0.62)) return NIGHT;
  if (v >= 0.45 && v <= 0.52 && u >= 0.25 + (0.52 - v) * 0.6 && u <= 0.74 - (0.52 - v) * 1.2) return NIGHT;
  if (inBox(0.36, 0.37, 0.56, 0.46)) return NIGHT;
  if (inBox(0.55, 0.395, 0.8, 0.42)) return NIGHT;
  if (inBox(0.18, 0.62, 0.8, 0.66)) return NIGHT;
  const ridge = 0.6 + 0.05 * Math.sin(u * 9 + 1) + 0.03 * Math.sin(u * 23);
  if (v > ridge) return RIDGE;
  const t = Math.min(v / 0.66, 0.999) * 3;
  const i = Math.floor(t), f = t - i;
  return SKY[i].map((c, k) => c + (SKY[i + 1][k] - c) * f);
}

// ---------- 4. index.html and manifest
const hooks = TEST ? '<script src="test-hooks.js"></script>' : '';
let html = read(join(SRC, 'index.template.html'));
for (const ph of ['<!--TEST_HOOKS-->', '__VERSION__']) {
  if (!html.includes(ph)) fail(`template placeholder ${ph} missing in src/index.template.html`);
}
html = html.replace('<!--TEST_HOOKS-->', () => hooks).replaceAll('__VERSION__', version);

const manifest = JSON.stringify({
  name: 'Iron Doctrine',
  short_name: 'Iron Doctrine',
  description: 'Design your war machines, keep them supplied, and fight the battles yourself.',
  start_url: './',
  scope: './',
  display: 'fullscreen',
  orientation: 'landscape',
  background_color: '#1A1C24',
  theme_color: '#1A1C24',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2);

// ---------- 5. Checks
// 5a. Syntax check the bundled script
const tmp = join(tmpdir(), `iron-doctrine-check-${process.pid}.js`);
writeFileSync(tmp, js);
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
} catch (e) {
  fail('JavaScript syntax error:\n' + (e.stderr ? e.stderr.toString() : e.message));
}
const texts = { 'index.html': html, 'game.js': js, 'game.css': css, 'manifest.webmanifest': manifest };

// 5b. No test code in release
if (!TEST) {
  for (const [name, text] of Object.entries(texts)) {
    if (/__TEST__|__GAME__|TEST:BEGIN|TEST:END|test-hooks/.test(text)) {
      fail(`test code found in the release build (${name}); keep it between /*TEST:BEGIN*/ and /*TEST:END*/`);
    }
  }
}

// 5c. No requests to other websites (the SVG/XML namespace is allowed)
const ALLOWED = ['http://www.w3.org/'];
for (const [name, text] of Object.entries(texts)) {
  const urls = [...new Set((text.match(/https?:\/\/[^\s"'<>)\\]+/g) || []))]
    .filter((u) => !ALLOWED.some((a) => u.startsWith(a)));
  if (urls.length) fail(`external URLs found in ${name} (the game must not load anything from other sites):\n  ` + urls.join('\n  '));
}

// ---------- 6. Write
mkdirSync(OUT_DIR, { recursive: true });
rmSync(join(OUT_DIR, 'assets'), { recursive: true, force: true });
mkdirSync(join(OUT_DIR, 'assets'), { recursive: true });
for (const [name, text] of Object.entries(texts)) writeFileSync(join(OUT_DIR, name), text);
for (const f of assets) copyFileSync(join(assetsDir, f), join(OUT_DIR, 'assets', f));
if (existsSync(partsDir)) {
  cpSync(partsDir, join(OUT_DIR, 'assets', 'parts'), {
    recursive: true,
    filter: (src) => TEST || !relative(partsDir, src).startsWith('_placeholder'),
  });
}
const icon = (size) => writePng(size, size, (u, v) => [...iconPixel(u, v), 255]);
writeFileSync(join(OUT_DIR, 'icon-192.png'), icon(192));
writeFileSync(join(OUT_DIR, 'icon-512.png'), icon(512));
writeFileSync(join(OUT_DIR, 'apple-touch-icon.png'), icon(180));
if (TEST) copyFileSync(join(ROOT, 'tests', 'test-hooks.js'), join(OUT_DIR, 'test-hooks.js'));
else rmSync(join(OUT_DIR, 'test-hooks.js'), { force: true });

let total = 0;
for (const f of readdirSync(OUT_DIR, { recursive: true })) {
  const p = join(OUT_DIR, f);
  if (statSync(p).isFile()) total += statSync(p).size;
}
if (total > 25 * 1024 * 1024) fail(`site is ${(total / 1048576).toFixed(1)} MB (limit 25 MB)`);

console.log(
  `Built ${TEST ? 'TEST' : 'release'} v${version}: ${relative(ROOT, OUT_DIR)}/ ` + `(${artManifest.length} part images) ` +
  `(game.js ${(Buffer.byteLength(js) / 1024).toFixed(1)} KB, ${jsFiles.length} JS files; site ${(total / 1024).toFixed(0)} KB)`
);
