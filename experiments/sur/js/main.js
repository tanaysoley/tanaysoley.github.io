import {
  WESTERN, HARMONIUM, THAATS, RAAGS, PATTERNS,
  saFrequency, swarHTML, swarLabel, drawSwar, resolveScale, tanpuraFirstString, mod12, exampleText,
} from './music.js';
import { PitchDetector } from './pitch.js';
import { Tanpura, NotePlayer } from './audio.js';
import { SurSamraat } from './samraat.js';
import { Surang } from './surang.js';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const DEFAULTS = {
  saName: 'C#', saOct: 3,
  scaleKind: 'all', thaat: 'bilawal', raag: 'yaman',
  script: 'dev',
  tolPct: 10,      // steep colour drop / "on the swar" window, in % of a semitone (= cents)
  holdSec: 1.0,
  gateDb: -50,
  pattern: 'aroha',
  tanpuraVol: 0.5,
  view: 'tuner',
};
const STORE_KEY = 'sur.settings.v1';

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}
function saveSettings() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch { /* private mode */ }
}

const S = loadSettings();
let scale = resolveScale(S);
let saFreq = saFrequency(S.saName, S.saOct);
const noteFreq = (n) => saFreq * Math.pow(2, n / 12);

const $ = (id) => document.getElementById(id);
const FONT = '"Noto Sans Devanagari", "Inter", system-ui, sans-serif';
const darkQuery = matchMedia('(prefers-color-scheme: dark)');

// ---------------------------------------------------------------------------
// Colour: deep green on the swar, deep red halfway to the next one.
// A 4th-order curve keeps it green near the swar, then drops steeply around
// the tolerance distance.
// ---------------------------------------------------------------------------

function closeness(absCents) {
  const d = Math.min(absCents / 50, 1);
  const d0 = Math.max(S.tolPct, 1) / 50;
  const f = (x) => 1 / (1 + Math.pow(x / d0, 4));
  const f1 = f(1);
  return Math.max(0, (f(d) - f1) / (1 - f1));
}
function colorFor(absCents) {
  const c = closeness(absCents);
  const light = darkQuery.matches ? 52 : 40;
  return `hsl(${Math.round(c * 135)} 80% ${light}%)`;
}

let theme = {};
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name) => cs.getPropertyValue(name).trim();
  theme = {
    text: v('--text'), muted: v('--muted'), faint: v('--faint'), line: v('--line'),
    band: v('--band'), silent: v('--silent'), card: v('--card'), good: v('--good-bg'),
  };
}
readTheme();
darkQuery.addEventListener('change', () => { readTheme(); renderTolCurve(); });

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

let ctx = null;
let detector = null;
let tanpura = null;
let notePlayer = null;

function ensureAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  detector = new PitchDetector(ctx);
  tanpura = new Tanpura(ctx);
  tanpura.setVolume(S.tanpuraVol);
  tanpura.setTuning(saFreq, tanpuraFirstString(scale.allowed));
  notePlayer = new NotePlayer(ctx);
}

const pitch = { voiced: false, semis: null, hz: null, lastVoiced: 0, hist: [] };

function median(arr) {
  const a = [...arr].sort((x, y) => x - y);
  return a[a.length >> 1];
}

function updatePitch(now) {
  if (!detector || !detector.source) return;
  const r = detector.read(S.gateDb);
  if (r.freq) {
    pitch.hist.push(12 * Math.log2(r.freq / saFreq));
    if (pitch.hist.length > 5) pitch.hist.shift();
    pitch.semis = median(pitch.hist);
    pitch.hz = noteFreq(pitch.semis);
    pitch.voiced = true;
    pitch.lastVoiced = now;
  } else if (now - pitch.lastVoiced > 150) {
    pitch.voiced = false;
    pitch.hist.length = 0;
  }
}

function nearestAllowed(s) {
  let best = 0;
  let bestDist = Infinity;
  const base = Math.floor(s / 12);
  for (let o = base - 1; o <= base + 1; o++) {
    for (const k of scale.allowed) {
      const n = k + 12 * o;
      const d = Math.abs(s - n);
      if (d < bestDist) { bestDist = d; best = n; }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

const dpr = () => Math.min(window.devicePixelRatio || 1, 3);

function fitCanvas(canvas) {
  const r = dpr();
  const w = Math.round(canvas.clientWidth * r);
  const h = Math.round(canvas.clientHeight * r);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const c = canvas.getContext('2d');
  c.setTransform(r, 0, 0, r, 0, 0);
  return { c, W: canvas.clientWidth, H: canvas.clientHeight };
}

function octaveName(o) {
  const dev = { '-2': 'अति मंद्र', '-1': 'मंद्र', 0: 'मध्य', 1: 'तार', 2: 'अति तार' };
  const rom = { '-2': 'Ati mandra', '-1': 'Mandra', 0: 'Madhya', 1: 'Taar', 2: 'Ati taar' };
  return (S.script === 'rom' ? rom : dev)[o] || '';
}

// ---------------------------------------------------------------------------
// Mode 1: tuner
// ---------------------------------------------------------------------------

const tuner = { center: 5.5, shownNote: null, shownScript: null };
const tSwar = $('tSwar');
const tCents = $('tCents');
const tHz = $('tHz');
const tStatus = $('tStatus');
const tScale = $('tScale');

function renderTuner(now) {
  const voiced = pitch.voiced;
  if (pitch.semis == null) {
    if (tuner.shownNote !== 'none') {
      tSwar.innerHTML = swarHTML(0, S.script);
      tuner.shownNote = 'none';
    }
    tSwar.style.color = '';
    tSwar.classList.add('silent');
    tCents.textContent = '—';
    tHz.textContent = '';
    tStatus.textContent = 'Sing a note';
  } else {
    const n = nearestAllowed(pitch.semis);
    const cents = Math.round((pitch.semis - n) * 100);
    if (tuner.shownNote !== n || tuner.shownScript !== S.script) {
      tSwar.innerHTML = swarHTML(n, S.script);
      tSwar.setAttribute('aria-label', swarLabel(n));
      tuner.shownNote = n;
      tuner.shownScript = S.script;
    }
    tSwar.classList.toggle('silent', !voiced);
    tSwar.style.color = voiced ? colorFor(Math.abs(cents)) : '';
    tCents.textContent = `${cents > 0 ? '+' : cents < 0 ? '−' : '±'}${Math.abs(cents)}¢`;
    tCents.style.color = voiced ? colorFor(Math.abs(cents)) : '';
    tHz.textContent = `${pitch.hz.toFixed(1)} Hz`;
    if (!voiced) tStatus.textContent = 'Listening…';
    else if (Math.abs(cents) <= S.tolPct) tStatus.textContent = 'On the swar';
    else tStatus.textContent = cents > 0 ? 'A little high — come down ↓' : 'A little low — go up ↑';
  }
  drawTunerScale(now);
}

function drawTunerScale(now) {
  const { c, W, H } = fitCanvas(tScale);
  c.clearRect(0, 0, W, H);
  const pps = Math.max(S.script === 'rom' ? 46 : 40, Math.min(70, W / 13));
  if (pitch.voiced) tuner.center += (pitch.semis - tuner.center) * 0.12;
  tuner.center = Math.max(-17, Math.min(29, tuner.center));
  const cx = W / 2;
  const xOf = (n) => cx + (n - tuner.center) * pps;
  const base = H * 0.6;

  // Octave bands
  for (let o = -2; o <= 2; o++) {
    const x0 = xOf(12 * o - 0.5);
    const x1 = xOf(12 * o + 11.5);
    if (x1 < 0 || x0 > W) continue;
    if (o % 2 !== 0) {
      c.fillStyle = theme.band;
      c.fillRect(x0, 0, x1 - x0, H);
    }
    c.fillStyle = theme.muted;
    c.font = `600 11px ${FONT}`;
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillText(octaveName(o), Math.max(x0 + 6, 6), 8);
  }

  // Ticks and swar labels
  const lo = Math.floor(tuner.center - cx / pps) - 1;
  const hi = Math.ceil(tuner.center + cx / pps) + 1;
  c.fillStyle = theme.line;
  c.fillRect(0, base, W, 1);
  for (let n = lo; n <= hi; n++) {
    const x = xOf(n);
    if (scale.allowed.has(mod12(n))) {
      const tolW = (S.tolPct / 100) * pps;
      c.fillStyle = theme.good;
      c.fillRect(x - tolW, base - 34, tolW * 2, 34);
      c.fillStyle = theme.text;
      c.fillRect(x - 1, base - 34, 2, 40);
      drawSwar(c, n, x, base + 34, S.script === 'rom' ? 17 : 20, theme.text, S.script, FONT);
    } else {
      c.fillStyle = theme.faint;
      c.fillRect(x - 0.5, base - 12, 1, 14);
    }
  }

  // Voice pointer
  if (pitch.semis != null) {
    const x = xOf(pitch.semis);
    const n = nearestAllowed(pitch.semis);
    let color = theme.silent;
    c.globalAlpha = 1;
    if (pitch.voiced) color = colorFor(Math.abs(pitch.semis - n) * 100);
    else c.globalAlpha = 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(now / 180));
    c.fillStyle = color;
    c.fillRect(x - 1.5, 30, 3, base - 24);
    c.beginPath();
    c.moveTo(x - 9, 26);
    c.lineTo(x + 9, 26);
    c.lineTo(x, 38);
    c.closePath();
    c.fill();
    c.beginPath();
    c.arc(x, base, 6, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// Mode 2: practice
// ---------------------------------------------------------------------------

let run = null;
const pRing = $('pRing');
const RING_LEN = 2 * Math.PI * 54;
pRing.style.strokeDasharray = RING_LEN;

function currentPattern() {
  return PATTERNS.find((p) => p.id === S.pattern) || PATTERNS[0];
}

function renderPracticeSetup() {
  $('pScaleName').textContent = S.script === 'rom' ? scale.name : scale.nameDev;
  $('pAroha').innerHTML = scale.aroha.map((n) => swarHTML(n, S.script)).join(' ');
  $('pAvaroha').innerHTML = scale.avaroha.map((n) => swarHTML(n, S.script)).join(' ');

  const box = $('pPatterns');
  box.innerHTML = '';
  for (const p of PATTERNS) {
    const groups = p.gen(scale.aroha, scale.avaroha);
    const sample = p.id === 'random'
      ? 'Different every time'
      : groups.slice(0, 3).map((g) => `<span class="grp">${g.map((n) => swarHTML(n, S.script)).join('')}</span>`).join('') + '<span class="muted">…</span>';
    const total = groups.reduce((a, g) => a + g.length, 0);
    const el = document.createElement('label');
    el.className = 'pattern';
    el.innerHTML = `
      <input type="radio" name="pattern" value="${p.id}" ${p.id === S.pattern ? 'checked' : ''}>
      <div class="pattern-body">
        <div class="pattern-name">${p.name} <span class="muted">${total} swars</span></div>
        <div class="pattern-desc">${exampleText(p.desc, S.script)}</div>
        <div class="pattern-sample swar-line groups">${sample}</div>
      </div>`;
    el.querySelector('input').addEventListener('change', () => {
      S.pattern = p.id;
      saveSettings();
    });
    box.appendChild(el);
  }
}

function showPracticePanel(which) {
  $('pSetup').hidden = which !== 'setup';
  $('pRun').hidden = which !== 'run';
  $('pSummary').hidden = which !== 'summary';
}

function startPractice() {
  const p = currentPattern();
  const groups = p.gen(scale.aroha, scale.avaroha);
  const steps = [];
  groups.forEach((g, gi) => g.forEach((n) => steps.push({ n, group: gi, startAt: 0, hitAt: 0, skipped: false, samples: [] })));
  run = { pattern: p, groups, steps, i: 0, hold: 0, lastIn: 0, flashUntil: 0, startedAt: performance.now() };
  $('pRunName').textContent = p.name;
  $('pRunDesc').textContent = exampleText(p.desc, S.script);
  renderStrip();
  showPracticePanel('run');
  startStep(performance.now());
}

function renderStrip() {
  const strip = $('pStrip');
  strip.innerHTML = '';
  let i = 0;
  run.groups.forEach((g) => {
    const gEl = document.createElement('span');
    gEl.className = 'group';
    g.forEach((n) => {
      const chip = document.createElement('span');
      chip.className = 'step';
      chip.dataset.i = i++;
      chip.innerHTML = swarHTML(n, S.script);
      gEl.appendChild(chip);
    });
    strip.appendChild(gEl);
  });
  updateStrip();
}

function updateStrip() {
  const chips = $('pStrip').querySelectorAll('.step');
  chips.forEach((chip) => {
    const st = run.steps[+chip.dataset.i];
    const idx = +chip.dataset.i;
    chip.classList.toggle('current', idx === run.i);
    chip.classList.toggle('done', !!st.hitAt);
    chip.classList.toggle('skipped', st.skipped);
  });
  const cur = chips[run.i];
  if (cur) {
    const strip = $('pStrip');
    const left = cur.offsetLeft - strip.clientWidth / 2 + cur.clientWidth / 2;
    strip.scrollTo({ left, behavior: 'smooth' });
  }
}

function renderTarget() {
  const n = run.steps[run.i].n;
  $('pTarget').innerHTML = swarHTML(n, S.script);
  $('pTarget').setAttribute('aria-label', swarLabel(n));
  $('pCount').textContent = `${run.i + 1} / ${run.steps.length}`;
}

function startStep(now) {
  run.hold = 0;
  run.lastIn = 0;
  run.flashUntil = 0;
  run.steps[run.i].startAt = now;
  $('pTarget').classList.remove('hit');
  renderTarget();
  updateStrip();
}

function advance(now) {
  run.i++;
  if (run.i >= run.steps.length) finishPractice();
  else startStep(now);
}

function skipStep() {
  if (!run || run.flashUntil) return;
  run.steps[run.i].skipped = true;
  advance(performance.now());
}

function practiceTick(now, dt) {
  if (!run || $('pRun').hidden) return;
  const step = run.steps[run.i];

  if (run.flashUntil) {
    if (now >= run.flashUntil) advance(now);
    drawMeter(null);
    return;
  }

  let cents = null;
  if (pitch.voiced) {
    cents = (pitch.semis - step.n) * 100;
    if (Math.abs(cents) <= 100) step.samples.push(cents);
  }
  const inTol = cents != null && Math.abs(cents) <= S.tolPct;
  if (inTol) {
    run.hold += dt;
    run.lastIn = now;
  } else if (now - run.lastIn > 150) {
    run.hold = 0;
  }

  const holdMs = S.holdSec * 1000;
  const progress = Math.min(run.hold / holdMs, 1);
  pRing.style.strokeDashoffset = RING_LEN * (1 - progress);
  pRing.style.stroke = cents == null ? '' : colorFor(Math.abs(cents));
  $('pTarget').style.color = cents == null ? '' : colorFor(Math.abs(cents));

  const status = $('pStatus');
  if (run.hold >= holdMs) {
    step.hitAt = now;
    run.flashUntil = now + 450;
    $('pTarget').classList.add('hit');
    status.textContent = 'Got it!';
    updateStrip();
  } else if (cents == null) {
    status.textContent = 'Sing the swar and hold it';
  } else {
    const octaves = Math.round(cents / 1200);
    if (octaves !== 0 && Math.abs(cents - octaves * 1200) < 50) {
      status.textContent = octaves > 0 ? 'Right swar, but an octave too high' : 'Right swar, but an octave too low';
    } else if (inTol) {
      status.textContent = 'Hold it…';
    } else if (Math.abs(cents) > 100) {
      status.textContent = cents > 0 ? 'Too high — come down ↓' : 'Too low — go up ↑';
    } else {
      status.textContent = cents > 0 ? 'A little high ↓' : 'A little low ↑';
    }
  }
  drawMeter(cents);
}

function drawMeter(cents) {
  const canvas = $('pMeter');
  const { c, W, H } = fitCanvas(canvas);
  c.clearRect(0, 0, W, H);
  const pad = 22;
  const cx = W / 2;
  const half = cx - pad;
  const xOf = (ct) => cx + (Math.max(-100, Math.min(100, ct)) / 100) * half;
  const y = H * 0.42;
  const n = run.steps[run.i] ? run.steps[run.i].n : 0;

  // Colour bar showing the closeness curve
  for (let ct = -100; ct < 100; ct += 2) {
    c.fillStyle = colorFor(Math.abs(ct));
    c.globalAlpha = 0.55;
    c.fillRect(xOf(ct), y - 3, half / 50 + 0.5, 6);
  }
  c.globalAlpha = 1;
  const tolW = (S.tolPct / 100) * half;
  c.strokeStyle = theme.text;
  c.lineWidth = 1;
  c.strokeRect(cx - tolW, y - 10, tolW * 2, 20);

  // Neighbour swars at ±1 semitone, target in the middle
  drawSwar(c, n - 1, xOf(-100), H - 8, 15, theme.muted, S.script, FONT);
  drawSwar(c, n + 1, xOf(100), H - 8, 15, theme.muted, S.script, FONT);
  c.fillStyle = theme.muted;
  c.font = `600 11px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.fillText('−50¢', xOf(-50), H - 10);
  c.fillText('+50¢', xOf(50), H - 10);
  c.fillText('0', cx, H - 10);

  if (cents != null) {
    const x = xOf(cents);
    c.fillStyle = colorFor(Math.abs(cents));
    c.beginPath();
    c.arc(x, y, 9, 0, Math.PI * 2);
    c.fill();
    if (Math.abs(cents) > 100) {
      c.font = `700 14px ${FONT}`;
      c.fillText(cents > 0 ? '▶' : '◀', x + (cents > 0 ? 16 : -16), y + 5);
    }
  }
}

function finishPractice() {
  const now = performance.now();
  // A swar that was still in progress when the session ended doesn't count.
  const attempted = run.steps.filter((s) => s.startAt && (s.hitAt || s.skipped));
  const endedEarly = attempted.length < run.steps.length;
  const hits = attempted.filter((s) => s.hitAt);
  const skipped = attempted.filter((s) => s.skipped);
  const times = hits.map((s) => (s.hitAt - s.startAt) / 1000);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const near = attempted.flatMap((s) => s.samples.filter((c) => Math.abs(c) <= 50));
  const overall = avg(near);
  const total = (now - run.startedAt) / 1000;

  $('sTitle').textContent = attempted.length ? `${hits.length} of ${attempted.length} swars hit` : 'No swars finished';
  $('sSub').textContent = `${run.pattern.name} · ${S.script === 'rom' ? scale.name : scale.nameDev}` +
    (endedEarly ? ` · ended after ${attempted.length} of ${run.steps.length}` : '');
  const fmtTime = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s` : `${sec.toFixed(1)}s`);
  const fmtCents = (ct) => `${ct > 0 ? '+' : ct < 0 ? '−' : '±'}${Math.abs(Math.round(ct))}¢`;
  const tiles = [
    ['Average time to hit', times.length ? fmtTime(avg(times)) : '—'],
    ['Session length', fmtTime(total)],
    ['Skipped', String(skipped.length)],
    ['Overall offset', overall == null ? '—' : fmtCents(overall), overall],
  ];
  $('sStats').innerHTML = tiles
    .map(([k, v, ct]) => `<div class="tile"><div class="tile-k">${k}</div><div class="tile-v"${ct != null ? ` style="color:${colorFor(Math.abs(ct))}"` : ''}>${v}</div></div>`)
    .join('');

  const byNote = new Map();
  for (const s of attempted) {
    if (!byNote.has(s.n)) byNote.set(s.n, []);
    byNote.get(s.n).push(s);
  }
  const rows = [...byNote.entries()].sort((a, b) => a[0] - b[0]).map(([n, list]) => {
    const h = list.filter((s) => s.hitAt);
    const t = avg(h.map((s) => (s.hitAt - s.startAt) / 1000));
    const off = avg(list.flatMap((s) => s.samples.filter((c) => Math.abs(c) <= 50)));
    const offCell = off == null
      ? '<span class="muted">no data</span>'
      : `<span style="color:${colorFor(Math.abs(off))}">${fmtCents(off)}</span> <span class="muted">${Math.abs(off) <= S.tolPct ? '' : off > 0 ? 'sharp' : 'flat'}</span>`;
    return `<div class="tr">
      <div class="td swar-cell">${swarHTML(n, S.script)}</div>
      <div class="td">${h.length}/${list.length} hit</div>
      <div class="td">${t == null ? '—' : t.toFixed(1) + 's'}</div>
      <div class="td">${offCell}</div>
    </div>`;
  });
  $('sTable').innerHTML = `<div class="tr th"><div class="td">Swar</div><div class="td">Hits</div><div class="td">Avg time</div><div class="td">Offset</div></div>${rows.join('')}`;
  showPracticePanel('summary');
}

$('pStart').addEventListener('click', startPractice);
$('pSkip').addEventListener('click', skipStep);
$('pStop').addEventListener('click', () => run && finishPractice());
$('sAgain').addEventListener('click', startPractice);
$('sBack').addEventListener('click', () => showPracticePanel('setup'));
$('pChangeScale').addEventListener('click', openSettings);
$('pPlayTarget').addEventListener('click', () => {
  if (run && run.steps[run.i]) playSwar(run.steps[run.i].n);
});

// ---------------------------------------------------------------------------
// Dock: tanpura + note buttons
// ---------------------------------------------------------------------------

let noteOct = 0;

function playSwar(n) {
  ensureAudio();
  if (ctx.state === 'suspended') ctx.resume();
  notePlayer.play(noteFreq(n));
}

function renderNoteButtons() {
  const box = $('noteBtns');
  box.innerHTML = '';
  const notes = [...scale.allowed].sort((a, b) => a - b).map((k) => k + 12 * noteOct);
  if (noteOct === 0) notes.push(12);
  for (const n of notes) {
    const b = document.createElement('button');
    b.className = 'note-btn';
    b.innerHTML = swarHTML(n, S.script);
    b.setAttribute('aria-label', 'Play ' + swarLabel(n));
    b.addEventListener('click', () => {
      playSwar(n);
      b.classList.remove('flash');
      void b.offsetWidth;
      b.classList.add('flash');
    });
    box.appendChild(b);
  }
  $('octLabel').textContent = octaveName(noteOct);
  $('octDown').disabled = noteOct <= -1;
  $('octUp').disabled = noteOct >= 1;
}

$('octDown').addEventListener('click', () => { noteOct = Math.max(-1, noteOct - 1); renderNoteButtons(); });
$('octUp').addEventListener('click', () => { noteOct = Math.min(1, noteOct + 1); renderNoteButtons(); });

$('tanpuraBtn').addEventListener('click', () => {
  ensureAudio();
  if (ctx.state === 'suspended') ctx.resume();
  const on = !tanpura.playing;
  if (on) tanpura.start();
  else tanpura.stop();
  $('tanpuraBtn').setAttribute('aria-pressed', String(on));
});
$('tanpuraVol').value = S.tanpuraVol;
$('tanpuraVol').addEventListener('input', (e) => {
  S.tanpuraVol = +e.target.value;
  if (tanpura) tanpura.setVolume(S.tanpuraVol);
  saveSettings();
});

// ---------------------------------------------------------------------------
// Settings dialog
// ---------------------------------------------------------------------------

const dlg = $('settings');

function openSettings() {
  syncSettingsForm();
  dlg.showModal();
}

function syncSettingsForm() {
  $('setSaName').value = S.saName;
  $('setSaOct').value = String(S.saOct);
  $('setSaHz').textContent = `${saFreq.toFixed(1)} Hz`;
  dlg.querySelectorAll('input[name=scaleKind]').forEach((r) => { r.checked = r.value === S.scaleKind; });
  dlg.querySelectorAll('input[name=script]').forEach((r) => { r.checked = r.value === S.script; });
  $('setThaat').value = S.thaat;
  $('setRaag').value = S.raag;
  $('setThaat').hidden = S.scaleKind !== 'thaat';
  $('setRaag').hidden = S.scaleKind !== 'raag';
  $('setScalePreview').innerHTML = S.scaleKind === 'raag'
    ? `${scale.aroha.map((n) => swarHTML(n, S.script)).join(' ')} <span class="sep">/</span> ${scale.avaroha.map((n) => swarHTML(n, S.script)).join(' ')}`
    : scale.aroha.map((n) => swarHTML(n, S.script)).join(' ');
  $('setTol').value = S.tolPct;
  $('setTolVal').textContent = `${S.tolPct}% of a semitone (${S.tolPct}¢)`;
  $('setHold').value = S.holdSec;
  $('setHoldVal').textContent = `${(+S.holdSec).toFixed(1)}s`;
  $('setGate').value = S.gateDb;
  $('setGateVal').textContent = `${S.gateDb} dB`;
  renderTolCurve();
}

function renderTolCurve() {
  const stops = [];
  for (let i = 0; i <= 25; i++) stops.push(`${colorFor(i * 2)} ${i * 4}%`);
  $('setTolCurve').style.background = `linear-gradient(90deg, ${stops.join(', ')})`;
  $('setTolCurve').innerHTML = '<span>on the swar</span><span>halfway to the next</span>';
}

function populateSettings() {
  $('setSaName').innerHTML = WESTERN.map((w, i) => `<option value="${w}">${w} (${HARMONIUM[i]})</option>`).join('');
  $('setThaat').innerHTML = THAATS.map((t) => `<option value="${t.id}">${t.rom} · ${t.dev}</option>`).join('');
  $('setRaag').innerHTML = RAAGS.map((r) => {
    const th = THAATS.find((t) => t.id === r.thaat);
    return `<option value="${r.id}">${r.rom} · ${r.dev} (${th.rom})</option>`;
  }).join('');

  const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
  on('setSaName', 'change', (e) => { S.saName = e.target.value; applySettings(); });
  on('setSaOct', 'change', (e) => { S.saOct = +e.target.value; applySettings(); });
  on('setThaat', 'change', (e) => { S.thaat = e.target.value; applySettings(); });
  on('setRaag', 'change', (e) => { S.raag = e.target.value; applySettings(); });
  on('setTol', 'input', (e) => { S.tolPct = +e.target.value; applySettings(); });
  on('setHold', 'input', (e) => { S.holdSec = +e.target.value; applySettings(); });
  on('setGate', 'input', (e) => { S.gateDb = +e.target.value; applySettings(); });
  dlg.querySelectorAll('input[name=scaleKind]').forEach((r) => r.addEventListener('change', () => { S.scaleKind = r.value; applySettings(); }));
  dlg.querySelectorAll('input[name=script]').forEach((r) => r.addEventListener('change', () => { S.script = r.value; applySettings(); }));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
}

/** Recompute everything that depends on settings and re-render. */
function applySettings() {
  saveSettings();
  scale = resolveScale(S);
  saFreq = saFrequency(S.saName, S.saOct);
  pitch.hist.length = 0;
  if (tanpura) tanpura.setTuning(saFreq, tanpuraFirstString(scale.allowed));
  document.documentElement.lang = S.script === 'dev' ? 'hi' : 'en';
  tuner.shownNote = null;
  renderContext();
  renderNoteButtons();
  renderPracticeSetup();
  if (game && game.state === 'menu') game.renderMenu();
  if (surang && surang.state === 'menu') surang.renderMenu();
  if (run && !$('pRun').hidden) {
    renderStrip();
    renderTarget();
    $('pRunDesc').textContent = exampleText(run.pattern.desc, S.script);
  }
  if (dlg.open) syncSettingsForm();
}

function renderContext() {
  const scaleName = S.script === 'rom' ? scale.name : scale.nameDev;
  $('contextBar').innerHTML = `<span><b>Sa</b> ${S.saName}${S.saOct} · ${saFreq.toFixed(1)} Hz</span><span>${scaleName}</span><span>±${S.tolPct}¢</span>`;
}

$('settingsBtn').addEventListener('click', openSettings);
$('contextBar').addEventListener('click', openSettings);
$('scriptBtn').addEventListener('click', () => {
  S.script = S.script === 'dev' ? 'rom' : 'dev';
  applySettings();
});

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function showView(view) {
  S.view = view;
  saveSettings();
  document.body.dataset.view = view;
  document.querySelectorAll('.tabs [data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === view)));
  $('view-tuner').hidden = view !== 'tuner';
  $('view-practice').hidden = view !== 'practice';
  $('view-game').hidden = view !== 'game';
  $('view-surang').hidden = view !== 'surang';
  if (view !== 'game' && game) game.pause();
  if (view !== 'surang' && surang) surang.pause();
}
document.querySelectorAll('.tabs [data-view]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

// ---------------------------------------------------------------------------
// Microphone gate and main loop
// ---------------------------------------------------------------------------

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(100, Math.max(0, now - lastFrame));
  lastFrame = now;
  updatePitch(now);
  if (S.view === 'tuner') renderTuner(now);
  else if (S.view === 'game') game.tick(now, dt, pitch);
  else if (S.view === 'surang') surang.tick(now, dt, pitch);
  else practiceTick(now, dt);
  requestAnimationFrame(frame);
}

async function startListening() {
  const err = $('micError');
  err.hidden = true;
  ensureAudio();
  if (ctx.state === 'suspended') await ctx.resume();
  try {
    if (new URLSearchParams(location.search).has('sim')) detector.simulate(null);
    else await detector.startMic();
    $('micGate').hidden = true;
  } catch (e) {
    err.textContent = e && e.name === 'NotAllowedError'
      ? 'Microphone access was blocked. Allow it in your browser’s site settings, then try again.'
      : `Could not open the microphone (${e && e.message ? e.message : e}).`;
    err.hidden = false;
    $('micStart').textContent = 'Try again';
  }
}
$('micStart').addEventListener('click', startListening);

// Debug hook: sur.simulate(220) feeds a test tone instead of the mic (?sim).
window.sur = { simulate: (f) => detector && detector.simulate(f), settings: S };

// ---------------------------------------------------------------------------
// Game: Sur Samraat
// ---------------------------------------------------------------------------

const game = new SurSamraat({
  el: {
    canvas: $('samCanvas'), hud: $('samHud'), menu: $('samMenu'), paused: $('samPaused'), result: $('samResult'),
    health: $('samHealth'), acc: $('samAcc'), progress: $('samProgress'), now: $('samNow'), next: $('samNext'),
    msg: $('samMsg'), pause: $('samPause'), resume: $('samResume'), quit: $('samQuit'),
    retry: $('samRetry'), back: $('samBack'),
  },
  script: () => S.script,
  colorFor,
  font: FONT,
  playNote: (n, dur) => {
    ensureAudio();
    if (ctx.state === 'suspended') ctx.resume();
    notePlayer.play(noteFreq(n), dur);
  },
  stopNotes: () => notePlayer && notePlayer.stop(),
});
window.sur.game = game;

// ---------------------------------------------------------------------------
// Game: Surang
// ---------------------------------------------------------------------------

const surang = new Surang({
  el: {
    canvas: $('sgCanvas'), menu: $('sgMenu'), paused: $('sgPaused'), result: $('sgResult'),
    pause: $('sgPause'), resume: $('sgResume'), quit: $('sgQuit'), retry: $('sgRetry'), back: $('sgBack'),
  },
  script: () => S.script,
  scale: () => scale,
  font: FONT,
  playNote: (n, dur) => {
    ensureAudio();
    if (ctx.state === 'suspended') ctx.resume();
    notePlayer.play(noteFreq(n), dur);
  },
  openSettings,
});
window.sur.surang = surang;

populateSettings();
applySettings();
showView(S.view);
showPracticePanel('setup');
requestAnimationFrame(frame);

window.addEventListener('resize', () => { if (run && !$('pRun').hidden) updateStrip(); });
