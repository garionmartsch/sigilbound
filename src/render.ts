import { ELEM, SPECIES } from './data';
import type { Species } from './types';
import { darker, ell, lighter, mixHex, rgba, type Ctx } from './util';

/* ---------- beast art (images override code-drawn beasts) ---------- */
// Add a beast's key and the forms (0 base, 1 evolved, 2 final) you have images for: files live at art/<key>_<form>.webp
/* ---------- beast art (images override code-drawn beasts) ---------- */
/**
 * Beasts that have image art, and which forms (0 base, 1 evolved, 2 final).
 * Files live in public/art/<key>_<form>.webp. A beast or form missing here
 * is drawn in code instead.
 */
export const ART_FILES: Record<string, number[]> = { cindermaw: [0, 1, 2] };

interface LoadedArt { img: HTMLImageElement; white?: HTMLCanvasElement; red?: HTMLCanvasElement }
const ART: Record<string, LoadedArt> = {};

/** A solid-color silhouette of an image, used for hit flashes and wind-up glow. */
function tintCanvas(img: HTMLImageElement, color: string): HTMLCanvasElement | undefined {
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const x = cv.getContext('2d');
  if (!x) return undefined;
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = color; x.fillRect(0, 0, cv.width, cv.height);
  return cv;
}
Object.entries(ART_FILES).forEach(([k, forms]) => forms.forEach(e => {
  const img = new Image(); img.decoding = 'async';
  img.onload = () => {
    try { ART[k + '_' + e] = { img, white: tintCanvas(img, '#ffffff'), red: tintCanvas(img, '#ff2f3f') }; }
    catch (err) { ART[k + '_' + e] = { img }; }
  };
  img.src = `art/${k}_${e}.webp`;
}));

/** Options for drawing one beast. */
export interface DrawOpts {
  /** 1 faces right (the player's side), -1 faces left (enemies). */
  dir?: number;
  /** Evolution stage 0-2. */
  evo?: number;
  /** 0..1 white hit flash. */
  flash?: number;
  /** 0..1 red wind-up glow. */
  red?: number;
  alpha?: number;
  scale?: number;
  /** Squash and stretch on hits. */
  sx?: number;
  sy?: number;
  /** Glow color around the beast. */
  glow?: string | null;
}
/** Body colors after tinting. */
export interface Palette { c1: string; c2: string; eye: string }

function drawArt(c: Ctx, art: LoadedArt, s: number, t: number, o: DrawOpts, evo: number, tintC: string | null, tintA: number) {
  const img = art.img, br = 1 + Math.sin(t * 2.4) * 0.022, flip = (o.dir || 1) < 0 ? -1 : 1, grow = 1 + 0.06 * evo;
  let H = s * 2.3 * grow, W = H * img.naturalWidth / img.naturalHeight;
  const maxW = s * 2.7 * grow;
  if (W > maxW) { H *= maxW / W; W = maxW; }
  c.save(); c.translate(0, s * 0.84); c.scale(flip * br, 1 / br);
  if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = s * 0.5; }
  c.drawImage(img, -W / 2, -H, W, H); c.shadowBlur = 0;
  if (tintA > 0) {
    const tc = tintC === '#ffffff' ? art.white : art.red;
    if (tc) { c.globalAlpha *= tintA; c.drawImage(tc, -W / 2, -H, W, H); }
  }
  c.restore();
}

/* ---------- monster drawing ---------- */
/** Draw a beast centered at (x, y) with body radius s, animated by time t. */
export function drawMonster(c: Ctx, key: string, x: number, y: number, s: number, t: number, o: DrawOpts = {}) {
  const base = SPECIES[key]; if (!base) return;
  const evo = o.evo || 0;
  const sp: Species = evo ? { ...base, evo, c1: mixHex(base.c1, '#000000', 0.12 * evo), c2: mixHex(base.c2, '#ffffff', 0.1 * evo) } : base;
  const dir = o.dir || 1;
  let tintC: string | null = null, tintA = 0;
  if ((o.flash ?? 0) > 0) { tintC = '#ffffff'; tintA = (o.flash ?? 0) * 0.75; }
  else if ((o.red ?? 0) > 0) { tintC = '#ff2f3f'; tintA = (o.red ?? 0) * 0.45; }
  const T = (h: string) => (tintC ? mixHex(h, tintC, tintA) : h);
  const p: Palette = { c1: T(sp.c1), c2: T(sp.c2), eye: T(sp.eye) };
  c.save(); c.translate(x,y); c.globalAlpha=o.alpha??1;
  const sc=o.scale??1; c.scale(sc,sc); if(o.sx||o.sy) c.scale(o.sx||1,o.sy||1);
  c.fillStyle='rgba(0,0,0,0.38)'; ell(c,0,s*0.86,s*0.8,s*0.16); c.fill();
  const art=ART[key+'_'+evo];
  if(art){drawArt(c,art,s,t,o,evo,tintC,tintA); c.restore(); return}
  if(evo){
    const ec=ELEM[sp.el].color, ag=c.createRadialGradient(0,-s*0.1,s*0.2,0,-s*0.1,s*1.5);
    ag.addColorStop(0,rgba(ec,0.3*evo)); ag.addColorStop(1,rgba(ec,0)); c.fillStyle=ag; ell(c,0,-s*0.1,s*1.5,s*1.5); c.fill();
    if(evo>=2){const ga=c.globalAlpha; c.fillStyle='#F2CF83';
      for(let i=0;i<8;i++){const a=t*0.8+i*Math.PI/4; c.save(); c.translate(Math.cos(a)*s*1.2,Math.sin(a)*s*0.42-s*0.15); c.rotate(Math.PI/4); c.globalAlpha=ga*(0.45+0.45*Math.sin(a)); c.fillRect(-s*0.055,-s*0.055,s*0.11,s*0.11); c.restore();}}
    c.scale(1+0.06*evo,1+0.06*evo);
  }
  if(o.glow){c.shadowColor=o.glow;c.shadowBlur=s*0.5}
  if(sp.body==='brute') brute(c,sp,p,s,t,dir);
  else if(sp.body==='wisp') wisp(c,sp,p,s,t,dir);
  else if(sp.body==='avian') avian(c,sp,p,s,t,dir);
  else if(sp.body==='golem') golem(c,sp,p,s,t,dir);
  else serpent(c,sp,p,s,t,dir);
  c.restore();
}
/** Glowing eyes with blink; list holds [x, y, sizeFactor?] per eye. */
function eyes(c: Ctx, p: Palette, s: number, t: number, dir: number, list: [number, number, number?][], r: number){
  const blink=(t%4.3)<0.12;
  list.forEach(([ex,ey,k])=>{
    const rr=r*(k||1);
    c.fillStyle=p.eye; c.shadowColor=p.eye; c.shadowBlur=rr*1.2;
    ell(c,ex,ey,rr,blink?rr*0.12:rr*0.85); c.fill(); c.shadowBlur=0;
    if(!blink){c.fillStyle='#1A0B10'; ell(c,ex+dir*rr*0.25,ey+rr*0.05,rr*0.28,rr*0.62); c.fill();
      c.fillStyle='rgba(255,255,255,.85)'; ell(c,ex-rr*0.3,ey-rr*0.35,rr*0.18,rr*0.18); c.fill();}
  });
}
function brute(c: Ctx, sp: Species, p: Palette, s: number, t: number, dir: number){
  const bob=Math.sin(t*2.4)*s*0.04, br=1+Math.sin(t*2.4)*0.025;
  c.fillStyle=darker(p.c1,0.35);
  ell(c,-s*0.45,s*0.66,s*0.24,s*0.19); c.fill(); ell(c,s*0.45,s*0.66,s*0.24,s*0.19); c.fill();
  c.save(); c.translate(0,bob); c.scale(br,1/br);
  const n=Math.min(6,(sp.horns||0)+2*(sp.evo||0)), hornC=mixHex(p.c2,'#F3E6CC',0.55);
  c.fillStyle=hornC;
  for(let i=0;i<n;i++){
    const side=i%2===0?-1:1,k=Math.floor(i/2);
    const hx=side*s*(0.42+k*0.24), hy=-s*0.52+k*s*0.16, L=s*(0.7-k*0.22);
    c.beginPath(); c.moveTo(hx-side*s*0.15,hy+s*0.1);
    c.quadraticCurveTo(hx+side*s*0.34,hy-L*0.2,hx+side*s*0.26,hy-L);
    c.quadraticCurveTo(hx+side*s*0.1,hy-L*0.2,hx+side*s*0.14,hy+s*0.14); c.closePath(); c.fill();
  }
  if(sp.fins){ c.fillStyle=darker(p.c2,0.1);
    [-1,1].forEach(side=>{c.beginPath();c.moveTo(side*s*0.5,-s*0.5);c.lineTo(side*s*0.95,-s*0.95+Math.sin(t*3+side)*s*0.05);c.lineTo(side*s*0.78,-s*0.35);c.closePath();c.fill();});
  }
  if(sp.spikes){ c.fillStyle=mixHex(p.c2,'#E8F0C8',0.3);
    const ns=3+(sp.evo||0); for(let i=-ns;i<=ns;i++){const a=-Math.PI/2+i*(1/ns), bx=Math.cos(a)*s*0.84, by=Math.sin(a)*s*0.7+s*0.02;
      c.beginPath();c.moveTo(bx-Math.sin(a)*s*0.12,by+Math.cos(a)*s*0.12);c.lineTo(bx+Math.cos(a)*s*0.34,by+Math.sin(a)*s*0.34);c.lineTo(bx+Math.sin(a)*s*0.12,by-Math.cos(a)*s*0.12);c.closePath();c.fill();}
  }
  const g=c.createRadialGradient(-s*0.25,-s*0.35,s*0.05,0,0,s*1.05);
  g.addColorStop(0,p.c2); g.addColorStop(0.55,p.c1); g.addColorStop(1,darker(p.c1,0.4));
  c.fillStyle=g; ell(c,0,0,s*0.92,s*0.78); c.fill();
  c.fillStyle=rgba(p.c2,0.3); ell(c,0,s*0.3,s*0.55,s*0.36); c.fill();
  c.fillStyle=darker(p.c1,0.18);
  const sw=Math.sin(t*2.4)*s*0.04;
  ell(c,-s*0.9,s*0.2+sw,s*0.2,s*0.3); c.fill(); ell(c,s*0.9,s*0.2-sw,s*0.2,s*0.3); c.fill();
  const ex=dir*s*0.1;
  eyes(c,p,s,t,dir,[[ex-s*0.3,-s*0.24],[ex+s*0.3,-s*0.24]],s*0.13);
  c.strokeStyle=darker(p.c1,0.55); c.lineWidth=s*0.07; c.lineCap='round';
  c.beginPath(); c.moveTo(ex-s*0.46,-s*0.44); c.lineTo(ex-s*0.16,-s*0.36); c.moveTo(ex+s*0.46,-s*0.44); c.lineTo(ex+s*0.16,-s*0.36); c.stroke();
  c.fillStyle='#1A0B10';
  c.beginPath(); c.moveTo(ex-s*0.42,s*0.1); c.quadraticCurveTo(ex,s*0.52,ex+s*0.42,s*0.1); c.quadraticCurveTo(ex,s*0.2,ex-s*0.42,s*0.1); c.fill();
  c.fillStyle='#F6EEDD';
  for(let i=0;i<4;i++){const tx=ex-s*0.3+i*s*0.2; c.beginPath(); c.moveTo(tx-s*0.055,s*0.14+Math.abs(i-1.5)*s*0.01); c.lineTo(tx+s*0.055,s*0.14+Math.abs(i-1.5)*s*0.01); c.lineTo(tx,s*0.26); c.closePath(); c.fill();}
  c.restore();
}
function wisp(c: Ctx, sp: Species, p: Palette, s: number, t: number, dir: number){
  const bob=Math.sin(t*2)*s*0.09;
  c.save(); c.translate(0,bob-s*0.12);
  for(let i=0;i<4;i++){const yy=s*(0.62+i*0.16), xx=Math.sin(t*3+i*1.3)*s*0.16;
    c.fillStyle=rgba(p.c1,0.55-i*0.12); ell(c,xx,yy,s*(0.32-i*0.06),s*(0.13-i*0.02)); c.fill();}
  const f1=Math.sin(t*7)*s*0.08,f2=Math.sin(t*6+1)*s*0.11,f3=Math.sin(t*8+2)*s*0.08;
  const g=c.createRadialGradient(0,s*0.15,s*0.05,0,0,s*1.1);
  g.addColorStop(0,lighter(p.c2,0.25)); g.addColorStop(0.45,p.c2); g.addColorStop(0.8,p.c1); g.addColorStop(1,darker(p.c1,0.3));
  c.fillStyle=g;
  c.beginPath(); c.moveTo(0,s*0.66);
  c.bezierCurveTo(s*0.88,s*0.62,s*0.84,-s*0.3,s*0.32,-s*0.66);
  c.quadraticCurveTo(s*0.38,-s*0.92+f1,s*0.2,-s*1.08+f1);
  c.quadraticCurveTo(s*0.1,-s*0.78,0,-s*1.34+f2);
  c.quadraticCurveTo(-s*0.1,-s*0.78,-s*0.22,-s*1.02+f3);
  c.quadraticCurveTo(-s*0.38,-s*0.86+f3,-s*0.32,-s*0.66);
  c.bezierCurveTo(-s*0.84,-s*0.3,-s*0.88,s*0.62,0,s*0.66);
  c.fill();
  [-1,1].forEach(side=>{const hy=s*0.12+Math.sin(t*2.6+side)*s*0.08;
    c.fillStyle=p.c2; ell(c,side*s*0.9,hy,s*0.14,s*0.17); c.fill();
    c.fillStyle=rgba(p.c2,0.4); ell(c,side*s*0.9,hy-s*0.16,s*0.07,s*0.1); c.fill();});
  const ex=dir*s*0.08;
  if((sp.eyes||1)===3||(sp.evo||0)>=2) eyes(c,p,s,t,dir,[[ex,-s*0.12,1],[ex-s*0.36,-s*0.34,0.5],[ex+s*0.36,-s*0.34,0.5]],s*0.22);
  else eyes(c,p,s,t,dir,[[ex,-s*0.12,1]],s*0.25);
  for(let i=0;i<2*(sp.evo||0);i++){const a=t*2+i*Math.PI/(sp.evo||1); c.fillStyle=p.c2; c.shadowColor=p.c2; c.shadowBlur=s*0.2; ell(c,Math.cos(a)*s*1.0,Math.sin(a)*s*0.3-s*0.2,s*0.08,s*0.11); c.fill(); c.shadowBlur=0;}
  c.strokeStyle=darker(p.c1,0.5); c.lineWidth=s*0.05; c.lineCap='round';
  c.beginPath(); c.moveTo(ex-s*0.16,s*0.25); c.quadraticCurveTo(ex,s*0.33,ex+s*0.16,s*0.25); c.stroke();
  c.restore();
}
function serpent(c: Ctx, sp: Species, p: Palette, s: number, t: number, dir: number){
  c.fillStyle=darker(p.c1,0.3); ell(c,0,s*0.62,s*0.86,s*0.26); c.fill();
  c.fillStyle=p.c1; ell(c,0,s*0.52,s*0.72,s*0.22); c.fill();
  c.fillStyle=rgba(p.c2,0.5); ell(c,0,s*0.5,s*0.5,s*0.1); c.fill();
  c.strokeStyle=p.c1; c.lineWidth=s*0.12; c.lineCap='round';
  c.beginPath(); c.moveTo(-s*0.7,s*0.55); c.quadraticCurveTo(-s*1.05,s*0.3+Math.sin(t*3)*s*0.08,-s*0.85,s*0.15); c.stroke();
  const N=7, pts: {x:number;y:number;r:number}[]=[];
  for(let i=0;i<N;i++){const k=i/(N-1); pts.push({x:Math.sin(t*2.2+k*3.2)*s*0.24*(1-k*0.5)+dir*k*s*0.08, y:s*0.4-k*s*1.05, r:s*(0.3-0.1*k)});}
  pts.forEach((q,i)=>{
    const g=c.createRadialGradient(q.x-q.r*0.4,q.y-q.r*0.4,q.r*0.1,q.x,q.y,q.r*1.1);
    g.addColorStop(0,lighter(p.c1,0.15)); g.addColorStop(1,darker(p.c1,0.25));
    c.fillStyle=g; ell(c,q.x,q.y,q.r,q.r); c.fill();
    c.fillStyle=rgba(p.c2,0.75); ell(c,q.x+dir*q.r*0.35,q.y,q.r*0.45,q.r*0.55); c.fill();
  });
  const h=pts[N-1], hx=h.x, hy=h.y-s*0.22;
  c.fillStyle=darker(p.c2,0.05);
  [-1,1].forEach(side=>{const w=Math.sin(t*4+side)*s*0.05; c.beginPath(); c.moveTo(hx+side*s*0.25,hy-s*0.05); c.lineTo(hx+side*s*(0.62+0.15*(sp.evo||0)),hy-s*(0.38+0.15*(sp.evo||0))+w); c.lineTo(hx+side*s*0.52,hy-s*0.1+w); c.lineTo(hx+side*s*0.66,hy+s*0.05); c.lineTo(hx+side*s*0.28,hy+s*0.12); c.closePath(); c.fill();});
  if(sp.crown||(sp.evo||0)>=2){ c.fillStyle=mixHex(p.c2,'#FFF3A8',0.4);
    for(let i=-2;i<=2;i++){const bx=hx+i*s*0.12; c.beginPath(); c.moveTo(bx-s*0.06,hy-s*0.24); c.lineTo(bx,hy-s*(0.52-Math.abs(i)*0.08)); c.lineTo(bx+s*0.06,hy-s*0.24); c.closePath(); c.fill();}}
  const g=c.createRadialGradient(hx-s*0.15,hy-s*0.15,s*0.05,hx,hy,s*0.5);
  g.addColorStop(0,lighter(p.c1,0.2)); g.addColorStop(1,darker(p.c1,0.2));
  c.fillStyle=g; ell(c,hx,hy,s*0.42,s*0.3); c.fill();
  c.fillStyle=p.c1; ell(c,hx+dir*s*0.2,hy+s*0.08,s*0.28,s*0.17); c.fill();
  eyes(c,p,s,t,dir,[[hx-s*0.15+dir*s*0.06,hy-s*0.06],[hx+s*0.17+dir*s*0.06,hy-s*0.06]],s*0.1);
  c.strokeStyle='#12080C'; c.lineWidth=s*0.035; c.lineCap='round';
  c.beginPath(); c.moveTo(hx-s*0.05+dir*s*0.1,hy+s*0.14); c.quadraticCurveTo(hx+dir*s*0.25,hy+s*0.2,hx+dir*s*0.42,hy+s*0.1); c.stroke();
}

/** Rounded rectangle path. */
function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath()}
function golem(c: Ctx, sp: Species, p: Palette, s: number, t: number, dir: number){
  const bob=Math.sin(t*1.8)*s*0.03, sw=Math.sin(t*1.8)*s*0.04, evo=sp.evo||0;
  c.fillStyle=darker(p.c1,0.4); rr(c,-s*0.56,s*0.3,s*0.36,s*0.52,s*0.08); c.fill(); rr(c,s*0.2,s*0.3,s*0.36,s*0.52,s*0.08); c.fill();
  c.save(); c.translate(0,bob);
  c.fillStyle=darker(p.c1,0.22);
  rr(c,-s*1.1,-s*0.4+sw,s*0.38,s*0.8,s*0.14); c.fill(); rr(c,s*0.72,-s*0.4-sw,s*0.38,s*0.8,s*0.14); c.fill();
  c.fillStyle=darker(p.c1,0.38);
  rr(c,-s*1.16,s*0.32+sw,s*0.5,s*0.36,s*0.12); c.fill(); rr(c,s*0.66,s*0.32-sw,s*0.5,s*0.36,s*0.12); c.fill();
  const g=c.createLinearGradient(0,-s*0.65,0,s*0.5); g.addColorStop(0,lighter(p.c1,0.18)); g.addColorStop(0.5,p.c1); g.addColorStop(1,darker(p.c1,0.35));
  c.fillStyle=g; rr(c,-s*0.8,-s*0.62,s*1.6,s*1.12,s*0.24); c.fill();
  c.strokeStyle=darker(p.c1,0.5); c.lineWidth=s*0.03; c.lineCap='round';
  c.beginPath(); c.moveTo(-s*0.6,-s*0.3); c.lineTo(-s*0.42,-s*0.12); c.lineTo(-s*0.5,s*0.1); c.moveTo(s*0.55,-s*0.4); c.lineTo(s*0.4,-s*0.2); c.moveTo(s*0.5,s*0.25); c.lineTo(s*0.32,s*0.32); c.stroke();
  const pulse=0.75+0.25*Math.sin(t*3);
  c.fillStyle=p.eye; c.shadowColor=p.c2; c.shadowBlur=s*0.5*pulse;
  c.beginPath(); c.moveTo(0,-s*0.2); c.lineTo(s*0.16,0); c.lineTo(0,s*0.2); c.lineTo(-s*0.16,0); c.closePath(); c.fill(); c.shadowBlur=0;
  const nc=2+evo; c.fillStyle=lighter(p.c2,0.1);
  [-1,1].forEach(side=>{for(let i=0;i<nc;i++){const bx=side*s*(0.45+i*0.12), by=-s*0.58+i*s*0.05, L=s*(0.42-i*0.06);
    c.beginPath(); c.moveTo(bx-s*0.07,by); c.lineTo(bx+side*s*0.06,by-L); c.lineTo(bx+s*0.08,by); c.closePath(); c.fill();}});
  c.fillStyle=darker(p.c1,0.1); rr(c,-s*0.3+dir*s*0.05,-s*0.98,s*0.6,s*0.42,s*0.12); c.fill();
  const blink=(t%4.3)<0.12;
  c.fillStyle=p.eye; c.shadowColor=p.eye; c.shadowBlur=s*0.25;
  rr(c,-s*0.2+dir*s*0.1,-s*0.82,s*0.4,blink?s*0.02:s*0.08,s*0.03); c.fill(); c.shadowBlur=0;
  c.restore();
}
function avian(c: Ctx, sp: Species, p: Palette, s: number, t: number, dir: number){
  const evo=sp.evo||0, bob=Math.sin(t*3)*s*0.08, flap=Math.sin(t*7);
  c.save(); c.translate(0,bob-s*0.12);
  [-1,1].forEach(side=>{
    const sc=1+0.12*evo;
    c.save(); c.translate(side*s*0.3,-s*0.05); c.rotate(side*(-0.25+flap*0.35));
    c.fillStyle=side===-1?darker(p.c1,0.2):p.c1;
    c.beginPath(); c.moveTo(0,0);
    c.quadraticCurveTo(side*s*0.8*sc,-s*0.95*sc,side*s*1.35*sc,-s*0.6*sc);
    c.quadraticCurveTo(side*s*1.12*sc,-s*0.36*sc,side*s*1.2*sc,-s*0.18*sc);
    c.quadraticCurveTo(side*s*0.92*sc,-s*0.1*sc,side*s*0.96*sc,s*0.08*sc);
    c.quadraticCurveTo(side*s*0.62*sc,s*0.02,side*s*0.58*sc,s*0.24);
    c.quadraticCurveTo(side*s*0.3,s*0.18,0,s*0.22); c.closePath(); c.fill();
    c.strokeStyle=rgba(p.c2,0.75); c.lineWidth=s*0.05; c.lineCap='round';
    c.beginPath(); c.moveTo(side*s*0.1,-s*0.04); c.quadraticCurveTo(side*s*0.7*sc,-s*0.62*sc,side*s*1.2*sc,-s*0.52*sc); c.stroke();
    c.restore();
  });
  c.fillStyle=darker(p.c1,0.15);
  for(let i=-1;i<=1;i++){c.beginPath(); c.moveTo(-s*0.12,s*0.45); c.quadraticCurveTo(i*s*0.3,s*0.8,i*s*0.42,s*0.95-Math.abs(i)*s*0.08); c.quadraticCurveTo(i*s*0.1,s*0.7,s*0.12,s*0.45); c.closePath(); c.fill();}
  let g=c.createRadialGradient(-s*0.15,-s*0.1,s*0.05,0,s*0.1,s*0.7); g.addColorStop(0,p.c2); g.addColorStop(0.6,p.c1); g.addColorStop(1,darker(p.c1,0.35));
  c.fillStyle=g; ell(c,0,s*0.12,s*0.55,s*0.5); c.fill();
  c.fillStyle=rgba(p.c2,0.4); ell(c,0,s*0.25,s*0.32,s*0.3); c.fill();
  c.strokeStyle=mixHex(p.c2,'#E0A23A',0.6); c.lineWidth=s*0.06; c.lineCap='round';
  c.beginPath(); c.moveTo(-s*0.15,s*0.58); c.lineTo(-s*0.18,s*0.75); c.moveTo(s*0.15,s*0.58); c.lineTo(s*0.18,s*0.75); c.stroke();
  const hx=dir*s*0.12, hy=-s*0.42, nc=3+evo;
  c.fillStyle=p.c2;
  for(let i=0;i<nc;i++){const a=-Math.PI/2-dir*(0.2+i*0.22), L=s*(0.45-i*0.05);
    c.beginPath(); c.moveTo(hx-s*0.08,hy-s*0.25); c.quadraticCurveTo(hx+Math.cos(a)*L*0.6,hy-s*0.35+Math.sin(a)*L*0.6,hx+Math.cos(a)*L,hy-s*0.2+Math.sin(a)*L);
    c.quadraticCurveTo(hx+Math.cos(a)*L*0.4,hy-s*0.25+Math.sin(a)*L*0.3,hx+s*0.08,hy-s*0.22); c.closePath(); c.fill();}
  g=c.createRadialGradient(hx-s*0.1,hy-s*0.1,s*0.03,hx,hy,s*0.4); g.addColorStop(0,lighter(p.c1,0.2)); g.addColorStop(1,darker(p.c1,0.15));
  c.fillStyle=g; ell(c,hx,hy,s*0.36,s*0.32); c.fill();
  c.fillStyle=mixHex(p.c2,'#E8A93A',0.6);
  c.beginPath(); c.moveTo(hx+dir*s*0.2,hy-s*0.02); c.lineTo(hx+dir*s*0.5,hy+s*0.08); c.lineTo(hx+dir*s*0.2,hy+s*0.14); c.closePath(); c.fill();
  eyes(c,p,s,t,dir,[[hx-s*0.12+dir*s*0.04,hy-s*0.06],[hx+s*0.12+dir*s*0.04,hy-s*0.06]],s*0.085);
  c.restore();
}

/* ---------- sigil ---------- */
const RUNES='ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
/** Rotating summoning circle; flat < 1 squashes it into a floor ellipse. */
export function drawSigil(c: Ctx, x: number, y: number, r: number, flat: number, color: string, rot: number, alpha: number){
  c.save(); c.translate(x,y); c.scale(1,flat); c.globalAlpha=alpha;
  c.strokeStyle=color; c.fillStyle=color; c.lineWidth=2/Math.max(flat,.3);
  c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.stroke();
  c.lineWidth=1/Math.max(flat,.3);
  c.beginPath(); c.arc(0,0,r*0.8,0,Math.PI*2); c.stroke();
  c.rotate(rot);
  const pts=7; c.beginPath();
  for(let i=0;i<=pts;i++){const a=i*(Math.PI*2/pts)*3; const px=Math.cos(a)*r*0.8, py=Math.sin(a)*r*0.8; i?c.lineTo(px,py):c.moveTo(px,py);}
  c.stroke();
  if(flat>0.6){ c.font=`${Math.round(r*0.11)}px serif`; c.textAlign='center'; c.textBaseline='middle';
    for(let i=0;i<16;i++){const a=i/16*Math.PI*2; c.save(); c.rotate(a); c.fillText(RUNES[i%RUNES.length],0,-r*0.9); c.restore();}
  } else {
    for(let i=0;i<24;i++){const a=i/24*Math.PI*2; c.beginPath(); c.moveTo(Math.cos(a)*r*0.84,Math.sin(a)*r*0.84); c.lineTo(Math.cos(a)*r*0.96,Math.sin(a)*r*0.96); c.stroke();}
  }
  c.restore();
}
