// Smoke test for the TEST build (run: npm test).
// Loads build-test/index.html at each viewport, checks for console/page errors,
// checks the rotate card, and saves screenshots to test-output/.
// Extend per part with scripted play: level up, life lost, game over, pause, time stop...
//
// Browser: `npx playwright install chromium`, or set CHROMIUM_PATH to any Chromium.

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'build-test', 'index.html');
const OUT = join(ROOT, 'test-output');
if (!existsSync(PAGE)) {
  console.error('build-test/index.html not found. Run: node build.mjs --test');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'phone-640x360', width: 640, height: 360, mobile: true },
  { name: 'phone-800x360', width: 800, height: 360, mobile: true },
  { name: 'phone-915x412', width: 915, height: 412, mobile: true },
  { name: 'desktop-1280x720', width: 1280, height: 720, mobile: false },
  { name: 'portrait-360x640', width: 360, height: 640, mobile: true, portrait: true },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const problems = [];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.mobile ? 2 : 1,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto(pathToFileURL(PAGE).href);
  await page.waitForTimeout(700);

  // First tap (unlocks audio in later builds).
  if (!vp.portrait) {
    if (vp.mobile) await page.touchscreen.tap(vp.width / 2, vp.height / 2);
    else await page.mouse.click(vp.width / 2, vp.height / 2);
    await page.waitForTimeout(400);
  }

  const info = await page.evaluate(() => {
    const g = window.__GAME__;
    const rotate = getComputedStyle(document.getElementById('rotate')).display !== 'none';
    return {
      hasGame: !!g,
      hasTest: !!window.__TEST__,
      frames: g ? g.state.frames : 0,
      portraitState: g ? g.state.portrait : null,
      rotateVisible: rotate,
    };
  });

  if (!info.hasGame) errors.push('window.__GAME__ missing (test build not exposing state?)');
  if (!info.hasTest) errors.push('window.__TEST__ missing (test hooks not injected?)');
  if (info.frames < 5) errors.push(`only ${info.frames} frames rendered`);
  if (vp.portrait && !info.rotateVisible) errors.push('rotate card not shown in portrait');
  if (!vp.portrait && info.rotateVisible) errors.push('rotate card shown in landscape');
  if (vp.portrait && info.portraitState !== true) errors.push('game did not pause for portrait');

  await page.screenshot({ path: join(OUT, `${vp.name}.png`) });
  await context.close();

  const status = errors.length ? 'FAIL' : 'ok';
  console.log(`${status.padEnd(4)} ${vp.name}  frames=${info.frames}`);
  for (const e of errors) { console.log('     ' + e); problems.push(`${vp.name}: ${e}`); }
}

await browser.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s). Screenshots in test-output/.`);
  process.exit(1);
}
console.log('\nAll viewports clean. Screenshots in test-output/.');
