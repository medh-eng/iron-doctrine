# Iron Doctrine: parts catalogue (v2.1)

**What this file is**
- **Source of truth:** once a part exists, its file in `src/parts/` is the source of truth. This catalogue lists what exists and briefs what's still to make.
- **Tables:** §2 is generated from the library files. §3 holds starting values for new parts.
- **Rule:** tune numbers freely, but never show them to the player as ratings.

## Conventions

- **Ids are the game's own short ids** (`c75`, `eng_m`, `track`):
  - a family's standard part: `id = family`
  - a variant: `<family>_<variant>`, e.g. `c75_long`
- **Folders are the game's categories:** `structure`, `mobility`, `weapon`, `system`, `logistics`. v2 adds `lift`, `missile` and `special`.
- **Stat names are the game's own** (07 §7):

  | Stat | Meaning |
  |---|---|
  | `power` | kW; negative = drawn |
  | `fuelUse` | L/h |
  | `rel` | Reliability |
  | `maxLoad`, `cap` | kg, km/h |
  | `contact`, `radius` | Contact area, wheel radius |
  | `pen` | mm at 500 m |
  | `dmg` | Damage per hit |
  | `reload` | Seconds |
  | `rpm` | Automatic weapons |
  | `range` | Metres on the sheet |
  | `spread` | Degrees, 1 sigma: lower is more accurate |
  | `vel` | Muzzle speed on the battlefield, m/s |
  | `cal` | Calibre, mm |
  | `shells` | Rounds carried |
  | `fuel`, `cargo` | Capacities |
  | `sealed` | Watertight share |

  Words and on/off flags go in `behaviour` (e.g. `loco: "track"`, `auto: true`, `secondary: "torpedo"`).
- **Cells:** 0.5 m, width × height.
- **Cost keys:** W wood, M metal, E electronics, S scrap, $ money. Rubber and fuel are no longer costs (the import turned them into metal and wood, 1:1).
- **Tiers:** T0 timber and iron (start), T1 iron and steel, T2 heavy industry, T3 advanced, T4 Precursor.
- **Unlock:** `start`, or a tech node id (08 §11).

## 1. Structure cells (`src/parts/materials.json`, auto-tiled)

| id | Name | T | Mass | HP | Armour | Cost | Notes |
|---|---|---|---|---|---|---|---|
| frame | Light frame | 0 | 60 | 40 | 5 | M1 | In game |
| timber | Timber frame | 0 | 40 | 25 | 3 | W1 | In game; burns |
| plate | Hull plate | 1 | 120 | 60 | 15 | M2 | In game |
| arm20 | Armour 20 mm | 1 | 190 | 80 | 20 | M3 | In game |
| arm40 | Armour 40 mm | 2 | 380 | 120 | 40 | M5 | In game |
| arm80 | Armour 80 mm | 2 | 760 | 180 | 80 | M9 | In game |
| slope40 | Sloped armour 40 mm | 2 | 300 | 110 | 40 | M5 | In game; triangle |
| plank | Plank hull | 0 | 70 | 40 | 8 | W2 | New; burns |
| ironwood | Iron-banded plank | 0 | 110 | 55 | 12 | W2 M1 | New; burns; the starting armour |
| composite | Composite armour | 3 | 330 | 130 | 45 | M4 E1 | New; resists fire, plasma, acid |
| alloy | Light alloy | 3 | 90 | 55 | 14 | M3 E1 | New |
| precursor | Precursor plating | 4 | 260 | 150 | 50 | M4 E3 S6 | Planned: resists laser, EMP |
| canvas_bag | Canvas gas bag | 0 | 12 | 15 | 0 | W1 $8 | Planned (airships): gasLift 1.6 |
| rigid_env | Rigid envelope | 1 | 20 | 35 | 2 | M1 W1 $12 | Planned: gasLift 1.8 |
| armored_env | Armoured envelope | 3 | 45 | 70 | 8 | M2 E1 $20 | Planned: gasLift 1.7 |

`gasLift` is in hundreds of kg per cell (1.6 = 160 kg). It is **not** the game's `lift` stat, which is wing area and makes a design an aircraft.

## 2. Parts already in the game (imported from v1)

The ✔ in the last column means SVG art exists. The rest use the code drawing until art arrives.

| id | Name | Cat. | T | Cells | Mass | HP | Arm. | Key stats | Cost | Unlock | SVG |
|---|---|---|---|---|---|---|---|---|---|---|---|
| crew2 | Crew compartment | structure | 0 | 2×2 | 300 | 80 | 10 | crew 2 | M3 | start |  |
| keel | Keel | structure | 0 | 2×1 | 500 | 120 | 10 | sealed 1 | M3 | start |  |
| turret | Turret ring | structure | 0 | 3×1 | 250 | 90 | 20 | draw 5 | M3 | start |  |
| bow | Bow section | structure | 1 | 2×2 | 450 | 130 | 10 | sealed 0.5 | M3 W1 | hull_iron |  |
| bulk | Watertight bulkhead | structure | 1 | 1×2 | 200 | 100 | 10 | sealed 1 | M2 | hull_iron |  |
| hull | Ship hull section | structure | 1 | 2×2 | 600 | 150 | 10 | sealed 1 | M4 W1 | hull_iron |  |
| phull | Pressure hull section | structure | 2 | 2×2 | 2200 | 220 | 25 | sealed 1 | M8 | submarines |  |
| tail | Tail unit | structure | 2 | 2×2 | 60 | 30 | 2 |  | M1 W1 | aviation |  |
| wing | Wing section | structure | 2 | 2×1 | 90 | 30 | 2 | lift 6 | M1 W1 | aviation |  |
| aprop | Air propeller | mobility | 0 | 1×2 | 80 | 20 | 2 |  | M1 W1 | start |  |
| prop | Ship propeller | mobility | 0 | 1×2 | 300 | 50 | 10 |  | M2 | start |  |
| eng_m | Diesel engine M | mobility | 1 | 3×2 | 1100 | 90 | 5 | power 300 | M7 | prop_diesel |  |
| eng_s | Petrol engine S | mobility | 1 | 2×2 | 450 | 60 | 5 | power 110 | M3 | prop_petrol |  |
| radiator | Radiator | mobility | 1 | 1×1 | 70 | 20 | 2 |  | M1 | prop_petrol |  |
| track | Track segment | mobility | 1 | 2×1 | 450 | 70 | 10 | maxLoad 10000, cap 55 | M4 | prop_diesel |  |
| wheel_l | Off-road wheel | mobility | 1 | 2×2 | 200 | 50 | 5 | maxLoad 5000, cap 75 | M4 | prop_petrol |  |
| wheel_s | Road wheel | mobility | 1 | 1×1 | 80 | 30 | 5 | maxLoad 2000, cap 90 | M2 | prop_petrol |  |
| aero | Aero piston engine | mobility | 2 | 2×1 | 600 | 50 | 5 | power 900 | M6 E1 | aviation |  |
| ballast | Ballast tank | mobility | 2 | 2×2 | 300 | 80 | 10 | ballast 4000, sealed 1 | M3 | submarines |  |
| emotor | Electric motor + batteries | mobility | 2 | 2×2 | 1200 | 70 | 10 | power 200, sealed 1 | M6 E3 | submarines |  |
| eng_h | Diesel engine H | mobility | 2 | 4×2 | 1900 | 120 | 5 | power 520 | M12 | prop_heavy |  |
| marine | Marine diesel | mobility | 2 | 4×3 | 5000 | 200 | 10 | power 1500, sealed 1 | M25 | prop_heavy |  |
| rotor | Rotor | mobility | 2 | 4×1 | 400 | 50 | 2 |  | M4 E1 | rotorcraft |  |
| thrust | Manoeuvre thruster | mobility | 2 | 1×1 | 150 | 30 | 5 | draw 40 | M1 E1 | prop_heavy |  |
| trotor | Tail rotor | mobility | 2 | 1×1 | 60 | 20 | 2 |  | M1 | rotorcraft |  |
| turb | Gas turbine | mobility | 2 | 3×2 | 900 | 80 | 5 | power 750 | M8 E3 | prop_turbine |  |
| jet | Jet engine | mobility | 3 | 3×1 | 900 | 70 | 5 | jet 25000 | M10 E4 | jets |  |
| c37 | Cannon 37 mm | weapon | 0 | 2×1 | 250 | 40 | 10 | pen 50, dmg 45, reload 2.5, range 1500, spread 0.55, shells 40 | M4 | start |  |
| mg | Machine gun | weapon | 0 | 1×1 | 40 | 20 | 5 | pen 8, dmg 6, rpm 600, range 600, spread 1.4 | M1 | start |  |
| smoke | Smoke launcher | weapon | 0 | 1×1 | 30 | 15 | 2 |  | M1 W1 | start |  |
| c75 | Cannon 75 mm | weapon | 1 | 3×1 | 600 | 60 | 10 | pen 90, dmg 95, reload 5, range 2000, spread 0.5, shells 30 | M7 | guns_medium | ✔ |
| hmg | Heavy machine gun | weapon | 1 | 1×1 | 80 | 25 | 5 | pen 20, dmg 11, rpm 450, range 1000, spread 1.2 | M2 | guns_medium |  |
| aa40 | AA gun 40 mm | weapon | 2 | 3×2 | 1800 | 80 | 10 | pen 60, dmg 30, rpm 120, range 3500, spread 0.9 | M10 | guns_heavy |  |
| ac20 | Autocannon 20 mm | weapon | 2 | 2×1 | 150 | 35 | 5 | pen 35, dmg 16, rpm 180, range 1200, spread 1 | M3 | guns_heavy |  |
| bomb | Bomb rack | weapon | 2 | 2×1 | 1100 | 30 | 3 | pen 60, reload 0.5 | M2 | aviation |  |
| c105 | Cannon 105 mm | weapon | 2 | 4×1 | 1300 | 80 | 10 | pen 150, dmg 150, reload 8, range 2500, spread 0.45, shells 20 | M12 | guns_heavy |  |
| dc | Depth-charge rack | weapon | 2 | 2×1 | 300 | 40 | 5 | reload 4 | M2 | sonar |  |
| how | Howitzer 150 mm | weapon | 2 | 4×2 | 2500 | 100 | 10 | pen 40, dmg 180, reload 12, range 8000, spread 0.9, shells 12 | M18 | guns_heavy |  |
| ngun | Naval gun 120 mm, twin | weapon | 2 | 4×3 | 9000 | 200 | 25 | pen 130, dmg 150, reload 6, range 9000, spread 0.45, shells 30 | M40 | guns_heavy |  |
| torp | Torpedo tube | weapon | 2 | 3×1 | 900 | 60 | 10 | reload 30, range 4000 | M8 E1 | submarines |  |
| optics | Optics | system | 0 | 1×1 | 30 | 10 | 2 | spot 1.4 | M1 E1 | start |  |
| fc | Fire-control computer | system | 1 | 1×1 | 60 | 15 | 2 | draw 5, accuracy 1.35 | M1 E5 | fire_control |  |
| radio | Radio | system | 1 | 1×1 | 50 | 15 | 2 | draw 1 | M1 E1 | radio |  |
| nsight | Night sight | system | 2 | 1×1 | 20 | 10 | 2 | draw 3 | M1 E4 | radar |  |
| sonar | Sonar | system | 2 | 2×1 | 300 | 30 | 5 | draw 10, sonar 2000 | M2 E4 | sonar |  |
| stab | Gun stabiliser | system | 2 | 1×1 | 90 | 15 | 2 | draw 8 | M2 E4 | stabiliser |  |
| ammo | Ammo rack | logistics | 0 | 1×1 | 250 | 30 | 3 | shells 20 | M1 | start |  |
| cargo | Cargo bay | logistics | 0 | 2×2 | 200 | 40 | 3 | cargo 2000 | M2 W1 | start |  |
| fuel_s | Fuel tank 200 L | logistics | 0 | 1×1 | 220 | 30 | 3 | fuel 200 | M1 | start |  |
| ammo_p | Protected ammo storage | logistics | 1 | 1×1 | 320 | 50 | 10 | shells 20 | M2 | cargo_2 |  |
| fuel_l | Fuel tank 1000 L | logistics | 1 | 2×2 | 1050 | 60 | 3 | fuel 1000 | M3 | cargo_2 |  |
| fuel_ss | Self-sealing tank 150 L | logistics | 1 | 1×1 | 210 | 40 | 3 | fuel 150 | M3 | cargo_2 |  |

### 2.1 Added in Part 2d (step 2.5d)

Built on the v1 game in Part 2d and brought across in step 2.5d. The mechanics are in `design/v1/05` §7.6b. They use the game's ids, so some differ from the plan in §3: `rpod` is the planned `rocket`, `radar_s` the planned `radar`, and `repair` sits in `logistics` rather than `special`. `ecm` arrives here, earlier than Part 5. `bridge_l` is the bridge layer (`bridge` is the command bridge).

| id | Name | Cat. | T | Cells | Mass | HP | Arm. | Key stats | Cost | Unlock | SVG |
|---|---|---|---|---|---|---|---|---|---|---|---|
| skirt | Spaced skirt | structure | 1 | 1×1 | 90 | 30 | 8 |  | M1 | hull_iron |  |
| gen | Auxiliary generator | mobility | 1 | 2×1 | 250 | 40 | 5 | power 40, heat 8, fuelUse 10 | M2 E1 | prop_petrol |  |
| rpod | Rocket pod | weapon | 2 | 2×1 | 200 | 30 | 5 | pen 70, reload 12, range 1500, rounds 2, salvo 8, vel 110, dmg 50, spread 2.2, cal 70, heDmg 25, heRadius 1.5 | M3 W1 | rockets |  |
| atgm | Guided anti-tank missile | weapon | 3 | 2×1 | 180 | 30 | 5 | pen 200, reload 6, range 2500, rounds 4, vel 45, dmg 160, spread 0, cal 120, burst 60, burstR 1.4 | M4 E4 | missiles |  |
| sam | Surface-to-air missile launcher | weapon | 3 | 2×2 | 600 | 50 | 10 | pen 0, reload 8, range 6000, rounds 2, vel 70, dmg 0, spread 0, cal 90 | M6 E8 | missiles |  |
| cradio | Command radio | system | 1 | 2×1 | 120 | 20 | 2 | power -4, crew -1 | M2 E3 | radio |  |
| radar_s | Search radar | system | 2 | 2×1 | 250 | 20 | 2 | power -25, radarAir 8000, radarGround 3000, lock 0.12 | M3 E6 | radar |  |
| radar_n | Naval radar | system | 2 | 2×2 | 600 | 30 | 3 | power -60, radarAir 15000, radarGround 10000, lock 0.2 | M5 E10 | radar |  |
| ecm | ECM suite | system | 3 | 2×1 | 150 | 20 | 2 | power -30, heat 10 | M2 E8 | ecm |  |
| troop | Troop compartment | logistics | 0 | 2×2 | 250 | 50 | 5 |  | M2 | start |  |
| tank_c | Fuel cargo tank | logistics | 1 | 3×2 | 400 | 60 | 3 | fire 0.5 | M4 | cargo_2 |  |
| repair | Repair workshop | logistics | 1 | 2×2 | 600 | 60 | 5 | repair 10 | M4 E1 | repair_bay |  |
| crane | Recovery winch | logistics | 1 | 2×2 | 900 | 80 | 10 |  | M5 | salvage |  |
| blade | Dozer blade | logistics | 1 | 2×1 | 700 | 90 | 20 |  | M4 | salvage |  |
| bridge_l | Bridge layer | logistics | 1 | 4×1 | 3000 | 120 | 10 |  | M10 | salvage |  |
| ramp | Landing ramp | logistics | 1 | 2×2 | 400 | 60 | 10 |  | M3 | hull_iron |  |

## 3. New parts to add (starting values)

### 3.1 Tier 0 (for the v2 campaign start)

| id | Name | Cat. | Cells | Mass | HP | Arm. | Stats | Cost | Behaviour |
|---|---|---|---|---|---|---|---|---|---|
| steam | Steam engine | mobility | 3×2 | 1400 | 90 | 5 | power 120, heat 30, fuelUse 60, rel 0.985 | W2 M6 | — |
| wheel_w | Spoked wheel | mobility | 2×2 | 160 | 40 | 3 | contact 0.1, maxLoad 3000, cap 35, radius 0.5, rel 0.993 | W2 M1 | loco wheel |
| swivel | Swivel gun 20 mm | weapon | 1×1 | 60 | 20 | 3 | pen 12, dmg 18, reload 1.2, range 700, vel 200, spread 1.0, cal 20, shells 40 | W1 M1 | — |
| whull | Wooden hull section | structure | 2×2 | 400 | 110 | 6 | sealed 1 | W4 | floods, burns |
| wbow | Wooden bow section | structure | 2×2 | 300 | 95 | 6 | sealed 0.5 | W3 | floods, bowShape, burns |
| bridge | Command bridge | structure | 2×2 | 350 | 90 | 10 | crew 3, rel 0.998 | W3 M1 | — |
| cabin | Crew cabin | structure | 2×1 | 180 | 50 | 6 | crew 2, rel 0.998 | W2 | — |

### 3.2 Airships (step 2.7)

| id | Name | Cat. | T | Cells | Mass | HP | Stats | Cost | Unlock |
|---|---|---|---|---|---|---|---|---|---|
| lifteng | Lift engine | lift | 2 | 2×2 | 700 | 70 | liftForce 44000 (N), fuelUse 120, heat 30, rel 0.985 | M6 E1 $90 | lift_engines |
| levitator | Levitator | lift | 4 | 2×2 | 400 | 80 | liftForce 78000, power −250, heat 40, rel 0.98 | M6 E10 S12 $500 | lift_levitator |

Envelopes are the planned materials in §1.

**Airship physics** (reusing the v1 helicopter model):
1. **Lift** = Σ envelope `gasLift` × 100 kg × g, plus lift engines' `liftForce`.
2. **Moving:** ◀ ▶ move via air propellers (`aprop`); ▲ ▼ trim height.
3. **Losing lift:** a destroyed envelope cell loses its lift, and canvas burns.
4. **Falling:** below a lift margin of 1.0 the airship sinks, and it crashes the way a helicopter does.

### 3.3 Tier 1–2

| id | Name | Cat. | T | Cells | Mass | HP | Stats | Cost | Unlock |
|---|---|---|---|---|---|---|---|---|---|
| c57 | Cannon 57 mm | weapon | 1 | 2×1 | 380 | 50 | pen 70, dmg 70, reload 3.5, range 1800, vel 172, spread 0.52, cal 57, shells 34 | M5 $40 | guns_medium |
| mortar | Mortar | weapon | 1 | 2×1 | 300 | 40 | pen 20, reload 6, range 2500, vel 90, spread 1.5, heDmg 90, heRadius 4; behaviour he, indirect | M4 $30 | guns_medium |
| flare | Flare launcher | system | 1 | 1×1 | 40 | 15 | salvos 3, decoy 0.7 | M1 $12 | flares |
| hold | Steel cargo hold | logistics | 1 | 3×3 | 500 | 90 | cargo 5000 | M5 $35 | cargo_2 |
| repair | Repair bay | special | 1 | 2×2 | 600 | 60 | rate 8 (HP/s), power −5 | W1 M4 $40 | repair_bay |
| crane | Salvage crane | special | 1 | 2×2 | 900 | 80 | effect 0.06, capacity 30 | M5 $40 | salvage |
| flame | Flamethrower | weapon | 2 | 2×1 | 220 | 40 | dmg 30 (per second), range 60, spread 2; burns 0.05 fuel/s; behaviour fire | M2 $30 | flame |
| rocket | Rocket pod | weapon | 2 | 2×1 | 200 | 30 | pen 70, dmg 80, reload 20, range 1500, spread 2.0, rounds 8; behaviour salvo | M3 $30 | rockets |
| radar | Search radar | system | 2 | 2×1 | 250 | 20 | range 8000, power −25 | M3 E4 $80 | radar |
| workshop | Mobile workshop | special | 2 | 3×2 | 1500 | 90 | effect 1, rate 1 | M8 E2 $120 | workshop |

### 3.4 Tier 3–4 (missiles, carriers, energy; Part 5 of the v2 roadmap)

| id | Name | Cat. | T | Cells | Key stats | Cost | Unlock |
|---|---|---|---|---|---|---|---|
| rack | Missile rack | weapon | 3 | 2×1 | capacity 4 small, reload 3 | M3 E1 $40 | missiles |
| vls | VLS block | weapon | 3 | 2×2 | capacity 8, reload 1.5 | M8 E2 $120 | missiles |
| mag | Missile magazine | logistics | 3 | 2×1 | capacity 4 medium, detonate 0.3 | M3 $40 | missiles |
| hangar_d | Drone hangar | special | 3 | 3×2 | capacity 4, rate 0.33, power −10 | M6 E2 $140 | drones |
| hangar_a | Aircraft hangar | special | 3 | 6×3 | capacity 2 aircraft, rate 0.1, power −20 | M16 E3 $300 | carriers |
| dcpu1 / dcpu2 / dcpu3 | Drone computer I / II / III | system | 3 / 3 / 4 | 1×1 / 2×1 / 2×1 | effect 2 / 4 / 6 drones, power −15 / −30 / −45 | E6 / E12 / E18 S10 | drones / drones_2 / drones_3 |
| fab | Fabricator | special | 3 | 2×2 | rate 0.02 units/s, power −60, heat 15 | M6 E6 $220 | fabricators |
| clamp | Release clamp | special | 3 | 1×1 | capacity 2 t | M2 E1 $40 | detachment |
| ecm | ECM suite | system | 3 | 2×1 | effect 0.4, power −30, heat 10 | M2 E6 $150 | ecm |
| c203 | Heavy gun 203 mm | weapon | 3 | 6×2 | pen 260, dmg 420, reload 14, range 9000, vel 140, spread 0.45, cal 203 | M45 E2 $400 | guns_super |
| laser | Pulse laser | weapon | 4 | 2×1 | pen 60, dmg 40, reload 1.2, range 2500, spread 0.2, power −120, heat 18; behaviour beam | M3 E6 S6 $220 | lasers |
| hlaser | Heavy laser | weapon | 4 | 4×1 | pen 140, dmg 120, reload 3, range 4000, spread 0.2, power −400, heat 45; behaviour beam | M8 E14 S12 $520 | energy_heavy |
| plasma | Plasma cannon | weapon | 4 | 3×2 | pen 180, dmg 260, reload 5, range 1800, vel 110, spread 0.8, power −300, heat 60 | M10 E12 S14 $560 | plasma |
| plance | Plasma lance | weapon | 4 | 5×2 | pen 320, dmg 520, reload 9, range 1400, vel 120, spread 0.6, power −700, heat 110 | M18 E22 S25 $1100 | energy_heavy |
| cap | Capacitor bank | system | 4 | 2×1 | effect 30 (MJ), heat 5 | M3 E8 S8 $200 | lasers |
| reactor | Precursor reactor | mobility | 4 | 3×3 | power 1600, heat 90, fuelUse 0, rel 0.975 | M10 E12 S20 $600 | prop_reactor |

**Missile parts** (category `missile`, on the missile grids):

| id | Stats |
|---|---|
| mw_he | dmg 120 |
| mw_napalm | dmg 60, fire area |
| mw_acid | dmg 50, corrodes armour |
| mw_emp | dmg 20, electronics off 5 s |
| mw_cluster | carries 4 small missiles |
| mmotor | speed 250 |
| mfuel | range +1500 |
| mfins | turn 1 |
| mseek_radar | turn 3 |
| mseek_heat | turn 3.5 |
| mseek_laser | turn 4 |

**Drone parts** (domain `drone`):

| id | Stats |
|---|---|
| dcore | The drone core (every drone needs one) |
| drotor | liftForce 1500 |
| dgun | pen 12, dmg 8 |
| dcharge | dmg 150, destroys the drone on impact |
| dcam | spot 1.5 |
| dlaser | pen 30, dmg 18, power −30 |

## 4. Physics and formulas

- **Already built:** these are implemented as specified in `design/v1/05_PARTS_CATALOGUE.md` §6–7:
  - terrain physics
  - ground movement
  - stability
  - ships, aircraft, reliability, heat, cost
- **New in v2:** airships (§3.2), damage types, and material resistances (`resist` in materials.json: fire, plasma, acid, laser, EMP).
