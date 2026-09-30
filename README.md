# Sigilbound

A mobile monster-collecting battler. Summon beasts, fight with swipe gestures, feed and evolve your cards, and bind all nine elements.

This repository holds the playable prototype. It's a single web page with no build step, and it runs on a phone or a desktop browser.

## Play it

- **On your computer:** open `index.html` in a browser.
- **On your phone:** turn on GitHub Pages for this repository (Settings → Pages → Deploy from branch → `main`, root folder). The game is then served at `https://<your-username>.github.io/<repo-name>/`.
- **Local server (optional):** `npx serve .` from the repository folder, then open the address it prints.

Progress is saved in the browser. Clearing site data resets it, and so does **Reset progress** on the home screen.

## Controls

| Gesture | Keyboard | Action |
|---|---|---|
| Tap | `J` | Strike: quick, light damage, builds energy |
| Swipe left or right | `K` | Slash: heavier hit along your swipe |
| Swipe up | `I` | Special attack once energy is full; also breaks an enemy wind-up |
| Swipe down | `Space` | Parry: swipe when the closing ring turns gold to block and counter |
| Tap a portrait | `1`–`3` | Swap beasts |

## What's in the prototype

- **Combat:** swipe gestures, parry timing, hit-stop and knockback, elemental specials, three-wave stages with bosses.
- **Nine elements:** Pyre, Tide, Thorn, Frost, Storm, Stone and Gale form a wheel where each is strong against two and weak to two. Radiant and Umbral are strong against each other.
- **21 beasts, three forms each:** five body types drawn in code, with image art replacing them as it's added.
- **Cards:** every summon or drop is its own card. You can feed cards to level up and raise skill level, evolve at max level by merging two copies, lock or sell cards, and choose a team of three.
- **Economy:** soul shards for Rift Summons (all rarities, odds shown), gold for Beast Calls (mostly commons), and battle card drops.
- **Sound and vibration:** synthesized sound effects with no audio files, plus vibration on Android.

## Repository layout

```
index.html            The whole game: markup, styles and script
art/                  Beast art as <beast>_<form>.webp (0 base, 1 evolved, 2 final)
docs/art-prompts.html Google Gemini prompts for every beast and form
tools/cutout.py       Removes backgrounds from generated art and exports it to art/
```

## Adding beast art

1. Generate the three forms with the prompts in `docs/art-prompts.html`.
2. Cut out the backgrounds and export:
   ```
   pip install -r tools/requirements.txt
   python tools/cutout.py ashwing base.png evolved.png final.png
   ```
3. Add the beast to `ART_FILES` near the top of the script in `index.html`:
   ```js
   const ART_FILES={cindermaw:[0,1,2], ashwing:[0,1,2]};
   ```

A beast without art falls back to its code-drawn version, so you can add art one beast at a time.

## Where the code lives in index.html

| Section (search for the comment) | What it holds |
|---|---|
| `data` | Elements, rarities and every beast's stats, colors and special |
| `FORMS` | Names for each beast's three forms |
| `beast art` | Image loading and drawing |
| `monster drawing` | Code-drawn bodies: brute, wisp, serpent, avian and golem |
| `sound + haptics` | Synthesized sound effects and vibration |
| `battle` | Enemies, attacks, specials, parry, rewards |
| `card collection` / `forge` | Card grid, detail sheet, enhance and evolve |

## Roadmap

1. **Playable game:** art for all beasts, a campaign map, multi-enemy waves, a tutorial, music, settings.
2. **Real app:** move to Phaser + TypeScript and package with Capacitor for iOS and Android, with device saves and a closed beta.
3. **Balance and retention:** economy tuning, daily quests, events.
4. **Online and launch:** accounts and cloud saves, monetization, store listings, release.

## Art note

Current beast art is AI-generated stand-in art. Before a commercial release, replace it or confirm the generator's terms cover commercial use.
