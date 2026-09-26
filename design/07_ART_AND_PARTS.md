# Iron Doctrine: art and parts (the contract)

This file is shared by the **game repo** and the **Art Foundry** project. `tools/part-lib.mjs` enforces the format rules, so if this file and the tool disagree, fix one of them so they match.

## 1. Direction

**HighFleet precision, From the Depths colour.**

- **Every part** is a crisp side-view machine drawing with dense, believable industrial detail:
  - plates, rivets, weld seams, hatches, grilles, pipes, cables
  - stencilled bands, honest wear
- **Every material** has its own readable colour.
- **Every faction** wears bold paint schemes.
- **Size:** parts must read instantly at phone scale (12–20 px per cell) and still reward a close look at 4× zoom.
- **Originality:** inspired by those games, never copied. Draw original shapes, and don't use names, insignia or schemes from existing games or real nations.

## 2. Part art rules

1. **Scale:** 32 SVG units = 1 cell = 0.5 m. A hatch is about 38 units, rivets are 6–8 units apart, a crew figure is about 56 units tall.
2. **Light:** one key light from the **top-left**:
   - highlights on top and left edges
   - shadow on the bottom and right
   - ambient occlusion where parts meet and in recesses

   Every part uses the same light, so ships assemble seamlessly.
3. **Shading:** a base colour, then white overlays for light and black overlays for shadow (using opacity), plus specular strokes on metal. This keeps shading correct under any paint colour.
4. **Outline:** 1 unit of outline (`#14171B`) around silhouettes. Interior lines are black at 25–35% opacity.
5. **Detail density:**
   - 3–8 readable details per cell
   - nothing thinner than 0.7 units
   - rivet radius at least 0.9
   - details must survive shrinking to 12 px per cell
6. **Wear:** edge chips (steel-highlight strokes), soot and oil grime towards the bottom, rust streaks used sparingly. The look is worked-in, not ruined.
7. **Era language:**

   | Tier | Look |
   |---|---|
   | T0 timber and iron | Planks, iron bands, rope, brass fittings, canvas, riveted iron |
   | T1 iron and steel | Riveted steel plate, cast parts, rubber |
   | T2 heavy industry | Thick slab armour, weld seams, big bolts, pipes, hazard bands |
   | T3 advanced | Smooth welded panels, alloy, cable looms, sensor glass, flush hatches |
   | T4 Precursor | Dark seamless plating, glowing channels (`#4FD1C5`), energy colours (`#FFE08A`, `#B784FF`), no rivets |

8. **Variants look different.** A long barrel, twin exhausts, extra plates or cooling jackets should let a player recognise a variant at a glance.
9. **Markings** are drawn as shapes (bands, chevrons, stripes) in the P3 accent colour. No `<text>`: the game adds hull numbers itself.
10. **Faction flavour** comes from paint schemes and signature parts (09). Standard parts stay faction-neutral.

## 3. Paint

### 3.1 Paint tokens

Paintable surfaces use the tokens below. The game swaps the tokens for real colours.

| Token | Role | Where |
|---|---|---|
| `#FF00FF` | P1 primary | Large painted surfaces |
| `#00FFFF` | P2 secondary | Panels, trims, roofs, envelopes |
| `#FFFF00` | P3 accent | Bands, stripes, identification marks |

- Working metal stays unpainted: barrels' muzzle brakes, tracks, exhausts, springs, glass, brass.
- Put shading overlays **on top** of the token shapes.

### 3.2 Schemes

Faction schemes are in `src/parts/paints.json`:

| Scheme | Faction |
|---|---|
| league | Harbour League |
| directorate | Directorate |
| skyreach | Skyreach Concord |
| clans | Salvage Clans |
| lumen | Lumen Collective |
| primer | Unpainted stock |

- **Paint shop:** a 24-colour palette the player can use for P1, P2 and P3.
- **Camouflage:** `none`, `bands`, `blotch`, `splinter`, `stripes`.
  - It is drawn by the game over P1 and P2 regions only, using the `class="paint"` shapes as the mask.
  - P3 accents stay on top.

## 4. Structure looks (auto-tiled cells)

Hull and armour cells are **not** SVG files. The game draws them from `materials.json` → `look`:

| `look` field | Meaning |
|---|---|
| `kind` | Pattern style (table below) |
| `color` | Bare colour |
| `paintable`, `paint` | Whether it takes paint, and which token (p1 or p2) |
| `rivets` | Rivet rows along the outside edges |
| `seam` | Panel-line spacing in cells |

| `kind` | Look |
|---|---|
| wood | Plank lines and nail dots. With `rivets`: iron bands |
| plate | Riveted steel panels |
| heavy | Thick bevel, big rivets |
| composite | Layered edges, no rivets |
| alloy | Smooth panels, fine seams |
| envelope | Ribbed gas cells |
| frame | Open lattice |
| precursor | Dark seamless panels with glow channels |

**Auto-tiling rules:**
- **Outside edges:** outline, plus a bevel (light top and left, dark bottom and right). Rivets go along outside edges when `rivets` is on.
- **Between cells:**
  - different materials: always a seam
  - same material: a seam every `seam` cells
- **Whole shape:** a vertical light-to-dark overlay over the combined structure.
- **Slopes:** cells with `shape: "slope"` are triangles.

  | `o` | Filled half |
  |---|---|
  | 0 | Bottom-left |
  | 1 | Bottom-right |
  | 2 | Top-left |
  | 3 | Top-right |

The reference implementation is `tools/part-render.js`. The game ports it as `05b_partrender.js`.

## 5. SVG format (component parts)

### 5.1 Skeleton

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="X Y W H" data-part="<id>" data-cell="32">
  <defs> gradients, clipPaths (ids unique in the file) </defs>
  <g id="barrel" data-role="barrel" data-pivot="x y">   <!-- moving group, optional -->
    <g class="paint"> token-coloured shapes </g>
    <g class="detail"> shading, rivets, bare metal, markings </g>
  </g>
  <g id="body">                                           <!-- required -->
    <g class="paint"> ... </g>
    <g class="detail"> ... </g>
  </g>
</svg>
```

### 5.2 Rules

- **viewBox** = `-(overhang.left×32) -(overhang.top×32) (w+left+right)×32 (h+top+bottom)×32`, so the footprint always sits at 0,0.
- **`<g id="body">`** is required. It holds the static art.
- **Moving groups:** write `<g id="NAME" data-role="ROLE" data-pivot="x y">` **with the attributes in exactly this order**.
  - Roles: `barrel`, `turret`, `wheel`, `rotor`, `prop`, `radar`, `track`, `door`.
  - The pivot is in SVG units.
  - The group ids must match the keys of the JSON `moving` object.
- **Draw order is document order.** Put groups that sit behind the body first.
- **Layers:**
  - `class="paint"` holds only token-coloured base shapes.
  - `class="detail"` holds everything else.
  - A part with no paint (bare metal) may skip `paint`; the checker gives a warning.
- **Colours:** only the palette in `tools/part-lib.mjs`, plus the tokens. Write them as 6-digit hex. Use white or black with opacity for overlays.

  **Palette:**

  | Group | Colours |
  |---|---|
  | Outline and steel | outline #14171B, steel_dark #2E3339, gunmetal #3A3F45, steel_lo #4F565E, steel #8A9199, steel_hi #C4CAD0 |
  | Heavy and alloy | heavy #4A4E55, heavy_hi #6B7079, alloy #B7C3CF, alloy_lo #8E9BA8 |
  | Rubber and metals | rubber #23201E, rubber_hi #4A4540, brass #C9A04A, brass_lo #8A6A2A, copper #B8733F |
  | Glass | glass #7FB7C9, glass_hi #D8F0F7 |
  | Wood | wood #A8743F, wood_lo #6E4A26, wood_hi #CF9D63, wood_dark #8E6035 |
  | Canvas | canvas #B9A77A, canvas_lo #857650, canvas_hi #D8CCAA |
  | Rust and grime | rust #9A4E2A, rust_hi #C2713D, oil #1B1712, soot #2A2622 |
  | Precursor and energy | precursor #2B3440, precursor_glow #4FD1C5, energy_hot #FFE08A, plasma #B784FF |
  | Lamps | lamp_amber #FFB23E, lamp_red #E0533D, lamp_green #7BC47F |
  | Overlays | #FFFFFF, #000000 |

- **Not allowed:**
  - `<image>`, `<text>`, `<script>`, `<foreignObject>`, `<filter>`, `<style>`
  - event handlers
  - external `href` or `url()` (local `#id` references only)
- **Gradients:** at most 5 stops.
- **File size:**
  - at most 16 KB (footprint area under 12 cells)
  - at most 28 KB (area 12 cells or more)

## 6. How the game renders parts

1. **Paint:** replace the tokens in the SVG text with the ship's colours.
2. **Rasterise** each group (the body, and each moving group) to an offscreen canvas at the needed scale. Cache it by part + paint + scale.
3. **Camouflage:** draw the pattern clipped to the `class="paint"` shapes, then draw the detail on top.
4. **Damage:**
   - scorch overlay by damage fraction
   - holes (dark with a hot rim) where penetrations happened
   - fire and smoke from `anchors.smoke`
   - destroyed parts detach as debris sprites
5. **Moving groups** are drawn with rotation around `data-pivot`: barrel elevation, spinning wheels and rotors, turning radar.
6. **Composition:** structure cells (§4) first, then parts in list order. `f: 1` mirrors a part around its footprint centre.

## 7. Part JSON

```json
{
  "id": "wpn_c75_std",              // = file name; prefix by category (05 conventions)
  "name": "75 mm cannon",
  "family": "c75", "variant": "std",
  "category": "weapon",             // mobility|lift|weapon|missile|system|logistics|crew|special = folder name
  "tier": 1,                        // 0–4
  "domains": ["land","sea","air"],  // land|sea|air|drone|missile
  "footprint": {"w": 3, "h": 1},
  "overhang": {"left": 0, "right": 1.5, "top": 0, "bottom": 0},
  "mount": "turret_or_hull", "layer": "front",
  "anchors": {"mount": [0.5, 0.5], "muzzle": [4.5, 0.5], "smoke": [[1.0, 0.25]]},
  "moving": {"barrel": {"pivot": [0.94, 0.5], "elevation": [-8, 20]}},
  "stats": {"mass": 600, "hp": 60, "armor": 10, "pen": 90, "damage": 110, "reload": 5, "range": 2000,
            "accuracy": 0.8, "heat": 2, "crew": 1, "reliability": 0.997},
  "damageType": "kinetic", "ammo": "shell_m",
  "cost": {"metal": 7, "money": 60},  // keys: wood metal elec scrap money
  "craftAt": "city",                  // city | metropolis
  "unlock": {"tech": "guns_medium"},  // or {"start": true} | {"faction": "league"} | {"salvage": true}
  "pros": [], "cons": [],             // required non-empty for variants (not "std")
  "upgrades": [ {"mark": 2, "options": [ {...}, {...} ]}, {"mark": 3, "options": [ ... ]} ],
  "notes": ""
}
```

- **Stats** must be numbers. `mass` and `hp` are required.
- **Stat names per category** are the ones the balance tool weighs (08 §2). Use `draw` for power consumed.
- **Anchors and pivots** are in cells, relative to the footprint's top-left. They must lie inside the drawing area.
- **Upgrade option format:**

  ```json
  {"id", "name", "mods": {stat: multiplier}, "adds": {stat: amount}, "cost": {...}}
  ```

  - A `reliability` multiplier divides the failure rate. Below 1 means less reliable.
  - Mk 3 options are totals relative to Mk 1.
  - Offer **two options per mark**: branches, not a ladder.
- **`balanceNote`:** a string that explains a deliberate outlier. It silences that balance warning.

## 8. Vehicle designs (`src/vehicles/<id>.json`)

```json
{
  "id": "league_tank_t0", "name": "Harbour tank", "domain": "land", "class": "tank",
  "faction": "league", "mark": 1, "paint": {"scheme": "league", "camo": "none"},
  "cells": [ {"m": "ironwood", "x": 1, "y": 4, "w": 8, "h": 2}, {"m": "slope40", "x": 9, "y": 4, "o": 0} ],
  "parts": [ {"p": "wpn_c37_std", "x": 6, "y": 3}, {"p": "mob_wheel_wood_std", "x": 1, "y": 6, "f": 0} ]
}
```

- **`cells`:** structure materials. `w` and `h` fill a rectangle; `o` is the slope orientation.
- **`parts`:** components at their footprint's top-left cell.
- **The checker enforces:**
  - class grid limits
  - part count
  - no overlaps
  - known materials and parts
- **Missiles** use `domain: "missile"` and classes `missile_s`, `missile_m` or `missile_l`.
- **Drones** use `domain: "drone"` and classes `drone_1`, `drone_2` or `drone_3`.

## 9. Delivery and checks

- **Foundry zips:** the Art Foundry delivers `foundry-<short-name>.zip`. It contains repo paths only:
  - `src/parts/<category>/<id>.json` + `.svg`
  - `src/vehicles/<id>.json`
  - `src/parts/materials.json` or `paints.json`, only when they change
- **Before delivery:**
  - `node tools/check-parts.mjs` shows no errors
  - balance warnings are either fixed or explained with `balanceNote`
  - `node tools/preview-parts.mjs --part <id>` (and `--vehicle <id>`) has been reviewed
- **The repo** integrates zips as described in CLAUDE.md.

## 10. Battlefield palettes

| Biome | Sky (top → horizon) | Ground | Notes |
|---|---|---|---|
| Temperate day | #4F86C6 → #BFDDF2 | #5E7F3A / #3F5A2A | White cumulus |
| Desert | #6FA6D8 → #F2D9A8 | #C9A26A / #9A7446 | Heat haze, dust |
| Snow | #7FA9CF → #E6EEF5 | #E9EEF2 / #9FB0BF | Cold light |
| Coast and sea | #3F7FC0 → #CFE6F5 | Sea #1F5F8F / #0E2F4A | Spray, gulls |
| Ruins | #6D8FB0 → #DCCFB8 | #7D766A / #4E4A44 | Precursor glints |
| Dusk | #2F2946 → #F2C17A | #2A2D3B | Warm rim light |
| Night | #0F1424 → #27324A | #151822 | Lamps and lights glow |
| Storm | #3A4450 → #7E8A94 | Desaturated 30% | Rain streaks |

- **Distant layers:** lighter and bluer, with less contrast (atmospheric perspective).
- **Machines:** keep full saturation, so they stand out.

## 11. QA checklist (every part)

- [ ] Silhouette reads at 12 px per cell. Function is clear (gun, engine, lift, sensor).
- [ ] Light from the top-left, consistent with the golden sample.
- [ ] Paint tokens only on paintable surfaces; working metal left bare.
- [ ] 3–8 details per cell; nothing thinner than 0.7 units; outline present.
- [ ] Moving groups: pivots sit where the part really pivots; the barrel pivot is inside its mount.
- [ ] Variant differences are visible. Era language matches the tier.
- [ ] Looks right in league, directorate and primer schemes.
- [ ] Checker clean; file size within the limit.

## 12. Golden sample

`src/parts/weapon/wpn_c75_std.svg` + `.json` is the reference for style, structure and format. Match its level of detail and its lighting.
