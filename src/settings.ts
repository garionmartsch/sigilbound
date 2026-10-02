import { B } from './battle';
import { emit } from './events';
import { prefs, setPref } from './prefs';
import { migrate, replaceSave, resetSave, save } from './save';
import { current, renderHome, show } from './screens';
import { decodeSave, encodeSave, type Settings } from './settingsCore';
import { SFX, buzz, canBuzz } from './sfx';
import { THEMES, cssVars, themeById } from './themes';
import { replay } from './tutorial';
import { $, $$ } from './util';

/*
 * The settings menu. It opens as a sheet over whatever screen is showing;
 * opened from a fight it pauses the fight until it closes.
 */

export const VERSION = '0.5.0';

const sheet = $('#setSheet'), box = $('#setBox');
let pausedFight = false;
/** Which extra panel is open under the save-code buttons. */
let codePanel: '' | 'copy' | 'load' = '';
let resetArm = 0, loadArm = 0;

/** True while the menu covers a fight, so the game loop holds the fight still. */
export const isPaused = () => !sheet.hidden && current === 'battle';

export function openSettings() {
  pausedFight = current === 'battle' && !!B && !B.over;
  codePanel = ''; resetArm = loadArm = 0;
  render();
  sheet.hidden = false;
  box.scrollTop = 0;
  $<HTMLButtonElement>('#setClose').focus({ preventScroll: true });
  emit('settings', true);
}
export function closeSettings() {
  if (sheet.hidden) return;
  sheet.hidden = true;
  emit('settings', false);
  (current === 'battle' ? $('#btnPause') : $('#btnSettings')).focus({ preventScroll: true });
}

/* ---------- building blocks ---------- */
const sw = (key: keyof Settings, label: string, sub = '') => {
  const on = !!prefs[key];
  return `<div class="srow"><div class="slabel"><b id="l-${key}">${label}</b>${sub ? `<small>${sub}</small>` : ''}</div>
    <button class="switch" role="switch" aria-checked="${on}" aria-labelledby="l-${key}" data-sw="${key}"><i></i></button></div>`;
};
const seg = (key: keyof Settings, label: string, opts: [string, string][], sub = '', disabled = false) =>
  `<div class="srow col"><div class="slabel"><b id="l-${key}">${label}</b>${sub ? `<small>${sub}</small>` : ''}</div>
    <div class="seg" role="radiogroup" aria-labelledby="l-${key}">${opts.map(([v, t]) =>
      `<button role="radio" aria-checked="${prefs[key] === v}" data-seg="${key}" data-v="${v}" ${disabled ? 'disabled' : ''}>${t}</button>`).join('')}</div></div>`;

function render() {
  const inFight = current === 'battle' && !!B;
  const armed = (t: number) => Date.now() - t < 3000;
  box.innerHTML = `
    <div class="sethead"><h2 id="setTitle">${pausedFight ? 'Paused' : 'Settings'}</h2>
      <button class="ghost xbtn" id="setClose" aria-label="${pausedFight ? 'Resume' : 'Close settings'}">✕</button></div>
    ${pausedFight ? '<button class="primary" id="setResume">Resume fight</button>' : ''}

    <section class="sgroup" aria-labelledby="g-theme"><h3 id="g-theme">Theme</h3>
      <div class="themes" role="radiogroup" aria-labelledby="g-theme">${THEMES.map(t => {
        const u = t.ui, on = prefs.theme === t.id;
        return `<button role="radio" aria-checked="${on}" data-tp="${t.id}" class="tpick"
          style="--p-bg:${u.bg};--p-stone:${u.stone2};--p-line:${u.line};--p-text:${u.text};--p-muted:${u.muted};--p-gold:${u.gold};--p-hi:${u.btnHi};--p-lo:${u.btnLo};--p-glow:${u.glowTop}">
          <span class="tp-swatch" aria-hidden="true"><i class="tp-panel"><i class="tp-line"></i><i class="tp-line short"></i></i><i class="tp-btn"></i><i class="tp-dot"></i></span>
          <span class="tp-name">${t.name}</span></button>`;
      }).join('')}</div>
      <small class="snote" id="themeBlurb">${themeById(prefs.theme).blurb} Element and rarity colors stay the same in every theme.</small>
    </section>

    <section class="sgroup" aria-labelledby="g-sound"><h3 id="g-sound">Sound &amp; feel</h3>
      ${sw('sound', 'Sound effects')}
      <div class="srow col"><div class="slabel"><b id="l-volume">Volume</b><small id="volOut">${prefs.volume}%</small></div>
        <div class="volrow"><input type="range" id="setVol" min="0" max="100" step="5" value="${prefs.volume}" aria-labelledby="l-volume" ${prefs.sound ? '' : 'disabled'}>
        <button id="setTest" ${prefs.sound ? '' : 'disabled'}>Test</button></div></div>
      ${seg('buzz', 'Vibration', [['off', 'Off'], ['light', 'Light'], ['normal', 'Normal'], ['strong', 'Strong']],
        canBuzz() ? '' : 'This device or browser can’t vibrate.', !canBuzz())}
    </section>

    <section class="sgroup" aria-labelledby="g-battle"><h3 id="g-battle">Battle</h3>
      ${seg('swipe', 'Swipe distance', [['short', 'Short'], ['normal', 'Normal'], ['long', 'Long']], 'How far your finger travels before a tap becomes a swipe.')}
      ${sw('relaxedParry', 'Relaxed parry timing', 'The gold parry window stays open longer.')}
      ${sw('numbers', 'Damage numbers')}
      ${sw('hints', 'Controls reminder', 'The line of gestures under the battle field.')}
    </section>

    <section class="sgroup" aria-labelledby="g-screen"><h3 id="g-screen">Screen</h3>
      ${seg('shake', 'Screen shake', [['off', 'Off'], ['low', 'Low'], ['full', 'Full']])}
      ${seg('flashes', 'Flashes', [['low', 'Dimmed'], ['full', 'Full']], 'Bright flashes on big hits and lightning.')}
    </section>

    <section class="sgroup" aria-labelledby="g-game"><h3 id="g-game">Game</h3>
      <button id="setTutorial" ${inFight ? 'disabled' : ''}>Replay tutorial</button>
      ${inFight ? '<small class="snote">Finish or leave this fight to replay the tutorial or change your save.</small>' : ''}
      <div class="btn2"><button id="setCopy" ${inFight ? 'disabled' : ''} aria-expanded="${codePanel === 'copy'}">Copy save code</button>
        <button id="setLoad" ${inFight ? 'disabled' : ''} aria-expanded="${codePanel === 'load'}">Load save code</button></div>
      ${codePanel === 'copy' ? `<div class="codebox"><label for="codeOut">Your save code. Keep it somewhere safe, or paste it into Sigilbound on another device.</label>
        <textarea id="codeOut" readonly rows="3">${encodeSave(save)}</textarea><small id="copyMsg" aria-live="polite"></small></div>` : ''}
      ${codePanel === 'load' ? `<div class="codebox"><label for="codeIn">Paste a save code. It replaces your current progress.</label>
        <textarea id="codeIn" rows="3" placeholder="SIGIL1:…" autocomplete="off" spellcheck="false"></textarea>
        <button id="setLoadGo" class="${armed(loadArm) ? 'danger' : ''}">${armed(loadArm) ? 'Tap again to replace your progress' : 'Load this save'}</button>
        <small id="loadMsg" aria-live="polite"></small></div>` : ''}
      <button id="setReset" class="danger-ghost" ${inFight ? 'disabled' : ''}>${armed(resetArm) ? 'Tap again to wipe all progress' : 'Reset progress'}</button>
    </section>

    <p class="about">Sigilbound v${VERSION} · Settings are kept on this device.</p>`;
}

/* ---------- actions ---------- */
function onClick(ev: Event) {
  const t = (ev.target as Element).closest<HTMLElement>('button');
  if (!t || (t as HTMLButtonElement).disabled) return;
  if (t.id === 'setClose' || t.id === 'setResume') { closeSettings(); return; }

  if (t.dataset.sw) {
    const key = t.dataset.sw as keyof Settings;
    setPref(key, !prefs[key] as never);
    if (key === 'sound' && prefs.sound) { SFX.init(); SFX.play('ui'); }
    applyPrefs(); render(); refocus(`[data-sw="${key}"]`); return;
  }
  if (t.dataset.tp) {
    setPref('theme', t.dataset.tp);
    applyTheme(); render(); refocus(`[data-tp="${t.dataset.tp}"]`); return;
  }
  if (t.dataset.seg) {
    const key = t.dataset.seg as keyof Settings;
    setPref(key, t.dataset.v as never);
    if (key === 'buzz') buzz([40, 60, 40]);
    render(); refocus(`[data-seg="${key}"][data-v="${t.dataset.v}"]`); return;
  }
  switch (t.id) {
    case 'setTest': SFX.play('win'); break;
    case 'setTutorial': closeSettings(); show('home'); replay(); break;
    case 'setCopy': codePanel = codePanel === 'copy' ? '' : 'copy'; render(); if (codePanel) copyCode(); refocus('#setCopy'); break;
    case 'setLoad': codePanel = codePanel === 'load' ? '' : 'load'; loadArm = 0; render();
      if (codePanel) $('#codeIn').focus(); else refocus('#setLoad'); break;
    case 'setLoadGo': loadCode(); break;
    case 'setReset': resetProgress(); break;
  }
}

async function copyCode() {
  const out = $<HTMLTextAreaElement>('#codeOut'), msg = $('#copyMsg');
  try { await navigator.clipboard.writeText(out.value); msg.textContent = 'Copied.'; }
  catch (e) { out.focus(); out.select(); msg.textContent = 'Select the code and copy it.'; }
}

function loadCode() {
  const inp = $<HTMLTextAreaElement>('#codeIn'), msg = $('#loadMsg');
  const data = decodeSave(inp.value);
  if (!data) { loadArm = 0; msg.textContent = 'That isn’t a Sigilbound save code. Check that you copied all of it.'; msg.className = 'bad'; return; }
  if (Date.now() - loadArm >= 3000) {
    loadArm = Date.now();
    const b = $('#setLoadGo'); b.textContent = 'Tap again to replace your progress'; b.classList.add('danger');
    msg.textContent = `Found a save with ${data.roster.length} cards.`; msg.className = '';
    return;
  }
  replaceSave(migrate(data));
  finishSwap('Save loaded.');
}

function resetProgress() {
  if (Date.now() - resetArm >= 3000) { resetArm = Date.now(); render(); refocus('#setReset');
    setTimeout(() => { if (!sheet.hidden && Date.now() - resetArm >= 2900) { render(); } }, 3000); return; }
  resetSave();
  finishSwap('Progress reset.');
}

/** After the save is swapped out: back to a fresh home screen, and the tutorial if this save hasn't done it. */
function finishSwap(text: string) {
  resetArm = loadArm = 0;
  closeSettings(); show('home'); renderHome();
  if (!save.tutorial.done) replay();
  toast(text);
}

function toast(text: string) {
  const el = $('#toast'); el.textContent = text; el.hidden = false;
  clearTimeout((el as any)._t); (el as any)._t = setTimeout(() => (el.hidden = true), 2200);
}

/** Re-rendering replaces the buttons, so put keyboard focus back where it was. */
const refocus = (sel: string) => box.querySelector<HTMLElement>(sel)?.focus({ preventScroll: true });

/** Put the chosen theme's colors on the page, and on the phone's status bar. */
export function applyTheme() {
  const t = themeById(prefs.theme), root = document.documentElement;
  for (const [k, v] of Object.entries(cssVars(t))) root.style.setProperty(k, v);
  root.dataset.theme = t.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.ui.bg);
}

/** Settings that change the page rather than the game code. */
export function applyPrefs() {
  applyTheme();
  $$('#battle .hint').forEach(h => (h.hidden = !prefs.hints));
}

export function initSettings() {
  box.addEventListener('click', onClick);
  box.addEventListener('input', ev => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'setVol') { setPref('volume', Number(t.value)); $('#volOut').textContent = `${prefs.volume}%`; }
  });
  box.addEventListener('change', ev => { if ((ev.target as HTMLElement).id === 'setVol') SFX.play('ui'); });
  sheet.addEventListener('click', ev => { if (ev.target === sheet) closeSettings(); });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && !sheet.hidden) { ev.preventDefault(); closeSettings(); }
    else if (ev.key === 'Escape' && current === 'battle' && B && !B.over) { ev.preventDefault(); openSettings(); }
  });
  $('#btnSettings').addEventListener('click', openSettings);
  $('#btnPause').addEventListener('click', openSettings);
  // A fight pauses by itself when the player leaves the app.
  document.addEventListener('visibilitychange', () => { if (document.hidden && current === 'battle' && B && !B.over && sheet.hidden) openSettings(); });
  applyPrefs();
}
