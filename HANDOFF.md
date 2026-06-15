# GRIMVALE — Handoff

Paste-ready context for continuing this project in a fresh Claude Code terminal.

## What it is
An original browser action-RPG: PoE-style **real-time** combat, a necromancer who
binds defeated creatures as a minion pack. Pokémon-*inspired*, NOT a clone.
**Every asset is generated in code** — no image or audio files anywhere.
Sprites = procedural pixel-art + Scale2x + detail passes; VFX = pre-rendered
flipbook canvases; all sound = synthesized Web Audio.

## Where it lives
- **Repo:** `iamisobe/Claude`
- **Branch:** `claude/pokemon-style-rpg-game-7549yo`
  - Develop and push here ONLY. Never push another branch. Never open a PR unless asked.
- **Live site:** https://iamisobe.github.io/Claude/
  - Auto-publishes via `.github/workflows/pages.yml`, which force-pushes `HEAD`
    to the `gh-pages` branch on every push to the dev branch.

## Stack / architecture
Plain ES2020. No framework, no build step. Scripts load in this order (it matters):

    data.js -> sprites.js -> audio.js -> ui.js -> combat.js -> world.js
      -> systems.js -> tutorial.js -> main.js

- **js/data.js** — all game data: DEX species, gear slots/affixes, ZONES chain,
  PLOTS/Deed Book, QUESTS, talent TREE, ACTIVES, ITEMS, CROPS, FISH_TABLE, stat formulas.
- **js/sprites.js** — procedural art: creatures, 64x64 paperdoll actors with
  equipment layers + pose modes, map tiles, VFX flipbooks.
- **js/audio.js** — `SFX` module: 23 synthesized SFX recipes + generative
  plucked-lute music (Am->F->C->Em progression, short decaying notes — no drone).
  Unlocks on first user gesture. Persists to localStorage `gv_snd` / `gv_mus`.
  Pause-menu Sound/Music toggles.
- **js/ui.js** — `Input` (modal stack), `UI` (dialog/choice/panel/HUD/toast),
  `Inv`, touch controls, and **`fitScreen()`** (responsive scaling — see open bug).
- **js/combat.js** — real-time ARPG: archetype enemy AI, minion pack, capture
  via soul jar (<35% HP), 8 active skills + 5-slot hotbar, VFX/particles/hit-stop.
- **js/world.js** — free-pixel movement, camera w/ shake, maps/zones/catacombs,
  interaction, input routing (`rawKey`).
- **js/systems.js** — skills, farming, fishing minigame, gathering nodes,
  housing/Deed Book, quests, gear/character sheet, pause menu, save/load.
- **js/tutorial.js** — 16-step guided tutorial.
- **js/main.js** — `G` game-state shape, boot sequence, game loop, autosave.
- **index.html** — `#game` frame (720x528) with HUD/dialog/panel/fishing canvas;
  OUTSIDE the frame: `#hotbar` and `#touch` (d-pad + action buttons).
- **css/style.css** — bezel-fixed touch button coords, portrait repositioning,
  hotbar, character sheet, talent tree.
- Save key: `grimvale_save_v2`.

## How to run / test / ship
    # syntax check a file
    node --check js/<file>.js

    # smoke tests (~700 checks in a vm sandbox) — MUST pass before pushing
    node test/smoke.js

    # headed playtest (example harness)
    xvfb-run -a node test/audiocheck.js

- Playwright: `/opt/node22/lib/node_modules/playwright`
- Chromium binary: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
- Record video -> iPad-safe MP4 via `imageio_ffmpeg` (H.264 baseline / yuv420p / +faststart).
- The sandbox CANNOT reach github.io. Verify a deploy by matching refs instead:
  `git ls-remote origin claude/pokemon-style-rpg-game-7549yo gh-pages`
  (the two hashes should be identical once Pages has mirrored).
- Commit-message trailer to append:
  `https://claude.ai/code/session_01RHvDNv3H9FdjgNNXCLU3Cx`

## >>> TOP OPEN BUG (current complaint) <<<
**"It doesn't work on my phone — it's all sized wrong."**

Root cause is almost certainly `fitScreen()` in `js/ui.js`. It reserves
FIXED-pixel bezels for the touch controls — `availW = w - 400` in landscape,
`availH = h - 260` in portrait. Those constants were tuned for an iPad; on a
phone (~360-430px wide) they eat too much of the viewport, so the 720x528
`#game` frame scales wrong / overflows / the `#touch` + `#hotbar` controls
land in the wrong place.

Fix direction:
- Make the bezel reservation PROPORTIONAL (a fraction of viewport) or add a
  small-screen breakpoint, instead of fixed 400/260 px.
- Clamp so the game never scales below a usable minimum.
- Re-check `transform-origin` and the absolute positions of `#touch` / `#hotbar`
  at phone widths in BOTH orientations.
- Hard rule from the user: **nothing should ever overlap** the game frame —
  controls sit OUTSIDE the scaled `#game` (console-bezel layout).
- Verify by launching headed at a phone viewport (e.g. 390x844 portrait and
  844x390 landscape), screenshot/record, assert zero overlap between the
  control elements and `#game`.

## Hard constraints / preferences (from the user, do not violate)
- Everything generated in code — never add asset files.
- Real-time combat only — user dislikes turn-based.
- Fishing = catching with the pole (a hold-to-reel minigame), NOT fighting the fish.
- Touch-playable; nothing overlaps; published to the GitHub Pages web link.
- Fixed zone difficulty (no level scaling); each zone tougher than the last.
- Push to the dev branch only; no PRs unless explicitly requested.

## Recently completed
- Full synthesized sound system (SFX + generative music). User disliked the
  original sustained-drone ambience; it was replaced with the plucked-lute
  sequencer described above.

## Suggested next step
Fix the phone sizing in `fitScreen()`, verify headed at phone viewports, run
`node test/smoke.js`, commit, push, and confirm the gh-pages ref matches.
