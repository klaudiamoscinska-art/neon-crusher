# CLAUDE.md

Loaded into every session: only rules that always apply, plus pointers. A
detail moved to a referenced file is not optional — read that file before
working in its area.

## Owner's standing rules (every session)

- **Polish** for every reply, report and HANDOFF to the owner; code, comments,
  commit messages and these instruction files stay in English.
- **One-click copy:** every final report, HANDOFF and test summary is ONE Markdown code block with nothing before or after it (format: `docs/claude/WORKFLOW.md`). Progress notes may be plain text.
- **Roles:** Owner = final decisions, approvals, merges, device tests, the
  CrazyGames portal. GPT = coordination, planning, independent review of every
  PR, risk analysis. Claude = implementation, tests, docs, PR, report.
- **Production = `main` of `klaudiamoscinska-art/neon-crusher`; every merge to `main` publishes on GitHub Pages.** Never commit or push to `main`, never merge a PR, never run a deployment or change Pages settings — unless the current prompt explicitly authorizes merging that specific PR after GPT's review and the owner's approval. Work on a stage branch; open a PR only when asked.
- **Preflight before work:** `git fetch`, repo, branch, HEAD, `origin/main`, `git status`, `git worktree list`; resume an existing stage branch/PR/HANDOFF instead of restarting.
- **No destructive git** (`reset --hard`, `clean`, `stash`, force-push, history rewrites), no `git add -A` without checking the list. Unexpected state or a conflict → stop and report; never overwrite earlier work.
- Don't publish, upload to portals, sign or accept terms, spend money, or change global Claude settings without explicit consent.
- **Evidence:** a check that executed nothing is `NOT RUN`, never `PASS`; code review alone is never `PASS`; compare with the base on the same machine; name every new failure. Statuses: `PASS / FAIL / NOT RUN / NOT VERIFIED`, features `IMPLEMENTED / PARTIAL / NOT IMPLEMENTED / NOT VERIFIED`.
- **HANDOFF is mandatory** after every significant stage and whenever work passes to a new session (`docs/claude/WORKFLOW.md`).
- **Token hygiene:** `docs/claude/TOKENS.md`.

## Project

**Neon Crusher** — physics-sandbox idle game, cyberpunk neon, Breakout-style
core: turrets auto-fire balls that bounce around a canvas and grind down a
destructible block core; every hit pays cash; cash buys upgrades; clearing
the core levels up and regenerates a harder one. Target portal: CrazyGames
(Basic Launch first, then Full Launch). Polish UI today; English required.

Runtime = `index.html`, `style.css`, `game.js` (vanilla JS classes, Canvas
2D, no dependencies, no build). Everything else is dev-only.

## Invariants (change only with an owner decision)

- **Runtime scope:** `game.js`, `index.html`, `style.css` change only when the stage prompt allows it.
- **Save:** the key `neonCrusher.save.v1` never changes; never reset, overwrite or downgrade a player's save; contract and fix plan in `docs/SAVE.md`.
- **No dependencies**, bundler or build step for development; zero external requests from the runtime; no `innerHTML` for text.
- **Economy and progression** numbers change only with the owner (`docs/GAME_DESIGN.md`, `nc-economy`).
- **Physics:** exact block bounces, no tunnelling, results independent of refresh rate (target; NC-03 open).
- **Honest play:** no energy, timers or paywalls in front of play.
- **CrazyGames:** no SDK, ads or monetization before the stage that adds them; no custom fullscreen button; English localization required before submission (`docs/CRAZYGAMES.md`).
- Neon glow convention for every drawable (`docs/ARCHITECTURE.md`).

## Commands

No package manager, build or linter. Serve the folder (`python3 -m http.server 8080`) or open `index.html`.

```bash
node qa/run-all.mjs            # all suites, exit 1 on FAIL (KNOWN = registered open defect)
node qa/integrity.mjs --base origin/main --no-runtime-change   # stage must not touch runtime
node qa/instructions.mjs       # CLAUDE.md, skills, docs consistency
```

Suites, harness and statuses: `qa/README.md`.

## Where to read (on demand)

| Task | Read first |
|---|---|
| Code structure, conventions, test seams | `docs/ARCHITECTURE.md` |
| Gameplay, balance, text (the spec) | `docs/GAME_DESIGN.md` |
| Saves | `docs/SAVE.md` |
| Known defects, audit, priorities | `docs/RISKS.md` |
| Next stages | `docs/ROADMAP.md` |
| CrazyGames requirements, Preview | `docs/CRAZYGAMES.md` |
| Pages, CI, packages, rollback | `docs/RELEASE.md` |
| Stage flow, git, review, reports, HANDOFF | `docs/claude/WORKFLOW.md` |
| Skills and their selection | `docs/claude/SKILLS.md` |

## Skills

12 project skills `.claude/skills/nc-*`. Use 1–3 skills per task: the one
whose description fits the area, helpers only when the task really reaches
their area (table in `docs/claude/SKILLS.md`); docs-only work needs none.
Skills hold procedures, not rules — rules live here and in the docs above.
After editing skills or docs run `node qa/instructions.mjs`.
