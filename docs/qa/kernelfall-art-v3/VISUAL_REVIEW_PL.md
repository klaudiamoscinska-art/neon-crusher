# Niezależny przegląd wizualny ART V3

Data: 2026-11-10. Ponowny przegląd po końcowym rerun screenshotów i raportu browser z 17:58 UTC, obejmujący poprawki alfa, stanu firewall, cieni oraz cache i pomijanie przezroczystych marginesów. Obejrzano ponownie finalny desktop 1920×1080 i mobile 390×844 DPR2; zachowana czytelność i szczegółowość. SHA-256 pliku runtime: `59fc166f2d76ed6bc52954fc8c811a8fe05fb22069bb95ba704413e98c544bc6`. Przegląd kodu końcowego renderera i rzeczywistych screenshotów Chromium z `screenshots/`. Ocena dotyczy wyglądu oraz kolejności renderowania; nie zastępuje testów sterowania, pomiaru wydajności ani fizycznego telefonu. Sceny z prefiksem `fixture-` to ustawione stany rzeczywistego silnika, a nie dowód naturalnego przejścia całej kampanii.

## Obejrzane dowody

- `1920x1080-dpr1-start.png`, `1920x1080-dpr1-gameplay.png`.
- `1366x768-dpr1-gameplay.png`.
- `390x844-dpr2-gameplay.png`, `390x844-dpr3-gameplay.png`, `375x812-dpr2-gameplay.png`.
- `844x390-dpr1-gameplay.png`.
- `fixture-memory-intact-907x510.png`, `fixture-neural-graph-cut-907x510.png`.
- `fixture-shield-up-907x510.png`, `fixture-core-shatter-907x510.png`.
- `fixture-uplinks-firing-drones-907x510.png`, `fixture-victory-result-907x510.png`.

| Kryterium | Wynik | Dowód / zakres |
|---|---|---|
| Te same tekstury V3 i szczegółowość desktop/portrait/landscape | PASS | Ta sama szczegółowa obudowa firewall, moduły, uplink, dron i podłoga; brak mobilnego przełączenia na stary styl |
| Obudowa bossa nie zasłania celów | PASS | Moduły rysowane nad obudową, rdzeń ma oznaczone rzeczywiste pole trafienia |
| HUD, podpowiedź i shop nie zasłaniają akcji | PASS | Oddzielne obszary na wszystkich pięciu wymaganych rozdzielczościach |
| Angielskie widoczne etykiety | PASS | Cash, Sector, AI Integrity, Override, upgrade, podpowiedź i rezultat |
| Grubość i kolejność znaczników zasilania | PASS | Finalne obrazy mają cieńsze obrysy, linie pod modułami i jeden duży boss bez dodatkowej miniatury |
| Rozpoznawalność trzech archetypów | PASS | Firewall na ekranach gameplay, memory w fixture-memory-intact, neural w fixture-neural-graph-cut |
| Cyjan oznacza odcięte moduły | PASS | Fixture-neural-graph-cut pokazuje spójną cyjanową gałąź i komunikat NEURAL COLLAPSE |
| Prawdziwy graf kieruje efektami | PASS | Code review: chain odczytuje `powerEdges` i `b.offline`; `updateCollapse`, `powerParent` i mechanika propagacji zachowane |
| Priorytet stanu modułu i firewall node | PASS | Code review: broken > isolated > HP; overlay defense respektuje ten sam stan, nie maskuje cyjanu PNG intact |
| Izolacja stanu alfa i cienie | PASS | Code review: reset `globalAlpha` dla każdego modułu/rdzenia, save/restore wokół sprite'ów; zachowane batched cienie dronów, cień uplinka i feedback `Ball.flash` |
| Stan bossa i jego skala | PASS | Code review: HP 70/35%, shatter/captured zależne od `breach.t`; skala ograniczona oboma wymiarami areny, dekoracja bez nowego collidera |
| Pomijanie przezroczystych marginesów zachowuje piksele i pivot | PASS | `browser-results.json`: scout drone i neural boss, każdy przy DPR1/2/3, sześć przypadków; `maxDiff=0`, `differingChannels=0` względem pełnego blitu tego samego rastra |
| Budżet raster cache | PASS | `browser-results.json`: stress 15 boss rastrów 2048 px; FIFO pozostawia 3 wpisy, 12 582 912 pikseli = 48 MiB RGBA. Limit dotyczy cache, nie całkowitej pamięci gry |
| Sterowanie i wydajność | NOT VERIFIED | Ten przegląd obrazu ich nie mierzy; wyniki osobnego testu w zbiorczym raporcie QA |
| Fizyczny iPhone | NOT RUN | Brak fizycznego urządzenia; viewport/DPR Chromium to emulacja |

## Zgodność z konceptem i jej granice

Runtime używa dostarczonych szczegółowych ilustracji i zachowuje wspólny język V3 na telefonie i desktopie. Koncept pokazuje prawie niezasłoniętego bossa; rzeczywista gra zachowuje interaktywne moduły i kolizje Basic. Na pierwszym sektorze osiem dużych modułów przykrywa środek ilustracji, dlatego bossa odczytuje się w dużej mierze przez obręcz, skrzydła i zewnętrzną obudowę. W późniejszych układach ring/grid zmienia się widoczność centralnych szczegółów. **Nie jest to identyczna kompozycja jak mockup.** Zachowanie modułów i rzeczywistej geometrii jest zgodne z kontraktem integracji; ostateczna ocena zgodności artystycznej należy do GPT i właścicielki.

Portrait pokazuje obudowę szerokości ok. 290 px przy 390 px viewporta (koncept ok. 340 px). Obecny rozmiar utrzymuje odstęp od uplinka i nie zabiera czytelności celom. W krajobrazie boss jest mniejszy z powodu ograniczenia wysokością areny, ale używa tych samych materiałów i cieniowania. Moduły, drony i uplinki mają dokładnie styl dostarczonych PNG, który jest prostszy niż szczegółowe ilustracje bossów; renderer nie dorabia zamiennej stylistyki.

Istniejące cząstki Basic pozostają nad sprite'ami podczas rzeczywistej akcji; fixture oczyszczono z pozostałości wcześniejszych zdarzeń, aby czytelnie dokumentować stan. Nie stwierdzono trwałego zasłonięcia celów na obejrzanych obrazach. Sekwencja shatter/captured może zakończyć się wraz z naturalnym przejściem do następnego sektora; mechanika nie jest opóźniana na potrzeby grafiki.

Menu nie istniało w Basic. Obrazy `*-start.png` dokumentują rzeczywisty ekran początkowy gry; zgodnie z kontraktem V3 nie dodano nowej funkcji menu.
