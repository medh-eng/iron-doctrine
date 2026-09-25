# Iron Doctrine: art and audio

## 1. Art direction

The game lives on a commander's war-room table:

- **Campaign map:** a linen staff map marked in grease pencil.
- **Overlays** (HUD, drawers, thumb controls): smoked acetate film with hand-drawn grease-pencil marks, so the world always shows through.
- **Drafting Office:** a cyanotype blueprint.
- **Battlefield:** the one bold element. Dark layered silhouettes against a dusk sky, lit by amber tracers, muzzle flashes and fire. Everything around it stays quiet and disciplined.

## 2. Palette

### 2.1 Core

| Name | Hex | Use |
|---|---|---|
| Linen | #E6DCC3 | Map paper, light panels |
| Staff ink | #22303F | Text on linen, contours, outlines |
| League blue | #2E6DB4 | Player faction |
| Directorate red | #C43C2C | Enemy faction |
| Tracer amber | #FFB23E | Fire, highlights, pressed controls, rewards |
| Cyanotype | #13466B | Drafting Office background |

### 2.2 Supporting

**Battle**
- **Dusk sky gradient:** #2F2946 (top) → #8A4B5A → #D9855A → #F2C17A (horizon).
  - Night: #0F1424 → #27324A.
  - Rain: desaturate 40%.
- **Silhouette layers:** far #3B3F52, mid #2A2D3B, near ground #1A1C24. Ground edge highlight #4A4F63.
- **Water:** surface #2B4A5E, fading with depth to #0E1B26.

**Overlays**
- **Acetate panel:** rgba(18,24,32,0.62) with a 1 px edge of rgba(230,220,195,0.25).

**Drafting Office**
- **Blueprint:** lines #D6EEFF at 85%, grid #2A6A92, valid #7FD3FF, invalid #FF6B5A.

**Map**
- water #A9C1BF
- forest hatching #6E7F5E
- mountain hachures #7A6A55
- desert stipple #CDB27E
- roads in staff ink; rail in staff ink with ties
- territory: grease-pencil hatching in each faction colour

**Status colours:** good #7BC47F, warning #E8B04B, danger #E0533D.

## 3. Type

- **Display:** a stencil face, e.g. Saira Stencil One or Big Shoulders Stencil Display (both SIL Open Font License).
  - Get it from npm `@fontsource`, subset to Latin, and embed as base64 woff2 under 45 KB.
  - Use it only for the logo, stamps ("Objective complete", "Level 7") and hull numbers.
- **Everything else:** system condensed sans.
  - `font-family: "Roboto Condensed", "sans-serif-condensed", "Arial Narrow", system-ui, sans-serif`
  - Numbers use `font-variant-numeric: tabular-nums`.
- **Scale** (CSS px at 360 px screen height):

  | Role | Size |
  |---|---|
  | Small | 12 |
  | Body | 14 |
  | Labels and buttons | 16 |
  | Headings | 20 |
  | Stamps | 28 |
  | Logo | 44 |

- **Case:** sentence case for all UI text. Uppercase stencil only in the logo, stamps and hull numbers.
- **Map labels:** region names in condensed italic, staff ink, with a linen halo.

## 4. Drawing the world

**Vehicles**
- Drawn from their part grids. Each part type has a small draw routine:
  - hull plates with panel lines and rivets
  - road wheels with hubs
  - track links that move with distance travelled
  - barrels
  - a rotating radar dish
  - propeller blur
- Faction tint on hull parts; hull number stencilled on.
- Cache each design and damage state to an offscreen canvas. Re-cache only when damage changes.

**Damage states**
- scorched darkening
- smoke puffs from damaged parts
- flames on burning parts
- detached parts become debris bodies that tumble, bounce and fade after 6 s

**Terrain**
- The heightfield is pre-rendered in 256 px chunks. Craters carve the heightfield, and only the affected chunks are re-rendered.
- Three parallax layers are pre-rendered per battle: far ridges or city skyline, mid trees and houses, near grass tufts.
- **Props:**
  - trees break when hit or driven over
  - houses collapse to rubble
  - bunkers, fences and bridges are all destructible

**Infantry**
- 8–10 px figures with a 3-frame run and a crouch-fire pose.
- Bailed-out crews run towards their own side's edge.
- No blood: infantry that are hit go down and fade, or scatter.

**Weather**
- rain streaks (pooled)
- fog as a veil that thickens with distance
- snowflakes
- sandstorm tint
- night: a darkness overlay with light cones from sensors and flares

**Map**
- Drawn to an offscreen canvas at two zoom levels.
- Territory hatching uses jittered grease-pencil strokes, seeded so they don't shimmer.
- Forces are unit counters: rounded rectangles with fictional military symbols.
- Moves are shown as grease-pencil arrows.

## 5. Effects (the joy layer)

| Moment | Effect |
|---|---|
| Firing | 2-frame muzzle flash, smoke puff, recoil kick on the barrel and hull |
| Shells and bullets | Amber tracer lines with glow |
| Penetration | Bright spark cone; floating "Penetrated" plus the part name |
| Ricochet | Spark arc, a ping, floating "Ricochet" |
| High explosive | Flash, ring shockwave, dirt clods, smoke |
| Vehicle destroyed | 50 ms hit-stop, flash, fireball, debris, turret toss, smoke column (max 3 columns at once), floating "Destroyed +300" |
| Floating text | Rises 40 px over 0.9 s and scales from 1.2 to 1.0. Combos ("×2 combo") in amber. At most 8 on screen |
| Screen shake | Trauma model (shake = trauma²), capped at 8 px. Off with reduced motion |
| Level clear | Time slows to 30% for 0.6 s; 80 paper scraps of confetti (linen, blue, amber); the stencil stamp "Objective complete" slams down with a dust puff |

Particles are pooled and capped by quality: 120 (Low), 200 (Medium) or 300 (High).

## 6. Music

All music is generated with the Web Audio API.

### 6.1 Engine

- **Look-ahead scheduler:** a 25 ms `setInterval` schedules notes up to 120 ms ahead on `AudioContext.currentTime`.
- **Routing:** music bus → master compressor.
- **Variation:** motifs are varied with a seeded random generator, so loops aren't obvious.
- **Ducking:** music drops 30% briefly during big explosions.

### 6.2 Instruments (all synthesised)

| Instrument | Recipe |
|---|---|
| Field snare | White noise → bandpass 1.8 kHz, plus a short triangle-wave body; used for rolls and ruffs |
| Timpani | Sine at 60–110 Hz dropping 30% in pitch over 0.3 s, plus a low noise thump |
| Bass drum | Sine sweeping 120 → 45 Hz |
| Brass section | 3 detuned sawtooths → lowpass whose filter opens on the attack; 5 Hz vibrato |
| Low strings | Pairs of sawtooths, slow attack, lowpass 1.2 kHz, light chorus |
| Bugle | Square and sawtooth mix, bright; for fanfares and calls |
| War-room keys | Soft FM electric-piano tone, for the map |
| Telegraph | Short 800 Hz sine blips in Morse-like rhythms, as map ambience |
| Clock tick | Filtered click; plays only while map time runs |

### 6.3 Themes

- **Title:** slow march at 84 bpm in D Dorian. Strings, snare ruffs and a brass motif; hopeful but serious.
- **Map:** 72 bpm in C minor. War-room keys, low strings, telegraph blips and the clock tick; sparse. When enemies come close, timpani pulses join in.
- **Battle:** D natural minor, 100 bpm at intensity 0 rising to 132 bpm. Intensity comes from nearby combat and objective progress. Layers:

  | Intensity | Layers |
  |---|---|
  | 0 | Snare ostinato and string drone |
  | 1 | + bass drum and string ostinato |
  | 2 | + brass motif |
  | 3 | + full brass and timpani rolls |

- **Ladder evolution:** base tempo rises 2 bpm per level (capped at 132), and layers unlock earlier. Every 10 levels the music moves up a tone.
- **Campaign evolution:** as the war score swings, the map theme shifts between hopeful and grim voicings.
- **Victory:** 4-bar bugle fanfare in D major, with a snare roll and cymbal (long-decay noise).
- **Defeat / life lost:** a 2-bar descending minor brass phrase.

## 7. Sound effects

Every action has its own distinct sound.

**UI:** tap (short click), back (lower click), toggle on and off, error buzz.

**Vehicles:**
- engine loop for the vehicle you control: sawtooth plus noise through a lowpass, with pitch and cutoff following throttle and a diesel chug from an LFO
- track clatter (noise bursts that follow speed)
- ship horn
- propeller and rotor loops
- jet whoosh

**Weapons:**
- cannon by calibre (noise burst plus low sine thump; bigger calibres are lower and longer)
- machine-gun bursts (rapid noise ticks)
- autocannon
- artillery: distant boom, then an incoming whistle (descending sine)
- rocket and missile launch (noise swoosh)
- torpedo launch (bubbles and a whirr)
- bomb whistle
- depth-charge thud

**Impacts:**
- ricochet ping (sine at 2.4 kHz with a fast pitch bend)
- penetration clang (metallic FM)
- explosions, small and large: noise plus low sine, with a reverb tail from a short convolver built from noise
- splash
- part-destroyed crunch
- vehicle-destroyed boom
- fire crackle loop (limited number at once)

**Game events:**
- objective progress tick
- combo ding (pitch rises with the combo)
- level-clear fanfare
- life lost
- blueprint captured (sparkly arpeggio plus bugle)
- medal
- order acknowledged (radio squelch and beep)
- time start (clunk, then ticking) and time stop (clunk)
- construction complete (anvil ding)
- supply warning (two-tone alarm)
- low fuel and low ammo beeps

**Mixer:**
- Master bus → compressor, with separate music and sound buses and volumes.
- Sounds pan by screen position and get quieter with distance from the camera.
- At most 24 voices at once; the oldest quiet voice is stolen first.

**Audio lifecycle:** unlock on the first tap. Suspend when the page is hidden; resume when it's visible again and not paused.
