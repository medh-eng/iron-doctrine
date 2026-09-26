# Iron Doctrine: factions

All five factions are original. Scheme ids match `src/parts/paints.json`. Every bonus is paired with a real weakness (08 §14). Signature parts are made in batch G of the roster, with `unlock: {"faction": id}`.

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
  - buys neutral villages instead of taking them by force
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
- Truces can break when territory is contested for long (Part 5).
- **Reputation** with each faction moves with:
  - charters bought near their land
  - convoys raided
  - settlements captured
