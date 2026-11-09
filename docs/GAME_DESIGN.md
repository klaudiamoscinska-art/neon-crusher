# Game design — Neon Crusher

How the game works **today** (code after NC-CORE-1A) and the principles for
changing it. Statuses: `IMPLEMENTED` (in code and checked by `qa/`),
`PARTIAL`, `NOT IMPLEMENTED`, `NOT VERIFIED` (in code, no evidence yet).
Change this file together with any gameplay/balance/text change.

## Identity

Physics-sandbox idle game, cyberpunk neon. Turrets auto-fire balls that
bounce around the canvas and grind down a destructible block core; every hit
pays cash; cash buys idle upgrades; clearing the core levels up and
regenerates a harder one. One screen, no menus. Target portal: CrazyGames
(`docs/CRAZYGAMES.md`).

## Core loop

| Element | Status | Rule / numbers |
|---|---|---|
| Auto-fire | IMPLEMENTED | each turret fires one ball every `fireInterval` ms while `balls < maxBalls`; turrets **aim at the core** (NC-CORE-1A: every new ball starts with a hit); ball speed 230–280 units/s, radius 5, spawn up to 22 units ahead but outside the core's box, ±0.5 rad spread |
| Bounces | IMPLEMENTED | exact reflection on blocks (only when the ball approaches the face), ±0.12 rad jitter on walls, constant speed; a ball caught inside the core (new level, resize) is moved out without a hit |
| Simulation | IMPLEMENTED (NC-PHYS-1) | fixed 1/240 s steps: the same game at 60/144/165 Hz; below 20 FPS the game slows down |
| Hit | IMPLEMENTED | +`moneyPerHit` cash, −`damageLevel` HP, spark burst (6), destruction burst (18) |
| Level-up | IMPLEMENTED | all blocks destroyed → level+1, new core; balls stay |
| Player input | IMPLEMENTED | only the three shop buttons; no interaction with the field (the hint overlay lets taps through) |
| Balls despawn | NOT IMPLEMENTED | balls live forever (consequence: NC-10) |

## Levels (`qa/levels.mjs`)

| Rule | Status |
|---|---|
| Odd level → grid N×N, N = min(3 + ⌊(L−1)/2⌋, 7); block size from the canvas' short side, clamped 16–36 px, gap 5 | IMPLEMENTED |
| Even level → ring(s) of blocks, size 18–28 px; two rings from level 5 | IMPLEMENTED |
| Block HP = round(10 × 1.5^(L−1)); money per hit = max(1, round(1.5^(L−1))) | IMPLEMENTED |
| Turrets = min(1 + ⌊(L−1)/3⌋, 4) at N, E, S, W, at core extent + 44 px, at most min(w,h)/2 − 20 from the centre | IMPLEMENTED |
| Core fits the canvas: when turrets would come closer than 20 units to the core (with the world scale: from level 8 on every canvas, as before on 800×450) the whole core is scaled down — same shape, block count and HP; re-fitted on every resize, restored to its generated size when there is room again | IMPLEMENTED (NC-PHYS-1) |
| Colours cycle cyan / pink / green | IMPLEMENTED |
| **World scale** (NC-09): positions and sizes are world units; a canvas whose short side exceeds 250 px shows a 250-unit-high world enlarged by short/250 (same aspect), smaller canvases are drawn 1:1. The core therefore takes ~47 % of the field height at every CrazyGames size and the hit rate no longer falls on big screens. All level rules above (16–36, 0.55, 0.045, +44, −20) are in world units | IMPLEMENTED (NC-CORE-1A) |

## Economy (`qa/economy.mjs`)

| Upgrade | Cost | Effect | Status |
|---|---|---|---|
| New ball | ⌈10 × 1.5^(maxBalls−1)⌉ | `maxBalls` +1 (a cap the turrets refill to) | IMPLEMENTED |
| Fire rate | ⌈15 × 1.5^(lvl−1)⌉ | interval = max(300, 2200 × 0.85^(lvl−1)) ms | IMPLEMENTED, low value (NC-10) |
| Damage | ⌈15 × 1.5^(lvl−1)⌉ | ball damage = level (linear), applies to balls in flight | IMPLEMENTED |

Measured pace (bot, simulated, not players; fresh save, 32 seeds, identical
at 60/144/165 Hz): median first purchase (p25–p90) 29.5 s (22–45.5) on the
800×279 canvas (CrazyGames 800×450 iframe), 27 s (19.5–37.5) on 907×339,
23.5 s (16.5–34) on 1216×513, 20.5 s (16–35) on 1920×909 (fullscreen); level 1
cleared by a greedy bot in a median 1.3–2 min. Before NC-CORE-1A: 40.5 s,
61.5 s, 140 s and 387.5 s. Design target: first purchase in 20–45 s, median
< 60 s on every size (`qa/economy.mjs` pins both). Prices unchanged; the
faster mid-game on big screens is a side effect of the world scale (NC-CORE-1A
PR, `qa/pace.mjs`).

| Feature | Status |
|---|---|
| Offline / idle earnings while away | NOT IMPLEMENTED |
| Prestige / rebirth | NOT IMPLEMENTED |
| Goals, achievements, milestones beyond the level | NOT IMPLEMENTED |
| Active interaction (tap/click on the field) | NOT IMPLEMENTED |

## Presentation

| Element | Status |
|---|---|
| Neon glow on every shape (`shadowBlur`) | IMPLEMENTED (cost: NC-13) |
| Particles (pool of 400) | IMPLEMENTED |
| HUD: cash (number format of the UI language), level | IMPLEMENTED |
| English UI (default and fallback) + Polish UI; language from `?lang=en/pl`, else the browser's preferred languages | IMPLEMENTED (NC-BASIC-1); CrazyGames SDK locale: Full Launch |
| Audio | NOT IMPLEMENTED |
| Onboarding / first-time hint | IMPLEMENTED (NC-CORE-1A): on a fresh save (level 1, no upgrade) a pill over the bottom of the field says "Every hit on the core pays cash" / "Każde trafienie w rdzeń to kasa", then "Buy a new ball!" / "Kup nową kulę!" while the ball button pulses once it is affordable; gone after the first purchase; derived from the save, nothing stored; `pointer-events: none` |
| Hit feedback: `+$n` label at the hit (money format of the UI language), rises and fades in 0.8 s; at most 10 at once; 12 px on screen (up to 18 px on big screens) | IMPLEMENTED (NC-CORE-1A) |
| Core progress: "Core n%" / "Rdzeń n%" + bar (destroyed HP ÷ core HP) in the field's top-left corner, CSS pixels | IMPLEMENTED (NC-CORE-1A) |
| Responsive layout (phone/desktop), safe areas (all sides), no text selection | IMPLEMENTED; smallest text 11.2 px at DPR 1; canvas share at 800×450 still 62 % (NC-17); notched device NOT VERIFIED |
| Save across reloads | IMPLEMENTED (`docs/SAVE.md`) |

## Design principles (for every future change)

1. **Fun in the first minute.** A new player must see a purchase and a visible
   power jump within ~60 s (CrazyGames counts a conversion at 1 min of play).
2. **Readable cause → effect.** Every upgrade must change something the player
   can see within seconds; an upgrade without visible effect is a bug (NC-10).
3. **Physics is the toy.** Exact, deterministic-feeling bounces; spectacle
   from physics and particles, not from text.
4. **Honest idle.** No energy, no timers in front of play, no paywall; ads
   (Full Launch only) never gate the core loop (`docs/CRAZYGAMES.md`).
5. **Originality.** The bouncing-balls-vs-bricks idle loop is an established
   genre; Neon Crusher must earn a distinct twist before submission (NC-12).
6. **Small and fast.** Zero external requests, tiny build, smooth on a 4 GB
   Chromebook and on phones.
7. **Progress is sacred.** Never reset or corrupt a player's save
   (`docs/SAVE.md`).

## Decisions log

Owner decisions that change this file are recorded here with a date.

- 2026-11-09 (NC-FOUNDATION-1): baseline documented; no gameplay change.
- 2026-11-09 (NC-CORE-1A, PR pending GPT review + owner approval): first minute — world scale 250 (NC-09), turrets aim at the core, core progress bar, `+$n` labels, first-minute hint; no price, reward, HP or save change. Alternative for the owner: world scale 280 (800×450 unchanged 1:1, slower mid-game). Active-play twist (NC-10/11/12) proposed, not implemented.
- 2026-11-09 (NC-BASIC-1, fast track to Basic Launch): English UI added (Polish kept), save validation + backup; no gameplay, balance or canvas-size change. UI copy: Cash/Kasa, Level/Poziom, Buy new ball/Kup nową kulę, Balls: n/Kulki: n, Fire rate/Szybkość strzału, Hit power/Siła uderzenia, Lvl n.
