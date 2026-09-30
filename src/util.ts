/** Find one element; throws if the markup is missing it, which catches typos early. */
export function $<T extends HTMLElement = HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el;
}
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string): T[] => [...document.querySelectorAll<T>(sel)];

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Ease-out cubic, clamped to 0..1. */
export const ease = (k: number) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
const hasWindow = typeof window !== 'undefined';
/** The player asked their device for reduced motion; screen shake is skipped. */
export const RM = hasWindow && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const DPR = hasWindow ? Math.min(2, window.devicePixelRatio || 1) : 1;

export type Ctx = CanvasRenderingContext2D;

/* ---------- color helpers ---------- */
export function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a), C = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (C[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
export const darker = (h: string, t: number) => mixHex(h, '#000000', t);
export const lighter = (h: string, t: number) => mixHex(h, '#ffffff', t);
export function rgba(h: string, a: number): string {
  const [r, g, b] = hexToRgb(h);
  return `rgba(${r},${g},${b},${a})`;
}
export function ell(c: Ctx, x: number, y: number, rx: number, ry: number) {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
}

/* ---------- canvas fit ---------- */
/** Match a canvas's backing store to its CSS size and device pixel ratio. */
export function fit(cv: HTMLCanvasElement): { c: Ctx; w: number; h: number } | null {
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return null;
  const W = Math.round(w * DPR), H = Math.round(h * DPR);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext('2d');
  if (!c) return null;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  return { c, w, h };
}

/** Shared animation clock in seconds, advanced by the main loop. */
export const clock = { t: 0 };
