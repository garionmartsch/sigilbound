/*
 * The tutorial's step order. Pure data and functions, no page access, so it
 * can be tested on its own. The steps themselves live in src/tutorial.ts.
 *
 *   intro          welcome card: start training or skip
 *   b-*            lessons inside the training fight
 *   m-*            guided tour of the menus
 *   done           finished or skipped
 */

/** Lessons inside the training fight, in order. */
export const BATTLE_STEPS = ['b-tap', 'b-slash', 'b-special', 'b-parry', 'b-swap', 'b-matchup', 'b-finish'] as const;
/** Menu tour steps, in order. */
export const MENU_STEPS = ['m-summon', 'm-enhance', 'm-evolve', 'm-ready'] as const;

export type StepId = 'intro' | (typeof BATTLE_STEPS)[number] | (typeof MENU_STEPS)[number] | 'done';

export const STEP_ORDER: StepId[] = ['intro', ...BATTLE_STEPS, ...MENU_STEPS, 'done'];

/** How many times a lesson asks for its move before moving on. */
export const REPS: Partial<Record<StepId, number>> = { 'b-tap': 3, 'b-slash': 2 };

export const isBattleStep = (id: string): boolean => (BATTLE_STEPS as readonly string[]).includes(id);
export const isMenuStep = (id: string): boolean => (MENU_STEPS as readonly string[]).includes(id);

/** The step after this one; stays on 'done' at the end. */
export function nextStep(id: StepId): StepId {
  const i = STEP_ORDER.indexOf(id);
  return STEP_ORDER[Math.min(i + 1, STEP_ORDER.length - 1)];
}

/**
 * Where to pick up after the game restarts. A fight can't be resumed, so any
 * training lesson starts again from the welcome card; menu steps carry on.
 */
export function resumeStep(id: string): StepId {
  if (!(STEP_ORDER as string[]).includes(id)) return 'intro';
  if (isBattleStep(id)) return 'intro';
  return id as StepId;
}

/** "Training · 3 of 7" or "Tutorial · 2 of 4" for the coach's eyebrow line. */
export function stepLabel(id: StepId): string {
  const b = (BATTLE_STEPS as readonly string[]).indexOf(id);
  if (b >= 0) return `Training · ${b + 1} of ${BATTLE_STEPS.length}`;
  const m = (MENU_STEPS as readonly string[]).indexOf(id);
  if (m >= 0) return `Tutorial · ${m + 1} of ${MENU_STEPS.length}`;
  return 'Tutorial';
}
