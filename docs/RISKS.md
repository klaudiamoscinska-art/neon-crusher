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
| NC-09 | P1 | CONFIRMED (bot) | retention | Slow start that gets worse on bigger screens: the core stays small (blocks ≤ 36 px) while the canvas grows, so the lone first ball rarely hits. Median time to the first purchase ($10), 8 seeds, base 60 Hz → NC-PHYS-1 (any Hz): 800×279 43 → 49.5 s, 907×339 58.5 → 75 s, 1216×513 140.5 → 147.5 s, 1920×909 (fullscreen) > 300 s both. Greedy bot clears level 1 at 907×339 in 2.8–4.0 min (base) → 3.0–4.9 min, not within 15 min at 1920×909. The base's extra speed at 60 Hz came from repeat hits (NC-01/02/03); NC-PHYS-1 matches the base at 144 Hz (`qa/pace.mjs`). CrazyGames conversion = ≥ 1 min of play (top games ≥ 80 %). | `qa/economy.mjs` |
| NC-10 | P1 | CONFIRMED | economy | Fire-rate upgrade does nothing once the field holds `maxBalls` (balls never despawn); it only speeds up refilling after a purchase or a reload. Identical cash with fire rate 1 vs 25. | `qa/economy.mjs` |
| NC-11 | P1 | CONFIRMED (code) | retention | Missing retention features: no audio, no onboarding, no goals beyond the level, no offline earnings (genre expectation for idle games), no prestige, no active input on the field. | `docs/GAME_DESIGN.md` |
| NC-12 | P1 | NOT VERIFIED | originality / name | The loop (balls bounce, buy more balls, bricks with HP, idle upgrades) is an established "idle breakout" genre; CrazyGames rejects clones/asset flips and asks for a unique name. Name uniqueness and similarity not checked. Needs a distinct twist before submission. | — |
| NC-13 | P1 | SUSPECTED | performance | `shadowBlur` + `save/restore` on every shape every frame: measured in the harness 12 shadowed draws/frame at level 1, ~127 at level 14 (24 balls, 80 blocks), ~168 at 60 balls, + up to 400 particles; collisions O(balls × blocks) ≈ 4 900 checks/frame at 60 balls; `maxBalls` uncapped. Since NC-PHYS-1: 4 fixed steps per frame at 60 Hz, with a core bounding-box broad phase — harness CPU per frame at 60 balls, level 13: base 2.2 ms, NC-PHYS-1 0.18 ms (60 Hz) / 0.15 ms (144 Hz), draw cost unchanged. Frame time on phones / 4 GB Chromebook: NOT VERIFIED. | probe in NC-FOUNDATION-1 report |
| NC-16 | P1 | CONFIRMED | release | GitHub Pages "Deploy from branch" (`main`, Jekyll, `pages build and deployment`): every merge to `main` publishes the whole repo root (docs, qa, CLAUDE.md) with no QA gate; Liquid tags in Markdown would break the build (guarded by `qa/integrity.mjs`). | GitHub Actions runs, `docs/RELEASE.md` |
| NC-06 | P2 | SUSPECTED | save | Two tabs autosave independently, last writer wins → progress can go back. | code |
| NC-17 | P2 | CONFIRMED (screenshot) | layout | Text fixed in NC-BASIC-1 (smallest 11.2 px at DPR 1, nothing overflows in EN/PL). Still open: at 800×450 the canvas gets 279 px (62 %) of the height. A compact top bar/shop (tried in NC-BASIC-1: 357 px, 79 %) made the first purchase **slower** (bot median 43 → 69.5 s at 800×450, 58.5 → 86 s at 907×510) because the core does not scale with the field (NC-09), so the canvas sizes stay pinned (`qa/browser-smoke.mjs`) until the first-minute redesign. | `qa/browser-smoke.mjs`, `qa/economy.mjs` |
| NC-18 | P2 | NOT VERIFIED | CrazyGames app | Safe-area padding on all four sides + `viewport-fit=cover` added in NC-BASIC-1 (stylesheet check PASS); behaviour on a notched phone / in the CrazyGames app NOT RUN (Chromium cannot emulate insets). | `qa/browser-smoke.mjs` |
| NC-19 | P2 | SUSPECTED | economy | Numbers grow as 1.5^level: cash/HP reach `Infinity` near level ~1 750, and `JSON.stringify(Infinity)` = `null` → cash lost on save. Unreachable in normal play; on load the `null` now falls back to cash 0 (NC-04 validation), so the cash would still be lost. | code |

## Closed

| ID | Closed in | Fix | Proof |
|---|---|---|---|
| NC-04 | NC-BASIC-1 | `sanitizeSave`: every loaded number validated per field (finite, ≥ 0 / ≥ 1, floored, capped 1000), invalid fields fall back to defaults; level ≤ 0 no longer crashes the start; `maxBalls 0` no longer softlocks. | `qa/save.mjs` (base: 10 FAIL, candidate PASS) |
| NC-05 | NC-BASIC-1 | An unreadable / unsupported / adjusted save is copied to `neonCrusher.save.v1.bak` before any write; if that fails, or storage cannot be read, the session does not save. `schemaVersion` deliberately deferred to the first format change (`docs/SAVE.md`). | `qa/save.mjs`, `qa/browser-smoke.mjs` |
| NC-07 | NC-BASIC-1 | English UI (default + fallback) and Polish UI from one table; `?lang=`, else browser languages. SDK locale comes with the SDK (Full Launch). | `qa/i18n.mjs`, `qa/browser-smoke.mjs` (en-US and pl-PL) |
| NC-03 | NC-PHYS-1 | Fixed 1/240 s simulation step with an accumulator (`SIM_STEP`, frame dt still clamped to 0.05 s); particle drag made time-based. Same seed → identical state at 60/144/165 Hz; hit rate 1.476 ± 0.026 hits/s at all three, 48 seeds (base: 60 Hz 1.82 vs 144 Hz 1.52, −16 %). Real 144/165 Hz monitor: NOT RUN. Economy impact: see NC-09 and the NC-PHYS-1 PR. | `qa/physics.mjs` (base: FAIL) |
| NC-01 | NC-PHYS-1 | `collideBlock` bounces and scores only when `v·n < 0`; a ball moving away keeps its velocity. | `qa/physics.mjs` (base: FAIL) |
| NC-02 | NC-PHYS-1 | A centre inside a block leaves through the nearest face fully; after a level generation or resize every ball inside the core is moved straight out of it (`ejectFromCore`, no hit) — grid gaps (5 px) are narrower than a ball. Base: 75 hits from 9 embedded balls in 10 resolves; now 0. | `qa/physics.mjs` (base: FAIL) |
| NC-14 | NC-PHYS-1 | `fitCoreToCanvas` scales the core down (same shape, count, HP) when turrets at `min(w,h)/2 − 20` would come closer than 20 px; no turret within 14 px of the core in 8 sizes × 30 levels (base: 49 cases). Scaled only on short canvases at higher levels (54 of 240 cases, ×0.65–0.99; never on 1920×909 / 1216×513). | `qa/levels.mjs` (base: FAIL) |
| NC-15 | NC-PHYS-1 | Every resize re-fits the core from its generated geometry (shrinks, or restores when there is room), re-places turrets and ejects embedded balls; HP kept. A core generated on a small canvas stays small after enlarging until the next level. | `qa/levels.mjs` (base: FAIL) |
| NC-08 | NC-BASIC-1 | `user-select: none` (+ vendor prefixes, `-webkit-touch-callout: none`) on `body`; `touch-action: manipulation` on shop buttons. Tablet check NOT RUN (device). | `qa/browser-smoke.mjs` |

Not issues (checked): no tunnelling at current speeds (max 1.2 px per fixed
step vs ≥ 19.9 px obstacle incl. scaled cores, `qa/physics.mjs`); blocks always inside the canvas (8 sizes × 30
levels); storage exceptions are caught; zero external requests; no
`innerHTML`/`eval`. The saturated palette (`#00f3ff`, `#ff007f`, `#39ff14`) is
Neon Crusher's identity — GLITCH GULP's "old saturated neons are a regression"
rule does **not** apply here.

## Recommended fix order

1. ~~NC-SAVE-1~~ — minimal NC-04/NC-05 fix done in NC-BASIC-1 (fast track);
   NC-06, NC-19 stay open, low priority.
2. ~~NC-PHYS-1~~ — NC-01, NC-02, NC-03, NC-14, NC-15 closed (PR open).
3. ~~NC-I18N-1~~ — done in NC-BASIC-1 (NC-07, NC-08; NC-18 on a device open).
4. **NC-FTUE-1** (P1): first minute, fire-rate redesign, onboarding, goals —
   NC-09, NC-10, NC-11 (owner decides the economy); `nc-gameplay`, `nc-economy`.
5. **NC-PERF-1** (P1): measure on devices, cap/optimise glow — NC-13;
   `nc-performance`.
6. **NC-ID-1** (P1): originality twist + name check — NC-12 (owner decision).
7. **NC-RELEASE-1** (P1): Pages from a GitHub Actions workflow that publishes
   only runtime files after QA — NC-16 (owner decision); `nc-release`.

Order rationale and the full plan: `docs/ROADMAP.md` (fast-track queue first).
