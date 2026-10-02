import { B } from './battle';
import { hooks } from './events';
import { KEY } from './save';
import { current, show } from './screens';
import { closeSettings, openSettings } from './settings';
import { SETTINGS_KEY } from './settingsCore';
import { $ } from './util';

/*
 * Phone-app extras, used only when the game runs inside the Capacitor app
 * (see capacitor.config.json). In a browser none of this loads: the plugin
 * imports below are dynamic and only run on a phone.
 *
 *   haptics   native vibration, which also works on iPhone (browsers can't)
 *   storage   saves and settings are copied to app storage, which the phone
 *             won't clear the way it may clear browser storage
 *   back      Android's back button closes menus, pauses fights and goes home
 */

const W = window as any;

/** True inside the iOS or Android app, false in a browser. */
export function isNativeApp(): boolean {
  const cap = W.Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  const p = cap?.getPlatform?.();
  return p === 'ios' || p === 'android';
}

export async function initNative() {
  if (!isNativeApp()) return;
  document.documentElement.classList.add('native');
  addBundledFonts();
  const parts = { storage: initStorage, haptics: initHaptics, back: initBack };
  const ok = await Promise.all(Object.entries(parts).map(([name, fn]) =>
    fn().then(() => `${name}=ok`, e => { console.error(`native ${name} failed`, e); return `${name}=failed`; })));
  // The CI emulator check looks for this line in the device log.
  console.log(`[sigilbound] app ready ${ok.join(' ')} screen=${current}`);
}

/* ---------- fonts ---------- */
/** The app ships its fonts (tools/fetch-fonts.sh puts them in public/fonts) so text looks right offline. */
function addBundledFonts() {
  const face = (family: string, file: string, weight: string) =>
    `@font-face{font-family:'${family}';src:url(/fonts/${file}) format('truetype');font-weight:${weight};font-display:swap}`;
  const css = [face('Sigil Display', 'GrenzeGotisch.ttf', '100 900'),
    ...[['Regular', '400'], ['Medium', '500'], ['SemiBold', '600'], ['Bold', '700 800']].map(([n, w]) => face('Sigil UI', `BarlowSemiCondensed-${n}.ttf`, w))];
  const style = document.createElement('style'); style.textContent = css.join('\n'); document.head.appendChild(style);
}

/* ---------- storage ---------- */
const readLocal = (key: string) => { try { return localStorage.getItem(key); } catch (e) { return null; } };
/** What browser storage held when the page loaded, before the game had a chance to write a fresh save. */
const atStart: Record<string, string | null> = { [KEY]: readLocal(KEY), [SETTINGS_KEY]: readLocal(SETTINGS_KEY) };

async function initStorage() {
  const { Preferences } = await import('@capacitor/preferences');
  // The phone cleared the WebView's storage but app storage still has a copy: restore it and start again.
  let restored = false;
  for (const key of [KEY, SETTINGS_KEY]) {
    const { value } = await Preferences.get({ key });
    if (!atStart[key] && value) { try { localStorage.setItem(key, value); restored = true; } catch (e) { /* unavailable */ } }
    else { const now = readLocal(key); if (now && now !== value) await Preferences.set({ key, value: now }); }
  }
  if (restored && !sessionStorage.getItem('sigilbound-restored')) {
    sessionStorage.setItem('sigilbound-restored', '1');
    location.reload();
    return;
  }
  hooks.storageMirror = (key, value) => { Preferences.set({ key, value }).catch(() => {}); };
}

/* ---------- haptics ---------- */
async function initHaptics() {
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  /** One pulse: short ones are taps of increasing weight, long ones a real vibration. */
  const pulse = (ms: number) => {
    if (ms >= 120) return Haptics.vibrate({ duration: ms });
    const style = ms < 15 ? ImpactStyle.Light : ms < 50 ? ImpactStyle.Medium : ImpactStyle.Heavy;
    return Haptics.impact({ style });
  };
  // Patterns alternate pulse, pause, pulse... like navigator.vibrate.
  hooks.haptic = pattern => {
    let at = 0;
    pattern.forEach((ms, i) => {
      if (i % 2 === 0) setTimeout(() => { pulse(ms).catch(() => {}); }, at);
      at += ms;
    });
  };
}

/* ---------- Android back button ---------- */
async function initBack() {
  const { App } = await import('@capacitor/app');
  await App.addListener('backButton', () => {
    // Close whatever is on top first.
    if (!$('#setSheet').hidden) { closeSettings(); return; }
    for (const id of ['#sheet', '#stageSheet', '#storySheet']) {
      const el = document.querySelector<HTMLElement>(id);
      if (el && !el.hidden) { el.hidden = true; return; }
    }
    if (current === 'battle') {
      // Mid-fight, back pauses rather than throwing the fight away.
      if (B && !B.over) openSettings();
      return;
    }
    if (current === 'home') { App.minimizeApp().catch(() => {}); return; }
    show('home');
  });
}
