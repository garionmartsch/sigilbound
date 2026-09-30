/*
 * Color themes. Each theme is a set of named colors that the stylesheet reads
 * as CSS variables (--bg, --gold and so on), plus the colors of the battle
 * arena, which is drawn on a canvas. Pure data and functions, so it can be
 * tested; applying a theme to the page happens in src/settings.ts.
 *
 * Element and rarity colors are not part of a theme: they mean something in
 * the game, so they look the same everywhere.
 *
 * To add a theme, copy one below, give it a new id, and add it to THEMES.
 * The tests check that its text stays readable.
 */

export interface Theme {
  id: string;
  name: string;
  /** One line shown under the name in settings. */
  blurb: string;
  ui: {
    /** Page background, and the base of dark overlays. */
    bg: string;
    /** The soft glow at the top of the page. */
    glowTop: string;
    /** Panels, then raised buttons, then highlighted items. */
    stone: string; stone2: string; stone3: string;
    /** Wells: bar tracks, portrait frames, chests. */
    deep: string;
    /** Top of the card gradient. */
    cardTop: string;
    /** Tutorial coach panels. */
    coachTop: string; coachBot: string;
    line: string;
    text: string; muted: string; dim: string; soft: string;
    /** The accent: titles, stars, the active beast. Named gold for history. */
    gold: string; gold2: string; goldDeep: string; goldShadow: string;
    /** The main button's gradient, edge, and the text on it. */
    btnHi: string; btnLo: string; btnEdge: string; onGold: string;
  };
  arena: {
    skyTop: string; horizon: string; groundTop: string; groundBottom: string;
    /** Distant spires on the horizon. */
    spires: string;
    /** "r,g,b" for the horizon glow, the floor lines and the drifting embers. */
    glow: string; lines: string; embers: string;
  };
}

export const THEMES: Theme[] = [
  {
    id: 'sigil', name: 'Sigil Night', blurb: 'Violet dusk and gold. The original.',
    ui: {
      bg: '#110D18', glowTop: '#2A1C3A', stone: '#1C1626', stone2: '#271E34', stone3: '#33273F', deep: '#1A1422',
      cardTop: '#261D33', coachTop: '#2E2340', coachBot: '#221A30', line: '#3A2D4C',
      text: '#F0E8F5', muted: '#A898B9', dim: '#8A7A9A', soft: '#E8D9F0',
      gold: '#E7BE6E', gold2: '#B8893A', goldDeep: '#8C6A2E', goldShadow: '#5A3A14',
      btnHi: '#F1CE86', btnLo: '#C99A48', btnEdge: '#F4D594', onGold: '#24160A',
    },
    arena: { skyTop: '#1B1229', horizon: '#2A1B38', groundTop: '#1A1224', groundBottom: '#0E0914', spires: '#140D1D', glow: '231,150,90', lines: '231,190,110', embers: '255,170,90' },
  },
  {
    id: 'abyss', name: 'Abyssal Tide', blurb: 'Deep-sea blues with a cool cyan glow.',
    ui: {
      bg: '#0A1119', glowTop: '#12304A', stone: '#111C28', stone2: '#182636', stone3: '#203247', deep: '#0E1823',
      cardTop: '#172435', coachTop: '#1A3048', coachBot: '#13233A', line: '#2A3F57',
      text: '#E6F0F8', muted: '#8FA6BC', dim: '#6F8499', soft: '#D5E6F3',
      gold: '#7FD4E6', gold2: '#3E97AE', goldDeep: '#256577', goldShadow: '#0D3A48',
      btnHi: '#A6E6F2', btnLo: '#4FB0C6', btnEdge: '#C4F0F8', onGold: '#06212A',
    },
    arena: { skyTop: '#0C1A2A', horizon: '#15304A', groundTop: '#0D1A28', groundBottom: '#060D15', spires: '#0A1520', glow: '90,170,231', lines: '127,212,230', embers: '150,220,255' },
  },
  {
    id: 'grove', name: 'Verdant Grove', blurb: 'Moss and fern under a jade light.',
    ui: {
      bg: '#0C130D', glowTop: '#1C3320', stone: '#141E15', stone2: '#1C2A1D', stone3: '#253727', deep: '#111A12',
      cardTop: '#1A271B', coachTop: '#20361F', coachBot: '#172818', line: '#304532',
      text: '#EAF3E6', muted: '#9DB39A', dim: '#7A8E77', soft: '#DCEAD6',
      gold: '#A8D873', gold2: '#5E9A3A', goldDeep: '#3E6A26', goldShadow: '#1E3812',
      btnHi: '#C3E896', btnLo: '#78B450', btnEdge: '#D6F2B0', onGold: '#10200A',
    },
    arena: { skyTop: '#0F1D12', horizon: '#1C3322', groundTop: '#101C12', groundBottom: '#070D08', spires: '#0B150C', glow: '170,210,110', lines: '168,216,115', embers: '200,240,140' },
  },
  {
    id: 'ember', name: 'Ember Forge', blurb: 'Charcoal and coals, with a fiery orange.',
    ui: {
      bg: '#140C0A', glowTop: '#3A1A10', stone: '#1F1411', stone2: '#2B1B17', stone3: '#38231E', deep: '#1A110E',
      cardTop: '#2A1A15', coachTop: '#3A2018', coachBot: '#2A1712', line: '#4A2E27',
      text: '#F7ECE6', muted: '#BFA196', dim: '#947A70', soft: '#F0DDD3',
      gold: '#FF9A4D', gold2: '#C4602A', goldDeep: '#8A3D18', goldShadow: '#4A1A08',
      btnHi: '#FFB877', btnLo: '#E8783F', btnEdge: '#FFD0A4', onGold: '#2A0E02',
    },
    arena: { skyTop: '#22110C', horizon: '#3A1C12', groundTop: '#1E100C', groundBottom: '#0D0605', spires: '#170C09', glow: '240,110,50', lines: '255,154,77', embers: '255,150,70' },
  },
  {
    id: 'rose', name: 'Rose Dusk', blurb: 'Plum shadows and a soft rose glow.',
    ui: {
      bg: '#140C12', glowTop: '#3A1830', stone: '#1F141C', stone2: '#2B1C27', stone3: '#382433', deep: '#1A1017',
      cardTop: '#2A1A25', coachTop: '#3A2034', coachBot: '#2A1726', line: '#4A2F43',
      text: '#F8EAF2', muted: '#BD9DB0', dim: '#92788A', soft: '#F0DAE6',
      gold: '#F29BB8', gold2: '#B85A7C', goldDeep: '#7E3552', goldShadow: '#4A1428',
      btnHi: '#F7BCD0', btnLo: '#DE7FA3', btnEdge: '#FAD3E0', onGold: '#2A0816',
    },
    arena: { skyTop: '#20101C', horizon: '#3A1C32', groundTop: '#1C0F19', groundBottom: '#0C060A', spires: '#160B13', glow: '242,120,170', lines: '242,155,184', embers: '255,170,210' },
  },
  {
    id: 'eclipse', name: 'Eclipse', blurb: 'True black with violet. Saves battery on OLED screens.',
    ui: {
      bg: '#000000', glowTop: '#0C0A16', stone: '#0B0B0F', stone2: '#15151B', stone3: '#1E1E26', deep: '#08080B',
      cardTop: '#121218', coachTop: '#16161E', coachBot: '#0F0F15', line: '#2A2A33',
      text: '#ECECF2', muted: '#9A9AAB', dim: '#74748A', soft: '#DADAE4',
      gold: '#C9B6FF', gold2: '#7F68D6', goldDeep: '#4E3E96', goldShadow: '#20184A',
      btnHi: '#DCCFFF', btnLo: '#A28CF2', btnEdge: '#E8DEFF', onGold: '#120A30',
    },
    arena: { skyTop: '#06060A', horizon: '#101018', groundTop: '#07070B', groundBottom: '#000000', spires: '#040406', glow: '160,130,255', lines: '201,182,255', embers: '190,170,255' },
  },
  {
    id: 'contrast', name: 'High Contrast', blurb: 'Black, white and yellow, with strong outlines.',
    ui: {
      bg: '#000000', glowTop: '#000000', stone: '#0A0A0A', stone2: '#1A1A1A', stone3: '#2A2A2A', deep: '#050505',
      cardTop: '#141414', coachTop: '#1A1A1A', coachBot: '#111111', line: '#9A9A9A',
      text: '#FFFFFF', muted: '#E2E2E2', dim: '#C4C4C4', soft: '#FFFFFF',
      gold: '#FFD400', gold2: '#FFD400', goldDeep: '#B39500', goldShadow: '#000000',
      btnHi: '#FFE14D', btnLo: '#FFD400', btnEdge: '#FFFFFF', onGold: '#000000',
    },
    arena: { skyTop: '#0A0A0A', horizon: '#1C1C1C', groundTop: '#0E0E0E', groundBottom: '#000000', spires: '#000000', glow: '255,212,0', lines: '255,255,255', embers: '255,212,0' },
  },
];

export const DEFAULT_THEME = 'sigil';
export const THEME_IDS = THEMES.map(t => t.id);
export const themeById = (id: string): Theme => THEMES.find(t => t.id === id) ?? THEMES[0];

/* ---------- color math ---------- */
export function hexRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** WCAG contrast ratio between two hex colors, 1 to 21. */
export function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = hexRgb(h).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const kebab = (k: string) => k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());

/** The CSS variables for a theme, e.g. { '--bg': '#110D18', '--gold-rgb': '231 190 110', … }. */
export function cssVars(t: Theme): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(t.ui)) out['--' + kebab(k)] = v;
  out['--bg-rgb'] = hexRgb(t.ui.bg).join(' ');
  out['--gold-rgb'] = hexRgb(t.ui.gold).join(' ');
  return out;
}
