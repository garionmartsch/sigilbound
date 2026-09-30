import type { CampaignState } from './campaign';

export type ElementKey =
  | 'pyre' | 'tide' | 'thorn' | 'frost' | 'storm' | 'stone' | 'gale' | 'radiant' | 'umbral';

export type RarityKey = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type BodyType = 'brute' | 'wisp' | 'serpent' | 'avian' | 'golem' | 'beast' | 'drake';

/** Add-on parts that can go on any body. */
export type WingStyle = 'bat' | 'feather';
export type TailStyle = 'spike' | 'flame' | 'leaf' | 'fin';
export type PatternStyle = 'stripes' | 'spots' | 'runes';

export interface ElementInfo {
  name: string;
  color: string;
  /** Elements this one deals 1.5x damage to. */
  beats: ElementKey[];
}

export interface RarityInfo {
  /** Rift Summon weight, in percent. */
  w: number;
  /** Beast Call weight, in percent. */
  call: number;
  label: string;
  color: string;
  stars: number;
  /** Level cap of the base form; each evolution adds 10. */
  cap: number;
  /** XP given when a level 1 card of this rarity is fed. */
  feed: number;
  /** Gold for selling a level 1 card. */
  sell: number;
  /** Gold cost of the first evolution; the second costs double. */
  evo: number;
}

export interface Species {
  name: string;
  el: ElementKey;
  rarity: RarityKey;
  body: BodyType;
  /** Main body color, highlight color and eye glow color. */
  c1: string;
  c2: string;
  eye: string;
  hp: number;
  atk: number;
  /** Attack tempo multiplier; above 1 attacks more often. */
  spd: number;
  special: string;
  /** Names of the three forms: base, evolved, final. forms[0] matches name. */
  forms: [string, string, string];
  /** One-sentence description of the base form, used for art prompts. */
  look?: string;
  /** How the evolved and final forms change, used for art prompts. */
  evoLooks?: [string, string];
  /** Made by tools/generate-commons.ts rather than designed by hand. */
  generated?: boolean;
  // Optional features for the code-drawn bodies.
  horns?: number;
  eyes?: number;
  spikes?: boolean;
  fins?: boolean;
  crown?: boolean;
  wings?: WingStyle;
  tail?: TailStyle;
  pattern?: PatternStyle;
  /** Evolution stage, set only while drawing. */
  evo?: number;
}

export interface Card {
  id: number;
  /** Species key, e.g. "cindermaw". */
  sp: string;
  lvl: number;
  xp: number;
  /** 0 base form, 1 evolved, 2 final form. */
  evo: number;
  /** Skill level 1 to 5; each level adds 12% special damage. */
  skill: number;
  locked: boolean;
}

export interface SaveData {
  roster: Card[];
  /** Card ids, up to three. */
  team: number[];
  shards: number;
  gold: number;
  nextId: number;
  /** Campaign progress: stars, chests, story seen. See src/campaign.ts. */
  campaign: CampaignState;
  /** First-time tutorial progress. */
  tutorial: TutorialState;
}

export interface TutorialState {
  done: boolean;
  /** Id of the current step, see src/tutorialFlow.ts. */
  step: string;
}

export type Screen = 'home' | 'battle' | 'altar' | 'roster' | 'forge' | 'map';
