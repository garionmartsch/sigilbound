import type { BodyType, ElementKey } from './types';

/*
 * Throwing rules. Pure data and functions with no page access, so they're
 * tested; src/battle.ts plays them out and src/fx.ts draws the shots.
 *
 * You fight by flicking from your beast toward an enemy. The flick's
 * direction picks who you hit, its speed sets the power, and holding first
 * charges a heavy throw. With a full energy bar the charged throw is your
 * beast's Special. A quick tap fires a light shot at your current target.
 * Swiping down still parries.
 *
 * Some enemies (spirits, birds and dragons) throw back. Their shots can be
 * parried as they arrive, or shot down in the air by throwing at them.
 */

export type ThrowKind = 'tap' | 'throw' | 'heavy' | 'special';

/** Damage (times attack), cooldown in seconds and energy gained, per kind of throw. */
export const THROWS: Record<Exclude<ThrowKind, 'special'>, { mult: number; cd: number; gain: number; size: number }> = {
  tap: { mult: 0.45, cd: 0.25, gain: 7, size: 0.6 },
  throw: { mult: 1, cd: 0.45, gain: 12, size: 0.85 },
  heavy: { mult: 1.75, cd: 0.8, gain: 16, size: 1.2 },
};

/** Holding still this long starts a charge; the charge is full this much later. */
export const CHARGE = { delay: 0.22, full: 0.5 };

/** How full the charge is (0-1) after holding for this many seconds. */
export const chargeAt = (held: number) => Math.max(0, Math.min(1, (held - CHARGE.delay) / CHARGE.full));

/** What a finished charge throws: the Special when energy is full, otherwise a heavy throw. */
export const chargedKind = (energy: number): ThrowKind => energy >= 100 ? 'special' : 'heavy';

/** A flick straight down is a parry; any other flick is a throw. */
export function classifyFlick(dx: number, dy: number): 'parry' | 'throw' {
  return dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.1 ? 'parry' : 'throw';
}

/** Flick speed in pixels per millisecond to a power multiplier, 0.85 (slow) to 1.15 (fast). */
export function flickPower(pxPerMs: number): number {
  const k = Math.max(0, Math.min(1, (pxPerMs - 0.4) / 1.6));
  return Math.round((0.85 + 0.3 * k) * 100) / 100;
}

/**
 * The target a flick points at: whichever is closest in angle to the flick's
 * direction, measured from your beast. Ties go to the nearer one. Returns -1
 * when there's nothing to aim at.
 */
export function aimTarget(from: { x: number; y: number }, dir: { x: number; y: number }, targets: { x: number; y: number }[]): number {
  const da = Math.atan2(dir.y, dir.x);
  let best = -1, bestA = Infinity, bestD = Infinity;
  targets.forEach((t, i) => {
    const a = Math.atan2(t.y - from.y, t.x - from.x);
    let diff = Math.abs(a - da); if (diff > Math.PI) diff = 2 * Math.PI - diff;
    const d = Math.hypot(t.x - from.x, t.y - from.y);
    if (diff < bestA - 1e-6 || (Math.abs(diff - bestA) < 1e-6 && d < bestD)) { best = i; bestA = diff; bestD = d; }
  });
  return best;
}

/** Bodies that attack from range by throwing their element at you. */
const RANGED: BodyType[] = ['wisp', 'avian', 'drake'];
export const isRanged = (body: BodyType) => RANGED.includes(body);

/** Enemy shots: how long they fly, and how much shorter their wind-up is than a melee attack's. */
export const ENEMY_SHOT = { flight: 0.9, windup: 0.7 };
/** Too late to shoot down a shot that lands within this many seconds; parry it instead. */
export const SHOOT_DOWN_MIN = 0.22;
/** Energy for shooting an enemy shot out of the air. */
export const SHOOT_DOWN_GAIN = 15;

/** Seconds a throw of this power takes to reach its target. */
export const flightTime = (power: number) => 0.3 / Math.max(0.5, power);

/** What each element's shot looks like. */
export type ShotShape = 'orb' | 'spear' | 'shard' | 'rock' | 'crescent' | 'lance';
export const SHOT_SHAPE: Record<ElementKey, ShotShape> = {
  pyre: 'orb', tide: 'orb', storm: 'orb', umbral: 'orb',
  thorn: 'spear', frost: 'shard', stone: 'rock', gale: 'crescent', radiant: 'lance',
};
