# Release and deployment

## Current state (verified 2026-11-09)

- GitHub Pages is enabled in **"Deploy from a branch"** mode: GitHub's own
  `pages build and deployment` workflow (Jekyll) ran on every push to `main`
  (runs for `47b4790` and `1580a6e`, both on `main`). There is no workflow file
  for it in the repo; the setting lives in *Settings → Pages* (only the owner
  can see/change it).
- Consequences:
  - pushing any other branch publishes nothing;
  - **every merge to `main` publishes** — the game and the whole repo root
    (Jekyll renders `README.md`, `CLAUDE.md`, `docs/*.md`, copies `qa/`;
    dot folders `.claude/`, `.github/` are not published) — with no QA gate
    (NC-16);
  - a Liquid tag (double curly braces, or a curly brace followed by a percent
    sign) in a published Markdown file can break the Jekyll build (the old
    site then stays live) — `qa/integrity.mjs` guards it;
  - adding `.nojekyll` would change what is published (dot folders) — do not
    add it without the owner.
- CI (`.github/workflows/qa.yml`, NC-FOUNDATION-1): runs `qa/` on pull
  requests to `main` and on manual dispatch; read-only permissions; it never
  deploys.

## Rules

1. Production = `main` of `klaudiamoscinska-art/neon-crusher`. Claude never
   pushes or commits to `main`, never merges, never changes Pages settings,
   never runs a deployment. The owner merges after GPT's review and her
   explicit approval of that PR (`docs/claude/WORKFLOW.md`).
2. A merge that changes no runtime file (`index.html`, `style.css`,
   `game.js`) still rebuilds Pages — the game stays identical; say so in the PR.
3. Before a merge that changes runtime files: `node qa/run-all.mjs` on base
   and candidate, browser smoke, save round trip, and a short manual check of
   the PR checklist.
4. **A URL never changes meaning** once players use it: the game stays at the
   Pages root `index.html` (same origin = same save). Never move or rename
   `index.html`, never change the save key.
5. Rollback = a forward commit (via PR) restoring the last good runtime files;
   never rewrite or force-push `main`.
6. CrazyGames uploads are done by the owner from a package produced by a
   script and validated (`docs/CRAZYGAMES.md` "Package"); Claude never uploads
   or submits.

## Planned (NC-RELEASE-1, owner decision)

Move Pages to a GitHub Actions workflow (`actions/deploy-pages`) that runs
`qa/` first and uploads only an assembled folder with the runtime files — the
GLITCH GULP model (E3) reduced to what a 3-file game needs: no immutable
`v/<id>/` folders or deployment ledger until there is a cache/version problem
to solve. Requires: the owner switching *Settings → Pages → Source* to
"GitHub Actions", a `main`-only trigger, and a `github-pages` environment
limited to `main`.

## Release log

| Date | Commit | What | Deploy |
|---|---|---|---|
| 2026-09-05 | `47b4790` | MVP | Pages (branch) |
| 2026-09-05 | `1580a6e` | CLAUDE.md | Pages (branch), game unchanged |
| 2026-11-09 | `5d8a552` | PR #3 NC-FOUNDATION-1 (skills, docs, QA) | Pages (branch) run #3 success, game unchanged |
| 2026-11-09 | `4ea8f74` | PR #4 NC-BASIC-1 (EN/PL UI, save validation + backup, user-select, safe areas); merge commit of approved head `5183fdc` | Pages (branch) run #4 success; post-merge: public `index.html`/`game.js`/`style.css` byte-identical to `main`, Chromium en-US → EN, pl-PL → PL, 0 page errors, only own host requested, an existing v1 save (level 3, $4321) loaded and kept after reload, no `.bak` |
| 2026-11-09 | `6837950` | PR #5 NC-PHYS-1 (fixed 1/240 s step, collision fixes, core fit); merge commit of approved head `2181c94`, base `4ea8f74` | Pages (branch) run #5 success; post-merge: public `game.js` byte-identical to `main`, Chromium en-US 907×510 / 1920×1080 → EN, pl-PL 800×450 → PL, 0 page errors, no external requests, an existing v1 save (level 3, $4321, 4 balls) loaded and kept after reload, no `.bak` |
| 2026-11-09 | `401f9e3` | PR #6 NC-CORE-1A (world scale 250, aimed turrets, core bar, hint); merge commit of approved head `2abb864`, base `6837950`, merged by Claude on the owner's explicit authorisation in the NC-ORIGINAL-1 prompt | Pages (branch) run #6 success; post-merge: public `index.html`/`game.js`/`style.css` byte-identical to `main`, Chromium en-US 907×510 / 1920×1080 → EN, pl-PL 800×450 → PL, 0 page errors, only own host requested, an existing v1 save (level 3, $4321, 4 balls) loaded and kept after reload, no `.bak` |
