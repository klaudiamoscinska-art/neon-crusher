# KERNELFALL — pakiet Basic Launch / instrukcja odbioru

Baza: `c8542741296489324b7d235b682c7e5de78a9a42`, scalony PR #10.
Repo i adres Pages pozostają bez zmian. Bez merge, deploymentu i submission.

## Rozgrywka

Cel: zniszczyć główny rdzeń po sektorze 12. Dwanaście znaczników pod paskiem
integralności pokazuje sektory ukończone (cyjan), bieżący (bursztyn), pozostałe
(grafit). Po 12: AI CORE DESTROYED, potem AI NEUTRALIZED przez 4,5 s; gra
przechodzi bez blokowania do endless. `level >= 13` jest jedynym źródłem
informacji o ukończeniu. Nie dodano pól zapisu ani migracji.

NEURAL COLLAPSE: osobny skierowany graf zasilania, rysowany bursztynowymi
krawędziami; krytyczne początki czterech gałęzi mają obwódkę. Drony i OVERRIDE
niszczą rzeczywiste moduły. Zniszczenie rodzica odcina potomków (cyjan).
Erozja idzie po krawędziach od martwego rodzica, maksymalnie jeden moduł co
0,45 s, obrażenia min(6% maksymalnego HP, 2 × aktualna siła drona).
Odcięcie nigdy nie zabija rdzenia, nie płaci pieniędzy, nie wyzwala relay
shockwave i nie odnawia ładowania. Zwykłe trafienia i stary relay shockwave
zachowują swoje zasady. Osłona AI nadal wygasa, automat nadal atakuje.

Trzy deterministyczne archetypy zasilania cyklicznie w 12 sektorach:
firewall (łańcuchy; pojedyncze boczne pręty rdzenia), data-memory (banki,
rodzic spośród dwóch ostatnich modułów; podwójne pręty), neural core
(najbliższy dostawca w płacie; halo). Bazowe siatki/pierścienie i obrysy
kolizyjne pozostają zachowane. To warianty topologii i sylwetki, nie 12 map.

## Assety

Logo `assets/brand/wordmark-480.png` i mały edytowalny symbol SVG pochodzą
bez zmian z paczki KERNELFALL_CODEX_BASIC1. SVG zastosowano zamiast
niezatwierdzonego rastera 64 px. Makiet i ilustracji nie ma w runtime.
Zachowano zaakceptowane grafiki rdzenia, drona i węzła z aktualnego main
(PR #10), warstwy modułów, elektryczne pęknięcia i efekty Canvas.
Nie pobierano odrzuconych assetów z PR #9. Brak fontów, SDK i zależności runtime.

## Przygotowanie plików

Uruchom `node qa/package-basic.mjs`. Wynik:
- `qa/out/crazygames-html5/` — gotowe pliki HTML5 z `index.html` w korzeniu;
- `qa/out/kernelfall-basic.zip` — ten sam zestaw w archiwum;
- `qa/out/package-manifest.json` — bajty i SHA-256 każdego pliku oraz ZIP.

Do Developer Portal właścicielka wgrywa zawartość folderu wraz z podfolderami
lub ZIP, jeśli dany formularz go obsługuje. ZIP nie jest jedyną procedurą.
Nie wgrywać całego repo. Bez SDK i monetizacji w Basic Launch.
Przed submission sprawdzić aktualne zasady:
https://docs.crazygames.com/requirements/intro/
https://docs.crazygames.com/faq/

Preview: język EN i PL (`?lang=en`, `?lang=pl`), zakup i reload, stary save,
iframe i zagnieżdżona ścieżka, touch/mouse/Space, mute i reload, obrót telefonu,
brak przewijania, żądań zewnętrznych i błędów konsoli, sektor 12 → endless.
Prawdziwy iPhone, Chromebook 4 GB i portal wymagają osobnego wyniku właścicielki.

## Nazwa i konkurencja — 2026-11-10

Wyszukano KERNELFALL oraz Kernel Fall / Kernel-Fall, także w domenach
CrazyGames, Steam i itch.io. Brak potwierdzonego identycznego tytułu gry
w uzyskanych wynikach; podobna nazwa Kernel Hearts istnieje na Steam:
https://steamcommunity.com/app/2902170/
To nie jest potwierdzenie braku konfliktu ani gwarancja prawna.

EUIPO eSearch zwróciło 502, TMview pustą aplikację JS, WIPO CAPTCHA,
UPRP stronę wejściową. Pełne badanie znaków: NOT VERIFIED. Przed submission
należy sprawdzić dokładną nazwę oraz podobieństwa fonetyczne i graficzne,
w odpowiednich klasach, w EUIPO/TMview, UPRP i WIPO; zachować datowane wyniki.
https://www.tmdn.org/tmview/
https://branddb.wipo.int/
https://euipo.europa.eu/eSearch/
https://ewyszukiwarka.pue.uprp.gov.pl/

Idle Breakout: wspólne odbijające kule i zakup siły. KERNELFALL dodaje
celowany OVERRIDE, rdzeń, reaktywną osłonę i kaskadę po grafie zasilania.
Neon Core Breaker: wspólna neonowa oprawa i niszczenie struktur; wyróżnikiem
ma być zależność od topologii i cel 12 sektorów. Porównanie rzeczywistej
rozgrywki konkurentów pozostaje NOT VERIFIED; nie deklarujemy 100% oryginalności.

## Materiały promocyjne

Zgodnie z instrukcją paczki finalne okładki i klipy powstają **po zatwierdzeniu
nazwy i gameplayu** przez GPT i właścicielkę. Ten warunek nie został jeszcze
spełniony. Status: NOT RUN (etap po odbiorze), nie gotowe materiały do submission.

Po zatwierdzeniu: cover 1920×1080, 800×1200, 800×800; tylko tytuł, bez obcych
logo. Z działającej gałęzi nagrać 18 s: automatyczny atak → celowany OVERRIDE
na gałąź → rozpad → rdzeń; 1920×1080 i 800×1200, bez audio. Nagrywać prawdziwy
Canvas (Playwright recordVideo lub OBS), bez ilustracji zamiast gameplayu.
Zweryfikować `ffprobe`: 15–20 s, 16:9 / 2:3, brak strumienia audio.
