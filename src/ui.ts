import { emit, hooks } from './events';
import { BOX, CALL_COST, COLLECTIBLE_KEYS, COST, ELEM, ELEM_ORDER, EVO_LABEL, FORMS, MAX_EVO, MAX_SKILL, RARITY, RARITY_ORDER, SPECIES, pickRarity, addXp, capOf, evoCost, feedXp, fuseCost, nameOf, rarOf, sellOf, simXp, statsOf, xpNext } from './data';
import { drawMonster, drawSigil } from './render';
import { cardById, fodderFor, newCard, partnersFor, persist, save } from './save';
import type { Card, RarityKey } from './types';
import { show } from './screens';
import { SFX, buzz } from './sfx';
import { $, $$, clamp, clock, ease, ell, fit, pick, rgba } from './util';

/* ---------- card markup ---------- */
/** Diamond pips showing evolution stage. */
export function pipsHTML(m: Card){let r='';for(let i=0;i<=MAX_EVO;i++)r+=`<i class="${i<=(m.evo||0)?'on':''}"></i>`;return `<span class="pips" title="${EVO_LABEL[m.evo||0]}" aria-label="${EVO_LABEL[m.evo||0]}">${r}</span>`}
/** Markup for one card tile. */
export function cardHTML(m: Card,o: {sel?: boolean; selno?: number|string}={}){
  const sp=SPECIES[m.sp],R=rarOf(m),slot=save.team.indexOf(m.id),cap=capOf(m),ec=ELEM[sp.el].color;
  const flags=(slot>=0?`<span class="flag team">Team ${slot+1}</span>`:'')+(m.locked?'<span class="flag">Locked</span>':'')+(m.skill>1?`<span class="flag">SL ${m.skill}</span>`:'');
  return `<button class="card r-${sp.rarity}${o.sel?' sel':''}" data-id="${m.id}" style="--rc:${R.color};--ec:${ec};--eg:${rgba(ec,0.28)}" aria-label="${nameOf(m)}, ${R.label}, level ${m.lvl}">
    <span class="cstars">${'★'.repeat(R.stars)}</span>${o.selno?`<span class="selno">${o.selno}</span>`:'<span class="cel"></span>'}<span class="cflags">${flags}</span>
    <canvas class="pcan" data-sp="${m.sp}" data-evo="${m.evo||0}" data-seed="${(m.id*0.73)%5}"></canvas>
    <span class="cname">${nameOf(m)}</span><span class="clv">${m.lvl>=cap?`<b>Lv ${m.lvl} · Max</b>`:`Lv ${m.lvl}/${cap}`}</span>${pipsHTML(m)}</button>`;
}

/* ---------- altar ---------- */
const altarCv=$<HTMLCanvasElement>('#altarCan');
/** A particle drifting toward a target point. */
interface Mote { x: number; y: number; tx: number; ty: number; life: number; max: number; color: string }
/** Summoning altar animation state. */
const A: {
  rot: number;
  anim: { t: number; key: string; rar: RarityKey; msg: string; done: boolean } | null;
  shown: { key: string; t: number; rar: RarityKey } | null;
  flash: number;
  parts: Mote[];
} = { rot: 0, anim: null, shown: null, flash: 0, parts: [] };
export function renderAltar(){
  $('#aShards').textContent=String(save.shards); $('#aGold').textContent=String(save.gold);
  const full=save.roster.length>=BOX;
  const b=$<HTMLButtonElement>('#btnSummon'); b.disabled=full||save.shards<COST||!!A.anim;
  b.textContent=full?'Card box full':(save.shards<COST?`Rift Summon · need ${COST-save.shards} more shards`:`Rift Summon · ${COST} shards`);
  const g=$<HTMLButtonElement>('#btnCall'); g.disabled=full||save.gold<CALL_COST||!!A.anim;
  g.textContent=full?'Sell or feed cards to make room':(save.gold<CALL_COST?`Beast Call · need ${CALL_COST-save.gold} more gold`:`Beast Call · ${CALL_COST} gold`);
  $('#oddsT').innerHTML=`<tr><th>Rarity</th><th class="n">Rift</th><th class="n">Call</th><th>Beasts</th></tr>`+
    RARITY_ORDER.map(r=>{const v=RARITY[r], pool=COLLECTIBLE_KEYS.map(k=>SPECIES[k]).filter(s=>s.rarity===r);
      const who=pool.length<=5?pool.map(s=>s.name).join(', '):`${pool.length} beasts`;
      return `<tr><td><span class="chip ${r}">${v.label}</span></td><td class="n">${v.w}%</td><td class="n">${v.call}%</td><td>${who}</td></tr>`}).join('');
}
/** Pick a beast for a summon: first a rarity by its published rate, then a beast of that rarity. */
export function roll(kind: 'rift'|'call'): string{
  const rar=pickRarity(kind,Math.random()*100,kind==='rift'?hooks.summonRarity:null);
  return pick(COLLECTIBLE_KEYS.filter(k=>SPECIES[k].rarity===rar));
}
export function summon(kind: 'rift'|'call'){
  if(A.anim||save.roster.length>=BOX) return;
  if(kind==='rift'){if(save.shards<COST)return; save.shards-=COST}
  else {if(save.gold<CALL_COST)return; save.gold-=CALL_COST}
  const key=roll(kind), sp=SPECIES[key];
  const owned=save.roster.filter(m=>m.sp===key).length;
  const card=newCard(save,key);
  let msg;
  if(save.team.length<3){save.team.push(card.id); msg='Added to your team.'}
  else if(owned) msg=`Card ${owned+1} of this beast. Feed a copy to raise skill level, or merge two at max level to evolve.`;
  else msg='A new beast for your collection.';
  persist();
  A.anim={t:0,key,rar:sp.rarity,msg,done:false}; A.shown=null; SFX.play('summon'); buzz(15);
  $('#reveal').innerHTML='The rift is opening…';
  renderAltar();
}
$('#btnSummon').addEventListener('click',()=>summon('rift'));
$('#btnCall').addEventListener('click',()=>summon('call'));
export function drawAltar(dt){
  const f=fit(altarCv); if(!f) return; const {c,w,h}=f; const cx=w/2, cy=h/2, R=w*0.44;
  let spin=0.25, col='#E7BE6E', glow=0.25;
  if(A.anim){
    const an=A.anim; an.t+=dt; const k=Math.min(1,an.t/1.4);
    spin=0.25+k*k*5; glow=0.25+k*0.9; if(k>0.45) col=RARITY[an.rar].color;
    if(Math.random()<0.6+k){const a=Math.random()*Math.PI*2; A.parts.push({x:cx+Math.cos(a)*R,y:cy+Math.sin(a)*R,tx:cx,ty:cy,life:0.6,max:0.6,color:col})}
    if(an.t>=1.4&&!an.done){an.done=true; A.flash=1; A.shown={key:an.key,t:0,rar:an.rar}; SFX.play('reveal',an.rar); buzz(an.rar==='mythic'?[60,40,60,40,60,40,200]:an.rar==='legendary'?[50,50,50,50,160]:an.rar==='epic'?[40,60,40,60,140]:an.rar==='rare'?[40,50,80]:40);
      const sp=SPECIES[an.key];
      $('#reveal').innerHTML=`<span><span class="chip ${an.rar}">${RARITY[an.rar].label}</span> <span class="chip ${sp.el}">${ELEM[sp.el].name}</span></span><b>${sp.name}</b><span>${an.msg}</span>`;}
    if(an.t>2.0){A.anim=null; renderAltar(); emit('summoned',{key:an.key,rar:an.rar});}
  }
  if(A.shown){A.shown.t+=dt; col=RARITY[A.shown.rar].color; glow=Math.max(glow,0.45)}
  A.rot+=dt*spin; A.flash=Math.max(0,A.flash-dt*2);
  c.clearRect(0,0,w,h);
  const gr=c.createRadialGradient(cx,cy,0,cx,cy,R*1.1); gr.addColorStop(0,rgba(col,0.18*glow+0.05)); gr.addColorStop(1,rgba(col,0));
  c.fillStyle=gr; c.fillRect(0,0,w,h);
  c.save(); c.shadowColor=col; c.shadowBlur=18*glow;
  drawSigil(c,cx,cy,R,1,col,A.rot,0.9);
  drawSigil(c,cx,cy,R*0.5,1,col,-A.rot*1.6,0.6);
  c.restore();
  A.parts.forEach(p=>{p.life-=dt; const k=1-p.life/p.max; const x=p.x+(p.tx-p.x)*k, y=p.y+(p.ty-p.y)*k; c.globalAlpha=clamp(p.life/p.max,0,1); c.fillStyle=p.color; ell(c,x,y,2.2,2.2); c.fill();});
  A.parts=A.parts.filter(p=>p.life>0); c.globalAlpha=1;
  if(A.shown){const k=Math.min(1,A.shown.t/0.5); const e=1-Math.pow(1-k,3);
    drawMonster(c,A.shown.key,cx,cy+R*0.05,R*0.32,A.shown.t+2,{dir:1,scale:0.4+0.6*e,alpha:e,glow:rgba(col,0.8)});}
  if(A.flash>0){c.fillStyle=`rgba(255,248,230,${A.flash*0.85})`; c.fillRect(0,0,w,h);}
}

/* ---------- card collection ---------- */
type SortMode='rarity'|'level'|'element'|'fodder';
let sortBy: SortMode='rarity', sheetId: number|null=null;
/** Sort position per rarity, rarest first. */
export const RORD: Record<RarityKey, number>={mythic:0,legendary:1,epic:2,rare:3,common:4}, EORD=Object.fromEntries(ELEM_ORDER.map((k,i)=>[k,i]));
export function sortCards(list,mode){
  return [...list].sort((a,b)=>{
    const sa=SPECIES[a.sp],sb=SPECIES[b.sp];
    if(mode==='level') return b.lvl-a.lvl||b.evo-a.evo||RORD[sa.rarity]-RORD[sb.rarity];
    if(mode==='element') return EORD[sa.el]-EORD[sb.el]||RORD[sa.rarity]-RORD[sb.rarity]||b.lvl-a.lvl;
    if(mode==='fodder') return RORD[sb.rarity]-RORD[sa.rarity]||a.lvl-b.lvl||a.id-b.id;
    return RORD[sa.rarity]-RORD[sb.rarity]||b.evo-a.evo||a.sp.localeCompare(b.sp)||b.lvl-a.lvl;
  });
}
export function renderRoster(){
  $('#rGold').textContent=String(save.gold); $('#rCount').textContent=`${save.roster.length}/${BOX}`;
  $$('[data-sort]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sort===sortBy)));
  $('#rList').innerHTML=sortCards(save.roster,sortBy).map(m=>cardHTML(m)).join('');
  $$('#rList .card').forEach(b=>b.addEventListener('click',()=>openSheet(Number(b.dataset.id))));
  if(sheetId!=null) renderSheet();
}
$$('[data-sort]').forEach(b=>b.addEventListener('click',()=>{sortBy=b.dataset.sort as SortMode;renderRoster()}));
export function openSheet(id){sheetId=id; sellArm=0; renderSheet(); $('#sheet').hidden=false}
export function closeSheet(){sheetId=null; $('#sheet').hidden=true}
$('#sheet').addEventListener('click',e=>{if((e.target as Element).id==='sheet')closeSheet()});
export function evoBlock(m){
  if((m.evo||0)>=MAX_EVO) return 'This is its final form.';
  if(m.lvl<capOf(m)) return `Reach Lv ${capOf(m)} to evolve.`;
  if(!partnersFor(m).length) return `Needs a second ${SPECIES[m.sp].name} card that isn't locked or on your team.`;
  return null;
}
let sellArm=0;
export function renderSheet(){
  const m=sheetId==null?undefined:cardById(sheetId); if(!m){closeSheet();return}
  const sp=SPECIES[m.sp],R=rarOf(m),st=statsOf(m),cap=capOf(m),slot=save.team.indexOf(m.id),inTeam=slot>=0;
  const need=xpNext(m.lvl), pct=m.lvl>=cap?100:Math.round(100*m.xp/need);
  const eb=evoBlock(m), next=(m.evo||0)<MAX_EVO?FORMS[m.sp][(m.evo||0)+1]:null;
  const canSell=!inTeam&&!m.locked&&save.roster.length>1;
  const enhOk=!(m.lvl>=cap&&m.skill>=MAX_SKILL);
  const ec=ELEM[sp.el].color;
  $('#sheetBox').innerHTML=`
    <div class="dhead" style="--rc:${R.color};--eg:${rgba(ec,0.32)}"><canvas class="pcan" data-sp="${m.sp}" data-evo="${m.evo||0}" data-seed="1"></canvas>
      <div><div class="dstars" style="color:${R.color}">${'★'.repeat(R.stars)}</div><div class="dname">${nameOf(m)}</div>
      <div class="dmeta"><span class="chip ${sp.el}">${ELEM[sp.el].name}</span><span class="chip ${sp.rarity}">${R.label}</span>${inTeam?`<span class="flag team">Team ${slot+1}</span>`:''}</div>
      <div class="dmeta">${pipsHTML(m)}<span class="why">${EVO_LABEL[m.evo||0]}</span></div></div></div>
    <div><div class="elabel"><span>Level ${m.lvl} / ${cap}</span><span>${m.lvl>=cap?'Max level':`${m.xp} / ${need} XP`}</span></div><span class="bar energy"><i style="width:${pct}%"></i></span></div>
    <div class="stat"><span>HP</span><span></span><span>${st.maxHp}</span><span>Attack</span><span></span><span>${Math.round(st.atk)}</span>
      <span>Special</span><span>${sp.special}</span><span>SL ${m.skill}/${MAX_SKILL}</span></div>
    <p class="why">${m.skill>1?`Skill level ${m.skill}: special hits ${(m.skill-1)*12}% harder. `:''}${next?`Evolves into <b>${next}</b>. `:''}${eb||'<b>Ready to evolve.</b>'}</p>
    <div class="dacts">
      <button class="primary" id="dEnh" ${enhOk?'':'disabled'}>Enhance</button>
      <button class="primary" id="dEvo" ${eb?'disabled':''}>Evolve</button>
      <button id="dTeam" ${inTeam&&save.team.length===1?'disabled':''}>${inTeam?'Remove from team':(save.team.length<3?'Add to team':'Put in slot 3')}</button>
      <button id="dLock" aria-pressed="${m.locked}">${m.locked?'Unlock':'Lock'}</button>
      <button id="dSell" class="danger" ${canSell?'':'disabled'}>Sell · ${sellOf(m)} gold</button>
      <button id="dClose">Close</button>
    </div>`;
  $('#dClose').onclick=closeSheet;
  $('#dEnh').onclick=()=>openForge('enhance',m.id);
  $('#dEvo').onclick=()=>openForge('evolve',m.id);
  $('#dTeam').onclick=()=>{const i=save.team.indexOf(m.id); if(i>=0){if(save.team.length>1)save.team.splice(i,1)} else if(save.team.length<3) save.team.push(m.id); else save.team[2]=m.id; persist(); renderRoster()};
  $('#dLock').onclick=()=>{m.locked=!m.locked; persist(); renderRoster()};
  $('#dSell').onclick=e=>{
    if(Date.now()-sellArm<2500){save.gold+=sellOf(m); save.roster=save.roster.filter(x=>x.id!==m.id); persist(); closeSheet(); renderRoster(); SFX.play('reveal','common'); return}
    sellArm=Date.now(); (e.currentTarget as HTMLElement).textContent='Tap again to sell';
  };
}

/* ---------- forge: enhance + evolve ---------- */
type ForgeAnim =
  | { type: 'enhance'; t: number; dur: number; fodder: { sp: string; evo: number }[]; hit?: boolean }
  | { type: 'evolve'; t: number; dur: number; fromEvo: number; partner: { sp: string; evo: number }; hit?: boolean };
/** Enhance and evolve screen state. */
const F: {
  mode: 'enhance' | 'evolve';
  baseId: number;
  /** Selected card ids: fodder when enhancing, the partner when evolving. */
  sel: number[];
  anim: ForgeAnim | null;
  rot: number;
  parts: Mote[];
  flash: number;
  result: string | null;
} = { mode: 'enhance', baseId: 0, sel: [], anim: null, rot: 0, parts: [], flash: 0, result: null };
export function openForge(mode,id){
  F.mode=mode; F.baseId=id; F.sel=[]; F.anim=null; F.result=null; F.parts=[];
  const base=cardById(id);
  if(mode==='evolve'&&base){const p=sortCards(partnersFor(base),'fodder'); if(p.length) F.sel=[p[0].id]}
  closeSheet(); show('forge');
}
$('#fBack').addEventListener('click',()=>{if(F.anim)return; show('roster'); openSheet(F.baseId)});
export function statLine(label,a,b){return `<span>${label}</span><span></span><span>${a}${b!=null&&b!==a?` <span class="arrow">→ ${b}</span>`:''}</span>`}
export function renderForge(){
  const m=cardById(F.baseId); if(!m){show('roster');return}
  $('#fGold').textContent=String(save.gold);
  $('#fTitle').textContent=F.mode==='enhance'?'Enhance':'Evolve';
  const pool=sortCards(F.mode==='enhance'?fodderFor(m):partnersFor(m),'fodder');
  F.sel=F.sel.filter(id=>pool.some(p=>p.id===id));
  const sel=F.sel.map(cardById).filter((x): x is Card=>!!x);
  const cap=capOf(m), st=statsOf(m);
  const done=F.result&&!F.anim?`<p class="done">${F.result}</p>`:'';
  const go=$<HTMLButtonElement>('#fGo'), auto=$<HTMLButtonElement>('#fAuto');
  if(F.mode==='enhance'){
    const xp=sel.reduce((a,f)=>a+feedXp(f,m),0);
    const skillUp=Math.min(MAX_SKILL-m.skill,sel.filter(f=>f.sp===m.sp).length);
    const after=simXp(m,xp), st2=statsOf(after), cost=fuseCost(m,sel.length), need=xpNext(m.lvl);
    const nowPct=m.lvl>=cap?100:100*m.xp/need, prevPct=after.lvl>m.lvl?100:(m.lvl>=cap?100:100*after.xp/need);
    $('#fInfo').innerHTML=`${done}
      <div class="elabel"><span>${nameOf(m)} · Lv ${m.lvl}${after.lvl>m.lvl?` <span class="arrow">→ ${after.lvl}</span>`:''} / ${cap}</span><span>${xp?`+${xp} XP`:(m.lvl>=cap?'Max level':`${m.xp} / ${need} XP`)}</span></div>
      <span class="bar xp"><i class="prev" style="width:${prevPct}%"></i><i class="now" style="width:${nowPct}%"></i></span>
      <div class="stat">${statLine('HP',st.maxHp,sel.length?st2.maxHp:null)}${statLine('Attack',Math.round(st.atk),sel.length?Math.round(st2.atk):null)}${statLine('Skill','SL '+m.skill,skillUp?'SL '+(m.skill+skillUp):null)}</div>
      <p class="why">Pick up to 5 cards to feed. They're used up. Same element gives 1.5× XP, and a copy of the same beast raises skill level.${m.lvl>=cap?' <b>This card is at max level</b>, so only skill level can still rise.':''}</p>`;
    const blocked=!sel.length||(m.lvl>=cap&&!skillUp);
    go.disabled=blocked||save.gold<cost||!!F.anim;
    go.textContent=save.gold<cost?`Need ${cost-save.gold} more gold`:(sel.length?`Fuse ${sel.length} · ${cost} gold`:'Fuse');
    auto.hidden=false; auto.disabled=!!F.anim||!pool.length;
    $('.fbtns').classList.remove('one');
  } else {
    const p=sel[0], cost=evoCost(m), eb=evoBlock(m);
    const nm=Object.assign({},m,{evo:(m.evo||0)+1,lvl:1}), st2=statsOf(nm);
    $('#fInfo').innerHTML=`${done}${(m.evo||0)<MAX_EVO?`
      <div class="elabel"><span>${nameOf(m)} <span class="arrow">→ ${nameOf(nm)}</span></span><span>${EVO_LABEL[nm.evo]}</span></div>
      <div class="stat">${statLine('Level',`${m.lvl}/${cap}`,`1/${capOf(nm)}`)}${statLine('HP',st.maxHp,st2.maxHp)}${statLine('Attack',Math.round(st.atk),Math.round(st2.atk))}${statLine('Skill','SL '+m.skill,p&&p.skill>m.skill?'SL '+p.skill:null)}</div>
      <p class="why">Merging uses up the partner card below. Level resets to 1 with a higher cap, and stats never drop. The better skill level of the two is kept.</p>`
      :`<p class="why">${nameOf(m)} is in its final form.</p>`}`;
    go.disabled=!p||!!eb||save.gold<cost||!!F.anim;
    go.textContent=(m.evo||0)>=MAX_EVO?'Fully evolved':(m.lvl<cap?`Reach Lv ${cap} to evolve`:(!p?'Needs a partner card':(save.gold<cost?`Need ${cost-save.gold} more gold`:`Evolve · ${cost} gold`)));
    auto.hidden=true; $('.fbtns').classList.add('one');
  }
  if(F.anim){$('#fInfo').innerHTML=`<p class="done">${F.mode==='enhance'?'Fusing…':'Evolving…'}</p>`; go.disabled=true; go.textContent=F.mode==='enhance'?'Fusing…':'Evolving…'; auto.disabled=true}
  $('#fTools').innerHTML=`<span>${F.mode==='enhance'?`Feed · ${sel.length}/5 chosen`:'Partner card'}</span>`;
  $('#fGrid').innerHTML=pool.length?pool.map(f=>cardHTML(f,{sel:F.sel.includes(f.id),selno:F.sel.includes(f.id)?(F.mode==='enhance'?F.sel.indexOf(f.id)+1:'✓'):0})).join('')
    :`<p class="why" style="grid-column:1/-1">${F.mode==='enhance'?'No cards to feed. Cards on your team or locked are held back. Win battles for drops or use Beast Call at the altar.':'No partner card yet. You need a second copy of this beast from a summon or a battle drop.'}</p>`;
  $$('#fGrid .card').forEach(b=>b.addEventListener('click',()=>{
    if(F.anim) return; const id=Number(b.dataset.id); F.result=null;
    if(F.mode==='evolve') F.sel=[id];
    else {const i=F.sel.indexOf(id); if(i>=0)F.sel.splice(i,1); else if(F.sel.length<5)F.sel.push(id)}
    SFX.play('ui'); renderForge();
  }));
}
$('#fAuto').addEventListener('click',()=>{
  const m=cardById(F.baseId); if(!m||F.anim) return;
  const pool=fodderFor(m).filter(f=>SPECIES[f.sp].rarity==='common'&&(f.evo||0)===0);
  pool.sort((a,b)=>Number(b.sp===m.sp)-Number(a.sp===m.sp)||Number(SPECIES[b.sp].el===SPECIES[m.sp].el)-Number(SPECIES[a.sp].el===SPECIES[m.sp].el)||a.lvl-b.lvl);
  F.sel=pool.slice(0,5).map(f=>f.id); F.result=null; renderForge();
});
$('#fGo').addEventListener('click',()=>{
  const m=cardById(F.baseId); if(!m||F.anim) return;
  const sel=F.sel.map(cardById).filter((x): x is Card=>!!x); if(!sel.length) return;
  if(F.mode==='enhance'){
    const cost=fuseCost(m,sel.length); if(save.gold<cost) return;
    const xp=sel.reduce((a,f)=>a+feedXp(f,m),0), from=m.lvl, sk=m.skill;
    save.gold-=cost; addXp(m,xp);
    m.skill=Math.min(MAX_SKILL,m.skill+sel.filter(f=>f.sp===m.sp).length);
    save.roster=save.roster.filter(x=>!F.sel.includes(x.id));
    F.anim={type:'enhance',t:0,dur:1.5,fodder:sel.map(f=>({sp:f.sp,evo:f.evo||0}))};
    F.result=`+${xp} XP${m.lvl>from?` · Lv ${from} → ${m.lvl}`:''}${m.skill>sk?` · Skill up to SL ${m.skill}`:''}`;
    SFX.play('charge');
  } else {
    const p=sel[0], cost=evoCost(m); if(evoBlock(m)||save.gold<cost) return;
    save.gold-=cost;
    save.roster=save.roster.filter(x=>x.id!==p.id);
    const oldName=nameOf(m);
    m.skill=Math.max(m.skill,p.skill); m.evo=(m.evo||0)+1; m.lvl=1; m.xp=0;
    F.anim={type:'evolve',t:0,dur:2.4,fromEvo:m.evo-1,partner:{sp:p.sp,evo:p.evo||0}};
    F.result=`${oldName} evolved into ${nameOf(m)}!`;
    SFX.play('summon');
  }
  F.sel=[]; persist(); renderForge();
});
export function drawForge(dt){
  const f=fit($<HTMLCanvasElement>('#forgeCan')); if(!f) return; const {c,w,h}=f; const m=cardById(F.baseId); if(!m) return;
  const cx=w/2, cy=h*0.5, s=Math.min(w*0.16,h*0.26), col=F.mode==='evolve'?'#E7BE6E':ELEM[SPECIES[m.sp].el].color;
  F.rot+=dt*(F.anim?2.2:0.3); F.flash=Math.max(0,F.flash-dt*1.8);
  c.clearRect(0,0,w,h);
  const gr=c.createRadialGradient(cx,cy,0,cx,cy,w*0.5); gr.addColorStop(0,rgba(col,F.anim?0.28:0.14)); gr.addColorStop(1,rgba(col,0));
  c.fillStyle=gr; c.fillRect(0,0,w,h);
  drawSigil(c,cx,cy+s*0.86,s*2.2,0.3,col,F.rot,0.7);
  let evo=m.evo||0, scale=1, glow: string|null=null, drawBase=true;
  const a=F.anim;
  if(a){
    a.t+=dt; const k=a.t/a.dur;
    if(Math.random()<0.7){const an=Math.random()*Math.PI*2,R=s*2.6; F.parts.push({x:cx+Math.cos(an)*R,y:cy+Math.sin(an)*R*0.6,tx:cx,ty:cy,life:0.5,max:0.5,color:col})}
    if(a.type==='enhance'){
      const kk=clamp(k/0.55,0,1), n=a.fodder.length;
      if(kk<1) a.fodder.forEach((fd,i)=>{const an=i/n*Math.PI*2+a.t*4, r=s*2.4*(1-ease(kk));
        drawMonster(c,fd.sp,cx+Math.cos(an)*r,cy+Math.sin(an)*r*0.45,s*0.5,clock.t+i,{evo:fd.evo,alpha:1-kk*0.4,scale:1-kk*0.6,flash:kk*0.8})});
      if(kk>=1&&!a.hit){a.hit=true;F.flash=0.7;SFX.play('reveal','rare');buzz([20,40,60])}
      if(kk>=1){const q=clamp((k-0.55)/0.45,0,1); scale=1+0.18*Math.sin(q*Math.PI); glow=rgba(col,0.9)}
    } else {
      const kk=clamp(k/0.6,0,1);
      if(kk<1){
        drawBase=false; evo=a.fromEvo;
        const off=s*1.7*(1-ease(kk)), sp=kk*kk*14;
        drawMonster(c,a.partner.sp,cx+Math.cos(sp+Math.PI)*off,cy+Math.sin(sp+Math.PI)*off*0.35,s*0.9,clock.t+2,{evo:a.partner.evo,flash:kk*0.95,scale:1-kk*0.3});
        drawMonster(c,m.sp,cx+Math.cos(sp)*off,cy+Math.sin(sp)*off*0.35,s,clock.t,{evo,flash:kk*0.95,scale:1-kk*0.2});
      } else {
        if(!a.hit){a.hit=true;F.flash=1;SFX.play('reveal','epic');buzz([40,60,40,60,140]);}
        const q=clamp((k-0.6)/0.4,0,1); scale=0.5+0.5*ease(q*1.4); glow=rgba('#E7BE6E',0.95);
      }
    }
    if(a.t>=a.dur){F.anim=null; renderForge(); emit(a.type==='enhance'?'fused':'evolved')}
  }
  if(drawBase) drawMonster(c,m.sp,cx,cy,s,clock.t,{dir:1,evo,scale,glow});
  F.parts.forEach(p=>{p.life-=dt; const k=1-p.life/p.max; c.globalAlpha=clamp(p.life/p.max,0,1); c.fillStyle=p.color; ell(c,p.x+(p.tx-p.x)*k,p.y+(p.ty-p.y)*k,2.2,2.2); c.fill()});
  F.parts=F.parts.filter(p=>p.life>0); c.globalAlpha=1;
  if(F.flash>0){c.fillStyle=`rgba(255,248,230,${F.flash*0.8})`; c.fillRect(0,0,w,h)}
}
