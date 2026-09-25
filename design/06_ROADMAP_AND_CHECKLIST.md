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

**1b. Battle core**
- terrain heightfield and generator: plains, hills, mud, forest, gaps
- vehicle physics from part grids
- projectiles, penetration, per-part damage, debris
- basic spotting
- squad of 3 with orders; enemy AI
- effects and floating text
- battle music with intensity layers
- tactical Start/Stop time

**1c. Ladder and Drafting Office v1**
- `levelConfig` from level 1 to unlimited, with introductions through level 15
- lives, score, combos
- level-clear celebration, life lost, game over
- workshop between levels
- Drafting Office v1: ~30 ground parts marked P1 in 05, 5 templates, randomise, scratch build, stats drawer, test drive, marks
- blueprint gallery and medals
- AI-vs-AI demo battle behind the title

### Acceptance

- [ ] A first-time player clears level 1 within about 30 s with only the two-line how-to.
- [ ] Both thumbs work at once. FIRE tap auto-aims; FIRE press-and-drag aims manually with a trajectory preview. Swap and the order chips work.
- [x] Tap, drag and pinch on the world never steal a touch from the thumb controls.
- [ ] Start/Stop time freezes the battle while the camera and orders still work.
- [x] The Pause card works. The game pauses automatically in the background and in portrait.
- [ ] Damage is visible and physical: parts detach, a lost engine immobilises, a lost gun goes silent, an ammo rack can detonate.
- [ ] These emerge from the numbers without special-case code:
  - a top-heavy design tips on a steep slope
  - an underpowered design stalls on a hill
  - tracks beat wheels in mud
  - wheels are faster on flat ground
- [ ] Designer: templates, randomise and scratch build all work. Invalid placements are explained. Stats are numbers only. Saving creates Mk.II with a change log.
- [ ] Ladder: 3 lives, +1 every 5 levels, max 5. "Continue at level N" and best score persist. Boss blueprints appear in the title gallery.
- [ ] Audio:
  - title theme, battle music with intensity layers, and the victory fanfare
  - every Part 1 action has a distinct sound effect
  - Music, Sound and Vibration toggles are remembered
- [ ] Smooth on a phone, no console errors, release checklist passed.

## Part 2: Drafting Office, all domains (v0.2)

### Scope

- The full parts catalogue from 05: naval, submarine, air, helicopter, systems and logistics parts.
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
- [ ] Save migration tested using a blob from the previous SAVE_VERSION.

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
