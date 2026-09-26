# Iron Doctrine: art integration contract and A02 report

> **Superseded in design v2** by `07_ART_AND_PARTS.md` (SVG parts in `src/parts`). Kept because the PNG route in `src/assets/parts` still exists in code.

This is the agreement between the game code (this repository) and the separate graphics project that paints part art. It answers the graphics project's A02 compatibility request and says exactly what files to deliver. The graphics project should read this file before producing any runtime asset.

Status: **contract agreed on the code side, tested with placeholders** (screenshots in `design/art/`). No real part art has been integrated yet.

## 1. A02 report: how the game draws vehicles today

**Code revision:** branch `claude/vibrant-ritchie-tklntr`, game v0.1.3 (Part 1c). The repository history is the reference; this file is updated when the contract changes.

**Renderer:** plain HTML5 Canvas 2D, no framework or engine. One full-screen canvas for the world; menus and panels are HTML on top.

**World units:** metres, x to the right, y up. One construction cell = **0.5 m**. In battle the camera draws about 10–20 CSS px per metre (zoom 0.35×–2×); the Drafting Office draws about 18–40 CSS px per cell. Phones render at up to 2 device pixels per CSS pixel.

**Grid and parts:** a design is a grid of cells, row 0 at the top, x to the right. Each part occupies a rectangle of `w × h` cells (its footprint), anchored at its top-left cell. Part IDs and footprints are exactly those in `design/05_PARTS_CATALOGUE.md` (P1 ground parts plus `nsight`, night sight, 1×1). No footprint differs from the catalogue.

**Facing and flipping:** designs face **right** (front = +x). League (player) vehicles face right; Directorate (enemy) vehicles are the same drawing **mirrored horizontally** about the vehicle's centre of mass. Paint art right-facing only; never paint a left-facing version. The whole vehicle rotates with the ground (it tilts on slopes); individual parts do not rotate, except barrels.

**Occupancy and hits:** every cell of a footprint is solid for hits, armour, mass and collision. Painted overhang outside the footprint (antenna tips, bolts, lips, barrels) is visual only and is never hit.

**Turrets and guns:** there is no separate turret sprite. A turret is the group of parts connected to the hull through a `turret` ring part; in side view it doesn't rotate, it only swings the gun between facing forward and backward. Each weapon part has:
- a **mount** (the part's own image, inside its footprint), and
- a **barrel**, drawn separately every frame, rotating about a **pivot** and sliding back up to 0.35 m on recoil.

The pivot is fixed by the code at the centre of the weapon's **rearmost cell, half-way up its height**. Shells, muzzle flashes and smoke start at the game's own muzzle point (pivot + barrel length along the barrel angle). Art never changes where shells come from.

**Draw order:** structure parts, then everything else, cached into one image per vehicle and redrawn only when damage changes; then barrels live on top; then debris, shells and effects. Destroyed parts fly off as debris using the same part image.

**Damage today:** drawn over the art by code: darkening (scorch) grows with damage, plus dark holes past 30%. An optional painted damaged image (§3) replaces the clean one above 50% damage.

**Assets and build:** part images live in `src/assets/parts/<partId>/`. `node build.mjs` checks every record against its PNG, copies the files to `docs/assets/parts/`, and embeds the list in the game. The game loads them from its own site (no other website), draws them when loaded, and falls back to the code drawing if a file is missing, fails, or has the wrong size. Images are never stored in saves.

**Part swapping and progression, implemented vs planned:**

| Feature | State |
|---|---|
| Place, move and delete any part in the Drafting Office; templates; randomise; scratch build | Implemented |
| Save a changed design as the next mark (Mk.II) with a change log; Requisition cost of the price difference | Implemented |
| Field a squad of 3 designs within a level budget; captured boss blueprints | Implemented |
| Research and part unlocks (all P1 parts are available from the start) | Planned (Part 3+) |
| A physical inventory of parts; upgrade levels | Not planned: upgrading means fitting a better part (design 01 §8.6) |
| Heat, cooling and reliability in battle | Planned (Part 2); radiators have mass and cost only |
| Cosmetic paint schemes, faction paint masks | Planned (§4) |

## 2. The light tank, as the game validates it

The starting template `light` ("Light tank Mk.I"), 12 × 6 cells. Coordinates are the top-left cell of each part (x, y), row 0 at the top.

| Part | x, y | Part | x, y | Part | x, y |
|---|---|---|---|---|---|
| track | 2, 5 | crew2 | 5, 3 | mg | 10, 4 |
| track | 4, 5 | fuel_s | 7, 3 | turret | 4, 2 |
| track | 6, 5 | ammo | 7, 4 | radio | 3, 1 |
| track | 8, 5 | arm20 | 8, 3 | arm20 | 4, 1 |
| arm20 | 1, 3 | arm20 | 8, 4 | arm20 | 5, 1 |
| arm20 | 1, 4 | slope40 | 9, 3 | c37 | 6, 1 |
| eng_m | 2, 3 | arm20 | 9, 4 | optics | 5, 0 |

Validator result: **valid**, no errors. Numbers reported by the game (Drafting Office stats, v0.1.3):

| | |
|---|---|
| Mass | 5.92 t |
| Centre of mass | 2.89 m from the rear, 0.96 m up |
| Power | 300 kW made, 6 kW drawn; 50.7 kW/t |
| Tracks | 4 segments, 1.4 m² contact, 41 kPa |
| Tip angle / climb limit | 64° / 35° |
| Top speed | 55 km/h (track limit) on road, plains, forest and mud |
| Crew space | 2 |
| Fuel / shells | 200 L / 70 |
| Weapons | Machine gun (hull, fires by itself), Cannon 37 mm (turret) |
| Cost | 66 |

Attachments are adjacency: parts that share an edge are connected. The turret group is `radio`, `arm20` ×2, `c37`, `optics` above the `turret` ring. Destroying the ring throws that group off as debris. Cooling isn't simulated yet, so there is no cooling result.

## 3. What to deliver for each part

**Files per part** in `src/assets/parts/<partId>/`:
- `<partId>_<variant>_r<NNN>.png`: the part image
- `<partId>_<variant>_r<NNN>.json`: its record
- weapons only: `<partId>_<variant>_barrel_r<NNN>.png`
- optional: `<partId>_<variant>_damaged_r<NNN>.png`, the same canvas and alignment as the clean image

Use `variant` = `default` for the standard look.

**Image rules**
- PNG, 8-bit RGBA, true transparent background (not a painted checkerboard), sRGB.
- **64 px per cell** (128 px per metre).
- **Canvas = footprint + 8 px padding on every side**: `w × 64 + 16` by `h × 64 + 16`. The footprint's top-left corner is at pixel **(8, 8)**.
- A part that needs more overhang (e.g. a radio antenna) may use a bigger canvas. Give its `origin`: the pixel of the footprint's top-left corner.
- Strict orthographic side view, facing right, soft light from the top and slightly upper-left, no cast shadow, no ground, no text.
- Paint in League colours (ivory, olive, League blue). The game tints enemies red for now.
- Keep each PNG under about 200 KB.

**Barrels** (mg, hmg, c37, c75, c105, how): a separate horizontal image pointing right. The record gives:
- `pivot`: the pixel of the rotation axis
- `muzzle`: the pixel of the muzzle; same row as `pivot`

The game scales the barrel so pivot-to-muzzle equals its barrel length. Paint at these lengths to avoid stretching:

| Weapon | Barrel length | Pivot to muzzle at 128 px/m |
|---|---|---|
| mg, hmg | 0.925 m | 118 px |
| c37 | 1.85 m | 237 px |
| c75 | 2.475 m | 317 px |
| c105, how | 3.1 m | 397 px |

The mount image must put the trunnion (the barrel's root) at the code pivot: 32 px right of the footprint's left edge, half-way down the footprint (for a 1-cell-high gun: pixel (40, 40)).

**Record (JSON)**
```json
{
  "artId": "part.c37.default",
  "part": "c37",
  "variant": "default",
  "revision": "r001",
  "status": "prepared",
  "pxPerCell": 64,
  "footprint": [2, 1],
  "canvas": [144, 80],
  "origin": [8, 8],
  "file": "c37_default_r001.png",
  "damaged": "c37_default_damaged_r001.png",
  "barrel": { "file": "c37_default_barrel_r001.png", "canvas": [260, 24], "pivot": [12, 12], "muzzle": [249, 12] },
  "note": "free text"
}
```
- `status` is one of: `placeholder`, `raw-generated`, `prepared`, `visually-approved`, `integration-tested`.
- The game uses `prepared` and later. The other states are kept in the repository but not shown.
- `damaged` and `barrel` are optional (barrel: weapons only). Everything else is required.
- The build **fails** if a file is missing, isn't a PNG, has no alpha channel, or its size differs from `canvas`, so mistakes are caught before they reach the game.

**Canvas sizes for the P1 parts** (footprint + 8 px padding):

| Canvas | Parts |
|---|---|
| 80 × 80 | frame, timber, plate, arm20, arm40, arm80, slope40, radiator, wheel_s, mg, hmg, smoke, radio*, optics, fc, stab, nsight, fuel_s, fuel_ss, ammo, ammo_p |
| 144 × 80 | track, c37 |
| 208 × 80 | turret, c75 |
| 272 × 80 | c105 |
| 144 × 144 | crew2, eng_s, wheel_l, cargo |
| 208 × 144 | eng_m |
| 272 × 144 | eng_h, how |

*radio: the game draws a 1.6 m whip antenna above it. To paint the antenna, use a taller canvas (e.g. 80 × 288) with `origin` [8, 216].

## 4. Not yet supported (tell the code side before relying on these)

- Faction paint masks (a grey mask marking panels to recolour for the Directorate). Until then enemies get a light red tint over the whole vehicle.
- Animated parts: wheels and road wheels don't rotate, track links don't run, radar doesn't turn. Paint them static.
- Separate interior or cutaway layers for the Drafting Office. The designer shows the same image as battle.
- Several variants of one part at once. One record per part is used; the latest `prepared` or better revision wins.

## 5. How the placeholder test was run

`node tools/make-art-placeholders.mjs` writes two placeholder parts (status `placeholder`, test builds only):
- `c37`: a magenta footprint with a separate cyan barrel image
- `frame`

Markers: a black cross at the grid origin, amber at the barrel pivot, a cyan ring at the muzzle. The smoke test switches them on and takes three screenshots:
- `design/art/A02_placeholder_designer.png`: Drafting Office, light tank with the placeholder gun and a placeholder frame. The barrel pivot and muzzle rings line up with the code's pivot and muzzle markers.
- `design/art/A02_placeholder_battle.png`: the same design on a test drive, tilted on a slope. The art follows the hull and the barrel follows the gun.
- `design/art/A02_placeholder_enemy_mirrored.png`: an enemy light tank, mirrored, gun forward, red tint.

## 6. Hand-over workflow

1. The graphics project produces one part at a time, following §3.
2. The producer puts the PNG(s) and JSON record into `src/assets/parts/<partId>/`, or attaches them in a session and asks Claude to add them.
3. Claude runs the build (which validates the files), looks at the part in the Drafting Office and in battle, and marks the record `integration-tested` if it's right. Otherwise Claude reports what's wrong in pixels.
4. The next queued part follows. The graphics project's queue (frame, plate, arm20, slope40, track, eng_m) fits this contract as is.
