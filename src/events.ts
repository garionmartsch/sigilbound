import type { RarityKey } from './types';

/**
 * A tiny event bus. Game code announces what the player just did, and the
 * tutorial listens, so the tutorial never has to reach into game internals.
 */
export type GameEvent =
  | 'tap' | 'slash' | 'special'   // player attacks that landed
  | 'parry' | 'hurt'              // enemy strike was parried, or hit the player
  | 'swap'                        // data: new active slot index
  | 'trainingDone'                // player closed the training results
  | 'screen'                      // data: screen name
  | 'summoned'                    // summon reveal finished; data: { key, rar }
  | 'fused' | 'evolved'           // forge animation finished
  | 'fight'                       // player pressed the Campaign button
  | 'skipTutorial';               // player skipped from the training fight

type Listener = (ev: GameEvent, data?: unknown) => void;
const listeners = new Set<Listener>();

export function emit(ev: GameEvent, data?: unknown) {
  listeners.forEach(fn => { try { fn(ev, data); } catch (e) { console.error(e); } });
}
export function on(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Switches the tutorial flips to shape the game while it runs. */
export const hooks = {
  /** Force the rarity of the next Rift Summon (the tutorial's guaranteed Rare). */
  summonRarity: null as RarityKey | null,
};
