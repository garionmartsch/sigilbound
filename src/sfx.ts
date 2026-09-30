import { onPrefs, prefs, setPref } from './prefs';
import { gainFor, scaleBuzz } from './settingsCore';
import { rand } from './util';

/* ---------- sound ---------- */
// Every sound is synthesized with the Web Audio API, so the game ships no audio files.

type ToneOpts = { type?: OscillatorType; f0: number; f1?: number; dur: number; vol?: number; at?: number; attack?: number };
type NoiseOpts = { dur: number; vol?: number; type?: BiquadFilterType; f0?: number; f1?: number; q?: number; at?: number; attack?: number };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

/** Browsers only allow audio after a user gesture, so this runs on the first tap or key press. */
function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  try {
    const c: AudioContext = new AC();
    const m = c.createGain(); m.gain.value = gainFor(prefs);
    const comp = c.createDynamicsCompressor(); m.connect(comp); comp.connect(c.destination);
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    ctx = c; master = m; noiseBuf = buf;
    if (c.state === 'suspended') c.resume().catch(() => {});
  } catch (e) { ctx = null; }
}
const ready = () => !!ctx && prefs.sound && prefs.volume > 0 && ctx.state === 'running';
// Volume changes glide over a few milliseconds so the slider doesn't click.
onPrefs(s => { if (ctx && master) master.gain.setTargetAtTime(gainFor(s), ctx.currentTime, 0.02); });

function env(g: GainNode, t: number, a: number, peak: number, dec: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
function tone({ type = 'sine', f0, f1, dur, vol = 0.3, at = 0, attack = 0.005 }: ToneOpts) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + attack + dur);
  env(g, t, attack, vol, dur); o.connect(g); g.connect(master);
  o.start(t); o.stop(t + attack + dur + 0.05);
}
function noise({ dur, vol = 0.3, type = 'bandpass', f0 = 1000, f1, q = 1, at = 0, attack = 0.005 }: NoiseOpts) {
  if (!ctx || !master || !noiseBuf) return;
  const t = ctx.currentTime + at, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; fl.type = type;
  fl.frequency.setValueAtTime(f0, t);
  if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + attack + dur);
  fl.Q.value = q;
  env(g, t, attack, vol, dur); s.connect(fl); fl.connect(g); g.connect(master);
  s.start(t, Math.random() * 0.4); s.stop(t + attack + dur + 0.05);
}

/** Sound recipes, played by name. */
const P: Record<string, (arg?: any) => void> = {
  tap(){noise({dur:0.06,vol:0.35,f0:2200,q:1.2}); tone({f0:190,f1:80,dur:0.08,vol:0.35})},
  slash(){const r=rand(0.88,1.12); noise({dur:0.15,vol:0.45,f0:700*r,f1:4200*r,q:2,attack:0.02})},
  hit(){tone({f0:130,f1:45,dur:0.16,vol:0.45}); noise({dur:0.08,vol:0.25,type:'lowpass',f0:1200})},
  hurt(){tone({type:'square',f0:110,f1:55,dur:0.14,vol:0.14}); tone({f0:90,f1:40,dur:0.2,vol:0.45}); noise({dur:0.1,vol:0.2,type:'lowpass',f0:900})},
  guard(){noise({dur:0.08,vol:0.18,f0:3200,f1:1600,q:2})},
  parry(){[1046,1568,2093,2637].forEach((f,i)=>tone({type:i%2?'triangle':'square',f0:f*rand(.99,1.01),dur:0.45-i*0.06,vol:0.08})); noise({dur:0.05,vol:0.4,f0:5000,q:0.7}); tone({f0:220,f1:110,dur:0.12,vol:0.3})},
  warn(){tone({type:'sawtooth',f0:160,f1:240,dur:0.14,vol:0.05})},
  window(){tone({f0:1320,dur:0.06,vol:0.14})},
  charge(){tone({f0:220,f1:880,dur:0.26,vol:0.16,attack:0.04}); noise({dur:0.26,vol:0.12,f0:600,f1:3000,q:3,attack:0.1})},
  fireball(){noise({dur:0.42,vol:0.28,type:'lowpass',f0:400,f1:1800,attack:0.06})},
  boom(){noise({dur:0.6,vol:0.55,type:'lowpass',f0:2500,f1:120,q:0.8}); tone({f0:90,f1:30,dur:0.5,vol:0.5})},
  vines(){for(let i=0;i<8;i++)noise({dur:0.04,vol:0.3,f0:rand(1800,4500),q:4,at:i*0.03+rand(0,0.02)}); tone({f0:70,f1:38,dur:0.4,vol:0.45})},
  wave(){noise({dur:0.8,vol:0.42,f0:300,f1:1600,q:0.8,attack:0.3}); noise({dur:0.45,vol:0.32,type:'highpass',f0:2500,at:0.45})},
  kill(){P.boom(); tone({type:'triangle',f0:440,f1:110,dur:0.5,vol:0.14,at:0.05})},
  banner(){tone({f0:98,dur:1.2,vol:0.25,attack:0.01}); tone({f0:196.5,dur:0.9,vol:0.1})},
  win(){[523,659,784,1047].forEach((f,i)=>tone({type:'triangle',f0:f,dur:0.35,vol:0.18,at:i*0.11}))},
  lose(){[392,311,262,196].forEach((f,i)=>tone({type:'triangle',f0:f,dur:0.4,vol:0.16,at:i*0.16}))},
  summon(){noise({dur:1.3,vol:0.22,f0:300,f1:5000,q:4,attack:1.0}); tone({f0:110,f1:440,dur:1.3,vol:0.12,attack:1})},
  reveal(r: string){const n=r==='mythic'?[392,523,659,784,988,1175,1568]:r==='legendary'?[440,554,659,880,1109,1319]:r==='epic'?[523,659,784,988,1319]:r==='rare'?[523,659,784,1047]:[523,784]; n.forEach((f,i)=>tone({type:'triangle',f0:f,dur:0.6,vol:0.16,at:i*0.07}));
    if(r==='epic'||r==='legendary'||r==='mythic')for(let i=0;i<(r==='mythic'?16:r==='legendary'?12:8);i++)tone({f0:rand(2000,4000),dur:0.15,vol:0.05,at:0.3+i*0.06})},
  shards(){for(let i=0;i<5;i++){tone({type:'triangle',f0:rand(1800,2600),f1:900,dur:0.12,vol:0.08,at:0.28+i*0.07}); noise({dur:0.05,vol:0.15,type:'highpass',f0:4000,at:0.5+i*0.07})}},
  thunder(){noise({dur:0.08,vol:0.5,type:'highpass',f0:2500}); noise({dur:0.7,vol:0.45,type:'lowpass',f0:900,f1:80,at:0.03}); tone({f0:60,f1:30,dur:0.5,vol:0.35,at:0.02})},
  rockfall(){noise({dur:0.42,vol:0.25,f0:300,f1:1200,q:1.5,attack:0.2})},
  tornado(){noise({dur:1.0,vol:0.4,f0:400,f1:2200,q:3,attack:0.3}); noise({dur:0.8,vol:0.25,f0:1800,f1:500,q:4,at:0.2})},
  beam(){[523,659,784,1047].forEach((f,i)=>tone({f0:f,dur:0.9,vol:0.08,attack:0.15,at:i*0.02})); noise({dur:0.8,vol:0.15,type:'highpass',f0:5000,attack:0.2})},
  voidcall(){tone({type:'sawtooth',f0:180,f1:40,dur:0.9,vol:0.1,attack:0.1}); noise({dur:0.6,vol:0.3,type:'lowpass',f0:200,f1:1500,attack:0.5}); tone({f0:55,dur:1.0,vol:0.3,attack:0.3})},
  ui(){tone({f0:660,dur:0.04,vol:0.07})},
};

export const SFX = {
  init,
  play(name: string, arg?: any) { if (!ready()) return; try { P[name]?.(arg); } catch (e) { /* ignore audio errors */ } },
  get muted() { return !prefs.sound; },
  setMuted(m: boolean) { setPref('sound', !m); if (!m) init(); },
};

/* ---------- haptics ---------- */
export const CAN_BUZZ = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
/** Vibrate, scaled by the player's vibration setting. */
export function buzz(pattern: number | number[]) {
  if (!CAN_BUZZ) return;
  const p = scaleBuzz(pattern, prefs.buzz);
  if (!p) return;
  try { navigator.vibrate(p); } catch (e) { /* not allowed here */ }
}

export function initSound() {
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => SFX.init(), { capture: true }));
  document.addEventListener('click', ev => {
    const b = (ev.target as Element | null)?.closest('button');
    if (b && !b.closest('#slots') && b.id !== 'btnSummon' && b.id !== 'btnFight') SFX.play('ui');
  });
}
