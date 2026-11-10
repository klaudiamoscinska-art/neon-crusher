# KERNELFALL V3 — obowiązkowe kryteria integracji

## Stan źródeł
Na gałęzi `feature/kernelfall-art-v3-source` znajdują się wszystkie 100 plików PNG z pakietu ART V3, po automatycznym rozpakowaniu i kontroli SHA-256 przez workflow `KERNELFALL V3 - import full art pack`. Przed pracą **sprawdź**, że dokładnie 100 PNG istnieje pod `assets/kernelfall-v3/`, a manifest `assets/kernelfall-v3/manifest.json` zgadza się z plikami. Jeśli nie, STOP i zgłoś problem; nie symuluj obecności plików.

## Ważna decyzja: jedna jakość wizualna na urządzeniach
Telefon NIE może dostać uproszczonej albo zastępczej wersji grafiki. **Te same materiały V3** i te same trzy sylwetki AI muszą być używane na desktopie, laptopie, tablecie oraz iPhonie. Dopuszczalny jest responsywny układ, kadrowanie oraz LOD drobnych elementów przy zachowaniu pełnej sylwetki głównego przeciwnika, koloru, cieniowania i kluczowych FX. Niedopuszczalne: desktop = efektowny boss, telefon = stare kafelki lub gorsza stylistyka; telefon = mocno zredukowane FX przy zachowaniu wydajności, chyba że konkretne urządzenie nie wyrabia i udokumentowano pomiar.

## Język CrazyGames
English to język bazowy: bez zapisu ustawienia oraz bez świadomego wyboru języka gra startuje po angielsku, również na polskiej przeglądarce. Można utrzymać polską lokalizację jako opcję użytkownika, ale nie wolno polegać na samym locale przeglądarki dla domyślnego PL. Dla portalu CrazyGames brak angielskich fraz lub fallbacku = FAIL. Wszystkie etykiety menu, HUD, wprowadzenie, upgrade, win, tooltip, komunikat i aria-label muszą mieć EN. Użyj `<html lang="en">` jako domyślnego dokumentu. Zachowaj istniejący zapis gry i kompatybilność.

## Ekrany kontrolne
Prawdziwy Chromium runtime, a nie makiety:
- 390×844 portrait iPhone (DPR 2 i 3)
- 800×450 mobile landscape (DPR 1)
- 907×510 desktop iframe (DPR 1)
- 1920×1080 desktop (DPR 1)
- 1920×1080 przy 60 dronach, porównywalny pomiar wydajności
- 3 archetypy, intact/damaged/critical/isolated/broken, shatter i chain, idle vs OVERRIDE
- pierwszy start, pierwsze 10 sekund i przed/po KERNELFALL V3

Weryfikacja: sprite'y nie zasłaniają hitboxów i zaznaczeń; nie ma zasłaniania przez kwoty nagród; zachowane save v1, physics, RNG, ekonomia, idle, sterowanie, brak nowych zależności i zewnętrznych hostów. Całość Basic Launch ma być możliwie lekka, mobile-homepage aim ≤20 MB; profil bez SDK może mieć łącznie ≤20MB przy takim celu.

**STOP:** brak merge, deploy, submission. PR + kompletny raport po polsku i rzeczywiste screenshoty do odbioru przez GPT/właścicielkę.
