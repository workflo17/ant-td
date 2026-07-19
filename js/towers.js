// ===== Tower runtime: stats, targeting (First/Last/Strong/Close), firing =====
import { TOWERS } from '../data/towers.js';
import { dist2, dist, posAt } from './util.js';
import { hitEnemy, applyStun } from './enemies.js';
import { fireProjectile } from './projectiles.js';
import { tracer, slashFx, burst, ring, textPop } from './particles.js';
import { sfx } from './sound.js';

export const MODES = ['first', 'last', 'strong', 'close'];
export const MODE_LABEL = { first: 'First', last: 'Last', strong: 'Strong', close: 'Close' };

export function makeTower(game, typeId, x, y) {
  const def = TOWERS[typeId];
  const t = {
    id: game.nextTowerId++,
    typeId, def, x, y,
    tiers: { a: 0, b: 0 },
    spent: 0,
    cooldownT: 0.2,
    mode: 'first',
    aim: -Math.PI / 2,
    stats: null,
    buffRate: 1, buffDmg: 1, buffDmgAdd: 0, buffRange: 1, buffDetect: false,
    flash: 0,
    bob: Math.random() * 10,
    placeT: 0.28, // drop-in animation timer
  };
  recomputeStats(t);
  return t;
}

function applyPatch(s, patch) {
  if (!patch) return;
  if (patch.add) for (const k in patch.add) s[k] = (s[k] || 0) + patch.add[k];
  if (patch.mul) for (const k in patch.mul) s[k] = (s[k] || 0) * patch.mul[k];
  if (patch.set) Object.assign(s, patch.set);
}

export function recomputeStats(t) {
  let s;
  if (t.isHero) {
    s = Object.assign({}, t.heroDef.base);
    for (let i = 0; i < t.level; i++) applyPatch(s, t.heroDef.levels[i]);
  } else {
    s = Object.assign({}, t.def.base);
    for (const pk of ['a', 'b']) {
      const tiers = t.def.paths[pk].tiers;
      for (let i = 0; i < t.tiers[pk]; i++) applyPatch(s, tiers[i]);
    }
  }
  if (t.ascended) { // paragon-tier: one per game
    if (s.cooldown) s.cooldown *= 0.7;
    if (s.range != null && s.range < 9000) s.range *= 1.25;
  }
  if (s.range != null && s.range < 9000) s.range *= t.buffRange;
  if (s.cooldown) s.cooldown /= t.buffRate;
  if (s.blast) s.blast *= t.buffBlast || 1;
  t.stats = s;
  t.trapSpots = null; // trail anchor cache invalidated by any stat change
}

export function makeHero(game, heroDef, x, y) {
  const t = {
    id: game.nextTowerId++,
    typeId: 'hero',
    isHero: true,
    heroDef,
    def: { name: heroDef.name, footprint: heroDef.footprint, base: heroDef.base, color: heroDef.color, dark: heroDef.dark, paths: null },
    x, y,
    level: 1,
    tiers: { a: 0, b: 0 },
    spent: 0,
    cooldownT: 0.2,
    mode: 'first',
    aim: -Math.PI / 2,
    stats: null,
    buffRate: 1, buffDmg: 1, buffDmgAdd: 0, buffRange: 1, buffDetect: false,
    flash: 0,
    bob: Math.random() * 10,
    placeT: 0.28,
  };
  recomputeStats(t);
  return t;
}

export function effDamage(t) {
  const d = t.stats.damage || 0;
  const stars = t.stars || 0;
  const vet = 1 + 0.05 * stars;            // % bonus rewards heavy hitters
  const vetFlat = stars >= 2 ? 1 : 0;      // flat +1 so low-damage ants feel it too
  const asc = t.ascended ? 2 : 1;
  return d > 0 ? Math.max(1, Math.round(d * t.buffDmg * vet * asc) + t.buffDmgAdd + vetFlat) : 0;
}

// per-tower service record: layers dealt earn veteran stars (+5% damage each)
const STAR_AT = [100, 400, 1200];
export function creditTower(game, t, dealt) {
  if (!dealt || !t) return;
  t.dealt = (t.dealt || 0) + dealt * (game.starMul || 1);
  let s = 0;
  while (s < 3 && t.dealt >= STAR_AT[s]) s++;
  if (s > (t.stars || 0)) {
    t.stars = s;
    ring(t.x, t.y, '#ffd166', 8, 190, 0.35);
    textPop(t.x, t.y - 30, `★ VETERAN ${s}`, '#ffd166', 14);
    sfx.upgrade();
  }
}

export function canSee(game, t, e) {
  return !e.camo || game.globalDetect || game.shroudT > 0 || t.buffDetect || !!t.stats.camoDetect;
}

export function srcName(t) {
  return t.isHero ? t.heroDef.name : t.def.name;
}

// ground-bound attacks that can never touch a flyer (single source of truth for UI chips too)
export const GROUND_ONLY_ATTACKS = new Set(['snap', 'bomb', 'trap']);
export function isGroundOnly(def) {
  return GROUND_ONLY_ATTACKS.has(def.base.attack);
}

// can this tower's damage affect this enemy at all?
function useful(t, e) {
  const s = t.stats;
  if (e.type.flying && GROUND_ONLY_ATTACKS.has(s.attack)) return false; // ground-only
  if (effDamage(t) === 0) return true; // pure support (silk) is always applicable
  if (e.type.armored && s.damageType !== 'explosion' && s.damageType !== 'crush' && !s.shred) return false;
  return true;
}

export function acquireTarget(game, t) {
  const s = t.stats;
  const infinite = s.range >= 9000;
  const r2 = s.range * s.range;
  let best = null;
  let bestKey = 0;
  let sawUseless = false;
  for (const e of game.enemies) {
    if (e.dead) continue;
    if (!infinite && dist2(e.x, e.y, t.x, t.y) > r2) continue;
    if (!canSee(game, t, e)) { sawUseless = true; continue; }
    if (!useful(t, e)) { sawUseless = true; continue; }
    // pure-slow weavers re-web once a slow is about to lapse (idling reads as broken)
    if (s.slowPct && effDamage(t) === 0 && e.slowUntilT - game.time > 1.2 && e.slowPct >= s.slowPct * (1 - (e.type.slowResist || 0))) continue;
    let key;
    const remaining = game.pathFor(e).length - e.dist;
    if (t.mode === 'first') key = -remaining;
    else if (t.mode === 'last') key = remaining;
    else if (t.mode === 'strong') key = e.type.rank * 100000 - remaining;
    else key = -dist2(e.x, e.y, t.x, t.y);
    if (best === null || key > bestKey) { best = e; bestKey = key; }
  }
  // bugs in range it cannot touch: show the "not my job" hint instead of looking broken
  t.uselessT = (best === null && sawUseless) ? 0.5 : 0;
  return best;
}

function firePellet(game, t, target, kind) {
  const s = t.stats;
  const dmg = effDamage(t);
  const ang = Math.atan2(target.y - t.y, target.x - t.x);
  t.aim = ang;
  const shots = s.multishot || 1;
  const detect = t.buffDetect || game.globalDetect || !!s.camoDetect;
  for (let i = 0; i < shots; i++) {
    const a = ang + (shots > 1 ? (i - (shots - 1) / 2) * 0.12 : 0);
    fireProjectile(game, {
      kind, x: t.x, y: t.y,
      vx: Math.cos(a) * s.projSpeed, vy: Math.sin(a) * s.projSpeed,
      dmg, dtype: s.damageType, pierce: s.pierce || 1,
      maxTravel: Math.min(s.range + 30, 600),
      scale: s.projScale || 1,
      color: kind === 'silk' ? '#eef6f4' : '#9be34a',
      srcName: srcName(t), srcT: t,
      shred: !!s.shred, shellBonus: s.shellBonus || 0, detect,
      slowPct: s.slowPct || 0, slowDur: s.slowDur || 0, snareDur: s.snareDur || 0,
      splash: s.splash || 0,
    });
  }
  if (kind === 'silk') sfx.silk(); else sfx.shoot();
}

function fireSnap(game, t) {
  const s = t.stats;
  const dmg = effDamage(t);
  const r2 = s.range * s.range;
  let hitCount = 0;
  const nEnemies = game.enemies.length; // snapshot: one snap hits one wave
  for (let ei = 0; ei < nEnemies; ei++) {
    const e = game.enemies[ei];
    if (hitCount >= s.maxTargets) break;
    if (e.dead || e.type.flying || !canSee(game, t, e)) continue; // jaws can't reach the sky
    if (dist2(e.x, e.y, t.x, t.y) > r2) continue;
    hitCount++;
    const dealt = hitEnemy(game, e, dmg, s.damageType, s);
    game.creditDamage(srcName(t), dealt);
    creditTower(game, t, dealt);
    if (s.stunChance && Math.random() < s.stunChance) applyStun(game, e, s.stunDur);
  }
  if (hitCount > 0) {
    slashFx(t.x, t.y, s.range, '#ffd9c2');
    sfx.snap();
    t.shots = (t.shots || 0) + 1;
    return true;
  }
  return false;
}

function fireSnipe(game, t, target) {
  const s = t.stats;
  t.aim = Math.atan2(target.y - t.y, target.x - t.x);
  const dealt = hitEnemy(game, target, effDamage(t), s.damageType, s);
  game.creditDamage(srcName(t), dealt);
  creditTower(game, t, dealt);
  tracer(t.x + Math.cos(t.aim) * 14, t.y + Math.sin(t.aim) * 14, target.x, target.y, '#c99df2');
  burst(target.x, target.y, '#8e5bc6', 3, 60);
  sfx.snipe();
}

function fireBomb(game, t, target) {
  const s = t.stats;
  t.aim = Math.atan2(target.y - t.y, target.x - t.x);
  // lead the target along its path
  const flight = 0.45;
  const tPath = game.pathFor(target);
  const lookahead = Math.min(target.dist + target.curSpeed * flight, tPath.length - 1);
  const aimPt = { x: 0, y: 0, angle: 0, seg: 0 };
  posAt(tPath, lookahead, aimPt, target.seg || 0);
  fireProjectile(game, {
    kind: 'bomb', sx: t.x, sy: t.y, x: t.x, y: t.y,
    tx: aimPt.x, ty: aimPt.y, t: 0, dur: flight,
    srcName: srcName(t), srcT: t,
    dmg: effDamage(t), dtype: 'explosion',
    blast: s.blast, burnDps: s.burnDps || 0, burnDur: s.burnDur || 0,
  });
  sfx.lob();
}

// sample the trail(s) for points inside this tower's range — where ambush piles can drop
function computeTrapSpots(game, t) {
  const spots = [];
  const r2 = t.stats.range * t.stats.range;
  const pt = { x: 0, y: 0, angle: 0, seg: 0 };
  for (const path of game.paths) {
    for (let d = 10; d < path.length - 10; d += 14) {
      posAt(path, d, pt, pt.seg);
      if (dist2(pt.x, pt.y, t.x, t.y) <= r2) spots.push({ x: pt.x, y: pt.y });
    }
    pt.seg = 0;
  }
  return spots;
}

function fireTrap(game, t) {
  const s = t.stats;
  if (!t.trapSpots) t.trapSpots = computeTrapSpots(game, t);
  if (!t.trapSpots.length) { t.cooldownT = 0.5; return; }
  let mine = 0;
  for (const tr of game.traps) if (!tr.dead && tr.ownerId === t.id) mine++;
  if (mine >= s.maxPiles) { t.cooldownT = 0.2; return; }
  const spot = t.trapSpots[(Math.random() * t.trapSpots.length) | 0];
  game.traps.push({
    x: spot.x + (Math.random() - 0.5) * 10,
    y: spot.y + (Math.random() - 0.5) * 10,
    charges: s.trapCharges,
    maxCharges: s.trapCharges,
    dmg: effDamage(t),
    r: s.trapRadius,
    ownerId: t.id,
    phase: Math.random() * 10,
    dead: false,
  });
  t.aim = Math.atan2(spot.y - t.y, spot.x - t.x);
  t.cooldownT = s.cooldown;
  t.flash = 0.12;
  t.shots = (t.shots || 0) + 1;
  sfx.lob();
}

export function updateTower(game, t, dt) {
  t.flash = Math.max(0, t.flash - dt);
  if (t.placeT > 0) t.placeT -= dt;
  // Sergeant Tenebra's passive: a minion guard-ant on the trail near her (rounds only)
  if (t.isHero && t.heroDef.summon && game.state === 'inround') {
    t.summonT = (t.summonT || 0) + dt;
    if (t.summonT >= t.heroDef.summon.every) {
      t.summonT = 0;
      game.summonNearHero(t);
    }
  }
  const s = t.stats;
  if (!s.attack) return;
  const hazMul = game.map.hazard && game.inHazard(t.x, t.y) ? 0.65 : 1; // soaked ants attack slower
  t.cooldownT -= dt * (game.rallyT > 0 ? 1.5 : 1) * hazMul; // Rally Cry / shower spray
  if (t.cooldownT > 0) return;

  if (s.attack === 'trap') {
    fireTrap(game, t);
    return;
  }

  if (s.attack === 'snap') {
    if (fireSnap(game, t)) { t.cooldownT = s.cooldown; t.flash = 0.12; }
    else t.cooldownT = 0.08;
    return;
  }

  const target = acquireTarget(game, t);
  if (!target) { t.cooldownT = 0.08; return; }
  t.flash = 0.12;
  t.shots = (t.shots || 0) + 1;
  t.cooldownT = s.cooldown;
  if (s.attack === 'pellet') firePellet(game, t, target, 'pellet');
  else if (s.attack === 'silk') firePellet(game, t, target, 'silk');
  else if (s.attack === 'snipe') fireSnipe(game, t, target);
  else if (s.attack === 'bomb') fireBomb(game, t, target);
}
