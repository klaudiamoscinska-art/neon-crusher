# Token hygiene and efficiency control

Spend tokens on the task, not on re-reading context. None of this relaxes a
rule: a contract is still read when its area is touched.

## What every session pays up front (measured 2026-11-09, `wc -c`)

| Loaded automatically | Size |
|---|---|
| `CLAUDE.md` (only when Claude Code starts in the repo folder) | see `node qa/instructions.mjs` INFO (budget 9 000 B) |
| 12 skill descriptions | ~3 000 characters total (budget 300 each) |

For comparison, GLITCH GULP: `CLAUDE.md` 15.9 KB and 22 descriptions
~6.7 KB. No real token-usage telemetry exists for either repo, so no
percentage savings are claimed — only these byte counts.

On demand: a skill body ~1.6–2.2 KB; topic docs ≤ 20 KB each (checked);
`game.js` ~20 KB.

## Rules of thumb

1. Start Claude Code in the repo folder, so `CLAUDE.md` loads once.
2. Use the "Where to read" table in `CLAUDE.md`; read the named section, not
   the whole folder. Big file → `grep -n "^#"` first, then the section.
3. One read per file per task; note facts in the working notes/HANDOFF.
4. 1–3 skills per task (`docs/claude/SKILLS.md`); docs-only stages need none.
5. Test output goes to `qa/out/`; read the summary line and FAIL/KNOWN rows,
   never paste a full log.
6. Match the checks to the change: docs-only →
   `node qa/instructions.mjs` + `node qa/integrity.mjs --base origin/main
   --no-runtime-change`; code → affected suites on base and candidate, then
   `node qa/run-all.mjs` once.
7. A new session starts from the last HANDOFF, not from old reports or git
   archaeology.
8. Stage prompts can be short: goal, scope, STOP conditions, and only what
   differs from `CLAUDE.md`.
9. Reports follow `docs/claude/WORKFLOW.md` "Report format": verdict first,
   summaries, file references, no copies of unchanged docs.

## Model choice (recommendation; the owner picks)

| Work | Tier |
|---|---|
| save/migration, physics fixes, release/workflow, final review | most capable |
| running QA, small test/doc fixes, report drafts | mid tier |
| log summaries, mechanical edits, inventories | fastest |

A cheaper model that meets a save, economy or release question hands the step
back instead of guessing.

## Efficiency control (periodic, e.g. at the end of each roadmap phase)

`node qa/instructions.mjs` detects automatically:
- duplicated instruction lines (≥ 80 chars) across `CLAUDE.md`, docs and skills;
- oversized docs (> 20 KB), skill bodies (> 6 KB), descriptions (> 300 chars),
  `CLAUDE.md` over budget;
- dead paths and skills out of sync with `docs/claude/SKILLS.md`;
- KNOWN defect ids missing from `docs/RISKS.md`.

Manual review (GPT or owner, ~10 minutes):
- **Unused skills:** every stage report lists "skills used"; a skill unused
  for two roadmap phases is merged or removed.
- **Re-reading:** if HANDOFFs repeatedly tell the next session to read the
  same long file, move the needed fact into the HANDOFF template or a short
  section of the topic doc.
- **Low-value reports:** a report longer than its diff, or one that repeats
  unchanged docs, gets trimmed to the `WORKFLOW.md` format.
