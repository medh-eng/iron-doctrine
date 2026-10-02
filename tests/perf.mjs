// Performance probe (design/04 §10): average frame and game-work time over 300 frames of a battle.
// Headless isn't a phone: compare builds with each other, not with a target. Run: node build.mjs --test && node tests/perf.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
const SITE = new URL('../build-test', import.meta.url).pathname;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer((q, r) => { let f = join(SITE, q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html'; if (!existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': T[extname(f)] || 'x' }); r.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, r));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await b.newPage({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`);
await page.waitForTimeout(300);
// Average frame time and the game's own work (update + render) per frame over 300 frames.
const probe = () => page.evaluate(() => new Promise((res) => {
  const S = window.__GAME__.SCREENS.battle; const B = S.B;
  let n = 0, worst = 0, sum = 0, last = performance.now(), work = 0, worstWork = 0;
  const upd = S.update.bind(S), ren = S.render.bind(S);
  S.update = (...a) => { const t = performance.now(); upd(...a); const w = performance.now() - t; work += w; worstWork = Math.max(worstWork, w); };
  S.render = (...a) => { const t = performance.now(); ren(...a); work += performance.now() - t; };
  function f(now) { const d = now - last; last = now; sum += d; worst = Math.max(worst, d); n++; if (n < 300) requestAnimationFrame(f); else { S.update = upd; S.render = ren; res({ avgFrame: +(sum / n).toFixed(1), worst: +worst.toFixed(1), avgWork: +(work / n).toFixed(2), worstUpdate: +worstWork.toFixed(2), units: B.units.length, shots: B.stats.shots + B.stats.enemyShots }); } }
  requestAnimationFrame(f);
}));
// 1. A Gauntlet level once the fighting has started.
await page.evaluate(() => window.__GAME__.go('battle', 3));
for (let t = 0; t < 40; t++) { await page.waitForTimeout(1000); if (await page.evaluate(() => { const B = window.__GAME__.SCREENS.battle.B; return B.stats.shots + B.stats.enemyShots > 3; })) break; }
const level = await probe();
// 2. Heavy: three cruisers and an air cruiser a side at sea (the largest designs, v0.7.3).
await page.evaluate(() => window.__GAME__.evalIn(`screens.go('battle', { sim: { field: 'sea', weather: 'clear', light: 'day', seed: 9,
  squad: () => ['league_cruiser_t3', 'clans_cruiser_t3', 'lumen_cruiser_t3', 'league_air_cruiser_t3'].map(designFromTemplate),
  enemy: () => ['directorate_cruiser_t3', 'skyreach_cruiser_t3', 'directorate_cruiser_t3', 'skyreach_air_cruiser_t3'].map(designFromTemplate) } })`));
// Wait until both sides are firing (up to 60 s).
for (let t = 0; t < 60; t++) { await page.waitForTimeout(1000); if (await page.evaluate(() => { const B = window.__GAME__.SCREENS.battle.B; return B.stats.shots + B.stats.enemyShots > 5; })) break; }
const heavy = await probe();
console.log(JSON.stringify({ level, heavy }));
await b.close(); srv.close();
