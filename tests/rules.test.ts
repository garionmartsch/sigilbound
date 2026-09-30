import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ELEM, ELEM_ORDER, FORMS, RARITY, SPECIES,
  addXp, capOf, elemMult, feedXp, simXp, statsOf, xpNext,
} from '../src/data';
import { migrate, newCard, defaultSave } from '../src/save';
import { GENERATED } from '../src/beasts/generated';
import { generateCommons } from '../tools/generate-commons';
import type { Card } from '../src/types';

const card = (sp: string, lvl = 1, evo = 0): Card => ({ id: 1, sp, lvl, xp: 0, evo, skill: 1, locked: false });
const WHEEL = ELEM_ORDER.filter(k => k !== 'radiant' && k !== 'umbral');

describe('elements', () => {
  it('has nine elements', () => assert.equal(ELEM_ORDER.length, 9));

  it('gives every wheel element two strengths and two weaknesses', () => {
    for (const k of WHEEL) {
      const strong = WHEEL.filter(o => elemMult(k, o) > 1);
      const weak = WHEEL.filter(o => elemMult(o, k) > 1);
      assert.equal(strong.length, 2, `${k} strong vs ${strong}`);
      assert.equal(weak.length, 2, `${k} weak to ${weak}`);
    }
  });

  it('never makes two wheel elements strong against each other', () => {
    for (const a of WHEEL) for (const b of WHEEL) {
      assert.ok(!(elemMult(a, b) > 1 && elemMult(b, a) > 1), `${a} and ${b}`);
    }
  });

  it('makes Radiant and Umbral strong against each other and neutral to the rest', () => {
    assert.equal(elemMult('radiant', 'umbral'), 1.5);
    assert.equal(elemMult('umbral', 'radiant'), 1.5);
    for (const k of WHEEL) {
      assert.equal(elemMult('radiant', k), 1);
      assert.equal(elemMult(k, 'umbral'), 1);
    }
  });

  it('uses 1.5 for advantage and 0.7 for resisted hits', () => {
    assert.equal(elemMult('pyre', 'thorn'), 1.5);
    assert.equal(elemMult('thorn', 'pyre'), 0.7);
    assert.equal(elemMult('pyre', 'pyre'), 1);
  });
});

describe('beasts', () => {
  const keys = Object.keys(SPECIES);

  it('has a roster of about a hundred', () => assert.ok(keys.length >= 90, `${keys.length} beasts`));

  it('gives every beast and every form a unique name', () => {
    const names = keys.flatMap(k => SPECIES[k].forms);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    assert.deepEqual(dupes, []);
  });

  it('includes legendary and mythic beasts', () => {
    assert.ok(keys.some(k => SPECIES[k].rarity === 'legendary'));
    assert.ok(keys.some(k => SPECIES[k].rarity === 'mythic'));
  });

  it('keeps the original beast keys so old saves still load', () => {
    for (const k of ['cindermaw', 'ashwing', 'vhal', 'tidecoil', 'nyxhollow', 'seraphel']) assert.ok(SPECIES[k], k);
  });

  it('gives every beast a description for art prompts', () => {
    for (const k of keys) assert.ok(SPECIES[k].look, k);
  });

  it('publishes summon rates that add up to 100%', () => {
    const rift = Object.values(RARITY).reduce((a, r) => a + r.w, 0);
    const call = Object.values(RARITY).reduce((a, r) => a + r.call, 0);
    assert.ok(Math.abs(rift - 100) < 1e-9, `rift ${rift}`);
    assert.ok(Math.abs(call - 100) < 1e-9, `call ${call}`);
  });

  it('regenerates the same common beasts every time', () => {
    const again = generateCommons();
    assert.deepEqual(Object.keys(again), Object.keys(GENERATED));
    for (const k of Object.keys(again)) assert.deepEqual(again[k], GENERATED[k], k);
  });

  it('gives every beast a valid element, rarity and three form names', () => {
    for (const k of keys) {
      const sp = SPECIES[k];
      assert.ok(ELEM[sp.el], `${k} element`);
      assert.ok(RARITY[sp.rarity], `${k} rarity`);
      assert.equal(FORMS[k]?.length, 3, `${k} forms`);
      assert.equal(FORMS[k][0], sp.name, `${k} base form name matches`);
    }
  });

  it('gives every element at least one beast', () => {
    for (const el of ELEM_ORDER) assert.ok(keys.some(k => SPECIES[k].el === el), el);
  });
});

describe('levelling', () => {
  it('levels up and carries leftover XP', () => {
    const c = card('cindermaw');
    const gained = addXp(c, xpNext(1) + 5);
    assert.equal(gained, 1);
    assert.equal(c.lvl, 2);
    assert.equal(c.xp, 5);
  });

  it('stops at the level cap with no stored XP', () => {
    const c = card('cindermaw');
    addXp(c, 1_000_000);
    assert.equal(c.lvl, capOf(c));
    assert.equal(c.xp, 0);
  });

  it('raises the cap by 10 per evolution', () => {
    assert.equal(capOf(card('cindermaw', 1, 0)), RARITY.common.cap);
    assert.equal(capOf(card('cindermaw', 1, 2)), RARITY.common.cap + 20);
  });

  it('previews XP without changing the card', () => {
    const c = card('cindermaw');
    const after = simXp(c, 500);
    assert.equal(c.lvl, 1);
    assert.ok(after.lvl > 1);
  });

  it('gives 1.5x XP for same-element food', () => {
    const base = card('cindermaw');
    assert.equal(feedXp(card('ashwing'), base), Math.round(feedXp(card('ashwing')) * 1.5));
  });
});

describe('evolution', () => {
  it('never lowers stats: an evolved card at level 1 beats its max-level earlier form', () => {
    for (const k of Object.keys(SPECIES)) {
      for (let evo = 0; evo < 2; evo++) {
        const before = card(k, 0, evo); before.lvl = capOf(before);
        const after = card(k, 1, evo + 1);
        assert.ok(statsOf(after).maxHp >= statsOf(before).maxHp, `${k} hp evo ${evo}`);
        assert.ok(statsOf(after).atk >= statsOf(before).atk, `${k} atk evo ${evo}`);
      }
    }
  });
});

describe('saves', () => {
  it('starts new players with a team of three and spare copies to feed', () => {
    const s = defaultSave();
    assert.equal(s.team.length, 3);
    assert.ok(s.roster.length > 3);
  });

  it('upgrades an old save: adds missing fields, drops unknown beasts, repairs the team', () => {
    const old = {
      roster: [{ id: 1, sp: 'cindermaw', lvl: 99, xp: 0 }, { id: 2, sp: 'no-such-beast', lvl: 1, xp: 0 }],
      team: [1, 2, 7],
      shards: 40, stage: 3, nextId: 3,
    };
    const s = migrate(old);
    assert.equal(s.roster.length, 1);
    assert.deepEqual(s.team, [1]);
    const c = s.roster[0];
    assert.equal(c.evo, 0);
    assert.equal(c.skill, 1);
    assert.equal(c.lvl, capOf(c), 'level clamped to cap');
    assert.equal(typeof s.gold, 'number');
  });

  it('assigns increasing card ids', () => {
    const s = defaultSave();
    const a = newCard(s, 'tidecoil'), b = newCard(s, 'tidecoil');
    assert.equal(b.id, a.id + 1);
  });
});
