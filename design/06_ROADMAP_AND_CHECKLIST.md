# Iron Doctrine: roadmap and release checklist (v2.1)

- **Releases:** each step is a playable release on the GitHub Pages link. Sessions end with a Progress log row.
- **What v2.1 does:** it fits design v2 onto the game that already exists. v1 reached v0.2.2 (land, sea, submarine, aircraft and helicopter battles), and none of that is thrown away.
- **Order:** first bridge the existing game to v2 (steps 2.5–2.8), then build the campaign (0.3 onwards).

## Where the build stands (v0.2.3)

| Area | State |
|---|---|
| Engine core (v1 Part 1a) | Done: saves, audio, input, thumb controls, settings, pause, static-site build, manifest |
| Battles | Done (v1): land, ships, submarines, aircraft and helicopters; per-part damage, flooding, spotting; squad of 3 with orders; enemy AI; effects; music layers; Start/Stop time |
| Drafting Office, Workshop, Blueprints | Done (v1): all v1 domains, templates, randomise, stats drawer, marks |
| Gauntlet | Done (the v1 ladder, renamed) |
| Part library | Built into the game as `PART_LIBRARY`, **but not used yet**. After this update it holds all 52 v1 parts, 7 structure cells and 15 templates, with the exact v1 numbers |
| Art | The golden sample (c75) exists as SVG. Everything else uses the code drawing. The PNG route (design `07_ART_INTEGRATION`) is legacy |
| v2 features | Not built: reserves and three-on-field, command wheel, Battle Simulator, airships, classes and tiers in the designer, paint schemes, then the whole campaign |

## Step 2.5: bridge to the part library (v0.2.4)

### 2.5a. Parts and templates come from `PART_LIBRARY`

- Before switching, run `node tools/verify-bridge.mjs`: it must report 0 differences. Then save a snapshot of `PARTS` and `TEMPLATES` (a test-only JSON dump).
- **Build the game's objects from the library** (adapter in `07_data.js`, design 04 §9):
  - `PARTS[id] = { id, name, cat: category, w, h, cost, ...stats, ...behaviour }`
  - materials become 1×1 `structure` parts (`shape: "slope"` → `sloped: true`)
  - entries with `planned: true` are skipped
- **Templates:** `TEMPLATES[id]` = the vehicle JSON.
- **Remove** `PART_ROWS`, `WEAPON_STATS` and `TEMPLATES` from `07_data.js`. Keep the game constants.
- **Delete** `tools/import-v1-parts.mjs` and `tools/verify-bridge.mjs`.
- **Test:** a smoke test compares the new `PARTS` and `TEMPLATES` with the snapshot. The only allowed differences are cost keys (rubber became metal, fuel became wood, with the same totals) and new fields.
- **The Drafting Office shows the tier** of each part (a small "T0–T4" tag), as a fact, not a rating.

### 2.5b. SVG part art

- **`05b_art.js` gets the SVG source** (07 §6):
  1. paint tokens per side (player `league`, enemy `directorate`)
  2. rasterise the body and moving groups at 64 px per cell
  3. feed the same `art.byPart` entries the PNG route uses
- **Barrels:** pivot and muzzle come from the JSON (`moving.barrel.pivot`, `anchors.muzzle`) when present; `barrelLength()` and the pivot helper use them. Otherwise the v1 rule applies.
- **Structure cells** use the auto-tiling from `tools/part-render.js` (seams, bevels, rivets per material look) in the sprite painter.
- **Order of preference:** SVG, then PNG, then code drawing.
- **Test:** the Medium tank's 75 mm gun shows the SVG art in the Drafting Office and in battle (screenshot), recoils and elevates correctly, and shells leave from the muzzle.

### 2.5c. Housekeeping

- `UPDATE_NOTES.md` and `APPLY_V2_1.md` are already gone (deleted when v2.1 was applied).
- **Code comments** that cite `design/0N §x` refer to `design/v1/` (see its README). Update them when you touch a file.
- **Title menu:** the Gauntlet group stays; Workshop and Blueprints stay; the Battle Simulator is added in 2.6.

### Acceptance (2.5)

- [ ] The game plays exactly as before (all v1 tests pass). Parts and templates now come from `src/parts` and `src/vehicles`.
- [ ] A new foundry zip (SVG plus the JSON art fields) shows up in the game after integration, with no code changes.
- [ ] The c75 SVG art renders in both League and Directorate colours, at phone scale, with the barrel moving correctly.

## Step 2.6: three on the field and the Battle Simulator (v0.2.5)

- **Reserves and line-up for both sides:**
  - at most 3 ships on the field each
  - pull back (the ship drives off the rear edge, then the next in line enters 5 s later)
  - destroyed ships replaced from reserve
  - the battle ends when one side has no ships left
- **Controls:**
  - the v1 order chips become the **command wheel**: Move to, Fire at, Hold, Pull back, Smoke
  - the **reserve drawer** in the top bar
  - the pre-battle line-up editor
- **Battle Simulator screen** (title menu):
  - pick your designs (any number; 3 fight at a time)
  - pick a battlefield: inland, coast or sea; weather; time of day
  - pick the enemy: a force size, and templates or designs from the blueprint gallery
  - fight; the result card shows losses and damage, with no campaign effects
- **Aircraft and helicopters** fight as ordinary units here for now (01 §5).
- **The Gauntlet keeps its v1 rules** (waves, lives, score). Reserves don't apply there.

### Acceptance (2.6)

- [ ] Both sides rotate ships correctly. Line-up order is respected. The reserve drawer and "Send in" work with thumbs.
- [ ] The command wheel works on phone (long-press) and desktop (right-click).
- [ ] The Battle Simulator runs land, coast and sea battles. The Gauntlet is unchanged.

## Step 2.7: airships (v0.2.6)

- **New parts:** envelope materials `canvas_bag` and `rigid_env` (remove `planned`), and the `lifteng` part (05 §3.2).
- **Physics:** lift from envelopes and lift engines against mass, using the helicopter controller for movement and height. Burst or burning envelopes lose lift; below a lift margin of 1.0 the airship sinks, and it crashes the way a helicopter does.
- **Domains:** a design with envelopes or lift engines and no wings or rotors is an `airship`. The Drafting Office shows lift, mass and lift margin, with factual warnings.
- **Templates:** the airship templates from roster batch E. Placeholder art is fine until the Foundry delivers.
- **Battlefields:** airships can deploy on every battlefield (01 §10.2).

### Acceptance (2.7)

- [ ] An airship designed from scratch flies, climbs, descends, fights and falls when its envelopes are shot up.
- [ ] A gunship can fight alongside tanks inland and alongside ships at sea.

## Step 2.8: classes, tiers and paint (v0.2.7)

- **Designer class selector:** domain and class set the grid and part limit (`classes.json`). The v1 grid sizes are replaced by the classes.
- **Existing designs that no longer fit a class** keep working. They're marked "outside class limits: refit needed" (campaign only).
- **Paint:**
  - faction schemes and custom P1, P2 and P3 colours from the paint-shop palette
  - camouflage patterns (07 §3)
  - the player's scheme is chosen in the Simulator for now
- **New tier 0 parts** (roster batch D: steam, wheel_w, swivel, whull, wbow), plus the plank and ironwood cells.
- **Faction starting designs** (roster batch F) appear as templates when delivered.

### Acceptance (2.8)

- [ ] Every template and blueprint loads with a class. Class limits are enforced in the designer with factual messages.
- [ ] A design painted in the Directorate scheme shows its colours on SVG parts and paintable structure cells.

## Part 3: world map and fleets (v0.3)

This is v2 "Part 2" (the world map): the open world, the five factions, settlements, officers and fleets, map movement, fuel and stranding, the clock, contact, the pre-battle card, persistence and saves. The details are unchanged from the v2 plan:

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
- **Contact → pre-battle card → battle (using the 2.6 rotation) or auto-resolve → results back on the map.**
- **Persistence:** ship damage, losses and XP, captain survival; saves and loads.
- **Title menu:** **Campaign** appears here, not before.

### Acceptance (Part 3)

- [ ] A new campaign in any faction starts with the correct home territory and 3 fleets.
- [ ] Fleets move by domain rules; fuel burns; an empty fleet is stranded; path previews warn before it happens.
- [ ] Buying fuel and ammo uses the global treasury from any docked fleet.
- [ ] Battles start from map contact. Only allowed domains deploy. Results persist.
- [ ] Removing a captain garrisons them where they're left. Captains can't move alone.

## Part 4: economy, logistics and sieges (v0.4)

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

### Acceptance (Part 4)

- [ ] A campaign cannot be sustained on salvage alone. Supply routes visibly keep a fleet going.
- [ ] Crafting only works with the materials physically at that settlement or in the docked hold.
- [ ] A convoy on a standing route runs by itself, can be intercepted, and its loss is felt at the other end.
- [ ] Sieges work from both sides. A captured settlement changes owner and restarts production after 2 days.

## Part 5: research and advanced warfare (v0.5)

- **Tech tree and perks:** Command Points, research at cities and metropolises (08 §11–12).
- **Grand Admiral ranks;** admiral and captain levelling fully applied.
- **Drafting Office:** Missile tab (missile designer) and Drone tab (drone designer, grid limit set by the drone computer).
- **Missiles:** racks, VLS, magazines; guidance vs flares and ECM; warheads HE, napalm, acid, EMP, cluster.
- **Carriers, drones and air wings:**
  - hangars and drone computers; aircraft and helicopters now launch from carriers and airfields (01 §5)
  - drone orders; drones and air wings lost when their carrier leaves or dies
- **Fabricators;** release clamps and detachable sections.
- **Flamethrowers, lasers, plasma;** power and heat management; damage types and material resistances.
- **Radar, ECM, stabilisers;** the tier 3–4 music layer.

### Acceptance (Part 5)

- [ ] Researching a node unlocks its parts for crafting and the designer. Command Points force real choices.
- [ ] A drone carrier built in the designer launches drones that follow orders, and loses them when it retreats.
- [ ] Every warhead type has a visible, distinct effect. Flares beat heat seekers more than radar seekers.
- [ ] Energy weapons are limited by power and heat, not ammo.

## Part 6: living world and polish (v0.6 → 1.0)

- **Faction strategic AI:** expand, run convoys, raid, besiege, defend capitals; personalities per 09.
- **AI designs evolve** to counter what the player fields most (the no-meta pillar).
- **Relations:** war and truce changes, reputation, charters for neutral villages.
- **Win and lose conditions,** the war journal, medals, the blueprint gallery.
- **Balance pass** with simulator telemetry (08); performance pass on a mid-range Android phone.
- **Accessibility pass:** text size, colour-blind-safe status icons, reduced motion.

## Ongoing: art integration

- Foundry zips arrive in roster order (10). Integrate them as CLAUDE.md describes, whenever they appear in the repo root.
- **After 2.5, no code change is needed** for new art: the library carries it.
- **Before 2.5,** integrate zips anyway. The art simply waits in the library until 2.5b draws it.

## Release checklist (every step)

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
| 2026-09-27 | Design v2.1 | 0.2.3 | Design v2.1 applied: the part library now uses the game's own ids, categories and stat names, and holds all 52 v1 parts, 15 structure cells and the 15 v1 templates, copied exactly from the game's data (bridge check: 0 differences). The golden sample 75 mm gun is now `c75`. v1 design docs archived in `design/v1/`. Roadmap now continues from v0.2.3 with steps 2.5 to 2.8. Docs, tools and data only; no game code changed. | Two art zips on `main` (`foundry-batch-a`, `foundry-bridge`) use the pre-v2.1 part names (`wpn_c37_std` etc.) and are not integrated yet; waiting on the producer: rename to the game's ids, or have the Foundry resend. | Step 2.5a: parts from the library |

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
