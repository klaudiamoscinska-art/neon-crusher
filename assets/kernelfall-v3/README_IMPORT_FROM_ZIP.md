# KERNELFALL — ART V3 / materiały do integracji (NIE RUNTIME)

**To jest katalog wejściowy dla Claude Code. Gra na `main` pozostaje nietknięta.**

Źródło PNG: archiwum **`KERNELFALL_ART_V3_REPO.zip` przygotowane przez GPT i przekazane właścicielce w rozmowie**. ZIP zawiera katalog `assets/kernelfall-v3/` z 100 gotowymi PNG, `manifest.json` i podglądami. *W tej gałęzi są instrukcje i miejsce docelowe; pliki binarne zostaną dodane przez Claude po rozpakowaniu ZIP.* Nie zgłaszaj visual QA jako PASS, jeśli PNG nie zostały naprawdę zaimportowane do runtime.

## Docelowa struktura
- `bosses/`: 3 archetypy × 5 stanów, 512×512 RGBA
- `modules/`: 5 rodzin × 5 stanów, 256×256 RGBA, pivot center
- `drones/`: 3 drony 256×256 RGBA, forward=up
- `uplinks/`: idle, charging, ready, firing
- `fx/`: impact, chain, shield_break, core_collapse, override, po 8 klatek
- `ui/`: ikony i panele bez dynamicznego tekstu
- `brand/`: brand mark z zatwierdzonej wcześniej paczki
- `environment/`: lokalna tekstura podłogi, nie koliduje z gameplayem
- `manifest.json`: rozmiar, SHA-256 każdego PNG

## Zasady
Nie podmieniaj całej areny jednym obrazem. Boss = podkład sylwetki + osobne interaktywne moduły, które podążają za rzeczywistymi hitboxami. Zastosuj stany uszkodzeń oraz realny graf NEURAL COLLAPSE; wyświetlaj postęp rozpadu i ogranicz zasłaniający ekran deszcz zielonych kwot, bez zmiany ekonomii.

**Dostawa:** najpierw PR ze screenami prawdziwego runtime (390×844, 800×450, 907×510 i 1920×1080), QA i raport po polsku; merge/deployment wyłącznie po zatwierdzeniu przez właścicielkę. Wgraj do tej gałęzi rzeczywiste PNG z ZIP przed PR.

Pełne wytyczne: `docs/art/kernelfall-v3/CLAUDE_TASK_PL.md`.
