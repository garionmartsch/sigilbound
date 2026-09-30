import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STATUS, applyStatus, cleanse, damageDealtMult, damageTakenMult, drainFrom, rollDazeMiss, tempo, tickStatus,
  type StatusState,
} from '../src/status';

describe('status effects', () => {
  it('Burn deals damage over time scaled by attack, then wears off', () => {
    const st: StatusState = {};
    applyStatus(st, 'pyre', 20, false, true);
    const dot = tickStatus(st, 1);
    assert.equal(dot, 20 * STATUS.burn.dpsPerAtk);
    tickStatus(st, STATUS.burn.dur);
    assert.equal(st.burn, undefined);
  });

  it('Poison stacks up to three', () => {
    const st: StatusState = {};
    for (let i = 0; i < 5; i++) applyStatus(st, 'thorn', 10, false, true);
    assert.equal(st.poison?.stacks, STATUS.poison.maxStacks);
  });

  it('Chill freezes at three stacks', () => {
    const st: StatusState = {};
    applyStatus(st, 'frost', 10, false, true);
    applyStatus(st, 'frost', 10, false, true);
    assert.equal(st.freeze, undefined);
    const r = applyStatus(st, 'frost', 10, false, true);
    assert.ok(r.froze && st.freeze);
    assert.equal(tempo(st), 0, 'frozen targets cannot act');
  });

  it('combo: Soak + Chill freezes at once', () => {
    const st: StatusState = {};
    applyStatus(st, 'tide', 10, false, true);
    const r = applyStatus(st, 'frost', 10, false, true);
    assert.ok(r.froze);
    assert.equal(st.soak, undefined, 'the soak is used up');
  });

  it('combo: Soak + Shock doubles the shock and uses up the soak', () => {
    const dry: StatusState = {}, wet: StatusState = {};
    applyStatus(wet, 'tide', 10, false, true);
    const a = applyStatus(dry, 'storm', 20, false, true), b = applyStatus(wet, 'storm', 20, false, true);
    assert.equal(b.bonusDamage, a.bonusDamage * STATUS.shock.soakedMult);
    assert.equal(wet.soak, undefined);
  });

  it('specials always break a wind-up with Shock', () => {
    assert.equal(applyStatus({}, 'storm', 10, true, true).interruptChance, 1);
  });

  it('Soak slows timers, Sunder and Freeze raise damage taken, Curse lowers damage dealt', () => {
    const st: StatusState = {};
    applyStatus(st, 'tide', 10, false, true);
    assert.ok(tempo(st) < 1);
    applyStatus(st, 'stone', 10, false, true);
    assert.equal(damageTakenMult(st), STATUS.sunder.damageTaken);
    applyStatus(st, 'umbral', 10, false, true);
    assert.equal(damageDealtMult(st), STATUS.curse.damageDealt);
    assert.equal(drainFrom(st), STATUS.curse.drain);
  });

  it('Daze makes the next attack roll to miss, then clears', () => {
    const st: StatusState = {};
    applyStatus(st, 'gale', 10, false, true);
    assert.equal(rollDazeMiss(st, 0.1), true);
    assert.equal(st.daze, undefined);
    assert.equal(rollDazeMiss(st, 0.1), false, 'no daze, no miss');
  });

  it('Bless heals more on a special and applies nothing to the target', () => {
    const st: StatusState = {};
    const hit = applyStatus(st, 'radiant', 10, false, true), special = applyStatus(st, 'radiant', 10, true, true);
    assert.ok(special.heal > hit.heal);
    assert.deepEqual(st, {});
  });

  it('cleanse removes everything', () => {
    const st: StatusState = {};
    (['pyre', 'thorn', 'tide', 'stone', 'gale', 'umbral'] as const).forEach(el => applyStatus(st, el, 10, false, true));
    cleanse(st);
    assert.deepEqual(st, {});
  });
});
