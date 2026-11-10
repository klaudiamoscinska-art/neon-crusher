# KERNELFALL — produkcyjny zestaw grafik V3 (dla Claude)

## Co jest gotowe
W katalogu `assets/kernelfall-v3/` jest zestaw prawdziwych **oddzielnych, przezroczystych PNG**, a nie sklejona makieta: 3 bossy x 5 stanów, 5 typów modułów x 5 stanów, 3 drony, 4 stany emitera, 40 klatek efektów, panel HUD, ikony, tekstura areny i branding. Każdy plik ma metadane w `manifest.json`. Kopiuj cały folder `assets/kernelfall-v3/` do repo pod identyczną ścieżką.

**Status:** pakiet ART jest gotowy, ale integracja w rzeczywistym `game.js` i odbiór wizualny są **NOT RUN / NOT VERIFIED**. Zaprojektowane przez GPT i wygenerowane grafiki bossów zostały przerobione na odrębne PNG. Część małych elementów i animacji zbudowano proceduralnie w Pillow. Nie przedstawiamy makiet jako screenów gry.

**Materiały referencyjne:** `references/` oraz `previews/04-mobile-composition-CONCEPT.png` = wygląd do osiągnięcia, NIE render z runtime. `previews/03-scale-test.png` = rzeczywiste skalowanie PNG, pokazujące czytelność w rozmiarach 22/34/49 px.

## Zasady integracji
1. W grze po PR #11 `Block.drawCore` i `Game.draw...` są Canvas 2D, a klocki mają 16-36 *jednostek świata*. Załadować PNG lokalnie (ImageBitmap/Image), pre-cache przy inicjalizacji; `ctx.drawImage` w istniejącym loopie, bez data URI w `game.js`, żadnych requestów z sieci poza własną paczką.
2. **Kolizje/geometry są nietykalne**. Duże bossy są rysowane w tle struktur i centralnym obiekcie, ale to tylko warstwa wizualna; nie zasłaniaj aktualnych celów ani hitboxów. Podziel złożenie AI na podkład/obudowę bossa + interaktywne moduły. Skaluj według `coreExtent` i własnego viewporta. **Nie skaluj bossa na pełny viewport na ślepo**.
3. `intact` (>70% HP), `damaged` (35-70%), `critical` (0-35%), `isolated` (odcięte od zasilania), `broken` (przejściowe rozpady). Priorytet stanu: broken > isolated > HP damage. Nie dokładaj twardych bloków za zniszczonymi colliderami.
4. NEURAL COLLAPSE: odcięty węzeł przechodzi na cyjan; kaskadowa fala po **prawdziwym grafie zasilania**, nie na odległość. Żaden efekt nie może zmieniać HP, RNG, kasy ani targetingu.
5. Względne rozmiary bossów w scenie ustal na realnych screenach: większa sylwetka AI, 3 rozpoznawalne archetypy. Przy małych kafelkach rób celowo uproszczoną grafikę, zamiast bezkrytycznie skalować 512px detal do 22px. Wymagany odbiór przez właścicielkę.
6. `fx` = osobne klatki, rysowanie w fazie wizualnej; animacja oparta na czasach istniejących efektów, `reduced-motion` bez błysków i drgań. Cache — bez dekodowania/skalowania w każdej klatce.
7. Cyjan = gracz/przejęte, czerwony = AI, amber = moc/obrona, magenta = OVERRIDE. Zielony tylko dla nagród. **Zbijaj pływające kwoty kasy** (wizualne grupowanie, max liczby na ekranie) bez zmiany naliczania.
8. W docelowej grze nie używaj grafik `references/*` jako tła lub jednej warstwy gameplayu. Logo już istnieje w obecnym main: nie zmieniać nazwy, nie robić nowego rebrandingu.

## Weryfikacja
Odpal QA kompletne i browser smoke, następnie fizycznie sprawdź render: 390x844, 800x450, 907x510, 1920x1080 i 60 dronów, mobile DPR 2/3, reduced motion, 3 archetypy oraz 4 stany uszkodzenia, save v1, EN/PL. Wymagane **realne screenshoty Chromium z runtime**, a nie `previews/`. Nie deklaruj prawidłowości grafiki bez porównania przez GPT/właścicielkę.

## Limity i uczciwy status
To zestaw startowy gotowych elementów 2D; **nie są to pełne animacje skeletal ani komplet sprite'ów każdej kombinacji parametrów gry**. Claude może układać je warstwowo, ale nie wolno mu deklarować „wygląda jak makieta” bez rzeczywistego porównania screenshotów. Brak zgody na merge/deploy. Nazwa/TM niezweryfikowane.
