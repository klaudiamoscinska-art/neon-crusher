## Podsumowanie

<!-- Etap, cel, co się zmieniło (2–5 punktów). Baza: origin/main <SHA>. -->

## Zakres i pliki runtime

- [ ] Ten PR **nie zmienia** `index.html` / `style.css` / `game.js` (`node qa/integrity.mjs --base origin/main --no-runtime-change`)
- [ ] albo: zmienia je w zakresie zatwierdzonym w prompcie etapu (wymień pliki i funkcje)
- [ ] Zapis: klucz `neonCrusher.save.v1` bez zmian; zmiana formatu tylko zgodnie z `docs/SAVE.md`

## Testy (PASS / FAIL / NOT RUN / NOT VERIFIED)

<!-- Baza vs kandydat na tej samej maszynie. KNOWN = znany defekt z docs/RISKS.md, nigdy PASS. -->

- [ ] `node qa/run-all.mjs` — wynik per zestaw, nowe FAIL-e wymienione z nazwy
- [ ] `node qa/browser-smoke.mjs` (Chromium, 10 ramek CrazyGames) — albo NOT RUN z powodem
- [ ] Ręcznie w przeglądarce (co dokładnie) — albo NOT RUN
- [ ] Urządzenia / CrazyGames Preview — wynik od właścicielki albo NOT RUN

## Dokumentacja

- [ ] `docs/GAME_DESIGN.md` zaktualizowany przy zmianie rozgrywki/balansu/tekstów
- [ ] `docs/RISKS.md` zaktualizowany (zamknięte / nowe ryzyka)
- [ ] `node qa/instructions.mjs` PASS przy zmianie instrukcji, skilli lub dokumentów

## Publikacja

Każdy merge do `main` przebudowuje GitHub Pages (`docs/RELEASE.md`). Opisz, co zostanie opublikowane: <!-- gra bez zmian / nowa wersja gry -->

## Odbiór i merge

- [ ] Niezależny odbiór GPT
- [ ] Wyraźna zgoda właścicielki na merge tego PR (scala właścicielka; Claude tylko przy jawnej autoryzacji w prompcie)
- [ ] Po merge: przebieg Pages dla commita merge zielony, gra działa (jeśli zmieniono runtime)

## HANDOFF

<!-- docs/claude/WORKFLOW.md „HANDOFF” -->
