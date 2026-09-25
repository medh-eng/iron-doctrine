# Iron Doctrine: instructions for Claude Code

Iron Doctrine is a landscape mobile browser game about commanding a whole war. It combines HighFleet's campaign and logistics, Bad Piggies' physical part-by-part vehicle building, and Command & Conquer-style side-view battles.

The producer doesn't write code. Explain decisions in plain language, and keep code out of summaries.

## Where things are

- `design/`: the design bible. It is the source of truth, and you update it when a decision changes.
  - `01_GAME_DESIGN`: systems and rules
  - `02_CONTROLS_AND_UI`: layout, controls, screens
  - `03_ART_AND_AUDIO`: look, effects, music, sound
  - `04_TECH_ARCHITECTURE`: code structure, data, saves, tests
  - `05_PARTS_CATALOGUE`: parts, stats, physics formulas
  - `06_ROADMAP_AND_CHECKLIST`: build steps, acceptance criteria, progress log
- `src/`: game source.
  - `src/js/*.js` are joined in filename order into one strict IIFE.
  - `src/styles.css`, `src/index.template.html`, and `src/assets/` (fonts are inlined as base64 at build time).
- `build.mjs`: builds the single self-contained HTML file.
  - `node build.mjs` writes the release build to `docs/index.html`. GitHub Pages serves this file as the live game.
  - `node build.mjs --test` writes a test build to `build-test/index.html`, with test hooks included.
- `tests/`: `smoke.mjs` (Playwright) and `test-hooks.js`. Screenshots go to `test-output/`.

## Every session

1. **Pick the step.** Read `design/06_ROADMAP_AND_CHECKLIST.md` and take the next unfinished step, unless the producer asked for something else.
2. **Plan.** Write a 3–6 line plan based on that step's acceptance criteria.
3. **Read only what you need.** Open just the design sections the step requires, and search the code instead of reading whole files.
4. **Build in small verified steps.** Code one system, then build and test it, then move on.
5. **Test:**
   - `npm install` (first time only), then `npx playwright install chromium`
   - if the browser download is blocked, set `CHROMIUM_PATH` to any installed Chromium
   - `npm test`
   - look at the screenshots in `test-output/` and fix anything cut off, overlapping, unreadable or broken
6. **Finish:**
   - bump `GAME_VERSION` in `src/js/00_config.js`
   - run `node build.mjs`
   - tick the checkboxes in `design/06` and add a Progress log row
   - commit `docs/index.html` together with the source changes
7. **Summary for the producer:**
   - what's new (3–5 lines)
   - how to try it on the phone once the branch is merged
   - known issues
   - the next step

## Non-negotiables

- **One file.** The output is one self-contained HTML file. All art is drawn in code; all audio comes from the Web Audio API. Fonts are system fonts or base64 in `src/assets/`. No network requests at runtime.
- **Landscape first.** Android Chrome is the main target, with a full-screen world. Portrait shows the rotate card and pauses the game. Desktop must work with mouse and keyboard.
- **Screen edges.** Respect safe areas on all four sides. All text must be readable at 360 px screen height.
- **Performance.** Target 60 fps on a mid-range Android phone:
  - device pixel ratio capped at 2
  - static layers pre-drawn
  - particles and projectiles pooled and capped
  - no per-frame garbage
- **Clean code.** Zero console errors. Storage keys start with `irondoctrine.` and are wrapped in try/catch.
- **Saves.** Never wipe saves silently. Bump `SAVE_VERSION` and add a migration.
- **Fiction and tone.** No real nations, flags, insignia or leaders. No blood or gore.
- **No meta.** Never tell the player what is best. Show raw numbers and after-action facts only: no grades, stars, tiers or "recommended".
- **Joy.** Flashes, sparks, debris, floating text, combos, gentle shake (off when reduced motion is on) and haptics (own toggle). See design 03 §5.

## Code conventions

- **One file per architecture section.** Use the names in design 04 §2, e.g. `09_physics.js`. When a file passes about 800 lines, split it, e.g. `09a_physics_body.js`, `09b_physics_terrain.js`.
- **Test-only code** goes between `/*TEST:BEGIN*/` and `/*TEST:END*/`. The release build strips it and fails if any test code remains.
- **Tuning data** lives in `07_data.js` or `00_config.js`, not scattered through logic.
- **Randomness** in the simulation uses the seeded RNG from `01_util.js`.
- **Commit messages:** plain English, e.g. "Part 1b: tracks, wheels and terrain grip".

## Keep token use low

- Don't read large files end to end. Search for what you need, then read the relevant range.
- Read design docs by section.
- Don't repeat big code blocks in your replies.
- When a step is too big for one session, finish a working, committed state first. Then write in the Progress log exactly where to resume.
