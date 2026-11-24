// Sur Samraat: a 3D runner across bridges over the sea. Each swar of the
// song is a bridge at that swar's position; your pitch moves the runner
// sideways. Off the bridge (wrong swar, or silent) you are waist-deep in the
// water and your health drains. Rests are islands where you can stay quiet.

import { mod12, drawSwar, swarHTML } from './music.js';
import { SONGS, buildTimeline } from './songs.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const U = 2;            // world units per semitone, sideways
const SPEED = 9;        // world units per second, forward (-z)
const LATENCY = 0.08;   // pitch detection lag, seconds
const DRAIN = 20;       // health lost per second in the water
const WATER_Y = -0.55;
const BEST_KEY = 'sur.samraat.best.v1';

export const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', cents: 40 },
  { id: 'medium', label: 'Medium', cents: 25 },
  { id: 'hard', label: 'Hard', cents: 12 },
];

const zOf = (t) => -t * SPEED;

export class SurSamraat {
  /**
   * opts: el (ids → elements), script(), colorFor(absCents), font,
   *       playNote(n, dur), noteFreq(n), stopNotes()
   */
  constructor(opts) {
    this.o = opts;
    this.el = opts.el;
    this.state = 'menu'; // menu | loading | playing | paused | result
    this.difficulty = 'medium';
    this.guide = false;
    this.T = null;
    this.best = {};
    try { this.best = JSON.parse(localStorage.getItem(BEST_KEY) || '{}'); } catch { /* no storage */ }
    try {
      const saved = JSON.parse(localStorage.getItem('sur.samraat.prefs') || '{}');
      if (saved.difficulty) this.difficulty = saved.difficulty;
      if (typeof saved.guide === 'boolean') this.guide = saved.guide;
    } catch { /* no storage */ }

    this.el.pause.addEventListener('click', () => this.pause());
    this.el.resume.addEventListener('click', () => this.resume());
    this.el.quit.addEventListener('click', () => this.toMenu());
    this.el.retry.addEventListener('click', () => this.play(this.song));
    this.el.back.addEventListener('click', () => this.toMenu());
    this.renderMenu();
    this.show('menu');
  }

  savePrefs() {
    try { localStorage.setItem('sur.samraat.prefs', JSON.stringify({ difficulty: this.difficulty, guide: this.guide })); } catch { /* */ }
  }

  get tolCents() {
    return DIFFICULTIES.find((d) => d.id === this.difficulty).cents;
  }

  // ------------------------------------------------------------------ screens

  show(which) {
    this.el.menu.hidden = which !== 'menu';
    this.el.paused.hidden = which !== 'paused';
    this.el.result.hidden = which !== 'result';
    this.el.hud.hidden = !(which === 'playing' || which === 'paused');
  }

  renderMenu() {
    const script = this.o.script();
    const diffs = DIFFICULTIES.map((d) => `
      <label><input type="radio" name="samDiff" value="${d.id}" ${d.id === this.difficulty ? 'checked' : ''}>
      <span>${d.label} <small>±${d.cents}¢</small></span></label>`).join('');
    const cards = SONGS.map((s) => {
      const tl = buildTimeline(s);
      const best = (this.best[s.id] || {})[this.difficulty];
      const stars = [1, 2, 3].map((i) => `<span class="${best && best.stars >= i ? 'on' : ''}">★</span>`).join('');
      return `
        <div class="song">
          <div class="song-main">
            <div class="song-title">${script === 'rom' ? s.title : s.titleDev}</div>
            <div class="song-sub">${script === 'rom' ? s.titleDev : s.title}</div>
            <div class="song-blurb">${s.blurb}</div>
            <div class="song-meta">
              <span>${s.bpm} bpm</span><span>${Math.round(tl.duration)}s</span>
              <span class="song-range">${swarHTML(tl.low, script)} – ${swarHTML(tl.high, script)}</span>
              <span class="stars" aria-label="${best ? best.stars : 0} of 3 stars">${stars}</span>
              ${best ? `<span>best ${Math.round(best.acc * 100)}%</span>` : ''}
            </div>
          </div>
          <div class="song-actions">
            <button class="ghost" data-listen="${s.id}">Listen</button>
            <button class="primary" data-play="${s.id}">Play</button>
          </div>
        </div>`;
    }).join('');

    this.el.menu.innerHTML = `
      <div class="sam-menu">
        <div class="sam-title"><span class="sam-dev">सुर सम्राट</span><span class="sam-rom">Sur Samraat</span></div>
        <p class="sam-intro">Each swar of the song is a bridge over the sea. Sing it to stay on the bridge.
          A wrong swar, or going quiet, puts you in the water and drains your health. Islands are rests: breathe.</p>
        <div class="sam-opts">
          <div class="seg" role="radiogroup" aria-label="Difficulty (bridge width)">${diffs}</div>
          <label class="check"><input type="checkbox" id="samGuide" ${this.guide ? 'checked' : ''}>
            Play the melody as a guide <small>(use headphones)</small></label>
        </div>
        <div class="songs">${cards}</div>
        <p id="samErr" class="error" hidden></p>
      </div>`;

    this.el.menu.querySelectorAll('input[name=samDiff]').forEach((r) =>
      r.addEventListener('change', () => { this.difficulty = r.value; this.savePrefs(); this.renderMenu(); }));
    this.el.menu.querySelector('#samGuide').addEventListener('change', (e) => { this.guide = e.target.checked; this.savePrefs(); });
    this.el.menu.querySelectorAll('[data-play]').forEach((b) =>
      b.addEventListener('click', () => this.play(SONGS.find((s) => s.id === b.dataset.play))));
    this.el.menu.querySelectorAll('[data-listen]').forEach((b) =>
      b.addEventListener('click', () => {
        if (this.listenBtn === b) this.stopListening();
        else this.listen(SONGS.find((s) => s.id === b.dataset.listen), b);
      }));
  }

  /** Play the melody once so the player knows how it goes. */
  listen(song, btn) {
    this.stopListening();
    const tl = buildTimeline(song);
    btn.textContent = 'Stop';
    this.listenBtn = btn;
    // Skip the lead-in rest.
    const lead = tl.segs[0].kind === 'rest' ? tl.segs[0].t1 : 0;
    this.listenTimers = [];
    for (const s of tl.segs) {
      if (s.kind !== 'note') continue;
      const end = s.t1 + (tl.segs.find((x) => x.kind === 'free' && x.t0 === s.t1) ? 0.2 : 0);
      this.listenTimers.push(setTimeout(() => this.o.playNote(s.n, Math.max(0.15, end - s.t0)), (s.t0 - lead) * 1000));
    }
    this.listenTimers.push(setTimeout(() => this.stopListening(), (tl.duration - lead) * 1000));
  }

  stopListening() {
    (this.listenTimers || []).forEach(clearTimeout);
    this.listenTimers = [];
    if (this.listenBtn) {
      this.listenBtn.textContent = 'Listen';
      this.listenBtn = null;
    }
  }

  // --------------------------------------------------------------- 3D setup

  async ensureThree() {
    if (this.T) return true;
    try {
      this.T = await import(THREE_URL);
    } catch (e) {
      const err = this.el.menu.querySelector('#samErr');
      if (err) {
        err.hidden = false;
        err.textContent = 'Couldn’t load the 3D engine. Check your internet connection and try again.';
      }
      return false;
    }
    this.initScene();
    return true;
  }

  initScene() {
    const T = this.T;
    this.renderer = new T.WebGLRenderer({ canvas: this.el.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new T.Scene();
    this.scene.fog = new T.Fog(0xf2c4a0, 35, 120);
    this.camera = new T.PerspectiveCamera(58, 1, 0.1, 250);

    this.scene.add(new T.HemisphereLight(0xfff0dc, 0x2b5d80, 1.25));
    const sun = new T.DirectionalLight(0xfff4e0, 1.6);
    sun.position.set(-12, 22, 6);
    this.scene.add(sun);

    // The sea: a wavy plane that follows the camera.
    const geo = new T.PlaneGeometry(180, 180, 60, 60);
    geo.rotateX(-Math.PI / 2);
    this.oceanBase = Float32Array.from(geo.attributes.position.array);
    this.ocean = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0x2c7fb3, roughness: 0.55, metalness: 0.15, flatShading: true }));
    this.ocean.position.y = WATER_Y;
    this.scene.add(this.ocean);

    // Sun low on the horizon
    const sunDisc = new T.Mesh(new T.CircleGeometry(9, 40), new T.MeshBasicMaterial({ color: 0xffe2a8, fog: false }));
    this.sunDisc = sunDisc;
    this.scene.add(sunDisc);

    this.runner = this.makeRunner();
    this.scene.add(this.runner.group);

    // Splash ring shown while wading
    this.splash = new T.Mesh(new T.TorusGeometry(0.45, 0.06, 6, 24), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    this.splash.rotation.x = Math.PI / 2;
    this.scene.add(this.splash);

    this.level = new T.Group();
    this.scene.add(this.level);
  }

  mat(color, extra = {}) {
    return new this.T.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...extra });
  }

  makeRunner() {
    const T = this.T;
    const g = new T.Group();
    const skin = this.mat(0xc68a5c);
    const kurta = this.mat(0xd9622b);
    const dhoti = this.mat(0xf3ece0);
    const gold = this.mat(0xe8b923, { metalness: 0.6, roughness: 0.35 });

    const torso = new T.Mesh(new T.BoxGeometry(0.52, 0.72, 0.3), kurta);
    torso.position.y = 1.18;
    g.add(torso);
    const head = new T.Mesh(new T.IcosahedronGeometry(0.21, 1), skin);
    head.position.y = 1.78;
    g.add(head);
    // A small crown for the samraat
    const crown = new T.Mesh(new T.CylinderGeometry(0.17, 0.2, 0.16, 7, 1, true), gold);
    crown.position.y = 1.98;
    g.add(crown);
    for (let i = 0; i < 7; i++) {
      const spike = new T.Mesh(new T.ConeGeometry(0.04, 0.12, 4), gold);
      const a = (i / 7) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.17, 2.1, Math.sin(a) * 0.17);
      g.add(spike);
    }
    const limb = (w, h, d, m, px, py) => {
      const pivot = new T.Group();
      pivot.position.set(px, py, 0);
      const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), m);
      mesh.position.y = -h / 2;
      pivot.add(mesh);
      g.add(pivot);
      return pivot;
    };
    const legL = limb(0.18, 0.82, 0.2, dhoti, -0.13, 0.82);
    const legR = limb(0.18, 0.82, 0.2, dhoti, 0.13, 0.82);
    const armL = limb(0.13, 0.62, 0.15, kurta, -0.34, 1.5);
    const armR = limb(0.13, 0.62, 0.15, kurta, 0.34, 1.5);
    return { group: g, legL, legR, armL, armR };
  }

  swarTexture(n) {
    const T = this.T;
    const size = 128;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.beginPath();
    c.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    c.fill();
    const hue = (mod12(n) / 12) * 360;
    c.strokeStyle = `hsl(${hue} 60% 45%)`;
    c.lineWidth = 8;
    c.stroke();
    drawSwar(c, n, size / 2, size / 2 + 20, 54, '#1c1a17', this.o.script(), this.o.font);
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  clearLevel() {
    this.level.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
    this.level.clear();
  }

  buildLevel() {
    const T = this.T;
    this.clearLevel();
    this.labels = [];
    const tl = this.tl;
    const w = ((2 * this.tolCents) / 100) * U;
    const thick = 0.3;
    const textures = new Map();
    const swarMats = new Map();
    const noteMat = (n) => {
      const k = mod12(n);
      if (!swarMats.has(k)) swarMats.set(k, this.mat(new T.Color().setHSL(k / 12, 0.5, 0.55)));
      return swarMats.get(k);
    };
    const plankMat = this.mat(0xa8774a);
    const postMat = this.mat(0x6b4a32);
    const seamMat = this.mat(0x3d2a1c);
    const sandMat = this.mat(0xeed9a8);
    const trunkMat = this.mat(0x8a6040);
    const leafMat = this.mat(0x3f9a52);
    const rockMat = this.mat(0x8f8a80);
    const postGeo = new T.CylinderGeometry(0.07, 0.07, 3, 5);

    const addPosts = (xL, xR, z0, z1) => {
      for (let z = z0 - 0.5; z > z1; z -= 5) {
        for (const x of [xL, xR]) {
          const p = new T.Mesh(postGeo, postMat);
          p.position.set(x, -1.6, z);
          this.level.add(p);
        }
      }
    };

    const midX = ((tl.low + tl.high) / 2) * U;
    const islandW = (tl.high - tl.low) * U + 18;

    for (const s of tl.segs) {
      const z0 = zOf(s.t0);
      const z1 = zOf(s.t1);
      const len = z0 - z1;
      if (s.kind === 'note') {
        const x = s.n * U;
        const m = new T.Mesh(new T.BoxGeometry(w, thick, len), noteMat(s.n));
        m.position.set(x, -thick / 2, (z0 + z1) / 2);
        this.level.add(m);
        addPosts(x - w / 2 + 0.07, x + w / 2 - 0.07, z0, z1);
        if (s.split) {
          const seam = new T.Mesh(new T.BoxGeometry(w + 0.02, thick + 0.02, 0.12), seamMat);
          seam.position.set(x, -thick / 2, z0);
          this.level.add(seam);
        }
        if (!s.split) {
          if (!textures.has(s.n)) textures.set(s.n, this.swarTexture(s.n));
          const sprite = new T.Sprite(new T.SpriteMaterial({ map: textures.get(s.n), depthWrite: false }));
          sprite.scale.set(1.1, 1.1, 1);
          // Beside the bridge, so it never blocks the view of the road.
          sprite.position.set(x - w / 2 - 0.75, 0.9, z0 - 0.3);
          this.level.add(sprite);
          this.labels.push(sprite);
        }
      } else if (s.kind === 'free') {
        const xa = Math.min(s.nA, s.nB) * U - w / 2;
        const xb = Math.max(s.nA, s.nB) * U + w / 2;
        const m = new T.Mesh(new T.BoxGeometry(xb - xa, thick * 0.8, len), plankMat);
        m.position.set((xa + xb) / 2, -thick * 0.4, (z0 + z1) / 2);
        this.level.add(m);
      } else if (s.kind === 'glide') {
        const xa = s.nA * U;
        const xb = s.nB * U;
        const shape = new T.Shape();
        shape.moveTo(xa - w / 2, z0);
        shape.lineTo(xa + w / 2, z0);
        shape.lineTo(xb + w / 2, z1);
        shape.lineTo(xb - w / 2, z1);
        shape.closePath();
        const geo = new T.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
        geo.rotateX(Math.PI / 2);
        const m = new T.Mesh(geo, this.mat(new T.Color().setHSL(mod12(s.nB) / 12, 0.45, 0.62)));
        this.level.add(m);
        // Posts follow the diagonal
        for (let z = z0 - 0.5; z > z1; z -= 5) {
          const x = xa + (xb - xa) * ((z0 - z) / len);
          for (const dx of [-w / 2 + 0.07, w / 2 - 0.07]) {
            const p = new T.Mesh(postGeo, postMat);
            p.position.set(x + dx, -1.6, z);
            this.level.add(p);
          }
        }
      } else if (s.kind === 'rest') {
        const m = new T.Mesh(new T.BoxGeometry(islandW, 1.2, len + 1.2), sandMat);
        m.position.set(midX, -0.6, (z0 + z1) / 2);
        this.level.add(m);
        // A few palms and rocks along the edges
        const count = Math.max(1, Math.floor(len / 7));
        for (let i = 0; i < count; i++) {
          const side = i % 2 ? 1 : -1;
          const x = midX + side * (islandW / 2 - 1.5 - Math.random() * 2);
          const z = z0 - (i + 0.5) * (len / count);
          if (Math.random() < 0.7) {
            const palm = new T.Group();
            const trunk = new T.Mesh(new T.CylinderGeometry(0.12, 0.2, 3.2, 6), trunkMat);
            trunk.position.y = 1.6;
            trunk.rotation.z = side * 0.15;
            palm.add(trunk);
            for (let k = 0; k < 5; k++) {
              const leaf = new T.Mesh(new T.ConeGeometry(0.35, 2, 4), leafMat);
              leaf.position.set(side * 0.25, 3.1, 0);
              leaf.rotation.set(0, (k / 5) * Math.PI * 2, Math.PI / 2.4);
              palm.add(leaf);
            }
            palm.position.set(x, 0, z);
            this.level.add(palm);
          } else {
            const rock = new T.Mesh(new T.DodecahedronGeometry(0.6 + Math.random() * 0.5, 0), rockMat);
            rock.position.set(x, 0.1, z);
            this.level.add(rock);
          }
        }
      }
    }

    // Finish gate
    const zEnd = zOf(tl.duration) + 3;
    const gateMat = this.mat(0xe8b923, { metalness: 0.5, roughness: 0.4 });
    for (const side of [-1, 1]) {
      const pillar = new T.Mesh(new T.CylinderGeometry(0.35, 0.4, 5, 8), gateMat);
      pillar.position.set(midX + side * 4, 2.5, zEnd);
      this.level.add(pillar);
    }
    const lintel = new T.Mesh(new T.BoxGeometry(9.4, 0.6, 0.8), gateMat);
    lintel.position.set(midX, 5.1, zEnd);
    this.level.add(lintel);
    const end = new T.Mesh(new T.BoxGeometry(islandW, 1.2, 30), sandMat);
    end.position.set(midX, -0.6, zOf(tl.duration) - 14);
    this.level.add(end);
  }

  // --------------------------------------------------------------- gameplay

  async play(song) {
    this.stopListening();
    this.song = song;
    this.state = 'loading';
    if (!(await this.ensureThree())) {
      this.state = 'menu';
      return;
    }
    this.tl = buildTimeline(song);
    this.buildLevel();
    this.time = 0;
    this.segIdx = 0;
    this.health = 100;
    this.judged = 0;
    this.onTime = 0;
    this.stats = new Map(); // n -> { judged, on, sum, count }
    this.runX = this.tl.firstNote * U;
    this.runY = 0;
    this.camX = this.runX;
    this.lastGuide = -1;
    this.state = 'playing';
    this.show('playing');
    this.updateHud(null, false, null);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.show('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.show('playing');
  }

  toMenu() {
    this.state = 'menu';
    this.renderMenu();
    this.show('menu');
  }

  segAt(t) {
    const segs = this.tl.segs;
    while (this.segIdx < segs.length - 1 && t >= segs[this.segIdx].t1) this.segIdx++;
    const s = segs[this.segIdx];
    return t >= s.t0 && t < s.t1 ? s : null;
  }

  /** Is this pitch on the bridge for this segment at time t? */
  judge(s, t, pitch) {
    if (!pitch.voiced) return { on: false, cents: null };
    const tol = this.tolCents / 100;
    const p = pitch.semis;
    if (s.kind === 'note') {
      const d = p - s.n;
      return { on: Math.abs(d) <= tol, cents: d * 100 };
    }
    if (s.kind === 'free') {
      const lo = Math.min(s.nA, s.nB) - tol;
      const hi = Math.max(s.nA, s.nB) + tol;
      return { on: p >= lo && p <= hi, cents: null };
    }
    const k = (t - s.t0) / (s.t1 - s.t0);
    const d = p - (s.nA + (s.nB - s.nA) * k);
    return { on: Math.abs(d) <= tol, cents: d * 100 };
  }

  tick(now, dtMs, pitch) {
    if (!this.T || this.state === 'menu' || this.state === 'loading') return;
    const dt = dtMs / 1000;
    if (this.state === 'playing') this.step(dt, pitch);
    this.render(now);
  }

  step(dt, pitch) {
    this.time += dt;
    const jt = this.time - LATENCY;
    const s = jt >= 0 ? this.segAt(jt) : null;

    let judged = false;
    let res = { on: true, cents: null };
    if (s && s.kind !== 'rest' && !(s.kind === 'note' && jt - s.t0 < s.grace)) {
      judged = true;
      res = this.judge(s, jt, pitch);
      this.judged += dt;
      if (res.on) this.onTime += dt;
      else this.health = Math.max(0, this.health - DRAIN * dt);
      if (s.kind === 'note') {
        if (!this.stats.has(s.n)) this.stats.set(s.n, { judged: 0, on: 0, sum: 0, count: 0 });
        const st = this.stats.get(s.n);
        st.judged += dt;
        if (res.on) st.on += dt;
        if (res.cents != null && Math.abs(res.cents) <= 100) { st.sum += res.cents; st.count++; }
      }
    }
    this.inWater = judged && !res.on;

    // Guide melody: play each swar as the runner reaches it.
    if (this.guide) {
      const segs = this.tl.segs;
      for (let i = this.lastGuide + 1; i < segs.length && segs[i].t0 <= this.time; i++) {
        const g = segs[i];
        this.lastGuide = i;
        if (g.kind === 'note' && !g.split) {
          const next = segs[i + 1];
          const end = next && next.kind === 'free' ? next.t1 : g.t1;
          this.o.playNote(g.n, Math.max(0.2, end - g.t0));
        }
      }
    }

    // Runner follows the voice sideways; stays put when silent.
    if (pitch.voiced) {
      const target = Math.max(-14, Math.min(26, pitch.semis)) * U;
      this.runX += (target - this.runX) * Math.min(1, dt * 14);
    }
    this.updateHud(s, judged, res);

    if (this.health <= 0) this.finish(false);
    else if (this.time >= this.tl.duration) this.finish(true);
  }

  finish(cleared) {
    this.state = 'result';
    this.o.stopNotes();
    const acc = this.judged > 0 ? this.onTime / this.judged : 0;
    const stars = !cleared ? 0 : acc >= 0.92 ? 3 : acc >= 0.8 ? 2 : acc >= 0.6 ? 1 : 0;
    const prev = (this.best[this.song.id] || {})[this.difficulty];
    const isBest = cleared && (!prev || stars > prev.stars || (stars === prev.stars && acc > prev.acc));
    if (isBest) {
      this.best[this.song.id] = { ...(this.best[this.song.id] || {}), [this.difficulty]: { stars, acc } };
      try { localStorage.setItem(BEST_KEY, JSON.stringify(this.best)); } catch { /* */ }
    }

    const script = this.o.script();
    const rows = [...this.stats.entries()]
      .filter(([, st]) => st.judged > 0.05 && st.on / st.judged < 0.9)
      .sort((a, b) => a[1].on / a[1].judged - b[1].on / b[1].judged)
      .slice(0, 4)
      .map(([n, st]) => {
        const pct = Math.round((st.on / st.judged) * 100);
        const off = st.count ? st.sum / st.count : null;
        const tend = off == null ? '' : Math.abs(off) <= this.tolCents / 2 ? 'centred' : off > 0 ? `${Math.round(off)}¢ sharp` : `${Math.round(-off)}¢ flat`;
        return `<div class="sw-row"><span class="sw">${swarHTML(n, script)}</span><span>${pct}% on the bridge</span><span class="muted">${tend}</span></div>`;
      }).join('');

    const starHtml = [1, 2, 3].map((i) => `<span class="${stars >= i ? 'on' : ''}">★</span>`).join('');
    const diff = DIFFICULTIES.find((d) => d.id === this.difficulty);
    this.el.result.querySelector('.res-body').innerHTML = `
      <div class="eyebrow">${script === 'rom' ? this.song.title : this.song.titleDev} · ${diff.label}</div>
      <h2>${cleared ? 'Song cleared!' : 'Swept into the sea'}</h2>
      <div class="stars big">${starHtml}</div>
      <div class="res-stats">
        <div><b>${Math.round(acc * 100)}%</b><span>on the bridge</span></div>
        <div><b>${Math.round(this.health)}</b><span>health left</span></div>
        <div><b>${Math.round(Math.min(this.time, this.tl.duration))}s</b><span>of ${Math.round(this.tl.duration)}s</span></div>
      </div>
      ${isBest ? '<p class="res-best">New best for this song!</p>' : ''}
      ${rows ? `<div class="eyebrow">Swars to work on</div><div class="sw-list">${rows}</div>`
        : cleared ? `<p class="muted">Every swar was at least 90% on the bridge.${this.difficulty !== 'hard' ? ' Try a narrower bridge?' : ''}</p>` : ''}`;
    this.show('result');
  }

  updateHud(seg, judged, res) {
    const script = this.o.script();
    this.el.health.style.width = `${this.health}%`;
    this.el.health.style.background = `hsl(${Math.round(this.health * 1.2)} 70% 48%)`;
    this.el.progress.style.width = `${Math.min(100, (this.time / this.tl.duration) * 100)}%`;
    this.el.acc.textContent = this.judged > 0 ? `${Math.round((this.onTime / this.judged) * 100)}%` : '—';

    // Current and next swar
    const segs = this.tl.segs;
    const t = Math.max(0, this.time - LATENCY);
    let cur = null;
    let next = null;
    for (let i = this.segIdx; i < segs.length; i++) {
      const s = segs[i];
      if (s.kind !== 'note') continue;
      if (!cur && s.t0 <= t && t < s.t1) cur = s;
      else if (s.t0 > t && (!next || s.t0 < next.t0)) { next = s; break; }
    }
    const curKey = cur ? cur.n : seg && seg.kind === 'rest' ? 'rest' : seg ? 'move' : 'rest';
    if (curKey !== this.hudCur || script !== this.hudScript) {
      this.el.now.innerHTML = cur ? swarHTML(cur.n, script) : `<span class="muted">${curKey === 'rest' ? 'rest' : '→'}</span>`;
      this.hudCur = curKey;
    }
    const nextKey = next ? next.n : 'end';
    if (nextKey !== this.hudNext || script !== this.hudScript) {
      this.el.next.innerHTML = next ? swarHTML(next.n, script) : '<span class="muted">end</span>';
      this.hudNext = nextKey;
    }
    this.hudScript = script;
    this.el.now.style.color = res && res.cents != null ? this.o.colorFor(Math.abs(res.cents)) : '';

    let msg = '';
    if (this.time < (segs[0].kind === 'rest' ? segs[0].t1 : 0)) {
      const left = Math.ceil(segs[0].t1 - this.time);
      msg = `Get ready… ${left}`;
    } else if (judged && !res.on) {
      msg = res.cents == null ? (seg.kind === 'free' ? 'Move to the next swar' : 'Keep singing!') : res.cents > 0 ? 'Too high ↓' : 'Too low ↑';
    }
    if (msg !== this.hudMsg) {
      this.el.msg.textContent = msg;
      this.el.msg.classList.toggle('warn', judged && !res.on);
      this.hudMsg = msg;
    }
  }

  // ----------------------------------------------------------------- render

  render(now) {
    const T = this.T;
    const canvas = this.el.canvas;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const size = this.renderer.getSize(new T.Vector2());
    if (size.x !== w || size.y !== h) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    const t = now / 1000;
    const z = zOf(this.time);
    const dt = 1 / 60;

    // Runner: sink into the water when off the bridge
    const targetY = this.inWater ? -0.95 : 0;
    this.runY += (targetY - this.runY) * Math.min(1, dt * 10);
    const r = this.runner;
    const running = this.state === 'playing';
    const phase = this.time * 11;
    const swing = running ? Math.sin(phase) : 0;
    const wade = this.inWater ? 0.45 : 1;
    r.legL.rotation.x = swing * 0.8 * wade;
    r.legR.rotation.x = -swing * 0.8 * wade;
    r.armL.rotation.x = -swing * 0.7;
    r.armR.rotation.x = swing * 0.7;
    const bob = running && !this.inWater ? Math.abs(Math.cos(phase)) * 0.08 : 0;
    r.group.position.set(this.runX, this.runY + bob, z);
    r.group.rotation.z = running ? Math.sin(phase) * 0.03 : 0;

    this.splash.visible = this.inWater && running;
    this.splash.position.set(this.runX, WATER_Y + 0.12, z);
    const sc = 1 + 0.25 * Math.sin(t * 9);
    this.splash.scale.set(sc, sc, sc);

    // Camera follows from behind and above
    this.camX += (this.runX - this.camX) * Math.min(1, dt * 4);
    this.camera.position.set(this.camX, 4.3, z + 8.5);
    this.camera.lookAt(this.camX, 0.4, z - 14);

    // Sea follows the camera (snapped so waves stay put) and moves
    const step = 3;
    this.ocean.position.x = Math.round(this.camX / step) * step;
    this.ocean.position.z = Math.round((z - 50) / step) * step;
    const pos = this.ocean.geometry.attributes.position;
    const arr = pos.array;
    const base = this.oceanBase;
    const ox = this.ocean.position.x;
    const oz = this.ocean.position.z;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i] + ox;
      const zz = base[i + 2] + oz;
      arr[i + 1] = Math.sin(x * 0.35 + t * 1.3) * 0.14 + Math.sin(zz * 0.28 - t * 0.9) * 0.16;
    }
    pos.needsUpdate = true;
    this.ocean.geometry.computeVertexNormals();

    // Labels disappear once the runner reaches them.
    for (const l of this.labels) l.visible = l.position.z < z - 0.5;

    this.sunDisc.position.set(this.camX + 20, 8, z - 140);
    this.renderer.render(this.scene, this.camera);
  }
}
