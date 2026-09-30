import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickRarity, RARITY } from '../src/data';
import { defaultSave, migrate } from '../src/save';
import { BATTLE_STEPS, MENU_STEPS, STEP_ORDER, isBattleStep, nextStep, resumeStep, stepLabel } from '../src/tutorialFlow';

describe('tutorial flow', () => {
  it('runs welcome, then training lessons, then the menu tour, then done', () => {
    assert.equal(STEP_ORDER[0], 'intro');
    assert.equal(STEP_ORDER.at(-1), 'done');
    assert.deepEqual(STEP_ORDER.slice(1, 1 + BATTLE_STEPS.length), [...BATTLE_STEPS]);
    assert.deepEqual(STEP_ORDER.slice(1 + BATTLE_STEPS.length, -1), [...MENU_STEPS]);
  });

  it('walks every step in order and stays on done at the end', () => {
    let id = STEP_ORDER[0];
    const seen = [id];
    while (id !== 'done') { id = nextStep(id); seen.push(id); }
    assert.deepEqual(seen, STEP_ORDER);
    assert.equal(nextStep('done'), 'done');
  });

  it('restarts training from the welcome card after a restart, but resumes menu steps', () => {
    for (const b of BATTLE_STEPS) assert.equal(resumeStep(b), 'intro', b);
    for (const m of MENU_STEPS) assert.equal(resumeStep(m), m, m);
    assert.equal(resumeStep('no-such-step'), 'intro');
  });

  it('labels progress for the coach', () => {
    assert.equal(stepLabel('b-tap'), `Training · 1 of ${BATTLE_STEPS.length}`);
    assert.equal(stepLabel('m-enhance'), `Tutorial · 2 of ${MENU_STEPS.length}`);
    assert.ok(isBattleStep('b-parry') && !isBattleStep('m-summon'));
  });
});

describe('tutorial save state', () => {
  it('starts new players at the welcome card', () => {
    assert.deepEqual(defaultSave().tutorial, { done: false, step: 'intro' });
  });

  it('marks saves from before the tutorial as done, so existing players are not interrupted', () => {
    const old = { roster: [{ id: 1, sp: 'cindermaw', lvl: 3, xp: 0 }], team: [1], shards: 40, gold: 100, stage: 5, nextId: 2 };
    assert.deepEqual(migrate(old).tutorial, { done: true, step: 'done' });
  });

  it('keeps tutorial progress in current saves', () => {
    const s = defaultSave();
    s.tutorial.step = 'm-enhance';
    assert.deepEqual(migrate(JSON.parse(JSON.stringify(s))).tutorial, { done: false, step: 'm-enhance' });
  });
});

describe('summon rarity', () => {
  it('follows the published rates across the whole roll range', () => {
    const counts: Record<string, number> = {};
    for (let r = 0; r < 100; r += 0.01) { const k = pickRarity('rift', r); counts[k] = (counts[k] ?? 0) + 1; }
    for (const [k, v] of Object.entries(RARITY)) {
      assert.ok(Math.abs((counts[k] ?? 0) / 100 - v.w) < 0.05, `${k}: ${(counts[k] ?? 0) / 100}% vs ${v.w}%`);
    }
  });

  it('lets the tutorial guarantee a rarity', () => {
    for (const r of [0, 50, 99.9]) assert.equal(pickRarity('rift', r, 'rare'), 'rare');
  });
});
