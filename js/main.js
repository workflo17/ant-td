// ===== Boot + fixed-timestep engine loop =====
import { initRender, draw } from './render.js';
import { updateParticles } from './particles.js';
import * as UI from './ui.js';
import { initDebug } from './debug.js';

const canvas = document.getElementById('game-canvas');
initRender(canvas);
UI.init();
initDebug({
  getGame: UI.getGame,
  setSpeed: UI.setSpeed,
  refreshUI: UI.refreshAll,
});

// Fixed 60Hz simulation steps; speed multiplies steps per frame, so 1x and 3x
// (and debug 10x) produce identical physics — no tunneling, no dt blowups.
const STEP = 1 / 60;
const MAX_STEPS = 40;
let acc = 0;
let last = performance.now();

function advance(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;

  const game = UI.getGame();
  if (game && !game.paused) {
    acc += dt * game.speed;
    let n = 0;
    while (acc >= STEP && n < MAX_STEPS) {
      game.step(STEP);
      acc -= STEP;
      n++;
    }
    if (n >= MAX_STEPS) acc = 0; // shed load rather than spiral
    updateParticles(Math.min(dt * game.speed, 0.2));
  } else if (!game) {
    acc = 0;
  }
  return game;
}

function frame(now) {
  requestAnimationFrame(frame);
  const game = advance(now);
  draw(game, UI.uiState, now / 1000);
  UI.tick();
}
requestAnimationFrame(frame);

// warm the display font so the first canvas banner isn't a fallback frame
if (document.fonts && document.fonts.load) {
  document.fonts.load("800 56px 'Baloo 2'").catch(() => {});
}

// installable + offline
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* dev servers without SW support: fine */ });
}

// rAF stops in hidden/background tabs — keep the colony fighting anyway.
setInterval(() => {
  const now = performance.now();
  if (now - last > 90) {
    const game = advance(now);
    draw(game, UI.uiState, now / 1000);
    UI.tick();
  }
}, 50);
