// ===== ?debug panel: grant sugar, jump rounds, turbo, hitboxes, spawn, god =====
import { ENEMIES } from '../data/enemies.js';
import { unlockAll } from './save.js';
import { hitEnemy } from './enemies.js';
import { acquireTarget } from './towers.js';
import { draw } from './render.js';
import { uiState } from './ui.js';
import { musicState } from './music.js';
import { soundState, unlockAudio } from './sound.js';

export function isDebug() {
  return new URLSearchParams(location.search).has('debug');
}

export function initDebug(api) {
  // api: { getGame(), setSpeed(n), refreshUI(), place(type,x,y), upgrade(t,pk) }
  window.TD = {
    get game() { return api.getGame(); },
    sugar(n = 5000) { const g = api.getGame(); if (g) { g.sugar += n; api.refreshUI(); } },
    round(n) { const g = api.getGame(); if (g) { g.jumpToRound(n); api.refreshUI(); } },
    auto(on = true) { const g = api.getGame(); if (g) g.autoStart = on; },
    god(on = true) { const g = api.getGame(); if (g) g.god = on; },
    hitboxes(on = true) { const g = api.getGame(); if (g) g.hitboxes = on; },
    turbo() { api.setSpeed(10); },
    speed(n) { api.setSpeed(n); },
    place(type, x, y) { const g = api.getGame(); return g ? g.placeTower(type, x, y) : null; },
    up(t, pk, times = 1) { const g = api.getGame(); for (let i = 0; i < times; i++) g.upgrade(t, pk); return t.tiers; },
    spawn(type, opts = {}) { const g = api.getGame(); return g ? g.spawnEnemy(type, opts) : null; },
    start() { const g = api.getGame(); if (g) g.startRound(); },
    unlock() { unlockAll(); api.refreshUI(); },
    // test hooks
    hit(e, amount, dtype = 'crush', perk = {}) { const g = api.getGame(); return g ? hitEnemy(g, e, amount, dtype, perk) : 0; },
    acquire(t) { const g = api.getGame(); const e = g ? acquireTarget(g, t) : null; return e ? e.typeId : null; },
    clear() { const g = api.getGame(); if (g) for (const e of g.enemies) e.dead = true; },
    music() { return musicState(); },
    sound() { unlockAudio(); return soundState(); },
    swarm(n = 300) {
      const g = api.getGame();
      const mix = ['moth', 'moth', 'hopper', 'snail', 'weevil', 'moth'];
      for (let i = 0; i < n; i++) {
        g.spawnEnemy(mix[i % mix.length], {
          dist: 20 + (i * 6) % Math.max(400, g.paths[0].length - 200),
          camo: i % 5 === 0, regen: i % 4 === 0,
        });
      }
      return g.enemies.length;
    },
    bench(frames = 180, stepsPerFrame = 3) {
      const g = api.getGame();
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) {
        for (let s = 0; s < stepsPerFrame; s++) g.step(1 / 60);
        draw(g, uiState, performance.now() / 1000);
      }
      const ms = (performance.now() - t0) / frames;
      return { msPerFrame: +ms.toFixed(2), fpsCapable: +(1000 / ms).toFixed(0), enemies: g.enemies.length, towers: g.towers.length };
    },
    shot(name = 'shot') {
      return fetch('http://127.0.0.1:5411/' + name, {
        method: 'POST',
        body: document.getElementById('game-canvas').toDataURL('image/png'),
      }).then(r => r.text());
    },
  };

  if (!isDebug()) return;

  const panel = document.createElement('div');
  panel.id = 'debug-panel';
  panel.innerHTML = `
    <div class="dbg-title">DEBUG</div>
    <div class="dbg-row">
      <button data-act="sugar">+5000 sugar</button>
      <button data-act="god">god</button>
      <button data-act="hitboxes">hitboxes</button>
    </div>
    <div class="dbg-row">
      <input id="dbg-round" type="number" min="1" max="200" value="15" />
      <button data-act="round">go round</button>
      <button data-act="auto">auto-start</button>
    </div>
    <div class="dbg-row">
      <button data-act="turbo">turbo 10x</button>
      <button data-act="speed1">1x</button>
      <select id="dbg-spawn">${Object.keys(ENEMIES).map(k => `<option>${k}</option>`).join('')}</select>
      <button data-act="spawn">spawn</button>
      <label><input type="checkbox" id="dbg-camo">camo</label>
      <label><input type="checkbox" id="dbg-regen">regen</label>
    </div>
    <div class="dbg-row"><button data-act="unlock">unlock maps</button><span id="dbg-fps"></span></div>
  `;
  document.body.appendChild(panel);

  let god = false, hb = false, auto = false;
  panel.addEventListener('click', (ev) => {
    const act = ev.target.dataset && ev.target.dataset.act;
    if (!act) return;
    const g = api.getGame();
    if (act === 'sugar') window.TD.sugar(5000);
    else if (act === 'god') { god = !god; window.TD.god(god); ev.target.classList.toggle('on', god); }
    else if (act === 'hitboxes') { hb = !hb; window.TD.hitboxes(hb); ev.target.classList.toggle('on', hb); }
    else if (act === 'round') window.TD.round(parseInt(document.getElementById('dbg-round').value, 10) || 1);
    else if (act === 'auto') { auto = !auto; window.TD.auto(auto); ev.target.classList.toggle('on', auto); }
    else if (act === 'turbo') window.TD.turbo();
    else if (act === 'speed1') window.TD.speed(1);
    else if (act === 'spawn') {
      if (g) g.spawnEnemy(document.getElementById('dbg-spawn').value, {
        camo: document.getElementById('dbg-camo').checked,
        regen: document.getElementById('dbg-regen').checked,
      });
    }
    else if (act === 'unlock') window.TD.unlock();
  });

  // fps meter
  let frames = 0, last = performance.now();
  function fpsTick() {
    frames++;
    const now = performance.now();
    if (now - last >= 1000) {
      const el = document.getElementById('dbg-fps');
      if (el) el.textContent = `${frames} fps`;
      frames = 0;
      last = now;
    }
    requestAnimationFrame(fpsTick);
  }
  requestAnimationFrame(fpsTick);
}
