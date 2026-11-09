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
| `qa/integrity.mjs` | `node --check` on all JS; runtime file set from `index.html`; relative paths; zero external URLs; save-key literal; no `eval`/`innerHTML`; no Liquid tags in published Markdown (Pages/Jekyll); `--base <ref>` runtime diff, `--no-runtime-change` makes it a gate | no |
| `qa/instructions.mjs` | `CLAUDE.md` budget + required rules; skill format/name/description budget; skill map sync; dead paths; duplicated lines; doc sizes; KNOWN ids registered in `docs/RISKS.md` | no |
| `qa/runner.mjs` | self-test of the runner: a mandatory suite with zero checks, only NOT RUN rows or only KNOWN rows blocks; a FAIL or crash always blocks (also in an optional suite); only the optional browser-smoke may be NOT RUN, and only for an unavailable environment; real CLI exit codes (`NC_QA_NO_BROWSER=1` simulates a machine without a browser) | no |
| `qa/physics.mjs` | reflections per face/corner/oblique, push-out, approach check (NC-01), embedded balls leave without repeat hits (NC-02), walls, speed conservation, tunnelling bound per fixed step, refresh rate (NC-03): same seed = identical state at 60/144/165 Hz, hit rate within 2 SE / 2 % (48 seeds; `--quick` = 12 seeds, statistical verdict NOT RUN) | no |
| `qa/levels.mjs` | grid/circle alternation, N×N, rings, HP and money scaling, turret count, level-up, geometry on 8 canvas sizes × 30 levels, turret clearance (NC-14), core kept at full size on desktop canvases, resize: fit inside, restore, HP kept, resize storm with balls (NC-15) | no |
| `qa/economy.mjs` | cost curves, purchases through the real buttons, fire interval floor, live damage, income per hit, maxBalls cap, fire-rate value, time to first purchase, greedy bot level-1 time | no |
| `qa/save.mjs` | key, fields, round trip, autosave 5 s, lifecycle saves, storage throwing, valid saves kept unchanged, per-field fallback of invalid numbers, backup of unreadable/unsupported saves before any write, no overwrite when the backup or the read fails | no |
| `qa/i18n.mjs` | EN/PL tables (same keys, placeholders, no Polish in English), language selection (`?lang=`, browser list, English fallback), every label filled, number formatting | no |
| `qa/browser-smoke.mjs` | real Chromium at the 10 CrazyGames frames (DPR 1), English and Polish browser: errors, external requests, page scroll, shop visible, text inside buttons, smallest text, canvas share of the height, animation, user-select, safe-area padding, save restore + reload, corrupted save backed up; screenshots `qa/out/shots/` | Playwright if installed, else NOT RUN |

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
```

`NC_GAME_JS=<path>` works for every suite too (e.g. to show that a new check
fails on the base).

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
