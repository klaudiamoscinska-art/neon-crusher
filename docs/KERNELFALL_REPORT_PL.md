# KERNELFALL — zbiorczy raport wykonania

## Stan odbioru

Implementacja lokalna jest gotowa do przeglądu. Utworzenie PR blokuje GitHub:
`git push -u origin feature/kernelfall-basic-final` zwraca HTTP 403, a próba
utworzenia tej samej gałęzi konektorem GitHub zwraca `Resource not accessible
by integration`. Nie utworzono PR ani zdalnej gałęzi. To ograniczenie uprawnień,
nie brak zgody na PR. Właścicielka została poproszona o dostęp integracji.

Repo: `klaudiamoscinska-art/neon-crusher`; baza `origin/main`:
`c8542741296489324b7d235b682c7e5de78a9a42` (PR #10 MERGED).
Gałąź: `feature/kernelfall-basic-final`. Nie zmieniono produkcyjnego main,
nie wykonano merge, deploymentu, uploadu do portalu ani zmian Pages.

## Zakres i zachowane kontrakty

- IMPLEMENTED: KERNELFALL w tytule, logo i ikonie, nowy styl HUD/shop;
  `AI INTEGRITY`, `POWER DESTROYED`, `SECTOR NEUTRALIZED` i odpowiedniki PL.
- IMPLEMENTED: osobny graf zasilania i NEURAL COLLAPSE. Kaskada zależy od
  krawędzi dostaw, nie od odległości od eksplozji przekaźnika. Ograniczona
  erozja nie niszczy rdzenia ani nie wywołuje darmowych relay chain/recharge.
  Aktywna osłona zachowuje swój wcześniejszy jednorazowy bonus po przerwaniu.
- IMPLEMENTED: trzy archetypy topologii/sylwetki, cel 12 sektorów, pasek
  postępu, AI CORE DESTROYED / AI NEUTRALIZED, dalszy endless bez ekranu blokady.
- Zachowane: pięć pól i klucz `neonCrusher.save.v1`, preferencja audio,
  odtwarzanie starych zapisów, ceny, bazowa fizyka 1/240 s, automat, EN/PL,
  klawiatura, mysz, dotyk, reduced motion, lokalne ścieżki i brak SDK/reklam.
- Przy wyłączonym collapse cztery scenariusze są identyczne z main:
  sektor/kasa odpowiednio 5/59, 5/20, 10/1657, 13/7224. Takie same kroki,
  trajektorie, salwy i liczba rdzeni. Log: `qa/out/evidence/sim-compare.txt`.

Szczegóły reguł, źródeł grafik i procedura CG: `docs/KERNELFALL_BASIC.md`.
Logo i SVG pochodzą z dostarczonej paczki. Makiet nie ma w runtime.
Zachowano zaakceptowany renderer NC-ART-1/NC-AI-RECOVERY-1 z main; bez assetów
z odrzuconego PR #9 i bez grafiki innego projektu.

## Tempo: baza vs kandydat

To deterministyczne symulacje fixed-step, kupujące ulepszenia przez prawdziwe
przyciski gry; passive nie celuje ręcznie. 60 Hz, dwa ziarna na wariant,
10 min symulacji, bez rysowania pustego Canvas harnessu. To nie fizyczny telefon.

| Plansza | Tryb | Sektor po 10 min: main → KERNELFALL | Zarobione środki: main → KERNELFALL |
|---|---|---|---|
| 800×279 | passive | 10 → 10,5 | 54097,5 → 61228 |
| 907×339 | passive | 10 → 10,5 | 46675 → 56767,5 |
| 800×279 | active | 14 → 15 | 544874,5 → 675417,5 |
| 907×339 | active | 15 → 14,5 | 916391,5 → 709003,5 |

Brak załamania 10-minutowego tempa w tej próbie. Dochód zmienia się także
przez kolejność losowych zdarzeń; to mała próba, nie dowód pełnego balansu.

Osobne 20 min, passive, jedno ziarno, te same dwie plansze: wejście do sektora
13 po main 925/981 s, KERNELFALL 880/902 s. Po 20 min main sektor 13,
KERNELFALL 14 w obu rozmiarach. Cel można ukończyć bez ręcznego celowania.

Pierwsze pięć minut (ziarno 1, obie plansze): pierwszy zakup 13 s;
odcięcie co najmniej trzech żywych modułów po 99/118 s; maksymalnie 15/7
odciętych modułów; wszystkie trzy archetypy widoczne, sektor 7/6 po 5 min.
Narzędzia: `qa/idle-balance.mjs`, `qa/first-five.mjs`; logi w `qa/out/evidence/`.

## Rzeczywiste materiały wizualne

`docs/evidence/kernelfall/` zawiera BEFORE/AFTER 907×510, 800×450,
390×844, 1920×1080, aktualny ekran telefonu, iframe, stan rozpadu i zwycięstwa.
W pliku README rozróżniono naturalną rozgrywkę, przygotowane sceny QA i próbki
renderera 22/34/49 px. Instrumentacja nie jest częścią wydawanego runtime.
Makiety CONCEPT nie są dowodem QA ani tłem rozgrywki.

Ocena: rozróżnialne obrysy i uszkodzenia w próbkach 22/34/49 px; przy 22 px
najdrobniejsze zdobienia zanikają. Odbiór artystyczny GPT/właścicielki:
NOT VERIFIED. Brak deklaracji PASS na prawdziwym iPhonie lub Chromebooku.

## Ograniczenia i dalszy odbiór

Nazwa/TM: brak potwierdzonej identycznej gry w uzyskanych wynikach dla
KERNELFALL / Kernel Fall / Kernel-Fall. Istnieje Kernel Hearts. EUIPO zwróciło
502, TMview pustą aplikację JS, WIPO CAPTCHA, UPRP stronę wejściową.
Badanie rejestrów i podobieństwa znaków: NOT VERIFIED, bez gwarancji prawnej.
Źródła i kroki badania zapisano w `docs/KERNELFALL_BASIC.md`.

Konkurencja: opisano różnice wobec Idle Breakout i Neon Core Breaker;
porównanie ich rzeczywistego runtime: NOT VERIFIED. Nie deklarujemy pełnej
oryginalności. NC-12 pozostaje otwarte.

Finalne trzy okładki i dwa klipy promocyjne: NOT RUN — instrukcja pakietu
wymaga wcześniejszego zatwierdzenia nazwy i gameplayu. Dokładne formaty i kroki
nagrania prawdziwej rozgrywki są w instrukcji CG. To nie jest gotowość do
submission. Portal Preview, fizyczny iPhone, safe areas i monitor 144/165 Hz:
NOT RUN / NOT VERIFIED. Symulacja 60/144/165 Hz jest osobnym dowodem.

## HANDOFF

STAN PRAC: implementacja i materiały lokalne; wyniki końcowego QA i wydajności
zostaną dopisane poniżej. Zdalny PR blokuje HTTP 403 obu metod zapisu.
REPO: klaudiamoscinska-art/neon-crusher, feature/kernelfall-basic-final;
origin/main = c8542741296489324b7d235b682c7e5de78a9a42; PR: brak.
ZMIANY: branding/UI, graf rozpadu, trzy archetypy, 12 sektorów/endless,
walidowany pakiet HTML5 i reprodukowalne materiały Chromium.
OTWARTE DECYZJE: niezależny odbiór GPT, zatwierdzenie nazwy i wyglądu przez
właścicielkę, uprawnienia integracji GitHub, fizyczne urządzenia i portal.
RYZYKA: NC-12, NC-13, NC-17, NC-18, NC-20.
NASTĘPNY KROK: po odzyskaniu dostępu wysłać tę gałąź i utworzyć jeden PR do
main; nigdy merge/deploy bez wyraźnej zgody właścicielki.
BEZPIECZNA KONTYNUACJA: preflight git; przeczytać CLAUDE.md,
docs/KERNELFALL_REPORT_PL.md i docs/KERNELFALL_BASIC.md. Nie cofać main sprzed #10.
PROMPT KONTYNUACYJNY: „Dokończ publikację PR KERNELFALL z istniejącej gałęzi
feature/kernelfall-basic-final. Najpierw sprawdź origin/main i stan repo.
Przeczytaj raport i porównania. Nie zaczynaj implementacji od nowa, nie
zmieniaj save, nie scalaj PR i nie wdrażaj bez zgody właścicielki”.

## Historia walidacji, bez ukrywania wcześniejszych FAIL

Pierwsze próby w sandboxie: procesy potomne `spawnSync` i Chromium były
blokowane (EPERM/SIGTRAP). Powtórzono je w dozwolonym środowisku poza
sandboxem. Nie zaliczano tych prób jako PASS.

Naprawione błędy infrastruktury: typ MIME SVG w serwerach testowych,
instrumentacja iframe uruchamiana także w stronie nadrzędnej bez klasy Game,
porównanie Hz przy jednakowych sekundach zamiast jednakowych krokach,
asercja starej etykiety „Sektor” oraz limit 20 kB dokumentu GDD.

Pełna próba sprzed aktualizacji kontraktu UI: wszystkie zestawy funkcjonalne
PASS, browser-smoke 18/19; jedyny FAIL wymagał dawnych wysokości Canvas.
Zmiana UI jest jawnie zatwierdzonym zakresem tego zadania. Zmierzony main
na tej maszynie ma 907×343 i 800×283, nowa wersja 907×344 i 800×284;
w pozostałych badanych ramkach również +1 px względem zmierzonej bazy.
Kontrakt testu przypięto do rzeczywistych wymiarów KERNELFALL, zamiast
usuwać kontrolę geometrii. Wcześniejszy log zachowano w `qa/out/evidence/`.

Pełne bazowe testy symulacji: PASS. W bazie browser-smoke bez skonfigurowanego
Chromium: NOT RUN; osobna próba z systemowym Chromium: 15/19, FAIL 4.
Trzy wynikały z żądania brakującego faviconu (404), jeden ze starej tabeli
wymiarów (na tej maszynie +4 px). Są to jawne wyniki main, nie nowe regresje.
KERNELFALL ma własną ikonę i osobno sprawdzono jej rzeczywiste dekodowanie.

## Wydajność renderowania

Chromium headless, DPR 1, ta sama maszyna, próby sekwencyjne bez równoległych
symulacji. Czas obejmuje update/draw i wymuszenie rasteryzacji, nie samą fizykę.

| Scena | Średnia ms main → KERNELFALL | p95 ms main → KERNELFALL |
|---|---|---|
| 1920×1080, sektor 13, 60 dronów | 17,44 → 16,35 | 30,70 → 22,10 |
| 800×450, sektor 14, 60 dronów | 10,50 → 10,50 | 17,20 → 21,70 |
| 907×510, świeża gra | 2,65 → 2,56 | 3,70 → 4,00 |

Wykryta wcześniej regresja ciężkiej sceny (27,50 ms) została naprawiona:
połączenia i obwódki są grupowane według stanu, bez rozmywania każdej krawędzi.
Nie obniżano liczby dronów, DPR ani jakości zaakceptowanych sprite'ów.
To wskaźnik laboratoryjny, nie gwarancja FPS na urządzeniach. Rozrzut p95
małego ekranu pozostaje widoczny; pomiar na iPhonie/Chromebooku NOT RUN.
Wcześniejsze pomiary wykonywane podczas równoległych botów nie służą do oceny.
