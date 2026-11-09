# Architecture and coding conventions

Canonical description of the code as it is (base `1580a6e`, verified by
NC-FOUNDATION-1 with `qa/`). Gameplay rules and numbers live in
`docs/GAME_DESIGN.md`; the save contract in `docs/SAVE.md`.

## Files

Three runtime files, plain HTML/CSS/JS, no dependencies, no bundler, no build:

| File | Role |
|---|---|
| `index.html` | canvas `#gameCanvas` inside `#gameArea`, top bar (`#statCash`, `#statLevel`), shop (`#btnBuyBall`, `#btnFireRate`, `#btnDamage` with `desc*`/`cost*` spans), loads `style.css` and `game.js` (classic script, relative paths) |
| `style.css` | neon dark theme, flex column `#app` (`100dvh` with `100%` fallback), 3-column shop grid, `env(safe-area-inset-bottom)` padding, breakpoints 640 px / 900 px |
| `game.js` | all logic, vanilla ES classes, `'use strict'`, started on `DOMContentLoaded` |

Everything else in the repo (`docs/`, `qa/`, `.claude/`, `.github/`) is dev-only.
Note: GitHub Pages currently publishes the whole repo root (`docs/RELEASE.md`).

## Class structure (`game.js`)

- `Game` — owns the canvas, all game state, the `requestAnimationFrame` loop
  (`loop` → `update(dt)` / `draw()`), the DOM-bound upgrade shop and
  persistence. Everything else is driven by it.
- `Block` — one cell of the core. Stores `offsetX/offsetY` relative to the
  core's centre (not absolute coordinates) plus `size`, `hp`/`maxHp`,
  `moneyPerHit`, `color`, `alive`, `hitFlash`. `applyCenter(cx, cy)` turns the
  offset into absolute top-left `x/y`; this makes resize/relayout cheap.
  `baseOffsetX/baseOffsetY/baseSize` keep the geometry as generated;
  `applyScale(s)` derives the current offsets/size from them. A destroyed block stays in the list while `hitFlash > 0` (fade-out), then is
  filtered out.
- `Turret` — same offset-from-centre pattern. Fires by spawning a `Ball` into
  `Game` on a cooldown (`game.fireInterval` = fixed `BALL_REFILL_INTERVAL`
  700 ms since NC-ORIGINAL-1), but only while
  `game.balls.length < game.maxBalls` — it has no ball supply of its own. It
  sits N/E/S/W of the core (unit vector `dirX/dirY`) and aims at it.
- `Ball` — position + velocity + fixed `speed`. `collideBlock(block)` is
  circle-vs-AABB (closest-point); it reflects velocity with
  `v' = v - 2(v·n)n`, renormalises to `speed` (no energy gain/loss over many
  bounces) and pushes the ball out along `n` — only when the ball approaches
  (`v·n < 0`); a ball already moving away is left alone and scores nothing
  (NC-01). A centre inside the block leaves through the nearest face, fully
  (NC-02). `bounceWalls` reflects off the canvas edges and adds a small random
  angle jitter (±0.12 rad) on wall bounces only — block bounces stay exact.
- `Particle` / `ParticlePool` — pooled particles (hit sparks, destruction
  bursts) capped at `MAX_PARTICLES` (400) to avoid GC churn.
- Breach (NC-ORIGINAL-1): `Block.kind` = `armor` / `relay` / `heart`,
  `Block.shatter` (seconds until the shatter wave breaks it, or null);
  `Game.placeHeart/placeRelays` (in `generateCore`), `requestVolley` (input →
  `pendingVolley`, resolved in `updateVolley` on the next fixed step),
  `fireVolley`, `castLance` (ray vs grown block boxes: `rayBoxEnter`,
  `rayBoxExit`), `hitBlock` (the one place a hit pays and damages, from balls,
  lances and shockwaves), `onBlockDestroyed` → `triggerRelay` / `shatterCore`,
  `updateShatter`, `autoTarget`. Effects: `Lance`, `Ring` (capped
  `MAX_LANCES` 8, `MAX_RINGS` 12), banner, screen flash, shake; NC-ART-1:
  `Arc` (relay surge, `MAX_ARCS` 8), `Game.breach` (finale), core assembly
  (`coreBornAt`, `CORE_ASSEMBLY_TIME`), `markInnerShield` (cosmetic layer),
  `buildNetwork` → `links` drawn by `drawNetwork` (neural lattice; pulse
  phase `netPhase`/`netSpeed`), `syncFlash` (volley sync line).
- `Sound` — synthesised Web Audio (oscillators only), created/resumed in a
  user gesture, per-sound minimum gap, mute under `AUDIO_PREF_KEY`. Neither
  `Sound` nor `draw()` may call `Math.random` (the simulation RNG must not
  depend on frames drawn or on the sound setting — NC-03).

Top-level helpers: `COLORS` (palette, `docs/GAME_DESIGN.md`), `hash01`,
`chamferPath`/`polygonPath`/`jaggedPath` (drawing), `SAVE_KEY`, `SAVE_BACKUP_KEY`,
`MAX_PARTICLES`, `SIM_STEP`/`MAX_FRAME_DT` (loop), `TURRET_CLEARANCE`/
`TURRET_MARGIN`/`TURRET_EDGE_INSET` (core fitting), `clamp`, `randRange` (uses unseeded `Math.random`);
`STRINGS` (en/pl table), `detectLanguage`, `translate`, `formatMoney`
(localization, `Game.t()`/`applyLanguage()`); `sanitizeSave` (pure save
validation, `docs/SAVE.md`).

## Frame loop

`loop(t)`: fixed timestep (NC-03). `frameDt = clamp((t - lastTime)/1000, 0,
MAX_FRAME_DT = 0.05)` is added to `accumulator`; while it holds a whole
`SIM_STEP` (1/240 s) the loop runs `update(SIM_STEP)` and counts `simSteps`;
then one `draw()`. Every refresh rate runs the same steps in the same order,
so the same seed gives the same game at 60/144/165 Hz (`qa/physics.mjs`).
Below 20 FPS the game slows down instead of running a burst of steps. 60 Hz =
4 steps per frame, 144 Hz ≈ 1.7, 165 Hz ≈ 1.5; draw shows the latest step
(no interpolation: a ball moves ≤ 1.2 px per step). Anything in `update` must
use `dt`, never "per call" factors (particle drag is `0.985^(dt·60)`).
`update`: turrets → balls move + wall bounce → ball/block collisions (broad
phase: a ball outside the core's bounding box ± radius skips the block loop —
exact, keeps 4 steps/frame cheaper than the old 1 step; each ball resolves at
most one hit per step, then `break`) → blocks fade → level-up
check → particles → UI refresh every 0.15 s → autosave every 5 s.

The level-up check computes `aliveRemaining` from `this.blocks` **before**
filtering out fully faded dead blocks — reverse the order and the
level-complete condition silently never fires (this happened once; see git
history).

## Core / level generation

`Game.generateCore(level)` rebuilds `this.blocks` and `this.turrets` from
scratch on every level-up (balls are kept):
- odd levels → `gridLayout()` (N×N, N grows with level, capped at 7); even
  levels → `circleLayout()` (one ring, two rings from level 5);
- both return points as **offsets from the core centre**; `generateCore`
  records the unscaled core half-size (`coreRadius`) and `extent`;
- `placeTurrets()` creates one turret per 3 levels (N/E/S/W, max 4);
- `fitCoreToCanvas()` (after every generation and every resize) scales the
  core down — never up past its generated size — so that turrets at
  `min(extent + 44, min(w,h)/2 − 20)` keep `TURRET_CLEARANCE` (20 px) from it
  (NC-14), sets the turret offsets, calls `repositionCoreAndTurrets()` (applies
  the canvas centre) and `ejectFromCore()` for every ball whose centre ended up
  inside a block (moved straight away from the core centre, no hit; NC-02).
  Where the core fits (all desktop CrazyGames canvases) scale = 1 and the
  geometry is exactly the generated one; it shrinks only on short canvases at
  higher levels (`qa/levels.mjs` INFO lists the cases);
- block HP and money per hit scale `base × 1.5^(level-1)`.

## Upgrades and economy (code view)

Costs `Math.ceil(base × 1.5^(level-1))` are getters (`ballCost`,
`fireRateCost`, `damageCost`) — recomputed, never stored. `fireRateCost` /
`fireRateLevel` keep their names (save compatibility) but drive the volley
charge (`recalcFireInterval` sets `chargeTime`). `ballDamage` reads
`damageLevel` live on every hit, so a damage upgrade boosts balls already in
flight. `maxBalls` is a cap, not a spawn count.

## Persistence and responsiveness

- `localStorage[SAVE_KEY]` stores only economic state; balls, blocks and
  turrets are regenerated from `level` on load. Full contract: `docs/SAVE.md`.
- Canvas backing store = CSS size × `devicePixelRatio`. **World units**
  (NC-CORE-1A): `viewScale = max(1, min(w, h) / WORLD_SHORT_SIDE)` (250);
  `Game.width/height` are the world size (CSS size ÷ `viewScale`) and
  `ctx.setTransform(dpr × viewScale…)` is re-applied on every resize, so all
  simulation and drawing use world units. HUD drawn on the canvas (core
  progress bar) switches to `setTransform(dpr…)` and uses CSS pixels; `+$n`
  labels pick a world font size for a fixed screen size.
- Resize sources: `resize`, `orientationchange`, `ResizeObserver` on
  `#gameArea`. On resize, ball positions scale by the old/new size ratio,
  then `fitCoreToCanvas()` re-fits the core from its generated geometry
  (shrinks it on a small canvas, restores it on a large one), places the
  turrets and ejects embedded balls; block HP and state are untouched (NC-15).
  A core generated on a small canvas stays small after enlarging until the
  next level.

## Neon rendering convention

Every drawable glows in its own colour (look and palette:
`docs/GAME_DESIGN.md` "Visual identity"). Since NC-ART-1:
- **Batched passes.** `Block.drawCore` draws the whole core in passes (plate
  bodies, panel lines, tint + circuits per colour, outline + lit rim per
  colour and damage stage, cracks, shatter marks, hit flashes), one path per
  pass and colour; `Ball.drawAll` and `ParticlePool.draw` batch the same way.
  No `save()/restore()` or shadow per block, ball or particle.
- **Glow.** `shadowBlur` + matching `shadowColor` for small shapes (turrets,
  heart, relays, lances, arcs, rings, sparks, HUD). A blurred batch that spans
  a large area is expensive in software raster (Skia blurs the batch's bounds:
  60 balls at 1920×1080 cost ~22 ms/frame), so balls use a translucent halo
  and plate rims a wide translucent underlay stroke on the same path.
- **Background** is rendered once per canvas size into an offscreen canvas
  (`renderBackground`) and drawn with one `drawImage`; without
  `document.createElement` (QA harness) a plain fill is used.
- **No `Math.random` in drawing** (NC-03): cosmetic variety comes from
  `hash01(seed)` (block `seed` from its generated offset) and `this.time`.
  Cosmetic state (`arcs`, `breach`, `coreBornAt`, `links`, `netPhase`,
  `netSpeed`, `syncFlash`, block `layer`/`seed`/
  `outCorner`/`variant`, label `big`) never feeds the simulation;
  `qa/sim-compare.mjs` proves the simulation is bit-identical to a base build.
- Every glow change goes through `nc-performance` with a measurement
  (`qa/art-shots.mjs` frame probe, `qa/sim-compare.mjs` draw counters).

## Coding conventions

- Vanilla ES2020+ classes in `game.js`; no frameworks, no dependencies, no
  build step. A module split (ES modules, static relative imports) or any new
  runtime file is an owner decision and changes `qa/integrity.mjs`.
- Comments and identifiers in English; every player-facing string lives in
  `STRINGS.en` and `STRINGS.pl` and goes through `Game.t()` (`nc-ux`,
  `qa/i18n.mjs`); `index.html` carries the English defaults.
- Player text via `textContent`, never `innerHTML` (`qa/integrity.mjs`).
- Keep the offset-from-centre pattern for anything attached to the core.
- Keep physics exact on block bounces; randomness only where it is design.
- New tunable numbers go to one named constant/config, not inline literals,
  and into `docs/GAME_DESIGN.md`.
- Small, reviewable diffs; one concern per commit.

## Test seams (QA harness) and planned runtime hooks

`qa/lib.mjs` runs the real `game.js` in `node:vm` with a fake DOM, a seeded
`Math.random` and a manual `requestAnimationFrame` pump. This works without
any runtime change because the classes are top-level declarations of a classic
script. Planned hooks (each needs its own approved runtime stage):

- an injectable RNG (`Game` option or `NC_RNG`) — needed only if gameplay
  seeds become a feature (daily layouts);

Done in NC-ORIGINAL-1: the fake canvas takes listeners; `h.pointer(type,
x, y, extra)` and `h.key(code)` drive the real input handlers; fake elements
have `setAttribute`/`attributes`/`blur`. `Game.volleyCharge`, `volleyReady`,
`manualVolleys`, `autoVolleys`, `coresShattered`, `fireVolley`, `hitBlock`
are readable seams. Browser smoke observes the volley only through the DOM
(hint state), never through a debug hook.

Done in NC-CORE-1A: the harness's fake elements have `hidden` and a
`classList` (the hint and the suggested shop button); `Game.viewScale`,
`coreProgress`, `floatTexts` are readable state.

Done in NC-PHYS-1: fixed-timestep loop with a `simSteps` counter (the harness
compares states at equal step counts across refresh rates); `NC_GAME_JS=<path>`
makes every suite and `qa/pace.mjs` load another `game.js` (base vs candidate).

Done in NC-BASIC-1: pure `sanitizeSave(data)` (NC-04/NC-05) and the i18n
table `STRINGS.en/pl` (NC-07), both visible to the harness.
