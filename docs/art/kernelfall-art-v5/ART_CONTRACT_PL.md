# KERNELFALL — ART V5 / KONTRAKT INTEGRACJI (PL)

**Repo:** klaudiamoscinska-art/neon-crusher
**Status:** 91 nowych, samodzielnych plików SVG + manifest. To oddzielne assety, nie makieta; NIE są jeszcze podłączone do gry. Gałąź nie zmienia `main`.
**Istniejący runtime:** ART V3 z PR #12 jest już scalony do `main`; 100 oryginalnych PNG pozostaje nienaruszonych. V5 to alternatywne źródła do rzetelnego A/B; nie używaj V5 automatycznie, jeśli wizualnie pogarsza grę.

## Decyzje bazowe
- Idle destruction: automatyczne odbicia dronów, opcjonalne ręczne OVERRIDE i istniejący autopilot.
- Przeciwnik: zbuntowana AI z prawdziwymi węzłami grafu. Zniszczenie zasilania rozłącza rzeczywiste gałęzie; efekt NIE może symulować fikcyjnych celów.
- Tylko istniejące trzy ulepszenia: New drone, Override charge, Breach power. Żadnych nowych walut, krytyków ani przycisków ruchu.
- Tło i obudowa rdzenia są dekoracyjne; pole kolizji musi nadal odpowiadać faktycznym modułom w Canvas. Zmiana źródła grafiki nie daje zgody na zmianę fizyki, RNG, balansu, ekonomii, SAVE v1.

## Źródła
- `bosses`: 3 archetypy × 5 stanów (intact/damaged/critical/shatter/captured), 512 viewBox.
- `modules`: 5 ról × 5 stanów (intact/damaged/critical/isolated/broken), 256 viewBox.
- `drones`: 3 warianty wizualne, 256; nie zmieniaj funkcji żadnego drona.
- `uplinks`: 4 stany, 256.
- `fx`: 5 rodzin × 8 klatek, 256; synchronizuj wyłącznie z realnymi zdarzeniami.
- `environment`: 3 motywy SVG 1600×900, dopasowanie bez udawanej interaktywności.

## 12 sektorów — baza gry, nie 12 nowych mechanik
| Sektor | Motyw | Konstrukcja | Przekaźniki |
|---|---|---|---:|
| 1 | Firewall – First Contact | 3×3 | 0 |
| 2 | Data Memory – Access Ring | 1 ring | 1 |
| 3 | Neural – Awakening | 4×4 | 1 |
| 4 | Firewall – Containment | 1 ring | 1 |
| 5 | Data Memory – Corruption | 5×5 | 2 |
| 6 | Neural – Mutation | 2 rings | 2 |
| 7 | Firewall – Lockdown | 6×6 | 2 |
| 8 | Data Memory – Fragmentation | 2 rings | 3 |
| 9 | Neural – Overload | 7×7 | 3 |
| 10 | Firewall – Last Defense | 2 rings | 3 |
| 11 | Data Memory – System Failure | 7×7 | 4 |
| 12 | Neural – KERNELFALL | 2 rings | 4 |

Wszystkie wzorce występują w grze; nazwy opisowe sektorów są tylko dla briefu i nie są nowym, wymaganym tekstem UI. Od sektora 3 obrona AI reaguje zgodnie z dotychczasowym kodem; po sektorze 12 przejście do endless.

## Zasady jakości dla Codexa
1. Najpierw porównaj V3 z V5 na screenshotach z rzeczywistej gry i w rozmiarach 1920×1080, 907×510, 390×844, 375×812, 844×390. Gdy art V5 wygląda gorzej, zachowaj V3 i udokumentuj decyzję.
2. Moduły muszą być jednoznacznie rozpoznawalne przy 16–50px; nie pokazuj 3D ilustracji jako faktycznej planszy.
3. Ta sama jakość na PC i mobilnym Safari, bez specjalnego renderera „lite”; wstępny QA emulacyjny to NIE test fizycznego iPhone'a.
4. English jako domyślny język, PL tylko jawnie wybierany; zachowaj dokładnie 3 upgrade w HUD.
5. Nie nadpisuj bez kopii obecnych V3, nie wymieniaj wszystkich grafik na ślepo, nie usuwaj obecnych hitboxów.
6. W finalnej pracy Codex przedstawia prawdziwe screenshoty BEFORE/AFTER, liczbę assetów faktycznie rysowanych, manifest, wyniki testów PASS/FAIL/NOT RUN/NOT VERIFIED i raport PL.
7. STOP przed merge i produkcyjnym deployem bez decyzji właścicielki.

## Ograniczenie uczciwości
Graficzny podgląd generowany obrazem AI NIE jest sprite sheet i nie wolno go wykorzystywać jako dowodu wdrożenia. Wszystkie pliki w `assets/kernelfall-art-v5` to rzeczywiste samodzielne źródła graficzne SVG.
