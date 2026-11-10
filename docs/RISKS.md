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
| NC-11 | P1 | CONFIRMED (code) | retention | Still missing: goals beyond the level, offline earnings (genre expectation for idle games), prestige. Done: first-minute hint, `+$n` labels, core progress (NC-CORE-1A); active input (aimed volley), audio + mute, level banner, purchase feedback (NC-ORIGINAL-1). Retention with players: NOT VERIFIED until the Basic Launch dashboard. | `docs/GAME_DESIGN.md` |
| NC-12 | P1 | NOT VERIFIED | originality / name | Genre risk reduced by the breach mechanic (NC-ORIGINAL-1: aimed multi-turret piercing volleys, hidden heart, relays, shatter) and by an own visual identity (NC-ART-1: scale-plate armour without HP numbers, heart sigil, relay conduits, fork turrets, graphite/cyan/magenta/amber palette). NC-AI-RECOVERY-1 moves the rogue-AI theme into play (an opponent that reacts: shield, firewall node, exposure; recovery instead of destruction; 2.5D hardware tiles, processor-die core). Still similar to the genre: bouncing balls breaking a block cluster for cash upgrades, neon look. R3 embeds five sprites from the owner-supplied NC-NETWORK-RECOVERY-ART-V2 pack (provenance and uniqueness as stated by the pack: NOT VERIFIED). All compared in words with Idle Breakout and Neon Core Breaker only from search summaries (crazygames.com and itch.io not reachable from the build machine; no screenshot of either seen) — a comparison, not proof of uniqueness. Name: "Neon Crusher" vs "Neon Core Breaker" share "Neon"/"Core"-style wording; uniqueness not checked (owner decision NC-ID-1). | PR NC-ORIGINAL-1, PR NC-ART-1 |
| NC-13 | P1 | SUSPECTED | performance | `shadowBlur` + `save/restore` on every shape every frame: measured in the harness 12 shadowed draws/frame at level 1, ~127 at level 14 (24 balls, 80 blocks), ~168 at 60 balls, + up to 400 particles; collisions O(balls × blocks) ≈ 4 900 checks/frame at 60 balls; `maxBalls` uncapped. Since NC-PHYS-1: 4 fixed steps per frame at 60 Hz, with a core bounding-box broad phase — harness CPU per frame at 60 balls, level 13: base 2.2 ms, NC-PHYS-1 0.18 ms (60 Hz) / 0.15 ms (144 Hz), draw cost unchanged. NC-ORIGINAL-1 adds a few shadowed draws (heart ring, ≤ 8 lances, ≤ 12 rings, HUD meter); Chromium headless JS frame cost in the PR. NC-ART-1 (batched drawing): shadowBlur sets per frame (harness, 1216×513) level 13 / 24 balls 109 → 55, level 14 / 60 balls 207 → 59; frame cost incl. raster (headless Chromium, software, DPR 1, `qa/art-shots.mjs`, final "Fractured Intelligence" look) 1920×1080 level 13 / 60 balls p50 9.8 → 13.5 ms (+38 %), 800×450 level 14 5.2 → 6.5 ms, level 1 1.5 → 2.1 ms; 60 FPS kept in all three (296–300 frames / 5 s). NC-AI-RECOVERY-1 (2.5D "Network Recovery", same probe, same machine, base `main` → candidate): 1920×1080 level 13 / 60 balls p50 12.1–12.7 → 11.4–11.5 ms (297–298 frames / 5 s), 800×450 level 14 6.3 → 6.3 ms, level 1 1.8 → 1.6 ms; first draft cost 18.6 ms at 1920×1080 and was cut (L-shaped floor shadows, no blurred shield hexagon, no inlay underlay, no drone casing band). Cheaper options if a device needs them: drop the light wave (4 groups → 1) and the drone halo first. Frame time on phones / 4 GB Chromebook / GPU raster: NOT VERIFIED. | probe in NC-FOUNDATION-1 report |
| NC-16 | P1 | CONFIRMED | release | GitHub Pages "Deploy from branch" (`main`, Jekyll, `pages build and deployment`): every merge to `main` publishes the whole repo root (docs, qa, CLAUDE.md) with no QA gate; Liquid tags in Markdown would break the build (guarded by `qa/integrity.mjs`). | GitHub Actions runs, `docs/RELEASE.md` |
| NC-06 | P2 | SUSPECTED | save | Two tabs autosave independently, last writer wins → progress can go back. | code |
| NC-17 | P2 | CONFIRMED (screenshot) | layout | Text fixed in NC-BASIC-1 (smallest 11.2 px at DPR 1, nothing overflows in EN/PL). Still open: at 800×450 the canvas gets 279 px (62 %) of the height. A compact top bar/shop (tried in NC-BASIC-1: 357 px, 79 %) made the first purchase slower before the world scale (NC-09, closed in NC-CORE-1A); with it a taller canvas only changes the aspect, so a compact layout can now be retried. Canvas sizes stay pinned (`qa/browser-smoke.mjs`) until that stage. | `qa/browser-smoke.mjs`, `qa/economy.mjs` |
| NC-18 | P2 | NOT VERIFIED | CrazyGames app | Safe-area padding on all four sides + `viewport-fit=cover` added in NC-BASIC-1 (stylesheet check PASS); behaviour on a notched phone / in the CrazyGames app NOT RUN (Chromium cannot emulate insets). | `qa/browser-smoke.mjs` |
| NC-19 | P2 | SUSPECTED | economy | Numbers grow as 1.5^level: cash/HP reach `Infinity` near level ~1 750, and `JSON.stringify(Infinity)` = `null` → cash lost on save. Unreachable in normal play; on load the `null` now falls back to cash 0 (NC-04 validation), so the cash would still be lost. | code |
| NC-22 | P2 | NOT VERIFIED | balance | NC-AI-RECOVERY-1 adaptive defense (shield 7 s × 0.5 on the core from sector 3, node bonus 3 ×, exposure 5 s × 2.5 for pulses, +50 % charge for the player's own break, cooldown 10 s) tuned with bots only (`qa/idle-balance.mjs`, PR table): passive pace within the 10 % target of `main`, active node-breaking clearly ahead. Players may find shields too frequent from sector 3, the node too small on 800×450 (tiles ~16–18 px; R2 adds a rotating magenta reticle ~1.6 × the tile), or the refund too generous. R2 fixed a real readability bug: the node was picked with exact boxes, so a pulse aimed at it could be absorbed by a neighbour (lance boxes are 3 units wider); now picked with the lance geometry. Check in the owner's playtest and on the Basic Launch dashboard. | `qa/recovery.mjs`, `qa/idle-balance.mjs` |
| NC-20 | P2 | NOT VERIFIED | balance | NC-ORIGINAL-1 numbers (lance 8 × ball damage, heart 6 × block HP, charge 11 s × 0.9^n, autopilot 5 s) tuned with bots only; a real player aims worse than the active bot and better than the autopilot. Players may find the active advantage too small or the autopilot too generous. Check on the Basic Launch dashboard (play time) and in the owner's playtest. | `qa/pace.mjs`, `qa/economy.mjs` |

## Closed

| ID | Closed in | Fix | Proof |
|---|---|---|---|
| NC-21 | NC-AI-RECOVERY-1 | Tiles are drawn as 2.5D hardware whose top-down footprint is exactly the collision square (1.5-unit bevel at most); the raised top face sits inside it, shadows fall on the floor outside. The heart (AI core) is a square socket of its collision size. | screenshots `qa/art-shots.mjs`; `Block.bodyPath` |
| NC-10 | NC-ORIGINAL-1 | The fire-rate upgrade became **Volley charge** (same saved field `fireRateLevel`): charge time max(2, 11 × 0.9^(lvl−1)) s; unused volleys fire by themselves, so it pays off on a full field with no input (charge 12 beats charge 1 in ≥ 5 of 6 seeds over 60 s). Ball refill fixed at 700 ms. | `qa/economy.mjs` (base: KNOWN) |
| NC-09 | NC-CORE-1A | World scale (short side > 250 px → world drawn ×short/250) + turrets aimed at the core. Median first purchase, 32 seeds, identical at 60/144/165 Hz: 800×279 40.5 → 29.5 s, 907×339 61.5 → 27 s, 1216×513 140 → 23.5 s, 1920×909 387.5 → 20.5 s (p90 ≤ 45.5 s everywhere); greedy bot clears level 1 in a median 1.3–2 min (base 2.7 min to > 15 min). Side effect: mid-game much faster on big screens (greedy 10 min, level 2.5 → 9 at 1216×513; PR table). Players: NOT VERIFIED. | `qa/economy.mjs` (base: FAIL) |
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
2. ~~NC-PHYS-1~~ — NC-01, NC-02, NC-03, NC-14, NC-15 closed (merged, PR #5).
3. ~~NC-I18N-1~~ — done in NC-BASIC-1 (NC-07, NC-08; NC-18 on a device open).
4. ~~NC-FTUE-1~~: first minute (NC-09) done in NC-CORE-1A; active twist and
   NC-10 done in NC-ORIGINAL-1; goals beyond the level (NC-11) open.
5. **NC-PERF-1** (P1): measure on devices, cap/optimise glow — NC-13;
   `nc-performance`.
6. **NC-ID-1** (P1): originality twist + name check — NC-12 (owner decision).
7. **NC-RELEASE-1** (P1): Pages from a GitHub Actions workflow that publishes
   only runtime files after QA — NC-16 (owner decision); `nc-release`.

Order rationale and the full plan: `docs/ROADMAP.md` (fast-track queue first).
