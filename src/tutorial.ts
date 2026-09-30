import { B, cur, endBattle, startBattle } from './battle';
import { COST, ELEM, RARITY, SPECIES, nameOf } from './data';
import { hooks, on, type GameEvent } from './events';
import { fodderFor, persist, save, teamMembers } from './save';
import { current } from './screens';
import { REPS, isBattleStep, nextStep, resumeStep, stepLabel, type StepId } from './tutorialFlow';
import { $, RM } from './util';

/*
 * The first-time tutorial.
 *
 * Part one is a training fight with a coach card above the field that teaches
 * one move at a time while a ghost finger demonstrates it. The fight can't be
 * lost: your beasts can't drop below 1 HP, and the enemy can't be finished
 * until the last lesson.
 *
 * Part two is a spotlight tour of the menus: summon a beast (a guaranteed
 * Rare), feed a card, learn how evolving works, then start the campaign.
 *
 * Progress is saved in save.tutorial, so closing the game mid-tour resumes it.
 * Game code reports what the player did through events (src/events.ts); this
 * file reads the page to decide what to point at, and never changes game rules
 * except through the training rules and the summon hook.
 */

const coach = $('#tcoach');
const bubble = $('#tbubble');
const spot = $('#tspot');
const dim = $('#tdim');

/** Moves made in the current lesson. */
let count = 0;
/** Parry attempts that got hit instead. */
let misses = 0;
/** A line shown in one lesson about what the previous move just did. */
let note = { text: '', step: '' };
/** The beast from the tutorial's summon, celebrated before moving on. */
let summoned: { key: string; rar: string } | null = null;
/** Brief feedback that replaces the lesson text for a moment. */
let flash = { text: '', until: 0 };
let renderedKey = '';
let lastTarget: string | null = null;

const step = (): StepId => save.tutorial.step as StepId;

/* ---------- lifecycle ---------- */
export function initTutorial() {
  on(handle);
  bubble.addEventListener('click', ev => {
    const act = (ev.target as Element).closest<HTMLElement>('[data-tact]')?.dataset.tact;
    if (act === 'start') { startBattle({ training: true }); setStep('b-tap'); }
    else if (act === 'next') { if (summoned) { summoned = null; renderedKey = ''; lastTarget = null; } else advance(); }
    else if (act === 'skip') skip();
    else if (act === 'finish') finish();
  });
  if (!save.tutorial.done) setStep(resumeStep(save.tutorial.step));
}

/** Start the tutorial over from the welcome card (home screen button). */
export function replay() {
  note = { text: '', step: '' }; summoned = null;
  save.tutorial = { done: false, step: 'intro' };
  persist();
  setStep('intro');
}

function setStep(id: StepId) {
  save.tutorial.step = id;
  if (id === 'done') { finish(); return; }
  persist();
  count = 0; misses = 0; renderedKey = ''; lastTarget = null;
  summoned = null;
  enter(id);
}
function advance() { setStep(nextStep(step())); }

function finish() {
  hooks.summonRarity = null;
  save.tutorial = { done: true, step: 'done' };
  persist();
  coach.hidden = bubble.hidden = spot.hidden = dim.hidden = true;
}
function skip() {
  const inTraining = !!B?.training;
  finish();
  if (inTraining) endBattle();
}

/** Set up the game for a step: training rules, energy, the guaranteed summon. */
function enter(id: StepId) {
  const b = B, t = b?.training, e = b?.enemy;
  if (t && b) {
    t.demo = null;
    if (id === 'b-tap') { t.enemyActs = false; t.demo = 'tap'; }
    if (id === 'b-slash') t.demo = 'slash';
    if (id === 'b-special') { const u = cur(); if (u) u.energy = 100; t.demo = 'up'; }
    if (id === 'b-parry' && e) { t.enemyActs = true; e.windup = 1.6; e.state = 'idle'; e.timer = 1.2; t.demo = 'down'; }
    if (id === 'b-swap' && e) {
      t.enemyActs = false; e.state = 'idle'; b.swapCd = 0;
      if (b.active === 1) { advance(); return; }
    }
    if (id === 'b-matchup') {
      b.swapCd = 0;
      if (b.active === 0) { advance(); return; }
    }
    if (id === 'b-finish' && e) {
      t.enemyActs = true; t.protectEnemy = false; e.windup = 1.1; e.timer = 2;
      e.hp = Math.max(e.hp, Math.round(e.maxHp * 0.45));
      const u = cur(); if (u) u.energy = Math.max(u.energy, 60);
    }
  }
  if (id === 'm-summon') {
    hooks.summonRarity = 'rare';
    if (save.shards < COST) { save.shards = COST; persist(); }
  }
}

/* ---------- reacting to the player ---------- */
function handle(ev: GameEvent, data?: unknown) {
  if (save.tutorial.done) return;
  if (ev === 'skipTutorial') { finish(); return; }
  const id = step();
  const reps = REPS[id] ?? 1;
  /** Show a line in the next lesson, then move on. */
  const then = (text: string) => { note = { text, step: nextStep(id) }; advance(); };
  switch (id) {
    case 'b-tap':
      if (ev === 'tap' && ++count >= reps) then('Quick strikes build energy for your special.');
      break;
    case 'b-slash':
      if (ev === 'slash' && ++count >= reps) then('Slashes can also leave your element\'s mark on the enemy.');
      break;
    case 'b-special':
      if (ev === 'special') then('Your fireball left a Burn: damage over time. Specials always apply their element\'s effect.');
      break;
    case 'b-parry':
      if (ev === 'parry') then('Parried! A parry blocks the hit and any effect it carries, then counters.');
      else if (ev === 'hurt') {
        misses++;
        flash = { text: misses >= 3 ? 'Wait until the ring is solid gold, then swipe down. Take your time; this fight can\'t be lost.' : 'Not quite. Wait for the ring to turn gold, then swipe down.', until: performance.now() + 2600 };
        // Give struggling players a slower wind-up.
        if (misses >= 2 && B?.enemy) B.enemy.windup = 2.2;
      }
      break;
    case 'b-swap':
      if (ev === 'swap' && data === 1) advance();
      break;
    case 'b-matchup':
      if (ev === 'swap' && data === 0) advance();
      break;
    case 'b-finish':
      if (ev === 'trainingDone') advance();
      break;
    case 'm-summon':
      // Save progress right away so a reload can't grant a second guaranteed Rare,
      // but keep celebrating the reveal until the player taps Next.
      if (ev === 'summoned') {
        hooks.summonRarity = null;
        save.tutorial.step = nextStep(id); persist();
        summoned = data as { key: string; rar: string }; renderedKey = '';
      }
      break;
    case 'm-enhance':
      if (ev === 'fused') advance();
      break;
    case 'm-ready':
      if (ev === 'fight') finish();
      break;
  }
}

/* ---------- what each step says and points at ---------- */
interface View {
  title: string;
  text: string;
  /** Selector of the element to spotlight, if any. */
  target?: string | null;
  /** Dim the rest of the screen around the target. */
  dimmed?: boolean;
  /** Keyboard alternative, shown in the training coach. */
  key?: string;
  /** Progress such as "1/3". */
  progress?: string;
  button?: { label: string; act: 'next' | 'finish' | 'start' };
  /** Show this step's number instead of the current one. */
  label?: StepId;
}

const BATTLE: Record<string, (reps: number) => View> = {
  'b-tap': reps => ({ title: 'Strike', text: 'Tap anywhere on the field to strike.', key: 'J', progress: `${count}/${reps}` }),
  'b-slash': reps => ({ title: 'Slash', text: 'Swipe left or right across the field. Slashes hit harder than strikes.', key: 'K', progress: `${count}/${reps}` }),
  'b-special': () => ({ title: 'Special attack', text: 'Your energy is full. Swipe up to unleash Cindermaw\'s special, Magma Bite.', key: 'I' }),
  'b-parry': () => ({ title: 'Parry', text: 'The enemy shows a red ! as it winds up, and a ring closes on your beast. The moment the ring turns gold, swipe down.', key: 'Space' }),
  'b-swap': () => ({ title: 'Swap beasts', text: 'You fight with a team of three. Tap Tidecoil\'s portrait to swap it in.', key: '2', target: '#slots .slot[data-i="1"]' }),
  'b-matchup': () => ({ title: 'Read the matchup', text: 'See the ▼ on Tidecoil? Thorn beats Tide, so Tidecoil hits softer here. Cindermaw has ▲: Pyre beats Thorn for 1.5× damage. Swap back to Cindermaw.', key: '1', target: '#slots .slot[data-i="0"]' }),
  'b-finish': () => ({ title: 'Finish it', text: 'Use everything: strikes, slashes, your special, and parries.' }),
};

/** The control that leads out of the current screen toward home. */
function backButton(): string {
  if (current === 'forge') return '#fBack';
  if (current === 'roster' && !$('#sheet').hidden) return '#dClose';
  return `#${current} [data-go="home"]`;
}

function menuView(id: StepId): View {
  const back = backButton();
  if (summoned) {
    const sp = SPECIES[summoned.key];
    return { label: 'm-summon', title: `${sp.name} joins you`, text: `A ${RARITY[sp.rarity].label} ${ELEM[sp.el].name} beast, added to your collection. Every summon and battle drop arrives as a card like this one.`, button: { label: 'Next', act: 'next' } };
  }
  switch (id) {
    case 'intro':
      return {
        title: 'Welcome, Summoner',
        text: 'A short training fight will teach you to battle, then you\'ll summon your first beast. It takes about two minutes.',
        button: { label: 'Start training', act: 'start' },
      };
    case 'm-summon':
      if (current === 'home') return { title: 'Summon a beast', text: 'Training earned you soul shards. Open the Summoning Altar to call your first beast.', target: '#btnAltar', dimmed: true };
      if (current === 'altar') {
        if ($<HTMLButtonElement>('#btnSummon').disabled) return { title: 'Summon a beast', text: 'The rift is opening…' };
        return { title: 'Summon a beast', text: 'Tap Rift Summon. Your first summon is a guaranteed Rare.', target: '#btnSummon', dimmed: true };
      }
      return { title: 'Summon a beast', text: 'Head back to the Summoning Altar.', target: back, dimmed: true };
    case 'm-enhance': {
      const base = teamMembers()[0];
      if (!base || !fodderFor(base).length) {
        return { title: 'Feed your beasts', text: 'Beasts grow by feeding them other cards. You have no spare cards yet; battles and Beast Calls give you more.', button: { label: 'Next', act: 'next' } };
      }
      const title = 'Feed a card';
      if (current === 'home') return { title, text: 'Beasts grow stronger by feeding them other cards. Open Cards & Team.', target: '#btnRoster', dimmed: true };
      if (current === 'roster') {
        if ($('#sheet').hidden) return { title, text: `Tap ${nameOf(base)} to open its card.`, target: `#rList .card[data-id="${base.id}"]`, dimmed: true };
        return { title, text: 'Tap Enhance.', target: '#dEnh', dimmed: true };
      }
      if (current === 'forge') {
        if ($('#fTitle').textContent !== 'Enhance') return { title, text: 'This screen is for evolving. Go back and choose Enhance.', target: '#fBack', dimmed: true };
        if ($<HTMLButtonElement>('#fGo').textContent?.startsWith('Fusing')) return { title, text: 'Fusing…' };
        if (!document.querySelector('#fGrid .card.sel')) return { title, text: 'Pick cards to feed. Auto-pick chooses spare common cards for you.', target: '#fAuto', dimmed: true };
        return { title, text: 'Tap Fuse. The fed cards are used up and their XP goes to your beast. Food of the same element gives 1.5× XP.', target: '#fGo', dimmed: true };
      }
      return { title, text: 'Head home, then open Cards & Team.', target: back, dimmed: true };
    }
    case 'm-evolve':
      return {
        title: 'Evolving',
        text: 'When a card reaches max level, merge it with a second copy of the same beast to evolve it: a new form, a new name and a higher level cap. The ◆◇◇ diamonds on each card show its form.',
        button: { label: 'Got it', act: 'next' },
      };
    case 'm-ready':
      if (current === 'home') return { title: 'You\'re ready', text: 'Tap Campaign to set out across the nine regions. Stages pay shards, gold and card drops, and up to three stars. You can replay this tutorial from the home screen any time.', target: '#btnFight', dimmed: true, button: { label: 'Finish', act: 'finish' } };
      return { title: 'You\'re ready', text: 'Head home to start the campaign.', target: back, dimmed: true, button: { label: 'Finish', act: 'finish' } };
    default:
      return { title: '', text: '' };
  }
}

/* ---------- drawing, once per frame ---------- */
export function tutorialFrame() {
  if (save.tutorial.done) return;
  const id = step();

  if (isBattleStep(id)) {
    bubble.hidden = dim.hidden = true;
    if (current !== 'battle' || !B?.training || B.over) { coach.hidden = spot.hidden = true; return; }
    const v = BATTLE[id](REPS[id] ?? 1);
    renderCoach(id, v);
    placeSpot(v.target ?? null, false);
    return;
  }

  coach.hidden = true;
  // Stay out of the way during a regular fight; the tour resumes afterwards.
  if (current === 'battle') { bubble.hidden = spot.hidden = dim.hidden = true; return; }
  const v = menuView(id);
  dim.hidden = id !== 'intro';
  renderBubble(id, v);
  placeSpot(v.target ?? null, !!v.dimmed);
  placeBubble(v.target ?? null, id === 'intro');
}

function renderCoach(id: StepId, v: View) {
  const flashing = flash.text && performance.now() < flash.until;
  const noteText = note.step === id ? note.text : '';
  const key = [id, v.progress, noteText, flashing ? flash.text : ''].join('|');
  coach.hidden = false;
  if (key === renderedKey) return;
  renderedKey = key;
  coach.innerHTML = `
    <div class="tc-top"><span class="tc-eyebrow">${stepLabel(id)}</span>${v.progress ? `<span class="tc-count">${v.progress}</span>` : ''}</div>
    ${noteText ? `<p class="tc-note">${noteText}</p>` : ''}
    <p class="tc-text"><b>${v.title}.</b> ${flashing ? `<span class="tc-flash">${flash.text}</span>` : v.text}</p>
    ${v.key ? `<span class="tc-key">Keyboard: <kbd>${v.key}</kbd></span>` : ''}`;
}

function renderBubble(id: StepId, v: View) {
  const key = [id, v.label, v.title, v.text, v.button?.label].join('|');
  bubble.hidden = false;
  if (key === renderedKey) return;
  renderedKey = key;
  bubble.innerHTML = `
    <div class="tb-eyebrow">${stepLabel(v.label ?? id)}</div>
    <h3>${v.title}</h3>
    <p>${v.text}</p>
    <div class="tb-btns">
      ${v.button ? `<button class="primary" data-tact="${v.button.act}">${v.button.label}</button>` : ''}
      <button class="ghost" data-tact="skip">Skip tutorial</button>
    </div>`;
}

/** Ring the target and, for menu steps, dim everything else. */
function placeSpot(sel: string | null, dimmed: boolean) {
  const el = sel ? document.querySelector<HTMLElement>(sel) : null;
  if (!el || !el.offsetParent) { spot.hidden = true; return; }
  if (sel !== lastTarget) {
    lastTarget = sel;
    el.scrollIntoView({ block: 'nearest', behavior: RM ? 'auto' : 'smooth' });
  }
  const r = el.getBoundingClientRect(), pad = 6;
  spot.style.left = `${r.left - pad}px`;
  spot.style.top = `${r.top - pad}px`;
  spot.style.width = `${r.width + pad * 2}px`;
  spot.style.height = `${r.height + pad * 2}px`;
  spot.classList.toggle('dim', dimmed);
  spot.hidden = false;
}

/** Keep the bubble on the opposite half of the screen from what it points at. */
function placeBubble(sel: string | null, centered: boolean) {
  const el = sel ? document.querySelector<HTMLElement>(sel) : null;
  let pos = 'bottom';
  if (centered) pos = 'center';
  else if (el && el.offsetParent) {
    const r = el.getBoundingClientRect();
    if (r.top + r.height / 2 > window.innerHeight * 0.5) pos = 'top';
  }
  bubble.dataset.pos = pos;
}
