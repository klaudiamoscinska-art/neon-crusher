# Workflow: roles, stages, git, review, reports, HANDOFF

Canonical procedure for every stage. `CLAUDE.md` holds the rules; this file
holds the steps.

## Roles

| Who | Does | Never |
|---|---|---|
| Owner (właścicielka) | final decisions, approves scope and merges, physical/device tests, CrazyGames portal | — |
| GPT | coordination, planning, strategy, independent review of every PR, risk analysis; writes stage prompts | merges, pushes |
| Claude Code | implementation, tests, docs, PR, report + HANDOFF | merges without an explicit per-PR authorization; decides economy/save/release policy alone |

A stage prompt from the owner/GPT defines goal, scope, forbidden areas and
STOP conditions. Inside that scope Claude decides small technical questions
itself; outside it Claude stops and reports a decision for GPT + owner.

## Stage flow

1. **Preflight** (read-only): `git fetch origin`; repo, branch, HEAD,
   `origin/main` SHA, `git status --short`, `git worktree list`; existing
   stage branch / PR / HANDOFF (resume instead of restarting — "Resuming").
   Unexpected state (foreign uncommitted changes, diverged branch) → stop and
   report; never "clean up".
2. **Branch** from current `origin/main` with the stage's name
   (`<type>/nc-<stage>`); unset any upstream that points at `main`.
3. **Scope check**: list the files the stage may change. Runtime files
   (`index.html`, `style.css`, `game.js`) only when the prompt allows it.
4. **Work** in small commits; check the file list before every commit (no
   blind `git add -A`); no git identity change on the machine.
5. **Evidence**: run the suites the change touches on the candidate and, for
   runtime changes, on the base (same machine); `node qa/run-all.mjs` once at
   the end. Logs stay in `qa/out/` (git-ignored); the report quotes summaries.
   For a stage that must not touch runtime:
   `node qa/integrity.mjs --base origin/main --no-runtime-change`.
6. **Push** the stage branch only: `git push -u origin <branch>`. A push of a
   non-`main` branch publishes nothing (`docs/RELEASE.md`).
7. **PR** to `main` only when the prompt asks; body follows
   `.github/pull_request_template.md` and ends with the HANDOFF.
8. **GPT review** (relayed by the owner). Fixes = new commits on the same
   branch with affected checks re-run; no force-push, no history rewrite.
9. **Merge** by the owner after explicit approval of this PR. Claude merges
   only when the current prompt explicitly authorizes merging this PR after
   both gates. Every merge to `main` deploys (`docs/RELEASE.md`).
10. **After merge**: confirm the Pages run for the merge commit is green and
    the live game loads (when the merge changed runtime files).

Finishing one step never authorizes the next; an approval never carries over
to another PR or stage.

## Evidence vocabulary

Tests: `PASS / FAIL / NOT RUN / NOT VERIFIED`; features: `IMPLEMENTED /
PARTIAL / NOT IMPLEMENTED / NOT VERIFIED`. A check that executed nothing is
`NOT RUN`. Code review alone never yields `PASS`. `KNOWN` (in `qa/` output) =
a registered open defect (`docs/RISKS.md`), never counted as PASS. Compare
with the base on the same machine; name every new FAIL, never hide it in a
total. Simulation ≠ device ≠ CrazyGames Preview — label which one.

## Report format (one copyable Markdown code block, Polish)

```
A. WERDYKT: GOTOWE DO ODBIORU / BLOKADA (1 zdanie)
B. GIT: repo, gałąź, bazowe SHA, końcowe SHA, PR, git status
C. ZAKRES: co zrobiono (punkty, bez kopiowania dokumentów)
D. TESTY: zestaw → PASS / FAIL / NOT RUN / NOT VERIFIED (+ KNOWN), log: ścieżka
E. BEZPIECZEŃSTWO: runtime, zapis, merge, deploy
F. RYZYKA / DECYZJE: lista z id z docs/RISKS.md
G. NASTĘPNY KROK
H. HANDOFF
```

Lead with the verdict; reference files instead of pasting them; no repeated
unchanged documentation.

## HANDOFF (mandatory)

After every significant stage and whenever work passes to a new session.
Stored where it survives a lost session: PR body (end of stage) or a pushed
WIP commit + the PR/stage report (mid-stage). One screen, every field filled
("brak" rather than dropping a field):

```
STAN PRAC: <etap, co skończone / w toku>
REPO: <owner/repo>, gałąź <nazwa> @ <pełne SHA>, origin/main = <SHA>, PR: <link/brak>, git status: <czysto/lista>
TESTY: <zestaw: N/M PASS | FAIL | KNOWN | NOT RUN (powód)> — log: <ścieżka>
ZMIANY: <1–5 punktów>
OTWARTE DECYZJE: <dla właścicielki / GPT>
RYZYKA: <id z docs/RISKS.md>
NASTĘPNY KROK: <jedno zadanie + warunki STOP>
BEZPIECZNA KONTYNUACJA: <preflight, czego nie ruszać, max 3 pliki do przeczytania>
PROMPT KONTYNUACYJNY: <gotowy tekst do wklejenia>
```

For GPT add: review goal, PR/branch/SHA/base, changed files (1 line each),
evidence vs base, risks, decisions needed, "no merge/deploy without the owner".

## Resuming after a lost session

1. `git fetch origin`; `git worktree list`; look for the stage branch locally
   and remotely (`git ls-remote origin "refs/heads/*<stage>*"`) and its PR.
2. In each candidate worktree: `git status --short`,
   `git log --oneline origin/main..HEAD`. Uncommitted work there belongs to the
   previous session — keep it; never `reset`, `checkout --`, `clean`, `stash`.
3. Read the last HANDOFF and continue from NASTĘPNY KROK; re-run only checks
   whose inputs changed.
4. Two copies of the stage that disagree → stop and report.
