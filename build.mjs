#!/usr/bin/env node
// Iron Doctrine build: joins src/ into ONE self-contained HTML file.
//   node build.mjs          -> docs/index.html        (release, served by GitHub Pages)
//   node build.mjs --test   -> build-test/index.html  (test hooks included)
// Uses only Node built-ins, so no npm install is needed to build.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, extname, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

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
js = `(() => {\n'use strict';\n${js}\n})();`;

// ---------- 2. CSS: url(assets/<file>) becomes an inline data URI
const MIME = {
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.png': 'image/png', '.svg': 'image/svg+xml',
};
const css = read(join(SRC, 'styles.css')).replace(/url\((['"]?)assets\/([^'")]+)\1\)/g, (_m, _q, file) => {
  const p = join(SRC, 'assets', file);
  if (!existsSync(p)) fail(`missing asset src/assets/${file}`);
  const mime = MIME[extname(file).toLowerCase()];
  if (!mime) fail(`unknown asset type ${file}`);
  return `url(data:${mime};base64,${readFileSync(p).toString('base64')})`;
});

// ---------- 3. Assemble (replace with functions so "$" in code is never special)
let html = read(join(SRC, 'index.template.html'));
for (const ph of ['/*__CSS__*/', '/*__JS__*/', '<!--TEST_HOOKS-->']) {
  if (!html.includes(ph)) fail(`template placeholder ${ph} missing in src/index.template.html`);
}
const hooks = TEST ? `<script>\n${read(join(ROOT, 'tests', 'test-hooks.js'))}\n</script>` : '';
html = html
  .replace('/*__CSS__*/', () => css)
  .replace('<!--TEST_HOOKS-->', () => hooks)
  .replace('/*__JS__*/', () => js);

// ---------- 4. Checks
// 4a. Syntax check the bundled script
const tmp = join(tmpdir(), `iron-doctrine-check-${process.pid}.js`);
writeFileSync(tmp, js);
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
} catch (e) {
  fail('JavaScript syntax error:\n' + (e.stderr ? e.stderr.toString() : e.message));
}

// 4b. No test code in release
if (!TEST && /__TEST__|__GAME__|TEST:BEGIN|TEST:END/.test(html)) {
  fail('test code found in the release build (keep it between /*TEST:BEGIN*/ and /*TEST:END*/)');
}

// 4c. No external URLs (the SVG/XML namespace is allowed)
const ALLOWED = ['http://www.w3.org/'];
const urls = [...new Set((html.match(/https?:\/\/[^\s"'<>)\\]+/g) || []))]
  .filter((u) => !ALLOWED.some((a) => u.startsWith(a)));
if (urls.length) fail('external URLs found (the game must be self-contained):\n  ' + urls.join('\n  '));

// 4d. Size
const bytes = Buffer.byteLength(html);
if (bytes > 15 * 1024 * 1024) fail(`file is ${(bytes / 1048576).toFixed(1)} MB (limit 15 MB)`);

// ---------- 5. Write
mkdirSync(OUT_DIR, { recursive: true });
const out = join(OUT_DIR, 'index.html');
writeFileSync(out, html);

const version = (js.match(/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] || '?';
console.log(
  `Built ${TEST ? 'TEST' : 'release'} v${version}: ${relative(ROOT, out)} ` +
  `(${(bytes / 1024).toFixed(1)} KB, ${jsFiles.length} JS files)`
);
