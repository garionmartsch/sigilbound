# Sigilbound

A mobile monster-collecting battler. Summon beasts, fight with swipe gestures, feed and evolve your cards, and bind all nine elements.

Written in TypeScript and built with Vite, and packaged as an iOS and Android app with [Capacitor](https://capacitorjs.com).

## Getting started

You need [Node.js](https://nodejs.org) 22 or newer.

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

## Phone app

The game is wrapped as a native app with Capacitor 8. The web game runs inside the app unchanged; `src/native.ts` adds the phone-only parts, and does nothing in a browser:

- **Haptics** through the phone's vibration engine, so vibration works on iPhone too.
- **Safer saves.** Progress and settings are also copied to app storage, and restored if the phone clears the app's web storage.
- **Android back button:** closes the open menu, pauses a fight, or goes back to the home screen; on the home screen it sends the app to the background.
- **Offline fonts.** The two fonts are bundled (`tools/fetch-fonts.sh`), so text looks right with no connection.
- Portrait only, edge-to-edge with safe areas for notches, and the Sigilbound sigil as icon and splash screen (source art in `assets/`).

App id: `com.garionmartsch.sigilbound` (in `capacitor.config.json`). It can still change freely, but not after the first upload to an app store.

### Get the Android app without installing anything

Every push to `main` or `feature/app` runs the **App** workflow on GitHub. It builds a debug APK, boots it in an Android emulator to check the game loads, and builds the iOS project for the simulator.

1. Open the repository on GitHub, go to **Actions**, then **App**, and open the latest green run.
2. Under **Artifacts**, download **sigilbound-android-debug** and unzip it to get `app-debug.apk`.
3. Copy it to an Android phone and open it. Android asks to allow installs from that app (Files, Drive, etc.) the first time.

This is a debug build: fine for you and testers, not for the Play Store (that needs a signed release build; see below).

### Build it yourself

You need Node 22, [Android Studio](https://developer.android.com/studio) for Android, and a Mac with Xcode 26 for iOS.

| Command | What it does |
|---|---|
| `npm run app:android` | Build the game, copy it into `android/`, and open Android Studio. Press Run to install on a plugged-in phone or emulator. |
| `npm run app:ios` | The same for `ios/` and Xcode (Mac only). |
| `npm run app:apk` | Build a debug APK from the command line: `android/app/build/outputs/apk/debug/app-debug.apk` |
| `npm run app:sync` | Copy the latest game build into both native projects |
| `npm run app:assets` | Regenerate app icons and splash screens from `assets/` |

All `app:` commands fetch the fonts first if they're missing (they need `bash` and `curl`; on Windows, use Git Bash).

**After changing the game**, run `npm run app:sync` (or any `app:` command) so the native projects get the new build. The `android/` and `ios/` folders are committed; edit them in Android Studio or Xcode for native settings like permissions. `node tools/patch-native.mjs android|ios` re-applies the portrait lock if a project is ever regenerated.

### Getting onto an iPhone

iPhones only install apps signed with an Apple developer account. For your own phone, a free Apple ID works for 7-day test builds: open `ios/App/App.xcodeproj` in Xcode on a Mac, pick your team under **Signing & Capabilities**, plug in the phone and press Run. For testers, join the Apple Developer Program ($99 a year) and upload through TestFlight.

### Store releases (later)

- **Google Play:** create an upload key, set up signing in `android/app/build.gradle`, and build an `.aab` with `./gradlew bundleRelease` (Android Studio: Build, Generate Signed Bundle).
- **App Store:** in Xcode, Product, Archive, then upload to App Store Connect.
- Both stores need the privacy policy, age rating and listing items on the roadmap first.

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
- **Combat:** swipe gestures, parry timing, hit-stop and knockback, elemental specials, three-wave stages ending in a leader or a boss.
- **Enemy groups:** the first few stages send one enemy at a time; after that waves bring two or three at once. Tap an enemy (or its chip at the top, or press T) to aim at it. Enemies take turns attacking, so every wind-up can be read and parried, and a parry's counter always goes back at whoever attacked. Side stage 1 of each region is a swarm.
- **Bosses:** wardens, rulers and the Gate's guardian fight in phases (2, 3 and 4). Each new phase starts with a roar: the boss shakes off its ailments, speeds up and learns another signature move. **Smash** is a long charge that can't be parried; break it with a Special or by hitting hard enough while it charges (the BREAK meter). **Sweep** hits your whole team, benched beasts too, unless you parry it. **Barrage** is three quick strikes, each parried on its own. Each element names its moves (Pyre's are Kiln Breath, Ashfall and Ember Flurry), and the stage card lists a boss's moves and counters before you fight.
- **Wardens:** nine boss-only beasts, one per element, that can never be summoned, dropped or won. Each region's own warden guards main stage 4, and side stage 2 holds a wandering warden of the element that beats the region.
- **Nine elements:** Pyre, Tide, Thorn, Frost, Storm, Stone and Gale form a wheel where each is strong against two and weak to two. Radiant and Umbral are strong against each other.
- **Status effects:** every element leaves a mark. Burn, Soak, Poison, Chill (which becomes Freeze), Shock, Sunder, Daze, Bless and Curse, with combos (Soak + Shock doubles the shock; Soak + Chill freezes at once). Enemies inflict them too; a parry blocks them.
- **96 collectible beasts, three forms each (288 creatures),** plus 9 boss-only wardens: 64 hand-designed plus 32 generated commons, across five rarities from Common to Mythic. Seven body types plus add-on wings, tails and markings are drawn in code, with image art replacing them as it's added.
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
    wardens.ts      The nine boss-only wardens
    art.ts          Which beasts have image art
  status.ts         Status effect rules and tuning numbers
  regions.ts        The campaign's world: region names, stage names, story, rulers, colors
  campaign.ts       Campaign rules: stage plans, enemy groups, wardens, difficulty, unlocks, stars, chests (no page access, fully tested)
  bosses.ts         Boss rules: phases, signature moves and their names, pacing (no page access, tested)
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
  sfx.ts            Synthesized sounds and vibration
  settings.ts       The settings menu (gear on home, Pause in battle)
  settingsCore.ts   Settings, defaults, what each one does, save codes (no page access, tested)
  prefs.ts          This device's live settings, loaded at start
  themes.ts         Color themes for the menus and the battle arena (tested for readable contrast)
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

**Change the bosses.** Phase thresholds, which moves each kind of boss uses per phase, and how many ordinary attacks come between signature moves are in `KITS` in `src/bosses.ts`; wind-up times, damage and how much damage breaks a smash are in `MOVES`; move names per element in `MOVE_NAMES`. How many enemies come at once is `groupSizes` in `src/campaign.ts`, and how much health and attack each member of a group keeps is `GROUP_HP` and `GROUP_ATK` at the top of `src/battle.ts`.

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

Progress is stored in the browser's local storage under `sigilbound-save-v2`, including campaign stars, opened chests and story seen. Saves from before the campaign had a single stage number; they're converted to that many cleared stages along the trail, with one star each. Saves from older versions are upgraded automatically by `migrate` in `src/save.ts`. Tutorial progress is saved too; saves from before the tutorial existed skip it.

The settings menu (gear on the home screen) can **copy a save code** to move progress to another device, **load a save code**, **replay the tutorial** and **reset progress**. Loading and resetting both ask for a second tap. A save code is the save as base64 JSON with a `SIGIL1:` prefix; loading one runs it through `migrate` like any other save.

## Settings

Settings belong to the device, not the save, so resetting progress keeps them. They're stored under `sigilbound-settings`: sound on/off and volume, vibration strength, swipe distance, relaxed parry timing (0.55 s window instead of 0.4 s), damage numbers, the controls reminder, screen shake and flashes. Devices set to reduce motion start with shake off and flashes dimmed. To add a setting, add it to `Settings`, `defaultSettings` and `normalizeSettings` in `src/settingsCore.ts`, give it a row in `render` in `src/settings.ts`, and read it through `prefs` where it matters.

**Themes.** The menu offers seven color themes: Sigil Night (the original), Abyssal Tide, Verdant Grove, Ember Forge, Rose Dusk, Eclipse (true black for OLED screens) and High Contrast. A theme recolors the menus, cards, buttons and the battle arena; element and rarity colors, the gold parry ring and region maps stay the same because they carry meaning. The stylesheet reads theme colors as CSS variables (`--bg`, `--stone`, `--gold` and so on); `:root` in `src/styles.css` holds the Sigil Night values so the first frame looks right. To add a theme, copy one in `src/themes.ts` and add it to `THEMES`; `npm test` checks every color is set and that text, muted text, the accent and the main button stay readable (WCAG contrast 7:1 for text, 4.5:1 for the rest).

The **Pause** button in battle opens the same menu and holds the fight still until it closes; switching away from the app pauses too.

## Roadmap

1. **Playable game:** art for all beasts, multi-enemy waves, music (the settings menu will need a music volume then).
2. **Real app:** ~~package with Capacitor, device saves, native haptics~~ done; next a closed beta (TestFlight and Google Play internal testing).
3. **Balance and retention:** economy tuning, daily quests, events.
4. **Online and launch:** accounts and cloud saves, monetization, store listings, release.

## Art note

Current beast art is AI-generated stand-in art. Before a commercial release, replace it or confirm the generator's terms cover commercial use.
