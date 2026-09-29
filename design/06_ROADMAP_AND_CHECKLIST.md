# Iron Doctrine: roadmap and release checklist (v2.1)

- **Releases:** each step is a playable release on the GitHub Pages link. Sessions end with a Progress log row.
- **What v2.1 does:** it fits design v2 onto the game that already exists. v1 reached v0.2.2 (land, sea, submarine, aircraft and helicopter battles), and none of that is thrown away.
- **Order:** first bridge the existing game to v2 (steps 2.5–2.8, with 2.5d bringing Part 2d across), then build the campaign (0.3 onwards).

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

- [x] The game plays exactly as before (all v1 tests pass). Parts and templates now come from `src/parts` and `src/vehicles`. (v0.2.4, step 2.5a)
- [x] A new foundry zip (SVG plus the JSON art fields) shows up in the game after integration, with no code changes. (v0.2.5: every part with a `.svg` is drawn from it)
- [x] The c75 SVG art renders in both League and Directorate colours, at phone scale, with the barrel moving correctly. (v0.2.5; smoke test `svg-1`, `svg-2` screenshots and the muzzle check)

## Step 2.5d: bring Part 2d across (v0.2.6)

The producer chose to keep Part 2d, which was built on the v1 game in another session and never merged (branch `claude/design-06-part-2-vehicles-f07cv0`, one commit): radar, ECM and guided missiles, heat, breakdowns and crew roles, a test range picker and design lineage. It is brought across now, before the code moves further away from it.

- **Rebuild it on the current game,** not by merging the branch: its new parts go into `src/parts` as JSON (no art yet), and its code changes are re-applied file by file (`10e_systems.js` is new).
- **Design docs:** its v1 doc changes go into the v2.1 docs. Radar, ECM, missiles and heat arrive earlier than Part 5 planned; Part 5 keeps the rest (missile designer, warheads, drones, energy weapons).
- **Test:** its own smoke checks come across with it; everything else still passes.

### Acceptance (2.5d)

- [x] Every Part 2d feature works as it did on its branch, with its parts read from the library. (v0.2.6)
- [x] All existing tests pass, and the Part 2d branch can be deleted. (v0.2.6)

## Step 2.6: three on the field and the Battle Simulator (v0.2.7)

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
- **As built (v0.2.7):**
  - Reserves apply to battles started with a line-up (the Battle Simulator now, the campaign later). Enemy captains pull back ships below 35% hit points while they have others waiting. A ship pulling back passes its own side's ships.
  - The v1 order chips (Follow, Escort, Hold, Attack, Back) stay as squad-wide stances; the command wheel gives orders to one ship. It opens by long-pressing a ship card or your ship in the world, or right-clicking your ship: Drive, Move to, Fire at, Hold, Pull back, Smoke (flares and drones arrive with their parts).
  - The line-up editor is part of the Simulator screen (order, ▲, ✕); a campaign pre-battle card comes with Part 3.

### Acceptance (2.6)

- [x] Both sides rotate ships correctly. Line-up order is respected. The reserve drawer and "Send in" work with thumbs. (v0.2.7)
- [x] The command wheel works on phone (long-press) and desktop (right-click). (v0.2.7)
- [x] The Battle Simulator runs land, coast and sea battles. The Gauntlet is unchanged. (v0.2.7)

## Step 2.7: airships (v0.2.8)

- **New parts:** envelope materials `canvas_bag` and `rigid_env` (remove `planned`), and the `lifteng` part (05 §3.2).
- **Physics:** lift from envelopes and lift engines against mass, using the helicopter controller for movement and height. Burst or burning envelopes lose lift; below a lift margin of 1.0 the airship sinks, and it crashes the way a helicopter does.
- **Domains:** a design with envelopes or lift engines and no wings or rotors is an `airship`. The Drafting Office shows lift, mass and lift margin, with factual warnings.
- **Templates:** the airship templates from roster batch E. Placeholder art is fine until the Foundry delivers.
- **Battlefields:** airships can deploy on every battlefield (01 §10.2).
- **As built (v0.2.8):**
  - Envelope cells give fixed gas lift (gasLift × 100 kg); lift engines add up to 44 kN each while they have fuel, even if the drive engine is lost. The height controller works between venting gas (down to 85% of weight) and full lift. Below a lift margin of 1 it sinks; a wreck keeps at most half its weight in lift and comes down.
  - Air propellers push either way against drag (0.6 m² per metre of height); the envelopes keep it level.
  - Gondola guns swing from 45° down to 25° up on either side. Any gun can engage an airship (big and slow); aircraft still need AA.
  - Airships deploy at 30 m, including over the open sea. Drafting Office: Lift tab, the Airship class (the 24 × 10 gunship grid), lift, weight, lift margin, air speed and a warning below margin 1. Randomise makes airships too.
  - Templates: Canvas gunship (`gunship_t0`) and Rigid gunship (`gunship_t2`), in the starting templates and in the Simulator's mixed enemy forces.

### Acceptance (2.7)

- [x] An airship designed from scratch flies, climbs, descends, fights and falls when its envelopes are shot up. (v0.2.8; the randomiser's airships and both templates)
- [x] A gunship can fight alongside tanks inland and alongside ships at sea. (v0.2.8)

## Step 2.8: classes, tiers and paint (v0.2.9)

- **Designer class selector:** domain and class set the grid and part limit (`classes.json`). The v1 grid sizes are replaced by the classes.
- **Existing designs that no longer fit a class** keep working. They're marked "outside class limits: refit needed" (campaign only).
- **Paint:**
  - faction schemes and custom P1, P2 and P3 colours from the paint-shop palette
  - camouflage patterns (07 §3)
  - the player's scheme is chosen in the Simulator for now
- **New tier 0 parts** (roster batch D: steam, wheel_w, swivel, whull, wbow), plus the plank and ironwood cells.
- **Faction starting designs** (roster batch F) appear as templates when delivered.
- **As built (v0.2.9):**
  - A design loads into the smallest class of its domain that it fits (grid and part count; structure cells don't count). The class button in the Drafting Office lists the domain's classes with grid, part limit and captain level; choosing one re-grids the design if it fits and says why not otherwise. Placing a part beyond the limit is refused with the reason. A design that fits no class keeps working and shows "outside class limits: refit needed".
  - Paint card (Drafting Office): scheme, custom primary, secondary and accent colours from the 24-colour palette, and camouflage (bands, blotch, splinter, stripes: P1 and P2 darkened inside the pattern, P3 kept). Paint is saved with the design and shown in thumbnails and battle. Designs without their own paint use "Your colours", chosen in the Simulator; the enemy uses the Directorate scheme.
  - Wooden hull and bow sections (`whull`, `wbow`) added; plank and iron-banded plank cells were already live.

### Acceptance (2.8)

- [x] Every template and blueprint loads with a class. Class limits are enforced in the designer with factual messages. (v0.2.9)
- [x] A design painted in the Directorate scheme shows its colours on SVG parts and paintable structure cells. (v0.2.9)

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
- **As built (v0.3.0):**
  - World: 192 × 144 cells of 10 km, seeded; sea (small enclosed waters become marsh), plains, forest, hills, mountains with passes where roads cross, desert and ruins in the south-east, marsh, tundra and ice in the north. The terrain is regenerated from the seed on load, so saves hold only what changes (`irondoctrine.campaign.slot1`, its own version and backup rule).
  - Settlements: every AI faction has its capital (09 types), a coastal city, 2 villages and a fort; the player has a coastal home city, 2 villages and a fort (01 §4.3); 14 neutral villages. Roads join neighbours; territory is the nearest settlement's within 14 cells.
  - Fleets: the player's land fleet under the Grand Admiral, a sea and an air fleet (3 ships each: Medium, Light and Scout; 3 Gunboats; 3 Canvas gunships, until batch F designs arrive); each AI faction has land, sea and air fleets. Every ship has a captain. March speed = half the slowest ship's top speed × terrain (roads × 1.5); map fuel from engine fuel use (08 §8), shared across the fleet's tanks; stranded fleets crawl at 10% (air can't move). Tapping a destination shows hours and fuel needed vs held, warning of stranding.
  - Clock: Start/Stop, 1×/3×/10× (1 in-game hour per second at 1×); it stops on contact, arrival, fuel below 15% and stranding. Weather fronts drift and slow fleets (storms slow air fleets most) and set a battle's weather; the hour sets its light.
  - Markets: fuel and ammo at every settlement with the 08 §6 prices, multipliers, stock and daily refill; refuel and rearm a docked fleet, or trade with its hold. Daily: settlement money, fort upkeep and wages.
  - Contact: a pre-battle card (battlefield, both sides as spotted, retreat cost) with Fight (the 2.6 rotation, persistent damage, fuel and ammo), Auto-resolve (the same battle headless, at most 240 s) and Retreat (free if your slowest ship outpaces their fastest, else the rearmost ship is lost). Every fleet within 4 cells joins; only domains allowed on the battlefield deploy. Results: ship damage, losses, captain survival (50%), captain and Grand Admiral XP, a 5% bounty; emptied fleets are gone (the Grand Admiral escapes to the nearest settlement, losing 20% of the treasury); the loser falls back.
  - Detach puts a ship and its captain in the settlement's garrison (up to its limit) or in a field outpost; a fleet of the same domain picks them up.
  - Fog of war over units: enemy fleets show within 8 cells of your fleets (air × 1.3) and 6 of your settlements.
  - Simplified for now: AI fleets patrol and, from day 2, intercept player fleets they can see and expect to beat; they don't burn map fuel or fight each other yet. Settings toggles for the clock's automatic stops, salvage, and export of the campaign save come later.

### Acceptance (Part 3)

- [x] A new campaign in any faction starts with the correct home territory and 3 fleets. (v0.3.0)
- [x] Fleets move by domain rules; fuel burns; an empty fleet is stranded; path previews warn before it happens. (v0.3.0)
- [x] Buying fuel and ammo uses the global treasury from any docked fleet. (v0.3.0)
- [x] Battles start from map contact. Only allowed domains deploy. Results persist. (v0.3.0)
- [x] Removing a captain garrisons them where they're left. Captains can't move alone. (v0.3.0)

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
- **As built (v0.4.0):**
  - Goods: fuel, ammo, wood, metal, electronics and scrap, plus part items (each takes its mass ÷ 100 in units). They sit in one settlement warehouse (08 §7 capacity) or one fleet hold (cargo bays); only money is global. Markets trade every good (scrap is sell-only), into a docked hold or your own warehouse. Stores tab: load and unload a docked fleet, goods and parts. Refuel and rearm take your own warehouse's stock first (free), then buy; a hold's ammo rearms a fleet anywhere.
  - Production: every owned settlement makes goods daily by type × biome into its warehouse (full warehouses waste the rest). Your home city starts with the 08 §13 kit. Unpaid wages or upkeep: forts and citadels close their services; after 3 unpaid days captains may desert.
  - Upgrades (village → city or fort, city → metropolis, fort → citadel) with the 08 §7 costs from that warehouse; done after the stated days.
  - Workshop (city tier 0–2, metropolis all): one queue; the cost from the warehouse, then docked holds; a money fee of 10% of the goods' value; time per 08 §4. Until the tech tree (Part 5), tier 0–1 parts count as researched. Refinery: 4 scrap → 1 electronics in 1 h (metropolis 3 scrap, 0.75 h).
  - Yard (city: classes 1–2; metropolis: all; ships need a coast): build any template or saved design (parts in stock are used first; the rest are made), with a level-1 captain, into the garrison; dock repair and refits per 08 §5 (removed parts go to the warehouse). Repair bays mend 200 HP/h on the map from the hold's goods.
  - Barracks at forts and citadels: captains with ships and admirals (weekly offers, 08 §13 prices); quartermasters at cities. An admiral forms a fleet from the garrison; captains of level 6+ can be promoted; a spare captain can take a captainless ship.
  - Salvage when you win: 12% of destroyed parts as worn items, 30% of the mass as scrap (cranes and Salvage Clans bonuses); what doesn't fit in the holds lies on the field for a day. 10 scrap fields (200–600 each) give 4 scrap/h to a fleet with a crane. Salvaged enemy parts can be studied at a metropolis (3 days) to unlock their family.
  - Convoys: a quartermaster with support ships (no weapons) and up to 2 escorts, 6 ships in all. A standing route loads at A, delivers to a settlement or meets a named fleet (fuel and ammo go straight into its tanks and magazines), returns, repeats; it doesn't stop the clock. AI fleets treat convoys as closer (raiding). The Supply button shows routes, warehouse bars, and under each fleet an ammo bar and days of fuel; low fleets ring amber, stranded ones red.
  - Sieges: "Lay siege" from an enemy or neutral settlement's Info tab with a fleet within 4 cells. The defenders stand behind 2 wall sections and a keep (08 §7 HP, the nearest armour material; the keep 2 × the walls) with guns in the emplacement slots (+20% accuracy; AI settlements mount MGs and 37/75 mm guns; you install guns from the warehouse in the Info tab), and fight with the garrison and militia (1–5 armoured cars, scouts, light tanks) three at a time. Win by destroying every defender or the keep. Capture: new owner, production restarts after 2 days, 25% of its production value as plunder for 10 days, the old garrison is lost. Held: the walls stay damaged and mend 15% a day. From day 4 AI land fleets march on your settlements they clearly outmatch and lay siege; you get a card to fight, auto-resolve or let it fall.
  - Maps are now made so every settlement stands on the main stretch of land (older saves keep their map).
  - Not yet: part wear and condition effects, Mk II/III upgrades at the workshop, field swaps with a mobile workshop, the designer's "in stock" counts, faction-style wall art (walls draw as armour blocks), AI factions' own economy, convoys and ship building.

### Acceptance (Part 4)

- [x] A campaign cannot be sustained on salvage alone. Supply routes visibly keep a fleet going. (v0.4.0: salvage is 12% of parts and 30% of mass, only after wins; a convoy route refuels and rearms a stranded fleet in the tests)
- [x] Crafting only works with the materials physically at that settlement or in the docked hold. (v0.4.0)
- [x] A convoy on a standing route runs by itself, can be intercepted, and its loss is felt at the other end. (v0.4.0)
- [x] Sieges work from both sides. A captured settlement changes owner and restarts production after 2 days. (v0.4.0)

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

### Sub-steps (Part 5)

- **5a. Research, perks and ranks** (done in v0.5.0): the 45-node tree and 14 perks, Command Points from the Grand Admiral's rank, research jobs at cities and metropolises, unlocks for workshops, yards and the campaign Drafting Office, perk effects, captain levels in battle, Grand Admiral fleet size and XP from captures, convoys and reverse-engineering.
- **5b. Missiles** (done in v0.5.2): the Missile tab, racks, VLS, magazines, flares, warheads, guidance against flares and ECM, in battle.
- **5b2. Missiles as items** (done in v0.5.3): crafting missile designs at metropolis workshops, stock in warehouses and holds, each ship carrying missiles of its design, loading docked fleets, and battles using and returning what ships carry.
- **5b3 (later, with Part 6 AI designs):** AI factions' designs that carry missiles, and AI missile stock.
- **5c. Drones** (done in v0.5.5): drone hangars, drone computers I–III, drone parts, the Drone tab, launching from carriers, drone orders (attack, defend, scout, recall), drones lost with their carrier, shot down by machine guns and blasts.
- **5c2. Air wings and drone items** (done in v0.5.7): the aircraft hangar, aircraft and helicopters launched from carriers as air wings under the carrier's orders, and drones and air-wing aircraft as campaign items (made, stocked, loaded, carried, coming home).
- **5c3 (later, with Part 6):** airfields at cities, metropolises, forts and citadels launching air wings into nearby battles; AI carriers in faction designs; fabricators rebuilding drones in battle (5e).
- **5d. Energy weapons and damage types** (done in v0.5.9): flamethrowers, lasers, plasma, power and heat, material resistances.
- **5e. Fabricators and detachable sections;** the tier 3–4 music layer.

### Acceptance (Part 5)

- [x] Researching a node unlocks its parts for crafting and the designer. Command Points force real choices.
- [x] A drone carrier built in the designer launches drones that follow orders, and loses them when it retreats.
- [x] Every warhead type has a visible, distinct effect. Flares beat heat seekers more than radar seekers.
- [x] Energy weapons are limited by power and heat, not ammo.

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
| 2026-09-27 | Art | 0.2.3 | Art: Foundry batch A and the bridge. The zips used the old v2 names, so they were renamed to the game's ids. Art added to 9 existing parts (c37, mg, optics, smoke, ammo, cargo, fuel_s, prop, aprop): only the SVG and art fields; stats unchanged (bridge check still 0 differences). 5 new tier 0 parts added with art: steam, wheel_w, swivel (stats from 05 §3.1), and bridge and cabin (new; stats from the Foundry sheet in the game's stat names, added to 05 §3.1 and roster D7–D8). Library now 57 parts. | The game doesn't draw from the library yet, so the art isn't visible in play until step 2.5. The new parts aren't used by any design yet. The embedded SVG art adds about 115 KB to game.js. | Step 2.5a: parts from the library |
| 2026-09-27 | 2.5a | 0.2.4 | Art batch A1 integrated first (track, eng_m, crew2, turret, radio; new art for c37, mg, optics, fuel_s, ammo): the Light and Medium tanks are now fully covered in the previews. Step 2.5a: the game now builds its parts and templates from the part library (`PART_LIBRARY`) instead of the tables in `07_data.js`, which are removed. A smoke test compares every v1 part and template with a snapshot taken before the switch (`tests/v1-parts-snapshot.json`): no differences. The Drafting Office shows each part's tier as a small T0–T4 tag. The palette lists parts by tier, then mass. The v2 library entries not marked planned now appear in the palette: plank, iron-banded plank, composite and light alloy cells, the steam engine, spoked wheel, swivel gun, command bridge and crew cabin. Deleted the one-off import and bridge-check tools. | The new parts and cells still use the plain code drawing (their SVG art arrives with 2.5b) and haven't been balance-tested in battle. The palette's details line (size, mass, cost) is cut off at the right edge on phones (existing layout, unchanged). The autoplay time in the smoke test varies with machine speed (12–18 s); it isn't a balance measure. | Step 2.5b: SVG part art in the game |
| 2026-09-27 | 2.5b | 0.2.5 | SVG part art in the game. Every part with a `.svg` in the library is painted in its side's colours (player League, enemy Directorate), split into body and barrel, and turned into images at 64 px per cell when the game starts. SVG art is used first, then the old PNG route, then the v1 code drawing. Barrels rotate about the pivot in the part's JSON, and shells and muzzle flashes start at its muzzle; a barrel written behind its body in the SVG is drawn behind the vehicle. Structure cells (plate, armour, frames, timber and the new plank cells) are auto-tiled from `materials.json`: painted in the side's colours, with joined-up edges, seams and rivets. The red wash on enemy vehicles is gone, since enemies now have their own paint. New smoke check: the art is ready for both sides, a 75 mm shell leaves exactly from the art's muzzle facing either way, and the barrel recoils; close-ups at every screen size. Headless performance unchanged (about 0.5 ms of game work per frame). Roadmap: step 2.5d added to bring Part 2d across; later steps' versions moved up by two. | 2.5c housekeeping (updating old `design/0N` comments to `design/v1/`) is only partly done: new comments point at the right docs, old ones are unchanged. Moving parts other than barrels (wheels, tracks, propellers, the steam engine's flywheel) are drawn still for now. The Drafting Office parts list shows the art only if it had loaded before the list was opened (it loads within a second of starting the game). | Step 2.5d: bring Part 2d across |
| 2026-09-27 | 2.5d | 0.2.6 | Part 2d brought across onto the current game. Its code was re-applied file by file: radar and ECM, guided anti-tank missiles, SAM launchers, rocket pods, spaced skirts, heat, breakdowns, crew roles, a repair workshop, the test range picker (land, sea, sky), the design lineage view, and Tank hunter and SAM site enemies (random levels and level 17). Its 16 parts are now library files (`src/parts`, tiers from the 08 tech tree), its 2 enemy designs are in `src/vehicles`, and its v1 doc changes are in `design/v1/`. The bridge layer's id is now `bridge_l`, because `bridge` is the command bridge. The snapshot test now uses the Part 2d tables, and all Part 2d checks pass (missile hit rates: ATGM 78%, with radar 95%, against ECM 50%). Producer decision: art integration paused until Part 3 is done (CLAUDE.md). | The branch `claude/design-06-part-2-vehicles-f07cv0` can be deleted. Campaign-only parts (troop compartment, fuel cargo tank, winch, dozer blade, bridge layer, landing ramp, command radio's platoon) only have mass, cost and hit points until the campaign uses them. | Step 2.6: three on the field and the Battle Simulator |
| 2026-09-27 | 2.6 | 0.2.7 | Three on the field and the Battle Simulator. Battles with a line-up keep 3 ships a side on the field; the rest wait in order and enter from their own rear edge 5 s after a ship is destroyed or pulls back. Pulled-back ships keep their damage and rejoin the end of the line, and enemy captains pull back badly damaged ships. A side loses when nothing is left on the field, on the way in or in reserve. Command wheel: long-press a ship card or your ship (right-click on desktop) for Drive, Move to, Fire at, Hold, Pull back and Smoke. Reserve drawer in the top bar: the line-up with hull condition, ▲ to reorder, Send in (then pick which ship pulls back). Battle Simulator on the title screen: line-up, battlefield (inland, coast, open sea), weather and time of day, and the enemy (a number of ships mixed for the battlefield, or your own picks). Its result card shows facts only. Gauntlet unchanged. New smoke checks: rotation rules on both sides, and the Simulator, wheel, Pull back and drawer on phone and desktop. | Enemy reserves enter at their edge even when the sea there is narrow. Aircraft pulling back simply leave after 3 s. Reserve ships don't repair yet (repair bay rule, 01 §10.3). The order chips and the wheel both exist; the chips may go once the campaign's fleet orders arrive. | Step 2.7: airships |
| 2026-09-27 | 2.7 | 0.2.8 | Airships. Canvas gas bags and rigid envelopes are live, and the lift engine is a new part (Lift tab). A design with envelopes or lift engines and no wings or rotors is an airship: it flies with the helicopter controls (◀ ▶ move, ▲ ▼ height), lift comes from the gas cells plus lift engines, it sinks below a lift margin of 1 and comes down when its envelope is shot away. Any gun can hit an airship; its own guns swing down at the ground. Drafting Office shows gas lift, lift engines, weight, lift margin and air speed. Two templates (Canvas gunship, Rigid gunship) and an airship randomiser. Airships deploy on every battlefield, including the open sea. New smoke checks: height hold, climb, descend, move, falling when holed, and a gunship firing inland and at sea for a minute. | Envelopes and the lift engine use the plain code drawing (no art yet). Lift engines have no animation. Airships don't yet turn to face a target they pass. | Step 2.8: classes, tiers and paint |
| 2026-09-27 | 2.8 | 0.2.9 | Classes, tiers and paint. The Drafting Office uses the classes from `classes.json` (Tank, Behemoth, Landship, Land dreadnought; Corvette to Battleship; Gunship to Sky fortress; Aircraft): a class button with grid, part limit and captain level, a parts counter, refusal past the part limit with the reason, and an "outside class limits" mark for designs that fit no class. Every template has a class. Paint card: faction schemes, custom colours from the paint-shop palette, and four camouflage patterns, saved with the design and shown everywhere it's drawn. "Your colours" in the Simulator; the enemy is the Directorate. SVG art is now prepared for any paint on demand. Wooden hull and bow sections added. New smoke checks: every template has a class; misfit reasons; Directorate paint on SVG parts and structure (no League blue left); paint and class screenshots. | Camouflage isn't shown on the Drafting Office grid itself (it is in the paint preview, thumbnails and battle). Batch F faction designs haven't been delivered. | Part 3: world map and fleets |
| 2026-09-27 | Part 3 | 0.3.0 | The campaign: New campaign (choose one of five factions) and Continue campaign on the title screen. A seeded open world map with terrain, sea, roads, faction territory, settlements of every type, weather and fog of war. Your land fleet (under the Grand Admiral), sea fleet and air fleet move by domain rules with a path preview of time and fuel; fuel burns and empty fleets strand. Markets sell fuel and ammo for the global treasury; settlements earn money and officers draw wages daily. Enemy fleets patrol and hunt; contact brings a pre-battle card, then Fight (a real three-on-the-field battle), Auto-resolve or Retreat, and the damage, losses, XP and bounty carry back to the map. Ships and captains can be left in a garrison or a field outpost and picked up again. The campaign saves to its own slot and autosaves daily and after battles. New smoke checks cover starts in all five factions, movement rules, fuel and stranding, refuelling, contact and auto-resolve, persistence through save and load, garrisons and outposts, and which domains deploy; screenshots of the faction choice, map and contact card. | Map art is simple painted cells, not yet the From the Depths-style painted map. AI fleets don't burn fuel or fight each other, and there's no siege, salvage, crafting or convoy yet (Part 4). Settings has no toggles for the clock's automatic stops yet. Starting fleets use v1 templates until the Foundry's batch F designs arrive. | Part 4: economy, logistics and sieges (paused here at the producer's request: art integration next) |
| 2026-09-27 | Part 3 fix | 0.3.1 | Fix from the producer: fleets couldn't be moved on the map. The map's screen overlay caught every tap, so taps never reached the map (a general overlay rule overrode it; the Workshop and Drafting Office already had the exception, the map didn't). Also: the top bar no longer blocks taps along the top of the map; the move bar and panel now really hide; the panel has a ✕ and a Details button to reopen it, and steps aside while a move is planned; tapping the selected fleet again deselects it. The smoke test now moves a fleet with real taps (finger on phones, mouse on desktop): tap a spot, Move, Start, and the fleet travels. | The earlier campaign tests called the game directly and missed this; the new check uses real input. | Art integration, then Part 4 |
| 2026-09-27 | Part 4 | 0.4.0 | Economy, logistics and sieges: physical goods in warehouses and holds, production, markets for every good, loading, upgrades, running out of money; workshop crafting, refinery, yard building, dock and field repair, refits; recruitment, forming fleets, promotion, salvage, wreck sites, scrap fields, reverse-engineering; quartermaster convoys on standing routes, raiding, the Supply view; sieges with walls, keep, emplacements and militia, capture, plunder, mending walls, AI sieges. Campaign saves v1 → v2 migrate (backup kept). Map fix: settlements only on the main landmass (some seeds had the home city marooned so the land fleet couldn't move). | Not yet: wear, Mk upgrades, mobile workshop swaps, designer stock counts, wall art, AI economy. | Art integration (if zips arrive), then Part 5 |

| 2026-09-28 | Art | 0.4.0 | Art: Foundry batch A2 (road and off-road wheels, petrol engine S, diesel engine H, HMG, 105 mm, howitzer, fire control, stabiliser, night sight, radiator, self-sealing tank, protected ammo) and batch B (hull, bow, keel, bulkhead, pressure hull, marine diesel, thruster, ballast tank, electric motor, naval gun, torpedo tube, depth charges, sonar, 1000 L tank). Only art fields (overhang, anchors, moving, notes) and SVGs taken; no format errors or balance warnings. | The zips also held older drafts of the smoke launcher, cargo bay and ship propeller (no mount or layer, old anchors); the batch A versions already in the repo were kept. |
| 2026-09-28 | 5a | 0.5.0 | Research, perks and ranks. A Research button on the map opens the tech tree (45 nodes, 10 branches, tiers 1–4), the perk list (14) and the Grand Admiral card. Command Points: 2 per Grand Admiral level from level 2 (58 at level 30) against about 160 for the whole tree. Research runs one job at a time at your city (T1–T2) or metropolis (T3–T4): CP, money, electronics and scrap from that settlement's warehouse, and days; losing the settlement stops the job and returns the CP. A finished node unlocks its parts for workshops, yards and the campaign Drafting Office (opened from the Research card, it offers researched parts only and explains locked ones). Perks act at once: accuracy, rotation times, captain reactions, fleet sizes, holds, map fuel, salvage, convoys, field repair, crafting time, refining, prices, settlement money. Captain levels now count in battle (+2% accuracy, −3% reaction time per level). The Grand Admiral's fleet size follows admiral level ⌈L ÷ 3⌉; XP also comes from captures (village 100 to metropolis 800), convoy deliveries (20) and reverse-engineering (50). Directorate: heavy guns −1 CP; Lumen: tier 4 energy −30% CP, all tiers at their cities. Campaign save v3: older campaigns keep every tier 1 node known (those parts were free before). | New campaigns start with tier 0 parts only, so building tier 1 designs (tracks, 75 mm) needs research first; the starting fleets are unaffected. Nodes whose parts aren't in the game yet (flamethrowers, drones, lasers and others) can be researched and say so. Captain repair speed per level isn't applied yet. Next: 5b missiles. |
| 2026-09-28 | Art | 0.5.1 | Art: Foundry batches D, E and F1–F2. New art for the wooden hull and bow sections and the lift engine; a longer barrel for the swivel gun. New art-ready gunship_t0 and gunship_t2 airships. Six faction starting designs (League and Directorate tank, corvette and gunship). The League and the Directorate now start the campaign with their own designs; the other factions keep the v1 templates until F3. | Not taken: the zip's steam and wheel_w (identical to the repo's), its materials.json (it marked the envelopes `planned` and made canvas unpaintable), and its lift engine stats (the repo keeps them and metropolis crafting). Two campaign test checks no longer assume the League's land fleet survives its first auto-resolve. Next: 5b missiles. |
| 2026-09-28 | 5b | 0.5.2 | Missiles. 10 missile parts (HE, napalm, acid, EMP and cluster warheads, rocket motor, propellant, fins, radar and heat seekers), the missile rack, VLS block, missile magazine and flare launcher join the library, with 7 library missile designs (small, medium, large). A Missiles button in the Drafting Office opens the Missile tab: pick a size, place parts, read speed, range, guidance, warhead and cost, save your own designs, and choose the missile a ship carries. In battle, racks and VLS fire the ship's missile (the VLS straight up first); magazines refill empty launchers; radar seekers are jammed by ECM, heat seekers are not; crews fire flares when a locked missile closes, fooling heat seekers far more often (hit rate 95% → 13%) than radar seekers (78% → 68%). Warheads: HE blast; napalm fires and a burning patch; acid corrodes armour (it drips and darkens); EMP stops weapons, turrets and radar lock for 5 s (blue arcs); cluster splits into 4 small missiles. | In the campaign, missiles are free and launchers start full each battle until 5b2 makes them items. No new part has SVG art yet (plain code drawings). Flares can't yet be fired by hand (the crew fire them). AI designs don't carry missiles yet. The missile designer is a card, not a full tab bar. Next: 5b2, missiles as items. |
| 2026-09-28 | 5b2 | 0.5.3 | Missiles as campaign items. A metropolis workshop lists Craft missiles: every missile design whose parts are researched, ×1 or ×4, paid from the goods of its parts plus the usual fee; the missiles go to the warehouse and take cargo space by mass (about 1 unit for a small one). Load parts / Unload parts now move missiles too. Each ship carries missiles of its design, up to what its launchers and magazines hold; a docked fleet's Load missiles button fills them from the warehouse and docked holds (missiles of another kind go back to the warehouse). A campaign battle starts each of your ships with only what it carries, and what it didn't fire comes home; a ship pulled back to the reserve keeps its count. The fleet panel lists each ship's missiles; the warehouse lists missile stock. | Other factions' ships still get full launchers for free, and none of their designs carry launchers yet (5b3, with the Part 6 AI designs). Auto-resolved battles don't use missiles. Old saves need no change: ships and stores without missiles simply have none. Next: 5c carriers, drones and air wings. |
| 2026-09-28 | Art | 0.5.4 | Art: Foundry batches F3 and G. F3: tank, corvette and gunship designs for Skyreach, the Clans and the Lumen Collective, so every faction now starts the campaign with its own designs. G: three new parts in the game (57 mm cannon and mortar, both from Medium guns research; steel cargo hold, from Better stores); art for the flare launcher, rocket pod, search radar, repair workshop and recovery winch (the zip's `rocket`, `radar`, `repair`, `crane`, put on the game's ids with the game's stats kept); flamethrower and mobile workshop added as planned, with their art waiting for their mechanics. | The mortar JSON lacked a direct-hit damage and calibre, which every gun needs: added dmg 20 and cal 81. The Skyreach gunship's lift margin is 1.06, below the roster's 1.15–1.3 band (it flies). The SVG art test now skips planned parts. Next: 5c carriers, drones and air wings. |
| 2026-09-28 | 5c | 0.5.5 | Drones. New parts: drone hangar (Special tab of the Drafting Office; holds 4, launches one every 3 s), drone computers I–III (2, 4 or 6 drones in the air; drone designs up to 8×4, 10×5, 12×6), and drone parts (core, rotor, gun, charge, camera). Four library drones (gun, strike, scout, heavy gun) and a Drone carrier truck template. A Drones button in the Drafting Office opens the Drone tab (the Missile tab's card, now shared): size by computer, parts, numbers (mass, lift, speed, HP, weapons, camera, cost), save, and choose the drone a ship's hangars hold. In battle carriers launch by themselves; long-press a carrier for Drones: attack, defend, scout or recall. Gun drones stand off and fire; strike drones dive in and burst; cameras spot enemies within 40 m. Drones don't count towards the three on the field, are shot by machine guns and blasts, and fall when their carrier is destroyed or leaves. | Drones are free in every battle for now, and in the campaign too (5c2 makes them items). No art yet for the hangar, computers or drone parts (plain drawings). AI faction designs don't carry hangars yet. The ship designer's part tabs gained a third row (Special). Next: 5c2 air wings and drone items. |
| 2026-09-29 | Art | 0.5.6 | Art: Foundry batch H1. Art for the missile rack, VLS block, missile magazine and ECM suite (the game's stats kept). New in the game: the 203 mm heavy gun (6×2, Super-heavy guns research). Fabricator and release clamp added as planned, their art waiting for step 5e. | The zip proposed heavier, better-armoured rack, VLS, magazine and ECM, and a 4-missile magazine; not taken (art only for existing parts); listed for the producer. Next: 5c2 air wings and drone items. |
| 2026-09-29 | 5c2 | 0.5.7 | Air wings and air items. New part: the aircraft hangar (6×3, Carriers research; holds 2, launches one every 10 s), and an Escort carrier template (the destroyer with a hangar in place of its twin gun). The Drone tab picks the air wing's aircraft (fighter, bomber, scout helicopter or your own aircraft designs). In battle the wing flies under the carrier's orders (the wheel's Air entry: attack, defend, scout, recall; recalled aircraft land and go back aboard); it doesn't count towards the three on the field or the win; if the carrier is destroyed or leaves, its aircraft head for their own edge and are lost. Campaign: drones are made at a metropolis workshop and aircraft at a city or metropolis yard, both into the warehouse; docked fleets get Load drones and Load aircraft; ships carry them into battle and bring home what survives (drones and aircraft still flying at the end land). Load / Unload parts move them too. Fix: aircraft over the sea no longer cut their engine (the land units' shoreline guard applied to them). | Airfields (air wings from nearby settlements), AI carriers and fabricators are later (5c3, 5e). Other factions' carriers still get free drones and aircraft. Auto-resolve ignores drones and air wings. Next: 5d energy weapons and damage types. |
| 2026-09-29 | Art | 0.5.8 | Art: Foundry batches H2, C1 and C2. C1–C2: art for every aircraft and helicopter part (wing, tail, aero engine, jet, gas turbine, rotor, tail rotor, bomb rack, 20 mm autocannon, 40 mm AA gun); all matched the game exactly. H2: art for the aircraft and drone hangars, drone computers I–III, drone core, camera and gun (stats kept). | Not taken: the rotor, charge and laser, drawn 1×1 where the game's parts are 2×1 (footprint changes need the producer's choice). The zip also proposed other masses and HP for these parts (e.g. aircraft hangar 6000 kg, drone gun reload 0.15 s); not taken. Fix: the map rebuilt its panel and move bar four times a second even with the clock stopped, so a tap could land on a button being replaced (the Move button sometimes ignored taps on phones); now only while the clock runs, and the move bar only when its plan changes. The map tap test also tries more places on screen. |
| 2026-09-29 | 5d | 0.5.9 | Energy weapons, flamethrowers and damage types. New parts (tier 4): pulse and heavy laser, plasma cannon and plasma lance, capacitor bank, Precursor reactor; the flamethrower goes live. Lasers and plasma use no shells: they recharge from spare power (engine power less what systems draw; slower when short), a capacitor bank covers the shortfall and refills from the surplus, and each shot adds weapon heat (shedding 8 a second, more with radiators); at 100 they lock until cooled to 50. Lasers are near-instant beams (white core, side-coloured glow, a zap); plasma bolts are slow violet bolts that barely drop (the aim allows for it). Flamethrowers fire by themselves within 12 m, burn a litre of fuel a second, burn the two nearest parts at 30 a second and set them alight. Damage types: fire (flamethrowers, napalm, burning parts), laser, plasma, acid, EMP; materials resist them (composite: fire 50%, plasma 60%, acid 70%). Laser tank and flame tank templates. The Drafting Office shows recharge power and speed, capacitor and heat per volley. | Precursor plating (laser and EMP resistance) is still a planned material. The drone laser and laser seeker wait. No HUD bar for weapon heat yet (a note says when it locks and unlocks). Next: 5e fabricators and detachable sections; the tier 3–4 music layer. |

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
