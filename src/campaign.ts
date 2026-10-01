import { COLLECTIBLE_KEYS, ELEM, ELEM_ORDER, SPECIES } from './data';
import type { BossTier } from './bosses';
import { REGIONS, SIGIL_GATE, type Region } from './regions';
import type { ElementKey, RarityKey } from './types';

/*
 * Campaign rules. Pure functions with no page access, so all of it is tested.
 *
 * The world is a Circle: nine regions, then the Sigil Gate. Each region has
 * eight main stages on a trail (the eighth is its Legendary boss) and two
 * optional side stages that branch off it. Beating the Gate opens the next
 * Circle: the same regions, harder, with evolved bosses. Circles never end.
 *
 * Every stage's enemies come from a random generator seeded with the stage's
 * id, so the map's preview always matches the fight, and replays are the same.
 *
 * A stage is three waves, and a wave is a group of one to three enemies
 * fighting at once. The first few stages of the game send one at a time;
 * after that groups grow with difficulty. Side stage 1 is a swarm. Each region
 * also has two wardens (boss-only beasts): its own at main stage 4, and a
 * wandering one, of the element that beats the region, at side stage 2.
 */

export type StageKind = 'main' | 'side' | 'gate';

export interface StageRef {
  /** 1 for the first time through the world, 2 for Circle II, and so on. */
  circle: number;
  /** 0-8 for the regions; 9 for the Sigil Gate. */
  region: number;
  kind: StageKind;
  /** Main stages 0-7 (7 is the boss), side stages 0-1, the Gate 0. */
  index: number;
}

export interface EnemySpec {
  key: string;
  evo: number;
  lvl: number;
  /** The tougher third-wave enemy of an ordinary stage. */
  leader: boolean;
  /** A region boss or the Gate's guardian. */
  boss: boolean;
  /** Set for every enemy that fights with boss phases and signature moves. */
  tier?: BossTier;
}

export interface StagePlan extends StageRef {
  id: string;
  name: string;
  /** Short label such as "1-3", "1-S1", "II · 4-8" or "Gate". */
  label: string;
  el: ElementKey;
  /** Overall difficulty: rises by one per main stage, forever. */
  difficulty: number;
  /** Three waves; each is a group of enemies that fight at the same time. */
  waves: EnemySpec[][];
  /** Seconds to beat for the third star. */
  par: number;
  isBoss: boolean;
  bossLine?: string;
}

export interface CampaignState {
  /** Best stars per stage id (1-3). A stage with stars is cleared. */
  stars: Record<string, number>;
  /** Chest milestones already claimed, per region key "circle.regionId". */
  chests: Record<string, number[]>;
  /** Region intros already shown, by region key. */
  seen: string[];
  /** Region the map showed last. */
  view?: { circle: number; region: number };
}

export const MAIN_STAGES = 8;
/** Side stage j opens once main stage SIDE_AFTER[j] is cleared. */
export const SIDE_AFTER = [2, 5] as const;
/** Region star totals that open a chest. A region holds 10 stages, so 30 stars at most. */
export const CHEST_MILESTONES = [10, 20, 30] as const;
export const GATE = REGIONS.length;
/** Main stages per Circle, the Gate included. */
const PER_CIRCLE = REGIONS.length * MAIN_STAGES + 1;

export const newCampaign = (): CampaignState => ({ stars: {}, chests: {}, seen: [] });

/* ---------- names and ids ---------- */
export function roman(n: number): string {
  const map: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

export const regionKey = (circle: number, region: number) =>
  `${circle}.${region === GATE ? SIGIL_GATE.id : REGIONS[region].id}`;

export function stageId(r: StageRef): string {
  const code = r.kind === 'main' ? 'm' : r.kind === 'side' ? 's' : 'g';
  return `${regionKey(r.circle, r.region)}.${code}${r.index}`;
}

export function parseStageId(id: string): StageRef | null {
  const m = /^(\d+)\.([a-z]+)\.([msg])(\d)$/.exec(id);
  if (!m) return null;
  const circle = Number(m[1]);
  const region = m[2] === SIGIL_GATE.id ? GATE : REGIONS.findIndex(r => r.id === m[2]);
  if (circle < 1 || region < 0) return null;
  const kind: StageKind = m[3] === 'm' ? 'main' : m[3] === 's' ? 'side' : 'gate';
  return { circle, region, kind, index: Number(m[4]) };
}

/* ---------- difficulty and enemies ---------- */
export function difficulty(r: StageRef): number {
  const base = (r.circle - 1) * PER_CIRCLE;
  if (r.kind === 'gate') return base + PER_CIRCLE;
  const main = base + r.region * MAIN_STAGES + 1;
  if (r.kind === 'main') return main + r.index;
  return main + SIDE_AFTER[r.index] + 1;
}

/** A small seeded random generator, so a stage's enemies never change. */
function rng(seed: string) {
  let a = [...seed].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const levelFor = (d: number, wave: number, leader: boolean, boss: boolean) =>
  1 + Math.round((d - 1) * 0.8) + wave + (leader ? 1 : 0) + (boss ? 2 : 0);

/** Which rarities may appear, growing with difficulty. */
function allowedRarities(d: number, leader: boolean): RarityKey[] {
  if (leader) return ['rare', ...(d >= 6 ? ['epic' as const] : []), ...(d >= PER_CIRCLE ? ['legendary' as const] : [])];
  return ['common', 'rare', ...(d >= 12 ? ['epic' as const] : [])];
}

function evoFor(d: number, leader: boolean): number {
  if (leader) return d >= 30 ? 2 : d >= 5 ? 1 : 0;
  return d >= 45 ? 2 : d >= 12 ? 1 : 0;
}

/** The boss-only warden of an element. */
export function wardenFor(el: ElementKey): string {
  const k = Object.keys(SPECIES).find(k => SPECIES[k].bossOnly && SPECIES[k].el === el);
  if (!k) throw new Error(`No warden for ${el}`);
  return k;
}
/** The element that beats this one (the first in the chart), whose warden wanders into the region. */
export const nemesisOf = (el: ElementKey): ElementKey => ELEM_ORDER.find(o => ELEM[o].beats.includes(el))!;

/** Main stage (0-based) where a region's own warden waits. */
export const WARDEN_STAGE = 3;

/** How many enemies fight at once in each of a stage's three waves. */
export function groupSizes(r: StageRef, d: number, random: () => number): [number, number, number] {
  if (r.kind === 'gate') return [1, 2, 1];
  if (r.kind === 'side') return r.index === 0 ? [2, 3, 3] : [2, 2, 1];
  const bossWave = r.index === MAIN_STAGES - 1 || r.index === WARDEN_STAGE;
  if (d <= 4) return [1, 1, 1];
  const trio = d >= 25 ? 0.35 : 0;
  const w1 = d >= 17 ? (random() < trio ? 3 : 2) : 1;
  const w2 = random() < trio ? 3 : 2;
  const w3 = !bossWave && d >= 20 && random() < 0.5 ? 2 : 1;
  return [w1, w2, w3];
}

/** The full plan for one stage: its name, label, three waves of enemies and par time. */
export function planStage(r: StageRef): StagePlan {
  const id = stageId(r), d = difficulty(r), random = rng(id);
  const pick = <T>(a: T[]) => a[Math.floor(random() * a.length)];
  const circleTag = r.circle > 1 ? `${roman(r.circle)} · ` : '';
  const bossEvo = Math.min(2, r.circle - 1);

  if (r.kind === 'gate') {
    const legends = COLLECTIBLE_KEYS.filter(k => SPECIES[k].rarity === 'legendary');
    const guardian = SIGIL_GATE.bosses[(r.circle - 1) % SIGIL_GATE.bosses.length];
    const sizes = groupSizes(r, d, random);
    const waves: EnemySpec[][] = [0, 1].map(w => Array.from({ length: sizes[w] }, () =>
      ({ key: pick(legends), evo: bossEvo, lvl: levelFor(d, w, true, false), leader: true, boss: false })));
    waves.push([{ key: guardian, evo: bossEvo, lvl: levelFor(d, 2, false, true), leader: false, boss: true, tier: 'guardian' }]);
    return { ...r, id, name: SIGIL_GATE.name, label: `${circleTag}Gate`, el: SPECIES[guardian].el, difficulty: d, waves, par: parFor(130, waves), isBoss: true, bossLine: SIGIL_GATE.bossLine };
  }

  const region: Region = REGIONS[r.region];
  const isBoss = r.kind === 'main' && r.index === MAIN_STAGES - 1;
  const onElement = (k: string) => SPECIES[k].el === region.el;
  const wardenHere = r.kind === 'main' && r.index === WARDEN_STAGE ? wardenFor(region.el)
    : r.kind === 'side' && r.index === 1 ? wardenFor(nemesisOf(region.el)) : null;
  const sizes = groupSizes(r, d, random);
  const one = (w: number, leader: boolean): EnemySpec => {
    const rarities = allowedRarities(d, leader);
    let pool = COLLECTIBLE_KEYS.filter(k => rarities.includes(SPECIES[k].rarity) && SPECIES[k].rarity !== 'mythic');
    // Mostly the region's own element, so players learn to bring counters.
    const home = pool.filter(onElement);
    if (home.length && random() < 0.75) pool = home;
    return { key: pick(pool), evo: evoFor(d, leader), lvl: levelFor(d, w, leader, false), leader, boss: false };
  };
  const waves: EnemySpec[][] = [];
  for (let w = 0; w < 3; w++) {
    if (isBoss && w === 2) {
      waves.push([{ key: region.boss, evo: bossEvo, lvl: levelFor(d, w, false, true), leader: false, boss: true, tier: 'ruler' }]);
      continue;
    }
    if (wardenHere && w === 2) {
      waves.push([{ key: wardenHere, evo: Math.min(2, evoFor(d, true)), lvl: levelFor(d, w, true, false) + 1, leader: false, boss: false, tier: 'warden' }]);
      continue;
    }
    // The third wave is led by a tougher leader; any others with it are ordinary.
    waves.push(Array.from({ length: sizes[w] }, (_, i) => one(w, w === 2 && i === 0)));
  }
  const name = r.kind === 'main' ? region.stages[r.index] : region.sides[r.index];
  const label = r.kind === 'main' ? `${circleTag}${r.region + 1}-${r.index + 1}` : `${circleTag}${r.region + 1}-S${r.index + 1}`;
  const par = parFor(isBoss ? 110 : wardenHere ? 95 : r.kind === 'side' ? 85 : 75, waves);
  return { ...r, id, name, label, el: region.el, difficulty: d, waves, par, isBoss, bossLine: isBoss ? region.bossLine : undefined };
}

/** Par time grows with every enemy past the first three. */
const parFor = (base: number, waves: EnemySpec[][]) => base + 8 * Math.max(0, waves.flat().length - 3);

/** The enemy with boss phases in a plan, if any (wardens, rulers and guardians). */
export const planBoss = (p: StagePlan): EnemySpec | undefined => p.waves.flat().find(e => e.tier);

/** Every stage in a region, main trail first, then the side stages. */
export function regionStages(circle: number, region: number): StageRef[] {
  if (region === GATE) return [{ circle, region, kind: 'gate', index: 0 }];
  const main = Array.from({ length: MAIN_STAGES }, (_, index) => ({ circle, region, kind: 'main' as const, index }));
  const side = SIDE_AFTER.map((_, index) => ({ circle, region, kind: 'side' as const, index }));
  return [...main, ...side];
}

/* ---------- progress ---------- */
export const isCleared = (s: CampaignState, r: StageRef) => (s.stars[stageId(r)] ?? 0) > 0;

export function regionUnlocked(s: CampaignState, circle: number, region: number): boolean {
  if (region > 0) return isCleared(s, region === GATE
    ? { circle, region: GATE - 1, kind: 'main', index: MAIN_STAGES - 1 }
    : { circle, region: region - 1, kind: 'main', index: MAIN_STAGES - 1 });
  if (circle === 1) return true;
  return isCleared(s, { circle: circle - 1, region: GATE, kind: 'gate', index: 0 });
}

export function stageUnlocked(s: CampaignState, r: StageRef): boolean {
  if (!regionUnlocked(s, r.circle, r.region)) return false;
  if (r.kind === 'gate') return true;
  if (r.kind === 'side') return isCleared(s, { ...r, kind: 'main', index: SIDE_AFTER[r.index] });
  return r.index === 0 || isCleared(s, { ...r, index: r.index - 1 });
}

/** The highest Circle the player can reach. */
export function topCircle(s: CampaignState): number {
  let c = 1;
  while (isCleared(s, { circle: c, region: GATE, kind: 'gate', index: 0 })) c++;
  return c;
}

/** The next main-trail stage (or Gate) the player hasn't cleared yet. */
export function frontier(s: CampaignState): StageRef {
  const circle = topCircle(s);
  for (let region = 0; region < GATE; region++) {
    for (let index = 0; index < MAIN_STAGES; index++) {
      const r: StageRef = { circle, region, kind: 'main', index };
      if (!isCleared(s, r)) return r;
    }
  }
  return { circle, region: GATE, kind: 'gate', index: 0 };
}

/** Stars earned in a fight: one for winning, one for losing no beast, one for beating par. */
export function starsFor(won: boolean, knockouts: number, seconds: number, par: number): number {
  if (!won) return 0;
  return 1 + (knockouts === 0 ? 1 : 0) + (seconds <= par ? 1 : 0);
}

/** Record a result, keeping the best stars. Returns true on a first clear. */
export function recordClear(s: CampaignState, r: StageRef, stars: number): boolean {
  const id = stageId(r), before = s.stars[id] ?? 0;
  if (stars > before) s.stars[id] = stars;
  return before === 0 && stars > 0;
}

export function regionStars(s: CampaignState, circle: number, region: number): number {
  return regionStages(circle, region).reduce((sum, r) => sum + (s.stars[stageId(r)] ?? 0), 0);
}
export const regionMaxStars = (region: number) => regionStages(1, region).length * 3;

/* ---------- chests ---------- */
export interface ChestReward { shards: number; gold: number; card?: string }

/** What a region's chest holds. The last chest gives a card: an Epic of the
 *  region's element in Circle I, the region's own Legendary after that. */
export function chestReward(circle: number, region: number, milestone: number): ChestReward {
  const reg = REGIONS[region];
  if (milestone === CHEST_MILESTONES[0]) return { shards: 100 * circle, gold: 0 };
  if (milestone === CHEST_MILESTONES[1]) return { shards: 100 * circle, gold: 800 * circle };
  if (circle > 1) return { shards: 0, gold: 0, card: reg.boss };
  const epics = COLLECTIBLE_KEYS.filter(k => SPECIES[k].el === reg.el && SPECIES[k].rarity === 'epic').sort();
  return { shards: 0, gold: 0, card: epics[Math.floor(rng(regionKey(circle, region))() * epics.length)] };
}

/** Chests the player has earned but not opened yet. */
export function openableChests(s: CampaignState, circle: number, region: number): number[] {
  if (region === GATE) return [];
  const have = regionStars(s, circle, region), claimed = s.chests[regionKey(circle, region)] ?? [];
  return CHEST_MILESTONES.filter(m => have >= m && !claimed.includes(m));
}

/** Mark a chest opened and return its reward, or null if it can't be opened. */
export function claimChest(s: CampaignState, circle: number, region: number, milestone: number): ChestReward | null {
  if (!openableChests(s, circle, region).includes(milestone)) return null;
  const key = regionKey(circle, region);
  s.chests[key] = [...(s.chests[key] ?? []), milestone];
  return chestReward(circle, region, milestone);
}

/* ---------- rewards ---------- */
/** Soul shards and gold for a first clear, on top of what each defeated enemy pays. */
export function firstClearBonus(p: StagePlan): { shards: number; gold: number } {
  const k = p.kind === 'side' ? 2 : p.isBoss ? 3 : 1;
  return { shards: (40 + 4 * p.difficulty) * k, gold: (100 + 15 * p.difficulty) * k };
}

/* ---------- saves from before the campaign ---------- */
/** Old saves counted stages 1, 2, 3...; clear that many main stages with one star each. */
export function campaignFromOldStage(stage: number): CampaignState {
  const s = newCampaign();
  let left = Math.max(0, Math.floor(stage) - 1);
  for (let circle = 1; left > 0; circle++) {
    for (let region = 0; region <= GATE && left > 0; region++) {
      const refs = region === GATE ? regionStages(circle, GATE) : regionStages(circle, region).filter(r => r.kind === 'main');
      for (const r of refs) { if (left-- <= 0) break; s.stars[stageId(r)] = 1; }
    }
  }
  return s;
}

/** The stage that follows on the trail: the next main stage, the next region, the Gate, or the next Circle. */
export function nextMain(r: StageRef): StageRef {
  if (r.kind === 'gate') return { circle: r.circle + 1, region: 0, kind: 'main', index: 0 };
  if (r.kind === 'side') return { circle: r.circle, region: r.region, kind: 'main', index: SIDE_AFTER[r.index] + 1 };
  if (r.index < MAIN_STAGES - 1) return { ...r, index: r.index + 1 };
  if (r.region + 1 === GATE) return { circle: r.circle, region: GATE, kind: 'gate', index: 0 };
  return { circle: r.circle, region: r.region + 1, kind: 'main', index: 0 };
}
