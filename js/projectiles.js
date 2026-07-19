// ===== Pooled projectiles: pellets, lobbed bombs, silk globs =====
import { dist2 } from './util.js';
import { hitEnemy, applySlow, applyBurn } from './enemies.js';
import { creditTower } from './towers.js';
import { burst, ring, explosionFx } from './particles.js';
import { addDecal } from './render.js';
import { sfx } from './sound.js';

export function fireProjectile(game, props) {
  let p = game.freeProjs.pop();
  if (!p) p = {};
  p.kind = 'pellet';
  p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
  p.dmg = 1; p.dtype = 'acid';
  p.pierce = 1; p.hits = p.hits || [];
  p.hits.length = 0;
  p.travel = 0; p.maxTravel = 300;
  p.scale = 1; p.color = '#9be34a';
  p.srcName = ''; p.srcT = null;
  p.shred = false; p.shellBonus = 0; p.detect = false;
  p.slowPct = 0; p.slowDur = 0; p.snareDur = 0; p.splash = 0;
  p.blast = 0; p.burnDps = 0; p.burnDur = 0;
  p.sx = 0; p.sy = 0; p.tx = 0; p.ty = 0; p.t = 0; p.dur = 0.5;
  p.dead = false;
  Object.assign(p, props);
  // ribbon-trail history (3 points), pooled with the projectile
  if (!p.h) p.h = new Float32Array(6);
  p.h[0] = p.h[2] = p.h[4] = p.x;
  p.h[1] = p.h[3] = p.h[5] = p.y;
  game.projectiles.push(p);
  return p;
}

function explode(game, x, y, p) {
  sfx.boom();
  explosionFx(x, y, p.blast);          // flash + additive glow + rising smoke
  ring(x, y, '#ffd166', 8, p.blast * 6, 0.22);
  ring(x, y, '#e2762a', 4, p.blast * 4.4, 0.3);
  burst(x, y, '#ffb020', 12, 160);
  addDecal(x, y, p.blast / 40);        // lingering scorch mark
  game.shake = Math.min(0.4, game.shake + 0.15);
  // directional camera kick, away from the blast
  const cx = 480 - x, cy = 320 - y;
  const cl = Math.hypot(cx, cy) || 1;
  game.kickX += (cx / cl) * 4;
  game.kickY += (cy / cl) * 4;
  const bb = p.blast;
  const nEnemies = game.enemies.length; // snapshot: one blast hits one wave, not spawned children
  for (let ei = 0; ei < nEnemies; ei++) {
    const e = game.enemies[ei];
    if (e.dead || e.type.flying) continue; // ground burst — the sky is safe
    const rr = bb + e.type.radius;
    if (dist2(e.x, e.y, x, y) <= rr * rr) {
      const dealt = hitEnemy(game, e, p.dmg, 'explosion', p); // splash hits camo too
      game.creditDamage(p.srcName, dealt);
      creditTower(game, p.srcT, dealt);
      if (p.burnDps > 0 && !e.dead) applyBurn(game, e, p.burnDps, p.burnDur);
    }
  }
}

function silkHit(game, e, p) {
  applySlow(game, e, p.slowPct, p.slowDur, p.snareDur);
  if (p.dmg > 0) {
    const dealt = hitEnemy(game, e, p.dmg, 'silk', p); // hero silk bites too
    game.creditDamage(p.srcName, dealt);
    creditTower(game, p.srcT, dealt);
  }
  ring(e.x, e.y, '#e8f4f2', e.type.radius + 3, 90, 0.2);
  if (p.splash > 0) {
    const ss = p.splash;
    for (const o of game.enemies) {
      if (o.dead || o === e) continue;
      if (o.camo && !p.detect && !game.globalDetect) continue;
      const rr = ss + o.type.radius;
      if (dist2(o.x, o.y, e.x, e.y) <= rr * rr) applySlow(game, o, p.slowPct, p.slowDur, p.snareDur);
    }
  }
}

export function updateProjectiles(game, dt) {
  const list = game.projectiles;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p.dead) continue;

    if (p.kind === 'bomb') {
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.x = p.sx + (p.tx - p.sx) * k;
      p.y = p.sy + (p.ty - p.sy) * k - Math.sin(k * Math.PI) * 46;
      if (k >= 1) {
        explode(game, p.tx, p.ty, p);
        p.dead = true;
      }
      continue;
    }

    // pellet / silk: straight flight + collision
    p.h[4] = p.h[2]; p.h[5] = p.h[3];
    p.h[2] = p.h[0]; p.h[3] = p.h[1];
    p.h[0] = p.x; p.h[1] = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.travel += Math.hypot(p.vx, p.vy) * dt;
    if (p.travel > p.maxTravel) { p.dead = true; continue; }

    const pr = 5 * p.scale;
    const nEnemies = game.enemies.length; // snapshot: children spawned by pops join next frame
    for (let ei = 0; ei < nEnemies; ei++) {
      const e = game.enemies[ei];
      if (p.pierce <= 0) break;
      if (e.dead) continue;
      if (p.hits.includes(e.id)) continue;
      if (e.camo && !p.detect && !game.globalDetect) continue; // can't touch what you can't smell
      const rr = pr + e.type.radius;
      if (dist2(e.x, e.y, p.x, p.y) > rr * rr) continue;
      p.hits.push(e.id);
      p.pierce--;
      if (p.kind === 'silk') silkHit(game, e, p);
      else {
        const dealt = hitEnemy(game, e, p.dmg, p.dtype, p);
        game.creditDamage(p.srcName, dealt);
        creditTower(game, p.srcT, dealt);
      }
    }
    if (p.pierce <= 0) p.dead = true;
  }

  // compact
  let w = 0;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p.dead) game.freeProjs.push(p);
    else list[w++] = p;
  }
  list.length = w;
}
