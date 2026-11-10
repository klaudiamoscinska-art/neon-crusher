# QA — Neon Crusher

Dev-only test suites. Node.js 18+ built-ins only: no `package.json`, no test
framework, nothing to install. Outputs go to `qa/out/` (git-ignored).

```bash
node qa/run-all.mjs                      # every suite; exit 1 if any suite blocks (below)
node qa/run-all.mjs --quick              # CI profile (fewer seeds, no long bot)
node qa/run-all.mjs --base origin/main --no-runtime-change   # docs-only stage guard
node qa/run-all.mjs --only save,levels   # a subset (an unknown name exits 1)
node qa/<suite>.mjs                      # one suite
```

## Suites

| Suite | Checks | Browser |
|---|---|---|
| `qa/integrity.mjs` | `node --check` on all JS; runtime release set including all 100 ART V3 PNGs; manifest SHA-256, bytes, PNG signature and dimensions; relative HTML/CSS paths; zero external URLs; save-key literal; no `eval`/`innerHTML`; no Liquid tags in published Markdown (Pages/Jekyll); `--base <ref>` runtime diff, `--no-runtime-change` makes it a gate | no |
| `qa/instructions.mjs` | `CLAUDE.md` budget + required rules; skill format/name/description budget; skill map sync; dead paths; duplicated lines; doc sizes; KNOWN ids registered in `docs/RISKS.md` | no |
| `qa/runner.mjs` | self-test of the runner: a mandatory suite with zero checks, only NOT RUN rows or only KNOWN rows blocks; a FAIL or crash always blocks (also in an optional suite); only the optional browser-smoke may be NOT RUN, and only for an unavailable environment; real CLI exit codes (`NC_QA_NO_BROWSER=1` simulates a machine without a browser) | no |
| `qa/physics.mjs` | reflections per face/corner/oblique, push-out, approach check (NC-01), embedded balls leave without repeat hits (NC-02), walls, speed conservation, tunnelling bound per fixed step, refresh rate (NC-03): same seed = identical state at 60/144/165 Hz, hit rate within 2 SE / 2 % (48 seeds; `--quick` = 12 seeds, statistical verdict NOT RUN) | no |
| `qa/levels.mjs` | grid/circle alternation, N×N, rings, heart (centre, 6 × HP, 1 or 2×2 cells) and relay counts, HP and money scaling, turret count, level-up, geometry on 8 canvas sizes × 30 levels, turret clearance (NC-14), every block ≥ 11 px on screen, resize: fit inside, restore, HP kept, resize storm with balls (NC-15), world scale (NC-09), turrets aim at the core with a clear spawn, core progress value; positions in world units | no |
| `qa/economy.mjs` | cost curves, purchases through the real buttons, volley charge time and floor, fixed refill, live damage, income per hit, maxBalls cap, NC-10 (charge upgrade pays on a full field), lance power/order/gaps, click/tap/Space input on the next fixed step, autopilot, relay shockwave + recharge, heart shatter + level-up, sound toggle key, active vs passive pace, first-minute hint (fresh save only, not saved), `+$n` labels (capped), time to first purchase (NC-09: median ≤ 60 s and 20–45 s on 4 canvases), greedy bot level-1 time | no |
| `qa/save.mjs` | key, fields, round trip, autosave 5 s, lifecycle saves, storage throwing, valid saves kept unchanged, per-field fallback of invalid numbers, backup of unreadable/unsupported saves before any write, no overwrite when the backup or the read fails | no |
| `qa/i18n.mjs` | EN/PL tables (same keys, placeholders, no Polish in English), language selection (`?lang=`, English default regardless of browser locale, English fallback), every label filled, number formatting | no |
| `qa/recovery.mjs` | NC-AI-RECOVERY-1 adaptive defense: none on sectors 1–2, first shield 8 s into sector 3, node = armour hit first on a turret's line, shield × 0.5 never restores HP, ends after 7 s, cooldown 10 s, break → exposure 5 s (× 2.5 pulses/shockwaves, × 1 drones), bonus 3 ×, refund only for the player's own pulse, autopilot targets the node, sector end clears it, nothing saved, same shields at 60/144/165 Hz, idle safety (4 min no input from sector 3: ≥ 3 sectors, no shield > 7 s, sector/cash never go back), shield hint, HUD safe areas (R2: meters, AI alert and the 3 longest toasts never overlap each other, leave the field or cover the core / node / relays / uplinks; EN + PL, 8 field sizes, sectors 3–14, shield and exposure), active ≥ passive + 3 sectors at 5 min (`--quick`: 1 idle seed, pace NOT RUN) | no |
| `qa/browser-smoke.mjs` | real Chromium at the 10 CrazyGames frames (DPR 1), English default in English/Polish browsers plus explicit `?lang=pl`: errors, external requests, page scroll, shop visible, text inside buttons, smallest text, canvas share of the height, first-minute hint (visible, inside the field, not cut, taps pass through), volley fired by a mouse click and by a touch tap (proved through the hint, autopilot ruled out), sound toggle persisted, animation, user-select, safe-area padding, save restore + reload, corrupted save backed up; screenshots `qa/out/shots/` | Playwright if installed, else NOT RUN |

## Measurement tool (not a suite)

`qa/pace.mjs` prints progression-pace numbers (time to the first purchase,
early income with one ball, greedy-bot income per minute and level after
10 min) for a runtime change's economy report. Never PASS/FAIL, not in
`run-all`. Base vs candidate on the same machine:

```bash
git show origin/main:game.js > /tmp/base-game.js
NC_GAME_JS=/tmp/base-game.js node qa/pace.mjs --hz 60,144   # base
node qa/pace.mjs --hz 60,144,165                             # candidate
node qa/pace.mjs --only early --hz 60                        # early income only
node qa/pace.mjs --bot active --canvas 907x339 --skip-first  # NC-ORIGINAL-1: aim every volley at the heart
```

`NC_GAME_JS=<path>` works for every suite too (e.g. to show that a new check
fails on the base).

Idle vs active balance (NC-AI-RECOVERY-1), a tool, not a suite: base vs
candidate, bots passive / active (breaks firewall nodes) / core (ignores
shields), median sector and cash earned at 1/3/5/10 min, parallel children:

```bash
node qa/idle-balance.mjs --base /tmp/base/game.js --seeds 8 --canvas 800x279,907x339,1216x513 --hz 60
node qa/idle-balance.mjs --bots passive,active,core --seeds 4 --hz 144
```

Visual changes (NC-ART-1), also tools, not suites:

```bash
node qa/sim-compare.mjs /tmp/base-game.js        # simulation bit-identical to the base? + draw counters per frame
node qa/sim-compare.mjs /tmp/base-game.js --no-defense   # NC-AI-RECOVERY-1: identical with the AI's reaction off
node qa/art-shots.mjs --root /tmp/base --out qa/out/art/before   # base folder with index.html/style.css/game.js
node qa/art-shots.mjs --out qa/out/art/after                     # 14 scenes (NC-AI-RECOVERY-1 set) + frame cost (rAF + forced raster)
node qa/art-shots.mjs --dpr 2 --out qa/out/art/after-dpr2        # same scenes and probe at device pixel ratio 2
node qa/art-shots.mjs --sheet qa/out/art/before qa/out/art/after --out qa/out/art/sheets
```

## Harness (`qa/lib.mjs`)

`loadGame({ width, height, dpr, seed, storage })` loads the **real**
`game.js` into a `node:vm` context with a fake DOM (canvas wrapper size,
shop elements with `click()` that respects `disabled`), a stub 2D context that
counts calls (`h.ctx.__calls`, incl. `__shadowBlurSet`), a seeded
`Math.random` (mulberry32) and a manual `requestAnimationFrame` pump:

```js
const h = loadGame({ width: 907, height: 339, seed: 3 });
const g = h.newGame();          // new Game(canvas), as DOMContentLoaded does
h.run(60, 144);                 // 60 s of game time at 144 Hz through Game.loop
h.el('btnBuyBall').click();     // real shop handler
h.fireWindow('pagehide');       // lifecycle events
```

No runtime change was needed: `game.js` is a classic script whose top-level
classes are visible to a second script in the same context. Expected values
in the suites come from `docs/GAME_DESIGN.md` (the spec), never from copying
the code's formulas into the test.

## Statuses and when a run fails

Rows: `PASS` / `FAIL` / `NOT RUN` (with a reason) / `INFO` (a measurement,
never a pass) / `KNOWN` — a confirmed open defect registered in
`docs/RISKS.md`. A KNOWN check documents the current wrong behaviour so CI
stays green while the defect stays visible; when the runtime is fixed it
turns into a FAIL until the check and the register are updated.

Suite verdict (`classifySuite` in `qa/lib.mjs`, the only place this is decided):

| Suite result | Verdict | Blocks the run (exit 1) |
|---|---|---|
| any FAIL, or the suite crashed | FAIL | yes, mandatory or optional |
| no PASS and no KNOWN (nothing executed) | NOT RUN | yes — except the **optional** `browser-smoke` when it reports Playwright/Chromium unavailable |
| no PASS, only KNOWN | KNOWN ONLY (never PASS) | yes |
| PASS > 0, no FAIL | PASS, or PASS+KNOWN / PASS+NOT RUN with the rows listed | no |

`browser-smoke` is the only optional suite; every other suite is mandatory.
A run with no suite (e.g. `--only` with an unknown name) fails. A suite run
on its own exits 0 / 1 (FAIL) / 2 (blocking NOT RUN or KNOWN ONLY).
`qa/runner.mjs` pins these rules.

## Adding a suite

Create `qa/<area>.mjs` exporting `run()` that returns a `Reporter`, guard the
CLI entry with `isMain(import.meta.url)` (a naive check runs nothing on
Windows and exits 0), register it in `defaultSuites()` of `qa/run-all.mjs`
(mandatory unless it needs something a machine may lack; an optional suite
must call `r.envUnavailable()` for that case) and in the table above.

## CI

`.github/workflows/qa.yml` runs `node qa/run-all.mjs --quick` on pull
requests to `main` and on manual dispatch, read-only, Node 22. Playwright is
not installed there, so `browser-smoke` is NOT RUN (optional, allowed) in
CI — run it locally; every other suite must execute checks or CI fails.

## Windows notes

Run from the repo root with `node qa\run-all.mjs`; paths are handled with
`node:path`; line endings are normalised when files are read.

KERNELFALL additions: `qa/collapse.mjs` is mandatory in run-all (supply graph,
cut propagation, bounded/no-reward erosion, save continuity, equal fixed-step
states at 60/144/165 Hz). `node qa/package-basic.mjs` creates and validates the
HTML5 folder (including the complete ART V3 manifest and 100 original PNGs),
`qa/out/kernelfall-art-v3.zip` and SHA-256 package manifest. The uncompressed
release must stay below 20 MB. With a system Chromium use
`NC_CHROMIUM=/usr/bin/chromium`; no browser dependency is added to the game.
`qa/sim-compare.mjs <base-game.js> --no-collapse` disables only the new mechanic.

For a long simulation run use `NC_QA_SIM_ONLY=1 node qa/run-all.mjs`:
this skips only the harness's stub rendering calls, never fixed updates,
inputs or assertions. Real Chromium smoke remains enabled and renders fully.
The collapse suite separately proves render/no-render state equality.

ART V3 evidence tools (development only, Playwright + Chromium required):
`node qa/art-v3-browser.mjs` captures real gameplay at all five required
viewports, DPR 2/3, labelled art-state fixtures, nested Pages paths, load errors
and before/after/contact sheets. `node qa/art-v3-performance.mjs` compares
render+raster cost against `origin/main` with a controlled 60-drone scene.
Run performance alone after other browser/CPU tests finish. Both write retained
evidence to `docs/qa/kernelfall-art-v3/`; see `REPORT_PL.md` there. Emulation is
not a physical-device PASS. These tools add no game runtime dependencies.

ART V6 pre-integration review (development only):
`python3 qa/art-v6-assets.py` checks all 92 source PNGs (Pillow is QA-only);
`node qa/art-v6-browser.mjs` captures identical seeded real Canvas scenes
with browser-only V6 substitution, plus states and gameplay fixtures;
`node qa/art-v6-background.mjs` checks aspect-preserving background cover;
`node qa/art-v6-idle.mjs` records 60 simulated seconds of natural V3 idle
without inputs or purchases. `node qa/art-v6-reconstruct.mjs` reconstructs
v1 saves for sectors 1–12. `node qa/art-v6-performance.mjs` measures the
unchanged V3 runtime against main (A/A control; run alone, not production V6).
After successful A/B, `node qa/art-v6-inventory.mjs` writes exact production
and fixture source lists and screenshot hashes. Outputs and limits are in
`docs/art/kernelfall-v6/REPORT_PL.md`. These tools are separate from run-all;
the V6 visual gate is BLOCKED, and no V6 PNG is selected by production code.
