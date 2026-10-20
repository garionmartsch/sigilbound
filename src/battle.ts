import { BOX, ELEM, FORMS, SPECIES, addXp, capOf, collectible, elemMult, nameOf, statsOf } from './data';
import { drawMonster, drawSigil } from './render';
import { newCard, persist, save, teamMembers } from './save';
import { current, show } from './screens';
import { SFX, buzz } from './sfx';
import { FXDRAW, drawShot, fbPos, ribbon, shotPos, tornadoX, waveX, type Fx } from './fx';
import { ENEMY_SHOT, SHOOT_DOWN_GAIN, SHOOT_DOWN_MIN, THROWS, aimTarget, chargeAt, chargedKind, classifyFlick, flickPower, flightTime, isRanged, type ThrowKind } from './throwing';
import { applyStatus, cleanse, damageDealtMult, damageTakenMult, drainFrom, rollDazeMiss, STATUS, STATUS_INFO, statusList, tempo, tickStatus, type StatusState } from './status';
import type { Card, ElementKey, Species } from './types';
import { prefs } from './prefs';
import { themeById } from './themes';
import { flashScale, isNumberText, parryWindow, shakeScale, swipeDistances } from './settingsCore';
import { $, $$, clamp, ease, ell, fit, pick, rand, rgba } from './util';
import { emit } from './events';
import { firstClearBonus, nextMain, openableChests, planStage, recordClear, stageUnlocked, starsFor, type EnemySpec, type StagePlan } from './campaign';
import { KITS, MOVES, MOVE_HINT, MOVE_NAMES, ROAR, advancePhase, chooseAttack, newBossState, phaseTitle, tempoFor, type BossState, type MoveKind } from './bosses';
import { REGIONS } from './regions';

/* ---------- battle state ---------- */
/** One of the player's three beasts during a fight. */
export interface Unit {
  m: Card; sp: Species; name: string; evo: number; skill: number;
  hp: number; maxHp: number; atk: number; energy: number;
  dead: boolean; fade: number; flash: number;
  /** 0..1 knockback after being hit. */
  kb?: number;
  /** Active status effects. */
  st: StatusState;
  /** Damage-over-time waiting to be shown, and time until it is. */
  dotAcc: number; dotT: number;
}
/** The current enemy. */
export interface Enemy {
  key: string; sp: Species; evo: number; name: string; lvl: number;
  /** A third-wave leader or a ruler: tougher, bigger, better rewards. */
  boss: boolean;
  /** A region's Legendary or the Gate's Mythic. */
  ruler?: boolean;
  hp: number; maxHp: number; atk: number;
  state: 'idle' | 'windup' | 'dead';
  /** Seconds until the next state change. */
  timer: number;
  /** Length of the wind-up telegraph in seconds. */
  windup: number;
  flash: number; lunge: number; dead: boolean; fade: number;
  /** 0..1 entrance animation. */
  spawn: number;
  kb?: number;
  /** The parry-window sound has played for this wind-up. */
  ticked?: boolean;
  st: StatusState;
  dotAcc: number; dotT: number;
  /** Place in its group (0-2) and the group's size, which set where it stands. */
  slot: number; group: number;
  /** Length of the wind-up in progress (normal attacks use windup; boss moves their own). */
  wlen: number;
  /** Boss phases and signature moves, for wardens, rulers and guardians. */
  kit?: BossState;
  /** The signature move being wound up, if any. */
  move?: MoveKind | null;
  /** Barrage strikes still to come. */
  hitsLeft?: number;
  /** Damage taken while charging a smash; enough of it breaks the charge. */
  breakDmg?: number;
  /** Seconds left in a phase-change roar. */
  roar?: number;
  /** This wind-up ends in a thrown shot rather than a hit (ranged enemies). */
  shoots?: boolean;
}
type ParticleKind = 'spark' | 'ember' | 'drop' | 'leaf' | 'shard' | 'dust' | 'mote';
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; kind: ParticleKind; rot: number; vr: number }
interface FloatText { x: number; y: number; txt: string; color: string; size: number; life: number; max: number }
type ActKind = ThrowKind;

export interface Battle {
  team: Unit[];
  /** Index of the beast currently fighting. */
  active: number;
  stage: number;
  /** 1-3; wave 3 is the boss. */
  wave: number;
  /** The enemy your attacks go to (the target). */
  enemy: Enemy | null;
  /** Every enemy in the current wave, the target included. */
  foes: Enemy[];
  /** Boss moves already explained in this fight, so each hint shows once. */
  hinted: string[];
  /** Attack cooldown, swap cooldown, parry window and parry cooldown, in seconds. */
  cd: number; swapCd: number; parry: number; parryCd: number;
  /** An input made near the end of a cooldown, fired when it ends. */
  buffered: { kind: ActKind; o: ThrowOpts } | null;
  /** Enemy shots in the air, flying at your beast. */
  incoming: Fx[];
  fx: Fx[];
  /** Freeze-frame time remaining after a heavy hit. */
  hitstop: number;
  flash: number; flashCol: string;
  lunge: number;
  /** 0..1 entrance animation of the active beast. */
  pSpawn: number;
  parts: Particle[]; texts: FloatText[];
  trail: { x: number; y: number; t: number }[];
  shake: number; time: number; over: boolean;
  /** Rewards collected so far this stage. */
  earned: number; gold: number; drops: string[];
  timers: { t: number; fn: () => void }[];
  embers: { x: number; y: number; v: number; r: number; ph: number }[];
  lastKind?: ActKind;
  /** Present only in the tutorial's training fight. */
  training?: TrainingRules;
  /** The campaign stage being fought (absent in training). */
  plan?: StagePlan;
}

/** Gesture the tutorial is demonstrating with a ghost finger. */
export type Demo = 'tap' | 'throw' | 'charge' | 'down';
/** Rules the tutorial switches per lesson during the training fight. */
export interface TrainingRules {
  /** The enemy winds up and attacks. */
  enemyActs: boolean;
  /** The enemy can't drop below 1 HP, so lessons can't end early. */
  protectEnemy: boolean;
  demo: Demo | null;
}

/** Loaner team for the training fight, so every new player learns with the same beasts. */
const TRAINING_TEAM: Card[] = [
  { id: -1, sp: 'cindermaw', lvl: 6, xp: 0, evo: 0, skill: 1, locked: true },
  { id: -2, sp: 'tidecoil', lvl: 6, xp: 0, evo: 0, skill: 1, locked: true },
  { id: -3, sp: 'shardling', lvl: 6, xp: 0, evo: 0, skill: 1, locked: true },
];
/** Rewards for finishing training. */
export const TRAINING_REWARD = { shards: 150, gold: 300 };

/** The fight in progress, or null outside battle. */
export let B: Battle | null = null;

const fieldCv=$<HTMLCanvasElement>('#fieldCan'), field=$('#field');
/** The beast currently fighting, if any. */
export const cur=(): Unit|undefined=>B?B.team[B.active]:undefined;

/** Health and attack per enemy when several fight at once, so a group isn't triple the threat. */
const GROUP_HP=[1,1,0.62,0.48], GROUP_ATK=[1,1,0.78,0.66];
/** Build an enemy from a campaign stage's plan; slot and group say where it stands in its wave. */
function makeEnemyFrom(e: EnemySpec, slot=0, group=1): Enemy{
  const sp=SPECIES[e.key], k=(1+0.1*(e.lvl-1))*(1+0.35*e.evo);
  const warden=e.tier==='warden';
  const hpM=(e.boss?3.0:warden?2.5:e.leader?2.1:0.9)*GROUP_HP[group], atkM=(e.boss?1.2:warden?1.15:e.leader?1.1:0.8)*GROUP_ATK[group];
  const maxHp=Math.round(sp.hp*k*hpM), windup=e.boss?1.0:warden||e.leader?0.95:0.85;
  return {key:e.key,sp,evo:e.evo,name:FORMS[e.key][e.evo],lvl:e.lvl,boss:e.leader||e.boss||warden,ruler:e.boss,hp:maxHp,maxHp,atk:sp.atk*k*atkM,state:'idle' as const,st:{},dotAcc:0,dotT:0,
    timer:rand(1.5,2.1)+slot*0.9,windup,wlen:windup,flash:0,lunge:0,dead:false,fade:1,spawn:0,slot,group,kit:e.tier?newBossState(e.tier):undefined};
}
/** A Thorn beast: Cindermaw (Pyre) is strong against it and Tidecoil (Tide) is weak, for the matchup lesson. */
function makeTrainingEnemy(): Enemy{
  // Enough HP that the lessons leave it standing; it can't be finished before the last lesson anyway.
  const key='thistlekit', sp=SPECIES[key], maxHp=Math.round(sp.hp*3.6);
  return {key,sp,evo:0,name:sp.name,lvl:3,boss:false,hp:maxHp,maxHp,atk:5,state:'idle',st:{},dotAcc:0,dotT:0,timer:2,windup:1.6,wlen:1.6,
    flash:0,lunge:0,dead:false,fade:1,spawn:0,slot:0,group:1};
}
export function startBattle(opts: {training?: boolean; plan?: StagePlan}={}){
  if(!opts.training&&!opts.plan) return;
  const cards=opts.training?TRAINING_TEAM:teamMembers();
  const team=cards.map(m=>{const st=statsOf(m);return {m,sp:SPECIES[m.sp],name:nameOf(m),evo:m.evo||0,skill:m.skill||1,hp:st.maxHp,maxHp:st.maxHp,atk:st.atk,energy:0,dead:false,fade:1,flash:0,st:{},dotAcc:0,dotT:0}});
  if(!team.length) return;
  const b: Battle={team,active:0,stage:opts.plan?opts.plan.difficulty:0,plan:opts.plan,training:opts.training?{enemyActs:false,protectEnemy:true,demo:null}:undefined,wave:0,enemy:null,foes:[],hinted:[],incoming:[],cd:0,swapCd:0,parry:0,parryCd:0,buffered:null,fx:[],hitstop:0,flash:0,flashCol:'#FFFFFF',lunge:0,pSpawn:1,
    parts:[],texts:[],trail:[],shake:0,time:0,over:false,earned:0,gold:0,drops:[],timers:[],
    embers:Array.from({length:26},()=>({x:Math.random(),y:Math.random(),v:rand(0.02,0.06),r:rand(0.8,2.2),ph:Math.random()*6}))};
  B=b;
  $('#result').hidden=true;
  $('#slots').innerHTML=b.team.map((u,i)=>`<button class="slot" data-i="${i}" aria-label="Swap to ${u.name}"><canvas class="pcan" data-sp="${u.m.sp}" data-evo="${u.evo}" data-seed="${i*1.3}"></canvas><span class="sname">${u.name}</span><span class="bar sm"><i></i></span><span class="sbadge"></span></button>`).join('');
  $$('#slots .slot').forEach(b=>b.addEventListener('click',()=>swapTo(Number(b.dataset.i))));
  retreatArm=0; retreatBtn.textContent=opts.training?'Skip tutorial':'Retreat';
  show('battle');
  nextWave();
}
export function nextWave(){const bt=B; if(!bt) return;
  bt.wave++;
  if(bt.training||!bt.plan){bt.foes=[makeTrainingEnemy()]; bt.enemy=bt.foes[0]; banner('Training','Learn to fight'); return}
  const specs=bt.plan.waves[bt.wave-1], n=specs.length;
  bt.foes=specs.map((sp,i)=>makeEnemyFrom(sp,i,n));
  // Aim at the leader or boss first if there is one, else the nearest.
  bt.enemy=bt.foes.find(f=>f.boss)??bt.foes[0];
  const e=bt.enemy, plan=bt.plan, more=n>1?` and ${n-1} more`:'';
  if(e.kit?.tier==='guardian') banner(e.name,'Guardian of the Gate');
  else if(e.kit?.tier==='ruler') banner(e.name,`Ruler of ${REGIONS[plan.region].name}`);
  else if(e.kit?.tier==='warden') banner(e.name, e.sp.el===plan.el?`Warden of ${REGIONS[plan.region].name}`:'A wandering warden');
  else if(e.boss) banner('Leader', e.name+more);
  else banner(`Wave ${bt.wave}`, n>1?`${n} at once`:plan.name);
  if(n>1&&!bt.hinted.includes('target')){bt.hinted.push('target'); bt.timers.push({t:1.4,fn:()=>{const g=geo(); ftext(g.w/2,g.h*0.56,'Tap an enemy to target it','#F0E8F5',19,2.4)}})}
}
export function banner(txt: string,sub?: string){SFX.play('banner');const b=$('#banner'); b.innerHTML=`${txt}<small>${sub||''}</small>`; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');}

/** Where enemies stand, as shares of the field, for groups of one, two and three. */
const LAYOUT: [number,number][][]=[[],[[0.66,0.33]],[[0.52,0.31],[0.81,0.37]],[[0.45,0.34],[0.67,0.24],[0.87,0.37]]];
/** Enemies in a group are drawn smaller so they fit. */
const GROUP_SCALE=[1,1,0.84,0.74];
/** Where an enemy stands, and its drawing scale. */
export function posOf(e: Enemy){
  const w=field.clientWidth,h=field.clientHeight, at=(LAYOUT[e.group]??LAYOUT[1])[e.slot]??LAYOUT[1][0];
  return {x:w*at[0],y:h*at[1],k:GROUP_SCALE[e.group]??1};
}
/** Field size, beast size, the target's spot (E) and your beast's spot (P). */
export function geo(){
  const w=field.clientWidth,h=field.clientHeight, s=Math.min(w*0.19,h*0.15);
  const t=B?.enemy, E=t?posOf(t):{x:w*0.66,y:h*0.33};
  return {w,h,s,E:{x:E.x,y:E.y},P:{x:w*0.34,y:h*0.7}};
}
/** Living enemies in this wave. */
const alive=()=>B?B.foes.filter(f=>!f.dead):[];
/** Aim at another enemy. */
export function setTarget(e: Enemy){const bt=B; if(!bt||e.dead||bt.enemy===e) return; bt.enemy=e; SFX.play('ui'); buzz(6); emit('target')}
/** The enemy under a point on the field, if any. */
function foeAt(x: number,y: number): Enemy|undefined{
  const s=geo().s; let best: Enemy|undefined, bd=Infinity;
  alive().forEach(f=>{const p=posOf(f), d=Math.hypot(x-p.x,y-(p.y-s*0.2*p.k)); if(d<s*1.05*p.k&&d<bd){bd=d;best=f}});
  return best;
}
/** Number of claw marks each body type leaves when an enemy hits in melee. */
const CLAWS: Record<string, number>={brute:3,wisp:2,serpent:1,avian:2,golem:1};
/** Particle style for each element's bursts. */
const PKIND: Record<ElementKey, ParticleKind>={pyre:'ember',tide:'drop',thorn:'leaf',frost:'shard',storm:'ember',stone:'dust',gale:'leaf',radiant:'ember',umbral:'mote'};
/** Particle colors for each element. */
const PCOLS: Record<ElementKey, string[]>={pyre:['#FFD27A','#FF8A3D','#E4683A','#FFF1C4'],tide:['#BFEFFF','#3E9ED6','#7FD0F0','#FFFFFF'],thorn:['#7DB85B','#A7D46F','#4F7A3A','#C6E36A'],frost:['#E6F8FF','#8FD3E8','#BFE9F7','#FFFFFF'],storm:['#FFF6B0','#E8D04A','#FFFFFF','#F5E27A'],stone:['#A88B64','#7A6246','#C9AE86','#5E4C38'],gale:['#E6FFF2','#B5E3C8','#FFFFFF','#8FCFAE'],radiant:['#FFF8D6','#FFE58A','#FFFFFF','#F7D46A'],umbral:['#9A6BD6','#5B3A8C','#C9A6FF','#6E4AA8']};
export function pushPart(p: Particle){const bt=B; if(!bt) return;if(bt.parts.length<420)bt.parts.push(p)}
export function burst(x: number,y: number,color: string,n: number,sp: number){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=rand(0.3,1)*sp;pushPart({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-sp*0.2,life:rand(0.35,0.8),max:0.8,color,r:rand(1.5,4),kind:'spark',rot:0,vr:0})}}
export function elemBurst(x: number,y: number,el: ElementKey,n: number,sp: number,up?: number){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=rand(0.3,1)*sp;pushPart({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-sp*(up??0.25),life:rand(0.4,0.9),max:0.9,color:pick(PCOLS[el]),r:rand(2,4.5),kind:PKIND[el],rot:rand(0,6),vr:rand(-9,9)})}}
export function fx(o: Omit<Fx,'t'> & {t?: number}): Fx{const bt=B; const f={t:0,...o} as Fx; if(!bt) return f;bt.fx.push(f);return f}
export function ftext(x: number,y: number,txt: string,color: string,size?: number,life?: number){const bt=B; if(!bt) return; if(!prefs.numbers&&isNumberText(txt)) return;bt.texts.push({x,y,txt,color,size:size||22,life:life||0.9,max:life||0.9})}
export function shake(a: number){const bt=B; if(!bt) return;const k=shakeScale(prefs); if(k>0)bt.shake=Math.max(bt.shake,a*k)}
export function slashFx(x: number,y: number,ang: number,color: string,body: string,s: number,dur?: number){
  const n=CLAWS[body];
  return fx({type:'slash',x,y,ang,color,n,len:s*2.3,w:s*(n===1?0.26:n===2?0.17:0.13),gap:s*0.3,bow:s*0.35*(Math.random()<.5?1:-1),dur:dur||0.42});
}

/** Where a throw aims (the flick's direction) and how hard (from the flick's speed). */
export interface ThrowOpts { dir?: { x: number; y: number }; power?: number }

/**
 * Your beast attacks. tap: a quick light shot at your target. throw: a flick,
 * aimed by its direction. heavy: a charged throw. special: a charged throw
 * with a full energy bar, your beast's signature attack.
 */
export function playerAct(kind: ActKind,o: ThrowOpts={}){const bt=B; if(!bt) return;
  if(bt.over) return;
  if(bt.enemy?.dead){const nx=alive()[0]; if(nx) bt.enemy=nx}
  const u=cur();
  if(!u||u.dead||bt.pSpawn<1) return;
  if(u.st.freeze){ if(Math.random()<0.3){const g0=geo(); ftext(g0.P.x,g0.P.y-g0.s*1.4,'Frozen!','#BFEFFF',16,0.6)} return; }
  if(bt.cd>0){ if(bt.cd<0.3) bt.buffered={kind,o}; return; }
  if(kind==='special'&&u.energy<100) kind='heavy';
  // An enemy shot in the air: any throw but a Special goes to knock it down.
  if(kind!=='special'){const shot=bt.incoming.find(x=>x.dur-x.t>SHOOT_DOWN_MIN); if(shot){shootDown(u,kind,shot); return}}
  const g=geo();
  // The flick's direction picks who you hit.
  if(o.dir&&bt.foes.length>1){const a=alive().filter(f=>f.spawn>=1); const i=aimTarget(g.P,o.dir,a.map(posOf)); if(i>=0&&a[i]!==bt.enemy){bt.enemy=a[i]; emit('target')}}
  const e=bt.enemy;
  if(!e||e.dead||e.spawn<1) return;
  const power=o.power??1;
  let mult,cd,gain;
  if(kind==='special'){mult=2.8*(1+0.12*((u.skill||1)-1));cd=1.1;gain=0;u.energy=0}
  else {const T=THROWS[kind]; mult=T.mult*(kind==='throw'?power:1); cd=T.cd; gain=T.gain}
  bt.cd=cd; u.energy=Math.min(100,u.energy+gain);
  const em=elemMult(u.sp.el,e.sp.el);
  const dmg=Math.max(1,Math.round(u.atk*mult*em*rand(0.9,1.1)*damageDealtMult(u.st)*damageTakenMult(e.st)));
  if(kind==='special'){castSpecial(u,e,dmg,em);return}
  if(rollDazeMiss(u.st)){bt.lunge=1; SFX.play('guard'); ftext(g.E.x,g.E.y-g.s*0.6,'Miss','#B7A9C6',22,0.8); return}
  throwShot(u,e,kind,dmg,em,power);
}
/** The spot above your beast where throws leave its hands. */
const launchPoint=(g: ReturnType<typeof geo>)=>({x:g.P.x+g.s*0.45,y:g.P.y-g.s*0.55});
/** Send an elemental shot at an enemy; the damage lands when it arrives. */
function throwShot(u: Unit,e: Enemy,kind: 'tap'|'throw'|'heavy',dmg: number,em: number,power: number){const bt=B; if(!bt) return;
  const g=geo(), E=posOf(e), from=launchPoint(g), col=ELEM[u.sp.el].color, T=THROWS[kind];
  bt.lunge=1; SFX.play(kind==='tap'?'tap':'slash'); buzz(kind==='heavy'?18:8);
  if(kind==='heavy'){fx({type:'charge',x:g.P.x,y:g.P.y,r:g.s*1.4,color:col,dur:0.2}); SFX.play('charge')}
  const dist=Math.hypot(E.x-from.x,E.y-from.y);
  fx({type:'shot',x0:from.x,y0:from.y,x1:E.x,y1:E.y-g.s*0.15*E.k,arc:dist*(kind==='tap'?0.07:0.16),r:g.s*0.3*T.size,el:u.sp.el,color:col,
    dur:flightTime(power)*(kind==='heavy'?1.2:kind==='tap'?0.85:1),
    end:()=>{const b2=B; if(!b2||!b2.foes.includes(e)||e.dead) return;
      fx({type:'impact',x:E.x,y:E.y-g.s*0.15*E.k,r:g.s*(kind==='tap'?0.55:kind==='heavy'?1.2:0.85)*E.k,color:col,rot:Math.random(),dur:kind==='tap'?0.22:0.3});
      elemBurst(E.x,E.y,u.sp.el,kind==='tap'?4:kind==='heavy'?24:10,kind==='heavy'?400:240,0.3);
      SFX.play('hit'); buzz(kind==='heavy'?40:kind==='tap'?6:14); b2.hitstop=kind==='tap'?0.03:kind==='heavy'?0.11:0.07;
      if(kind==='heavy') shake(0.6);
      hitEnemy(dmg,em,kind,e);
      const chance=kind==='heavy'?Math.min(1,STATUS.hitChance.player*2):kind==='throw'?STATUS.hitChance.player:0;
      if(!e.dead&&Math.random()<chance) inflictOnEnemy(u,false,e);
      emit(kind==='heavy'?'throw':kind);
    }});
}
/** Throw at an enemy shot in the air to knock it down before it lands. */
function shootDown(u: Unit,kind: 'tap'|'throw'|'heavy',shot: Fx){const bt=B; if(!bt) return;
  const T=THROWS[kind], g=geo(), from=launchPoint(g), dur=0.16;
  const at=shotPos(shot,clamp((shot.t+dur)/shot.dur,0,1));
  bt.cd=T.cd*0.8; bt.lunge=1; SFX.play('slash'); buzz(8);
  fx({type:'shot',x0:from.x,y0:from.y,x1:at.x,y1:at.y,arc:8,r:g.s*0.3*T.size,el:u.sp.el,color:ELEM[u.sp.el].color,dur,
    end:()=>{const b2=B; if(!b2) return; const i=b2.incoming.indexOf(shot); if(i<0) return;
      b2.incoming.splice(i,1);
      const p=shotPos(shot);
      fx({type:'impact',x:p.x,y:p.y,r:g.s*0.8,color:'#FFE3A0',rot:Math.random(),dur:0.3});
      burst(p.x,p.y,'#FFE3A0',24,340); elemBurst(p.x,p.y,shot.el,12,300);
      ftext(p.x,p.y-g.s*0.5,'Shot down!','#FFE3A0',22,1);
      u.energy=Math.min(100,u.energy+SHOOT_DOWN_GAIN); SFX.play('guard'); SFX.play('hit'); buzz([10,20,20]); b2.hitstop=0.06;
      emit('shotDown');
    }});
}
/** A ranged enemy throws its element at your beast. It lands when it arrives, unless parried or shot down. */
function launchEnemyShot(e: Enemy){const bt=B; if(!bt) return;
  const g=geo(), E=posOf(e);
  e.lunge=1; SFX.play('slash');
  const x0=E.x-g.s*0.5*E.k, y0=E.y-g.s*0.3*E.k, x1=g.P.x+g.s*0.15, y1=g.P.y-g.s*0.25;
  bt.incoming.push({type:'shot',t:0,dur:ENEMY_SHOT.flight,x0,y0,x1,y1,arc:Math.hypot(x1-x0,y1-y0)*0.14,r:g.s*0.34*E.k,el:e.sp.el,color:ELEM[e.sp.el].color,from:e,ticked:false});
  if(!bt.hinted.includes('incoming')){bt.hinted.push('incoming'); ftext(g.w/2,g.h*0.56,'Incoming! Parry it, or throw to shoot it down','#F0E8F5',Math.min(16,g.w/24),2.6)}
}

/* ---------- status effects in battle ---------- */
/** The active beast's element lands its effect on the enemy. */
function inflictOnEnemy(u: Unit, special: boolean, e: Enemy|null=B?.enemy??null){const bt=B; if(!bt) return;
  if(!e||e.dead) return;
  const g=geo(), E=posOf(e), el=u.sp.el, col=ELEM[el].color;
  const r=applyStatus(e.st,el,u.atk,special,true);
  if(el==='radiant'){
    // Bless heals the player's side and clears their ailments.
    bt.team.forEach(x=>{if(!x.dead){x.hp=Math.min(x.maxHp,x.hp+Math.round(x.maxHp*r.heal))}});
    cleanse(u.st);
    ftext(g.P.x,g.P.y-g.s*1.45,`Blessed +${Math.round(r.heal*100)}%`,col,18,1.1);
    elemBurst(g.P.x,g.P.y,'radiant',16,220,0.8);
    return;
  }
  if(r.label) ftext(E.x,E.y-g.s*1.6*E.k,r.label,col,17,1.1);
  if(r.bonusDamage) damageEnemy(e,r.bonusDamage,col);
  if(e.dead) return;
  if(e.state==='windup'&&(r.froze||(r.interruptChance&&Math.random()<r.interruptChance))) interruptEnemy(e,r.froze?'frozen':'stunned');
}
/** The enemy's element lands its effect on the player's active beast. */
function inflictOnPlayer(e: Enemy, u: Unit){const bt=B; if(!bt) return;
  const g=geo(), el=e.sp.el, col=ELEM[el].color;
  const r=applyStatus(u.st,el,e.atk,false,false);
  if(el==='radiant'){
    e.hp=Math.min(e.maxHp,e.hp+Math.round(e.maxHp*r.heal)); cleanse(e.st);
    const E=posOf(e); ftext(E.x,E.y-g.s*1.6*E.k,'Blessed','#FFE08A',17,1);
    return;
  }
  if(r.label) ftext(g.P.x,g.P.y-g.s*1.45,r.label,col,17,1.1);
  if(r.bonusDamage) damageUnit(u,r.bonusDamage,col);
  if(r.interruptChance){u.energy=Math.max(0,u.energy-25); bt.parry=0}
}
/** Damage from effects (burns, shocks), shown as a smaller colored number. */
function damageEnemy(e: Enemy, amount: number, color: string){const bt=B; if(!bt) return;
  if(!e||e.dead) return;
  const g=geo(), E=posOf(e), n=Math.max(1,Math.round(amount));
  e.hp-=n; ftext(E.x+rand(-g.s*0.5,g.s*0.5),E.y-g.s*0.2,String(n),color,17,0.8);
  if(bt.training?.protectEnemy) e.hp=Math.max(1,e.hp);
  if(e.hp<=0) enemyDefeated(e); else checkPhase(e);
}
/** A wind-up was cut short: by a Special, a stun or freeze, or by breaking a smash. */
function interruptEnemy(e: Enemy, why: 'special'|'stunned'|'frozen'|'break'){const bt=B; if(!bt) return;
  const g=geo(), E=posOf(e), smash=e.move==='smash';
  e.state='idle'; e.move=null; e.hitsLeft=0; e.breakDmg=0; e.timer=rand(1.6,2.2);
  if(smash||why==='break'){
    // Breaking a boss's big charge leaves it reeling.
    e.timer=2.8; e.kb=1;
    ftext(E.x,E.y-g.s*1.9*E.k,'Broken!','#FFE3A0',32,1.4);
    bt.flash=Math.max(bt.flash,0.45); bt.flashCol='#FFE3A0'; shake(0.8); SFX.play('parry'); buzz([20,30,40]);
    burst(E.x,E.y,'#FFE3A0',40,420);
  } else if(why==='special') ftext(E.x,E.y-g.s*1.6*E.k,'Staggered!','#F0E8F5',20,1);
  else if(why==='stunned') ftext(E.x,E.y-g.s*1.95*E.k,'Stunned!','#FFF6B0',17,1);
}
/** A boss whose health fell past a threshold starts its next phase. */
function checkPhase(e: Enemy){const bt=B; if(!bt||!e.kit||e.dead) return;
  if(!advancePhase(e.kit,e.hp/e.maxHp)) return;
  const g=geo(), E=posOf(e), col=ELEM[e.sp.el].color;
  e.state='idle'; e.move=null; e.hitsLeft=0; e.breakDmg=0; e.roar=ROAR; e.timer=0.3; e.kb=0; cleanse(e.st);
  banner(e.name,phaseTitle(e.kit));
  bt.flash=Math.max(bt.flash,0.5); bt.flashCol=col; shake(1); SFX.play('boom'); buzz([40,30,80]);
  elemBurst(E.x,E.y,e.sp.el,60,460,0.6);
  ftext(E.x,E.y-g.s*1.9*E.k,'Shakes off its ailments','#F0E8F5',15,1.4);
  emit('phase',e.kit.phase);
}
function damageUnit(u: Unit, amount: number, color: string){const bt=B; if(!bt) return;
  if(u.dead) return;
  const g=geo(), n=Math.max(1,Math.round(amount));
  u.hp-=n;
  if(bt.training) u.hp=Math.max(1,u.hp);
  if(u===cur()) ftext(g.P.x+rand(-g.s*0.5,g.s*0.5),g.P.y-g.s*0.2,String(n),color,17,0.8);
  if(u.hp<=0) unitDown(u);
}
export function castSpecial(u: Unit,e: Enemy,dmg: number,em: number){const bt=B; if(!bt) return;
  const g=geo(), s=g.s, el=u.sp.el, col=ELEM[el].color;
  ftext(g.w/2,g.h*0.52,u.sp.special,col,28,1.4);
  if(e.state==='windup') interruptEnemy(e,'special');
  fx({type:'charge',x:g.P.x,y:g.P.y,r:s*1.8,color:col,dur:0.28}); SFX.play('charge'); buzz(20);
  const land=()=>{ if(!bt||!bt.foes.includes(e)||e.dead) return; bt.flash=0.55; bt.flashCol=col; bt.hitstop=0.14; shake(1); SFX.play('hit'); buzz(70); hitEnemy(dmg,em,'special',e); inflictOnEnemy(u,true,e); emit('special'); };
  if(el==='pyre'){
    bt.timers.push({t:0.28,fn:()=>{ bt.lunge=1; SFX.play('fireball');
      fx({type:'fireball',x0:g.P.x+s*0.5,y0:g.P.y-s*0.4,x1:g.E.x,y1:g.E.y,r:s*0.4,dur:0.42,end:()=>{
        fx({type:'explosion',x:g.E.x,y:g.E.y,r:s*2.1,color:col,dur:0.6}); SFX.play('boom'); elemBurst(g.E.x,g.E.y,'pyre',50,480,0.4); land(); }});}});
  } else if(el==='thorn'){
    const vines=Array.from({length:6},(_,i)=>({dx:(i-2.5)*s*0.42+rand(-8,8),h:s*rand(1.8,2.8),lean:rand(-0.5,0.5)*s+(i<3?s*0.35:-s*0.35),w:s*rand(0.14,0.2),delay:rand(0,0.08)}));
    bt.timers.push({t:0.28,fn:()=>{ bt.lunge=1; SFX.play('vines'); fx({type:'vines',x:g.E.x,y:g.E.y+s*0.85,vines,s,dur:1.05}); }});
    bt.timers.push({t:0.5,fn:()=>{ if(!bt) return; elemBurst(g.E.x,g.E.y+s*0.3,'thorn',40,380,0.5); land(); }});
  } else if(el==='tide'){
    bt.timers.push({t:0.28,fn:()=>{ bt.lunge=1; SFX.play('wave'); fx({type:'wave',x0:g.E.x-s*3.2,x1:g.E.x+s*2.4,base:g.E.y+s*0.95,h:s*2.6,s,dur:0.85}); }});
    bt.timers.push({t:0.76,fn:()=>{ if(!bt) return; elemBurst(g.E.x,g.E.y-s*0.3,'tide',50,420,0.5); land(); }});
  } else if(el==='frost'){
    SFX.play('shards');
    bt.timers.push({t:0.28,fn:()=>{if(bt)bt.lunge=1}});
    for(let i=0;i<5;i++){const last=i===4;
      fx({type:'shard',t:-(0.28+i*0.07),x0:g.P.x+s*0.5+rand(-10,10),y0:g.P.y-s*0.5+rand(-20,20),x1:g.E.x+rand(-s*0.3,s*0.3),y1:g.E.y+rand(-s*0.3,s*0.2),len:s*0.6,dur:0.3,
        end:()=>{ if(!bt) return; fx({type:'impact',x:g.E.x+rand(-s*.3,s*.3),y:g.E.y+rand(-s*.3,s*.3),r:s*0.5,color:col,rot:Math.random(),dur:0.2}); elemBurst(g.E.x,g.E.y,'frost',8,300);
          if(last){fx({type:'explosion',x:g.E.x,y:g.E.y,r:s*1.9,color:col,dur:0.55}); land();} }});}
  } else if(el==='storm'){
    [0.28,0.42,0.56].forEach((d,i)=>bt.timers.push({t:d,fn:()=>{ if(!bt) return; if(!i) bt.lunge=1; SFX.play('thunder');
      fx({type:'bolt',x:g.E.x+(i?rand(-s*0.5,s*0.5):0),y:g.E.y+(i?rand(-s*0.3,s*0.3):0),dur:0.3,w:s*(i?0.12:0.2)});
      bt.flash=Math.max(bt.flash,0.35); bt.flashCol='#FFF6B0'; elemBurst(g.E.x,g.E.y,'storm',14,380); if(!i) land(); }}));
  } else if(el==='stone'){
    bt.timers.push({t:0.28,fn:()=>{ if(!bt) return; bt.lunge=1; SFX.play('rockfall');
      fx({type:'boulder',x:g.E.x,y0:-s*1.5,y1:g.E.y-s*0.2,r:s*0.75,dur:0.42,end:()=>{ if(!bt) return;
        fx({type:'explosion',x:g.E.x,y:g.E.y+s*0.3,r:s*2,color:'#C9AE86',dur:0.55}); elemBurst(g.E.x,g.E.y+s*0.4,'stone',50,460,0.5); SFX.play('boom'); land(); }}); }});
  } else if(el==='gale'){
    bt.timers.push({t:0.28,fn:()=>{ if(!bt) return; bt.lunge=1; SFX.play('tornado'); fx({type:'tornado',x0:g.P.x+s*0.8,x1:g.E.x,base:g.E.y+s*0.9,h:s*3,s,dur:1.0}); }});
    bt.timers.push({t:0.8,fn:()=>{ if(!bt) return; elemBurst(g.E.x,g.E.y,'gale',40,420,0.6); land(); }});
  } else if(el==='radiant'){
    bt.timers.push({t:0.28,fn:()=>{ if(!bt) return; bt.lunge=1; SFX.play('beam'); fx({type:'beam',x:g.E.x,y:g.E.y+s*0.9,w:s*1.3,dur:0.85}); }});
    bt.timers.push({t:0.55,fn:()=>{ if(!bt) return; elemBurst(g.E.x,g.E.y,'radiant',40,360,0.8); land(); }});
  } else if(el==='umbral'){
    bt.timers.push({t:0.28,fn:()=>{ if(!bt) return; bt.lunge=1; SFX.play('voidcall'); fx({type:'void',x:g.E.x,y:g.E.y,r:s*1.6,s,dur:0.95}); }});
    bt.timers.push({t:0.94,fn:()=>{ if(!bt) return; elemBurst(g.E.x,g.E.y,'umbral',50,420,0.2); land(); }});
  }
}
export function hitEnemy(dmg: number,em: number,kind: ActKind,e: Enemy|null=B?.enemy??null){const bt=B; if(!bt) return;
  const g=geo(),u=cur(); if(!e||e.dead) return;
  const E=posOf(e), el=u?u.sp.el:'pyre';
  e.hp-=dmg; e.flash=1; e.kb=kind==='tap'?0.45:1;
  elemBurst(E.x+rand(-10,10),E.y+rand(-10,10),el,kind==='tap'?5:10,kind==='tap'?160:260);
  ftext(E.x+rand(-g.s*0.6,g.s*0.6),E.y-g.s*0.5,String(dmg),em>1?'#FFD98A':(em<1?'#B7A9C6':'#FFFFFF'),kind==='special'?36:kind==='heavy'?30:kind==='throw'?26:20);
  if(em>1&&kind!=='tap') ftext(E.x,E.y-g.s*1.25*E.k,'Super effective','#E7BE6E',16,1);
  if(em<1&&kind!=='tap') ftext(E.x,E.y-g.s*1.25*E.k,'Resisted','#A898B9',15,0.9);
  // Hitting a charging boss hard enough breaks the charge.
  if(e.move==='smash'&&e.state==='windup'&&e.hp>0){e.breakDmg=(e.breakDmg||0)+dmg; if(e.breakDmg>=e.maxHp*MOVES.smash.breakShare) interruptEnemy(e,'break')}
  shake(kind==='tap'?0.15:0.4);
  const drain=drainFrom(e.st);
  if(drain&&u&&!u.dead){const h=Math.round(dmg*drain); u.hp=Math.min(u.maxHp,u.hp+h); ftext(g.P.x,g.P.y-g.s*1.2,`+${h}`,'#B58BF0',16,0.8)}
  if(bt.training?.protectEnemy) e.hp=Math.max(1,e.hp);
  if(e.hp<=0) enemyDefeated(e); else checkPhase(e);
}
/** An enemy's health reached zero: rewards, drops, a new target, and the next wave once all are down. */
function enemyDefeated(e: Enemy){const bt=B; if(!bt) return;
  if(!e||e.dead) return;
  const g=geo(), E=posOf(e);
  e.hp=0; e.dead=true; e.state='dead'; e.move=null; cleanse(e.st);
  fx({type:'explosion',x:E.x,y:E.y,r:g.s*2.6*E.k,color:ELEM[e.sp.el].color,dur:0.8});
  elemBurst(E.x,E.y,e.sp.el,70,420,0.4); shake(0.9); SFX.play('kill'); buzz([30,40,90]);
  bt.hitstop=Math.max(bt.hitstop,0.18); bt.flash=Math.max(bt.flash,0.4); bt.flashCol='#FFF4DC';
  if(bt.training){bt.timers.push({t:1.3,fn:trainingComplete}); return}
  const big=e.ruler?1.5:e.kit?1.3:1, share=1/Math.max(1,e.group*0.7);
  const reward=Math.round((e.boss?60+10*bt.stage:20+5*bt.stage)*big*share); bt.earned+=reward;
  const gold=Math.round((e.boss?120+30*bt.stage:40+10*bt.stage)*big*share); bt.gold+=gold;
  ftext(E.x,E.y,`+${reward} shards · +${gold} gold`,'#E7BE6E',18,1.4);
  const dropChance=(e.boss?0.3:0.35)*(bt.plan?.kind==='side'?2:1)/Math.max(1,e.group-0.5);
  if(collectible(e.key)&&Math.random()<dropChance&&save.roster.length+bt.drops.length<BOX){bt.drops.push(e.key); ftext(E.x,E.y+26,`${e.sp.name} card dropped!`,'#F0E8F5',17,1.6)}
  const left=alive();
  if(bt.enemy===e&&left.length) bt.enemy=left.find(f=>f.boss)??left[0];
  if(!left.length) bt.timers.push({t:1.3,fn:()=>{if(bt.wave<3) nextWave(); else victory();}});
}
/** An enemy's attack lands. mult scales the damage; all hits every beast on the team; unblockable ignores parries. */
export function enemyStrike(e: Enemy|null=B?.enemy??null, o: {mult?: number; all?: boolean; unblockable?: boolean}={}){const bt=B; if(!bt) return;
  const u=cur(),g0=geo();
  if(!e||e.dead) return;
  e.lunge=1;
  if(!u||u.dead||bt.pSpawn<1) return;
  const E=posOf(e), g={...g0,E:{x:E.x,y:E.y}};
  const em=elemMult(e.sp.el,u.sp.el), mult=o.mult??1;
  if(bt.parry>0&&o.unblockable) ftext(g.P.x,g.P.y-g.s*1.75,'Can’t parry!','#FF8A8A',22,1.1);
  if(bt.parry>0&&!o.unblockable){
    const hx=g.P.x+g.s*0.7, hy=g.P.y-g.s*0.35;
    ftext(g.P.x,g.P.y-g.s*1.4,'Parried!','#E7BE6E',26,1.2);
    fx({type:'impact',x:hx,y:hy,r:g.s*1.1,color:'#E7BE6E',rot:Math.random(),dur:0.35});
    burst(hx,hy,'#FFE3A0',30,380); SFX.play('parry'); buzz([15,30,25]);
    bt.hitstop=0.12; bt.flash=0.35; bt.flashCol='#E7BE6E'; e.kb=1; shake(0.5);
    u.energy=Math.min(100,u.energy+22);
    const cdmg=Math.max(1,Math.round(u.atk*0.8*elemMult(u.sp.el,e.sp.el)));
    // The counter goes back at whoever attacked, even if you were aiming elsewhere.
    bt.timers.push({t:0.12,fn:()=>{const u2=cur(); if(!e.dead&&u2&&!u2.dead){bt.lunge=1; const from=launchPoint(g0);
      fx({type:'shot',x0:from.x,y0:from.y,x1:E.x,y1:E.y-g.s*0.15*E.k,arc:16,r:g.s*0.3,el:u2.sp.el,color:ELEM[u2.sp.el].color,dur:0.16,end:()=>{if(!e.dead) hitEnemy(cdmg,1,'throw',e)}})}}});
    emit('parry');
    return;
  }
  if(rollDazeMiss(e.st)){ftext(g.P.x,g.P.y-g.s*1.2,'Miss!','#9FDCC0',22,0.9); SFX.play('guard'); return}
  u.energy=Math.min(100,u.energy+6);
  const dmg=Math.max(1,Math.round(e.atk*mult*em*rand(0.9,1.1)*damageDealtMult(e.st)*damageTakenMult(u.st)));
  u.hp-=dmg; u.flash=1; u.kb=1; shake(mult>1.5?1.1:0.6); bt.hitstop=mult>1.5?0.12:0.05; SFX.play('hurt'); if(mult>1.5) SFX.play('boom'); buzz(mult>1.5?[60,30,90]:45);
  if(o.all) bt.team.forEach(x=>{ if(x===u||x.dead) return;
    const d2=Math.max(1,Math.round(e.atk*mult*elemMult(e.sp.el,x.sp.el)*rand(0.9,1.1)*damageDealtMult(e.st)*damageTakenMult(x.st)));
    x.flash=1; damageUnit(x,d2,'#FF8A8A'); });
  if(bt.training) u.hp=Math.max(1,u.hp);
  emit('hurt');
  const drain=drainFrom(u.st);
  if(drain){e.hp=Math.min(e.maxHp,e.hp+Math.round(dmg*drain))}
  const toP=Math.atan2(g.P.y-g.E.y,g.P.x-g.E.x);
  slashFx(g.P.x,g.P.y-g.s*0.1,toP+Math.PI/2+rand(-0.4,0.4),ELEM[e.sp.el].color,e.sp.body,g.s*0.9,0.36);
  elemBurst(g.P.x,g.P.y,e.sp.el,14,260);
  ftext(g.P.x+rand(-20,20),g.P.y-g.s*0.6,String(dmg),'#FF8A8A',24);
  if(u.hp>0&&Math.random()<(e.boss||mult>1.5?STATUS.hitChance.boss:STATUS.hitChance.enemy)) inflictOnPlayer(e,u);
  if(u.hp<=0) unitDown(u);
}
/** One of the player's beasts was knocked out: switch to the next, or lose. */
function unitDown(u: Unit){const bt=B; if(!bt) return;
  const g=geo();
  if(u.dead) return;
  {
    u.hp=0; u.dead=true; bt.parry=0; cleanse(u.st);
    ftext(g.P.x,g.P.y-g.s*1.2,`${u.name} fell`,'#E0455A',18,1.2);
    bt.timers.push({t:0.8,fn:()=>{
      if(!cur()?.dead) return;
      const nx=bt.team.findIndex(x=>!x.dead);
      if(nx<0) defeat(); else {bt.active=nx;bt.pSpawn=0;}
    }});
  }
}
export function swapTo(i: number){const bt=B; if(!bt) return;
  if(!bt||bt.over||bt.swapCd>0||i===bt.active||!bt.team[i]||bt.team[i].dead) return;
  SFX.play('ui'); buzz(10);
  bt.active=i; bt.swapCd=1.2; bt.pSpawn=0; bt.parry=0; bt.cd=0; bt.buffered=null;
  emit('swap',i);
}
/** Seconds before a hit lands in which a parry works; longer with the relaxed-parry setting. */
export const parryW=()=>parryWindow(prefs);
export function parry(){const bt=B; if(!bt) return;
  if(!bt||bt.over||bt.parryCd>0) return;
  const u=cur(); if(!u||u.dead||bt.pSpawn<1) return;
  bt.parry=parryW(); bt.parryCd=0.75; bt.buffered=null; SFX.play('guard'); buzz(6);
}
export function victory(){const bt=B; if(!bt||!bt.plan) return;
  const plan=bt.plan;
  bt.over=true; SFX.play('win'); buzz([20,40,20,40,60]);
  const ko=bt.team.filter(u=>u.dead).length, secs=Math.round(bt.time);
  const stars=starsFor(true,ko,secs,plan.par);
  const before=save.campaign.stars[plan.id]??0;
  const first=recordClear(save.campaign,plan,stars);
  const bonus=first?firstClearBonus(plan):{shards:0,gold:0};
  save.shards+=bt.earned+bonus.shards; save.gold+=bt.gold+bonus.gold;
  bt.drops.forEach(k=>newCard(save,k));
  const ups: string[]=[];
  const xp=40+8*plan.difficulty;
  teamMembers().forEach(m=>{if(addXp(m,xp)) ups.push(`${nameOf(m)} reached <b>Lv ${m.lvl}</b>${m.lvl>=capOf(m)?' (max)':''}`)});
  const next=nextMain(plan);
  save.campaign.view={circle:next.circle,region:plan.kind==='gate'?0:plan.region};
  if(plan.kind==='gate') save.campaign.view={circle:plan.circle+1,region:0};
  persist();
  const check=(ok: boolean,t: string)=>`<li class="${ok?'ok':'no'}">${ok?'✓':'✗'} ${t}</li>`;
  const drops=bt.drops.length?`<li>Card drops: <b>${bt.drops.map(k=>SPECIES[k].name).join(', ')}</b></li>`:'';
  const chest=plan.kind!=='gate'&&openableChests(save.campaign,plan.circle,plan.region).length?'<li class="gold">A chest is ready on the map.</li>':'';
  const canNext=stageUnlocked(save.campaign,next);
  const np=canNext?planStage(next):null;
  $('#resultBox').innerHTML=`<h2>${plan.kind==='gate'?'The Gate opens':'Stage cleared'}</h2>
    <div class="rstars" aria-label="${stars} of 3 stars">${[1,2,3].map(i=>`<span class="${i<=stars?'on':''}" style="animation-delay:${0.15+i*0.25}s">★</span>`).join('')}</div>
    <p class="rname">${plan.label} · ${plan.name}${stars>before&&before>0?' · <b>New best</b>':''}</p>
    <ul class="rcrit">${check(true,'Cleared')}${check(ko===0,'No beast knocked out')}${check(secs<=plan.par,`Under ${plan.par}s (${secs}s)`)}</ul>
    <ul><li><b>+${bt.earned+bonus.shards}</b> soul shards · <b>+${bt.gold+bonus.gold}</b> gold${first?' <span class="gold">(first clear bonus)</span>':''}</li>${drops}<li>Team gained <b>${xp} XP</b></li>${ups.map(x=>`<li>${x}</li>`).join('')}${chest}</ul>
    <div class="btns"><button id="rHome">Map</button><button class="primary" id="rNext">${np?`Next: ${np.label}`:'Replay'}</button></div>`;
  $('#result').hidden=false;
  $('#rHome').onclick=()=>endBattle();
  $('#rNext').onclick=()=>startBattle({plan:np??plan});
}
/** The training fight is won: fixed rewards, then on to the rest of the tutorial. */
function trainingComplete(){const bt=B; if(!bt) return;
  bt.over=true; SFX.play('win'); buzz([20,40,20,40,60]);
  save.shards+=TRAINING_REWARD.shards; save.gold+=TRAINING_REWARD.gold; persist();
  $('#resultBox').innerHTML=`<h2>Training complete</h2><ul><li><b>+${TRAINING_REWARD.shards}</b> soul shards · <b>+${TRAINING_REWARD.gold}</b> gold</li><li>Next: summon your first beast.</li></ul>
    <div class="btns" style="grid-template-columns:1fr"><button class="primary" id="rNext">Continue</button></div>`;
  $('#result').hidden=false;
  $('#rNext').onclick=()=>{endBattle(); emit('trainingDone')};
}
/** Leave the battle: back to the map from a campaign stage, home from training. */
export function endBattle(){const toMap=!!B?.plan; B=null; show(toMap?'map':'home')}
export function defeat(){const bt=B; if(!bt) return;
  bt.over=true; SFX.play('lose'); buzz(200);
  const kept=Math.floor(bt.earned/2), keptG=Math.floor(bt.gold/2); save.shards+=kept; save.gold+=keptG;
  bt.drops.forEach(k=>newCard(save,k)); persist();
  $('#resultBox').innerHTML=`<h2 class="lose">Your team fell</h2><ul><li>Kept <b>${kept}</b> soul shards and <b>${keptG}</b> gold${bt.drops.length?` plus ${bt.drops.length} card drop${bt.drops.length>1?'s':''}`:''}</li><li>Tip: swipe down when the closing ring turns gold to parry and counter.</li></ul>
    <div class="btns"><button id="rHome">Map</button><button class="primary" id="rNext">Retry</button></div>`;
  $('#result').hidden=false;
  const plan=bt.plan;
  $('#rHome').onclick=()=>endBattle(); $('#rNext').onclick=()=>startBattle({plan});
}
let retreatArm=0;
const retreatBtn=$('#btnRetreat');
retreatBtn.addEventListener('click',()=>{
  const training=!!B?.training;
  if(Date.now()-retreatArm<2500){endBattle(); if(training) emit('skipTutorial'); return}
  retreatArm=Date.now(); retreatBtn.textContent=training?'Tap again to skip':'Tap again to retreat';
  setTimeout(()=>{if(Date.now()-retreatArm>=2400)retreatBtn.textContent=training?'Skip tutorial':'Retreat'},2500);
});

/** An enemy begins an attack: an ordinary hit, or for bosses sometimes a signature move. */
function startWindup(e: Enemy){const bt=B; if(!bt) return;
  const act=e.kit?chooseAttack(e.kit,Math.random):'normal';
  const tp=e.kit?tempoFor(e.kit):{windup:1,rest:1};
  e.move=act==='normal'?null:act;
  // Spirits, birds and dragons throw their ordinary attacks; the shot's flight adds warning time.
  e.shoots=!e.move&&!bt.training&&isRanged(e.sp.body);
  e.wlen=(e.move?MOVES[e.move].windup:e.windup*(e.shoots?ENEMY_SHOT.windup:1))*tp.windup;
  e.state='windup'; e.timer=e.wlen; e.ticked=false; e.breakDmg=0;
  if(e.move==='barrage') e.hitsLeft=MOVES.barrage.hits;
  SFX.play('warn');
  if(e.move){
    const g=geo();
    ftext(g.w/2,g.h*0.14,MOVE_NAMES[e.sp.el][e.move],ELEM[e.sp.el].color,26,Math.min(2.2,e.wlen+0.6));
    if(!bt.hinted.includes(e.move)){bt.hinted.push(e.move); ftext(g.w/2,g.h*0.14+30,MOVE_HINT[e.move],'#F0E8F5',Math.min(16,g.w/24),Math.max(2.4,e.wlen+0.8))}
    if(e.move==='smash') SFX.play('charge');
    emit('bossMove',e.move);
  }
}
/** The wind-up ends and the attack lands; a barrage keeps going until its strikes run out. */
function resolveAttack(e: Enemy){const bt=B; if(!bt) return;
  const m=e.move;
  if(m==='sweep') enemyStrike(e,{mult:MOVES.sweep.mult,all:true});
  else if(m==='smash') enemyStrike(e,{mult:MOVES.smash.mult,unblockable:true});
  else if(m==='barrage') enemyStrike(e,{mult:MOVES.barrage.mult});
  else if(e.shoots) launchEnemyShot(e);
  else enemyStrike(e);
  if(!B||e.dead) return;
  if(m==='barrage'&&(e.hitsLeft=(e.hitsLeft||1)-1)>0&&e.state==='windup'){e.wlen=MOVES.barrage.gap; e.timer=e.wlen; e.ticked=false; return}
  const tp=e.kit?tempoFor(e.kit):{windup:1,rest:1};
  e.state='idle'; e.move=null;
  e.timer=rand(1.7,2.7)/e.sp.spd*(e.boss?0.85:1)*tp.rest*(1+0.35*(e.group-1));
}

/** Gravity per particle kind (negative rises). */
const GRAV: Record<ParticleKind, number>={spark:380,ember:-90,drop:760,leaf:120,shard:420,dust:650,mote:-50};
export function updateBattle(dt){const bt=B; if(!bt) return;
  bt.flash=Math.max(0,bt.flash-dt*2.2); bt.shake=Math.max(0,bt.shake-dt*3);
  if(bt.hitstop>0){bt.hitstop-=dt; return;}
  bt.time+=dt;
  const au=cur();
  bt.cd=Math.max(0,bt.cd-dt*(au?tempo(au.st):1)); bt.swapCd=Math.max(0,bt.swapCd-dt);
  bt.lunge=Math.max(0,bt.lunge-dt/0.22);
  bt.pSpawn=Math.min(1,bt.pSpawn+dt/0.45);
  bt.parry=Math.max(0,bt.parry-dt); bt.parryCd=Math.max(0,bt.parryCd-dt);
  if(bt.cd===0&&bt.buffered){const k=bt.buffered;bt.buffered=null;playerAct(k.kind,k.o)}
  bt.team.forEach(u=>{u.flash=Math.max(0,u.flash-dt*5); u.kb=Math.max(0,(u.kb||0)-dt*5); if(u.dead)u.fade=Math.max(0,u.fade-dt*1.6)});
  for(let i=bt.timers.length-1;i>=0;i--){const tm=bt.timers[i]; tm.t-=dt; if(tm.t<=0){bt.timers.splice(i,1); tm.fn(); if(!bt) return;}}
  // Status effects: count down, and apply damage over time in half-second pulses.
  const g=geo();
  bt.team.forEach(u=>{
    if(u.dead) return;
    u.dotAcc+=tickStatus(u.st,dt); u.dotT-=dt;
    if(u.dotT<=0){u.dotT=0.5; if(u.dotAcc>=1){const n=Math.floor(u.dotAcc); u.dotAcc-=n; damageUnit(u,n,u.st.poison?'#A7D46F':'#FF8A3D')}}
  });
  bt.foes.forEach(e=>{
    if(e.dead) return;
    e.dotAcc+=tickStatus(e.st,dt); e.dotT-=dt;
    if(e.dotT<=0){e.dotT=0.5; if(e.dotAcc>=1){const n=Math.floor(e.dotAcc); e.dotAcc-=n; damageEnemy(e,n,e.st.poison?'#A7D46F':'#FF8A3D')}}
  });
  if(!B) return;
  // Ambient particles so ailments are visible on the field.
  if(Math.random()<dt*6){
    const pairs: [StatusState,number,number][]=[];
    bt.foes.forEach(f=>{if(!f.dead){const p=posOf(f); pairs.push([f.st,p.x,p.y])}});
    if(au&&!au.dead) pairs.push([au.st,g.P.x,g.P.y]);
    pairs.forEach(([st,x,y])=>{
      if(st.burn) elemBurst(x+rand(-1,1)*g.s*0.5,y,'pyre',1,60,0.8);
      if(st.poison) elemBurst(x+rand(-1,1)*g.s*0.5,y,'thorn',1,40,0.6);
      if(st.soak) elemBurst(x+rand(-1,1)*g.s*0.6,y-g.s*0.6,'tide',1,30,-0.5);
      if(st.curse) elemBurst(x+rand(-1,1)*g.s*0.5,y,'umbral',1,40,0.7);
    });
  }
  // Enemy shots in flight: they land on your beast when they arrive (enemyStrike checks for a parry).
  for(let i=bt.incoming.length-1;i>=0;i--){
    const sh=bt.incoming[i], from=sh.from as Enemy;
    if(from.dead||!bt.foes.includes(from)){bt.incoming.splice(i,1); continue}
    sh.t+=dt;
    if(Math.random()<0.6){const p=shotPos(sh); elemBurst(p.x,p.y,sh.el,1,40,0)}
    if(!sh.ticked&&sh.dur-sh.t<=parryW()){sh.ticked=true; SFX.play('window')}
    if(sh.t>=sh.dur){bt.incoming.splice(i,1); enemyStrike(from); if(!B) return;}
  }
  for(const e of bt.foes){
    e.flash=Math.max(0,e.flash-dt*5); e.lunge=Math.max(0,e.lunge-dt/0.25); e.kb=Math.max(0,(e.kb||0)-dt*5);
    if(e.dead){e.fade=Math.max(0,e.fade-dt*1.4); continue}
    e.spawn=Math.min(1,e.spawn+dt/0.6);
    if(e.spawn<1||bt.over||cur()?.dead||(bt.training&&!bt.training.enemyActs)) continue;
    if(e.roar&&e.roar>0){e.roar-=dt; continue}
    e.timer-=dt*tempo(e.st);
    if(e.state==='idle'&&e.timer<=0){
      // One attacker at a time, so every wind-up can be read and parried.
      if(bt.incoming.length||bt.foes.some(f=>f!==e&&!f.dead&&f.state==='windup')){e.timer=0.35; continue}
      startWindup(e);
    }
    else if(e.state==='windup'&&!e.ticked&&e.move!=='smash'&&!e.shoots&&e.timer<=parryW()){e.ticked=true;SFX.play('window')}
    else if(e.state==='windup'&&e.timer<=0){resolveAttack(e); if(!B) return;}
  }
  const ended: Fx[]=[];
  bt.fx.forEach(f=>{
    f.t+=dt;
    if(f.type==='shot'&&Math.random()<0.8){const p=shotPos(f); pushPart({x:p.x+rand(-3,3),y:p.y+rand(-3,3),vx:rand(-40,40),vy:rand(-40,20),life:rand(.2,.4),max:.4,color:pick(PCOLS[f.el as ElementKey]),r:rand(1.5,3.5),kind:PKIND[f.el as ElementKey],rot:rand(0,6),vr:rand(-9,9)})}
    if(f.type==='fireball'){const p=fbPos(f); for(let i=0;i<3;i++) pushPart({x:p.x+rand(-5,5),y:p.y+rand(-5,5),vx:rand(-50,50),vy:rand(-60,10),life:rand(.25,.5),max:.5,color:pick(PCOLS.pyre),r:rand(2.5,5.5),kind:'ember',rot:0,vr:0});}
    if(f.type==='tornado'&&f.t/f.dur<0.85){const xc=tornadoX(f); pushPart({x:xc+rand(-1,1)*f.s*0.8,y:f.base-rand(0,f.h),vx:rand(-140,140),vy:rand(-80,20),life:.5,max:.5,color:pick(PCOLS.gale),r:rand(2,4),kind:'leaf',rot:rand(0,6),vr:rand(-12,12)});}
    if(f.type==='void'&&f.t/f.dur<0.7){const an=Math.random()*Math.PI*2,R=f.r*1.6; pushPart({x:f.x+Math.cos(an)*R,y:f.y+Math.sin(an)*R,vx:-Math.cos(an)*R*2.2,vy:-Math.sin(an)*R*2.2,life:.42,max:.42,color:pick(PCOLS.umbral),r:rand(2,4),kind:'mote',rot:0,vr:0});}
    if(f.type==='wave'&&f.t/f.dur<0.85){const xc=waveX(f); for(let i=0;i<2;i++) pushPart({x:xc+rand(-.3,.9)*f.s,y:f.base-f.h*rand(0.7,1.0),vx:rand(40,180),vy:rand(-180,-40),life:.6,max:.6,color:pick(PCOLS.tide),r:rand(2,4),kind:'drop',rot:0,vr:0});}
    if(f.t>=f.dur) ended.push(f);
  });
  bt.fx=bt.fx.filter(f=>f.t<f.dur); ended.forEach(f=>f.end&&f.end());
  bt.parts.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(GRAV[p.kind]||380)*dt;p.vx*=p.kind==='leaf'?0.95:0.98;
    if(p.kind==='leaf'){p.vx+=Math.sin(bt.time*7+p.rot)*60*dt;p.vy=Math.min(p.vy,90)} if(p.kind==='ember')p.vy*=0.97;
    p.rot+=p.vr*dt;p.life-=dt}); bt.parts=bt.parts.filter(p=>p.life>0);
  bt.texts.forEach(t=>{t.y-=38*dt;t.life-=dt}); bt.texts=bt.texts.filter(t=>t.life>0);
  bt.trail=bt.trail.filter(p=>bt.time-p.t<0.22);
}


/**
 * A ghost finger that loops the gesture the tutorial is teaching: a pulsing
 * tap, a flick from your beast toward the enemy, a hold-then-flick, or a swipe
 * down beside your beast.
 */
function drawDemo(c: CanvasRenderingContext2D, g: ReturnType<typeof geo>, demo: Demo, t: number){
  const charge=demo==='charge', period=charge?2.4:1.6, p=(t%period)/period, s=g.s;
  const cx=g.w*0.5, cy=g.h*0.5;
  let x0=cx, y0=cy, x1=cx, y1=cy;
  if(demo==='throw'||charge){x0=g.P.x+s*0.2; y0=g.P.y-s*0.1; x1=x0+(g.E.x-x0)*0.55; y1=y0+(g.E.y-y0)*0.55}
  else if(demo==='down'){x0=g.P.x+s*1.7; y0=g.P.y-s*1.5; x1=g.P.x+s*1.7; y1=g.P.y+s*0.1}
  const move=demo!=='tap';
  // Timeline: fade in, (hold to charge), act, fade out.
  const hold=charge?0.45:0, a0=0.15+hold, a1=a0+(charge?0.2:0.45);
  const act=clamp((p-a0)/(a1-a0),0,1), k=ease(act);
  const x=move?x0+(x1-x0)*k:x0, y=move?y0+(y1-y0)*k:y0;
  const alpha=p<0.15?p/0.15:(p>0.8?clamp((1-p)/0.2,0,1):1);
  c.save(); c.globalAlpha=alpha*0.9;
  if(charge&&p>=0.15&&p<a0){
    // The ring filling while the finger holds still.
    const f=clamp((p-0.15)/hold,0,1); c.lineWidth=5; c.strokeStyle='rgba(255,236,190,0.85)';
    c.beginPath(); c.arc(x0,y0,s*0.6,-Math.PI/2,-Math.PI/2+Math.PI*2*f); c.stroke();
  }
  if(move&&act>0){
    const tx=x0+(x1-x0)*Math.max(0,k-0.35), ty=y0+(y1-y0)*Math.max(0,k-0.35);
    const gr=c.createLinearGradient(tx,ty,x,y); gr.addColorStop(0,'rgba(231,190,110,0)'); gr.addColorStop(1,'rgba(255,236,190,0.85)');
    c.strokeStyle=gr; c.lineWidth=s*0.16; c.lineCap='round';
    c.beginPath(); c.moveTo(tx,ty); c.lineTo(x,y); c.stroke();
  }
  if(!move&&act>0&&act<1){
    c.strokeStyle=`rgba(255,236,190,${1-act})`; c.lineWidth=3;
    ell(c,x,y,s*(0.25+act*0.9),s*(0.25+act*0.9)); c.stroke();
  }
  const press=(!move&&act>0&&act<0.3)||(charge&&p>=0.15&&p<a0)?0.8:1;
  c.fillStyle='rgba(231,190,110,0.28)'; ell(c,x,y,s*0.34*press,s*0.34*press); c.fill();
  c.fillStyle='rgba(255,246,225,0.92)'; c.shadowColor='#E7BE6E'; c.shadowBlur=14;
  ell(c,x,y,s*0.16*press,s*0.16*press); c.fill();
  c.restore();
}

/** A block of ice over a frozen beast. */
function drawIce(c: CanvasRenderingContext2D, x: number, y: number, s: number, t: number){
  c.save(); c.translate(x,y-s*0.15);
  const g=c.createLinearGradient(-s,-s*1.1,s,s*0.9);
  g.addColorStop(0,'rgba(220,248,255,0.55)'); g.addColorStop(0.5,'rgba(143,211,232,0.35)'); g.addColorStop(1,'rgba(90,160,210,0.5)');
  c.fillStyle=g; c.strokeStyle='rgba(255,255,255,0.85)'; c.lineWidth=2;
  c.beginPath(); c.moveTo(-s*0.95,-s*0.9); c.lineTo(s*0.2,-s*1.2); c.lineTo(s*1.0,-s*0.7); c.lineTo(s*0.95,s*0.9); c.lineTo(-s*0.3,s*1.05); c.lineTo(-s*1.05,s*0.6); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle=`rgba(255,255,255,${0.4+0.3*Math.sin(t*4)})`; c.lineWidth=3;
  c.beginPath(); c.moveTo(-s*0.6,-s*0.7); c.lineTo(-s*0.2,-s*0.2); c.moveTo(s*0.5,-s*0.6); c.lineTo(s*0.7,-s*0.1); c.stroke();
  c.restore();
}
export function drawBattle(){const bt=B; if(!bt) return;
  const f=fit(fieldCv); if(!f) return; const {c,w,h}=f; const g=geo(); const s=g.s; const t=bt.time;
  c.clearRect(0,0,w,h);
  c.save();
  if(bt.shake>0){c.translate(rand(-1,1)*bt.shake*10,rand(-1,1)*bt.shake*8)}
  const A=themeById(prefs.theme).arena;
  let gr=c.createLinearGradient(0,0,0,h); gr.addColorStop(0,A.skyTop); gr.addColorStop(0.46,A.horizon); gr.addColorStop(0.461,A.groundTop); gr.addColorStop(1,A.groundBottom);
  c.fillStyle=gr; c.fillRect(-20,-20,w+40,h+40);
  gr=c.createRadialGradient(w*0.5,h*0.46,0,w*0.5,h*0.46,w*0.7); gr.addColorStop(0,`rgba(${A.glow},0.18)`); gr.addColorStop(1,`rgba(${A.glow},0)`);
  c.fillStyle=gr; c.fillRect(0,0,w,h);
  c.fillStyle=A.spires;
  [[0.06,0.2,0.05],[0.16,0.28,0.035],[0.8,0.16,0.06],[0.92,0.3,0.04],[0.44,0.36,0.025]].forEach(([x,top,wd])=>{
    c.beginPath(); c.moveTo(w*(x-wd),h*0.461); c.lineTo(w*(x-wd*0.6),h*(top+0.04)); c.lineTo(w*x,h*top); c.lineTo(w*(x+wd*0.6),h*(top+0.04)); c.lineTo(w*(x+wd),h*0.461); c.fill();});
  c.strokeStyle=`rgba(${A.lines},0.06)`; c.lineWidth=1;
  for(let i=-6;i<=6;i++){c.beginPath(); c.moveTo(w*0.5,h*0.461); c.lineTo(w*0.5+i*w*0.3,h); c.stroke();}
  bt.embers.forEach(m=>{m.y-=m.v*0.016; if(m.y<0){m.y=1;m.x=Math.random()}
    c.fillStyle=`rgba(${A.embers},${0.25+0.25*Math.sin(t*2+m.ph)})`; ell(c,m.x*w+Math.sin(t+m.ph)*6,m.y*h,m.r,m.r); c.fill();});
  const u=cur();
  const attacker=bt.foes.find(f=>!f.dead&&f.state==='windup');
  // A charging smash darkens the arena until it lands or breaks.
  if(attacker?.move==='smash'){const pr=clamp(1-attacker.timer/attacker.wlen,0,1); c.fillStyle=`rgba(40,0,12,${0.35*pr*flashScale(prefs)+0.08})`; c.fillRect(-20,-20,w+40,h+40)}
  const many=alive().length>1;
  // Back row first, so nearer enemies overlap farther ones.
  [...bt.foes].sort((a,b)=>posOf(a).y-posOf(b).y).forEach(e=>{
    if(e.fade<=0) return;
    const E=posOf(e), es=(e.ruler?1.35:e.boss?1.25:1)*E.k;
    if(!e.dead) drawSigil(c,E.x,E.y+s*0.86*E.k,s*1.35*E.k,0.3,ELEM[e.sp.el].color,t*0.4,0.55);
    const vx=E.x-g.P.x, vy=E.y-g.P.y, vd=Math.hypot(vx,vy)||1, ux=vx/vd, uy=vy/vd;
    const ph=e.lunge>0?Math.sin((1-e.lunge)*Math.PI):0;
    const kb=e.kb||0, kbo=Math.sin(kb*Math.PI*0.5)*s*0.4;
    const ox=-vx*0.28*ph+ux*kbo, oy=-vy*0.28*ph+uy*kbo;
    let wob=0, red=0;
    if(e.state==='windup'){const pr=clamp(1-e.timer/e.wlen,0,1); red=pr; wob=Math.sin(t*50)*s*(e.move==='smash'?0.06:0.03)*pr}
    if(e.roar&&e.roar>0) wob=Math.sin(t*70)*s*0.05;
    const sc=(e.dead?0.6+0.4*e.fade:0.6+0.4*e.spawn)*es;
    const glowA=e.kit?0.55+0.15*e.kit.phase+0.15*Math.sin(t*4):0.7;
    drawMonster(c,e.key,E.x+ox+wob,E.y+oy,s,t*(e.sp.spd)+1.7+e.slot,{dir:-1,evo:e.evo,flash:e.flash,red,alpha:e.dead?e.fade:e.spawn,scale:sc,sx:1+0.14*kb,sy:1-0.12*kb,glow:e.boss?rgba(ELEM[e.sp.el].color,glowA):null});
    if(e.st.freeze&&!e.dead) drawIce(c,E.x+ox,E.y+oy,s*es,t);
    if(e.dead) return;
    const top=E.y-s*1.55*es;
    if(many&&e===bt.enemy){
      // Target marker: a gold chevron bobbing over its head.
      const by=top-s*0.28+Math.sin(t*5)*3;
      c.fillStyle='#E7BE6E'; c.strokeStyle='rgba(12,8,16,0.85)'; c.lineWidth=2;
      c.beginPath(); c.moveTo(E.x-s*0.18,by-s*0.12); c.lineTo(E.x,by+s*0.06); c.lineTo(E.x+s*0.18,by-s*0.12); c.lineTo(E.x,by-0.02*s); c.closePath(); c.stroke(); c.fill();
    }
    if(e.state==='windup'){
      c.font=`800 ${Math.round(s*0.6*Math.max(0.8,E.k))}px ${getComputedStyle(document.body).getPropertyValue('--display')}`; c.textAlign='center'; c.fillStyle=e.move==='smash'?'#FF3B4E':'#FF5A64';
      c.fillText(e.move==='smash'?'!!':'!',E.x+(many&&e===bt.enemy?s*0.35:0),top);
    }
    if(e.move==='smash'&&e.state==='windup'){
      // Break meter: fills as you hit the boss during its charge.
      const bw=s*1.5, bx=E.x-bw/2, byy=E.y+s*0.95*es, k=clamp((e.breakDmg||0)/(e.maxHp*MOVES.smash.breakShare),0,1);
      c.fillStyle='rgba(12,8,16,0.85)'; c.fillRect(bx-2,byy-2,bw+4,10);
      c.fillStyle='#FFE3A0'; c.fillRect(bx,byy,bw*k,6);
      c.font=`700 11px 'Sigil UI', 'Barlow Semi Condensed', sans-serif`; c.fillStyle='#FFE3A0'; c.textAlign='center'; c.fillText('BREAK',E.x,byy+18);
    }
    if(e.move==='barrage'&&e.state==='windup'){
      for(let i=0;i<(e.hitsLeft||0);i++){c.fillStyle='#FF8A8A'; ell(c,E.x+(i-((e.hitsLeft||1)-1)/2)*s*0.28,E.y+s*1.0*es,s*0.08,s*0.08); c.fill();}
    }
  });
  if(u) drawSigil(c,g.P.x,g.P.y+s*0.86,s*1.35,0.3,ELEM[u.sp.el].color,-t*0.4,0.55);
  if(u&&u.fade>0){
    const vx=g.E.x-g.P.x, vy=g.E.y-g.P.y, vd=Math.hypot(vx,vy)||1, ux=vx/vd, uy=vy/vd;
    const ph=bt.lunge>0?Math.sin((1-bt.lunge)*Math.PI):0;
    const kb=u.kb||0, kbo=Math.sin(kb*Math.PI*0.5)*s*0.35;
    const ox=vx*0.3*ph-ux*kbo, oy=vy*0.3*ph-uy*kbo;
    const sc=0.6+0.4*bt.pSpawn;
    drawMonster(c,u.m.sp,g.P.x+ox,g.P.y+oy,s,t*u.sp.spd,{dir:1,evo:u.evo,flash:u.flash,alpha:u.dead?u.fade:bt.pSpawn,scale:sc,sx:1+0.12*kb,sy:1-0.1*kb});
    if(u.st.freeze&&!u.dead) drawIce(c,g.P.x+ox,g.P.y+oy,s,t);
    if(bt.parry>0&&!u.dead){
      c.save(); c.globalAlpha=Math.min(1,bt.parry/parryW()*1.5); c.translate(g.P.x+s*0.55,g.P.y-s*0.1);
      c.strokeStyle='rgba(231,190,110,0.9)'; c.lineWidth=4; c.shadowColor='#E7BE6E'; c.shadowBlur=14;
      c.beginPath(); c.arc(-s*0.6,0,s*1.25,-0.9,0.9); c.stroke();
      c.fillStyle='rgba(231,190,110,0.12)'; c.beginPath(); c.arc(-s*0.6,0,s*1.25,-0.9,0.9); c.arc(-s*0.6,0,s*1.05,0.9,-0.9,true); c.fill();
      c.restore();
    }
    if(u.energy>=100&&!u.dead){c.strokeStyle=rgba('#E7BE6E',0.35+0.25*Math.sin(t*6));c.lineWidth=2;ell(c,g.P.x,g.P.y,s*1.15,s*1.15);c.stroke();}
  }
  // What's about to hit you: a wind-up, or a shot in the air.
  const inc=bt.incoming[0];
  const threat=attacker&&!attacker.shoots?{left:attacker.timer,len:attacker.wlen,move:attacker.move}:inc?{left:inc.dur-inc.t,len:inc.dur,move:null}:null;
  if(threat&&u&&!u.dead){
    const e=threat, pr=clamp(1-e.left/e.len,0,1);
    if(e.move==='smash'){
      // Unblockable: the ring never turns gold, and a cross marks it.
      c.lineWidth=3; c.strokeStyle='rgba(255,59,78,0.6)'; c.setLineDash([4,6]); ell(c,g.P.x,g.P.y,s*1.05,s*1.05); c.stroke(); c.setLineDash([]);
      c.lineWidth=4+pr*3; c.strokeStyle=`rgba(255,59,78,${0.45+0.55*pr})`; ell(c,g.P.x,g.P.y,s*(2.5-1.45*pr),s*(2.5-1.45*pr)); c.stroke();
      const xr=s*0.22, xx=g.P.x+s*1.25, xy=g.P.y-s*1.1; c.lineWidth=4; c.strokeStyle='#FF3B4E';
      c.beginPath(); c.moveTo(xx-xr,xy-xr); c.lineTo(xx+xr,xy+xr); c.moveTo(xx+xr,xy-xr); c.lineTo(xx-xr,xy+xr); c.stroke();
    } else {
      const open=e.left<=parryW();
      c.lineWidth=open?3:2; c.strokeStyle=open?'rgba(231,190,110,0.95)':'rgba(231,190,110,0.5)'; c.setLineDash(open?[]:[4,6]);
      ell(c,g.P.x,g.P.y,s*1.05,s*1.05); c.stroke(); c.setLineDash([]);
      c.lineWidth=3+pr*2; c.strokeStyle=open?`rgba(255,214,130,${0.6+0.4*pr})`:`rgba(224,69,90,${0.35+0.6*pr})`;
      ell(c,g.P.x,g.P.y,s*(2.5-1.45*pr),s*(2.5-1.45*pr)); c.stroke();
      if(e.move==='sweep'){
        // A wide arc along the ground: this one hits the whole team.
        c.lineWidth=3; c.strokeStyle=open?'rgba(255,214,130,0.7)':`rgba(224,69,90,${0.3+0.5*pr})`;
        c.beginPath(); c.ellipse(g.w*0.5,g.h*0.86,g.w*0.48,g.h*0.1,0,Math.PI*1.05,Math.PI*1.95); c.stroke();
      }
    }
  }
  bt.incoming.forEach(sh=>drawShot(c,sh));
  drawHoldCharge(c,g,u,t);
  bt.fx.forEach(fo=>{const d=FXDRAW[fo.type]; if(d) d(c,fo)});
  if(bt.training?.demo&&!bt.over) drawDemo(c,g,bt.training.demo,bt.time);
  if(bt.trail.length>1){
    const col=u?ELEM[u.sp.el].color:'#FFFFFF', n=bt.trail.length;
    const pts=bt.trail.map(p=>({x:p.x,y:p.y}));
    const ws=bt.trail.map((p,i)=>{const k=clamp(1-(bt.time-p.t)/0.22,0,1); return (1+9*k)*(0.3+0.7*i/(n-1));});
    c.save(); c.globalCompositeOperation='lighter';
    c.fillStyle=rgba(col,0.75); c.shadowColor=col; c.shadowBlur=16; ribbon(c,pts,ws); c.fill();
    c.shadowBlur=0; c.fillStyle='rgba(255,248,235,0.9)'; ribbon(c,pts,ws.map(x=>x*0.35)); c.fill();
    c.restore();
  }
  bt.parts.forEach(p=>{const a=clamp(p.life/p.max,0,1); c.globalAlpha=a;
    if(p.kind==='leaf'){c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.fillStyle=p.color;ell(c,0,0,p.r*1.6,p.r*0.7);c.fill();c.restore();}
    else if(p.kind==='drop'){c.fillStyle=p.color;ell(c,p.x,p.y,p.r,p.r*1.25);c.fill();c.fillStyle='rgba(255,255,255,.8)';ell(c,p.x-p.r*0.3,p.y-p.r*0.4,p.r*0.3,p.r*0.3);c.fill();}
    else if(p.kind==='ember'){c.save();c.globalCompositeOperation='lighter';c.fillStyle=p.color;const r=p.r*(0.4+0.6*a);ell(c,p.x,p.y,r,r);c.fill();c.restore();}
    else if(p.kind==='shard'){c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.fillStyle=p.color;c.beginPath();c.moveTo(0,-p.r*1.6);c.lineTo(p.r*0.6,0);c.lineTo(0,p.r*1.6);c.lineTo(-p.r*0.6,0);c.closePath();c.fill();c.restore();}
    else if(p.kind==='dust'){c.fillStyle=p.color;c.fillRect(p.x-p.r,p.y-p.r,p.r*2,p.r*2);}
    else {c.fillStyle=p.color;ell(c,p.x,p.y,p.r,p.r);c.fill();}
  }); c.globalAlpha=1;
  c.textAlign='center'; c.textBaseline='middle';
  bt.texts.forEach(tx=>{const k=tx.life/tx.max; c.globalAlpha=clamp(k*2,0,1);
    const sz=tx.size*(k>0.85?1+(k-0.85)*2:1);
    c.font=`700 ${sz}px 'Sigil UI', 'Barlow Semi Condensed', 'Arial Narrow', sans-serif`;
    c.lineWidth=4; c.strokeStyle='rgba(12,8,16,0.9)'; c.strokeText(tx.txt,tx.x,tx.y); c.fillStyle=tx.color; c.fillText(tx.txt,tx.x,tx.y);});
  c.globalAlpha=1;
  c.restore();
  if(bt.flash>0){c.fillStyle=rgba(bt.flashCol||'#FFFFFF',Math.min(0.5,bt.flash*0.6)*flashScale(prefs)); c.fillRect(0,0,w,h);}
}

/** Buttons for each enemy in a group, to see their health and switch targets. */
function renderFoes(bt: Battle){
  const box=hud.eFoes, show=bt.foes.length>1;
  box.hidden=!show; if(!show) return;
  if(box.childElementCount!==bt.foes.length){
    box.innerHTML=bt.foes.map((f,i)=>`<button class="foe" data-f="${i}"><span class="fdot" style="background:${ELEM[f.sp.el].color}"></span><span class="fname">${f.name}</span><span class="bar sm enemy"><i></i></span></button>`).join('');
  }
  [...box.children].forEach((b,i)=>{const f=bt.foes[i], el=b as HTMLButtonElement; if(!f) return;
    el.classList.toggle('on',f===bt.enemy); el.classList.toggle('busy',f.state==='windup'&&!f.dead); el.disabled=f.dead;
    el.setAttribute('aria-label',`Target ${f.name}${f.dead?', defeated':''}`); el.setAttribute('aria-pressed',String(f===bt.enemy));
    (el.querySelector('i') as HTMLElement).style.width=(100*Math.max(0,f.hp)/f.maxHp)+'%';});
}
export const hud={eFoes:$('#eFoes'),ePh:$('#ePh'),eName:$('#eName'),eLvl:$('#eLvl'),eEl:$('#eEl'),eBoss:$('#eBoss'),eHp:$('#eHp'),eHpT:$('#eHpT'),pName:$('#pName'),pLvl:$('#pLvl'),pEl:$('#pEl'),pHp:$('#pHp'),pHpT:$('#pHpT'),pEn:$('#pEn'),eReady:$('#eReady'),pPanel:$('#pPanel'),stage:$('#bStage'),eMu:$('#eMu'),eSt:$('#eSt'),pSt:$('#pSt')};
export function setText(el: HTMLElement,v: string){if(el.textContent!==v)el.textContent=v}
/** Status chips, e.g. "Burn 3s" or "Poison x2 5s", colored by element. */
function renderStatus(el: HTMLElement, st: StatusState){
  const html=statusList(st).map(({key,t,stacks})=>{const info=STATUS_INFO[key];
    return `<span style="color:${ELEM[info.el].color}">${info.label}${stacks&&stacks>1?' x'+stacks:''} ${Math.ceil(t)}s</span>`}).join('');
  if(el.innerHTML!==html) el.innerHTML=html;
}
export function updateHud(){const bt=B; if(!bt) return;
  const e=bt.enemy,u=cur();
  setText(hud.stage,bt.training||!bt.plan?'Training':`${bt.plan.label} · Wave ${bt.wave}/3`);
  if(e){setText(hud.eName,e.name); setText(hud.eLvl,'Lv '+e.lvl); setText(hud.eEl,ELEM[e.sp.el].name); hud.eEl.className='chip '+e.sp.el; hud.eBoss.hidden=!e.boss;
    setText(hud.eBoss,e.kit?(e.kit.tier==='warden'?'Warden':'Boss'):'Leader');
    hud.eHp.style.width=(100*Math.max(0,e.hp)/e.maxHp)+'%'; setText(hud.eHpT,`${Math.max(0,Math.ceil(e.hp))} / ${e.maxHp}`);
    // Phase marks on a boss's health bar; passed ones dim.
    const marks=e.kit?KITS[e.kit.tier].phases.map((p,i)=>`<b class="ptick${i<e.kit!.phase?' past':''}" style="left:${p*100}%"></b>`).join(''):'';
    if(hud.ePh.innerHTML!==marks) hud.ePh.innerHTML=marks;}
  renderFoes(bt);
  if(u){setText(hud.pName,u.name); setText(hud.pLvl,'Lv '+u.m.lvl); setText(hud.pEl,ELEM[u.sp.el].name); hud.pEl.className='chip '+u.sp.el;
    hud.pHp.style.width=(100*u.hp/u.maxHp)+'%'; setText(hud.pHpT,`${Math.ceil(u.hp)} / ${u.maxHp}`);
    hud.pEn.style.width=u.energy+'%'; const rdy=u.energy>=100; hud.pPanel.classList.toggle('ready',rdy); setText(hud.eReady,rdy?`${u.sp.special} ready · hold, then flick`:Math.floor(u.energy)+'%');}
  $$<HTMLButtonElement>('#slots .slot').forEach((b,i)=>{const x=bt.team[i]; b.classList.toggle('active',i===bt.active); b.classList.toggle('cool',bt.swapCd>0); b.disabled=x.dead;
    (b.querySelector('i') as HTMLElement).style.width=(100*x.hp/x.maxHp)+'%'; (b.querySelector('canvas') as HTMLCanvasElement).dataset.dead=x.dead?'1':'';
    const sb=b.querySelector('.sbadge'); if(sb&&e){const m=elemMult(x.sp.el,e.sp.el); const t=m>1?'▲':(m<1?'▼':''); if(sb.textContent!==t){sb.textContent=t; sb.className='sbadge '+(m>1?'good':'bad')}}});
  if(e&&u){const a=elemMult(u.sp.el,e.sp.el), d=elemMult(e.sp.el,u.sp.el); let txt='',cls='mu';
    if(a>1&&d>1){txt='Both strong ▲▼';cls+=' warn'} else if(a>1){txt='Advantage ▲ your hits ×1.5';cls+=' good'} else if(d>1){txt='Disadvantage ▼ swap?';cls+=' bad'}
    setText(hud.eMu,txt); hud.eMu.className=cls; hud.eMu.hidden=!txt;}
  renderStatus(hud.eSt,bt.enemy&&!bt.enemy.dead?bt.enemy.st:{});
  renderStatus(hud.pSt,u&&!u.dead?u.st:{});
}

/* ---------- input ---------- */
/**
 * The touch or mouse press being tracked. A quick tap fires a light shot (or
 * picks a new target when it lands on another enemy). A flick throws, aimed
 * by its direction; straight down parries. Holding still first charges a
 * heavy throw, or the Special when energy is full.
 */
let ptr: {id: number; x0: number; y0: number; x: number; y: number; fired: boolean; t0: number; charge: number; moved: boolean;
  samples: {x: number; y: number; t: number}[]}|null=null;
export function local(ev: PointerEvent){const r=field.getBoundingClientRect();return {x:ev.clientX-r.left,y:ev.clientY-r.top}}
/** How charged the press is right now; it only builds while the finger stays still. */
function holdCharge(): number{
  if(!ptr||ptr.fired) return 0;
  if(!ptr.moved) ptr.charge=chargeAt((performance.now()-ptr.t0)/1000);
  return ptr.charge;
}
/** The ring that fills around your beast while you hold. */
function drawHoldCharge(c: CanvasRenderingContext2D, g: ReturnType<typeof geo>, u: Unit|undefined, t: number){
  const k=holdCharge(); if(!k||!u||u.dead) return;
  const col=ELEM[u.sp.el].color, r=g.s*1.25, full=k>=1, special=full&&u.energy>=100;
  c.save(); c.lineCap='round';
  c.lineWidth=5; c.strokeStyle=rgba(col,0.25); ell(c,g.P.x,g.P.y,r,r); c.stroke();
  c.lineWidth=full?7:5; c.strokeStyle=full?(special?'#FFE3A0':col):rgba(col,0.9); c.shadowColor=col; c.shadowBlur=full?18+8*Math.sin(t*14):8;
  c.beginPath(); c.arc(g.P.x,g.P.y,r,-Math.PI/2,-Math.PI/2+Math.PI*2*k); c.stroke();
  if(full){c.shadowBlur=0; c.font=`700 ${Math.round(g.s*0.26)}px 'Sigil UI', 'Barlow Semi Condensed', sans-serif`; c.textAlign='center'; c.fillStyle=special?'#FFE3A0':'#F0E8F5';
    c.fillText(special?`${u.sp.special}! Flick to throw`:'Heavy throw! Flick',g.P.x,g.P.y+r+g.s*0.32)}
  c.restore();
  if(Math.random()<0.4*k) elemBurst(g.P.x+rand(-1,1)*r,g.P.y+rand(-1,1)*r,u.sp.el,1,30,-0.2);
}
/** A finished flick: parry if it went straight down, otherwise throw along it. */
function flick(dx: number,dy: number,speed: number,charge: number){
  if(classifyFlick(dx,dy)==='parry'){parry(); return}
  const u=cur();
  playerAct(charge>=1?chargedKind(u?.energy??0):'throw',{dir:{x:dx,y:dy},power:flickPower(speed)});
}
/** Finger speed over the last moments of the gesture, in pixels per millisecond. */
function speedOf(q: NonNullable<typeof ptr>){
  const now=q.samples[q.samples.length-1]; if(!now) return 0;
  const past=q.samples.find(p=>now.t-p.t<=90)??q.samples[0];
  const dt=Math.max(8,now.t-past.t); return Math.hypot(now.x-past.x,now.y-past.y)/dt;
}
field.addEventListener('pointerdown',ev=>{const bt=B; if(!bt) return;
  if(bt.over) return; ev.preventDefault();
  try{field.setPointerCapture(ev.pointerId)}catch(e){}
  const p=local(ev), t=performance.now();
  ptr={id:ev.pointerId,x0:p.x,y0:p.y,x:p.x,y:p.y,fired:false,t0:t,charge:0,moved:false,samples:[{x:p.x,y:p.y,t}]};
  bt.trail.push({x:p.x,y:p.y,t:bt.time});
});
field.addEventListener('pointermove',ev=>{const bt=B; if(!bt) return;
  if(!ptr||ev.pointerId!==ptr.id) return;
  const p=local(ev), t=performance.now(); ptr.x=p.x; ptr.y=p.y;
  ptr.samples.push({x:p.x,y:p.y,t}); if(ptr.samples.length>12) ptr.samples.shift();
  bt.trail.push({x:p.x,y:p.y,t:bt.time});
  const u=cur(); if(u&&Math.random()<0.5) elemBurst(p.x,p.y,u.sp.el,1,50,0.1);
  const dx=p.x-ptr.x0,dy=p.y-ptr.y0, d=Math.hypot(dx,dy), dist=swipeDistances(prefs);
  if(!ptr.moved&&d>=dist.tap){holdCharge(); ptr.moved=true}
  if(!ptr.fired&&d>=dist.swipe){ptr.fired=true; flick(dx,dy,speedOf(ptr),ptr.charge)}
});
export function release(ev: PointerEvent){
  if(!ptr||ev.pointerId!==ptr.id) return;
  const charge=holdCharge(), q=ptr; ptr=null;
  if(ev.type==='pointercancel'||q.fired) return;
  const dx=q.x-q.x0, dy=q.y-q.y0;
  if(Math.hypot(dx,dy)<swipeDistances(prefs).tap){
    // A full charge released in place throws at your target.
    if(charge>=1){playerAct(chargedKind(cur()?.energy??0)); return}
    // Tapping a different enemy aims at it instead of shooting.
    const f=B&&B.foes.length>1?foeAt(q.x0,q.y0):undefined;
    if(f&&f!==B?.enemy){setTarget(f); return}
    playerAct('tap');
  } else flick(dx,dy,speedOf(q),charge);
}
$('#eFoes').addEventListener('click',ev=>{const b=(ev.target as Element).closest<HTMLElement>('[data-f]'); const f=b&&B?.foes[Number(b.dataset.f)]; if(f) setTarget(f)});
field.addEventListener('pointerup',release); field.addEventListener('pointercancel',release);
field.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',ev=>{const bt=B; if(!bt) return;
  if(current!=='battle'||!bt||ev.repeat||!$('#setSheet').hidden) return;
  const k=ev.key.toLowerCase();
  if(k==='j'||k==='f') playerAct('tap');
  else if(k==='k'||k==='d') playerAct('throw');
  else if(k==='i'||k==='arrowup') {ev.preventDefault(); playerAct(chargedKind(cur()?.energy??0));}
  else if(k===' '||k==='l'||k==='arrowdown'){ev.preventDefault(); parry();}
  else if(['1','2','3'].includes(k)) swapTo(+k-1);
  else if(k==='t'||k==='tab'){ev.preventDefault(); const a=alive(); if(a.length>1){const i=a.indexOf(bt.enemy!); setTarget(a[(i+1)%a.length])}}
});
