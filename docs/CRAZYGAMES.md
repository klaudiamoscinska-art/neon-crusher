# CrazyGames — requirements, readiness and procedures

Read from the official docs on **2026-11-09** (re-read requirements/gameplay, technical and quality for NC-ORIGINAL-1 the same day; `docs.crazygames.com`:
requirements/intro, technical, gameplay, ads, quality, game-covers,
account-integration, resources/basic-launch-metrics, sdk/intro, sdk/data,
faq). Re-read the pages before every submission and update the date — the
rules change. No SDK, ads or monetization are implemented in this repo yet.

## Launch model

- **Basic Launch** (first goal): live without CrazyGames-specific work; SDK
  optional; monetization disabled (ads switched off even if integrated).
  Runs ≥ 7 days and ≥ 500 plays (or ends after 21 days). KPIs on the
  developer dashboard: average play time (successful: 10+ min), Day-1
  retention (10–15 %), conversion = players who play ≥ 1 minute (top: 80 %+,
  load < 10 s, build < 20 MB). Updates are auto-approved during the period.
- **Full Launch** (if selected on those KPIs): SDK mandatory with
  `gameplayStart` (+ stop), land in gameplay immediately (max 1 click), ads
  only through the SDK and following the ad rules, works with AdBlock, progress
  linked to the CrazyGames account (Data Module) where the game saves,
  CrazyGames username/avatar if the game shows names, no external login.
  In-game purchases: invite only (Xsolla).

## Requirements → Neon Crusher today

| Requirement | Basic/Full | Status | Evidence |
|---|---|---|---|
| Initial download ≤ 50 MB (≤ 20 MB for the mobile homepage); without SDK total size counts | Basic | PASS | 3 runtime files ~170 KB uncompressed (NC-AI-RECOVERY-1; sprites are embedded SVG — the package ships no asset folder, no `reference/`/`preview/`/`svg/` sources) |
| ≤ 1 500 files, total ≤ 250 MB | Basic | PASS | 3 files |
| Relative paths only | Basic | PASS | `qa/integrity.mjs` |
| Works in Chrome and Edge | Basic | PASS (Chromium headless) / Edge NOT RUN | `qa/browser-smoke.mjs` |
| Safari works (else disabled on Safari) | Basic | NOT RUN | needs a device |
| Smooth on a 4 GB RAM Chromebook (else disabled on ChromeOS) | Basic | NOT VERIFIED | NC-13 |
| Mouse, keyboard, touch (if mobile supported) | Basic | PASS (Chromium): mouse click and emulated touch tap fire the volley, shop by click/tap/keyboard (focusable buttons), Space = volley, M = sound (no Esc, `KeyboardEvent.code` = layout-independent); real touch device NOT RUN | `qa/browser-smoke.mjs`, `qa/economy.mjs` |
| Playable landscape on desktop | Basic | PASS | 10 frames, `qa/browser-smoke.mjs` |
| `user-select: none` on body (tablets) | Basic | PASS (Chromium); tablet NOT RUN | NC-08 closed, `qa/browser-smoke.mjs` |
| Works in the CrazyGames app (safe areas) | Basic | IMPLEMENTED (insets on 4 sides); device NOT VERIFIED | NC-18 |
| Readable at DPR 1 in the 10 iframe sizes (907×510, 1216×684, 1077×606, 821×462, 1366×768, 1920×1080, 1536×864, 1280×720, 800×450 mobile, 1080×607 tablet) | Basic | PASS automated (fits, no scroll, no overflow, smallest text 11.2 px, EN + PL); human readability judgement NOT VERIFIED; canvas 62 % at 800×450 | NC-17 |
| Consistent physics at 144/165 Hz | Basic | PASS (simulation: fixed timestep, same seed = identical state at 60/144/165 Hz); real 144/165 Hz monitor NOT RUN | NC-03 closed, `qa/physics.mjs` |
| English localization; language from SDK locale, fallback English | Basic | PASS: EN default/fallback + PL; language from `?lang=` or the browser (no SDK yet); SDK locale with the SDK | NC-07 closed, `qa/i18n.mjs` |
| Intuitive controls, smooth, no errors | Basic | PASS (0 console errors); onboarding in gameplay (hint pill asks for the click/tap when the first volley is ready, ~3 s; no text wall, nothing to skip) / intuitiveness with players NOT VERIFIED | — |
| Original name, assets, content | Basic | NOT VERIFIED: all visuals are canvas shapes / inline SVG and all sounds synthesised in code (no third-party assets); gameplay twist = breach (NC-ORIGINAL-1); own visual identity "Network Recovery" (NC-AI-RECOVERY-1, stylized 2.5D, `docs/VISUAL_IDENTITY.md`) and a reacting opponent (adaptive defense); competitors' visuals not seen (portal not reachable from the build machine); name check open | NC-12 |
| No custom fullscreen button | Basic | PASS | none in code |
| No cross-promotion | Basic | PASS | no links |
| PEGI 12 (audience 13+) | Basic | PASS (abstract shapes, no violence/text content) — QA judgement NOT VERIFIED | — |
| No external ads; CrazyGames monetization disabled | Basic | PASS | no ads |
| Privacy notice only if the game collects personal data beyond the SDK | Basic | NOT APPLICABLE (collects nothing) | — |
| Sitelock must whitelist all CrazyGames origins | Basic | NOT APPLICABLE (no sitelock) | — |
| 3 covers (1920×1080, 800×1200, 800×800), preview videos, description + controls | Basic | NOT IMPLEMENTED | stage NC-CG-BASIC-1 |
| SDK + `gameplayStart`, Data Module, ads rules, AdBlock | Full | NOT APPLICABLE yet | stage NC-CG-FULL-1 |

Covers: no text other than the title, no borders/badges/store logos, not a
plain screenshot, consistent across the three sizes, no copyrighted visuals.

## Rules to respect in design now (so Full Launch is not a rewrite)

- Don't rely on touch detection to show mobile UI (laptops have touch
  screens); use the SDK's device info later.
- Orientation: configured in the submission, the portal asks users to rotate —
  no in-game orientation lock.
- Ads (Full only): never during active play, never on navigation buttons;
  pause + mute only when an ad actually starts; `adError`/no-fill must resume
  cleanly; rewarded ads optional, clearly labelled, never chained, never the
  only way to progress; midgame frequency is handled by the SDK (max 1 per
  3 min). For this game: a natural midgame point is the level-up transition.
- Save on CrazyGames = Data Module only (`docs/SAVE.md`).
- iOS suspends the `AudioContext`: resume it inside a touch/click handler
  (done since NC-ORIGINAL-1: `Sound.unlock()` on every pointerdown/click/key;
  iPhone NOT RUN).
- Keys: avoid Esc (closes fullscreen); support AZERTY if keys are ever used.

## Lessons from GLITCH GULP (CRAZYGAMES-BASIC-1, PREFLIGHT-2, CG-DATA-1/2)

1. **GitHub Pages ≠ local package ≠ CrazyGames Preview.** A PASS on Pages
   says nothing about the zip in the portal's iframe: different origin (fresh
   save), different storage (Data Module), different framing. Test the exact
   zip that is uploaded, and report Preview results separately.
2. The portal form is behind login — Claude cannot see it; everything about
   it is NOT VERIFIED until the owner reports.
3. A test with an SDK mock is not CrazyGames; the real SDK runs only in
   `local` mode on `localhost`/`127.0.0.1` (and is disabled elsewhere).
4. Write the owner's Preview checklist before the upload, with expected
   results per step, and record PASS/FAIL with time and a screenshot.
5. English was the main finding of their Basic preflight: plan i18n early.
6. Originality was their main acceptance risk; prepare the "how we differ"
   argument and a unique name before covers are made.
7. Keep the package builder a script with a validator (file list, sizes,
   relative paths, no dev files, no external requests) — never a hand-made zip.

## Package (stage NC-RELEASE-1 builds the script)

`game.zip` with `index.html` at the root + `style.css` + `game.js` only;
no `docs/`, `qa/`, `.claude/`, `.github/`, no source maps or dev hooks;
checked by a validator (files, sizes, relative paths, zero external URLs,
SHA-256 manifest in the stage report). Never committed to `main`.

## Preview — procedura dla właścicielki (PL)

Wykonuje właścicielka (formularz jest za logowaniem). Chrome, najlepiej okno
incognito; zapisz PASS/FAIL z godziną, przy FAIL zrzut ekranu i konsolę (F12).

1. Developer Portal → gra → wgraj dokładnie paczkę z raportu etapu (sprawdź
   SHA-256) → zapisz → Preview / QA Tool.
2. Gra startuje bez błędów w konsoli; od razu widać rozgrywkę (bez menu).
3. Teksty są po angielsku (od NC-BASIC-1; przeglądarka z językiem polskim
   pokazuje polski — do testu angielskiego dopisz `?lang=en` w adresie albo
   ustaw angielski w przeglądarce); brak polskich napisów dla gracza
   anglojęzycznego.
4. Kup ulepszenie; odśwież stronę (F5) → kasa i poziom zostają.
5. Zmień rozmiar okna / włącz pełny ekran portalu → gra się dopasowuje, nic
   nie znika, strona się nie przewija.
6. Telefon (jeśli zgłaszamy mobile): rozgrywka, przyciski sklepu działają
   palcem, przytrzymanie nie zaznacza tekstu, obrót ekranu.
7. Wyniki wklej do raportu etapu jako PASS / FAIL / NOT RUN.
