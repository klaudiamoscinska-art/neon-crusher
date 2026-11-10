# KERNELFALL — kontrakt techniczny integracji art V3

Repo: `https://github.com/klaudiamoscinska-art/neon-crusher` (zaczynać od **aktualnego origin/main**, PR #11 MERGED)

**Zakres wyłącznie wygląd, bez nowych funkcji**:
- `bosses/*`: sprite'y 512x512; `intact` `damaged` `critical` `shatter` `captured`; `firewall`, `memory`, `neural`. Nie podmieniaj całego aktywnego obszaru jednym obrazem.
- `modules/*`: 256x256, wszystkie stany mają ten sam pivot, bryła 2.5D i akcenty, ale alfa wokół. `broken` to chwilowa animacja, zniszczony obiekt nadal niekolizyjny.
- `drones/*`: w prawo? **przód=up**. Jeśli gra rysuje drony pod innym kątem, obracaj tylko sprite, nie fizykę.
- `uplinks/*`: 256, przód=up.
- `fx/{...}/frame_{00..07}_256.png`: 8 klatek osobno, klatki ze wspólnym pivotem środek; chain może być rozciągnięty/obrócony wzdłuż krawędzi sieci.
- `ui/*`: ikony i ramy; nie dodawaj menu nieistniejącego w wersji Basic.
- `environment/arena_floor_1024.png`: subtelny lokalny obraz areny, rysować jeden raz do background cache, nie jest interaktywny.

**Bramki odbioru (twarde):**
(A) 390x844: boss zajmuje czytelną część areny, zasłanianie celów i elementów sterowania = FAIL. Pływające nagrody nie zasłaniają akcji.
(B) 907x510: 1. ekran i realny przebieg NEURAL COLLAPSE są wyraźnie atrakcyjniejsze niż PR #11; porównanie BEFORE/AFTER.
(C) 800x450: brak szumu, overlay nie oszukuje kolizji; inne archetypy zauważalne.
(D) 1920x1080 i 60 dronów: wydajność bez regresji >10% czasu klatki w porównywalnych warunkach; wyniki nie mogą być nazywane pomiarem fizycznego telefonu.
(E) aktywny i bierny gameplay działa, stare save + upgrade’y + ceny bez zmian, RNG/fixed physics bez zmian; 0 requestów obcych hostów.
(F) PR bez merge/deploymentu i raport PL.

**Mechanika grafu:** krytyczna krawędź nie może być tylko kolorową ozdobą. Kiedy węzeł odłączony, graf zależności propaguje uszkodzenia bez zmiany istniejących zasad, a efekty podążają wzdłuż odpowiednich krawędzi. Nie dodawać nowych bonusów, monet ani balansowania.
