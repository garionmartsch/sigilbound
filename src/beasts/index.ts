import type { Species } from '../types';
import { CORE } from './core';
import { GENERATED } from './generated';

/** Every beast in the game: hand-designed first, then generated commons. */
export const ALL_BEASTS: Record<string, Species> = { ...CORE, ...GENERATED };
