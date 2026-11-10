# KERNELFALL — ZADANIE INTEGRACYJNE CLAUDE CODE / VISUAL V3

Repozytorium: `klaudiamoscinska-art/neon-crusher`.
Gałąź źródłowa materiałów: `feature/kernelfall-art-v3-source`.
`main` zawiera scalony PR #11; pobierz aktualny HEAD i nie zakładaj, że SHA pozostaje niezmienne.

## Wymagane wejście
Odbierz od właścicielki **`KERNELFALL_ART_V3_REPO.zip`** przygotowany przez GPT. Rozpakuj archiwum i skopiuj cały folder `assets/kernelfall-v3/` do repo. Prawdziwe PNG są w ZIP; sam ten dokument nie zastępuje plików graficznych. Sprawdź SHA-256 i rozmiary według `manifest.json`. W ZIP są również `README.md`, `INTEGRATION_SPEC_PL.md`, `CLAUDE_PROMPT_PL.txt` i przykłady oznaczone CONCEPT.

## Cel
Właścicielka nie akceptuje prototypowej grafiki PR #11: małe czerwone kwadraty, miniaturowy rdzeń, liczby zasłaniające akcję. Ten PR ma faktycznie wdrożyć przygotowane assety do runtime Canvas 2D, nie tylko podmienić logo.

## Zakres
1. Zachowaj działający system idle, ręczne OVERRIDE, 12-sektorowy finał/endless, AI shield i NEURAL COLLAPSE. Bez zmian balansu, zapisu `neonCrusher.save.v1` i jego 5 pól, fixed-step 1/240, RNG, sterowania oraz EN/PL.
2. Wprowadź lokalny loader i cache sprite’ów, preload z fallbackiem wyłącznie awaryjnym; brak nowych zależności, SDK, reklam i zewnętrznych hostów.
3. Użyj 3 dużych sylwetek bossów jako spójnych wizualnych struktur 2.5D, odrębnych od warstwy hitboxów; dzielony strefami wygląd zamiast statycznego renderu całego gameplayu.
4. Podmień wizualne moduły z PNG `modules/`. Skala 22–49 px wymaga testów czytelności, dobierz snapping i sampling do DPR, nie ingeruj w kolizje. Zmiany intact/damaged/critical/isolated/broken mają odpowiadać realnemu HP i odcięciu zasilania.
5. Wykorzystaj nowe drony, emitery, ikony, tło i efekty. Efekt chain ma podążać po krawędziach istniejącego grafu. Nie zmieniaj naliczania kasy, ogranicz tylko nakładające się pływające napisy `+$...`.
6. Na iPhonie UI ma pozostawać czytelny i dotykowy. Bossa, jego słabe punkty i połączenia trzeba widzieć bez powiększania.

## Twardy odbiór
- 390×844 + DPR 2/3: realny pierwszy ekran, późny sektor, minimum 3 archetypy, reakcja łańcuchowa; porównanie BEFORE/AFTER.
- 800×450 i 907×510: prawdziwy aktywny gameplay z widoczną różnicą wizualną, a nie tylko statyczna makieta.
- 1920×1080 z 60 dronami: pomiar klatek w porównywalnej sesji, regresja >10% wymaga poprawy albo STOP.
- Testy: `node qa/run-all.mjs`, browser-smoke i wszystkie obecne testy, save, reduced motion, iframe; rozróżniaj PASS/FAIL/NOT RUN/NOT VERIFIED.
- Prawdziwe screeny z Chromium i wykaz `image.src` PNG faktycznie użytych w runtime, a także 404/Console/Network 0 błędów. Wizualny PASS wystawia wyłącznie właścicielka po obejrzeniu.
- Wydajność i możliwość gry bez mikropłatności wymagają zachowania całej mechaniki. Na końcu PR do `main`, bez MERGE i DEPLOYMENTU.

Jeśli asset jest nieczytelny w 22 px, zaproponuj konkretny fallback 2D dla tego jednego elementu, ale **nie zachowuj siatki neonowych kwadratów jako głównej dominanty**. Przede wszystkim faktyczna integracja 100 PNG z paczki.

Raporty, handoff, komunikaty i prompty **po polsku**. W razie 403: eksport `git format-patch --binary` i ZIP. Nie rób ponownie całej gry.
