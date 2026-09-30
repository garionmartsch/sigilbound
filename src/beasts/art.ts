/**
 * Beasts that have image art, and which forms (0 base, 1 evolved, 2 final).
 * Files live in public/art/<key>_<form>.webp. A beast or form missing here
 * is drawn in code instead.
 */
export const ART_FILES: Record<string, number[]> = {
  cindermaw: [0, 1, 2],
};
