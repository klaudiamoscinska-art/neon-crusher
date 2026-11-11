# KERNELFALL ART V6 — odbiór przed integracją

Werdykt: **BLOCKED**. Zatrzymano integrację po potwierdzeniu utraty czytelności
w rzeczywistym Canvas. Zachowano V3 z PR #12. Nie zmieniono `game.js`,
`index.html` ani `style.css`. Ten PR udostępnia źródła V6, narzędzia QA i dowody,
nie nową wersję oprawy runtime. Odbiór estetyczny właścicielki: **NOT VERIFIED**.

## Baza i procedura

- Repo: `klaudiamoscinska-art/neon-crusher`.
- `origin/main`: `c32a1371d6e5a58559e90df1865eaefe1926e6e0` — merge PR #12.
- Źródło: `feature/kernelfall-art-v6-raster` @
  `b6f717836f49d0d192063f170db1142fd7816372`.
- Gałąź odbioru: `feature/kernelfall-v6-runtime-review`.
- Przeczytano README_PL i manifest V6, GAME_DESIGN, KERNELFALL_BASIC,
  renderer atlasu oraz zasady QA. Skills: cloud-environment-runtime,
  nc-visual-fx, nc-performance, nc-qa.

Porównanie wykonano **przed jakąkolwiek zmianą runtime**. Playwright uruchamia
prawdziwy `Game.draw`; wyłącznie w pamięci strony podstawia obrazy V6 do
istniejących slotów atlasu. Seed generacji = 1107, czas = 4 s, sektor = 7
w podstawowej macierzy. Pozostałe fixture mają jawne sektory i działania.
JSON zawiera oba stany i ich SHA-256. To zatrzymane, kontrolowane sceny,
nie naturalna rozgrywka ani makiety marketingowe. DOM, graf, HP i collidery
pozostają rzeczywiste. UI ikony pozostają V3.

Crop V3 `(28,28,204,204)` nie pasuje do V6. Główne porównanie używa
prostokąta alfy >32 dopasowanego do istniejącego kwadratu modułu; osobna
para pokazuje oryginalny crop. Ten adapter QA nie naprawia niespójnej
sylwetki z colliderem i nie jest proponowaną zmianą produkcyjną.

## Ocena w grze

V6 daje bardziej malarskie powierzchnie i przestrzenne obudowy, różnicuje
trzy bossy oraz atmosferę aren. Te zalety są widoczne w kadrach. Nie
rekompensują poniższych problemów:

- **Moduły:** miękkie detale i nieregularne/okrągłe sylwetki nie pokazują
  kwadratowych obrysów kolizji tak jasno jak V3. Relay ma jasny gwiaździsty glif;
  firewall jest jaskrawą kulą. Hierarchia ról i celów jest słabsza.
- **Bossy:** jasne, miękkie obwódki przy krawędziach i miękkie powiększone
  detale. Duża obudowa nadal rysuje się pod interaktywnymi modułami, ale
  jasny środek konkuruje z rzeczywistym sercem. Większy DPR nie odzyskuje
  szczegółów utraconych w źródle.
- **Drony:** wszystkie trzy źródła zawierają nieprzezroczyste kolorowe dyski
  po tle. To widoczne piksele RGB z alfa 255, nie kwestia przezroczystości
  przeglądarki.
- **Uplinki:** cztery warianty kuli nie zachowują kierunkowej sylwetki emitera
  i jasnej informacji o ładowaniu/strzale obecnej w V3.
- **Tła:** perspektywiczny korytarz, świecący znak w centrum i pseudotekst
  konkurują z planszą top-down. Nie są czystą, neutralną podłogą.
- **FX:** wycinki eksplozji/kopuły mają własną perspektywę i resztki maty;
  klatki nie wykazują przewagi nad czytelnymi sygnałami V3.

Cyjanowe ramki `isolated` pozostają czytelne w fixture odcięcia. To zaleta
konkretnego stanu, ale nie rozwiązuje słabszej identyfikacji ról i HP całej
rodziny modułów. Trzy drony są bardziej przestrzenne, lecz ich dyski tła
pozostają wadą źródła nawet przy małym rozmiarze w grze.

Nie retuszowano plików wejściowych ani nie przypisano im finalnej jakości.
Wszystkie oryginalne 92 pliki zachowano do odbioru.

## Znaczenie stanów

Nie dodano pięciu nowych stanów mechaniki. Odtworzono aktualną selekcję V3:

| Rodzina | Rzeczywista reguła |
|---|---|
| Moduły | martwy → broken; offline lub oczekujący shatter → isolated; żywy HP >70% → intact; >35% → damaged; pozostałe → critical |
| Boss | stan zależy od HP rzeczywistego serca: >70% intact, >35% damaged, pozostałe critical; po śmierci shatter przez pierwsze 0,35 s, potem captured przy zanikaniu dekoracji |
| Uplink | flash >0 → firing; charge ≥1 → ready; charge >0,15 → charging; pozostałe idle |

`captured` jest istniejącą nazwą pliku zaniku po śmierci, nie przejęciem
żywego AI. `isolated` oznacza odcięcie grafu lub nadchodzący rozpad, a nie
arbitralny poziom HP. Czytelność tych różnic na źródłach V6 wymaga korekty.

## Faktyczne użycie i poprawki źródeł

**Runtime: 0/92 plików V6 rysowanych; 92/92 nieużyte.** Zostało pełne V3.
Lista każdego pliku, decyzji i użycia w fixture jest w
`evidence/integration-decisions.json`. Użycie przez adapter QA nie jest
wdrożeniem do gry. Dwa pliki brand V6 są kopiami istniejących rasterów,
więc nie dają poprawy wizualnej.

Do ponownego wykonania/oczyszczenia: 3 drony (wycięcie dysków tła),
25 modułów (role, stany, dopasowanie do colliderów), 4 uplinki (kierunek
emitera i jednoznaczne stany), 3 areny (neutralna podłoga top-down),
32 FX z rodzin chain/shield_break/core_collapse/override (czysta alfa
i geometria efektu). Rodzina 15 bossów wymaga ostrzejszych źródeł,
spokojniejszego środka i ponownej oceny krawędzi; nie potwierdzono
indywidualnego błędu alfy każdego z 15 plików. Osiem klatek impact nie
wykazało przewagi w grze, ale nie wszystkie wymagają przerysowania.
Dokładne ścieżki i uwagi źródłowe zawiera także `SOURCE_AUDIT_PL.md`.

## Testy i materiały

Pełny przebieg `NC_QA_SIM_ONLY=1 NC_CHROMIUM=/usr/bin/chromium node qa/run-all.mjs`:
**260 PASS, 0 FAIL, 0 KNOWN, 2 NOT RUN**, exit 0, bez `--quick`.
Flaga pomija wyłącznie atrapy rysowania Node VM; wszystkie fixed updates,
liczby seedów i asercje wykonano, browser smoke rysuje w Chromium.
NOT RUN to brak argumentu `--base` w tym przebiegu i fizyczne safe areas.
Osobny `node qa/integrity.mjs --base origin/main --no-runtime-change`:
**13/13 PASS**, uzupełnia brak pierwszego sprawdzenia. Dowody:
[pełny QA](evidence/qa-full.txt), [podsumowanie](evidence/qa-summary.json),
[audyt logiki](evidence/AUDIT_LOGIC_PL.md).
Pierwotny `node qa/run-all.mjs` bez przyspieszenia także zakończył się exit 0:
240 PASS, 0 FAIL, 2 NOT RUN. Domyślny bundled Chromium nie był zainstalowany;
systemowy Chromium został faktycznie przetestowany w poprawionym pełnym
przebiegu i osobnym smoke. Pierwotny proces zaimportował stary test PL,
więc dowodem jawnego PL są dopiero poprawione testy.

| Zestaw | PASS | FAIL |
|---|---:|---:|
| physics / refresh rate i pełne 48 seedów | 20 | 0 |
| levels / geometria i resize | 25 | 0 |
| economy / trzy upgrade i autopilot | 30 | 0 |
| save v1 | 24 | 0 |
| i18n | 18 | 0 |
| collapse / graf / RNG | 64 | 0 |
| recovery / shield i exposure | 17 | 0 |
| browser-smoke | 20 | 0 |

Pozostałe PASS: integrity 12, instructions 12, runner 18. Osobna rekonstrukcja
save sektorów 1–12: **12/12 PASS**; porównanie symulacji z main:
**4/4 IDENTICAL** przy 60/144 Hz. Poprawiono wyłącznie test HUD w
`qa/recovery.mjs`: jawne EN/PL i kontrola faktycznie wybranego języka;
osobny pełny recovery po poprawce: **17/17 PASS**, 192 układy HUD.

Integralność V6: **92/92 PASS, 0 SVG** —
[pomiary źródeł](evidence/assets-audit.json).
Definicja manifestowego `alpha_coverage`: **NOT VERIFIED**; obserwacyjnie
odpowiada alfa ≥13, a raport mierzy także alfa >0. To nie certyfikat czystej alfy.

### Rzeczywiste kadry A/B

[browser-ab.json](evidence/browser-ab.json): **41/41 par identycznego stanu,
50 PASS, 0 FAIL**, zero błędów/missing resources. Semantyczne asercje
sprawdzają realne shield, exposure, offline potomków, ręczny OVERRIDE
i wynik sektora 12 → 13. Poniższe wymiary to viewport całego okna gry,
z rzeczywistym Canvas i DOM UI, nie przycięty sam Canvas.

Wstępny harness QA ujawnił własne błędy: niezainicjalizowany wariant przy
startup draw oraz nierestartowany licznik reroutes powodowały błędy strony
i nierówne fixture shield. Poprawiono inicjalizację i izolację sesji,
po czym powtórzono **całe** A/B; powyżej jest zakończony poprawiony wynik.
Nie były to nowe błędy runtime gry.

| Viewport / DPR / sektor 7 | V3 | V6, tylko fixture |
|---|---|---|
| 1920×1080 / 1 | [kadr](evidence/screenshots/1920x1080-dpr1-sector7-v3.png) | [kadr](evidence/screenshots/1920x1080-dpr1-sector7-v6.png) |
| 1366×768 / 1 | [kadr](evidence/screenshots/1366x768-dpr1-sector7-v3.png) | [kadr](evidence/screenshots/1366x768-dpr1-sector7-v6.png) |
| 907×510 / 1 | [kadr](evidence/screenshots/907x510-dpr1-sector7-v3.png) | [kadr](evidence/screenshots/907x510-dpr1-sector7-v6.png) |
| 390×844 / 2 | [kadr](evidence/screenshots/390x844-dpr2-sector7-v3.png) | [kadr](evidence/screenshots/390x844-dpr2-sector7-v6.png) |
| 390×844 / 3 | [kadr](evidence/screenshots/390x844-dpr3-sector7-v3.png) | [kadr](evidence/screenshots/390x844-dpr3-sector7-v6.png) |
| 375×812 / 2 | [kadr](evidence/screenshots/375x812-dpr2-sector7-v3.png) | [kadr](evidence/screenshots/375x812-dpr2-sector7-v6.png) |
| 844×390 / 2 | [kadr](evidence/screenshots/844x390-dpr2-sector7-v3.png) | [kadr](evidence/screenshots/844x390-dpr2-sector7-v6.png) |

Główna macierz używa istniejącego kwadratowego slotu floor V3, który
rozciąga prostokątne tło V6. Nie oparto odrzucenia wyłącznie na tym błędzie:
[cztery dodatkowe pary](evidence/background-cover.json) zachowują proporcje
źródła przez center cover i nadal pokazują konkurencję tła z planszą.
Przykład: [V3](evidence/screenshots/aspect-cover-907x510-dpr1-sector7-v3.png),
[V6](evidence/screenshots/aspect-cover-907x510-dpr1-sector7-v6.png).

Odrębne realne fixture (każde ma parę V3 w tym samym folderze):
[OVERRIDE](evidence/screenshots/active-override-v6.png),
[AI SHIELD](evidence/screenshots/shield-up-v6.png),
[przerwanie osłony](evidence/screenshots/shield-break-v6.png),
[odcięcie firewall](evidence/screenshots/firewall-graph-cut-v6.png),
[odcięcie memory](evidence/screenshots/memory-graph-cut-v6.png),
[odcięcie neural](evidence/screenshots/neural-graph-cut-v6.png),
[finał 12](evidence/screenshots/sector12-finale-v6.png),
[endless 13](evidence/screenshots/sector13-endless-v6.png).
W folderze są wszystkie pięć stanów bossów i modułów, cztery uplinków,
trzy drony oraz 40 klatek FX przez rzeczywisty `SpriteAtlas.fx`;
specimen FX jest wyraźnie opisany jako fixture, nie rozgrywka.
Indeks [screenshots-index.json](evidence/screenshots-index.json) ma SHA-256,
wymiary i klasyfikację **99 PNG: 94 fixture oraz 5 naturalnego idle**.
Źródłowy CONTACT_SHEET_REAL_PNG nie jest liczony jako screenshot gry.

### Naturalne pierwsze 60 s

[JSON](evidence/idle/natural-idle-results.json),
[00 s](evidence/idle/natural-idle-00s-907x510.png),
[15 s](evidence/idle/natural-idle-15s-907x510.png),
[30 s](evidence/idle/natural-idle-30s-907x510.png),
[45 s](evidence/idle/natural-idle-45s-907x510.png),
[60 s](evidence/idle/natural-idle-60s-907x510.png),
[nagranie](evidence/idle/natural-idle-60s.webm).
To zachowany V3, realny `Game.loop`, bez wymuszania HP, sektorów, zakupów
i wejścia gracza; jedynie seed RNG jest stały dla odtwarzalności.
W 60,025 s symulacji: sektor 1, $32, 4 automatyczne OVERRIDE, 0 ręcznych,
bez zakupów. EN mimo locale pl-PL. **5 PASS, 0 FAIL**.
WebM obejmuje także start: 66,64 s czasu ściennego, VP8, 25 fps,
906×510 (enkoder zaokrąglił szerokość); PNG mają dokładnie 907×510.

### Skala, pamięć i wydajność

Obie paczki mają źródła bossów 512 px. W sektorze 7: 1920×1080 DPR1
rysuje bok 786,04 device px (1,535× źródła); 390×844 DPR2 — 670,8 px
(1,310×), DPR3 — 1006,2 px (1,965×). Dodatkowy neural na desktop DPR3
ma bok 2358,12 px (4,606×; cache rastera ograniczony do 2048).
To wymiar rysowania, nie zmierzona rozdzielczość szczegółów źródła.
Kadry pokazują miękkie krawędzie V6 przy tych samych skalach co V3.
Moduły mają w macierzy 19,584–65,808 CSS px; na telefonie 390 szerokości
28,08 CSS px, czyli 84,24 device px przy DPR3. Stany muszą działać w tym
rozmiarze, nie tylko na planszy źródeł.

Wszystkie 92 PNG V6 zajmują 10 746 471 B na dysku i 44,80 MiB surowego
RGBA. Adapter trzymający pełne V6 + 2 ikony V3 wymaga dla unikalnych
źródeł **45 793 280 B vs 38 928 384 B (+17,64%)**. To przekracza próg 10%
dla pełnej wymiany: dodatkowe dwa duże tła i ich wymiary zwiększają koszt,
a korzyść wizualna nie uzasadnia go. Nie dopuszczono tej wymiany.
Cache w fixture cover jest równy dla obu wariantów: 376 024 B przy 907×510
oraz 4 347 624 B przy 390×844 DPR3. Są to bufory referencjonowanych źródeł
i canvasów, **nie** pamięć procesu, dekodera ani GPU.

[Pomiar renderowania A/A](evidence/performance-control.json) porównuje
main z pozostawionym V3: ta sama maszyna, identyczne SHA runtime i scen,
sektor 13, 60 dronów, 7 naprzemiennych próbek po 30 wymuszonych rasteryzacji.
Mediana 1920×1080 DPR1: **9,970 → 9,770 ms (−2,01%)**;
390×844 DPR3: **13,177 → 13,237 ms (+0,46%)**. Brak regresji >10%.
To headless Chromium/software raster, nie FPS ani wynik fizycznego telefonu.
Bufory źródeł: 38 928 384 B; cache desktop 2 704 168 B, mobile 4 428 056 B,
identyczne w obu wersjach. Cache ma istniejący limit 48 MiB. Osobny canvas
tła: 7 019 520 / 9 266 400 B. Wstępne równoległe QA zostało wstrzymane na
czas tego pomiaru i potem wznowione; pomiar wykonano bez nakładających się
testów. Produkcyjne V6: **NOT RUN**, ponieważ nie dopuszczono integracji.

Fizyczny iPhone, Chromebook 4 GB, portal CrazyGames i iframe z prawdziwego
portalu: **NOT RUN** — brak dostępu do urządzeń/sesji portalu. Emulacja
Chromium i lokalny iframe są osobnymi dowodami, nie zastępują tych testów.

## Bezpieczna kontynuacja

Najpierw poprawić źródła i powtórzyć ten sam A/B. Nie zmieniać balansu,
save v1, RNG, fizyki, grafu, autonomii dronów, autopilota, 12 sektorów/endless
ani trzech ulepszeń. EN pozostaje domyślny; PL wybierane jawnie.
Nie dodano zależności runtime ani ilustracji SVG V6.
**Bez merge i deployu produkcji bez zgody właścicielki.**
