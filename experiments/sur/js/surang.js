// Surang (सुरंग, "tunnel"): a side-scrolling pitch game. A ball rolls forward
// only while you sing, and its height is your pitch. Each stage is a tunnel
// shaped like a short sargam phrase: a passage at each swar's height, as long
// as the note is held, joined by vertical shafts. Touch a wall, or go quiet
// inside a tunnel (the ball drops to the floor), and you go back to the start
// of the stage. Pads between tunnels are where you breathe.
//
// World units: x = seconds of singing, y = semitones from madhya Sa (up).

import { mod12, drawSwar, swarHTML } from './music.js';
import { loadTheme } from './sprites.js';

export const SG_DIFFICULTIES = [
  { id: 'easy', label: 'Wide', cents: 40 },
  { id: 'medium', label: 'Medium', cents: 25 },
  { id: 'hard', label: 'Narrow', cents: 15 },
];
export const SG_TEMPOS = [
  { id: 'slow', label: 'Slow', beat: 1.0 },
  { id: 'medium', label: 'Medium', beat: 0.75 },
  { id: 'fast', label: 'Fast', beat: 0.55 },
];

const PAD_LEN = 1.0;        // seconds of singing to cross a pad
const JOINT = 0.55;         // width of a vertical shaft, in beats
const LAST_NOTE = 1.5;      // the last swar, and turning swars, are held this many beats
const HANG = 0.15;          // seconds of silence before the ball starts to drop
const GRAVITY = 60;         // semitones / s²
const FOLLOW = 0.05;        // ball → pitch smoothing time constant, seconds
const MAX_STAGE_NOTES = 10; // longer up-and-down phrases are skipped (one breath)
const FAIL_TIME = 0.8;
const GUTTER = 30;          // px, lane labels on the left
const PPS_MIN = 55;         // px per second of singing, when a stage must scroll
const PPS_MAX = 120;
const PREFS = 'sur.surang.prefs';

const ROCK_TOP = 1.4;       // semitones of rock above the highest passage
const PAD_Y = -1.1;         // pad surface, semitones (below madhya Sa)

// ---------------------------------------------------------------------------
// Stages: grow the aroha one swar at a time, going up and then up-and-down,
// and finish with the full aroha and the full avaroha.
// ---------------------------------------------------------------------------

export function buildStages(scale) {
  let up = [...new Set(scale.aroha.filter((n) => n >= 0 && n <= 12))].sort((a, b) => a - b);
  if (up[0] !== 0) up.unshift(0);
  if (up[up.length - 1] !== 12) up.push(12);
  const downAll = [...new Set(scale.avaroha.filter((n) => n >= 0 && n <= 12))].sort((a, b) => b - a);
  const down = (peak) => {
    const d = downAll.filter((n) => n < peak);
    if (d[d.length - 1] !== 0) d.push(0);
    return d;
  };
  const stages = [];
  for (let k = 2; k < up.length - 1; k++) {
    const asc = up.slice(0, k + 1);
    stages.push(asc);
    const updown = [...asc, ...down(up[k])];
    if (updown.length <= MAX_STAGE_NOTES) stages.push(updown);
  }
  stages.push(up);
  stages.push([12, ...down(12)]);
  return stages;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function subtract(intervals, a, b) {
  const out = [];
  for (const [s, e] of intervals) {
    if (b <= s || a >= e) { out.push([s, e]); continue; }
    if (a > s) out.push([s, a]);
    if (b < e) out.push([b, e]);
  }
  return out;
}

/**
 * Outline of a union of rectangles. Returns wall segments with the side the
 * rock is on: { o: 'h'|'v', c, a, b, out } where 'h' is the line y = c from
 * x = a..b and out = +1 means rock is at +y; 'v' is x = c from y = a..b and
 * out = +1 means rock is at +x. `open` rects count as open space but get no
 * walls (the tunnel mouths).
 */
function outline(rects, open) {
  const all = rects.concat(open);
  const E = 1e-7;
  const groups = new Map();
  const add = (o, c, out, iv) => {
    const key = `${o}|${c.toFixed(6)}|${out}`;
    if (!groups.has(key)) groups.set(key, { o, c, out, iv: [] });
    groups.get(key).iv.push(...iv);
  };
  for (const r of rects) {
    let iv = [[r.x0, r.x1]];
    for (const q of all) if (q !== r && q.y0 <= r.y1 + E && q.y1 > r.y1 + E) iv = subtract(iv, q.x0, q.x1);
    add('h', r.y1, 1, iv);
    iv = [[r.x0, r.x1]];
    for (const q of all) if (q !== r && q.y1 >= r.y0 - E && q.y0 < r.y0 - E) iv = subtract(iv, q.x0, q.x1);
    add('h', r.y0, -1, iv);
    iv = [[r.y0, r.y1]];
    for (const q of all) if (q !== r && q.x1 >= r.x0 - E && q.x0 < r.x0 - E) iv = subtract(iv, q.y0, q.y1);
    add('v', r.x0, -1, iv);
    iv = [[r.y0, r.y1]];
    for (const q of all) if (q !== r && q.x0 <= r.x1 + E && q.x1 > r.x1 + E) iv = subtract(iv, q.y0, q.y1);
    add('v', r.x1, 1, iv);
  }
  const segs = [];
  for (const g of groups.values()) {
    const iv = g.iv.filter(([s, e]) => e - s > 1e-6).sort((p, q) => p[0] - q[0]);
    let cur = null;
    for (const [s, e] of iv) {
      if (cur && s <= cur[1] + 1e-6) cur[1] = Math.max(cur[1], e);
      else { if (cur) segs.push({ o: g.o, c: g.c, out: g.out, a: cur[0], b: cur[1] }); cur = [s, e]; }
    }
    if (cur) segs.push({ o: g.o, c: g.c, out: g.out, a: cur[0], b: cur[1] });
  }
  return segs;
}

const inside = (rects, x, y) => rects.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);

/** Corners of the outline: which way the rock square faces, and its type. */
function corners(segs, rects, face0, face1) {
  const pts = new Map();
  for (const s of segs) {
    const ends = s.o === 'h' ? [[s.a, s.c], [s.b, s.c]] : [[s.c, s.a], [s.c, s.b]];
    for (const [x, y] of ends) pts.set(`${x.toFixed(6)}|${y.toFixed(6)}`, [x, y]);
  }
  const out = new Map();
  const e = 1e-5;
  for (const [key, [x, y]] of pts) {
    if (Math.abs(x - face0) < 1e-6 || Math.abs(x - face1) < 1e-6) continue;
    const q = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => ({ sx, sy, open: inside(rects, x + sx * e, y + sy * e) }));
    const n = q.filter((d) => d.open).length;
    if (n === 1) {
      const p = q.find((d) => d.open);
      out.set(key, { x, y, type: 'in', sx: -p.sx, sy: -p.sy });
    } else if (n === 3) {
      const r = q.find((d) => !d.open);
      out.set(key, { x, y, type: 'out', sx: r.sx, sy: r.sy });
    }
  }
  return out;
}

const ptKey = (x, y) => `${x.toFixed(6)}|${y.toFixed(6)}`;

// ---------------------------------------------------------------------------

export class Surang {
  /** opts: el, script(), scale(), font, playNote(n, dur), openSettings() */
  constructor(opts) {
    this.o = opts;
    this.el = opts.el;
    this.g = this.el.canvas.getContext('2d');
    this.state = 'menu'; // menu | playing | paused | result
    this.difficulty = 'medium';
    this.tempo = 'medium';
    try {
      const p = JSON.parse(localStorage.getItem(PREFS) || '{}');
      if (SG_DIFFICULTIES.some((d) => d.id === p.difficulty)) this.difficulty = p.difficulty;
      if (SG_TEMPOS.some((d) => d.id === p.tempo)) this.tempo = p.tempo;
    } catch { /* no storage */ }

    const themeName = new URLSearchParams(location.search).get('theme') || 'placeholder';
    this.ready = loadTheme(themeName).then((t) => { this.theme = t; });

    this.cam = { left: 0, pps: 80, ppsemi: 30, top: 13, ox: GUTTER + 6, oy: 0, init: false };
    this.trail = [];
    this.sparks = [];
    this.geoCache = new Map();
    this.size = { w: 0, h: 0, dpr: 1 };

    this.el.pause.addEventListener('click', () => this.pause());
    this.el.resume.addEventListener('click', () => this.resume());
    this.el.quit.addEventListener('click', () => this.toMenu());
    this.el.retry.addEventListener('click', () => this.start(this.firstStage || 0));
    this.el.back.addEventListener('click', () => this.toMenu());
    this.el.canvas.addEventListener('pointerdown', (e) => this.onTap(e));

    this.renderMenu();
    this.show('menu');
  }

  savePrefs() {
    try { localStorage.setItem(PREFS, JSON.stringify({ difficulty: this.difficulty, tempo: this.tempo })); } catch { /* */ }
  }

  get tol() { return SG_DIFFICULTIES.find((d) => d.id === this.difficulty).cents / 100; }
  get beat() { return SG_TEMPOS.find((d) => d.id === this.tempo).beat; }

  /** The game's scale: the app's thaat/raag, or Bilawal when "all 12" is chosen. */
  gameScale() {
    const s = this.o.scale();
    if (s.name === 'All 12 swars') {
      const shuddh = [0, 2, 4, 5, 7, 9, 11, 12];
      return { aroha: shuddh, avaroha: [...shuddh].reverse(), allowed: new Set(shuddh.map(mod12)), name: 'Bilawal (shuddh swars)', nameDev: 'बिलावल (शुद्ध स्वर)' };
    }
    return s;
  }

  // ------------------------------------------------------------------ screens

  show(which) {
    this.el.menu.hidden = which !== 'menu';
    this.el.paused.hidden = which !== 'paused';
    this.el.result.hidden = which !== 'result';
    this.el.pause.hidden = which !== 'playing';
  }

  renderMenu() {
    const script = this.o.script();
    const scale = this.gameScale();
    const stages = buildStages(scale);
    this.buildLevel(stages);
    const seg = (name, list, cur, fmt) => list.map((d) => `
      <label><input type="radio" name="${name}" value="${d.id}" ${d.id === cur ? 'checked' : ''}>
      <span>${d.label} ${fmt(d)}</span></label>`).join('');
    const rows = stages.map((st, i) => `
      <button class="sg-stage" data-stage="${i}">
        <span class="sg-num">${i + 1}</span>
        <span class="swar-line">${st.map((n) => swarHTML(n, script)).join(' ')}</span>
      </button>`).join('');

    this.el.menu.innerHTML = `
      <div class="sam-menu">
        <div class="sam-title"><span class="sam-dev">सुरंग</span><span class="sam-rom">Surang</span></div>
        <p class="sam-intro">Sing to roll the ball through the tunnels: it moves only while you sing, and its
          height is your pitch. Touch a wall, or go quiet inside a tunnel, and you're back at the start of the
          stage. Breathe on the pads between tunnels. Tap a swar on the left edge to hear it.</p>
        <div class="sg-scale"><span class="eyebrow">Scale</span>
          <b class="sg-scale-name">${script === 'rom' ? scale.name : scale.nameDev}</b>
          <button class="link-btn" data-act="scale">Change</button></div>
        <div class="sam-opts">
          <div class="seg" role="radiogroup" aria-label="Tunnel width">${seg('sgDiff', SG_DIFFICULTIES, this.difficulty, (d) => `<small>±${d.cents}¢</small>`)}</div>
          <div class="seg" role="radiogroup" aria-label="Tempo">${seg('sgTempo', SG_TEMPOS, this.tempo, (d) => `<small>${Math.round(60 / d.beat)} bpm</small>`)}</div>
        </div>
        <button class="primary" data-act="start">Start</button>
        <div class="eyebrow">Stages <span class="muted">· tap one to start there</span></div>
        <div class="sg-stages">${rows}</div>
      </div>`;

    const m = this.el.menu;
    m.querySelectorAll('input[name=sgDiff]').forEach((r) => r.addEventListener('change', () => { this.difficulty = r.value; this.savePrefs(); this.renderMenu(); }));
    m.querySelectorAll('input[name=sgTempo]').forEach((r) => r.addEventListener('change', () => { this.tempo = r.value; this.savePrefs(); this.renderMenu(); }));
    m.querySelector('[data-act=start]').addEventListener('click', () => this.start(0));
    m.querySelector('[data-act=scale]').addEventListener('click', () => this.o.openSettings());
    m.querySelectorAll('[data-stage]').forEach((b) => b.addEventListener('click', () => this.start(+b.dataset.stage)));
  }

  async start(stageIdx) {
    await this.ready;
    this.buildLevel(buildStages(this.gameScale()));
    this.cur = stageIdx;
    this.firstStage = stageIdx;
    this.resets = this.L.stages.map(() => 0);
    this.elapsed = 0;
    this.done = false;
    this.respawn();
    this.cam.init = false;
    this.state = 'playing';
    this.show('playing');
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

  finish() {
    this.state = 'result';
    const played = this.L.stages.slice(this.firstStage);
    const resets = this.resets.slice(this.firstStage);
    const total = resets.reduce((a, b) => a + b, 0);
    const clean = resets.filter((r) => r === 0).length;
    const script = this.o.script();
    const worst = played.map((st, i) => ({ st, r: resets[i] })).filter((d) => d.r > 0).sort((a, b) => b.r - a.r).slice(0, 3);
    this.el.result.querySelector('.res-body').innerHTML = `
      <h2>All tunnels cleared</h2>
      <div class="res-stats">
        <div><b>${played.length}</b><span>stages</span></div>
        <div><b>${clean}</b><span>first try</span></div>
        <div><b>${total}</b><span>restarts</span></div>
      </div>
      ${worst.length ? `<div class="sw-list"><div class="eyebrow">Hardest stages</div>${worst.map((d) => `
        <div class="sw-row sg-row"><span class="swar-line">${d.st.notes.map((n) => swarHTML(n, script)).join(' ')}</span><span class="muted">${d.r} ${d.r === 1 ? 'restart' : 'restarts'}</span></div>`).join('')}</div>`
        : '<p class="muted">Every stage on the first try. Try a narrower tunnel?</p>'}`;
    this.show('result');
  }

  // -------------------------------------------------------------------- level

  buildLevel(stageNotes) {
    const beat = this.beat;
    const tol = this.tol;
    const J = JOINT * beat;
    const stages = [];
    let x = 0;
    for (const notes of stageNotes) {
      const padStart = x;
      const t0 = x + PAD_LEN;
      let t = t0;
      const segs = notes.map((n, i) => {
        // Turning swars (a peak or a valley) are held longer: it reads well
        // musically and keeps a solid wall between the shaft up and the one down.
        const turn = i > 0 && i < notes.length - 1 && (notes[i - 1] - n) * (notes[i + 1] - n) > 0;
        const d = beat * (i === notes.length - 1 || turn ? LAST_NOTE : 1);
        const s = { n, s: t, e: t + d };
        t += d;
        return s;
      });
      const rects = segs.map((s) => ({ x0: s.s, x1: s.e, y0: s.n - tol, y1: s.n + tol }));
      for (let i = 0; i < segs.length - 1; i++) {
        const a = segs[i];
        const b = segs[i + 1];
        if (a.n === b.n) continue;
        rects.push({ x0: a.e - J / 2, x1: a.e + J / 2, y0: Math.min(a.n, b.n) - tol, y1: Math.max(a.n, b.n) + tol });
      }
      stages.push({ notes, padStart, t0, t1: t, segs, rects, hi: Math.max(...notes) });
      x = t;
    }
    const hi = Math.max(...stages.map((s) => s.hi));
    const notesIn = [];
    const allowed = this.gameScale().allowed;
    for (let n = 0; n <= hi; n++) if (allowed.has(mod12(n))) notesIn.push(n);
    this.L = { stages, end: x, finalPad: [x, x + PAD_LEN * 2], hi, lanes: notesIn, tol };
    this.geoCache.clear();
    if (this.cur == null || this.cur >= stages.length) this.cur = 0;
  }

  respawn() {
    const st = this.L.stages[this.cur];
    this.ball = { x: st.padStart + 0.2, y: PAD_Y + 0.4, vy: 0, quiet: 1, mode: 'live', failT: 0, moving: false };
    this.trail = [];
    this.flash = null;
  }

  // ---------------------------------------------------------------- per frame

  resize() {
    const c = this.el.canvas;
    const w = c.clientWidth;
    const h = c.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w !== this.size.w || h !== this.size.h || dpr !== this.size.dpr) {
      this.size = { w, h, dpr };
      c.width = Math.max(1, Math.round(w * dpr));
      c.height = Math.max(1, Math.round(h * dpr));
      this.geoCache.clear();
    }
  }

  tick(now, dtMs, pitch) {
    this.resize();
    if (!this.theme || !this.L || !this.size.w) return;
    const dt = Math.min(0.05, dtMs / 1000);
    if (this.state === 'playing') this.step(dt, pitch);
    this.updateCamera(dt);
    this.render(dt);
  }

  get rPx() { return Math.max(8, Math.min(14, this.cam.ppsemi * 0.3)); }

  step(dt, pitch) {
    const b = this.ball;
    const L = this.L;
    const st = L.stages[this.cur];
    this.elapsed += dt;
    const rs = this.rPx / this.cam.ppsemi;      // ball radius, semitones
    const rx = this.rPx / this.cam.pps;         // ball radius, seconds
    const topY = this.cam.top - rs;

    if (b.mode === 'fail') {
      b.failT += dt;
      if (b.failT >= FAIL_TIME) {
        this.resets[this.cur]++;
        this.respawn();
      }
      return;
    }

    const voiced = pitch.voiced && pitch.semis != null;
    const inTunnel = !this.done && b.x >= st.t0 && b.x <= st.t1;
    const floor = PAD_Y + rs;
    b.moving = false;

    if (voiced) {
      b.quiet = 0;
      b.vy = 0;
      const target = Math.min(topY, Math.max(floor, pitch.semis));
      b.y += (target - b.y) * (1 - Math.exp(-dt / FOLLOW));
      let nx = b.x + dt;
      // Wait at the mouth of the tunnel until the first swar is in tune.
      if (!this.done && b.x < st.t0) {
        const gate = st.t0 - 2 * rx;
        if (nx > gate && Math.abs(b.y - st.notes[0]) > L.tol) nx = Math.max(b.x, gate);
      }
      if (this.done) nx = Math.min(nx, L.finalPad[1] - 0.3);
      b.moving = nx > b.x;
      if (b.moving) this.trail.push({ x: nx, y: b.y });
      b.x = nx;
    } else {
      b.quiet += dt;
      if (b.quiet > HANG) {
        b.vy -= GRAVITY * dt;
        b.y += b.vy * dt;
      }
      if (!inTunnel && b.y <= floor) { b.y = floor; b.vy = 0; }
    }
    while (this.trail.length && this.trail[0].x < b.x - 3) this.trail.shift();

    if (!this.done && b.x >= st.t0 && b.x <= st.t1 && !inside(st.rects, b.x, b.y)) {
      this.fail(st);
      return;
    }
    if (!this.done && b.x > st.t1) {
      this.cur++;
      if (this.cur >= L.stages.length) {
        this.cur = L.stages.length - 1;
        this.done = true;
        this.doneAt = this.elapsed;
      }
    }
    if (this.done && this.elapsed - this.doneAt > 1.2) this.finish();
  }

  fail(st) {
    const b = this.ball;
    b.mode = 'fail';
    b.failT = 0;
    // Find the wall that was touched, for the red flash.
    const geo = this.geometry(this.L.stages.indexOf(st));
    let best = null;
    let bestD = Infinity;
    const X = (x) => this.X(x);
    const Y = (y) => this.Y(y);
    const bx = X(b.x);
    const by = Y(b.y);
    for (const s of geo.segs) {
      let d;
      if (s.o === 'h') {
        const cx = Math.max(X(s.a), Math.min(X(s.b), bx));
        d = Math.hypot(cx - bx, Y(s.c) - by);
      } else {
        const cy = Math.max(Y(s.b), Math.min(Y(s.a), by));
        d = Math.hypot(X(s.c) - bx, cy - by);
      }
      if (d < bestD) { bestD = d; best = s; }
    }
    this.flash = best ? { seg: best, stage: st, t: 0 } : null;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 140;
      this.sparks.push({ x: bx, y: by, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.6 + Math.random() * 0.3, t: 0 });
    }
  }

  // ------------------------------------------------------------------- camera

  updateCamera(dt) {
    const { w, h } = this.size;
    const L = this.L;
    const cam = this.cam;
    const top = L.hi + 1.2;
    const bottom = PAD_Y - 0.9;
    cam.top = top;
    cam.oy = 8;
    cam.ppsemi = (h - 16) / (top - bottom);

    const st = L.stages[Math.min(this.cur ?? 0, L.stages.length - 1)];
    const view = w - cam.ox - 8;
    const startX = st.padStart;
    const endX = this.done ? L.finalPad[1] : st.t1 + 0.35;
    const fit = view / (endX - startX);
    let pps;
    let left;
    if (fit >= PPS_MIN) {
      pps = Math.min(fit, PPS_MAX);
      left = startX;
    } else {
      pps = PPS_MIN;
      const bx = this.ball ? this.ball.x : startX;
      left = Math.max(startX, Math.min(endX - view / pps, bx - (view * 0.3) / pps));
    }
    if (!cam.init) {
      cam.pps = pps;
      cam.left = left;
      cam.init = true;
    } else {
      const k = 1 - Math.exp(-dt / 0.3);
      cam.pps += (pps - cam.pps) * k;
      cam.left += (left - cam.left) * k;
    }
  }

  X(x) { return this.cam.ox + (x - this.cam.left) * this.cam.pps; }
  Y(y) { return this.cam.oy + (this.cam.top - y) * this.cam.ppsemi; }

  /** Drawn outline of a stage: rects grown by the ball's radius. */
  geometry(i) {
    const st = this.L.stages[i];
    const rx = this.rPx / this.cam.pps;
    const ry = this.rPx / this.cam.ppsemi;
    const key = `${i}|${rx.toFixed(4)}|${ry.toFixed(4)}`;
    const hit = this.geoCache.get(key);
    if (hit) return hit;
    const rects = st.rects.map((r) => ({ x0: r.x0 - rx, x1: r.x1 + rx, y0: r.y0 - ry, y1: r.y1 + ry }));
    const face0 = st.t0 - rx;
    const face1 = st.t1 + rx;
    const open = [
      { x0: -1e9, x1: face0, y0: -1e9, y1: 1e9 },
      { x0: face1, x1: 1e9, y0: -1e9, y1: 1e9 },
    ];
    const segs = outline(rects, open);
    const geo = { rects, segs, corners: corners(segs, rects, face0, face1), face0, face1 };
    if (this.geoCache.size > 60) this.geoCache.clear();
    this.geoCache.set(key, geo);
    return geo;
  }

  // ------------------------------------------------------------------- render

  pattern(name, tile) {
    this.patterns = this.patterns || {};
    if (!this.patterns[name]) this.patterns[name] = this.g.createPattern(this.theme.sprites[name], 'repeat');
    const img = this.theme.sprites[name];
    const p = this.patterns[name];
    return { p, img, scale: tile / img.width };
  }

  render(dt) {
    const g = this.g;
    const { w, h, dpr } = this.size;
    const { sprites: S, config: C } = this.theme;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    // Background: sky, then two parallax layers.
    const sky = S['bg-sky'];
    const sk = Math.max(w / sky.width, h / sky.height);
    g.drawImage(sky, (w - sky.width * sk) / 2, (h - sky.height * sk) / 2, sky.width * sk, sky.height * sk);
    this.parallax(S['bg-far'], 0.12, h * 0.5);
    this.parallax(S['bg-near'], 0.3, h * 0.3);

    const L = this.L;
    const first = Math.max(0, (this.cur ?? 0) - 1);
    for (let i = first; i < Math.min(L.stages.length, first + 4); i++) this.drawStage(i);
    this.drawPads();
    this.drawLanes();
    this.drawTrail();
    this.drawBall();
    this.drawSparks(dt);
    this.drawGutter();

    if (this.ball && this.ball.mode === 'fail') {
      const a = 1 - this.ball.failT / FAIL_TIME;
      g.strokeStyle = C.fail;
      g.globalAlpha = Math.max(0, a);
      g.lineWidth = 6;
      g.strokeRect(3, 3, w - 6, h - 6);
      g.globalAlpha = 1;
    }
  }

  parallax(img, factor, height) {
    const g = this.g;
    const { w, h } = this.size;
    const s = height / img.height;
    const tw = img.width * s;
    const shift = (this.cam.left * this.cam.pps * factor) % tw;
    for (let x = -shift; x < w; x += tw) g.drawImage(img, x, h - height, tw, height);
  }

  drawStage(i) {
    const g = this.g;
    const st = this.L.stages[i];
    const { sprites: S, config: C } = this.theme;
    const geo = this.geometry(i);
    const x0 = this.X(geo.face0);
    const x1 = this.X(geo.face1);
    if (x1 < 0 || x0 > this.size.w) return;
    const yTop = this.Y(st.hi + this.L.tol + ROCK_TOP);
    const yBot = this.Y(PAD_Y - 0.5);

    const ox = this.X(0);
    const oy = this.Y(0);
    const rock = this.pattern('rock', C.tile);
    rock.p.setTransform(new DOMMatrix().translate(ox, oy).scale(rock.scale));
    g.fillStyle = rock.p;
    g.fillRect(x0, yTop, x1 - x0, yBot - yTop);

    const pass = this.pattern('passage', C.tile);
    pass.p.setTransform(new DOMMatrix().translate(ox, oy).scale(pass.scale));
    g.fillStyle = pass.p;
    g.beginPath();
    for (const r of geo.rects) g.rect(this.X(r.x0), this.Y(r.y1), (r.x1 - r.x0) * this.cam.pps, (r.y1 - r.y0) * this.cam.ppsemi);
    g.fill();

    // Wall trim along every edge, then the corner pieces.
    const E = C.edge;
    const edge = this.pattern('edge', 0);
    edge.p.setTransform(new DOMMatrix().translate(0, -E).scale(E / edge.img.height));
    g.fillStyle = edge.p;
    for (const s of geo.segs) {
      let px; let py; let rot; let len; let startKey; let endKey;
      if (s.o === 'h') {
        const y = this.Y(s.c);
        len = (s.b - s.a) * this.cam.pps;
        if (s.out > 0) { px = this.X(s.a); py = y; rot = 0; startKey = ptKey(s.a, s.c); endKey = ptKey(s.b, s.c); }
        else { px = this.X(s.b); py = y; rot = Math.PI; startKey = ptKey(s.b, s.c); endKey = ptKey(s.a, s.c); }
      } else {
        const x = this.X(s.c);
        len = (s.b - s.a) * this.cam.ppsemi;
        if (s.out > 0) { px = x; py = this.Y(s.b); rot = Math.PI / 2; startKey = ptKey(s.c, s.b); endKey = ptKey(s.c, s.a); }
        else { px = x; py = this.Y(s.a); rot = -Math.PI / 2; startKey = ptKey(s.c, s.a); endKey = ptKey(s.c, s.b); }
      }
      const cs = geo.corners.get(startKey);
      const ce = geo.corners.get(endKey);
      const t0 = cs && cs.type === 'out' ? E : 0;
      const t1 = ce && ce.type === 'out' ? E : 0;
      if (len - t0 - t1 <= 0) continue;
      g.save();
      g.translate(px, py);
      g.rotate(rot);
      g.fillRect(t0, -E, len - t0 - t1, E);
      g.restore();
    }
    for (const c of geo.corners.values()) {
      const img = c.type === 'out' ? S['corner-out'] : S['corner-in'];
      // World quadrant → screen quadrant (screen y points down).
      const qx = c.sx;
      const qy = -c.sy;
      const rot = qx < 0 && qy < 0 ? 0 : qx > 0 && qy < 0 ? Math.PI / 2 : qx > 0 && qy > 0 ? Math.PI : -Math.PI / 2;
      g.save();
      g.translate(this.X(c.x), this.Y(c.y));
      g.rotate(rot);
      g.drawImage(img, -E, -E, E, E);
      g.restore();
    }

    if (this.flash && this.flash.stage === st) {
      const f = this.flash;
      const s = f.seg;
      g.strokeStyle = C.fail;
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.globalAlpha = this.ball.mode === 'fail' ? 1 - this.ball.failT / FAIL_TIME : 0;
      g.beginPath();
      if (s.o === 'h') { g.moveTo(this.X(s.a), this.Y(s.c)); g.lineTo(this.X(s.b), this.Y(s.c)); }
      else { g.moveTo(this.X(s.c), this.Y(s.a)); g.lineTo(this.X(s.c), this.Y(s.b)); }
      g.stroke();
      g.globalAlpha = 1;
    }
  }

  drawPads() {
    const g = this.g;
    const { sprites: S, config: C } = this.theme;
    const pad = S.pad;
    const rx = this.rPx / this.cam.pps;
    const y = this.Y(PAD_Y);
    const draw = (a, b) => {
      const x0 = this.X(a);
      const x1 = this.X(b);
      if (x1 < 0 || x0 > this.size.w) return;
      const ph = Math.min(48, (x1 - x0) * (pad.height / pad.width) * 1.6);
      g.drawImage(pad, x0, y - ph * C.padTop, x1 - x0, ph);
    };
    const L = this.L;
    L.stages.forEach((st, i) => draw(st.padStart + (i ? rx : 0) + 0.05, st.t0 - rx - 0.05));
    draw(L.finalPad[0] + rx + 0.05, L.finalPad[1]);
    // The gateway at the end of the level, standing on the last pad.
    const ex = S.exit;
    const eh = this.cam.ppsemi * 3.2;
    const ew = eh * (ex.width / ex.height);
    g.drawImage(ex, this.X(L.finalPad[1] - 0.35) - ew / 2, y - eh, ew, eh);
  }

  /** Swar lanes: bands centred on each swar of the scale, edges halfway between. */
  laneBounds() {
    const lanes = this.L.lanes;
    return lanes.map((n, i) => {
      const below = i > 0 ? (n + lanes[i - 1]) / 2 : n - (lanes[1] - n) / 2;
      const above = i < lanes.length - 1 ? (n + lanes[i + 1]) / 2 : n + (n - lanes[i - 1]) / 2;
      return { n, y0: below, y1: above };
    });
  }

  targetNotes() {
    const b = this.ball;
    const st = this.L.stages[this.cur ?? 0];
    if (!st || this.state === 'menu') return [st ? st.notes[0] : 0];
    if (!b || b.x < st.t0) return [st.notes[0]];
    const J = JOINT * this.beat;
    for (let i = 0; i < st.segs.length; i++) {
      const s = st.segs[i];
      if (b.x < s.e) {
        const next = st.segs[i + 1];
        return next && b.x > s.e - J / 2 ? [s.n, next.n] : [s.n];
      }
    }
    return [];
  }

  drawLanes() {
    const g = this.g;
    const { w } = this.size;
    const C = this.theme.config;
    const targets = this.targetNotes();
    this.laneBounds().forEach((l, i) => {
      const yTop = this.Y(l.y1);
      const yBot = this.Y(l.y0);
      const t = targets.indexOf(l.n);
      if (t >= 0) {
        g.fillStyle = C.laneTarget;
        g.globalAlpha = t === 0 ? 1 : 0.5;
        g.fillRect(GUTTER, yTop, w - GUTTER, yBot - yTop);
        g.globalAlpha = 1;
      } else if (i % 2 === 0) {
        g.fillStyle = C.lane;
        g.fillRect(GUTTER, yTop, w - GUTTER, yBot - yTop);
      }
      g.fillStyle = C.laneLine;
      g.fillRect(GUTTER, Math.round(yTop), w - GUTTER, 1);
      if (i === 0) g.fillRect(GUTTER, Math.round(yBot), w - GUTTER, 1);
    });
  }

  drawGutter() {
    const g = this.g;
    const { h } = this.size;
    const C = this.theme.config;
    g.fillStyle = C.gutter;
    g.fillRect(0, 0, GUTTER, h);
    const targets = this.targetNotes();
    const script = this.o.script();
    const size = script === 'rom' ? 12 : 14;
    for (const l of this.laneBounds()) {
      const color = targets[0] === l.n ? C.labelTarget : C.label;
      drawSwar(g, l.n, GUTTER / 2, this.Y(l.n) + size * 0.35, size, color, script, this.o.font);
    }
  }

  drawTrail() {
    if (this.trail.length < 2) return;
    const g = this.g;
    g.strokeStyle = this.theme.config.trail;
    g.lineWidth = 2;
    g.lineJoin = 'round';
    g.beginPath();
    this.trail.forEach((p, i) => (i ? g.lineTo(this.X(p.x), this.Y(p.y)) : g.moveTo(this.X(p.x), this.Y(p.y))));
    g.stroke();
  }

  drawBall() {
    const b = this.ball;
    if (!b || this.state === 'menu') return;
    const { sprites: S, config: C } = this.theme;
    const img = b.mode === 'fail' ? S['ball-hit'] : b.moving ? S['ball-sing'] : S['ball-idle'];
    const size = (2 * this.rPx) / C.ballFill;
    this.g.drawImage(img, this.X(b.x) - size / 2, this.Y(b.y) - size / 2, size, size);
  }

  drawSparks(dt) {
    const g = this.g;
    const img = this.theme.sprites.spark;
    g.globalCompositeOperation = 'lighter';
    this.sparks = this.sparks.filter((p) => {
      p.t += dt;
      if (p.t >= p.life) return false;
      p.vy += 300 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const s = 10 * (1 - p.t / p.life) + 3;
      g.globalAlpha = 1 - p.t / p.life;
      g.drawImage(img, p.x - s / 2, p.y - s / 2, s, s);
      return true;
    });
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  onTap(e) {
    const rect = this.el.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x > GUTTER + 6 || !this.L) return;
    const semis = this.cam.top - (y - this.cam.oy) / this.cam.ppsemi;
    const lane = this.laneBounds().find((l) => semis >= l.y0 && semis <= l.y1);
    if (lane) this.o.playNote(lane.n, 1.0);
  }
}
