// ===== localStorage persistence: settings, best rounds, wins =====
const KEY = 'grubsTD.v1';

let cache = null;

export function loadSave() {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    cache = {};
  }
  cache.best = cache.best || {};        // { 'picnic:easy': 15 }
  cache.wins = cache.wins || {};        // { 'picnic:easy': true }
  cache.noLeakWins = cache.noLeakWins || {};
  cache.ach = cache.ach || {};          // { achievementId: true }
  cache.totalPops = cache.totalPops || 0;
  cache.seenBugs = cache.seenBugs || {};  // { typeId: true } — species intro cards shown
  cache.dailyBest = cache.dailyBest || {}; // { 'YYYY-MM-DD': bestRound }
  cache.dailyRival = cache.dailyRival || {}; // { 'YYYY-MM-DD': { beaten, score } } — local rival colony
  cache.dailyStreak = cache.dailyStreak || 0; // consecutive days the rival was beaten
  cache.nemesis = cache.nemesis || null;      // { name, emoji, defeats } — a crushed rival out for revenge
  cache.dailyRivalDef = cache.dailyRivalDef || null; // { date, rival } — today's rival, frozen at first sight
  cache.gamesPlayed = cache.gamesPlayed || 0;
  cache.gamesWon = cache.gamesWon || 0;
  cache.totalRounds = cache.totalRounds || 0;
  cache.muted = !!cache.muted;
  cache.musicMuted = !!cache.musicMuted;
  return cache;
}

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch { /* storage full/blocked: play on without saving */ }
}

export function recordBest(mapId, diffKey, round) {
  const s = loadSave();
  const k = `${mapId}:${diffKey}`;
  if ((s.best[k] || 0) < round) {
    s.best[k] = round;
    persist();
  }
}

export function recordWin(mapId, diffKey, noLeak = false) {
  const s = loadSave();
  s.wins[`${mapId}:${diffKey}`] = true;
  if (noLeak) s.noLeakWins[`${mapId}:${diffKey}`] = true;
  persist();
}

// 🥉 reach r20 · 🥈 win · 🥇 win without leaking — best across difficulties
export function medalForMap(mapId) {
  const s = loadSave();
  const on = (obj) => Object.keys(obj).some(k => k.startsWith(mapId + ':'));
  if (on(s.noLeakWins)) return 'gold';
  if (on(s.wins)) return 'silver';
  if (bestForMap(mapId) >= 20) return 'bronze';
  return null;
}

export function bankPops(n) {
  const s = loadSave();
  s.totalPops += n;
  persist();
}

export function bestForMap(mapId) {
  const s = loadSave();
  let best = 0;
  for (const k in s.best) {
    if (k.startsWith(mapId + ':')) best = Math.max(best, s.best[k]);
  }
  return best;
}

// total backyard stars: one per map×difficulty win — wins keys are exactly `${mapId}:${diff}`
export function backyardStars() {
  const s = loadSave();
  let n = 0;
  for (const k in s.wins) if (s.wins[k]) n++;
  return n;
}

export function bestAnywhere() {
  const s = loadSave();
  let best = 0;
  for (const k in s.best) best = Math.max(best, s.best[k]);
  return best;
}

export function setMutedPref(m) {
  const s = loadSave();
  s.muted = m;
  persist();
}

export function unlockAll() {
  const s = loadSave();
  s.best['debug:unlock'] = 40;
  persist();
}
