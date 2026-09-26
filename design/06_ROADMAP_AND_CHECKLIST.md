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

### Sub-steps

**2a. Ships** (done in v0.2.0)
- ship parts: hull section, bow section, keel, watertight bulkhead, marine diesel, ship propeller, manoeuvre thruster, twin 120 mm naval gun, 1000 L fuel tank
- buoyancy per watertight cell, draft, trim, hull drag, propeller thrust (design/05 §7.3)
- flooding through holes and destroyed hull parts, stopped by bulkheads; listing, sinking, capsizing
- sea layer in battles: coast generator, water drawing, splashes, shells slowed by water
- Drafting Office: ship class, waterline and centre-of-buoyancy markers, ship numbers, Gunboat and Destroyer templates, ship randomiser, ship scratch build
- test range: sea trial for ships
- ladder: level 14 "Coastal gunboats"; coasts with gunboats in random levels 16+

**2b. Submarines** (done in v0.2.1)
- ballast tanks, electric motor, pressure hull section, diving with ▲ ▼ and automatic depth keeping
- torpedoes (hits below the waterline flood), depth charges, sonar; Alt button and F key
- underwater layer; submarine template and randomiser; the Destroyer carries depth charges, a torpedo tube and sonar
- ladder: level 16 "Submarine hunt", a sea battle with a lent fleet when the squad has no ships

**2c. Aircraft and helicopters** (done in v0.2.2)
- wings, tail, aero engine, jet, gas turbine, air propeller, rotor, tail rotor
- lift, stall, thrust-to-weight; rotor lift against mass; loops with a half roll to turn round
- sky layer, bombs, 20 mm autocannon and 40 mm AA gun with flak; Fighter, Bomber, Scout helicopter templates
- centre-of-lift marker and thrust-to-weight numbers; aircraft and helicopter randomisers; air test range; ladder level 17 "Air raid"

**2d. Systems and constraints** (done in v0.2.3)
- search and naval radar, ECM, command radio, auxiliary generator; rocket pods, guided anti-tank missiles, SAM launchers; spaced skirts
- missile lock from fire control and radar, cut by ECM; radar spotting
- live constraints: heat (overheating cuts power, can start a fire), breakdowns, crew roles (loaders, commander)
- remaining logistics parts: 1000 L tank (2a), troop compartment, fuel cargo tank, repair workshop (heals in battle), recovery winch, dozer blade, bridge layer, landing ramp
- test range picker (land, sea, sky); design lineage view; Tank hunter and SAM site enemies

### Acceptance

- [x] Over-armoured ships sit low and slow down.
- [x] A holed ship lists and can sink; bulkheads contain flooding.
- [x] An aircraft with too little wing stalls; a helicopter with too little power can't lift off.
- [x] Radar, ECM and fire control measurably change missile hit rates.
- [x] Every domain can be driven with the drive pad.
- [x] The randomiser makes valid designs in every class.

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
| 2026-09-26 | 0.1.4 | Fix from the producer's play test: howitzers (fitted by the player or in enemy batteries) never fired. Their arc stopped at 72°, below every lob within their 400 m range, so shots were refused as out of arc and no impact warnings appeared. Arc is now −5° to 80°, with the flat arc used when the lob doesn't fit. Smoke test checks a battery can aim at 40, 120, 250 and 390 m. | None new | Part 2, or the first imported part art (frame) |
| 2026-09-26 | 0.2.0 | Part 2a: ships. Nine ship parts (hull and bow sections, keel, bulkhead, marine diesel, propeller, manoeuvre thruster, twin 120 mm naval gun, 1000 L fuel tank). Each watertight cell below the surface pushes up with the water it displaces, so draft, trim and list come from where parts sit; propellers push, the hull drags on its submerged cross-section, so heavier ships sit lower and go slower. Shell holes and destroyed hull parts below the waterline let water in; it fills the compartment from the bottom until bulkheads stop it; ships list, sink or capsize. Sea layer in battles: coasts, translucent water, swell, splashes, shells slowed by water, sinking without a fireball. Drafting Office: ship grid (44×16), waterline and centre-of-buoyancy markers, draft, freeboard, reserve buoyancy, beam and sea speed; Gunboat and Destroyer templates; ship randomiser and scratch build. Sea trial on the test range. Squad ships deploy only on maps with sea. Ladder level 14 is now "Coastal gunboats"; some random levels from 16 have a coast with gunboats or a destroyer. Auto-aim goes for the waterline of ships. Fixed: a vehicle that lost every part broke the physics for everyone (NaN positions). | The coast level is hard for a squad that stays parked: a machine-gun car can sit under your gun's lowest angle. Ship hulls are blocky (bow section only). Ships don't turn around; they reverse. | Part 2b: submarines |
| 2026-09-26 | 0.2.1 | Part 2b: submarines. Ballast tanks, electric motor with batteries, pressure hull section, torpedo tube, depth-charge rack and sonar. Ballast tanks flood or blow to hold the depth order, and trim fore and aft to keep the boat level; only electric motors drive under water. Torpedoes run straight at the target's keel depth and burst against the hull; depth charges roll off the stern and burst at the depth of the submarine below. Both use the ordinary blast, so holed parts flood. Sonar finds submerged submarines within 100 m (with a ping); a submerged boat sees only through a periscope above the water. Battle screen: ▲ ▼ appear for submarines with a depth readout; Alt (F) fires torpedoes or drops depth charges and shows what is left. Drafting Office: submarine numbers (ballast held, ballast to dive, electric power, surfaced and submerged speed); a design that can't dive is explained; submarine randomiser adds trim weights until it can. Submarine template; the Destroyer now has depth charges, a torpedo tube and sonar. Ladder level 16 "Submarine hunt": ships and submarines only, with a lent fleet (2 Destroyers and a Gunboat) if the squad has none. Enemies with no target now search where they last saw you. Heave damping now acts at the surface only, so boats move freely under water. | Batteries don't run down yet. A submarine that dives with holes in it can sink to the seabed and stay there. The sea hunt can stall if you sit in the shallows: enemy submarines won't come in. | Part 2c: aircraft and helicopters |
| 2026-09-26 | 0.2.2 | Part 2c: aircraft and helicopters. Wing section, tail unit, aero engine, jet, gas turbine, air propeller, rotor, tail rotor, 20 mm autocannon, 40 mm AA gun, bomb rack. Flight: wing lift acts at the centre of lift from the airflow over the wing (0.1 per degree, stalling beyond 12°); the tail steadies the nose and carries the elevator; thrust from jets or engine power through air propellers, against drag that climbs steeply near the speed of sound. Battle air speeds are a quarter of the sheet's (denser air), so fights stay on screen. Controls: aircraft ◀ ▶ throttle, ▲ ▼ pitch, level flight when you let go, hold ▲ to loop and roll round; helicopters ◀ ▶ move, ▲ ▼ height; a readout with a STALL warning. Crashes, ditching, aircraft turning back at the battlefield edge. Only heavy machine guns, autocannons and AA guns engage aircraft (with lead); AA mounts swing round and up; 40 mm shells burst near aircraft. Bombs with a whistle; bombers release when the bomb would land on the target; fighters strafe and loop round; helicopters hover at a stand-off. Aircraft are seen from twice as far. Drafting Office: aircraft and helicopter grids (32×12), centre-of-lift marker, wing and tail area, stall speed, thrust at stall speed, thrust to weight, rotor lift; warnings when top speed is below stall speed, the centre of mass is behind the centre of lift, or rotor lift is below weight. Fighter, Bomber and Scout helicopter templates; aircraft and helicopter randomisers; air test range. Ladder level 17 "Air raid". | Aircraft parts are cheap in Requisition compared with tanks (catalogue costs); the ladder budget may need an air surcharge. Planes fly off screen during a loop at high zoom. Radar, ECM and missiles are still to come. Phone performance with many aircraft not yet measured. | Part 2d: sensors, missiles and constraints |
| 2026-09-26 | 0.2.3 | Part 2d: sensors, missiles and constraints. New parts: search radar, naval radar, ECM suite, command radio, auxiliary generator, rocket pod, guided anti-tank missile, SAM launcher, spaced skirt, troop compartment, fuel cargo tank, repair workshop, recovery winch, dozer blade, bridge layer, landing ramp. Guided missiles roll for a lock at launch: base chance, +20% with fire control, +12% (search) or +20% (naval) radar, × 0.6 against a target with ECM; locked they steer at the target, unlocked they fly straight and miss. Measured over 40 shots: anti-tank missile 78% with fire control, 95% with radar too, 50% against ECM; SAM 58% with search radar, 83% with naval radar, 33% against ECM. Anti-tank missiles hit with the ordinary armour rules (shaped charge, no loss with range; skirts halve it). SAMs fire by themselves at aircraft and burst near them. Rocket pods fire salvos of 8 with Alt. Radar spots aircraft and (not into forest) surface targets far off; ECM cuts enemy radar range by 30%. Heat: engines shed 30 per second each (60 at sea or in the air), radiators 12; running hotter cuts engine power and automatic fire rate, and 20 s at 50% over can start an engine fire. Breakdowns every 30 s at 1/120 of the hourly rate. Crew roles: a driver and gunners first, then loaders for guns of 75 mm and up (else reload × 1.6), and a spare crew member commands (+15% sight). Repair workshop: 10 HP per second to damaged parts of itself and allies within 12 m while stopped. Drafting Office: crew, heat, breakdowns, sight, radar, sonar, ECM and missile lock numbers; missiles need their fire control or radar; part notes for campaign-only parts. Test range picker (land, sea, sky). Lineage view in the Workshop for your designs. Enemies: Tank hunter (guided missiles) and SAM site; the Air raid now has a SAM site; random levels from 16 add aircraft with a SAM site, and tank hunters from 18. Fixed: Workshop header overflow at 640 px. | Light tanks now reload faster (the loader rule only slows guns of 75 mm and up; before, any vehicle with fewer than 3 crew reloaded slowly). The Behemoth runs 15 over its cooling and loses about 17% power when driving. Campaign-only parts carry mass and cost but do nothing in battle yet. Phone performance still not measured on a real device. | Part 1/2 release checklist on a real phone, then Part 3 (the War Map) |
