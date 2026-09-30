import { startBattle } from './battle';
import { emit } from './events';
import { resetSave, save, teamMembers } from './save';
import type { Screen } from './types';
import { cardHTML, openSheet, renderAltar, renderForge, renderRoster } from './ui';
import { $, $$ } from './util';

/* ---------- screens ---------- */
export let current: Screen = 'home';
const SCREENS: Screen[] = ['home', 'battle', 'altar', 'roster', 'forge'];

export function show(n: Screen) {
  SCREENS.forEach(id => { $('#' + id).hidden = id !== n; });
  current = n;
  if (n === 'home') renderHome();
  if (n === 'altar') renderAltar();
  if (n === 'roster') renderRoster();
  if (n === 'forge') renderForge();
  if (n !== 'roster') $('#sheet').hidden = true;
  emit('screen', n);
}
$$('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go as Screen)));

export function renderHome() {
  $('#hShards').textContent = String(save.shards);
  $('#hGold').textContent = String(save.gold);
  $('#hStage').textContent = String(save.stage);
  $('#hCount').textContent = String(save.roster.length);
  $('#btnFight').textContent = `Enter Stage ${save.stage}`;
  $('#hTeam').innerHTML = teamMembers().map(m => cardHTML(m)).join('');
  $$('#hTeam .card').forEach(b => b.addEventListener('click', () => { show('roster'); openSheet(Number(b.dataset.id)); }));
}
$('#btnFight').addEventListener('click', () => { emit('fight'); startBattle(); });
$('#btnAltar').addEventListener('click', () => show('altar'));
$('#btnRoster').addEventListener('click', () => show('roster'));

let resetArm = 0;
const resetBtn = $<HTMLButtonElement>('#btnReset');
resetBtn.addEventListener('click', () => {
  if (Date.now() - resetArm < 3000) {
    resetSave(); resetArm = 0;
    resetBtn.textContent = 'Progress reset';
    renderHome();
    setTimeout(() => (resetBtn.textContent = 'Reset progress'), 1500);
    return;
  }
  resetArm = Date.now();
  resetBtn.textContent = 'Tap again to wipe all progress';
  setTimeout(() => { if (Date.now() - resetArm >= 2900) resetBtn.textContent = 'Reset progress'; }, 3000);
});
