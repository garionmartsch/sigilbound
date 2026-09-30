import type { ElementKey } from './types';

/*
 * Status effects. Each element leaves its own mark on whatever it hits:
 *
 *   Pyre    Burn    damage over time
 *   Tide    Soak    attacks 30% slower
 *   Thorn   Poison  stacking damage over time (up to 3 stacks)
 *   Frost   Chill   3 stacks, or any stack on a Soaked target, becomes Freeze
 *   Storm   Shock   bonus damage and a chance to break a wind-up; doubled on Soaked targets
 *   Stone   Sunder  takes 20% more damage
 *   Gale    Daze    the next attack has a 50% chance to miss
 *   Radiant Bless   heals and cleanses the caster's side (handled by the battle)
 *   Umbral  Curse   deals 25% less damage, and its attackers heal 20% of the damage they deal
 *
 * This file holds the rules only, so they can be tested without a battle.
 */

export interface StatusState {
  burn?: { t: number; dps: number };
  poison?: { t: number; stacks: number; dps: number };
  soak?: { t: number };
  chill?: { t: number; stacks: number };
  freeze?: { t: number };
  sunder?: { t: number };
  daze?: { t: number };
  curse?: { t: number };
}
export type StatusKey = keyof StatusState;

/** Tuning numbers for every effect, in one place. */
export const STATUS = {
  burn: { dur: 4, dpsPerAtk: 0.25 },
  poison: { dur: 6, maxStacks: 3, dpsPerAtkPerStack: 0.12 },
  soak: { dur: 5, slow: 1.3 },
  chill: { dur: 5, stacksToFreeze: 3 },
  freeze: { durOnEnemy: 2, durOnPlayer: 1.5, damageTaken: 1.2 },
  shock: { dmgPerAtk: 0.3, soakedMult: 2, interruptChance: 0.4 },
  sunder: { dur: 6, damageTaken: 1.2 },
  daze: { dur: 6, missChance: 0.5 },
  curse: { dur: 6, damageDealt: 0.75, drain: 0.2 },
  bless: { healSpecial: 0.15, healHit: 0.06 },
  /** Chance a normal hit applies its effect; specials always do. */
  hitChance: { player: 0.3, enemy: 0.3, boss: 0.45 },
} as const;

/** Short label and element color for each effect's chip. */
export const STATUS_INFO: Record<StatusKey, { label: string; el: ElementKey }> = {
  burn: { label: 'Burn', el: 'pyre' },
  poison: { label: 'Poison', el: 'thorn' },
  soak: { label: 'Soak', el: 'tide' },
  chill: { label: 'Chill', el: 'frost' },
  freeze: { label: 'Frozen', el: 'frost' },
  sunder: { label: 'Sunder', el: 'stone' },
  daze: { label: 'Daze', el: 'gale' },
  curse: { label: 'Curse', el: 'umbral' },
};

/** What happened when an element hit a target, for the battle to show and act on. */
export interface ApplyResult {
  /** Floating text to show, e.g. "Burned" or "Frozen!". */
  label: string | null;
  /** Extra instant damage (Shock). */
  bonusDamage: number;
  /** Chance to break the target's wind-up (Shock). */
  interruptChance: number;
  /** Radiant: heal the attacker's side by this fraction of max HP. */
  heal: number;
  /** The target just froze. */
  froze: boolean;
}

/**
 * Apply an element's effect to a target.
 * @param atk the attacker's attack stat, which scales damage-over-time and Shock
 * @param special specials hit harder: stronger Shock, a sure interrupt, a bigger heal
 * @param onEnemy whether the target is the enemy (freeze lasts longer on enemies)
 */
export function applyStatus(st: StatusState, el: ElementKey, atk: number, special: boolean, onEnemy: boolean): ApplyResult {
  const res: ApplyResult = { label: null, bonusDamage: 0, interruptChance: 0, heal: 0, froze: false };
  switch (el) {
    case 'pyre':
      st.burn = { t: STATUS.burn.dur, dps: atk * STATUS.burn.dpsPerAtk };
      res.label = 'Burned';
      break;
    case 'thorn': {
      const stacks = Math.min(STATUS.poison.maxStacks, (st.poison?.stacks ?? 0) + (special ? 2 : 1));
      st.poison = { t: STATUS.poison.dur, stacks, dps: atk * STATUS.poison.dpsPerAtkPerStack * stacks };
      res.label = stacks > 1 ? `Poison x${stacks}` : 'Poisoned';
      break;
    }
    case 'tide':
      st.soak = { t: STATUS.soak.dur };
      res.label = 'Soaked';
      break;
    case 'frost': {
      const stacks = (st.chill?.stacks ?? 0) + (special ? 2 : 1);
      if (st.soak || stacks >= STATUS.chill.stacksToFreeze) {
        st.freeze = { t: onEnemy ? STATUS.freeze.durOnEnemy : STATUS.freeze.durOnPlayer };
        delete st.chill; delete st.soak;
        res.label = 'Frozen!'; res.froze = true;
      } else {
        st.chill = { t: STATUS.chill.dur, stacks };
        res.label = `Chill x${stacks}`;
      }
      break;
    }
    case 'storm': {
      const soaked = !!st.soak;
      res.bonusDamage = Math.round(atk * STATUS.shock.dmgPerAtk * (special ? 2 : 1) * (soaked ? STATUS.shock.soakedMult : 1));
      res.interruptChance = special ? 1 : STATUS.shock.interruptChance;
      if (soaked) delete st.soak;
      res.label = soaked ? 'Conducted! x2' : 'Shocked';
      break;
    }
    case 'stone':
      st.sunder = { t: STATUS.sunder.dur };
      res.label = 'Sundered';
      break;
    case 'gale':
      st.daze = { t: STATUS.daze.dur };
      res.label = 'Dazed';
      break;
    case 'umbral':
      st.curse = { t: STATUS.curse.dur };
      res.label = 'Cursed';
      break;
    case 'radiant':
      res.heal = special ? STATUS.bless.healSpecial : STATUS.bless.healHit;
      res.label = 'Blessed';
      break;
  }
  return res;
}

/** Remove every effect (Radiant's cleanse). */
export function cleanse(st: StatusState) {
  for (const k of Object.keys(st) as StatusKey[]) delete st[k];
}

/** Count effects down; returns damage-over-time dealt during dt. */
export function tickStatus(st: StatusState, dt: number): number {
  let dot = 0;
  if (st.burn) dot += st.burn.dps * Math.min(dt, st.burn.t);
  if (st.poison) dot += st.poison.dps * Math.min(dt, st.poison.t);
  for (const k of Object.keys(st) as StatusKey[]) {
    const e = st[k];
    if (e && (e.t -= dt) <= 0) delete st[k];
  }
  return dot;
}

/** Damage multiplier for hits taken by a target with these effects. */
export const damageTakenMult = (st: StatusState) =>
  (st.sunder ? STATUS.sunder.damageTaken : 1) * (st.freeze ? STATUS.freeze.damageTaken : 1);

/** Damage multiplier for hits dealt by an attacker with these effects. */
export const damageDealtMult = (st: StatusState) => (st.curse ? STATUS.curse.damageDealt : 1);

/** How fast timers run for someone with these effects: 0 when frozen, slower when soaked. */
export const tempo = (st: StatusState) => (st.freeze ? 0 : st.soak ? 1 / STATUS.soak.slow : 1);

/** Fraction of damage an attacker heals when hitting a target with these effects. */
export const drainFrom = (st: StatusState) => (st.curse ? STATUS.curse.drain : 0);

/** Roll a Daze miss for an attacker; a miss uses up the Daze. */
export function rollDazeMiss(st: StatusState, r = Math.random()): boolean {
  if (!st.daze) return false;
  delete st.daze;
  return r < STATUS.daze.missChance;
}

/** Active effects with seconds left, for the status chips. */
export function statusList(st: StatusState): { key: StatusKey; t: number; stacks?: number }[] {
  return (Object.keys(st) as StatusKey[]).map(key => {
    const e = st[key] as { t: number; stacks?: number };
    return { key, t: e.t, stacks: e.stacks };
  });
}

/** One-line description of each element's effect, for the element chart. */
export const EFFECT_TEXT: Record<ElementKey, string> = {
  pyre: 'Burn: damage over time',
  tide: 'Soak: attacks 30% slower',
  thorn: 'Poison: stacking damage over time',
  frost: 'Chill: 3 stacks, or Soak, freezes',
  storm: 'Shock: bonus damage, breaks wind-ups, x2 on Soak',
  stone: 'Sunder: takes 20% more damage',
  gale: 'Daze: next attack may miss',
  radiant: 'Bless: heals and cleanses your side',
  umbral: 'Curse: hits weaker; attackers drain HP',
};
