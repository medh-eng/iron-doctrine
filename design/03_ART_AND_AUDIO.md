# Iron Doctrine: art and audio (v2)

Detailed rules for vehicles, parts, materials and paint are in **07_ART_AND_PARTS**. This file covers the overall look, the world map, the UI, effects and audio.

## 1. Art direction

- **Machines:**
  - Drawn with HighFleet's density and precision: crisp side-view silhouettes built from believable industrial detail (plates, rivets, hatches, vents, pipes, stencils, honest wear).
  - Coloured with From the Depths' confidence: every material has its own readable colour, and every faction wears bold, legible paint schemes and camouflage.
- **Battlefields** are bright and atmospheric (clear skies, saturated seas, sunlit dust and haze), so colourful machines read instantly on a phone.
- **Around the battles**, the war room frames everything:
  - a painted topographic world map with a phosphor tactical overlay
  - smoked-acetate UI panels with grease-pencil marks
  - a cyanotype Drafting Office
- **Inspired by, never copied.** No HighFleet or From the Depths assets, names, logos or faction schemes.

## 2. Core palette

Part art uses the full material palette and paint tokens in 07.

| Name | Hex | Use |
|---|---|---|
| Linen | #E6DCC3 | UI text on dark, map paper highlights |
| Staff ink | #22303F | Outlines on map, dark UI text |
| Tracer amber | #FFB23E | Highlights, pressed controls, phosphor readouts, rewards |
| Cyanotype | #13466B | Drafting Office background |
| Acetate panel | rgba(18,24,32,0.62) | All floating panels (1 px edge rgba(230,220,195,0.25)) |
| Good / warning / danger | #7BC47F / #E8B04B / #E0533D | Status only (never used to judge parts) |

Faction colours come from `src/parts/paints.json` (see 09).

## 3. Type

- **Display:** a stencil face, e.g. Saira Stencil One or Big Shoulders Stencil (SIL Open Font License), subset and embedded as base64. Used only for the logo, stamps and hull numbers.
- **UI:** system condensed sans (`"Roboto Condensed", "sans-serif-condensed", "Arial Narrow", system-ui, sans-serif`) with tabular numbers.
- **HUD readouts:** amber phosphor style (#FFB23E on an acetate panel, faint scanlines) for gauges, fuel, ammo and heat.
- **Case:** sentence case for UI text.

## 4. World map

- **Painted topographic map:**
  - Terrain colours in From the Depths brightness: deep blue sea, green lowlands, ochre desert, white ice, grey mountains shaded with hachures.
  - Roads drawn in ink.
- **Settlements:** small painted icons by type (village huts, city blocks, metropolis towers, fort star-walls, citadel keep), with a faction pennant.
- **Territory:** faction-colour grease-pencil hatching at borders.
- **Tactical overlay:** phosphor-green lines for routes, detection circles and fog edges, like a war-room plotting table.
- **Fleets:** unit counters in faction colours with a class silhouette, and a small fuel bar.
- **Weather** drifts over the map as translucent cloud, rain and storm layers.
- **Rendering:** base map pre-rendered in chunks at two zoom levels. Only fleets, weather and overlays are drawn per frame.

## 5. Battlefields

- **Biome palettes and parallax:** see 07 §10.
- **Parallax:** 3 pre-rendered layers, plus the playfield terrain, which craters and can be destroyed.
- **Sea:** a gentle wave line, spray, and a depth fade below the waterline.
- **Sky layer:** clouds that airships can hide in (lower spotting).
- **Sieges:** walls, towers, gatehouse and keep, drawn in the owner's faction style, with emplacement weapons mounted.

## 6. Effects (the joy layer)

| Moment | Effect |
|---|---|
| Kinetic fire | Muzzle flash (2 frames), smoke puff, recoil kick, amber tracers |
| Penetration | Spark cone, floating "Penetrated" plus the part name |
| Ricochet | Spark arc, a ping, floating "Ricochet" |
| High explosive | Flash, ring shockwave, dirt or water column, smoke |
| Flamethrower | Particle stream of orange to smoke; the target part burns with flickering light |
| Laser | Instant beam: white core, faction-tinted glow, heat shimmer at the impact point, glowing scar on the part |
| Plasma | Violet bolts (#B784FF) with a hot core (#FFE08A), splash of molten sparks |
| Missiles | Exhaust trail. Napalm: fire splash and burning ground. Acid: green-yellow drip, armour darkens and pits. EMP: blue arcs, electronics flicker off |
| Flares and smoke | Bright arcing flares with smoke trails; grey smoke walls that block spotting |
| Drones | Small silhouettes with rotor or prop blur; launch puff from the hangar |
| Ship destroyed | 60 ms hit-stop, fireball, parts detach with their own art. Airships fall burning; ships list and sink |
| Level of care | Floating text rises 40 px over 0.9 s; combos in amber; at most 8 on screen |
| Screen shake | Trauma model, capped at 8 px; off with reduced motion |

- **Particle caps** by quality: 120 (Low), 200 (Medium), 300 (High). Everything is pooled.
- **Victory:** time slows for 0.6 s, paper-scrap confetti falls, and the stencil stamp "Victory" slams down.

## 7. Music

All music is generated with the Web Audio API.

- **Engine:** a look-ahead scheduler (25 ms tick, 120 ms ahead on the AudioContext clock), with seeded variation so loops aren't obvious.
- **Instruments** (from v1): field snare, timpani, bass drum, brass section, low strings, bugle, war-room keys, telegraph blips, clock tick.
- **Themes:**
  - **Title:** a slow march.
  - **Map:** sparse war-room keys, strings, telegraph blips; the clock ticks while time runs. Tension rises when enemies are near.
  - **Battle:** four intensity layers (snare → drums and strings → brass → full brass and timpani). Tempo 100–132 bpm.
  - **Victory:** a bugle fanfare. **Defeat:** a falling brass phrase.
- **Faction motifs:** the battle theme takes a short motif from the player's faction:

  | Faction | Motif |
  |---|---|
  | League | Bugle and sea-shanty rhythm |
  | Directorate | Anvil strikes and low brass |
  | Skyreach | Airy flute-like lead in thirds |
  | Clans | Hand-drum groove and detuned brass |
  | Lumen | Glassy FM bells over strings |

- **Evolution:** the music grows with the tech era. T3 and T4 battles add a pulsing synth bass under the orchestra.

## 8. Sound effects

Every action has its own distinct sound.

- **UI:** tap, back, toggle, error.
- **Map:** time start and stop clunk, contact alarm, arrival bell, trade coins, crafting done (anvil), settlement upgraded (fanfare).
- **Engines:**
  - steam: chuff and hiss
  - petrol and diesel: sawtooth chug
  - turbine: whine
  - lift engine: throb
  - reactor: deep hum
  - propellers and rotors
- **Weapons:**
  - swivel gun and light cannon pops
  - cannon booms by calibre
  - machine-gun bursts
  - howitzer boom and incoming whistle
  - flamethrower roar
  - laser zap (a short pure tone with a noise edge)
  - plasma thump-whoosh
  - missile launch hiss
  - drone launch clack
- **Impacts:** ricochet ping, penetration clang, explosions (small and large), splash, part torn off, fire crackle, acid sizzle, EMP crackle.
- **Game events:**
  - order acknowledged (radio squelch and beep)
  - reserve ship arriving (horn)
  - pull back (whistle)
  - salvage reveal
  - level up
  - captain lost (low bell)
- **Mixer:** master, music and sound buses with a compressor. Sounds pan by position. At most 24 voices.
