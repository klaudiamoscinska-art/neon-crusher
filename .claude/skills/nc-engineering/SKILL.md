---
name: nc-engineering
description: "Neon Crusher code architecture and implementation in vanilla JS/Canvas: class structure, loop, state, refactors, module split, config constants, testability hooks, coding conventions. Use for structural code changes or when no narrower nc- skill fits."
---

# nc-engineering

**Scope:** structure of `game.js` / `index.html` / `style.css`, refactors,
new classes, config extraction, test seams, code review of a diff.
**Elsewhere:** physics maths → `nc-physics`; persistence → `nc-save`;
draw cost → `nc-performance`; tests themselves → `nc-qa`.

## Read first
- `docs/ARCHITECTURE.md` (whole; it is short).
- Only the `game.js` functions you change — find them with a search, read
  ~100 lines around; `game.js` is small today, keep the habit anyway.

## Rules
- Zero dependencies, no bundler, no build step; a module split or a new
  runtime file needs the owner (and updates `qa/integrity.mjs` `RUNTIME_FILES`).
- Behaviour-preserving refactors are proven by the full `qa/run-all.mjs` on
  base and candidate with identical results (same seeds).
- Keep player text in `textContent`; no `eval`, no `innerHTML`, no external
  URLs in runtime files.
- One concern per commit; update `docs/ARCHITECTURE.md` with the code.
- Hooks for tests must be inert in normal play and must not write the save.

## Procedure
1. Name the files and functions you will touch; confirm they are in scope.
2. If behaviour must not change, run `qa/` on the base first and keep the log.
3. Implement; run the affected suites, then `node qa/run-all.mjs`.
4. Diff review: no unrelated edits, no debug leftovers, no new globals that
   collide with the harness (`qa/lib.mjs` reads the top-level declarations).

## Done when
Docs match code, suites green (KNOWN rows unchanged unless fixed on purpose),
runtime file list unchanged or approved.

## Stop and ask
New runtime file, dependency, build step, or any change to save, economy or
publishing as a side effect.
