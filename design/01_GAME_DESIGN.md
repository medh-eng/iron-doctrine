# Iron Doctrine: game design

## 1. Pitch

Command an entire war. Design every tank, ship and aircraft part by part, keep them fuelled and armed across a living map, and fight the battles that matter yourself. Nobody tells you what works. You find out, and that becomes your doctrine.

**Tagline:** "No manual tells you how to win this war. You'll write your own."

**Inspirations:**
- HighFleet: campaign, fleets, logistics, design
- Bad Piggies: physical, part-by-part construction
- Command & Conquer: real-time battles

The player is a field commander, not an all-seeing RTS god.

## 2. Pillars

1. **Designs are physical.** Mass, balance, power, grip and armour come from where parts sit, not from stat sliders. The player can see why a design fails.
2. **No meta.** The game shows numbers and consequences, never verdicts. Every strength costs something elsewhere: fuel, terrain, price, reliability or supply.
3. **Logistics win wars.** A victory that outruns its supply collapses.
4. **Everything persists.** Losses, damage, veteran crews and design lineages carry forward.
5. **Commander, not god.** You drive one vehicle and give orders to the rest.

## 3. Setting

The continent of Kessra is fictional. A century-old treaty has collapsed. The maritime Harbour League (player, blue) and the inland Directorate (enemy, red) now fight over oil, ore and the rail lines that connect them. Neutral free cities can be won over or captured.

**Technology:** a fictional diesel-to-early-missile era, so propellers, rotors, radar and early guided missiles all coexist.

**Tone:** serious stakes, warm presentation. It should feel like a war-room table with toy-soldier crispness. No gore.

## 4. Modes

- **Proving Ground (Part 1+):** an endless battle ladder, levels 1 to unlimited, with lives and score. It is the fastest way to have fun and doubles as the design test bench.
- **Campaign (Part 3+):** the full war on a generated continent, saved in 3 slots.
- **Drafting Office:** the vehicle designer. Reachable from the title screen, the ladder workshop and campaign workshops.
- **Test Range:** drive any design on any terrain, with nothing at stake.

## 5. Core loop (campaign)

1. Gather resources.
2. Build and grow infrastructure.
3. Design and build forces.
4. Organise armies, fleets and air groups.
5. Plan supply.
6. Move on the map and make contact.
7. Fight the battle, or auto-resolve it.
8. Take losses and gain ground.
9. Recover, repair and refit.
10. Adapt designs, then repeat.

## 6. Strategic campaign

### 6.1 Map

- Generated from a seed: about 50 land regions plus sea zones. Built as Voronoi cells over a noise-based continent with a coastline, 2–4 islands and rivers.
- **Terrain per region:** plains, forest, hills, mountains, desert, marsh, snowfield (north), urban, coast, island.
- **Features:** village, town or city, port, oil field, offshore oil rig, iron mine, copper mine, timber forest, rubber plantation (warm south), farmland, factories, airfield, shipyard, military base, fortifications.
- **Links between regions:**
  - road (quality 1–3)
  - rail (must be built)
  - river crossing (needs a bridge, otherwise a slow ford)
  - sea lane (port to port)

### 6.2 Time

- The map runs in real time, like HighFleet. At 1× speed, 1 in-game hour = 1 second. Speeds are 1×, 3× and 10×.
- A big **Start/Stop** button controls the clock. The player can give orders while time is stopped.
- The clock stops automatically on:
  - enemy contact
  - battle ready
  - construction done
  - supply warning
  - force arrival

  Each auto-stop event can be switched off in Settings.

### 6.3 Forces

- **Force types:**
  - Army: ground vehicles, infantry and support vehicles
  - Fleet: ships and submarines
  - Air group: aircraft and helicopters, based at airfields
- Every unit is an individual, persistent object. It has a design and mark, per-part damage, fuel, ammo and crew experience.
- **Movement** follows links. A force moves at the speed of its slowest unit for that terrain and link, reduced by bad weather or poor supply.
  - Rail is fast but needs rail links and train capacity.
  - Fleets move through sea zones, and fuel range matters.
- **Stances:** Advance, Defend, Recon, Raid supply, Withdraw.
- **Fog of war:** you see what your units, radar stations, recon aircraft and friendly regions can see. Weather reduces detection.

### 6.4 Contact and battle generation

When hostile forces meet in a region, the player chooses:
- **Fight**
- **Auto-resolve**
- **Withdraw** (pursuit by a faster enemy costs some units)

The generator builds the battlefield from:
- region terrain
- features (village, bridge, port)
- weather and time of day
- the forces involved
- attack directions
- fortifications

| Region | Battlefield |
|---|---|
| Plains | Rolling farmland, little cover, long sight lines |
| Forest | Forest road with clearings and a village; concealment |
| Hills / Mountains | Steep ridges and passes; height helps artillery and spotting |
| Desert | Dunes and flats; heat; very long sight lines |
| Marsh | Mud patches and a causeway road |
| Urban | Streets with destructible buildings and rubble |
| Coast | Beach landing: sea on one side, beach, bluffs, bunkers |
| Island | Mostly sea: naval and air fighting around a small beach |
| Sea zone | Open water: surface, air and underwater |

- **Flanking:** attack a region from two linked regions at once, and your forces enter from both edges of the battlefield.
- **Fortifications** in a region add trenches, bunkers and anti-tank obstacles to the battlefield.

### 6.5 Winning the war

- **Win:** capture the Directorate capital, or break it. Its war capacity (industry + supply + morale) is tracked, and when it falls below a threshold it sues for peace.
- **Lose:** your capital falls or your own capacity collapses.
- **Difficulty settings** (chosen at campaign start): enemy industry, AI aggression, supply harshness, battle damage.

## 7. Tactical battles

### 7.1 View and layers

- Side view in landscape. The camera follows your controlled vehicle; the player can pan and pinch to look around.
- **Vertical layers:**
  - sky: aircraft, helicopters, falling bombs
  - ground: terrain heightfield that craters
  - sea surface: ships, landing craft
  - underwater: submarines, torpedoes
- Battlefields are 1.5–4 km long. A minimap strip shows everything spotted.

### 7.2 Command structure

**Your squad** is up to 3 vehicles. You drive one. The other two follow squad orders:
- Follow (formation)
- Escort (stay between you and threats)
- Hold here
- Attack my target
- Fall back

Tap a squad vehicle or press Swap to take control of it.

**The rest of your force** is organised into platoons of up to 4 units. They follow force orders:
- Advance
- Hold line
- Flank (only when attacking from both edges)
- Bombard (artillery or naval guns on a marked area)
- Air strike
- Air cover
- Smoke screen
- Withdraw

Platoons arrive as reinforcement waves whenever the on-screen unit cap allows.

**Infantry** squads are not designed. Types are rifle, anti-tank, engineers, recon and AA. They are trained in barracks and carried by trucks or APCs with troop space. Engineers build and repair bridges and clear obstacles.

### 7.3 Physics (the Bad Piggies feel)

**Ground vehicles**
- A vehicle is one rigid body made of its parts. Its mass and centre of mass come from where the parts sit.
- Wheels and track units are spring-damper contacts on the terrain heightfield. Engines drive them through the locomotion parts.
- Grip depends on terrain softness and ground pressure (mass ÷ contact area).
- Consequences the player should see:
  - top-heavy designs tip over on slopes
  - underpowered designs stall on hills
  - long vehicles bridge trenches; short ones fall in

**Ships and submarines**
- Buoyancy comes from hull cells below the waterline, and draft rises with mass.
- Holed hull cells flood, so the ship lists and can sink.
- As built in v0.2.0: watertight parts are the hull and bow sections, keel, bulkheads and the marine diesel. A shell that goes through a hull part below the waterline leaves a hole; a destroyed one is a wide breach. Water fills the compartment from the bottom up; bulkheads and the keel stop it. A ship whose highest point goes under, or that rolls past about 75°, is out ("Sunk", "Capsized"). A land vehicle whose crew compartments go under is "Flooded".
- Side view: ships drive forward and reverse like ground vehicles; they don't turn around.
- Submarines (v0.2.1): ▲ ▼ set a depth order; the ballast tanks hold it and keep the boat level. Submerged, only electric motors drive, and the boat is hidden from everything but sonar.
- Submarines trim with ballast tanks.

**Aircraft and helicopters**
- Aircraft get lift from wing cells against their mass, and thrust against drag. They stall below minimum speed.
- Helicopters get lift from the rotor against their mass.
- As built in v0.2.2: aircraft squad members start in the air on any map (45 m up, helicopters 18 m). A design whose centre of mass is behind its centre of lift is unstable and can pitch up into a stall; the Drafting Office says so as a fact.

**Destroyed parts** detach and fly off as debris. A tank can lose its turret and keep driving.

### 7.4 Weapons and damage

**Weapons**
- cannon (armour-piercing and high-explosive shells, ballistic arcs)
- machine gun (fires automatically at soft targets and aircraft)
- autocannon
- howitzer (indirect fire, needs spotting)
- rockets and missiles (guided when fire control or radar allows; ECM confuses them)
- torpedoes
- bombs
- depth charges
- AA guns

**How hits work**
- Every shot is a projectile. When it reaches a vehicle, it is traced through the part grid.
- Each cell has HP and armour thickness in mm.
- Penetration (mm, falling with range) is compared with effective armour = thickness ÷ cos(impact angle).
- Beyond about 70° the shot ricochets.
- A penetrating shot damages the part it hits and spills into the parts behind it.

**Part effects**
| Part destroyed | Effect |
|---|---|
| Engine | No drive |
| Fuel tank | Fire (damage over time) |
| Ammo storage | Chance to detonate, unless it is protected storage |
| Wheels / tracks | Limping or immobilised |
| Gun | Can't fire |
| Turret ring | Turret can't turn |
| Radar / sensors | Spotting drops |
| Radio | Can't receive orders beyond line of sight |
| Crew compartment | Crew casualties: slower reloads, then vehicle abandoned |
| Hull below waterline | Flooding |

**Knocked out:** a vehicle is out of the fight when its crew compartments are gone, when only locomotion is left, when its ammunition detonates, or when its parts are down to 30% of their total HP ("Wrecked").

**Accuracy** = weapon base × fire control × crew skill × stationary bonus × visibility. The player can also aim manually for a precise shot (spread × 0.6).

**Spotting:** you can only target what someone sees. Sensors, height, weather, night, smoke and forest concealment all matter. In Part 1b: a crew sees 95 m (× 1.4 with optics), halved against a target in forest; smoke screens block the line of sight; firing reveals the shooter for a few seconds. Unseen enemies are not drawn and can't be targeted; a red arrow at the screen edge points to spotted enemies off screen.

### 7.5 Ending a battle

**Objectives by battle type:**
- rout or destroy the enemy
- take and hold the objective flag
- hold until time runs out
- get the convoy through
- establish the beachhead

**Withdraw** at any time. Units that leave by your edge survive.

**Results written back to the campaign:**
- destroyed units are removed
- wrecks can be recovered by recovery vehicles if you hold the field
- damaged parts stay damaged
- ammo and fuel are spent
- crews gain experience
- captured enemy wrecks become blueprints and part unlocks

### 7.6 Auto-resolve

Auto-resolve runs the same combat rules as a fast headless simulation, so results match what would have happened. It is offered for every battle; the player picks which battles to fight in person.

## 8. Construction (Drafting Office)

### 8.1 Grid and rules

Side-view grid; one cell = 0.5 m. Parts occupy one or more cells and can be flipped.

| Chassis class | Grid size |
|---|---|
| Light ground | 16×8 |
| Heavy ground | 28×12 |
| Aircraft | 32×12 |
| Ship | 44×16 (was planned up to 80×24; 44×16 keeps cells readable on a phone) |

**Placement rules:**
- all parts must connect to the structure
- locomotion must touch the lowest row
- turrets need a turret ring
- weapons need a mount (hull or turret)
- crew need compartments
- aircraft need wings or rotors
- ships need a sealed hull with a keel

The domain (ground, naval, submarine, air, helicopter) is worked out from the parts used.

### 8.2 Constraints and derived numbers

The designer shows these numbers:
- mass and centre of mass
- power: produced vs drawn (kW), and power-to-weight
- top speed on each terrain, climb limit, tip angle, ground pressure
- draft and reserve buoyancy (ships); stall speed (aircraft)
- fuel use per hour, range
- heat produced vs removed, adjusted for climate
- reliability (expected breakdowns per 100 h)
- crew needed vs available
- armour per facing (front, side, top, bottom)
- detection range
- cost in the six resources, build time
- cargo, ammo and fuel capacity

Warnings state facts only, e.g. "Power drawn exceeds power produced by 40 kW." Never judgements like "weak armour".

### 8.3 Templates, random designs and scratch builds

- **Starting templates (Mk.I):** Scout car, Light tank, Medium tank, Assault gun, Self-propelled howitzer, Half-track APC, Supply truck, Fuel tanker, Recovery vehicle, Gunboat, Destroyer, Submarine, Landing craft, Fighter, Bomber, Scout helicopter.
- **Randomise:** generates a valid design for a chosen class and budget. It is seeded, and the player can re-roll.
- **Scratch build:** an empty grid with a starter frame.

### 8.4 Versions and refits

- Saving a changed design creates the next mark (Mk.I → Mk.II) with an automatic change log.
- Units already in the field keep their mark until refitted at a workshop, repair depot or shipyard. A refit costs the difference in parts plus labour time.
- A lineage view shows each design family tree.

### 8.5 Unlocking parts

Base parts are available from the start. More come from:
- research at workshops (costs electronics and time)
- reverse-engineering captured enemy wrecks

### 8.6 The Workshop (HighFleet influence)

The producer asked for a workshop where vehicles, ships and planes are customised and upgraded, taking HighFleet's parts, balancing and graphics as the model. The Workshop is the Drafting Office plus refits of existing units, reachable between ladder levels, from the title and at campaign workshops, repair depots and shipyards.

**What we take from HighFleet**
- **Every part is a physical module with a price in weight.** Armour, guns, engines, fuel and ammo all add mass, and the machine visibly pays for it: it sits lower, climbs slower, accelerates slower, burns more fuel.
- **Balance is shown, not scored.** Live markers on the blueprint: centre of mass, centre of lift (aircraft), waterline and centre of buoyancy (ships), contact base and tip angle (ground). An unbalanced design visibly leans in the preview before it ever reaches a battle.
- **Thrust or power against weight is the headline number.** The top strip always shows mass, power-to-weight (ground), thrust-to-weight (air), reserve buoyancy (ships), top speed, fuel range and cost, as raw numbers.
- **Damage is per module and stays.** A refit replaces destroyed or damaged modules; what isn't repaired stays damaged.
- **Parts are bought, not levelled.** Upgrading means fitting a better part (37 mm → 75 mm, 20 mm → 40 mm plate, petrol S → diesel M), paid in resources (campaign) or Requisition (ladder). There are no stat sliders or upgrade levels (pillar 1).
- **Supply of parts varies.** In the campaign, each workshop stocks the parts its region can make; rare parts come from research and captured wrecks (§8.5).

**Refit flow**
1. Pick a unit (or a design) and open it on the blueprint.
2. Drag parts on and off. Each change shows its mass, cost and time delta, and the markers move.
3. Test drive or test flight on the range (§4 Test Range).
4. Confirm: the unit is refitted to the next mark. It costs the parts' price difference plus labour time (§8.4).

**Domains:** ground vehicles in Part 1c; ships, submarines, aircraft and helicopters in Part 2, with the same screen.

## 9. Logistics

### 9.1 What forces consume

- **Fuel:** by engine use and distance
- **Ammunition:** by shots fired
- **Spare parts:** for repairs and breakdowns
- **Food:** per crew and infantry per day
- **Construction materials:** for engineers and field works

### 9.2 Supply network

Supply flows along this chain:

**producers → regional stockpiles → links → depots → supply radius → forces**

- **Links** carry a limited amount per day: road by trucks, rail by trains, sea by cargo ships.
- **Supply radius** is 2 links from a depot by road, more by rail.
- **Support vehicles** travel with a force and carry a buffer that extends its reach: fuel tankers, ammo trucks, supply trucks, cargo and supply ships.
- **Convoys** are visible on the map and can be raided.

### 9.3 Running dry

| Shortage | Effect |
|---|---|
| Low fuel | Slower, then immobile |
| No ammo | Weapons silent |
| No spare parts | No field repairs; breakdowns stay broken |
| No food | Morale and experience loss, then infantry desert |

Forces out of supply show a clear warning with the days left.

### 9.4 Repair and recovery

- Repair vehicles and repair ships fix damaged parts in the field, using spare parts.
- Recovery vehicles tow immobilised or recoverable wrecks back to repair depots.
- Mobile workshops can refit near the front.
- Major rebuilds need a repair depot or shipyard.

## 10. Economy

### 10.1 Resources and chains

| Resource | Chain |
|---|---|
| Wood | Forest camp → sawmill |
| Metal | Iron mine → steel mill |
| Fuel | Oil field or offshore rig → refinery |
| Electronics | Copper mine + metal → electronics works (needs power) |
| Rubber | Plantation (south), or synthetic rubber plant (fuel → rubber) |
| Food | Farms, fisheries |

- **Power:** power plants burn fuel or wood to supply regional electricity. Factories need it.
- **Labour:** settlements provide workers. Buildings need workers. Population grows with food surplus and housing.
- **Production:**
  - vehicle factories build ground units
  - shipyards build ships
  - aircraft works build aircraft
  - each factory has a build queue
  - costs are drawn from stockpiles that must be delivered through the network
  - build time scales with mass and complexity

## 11. Infrastructure

**Settlement tiers:** Village (2 building slots) → Town (5) → City (10). Growth needs a food surplus, housing (wood and metal), a road or rail connection, and time.

**City buildings:**
- factory, warehouse, refinery
- vehicle factory, shipyard (port only), aircraft works
- barracks, hospital (crew recovery)
- workshop (research and refits), power plant
- airfield, repair depot
- steel mill, electronics works

**Field structures** (any owned region):
- mine, oil rig, farm
- road upgrade, railway, bridge
- radar station
- fortifications: trenches, bunkers, anti-tank obstacles
- port, depot

**Damage:** battles and bombing damage buildings and links, e.g. a rail line cut or a bridge down. Repairs need construction materials, engineers and time. A retreating side may sabotage the regions it leaves.

## 12. Persistence and history

- **Unit records:** each unit has a name and a record of battles, kills, distance travelled and damage history.
- **Crew veterancy:** Green → Trained → Veteran → Elite → Ace.
  - Improves reload speed, accuracy, spotting, breakdown chance and morale.
  - Crews can move to a new vehicle, e.g. a veteran crew in a fresh Mk.II.
- **War journal:** automatic entries for battles, captures, new design marks and notable deeds.
- **Hall of honour:** decorated units and crews.

## 13. The enemy

- **Strategic AI:**
  - values regions by resources and supply
  - attacks weak points and protects its own supply
  - reacts to threats
  - difficulty scales its production and aggression; it respects fog of war unless a difficulty setting says otherwise
- **Evolving designs (Part 5):** the enemy starts with its own templates. It records what killed its units and adapts: more armour where it was penetrated, tracks where it bogged down, AA where it was bombed, cheaper designs where it lost on numbers. The more the player relies on one design, the more counters appear. This is the anti-meta engine.

## 14. Proving Ground ladder (Part 1)

### 14.1 Rules

- Each level has one short goal.
- You field a squad of 3 designs within a budget. If all 3 are lost, you lose a life and retry the level.
- **Lives:** start with 3, gain 1 every 5 levels, maximum 5. Game over at 0.
- `levelConfig(level)` controls:
  - enemy count, types, armour, accuracy, reaction time and wave timing
  - terrain roughness and features
  - weather and time of day
  - squad budget

### 14.2 Introduction schedule

One new idea every 2–3 levels:

| Level | New idea |
|---|---|
| 1 | Flat farmland. Goal: destroy 3 parked supply trucks. Enemies don't shoot. |
| 2 | Moving trucks and one machine-gun car that shoots back |
| 3 | Hills |
| 4 | Armoured light tanks: ricochets appear; side and rear shots penetrate |
| 5 | Hold the ridge for 60 s. +1 life |
| 6 | Mud patches: grip and ground pressure |
| 7 | Enemy artillery, with incoming-shell warnings |
| 8 | Escort your supply truck to the depot |
| 9 | Forest: spotting and concealment |
| 10 | Boss: heavy tank. Capturing its blueprint is the reward. +1 life |
| 11 | Rain and dusk visibility |
| 12 | Gaps and bridges: vehicle length matters |
| 13 | Anti-tank guns in bunkers |
| 14 | Coastal gunboats (Part 2a): the sea begins at 300 m; gunboats sail in and shell the shore |
| 17 | Air raid (Part 2c): fighters, then a bomber and a helicopter, with a light tank on the ground. Only heavy machine guns, autocannons and AA guns reach aircraft |
| 16 | Submarine hunt (Part 2b): a sea battle. Only ships and submarines deploy; with none in the squad, 2 Destroyers and a Gunboat are lent |
| 15 | Night: sensors matter. +1 life |
| 16+ | Mixes of earlier ideas with rising numbers; every 5th level is a named boss with a blueprint |

Part 2 adds ladder levels with aircraft (you need AA), coastal gunboats and a submarine level. Level 14 became "Coastal gunboats" in v0.2.0. From level 16 on, about a quarter of the maps have a coast with a gunboat or two (a destroyer from level 28).

**Ships in the squad:** a squad design with a hull deploys at the near edge of the sea. On a map without sea it stays in port (a toast says so) and the rest of the squad fights. The Workshop shows whether the next level has sea.

### 14.3 Caps

These keep high levels possible:
- at most 10 enemies on screen
- enemy accuracy at most 0.7
- enemy reaction time at least 0.35 s
- enemy speed multiplier at most 1.5
- waves at least 6 s apart

### 14.4 Workshop, score and saves

- **Workshop between levels:** you earn Requisition from score and spend it on building or modifying designs within the ladder budget. Designs made here are kept for the campaign.
- **Score comes from:**
  - damage dealt and kills
  - precision bonuses for hitting critical parts
  - combo chains (kills within 4 s)
  - level-clear, no-loss and time bonuses

  Floating text shows every bonus as it happens.
- **Saved:** best score, highest level (continue from it), blueprints, medals, settings.

**Numbers as built in Part 1c** (tuning data in `07_data.js`):
- Kill points: truck 100, machine-gun car and scout 150, light tank 300, medium 450, assault gun 500, howitzer 350, bunker 400, boss 1500. Kills within 4 s chain a combo: points × combo count.
- Critical hit: +50 when your side destroys an enemy's engine, gun, crew compartment or ammunition.
- Level clear: 200 + 50 × level; no losses +300; time bonus 5 points per second under 60 + 5 × level seconds.
- Requisition earned = level score ÷ 10. New players start with 150.
- Squad budget per level = 200 + 12 × level cost points (the starting squad costs 211).
- Saving a design costs the part-price difference from the design you started from (a template, one of your designs or a blueprint); a randomised or scratch design costs its full part price.
- Losing the squad (or the escorted truck) costs a life and retries the level; at 0 lives it is game over, and "Continue at level N" starts a new run there with 3 lives and score 0.

## 15. Collection and rewards

- **Blueprints gallery** (on the title screen): captured enemy designs, from ladder bosses and from wrecks recovered in the campaign.
  - Each card shows the silhouette, name, where it was captured, and its stats.
  - It can be opened in the Drafting Office as a starting point.
- **Medals** for feats, e.g.:
  - survive a ricochet
  - a 5-kill combo
  - climb a 40° slope
  - win with no losses
  - sink a ship with a torpedo
  - keep one unit alive for 10 battles
- **Level clear:**
  - fanfare and paper-scrap confetti
  - a stencil stamp "Objective complete" slams onto the screen
  - reward reveal
