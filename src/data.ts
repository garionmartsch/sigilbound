import { ALL_BEASTS } from './beasts';
import type { Card, ElementInfo, ElementKey, RarityInfo, RarityKey, Species } from './types';
/** Soul shards per Rift Summon. */
export const COST=100;

/* ---------- data ---------- */
export const ELEM: Record<ElementKey, ElementInfo> = {
  pyre:{name:'Pyre',color:'#E4683A',beats:['thorn','frost']},
  tide:{name:'Tide',color:'#3E9ED6',beats:['pyre','gale']},
  thorn:{name:'Thorn',color:'#7DB85B',beats:['tide','stone']},
  frost:{name:'Frost',color:'#8FD3E8',beats:['gale','stone']},
  storm:{name:'Storm',color:'#E8D04A',beats:['tide','frost']},
  stone:{name:'Stone',color:'#B08D62',beats:['pyre','storm']},
  gale:{name:'Gale',color:'#9FDCC0',beats:['thorn','storm']},
  radiant:{name:'Radiant',color:'#FFE08A',beats:['umbral']},
  umbral:{name:'Umbral',color:'#A87BE8',beats:['radiant']},
};
export const ELEM_ORDER=Object.keys(ELEM) as ElementKey[];
/** Damage multiplier when element a hits element d. */
export const elemMult=(a: ElementKey,d: ElementKey)=>ELEM[a].beats.includes(d)?1.5:(ELEM[d].beats.includes(a)?0.7:1);
export const RARITY: Record<RarityKey, RarityInfo> = {
  common:   { w: 64,  call: 90, label: 'Common',    color: '#B9ACC8', stars: 1, cap: 20, feed: 200,  sell: 60,   evo: 600 },
  rare:     { w: 26,  call: 10, label: 'Rare',      color: '#7CC0EE', stars: 2, cap: 25, feed: 450,  sell: 180,  evo: 1500 },
  epic:     { w: 8,   call: 0,  label: 'Epic',      color: '#E7BE6E', stars: 3, cap: 30, feed: 1000, sell: 600,  evo: 4000 },
  legendary:{ w: 1.7, call: 0,  label: 'Legendary', color: '#FF9A5A', stars: 4, cap: 35, feed: 2200, sell: 1500, evo: 9000 },
  mythic:   { w: 0.3, call: 0,  label: 'Mythic',    color: '#F28CFF', stars: 5, cap: 40, feed: 4000, sell: 4000, evo: 20000 },
};
/** Rarities from most to least common. */
export const RARITY_ORDER: RarityKey[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

/** Every beast, keyed by a permanent id. See src/beasts/. */
export const SPECIES: Record<string, Species> = ALL_BEASTS;

/** Beasts players can own. Boss-only wardens are left out of summons, drops and rewards. */
export const collectible = (k: string) => !!SPECIES[k] && !SPECIES[k].bossOnly;
export const COLLECTIBLE_KEYS = Object.keys(SPECIES).filter(collectible);

/** Names of each beast's three forms: base, evolved, final. */
export const FORMS: Record<string, [string, string, string]> =
  Object.fromEntries(Object.entries(SPECIES).map(([k, sp]) => [k, sp.forms]));
export const EVO_LABEL=['Base form','Evolved','Final form'];
export const MAX_EVO=2, MAX_SKILL=5, BOX=60, CALL_COST=300;
export const rarOf=(m: Card)=>RARITY[SPECIES[m.sp].rarity];
export const capOf=(m: Card)=>rarOf(m).cap+10*(m.evo||0);
export const nameOf=(m: Card)=>FORMS[m.sp][m.evo||0];
/** XP needed to go from level l to l+1. */
export const xpNext=(l: number)=>30+12*l;
/** Stat bonus carried over from earlier forms, so evolving never lowers stats. */
export function evoBonus(sp: string,evo: number){let b=0; const cap=RARITY[SPECIES[sp].rarity].cap; for(let j=0;j<evo;j++) b+=0.1*(cap+10*j-1); return b}
export function statK(sp: string,lvl: number,evo: number){return (1+0.1*(lvl-1)+evoBonus(sp,evo))*(1+0.1*evo)}
export const statsOf=(m: Card)=>{const sp=SPECIES[m.sp],k=statK(m.sp,m.lvl,m.evo||0);return {maxHp:Math.round(sp.hp*k),atk:+(sp.atk*k).toFixed(1)}};
/** XP a fodder card gives when fed to base; same element gives 1.5x. */
export const feedXp=(f: Card,base?: Card)=>Math.round(rarOf(f).feed*(1+0.25*(f.lvl-1))*(1+0.5*(f.evo||0))*(base&&SPECIES[f.sp].el===SPECIES[base.sp].el?1.5:1));
export const sellOf=(m: Card)=>Math.round(rarOf(m).sell*(1+0.2*(m.lvl-1))*(1+(m.evo||0)));
export const evoCost=(m: Card)=>rarOf(m).evo*((m.evo||0)+1);
export const fuseCost=(m: Card,n: number)=>n*(20*m.lvl+30);
/** Add XP to a card, levelling it up to its cap. Returns levels gained. */
export function addXp(m: Card,xp: number){const cap=capOf(m),from=m.lvl; m.xp=(m.xp||0)+xp; while(m.lvl<cap&&m.xp>=xpNext(m.lvl)){m.xp-=xpNext(m.lvl);m.lvl++} if(m.lvl>=cap){m.lvl=cap;m.xp=0} return m.lvl-from}
/** Preview of addXp without changing the card. */
export function simXp(m: Card,xp: number){const c=Object.assign({},m); addXp(c,xp); return c}

/**
 * Choose a summon's rarity from the published rates.
 * @param r a roll from 0 up to 100
 * @param force skip the roll and use this rarity (the tutorial's guaranteed Rare)
 */
export function pickRarity(kind: 'rift' | 'call', r: number, force?: RarityKey | null): RarityKey {
  if (force) return force;
  for (const k of [...RARITY_ORDER].reverse()) {
    const w = kind === 'rift' ? RARITY[k].w : RARITY[k].call;
    if (r < w) return k;
    r -= w;
  }
  return 'common';
}
