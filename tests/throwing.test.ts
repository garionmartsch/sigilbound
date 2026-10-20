import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARGE, SHOT_SHAPE, THROWS, aimTarget, chargeAt, chargedKind, classifyFlick, flickPower, flightTime, isRanged } from '../src/throwing';
import { ELEM_ORDER } from '../src/data';

test('a flick straight down parries; anything else throws', () => {
  assert.equal(classifyFlick(0, 80), 'parry');
  assert.equal(classifyFlick(10, 80), 'parry');
  assert.equal(classifyFlick(60, -60), 'throw');
  assert.equal(classifyFlick(80, 10), 'throw');
  assert.equal(classifyFlick(0, -80), 'throw');
  assert.equal(classifyFlick(80, 80), 'throw', 'a diagonal down-right is still a throw');
});

test('faster flicks hit harder, within limits', () => {
  assert.equal(flickPower(0), 0.85);
  assert.equal(flickPower(10), 1.15);
  assert.ok(flickPower(1.2) > flickPower(0.6));
  assert.ok(flightTime(1.15) < flightTime(0.85), 'harder throws also fly faster');
});

test('the flick direction picks the enemy it points at', () => {
  const me = { x: 100, y: 500 };
  const foes = [{ x: 150, y: 200 }, { x: 300, y: 300 }, { x: 330, y: 160 }];
  const at = (t: { x: number; y: number }) => ({ x: t.x - me.x, y: t.y - me.y });
  foes.forEach((f, i) => assert.equal(aimTarget(me, at(f), foes), i));
  assert.equal(aimTarget(me, { x: 0.1, y: -1 }, foes), 0, 'straight up goes to the one most above you');
  assert.equal(aimTarget(me, { x: 1, y: -0.2 }, foes), 1, 'flat to the right goes to the lowest one on the right');
  assert.equal(aimTarget(me, { x: 1, y: -1 }, []), -1);
});

test('holding charges after a short delay, then fills', () => {
  assert.equal(chargeAt(0), 0);
  assert.equal(chargeAt(CHARGE.delay), 0);
  assert.ok(chargeAt(CHARGE.delay + CHARGE.full / 2) > 0.4);
  assert.equal(chargeAt(CHARGE.delay + CHARGE.full), 1);
  assert.equal(chargeAt(10), 1);
});

test('a full charge is the Special with full energy, a heavy throw without', () => {
  assert.equal(chargedKind(100), 'special');
  assert.equal(chargedKind(99), 'heavy');
});

test('heavier throws hit harder but take longer', () => {
  assert.ok(THROWS.tap.mult < THROWS.throw.mult && THROWS.throw.mult < THROWS.heavy.mult);
  assert.ok(THROWS.tap.cd < THROWS.throw.cd && THROWS.throw.cd < THROWS.heavy.cd);
});

test('spirits, birds and dragons throw back; brawlers fight up close', () => {
  assert.ok(isRanged('wisp') && isRanged('avian') && isRanged('drake'));
  assert.ok(!isRanged('brute') && !isRanged('golem') && !isRanged('beast') && !isRanged('serpent'));
});

test('every element has a shot shape', () => {
  for (const el of ELEM_ORDER) assert.ok(SHOT_SHAPE[el], el);
});
