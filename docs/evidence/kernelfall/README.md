# Rzeczywiste materiały przeglądarkowe

Wszystkie pliki pochodzą z Chromium, DPR 1. Nie są to makiety z paczki.
Cztery JPG zestawiają main `c854274` (lewa strona) z KERNELFALL (prawa),
przy tych samych zapisach początkowych i scenariuszach `qa/art-shots.mjs`.
Losowanie w prawdziwej przeglądarce nie jest seedowane; to porównanie scen,
a nie identycznych trajektorii. Ujęcie 1920×1080 przedstawia sektor 13/40 dronów.

`final-390x844.png`: aktualny nagłówek z celem /12 i pełny interfejs.
`iframe-nested.png`: prawdziwa gra w iframe pod `/nested/`, test ładowania
ścieżek względnych i logo. `neural-core-cut-fixture.png` i
`victory-fixture.png`: reprodukowalne stany QA; przygotowano zapis/poziom,
a krytyczny moduł uszkodzono rzeczywistym `hitBlock` z instrumentacji testu.
Nie są dowodem czasu osiągnięcia tych stanów przez nowego gracza.

`runtime-specimens-22-34-49.png`: osobne próbki rzeczywistego renderera
`Block.drawCore`, nie screenshot rozgrywki; moduł, zasilanie i rdzeń przy
22/34/49 px, HP 100% i 35%. Zachowano zaakceptowane kształty z main.
Przy 22 px rozróżnialne są obrys rdzenia, bursztynowy przekaźnik i pęknięcia;
drobne zdobienia zanikają. Ostateczna ocena estetyczna należy do GPT/właścicielki.

Odtwarzanie: `NC_CHROMIUM=/usr/bin/chromium node qa/kernelfall-browser.mjs`.
Sceny / screenshoty pośrednie i pełne logi pozostają w `qa/out/` (dev-only).
Nie oznaczamy fizycznego iPhone'a ani 144/165 Hz monitora jako PASS.
