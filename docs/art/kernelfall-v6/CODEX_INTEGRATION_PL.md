# CODEX — KERNELFALL ART V6 / REAL PNG INTEGRATION

**Wykonawca: Codex, koordynator: GPT, zatwierdzająca: właścicielka. Raporty i HANDOFF po polsku.**
Repo `klaudiamoscinska-art/neon-crusher`. Źródło: `feature/kernelfall-art-v6-raster`, folder `assets/kernelfall-art-v6`.

## Przed implementacją
1. Sprawdź aktualne SHA obu gałęzi. `main` ma istniejącą integrację V3 z PR #12; niczego nie zastępuj bez dowodów.
2. Odczytaj `assets/kernelfall-art-v6/README_PL.md`, `manifest.json`, `docs/GAME_DESIGN.md`, `docs/KERNELFALL_BASIC.md` i obecny renderer. Zweryfikuj pełne 92 pliki PNG i SHA-256, zero SVG w nowej paczce.
3. Zweryfikuj źródła w rzeczywistym kontekście gry, zwłaszcza: sprite alpha/fringing, miękkość upscalowanych bossów przy wysokim DPR, znaczenie pięciu stanów, wielkość modułów i nieoczekiwane artefakty tła. Nie deklaruj jakości przed pomiarem.
4. **Zanim zmienisz runtime**, porównaj V6 i V3 w identycznych realnych kadrach Canvas (zrzuty z Playwright), pokaż przewagi i słabości. Nie dodawaj marketingowych makiet do raportu jako screenshotów gry.

## Zakres
- Wprowadź tylko takie PNG V6, które w realnym runtime dają zauważalnie lepszy wygląd niż V3. Tam gdzie V6 jest słabszy, zostaw V3 i zgłoś potrzebę korekty zamiast wciskać gorszy asset.
- Zgodność colliderów, grafu zasilania, faktycznego HP, 3 archetypów i efektów kluczowa. Pancerz jest interaktywny; duża obudowa AI może być tłem, ale NIE może zasłaniać istotnych celów.
- Gra jest **idle**, drony są autonomiczne. Zachowaj OVERRIDE (w tym autopilot), 12 sektorów kampanii, endless, save v1, balanse, RNG i fizykę.
- Dokładnie 3 ulepszenia: **New drone**, **Override charge**, **Breach power**. Nie dodawaj fikcyjnych walut ani innych umiejętności.
- UI domyślnie EN bez rozbłysku PL; tylko `?lang=pl` daje polski. Te same assety raster na PC/iPhone, bez „low quality mobile”.
- Żadnych nowych zależności runtime ani SVG jako finalne ilustracje V6.

## QA i dowody
- Sprawdź `node qa/run-all.mjs`, browser smoke, physics, save, ekonomię, RNG, rekonstrukcję sektorów 1–12, shield, collapse, resize i FX.
- Screenshoty realnego Canvas: 1920×1080, 1366×768, 907×510, 390×844 DPR2/3, 375×812, 844×390. Porównania V3/V6 muszą używać identycznej sceny, sektora, czasu i seed, przy użyciu jawnych fixture jeśli konieczne.
- Pokaż pierwsze 60 s naturalnego idle i osobno aktywny OVERRIDE, AI SHIELD, odcięcie grafu i koniec sektora 12.
- Zmierz czas renderowania i pamięć atlasu; nie pogarszaj obecnego wyniku o >10% bez analizy i decyzji.
- Fizyczny iPhone/CG iframe/test z realnego portalu: NOT RUN jeśli niedostępne. Zachowaj statusy PASS/FAIL/NOT RUN/NOT VERIFIED.
- W raporcie wskaż dokładnie które pliki V6 są **faktycznie rysowane** i które pozostały nieużyte.

## Git i odbiór
Pracuj na nowej gałęzi implementacyjnej. Commit/push, utwórz PR, przekazuj raport PL, SHA, link do PR, linki do realnych screenshotów, werdykt READY FOR GPT REVIEW / BLOCKED. **Nie wykonuj merge ani deploy produkcji bez zgody właścicielki**.

Przy blokadzie estetycznej, błędnej alfie albo utracie czytelności: STOP; zachowaj kod i materiały do odbioru, wskaż dokładne pliki wymagające ponownego wykonania. Nie deklaruj finalnej jakości, jeśli screenshoty jej nie potwierdzają.
