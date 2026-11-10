# KERNELFALL — FINALNY PROMPT DLA CLAUDE / ART V3 + MOBILE-DESKTOP PARITY + EN

**Repo:** https://github.com/klaudiamoscinska-art/neon-crusher
**Pełne źródła graficzne:** https://github.com/klaudiamoscinska-art/neon-crusher/tree/feature/kernelfall-art-v3-source/assets/kernelfall-v3
**Gałąź źródłowa:** `feature/kernelfall-art-v3-source`
**Cel:** jeden PR do `main`; bez merge i bez deploymentu.

## P0 — Zanim ruszysz

1. Pobierz aktualne refy; sprawdź, że `main` zawiera PR #11, a gałąź źródłowa V3 jest jego potomkiem. Nie zakładaj stałych SHA.
2. Na gałęzi źródłowej znajduje się **100 PNG** w `assets/kernelfall-v3/`, metadane `manifest.json`, dokumentacja i makiety w `docs/art/kernelfall-v3/`. NIE proś właścicielki o ZIP. Wszystkie potrzebne materiały już są na GitHubie.
3. Uruchom weryfikację manifestu: dokładnie 100 PNG, ścieżki, rozmiary i SHA-256 z manifestu; jeśli brak lub hash FAIL: STOP. Nie wstawiaj zastępczych kwadratów.
4. Utwórz osobną gałąź roboczą **z aktualnej gałęzi źródłowej V3** (np. `feature/kernelfall-v3-integrated`) i pracuj tam. Zmiany tylko na gałęzi roboczej.
5. Przeczytaj `docs/art/kernelfall-v3/VISUAL_PARITY_EN.md`, `docs/art/kernelfall-v3/INTEGRATION_SPEC_PL.md`, `docs/VISUAL_IDENTITY.md`, `docs/GAME_DESIGN.md`, `docs/SAVE.md`, `docs/CRAZYGAMES.md`.

## Cel artystyczny — ta sama jakość w telefonie i na komputerze

Użytkowniczka odrzuciła dotychczasową grafikę (czerwone kafelki, maleńki rdzeń, zielone kwoty zasłaniające akcję) oraz wcześniejszą ubogą makietę mobilną. **Nie ma osobnej, prostszej stylistyki na telefon.** Gra musi używać **tych samych assetów V3, trzech imponujących archetypów bossa, stanów uszkodzenia, cieniowania i kluczowych efektów** na każdej szerokości. Zmienia się jedynie responsywny układ i skala tak, aby zachować celowanie i czytelność.

1. Osadź bossy V3 w rzeczywistej arenie Canvas: `bosses/firewall_*`, `memory_*`, `neural_*`. Stany intact/damaged/critical/shatter/captured muszą wynikać z rzeczywistego stanu gry; nie nakładaj statycznego plakatu na hitboxy.
2. Wykorzystaj `modules/*` dla faktycznych modułów AI i zasilania; pliki są w małej skali testowane w `previews/03-scale-test.png`. Poza wizualną kompozycją nie ruszaj ich colliderów.
3. Użyj V3 `drones/`, `uplinks/`, `fx/`, `environment/`, `ui/`, `brand/`. Ładuj przez lokalne ścieżki i cache; żadnego pobierania z obcych hostów, żadnego ciągłego dekodowania/skalowania w pętli. W efektach NEURAL COLLAPSE podążaj wzdłuż realnych krawędzi grafu.
4. Łącz warstwy tak, by na 390×844 boss zajmował czytelną, atrakcyjną część areny, a słabe punkty i celowanie pozostawały widoczne. **Nie dopuszczaj: desktop = efektowny, mobile = ubogie stare kafelki.**
5. Zadbaj o kompozycję HUD w pionie: logo, czytelne informacje o AI, override, dostępne upgrade'y; nie przycinaj elementów przez safe areas, nie powoduj przypadkowych kliknięć; zachowaj ograniczenia iframe desktop.
6. Zielone latające kwoty wynagrodzeń wizualnie agreguj/ogranicz tak, aby nie zasłaniały AI; nie wolno modyfikować faktycznie naliczanych pieniędzy.
7. Makiety CONCEPT są tylko wzorcem stylistycznym; nie wklejaj obrazka makiety do Canvas jako tła ani dowodu jakości. Testowany wynik musi pochodzić z prawdziwego renderera.

## Język — English-first obowiązkowo

CrazyGames wymaga prawidłowej lokalizacji EN i fallbacku na angielski. W obecnym `game.js` funkcja `detectLanguage()` wybiera również `navigator.languages`, więc na polskim iPhonie gra startuje po polsku. W wersji przeznaczonej na Basic Launch **domyślnie startuj po angielsku niezależnie od języka przeglądarki**, gdy nie wybrano języka w samej grze. `?lang=pl` może pozostać świadomym sposobem wejścia do PL; `?lang=en` musi działać. Brakujące lokalizacje mają fallback EN. `<html lang="en">` bazowo. Zachowaj istniejącą wersję polską jako opcję, ale nie automatyczny domyślny PL. Sprawdź EN na polskiej przeglądarce i iPhonie. Aktualizuj testy i18n, żeby uwzględniały świadomie nowy kontrakt; nie obniżaj zakresu QA.

## Kontrakty bez zmian

Nie zmieniaj istniejącej fizyki 1/240, ekonomii, balansu, RNG, AI shield, celu 12 sektorów/endless, progresji, obsługi aktywnego OVERRIDE, idle, warunków zwycięstwa, sterowania, save v1 i jego pięciu pól. Bez nowych frameworków, SDK, zależności, backendu, reklam i zewnętrznych żądań w runtime. Wzmacniaj głównie art/render/layout + EN-first.

## Odbiór i QA

Obowiązkowo dostarcz prawdziwe screenshoty Chromium dla: 390×844 DPR2/3, 800×450 DPR1, 907×510 DPR1, 1920×1080 DPR1; pierwszy ekran i 10s, 3 archetypy, intact/damaged/critical/isolated/broken, widoczny łańcuch collapse, ekran sektora 13. Ustaw w porównaniu obok siebie screenshoty mobile i desktop pokazujące **ten sam archetyp i stan** — porównanie spójności artystycznej.

Sprawdź wszystkie dotychczasowe testy, browser smoke, EN/PL, iPhone-safe-area i orientację (symulacja nie zastępuje fizycznego iPhone), Playwright, save/reload, idle/active, iframe, reduced motion, asset loading 0x404, network 0 obcych hostów. Weryfikacja wydajności 1920×1080/60 dronów i symulowana mobilna DPR2/3; nie deklaruj wyniku fizycznego urządzenia bez jego użycia. Kontroluj rozmiar paczki w ramach aktualnych limitów CrazyGames (szczególnie 20 MB dla mobile homepage, gdy brak SDK, jeżeli chcemy ten kanał).

Na końcu utwórz **jeden PR** do main i dostarcz raport po polsku z PASS/FAIL/NOT RUN/NOT VERIFIED, różnicą przed/po oraz dokładnymi nazwami użytych assetów. **Visual PASS dopiero po ocenie właścicielki i GPT.** NIE wykonuj merge, deploy ani submission.

Raporty i HANDOFF po polsku. Identyfikatory techniczne w oryginale.
