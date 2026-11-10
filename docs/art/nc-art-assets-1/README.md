# NC-ART-ASSETS-1 — candidate sprite pack: evaluation and decision

Stage NC-ART-ASSETS-INTEGRATION-1 (2026-11-10, base `origin/main`
`3b23a6e`, after PR #8 NC-ART-1). Input: the owner's package
`NEON_CRUSHER_CG_ART_INTEGRATION_READY.zip` — 27 procedural RGBA sprites
(256/128/64 px), an atlas, 2 JPG arena backgrounds, previews, a concept
moodboard (not runtime) and the Python build script. The package itself is
**not** in the repo (nothing of it ships); this folder holds the evidence.

## Decision: DROP for runtime (all 27 sprites + 2 backgrounds), MODIFY the pack

No sprite clearly improves the running game, so none was integrated and the
production look stays NC-ART-1 (procedural Canvas 2D). Runtime files
(`index.html`, `style.css`, `game.js`) are unchanged in this stage.

The gate (coordinator audit): accept only if a real BEFORE vs AFTER clearly
improves readability and recognisability without a regression. Every
candidate was drawn **inside the real game** (Chromium, same seeded layout,
same scenes as the base) and failed that gate:

| Asset group | Tried in game as | Result | Why |
|---|---|---|---|
| `heart_core_fracture0-2` | the heart (main target), stage by HP thirds | DROP | at 22–49 px a dark multi-colour blob; the amber target shrinks to under half of the cell; its built-in cyan/violet shards repeat the real armour around it; the 3 fracture states are indistinguishable in play (the procedural seal/split shows HP continuously) — `01`, `02`, `05`, `08`, `09` |
| `relay_idle` / `relay_overload` | relay inside its collider, overload from damage stage 2 | DROP as is | much dimmer than the procedural relay; the visible capacitor covers about two thirds of the square collider — `02`, `03` |
| relay, variant MODIFY-B | sprite + bright procedural hex shell | not adopted (owner may pick) | brightness restored and the orange crystal reads at DPR 2 / 1920×1080, but the relay now uses the heart's language (amber outline + vertical crystal), weakening the heart-vs-relay hierarchy; the target looks smaller than its collider (NC-21 direction) — `11`, `12` |
| `turret_fork_*` (4) | the four turret states, rotated to aim at the core | DROP | 3/4 perspective (elliptical pad) in a top-down game, looks wrong rotated E/W; smaller and darker; loses the four-segment volley charge ring (gameplay information) — `02`, `05`, `09` |
| `fx_breach_impact` | one-shot flash at the heart for 0.4 s of the breach | DROP | invisible in the busy shatter frame — `04` |
| `fx_lockon` | the mouse aim reticle | DROP | thin and dim next to the procedural magenta brackets — `10` |
| `armor_v1-v3_damage0-3` (12) | every armour plate by variant / damage stage | DROP | flat grey slabs: the neon rim, the violet inner-shield layer and the scale structure disappear; irregular silhouettes do not match square colliders (NC-21); detail lost below ~36 px — `00`, `13`, `14`, `15` |
| `orb_player` | every ball, rotated along its velocity | DROP | balls become smaller and darker (they must stay the brightest small objects) — `14`, `15` |
| `arena_neural_dark` (+ `arena_critical_dark`, same style) | the background, cover-scaled | DROP | grid and circuit routes compete with the core and the balls; its own frame and rings do not line up with the field — `13`, `15` |
| `ui_buy_ball`, `ui_charge`, `ui_power` | the three shop icons (in place of the inline SVG) | DROP | dimmer, inner symbols unreadable at ~18 px; would add 3 requests — `16` |
| atlas, 128/64 px sets, `preview/`, `reference/`, `source/` | — | not used | nothing integrated; `reference/` and `preview/` are not runtime by definition |

Root cause: the game draws vector art at the exact device size every frame;
a raster sprite resampled to 20–50 px loses the thin neon lines and glow that
make NC-ART-1 readable. Sprites only win where they add detail the vector
renderer lacks, and these sprites mostly add detail that disappears at game
scale.

## MODIFY — what a next round would need (owner decision)

1. Port motifs, not bitmaps: the relay's orange crystal and ring ticks and
   the heart's terminal nodes can be drawn procedurally in `drawRelay` /
   `drawHeart` (vector, any size, no request). Keep the heart the brightest,
   largest amber shape; keep the relay visibly different (solid fill).
2. If raster art stays the goal: regenerate at game scale (strokes ≥ 2 px at
   48 px, bright fills, no built-in surrounding shards, square silhouettes
   that match colliders, top-down turret with room for the charge ring),
   then re-run the same comparison.
3. Re-test with `experiment-1-hero-sprites.patch` /
   `experiment-2-armor-orb-arena.patch` (applied to `game.js` of base
   `3b23a6e`, sprites copied to `assets/sprites/`).

## Evidence in this folder

All captures are real game frames from headless Chromium (software raster),
DPR 1 unless named `dpr2`, `Math.random` seeded per scene in the test page
so base and experiment start from the same layout (`qa/art-shots.mjs`).

| File | What |
|---|---|
| `00-sprite-scale-dpr1/2.jpg` | `qa/sprite-scale.mjs`: procedural vs sprite at 22 / 34 / 49 / 130 px |
| `01`–`07-exp1-*.jpg` | BEFORE (main) vs EXPERIMENT 1 (heart, relay, turret, breach impact, lock-on sprites), scenes: first seconds 907×510 and 800×450 PL, relays level 5 1216×684, damaged relays level 8, heart shatter, phone DPR 2, phone landscape |
| `08`, `09` | crops at 1:1 device pixels (1920×1080 level 13; phone DPR 2) |
| `10` | aim reticle: procedural vs `fx_lockon` (DPR 2) |
| `11`, `12` | relay: BEFORE / sprite / MODIFY-B (sprite + procedural shell) |
| `13`–`15-exp2-*.jpg` | BEFORE vs EXPERIMENT 2 (armour sprites, `orb_player`, `arena_neural_dark`) incl. level 13 and 14 with 40 balls |
| `16` | shop icons: inline SVG vs PNG (DPR 2) |
| `experiment-*.patch` | the exact code used for the experiments (sprite loader with fallback and pre-scaled cache, hooks) — not in the runtime |

Frame cost and file size: see the stage PR (headless numbers, not a device).
