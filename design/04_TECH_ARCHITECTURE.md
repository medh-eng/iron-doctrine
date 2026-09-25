# Iron Doctrine: technical architecture

## 1. Delivery

- **Source** lives in the GitHub repo:
  - `src/js/*.js`: one file per section
  - `src/styles.css`
  - `src/index.template.html`
  - `src/assets/`: fonts and other assets, inlined at build time
- **Build:** `node build.mjs` joins everything into ONE self-contained file, `docs/index.html`. It uses only Node built-ins.
- **Publishing:** GitHub Pages serves `docs/index.html` from the `main` branch as the live game at `https://<username>.github.io/iron-doctrine/`.
- **No network requests at runtime.** The build fails on any external URL, except the SVG namespace.
- **Version constants** in `src/js/00_config.js`:
  - `GAME_VERSION`: semver. Minor version = part number (Part 1 = 0.1.x); patch = fixes.
  - `SAVE_VERSION`: an integer.

## 2. Code layout

The files in `src/js/` are joined in filename order inside one strict IIFE, so later files can use earlier files' top-level names. Each file starts with its banner comment.

```
00_config.js       constants, tuning tables, feature flags
01_util.js         math, vec2, clamp/lerp/easing, seeded RNG (mulberry32), pools, event bus
02_save.js         load/save, migrations, export/import, quota handling
03_audio.js        context, buses, instruments, music scheduler, sfx, haptics
04_input.js        pointer router, control zones, gestures, keyboard
05_render.js       canvas, DPR, camera, layers, offscreen caches, text cache
06_ui.js           DOM overlays (menus, drawers, cards), HUD, floating text, toasts
07_data.js         part catalogue, templates, terrain types, buildings, recipes, levelConfig
08_design.js       grid model, placement rules, validation, statsOf(), randomiser, marks
09_physics.js      rigid bodies, wheel/track contacts, buoyancy, lift, heightfield, debris
10_combat.js       projectiles, ballistics, grid raycast, penetration, damage, spotting
11_ai.js           unit behaviours, squad orders, force orders, enemy tactics
12_battle.js       battlefield generator, battle state, objectives, results
13_autoresolve.js  headless battle runner
14_campaign.js     map generation, regions, forces, movement, clock, fog, strategic AI
15_economy.js      production, stockpiles, supply network, construction, growth
16_screens.js      title, ladder, workshop, designer, map, battle, results, settings, pause
17_main.js         boot, resize/orientation, loop, visibility handling
```

**Splitting large files:** when a file passes about 800 lines, split it with letter suffixes that keep the order, e.g. `09a_physics_body.js`, `09b_physics_terrain.js`.

**Starter repo:** only `00`, `01` and `17` exist so far. Create the others as their part is built.

## 3. Rendering

**Split of work**
- One full-screen `<canvas>` draws the world, the HUD and the thumb controls. The controls are drawn on canvas so they composite cheaply over the world, and hit-testing is done by the input router.
- A DOM overlay layer handles menus, drawers and cards, for crisp text and easier layout.

**Canvas sizing**
- Size = window × min(devicePixelRatio, quality cap), applied with `setTransform`.
- Resize is debounced to 100 ms. Listen for `orientationchange` and `visualViewport` resize.

**Caching**
- Static layers (parallax backgrounds, the map base, the blueprint grid) are pre-rendered to offscreen canvases.
- Terrain is pre-rendered in 256 px chunks.

**Draw order each frame**
1. Clear
2. Background layers
3. Terrain chunks in view
4. Props
5. Units (cached sprites, rotated)
6. Projectiles
7. Particles
8. Floating text
9. HUD
10. Controls

**No per-frame allocation** in hot paths. Particles, projectiles, floating text and debris come from pools, and arrays are reused.

## 4. Loop and time

- `requestAnimationFrame` drives the loop. The simulation uses a fixed 1/60 s step with an accumulator: at most 4 steps per frame; if it falls further behind, the extra time is dropped.
- **States:**

  | State | Behaviour |
  |---|---|
  | running | Normal play |
  | frozen | Tactical Start/Stop: simulation halted; input, camera and orders still live |
  | paused | Pause menu open |
  | hidden | Auto-pause, audio suspended |

- **Determinism:** all simulation randomness uses seeded RNG streams (battle seed, map seed), so battles and auto-resolve can be reproduced.

## 5. Input

- **One pointer router** on the canvas:
  1. On `pointerdown`, hit-test the control zones registered by the current screen.
  2. If a control is hit, call `setPointerCapture` and route the pointer to that control.
  3. Otherwise, pass it to the world gesture handler.
- **Multi-touch:** each pointer is tracked separately, so the left and right thumbs work at once. Pinch uses two world pointers.
- **Blocking browser behaviour:**
  - CSS: `touch-action:none; user-select:none; -webkit-touch-callout:none; overscroll-behavior:none`
  - prevent the `contextmenu` event
  - viewport meta: `user-scalable=no, viewport-fit=cover`
- **Timing** is judged from `event.timeStamp`.
- The keyboard map is in 02.

## 6. Simulation model

This is the implementation view; the rules are in 01 and the numbers in 05.

- **Vehicle body:**
  - state: position, angle, velocity, angular velocity
  - mass, inertia and centre of mass computed from the parts
  - wheels and track rollers are contact points with a spring and damper scaled to mass
  - friction = terrain grip × ground-pressure factor
  - integrated with semi-implicit Euler at 60 Hz
- **Terrain:** a heightfield sampled every 0.5 m. Slope comes from neighbouring samples. Soft ground zones carry a softness value.
- **Water:** a flat surface with a small sine wave. Each hull cell below the waterline adds buoyancy, and water adds drag.
- **Air:** lift = k × wing area × v² × angle factor, plus drag and thrust.
- **Projectiles:**
  - shells: point masses with gravity and drag
  - missiles: guided, with a limited turn rate
  - machine-gun tracers: fast and straight, but they still travel
- **Hit resolution:**
  1. Transform the hit point into the vehicle's local grid.
  2. Run a DDA raycast along the shell's direction through the cells.
  3. Apply armour vs penetration, then spill damage into the cells behind.
- **Proximity queries** use a spatial hash with 32 m cells.
- **Caps:**
  - at most 24 active units per side; others queue as reinforcements or are simulated coarsely off-screen
  - at most 300 projectiles
  - particles capped by quality setting

## 7. Data shapes

Plain, JSON-safe objects.

```js
PartDef  = { id, name, cat, sub, domains:['ground','naval','sub','air','heli'], w, h,
             mass, hp, armor, cost:{wood,metal,fuel,elec,rubber,food}, power, heat,
             fuelUse, crew, reliability, buildTime, props:{...}, unlock:'base'|'research'|'capture' }
Design   = { id, name, family, mark, domain, cls, cells:[{p:partId, x, y, f:0|1}],
             notes, created, changelog:[...] }
Unit     = { id, name, designId, mark, dmg:{cellIndex:hpLeft}, fuel, ammo:{weaponIdx:n},
             crew:{xp, level, casualties}, kills, battles,
             status:'ready'|'damaged'|'wreck'|'lost', forceId }
Force    = { id, faction, kind:'army'|'fleet'|'air', name, regionId, path:[regionId],
             progress, stance, units:[unitId], cargo:{fuel, ammo, parts, food, build} }
Region   = { id, name, poly:[[x,y]], cx, cy, terrain, climate, features:[...], tier:0..3,
             buildings:[{type, hp, level}], owner, stock:{...},
             links:[{to, kind:'road'|'rail'|'sea'|'river', quality, hp}], fort }
Campaign = { seed, day, hour, speed, factions:{...}, regions:[...], forces:[...], units:[...],
             designs:[...], journal:[...], ai:{...} }
Profile  = { bestScore, highestLevel, blueprints:[designId], medals:[id], stats:{...} }
Settings = { music, musicVol, sound, soundVol, vibration, btnOpacity, btnSize, leftHanded,
             autoRecenter, aimLine, quality, reducedMotion, showFps, fullscreen, autoStop:{...} }
```

Derived stats come from a pure function `statsOf(design, env)`, cached by design id + mark + environment.

## 8. Saves

- **Keys:** `irondoctrine.settings`, `irondoctrine.profile`, `irondoctrine.designs`, `irondoctrine.campaign.slot1` to `slot3`.
- **Blob format:** `{v: SAVE_VERSION, t: timestamp, data}`.
- **On load:** run migrations one version at a time (v → v+1). If a migration fails:
  1. keep the old blob under `irondoctrine.backup.<key>`
  2. start fresh for that key only
  3. tell the player
- **When to write:**
  - debounced to 1 s, plus on pause and when hidden
  - campaign autosave every in-game day and after each battle
- **Size:**
  - keep campaign data compact: arrays instead of objects for big lists, rounded numbers
  - if a blob passes 3.5 MB, move campaign saves to IndexedDB behind the same API
- **Export / import:**
  - Export: JSON → base64 text in a copy box. A file download can be added later, but copyable text always works.
  - Import: paste box, validate, confirm.
- **Failure-proof:** every storage call is wrapped in try/catch, and the game must still run without storage (e.g. private mode).

## 9. Level config

```js
levelConfig(level) → {
  terrain:{roughness, mud, forest, gaps, water}, weather, timeOfDay,
  enemies:[{type, count, armorMul, accuracy, reaction}], waves:{count, interval},
  goal:{type, target, time}, budget, rewards
}
```

Every number is clamped to the caps in 01 §14.3.

## 10. Test harness

**Test builds**
- `node build.mjs --test` writes `build-test/index.html`. This build includes:
  - the code between `/*TEST:BEGIN*/` and `/*TEST:END*/` markers, which the release build strips
  - `tests/test-hooks.js`, injected before the game script
- The release build fails if `__TEST__`, `__GAME__` or any test marker remains.

**Hooks**
- The game exposes its state as `window.__GAME__` from inside test blocks.
- `tests/test-hooks.js` sets `window.__TEST__`. Add hooks as parts are built:
  - autoplay
  - `winLevel()`, `loseSquad()`, `gameOver()`, `togglePause()`, `toggleTime()`, `setLevel(n)`
  - time scale
  - fixed seed

**Smoke test** (`npm test` = test build + `tests/smoke.mjs`)
- Viewports: 640×360, 800×360 and 915×412 (with touch), 1280×720 desktop, and 360×640 portrait.
- It fails on console errors or page errors.
- It checks the rotate card and portrait pause.
- It saves screenshots to `test-output/`.

**Extend the smoke test each part** with scripted play:
1. start the ladder and autoplay levels 1–4
2. force a life lost
3. force game over, then continue
4. pause and resume
5. stop and start time
6. change a setting
7. reload and verify the save

Take a screenshot after each step.

**Performance probe:** average frame time over 10 s of a heavy battle. Headless isn't a phone, so compare builds with each other; don't treat it as an absolute number.

## 11. Tooling

- `node build.mjs` runs `node --check` on the bundled script automatically.
- **Playwright:** `npm install`, then `npx playwright install chromium`. If the browser download is blocked, point `CHROMIUM_PATH` at any installed Chromium.
- **Font subsetting:** fonttools `pyftsubset` → woff2. Put the file in `src/assets/` and reference it as `url(assets/<file>.woff2)` in `styles.css`; the build inlines it as base64.

## 12. Publishing

1. Bump `GAME_VERSION`, run `node build.mjs`, and commit `docs/index.html` together with the source changes.
2. Cloud sessions push a branch. The producer merges it into `main`.
3. GitHub Pages (Settings → Pages → Deploy from a branch → `main` → `/docs`) updates the live link about a minute later.

**Runtime notes:**
- localStorage works per device; wrap every call in try/catch.
- Saves are exported as copyable text.

**Optional home-screen app** (a Part 1a or Part 5 nice-to-have):
- `docs/manifest.webmanifest` with `display: fullscreen` and `orientation: landscape`, plus PNG icons, so Chrome's "Add to Home screen" opens the game full screen and sideways.
- The game itself must keep working without these files.
