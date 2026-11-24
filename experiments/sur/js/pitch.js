// Microphone input and pitch detection (YIN).

export class PitchDetector {
  constructor(ctx) {
    this.ctx = ctx;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.buf = new Float32Array(this.analyser.fftSize);
    this.source = null;
    this.stream = null;
    this.minFreq = 55;
    this.maxFreq = 1200;
    this.tauMax = Math.min(Math.floor(ctx.sampleRate / this.minFreq), this.buf.length >> 1);
    this.diff = new Float32Array(this.tauMax + 1);
  }

  async startMic() {
    // Echo cancellation helps keep the tanpura out of the mic; noise
    // suppression and auto gain fight a steady sung tone, so they are off.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
    });
    this.attach(this.ctx.createMediaStreamSource(this.stream));
  }

  attach(node) {
    if (this.source) this.source.disconnect();
    this.source = node;
    node.connect(this.analyser);
  }

  /** Feed a test tone instead of the mic (for debugging without singing). */
  simulate(freq) {
    if (!this.sim) {
      this.sim = this.ctx.createOscillator();
      this.sim.type = 'triangle';
      this.simGain = this.ctx.createGain();
      this.simGain.gain.value = 0.3;
      this.sim.connect(this.simGain);
      this.sim.start();
      this.attach(this.simGain);
    }
    if (freq) {
      this.sim.frequency.setValueAtTime(freq, this.ctx.currentTime);
      this.simGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    } else {
      this.simGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  /**
   * Returns { freq, rms } where freq is null when there is no clear pitch
   * (silence, noise or a level under the gate, in dBFS).
   */
  read(gateDb) {
    const buf = this.buf;
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    const db = 20 * Math.log10(rms + 1e-12);
    if (db < gateDb) return { freq: null, db };
    return { freq: this.yin(buf), db };
  }

  yin(buf) {
    const sr = this.ctx.sampleRate;
    const tauMin = Math.max(2, Math.floor(sr / this.maxFreq));
    const tauMax = this.tauMax;
    const W = buf.length - tauMax;
    const d = this.diff;

    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let i = 0; i < W; i++) {
        const x = buf[i] - buf[i + tau];
        s += x * x;
      }
      d[tau] = s;
    }
    // Cumulative mean normalised difference.
    d[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      running += d[tau];
      d[tau] = running > 0 ? (d[tau] * tau) / running : 1;
    }

    const threshold = 0.15;
    let tau = -1;
    for (let t = tauMin; t <= tauMax; t++) {
      if (d[t] < threshold) {
        while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau < 0) return null;

    // Parabolic interpolation for sub-sample accuracy.
    let better = tau;
    if (tau > 1 && tau < tauMax) {
      const a = d[tau - 1], b = d[tau], c = d[tau + 1];
      const denom = a + c - 2 * b;
      if (denom !== 0) better = tau + (a - c) / (2 * denom);
    }
    return sr / better;
  }
}
