---
name: nc-physics
description: "Neon Crusher simulation: ball/block circle-AABB collisions, reflection, push-out, tunnelling, frame-rate independence (fixed timestep, 144/165 Hz), level layout geometry, turret placement, resize. Use when touching Ball, collisions, the loop/dt or layouts."
---

# nc-physics

**Scope:** `Ball`, `Block` geometry, `Game.loop/update` timing, collision
resolution, `gridLayout`/`circleLayout`/`placeTurrets`, resize geometry.
**Elsewhere:** what shapes levels should have → `nc-gameplay`; HP/money
numbers → `nc-economy`; draw cost → `nc-performance`.

## Read first
- `docs/ARCHITECTURE.md` sections "Frame loop", "Core / level generation",
  "Persistence and responsiveness" (resize part).
- `docs/RISKS.md` rows NC-01, NC-02, NC-03, NC-14, NC-15.
- `qa/physics.mjs`, `qa/levels.mjs` (what is pinned today).
- In `game.js` read only `Ball`, `Game.update`, `Game.loop`, layout methods.

## Invariants
- Block bounces stay exact and speed-preserving; jitter only on walls.
- No tunnelling: max step per (sub)step < thinnest obstacle (block + ball
  diameter); `qa/physics.mjs` checks it — keep it true when speeds change.
- Results must not depend on refresh rate (CrazyGames: 144/165 Hz).
- Keep the level-up order: compute `aliveRemaining` before filtering blocks.
- Keep the offset-from-centre pattern for core-attached objects.

## Procedure
1. Reproduce with the harness (`loadGame` in `qa/lib.mjs`, seeded, `h.run(s, hz)`).
2. Write the failing check first (turn the KNOWN row into a real check).
3. Fix in `game.js` with the smallest change; prefer a fixed-timestep
   accumulator (substeps) over speed caps; resolve only approaching contacts
   (`v·n < 0`); push out fully along the minimum-overlap axis.
4. Run `node qa/physics.mjs` (full, 48 seeds) and `qa/levels.mjs` on base and
   candidate; compare hit rates 60/144/165 Hz and cash per minute (economy
   impact goes to `nc-economy`).

## Done when
KNOWN rows fixed become PASS checks, `docs/RISKS.md` updated, refresh-rate z
< 2 at 48 seeds, economy pace change reported.

## Stop and ask
A fix that changes income pace by more than ~10 % (economy decision) or
changes how levels look.
