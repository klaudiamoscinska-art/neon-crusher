---
name: nc-visual-fx
description: "Neon Crusher canvas visuals and juice: neon glow convention, palette, blocks/balls/turrets drawing, particles, hit flashes, screen shake, level-up spectacle, cover art direction. Use for any change to what is drawn on the canvas."
---

# nc-visual-fx

**Scope:** `draw()` methods, `COLORS`, `ParticlePool` effects, feedback
animations, visual identity, art direction for CrazyGames covers/videos.
**Elsewhere:** DOM/HUD → `nc-ux`; frame cost → `nc-performance` (every new
effect gets a cost note); sound → `nc-audio`.

## Read first
- `docs/ARCHITECTURE.md` "Neon rendering convention".
- `docs/VISUAL_IDENTITY.md` (element-by-element look) for the element you change.
- `docs/RISKS.md` NC-13 (glow cost) before adding glow or particles.

## Rules
- Glow and batching: `docs/ARCHITECTURE.md` "Neon rendering convention"
  (batched passes; no blurred batch over a large area; no `Math.random`).
- Palette and meaning (graphite, cyan, magenta, amber, green = money only):
  `docs/GAME_DESIGN.md` "Visual identity" (NC-ART-1). A new drawable gets a
  colour by meaning, not by rotation.
- Effects serve readability: hits, breaks and level-ups must be distinguishable
  at a glance; no flashing faster than 3 Hz over large areas (photosensitivity).
- Respect `prefers-reduced-motion` for shake/flash once such effects exist.
- Covers: original art, title text only, no borders/badges, consistent across
  1920×1080, 800×1200, 800×800 (`docs/CRAZYGAMES.md`).

## Procedure
1. `qa/art-shots.mjs` on the base and the candidate (same scenes, frame
   probe), side-by-side sheets with `--sheet`.
2. `qa/sim-compare.mjs <base game.js>`: simulation identical + draw counters
   before/after.

## Done when
Visual change shown in screenshots, draw-call delta reported, no new
external assets or requests.

## Stop and ask
Palette or identity change, imported art/fonts (licence), anything that could
look like another game's assets.
