# Iron Doctrine: roadmap and release checklist (v2)

- **Releases:** each part is a playable release on the GitHub Pages link. Part N is version 0.N.x.
- **Sessions:** a part may span several sessions (sub-steps a, b, c).
- **Progress log:** each session ends with a row in the table at the bottom.
- **v2 note:** Part 1a (engine core) is the same as in v1. Keep whatever is already built. From 1b onwards the plan follows the v2 design (01).

## Where the build stands going into v2 (v0.2.2)

v1 got as far as its Part 2c before the v2 design arrived. That work is kept and reused; it is not the v2 plan yet.

- **Done (Part 1a):** everything listed under 1a below, including the manifest and icons (v0.1.0 and v0.1.1).
- **Already built, to be adapted to v2 (1b and 1c):**
  - land physics (terrain heightfield, wheels and tracks, ground pressure, slopes, tipping, bogging)
  - sea physics (buoyancy per hull cell, flooding, bulkheads), submarines, aircraft and helicopters
  - projectiles, penetration by angle, per-part damage, fire, debris, spotting; kinetic and HE
  - a squad of 3 with orders and swap, enemy AI, effects, floating text, battle music layers, Start/Stop time
  - the Drafting Office v1 (land, sea, submarine, air grids, templates, randomise, stats drawer, marks)
  - the AI-vs-AI title demo; blueprints and medals
  - the v1 ladder, now labelled **Gauntlet** (the optional mode in 01 §15)
- **Not built yet for v2:** the SVG part renderer and `PART_LIBRARY`-driven parts (parts are still defined in `07_data.js` and drawn in code), airships and envelopes, three-on-field with reserves, the command wheel, the Battle Simulator, and paint schemes.
- **Still v1-only:** the PNG part-image route in `src/assets/parts` (design `07_ART_INTEGRATION`), superseded by the SVG library (`07_ART_AND_PARTS`).

## Part 1: Battle core (v0.1)

### 1a. Engine core (unchanged from v1) — done in v0.1.0 and v0.1.1

- boot, landscape layout, rotate card
- input router and transparent thumb controls
- audio engine, first sound effects, title music
- Settings, Pause, saves
- title screen skeleton
- extend the test harness (the starter repo already has the build, test build, smoke test and screenshots)
- optional: web app manifest and icons, so the home-screen app opens full screen and sideways

### 1b. Battle core: land and air

- `05b_partrender.js`: port `tools/part-render.js`, with SVG paint tokens, auto-tiled structure and moving groups (07 §6). Composed ships are cached as sprites.
- Designs load from `PART_LIBRARY.vehicles`. Use the batch F starting designs as soon as they exist; until then use simple placeholder designs built from materials plus `wpn_c75_std`.
- **Physics:**
  - land: terrain heightfield, wheels and tracks, ground pressure, slopes, tipping, bogging
  - air: lift margin, thrust, climb and descend, falling when envelopes are lost
- **Combat:**
  - projectiles, penetration and angle, per-part damage, fire, debris, spotting
  - damage types: kinetic and HE for now
- **Three on the field and reserves:**
  - line-up, pull back, entry from the rear edge
  - destroyed ships replaced
  - win and lose checks
- **Control:** drive one ship and swap. The command wheel gives Move to, Fire at, Hold, Pull back, Smoke. The reserve drawer.
- **Enemy AI:** captain skill by level; uses its own reserve rotation.
- **Feel:** effects and floating text; battle music with intensity layers; tactical Start/Stop time.

### 1c. Sea, Drafting Office v1, Battle Simulator

- **Sea physics:** buoyancy per hull cell, waves, flooding and bulkheads. Coastal battlefields mix land, sea and air.
- **Drafting Office v1** (ship tab):
  - domain and class selector with grid and part limits
  - palette of tier 0–1 parts and materials
  - templates (the batch F designs), scratch build
  - stats drawer (numbers only), marks and change log
  - paint (schemes, custom colours, camouflage)
- **Battle Simulator:** pick your designs, a battlefield and an enemy force by tier; fight straight away.
- **Title screen:** AI-vs-AI demo battle behind it.

### Acceptance (Part 1)

- [ ] Both thumbs work at once. FIRE tap auto-aims; press-and-drag aims manually. Swap, Group and Utility work. The command wheel orders work.
- [x] Tap, drag and pinch on the world never steal a touch from the controls. (v0.1.0)
- [ ] Three-on-field works on both sides: pull back → the next ship arrives from the rear; destroyed ships are replaced; line-up order is respected.
- [ ] Damage is visible and physical: parts detach, a lost engine immobilises, a lost gun goes silent, lost envelopes make an airship fall, flooding sinks a ship.
- [ ] These emerge from the numbers without special-case code:
  - top-heavy designs tip
  - underpowered designs stall on hills
  - tracks beat wheels in mud
  - overloaded airships sink
- [ ] Ships look like 07 describes: part art, auto-tiled hull and paint schemes render correctly at phone scale.
- [ ] Designer: class limits are enforced and invalid placements explained. Saving makes the next mark.
- [ ] Audio: every Part 1 action has a distinct sound; Music, Sound and Vibration toggles are remembered.
- [ ] Smooth on a phone, no console errors, release checklist passed.

## Part 2: World map and fleets (v0.2)

- **World generation** (seeded):
  - terrain, biomes, roads, ruins and scrap fields, sea
  - weather that drifts
  - faction territories (09 layout)
  - settlements of all 5 types, each faction's capital, neutral villages
- **Map rendering:**
  - pre-rendered chunks and the tactical overlay
  - pan and zoom
  - fog of war, detection
- **Clock:** Start/Stop, 1×/3×/10×, auto-stop events.
- **Officers and fleets** (14b):
  - the Grand Admiral, admirals, captains
  - fleets per domain, fleet-size and class limits by level
  - moving by domain rules, path preview with fuel
  - stranding
- **Faction choice** at New campaign; the starting set-up from 01 §4.3.
- **Settlements (basic):** dock, buy and sell fuel and ammo at markets, the treasury.
- **Contact → pre-battle card → battle or auto-resolve → results back on the map.**
- **Persistence:** ship damage, losses and XP, captain survival; saves and loads.

### Acceptance (Part 2)

- [ ] A new campaign in any faction starts with the correct home territory and 3 fleets.
- [ ] Fleets move by domain rules; fuel burns; an empty fleet is stranded; path previews warn before it happens.
- [ ] Buying fuel and ammo uses the global treasury from any docked fleet.
- [ ] Battles start from map contact. Only allowed domains deploy. Results persist.
- [ ] Removing a captain garrisons them where they're left. Captains can't move alone.

## Part 3: Economy, logistics and sieges (v0.3)

- **Warehouses and holds:**
  - physical cargo for every resource except money
  - transfers between fleets and settlements
  - capacity limits
- **Production** by settlement type and biome; upkeep and wages; running dry (01 §8.5).
- **Markets** for all goods, with stock and prices (08 §6).
- **Workshop:** crafting queue; refinery (scrap → electronics).
- **Yard:** build ships from designs; refit and swap; dock repair; field repair and the mobile workshop.
- **Salvage and reverse-engineering;** scrap fields.
- **Recruitment:** captains with ships, admirals, quartermasters, promotion.
- **Convoys:** quartermasters, standing supply routes, the logistics view, raiding.
- **Settlement upgrades** (village → city or fort → …).
- **Sieges:** walls, emplacement slots (install parts), keep, garrison rotation, capture, plunder.

### Acceptance (Part 3)

- [ ] A campaign cannot be sustained on salvage alone. Supply routes visibly keep a fleet going.
- [ ] Crafting only works with the materials physically at that settlement or in the docked hold.
- [ ] A convoy on a standing route runs by itself, can be intercepted, and its loss is felt at the other end.
- [ ] Sieges work from both sides. A captured settlement changes owner and restarts production after 2 days.

## Part 4: Research and advanced warfare (v0.4)

- **Tech tree and perks:** Command Points, research at cities and metropolises (08 §11–12).
- **Grand Admiral ranks;** admiral and captain levelling fully applied.
- **Drafting Office:** Missile tab (missile designer) and Drone tab (drone designer, grid limit set by the drone computer).
- **Missiles:** racks, VLS, magazines; guidance vs flares and ECM; warheads HE, napalm, acid, EMP, cluster.
- **Carriers and drones:** hangars, drone computers, drone orders; drones lost when their carrier leaves or dies.
- **Fabricators;** release clamps and detachable sections.
- **Flamethrowers, lasers, plasma;** power and heat management; damage types and material resistances.
- **Radar, ECM, stabilisers;** the tier 3–4 music layer.

### Acceptance (Part 4)

- [ ] Researching a node unlocks its parts for crafting and the designer. Command Points force real choices.
- [ ] A drone carrier built in the designer launches drones that follow orders, and loses them when it retreats.
- [ ] Every warhead type has a visible, distinct effect. Flares beat heat seekers more than radar seekers.
- [ ] Energy weapons are limited by power and heat, not ammo.

## Part 5: Living world and polish (v0.5 → 1.0)

- **Faction strategic AI:** expand, run convoys, raid, besiege, defend capitals; personalities per 09.
- **AI designs evolve** to counter what the player fields most (the no-meta pillar).
- **Relations:** war and truce changes, reputation, charters for neutral villages.
- **Win and lose conditions,** the war journal, medals, the blueprint gallery.
- **Optional:** the Gauntlet mode.
- **Balance pass** with simulator telemetry (08); performance pass on a mid-range Android phone.
- **Accessibility pass:** text size, colour-blind-safe status icons, reduced motion.

## Ongoing: art integration

- Foundry zips arrive in any order (10_PART_ROSTER). Integrate them as CLAUDE.md describes, whenever they appear in the repo root.
- **Code must never hard-code a part's look.** Everything comes from `PART_LIBRARY`.
- **Placeholders:** until a part's art exists, the designer shows a labelled grey block with the part's footprint. The part is usable in code as soon as its JSON exists.

## Release checklist (every part)

- [ ] `node build.mjs` passes (part library, syntax, no test code, no external URLs).
- [ ] `npm test` passes at all 5 viewports with no console errors. Screenshots reviewed.
- [ ] Scripted play covers the new systems (04 §10).
- [ ] Tested on a real Android phone in Chrome: landscape, both thumbs, pinch, background → auto-pause.
- [ ] Old saves migrate or are backed up with a message.
- [ ] `GAME_VERSION` bumped; `docs/` rebuilt and committed.
- [ ] Progress log row added below.

## Progress log

| Date | Part | Version | What changed | Notes / next |
|---|---|---|---|---|
| 2026-09-26 | Design v2 | 0.2.3 | Design v2 and the part library pipeline applied from the update pack. Design 01–06 rewritten, 07–10 added. The build now checks `src/parts` and `src/vehicles` and bundles them into the game as `PART_LIBRARY` (1 part, the golden sample 75 mm gun, and 1 test design). Part checker and preview tools added. The v1 Proving Ground ladder is now called the Gauntlet on the title screen and in medals. Kept from before: the static-site build (not one file) and all v1 game code. | The game doesn't use `PART_LIBRARY` yet; parts are still built in code. The title menu doesn't have the v2 items yet (campaign, Battle Simulator), since those screens don't exist. | Part 1b (v2): port the part renderer, then three-on-field and reserves |

### v1 progress log (before design v2)

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
