# Dowody z rzeczywiście uruchomionej gry

Wszystkie pliki `screenshots/*.png` utworzono przez Chromium/Playwright z lokalnie uruchomionego HTML5. Nie są makietami ani referencjami ART. Odtworzenie: `node qa/art-v3-browser.mjs` (Playwright dostępny w środowisku QA, Chromium pod `/usr/bin/chromium`; bez dodawania zależności gry).

- `*-start.png`: pierwszy w pełni załadowany ekran gry. Basic zaczyna się bezpośrednio rozgrywką; nie ma osobnego menu, a kontrakt V3 zabrania dodawania nowego menu.
- `*-gameplay.png`: zwykła gra po kolejnych 4 sekundach, przed testowym podawaniem wejścia.
- `1920x1080-dpr1-*`, `1366x768-dpr1-*`, `390x844-dpr2-*`, `390x844-dpr3-*`, `375x812-dpr2-*`, `844x390-dpr1-*`: wymagane rozdzielczości; dotyk i DPR są emulowane w Chromium.
- `comparison-desktop-mobile.png`: zestawienie dwóch rzeczywistych screenshotów gameplay; obrazy nie są rozciągane do wspólnych proporcji.
- `before-main-907x510.png`, `after-v3-907x510.png`, `comparison-before-after.png`: rzeczywisty renderer origin/main i V3 przy tej samej rozdzielczości, seedzie i kontrolowanym czasie. Nie jest to pomiar wydajności.
- `fixture-firewall-*`, `fixture-memory-*`, `fixture-neural-*`: zatrzymana symulacja w uruchomionej grze, sektory 7/8/9, jawnie ustawione HP do inspekcji intact/damaged/critical. Kadry `shatter`/`captured` wykorzystują prawdziwe `hitBlock` na sercu oraz kontrolowany czas istniejącego finału. `graph-cut` niszczy realny węzeł przez `hitBlock` i wywołuje prawdziwą propagację `updateCollapse`.
- `fixture-module-*`: jawne fixture pięciu ról modułów i stanów. Używają prawdziwego `Block.drawCore`; nie zmieniają plików gry ani zapisów produkcyjnych.
- `fixture-uplinks-*-drones-*`: kontrolowane stany ładowania/firing oraz 3 warianty drona, renderowane normalnymi metodami gry.
- `fixture-shield-up-*`, `fixture-shield-break-*`: rzeczywiste `updateDefense`, `hitBlock` i `drawDefense`, z kontrolowanym wyzwoleniem w teście.
- `fixture-core-shatter-*`, `fixture-core-captured-*`, `fixture-victory-result-*`: prawdziwe rozbicie rdzenia sektora 12 przez `hitBlock`, a następnie istniejąca ścieżka przejścia do endless 13. Nie udają naturalnego dojścia gracza do finału.
- `fixture-all-fx-frames.png`: osobny podpisany specimen QA — 40 oryginalnych klatek wyświetlonych przez produkcyjny `SpriteAtlas.fx`; nie jest screenshotem gameplay.
- `fixture-art-load-error-390x844.png`: celowo uszkodzony jeden PNG; rzeczywista reakcja loadera i angielski komunikat błędu.
- `restart-907x510.png`: istniejący restart przez reload; gra zachowuje zapis v1 i sektor, zgodnie z funkcją autosave. Nie dodano nowej funkcji kasowania postępu.
- `nested-iframe-907x510.png`: HTML5 uruchomione w zagnieżdżonym iframe pod ścieżką odpowiadającą GitHub Pages.
- `390x844-dpr2-reduced-motion.png`: jawna preferencja reduced-motion; te same assety V3.

Fizyczny iPhone: **NOT RUN**. Estetyczny odbiór przez GPT/właścicielkę: **NOT VERIFIED** do czasu przeglądu screenshotów. Automatyzacja nie nadaje temu odbiorowi PASS.

Szczegółowe wyniki i lista faktycznych wywołań atlasu: `browser-results.json`. `runtimeDrawn` obejmuje tylko rysowanie Canvas, a nie samo wstępne ładowanie. Osobna kontrola dekoduje 100 PNG z manifestu i nie jest zaliczana jako naturalne wykorzystanie w rozgrywce.

Kontrole optymalizacji atlasu: **PASS** — porównanie pełnego cached rasteru z rysowaniem pomijającym przezroczyste marginesy dało identyczne piksele (max różnica 0) dla drona scout i bossa neural, DPR 1/2/3, ten sam pivot i skala, bez rotacji. **PASS** — wymuszone 15 rasterów bossów po 2048² px pozostawiło 3 wpisy FIFO, 12 582 912 pikseli (48 MiB RGBA); rzeczywista suma wymiarów odpowiada licznikowi cache. Limit dotyczy referencji rasterów atlasu, nie całkowitej pamięci przeglądarki.
