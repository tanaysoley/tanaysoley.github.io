import { GAME_URL, POGS } from './config.js';

const W = 1080;
const H = 1350;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const DISPLAY_URL = GAME_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

// Draws the shareable score card: game frame + score + best + link.
export function buildShareCard({ snapshot, time, best, kills, isBest }) {
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

  // Title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const title = ctx.createLinearGradient(W / 2 - 180, 0, W / 2 + 180, 0);
  title.addColorStop(0, POGS.pink.color);
  title.addColorStop(0.5, POGS.orange.color);
  title.addColorStop(1, POGS.green.color);
  ctx.fillStyle = title;
  ctx.font = `900 96px ${FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '12px';
  ctx.fillText('POG 2', W / 2 + 6, 130);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

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
  const num = time.toFixed(1);
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
    ctx.fillText(`Best ${best.toFixed(1)}s  ·  ${kills} POGs destroyed`, W / 2, 1195);
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
export async function shareScore(blob, time) {
  const text = `I defended my planet for ${time.toFixed(1)}s in POG 2! Can you beat it?`;
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
