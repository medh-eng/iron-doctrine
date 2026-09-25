# Iron Doctrine

A landscape mobile war campaign game. You design every tank, ship and aircraft part by part, keep them supplied across a living map, and fight the battles that matter yourself.

**Play:** `https://<your-github-username>.github.io/iron-doctrine/` (once GitHub Pages is switched on, see below)

## What's in this repository

| Folder or file | What it is |
|---|---|
| `docs/` | The live game: `index.html` plus its script, styles, font, icons and home-screen manifest. GitHub Pages publishes this folder. |
| `src/` | Game source code. The build turns it into the site in `docs/`. |
| `design/` | Design bible: game design, controls, art and audio, tech, parts, roadmap and progress log. |
| `tests/` | Automatic tests that play the game in a headless browser and take screenshots. |
| `CLAUDE.md` | Standing instructions Claude Code reads at the start of every session. |
| `build.mjs` | Build script (`node build.mjs`). |

## Switch on GitHub Pages (once)

1. Open the repository's Settings, then Pages.
2. Under "Build and deployment", choose:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/docs**
3. Save. After about a minute the play link appears at the top of that page.

GitHub Pages is free for public repositories.

## Working with Claude Code

To start a session, open claude.ai/code, pick this repository, and describe the task, e.g.:

- "Continue with the next step in design/06."
- "Fix: the fire button feels late on my phone."

When the session finishes, merge its branch into `main`. The game link updates about a minute later.

## Add the game to your Android home screen

1. Open the play link in Chrome.
2. Open the menu (⋮) and tap **Add to Home screen**.
