import { clamp, ease, ell, rand, rgba, type Ctx } from './util';

/* ---------- battle effects ---------- */
/**
 * One visual effect in flight: slashes, impacts and element specials.
 * t counts up to dur; end runs once when it finishes. The remaining
 * fields depend on the effect type (positions, sizes, colors).
 */
export interface Fx {
  type: string;
  t: number;
  dur: number;
  end?: () => void;
  [field: string]: any;
}

/** Fireball position along its arc. */
export function fbPos(f: Fx){const k=clamp(f.t/f.dur,0,1);return {x:f.x0+(f.x1-f.x0)*k,y:f.y0+(f.y1-f.y0)*k-Math.sin(Math.PI*k)*f.r*2.2}}
/** Crest position of the tide wave. */
export function waveX(f: Fx){const k=clamp(f.t/f.dur,0,1),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;return f.x0+(f.x1-f.x0)*e}
/** Filled tapered stroke along pts, with half-widths ws. */
export function ribbon(c: Ctx, pts: {x:number;y:number}[], ws: number[]){
  const L: [number,number][]=[],R: [number,number][]=[];
  for(let i=0;i<pts.length;i++){const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,nx=-dy/d,ny=dx/d;
    L.push([pts[i].x+nx*ws[i],pts[i].y+ny*ws[i]]); R.push([pts[i].x-nx*ws[i],pts[i].y-ny*ws[i]]);}
  c.beginPath(); L.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)); for(let i=R.length-1;i>=0;i--)c.lineTo(R[i][0],R[i][1]); c.closePath();
}
export function drawSlash(c: Ctx, f: Fx){
  const kIn=clamp(f.t/0.07,0,1), a=f.t<0.1?1:clamp(1-(f.t-0.1)/(f.dur-0.1),0,1);
  const dx=Math.cos(f.ang),dy=Math.sin(f.ang),px=-dy,py=dx,N=16;
  c.save(); c.globalCompositeOperation='lighter';
  for(let i=0;i<f.n;i++){
    const mid=(f.n-1)/2, off=(i-mid)*f.gap, L=f.len*(1-Math.abs(i-mid)*0.14);
    const ox=f.x+px*off, oy=f.y+py*off, pts: {x:number;y:number}[]=[], ws: number[]=[];
    for(let j=0;j<=N;j++){const u=j/N, uu=u*kIn, along=(uu-0.5)*L, bow=Math.sin(Math.PI*uu)*f.bow;
      pts.push({x:ox+dx*along+px*bow,y:oy+dy*along+py*bow}); ws.push(Math.max(0.3,Math.sin(Math.PI*u)*f.w*(0.6+0.4*a)));}
    c.globalAlpha=a*0.9; c.fillStyle=f.color; c.shadowColor=f.color; c.shadowBlur=20; ribbon(c,pts,ws); c.fill();
    c.shadowBlur=0; c.globalAlpha=a; c.fillStyle='#FFF7E6'; ribbon(c,pts,ws.map(w=>w*0.38)); c.fill();
  }
  c.restore();
}
export function drawImpact(c: Ctx, f: Fx){
  const k=f.t/f.dur, r=f.r*(0.35+0.75*ease(k));
  c.save(); c.globalCompositeOperation='lighter'; c.globalAlpha=1-k; c.translate(f.x,f.y);
  c.strokeStyle=f.color; c.lineWidth=2+4*(1-k); c.shadowColor=f.color; c.shadowBlur=14; ell(c,0,0,r,r); c.stroke();
  c.shadowBlur=0; c.fillStyle='#FFF4DC'; c.rotate(f.rot*6);
  for(let i=0;i<8;i++){c.rotate(Math.PI/4); const Lr=r*(i%2?0.9:1.35), W=r*0.09*(1-k)+1; c.beginPath(); c.moveTo(0,-W); c.lineTo(Lr,0); c.lineTo(0,W); c.closePath(); c.fill();}
  c.restore();
}
export function drawCharge(c: Ctx, f: Fx){
  const k=f.t/f.dur; c.save(); c.globalCompositeOperation='lighter';
  for(let i=0;i<3;i++){const kk=(k+i/3)%1, r=f.r*(1-kk); c.globalAlpha=kk*0.8; c.strokeStyle=f.color; c.lineWidth=3; ell(c,f.x,f.y,r,r); c.stroke();}
  const g=c.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r*0.7); g.addColorStop(0,rgba(f.color,0.55*k)); g.addColorStop(1,rgba(f.color,0));
  c.globalAlpha=1; c.fillStyle=g; ell(c,f.x,f.y,f.r*0.7,f.r*0.7); c.fill(); c.restore();
}
export function drawFireball(c: Ctx, f: Fx){
  const p=fbPos(f), r=f.r*(1+0.1*Math.sin(f.t*40));
  c.save(); c.globalCompositeOperation='lighter';
  const g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,r*1.8); g.addColorStop(0,'#FFFBEA'); g.addColorStop(0.25,'#FFD27A'); g.addColorStop(0.55,'#FF7A3D'); g.addColorStop(1,'rgba(228,104,58,0)');
  c.fillStyle=g; ell(c,p.x,p.y,r*1.8,r*1.8); c.fill(); c.restore();
}
export function drawExplosion(c: Ctx, f: Fx){
  const k=f.t/f.dur, r=Math.max(1,f.r*ease(k*1.3)), a=1-k;
  c.save(); c.globalCompositeOperation='lighter';
  const g=c.createRadialGradient(f.x,f.y,0,f.x,f.y,r); g.addColorStop(0,`rgba(255,250,230,${a})`); g.addColorStop(0.35,rgba(f.color,a*0.9)); g.addColorStop(1,rgba(f.color,0));
  c.fillStyle=g; ell(c,f.x,f.y,r,r); c.fill();
  c.strokeStyle=rgba('#FFE3A0',a); c.lineWidth=3; ell(c,f.x,f.y,r*1.15,r*1.05); c.stroke(); c.restore();
}
export function drawVines(c: Ctx, f: Fx){
  const t=f.t, s=f.s;
  const gk=clamp(t/0.2,0,1)*(t>f.dur-0.3?clamp((f.dur-t)/0.3,0,1):1);
  c.fillStyle=`rgba(10,6,4,${0.6*gk})`; ell(c,f.x,f.y,s*1.6*gk,s*0.32*gk); c.fill();
  f.vines.forEach(v=>{
    const tt=t-v.delay; if(tt<0) return;
    const gr=tt<0.22?ease(tt/0.22):(tt>f.dur-0.35?clamp(1-(tt-(f.dur-0.35))/0.3,0,1):1);
    if(gr<=0.01) return;
    const bx=f.x+v.dx, by=f.y, tx=bx+v.lean*gr, ty=by-v.h*gr, cx=bx-v.lean*0.6, cy=by-v.h*0.55*gr;
    const N=14, pts: {x:number;y:number}[]=[], ws: number[]=[];
    for(let j=0;j<=N;j++){const u=j/N; pts.push({x:(1-u)*(1-u)*bx+2*(1-u)*u*cx+u*u*tx,y:(1-u)*(1-u)*by+2*(1-u)*u*cy+u*u*ty}); ws.push(v.w*(1-u*0.92));}
    c.fillStyle='#244A2A'; ribbon(c,pts,ws); c.fill();
    c.fillStyle='#7DB85B'; ribbon(c,pts,ws.map(w=>w*0.45)); c.fill();
    c.fillStyle='#D9E8A8';
    for(let j=2;j<N;j+=3){const a=pts[j-1],b=pts[j+1],p=pts[j],ddx=b.x-a.x,ddy=b.y-a.y,d=Math.hypot(ddx,ddy)||1,side=j%2?1:-1,nx=-ddy/d*side,ny=ddx/d*side,w=ws[j],ux=ddx/d,uy=ddy/d;
      c.beginPath(); c.moveTo(p.x+nx*w-ux*w*0.6,p.y+ny*w-uy*w*0.6); c.lineTo(p.x+nx*(w+s*0.16)+ux*s*0.06,p.y+ny*(w+s*0.16)+uy*s*0.06); c.lineTo(p.x+nx*w+ux*w*0.6,p.y+ny*w+uy*w*0.6); c.closePath(); c.fill();}
  });
}
export function drawWave(c: Ctx, f: Fx){
  const k=f.t/f.dur, s=f.s, xc=waveX(f), b=f.base, a=k<0.12?k/0.12:(k>0.8?(1-k)/0.2:1), H=f.h*(0.75+0.25*Math.sin(Math.PI*k));
  c.save(); c.globalAlpha=clamp(a,0,1)*0.92;
  const g=c.createLinearGradient(0,b-H,0,b); g.addColorStop(0,'#CFF3FF'); g.addColorStop(0.25,'#5FB4F0'); g.addColorStop(0.7,'#2A6FA3'); g.addColorStop(1,'rgba(27,63,115,0.5)');
  c.fillStyle=g; c.beginPath(); c.moveTo(xc-s*3.2,b);
  c.quadraticCurveTo(xc-s*1.4,b-H*0.25,xc-s*0.5,b-H*0.85);
  c.quadraticCurveTo(xc+s*0.2,b-H*1.12,xc+s*0.9,b-H*0.82);
  c.quadraticCurveTo(xc+s*1.15,b-H*0.58,xc+s*0.62,b-H*0.5);
  c.quadraticCurveTo(xc+s*0.75,b-H*0.2,xc+s*1.5,b);
  c.closePath(); c.fill();
  c.strokeStyle='rgba(255,255,255,0.9)'; c.lineWidth=s*0.09; c.lineCap='round';
  c.beginPath(); c.moveTo(xc-s*0.7,b-H*0.8); c.quadraticCurveTo(xc+s*0.2,b-H*1.12,xc+s*0.9,b-H*0.82); c.quadraticCurveTo(xc+s*1.15,b-H*0.58,xc+s*0.62,b-H*0.5); c.stroke();
  c.strokeStyle='rgba(255,255,255,0.35)'; c.lineWidth=s*0.04;
  c.beginPath(); c.moveTo(xc-s*2.2,b-H*0.2); c.quadraticCurveTo(xc-s*1.2,b-H*0.35,xc-s*0.6,b-H*0.6); c.stroke();
  c.restore();
}
export function drawShard(c: Ctx, f: Fx){
  if(f.t<0) return; const k=clamp(f.t/f.dur,0,1), e=k*k, x=f.x0+(f.x1-f.x0)*e, y=f.y0+(f.y1-f.y0)*e, a=Math.atan2(f.y1-f.y0,f.x1-f.x0), L=f.len, W=L*0.18;
  c.save(); c.translate(x,y); c.rotate(a);
  c.globalCompositeOperation='lighter'; c.fillStyle='rgba(143,211,232,0.35)';
  c.beginPath(); c.moveTo(-L*1.4,0); c.lineTo(0,-W*0.6); c.lineTo(0,W*0.6); c.closePath(); c.fill();
  c.globalCompositeOperation='source-over';
  const g=c.createLinearGradient(-L/2,0,L/2,0); g.addColorStop(0,'#8FD3E8'); g.addColorStop(1,'#FFFFFF'); c.fillStyle=g;
  c.beginPath(); c.moveTo(L/2,0); c.lineTo(0,-W); c.lineTo(-L/2,0); c.lineTo(0,W); c.closePath(); c.fill();
  c.strokeStyle='rgba(255,255,255,.9)'; c.lineWidth=1; c.stroke(); c.restore();
}
export function drawBolt(c: Ctx, f: Fx){
  const k=f.t/f.dur, a=clamp(1-k,0,1), N=10, pts: [number,number][]=[];
  for(let i=0;i<=N;i++){const u=i/N; pts.push([f.x+(i&&i<N?rand(-1,1)*f.w*1.4:0), -20+(f.y+20)*u])}
  c.save(); c.globalCompositeOperation='lighter'; c.lineJoin='round'; c.lineCap='round';
  ([[f.w*0.9,`rgba(232,208,74,${0.55*a})`],[f.w*0.35,`rgba(255,255,240,${a})`]] as [number,string][]).forEach(([lw,col])=>{c.strokeStyle=col;c.lineWidth=lw;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke()});
  const g=c.createRadialGradient(f.x,f.y,0,f.x,f.y,f.w*5); g.addColorStop(0,`rgba(255,246,176,${0.8*a})`); g.addColorStop(1,'rgba(255,246,176,0)');
  c.fillStyle=g; ell(c,f.x,f.y,f.w*5,f.w*5); c.fill(); c.restore();
}
export function drawBoulder(c: Ctx, f: Fx){
  const k=clamp(f.t/f.dur,0,1), y=f.y0+(f.y1-f.y0)*k*k, r=f.r;
  c.fillStyle=`rgba(0,0,0,${0.15+0.35*k})`; ell(c,f.x,f.y1+r*1.4,r*(0.5+0.7*k),r*0.22*(0.5+0.7*k)); c.fill();
  if(!f.pts) f.pts=Array.from({length:9},(_,i)=>{const a=i/9*Math.PI*2, q=r*rand(0.8,1.05); return [Math.cos(a)*q,Math.sin(a)*q]});
  c.strokeStyle='rgba(201,174,134,.4)'; c.lineWidth=2;
  for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(f.x+i*r*0.5,y-r*1.1);c.lineTo(f.x+i*r*0.5,y-r*1.1-r*1.6*k);c.stroke()}
  c.save(); c.translate(f.x,y); c.rotate(k*2.5);
  const g=c.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,r); g.addColorStop(0,'#C9AE86'); g.addColorStop(1,'#5E4C38'); c.fillStyle=g;
  c.beginPath(); f.pts.forEach(([x,yy],i)=>i?c.lineTo(x,yy):c.moveTo(x,yy)); c.closePath(); c.fill();
  c.strokeStyle='rgba(40,30,20,.6)'; c.lineWidth=2; c.beginPath(); c.moveTo(-r*0.4,-r*0.1); c.lineTo(r*0.1,r*0.2); c.lineTo(r*0.35,r*0.05); c.stroke();
  c.restore();
}
export function tornadoX(f: Fx){const k=clamp(f.t/f.dur,0,1); return f.x0+(f.x1-f.x0)*ease(Math.min(1,k*1.8))}
export function drawTornado(c: Ctx, f: Fx){
  const k=f.t/f.dur, xc=tornadoX(f), a=k<0.15?k/0.15:(k>0.8?(1-k)/0.2:1), s=f.s;
  c.save(); c.globalAlpha=clamp(a,0,1);
  for(let j=0;j<14;j++){const u=j/13, y=f.base-u*f.h, w=s*(0.25+1.1*u*u+0.2*u), off=Math.sin(f.t*9+j*0.7)*s*0.25*u;
    c.strokeStyle=`rgba(230,255,242,${0.3+0.45*(1-u*0.5)})`; c.lineWidth=2+3*(1-u);
    c.beginPath(); c.ellipse(xc+off,y,w,w*0.22,0,f.t*12+j,f.t*12+j+Math.PI*1.4); c.stroke();}
  c.restore();
}
export function drawBeam(c: Ctx, f: Fx){
  const k=clamp(f.t/f.dur,0,1), open=Math.sin(Math.PI*k), w=Math.max(0.5,f.w*open);
  c.save(); c.globalCompositeOperation='lighter';
  const g=c.createLinearGradient(f.x-w,0,f.x+w,0); g.addColorStop(0,'rgba(255,224,138,0)'); g.addColorStop(0.5,`rgba(255,248,214,${0.85*open})`); g.addColorStop(1,'rgba(255,224,138,0)');
  c.fillStyle=g; c.fillRect(f.x-w,0,w*2,f.y);
  c.fillStyle=`rgba(255,255,255,${0.9*open})`; c.fillRect(f.x-w*0.12,0,w*0.24,f.y);
  const rg=c.createRadialGradient(f.x,f.y,0,f.x,f.y,w*1.6); rg.addColorStop(0,`rgba(255,240,190,${0.8*open})`); rg.addColorStop(1,'rgba(255,240,190,0)');
  c.fillStyle=rg; ell(c,f.x,f.y,w*1.6,w*0.5); c.fill(); c.restore();
}
export function drawVoid(c: Ctx, f: Fx){
  const k=f.t/f.dur, r=k<0.7?f.r*ease(k/0.7):f.r*(1-ease((k-0.7)/0.3)); if(r<1) return;
  c.save();
  const g=c.createRadialGradient(f.x,f.y,0,f.x,f.y,r); g.addColorStop(0,'rgba(8,4,14,0.96)'); g.addColorStop(0.7,'rgba(30,14,50,0.9)'); g.addColorStop(1,'rgba(168,123,232,0)');
  c.fillStyle=g; ell(c,f.x,f.y,r,r); c.fill();
  c.globalCompositeOperation='lighter'; c.strokeStyle='rgba(168,123,232,0.8)'; c.lineWidth=3;
  c.beginPath(); c.arc(f.x,f.y,r*0.72,f.t*6,f.t*6+Math.PI*1.5); c.stroke();
  c.beginPath(); c.arc(f.x,f.y,r*0.55,-f.t*8,-f.t*8+Math.PI); c.stroke();
  c.restore();
}
/** Drawing function for each effect type. */
export const FXDRAW: Record<string, (c: Ctx, f: Fx) => void> ={slash:drawSlash,impact:drawImpact,charge:drawCharge,fireball:drawFireball,explosion:drawExplosion,vines:drawVines,wave:drawWave,shard:drawShard,bolt:drawBolt,boulder:drawBoulder,tornado:drawTornado,beam:drawBeam,void:drawVoid};
