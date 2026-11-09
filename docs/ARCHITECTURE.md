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
  A destroyed block stays in the list while `hitFlash > 0` (fade-out), then is
  filtered out.
- `Turret` — same offset-from-centre pattern. Fires by spawning a `Ball` into
  `Game` on a cooldown (`game.fireInterval`, ms), but only while
  `game.balls.length < game.maxBalls` — it has no ball supply of its own. It
  points outward from the core (compass N/E/S/W).
- `Ball` — position + velocity + fixed `speed`. `collideBlock(block)` is
  circle-vs-AABB (closest-point); it reflects velocity with
  `v' = v - 2(v·n)n`, renormalises to `speed` (no energy gain/loss over many
  bounces) and pushes the ball out along `n`. `bounceWalls` reflects off the
  canvas edges and adds a small random angle jitter (±0.12 rad) on wall bounces
  only — block bounces stay exact. Known defects: `docs/RISKS.md` NC-01, NC-02.
- `Particle` / `ParticlePool` — pooled particles (hit sparks, destruction
  bursts) capped at `MAX_PARTICLES` (400) to avoid GC churn.

Top-level helpers: `COLORS` (cyan/pink/green), `SAVE_KEY`, `SAVE_BACKUP_KEY`,
`MAX_PARTICLES`, `clamp`, `randRange` (uses unseeded `Math.random`);
`STRINGS` (en/pl table), `detectLanguage`, `translate`, `formatMoney`
(localization, `Game.t()`/`applyLanguage()`); `sanitizeSave` (pure save
validation, `docs/SAVE.md`).

## Frame loop

`loop(t)`: `dt = clamp((t - lastTime)/1000, 0, 0.05)` (below 20 FPS the game
slows down instead of taking big steps), then `update(dt)`, `draw()`.
`update`: turrets → balls move + wall bounce → ball/block collisions (each ball
resolves at most one block per frame, then `break`) → blocks fade → level-up
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
- both return points as **offsets from the core centre**;
  `repositionCoreAndTurrets()` (after every layout and resize) applies the
  current canvas centre — this is what makes the canvas resize-safe without
  regenerating the level or losing HP;
- block HP and money per hit scale `base × 1.5^(level-1)`;
- `placeTurrets()` adds one turret per 3 levels (N/E/S/W, max 4) at
  `core extent + 44 px`, clamped to `min(w,h)/2 - 20` (NC-14).

## Upgrades and economy (code view)

Costs `Math.ceil(base × 1.5^(level-1))` are getters (`ballCost`,
`fireRateCost`, `damageCost`) — recomputed, never stored. `ballDamage` reads
`damageLevel` live on every hit, so a damage upgrade boosts balls already in
flight. `maxBalls` is a cap, not a spawn count.

## Persistence and responsiveness

- `localStorage[SAVE_KEY]` stores only economic state; balls, blocks and
  turrets are regenerated from `level` on load. Full contract: `docs/SAVE.md`.
- Canvas backing store = CSS size × `devicePixelRatio`; `ctx.setTransform(dpr…)`
  is re-applied on every resize; all drawing uses CSS-pixel coordinates.
- Resize sources: `resize`, `orientationchange`, `ResizeObserver` on
  `#gameArea`. On resize, ball positions scale by the old/new size ratio,
  while core/turrets are re-centred from their offsets — two strategies for two
  data shapes, both in `Game.resize()`. Layout sizes are not recomputed (NC-15).

## Neon rendering convention

Every drawn shape (blocks, balls, turrets, particles) sets `ctx.shadowBlur`
(~15, boosted briefly on hit/fire flashes) and a matching `ctx.shadowColor`
before drawing, inside `ctx.save()`/`ctx.restore()`. That is the whole neon
glow and is expected on any new drawable. It is also the main rendering cost
(NC-13) — any change goes through `nc-performance` with a measurement.

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
- a fixed-timestep simulation (`accumulator`, e.g. 120 Hz substeps) — the fix
  path for NC-03 and NC-01/02;

Done in NC-BASIC-1: pure `sanitizeSave(data)` (NC-04/NC-05) and the i18n
table `STRINGS.en/pl` (NC-07), both visible to the harness.
