import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeSave, defaultSettings, encodeSave, flashScale, gainFor, isNumberText, normalizeSettings,
  parryWindow, scaleBuzz, shakeScale, swipeDistances,
} from '../src/settingsCore';

test('defaults are on, and reduced-motion devices start calm', () => {
  const d = defaultSettings();
  assert.equal(d.sound, true); assert.equal(d.shake, 'full'); assert.equal(d.flashes, 'full');
  const rm = defaultSettings(true);
  assert.equal(rm.shake, 'off'); assert.equal(rm.flashes, 'low');
});

test('broken stored values fall back to defaults', () => {
  const s = normalizeSettings({ sound: 'yes', volume: 250, buzz: 'max', shake: 'low', swipe: 7, numbers: false });
  assert.equal(s.sound, true);
  assert.equal(s.volume, 100);
  assert.equal(s.buzz, 'normal');
  assert.equal(s.shake, 'low');
  assert.equal(s.swipe, 'normal');
  assert.equal(s.numbers, false);
  assert.deepEqual(normalizeSettings(null), defaultSettings());
  assert.equal(normalizeSettings({ volume: NaN }).volume, 80);
});

test('the old sound and vibration switches carry over', () => {
  const s = normalizeSettings(null, false, { muted: '1', haptics: '0' });
  assert.equal(s.sound, false); assert.equal(s.buzz, 'off');
});

test('volume 80 is the original loudness; off or zero is silent', () => {
  const d = defaultSettings();
  assert.equal(gainFor(d), 0.55);
  assert.equal(gainFor({ ...d, volume: 0 }), 0);
  assert.equal(gainFor({ ...d, sound: false }), 0);
  assert.ok(gainFor({ ...d, volume: 100 }) > 0.55);
});

test('vibration strength scales pulses but not pauses', () => {
  assert.equal(scaleBuzz(50, 'off'), null);
  assert.deepEqual(scaleBuzz(50, 'normal'), [50]);
  assert.deepEqual(scaleBuzz([30, 40, 90], 'light'), [15, 40, 45]);
  assert.deepEqual(scaleBuzz([30, 40, 90], 'strong'), [48, 40, 144]);
  assert.deepEqual(scaleBuzz(6, 'light'), [4]);
});

test('battle settings map to numbers the fight uses', () => {
  const d = defaultSettings();
  assert.equal(shakeScale({ ...d, shake: 'off' }), 0);
  assert.equal(shakeScale(d), 1);
  assert.ok(flashScale({ ...d, flashes: 'low' }) < 1);
  assert.equal(parryWindow(d), 0.4);
  assert.ok(parryWindow({ ...d, relaxedParry: true }) > 0.4);
  const n = swipeDistances(d), sh = swipeDistances({ ...d, swipe: 'short' }), lg = swipeDistances({ ...d, swipe: 'long' });
  assert.deepEqual(n, { swipe: 40, tap: 25 });
  assert.ok(sh.swipe < n.swipe && lg.swipe > n.swipe);
  for (const x of [n, sh, lg]) assert.ok(x.tap < x.swipe);
});

test('only plain numbers count as damage numbers', () => {
  for (const t of ['37', '+12', '-5']) assert.ok(isNumberText(t), t);
  for (const t of ['Parried!', 'Blessed +20%', 'Miss', '+50 shards · +10 gold']) assert.ok(!isNumberText(t), t);
});

test('save codes round-trip, including non-English text', () => {
  const data = { roster: [{ id: 1, sp: 'cindermaw', name: 'Flamme–Ω' }], team: [1], shards: 42 };
  const code = encodeSave(data);
  assert.match(code, /^SIGIL1:/);
  assert.deepEqual(decodeSave(code), data);
  assert.deepEqual(decodeSave(`  ${code.slice(0, 20)}\n${code.slice(20)}  `), data);
});

test('bad save codes are refused', () => {
  assert.equal(decodeSave(''), null);
  assert.equal(decodeSave('hello'), null);
  assert.equal(decodeSave('SIGIL1:!!!notbase64'), null);
  assert.equal(decodeSave(encodeSave({ shards: 5 })), null);
  assert.equal(decodeSave(encodeSave({ roster: [], team: [] })) !== null, true);
});
