// Tiny WebAudio synth — no audio files needed.

let ctx = null;
let master = null;
let noiseBuf = null;
let muted = localStorage.getItem('pog2.muted') === '1';

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function isMuted() { return muted; }

export function setMuted(m) {
  muted = m;
  localStorage.setItem('pog2.muted', m ? '1' : '0');
  if (master) master.gain.value = m ? 0 : 0.6;
}

function tone(freq, dur, type = 'square', vol = 0.08, slideTo = null, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol, cutoff) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(cutoff, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(60, cutoff * 0.15), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

export const sfx = {
  shoot()     { tone(920, 0.07, 'square', 0.035, 420); },
  hit()       { noise(0.06, 0.12, 4000); },
  explode(big){ noise(big ? 0.55 : 0.3, big ? 0.3 : 0.2, big ? 900 : 1800); },
  planetHit() { tone(140, 0.35, 'sawtooth', 0.12, 45); noise(0.25, 0.15, 700); },
  shieldHit() { tone(520, 0.18, 'triangle', 0.1, 260); },
  power()     { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'triangle', 0.08, null, i * 0.06)); },
  powerOn()   { tone(660, 0.15, 'sine', 0.07, 990); },
  gameOver()  { tone(320, 1.1, 'sawtooth', 0.12, 40); noise(1.2, 0.3, 600); },
};
