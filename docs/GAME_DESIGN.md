# Game design — Neon Crusher

How the game works **today** (code at `1580a6e`) and the principles for
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
| Auto-fire | IMPLEMENTED | each turret fires one ball every `fireInterval` ms while `balls < maxBalls`; ball speed 230–280 px/s, radius 5, spawn 22 px ahead, ±0.5 rad spread |
| Bounces | IMPLEMENTED | exact reflection on blocks (only when the ball approaches the face), ±0.12 rad jitter on walls, constant speed; a ball caught inside the core (new level, resize) is moved out without a hit |
| Simulation | IMPLEMENTED (NC-PHYS-1) | fixed 1/240 s steps: the same game at 60/144/165 Hz; below 20 FPS the game slows down |
| Hit | IMPLEMENTED | +`moneyPerHit` cash, −`damageLevel` HP, spark burst (6), destruction burst (18) |
| Level-up | IMPLEMENTED | all blocks destroyed → level+1, new core; balls stay |
| Player input | IMPLEMENTED | only the three shop buttons; no interaction with the field |
| Balls despawn | NOT IMPLEMENTED | balls live forever (consequence: NC-10) |

## Levels (`qa/levels.mjs`)

| Rule | Status |
|---|---|
| Odd level → grid N×N, N = min(3 + ⌊(L−1)/2⌋, 7); block size from the canvas' short side, clamped 16–36 px, gap 5 | IMPLEMENTED |
| Even level → ring(s) of blocks, size 18–28 px; two rings from level 5 | IMPLEMENTED |
| Block HP = round(10 × 1.5^(L−1)); money per hit = max(1, round(1.5^(L−1))) | IMPLEMENTED |
| Turrets = min(1 + ⌊(L−1)/3⌋, 4) at N, E, S, W, at core extent + 44 px, at most min(w,h)/2 − 20 from the centre | IMPLEMENTED |
| Core fits the canvas: when turrets would come closer than 20 px to the core (short canvases, higher levels) the whole core is scaled down — same shape, block count and HP; re-fitted on every resize, restored to its generated size when there is room again | IMPLEMENTED (NC-PHYS-1) |
| Colours cycle cyan / pink / green | IMPLEMENTED |

## Economy (`qa/economy.mjs`)

| Upgrade | Cost | Effect | Status |
|---|---|---|---|
| New ball | ⌈10 × 1.5^(maxBalls−1)⌉ | `maxBalls` +1 (a cap the turrets refill to) | IMPLEMENTED |
| Fire rate | ⌈15 × 1.5^(lvl−1)⌉ | interval = max(300, 2200 × 0.85^(lvl−1)) ms | IMPLEMENTED, low value (NC-10) |
| Damage | ⌈15 × 1.5^(lvl−1)⌉ | ball damage = level (linear), applies to balls in flight | IMPLEMENTED |

Measured pace (bot, `qa/economy.mjs`, simulated, not players): median first
purchase 43 s on the 800×279 canvas (CrazyGames 800×450 iframe), 58 s on
907×339, 140 s on 1216×513 and > 5 min on 1920×909 (fullscreen); a greedy bot
clears level 1 in ~3–4 min on 907×339 and not within 15 min fullscreen. Pace
depends on screen size because the core does not scale with the canvas. These
numbers are a retention risk (NC-09), not targets.

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
| Onboarding / first-time hint | NOT IMPLEMENTED |
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
- 2026-11-09 (NC-BASIC-1, fast track to Basic Launch): English UI added (Polish kept), save validation + backup; no gameplay, balance or canvas-size change. UI copy: Cash/Kasa, Level/Poziom, Buy new ball/Kup nową kulę, Balls: n/Kulki: n, Fire rate/Szybkość strzału, Hit power/Siła uderzenia, Lvl n.
