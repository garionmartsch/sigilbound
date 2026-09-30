# Sigilbound

A mobile monster-collecting battler. Summon beasts, fight with swipe gestures, feed and evolve your cards, and bind all nine elements.

Written in TypeScript and built with Vite. Next it gets packaged as an iOS and Android app with Capacitor.

## Getting started

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install      # once, to download the tools
npm run dev      # start the game with live reload
```

`npm run dev` prints two addresses. Open the **Local** one on your computer. To play on your phone, open the **Network** one while the phone is on the same Wi-Fi.

| Command | What it does |
|---|---|
| `npm run dev` | Development server with live reload |
| `npm run build` | Type-check, then build the finished game into `dist/` |
| `npm run preview` | Serve the built `dist/` folder to try the production build |
| `npm run typecheck` | Check the TypeScript without building |
| `npm test` | Run the game-rule tests |

Every push to GitHub runs the type check, the tests and the build automatically. See the **Actions** tab.

## Controls

| Gesture | Keyboard | Action |
|---|---|---|
| Tap | `J` | Strike: quick, light damage, builds energy |
| Swipe left or right | `K` | Slash: heavier hit along your swipe |
| Swipe up | `I` | Special attack once energy is full; also breaks an enemy wind-up |
| Swipe down | `Space` | Parry: swipe when the closing ring turns gold to block and counter |
| Tap a portrait | `1`–`3` | Swap beasts |

## What's in the game

- **Combat:** swipe gestures, parry timing, hit-stop and knockback, elemental specials, three-wave stages with bosses.
- **Nine elements:** Pyre, Tide, Thorn, Frost, Storm, Stone and Gale form a wheel where each is strong against two and weak to two. Radiant and Umbral are strong against each other.
- **21 beasts, three forms each:** five body types drawn in code, with image art replacing them as it's added.
- **Cards:** every summon or drop is its own card. You can feed cards to level up and raise skill level, evolve at max level by merging two copies, lock or sell cards, and choose a team of three.
- **Economy:** soul shards for Rift Summons (all rarities, odds shown), gold for Beast Calls (mostly commons), and battle card drops.
- **Sound and vibration:** synthesized sound effects with no audio files, plus vibration on Android.

## Project layout

```
index.html          Page markup: every screen's layout
src/
  main.ts           Starts the game: main loop, card portraits
  types.ts          Shared types: Card, Species, SaveData and so on
  data.ts           Elements, rarities, all beasts and their forms, card rules (XP, stats, costs)
  save.ts           The player's save: loading, upgrading old saves, storing progress
  battle.ts         Fights: enemies, attacks, specials, parry, rewards, touch input, HUD
  fx.ts             Battle effects: slashes, fireballs, vines, waves, lightning and more
  render.ts         Beast drawing: image art and the code-drawn bodies
  ui.ts             Cards screen, summoning altar, enhance and evolve
  screens.ts        Switching screens, home screen
  sfx.ts            Synthesized sounds, vibration, sound settings
  util.ts           Small shared helpers: DOM lookup, math, colors
  styles.css        All styling
public/art/         Beast art as <beast>_<form>.webp (0 base, 1 evolved, 2 final)
tests/              Game-rule tests (npm test)
docs/               Gemini art prompts for every beast and form
tools/cutout.py     Removes backgrounds from generated art and exports it to public/art/
```

## Common changes

**Add or rebalance a beast.** Edit `SPECIES` and `FORMS` in `src/data.ts`. `npm test` checks that every beast has a valid element, a rarity and three form names.

**Tune the economy.** Level caps, XP, sell prices and evolve costs are in `RARITY` and the card rules in `src/data.ts`. Battle rewards and drop chances are in `hitEnemy` in `src/battle.ts`.

**Add beast art.**
1. Generate the three forms with the prompts in `docs/art-prompts.html`.
2. Cut out the backgrounds and export them:
   ```bash
   pip install -r tools/requirements.txt
   python tools/cutout.py ashwing base.png evolved.png final.png
   ```
3. Add the beast to `ART_FILES` in `src/render.ts`:
   ```ts
   export const ART_FILES: Record<string, number[]> = { cindermaw: [0, 1, 2], ashwing: [0, 1, 2] };
   ```

A beast without art falls back to its code-drawn version, so art can be added one beast at a time.

## Saves

Progress is stored in the browser's local storage under `sigilbound-save-v2`. Saves from older versions are upgraded automatically by `migrate` in `src/save.ts`. **Reset progress** on the home screen wipes the save.

## Roadmap

1. **Playable game:** art for all beasts, a campaign map, multi-enemy waves, a tutorial, music, settings.
2. **Real app:** package with Capacitor for iOS and Android, with device saves, native haptics and a closed beta.
3. **Balance and retention:** economy tuning, daily quests, events.
4. **Online and launch:** accounts and cloud saves, monetization, store listings, release.

## Art note

Current beast art is AI-generated stand-in art. Before a commercial release, replace it or confirm the generator's terms cover commercial use.
