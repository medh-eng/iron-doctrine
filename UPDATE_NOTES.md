# Update pack: design v2 + part library pipeline

This pack changes the game's design, and adds the art pipeline. It does **not** change any game code in `src/js/`.

## What's in the pack

| Path | What |
|---|---|
| `design/01`–`06` | Rewritten for v2 (open world, factions, fleets, logistics, three-on-field battles) |
| `design/07`–`10` | New: art contract, balance and economy, factions, part roster |
| `CLAUDE.md` | Updated: v2 doc list, part library, "Integrating art" procedure |
| `README.md` | Updated description and file table |
| `build.mjs` | Now validates `src/parts` and bundles it as `PART_LIBRARY` |
| `.gitignore` | Adds `preview/` |
| `tools/` | `part-lib.mjs`, `check-parts.mjs`, `preview-parts.mjs`, `part-render.js` |
| `src/parts/` | `classes.json`, `materials.json`, `paints.json`, and the golden sample `weapon/wpn_c75_std` (.json + .svg) |
| `src/vehicles/` | `test_gun_block.json` (a pipeline test design) |

## How to apply it

1. **Unzip the pack** into the repository root, then delete the zip.
   - If `build.mjs`, `CLAUDE.md`, `.gitignore` or `design/06` changed since the starter repo (for example during Part 1a), **merge, don't overwrite**:
     - **`build.mjs`:** the only changes are:
       - `import { loadLibrary } from './tools/part-lib.mjs'`
       - a block that loads the library, fails on errors, and adds a generated source file `06z_part_library.generated.js` (`const PART_LIBRARY = {...}`) sorted in with the `src/js` files
       - part and vehicle counts in the final log line
     - **`design/06`:** keep your existing Part 1a ticks and Progress log rows. Copy them into the new file, whose Part 1a is unchanged.
     - **`CLAUDE.md`:** take the new file, then re-add anything you had added yourself.
2. **Run the checks:**
   - `node tools/check-parts.mjs`: expect "No format errors".
   - `node build.mjs`, then `npm test`.
   - Optionally `node tools/preview-parts.mjs --all`, then look at the PNGs in `preview/`.
3. **Retired v1 ideas:** if any Part 1a code or text uses them, rename or remove it:
   - the region map, rail supply, food and the six resources
   - the Proving Ground ladder → becomes the **Battle Simulator** (with an optional Gauntlet later)
   - title menu items
4. **Commit:** "Design v2 and part library pipeline". Add a Progress log row.
5. **Continue:** finish Part 1a if it isn't done, then start Part 1b as the new `design/06` describes.

## Notes

- **Where art comes from:** the Art Foundry project delivers parts over time as `foundry-*.zip` files. Integrate them whenever they appear (CLAUDE.md, "Integrating art").
- **The order of art matches the code's needs** (`design/10`). Until a part's art arrives, show a labelled grey placeholder block.
- **Balance warnings** from the checker are advice, not errors.
