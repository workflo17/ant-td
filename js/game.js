// ===== Game orchestrator: economy, rounds, placement, buffs, win/lose =====
import { WORLD_W, WORLD_H, PATH_HALF_W } from '../data/maps.js';
import { WAVES, freeplayRound, freeplayHpMul, roundBonus, easyAdjust, START_SUGAR, START_CRUMBS, DIFFICULTY, DECOY } from '../data/waves.js';
import { XP_LEVELS, ABILITY_UNLOCK_LEVEL, ABILITY2_UNLOCK_LEVEL } from '../data/heroes.js';
import { RELICS, ASCEND_COST } from '../data/relics.js';
import { PERKS } from '../data/perks.js';
import { STAR_REWARDS } from '../data/starRewards.js';
import { TOWER_ORDER } from '../data/towers.js';
import { ENEMIES } from '../data/enemies.js';
import { dist2, TAU } from './util.js';
import { TOWERS, SELL_RATIO } from '../data/towers.js';
import { buildPath, distToPath, dist, posAt } from './util.js';
import * as EN from './enemies.js';
import * as TW from './towers.js';
import { updateProjectiles } from './projectiles.js';
import { textPop, resetParticles, burst, ring } from './particles.js';
import { sfx } from './sound.js';

const TRAP_PERK = { shred: true };
const EMPTY_PERK = {};

function ringFx(game, x, y) {
  ring(x, y, '#c9a06b', 8, 180, 0.3);
  burst(x, y, '#c9a06b', 6, 90);
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// taught-curve callouts stamped under the round banner on debut rounds
const DEBUT_WARNINGS = {
  8: 'Sneaky camo bugs — ants need scent to see them!',
  12: 'Armored Pillbugs — acid bounces right off!',
  16: 'Regen bugs regrow — finish them fast!',
  18: "Wasps take to the air — jaws, bombs and traps can't reach them!",
  22: 'Hard-shelled Snails!',
  24: 'A Stag Beetle lowers its antlers — explosions, crush & shred only!',
  30: 'Something enormous is coming…',
  40: 'THE HORNET QUEEN COMES',
};

export class Game {
  constructor(mapDef, diffKey, hooks = {}, heroDef = null, mods = {}) {
    this.map = mapDef;
    this.diffKey = diffKey;
    this.diff = DIFFICULTY[diffKey];
    this.paths = mapDef.paths.map(buildPath);
    // flyers ignore the trail: one straight air lane per entrance, all ending at the basket
    const exitPt = mapDef.paths[0][mapDef.paths[0].length - 1];
    this.airPaths = mapDef.paths.map(pts => buildPath([pts[0], exitPt]));
    this.airToggle = 0;
    this.hooks = hooks; // { onRoundEnd(round), onWin(), onLose(), onChange() }

    // challenge modifiers: steel (1 crumb) · camo (all bugs camo) · speed (+40%) · poverty (half income)
    this.mods = mods;
    this.speedMul = this.diff.speedMul * (mods.speed ? 1.4 : 1);
    this.speedMulByType = mapDef.speedMulByType || null; // map twists like Night Porch's fast moths
    this.incomeMul = mods.poverty ? 0.5 : 1;
    this.sugar = START_SUGAR;
    this.crumbs = mods.steel ? 1 : START_CRUMBS;
    this.round = 0; // completed rounds
    this.state = 'idle'; // idle | inround | won | lost
    this.freeplay = false;

    this.time = 0;
    this.roundTime = 0;
    this.hpMul = 1;

    this.enemies = [];
    this.freeEnemies = [];
    this.towers = [];
    this.projectiles = [];
    this.freeProjs = [];
    this.traps = []; // army-ant ambush piles
    this.spawnQueue = [];
    this.spawnIdx = 0;

    this.speed = 1;
    this.paused = false;
    this.autoStart = false;
    this.autoT = 0;

    this.globalDetect = false;
    this.god = false;
    this.hitboxes = false;

    this.nextTowerId = 1;
    this.nextEnemyId = 1;
    this.pathToggle = 0;
    this.stats = { pops: 0, leaks: 0, earned: 0 };
    this.shake = 0;
    this.coinAmt = 0; this.coinX = 0; this.coinY = 0; // pending coin-fly juice
    this.hitstop = 0;         // brief world-freeze on boss pops
    this.slowmo = 0;          // boss-entrance slow motion (seconds remaining)
    this.kickX = 0; this.kickY = 0; // directional camera kick
    this.roundBanner = null;  // { text, sub, t, dur }
    this.bossBanner = null;
    this.bossIntroSeen = {};  // one cinematic intro per boss type per run
    this.heroDef = heroDef;   // chosen hero (null = none)
    this.hero = null;         // placed hero tower
    this.abilityCd = 0;
    this.ability2Cd = 0;      // second active, unlocked at hero L7
    this.shroudT = 0;         // Gossamer Shroud: global camo detection window
    this.rallyT = 0;
    this.powerCd = { rain: 0, guards: 0 }; // colony powers
    this.guards = [];                       // temporary guard posts
    this.decoys = [];                       // sugar-cube decoys: bugs stop to eat
    this.ascensionUsed = false;             // one paragon per game
    this.relics = {};                       // Foraging Run drafts
    this.starMul = 1;
    // Foraging Run: only a starter kit is unlocked; the rest is drafted
    this.unlockedTypes = mods.forage
      ? new Set(['worker', ...shuffled(TOWER_ORDER.filter(t => t !== 'worker')).slice(0, 2)])
      : null;
    // permanent colony perks (bought with royal jelly)
    const perkLvls = (mods.perks || {});
    this.sugar += 50 * (perkLvls.headstart || 0);
    if (!mods.steel) this.crumbs += 10 * (perkLvls.walls || 0);
    this.incomeMul *= 1 + 0.05 * (perkLvls.sweet || 0);
    if (perkLvls.academy) this.starMul *= 1.25;
    this.powerCdMul = 1 - 0.15 * (perkLvls.stormheart || 0);
    this.ascendMul = perkLvls.bloodline ? 0.8 : 1;
    // Star Rewards — the backyard-star track (mods.stars = total stars at run start)
    this.starRewards = {};
    for (const r of STAR_REWARDS) if ((mods.stars || 0) >= r.at) this.starRewards[r.id] = true;
    if (this.starRewards.sunnystart) this.sugar += 25;
    if (this.starRewards.crumbcushion && !mods.steel) this.crumbs += 5;
    this.vetSeed = this.starRewards.veterancolony ? 25 : 0; // placed ants start pre-blooded
    this.honeyMul = this.starRewards.backyardlegend ? 1.1 : 1; // Honeypots pay +10%
    this.powersCast = 0;
    this.typesPlaced = new Set(); // achievement tracking
    this.soldAny = false;
    this.abilityUses = 0;
    this.popsBanked = 0;
    this.damageBy = {};           // per-source damage for the colony report
    this.roundLeaks = 0;          // leaks this round (0 at endRound = PERFECT ROUND)
    this.hazardAngle = 0;         // map hazard: current sweep angle (Bath Time shower)
    this.leakTally = {};          // per-round leaks by type name (reset each startRound)
    this.leakTotals = {};         // run-lifetime leaks by type name
    this.camoSeen = false;        // camo warning fires on the first round that has camo
    this.debutSeen = new Set();   // enemy types spawned this run (species intro cards)
    this.debutQueue = [];         // typeIds awaiting a UI intro card

    resetParticles();
  }

  cost(typeId) {
    return Math.round(TOWERS[typeId].cost * this.diff.costMul);
  }
  tierCost(def, pk, i) {
    return Math.round(def.paths[pk].tiers[i].cost * this.diff.costMul);
  }

  // ---- rounds ----
  currentRoundNumber() {
    return this.state === 'inround' ? this.round : this.round + 1;
  }

  startRound() {
    if (this.state !== 'idle' || this.paused) return false;
    this.round++;
    this.hpMul = freeplayHpMul(this.round);
    let groups = this.round <= WAVES.length ? WAVES[this.round - 1] : freeplayRound(this.round);
    if (this.diffKey === 'easy') groups = easyAdjust(groups, this.round);
    const events = [];
    for (const gr of groups) {
      for (let i = 0; i < gr.n; i++) {
        events.push({ at: gr.delay + i * gr.gap, t: gr.t, camo: gr.camo, regen: gr.regen });
      }
    }
    events.sort((a, b) => a.at - b.at);
    this.spawnQueue = events;
    this.spawnIdx = 0;
    this.roundTime = 0;
    this.state = 'inround';
    // banner sub-line: debut warning > last round's leak breakdown
    const hasCamo = events.some(ev => ev.camo);
    let sub = DEBUT_WARNINGS[this.round] || '';
    if (this.round === 8 && !hasCamo) sub = ''; // Easy delays the camo debut
    if (!this.camoSeen && hasCamo) { sub = DEBUT_WARNINGS[8]; this.camoSeen = true; }
    if (!sub) {
      const leaked = Object.entries(this.leakTally);
      if (leaked.length) {
        sub = 'Leaked: ' + leaked.sort((a, b) => b[1] - a[1]).map(([n, c]) => `${c}× ${n}`).join(', ');
      }
    }
    this.leakTally = {};
    this.roundLeaks = 0;
    this.roundBanner = { text: `ROUND ${this.round}`, sub, t: 1.6, dur: 1.6 };
    sfx.stamp();
    if (this.hooks.onChange) this.hooks.onChange();
    return true;
  }

  creditDamage(source, amount) {
    if (amount > 0) this.damageBy[source] = (this.damageBy[source] || 0) + amount;
  }

  // ---- mid-run persistence (saved between rounds; enemies are never mid-flight) ----
  snapshot() {
    return {
      round: this.round,
      sugar: Math.floor(this.sugar),
      crumbs: this.crumbs,
      freeplay: this.freeplay,
      bossIntroSeen: { ...this.bossIntroSeen },
      abilityCd: Math.ceil(this.abilityCd),
      ability2Cd: Math.ceil(this.ability2Cd),
      debutSeen: [...this.debutSeen],
      stats: { ...this.stats },
      damageBy: { ...this.damageBy },
      leakTotals: { ...this.leakTotals },
      camoSeen: this.camoSeen,
      typesPlaced: [...this.typesPlaced],
      soldAny: this.soldAny,
      abilityUses: this.abilityUses,
      ascensionUsed: this.ascensionUsed,
      relics: Object.keys(this.relics),
      unlockedTypes: this.unlockedTypes ? [...this.unlockedTypes] : null,
      decoys: this.decoys.map(d => ({ x: d.x, y: d.y, bites: d.bites })), // paid-for cubes survive resume
      towers: this.towers.map(t => ({
        hero: !!t.isHero, typeId: t.typeId, x: t.x, y: t.y,
        tiers: { ...t.tiers }, mode: t.mode, spent: t.spent, level: t.level || 1,
        dealt: t.dealt || 0, stars: t.stars || 0, ascended: !!t.ascended,
      })),
    };
  }

  applySnapshot(s) {
    this.round = s.round;
    this.sugar = s.sugar;
    this.crumbs = s.crumbs;
    this.freeplay = s.round >= 40 ? true : !!s.freeplay; // never re-trigger the win screen
    this.bossIntroSeen = s.bossIntroSeen || {};
    this.abilityCd = s.abilityCd || 0;
    this.ability2Cd = s.ability2Cd || 0;
    this.debutSeen = new Set(s.debutSeen || []);
    this.stats = { pops: 0, leaks: 0, earned: 0, ...s.stats };
    this.popsBanked = this.stats.pops; // lifetime pops already banked
    this.damageBy = s.damageBy || {};
    this.leakTotals = s.leakTotals || {};
    this.camoSeen = !!s.camoSeen;
    this.typesPlaced = new Set(s.typesPlaced || []);
    this.soldAny = !!s.soldAny;
    this.abilityUses = s.abilityUses || 0;
    for (const ts of s.towers) {
      let t;
      if (ts.hero) {
        if (!this.heroDef) continue;
        t = TW.makeHero(this, this.heroDef, ts.x, ts.y);
        t.level = ts.level || 1;
        this.hero = t;
      } else {
        t = TW.makeTower(this, ts.typeId, ts.x, ts.y);
        t.tiers = { ...ts.tiers };
        t.spent = ts.spent;
        this.typesPlaced.add(ts.typeId);
      }
      t.mode = ts.mode || 'first';
      t.placeT = 0;
      t.dealt = ts.dealt || 0;
      t.stars = ts.stars || 0;
      t.ascended = !!ts.ascended;
      this.towers.push(t);
    }
    this.ascensionUsed = !!s.ascensionUsed;
    this.decoys = (s.decoys || []).map(d => ({
      x: d.x, y: d.y, bites: d.bites, biteT: 0, eaters: 0, phase: Math.random() * 10,
    }));
    if (s.unlockedTypes) this.unlockedTypes = new Set(s.unlockedTypes);
    for (const rid of s.relics || []) {
      const r = RELICS.find(x => x.id === rid);
      if (r) this.addRelic(r, true); // passives re-apply; instants already spent
    }
    this.recomputeBuffs();
  }

  pathFor(e) {
    return (e.flying ? this.airPaths : this.paths)[e.pathIdx];
  }

  spawnEnemy(typeId, opts = {}) {
    let e = this.freeEnemies.pop();
    if (!e) e = {};
    if (this.mods.camo) opts.camo = true;
    if (ENEMIES[typeId].flying) {
      opts.flying = true;
      if (opts.pathIdx == null) opts.pathIdx = this.airToggle++ % this.airPaths.length;
    }
    if (opts.pathIdx == null) opts.pathIdx = this.pathToggle++ % this.paths.length;
    EN.initEnemy(this, e, typeId, opts);
    this.enemies.push(e);
    // species intro cards: first spawn of a type this run goes to the UI queue
    if (!this.debutSeen.has(typeId)) {
      this.debutSeen.add(typeId);
      this.debutQueue.push(typeId);
    }
    // cinematic entrance the first time each boss type shows up
    if (e.type.boss && !this.bossIntroSeen[typeId]) {
      this.bossIntroSeen[typeId] = true;
      this.slowmo = 1.3;
      this.bossBanner = {
        text: e.type.name.toUpperCase(),
        sub: e.type.introSub || '',
        t: 2.2, dur: 2.2, boss: true,
      };
      // boss-specific stingers: stag = low brass, queen = two-chord menace
      sfx.horn(typeId === 'stagBeetle' ? 'stag' : typeId === 'hornetQueen' ? 'queen' : undefined);
    }
    return e;
  }

  endRound() {
    this.state = 'idle';
    const bonus = Math.round(roundBonus(this.round) * this.incomeMul) + (this.relicIncome || 0);
    this.sugar += bonus;
    this.stats.earned += bonus;
    // honeypot income, then interest on the new total
    for (const t of this.towers) {
      if (t.stats.income) {
        const amt = Math.round(t.stats.income * this.incomeMul * this.honeyMul); // Backyard Legend: +10%
        this.sugar += amt;
        this.stats.earned += amt;
        textPop(t.x, t.y - 24, `+${amt}`, '#ffd166');
      }
    }
    for (const t of this.towers) {
      if (t.stats.interest) {
        const amt = Math.min(t.stats.interestCap, Math.floor(this.sugar * t.stats.interest * this.incomeMul));
        if (amt > 0) {
          this.sugar += amt;
          this.stats.earned += amt;
          textPop(t.x, t.y - 40, `+${amt} interest`, '#ffe9a8');
        }
      }
    }
    // Melissa the Provider: sugar stipend every round, scaling with her level
    if (this.hero && this.heroDef && this.heroDef.id === 'melissa') {
      const amt = Math.round((15 + 5 * this.hero.level) * this.incomeMul);
      this.sugar += amt;
      this.stats.earned += amt;
      textPop(this.hero.x, this.hero.y - 28, `+${amt} 🍯`, '#ffd166');
    }
    // PERFECT ROUND: not one bug slipped through
    if (this.roundLeaks === 0 && this.round > 0) {
      this.roundBanner = { text: 'PERFECT ROUND!', sub: '', t: 1.5, dur: 1.5, perfect: true };
      sfx.perfect();
    } else {
      sfx.fanfare();
    }
    if (this.hooks.onRoundEnd) this.hooks.onRoundEnd(this.round);
    if (this.round >= 40 && !this.freeplay) {
      this.state = 'won';
      sfx.win();
      if (this.hooks.onWin) this.hooks.onWin();
    }
    // the idle panel (next-wave preview) rebuilds off this
    if (this.hooks.onChange) this.hooks.onChange();
  }

  continueFreeplay() {
    if (this.state === 'won') {
      this.freeplay = true;
      this.state = 'idle';
      if (this.hooks.onChange) this.hooks.onChange();
    }
  }

  jumpToRound(n) {
    if (this.state === 'inround') {
      this.enemies.length = 0;
      this.spawnIdx = this.spawnQueue.length;
      this.state = 'idle';
    }
    this.round = Math.max(0, n - 1);
    if (this.hooks.onChange) this.hooks.onChange();
  }

  // ---- stepping ----
  step(dt) {
    if (this.paused || this.state === 'lost' || this.state === 'won') return;
    if (this.hitstop > 0) { this.hitstop -= dt; return; } // world holds its breath
    if (this.roundBanner && this.roundBanner.t > 0) this.roundBanner.t -= dt;
    if (this.bossBanner && this.bossBanner.t > 0) this.bossBanner.t -= dt;
    this.kickX *= Math.max(0, 1 - dt * 9);
    this.kickY *= Math.max(0, 1 - dt * 9);
    this.abilityCd = Math.max(0, this.abilityCd - dt);
    this.ability2Cd = Math.max(0, this.ability2Cd - dt);
    this.shroudT = Math.max(0, this.shroudT - dt);
    this.rallyT = Math.max(0, this.rallyT - dt);
    this.powerCd.rain = Math.max(0, this.powerCd.rain - dt);
    this.powerCd.guards = Math.max(0, this.powerCd.guards - dt);
    // hero levels up from the colony's total pops
    if (this.hero && this.hero.level < 10 && this.stats.pops >= XP_LEVELS[this.hero.level]) {
      this.hero.level++;
      this.recomputeBuffs();
      textPop(this.hero.x, this.hero.y - 34, `LEVEL ${this.hero.level}!`, '#ffd166', 17);
      if (this.hero.level === ABILITY_UNLOCK_LEVEL) {
        textPop(this.hero.x, this.hero.y - 54, `${this.heroDef.ability.name} ready!`, '#fff', 14);
      }
      sfx.upgrade();
    }
    if (this.slowmo > 0) {
      this.slowmo -= dt;
      dt *= 0.35; // boss-entrance / last-pop slow motion
    }
    this.time += dt;
    // map hazard: Bath Time's shower spray sweeps a slow circle
    const hz = this.map.hazard;
    if (hz && hz.type === 'sweep') {
      this.hazardAngle = ((this.time / hz.period) * TAU) % TAU;
    }

    if (this.state === 'inround') {
      this.roundTime += dt;
      const q = this.spawnQueue;
      while (this.spawnIdx < q.length && q[this.spawnIdx].at <= this.roundTime) {
        const ev = q[this.spawnIdx++];
        this.spawnEnemy(ev.t, { camo: ev.camo, regen: ev.regen, hpMul: this.hpMul });
      }
    }

    const len = this.enemies.length;
    for (let i = 0; i < len; i++) {
      const e = this.enemies[i];
      if (!e.dead) EN.updateEnemy(this, e, dt);
    }
    // compact dead enemies
    let w = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) this.freeEnemies.push(e);
      else this.enemies[w++] = e;
    }
    this.enemies.length = w;

    for (const t of this.towers) TW.updateTower(this, t, dt);
    updateProjectiles(this, dt);
    this.stepTraps();
    this.stepGuards(dt);
    this.stepDecoys(dt);

    if (this.state === 'inround' && this.spawnIdx >= this.spawnQueue.length && this.enemies.length === 0) {
      this.endRound();
    }
    if (this.autoStart && this.state === 'idle' && !this.draftPending) {
      this.autoT += dt;
      if (this.autoT > 0.8) {
        this.autoT = 0;
        this.startRound();
      }
    }
    this.shake = Math.max(0, this.shake - dt * 2.2);
  }

  // ---- colony powers ----
  castPower(kind, x, y) {
    if (this.powerCd[kind] > 0 || this.state === 'lost' || this.state === 'won') { sfx.deny(); return false; }
    this.powersCast++;
    if (kind === 'rain') {
      this.powerCd.rain = 60 * (this.powerCdMul || 1);
      ring(x, y, '#9be34a', 12, 500, 0.45);
      ring(x, y, '#d3ff5e', 6, 340, 0.35);
      burst(x, y, '#9be34a', 22, 200);
      sfx.boom();
      this.shake = Math.min(0.4, this.shake + 0.18);
      const nEnemies = this.enemies.length;
      for (let i = 0; i < nEnemies; i++) {
        const e = this.enemies[i];
        if (e.dead) continue;
        const rr = 85 + e.type.radius;
        if (dist2(e.x, e.y, x, y) > rr * rr) continue;
        this.creditDamage('Acid Rain', EN.hitEnemy(this, e, 10, 'acid', EMPTY_PERK)); // armored bugs shrug it off
      }
    } else if (kind === 'guards') {
      this.powerCd.guards = 45 * (this.powerCdMul || 1);
      this.guards.push({ x, y, until: this.time + 8, cdT: 0, phase: Math.random() * 10 });
      ring(x, y, '#ffd9c2', 8, 220, 0.3);
      sfx.place();
    }
    if (this.hooks.onChange) this.hooks.onChange();
    return true;
  }

  stepGuards(dt) {
    if (!this.guards.length) return;
    let expired = false;
    for (const gd of this.guards) {
      if (this.time > gd.until) { expired = true; continue; }
      gd.cdT -= dt;
      const snap = gd.cdT <= 0;
      let bitten = 0;
      const gr = gd.r || 55;
      const nEnemies = this.enemies.length;
      for (let i = 0; i < nEnemies; i++) {
        const e = this.enemies[i];
        if (e.dead || e.type.flying) continue; // guards hold the ground, not the sky
        const rr = gr + e.type.radius;
        if (dist2(e.x, e.y, gd.x, gd.y) > rr * rr) continue;
        EN.applySlow(this, e, gd.slowPct || 0.7, 0.25, 0); // bodies in the way
        if (snap && bitten < 4) {
          bitten++;
          this.creditDamage(gd.name || 'Guard Detail', EN.hitEnemy(this, e, gd.dmg || 2, 'crush', EMPTY_PERK));
        }
      }
      if (snap) { gd.cdT = 0.5; if (bitten) sfx.snap(); }
    }
    if (expired) this.guards = this.guards.filter(gd => this.time <= gd.until);
  }

  // ambush piles bite anything that walks over them — camo and armor included
  stepTraps() {
    if (!this.traps.length) return;
    let anyDead = false;
    for (const tr of this.traps) {
      if (tr.dead) continue;
      const nEnemies = this.enemies.length;
      for (let i = 0; i < nEnemies && tr.charges > 0; i++) {
        const e = this.enemies[i];
        if (e.dead || e.type.flying) continue; // piles can't jump
        const rr = tr.r + e.type.radius;
        const dx = e.x - tr.x, dy = e.y - tr.y;
        if (dx * dx + dy * dy > rr * rr) continue;
        this.creditDamage('Army Ant Camp', EN.hitEnemy(this, e, tr.dmg, 'crush', TRAP_PERK));
        tr.charges--;
      }
      if (tr.charges <= 0) { tr.dead = true; anyDead = true; }
    }
    if (anyDead) this.traps = this.traps.filter(tr => !tr.dead);
  }

  // ---- Sugar Decoy: a placeable snack that stalls the march ----
  decoyCost() {
    return Math.round(DECOY.cost * this.diff.costMul);
  }

  canDecoy() {
    return this.state !== 'lost' && this.state !== 'won'
      && this.decoys.length < DECOY.max && this.sugar >= this.decoyCost();
  }

  placeDecoy(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false; // NaN cube would snare the whole map
    if (!this.canDecoy()) { sfx.deny(); return false; }
    const fx = Math.max(14, Math.min(WORLD_W - 14, x));
    const fy = Math.max(14, Math.min(WORLD_H - 14, y));
    this.sugar -= this.decoyCost();
    this.decoys.push({ x: fx, y: fy, bites: DECOY.bites, biteT: 0, eaters: 0, phase: Math.random() * 10 });
    ring(fx, fy, '#ffffff', 8, 170, 0.3);
    burst(fx, fy, '#fff3d6', 6, 80);
    sfx.place();
    if (this.hooks.onChange) this.hooks.onChange();
    return true;
  }

  // ground bugs (not flyers, not bosses) inside the radius stop and eat: a hard snare
  // refreshed while the cube endures; each eater takes 1 bite/0.5s until it crumbles
  stepDecoys(dt) {
    if (!this.decoys.length) return;
    let crumbled = false;
    for (const dc of this.decoys) {
      if (dc.dead) continue;
      let eaters = 0;
      const n = this.enemies.length;
      for (let i = 0; i < n && eaters < DECOY.maxEaters; i++) {
        const e = this.enemies[i];
        // bosses shrug it off (stunImmune marks them); flyers never land for snacks
        if (e.dead || e.type.flying || e.type.boss || e.type.stunImmune) continue;
        const rr = DECOY.radius + e.type.radius;
        if (dist2(e.x, e.y, dc.x, dc.y) > rr * rr) continue;
        eaters++;
        e.snareUntilT = Math.max(e.snareUntilT, this.time + 0.15); // eating: full stop while it lasts
      }
      dc.eaters = eaters;
      if (eaters > 0) {
        dc.biteT += dt;
        while (dc.biteT >= DECOY.biteEvery && dc.bites > 0) {
          dc.biteT -= DECOY.biteEvery;
          dc.bites -= eaters;
          sfx.nibble();
          burst(dc.x + (Math.random() - 0.5) * 16, dc.y + (Math.random() - 0.5) * 12, '#ffffff', 2, 50);
        }
        if (dc.bites <= 0) { // crumbs, then gone — pure stall, no reward
          dc.dead = true;
          crumbled = true;
          burst(dc.x, dc.y, '#ffffff', 12, 130);
          ring(dc.x, dc.y, '#fff3d6', 8, 150, 0.3);
          textPop(dc.x, dc.y - 18, 'crunch!', '#fff3d6', 13);
          sfx.crumble();
        }
      } else {
        dc.biteT = 0;
      }
    }
    if (crumbled) this.decoys = this.decoys.filter(d => !d.dead);
  }

  // is this point inside the sweeping hazard band right now?
  inHazard(x, y) {
    const hz = this.map.hazard;
    if (!hz) return false;
    let d = Math.atan2(y - WORLD_H / 2, x - WORLD_W / 2) - this.hazardAngle;
    d = Math.atan2(Math.sin(d), Math.cos(d)); // wrap to [-PI, PI]
    return Math.abs(d) < (hz.width || 0.55) / 2;
  }

  leakEnemy(e) {
    e.dead = true;
    if (this.god) return;
    const val = EN.leakValue(e);
    this.crumbs = Math.max(0, this.crumbs - val);
    this.stats.leaks += val;
    this.roundLeaks++;
    this.leakTally[e.type.name] = (this.leakTally[e.type.name] || 0) + 1;
    this.leakTotals[e.type.name] = (this.leakTotals[e.type.name] || 0) + 1;
    const exit = this.paths[e.pathIdx].points;
    const [ex, ey] = exit[exit.length - 1];
    textPop(Math.min(ex, WORLD_W - 40), ey - 20, `-${val}`, '#ff5d4f', 18);
    sfx.leak();
    this.shake = Math.min(0.5, this.shake + 0.12);
    if (this.crumbs <= 0 && this.state !== 'lost') {
      this.state = 'lost';
      sfx.lose();
      if (this.hooks.onLose) this.hooks.onLose();
    }
  }

  // ---- ascension: fuse a maxed tower into its paragon form, once per game ----
  ascendCost() {
    return Math.round(ASCEND_COST * this.diff.costMul * (this.ascendMul || 1));
  }

  canAscend(t) {
    return !this.ascensionUsed && !t.isHero && !t.ascended && !!t.def.base.attack
      && (t.tiers.a === 3 || t.tiers.b === 3);
  }

  ascend(t) {
    const c = this.ascendCost();
    if (!this.canAscend(t) || this.sugar < c) { sfx.deny(); return false; }
    this.sugar -= c;
    t.spent += c;
    t.ascended = true;
    this.ascensionUsed = true;
    this.recomputeBuffs();
    ring(t.x, t.y, '#ffd166', 10, 420, 0.5);
    ring(t.x, t.y, '#ffffff', 6, 300, 0.4);
    burst(t.x, t.y, '#ffd166', 20, 190);
    textPop(t.x, t.y - 34, 'ASCENDED!', '#ffd166', 20);
    this.shake = Math.min(0.4, this.shake + 0.2);
    sfx.horn();
    if (this.hooks.onChange) this.hooks.onChange();
    return true;
  }

  // ---- Foraging Run relics ----
  addRelic(relic, silent = false) {
    this.relics[relic.id] = true;
    if (relic.kind === 'instant' && !silent) {
      if (relic.id === 'warchest') { this.sugar += 400; this.stats.earned += 400; }
      if (relic.id === 'crumbcake') this.crumbs += 20;
      if (relic.id === 'feast') { this.sugar += 250; this.stats.earned += 250; this.crumbs += 10; }
    }
    if (relic.id === 'sugarrush') this.incomeMul *= 1.25;
    if (relic.id === 'stickyground') this.speedMul *= 0.92;
    if (relic.id === 'tailwind') this.speedMul *= 0.94;
    if (relic.id === 'academy') this.starMul *= 1.5;
    if (relic.id === 'supply') this.relicIncome = (this.relicIncome || 0) + 40;
    this.recomputeBuffs();
    if (this.hooks.onChange) this.hooks.onChange();
  }

  unlockTowerType(typeId) {
    if (this.unlockedTypes) this.unlockedTypes.add(typeId);
    if (this.hooks.onChange) this.hooks.onChange();
  }

  // ---- hero ----
  placeHero(x, y) {
    if (!this.heroDef || this.hero) return null;
    if (!this.canPlace('hero', x, y)) { sfx.deny(); return null; }
    const t = TW.makeHero(this, this.heroDef, x, y);
    this.towers.push(t);
    this.hero = t;
    this.recomputeBuffs();
    ringFx(this, x, y);
    sfx.place();
    if (this.hooks.onChange) this.hooks.onChange();
    return t;
  }

  heroAbilityState() {
    if (!this.hero) return { status: 'none' };
    if (this.hero.level < ABILITY_UNLOCK_LEVEL) return { status: 'locked' };
    if (this.abilityCd > 0) return { status: 'cooldown', t: this.abilityCd };
    return { status: 'ready' };
  }

  useAbility() {
    if (this.heroAbilityState().status !== 'ready') { sfx.deny(); return false; }
    const ab = this.heroDef.ability;
    this.abilityCd = ab.cooldown;
    this.abilityUses++;
    if (ab.kind === 'rally') {
      this.rallyT = ab.dur;
      ring(this.hero.x, this.hero.y, '#ffd166', 10, 620, 0.5);
      textPop(this.hero.x, this.hero.y - 30, 'RALLY!', '#ffd166', 20);
      sfx.horn();
    } else if (ab.kind === 'harvest') {
      this.sugar += 200;
      this.stats.earned += 200;
      textPop(this.hero.x, this.hero.y - 30, 'HARVEST! +200', '#ffd166', 18);
      // every Honeypot pays out its round income right now
      for (const t of this.towers) {
        if (t.stats.income) {
          const amt = Math.round(t.stats.income * this.incomeMul);
          this.sugar += amt;
          this.stats.earned += amt;
          textPop(t.x, t.y - 24, `+${amt}`, '#ffd166');
        }
      }
      ring(this.hero.x, this.hero.y, '#ffd166', 10, 620, 0.5);
      sfx.fanfare();
    } else if (ab.kind === 'muster') {
      this.summonMinions(3, false);
      ring(this.hero.x, this.hero.y, '#b28be8', 10, 420, 0.45);
      textPop(this.hero.x, this.hero.y - 30, 'MUSTER!', '#b28be8', 19);
      sfx.horn();
    } else if (ab.kind === 'webworld') {
      for (const e of this.enemies) {
        if (!e.dead) EN.applySlow(this, e, 0.6, ab.dur, 0);
      }
      ring(this.hero.x, this.hero.y, '#eef6f4', 10, 900, 0.6);
      textPop(this.hero.x, this.hero.y - 30, 'WEB THE WORLD!', '#eef6f4', 18);
      sfx.silk();
      sfx.boom();
    }
    if (this.hooks.onChange) this.hooks.onChange();
    return true;
  }

  // ---- second hero active (unlocks at L7) ----
  heroAbility2State() {
    if (!this.hero || !this.heroDef.ability2) return { status: 'none' };
    if (this.hero.level < ABILITY2_UNLOCK_LEVEL) return { status: 'locked' };
    if (this.ability2Cd > 0) return { status: 'cooldown', t: this.ability2Cd };
    return { status: 'ready' };
  }

  useAbility2() {
    if (this.heroAbility2State().status !== 'ready') { sfx.deny(); return false; }
    const ab = this.heroDef.ability2;
    this.ability2Cd = ab.cooldown;
    this.abilityUses++;
    if (ab.kind === 'ironwall') {
      // an elite guard post barricades the exit of the main trail
      const path = this.paths[0];
      const spot = { x: 0, y: 0, angle: 0, seg: 0 };
      posAt(path, Math.max(0, path.length - 60), spot, 0);
      spot.x = Math.min(spot.x, WORLD_W - 40);
      this.guards.push({
        x: spot.x, y: spot.y, until: this.time + ab.dur, cdT: 0,
        phase: Math.random() * 10, slowPct: 0.8, dmg: 4, r: 62, name: 'Iron Wall',
      });
      ring(spot.x, spot.y, '#ffd166', 10, 300, 0.4);
      textPop(this.hero.x, this.hero.y - 30, 'IRON WALL!', '#ffd166', 18);
      sfx.horn();
    } else if (ab.kind === 'shroud') {
      this.shroudT = ab.dur; // canSee() reads this: every ant sees camo
      ring(this.hero.x, this.hero.y, '#eef6f4', 10, 900, 0.6);
      textPop(this.hero.x, this.hero.y - 30, 'GOSSAMER SHROUD!', '#eef6f4', 17);
      sfx.silk();
    } else if (ab.kind === 'legion') {
      this.summonMinions(6, true); // legionnaires also slow what they mob
      ring(this.hero.x, this.hero.y, '#b28be8', 12, 700, 0.55);
      textPop(this.hero.x, this.hero.y - 30, 'LEGION!', '#b28be8', 19);
      sfx.horn();
    } else if (ab.kind === 'honeyflood') {
      let caught = 0;
      for (const e of this.enemies) {
        if (e.dead) continue;
        EN.applySlow(this, e, 0.4, ab.dur, 0);
        caught++;
      }
      if (caught > 0) {
        const amt = Math.round(caught * this.incomeMul);
        this.sugar += amt;
        this.stats.earned += amt;
      }
      ring(this.hero.x, this.hero.y, '#ffd166', 10, 900, 0.6);
      textPop(this.hero.x, this.hero.y - 30, `HONEY FLOOD! +${Math.round(caught * this.incomeMul)}`, '#ffd166', 18);
      sfx.fanfare();
    }
    if (this.hooks.onChange) this.hooks.onChange();
    return true;
  }

  // ---- Sergeant Tenebra's minions: temporary guard-ants on the trail ----
  spawnMinionAt(x, y, slowing = false) {
    this.guards.push({
      x, y, until: this.time + 6, cdT: 0, phase: Math.random() * 10,
      dmg: 2, r: 44, slowPct: slowing ? 0.5 : 0.12, minion: true,
      name: slowing ? 'Legion' : 'Minion',
    });
    ring(x, y, '#b28be8', 6, 150, 0.3);
  }

  // n minions at random points along the trail(s)
  summonMinions(n, slowing = false) {
    const spot = { x: 0, y: 0, angle: 0, seg: 0 };
    for (let i = 0; i < n; i++) {
      const path = this.paths[i % this.paths.length];
      const d = 60 + Math.random() * Math.max(60, path.length - 160);
      posAt(path, d, spot, 0);
      this.spawnMinionAt(spot.x, spot.y, slowing);
    }
  }

  // passive: one minion at a random trail point near the hero (fallback: nearest point)
  summonNearHero(hero) {
    const R2 = 170 * 170;
    const pt = { x: 0, y: 0, angle: 0, seg: 0 };
    let best = null, bestD = Infinity;
    const near = [];
    for (const path of this.paths) {
      pt.seg = 0;
      for (let d = 20; d < path.length - 20; d += 26) {
        posAt(path, d, pt, pt.seg);
        const dd = dist2(pt.x, pt.y, hero.x, hero.y);
        if (dd <= R2) near.push([pt.x, pt.y]);
        if (dd < bestD) { bestD = dd; best = [pt.x, pt.y]; }
      }
    }
    const s = near.length ? near[(Math.random() * near.length) | 0] : best;
    if (s) this.spawnMinionAt(s[0], s[1], false);
  }

  // ---- placement / economy ----
  canPlace(typeId, x, y) {
    const fp = typeId === 'hero' ? this.heroDef.footprint : TOWERS[typeId].footprint;
    if (x < fp + 2 || x > WORLD_W - fp - 2 || y < fp + 2 || y > WORLD_H - fp - 2) return false;
    for (const path of this.paths) {
      if (distToPath(path, x, y) < PATH_HALF_W + fp - 4) return false;
    }
    for (const b of this.map.blockers) {
      if (dist(x, y, b.x, b.y) < b.r + fp - 6) return false;
    }
    for (const t of this.towers) {
      if (dist(x, y, t.x, t.y) < fp + t.def.footprint - 2) return false;
    }
    return true;
  }

  placeTower(typeId, x, y) {
    if (this.unlockedTypes && !this.unlockedTypes.has(typeId)) { sfx.deny(); return null; } // draft it first
    const c = this.cost(typeId);
    if (this.sugar < c) { sfx.deny(); return null; }
    if (!this.canPlace(typeId, x, y)) { sfx.deny(); return null; }
    this.sugar -= c;
    const t = TW.makeTower(this, typeId, x, y);
    t.spent = c;
    if (this.vetSeed) t.dealt = this.vetSeed; // Veteran Colony: 25 layers of credit on day one
    this.towers.push(t);
    this.typesPlaced.add(typeId);
    this.recomputeBuffs();
    ring(x, y, '#c9a06b', 8, 180, 0.3);
    burst(x, y, '#c9a06b', 6, 90);
    sfx.place();
    if (this.hooks.onChange) this.hooks.onChange();
    return t;
  }

  // Bloons rule: both paths to tier 2, only one path may take tier 3.
  upgradeState(t, pk) {
    const cur = t.tiers[pk];
    const other = pk === 'a' ? 'b' : 'a';
    if (cur >= 3) return { status: 'maxed' };
    if (cur === 2 && t.tiers[other] >= 3) return { status: 'locked' };
    const cost = this.tierCost(t.def, pk, cur);
    return { status: this.sugar >= cost ? 'ok' : 'poor', cost, tier: t.def.paths[pk].tiers[cur] };
  }

  upgrade(t, pk) {
    const st = this.upgradeState(t, pk);
    if (st.status !== 'ok') { sfx.deny(); return false; }
    this.sugar -= st.cost;
    t.spent += st.cost;
    t.tiers[pk]++;
    this.recomputeBuffs();
    ring(t.x, t.y, '#ffd166', 6, 200, 0.32);
    burst(t.x, t.y, '#ffd166', 8, 110);
    sfx.upgrade();
    if (this.hooks.onChange) this.hooks.onChange();
    return true;
  }

  sell(t) {
    if (t.isHero) return 0; // heroes don't retire
    this.soldAny = true;
    const refund = Math.floor(t.spent * SELL_RATIO);
    this.sugar += refund;
    const i = this.towers.indexOf(t);
    if (i >= 0) this.towers.splice(i, 1);
    this.traps = this.traps.filter(tr => tr.ownerId !== t.id);
    this.recomputeBuffs();
    sfx.sell();
    textPop(t.x, t.y - 20, `+${refund}`, '#ffd166');
    if (this.hooks.onChange) this.hooks.onChange();
    return refund;
  }

  recomputeBuffs() {
    this.globalDetect = false;
    const mounds = this.map.mounds || [];
    for (const t of this.towers) {
      let moundMul = 1;
      for (const md of mounds) {
        if (dist2(t.x, t.y, md.x, md.y) <= md.r * md.r) { moundMul = 1.25; break; } // high ground
      }
      t.buffRate = 1; t.buffDmg = 1; t.buffDmgAdd = 0; t.buffRange = moundMul; t.buffDetect = false;
      TW.recomputeStats(t); // beacons get their true stats here (they take no other buffs)
    }
    for (const b of this.towers) {
      if (b.typeId !== 'beacon') continue;
      const bs = b.stats;
      if (bs.globalDetect) this.globalDetect = true;
      const r2 = bs.range * bs.range;
      for (const t of this.towers) {
        if (t === b || !t.def.base.attack) continue;
        const dx = t.x - b.x, dy = t.y - b.y;
        if (dx * dx + dy * dy > r2) continue;
        t.buffRate = Math.max(t.buffRate, bs.auraRate || 1);
        t.buffDmg = Math.max(t.buffDmg, bs.auraDmg || 1);
        t.buffDmgAdd = Math.max(t.buffDmgAdd, bs.auraDmgAdd || 0);
        t.buffRange = Math.max(t.buffRange, bs.auraRange || 1);
        if (bs.camoDetect) t.buffDetect = true;
      }
    }
    // Foraging Run relic passives
    if (this.relics.scentmaster) this.globalDetect = true;
    for (const t of this.towers) {
      if (!t.def.base.attack) continue;
      if (this.relics.antennae) t.buffRange *= 1.1;
      if (this.relics.compound) t.buffRange *= 1.1;
      if (this.relics.quicklegs) t.buffRate *= 1.1;
      if (this.relics.wardrums) t.buffRate *= 1.1;
      if (this.relics.mandibles) t.buffDmgAdd += 1;
      if (this.relics.venom) t.buffDmgAdd += 1;
      t.buffBlast = this.relics.bigboom ? 1.25 : 1;
      TW.recomputeStats(t);
    }
  }
}
