// Smoke test for the TEST build (run: npm test).
// Loads build-test/index.html at each viewport, checks for console/page errors,
// drives the title, Settings, the controls test range (two thumbs at once, manual aim,
// pinch, pan, edge guard, time stop, orders, swap), pause and auto-pause, saves,
// reload and damaged-save recovery. Screenshots go to test-output/.
//
// Browser: `npx playwright install chromium`, or set CHROMIUM_PATH to any Chromium.

import { chromium } from 'playwright';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'build-test');
const OUT = join(ROOT, 'test-output');
if (!existsSync(join(SITE, 'index.html'))) {
  console.error('build-test/index.html not found. Run: node build.mjs --test');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

// Serve build-test/ over http, like GitHub Pages does.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([/\\])+/, '') || 'index.html';
  const file = join(SITE, path.endsWith('/') || path === '.' ? 'index.html' : path);
  if (!file.startsWith(SITE) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PAGE_URL = `http://127.0.0.1:${server.address().port}/`;

const ONLY = process.env.ONLY;
const VIEWPORTS = [
  { name: 'phone-640x360', width: 640, height: 360, mobile: true },
  { name: 'phone-800x360', width: 800, height: 360, mobile: true },
  { name: 'phone-915x412', width: 915, height: 412, mobile: true },
  { name: 'desktop-1280x720', width: 1280, height: 720, mobile: false },
  { name: 'portrait-360x640', width: 360, height: 640, mobile: true, portrait: true },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const problems = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

for (const vp of VIEWPORTS.filter((v) => !ONLY || v.name.includes(ONLY))) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.mobile ? 2 : 1,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  const steps = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const check = (ok, msg) => { if (!ok) errors.push(msg); };
  const shot = (step) => page.screenshot({ path: join(OUT, `${vp.name}-${step}.png`) });
  const G = (fn, arg) => page.evaluate(fn, arg);

  // ---------- touch helpers (CDP gives real multi-touch)
  const cdp = vp.mobile ? await context.newCDPSession(page) : null;
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const ctrl = async (id) => (await G(() => window.__GAME__.controlRects())).find((c) => c.id === id);
  const tapCtrl = async (id) => {
    const c = await ctrl(id);
    if (!c) { errors.push(`control ${id} not found`); return; }
    if (vp.mobile) {
      await touch('touchStart', [{ x: c.cx, y: c.cy, id: 9 }]);
      await wait(40);
      await touch('touchEnd', [{ x: c.cx, y: c.cy, id: 9 }]);
    } else {
      await page.mouse.click(c.cx, c.cy);
    }
    await wait(60);
  };
  const range = () => G(() => {
    const S = window.__GAME__.SCREENS.battle;
    const B = S.B;
    return { x: B.me.body.x, shots: B.stats.shots, active: B.squad.indexOf(B.me), order: B.order, zoom: S.cam.zoom,
      follow: S.cam.follow, eff: S.scale() / (12 * window.__GAME__.layout.h / 360), frozen: S.frozen, simTime: B.time, aim: !!S.aim, result: B.result, level: S.level };
  });
  const tapButton = async (name, role = 'button') => {
    const b = page.getByRole(role, { name, exact: true });
    if (vp.mobile) await b.tap(); else await b.click();
    await wait(120);
  };

  try {
  await page.goto(PAGE_URL);
  await page.waitForTimeout(700);

  // ---------- 1. Title
  const info = await G(() => {
    const g = window.__GAME__;
    return {
      hasGame: !!g,
      hasTest: !!window.__TEST__,
      frames: g ? g.state.frames : 0,
      portraitState: g ? g.state.portrait : null,
      rotateVisible: getComputedStyle(document.getElementById('rotate')).display !== 'none',
      title: !!document.querySelector('.title-screen .logo'),
      stencil: document.fonts ? document.fonts.check('44px "Saira Stencil One"') : true,
    };
  });
  check(info.hasGame, 'window.__GAME__ missing (test build not exposing state?)');
  check(info.hasTest, 'window.__TEST__ missing (test hooks not injected?)');
  check(info.frames >= 5, `only ${info.frames} frames rendered`);
  check(info.title, 'title screen not shown');
  check(info.stencil, 'stencil font not loaded');
  await shot('1-title');
  steps.push('title');
  // v0.7.1: the tutorial is offered once to a new player; Help lives in Settings.
  if (!vp.portrait) {
    check((await page.getByRole('button', { name: 'Play the tutorial' }).count()) === 1, 'the tutorial was not offered to a new player');
    await shot('1b-tutorial-offer');
    await page.getByRole('button', { name: 'Not now', exact: true }).click();
    await wait(200);
    await page.locator('.title-screen button', { hasText: 'Settings' }).first().click();
    await wait(200);
    await page.getByRole('tab', { name: 'Help' }).click();
    await wait(150);
    await page.locator('.set-row', { hasText: 'Glossary' }).getByRole('button').click();
    await wait(400);
    await page.locator('.help-search').fill('laser');
    await wait(300);
    check((await page.locator('.card-help .rel-row').count()) >= 1, 'the glossary search found nothing for "laser"');
    await shot('1c-glossary');
    await page.locator('.card-help').getByRole('button', { name: 'Close', exact: true }).click();
    await wait(150);
    await page.locator('.set-row', { hasText: 'How to play' }).getByRole('button').click();
    await wait(200);
    check((await page.locator('.card-help .help-p').count()) >= 3, 'How to play is empty');
    await page.locator('.card-help').getByRole('button', { name: 'Close', exact: true }).click();
    await wait(150);
    await page.getByRole('tab', { name: 'Audio' }).click();     // Settings remembers its tab
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await wait(200);
    // The tutorial starts with its first step and can be left.
    await G(() => window.__GAME__.evalIn('startTutorial()'));
    await wait(700);
    check(/^1\/7/.test((await page.locator('.tut-text').textContent()) || ''), 'the tutorial did not start at step 1');
    await shot('1d-tutorial');
    await G(() => window.__GAME__.go('title'));
    await wait(300);
    check((await page.locator('.tut-banner').count()) === 0, 'the tutorial banner stayed after leaving');
    steps.push('help and tutorial');
  }

  if (vp.portrait) {
    check(info.rotateVisible, 'rotate card not shown in portrait');
    check(info.portraitState === true, 'game did not pause for portrait');
  } else {
    check(!info.rotateVisible, 'rotate card shown in landscape');

    // ---------- 1b. Designs, physics and damage rules (once, on desktop)
    if (!vp.mobile) {
      // Step 2.5a: parts and templates from PART_LIBRARY must match the v1 tables (snapshot).
      // Allowed: cost keys may differ with the same total (rubber -> metal, fuel -> wood), and new fields/parts.
      const snap = JSON.parse(readFileSync(join(ROOT, 'tests', 'v1-parts-snapshot.json'), 'utf8'));
      const lib = await G(() => ({ PARTS: window.__GAME__.PARTS, TEMPLATES: window.__GAME__.TEMPLATES }));
      const total = (c) => Object.values(c || {}).reduce((a, b) => a + b, 0);
      const libDiffs = [];
      for (const [id, a] of Object.entries(snap.PARTS)) {
        const b = lib.PARTS[id];
        if (!b) { libDiffs.push(`part ${id} missing`); continue; }
        for (const [k, v] of Object.entries(a)) {
          if (k === 'cost' ? total(v) !== total(b.cost) : JSON.stringify(v) !== JSON.stringify(b[k])) libDiffs.push(`${id}.${k}`);
        }
      }
      for (const [id, a] of Object.entries(snap.TEMPLATES)) {
        const b = lib.TEMPLATES[id];
        if (!b) { libDiffs.push(`template ${id} missing`); continue; }
        for (const [k, v] of Object.entries(a)) if (JSON.stringify(v) !== JSON.stringify(b[k])) libDiffs.push(`template ${id}.${k}`);
      }
      check(!libDiffs.length, `parts or templates differ from the v1 snapshot: ${libDiffs.join(', ')}`);
      const self = await G(() => window.__GAME__.selfCheck());
      for (const [id, r] of Object.entries(self)) check(r.ok, `template ${id} breaks placement rules: ${r.errors.join(' ')}`);
      const ph = await G(() => window.__GAME__.physicsCheck());
      check(ph.weakValid && ph.tallValid, 'physics test designs are not valid');
      check(ph.wheelsFlat.speed > ph.tracksFlat.speed + 2, `wheels not faster on flat ground (${ph.wheelsFlat.speed.toFixed(1)} vs ${ph.tracksFlat.speed.toFixed(1)} m/s)`);
      check(ph.wheelsMud.x < 3 && ph.tracksMud.x > 50, `tracks did not beat wheels in mud (${ph.wheelsMud.x.toFixed(0)} m vs ${ph.tracksMud.x.toFixed(0)} m)`);
      check(ph.normalHill.x > 60 && ph.weakHill.speed < 0.5 && ph.weakHill.x < 40, `underpowered design did not stall on the hill (${JSON.stringify(ph.weakHill)})`);
      check(ph.tallSlope.tilt > 60 && ph.normalSlope.tilt < 20, `top-heavy tipping wrong (tall ${ph.tallSlope.tilt.toFixed(0)}°, normal ${ph.normalSlope.tilt.toFixed(0)}°)`);
      const rnd = await G(() => window.__GAME__.randomCheck());
      check(rnd.every((r) => r.ok), `randomiser made an invalid design: ${JSON.stringify(rnd.find((r) => !r.ok))}`);
      const nv = await G(() => window.__GAME__.navalCheck());
      check(nv.valid, 'naval test designs are not valid');
      check(nv.heavy.draft > nv.base.draft + 0.2 && nv.heavy.speed < nv.base.speed * 0.95, `over-armoured ship did not sit lower and slower (${JSON.stringify([nv.base, nv.heavy])})`);
      check(Math.abs(nv.holed.angle) > 3 && !nv.holed.sunk && nv.holed.wet.every((x) => x < 10), `holed ship did not list with the water held by a bulkhead (${JSON.stringify(nv.holed)})`);
      check(nv.open.sunk, `holed ship without bulkheads did not sink (${JSON.stringify(nv.open)})`);
      check(nv.base.dx > 40 && nv.reverse.dx < -3, `ships don't drive forward and back (${nv.base.dx.toFixed(0)} m, ${nv.reverse.dx.toFixed(0)} m)`);
      const sb = await G(() => window.__GAME__.subCheck());
      check(sb.valid && sb.dived.submerged && Math.abs(sb.dived.com + 8) < 1 && Math.abs(sb.dived.angle) < 5, `submarine did not dive to 8 m level (${JSON.stringify(sb.dived)})`);
      check(!sb.surfaced.submerged && sb.surfaced.top > 0.5, `submarine did not surface (${JSON.stringify(sb.surfaced)})`);
      check(sb.torpedo.water > 0 && sb.torpedo.hpLost > 200, `torpedo did not hole and flood the gunboat (${JSON.stringify(sb.torpedo)})`);
      check(sb.charge.hpLost > 100, `depth charge did not damage the submarine (${JSON.stringify(sb.charge)})`);
      const ac = await G(() => window.__GAME__.airCheck());
      check(ac.valid, 'air test designs are not valid');
      check(ac.level.minAlt > 45 && Math.abs(ac.level.alt - 60) < 10, `fighter did not hold level flight (${JSON.stringify(ac.level)})`);
      check(ac.loop.flipped, `fighter did not loop round (${JSON.stringify(ac.loop)})`);
      check(ac.stall.maxAlpha > 12 && ac.stall.minAlt < 2, `aircraft with too little wing did not stall and come down (${JSON.stringify(ac.stall)})`);
      check(ac.heli.alt > 15 && ac.fatHeli.alt < 2, `helicopter lift wrong (${JSON.stringify([ac.heli, ac.fatHeli])})`);
      check(ac.bomb.destroyed, `bombs did not destroy the truck (${JSON.stringify(ac.bomb)})`);
      const mc = await G(() => window.__GAME__.missileCheck());
      check(!mc.noRadarValid, 'a SAM launcher without radar was accepted');
      check(mc.atgmFcRadar > mc.atgmFc + 0.05 && mc.atgmVsEcm < mc.atgmFc - 0.1, `radar and ECM don't change anti-tank missile hit rates (${JSON.stringify(mc)})`);
      check(mc.samNaval > mc.samSearch + 0.05 && mc.samVsEcm < mc.samSearch - 0.1, `radar and ECM don't change SAM hit rates (${JSON.stringify(mc)})`);
      console.log(`     missile hit rates: ATGM ${mc.atgmFc} / +radar ${mc.atgmFcRadar} / vs ECM ${mc.atgmVsEcm}; SAM ${mc.samSearch} / naval radar ${mc.samNaval} / vs ECM ${mc.samVsEcm}`);
      // Part 5b: designed missiles, launchers, flares, warheads.
      const dsm = await G(() => window.__GAME__.designedMissileCheck());
      const DM = (c, what) => check(c, `${what} ${JSON.stringify(dsm)}`);
      DM(dsm.library.length === 7 && dsm.library.every((m) => !m.errors.length && m.speed > 150 && m.range >= 2500), 'library missile designs broken');
      DM(dsm.noMotor.length && dsm.seekerBack.length && dsm.clusterSmall.length && dsm.mixed.length, 'broken missile designs were accepted');
      const rr = dsm.rates;
      DM(rr.heat - rr.heatFlares > 2 * (rr.radar - rr.radarFlares) && rr.heat - rr.heatFlares > 0.4, 'flares should beat heat seekers far more than radar seekers');
      DM(rr.radarEcm < rr.radar - 0.15 && rr.heatEcm > rr.heat - 0.15 && rr.unguided > 0.8, 'ECM should jam radar seekers only');
      const wh = dsm.warheads;
      DM(wh.he.damage > 50 && wh.napalm.patch && wh.napalm.fires > 0 && wh.acid.corroded > 0 && wh.emp.gunsDead && wh.cluster.split >= 4, 'a warhead had no effect');
      DM(dsm.capacity.rack === 4 && dsm.capacity.vls === 8 && dsm.capacity.mag === 8 && dsm.vlsUp && dsm.refill.rounds === 1 && dsm.refill.mag === 7, 'launcher capacity, VLS launch or magazine refill wrong');
      DM(dsm.large.rack === 'missile_m' && dsm.large.vls === 'msl_l_cluster' && dsm.large.vlsRounds === 2, 'a large missile should go in the VLS only');
      console.log(`     designed missile hit rates: heat ${rr.heat} / flares ${rr.heatFlares} / ECM ${rr.heatEcm}; radar ${rr.radar} / flares ${rr.radarFlares} / ECM ${rr.radarEcm}; unguided ${rr.unguided}`);
      const sy = await G(() => window.__GAME__.systemsCheck());
      check(sy.hotPower < 0.95 && sy.coolPower === 1, `heat did not cut power or radiators did not help (${JSON.stringify(sy)})`);
      check(sy.repaired > 20 && sy.brokeDown, `repair or breakdown failed (${JSON.stringify(sy)})`);
      const hw = await G(() => window.__GAME__.howitzerCheck());
      check(Object.values(hw).every(Boolean), `howitzer can't aim at every range: ${JSON.stringify(hw)}`);
      const dm = await G(() => window.__GAME__.damageCheck());
      for (const [k, v] of Object.entries(dm)) check(v, `damage rule failed: ${k}`);
      steps.push('part library matches v1, templates, physics, damage, ships, submarines, aircraft, missiles, systems');
      await G(() => window.__GAME__.go('title'));
      await wait(300);
    }

    // ---------- 2. Settings: change a setting, look at each tab
    await tapButton('Settings');
    check(await page.locator('.card-settings').isVisible(), 'settings did not open');
    await page.locator('.switch[data-setting="music"]').click();
    check((await G(() => window.__GAME__.save.settings.music)) === false, 'music toggle did not change the setting');
    await shot('2-settings-audio');
    await tapButton('Controls', 'tab');
    await page.locator('.seg-btn[data-setting="btnSize"][data-value="L"]').click();
    check((await G(() => window.__GAME__.save.settings.btnSize)) === 'L', 'button size did not change');
    await shot('2-settings-controls');
    // Text size (6f): XL scales the menus; nothing may spill off the screen sideways.
    await tapButton('Display', 'tab');
    await page.locator('.seg-btn[data-setting="textSize"][data-value="XL"]').click();
    const ts = await G(() => ({ v: getComputedStyle(document.documentElement).getPropertyValue('--ts').trim(), title: parseFloat(getComputedStyle(document.querySelector('.card-settings .card-title') || document.body).fontSize), right: document.querySelector('.card-settings').getBoundingClientRect().right }));
    check(ts.v === '1.3', `text size XL did not set the scale (${ts.v})`);
    check(ts.right <= vp.width + 1, `settings card spills off the screen at text size XL (${ts.right})`);
    await shot('2-settings-display-xl');
    check(await G(() => window.__GAME__.evalIn('FACTIONS.every((F) => FACTION_GLYPH[FACTION_SHAPE[F.id]])')), 'a faction has no mark shape');
    await tapButton('Data', 'tab');
    await shot('2-settings-data');
    await tapButton('Done');
    check(!(await page.locator('.card-settings').count()), 'settings did not close');
    steps.push('settings');

    // ---------- 3. Start the battle
    await tapButton('Play from level 1');
    check((await G(() => window.__GAME__.screens.name)) === 'battle', 'Play did not open the battle');
    await wait(300);
    await shot('3-battle-text-xl');
    await G(() => window.__GAME__.save.setSetting('textSize', 'M'));

    // ---------- 4. Both thumbs at once: hold drive right, tap Fire
    const x0 = (await range()).x;
    if (vp.mobile) {
      const r = await ctrl('right');
      const f = await ctrl('fire');
      await touch('touchStart', [{ x: r.cx, y: r.cy, id: 1 }]);
      await wait(300);
      await touch('touchStart', [{ x: r.cx, y: r.cy, id: 1 }, { x: f.cx, y: f.cy, id: 2 }]);
      await wait(60);
      await touch('touchEnd', [{ x: f.cx, y: f.cy, id: 2 }]);
      await wait(500);
      await shot('3-drive-and-fire');
      await touch('touchEnd', [{ x: r.cx, y: r.cy, id: 1 }]);
    } else {
      await page.keyboard.down('KeyD');
      await wait(300);
      await page.keyboard.press('Space');
      await wait(500);
      await shot('3-drive-and-fire');
      await page.keyboard.up('KeyD');
    }
    let s = await range();
    check(s.x > x0 + 1, `driving did not move the vehicle (${x0.toFixed(1)} -> ${s.x.toFixed(1)})`);
    check(s.shots === 1, `fire while driving gave ${s.shots} shots, expected 1`);
    steps.push('two thumbs');

    // ---------- 5. Manual aim: press Fire, drag into the world, release
    await G(() => window.__GAME__.readyGuns());
    if (vp.mobile) {
      const f = await ctrl('fire');
      await touch('touchStart', [{ x: f.cx, y: f.cy, id: 3 }]);
      for (let i = 1; i <= 6; i++) {
        await touch('touchMove', [{ x: f.cx - i * 16, y: f.cy - i * 25, id: 3 }]);
        await wait(30);
      }
      check((await range()).aim, 'manual aim did not show a trajectory');
      await shot('4-manual-aim');
      await touch('touchEnd', [{ x: f.cx - 96, y: f.cy - 150, id: 3 }]);
    } else {
      const f = await ctrl('fire');
      await page.mouse.move(f.cx, f.cy);
      await page.mouse.down();
      await page.mouse.move(f.cx - 150, f.cy - 250, { steps: 6 });
      check((await range()).aim, 'manual aim did not show a trajectory');
      await shot('4-manual-aim');
      await page.mouse.up();
    }
    await wait(100);
    check((await range()).shots === 2, 'manual aim release did not fire');
    steps.push('manual aim');

    // ---------- 6. Pan, recenter chip, pinch zoom, edge guard
    const mid = { x: vp.width * 0.45, y: vp.height * 0.45 };
    if (vp.mobile) {
      await touch('touchStart', [{ ...mid, id: 4 }]);
      for (let i = 1; i <= 5; i++) { await touch('touchMove', [{ x: mid.x + i * 20, y: mid.y, id: 4 }]); await wait(20); }
      await touch('touchEnd', [{ x: mid.x + 100, y: mid.y, id: 4 }]);
    } else {
      await page.mouse.move(mid.x, mid.y);
      await page.mouse.down();
      await page.mouse.move(mid.x + 100, mid.y, { steps: 5 });
      await page.mouse.up();
    }
    s = await range();
    check(!s.follow, 'dragging the world did not pan the camera');
    check(!!(await ctrl('recenter')), 'recenter chip did not appear after panning');
    await shot('5-panned');
    await tapCtrl('recenter');
    check((await range()).follow, 'recenter chip did not recenter');

    const effBefore = (await range()).eff;
    if (vp.mobile) {
      await touch('touchStart', [{ x: mid.x - 30, y: mid.y, id: 5 }]);
      await touch('touchStart', [{ x: mid.x - 30, y: mid.y, id: 5 }, { x: mid.x + 30, y: mid.y, id: 6 }]);
      for (let i = 1; i <= 5; i++) {
        await touch('touchMove', [{ x: mid.x - 30 - i * 12, y: mid.y, id: 5 }, { x: mid.x + 30 + i * 12, y: mid.y, id: 6 }]);
        await wait(20);
      }
      await touch('touchEnd', [{ x: mid.x - 90, y: mid.y, id: 5 }, { x: mid.x + 90, y: mid.y, id: 6 }]);
      s = await range();
      check(s.eff > effBefore * 1.2, `pinch did not zoom in (${effBefore.toFixed(2)} -> ${s.eff.toFixed(2)})`);
      // Edge guard: a drag starting 5 px from the left edge must not pan.
      await G(() => { window.__GAME__.SCREENS.battle.cam.follow = true; });
      await touch('touchStart', [{ x: 5, y: mid.y, id: 7 }]);
      for (let i = 1; i <= 4; i++) await touch('touchMove', [{ x: 5 + i * 30, y: mid.y, id: 7 }]);
      await touch('touchEnd', [{ x: 125, y: mid.y, id: 7 }]);
      check((await range()).follow, 'a drag from the screen edge panned the world');
    } else {
      await page.mouse.move(mid.x, mid.y);
      await page.mouse.wheel(0, -300);
      await wait(50);
      s = await range();
      check(s.eff > effBefore * 1.2, `wheel did not zoom in (${effBefore.toFixed(2)} -> ${s.eff.toFixed(2)})`);
    }
    steps.push('pan, pinch, edge guard');

    // ---------- 7. Start/Stop time: simulation freezes, orders still work
    await tapCtrl('time');
    const t0 = (await range()).simTime;
    await tapCtrl('order2');
    await wait(400);
    s = await range();
    check(s.frozen, 'time did not stop');
    check(s.simTime === t0, 'simulation kept running while time was stopped');
    check(s.order === 'Hold', `order chip while frozen gave ${s.order}`);
    await shot('6-time-stopped');
    await tapCtrl('time');
    await wait(200);
    s = await range();
    check(!s.frozen && s.simTime > t0, 'time did not restart');
    steps.push('time stop');

    // ---------- 8. Swap
    await tapCtrl('swap');
    check((await range()).active === 1, 'swap did not change vehicle');
    steps.push('swap');

    // ---------- 8b. Left-handed layout mirrors the thumb controls
    await G(() => window.__GAME__.setSetting('leftHanded', true));
    await wait(250);
    const fireL = await ctrl('fire');
    const leftL = await ctrl('left');
    check(fireL.cx < vp.width / 2 && leftL.cx > vp.width / 2, 'left-handed setting did not mirror the controls');
    await shot('6b-left-handed');
    await G(() => window.__GAME__.setSetting('leftHanded', false));
    await wait(250);
    steps.push('left-handed');

    // ---------- 9. Pause card, resume, auto-pause on blur and when hidden
    await tapCtrl('pause');
    check(await page.locator('.card-pause').isVisible(), 'pause card did not open');
    check(await G(() => window.__GAME__.state.paused), 'game not paused');
    await shot('7-paused');
    await tapButton('Resume');
    check(!(await G(() => window.__GAME__.state.paused)), 'resume did not unpause');
    await G(() => window.dispatchEvent(new Event('blur')));
    check(await G(() => window.__GAME__.state.paused), 'losing focus did not pause');
    await tapButton('Resume');
    await G(() => window.__GAME__.setHidden(true));
    check(await G(() => window.__GAME__.state.paused && window.__GAME__.state.hidden), 'going to the background did not pause');
    await G(() => window.__GAME__.setHidden(false));
    await tapButton('Resume');
    // P key opens and closes the pause card on desktop.
    if (!vp.mobile) {
      await page.keyboard.press('KeyP');
      check(await G(() => window.__GAME__.state.paused), 'P did not pause');
      await page.keyboard.press('Escape');
      check(!(await G(() => window.__GAME__.state.paused)), 'Esc did not close the pause card');
    }
    steps.push('pause');

    // ---------- 9b. Ladder: objective complete -> Workshop -> level 2; life lost -> retry; game over -> continue
    const prof = () => G(() => { const p = window.__GAME__.save.profile; return { run: p.run, req: p.requisition, best: p.bestScore }; });
    const before = await prof();
    await G(() => window.__GAME__.winBattle());
    await page.locator('.card-result').waitFor({ timeout: 6000 });
    check(/OBJECTIVE COMPLETE/.test(await page.locator('.stamp').textContent()), 'win stamp missing');
    await shot('8-objective-complete');
    let pr = await prof();
    check(pr.run.level === 2 && pr.run.score > 0 && pr.req > before.req, `win did not advance the run (${JSON.stringify(pr)})`);
    await tapButton('Workshop');
    check(await page.locator('.workshop').isVisible(), 'Workshop did not open');
    await shot('8b-workshop');
    await tapButton('Start level 2');
    s = await range();
    check(s.level === 2 && !s.result, `Workshop did not start level 2 (level ${s.level})`);
    await wait(600);
    await shot('9-level-2');
    await G(() => window.__GAME__.loseSquad());
    await page.locator('.card-result').waitFor({ timeout: 6000 });
    check(/LIFE LOST/.test(await page.locator('.stamp').textContent().catch(() => '')), 'no life-lost card');
    check((await prof()).run.lives === 2, 'losing did not cost a life');
    await shot('10-life-lost');
    await tapButton('Retry');
    for (let k = 0; k < 2; k++) {
      await G(() => window.__GAME__.loseSquad());
      await page.locator('.card-result').waitFor({ timeout: 6000 });
      if (k === 0) await tapButton('Retry');
    }
    check(/GAME OVER/.test(await page.locator('.stamp').textContent().catch(() => '')), 'no game-over card at 0 lives');
    await shot('10b-game-over');
    await tapButton('Continue at level 2');
    pr = await prof();
    check(pr.run.active && pr.run.lives === 3 && pr.run.level === 2, `continue after game over wrong (${JSON.stringify(pr.run)})`);
    check(pr.best > 0, 'best score not kept');
    check(await G(() => window.__GAME__.sane()), 'physics produced NaN');
    steps.push('win, workshop, life lost, game over, continue');

    // ---------- 9d. Drafting Office: invalid placement explained, valid placement, save Mk.II, test drive
    await G(() => window.__GAME__.go('workshop'));
    await page.locator('.ws-edit').first().click();
    await page.locator('.dz-part[data-part="arm40"]').click();
    const dz = await G(() => {
      const S = window.__GAME__.SCREENS.designer;
      let spot = null;
      for (let y = 0; y < S.st.d.h && !spot; y++) for (let x = 0; x < S.st.d.w && !spot; x++) if (!S.placeCheck('arm40', x, y)) spot = { x, y };
      return { ox: S.gridRect.ox, oy: S.gridRect.oy, cs: S.cs, spot, n: S.st.d.cells.length };
    });
    const tapAt = async (x, y) => { if (vp.mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); await wait(120); };
    await tapAt(dz.ox + dz.cs * 0.5, dz.oy + dz.cs * 0.5);
    check(/touch the rest/.test(await page.locator('.dz-msg').textContent()), 'invalid placement not explained');
    await shot('12-designer-invalid');
    await tapAt(dz.ox + (dz.spot.x + 0.5) * dz.cs, dz.oy + (dz.spot.y + 0.5) * dz.cs);
    const n2 = await G(() => window.__GAME__.SCREENS.designer.st.d.cells.length);
    check(n2 === dz.n + 1, 'valid placement did not add the part');
    await page.locator('.dz-part[data-part="arm40"]').click();     // put the brush down
    await shot('13-designer-placed');
    await tapButton('Save');
    const saved = await G(() => window.__GAME__.save.designs.list.slice(-1)[0]);
    check(saved && saved.mark === 2 && /Mk\.II/.test(saved.name) && saved.changelog.some((l) => /Armour 40/.test(l)), `save did not create Mk.II with a change log (${saved && saved.name})`);
    await tapButton('Test drive');
    await page.locator('.card .btn-primary').first().click();
    await wait(120);
    check((await G(() => window.__GAME__.screens.name)) === 'battle' && (await G(() => window.__GAME__.battle().test)), 'test drive did not start');
    await wait(500);
    await shot('14-test-drive');
    await tapCtrl('pause');
    await tapButton('Back to the Workshop');
    check((await G(() => window.__GAME__.screens.name)) === 'designer', 'test drive did not return to the designer');
    // Ships (Part 2a): the gunboat on the blueprint (waterline marker), then a sea trial driven with the pad.
    await G(() => { const S = window.__GAME__.SCREENS.designer; S.load(window.__GAME__.designFromTemplate('gunboat'), null, true); S.build(); });
    await wait(300);
    check(/reserve/.test(await page.locator('.dz-top').textContent()), 'ship chips missing on the blueprint');
    await shot('13b-designer-ship');
    await tapButton('Test drive');
    await page.locator('.card .btn-primary').first().click();
    await wait(120);
    await wait(400);
    const sea0 = await G(() => { const B = window.__GAME__.battle(); return { range: B.cfg.range, x: B.me.body.x }; });
    check(sea0.range === 'sea', 'ship test drive did not use the sea range');
    const rc = await ctrl('right');
    if (vp.mobile) { await touch('touchStart', [{ x: rc.cx, y: rc.cy, id: 3 }]); await wait(2500); await touch('touchEnd', [{ x: rc.cx, y: rc.cy, id: 3 }]); }
    else { await page.keyboard.down('KeyD'); await wait(2500); await page.keyboard.up('KeyD'); }
    const sea1 = await G(() => window.__GAME__.battle().me.body.x);
    check(sea1 > sea0.x + 3, `the ship did not move with the drive pad (${sea0.x.toFixed(1)} → ${sea1.toFixed(1)})`);
    await shot('14b-sea-trial');
    await tapCtrl('pause');
    await tapButton('Back to the Workshop');
    // Aircraft (Part 2c): the fighter on the blueprint (centre of lift), then a helicopter flown
    // with the pad: ▲ climbs, ▶ moves.
    await G(() => { const S = window.__GAME__.SCREENS.designer; S.load(window.__GAME__.designFromTemplate('fighter'), null, true); S.build(); });
    await wait(300);
    check(/T\/W/.test(await page.locator('.dz-top').textContent()), 'aircraft chips missing on the blueprint');
    await shot('13c-designer-aircraft');
    await G(() => { const S = window.__GAME__.SCREENS.designer; S.load(window.__GAME__.designFromTemplate('heli'), null, true); S.build(); });
    await wait(200);
    await tapButton('Test drive');
    await page.locator('.card .btn-primary').first().click();
    await wait(120);
    await wait(400);
    const h0 = await G(() => { const B = window.__GAME__.battle(); return { y: B.me.body.y, x: B.me.body.x, range: B.cfg.range }; });
    const hold = async (id, ms) => {
      const c = await ctrl(id);
      if (!c) { errors.push(`control ${id} not shown`); return; }
      if (vp.mobile) { await touch('touchStart', [{ x: c.cx, y: c.cy, id: 4 }]); await wait(ms); await touch('touchEnd', [{ x: c.cx, y: c.cy, id: 4 }]); }
      else { await page.mouse.move(c.cx, c.cy); await page.mouse.down(); await wait(ms); await page.mouse.up(); }
    };
    await hold('up', 2500);
    await hold('right', 2000);
    const h1 = await G(() => { const B = window.__GAME__.battle(); return { y: B.me.body.y, x: B.me.body.x }; });
    check(h0.range === 'air' && h1.y > h0.y + 5 && h1.x > h0.x + 2, `helicopter did not fly with the pad (${JSON.stringify([h0, h1])})`);
    await shot('14c-test-flight');
    await tapCtrl('pause');
    await tapButton('Back to the Workshop');
    // Design lineage (Part 2d): the Mk.II saved above shows its family tree.
    await G(() => window.__GAME__.go('workshop'));
    await wait(200);
    await page.locator('.ws-lineage').first().click();
    await wait(200);
    check((await page.locator('.lin-row').count()) >= 1 && /template/.test(await page.locator('.lin-origin').textContent()), 'lineage view did not show the family tree');
    await shot('15b-lineage');
    await tapButton('Close');
    await G(() => window.__GAME__.ladder.resume());
    await wait(200);
    steps.push('designer, Mk.II, test drive, sea trial, test flight, lineage');

    // ---------- 9e. Art contract (design/07): placeholder art with origin, pivot and muzzle markers
    if (!vp.mobile) {
      await G(() => window.__GAME__.artTest());
      await wait(400);
      check(await G(() => !!window.__GAME__.art.get('c37') && !!window.__GAME__.art.get('frame') && !window.__GAME__.art.failed.length), 'placeholder art did not load');
      await G(() => {
        const d = window.__GAME__.ladder.squadDesigns()[1];
        window.__GAME__.go('designer', { design: d, base: d, owned: true });
        const S = window.__GAME__.SCREENS.designer;
        const g = S.st.d.cells.find((c) => c.p === 'c37');
        let spot = null;
        for (let dy = -1; dy <= 1 && !spot; dy++) for (let dx = -1; dx <= 2 && !spot; dx++) if (!S.placeCheck('frame', g.x + dx, g.y + dy)) spot = { x: g.x + dx, y: g.y + dy };
        if (spot) S.st.d.cells.push({ p: 'frame', x: spot.x, y: spot.y });
        S.st.zoom = 1.6; S.layout(); S.refresh();
      });
      await wait(300);
      await shot('art-1-designer');
      await G(() => { const S = window.__GAME__.SCREENS.designer; S.testDrive(); });
      await page.locator('.card .btn-primary').first().click();
      await wait(600);
      await G(() => { const S = window.__GAME__.SCREENS.battle; S.cam.follow = false; S.cam.manual = true; S.cam.zoom = 2; S.cam.x = S.B.me.body.x; S.cam.y = S.B.me.body.y + 1; window.__GAME__.input.lastWorldTouch = performance.now() + 1e5; });
      await wait(300);
      await shot('art-2-battle');
      await G(() => { window.__GAME__.go('battle', { level: 4 }); const S = window.__GAME__.SCREENS.battle; const e = S.B.units.find((u) => u.side === 1); S.B.revealAll = true; S.cam.follow = false; S.cam.manual = true; S.cam.zoom = 2; S.cam.x = e.body.x; S.cam.y = e.body.y + 1; window.__GAME__.input.lastWorldTouch = performance.now() + 1e5; });
      await wait(400);
      await shot('art-3-enemy-mirrored');
      await G(() => { const A = window.__GAME__.art; A.usePlaceholders = false; A.debug = false; A.init(); });
      steps.push('art contract placeholders');
    }

    // ---------- 9f. SVG part art (step 2.5b): both sides' colours, barrel pivot and muzzle, phone scale
    {
      await wait(300);
      const sv = await G(() => window.__GAME__.svgArtCheck());
      check(!sv.missing.length && !sv.failed.length, `SVG art not ready: missing ${sv.missing.join(', ')}; failed ${sv.failed.join(', ')}`);
      for (const m of sv.muzzle) check(m.off < 0.01 && m.kick > 0, `c75 shell did not leave from the art's muzzle (facing ${m.dir}): ${m.off.toFixed(3)} m off, kick ${m.kick}`);
      const closeUp = async (level, side, elev, name) => {
        await G(([level, side, elev]) => {
          const g = window.__GAME__;
          g.go('battle', level ? { level } : { test: g.designFromTemplate('medium') });
          for (const p of g.SCREENS.battle.B.pending) p.at = 0;      // later waves arrive now
        }, [level, side, elev]);
        await wait(300);
        await G(([level, side, elev]) => {
          const g = window.__GAME__;
          const S = g.SCREENS.battle;
          S.B.cfg.light = 'day'; S.B.cfg.weather = 'clear'; S.B.revealAll = true;
          const V = S.B.units.find((u) => u.side === side && u.weapons.some((w) => w.def.id === 'c75'));
          const w = V.weapons.find((x) => x.def.id === 'c75');
          if (!S.frozen) g.toggleTime();
          w.angle = V.dir > 0 ? V.body.a + elev * Math.PI / 180 : V.body.a + Math.PI - elev * Math.PI / 180;
          S.cam.follow = false; S.cam.manual = true; S.cam.zoom = 3; S.cam.x = V.body.x + V.dir * 1.5; S.cam.y = V.body.y + 1.5;
          g.input.lastWorldTouch = performance.now() + 1e5;
        }, [level, side, elev]);
        await wait(400);
        await shot(name);
        await G(() => { const g = window.__GAME__; if (g.SCREENS.battle.frozen) g.toggleTime(); });
      };
      await closeUp(0, 0, 15, 'svg-1-league-c75');
      await closeUp(11, 1, 8, 'svg-2-directorate-c75');
      steps.push('SVG art');
    }

    // ---------- 9f2. Part 5b: the Missile tab in the Drafting Office
    {
      await G(() => { const g = window.__GAME__; const d = g.designFromTemplate('medium'); d.cells.push({ p: 'rack', x: 0, y: 2 }); g.go('designer', { design: d, base: null, owned: true }); });
      await wait(300);
      const hit = (sel) => (vp.mobile ? page.locator(sel).tap() : page.locator(sel).click());
      await tapButton('Missiles');
      await wait(200);
      check(await page.locator('.card-missile .ms-part').count() === 4, 'Missile tab did not show the ship\'s missile');
      await hit('.ms-brush[data-part="mw_emp"]');
      await hit('.ms-part[data-part="mw_he"]');
      await hit('.ms-cell[data-x="3"][data-y="0"]');
      await wait(100);
      check(await page.locator('.ms-part[data-part="mw_emp"]').count() === 1, 'placing a missile part did nothing');
      await tapButton('Save as new');
      await wait(100);
      check(await G(() => window.__GAME__.save.designs.missiles.length === 1), 'saving a missile design did nothing');
      await tapButton('Carry on this ship');
      check(await G(() => /^m/.test(window.__GAME__.SCREENS.designer.st.d.missile || '')), 'the ship did not take the new missile');
      await shot('16b-missile-tab');
      await tapButton('Close');
      await G(() => { window.__GAME__.save.designs.missiles.length = 0; });
      steps.push('missile tab');
      // Part 5c: the Drone tab, on the drone carrier truck.
      await G(() => { const g = window.__GAME__; g.go('designer', { design: g.designFromTemplate('drone_truck'), base: null, owned: true }); });
      await wait(300);
      await tapButton('Drones');
      await wait(200);
      check(await page.locator('.card-missile .ms-part').count() === 5, 'Drone tab did not show the gun drone');
      await hit('.ms-brush[data-part="dcharge"]');
      await hit('.ms-part[data-part="dgun"]');
      await hit('.ms-cell[data-x="4"][data-y="2"]');
      await wait(100);
      check(await page.locator('.ms-part[data-part="dcharge"]').count() === 1, 'placing a drone part did nothing');
      await tapButton('Save as new');
      await tapButton('Use in this ship’s hangars');
      check(await G(() => /^u/.test(window.__GAME__.SCREENS.designer.st.d.drone || '')), 'the ship did not take the new drone');
      await shot('16c-drone-tab');
      await tapButton('Close');
      await G(() => { window.__GAME__.save.designs.drones.length = 0; });
      steps.push('drone tab');
    }

    // ---------- 9g. Step 2.6: three on the field, command wheel, reserve drawer, Battle Simulator
    {
      if (!vp.mobile) {
        const rc = await G(() => window.__GAME__.reserveCheck());
        check(rc.start.field === 3 && rc.start.enemies === 3 && rc.start.reserve.join() === 'assault,truck' && rc.start.enemyReserve === 2, `three on the field: wrong start ${JSON.stringify(rc.start)}`);
        check(rc.replaced.slot0 === 'assault' && rc.replaced.reserve.join() === 'truck', `destroyed ship not replaced in line-up order ${JSON.stringify(rc.replaced)}`);
        check(rc.pulled.withdrawn && rc.pulled.last === 'light' && rc.pulledReplaced.fromReserve && rc.pulledReplaced.slot1 === 'truck', `pull back did not rotate ${JSON.stringify([rc.pulled, rc.pulledReplaced])}`);
        check(rc.enemyPulls.pulling, `enemy did not pull back a damaged ship ${JSON.stringify(rc.enemyPulls)}`);
        check(rc.result === 'win' && rc.kills === rc.total, `battle not won when the enemy ran out ${JSON.stringify(rc)}`);
      }
      await G(() => window.__GAME__.go('title'));
      await wait(200);
      await tapButton('Battle Simulator');
      await wait(300);
      await shot('16-simulator');
      await tapButton('Fight');
      await wait(700);
      check(await G(() => { const B = window.__GAME__.SCREENS.battle.B; return !!(B && B.rotation && B.squad.length === 3 && B.reserve[0].length === 1); }), 'Battle Simulator did not start a battle with reserves');
      // Long-press ship card 2: the command wheel opens; Pull back orders that ship off the field.
      const c2 = await ctrl('card1');
      if (vp.mobile) { await touch('touchStart', [{ x: c2.cx, y: c2.cy, id: 7 }]); await wait(650); await touch('touchEnd', [{ x: c2.cx, y: c2.cy, id: 7 }]); }
      else { await page.mouse.move(c2.cx, c2.cy); await page.mouse.down(); await wait(650); await page.mouse.up(); }
      await wait(150);
      check(await page.locator('.cmd-wheel').count() === 1, 'long-press on a ship card did not open the command wheel');
      await shot('17-command-wheel');
      await tapButton('Pull back');
      check(await G(() => window.__GAME__.SCREENS.battle.B.squad[1].pulling === true), 'Pull back from the command wheel did nothing');
      await tapCtrl('reserve');
      await wait(200);
      check(await page.locator('.card-reserve').count() === 1, 'reserve drawer did not open');
      await shot('18-reserve-drawer');
      await tapButton('Close');
      if (!vp.mobile) {
        // Right-click one of your ships for its wheel.
        const at = await G(() => { const B = window.__GAME__.SCREENS.battle.B; const V = B.squad[0]; return { x: window.__GAME__.view.sx(V.body.x), y: window.__GAME__.view.sy(V.body.y + V.height / 2) }; });
        await page.mouse.click(at.x, at.y, { button: 'right' });
        await wait(150);
        check(await page.locator('.cmd-wheel').count() === 1, 'right-click on your ship did not open the command wheel');
        await page.mouse.click(640, 150);
      }
      // ---------- 9h. Step 2.7: airships fly, climb, descend, move, fall when holed, and fight inland and at sea
      if (!vp.mobile) {
        const as = await G(() => window.__GAME__.airshipCheck());
        check(as.hold.domain === 'airship' && Math.abs(as.hold.alt - 30) <= 2, `airship did not hold its height ${JSON.stringify(as.hold)}`);
        check(as.climb.alt >= 45 && as.descend.alt <= 15, `airship did not climb and descend ${JSON.stringify([as.climb, as.descend])}`);
        check(as.move.dx > 40 && Math.abs(as.hold.tilt) < 5, `airship did not move or keep level ${JSON.stringify(as.move)}`);
        check(as.holed.alt <= 2, `airship with its envelope shot away did not come down ${JSON.stringify(as.holed)}`);
        for (const k of ['inland', 'sea']) check(as[k].deployed && as[k].shots > 0 && as[k].alt > 10, `gunship did not fight ${k} ${JSON.stringify(as[k])}`);
      }
      // ---------- 9i. Step 2.8: classes and paint
      if (!vp.mobile) {
        const cc = await G(() => window.__GAME__.classCheck());
        check(!cc.none.length, `templates without a class: ${cc.none.join(', ')}`);
        check(cc.misfit.length === 2, `class limits not explained: ${JSON.stringify(cc.misfit)}`);
        const pc = await G(() => window.__GAME__.paintCheck());
        check(pc.ready && pc.svg.directorate > 8 && pc.structure.directorate > 50 && pc.leagueInDirectorate.svg < 2 && pc.leagueInDirectorate.structure < 2, `Directorate paint not shown on SVG parts and structure ${JSON.stringify(pc)}`);
        await G(() => { const g = window.__GAME__; g.go('designer', { design: g.designFromTemplate('medium'), base: null, owned: true }); const D = g.SCREENS.designer; D.st.d.paint = { scheme: 'clans', camo: 'splinter' }; D.refresh(); });
        await tapButton('Paint');
        await wait(900);
        await shot('20-paint');
        await tapButton('Done');
        await tapButton('Tank ▾');
        await wait(200);
        await shot('21-classes');
        await tapButton('Cancel');
      }
      await G(() => {
        const g = window.__GAME__;
        Object.assign(g.save.profile.sim, { field: 'coast', lineup: ['light', 'gunship_t2', 'gunboat'], enemy: [] });
        g.go('battle', g.SCREENS.simulator.battleArg());
      });
      await wait(2500);
      await G(() => {
        const S = window.__GAME__.SCREENS.battle;
        const V = S.B.squad.find((U) => U.domain === 'airship');
        S.cam.follow = false; S.cam.manual = true; S.cam.zoom = 1.6; S.cam.x = V.body.x + 4; S.cam.y = V.body.y + 2;
        window.__GAME__.input.lastWorldTouch = performance.now() + 1e5;
      });
      await wait(300);
      await shot('19-airship');
      // ---------- 9j. Part 3: the campaign (world map, fleets, fuel, markets, contact, results)
      if (!vp.mobile) {
        const cc = await G(() => window.__GAME__.campaignCheck());
        for (const [f, st] of Object.entries(cc.starts)) check(st.home === 'city,fort,village,village' && st.capCoastal && st.fleets === 'land:4,sea:4,air:4' && st.ga, `campaign start wrong for ${f}: ${JSON.stringify(st)}`);
        check(cc.rules.landToSea && cc.rules.seaToLand && cc.rules.airAnywhere, `domain movement rules wrong ${JSON.stringify(cc.rules)}`);
        check(cc.burn.after < cc.burn.before && cc.burn.moved, `moving did not burn fuel ${JSON.stringify(cc.burn)}`);
        check(cc.strandWarn && cc.airStranded.stranded && !cc.airStranded.moved, `stranding wrong ${JSON.stringify([cc.strandWarn, cc.airStranded])}`);
        check(!cc.refuel.why && cc.refuel.spent === cc.refuel.quote && cc.refuel.spent > 0 && cc.refuel.full, `refuel from the treasury wrong ${JSON.stringify(cc.refuel)}`);
        check(cc.contact && cc.auto.shipsAfter === cc.auto.shipsBefore - cc.auto.lostMine - cc.auto.lostTheirs, `contact or auto-resolve wrong ${JSON.stringify([cc.contact, cc.auto])}`);
        check(cc.persist.saved && cc.reload, `campaign results did not persist through save and load ${JSON.stringify([cc.persist, cc.reload])}`);
        check(cc.detach.inGarrison && cc.detach.outpost && cc.detach.back && cc.detach.alone === 0, `detach, garrison or outpost wrong ${JSON.stringify(cc.detach)}`);
        check(cc.deploy.field === 'inland' && cc.deploy.domains === 'land', `a ship deployed inland ${JSON.stringify(cc.deploy)}`);
        // Part 4a: warehouses, production, markets, loading, stores, upgrades, running dry, old saves.
        const ec = await G(() => window.__GAME__.economyCheck());
        const E = (c, what) => check(c, `${what} ${JSON.stringify(ec)}`);
        E(ec.kit.wood === 80 && ec.kit.metal === 60 && ec.kit.elec === 5, 'home warehouse starting kit wrong');
        E(ec.production.made > 0 && Math.abs(ec.production.made - ec.production.expect) < 0.01 && ec.production.neutral === 0, 'daily production wrong');
        E(ec.capped, 'a warehouse overfilled');
        E(!ec.buy.why && Math.abs(ec.buy.paid - ec.buy.price) < 0.01, 'buying metal into the warehouse wrong');
        E(ec.scrap.buy !== '' && ec.scrap.sell === '' && ec.scrap.left === 15, 'scrap should be sell-only');
        E(!ec.load.why && ec.load.cap > 0 && ec.load.hold === 10 && ec.load.store === 10 && ec.undocked, 'loading a docked hold wrong');
        E(ec.stores.fromStore > 0 && Math.abs(ec.stores.used - ec.stores.fromStore) < 0.01 && Math.abs(ec.stores.paid - ec.stores.cost) < 0.01, 'refuelling from the warehouse wrong');
        E(ec.fieldRearm.why === '', 'rearming from the hold failed');
        E(ec.upBlocked && !ec.upgrade.why && ec.upgrade.type === 'city', 'settlement upgrade wrong');
        E(ec.dry.unpaid >= 8 && ec.dry.deserted > 0 && ec.dry.closed, 'running out of money had no effect');
        const wc = await G(() => window.__GAME__.workshopCheck());
        const W = (c, what) => check(c, `${what} ${JSON.stringify(wc)}`);
        W(wc.empty !== '' && wc.craft === '' && wc.queued === 1 && wc.made.items === 1 && wc.made.metal === 0 && Math.abs(wc.made.paid - wc.made.fee) < 0.01, 'crafting from warehouse goods wrong');
        W(wc.away !== '' && wc.docked === '', 'crafting should use a docked hold but not a hold elsewhere');
        W(wc.refine === '' && wc.refined === 2, 'refining scrap wrong');
        W(wc.build === '' && wc.built.ships === 1 && wc.built.garrison && wc.built.captain && wc.seaInland !== '', 'building a ship wrong');
        W(wc.repair === '' && wc.repaired, 'dock repair wrong');
        W(wc.refit === '' && wc.refitted.design === 'scout' && wc.refitted.returned > 0, 'refit wrong');
        W(wc.noBay && wc.dryHold && wc.fieldRepaired, 'field repair wrong');
        const rc = await G(() => window.__GAME__.recruitCheck());
        const R = (c, what) => check(c, `${what} ${JSON.stringify(rc)}`);
        R(rc.hireCap === '' && rc.captain.ok && rc.captain.level === rc.captain.want && rc.captain.paid === rc.captain.price, 'hiring a captain with a ship wrong');
        R(rc.hireAdm === '' && rc.hireQm === '' && !rc.qmAtFort, 'hiring an admiral or quartermaster wrong');
        R(rc.form === '' && rc.formed.fleets === 1 && rc.formed.ships === 1 && rc.formed.admiral && rc.formed.docked, 'forming a fleet wrong');
        R(rc.promoteLow && rc.promote === '' && rc.promoted.rank === 'admiral' && rc.promoted.ship && rc.promoted.idle, 'promotion wrong');
        R(Math.abs(rc.salvage.partRate - 0.12) < 0.03 && Math.abs(rc.salvage.scrap - 0.3) < 0.001 && rc.salvage.cond, 'salvage rates wrong');
        R(rc.wreck.left === 12 && rc.wreck.sites === 1 && rc.collect === '' && rc.collected.scrap === 12 && rc.collected.items === 1 && rc.collected.sites === 0 && rc.expired, 'wreck sites wrong');
        R(rc.fields >= 6 && rc.noCrane && rc.gather.got === 8 && rc.gather.field === 8, 'scrap fields wrong');
        R(rc.studyCity && !rc.lockedBefore && rc.study === '' && rc.consumed && rc.unlocked, 'reverse-engineering wrong');
        const vc = await G(() => window.__GAME__.convoyCheck());
        const V = (c, what) => check(c, `${what} ${JSON.stringify(vc)}`);
        V(vc.form === '' && vc.convoy.ships === 3 && vc.convoy.combat === 1 && vc.convoy.cap > 0, 'forming a convoy wrong');
        V(vc.noGoods && vc.route === '' && vc.run.trips >= 2 && vc.run.fuelGot > 0 && vc.run.ammo > 0.9 && !vc.run.stranded && vc.run.storeUsed > 0, 'the supply route did not keep the fleet going');
        V(vc.raid && vc.contact && vc.lost.gone, 'convoy raiding or interception wrong');
        const sg = await G(() => window.__GAME__.siegeCheck());
        const Q = (c, what) => check(c, `${what} ${JSON.stringify(sg)}`);
        Q(sg.block === '' && sg.structures.walls === 2 && sg.structures.keep && sg.structures.emplacements === sg.structures.slots && sg.structures.side === 1 && sg.structures.anchored && sg.structures.militia >= 1 && sg.wallStill, 'siege defences wrong');
        Q(sg.keepWin === 'win' && sg.captured.owner === 'league' && sg.captured.restart === 2 && sg.captured.plunder === 10, 'capturing by the keep wrong');
        Q(sg.restart.day1 === 0 && sg.restart.day2 > 0 && sg.restart.plunderPaid, 'production restart or plunder wrong');
        Q(sg.install === '' && sg.installed && sg.defend.side === 0 && sg.defend.empl && sg.defend.squad > 0, 'emplacements or defending wrong');
        Q(sg.held.owner === 'league' && sg.held.walls < 0.9 && sg.held.mended && sg.auto, 'a failed siege should leave mending walls');
        Q(sg.aiTarget && sg.aiSiege, 'the AI did not besiege a weak settlement');
        // Part 5a: research, perks and ranks.
        const rs = await G(() => window.__GAME__.researchCheck());
        const RS = (c, what) => check(c, `${what} ${JSON.stringify(rs)}`);
        RS(rs.cp1 === 0 && rs.noCp !== '' && rs.level === 4 && rs.cp4 === 6, 'Command Points from rank wrong');
        RS(rs.lockedBefore && rs.craftBefore === 'Not researched.' && rs.heavyBlocked !== '' && rs.start === '' && rs.paid === 400 && rs.cpAfter === 4 && rs.busy !== '', 'starting research wrong');
        RS(rs.known && rs.unlocked && rs.craftAfter !== 'Not researched.' && /not researched/.test(rs.designerLocked) && rs.designerOk === '', 'research did not unlock crafting and the Drafting Office');
        RS(rs.treeCp > rs.maxCp * 2, 'the tech tree does not force choices');
        RS(rs.perk === '' && rs.priceRatio === 0.92 && rs.wider !== '' && rs.gaCap === 4, 'perks or fleet size wrong');
        RS(rs.acc === 1.08 && rs.react === 0.88 && rs.stopped && rs.captureXp === 300, 'captain skill, lost research or capture XP wrong');
        steps.push('research and perks');
        // Part 5b2: missiles as items.
        const ms = await G(() => window.__GAME__.missileStockCheck());
        const MS = (c, what) => check(c, `${what} ${JSON.stringify(ms)}`);
        MS(/metropolis/.test(ms.city) && /not researched/.test(ms.locked) && ms.craft === '' && ms.made === 4 && Math.abs(ms.space - 4 * ms.unitEach) < 0.05, 'crafting missiles wrong');
        MS(ms.before.n === 0 && ms.load === '' && ms.after.n === 4 && ms.stockAfter === 0 && ms.full !== '', 'loading missiles wrong');
        MS(ms.inBattle === 4 && ms.left === 3 && ms.home.n === 3 && ms.emptyRounds === 0 && ms.transfer === '' && ms.inHold === 2, 'missiles in battle or holds wrong');
        steps.push('missile stock');
        // Part 5c: drones.
        const dc = await G(() => window.__GAME__.droneCheck());
        const DC = (c, what) => check(c, `${what} ${JSON.stringify(dc)}`);
        DC(dc.library.length === 4 && dc.library.every((d) => !d.errors.length) && dc.noCore.length && dc.heavy.length && dc.tooBig.length, 'drone designs or their rules wrong');
        DC(dc.carrier.cap === 4 && dc.carrier.cpu === 2 && dc.attack.launched === 2 && dc.attack.maxFlying === 2 && dc.attack.shots > 0 && dc.attack.damage > 0, 'gun drones did not launch within the computer limit and attack');
        DC(dc.recall.aboard === 4 && dc.recall.flying === 0 && dc.lost.up > 0 && dc.lost.after === 0 && dc.lost.lost >= dc.lost.up, 'recall or losing drones with the carrier wrong');
        DC(dc.strike.hits > 0 && dc.strike.damage > 50 && dc.scout.seen && dc.aa.lost > 0, 'strike, scout or shooting drones down wrong');
        DC(dc.cpu2.design === 'drn_heavy' && dc.cpu2.maxFlying === 4 && dc.cpu1Heavy === 'drn_gun', 'drone computer size limits wrong');
        steps.push('drones');
        // Part 5c2: air wings, and drones and aircraft as campaign items.
        const wc2 = await G(() => window.__GAME__.wingCheck());
        const WG = (c, what) => check(c, `${what} ${JSON.stringify(wc2)}`);
        WG(wc2.cap === 2 && wc2.design === 'fighter' && wc2.recall.launched === 2 && wc2.recall.maxUp === 2 && wc2.recall.aboard === 2 && wc2.recall.flying === 0, 'air wing launch or recall wrong');
        WG(wc2.fight.engaged && wc2.lost.up > 0 && wc2.lost.after === 0 && wc2.lost.lost >= wc2.lost.up && wc2.notInSquad, 'air wing fight or loss with the carrier wrong');
        const as2 = await G(() => window.__GAME__.airStockCheck());
        const AS = (c, what) => check(c, `${what} ${JSON.stringify(as2)}`);
        AS(/metropolis/.test(as2.cityDrones) && as2.drones === '' && as2.made.drones === 4 && as2.made.wings === 1 && as2.space > 10, 'making drones or aircraft wrong');
        AS(as2.loadD === '' && as2.loadW === '' && as2.carried.drones.n === 4 && as2.carried.wing.n === 1 && as2.inBattle.drones === 4 && as2.inBattle.wing === 1, 'loading drones or aircraft wrong');
        AS(as2.home.drones === 3 && as2.after.drones.n === 3 && as2.after.wing.n === 1 && as2.empty === 0, 'drones or aircraft coming home wrong');
        steps.push('air wings and air stock');
        const aa = await G(() => window.__GAME__.airAimCheck());
        check(['gunship_t0', 'heli'].every((k) => aa[k].said === '' && aa[k].shots > 0 && aa[k].err <= 3 && aa[k].down && aa[k].behind === 'Out of arc'), `airship or helicopter guns don't aim at the target within their arc ${JSON.stringify(aa)}`);
        steps.push('air aiming');
        // Part 5d: energy weapons, flamethrowers, damage types.
        const en = await G(() => window.__GAME__.energyCheck());
        const EN = (c, what) => check(c, `${what} ${JSON.stringify(en)}`);
        EN(en.heat.shots === 6 && en.heat.locked && en.heat.coolSecs > 3 && en.heat.coolSecs < 12, 'laser heat lockout or cooling wrong (lasers need no shells)');
        EN(en.power.need > en.power.made && en.power.weak > en.power.reload * 1.2 && en.power.capped < en.power.weak && Math.abs(en.power.strong - en.power.reload) < 0.1, 'energy recharge by spare power or capacitor wrong');
        EN(en.laser.damage > 20 && en.laser.beam > 0 && en.laser.secs < 0.2 && en.plasma.damage > 50 && en.plasma.secs > 0.3, 'laser beam or plasma bolt wrong');
        EN(en.flame.damage > 50 && en.flame.fires > 0 && en.flame.fuelUsed > 0 && en.flame.farDamage === 0, 'flamethrower reach, burning or fuel wrong');
        EN(en.resist.compositeFire === en.resist.plateFire / 2 && en.resist.compositeKinetic === en.resist.plateFire && en.resist.compositePlasma < en.resist.compositeKinetic, 'damage-type resistances wrong');
        steps.push('energy weapons');
        // Part 5e: fabricators, release clamps, the tier 3–4 music layer.
        const fc = await G(() => window.__GAME__.fabClampCheck());
        const FC = (c, what) => check(c, `${what} ${JSON.stringify(fc)}`);
        FC(fc.drones.aboard === 3 && fc.after.aboard === 4 && fc.after.rounds === 3 && fc.after.made === 3 && fc.after.metalUsed > 0 && fc.noGoods === 2, 'fabricator order, rate or goods wrong');
        FC(fc.sections.length === 1 && fc.release === '' && fc.released.units === 2 && fc.released.lighter > 2000 && fc.released.again !== '' && /Too heavy/.test(fc.oneClamp), 'release clamps wrong');
        FC(fc.car && fc.car.onGround && fc.car.canDrive && !fc.car.destroyed, 'released section did not land ready to drive');
        FC(fc.era.laser === 1 && fc.era.light === 0, 'tier 3–4 music layer choice wrong');
        steps.push('fabricators and clamps');
        // Part 6a: the other factions run their own campaigns (30 days, you as the League, no contacts).
        const ai = await G(() => window.__GAME__.aiCheck('league'));
        const AI = (c, what) => check(c, `${what} ${JSON.stringify(ai)}`);
        AI(ai.day >= 30 && ai.neutral.after < ai.neutral.before - 4, 'the AI factions did not take neutral settlements');
        AI(Object.values(ai.built).reduce((a, b) => a + b, 0) > 5 && ai.after.directorate.settlements > ai.before.directorate.settlements, 'the AI factions did not build or expand');
        AI(ai.clashes > 0 && ai.convoys.count > 0 && ai.convoys.trips > 0, 'no AI clashes or AI convoy trips');
        AI(ai.tiers.lumen > ai.tiers.clans && ai.builtDomains.clans.land > ai.builtDomains.clans.sea + ai.builtDomains.clans.air && ai.builtDomains.directorate.land >= ai.builtDomains.directorate.sea, 'AI personalities (tech pace, domains) not showing');
        const ai2 = await G(() => window.__GAME__.aiCheck('directorate'));
        check(ai2.bought > 0 && ai2.builtDomains.league.sea > ai2.builtDomains.league.land + ai2.builtDomains.league.air, `the League AI did not buy villages or prefer the sea ${JSON.stringify(ai2)}`);
        steps.push('faction AI');
        const fp = await G(() => window.__GAME__.factionPartCheck());
        check(!fp.lumenBefore && fp.lumenAfter && !fp.leagueLaser && !fp.leagueHoldBefore && fp.leagueHold && !fp.leagueBoiler && fp.study === 'laser_prism' && fp.leagueStudied, `faction signature part unlocks wrong ${JSON.stringify(fp)}`);
        steps.push('signature parts');
        // Part 6b: AI designs evolve against what you field.
        const ev = await G(() => window.__GAME__.evolveCheck());
        const EV = (c, what) => check(c, `${what} ${JSON.stringify(ev)}`);
        EV(ev.traits.armour === 1 && ev.seen === 5 && ev.counters.join() === 'armour,air', 'what you field was not tallied or read right');
        EV(ev.refits > 3 && ev.penUp.length > 2 && ev.aaAdded.length > 2 && ev.valid && /refit \d+ designs? with/.test(ev.news), 'AI refits wrong or invalid');
        EV(ev.builtRefit && ev.later.length === 0, 'AI does not build its refit, or keeps a faded counter');
        steps.push('evolving AI designs');
        // Part 6c: reputation, truces, war, charters.
        const rl = await G(() => window.__GAME__.relationsCheck());
        const RL = (c, what) => check(c, `${what} ${JSON.stringify(rl)}`);
        RL(rl.start.war.every((r) => r === -20) && rl.start.truce.every((r) => r === 20), 'starting reputation wrong');
        RL(rl.offer === '' && rl.afterOffer.rel === 'truce' && rl.afterOffer.money === 5000 - rl.tribute, 'truce offer did not work or cost the tribute');
        RL(rl.battle.rep === -24 && /quiet days/.test(rl.battle.block) && rl.capture === -25, 'reputation after battle or capture wrong');
        RL(/docked/.test(rl.charterNoFleet) && rl.charter === '' && rl.charterOwner === 'league' && rl.charterPaid === 500 && rl.charterRep.length > 0 && rl.charterRep.every((d) => d === -8), 'charter wrong');
        RL(rl.broke === 'war' && rl.offered === 'truce' && rl.news === 2 && rl.declared.rel === 'war' && rl.aiChanges > 0 && rl.drift === 0, 'truce breaking, offers, war or AI truces wrong');
        steps.push('relations');
        // v0.6.4: support vehicles in the starting fleets, researched-only base designs, ship range.
        const sf = await G(() => window.__GAME__.startFleetCheck());
        const SF = (c, what) => check(c, `${what} ${JSON.stringify(sf)}`);
        SF(sf.fleets.length === 3 && sf.fleets.every((f) => f.support.length === 1 && f.count === 3 && f.ships === 4 && f.fuel > 0), 'starting fleets lack a support vehicle with fuel, or it counts towards the size');
        SF(sf.valid && sf.baseOk && sf.wagon.ok && sf.wagon.moved > 20 && sf.tender.ok && sf.tender.moved > 20 && sf.tender.up >= 0 && sf.airship.ok && sf.airship.up > 5, 'support vehicles broken or unresearched base designs offered');
        SF(sf.seaRange > 60, 'the starting sea fleet has too little range');
        steps.push('starting fleets');
        const fs = await G(() => window.__GAME__.flagshipCheck());
        const FS = (c, what) => check(c, `${what} ${JSON.stringify(fs)}`);
        FS(!fs.flag.support && fs.flag.first && fs.flag.lastSupport && /support/.test(fs.supportFlag) && /flag/.test(fs.detach), 'flagship choice, order or rules wrong');
        FS(fs.battle.me && fs.battle.pennant && fs.battle.enemyFlag, 'flagship not driven first or no pennant in battle');
        FS(fs.lost.newFlag && fs.lost.money === 0.8 && fs.lost.xp === 90 && fs.lost.news === 1 && fs.move, 'losing or moving the flag wrong');
        steps.push('flagships');
        const oc = await G(() => window.__GAME__.officersCheck());
        const OC = (c, what) => check(c, `${what} ${JSON.stringify(oc)}`);
        OC(oc.auto === 1 && oc.can && /Choose/.test(oc.noPick) && oc.up === '' && oc.after.level === 2 && oc.after.traits[0] === 'loaders' && oc.reload === 1.08, 'levelling by hand or captain upgrades wrong');
        OC(oc.gaOwed === 1 && oc.mixBefore !== '' && oc.take === '' && oc.mix === '' && oc.mixed && oc.deploys, 'combined-arms doctrine wrong');
        OC(oc.doctrine.cap === 1 && oc.doctrine.speed === 1.1 && oc.doctrine.burnDrop && oc.recruitsOk && oc.recruits.length > 0 && oc.oldOwed === 2, 'doctrines, recruits or owed upgrades wrong');
        steps.push('officers');
        const wr = await G(() => window.__GAME__.warCheck());
        const WC = (c, what) => check(c, `${what} ${JSON.stringify(wr)}`);
        WC(wr.capitals && wr.battle.counted && wr.battle.destroyed && wr.battle.gallery && wr.medal && wr.once, 'war record, medals or gallery wrong');
        WC(wr.notYet && wr.shareWin && wr.capitalWin && wr.lose && wr.studied, 'winning or losing the war wrong');
        steps.push('war record');
        const fa = await G(() => window.__GAME__.factionArtCheck());
        const FA = (c, what) => check(c, `${what} ${JSON.stringify(fa)}`);
        FA(fa.mat.clipper && !fa.mat.slab && !fa.mat.patchwork && fa.mat.plate && fa.patch.length >= 3, 'faction materials or patchwork variation wrong');
        FA(fa.sails === 1 && !fa.noProp && fa.bareValid && fa.clear.moved > 50 && fa.rain.moved > fa.clear.moved, 'sail vanes wrong');
        FA(fa.magnet === 1.25 && fa.aiPool.length === 9 && fa.baseStart === 0 && fa.baseAll === 9, 'magnet crane or faction designs wrong');
        steps.push('faction art');
        const ap = await G(() => window.__GAME__.airPowerCheck());
        const AP = (c, what) => check(c, `${what} ${JSON.stringify(ap)}`);
        AP(ap.racks.designs > 3 && ap.racks.valid && ap.racks.news && ap.racks.missile === 'msl_s_heat' && ap.racks.loaded && ap.racks.loaded.rounds > 0, 'AI missile racks wrong');
        AP(ap.mine.fields.length === 1 && ap.mine.fields[0].n === 2 && ap.mine.stockLeft === 0 && ap.mine.launched === 2 && ap.mine.back === ap.mine.flying && ap.mine.note && ap.ai[0] === 2, 'airfields wrong');
        steps.push('air power');
        const gc = await G(() => window.__GAME__.garrisonCheck());
        check(gc.garrison > 0 && gc.commanders.includes('grand') && gc.hintsNoFleet && gc.form === '' && gc.formed && gc.formed.ships === gc.garrison && gc.appoint === '' && gc.paid === 600 && gc.appointed === 1 && gc.hints > 0, `forming a fleet from the garrison, appointing an admiral or hints wrong ${JSON.stringify(gc)}`);
        steps.push('garrison and hints');
        E(ec.migrate.ok && ec.migrate.v >= 2 && ec.migrate.store === 80 && ec.migrate.market && ec.migrate.hold, 'the v1 campaign save was not migrated');
      }
      await G(() => window.__GAME__.go('title'));
      await wait(200);
      await tapButton('New campaign');
      await wait(200);
      if (await page.getByRole('button', { name: 'Keep it', exact: true }).count()) await tapButton('Keep it');
      await shot('22-factions');
      await page.locator('.faction-btn').first().click();
      await wait(300);
      if (await page.getByRole('button', { name: /^Start as / }).count()) { await page.getByRole('button', { name: /^Start as / }).click(); await wait(300); }
      check((await G(() => window.__GAME__.screens.name)) === 'map', 'New campaign did not open the world map');
      // First visit: the campaign tips, once.
      check((await page.getByRole('button', { name: 'Got it', exact: true }).count()) === 1, 'the first-time map tips did not show');
      await page.getByRole('button', { name: 'Got it', exact: true }).click();
      await wait(200);
      // Hints (v0.7.2): the Hint button opens ideas for what to do next.
      await page.getByRole('button', { name: 'Hint', exact: true }).click();
      await wait(200);
      check((await page.locator('.card-help .help-p').count()) >= 2, 'the Hint card is empty');
      await shot('23i-hints');
      await page.locator('.card-help').getByRole('button', { name: 'Close', exact: true }).click();
      await wait(150);
      await wait(500);
      await shot('23-world-map');
      await G(() => window.__GAME__.save.setSetting('textSize', 'XL'));
      await wait(400);
      await shot('23-world-map-xl');
      await G(() => window.__GAME__.save.setSetting('textSize', 'M'));
      // Research and perks (Part 5a): the tech tree, a node card, the perk list.
      await tapButton('Research');
      await wait(200);
      check((await page.locator('.rs-node').count()) === 45, 'the tech tree does not show 45 nodes');
      await shot('23b-research');
      await page.locator('.rs-node[data-node="guns_medium"]').click();
      await wait(200);
      check(/Needs 2 Command Points/.test(await page.locator('.card').last().textContent()), 'a node card did not explain the missing Command Points');
      await shot('23c-research-node');
      await page.locator('.card').last().getByRole('button', { name: 'Close', exact: true }).click();
      await wait(150);
      await tapButton('Perks');
      await wait(150);
      check((await page.locator('.rs-perk').count()) === 14, 'the perk list does not show 14 perks');
      await shot('23d-perks');
      await page.locator('.card-research').getByRole('button', { name: 'Close', exact: true }).click();
      await wait(200);
      // Relations (Part 6c): one row per other faction.
      await tapButton('War room');
      await wait(200);
      check((await page.locator('.rel-row').count()) === 4, 'the Relations card does not list 4 factions');
      await shot('23e-relations');
      await page.locator('.card-research').getByRole('button', { name: 'Journal', exact: true }).click();
      await wait(150);
      check((await page.locator('.rel-journal').count()) > 0, 'the war journal is empty');
      await shot('23g-journal');
      await page.locator('.card-research').getByRole('button', { name: 'Victory', exact: true }).click();
      await wait(150);
      await shot('23h-victory');
      await page.locator('.card-research').getByRole('button', { name: 'Close', exact: true }).click();
      await wait(200);
      // Officer card (v0.6.5): a captain of the flag fleet.
      await G(() => window.__GAME__.evalIn("const fl = playerFleets()[0]; const sh = fleetShips(fl).find((q) => byId('officers', q.captainId)); openOfficer(byId('officers', sh.captainId), fl)"));
      await wait(200);
      check(/Captain/.test(await page.locator('.card-research .card-title').textContent()), 'the officer card did not open');
      await shot('23f-officer');
      await page.locator('.card-research').getByRole('button', { name: 'Close', exact: true }).click();
      await wait(200);
      // Moving with real taps (a finger on phones, the mouse on desktop): tap a reachable spot, Move, Start.
      const spot = await G(() => {
        const S = window.__GAME__.SCREENS.map, C = window.__GAME__.camp, fl = S.selFleet();
        S.panelOpen = false; S.refresh();
        for (let r = 4; r < 14; r++) for (let a = 0; a < 24; a++) {
          const cx = fl.x + Math.cos((a * Math.PI) / 12) * r, cy = fl.y + Math.sin((a * Math.PI) / 12) * r;
          if (C.campaign.fleets.some((f) => f.shipIds.length && Math.hypot(f.x - cx, f.y - cy) < 3)) continue;
          // Clear of every settlement by more than the map's tap radius at this zoom.
          const clear = 1.2 * Math.max(1, 12 / S.cam.z) + 1;
          if (C.campaign.settlements.some((q) => Math.hypot(q.x + 0.5 - cx, q.y + 0.5 - cy) < Math.max(2.5, clear))) continue;
          if (C.planMove(fl, cx, cy).why) continue;
          // Put that cell in a clear part of the screen (a few places to try, left first).
          for (const [fx, fy] of [[0.3, 0.55], [0.45, 0.4], [0.2, 0.35], [0.6, 0.45]]) {
            const x = Math.round(innerWidth * fx), y = Math.round(innerHeight * fy);
            S.cam.x = cx - (x - innerWidth / 2) / S.cam.z; S.cam.y = cy - (y - innerHeight / 2) / S.cam.z;
            // Fleet counters are drawn side by side (drawDx), so check where they actually appear.
            if (C.campaign.fleets.some((f) => f.shipIds.length && Math.hypot(S.sx(f.x) + (f.drawDx || 0) - x, S.sy(f.y) - y) < 50)) continue;
            return { x, y, x0: fl.x, y0: fl.y };
          }
        }
        return null;
      });
      check(!!spot, 'no reachable spot on screen for the map tap test');
      if (spot) {
        if (vp.mobile) { await touch('touchStart', [{ x: spot.x, y: spot.y, id: 5 }]); await wait(50); await touch('touchEnd', [{ x: spot.x, y: spot.y, id: 5 }]); }
        else await page.mouse.click(spot.x, spot.y);
        await wait(200);
        check(await page.getByRole('button', { name: 'Move', exact: true }).count() === 1, 'tapping the map with a fleet selected did not show the move preview');
        await shot('23b-move-preview');
        await tapButton('Move');
        await tapButton('Start ▶');
        await wait(2500);
        check(await G((sp) => { const f = window.__GAME__.SCREENS.map.selFleet(); return Math.hypot(f.x - sp.x0, f.y - sp.y0) > 0.2; }, spot), 'the fleet did not move after Move and Start');
      }
      await G(() => {
        const g = window.__GAME__, C = g.camp;
        const land = C.playerFleets().find((f) => f.domain === 'land');
        const e = C.campaign.fleets.find((f) => f.faction !== C.campaign.faction && C.relation(f.faction, C.campaign.faction) === 'war' && f.domain === 'land');
        e.x = land.x + 1; e.y = land.y; e.path = []; e.cooldown = 0; land.cooldown = 0;
        e.x = land.x + 1; e.y = land.y; land.path = [];
        C.campaign.running = true;
      });
      await page.locator('.card-prebattle').waitFor({ timeout: 4000 });
      await shot('24-contact');
      await tapButton('Auto-resolve');
      await wait(300);
      check((await G(() => window.__GAME__.camp.campaign.journal.slice(-1)[0] || '')).includes('enemy ships destroyed'), 'auto-resolve did not record the battle');
      // Settlement panels: the home warehouse (with a truck fleet docked) and the market.
      await G(() => {
        const g = window.__GAME__, C = g.camp, S = g.SCREENS.map;
        const home = C.campaign.settlements.find((q) => q.faction === C.campaign.faction && q.capital);
        S.cam.x = home.x + 10; S.cam.y = home.y;
        S.select('settlement', home.id); S.panelOpen = true; S.tab = 'warehouse'; S.refresh();
      });
      await wait(200);
      await shot('25-warehouse');
      await G(() => { const S = window.__GAME__.SCREENS.map; S.tab = 'market'; S.refresh(); });
      await wait(200);
      await shot('26-market');
      await G(() => { const S = window.__GAME__.SCREENS.map; S.tab = 'workshop'; S.refresh(); });
      await wait(200);
      await shot('27-workshop');
      await G(() => { const S = window.__GAME__.SCREENS.map; S.tab = 'yard'; S.refresh(); });
      await wait(200);
      await shot('28-yard');
      await G(() => {
        const g = window.__GAME__, C = g.camp, S = g.SCREENS.map;
        const fort = C.campaign.settlements.find((q) => q.faction === C.campaign.faction && q.type === 'fort');
        S.cam.x = fort.x + 10; S.cam.y = fort.y;
        S.select('settlement', fort.id); S.tab = 'barracks'; S.refresh();
      });
      await wait(200);
      await shot('29-barracks');
      // A convoy with a route, and the Supply layer.
      await G(() => {
        const g = window.__GAME__, C = g.camp, S = g.SCREENS.map;
        const home = C.campaign.settlements.find((q) => q.faction === C.campaign.faction && q.capital);
        C.campaign.treasury += 5000;
        C.hire(home, C.offersAt(home).find((o) => o.kind === 'quartermaster'));
        const t = C.makeShip("truck", C.campaign.faction, C.rng(1)); t.garrison = home.id;
        C.formConvoy(home, C.idleAt(home, 'quartermaster')[0], 'land');
        const cv = C.campaign.fleets.find((f) => f.convoy);
        const land = C.playerFleets().find((f) => f.domain === 'land' && !f.convoy);
        // The land fleet may have lost the auto-resolve above; then deliver to the fort instead.
        const fort = C.campaign.settlements.find((q) => q.faction === C.campaign.faction && q.type === 'fort');
        C.setRoute(cv, home.id, land ? { fleet: land.id } : { settlement: fort.id }, ['fuel', 'ammo']);
        S.cam.x = home.x + 6; S.cam.y = home.y;
        S.select('fleet', cv.id); S.tab = 'route'; S.logistics = true; S.refresh();
      });
      await wait(200);
      await shot('30-convoy-route');
      await G(() => { const S = window.__GAME__.SCREENS.map; S.panelOpen = false; S.refresh(); });
      await wait(200);
      await shot('31-supply-view');
      await G(() => { const S = window.__GAME__.SCREENS.map; S.logistics = false; S.refresh(); });
      await G(() => window.__GAME__.go('battle', { level: 1 }));
      await wait(200);
      steps.push('three on the field, command wheel, reserve drawer, Battle Simulator, airships, campaign, economy, workshop and yard, recruitment and salvage, convoys, sieges');
    }

    // ---------- 9f. Boss blueprint: clearing level 10 captures the Behemoth for the gallery
    if (!vp.mobile) {
      await G(() => window.__GAME__.ladder.start(10, true));
      await wait(200);
      await G(() => window.__GAME__.winBattle());
      await page.locator('.card-result').waitFor({ timeout: 6000 });
      check(/Blueprint captured/.test(await page.locator('.card-result').textContent()), 'boss blueprint not announced');
      await G(() => window.__GAME__.go('blueprints'));
      await wait(300);
      check((await page.locator('.bp-card').count()) === 1, 'blueprint missing from the gallery');
      await shot('15-blueprints');
      steps.push('boss blueprint, gallery');
    }

    // ---------- 9c. Desktop autoplay: drive and fire until level 1 is won (time runs 4x)
    if (!vp.mobile) {
      await G(() => { window.__TEST__.timeScale = 4; window.__GAME__.save.profile.squad = []; window.__GAME__.ladder.start(1, true); });
      await page.keyboard.down('KeyD');
      let res = null;
      for (let i = 0; i < 90 && !res; i++) {
        await page.keyboard.press('Space');
        await wait(250);
        res = (await range()).result;
        if (i === 12) await shot('11-autoplay');
      }
      await page.keyboard.up('KeyD');
      const t = (await range()).simTime;
      await G(() => { window.__TEST__.timeScale = 1; });
      check(res === 'win', `autoplay did not clear level 1 (result ${res})`);
      console.log(`     autoplay cleared level 1 in ${t.toFixed(0)} s of game time`);
      await page.locator('.card-result').waitFor({ timeout: 6000 });
      await tapButton('Title');
      await page.getByRole('button', { name: /^Continue at level 2/ }).click();
      await wait(150);
      check((await range()).level === 2, 'Continue did not start level 2');
      steps.push('autoplay level 1, continue');
    }

    // ---------- 10. Quit to title, reload: settings are kept
    await tapCtrl('pause');
    await tapButton('Quit to title');
    check((await G(() => window.__GAME__.screens.name)) === 'title', 'quit did not return to title');
    await G(() => window.__GAME__.flush());
    await page.reload();
    await page.waitForTimeout(500);
    const kept = await G(() => ({ music: window.__GAME__.save.settings.music, size: window.__GAME__.save.settings.btnSize }));
    check(kept.music === false && kept.size === 'L', `settings not kept after reload (${JSON.stringify(kept)})`);
    steps.push('reload keeps settings');

    // ---------- 11. Export / import round trip, then a damaged save
    const round = await G(() => {
      const sv = window.__GAME__.save;
      sv.profile.bestScore = 4321;
      const code = sv.exportCode();
      sv.profile.bestScore = 0;
      const res = sv.parseCode(code);
      if (res.ok) res.apply();
      const bad = sv.parseCode('not a code');
      return { ok: res.ok, best: sv.profile.bestScore, badRejected: !bad.ok };
    });
    check(round.ok && round.best === 4321, 'export/import did not round-trip');
    check(round.badRejected, 'a bad import code was accepted');

    await G(() => localStorage.setItem('irondoctrine.profile', '{damaged'));
    await page.reload();
    await page.waitForTimeout(600);
    const dmg = await G(() => ({
      backup: localStorage.getItem('irondoctrine.backup.profile'),
      toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '),
      music: window.__GAME__.save.settings.music,
    }));
    check(dmg.backup === '{damaged', 'damaged save was not kept as a backup');
    check(/couldn't be read/.test(dmg.toast), 'player was not told about the damaged save');
    check(dmg.music === false, 'a damaged profile also reset settings');

    // A save written by the previous version (v1) migrates: an unfinished ladder becomes a run to continue.
    await G(() => localStorage.setItem('irondoctrine.profile', JSON.stringify({ v: 1, t: 1, data: { bestScore: 900, highestLevel: 4, continueLevel: 4, blueprints: [], medals: [] } })));
    await page.reload();
    await page.waitForTimeout(500);
    const mig = await G(() => window.__GAME__.save.profile);
    check(mig.bestScore === 900 && mig.run.active && mig.run.level === 4 && mig.run.lives === 3 && mig.requisition === 150, `v1 save did not migrate (${JSON.stringify(mig.run)})`);
    check(/Continue at level 4/.test(await page.locator('.title-screen').textContent()), 'migrated run not offered on the title');
    await shot('8-damaged-save-notice');
    steps.push('export/import, damaged save');
  }
  } catch (e) {
    errors.push('stopped: ' + e.message.split('\n')[0]);
    await shot('error').catch(() => {});
  }

  await context.close();
  const status = errors.length ? 'FAIL' : 'ok';
  console.log(`${status.padEnd(4)} ${vp.name}  [${steps.join(', ')}]`);
  for (const e of errors) { console.log('     ' + e); problems.push(`${vp.name}: ${e}`); }
}

await browser.close();
server.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s). Screenshots in test-output/.`);
  process.exit(1);
}
console.log('\nAll viewports clean. Screenshots in test-output/.');
