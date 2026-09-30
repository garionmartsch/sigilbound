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
  common:{w:70,call:90,label:'Common',color:'#B9ACC8',stars:1,cap:20,feed:200,sell:60,evo:600},
  rare:{w:25,call:10,label:'Rare',color:'#7CC0EE',stars:2,cap:25,feed:450,sell:180,evo:1500},
  epic:{w:5,call:0,label:'Epic',color:'#E7BE6E',stars:3,cap:30,feed:1000,sell:600,evo:4000}};
export const SPECIES: Record<string, Species> = {
  cindermaw:{name:'Cindermaw',el:'pyre',rarity:'common',body:'brute',c1:'#C8472A',c2:'#F4A24A',eye:'#FFE7A3',hp:120,atk:14,spd:1.0,horns:2,special:'Magma Bite'},
  ashwing:{name:'Ashwing',el:'pyre',rarity:'rare',body:'wisp',c1:'#D9582A',c2:'#FFD36B',eye:'#FFF8E6',hp:98,atk:19,spd:1.2,eyes:1,special:'Cinder Storm'},
  vhal:{name:'Vhal the Kilnborn',el:'pyre',rarity:'epic',body:'brute',c1:'#8E1F2A',c2:'#FF7A3D',eye:'#FFF1B8',hp:150,atk:22,spd:1.0,horns:4,special:'Kilnheart Eruption'},
  brambleback:{name:'Brambleback',el:'thorn',rarity:'common',body:'brute',c1:'#4F7A3A',c2:'#A7D46F',eye:'#F6F1B0',hp:140,atk:12,spd:0.9,horns:0,spikes:true,special:'Briar Slam'},
  mosswraith:{name:'Mosswraith',el:'thorn',rarity:'rare',body:'wisp',c1:'#3F6E4A',c2:'#9FDB8A',eye:'#E9FFD8',hp:106,atk:17,spd:1.15,eyes:1,special:'Spore Veil'},
  ysra:{name:'Ysra of the Hedge',el:'thorn',rarity:'epic',body:'serpent',c1:'#2F5E36',c2:'#C6E36A',eye:'#FFF3A8',hp:145,atk:21,spd:1.1,crown:true,special:'Crown of Thorns'},
  tidecoil:{name:'Tidecoil',el:'tide',rarity:'common',body:'serpent',c1:'#2A6FA3',c2:'#7FD0F0',eye:'#E8FBFF',hp:118,atk:14,spd:1.05,special:'Undertow'},
  brinehound:{name:'Brinehound',el:'tide',rarity:'rare',body:'brute',c1:'#245C7E',c2:'#6FC3D9',eye:'#DFF8FF',hp:132,atk:17,spd:1.0,horns:0,fins:true,special:'Riptide Maul'},
  mawdeep:{name:'Mawdeep',el:'tide',rarity:'epic',body:'wisp',c1:'#1B3F73',c2:'#5FB4F0',eye:'#F0FAFF',hp:135,atk:23,spd:1.1,eyes:3,special:'Abyssal Call'},
  shardling:{name:'Shardling',el:'frost',rarity:'common',body:'golem',c1:'#5E9FC0',c2:'#CFF1FF',eye:'#EFFFFF',hp:135,atk:13,spd:0.9,special:'Frostbite Volley'},
  rimewing:{name:'Rimewing',el:'frost',rarity:'rare',body:'avian',c1:'#4F8FB8',c2:'#D8F4FF',eye:'#F2FEFF',hp:104,atk:18,spd:1.2,special:'Glacial Lance'},
  voltfinch:{name:'Voltfinch',el:'storm',rarity:'common',body:'avian',c1:'#C9A21E',c2:'#FFF08A',eye:'#FFFFFF',hp:100,atk:16,spd:1.25,special:'Spark Dive'},
  thunderhorn:{name:'Thunderhorn',el:'storm',rarity:'rare',body:'brute',c1:'#5A4A8C',c2:'#F2DC5D',eye:'#FFF6C2',hp:130,atk:18,spd:1.0,horns:2,special:'Skybreaker'},
  cobbleguard:{name:'Cobbleguard',el:'stone',rarity:'common',body:'golem',c1:'#7A6246',c2:'#C9AE86',eye:'#FFB35C',hp:150,atk:11,spd:0.85,special:'Rockfall'},
  quarryback:{name:'Quarryback',el:'stone',rarity:'rare',body:'brute',c1:'#6B5A48',c2:'#B8A07E',eye:'#FFD28A',hp:150,atk:16,spd:0.9,horns:0,spikes:true,special:'Landslide'},
  zephyrkit:{name:'Zephyrkit',el:'gale',rarity:'common',body:'avian',c1:'#5FA88A',c2:'#DFF7EA',eye:'#FFFFFF',hp:105,atk:14,spd:1.3,special:'Gust Spiral'},
  galewyrm:{name:'Galewyrm',el:'gale',rarity:'rare',body:'serpent',c1:'#4E9A7E',c2:'#C8F0DC',eye:'#F4FFF9',hp:118,atk:18,spd:1.15,special:'Cyclone Coil'},
  lumenfawn:{name:'Lumenfawn',el:'radiant',rarity:'rare',body:'brute',c1:'#D9B45A',c2:'#FFF3C4',eye:'#FFFFFF',hp:125,atk:18,spd:1.05,horns:2,special:'Dawnbeam'},
  seraphel:{name:'Seraphel',el:'radiant',rarity:'epic',body:'avian',c1:'#E0B84E',c2:'#FFF8DD',eye:'#FFFFFF',hp:140,atk:23,spd:1.15,special:'Judgement Light'},
  duskmote:{name:'Duskmote',el:'umbral',rarity:'rare',body:'wisp',c1:'#3A2560',c2:'#9A6BD6',eye:'#E6D6FF',hp:108,atk:19,spd:1.15,eyes:1,special:'Night Hollow'},
  nyxhollow:{name:'Nyxhollow',el:'umbral',rarity:'epic',body:'golem',c1:'#2A1C44',c2:'#8C5AD8',eye:'#D9B8FF',hp:160,atk:21,spd:0.95,special:'Void Collapse'},
};

/** Names of each beast's three forms: base, evolved, final. */
export const FORMS: Record<string, [string, string, string]> = {
  cindermaw:['Cindermaw','Scorchmaw','Infernomaw'],
  ashwing:['Ashwing','Cinderwing','Solwing'],
  vhal:['Vhal the Kilnborn','Vhal, Forge Tyrant','Vhal, Heart of the Kiln'],
  brambleback:['Brambleback','Thornhide','Elderbramble'],
  mosswraith:['Mosswraith','Bloomwraith','Verdant Revenant'],
  ysra:['Ysra of the Hedge','Ysra, Thorn Regent','Ysra, Queen Eternal'],
  tidecoil:['Tidecoil','Rivercoil','Leviacoil'],
  brinehound:['Brinehound','Stormhound','Tempest Hound'],
  mawdeep:['Mawdeep','Trenchmaw','Abyssal Mawdeep'],
  shardling:['Shardling','Glacierguard','Permafrost Colossus'],
  rimewing:['Rimewing','Hoarfrost Roc','Aurora Roc'],
  voltfinch:['Voltfinch','Arcfinch','Thunderbird'],
  thunderhorn:['Thunderhorn','Stormcaller','Tempest Titan'],
  cobbleguard:['Cobbleguard','Bastion','Mountainheart'],
  quarryback:['Quarryback','Boulderhide','Tectonic Behemoth'],
  zephyrkit:['Zephyrkit','Windreaver','Skyrender'],
  galewyrm:['Galewyrm','Squallwyrm','Cyclone Wyrm'],
  lumenfawn:['Lumenfawn','Dawnstag','Solar Hart'],
  seraphel:['Seraphel','Seraphel, Bright Wing','Seraphel, Crown of Dawn'],
  duskmote:['Duskmote','Gloamwisp','Eclipse Shade'],
  nyxhollow:['Nyxhollow','Nyxhollow, Void Warden','Nyxhollow, End of Stars']};
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
