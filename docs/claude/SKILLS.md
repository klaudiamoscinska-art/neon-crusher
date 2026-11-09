# Skills — architecture, selection, maintenance

12 project skills in `.claude/skills/nc-*/SKILL.md` (Claude Code project
skills: one folder per skill, YAML frontmatter `name` = folder name +
`description`; Claude sees only the descriptions until a skill is invoked or
chosen, then reads that one body). Format and sync are checked by
`node qa/instructions.mjs`.

## The set

| Skill | Owns | New / from GLITCH GULP |
|---|---|---|
| `nc-gameplay` | loop, first minute, goals, originality, KPIs, next feature | adapts vh-arena-gameplay; absorbs vh-market-intelligence, naming, prioritisation of vh-director |
| `nc-physics` | collisions, timestep, tunnelling, layout geometry, resize | **new** (the core of this game; no GG equivalent) |
| `nc-economy` | costs, income, upgrades, pacing, offline/prestige, bots | adapts vh-progression-economy |
| `nc-engineering` | structure, refactors, conventions, test seams | adapts vh-game-engineer |
| `nc-save` | save contract, validation, migration, Data Module adapter | adapts vh-save-security |
| `nc-qa` | harness, suites, KNOWN checks, evidence | adapts vh-qa-automation |
| `nc-ux` | DOM layout, frames, input, a11y, PL/EN text | merges vh-mobile-accessibility, vh-narrative-localization, UI half of vh-ux-gamefeel |
| `nc-visual-fx` | canvas drawing, glow, particles, juice, cover art direction | adapts vh-vector-art + feel half of vh-ux-gamefeel |
| `nc-audio` | Web Audio SFX/music, mute, iOS resume | adapts vh-audio |
| `nc-performance` | frame cost, glow cost, scaling, load size | adapts vh-performance |
| `nc-crazygames` | requirements, SDK, ads rules, submission, Preview, rights/privacy | merges vh-portal-integrations, vh-monetization, vh-marketing-aso, vh-legal-risk |
| `nc-release` | Pages, CI, package, PR/merge gates, rollback | adapts vh-release-manager |

Why 12: each skill maps to a distinct area of files or decisions that a
stage of `docs/ROADMAP.md` works on, so a typical task loads one body
(~2 KB) and at most two helpers. Fewer skills would force unrelated rules
into one body (e.g. audio + visuals, or physics + economy — both have
different invariants and different owner gates); more would split areas that
always change together (portal rules, ads, submission and legal on one
portal). Coordination is not a skill: it is a procedure every session
follows, so it lives in `CLAUDE.md` + `docs/claude/WORKFLOW.md`.

## Choosing skills (1–3 per task)

| Task | Main | Helpers only if needed |
|---|---|---|
| Save hardening (NC-SAVE-1) | `nc-save` | `nc-qa` |
| Collisions, frame rate (NC-PHYS-1) | `nc-physics` | `nc-qa`, `nc-economy` (pace impact) |
| Design of the twist / first minute | `nc-gameplay` | `nc-economy` |
| Prices, upgrades, offline earnings | `nc-economy` | `nc-save` (new fields) |
| English, layout, input (NC-I18N-1) | `nc-ux` | `nc-crazygames` |
| Effects, glow, particles | `nc-visual-fx` | `nc-performance` |
| Sound | `nc-audio` | `nc-ux` (toggle) |
| Speed on devices | `nc-performance` | `nc-visual-fx` |
| Portal readiness, SDK, submission | `nc-crazygames` | `nc-release`, `nc-save` |
| Pages, CI, package, merge | `nc-release` | `nc-qa` |
| Refactor, new class | `nc-engineering` | `nc-qa` |
| New or failing tests | `nc-qa` | area skill |
| Docs / instructions only | none | — |

Each skill lists "Read first" (exact doc sections) and "Elsewhere" (which
neighbour owns what), so a session neither reads all docs nor opens other
skills to find a boundary.

## GLITCH GULP audit (22 skills, read 2026-11-09, `vector-hole@3e3089d`)

Facts measured in the reference repo: 22 SKILL.md files, 3.7–6.8 KB each
(103 KB total); every one opens with the same two sections ("Kontrola v1.3",
"Kontrakt wejścia", identical md5 in all 22) that send the reader to six shared
references (~32 KB); the pack is updated only from ZIPs, so project-specific
drift had to be patched in `CLAUDE.md` through a "Precedence / known
conflicts" list; GG's own token guide measured ~6.7 KB of always-loaded
descriptions.

| GG skill | Decision | Reason |
|---|---|---|
| vh-director | MERGE | orchestration = procedure for every session → `CLAUDE.md`/WORKFLOW; prioritisation → `nc-gameplay`; its "21 skills" and decision-log drift shows the cost of a separate copy |
| vh-arena-gameplay | ADAPT | → `nc-gameplay`; arena/rivals/120 s rounds don't exist here |
| vh-mission-content | SKIP | no missions or campaign; level shapes are covered by `nc-gameplay`/`nc-physics` |
| vh-progression-economy | ADAPT | → `nc-economy`; tiers/workshop/boosters replaced by idle upgrades |
| vh-game-engineer | ADAPT | → `nc-engineering` |
| vh-performance | ADAPT | → `nc-performance`; shadowBlur glow is this game's main cost |
| vh-save-security | ADAPT | → `nc-save`; no arena/district isolation; adds Data Module |
| vh-qa-automation | ADAPT | → `nc-qa`; vm harness of the real `game.js` instead of mission regressions |
| vh-test-console | SKIP | no dev panel; GG's panel created an unresolved owner conflict (PX03); add only when a stage needs it |
| vh-mobile-accessibility | MERGE | → `nc-ux` (same files: `index.html`/`style.css`) |
| vh-ux-gamefeel | MERGE | UI part → `nc-ux`, feedback/juice → `nc-visual-fx` |
| vh-narrative-localization | MERGE | i18n/copy → `nc-ux`; naming → `nc-gameplay`; no story in this game |
| vh-vector-art | ADAPT | → `nc-visual-fx` (canvas neon, not an SVG city) |
| vh-audio | ADAPT | → `nc-audio` |
| vh-portal-integrations | MERGE | → `nc-crazygames`; one target portal, Poki dropped |
| vh-monetization | MERGE | → `nc-crazygames`; monetization exists only after Full Launch |
| vh-legal-risk | MERGE | → `nc-crazygames` (rights, privacy) + `docs/RISKS.md`; the game collects no data |
| vh-marketing-aso | MERGE | → `nc-crazygames` (covers, videos, texts) |
| vh-market-intelligence | MERGE | → `nc-gameplay` (genre, originality) |
| vh-release-manager | ADAPT | → `nc-release`; branch-based Pages today |
| vh-analytics-experiments | SKIP | no telemetry/backend; CrazyGames dashboard KPIs are read in `nc-gameplay`; external analytics = owner + privacy decision |
| vh-liveops | SKIP | premature before Basic Launch; listed as "Later" in the roadmap |

## Taken from GLITCH GULP (and why)

- Owner's standing rules (Polish, one copyable block, production `main`
  protection, preflight, `PASS / FAIL / NOT RUN`, mandatory HANDOFF +
  resuming) — they prevented real incidents there.
- Stage flow with GPT review before every merge; approvals never carry over.
- Lean `CLAUDE.md` + "where to read" table + an instructions check
  (`qa/instructions.mjs`, here extended to skills, duplicates and the risk
  register).
- Windows false-PASS guard (`isMain`) and "a suite that ran nothing is NOT RUN".
- No test framework, real-runtime tests, logs in `qa/out/`.
- CrazyGames lessons: Pages ≠ package ≠ Preview, owner-run Preview checklist,
  English early, originality risk, scripted package with a validator.
- "A URL never changes meaning" / one origin = one save.

## Not taken (and why)

- ZIP-only pack updates and a shared 16-file reference folder — they caused
  drift and a precedence list; NC skills are repo-owned, edited in PRs,
  validated by `qa/instructions.mjs`.
- The repeated entry contract in every skill — rules live once in `CLAUDE.md`
  and the topic docs.
- P00/GO_CORE/GO_TOOLS gates and the PX prompt queue — specific to GG's
  energy/arena/dev-panel history; here `qa/run-all.mjs` + `docs/RISKS.md`.
- E3 immutable releases and the deployment ledger — sized for a 1 MB
  multi-module game with cached releases; a reduced version is planned in
  `docs/RELEASE.md`.
- GG palette and copy rules (saturated neons are a regression there; they are
  Neon Crusher's identity).

## Maintenance

- Edit a skill in a normal PR; keep its description ≤ 300 characters with the
  trigger words; keep the body ≤ 6 KB; never copy a rule that already has a
  home — link the doc section.
- Add a skill only when a new area of files/decisions appears that no skill
  owns and tasks keep loading two skills for it; remove one that no stage used
  for two roadmap phases (record usage in stage reports: "skills used").
- After any change run `node qa/instructions.mjs`.
