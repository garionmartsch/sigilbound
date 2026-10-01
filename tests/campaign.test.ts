import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CHEST_MILESTONES, GATE, MAIN_STAGES, SIDE_AFTER, campaignFromOldStage, chestReward, claimChest, difficulty, frontier,
  isCleared, newCampaign, nextMain, openableChests, parseStageId, planStage, recordClear, regionStages, regionStars,
  regionUnlocked, roman, stageId, stageUnlocked, starsFor, topCircle, type CampaignState, type StageRef,
  WARDEN_STAGE, nemesisOf, planBoss, wardenFor,
} from '../src/campaign';
import { ELEM, SPECIES } from '../src/data';
import { REGIONS, SIGIL_GATE } from '../src/regions';
import { migrate } from '../src/save';

const main = (region: number, index: number, circle = 1): StageRef => ({ circle, region, kind: 'main', index });
const gate = (circle = 1): StageRef => ({ circle, region: GATE, kind: 'gate', index: 0 });
/** Clear every main stage and the Gate of a Circle. */
function clearCircle(s: CampaignState, circle: number) {
  for (let r = 0; r < GATE; r++) for (let i = 0; i < MAIN_STAGES; i++) recordClear(s, main(r, i, circle), 1);
  recordClear(s, gate(circle), 1);
}

describe('world', () => {
  it('has nine regions, one per element, each ruled by a Legendary of its element', () => {
    assert.equal(REGIONS.length, 9);
    assert.equal(new Set(REGIONS.map(r => r.el)).size, 9);
    for (const r of REGIONS) {
      assert.equal(SPECIES[r.boss]?.rarity, 'legendary', r.id);
      assert.equal(SPECIES[r.boss].el, r.el, r.id);
      assert.equal(r.stages.length, MAIN_STAGES);
    }
  });

  it('guards the Sigil Gate with Mythics', () => {
    for (const k of SIGIL_GATE.bosses) assert.equal(SPECIES[k]?.rarity, 'mythic', k);
  });

  it('gives every stage a unique name within its region', () => {
    for (const r of REGIONS) {
      const names = [...r.stages, ...r.sides];
      assert.equal(new Set(names).size, names.length, r.id);
    }
  });
});

describe('stage ids', () => {
  it('round-trip through text, including far Circles', () => {
    for (const c of [1, 2, 37]) for (let r = 0; r <= GATE; r++) for (const ref of regionStages(c, r)) {
      assert.deepEqual(parseStageId(stageId(ref)), ref);
    }
  });
  it('rejects nonsense', () => {
    for (const bad of ['', '1.nowhere.m0', '0.emberwild.m0', 'x.emberwild.m0', '1.emberwild.q1']) assert.equal(parseStageId(bad), null, bad);
  });
  it('writes Roman numerals for Circles', () => {
    assert.deepEqual([1, 2, 4, 9, 14, 40, 99].map(roman), ['I', 'II', 'IV', 'IX', 'XIV', 'XL', 'XCIX']);
  });
});

describe('stage plans', () => {
  it('are the same every time, so the preview matches the fight', () => {
    for (const ref of [main(0, 0), main(4, 3, 3), gate(2)]) assert.deepEqual(planStage(ref), planStage(ref));
  });

  it('put the region\'s Legendary at the end of its trail, evolving in later Circles', () => {
    REGIONS.forEach((reg, r) => {
      const p1 = planStage(main(r, MAIN_STAGES - 1)), p3 = planStage(main(r, MAIN_STAGES - 1, 3));
      assert.equal(p1.waves[2].length, 1, 'the ruler fights alone');
      assert.ok(p1.isBoss && p1.waves[2][0].boss);
      assert.equal(p1.waves[2][0].key, reg.boss);
      assert.equal(p1.waves[2][0].tier, 'ruler');
      assert.equal(p1.waves[2][0].evo, 0);
      assert.equal(p3.waves[2][0].evo, 2);
    });
  });

  it('draw mostly from the region\'s own element', () => {
    let home = 0, total = 0;
    REGIONS.forEach((reg, r) => { for (let i = 0; i < MAIN_STAGES - 1; i++) for (const w of planStage(main(r, i)).waves.flat().filter(x => !x.tier)) { total++; if (SPECIES[w.key].el === reg.el) home++; } });
    assert.ok(home / total > 0.6, `${home}/${total}`);
  });

  it('keep Legendaries out of Circle I except as rulers, and Mythics out of ordinary stages', () => {
    for (let r = 0; r < GATE; r++) for (const ref of regionStages(1, r)) for (const w of planStage(ref).waves.flat()) {
      if (!w.boss) assert.notEqual(SPECIES[w.key].rarity, 'legendary', `${stageId(ref)} ${w.key}`);
      assert.notEqual(SPECIES[w.key].rarity, 'mythic');
    }
  });

  it('grow harder forever: difficulty and enemy levels keep rising', () => {
    let last = 0;
    for (let c = 1; c <= 4; c++) for (let r = 0; r <= GATE; r++) for (const ref of regionStages(c, r).filter(x => x.kind !== 'side')) {
      const d = difficulty(ref);
      assert.ok(d > last, stageId(ref)); last = d;
    }
    assert.ok(planStage(main(0, 0, 5)).waves[0][0].lvl > planStage(main(8, 6, 1)).waves[0][0].lvl);
  });

  it('send one enemy at a time early, then groups of up to three', () => {
    for (let i = 0; i < 4; i++) assert.deepEqual(planStage(main(0, i)).waves.map(w => w.length), [1, 1, 1], `1-${i + 1}`);
    let groups = 0, max = 0;
    for (let c = 1; c <= 3; c++) for (let r = 0; r < GATE; r++) for (const ref of regionStages(c, r)) for (const w of planStage(ref).waves) {
      assert.ok(w.length >= 1 && w.length <= 3, stageId(ref));
      if (w.length > 1) groups++; max = Math.max(max, w.length);
      if (w.some(e => e.tier)) assert.equal(w.length, 1, `${stageId(ref)}: bosses fight alone`);
    }
    assert.ok(groups > 100 && max === 3);
    assert.deepEqual(planStage({ circle: 1, region: 0, kind: 'side', index: 0 }).waves.map(w => w.length), [2, 3, 3], 'side stage 1 is a swarm');
  });

  it('put a warden at stage 4 and a wandering warden at side stage 2 of every region', () => {
    REGIONS.forEach((reg, r) => {
      const own = planStage(main(r, WARDEN_STAGE)).waves[2][0];
      assert.equal(own.tier, 'warden'); assert.equal(own.key, wardenFor(reg.el));
      assert.ok(SPECIES[own.key].bossOnly);
      const roam = planStage({ circle: 1, region: r, kind: 'side', index: 1 }).waves[2][0];
      assert.equal(roam.tier, 'warden'); assert.equal(SPECIES[roam.key].el, nemesisOf(reg.el));
      assert.ok(ELEM[nemesisOf(reg.el)].beats.includes(reg.el));
    });
  });

  it('never use boss-only wardens as ordinary enemies or rewards', () => {
    for (let c = 1; c <= 2; c++) for (let r = 0; r < GATE; r++) {
      for (const ref of regionStages(c, r)) for (const w of planStage(ref).waves.flat()) if (SPECIES[w.key].bossOnly) assert.equal(w.tier, 'warden');
      const card = chestReward(c, r, 30).card; assert.ok(card && !SPECIES[card].bossOnly);
    }
  });

  it('give the Gate a Mythic guardian with the guardian boss kit', () => {
    const g = planStage(gate(1)), boss = planBoss(g)!;
    assert.equal(boss.tier, 'guardian'); assert.equal(SPECIES[boss.key].rarity, 'mythic');
  });

  it('allow more time for stages with more enemies', () => {
    const solo = planStage(main(0, 0)), swarm = planStage({ circle: 1, region: 0, kind: 'side', index: 0 });
    assert.equal(solo.par, 75); assert.equal(swarm.par, 85 + 8 * 5);
  });

  it('make side stages a notch harder than the stage they branch from', () => {
    SIDE_AFTER.forEach((a, j) => assert.equal(difficulty({ circle: 1, region: 2, kind: 'side', index: j }), difficulty(main(2, a)) + 1));
  });
});

describe('progress', () => {
  it('starts with only the first stage open', () => {
    const s = newCampaign();
    assert.ok(stageUnlocked(s, main(0, 0)));
    assert.ok(!stageUnlocked(s, main(0, 1)));
    assert.ok(!regionUnlocked(s, 1, 1));
    assert.deepEqual(frontier(s), main(0, 0));
  });

  it('opens the trail one stage at a time, and side stages after their branch point', () => {
    const s = newCampaign();
    for (let i = 0; i < SIDE_AFTER[0]; i++) recordClear(s, main(0, i), 1);
    const side0: StageRef = { circle: 1, region: 0, kind: 'side', index: 0 };
    assert.ok(!stageUnlocked(s, side0));
    recordClear(s, main(0, SIDE_AFTER[0]), 1);
    assert.ok(stageUnlocked(s, side0));
    assert.deepEqual(frontier(s), main(0, SIDE_AFTER[0] + 1));
  });

  it('opens the next region after its boss, the Gate after the Nightfall, and a new Circle after the Gate', () => {
    const s = newCampaign();
    for (let r = 0; r < GATE; r++) for (let i = 0; i < MAIN_STAGES; i++) recordClear(s, main(r, i), 2);
    assert.ok(regionUnlocked(s, 1, GATE));
    assert.deepEqual(frontier(s), gate(1));
    assert.equal(topCircle(s), 1);
    recordClear(s, gate(1), 1);
    assert.equal(topCircle(s), 2);
    assert.ok(regionUnlocked(s, 2, 0));
    assert.deepEqual(frontier(s), main(0, 0, 2));
  });

  it('never ends: Circle after Circle', () => {
    const s = newCampaign();
    for (let c = 1; c <= 6; c++) clearCircle(s, c);
    assert.equal(topCircle(s), 7);
    assert.deepEqual(frontier(s), main(0, 0, 7));
  });

  it('walks the trail in order with nextMain', () => {
    assert.deepEqual(nextMain(main(0, 3)), main(0, 4));
    assert.deepEqual(nextMain(main(0, MAIN_STAGES - 1)), main(1, 0));
    assert.deepEqual(nextMain(main(8, MAIN_STAGES - 1)), gate(1));
    assert.deepEqual(nextMain(gate(1)), main(0, 0, 2));
    assert.deepEqual(nextMain({ circle: 1, region: 3, kind: 'side', index: 1 }), main(3, SIDE_AFTER[1] + 1));
  });
});

describe('stars and chests', () => {
  it('award a star each for winning, losing no beast and beating par', () => {
    assert.equal(starsFor(false, 0, 10, 75), 0);
    assert.equal(starsFor(true, 2, 200, 75), 1);
    assert.equal(starsFor(true, 0, 200, 75), 2);
    assert.equal(starsFor(true, 0, 60, 75), 3);
  });

  it('keep the best result and report only the first clear', () => {
    const s = newCampaign(), r = main(0, 0);
    assert.equal(recordClear(s, r, 2), true);
    assert.equal(recordClear(s, r, 1), false);
    assert.equal(s.stars[stageId(r)], 2);
    recordClear(s, r, 3);
    assert.equal(s.stars[stageId(r)], 3);
  });

  it('open chests at 10, 20 and 30 region stars, each once', () => {
    const s = newCampaign();
    for (const r of regionStages(1, 0)) recordClear(s, r, 3);
    assert.equal(regionStars(s, 1, 0), 30);
    assert.deepEqual(openableChests(s, 1, 0), [...CHEST_MILESTONES]);
    for (const m of CHEST_MILESTONES) assert.ok(claimChest(s, 1, 0, m));
    assert.deepEqual(openableChests(s, 1, 0), []);
    assert.equal(claimChest(s, 1, 0, 10), null);
  });

  it('give an Epic of the region\'s element in Circle I and the region\'s Legendary after that', () => {
    REGIONS.forEach((reg, r) => {
      const c1 = chestReward(1, r, 30).card!, c2 = chestReward(2, r, 30).card!;
      assert.equal(SPECIES[c1].rarity, 'epic', reg.id);
      assert.equal(SPECIES[c1].el, reg.el, reg.id);
      assert.equal(c2, reg.boss);
    });
  });
});

describe('saves from before the campaign', () => {
  it('turn "Stage N" into N-1 cleared stages in trail order', () => {
    const s = campaignFromOldStage(12);
    assert.equal(Object.keys(s.stars).length, 11);
    assert.ok(isCleared(s, main(0, 7)) && isCleared(s, main(1, 2)));
    assert.deepEqual(frontier(s), main(1, 3));
  });

  it('are upgraded by migrate, and a fresh save starts at the first stage', () => {
    const old = { roster: [{ id: 1, sp: 'cindermaw', lvl: 5, xp: 0 }], team: [1], shards: 0, gold: 0, stage: 4, nextId: 2 };
    const s = migrate(old);
    assert.deepEqual(frontier(s.campaign), main(0, 3));
    assert.equal((s as unknown as { stage?: number }).stage, undefined);
    assert.deepEqual(frontier(campaignFromOldStage(1)), main(0, 0));
  });
});
