// ===== Enemy (bug) definitions — pure data, no engine imports =====
// hp        : layers (1 for basic chain) or shell/boss hit points
// speed     : px/sec at 1x on Medium
// children  : what pops out, as [typeId, count] pairs
// armored   : immune to everything except explosion / crush / armor-piercing (shred)
// hpBar     : draws a health bar (shell & boss types)
// rank      : "Strong" targeting priority (higher = stronger)
// hint      : counter-play tip shown on the one-time species intro card
// charge    : { every, dur, mul } — periodic speed burst with a telegraph
// introSub  : sub-line under the boss cinematic banner

export const ENEMIES = {
  mite: {
    name: 'Mite', hp: 1, speed: 50, radius: 9, rank: 0,
    color: '#e04b3a', dark: '#8e2417', children: [], bodyL: 0.92, bodyW: 1.0,
    desc: 'The humble mite. One layer, no surprises.',
    hint: 'Any ant pops it.',
  },
  gnat: {
    name: 'Gnat', hp: 1, speed: 70, radius: 10, rank: 1,
    color: '#4a86e8', dark: '#1d4fa1', children: [['mite', 1]], wings: true, bodyL: 1.14, bodyW: 0.76,
    desc: 'Pops into a Mite.',
    hint: 'Pierce pops the whole chain.',
  },
  weevil: {
    name: 'Weevil', hp: 1, speed: 88, radius: 12, rank: 2,
    color: '#4caf50', dark: '#20642a', children: [['gnat', 1]], snout: true, bodyL: 1.0, bodyW: 1.08,
    desc: 'Pops into a Gnat.',
    hint: 'Layers add up — keep firing.',
  },
  hopper: {
    name: 'Hopper', hp: 1, speed: 150, radius: 12, rank: 3,
    color: '#f2c230', dark: '#8f6a06', children: [['weevil', 1]], bigLegs: true, bodyL: 1.12, bodyW: 0.86,
    desc: 'Fast! Pops into a Weevil.',
    hint: 'Weaver silk slows the sprint.',
  },
  moth: {
    name: 'Moth', hp: 1, speed: 172, radius: 13, rank: 4,
    color: '#ef7fd0', dark: '#a02a77', children: [['hopper', 1]], wings: true, bodyL: 0.94, bodyW: 1.0,
    desc: 'Fastest of the chain. Pops into a Hopper.',
    hint: 'Slows and traps stop the blur.',
  },
  pillbug: {
    name: 'Pillbug', hp: 1, speed: 46, radius: 15, rank: 5,
    color: '#97a1b0', dark: '#3d4552', children: [['weevil', 2]],
    armored: true, plates: true,
    desc: 'Armored: only explosions, crushing jaws, or shell-piercers hurt it. Pops into 2 Weevils.',
    hint: 'Explosions & crush only!',
  },
  wasp: {
    name: 'Wasp', hp: 4, speed: 55, radius: 11, rank: 5,
    color: '#ffd23f', dark: '#8f6a06', children: [], bodyL: 1.16, bodyW: 0.78,
    flying: true, wings: true, stripes: true, hpBar: true,
    desc: 'Airborne: flies straight for the basket. Jaws, bombs and ground traps cannot touch it.',
    hint: 'Ranged ants only — jaws miss!',
  },
  snail: {
    name: 'Snail', hp: 10, speed: 40, radius: 16, rank: 6,
    color: '#c08046', dark: '#6b3f18', children: [['hopper', 2]],
    shell: true, hpBar: true,
    desc: '10 HP shell, then 2 Hoppers burst out.',
    hint: 'Acid Archer shell-piercers shine.',
  },
  stagBeetle: {
    name: 'Stag Beetle', hp: 320, speed: 24, radius: 24, rank: 6,
    color: '#5a4030', dark: '#241407', children: [['pillbug', 3]],
    boss: true, armored: true, hpBar: true, slowResist: 0.6, stunImmune: true,
    charge: { every: 6, dur: 1.2, mul: 2.2 },
    desc: 'Armored 320 HP mid-boss. Every 6s it lowers its antlers and CHARGES.',
    hint: 'Explosions, crush & shred only — brace for the charge!',
    introSub: 'It charges every 6 seconds!',
  },
  caterpillar: {
    name: 'Caterpillar', hp: 200, speed: 26, radius: 20, rank: 7,
    color: '#8bc34a', dark: '#33691e', children: [['snail', 4]],
    boss: true, segmented: true, hpBar: true, slowResist: 0.5, stunImmune: true,
    desc: 'A 200 HP segmented blimp of a bug. Spawns 4 Snails on death.',
    hint: 'Sustained DPS — it bursts into Snails.',
    introSub: 'It bursts into Snails!',
  },
  hornetQueen: {
    name: 'Hornet Queen', hp: 700, speed: 19, radius: 28, rank: 8,
    color: '#ffb020', dark: '#7a4a00', children: [['caterpillar', 4]],
    boss: true, wings: true, stripes: true, hpBar: true, slowResist: 0.75, stunImmune: true,
    desc: 'The final boss. 700 HP, spawns 4 Caterpillars on death.',
    hint: 'Everything you have. She rages at half health.',
    introSub: 'Protect the stash!',
  },
};

// linear regen chain (regen bugs regrow one step every 3s, up to their spawn type)
export const REGEN_CHAIN = ['mite', 'gnat', 'weevil', 'hopper', 'moth'];
export const REGEN_INTERVAL = 3.0;
