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
| `npm test` | Run the game-rule and status-effect tests |
| `npm run gen:commons` | Regenerate the common beasts (see below) |
| `npm run gen:prompts` | Rebuild the Gemini prompt sheet from the beast data |

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

- **Tutorial:** new players get a short training fight where a coach teaches one move at a time (strike, slash, special, parry, swapping, reading matchups) while a ghost finger demonstrates each gesture. It can't be lost. A spotlight tour of the menus follows: a guaranteed-Rare first summon, feeding a card, how evolving works, then the campaign. It can be skipped at any point, resumes after a restart, and can be replayed from the home screen.
- **Endless campaign:** nine elemental regions, each a winding trail of eight stages plus two side stages, ruled by that element's Legendary. Beyond the Nightfall, the Sigil Gate pits you against a Mythic; beating it opens the next Circle, the same world harder, with evolved rulers, forever. Stages earn up to three stars (win, lose no beast, beat par time); region star totals open chests, with an Epic card at 30 stars in Circle I and the region's Legendary after that. Cleared stages can be replayed for shards, gold and card drops. Each region opens with a short story, and each boss with a line of its own.
- **Combat:** swipe gestures, parry timing, hit-stop and knockback, elemental specials, three-wave stages ending in a leader or a ruler.
- **Nine elements:** Pyre, Tide, Thorn, Frost, Storm, Stone and Gale form a wheel where each is strong against two and weak to two. Radiant and Umbral are strong against each other.
- **Status effects:** every element leaves a mark. Burn, Soak, Poison, Chill (which becomes Freeze), Shock, Sunder, Daze, Bless and Curse, with combos (Soak + Shock doubles the shock; Soak + Chill freezes at once). Enemies inflict them too; a parry blocks them.
- **96 beasts, three forms each (288 creatures):** 64 hand-designed plus 32 generated commons, across five rarities from Common to Mythic. Seven body types plus add-on wings, tails and markings are drawn in code, with image art replacing them as it's added.
- **Cards:** every summon or drop is its own card. You can feed cards to level up and raise skill level, evolve at max level by merging two copies, lock or sell cards, and choose a team of three.
- **Economy:** soul shards for Rift Summons (all rarities, odds shown), gold for Beast Calls (mostly commons), and battle card drops.
- **Sound and vibration:** synthesized sound effects with no audio files, plus vibration on Android.

## Project layout

```
index.html          Page markup: every screen's layout
src/
  main.ts           Starts the game: main loop, card portraits
  types.ts          Shared types: Card, Species, SaveData and so on
  data.ts           Elements, rarities, card rules (XP, stats, costs)
  beasts/
    core.ts         Hand-designed beasts: stats, looks, forms, art-prompt descriptions
    generated.ts    Common beasts made by tools/generate-commons.ts (don't edit by hand)
    art.ts          Which beasts have image art
  status.ts         Status effect rules and tuning numbers
  regions.ts        The campaign's world: region names, stage names, story, rulers, colors
  campaign.ts       Campaign rules: stage plans, difficulty, unlocks, stars, chests (no page access, fully tested)
  map.ts            The campaign map screen, stage cards, story cards and chests
  tutorial.ts       The first-time tutorial: coach, spotlight, lesson rules
  tutorialFlow.ts   Tutorial step order (no page access, so it's testable)
  events.ts         Event bus: game code reports player actions; the tutorial listens
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
tools/
  cutout.py         Removes backgrounds from generated art and exports it to public/art/
  generate-commons.ts  Makes common beasts from element themes and body types
  build-prompts.ts  Rebuilds docs/art-prompts.html from the beast data
```

## Common changes

**Add or rebalance a beast.** Add it to `src/beasts/core.ts` with its stats, colors, body type, parts, forms and a one-line `look`, then run `npm run gen:prompts` so it gets Gemini prompts. `npm test` checks every beast has a valid element, rarity, unique names and three forms. Never rename a beast's key once it has shipped; players' saves store it.

**Grow the roster toward 500.** Raise the count: `npx tsx tools/generate-commons.ts 20` makes 20 commons per element (Radiant and Umbral get half). Existing generated beasts keep their keys and names, so players' cards are safe. Add rares and above by hand in `core.ts`.

**Tune status effects.** Durations, damage and chances are in `STATUS` at the top of `src/status.ts`.

**Change the campaign.** Region names, stage names, story lines and which Legendary rules a region are in `src/regions.ts`; that file is only words and settings. Difficulty (enemy levels, which rarities appear, when enemies evolve), par times, chest rewards and first-clear bonuses are in `src/campaign.ts`. Stage enemies are generated from each stage's id, so changing a region's `id` would change its enemies and orphan players' stars; rename `name` instead.

**Change the tutorial.** Lesson text and what each step points at are in `src/tutorial.ts` (`BATTLE` for the training fight, `menuView` for the tour). The step order is in `src/tutorialFlow.ts`, and the training fight's team, enemy and rewards are at the top of `src/battle.ts` (`TRAINING_TEAM`, `makeTrainingEnemy`, `TRAINING_REWARD`). To add a step, add its id to `tutorialFlow.ts`, then give it text in `tutorial.ts` and a completion event in `handle`.

**Tune the economy.** Level caps, XP, sell prices and evolve costs are in `RARITY` and the card rules in `src/data.ts`. Battle rewards and drop chances are in `hitEnemy` in `src/battle.ts`.

**Add beast art.**
1. Generate the three forms with the prompts in `docs/art-prompts.html`.
2. Cut out the backgrounds and export them:
   ```bash
   pip install -r tools/requirements.txt
   python tools/cutout.py ashwing base.png evolved.png final.png
   ```
3. Add the beast to `ART_FILES` in `src/beasts/art.ts`, then run `npm run gen:prompts` to mark it done on the prompt sheet:
   ```ts
   export const ART_FILES: Record<string, number[]> = { cindermaw: [0, 1, 2], ashwing: [0, 1, 2] };
   ```

A beast without art falls back to its code-drawn version, so art can be added one beast at a time.

## Saves

Progress is stored in the browser's local storage under `sigilbound-save-v2`, including campaign stars, opened chests and story seen. Saves from before the campaign had a single stage number; they're converted to that many cleared stages along the trail, with one star each. Saves from older versions are upgraded automatically by `migrate` in `src/save.ts`. **Reset progress** on the home screen wipes the save. Tutorial progress is saved too; saves from before the tutorial existed skip it, and **Replay tutorial** on the home screen starts it again.

## Roadmap

1. **Playable game:** art for all beasts, multi-enemy waves, music, settings.
2. **Real app:** package with Capacitor for iOS and Android, with device saves, native haptics and a closed beta.
3. **Balance and retention:** economy tuning, daily quests, events.
4. **Online and launch:** accounts and cloud saves, monetization, store listings, release.

## Art note

Current beast art is AI-generated stand-in art. Before a commercial release, replace it or confirm the generator's terms cover commercial use.
