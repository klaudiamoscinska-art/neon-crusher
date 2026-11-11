# Pochodzenie poprawionych materiałów

Wszystkie 92 oryginały V6 z `b6f7178` zachowano bez zmiany pikseli i SHA.
Nowe warianty znajdują się wyłącznie w `assets/kernelfall-v6-runtime/`.

Trzy arkusze w `sources/` są wynikami edycji narzędziem `image_gen` z użyciem
oryginałów V6 jako referencji. To rzeczywista rekonstrukcja ilustracji,
a nie operacja rozmycia, maska nałożona przez renderer lub odzyskanie detalu
samym powiększeniem. Arkusze są materiałem roboczym; nie wchodzą do paczki gry.

- `drones-repaired.png`: referencje trzech oryginalnych dronów. Usunięcie
  nieprzezroczystych kolorowych dysków, rekonstrukcja skrzydeł, zachowanie
  białych metalowych kadłubów i trzech barw napędu, nos +X, mały płomień -X.
- `uplinks-repaired.png`: referencje czterech oryginalnych stanów. Rekonstrukcja
  obudowy z szynami skierowanymi -Y, cyjanowy materiał źródła, magentowy
  kondensator: pusty / częściowy / pełny / rozbłysk wylotowy. Bez czerwonych
  pozostałości i bez koła tła poza obudową.
- `modules-repaired.png`: referencja oryginalnego contact sheet V6. Pięć ról
  w wierszach, pięć stanów w kolumnach. Kwadratowe obudowy, wyraźne funkcje
  (krzyż pancerza, banki pamięci, bursztynowa błyskawica, gniazdo, kłódka),
  rzeczywiste pęknięcia i ubytki narożnika, cyjanowa izolacja i osobne odłamki.

`node tools/build_kernelfall_v6_runtime.mjs` wykonuje tylko mechaniczne
kadrowanie i resize do 256×256 (ImageMagick, narzędzie deweloperskie).
Manifest zawiera dokładne prostokąty, nazwy arkuszy, oryginalne role i SHA.
Stałe kadrowanie modułów nie dopasowuje osobno rozbitych fragmentów do pełnej
sylwetki. Renderer nie zwiększa rozmiaru drona, modułu ani emitera.
Nie dodano zależności runtime ani plików SVG.

Akceptacja estetyczna właścicielki: **NOT VERIFIED**. Zachowano V3 dla rodzin,
których źródła nie pozwalały na bezpieczną integrację; szczegóły w inwentarzu.
