# KERNELFALL ART V3 — audyt źródeł

Data: 2026-11-10. Audyt plików i istniejącego renderera przed integracją. Wyniki runtime opisuje osobny raport QA; ten dokument nie stanowi dowodu uruchomienia gry.

## Baza i historia

| Ref sprawdzony po klonowaniu | SHA | Wynik |
|---|---|---|
| `origin/main` | `1fb7ab4b4a931a039adf047ae900c6b0641f882d` | PASS |
| `origin/feature/kernelfall-basic-final` | `5ca0f0dd07a97e529b3984c2d5c4658c31f134ad` | PASS |
| `origin/feature/kernelfall-art-v3-source` | `3a850878c63b793139e271eadf09a405048cc241` | PASS |

`git merge-base --is-ancestor` potwierdził, że Basic Final jest przodkiem main, a main jest przodkiem ART V3. Baza integracji z ART V3 zachowuje więc oba wcześniejsze pakiety. Podane przez właścicielkę SHA Basic i ART były aktualne w momencie pobrania.

## Integralność

PASS: dokładnie **100 PNG**, 100 rekordów manifestu, 6 783 530 bajtów PNG. Każdy plik sprawdzony przez SHA-256, liczbę bajtów, sygnaturę PNG i wymiary IHDR względem `assets/kernelfall-v3/manifest.json`. Zero rozbieżności. Audyt niczego nie przepisywał w pakiecie.

| Grupa | PNG | Rola |
|---|---:|---|
| brand | 4 | symbol 128/256/512, wordmark 480 |
| bosses | 15 | firewall/memory/neural × intact/damaged/critical/shatter/captured |
| modules | 25 | armor/memory/port/relay/firewall × intact/damaged/critical/isolated/broken |
| drones | 3 | scout/assault/support |
| uplinks | 4 | idle/charging/ready/firing |
| fx | 40 | impact/chain/shield_break/core_collapse/override × 8 klatek |
| ui | 8 | 5 ikon, 3 ramki HUD |
| environment | 1 | arena_floor_1024 |

## Dokumentacja i punkt odniesienia

Przeczytano `README.md`, `INTEGRATION_SPEC_PL.md`, `VISUAL_PARITY_EN.md` w `docs/art/kernelfall-v3/` oraz pełny manifest. Obejrzano `previews/01-boss-states.png`, `02-module-states.png`, `03-scale-test.png`, `04-mobile-composition-CONCEPT.png` i pojedyncze PNG bossa/modułu. Koncepty są wyłącznie punktem odniesienia; nie są screenshotami gry ani materiałem do umieszczenia jako plansza.

## Mapa istniejącego renderera

| Element Basic | Miejsce przed integracją | Rola V3 |
|---|---|---|
| obudowa AI | brak dużego bossa, `drawPowerNetwork` pokazuje drobne sylwetki | boss pod colliderami, zależny od archetypu i stanu |
| pancerz | `Block.drawCore`, wieloprzebiegowy Canvas | modules armor/memory/port według archetypu/roli |
| relay | `Block.drawRelay` | modules relay |
| rdzeń | `Block.drawHeartSprite`, stary atlas SVG | centralny cel i obudowa bossa z czytelnym hitboxem |
| firewall node | `Game.drawDefense`, stary SVG | modules firewall ze stanem i markerami |
| drony | `Ball.drawAll`, próg 30 px przełączał na Canvas | drones V3 niezależnie od viewporta |
| emitery | `Turret.draw`, Canvas | uplinks V3, stany wg ładowania/flash |
| hit/relay/override/collapse | `Ring`, `Lance`, `Arc`, `drawBreach` | sekwencje FX powiązane z istniejącymi czasami zdarzeń |
| graf zasilania | `powerEdges`, `offline`, `powerParent` | chain wzdłuż rzeczywistych krawędzi |
| tło | `renderBackground`, cache rozmiaru | arena_floor dodana do cache |
| HUD i upgrade | HTML/CSS i `drawHud` | ui + brand |

## Zalecenia techniczne do odbioru

1. Boss jako duża obudowa dekoracyjna **pod modułami**, skalowana z `coreExtent` i dostępnym viewportem. Nie powiększać hitboxa ani nie zasłaniać uplinków/HUD. Sama pełnoekranowa ilustracja nie oznacza integracji.
2. Stan modułu: broken > isolated (`offline` lub fala przejęcia) > critical (≤35% HP) > damaged (≤70%) > intact. Obiekt broken pozostaje niekolizyjny, jak wcześniej.
3. PNG modułu ma przezroczyste marginesy. Przykład armor: alpha bbox `(30,27,231,235)` przy 256×256, tak samo intact i broken. Skala/crop musi uwzględnić tę różnicę; obrys rzeczywistego collidera musi pozostać czytelny.
4. Bossy zajmują ok. 85–89% szerokości PNG dla alpha>128. Używać tych samych proporcji na telefonie i desktopie, zamiast starego progu jakości.
5. Drony i uplinki mają przód do góry. Stary renderer emitera miał przód w prawo; wyłącznie obrót sprite'a wymaga korekcji +π/2 do dotychczasowego kąta. Fizyka pozostaje bez zmian.
6. Cache rastrowych rozmiarów i lokalna tekstura tła ograniczają koszt bez obniżania jakości. Rysowanie i animacja wizualna nie mogą pobierać `Math.random`.
7. Nie dodawać menu: kontrakt V3 określa zakres jako wygląd istniejącej gry Basic, bez nowych funkcji. W raporcie screenshot ekranu początkowego należy nazwać zgodnie z rzeczywistym UI.
8. Physical iPhone: NOT RUN w tym środowisku; Chromium mobile/DPR nie jest dowodem fizycznego urządzenia.
