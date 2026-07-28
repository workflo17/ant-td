# Road to 10 — Grubs TD

Written after the three-review session of 2026-07-28 (critic → fix list v15 → visual
pass v16 → re-review). Current honest score: **7.5/10**. Scores per axis: Difficulty 7 ·
Balance 6 · Economy 6 · Art 9 · Readability 7.5 · Content depth 5.

*Standards note: a 2026-07-18 review arc scored this game 10/10 against a
scope-relative bar ("best feasible zero-asset solo browser TD") after the v11–v17
feature/QA passes. This roadmap grades against the absolute genre bar (BTD6-class)
instead — that is where the 7.5 and the milestones below come from. Same game, harder
ruler. (The 7/28 session's commits are also labeled "v15/v16" — unrelated to the
7/18 arc's pass names; go by date + hash.)*

The gap to 10 is not more features — it is **depth of decision, bosses worth the
letterbox, and killing the last lies**. Milestones are ordered by points-per-effort.
Every milestone lists its acceptance test; the debug harness (`?debug`, `TD.*`, the
shot listener on :5411, and the round-end hook bots from the review session) can run
all of them headlessly.

**Standing rules:** balance numbers live in `data/` · the game stays 100% procedural
(no imported art — the sticker language IS the brand) · every change re-verified by
a bot campaign before it ships.

---

## M1 — Kill the last lies (Readability 7.5 → 8.5) — ~1 session

The cheapest points on the board. Nothing new; everything stops lying.

1. **Make the 🎯 selector real on Trap-Jaw and Army Camp** (don't hide it — honor it).
   Snap: sort in-range bugs by the mode key, bite the top `maxTargets`. Camp: mode
   biases pile placement (First = trail-entry spots, Last = near-exit, Strong = the
   crossing/chokepoint nearest big bugs, Close = near the camp).
2. **Honeypot panel shows the stacked truth**: "pays 42/round here (2nd pot ×0.7)".
3. **Boss-leak stakes on the boss bar**: append "leak = −341 🍞" to the HP readout;
   tint it red when that number ≥ current crumbs (it reads "leak = death").
4. **Camo-blindness warning**: if the next wave has camo and no placed ant can see it,
   the wave preview gets a pulsing "🕶️ you can't see these!" chip. (The review-1 bot
   died at r17 to exactly this, silently.)
5. **Settings sticker**: SFX + music volume sliders (`setSfxVolume` already exists,
   unwired), screen-shake toggle, reduced-flash toggle (boss strobe / explosion flash
   caps — photosensitivity matters).

**Accept:** trap-jaw on Strong measurably prioritizes snails over mites (TD.hit log);
a no-detection board gets the chip on r7; both volume sliders audibly work (owner ears).

## M2 — Every tower a protagonist (Balance 6 → 8) — 1–2 sessions

Reference test: scripted Medium campaign ledger. Target: **no tower above 22%, none
below 5%, hero ≤ 15%.** (Today: hero 25%, Army ~0%, Exploder 4%.)

1. **Army Ant Camp rework** — cost 650 → 450; piles become **ambushes**: first bug with
   3+ layers (or boss) that steps on a pile triggers ALL remaining charges on it at
   once. Turns the trap tower into the anti-tank tower. Placement modes from M1.
2. **Exploder identity: scorched ground** — Napalm path leaves burn patches on the
   trail (3s, burns anything crossing, stacks with sticky gel). The AoE tower finally
   owns swarm rounds. Blast 55 → 62 if the ledger still reads under 8%.
3. **Weaver identity: setup tower** — snared ("rooted") bugs take +1 from all crush
   damage. Weaver+Trapjaw becomes a combo, not two towers standing near each other.
4. **Hero diet** — stretch `XP_LEVELS` past L5 by ~1.4× and shave hero base damage one
   notch; abilities untouched (heroes should be *moments*, not a free 25% DPS tower).
5. **Beacon Fury path** gets a visible aura pulse when its damage buff procs a kill —
   support should feel like it did something.

**Accept:** ledger spread within targets on Medium AND Hard bot runs; Army ≥ 6%;
no regression past r24 Hard prepared-build survival.

## M3 — Bosses worth the letterbox (Difficulty 7 → 9) — 1–2 sessions

1. **Boss leaks wound, they don't execute** — a leaking boss costs
   `min(RBE, max(30, ceil(crumbs × 0.5)))`. Losing to the same boss **twice** is death;
   once is a comeback story. (Today one stag = instant loss from full lives — Hard's
   tension currently survives *despite* this.) Keep full RBE in Crumbs of Steel.
2. **Second mechanic per boss** (all data-driven like `charge`):
   - Stag: keeps the charge. Add "antler toss": the first time it drops under 50%, it
     flings the nearest guard/minion aside (guards get 2s knockout) — telegraphed.
   - Caterpillar: sheds a snail at 75/50/25% HP thresholds instead of only on death —
     sustained pressure, not a death-burst surprise.
   - Queen: raises 2 wasp escorts every 15s while alive (air pressure during the
     ground fight); rage unchanged.
3. **Overtime gets a face** — rounds 41–60 each carry one named modifier stamped on
   the round banner: "ARMORED MOTHS" (moths gain plates), "NIGHT FALLS" (day maps
   switch to the night light pass — the v16 system makes this nearly free and it will
   look incredible), "STAMPEDE" (+40% speed, −30% count), "BROOD" (+1 child layer).
   Data field on WAVES rows; generic handlers.
4. **Freeplay r61+**: weekly-seeded modifier rotation instead of pure `k % n` arithmetic.

**Accept:** Hard bot with prepared build reaches r40 with 20–60 crumbs (bleeding, not
binary); boss-leak death requires two boss leaks; "NIGHT FALLS" renders day-map night
correctly (shot test).

## M4 — Decisions per run (Content depth 5 → 8) — 2–3 sessions

The 10 lives here. Wide-but-thin becomes build identity.

1. **Relic rework** — retire half the flat +stats; add build-arounds:
   - *Sugar-Free Colony*: no round salary; pops pay ×3. (Economy inversion — makes
     clean defense the income engine.)
   - *Monoculture*: your most-placed ant type +25% damage; all others −10%.
   - *Glass Colony*: +2 damage every ant; −50 max crumbs.
   - *Nocturne*: the map becomes night; ants inside lamp pools attack +30% faster.
   - *Queen's Dowry*: ascensions cost half; you can't place new ants after r25.
   - Keep ~6 tame ones for draft variety; the draft should force a plan, not a shrug.
2. **Challenge modes with teeth**: Camo Chaos also halves Beacon cost (fair fight);
   add "Broodmother" (+1 child layer on everything) and "Closing Time" (bugs +60%
   speed on the final third of the trail).
3. **Map twists for the twistless**: picnic — the jam jar drips a sticky slow-puddle
   that migrates each round (uses the existing hazard plumbing); garden — the pond
   mists at round start: +15% range for ants near it, camo bugs briefly visible.
4. *(Stretch)* **Gauntlets**: 6 authored puzzle setups (fixed sugar, fixed slots,
   "win r20–30") — the format that makes TD balance sing. Cut first if time is short.

**Accept:** three scripted bot runs with different relic drafts produce three
*different* damage-ledger shapes; Camo Chaos winnable by bot with beacon build.

## M5 — Mastery & retention (the 9 → 9.5 layer) — 1–2 sessions

1. **Run score** — pops × difficulty × no-leak streak × speed-of-clear; end-card grade
   (bronze→gold→👑). Local per-map best; the Daily chases score, not just "round 28",
   and the Nemesis taunts your *score*.
2. **Storm ranks in freeplay** — survive r50/60/70 → cosmetic trail trims per map
   (reuses the star-reward unlock plumbing).
3. **Achievement diet** — 10 of 16 fell out of one bot win. Retire the freebies into a
   "colony journal" checklist; add skill-gated ones: *No-Archer Victory*, *Five-Ant
   Board*, *Perfect Stag* (r24 Hard, zero leaks), *Sugar-Free 40* (relic win).
4. **Save-string export/import** on the stats page (protect 60-round runs).

## M6 — Ship-quality gates (the last half point) — ongoing

1. **Owner hardware hour** (the two things a bot cannot judge): a phone touch session
   and an audio listen at 1× on rounds 1–24 Hard. Checklist: does the stag telegraph
   raise your pulse? Do pops feel chunky at swarm scale? Does portrait layout cramp
   the shop?
2. **Phone perf insurance**: if real hardware dips under ~40fps in swarm rounds,
   pre-render bug bodies to per-type sprite canvases at bake time (identical look,
   ~3× cheaper draw). Only if measured — don't pay complexity for a problem the
   hardware doesn't have.
3. **Colorblind pass**: camo already has stripes + dashed outline (good); verify burn
   vs slow vs stun read in grayscale; add shape cues where they don't.
4. **Store presence**: 3 combat GIFs captured from live play (the 6 scenic loops
   exist); an itch.io page with the six-hours gallery; capsule art = the Night Porch
   lantern-trail shot.

---

## What we deliberately will NOT do

No 3D or imported assets (Sketchfab verdict stands — coherence is the moat). No
multiplayer. No map editor before M4 ships. No monetized meta. No second currency.
The whole game stays a ~350KB hand-drawn diorama that boots offline.

## Scoring forecast

| After | Difficulty | Balance | Economy | Art | Read. | Depth | Overall |
|---|---|---|---|---|---|---|---|
| today | 7 | 6 | 6 | 9 | 7.5 | 5 | **7.5** |
| M1+M2 | 7 | 8 | 6.5 | 9 | 8.5 | 5.5 | **8.3** |
| M3 | 9 | 8 | 6.5 | 9 | 8.5 | 6.5 | **8.8** |
| M4 | 9 | 8.5 | 7.5 | 9 | 8.5 | 8 | **9.4** |
| M5+M6 | 9 | 8.5 | 8 | 9.5 | 9 | 8.5 | **≈9.7** |

The last fraction of a point isn't on this list — it's the thing the game gets *known
for*. The candidate is already in hand: **the golden-hour ant diorama where every map
is a time of day**. Every milestone above should protect that sentence.
