# Iron Doctrine: instructions for Claude Code

Iron Doctrine is a landscape mobile browser war-campaign game. You are the Grand Admiral of one faction in an open world. The game combines:
- HighFleet-style side-view battles, three ships at a time, with reserves
- Bad Piggies-style ships built part by part, across land, sea and air
- a physical logistics war where only money is global

The producer doesn't write code. Explain decisions in plain language, and keep code out of summaries.

## Where things are

- `design/`: the design bible (v2). It is the source of truth, and you update it when a decision changes.
  - `01_GAME_DESIGN`: world, factions, officers, fleets, settlements, logistics, battles, sieges, progression
  - `02_CONTROLS_AND_UI`: battle HUD, orders, map, panels, Drafting Office, settings
  - `03_ART_AND_AUDIO`: overall look, map, effects, music, sound
  - `04_TECH_ARCHITECTURE`: code layout, data shapes, saves, part library pipeline, tests
  - `05_PARTS_CATALOGUE`: materials, part base stats, missile and drone parts, physics formulas
  - `06_ROADMAP_AND_CHECKLIST`: build steps, acceptance criteria, progress log
  - `07_ART_AND_PARTS`: the art contract (style, paint, SVG and JSON formats, renderer rules, QA)
  - `08_BALANCE_AND_ECONOMY`: balance bands, prices, production, salvage, XP, tech tree, perks
  - `09_FACTIONS`: the five factions
  - `10_PART_ROSTER`: art production order and status
- `src/`: game source.
  - `src/js/*.js` are joined in filename order into one strict IIFE.
  - `src/styles.css`, `src/index.template.html`, and `src/assets/` (fonts and other files, copied as they are).
  - `src/assets/parts/<partId>/`: the older PNG part-image route (design `07_ART_INTEGRATION`, superseded by `07_ART_AND_PARTS`); the build still validates it.
  - `src/parts/`: the part library: `materials.json`, `paints.json`, `classes.json`, and `<category>/<id>.json + .svg`.
  - `src/vehicles/`: ship, missile and drone designs, used as templates and faction designs.
- `tools/`: `part-lib.mjs` (shared rules), `check-parts.mjs`, `preview-parts.mjs`, `part-render.js` (the reference renderer to port), `png.mjs` (PNG writer/reader used by the build) and `make-art-placeholders.mjs`.
- `build.mjs`: validates the part library, bundles it as `PART_LIBRARY`, and builds the game as a small static site.
  - `node build.mjs` writes the release build to `docs/` (`index.html`, `game.js`, `game.css`, `assets/`, the home-screen manifest and icons). GitHub Pages serves this folder as the live game.
  - `node build.mjs --test` writes a test build to `build-test/`, with test hooks included.
- `tests/`: `smoke.mjs` (Playwright), `perf.mjs` and `test-hooks.js`. Screenshots go to `test-output/`.

## Every session

1. **Art inbox first.** If any `foundry-*.zip` files are in the repo root, integrate them before anything else (see "Integrating art" below).
2. **Pick the step.** Read `design/06_ROADMAP_AND_CHECKLIST.md` and take the next unfinished step, unless the producer asked for something else.
3. **Plan.** Write a 3–6 line plan based on that step's acceptance criteria.
4. **Read only what you need.** Open just the design sections the step requires, and search the code instead of reading whole files.
5. **Build in small verified steps.** Code one system, then build and test it, then move on.
6. **Test:**
   - `npm install` (first time only), then `npx playwright install chromium`
   - if the browser download is blocked, set `CHROMIUM_PATH` to any installed Chromium
   - `npm test`
   - look at the screenshots in `test-output/` and fix anything cut off, overlapping, unreadable or broken
7. **Finish:**
   - bump `GAME_VERSION` in `src/js/00_config.js`
   - run `node build.mjs`
   - tick the checkboxes in `design/06` and add a Progress log row
   - commit `docs/` together with the source changes
8. **Summary for the producer:**
   - what's new (3–5 lines)
   - how to try it on the phone once the branch is merged
   - known issues
   - the next step

## Integrating art (foundry zips)

The Art Foundry (a separate Claude project) delivers parts as `foundry-<name>.zip` files, containing repo paths only (design/07 §9).

1. Unzip each one into the repo root, overwriting only the files it contains.
2. Run `node tools/check-parts.mjs`.
   - **Format errors:** fix small ones yourself (a colour off the palette, a viewBox, an id mismatch). For anything bigger, remove the part and report it in the summary.
   - **Balance warnings:** leave them; list them in the summary.
3. Run `node tools/preview-parts.mjs --part <id>` for new parts and look at the PNG. For new designs, use `--vehicle <id>`.
4. Update the part's row in `design/10_PART_ROSTER.md` to `integrated`.
5. Delete the zip, run `node build.mjs`, and commit: "Art: <names>".
6. Never overwrite the golden sample (`wpn_c75_std`) unless the zip is explicitly a replacement for it.

## Non-negotiables

- **Self-contained site.** The build output in `docs/` is everything the game needs. Several files are fine (the producer lifted the one-file rule in v0.1.1); nothing is loaded from other websites (the build fails on external URLs). Part art is SVG from `PART_LIBRARY`; everything else is drawn in code. All audio comes from the Web Audio API. Fonts are system fonts or files in `src/assets/`.
- **Data-driven parts.** Never hard-code a part's stats or look in game code. Read them from `PART_LIBRARY`. Missing art shows as a labelled grey placeholder block.
- **Landscape first.** Android Chrome is the main target, with a full-screen world. Portrait shows the rotate card and pauses the game. Desktop must work with mouse and keyboard.
- **Screen edges.** Respect safe areas on all four sides. All text must be readable at 360 px screen height.
- **Performance.** Target 60 fps on a mid-range Android phone:
  - device pixel ratio capped at 2
  - static layers and composed ship sprites pre-drawn and cached
  - particles and projectiles pooled and capped
  - no per-frame garbage
- **Clean code.** Zero console errors. Storage keys start with `irondoctrine.` and are wrapped in try/catch.
- **Saves.** Never wipe saves silently. Bump `SAVE_VERSION` and add a migration.
- **Fiction and tone.** No real nations, flags, insignia or leaders. No blood or gore. Don't copy names, art or schemes from HighFleet, From the Depths or other games.
- **No meta.** Never tell the player what is best. Show raw numbers and after-action facts only: no grades, stars, tiers or "recommended".
- **Logistics are physical.** Only money is global. Wood, metal, electronics, scrap, fuel, ammo and parts exist in one warehouse or hold at a time (design 01 §8).
- **Joy.** Flashes, sparks, debris, floating text, combos, gentle shake (off when reduced motion is on) and haptics (own toggle). See design 03 §6.

## Code conventions

- **One file per architecture section.** Use the names in design 04 §2, e.g. `09_physics.js`. When a file passes about 800 lines, split it, e.g. `09a_physics_body.js`, `09b_physics_terrain.js`.
- **Test-only code** goes between `/*TEST:BEGIN*/` and `/*TEST:END*/`. The release build strips it and fails if any test code remains.
- **Tuning data** lives in `07_data.js` or `00_config.js` (or in `src/parts` for parts), not scattered through logic.
- **Randomness** in the simulation uses the seeded RNG from `01_util.js`.
- **Commit messages:** plain English, e.g. "Part 1b: tracks, wheels and terrain grip".

## Keep token use low

- Don't read large files end to end. Search for what you need, then read the relevant range.
- Read design docs by section.
- Don't repeat big code blocks in your replies.
- When a step is too big for one session, finish a working, committed state first. Then write in the Progress log exactly where to resume.
