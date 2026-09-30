import { startBattle } from './battle';
import {
  CHEST_MILESTONES, GATE, MAIN_STAGES, SIDE_AFTER, chestReward, claimChest, firstClearBonus, frontier,
  planStage, regionKey, regionMaxStars, regionStages, regionStars, regionUnlocked, roman, stageId, stageUnlocked,
  topCircle, type StageRef,
} from './campaign';
import { ELEM, ELEM_ORDER, FORMS, RARITY, SPECIES, elemMult } from './data';
import { REGIONS, SIGIL_GATE, returnIntro } from './regions';
import { newCard, persist, save, teamMembers } from './save';
import { show } from './screens';
import { SFX, buzz } from './sfx';
import type { ElementKey } from './types';
import { $, clamp, ell, fit, rand, rgba } from './util';

/*
 * The campaign map: one region at a time, drawn as a trail climbing from
 * stage 1 at the bottom to the region's ruler at the top, with two side
 * stages branching off. Nodes are real buttons laid over a canvas that
 * paints the region's sky, its trail and drifting weather for its element.
 */

const wrap = $('#mapWrap'), cv = $<HTMLCanvasElement>('#mapCan'), nodesEl = $('#mapNodes');
const head = $('#mHead'), stageSheet = $('#stageSheet'), stageBox = $('#stageBox');
const storySheet = $('#storySheet'), storyBox = $('#storyBox');

const GAP = 100, TOP = 96, BOTTOM = 64;
const view = () => save.campaign.view ?? (() => { const f = frontier(save.campaign); return { circle: f.circle, region: f.region }; })();

/** Show the map at the region holding the next uncleared stage. */
export function openMapAtFrontier() {
  const f = frontier(save.campaign);
  save.campaign.view = { circle: f.circle, region: f.region };
  persist();
  show('map');
}

/* ---------- layout ---------- */
interface NodePos { ref: StageRef; x: number; y: number }

function mapHeight(region: number) {
  return region === GATE ? 420 : TOP + BOTTOM + (MAIN_STAGES - 1) * GAP;
}

/** Where every stage sits: main stages zigzag upward, side stages branch off to the open side. */
function layout(circle: number, region: number): NodePos[] {
  const H = mapHeight(region);
  if (region === GATE) return [{ ref: regionStages(circle, GATE)[0], x: 0.5, y: H * 0.46 }];
  const main = Array.from({ length: MAIN_STAGES }, (_, i) => ({
    ref: { circle, region, kind: 'main' as const, index: i },
    x: 0.5 + 0.27 * Math.sin(i * 1.2 + 0.6 + region * 0.9),
    y: H - BOTTOM - i * GAP,
  }));
  main[MAIN_STAGES - 1].x = 0.5;
  const side = SIDE_AFTER.map((a, j) => {
    const m = main[a], n = main[a + 1];
    return {
      ref: { circle, region, kind: 'side' as const, index: j },
      x: m.x < 0.5 ? Math.min(0.86, m.x + 0.36) : Math.max(0.14, m.x - 0.36),
      y: (m.y + n.y) / 2,
    };
  });
  return [...main, ...side];
}

/* ---------- rendering ---------- */
const starsHtml = (n: number) => [1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}">★</i>`).join('');
const chip = (el: ElementKey) => `<span class="chip ${el}">${ELEM[el].name}</span>`;
/** Elements that deal extra damage to el. */
const countersOf = (el: ElementKey) => ELEM_ORDER.filter(k => ELEM[k].beats.includes(el));

export function renderMap() {
  const v = view(), s = save.campaign;
  const isGate = v.region === GATE;
  const reg = isGate ? null : REGIONS[v.region];
  const el: ElementKey = isGate ? SPECIES[SIGIL_GATE.bosses[(v.circle - 1) % SIGIL_GATE.bosses.length]].el : reg!.el;
  const f = frontier(s), fid = stageId(f);

  // Header: region switcher, stars, chests, counter advice.
  const prev = step(v, -1), next = step(v, 1);
  const got = regionStars(s, v.circle, v.region), max = regionMaxStars(v.region);
  const claimed = s.chests[regionKey(v.circle, v.region)] ?? [];
  const chests = isGate ? '' : `<div class="mh-chests">${CHEST_MILESTONES.map(m => {
    const state = claimed.includes(m) ? 'done' : got >= m ? 'ready' : 'locked';
    const r = chestReward(v.circle, v.region, m);
    const what = r.card ? `${RARITY[SPECIES[r.card].rarity].label} card` : [r.shards && `${r.shards} shards`, r.gold && `${r.gold} gold`].filter(Boolean).join(' + ');
    return `<button class="chest ${state}" data-m="${m}" ${state === 'ready' ? '' : 'aria-disabled="true"'} title="${what}">${CHEST_SVG}<span>${state === 'done' ? 'Opened' : state === 'ready' ? 'Open' : `${m}★`}</span></button>`;
  }).join('')}</div>`;
  head.innerHTML = `
    <div class="mh-nav">
      <button class="mh-arrow" id="mPrev" ${prev ? '' : 'disabled'} aria-label="Previous region">‹</button>
      <div class="mh-title"><span class="mh-eyebrow">Circle ${roman(v.circle)} · ${isGate ? 'Finale' : `Region ${v.region + 1} of 9`}</span><h2>${isGate ? SIGIL_GATE.name : reg!.name}</h2></div>
      <button class="mh-arrow" id="mNext" ${next ? '' : 'disabled'} aria-label="Next region">›</button>
    </div>
    <div class="mh-row">${chip(el)}<span class="mh-stars">★ ${got} / ${max}</span><span class="mh-counter">Counter with ${countersOf(el).map(chip).join(' ')}</span></div>
    ${chests}`;
  $('#mPrev').onclick = () => prev && go(prev);
  $('#mNext').onclick = () => next && go(next);
  head.querySelectorAll<HTMLElement>('.chest.ready').forEach(b => b.onclick = () => openChest(v.circle, v.region, Number(b.dataset.m)));

  // Nodes.
  const H = mapHeight(v.region);
  wrap.style.height = `${H}px`;
  nodesEl.innerHTML = layout(v.circle, v.region).map(({ ref, x, y }) => {
    const p = planStage(ref), stars = s.stars[p.id] ?? 0, open = stageUnlocked(s, ref);
    const cls = ['mnode', ref.kind, p.isBoss ? 'boss' : '', stars ? 'cleared' : '', open ? '' : 'locked', p.id === fid ? 'current' : ''].join(' ');
    const ruler = p.waves[2];
    const inner = p.isBoss
      ? `<canvas class="pcan" data-sp="${ruler.key}" data-evo="${ruler.evo}" data-seed="2"></canvas><span class="mn-tag">${p.kind === 'gate' ? 'Gate' : 'Boss'}</span>`
      : `<span class="mn-num">${ref.kind === 'side' ? `S${ref.index + 1}` : ref.index + 1}</span>`;
    return `<button class="${cls}" style="left:${x * 100}%;top:${y}px;--ec:${ELEM[p.el].color}" data-id="${p.id}" aria-label="${p.label} ${p.name}${open ? '' : ', locked'}${stars ? `, ${stars} stars` : ''}">
      ${inner}${open ? `<span class="mn-stars">${starsHtml(stars)}</span>` : LOCK_SVG}</button>`;
  }).join('');
  nodesEl.querySelectorAll<HTMLElement>('.mnode').forEach(b => b.onclick = () => openStage(b.dataset.id!));
  resetWeather(el);

  // The first visit to a region tells its story.
  const key = regionKey(v.circle, v.region);
  if (regionUnlocked(s, v.circle, v.region) && !s.seen.includes(key)) openStory(v.circle, v.region);
  // Bring the next stage into view.
  requestAnimationFrame(() => nodesEl.querySelector('.mnode.current, .mnode.boss')?.scrollIntoView({ block: 'center' }));
}

/** The region before or after this one, crossing into other Circles; null if locked. */
function step(v: { circle: number; region: number }, dir: 1 | -1) {
  let { circle, region } = v;
  region += dir;
  if (region < 0) { if (circle === 1) return null; circle--; region = GATE; }
  if (region > GATE) { circle++; region = 0; }
  if (circle > topCircle(save.campaign) || !regionUnlocked(save.campaign, circle, region)) return null;
  return { circle, region };
}
function go(v: { circle: number; region: number }) {
  save.campaign.view = v; persist(); SFX.play('ui'); renderMap();
  $('#map').scrollTop = 0;
}

/* ---------- stage card ---------- */
function openStage(id: string) {
  const ref = layout(view().circle, view().region).map(n => n.ref).find(r => stageId(r) === id);
  if (!ref) return;
  const s = save.campaign, p = planStage(ref), open = stageUnlocked(s, ref), stars = s.stars[p.id] ?? 0;
  const bonus = firstClearBonus(p);
  const team = teamMembers().map(m => {
    const e = SPECIES[m.sp].el, up = elemMult(e, p.el) > 1, down = elemMult(p.el, e) > 1;
    return `<span class="sh-mate ${up ? 'good' : down ? 'bad' : ''}">${FORMS[m.sp][m.evo || 0]} ${up ? '▲' : down ? '▼' : '–'}</span>`;
  }).join('');
  const needs = ref.kind === 'side' ? `stage ${ref.region + 1}-${SIDE_AFTER[ref.index] + 1}` : ref.kind === 'gate' ? 'the Nightfall' : ref.index > 0 ? `stage ${ref.region + 1}-${ref.index}` : 'the previous region';
  stageBox.innerHTML = `
    <div class="sh-top">${chip(p.el)}<span class="sh-label">${p.label}${ref.kind === 'side' ? ' · Side stage' : ''}</span><span class="sh-stars">${starsHtml(stars)}</span></div>
    <h3>${p.name}</h3>
    ${p.bossLine ? `<p class="sh-quote">${p.bossLine}</p>` : ''}
    <div class="sh-enemies">${p.waves.map((w, i) => `
      <div class="se ${w.boss ? 'ruler' : w.leader ? 'leader' : ''}">
        <canvas class="pcan" data-sp="${w.key}" data-evo="${w.evo}" data-seed="${i * 1.7}"></canvas>
        <b>${FORMS[w.key][w.evo]}</b><small>Lv ${w.lvl} · ${ELEM[SPECIES[w.key].el].name}</small>
        <em>${w.boss ? 'Boss' : w.leader ? 'Leader' : `Wave ${i + 1}`}</em>
      </div>`).join('')}</div>
    <p class="sh-hint">Strong here: ${countersOf(p.el).map(chip).join(' ')}</p>
    <div class="sh-team"><span>Your team</span>${team}<button class="linkish" id="shTeam">Change team</button></div>
    <ul class="sh-crit"><li>★ Clear the stage</li><li>★ Lose no beast</li><li>★ Finish under ${p.par}s</li></ul>
    <p class="sh-reward">${stars ? 'Cleared. Replay for shards, gold and card drops.' : `First clear bonus: <b>+${bonus.shards}</b> shards · <b>+${bonus.gold}</b> gold`}${ref.kind === 'side' ? ' Side stages drop cards twice as often.' : ''}</p>
    ${open ? '' : `<p class="sh-locked">Clear ${needs} to open this stage.</p>`}
    <div class="dacts"><button id="shClose">Close</button><button class="primary" id="shFight" ${open ? '' : 'disabled'}>Fight</button></div>`;
  stageSheet.hidden = false;
  $('#shClose').onclick = () => { stageSheet.hidden = true; };
  $('#shTeam').onclick = () => { stageSheet.hidden = true; show('roster'); };
  $('#shFight').onclick = () => { if (!open) return; stageSheet.hidden = true; startBattle({ plan: p }); };
}
stageSheet.addEventListener('click', e => { if (e.target === stageSheet) stageSheet.hidden = true; });

/* ---------- story and chests ---------- */
function openStory(circle: number, region: number) {
  const isGate = region === GATE, reg = isGate ? null : REGIONS[region];
  const boss = isGate ? SIGIL_GATE.bosses[(circle - 1) % SIGIL_GATE.bosses.length] : reg!.boss;
  const evo = Math.min(2, circle - 1);
  const text = isGate ? SIGIL_GATE.intro : circle === 1 ? reg!.intro : region === 0 ? SIGIL_GATE.after : returnIntro(reg!.name, roman(circle));
  storyBox.innerHTML = `
    <span class="st-eyebrow">Circle ${roman(circle)} · ${isGate ? 'Finale' : `Region ${region + 1}`}</span>
    <canvas class="pcan st-boss" data-sp="${boss}" data-evo="${evo}" data-seed="3"></canvas>
    <h2>${isGate ? SIGIL_GATE.name : reg!.name}</h2>
    <p>${text}</p>
    <p class="st-ruler">${isGate ? 'Guardian' : 'Ruler'}: <b>${FORMS[boss][evo]}</b> ${chip(SPECIES[boss].el)}</p>
    <button class="primary" id="stGo">Begin</button>`;
  storySheet.hidden = false;
  $('#stGo').onclick = () => {
    storySheet.hidden = true;
    const key = regionKey(circle, region);
    if (!save.campaign.seen.includes(key)) { save.campaign.seen.push(key); persist(); }
  };
}

function openChest(circle: number, region: number, milestone: number) {
  const r = claimChest(save.campaign, circle, region, milestone);
  if (!r) return;
  save.shards += r.shards; save.gold += r.gold;
  if (r.card) newCard(save, r.card);
  persist();
  SFX.play('reveal', r.card ? SPECIES[r.card].rarity : 'rare'); buzz([30, 40, 80]);
  const card = r.card ? SPECIES[r.card] : null;
  storyBox.innerHTML = `
    <span class="st-eyebrow">${milestone}★ chest</span>
    ${card ? `<canvas class="pcan st-boss" data-sp="${r.card}" data-evo="0" data-seed="1"></canvas><h2>${card.name} joins you</h2>
      <p>A ${RARITY[card.rarity].label} ${ELEM[card.el].name} beast, added to your collection.</p>`
      : `<h2>Chest opened</h2><p>${[r.shards && `<b>+${r.shards}</b> soul shards`, r.gold && `<b>+${r.gold}</b> gold`].filter(Boolean).join(' · ')}</p>`}
    <button class="primary" id="stGo">Collect</button>`;
  storySheet.hidden = false;
  $('#stGo').onclick = () => { storySheet.hidden = true; renderMap(); };
}
storySheet.addEventListener('click', e => { if (e.target === storySheet) $('#stGo').click(); });

const LOCK_SVG = '<svg class="mn-lock" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const CHEST_SVG = '<svg viewBox="0 0 24 20" aria-hidden="true"><path d="M3 8h18v10H3z" fill="currentColor" opacity=".35"/><path d="M3 8a9 6 0 0 1 18 0" fill="currentColor" opacity=".6"/><rect x="3" y="7" width="18" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 11h18" stroke="currentColor" stroke-width="1.6"/><rect x="10.5" y="9.5" width="3" height="4" rx=".8" fill="currentColor"/></svg>';

/* ---------- canvas: sky, trail and weather ---------- */
interface Mote { x: number; y: number; vx: number; vy: number; r: number; ph: number }
let motes: Mote[] = [], weatherEl: ElementKey = 'pyre', flashT = 0;

/** How each element's weather moves: drift speed (px/s), size and shape. */
const WEATHER: Record<ElementKey, { vx: number; vy: number; r: [number, number]; shape: 'dot' | 'ring' | 'leaf' | 'flake' | 'streak' | 'spark' }> = {
  pyre: { vx: 6, vy: -28, r: [1.2, 2.6], shape: 'dot' },
  tide: { vx: 0, vy: -18, r: [2, 5], shape: 'ring' },
  thorn: { vx: 10, vy: 16, r: [3, 5], shape: 'leaf' },
  frost: { vx: 6, vy: 22, r: [1.2, 3], shape: 'flake' },
  storm: { vx: 0, vy: 0, r: [1, 2.2], shape: 'spark' },
  stone: { vx: 8, vy: 6, r: [1, 2.4], shape: 'dot' },
  gale: { vx: 90, vy: -4, r: [8, 20], shape: 'streak' },
  radiant: { vx: 0, vy: -12, r: [1.2, 2.8], shape: 'dot' },
  umbral: { vx: 0, vy: 10, r: [1.5, 3.4], shape: 'dot' },
};

function resetWeather(el: ElementKey) {
  weatherEl = el;
  const H = wrap.clientHeight || 800, W = wrap.clientWidth || 360, w = WEATHER[el];
  motes = Array.from({ length: 46 }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: w.vx * rand(0.6, 1.4), vy: w.vy * rand(0.6, 1.4), r: rand(w.r[0], w.r[1]), ph: Math.random() * 6 }));
}

export function drawMap(dt: number) {
  const f = fit(cv); if (!f) return;
  const { c, w, h } = f, v = view(), isGate = v.region === GATE;
  const sky = isGate ? SIGIL_GATE.sky : REGIONS[v.region].sky, ground = isGate ? SIGIL_GATE.ground : REGIONS[v.region].ground;
  const col = ELEM[weatherEl].color, t = performance.now() / 1000;
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, sky); g.addColorStop(1, ground);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  const glow = c.createRadialGradient(w / 2, TOP - 10, 10, w / 2, TOP - 10, w * 0.8);
  glow.addColorStop(0, rgba(col, 0.28)); glow.addColorStop(1, rgba(col, 0));
  c.fillStyle = glow; c.fillRect(0, 0, w, h);
  drawScenery(c, w, h, v.region, isGate ? '#000000' : ground);

  // Trail: a dark road, lit in the element's color where the player has cleared it.
  const pos = layout(v.circle, v.region), s = save.campaign;
  const main = pos.filter(p => p.ref.kind === 'main');
  const P = (p: NodePos) => [p.x * w, p.y] as const;
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const side of pos.filter(p => p.ref.kind === 'side')) {
    const a = main[SIDE_AFTER[side.ref.index]], [x0, y0] = P(a), [x1, y1] = P(side);
    const lit = stageUnlocked(s, side.ref);
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 9; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = lit ? rgba(col, 0.75) : 'rgba(255,255,255,0.12)'; c.lineWidth = 2.5; c.setLineDash([2, 7]);
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.setLineDash([]);
  }
  for (let i = 1; i < main.length; i++) {
    const [x0, y0] = P(main[i - 1]), [x1, y1] = P(main[i]), my = (y0 + y1) / 2;
    const path = () => { c.beginPath(); c.moveTo(x0, y0); c.bezierCurveTo(x0, my, x1, my, x1, y1); };
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 16; path(); c.stroke();
    const done = (s.stars[stageId(main[i - 1].ref)] ?? 0) > 0;
    if (done) { c.strokeStyle = rgba(col, 0.9); c.lineWidth = 4; c.shadowColor = col; c.shadowBlur = 10; path(); c.stroke(); c.shadowBlur = 0; }
    else { c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 3; c.setLineDash([6, 9]); path(); c.stroke(); c.setLineDash([]); }
  }
  if (isGate) {
    // A great ring of runes around the Gate.
    const [gx, gy] = P(pos[0]);
    c.save(); c.translate(gx, gy); c.rotate(t * 0.15);
    for (let k = 0; k < 3; k++) { c.strokeStyle = `hsla(${(t * 40 + k * 120) % 360},80%,70%,0.4)`; c.lineWidth = 2; ell(c, 0, 0, 130 + k * 16, 130 + k * 16); c.stroke(); }
    c.restore();
  }

  // Weather.
  const wx = WEATHER[weatherEl];
  if (weatherEl === 'storm') { flashT -= dt; if (flashT < -rand(2, 5)) flashT = 0.12; if (flashT > 0) { c.fillStyle = 'rgba(255,246,176,0.12)'; c.fillRect(0, 0, w, h); } }
  for (const m of motes) {
    m.x += m.vx * dt; m.y += m.vy * dt;
    if (m.y < -10) m.y = h + 10; if (m.y > h + 10) m.y = -10;
    if (m.x < -30) m.x = w + 30; if (m.x > w + 30) m.x = -30;
    const a = 0.35 + 0.3 * Math.sin(t * 2 + m.ph);
    c.globalAlpha = clamp(a, 0.1, 0.8);
    c.fillStyle = col; c.strokeStyle = col;
    if (wx.shape === 'dot') { ell(c, m.x, m.y, m.r, m.r); c.fill(); }
    else if (wx.shape === 'ring') { c.lineWidth = 1.2; ell(c, m.x, m.y, m.r, m.r); c.stroke(); }
    else if (wx.shape === 'leaf') { c.save(); c.translate(m.x + Math.sin(t + m.ph) * 8, m.y); c.rotate(t + m.ph); ell(c, 0, 0, m.r, m.r * 0.45); c.fill(); c.restore(); }
    else if (wx.shape === 'flake') { c.fillStyle = '#FFFFFF'; ell(c, m.x + Math.sin(t + m.ph) * 6, m.y, m.r, m.r); c.fill(); }
    else if (wx.shape === 'streak') { c.lineWidth = 1.2; c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(m.x - m.r * 2, m.y); c.stroke(); }
    else if (Math.sin(t * 9 + m.ph * 7) > 0.6) { c.fillStyle = '#FFF6B0'; ell(c, m.x, m.y, m.r, m.r); c.fill(); }
  }
  c.globalAlpha = 1;
}

/** Soft silhouettes along both edges so each region reads as a place. */
function drawScenery(c: CanvasRenderingContext2D, w: number, h: number, region: number, base: string) {
  c.fillStyle = rgba(base === '#000000' ? '#000000' : base, 0.75);
  for (let side = 0; side < 2; side++) {
    c.beginPath();
    const x0 = side ? w : 0, dir = side ? -1 : 1;
    c.moveTo(x0, h);
    for (let y = h; y >= -20; y -= 40) {
      const bump = 26 + 22 * Math.abs(Math.sin(y * 0.021 + region * 1.7 + side * 2.3)) + (region % 3 === 0 && Math.sin(y * 0.05) > 0.7 ? 18 : 0);
      c.lineTo(x0 + dir * bump, y);
    }
    c.lineTo(x0, -20); c.closePath(); c.fill();
  }
}
