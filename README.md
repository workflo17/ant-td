# Grubs TD 🐜

### ▶ Play now (no install): **https://workflo17.github.io/ant-td/**
Works in any modern browser, on desktop or phone. First time? Just hit **Play** — a
guided tutorial walks you through your first round.

> **🧪 Testing this for me? Thank you!** Critiques and bug reports are the whole point.
> **[→ Open an issue](https://github.com/workflo17/ant-td/issues/new)** and tell me:
> which map & round, what you were doing, and what felt off (too easy/hard, confusing,
> ugly, a bug). Rough notes are fine — even "the menu confused me" helps.

---

A Bloons-style tower defense: pest bugs march a pheromone trail toward the colony's
sugar stash, and you place **ant towers** on the grass to pop them. Bright, chunky,
cartoon — all art drawn procedurally on Canvas 2D, all sound synthesized with WebAudio.
No framework, no build step, no external assets. Runs fully offline.

## Run it

Any static file server works (ES modules need http, not file://):

```
python -m http.server 5410 --directory .
# → http://localhost:5410
```

Or use the Claude Code preview config `ant-td` (`.claude/launch.json`).

**Debug mode:** open `http://localhost:5410/?debug` for the debug panel
(grant sugar, jump to round, auto-start, hitboxes, turbo 10×, spawn any bug, god mode)
plus a `window.TD` scripting API (`TD.place`, `TD.up`, `TD.spawn`, `TD.hit`, `TD.acquire`).

## The Bloons DNA

- **Layered bugs** — damage peels layers; a popped bug reveals what's inside.
  Chain: Mite → Gnat → Weevil → Hopper (fast) → Moth (fastest).
  Overkill damage carries down the chain.
- **Specials** — **Pillbug** (armored: only explosions/crush/shell-piercers hurt it → 2 Weevils),
  **Snail** (10 HP shell → 2 Hoppers), **Stag Beetle** (round-24 armored mid-boss, 320 HP →
  3 Pillbugs; every 6s it telegraphs — trembling, gold flash — then **charges** at +120%
  speed for 1.2s; the charge is a generic data field, `charge:{every,dur,mul}`),
  **Caterpillar** (200 HP blimp → 4 Snails), **Hornet Queen** (round-40 boss, 700 HP →
  4 Caterpillars; at half health she **rages once**: +35% speed, releases 2 Caterpillars,
  and holds a 1.5s damage-immune gold shield).
- **Boss health bars** — while any `boss` bug is alive, a BTD6-style segmented bar sits
  top-center (name, hp/max, gold border; up to 2 stack, "+N more" past that). The Queen's
  rage shield makes her whole bar flash gold.
- **Species intro cards** — the first time each bug TYPE ever spawns for this player, a
  one-time sticker card (top-right) introduces it: name, what it does, and the counter
  hint (`hint` field in `data/enemies.js`). Persisted in `save.seenBugs`, never repeats.
- **Modifiers** — composable on any bug: **camo** (stick-bug stripes; untargetable without
  scent detection) and **regen** (regrows one chain layer every 3 s).
- **Free placement** with live range preview, footprint collision, 70% sell-back.
- **Targeting modes** per tower: First / Last / Strong / Close.
- Sugar = money (1 per layer popped + round bonus). Crumbs = lives (leaks cost the
  bug's remaining layer count).

## Towers (2 paths × 3 tiers; only one path may go past tier 2)

| Tower | Role | Path A | Path B |
|---|---|---|---|
| Worker Ant | dart shooter | damage + pierce | attack speed / twin shot |
| Trap-Jaw Ant | 360° crush snap | radius + targets | stun chance |
| Acid Archer | infinite-range sniper | armor-shred (pops Pillbugs) + shell bonus | raw damage |
| Exploding Ant | AoE lobber (real Colobopsis!) | blast radius | sticky burn DoT (burn pierces armor) |
| Weaver Ant | silk slow | slow strength / snare | pierce + splash webs |
| Army Ant Camp | trail traps (Spike Factory) — piles bite **camo and armor** | pile size + damage | production + pile count |
| Majoress Guard | late-game DPS anchor (Super) | damage + armor-shred at tier 2 | attack speed / twin shot |
| Honeypot Replete | income | sugar per round | end-round interest |
| Pheromone Beacon | aura buff + **camo detection** | attack speed / damage aura | aura radius / global detection |

## Structure — data-driven everything

```
index.html            page shell
css/style.css         picnic-sticker UI language
data/enemies.js       bug stats, children, immunities
data/towers.js        tower stats + upgrade tiers (add/mul/set patches)
data/waves.js         40 scripted rounds + freeplay generator + economy constants
data/starRewards.js   the ⭐ backyard-star reward track (thresholds + effects)
data/maps.js          6 maps: waypoint polylines, blockers, per-type speed twists, hazard sectors
js/main.js            fixed-timestep loop (60 Hz sim; speed = steps/frame)
js/game.js            rounds, economy, placement, buffs, win/lose
js/enemies.js         movement, layered damage, statuses (slow/stun/burn/regen)
js/towers.js          stats recompute, targeting, firing
js/projectiles.js     pooled pellets / bombs / silk
js/particles.js       pooled shards, rings, floating text
js/render.js          frame orchestration: maps, decals, projectiles, critters, HUD bars
js/render/helpers.js  shared render helpers (ink, cached gradients, chitin-noise, rects)
js/render/bugs.js     bug (enemy) body art: silhouettes, shells, status FX, HP bars
js/render/ants.js     ant (tower) body art: procedural silhouettes, tiers, tower icons
js/sound.js           WebAudio SFX: self-authored sample bank + convolution reverb
js/ui.js              menu, HUD, shop, tower panel, modals
js/save.js            localStorage (best rounds, wins, mute)
js/debug.js           ?debug panel + TD scripting API
```

## Balance tuning knobs

All balance lives in `data/` — engine code never needs touching:

- **Economy**: `START_SUGAR`, `roundBonus()` in `waves.js`; per-layer sugar is 1 by design.
- **Difficulty**: `DIFFICULTY.{easy,medium,hard}` cost/speed multipliers (`waves.js`).
- **Round pressure**: group `n`/`gap`/`delay` per round in `WAVES`; debut rounds are
  commented (camo r8, pillbug r12, regen r16, wasp r18, snail r22, stag beetle r24,
  caterpillar r30, queen r40; stags return r34 and in overtime r47/r53).
  Rounds 41–60 are scripted "overtime" after the campaign win (multi-queen finale at r60);
  the freeplay generator takes over from r61.
- **Freeplay scaling**: `freeplayRound()` + `freeplayHpMul()` (+8% boss HP per round past 40).
- **Tower power**: every stat and tier cost in `towers.js`; upgrade tiers are
  declarative patches (`add`/`mul`/`set`).
- **Bug toughness**: hp/speed/children in `enemies.js`; `slowResist`/`stunImmune`
  guard bosses from permastun.
- **Leak pain**: `leakValue` = remaining layers (RBE); path geometry in `maps.js`.

Balance notes from the tuning passes:
- A mixed strategy (workers → beacon by r8 → trap-jaw/exploder before r12 pillbugs →
  archer with Shell Piercer → inferno/husk-splitter tiers by r30) beats Easy r40 with
  no Honeypot farming, finishing with ~⅔ of starting crumbs.
- Overtime (r41–60) expects a full late-game board: in testing, a 16-tower maxed army
  (with Majoress Guards and Army Ant Camps) cleared the r60 four-queen finale at 100
  crumbs, while a 10-tower board fell at r57. That cliff is intentional endless-mode
  pressure — tune via `freeplayHpMul` if it should be gentler.

## Roguelite, paragons & meta-progression

- **🌿 Foraging Run** (menu button): roguelite mode. Start with Worker + 2 random ants;
  after every round, draft 1 of 3 — unlock a locked ant, take a **relic** (`data/relics.js`:
  colony-wide passives like +10% range, camo sight for everyone, slower bugs), or grab a
  sugar cache. Relics persist through save/resume.
- **👑 Ascension**: once per game, a tower with a maxed path can ascend (~3500🍬):
  +100% damage, +25% range, +30% speed, golden aura. The late-game sugar sink.
- **🍯 Colony Perks**: permanent meta-progression bought with **Royal Jelly** (1 per
  achievement, 1/2/3 per bronze/silver/gold map medal): starting sugar/crumbs, pop income,
  faster veteran stars (`data/perks.js`).

## Depth & density (the "plays for hours" layer)

- **Tower veterancy**: every ant tracks layers dealt; 100/400/1200 earn ★/★★/★★★
  (+5% damage per star, +1 flat at ★★). Stars render above the ant; the service record
  ("★★ · 450 layers dealt · ≈2.4 dps") lives in its panel.
- **Live stat panels**: damage/speed/range/pierce/blast/slow bars + DPS estimate for every
  selected tower; income/aura bars for support ants.
- **Tier growth**: ants grow ~5% per purchased tier — a maxed veteran is visibly a unit.
- **Damage-type chips** on shop cards (🧪💥💣🕸️✨) teach counter-play at a glance.
- **Dressed maps**: trail-edge pebbles, crumb scatters, cutlery/napkin (picnic), grass
  tufts (garden), coffee rings + sugar (kitchen), fallen leaves (flower bed), lamplit
  indigo porch boards + fireflies (night porch), framed border.
- **Night Porch** (5th map, unlock best ≥ 36): a long wraparound trail with one crossing
  over dark porch planks, baked warm lamplight pools, glowing lantern/flowerpot/moth-swarm
  set-pieces, and ambient fireflies. Map twist: moths fly +10% here, via a generic
  `map.speedMulByType` field applied in the enemy speed calc. **Live entity lighting**:
  a per-frame additive pass re-tints every bug and ant standing in a lamp pool warm and
  cools everything outside them (pool positions cached at bake time, one glow sprite).
- **Bath Time** (6th map, unlock best ≥ 38, tag *Soaked*): aqua bathroom tile with grout,
  a foamy bathtub + rubber duck set-piece, puddle blockers, dropped soap, drifting soap
  bubbles. **The twist**: a shower-spray sector (`map.hazard {type:'sweep', period, width}`,
  handled generically in the engine) sweeps the room — bugs inside move at 60% speed, but
  ants inside attack 35% slower too. Drawn as a translucent blue band full of falling drops.
- **Tier-3 transforms**: any ant with a maxed path grows a distinct silhouette piece —
  worker banded cannon-gaster, trapjaw crested helm, archer twin barrels, exploder double
  payload, weaver silk cape, army second gold war-standard, majoress full crown + royal cape.
- **Upgrade-delta previews**: every buyable tier button shows the concrete effect on the
  live tower ("DPS 1.3→2.0 · range 110→128", max 3 changed stats), computed by re-running
  the stat pipeline on a temp clone — buffs, veterancy and ascension included.
- **Round-end punctuation**: finish a round with zero leaks and a gold **PERFECT ROUND!**
  banner stamps down with its own jingle; the final bug of a round dying to a pop (not a
  leak) triggers 0.5s of slow-mo and a deep-then-bright "last pop" button.
- **iOS-ready**: standalone web-app metas, no-zoom viewport, touch-action locked canvas,
  44px+ touch targets (every HUD button forces `min-height: 44px` at ≤700px), installable PWA.
- **Mobile layout**: phone portrait gets a slim wrapping HUD, full-width canvas and a
  horizontal shop strip; phone landscape keeps canvas + sidebar side by side with the
  canvas capped to the fold. Small screens scroll from the top instead of center-clipping.

## Air war, powers & terrain

- **Wasps** (debut r18): flying bugs that ignore the trail and take a straight air lane to
  the basket. Trap-Jaws, Exploders, Army Camp piles and Guard Detail are ground-only —
  keep pellets, arrows and silk on air duty. Camo wasps exist. Air lanes render as dashed
  lines while flyers are aloft.
- **Colony Powers** (free, cooldown, click-to-cast): ☄️ **Acid Rain** (Q — 10 acid damage
  in a blast zone, hits camo and flyers, armored bugs immune, 60s) and 🛡️ **Guard Detail**
  (E — soldier squad holds a spot 8s, slowing 70% and biting ground bugs, 45s).
- **🧊 Sugar Decoy** (D, the signature verb): a paid consumable (120🍬, no cooldown, max
  2 out) — click the grass to drop a sticker-style crystal sugar cube. Ground bugs within
  radius 70 **stop and eat** (a hard snare refreshed while the cube endures); bosses and
  flyers ignore it. The cube has 25 bites — each of up to 6 simultaneous eaters takes
  1 bite/0.5 s (extras walk on) — then crumbles in a puff of crumbs: pure stall, no
  reward. Cubes shrink as they're eaten, judder under nibbling, and survive save/resume.
  All knobs in `DECOY` (`data/waves.js`); a one-time coach bubble fires when it first
  becomes affordable.
- **High-ground mounds**: 2 dirt mounds per map grant **+25% range** to any ant placed on
  them (chevron mark; they glow while placing). Scarce real estate — fight for it.

## Heroes, music & meta

- **Hero ants** (`data/heroes.js`): pick one on the menu, place free once per game. Levels
  1–10 from the colony's total pops; ability unlocks at Lv 3 (button in HUD, hotkey A).
  General Formica (crush melee, *Rally Cry*: +50% attack speed 10s), Vespula Silkmother
  (biting silk, *Web the World*: global 60% slow 6s), Melissa the Provider (economy:
  gentle pellets, a per-round sugar stipend of 15+5×level, *Harvest Time*: +200 sugar and
  every Honeypot pays out instantly), or Sergeant Tenebra the Summoner (dark violet;
  passive: every 12s in-round a minion guard-ant appears on the trail near her — 6s life,
  bites ground bugs via the guards system; *Muster* L3: 3 minions along the trail).
- **Second hero actives at Lv 7** (button appears next to the first, hotkey S, own
  cooldown, snapshot-safe): Formica's *Iron Wall* (90s — an elite gold guard post
  barricades the trail exit for 6s: bites for 4, 80% body-block slow), Vespula's
  *Gossamer Shroud* (75s — every ant gains camo detection for 12s), Melissa's *Honey
  Flood* (80s — all bugs slowed 40% for 5s, +1 sugar per bug caught), Tenebra's *Legion*
  (90s — 6 minions that also slow bugs 50%).
- **Adaptive music** (`js/music.js`): WebAudio step-sequencer, no assets. Layers by
  intensity: menu/build → combat (+bass/hats) → swarm (+kick) → boss (minor key, arp).
  Separate 🎵 toggle from SFX mute. **Per-map identity** via `setMapTheme(mapId)`:
  picnic = sunny A major · garden = up a minor third · kitchen = swung 8ths, down two ·
  flower bed = minor-leaning, 108 BPM · night porch = minor, slow 96 BPM, down four ·
  bath = light minor, 104 BPM, up two.
- **Audio craft (v14 — sampled, roomed, composed)**: a **convolution reverb** send bus
  (synthetic 2 s impulse response, lowpass-darkened tail, built at init) puts every voice
  in a real acoustic space — SFX ride ≈80/20 dry/wet, music ≈65/35. The hot one-shots are
  a **pre-rendered sample bank**: 8 "samples" (pop_small/mid/big, kick thump, snap crack,
  FM-bell chime, whoosh, splat) rendered once into AudioBuffers via `OfflineAudioContext`
  and played back with ±8 % rate jitter — sampled playback, authored in-house at boot.
  Percussion is a real kit (sampled kick, layered tone+noise snare on the backbeats, hats
  with a 16-step accent pattern), and the score has **song form**: every map theme owns a
  16-step A melody and a B melody (A A B B by bar), every 4th bar closes with an arp-run
  fill, and the bass gains passing tones in the B section. Win/lose screens get proper
  4-phrase compositions (I–IV–V–I victory tune with walking bass; a minor lament whose
  drone sags a half step). `TD.sound()` reports the live graph (bank, IR, wet sends).
- **Audio polish**: SFX *and* music route through one master `DynamicsCompressorNode`
  (swarms stop clipping); pop pitch tracks bug size (mite plink → boss thump, wired from
  the pop layer with the bug's radius); boss-specific horn stingers (stag = low brass
  blast, queen = two-chord menace); and **per-map ambient beds** under the music — breeze
  noise (picnic/flower bed), bird chirps (garden), 50 Hz fridge hum (kitchen), cricket
  pulses (night porch), echoing drips (bath) — all tied to the music mute/volume and
  reported by `musicState().ambient`.
- **📅 Daily Run**: a seeded challenge (seed = YYYYMMDD) — the same deterministic map,
  hero and 1–2 challenge mods for the whole day, on Medium. Local per-date best lives in
  `save.dailyBest` and shows on the menu button.
- **🐜 Rival Colony → 😤 NEMESIS**: every daily spawns a deterministic rival from the
  same seed — a named neighborhood colony ("The Tool Shed Hill"), an emoji face, and a
  base round target (18–34, mid-weighted). The target **escalates honestly**: +2 per
  current 🔥 streak day (capped +12), with the math spelled out in the modal ("round 28
  + streak bonus 6"). **Crush a rival and they return tomorrow as your nemesis** (same
  name/face, persisted in `save.nemesis`): +3 target per prior defeat, escalating revenge
  taunts, an 😤 callout on the daily button. The feud ends when they finally beat you
  (they gloat, your streak resets) or after 5 defeats (they bow out with respect);
  defeating the same rival 3 days running earns the **Nemesis** achievement. Today's
  rival is frozen at first sight (`save.dailyRivalDef`) so mid-day state changes never
  rewrite the day's challenge. Judged once per run (win, lose, or leaving to the menu):
  beat the target → **🏆 RIVAL CRUSHED** + `save.dailyStreak++`; fall short → a seeded
  taunt. Honestly local — the modal says so; no fake online claims.
- **Loadout**: the hero picker and challenge chips fold into one collapsible menu sticker
  ("▸ LOADOUT — ⭐ Formica · 💀🕶️ 2 challenges"), collapsed by default — map cards,
  difficulty and the big buttons stay front and center.
- **📊 Stats page** (menu, next to Achievements): lifetime ledger — games played, wins &
  win rate, rounds fought, lifetime layers popped, achievement %, royal jelly earned, and
  best round per map with its medal.
- **🌾 The Backyard Trail**: the campaign menu is a journey — a winding dotted trail
  across the backyard connecting all 6 maps as circular emblem nodes (each map's preview
  clipped into a circle), showing lock state, medal, best round, and up to **3 stars**
  (one per difficulty won, derived from `save.wins`). A "⭐ N/18 backyard stars" counter
  totals the campaign; the selected node lifts gold; a 🗂 toggle flips back to the classic
  card list. On phones the strip scrolls horizontally inside itself.
- **⭐ Star Rewards** (`data/starRewards.js`): backyard stars are a currency you never
  spend — a reward track under the trail unlocks automatically at thresholds:
  ⭐3 *Sunny Start* (+25 starting sugar) · ⭐6 *Crumb Cushion* (+5 starting crumbs, not
  in Crumbs of Steel) · ⭐9 *Scout's Eye* (the wave preview also scouts the round after
  next) · ⭐12 *Golden Anthill* (gold trail trim, 👑 on the counter, a pennant on the
  basket) · ⭐15 *Veteran Colony* (every placed ant starts with 25 layers of veterancy
  credit) · ⭐18 *Backyard Legend* (golden logo, its own achievement, all Honeypots
  +10% income). Crossing a threshold on a win toasts the unlock; the strip shows
  locked/unlocked chips with the next target pulsing. Stars flow into runs via
  `mods.stars` (snapshot-safe like perks).
- **Medals** per map (🥉 reach r20 · 🥈 win · 🥇 win without leaking) on trail nodes and
  map cards, and **16 achievements** (`data/achievements.js`) with toast popups and a
  menu panel.
- **Challenge modes** (menu chips, stackable): 💀 Crumbs of Steel (1 life) · 🕶️ Camo Chaos
  (all bugs camo) · ⚡ Speed Demon (+40% bug speed) · 💸 Poverty Colony (half income).
- **Colony report** on win/lose: per-ant-type damage leaderboard, layers, earnings, leaks,
  hero level, and active challenges.
- **Mid-run save & resume**: runs persist between rounds; the menu offers
  "▶ Resume &lt;map&gt; — round N" (cleared on defeat).
- **Next-wave preview** in the idle panel: exact bug counts with 🕶️/💗 flags, boss warnings.
- **Installable PWA**: manifest + service worker (network-first, offline fallback) + icon.
- **Hotkeys**: 1–9 shop · Z/X buy upgrade paths · Backspace sell · A hero ability ·
  S second hero ability · Q/E colony powers · D sugar decoy · Space start · F speed ·
  P pause · M mute.

## Game feel ("juice")

One motion identity everywhere — **Playful**: ease-out-back, 150–300ms, 10–20% overshoot
(boss moments deliberately slower and heavier; error feedback firm, no overshoot).

- Depth: drop shadows under every entity; baked vignette + film grain per map.
- Hits: white flash + squash on damage, spring-in on spawns/reveals, spinning shell
  chunks on deaths, tower recoil on fire.
- World: pheromone dots stream along the trail toward the basket; per-bug hue jitter.
- Combat theater: three-stage explosions (flash → additive glow → smoke) with lingering
  scorch decals on a fading offscreen layer; projectile ribbon trails; directional camera
  kick; boss-pop hitstop; one-time cinematic boss intros (slow-mo + darkened banner + horn).
- UI: round banners with debut warnings, coin-fly from pops to a tweened sugar counter,
  can't-afford shake, placement drop-in, upgrade bursts.

Dev note: `serve.py` sends `Cache-Control: no-store` so module edits always load fresh,
and speaks HTTP/1.1 keep-alive so the ~22-module boot doesn't open a fresh socket per
request (intermittent `ERR_CONNECTION_RESET` behind localhost-filtering antivirus).

## Visual fidelity

Three-layer rendering model, all procedural: **lighting** (cached radial gradients with a
top-left key light on every body and prop, weighted hand-drawn outlines, bake-time soft
occlusion and drop shadows), **materials** (masked chitin-noise composited soft-light, rim
light, jointed knee legs, distance-phased gait sway, trail speckle, ambient wildlife), and
**retina** (DPR-aware backing store up to 2×, auto-detected; force with `?dpr=2`).
Per-type body silhouettes live in `data/enemies.js` (`bodyL`/`bodyW`).

## Performance

- Fixed 60 Hz simulation; game speed multiplies steps per frame (1×/3×/debug 10×),
  so fast-forward is physics-identical.
- Object pools for enemies, projectiles, particles; per-map background baked once
  to an offscreen canvas; zero per-frame allocations in hot paths.
- A background `setInterval` keeps the sim running when the tab is hidden (rAF pauses).

## Asset credits

The game is procedural-first; two small asset sets are layered on top (both self-hosted,
offline-friendly, with graceful fallbacks when absent):

- **Foley**: 21 one-shots curated from **Kenney — "Impact Sounds"** (kenney.nl), licensed
  **CC0 / public domain** (`assets/sfx/`, license copy included). Loaded at boot and
  preferred over the synthesized sample bank; browsers that can't decode ogg fall back
  to the synth bank automatically.
- **Display font**: **Baloo 2** variable font (Ek Type), licensed **SIL OFL 1.1**
  (`assets/fonts/`, license copy included). Falls back to Trebuchet MS.
