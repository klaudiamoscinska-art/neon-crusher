# Audyt logiki i QA — V6

Runtime objęty pomiarem: SHA-256 `59fc166f2d76ed6bc52954fc8c811a8fe05fb22069bb95ba704413e98c544bc6`.
Baza `main`: `c32a1371d6e5a58559e90df1865eaefe1926e6e0`. Audyt i zmiany dotyczą testów; nie zmieniono runtime.

Pełny przebieg `NC_QA_SIM_ONLY=1 NC_CHROMIUM=/usr/bin/chromium node qa/run-all.mjs`: exit 0, **260 PASS, 0 FAIL, 0 KNOWN, 2 NOT RUN**. Bez `--quick`, pełne liczby seedów. Flaga pomija rysowanie do atrapy Canvas w Node VM; nie pomija fixed updates ani asercji. Browser smoke używa rzeczywistego Chromium. Test RNG w collapse jawnie porównuje rysowanie włączone i wyłączone. Dowody: [qa-summary.json](qa-summary.json), [qa-summary.txt](qa-summary.txt).

| Zestaw | PASS | FAIL | NOT RUN |
|---|---:|---:|---:|
| integrity | 12 | 0 | 1 |
| instructions | 12 | 0 | 0 |
| runner | 18 | 0 | 0 |
| physics | 20 | 0 | 0 |
| levels | 25 | 0 | 0 |
| economy | 30 | 0 | 0 |
| save | 24 | 0 | 0 |
| i18n | 18 | 0 | 0 |
| collapse | 64 | 0 | 0 |
| recovery | 17 | 0 | 0 |
| browser-smoke | 20 | 0 | 1 |

NOT RUN w głównym przebiegu: porównanie runtime z bazą bez argumentu `--base`; bezpieczne obszary na fizycznym telefonie z notchem / w aplikacji CrazyGames. Osobne porównanie z bazą: [sim-compare.txt](sim-compare.txt), 4/4 scenariusze IDENTICAL (stan, HP, cash, pozycje dronów, OVERRIDE, shatter; 150 s, 60/144 Hz). Fizyczny iPhone, rzeczywisty portal i iframe CrazyGames nie były wykonane; emulacja Chromium ich nie zastępuje.

Osobny odczyt starych zapisów v1 dla sektorów 1–12: **12/12 PASS**. Kontroluje pięć pól, 1 rdzeń, rzeczywiste HP, cykl trzech archetypów, liczność siatek, pełne drzewo zasilania i round-trip bez nowych pól. Kod: `qa/art-v6-reconstruct.mjs`; wynik: [reconstruction-results.json](reconstruction-results.json). To dowód symulacji, nie wyglądu.

Naprawiona luka dotychczasowego QA: `qa/recovery.mjs` wybierał PL przez navigator, ignorowany po integracji V3. Test używa teraz jawnych `?lang=en` i `?lang=pl` oraz kontroluje wybrany język. Ponowny pełny recovery: **17/17 PASS**, w tym 192 układy HUD w EN/PL dla shield/exposure; [recovery-explicit-pl.txt](recovery-explicit-pl.txt).

Niezmienniki ze specyfikacji i kodu: fixed step 1/240 s; save `neonCrusher.save.v1` z pięcioma polami; dokładnie trzy ulepszenia New drone / Override charge / Breach power; autonomiczne drony i autopilot po 5 s; osłona od sektora 3, czas 7 s, rdzeń ×0,5; ekspozycja 5 s, OVERRIDE/shockwave ×2,5; erozja tylko po krawędziach grafu, jedno trafienie co 0,45 s, bez zabicia rdzenia i bez dochodu; kampania 12 sektorów i endless od level 13. Wyliczone wartości pozostają sprawdzane przez testy, nie tylko przez przegląd kodu.

Renderer V3 rysuje dekoracyjną obudowę pod grafem, modułami i krawędzią collidera rdzenia. Stan obudowy pochodzi z rzeczywistego HP rdzenia (progi 70% i 35%), a pasek AI INTEGRITY z HP całego układu. Moduły: broken dla martwych, isolated dla odciętych lub oczekujących shatter, potem intact/damaged/critical według własnego HP. To znaczenia, które nowe ilustracje muszą zachować.

`run-all` nie mierzy ostrości PNG, fringing, pamięci atlasu, czasu rasteryzacji, wszystkich klatek FX ani naturalnego idle przez 60 s. Te dowody należą do osobnych testów browser A/B, idle i performance; sam wynik powyżej nie nadaje akceptacji estetycznej. `docs/GAME_DESIGN.md` zawiera historyczne opisy rendererów proceduralnych i języka z navigator; dla aktualnej oprawy punktem odniesienia jest kod V3 i dokumentacja integracji V3.

Pierwotny dodatkowy `node qa/run-all.mjs` bez flagi przyspieszenia także zakończony: exit 0, **240 PASS, 0 FAIL, 0 KNOWN, 2 NOT RUN**. Browser smoke w tym przebiegu był NOT RUN, ponieważ domyślny Chromium Playwright nie istnieje; główny przebieg użył `/usr/bin/chromium` i wykonał 20 kontroli browser smoke. Pierwszy przebieg zaimportował recovery przed poprawką PL, więc nie jest dowodem PL. Został tymczasowo wstrzymany SIGSTOP wyłącznie na odizolowany benchmark renderowania, potem wznowiony SIGCONT i ukończony. Dowody: [qa-initial-summary.json](qa-initial-summary.json), [qa-initial-summary.txt](qa-initial-summary.txt). Pełny log roboczy: `/tmp/kernelfall-main-qa.log`. Głównym dowodem pozostaje poprawiony pełny przebieg opisany wyżej.
