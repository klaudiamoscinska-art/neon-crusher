# KERNELFALL ART V6 — RASTER PNG, do odbioru właścicielki

## Stan faktyczny
- **92 samodzielne pliki PNG**, weryfikowane jako prawdziwe binarne bloby w repozytorium, NIE SVG.
- Osobny branch: `feature/kernelfall-art-v6-raster`. `main` pozostaje nietknięty.
- Produkcyjny renderer na `main` nadal korzysta z ART V3. **Nie oznacza to wdrożenia ART V6 w grze**.
- Arkusz rzeczywistych rastrów: `docs/art/kernelfall-v6/CONTACT_SHEET_REAL_PNG.png`.
- Manifest: `manifest.json`, 92 pozycje ze SHA-256, wymiarami, rolą, rozmiarem i alpha coverage.

## Zawartość
- `bosses`: 3 odmiany wrogiej AI (firewall, memory, neural) × 5 stanów = 15 PNG RGBA, 512×512.
- `modules`: 5 ról × 5 stanów = 25 PNG RGBA, 256×256.
- `drones`: 3 warianty wizualne = 3 PNG RGBA, 256×256.
- `uplinks`: 4 stany = 4 PNG RGBA, 256×256.
- `fx`: 5 typów × 8 klatek = 40 PNG RGBA, 256×256.
- `environment`: 3 tła, 1280×720 PNG.
- `brand`: 2 pliki PNG pochodzące z istniejącego ART V3 (zachowano dla zgodności).

## Ważne ograniczenia jakościowe
To **kandydat rastrowy do oceny**, nie zatwierdzona finalna grafika w uruchomionej grze. Nowy art pochodzi z jednolitej malarskiej planszy rastrowej 1536×1024, z której elementy zostały wysegmentowane, oczyszczone z tła, powiększone i zapisane jako osobne PNG. Stany uszkodzeń części modułów i klatki FX utworzono przez obróbkę rastrów, a nie przez osobne generowanie każdego stanu; nie należy przypisywać im nieistniejącej szczegółowości. Tła są powiększonymi kadrami i mogą być miękkie w rozdzielczości 1920×1080.

Wszystkie grafiki V6 są rastrowe; jednak to *nie jest automatycznie gwarancją* czystej alfy, doskonałej czytelności w 16–50 world-px ani jakości na fizycznym iPhonie. Każde wymaga oceny w prawdziwym renderze. Brak edytowalnych SVG w V6.

## Zasady integracji
- Gra pozostaje idle: fizyczne drony/pociski odbijają się i atakują automatycznie; OVERRIDE ręczne lub autopilot.
- Zachować działającą fizykę, graf zasilania, shield, collapse, save v1, ekonomię, RNG, 12 sektorów → endless, oraz **wyłącznie trzy** istniejące upgrade: New drone / Override charge / Breach power.
- Mobile i desktop dostają te same materiały; inne kadrowanie i HUD, bez trybu „lite”.
- Domyślnie English; PL wyłącznie jawnie.
- Tę paczkę porównujemy A/B z V3. Nie wymieniaj wszystkich grafik bez oceny.
- Raport Codexa musi rozdzielać PASS / FAIL / NOT RUN / NOT VERIFIED; dokumentować screenshoty z działającego Canvas i fizyczny iPhone jako NOT RUN, jeśli nie testowano.

Wymagany odbiór estetyczny właścicielki **NOT VERIFIED**. Nie robić merge ani deployu bez zgody.
