# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Neon Crusher — a physics-sandbox idle game. Cyberpunk-neon Breakout-style core: turrets auto-fire balls that bounce around a canvas and grind down a destructible block structure, paying out cash per hit; cash buys idle upgrades; clearing the structure levels up and regenerates a harder one.

## Commands

There is no build system, package manager, linter, or test suite in this repo — it's plain HTML/CSS/JS with no dependencies.

- **Run the game**: open `index.html` directly in a browser, or serve the directory statically (e.g. `npx http-server -p 8080` or `python3 -m http.server 8080`) and visit it. No build step, no `npm install`.
- **Verify a change**: reload the page and watch it play for a few seconds (cash should climb as the ball hits blocks; the panel buttons should light up once cash covers their cost). There's no automated test harness, so manual/browser verification is the only check.

## Architecture

Three files, kept deliberately separate (no bundler): `index.html` (canvas + shop/stat DOM), `style.css` (neon dark theme), `game.js` (all logic, vanilla ES classes, no dependencies).

### Class structure in `game.js`

- `Game` — owns the canvas, all game state, the `requestAnimationFrame` loop (`update(dt)` / `draw()`), the DOM-bound upgrade shop, and persistence. Everything else is driven by it.
- `Block` — one cell of the core. Stores `offsetX/offsetY` relative to the core's center (not absolute coordinates) plus `size`, `hp`/`maxHp`, `moneyPerHit`, `color`. `applyCenter(cx, cy)` converts the stored offset into absolute `x/y`; this is what makes resize/relayout cheap (see below).
- `Turret` — same offset-from-center pattern as `Block`. Fires by spawning a `Ball` into `Game` on a cooldown (`game.fireInterval`), but only refills up to `game.maxBalls` — it does not have its own ball supply.
- `Ball` — position + velocity. `collideBlock(block)` does circle-vs-AABB collision (closest-point method) and reflects velocity with `v' = v - 2(v·n)n`, then renormalizes to the ball's fixed `speed` so balls never gain/lose energy over many bounces. `bounceWalls` reflects off canvas edges and adds a small random angle jitter on wall bounces only (kept off block bounces, where reflection must stay exact).
- `Particle` / `ParticlePool` — object-pooled particle system (hit sparks + destruction bursts) capped at `MAX_PARTICLES`; pooling avoids GC churn since this game intentionally throws a lot of glowing particles per hit.

### Core/level generation

`Game.generateCore(level)` rebuilds `this.blocks` and `this.turrets` from scratch every level-up:
- Shape alternates by level parity: odd levels → `gridLayout()` (NxN grid, N grows with level, capped), even levels → `circleLayout()` (one ring, two rings from level 5+).
- Both layout functions return points as **offsets from the core center**, not absolute coordinates — `repositionCoreAndTurrets()` (called after every layout and after every resize) applies the current canvas center to them. This is the mechanism that makes the canvas resize-safe without regenerating the level or losing HP state.
- Block HP and money-per-hit scale as `base * 1.5^(level-1)` (10 HP / $1 base) — this is the "+50% HP, +50% money per level" rule from the design.
- `placeTurrets()` adds one turret per 3 levels (compass points N/E/S/W, capped at 4), positioned at `core extent + margin` from center.
- The level-up check in `Game.update()` computes `aliveRemaining` from `this.blocks` **before** filtering out fully-faded dead blocks — get this order wrong and the level-complete condition silently never fires (this bit us once already; see git history).

### Upgrades & economy

Three upgrade tracks (`maxBalls`, `fireRateLevel`, `damageLevel`), each with cost `Math.ceil(base * 1.5^(currentLevel-1))` — pure function of the current level, recomputed on demand via the `ballCost`/`fireRateCost`/`damageCost` getters, not stored. `ballDamage` is read live from `damageLevel` by every hit (not cached per-ball), so a damage upgrade retroactively boosts balls already in flight. `maxBalls` is a cap, not a spawn count — turrets top up toward it opportunistically, they don't own ball ownership individually.

### Persistence & responsiveness

- `localStorage` under `neonCrusher.save.v1` stores only the economic state (`cash`, `level`, `maxBalls`, `fireRateLevel`, `damageLevel`) — balls/blocks/turrets are always regenerated fresh from `level` on load, never serialized. Autosaves every 5s plus on `visibilitychange`/`pagehide`/`beforeunload`.
- Canvas backing store is sized to `devicePixelRatio` and `ctx.setTransform(dpr,0,0,dpr,0,0)` is reapplied on every resize; all drawing code still works in CSS-pixel (logical) coordinates.
- On resize, ball positions are scaled by the old/new width-height ratio (not clamped to the same offset), while core/turret positions are recomputed from their stored center-offsets — two different strategies for two different data shapes, both landing in `Game.resize()`.

### Neon rendering convention

Every drawn shape (blocks, balls, turrets, particles) sets `ctx.shadowBlur` (~15, boosted temporarily on hit/fire flashes) and `ctx.shadowColor` matching its fill before drawing, then `ctx.save()`/`ctx.restore()` around it — this is the entire "neon glow" effect and is expected on any new drawable added to the game.
