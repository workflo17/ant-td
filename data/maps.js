// ===== Map definitions — pure data =====
// paths    : one or more waypoint polylines; bugs enter at the first point,
//            the colony food basket sits at the end of path 0.
// blockers : circular no-build decorations.
// World is a fixed 960x640 canvas.

export const WORLD_W = 960;
export const WORLD_H = 640;
export const PATH_HALF_W = 20;

export const MAPS = [
  {
    id: 'picnic', name: 'Picnic Blanket', tag: 'Gentle',
    bg: 'picnic', unlock: null,
    blurb: 'A lazy S-curve across the family blanket. Long marches, easy pickings.',
    paths: [
      [[-40, 130], [360, 130], [360, 330], [140, 330], [140, 520], [1000, 520]],
    ],
    blockers: [
      { x: 800, y: 160, r: 62, type: 'basket' },
      { x: 620, y: 350, r: 34, type: 'apple' },
      { x: 60, y: 60, r: 30, type: 'apple' },
      { x: 855, y: 300, r: 46, type: 'jam' },
    ],
    mounds: [{ x: 450, y: 240, r: 34 }, { x: 300, y: 590, r: 34 }],
  },
  {
    id: 'garden', name: 'Garden Path', tag: 'Tricky',
    bg: 'garden', unlock: { best: 12, label: 'Reach round 12 on any map' },
    blurb: 'The trail loops back over itself. Watch both lanes of the crossing.',
    paths: [
      [[-40, 260], [620, 260], [620, 110], [300, 110], [300, 460], [1000, 460]],
    ],
    blockers: [
      { x: 820, y: 180, r: 46, type: 'rock' },
      { x: 120, y: 490, r: 42, type: 'pond' },
      { x: 140, y: 120, r: 34, type: 'rock' },
      { x: 850, y: 560, r: 30, type: 'rock' },
      { x: 700, y: 560, r: 48, type: 'mushroom' },
    ],
    mounds: [{ x: 480, y: 180, r: 34 }, { x: 200, y: 380, r: 34 }],
  },
  {
    id: 'kitchen', name: 'Kitchen Counter', tag: 'Brutal',
    bg: 'kitchen', unlock: { best: 24, label: 'Reach round 24 on any map' },
    blurb: 'Two entrances, short trails. Bugs pour in from the left AND the top.',
    paths: [
      [[-40, 180], [430, 180], [430, 420], [1000, 420]],
      [[560, -40], [560, 300], [760, 300], [760, 420], [1000, 420]],
    ],
    blockers: [
      { x: 200, y: 430, r: 52, type: 'plate' },
      { x: 840, y: 170, r: 46, type: 'mug' },
      { x: 120, y: 60, r: 36, type: 'plate' },
      { x: 150, y: 550, r: 55, type: 'pin' },
    ],
    mounds: [{ x: 300, y: 300, r: 34 }, { x: 660, y: 120, r: 34 }],
  },
  {
    id: 'flowerbed', name: 'Flower Bed', tag: 'Cruel',
    bg: 'flowerbed', unlock: { best: 32, label: 'Reach round 32 on any map' },
    blurb: 'A short sprint between the blossoms. Giant flowers crowd your build space.',
    paths: [
      [[-40, 320], [330, 320], [330, 140], [680, 140], [680, 460], [1000, 460]],
    ],
    blockers: [
      { x: 500, y: 320, r: 55, type: 'flower' },
      { x: 190, y: 170, r: 46, type: 'flower' },
      { x: 820, y: 250, r: 48, type: 'flower' },
      { x: 430, y: 550, r: 50, type: 'flower' },
      { x: 130, y: 500, r: 42, type: 'flower' },
      { x: 880, y: 70, r: 40, type: 'flower' },
      { x: 95, y: 95, r: 48, type: 'wateringcan' },
    ],
    mounds: [{ x: 450, y: 230, r: 34 }, { x: 770, y: 330, r: 34 }],
  },
  {
    id: 'nightporch', name: 'Night Porch', tag: 'Midnight',
    bg: 'night', unlock: { best: 36, label: 'Reach round 36 on any map' },
    blurb: 'After dark on the porch boards. Moths swarm the lamplight — they fly 10% faster here.',
    // per-type speed multipliers, applied in the enemy speed calc (data-driven map twist)
    speedMulByType: { moth: 1.1 },
    paths: [
      [[-40, 120], [700, 120], [700, 520], [240, 520], [240, 300], [1000, 300]],
    ],
    blockers: [
      { x: 850, y: 120, r: 40, type: 'lantern' },
      { x: 150, y: 210, r: 36, type: 'lantern' },
      { x: 120, y: 480, r: 46, type: 'flowerpot' },
      { x: 360, y: 410, r: 36, type: 'mothswarm' },
      { x: 870, y: 480, r: 42, type: 'flowerpot' },
    ],
    mounds: [{ x: 470, y: 210, r: 34 }, { x: 500, y: 420, r: 34 }],
  },
  {
    id: 'bath', name: 'Bath Time', tag: 'Soaked',
    bg: 'bath', unlock: { best: 38, label: 'Reach round 38 on any map' },
    blurb: 'Slick tile around the tub. The shower spray sweeps the room — bugs slog through it, but ants in it attack slower too.',
    // rotating shower-spray sector: slows bugs AND debuffs tower attack speed inside the band
    hazard: { type: 'sweep', period: 14, width: 0.7 },
    paths: [
      [[-40, 480], [200, 480], [200, 170], [520, 170], [520, 360], [760, 360], [760, 130], [1000, 130]],
    ],
    blockers: [
      { x: 480, y: 480, r: 78, type: 'tub' },
      { x: 560, y: 452, r: 24, type: 'duck' },
      { x: 120, y: 120, r: 40, type: 'puddle' },
      { x: 700, y: 545, r: 36, type: 'puddle' },
      { x: 880, y: 320, r: 34, type: 'soap' },
    ],
    mounds: [{ x: 350, y: 300, r: 34 }, { x: 650, y: 240, r: 34 }],
  },
];
