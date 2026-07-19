// ===== DOM overlay: menu, HUD, shop, tower panel, modals, input =====
import { MAPS, WORLD_W, WORLD_H } from '../data/maps.js';
import { WAVES, freeplayRound, easyAdjust } from '../data/waves.js';
import { ENEMIES } from '../data/enemies.js';
import { TOWERS, TOWER_ORDER, SELL_RATIO } from '../data/towers.js';
import { HEROES, HERO_ORDER, XP_LEVELS, ABILITY_UNLOCK_LEVEL } from '../data/heroes.js';
import { Game } from './game.js';
import { bakeMap, drawTowerIcon, drawAnt } from './render.js';
import { MODES, MODE_LABEL, effDamage, isGroundOnly, recomputeStats } from './towers.js';

const TYPE_CHIP = {
  acid: '🧪 acid', crush: '💥 crush', explosion: '💣 blast', silk: '🕸️ silk', support: '✨ support',
};

function statBarHtml(label, val, max, text) {
  const pct = Math.max(0, Math.min(100, (val / max) * 100));
  return `<div class="stat-row mini"><span class="stat-name">${label}</span>
    <span class="stat-bar"><span class="stat-fill" style="width:${pct}%"></span></span>
    <span class="stat-val">${text}</span></div>`;
}

function towerStatsHtml(t) {
  const s = t.stats;
  if (!s.attack) {
    return s.income != null
      ? statBarHtml('Income', s.income, 500, `${s.income}/round`) + (s.interest ? statBarHtml('Interest', s.interest, 0.25, `${Math.round(s.interest * 100)}%`) : '')
      : statBarHtml('Aura', s.range, 260, `${Math.round(s.range)}`) + statBarHtml('Haste', s.auraRate || 1, 1.4, `+${Math.round(((s.auraRate || 1) - 1) * 100)}%`);
  }
  const dmg = effDamage(t);
  const shots = s.multishot || 1;
  const dps = s.attack === 'trap' ? (dmg * s.trapCharges) / s.cooldown : (dmg * shots) / s.cooldown;
  let html = statBarHtml('Damage', dmg, 15, String(dmg))
    + statBarHtml('Speed', 1 / s.cooldown, 4, `${(1 / s.cooldown).toFixed(1)}/s`)
    + statBarHtml('Range', s.range >= 9000 ? 260 : s.range, 260, s.range >= 9000 ? '∞' : String(Math.round(s.range)));
  if (s.pierce) html += statBarHtml('Pierce', s.pierce, 10, String(s.pierce));
  if (s.blast) html += statBarHtml('Blast', s.blast, 120, String(Math.round(s.blast)));
  if (s.slowPct) html += statBarHtml('Slow', s.slowPct, 0.8, `${Math.round(s.slowPct * 100)}%`);
  if (s.maxTargets) html += statBarHtml('Targets', s.maxTargets, 18, String(s.maxTargets));
  html += `<p class="pc-record">${'★'.repeat(t.stars || 0) || '☆'} · ${fmt(t.dealt || 0)} layers dealt · ≈${dps.toFixed(1)} dps</p>`;
  return html;
}
import { sfx, setMuted, isMuted, unlockAudio } from './sound.js';
import { ensureStarted, setIntensity, setMusicMuted, isMusicMuted, setMusicVolume, setMapTheme } from './music.js';
import { setSfxVolume } from './sound.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { bankPops, medalForMap } from './save.js';
import { RELICS } from '../data/relics.js';
import { PERKS } from '../data/perks.js';
import { STAR_REWARDS } from '../data/starRewards.js';
import { loadSave, persist, recordBest, recordWin, bestAnywhere, bestForMap, backyardStars, setMutedPref } from './save.js';
import { dist } from './util.js';
import { fmt, mulberry32 } from './util.js';

let game = null;
export const uiState = {
  placingType: null, placingDef: null,
  ghostX: null, ghostY: null, ghostValid: false,
  selected: null,
  casting: null, // 'rain' | 'guards'
};

let selMapId = 'picnic';
let selDiff = 'easy';
let dispSugar = null;    // tweened HUD sugar value
let coinsInFlight = 0;
let lastCoinT = 0;
let selHero = 'formica';
let loadoutOpen = false; // menu declutter: hero + challenges live in a collapsed section
const selMods = { steel: false, camo: false, speed: false, poverty: false };
const MOD_DEFS = [
  { id: 'steel', icon: '💀', name: 'Crumbs of Steel', desc: 'Start with a single crumb. One leak = over.' },
  { id: 'camo', icon: '🕶️', name: 'Camo Chaos', desc: 'Every bug is camouflaged.' },
  { id: 'speed', icon: '⚡', name: 'Speed Demon', desc: 'All bugs move 40% faster.' },
  { id: 'poverty', icon: '💸', name: 'Poverty Colony', desc: 'All sugar income halved.' },
];
let lastEndModal = null;
const els = {};
let shopCards = [];   // { el, typeId }
let panelDyn = [];    // dynamic-affordability upgrade buttons: { el, calc() }

export function getGame() { return game; }

export function setSpeed(n) {
  if (!game) return;
  game.speed = n;
  if (els.speed) els.speed.textContent = `${n}×`;
}

export function refreshAll() {
  renderPanel();
  refreshShop();
  renderMenu();
}

// ---------- boot ----------

export function init() {
  ['screen-menu', 'screen-game', 'map-cards', 'diff-row', 'btn-play', 'hud', 'shop', 'panel', 'modal', 'game-canvas', 'playfield']
    .forEach(id => { els[id.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = document.getElementById(id); });
  els.canvas = els.gameCanvas;

  const save = loadSave();
  setMuted(save.muted);
  setMusicMuted(save.musicMuted);
  setSfxVolume(save.sfxVol ?? 0.7);
  setMusicVolume(save.musicVol ?? 0.5);
  if (save.hero && HEROES[save.hero]) selHero = save.hero;

  buildHud();
  renderMenu();
  wireCanvas();
  wireKeys();

  els.btnPlay.addEventListener('click', () => {
    unlockAudio();
    const map = MAPS.find(m => m.id === selMapId) || MAPS[0];
    startGame(map, selDiff);
  });
  if (!els.forageBtn) {
    els.forageBtn = document.createElement('button');
    els.forageBtn.className = 'sticker big-btn forage-btn';
    els.forageBtn.textContent = '🌿 Foraging Run';
    els.forageBtn.title = 'Roguelite mode: start with 3 random ants, draft unlocks & relics after every round.';
    els.btnPlay.parentNode.insertBefore(els.forageBtn, els.btnPlay.nextSibling);
    els.forageBtn.addEventListener('click', () => {
      unlockAudio();
      const map = MAPS.find(m => m.id === selMapId) || MAPS[0];
      startGame(map, selDiff, null, true);
    });
  }
  if (!els.dailyBtn) {
    els.dailyBtn = document.createElement('button');
    els.dailyBtn.className = 'sticker big-btn daily-btn';
    els.dailyBtn.textContent = dailyBtnLabel(); // renderMenu keeps this fresh
    els.dailyBtn.title = 'A seeded run: same map, hero, challenges AND rival colony for everyone today. Local best is tracked per day.';
    els.dailyBtn.addEventListener('click', () => { unlockAudio(); showDaily(); });
    els.btnPlay.parentNode.insertBefore(els.dailyBtn, els.forageBtn.nextSibling);
  }
  // Colony Perks live on the title screen footer now (menu declutter).

  // ---- title screen: the front door ----
  ['screen-title', 'btn-title-play', 'title-newhint', 'btn-howto', 'btn-levels',
   'btn-menu-back', 'btn-title-ach', 'btn-title-stats', 'btn-title-perks', 'btn-title-sound']
    .forEach(id => { els[id.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = document.getElementById(id); });

  els.btnTitlePlay.addEventListener('click', () => {
    unlockAudio();
    const run = loadSave().run;
    if (run) {
      const map = MAPS.find(m => m.id === run.mapId);
      if (map) { startGame(map, run.diffKey, run); return; }
      clearRun();
    }
    // brand-new or quick play: jump straight into the selected map (defaults Picnic/Easy).
    // A first-timer's tutorialDone flag is false, so the guided coach runs automatically.
    const map = MAPS.find(m => m.id === selMapId) || MAPS[0];
    startGame(map, selDiff);
  });
  els.btnHowto.addEventListener('click', showHowToPlay);
  els.btnLevels.addEventListener('click', showLevels);
  els.btnMenuBack.addEventListener('click', showTitle);
  els.btnTitleAch.addEventListener('click', showAchievements);
  els.btnTitleStats.addEventListener('click', showLifetimeStats);
  els.btnTitlePerks.addEventListener('click', showPerks);
  els.btnTitleSound.addEventListener('click', () => { toggleMute(); refreshTitle(); });

  showTitle();
}

// ---- front-door screen routing ----
function refreshTitle() {
  const s = loadSave();
  const run = s.run;
  const brandNew = bestAnywhere() === 0 && !run;
  if (els.btnTitlePlay) {
    els.btnTitlePlay.textContent = run ? `▶ Resume — round ${run.round + 1}` : '▶ Play';
  }
  if (els.titleNewhint) els.titleNewhint.classList.toggle('hidden', !brandNew);
  if (els.btnTitleSound) els.btnTitleSound.textContent = isMuted() ? '🔇' : '🔊';
}

function showTitle() {
  game = null;
  hideModal();
  if (els.screenGame) els.screenGame.classList.add('hidden');
  if (els.screenMenu) els.screenMenu.classList.add('hidden');
  if (els.screenTitle) els.screenTitle.classList.remove('hidden');
  refreshTitle();
}

function showLevels() {
  if (els.screenTitle) els.screenTitle.classList.add('hidden');
  if (els.screenGame) els.screenGame.classList.add('hidden');
  els.screenMenu.classList.remove('hidden');
  renderMenu();
}

function showHowToPlay() {
  showModal(`
    <h2 class="modal-title">How to Play</h2>
    <div class="howto">
      <p><b>Goal:</b> keep the marching bugs from reaching your picnic basket at the end of the trail.</p>
      <p><b>🐜 Place ants</b> on the grass beside the trail. Each ant only hits bugs inside its
        range ring — spread them along the whole path.</p>
      <p><b>🍬 Sugar</b> is money: every bug you pop pays sugar. Spend it on more ants or upgrades.</p>
      <p><b>🍞 Crumbs</b> are your lives. A bug that reaches the basket costs you crumbs — run out and it's over.</p>
      <p><b>▶ Start</b> each round when your defenses are ready. Survive 40 rounds to win.</p>
      <p class="howto-tip">💡 First game? Just hit Play — the colony will coach you through your first round.</p>
    </div>`,
    [['Got it', hideModal], ['▶ Play now', () => { hideModal(); els.btnTitlePlay.click(); }]]);
}

// ---------- seeded daily challenge ----------

function dailyDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// the Rival Colony: an honestly-local nemesis, generated from the date seed —
// same name, face and round target for everyone playing the same day
const RIVAL_PLACES = ['Maple Street', 'Cedar Lane', 'Old Oak', 'Peppercorn', 'Windowsill',
  'Driveway', 'Clover Patch', 'Sandbox', 'Mailbox', 'Birdbath', 'Tool Shed', 'Rain Gutter'];
const RIVAL_KINDS = ['Mound', 'Colony', 'Nest', 'Swarm', 'Brood', 'Hill'];
const RIVAL_FACES = ['🐜', '🪳', '🦗', '🐛', '🕷️', '🐞'];
const RIVAL_TAUNTS = [
  'Our larvae march further than that.',
  'The aphids laughed when they heard.',
  'Is that all the sugar you could hold?',
  'We barely broke formation.',
  'Try again when your antennae grow in.',
];
// nemesis taunts escalate with how many times you've beaten them (index = defeats - 1)
const NEMESIS_TAUNTS = [
  'They remember yesterday. They want it back.',
  'Twice beaten, twice as angry.',
  'This is a grudge now.',
  'Their scouts watch your trail day and night.',
  'One more defeat and they may finally respect you.',
];
const NEMESIS_MAX_DEFEATS = 5; // beat them this many times and they retire in awe

// seed = YYYYMMDD → the same deterministic loadout for the whole day
function dailyLoadout() {
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const rng = mulberry32(seed);
  const map = MAPS[(rng() * MAPS.length) | 0];
  const heroId = HERO_ORDER[(rng() * HERO_ORDER.length) | 0];
  const deck = [...MOD_DEFS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const mods = deck.slice(0, 1 + (rng() < 0.35 ? 1 : 0));
  const date = dailyDateStr();
  // rival draws come AFTER the loadout draws so the map/hero/mods stay stable
  const s = loadSave();
  let rival;
  if (s.dailyRivalDef && s.dailyRivalDef.date === date) {
    // today's rival was already met — frozen so mid-day state changes (a crush that
    // spawns tomorrow's nemesis, a streak bump) never rewrite today's challenge
    rival = s.dailyRivalDef.rival;
  } else {
    const name = `The ${RIVAL_PLACES[(rng() * RIVAL_PLACES.length) | 0]} ${RIVAL_KINDS[(rng() * RIVAL_KINDS.length) | 0]}`;
    const emoji = RIVAL_FACES[(rng() * RIVAL_FACES.length) | 0];
    const base = 18 + Math.round(((rng() + rng()) / 2) * 16); // 18–34, weighted toward the middle
    const taunt = RIVAL_TAUNTS[(rng() * RIVAL_TAUNTS.length) | 0];
    const streakBonus = Math.min(12, 2 * (s.dailyStreak || 0)); // your streak raises the bar (cap +12)
    const nem = s.nemesis;
    if (nem) {
      // a crushed rival returns for revenge: same face, +3 target per prior defeat
      const revengeBonus = 3 * nem.defeats;
      rival = {
        name: nem.name, emoji: nem.emoji, nemesis: true, defeats: nem.defeats,
        base, streakBonus, revengeBonus, score: base + streakBonus + revengeBonus,
        taunt: NEMESIS_TAUNTS[Math.min(nem.defeats - 1, NEMESIS_TAUNTS.length - 1)],
      };
    } else {
      rival = { name, emoji, base, streakBonus, revengeBonus: 0, score: base + streakBonus, taunt };
    }
    s.dailyRivalDef = { date, rival };
    persist();
  }
  return { seed, date, map, heroId, mods, rival };
}

// "base 24 + streak bonus +4 + revenge +6" — the target math, shown honestly
function rivalMathStr(rv) {
  let str = `round ${rv.base}`;
  if (rv.streakBonus) str += ` + streak bonus ${rv.streakBonus}`;
  if (rv.revengeBonus) str += ` + revenge ${rv.revengeBonus}`;
  return str;
}

function showDaily() {
  const dl = dailyLoadout();
  const s = loadSave();
  const best = s.dailyBest[dl.date] || 0;
  const beaten = !!(s.dailyRival[dl.date] && s.dailyRival[dl.date].beaten);
  const rv = dl.rival;
  const math = rv.streakBonus || rv.revengeBonus ? ` <small>(${rivalMathStr(rv)})</small>` : '';
  const rivalLine = beaten
    ? `🏆 <b>RIVAL CRUSHED</b> — ${rv.emoji} ${rv.name} (round ${rv.score}) eats your dust.${rv.nemesis ? ' They\'ll be back…' : ''}`
    : rv.nemesis
      ? `😤 ${rv.emoji} <b>${rv.name}</b> RETURNS — beaten ${rv.defeats}×, they demand round <b>${rv.score}</b>${math}.<br><i>"${rv.taunt}"</i>`
      : `${rv.emoji} Beat <b>${rv.name}</b> — they reached round <b>${rv.score}</b>${math}.`;
  showModal(`
    <div class="modal-title">📅 DAILY RUN</div>
    <p>${dl.date} — one seeded loadout, the same all day. How far can the colony march?</p>
    <p class="modal-stats">🗺️ ${dl.map.name} · ⭐ ${HEROES[dl.heroId].name} · Medium</p>
    <p class="modal-stats">${dl.mods.map(m => `${m.icon} ${m.name}`).join(' · ')}</p>
    <p class="modal-stats rival-line">${rivalLine}</p>
    <p class="modal-stats">${best > 0 ? `Today's best: round <b>${best}</b>` : 'Not attempted today.'}
      ${s.dailyStreak > 0 ? ` · 🔥 ${s.dailyStreak}-day rival streak` : ''}</p>
    <p class="rival-note">A local rivalry — your rival colony is spun from today's seed, right here on this device.</p>`,
    [
      ['🐜 Start Daily', () => { hideModal(); startGame(dl.map, 'medium', null, false, dl); }],
      ['Close', hideModal],
    ]);
}

// judge the rivalry when a daily run ends (win, lose, or leaving to the menu)
let rivalJudgedRun = false;

function checkRivalOutcome() {
  if (!game || !game.mods.daily || rivalJudgedRun) return;
  const dl = dailyLoadout();
  if (dl.date !== game.mods.daily) return; // the run crossed midnight: yesterday's rival is gone
  rivalJudgedRun = true;
  const s = loadSave();
  const best = s.dailyBest[dl.date] || 0;
  const already = s.dailyRival[dl.date];
  if (already && already.beaten) return; // celebrated once today already
  const rv = dl.rival;
  if (best > rv.score) {
    // streak = consecutive days beaten (yesterday beaten keeps it alive)
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    s.dailyStreak = (s.dailyRival[yKey] && s.dailyRival[yKey].beaten ? s.dailyStreak : 0) + 1;
    s.dailyRival[dl.date] = { beaten: true, score: rv.score };
    if (rv.nemesis && s.nemesis) {
      // the nemesis falls again — they'll want an even higher bar tomorrow
      s.nemesis.defeats++;
      if (s.nemesis.defeats >= 3 && !s.ach.nemesis) {
        s.ach.nemesis = true;
        const a = ACHIEVEMENTS.find(x => x.id === 'nemesis');
        toast(`${a.icon} ${a.name}`, a.desc);
      }
      if (s.nemesis.defeats >= NEMESIS_MAX_DEFEATS) {
        toast(`🤝 ${rv.name} respects you`, `Beaten ${s.nemesis.defeats} times, they finally bow out. The backyard is yours.`);
        s.nemesis = null;
      }
    } else if (!rv.nemesis) {
      // crush a fresh rival and they come back tomorrow with a grudge
      s.nemesis = { name: rv.name, emoji: rv.emoji, defeats: 1 };
    }
    persist();
    toast('🏆 RIVAL CRUSHED', `${rv.emoji} ${rv.name} demanded round ${rv.score} — you reached ${best}. 🔥 ${s.dailyStreak}-day streak!`);
  } else {
    s.dailyRival[dl.date] = { beaten: false, score: rv.score };
    if (rv.nemesis) {
      // the nemesis finally wins one: they gloat, the streak dies, the feud ends
      s.nemesis = null;
      s.dailyStreak = 0;
      persist();
      toast(`${rv.emoji} ${rv.name} gloats and marches home`, `"Round ${rv.score} was too far for you." The feud is settled — a new rival prowls tomorrow.`);
    } else {
      persist();
      toast(`${rv.emoji} ${rv.name} holds the lead`, `"${rv.taunt}" — march past round ${rv.score} to crush them.`);
    }
  }
  if (els.dailyBtn) els.dailyBtn.textContent = dailyBtnLabel();
}

// menu button label: today's best + the rival streak flame + a returning nemesis
function dailyBtnLabel() {
  const s = loadSave();
  const db = s.dailyBest[dailyDateStr()] || 0;
  const nem = s.nemesis ? ` · 😤 ${s.nemesis.name.replace(/^The /, '')} returns` : '';
  return `📅 Daily Run${db > 0 ? ` · best r${db}` : ''}${s.dailyStreak > 0 ? ` · 🔥${s.dailyStreak}` : ''}${nem}`;
}

// ---------- menu ----------

function mapLocked(map) {
  return map.unlock && bestAnywhere() < map.unlock.best;
}

// ---- THE BACKYARD TRAIL: a journey view over the campaign (cards remain as a list toggle) ----
let mapView = 'trail'; // 'trail' | 'list'

// node centers as % of the trail strip, winding left → right across the backyard
const TRAIL_POS = {
  picnic: [8, 70], garden: [24, 26], kitchen: [42, 68], flowerbed: [59, 24], nightporch: [76, 66], bath: [92, 26],
};

// [background, trail-stroke] per map bg — shared by the card previews and trail emblems
const PREVIEW_COLORS = {
  picnic: ['#f3dfb8', '#a9713f'], garden: ['#79b45f', '#a9713f'], flowerbed: ['#7a4f33', '#a9713f'],
  night: ['#262138', '#5a5080'], bath: ['#b7dde0', '#8fb6bd'], kitchen: ['#dca868', '#ecdfb9'],
};

// one star per difficulty beaten (easy/medium/hard win) — read straight off save.wins
function starsForMap(mapId) {
  const s = loadSave();
  let n = 0;
  for (const d of ['easy', 'medium', 'hard']) if (s.wins[`${mapId}:${d}`]) n++;
  return n;
}

function traceTrail(c, pts) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    c.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
  }
  c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
}

function drawTrailPath(cv) {
  const c = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  const pts = MAPS.map(m => {
    const [px, py] = TRAIL_POS[m.id] || [50, 50];
    return [(px / 100) * W, (py / 100) * H];
  });
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = 'rgba(43,26,16,0.28)'; // worn dirt under-path
  c.lineWidth = 14;
  traceTrail(c, pts);
  c.stroke();
  c.strokeStyle = '#fff3d6'; // cream footstep dots
  c.lineWidth = 5;
  c.setLineDash([1, 14]);
  traceTrail(c, pts);
  c.stroke();
  c.setLineDash([]);
}

// the map's own preview drawing, scaled into a circular emblem
function drawTrailEmblem(cv, map, locked) {
  const c = cv.getContext('2d');
  const D = cv.width;
  const [bg, stroke] = PREVIEW_COLORS[map.bg] || PREVIEW_COLORS.kitchen;
  c.save();
  c.beginPath();
  c.arc(D / 2, D / 2, D / 2, 0, Math.PI * 2);
  c.clip();
  c.fillStyle = bg;
  c.fillRect(0, 0, D, D);
  const sx = D / WORLD_W, sy = D / WORLD_H;
  c.strokeStyle = stroke;
  c.lineWidth = 5;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  for (const pts of map.paths) {
    c.beginPath();
    c.moveTo(pts[0][0] * sx, pts[0][1] * sy);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0] * sx, pts[i][1] * sy);
    c.stroke();
  }
  if (locked) {
    c.fillStyle = 'rgba(43,26,16,0.55)';
    c.fillRect(0, 0, D, D);
  }
  c.restore();
}

function renderTrail() {
  els.trail.innerHTML = '';
  const cv = document.createElement('canvas');
  cv.width = 680;
  cv.height = 250;
  cv.className = 'trail-path';
  els.trail.appendChild(cv);
  drawTrailPath(cv);
  const totalStars = backyardStars();
  const goldTrim = totalStars >= 12; // Golden Anthill reward
  for (const map of MAPS) {
    const stars = starsForMap(map.id);
    const locked = mapLocked(map);
    const [px, py] = TRAIL_POS[map.id] || [50, 50];
    const best = bestForMap(map.id);
    const medal = medalForMap(map.id);
    const medalIcon = medal === 'gold' ? '🥇' : medal === 'silver' ? '🥈' : medal === 'bronze' ? '🥉' : '';
    const node = document.createElement('button');
    node.className = 'trail-node sticker' + (map.id === selMapId ? ' selected' : '') + (locked ? ' locked' : '') + (goldTrim ? ' gold' : '');
    node.style.left = px + '%';
    node.style.top = py + '%';
    node.title = locked ? `🔒 ${map.unlock.label}` : `${map.name} (${map.tag}) — ${map.blurb}`;
    node.innerHTML = `
      <canvas class="tn-emblem" width="76" height="76"></canvas>
      ${medalIcon ? `<span class="tn-medal">${medalIcon}</span>` : ''}
      ${locked ? '<span class="tn-lock">🔒</span>' : ''}
      <span class="tn-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>
      <span class="tn-name">${map.name}</span>
      <span class="tn-best">${locked ? map.unlock.label : best > 0 ? `best r${best}` : 'unexplored'}</span>`;
    drawTrailEmblem(node.querySelector('canvas'), map, locked);
    if (!locked) node.addEventListener('click', () => { selMapId = map.id; renderMenu(); });
    els.trail.appendChild(node);
  }
  els.trailStars.textContent = `${goldTrim ? '👑 ' : ''}⭐ ${totalStars}/${MAPS.length * 3} backyard stars`;
}

// ---- Star Rewards strip: the track under the trail — earned, never spent ----
function renderStarRewards() {
  if (!els.srStrip) return;
  const stars = backyardStars();
  const next = STAR_REWARDS.find(r => stars < r.at); // the one to chase
  let html = '<div class="sr-title">⭐ STAR REWARDS</div><div class="sr-chips">';
  for (const r of STAR_REWARDS) {
    const got = stars >= r.at;
    const cls = got ? 'got' : r === next ? 'next' : 'locked';
    html += `<div class="sr-chip sticker ${cls}" title="${r.desc}">
      <span class="sr-ico">${got ? r.icon : '🔒'}</span>
      <span class="sr-name">${r.name}</span>
      <span class="sr-at">${got ? '✔' : `⭐${r.at}`}</span></div>`;
  }
  html += '</div>';
  els.srStrip.innerHTML = html;
}

export function renderMenu() {
  if (!els.mapCards) return;
  // trail scaffolding: heading (title · star total · view toggle) + the journey strip
  if (!els.trailWrap) {
    els.trailWrap = document.createElement('div');
    els.trailWrap.id = 'trail-wrap';
    const head = document.createElement('div');
    head.className = 'trail-head';
    const title = document.createElement('span');
    title.className = 'trail-title';
    title.textContent = '🌾 THE BACKYARD TRAIL';
    els.trailStars = document.createElement('span');
    els.trailStars.className = 'trail-stars';
    els.viewToggle = document.createElement('button');
    els.viewToggle.className = 'sticker mini-btn view-toggle';
    els.viewToggle.addEventListener('click', () => {
      mapView = mapView === 'trail' ? 'list' : 'trail';
      renderMenu();
    });
    head.append(title, els.trailStars, els.viewToggle);
    const scroll = document.createElement('div');
    scroll.id = 'trail-scroll';
    els.trail = document.createElement('div');
    els.trail.id = 'trail';
    scroll.appendChild(els.trail);
    els.srStrip = document.createElement('div');
    els.srStrip.id = 'star-rewards';
    els.trailWrap.append(head, scroll, els.srStrip);
    els.mapCards.parentNode.insertBefore(els.trailWrap, els.mapCards);
  }
  els.viewToggle.textContent = mapView === 'trail' ? '🗂 card list' : '🗺 trail view';
  els.trail.parentNode.classList.toggle('hidden', mapView !== 'trail');
  els.mapCards.classList.toggle('hidden', mapView === 'trail');
  if (mapView === 'trail') renderTrail();
  renderStarRewards();
  // Backyard Legend (⭐18): the logo goes gold
  const logoEl = document.querySelector('.logo');
  if (logoEl) logoEl.classList.toggle('legend', backyardStars() >= 18);
  els.mapCards.innerHTML = '';
  for (const map of MAPS) {
    const locked = mapLocked(map);
    const card = document.createElement('button');
    card.className = 'map-card sticker' + (map.id === selMapId ? ' selected' : '') + (locked ? ' locked' : '');
    const best = bestForMap(map.id);
    const medal = medalForMap(map.id);
    const medalIcon = medal === 'gold' ? '🥇' : medal === 'silver' ? '🥈' : medal === 'bronze' ? '🥉' : '';
    const startHere = map.id === 'picnic' && bestAnywhere() === 0 ? '<div class="mc-start">START HERE</div>' : '';
    card.innerHTML = `${startHere}
      <canvas width="180" height="110"></canvas>
      <div class="mc-name">${map.name} <span class="mc-tag ${map.tag.toLowerCase()}">${map.tag}</span></div>
      <div class="mc-blurb">${locked ? '🔒 ' + map.unlock.label : map.blurb}</div>
      <div class="mc-best">${medalIcon} ${best > 0 ? `Best: round ${best}` : locked ? '' : 'Unexplored'}</div>`;
    drawMapPreview(card.querySelector('canvas'), map, locked);
    if (!locked) {
      card.addEventListener('click', () => { selMapId = map.id; renderMenu(); });
    }
    els.mapCards.appendChild(card);
  }
  els.diffRow.innerHTML = '';
  for (const key of ['easy', 'medium', 'hard']) {
    const b = document.createElement('button');
    b.className = 'diff-btn sticker' + (key === selDiff ? ' selected' : '');
    b.textContent = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }[key];
    b.addEventListener('click', () => { selDiff = key; renderMenu(); });
    els.diffRow.appendChild(b);
  }
  // collapsible "Loadout" section: hero picker + challenges tuck behind one sticker
  if (!els.loadoutWrap) {
    els.loadoutWrap = document.createElement('div');
    els.loadoutWrap.id = 'loadout';
    els.diffRow.parentNode.insertBefore(els.loadoutWrap, els.diffRow.nextSibling);
    els.loadoutBtn = document.createElement('button');
    els.loadoutBtn.className = 'sticker loadout-toggle';
    els.loadoutBtn.addEventListener('click', () => { loadoutOpen = !loadoutOpen; renderMenu(); });
    els.loadoutWrap.appendChild(els.loadoutBtn);
    els.loadoutBody = document.createElement('div');
    els.loadoutBody.className = 'loadout-body';
    els.loadoutWrap.appendChild(els.loadoutBody);
  }
  {
    const activeMods = MOD_DEFS.filter(m => selMods[m.id]);
    const modStr = activeMods.length
      ? `${activeMods.map(m => m.icon).join('')} ${activeMods.length} challenge${activeMods.length > 1 ? 's' : ''}`
      : 'no challenges';
    els.loadoutBtn.innerHTML = `${loadoutOpen ? '▾' : '▸'} LOADOUT — ⭐ ${HEROES[selHero].short || HEROES[selHero].name} · ${modStr}`;
    els.loadoutBtn.setAttribute('aria-expanded', String(loadoutOpen));
    els.loadoutBody.classList.toggle('open', loadoutOpen);
  }
  // hero picker
  if (!els.heroRow) {
    els.heroRow = document.createElement('div');
    els.heroRow.id = 'hero-row';
    els.loadoutBody.appendChild(els.heroRow);
  }
  // Achievements + Stats live on the title screen footer now (menu declutter).
  // resume a saved run
  const run = loadSave().run;
  if (!els.resumeBtn) {
    els.resumeBtn = document.createElement('button');
    els.resumeBtn.className = 'sticker big-btn resume-btn';
    els.btnPlay.parentNode.insertBefore(els.resumeBtn, els.btnPlay);
    els.resumeBtn.addEventListener('click', () => {
      const r = loadSave().run;
      if (!r) return;
      const map = MAPS.find(m => m.id === r.mapId);
      if (!map) { clearRun(); renderMenu(); return; }
      unlockAudio();
      startGame(map, r.diffKey, r);
    });
  }
  if (run) {
    const runMap = MAPS.find(m => m.id === run.mapId);
    els.resumeBtn.classList.remove('hidden');
    els.resumeBtn.textContent = `▶ Resume ${runMap ? runMap.name : '?'} — round ${run.round + 1}`;
  } else {
    els.resumeBtn.classList.add('hidden');
  }
  if (els.dailyBtn) els.dailyBtn.textContent = dailyBtnLabel();
  els.heroRow.innerHTML = '<div class="hero-row-title">CHOOSE YOUR HERO</div>';
  for (const hid of HERO_ORDER) {
    const h = HEROES[hid];
    const card = document.createElement('button');
    card.className = 'hero-card sticker' + (hid === selHero ? ' selected' : '');
    card.title = h.blurb;
    card.innerHTML = `<canvas width="48" height="48"></canvas>
      <div><div class="hc-name">${h.name}</div>
      <div class="hc-blurb">${h.blurb}</div>
      <div class="hc-ab">⚡ ${h.ability.name} — ${h.ability.desc}</div></div>`;
    drawHeroIcon(card.querySelector('canvas').getContext('2d'), h);
    card.addEventListener('click', () => { selHero = hid; renderMenu(); });
    els.heroRow.appendChild(card);
  }
  // challenge chips
  if (!els.modRow) {
    els.modRow = document.createElement('div');
    els.modRow.id = 'mod-row';
    els.loadoutBody.appendChild(els.modRow);
  }
  els.modRow.innerHTML = '<div class="hero-row-title">CHALLENGES (optional)</div>';
  for (const m of MOD_DEFS) {
    const chip = document.createElement('button');
    chip.className = 'mod-chip sticker' + (selMods[m.id] ? ' selected' : '');
    chip.title = m.desc;
    chip.innerHTML = `${m.icon} ${m.name}<small class="mod-desc">${m.desc}</small>`;
    chip.addEventListener('click', () => { selMods[m.id] = !selMods[m.id]; renderMenu(); });
    els.modRow.appendChild(chip);
  }
}

function drawHeroIcon(c, heroDef, size = 48) {
  c.clearRect(0, 0, size, size);
  drawAnt(c, 'hero', heroDef, { x: size / 2, y: size / 2 + 4, scale: size / 68, time: 0, hero: heroDef.id });
}

function drawMapPreview(cv, map, locked) {
  const c = cv.getContext('2d');
  const sx = cv.width / WORLD_W, sy = cv.height / WORLD_H;
  const [bg, stroke] = PREVIEW_COLORS[map.bg] || PREVIEW_COLORS.kitchen;
  c.fillStyle = bg;
  c.fillRect(0, 0, cv.width, cv.height);
  c.strokeStyle = stroke;
  c.lineWidth = 7;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  for (const pts of map.paths) {
    c.beginPath();
    c.moveTo(pts[0][0] * sx, pts[0][1] * sy);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0] * sx, pts[i][1] * sy);
    c.stroke();
  }
  if (locked) {
    c.fillStyle = 'rgba(43,26,16,0.55)';
    c.fillRect(0, 0, cv.width, cv.height);
  }
}

// ---------- game lifecycle ----------

// ---- royal jelly economy ----
function jellyEarned() {
  const s = loadSave();
  let j = Object.keys(s.ach).filter(k => s.ach[k]).length;
  for (const m of MAPS) {
    const medal = medalForMap(m.id);
    j += medal === 'gold' ? 3 : medal === 'silver' ? 2 : medal === 'bronze' ? 1 : 0;
  }
  return j;
}

function jellyAvailable() {
  const s = loadSave();
  let spent = 0;
  for (const p of PERKS) spent += (s.perks && s.perks[p.id] || 0) * p.cost;
  return jellyEarned() - spent;
}

function showPerks() {
  const s = loadSave();
  s.perks = s.perks || {};
  let html = `<div class="modal-title">🍯 COLONY PERKS</div>
    <p>Royal Jelly: <b>${jellyAvailable()}</b> available (earned from achievements & map medals). Perks apply to every future run.</p>
    <div class="ach-list">`;
  for (const p of PERKS) {
    const lvl = s.perks[p.id] || 0;
    const dots = '●'.repeat(lvl) + '○'.repeat(p.max - lvl);
    const can = lvl < p.max && jellyAvailable() >= p.cost;
    html += `<div class="ach-item ${lvl > 0 ? 'got' : ''}"><span class="ach-ico">${p.icon}</span>
      <div style="flex:1"><b>${p.name}</b> <span class="perk-dots">${dots}</span><br><small>${p.desc}</small></div>
      <button class="sticker mini-btn perk-buy" data-perk="${p.id}" ${can ? '' : 'disabled'}>🍯 ${p.cost}</button></div>`;
  }
  html += '</div>';
  showModal(html, [['Close', hideModal]]);
  document.querySelectorAll('.perk-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = PERKS.find(x => x.id === btn.dataset.perk);
      const sv = loadSave();
      sv.perks = sv.perks || {};
      const lvl = sv.perks[p.id] || 0;
      if (lvl >= p.max || jellyAvailable() < p.cost) { sfx.deny(); return; }
      sv.perks[p.id] = lvl + 1;
      persist();
      sfx.upgrade();
      showPerks();
    });
  });
}

// ---- Foraging Run draft ----
function showDraft() {
  if (!game || !game.mods.forage) return;
  game.draftPending = true;
  const locked = TOWER_ORDER.filter(t => !game.unlockedTypes.has(t));
  const unownedRelics = RELICS.filter(r => !game.relics[r.id]);
  const picks = [];
  if (locked.length) {
    const t = locked[(Math.random() * locked.length) | 0];
    picks.push({ kind: 'tower', typeId: t });
  }
  for (const r of [...unownedRelics].sort(() => Math.random() - 0.5)) {
    if (picks.length >= 2) break;
    picks.push({ kind: 'relic', relic: r });
  }
  while (picks.length < 3) picks.push({ kind: 'sugar', amt: 150 + game.round * 8 });
  let html = `<div class="modal-title">🌿 FORAGE</div><p>The scouts brought options. Pick one.</p><div class="draft-row">`;
  picks.forEach((p, i) => {
    if (p.kind === 'tower') {
      const def = TOWERS[p.typeId];
      html += `<button class="draft-card sticker" data-i="${i}"><div class="dc-ico">🔓</div><b>${def.name}</b><small>Unlock this ant for the run</small></button>`;
    } else if (p.kind === 'relic') {
      html += `<button class="draft-card sticker" data-i="${i}"><div class="dc-ico">${p.relic.icon}</div><b>${p.relic.name}</b><small>${p.relic.desc}</small></button>`;
    } else {
      html += `<button class="draft-card sticker" data-i="${i}"><div class="dc-ico">🍬</div><b>Sugar Cache</b><small>+${p.amt} sugar now</small></button>`;
    }
  });
  html += '</div>';
  showModal(html, []);
  document.querySelectorAll('.draft-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = picks[+btn.dataset.i];
      if (p.kind === 'tower') game.unlockTowerType(p.typeId);
      else if (p.kind === 'relic') game.addRelic(p.relic);
      else { game.sugar += p.amt; game.stats.earned += p.amt; }
      game.draftPending = false;
      sfx.buy();
      hideModal();
      renderShop();
      renderPanel();
      saveRun();
    });
  });
}

function saveRun() {
  if (!game || game.state === 'lost' || game.state === 'won') return;
  const s = loadSave();
  s.run = {
    mapId: game.map.id,
    diffKey: game.diffKey,
    heroId: game.heroDef ? game.heroDef.id : null,
    mods: { ...game.mods },
    ...game.snapshot(),
  };
  persist();
}

function clearRun() {
  const s = loadSave();
  s.run = null;
  persist();
}

export function startGame(mapDef, diffKey, snap = null, forage = false, daily = null) {
  const save = loadSave();
  save.hero = selHero;
  if (!snap) save.gamesPlayed++; // lifetime stats: resumes aren't new games
  persist();
  setMapTheme(mapDef.id); // per-map music identity
  const heroDef = snap ? (snap.heroId ? HEROES[snap.heroId] : null)
    : daily ? HEROES[daily.heroId] : HEROES[selHero];
  const mods = snap ? (snap.mods || {})
    : daily
      ? { ...Object.fromEntries(daily.mods.map(m => [m.id, true])), perks: { ...(save.perks || {}) }, stars: backyardStars(), daily: daily.date }
      : { ...selMods, forage, perks: { ...(save.perks || {}) }, stars: backyardStars() };
  game = new Game(mapDef, diffKey, {
    onChange() { renderPanel(); refreshShop(); if (game && game.state === 'idle') saveRun(); },
    onRoundEnd(round) {
      recordBest(mapDef.id, diffKey, round);
      if (game.mods.daily) { // daily run: local per-date best
        const sv = loadSave();
        if ((sv.dailyBest[game.mods.daily] || 0) < round) sv.dailyBest[game.mods.daily] = round;
      }
      loadSave().totalRounds++; // persisted by bankPops right below
      bankPops(game.stats.pops - game.popsBanked);
      game.popsBanked = game.stats.pops;
      checkAchievements(false);
      saveRun();
      if (game.mods.forage && game.state === 'idle') showDraft();
    },
    onWin() {
      loadSave().gamesWon++; // persisted by recordWin right below
      const starsBefore = backyardStars();
      recordWin(mapDef.id, diffKey, game.stats.leaks === 0);
      // Star Rewards: a win that crosses a threshold announces its unlock
      const starsAfter = backyardStars();
      for (const r of STAR_REWARDS) {
        if (starsBefore < r.at && starsAfter >= r.at) {
          toast(`${r.icon} STAR REWARD — ${r.name}`, `⭐${r.at} backyard stars: ${r.desc}`);
        }
      }
      checkAchievements(true);
      checkRivalOutcome(); // daily runs: settle the rivalry
      const wonMedal = medalForMap(mapDef.id);
      const medalStr = wonMedal === 'gold' ? '🥇 GOLD' : wonMedal === 'silver' ? '🥈 SILVER' : '🥉 BRONZE';
      lastEndModal = () => showModal(`
        <div class="modal-title win">STASH DEFENDED!</div>
        <p>The Hornet Queen is popped. 40 rounds survived on ${mapDef.name} (${DIFF_LABEL[diffKey]}).</p>
        <p class="modal-stats">${medalStr} medal · 🎈 ${fmt(game.stats.pops)} layers popped · 🍞 ${game.crumbs} crumbs left</p>`,
        [
          ['Keep going — freeplay!', () => { game.continueFreeplay(); hideModal(); }],
          ['📊 Colony report', showStats],
          ['Back to menu', toMenu],
        ]);
      lastEndModal();
    },
    onLose() {
      clearRun();
      checkRivalOutcome(); // daily runs: settle the rivalry
      lastEndModal = () => showModal(`
        <div class="modal-title lose">THE SUGAR IS GONE</div>
        <p>The bugs broke through on round ${game.round} of ${mapDef.name}.</p>
        <p class="modal-stats">🎈 ${fmt(game.stats.pops)} layers popped before the fall</p>
        ${leakBreakdown(game.leakTotals) ? `<p class="modal-stats">🕳️ Leaked: ${leakBreakdown(game.leakTotals)}</p>` : ''}`,
        [
          ['Try again', () => startGame(mapDef, diffKey)],
          ['📊 Colony report', showStats],
          ['Back to menu', toMenu],
        ]);
      lastEndModal();
    },
  }, heroDef, mods);
  if (snap) game.applySnapshot(snap);
  rivalJudgedRun = false; // a fresh run gets one rivalry verdict of its own
  bakeMap(game);
  uiState.selected = null;
  stopPlacing();
  hideModal();
  if (els.screenTitle) els.screenTitle.classList.add('hidden');
  els.screenMenu.classList.add('hidden');
  els.screenGame.classList.remove('hidden');
  setSpeed(1);
  game.autoStart = els.chkAuto.checked; // carry the visible toggle into the new game
  dispSugar = null;
  renderShop();
  renderPanel();
}

// a sugar spark arcs from the pop to the HUD counter
function spawnCoinFly(wx, wy) {
  const canvasR = els.canvas.getBoundingClientRect();
  const fieldR = els.playfield.getBoundingClientRect();
  const chip = els.sugarVal && els.sugarVal.closest('.hud-chip');
  if (!chip || canvasR.width === 0) return;
  const chipR = chip.getBoundingClientRect();
  const sx = canvasR.left - fieldR.left + wx * canvasR.width / WORLD_W;
  const sy = canvasR.top - fieldR.top + wy * canvasR.height / WORLD_H;
  const dx = (chipR.left - fieldR.left + chipR.width / 2) - sx;
  const dy = (chipR.top - fieldR.top + chipR.height / 2) - sy;
  const el = document.createElement('div');
  el.className = 'coin-fly';
  el.style.left = sx + 'px';
  el.style.top = sy + 'px';
  els.playfield.appendChild(el);
  coinsInFlight++;
  const anim = el.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 46}px) scale(1.2)`, opacity: 1, offset: 0.4 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.65)`, opacity: 0.9 },
  ], { duration: 520, easing: 'cubic-bezier(0.45, 0, 0.9, 0.55)' });
  anim.onfinish = () => {
    el.remove();
    coinsInFlight = Math.max(0, coinsInFlight - 1);
    chip.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 160, easing: 'ease-out' });
    sfx.coin();
  };
}

function toMenu() {
  checkRivalOutcome(); // leaving a daily run mid-flight still settles the rivalry
  stopPlacing();
  uiState.selected = null;
  renderMenu(); // keep the levels screen fresh (best rounds, medals, resume) for when it's opened
  showTitle();  // land on the clean front door, not the dense levels screen
}

const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

// "8× Wasp, 3× Hopper" from a {typeName: count} tally
function leakBreakdown(tally) {
  const rows = Object.entries(tally || {}).sort((a, b) => b[1] - a[1]);
  return rows.length ? rows.map(([n, c]) => `${c}× ${n}`).join(', ') : '';
}

// ---------- HUD ----------

function buildHud() {
  els.hud.innerHTML = `
    <div class="hud-chip sugar" title="Sugar — spend it on ants">🍬 <b id="hud-sugar-val">0</b></div>
    <div class="hud-chip crumbs" title="Crumbs — your lives">🍞 <b id="hud-crumbs-val">0</b></div>
    <div class="hud-chip round" title="Round">🌊 <b id="hud-round-val">1/40</b></div>
    <button id="btn-start" class="sticker hud-btn primary">▶ Start round 1</button>
    <label class="hud-auto" title="Auto-start the next round"><input type="checkbox" id="chk-auto"> auto</label>
    <button id="btn-ability" class="sticker hud-btn ability hidden" title="Hero ability (A)">⚡</button>
    <button id="btn-ability2" class="sticker hud-btn ability hidden" title="Second hero ability (S) — unlocks at hero level 7">✨</button>
    <button id="btn-rain" class="sticker hud-btn power" title="Acid Rain (Q) — drop an acid strike anywhere. Armored bugs shrug it off.">☄️</button>
    <button id="btn-guards" class="sticker hud-btn power" title="Guard Detail (E) — soldier ants hold a spot for 8s, biting and stalling ground bugs.">🛡️</button>
    <button id="btn-decoy" class="sticker hud-btn power decoy" title="Sugar Decoy (D) — drop a sugar cube on the grass: ground bugs stop and eat it until it crumbles. Max 2 out; bosses and flyers ignore it.">🧊</button>
    <div class="hud-spacer"></div>
    <button id="btn-speed" class="sticker hud-btn" title="Game speed (F)">1×</button>
    <button id="btn-pause" class="sticker hud-btn" title="Pause (P)">⏸</button>
    <button id="btn-music" class="sticker hud-btn" title="Music on/off">${isMusicMuted() ? '🔕' : '🎵'}</button>
    <button id="btn-mute" class="sticker hud-btn" title="Mute SFX (M)">${isMuted() ? '🔇' : '🔊'}</button>
    <button id="btn-menu" class="sticker hud-btn" title="Back to menu">🏠</button>`;
  els.sugarVal = document.getElementById('hud-sugar-val');
  els.crumbsVal = document.getElementById('hud-crumbs-val');
  els.roundVal = document.getElementById('hud-round-val');
  els.btnStart = document.getElementById('btn-start');
  els.speed = document.getElementById('btn-speed');
  els.chkAuto = document.getElementById('chk-auto');

  els.btnAbility = document.getElementById('btn-ability');
  els.btnAbility.addEventListener('click', () => { unlockAudio(); if (game) game.useAbility(); });
  els.btnAbility2 = document.getElementById('btn-ability2');
  els.btnAbility2.addEventListener('click', () => { unlockAudio(); if (game) game.useAbility2(); });
  els.btnRain = document.getElementById('btn-rain');
  els.btnGuards = document.getElementById('btn-guards');
  els.btnDecoy = document.getElementById('btn-decoy');
  els.btnRain.addEventListener('click', () => beginCast('rain'));
  els.btnGuards.addEventListener('click', () => beginCast('guards'));
  els.btnDecoy.addEventListener('click', () => beginCast('decoy'));
  els.btnStart.addEventListener('click', () => {
    unlockAudio();
    const a = coachAllow();
    if (a !== null && a !== 'start') return; // guided tutorial: finish the setup steps first
    if (game) game.startRound();
  });
  els.chkAuto.addEventListener('change', () => { if (game) game.autoStart = els.chkAuto.checked; });
  els.speed.addEventListener('click', cycleSpeed);
  document.getElementById('btn-pause').addEventListener('click', togglePause);
  document.getElementById('btn-mute').addEventListener('click', toggleMute);
  document.getElementById('btn-music').addEventListener('click', () => {
    unlockAudio();
    const m = !isMusicMuted();
    setMusicMuted(m);
    const s = loadSave();
    s.musicMuted = m;
    persist();
    document.getElementById('btn-music').textContent = m ? '🔕' : '🎵';
  });
  document.getElementById('btn-menu').addEventListener('click', toMenu);
}

function cycleSpeed() {
  if (!game) return;
  setSpeed(game.speed >= 3 ? 1 : 3);
}

function togglePause() {
  if (!game || game.state === 'lost' || game.state === 'won') return;
  game.paused = !game.paused;
  if (game.paused) {
    showModal(`<div class="modal-title">PAUSED</div><p>The bugs wait for no ant… except now.</p>`,
      [
        ['Resume', () => { game.paused = false; hideModal(); }],
        ['🔁 Restart run', () => { const m = game.map, d = game.diffKey; clearRun(); startGame(m, d); }],
        ['⚙️ Settings', showSettings],
        ['Back to menu', toMenu],
      ]);
  } else {
    hideModal();
  }
}

function showSettings() {
  const s = loadSave();
  showModal(`
    <div class="modal-title">⚙️ SETTINGS</div>
    <div class="set-row"><span>🔊 Effects</span><input id="set-sfx" type="range" min="0" max="100" value="${Math.round((s.sfxVol ?? 0.7) * 100)}"></div>
    <div class="set-row"><span>🎵 Music</span><input id="set-music" type="range" min="0" max="100" value="${Math.round((s.musicVol ?? 0.5) * 100)}"></div>`,
    [['Done', () => { if (game && game.paused) togglePause(); else hideModal(); }]]);
  document.getElementById('set-sfx').addEventListener('input', (e) => {
    const v = e.target.value / 100;
    setSfxVolume(v);
    const sv = loadSave(); sv.sfxVol = v; persist();
    sfx.pop();
  });
  document.getElementById('set-music').addEventListener('input', (e) => {
    const v = e.target.value / 100;
    setMusicVolume(v);
    const sv = loadSave(); sv.musicVol = v; persist();
  });
}

function toggleMute() {
  const m = !isMuted();
  setMuted(m);
  setMutedPref(m);
  const btn = document.getElementById('btn-mute');
  if (btn) btn.textContent = m ? '🔇' : '🔊';
}

export function tick() {
  if (!game || !els.sugarVal) return;
  // counter counts up/down instead of snapping
  if (dispSugar == null) dispSugar = game.sugar;
  const dSugar = game.sugar - dispSugar;
  dispSugar = Math.abs(dSugar) < 1 ? game.sugar : dispSugar + dSugar * 0.18;
  els.sugarVal.textContent = fmt(dispSugar);
  // batched coin-fly from recent pops
  if (game.coinAmt > 0 && coinsInFlight < 5 && performance.now() - lastCoinT > 110 && !els.screenGame.classList.contains('hidden')) {
    spawnCoinFly(game.coinX, game.coinY);
    game.coinAmt = 0;
    lastCoinT = performance.now();
  }
  els.crumbsVal.textContent = fmt(game.crumbs);
  els.roundVal.textContent = game.round <= 40 && !game.freeplay
    ? `${game.state === 'inround' ? game.round : Math.min(game.round + 1, 40)}/40`
    : `${game.state === 'inround' ? game.round : game.round + 1} ∞`;
  const idle = game.state === 'idle';
  // guided tutorial: which single action is allowed right now ('hero'|'worker'|'start'|null)
  const gate = coachAllow();
  els.btnStart.disabled = !idle || (gate !== null && gate !== 'start');
  els.btnStart.textContent = idle ? `▶ Start round ${game.round + 1}` : `Round ${game.round} — fight!`;
  els.btnStart.classList.toggle('pulse', idle && game.round > 0 && !game.autoStart);
  const heroCard = els.shop && els.shop.querySelector('.hero-deploy');
  if (heroCard) heroCard.classList.toggle('coach-locked', gate !== null && gate !== 'hero');
  for (const { el, typeId } of shopCards) {
    el.classList.toggle('poor', game.sugar < game.cost(typeId));
    // during the guided tutorial, lock every card except the one the step calls for
    el.classList.toggle('coach-locked', gate !== null && !(gate === 'worker' && typeId === 'worker'));
  }
  // hero ability button
  if (els.btnAbility) {
    const st = game.heroAbilityState();
    els.btnAbility.classList.toggle('hidden', st.status === 'none');
    if (st.status !== 'none') {
      const ab = game.heroDef.ability;
      els.btnAbility.disabled = st.status !== 'ready';
      els.btnAbility.classList.toggle('pulse', st.status === 'ready');
      els.btnAbility.textContent =
        st.status === 'locked' ? '⚡ Lv3' :
        st.status === 'cooldown' ? `⚡ ${Math.ceil(st.t)}s` :
        `⚡ ${ab.name}`;
    }
  }
  // second hero ability (appears once the hero reaches L7)
  if (els.btnAbility2) {
    const st2 = game.heroAbility2State();
    const visible = st2.status !== 'none' && st2.status !== 'locked';
    els.btnAbility2.classList.toggle('hidden', !visible);
    if (visible) {
      const ab2 = game.heroDef.ability2;
      els.btnAbility2.disabled = st2.status !== 'ready';
      els.btnAbility2.classList.toggle('pulse', st2.status === 'ready');
      els.btnAbility2.textContent =
        st2.status === 'cooldown' ? `✨ ${Math.ceil(st2.t)}s` : `✨ ${ab2.name}`;
      els.btnAbility2.title = `${ab2.name} (S) — ${ab2.desc}`;
    }
  }
  // colony power buttons
  if (els.btnRain) {
    for (const [el, kind, label] of [[els.btnRain, 'rain', '☄️'], [els.btnGuards, 'guards', '🛡️']]) {
      const cd = game.powerCd[kind];
      el.disabled = cd > 0;
      el.classList.toggle('casting', uiState.casting === kind);
      el.textContent = cd > 0 ? `${label} ${Math.ceil(cd)}s` : label;
    }
  }
  // sugar-decoy consumable: cost display, active count, no cooldown
  if (els.btnDecoy) {
    const active = game.decoys.length;
    els.btnDecoy.disabled = !game.canDecoy();
    els.btnDecoy.classList.toggle('casting', uiState.casting === 'decoy');
    els.btnDecoy.textContent = active >= 2 ? '🧊 max' : `🧊 ${game.decoyCost()}`;
  }
  updateCoach();
  updateCamoCoach();
  updateDecoyCoach();
  updateBugCards();
  // adaptive music intensity
  ensureStarted();
  if (game.state !== 'inround') setIntensity(0);
  else if (game.enemies.some(e => !e.dead && e.type.boss)) setIntensity(3);
  else if (game.enemies.length > 25) setIntensity(2);
  else setIntensity(1);
  for (const d of panelDyn) d();
}

// ---------- first-run coach marks ----------
let coachStep = -1;

// The guided tutorial's gate: the single action allowed right now, or null when the
// tutorial is inactive / mid-combat (nothing locked). Pure function of game state, so
// the shop lock, Start button, placement and hotkeys all agree without ordering bugs.
function coachAllow() {
  if (!game || els.screenGame.classList.contains('hidden')) return null;
  if (loadSave().tutorialDone) return null;
  if (game.mods && (game.mods.forage || game.mods.daily)) return null;
  if (game.heroDef && !game.hero) return 'hero';
  const ants = game.towers.reduce((n, t) => n + (t === game.hero ? 0 : 1), 0);
  if (ants < 2 && game.round === 0) return 'worker';
  if (game.round === 0 && game.state === 'idle') return 'start';
  return null; // first round underway / scouting / done — hands off
}

function removeCoach() {
  const el = document.getElementById('coach');
  if (el) el.remove();
  const spot = document.getElementById('coach-spot');
  if (spot) spot.remove();
  coachStep = -1;
}

// A guided, spotlit first-run tutorial: each step dims the board and glows the one
// thing to touch next, gating on real game state (placements, Start, first pops)
// so a new player learns range and the sugar economy by doing, not by reading.
function updateCoach() {
  const s = loadSave();
  if (s.tutorialDone || !game || els.screenGame.classList.contains('hidden')) { removeCoach(); return; }
  // Only the plain campaign start teaches; forage drafts and the daily skip it.
  if (game.mods && (game.mods.forage || game.mods.daily)) { removeCoach(); return; }

  // the hero is stored among game.towers — count only the ants the player has bought
  const antCount = game.towers.reduce((n, t) => n + (t === game.hero ? 0 : 1), 0);
  let step, text, target, dim = true;
  if (game.heroDef && !game.hero) {
    step = 0;
    text = '⭐ Your hero fights FREE. Click the gold card, then tap the grass to deploy.';
    target = document.querySelector('.hero-deploy');
  } else if (antCount === 0) {
    step = 1;
    text = '🐜 Tap Worker Ant, then tap the grass by the trail. Ants only pop bugs inside their range ring.';
    target = document.querySelector('.shop-card:not(.hero-deploy)');
  } else if (antCount === 1 && game.round === 0) {
    step = 2;
    text = '🎯 One ant can’t guard the whole march. Place a second Worker farther down the trail.';
    target = document.querySelector('.shop-card:not(.hero-deploy)');
  } else if (game.round === 0 && game.state === 'idle') {
    step = 3;
    text = '▶ Press Start (or Space) to release the first wave!';
    target = els.btnStart;
  } else if (game.round === 1 && game.state === 'inround') {
    step = 4;
    text = '🍬 Each bug you pop pays sugar — that’s how you afford more ants. Watch it climb!';
    target = els.sugarVal ? els.sugarVal.closest('.hud-chip') : null;
    dim = false; // never darken the board mid-fight
  } else if (game.round === 1 && game.state === 'idle') {
    step = 5;
    text = '🔭 Scout the next wave here, then spend your sugar on upgrades or new ants. The colony’s yours!';
    target = document.querySelector('.wave-preview');
  } else {
    s.tutorialDone = true;
    persist();
    removeCoach();
    return;
  }
  if (!target) { removeCoach(); return; }

  let el = document.getElementById('coach');
  if (!el) {
    el = document.createElement('div');
    el.id = 'coach';
    el.className = 'sticker';
    document.body.appendChild(el);
  }
  let spot = document.getElementById('coach-spot');
  if (dim && !spot) {
    spot = document.createElement('div');
    spot.id = 'coach-spot';
    document.body.appendChild(spot);
  } else if (!dim && spot) {
    spot.remove();
    spot = null;
  }

  if (coachStep !== step) {
    coachStep = step;
    el.textContent = text;
    // bring the pointed-at element on screen (stacked layouts push the panel below the fold)
    if (target.scrollIntoView) {
      const r = target.getBoundingClientRect();
      if (r.bottom > window.innerHeight || r.top < 0) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  const r = target.getBoundingClientRect();
  el.style.left = Math.max(8, Math.min(window.innerWidth - 250, r.left + r.width / 2 - 120)) + 'px';
  el.style.top = Math.min(window.innerHeight - 90, r.bottom + 12) + 'px';
  if (spot) {
    const pad = 8;
    spot.style.left = (r.left - pad) + 'px';
    spot.style.top = (r.top - pad) + 'px';
    spot.style.width = (r.width + pad * 2) + 'px';
    spot.style.height = (r.height + pad * 2) + 'px';
  }
}

// one-time nudge on the camo debut: point at the Beacon card if the player owns none
let camoCoachUntil = 0;

function updateCamoCoach() {
  const el = document.getElementById('coach-camo');
  const gone = !game || els.screenGame.classList.contains('hidden');
  if (el) {
    if (gone || performance.now() > camoCoachUntil || game.towers.some(t => t.typeId === 'beacon')) el.remove();
    return;
  }
  if (gone) return;
  const s = loadSave();
  if (s.camoCoachDone || game.state !== 'inround' || game.round < 8) return;
  if (!game.spawnQueue.some(ev => ev.camo)) return; // camo debut round only
  s.camoCoachDone = true;
  persist();
  if (game.towers.some(t => t.typeId === 'beacon')) return; // already covered
  const card = shopCards.find(c => c.typeId === 'beacon');
  if (!card) return;
  const bubble = document.createElement('div');
  bubble.id = 'coach-camo';
  bubble.className = 'sticker';
  bubble.textContent = '🕶️ Camo bugs ahead — Beacons reveal them!';
  document.body.appendChild(bubble);
  const r = card.el.getBoundingClientRect();
  bubble.style.left = Math.max(8, Math.min(window.innerWidth - 250, r.left + r.width / 2 - 120)) + 'px';
  bubble.style.top = Math.min(window.innerHeight - 80, r.bottom + 8) + 'px';
  camoCoachUntil = performance.now() + 8000;
}

// one-time nudge the first time the Sugar Decoy becomes affordable
let decoyCoachUntil = 0;

function updateDecoyCoach() {
  const el = document.getElementById('coach-decoy');
  const gone = !game || els.screenGame.classList.contains('hidden');
  if (el) {
    if (gone || performance.now() > decoyCoachUntil) el.remove();
    return;
  }
  if (gone || !els.btnDecoy) return;
  const s = loadSave();
  if (s.decoyCoachDone || game.round < 2 || !game.canDecoy()) return;
  s.decoyCoachDone = true;
  persist();
  const bubble = document.createElement('div');
  bubble.id = 'coach-decoy';
  bubble.className = 'sticker';
  bubble.textContent = '🧊 NEW — Sugar Decoy: drop a cube (D) and hungry bugs stop to eat it!';
  document.body.appendChild(bubble);
  const r = els.btnDecoy.getBoundingClientRect();
  bubble.style.left = Math.max(8, Math.min(window.innerWidth - 250, r.left + r.width / 2 - 120)) + 'px';
  bubble.style.top = Math.min(window.innerHeight - 80, r.bottom + 8) + 'px';
  decoyCoachUntil = performance.now() + 8000;
}

// ---------- species intro cards (one per bug type, ever) ----------
let bugCardQueue = [];
let bugCardActive = null; // { el, until }

function updateBugCards() {
  if (!game || els.screenGame.classList.contains('hidden')) {
    bugCardQueue.length = 0;
    if (bugCardActive) { bugCardActive.el.remove(); bugCardActive = null; }
    return;
  }
  // drain the sim's debut queue into ours (skip types this player has already met)
  while (game.debutQueue.length) {
    const tid = game.debutQueue.shift();
    if (!loadSave().seenBugs[tid] && !bugCardQueue.includes(tid)) bugCardQueue.push(tid);
  }
  if (bugCardActive) {
    if (performance.now() > bugCardActive.until) {
      const el = bugCardActive.el;
      el.classList.add('gone');
      setTimeout(() => el.remove(), 350);
      bugCardActive = null; // next card (if queued) appears on a later tick
    }
    return;
  }
  if (!bugCardQueue.length) return;
  const tid = bugCardQueue.shift();
  const s = loadSave();
  if (s.seenBugs[tid]) return;
  s.seenBugs[tid] = true; // marked at display time — never again
  persist();
  const def = ENEMIES[tid];
  const el = document.createElement('div');
  el.className = 'bug-card sticker';
  el.innerHTML = `
    <div class="bc-head"><i class="bc-dot" style="background:${def.color}"></i><b>NEW BUG — ${def.name}</b></div>
    <div class="bc-desc">${def.desc}</div>
    ${def.hint ? `<div class="bc-hint">💡 ${def.hint}</div>` : ''}`;
  document.body.appendChild(el);
  bugCardActive = { el, until: performance.now() + 5000 };
}

// ---------- achievements ----------

function toast(title, desc) {
  let holder = document.getElementById('toasts');
  if (!holder) {
    holder = document.createElement('div');
    holder.id = 'toasts';
    document.body.appendChild(holder);
  }
  const el = document.createElement('div');
  el.className = 'ach-toast sticker';
  el.innerHTML = `<div class="at-title">${title}</div><div class="at-desc">${desc}</div>`;
  holder.appendChild(el);
  sfx.fanfare();
  setTimeout(() => { el.classList.add('gone'); setTimeout(() => el.remove(), 400); }, 3600);
}

function checkAchievements(won) {
  if (!game) return;
  const s = loadSave();
  const tests = {
    firstRound: game.round >= 1,
    layerCake: s.totalPops >= 10000,
    stashDefended: won,
    untouchable: won && game.stats.leaks === 0,
    ironColony: won && game.diffKey === 'hard',
    fullHouse: game.typesPlaced.size >= 9,
    overtime60: game.round >= 60,
    swornQueen: won && game.hero && game.hero.level >= 10,
    pennyPincher: won && !game.soldAny,
    abilityAddict: game.abilityUses >= 10,
    moundLord: won && (game.map.mounds || []).filter(md =>
      game.towers.some(t => (t.x - md.x) ** 2 + (t.y - md.y) ** 2 <= md.r * md.r)).length >= 2,
    ascendant: game.ascensionUsed,
    forager: won && game.mods.forage,
    stormcaller: (game.powersCast || 0) >= 15,
    backyardLegend: backyardStars() >= 18, // all map×difficulty wins
  };
  for (const a of ACHIEVEMENTS) {
    if (!s.ach[a.id] && tests[a.id]) {
      s.ach[a.id] = true;
      persist();
      toast(`${a.icon} ${a.name}`, a.desc);
    }
  }
}

function showStats() {
  if (!game) return;
  const total = Object.values(game.damageBy).reduce((a, b) => a + b, 0) || 1;
  const rows = Object.entries(game.damageBy)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, dmg]) => {
      const pct = Math.round((dmg / total) * 100);
      return `<div class="stat-row"><span class="stat-name">${name}</span>
        <span class="stat-bar"><span class="stat-fill" style="width:${pct}%"></span></span>
        <span class="stat-val">${pct}% · ${fmt(dmg)}</span></div>`;
    }).join('');
  const modIcons = MOD_DEFS.filter(m => game.mods[m.id]).map(m => m.icon).join(' ');
  showModal(`
    <div class="modal-title">📊 COLONY REPORT</div>
    <p class="modal-stats">Round ${game.round} · 🍞 ${game.crumbs} crumbs · 🎈 ${fmt(game.stats.pops)} layers ·
      🍬 ${fmt(game.stats.earned)} earned · leaked ${fmt(game.stats.leaks)}
      ${game.hero ? ` · ⭐ ${game.heroDef.name} Lv ${game.hero.level}` : ''}
      ${modIcons ? ` · challenges: ${modIcons}` : ''}</p>
    ${leakBreakdown(game.leakTotals) ? `<p class="modal-stats">🕳️ Leaked: ${leakBreakdown(game.leakTotals)}</p>` : ''}
    <div class="stat-list">${rows || '<p>No damage dealt yet. The bugs got off easy.</p>'}</div>`,
    [['Back', () => { if (lastEndModal) lastEndModal(); else hideModal(); }]]);
}

function showLifetimeStats() {
  const s = loadSave();
  const winRate = s.gamesPlayed > 0 ? Math.round((s.gamesWon / s.gamesPlayed) * 100) : 0;
  const achGot = ACHIEVEMENTS.filter(a => s.ach[a.id]).length;
  const achPct = Math.round((achGot / ACHIEVEMENTS.length) * 100);
  let mapRows = '';
  for (const m of MAPS) {
    const best = bestForMap(m.id);
    const medal = medalForMap(m.id);
    const icon = medal === 'gold' ? '🥇' : medal === 'silver' ? '🥈' : medal === 'bronze' ? '🥉' : '—';
    mapRows += `<div class="ach-item ${best > 0 ? 'got' : 'locked'}"><span class="ach-ico">${icon}</span>
      <div style="flex:1"><b>${m.name}</b></div>
      <div>${best > 0 ? `best round <b>${best}</b>` : 'unexplored'}</div></div>`;
  }
  showModal(`
    <div class="modal-title">📊 COLONY LEDGER</div>
    <p class="modal-stats">🎮 ${fmt(s.gamesPlayed)} games played · 🏅 ${fmt(s.gamesWon)} wins (${winRate}%) ·
      🌊 ${fmt(s.totalRounds)} rounds fought</p>
    <p class="modal-stats">🎈 ${fmt(s.totalPops)} layers popped lifetime ·
      🏆 ${achGot}/${ACHIEVEMENTS.length} achievements (${achPct}%) · 🍯 ${jellyEarned()} royal jelly earned</p>
    <div class="ach-list">${mapRows}</div>`,
    [['Close', hideModal]]);
}

function showAchievements() {
  const s = loadSave();
  const got = ACHIEVEMENTS.filter(a => s.ach[a.id]).length;
  let html = `<div class="modal-title">🏆 ACHIEVEMENTS</div><p>${got} / ${ACHIEVEMENTS.length} earned · ${fmt(s.totalPops)} layers popped lifetime</p><div class="ach-list">`;
  for (const a of ACHIEVEMENTS) {
    const has = !!s.ach[a.id];
    html += `<div class="ach-item ${has ? 'got' : 'locked'}"><span class="ach-ico">${has ? a.icon : '🔒'}</span><div><b>${a.name}</b><br><small>${a.desc}</small></div></div>`;
  }
  html += '</div>';
  showModal(html, [['Close', hideModal]]);
}

// ---------- shop ----------

function renderShop() {
  els.shop.innerHTML = '<div class="shop-title">ANT SHOP</div>';
  shopCards = [];
  // hero deployment card (free, once)
  if (game && game.heroDef && !game.hero) {
    const h = game.heroDef;
    const hcard = document.createElement('button');
    hcard.className = 'shop-card sticker hero-deploy';
    hcard.title = h.blurb;
    hcard.innerHTML = `
      <canvas width="52" height="52"></canvas>
      <div class="sc-name">⭐ ${h.name}</div>
      <div class="sc-cost hero-free">FREE — place your hero!</div>`;
    drawHeroIcon(hcard.querySelector('canvas').getContext('2d'), h, 52);
    hcard.addEventListener('click', () => beginPlacing('hero'));
    els.shop.appendChild(hcard);
  }
  const grid = document.createElement('div');
  grid.className = 'shop-grid';
  for (const typeId of TOWER_ORDER) {
    const def = TOWERS[typeId];
    const card = document.createElement('button');
    card.className = 'shop-card sticker';
    card.title = `${def.tagline}  [key ${def.hotkey}]`;
    const airChip = isGroundOnly(def)
      ? '<div class="sc-air no-air">🚫🪽 ground only</div>'
      : (def.base.attack ? '<div class="sc-air">🪽 hits air</div>' : '');
    card.innerHTML = `
      <canvas width="52" height="52"></canvas>
      <div class="sc-name">${def.name}</div>
      <div class="sc-type">${TYPE_CHIP[def.base.damageType || 'support']}</div>
      ${airChip}
      <div class="sc-cost">🍬 <b>${game ? game.cost(typeId) : def.cost}</b></div>`;
    drawTowerIcon(card.querySelector('canvas').getContext('2d'), typeId, def, 52);
    if (game && game.unlockedTypes && !game.unlockedTypes.has(typeId)) {
      card.classList.add('locked-type');
      card.title = 'Locked — draft this ant after a round to unlock it.';
      card.querySelector('.sc-cost').innerHTML = '🔒 draft to unlock';
    }
    card.addEventListener('click', () => beginPlacing(typeId));
    grid.appendChild(card);
    shopCards.push({ el: card, typeId });
  }
  els.shop.appendChild(grid);
}

function refreshShop() {
  for (const { el, typeId } of shopCards) {
    const costEl = el.querySelector('.sc-cost b');
    if (costEl && game) costEl.textContent = game.cost(typeId);
  }
}

// ---------- placement ----------

function shakeEl(el) {
  if (!el || !el.animate) return;
  el.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' },
     { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }],
    { duration: 320, easing: 'ease-in-out' }
  );
}

function beginPlacing(typeId) {
  if (!game) return;
  // guided tutorial: only the step's called-for ant may be placed (blocks clicks AND hotkeys)
  const allow = coachAllow();
  if (allow !== null && !((allow === 'hero' && typeId === 'hero') || (allow === 'worker' && typeId === 'worker'))) {
    sfx.deny();
    return;
  }
  unlockAudio();
  if (typeId === 'hero') {
    if (!game.heroDef || game.hero) return;
    uiState.placingType = 'hero';
    uiState.placingDef = game.heroDef;
    uiState.selected = null;
    uiState.ghostX = null;
    renderPanel();
    return;
  }
  if (game.sugar < game.cost(typeId)) {
    sfx.deny();
    const card = shopCards.find(c => c.typeId === typeId);
    if (card) shakeEl(card.el);
    return;
  }
  uiState.placingType = typeId;
  uiState.placingDef = TOWERS[typeId];
  uiState.selected = null;
  uiState.ghostX = null;
  renderPanel();
}

function stopPlacing() {
  uiState.placingType = null;
  uiState.placingDef = null;
  uiState.casting = null;
  uiState.ghostX = null;
  renderPanel();
}

function beginCast(kind) {
  if (!game) return;
  unlockAudio();
  if (kind === 'decoy') {
    if (!game.canDecoy()) { sfx.deny(); shakeEl(els.btnDecoy); return; }
  } else if (game.powerCd[kind] > 0) { sfx.deny(); return; }
  uiState.placingType = null;
  uiState.placingDef = null;
  uiState.casting = kind;
  uiState.ghostX = null;
}

// ---------- canvas input ----------

// world coords from a viewport point (works for mouse, pen and touch)
function worldFromClient(clientX, clientY) {
  const r = els.canvas.getBoundingClientRect();
  return {
    x: (clientX - r.left) * WORLD_W / r.width,
    y: (clientY - r.top) * WORLD_H / r.height,
  };
}

function wireCanvas() {
  const cv = els.canvas;

  // ghost/range preview under the cursor or finger
  function moveTo(p) {
    if (!game) return;
    if (uiState.placingType) {
      uiState.ghostX = p.x;
      uiState.ghostY = p.y;
      uiState.ghostValid = game.canPlace(uiState.placingType, p.x, p.y)
        && (uiState.placingType === 'hero' || game.sugar >= game.cost(uiState.placingType));
    } else if (uiState.casting) {
      uiState.ghostX = p.x;
      uiState.ghostY = p.y;
    }
  }

  // place / cast / select at a point (opts.rightClick cancels; opts.keepPlacing = shift-place)
  function downAt(p, opts) {
    opts = opts || {};
    if (!game) return;
    unlockAudio();
    if (opts.rightClick) { stopPlacing(); return; }
    if (uiState.casting === 'decoy') {
      if (game.placeDecoy(p.x, p.y)) { uiState.casting = null; renderPanel(); }
      return;
    }
    if (uiState.casting) {
      if (game.castPower(uiState.casting, p.x, p.y)) { uiState.casting = null; renderPanel(); }
      return;
    }
    if (uiState.placingType === 'hero') {
      const t = game.placeHero(p.x, p.y);
      if (t) { stopPlacing(); uiState.selected = t; renderShop(); renderPanel(); }
      return;
    }
    if (uiState.placingType) {
      const t = game.placeTower(uiState.placingType, p.x, p.y);
      if (t && !opts.keepPlacing) { stopPlacing(); uiState.selected = t; renderPanel(); }
      else if (t) { uiState.ghostValid = game.canPlace(uiState.placingType, p.x, p.y) && game.sugar >= game.cost(uiState.placingType); }
      return;
    }
    let best = null, bd = 1e9;
    for (const t of game.towers) {
      const d = dist(p.x, p.y, t.x, t.y);
      if (d < t.def.footprint + 10 && d < bd) { bd = d; best = t; }
    }
    uiState.selected = best;
    renderPanel();
  }

  // Mouse & pen via Pointer Events. Touch is handled by the touch listeners below instead,
  // because older iOS Safari doesn't deliver pointer events to a <canvas> — which is exactly
  // why "can't place ants" happens on iPhone while the menu buttons (plain clicks) still work.
  cv.addEventListener('pointermove', (ev) => { if (ev.pointerType !== 'touch') moveTo(worldFromClient(ev.clientX, ev.clientY)); });
  cv.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'touch') return;
    downAt(worldFromClient(ev.clientX, ev.clientY), { rightClick: ev.button === 2, keepPlacing: ev.shiftKey });
  });
  cv.addEventListener('pointerleave', () => { uiState.ghostX = null; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());

  // Touch: drag to aim, lift to place. Universal across browsers (incl. old iOS). The canvas
  // has touch-action:none, and preventDefault stops page scroll/zoom + the synthetic click.
  let touchPt = null;
  const touchXY = (ev) => {
    const t = (ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]);
    return t ? worldFromClient(t.clientX, t.clientY) : null;
  };
  cv.addEventListener('touchstart', (ev) => {
    if (!game) return;
    ev.preventDefault();
    touchPt = touchXY(ev);
    if (touchPt) moveTo(touchPt); // show the range ring before they commit
  }, { passive: false });
  cv.addEventListener('touchmove', (ev) => {
    if (!game) return;
    ev.preventDefault();
    const p = touchXY(ev);
    if (p) { touchPt = p; moveTo(p); }
  }, { passive: false });
  cv.addEventListener('touchend', (ev) => {
    if (!game) return;
    ev.preventDefault();
    const p = touchXY(ev) || touchPt;
    if (p) downAt(p);
    uiState.ghostX = null;
    touchPt = null;
  }, { passive: false });
  cv.addEventListener('touchcancel', () => { uiState.ghostX = null; touchPt = null; });
}

// ---------- keyboard ----------

function wireKeys() {
  window.addEventListener('keydown', (e) => {
    if (!game || els.screenGame.classList.contains('hidden')) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (e.target && e.target.closest && e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return; // native activation
    // while a modal is up (pause/win/lose), only P (resume) and M (mute) act
    const key = e.key.toLowerCase();
    if ((game.paused || !els.modal.classList.contains('hidden')) && key !== 'p' && key !== 'm') return;
    if (e.key === 'Escape') { stopPlacing(); uiState.selected = null; renderPanel(); }
    else if (e.key === ' ') {
      e.preventDefault(); unlockAudio();
      const a = coachAllow();
      if (a !== null && a !== 'start') return; // guided tutorial gates Start
      game.startRound();
    }
    else if (e.key === 'a' || e.key === 'A') { unlockAudio(); game.useAbility(); }
    else if (e.key === 's' || e.key === 'S') { unlockAudio(); game.useAbility2(); }
    else if (e.key === 'q' || e.key === 'Q') beginCast('rain');
    else if (e.key === 'e' || e.key === 'E') beginCast('guards');
    else if (e.key === 'd' || e.key === 'D') beginCast('decoy');
    else if (e.key === 'Backspace' || e.key === 'Delete') {
      if (uiState.selected && !uiState.selected.isHero) {
        game.sell(uiState.selected);
        uiState.selected = null;
        renderPanel();
      }
    }
    else if (e.key === 'z' || e.key === 'Z') {
      if (uiState.selected && !uiState.selected.isHero && game.upgrade(uiState.selected, 'a')) renderPanel();
    }
    else if (e.key === 'x' || e.key === 'X') {
      if (uiState.selected && !uiState.selected.isHero && game.upgrade(uiState.selected, 'b')) renderPanel();
    }
    else if (e.key === 'f' || e.key === 'F') cycleSpeed();
    else if (e.key === 'p' || e.key === 'P') togglePause();
    else if (e.key === 'm' || e.key === 'M') toggleMute();
    else {
      const idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= TOWER_ORDER.length) beginPlacing(TOWER_ORDER[idx - 1]);
    }
  });
}

// chips + boss flag for one round's wave (preview must match what spawns)
function wavePreviewRound(n) {
  let groups = n <= WAVES.length ? WAVES[n - 1] : freeplayRound(n);
  if (game.diffKey === 'easy') groups = easyAdjust(groups, n);
  const agg = new Map();
  let hasBoss = false;
  for (const gr of groups) {
    const key = `${gr.t}|${gr.camo ? 1 : 0}|${gr.regen ? 1 : 0}`;
    agg.set(key, (agg.get(key) || 0) + gr.n);
    if (ENEMIES[gr.t].boss) hasBoss = true;
  }
  let chips = '';
  for (const [key, count] of agg) {
    const [tid, camo, regen] = key.split('|');
    const def = ENEMIES[tid];
    chips += `<span class="wave-chip${def.boss ? ' boss' : ''}">
      <i style="background:${def.color}"></i>${count}× ${def.name}${def.flying ? ' 🪽' : ''}${camo === '1' ? ' 🕶️' : ''}${regen === '1' ? ' 💗' : ''}</span>`;
  }
  return { chips, hasBoss };
}

// upcoming wave summary for the idle panel (Scout's Eye ⭐9: two-round lookahead)
function buildWavePreview() {
  if (!game || game.state !== 'idle') return '';
  const n = game.round + 1;
  const cur = wavePreviewRound(n);
  let html = `<div class="wave-preview${cur.hasBoss ? ' danger' : ''}">
    <div class="wp-title">${cur.hasBoss ? '⚠️ ROUND ' + n + ' — BOSS INCOMING' : 'NEXT: ROUND ' + n}</div>
    <div class="wp-chips">${cur.chips}</div>`;
  if (game.starRewards && game.starRewards.scoutseye) {
    const next = wavePreviewRound(n + 1);
    html += `<div class="wp-title wp-after">${next.hasBoss ? '🔭 THEN: ROUND ' + (n + 1) + ' — ⚠️ BOSS' : '🔭 THEN: ROUND ' + (n + 1)}</div>
      <div class="wp-chips wp-after-chips">${next.chips}</div>`;
  }
  return html + '</div>';
}

// ---------- modal ----------

let modalPrevFocus = null;

function showModal(html, buttons = []) {
  const modal = els.modal;
  const card = document.getElementById('modal-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.innerHTML = html;
  const row = document.createElement('div');
  row.className = 'modal-btns';
  for (const [label, fn] of buttons) {
    const b = document.createElement('button');
    b.className = 'sticker big-btn';
    b.textContent = label;
    b.addEventListener('click', fn);
    row.appendChild(b);
  }
  card.appendChild(row);
  modal.classList.remove('hidden');
  modalPrevFocus = document.activeElement;
  const first = row.querySelector('button');
  if (first) first.focus();
}

function hideModal() {
  els.modal.classList.add('hidden');
  if (modalPrevFocus && modalPrevFocus.focus) modalPrevFocus.focus();
  modalPrevFocus = null;
}

// ---------- tower panel ----------

// concrete effect of buying a tier: recompute stats on a shallow CLONE (the real
// tower is never mutated) and diff the numbers players feel — max 3, DPS first.
function tierDeltaHtml(t, pk) {
  const tmp = Object.assign({}, t, { tiers: { ...t.tiers, [pk]: t.tiers[pk] + 1 } });
  recomputeStats(tmp);
  const a = t.stats, b = tmp.stats;
  const dpsOf = (tw) => {
    const s = tw.stats;
    if (!s.attack) return 0;
    const d = effDamage(tw);
    return s.attack === 'trap' ? (d * s.trapCharges) / s.cooldown : (d * (s.multishot || 1)) / s.cooldown;
  };
  const parts = [];
  const push = (label, av, bv, f = (v) => String(Math.round(v))) => {
    if (parts.length >= 3 || Math.abs(av - bv) <= 0.01) return;
    parts.push(`${label} ${f(av)}→${f(bv)}`);
  };
  if (a.attack) {
    push('DPS', dpsOf(t), dpsOf(tmp), v => v.toFixed(1));
    if (a.range < 9000) push('range', a.range || 0, b.range || 0);
    push('pierce', a.pierce || 0, b.pierce || 0);
    push('blast', a.blast || 0, b.blast || 0);
    push('slow', (a.slowPct || 0) * 100, (b.slowPct || 0) * 100, v => `${Math.round(v)}%`);
    push('stun', (a.stunChance || 0) * 100, (b.stunChance || 0) * 100, v => `${Math.round(v)}%`);
    push('targets', a.maxTargets || 0, b.maxTargets || 0);
    push('piles', a.maxPiles || 0, b.maxPiles || 0);
    push('burn', a.burnDps || 0, b.burnDps || 0, v => `${Math.round(v)}/s`);
  } else if (a.income != null || b.income != null) {
    push('income', a.income || 0, b.income || 0, v => `${Math.round(v)}/rd`);
    push('interest', (a.interest || 0) * 100, (b.interest || 0) * 100, v => `${Math.round(v)}%`);
  } else {
    push('aura', a.range || 0, b.range || 0);
    push('haste', ((a.auraRate || 1) - 1) * 100, ((b.auraRate || 1) - 1) * 100, v => `+${Math.round(v)}%`);
    push('aura dmg', a.auraDmgAdd || 0, b.auraDmgAdd || 0, v => `+${Math.round(v)}`);
  }
  return parts.length ? `<span class="tier-delta">${parts.join(' · ')}</span>` : '';
}

export function renderPanel() {
  if (!els.panel) return;
  panelDyn = [];
  if (uiState.placingType) {
    const def = uiState.placingDef;
    els.panel.innerHTML = `
      <div class="panel-card sticker">
        <div class="pc-title">${def.name}</div>
        <p class="pc-desc">${def.tagline}</p>
        <p class="pc-hint">Click the grass to place.<br>Shift-click places more. Right-click cancels.</p>
      </div>`;
    return;
  }
  const t = uiState.selected;
  if (!t || !game || !game.towers.includes(t)) {
    els.panel.innerHTML = `
      <div class="panel-card sticker">
        <div class="pc-title">Colony orders</div>
        <p class="pc-desc">Pick an ant from the shop (keys 1–9), place it near the trail, and pop every bug.</p>
        ${buildWavePreview()}
        <p class="pc-hint">Q Acid Rain · E Guard Detail · D Sugar Decoy (drop a cube — hungry bugs stop to eat) ·
        Z/X upgrades · Backspace sells · A hero ability.
        Dirt mounds grant +25% range — claim the high ground. Wasps fly: keep pellets and arrows on air duty.</p>
      </div>`;
    return;
  }

  if (t.isHero) {
    const h = t.heroDef;
    const nextXp = t.level < 10 ? XP_LEVELS[t.level] : null;
    els.panel.innerHTML = `
      <div class="panel-card sticker">
        <div class="pc-title">⭐ ${h.name} <span class="hero-lvl">Lv ${t.level}</span></div>
        <p class="pc-desc">${h.title} — ${h.blurb}</p>
        <div class="hero-xp"><div class="hero-xp-fill" id="hero-xp-fill"></div></div>
        <p class="pc-hint" id="hero-xp-label"></p>
        <div class="pc-row">
          <button id="pt-target" class="sticker mini-btn">🎯 ${MODE_LABEL[t.mode]}</button>
        </div>
        <p class="pc-desc">⚡ <b>${h.ability.name}</b> — ${h.ability.desc}${t.level < ABILITY_UNLOCK_LEVEL ? ' <i>(unlocks at Lv 3)</i>' : ''}</p>
      </div>`;
    const target = document.getElementById('pt-target');
    target.addEventListener('click', () => {
      const i = MODES.indexOf(t.mode);
      t.mode = MODES[(i + 1) % MODES.length];
      target.textContent = `🎯 ${MODE_LABEL[t.mode]}`;
    });
    panelDyn.push(() => {
      const fill = document.getElementById('hero-xp-fill');
      const label = document.getElementById('hero-xp-label');
      if (!fill || !game) return;
      const prev = XP_LEVELS[t.level - 1];
      const next = t.level < 10 ? XP_LEVELS[t.level] : null;
      const xp = game.stats.pops;
      fill.style.width = next ? `${Math.min(100, ((xp - prev) / (next - prev)) * 100)}%` : '100%';
      label.textContent = next ? `${Math.min(xp, next)} / ${next} layers to Lv ${t.level + 1}` : 'MAX LEVEL';
    });
    return;
  }

  const sellVal = Math.floor(t.spent * SELL_RATIO);
  const isSupport = !t.def.base.attack;
  let html = `
    <div class="panel-card sticker">
      <div class="pc-title">${t.ascended ? '👑 ' : ''}${t.def.name}</div>
      ${game.canAscend(t) ? `<button id="pt-ascend" class="sticker mini-btn ascend" title="Once per game: +100% damage, +25% range, +30% speed">👑 ASCEND — 🍬 ${game.ascendCost()}</button>` : ''}
      <div class="pc-row">
        ${isSupport ? '' : `<button id="pt-target" class="sticker mini-btn" title="Targeting mode">🎯 ${MODE_LABEL[t.mode]}</button>`}
        <button id="pt-sell" class="sticker mini-btn sell" title="Sell for 70% of what you spent">Sell +${sellVal}</button>
      </div>
      ${isGroundOnly(t.def) ? '<p class="pc-ground">🚫🪽 Ground only — can\'t reach Wasps.</p>' : ''}
      <div class="pc-stats">${towerStatsHtml(t)}</div>
      <div class="pc-paths">`;
  for (const pk of ['a', 'b']) {
    const path = t.def.paths[pk];
    html += `<div class="pc-path"><div class="pc-path-name ${pk}">${path.name}</div>`;
    for (let i = 0; i < 3; i++) {
      const tier = path.tiers[i];
      const owned = t.tiers[pk] > i;
      const isNext = t.tiers[pk] === i;
      const st = isNext ? game.upgradeState(t, pk) : null;
      const locked = !owned && (!isNext || (st && st.status === 'locked'));
      const cost = game.tierCost(t.def, pk, i);
      const delta = !owned && !locked && isNext ? tierDeltaHtml(t, pk) : '';
      html += `
        <button class="pc-tier ${owned ? 'owned' : locked ? 'locked' : 'buyable'}" data-path="${pk}" data-tier="${i}"
                ${owned || locked ? 'disabled' : ''} title="${tier.desc}">
          <span class="tier-name">${tier.name}</span>
          <span class="tier-info">${owned ? '✔ OWNED' : locked ? (st && st.status === 'locked' ? '🔒 other path chosen' : '🔒') : `🍬 ${cost}`}</span>
          <span class="tier-desc">${tier.desc}</span>
          ${delta}
        </button>`;
    }
    html += '</div>';
  }
  html += '</div></div>';
  els.panel.innerHTML = html;

  const target = document.getElementById('pt-target');
  if (target) {
    target.addEventListener('click', () => {
      const i = MODES.indexOf(t.mode);
      t.mode = MODES[(i + 1) % MODES.length];
      target.textContent = `🎯 ${MODE_LABEL[t.mode]}`;
    });
  }
  document.getElementById('pt-sell').addEventListener('click', () => {
    game.sell(t);
    uiState.selected = null;
    renderPanel();
  });
  const ascBtn = document.getElementById('pt-ascend');
  if (ascBtn) ascBtn.addEventListener('click', () => { if (game.ascend(t)) renderPanel(); });
  els.panel.querySelectorAll('.pc-tier.buyable').forEach(btn => {
    const pk = btn.dataset.path, i = parseInt(btn.dataset.tier, 10);
    btn.addEventListener('click', () => {
      if (game.upgrade(t, pk)) renderPanel();
      else shakeEl(btn);
    });
    panelDyn.push(() => {
      const st = game.upgradeState(t, pk);
      btn.classList.toggle('poor', st.status === 'poor');
    });
  });
}
