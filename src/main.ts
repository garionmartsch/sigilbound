import './styles.css';
import { B, drawBattle, updateBattle, updateHud } from './battle';
import { ELEM, ELEM_ORDER } from './data';
import { drawMonster } from './render';
import { current, show } from './screens';
import { initSound } from './sfx';
import { EFFECT_TEXT } from './status';
import { drawAltar, drawForge } from './ui';
import { $, $$, clock, fit } from './util';

/* ---------- card portraits ---------- */
/** Animate every visible beast portrait (cards, team slots, detail sheet). */
function drawPortraits() {
  const vh = window.innerHeight;
  $$<HTMLCanvasElement>('canvas.pcan').forEach(cv => {
    if (!cv.offsetParent) return;
    const r = cv.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    const f = fit(cv); if (!f) return;
    const { c, w, h } = f;
    c.clearRect(0, 0, w, h);
    const s = Math.min(w, h) * 0.28;
    drawMonster(c, cv.dataset.sp || '', w / 2, h * 0.6, s, clock.t + (Number(cv.dataset.seed) || 0),
      { dir: 1, evo: Number(cv.dataset.evo) || 0, alpha: cv.dataset.dead ? 0.3 : 1 });
  });
}

/* ---------- main loop ---------- */
let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; clock.t += dt;
  if (current === 'battle' && B) { updateBattle(dt); if (B) { drawBattle(); updateHud(); } }
  if (current === 'altar') drawAltar(dt);
  if (current === 'forge') drawForge(dt);
  drawPortraits();
  requestAnimationFrame(loop);
}

/* ---------- start ---------- */
$('#elemT').innerHTML = '<tr><th>Element</th><th>Strong vs</th><th>Weak to</th><th>Effect</th></tr>' + ELEM_ORDER.map(k => {
  const weak = ELEM_ORDER.filter(o => ELEM[o].beats.includes(k));
  return `<tr><td><span class="chip ${k}">${ELEM[k].name}</span></td><td>${ELEM[k].beats.map(b => ELEM[b].name).join(', ')}</td><td>${weak.map(b => ELEM[b].name).join(', ')}</td><td>${EFFECT_TEXT[k]}</td></tr>`;
}).join('');
initSound();
show('home');
requestAnimationFrame(loop);
