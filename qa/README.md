# QA — Neon Crusher

Dev-only test suites. Node.js 18+ built-ins only: no `package.json`, no test
framework, nothing to install. Outputs go to `qa/out/` (git-ignored).

```bash
node qa/run-all.mjs                      # every suite; exit 1 on any FAIL
node qa/run-all.mjs --quick              # CI profile (fewer seeds, no long bot)
node qa/run-all.mjs --base origin/main --no-runtime-change   # docs-only stage guard
node qa/<suite>.mjs                      # one suite
```

## Suites

| Suite | Checks | Browser |
|---|---|---|
| `qa/integrity.mjs` | `node --check` on all JS; runtime file set from `index.html`; relative paths; zero external URLs; save-key literal; no `eval`/`innerHTML`; no Liquid tags in published Markdown (Pages/Jekyll); `--base <ref>` runtime diff, `--no-runtime-change` makes it a gate | no |
| `qa/instructions.mjs` | `CLAUDE.md` budget + required rules; skill format/name/description budget; skill map sync; dead paths; duplicated lines; doc sizes; KNOWN ids registered in `docs/RISKS.md` | no |
| `qa/physics.mjs` | reflections per face/corner/oblique, push-out, walls, speed conservation, tunnelling bound, refresh-rate consistency (60 vs 144 Hz, 48 seeds; `--quick` = 12 seeds, verdict NOT RUN) | no |
| `qa/levels.mjs` | grid/circle alternation, N×N, rings, HP and money scaling, turret count, level-up, geometry on 8 canvas sizes × 30 levels, resize | no |
| `qa/economy.mjs` | cost curves, purchases through the real buttons, fire interval floor, live damage, income per hit, maxBalls cap, fire-rate value, time to first purchase, greedy bot level-1 time | no |
| `qa/save.mjs` | key, fields, round trip, autosave 5 s, lifecycle saves, storage throwing, truncated JSON, wrong types, invalid ranges, crash on bad level | no |
| `qa/browser-smoke.mjs` | real Chromium at the 10 CrazyGames frames (DPR 1): errors, external requests, page scroll, shop visible, animation, user-select, save restore + reload, language; screenshots `qa/out/shots/` | Playwright if installed, else NOT RUN |

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

## Statuses

`PASS` / `FAIL` / `NOT RUN` (with a reason) / `INFO` (a measurement, never a
pass) / `KNOWN` — a confirmed open defect registered in `docs/RISKS.md`. A
KNOWN check documents the current wrong behaviour so CI stays green while the
defect stays visible; when the runtime is fixed the check turns into a FAIL
until the check and the register are updated. A suite that executed no check
exits 2 and is reported NOT RUN.

## Adding a suite

Create `qa/<area>.mjs` exporting `run()` that returns a `Reporter`, guard the
CLI entry with `isMain(import.meta.url)` (a naive check runs nothing on
Windows and exits 0), register it in `qa/run-all.mjs` and in the table above.

## CI

`.github/workflows/qa.yml` runs `node qa/run-all.mjs --quick` on pull
requests to `main` and on manual dispatch, read-only, Node 22. Playwright is
not installed there, so `browser-smoke` is NOT RUN in CI — run it locally.

## Windows notes

Run from the repo root with `node qa\run-all.mjs`; paths are handled with
`node:path`; line endings are normalised when files are read.
