# KERNELFALL — ART V6: poprawki i rzeczywista integracja

**Werdykt: READY FOR GPT REVIEW dla wdrożonego zakresu 32 ról. Pełna wymiana oprawy V6 pozostaje BLOCKED dla 58 źródeł.** Nie jest to akceptacja właścicielki ani zgoda na publikację.

## Git i zakres

- Gałąź: `feature/kernelfall-v6-runtime-integration`, utworzona od aktualnego `main`.
- Commit implementacji i dowodów: `c970b62cc288eaff59ff1518dcf21c496f653d8b`.
- `main`: `c32a1371d6e5a58559e90df1865eaefe1926e6e0`, bez zmian.
- Źródła: `b6f717836f49d0d192063f170db1142fd7816372`.
- Zachowany wcześniejszy audyt: `481800ec217ab2b2a575225abce3f0550c8418c7`.
- PR: [#14](https://github.com/klaudiamoscinska-art/neon-crusher/pull/14), draft do odbioru. Bez merge i bez deployu.

## Co działa w rzeczywistej grze

Produkcyjny `SpriteAtlas` wybiera 32 poprawione PNG z `assets/kernelfall-v6-runtime/`. Nie ma adaptera podmieniającego ilustracje w Playwright. Zwykłe otwarcie `index.html` po HTTP uruchamia tę samą integrację. Test paczki uruchomił również faktycznie zbudowany katalog HTML5 z podkatalogu `/nested/game/` i lokalnego iframe.

Naprawiono 3 drony, 25 modułów i 4 stany uplinka. Zachowano 92/92 oryginały V6 bez zmian SHA. **32/92 źródłowe role są wykorzystywane poprzez poprawione warianty; 0 oryginalnych PNG V6 jest rysowanych bez zmian.** To jawne rozróżnienie źródeł i nowych plików. Wszystkie 32 warianty zostały zaobserwowane w wywołaniach produkcyjnego renderera podczas normalnej gry i jawnych fixture stanów. W pierwszych naturalnych 60 s, bez zakupów i ręcznych strzałów, zaobserwowano osobno 12 wariantów.

Dokładne 92 decyzje i 32 ścieżki: [INWENTARZ_PL.md](INWENTARZ_PL.md), [JSON](integration-inventory.json). SHA, pochodzenie i kadrowanie każdego wariantu: [manifest](../../../../assets/kernelfall-v6-runtime/manifest.json). Opis rekonstrukcji i arkusze: [PROVENANCE_PL.md](PROVENANCE_PL.md).

- **Drony:** odtworzono metalowe kadłuby bez nieprzezroczystych dysków. Nos poprawionych sprite’ów +X obraca się zgodnie z wektorem prędkości. Nie zmieniono promienia, szybkości, automatyki ani fizyki drona. Zachowano dotychczasową skalę rysowania. Fallback V3 otrzymuje właściwe przesunięcie kąta dla nosa -Y.
- **Moduły:** kwadratowe obudowy oraz rozpoznawalne funkcje: krzyż, banki pamięci, błyskawica, gniazdo i kłódka. Damaged ma pęknięcia, critical ubytek narożnika i ciemniejszy materiał, isolated czysty cyjan, broken oddzielne odłamki. Delikatny obrys pokazuje dokładną granicę collidera także przy uszkodzeniu. Warianty używają pełnego PNG; crop V3 28..232 stosuje się wyłącznie do V3. Stan wybierany jest z prawdziwego HP, alive, offline i shatter, z dotychczasowymi progami 70% / 35%.
- **Uplinki:** rekonstruowana obudowa i dwie szyny skierowane do pola, magentowy kondensator pusty / częściowy / pełny oraz rozbłysk wylotowy. Selekcja idle/charging/ready/firing nadal wynika z prawdziwego charge i flash. Nie zmieniono OVERRIDE ani autopilota.
- **Ładowanie:** błąd V6 próbuje odpowiednika V3 i zapisuje go w `fallbacks`. Niepowodzenie również V3 zachowuje blokadę ładowania i angielski komunikat błędu. Normalne testy i paczka nie uruchomiły żadnego fallbacku. `sources` pokazuje załadowane ścieżki; `usedSources` dopiero ścieżki faktycznie rysowane.
- **PC i telefon:** identyczne pliki i materiały, bez trybu obniżonej jakości. Zachowano istniejący responsywny świat, HUD, DPR i limit cache 48 MiB. Test zmiany orientacji potwierdza zachowanie tych samych ilustracji.

Zmiany `game.js` dotyczą wyboru/rysowania materiałów, obrysu collidera i przesunięcia kąta rysowanego drona. RNG, fixed step, kolizje, graf, osłony, rozpad AI, save v1, 12 sektorów/Endless i trzy ulepszenia pozostały bez zmian. English jest domyślne także w polskiej przeglądarce; PL tylko po `?lang=pl`. HTML startowy już zawiera EN.

## Materiały pozostawione na V3 i brakujące źródła

**58 plików V6 ma blokadę jakościową**, zamiast wymuszania ich użycia. Dodatkowe 2 pliki brand są kopiami V3 i nie liczą się jako nowa oprawa.

| Rodzina | Liczba | Co blokuje V6 / potrzebny materiał |
|---|---:|---|
| Bossy firewall/memory/neural × 5 stanów | 15 | Miękkie powiększone wycinki, jasne centrum konkurujące z rdzeniem i dekoracyjne elementy podobne do celów. Potrzebne ostre, niezależne rastry trzech archetypów z czytelną krawędzią, wolnym centrum i spójnymi stanami HP/rozpadu. Sama zmiana filtra lub maskowanie nie odtworzy detalu. Zachowano przestrzenne obudowy V3 pod interaktywnymi modułami. |
| Areny | 3 | Dostępne ilustracje przedstawiają perspektywiczne komnaty, centralny pseudo-cel i pseudotekst. Potrzebna neutralna podłoga top-down odpowiadająca arenie gry. Zachowano neutralne tło V3. |
| FX impact/chain/shield_break/core_collapse/override × 8 | 40 | Portal zamiast połączenia, granice wycinka kopuły, ciemna mata i perspektywa. Impact nie daje potwierdzonej przewagi w skali trafienia. Potrzebne samodzielne klatki z czystą alfą: lokalny impact, linia między węzłami, rozpad osłony, impuls emitera i rozpad rdzenia. Zachowano zsynchronizowane z rzeczywistymi zdarzeniami animacje V3. |
| Brand | 2 | Kopie istniejących rastrów; zachowano właściwe źródła V3, bez sztucznego zwiększania licznika. |

Poprzedni audyt źródeł i jego kadry pozostają w `../evidence/`; nie powtarzano adaptera A/B z wadliwymi plikami. Faktyczną rekonstrukcję ilustracji wykonano dla trzech rodzin, dla których uzyskano czytelne warianty, a pozostałe blokady opisano per ścieżka w inwentarzu.

## Wyniki QA

Status PASS dotyczy opisanej asercji, nie odbioru estetycznego. Surowe logi istniejących narzędzi zachowują ich oryginalny język; poniższy raport przedstawia wyniki po polsku.

| Sprawdzenie | Wynik | Dowód |
|---|---|---|
| Pełne `NC_QA_SIM_ONLY=1 NC_CHROMIUM=/usr/bin/chromium node qa/run-all.mjs --base origin/main`, bez `--quick` | **261 PASS / 0 FAIL / 1 NOT RUN** | [log](qa-full.txt), [JSON](qa-summary.json) |
| Fizyka, RNG 60/144/165 Hz, save, ekonomia, graf, osłona, rozpad, lokalizacja | **PASS**, asercje w pełnym przebiegu | j.w. |
| Porównanie symulacji main/V6 | **4/4 IDENTICAL** | [sim-compare](sim-compare.txt) |
| Rekonstrukcja save v1 sektorów 1–12 | **12 PASS / 0 FAIL** | [JSON](reconstruction-results.json) |
| Oryginały V6: 92 PNG, SHA, wymiary i bajty | **PASS** | [audyt](assets-audit.json) |
| Poprawione PNG: SHA, 256×256, brak obiektu na zewnętrznej krawędzi kadru | **32 PASS / 0 FAIL** | [pomiary](repaired-assets-results.json); ocena na tle gry osobno |
| Produkcyjny Canvas, wszystkie 90 ról, 32 V6, wszystkie stany modułów/bossów/uplinków i FX V3; shield, graf, 12→13, fallback, błąd krytyczny PNG, input, HUD i viewporty | **55 PASS / 0 FAIL / 1 NOT RUN / 1 NOT VERIFIED** | [browser-results](browser-results.json) |
| Identyczne sceny V3/V6, sektory 1,3,7,12,13; normalne i damage-fx | **70 PASS / 0 FAIL**, 140 PNG | [JSON](pairs-results.json), [indeks screenshotów](SCREENSHOTY_PL.md) |
| Naturalne pierwsze 60 s, bez zakupów i ręcznych strzałów | **5 PASS / 0 FAIL / 2 NOT RUN** | [JSON](idle/natural-idle-results.json), [WebM](idle/natural-idle-60s.webm) |
| Gotowa paczka HTML5: podkatalog, lokalny iframe, rysowanie V6, obrót dronów i telefonu, parytet materiałów, brak błędów JS/HTTP | **9 PASS / 0 FAIL / 2 NOT RUN** | [JSON](package-browser-results.json) |
| Pierwsze 5 min z zakupami bez celowania: dwa rozmiary, wszystkie archetypy, duże odcięcia grafu | **2 PASS / 0 FAIL** | [wyniki](qa-first-five.txt) |
| Dotychczasowy `kernelfall-browser.mjs` | **10 PASS / 0 FAIL** | [wyniki](qa-kernelfall-browser.txt) |
| Fizyczny iPhone/Safari, rzeczywiste safe areas urządzenia | **NOT RUN** | brak urządzenia |
| Rzeczywisty portal / iframe CrazyGames | **NOT RUN** | sprawdzono lokalny HTTP iframe, bez sesji portalu |
| Lokalny HTTPS | **NOT RUN** | test serwera lokalnego HTTP; paczka ma wyłącznie ścieżki relatywne |
| Odbiór estetyczny właścicielki, całkowita pamięć procesu/GPU i wydajność fizycznego telefonu | **NOT VERIFIED** | nie są zastępowane testem Chromium |

Flaga `NC_QA_SIM_ONLY=1` pomija wyłącznie atrapy rysowania w Node VM, nie kroki symulacji, seedy ani asercje. Rysowanie sprawdzono niezależnie w prawdziwym Chromium. Pierwsze uruchomienie nagrania wykazało brak FFmpeg Playwright; doinstalowano oficjalny pakiet narzędzia i dopiero poprawny pełny przebieg stanowi dowód idle.

Macierz: 1920×1080, 1366×768, 907×510 DPR1; 390×844 DPR2 i DPR3; 375×812 DPR2; 844×390 DPR2. Testy widoczności HUD, braku przewijania, tap/click/Space i układu przy wszystkich wymaganych rozmiarach zaliczone. To emulacja Chromium, nie fizyczny iPhone.

## Screenshoty

Pełny [indeks 70 par](SCREENSHOTY_PL.md) zawiera wszystkie sektory i rozmiary. Przykłady:

- Desktop sektor 7: [BEFORE V3](pairs/1920x1080-dpr1-sector7-normal-before-v3.png) / [AFTER V6](pairs/1920x1080-dpr1-sector7-normal-after-v6.png).
- Telefon 390×844 DPR3 sektor 7: [BEFORE V3](pairs/390x844-dpr3-sector7-normal-before-v3.png) / [AFTER V6](pairs/390x844-dpr3-sector7-normal-after-v6.png).
- Telefon poziomo sektor 12: [AFTER V6](pairs/844x390-dpr2-sector12-normal-after-v6.png).
- Endless i FX na telefonie: [AFTER V6](pairs/390x844-dpr2-sector13-damage-fx-after-v6.png).
- [Izolacja modułów](screenshots/fixture-module-isolated-907x510.png), [AI SHIELD](screenshots/fixture-shield-up-907x510.png), [rozpad osłony](screenshots/fixture-shield-break-907x510.png).

Fixture są jawne: rzeczywiste obiekty i `Game.draw`, zatrzymana symulacja dla powtarzalności. Naturalne idle jest oddzielnym nagraniem. Nie użyto makiet jako dowodu gry.

## Wydajność i paczka

Sektor 13, 60 dronów, identyczny stan, 7 naprzemiennych prób × 30 rozgrzanych klatek z wymuszeniem rasteryzacji. Headless Chromium na współdzielonym CPU, bez innych procesów QA w czasie próby. [Pełne próbki](performance-results.json).

| Widok | V3 mediana | V6 mediana | Zmiana |
|---|---:|---:|---:|
| 1920×1080 DPR1 | 9,597 ms | 10,020 ms | **+4,41%** |
| 390×844 DPR3 | 14,660 ms | 16,023 ms | **+9,30%** |

Oba wyniki mieszczą się w progu +10%, ale V6 kosztuje więcej czasu; mobilny wynik jest blisko progu. To pomiar rasteryzacji statycznej sceny, nie deklaracja FPS fizycznego iPhone’a.

Źródła zdekodowane: **38 928 384 B w obu buildach**. Cache sceny: desktop **2 704 168 B**, mobile **4 428 056 B**, identycznie V3/V6. Tło: desktop **7 019 520 B**, mobile **9 266 400 B**, także identycznie. Test 15 bossów przy 2048 px potwierdził limit cache **48 MiB**. Nie zmierzono całkowitego RSS ani kopii GPU. Repo zachowuje oryginały i dowody, natomiast gra ich wszystkich nie ładuje.

Paczka: **137 plików, 132 PNG (100 V3 + 32 poprawione V6), 10 098 529 B nieskompresowane**, ZIP około **9,92 MB**. `node qa/package-basic.mjs` buduje `qa/out/crazygames-html5/` i `qa/out/kernelfall-art-v6.zip`. [Manifest paczki](package-manifest.json) zawiera dokładne SHA. Nie dodano bibliotek runtime, SVG ani zewnętrznych zapytań.

## Odtworzenie i odbiór

```bash
node tools/build_kernelfall_v6_runtime.mjs
python3 qa/art-v6-assets.py
python3 qa/v6-runtime-assets.py
NC_QA_SIM_ONLY=1 NC_CHROMIUM=/usr/bin/chromium node qa/run-all.mjs --base origin/main
NC_QA_SIM_ONLY=1 node qa/art-v6-reconstruct.mjs
node qa/v6-runtime-browser.mjs
node qa/v6-runtime-pairs.mjs
node qa/v6-runtime-idle.mjs
node qa/v6-runtime-inventory.mjs
node qa/package-basic.mjs
node qa/v6-runtime-package.mjs
node qa/v6-runtime-performance.mjs
```

Narzędzia przeglądarkowe wymagają deweloperskiego Playwright, systemowego Chromium; nagranie wymaga FFmpeg Playwright. Nie są zależnościami gry. Nie uruchamiać równolegle innych QA podczas pomiaru wydajności.

Do decyzji GPT/właścicielki: ocena poprawionych 32 ról na załączonych kadrach, w szczególności identyfikacji uszkodzonych modułów w telefonie, oraz zamówienie brakujących 58 grafik. Zakres 32 ról jest gotowy do przeglądu. Nie ogłaszamy pełnego ukończenia całej oprawy V6. Nie wykonano merge ani publikacji produkcji.
