# Iron Doctrine: part roster (production order)

- **Order:** the Art Foundry makes parts in this order, one per chat or a few per chat.
- **Stats:** base values come from 05. Variants follow 08 §3.
- **Tracking:** the repo updates the status column when a foundry zip is integrated (CLAUDE.md).
- **Status values:** `todo`, `in progress`, `delivered` (zip made), `integrated` (in the repo), `done` (verified in game).

**Code needs the parts in this order:**
1. Part 1b (land and air battles) needs **batch A** plus the batch F starting designs.
2. Part 1c (sea, designer) needs the rest of A and F.
3. Later parts need B–E.

## Batch A: tier 0 starting kit

| # | id | Name | Folder | Cells | Status |
|---|---|---|---|---|---|
| A1 | crw_bridge_std | Command bridge | crew | 2×2 | todo |
| A2 | mob_wheel_wood_std | Spoked wheel | mobility | 2×2 | todo |
| A3 | mob_steam_std | Steam engine | mobility | 3×2 | todo |
| A4 | wpn_c37_std | Light cannon 37 mm | weapon | 2×1 | todo |
| A5 | wpn_swivel20_std | Swivel gun 20 mm | weapon | 1×1 | todo |
| A6 | wpn_mg_std | Machine gun | weapon | 1×1 | todo |
| A7 | mob_airprop_std | Air propeller | mobility | 1×2 | todo |
| A8 | mob_prop_std | Ship screw | mobility | 1×2 | todo |
| A9 | log_fuel_std | Fuel barrels | logistics | 1×1 | todo |
| A10 | log_ammo_std | Ammo crates | logistics | 1×1 | todo |
| A11 | log_cargo_std | Cargo bed | logistics | 2×2 | todo |
| A12 | crw_cabin_std | Crew cabin | crew | 2×1 | todo |
| A13 | sys_optics_std | Spyglass and periscope | system | 1×1 | todo |
| A14 | sys_smoke_std | Smoke pots | system | 1×1 | todo |

## Batch F: starting designs (`src/vehicles/`, tier 0 parts only)

Make these as soon as the batch A parts they use exist. Every faction needs 3 tanks, 3 corvettes and 3 gunships. Start with the League and the Directorate, which are the two test factions, then the rest.

| # | id pattern | What | Status |
|---|---|---|---|
| F1 | league_tank_t0_a / _b / _c | Flagship tank + 2 captains' tanks (can share one design) | todo |
| F2 | league_corvette_t0 | Corvette | todo |
| F3 | league_gunship_t0 | Gunship | todo |
| F4 | directorate_tank_t0, _corvette_t0, _gunship_t0 | The same set for the Directorate | todo |
| F5 | skyreach_…, clans_…, lumen_… | The same set for the other factions | todo |

**Rules for starting designs**
- They must be good-looking, but ordinary. They are starting points the player will improve.
- They must pass the checker.
- They must have lift margin 1.15–1.3 (air), float with 30% freeboard (sea), and not bog down on plains (land).

## Batch B: tier 1 (iron and steel)

| # | id | Name | Folder | Status |
|---|---|---|---|---|
| B1 | wpn_c75_std | Cannon 75 mm | weapon | **integrated (golden sample)** |
| B2 | wpn_c57_std | Cannon 57 mm | weapon | todo |
| B3 | wpn_hmg_std | Heavy machine gun | weapon | todo |
| B4 | wpn_mortar_std | Mortar | weapon | todo |
| B5 | mob_petrol_std | Petrol engine | mobility | todo |
| B6 | mob_diesel_std | Diesel engine | mobility | todo |
| B7 | mob_wheel_std | Rubber wheel | mobility | todo |
| B8 | mob_track_std | Track segment (road wheels; belt drawn by code) | mobility | todo |
| B9 | sys_radio_std | Radio | system | todo |
| B10 | sys_firectl_std | Fire control | system | todo |
| B11 | sys_flare_std | Flare launcher | system | todo |
| B12 | log_tank_std | Fuel cargo tank | logistics | todo |
| B13 | log_hold_std | Steel cargo hold | logistics | todo |
| B14 | spc_repair_std | Repair bay | special | todo |
| B15 | spc_salvage_std | Salvage crane | special | todo |
| B16 | variants | c75_long, c37_rapid, steam_hp, diesel_rugged (2 or more pros and cons each) | — | todo |

## Batch C: tier 2 (heavy industry)

| # | id | Status |
|---|---|---|
| C1 | wpn_c105_std | todo |
| C2 | wpn_how150_std | todo |
| C3 | wpn_ac20_std | todo |
| C4 | wpn_flak40_std | todo |
| C5 | wpn_flame_std | todo |
| C6 | wpn_rocket_std | todo |
| C7 | mob_turbine_std | todo |
| C8 | mob_marine_std | todo |
| C9 | mob_htrack_std | todo |
| C10 | lift_engine_std | todo |
| C11 | sys_radar_std | todo |
| C12 | sys_stab_std | todo |
| C13 | spc_workshop_std | todo |

## Batch D: tier 3 (missiles, drones, advanced)

| # | id | Status |
|---|---|---|
| D1 | wpn_rack_std | todo |
| D2 | wpn_vls_std | todo |
| D3 | log_magazine_std | todo |
| D4 | mis_warhead_he, mis_motor_std, mis_fuel_std, mis_fins_std | todo |
| D5 | mis_guide_radar, mis_guide_heat | todo |
| D6 | mis_warhead_napalm, mis_warhead_acid | todo |
| D7 | spc_hangar_std | todo |
| D8 | sys_dronecpu_std, sys_dronecpu2_std | todo |
| D9 | crw_dcore_std, mob_drotor_std, wpn_dgun_std, wpn_dcharge_std, sys_dcam_std | todo |
| D10 | spc_fab_std | todo |
| D11 | spc_clamp_std | todo |
| D12 | sys_ecm_std | todo |
| D13 | wpn_c203_std | todo |
| D14 | Example designs: missile_s HE, missile_m radar, drone_1 gun drone, drone_1 charge drone | todo |

## Batch E: tier 4 (Precursor and energy)

| # | id | Status |
|---|---|---|
| E1 | wpn_laser_std | todo |
| E2 | sys_capacitor_std | todo |
| E3 | wpn_plasma_std | todo |
| E4 | wpn_hlaser_std | todo |
| E5 | wpn_plance_std | todo |
| E6 | mob_reactor_std | todo |
| E7 | lift_levitator_std | todo |
| E8 | mis_warhead_emp, mis_warhead_cluster, mis_guide_laser | todo |
| E9 | sys_dronecpu3_std | todo |
| E10 | wpn_dlaser_std | todo |

## Batch G: later

| # | What | Status |
|---|---|---|
| G1 | Faction signature parts (09), 2 per faction | todo |
| G2 | Wall and keep pieces for sieges (as materials and parts: wall_stone, wall_steel, gatehouse, keep) | todo |
| G3 | Tier 1–4 faction standard designs for recruitment (each faction: small, medium, large, extra-large, per domain) | todo |
| G4 | More variants: 2 per family, where they make sense | todo |
