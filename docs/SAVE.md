# Save contract (canonical)

The only source of truth for persistence. `CLAUDE.md` and the skills point
here. Tests: `qa/save.mjs` (+ save checks in `qa/browser-smoke.mjs`).

## Current format (v1, unversioned)

`localStorage["neonCrusher.save.v1"]` = JSON object, exactly:

| Field | Type | Default | Meaning |
|---|---|---|---|
| `cash` | number | 0 | current cash |
| `level` | number | 1 | current level (core regenerated from it) |
| `maxBalls` | number | 1 | ball cap |
| `fireRateLevel` | number | 1 | fire-rate upgrade level |
| `damageLevel` | number | 1 | damage upgrade level |

Balls, blocks, block HP and turrets are **never** saved: a reload regenerates
a full-HP core for the saved level and spawns one ball (turrets refill to
`maxBalls`).

Writes: `Game.save()` only — every 5 s of game time, on `visibilitychange`
(hidden), `pagehide` and `beforeunload`. Reads: `Game.loadSave()` once, in the
constructor, through the pure `sanitizeSave(data)` (NC-BASIC-1).

## Load validation and backup (NC-BASIC-1, minimal)

- Per field: `cash` = finite number ≥ 0, taken as is; `level`, `maxBalls`,
  `fireRateLevel`, `damageLevel` = finite number ≥ 1, floored, capped at
  `SAVE_INT_MAX` (1000, keeps 1.5^n finite; unreachable in play). Anything
  else falls back to that field's default; the game always starts.
- **Exact** save = a JSON object with only the five fields, all valid and
  unchanged by the rules above → loaded as is, nothing else written.
- Anything else (bad JSON, array/number/null/string, unknown keys such as
  `schemaVersion`, any rejected or adjusted field) → the raw string is copied
  to `neonCrusher.save.v1.bak` **before** the game's first write; the valid
  fields are still loaded. One backup slot: a later unreadable save replaces
  an older backup.
- If the backup cannot be written, or the save cannot be read at all
  (storage throws), the session plays **without saving** (`saveBlocked`), so
  the original is never overwritten.
- Not done (deliberately, fast track): `schemaVersion`, migrations, restore
  UI, multi-tab guard (NC-06), Infinity on save (NC-19). Tests: `qa/save.mjs`,
  corrupted-save case in `qa/browser-smoke.mjs`.

## Invariants (never break without an owner decision)

1. The key `neonCrusher.save.v1` never changes (players' progress lives there,
   on GitHub Pages today and on CrazyGames later).
2. A load never destroys data it cannot read: no automatic reset, no
   overwrite of an unreadable or newer-format save without keeping a copy
   (enforced since NC-BASIC-1: backup key or no saving).
3. Every loaded value is validated (finite, integer where needed, in range);
   invalid values fall back per field, never crash the game (NC-BASIC-1).
4. A format change adds a `schemaVersion` field and a migration that is
   idempotent, tested with fixtures of every older format, and never
   downgrades a newer save.
5. Saved state stays minimal: derived state is regenerated, not stored.
6. Test or dev tooling never writes the player's key (a separate key/slot).
7. No personal data in the save.

## Later hardening (only when a stage needs it; runtime approval)

- `schemaVersion: 2` + `migrateSave(raw)` with the first format change;
- unknown future version → read-only mode instead of backup + load;
- immediate save after a purchase and a level-up (today only the 5 s timer);
- multi-tab: last-writer-wins documented or guarded (`storage` event) — NC-06.

## CrazyGames (Full Launch only)

CrazyGames' Data Module (`SDK.data.getItem/setItem`, localStorage-like API,
1 MB limit, synced to the account) must be the **only** save path on
CrazyGames once used ("fully rely on the Data Module", docs 2026-11-09). Plan:
one storage adapter (`localStorage` on GitHub Pages, `SDK.data` on
CrazyGames) behind the same key and the same `sanitizeSave()`; the Progress
Save toggle must be on in the submission. Lessons from GLITCH GULP CG-DATA-1/2:
SDK `init()` must finish before the first read; guest → login reloads the
game; logged-in writes are debounced 1–30 s; test every case in Preview
(`docs/CRAZYGAMES.md`).
