import type { Species } from '../types';
import { CORE } from './core';
import { GENERATED } from './generated';
import { WARDENS } from './wardens';

/** Every beast in the game: hand-designed first, then generated commons, then boss-only wardens. */
export const ALL_BEASTS: Record<string, Species> = { ...CORE, ...GENERATED, ...WARDENS };
