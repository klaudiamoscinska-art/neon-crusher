---
name: nc-qa
description: "Neon Crusher QA: the qa/ harness (real game.js in node:vm), suites, bots, KNOWN-defect checks, browser smoke at CrazyGames frames, manual and device checklists, evidence and base-vs-candidate comparison. Use to add or run tests or to judge evidence."
---

# nc-qa

**Scope:** `qa/*.mjs`, `qa/README.md`, CI workflow `.github/workflows/qa.yml`,
manual test checklists, interpreting results for reports.
**Elsewhere:** fixing what a test finds → the area's skill.

## Read first
- `qa/README.md` (suites, harness API, KNOWN mechanism, adding a suite).
- `docs/RISKS.md` when adding or closing a KNOWN check.

## Rules
- Test the real runtime through `qa/lib.mjs` `loadGame()`; never assert
  against a copy of game logic. Expected values come from
  `docs/GAME_DESIGN.md`, written as the spec, not pasted from the code.
- Deterministic: seeded `Math.random`, fixed canvas sizes, manual rAF pump.
- Node built-ins only; Playwright only if already installed (else NOT RUN).
- A suite that ran nothing is NOT RUN; simulation, browser, device and
  CrazyGames Preview results are labelled separately.
- A confirmed open defect = a `known('NC-xx', …)` check + a row in
  `docs/RISKS.md`; when fixed it becomes a normal check.

## Procedure
1. Pick the suite by area (physics, levels, economy, save, integrity,
   browser-smoke, instructions) or add `qa/<area>.mjs` exporting `run()` and
   register it in `qa/run-all.mjs` and `qa/README.md`.
2. Run the affected suite on base and candidate (same machine, same seeds);
   then `node qa/run-all.mjs` once; logs in `qa/out/`.
3. Report per suite: PASS n/m, FAIL (names), KNOWN (ids), NOT RUN (reason).

## Done when
New behaviour is pinned by a check that fails on the base (or a KNOWN row
was converted), CI green, report quotes only summaries.

## Stop and ask
A test would need a runtime hook (describe it in `docs/ARCHITECTURE.md`
"Test seams" and propose it) or a new dependency.
