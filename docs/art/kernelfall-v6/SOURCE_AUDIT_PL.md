# Audyt źródeł V6 — 2026-11-10

Ten dokument ocenia oryginalne piksele i zgodność paczki. Nie jest raportem
ze screenshotów gry ani akceptacją estetyczną runtime. Wszystkie 92 oryginały
pozostawiono bez zmian. Reprodukcja: `python3 qa/art-v6-assets.py` (Pillow,
zależność wyłącznie QA). Pełne ścieżki i pomiary: `evidence/assets-audit.json`.

## Integralność

- **PASS**: 92 wpisy manifestu = 92 PNG, sygnatura i dekoder PNG, SHA-256,
  wymiary, rozmiary plików, alpha min/max; zero SVG. Zero identycznych obrazów
  po dekodowaniu RGBA.
- Rozmiar na dysku: **10 746 471 B**. Surowe RGBA wszystkich 92:
  **46 979 584 B = 44,80 MiB**. Bez dwóch kopii brand:
  **45 662 208 B = 43,55 MiB**. To dolne oszacowanie buforów zdekodowanych
  źródeł, nie pomiar pamięci procesu/GPU ani cache atlasu.
- Definicja `alpha_coverage`: **NOT VERIFIED**, manifest nie podaje progu.
  Obserwacyjnie wszystkie 92 wartości zgadzają się z udziałem `alpha >= 13`
  po zaokrągleniu do 3 miejsc. JSON osobno zapisuje `alpha > 0` i `alpha >= 13`.
- Półprzezroczyste piksele/bounding box same nie dowodzą czystej alfy.
  Fringing i czytelność muszą zostać ocenione na prawdziwym tle gry.

## Problemy widoczne w źródłach / zalecenia do ponownego wykonania

| Pliki (każdy pasujący do wzorca) | Obserwacja | Zalecenie |
|---|---|---|
| `drones/{scout,assault,support}_256.png` (3) | Wokół statku zachowano duży kołowy nieprzezroczysty fragment planszy: szaroniebieski, czerwony albo fioletowy. To pole obrazu, nie tylko pikselowy fringe. Scout `(210,185)` = `(71,72,89,255)`, assault `(70,200)` = `(96,44,64,255)`, support `(50,180)` = `(95,43,93,255)`. | Ponownie wyciąć sam kadłub i napęd; sprawdzić obrót i ślad autonomicznego drona na tle Canvas. |
| `modules/{armor,memory,relay,port,firewall}_{intact,damaged,critical,isolated,broken}_256.png` (25) | Intact/damaged/critical zachowują niemal ten sam materiał; cienkie doklejone rysy zmieniają tylko 1,09–1,57% pikseli dla damaged i 3,88–5,81% dla critical. Izolacja barwi korpus na cyjan, pozostawia nieregularne czerwone/czarne plamy. Różne obrysy nie odpowiadają automatycznie wspólnemu colliderowi. | Zaprojektować sylwetki pod wielkość modułu i jednoznaczne stany HP/zasilania. Nie kopiować kadrowania V3. |
| `uplinks/{idle,charging,ready,firing}_256.png` (4) | Te same okrągłe cyjanowe fragmenty izolowanego węzła z czerwonymi pozostałościami; małe dodane obręcze/linie rozróżniają stany. Brakuje kierunkowego emitera. | Narysować nadajnik skierowany do pola, czytelny poziom ładowania i strzał, zachowując sens istniejącego OVERRIDE. |
| `bosses/{firewall,memory,neural}_{intact,damaged,critical,shatter,captured}_512.png` (15) | Sylwetki archetypów są bogatsze, lecz w 512 px widać miękki powiększony materiał; stan memory jest cyjanowy już przy intact, a captured zmienia obiekt na kryształ/sześcian/mózg. HP może pozostać nieczytelne; dekoracyjne obudowy przypominają moduły interaktywne. | Wymagana decyzja na podstawie identycznych scen/DPR. Jeśli potwierdzi się miękkość lub utrata celu: nowe źródła o większej rzeczywistej rozdzielczości, spójna semantyka pięciu stanów i wolne centrum rdzenia. |
| `environment/arena_{firewall,memory,neural}_1280x720.png` (3) | Tła są perspektywicznymi komnatami z centralnym trójkątem/sześcianem/mózgiem i platformą; zawierają gotowy cel dekoracyjny. Nie są neutralną podłogą top-down. Przy 1920 px szerokości źródło powiększa się co najmniej 1,5× przed DPR. | Odtworzyć top-down bez centralnego pseudo-celu i drobnych pseudo-napisów. Sprawdzić kolizję wizualną ze ścianami pola oraz mobile crop. |
| `fx/impact/frame_{00..07}_256.png` (8) | Jasny pomarańczowy wybuch, perspektywiczny materiał. | Ocenić rozmiar i zakrywanie celu w realnym trafieniu; brak wykazanej przewagi na podstawie samego pliku. |
| `fx/chain/frame_{00..07}_256.png` (8) | Materiał przedstawia pionową kolumnę/portal na podstawie, a nie linię między węzłami. | Przygotować efekt zgodny z geometrią istniejącego połączenia. |
| `fx/shield_break/frame_{00..07}_256.png` (8) | Fragment kopuły ma twardo uciętą prawą/dolną krawędź obiektu wewnątrz przezroczystego marginesu obrazu. | Nowe samodzielne klatki rozpadu osłony, bez prostych granic wycinka ilustracji. |
| `fx/core_collapse/frame_{00..07}_256.png` (8) | W wybuchu pozostaje duży ciemnoczerwony fragment tła/materiału i asymetryczny obrys wycinka. | Oczyścić matę i przygotować samodzielny rozpad rdzenia. |
| `fx/override/frame_{00..07}_256.png` (8) | Fragment kopuły i pierścienia z dużą ciemną powierzchnią pomiędzy nimi, ucięte brzegi. | Odtworzyć impuls zgodny z linią strzału i zachować widoczność celu. |
| `brand/{wordmark-480,symbol-512}.png` (2) | Istniejące rastry V3 skopiowane dla zgodności; nie stanowią nowej oprawy. | Zachować istniejące źródło brand; brak podstaw do deklarowania poprawy V6. |

Wzorce tabeli obejmują wszystkie 92 ścieżki. Nie są listą assetów faktycznie
rysowanych: to osobny dowód z instrumentowanego browser runtime.

## Kadrowanie modułów

Obecny renderer V3 wycina `(28,28)-(232,232)` i rozciąga ten obszar na
kwadrat kolizji. Przy bezpośrednim podmienieniu na V6 ten wycinek usunąłby
odpowiednio **11,39% / 6,71% / 5,95% / 7,32% / 4,88%** widocznych pikseli
intact armor / memory / relay / port / firewall. To pomiar źródeł, nie
procent błędnej kolizji. Osobne bounds nie naprawiają znaczenia bryły ani HP.

Mapowanie obecnego renderera: module intact `HP > 70%`, damaged
`35% < HP <= 70%`, critical `HP <= 35%`, isolated dla odcięcia/shatter,
broken po zniszczeniu. Boss używa tych samych progów HP serca, shatter
w pierwszych 0,35 s po śmierci, captured później podczas zanikania. Captured
nie może oznaczać uzdrowionego żywego przeciwnika; kampania niszczy AI.

Zalecenie źródłowe: zachować V3 do wyniku porównania Canvas. Najbardziej
jednoznaczne prace naprawcze dotyczą 3 dronów, 4 uplinków, 3 teł oraz
rodzin FX chain/shield_break/core_collapse/override. Ocena 15 bossów,
25 modułów i impact wymaga dowodu w rozmiarze gry, a nie deklaracji jakości
na podstawie contact sheet.
