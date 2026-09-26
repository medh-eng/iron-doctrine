# Iron Doctrine: game design (v2)

v2 replaces the region map, the six-resource supply chain and the Proving Ground ladder of v1.

- Numbers live in **08_BALANCE_AND_ECONOMY**.
- Factions live in **09_FACTIONS**.
- Parts and art live in **05_PARTS_CATALOGUE** and **07_ART_AND_PARTS**.

## 1. Pitch and pillars

You are the Grand Admiral of one faction on the continent of Kessra, where fleets of great war machines rule the land, the sea and the sky. You:

- design every ship part by part
- keep your fleets fuelled, armed and repaired across an open world
- fight HighFleet-style side-view battles, three ships at a time

**Tagline:** "No manual tells you how to win this war. You'll write your own."

**Pillars**

1. **Designs are physical.** Mass, balance, power, lift, buoyancy and armour come from where parts sit.
2. **No meta.** The game shows numbers and consequences, never verdicts. Every part has real pros and cons.
3. **Logistics win wars.**
   - Money is the only universal resource.
   - Everything else sits physically in a fleet's hold or a settlement's warehouse.
   - Salvage never fully pays for a campaign.
4. **Everything persists.** Ships, damage, captains, admirals and design lineages all carry forward.
5. **Commander, not god.** You drive one ship. Captains and admirals follow orders.
6. **From timber to plasma.** A long climb from wooden hulls and small guns to lasers, plasma, missiles and drone carriers.

## 2. World

### 2.1 Kessra

- Kessra is built on the ruins of a vanished high-technology civilisation, the Precursors.
- Their wreckage lies everywhere as scrap.
- Refined scrap becomes electronics.
- The most advanced technology (tier 4: lasers, plasma, EMP, levitators) is reverse-engineered from Precursor relics.

### 2.2 The map

- **View:** one open world seen from above, not a grid of regions. It is seeded, generated and roughly 4 by 3 days of land travel.
- **Terrain:** sea, coast, plains, forest, hills, mountains, desert, marsh, tundra and ice, and Precursor ruins.
- **Roads** link settlements.
- **Movement by domain:**
  - Land fleets follow terrain. Roads are fast. Mountains are impassable except through passes.
  - Sea fleets stay on water.
  - Air fleets fly anywhere, but burn more fuel. Storms slow and push them.
- **Scrap fields** in the ruins can be picked over for scrap. This needs salvage parts and time.
- **Weather** moves across the map: clear, rain, fog, storm, snow, sandstorm. It affects spotting, speed and air travel.
- **Time:** real time with a Start/Stop button and 1×, 3× and 10× speeds. At 1×, 1 in-game hour = 1 s.
  - The clock stops itself on contact, sieges, arrivals, low fuel and finished crafting.
  - Each of these can be turned off in Settings.
- **Fog of war:** you see what your fleets, settlements and sensors can see.

## 3. Factions

Five factions share Kessra:

| Faction | Identity |
|---|---|
| Harbour League | Maritime traders |
| Directorate | Industrial land power |
| Skyreach Concord | Sky clans |
| Salvage Clans | Desert scavengers |
| Lumen Collective | Relic technocrats |

- Each has its own home territory, strengths and weaknesses, look, signature parts and AI personality (see 09).
- The player picks a faction at the start of a campaign; the other four are AI.
- Unowned neutral villages are scattered between them.

## 4. Chain of command

### 4.1 Ranks

- **Grand Admiral (the player):**
  - Commands like an admiral, with their own flagship and fleet.
  - Earns XP into ranks. Ranks give Command Points, which unlock the tech tree and perks.
- **Admiral:**
  - Leads one fleet (regiment).
  - The admiral's level sets the fleet size (3 up to 11 ships) and the largest class of flagship they can command.
- **Captain:**
  - Commands one ship; every ship needs one.
  - The captain's level sets the largest class they can command, and improves their AI skill.
  - Captains **cannot move on their own**. A captain removed from a fleet is garrisoned where they are left:
    - at a settlement, they join its garrison
    - in the open, they become a field outpost that can be attacked, or picked up by any fleet of the same domain
- **Quartermaster:** a cheap officer who leads **supply convoys** only. See §8.4.

### 4.2 Fleets

- **One domain each.** A fleet (regiment) is all land, all sea or all air.
- **Merging and transfers:** fleets in the same place can swap ships, captains and cargo, within fleet-size limits.
- **Combined battles:** several fleets can fight together when they meet an enemy in the same place (§10.2).
- **Orders on the map:**
  - Move, Follow, Intercept, Patrol
  - Siege (attack a settlement)
  - Dock (at a settlement: trade, craft, repair, recruit)
  - Detach captain, Transfer
  - Supply route (convoys only)

### 4.3 Start of a campaign

**Home territory:** a coastal home **City**, 2 **Villages** and 1 **Fort**.

**Fleets:**

| Fleet | Commander | Ships |
|---|---|---|
| Land | The Grand Admiral (flagship tank) | Flagship tank + 2 captains' tanks |
| Sea | An admiral | 3 corvettes |
| Air | An admiral | 3 gunships |

**Other starting conditions:**
- all designs use tier 0 parts: timber, iron bands, small guns, steam engines, canvas gas bags
- some money, and a little fuel and ammo in the holds (08 §13)
- the starting designs come from 10_PART_ROSTER batch F

## 5. Ships and classes

"Ship" means any large vehicle in its domain: landship, water ship or airship. The class sets the build grid and the part limit. The source of truth is `src/parts/classes.json`.

| Captain level | Land | Sea | Air |
|---|---|---|---|
| 1 | Tank (16×8) | Corvette (32×10) | Gunship (24×10) |
| 3 | Behemoth (28×12) | Destroyer (48×14) | Air frigate (36×14) |
| 5 | Landship (44×16) | Cruiser (64×18) | Air cruiser (52×18) |
| 8 | Land dreadnought (64×20) | Battleship (88×24) | Sky fortress (72×24) |

Grid sizes are in 0.5 m cells.

**Drones**
- Drones are smaller than every class and have no captain.
- They are designed on a small grid with a part limit set by the drone computer: I = 8×4 grid, 6 parts; II = 10×5, 10 parts; III = 12×6, 16 parts.
- They are carried and launched by carriers (§10.5).

**Missiles**
- Missiles are designed from missile parts in three sizes: small (6×1), medium (10×2) and large (16×3).
- They are stored as items in magazines.
- Large missiles can carry smaller missiles as cluster payloads.

## 6. Moving on the map

- **Speed:** a fleet moves at the speed of its slowest ship, adjusted for terrain, roads, weather and cargo load.
- **Fuel:** every ship burns fuel from its own tanks as it travels (08 §8).
  - Ships can share fuel inside a fleet, and fleets can transfer fuel when they meet.
  - A fleet with no fuel is **stranded**: it crawls at 10% speed on land and sea, and air fleets cannot move.
- **Detection:** fleets see as far as their sensors reach. Radar, optics, spotting balloons and airship altitude all add range.
  - Enemy fleets appear as contacts: first their size, then their class once closer.
- **Contact:** hostile fleets that come within engagement range trigger a battle choice (§10.1).

## 7. Settlements

### 7.1 Types and upgrade paths

- **Village** → **City** → **Metropolis**
- **Village** → **Fort** → **Citadel**

Upgrades need wood, metal, electronics and money delivered to that settlement's warehouse, plus build time (08 §7).

| | Village | City | Metropolis | Fort | Citadel |
|---|---|---|---|---|---|
| Produces | Wood, metal, money | More wood, metal, money | Most wood, metal, money, plus electronics | Nothing (costs upkeep) | Nothing (costs upkeep) |
| Fuel and ammo market | ✔ | ✔ | ✔ | ✔ | ✔ |
| Resource market (wood, metal, electronics, scrap) | Small | ✔ | ✔ | Small | ✔ |
| Crafts parts | | Tier 0–2 | All tiers | | |
| Refines scrap → electronics | | ✔ | ✔ (better rate) | | |
| Builds ships (yard) | | Classes 1–2 | All classes | | |
| Repairs | Slow | ✔ | ✔ | Fast | Fast |
| Recruits captains with ships | | | | Levels 1–4 (small and medium ships) | Levels 3–8 (big ships) |
| Recruits admirals | | | | Levels 1–2 | Levels 1–5 |
| Recruits quartermasters | | ✔ | ✔ | | |
| Research | | Tier 1–2 | Tier 3–4 | | |
| Walls and emplacement slots | None | Light walls, 2 slots | City walls, 4 | Strong walls, 4 | Fortress walls, 8 |
| Garrison limit (ships) | 2 | 4 | 6 | 8 | 12 |

"Class 1–2" means tank, corvette, gunship, behemoth, destroyer and air frigate.

**Warehouses**
- Each settlement's production goes into **its own warehouse**, which has a capacity.
- When the warehouse is full, production of that resource stops.
- Money goes straight to your treasury.

**Emplacements**
- These are weapon parts you install in wall slots, taken from that settlement's warehouse.
- They fire in siege battles.

**Garrison**
- The garrison is made up of the captains and ships you leave at a settlement, plus a few militia ships by settlement type.

### 7.2 Ownership

- **Capture** a settlement by siege (§11).
- **Neutral villages** can also be bought: a charter costs money and reputation with nearby factions.
- **Captured settlements** keep their buildings. Production restarts after 2 days, and half their warehouse can be plundered into your holds.
- **Every faction has a capital** (a metropolis or citadel).

## 8. Resources and logistics

### 8.1 Resources

| Resource | Where it comes from | Where it is kept |
|---|---|---|
| **Money** | Settlement income, sales, plunder, bounties | **Universal treasury.** Usable by every fleet at once. |
| **Wood, metal** | Villages, cities, metropolises | Warehouses and fleet holds |
| **Electronics** | Refining scrap (city, metropolis), or produced directly by metropolises | Warehouses and fleet holds |
| **Scrap** | Salvage from battles, scrap fields | Warehouses and fleet holds |
| **Fuel, ammo** | Bought at any settlement | Ships' tanks and magazines, plus cargo |
| **Parts** (items) | Crafted, salvaged, recovered | Warehouses and fleet holds |
| **Missiles, drones** (items) | Crafted, or built in battle by fabricators | Magazines, hangars, holds |

- Everything except money is **physical**: it exists in one place and takes cargo space.
- To craft at a city, the materials must be in that city's warehouse or in the hold of a fleet docked there.

### 8.2 What fleets consume

- **Fuel:** for map travel and in battle.
- **Ammo:** for guns. Flamethrowers burn fuel. Missiles and drones are items. Lasers and plasma use power and produce heat instead of ammo.
- **Wood, metal and electronics:** for field repairs.
- **Replacement parts:** needed when a part is destroyed.
- **Money:** officers' wages and settlement upkeep, paid daily.

### 8.3 Supply ships

- Support ships carry the logistics. These are cargo trucks, tankers, supply ships, supply airships, repair and workshop ships, and salvage ships.
- A combat fleet with no support ships is fast, but it runs dry.

### 8.4 Convoys and supply routes

**Quartermasters** lead convoys: fleets of support ships plus a small escort (up to 2 combat ships).

**Standing supply route**, which runs automatically:
1. Load at settlement A.
2. Deliver to settlement B, or to a named fleet (meeting it wherever it is).
3. Return.
4. Repeat.

Convoys are visible and can be raided. Protecting them is part of the war.

### 8.5 Running dry

| Out of | Effect |
|---|---|
| Fuel | Stranded; can't enter battle as a mover. Air fleets can't take off. |
| Ammo | Guns silent. Energy weapons and missiles still work. |
| Repair materials | No field repairs. |
| Money | Wages unpaid: captain morale falls, and after 3 days captains may desert. Upkeep unpaid: settlement services stop. |

A fleet can win a battle and still have to limp home. That is intended.

## 9. Parts: getting, swapping, upgrading

- **Crafting:** at cities (tier 0–2) and metropolises (all tiers). Parts must be unlocked in the tech tree or your faction's list. Crafting costs resources, money and time, and has a queue.
- **Salvage:** after a battle you win, you recover a *portion* of the enemy's destroyed parts as damaged items, plus scrap. The rates are deliberately too low to sustain a campaign (08 §9).
- **Swapping (refit):**
  - Change a ship's parts at a city or metropolis yard, or in the field with a workshop ship (small parts only).
  - Removed parts go back into the warehouse or hold.
- **Upgrades (Mk II, Mk III):** paid at a workshop. Each mark offers two different directions to choose from, not a straight improvement.
- **Condition:** parts wear with use, and salvaged parts arrive worn. Worn parts break down more often.
- **Designs:**
  - Designs and marks live in the Drafting Office (the designer).
  - Saving a changed design makes the next mark.
  - Ships in service keep their mark until refitted.

## 10. Battles

### 10.1 Starting a battle

When fleets make contact, or a siege begins, a pre-battle card shows:
- both sides' forces, as far as they've been spotted
- the battlefield type and the weather

**Choices:**
- **Fight.**
- **Auto-resolve:** the same combat rules run headless.
- **Retreat:** only if your slowest ship is faster than their fastest pursuer. Otherwise the retreat costs you the rearmost ships.

### 10.2 Battlefields and who can fight

Side view, landscape, generated from the location.

| Where | Who can deploy |
|---|---|
| Inland (plains, forest, hills, desert, snow, ruins) | Land and air |
| Open sea | Sea and air |
| Coast | Land, sea and air |
| Settlement (siege) | Depends on the settlement's position (coastal or inland) |

- Every fleet (on both sides) within reinforcement range joins in.
- Your roster is every ship of an allowed domain from those fleets.
- Ships of domains that can't fight in that place stay out.

### 10.3 Three on the field

- **Line-up:** each side has at most **3 ships on the field**. The rest wait in reserve, in the order you choose before the battle.
- **Pull back:**
  - The ship drives off the rear edge, and stays targetable until it leaves.
  - It then returns to reserve.
  - The next ship in line enters from the rear edge 5 s later.
- **Destroyed ships** are replaced from reserve in the same way.
- **Repairs in reserve:** reserve ships repair slowly if a ship in reserve carries a repair bay.
- **Win condition:** the battle ends when one side has no ships left (on the field or in reserve), or it retreats.

### 10.4 Control and orders

- **Driving:** you drive **one** of your three on-field ships (the flagship by default) and can switch at any time.
- **AI ships** are driven by their captains. Their skill depends on captain level.
- **Orders** to any of your on-field ships:
  - Move to point
  - Fire at point or target
  - Hold
  - Pull back
  - Utility: drop flares, drop smoke, launch drones, release a clamp

### 10.5 Carriers, drones, missiles, fabricators

**Drones**
- **Launching:** drones launch from **hangar** parts. The **drone computer** (tier I–III) sets how many drones can fly at once and how big each drone design can be.
- **Drone orders:** attack a target, defend the carrier, scout.
- **Losing drones:** drones are lost if their carrier is destroyed or leaves the field. They can be rebuilt in battle by fabricators, or crafted at cities.
- **Field limit:** drones don't count towards the 3-ship limit.

**Missiles**
- Missiles fire from racks and VLS launchers.
- **Guidance:** unguided, radar or heat seeking; laser guidance comes later. Flares and ECM can defeat guidance.
- **Warheads:**

  | Warhead | Effect |
  |---|---|
  | High explosive (HE) | Blast damage |
  | Napalm | Burning area; sets parts on fire |
  | Acid | Armour corrodes over time |
  | EMP | Electronics, turrets and drones stop working for a few seconds |
  | Cluster | Splits into small missiles |

**Fabricators**
- Fabricators build missiles, drones or ammo **during battle**, using the ship's own metal and electronics.

**Release clamps**
- These hold a detachable section: a drone, a bomb, or a whole module.
- When released, the section becomes its own unit, guided by its drone computer if it has one; otherwise it falls free.
- This makes missile barges, parasite fighters and drop-ship designs possible.

### 10.6 Damage and aftermath

- **Damage:** per part, physical, and it persists (as in v1): engines, weapons, lift, sensors, fires, flooding and falling airships.
- **Destroyed ships** are gone. Their captain survives 60% of the time and returns unassigned; otherwise the captain is lost.
- **Experience:** XP goes to captains, admirals and the Grand Admiral.
- **Salvage and plunder:** the winner holds the field and gets salvage (§9), plus plunder in sieges.

## 11. Sieges

- **Attacking** a settlement starts a siege battle. The battlefield is placed by the settlement's position.
- **Defenders:**
  - wall sections, which are static and destructible
  - wall emplacements (weapon parts installed in slots)
  - the gatehouse or keep
  - garrison ships, rotating 3 at a time
  - defence bonuses by type (08 §7)
- **Winning:** destroy the garrison (on the field and in reserve), or destroy the keep.
- **Losing:** a failed siege leaves the settlement damaged. Walls and emplacements repair over days.

## 12. Progression

- **Captains:** levels 1–10. Level unlocks class access at 1, 3, 5 and 8, and improves AI accuracy and reactions.
- **Admirals:** levels 1–10. Level sets fleet size (3 → 11) and flagship class.
- **Grand Admiral:**
  - levels 1–30
  - each level gives Command Points
  - Command Points unlock **tech nodes** (together with money, electronics and research at a city or metropolis) and **perks**
- **Tech tiers:**

  | Tier | Name | Contents |
  |---|---|---|
  | T0 | Timber and iron | Start |
  | T1 | Iron and steel | Steel hulls, diesel engines, tracks, rubber wheels |
  | T2 | Heavy industry | Heavy guns, lift engines, rockets, flamethrowers, radar |
  | T3 | Advanced | Missiles, drones, fabricators, composites, ECM |
  | T4 | Precursor | Lasers, plasma, EMP, levitators, Precursor plating |

Full tree and perks: 08 §11–12.

## 13. The AI factions

- AI factions:
  - grow their settlements
  - run convoys
  - hunt weak or stranded fleets
  - besiege where they are strong
  - build ships from their own faction designs within their tech level
- Personalities per faction are in 09.
- **Later (Part 5):** AI factions adapt their designs to counter what you field most.

## 14. Winning and losing

- **Win:** take every rival capital, or hold 60% of all settlements.
- **Grand Admiral's flagship destroyed:** you escape to your nearest settlement, losing 20% of your money and 10% of your XP towards the next level.
- **Lose:** when you have no settlements and no fleets left.

## 15. Battle Simulator

This replaces the v1 Proving Ground. You can:
- pick designs from your library
- pick a battlefield and an enemy force by tier
- fight straight away, with no campaign consequences

It is also the test range for the Drafting Office.

**Optional later:** "Gauntlet", an endless ladder of battles with lives and score.

## 16. Rewards and joy

- **Floating text** for hits ("Penetrated", "Engine knocked out", "+150"), and combo multipliers.
- **Battle-won card:** salvage reveal, XP bars filling, and medals.
- **Captured-settlement ceremony:** the flag changes and a fanfare plays.
- **Captured blueprints:** recovered enemy parts can be reverse-engineered at a metropolis to unlock that family. Captured blueprints make up the title-screen gallery.
- **Medals and war journal** entries for feats.
