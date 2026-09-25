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
await page.evaluate(() => window.__GAME__.go('battle', 3));
await page.waitForTimeout(12000);   // enemies arrive, fighting starts
const r = await page.evaluate(() => new Promise((res) => {
  const S = window.__GAME__.SCREENS.battle; const B = S.B;
  let n = 0, worst = 0, sum = 0, last = performance.now();
  const upd = S.update.bind(S), ren = S.render.bind(S);
  let work = 0;
  S.update = (...a) => { const t = performance.now(); upd(...a); work += performance.now() - t; };
  S.render = (...a) => { const t = performance.now(); ren(...a); work += performance.now() - t; };
  function f(now) { const d = now - last; last = now; sum += d; worst = Math.max(worst, d); n++; if (n < 300) requestAnimationFrame(f); else res({ avgFrame: (sum / n).toFixed(1), worst: worst.toFixed(1), avgWork: (work / n).toFixed(2), shots: B.stats.enemyShots }); }
  requestAnimationFrame(f);
}));
console.log(JSON.stringify(r));
await b.close(); srv.close();
