import { GAME_URL, POGS } from './config.js';

const W = 1080;
const H = 1350;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const DISPLAY_URL = GAME_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

const LOGO_POG_FONT = '"Luckiest Guy", "Arial Black", Impact, sans-serif';
const LOGO_2_FONT = '"Bungee", "Arial Black", Impact, sans-serif';

// Make sure the logo's web fonts are ready before drawing them on a canvas (give up after 2s).
function loadLogoFonts() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const load = Promise.all([
    document.fonts.load(`96px ${LOGO_POG_FONT}`),
    document.fonts.load(`96px ${LOGO_2_FONT}`),
  ]).catch(() => {});
  return Promise.race([load, new Promise((r) => setTimeout(r, 2000))]);
}

// "POG" in a pink → orange → green gradient, then a bigger, tilted white "2" in a different font.
// Mirrors the .logo styles in style.css.
function drawLogo(ctx, cx, baseline, size) {
  const outline = '#1a1033';
  const pogFont = `${size}px ${LOGO_POG_FONT}`;
  const twoSize = size * 1.4;
  const twoFont = `${twoSize}px ${LOGO_2_FONT}`;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.font = pogFont;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.04)}px`;
  const wPog = ctx.measureText('POG').width;
  ctx.font = twoFont;
  const w2 = ctx.measureText('2').width;
  const gap = size * 0.14;
  const x0 = cx - (wPog + gap + w2) / 2;

  // POG: drop shadow, outline, gradient fill
  ctx.font = pogFont;
  ctx.fillStyle = outline;
  ctx.fillText('POG', x0, baseline + size * 0.08);
  ctx.lineWidth = size * 0.1;
  ctx.strokeStyle = outline;
  ctx.strokeText('POG', x0, baseline);
  const g = ctx.createLinearGradient(x0, 0, x0 + wPog, 0);
  g.addColorStop(0, POGS.pink.color);
  g.addColorStop(0.18, POGS.pink.color);
  g.addColorStop(0.5, POGS.orange.color);
  g.addColorStop(0.82, POGS.green.color);
  g.addColorStop(1, POGS.green.color);
  ctx.fillStyle = g;
  ctx.fillText('POG', x0, baseline);

  // 2: tilted, white, bigger, with a soft glow
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.translate(x0 + wPog + gap + w2 / 2, baseline - size * 0.3);
  ctx.rotate(-0.14);
  ctx.font = twoFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = outline;
  ctx.fillText('2', 0, size * 0.08);
  ctx.lineWidth = size * 0.1;
  ctx.strokeText('2', 0, 0);
  ctx.shadowColor = 'rgba(255,255,255,0.55)';
  ctx.shadowBlur = size * 0.25;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('2', 0, 0);
  ctx.restore();
}

// Draws the shareable score card: game frame + score + best + link.
export async function buildShareCard({ snapshot, score, best, kills, isBest }) {
  await loadLogoFonts();
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  // Background + stars
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a0d1f');
  bg.addColorStop(1, '#05060d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 140; i++) {
    ctx.globalAlpha = 0.2 + Math.random() * 0.5;
    const s = Math.random() * 2.5 + 0.5;
    ctx.fillRect(Math.random() * W, Math.random() * H, s, s);
  }
  ctx.globalAlpha = 1;

  // Logo
  drawLogo(ctx, W / 2, 140, 92);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Game frame
  const S = 820, X = (W - S) / 2, Y = 170;
  ctx.save();
  roundRect(ctx, X, Y, S, S, 28);
  ctx.clip();
  ctx.fillStyle = '#05060d';
  ctx.fillRect(X, Y, S, S);
  if (snapshot) ctx.drawImage(snapshot, X, Y, S, S);
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2a3463';
  roundRect(ctx, X, Y, S, S, 28);
  ctx.stroke();

  // Score
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 140px ${FONT}`;
  const num = String(score);
  const w = ctx.measureText(num).width;
  ctx.fillText(num, W / 2 - 22, 1135);
  ctx.textAlign = 'left';
  ctx.font = `700 60px ${FONT}`;
  ctx.fillStyle = '#8a93b8';
  ctx.fillText('s', W / 2 - 22 + w / 2 + 8, 1135);
  ctx.textAlign = 'center';

  ctx.font = `600 36px ${FONT}`;
  if (isBest) {
    ctx.fillStyle = '#ffe066';
    ctx.fillText(`★ NEW BEST  ·  ${kills} POGs destroyed`, W / 2, 1195);
  } else {
    ctx.fillStyle = '#c3cae8';
    ctx.fillText(`Best ${best}s  ·  ${kills} POGs destroyed`, W / 2, 1195);
  }

  // Link
  ctx.font = `700 38px ${FONT}`;
  ctx.fillStyle = POGS.green.color;
  ctx.fillText(`Play at ${DISPLAY_URL}`, W / 2, 1290);
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function cardToBlob(card) {
  return new Promise((resolve) => card.toBlob(resolve, 'image/png'));
}

// Opens the system share sheet with the card image. Falls back to a text/link share,
// and finally to downloading the image + copying the link.
// Returns 'shared' | 'cancelled' | 'fallback'.
export async function shareScore(blob, score) {
  const text = `I defended my planet for ${score}s in POG 2! Can you beat it?`;
  const file = new File([blob], 'pog2-score.png', { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      // Some targets drop `url` when files are attached, so the link also goes in the text.
      await navigator.share({ files: [file], title: 'POG 2', text: `${text} ${GAME_URL}` });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title: 'POG 2', text, url: GAME_URL });
      return 'shared';
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return 'cancelled';
    // Anything else (e.g. NotAllowedError) → fall through to the fallback.
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pog2-score.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  try { await navigator.clipboard.writeText(`${text} ${GAME_URL}`); } catch { /* ignore */ }
  return 'fallback';
}
