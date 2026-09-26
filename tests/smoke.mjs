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

  if (vp.portrait) {
    check(info.rotateVisible, 'rotate card not shown in portrait');
    check(info.portraitState === true, 'game did not pause for portrait');
  } else {
    check(!info.rotateVisible, 'rotate card shown in landscape');

    // ---------- 1b. Designs, physics and damage rules (once, on desktop)
    if (!vp.mobile) {
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
      const sy = await G(() => window.__GAME__.systemsCheck());
      check(sy.hotPower < 0.95 && sy.coolPower === 1, `heat did not cut power or radiators did not help (${JSON.stringify(sy)})`);
      check(sy.repaired > 20 && sy.brokeDown, `repair or breakdown failed (${JSON.stringify(sy)})`);
      const hw = await G(() => window.__GAME__.howitzerCheck());
      check(Object.values(hw).every(Boolean), `howitzer can't aim at every range: ${JSON.stringify(hw)}`);
      const dm = await G(() => window.__GAME__.damageCheck());
      for (const [k, v] of Object.entries(dm)) check(v, `damage rule failed: ${k}`);
      steps.push('templates, physics, damage, ships, submarines, aircraft, missiles, systems');
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
    await tapButton('Data', 'tab');
    await shot('2-settings-data');
    await tapButton('Done');
    check(!(await page.locator('.card-settings').count()), 'settings did not close');
    steps.push('settings');

    // ---------- 3. Start the battle
    await tapButton('Play from level 1');
    check((await G(() => window.__GAME__.screens.name)) === 'battle', 'Play did not open the battle');
    await wait(300);

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
