---
name: nc-save
description: "Neon Crusher save safety: localStorage key neonCrusher.save.v1, validation, schema version, migrations, backups of unreadable data, multi-tab, CrazyGames Data Module adapter. Use whenever loadSave/save or any saved field changes."
---

# nc-save

**Scope:** `Game.loadSave`, `Game.save`, saved fields, sanitising,
migrations, storage adapters (localStorage now, CrazyGames `SDK.data` later),
reset flows, test isolation from real saves.
**Elsewhere:** what a new currency means → `nc-economy`; SDK lifecycle →
`nc-crazygames`.

## Read first
- `docs/SAVE.md` (canonical contract — the only place save rules live).
- `docs/RISKS.md` NC-04, NC-05, NC-06, NC-19.
- `qa/save.mjs`.

## Procedure
1. Write fixtures first: current v1 saves (normal, max values), corrupted
   JSON, wrong types, out-of-range numbers, `null`, future `schemaVersion`,
   storage that throws. Each fixture = a check in `qa/save.mjs`.
2. Implement as pure functions (`sanitizeSave`, `migrateSave`) called from
   `loadSave`; the game loop never sees raw data.
3. Unreadable or newer data: copy the raw string to a backup key before any
   write, or run read-only; never auto-reset.
4. Round-trip every older format to the new one; run twice (idempotent).
5. Browser check: `qa/browser-smoke.mjs` save restore + reload.

## Done when
`docs/SAVE.md` describes the new format and migration, every fixture is a
PASS, NC-04/NC-05 rows closed or re-rated, the key is still
`neonCrusher.save.v1`.

## Stop and ask
Any change to the key, removal of a field, a migration that changes a
player's values, cloud-save conflict policy.
