---
name: nc-release
description: "Neon Crusher release management: GitHub Pages (deploy from main), PR and merge gates, CI workflow, CrazyGames zip package build and validation, versioning, rollback by forward commit, post-merge checks. Use for anything that publishes or packages the game."
---

# nc-release

**Scope:** `docs/RELEASE.md`, `.github/workflows/*`, package scripts (to be
added in NC-RELEASE-1), release log, post-merge verification.
**Elsewhere:** portal requirements → `nc-crazygames`; tests → `nc-qa`.

## Read first
- `docs/RELEASE.md` (whole), `docs/claude/WORKFLOW.md` "Stage flow" steps 6–10.

## Rules
- Every merge to `main` publishes on Pages today; Claude never pushes to
  `main`, merges without explicit per-PR authorization, re-runs deployments,
  or changes Pages settings.
- Workflows: least privilege (`contents: read` unless deploying), no
  `pull_request_target`, no secrets in logs, pinned major action versions; a
  deploy job only on `main`.
- The package is produced by a script from a clean checkout and validated
  (only runtime files, sizes, relative paths, no external URLs, SHA-256
  manifest); never hand-made, never committed.
- Rollback = forward commit through a PR; never force-push or rewrite `main`.

## Procedure
1. Before proposing a workflow change: state exactly which events can
   publish, with which permissions; run `node qa/integrity.mjs` (Liquid guard)
   and the suites the workflow will run.
2. For a release PR: runtime diff vs `origin/main`
   (`node qa/integrity.mjs --base origin/main`), full `qa/run-all.mjs`,
   release-log row in `docs/RELEASE.md`.
3. After the owner's merge: Pages run for the merge SHA green, live page
   loads, save survives (owner or browser smoke against the live URL).

## Done when
Publish paths documented, checks green, release log updated, nothing
published that the owner did not approve.

## Stop and ask
Any change to what or when something publishes, Pages source, branch
protection, or the package contents.
