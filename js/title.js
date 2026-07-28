// ===== Cinematic title scene: procedural key art, drawn live by the game's own hands =====
// A golden-hour meadow diorama — layered hills with parallax, god rays, an ant parade
// with long shadows, drifting seeds and pollen, blurred foreground foliage, vignette.
// Pure Canvas 2D, zero assets. Runs only while the title screen is visible.
import { TOWERS } from '../data/towers.js';
import { drawAnt } from './render.js';
import { TAU, mulberry32 } from './util.js';

let cv = null, ctx = null;
let W = 0, H = 0, DPR = 1;
let running = false;
let t0 = 0;
let reduced = false;

// baked layers (rebuilt on resize)
let skyCv, hillsCv = [], fgCv, postCv, rayCv;
// pointer parallax (lerped)
let px = 0, py = 0, tx = 0, ty = 0;
// ambient particles
let seeds = [], pollen = [];

const HILL_COLS = ['#8fbc68', '#6ba54c', '#4e8a38'];
const PARADE = [
  ['worker', 2.0], ['trapjaw', 2.2], ['weaver', 2.0], ['majoress', 2.7], ['honeypot', 2.3],
];

function bakeAll() {
  W = cv.clientWidth; H = cv.clientHeight;
  DPR = Math.min(1.5, window.devicePixelRatio || 1);
  cv.width = Math.round(W * DPR);
  cv.height = Math.round(H * DPR);
  const rng = mulberry32(77);
  const horizon = H * 0.58;

  // --- sky: golden hour, sun high right ---
  skyCv = document.createElement('canvas'); skyCv.width = W; skyCv.height = H;
  const s = skyCv.getContext('2d');
  const g = s.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ffd98f');
  g.addColorStop(0.35, '#ffe9b8');
  g.addColorStop(0.62, '#f4ecc2');
  g.addColorStop(1, '#cfe0a5');
  s.fillStyle = g; s.fillRect(0, 0, W, H);
  const sun = s.createRadialGradient(W * 0.72, H * 0.24, 10, W * 0.72, H * 0.24, H * 0.5);
  sun.addColorStop(0, 'rgba(255,244,210,0.95)');
  sun.addColorStop(0.25, 'rgba(255,222,150,0.45)');
  sun.addColorStop(1, 'rgba(255,222,150,0)');
  s.fillStyle = sun; s.fillRect(0, 0, W, H);
  // far haze band at the horizon
  const hz = s.createLinearGradient(0, horizon - H * 0.12, 0, horizon + H * 0.05);
  hz.addColorStop(0, 'rgba(255,236,190,0)');
  hz.addColorStop(1, 'rgba(255,236,190,0.55)');
  s.fillStyle = hz; s.fillRect(0, horizon - H * 0.12, W, H * 0.2);

  // --- one god-ray sprite (rotated + additive at draw time) ---
  rayCv = document.createElement('canvas'); rayCv.width = 640; rayCv.height = 90;
  const r = rayCv.getContext('2d');
  const rg = r.createLinearGradient(0, 0, 640, 0);
  rg.addColorStop(0, 'rgba(255,236,180,0.55)');
  rg.addColorStop(0.65, 'rgba(255,236,180,0.16)');
  rg.addColorStop(1, 'rgba(255,236,180,0)');
  r.fillStyle = rg;
  r.beginPath(); r.moveTo(0, 38); r.lineTo(640, 0); r.lineTo(640, 90); r.lineTo(0, 52); r.closePath(); r.fill();

  // --- three hill bands, back to front ---
  hillsCv = [];
  for (let i = 0; i < 3; i++) {
    const hc = document.createElement('canvas'); hc.width = W + 80; hc.height = H;
    const h = hc.getContext('2d');
    const base = horizon + i * H * 0.1;
    h.fillStyle = HILL_COLS[i];
    h.beginPath();
    h.moveTo(-40, H + 40);
    h.lineTo(-40, base);
    const bumps = 4 + i;
    for (let b = 0; b <= bumps; b++) {
      const bx = (b / bumps) * (W + 120) - 40;
      const by = base - (18 + rng() * 30) * (1 + i * 0.35) * Math.sin((b / bumps) * Math.PI * (1.4 + i * 0.4) + i);
      h.quadraticCurveTo(bx - (W / bumps) * 0.45, base - (10 + rng() * 24) * (1 + i * 0.3), bx, by);
    }
    h.lineTo(W + 40, H + 40);
    h.closePath(); h.fill();
    // sun-side rim light on the crest
    h.globalCompositeOperation = 'source-atop';
    const rim = h.createLinearGradient(0, base - 60, 0, base + 90);
    rim.addColorStop(0, `rgba(255,236,170,${0.5 - i * 0.13})`);
    rim.addColorStop(1, 'rgba(255,236,170,0)');
    h.fillStyle = rim; h.fillRect(0, 0, hc.width, H);
    // grass speckle
    h.fillStyle = 'rgba(30,60,20,0.18)';
    for (let k = 0; k < 160 - i * 30; k++) {
      const gx = rng() * (W + 80), gy = base + rng() * (H - base);
      h.fillRect(gx, gy, 1.6, 3 + rng() * 3);
    }
    h.globalCompositeOperation = 'source-over';
    hillsCv.push(hc);
  }

  // --- blurred foreground foliage (depth of field) ---
  fgCv = document.createElement('canvas'); fgCv.width = W + 120; fgCv.height = H;
  const f = fgCv.getContext('2d');
  f.filter = 'blur(6px)';
  for (let k = 0; k < 9; k++) {
    const bx = (k / 8) * (W + 120) + (rng() - 0.5) * 60;
    const bh = H * (0.2 + rng() * 0.22);
    const lean = (rng() - 0.5) * 90;
    f.strokeStyle = k % 2 ? 'rgba(46,90,30,0.85)' : 'rgba(63,122,34,0.8)';
    f.lineWidth = 10 + rng() * 10;
    f.lineCap = 'round';
    f.beginPath();
    f.moveTo(bx, H + 20);
    f.quadraticCurveTo(bx + lean * 0.4, H - bh * 0.6, bx + lean, H - bh);
    f.stroke();
  }
  // one big out-of-focus daisy, bottom left
  f.save();
  f.translate(W * 0.07, H * 0.94);
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * TAU;
    f.fillStyle = 'rgba(255,245,235,0.9)';
    f.beginPath(); f.ellipse(Math.cos(a) * 46, Math.sin(a) * 46, 40, 20, a, 0, TAU); f.fill();
  }
  f.fillStyle = 'rgba(245,180,60,0.95)';
  f.beginPath(); f.arc(0, 0, 34, 0, TAU); f.fill();
  f.restore();
  f.filter = 'none';

  // --- post: vignette + grain, baked once ---
  postCv = document.createElement('canvas'); postCv.width = W; postCv.height = H;
  const p = postCv.getContext('2d');
  const vg = p.createRadialGradient(W / 2, H * 0.42, H * 0.3, W / 2, H * 0.52, H * 0.95);
  vg.addColorStop(0, 'rgba(40,22,30,0)');
  vg.addColorStop(0.75, 'rgba(40,22,30,0.10)');
  vg.addColorStop(1, 'rgba(30,16,26,0.42)');
  p.fillStyle = vg; p.fillRect(0, 0, W, H);
  for (let k = 0; k < 500; k++) {
    p.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(43,26,16,0.035)';
    p.fillRect(rng() * W, rng() * H, 1.4, 1.4);
  }

  // --- ambient particles ---
  seeds = []; pollen = [];
  for (let k = 0; k < 11; k++) {
    seeds.push({ x: rng() * W, y: rng() * H * 0.8, v: 9 + rng() * 8, ph: rng() * 10, s: 0.8 + rng() * 0.5 });
  }
  for (let k = 0; k < 9; k++) {
    pollen.push({ x: rng() * W, y: H * (0.2 + rng() * 0.5), ph: rng() * 10 });
  }
}

function frame(now) {
  if (!running) return;
  requestAnimationFrame(frame);
  const t = (now - t0) / 1000;
  px += (tx - px) * 0.045;
  py += (ty - py) * 0.045;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);

  ctx.drawImage(skyCv, 0, 0);

  // god rays: slow fan from the sun, breathing
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(W * 0.72 + px * 2, H * 0.24 + py * 2);
  for (let i = 0; i < 4; i++) {
    const a = 0.55 + i * 0.34 + Math.sin(t * 0.21 + i * 1.7) * 0.03;
    ctx.save();
    ctx.rotate(a);
    ctx.globalAlpha = 0.07 + 0.03 * Math.sin(t * 0.33 + i * 2.1);
    ctx.drawImage(rayCv, 30, -45, Math.max(W, H) * 1.1, 90);
    ctx.restore();
  }
  ctx.restore();

  // hills, back to front, with parallax + a slow breath
  const breathe = Math.sin(t * 0.12) * 3;
  const offs = [px * 4 + breathe * 0.4, px * 9 + breathe * 0.7, px * 15 + breathe];
  for (let i = 0; i < 3; i++) {
    ctx.drawImage(hillsCv[i], -40 - offs[i], py * (i + 1) * 1.2);
  }

  // distant bug silhouettes marching the middle crest — the threat on the horizon
  const crestY = H * 0.58 + H * 0.1 - 14 + py * 2.4;
  ctx.fillStyle = 'rgba(38,28,18,0.6)';
  for (let i = 0; i < 8; i++) {
    const bx = W - (((t * 13) + i * (W / 7.3)) % (W + 60)) + 30 - offs[1];
    const bb = Math.sin(t * 7 + i * 1.9) * 1.2;
    ctx.beginPath(); ctx.ellipse(bx, crestY + bb + Math.sin((bx / W) * TAU * 1.4) * 6, 5, 2.6, 0, 0, TAU); ctx.fill();
  }

  // the parade: heroes on the front meadow, marching with long golden-hour shadows
  const rowY = H * 0.84;
  const drift = reduced ? 0 : (t * 10) % (W + 260);
  for (let i = 0; i < PARADE.length; i++) {
    const [ty2, sc] = PARADE[i];
    let ax = ((i * (W + 260) / PARADE.length) + drift) % (W + 260) - 130;
    const edge = Math.min(1, Math.min(ax + 110, W + 110 - ax) / 130);
    if (edge <= 0) continue;
    const bob = Math.sin(t * 3.1 + i * 1.83) * 2.4;
    const ay = rowY + (i % 2) * 10 + bob * 0.5;
    ctx.save();
    ctx.globalAlpha = Math.max(0, edge);
    // stretched shadow toward camera-left (sun sits high right)
    ctx.fillStyle = 'rgba(43,26,16,0.28)';
    ctx.beginPath();
    ctx.ellipse(ax - 26 * sc * 0.6, ay + 13 * sc * 0.45, 30 * sc * 0.75, 7 * sc * 0.5, -0.1, 0, TAU);
    ctx.fill();
    ctx.translate(0, bob);
    drawAnt(ctx, ty2, TOWERS[ty2], { x: ax + px * 15, y: ay + py * 3, angle: 0, time: t + i * 1.3, bob: i * 2.1, scale: sc });
    ctx.restore();
  }

  // seeds drift down-left; pollen twinkles
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.1;
  for (const sd of seeds) {
    if (!reduced) {
      sd.y += sd.v * 0.016;
      sd.x += Math.sin(t * 1.1 + sd.ph) * 0.5 - 0.12;
      if (sd.y > H + 12) { sd.y = -12; sd.x = Math.random() * W; }
    }
    const rot = Math.sin(t * 1.4 + sd.ph) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.8;
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + rot + (k - 2) * 0.42;
      ctx.beginPath();
      ctx.moveTo(sd.x, sd.y);
      ctx.lineTo(sd.x + Math.cos(a) * 7 * sd.s, sd.y + Math.sin(a) * 7 * sd.s);
      ctx.stroke();
    }
    ctx.restore();
  }
  for (const pl of pollen) {
    const a = 0.18 + 0.22 * Math.max(0, Math.sin(t * 1.6 + pl.ph));
    ctx.fillStyle = `rgba(255,233,160,${a})`;
    ctx.beginPath(); ctx.arc(pl.x + Math.sin(t * 0.5 + pl.ph) * 8, pl.y + Math.cos(t * 0.4 + pl.ph * 2) * 5, 1.8, 0, TAU); ctx.fill();
  }

  // blurred foreground, strongest counter-parallax = depth
  ctx.drawImage(fgCv, -60 - px * 24, py * -6);

  ctx.drawImage(postCv, 0, 0);
}

function onPointer(e) {
  tx = (e.clientX / W - 0.5) * 2;
  ty = (e.clientY / H - 0.5) * 2;
}

function onResize() {
  if (!cv) return;
  bakeAll();
  if (reduced) drawStatic();
}

function drawStatic() {
  running = true; // let one frame render
  frame(t0 + 4200); // a pleasing fixed moment
  running = false;
}

export function startTitleScene() {
  cv = document.getElementById('title-scene');
  if (!cv) return;
  ctx = cv.getContext('2d');
  reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!skyCv || cv.clientWidth !== W || cv.clientHeight !== H) bakeAll();
  if (!startTitleScene.wired) {
    startTitleScene.wired = true;
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('resize', onResize);
  }
  t0 = performance.now();
  if (reduced) { drawStatic(); return; }
  if (!running) { running = true; requestAnimationFrame(frame); }
}

export function stopTitleScene() {
  running = false;
}
