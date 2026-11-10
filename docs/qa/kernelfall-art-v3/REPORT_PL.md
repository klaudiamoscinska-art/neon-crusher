# KERNELFALL ART V3 — raport integracji do odbioru GPT

Werdykt: **READY FOR GPT REVIEW**. Jest to przekazanie implementacji i dowodów do przeglądu; akceptacja estetyczna właścicielki: **NOT VERIFIED**. Nie wykonano merge, deployu ani zgłoszenia do portalu.

## Baza i historia

Repozytorium: `klaudiamoscinska-art/neon-crusher`. Zweryfikowano zdalne referencje ponownie po integracji:

| Referencja | Pełny SHA |
|---|---|
| `origin/main` | `1fb7ab4b4a931a039adf047ae900c6b0641f882d` |
| `origin/feature/kernelfall-basic-final` | `5ca0f0dd07a97e529b3984c2d5c4658c31f134ad` |
| `origin/feature/kernelfall-art-v3-source` | `3a850878c63b793139e271eadf09a405048cc241` |

Basic jest przodkiem main (PR #11), a main przodkiem ART V3. Gałąź integracyjna `feature/kernelfall-art-v3-integration` powstała z aktualnej gałęzi grafik, zachowując obie historie. Raportowany wcześniej wynik 255 PASS dotyczył poprzedniego pakietu, nie stanowi dowodu dla tej integracji. Końcowy HEAD i PR podano w raporcie przekazania w rozmowie oraz w metadanych PR.

## Implementacja i realne wykorzystanie

W repo pozostaje **100/100 oryginalnych PNG**, łącznie 6 783 530 bajtów. Sygnatury PNG, wymiary, liczba bajtów oraz SHA-256 każdego pliku zgadzają się z oryginalnym manifestem. Nie zmieniono grafik ani jego źródłowych metadanych. Pole manifestu `runtime_status` opisuje historyczny pakiet produkcyjny; aktualny stan integracji opisuje niniejszy raport.

| Zasoby V3 | Rola w runtime |
|---|---|
| `bosses/{firewall,memory,neural}_{intact,damaged,critical,shatter,captured}_512.png` | Duża obudowa AI pod interaktywną strukturą, archetyp wg istniejącego sektora; HP rdzenia steruje uszkodzeniem, zniszczenie — rozpadem i przejęciem |
| `modules/{armor,memory,port,relay,firewall}_{intact,damaged,critical,isolated,broken}_256.png` | Rzeczywiste płytki gry; trzy istniejące warianty armor mapują na armor/memory/port, relay i aktywny węzeł tarczy mają własne materiały |
| `drones/{scout,assault,support}_256.png` | Drony, wariant wizualny wg indeksu, bez zmiany funkcji/balansu; obrót przodu do wektora prędkości |
| `uplinks/{idle,charging,ready,firing}_256.png` | Emitery wg istniejącego charge/flash, przód obrócony do rzeczywistego kierunku strzału |
| `fx/{impact,chain,shield_break,core_collapse,override}/frame_00..07_256.png` | Trafienia, propagacja po prawdziwych krawędziach zasilania, przełamanie tarczy, rozpad rdzenia i strzał OVERRIDE |
| `environment/arena_floor_1024.png` | Jednorazowo rasteryzowane tło areny z cache |
| `ui/network_128.png`, `ui/shield_128.png` | Ikony HUD Canvas, odpowiednio integralność sieci i tarcza |
| Pozostałe 6 `ui/*` | Trzy przyciski upgrade i trzy kolorowe panele w DOM/CSS |
| Cztery `brand/*` | Wordmark i symbol z wyborem rozdzielczości przez srcset/favicon |

Atlas ładuje 90 lokalnych PNG dla Canvas; pozostałe 10 jest używane przez HTML/CSS. Lista **faktycznie zarejestrowanych wywołań rysowania** w testowanych scenariuszach to `runtimeDrawn` w [browser-results.json](browser-results.json). Nie utożsamiamy jej z samym preloadem: wszystkie 100 plików przeszło niezależny rzeczywisty decode w Chromium, a lista wywołań oznacza tylko wykonane scenariusze (naturalna gra oraz jawnie opisane fixture). W scenariuszach łącznie potwierdzono wywołania wszystkich 90 PNG Canvas (w tym jawne fixture rzadkich stanów) oraz role 10 PNG HTML/CSS. Nie wszystkie assety muszą być widoczne naraz.

Priorytet modułów: broken → isolated (offline/shatter) → HP; progi HP >70%, 35–70%, ≤35%. Margines alfa modułu jest kadrowany wyłącznie przy tworzeniu rastra cache; źródłowy PNG pozostaje bez zmian. Rysunek korpusu odpowiada kwadratowi kolizji. Kolejność: arena → dekoracje odzyskanej sieci → obudowa bossa → graf → moduły/rdzeń → tarcza/oznaczenia → uplinki → FX → drony/nagrody → HUD. Canvas nadal rysuje precyzyjne znaczniki hitboxów, kierunki strzałów, krawędzie grafu, cienie i istniejące cząstki; nie zastępują one dostarczonych sprite’ów.

Obrazy są dekodowane raz, rastry dobierane do dokładnego rozmiaru urządzenia (do 2048 px) i współdzielone w cache z budżetem 48 MiB referencjonowanych rastrów RGBA. Nie jest to limit całej pamięci gry. Całkowicie przezroczyste marginesy bossów/dronów/uplinków są pomijane podczas blitu po jednorazowej analizie alfa oryginału, z 4 px zapasem na filtrację i zachowaniem pivota; widoczne piksele, skala i warstwy pozostają zachowane. Brak nowych bibliotek runtime, zewnętrznych requestów i zależności sieciowych. Podczas ładowania gra pokazuje angielski komunikat; uszkodzony PNG daje angielski błąd z prośbą o odświeżenie, zamiast cichego przejścia na stary wygląd. Kod wektorowy pozostaje do istniejących testów symulacji bez Image/DOM; przeglądarka przechodzi przez bramkę ładowania V3.

## Mobile i język

Telefon używa tej samej sylwetki bossa, pełnych PNG modułów/dronów/uplinków, podłogi, cieni i FX. Usunięto dawny próg 30 device px, który przełączał małe drony na prosty Canvas. Nie ma wykrywania telefonu ani automatycznego obniżenia jakości. `prefers-reduced-motion` wyłącza animowane V3 FX świadomie, na wszystkich urządzeniach; nie usuwa materiałów.

Skala bossa wynika z coreExtent/coreScale i krótszej osi planszy, a nie z samej szerokości viewporta. Moduły są zawsze nad obudową; interaktywna geometria pozostała bez zmian. HUD ma te same ikony na mobile; dotychczas ukrywane ikony upgrade są widoczne. Dla niskiego landscape zwężono odstępy interfejsu: 844×390 daje planszę **844×272 px**, zamiast 844×224 px przed poprawką. Zachowano touch-action, bezpieczne marginesy i sterowanie tap/click/Space.

**English jest domyślny**, także przy przeglądarce pl-PL. Domyślne HTML/aria/teksty loadera są angielskie; tłumaczenie nie zależy od asynchronicznego pobierania. Polski włącza się świadomie przez `?lang=pl` / `?lang=pl-PL`; nieobsługiwany język wraca do EN. Zachowano istniejący format save v1 i klucze audio.

## QA i dowody

| Zakres | Wynik | Dowód |
|---|---|---|
| Pełne automatyczne testy bez przeglądarki: fizyka 48 seedów/60–144–165 Hz, poziomy, ekonomia, zapisy, collapse, recovery, instrukcje, i18n, integralność | PASS — 240, 0 FAIL | [automated-results.json](automated-results.json), [automated-run.txt](automated-run.txt) |
| Chromium smoke: 10 ramek CrazyGames × EN, pl-PL→EN, jawne PL; sterowanie/audio/zapisy | PASS — 20, 0 FAIL | [browser-smoke.txt](browser-smoke.txt) |
| Porównanie symulacji z main: 4 scenariusze, po 150 s, 60/144 Hz, zakupy i ręczne volleye | PASS — 4, 0 FAIL; stany identyczne | [simulation-comparison.txt](simulation-comparison.txt) |
| HTML5 ZIP, komplet plików lokalnych i limit <20 MB | PASS | [package-manifest.json](package-manifest.json) |
| Testy po końcowym code review renderera: integralność, dokumentacja, EN/PL i collapse/render independence | PASS — 106, 0 FAIL | [final-targeted-results.json](final-targeted-results.json), [final-targeted-run.txt](final-targeted-run.txt) |
| Dedykowane ART V3 w Chromium, scenariusze i screenshoty | PASS — 48, 0 FAIL | [browser-results.json](browser-results.json) |
| Rzeczywisty fizyczny iPhone / Safari i notch w aplikacji CrazyGames | NOT RUN | W środowisku jest wyłącznie Chromium/emulacja |
| Odbiór estetyczny GPT/właścicielki | NOT VERIFIED | Materiał do odbioru poniżej |

Pełne bazowe testy + smoke + porównanie symulacji + paczka to **265 PASS, 0 FAIL**, z osobnym NOT RUN dla fizycznych safe areas. Ponowne 106 testów są re-testem po korektach rysowania, nie dodatkową pulą unikalnych funkcji. Finalne SHA-256 runtime zapisano w `final-targeted-results.json` i `browser-results.json`; wcześniejszy pełny przebieg ma własne oznaczenie wersji. Poprawki po tym pełnym przebiegu dotyczyły wyłącznie resetu alfa, wizualnego stanu tarczy, przywrócenia cieni/feedbacku i cache/przezroczystych marginesów w fazie rysowania.

Dedykowane rozdzielczości: **1920×1080**, **1366×768**, **390×844 DPR2 i DPR3**, **375×812 DPR2**, **844×390**. Potwierdzono obrazy Canvas/DOM, EN przy polskim locale, brak scrolla/przepełnienia HUD, tap/click/Space, 3 archetypy, stany modułów, rzeczywiste odcięcie grafu, shield-break, wynik sektora12→13, reload z zachowaniem save, nested Pages/iframe, reduced-motion oraz kontrolowany błąd PNG. Dodatkowo porównanie zoptymalizowanego blitu z pełnym rastrem dla bossa i drona na DPR1/2/3 dało maksymalną różnicę kanału 0 (te same widoczne piksele), a stress 15 rastrów bossów 2048 px potwierdził limit 48 MiB oraz zgodność licznika cache. Błąd zasobu w specjalnym teście jest celowo wstrzyknięty i opisany; normalne przebiegi mają zero błędów konsoli, brakujących zasobów i obcych hostów.

Istniejące ograniczenie NC-17: w niskich ramkach 800×450, 821×462 i 907×510 pole zajmuje ok.63–67% wysokości zamiast postulowanych70%; nie jest to nowa regresja. Wymagane testy czytelności/overflow/sterowania przechodzą. Nie przedstawiamy tego pomiaru jako spełnienia progu70%. Raport fizycznych safe areas pozostaje NOT RUN.

Końcowy pomiar wydajności: **PASS** dla obu DPR. DPR1: main 15,402 ms → V3 14,670 ms (**−4,75%**). DPR2: main 32,748 ms → V3 32,936 ms (**+0,57%**). Limit regresji 10% spełniony. Początkowy FAIL DPR2 (+64,21%) zachowano w [performance-initial-results.json](performance-initial-results.json); po nim poprawiono cache i pomijanie wyłącznie przezroczystych marginesów. Porównanie 60 dronów: [performance-results.json](performance-results.json). Metoda: identyczna nieruchoma scena sektora13, 1920×1080 DPR1 i DPR2, po60 dronów, rozgrzany cache, naprzemienne próby main/V3, wymuszony raster przez getImageData. Dotyczy cloud/headless Chromium; nie jest to wynik fizycznego telefonu ani pomiar rzeczywistego FPS gracza.

## Screenshoty uruchomionej gry

W repo zapisano **55 PNG** (53 z testu przeglądarkowego i 2 z pomiaru 60 dronów). Pełny indeks i rozróżnienie naturalnej rozgrywki od kontrolowanych stanów QA: [SCREENSHOTS_PL.md](SCREENSHOTS_PL.md).

- [Desktop — start](screenshots/1920x1080-dpr1-start.png), [gameplay](screenshots/1920x1080-dpr1-gameplay.png).
- [Desktop 1366×768 — gameplay](screenshots/1366x768-dpr1-gameplay.png).
- [Mobile portrait — start](screenshots/390x844-dpr2-start.png), [gameplay](screenshots/390x844-dpr2-gameplay.png), [375×812](screenshots/375x812-dpr2-gameplay.png), [DPR3](screenshots/390x844-dpr3-gameplay.png).
- [Mobile landscape — gameplay](screenshots/844x390-dpr1-gameplay.png).
- [Porównanie desktop/mobile](screenshots/comparison-desktop-mobile.png), [BEFORE/AFTER](screenshots/comparison-before-after.png).
- [Rzeczywisty renderer — graph-cut fixture](screenshots/fixture-neural-graph-cut-907x510.png), [wynik fixture](screenshots/fixture-victory-result-907x510.png).

Basic nie posiada osobnego menu ani przycisku restartu. Zgodnie z kontraktem V3 nie dodawano nowych funkcji: screenshoty `start` przedstawiają rzeczywisty ekran wejścia do gry, a restart oznacza istniejący reload z odtworzeniem save. Nie ma pozorowanych screenshotów menu. Sceny `fixture-*` korzystają z działającego Game/Block/SpriteAtlas w Chromium, lecz wymuszają stany na potrzeby kontroli; nie są dowodem naturalnego dojścia do sektora12.

## Ograniczenia i ryzyka

Nie stwierdzono nowego błędu krytycznego w wykonanym zakresie. [Niezależny review wizualny](VISUAL_REVIEW_PL.md) opisuje istotną różnicę względem konceptu: istniejące moduły Basic zasłaniają część centrum bossa. Nie przenoszono colliderów, aby uzyskać czystą sylwetkę z makiety. Trzy archetypy i obudowy V3 pozostają widoczne, a cele są czytelne. Ostateczna ocena tej kompozycji należy do GPT/właścicielki.

Nie testowano fizycznego iPhone’a ani produkcyjnego GitHub Pages po deployu. Sprawdzono lokalny serwer HTTP, zagnieżdżone ścieżki Pages, iframe i samodzielny zestaw HTML5. Zgodność z wizualną koncepcją nie jest deklarowana jako identyczność z makietą. Istniejące ograniczenia portalu/SDK, TM i inne ryzyka projektu opisane wcześniej w docs/RISKS.md nie są nowymi funkcjami tego pakietu.

Wszystkie screenshoty są dowodami z Chromium, nie wygenerowanymi obrazami. Nie zmieniono balansu, cen, progresji, fizyki, RNG ani formatu zapisów. Nie wykonano force-push, zmian bezpośrednio na main, merge ani produkcyjnego deployu.
