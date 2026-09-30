/*
 * Player settings: what they are, their defaults, and how each one changes
 * the game. Pure data and functions, no page access, so it can be tested on
 * its own. The menu that edits them lives in src/settings.ts.
 *
 * Settings belong to the device, not the save: resetting progress keeps them,
 * and a save code moved to another phone doesn't bring them along.
 */

export type Level3 = 'off' | 'low' | 'full';
export type Buzz = 'off' | 'light' | 'normal' | 'strong';
export type Swipe = 'short' | 'normal' | 'long';

export interface Settings {
  /** Sound effects on or off. */
  sound: boolean;
  /** Master volume, 0 to 100. */
  volume: number;
  /** Vibration strength. */
  buzz: Buzz;
  /** Screen shake on hits. */
  shake: Level3;
  /** Full-screen flashes on big hits and lightning. 'low' dims them. */
  flashes: 'full' | 'low';
  /** Show damage and healing numbers over beasts. */
  numbers: boolean;
  /** Show the controls reminder under the battle field. */
  hints: boolean;
  /** How far a finger must travel before it counts as a swipe. */
  swipe: Swipe;
  /** A longer window to parry in. */
  relaxedParry: boolean;
}

export const SETTINGS_KEY = 'sigilbound-settings';

/** Defaults. A device that asks for reduced motion starts with no shake and dim flashes. */
export function defaultSettings(reducedMotion = false): Settings {
  return {
    sound: true, volume: 80, buzz: 'normal',
    shake: reducedMotion ? 'off' : 'full', flashes: reducedMotion ? 'low' : 'full',
    numbers: true, hints: true, swipe: 'normal', relaxedParry: false,
  };
}

const oneOf = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (opts as readonly unknown[]).includes(v) ? v as T : d;
const bool = (v: unknown, d: boolean) => typeof v === 'boolean' ? v : d;

/**
 * Turn whatever was stored into complete, valid settings. Unknown or broken
 * values fall back to the default, so a bad value can never break the game.
 * `legacy` carries the two older single-value keys (sound muted, vibration off).
 */
export function normalizeSettings(raw: unknown, reducedMotion = false, legacy: { muted?: string | null; haptics?: string | null } = {}): Settings {
  const d = defaultSettings(reducedMotion);
  if (legacy.muted === '1') d.sound = false;
  if (legacy.haptics === '0') d.buzz = 'off';
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const vol = typeof r.volume === 'number' && isFinite(r.volume) ? Math.round(Math.max(0, Math.min(100, r.volume))) : d.volume;
  return {
    sound: bool(r.sound, d.sound),
    volume: vol,
    buzz: oneOf(r.buzz, ['off', 'light', 'normal', 'strong'] as const, d.buzz),
    shake: oneOf(r.shake, ['off', 'low', 'full'] as const, d.shake),
    flashes: oneOf(r.flashes, ['full', 'low'] as const, d.flashes),
    numbers: bool(r.numbers, d.numbers),
    hints: bool(r.hints, d.hints),
    swipe: oneOf(r.swipe, ['short', 'normal', 'long'] as const, d.swipe),
    relaxedParry: bool(r.relaxedParry, d.relaxedParry),
  };
}

/* ---------- what each setting does ---------- */

/** Master gain for the sound engine; 80 on the slider is the original loudness. */
export const gainFor = (s: Settings) => s.sound ? 0.55 * Math.pow(s.volume / 80, 1.6) : 0;

/** Scale a vibration pattern: pulses get longer or shorter, pauses stay put. */
export function scaleBuzz(pattern: number | number[], level: Buzz): number[] | null {
  if (level === 'off') return null;
  const k = level === 'light' ? 0.5 : level === 'strong' ? 1.6 : 1;
  const p = Array.isArray(pattern) ? pattern : [pattern];
  return p.map((v, i) => i % 2 ? v : Math.max(4, Math.round(v * k)));
}

export const shakeScale = (s: Settings) => s.shake === 'off' ? 0 : s.shake === 'low' ? 0.4 : 1;
export const flashScale = (s: Settings) => s.flashes === 'low' ? 0.3 : 1;

/** Distances in CSS pixels: past `swipe` a drag fires at once; under `tap` a release is a tap. */
export function swipeDistances(s: Settings): { swipe: number; tap: number } {
  if (s.swipe === 'short') return { swipe: 26, tap: 16 };
  if (s.swipe === 'long') return { swipe: 60, tap: 34 };
  return { swipe: 40, tap: 25 };
}

/** Seconds before an enemy hit lands during which a parry works. */
export const parryWindow = (s: Settings) => s.relaxedParry ? 0.55 : 0.4;

/** Floating text that is only a number ("37", "+12") counts as a damage number. */
export const isNumberText = (txt: string) => /^[+-]?\d+$/.test(txt);

/* ---------- save codes ---------- */
// A save code is the save as JSON, base64-encoded with a short prefix, so a
// player can copy it into a note and load it on another device.

const PREFIX = 'SIGIL1:';

export function encodeSave(data: unknown): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let bin = ''; bytes.forEach(b => (bin += String.fromCharCode(b)));
  return PREFIX + btoa(bin);
}

/** Read a save code back. Returns null for anything that isn't a readable Sigilbound save. */
export function decodeSave(code: string): any | null {
  const t = code.trim().replace(/\s+/g, '');
  if (!t.startsWith(PREFIX)) return null;
  try {
    const bin = atob(t.slice(PREFIX.length));
    const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
    const s = JSON.parse(new TextDecoder().decode(bytes));
    if (!s || typeof s !== 'object' || !Array.isArray(s.roster) || !Array.isArray(s.team)) return null;
    return s;
  } catch (e) { return null; }
}
