import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, THEME_IDS, contrast, cssVars, themeById } from '../src/themes';
import { normalizeSettings } from '../src/settingsCore';

const HEX = /^#[0-9A-F]{6}$/i, RGB = /^\d{1,3},\d{1,3},\d{1,3}$/;

test('every theme is complete and uses valid colors', () => {
  const keys = Object.keys(THEMES[0].ui).sort(), akeys = Object.keys(THEMES[0].arena).sort();
  assert.equal(new Set(THEME_IDS).size, THEMES.length, 'ids are unique');
  for (const t of THEMES) {
    assert.deepEqual(Object.keys(t.ui).sort(), keys, t.id);
    assert.deepEqual(Object.keys(t.arena).sort(), akeys, t.id);
    for (const [k, v] of Object.entries(t.ui)) assert.match(v, HEX, `${t.id}.${k}`);
    for (const k of ['skyTop', 'horizon', 'groundTop', 'groundBottom', 'spires'] as const) assert.match(t.arena[k], HEX, `${t.id}.${k}`);
    for (const k of ['glow', 'lines', 'embers'] as const) assert.match(t.arena[k], RGB, `${t.id}.${k}`);
  }
});

test('text stays readable in every theme', () => {
  for (const t of THEMES) {
    const u = t.ui;
    for (const bg of [u.bg, u.stone, u.stone2, u.deep]) {
      assert.ok(contrast(u.text, bg) >= 7, `${t.id}: text on ${bg} is ${contrast(u.text, bg).toFixed(2)}`);
      assert.ok(contrast(u.muted, bg) >= 4.5, `${t.id}: muted on ${bg} is ${contrast(u.muted, bg).toFixed(2)}`);
      assert.ok(contrast(u.gold, bg) >= 4.5, `${t.id}: accent on ${bg} is ${contrast(u.gold, bg).toFixed(2)}`);
    }
    for (const b of [u.btnHi, u.btnLo]) assert.ok(contrast(u.onGold, b) >= 4.5, `${t.id}: main button text on ${b} is ${contrast(u.onGold, b).toFixed(2)}`);
  }
});

test('high contrast theme clears the stricter bar', () => {
  const u = themeById('contrast').ui;
  assert.ok(contrast(u.muted, u.stone2) >= 7);
  assert.ok(contrast(u.gold, u.bg) >= 7);
});

test('css variables include rgb triples for see-through colors', () => {
  const v = cssVars(themeById('sigil'));
  assert.equal(v['--bg'], '#110D18');
  assert.equal(v['--gold-rgb'], '231 190 110');
  assert.equal(v['--bg-rgb'], '17 13 24');
  assert.equal(v['--card-top'], '#261D33');
  assert.equal(v['--on-gold'], '#24160A');
});

test('unknown theme ids fall back to the default', () => {
  assert.equal(themeById('nope').id, 'sigil');
  assert.equal(normalizeSettings({ theme: 'nope' }).theme, 'sigil');
  assert.equal(normalizeSettings({ theme: 'abyss' }).theme, 'abyss');
});

test('the stylesheet defaults match the default theme exactly', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  for (const [k, v] of Object.entries(cssVars(THEMES[0]))) {
    const m = css.match(new RegExp(`${k}:([^;]+);`));
    assert.ok(m, `${k} missing from :root in styles.css`);
    assert.equal(m![1].trim().toUpperCase(), v.toUpperCase(), k);
  }
});
