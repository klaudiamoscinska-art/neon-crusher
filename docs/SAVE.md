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
constructor; a field is taken only if `typeof === 'number'`; storage errors and
JSON errors are caught (`console.warn`) and the game starts on defaults.

## Invariants (never break without an owner decision)

1. The key `neonCrusher.save.v1` never changes (players' progress lives there,
   on GitHub Pages today and on CrazyGames later).
2. A load never destroys data it cannot read: no automatic reset, no
   overwrite of an unreadable or newer-format save without keeping a copy.
   (Today's code violates this: NC-05 — fix before public launch.)
3. Every loaded value is validated (finite, integer where needed, in range);
   invalid values fall back per field, never crash the game (today: NC-04).
4. A format change adds a `schemaVersion` field and a migration that is
   idempotent, tested with fixtures of every older format, and never
   downgrades a newer save.
5. Saved state stays minimal: derived state is regenerated, not stored.
6. Test or dev tooling never writes the player's key (a separate key/slot).
7. No personal data in the save.

## Planned hardening (stage NC-SAVE-1, needs runtime approval)

- `schemaVersion: 2`, pure `sanitizeSave(raw)` + `migrateSave(raw)`;
- unreadable raw string copied to `neonCrusher.save.v1.bak` before any write;
- unknown future version → read-only mode (play without saving), never overwrite;
- integers ≥ 1 for levels/balls, finite non-negative cash, level ≥ 1;
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
