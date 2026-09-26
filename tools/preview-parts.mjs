#!/usr/bin/env node
// Renders preview sheets to PNG so parts and vehicles can be reviewed before they go into the game.
//   node tools/preview-parts.mjs --part wpn_c75_std [--part ...]
//   node tools/preview-parts.mjs --vehicle test_gun_block [--scheme directorate]
//   node tools/preview-parts.mjs --all
// Output: preview/<id>.png  (git-ignored). Needs Playwright + Chromium (see design/04 §11).
import { mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { loadLibrary, vehicleSummary, costIndex, balanceReport } from './part-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'preview');
const args = process.argv.slice(2);
const list = (flag) => args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1]] : []));
const scheme = list('--scheme')[0] || 'league';

const { lib, errors } = loadLibrary(ROOT);
if (errors.length) {
  console.error('Fix format errors first (node tools/check-parts.mjs):\n  ' + errors.join('\n  '));
  process.exit(1);
}
let partIds = list('--part');
let vehIds = list('--vehicle');
if (args.includes('--all')) { partIds = Object.keys(lib.parts); vehIds = Object.keys(lib.vehicles); }
if (!partIds.length && !vehIds.length) {
  console.log('Usage: --part <id> | --vehicle <id> | --all  [--scheme league|directorate|skyreach|clans|lumen|primer]');
  process.exit(0);
}
for (const id of partIds) if (!lib.parts[id]) { console.error('Unknown part ' + id); process.exit(1); }
for (const id of vehIds) if (!lib.vehicles[id]) { console.error('Unknown vehicle ' + id); process.exit(1); }
if (!lib.paints.schemes[scheme]) { console.error('Unknown scheme ' + scheme); process.exit(1); }

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* fall back to a global install */ }
  const req = createRequire(import.meta.url);
  const globalRoot = execSync('npm root -g').toString().trim();
  return req(req.resolve('playwright', { paths: [globalRoot] }));
}
function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  for (const base of ['/opt/pw-browsers']) {
    if (!existsSync(base)) continue;
    for (const d of readdirSync(base).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
      const p = join(base, d, 'chrome-linux', 'chrome');
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const bal = Object.fromEntries(balanceReport(lib).rows.map((r) => [r.id, r]));
const jobs = [
  ...partIds.map((id) => ({ kind: 'part', id, info: { cost: costIndex(lib.parts[id].cost), p: bal[id] ? bal[id].p : 1 } })),
  ...vehIds.map((id) => ({ kind: 'vehicle', id, info: vehicleSummary(lib.vehicles[id], lib) })),
];

const page = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#0d1117;font-family:Roboto Condensed,Arial Narrow,sans-serif}
canvas{display:block;margin:0}
</style></head><body>
<script>${readFileSync(join(ROOT, 'tools', 'part-render.js'), 'utf8')}</script>
<script>
const LIB = ${JSON.stringify(lib)};
const JOBS = ${JSON.stringify(jobs)};
const SCHEME = ${JSON.stringify(scheme)};
const R = window.PartRender;
function grid(ctx, W, H, u, ox, oy) {
  ctx.fillStyle = '#13466B'; ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 1;
  for (let x = ox % (u / 4); x < W; x += u / 4) { ctx.strokeStyle = 'rgba(214,238,255,0.07)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = oy % (u / 4); y < H; y += u / 4) { ctx.strokeStyle = 'rgba(214,238,255,0.07)'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let x = ox % u; x < W; x += u) { ctx.strokeStyle = 'rgba(214,238,255,0.22)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = oy % u; y < H; y += u) { ctx.strokeStyle = 'rgba(214,238,255,0.22)'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}
function label(ctx, text, x, y, size, col) { ctx.font = size + 'px Roboto Condensed, Arial Narrow, sans-serif'; ctx.fillStyle = col || '#E6DCC3'; ctx.fillText(text, x, y); }
function sky(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#5D8FC2'); g.addColorStop(0.7, '#A9CBE4'); g.addColorStop(1, '#E8D9B0');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#6B7A4A'; ctx.fillRect(x, y + h - 10, w, 10);
}
async function partSheet(job) {
  const d = LIB.parts[job.id]; const o = d.overhang || {};
  const ew = d.footprint.w + (o.left || 0) + (o.right || 0); const eh = d.footprint.h + (o.top || 0) + (o.bottom || 0);
  const u = Math.max(48, Math.min(160, Math.floor(1000 / ew), Math.floor(360 / eh)));
  const pad = 40; const bigW = ew * u; const bigH = eh * u;
  const small = Math.max(24, Math.floor(u / 2.5));
  const schemes = [SCHEME, 'directorate', 'primer'].filter((v, i, a) => a.indexOf(v) === i);
  const rowH = eh * small + 30;
  const W = Math.max(bigW + pad * 2, 900); const H = 70 + bigH + pad + rowH + 30 + Math.max(90, eh * 20 + 60);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.id = 'job'; document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  const ox = pad + (o.left || 0) * u; const oy = 70 + (o.top || 0) * u;
  grid(ctx, W, H, u, ox, oy);
  label(ctx, d.name + '  (' + d.id + ')', pad, 30, 22);
  label(ctx, 'Tier ' + d.tier + '  |  ' + d.category + '  |  footprint ' + d.footprint.w + 'x' + d.footprint.h + '  |  mass ' + d.stats.mass + ' kg  |  cost index ' + Math.round(job.info.cost) + '  |  P ' + job.info.p.toFixed(2), pad, 54, 15, '#9FC3DD');
  // overhang area and footprint
  ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,200,87,0.6)'; ctx.strokeRect(pad, 70, bigW, bigH);
  ctx.strokeStyle = 'rgba(127,211,255,0.95)'; ctx.strokeRect(ox, oy, d.footprint.w * u, d.footprint.h * u);
  ctx.setLineDash([]);
  const img = await R.partImage(LIB, job.id, LIB.paints.schemes[SCHEME]);
  ctx.save(); ctx.translate(ox, oy); R.drawPart(ctx, img, d, 0, 0, 0, u); ctx.restore();
  // anchors and pivots
  const pts = [];
  for (const [n, a] of Object.entries(d.anchors || {})) for (const p of (Array.isArray(a[0]) ? a : [a])) pts.push([n, p]);
  for (const [n, m] of Object.entries(d.moving || {})) pts.push([n + ' pivot', m.pivot]);
  for (const [n, [x, y]] of pts) {
    const px = ox + x * u; const py = oy + y * u;
    ctx.strokeStyle = '#FFC857'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px - 7, py); ctx.lineTo(px + 7, py); ctx.moveTo(px, py - 7); ctx.lineTo(px, py + 7); ctx.stroke();
    label(ctx, n, px + 6, py - 6, 13, '#FFC857');
  }
  // scheme row
  let y0 = 70 + bigH + pad;
  let x0 = pad;
  for (const s of schemes) {
    const im = await R.partImage(LIB, job.id, LIB.paints.schemes[s]);
    ctx.save(); ctx.translate(x0 + (o.left || 0) * small, y0 + (o.top || 0) * small); R.drawPart(ctx, im, d, 0, 0, 0, small); ctx.restore();
    label(ctx, LIB.paints.schemes[s].name, x0, y0 + eh * small + 18, 13, '#9FC3DD');
    x0 += ew * small + 40;
  }
  // in-game scale on a sky backdrop (12 and 20 px per cell), plus a flipped copy
  y0 += rowH + 20;
  sky(ctx, pad, y0, W - pad * 2, Math.max(80, eh * 20 + 40));
  let gx = pad + 20;
  for (const us of [12, 20]) {
    ctx.save(); ctx.translate(gx + (o.left || 0) * us, y0 + 20); R.drawPart(ctx, img, d, 0, 0, 0, us); ctx.restore();
    gx += ew * us + 40;
  }
  ctx.save(); ctx.translate(gx + (o.right || 0) * 20, y0 + 20); R.drawPart(ctx, img, d, 0, 0, 1, 20); ctx.restore();
  label(ctx, 'In-game scale: 12 and 20 px per cell, and flipped', pad + 8, y0 + Math.max(80, eh * 20 + 40) - 16, 12, '#1B2430');
}
async function vehicleSheet(job) {
  const v = LIB.vehicles[job.id]; const cls = (LIB.classes[v.domain] || []).find((c) => c.id === v.class);
  const cells = R.expandCells(v);
  let maxX = 1; let maxY = 1; let minX = 99; let minY = 99;
  for (const c of cells) { maxX = Math.max(maxX, c.x + 1); maxY = Math.max(maxY, c.y + 1); minX = Math.min(minX, c.x); minY = Math.min(minY, c.y); }
  for (const p of v.parts) { const d = LIB.parts[p.p]; const o = d.overhang || {}; maxX = Math.max(maxX, p.x + d.footprint.w + (p.f ? (o.left || 0) : (o.right || 0))); maxY = Math.max(maxY, p.y + d.footprint.h); minX = Math.min(minX, p.x - (p.f ? (o.right || 0) : (o.left || 0))); minY = Math.min(minY, p.y); }
  const spanX = maxX - Math.min(0, minX); const spanY = maxY - Math.min(0, minY);
  const u = Math.max(20, Math.min(96, Math.floor(1100 / spanX), Math.floor(420 / spanY)));
  const W = Math.max(spanX * u + 120, 900); const H = spanY * u + 250;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.id = 'job'; document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  const ox = 60 - Math.min(0, minX) * u; const oy = 90 - Math.min(0, minY) * u;
  grid(ctx, W, H, u, ox, oy);
  label(ctx, v.name + '  (' + v.id + ')', 60, 34, 22);
  const s = job.info;
  label(ctx, (cls ? cls.name : v.class) + ' (' + v.domain + ')  |  grid limit ' + (cls ? cls.grid.join('x') : '?') + '  |  ' + (s.mass / 1000).toFixed(1) + ' t  |  cost index ' + Math.round(s.cost) + '  |  ' + s.cells + ' cells, ' + s.parts + ' parts', 60, 60, 15, '#9FC3DD');
  ctx.save(); ctx.translate(ox, oy); await R.drawVehicle(ctx, v, LIB, LIB.paints.schemes[SCHEME], u); ctx.restore();
  // centre of mass marker
  const cx = ox + s.com[0] * u; const cy = oy + s.com[1] * u;
  ctx.strokeStyle = '#FFC857'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, 6.3); ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 12); ctx.stroke();
  label(ctx, 'centre of mass', cx + 12, cy - 10, 13, '#FFC857');
  // small in-game view
  const gy = oy + spanY * u + 40; sky(ctx, 60, gy, W - 120, 110);
  ctx.save(); ctx.translate(90 - Math.min(0, minX) * 14, gy + 20); await R.drawVehicle(ctx, v, LIB, LIB.paints.schemes[SCHEME], 14); ctx.restore();
  label(ctx, 'In-game scale: 14 px per cell', 68, gy + 100, 12, '#1B2430');
}
window.renderJob = async (i) => {
  document.body.innerHTML = '';
  const job = JOBS[i];
  if (job.kind === 'part') await partSheet(job); else await vehicleSheet(job);
  return true;
};
</script></body></html>`;

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: chromiumPath() });
const tab = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
tab.on('pageerror', (e) => errs.push(e.message));
tab.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await tab.setContent(page);
mkdirSync(OUT, { recursive: true });
for (let i = 0; i < jobs.length; i++) {
  await tab.evaluate((n) => window.renderJob(n), i);
  const file = join(OUT, `${jobs[i].id}${jobs[i].kind === 'vehicle' || scheme !== 'league' ? '-' + scheme : ''}.png`);
  await tab.locator('#job').screenshot({ path: file });
  console.log('Wrote ' + file.replace(ROOT + '/', ''));
}
await browser.close();
if (errs.length) { console.error('Browser errors:\n  ' + errs.join('\n  ')); process.exit(1); }
