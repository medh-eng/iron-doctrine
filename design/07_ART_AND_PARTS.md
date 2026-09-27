# Iron Doctrine: art and parts (the contract, v2.1)

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

The reference implementation is `tools/part-render.js`. The game ports it as `05c_partrender.js`.

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

1. **Paint:** replace the tokens in the SVG text with the side's colours. Until factions arrive, the player side uses `league` and the enemy uses `directorate`.
2. **Rasterise** the body, and each moving group separately (for now only the barrel moves; other moving groups are drawn into the body), to offscreen images at 64 px per cell. The game then draws them through the same path as the old PNG route (`05b_art.js`), so sprite caching and damage overlays are unchanged.
3. **Order of preference:** SVG art first, then the legacy PNG route, then the code drawing in `drawPart()`.
4. **Barrels:**
   - The barrel image rotates about `moving.barrel.pivot`.
   - Shells and muzzle flashes start at `anchors.muzzle`.
   - The distance from pivot to muzzle is that part's barrel length. The game doesn't stretch SVG barrels.
5. **Damage:** unchanged from v1 (scorch, holes, fire, detached debris using the same image).
6. **Structure cells** (materials) are auto-tiled (§4).
7. **Flipping:** `f: 1` mirrors a part around its footprint centre. Enemy vehicles are drawn mirrored as a whole, as in v1.

## 7. Part JSON (`src/parts/<category>/<id>.json`)

```json
{
  "id": "c75", "name": "Cannon 75 mm", "family": "c75", "variant": "std",
  "category": "weapon",               // structure|mobility|lift|weapon|missile|system|logistics|special = folder
  "tier": 1,                          // 0–4
  "domains": ["land","sea","airship","aircraft","wall"],
  "footprint": {"w": 3, "h": 1},      // must equal the game's footprint for existing parts
  "overhang": {"left": 0, "right": 1.5, "top": 0, "bottom": 0},
  "anchors": {"muzzle": [4.5, 0.5], "smoke": [[1, 0.25]]},
  "moving": {"barrel": {"pivot": [0.94, 0.5], "elevation": [-8, 20]}},
  "stats": {"mass": 600, "hp": 60, "armor": 10, "power": 0, "rel": 0.998, "pen": 90, "reload": 5,
            "range": 2000, "vel": 165, "dmg": 95, "spread": 0.5, "cal": 75, "shells": 30, "burst": 55,
            "burstR": 1.6, "heDmg": 70, "heRadius": 3},
  "behaviour": {},                    // words and on/off flags, e.g. {"auto": true, "aa": true}
  "cost": {"metal": 7},               // keys: wood metal elec scrap money
  "craftAt": "city",                  // city | metropolis
  "unlock": {"tech": "guns_medium"},  // or {"start": true} | {"faction": "league"} | {"salvage": true}
  "pros": [], "cons": [],             // required non-empty for variants
  "upgrades": [ {"mark": 2, "options": [ {...}, {...} ]}, {"mark": 3, "options": [ ... ]} ],
  "notes": ""
}
```

**Ids and stats**
- **Ids:** the family's standard part has `id = family`, `variant = "std"`. Variants are `<family>_<variant>`.
- **Stats** are numbers, with the game's names (05 conventions). `mass` and `hp` are required. The game copies `stats` and `behaviour` straight into its part object, so the names must be exactly the ones the code uses.
- **Existing parts:** **the Art Foundry never changes an existing part's stats, footprint or behaviour.** It adds `overhang`, `anchors`, `moving` and the `.svg`.

**Anchors and pivots**
- They are in cells, relative to the footprint's top-left.
- **For guns, keep close to the v1 convention**, so the art matches the feel of the game:
  - pivot at the centre of the rearmost cell, half-way up: `[0.5, h/2]`
  - muzzle at pivot + barrel length, where barrel length in cells = `w × 1.25 + (automatic ? 0.6 : 1.2)`
  - the gun's art may move the pivot as far as 0.6 cells forward (the golden sample's is at 0.94)

**Upgrade options:** `{id, name, mods: {stat: multiplier}, adds: {stat: amount}, cost}`.
- A `rel` multiplier divides the failure rate, so below 1 means less reliable.
- Mk 3 options are totals relative to Mk 1.
- Offer two options per mark.

**`balanceNote`** explains a deliberate outlier and silences that balance warning.

## 8. Vehicle designs (`src/vehicles/<id>.json`)

This is the game's own template format, plus `domain` and `class`:

```json
{
  "id": "medium", "name": "Medium tank", "domain": "land", "class": "tank", "w": 14, "h": 7,
  "faction": "league", "paint": {"scheme": "league", "camo": "none"},
  "cells": [
    ["track", 2, 6], ["arm20", 1, 4], ["eng_m", 2, 4], ["c75", 8, 2]
  ]
}
```

- **Each cell** is `[partOrMaterialId, x, y]`, at the part's top-left. An optional 4th element holds options, e.g. `{"f": 1}` to flip.
- **Flags:** v1 flags such as `soft` and `fixed` are kept as they are.
- **Domains:** `land`, `sea` (ships and submarines), `airship`, `aircraft` (planes and helicopters), `drone`, `missile`. The class comes from `src/parts/classes.json`.
- **The checker enforces:**
  - the class grid and part limits
  - no overlaps
  - known ids
- **Existing designs:** the 15 v1 templates are already in `src/vehicles/`. Preview them (`--vehicle medium`) to see how a part will sit in real designs.

## 9. Delivery and checks

- **Foundry zips:** the Art Foundry delivers `foundry-<short-name>.zip` with repo paths only:
  - `src/parts/<category>/<id>.svg`, plus the part's `.json`, updated with its art fields
  - new `src/vehicles/<id>.json`
  - `src/parts/materials.json` or `paints.json`, only when they change
- **Before delivery:**
  - `node tools/check-parts.mjs` shows no errors
  - balance warnings are either fixed or explained with `balanceNote`
  - `node tools/preview-parts.mjs --part <id>` has been reviewed, plus at least one template that uses the part (`--vehicle <id>`)
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

`src/parts/weapon/c75.svg` + `.json` is the reference for style, structure and format. Match its level of detail and its lighting.
