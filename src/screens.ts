import { frontier, planStage } from './campaign';
import { emit } from './events';
import { openMapAtFrontier, renderMap } from './map';
import { save, teamMembers } from './save';
import type { Screen } from './types';
import { cardHTML, openSheet, renderAltar, renderForge, renderRoster } from './ui';
import { $, $$ } from './util';

/* ---------- screens ---------- */
export let current: Screen = 'home';
const SCREENS: Screen[] = ['home', 'battle', 'altar', 'roster', 'forge', 'map'];

export function show(n: Screen) {
  SCREENS.forEach(id => { $('#' + id).hidden = id !== n; });
  current = n;
  if (n === 'home') renderHome();
  if (n === 'altar') renderAltar();
  if (n === 'roster') renderRoster();
  if (n === 'forge') renderForge();
  if (n === 'map') { $('#mShards').textContent = String(save.shards); $('#mGold').textContent = String(save.gold); renderMap(); }
  if (n !== 'roster') $('#sheet').hidden = true;
  if (n !== 'map') $('#stageSheet').hidden = $('#storySheet').hidden = true;
  emit('screen', n);
}
$$('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go as Screen)));

export function renderHome() {
  $('#hShards').textContent = String(save.shards);
  $('#hGold').textContent = String(save.gold);
  $('#hStage').textContent = String(Object.values(save.campaign.stars).reduce((a, b) => a + b, 0));
  $('#hCount').textContent = String(save.roster.length);
  const next = planStage(frontier(save.campaign));
  $('#btnFight').textContent = `Campaign · ${next.label} ${next.name}`;
  $('#hTeam').innerHTML = teamMembers().map(m => cardHTML(m)).join('');
  $$('#hTeam .card').forEach(b => b.addEventListener('click', () => { show('roster'); openSheet(Number(b.dataset.id)); }));
}
$('#btnFight').addEventListener('click', () => { emit('fight'); openMapAtFrontier(); });
$('#btnAltar').addEventListener('click', () => show('altar'));
$('#btnRoster').addEventListener('click', () => show('roster'));
