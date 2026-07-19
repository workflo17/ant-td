// ===== Tower (ant) definitions — pure data, no engine imports =====
// base       : starting stats
//   attack   : 'pellet' | 'snap' | 'snipe' | 'bomb' | 'silk' | null (support)
//   damageType: 'acid' | 'crush' | 'explosion' | 'silk'
//   cooldown : seconds between attacks
//   pierce   : enemies one projectile can pass through
// Upgrade tiers patch stats: add {k:+n}, mul {k:*n}, set {k:v}.
// Rule (Bloons style): both paths to tier 2, only ONE path may reach tier 3.

export const TOWERS = {
  worker: {
    name: 'Worker Ant', cost: 85, footprint: 15, hotkey: '1',
    tagline: 'Reliable acid-pellet shooter.',
    color: '#e8952f', dark: '#7a4a12',
    base: { attack: 'pellet', damageType: 'acid', range: 110, cooldown: 0.8, damage: 1, pierce: 1, projSpeed: 380 },
    paths: {
      a: { name: 'Potency', tiers: [
        { name: 'Sharper Acid', cost: 70, desc: '+1 pierce', add: { pierce: 1 } },
        { name: 'Corrosive Bolts', cost: 170, desc: '+1 damage, +1 pierce', add: { damage: 1, pierce: 1 } },
        { name: 'Formic Cannon', cost: 450, desc: '+2 damage, +3 pierce, huge globs', add: { damage: 2, pierce: 3 }, set: { projScale: 1.7 } },
      ]},
      b: { name: 'Zeal', tiers: [
        { name: 'Quick Mandibles', cost: 65, desc: '15% faster attacks', mul: { cooldown: 0.85 } },
        { name: 'Hyper Metabolism', cost: 160, desc: '28% faster still', mul: { cooldown: 0.72 } },
        { name: 'Frenzy', cost: 430, desc: 'Twin shots, blazing speed', mul: { cooldown: 0.6 }, set: { multishot: 2 } },
      ]},
    },
  },

  trapjaw: {
    name: 'Trap-Jaw Ant', cost: 140, footprint: 16, hotkey: '2',
    tagline: '360° crushing snap. Cracks armor.',
    color: '#b5442c', dark: '#5e1d0e',
    base: { attack: 'snap', damageType: 'crush', range: 68, cooldown: 1.1, damage: 1, maxTargets: 6 },
    paths: {
      a: { name: 'Reach', tiers: [
        { name: 'Wide Jaws', cost: 60, desc: '+18 snap radius', add: { range: 18 } },
        { name: 'Whiplash Reach', cost: 150, desc: '+26 radius, hits 4 more bugs', add: { range: 26, maxTargets: 4 } },
        { name: 'Snap Storm', cost: 420, desc: '+40 radius, +6 targets, +1 damage', add: { range: 40, maxTargets: 6, damage: 1 } },
      ]},
      b: { name: 'Venom', tiers: [
        { name: 'Numbing Bite', cost: 75, desc: '15% chance to stun 0.4s', set: { stunChance: 0.15, stunDur: 0.4 } },
        { name: 'Lockjaw', cost: 180, desc: '30% chance to stun 0.6s', set: { stunChance: 0.3, stunDur: 0.6 } },
        { name: 'Paralyzing Snap', cost: 460, desc: '50% stun 1s, +1 damage', set: { stunChance: 0.5, stunDur: 1.0 }, add: { damage: 1 } },
      ]},
    },
  },

  archer: {
    name: 'Acid Archer', cost: 280, footprint: 15, hotkey: '3',
    tagline: 'Infinite range, precision acid shots.',
    color: '#8e5bc6', dark: '#43246b',
    base: { attack: 'snipe', damageType: 'acid', range: 9999, cooldown: 1.5, damage: 2 },
    paths: {
      a: { name: 'Shred', tiers: [
        { name: 'Shell Piercer', cost: 120, desc: 'Shots damage armored Pillbugs', set: { shred: true } },
        { name: 'Fizzing Bolts', cost: 260, desc: '+1 damage, +3 vs shelled bugs', add: { damage: 1 }, set: { shellBonus: 3 } },
        { name: 'Husk Splitter', cost: 650, desc: '+2 damage, +12 vs shelled bugs', add: { damage: 2 }, set: { shellBonus: 12 } },
      ]},
      b: { name: 'Caliber', tiers: [
        { name: 'Concentrate', cost: 140, desc: '+1 damage', add: { damage: 1 } },
        { name: 'Double Distill', cost: 320, desc: '+2 damage', add: { damage: 2 } },
        { name: 'Dissolver Beam', cost: 780, desc: '+4 damage, 35% faster', add: { damage: 4 }, mul: { cooldown: 0.65 } },
      ]},
    },
  },

  exploder: {
    name: 'Exploding Ant', cost: 350, footprint: 17, hotkey: '4',
    tagline: 'Real Colobopsis! Lobs blasts that pop armor.',
    color: '#e2762a', dark: '#7a3608',
    base: { attack: 'bomb', damageType: 'explosion', range: 130, cooldown: 1.6, damage: 1, blast: 40 },
    paths: {
      a: { name: 'Boom', tiers: [
        { name: 'Bigger Boom', cost: 130, desc: '+15 blast radius', add: { blast: 15 } },
        { name: 'Splatter Burst', cost: 300, desc: '+20 radius, +1 damage', add: { blast: 20, damage: 1 } },
        { name: 'Colony Bomb', cost: 700, desc: '+35 radius, +2 damage', add: { blast: 35, damage: 2 } },
      ]},
      b: { name: 'Gel', tiers: [
        { name: 'Sticky Burn', cost: 140, desc: 'Burns 2/s for 3s', set: { burnDps: 2, burnDur: 3 } },
        { name: 'Napalm Sap', cost: 320, desc: 'Burns 4/s for 4s', set: { burnDps: 4, burnDur: 4 } },
        { name: 'Inferno Gel', cost: 720, desc: 'Burns 8/s for 5s, +1 damage', set: { burnDps: 8, burnDur: 5 }, add: { damage: 1 } },
      ]},
    },
  },

  weaver: {
    name: 'Weaver Ant', cost: 210, footprint: 15, hotkey: '5',
    tagline: 'Silk webs that slow the march.',
    color: '#2fa7a0', dark: '#0e4f4b',
    base: { attack: 'silk', damageType: 'silk', range: 105, cooldown: 1.0, damage: 0, pierce: 1, projSpeed: 320, slowPct: 0.4, slowDur: 2.5 },
    paths: {
      a: { name: 'Grip', tiers: [
        { name: 'Thicker Silk', cost: 90, desc: 'Slow 55%', set: { slowPct: 0.55 } },
        { name: 'Binding Threads', cost: 200, desc: 'Slow 65% for 3.5s', set: { slowPct: 0.65, slowDur: 3.5 } },
        { name: 'Cocoon Snare', cost: 520, desc: 'Slow 72% + roots bugs 0.8s', set: { slowPct: 0.72, snareDur: 0.8 } },
      ]},
      b: { name: 'Net', tiers: [
        { name: 'Wide Net', cost: 100, desc: '+3 pierce', add: { pierce: 3 } },
        { name: 'Web Burst', cost: 230, desc: 'Webs splash to nearby bugs', set: { splash: 42 } },
        { name: 'Silk Storm', cost: 540, desc: 'Big splash, +4 pierce, 25% faster', set: { splash: 75 }, add: { pierce: 4 }, mul: { cooldown: 0.75 } },
      ]},
    },
  },

  army: {
    name: 'Army Ant Camp', cost: 650, footprint: 15, hotkey: '6',
    tagline: 'Drops ant ambush piles on the trail. Ambushes hit anything — even camo and armor.',
    color: '#7a2d1c', dark: '#3d130a',
    base: { attack: 'trap', damageType: 'crush', range: 100, cooldown: 3.0, damage: 1, trapCharges: 8, maxPiles: 2, trapRadius: 26 },
    paths: {
      a: { name: 'Ambush', tiers: [
        { name: 'Bigger Warband', cost: 250, desc: '+4 charges per pile', add: { trapCharges: 4 } },
        { name: 'Serrated Jaws', cost: 550, desc: '+6 charges, +1 damage per bite', add: { trapCharges: 6, damage: 1 } },
        { name: 'Kill Zone', cost: 1300, desc: '+10 charges, +1 damage, wider piles', add: { trapCharges: 10, damage: 1, trapRadius: 10 } },
      ]},
      b: { name: 'Logistics', tiers: [
        { name: 'Fast March', cost: 220, desc: '30% faster pile production', mul: { cooldown: 0.7 } },
        { name: 'Twin Columns', cost: 500, desc: '+2 piles at once', add: { maxPiles: 2 } },
        { name: 'Standing Army', cost: 1250, desc: 'Much faster, +2 more piles', mul: { cooldown: 0.55 }, add: { maxPiles: 2 } },
      ]},
    },
  },

  majoress: {
    name: 'Majoress Guard', cost: 1450, footprint: 20, hotkey: '7',
    tagline: 'A royal heavyweight. Shreds everything late-game.',
    color: '#7b3fa0', dark: '#3c1657',
    base: { attack: 'pellet', damageType: 'acid', range: 140, cooldown: 0.5, damage: 2, pierce: 2, projSpeed: 520, projScale: 1.2 },
    paths: {
      a: { name: 'Venom', tiers: [
        { name: 'Royal Venom', cost: 500, desc: '+2 damage', add: { damage: 2 } },
        { name: 'Dissolving Spit', cost: 1100, desc: '+2 damage, melts armored Pillbugs', add: { damage: 2 }, set: { shred: true } },
        { name: "Queen's Champion", cost: 2600, desc: '+6 damage, +3 pierce, huge globs', add: { damage: 6, pierce: 3 }, set: { projScale: 1.8 } },
      ]},
      b: { name: 'Fervor', tiers: [
        { name: 'Battle Rhythm', cost: 450, desc: '25% faster attacks', mul: { cooldown: 0.75 } },
        { name: 'Frenzied Court', cost: 1000, desc: '35% faster still, +1 pierce', mul: { cooldown: 0.65 }, add: { pierce: 1 } },
        { name: 'Hypersonic', cost: 2400, desc: 'Twin shots at blinding speed', mul: { cooldown: 0.5 }, set: { multishot: 2 } },
      ]},
    },
  },

  honeypot: {
    name: 'Honeypot Replete', cost: 300, footprint: 19, hotkey: '8',
    tagline: 'A living sugar bank. Pays every round.',
    color: '#f5a623', dark: '#8a5a00',
    base: { attack: null, income: 60 },
    paths: {
      a: { name: 'Nectar', tiers: [
        { name: 'Sweeter Nectar', cost: 180, desc: '+50 sugar per round', add: { income: 50 } },
        { name: 'Bulging Reserves', cost: 380, desc: '+90 sugar per round', add: { income: 90 } },
        { name: 'Royal Stockpile', cost: 850, desc: '+180 sugar per round', add: { income: 180 } },
      ]},
      b: { name: 'Interest', tiers: [
        { name: 'Sugar Loans', cost: 200, desc: '+8% of your sugar each round (max 60)', set: { interest: 0.08, interestCap: 60 } },
        { name: 'Compound Sweetness', cost: 420, desc: '+15% interest (max 150)', set: { interest: 0.15, interestCap: 150 } },
        { name: 'Honey Bank', cost: 900, desc: '+22% interest (max 320), +60 income', set: { interest: 0.22, interestCap: 320 }, add: { income: 60 } },
      ]},
    },
  },

  beacon: {
    name: 'Pheromone Beacon', cost: 200, footprint: 16, hotkey: '9',
    tagline: 'Scent aura: buffs ants and reveals camo.',
    color: '#e9e4d2', dark: '#5b5442',
    base: { attack: null, range: 120, auraRate: 1.12, camoDetect: true },
    paths: {
      a: { name: 'Fury', tiers: [
        { name: 'Rally Scent', cost: 110, desc: 'Ants in aura attack 25% faster', set: { auraRate: 1.25 } },
        { name: 'Fury Pheromones', cost: 260, desc: '+1 damage for ants in aura', set: { auraDmgAdd: 1 } },
        { name: 'War Dance', cost: 620, desc: '+2 damage, +35% speed in aura', set: { auraDmgAdd: 2, auraRate: 1.35 } },
      ]},
      b: { name: 'Scent', tiers: [
        { name: 'Long Trails', cost: 90, desc: '+45 aura radius', add: { range: 45 } },
        { name: 'Far Scouts', cost: 220, desc: '+45 more radius, ants get +12% range', add: { range: 45 }, set: { auraRange: 1.12 } },
        { name: 'Omniscent', cost: 560, desc: 'EVERY ant on the map sees camo', set: { globalDetect: true } },
      ]},
    },
  },
};

export const TOWER_ORDER = ['worker', 'trapjaw', 'archer', 'exploder', 'weaver', 'army', 'majoress', 'honeypot', 'beacon'];
export const SELL_RATIO = 0.7;
