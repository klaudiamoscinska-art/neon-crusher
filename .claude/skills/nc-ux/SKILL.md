---
name: nc-ux
description: "Neon Crusher UX, layout and text: responsive HUD/shop at CrazyGames iframe sizes, phone/tablet, safe areas, mouse/touch/keyboard input, accessibility, onboarding UI, PL/EN localization and copy. Use for index.html/style.css changes, player-facing text or input."
---

# nc-ux

**Scope:** DOM layout (`index.html`, `style.css`), HUD and shop, readability
at DPR 1, input methods, focus/keyboard, reduced motion, i18n strings and
copy (Polish + English), onboarding presentation.
**Elsewhere:** canvas drawing → `nc-visual-fx`; what the onboarding teaches →
`nc-gameplay`; portal rules → `nc-crazygames`.

## Read first
- `docs/CRAZYGAMES.md` "Requirements → Neon Crusher today" (frames, input,
  language, user-select, safe areas).
- `docs/RISKS.md` NC-07, NC-08, NC-17, NC-18.
- `docs/ARCHITECTURE.md` "Files" and "Persistence and responsiveness".

## Rules
- Every player-facing string exists in Polish and English from one table;
  English is the fallback language; Polish copy is gender-neutral.
- Must fit the 10 CrazyGames frames without page scroll; the canvas keeps the
  majority of the height; text readable at DPR 1.
- `#app` height `100dvh` (with fallback); bottom UI pads
  `env(safe-area-inset-bottom)`; no custom fullscreen button; no
  orientation-lock overlay; no touch-detection-based mobile UI.
- One obvious action per state; buttons never delayed or sized to trick.

## Procedure
1. Screenshot base at the 10 frames (`node qa/browser-smoke.mjs` →
   `qa/out/shots/`), change, screenshot candidate, compare.
2. Check text length in both languages at 800×450 (longest string wins).
3. Update `qa/browser-smoke.mjs` checks when a rule becomes enforceable.

## Done when
Smoke PASS at all frames, both languages shown, screenshots in the report
folder, NC rows updated.

## Stop and ask
Removing or renaming a visible feature, changing the brand/name, adding a
language beyond PL/EN.
