// ===== Foraging Run relics — drafted between rounds, colony-wide passives =====
// kind: 'passive' applies while owned (re-applied on resume) · 'instant' fires once
// Half the shelf is quiet stat food; the other half are BUILD-AROUNDS — relics
// that change how the run is played, not just a number on it.
export const RELICS = [
  // steady
  { id: 'antennae', icon: '📡', name: 'Long Antennae', desc: '+10% range for every ant', kind: 'passive' },
  { id: 'mandibles', icon: '🦷', name: 'Sharpened Mandibles', desc: '+1 damage for every attacking ant', kind: 'passive' },
  { id: 'quicklegs', icon: '💨', name: 'Quick Legs', desc: '+10% attack speed for every ant', kind: 'passive' },
  { id: 'sugarrush', icon: '🍭', name: 'Sugar Rush', desc: '+25% sugar from pops', kind: 'passive' },
  { id: 'stickyground', icon: '🍯', name: 'Sticky Ground', desc: 'All bugs march 8% slower', kind: 'passive' },
  { id: 'scentmaster', icon: '👃', name: 'Scent Master', desc: 'Every ant can see camo bugs', kind: 'passive' },
  { id: 'bigboom', icon: '🧨', name: 'Volatile Sap', desc: '+25% blast radius', kind: 'passive' },
  { id: 'academy', icon: '🎖️', name: 'Veteran Academy', desc: 'Ants earn veteran stars 50% faster', kind: 'passive' },
  { id: 'supply', icon: '🚚', name: 'Supply Lines', desc: '+40 sugar at the end of every round', kind: 'passive' },
  { id: 'warchest', icon: '💰', name: 'War Chest', desc: '+400 sugar, right now', kind: 'instant' },
  { id: 'crumbcake', icon: '🍰', name: 'Crumb Cake', desc: '+20 crumbs, right now', kind: 'instant' },
  { id: 'feast', icon: '🥧', name: 'Royal Feast', desc: '+250 sugar and +10 crumbs, right now', kind: 'instant' },
  // build-arounds
  { id: 'sugarfree', icon: '🚫', name: 'Sugar-Free Colony', desc: 'NO round salary — but pops pay ×3. Clean defense IS the economy.', kind: 'passive' },
  { id: 'monoculture', icon: '🐜', name: 'Monoculture', desc: 'Your most-placed ant type +25% damage; every other type −10%.', kind: 'passive' },
  { id: 'glass', icon: '🍾', name: 'Glass Colony', desc: '+2 damage for every ant — and −50 crumbs, right now.', kind: 'passive' },
  { id: 'nocturne', icon: '🌙', name: 'Nocturne', desc: 'Night falls for the rest of the run; every ant +10% attack speed under the stars.', kind: 'passive' },
  { id: 'dowry', icon: '💍', name: "Queen's Dowry", desc: 'Ascensions cost HALF — but no new ants may be placed after round 25.', kind: 'passive' },
];

export const ASCEND_COST = 3500;
// Ascension repeats: each one costs ASCEND_GROWTH× the last (3500, 5600, 8960, …)
export const ASCEND_GROWTH = 1.6;
