# ⛔ STOP — ODRZUCONY KIERUNEK ART V5 (2026-11-10)

Decyzja właścicielki: grafiki produkcyjne KERNELFALL **nie mogą być wektorowymi SVG**. ART V5 jest zestawem koncepcyjnych źródeł wektorowych, **NIE finalnymi assetami**. Tego dokumentu NIE WYKONYWAĆ jako finalnego zadania integracji. Nie konwertuj SVG na PNG jako pozorowanego finalnego zestawu. Nie wykonuj merge V5 do main; zachowaj istniejące V3 jako bezpieczny baseline aż powstanie nowy, zaakceptowany jakościowo komplet oryginalnych rasterów PNG z przeźroczystością, osobnymi stanami uszkodzeń, spójnym stylem i manifestem. 

---

# CODEX — KERNELFALL FINAL VISUAL INTEGRATION (jedyny wykonawca)

**Koncepcję i QA koordynuje GPT; implementuje wyłącznie Codex.** Raport końcowy po polsku; widoczne UI po angielsku.

## Preflight — bez zgadywania
1. Repo `klaudiamoscinska-art/neon-crusher`. Sprawdź aktualne `main` i `feature/kernelfall-art-v5-source`, stany PR, dirty tree, uprawnienia GitHub.
2. V3 **już na main**, merge PR #12. Pakiet V3 (100 PNG) jest działającą bazą renderera. V5 (90 samodzielnych SVG) w `assets/kernelfall-art-v5/`, manifest w tym samym katalogu. **To oddzielne źródła, NIE działająca integracja**.
3. Czytaj `docs/GAME_DESIGN.md`, `docs/VISUAL_IDENTITY.md`, `docs/KERNELFALL_BASIC.md`, `docs/art/kernelfall-art-v5/ART_CONTRACT_PL.md`, pełny manifest V5 i raport V3 `docs/qa/kernelfall-art-v3/REPORT_PL.md`.
4. Zachowaj istniejące źródła V3 bez modyfikacji, chyba że jawnie udowodnisz konieczność. Nie dąż do użycia wszystkich nowych SVG za wszelką cenę.

## Cel wizualny
Chcemy atrakcyjnego, czytelnego IDLE DESTRUCTION o niszczeniu zbuntowanej AI, nie manual shootera ani match-3.
- Rozpoznawalny centralny reaktor AI, 3 archetypy: Firewall, Data Memory, Neural Core, stany intact/damaged/critical/shatter/captured.
- Moduły stanowią część konstrukcji AI, a nie losowe płytki: rozpoznawalne kolory, pogłębione metalowe obramowania, elektryczne pęknięcia, iskry, odłączenia grafu.
- Drony odbijają się automatycznie; 3 warianty są wyłącznie wizualne, żadnych nowych typów bojowych.
- Prawdziwe połączenia zasilania, prawdziwe reakcje osłony, prawdziwy NEURAL COLLAPSE. Zero animacji sugerujących niedostępne działania.
- Utrzymaj tylko 3 upgrade: New drone, Override charge, Breach power. Bez Critical / Fire rate / innych walut i systemów.
- Identyczne jakościowo zasoby desktop/mobile i różny responsywny layout. Unikaj nadmiernych dekoracji zasłaniających hitboxy.
- Weryfikuj czytelność przy rzeczywistym rozmiarze modułów 16–50 world-px i wynikowym device-px, nie wyłącznie na podglądzie 512px.

## Zadanie implementacyjne
A. Zrób test A/B: aktualny V3 vs wybrane V5 na realnym Canvas, dla Firewall L1/L4/L7, Memory L2/L5/L8, Neural L3/L6/L9/L12. Każdy screen realny, jawny fixture jeśli wymuszony. Opisz, który asset wygrywa dla każdej roli i dlaczego.
B. Opracuj rekomendowaną kompozycję planszy z prawdziwymi colliderami i grafem; **nie zastępuj jej ilustracją z fałszywymi modułami**. Core artwork jest warstwą ozdobną; rdzeń ma pozostawać celowalny.
C. Zintegruj wybrane assety w istniejącym `SpriteAtlas`, uwzględniając dekodowanie SVG lub lokalny build PNG bez nowych zależności runtime. Ustal poprawne pivoty, przeźroczyste marginesy, cache i limit pamięci. Używaj konkretnych stanów faktycznego HP i odcięcia zasilania.
D. Popraw proporcje pola gry w niskich iframe, jeśli da się to zrobić bez utraty czytelności HUD; wcześniej NC-17 63–67% zamiast celu70% jest znanym ograniczeniem. Nie psuj safe-area.
E. English ma pozostać domyślny przy pl-PL; PL tylko jawnie po ?lang=pl. Wszystkie istniejące saves i balans kompatybilne.
F. Zachowaj układy 1–12: siatka 3×3, pierścień, 4×4, pierścień, 5×5, dwa pierścienie, 6×6, dwa pierścienie, 7×7, dwa pierścienie, 7×7, dwa pierścienie; przekaźniki wg istniejącego kontraktu. Bez nowej mechaniki; po 12 endless.

## QA do odbioru
- `node qa/run-all.mjs`, aktualny browser-smoke, V3 art QA, comparison i performance. Jeśli zmieniasz atlas, dodaj własny ART V5 smoke/integrity.
- Rozdzielczości 1920×1080, 1366×768, 907×510, 390×844 DPR2/3, 375×812 DPR2, 844×390. Plus niezależnie fizyczny iPhone — jeśli niedostępny: NOT RUN.
- Screenshoty rzeczywistej przeglądarki: każdy archetyp, trzy stany HP, relay, firewall node, połączenia odcięte, OVERRIDE, wygrana po L12, realny desktop/mobilny BEFORE/AFTER. Metadane czasu/seed/fixture.
- Sprawdź także pierwsze 60 s naturalnej gry: automatyczny ostrzał, pierwszy zakup i widoczny wzrost mocy; nie zmieniaj ekonomii bez uprzedniego STOP/zgody.
- Perf: cache SVG/PNG z limitem, bez nowych zewnętrznych requestów i bez regresji ponad 10% względem bazowego scenariusza V3. Wyniki zmierzone, nie zgadnięte.
- Każdy test tylko PASS / FAIL / NOT RUN / NOT VERIFIED; brak cichej podmiany na low-quality Canvas.

## GitHub i koniec zadania
- Nowa gałąź implementacyjna od aktualnego main + źródła V5 (bez ryzykownego nadpisania); commit/push i PR do main.
- **Bez merge, bez deployu produkcji, bez zgłoszenia CrazyGames** — decyzja właścicielki po odbiorze.
- W raporcie PL: dokładne SHA, liczby faktycznie rysowanych assetów, rola V3/V5, dowody A/B, screenshoty, QA, ryzyka, werdykt READY FOR GPT REVIEW / BLOCKED, instrukcja testów na iPhone oraz handoff.
- Jeśli grafiki V5 w runtime wypadają gorzej od V3: nie wciskaj ich na siłę; pokaż porównanie, zachowaj lepsze źródła i odnotuj potrzebną następną korektę.

**Priorytet:** naprawdę ładna gra, ale wierna istniejącej fizyce i idle — a nie efektowny fałszywy screenshot.
