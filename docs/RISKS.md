# Risk register and technical audit

Single register of known defects and risks (NC-FOUNDATION-1 audit,
2026-11-09, base `1580a6e`). Every id used by a `known(...)` check in `qa/`
must be listed here (`qa/instructions.mjs`); when a fix lands, the KNOWN check
turns into a FAIL until both the check and this row are updated.

**Priority:** P0 = blocks safe publication or risks data loss; P1 = important
gameplay/quality/stability problem; P2 = lower-priority improvement.
**Evidence:** CONFIRMED (reproduced by a test or measurement) / SUSPECTED
(code reading, not reproduced) / NOT VERIFIED (needs a device, a portal or
players).

## Open items

| ID | P | Evidence | Area | Finding | Proof |
|---|---|---|---|---|---|
| NC-04 | P0 | CONFIRMED | save | No validation of loaded numbers. A save with `level` ≤ 0 or fractional < 1 gives 0 turrets → `TypeError` in the `Game` constructor on **every** load (the game never starts; the bad save is never overwritten). `maxBalls: 0` = no ball ever (softlock); `damageLevel: 0`, negative cash, `fireRateLevel: 1e9` accepted. Reachable only through a corrupted/edited save, but unrecoverable without clearing storage. | `qa/save.mjs` |
| NC-05 | P0 | CONFIRMED | save | An unreadable save (bad JSON) is replaced by a fresh game at the first autosave (5 s): no backup, no `schemaVersion`, so a future format change cannot be detected safely. | `qa/save.mjs` |
| NC-07 | P0 | CONFIRMED | i18n / CrazyGames | UI is Polish only (`lang="pl"`, pl-PL number format). CrazyGames requires English; language should follow the SDK locale, fallback English. Blocks submission. | `qa/browser-smoke.mjs` |
| NC-01 | P1 | CONFIRMED | physics | `collideBlock` reflects even when the ball already moves away from the block (no `v·n < 0` check) — it is sent back into the block. | `qa/physics.mjs` |
| NC-02 | P1 | CONFIRMED | physics | A ball whose centre is inside a block (level regenerated on top of balls, resize) is pushed only `radius + 0.5` and can stay inside → repeated hits (extra cash/damage). | `qa/physics.mjs` |
| NC-03 | P1 | CONFIRMED (simulation) | physics / CrazyGames | Hit rate differs with refresh rate: 60 Hz 1.82 ± 0.07 vs 144 Hz 1.52 ± 0.03 hits/s (48 seeds, ~16 %, z ≈ 3.7). CrazyGames requires consistent physics at 144/165 Hz. Root cause NOT VERIFIED (variable `dt` + discrete collision; fix path: fixed-timestep substeps). On a real 144 Hz monitor: NOT RUN. | `qa/physics.mjs` (full run) |
| NC-09 | P1 | CONFIRMED (bot) | retention | Slow start that gets worse on bigger screens: the core stays small (blocks ≤ 36 px) while the canvas grows, so the lone first ball rarely hits. Median time to the first purchase ($10): 800×279 → 43 s, 907×339 → 58 s, 1216×513 → 140 s, 1920×909 (fullscreen) → > 300 s (8 seeds each). Greedy bot clears level 1 in 2.8–4.0 min at 907×339 and not within 15 min at 1920×909. CrazyGames conversion = ≥ 1 min of play (top games ≥ 80 %). | `qa/economy.mjs` |
| NC-10 | P1 | CONFIRMED | economy | Fire-rate upgrade does nothing once the field holds `maxBalls` (balls never despawn); it only speeds up refilling after a purchase or a reload. Identical cash with fire rate 1 vs 25. | `qa/economy.mjs` |
| NC-11 | P1 | CONFIRMED (code) | retention | Missing retention features: no audio, no onboarding, no goals beyond the level, no offline earnings (genre expectation for idle games), no prestige, no active input on the field. | `docs/GAME_DESIGN.md` |
| NC-12 | P1 | NOT VERIFIED | originality / name | The loop (balls bounce, buy more balls, bricks with HP, idle upgrades) is an established "idle breakout" genre; CrazyGames rejects clones/asset flips and asks for a unique name. Name uniqueness and similarity not checked. Needs a distinct twist before submission. | — |
| NC-13 | P1 | SUSPECTED | performance | `shadowBlur` + `save/restore` on every shape every frame: measured in the harness 12 shadowed draws/frame at level 1, ~127 at level 14 (24 balls, 80 blocks), ~168 at 60 balls, + up to 400 particles; collisions O(balls × blocks) ≈ 4 900 checks/frame at 60 balls; `maxBalls` uncapped. Frame time on phones / 4 GB Chromebook: NOT VERIFIED. | probe in NC-FOUNDATION-1 report |
| NC-16 | P1 | CONFIRMED | release | GitHub Pages "Deploy from branch" (`main`, Jekyll, `pages build and deployment`): every merge to `main` publishes the whole repo root (docs, qa, CLAUDE.md) with no QA gate; Liquid tags in Markdown would break the build (guarded by `qa/integrity.mjs`). | GitHub Actions runs, `docs/RELEASE.md` |
| NC-08 | P1 | CONFIRMED | CrazyGames | `body` has no `user-select: none` (CrazyGames technical requirement for touch devices). | `qa/browser-smoke.mjs` |
| NC-14 | P2 | CONFIRMED | levels | Turret distance clamped to `min(w,h)/2 − 20` puts turrets on/inside the core on short canvases (e.g. 907×339 from level 16; 49 cases in 8 sizes × 30 levels). | `qa/levels.mjs` |
| NC-15 | P2 | CONFIRMED | layout | Resize re-centres but never re-sizes the layout: after a big resize/rotation (1920×900 → 375×480) the core/turrets leave the canvas until the next level. | `qa/levels.mjs` |
| NC-06 | P2 | SUSPECTED | save | Two tabs autosave independently, last writer wins → progress can go back. | code |
| NC-17 | P2 | CONFIRMED (screenshot) | layout | At 800×450 the canvas gets 279 px (62 %) of the height; smallest text 10.4 px at DPR 1. Readability judgement NOT VERIFIED. | `qa/browser-smoke.mjs`, `qa/out/shots/` |
| NC-18 | P2 | SUSPECTED | CrazyGames app | No `safe-area-inset-top/left/right` handling (CrazyGames app opens games fullscreen). | code |
| NC-19 | P2 | SUSPECTED | economy | Numbers grow as 1.5^level: cash/HP reach `Infinity` near level ~1 750, and `JSON.stringify(Infinity)` = `null` → cash lost on save. Unreachable in normal play; covered by the NC-04 validation. | code |

Not issues (checked): no tunnelling at current speeds (max 14 px/frame vs ≥ 26 px
obstacle, `qa/physics.mjs`); blocks always inside the canvas (8 sizes × 30
levels); storage exceptions are caught; zero external requests; no
`innerHTML`/`eval`. The saturated palette (`#00f3ff`, `#ff007f`, `#39ff14`) is
Neon Crusher's identity — GLITCH GULP's "old saturated neons are a regression"
rule does **not** apply here.

## Recommended fix order

1. **NC-SAVE-1** (P0): NC-04, NC-05 (+ NC-06 decision, NC-19) — before more
   players have saves; `nc-save`.
2. **NC-PHYS-1** (P1): fixed timestep + approach check + full push-out —
   NC-01, NC-02, NC-03 (+ NC-14, NC-15); `nc-physics`.
3. **NC-I18N-1** (P0 for CrazyGames): English + language selection, plus
   NC-08 and NC-18; `nc-ux`.
4. **NC-FTUE-1** (P1): first minute, fire-rate redesign, onboarding, goals —
   NC-09, NC-10, NC-11 (owner decides the economy); `nc-gameplay`, `nc-economy`.
5. **NC-PERF-1** (P1): measure on devices, cap/optimise glow — NC-13;
   `nc-performance`.
6. **NC-ID-1** (P1): originality twist + name check — NC-12 (owner decision).
7. **NC-RELEASE-1** (P1): Pages from a GitHub Actions workflow that publishes
   only runtime files after QA — NC-16 (owner decision); `nc-release`.

Order rationale and the full plan: `docs/ROADMAP.md`.
