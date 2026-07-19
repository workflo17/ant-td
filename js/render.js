// ===== All art is drawn here, procedurally. Chunky cartoon: flat fills + thick ink outlines. =====
import { WORLD_W, WORLD_H, PATH_HALF_W } from '../data/maps.js';
import { TAU, mulberry32, posAt } from './util.js';
import { drawParticles } from './particles.js';
import { INK, mixHex, bodyGrad, rr } from './render/helpers.js';
import { bodyColors, drawBugBody, drawSnailShell, drawStatusFx, drawHpBar } from './render/bugs.js';
import { drawAnt, drawTowerIcon } from './render/ants.js';


let canvas = null, ctx = null;
let bake = null; // offscreen background per map
let decals = null, decalCtx = null; // persistent scorch marks, faded slowly
let lastDrawTime = 0, decalFadeT = 0;
let DPR = 1; // retina backing store; world coords stay 960x640
let nightPools = null;      // night map: lamp pool positions for the live entity-lighting pass
let nightGlowSprite = null; // pre-rendered warm radial glow (no per-frame gradients)

export function initRender(cv) {
  canvas = cv;
  const forced = parseFloat(new URLSearchParams(location.search).get('dpr'));
  DPR = forced > 0 ? Math.min(2, forced) : Math.min(2, window.devicePixelRatio || 1);
  cv.width = WORLD_W * DPR;
  cv.height = WORLD_H * DPR;
  ctx = cv.getContext('2d');
}

// ---------- background baking ----------


// battlefield scars: stamped by explosions, slowly fade out
export function addDecal(x, y, scale = 1) {
  if (!decalCtx) return;
  decalCtx.save();
  decalCtx.translate(x, y);
  decalCtx.rotate(Math.random() * TAU);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.random();
    decalCtx.fillStyle = i === 0 ? 'rgba(34,20,10,0.5)' : 'rgba(34,20,10,0.32)';
    decalCtx.beginPath();
    decalCtx.ellipse(Math.cos(a) * 8 * scale, Math.sin(a) * 8 * scale, (14 - i * 2.4) * scale, (10 - i * 1.8) * scale, a, 0, TAU);
    decalCtx.fill();
  }
  decalCtx.restore();
}

export function bakeMap(game) {
  bake = document.createElement('canvas');
  bake.width = WORLD_W * DPR;
  bake.height = WORLD_H * DPR;
  decals = document.createElement('canvas');
  decals.width = WORLD_W * DPR;
  decals.height = WORLD_H * DPR;
  decalCtx = decals.getContext('2d');
  decalCtx.scale(DPR, DPR);
  const b = bake.getContext('2d');
  b.scale(DPR, DPR);
  const rng = mulberry32(1234);
  const style = game.map.bg;

  if (style === 'picnic') {
    b.fillStyle = '#f8efd4';
    b.fillRect(0, 0, WORLD_W, WORLD_H);
    b.fillStyle = 'rgba(226,75,53,0.26)';
    for (let x = 0; x < WORLD_W; x += 96) b.fillRect(x, 0, 48, WORLD_H);
    for (let y = 0; y < WORLD_H; y += 96) b.fillRect(0, y, WORLD_W, 48);
    // woven-fabric threads
    b.strokeStyle = 'rgba(255,255,255,0.05)';
    b.lineWidth = 1;
    for (let d = -WORLD_H; d < WORLD_W; d += 6) {
      b.beginPath(); b.moveTo(d, 0); b.lineTo(d + WORLD_H, WORLD_H); b.stroke();
    }
    b.strokeStyle = 'rgba(43,26,16,0.03)';
    for (let d = 0; d < WORLD_W + WORLD_H; d += 6) {
      b.beginPath(); b.moveTo(d, 0); b.lineTo(d - WORLD_H, WORLD_H); b.stroke();
    }
    // stitched border
    b.strokeStyle = 'rgba(43,26,16,0.5)';
    b.lineWidth = 3;
    b.setLineDash([12, 8]);
    b.strokeRect(10, 10, WORLD_W - 20, WORLD_H - 20);
    b.setLineDash([]);
  } else if (style === 'garden') {
    b.fillStyle = '#79b45f';
    b.fillRect(0, 0, WORLD_W, WORLD_H);
    b.filter = 'blur(6px)'; // painterly mottling, not hard vector blobs
    for (let i = 0; i < 90; i++) {
      b.fillStyle = i % 2 ? 'rgba(96,150,72,0.5)' : 'rgba(140,190,110,0.45)';
      const x = rng() * WORLD_W, y = rng() * WORLD_H, r = 14 + rng() * 40;
      b.beginPath(); b.ellipse(x, y, r, r * 0.6, rng() * TAU, 0, TAU); b.fill();
    }
    b.filter = 'none';
    for (let i = 0; i < 40; i++) {
      const x = rng() * WORLD_W, y = rng() * WORLD_H;
      b.fillStyle = ['#ffffff', '#ffd9ec', '#ffe9a8'][i % 3];
      for (let p = 0; p < 5; p++) {
        b.beginPath(); b.arc(x + Math.cos(p / 5 * TAU) * 4, y + Math.sin(p / 5 * TAU) * 4, 3, 0, TAU); b.fill();
      }
      b.fillStyle = '#f5a623';
      b.beginPath(); b.arc(x, y, 2.5, 0, TAU); b.fill();
    }
  } else if (style === 'flowerbed') {
    b.fillStyle = '#7a4f33';
    b.fillRect(0, 0, WORLD_W, WORLD_H);
    // soil mottling, softened
    b.filter = 'blur(5px)';
    for (let i = 0; i < 110; i++) {
      b.fillStyle = i % 2 ? 'rgba(60,36,20,0.4)' : 'rgba(150,102,64,0.35)';
      const x = rng() * WORLD_W, y = rng() * WORLD_H, r = 10 + rng() * 34;
      b.beginPath(); b.ellipse(x, y, r, r * 0.55, rng() * TAU, 0, TAU); b.fill();
    }
    b.filter = 'none';
    // fallen petals
    for (let i = 0; i < 55; i++) {
      const x = rng() * WORLD_W, y = rng() * WORLD_H;
      b.fillStyle = ['rgba(255,183,222,0.75)', 'rgba(255,244,214,0.7)', 'rgba(208,179,240,0.7)'][i % 3];
      b.save();
      b.translate(x, y);
      b.rotate(rng() * TAU);
      b.beginPath(); b.ellipse(0, 0, 7 + rng() * 5, 4, 0, 0, TAU); b.fill();
      b.restore();
    }
  } else if (style === 'night') {
    // night porch: dark indigo boards under warm lamplight
    b.fillStyle = '#262138';
    b.fillRect(0, 0, WORLD_W, WORLD_H);
    b.strokeStyle = 'rgba(10,6,22,0.55)'; // plank gaps
    b.lineWidth = 4;
    for (let y = 70; y < WORLD_H; y += 98) {
      b.beginPath(); b.moveTo(0, y); b.lineTo(WORLD_W, y); b.stroke();
    }
    b.strokeStyle = 'rgba(72,62,110,0.35)'; // moonlit wood grain
    b.lineWidth = 2;
    for (let i = 0; i < 70; i++) {
      const x = rng() * WORLD_W, y = rng() * WORLD_H, l = 30 + rng() * 80;
      b.beginPath(); b.moveTo(x, y); b.bezierCurveTo(x + l / 3, y + 3, x + l * 2 / 3, y - 3, x + l, y); b.stroke();
    }
    // plank nail heads
    b.fillStyle = 'rgba(120,110,160,0.4)';
    for (let y = 70; y < WORLD_H; y += 98) {
      for (let x = 60; x < WORLD_W; x += 180) {
        b.beginPath(); b.arc(x + (rng() - 0.5) * 30, y - 8, 2, 0, TAU); b.fill();
        b.beginPath(); b.arc(x + (rng() - 0.5) * 30, y + 8, 2, 0, TAU); b.fill();
      }
    }
  } else if (style === 'bath') {
    // bathroom tile: cool aqua squares with grout lines and a wet sheen
    b.fillStyle = '#b7dde0';
    b.fillRect(0, 0, WORLD_W, WORLD_H);
    const TS = 80;
    for (let ty = 0; ty < WORLD_H; ty += TS) {
      for (let tx = 0; tx < WORLD_W; tx += TS) {
        b.fillStyle = `rgba(255,255,255,${0.03 + rng() * 0.08})`; // per-tile glaze variation
        b.fillRect(tx + 3, ty + 3, TS - 6, TS - 6);
        b.fillStyle = 'rgba(110,160,172,0.12)'; // bottom bevel
        b.fillRect(tx + 3, ty + TS - 12, TS - 6, 9);
        if (rng() > 0.72) { // corner sheen on the glossier tiles
          b.fillStyle = 'rgba(255,255,255,0.22)';
          b.beginPath(); b.ellipse(tx + 18, ty + 16, 11, 5, -0.5, 0, TAU); b.fill();
        }
      }
    }
    b.strokeStyle = 'rgba(96,140,150,0.55)'; // grout
    b.lineWidth = 5;
    for (let x = 0; x <= WORLD_W; x += TS) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x, WORLD_H); b.stroke(); }
    for (let y = 0; y <= WORLD_H; y += TS) { b.beginPath(); b.moveTo(0, y); b.lineTo(WORLD_W, y); b.stroke(); }
  } else { // kitchen
    b.fillStyle = '#dca868';
    b.fillRect(0, 0, WORLD_W, WORLD_H);
    b.strokeStyle = 'rgba(43,26,16,0.25)';
    b.lineWidth = 4;
    for (let y = 80; y < WORLD_H; y += 106) {
      b.beginPath(); b.moveTo(0, y); b.lineTo(WORLD_W, y); b.stroke();
    }
    b.strokeStyle = 'rgba(120,72,28,0.28)';
    b.lineWidth = 2;
    for (let i = 0; i < 60; i++) {
      const x = rng() * WORLD_W, y = rng() * WORLD_H, l = 30 + rng() * 70;
      b.beginPath(); b.moveTo(x, y); b.bezierCurveTo(x + l / 3, y + 3, x + l * 2 / 3, y - 3, x + l, y); b.stroke();
    }
  }

  // trails
  const trail = style === 'kitchen'
    ? { outer: '#cbb98f', inner: '#ecdfb9', dash: '#fffbe8' }
    : style === 'flowerbed'
      ? { outer: '#a6825a', inner: '#c9a06b', dash: '#e8d9b0' }
      : style === 'night'
        ? { outer: '#453c66', inner: '#5a5080', dash: '#a89ed6' }
        : style === 'bath'
          ? { outer: '#8fb6bd', inner: '#aacfd6', dash: '#eafcff' }
          : { outer: '#8a5a33', inner: '#a9713f', dash: '#c98f57' };
  for (const path of game.paths) {
    // soft occlusion seats the trail into the ground
    b.save();
    b.shadowColor = 'rgba(43,26,16,0.5)';
    b.shadowBlur = 14;
    strokePath(b, path, trail.outer, PATH_HALF_W * 2 + 8);
    b.restore();
    // sunken bank: dark lip below-right, lit lip above-left (matches the key light)
    b.save();
    b.translate(2.5, 3.5);
    strokePath(b, path, 'rgba(43,26,16,0.22)', PATH_HALF_W * 2 + 2);
    b.restore();
    b.save();
    b.translate(-1.5, -2.5);
    strokePath(b, path, 'rgba(255,244,214,0.28)', PATH_HALF_W * 2 + 1);
    b.restore();
    strokePath(b, path, trail.inner, PATH_HALF_W * 2 - 4);
    b.setLineDash([10, 16]);
    strokePath(b, path, trail.dash, 3);
    b.setLineDash([]);
    // pheromone crumbs
    const spot = { x: 0, y: 0, angle: 0, seg: 0 };
    for (let d = 20; d < path.length; d += 34) {
      posAt(path, d, spot, spot.seg);
      b.fillStyle = 'rgba(255,244,214,0.5)';
      b.beginPath();
      b.arc(spot.x + (rng() - 0.5) * 16, spot.y + (rng() - 0.5) * 16, 1.5 + rng() * 2, 0, TAU);
      b.fill();
    }
    // packed-dirt speckle inside the trail surface
    spot.seg = 0;
    for (let d = 10; d < path.length; d += 13) {
      posAt(path, d, spot, spot.seg);
      const nx = -Math.sin(spot.angle), ny = Math.cos(spot.angle);
      const off = (rng() * 2 - 1) * (PATH_HALF_W - 7);
      b.fillStyle = rng() > 0.45 ? 'rgba(43,26,16,0.13)' : 'rgba(255,244,214,0.16)';
      b.beginPath();
      b.ellipse(spot.x + nx * off, spot.y + ny * off, 1 + rng() * 1.6, 0.8 + rng() * 1.2, rng() * TAU, 0, TAU);
      b.fill();
    }
  }

  // ---- dressing pass: fill the empty real estate ----
  const spot2 = { x: 0, y: 0, angle: 0, seg: 0 };
  for (const path of game.paths) {
    // pebbles worn into the trail edges
    spot2.seg = 0;
    for (let d = 24; d < path.length - 24; d += 46) {
      posAt(path, d, spot2, spot2.seg);
      const nx = -Math.sin(spot2.angle), ny = Math.cos(spot2.angle);
      for (const side of [-1, 1]) {
        if (rng() < 0.6) {
          const off = PATH_HALF_W + 6 + rng() * 5;
          b.fillStyle = rng() > 0.5 ? 'rgba(43,26,16,0.28)' : 'rgba(255,244,214,0.5)';
          b.beginPath();
          b.ellipse(spot2.x + nx * off * side, spot2.y + ny * off * side, 2 + rng() * 2.2, 1.5 + rng() * 1.6, rng() * TAU, 0, TAU);
          b.fill();
        }
      }
    }
  }
  if (style === 'picnic') {
    // crumb scatters, a dropped napkin, cutlery
    for (let i = 0; i < 14; i++) {
      const x = rng() * WORLD_W, y = rng() * WORLD_H;
      b.fillStyle = 'rgba(201,143,87,0.65)';
      for (let p = 0; p < 4; p++) { b.beginPath(); b.arc(x + rng() * 14, y + rng() * 10, 1.4 + rng() * 1.6, 0, TAU); b.fill(); }
    }
    b.save();
    b.translate(870, 560); b.rotate(-0.3);
    b.fillStyle = '#fffdf4'; b.strokeStyle = INK; b.lineWidth = 2.5;
    rr(b, -34, -26, 68, 52, 4); b.fill(); b.stroke();
    b.strokeStyle = 'rgba(43,26,16,0.2)'; b.lineWidth = 1.5;
    b.beginPath(); b.moveTo(-34, 0); b.lineTo(34, 0); b.stroke();
    b.restore();
    b.save();
    b.translate(60, 320); b.rotate(0.5);
    b.strokeStyle = INK; b.lineWidth = 2; b.fillStyle = '#d9d4c8';
    rr(b, -3, -34, 6, 50, 3); b.fill(); b.stroke(); // spoon handle
    b.beginPath(); b.ellipse(0, -42, 8, 11, 0, 0, TAU); b.fill(); b.stroke();
    b.restore();
  } else if (style === 'garden') {
    for (let i = 0; i < 46; i++) { // grass tufts
      const x = rng() * WORLD_W, y = rng() * WORLD_H;
      b.strokeStyle = i % 2 ? 'rgba(63,122,34,0.7)' : 'rgba(140,190,110,0.8)';
      b.lineWidth = 1.8;
      for (let bl = -1; bl <= 1; bl++) {
        b.beginPath(); b.moveTo(x + bl * 3, y);
        b.quadraticCurveTo(x + bl * 5, y - 7, x + bl * 6, y - 12 - rng() * 5);
        b.stroke();
      }
    }
  } else if (style === 'kitchen') {
    for (let i = 0; i < 3; i++) { // coffee ring stains
      const x = 150 + rng() * 660, y = 80 + rng() * 480;
      b.strokeStyle = 'rgba(107,63,24,0.18)';
      b.lineWidth = 5;
      b.beginPath(); b.arc(x, y, 34 + rng() * 14, 0, TAU); b.stroke();
    }
    for (let i = 0; i < 10; i++) { // sugar sprinkles
      const x = rng() * WORLD_W, y = rng() * WORLD_H;
      b.fillStyle = 'rgba(255,255,255,0.75)';
      for (let p = 0; p < 6; p++) b.fillRect(x + rng() * 20, y + rng() * 14, 1.8, 1.8);
    }
  } else if (style === 'flowerbed') {
    for (let i = 0; i < 22; i++) { // fallen leaves
      const x = rng() * WORLD_W, y = rng() * WORLD_H;
      b.save(); b.translate(x, y); b.rotate(rng() * TAU);
      b.fillStyle = i % 2 ? 'rgba(99,168,50,0.5)' : 'rgba(63,122,34,0.45)';
      b.beginPath(); b.ellipse(0, 0, 8, 3.6, 0, 0, TAU); b.fill();
      b.strokeStyle = 'rgba(43,26,16,0.3)'; b.lineWidth = 1;
      b.beginPath(); b.moveTo(-8, 0); b.lineTo(8, 0); b.stroke();
      b.restore();
    }
  } else if (style === 'bath') {
    for (let i = 0; i < 30; i++) { // stray water beads on the tile
      const x = rng() * WORLD_W, y = rng() * WORLD_H, r = 2 + rng() * 3.5;
      b.fillStyle = 'rgba(150,205,220,0.55)';
      b.beginPath(); b.ellipse(x, y, r, r * 0.75, rng() * TAU, 0, TAU); b.fill();
      b.fillStyle = 'rgba(255,255,255,0.65)';
      b.beginPath(); b.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, TAU); b.fill();
    }
  }
  // framed like a proper board game
  b.strokeStyle = 'rgba(43,26,16,0.35)';
  b.lineWidth = 2;
  rr(b, 16, 16, WORLD_W - 32, WORLD_H - 32, 14);
  b.stroke();

  // high-ground mounds: scarce +range real estate
  for (const md of game.map.mounds || []) {
    b.save();
    b.translate(md.x, md.y);
    b.fillStyle = 'rgba(43,26,16,0.18)';
    b.beginPath(); b.ellipse(3, 6, md.r, md.r * 0.55, 0, 0, TAU); b.fill();
    b.fillStyle = '#a97347';
    b.strokeStyle = INK;
    b.lineWidth = 3;
    b.beginPath(); b.ellipse(0, 0, md.r, md.r * 0.72, 0, 0, TAU); b.fill(); b.stroke();
    b.fillStyle = '#c98f5c';
    b.beginPath(); b.ellipse(-md.r * 0.12, -md.r * 0.16, md.r * 0.62, md.r * 0.4, 0, 0, TAU); b.fill();
    b.fillStyle = 'rgba(43,26,16,0.3)';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.7;
      b.beginPath(); b.arc(Math.cos(a) * md.r * 0.55, Math.sin(a) * md.r * 0.38, 2.2, 0, TAU); b.fill();
    }
    // upward chevron: reads as "high ground"
    b.strokeStyle = 'rgba(255,244,214,0.85)';
    b.lineWidth = 2.5;
    b.beginPath(); b.moveTo(-6, 3); b.lineTo(0, -4); b.lineTo(6, 3); b.stroke();
    b.restore();
  }

  // props cast real soft shadows
  b.save();
  b.shadowColor = 'rgba(43,26,16,0.35)';
  b.shadowBlur = 10;
  b.shadowOffsetX = 4;
  b.shadowOffsetY = 6;
  for (const bl of game.map.blockers) drawBlocker(b, bl);

  // the colony food basket at the exit of path 0
  const exitPts = game.paths[0].points;
  const [gx, gy] = exitPts[exitPts.length - 1];
  drawBasketGoal(b, Math.min(gx, WORLD_W - 44), gy, game.starRewards && game.starRewards.goldenanthill);
  b.restore();

  if (style === 'night') {
    // warm lamplight pools around every lantern + a porch-door spill — baked radial glows
    const pools = game.map.blockers.filter(bl => bl.type === 'lantern').map(bl => [bl.x, bl.y, 190]);
    pools.push([WORLD_W * 0.48, WORLD_H * 0.06, 230]); // light from the house door
    // remember the pools + pre-render one warm glow sprite: draw() re-tints every
    // entity inside a pool each frame (additive pass), at the cost of a few drawImages
    nightPools = pools;
    nightGlowSprite = document.createElement('canvas');
    nightGlowSprite.width = nightGlowSprite.height = 256;
    const ngc = nightGlowSprite.getContext('2d');
    const ng = ngc.createRadialGradient(128, 128, 8, 128, 128, 128);
    ng.addColorStop(0, 'rgba(255,186,96,0.30)');
    ng.addColorStop(0.55, 'rgba(255,168,72,0.12)');
    ng.addColorStop(1, 'rgba(255,168,72,0)');
    ngc.fillStyle = ng;
    ngc.fillRect(0, 0, 256, 256);
    for (const [px, py, pr] of pools) {
      const lg = b.createRadialGradient(px, py, 8, px, py, pr);
      lg.addColorStop(0, 'rgba(255,196,110,0.34)');
      lg.addColorStop(0.5, 'rgba(255,176,80,0.14)');
      lg.addColorStop(1, 'rgba(255,176,80,0)');
      b.fillStyle = lg;
      b.beginPath(); b.arc(px, py, pr, 0, TAU); b.fill();
    }
    // cool moonlight wash from the top edge
    const ml = b.createLinearGradient(0, 0, 0, WORLD_H);
    ml.addColorStop(0, 'rgba(150,170,255,0.08)');
    ml.addColorStop(1, 'rgba(150,170,255,0)');
    b.fillStyle = ml;
    b.fillRect(0, 0, WORLD_W, WORLD_H);
  } else {
    nightPools = null;
    nightGlowSprite = null;
    // dappled canopy shade drifting in from one corner — the "outdoors" tell
    b.save();
    b.filter = 'blur(14px)';
    b.fillStyle = 'rgba(35,50,25,0.10)';
    const dapX = WORLD_W * 0.82, dapY = WORLD_H * 0.14;
    for (let i = 0; i < 16; i++) {
      const a = rng() * TAU, d = rng() * 260;
      b.beginPath();
      b.ellipse(dapX + Math.cos(a) * d, dapY + Math.sin(a) * d * 0.7, 26 + rng() * 44, 18 + rng() * 30, rng() * TAU, 0, TAU);
      b.fill();
    }
    b.filter = 'none';
    b.restore();

    // warm key light from the top-left ties the scene together
    const kl = b.createRadialGradient(WORLD_W * 0.32, WORLD_H * 0.28, 60, WORLD_W * 0.32, WORLD_H * 0.28, WORLD_H * 1.1);
    kl.addColorStop(0, 'rgba(255,244,214,0.10)');
    kl.addColorStop(1, 'rgba(255,244,214,0)');
    b.fillStyle = kl;
    b.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  // ---- depth pass: push the baked world back so live ants & bugs read as foreground ----
  // 1) knock the ground's saturation down a notch (moving actors stay full-color and pop)
  b.save();
  b.globalCompositeOperation = 'saturation';
  b.globalAlpha = style === 'night' ? 0.10 : 0.17;
  b.fillStyle = '#808080';
  b.fillRect(0, 0, WORLD_W, WORLD_H);
  b.restore();
  // 2) warm light-pool lifts the center of the play area
  const pool = b.createRadialGradient(WORLD_W * 0.5, WORLD_H * 0.44, 40, WORLD_W * 0.5, WORLD_H * 0.48, WORLD_H * 0.78);
  pool.addColorStop(0, style === 'night' ? 'rgba(255,214,150,0.06)' : 'rgba(255,249,228,0.10)');
  pool.addColorStop(1, 'rgba(255,249,228,0)');
  b.fillStyle = pool;
  b.fillRect(0, 0, WORLD_W, WORLD_H);

  // art direction pass: vignette + film grain, baked once (tighter + deeper than a flat wash)
  const vg = b.createRadialGradient(WORLD_W / 2, WORLD_H * 0.46, WORLD_H * 0.30, WORLD_W / 2, WORLD_H * 0.5, WORLD_H * 0.95);
  vg.addColorStop(0, 'rgba(45,22,40,0)');
  vg.addColorStop(0.68, style === 'night' ? 'rgba(8,4,20,0.12)' : 'rgba(40,20,34,0.07)');
  vg.addColorStop(1, style === 'night' ? 'rgba(8,4,20,0.58)' : 'rgba(40,20,34,0.40)'); // night hugs the lamplight
  b.fillStyle = vg;
  b.fillRect(0, 0, WORLD_W, WORLD_H);
  for (let i = 0; i < 900; i++) {
    b.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.028)' : 'rgba(43,26,16,0.032)';
    b.fillRect(rng() * WORLD_W, rng() * WORLD_H, 1.6, 1.6);
  }
}

// ease-out-back: the Playful overshoot used by every spring-in
function eob(p) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

function strokePath(b, path, color, width) {
  b.strokeStyle = color;
  b.lineWidth = width;
  b.lineJoin = 'round';
  b.lineCap = 'round';
  b.beginPath();
  const pts = path.points;
  b.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) b.lineTo(pts[i][0], pts[i][1]);
  b.stroke();
}

function drawBlocker(b, bl) {
  b.save();
  b.translate(bl.x, bl.y);
  b.lineWidth = 3;
  b.strokeStyle = INK;
  if (bl.type === 'basket') {
    b.fillStyle = '#c98f3f';
    rr(b, -bl.r * 0.9, -bl.r * 0.6, bl.r * 1.8, bl.r * 1.2, 10); b.fill(); b.stroke();
    b.strokeStyle = 'rgba(43,26,16,0.45)';
    b.lineWidth = 2.5;
    for (let i = -2; i <= 2; i++) { b.beginPath(); b.moveTo(-bl.r * 0.9, i * bl.r * 0.22); b.lineTo(bl.r * 0.9, i * bl.r * 0.22); b.stroke(); }
    for (let i = -3; i <= 3; i++) { b.beginPath(); b.moveTo(i * bl.r * 0.26, -bl.r * 0.6); b.lineTo(i * bl.r * 0.26, bl.r * 0.6); b.stroke(); }
    b.strokeStyle = INK; b.lineWidth = 3;
    b.beginPath(); b.moveTo(-bl.r * 0.6, -bl.r * 0.6); b.quadraticCurveTo(0, -bl.r * 1.5, bl.r * 0.6, -bl.r * 0.6); b.stroke();
  } else if (bl.type === 'apple') {
    const ag = b.createRadialGradient(-bl.r * 0.3, -bl.r * 0.35, bl.r * 0.1, 0, 0, bl.r * 0.95);
    ag.addColorStop(0, '#ff8265');
    ag.addColorStop(0.5, '#e2472f');
    ag.addColorStop(1, '#8e2417');
    b.fillStyle = ag;
    b.beginPath(); b.arc(0, 0, bl.r * 0.85, 0, TAU); b.fill(); b.stroke();
    b.fillStyle = 'rgba(255,255,255,0.3)';
    b.beginPath(); b.arc(-bl.r * 0.3, -bl.r * 0.3, bl.r * 0.25, 0, TAU); b.fill();
    b.strokeStyle = '#5b3d1e'; b.lineWidth = 4;
    b.beginPath(); b.moveTo(0, -bl.r * 0.8); b.lineTo(4, -bl.r * 1.15); b.stroke();
    b.fillStyle = '#63a832';
    b.beginPath(); b.ellipse(10, -bl.r * 1.05, 9, 4, -0.5, 0, TAU); b.fill();
  } else if (bl.type === 'rock') {
    const rg = b.createRadialGradient(-bl.r * 0.3, -bl.r * 0.4, bl.r * 0.1, 0, 0, bl.r * 1.1);
    rg.addColorStop(0, '#c6c2b8');
    rg.addColorStop(0.55, '#a8a49a');
    rg.addColorStop(1, '#6f6b62');
    b.fillStyle = rg;
    b.beginPath();
    b.moveTo(-bl.r, bl.r * 0.4);
    b.lineTo(-bl.r * 0.6, -bl.r * 0.7); b.lineTo(bl.r * 0.2, -bl.r * 0.9);
    b.lineTo(bl.r * 0.95, -bl.r * 0.1); b.lineTo(bl.r * 0.7, bl.r * 0.55); b.closePath();
    b.fill(); b.stroke();
    b.fillStyle = 'rgba(255,255,255,0.25)';
    b.beginPath(); b.arc(-bl.r * 0.25, -bl.r * 0.35, bl.r * 0.22, 0, TAU); b.fill();
  } else if (bl.type === 'pond') {
    b.fillStyle = '#5fb7d4';
    b.beginPath(); b.ellipse(0, 0, bl.r, bl.r * 0.75, 0, 0, TAU); b.fill(); b.stroke();
    b.fillStyle = '#8fd3e8';
    b.beginPath(); b.ellipse(-bl.r * 0.2, -bl.r * 0.15, bl.r * 0.5, bl.r * 0.3, 0.2, 0, TAU); b.fill();
    b.fillStyle = '#63a832';
    b.beginPath(); b.ellipse(bl.r * 0.4, bl.r * 0.25, 10, 6, 0, 0.3, TAU); b.fill(); b.stroke();
  } else if (bl.type === 'plate') {
    b.fillStyle = '#f4f1e8';
    b.beginPath(); b.arc(0, 0, bl.r, 0, TAU); b.fill(); b.stroke();
    b.strokeStyle = 'rgba(43,26,16,0.3)'; b.lineWidth = 2.5;
    b.beginPath(); b.arc(0, 0, bl.r * 0.68, 0, TAU); b.stroke();
    b.fillStyle = '#c98f57';
    for (let i = 0; i < 5; i++) { b.beginPath(); b.arc((i - 2) * 8, (i % 2) * 8 - 4, 3, 0, TAU); b.fill(); }
  } else if (bl.type === 'flower') {
    // giant daisy: petals + honey center
    b.fillStyle = '#ffd9ec';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      b.save();
      b.translate(Math.cos(a) * bl.r * 0.55, Math.sin(a) * bl.r * 0.55);
      b.rotate(a);
      b.beginPath(); b.ellipse(0, 0, bl.r * 0.5, bl.r * 0.26, 0, 0, TAU); b.fill(); b.stroke();
      b.restore();
    }
    const fg = b.createRadialGradient(-bl.r * 0.12, -bl.r * 0.14, bl.r * 0.05, 0, 0, bl.r * 0.46);
    fg.addColorStop(0, '#ffd166');
    fg.addColorStop(0.6, '#f5a623');
    fg.addColorStop(1, '#a86e00');
    b.fillStyle = fg;
    b.beginPath(); b.arc(0, 0, bl.r * 0.42, 0, TAU); b.fill(); b.stroke();
    b.fillStyle = 'rgba(138,84,0,0.55)';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      b.beginPath(); b.arc(Math.cos(a) * bl.r * 0.2, Math.sin(a) * bl.r * 0.2, 2.5, 0, TAU); b.fill();
    }
  } else if (bl.type === 'jam') {
    // glass jam jar, half sunk in picnic shade
    const jg = b.createLinearGradient(-bl.r * 0.7, 0, bl.r * 0.7, 0);
    jg.addColorStop(0, '#c93a4e'); jg.addColorStop(0.5, '#e5556b'); jg.addColorStop(1, '#a12036');
    b.fillStyle = jg;
    rr(b, -bl.r * 0.62, -bl.r * 0.55, bl.r * 1.24, bl.r * 1.15, 10); b.fill(); b.stroke();
    b.fillStyle = 'rgba(255,255,255,0.28)'; // glass sheen
    rr(b, -bl.r * 0.48, -bl.r * 0.45, bl.r * 0.22, bl.r * 0.95, 5); b.fill();
    b.fillStyle = '#c98f3f'; // lid
    rr(b, -bl.r * 0.7, -bl.r * 0.82, bl.r * 1.4, bl.r * 0.34, 6); b.fill(); b.stroke();
    b.fillStyle = '#fffdf4'; // label
    rr(b, -bl.r * 0.4, -bl.r * 0.1, bl.r * 0.8, bl.r * 0.45, 4); b.fill(); b.stroke();
    b.strokeStyle = 'rgba(43,26,16,0.4)'; b.lineWidth = 1.5;
    b.beginPath(); b.moveTo(-bl.r * 0.25, bl.r * 0.08); b.lineTo(bl.r * 0.25, bl.r * 0.08); b.stroke();
    b.beginPath(); b.moveTo(-bl.r * 0.25, bl.r * 0.2); b.lineTo(bl.r * 0.1, bl.r * 0.2); b.stroke();
    b.strokeStyle = INK; b.lineWidth = 3;
  } else if (bl.type === 'mushroom') {
    for (const [mx, my, ms] of [[-bl.r * 0.25, 0, 1], [bl.r * 0.4, bl.r * 0.25, 0.6]]) {
      b.save();
      b.translate(mx, my);
      b.scale(ms, ms);
      b.fillStyle = '#e8dcc8'; // stem
      rr(b, -7, -6, 14, 26, 5); b.fill(); b.stroke();
      const mg = b.createRadialGradient(-8, -20, 4, 0, -14, 30);
      mg.addColorStop(0, '#ff8265'); mg.addColorStop(0.55, '#d94f35'); mg.addColorStop(1, '#8e2417');
      b.fillStyle = mg; // cap
      b.beginPath(); b.ellipse(0, -14, 26, 15, 0, Math.PI, 0); b.closePath(); b.fill(); b.stroke();
      b.fillStyle = '#fff3d6';
      for (const [dx, dy, dr] of [[-12, -18, 3.5], [4, -24, 4.5], [14, -14, 3]]) {
        b.beginPath(); b.arc(dx, dy, dr, 0, TAU); b.fill();
      }
      b.restore();
    }
  } else if (bl.type === 'pin') {
    // rolling pin at an angle
    b.save();
    b.rotate(-0.5);
    const pg = b.createLinearGradient(0, -12, 0, 12);
    pg.addColorStop(0, '#e8c187'); pg.addColorStop(0.5, '#c99a5b'); pg.addColorStop(1, '#8a5a2b');
    b.fillStyle = pg;
    rr(b, -bl.r * 0.95, -11, bl.r * 1.9, 22, 10); b.fill(); b.stroke();
    b.fillStyle = '#a9713f';
    for (const hx of [-bl.r * 1.25, bl.r * 0.95]) { rr(b, hx, -6, bl.r * 0.32, 12, 5); b.fill(); b.stroke(); }
    b.strokeStyle = 'rgba(43,26,16,0.25)'; b.lineWidth = 1.5;
    b.beginPath(); b.moveTo(-bl.r * 0.8, -4); b.lineTo(bl.r * 0.8, -4); b.stroke();
    b.beginPath(); b.moveTo(-bl.r * 0.8, 4); b.lineTo(bl.r * 0.8, 4); b.stroke();
    b.strokeStyle = INK; b.lineWidth = 3;
    b.restore();
  } else if (bl.type === 'wateringcan') {
    const wg = b.createLinearGradient(-bl.r, 0, bl.r, 0);
    wg.addColorStop(0, '#9fd3c7'); wg.addColorStop(0.5, '#5ba99a'); wg.addColorStop(1, '#2e6b5e');
    b.fillStyle = wg;
    rr(b, -bl.r * 0.55, -bl.r * 0.5, bl.r * 1.1, bl.r, 10); b.fill(); b.stroke();
    b.lineWidth = 5; b.strokeStyle = '#5ba99a';
    b.beginPath(); b.moveTo(bl.r * 0.5, -bl.r * 0.1); b.lineTo(bl.r * 1.05, -bl.r * 0.55); b.stroke(); // spout
    b.strokeStyle = INK; b.lineWidth = 2.4;
    b.beginPath(); b.moveTo(bl.r * 0.5, -bl.r * 0.1); b.lineTo(bl.r * 1.05, -bl.r * 0.55); b.stroke();
    b.fillStyle = '#5ba99a';
    b.beginPath(); b.arc(bl.r * 1.08, -bl.r * 0.58, 7, 0, TAU); b.fill(); b.stroke(); // rose
    b.beginPath(); b.arc(-bl.r * 0.1, -bl.r * 0.75, bl.r * 0.42, Math.PI * 0.95, Math.PI * 2.05); b.lineWidth = 4; b.stroke(); // handle
    b.lineWidth = 3;
    b.fillStyle = 'rgba(255,255,255,0.25)';
    rr(b, -bl.r * 0.42, -bl.r * 0.4, bl.r * 0.18, bl.r * 0.75, 4); b.fill();
  } else if (bl.type === 'lantern') {
    // glowing porch lantern: halo, metal frame, warm glass
    const halo = b.createRadialGradient(0, 0, 4, 0, 0, bl.r * 1.4);
    halo.addColorStop(0, 'rgba(255,214,120,0.55)');
    halo.addColorStop(1, 'rgba(255,214,120,0)');
    b.save();
    b.shadowColor = 'transparent'; // the light source casts no shadow of its own glow
    b.fillStyle = halo;
    b.beginPath(); b.arc(0, 0, bl.r * 1.4, 0, TAU); b.fill();
    b.restore();
    b.fillStyle = '#3c3549'; // base plate
    rr(b, -bl.r * 0.5, bl.r * 0.5, bl.r, bl.r * 0.24, 4); b.fill(); b.stroke();
    const gg = b.createLinearGradient(0, -bl.r * 0.6, 0, bl.r * 0.5);
    gg.addColorStop(0, '#ffe9a8'); gg.addColorStop(0.5, '#ffc46e'); gg.addColorStop(1, '#e2903a');
    b.fillStyle = gg; // glass body
    rr(b, -bl.r * 0.38, -bl.r * 0.6, bl.r * 0.76, bl.r * 1.1, 6); b.fill(); b.stroke();
    b.strokeStyle = 'rgba(43,26,16,0.6)'; // frame bars
    b.lineWidth = 2.5;
    b.beginPath(); b.moveTo(-bl.r * 0.13, -bl.r * 0.6); b.lineTo(-bl.r * 0.13, bl.r * 0.5); b.stroke();
    b.beginPath(); b.moveTo(bl.r * 0.13, -bl.r * 0.6); b.lineTo(bl.r * 0.13, bl.r * 0.5); b.stroke();
    b.strokeStyle = INK; b.lineWidth = 3;
    b.fillStyle = '#3c3549'; // cap + ring handle
    rr(b, -bl.r * 0.46, -bl.r * 0.82, bl.r * 0.92, bl.r * 0.26, 5); b.fill(); b.stroke();
    b.beginPath(); b.arc(0, -bl.r * 0.98, bl.r * 0.18, 0, TAU); b.stroke();
    b.fillStyle = 'rgba(255,255,255,0.75)'; // flame heart
    b.beginPath(); b.ellipse(0, -bl.r * 0.05, bl.r * 0.1, bl.r * 0.18, 0, 0, TAU); b.fill();
  } else if (bl.type === 'flowerpot') {
    // terracotta pot with a night succulent
    const tg = b.createLinearGradient(-bl.r * 0.7, 0, bl.r * 0.7, 0);
    tg.addColorStop(0, '#d07a4a'); tg.addColorStop(0.5, '#b05e33'); tg.addColorStop(1, '#7a3c1c');
    b.fillStyle = tg;
    b.beginPath(); // tapered pot body
    b.moveTo(-bl.r * 0.62, -bl.r * 0.2); b.lineTo(bl.r * 0.62, -bl.r * 0.2);
    b.lineTo(bl.r * 0.45, bl.r * 0.75); b.lineTo(-bl.r * 0.45, bl.r * 0.75);
    b.closePath(); b.fill(); b.stroke();
    b.fillStyle = '#c96e40'; // rim
    rr(b, -bl.r * 0.72, -bl.r * 0.45, bl.r * 1.44, bl.r * 0.3, 5); b.fill(); b.stroke();
    b.fillStyle = 'rgba(255,255,255,0.18)'; // sheen
    b.beginPath(); b.moveTo(-bl.r * 0.45, -bl.r * 0.15); b.lineTo(-bl.r * 0.28, -bl.r * 0.15);
    b.lineTo(-bl.r * 0.2, bl.r * 0.7); b.lineTo(-bl.r * 0.34, bl.r * 0.7); b.closePath(); b.fill();
    b.fillStyle = '#3f7a4a'; // spiky leaves
    b.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      b.beginPath();
      b.moveTo(i * 6, -bl.r * 0.4);
      b.quadraticCurveTo(i * 13, -bl.r * 0.85, i * 9, -bl.r * 1.05);
      b.quadraticCurveTo(i * 5.5, -bl.r * 0.8, i * 2, -bl.r * 0.42);
      b.closePath(); b.fill(); b.stroke();
    }
    b.lineWidth = 3;
  } else if (bl.type === 'mothswarm') {
    // a decal of moths mobbing a dust of wing-scale motes
    b.fillStyle = 'rgba(200,190,230,0.16)';
    b.beginPath(); b.arc(0, 0, bl.r, 0, TAU); b.fill();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.4, d = bl.r * (0.25 + (i % 3) * 0.22);
      b.save();
      b.translate(Math.cos(a) * d, Math.sin(a) * d);
      b.rotate(a + 0.8);
      b.fillStyle = i % 2 ? 'rgba(228,200,240,0.85)' : 'rgba(205,180,220,0.75)';
      b.lineWidth = 1.6;
      b.beginPath(); b.ellipse(-3.5, 0, 4.5, 2.6, 0.5, 0, TAU); b.fill(); b.stroke();
      b.beginPath(); b.ellipse(3.5, 0, 4.5, 2.6, -0.5, 0, TAU); b.fill(); b.stroke();
      b.fillStyle = 'rgba(60,50,80,0.9)';
      b.beginPath(); b.ellipse(0, 0, 1.3, 3.2, 0, 0, TAU); b.fill();
      b.restore();
    }
    b.fillStyle = 'rgba(255,244,214,0.5)'; // wing-scale motes
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 1.1;
      b.beginPath(); b.arc(Math.cos(a) * bl.r * 0.8, Math.sin(a) * bl.r * 0.75, 1.4, 0, TAU); b.fill();
    }
    b.lineWidth = 3;
  } else if (bl.type === 'tub') {
    // porcelain bathtub seen from above: rim, water, foam
    b.fillStyle = '#f4f6f2'; // rim
    b.beginPath(); b.ellipse(0, 0, bl.r, bl.r * 0.78, 0, 0, TAU); b.fill(); b.stroke();
    const wg = b.createRadialGradient(-bl.r * 0.2, -bl.r * 0.15, bl.r * 0.1, 0, 0, bl.r * 0.75);
    wg.addColorStop(0, '#9fd8e8'); wg.addColorStop(1, '#5fa8c4');
    b.fillStyle = wg; // bathwater
    b.beginPath(); b.ellipse(0, 0, bl.r * 0.78, bl.r * 0.58, 0, 0, TAU); b.fill(); b.stroke();
    b.strokeStyle = 'rgba(255,255,255,0.5)'; b.lineWidth = 2; // ripple rings
    b.beginPath(); b.ellipse(-bl.r * 0.1, -bl.r * 0.05, bl.r * 0.42, bl.r * 0.28, 0.2, 0, TAU); b.stroke();
    b.fillStyle = 'rgba(255,255,255,0.85)'; // foam clumps at the edge
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.5;
      b.beginPath(); b.arc(Math.cos(a) * bl.r * 0.68, Math.sin(a) * bl.r * 0.5, 4 + (i % 3) * 2, 0, TAU); b.fill();
    }
    b.strokeStyle = INK; b.lineWidth = 3;
    b.fillStyle = '#cfd6d8'; // chrome drain plug
    b.beginPath(); b.arc(bl.r * 0.3, bl.r * 0.15, 6, 0, TAU); b.fill(); b.stroke();
  } else if (bl.type === 'duck') {
    // the rubber duck presides over bath time
    b.fillStyle = '#ffd23f';
    b.beginPath(); b.ellipse(2, 3, bl.r * 0.85, bl.r * 0.62, 0, 0, TAU); b.fill(); b.stroke(); // body
    b.beginPath(); b.arc(-bl.r * 0.55, -bl.r * 0.45, bl.r * 0.45, 0, TAU); b.fill(); b.stroke(); // head
    b.fillStyle = '#ffe9a8'; // wing
    b.beginPath(); b.ellipse(6, 2, bl.r * 0.4, bl.r * 0.26, 0.3, 0, TAU); b.fill(); b.stroke();
    b.fillStyle = '#f2913a'; // beak
    b.beginPath(); b.ellipse(-bl.r * 0.95, -bl.r * 0.4, bl.r * 0.24, bl.r * 0.13, -0.15, 0, TAU); b.fill(); b.stroke();
    b.fillStyle = INK;
    b.beginPath(); b.arc(-bl.r * 0.62, -bl.r * 0.58, 2.2, 0, TAU); b.fill(); // eye
    b.fillStyle = 'rgba(255,255,255,0.5)';
    b.beginPath(); b.arc(-bl.r * 0.4, -bl.r * 0.62, bl.r * 0.14, 0, TAU); b.fill(); // rubber sheen
  } else if (bl.type === 'puddle') {
    // splashed bathwater — flat, glassy, no-build
    b.fillStyle = 'rgba(140,200,220,0.75)';
    b.beginPath();
    b.moveTo(-bl.r, 0);
    b.bezierCurveTo(-bl.r * 0.9, -bl.r * 0.8, bl.r * 0.4, -bl.r * 0.85, bl.r * 0.9, -bl.r * 0.25);
    b.bezierCurveTo(bl.r * 1.05, bl.r * 0.4, bl.r * 0.2, bl.r * 0.8, -bl.r * 0.4, bl.r * 0.7);
    b.bezierCurveTo(-bl.r * 0.95, bl.r * 0.55, -bl.r * 1.05, bl.r * 0.25, -bl.r, 0);
    b.closePath(); b.fill(); b.stroke();
    b.fillStyle = 'rgba(255,255,255,0.45)'; // sky sheen
    b.beginPath(); b.ellipse(-bl.r * 0.25, -bl.r * 0.25, bl.r * 0.4, bl.r * 0.18, -0.3, 0, TAU); b.fill();
    b.fillStyle = 'rgba(255,255,255,0.8)';
    for (const [dx, dy] of [[bl.r * 0.5, bl.r * 0.35], [-bl.r * 0.55, bl.r * 0.3]]) {
      b.beginPath(); b.arc(dx, dy, 2.5, 0, TAU); b.fill(); // splash beads
    }
  } else if (bl.type === 'soap') {
    // a dropped bar of soap in a slick of suds
    b.fillStyle = 'rgba(255,255,255,0.4)'; // suds slick
    b.beginPath(); b.ellipse(0, bl.r * 0.25, bl.r * 1.05, bl.r * 0.5, 0.1, 0, TAU); b.fill();
    b.save();
    b.rotate(-0.35);
    const sg = b.createLinearGradient(0, -bl.r * 0.4, 0, bl.r * 0.4);
    sg.addColorStop(0, '#ffd9ec'); sg.addColorStop(1, '#e89cc0');
    b.fillStyle = sg;
    rr(b, -bl.r * 0.8, -bl.r * 0.42, bl.r * 1.6, bl.r * 0.84, bl.r * 0.3); b.fill(); b.stroke();
    b.fillStyle = 'rgba(255,255,255,0.55)';
    rr(b, -bl.r * 0.55, -bl.r * 0.28, bl.r * 0.5, bl.r * 0.2, 4); b.fill(); // sheen
    b.restore();
    b.fillStyle = 'rgba(255,255,255,0.9)'; // bubbles drifting off
    for (const [dx, dy, r2] of [[bl.r * 0.7, -bl.r * 0.6, 4], [bl.r * 0.95, -bl.r * 0.3, 2.6], [-bl.r * 0.8, -bl.r * 0.55, 3]]) {
      b.beginPath(); b.arc(dx, dy, r2, 0, TAU); b.fill(); b.stroke();
    }
  } else if (bl.type === 'mug') {
    b.fillStyle = '#e2472f';
    b.beginPath(); b.arc(0, 0, bl.r * 0.85, 0, TAU); b.fill(); b.stroke();
    b.beginPath(); b.arc(bl.r * 0.95, 0, bl.r * 0.35, -1.2, 1.2); b.lineWidth = 6; b.strokeStyle = '#e2472f'; b.stroke();
    b.lineWidth = 3; b.strokeStyle = INK;
    b.beginPath(); b.arc(bl.r * 0.95, 0, bl.r * 0.35, -1.3, 1.3); b.stroke();
    b.fillStyle = '#6b3f18';
    b.beginPath(); b.arc(0, 0, bl.r * 0.62, 0, TAU); b.fill(); b.stroke();
  }
  b.restore();
}

function drawBasketGoal(b, x, y, flag = false) {
  b.save();
  b.translate(x, y);
  b.lineWidth = 3.5;
  b.strokeStyle = INK;
  if (flag) { // Golden Anthill (⭐12): the colony flies its colors (pennant leans left — exits hug the right edge)
    b.strokeStyle = '#8a5a33';
    b.lineWidth = 3;
    b.beginPath(); b.moveTo(-30, 20); b.lineTo(-38, -34); b.stroke();
    b.fillStyle = '#ffd166';
    b.strokeStyle = INK;
    b.lineWidth = 2;
    b.beginPath(); b.moveTo(-38, -34); b.lineTo(-62, -27); b.lineTo(-39, -20); b.closePath();
    b.fill(); b.stroke();
    b.lineWidth = 3.5;
  }
  // sugar pile
  b.fillStyle = '#fff';
  b.beginPath(); b.moveTo(-46, 26); b.quadraticCurveTo(0, -20, 46, 26); b.closePath(); b.fill(); b.stroke();
  b.fillStyle = '#ffe9a8';
  b.beginPath(); b.moveTo(-30, 26); b.quadraticCurveTo(0, -2, 30, 26); b.closePath(); b.fill();
  // basket
  b.fillStyle = '#c98f3f';
  rr(b, -40, 18, 80, 30, 8); b.fill(); b.stroke();
  b.strokeStyle = 'rgba(43,26,16,0.4)'; b.lineWidth = 2;
  for (let i = -3; i <= 3; i++) { b.beginPath(); b.moveTo(i * 11, 18); b.lineTo(i * 11, 48); b.stroke(); }
  b.restore();
}

// ---------- enemies ----------


export function drawEnemy(game, e, time) {
  const t = e.type;
  e.slowT_active = game.time < e.slowUntilT;
  e.burn_active = e.burnDps > 0 && game.time < e.burnUntilT;
  e.stun_active = game.time < e.stunUntilT || game.time < e.snareUntilT;

  if (t.segmented) {
    // caterpillar: a bristled, toxic blimp — trailing segments along the trail
    const path = game.paths[e.pathIdx];
    const spot = { x: 0, y: 0, angle: 0, seg: 0 };
    const { fill, dark } = bodyColors(e);
    const gap = t.radius * 0.92;
    const toxic = e.camo ? fill : '#b6d94a';   // sickly highlight tone
    for (let i = 6; i >= 1; i--) {
      const d = Math.max(0, e.dist - i * gap);
      posAt(path, d, spot, 0);
      const sr = t.radius * (1 - i * 0.075);
      ctx.save();
      ctx.translate(spot.x, spot.y);
      ctx.fillStyle = 'rgba(43,26,16,0.2)';
      ctx.beginPath(); ctx.ellipse(3, sr * 0.55 + 4, sr * 1.1, sr * 0.42, 0, 0, TAU); ctx.fill();
      // bristles: dark hairs fan out from each segment
      ctx.strokeStyle = 'rgba(30,45,12,0.9)';
      ctx.lineWidth = 2;
      for (let h = 0; h < 5; h++) {
        const a = -1.9 - h * 0.35 - (i % 2) * 0.17;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * sr * 0.7, Math.sin(a) * sr * 0.7);
        ctx.lineTo(Math.cos(a) * (sr + 6), Math.sin(a) * (sr + 6));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(Math.cos(-a) * sr * 0.7, Math.sin(-a) * sr * 0.7);
        ctx.lineTo(Math.cos(-a) * (sr + 6), Math.sin(-a) * (sr + 6));
        ctx.stroke();
      }
      ctx.fillStyle = bodyGrad(ctx, i % 2 ? fill : mixHex(dark, '#0b1a04', 0.3), mixHex(dark, '#0a1503', 0.4), sr);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.arc(0, 0, sr, 0, TAU); ctx.fill(); ctx.stroke();
      // toxic spots + wet highlight
      ctx.fillStyle = i % 2 ? 'rgba(40,60,15,0.55)' : toxic;
      ctx.beginPath(); ctx.arc(0, sr * 0.15, sr * 0.28, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath(); ctx.ellipse(-sr * 0.32, -sr * 0.42, sr * 0.26, sr * 0.15, -0.4, 0, TAU); ctx.fill();
      // stubby clawed feet
      ctx.strokeStyle = INK; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(-4, sr); ctx.lineTo(-4, sr + 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5, sr); ctx.lineTo(5, sr + 6); ctx.stroke();
      ctx.restore();
    }
  }

  // grounding shadow (flyers cast theirs far below) — darker + wider than a floating sticker,
  // one ellipse to keep swarms cheap
  const alt = t.flying ? 14 + Math.sin(time * 5 + e.phase) * 2 : 0;
  ctx.fillStyle = t.flying ? 'rgba(43,26,16,0.14)' : 'rgba(43,26,16,0.24)';
  ctx.beginPath();
  ctx.ellipse(e.x + 3, e.y + t.radius * 0.55 + 4 + alt, t.radius * (t.flying ? 0.9 : 1.3), t.radius * 0.42, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(e.x, e.y - (t.flying ? alt * 0.5 : 0));
  if (e.camo) ctx.globalAlpha = 0.88;
  // charger telegraph: the beetle digs in and trembles just before the burst
  const chargeTele = t.charge && e.chargingT <= 0 && e.chargeT > t.charge.every - 0.45;
  const charging = t.charge && e.chargingT > 0;
  if (charging) {
    // motion streaks trail behind the burst
    ctx.strokeStyle = 'rgba(255,209,102,0.5)';
    ctx.lineWidth = 2.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-Math.cos(e.angle) * (t.radius + 6) - Math.sin(e.angle) * i * t.radius * 0.5,
                 -Math.sin(e.angle) * (t.radius + 6) + Math.cos(e.angle) * i * t.radius * 0.5);
      ctx.lineTo(-Math.cos(e.angle) * (t.radius + 20) - Math.sin(e.angle) * i * t.radius * 0.5,
                 -Math.sin(e.angle) * (t.radius + 20) + Math.cos(e.angle) * i * t.radius * 0.5);
      ctx.stroke();
    }
  }
  ctx.save();
  ctx.rotate(e.angle);
  if (chargeTele) { // distance-independent tremble is fine: the body shakes in place
    ctx.translate((Math.random() - 0.5) * 2.6, (Math.random() - 0.5) * 2.6);
  }
  // gait life: lateral sway + body roll, phased by distance walked
  if (!t.flying && !t.segmented) {
    ctx.translate(0, Math.sin(e.dist * 0.14 + e.phase) * 1.1);
    ctx.rotate(Math.sin(e.dist * 0.07 + e.phase) * 0.05);
  }
  // spring-in on spawn/reveal + squash on hit
  const hk = e.hitT > 0 ? e.hitT / 0.15 : 0;
  const spring = e.spawnT > 0 ? 0.55 + 0.45 * eob(1 - e.spawnT / 0.25) : 1;
  ctx.scale(spring * (1 + 0.2 * hk), spring * (1 - 0.16 * hk));
  if (t.shell) drawSnailShell(ctx, e);
  drawBugBody(ctx, e, time);
  // white hit flash
  if (hk > 0) {
    ctx.save();
    ctx.globalAlpha = 0.55 * hk;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, 0, t.radius * 1.25 + 2, t.radius * 0.92 + 2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // charge telegraph: gold warning tint pulses over the trembling shell
  if (chargeTele) {
    ctx.save();
    ctx.globalAlpha = 0.28 + 0.18 * Math.sin(time * 30);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.ellipse(0, 0, t.radius * 1.25 + 2, t.radius * 0.92 + 2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  drawStatusFx(ctx, e, time);

  // rage shield: golden ring while the queen is damage-immune
  if (e.shieldT > 0) {
    const k = Math.min(1, e.shieldT / 1.5);
    ctx.strokeStyle = `rgba(255,209,102,${0.45 + 0.4 * Math.sin(time * 14)})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, t.radius + 8 + Math.sin(time * 9) * 2, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * k})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, t.radius + 12, 0, TAU); ctx.stroke();
  }

  // regen heart
  if (e.regenTop >= 0) {
    const pulse = 1 + Math.sin(time * 6 + e.phase) * 0.15 + (e.regenFlash > 0 ? 0.5 : 0);
    ctx.fillStyle = '#ff7fb8';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.save();
    ctx.translate(0, -t.radius - 12);
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-6, -3, -3, -7, 0, -3.5);
    ctx.bezierCurveTo(3, -7, 6, -3, 0, 3);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  if (t.hpBar) {
    drawHpBar(ctx, 0, -t.radius - (e.regenTop >= 0 ? 26 : 18), t.radius * 2.4, e.hp / e.maxHp);
  }
  ctx.restore();
}

// ---------- ant towers ----------

// ---------- projectiles ----------

function drawProjectile(p, time) {
  // ribbon trail (world space, before the head)
  if ((p.kind === 'pellet' || p.kind === 'silk') && p.h) {
    ctx.strokeStyle = p.kind === 'silk' ? 'rgba(238,246,244,0.4)' : 'rgba(155,227,74,0.4)';
    ctx.lineWidth = 3.2 * p.scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.h[4], p.h[5]);
    ctx.lineTo(p.h[2], p.h[3]);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.strokeStyle = INK;
  if (p.kind === 'pellet') {
    ctx.fillStyle = p.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 4.5 * p.scale, 0, TAU); ctx.fill(); ctx.stroke();
  } else if (p.kind === 'silk') {
    ctx.fillStyle = '#eef6f4';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(238,246,244,0.7)';
    for (let i = 0; i < 4; i++) {
      const a = time * 10 + i * TAU / 4;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 6, Math.sin(a) * 6, 2, 0, TAU); ctx.fill();
    }
  } else if (p.kind === 'bomb') {
    // ground shadow
    ctx.fillStyle = 'rgba(43,26,16,0.25)';
    const k = Math.min(1, p.t / p.dur);
    const h = Math.sin(k * Math.PI) * 46;
    ctx.beginPath(); ctx.ellipse(0, h, 6, 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2c20';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffb020';
    ctx.beginPath(); ctx.arc(3, -6, 2.4 + Math.sin(time * 30) * 1, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------- ambient wildlife (pure presentation, never touches the sim) ----------
const critters = [];
let critterT = 3;

function updateCritters(game, time, rdt) {
  critterT -= rdt;
  const bg = game.map.bg;
  // fireflies are a standing population, not passers-by (night porch only)
  if (bg === 'night') {
    let flies = 0;
    for (const cr of critters) if (cr.kind === 'firefly') flies++;
    if (flies < 4 && critterT <= 0) {
      critterT = 2 + Math.random() * 3;
      critters.push({
        kind: 'firefly',
        x: 80 + Math.random() * (WORLD_W - 160),
        y: 60 + Math.random() * (WORLD_H - 120),
        drift: Math.random() * TAU,
        age: 0, life: 18 + Math.random() * 14, phase: Math.random() * 10,
      });
    }
  }
  if (critters.length < 2 && critterT <= 0) {
    critterT = 7 + Math.random() * 9;
    if (bg === 'night') {
      // handled above — fireflies own the night
    } else if (bg === 'kitchen') {
      const mug = game.map.blockers.find(bl => bl.type === 'mug');
      if (mug) critters.push({ kind: 'steam', x: mug.x, y: mug.y - 20, age: 0, life: 4, phase: Math.random() * 10 });
    } else if (bg === 'bath') {
      // soap bubbles drift up from the tub
      const tub = game.map.blockers.find(bl => bl.type === 'tub');
      critters.push({
        kind: 'bubble',
        x: tub ? tub.x + (Math.random() - 0.5) * 100 : 200 + Math.random() * 500,
        y: tub ? tub.y : WORLD_H - 40,
        vy: -16 - Math.random() * 12,
        drift: Math.random() * TAU,
        age: 0, life: 24, phase: Math.random() * 10,
      });
    } else {
      const kind = bg === 'picnic' ? 'ladybug' : 'butterfly';
      const fromLeft = Math.random() > 0.5;
      critters.push({
        kind,
        x: fromLeft ? -30 : WORLD_W + 30,
        y: 80 + Math.random() * (WORLD_H - 160),
        vx: (fromLeft ? 1 : -1) * (kind === 'ladybug' ? 26 : 46),
        drift: Math.random() * TAU,
        age: 0, life: 60, phase: Math.random() * 10,
      });
    }
  }
  for (const cr of critters) {
    cr.age += rdt;
    if (cr.kind === 'steam') continue;
    if (cr.kind === 'bubble') {
      cr.y += cr.vy * rdt;
      cr.x += Math.sin(cr.age * 1.6 + cr.drift) * 14 * rdt;
      if (cr.y < -30) cr.age = cr.life + 1;
      continue;
    }
    if (cr.kind === 'firefly') {
      // slow wandering figure-eights, each fly on its own phase
      cr.x += Math.cos(cr.age * 0.7 + cr.drift) * 22 * rdt;
      cr.y += Math.sin(cr.age * 1.1 + cr.drift * 2) * 16 * rdt;
      continue;
    }
    cr.x += cr.vx * rdt;
    if (cr.kind === 'butterfly') cr.y += Math.sin(cr.age * 2.4 + cr.drift) * 26 * rdt;
    if (cr.x < -60 || cr.x > WORLD_W + 60) cr.age = cr.life + 1;
  }
  for (let i = critters.length - 1; i >= 0; i--) {
    if (critters[i].age > critters[i].life) critters.splice(i, 1);
  }
}

function drawCritters(time) {
  for (const cr of critters) {
    ctx.save();
    if (cr.kind === 'steam') {
      for (let i = 0; i < 3; i++) {
        const p = (cr.age * 0.5 + i * 0.33) % 1;
        ctx.globalAlpha = 0.2 * (1 - p);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cr.x + Math.sin((p * 5) + cr.phase + i) * 7, cr.y - p * 46, 4 + p * 7, 0, TAU);
        ctx.fill();
      }
    } else if (cr.kind === 'firefly') {
      // blink cycle: mostly dark, periodic warm pulse (fade in/out at spawn/despawn)
      const lifeK = Math.min(1, cr.age / 2, (cr.life - cr.age) / 2);
      const blink = Math.max(0, Math.sin(time * 1.7 + cr.phase)) ** 3;
      const a = Math.max(0, lifeK) * (0.15 + 0.85 * blink);
      if (a > 0.02) {
        const gl = ctx.createRadialGradient(cr.x, cr.y, 0.5, cr.x, cr.y, 9);
        gl.addColorStop(0, `rgba(214,255,140,${0.85 * a})`);
        gl.addColorStop(1, 'rgba(214,255,140,0)');
        ctx.fillStyle = gl;
        ctx.beginPath(); ctx.arc(cr.x, cr.y, 9, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(255,255,220,${a})`;
        ctx.beginPath(); ctx.arc(cr.x, cr.y, 1.5, 0, TAU); ctx.fill();
      }
    } else if (cr.kind === 'bubble') {
      const lifeK = Math.min(1, cr.age / 1.5, Math.max(0, (cr.life - cr.age) / 1.5));
      const r = 5 + Math.sin(cr.phase) * 1.5;
      ctx.globalAlpha = 0.7 * Math.max(0, lifeK);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(cr.x, cr.y, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(180,225,255,0.6)'; // iridescent rim
      ctx.beginPath(); ctx.arc(cr.x, cr.y, r - 1.3, 0.6, 2.4); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(cr.x - r * 0.35, cr.y - r * 0.35, 1.3, 0, TAU); ctx.fill();
    } else if (cr.kind === 'ladybug') {
      ctx.translate(cr.x, cr.y);
      ctx.rotate(cr.vx > 0 ? 0 : Math.PI);
      ctx.fillStyle = 'rgba(43,26,16,0.14)';
      ctx.beginPath(); ctx.ellipse(1, 5, 7, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = bodyGrad(ctx, '#e2472f', '#8e2417', 6);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.ellipse(0, 0, 7, 5.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(6, 0, 2.6, 0, TAU); ctx.fill();
      for (const [dx, dy] of [[-3, -2], [0, 2], [-4, 2], [2, -2]]) {
        ctx.beginPath(); ctx.arc(dx, dy, 1.1, 0, TAU); ctx.fill();
      }
    } else { // butterfly, above everything
      ctx.translate(cr.x, cr.y);
      const flap = Math.sin(time * 16 + cr.phase) * 0.7;
      ctx.fillStyle = 'rgba(43,26,16,0.10)';
      ctx.beginPath(); ctx.ellipse(2, 16, 8, 3, 0, 0, TAU); ctx.fill();
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.rotate(side * (0.5 + flap));
        ctx.fillStyle = side > 0 ? '#ffd9ec' : '#ffb7de';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(side * 6, -2, 7.5, 5, side * 0.5, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(0, 0, 1.6, 5, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ---------- main draw ----------

// polished range/reticle indicator: soft filled disc + crisp inner ring + rotating dashed rim
function rangeRing(x, y, r, rgb, time) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, Math.max(1, r * 0.5), x, y, r);
  g.addColorStop(0, `rgba(${rgb},0.03)`);
  g.addColorStop(0.82, `rgba(${rgb},0.10)`);
  g.addColorStop(1, `rgba(${rgb},0.22)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(${rgb},0.35)`;
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(x, y, r - 1.6, 0, TAU); ctx.stroke();
  ctx.strokeStyle = `rgba(${rgb},0.95)`;
  ctx.lineWidth = 2.6;
  ctx.setLineDash([11, 7]);
  ctx.lineDashOffset = -time * 20;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function draw(game, ui, time) {
  if (!ctx) return;
  const rdt = Math.min(0.1, time - lastDrawTime);
  lastDrawTime = time;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); // world units on a retina backing store
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);
  ctx.save();
  if (game && game.shake > 0) {
    ctx.translate((Math.random() - 0.5) * game.shake * 14, (Math.random() - 0.5) * game.shake * 14);
  }
  if (game) ctx.translate(game.kickX || 0, game.kickY || 0);
  if (bake) ctx.drawImage(bake, 0, 0, WORLD_W, WORLD_H);
  if (!game) { ctx.restore(); return; }

  // battlefield scars, gently healing over time
  if (decals) {
    ctx.drawImage(decals, 0, 0, WORLD_W, WORLD_H);
    decalFadeT += rdt;
    if (decalFadeT > 0.45) {
      decalFadeT = 0;
      decalCtx.globalCompositeOperation = 'destination-out';
      decalCtx.fillStyle = 'rgba(0,0,0,0.05)';
      decalCtx.fillRect(0, 0, WORLD_W, WORLD_H);
      decalCtx.globalCompositeOperation = 'source-over';
    }
  }

  // living map details
  if (game.map.bg === 'garden') {
    const pond = game.map.blockers.find(bl => bl.type === 'pond');
    if (pond) {
      for (let i = 0; i < 2; i++) {
        const p = ((time * 0.3) + i * 0.5) % 1;
        const rr = pond.r * 0.22 + p * pond.r * 0.6;
        ctx.strokeStyle = `rgba(255,255,255,${0.28 * (1 - p)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(pond.x - pond.r * 0.2, pond.y - pond.r * 0.15, rr, rr * 0.6, 0.2, 0, TAU);
        ctx.stroke();
      }
    }
  }
  { // sugar pile twinkles at the basket
    const pts = game.paths[0].points;
    const gx = Math.min(pts[pts.length - 1][0], WORLD_W - 44);
    const gy = pts[pts.length - 1][1];
    const tw = (time * 0.45) % 1;
    if (tw < 0.16) {
      const k = Math.sin((tw / 0.16) * Math.PI);
      const sx = gx - 14 + ((time | 0) * 37) % 28;
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * k})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx - 4, gy + 6); ctx.lineTo(sx + 4, gy + 6);
      ctx.moveTo(sx, gy + 2); ctx.lineTo(sx, gy + 10);
      ctx.stroke();
    }
  }

  // pheromone stream: dots flow along the trail toward the basket
  {
    const spot = { x: 0, y: 0, angle: 0, seg: 0 };
    const SP = 64;
    const off = (time * 52) % SP;
    ctx.fillStyle = 'rgba(255,248,220,0.5)';
    for (const path of game.paths) {
      spot.seg = 0;
      for (let d = off; d < path.length; d += SP) {
        posAt(path, d, spot, spot.seg);
        const tw = 0.5 + 0.5 * Math.sin(time * 3 + d * 0.05);
        ctx.beginPath();
        ctx.arc(spot.x, spot.y, 1.7 + tw * 1.3, 0, TAU);
        ctx.fill();
      }
    }
  }

  // beacon scent rings (under everything else)
  for (const t of game.towers) {
    if (t.typeId !== 'beacon') continue;
    const r = t.stats.range;
    ctx.strokeStyle = 'rgba(99,200,240,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, TAU); ctx.stroke();
    const pk = (time * 0.45 + t.bob) % 1;
    ctx.strokeStyle = `rgba(99,200,240,${0.3 * (1 - pk)})`;
    ctx.beginPath(); ctx.arc(t.x, t.y, r * pk, 0, TAU); ctx.stroke();
  }

  // army-ant ambush piles (under the bugs)
  for (const tr of game.traps) {
    if (tr.dead) continue;
    const n = Math.max(3, Math.min(7, Math.ceil(tr.charges / 3) + 2));
    ctx.strokeStyle = INK;
    for (let i = 0; i < n; i++) {
      const a = tr.phase + (i / n) * TAU;
      const px = tr.x + Math.cos(a) * tr.r * 0.45;
      const py = tr.y + Math.sin(a) * tr.r * 0.45 + Math.sin(time * 8 + tr.phase + i) * 1.2;
      ctx.fillStyle = '#7a2d1c';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(px, py, 4.5, 3.2, a, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(px + Math.cos(a) * 4.5, py + Math.sin(a) * 4.5, 2, 0, TAU);
      ctx.fillStyle = '#3d130a'; ctx.fill();
    }
    ctx.strokeStyle = 'rgba(122,45,28,0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }

  // sugar-cube decoys (under the bugs): white crystal cube, sparkle, faint eat-radius
  for (const dc of game.decoys) {
    if (dc.dead) continue;
    const k = 0.55 + 0.45 * (dc.bites / 25); // the cube shrinks as it's eaten
    const s = 11 * k;
    const eating = dc.eaters > 0;
    // eat-radius ring: players see the stall zone; it pulses while diners are on it
    ctx.strokeStyle = `rgba(255,255,255,${eating ? 0.3 + 0.12 * Math.sin(time * 9 + dc.phase) : 0.16})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 7]);
    ctx.beginPath(); ctx.arc(dc.x, dc.y, 70, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.translate(dc.x, dc.y);
    // ground shadow
    ctx.fillStyle = 'rgba(43,26,16,0.22)';
    ctx.beginPath(); ctx.ellipse(1, s * 0.75, s * 1.25, s * 0.45, 0, 0, TAU); ctx.fill();
    const wob = eating ? Math.sin(time * 22 + dc.phase) * 1.1 : 0; // nibbled cubes judder
    ctx.translate(wob, 0);
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    const d = s * 0.55; // isometric depth
    // top face
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.4); ctx.lineTo(-s + d, -s * 0.4 - d); ctx.lineTo(s + d, -s * 0.4 - d); ctx.lineTo(s, -s * 0.4);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // right face
    ctx.fillStyle = '#dfe6f0';
    ctx.beginPath();
    ctx.moveTo(s, -s * 0.4); ctx.lineTo(s + d, -s * 0.4 - d); ctx.lineTo(s + d, s * 0.6 - d); ctx.lineTo(s, s * 0.6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // front face with a hint of crystal grain
    ctx.fillStyle = '#fbfbff';
    ctx.beginPath(); ctx.rect(-s, -s * 0.4, s * 2, s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(160,190,220,0.35)';
    ctx.fillRect(-s * 0.55, -s * 0.1, s * 0.42, s * 0.42);
    ctx.fillRect(s * 0.15, -s * 0.28, s * 0.34, s * 0.34);
    // sparkle: a twinkling 4-point star off the top corner
    const twk = (time * 1.3 + dc.phase) % 1;
    if (twk < 0.35) {
      const g = Math.sin((twk / 0.35) * Math.PI);
      ctx.strokeStyle = `rgba(255,255,255,${0.95 * g})`;
      ctx.lineWidth = 1.8;
      const sx = s * 0.7 + d, sy = -s * 0.75 - d;
      ctx.beginPath();
      ctx.moveTo(sx - 5, sy); ctx.lineTo(sx + 5, sy);
      ctx.moveTo(sx, sy - 5); ctx.lineTo(sx, sy + 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  // air lanes flicker into view while wasps are aloft
  let anyFlyer = false;
  for (const e of game.enemies) if (!e.dead && e.type.flying) { anyFlyer = true; break; }
  if (anyFlyer) {
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 10]);
    for (const ap of game.airPaths) {
      const pts = ap.points;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // guard posts (temporary soldier squads; Iron Wall = golden, Tenebra's minions = violet)
  for (const gd of game.guards) {
    const gr = gd.r || 55;
    const minion = !!gd.minion; // Sergeant Tenebra's summons
    const elite = !minion && !!gd.name; // hero-summoned barricade
    const left = Math.max(0, (gd.until - game.time) / (minion ? 6 : 8));
    ctx.strokeStyle = minion
      ? `rgba(178,139,232,${0.3 + left * 0.3})`
      : elite
        ? `rgba(255,209,102,${0.35 + left * 0.35})`
        : `rgba(255,217,194,${0.25 + left * 0.3})`;
    ctx.lineWidth = elite ? 3 : 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(gd.x, gd.y, gr, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    const squad = minion ? 2 : elite ? 5 : 3;
    const orbit = minion ? 13 : elite ? 24 : 20;
    for (let i = 0; i < squad; i++) {
      const a = gd.phase + time * 1.6 + (i / squad) * TAU;
      drawAnt(ctx, 'guard', minion
        ? { color: '#6a3fa0', dark: '#2a1245' }
        : elite
          ? { color: '#c9932c', dark: '#5e3a08' }
          : { color: '#b5442c', dark: '#5e1d0e' }, {
        x: gd.x + Math.cos(a) * orbit, y: gd.y + Math.sin(a) * orbit,
        angle: a + Math.PI / 2, scale: minion ? 0.62 : elite ? 0.85 : 0.7, time, bob: gd.phase + i * 3,
      });
    }
  }

  for (const e of game.enemies) if (!e.dead && !e.type.flying) drawEnemy(game, e, time);
  for (const e of game.enemies) if (!e.dead && e.type.flying) drawEnemy(game, e, time);
  for (const t of game.towers) {
    drawAnt(ctx, t.typeId, t.def, {
      x: t.x, y: t.y, angle: t.aim, tiers: t.isHero ? null : t.tiers, flash: t.flash, time,
      bob: t.bob, stats: t.stats, placeT: t.placeT, stars: t.stars || 0, ascended: !!t.ascended,
      hero: t.isHero ? t.heroDef.id : null, heroLevel: t.isHero ? t.level : 0,
    });
    if (t.ascended) {
      ctx.strokeStyle = `rgba(255,209,102,${0.4 + 0.25 * Math.sin(time * 5 + t.bob)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(t.x, t.y, 24 + Math.sin(time * 3 + t.bob) * 2, 0, TAU); ctx.stroke();
    }
    // rally aura while active
    if (t.isHero && game.rallyT > 0) {
      ctx.strokeStyle = `rgba(255,209,102,${0.35 + 0.25 * Math.sin(time * 10)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(t.x, t.y, 26 + Math.sin(time * 6) * 3, 0, TAU); ctx.stroke();
    }
    // "can't hit these" hint: bugs in range are armored/camo/airborne for this ant
    if (t.uselessT > 0) {
      ctx.fillStyle = '#fff3d6';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(t.x + 14, t.y - 20, 6.5, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e2472f';
      ctx.font = "900 10px 'Baloo 2', 'Trebuchet MS', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('!', t.x + 14, t.y - 16.5);
    }
  }
  for (const p of game.projectiles) if (!p.dead) drawProjectile(p, time);
  updateCritters(game, time, rdt);
  drawCritters(time);
  drawParticles(ctx);

  // Bath Time's sweeping shower spray: translucent blue band + falling droplets
  if (game.map.hazard && game.map.hazard.type === 'sweep') {
    const w = (game.map.hazard.width || 0.55) / 2;
    ctx.save();
    ctx.translate(WORLD_W / 2, WORLD_H / 2);
    ctx.rotate(game.hazardAngle);
    const R = 1200;
    ctx.fillStyle = 'rgba(110,175,230,0.20)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -w, w); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(200,235,255,0.5)'; // band edges
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(w) * R, Math.sin(w) * R); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(-w) * R, Math.sin(-w) * R); ctx.stroke();
    ctx.fillStyle = 'rgba(235,250,255,0.9)'; // droplets streaming through the band
    for (let i = 0; i < 26; i++) {
      const ra = -w + ((i * 0.377) % 1) * 2 * w;
      const rd = 60 + ((i * 149.7 + time * 150) % 640);
      ctx.beginPath();
      ctx.ellipse(Math.cos(ra) * rd, Math.sin(ra) * rd, 1.2, 3.6, ra + Math.PI / 2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Night Porch entity lighting: cool dark wash + additive warm lamp pools re-tint
  // everything drawn under them (bugs, ants, projectiles) — a few drawImages, <1ms
  if (nightPools && nightGlowSprite) {
    ctx.save();
    ctx.fillStyle = 'rgba(10,8,30,0.10)'; // slight darkening away from the lamps
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.globalCompositeOperation = 'lighter';
    for (const [px, py, pr] of nightPools) {
      ctx.drawImage(nightGlowSprite, px - pr, py - pr, pr * 2, pr * 2);
    }
    ctx.restore();
  }

  // selection ring + range
  if (ui.selected && game.towers.includes(ui.selected)) {
    const t = ui.selected;
    const r = t.stats.range;
    if (r && r < 9000) rangeRing(t.x, t.y, r, '245,166,35', time);
    // crisp white footprint collar so the selected ant reads as picked
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.def.footprint + 4, 0, TAU); ctx.stroke();
  }

  // power-casting reticle (decoy shows its white eat-radius)
  if (ui.casting && ui.ghostX != null) {
    const r = ui.casting === 'rain' ? 85 : ui.casting === 'decoy' ? 70 : 55;
    const rgb = ui.casting === 'rain' ? '155,227,74' : ui.casting === 'decoy' ? '245,240,255' : '255,157,138';
    rangeRing(ui.ghostX, ui.ghostY, r, rgb, time);
  }

  // mounds glow while placing: fight for the high ground
  if (ui.placingType) {
    ctx.strokeStyle = 'rgba(255,209,102,0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    for (const md of game.map.mounds || []) {
      ctx.beginPath(); ctx.arc(md.x, md.y, md.r + 4, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // placement ghost
  if (ui.placingType && ui.ghostX != null) {
    const def = ui.placingDef;
    const r = def.base.range && def.base.range < 9000 ? def.base.range : 60;
    const ok = ui.ghostValid;
    rangeRing(ui.ghostX, ui.ghostY, r, ok ? '106,176,76' : '226,71,47', time);
    // a soft ground shadow so the ghost ant reads as hovering, about to drop
    ctx.fillStyle = 'rgba(43,26,16,0.16)';
    ctx.beginPath(); ctx.ellipse(ui.ghostX + 2, ui.ghostY + 10, def.footprint * 0.9, def.footprint * 0.4, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.7;
    drawAnt(ctx, ui.placingType, def, { x: ui.ghostX, y: ui.ghostY, time });
    ctx.globalAlpha = 1;
    if (!ok) {
      ctx.strokeStyle = '#e2472f';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(ui.ghostX - 12, ui.ghostY - 12); ctx.lineTo(ui.ghostX + 12, ui.ghostY + 12);
      ctx.moveTo(ui.ghostX + 12, ui.ghostY - 12); ctx.lineTo(ui.ghostX - 12, ui.ghostY + 12);
      ctx.stroke();
    }
  }

  // debug hitboxes
  if (game.hitboxes) {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0,255,255,0.8)';
    for (const e of game.enemies) {
      ctx.beginPath(); ctx.arc(e.x, e.y, e.type.radius, 0, TAU); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,0,255,0.4)';
    for (const t of game.towers) {
      if (t.stats.range && t.stats.range < 9000) {
        ctx.beginPath(); ctx.arc(t.x, t.y, t.stats.range, 0, TAU); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(t.x, t.y, t.def.footprint, 0, TAU); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,0,0,0.25)';
    ctx.lineWidth = PATH_HALF_W * 2;
    for (const path of game.paths) {
      ctx.beginPath();
      const pts = path.points;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
  }

  // banners: boss intro wins over round stamp
  const ban = (game.bossBanner && game.bossBanner.t > 0) ? game.bossBanner
    : (game.roundBanner && game.roundBanner.t > 0) ? game.roundBanner : null;
  if (ban) {
    const age = ban.dur - ban.t;
    const inK = Math.min(1, age / 0.22);
    const outK = Math.min(1, ban.t / 0.35);
    if (ban.boss) {
      ctx.fillStyle = `rgba(30,16,8,${0.32 * Math.min(inK, outK)})`;
      ctx.fillRect(-20, -20, WORLD_W + 40, WORLD_H + 40);
    }
    ctx.save();
    ctx.globalAlpha = outK;
    ctx.translate(WORLD_W / 2, 140);
    const sc = 0.6 + 0.4 * eob(inK);
    ctx.scale(sc, sc);
    ctx.textAlign = 'center';
    ctx.font = "900 56px 'Baloo 2', 'Trebuchet MS', sans-serif";
    ctx.lineWidth = 10;
    ctx.strokeStyle = INK;
    ctx.strokeText(ban.text, 0, 0);
    ctx.fillStyle = ban.boss ? '#ffb020' : ban.perfect ? '#ffd166' : '#fff3d6'; // PERFECT ROUND stamps gold
    ctx.fillText(ban.text, 0, 0);
    if (ban.sub) {
      ctx.font = "800 21px 'Baloo 2', 'Trebuchet MS', sans-serif";
      ctx.lineWidth = 6;
      ctx.strokeText(ban.sub, 0, 38);
      ctx.fillStyle = '#ffd166';
      ctx.fillText(ban.sub, 0, 38);
    }
    ctx.restore();
  }

  drawBossBars(game, time);

  ctx.restore();
}

// ---------- BTD6-style boss health bars (top-center, up to 2 stacked) ----------

function drawBossBars(game, time) {
  let bosses = null;
  for (const e of game.enemies) {
    if (e.dead || !e.type.boss) continue;
    (bosses || (bosses = [])).push(e);
  }
  if (!bosses) return;
  if (bosses.length > 1) bosses.sort((a, b) => (b.maxHp - a.maxHp) || (b.hp - a.hp));
  const W = 380, H = 16;
  const cx = WORLD_W / 2;
  for (let i = 0; i < Math.min(2, bosses.length); i++) {
    const e = bosses[i];
    const y = 26 + i * 40;
    const frac = Math.max(0, e.hp / e.maxHp);
    const raging = e.shieldT > 0; // the Queen's shield: the whole bar flashes gold
    const extra = bosses.length - 2; // "+N more" tag when a third boss lurks
    ctx.save();
    ctx.translate(cx, y);
    // plate
    ctx.fillStyle = 'rgba(30,16,8,0.78)';
    rr(ctx, -W / 2 - 8, -6, W + 16, H + 24, 9);
    ctx.fill();
    // gold border, pulsing while raging
    ctx.strokeStyle = raging
      ? `rgba(255,209,102,${0.7 + 0.3 * Math.sin(time * 18)})`
      : 'rgba(255,209,102,0.9)';
    ctx.lineWidth = raging ? 3.5 : 2.5;
    rr(ctx, -W / 2 - 8, -6, W + 16, H + 24, 9);
    ctx.stroke();
    // name
    ctx.textAlign = 'left';
    ctx.font = "900 13px 'Baloo 2', 'Trebuchet MS', sans-serif";
    ctx.fillStyle = raging ? '#ffd166' : '#fff3d6';
    ctx.fillText(e.type.name.toUpperCase() + (raging ? ' — RAGING' : ''), -W / 2, 6);
    // hp readout
    ctx.textAlign = 'right';
    ctx.font = "800 12px 'Baloo 2', 'Trebuchet MS', sans-serif";
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(`${Math.ceil(e.hp)} / ${e.maxHp}` + (i === 1 && extra > 0 ? `  (+${extra} more)` : ''), W / 2, 6);
    // trough
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, -W / 2, 10, W, H - 6, 5);
    ctx.fill();
    // fill: gold flash while shielded, blood-to-amber gradient otherwise
    if (frac > 0.004) {
      ctx.fillStyle = raging
        ? (Math.sin(time * 18) > 0 ? '#ffd166' : '#fff3d6')
        : frac > 0.5 ? '#e2472f' : frac > 0.25 ? '#f2913a' : '#ffd166';
      rr(ctx, -W / 2, 10, W * frac, H - 6, 5);
      ctx.fill();
    }
    // segment ticks every 10%
    ctx.strokeStyle = 'rgba(30,16,8,0.65)';
    ctx.lineWidth = 2;
    for (let s = 1; s < 10; s++) {
      const sx = -W / 2 + (W * s) / 10;
      ctx.beginPath(); ctx.moveTo(sx, 10); ctx.lineTo(sx, 10 + H - 6); ctx.stroke();
    }
    ctx.restore();
  }
}

// Re-export body-art entry points so external importers keep using render.js.
export { drawAnt, drawTowerIcon };
