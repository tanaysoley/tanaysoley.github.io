// Tanpura drone and single-note playback, synthesised with Web Audio.

function tanpuraWave(ctx) {
  const N = 48;
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  for (let k = 1; k < N; k++) {
    // Bright, slowly falling spectrum with a bump around the 8th–12th
    // harmonics, which is where the jawari buzz lives.
    const jawari = 1 + 0.9 * Math.exp(-(((k - 10) / 4) ** 2));
    imag[k] = (jawari / Math.pow(k, 0.85)) * (0.85 + 0.3 * Math.random());
  }
  return ctx.createPeriodicWave(real, imag);
}

export class Tanpura {
  constructor(ctx) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.volume = 0.5;
    this.out.gain.value = 0;
    this.out.connect(ctx.destination);
    this.wave = tanpuraWave(ctx);
    this.playing = false;
    this.timer = null;
  }

  setVolume(v) {
    this.volume = v;
    if (this.playing) this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  /** saFreq = madhya Sa in Hz, first = semitone of the first string (7 = Pa). */
  setTuning(saFreq, first) {
    const f = (n) => saFreq * Math.pow(2, n / 12);
    // Classic order: first string in the lower octave, two madhya Sa, kharaj Sa.
    this.strings = [f(first - 12), f(0), f(0), f(-12)];
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    this.out.gain.cancelScheduledValues(this.ctx.currentTime);
    this.out.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.step = 0;
    this.next = this.ctx.currentTime + 0.05;
    const gaps = [1.15, 1.15, 1.15, 1.6];
    const tick = () => {
      while (this.next < this.ctx.currentTime + 1.0) {
        this.pluck(this.strings[this.step], this.next);
        this.next += gaps[this.step];
        this.step = (this.step + 1) % 4;
      }
    };
    tick();
    this.timer = setInterval(tick, 200);
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
    // Fade out the strings that are still ringing; start() fades back in.
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
  }

  pluck(freq, t) {
    const ctx = this.ctx;
    const dur = 5.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.22, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.09, t + 1.2);
    env.gain.exponentialRampToValueAtTime(0.0005, t + dur);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(Math.min(freq * 18, 12000), t);
    lp.frequency.exponentialRampToValueAtTime(freq * 4, t + dur);

    // A resonant peak sweeping down the harmonics gives the shimmering buzz.
    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.Q.value = 5;
    peak.gain.value = 9;
    peak.frequency.setValueAtTime(Math.min(freq * 14, 10000), t);
    peak.frequency.exponentialRampToValueAtTime(freq * 3, t + 3.5);

    lp.connect(peak).connect(env).connect(this.out);
    for (const detune of [-3, 4]) {
      const o = ctx.createOscillator();
      o.setPeriodicWave(this.wave);
      o.frequency.value = freq;
      o.detune.value = detune;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }
}

/** Short harmonium-like tone for the note buttons. */
export class NotePlayer {
  constructor(ctx) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.35;
    this.out.connect(ctx.destination);
    this.current = null;
  }

  stop() {
    if (!this.current) return;
    this.current.gain.cancelScheduledValues(this.ctx.currentTime);
    this.current.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    this.current = null;
  }

  play(freq, dur = 1.4) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (this.current) {
      this.current.gain.cancelScheduledValues(t);
      this.current.gain.setTargetAtTime(0, t, 0.02);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.03);
    env.gain.setValueAtTime(0.5, t + Math.max(0.04, dur - Math.min(0.35, dur * 0.3)));
    env.gain.linearRampToValueAtTime(0, t + dur);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(freq * 8, 4000);
    lp.Q.value = 0.8;
    lp.connect(env).connect(this.out);

    const voices = [
      { type: 'sawtooth', mult: 1, detune: 0, gain: 0.5 },
      { type: 'sawtooth', mult: 1, detune: 6, gain: 0.4 },
      { type: 'square', mult: 0.5, detune: -3, gain: 0.18 },
    ];
    for (const v of voices) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = v.type;
      o.frequency.value = freq * v.mult;
      o.detune.value = v.detune;
      g.gain.value = v.gain;
      o.connect(g).connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    this.current = env;
  }
}
