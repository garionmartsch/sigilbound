import { MAX_EVO, MAX_SKILL, SPECIES, capOf } from './data';
import { campaignFromOldStage, newCampaign } from './campaign';
import type { Card, SaveData } from './types';
import { clamp } from './util';

/* ---------- save ---------- */
export const KEY='sigilbound-save-v2', OLDKEY='sigilbound-save-v1';
export function newCard(s: SaveData,sp: string,lvl?: number): Card{const c: Card={id:s.nextId++,sp,lvl:lvl||1,xp:0,evo:0,skill:1,locked:false};s.roster.push(c);return c}
export function defaultSave(): SaveData{
  const s: SaveData={roster:[],team:[],shards:300,gold:1500,nextId:1,tutorial:{done:false,step:'intro'},campaign:newCampaign()};
  ['cindermaw','tidecoil','brambleback'].forEach(k=>s.team.push(newCard(s,k).id));
  ['cindermaw','tidecoil','brambleback','cindermaw'].forEach(k=>newCard(s,k));
  return s;
}
/** Bring an older or partial save up to the current shape. */
export function migrate(s: any): SaveData{
  s.roster=s.roster.filter((m: any)=>m&&SPECIES[m.sp]);
  if(!s.roster.length) return defaultSave();
  s.roster.forEach((m: Card)=>{m.evo=clamp(m.evo||0,0,MAX_EVO);m.skill=clamp(m.skill||1,1,MAX_SKILL);m.locked=!!m.locked;m.xp=m.xp||0;m.lvl=clamp(m.lvl||1,1,capOf(m))});
  if(typeof s.gold!=='number') s.gold=1500;
  if(typeof s.shards!=='number') s.shards=0;
  // Saves from before the campaign counted stages 1, 2, 3...; turn that into cleared stages.
  if(!s.campaign||typeof s.campaign.stars!=='object') s.campaign=campaignFromOldStage(s.stage||1);
  s.campaign.chests=s.campaign.chests||{}; s.campaign.seen=s.campaign.seen||[];
  delete s.stage;
  s.nextId=Math.max(s.nextId||1,...s.roster.map((m: Card)=>m.id+1));
  s.team=s.team.filter((id: number)=>s.roster.some((m: Card)=>m.id===id)).slice(0,3);
  if(!s.team.length) s.team=[s.roster[0].id];
  // Saves from before the tutorial existed belong to players who already know the game.
  if(!s.tutorial||typeof s.tutorial.done!=='boolean') s.tutorial={done:true,step:'done'};
  return s;
}
export function load(): SaveData{
  for(const k of [KEY,OLDKEY]){try{const raw=localStorage.getItem(k); if(raw){const s=JSON.parse(raw); if(s&&Array.isArray(s.roster)&&Array.isArray(s.team)) return migrate(s)}}catch(e){}}
  return defaultSave();
}
export function persist(){try{localStorage.setItem(KEY,JSON.stringify(save))}catch(e){}}
export let save: SaveData=load();
/** Wipe progress and start a fresh save. */
export function resetSave(){save=defaultSave();persist()}
/** Swap in a different save, such as one loaded from a save code. */
export function replaceSave(s: SaveData){save=s;persist()}
export const teamMembers=(): Card[]=>save.team.map(id=>save.roster.find(m=>m.id===id)).filter((m): m is Card=>!!m);
export const cardById=(id: number)=>save.roster.find(m=>m.id===id);
/** Same-species cards that can be merged into m to evolve it. */
export const partnersFor=(m: Card)=>save.roster.filter(x=>x.id!==m.id&&x.sp===m.sp&&!x.locked&&!save.team.includes(x.id));
/** Cards that can be fed to m: not m, not on the team, not locked. */
export const fodderFor=(m: Card)=>save.roster.filter(x=>x.id!==m.id&&!x.locked&&!save.team.includes(x.id));
