// Sprites for Surang. A theme lives in sprites/<theme>/ with a theme.json
// listing the PNGs it provides. Anything a theme doesn't provide (or the
// whole set, for the built-in "placeholder" theme) is drawn here in code, so
// the game always runs. See sprites/README.md for sizes and orientation.

export const SPRITE_NAMES = [
  'rock', 'passage', 'edge', 'corner-out', 'corner-in',
  'ball-idle', 'ball-sing', 'ball-hit',
  'pad', 'exit', 'spark',
  'bg-sky', 'bg-far', 'bg-near',
];

const DEFAULT_CONFIG = {
  tile: 160,        // CSS px one rock/passage texture tile covers
  edge: 12,         // CSS px thickness of the wall trim
  padTop: 0,        // fraction of pad.png's height above its walkable surface
  ballFill: 0.7,    // fraction of the ball sprite's width the ball itself fills
  lane: 'rgba(255,255,255,0.05)',
  laneLine: 'rgba(255,255,255,0.10)',
  laneTarget: 'rgba(255,207,90,0.13)',
  label: '#8a93c4',
  labelTarget: '#ffcf5a',
  gutter: 'rgba(8,12,32,0.82)',
  trail: 'rgba(255,207,90,0.55)',
  fail: '#ff5a5a',
};

export async function loadTheme(name) {
  const sprites = {};
  let config = { ...DEFAULT_CONFIG };
  let files = [];
  if (name && name !== 'placeholder') {
    try {
      const res = await fetch(`sprites/${name}/theme.json`, { cache: 'no-cache' });
      if (res.ok) {
        const json = await res.json();
        files = json.files || [];
        config = { ...config, ...(json.config || {}) };
      }
    } catch { /* no theme: placeholders */ }
  }
  await Promise.all(files.map(async (file) => {
    const key = file.replace(/\.(png|webp|jpg)$/i, '');
    if (!SPRITE_NAMES.includes(key)) return;
    try { sprites[key] = await loadImage(`sprites/${name}/${file}`); } catch { /* fall back */ }
  }));
  for (const key of SPRITE_NAMES) if (!sprites[key]) sprites[key] = PLACEHOLDERS[key]();
  return { sprites, config };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// Placeholder art: the "night neon" look from the mocks.
// ---------------------------------------------------------------------------

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Draw fn at (x, y) and at its wrapped copies so the tile is seamless. */
function wrapped(w, h, x, y, r, fn) {
  for (const dx of [-w, 0, w]) {
    for (const dy of [-h, 0, h]) {
      if (x + dx + r < 0 || x + dx - r > w || y + dy + r < 0 || y + dy - r > h) continue;
      fn(x + dx, y + dy);
    }
  }
}

function speckle(base, blobs, seed) {
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  const r = rng(seed);
  for (const [color, count, min, max] of blobs) {
    g.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const x = r() * S;
      const y = r() * S;
      const rad = min + r() * (max - min);
      wrapped(S, S, x, y, rad, (px, py) => {
        g.beginPath();
        g.ellipse(px, py, rad, rad * (0.6 + r() * 0.4), 0, 0, Math.PI * 2);
        g.fill();
      });
    }
  }
  return c;
}

function ballSprite(core, rim, glow, rays) {
  const S = 128;
  const [c, g] = canvas(S, S);
  const R = S * 0.35;
  const cx = S / 2;
  if (glow) {
    const gr = g.createRadialGradient(cx, cx, R * 0.8, cx, cx, S / 2);
    gr.addColorStop(0, glow);
    gr.addColorStop(1, 'rgba(255,207,90,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  }
  if (rays) {
    g.strokeStyle = 'rgba(255,240,200,0.55)';
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * R * 1.12, cx + Math.sin(a) * R * 1.12);
      g.lineTo(cx + Math.cos(a) * R * 1.38, cx + Math.sin(a) * R * 1.38);
      g.stroke();
    }
  }
  const body = g.createRadialGradient(cx - R * 0.35, cx - R * 0.35, R * 0.1, cx, cx, R);
  body.addColorStop(0, '#fff6d8');
  body.addColorStop(0.35, core);
  body.addColorStop(1, rim);
  g.fillStyle = body;
  g.beginPath();
  g.arc(cx, cx, R, 0, Math.PI * 2);
  g.fill();
  return c;
}

const PLACEHOLDERS = {
  rock: () => speckle('#3b2f63', [['#33285a', 26, 10, 30], ['#463972', 22, 6, 20], ['#2c2350', 40, 2, 5]], 7),
  passage: () => speckle('#0f1734', [['#131d40', 18, 12, 34], ['#1a2550', 30, 1, 2.5]], 11),

  // Canonical orientation: rock above, open passage below; crisp bottom edge.
  edge: () => {
    const [c, g] = canvas(256, 32);
    const gr = g.createLinearGradient(0, 0, 0, 32);
    gr.addColorStop(0, 'rgba(95,224,192,0)');
    gr.addColorStop(1, 'rgba(95,224,192,0.45)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 32);
    g.fillStyle = '#5fe0c0';
    g.fillRect(0, 27, 256, 5);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let x = 8; x < 256; x += 32) g.fillRect(x, 28, 10, 2);
    return c;
  },

  // Square that sits up-left of a corner point. corner-out: rock occupies
  // the up-left quadrant only (trim wraps around the rock's corner), so the
  // trim runs along the bottom and right edges of the square.
  'corner-out': () => {
    const S = 32;
    const [c, g] = canvas(S, S);
    const v = g.createLinearGradient(0, 0, 0, S);
    v.addColorStop(0, 'rgba(95,224,192,0)');
    v.addColorStop(1, 'rgba(95,224,192,0.45)');
    const h = g.createLinearGradient(0, 0, S, 0);
    h.addColorStop(0, 'rgba(95,224,192,0)');
    h.addColorStop(1, 'rgba(95,224,192,0.45)');
    g.save();
    g.beginPath(); g.moveTo(0, S); g.lineTo(S, S); g.lineTo(S, 0); g.closePath(); g.clip();
    g.fillStyle = v; g.fillRect(0, 0, S, S);
    g.restore();
    g.save();
    g.beginPath(); g.moveTo(0, 0); g.lineTo(S, 0); g.lineTo(S, S); g.closePath(); g.clip();
    g.fillStyle = h; g.fillRect(0, 0, S, S);
    g.restore();
    g.fillStyle = '#5fe0c0';
    g.fillRect(0, S - 5, S, 5);
    g.fillRect(S - 5, 0, 5, S);
    return c;
  },

  // corner-in: the passage occupies only the down-right quadrant past the
  // square's bottom-right point (the inside corner of a room). The trims
  // meet at that point.
  'corner-in': () => {
    const S = 32;
    const [c, g] = canvas(S, S);
    const gr = g.createRadialGradient(S, S, 0, S, S, S);
    gr.addColorStop(0, 'rgba(95,224,192,0.45)');
    gr.addColorStop(1, 'rgba(95,224,192,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#5fe0c0';
    g.beginPath();
    g.arc(S, S, 5, Math.PI, Math.PI * 1.5);
    g.lineTo(S, S);
    g.fill();
    return c;
  },

  'ball-idle': () => ballSprite('#ffcf5a', '#d98a1c', null, false),
  'ball-sing': () => ballSprite('#ffe07a', '#f0a030', 'rgba(255,207,90,0.45)', true),
  'ball-hit': () => {
    const S = 128;
    const [c, g] = canvas(S, S);
    g.fillStyle = '#c2702a';
    g.beginPath();
    g.ellipse(S / 2, S * 0.62, S * 0.4, S * 0.25, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#5a2a10';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(S * 0.42, S * 0.42); g.lineTo(S * 0.5, S * 0.58); g.lineTo(S * 0.44, S * 0.7);
    g.moveTo(S * 0.5, S * 0.58); g.lineTo(S * 0.62, S * 0.62);
    g.stroke();
    return c;
  },

  // The top edge of the image is the surface the ball rests on.
  pad: () => {
    const [c, g] = canvas(192, 48);
    g.fillStyle = '#4b5a9c';
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(192, 0); g.lineTo(176, 40); g.lineTo(16, 40); g.closePath();
    g.fill();
    g.fillStyle = '#7f8fd6';
    g.fillRect(0, 0, 192, 6);
    g.fillStyle = '#34407a';
    g.fillRect(24, 22, 144, 4);
    return c;
  },

  exit: () => {
    const [c, g] = canvas(128, 192);
    g.strokeStyle = '#ff8a5a';
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(20, 192); g.lineTo(20, 64);
    g.arc(64, 64, 44, Math.PI, 0);
    g.lineTo(108, 192);
    g.stroke();
    g.fillStyle = 'rgba(255,138,90,0.22)';
    g.beginPath();
    g.moveTo(25, 192); g.lineTo(25, 64); g.arc(64, 64, 39, Math.PI, 0); g.lineTo(103, 192); g.closePath();
    g.fill();
    return c;
  },

  spark: () => {
    const [c, g] = canvas(32, 32);
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,220,180,0.8)');
    gr.addColorStop(1, 'rgba(255,160,120,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
    return c;
  },

  'bg-sky': () => {
    const [c, g] = canvas(540, 960);
    const gr = g.createLinearGradient(0, 0, 0, 960);
    gr.addColorStop(0, '#0a0f24');
    gr.addColorStop(1, '#1d2552');
    g.fillStyle = gr;
    g.fillRect(0, 0, 540, 960);
    const r = rng(3);
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(200,210,255,${0.2 + r() * 0.6})`;
      g.fillRect(r() * 540, r() * 700, 1 + r() * 1.5, 1 + r() * 1.5);
    }
    return c;
  },

  'bg-far': () => hills(1024, 384, '#18204a', [[2, 60], [5, 26], [11, 10]], 0.45),
  'bg-near': () => hills(1024, 256, '#10163a', [[3, 40], [7, 18], [17, 6]], 0.5),
};

/** Seamless hill silhouette: sine waves with whole periods across the width. */
function hills(w, h, color, waves, base) {
  const [c, g] = canvas(w, h);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) {
    let y = h * base;
    waves.forEach(([k, amp], i) => { y += amp * Math.sin((x / w) * Math.PI * 2 * k + i * 1.7); });
    g.lineTo(x, y);
  }
  g.lineTo(w, h);
  g.closePath();
  g.fill();
  return c;
}
