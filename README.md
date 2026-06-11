# GRIMVALE — a necromancer's almanac

A complete creature-collector RPG that runs entirely in your browser. No build
step, no dependencies, no asset files — **every sprite, tile, and creature is
generated from code**. Your save lives in your browser (localStorage).

![Title](docs/title.png)

You inherit Hollow Manor: one good room, four ruined ones, six soil plots, and
a remarkable amount of fog. Bind wild **grims** into soul jars, grow monsters
in your garden, fish ghost-fish out of cursed lakes, restore your haunted
manor, climb the endless Soul Ladder, and descend a catacomb that has no
bottom.

## Play

Open `index.html` in any modern browser. That's it.

(Or serve it: `npx serve .` / `python3 -m http.server` and open the URL.)

### Controls

| Key | Action |
|---|---|
| Arrows / WASD | Move (tap for one step, hold to walk) |
| Z / Enter / Space | Interact · confirm |
| X / Esc | Menu · cancel |

## What's in the box

![Town](docs/town.png) ![Battle](docs/battle.png)

- **32 original grims** across 11 types (Spirit, Shadow, Bone, Flora, Fungus,
  Ember, Frost, Venom, Drowned, Moon...), with evolutions, learnsets, and a
  Grimdex to fill.
- **Turn-based battles** — type effectiveness, STAB, crits, poison/burn/sleep,
  stat stages, capture mechanics with three jar tiers.
- **5 player skills with NO level cap** — Necromancy, Fishing, Farming,
  Brewing, Delving. Every level grants real bonuses and gates new content
  (rods, seeds, recipes, deeper descents).
- **Farming** — grow crops for brewing... and plant *monster seeds* that hatch
  living grims. Your Farming level decides how strong they hatch.
- **Fishing** — a timing minigame at any water tile. Some fish bite only at
  night; the rarest only under a NEW or FULL moon (sleep to pass days).
- **Housing** — restore the manor's four ruined wings (kitchen → cauldron
  brewing, study → +15% XP, conservatory → indoor double-speed plots, crypt →
  trophy hall), and decorate with 11 placeable furnishings.
- **Endless catacombs** — procedurally generated floors that scale forever,
  richer chests the deeper you go, and a guardian to bind every 5th floor.
  The Hollow King waits at B25. The stairs keep going.
- **The Soul Ladder** — duel an infinite ranked ladder of rival necromancers
  whose teams scale without limit. A wandering rival also prowls Murkwood daily.
- **Day/night and moon phases** — encounters, fish, and crops all care what
  time it is.

![Grimdex](docs/grimdex.png)

## Development

Plain ES2020, no framework. Load order: `data → sprites → ui → world →
battle → systems → main`.

```
node test/smoke.js   # headless data/map/mechanics integrity tests
```
