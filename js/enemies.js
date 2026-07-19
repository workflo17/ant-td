// ===== Enemy runtime: spawning, movement, layered damage, statuses =====
import { ENEMIES, REGEN_CHAIN, REGEN_INTERVAL } from '../data/enemies.js';
import { posAt, jitterColor } from './util.js';
import { burst, ring, textPop, burstChunks, popFx } from './particles.js';
import { sfx } from './sound.js';

const rbeCache = {};
// total layers inside a bug (Red Bloon Equivalent)
export function rbe(typeId) {
  if (rbeCache[typeId] != null) return rbeCache[typeId];
  const t = ENEMIES[typeId];
  let v = t.hp;
  for (const [cid, n] of t.children) v += rbe(cid) * n;
  rbeCache[typeId] = v;
  return v;
}

export function leakValue(e) {
  // remaining layers: current hp + everything still nested inside
  return e.hp + (rbe(e.typeId) - e.type.hp);
}

function scaledHp(typeId, hpMul) {
  const t = ENEMIES[typeId];
  return t.hp > 1 ? Math.round(t.hp * hpMul) : 1;
}

export function initEnemy(game, e, typeId, opts) {
  e.id = game.nextEnemyId++;
  e.typeId = typeId;
  e.type = ENEMIES[typeId];
  e.hpMul = opts.hpMul || 1;
  e.hp = scaledHp(typeId, e.hpMul);
  e.maxHp = e.hp;
  e.dist = opts.dist || 0;
  e.pathIdx = opts.pathIdx || 0;
  e.flying = !!opts.flying;
  e.laneOff = (Math.random() * 2 - 1) * 8;
  // real position from birth — children must be targetable the frame they appear
  const path = (e.flying ? game.airPaths : game.paths)[e.pathIdx];
  posAt(path, Math.min(e.dist, path.length - 1), e, 0);
  e.seg = e.seg || 0;
  e.x += -Math.sin(e.angle) * e.laneOff;
  e.y += Math.cos(e.angle) * e.laneOff;
  e.phase = Math.random() * 100;
  e.camo = !!opts.camo;
  e.regen = !!opts.regen;
  const li = REGEN_CHAIN.indexOf(typeId);
  e.regenTop = opts.regenTop != null ? opts.regenTop : (e.regen && li >= 0 ? li : -1);
  e.regenT = 0;
  e.slowPct = 0; e.slowUntilT = 0;
  e.snareUntilT = 0; e.stunUntilT = 0;
  e.burnDps = 0; e.burnUntilT = 0; e.burnTickT = 0;
  e.curSpeed = 0;
  e.dead = false;
  e.regenFlash = 0;
  e.enraged = false;  // hornetQueen phase trigger (pooled: must reset)
  e.shieldT = 0;      // damage-immune window (seconds)
  e.rageSpeed = 1;    // speed multiplier from the queen's rage
  e.chargeT = 0;      // charger types: time since last charge
  e.chargingT = 0;    // remaining charge-burst duration
  e.hitT = 0;      // white-flash + squash timer
  e.spawnT = 0.25; // spring-in timer
  // subtle per-bug color variation (bosses stay iconic)
  e.jfill = e.type.boss ? null : jitterColor(e.type.color, Math.random() * 14 - 7, Math.random() * 8 - 4);
  return e;
}

function transform(game, e, typeId) {
  e.typeId = typeId;
  e.type = ENEMIES[typeId];
  e.rageSpeed = 1; // a popped queen's brood doesn't inherit her rage
  e.chargeT = 0; e.chargingT = 0; // a popped charger's children don't inherit the burst
  e.hp = scaledHp(typeId, e.hpMul);
  e.maxHp = e.hp;
  e.jfill = e.type.boss ? null : jitterColor(e.type.color, Math.random() * 14 - 7, Math.random() * 8 - 4);
}

export function applySlow(game, e, pct, dur, snareDur = 0) {
  const resist = e.type.slowResist || 0;
  const eff = pct * (1 - resist);
  if (eff <= 0) return;
  if (game.time >= e.slowUntilT || eff >= e.slowPct) {
    e.slowPct = eff;
    e.slowUntilT = game.time + dur;
  }
  if (snareDur > 0 && !e.type.stunImmune) {
    e.snareUntilT = Math.max(e.snareUntilT, game.time + snareDur * (1 - resist));
  }
}

export function applyStun(game, e, dur) {
  if (e.type.stunImmune) return;
  e.stunUntilT = Math.max(e.stunUntilT, game.time + dur);
}

export function applyBurn(game, e, dps, dur) {
  if (dps >= e.burnDps || game.time >= e.burnUntilT) {
    e.burnDps = dps;
    e.burnUntilT = game.time + dur;
  }
}

// Core layered-damage routine. Returns layers actually popped (== sugar earned).
// perk: { shred, shellBonus }  — shred pierces Pillbug armor.
// the queen's one-time rage at half health: telegraph, haste, brood drop, brief shield
function queenRage(game, e) {
  e.enraged = true;
  e.rageSpeed = 1.35;
  e.shieldT = 1.5;
  for (let i = 0; i < 2; i++) {
    game.spawnEnemy('caterpillar', {
      dist: Math.max(0, e.dist - 20 * (i + 1)),
      pathIdx: e.pathIdx,
      camo: e.camo,
      hpMul: e.hpMul,
    });
  }
  game.bossBanner = { text: 'THE QUEEN RAGES', sub: 'Her shield holds — for a moment!', t: 1.8, dur: 1.8, boss: true };
  ring(e.x, e.y, '#ffd166', e.type.radius + 6, 260, 0.5);
  burst(e.x, e.y, '#ffb020', 16, 160);
  game.shake = Math.min(0.5, game.shake + 0.25);
  sfx.horn();
}

export function hitEnemy(game, e, amount, dtype, perk) {
  if (e.dead || amount <= 0) return 0;
  if (e.shieldT > 0) { // rage shield: nothing gets through
    ring(e.x, e.y, '#ffd166', e.type.radius + 4, 80, 0.15);
    return 0;
  }
  if (e.type.armored && dtype !== 'explosion' && dtype !== 'crush' && !(perk && perk.shred)) {
    sfx.clink();
    ring(e.x, e.y, '#cfd6e0', e.type.radius + 2, 60, 0.15);
    return 0;
  }
  let dmg = amount;
  if (perk && perk.shellBonus && (e.type.shell || e.type.boss)) dmg += perk.shellBonus;
  let dealt = 0;
  let guard = 0;
  while (dmg > 0 && !e.dead && guard++ < 60) {
    const applied = Math.min(e.hp, dmg);
    e.hp -= applied;
    dmg -= applied;
    dealt += applied;
    if (e.hp <= 0) popLayer(game, e);
  }
  if (dealt > 0) {
    game.sugar += dealt * game.incomeMul;
    game.stats.earned += dealt * game.incomeMul;
    game.stats.pops += dealt;
    e.hitT = 0.15;
    // feed the HUD coin-fly (ui batches these into flying sugar)
    game.coinAmt += dealt;
    game.coinX = e.x;
    game.coinY = e.y;
  }
  if (e.typeId === 'hornetQueen' && !e.enraged && !e.dead && e.hp <= e.maxHp * 0.5) {
    queenRage(game, e);
  }
  return dealt;
}

// the round's final bug just died to a pop: a beat of slow-mo + a satisfying button
function checkLastPop(game, e) {
  if (game.state !== 'inround' || game.spawnIdx < game.spawnQueue.length) return;
  for (const o of game.enemies) if (!o.dead && o !== e) return;
  game.slowmo = Math.max(game.slowmo, 0.5);
  sfx.lastPop();
}

function popLayer(game, e) {
  const t = e.type;
  popFx(e.x, e.y, t.color, t.radius, t.boss || t.shell); // flash + shock ring (+splatter for big bugs)
  if (t.boss) {
    burst(e.x, e.y, t.color, 22, 180);
    ring(e.x, e.y, '#ffffff', t.radius, 320, 0.4);
    sfx.bigPop(t.radius); // bigger boss, deeper thump
    game.shake = Math.min(0.5, game.shake + 0.35);
    game.hitstop = Math.max(game.hitstop, 0.045); // boss pops freeze the world for a beat
  } else {
    burst(e.x, e.y, t.color, t.shell ? 10 : 6);
    sfx.pop(t.radius); // pitch tracks bug size: mite plink → snail thunk
  }
  const kids = [];
  for (const [cid, n] of t.children) for (let i = 0; i < n; i++) kids.push(cid);
  if (kids.length === 0) {
    burstChunks(e.x, e.y, t.color, t.boss ? 7 : 3);
    e.dead = true;
    checkLastPop(game, e);
    return;
  }
  if (t.boss || t.shell) burstChunks(e.x, e.y, t.color, 5);
  transform(game, e, kids[0]);
  e.spawnT = 0.22; // the revealed bug springs out
  for (let i = 1; i < kids.length; i++) {
    game.spawnEnemy(kids[i], {
      dist: Math.max(0, e.dist - 16 * i),
      pathIdx: e.pathIdx,
      camo: e.camo,
      regen: e.regen,
      regenTop: e.regenTop,
      hpMul: e.hpMul,
    });
  }
}

export function updateEnemy(game, e, dt) {
  // burn DoT (sticky fire ignores armor)
  if (e.burnDps > 0 && game.time < e.burnUntilT) {
    e.burnTickT += dt;
    while (e.burnTickT >= 0.5 && !e.dead) {
      e.burnTickT -= 0.5;
      game.creditDamage('Sticky Fire', hitEnemy(game, e, Math.max(1, Math.round(e.burnDps * 0.5)), 'explosion', SHRED_PERK));
    }
    if (e.dead) return;
  } else {
    e.burnDps = 0;
  }

  // regen: regrow one chain step every 3s
  if (e.regenTop >= 0) {
    const cur = REGEN_CHAIN.indexOf(e.typeId);
    if (cur >= 0 && cur < e.regenTop) {
      e.regenT += dt;
      if (e.regenT >= REGEN_INTERVAL) {
        e.regenT = 0;
        transform(game, e, REGEN_CHAIN[cur + 1]);
        e.regenFlash = 0.5;
        ring(e.x, e.y, '#ff7fb8', e.type.radius + 4, 120, 0.3);
      }
    } else {
      e.regenT = 0;
    }
  }
  if (e.regenFlash > 0) e.regenFlash -= dt;
  if (e.hitT > 0) e.hitT -= dt;
  if (e.spawnT > 0) e.spawnT -= dt;
  if (e.shieldT > 0) e.shieldT -= dt;

  // charger types (data-driven: type.charge {every,dur,mul}) — telegraph, then burst
  const ch = e.type.charge;
  let chargeMul = 1;
  if (ch) {
    if (e.chargingT > 0) {
      e.chargingT -= dt;
      chargeMul = ch.mul;
    } else {
      e.chargeT += dt;
      if (e.chargeT >= ch.every) {
        e.chargeT = 0;
        e.chargingT = ch.dur;
        chargeMul = ch.mul;
        ring(e.x, e.y, '#ffd166', e.type.radius + 4, 200, 0.3);
        burst(e.x, e.y, e.type.color, 8, 120);
        sfx.snap();
      }
    }
  }

  // movement
  const stunned = game.time < e.stunUntilT || game.time < e.snareUntilT;
  let v = 0;
  if (!stunned) {
    const slow = game.time < e.slowUntilT ? e.slowPct : 0;
    const mapMul = game.speedMulByType ? (game.speedMulByType[e.typeId] || 1) : 1;
    const hazMul = game.map.hazard && game.inHazard(e.x, e.y) ? 0.6 : 1; // shower spray bogs bugs down
    v = e.type.speed * e.rageSpeed * chargeMul * mapMul * hazMul * game.speedMul * (1 - slow);
  }
  e.curSpeed = v;
  e.dist += v * dt;

  const path = (e.flying ? game.airPaths : game.paths)[e.pathIdx];
  if (e.dist >= path.length) {
    game.leakEnemy(e);
    return;
  }
  posAt(path, e.dist, e, e.seg || 0);
  e.seg = e.seg || 0;
  // perpendicular lane offset for visual variety
  const px = -Math.sin(e.angle), py = Math.cos(e.angle);
  e.x += px * e.laneOff;
  e.y += py * e.laneOff;
}

const SHRED_PERK = { shred: true };
