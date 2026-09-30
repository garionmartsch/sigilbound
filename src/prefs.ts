import { SETTINGS_KEY, normalizeSettings, type Settings } from './settingsCore';
import { RM } from './util';

/*
 * The live settings for this device, loaded once at start. Game code reads
 * `prefs` directly; the settings menu changes it through setPref so the
 * change is stored and anything listening (the sound engine) can react.
 */

function read(key: string): string | null { try { return localStorage.getItem(key); } catch (e) { return null; } }

function load(): Settings {
  let raw: unknown = null;
  try { const t = read(SETTINGS_KEY); if (t) raw = JSON.parse(t); } catch (e) { /* broken value, use defaults */ }
  // The two older keys only matter until settings have been stored once.
  const legacy = raw ? {} : { muted: read('sigilbound-muted'), haptics: read('sigilbound-haptics') };
  return normalizeSettings(raw, RM, legacy);
}

export const prefs: Settings = load();

const listeners: ((s: Settings) => void)[] = [];
export const onPrefs = (fn: (s: Settings) => void) => { listeners.push(fn); };

export function setPref<K extends keyof Settings>(key: K, value: Settings[K]) {
  prefs[key] = value;
  Object.assign(prefs, normalizeSettings(prefs, RM));
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs)); } catch (e) { /* storage unavailable */ }
  listeners.forEach(fn => fn(prefs));
}
