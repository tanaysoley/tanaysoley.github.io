// Swar names, thaats, raags, alankar patterns and notation helpers.
//
// A note is an integer: semitones above madhya (middle) Sa.
//   0 = Sa, 7 = Pa, 12 = taar Sa, -5 = mandra Pa, ...

export const SWARS = [
  { dev: 'सा', rom: 'Sa', mark: null },
  { dev: 'रे', rom: 'Re', mark: 'komal' },
  { dev: 'रे', rom: 'Re', mark: null },
  { dev: 'ग', rom: 'Ga', mark: 'komal' },
  { dev: 'ग', rom: 'Ga', mark: null },
  { dev: 'म', rom: 'Ma', mark: null },
  { dev: 'म', rom: 'Ma', mark: 'teevra' },
  { dev: 'प', rom: 'Pa', mark: null },
  { dev: 'ध', rom: 'Dha', mark: 'komal' },
  { dev: 'ध', rom: 'Dha', mark: null },
  { dev: 'नि', rom: 'Ni', mark: 'komal' },
  { dev: 'नि', rom: 'Ni', mark: null },
];

export const mod12 = (n) => ((n % 12) + 12) % 12;
export const octaveOf = (n) => Math.floor(n / 12);

export const WESTERN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Harmonium key names: white keys are "safed", black keys are "kali".
export const HARMONIUM = ['Safed 1', 'Kali 1', 'Safed 2', 'Kali 2', 'Safed 3', 'Safed 4', 'Kali 3', 'Safed 5', 'Kali 4', 'Safed 6', 'Kali 5', 'Safed 7'];

export function saFrequency(name, octave) {
  const midi = 12 * (octave + 1) + WESTERN.indexOf(name);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Swar as HTML: komal = line under, teevra = line over, octave as sub/superscript. */
export function swarHTML(n, script) {
  const s = SWARS[mod12(n)];
  const oct = octaveOf(n);
  const name = script === 'rom' ? s.rom : s.dev;
  let html = `<span class="swar"><span class="sn${s.mark ? ' ' + s.mark : ''}">${name}</span>`;
  if (oct > 0) html += `<sup>${oct}</sup>`;
  else if (oct < 0) html += `<sub>${-oct}</sub>`;
  return html + '</span>';
}

/**
 * Replace {S R G, ...} examples in pattern descriptions with swar names in
 * the chosen script.
 */
export function exampleText(desc, script) {
  return desc.replace(/\{([^}]*)\}/g, (_, body) =>
    body.replace(/[SrRgGmMPdDnN]/g, (t) => {
      const s = SWARS[TOKEN[t]];
      return script === 'rom' ? s.rom : s.dev;
    }));
}

/** Plain-text name for aria labels, e.g. "komal Re, lower octave". */
export function swarLabel(n) {
  const s = SWARS[mod12(n)];
  const oct = octaveOf(n);
  let label = (s.mark ? s.mark + ' ' : '') + s.rom;
  if (oct < 0) label += ` (mandra${oct < -1 ? ' ' + -oct : ''})`;
  if (oct > 0) label += ` (taar${oct > 1 ? ' ' + oct : ''})`;
  return label;
}

/** Draw a swar on a canvas, centred on x with the text baseline at y. */
export function drawSwar(ctx, n, x, y, size, color, script, font) {
  const s = SWARS[mod12(n)];
  const oct = octaveOf(n);
  const text = script === 'rom' ? s.rom : s.dev;
  const digit = oct ? String(Math.abs(oct)) : '';

  ctx.font = `600 ${size}px ${font}`;
  const m = ctx.measureText(text);
  const w = m.width;
  let dw = 0;
  if (digit) {
    ctx.font = `600 ${Math.round(size * 0.55)}px ${font}`;
    dw = ctx.measureText(digit).width + size * 0.06;
  }
  const x0 = x - (w + dw) / 2;
  const lw = Math.max(1.5, size / 13);

  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${size}px ${font}`;
  ctx.fillText(text, x0, y);

  const ascent = m.actualBoundingBoxAscent || size * 0.75;
  const descent = m.actualBoundingBoxDescent || size * 0.1;
  if (s.mark === 'komal') ctx.fillRect(x0, y + descent + lw, w, lw);
  if (s.mark === 'teevra') ctx.fillRect(x0, y - ascent - lw * 2.2, w, lw);

  if (digit) {
    ctx.font = `600 ${Math.round(size * 0.55)}px ${font}`;
    const dy = oct > 0 ? y - size * 0.5 : y + size * 0.22;
    ctx.fillText(digit, x0 + w + size * 0.06, dy);
  }
}

// ---------------------------------------------------------------------------
// Scales. Tokens: S r R g G m M P d D n N
//   lowercase r g d n = komal, m = shuddh Ma, M = teevra Ma
//   "." prefix = mandra (lower) octave, "'" suffix = taar (upper) octave
// ---------------------------------------------------------------------------

const TOKEN = { S: 0, r: 1, R: 2, g: 3, G: 4, m: 5, M: 6, P: 7, d: 8, D: 9, n: 10, N: 11 };

export function parseNotes(str) {
  return str.trim().split(/\s+/).map((tok) => {
    let oct = 0;
    let t = tok;
    while (t.startsWith('.')) { oct--; t = t.slice(1); }
    while (t.endsWith("'")) { oct++; t = t.slice(0, -1); }
    if (!(t in TOKEN)) throw new Error('Bad swar token: ' + tok);
    return TOKEN[t] + 12 * oct;
  });
}

export const THAATS = [
  { id: 'bilawal', dev: 'बिलावल', rom: 'Bilawal', notes: 'S R G m P D N' },
  { id: 'kalyan', dev: 'कल्याण', rom: 'Kalyan', notes: 'S R G M P D N' },
  { id: 'khamaj', dev: 'खमाज', rom: 'Khamaj', notes: 'S R G m P D n' },
  { id: 'kafi', dev: 'काफ़ी', rom: 'Kafi', notes: 'S R g m P D n' },
  { id: 'asavari', dev: 'आसावरी', rom: 'Asavari', notes: 'S R g m P d n' },
  { id: 'bhairavi', dev: 'भैरवी', rom: 'Bhairavi', notes: 'S r g m P d n' },
  { id: 'bhairav', dev: 'भैरव', rom: 'Bhairav', notes: 'S r G m P d N' },
  { id: 'marwa', dev: 'मारवा', rom: 'Marwa', notes: 'S r G M P D N' },
  { id: 'poorvi', dev: 'पूर्वी', rom: 'Poorvi', notes: 'S r G M P d N' },
  { id: 'todi', dev: 'तोड़ी', rom: 'Todi', notes: 'S r g M P d N' },
];

// Textbook aroha / avaroha, kept free of vakra (zig-zag) movements so the
// alankar patterns below can walk them in a straight line.
export const RAAGS = [
  { id: 'yaman', dev: 'यमन', rom: 'Yaman', thaat: 'kalyan', aroha: ".N R G M D N S'", avaroha: "S' N D P M G R S" },
  { id: 'bhupali', dev: 'भूपाली', rom: 'Bhupali', thaat: 'kalyan', aroha: "S R G P D S'", avaroha: "S' D P G R S" },
  { id: 'shuddh-kalyan', dev: 'शुद्ध कल्याण', rom: 'Shuddh Kalyan', thaat: 'kalyan', aroha: "S R G P D S'", avaroha: "S' N D P M G R S" },
  { id: 'bilawal', dev: 'बिलावल', rom: 'Bilawal', thaat: 'bilawal', aroha: "S R G m P D N S'", avaroha: "S' N D P m G R S" },
  { id: 'durga', dev: 'दुर्गा', rom: 'Durga', thaat: 'bilawal', aroha: "S R m P D S'", avaroha: "S' D P m R S" },
  { id: 'hamsadhwani', dev: 'हंसध्वनि', rom: 'Hamsadhwani', thaat: 'bilawal', aroha: "S R G P N S'", avaroha: "S' N P G R S" },
  { id: 'khamaj', dev: 'खमाज', rom: 'Khamaj', thaat: 'khamaj', aroha: "S G m P D N S'", avaroha: "S' n D P m G R S" },
  { id: 'des', dev: 'देस', rom: 'Des', thaat: 'khamaj', aroha: "S R m P N S'", avaroha: "S' n D P m G R S" },
  { id: 'kafi', dev: 'काफ़ी', rom: 'Kafi', thaat: 'kafi', aroha: "S R g m P D n S'", avaroha: "S' n D P m g R S" },
  { id: 'bhimpalasi', dev: 'भीमपलासी', rom: 'Bhimpalasi', thaat: 'kafi', aroha: ".n S g m P n S'", avaroha: "S' n D P m g R S" },
  { id: 'brindavani-sarang', dev: 'वृंदावनी सारंग', rom: 'Brindavani Sarang', thaat: 'kafi', aroha: ".N S R m P N S'", avaroha: "S' n P m R S" },
  { id: 'shivranjani', dev: 'शिवरंजनी', rom: 'Shivranjani', thaat: 'kafi', aroha: "S R g P D S'", avaroha: "S' D P g R S" },
  { id: 'asavari', dev: 'आसावरी', rom: 'Asavari', thaat: 'asavari', aroha: "S R m P d S'", avaroha: "S' n d P m g R S" },
  { id: 'bhairavi', dev: 'भैरवी', rom: 'Bhairavi', thaat: 'bhairavi', aroha: "S r g m P d n S'", avaroha: "S' n d P m g r S" },
  { id: 'malkauns', dev: 'मालकौंस', rom: 'Malkauns', thaat: 'bhairavi', aroha: "S g m d n S'", avaroha: "S' n d m g S" },
  { id: 'bhairav', dev: 'भैरव', rom: 'Bhairav', thaat: 'bhairav', aroha: "S r G m P d N S'", avaroha: "S' N d P m G r S" },
  { id: 'marwa', dev: 'मारवा', rom: 'Marwa', thaat: 'marwa', aroha: ".N r G M D N S'", avaroha: "S' N D M G r S" },
  { id: 'todi', dev: 'तोड़ी', rom: 'Todi', thaat: 'todi', aroha: "S r g M P d N S'", avaroha: "S' N d P M g r S" },
];

/**
 * Resolve the user's scale choice into the notes it allows and an aroha/avaroha
 * to walk for practice.
 */
export function resolveScale(settings) {
  let aroha, avaroha, name, nameDev;
  if (settings.scaleKind === 'raag') {
    const r = RAAGS.find((x) => x.id === settings.raag) || RAAGS[0];
    aroha = parseNotes(r.aroha);
    avaroha = parseNotes(r.avaroha);
    name = 'Raag ' + r.rom;
    nameDev = 'राग ' + r.dev;
  } else if (settings.scaleKind === 'thaat') {
    const t = THAATS.find((x) => x.id === settings.thaat) || THAATS[0];
    aroha = [...parseNotes(t.notes), 12];
    avaroha = [...aroha].reverse();
    name = t.rom + ' thaat';
    nameDev = t.dev + ' थाट';
  } else {
    aroha = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    avaroha = [...aroha].reverse();
    name = 'All 12 swars';
    nameDev = 'सभी 12 स्वर';
  }
  const allowed = new Set([...aroha, ...avaroha].map(mod12));
  return { aroha, avaroha, allowed, name, nameDev };
}

/** Tanpura's first string: Pa if the scale has it, else shuddh Ma, else Ni. */
export function tanpuraFirstString(allowed) {
  if (allowed.has(7)) return 7;
  if (allowed.has(5)) return 5;
  if (allowed.has(11)) return 11;
  return 7;
}

// ---------------------------------------------------------------------------
// Practice patterns. Each returns groups of notes (arrays) so the sequence
// can be shown with the grouping that makes the alankar recognisable.
// ---------------------------------------------------------------------------

function windows(list, k) {
  const out = [];
  for (let i = 0; i + k <= list.length; i++) out.push(list.slice(i, i + k));
  return out;
}

export const PATTERNS = [
  {
    id: 'aroha',
    name: 'Aroha – Avaroha',
    dev: 'आरोह – अवरोह',
    desc: 'Climb the scale to taar Sa (aroha), then come back down to Sa (avaroha).',
    gen: (A, B) => [A, B.slice(1)],
  },
  {
    id: 'pairs',
    name: 'Alankar 1: each swar twice',
    dev: 'अलंकार 1',
    desc: 'Sing every swar twice before moving on ({S S, R R, G G} …), up and then down.',
    gen: (A, B) => [...A.map((n) => [n, n]), ...B.slice(1).map((n) => [n, n])],
  },
  {
    id: 'three',
    name: 'Alankar 2: groups of three',
    dev: 'अलंकार 2',
    desc: 'Three swars at a time, starting one swar higher each time ({S R G, R G m, G m P} …), then the same coming down.',
    gen: (A, B) => [...windows(A, 3), ...windows(B, 3)],
  },
  {
    id: 'four',
    name: 'Alankar 3: groups of four',
    dev: 'अलंकार 3',
    desc: 'Four swars at a time, starting one swar higher each time ({S R G m, R G m P} …), then the same coming down.',
    gen: (A, B) => [...windows(A, 4), ...windows(B, 4)],
  },
  {
    id: 'skip',
    name: 'Alankar 4: skip one',
    dev: 'अलंकार 4',
    desc: 'Jump over the next swar ({S G, R m, G P} …), then the same jumps coming down.',
    gen: (A, B) => {
      const up = [];
      for (let i = 0; i + 2 < A.length; i++) up.push([A[i], A[i + 2]]);
      const down = [];
      for (let i = 0; i + 2 < B.length; i++) down.push([B[i], B[i + 2]]);
      return [...up, ...down];
    },
  },
  {
    id: 'turn',
    name: 'Alankar 5: step and return',
    dev: 'अलंकार 5',
    desc: 'Step to the next swar and come back ({S R S, R G R, G m G} …), up and then down.',
    gen: (A, B) => {
      const up = [];
      for (let i = 0; i + 1 < A.length; i++) up.push([A[i], A[i + 1], A[i]]);
      const down = [];
      for (let i = 0; i + 1 < B.length; i++) down.push([B[i], B[i + 1], B[i]]);
      return [...up, ...down];
    },
  },
  {
    id: 'random',
    name: 'Random swars',
    dev: 'यादृच्छिक स्वर',
    desc: '16 random swars from the scale, between mandra Pa and taar Sa. No swar repeats back to back.',
    gen: (A, B) => {
      const pool = [...new Set([...A, ...B].map(mod12))]
        .flatMap((s) => [s - 12, s, s + 12])
        .filter((n) => n >= -5 && n <= 12);
      const out = [];
      let prev = null;
      for (let i = 0; i < 16; i++) {
        let n;
        do n = pool[Math.floor(Math.random() * pool.length)];
        while (n === prev && pool.length > 1);
        out.push(n);
        prev = n;
      }
      const groups = [];
      for (let i = 0; i < out.length; i += 4) groups.push(out.slice(i, i + 4));
      return groups;
    },
  },
];
