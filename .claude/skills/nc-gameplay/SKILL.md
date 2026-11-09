---
name: nc-gameplay
description: "Neon Crusher game design: core loop, first minute, goals, onboarding, originality twist, retention (Basic Launch play time, D1, conversion), level/content design, roadmap scoping. Use for any change to what the player experiences or why they return."
---

# nc-gameplay

**Scope:** what the game is and why it is fun — loop, first-minute script,
goals and milestones, new mechanics, level shapes as content, originality,
reading CrazyGames dashboard KPIs, choosing the next feature.
**Elsewhere:** prices/curves → `nc-economy`; collision maths and layout
geometry → `nc-physics`; DOM/layout/text → `nc-ux`; visuals → `nc-visual-fx`.

## Read first
- `docs/GAME_DESIGN.md` (whole file — it is the spec you change).
- `docs/RISKS.md` rows NC-09, NC-10, NC-11, NC-12; `docs/ROADMAP.md` stage table.
- `docs/CRAZYGAMES.md` "Launch model" only when KPIs or launch are in scope.

## Procedure
1. State the player problem first (which risk id, which moment of play).
2. Propose ≤ 3 options with cost, risk and what the player sees in the first
   60 s; mark which ones need the owner (new mechanic, economy, identity).
3. For an approved change: update `docs/GAME_DESIGN.md` (rule, numbers,
   status) in the same PR as the code; add or update a `qa/` check that pins
   the new rule (bot or harness), so balance claims have evidence.
4. Measure the first minute with the bot in `qa/economy.mjs` (time to first
   purchase, to first visible power jump) on base vs candidate.
5. Originality: compare against the genre in words, never copy a specific
   game's name, art, levels or text.

## Done when
GDD updated, the change visible within its promised time in the bot run,
risks re-rated in `docs/RISKS.md`, and nothing in the design needs energy,
paywalls or ads to progress.

## Stop and ask
New mechanic or identity change, anything touching economy numbers or the
save, removing a feature players already have.
