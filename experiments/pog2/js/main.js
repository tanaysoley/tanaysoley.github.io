import { Game } from './game.js';
import { Hud } from './hud.js';
import { initAudio, isMuted, setMuted } from './audio.js';
import { POGS, POWERS, GAME_URL } from './config.js';
import { buildShareCard, cardToBlob, shareScore } from './share.js';

const BEST_KEY = 'pog2.best';
const canvas = document.getElementById('game');
const stage = document.getElementById('stage');
const overlay = document.getElementById('overlay');
const ovTitle = document.getElementById('ovTitle');
const ovBody = document.getElementById('ovBody');
const ovAction = document.getElementById('ovAction');
const pauseBtn = document.getElementById('pauseBtn');
const muteBtn = document.getElementById('muteBtn');

let best = parseFloat(localStorage.getItem(BEST_KEY)) || 0;
let overlayMode = 'menu';
let overlayLockedUntil = 0;

let share = null; // { blob, url, time } for the last finished game

const hud = new Hud();
const game = new Game(canvas, {
  onGameOver({ time, kills }) {
    const isBest = time > best;
    if (isBest) {
      best = time;
      localStorage.setItem(BEST_KEY, String(best));
    }
    game.best = best;
    showOverlay('over', { time, kills, isBest });
    prepareShare({ snapshot: game.snapshot, time, best, kills, isBest });
  },
});
game.best = best;

async function prepareShare(data) {
  if (share) URL.revokeObjectURL(share.url);
  share = null;
  const blob = await cardToBlob(buildShareCard(data));
  if (!blob) return;
  share = { blob, url: URL.createObjectURL(blob), time: data.time };
  const img = document.getElementById('shareImg');
  const btn = document.getElementById('shareBtn');
  if (img) { img.src = share.url; img.classList.add('ready'); }
  if (btn) btn.disabled = false;
}

async function onShare() {
  if (!share) return;
  const status = document.getElementById('shareStatus');
  const result = await shareScore(share.blob, share.time);
  if (status && result === 'fallback') {
    status.textContent = 'Sharing isn’t supported here: image downloaded and link copied.';
  }
}

// ------------------------------------------------------------ sizing

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.round(stage.clientWidth * dpr);
  if (canvas.width !== size) {
    canvas.width = size;
    canvas.height = size;
  }
}
new ResizeObserver(resize).observe(stage);
resize();

// ------------------------------------------------------------ overlay

const pogLegend = Object.values(POGS)
  .map((p) => `<span class="legend"><i style="background:${p.color}"></i>${p.name}</span>`).join('');
const powerLegend = Object.values(POWERS)
  .map((p) => `<span class="legend"><b style="color:${p.color}">${p.glyph}</b>${p.name}</span>`).join('');

function showOverlay(mode, data = {}) {
  overlayMode = mode;
  overlay.classList.add('show');
  overlay.classList.toggle('over', mode === 'over');
  if (mode === 'menu') {
    ovTitle.textContent = 'POG 2';
    ovBody.innerHTML = `
      <p>Your gun circles the planet on its own. <b>Tap</b> anywhere (or press <b>Space</b>) to fire.</p>
      <p>Defend the planet from falling POGs: ${pogLegend}</p>
      <p>Shoot the glowing crystals to collect powers. They queue up and switch on in turn.</p>
      <p class="muted">Score = seconds survived. Best: ${best.toFixed(1)}s</p>`;
    ovAction.textContent = 'Tap to start';
  } else if (mode === 'paused') {
    ovTitle.textContent = 'Paused';
    ovBody.innerHTML = `<p class="powers-legend">${powerLegend}</p>`;
    ovAction.textContent = 'Tap to resume';
  } else if (mode === 'over') {
    ovTitle.textContent = 'Planet lost';
    ovBody.innerHTML = `
      <div class="final">${data.time.toFixed(1)}<span>s</span></div>
      <p>${data.isBest ? '<b class="new-best">★ New best!</b>' : `Best: ${best.toFixed(1)}s`}
        <span class="muted"> · ${data.kills} POGs destroyed</span></p>
      <img id="shareImg" class="share-img" alt="Score card: survived ${data.time.toFixed(1)} seconds in POG 2">
      <div class="final-actions">
        <button id="shareBtn" class="btn primary" disabled>Share</button>
        <button id="againBtn" class="btn">Play again</button>
      </div>
      <p id="shareStatus" class="muted">${GAME_URL.replace(/^https?:\/\//, '')}</p>`;
    ovAction.textContent = '';
    document.getElementById('shareBtn').addEventListener('click', onShare);
    document.getElementById('againBtn').addEventListener('click', overlayAction);
    overlayLockedUntil = performance.now() + 700; // avoid an accidental instant restart
  }
}

function hideOverlay() {
  overlay.classList.remove('show', 'over');
}

function overlayAction() {
  if (performance.now() < overlayLockedUntil) return;
  initAudio();
  if (overlayMode === 'paused') game.resume();
  else game.start();
  hideOverlay();
}

overlay.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  // The game-over screen has explicit buttons, so stray taps there don't restart.
  if (overlayMode === 'over') return;
  e.preventDefault();
  overlayAction();
});

// ------------------------------------------------------------ input

function togglePause() {
  if (game.phase === 'playing') {
    game.pause();
    showOverlay('paused');
  } else if (game.phase === 'paused') {
    game.resume();
    hideOverlay();
  }
}

document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  e.preventDefault();
  initAudio();
  game.tap();
});

pauseBtn.addEventListener('click', togglePause);
muteBtn.addEventListener('click', () => {
  initAudio();
  setMuted(!isMuted());
  renderMute();
});
function renderMute() {
  muteBtn.classList.toggle('off', isMuted());
  muteBtn.setAttribute('aria-label', isMuted() ? 'Unmute' : 'Mute');
}
renderMute();

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (e.repeat) return;
    if (overlay.classList.contains('show')) overlayAction();
    else { initAudio(); game.tap(); }
  } else if (e.code === 'KeyP' || e.code === 'Escape') {
    togglePause();
  } else if (e.code === 'KeyM') {
    setMuted(!isMuted());
    renderMute();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.phase === 'playing') togglePause();
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ------------------------------------------------------------ loop

let last = performance.now();
let hudTimer = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
  hudTimer -= dt;
  if (hudTimer <= 0) {
    hudTimer = 1 / 12;
    hud.update(game, best);
  }
  requestAnimationFrame(frame);
}

showOverlay('menu');
requestAnimationFrame(frame);

// Handy for tuning from the dev console.
window.pog2 = game;
