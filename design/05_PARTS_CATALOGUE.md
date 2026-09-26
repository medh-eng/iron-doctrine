# Iron Doctrine: parts catalogue (v2)

This file gives **starting values for the family base parts** ("std" variants). Variants and upgrades follow the balance rules in 08. The files in `src/parts/` are the source of truth once a part exists; this catalogue is the brief the Art Foundry works from. Tune numbers freely, but never show them to the player as ratings.

## Conventions

- **Cells:** 0.5 m. Sizes are written width × height.
- **Units:**
  - mass in kg, armour in mm
  - `power` in kW produced; `draw` in kW consumed
  - `fuel` in L/h at full load
  - `lift` in hundreds of kg supported (16 = 1.6 t)
  - `thrust` in kN
- **Cost keys:** W wood, M metal, E electronics, S scrap, $ money (the crafting fee).
- **Tiers:** T0 timber and iron (start), T1 iron and steel, T2 heavy industry, T3 advanced, T4 Precursor.
- **Unlock:** `start`, or the tech node id from 08 §11.
- **Id prefix by category folder:**

  | Category | Prefix |
  |---|---|
  | mobility | `mob_` |
  | lift | `lift_` |
  | weapon | `wpn_` |
  | missile | `mis_` |
  | system | `sys_` |
  | logistics | `log_` |
  | crew | `crw_` |
  | special | `spc_` |

## 1. Structure materials (auto-tiled cells, `src/parts/materials.json`)

| id | Name | T | Mass | HP | Armour | Cost | Notes |
|---|---|---|---|---|---|---|---|
| timber | Timber frame | 0 | 40 | 25 | 3 | W1 | Burns |
| plank | Plank hull | 0 | 70 | 40 | 8 | W2 | Burns; paintable |
| ironwood | Iron-banded plank | 0 | 110 | 55 | 12 | W2 M1 | Burns; the starting armour |
| wood_hull | Wooden ship hull | 0 | 90 | 50 | 8 | W3 | Gives buoyancy |
| canvas_bag | Canvas gas bag | 0 | 12 | 15 | 0 | W1 $8 | Lift 1.6; burns |
| iron_frame | Iron frame | 1 | 60 | 40 | 5 | M1 | |
| steel_plate | Steel hull plate | 1 | 120 | 60 | 15 | M2 | |
| arm20 | Armour 20 mm | 1 | 190 | 80 | 20 | M3 | |
| steel_hull | Steel ship hull | 1 | 150 | 70 | 12 | M3 | Gives buoyancy |
| rigid_env | Rigid envelope | 1 | 20 | 35 | 2 | M1 W1 $12 | Lift 1.8 |
| arm40 | Armour 40 mm | 2 | 380 | 120 | 40 | M5 | |
| arm80 | Armour 80 mm | 2 | 760 | 180 | 80 | M9 | |
| slope40 | Sloped armour 40 mm | 2 | 300 | 110 | 40 | M5 | Triangle cell, ×1.41 effective vs level shots |
| bulkhead | Watertight bulkhead | 2 | 200 | 100 | 10 | M2 | Stops flooding spreading |
| composite | Composite armour | 3 | 330 | 130 | 45 | M4 E1 | Resists fire 0.5, plasma 0.6, acid 0.7 |
| alloy | Light alloy | 3 | 90 | 55 | 14 | M3 E1 | |
| armored_env | Armoured envelope | 3 | 45 | 70 | 8 | M2 E1 $20 | Lift 1.7 |
| precursor | Precursor plating | 4 | 260 | 150 | 50 | M4 E3 S6 | Resists laser 0.5, EMP 0.5; can't be painted |

`resist` values multiply the damage taken of that type (0.5 = half).

## 2. Classes

See 01 §5 and `src/parts/classes.json`. They set grid size, part limit and captain level.

## 3. Crew (`crw_`)

Every ship needs exactly one **bridge**, which holds the captain.

| id | Name | T | Cells | Mass | HP | Armour | Stats | Cost | Unlock |
|---|---|---|---|---|---|---|---|---|---|
| crw_bridge_std | Command bridge | 0 | 2×2 | 350 | 90 | 10 | crewSlots 3 | W3 M1 $20 | start |
| crw_cabin_std | Crew cabin | 0 | 2×1 | 180 | 50 | 6 | crewSlots 2 | W2 $10 | start |

**Crew rules:** 1 crew per engine, 1 per gun (2 for guns 105 mm and up), and 1 per system that draws over 20 kW. If there are too few crew, reloads and repairs slow down.

## 4. Mobility (`mob_`)

| id | Name | T | Cells | Mass | HP | Stats | Rel. | Cost | Unlock |
|---|---|---|---|---|---|---|---|---|---|
| mob_steam_std | Steam engine | 0 | 3×2 | 1400 | 90 | power 120, fuel 60, heat 30 | .985 | W2 M6 $40 | start |
| mob_wheel_wood_std | Spoked wheel | 0 | 2×2 | 160 | 40 | load 3000, speedCap 35, grip .7 | .993 | W2 M1 $6 | start |
| mob_prop_std | Ship screw | 0 | 1×2 | 250 | 50 | thrust 18 | .996 | M3 $10 | start |
| mob_airprop_std | Air propeller | 0 | 1×2 | 90 | 25 | thrust 6 | .995 | W1 M1 $8 | start |
| mob_petrol_std | Petrol engine | 1 | 2×2 | 450 | 60 | power 110, fuel 30, heat 12 | .990 | M3 $30 | prop_petrol |
| mob_wheel_std | Rubber wheel | 1 | 1×1 | 80 | 30 | load 2000, speedCap 90, grip .85 | .995 | M1 $8 | prop_petrol |
| mob_diesel_std | Diesel engine | 1 | 3×2 | 1100 | 90 | power 300, fuel 55, heat 25 | .994 | M7 $60 | prop_diesel |
| mob_track_std | Track segment | 1 | 2×1 | 450 | 70 | load 10000, speedCap 55, grip .9 | .993 | M3 $12 | prop_diesel |
| mob_marine_std | Marine diesel | 2 | 4×3 | 5000 | 200 | power 1500, fuel 300, heat 40 | .995 | M25 $200 | prop_marine |
| mob_turbine_std | Gas turbine | 2 | 3×2 | 900 | 80 | power 750, fuel 220, heat 70 | .980 | M8 E3 $120 | prop_turbine |
| mob_htrack_std | Heavy track | 2 | 2×1 | 700 | 110 | load 18000, speedCap 40, grip .95 | .992 | M5 $18 | prop_turbine |
| mob_reactor_std | Precursor reactor | 4 | 3×3 | 2200 | 150 | power 1600, fuel 0, heat 90 | .975 | M10 E12 S20 $600 | prop_reactor |

**Track rules:** a run needs at least 3 segments; the belt is drawn by code. Each track segment has a contact area of 0.35 m², a heavy track segment 0.5 m².

## 5. Lift (`lift_`)

Envelope cells are structure materials (§1). These are the engines:

| id | Name | T | Cells | Mass | HP | Stats | Cost | Unlock |
|---|---|---|---|---|---|---|---|---|
| lift_engine_std | Lift engine | 2 | 2×2 | 700 | 70 | lift 45, fuel 120 | M6 E1 $90 | lift_engines |
| lift_levitator_std | Levitator | 4 | 2×2 | 400 | 80 | lift 80, draw 250, heat 40 | M6 E10 S12 $500 | lift_levitator |

## 6. Weapons (`wpn_`)

**Column meanings:**
- **Pen.:** mm at 500 m (HEAT and energy don't lose penetration with range).
- **Dmg:** per hit (per second for the flamethrower).
- **Reload:** seconds.

| id | Name | T | Cells | Mass | HP | Pen. | Dmg | Reload | Range | Acc. | Other | Cost | Unlock |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| wpn_mg_std | Machine gun | 0 | 1×1 | 40 | 20 | 8 | 6 | 0.1 | 600 | .60 | Auto-fire | M1 $6 | start |
| wpn_swivel20_std | Swivel gun 20 mm | 0 | 1×1 | 60 | 20 | 12 | 18 | 1.2 | 700 | .60 | | W1 M1 $8 | start |
| wpn_c37_std | Light cannon 37 mm | 0 | 2×1 | 250 | 40 | 50 | 45 | 2.5 | 1500 | .75 | | W1 M3 $25 | start |
| wpn_hmg_std | Heavy machine gun | 1 | 1×1 | 80 | 25 | 20 | 12 | 0.13 | 1000 | .62 | Auto; hits aircraft | M2 $12 | guns_medium |
| wpn_c57_std | Cannon 57 mm | 1 | 2×1 | 380 | 50 | 70 | 75 | 3.5 | 1800 | .78 | | M5 $40 | guns_medium |
| wpn_c75_std | Cannon 75 mm | 1 | 3×1 | 600 | 60 | 90 | 110 | 5 | 2000 | .80 | Barrel overhangs 1.5 cells | M7 $60 | guns_medium |
| wpn_mortar_std | Mortar | 1 | 2×1 | 300 | 40 | 20 | 90 | 6 | 2500 | .50 | Indirect fire | M4 $30 | guns_medium |
| wpn_c105_std | Cannon 105 mm | 2 | 4×1 | 1300 | 80 | 150 | 190 | 8 | 2500 | .80 | Heavy recoil | M12 $110 | guns_heavy |
| wpn_how150_std | Howitzer 150 mm | 2 | 4×2 | 2500 | 100 | 40 | 260 | 12 | 8000 | .55 | Indirect; needs a spotter | M18 $160 | guns_heavy |
| wpn_ac20_std | Autocannon 20 mm | 2 | 2×1 | 150 | 35 | 35 | 16 | 0.33 | 1200 | .70 | Auto; hits aircraft | M3 $30 | guns_heavy |
| wpn_flak40_std | Flak 40 mm | 2 | 2×2 | 1800 | 80 | 60 | 40 | 0.5 | 3500 | .60 | Air bursts | M10 $80 | guns_heavy |
| wpn_flame_std | Flamethrower | 2 | 2×1 | 220 | 40 | 0 | 30/s | 0 | 60 | .90 | Sets parts on fire; burns 0.05 fuel/s | M2 $30 | flame |
| wpn_rocket_std | Rocket pod | 2 | 2×1 | 200 | 30 | 70 | 80 | 20 | 1500 | .45 | Salvo of 8, unguided | M3 $30 | rockets |
| wpn_c203_std | Heavy gun 203 mm | 3 | 6×2 | 6500 | 180 | 260 | 420 | 14 | 9000 | .82 | L and XL classes only | M45 E2 $400 | guns_super |
| wpn_rack_std | Missile rack | 3 | 2×1 | 250 | 40 | — | per missile | 3 | per missile | — | Holds 4 small | M3 E1 $40 | missiles |
| wpn_vls_std | VLS block | 3 | 2×2 | 800 | 80 | — | per missile | 1.5 | per missile | — | Holds 8 small or medium | M8 E2 $120 | missiles |
| wpn_laser_std | Pulse laser | 4 | 2×1 | 300 | 40 | 60 | 40 | 1.2 | 2500 | .95 | draw 120, heat 18 | M3 E6 S6 $220 | lasers |
| wpn_hlaser_std | Heavy laser | 4 | 4×1 | 1100 | 70 | 140 | 120 | 3 | 4000 | .95 | draw 400, heat 45 | M8 E14 S12 $520 | energy_heavy |
| wpn_plasma_std | Plasma cannon | 4 | 3×2 | 1600 | 90 | 180 | 260 | 5 | 1800 | .70 | draw 300, heat 60, splash | M10 E12 S14 $560 | plasma |
| wpn_plance_std | Plasma lance | 4 | 5×2 | 3200 | 130 | 320 | 520 | 9 | 1400 | .75 | draw 700, heat 110 | M18 E22 S25 $1100 | energy_heavy |

- **Penetration over range (kinetic):** pen × (1 − 0.12 × (r − 500)/500), never below 0.5 × pen.
- **Ricochet** beyond 70°.
- **Recoil impulse** = calibre² × 0.9 N·s.

## 7. Systems (`sys_`)

| id | Name | T | Cells | Mass | HP | Stats | Cost | Unlock |
|---|---|---|---|---|---|---|---|---|
| sys_optics_std | Spyglass and periscope | 0 | 1×1 | 30 | 10 | effect 1.4 (spotting ×) | M1 $6 | start |
| sys_smoke_std | Smoke pots | 0 | 1×1 | 30 | 15 | effect 20 (s of smoke), 3 uses | W1 M1 $6 | start |
| sys_radio_std | Radio | 1 | 1×1 | 50 | 15 | range 3000, draw 1 | M1 E1 $15 | radio |
| sys_firectl_std | Fire control | 1 | 1×1 | 60 | 15 | effect 1.35 (accuracy ×), draw 5 | M1 E2 $30 | fire_control |
| sys_flare_std | Flare launcher | 1 | 1×1 | 40 | 15 | effect 3 (salvos), decoy 0.7 | M1 $12 | flares |
| sys_radar_std | Search radar | 2 | 2×1 | 250 | 20 | range 8000, draw 25 | M3 E4 $80 | radar |
| sys_stab_std | Gun stabiliser | 2 | 1×1 | 90 | 15 | effect 0.6 (moving-fire penalty ×), draw 8 | M2 E2 $50 | stabiliser |
| sys_ecm_std | ECM suite | 3 | 2×1 | 150 | 20 | effect 0.4 (enemy lock −40%), draw 30, heat 10 | M2 E6 $150 | ecm |
| sys_dronecpu_std | Drone computer I | 3 | 1×1 | 80 | 20 | effect 2 (drones at once), range 3000, draw 15 | M1 E6 $150 | drones |
| sys_dronecpu2_std | Drone computer II | 3 | 2×1 | 140 | 25 | effect 4, range 4500, draw 30 | M2 E12 $320 | drones_2 |
| sys_dronecpu3_std | Drone computer III | 4 | 2×1 | 160 | 30 | effect 6, range 6000, draw 45 | M2 E18 S10 $520 | drones_3 |
| sys_capacitor_std | Capacitor bank | 4 | 2×1 | 400 | 40 | effect 30 (MJ buffer), heat 5 | M3 E8 S8 $200 | lasers |

## 8. Logistics (`log_`)

Capacity is in units: fuel 100 L, ammo 100 kg, cargo 100 kg.

| id | Name | T | Cells | Mass | HP | Stats | Cost | Unlock |
|---|---|---|---|---|---|---|---|---|
| log_fuel_std | Fuel barrels | 0 | 1×1 | 60 | 30 | capacity 2, fireChance .35 | W1 M1 $5 | start |
| log_ammo_std | Ammo crates | 0 | 1×1 | 80 | 30 | capacity 1.5, detChance .4 | W1 M1 $5 | start |
| log_cargo_std | Cargo bed | 0 | 2×2 | 200 | 40 | capacity 20 | W3 M1 $12 | start |
| log_tank_std | Fuel cargo tank | 1 | 3×2 | 400 | 60 | capacity 40, fireChance .5 | M4 $30 | cargo_2 |
| log_hold_std | Steel cargo hold | 1 | 3×3 | 500 | 90 | capacity 50 | M5 $35 | cargo_2 |
| log_magazine_std | Missile magazine | 3 | 2×1 | 300 | 60 | capacity 4 (medium missiles), detChance .3 | M3 $40 | missiles |

## 9. Special (`spc_`)

| id | Name | T | Cells | Mass | HP | Stats | Cost | Unlock |
|---|---|---|---|---|---|---|---|---|
| spc_repair_std | Repair bay | 1 | 2×2 | 600 | 60 | rate 8 (HP/s field repair), draw 5 | W1 M4 $40 | repair_bay |
| spc_salvage_std | Salvage crane | 1 | 2×2 | 900 | 80 | effect 0.06 (salvage chance +), capacity 30 (t towed) | M5 $40 | salvage |
| spc_workshop_std | Mobile workshop | 2 | 3×2 | 1500 | 90 | effect 1 (field swaps of small parts), rate 1 | M8 E2 $120 | workshop |
| spc_hangar_std | Drone hangar | 3 | 3×2 | 900 | 90 | capacity 4 (drones), rate 0.33 (launches/s), draw 10 | M6 E2 $140 | drones |
| spc_fab_std | Fabricator | 3 | 2×2 | 800 | 70 | rate 0.02 (units/s built), draw 60, heat 15 | M6 E6 $220 | fabricators |
| spc_clamp_std | Release clamp | 3 | 1×1 | 120 | 60 | capacity 2 (t held) | M2 E1 $40 | detachment |

## 10. Missile parts (`mis_`, domain `missile`)

Missiles are designed on the missile grids (01 §5). A missile needs **one warhead, one motor and fins**; guidance is optional.

| id | Name | T | Cells | Mass | Stats | Cost | Unlock |
|---|---|---|---|---|---|---|---|
| mis_warhead_he | HE warhead | 3 | 1×1 | 60 | damage 120 | M1 $10 | missiles |
| mis_warhead_napalm | Napalm warhead | 3 | 1×1 | 70 | damage 60, fire area 40 m for 8 s | M1 $16 | warheads_special |
| mis_warhead_acid | Acid warhead | 3 | 1×1 | 70 | damage 50, armour −2 mm/s for 10 s | M1 E1 $20 | warheads_special |
| mis_warhead_emp | EMP warhead | 4 | 1×1 | 60 | damage 20, electronics off 5 s | E3 S3 $60 | warheads_emp |
| mis_warhead_cluster | Cluster bus | 4 | 2×1 | 150 | carries 4 small missiles | M2 E1 $40 | warheads_emp |
| mis_motor_std | Solid motor | 3 | 1×1 | 40 | speed 250 | M1 $8 | missiles |
| mis_fuel_std | Fuel section | 3 | 1×1 | 30 | range +1500 | M1 $6 | missiles |
| mis_fins_std | Fins | 3 | 1×1 | 10 | turn 1 | M1 $3 | missiles |
| mis_guide_radar | Radar seeker | 3 | 1×1 | 20 | turn 3; flares weak against it, ECM strong | E2 $30 | missiles |
| mis_guide_heat | Heat seeker | 3 | 1×1 | 20 | turn 3.5; flares strong against it, ECM weak | E2 $30 | missiles |
| mis_guide_laser | Laser rider | 4 | 1×1 | 20 | turn 4; needs line of sight from launcher | E3 $50 | lasers |

## 11. Drone parts (domain `drone`)

Drones are designed on the drone grids (01 §5). They need **a drone core** (a bridge equivalent, below) plus a way to move.

| id | Name | T | Cells | Mass | Stats | Cost | Unlock |
|---|---|---|---|---|---|---|---|
| crw_dcore_std | Drone core | 3 | 1×1 | 30 | links to the drone computer | E2 $20 | drones |
| mob_drotor_std | Drone rotor | 3 | 1×1 | 30 | thrust 1.5 | M1 E1 $15 | drones |
| wpn_dgun_std | Drone gun | 3 | 1×1 | 25 | pen 12, dmg 8, reload 0.15, range 600 | M1 $10 | drones |
| wpn_dcharge_std | Drone charge | 3 | 1×1 | 40 | damage 150, destroys the drone on impact | M1 $15 | drones |
| sys_dcam_std | Drone camera | 3 | 1×1 | 10 | effect 1.5 (spotting) | E1 $15 | drones |
| wpn_dlaser_std | Drone laser | 4 | 1×1 | 40 | pen 30, dmg 18, reload 1, draw 30 | E3 S2 $60 | lasers |

## 12. Terrain physics (battle)

| Terrain | Softness | Grip μ | Concealment | Heat × | Notes |
|---|---|---|---|---|---|
| Road | 0 | 0.90 | 0 | 1.0 | |
| Plains | 0.1 | 0.75 | 0.1 | 1.0 | |
| Forest floor | 0.3 | 0.60 | 0.5 | 0.9 | Vehicles taller than 3 m are slowed 20% |
| Sand | 0.5 | 0.50 | 0.1 | 1.3 | |
| Snow and ice | 0.6 | 0.35 | 0.2 | 0.7 | |
| Mud and marsh | 1.0 | 0.40 | 0.1 | 1.0 | |
| Ruins and rubble | 0.2 | 0.65 | 0.6 | 1.0 | |
| Rock and mountain | 0 | 0.80 | 0.3 | 0.9 | |

## 13. Formulas

**Land**

1. **Ground pressure** (kPa) = m g ÷ contact area ÷ 1000.
2. **Pressure factor** = clamp(ground pressure ÷ 100, 0.3, 3).
3. **Rolling resistance coefficient:**
   - wheels: crr = 0.015 + softness × 0.25 × pressure factor
   - tracks: crr = 0.04 + softness × 0.08 × pressure factor
4. **Drive force** = min(P_eff ÷ max(v, 1), μ × load on driven contacts).
   - P_eff = kW × 1000 × efficiency (wheels 0.85, tracks 0.75) × power availability.
5. **Resistance** = crr m g + m g sin(slope) + 0.5 × 1.225 × 0.9 × A × v².
6. **Bogged down:** if resistance at rest on flat ground is greater than the drive force, the vehicle is stuck ("Bogged down").
7. **Tip angle** = atan(half the contact base ÷ centre-of-mass height).

**Sea**

- Beam = length × 0.18, clamped to 2.5–12 m.
- Each hull cell below the waterline displaces 0.25 m² × beam.
- Buoyancy = 1000 g × displaced volume.
- Holed cells below the waterline flood at 0.5 t/s, spreading until a bulkhead stops it.

**Air**

- Total lift = Σ (envelope cell lift + lift engine lift) × 100 kg.
- **Lift margin** = lift ÷ mass:
  - below 1.0: the airship sinks
  - 1.0–1.15: sluggish climb
  - above 1.3: agile
- A destroyed envelope cell loses its lift. Fire spreads between canvas cells.
- Thrust from propellers gives speed against drag (0.5 × 1.225 × 1.1 × frontal area × v²).

**Power, heat and reliability**

- **Power budget:** power produced vs draw. When draw is greater, energy weapons charge slower and systems cut out in the order radar, ECM, fabricator.
- **Heat balance:** heat produced × terrain factor − 2 per engine − radiators (T1 part, later). Overheating cuts power and weapon rate of fire; above 100% for 20 s, fires can start.
- **Breakdowns** per operating hour = Σ(1 − reliability) × 0.5 × wear factor (1 + (1 − condition)).
