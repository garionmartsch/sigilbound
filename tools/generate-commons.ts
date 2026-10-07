/**
 * Generates common beasts from element themes, body types and add-on parts,
 * and writes them to src/beasts/generated.ts.
 *
 *   npx tsx tools/generate-commons.ts            # default counts
 *   npx tsx tools/generate-commons.ts 20         # 20 per wheel element (Radiant/Umbral get a third)
 *
 * The output is deterministic: the same count always produces the same
 * beasts, and raising the count only appends new ones (keys are
 * <element>_c<number>), so existing players' cards keep working.
 * Generated beasts can be hand-edited after generation; copy one into
 * core.ts if you want to keep your edits safe from regeneration.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CORE } from '../src/beasts/core';
import type { BodyType, ElementKey, PatternStyle, Species, TailStyle, WingStyle } from '../src/types';

const PER_WHEEL_ELEMENT = Number(process.argv[2]) || 4;
const PER_SPECIAL_ELEMENT = Math.max(2, Math.round(PER_WHEEL_ELEMENT / 2));

/** Small seeded random generator so output never changes between runs. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s: string) => [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);

interface Theme {
  prefixes: string[];
  bodies: BodyType[];
  /** [main, highlight, eye] color sets. */
  palettes: [string, string, string][];
  specials: string[];
  tails: TailStyle[];
  adjective: string;
}

const THEMES: Record<ElementKey, Theme> = {
  pyre: { prefixes: ['Ember', 'Ash', 'Scorch', 'Blaze', 'Char', 'Flare', 'Soot', 'Cinder', 'Kiln', 'Singe', 'Smolder', 'Brand'],
    bodies: ['beast', 'brute', 'avian', 'drake', 'wisp', 'golem'],
    palettes: [['#C8472A', '#F4A24A', '#FFE7A3'], ['#B23A26', '#FFC15E', '#FFF4C8'], ['#8E2F1E', '#FF8A3D', '#FFD27A'], ['#D0602E', '#FFD36B', '#FFF8E6']],
    specials: ['Flame Burst', 'Ember Spit', 'Heat Wave', 'Char Bite', 'Blaze Rush', 'Cinder Shot'], tails: ['flame', 'spike'], adjective: 'fiery' },
  tide: { prefixes: ['Brine', 'Ripple', 'Kelp', 'Surf', 'Shoal', 'Silt', 'Wake', 'Drizzle', 'Spray', 'Eddy', 'Lagoon', 'Current'],
    bodies: ['serpent', 'beast', 'avian', 'wisp', 'golem', 'brute'],
    palettes: [['#2A6FA3', '#7FD0F0', '#E8FBFF'], ['#1F5E8C', '#8FE0D0', '#E6FFFA'], ['#2E7D8C', '#A8E8F5', '#FFFFFF'], ['#245C7E', '#6FC3D9', '#DFF8FF']],
    specials: ['Water Jet', 'Bubble Burst', 'Undertow Grab', 'Splash Slam', 'Rain Dance', 'Tidal Nip'], tails: ['fin', 'leaf'], adjective: 'aquatic' },
  thorn: { prefixes: ['Moss', 'Thistle', 'Fern', 'Bark', 'Vine', 'Sprout', 'Nettle', 'Burr', 'Root', 'Clover', 'Bramble', 'Sap'],
    bodies: ['beast', 'brute', 'golem', 'avian', 'serpent', 'wisp'],
    palettes: [['#4F7A3A', '#A7D46F', '#F6F1B0'], ['#5C8A3C', '#D6E88A', '#FFF6B0'], ['#3F6E4A', '#9FDB8A', '#E9FFD8'], ['#6B7A2E', '#C6E36A', '#FFF3A8']],
    specials: ['Vine Whip', 'Thorn Volley', 'Spore Puff', 'Root Snare', 'Leaf Blade', 'Sap Shot'], tails: ['leaf', 'spike'], adjective: 'leafy' },
  frost: { prefixes: ['Rime', 'Sleet', 'Hail', 'Chill', 'Snow', 'Icicle', 'Tundra', 'Floe', 'Glint', 'Frostbit', 'Drift', 'Crystal'],
    bodies: ['beast', 'golem', 'avian', 'wisp', 'brute', 'serpent'],
    palettes: [['#5E9FC0', '#CFF1FF', '#EFFFFF'], ['#A9C8DE', '#FFFFFF', '#BFEFFF'], ['#4F8FB8', '#D8F4FF', '#F2FEFF'], ['#7FA8C8', '#E6FAFF', '#FFFFFF']],
    specials: ['Ice Shard', 'Frost Breath', 'Hail Bash', 'Snow Flurry', 'Cold Snap', 'Icicle Drop'], tails: ['spike', 'fin'], adjective: 'icy' },
  storm: { prefixes: ['Volt', 'Spark', 'Static', 'Arc', 'Bolt', 'Zap', 'Squall', 'Flash', 'Surge', 'Crackle', 'Jolt', 'Ion'],
    bodies: ['avian', 'beast', 'wisp', 'drake', 'brute', 'serpent'],
    palettes: [['#C9A21E', '#FFF08A', '#FFFFFF'], ['#5A4A8C', '#F2DC5D', '#FFF6C2'], ['#E0B52E', '#FFF6B8', '#FFFFFF'], ['#3E3A7A', '#E8D04A', '#FFF6C2']],
    specials: ['Thunder Jolt', 'Spark Bite', 'Static Shock', 'Arc Flash', 'Bolt Rush', 'Charge Beam'], tails: ['spike', 'flame'], adjective: 'crackling' },
  stone: { prefixes: ['Pebble', 'Slate', 'Flint', 'Boulder', 'Crag', 'Gravel', 'Shale', 'Grit', 'Cobble', 'Mica', 'Granite', 'Quarry'],
    bodies: ['golem', 'brute', 'beast', 'avian', 'drake', 'serpent'],
    palettes: [['#7A6246', '#C9AE86', '#FFB35C'], ['#6B5A48', '#B8A07E', '#FFD28A'], ['#8A7A64', '#D8C8A8', '#FFD28A'], ['#5E5A56', '#B0A89C', '#FFB35C']],
    specials: ['Rock Throw', 'Stone Bash', 'Pebble Storm', 'Quake Stomp', 'Slate Slam', 'Grit Blast'], tails: ['spike', 'leaf'], adjective: 'rocky' },
  gale: { prefixes: ['Breeze', 'Gust', 'Whirl', 'Sky', 'Cloud', 'Flurry', 'Updraft', 'Airy', 'Zephyr', 'Swirl', 'Draft', 'Puff'],
    bodies: ['avian', 'beast', 'wisp', 'serpent', 'drake', 'brute'],
    palettes: [['#5FA88A', '#DFF7EA', '#FFFFFF'], ['#6AB89A', '#E6FFF2', '#FFFFFF'], ['#4E9A7E', '#C8F0DC', '#F4FFF9'], ['#7DBFA8', '#F0FFF8', '#FFFFFF']],
    specials: ['Air Slash', 'Gust Push', 'Wind Spiral', 'Feather Storm', 'Updraft Strike', 'Breeze Blade'], tails: ['leaf', 'fin'], adjective: 'breezy' },
  radiant: { prefixes: ['Glim', 'Dawn', 'Shine', 'Glow', 'Gleam', 'Beam', 'Lumi', 'Halo', 'Sol', 'Bright', 'Aura', 'Morning'],
    bodies: ['avian', 'beast', 'wisp', 'golem', 'serpent', 'brute'],
    palettes: [['#E0B84E', '#FFF8DD', '#FFFFFF'], ['#D9B45A', '#FFF3C4', '#FFFFFF'], ['#F0C04A', '#FFF6D0', '#FFFFFF'], ['#E8C45A', '#FFFFFF', '#FFF8DD']],
    specials: ['Light Beam', 'Shining Ray', 'Glow Burst', 'Dawn Flash', 'Halo Ring', 'Bright Strike'], tails: ['flame', 'leaf'], adjective: 'glowing' },
  umbral: { prefixes: ['Dusk', 'Gloom', 'Shade', 'Murk', 'Nox', 'Hush', 'Vesper', 'Void', 'Grim', 'Hollow', 'Mire', 'Twilight'],
    bodies: ['wisp', 'beast', 'avian', 'drake', 'golem', 'serpent'],
    palettes: [['#3A2560', '#9A6BD6', '#E6D6FF'], ['#2A1C44', '#8C5AD8', '#D9B8FF'], ['#3A2A5E', '#A07AE0', '#E6D6FF'], ['#241A38', '#9A6BD6', '#F2E6FF']],
    specials: ['Shadow Bite', 'Dark Pulse', 'Gloom Claw', 'Night Shade', 'Void Nip', 'Dusk Strike'], tails: ['spike', 'leaf'], adjective: 'shadowy' },
};

/** Name endings for the base, evolved and final form of each body type. */
const SUFFIXES: Record<BodyType, [string, string, string][]> = {
  brute: [['maw', 'jaw', 'crusher'], ['grub', 'brute', 'titan'], ['tusk', 'tusker', 'mammoth'], ['imp', 'fiend', 'overlord']],
  beast: [['pup', 'hound', 'warg'], ['cub', 'cat', 'lion'], ['kit', 'fox', 'vixen'], ['fawn', 'stag', 'hart']],
  avian: [['chick', 'finch', 'roc'], ['fledge', 'hawk', 'harrier'], ['owlet', 'owl', 'strix'], ['wren', 'lark', 'phoenix']],
  serpent: [['eel', 'coil', 'wyrm'], ['fry', 'fin', 'leviathan'], ['worm', 'snake', 'naga'], ['newt', 'salamander', 'basilisk']],
  wisp: [['mote', 'wisp', 'wraith'], ['puff', 'spark', 'flare'], ['ling', 'spirit', 'phantom'], ['blot', 'shade', 'specter']],
  golem: [['pebble', 'guard', 'colossus'], ['lump', 'block', 'bastion'], ['husk', 'shell', 'fortress'], ['nub', 'ward', 'monolith']],
  drake: [['let', 'drake', 'dragon'], ['scale', 'wyvern', 'wyrmlord'], ['claw', 'talon', 'tyrant'], ['kin', 'wing', 'sovereign']],
};

const BODY_LOOK: Record<BodyType, string> = {
  brute: 'stocky, muscular brawler with clawed arms and a snarling jaw',
  beast: 'lean four-legged predator with pointed ears and a prowling stance',
  avian: 'sleek bird of prey with spread wings, a crest and a hooked beak',
  serpent: 'coiled serpent with fin-shaped frills and a striking pose',
  wisp: 'floating spirit with a teardrop body and one piercing eye',
  golem: 'blocky, weathered golem with heavy fists and a glowing core',
  drake: 'young dragon with swept horns and leathery wings',
};

/** Stat leanings per body: [hp, atk, spd] multipliers. */
const BODY_STATS: Record<BodyType, [number, number, number]> = {
  brute: [1.08, 1.0, 0.95], beast: [0.95, 1.05, 1.15], avian: [0.88, 1.08, 1.2], serpent: [1.0, 1.02, 1.05],
  wisp: [0.85, 1.12, 1.15], golem: [1.18, 0.85, 0.88], drake: [1.0, 1.06, 1.0],
};

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const hex = (n: number) => n.toString(16).padStart(2, '0');
/** Nudge a color's brightness a little so beasts sharing a palette still differ. */
function jitter(c: string, r: () => number) {
  const k = 0.88 + r() * 0.24;
  const v = [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * k)));
  return '#' + v.map(hex).join('').toUpperCase();
}

export function generateCommons(perWheel = PER_WHEEL_ELEMENT, perSpecial = PER_SPECIAL_ELEMENT): Record<string, Species> {
  const out: Record<string, Species> = {};
  // Never reuse a name from the hand-designed beasts.
  const usedNames = new Set<string>(Object.values(CORE).flatMap(b => b.forms));
  for (const el of Object.keys(THEMES) as ElementKey[]) {
    const th = THEMES[el];
    const usedPrefixes = new Set<string>();
    const count = el === 'radiant' || el === 'umbral' ? perSpecial : perWheel;
    for (let i = 1; i <= count; i++) {
      const key = `${el}_c${String(i).padStart(2, '0')}`;
      const r = rng(hashStr(key));
      const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
      const body = th.bodies[(i - 1) % th.bodies.length];
      let forms: [string, string, string] = ['', '', ''];
      for (let tries = 0; tries < 50; tries++) {
        const fresh = th.prefixes.filter(x => !usedPrefixes.has(x));
        const pre = pick(fresh.length ? fresh : th.prefixes), suf = pick(SUFFIXES[body]);
        forms = [pre + suf[0], pre + suf[1], pre + suf[2]].map(cap) as [string, string, string];
        const awkward = forms.some(f => /(.)\1\1/i.test(f)); // e.g. "Squalllark"
        if (!awkward && forms.every(f => !usedNames.has(f))) { usedPrefixes.add(pre); break; }
      }
      forms.forEach(f => usedNames.add(f));
      const [c1, c2, eye] = pick(th.palettes);
      const [mh, ma, ms] = BODY_STATS[body];
      const sp: Species = {
        name: forms[0], el, rarity: 'common', body,
        c1: jitter(c1, r), c2: jitter(c2, r), eye,
        hp: Math.round(120 * mh * (0.94 + r() * 0.12)),
        atk: Math.round(14 * ma * (0.94 + r() * 0.12)),
        spd: Math.round(ms * (0.95 + r() * 0.1) * 100) / 100,
        special: pick(th.specials),
        forms,
        generated: true,
      };
      const parts: string[] = [];
      if (r() < 0.45) { sp.tail = pick(th.tails); parts.push(`a ${sp.tail}-tipped tail`); }
      if (r() < 0.4) { sp.pattern = pick<PatternStyle>(['stripes', 'spots', 'runes']); parts.push(`${sp.pattern === 'runes' ? 'faint glowing rune' : sp.pattern} markings`); }
      if (body !== 'avian' && body !== 'drake' && r() < 0.2) { sp.wings = pick<WingStyle>(['bat', 'feather']); parts.push(`small ${sp.wings} wings`); }
      if (body === 'brute' || body === 'beast' || body === 'drake') sp.horns = body === 'beast' ? (r() < 0.4 ? 2 : 0) : 2;
      if (body === 'wisp') sp.eyes = 1;
      if (body === 'brute' && r() < 0.35) sp.spikes = true;
      sp.look = `${/^[aeiou]/i.test(th.adjective) ? 'An' : 'A'} ${th.adjective} ${BODY_LOOK[body]}${parts.length ? `, with ${parts.join(' and ')}` : ''}. ${cap(el)} element common beast.`;
      sp.evoLooks = [
        'Bigger and sturdier, with more pronounced features and a stronger elemental glow.',
        'A mature, imposing version with dramatic elemental effects around it and gold rune symbols orbiting it.',
      ];
      out[key] = sp;
    }
  }
  return out;
}

// Write the file when run directly.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const beasts = generateCommons();
  const body = Object.entries(beasts).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n');
  const file = `// Generated by tools/generate-commons.ts. Edit the generator, not this file,\n// or move a beast into core.ts to customize it.\nimport type { Species } from '../types';\n\nexport const GENERATED: Record<string, Species> = {\n${body}\n};\n`;
  const target = new URL('../src/beasts/generated.ts', import.meta.url);
  writeFileSync(target, file);
  console.log(`Wrote ${Object.keys(beasts).length} common beasts to src/beasts/generated.ts`);
}
