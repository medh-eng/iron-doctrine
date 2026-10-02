# Iron Doctrine: factions

All five factions are original. Scheme ids match `src/parts/paints.json`. Every bonus is paired with a real weakness (08 §14). Signature parts are made in batch G of the roster, with `unlock: {"faction": id}`. A faction has its own signature parts once it has researched that part family (none needed if the family has a tier 0 part); other factions only by reverse-engineering a salvaged one (the part itself, not its family).

## Map layout

| Position | Territory |
|---|---|
| North | Lumen Collective, on ice and tundra |
| North-east | Skyreach Concord, in mountains and high plateaus |
| Centre | Directorate, on plains and ore hills |
| South-west | Harbour League, on coasts and an archipelago |
| South-east | Salvage Clans, in desert and Precursor ruins |

- Neutral villages fill the gaps between them.
- Each capital sits deep in its home territory.
- Every faction has at least one coastal settlement, so all three domains matter for everyone.

## 1. Harbour League (`league`)

- **Identity:** a merchant republic of port cities. They rule by trade and sea lanes.
- **Capital:** Saltmarch, a coastal metropolis.
- **Strengths:**
  - sea ships +10% speed
  - fuel and ammo −15% at their own settlements
  - cargo parts +10% capacity
  - coastal money +10% (on top of the biome bonus)
- **Weaknesses:**
  - land parts (wheels, tracks, land armour) cost +10%
  - forts start with 1 fewer emplacement slot
- **Look:**
  - steel blue, cream and signal yellow
  - brass fittings, portholes, clean naval lines, pennant stripes
  - tidy rivet rows
- **Signature parts:**
  - *Clipper hull* (sea material): lighter, faster, less armour
  - *Convoy hold*: large capacity, fragile
- **AI:**
  - defends trade
  - runs many convoys
  - prefers naval battles
  - buys neutral villages instead of taking them by force (6a: 350 a village within reach; it saves for the next one instead of building)
- **Music motif:** a bugle over a sea-shanty rhythm.

## 2. Directorate (`directorate`)

- **Identity:** an industrial state of foundry cities, driven by quotas and armour.
- **Capital:** Forge Primus, an inland metropolis.
- **Strengths:**
  - armour materials and tracks −15% cost
  - metal production +20%
  - the heavy-gun tech node (guns_heavy) costs 1 CP less
- **Weaknesses:**
  - fuel +15% price everywhere
  - their airships' envelopes give −10% lift
  - villages produce −20% wood
- **Look:**
  - oxblood, gunmetal and ochre
  - slab armour, heavy rivets, angular silhouettes
  - smokestacks, hazard chevrons
- **Signature parts:**
  - *Slab armour* (material): cheap, very heavy
  - *Foundry boiler*: a cheap, heavy, strong engine
- **AI:**
  - pushes along roads with land fleets
  - besieges forts early
  - accepts losses
- **Music motif:** anvil strikes with low brass.

## 3. Skyreach Concord (`skyreach`)

- **Identity:** the mountain sky-clans, sworn to a shared code.
- **Capital:** Aerie Crown, a citadel on a plateau.
- **Strengths:**
  - lift +15% (envelopes and lift engines)
  - air fleets' map fuel −15%
  - spotting range +20%
- **Weaknesses:**
  - metal production −20%
  - land parts +10% cost
  - fewer villages
- **Look:**
  - ivory, sky blue and gold
  - ribbed envelopes, sail fins, ornamented brass
  - elegant curves
- **Signature parts:**
  - *Sail vane*: free thrust in wind, weak in storms
  - *Crow's nest*: spotting, fragile
- **AI:**
  - raids convoys and stranded fleets
  - fights hit-and-run
  - avoids long sieges
- **Music motif:** an airy flute-like lead in thirds.

## 4. Salvage Clans (`clans`)

- **Identity:** nomad scavenger clans living off the Precursor ruins.
- **Capital:** Rustmoor, a fortress-market citadel.
- **Strengths:**
  - salvage × 1.5
  - refining needs 1 less scrap
  - field repair +25%
  - desert movement without penalty
- **Weaknesses:**
  - their settlements produce −30% wood and metal
  - crafted parts start at 90% condition
  - few metropolises
- **Look:**
  - rust orange, sand and teal
  - patchwork plates in mismatched tones
  - welded scrap, hazard stripes, salvaged Precursor trophies
- **Signature parts:**
  - *Magnet crane*: better salvage, draws power
  - *Patchwork plate* (material): cheap, varied, unreliable
- **AI:**
  - opportunistic: attacks damaged fleets and convoys
  - takes the salvage and runs
- **Music motif:** a hand-drum groove with detuned brass.

## 5. Lumen Collective (`lumen`)

- **Identity:** technocrats in the frozen north who study Precursor relics.
- **Capital:** Glasshold, a metropolis.
- **Strengths:**
  - electronics production +40%
  - T4 energy nodes cost 30% fewer CP
  - the lasers node can be researched at T3
  - radar and ECM effect +15%
- **Weaknesses:**
  - small territory
  - captain wages +25%
  - wood production −30%
  - early armour is expensive (T1–T2 armour materials +15% cost)
- **Look:**
  - dark slate with a teal glow
  - smooth alloy panels, few rivets, glowing emitters
  - Precursor line patterns
- **Signature parts:**
  - *Prism laser*: split beam, short range
  - *Capacitor spine*: an energy buffer, and explosive when hit
- **AI:**
  - defends until strong
  - rushes technology
  - dangerous late in the game
- **Music motif:** glassy FM bells over strings.

## Relations

- **The player** starts at war with the two nearest factions and in **truce** with the other two. A truce allows trade but no attacks.
- **AI factions** start at war with each other, except one seeded pair in truce.
- **Signature parts at work (v0.6.8):**
  - Clipper hull, Slab armour and Patchwork plate (materials) are available only to their own faction.
  - Patchwork plate: each cell's armour and hit points are the material's × 0.6, 0.8, 1, 1.2 or 1.4, fixed by the cell's position.
  - Sail vane: 60 kW of propeller power from the wind for an airship, with no engine or fuel (an airship may fly on vanes alone); in rain the wind gives 1.5× and each vane loses 0.5 hp a second.
  - Magnet crane: counts as a salvage crane, and salvage is × 1.25 with one in the winning fleets.
  - The AI factions build their own tier 1–2 designs (batches L1/L2) half the time once their tech tier allows; they're refitted like the others, and offered in your Drafting Office for your faction once their parts are researched.
- Truces can break when territory is contested for long (Part 5).
- **As built (6c, numbers in `REL`, 07_data):**
  - Reputation runs −100 to 100: −20 with factions at war, +20 in truce at the start, drifting 0.5 a day back towards 0.
  - Beating a faction's fleet: −4 (−10 if it was a trade convoy), and +2 with every faction at war with it. Capturing its settlement: −25. A charter: −8 with each faction with a settlement within 15 cells.
  - Offer a truce at reputation −30 or more, 5 days after your last battle with them, for a tribute of 300 + 40 per settlement they hold (+10 reputation). Declaring war: −20.
  - They offer you a truce at +30. They break a truce at −50, or after 20 days of contested border (a settlement of each within 8 cells) while your reputation is below 0; the count falls 0.5 a day when the border is quiet.
  - AI factions every 10 days: a truce with a contested border for 20 days breaks with 50% chance; a pair at war makes a truce with 8% chance (3% if their border is contested).
- **Reputation** with each faction moves with:
  - charters bought near their land (a charter costs 500)
  - convoys raided
  - settlements captured
