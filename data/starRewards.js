// ===== Star Rewards — the backyard-star track (⭐ = one per map×difficulty win, max 18) =====
// A track, not a shop: rewards unlock automatically at star thresholds. Nothing to spend.
export const STAR_REWARDS = [
  { at: 3,  id: 'sunnystart',     icon: '🌞', name: 'Sunny Start',     desc: '+25 starting sugar every run' },
  { at: 6,  id: 'crumbcushion',   icon: '🍞', name: 'Crumb Cushion',   desc: '+5 starting crumbs (not in Crumbs of Steel)' },
  { at: 9,  id: 'scoutseye',      icon: '🔭', name: "Scout's Eye",     desc: 'The wave preview also scouts the round after next' },
  { at: 12, id: 'goldenanthill',  icon: '🏅', name: 'Golden Anthill',  desc: 'Gold trim on the trail, a crown on the counter, a flag on the basket' },
  { at: 15, id: 'veterancolony',  icon: '⭐', name: 'Veteran Colony',  desc: 'Every placed ant starts with 25 layers of veterancy credit' },
  { at: 18, id: 'backyardlegend', icon: '🌾', name: 'Backyard Legend', desc: 'Golden logo, the Backyard Legend badge, all Honeypots +10% income' },
];
