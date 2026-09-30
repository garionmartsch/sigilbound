import { BOX, COST, ELEM, FORMS, SPECIES, addXp, capOf, elemMult, nameOf, statsOf } from './data';
import { drawMonster, drawSigil } from './render';
import { newCard, persist, save, teamMembers } from './save';
import { current, show } from './screens';
import { SFX, buzz } from './sfx';
import { FXDRAW, fbPos, ribbon, tornadoX, waveX, type Fx } from './fx';
import type { Card, ElementKey, Species } from './types';
import { $, $$, RM, clamp, ell, fit, pick, rand, rgba } from './util';

/* ---------- battle state ---------- */
/** One of the player's three beasts during a fight. */
export interface Unit {
  m: Card; sp: Species; name: string; evo: number; skill: number;
  hp: number; maxHp: number; atk: number; energy: number;
  dead: boolean; fade: number; flash: number;
  /** 0..1 knockback after being hit. */
  kb?: number;
}
/** The current enemy. */
export interface Enemy {
  key: string; sp: Species; evo: number; name: string; lvl: number; boss: boolean;
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
}
type ParticleKind = 'spark' | 'ember' | 'drop' | 'leaf' | 'shard' | 'dust' | 'mote';
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; kind: ParticleKind; rot: number; vr: number }
interface FloatText { x: number; y: number; txt: string; color: string; size: number; life: number; max: number }
type ActKind = 'tap' | 'slash' | 'special';

export interface Battle {
  team: Unit[];
  /** Index of the beast currently fighting. */
  active: number;
  stage: number;
  /** 1-3; wave 3 is the boss. */
  wave: number;
  enemy: Enemy | null;
  /** Attack cooldown, swap cooldown, parry window and parry cooldown, in seconds. */
  cd: number; swapCd: number; parry: number; parryCd: number;
  /** An input made near the end of a cooldown, fired when it ends. */
  buffered: { kind: ActKind; ang?: number } | null;
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
}

/** The fight in progress, or null outside battle. */
export let B: Battle | null = null;

const fieldCv=$<HTMLCanvasElement>('#fieldCan'), field=$('#field');
/** The beast currently fighting, if any. */
export const cur=(): Unit|undefined=>B?B.team[B.active]:undefined;

export function makeEnemy(stage: number,wave: number): Enemy{
  const boss=wave===3;
  const keys=Object.keys(SPECIES);
  const key=boss?pick(keys.filter(k=>SPECIES[k].rarity!=='common')):pick(keys.filter(k=>SPECIES[k].rarity!=='epic'));
  const sp=SPECIES[key], lvl=stage+wave-1+(boss?1:0);
  const evo=boss?(stage>=7?2:stage>=3?1:0):(stage>=6?1:0), k=(1+0.1*(lvl-1))*(1+0.35*evo);
  const maxHp=Math.round(sp.hp*k*(boss?2.1:0.9));
  return {key,sp,evo,name:FORMS[key][evo],lvl,boss,hp:maxHp,maxHp,atk:sp.atk*k*(boss?1.1:0.8),state:'idle' as const,timer:rand(1.5,2.1),windup:boss?0.95:0.85,
    flash:0,lunge:0,dead:false,fade:1,spawn:0};
}
export function startBattle(){
  const team=teamMembers().map(m=>{const st=statsOf(m);return {m,sp:SPECIES[m.sp],name:nameOf(m),evo:m.evo||0,skill:m.skill||1,hp:st.maxHp,maxHp:st.maxHp,atk:st.atk,energy:0,dead:false,fade:1,flash:0}});
  if(!team.length) return;
  const b: Battle={team,active:0,stage:save.stage,wave:0,enemy:null,cd:0,swapCd:0,parry:0,parryCd:0,buffered:null,fx:[],hitstop:0,flash:0,flashCol:'#FFFFFF',lunge:0,pSpawn:1,
    parts:[],texts:[],trail:[],shake:0,time:0,over:false,earned:0,gold:0,drops:[],timers:[],
    embers:Array.from({length:26},()=>({x:Math.random(),y:Math.random(),v:rand(0.02,0.06),r:rand(0.8,2.2),ph:Math.random()*6}))};
  B=b;
  $('#result').hidden=true;
  $('#slots').innerHTML=b.team.map((u,i)=>`<button class="slot" data-i="${i}" aria-label="Swap to ${u.name}"><canvas class="pcan" data-sp="${u.m.sp}" data-evo="${u.evo}" data-seed="${i*1.3}"></canvas><span class="sname">${u.name}</span><span class="bar sm"><i></i></span><span class="sbadge"></span></button>`).join('');
  $$('#slots .slot').forEach(b=>b.addEventListener('click',()=>swapTo(Number(b.dataset.i))));
  retreatArm=0; $('#btnRetreat').textContent='Retreat';
  show('battle');
  nextWave();
}
export function nextWave(){const bt=B; if(!bt) return;
  bt.wave++; const e=makeEnemy(bt.stage,bt.wave); bt.enemy=e;
  banner(bt.wave===3?'Boss':`Wave ${bt.wave}`, bt.wave===3?e.name:`Stage ${bt.stage}`);
}
export function banner(txt: string,sub?: string){SFX.play('banner');const b=$('#banner'); b.innerHTML=`${txt}<small>${sub||''}</small>`; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');}

export function geo(){
  const w=field.clientWidth,h=field.clientHeight, s=Math.min(w*0.19,h*0.15);
  return {w,h,s,E:{x:w*0.66,y:h*0.33},P:{x:w*0.34,y:h*0.7}};
}
/** Number of claw marks each body type leaves when slashing. */
const CLAWS: Record<string, number>={brute:3,wisp:2,serpent:1,avian:2,golem:1};
/** Particle style for each element's bursts. */
const PKIND: Record<ElementKey, ParticleKind>={pyre:'ember',tide:'drop',thorn:'leaf',frost:'shard',storm:'ember',stone:'dust',gale:'leaf',radiant:'ember',umbral:'mote'};
/** Particle colors for each element. */
const PCOLS: Record<ElementKey, string[]>={pyre:['#FFD27A','#FF8A3D','#E4683A','#FFF1C4'],tide:['#BFEFFF','#3E9ED6','#7FD0F0','#FFFFFF'],thorn:['#7DB85B','#A7D46F','#4F7A3A','#C6E36A'],frost:['#E6F8FF','#8FD3E8','#BFE9F7','#FFFFFF'],storm:['#FFF6B0','#E8D04A','#FFFFFF','#F5E27A'],stone:['#A88B64','#7A6246','#C9AE86','#5E4C38'],gale:['#E6FFF2','#B5E3C8','#FFFFFF','#8FCFAE'],radiant:['#FFF8D6','#FFE58A','#FFFFFF','#F7D46A'],umbral:['#9A6BD6','#5B3A8C','#C9A6FF','#6E4AA8']};
export function pushPart(p: Particle){const bt=B; if(!bt) return;if(bt.parts.length<420)bt.parts.push(p)}
export function burst(x: number,y: number,color: string,n: number,sp: number){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=rand(0.3,1)*sp;pushPart({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-sp*0.2,life:rand(0.35,0.8),max:0.8,color,r:rand(1.5,4),kind:'spark',rot:0,vr:0})}}
export function elemBurst(x: number,y: number,el: ElementKey,n: number,sp: number,up?: number){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=rand(0.3,1)*sp;pushPart({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-sp*(up??0.25),life:rand(0.4,0.9),max:0.9,color:pick(PCOLS[el]),r:rand(2,4.5),kind:PKIND[el],rot:rand(0,6),vr:rand(-9,9)})}}
export function fx(o: Omit<Fx,'t'> & {t?: number}): Fx{const bt=B; const f={t:0,...o} as Fx; if(!bt) return f;bt.fx.push(f);return f}
export function ftext(x: number,y: number,txt: string,color: string,size?: number,life?: number){const bt=B; if(!bt) return;bt.texts.push({x,y,txt,color,size:size||22,life:life||0.9,max:life||0.9})}
export function shake(a: number){const bt=B; if(!bt) return;if(!RM)bt.shake=Math.max(bt.shake,a)}
export function slashFx(x: number,y: number,ang: number,color: string,body: string,s: number,dur?: number){
  const n=CLAWS[body];
  return fx({type:'slash',x,y,ang,color,n,len:s*2.3,w:s*(n===1?0.26:n===2?0.17:0.13),gap:s*0.3,bow:s*0.35*(Math.random()<.5?1:-1),dur:dur||0.42});
}

export function playerAct(kind: ActKind,ang?: number){const bt=B; if(!bt) return;
  if(!bt||bt.over) return;
  const u=cur(), e=bt.enemy;
  if(!u||u.dead||!e||e.dead||e.spawn<1||bt.pSpawn<1) return;
  if(bt.cd>0){ if(bt.cd<0.3) bt.buffered={kind,ang}; return; }
  if(kind==='special'&&u.energy<100) kind='slash';
  let mult,cd,gain;
  if(kind==='tap'){mult=0.45;cd=0.22;gain=7}
  else if(kind==='slash'){mult=1;cd=0.45;gain=12}
  else {mult=2.8*(1+0.12*((u.skill||1)-1));cd=1.1;gain=0;u.energy=0}
  bt.cd=cd; u.energy=Math.min(100,u.energy+gain);
  const em=elemMult(u.sp.el,e.sp.el);
  const dmg=Math.max(1,Math.round(u.atk*mult*em*rand(0.9,1.1)));
  const g=geo(), col=ELEM[u.sp.el].color;
  if(kind==='special'){castSpecial(u,e,dmg,em);return}
  bt.lunge=1;
  if(kind==='tap'){
    SFX.play('tap'); buzz(8);
    fx({type:'impact',x:g.E.x+rand(-.35,.35)*g.s,y:g.E.y+rand(-.4,.2)*g.s,r:g.s*0.55,color:col,rot:Math.random(),dur:0.22});
    bt.hitstop=0.03;
  } else {
    if(ang==null) ang=rand(-0.5,0.5)+(Math.random()<0.5?0:Math.PI);
    slashFx(g.E.x,g.E.y-g.s*0.1,ang,col,u.sp.body,g.s); SFX.play('slash'); SFX.play('hit'); buzz(14);
    const dx=Math.cos(ang),dy=Math.sin(ang);
    for(let i=-2;i<=2;i++) elemBurst(g.E.x+dx*i*g.s*0.45,g.E.y-g.s*0.1+dy*i*g.s*0.45,u.sp.el,3,200,0.2);
    bt.hitstop=0.07;
  }
  hitEnemy(dmg,em,kind);
}
export function castSpecial(u: Unit,e: Enemy,dmg: number,em: number){const bt=B; if(!bt) return;
  const g=geo(), s=g.s, el=u.sp.el, col=ELEM[el].color;
  ftext(g.w/2,g.h*0.52,u.sp.special,col,28,1.4);
  if(e.state==='windup'){e.state='idle';e.timer=rand(1.6,2.2);ftext(g.E.x,g.E.y-s*1.6,'Staggered!','#F0E8F5',20,1)}
  fx({type:'charge',x:g.P.x,y:g.P.y,r:s*1.8,color:col,dur:0.28}); SFX.play('charge'); buzz(20);
  const land=()=>{ if(!bt||bt.enemy!==e||e.dead) return; bt.flash=0.55; bt.flashCol=col; bt.hitstop=0.14; shake(1); SFX.play('hit'); buzz(70); hitEnemy(dmg,em,'special'); };
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
export function hitEnemy(dmg: number,em: number,kind: ActKind){const bt=B; if(!bt) return;
  const e=bt.enemy,g=geo(),u=cur(); if(!e||e.dead) return;
  const el=u?u.sp.el:'pyre';
  e.hp-=dmg; e.flash=1; e.kb=kind==='tap'?0.45:1;
  elemBurst(g.E.x+rand(-10,10),g.E.y+rand(-10,10),el,kind==='tap'?5:10,kind==='tap'?160:260);
  ftext(g.E.x+rand(-g.s*0.6,g.s*0.6),g.E.y-g.s*0.5,String(dmg),em>1?'#FFD98A':(em<1?'#B7A9C6':'#FFFFFF'),kind==='special'?36:(kind==='slash'?26:20));
  if(em>1&&kind!=='tap') ftext(g.E.x,g.E.y-g.s*1.25,'Super effective','#E7BE6E',16,1);
  if(em<1&&kind!=='tap') ftext(g.E.x,g.E.y-g.s*1.25,'Resisted','#A898B9',15,0.9);
  shake(kind==='tap'?0.15:0.4);
  if(e.hp<=0&&!e.dead){
    e.hp=0; e.dead=true; e.state='dead';
    fx({type:'explosion',x:g.E.x,y:g.E.y,r:g.s*2.6,color:ELEM[e.sp.el].color,dur:0.8});
    elemBurst(g.E.x,g.E.y,e.sp.el,70,420,0.4); shake(0.9); SFX.play('kill'); buzz([30,40,90]);
    bt.hitstop=Math.max(bt.hitstop,0.18); bt.flash=Math.max(bt.flash,0.4); bt.flashCol='#FFF4DC';
    const reward=e.boss?60+10*bt.stage:20+5*bt.stage; bt.earned+=reward;
    const gold=e.boss?120+30*bt.stage:40+10*bt.stage; bt.gold+=gold;
    ftext(g.E.x,g.E.y,`+${reward} shards · +${gold} gold`,'#E7BE6E',18,1.4);
    if(Math.random()<(e.boss?0.3:0.35)&&save.roster.length+bt.drops.length<BOX){bt.drops.push(e.key); ftext(g.E.x,g.E.y+26,`${e.sp.name} card dropped!`,'#F0E8F5',17,1.6)}
    bt.timers.push({t:1.3,fn:()=>{if(bt.wave<3) nextWave(); else victory();}});
  }
}
export function enemyStrike(){const bt=B; if(!bt) return;
  const e=bt.enemy,u=cur(),g=geo();
  if(!e) return;
  e.lunge=1;
  if(!u||u.dead||bt.pSpawn<1) return;
  const em=elemMult(e.sp.el,u.sp.el);
  if(bt.parry>0){
    const hx=g.P.x+g.s*0.7, hy=g.P.y-g.s*0.35;
    ftext(g.P.x,g.P.y-g.s*1.4,'Parried!','#E7BE6E',26,1.2);
    fx({type:'impact',x:hx,y:hy,r:g.s*1.1,color:'#E7BE6E',rot:Math.random(),dur:0.35});
    burst(hx,hy,'#FFE3A0',30,380); SFX.play('parry'); buzz([15,30,25]);
    bt.hitstop=0.12; bt.flash=0.35; bt.flashCol='#E7BE6E'; e.kb=1; shake(0.5);
    u.energy=Math.min(100,u.energy+22);
    const cdmg=Math.max(1,Math.round(u.atk*0.8*elemMult(u.sp.el,e.sp.el)));
    bt.timers.push({t:0.12,fn:()=>{const e2=bt.enemy,u2=cur(); if(e2&&!e2.dead&&u2&&!u2.dead){bt.lunge=1; slashFx(g.E.x,g.E.y-g.s*0.1,rand(-0.6,0.6),ELEM[u2.sp.el].color,u2.sp.body,g.s); hitEnemy(cdmg,1,'slash')}}});
    return;
  }
  u.energy=Math.min(100,u.energy+6);
  const dmg=Math.max(1,Math.round(e.atk*em*rand(0.9,1.1)));
  u.hp-=dmg; u.flash=1; u.kb=1; shake(0.6); bt.hitstop=0.05; SFX.play('hurt'); buzz(45);
  const toP=Math.atan2(g.P.y-g.E.y,g.P.x-g.E.x);
  slashFx(g.P.x,g.P.y-g.s*0.1,toP+Math.PI/2+rand(-0.4,0.4),ELEM[e.sp.el].color,e.sp.body,g.s*0.9,0.36);
  elemBurst(g.P.x,g.P.y,e.sp.el,14,260);
  ftext(g.P.x+rand(-20,20),g.P.y-g.s*0.6,String(dmg),'#FF8A8A',24);
  if(u.hp<=0){
    u.hp=0; u.dead=true; bt.parry=0;
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
}
export const PARRY=0.4;
export function parry(){const bt=B; if(!bt) return;
  if(!bt||bt.over||bt.parryCd>0) return;
  const u=cur(); if(!u||u.dead||bt.pSpawn<1) return;
  bt.parry=PARRY; bt.parryCd=0.75; bt.buffered=null; SFX.play('guard'); buzz(6);
}
export function victory(){const bt=B; if(!bt) return;
  bt.over=true; SFX.play('win'); buzz([20,40,20,40,60]);
  save.shards+=bt.earned; save.gold+=bt.gold;
  bt.drops.forEach(k=>newCard(save,k));
  const ups: string[]=[];
  const xp=40+10*bt.stage;
  teamMembers().forEach(m=>{if(addXp(m,xp)) ups.push(`${nameOf(m)} reached <b>Lv ${m.lvl}</b>${m.lvl>=capOf(m)?' (max)':''}`)});
  const cleared=bt.stage; save.stage++; persist();
  const drops=bt.drops.length?`<li>Card drops: <b>${bt.drops.map(k=>SPECIES[k].name).join(', ')}</b></li>`:'';
  $('#resultBox').innerHTML=`<h2>Stage ${cleared} cleared</h2><ul><li><b>+${bt.earned}</b> soul shards · <b>+${bt.gold}</b> gold</li>${drops}<li>Team gained <b>${xp} XP</b></li>${ups.map(x=>`<li>${x}</li>`).join('')}</ul>
    ${save.shards>=COST?'<p style="margin:0;color:var(--gold)">You have enough shards to summon.</p>':''}
    <div class="btns"><button id="rHome">Home</button><button class="primary" id="rNext">Stage ${save.stage}</button></div>`;
  $('#result').hidden=false;
  $('#rHome').onclick=()=>{B=null;show('home')}; $('#rNext').onclick=startBattle;
}
export function defeat(){const bt=B; if(!bt) return;
  bt.over=true; SFX.play('lose'); buzz(200);
  const kept=Math.floor(bt.earned/2), keptG=Math.floor(bt.gold/2); save.shards+=kept; save.gold+=keptG;
  bt.drops.forEach(k=>newCard(save,k)); persist();
  $('#resultBox').innerHTML=`<h2 class="lose">Your team fell</h2><ul><li>Kept <b>${kept}</b> soul shards and <b>${keptG}</b> gold${bt.drops.length?` plus ${bt.drops.length} card drop${bt.drops.length>1?'s':''}`:''}</li><li>Tip: swipe down when the closing ring turns gold to parry and counter.</li></ul>
    <div class="btns"><button id="rHome">Home</button><button class="primary" id="rNext">Retry</button></div>`;
  $('#result').hidden=false;
  $('#rHome').onclick=()=>{B=null;show('home')}; $('#rNext').onclick=startBattle;
}
let retreatArm=0;
const retreatBtn=$('#btnRetreat');
retreatBtn.addEventListener('click',()=>{
  if(Date.now()-retreatArm<2500){B=null;show('home');return}
  retreatArm=Date.now(); retreatBtn.textContent='Tap again to retreat';
  setTimeout(()=>{if(Date.now()-retreatArm>=2400)retreatBtn.textContent='Retreat'},2500);
});

/** Gravity per particle kind (negative rises). */
const GRAV: Record<ParticleKind, number>={spark:380,ember:-90,drop:760,leaf:120,shard:420,dust:650,mote:-50};
export function updateBattle(dt){const bt=B; if(!bt) return;
  bt.flash=Math.max(0,bt.flash-dt*2.2); bt.shake=Math.max(0,bt.shake-dt*3);
  if(bt.hitstop>0){bt.hitstop-=dt; return;}
  bt.time+=dt;
  bt.cd=Math.max(0,bt.cd-dt); bt.swapCd=Math.max(0,bt.swapCd-dt);
  bt.lunge=Math.max(0,bt.lunge-dt/0.22);
  bt.pSpawn=Math.min(1,bt.pSpawn+dt/0.45);
  bt.parry=Math.max(0,bt.parry-dt); bt.parryCd=Math.max(0,bt.parryCd-dt);
  if(bt.cd===0&&bt.buffered){const k=bt.buffered;bt.buffered=null;playerAct(k.kind,k.ang)}
  bt.team.forEach(u=>{u.flash=Math.max(0,u.flash-dt*5); u.kb=Math.max(0,(u.kb||0)-dt*5); if(u.dead)u.fade=Math.max(0,u.fade-dt*1.6)});
  for(let i=bt.timers.length-1;i>=0;i--){const tm=bt.timers[i]; tm.t-=dt; if(tm.t<=0){bt.timers.splice(i,1); tm.fn(); if(!bt) return;}}
  const e=bt.enemy;
  if(e){
    e.flash=Math.max(0,e.flash-dt*5); e.lunge=Math.max(0,e.lunge-dt/0.25); e.kb=Math.max(0,(e.kb||0)-dt*5);
    if(e.dead) e.fade=Math.max(0,e.fade-dt*1.4);
    else {
      e.spawn=Math.min(1,e.spawn+dt/0.6);
      if(e.spawn>=1&&!bt.over&&!cur()?.dead){
        e.timer-=dt;
        if(e.state==='idle'&&e.timer<=0){e.state='windup';e.timer=e.windup;e.ticked=false;SFX.play('warn')}
        else if(e.state==='windup'&&!e.ticked&&e.timer<=PARRY){e.ticked=true;SFX.play('window')}
        else if(e.state==='windup'&&e.timer<=0){enemyStrike(); e.state='idle'; e.timer=rand(1.7,2.7)/e.sp.spd*(e.boss?0.85:1)}
      }
    }
  }
  const ended: Fx[]=[];
  bt.fx.forEach(f=>{
    f.t+=dt;
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


export function drawBattle(){const bt=B; if(!bt) return;
  const f=fit(fieldCv); if(!f) return; const {c,w,h}=f; const g=geo(); const s=g.s; const t=bt.time;
  c.clearRect(0,0,w,h);
  c.save();
  if(bt.shake>0){c.translate(rand(-1,1)*bt.shake*10,rand(-1,1)*bt.shake*8)}
  let gr=c.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#1B1229'); gr.addColorStop(0.46,'#2A1B38'); gr.addColorStop(0.461,'#1A1224'); gr.addColorStop(1,'#0E0914');
  c.fillStyle=gr; c.fillRect(-20,-20,w+40,h+40);
  gr=c.createRadialGradient(w*0.5,h*0.46,0,w*0.5,h*0.46,w*0.7); gr.addColorStop(0,'rgba(231,150,90,0.18)'); gr.addColorStop(1,'rgba(231,150,90,0)');
  c.fillStyle=gr; c.fillRect(0,0,w,h);
  c.fillStyle='#140D1D';
  [[0.06,0.2,0.05],[0.16,0.28,0.035],[0.8,0.16,0.06],[0.92,0.3,0.04],[0.44,0.36,0.025]].forEach(([x,top,wd])=>{
    c.beginPath(); c.moveTo(w*(x-wd),h*0.461); c.lineTo(w*(x-wd*0.6),h*(top+0.04)); c.lineTo(w*x,h*top); c.lineTo(w*(x+wd*0.6),h*(top+0.04)); c.lineTo(w*(x+wd),h*0.461); c.fill();});
  c.strokeStyle='rgba(231,190,110,0.06)'; c.lineWidth=1;
  for(let i=-6;i<=6;i++){c.beginPath(); c.moveTo(w*0.5,h*0.461); c.lineTo(w*0.5+i*w*0.3,h); c.stroke();}
  bt.embers.forEach(m=>{m.y-=m.v*0.016; if(m.y<0){m.y=1;m.x=Math.random()}
    c.fillStyle=`rgba(255,170,90,${0.25+0.25*Math.sin(t*2+m.ph)})`; ell(c,m.x*w+Math.sin(t+m.ph)*6,m.y*h,m.r,m.r); c.fill();});
  const e=bt.enemy, u=cur();
  const vx=g.E.x-g.P.x, vy=g.E.y-g.P.y, vd=Math.hypot(vx,vy)||1, ux=vx/vd, uy=vy/vd;
  if(e) drawSigil(c,g.E.x,g.E.y+s*0.86,s*1.35,0.3,ELEM[e.sp.el].color,t*0.4,0.55);
  if(u) drawSigil(c,g.P.x,g.P.y+s*0.86,s*1.35,0.3,ELEM[u.sp.el].color,-t*0.4,0.55);
  if(e&&e.fade>0){
    const es=e.boss?1.25:1;
    const ph=e.lunge>0?Math.sin((1-e.lunge)*Math.PI):0;
    const kb=e.kb||0, kbo=Math.sin(kb*Math.PI*0.5)*s*0.4;
    const ox=-vx*0.28*ph+ux*kbo, oy=-vy*0.28*ph+uy*kbo;
    let wob=0, red=0;
    if(e.state==='windup'){const pr=1-e.timer/e.windup; red=pr; wob=Math.sin(t*50)*s*0.03*pr}
    const sc=(e.dead?0.6+0.4*e.fade:0.6+0.4*e.spawn)*es;
    drawMonster(c,e.key,g.E.x+ox+wob,g.E.y+oy,s,t*(e.sp.spd)+1.7,{dir:-1,evo:e.evo,flash:e.flash,red,alpha:e.dead?e.fade:e.spawn,scale:sc,sx:1+0.14*kb,sy:1-0.12*kb,glow:e.boss?rgba(ELEM[e.sp.el].color,0.7):null});
    if(e.state==='windup'&&!e.dead){
      c.font=`800 ${Math.round(s*0.6)}px ${getComputedStyle(document.body).getPropertyValue('--display')}`; c.textAlign='center'; c.fillStyle='#FF5A64';
      c.fillText('!',g.E.x,g.E.y-s*1.55*es);
    }
  }
  if(u&&u.fade>0){
    const ph=bt.lunge>0?Math.sin((1-bt.lunge)*Math.PI):0;
    const kb=u.kb||0, kbo=Math.sin(kb*Math.PI*0.5)*s*0.35;
    const ox=vx*0.3*ph-ux*kbo, oy=vy*0.3*ph-uy*kbo;
    const sc=0.6+0.4*bt.pSpawn;
    drawMonster(c,u.m.sp,g.P.x+ox,g.P.y+oy,s,t*u.sp.spd,{dir:1,evo:u.evo,flash:u.flash,alpha:u.dead?u.fade:bt.pSpawn,scale:sc,sx:1+0.12*kb,sy:1-0.1*kb});
    if(bt.parry>0&&!u.dead){
      c.save(); c.globalAlpha=Math.min(1,bt.parry/PARRY*1.5); c.translate(g.P.x+s*0.55,g.P.y-s*0.1);
      c.strokeStyle='rgba(231,190,110,0.9)'; c.lineWidth=4; c.shadowColor='#E7BE6E'; c.shadowBlur=14;
      c.beginPath(); c.arc(-s*0.6,0,s*1.25,-0.9,0.9); c.stroke();
      c.fillStyle='rgba(231,190,110,0.12)'; c.beginPath(); c.arc(-s*0.6,0,s*1.25,-0.9,0.9); c.arc(-s*0.6,0,s*1.05,0.9,-0.9,true); c.fill();
      c.restore();
    }
    if(u.energy>=100&&!u.dead){c.strokeStyle=rgba('#E7BE6E',0.35+0.25*Math.sin(t*6));c.lineWidth=2;ell(c,g.P.x,g.P.y,s*1.15,s*1.15);c.stroke();}
  }
  if(e&&e.state==='windup'&&!e.dead&&u&&!u.dead){
    const pr=clamp(1-e.timer/e.windup,0,1);
    const open=e.timer<=PARRY;
    c.lineWidth=open?3:2; c.strokeStyle=open?'rgba(231,190,110,0.95)':'rgba(231,190,110,0.5)'; c.setLineDash(open?[]:[4,6]);
    ell(c,g.P.x,g.P.y,s*1.05,s*1.05); c.stroke(); c.setLineDash([]);
    c.lineWidth=3+pr*2; c.strokeStyle=open?`rgba(255,214,130,${0.6+0.4*pr})`:`rgba(224,69,90,${0.35+0.6*pr})`;
    ell(c,g.P.x,g.P.y,s*(2.5-1.45*pr),s*(2.5-1.45*pr)); c.stroke();
  }
  bt.fx.forEach(fo=>{const d=FXDRAW[fo.type]; if(d) d(c,fo)});
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
    c.font=`700 ${sz}px 'Barlow Semi Condensed', 'Arial Narrow', sans-serif`;
    c.lineWidth=4; c.strokeStyle='rgba(12,8,16,0.9)'; c.strokeText(tx.txt,tx.x,tx.y); c.fillStyle=tx.color; c.fillText(tx.txt,tx.x,tx.y);});
  c.globalAlpha=1;
  c.restore();
  if(bt.flash>0){c.fillStyle=rgba(bt.flashCol||'#FFFFFF',Math.min(0.5,bt.flash*0.6)); c.fillRect(0,0,w,h);}
}

export const hud={eName:$('#eName'),eLvl:$('#eLvl'),eEl:$('#eEl'),eBoss:$('#eBoss'),eHp:$('#eHp'),eHpT:$('#eHpT'),pName:$('#pName'),pLvl:$('#pLvl'),pEl:$('#pEl'),pHp:$('#pHp'),pHpT:$('#pHpT'),pEn:$('#pEn'),eReady:$('#eReady'),pPanel:$('#pPanel'),stage:$('#bStage'),eMu:$('#eMu')};
export function setText(el: HTMLElement,v: string){if(el.textContent!==v)el.textContent=v}
export function updateHud(){const bt=B; if(!bt) return;
  const e=bt.enemy,u=cur();
  setText(hud.stage,`Stage ${bt.stage} · ${bt.wave===3?'Boss':'Wave '+bt.wave+'/3'}`);
  if(e){setText(hud.eName,e.name); setText(hud.eLvl,'Lv '+e.lvl); setText(hud.eEl,ELEM[e.sp.el].name); hud.eEl.className='chip '+e.sp.el; hud.eBoss.hidden=!e.boss;
    hud.eHp.style.width=(100*e.hp/e.maxHp)+'%'; setText(hud.eHpT,`${Math.ceil(e.hp)} / ${e.maxHp}`);}
  if(u){setText(hud.pName,u.name); setText(hud.pLvl,'Lv '+u.m.lvl); setText(hud.pEl,ELEM[u.sp.el].name); hud.pEl.className='chip '+u.sp.el;
    hud.pHp.style.width=(100*u.hp/u.maxHp)+'%'; setText(hud.pHpT,`${Math.ceil(u.hp)} / ${u.maxHp}`);
    hud.pEn.style.width=u.energy+'%'; const rdy=u.energy>=100; hud.pPanel.classList.toggle('ready',rdy); setText(hud.eReady,rdy?`${u.sp.special} ready · swipe up`:Math.floor(u.energy)+'%');}
  $$<HTMLButtonElement>('#slots .slot').forEach((b,i)=>{const x=bt.team[i]; b.classList.toggle('active',i===bt.active); b.classList.toggle('cool',bt.swapCd>0); b.disabled=x.dead;
    (b.querySelector('i') as HTMLElement).style.width=(100*x.hp/x.maxHp)+'%'; (b.querySelector('canvas') as HTMLCanvasElement).dataset.dead=x.dead?'1':'';
    const sb=b.querySelector('.sbadge'); if(sb&&e){const m=elemMult(x.sp.el,e.sp.el); const t=m>1?'▲':(m<1?'▼':''); if(sb.textContent!==t){sb.textContent=t; sb.className='sbadge '+(m>1?'good':'bad')}}});
  if(e&&u){const a=elemMult(u.sp.el,e.sp.el), d=elemMult(e.sp.el,u.sp.el); let txt='',cls='mu';
    if(a>1&&d>1){txt='Both strong ▲▼';cls+=' warn'} else if(a>1){txt='Advantage ▲ your hits ×1.5';cls+=' good'} else if(d>1){txt='Disadvantage ▼ swap?';cls+=' bad'}
    setText(hud.eMu,txt); hud.eMu.className=cls; hud.eMu.hidden=!txt;}
}

/* ---------- input ---------- */
/** The touch or mouse press currently being tracked as a gesture. */
let ptr: {id: number; x0: number; y0: number; x: number; y: number; fired: boolean}|null=null;
export function local(ev: PointerEvent){const r=field.getBoundingClientRect();return {x:ev.clientX-r.left,y:ev.clientY-r.top}}
export function gesture(dx: number,dy: number){
  const vert=Math.abs(dy)>Math.abs(dx)*1.1;
  const ang=Math.atan2(dy,dx);
  if(vert&&dy<0) playerAct('special',ang);
  else if(vert&&dy>0) parry();
  else playerAct('slash',ang);
}
field.addEventListener('pointerdown',ev=>{const bt=B; if(!bt) return;
  if(!bt||bt.over) return; ev.preventDefault();
  try{field.setPointerCapture(ev.pointerId)}catch(e){}
  const p=local(ev);
  ptr={id:ev.pointerId,x0:p.x,y0:p.y,x:p.x,y:p.y,fired:false};
  bt.trail.push({x:p.x,y:p.y,t:bt.time});
});
field.addEventListener('pointermove',ev=>{const bt=B; if(!bt) return;
  if(!ptr||ev.pointerId!==ptr.id||!bt) return;
  const p=local(ev); ptr.x=p.x; ptr.y=p.y;
  bt.trail.push({x:p.x,y:p.y,t:bt.time});
  const u=cur(); if(u&&Math.random()<0.5) elemBurst(p.x,p.y,u.sp.el,1,50,0.1);
  if(!ptr.fired){const dx=p.x-ptr.x0,dy=p.y-ptr.y0; if(Math.hypot(dx,dy)>=40){ptr.fired=true;gesture(dx,dy)}}
});
export function release(ev: PointerEvent){
  if(!ptr||ev.pointerId!==ptr.id) return;
  const q=ptr; ptr=null;
  if(ev.type==='pointercancel'||q.fired) return;
  const dx=q.x-q.x0, dy=q.y-q.y0;
  if(Math.hypot(dx,dy)<25) playerAct('tap'); else gesture(dx,dy);
}
field.addEventListener('pointerup',release); field.addEventListener('pointercancel',release);
field.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',ev=>{const bt=B; if(!bt) return;
  if(current!=='battle'||!bt||ev.repeat) return;
  const k=ev.key.toLowerCase();
  if(k==='j'||k==='f') playerAct('tap');
  else if(k==='k'||k==='d') playerAct('slash');
  else if(k==='i'||k==='arrowup') {ev.preventDefault(); playerAct('special');}
  else if(k===' '||k==='l'||k==='arrowdown'){ev.preventDefault(); parry();}
  else if(['1','2','3'].includes(k)) swapTo(+k-1);
});
