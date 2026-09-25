# Iron Doctrine: roadmap and release checklist

- Each part is a playable release on the GitHub Pages link. Part N is version 0.N.x.
- A part may span several sessions (sub-steps a, b, c).
- Each session ends with a Progress log row in the table at the bottom.

## Part 1: Proving Ground (v0.1)

### Sub-steps

**1a. Engine core** (done in v0.1.0; the home-screen manifest followed in v0.1.1)
- boot, landscape layout, rotate card
- input router and transparent thumb controls
- audio engine, first sound effects, title music
- Settings, Pause, saves
- title screen skeleton
- extend the test harness (the starter repo already has the build, test build, smoke test and screenshots)
- optional: web app manifest and icons, so the home-screen app opens full screen and sideways

**1b. Battle core** (done in v0.1.2)
- terrain heightfield and generator: plains, hills, mud, forest, gaps
- vehicle physics from part grids
- projectiles, penetration, per-part damage, debris
- basic spotting
- squad of 3 with orders; enemy AI
- effects and floating text
- battle music with intensity layers
- tactical Start/Stop time

**1c. Ladder and Drafting Office v1** (done in v0.1.3)
- `levelConfig` from level 1 to unlimited, with introductions through level 15
- lives, score, combos
- level-clear celebration, life lost, game over
- workshop between levels
- Workshop / Drafting Office v1 (HighFleet-style, 01 §8.6): ~30 ground parts marked P1 in 05, 5 templates, randomise, scratch build, stats drawer, balance markers, test drive, marks, refits by fitting better parts
- blueprint gallery and medals
- AI-vs-AI demo battle behind the title

### Acceptance

- [x] A first-time player clears level 1 within about 30 s with only the two-line how-to.
- [x] Both thumbs work at once. FIRE tap auto-aims; FIRE press-and-drag aims manually with a trajectory preview. Swap and the order chips work.
- [x] Tap, drag and pinch on the world never steal a touch from the thumb controls.
- [x] Start/Stop time freezes the battle while the camera and orders still work.
- [x] The Pause card works. The game pauses automatically in the background and in portrait.
- [x] Damage is visible and physical: parts detach, a lost engine immobilises, a lost gun goes silent, an ammo rack can detonate.
- [x] These emerge from the numbers without special-case code:
  - a top-heavy design tips on a steep slope
  - an underpowered design stalls on a hill
  - tracks beat wheels in mud
  - wheels are faster on flat ground
- [x] Designer: templates, randomise and scratch build all work. Invalid placements are explained. Stats are numbers only. Saving creates Mk.II with a change log.
- [x] Ladder: 3 lives, +1 every 5 levels, max 5. "Continue at level N" and best score persist. Boss blueprints appear in the title gallery.
- [x] Audio:
  - title theme, battle music with intensity layers, and the victory fanfare
  - every Part 1 action has a distinct sound effect
  - Music, Sound and Vibration toggles are remembered
- [ ] Smooth on a phone, no console errors, release checklist passed.

## Part 2: Drafting Office, all domains (v0.2)

### Scope

- The full parts catalogue from 05: naval, submarine, air, helicopter, systems and logistics parts.
- The Workshop (01 §8.6) extended to ships, submarines, aircraft and helicopters: waterline, centre of lift and thrust-to-weight markers.
- Live constraints: power, heat, reliability, crew, cost.
- Physics for buoyancy, flooding, lift, stall and rotors.
- Sky, sea and underwater layers in battles.
- Weapons and systems: AA, missiles, ECM, torpedoes, bombs, depth charges.
- Test range with a terrain, water and air selector.
- Design lineage view.
- New ladder ideas: air attacks, coastal gunboats, a submarine level.

### Acceptance

- [ ] Over-armoured ships sit low and slow down.
- [ ] A holed ship lists and can sink; bulkheads contain flooding.
- [ ] An aircraft with too little wing stalls; a helicopter with too little power can't lift off.
- [ ] Radar, ECM and fire control measurably change missile hit rates.
- [ ] Every domain can be driven with the drive pad.
- [ ] The randomiser makes valid designs in every class.

## Part 3: The War Map (v0.3)

### Scope

**Map and time**
- seeded map generation: regions, terrain, features, links
- real-time clock with Start/Stop, speeds and auto-stop events
- fog of war

**Forces**
- armies, fleets and air groups made of persistent units
- movement along links
- a basic enemy strategic AI

**Battles**
- on contact: Fight, Auto-resolve or Withdraw
- battlefield generator for forest, urban, desert, mountain, coast landing, island and open sea
- flanking from two directions
- force orders and reinforcement waves

**Aftermath and saves**
- after-action report
- losses, damage and experience persist
- 3 campaign save slots
- war victory and defeat

### Acceptance

- [ ] Losses carry over exactly.
- [ ] Across 20 seeds, auto-resolved and hand-fought versions of the same battle give comparable outcomes.
- [ ] The map pans and zooms smoothly on the phone.
- [ ] Saving and loading mid-campaign restores everything.

## Part 4: Economy, logistics and infrastructure (v0.4)

### Scope

**Economy**
- six resources and their production chains
- buildings and settlement growth
- production queues and power

**Supply**
- supply network with capacity, depots and supply radius
- supply and support vehicles and ships
- visible convoys that can be raided
- consumption of fuel, ammo, spare parts, food and materials
- out-of-supply effects
- repair and recovery

**Infrastructure**
- damage and repair

**Interface**
- resource strip
- supply map layer

### Acceptance

- [ ] An army can win a battle and still be forced back by lack of supply.
- [ ] Cutting a rail link visibly starves a front.
- [ ] A village grows into a town with investment.

## Part 5: A living war (v0.5 → 1.0)

### Scope

**Units and crews**
- crew veterancy and crew transfer
- refits at workshops

**Progression**
- research and reverse-engineering unlocks
- war journal and hall of honour

**Warfare**
- combined operations: amphibious assaults with naval bombardment, air cover and landing craft
- enemy design evolution
- difficulty settings

**Finish**
- button layout editor
- balance pass, performance pass, polish

### Acceptance

- [ ] Enemy designs visibly change in response to what the player uses.
- [ ] A D-Day-style landing is playable from start to finish.
- [ ] A 1-hour campaign session on the phone has no slowdown.

## Release checklist (every publish)

**Code and tests**
- [ ] `node build.mjs` passes. It includes the syntax check, the no-test-code check and the no-external-URL check.
- [ ] Playwright passes at 640×360, 800×360, 915×412 and 1280×720, plus 360×640 portrait, with zero console or page errors.
- [ ] Autoplay covers level up, life lost, game over, continue, pause and resume, Start/Stop time, a settings change, reload with the save kept, and this part's new features.

**Screenshots**
- [ ] Nothing is cut off by notches or safe areas.
- [ ] HUD, controls and drawers don't overlap.
- [ ] Text is readable at 360 px screen height.
- [ ] Transparent controls stay visible over both bright and dark scenes.

**Saves and file**
- [x] Save migration tested using a blob from the previous SAVE_VERSION. (v1 → v2, in the smoke test)

**Accessibility**
- [ ] Reduced motion is respected.
- [ ] Vibration follows its own toggle.

**Publish**
- [ ] GAME_VERSION bumped.
- [ ] `docs/` rebuilt and committed with the source; branch merged to `main` so GitHub Pages updates.

## Progress log

| Date | Version | Done | Known issues | Next |
|---|---|---|---|---|
| 2026-09-25 | 0.0.1 | Starter repo: build script, test build, smoke test at 5 viewports, placeholder title, GitHub Pages output in docs/ | Stencil font not embedded yet | Part 1a |
| 2026-09-25 | 0.1.0 | Part 1a engine core. Saves with versions, migrations, backups, export/import and reset. Audio engine: buses, 24-voice cap, synth instruments, title march, UI and weapon/order/time sound effects, haptics. Pointer router with captured thumb controls, world tap/drag/pinch/long-press/double-tap, edge guard, keyboard. Acetate thumb controls with grease-pencil glyphs, size, opacity, ghost mode and left-handed mirror. Title with stencil logo, Settings (Audio, Controls, Display, Data), Pause card, toasts, auto-pause on background, blur and portrait. Controls test range standing in for the battle. Smoke test now drives all of this at 5 viewports. | Range vehicles are placeholders (kinematic, no damage). Optional home-screen manifest not done: it needs a second file next to index.html, so it waits for the producer's go-ahead. Alt long-press (cycle secondaries) waits for real secondary weapons. | Part 1b: terrain generator and vehicle physics |
| 2026-09-25 | 0.1.1 | One-file rule lifted by the producer. The build now writes a small static site to docs/: index.html, game.js, game.css, the font file, a home-screen manifest (full screen, landscape) and icons drawn by the build. Smoke test serves the site over a local web server. | None new | Part 1b |
| 2026-09-25 | 0.1.2 | Part 1b battle core. Terrain generator (plains, hills, mud, forest with breakable trees, gaps) on a 0.5 m heightfield with HE craters. Vehicles are rigid bodies built from their part grids: mass, centre of mass, inertia, spring-damper wheel and track contacts, drive force from engine power and grip, rolling resistance from softness and ground pressure, engine braking, recoil. Shells traced cell by cell through the part grid: armour vs penetration by angle, ricochets past 70°, bursting charges, over-penetration; per-part damage with scorch and holes, parts and cut-off groups detach as tumbling debris; engine, gun, turret ring, fuel fire and ammo detonation effects. Spotting with optics, forest concealment, smoke screens and muzzle reveal. Squad of 3 with the five orders, long-press move, swap; enemy AI (parked, convoy, attack) with reaction time and accuracy. Effects: muzzle flash, sparks, dirt, explosions with shockwave, smoke columns, hit-stop, shake. Battle music in D minor with 4 intensity layers. Start/Stop time. HUD: squad cards with health/fuel/ammo, objective bar, minimap, off-screen enemy arrows, target bracket, follow camera that frames the target. Battle results card. 6 templates drawn as detailed HighFleet-style modules. Four battle setups cycle as levels until the ladder arrives. Title button renamed Workshop; Workshop design written up (01 §8.6). Tests: templates valid; wheels faster on flat, tracks beat wheels in mud, underpowered stalls on a hill, top-heavy tips on a slope, part effects; win/lose/retry; desktop autoplay clears level 1 in about 20 s. | Enemies don't retreat or use cover yet. No infantry, howitzer or bunkers yet (ladder levels 7 and 13). Level clear has the slow-motion and stamp but not yet confetti or the fanfare. A few small per-frame allocations remain in effects and drawing (game work is about 0.5 ms per frame on the headless probe). Template masses come out lighter than the rough targets in 05 §8 (medium tank 9.5 t, not 18 t); the numbers are what the parts add up to. | Part 1c: ladder, score and lives, then the Workshop / Drafting Office v1 |
| 2026-09-25 | 0.1.3 | Part 1c. Ladder: levelConfig to unlimited with introductions through level 15 (hold the ridge, artillery with impact warnings, escort, forest, the Behemoth boss, rain and dusk, gaps, bunkers, night) and mixes with a named boss every 5th level after that; caps applied. Lives (3, +1 every 5 levels, max 5), score, 4 s combos, critical-hit bonuses, level-clear stamp with slow-motion, confetti and bugle fanfare, life lost and game over cards, continue at level N; two-line how-to at each level start. Workshop between levels (squad of 3 within the level budget, Requisition). Drafting Office v1: cyanotype grid, 32 P1 parts, templates, randomise (light/heavy), scratch build, explained invalid placements, numbers-only stats drawer (mass, power, pressure, tip angle, climb limit, speed per terrain, armour, weapons, cost, change vs base), balance markers, undo/redo, test drive, saving marks with a change log. Blueprints and medals screen (7 medals). AI-vs-AI demo battle behind the title. Save format v2 with a v1 migration. Art integration contract with the graphics project (design 07): part images with JSON records validated by the build, loader with fallback, barrel images with pivot and muzzle, placeholder test screenshots in design/art. Fixed: enemy guns started pointing backwards. | Phone performance not yet measured on a real device (headless probe: game work about 0.5 ms per frame). Enemies still don't retreat or use cover; no infantry. Faction paint masks, rotating wheels and part research are planned, not built. The level budget and Requisition numbers are first guesses. | Part 1 release checklist on a real phone, then Part 2 (all domains) or the first imported part art from the graphics project (frame) |
