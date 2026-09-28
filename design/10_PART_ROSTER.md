# Iron Doctrine: part roster (production order, v2.1)

**How this list is used**
- **Order:** the Art Foundry works down this list.
- **Existing parts:** the game already has these, with stats. The Foundry adds **art only**: the `.svg`, plus the art fields in the part's `.json` (`overhang`, `anchors`, `moving`). It never changes their stats, footprint or behaviour.
- **New parts:** the Foundry makes both the JSON (starting values in 05 §3) and the art.
- **Tracking:** the repo updates the status when a foundry zip is integrated (CLAUDE.md).
- **Status values:** `todo`, `in progress`, `delivered` (zip made), `integrated` (in the repo), `done` (verified in game).
- **Previews:** to see a part in context, run `--vehicle light`, `medium`, `scout`, `truck`, `gunboat`, `destroyer`, `sub`, `fighter`, `bomber`, `heli` or `behemoth`.

## Batch A: land parts (art for existing parts, in the most-seen templates)

Parts in the Light and Medium tanks come first: they appear in almost every battle.

| # | id | Name | Folder | Cells | Status |
|---|---|---|---|---|---|
| A1 | track | Track segment | mobility | 2×1 | integrated (batch A1) |
| A2 | eng_m | Diesel engine M | mobility | 3×2 | integrated (batch A1) |
| A3 | crew2 | Crew compartment | structure | 2×2 | integrated (batch A1) |
| A4 | turret | Turret ring | structure | 3×1 | integrated (batch A1) |
| A5 | c37 | Cannon 37 mm | weapon | 2×1 | integrated (batch A1) |
| A6 | mg | Machine gun | weapon | 1×1 | integrated (batch A1) |
| A7 | c75 | Cannon 75 mm | weapon | 3×1 | **integrated (golden sample)** |
| A8 | radio | Radio | system | 1×1 | integrated (batch A1) |
| A9 | optics | Optics | system | 1×1 | integrated (batch A1) |
| A10 | fuel_s | Fuel tank 200 L | logistics | 1×1 | integrated (batch A1) |
| A11 | ammo | Ammo rack | logistics | 1×1 | integrated (batch A1) |
| A12 | wheel_s | Road wheel | mobility | 1×1 | integrated (batch A2) |
| A13 | eng_s | Petrol engine S | mobility | 2×2 | integrated (batch A2) |
| A14 | hmg | Heavy machine gun | weapon | 1×1 | integrated (batch A2) |
| A15 | c105 | Cannon 105 mm | weapon | 4×1 | integrated (batch A2) |
| A16 | smoke | Smoke launcher | weapon | 1×1 | integrated (batch A) |
| A17 | wheel_l | Off-road wheel | mobility | 2×2 | integrated (batch A2) |
| A18 | cargo | Cargo bay | logistics | 2×2 | integrated (batch A) |
| A19 | how | Howitzer 150 mm | weapon | 4×2 | integrated (batch A2) |
| A20 | eng_h | Diesel engine H | mobility | 4×2 | integrated (batch A2) |
| A21 | fc | Fire-control computer | system | 1×1 | integrated (batch A2) |
| A22 | stab | Gun stabiliser | system | 1×1 | integrated (batch A2) |
| A23 | nsight | Night sight | system | 1×1 | integrated (batch A2) |
| A24 | radiator | Radiator | mobility | 1×1 | integrated (batch A2) |
| A25 | fuel_ss | Self-sealing tank 150 L | logistics | 1×1 | integrated (batch A2) |
| A26 | ammo_p | Protected ammo storage | logistics | 1×1 | integrated (batch A2) |

## Batch B: ships and submarines (art for existing parts)

| # | id | Name | Folder | Cells | Status |
|---|---|---|---|---|---|
| B1 | hull | Ship hull section | structure | 2×2 | integrated (batch B) |
| B2 | bow | Bow section | structure | 2×2 | integrated (batch B) |
| B3 | keel | Keel | structure | 2×1 | integrated (batch B) |
| B4 | bulk | Watertight bulkhead | structure | 1×2 | integrated (batch B) |
| B5 | marine | Marine diesel | mobility | 4×3 | integrated (batch B) |
| B6 | prop | Ship propeller | mobility | 1×2 | integrated (batch A) |
| B7 | thrust | Manoeuvre thruster | mobility | 1×1 | integrated (batch B) |
| B8 | ngun | Naval gun 120 mm, twin | weapon | 4×3 | integrated (batch B) |
| B9 | fuel_l | Fuel tank 1000 L | logistics | 2×2 | integrated (batch B) |
| B10 | sonar | Sonar | system | 2×1 | integrated (batch B) |
| B11 | dc | Depth-charge rack | weapon | 2×1 | integrated (batch B) |
| B12 | torp | Torpedo tube | weapon | 3×1 | integrated (batch B) |
| B13 | phull | Pressure hull section | structure | 2×2 | integrated (batch B) |
| B14 | ballast | Ballast tank | mobility | 2×2 | integrated (batch B) |
| B15 | emotor | Electric motor + batteries | mobility | 2×2 | integrated (batch B) |

## Batch C: aircraft and helicopters (art for existing parts)

| # | id | Name | Folder | Cells | Status |
|---|---|---|---|---|---|
| C1 | wing | Wing section | structure | 2×1 | todo |
| C2 | tail | Tail unit | structure | 2×2 | todo |
| C3 | aero | Aero piston engine | mobility | 2×1 | todo |
| C4 | jet | Jet engine | mobility | 3×1 | todo |
| C5 | turb | Gas turbine | mobility | 3×2 | todo |
| C6 | aprop | Air propeller | mobility | 1×2 | integrated (batch A) |
| C7 | rotor | Rotor | mobility | 4×1 | todo |
| C8 | trotor | Tail rotor | mobility | 1×1 | todo |
| C9 | ac20 | Autocannon 20 mm | weapon | 2×1 | todo |
| C10 | aa40 | AA gun 40 mm | weapon | 3×2 | todo |
| C11 | bomb | Bomb rack | weapon | 2×1 | todo |

## Batch D: new tier 0 parts (JSON + art; roadmap step 2.8)

| # | id | Name | Folder | Cells | Status |
|---|---|---|---|---|---|
| D1 | steam | Steam engine | mobility | 3×2 | integrated (batch A; batch D copy identical) |
| D2 | wheel_w | Spoked wheel | mobility | 2×2 | integrated (batch A) |
| D3 | swivel | Swivel gun 20 mm | weapon | 1×1 | integrated (batch A; longer barrel from batch D) |
| D4 | whull | Wooden hull section | structure | 2×2 | integrated (batch D) |
| D5 | wbow | Wooden bow section | structure | 2×2 | integrated (batch D) |
| D6 | (looks) | Check the auto-tile looks of `plank` and `ironwood` in materials.json, and tune them if needed | — | — | todo |
| D7 | bridge | Command bridge | structure | 2×2 | integrated (batch A, extra) |
| D8 | cabin | Crew cabin | structure | 2×1 | integrated (batch A, extra) |

## Batch E: airships (roadmap step 2.7)

| # | id | What | Status |
|---|---|---|---|
| E1 | lifteng | Lift engine (JSON + art) | integrated (batch E; art only, the repo's stats and metropolis crafting kept) |
| E2 | canvas_bag, rigid_env | Envelope looks (materials.json `look`; kind `envelope`) | delivered (batch E); not taken: the zip's materials.json marked both `planned` and made the canvas unpaintable, so the repo's looks stay |
| E3 | Airship templates | `gunship_t0` (canvas bags, steam, aprop, swivel), `gunship_t2` (rigid envelope, lift engines, c37) | integrated (batch E) |

## Batch F: faction starting designs (`src/vehicles/`, tier 0 parts only)

Make these once batch D exists. Every faction needs:
- 3 tanks (the flagship and 2 captains' tanks; they may share one design)
- 3 corvettes
- 3 gunships (airships)

Start with the League and the Directorate, then the others.

| # | id pattern | Status |
|---|---|---|
| F1 | league_tank_t0, league_corvette_t0, league_gunship_t0 | integrated (batch F1–F2); the League's starting fleets use them |
| F2 | directorate_tank_t0, directorate_corvette_t0, directorate_gunship_t0 | integrated (batch F1–F2); the Directorate's starting fleets use them |
| F3 | skyreach_…, clans_…, lumen_… | todo |

**Rules:** ordinary but handsome; they pass the checker; air designs have a lift margin of 1.15–1.3, ships float with about 30% freeboard, and tanks don't bog down on plains.

## Batch G: new tier 1–2 parts (JSON + art; 05 §3.3)

c57, mortar, flare, hold, repair, crane, flame, rocket, radar, workshop.

## Batch H: tier 3–4 (JSON + art; 05 §3.4; Part 5 of the roadmap)

- **Missiles:** rack, vls, mag, and the missile parts.
- **Carriers:** hangar_d, hangar_a, dcpu1–3, the drone parts.
- **Other:** fab, clamp, ecm, c203.
- **Energy:** laser, hlaser, plasma, plance, cap, reactor, levitator.

## Batch I: later

- Faction signature parts (09), 2 per faction.
- Wall and keep pieces for sieges.
- Faction standard designs for recruitment (small, medium, large and extra-large, per domain).
- Variants: 2 per family, where they make sense.
