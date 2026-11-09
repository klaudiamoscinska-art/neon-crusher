---
name: nc-economy
description: "Neon Crusher economy and progression: upgrade costs, income per hit, HP scaling, upgrade value, pacing curves, offline earnings, prestige, balance bots and simulations. Use for any change to prices, rewards, upgrades or progression speed."
---

# nc-economy

**Scope:** cost and reward formulas, upgrade set, pacing (time to first
purchase, to each level), idle/offline earnings, prestige, number formatting
limits, balance simulations.
**Elsewhere:** why a feature exists → `nc-gameplay`; save fields for new
currencies → `nc-save`; collision accuracy → `nc-physics`.

## Read first
- `docs/GAME_DESIGN.md` "Economy" and "Design principles".
- `docs/RISKS.md` NC-09, NC-10, NC-19.
- `qa/economy.mjs` (cost checks, greedy bot, first-purchase timing).

## Rules
- Prices, rewards and curves change **only with the owner's decision**;
  Claude proposes with numbers, never ships a silent rebalance.
- Every upgrade must have a visible effect within seconds (NC-10 is the
  counter-example).
- No energy, timers or costs in front of play; rewarded ads (Full Launch)
  only as an optional bonus with a non-ad alternative.
- Keep numbers finite and saveable (NC-19); plan number formatting (K/M/B)
  before values outgrow the HUD.

## Procedure
1. Express the proposal as formulas + a table (level → cost, income, time).
2. Simulate with the harness bot on base and candidate (same seeds, same
   canvas sizes, e.g. 907×339 and 1920×909): time to first purchase, to levels
   2/5/10, at 5/15/60 min; report medians and ranges, label "bot, not players".
3. After approval: change code + `docs/GAME_DESIGN.md` + the expected values in
   `qa/economy.mjs` in one PR; touching saved fields → `nc-save` too.

## Done when
Owner-approved numbers in the GDD, bot table in the report, `qa/economy.mjs`
pins the new formulas, no new save field without a migration plan.

## Stop and ask
Always before shipping a change to numbers; whenever a change would reduce
an existing player's power or cash.
