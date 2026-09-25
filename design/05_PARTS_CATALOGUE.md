# Iron Doctrine: parts catalogue and physics numbers

These are starting values. Tune them freely for feel and balance, but never show them to the player as ratings: only as raw numbers.

## Conventions

- **Cells:** 0.5 m. Sizes are written width × height.
- **Units:** mass in kg, armour in mm.
- **Power:** + means produced, − means drawn (kW).
- **Heat:** + means produced, − means removed (units per second).
- **Fuel:** litres per hour at full load.
- **Cost codes:** M = metal, W = wood, F = fuel, E = electronics, R = rubber.
- **Rel.** = reliability per operating hour. Parts without a Rel. column use 0.998.
- **P1 / P2:** the part is first available in Part 1 or Part 2.

## 1. Structure

| id | Name | Cells | Mass | HP | Armour | Cost | Notes | Part |
|---|---|---|---|---|---|---|---|---|
| frame | Light frame | 1×1 | 60 | 40 | 5 | M1 | Connector | P1 |
| timber | Timber frame | 1×1 | 40 | 25 | 3 | W1 | Cheap; can burn | P1 |
| plate | Hull plate | 1×1 | 120 | 60 | 15 | M2 | | P1 |
| arm20 | Armour 20 mm | 1×1 | 190 | 80 | 20 | M3 | | P1 |
| arm40 | Armour 40 mm | 1×1 | 380 | 120 | 40 | M5 | | P1 |
| arm80 | Armour 80 mm | 1×1 | 760 | 180 | 80 | M9 | | P1 |
| slope40 | Sloped armour 40 mm | 1×1 | 300 | 110 | 40 | M5 | Triangle cell at 45°; ×1.41 effective vs level shots | P1 |
| skirt | Spaced skirt | 1×1 | 90 | 30 | 8 | M1 | Halves HEAT and rocket penetration behind it | P2 |
| crew2 | Crew compartment | 2×2 | 300 | 80 | 10 | M3 | 2 crew slots | P1 |
| turret | Turret ring | 3×1 | 250 | 90 | 20 | M3 | Needed for turrets; −5 kW traverse | P1 |
| hull | Ship hull section | 2×2 | 600 | 150 | 10 | M4 W1 | Buoyancy below the waterline | P2 |
| keel | Keel | 2×1 | 500 | 120 | 10 | M3 | Lowers centre of mass; ships need one | P2 |
| bulk | Watertight bulkhead | 1×2 | 200 | 100 | 10 | M2 | Stops flooding spreading | P2 |
| wing | Wing section | 2×1 | 90 | 30 | 2 | M1 W1 | Lift area 6 m² | P2 |
| tail | Tail unit | 2×2 | 60 | 30 | 2 | M1 W1 | Pitch stability; aircraft need one | P2 |

**Crew rules**
- Every vehicle needs 1 driver, plus 1 gunner per main weapon.
- Guns of 75 mm and up need a loader, otherwise reload takes ×1.6 as long.
- A commander is optional: +15% spotting.
- A command radio needs a radio operator.

## 2. Mobility

| id | Name | Cells | Mass | HP | Power | Heat | Fuel | Rel. | Cost | Notes | Part |
|---|---|---|---|---|---|---|---|---|---|---|---|
| eng_s | Petrol engine S | 2×2 | 450 | 60 | +110 | 12 | 30 | 0.990 | M3 | | P1 |
| eng_m | Diesel engine M | 3×2 | 1100 | 90 | +300 | 25 | 55 | 0.994 | M7 | | P1 |
| eng_h | Diesel engine H | 4×2 | 1900 | 120 | +520 | 45 | 95 | 0.992 | M12 | | P1 |
| turb | Gas turbine | 3×2 | 900 | 80 | +750 | 70 | 220 | 0.980 | M8 E3 | | P2 |
| marine | Marine diesel | 4×3 | 5000 | 200 | +1500 | 80 | 300 | 0.995 | M25 | Sea-cooled: heat −50% | P2 |
| aero | Aero piston engine | 2×1 | 600 | 50 | +900 | 40 | 250 | 0.985 | M6 E1 | Aircraft only | P2 |
| jet | Jet engine | 3×1 | 900 | 70 | 25 kN thrust | 60 | 900 | 0.970 | M10 E4 | | P2 |
| emotor | Electric motor + batteries | 2×2 | 1200 | 70 | +200 | 5 | 0 | 0.996 | M6 E3 | Submerged drive; 2 h battery | P2 |
| gen | Auxiliary generator | 2×1 | 250 | 40 | +40 | 8 | 10 | 0.990 | M2 E1 | Electrical power only | P2 |
| radiator | Radiator | 1×1 | 70 | 20 | | −12 | | | M1 | Fragile | P1 |
| wheel_s | Road wheel | 1×1 | 80 | 30 | | | | 0.995 | M1 R1 | Contact 0.04 m²; max load 2 t; cap 90 km/h | P1 |
| wheel_l | Off-road wheel | 2×2 | 200 | 50 | | | | 0.995 | M1 R3 | Contact 0.12 m²; max load 5 t; cap 75 km/h | P1 |
| track | Track segment | 2×1 | 450 | 70 | | | | 0.993 | M3 R1 | Needs a run of 3+ segments; contact 0.35 m² and max load 10 t per segment; cap 55 km/h | P1 |
| prop | Ship propeller | 1×2 | 300 | 50 | | | | | M2 | At the stern, below the waterline | P2 |
| aprop | Air propeller | 1×2 | 80 | 20 | | | | | M1 W1 | | P2 |
| rotor | Rotor | 4×1 | 400 | 50 | Uses engine power | | | 0.985 | M4 E1 | Needs a tail rotor | P2 |
| trotor | Tail rotor | 1×1 | 60 | 20 | | | | | M1 | | P2 |
| ballast | Ballast tank | 2×2 | 300 | 80 | | | | | M3 | ±4 t buoyancy | P2 |
| thrust | Manoeuvre thruster | 1×1 | 150 | 30 | −40 | 5 | | | M1 E1 | Quicker stops and turns (ships); hover trim | P2 |

## 3. Weapons

- **Pen.** = penetration in mm at 500 m.
- **Reload** is seconds per shot, or rounds per minute for automatic weapons.

| id | Name | Cells | Mass | HP | Pen. | Reload | Range m | Cost | Notes | Part |
|---|---|---|---|---|---|---|---|---|---|---|
| mg | Machine gun | 1×1 | 40 | 20 | 8 | 600/min | 600 | M1 | Fires automatically at soft targets | P1 |
| hmg | Heavy machine gun | 1×1 | 80 | 25 | 20 | 450/min | 1000 | M2 | Automatic; can hit aircraft | P1 |
| ac20 | Autocannon 20 mm | 2×1 | 150 | 35 | 35 | 180/min | 1200 | M3 | Automatic; can hit aircraft | P2 |
| c37 | Cannon 37 mm | 2×1 | 250 | 40 | 50 | 2.5 s | 1500 | M4 | | P1 |
| c75 | Cannon 75 mm | 3×1 | 600 | 60 | 90 | 5 s | 2000 | M7 | Good high-explosive shell; moderate recoil | P1 |
| c105 | Cannon 105 mm | 4×1 | 1300 | 80 | 150 | 8 s | 2500 | M12 | Heavy recoil: light vehicles rock or tip | P1 |
| how | Howitzer 150 mm | 4×2 | 2500 | 100 | 40 (HE) | 12 s | 8000 | M18 | Indirect fire; needs a spotter; big splash | P1 |
| ngun | Naval gun 120 mm, twin | 4×3 | 9000 | 200 | 130 | 6 s | 9000 | M40 | | P2 |
| rpod | Rocket pod | 2×1 | 200 | 30 | 70 (HEAT) | salvo of 8 | 1500 | M3 F1 | Unguided | P2 |
| atgm | Guided anti-tank missile | 2×1 | 180 | 30 | 200 (HEAT) | 6 s | 2500 | M4 E4 | Needs fire control; 4 missiles | P2 |
| sam | Surface-to-air missile launcher | 2×2 | 600 | 50 | n/a | 8 s | 6000 | M6 E8 | Needs radar; 2 missiles | P2 |
| torp | Torpedo tube | 3×1 | 900 | 60 | Hull-breaker | 30 s | 4000 | M8 E1 | 2 torpedoes; hits below the waterline flood | P2 |
| bomb | Bomb rack | 2×1 | 100 (+1000 loaded) | 30 | 60 (HE) | Drop | n/a | M2 | Aircraft only; 4 × 250 kg bombs | P2 |
| dc | Depth-charge rack | 2×1 | 300 | 40 | n/a | 4 s | Stern drop | M2 | Against submarines | P2 |
| aa40 | AA gun 40 mm | 3×2 | 1800 | 80 | 60 | 120/min | 3500 | M10 | Flak bursts | P2 |
| smoke | Smoke launcher | 1×1 | 30 | 15 | n/a | 3 salvos | 60 | M1 F1 | Blocks spotting for 20 s | P1 |

**Battle distance scale:** battles compress distance so fights happen on screen. 1 km on this sheet is 50 m on the battlefield (`BATTLE_DISTANCE_SCALE` = 0.05): a 75 mm gun reaches 100 m, a machine gun 30 m. Penetration fall-off uses the sheet distance (battlefield distance ÷ 0.05).

**Battle numbers per weapon** (in `07_data.js`): muzzle speed on the battlefield, damage per hit, aiming spread, and a small bursting charge that damages the parts around the first penetration (37 mm: 25 within 1 m; 75 mm: 55 within 1.6 m; 105 mm: 80 within 2 m).

**Howitzer arc:** elevation −5° to 80°. It lobs (high arc) when that fits under 80°, otherwise it fires the flat arc, so it can also shoot directly at close range. (Until v0.1.4 the arc stopped at 72°, which is below every lob inside the gun's 400 m battle range, so howitzers never fired.)

**Penetration over range**
- Cannons: pen(r) = pen500 × (1 − 0.12 × (r − 500) / 500), never below 0.5 × pen500.
- HEAT: no loss with range.
- Machine guns: −25% per 500 m.
- Effective armour = thickness ÷ cos(impact angle). Beyond 70° the shot ricochets.

**Recoil**
- Each shot applies an impulse at the barrel base.
- Recoil impulse = calibre² × 0.9 N·s (37 mm ≈ 1.2 kN·s; 105 mm ≈ 9.9 kN·s).

## 4. Systems

| id | Name | Cells | Mass | HP | Power | Cost | Effect | Part |
|---|---|---|---|---|---|---|---|---|
| radio | Radio | 1×1 | 50 | 15 | −1 | M1 E1 | Receives squad orders beyond 300 m or out of sight | P1 |
| cradio | Command radio | 2×1 | 120 | 20 | −4 | M2 E3 | +1 platoon under force orders; needs a radio operator | P2 |
| optics | Optics / periscope | 1×1 | 30 | 10 | 0 | M1 E1 | Spotting +40% | P1 |
| fc | Fire-control computer | 1×1 | 60 | 15 | −5 | M1 E5 | Cannon accuracy ×1.35; required for guided missiles | P1 |
| stab | Gun stabiliser | 1×1 | 90 | 15 | −8 | M2 E4 | Penalty for firing on the move −60% | P1 |
| nsight | Night sight | 1×1 | 20 | 10 | −3 | M1 E4 | Night spotting at 70% of daytime | P1 |
| radar_s | Search radar | 2×1 | 250 | 20 | −25 | M3 E6 | Air 8 km, ground 3 km (not through forest) | P2 |
| radar_n | Naval radar | 2×2 | 600 | 30 | −60 | M5 E10 | Air 15 km, surface 10 km | P2 |
| sonar | Sonar | 2×1 | 300 | 30 | −10 | M2 E4 | Detects submarines within 2 km | P2 |
| ecm | ECM suite | 2×1 | 150 | 20 | −30 (heat +10) | M2 E8 | Enemy missile lock −40%; enemy radar range against you −30% | P2 |

## 5. Logistics

| id | Name | Cells | Mass | HP | Cost | Effect | Part |
|---|---|---|---|---|---|---|---|
| fuel_s | Fuel tank 200 L | 1×1 | 60 (+160 full) | 30 | M1 | 35% fire chance when hit | P1 |
| fuel_ss | Self-sealing tank 150 L | 1×1 | 90 (+120 full) | 40 | M1 R2 | 10% fire chance | P1 |
| fuel_l | Fuel tank 1000 L | 2×2 | 250 (+800 full) | 60 | M3 | 35% fire chance | P2 |
| ammo | Ammo rack | 1×1 | 150 + load | 30 | M1 | 20 shells or 2,000 MG rounds; 40% detonation chance | P1 |
| ammo_p | Protected ammo storage | 1×1 | 220 + load | 50 | M2 | 10% detonation chance | P1 |
| cargo | Cargo bay | 2×2 | 200 | 40 | M2 W1 | 2 t of supplies | P1 |
| troop | Troop compartment | 2×2 | 250 | 50 | M2 | 1 infantry squad | P2 |
| tank_c | Fuel cargo tank | 3×2 | 400 | 60 | M4 | 4,000 L fuel cargo; 50% fire chance | P2 |
| repair | Repair workshop | 2×2 | 600 | 60 | M4 E1 | Field repair 10 HP/s, using spare parts | P2 |
| crane | Recovery winch | 2×2 | 900 | 80 | M5 | Tows up to 30 t | P2 |
| blade | Dozer blade | 2×1 | 700 | 90 | M4 | Builds field works; clears obstacles | P2 |
| bridge | Bridge layer | 4×1 | 3000 | 120 | M10 | Lays a 10 m bridge | P2 |
| ramp | Landing ramp | 2×2 | 400 | 60 | M3 | Unloads onto a beach | P2 |

## 6. Terrain physics

| Terrain | Softness | Grip μ | Concealment | Heat × | Notes |
|---|---|---|---|---|---|
| Road | 0 | 0.90 | 0 | 1.0 | |
| Plains | 0.1 | 0.75 | 0.1 | 1.0 | |
| Forest floor | 0.3 | 0.60 | 0.5 | 0.9 | Vehicles taller than 3 m are slowed 20% by branches |
| Sand | 0.5 | 0.50 | 0.1 | 1.3 | |
| Snow | 0.6 | 0.35 | 0.2 | 0.7 | |
| Mud / marsh | 1.0 | 0.40 | 0.1 | 1.0 | |
| Urban rubble | 0.2 | 0.65 | 0.6 | 1.0 | |
| Rock / mountain | 0 | 0.80 | 0.3 | 0.9 | |

## 7. Formulas

### 7.1 Ground movement

1. **Ground pressure** (kPa) = mass × g ÷ total contact area ÷ 1000.
2. **Pressure factor** = clamp(ground pressure ÷ 100, 0.3, 3).
3. **Rolling resistance coefficient:**
   - wheels: crr = 0.015 + softness × 0.25 × pressure factor
   - tracks: crr = 0.04 + softness × 0.08 × pressure factor
4. **Effective power** P_eff = engine kW × 1000 × drivetrain efficiency × power availability.
   - Drivetrain efficiency: wheels 0.85, tracks 0.75.
   - Power availability: 1 if the power budget is met, otherwise produced ÷ drawn.
5. **Drive force** = min(P_eff ÷ max(v, 2.5 m/s), μ × normal load on driven contacts). 2.5 m/s is the lowest-gear speed: below it the pull stops rising, so an underpowered design really stalls on a steep hill (it was 1 m/s, which let everything crawl up anything).
6. **Resistance** = crr × m × g + m × g × sin(slope) + 0.5 × 1.225 × 0.9 × A × v².
   - A = vehicle height (m) × 2.5 m assumed width.
7. **Speed caps:** top speed is capped by the locomotion cap. In battle the caps are multiplied by `BATTLE_SPEED_SCALE` (0.5). Above the cap the engine brakes, so vehicles don't run away downhill. Reverse is capped at 45% of forward.
8. **Bogged down:** if rolling resistance at v = 0 on flat ground exceeds the drive force, the vehicle is stuck and floating text reads "Bogged down".

### 7.2 Stability

**Tip angle** = atan(half the contact base length ÷ centre-of-mass height). The designer shows it, and the physics enforces it naturally.

### 7.3 Ships

- **Beam** = design length × 0.18, clamped to 2.5–12 m.
- Each hull cell below the waterline displaces 0.25 m² × beam.
- **Buoyancy** = 1000 × g × displaced volume.
- **Reserve buoyancy** = (total hull volume − mass ÷ 1000) ÷ total hull volume.
- **Flooding:** a destroyed hull cell below the waterline takes in water at 0.5 t/s. The water spreads to neighbouring hull cells unless a bulkhead is in the way.

### 7.4 Aircraft

- **Lift** = 0.5 × 1.225 × v² × S × CL.
  - CL = 0.1 per degree of angle of attack, up to 1.2.
  - Beyond 12° the wing stalls.
- **Stall speed** = √(2 m g ÷ (1.225 × S × 1.2)).
- **Helicopter:** maximum rotor lift = 25 kN per rotor at full power, which needs at least 400 kW available.

### 7.5 Reliability

- **Breakdown rate** per operating hour = Σ(1 − rel_i) × 0.5.
- In battle, check every 30 s using 1/120 of the hourly rate.
- A breakdown disables one part, chosen at random weighted by (1 − rel).
- **Fixing it** costs 1 spare part plus 30 s of field repair (repair vehicle), or waiting for a depot.

### 7.6 Heat

- **Heat balance** = Σ heat produced × terrain heat factor − Σ radiator cooling − 2 per engine (passive cooling).
- **When positive (overheating):**
  - engine power × (1 − 0.5 × overheat fraction)
  - automatic weapon fire rate drops
  - after 20 s above 100%, fire can break out

### 7.7 Cost and build time

- **Cost** = sum of all part costs.
- **Build time** (hours) = mass in tonnes × 1.5 + electronics × 0.5, at a level-1 factory. Each factory level is ×1.5 faster.

## 8. Starting templates for Part 1 (ground)

Build these as real part grids. Rough targets:

| Template | Size | Build | Mass |
|---|---|---|---|
| Scout car | 10×5 | 4 road wheels, petrol engine S, HMG, 20 mm plates, radio, optics | about 5 t |
| Light tank | 12×6 | 4 track segments, diesel engine M, turret with 37 mm cannon + MG, 20 mm armour | about 11 t |
| Medium tank | 14×7 | 5 track segments, diesel engine M, turret with 75 mm cannon + MG, 40 mm front and 20 mm sides, ammo rack, 2 fuel tanks | about 18 t |
| Assault gun | 13×5 | 5 track segments, diesel engine M, fixed 105 mm cannon, 80 mm sloped front, no turret | about 20 t |
| Supply truck | 11×5 | 3 off-road wheels, petrol engine S, cargo bay, timber frame | used in escort levels |

**Enemy set for the ladder:**
- supply truck
- machine-gun car
- light tank
- anti-tank gun in a bunker
- off-screen howitzer battery
- "Behemoth" heavy tank boss (level 10, gives a blueprint)
- a new boss every 5 levels after that
