# Roadmap — Neon Crusher to CrazyGames

Proposed order (NC-FOUNDATION-1, 2026-11-09). Each line is one stage = one
branch + one PR + GPT review + owner approval (`docs/claude/WORKFLOW.md`).
The owner can reorder; a stage marked *owner decision* needs her choice before
implementation. Risk ids: `docs/RISKS.md`.

## Principles of the order

1. Protect players' data first (the game is already public on GitHub Pages).
2. Fix the simulation before tuning anything that depends on it (balance
   measured on buggy physics is wasted).
3. Decide the game's identity before polishing (originality is CrazyGames' main
   rejection reason; polish of an undistinctive loop is wasted).
4. Make the first minute fun before Basic Launch: Basic Launch metrics
   (play time, D1, conversion) decide whether Full Launch happens.
5. SDK, ads and monetization only after a successful Basic Launch.

## Stages

| # | Stage | Goal | Fixes | Main skill | Runtime change |
|---|---|---|---|---|---|
| 0 | NC-FOUNDATION-1 | workflow, skills, docs, QA, audit | — | — | none |
| 1 | NC-SAVE-1 | versioned, validated, backed-up save; immediate save on purchase/level-up | NC-04, NC-05, NC-19 (NC-06 decision) | `nc-save` | yes |
| 2 | NC-DESIGN-1 *(owner decision, docs only)* | the distinct twist (e.g. player-aimed shots, block types, combo/chain physics), first-minute script, new upgrade set replacing the dead fire-rate upgrade, offline earnings & prestige decision, name check | NC-09/10/11/12 design | `nc-gameplay`, `nc-economy` | no |
| 3 | NC-PHYS-1 | fixed-timestep simulation, approach check, full push-out, layout recompute on resize, turret clearance | NC-01, NC-02, NC-03, NC-14, NC-15 | `nc-physics` | yes |
| 4 | NC-I18N-1 | EN + PL strings table, language detection (browser now, SDK locale later), `user-select: none`, safe areas | NC-07, NC-08, NC-18 | `nc-ux` | yes |
| 5 | NC-CORE-1 | implement NC-DESIGN-1: first minute, onboarding in gameplay, new upgrades, goals | NC-09, NC-10, NC-11 | `nc-gameplay`, `nc-economy` | yes |
| 6 | NC-AUDIO-1 | synthesised Web Audio SFX (hits, breaks, level-up), mute toggle, iOS resume | NC-11 (audio) | `nc-audio` | yes |
| 7 | NC-PERF-1 | device measurements, glow budget (cached sprites / capped shadows), ball cap or batching | NC-13 | `nc-performance` | yes |
| 8 | NC-RELEASE-1 *(owner decision)* | Pages via an Actions workflow publishing only runtime files after QA; CrazyGames package script + validator | NC-16 | `nc-release` | workflow only |
| 9 | NC-CG-BASIC-1 | covers (3), videos, description/controls texts, package, owner's Preview test, submission by the owner | — | `nc-crazygames` | no |
| 10 | Basic Launch period (7–21 days) | read dashboard: avg play time (10+ min), D1 (10–15 %), conversion (80 %+); fix the weakest | — | `nc-gameplay` | per finding |
| 11 | NC-CG-FULL-1 | SDK init, `gameplayStart/Stop`, Data Module save adapter, `SDK.game` locale, ads rules (midgame between levels, optional rewarded) | — | `nc-crazygames`, `nc-save` | yes |
| 12 | Later | rewarded-ad design, events/seasonal covers, more content | — | — | — |

## Attractiveness track (runs through stages 2, 5, 6)

What CrazyGames' quality guidelines and Basic Launch metrics reward, mapped
to this game: land directly in gameplay (already true); a purchase and a
visible power jump inside the first minute; clear short-term goals (next
level, next unlock); satisfying feedback (particles exist, audio missing);
meaningful progression and a reason to return the next day (offline earnings,
daily bonus — honest, no energy); polish over feature count.

## Not planned (deliberately)

Backend, accounts outside CrazyGames, external analytics, in-game purchases
(CrazyGames IAP is invite-only), custom fullscreen button (forbidden on
CrazyGames), orientation lock overlay (the portal handles it).
