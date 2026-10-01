import type { ElementKey } from './types';

/*
 * Boss rules. Pure data and functions with no page access, so they're tested;
 * src/battle.ts plays them out.
 *
 * Three kinds of boss:
 *   warden    boss-only miniboss in the middle of a region (src/beasts/wardens.ts)
 *   ruler     the region's Legendary at the end of its trail
 *   guardian  the Mythic at the Sigil Gate
 *
 * A boss fights in phases. Each time its health drops past a threshold it
 * roars, shakes off its ailments, speeds up and learns another signature move.
 *
 * Signature moves, each with its own counter:
 *   smash    a long charge that can't be parried. Break it with a Special, or
 *            by hitting the boss hard enough while it charges.
 *   sweep    hits every beast on your team, benched ones too. Parry it.
 *   barrage  three quick strikes in a row. Parry each one.
 */

export type BossTier = 'warden' | 'ruler' | 'guardian';
export type MoveKind = 'smash' | 'sweep' | 'barrage';

export interface BossKit {
  tier: BossTier;
  /** Health fractions where a new phase starts, highest first. */
  phases: number[];
  /** Signature moves the boss may use in each phase (one list per phase). */
  moves: MoveKind[][];
  /** Ordinary attacks between signature moves, per phase. */
  normalsBetween: number[];
}

export const KITS: Record<BossTier, BossKit> = {
  warden: { tier: 'warden', phases: [0.5], moves: [['sweep'], ['sweep', 'smash']], normalsBetween: [3, 2] },
  ruler: { tier: 'ruler', phases: [0.66, 0.33], moves: [['sweep'], ['sweep', 'barrage'], ['smash', 'barrage', 'sweep']], normalsBetween: [3, 2, 1] },
  guardian: { tier: 'guardian', phases: [0.75, 0.5, 0.25], moves: [['barrage'], ['barrage', 'sweep'], ['smash', 'sweep', 'barrage'], ['smash', 'sweep', 'barrage']], normalsBetween: [2, 2, 1, 1] },
};

/** How each move plays. Damage is a multiple of the boss's normal hit. */
export const MOVES = {
  smash: { windup: 2.4, mult: 2.2, parry: false,
    /** Damage that breaks the charge, as a share of the boss's max health. */
    breakShare: 0.14 },
  sweep: { windup: 1.35, mult: 0.8, parry: true },
  barrage: { windup: 1.05, mult: 0.5, parry: true, hits: 3, gap: 0.62 },
} as const;

/** Seconds a boss roars when a new phase starts; it doesn't attack meanwhile. */
export const ROAR = 1.2;

/** What each element calls its moves. */
export const MOVE_NAMES: Record<ElementKey, Record<MoveKind, string>> = {
  pyre: { smash: 'Kiln Breath', sweep: 'Ashfall', barrage: 'Ember Flurry' },
  tide: { smash: 'Abyssal Crush', sweep: 'Riptide', barrage: 'Lashing Waves' },
  thorn: { smash: 'Heartwood Slam', sweep: 'Bramble Sweep', barrage: 'Thorn Volley' },
  frost: { smash: 'Glacier Fall', sweep: 'Blizzard', barrage: 'Icicle Rain' },
  storm: { smash: 'Thunderhead', sweep: 'Chain Lightning', barrage: 'Static Barrage' },
  stone: { smash: 'Mountain Crush', sweep: 'Rockslide', barrage: 'Pebble Storm' },
  gale: { smash: 'Cyclone Dive', sweep: 'Gale Sweep', barrage: 'Feather Storm' },
  radiant: { smash: 'Judgment', sweep: 'Dawnflare', barrage: 'Halo Lances' },
  umbral: { smash: 'Eclipse', sweep: 'Night Tide', barrage: 'Shadow Claws' },
};

/** One-line counter shown the first time a player sees each move in a fight. */
export const MOVE_HINT: Record<MoveKind, string> = {
  smash: 'Can’t parry! Special or big hits break it',
  sweep: 'Hits your whole team. Parry it!',
  barrage: 'Three strikes. Parry each one!',
};

/** A boss's progress through one fight. */
export interface BossState {
  tier: BossTier;
  phase: number;
  /** Ordinary attacks since the last signature move. */
  normals: number;
  last: MoveKind | null;
}

export const newBossState = (tier: BossTier): BossState => ({ tier, phase: 0, normals: 0, last: null });

/** Which phase a boss should be in at this share of its health (0 = first). */
export function phaseAt(tier: BossTier, hpShare: number): number {
  return KITS[tier].phases.filter(t => hpShare <= t).length;
}

/**
 * Move to the next phase if health has dropped past its threshold. Only one
 * phase at a time, so a huge hit can't skip a phase's roar. Returns true when
 * a new phase starts; the boss then opens it with a signature move.
 */
export function advancePhase(s: BossState, hpShare: number): boolean {
  if (phaseAt(s.tier, hpShare) <= s.phase) return false;
  s.phase++;
  s.normals = KITS[s.tier].normalsBetween[s.phase];
  return true;
}

/** The boss's next attack: an ordinary hit, or a signature move when one is due. */
export function chooseAttack(s: BossState, random: () => number): MoveKind | 'normal' {
  const kit = KITS[s.tier];
  if (s.normals < kit.normalsBetween[s.phase]) { s.normals++; return 'normal'; }
  const opts = kit.moves[s.phase];
  // Avoid the same move twice in a row when there's a choice.
  const fresh = opts.length > 1 ? opts.filter(m => m !== s.last) : opts;
  const move = fresh[Math.floor(random() * fresh.length)];
  s.normals = 0; s.last = move;
  return move;
}

/** Bosses get quicker each phase: multipliers for wind-up length and time between attacks. */
export function tempoFor(s: BossState): { windup: number; rest: number } {
  return { windup: Math.pow(0.9, s.phase), rest: Math.pow(0.85, s.phase) };
}

/** Banner text for a new phase. */
export function phaseTitle(s: BossState): string {
  return s.phase >= KITS[s.tier].phases.length ? 'Enraged!' : `Phase ${s.phase + 1}`;
}
