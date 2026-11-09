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
- `docs/RISKS.md` NC-13 (glow cost) before adding glow or particles.

## Rules
- Glow convention: `save()` → `shadowColor` = fill colour, `shadowBlur` ~15
  (boost briefly on events) → draw → `restore()`; keep it for new drawables
  unless `nc-performance` replaces it with a cached sprite of identical look.
- Palette: cyan `#00f3ff`, pink `#ff007f`, green `#39ff14` on black — this is
  the game's identity (GLITCH GULP's palette rules do not apply here).
- Effects serve readability: hits, breaks and level-ups must be distinguishable
  at a glance; no flashing faster than 3 Hz over large areas (photosensitivity).
- Respect `prefers-reduced-motion` for shake/flash once such effects exist.
- Covers: original art, title text only, no borders/badges, consistent across
  1920×1080, 800×1200, 800×800 (`docs/CRAZYGAMES.md`).

## Procedure
1. Screenshot/record base; implement; compare at 800×450 and 1920×1080.
2. Count draw work with the harness context counters (`h.ctx.__calls`) on a
   late-game state (e.g. 24+ balls, 80 blocks) — report before/after.

## Done when
Visual change shown in screenshots, draw-call delta reported, no new
external assets or requests.

## Stop and ask
Palette or identity change, imported art/fonts (licence), anything that could
look like another game's assets.
