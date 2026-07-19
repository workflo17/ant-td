// ===== Foraging Run relics — drafted between rounds, colony-wide passives =====
// kind: 'passive' applies while owned (re-applied on resume) · 'instant' fires once
export const RELICS = [
  { id: 'antennae', icon: '📡', name: 'Long Antennae', desc: '+10% range for every ant', kind: 'passive' },
  { id: 'mandibles', icon: '🦷', name: 'Sharpened Mandibles', desc: '+1 damage for every attacking ant', kind: 'passive' },
  { id: 'quicklegs', icon: '💨', name: 'Quick Legs', desc: '+10% attack speed for every ant', kind: 'passive' },
  { id: 'sugarrush', icon: '🍭', name: 'Sugar Rush', desc: '+25% sugar from pops', kind: 'passive' },
  { id: 'stickyground', icon: '🍯', name: 'Sticky Ground', desc: 'All bugs march 8% slower', kind: 'passive' },
  { id: 'scentmaster', icon: '👃', name: 'Scent Master', desc: 'Every ant can see camo bugs', kind: 'passive' },
  { id: 'bigboom', icon: '🧨', name: 'Volatile Sap', desc: '+25% blast radius', kind: 'passive' },
  { id: 'academy', icon: '🎖️', name: 'Veteran Academy', desc: 'Ants earn veteran stars 50% faster', kind: 'passive' },
  { id: 'warchest', icon: '💰', name: 'War Chest', desc: '+400 sugar, right now', kind: 'instant' },
  { id: 'crumbcake', icon: '🍰', name: 'Crumb Cake', desc: '+20 crumbs, right now', kind: 'instant' },
  { id: 'compound', icon: '👁️', name: 'Compound Eyes', desc: 'Another +10% range for every ant', kind: 'passive' },
  { id: 'wardrums', icon: '🥁', name: 'War Drums', desc: 'Another +10% attack speed', kind: 'passive' },
  { id: 'venom', icon: '☠️', name: 'Venom Coating', desc: 'Another +1 damage for every attacking ant', kind: 'passive' },
  { id: 'supply', icon: '🚚', name: 'Supply Lines', desc: '+40 sugar at the end of every round', kind: 'passive' },
  { id: 'feast', icon: '🥧', name: 'Royal Feast', desc: '+250 sugar and +10 crumbs, right now', kind: 'instant' },
  { id: 'tailwind', icon: '🍃', name: 'Tailwind', desc: 'Bugs march another 6% slower', kind: 'passive' },
];

export const ASCEND_COST = 3500;
