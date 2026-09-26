# Iron Doctrine: balance and economy

These are starting values. Tune them with the Battle Simulator and campaign playtests. The player never sees ratings, only raw numbers and consequences.

## 1. Principles

- **Nothing is simply better.** Every variant trades something for something else: mass, heat, power draw, reliability, cost, electronics, ammo use, range or size.
- **Upgrades are branches, not ladders.** Each mark offers two directions, and every upgrade costs noticeably more than it gains, so cheap Mk I parts stay viable.
- **Context decides.** Terrain, weather, enemy type and logistics change which design works. The simulator and after-action facts teach the player; the UI never does.
- **Scarcity is deliberate.**
  - Electronics are scarce and Precursor scrap scarcer.
  - Salvage never fully replaces losses.
  - Fuel range limits reach.

## 2. Performance index

For each part, `tools/part-lib.mjs` compares its stats with its family base (`variant: "std"`). For each weighted stat:

- **Higher is better:** ratio = new ÷ base.
- **Lower is better** (negative weight): ratio = base ÷ new.
- **Reliability:** ratio = failure rate of the base ÷ failure rate of the new part.
- Each ratio is clamped to 0.25–4.

**P** = the weighted average of the ratios. The base scores 1.00.

| Category | Weights (a − sign means lower is better) |
|---|---|
| weapon | pen 3, damage 2, reload −2, range 1, accuracy 2, mass −1, hp 0.5, draw −1, heat −1, reliability 1 |
| mobility | power 3, thrust 3, mass −1.5, fuel −1.5, heat −1, reliability 1, hp 0.5, speedCap 1, load 1, grip 1 |
| lift | lift 3, mass −1, hp 1, draw −1, fuel −1, reliability 1 |
| missile | damage 2, speed 1, range 1, turn 1, mass −1, hp 0.5 |
| system | effect 3, range 1, draw −1, mass −1, hp 0.5, heat −1, reliability 1 |
| logistics | capacity 3, mass −1, hp 1, fireChance −1, detChance −1 |
| crew | crewSlots 2, armor 1, hp 1, mass −1 |
| special | effect 3, rate 2, capacity 1, draw −1, mass −1, hp 0.5, reliability 1 |

## 3. Cost index and bands

**Cost index** = Σ amount × reference price. Prices: wood 4, metal 10, electronics 40, scrap 3, money 1 (the same as §6).

| Kind | Required |
|---|---|
| Variant (vs its family's std) | P 0.90–1.15, and **value** (P ÷ cost ratio) 0.88–1.12, **and** at least one stat ≥ +8% (a real pro) and one ≤ −7% (a real con) |
| Mk II option (vs its own Mk I) | P 1.06–1.20, and cost × 1.30 or more |
| Mk III option (total vs Mk I) | P 1.15–1.38, and cost × 1.70 or more |

- Anything outside a band is a **warning**. Fix it, or add `balanceNote` explaining the deliberate outlier (for example, a faction signature part).
- **Pros and cons text** must be factual and specific: "+25% penetration", "Reload +0.4 s", "Needs 60 kW". Never write "better" or "worse".

**Variant recipes that tend to land in the bands:**

| Variant | Trade |
|---|---|
| Long barrel | + pen and range; − mass, reload, and a longer overhang (it catches on trees) |
| Short or howitzer barrel | + damage (HE); − pen, range |
| Lightweight | − mass; − hp, reliability |
| Rugged | + reliability, hp; − mass, cost |
| High-output | + power or lift; − fuel, heat, reliability |
| Precision | + accuracy; − reload, electronics cost |

## 4. Getting parts

**Crafting**
- **Where:**
  - city: tier 0–2
  - metropolis: all tiers
  - T4 also needs the tech node and scrap
- **Needs:** the part unlocked (tech, faction or reverse-engineered); its cost in the local warehouse or the docked fleet's hold; and money.
- **Time** = 1 h + mass ÷ 250 h + electronics × 0.3 h. Metropolis × 0.75.
- **Queue:** one per settlement. Output goes to the warehouse (or the docked hold, if chosen).

**Other sources**
- **Salvage:** see §9.
- **Reverse-engineering:**
  - Bring a salvaged enemy part item to a metropolis workshop.
  - Cost: 3 days, money 2 × the part's cost index ÷ 10, and the item is consumed.
  - Result: that family (std variant) is unlocked for crafting.
- **Faction parts** are unlocked by faction from the start or through tech (09).

## 5. Swaps, wear and repairs

**Refits**
- **Yard refit** (city or metropolis): swap any parts.
  - Time = Σ (mass of added and removed parts) ÷ 400 h.
  - Removed parts go to the warehouse or hold with their condition.
- **Field swap:** a mobile workshop in the fleet can swap parts of 2×2 cells or smaller. It takes twice as long.

**Wear**
- **Condition** runs from 0 to 100%.
  - Mobility parts: −1% per 10 operating hours.
  - Weapons: −1% per 50 shots.
  - Other parts: −1% per 30 hours.
- **Salvaged items** arrive at 25–60%.
- **Effect:** the breakdown rate × (1 + (1 − condition)). Below 30%, a part is **worn**: −10% on its main stat.

**Repairs**
- **Dock repair:**
  - Cost = damaged fraction × part cost (resources) × 0.5, plus a money fee of 10% of that.
  - Time = Σ damaged fraction × part mass ÷ 200 h.
  - Forts and citadels repair at × 0.6 time.
  - Docks also restore condition, at 40% of that part's resource cost per 50% restored.
- **Field repair** (repair bay):
  - In battle: 8 HP/s to reserve ships.
  - On the map: 200 HP/h across the fleet.
  - Costs 0.6 × the equivalent resources from the hold.
  - Can't fix destroyed parts. Those need a replacement item.

## 6. Prices and money

Base prices, in money per unit:

| Good | Buy | Unit |
|---|---|---|
| Fuel | 6 | 100 L |
| Ammo | 12 | 100 kg |
| Wood | 4 | 100 kg |
| Metal | 10 | 100 kg |
| Electronics | 40 | 20 kg |
| Scrap | — (sell only, 3) | 100 kg |

**Buy price multipliers**
- **By settlement type:** village 1.1, city 1.0, metropolis 0.95, fort 1.05, citadel 1.0.
- **By ownership:**
  - your own settlements: × 0.85
  - neutral: × 1.0
  - factions at war: no trade
  - factions in truce: × 1.2
- **Stock:** at 20% of normal, the price × 1.5.
- **Sell price** = 0.6 × the buy price.

**Market stock** refills at 10% per day.

| Settlement | Fuel | Ammo | Each resource |
|---|---|---|---|
| Village | 60 | 30 | 40 |
| City | 200 | 100 | 150 |
| Metropolis | 500 | 250 | 400 |
| Fort | 250 | 200 | 60 |
| Citadel | 600 | 500 | 200 |

**Money flows**
- **In:** settlement income, sales, plunder (captured settlements hand over 25% of their production value for 10 days), bounties on destroyed enemy ships (5% of their cost index).
- **Out:** wages, fort and citadel upkeep, purchases, crafting fees, repairs, research, recruitment.

## 7. Settlements

| Type | Wood/day | Metal/day | Electronics/day | Money/day | Warehouse (units) | Walls HP / armour | Emplacement slots | Garrison | Militia |
|---|---|---|---|---|---|---|---|---|---|
| Village | 6 | 4 | 0 | +15 | 600 | — | 0 | 2 | 1 small |
| City | 14 | 12 | 0 | +50 | 2500 | 3000 / 40 mm | 2 | 4 | 2 |
| Metropolis | 24 | 24 | 6 | +150 | 8000 | 6000 / 60 mm | 4 | 6 | 3 |
| Fort | 0 | 0 | 0 | −20 | 1500 | 8000 / 90 mm | 4 | 8 | 3 |
| Citadel | 0 | 0 | 0 | −60 | 4000 | 16000 / 120 mm | 8 | 12 | 5 |

**Biome multipliers**

| Biome | Effect |
|---|---|
| Forest | Wood × 1.5, metal × 0.7 |
| Hills and mountains | Metal × 1.5, wood × 0.7 |
| Desert | Both × 0.5, +3 scrap/day |
| Ruins | +6 scrap/day |
| Coastal | Money × 1.2 |

**Upgrades** (resources must be in that settlement's warehouse):

| Upgrade | Wood | Metal | Electronics | Money | Days |
|---|---|---|---|---|---|
| Village → City | 120 | 80 | 0 | 1500 | 3 |
| City → Metropolis | 300 | 300 | 40 | 6000 | 7 |
| Village → Fort | 60 | 160 | 0 | 2000 | 4 |
| Fort → Citadel | 150 | 450 | 30 | 7000 | 8 |

**Defence:** emplacements get +20% accuracy (a stable platform). The keep has 2 × the walls' HP and is the win target (01 §11).

## 8. Fuel and ammo use

**Map fuel** (units per hour, per ship) = Σ engine fuel L/h × 0.25 ÷ 100.
- Air: × 1.3.
- Roads: × 0.85.
- Storms (air): × 1.5.
- Lift engines add their own fuel.

**Battle fuel** is burned at the throttle fraction × fuel L/h. Flamethrowers burn 0.05 units/s while firing.

**Ammo per shot** (units):

| Weapon | Ammo |
|---|---|
| MG, per 10-round burst | 0.001 |
| 20 mm | 0.004 |
| 37 mm | 0.012 |
| 57 mm | 0.03 |
| 75 mm | 0.06 |
| 105 mm | 0.14 |
| 150 mm | 0.35 |
| 203 mm | 0.8 |
| Rockets, per rocket | 0.2 |

- **Missiles and drones** are items.
- **Energy weapons** use no ammo. They need a power surplus and a heat margin.

## 9. Salvage

Salvage only happens if you **win and hold the field**.

**Enemy parts**
- Each destroyed enemy part has a **12%** chance to be recovered as an item, at 25–60% condition.
- Parts on enemy ships that retreated are not salvageable.

**Scrap**
- **30%** of the destroyed ships' total mass (kg ÷ 100 × 0.3 units).

**Bonuses**
- Each salvage crane in the winning roster: +6% chance (maximum 2 cranes) and +20% scrap.
- Salvage Clans: × 1.5 on both.

**Your own destroyed ships:** half the enemy rates, and only for parts.

**Scrap fields:** 4 scrap per hour while a fleet with a salvage crane stays there. Each field holds 200–600 before it's exhausted.

**Cargo:** loading is limited by free cargo space. Anything left behind is lost after 1 day.

## 10. Experience and levels

**Captains, levels 1–10**
- **XP thresholds:** 0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200.
- **Class access:** level 1 = small, 3 = medium, 5 = large, 8 = extra-large.
- **Per level:** +2% accuracy, −3% reaction time, +1% repair speed.
- **XP per battle:** 20 + damage dealt ÷ 10 + 30 if the ship survives + 20 if the battle is won.

**Admirals, levels 1–10**
- **XP thresholds:** double the captains'.

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Fleet size | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 11 |

- **Flagship class:** same thresholds as captains.

**Grand Admiral, levels 1–30**
- **XP to reach level L** = round(150 × (L − 1)^1.7), e.g. level 2 = 150, level 5 ≈ 1580, level 10 ≈ 6290, level 30 ≈ 45,900.
- **Fleet size and flagship class** as for an admiral of level min(10, ⌈L ÷ 3⌉).
- **Command Points:** +2 CP per level (58 by level 30).

**Grand Admiral XP sources**
- Battle won: 40 per destroyed enemy ship of class 1, × 2 per class step up (class 1 = 40, class 2 = 80, class 3 = 160, class 4 = 320). Half of that for a loss.
- Capture: village 100, fort 250, city 300, citadel 700, metropolis 800.
- Convoy delivery: 20.
- Reverse-engineering: 50.

## 11. Tech tree

**Common rules**

| Tier | CP | Money | Electronics | Scrap | Days | Researched at |
|---|---|---|---|---|---|---|
| T1 | 2 | 400 | 0 | 0 | 2 | City+ |
| T2 | 3 | 1200 | 10 | 0 | 4 | City+ |
| T3 | 4 | 3000 | 40 | 0 | 6 | Metropolis |
| T4 | 6 | 6000 | 100 | 50 | 10 | Metropolis |

- **Prerequisites:** each node needs its prerequisite (arrow).
- **Tier 0** is known from the start.
- The whole tree costs about 140 CP. A Grand Admiral earns about 58, so **choosing a doctrine is unavoidable**.

| Branch | T1 | T2 | T3 | T4 |
|---|---|---|---|---|
| Hulls | hull_iron (iron frame, steel plate, arm20, steel hull) | hull_heavy (arm40, arm80, slope40, bulkhead) ← hull_iron | hull_advanced (composite, alloy) ← hull_heavy | hull_precursor (Precursor plating) ← hull_advanced |
| Lift | lift_rigid (rigid envelope) | lift_engines (lift engine) ← lift_rigid | lift_armoured (armoured envelope) ← lift_engines | lift_levitator ← lift_armoured |
| Propulsion | prop_petrol (petrol engine, rubber wheel); prop_diesel (diesel engine, track) | prop_turbine (turbine, heavy track) ← prop_diesel; prop_marine ← prop_diesel | — | prop_reactor ← prop_turbine + hull_advanced |
| Guns | guns_medium (57, 75, HMG, mortar) | guns_heavy (105, 150 howitzer, 20 mm autocannon, flak) ← guns_medium; flame ← guns_medium; rockets ← guns_medium | guns_super (203 mm) ← guns_heavy | — |
| Missiles and drones | — | — | missiles (rack, VLS, magazine, HE, motor, fuel, fins, seekers) ← rockets; warheads_special (napalm, acid) ← missiles; drones (drone computer I, hangar, drone parts) ← radio; drones_2 ← drones; fabricators ← workshop; detachment (release clamp) ← hull_advanced | warheads_emp (EMP, cluster) ← warheads_special; drones_3 ← drones_2 |
| Energy | — | — | — | lasers (pulse laser, capacitor, laser seeker, drone laser) ← fire_control + hull_advanced; plasma ← lasers; energy_heavy (heavy laser, plasma lance) ← plasma |
| Systems | radio; fire_control; flares | radar ← radio; stabiliser ← fire_control; workshop (mobile workshop) ← repair_bay | ecm ← radar | — |
| Logistics | cargo_2 (fuel tank, steel hold); repair_bay; salvage (salvage crane) | — | — | — |

## 12. Perks (Command Points)

| Perk | CP | Effect |
|---|---|---|
| **Command** | | |
| Veteran eye | 1 | +5% accuracy for all your captains |
| Quick rotation | 2 | Pull-back and reserve entry times −40% |
| Iron discipline | 2 | AI captains react 20% faster |
| Wider command | 3 | Grand Admiral fleet size +2 |
| Second in command | 3 | Admirals' fleet size +1 |
| **Logistics** | | |
| Deep holds | 1 | Cargo capacity +10% |
| Frugal engines | 2 | Map fuel use −10% |
| Scavengers | 2 | Salvage chance +4%, scrap +20% |
| Quartermaster corps | 2 | Convoys +20% speed, +10% cargo |
| **Engineering** | | |
| Field engineers | 1 | Field repair +30% |
| Master crafters | 2 | Crafting time −25% |
| Refinery know-how | 2 | Refining needs 1 less scrap |
| **Trade** | | |
| Merchant charter | 2 | Buy prices −8%, sell prices +8% |
| Tax reform | 3 | Settlement money +15% |

## 13. Recruitment, wages, start

**Recruitment**
- **Captain:** 120 × level² money, plus their ship at list price (1.2 × the design's cost index).
  - Forts offer levels 1–4 with small and medium faction designs.
  - Citadels offer levels 3–8 with large and extra-large designs.
- **Admiral:** 600 × level. Forts offer levels 1–2; citadels up to level 5. A captain of level 6 or above can be **promoted** for 400 × level.
- **Quartermaster:** 250 (city or metropolis).

**Daily wages**
- captain: 4 × level
- admiral: 15 × level
- quartermaster: 8
- the Grand Admiral: none

**Starting kit** (01 §4.3)
- **Money:** 1500.
- **Ships:** start with full fuel and ammo.
- **Home city warehouse:** 80 wood, 60 metal, 5 electronics, 40 fuel, 30 ammo, 20 scrap.
- **Home fort:** 1 captain (level 2) available to recruit, with a tier 0 corvette.

## 14. Faction modifiers

See 09. Every faction bonus is paired with a real weakness. Balance factions across a whole campaign, not per battle.
