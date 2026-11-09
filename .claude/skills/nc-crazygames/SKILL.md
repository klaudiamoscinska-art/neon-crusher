---
name: nc-crazygames
description: "Neon Crusher on CrazyGames: Basic vs Full Launch requirements, SDK (init, gameplayStart/Stop, Data Module, locale), ad rules, submission texts, covers and videos, Preview/QA Tool procedure, originality, privacy and asset rights, monetization later. Use for portal readiness or integration."
---

# nc-crazygames

**Scope:** everything the portal requires or allows; the SDK adapter (Full
Launch); submission materials; the owner's Preview checklist; platform-level
legal hygiene (rights to name/assets, privacy).
**Elsewhere:** building/validating the zip → `nc-release`; save adapter
internals → `nc-save`; text/layout fixes → `nc-ux`.

## Read first
- `docs/CRAZYGAMES.md` (whole; it is the verified summary with a date).
- Re-read the official pages you rely on at `docs.crazygames.com` and update
  the date in `docs/CRAZYGAMES.md`; if the host is blocked, report NOT
  VERIFIED instead of answering from memory.

## Rules
- Basic Launch first; no SDK, ads or monetization before a stage says so.
- SDK code (later) lives in one adapter: game logic decides *whether* to play,
  the adapter decides *when* to call the SDK; everything works when the SDK is
  missing, blocked or erroring.
- Ads: never during play, never on navigation, pause + mute only when an ad
  starts, `adError` resumes, rewarded optional with a non-ad alternative.
- Claude never logs in, uploads, submits or accepts terms; the owner does.
- Mock tests ≠ real SDK ≠ Preview: label each result.

## Procedure
1. Map each requirement to evidence in the table in `docs/CRAZYGAMES.md`.
2. For submission: covers/videos/texts checklist, package from `nc-release`,
   then the Polish Preview procedure for the owner with expected results.
3. After Preview: copy the owner's PASS/FAIL into the stage report.

## Done when
Requirements table current (date), every row has evidence or a stated gap,
owner's Preview results recorded or NOT RUN.

## Stop and ask
Contracts/exclusivity, monetization design, data collection, anything the
docs leave ambiguous.
