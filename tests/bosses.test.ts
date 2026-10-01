import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KITS, MOVES, MOVE_NAMES, advancePhase, chooseAttack, newBossState, phaseAt, phaseTitle, tempoFor } from '../src/bosses';
import { COLLECTIBLE_KEYS, ELEM_ORDER, SPECIES, collectible } from '../src/data';
import { migrate, defaultSave } from '../src/save';

const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };

test('every kit has one move list and pacing per phase', () => {
  for (const k of Object.values(KITS)) {
    assert.equal(k.moves.length, k.phases.length + 1, k.tier);
    assert.equal(k.normalsBetween.length, k.phases.length + 1, k.tier);
    assert.deepEqual([...k.phases].sort((a, b) => b - a), k.phases, 'thresholds go downward');
  }
  assert.equal(KITS.warden.phases.length, 1);
  assert.equal(KITS.ruler.phases.length, 2);
  assert.equal(KITS.guardian.phases.length, 3);
});

test('phases follow health', () => {
  assert.equal(phaseAt('ruler', 1), 0);
  assert.equal(phaseAt('ruler', 0.66), 1);
  assert.equal(phaseAt('ruler', 0.5), 1);
  assert.equal(phaseAt('ruler', 0.2), 2);
  assert.equal(phaseAt('warden', 0.49), 1);
});

test('one phase at a time, even after a huge hit', () => {
  const s = newBossState('ruler');
  assert.equal(advancePhase(s, 0.9), false);
  assert.equal(advancePhase(s, 0.1), true); assert.equal(s.phase, 1);
  assert.equal(advancePhase(s, 0.1), true); assert.equal(s.phase, 2);
  assert.equal(advancePhase(s, 0.0), false);
  assert.equal(phaseTitle(s), 'Enraged!');
});

test('a new phase opens with a signature move', () => {
  const s = newBossState('warden');
  advancePhase(s, 0.4);
  assert.notEqual(chooseAttack(s, () => 0), 'normal');
});

test('signature moves come after the set number of ordinary attacks', () => {
  const s = newBossState('ruler'), out: string[] = [];
  for (let i = 0; i < 8; i++) out.push(chooseAttack(s, () => 0));
  assert.deepEqual(out, ['normal', 'normal', 'normal', 'sweep', 'normal', 'normal', 'normal', 'sweep']);
});

test('moves come only from the current phase, and avoid repeats when there is a choice', () => {
  const s = newBossState('ruler'); s.phase = 1; s.normals = 99;
  const r = seq(0, 0.99);
  const a = chooseAttack(s, r); s.normals = 99; const b = chooseAttack(s, r);
  assert.ok(KITS.ruler.moves[1].includes(a as any) && KITS.ruler.moves[1].includes(b as any));
  assert.notEqual(a, b);
});

test('bosses speed up each phase', () => {
  const s = newBossState('guardian'); const t0 = tempoFor(s); s.phase = 3; const t3 = tempoFor(s);
  assert.ok(t3.windup < t0.windup && t3.rest < t0.rest);
});

test('smash cannot be parried; the others can', () => {
  assert.equal(MOVES.smash.parry, false); assert.equal(MOVES.sweep.parry, true); assert.equal(MOVES.barrage.parry, true);
  assert.ok(MOVES.smash.windup > MOVES.sweep.windup, 'the unblockable move gives the longest warning');
});

test('every element names every move', () => {
  for (const el of ELEM_ORDER) for (const m of ['smash', 'sweep', 'barrage'] as const) assert.ok(MOVE_NAMES[el][m].length > 2, `${el} ${m}`);
});

test('nine wardens, one per element, none collectible', () => {
  const wardens = Object.keys(SPECIES).filter(k => SPECIES[k].bossOnly);
  assert.equal(wardens.length, 9);
  assert.deepEqual(new Set(wardens.map(k => SPECIES[k].el)).size, 9);
  for (const k of wardens) { assert.equal(collectible(k), false); assert.ok(!COLLECTIBLE_KEYS.includes(k)); }
});

test('a save can never hold a warden card', () => {
  const s: any = defaultSave();
  s.roster.push({ id: 99, sp: 'slagmaw', lvl: 5, xp: 0, evo: 0, skill: 1, locked: false });
  assert.ok(!migrate(s).roster.some((c: any) => c.sp === 'slagmaw'));
});
