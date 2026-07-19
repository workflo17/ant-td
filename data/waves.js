// ===== 40 scripted rounds + endless freeplay =====
// A round is a list of groups: { t, n, gap, delay, camo, regen }
//   t     : enemy type id      n    : count
//   gap   : seconds between spawns within the group
//   delay : seconds after round start before the group begins
// Debut curve: camo r8, pillbug r12, regen r16, snail r22, caterpillar r30, queen r40.

function g(t, n, gap, delay = 0, mods = {}) {
  return { t, n, gap, delay, camo: !!mods.camo, regen: !!mods.regen };
}

export const WAVES = [
  /* 1*/ [g('mite', 10, 1.0)],
  /* 2*/ [g('mite', 16, 0.7)],
  /* 3*/ [g('mite', 8, 0.8), g('gnat', 6, 0.9, 4)],
  /* 4*/ [g('gnat', 12, 0.7), g('mite', 10, 0.4, 6)],
  /* 5*/ [g('gnat', 14, 0.6), g('weevil', 4, 1.2, 5)],
  /* 6*/ [g('mite', 22, 0.25), g('gnat', 10, 0.5, 5)],
  /* 7*/ [g('weevil', 12, 0.8), g('gnat', 10, 0.4, 2)],
  /* 8*/ [g('gnat', 12, 0.6), g('gnat', 7, 0.9, 6, { camo: true })],           // CAMO debut
  /* 9*/ [g('weevil', 16, 0.6), g('mite', 8, 0.5, 8, { camo: true })],
  /*10*/ [g('weevil', 14, 0.55), g('hopper', 6, 1.0, 6)],
  /*11*/ [g('hopper', 10, 0.7), g('gnat', 12, 0.4, 3, { camo: true })],
  /*12*/ [g('weevil', 12, 0.55), g('pillbug', 3, 2.0, 5)],                     // PILLBUG debut
  /*13*/ [g('hopper', 12, 0.6), g('pillbug', 5, 1.5, 6)],
  /*14*/ [g('hopper', 14, 0.5), g('moth', 4, 1.2, 8)],
  /*15*/ [g('weevil', 24, 0.3), g('moth', 6, 0.8, 4), g('hopper', 6, 0.6, 9, { camo: true })],
  /*16*/ [g('weevil', 10, 0.7, 0, { regen: true }), g('hopper', 10, 0.5, 6)],  // REGEN debut
  /*17*/ [g('hopper', 10, 0.5, 0, { camo: true }), g('gnat', 12, 0.4, 4, { regen: true })],
  /*18*/ [g('moth', 10, 0.6), g('pillbug', 6, 1.4, 4), g('wasp', 4, 1.5, 10)], // WASP debut
  /*19*/ [g('weevil', 18, 0.4, 0, { regen: true }), g('hopper', 8, 0.6, 7, { camo: true })],
  /*20*/ [g('hopper', 30, 0.28), g('weevil', 8, 0.7, 8, { camo: true, regen: true })],
  /*21*/ [g('moth', 16, 0.45), g('pillbug', 7, 1.2, 5, { camo: true }), g('wasp', 6, 1.2, 8)],
  /*22*/ [g('hopper', 14, 0.5), g('snail', 4, 2.2, 6)],                        // SNAIL debut
  /*23*/ [g('snail', 7, 1.6), g('moth', 10, 0.5, 5, { camo: true })],
  /*24*/ [g('moth', 14, 0.4, 0, { regen: true }), g('snail', 6, 1.6, 6), g('stagBeetle', 1, 0, 12)], // STAG BEETLE debut
  /*25*/ [g('snail', 10, 1.2), g('weevil', 18, 0.3, 3, { camo: true }), g('wasp', 8, 1.0, 6)],
  /*26*/ [g('moth', 24, 0.35, 0, { regen: true })],
  /*27*/ [g('snail', 8, 1.3, 0, { camo: true }), g('hopper', 12, 0.4, 5, { camo: true, regen: true })],
  /*28*/ [g('snail', 14, 0.9), g('pillbug', 8, 1.1, 6), g('wasp', 8, 0.9, 10, { camo: true })],
  /*29*/ [g('moth', 18, 0.35, 0, { camo: true }), g('snail', 10, 1.1, 6)],
  /*30*/ [g('snail', 8, 1.2), g('caterpillar', 1, 0, 10)],                     // CATERPILLAR debut
  /*31*/ [g('caterpillar', 2, 6, 4), g('moth', 12, 0.4, 0, { camo: true })],
  /*32*/ [g('snail', 16, 0.8), g('pillbug', 10, 1.0, 5, { camo: true })],
  /*33*/ [g('caterpillar', 3, 5, 3), g('moth', 16, 0.35, 0, { regen: true }), g('wasp', 10, 0.8, 8)],
  /*34*/ [g('caterpillar', 4, 4, 2), g('snail', 8, 1.0, 0), g('stagBeetle', 2, 9, 8)],
  /*35*/ [g('moth', 36, 0.16), g('moth', 18, 0.3, 4, { camo: true, regen: true }), g('snail', 10, 0.9, 8)], // swarm
  /*36*/ [g('caterpillar', 5, 3.5, 3), g('snail', 14, 0.8, 0, { camo: true })],
  /*37*/ [g('moth', 26, 0.25, 0, { camo: true, regen: true }), g('caterpillar', 3, 4, 6), g('wasp', 12, 0.7, 6, { camo: true })],
  /*38*/ [g('caterpillar', 6, 3, 2), g('snail', 16, 0.7, 0)],
  /*39*/ [g('caterpillar', 8, 2.5, 0), g('moth', 24, 0.25, 6, { camo: true }), g('wasp', 12, 0.6, 10)],
  /*40*/ [g('moth', 20, 0.3), g('caterpillar', 4, 3, 4), g('hornetQueen', 1, 0, 18)], // THE QUEEN

  // ===== Overtime: scripted rounds 41-60 (after the campaign win; boss HP scales +8%/round) =====
  /*41*/ [g('moth', 30, 0.25, 0, { regen: true }), g('snail', 10, 1.0, 4, { camo: true })],
  /*42*/ [g('pillbug', 12, 0.9, 0, { camo: true }), g('snail', 20, 0.7, 3)],
  /*43*/ [g('caterpillar', 3, 4, 2), g('moth', 30, 0.22, 0, { camo: true, regen: true })],
  /*44*/ [g('caterpillar', 5, 3.5, 3), g('snail', 24, 0.6, 0)],
  /*45*/ [g('hornetQueen', 1, 0, 12), g('caterpillar', 2, 4, 2), g('moth', 20, 0.3, 0, { camo: true })],
  /*46*/ [g('moth', 40, 0.18, 0, { camo: true, regen: true }), g('hopper', 20, 0.3, 5, { camo: true, regen: true }), g('wasp', 14, 0.6, 8, { camo: true })],
  /*47*/ [g('caterpillar', 6, 3, 2), g('pillbug', 16, 0.7, 0, { camo: true }), g('stagBeetle', 2, 8, 6)],
  /*48*/ [g('snail', 30, 0.5, 0), g('moth', 30, 0.22, 4, { regen: true })],
  /*49*/ [g('caterpillar', 8, 2.2, 1)],
  /*50*/ [g('hornetQueen', 2, 10, 8), g('caterpillar', 4, 3, 0)],
  /*51*/ [g('moth', 50, 0.15, 0, { camo: true, regen: true }), g('snail', 20, 0.6, 5, { camo: true })],
  /*52*/ [g('caterpillar', 10, 2, 1), g('pillbug', 20, 0.5, 0, { camo: true }), g('wasp', 16, 0.5, 6)],
  /*53*/ [g('hornetQueen', 2, 9, 6), g('snail', 30, 0.5, 0), g('stagBeetle', 3, 7, 4)],
  /*54*/ [g('caterpillar', 12, 1.8, 1)],
  /*55*/ [g('hornetQueen', 3, 8, 5)],
  /*56*/ [g('snail', 40, 0.4, 0, { camo: true }), g('moth', 40, 0.18, 6, { camo: true, regen: true })],
  /*57*/ [g('caterpillar', 10, 2, 2), g('hornetQueen', 2, 10, 10), g('moth', 24, 0.25, 0, { camo: true })],
  /*58*/ [g('moth', 60, 0.13, 0, { camo: true, regen: true }), g('caterpillar', 12, 1.8, 4), g('wasp', 18, 0.5, 12, { camo: true })],
  /*59*/ [g('hornetQueen', 3, 7, 4), g('caterpillar', 8, 2.2, 0)],
  /*60*/ [g('hornetQueen', 4, 6, 8), g('caterpillar', 8, 2, 2), g('moth', 40, 0.16, 0, { camo: true, regen: true })], // grand finale
];

// Endless freeplay past round 40: escalating mixes; boss HP scales via hpMul.
export function freeplayRound(round) {
  const k = round - 40;
  const groups = [
    g('moth', Math.min(60, 20 + k * 2), 0.2, 0, { camo: k % 2 === 0, regen: true }),
    g('snail', Math.min(30, 10 + k), 1.0, 3, { camo: k % 3 === 0 }),
    g('caterpillar', Math.min(12, 2 + Math.floor(k / 2)), 3, 5),
  ];
  if (k % 5 === 0) groups.push(g('hornetQueen', Math.max(1, Math.floor(k / 10)), 8, 10));
  if (k % 3 === 0) groups.push(g('pillbug', 10 + k, 0.8, 2, { camo: true }));
  if (k % 2 === 0) groups.push(g('wasp', Math.min(30, 10 + k), 0.6, 6, { camo: k % 4 === 0 }));
  return groups;
}

// Easy-mode wave thinning (WAVES stays pristine): ~20% fewer bugs per group,
// no camo before round 10, half wasp counts before round 25.
export function easyAdjust(groups, round) {
  const out = [];
  for (const gr of groups) {
    let n = Math.ceil(gr.n * 0.8);
    if (gr.t === 'wasp' && round < 25) n = Math.ceil(n / 2);
    out.push({ ...gr, n, camo: round < 10 ? false : gr.camo });
  }
  return out;
}

export function freeplayHpMul(round) {
  return round <= 40 ? 1 : 1 + (round - 40) * 0.08;
}

export function roundBonus(round) {
  return 100 + round;
}

export const START_SUGAR = 300;
export const START_CRUMBS = 100;

// Sugar Decoy consumable: drop a sugar cube on the grass — ground bugs (not flyers,
// not bosses) inside `radius` stop and eat until its `bites` run out.
export const DECOY = {
  cost: 120,      // sugar per cube (no cooldown — the cost IS the throttle)
  max: 2,         // cubes out at once
  bites: 25,      // cube hp; each eater takes 1 bite per `biteEvery` seconds
  biteEvery: 0.5,
  radius: 70,     // eat radius around the cube
  maxEaters: 6,   // simultaneous diners — the rest walk on
};

export const DIFFICULTY = {
  easy:   { name: 'Easy',   costMul: 0.85, speedMul: 0.92 },
  medium: { name: 'Medium', costMul: 1.0,  speedMul: 1.0 },
  hard:   { name: 'Hard',   costMul: 1.1,  speedMul: 1.08 },
};
