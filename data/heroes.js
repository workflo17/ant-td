// ===== Hero ants — one free placement per game, levels up from global pops =====
// levels[i] = cumulative patch applied when reaching level i+1 (levels[0] is base L1).

export const HEROES = {
  formica: {
    id: 'formica', name: 'General Formica', title: 'the Old Guard',
    color: '#c23b2a', dark: '#571205', footprint: 17, short: 'Formica',
    blurb: 'Crushing front-line bruiser. His Rally Cry whips the whole colony into a frenzy.',
    base: { attack: 'snap', damageType: 'crush', range: 80, cooldown: 0.9, damage: 2, maxTargets: 8 },
    levels: [
      {},
      { add: { damage: 1 } },
      {},                                              // L3: ability unlocks
      { add: { range: 12, maxTargets: 2 } },
      { add: { damage: 1 } },
      { mul: { cooldown: 0.85 } },
      { add: { damage: 2, range: 10 } },
      { add: { maxTargets: 4 } },
      { mul: { cooldown: 0.8 }, add: { damage: 2 } },
      { add: { damage: 4, range: 18 }, set: { stunChance: 0.25, stunDur: 0.6 } }, // L10
    ],
    ability: { kind: 'rally', name: 'Rally Cry', desc: 'All ants attack 50% faster for 10s', cooldown: 45, dur: 10 },
    ability2: { kind: 'ironwall', name: 'Iron Wall', desc: 'An elite guard post holds the exit for 6s — heavy bites, 80% slow', cooldown: 90, dur: 6 },
  },
  vespula: {
    id: 'vespula', name: 'Vespula Silkmother', title: 'Weaver of Fates',
    color: '#3a9e97', dark: '#0e3f3c', footprint: 16, short: 'Vespula',
    blurb: 'Silk artillery with a bite. Web the World stops the whole march cold.',
    base: { attack: 'silk', damageType: 'silk', range: 125, cooldown: 0.85, damage: 1, pierce: 3, projSpeed: 360, slowPct: 0.45, slowDur: 3 },
    levels: [
      {},
      { add: { pierce: 1 } },
      {},                                              // L3: ability unlocks
      { set: { slowPct: 0.55 } },
      { add: { damage: 1 } },
      { set: { splash: 40 } },
      { mul: { cooldown: 0.8 } },
      { set: { slowPct: 0.62, slowDur: 4 } },
      { add: { damage: 1, pierce: 2 } },
      { set: { splash: 70, snareDur: 0.5 }, add: { damage: 1 } }, // L10
    ],
    ability: { kind: 'webworld', name: 'Web the World', desc: 'Every bug on screen slowed 60% for 6s', cooldown: 40, dur: 6 },
    ability2: { kind: 'shroud', name: 'Gossamer Shroud', desc: 'Every ant gains camo detection for 12s', cooldown: 75, dur: 12 },
  },
  melissa: {
    id: 'melissa', name: 'Melissa the Provider', title: 'the Sweet Matron',
    color: '#f5a623', dark: '#8a5a00', footprint: 16, short: 'Melissa',
    blurb: 'Economy matron. Gentle nectar pellets, but her sugar stipend grows every level.',
    base: { attack: 'pellet', damageType: 'acid', range: 95, cooldown: 1.1, damage: 1, pierce: 1, projSpeed: 340 },
    // combat stays gentle on purpose — her real growth is the endRound stipend (15 + 5×level)
    levels: [
      {},
      { add: { range: 8 } },
      {},                                              // L3: ability unlocks
      { add: { pierce: 1 } },
      { add: { damage: 1 } },
      { mul: { cooldown: 0.9 } },
      { add: { range: 10 } },
      { add: { pierce: 1 } },
      { mul: { cooldown: 0.85 } },
      { add: { damage: 1, range: 12 } },               // L10
    ],
    ability: { kind: 'harvest', name: 'Harvest Time', desc: '+200 sugar now; every Honeypot pays out instantly', cooldown: 50 },
    ability2: { kind: 'honeyflood', name: 'Honey Flood', desc: 'All bugs slowed 40% for 5s, +1 sugar per bug caught in the flood', cooldown: 80, dur: 5 },
  },
  sergeant: {
    id: 'sergeant', name: 'Sergeant Tenebra', title: 'the Summoner',
    color: '#6a3fa0', dark: '#2a1245', footprint: 16, short: 'Tenebra',
    blurb: 'Dark-violet summoner. Whistles up short-lived guard-ant minions along the trail while she fights.',
    base: { attack: 'pellet', damageType: 'acid', range: 100, cooldown: 1.0, damage: 1, pierce: 1, projSpeed: 340 },
    summon: { every: 12 }, // passive: a minion guard-ant on the trail near her every 12s (6s life)
    levels: [
      {},
      { add: { damage: 1 } },
      {},                                              // L3: Muster unlocks
      { add: { range: 10 } },
      { add: { pierce: 1 } },
      { mul: { cooldown: 0.85 } },
      { add: { damage: 1 } },                          // L7: Legion unlocks
      { add: { range: 12 } },
      { mul: { cooldown: 0.85 } },
      { add: { damage: 2, pierce: 1 } },               // L10
    ],
    ability: { kind: 'muster', name: 'Muster', desc: 'Summon 3 guard-ant minions along the trail (6s, bite ground bugs)', cooldown: 60 },
    ability2: { kind: 'legion', name: 'Legion', desc: 'Summon 6 minions that also slow bugs 50%', cooldown: 90 },
  },
};

export const HERO_ORDER = ['formica', 'vespula', 'melissa', 'sergeant'];
// total popped layers required to REACH level index+1 (L1 free, L10 max)
export const XP_LEVELS = [0, 150, 400, 800, 1400, 2200, 3200, 4500, 6000, 8000];
export const ABILITY_UNLOCK_LEVEL = 3;
export const ABILITY2_UNLOCK_LEVEL = 7;
