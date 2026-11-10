# Game design — Neon Crusher

How the game works **today** (code after NC-ORIGINAL-1) and the principles for
changing it. Statuses: `IMPLEMENTED` (in code and checked by `qa/`),
`PARTIAL`, `NOT IMPLEMENTED`, `NOT VERIFIED` (in code, no evidence yet).
Change this file together with any gameplay/balance/text change.

## Identity

Physics-sandbox idle game, cyberpunk neon, about **breaching a core**.
Turrets auto-fire balls that bounce around the canvas and chip an armoured
block core; every hit pays cash; cash buys upgrades. The twist
(NC-ORIGINAL-1): every core hides a **heart** under its armour, and the
player aims the turrets' synchronised **volley** of piercing lances to open a
way to it. Breaking the heart shatters the whole core and levels up. One
screen, no menus. Target portal: CrazyGames (`docs/CRAZYGAMES.md`).

## Breach (NC-ORIGINAL-1) — the core mechanic

| Element | Status | Rule / numbers |
|---|---|---|
| Heart | IMPLEMENTED | one per core at its centre, HP = 6 × the level's block HP; odd grid: replaces the centre block; even grid: one 2×2-cell heart replaces the 4 central blocks; ring levels: a heart 1.4 × block size inside the ring(s). Drawn as the fracture sigil ("Visual identity") |
| Relays | IMPLEMENTED | 0 on level 1, then min(1 + ⌊(L−2)/3⌋, 4) random armour blocks, drawn as amber hexagonal capacitors with a conduit to the heart. Destroyed → +4 × money per hit, **volley recharged at once**, shockwave (radius 1.6 block steps) dealing 6 × ball damage to every block it reaches (chains through relays) |
| Volley | IMPLEMENTED | charge time = max(2, 11 × 0.9^(lvl−1)) s (upgrade "Volley charge"); a fresh session starts at 70 % (first volley after ~3.3 s). When ready, a click/tap on the field (or Space = core centre) makes **every turret** fire a lance through that point to the field edge. Lance power = 8 × ball damage; blocks along the line (box + 3 units, so no gap is a hole) absorb it nearest first, each damaged block pays one hit; the lance stops where the power runs out. Input is queued and resolved on the next fixed step (refresh-rate independent) |
| Autopilot | IMPLEMENTED | a ready volley not fired within 5 s fires by itself at a random armour block (never the heart or a relay): idle play progresses, aiming is clearly better |
| Shatter | IMPLEMENTED | heart destroyed → +6 × money per hit, every other block breaks in a wave from the centre (240 units/s), each paying 1 hit; flash, shake (reduced-motion aware), volley recharged; the level advances when the wave ends |
| Choices | — | where to aim (the heart's shortest armour line, or a relay for an instant recharge and a shockwave), when to spend a charge, and the upgrade mix (balls = steady chip, charge = more volleys, hit power = stronger balls **and** lances) |

Feedback (look: "Visual identity"): magenta lances, rings (shockwave,
"not ready" tap), relay surge arcs to the turrets, breach finale,
`RECHARGED +$n` / `CORE SHATTERED +$n` labels on a graphite backing (above
/ below the core), `LEVEL n` banner, turret capacitors fill while
charging and spark when ready, lock-on brackets on the heart when ready
(plus dashed lines from the turrets until the first hand-aimed volley), aim
preview (dashed lines + reticle) when a mouse hovers a ready field, volley
meter top-right ("Volley n%" → "VOLLEY READY"), crosshair cursor when ready.

## Visual identity (NC-ART-1) — "Fractured Intelligence"

Art direction (working name; the game's title stays **Neon Crusher**): a
rogue AI has taken over a vast digital infrastructure; the player runs an
emergency breach system that breaks its defences layer by layer to reach its
prime module. The enemy is not a robot but a distributed digital organism:
its structure, links, reactions to damage and loss of integrity are visible.
No dialogue, characters or story screens — the story is told by the look of
play. The lattice is a picture of the real structure (which blocks touch,
where the heart is), never a new mechanic. All art is procedural Canvas 2D /
inline SVG made in this repo; no imported assets or fonts. Colours carry
meaning (`COLORS` in `game.js`, same tokens in `style.css`):

| Colour | Meaning |
|---|---|
| graphite / violet-graphite (`#07070d`–`#3a4463`) | the AI's material: armour slabs, panels, background |
| cyan `#00f3ff` / ice `#9ff8ff` | outer armour circuits and lattice, the player's balls, turret pads and rails |
| violet `#a46bff` | the inner shield (armour layer touching the heart) |
| amber `#ffc400` | the AI's energy: the heart (prime module), relays, power pipes, axons, core meter |
| magenta `#ff2bb0` | the player's breach: turret capacitors and charge rings, lances, aim reticle, lock-on, volley meter, cracks, shatter front |
| green `#39ff14` | money only (`+$n`, cash, costs) |
| white | impacts, hot cores, crack cores (sparingly) |

Visual references: three concept images from the owner (2026-11-09,
not in the repo) set mood and quality — faceted slabs, an amber crystal
core, amber pipes, magenta beams, an arena bezel. Used as inspiration only;
forms are redrawn as this game's own Canvas 2D shapes.

| Element | Look |
|---|---|
| Background | the AI's wider infrastructure, calmer than everything interactive: violet-graphite with a soft light behind the core, a sparse dot field fading outward, 16 dark circuit routes running in from the edges (one 45° bend, a pad), two containment rings with ticks, a slow scanning arc, a chamfered arena bezel with dim light strips; no neon grid; cached once per canvas size |
| Neural lattice | links between every block's node and its direct neighbours (cyan) and amber axons from the innermost blocks into the heart; signal pulses run inward on half the links. Reacts: a hit lights the struck block's links white; pulses speed up and links brighten as the core loses HP; a link to a destroyed block is cut to a sparking stub; links ahead of the shatter wave flicker white |
| Armour | faceted graphite slabs: dark sides, a raised top face nudged up-left (the bottom-right wall shows) with a lit bevel and a honeycomb cell texture; corners cut, the corner facing away from the heart cut deeper (the core reads as scales radiating from its centre); circuit node + one of three slot patterns; dim outline + bright lit rim on the outward side; layer colour (cyan outer, violet inner shield on cores with ≥ 2 layers); damage: 4 stages, magenta cracks with white cores grow (1–3), rim dims, last stage flickers; hit = white rim; broken = four shards flying apart; shatter pending = white rim |
| Heart (prime module, fracture sigil) | amber octagonal housing; a seal of six rotating segments, one falls away per sixth of HP; a faceted amber crystal (light upper, deep lower facets) split in two halves around a seam of light with three data cells — the halves part and the cells brighten as HP drops (closed = full, wide open = about to break). Deliberately a geometric sign: no eye, face or skull |
| Relays | hexagonal amber capacitor in a dark housing, pulsing cell, three terminals; an amber power pipe (axis run + one 45° run, energy flowing) into the heart; zigzag link to every relay inside its shockwave radius (chain visible before it happens); overload at damage stage ≥ 2 (arcs crawl over the shell); destroyed → amber surge arcs to every turret (the recharge) |
| Turrets ("fork emitter") | round pad with a cyan rim, hexagonal base, two rails aimed at the core, magenta capacitor between the rails filling with the volley charge, four-segment magenta charge ring; ready: full capacitor, spark between the rail tips, pulsing ring; fire: white muzzle flash |
| Volley | a synchronised breach: a dashed magenta line ties the turrets together for 0.33 s, every turret fires a magenta lance with a white core that, as it fades, splits into a cyan and an amber ghost ("signal fracture"); X mark where it stops |
| Balls | motion trail, soft halo, cyan/ice rim, white-hot centre (brightest small objects on the field) |
| Sparks | streaks along their velocity, in the hit block's colour |
| Breach finale (loss of integrity) | the seal implodes (0.2 s), the crystal's halves fly apart, ten jagged amber fracture lines (the AI's energy escaping) race outward, a magenta front at the exact radius of the shatter wave; the lattice flickers and is cut as plates split into shards; magenta-white veil (single, gentle). Event labels (`RECHARGED`, `CORE SHATTERED`) sit above / below the core, never over the heart |
| New core | plates appear outward from the heart in 0.45 s (drawing only; solid from the first step) |
| HUD on canvas | segmented slanted bars: core (amber), volley (magenta) |
| DOM HUD / shop | violet-graphite panels; brand mark = the heart sigil; volley hint magenta; upgrades wear the colour of what they power (balls cyan, volley charge magenta, hit power amber — it cracks the amber heart) with corner tabs and a line icon (hidden below 640 px); sizes unchanged |

`prefers-reduced-motion`: no shake, no assembly animation, static seal,
sigil pulse, scanning arc, conduit flow and sparks; flash much weaker.
Nothing flashes faster than 3 Hz over a large area.

## Core loop

| Element | Status | Rule / numbers |
|---|---|---|
| Auto-fire | IMPLEMENTED | each turret fires one ball every `fireInterval` ms while `balls < maxBalls`; turrets **aim at the core** (NC-CORE-1A: every new ball starts with a hit); ball speed 230–280 units/s, radius 5, spawn up to 22 units ahead but outside the core's box, ±0.5 rad spread |
| Bounces | IMPLEMENTED | exact reflection on blocks (only when the ball approaches the face), ±0.12 rad jitter on walls, constant speed; a ball caught inside the core (new level, resize) is moved out without a hit |
| Simulation | IMPLEMENTED (NC-PHYS-1) | fixed 1/240 s steps: the same game at 60/144/165 Hz; below 20 FPS the game slows down |
| Auto-fire refill | IMPLEMENTED (NC-ORIGINAL-1) | a turret adds a ball every 700 ms while `balls < maxBalls` (fixed; was the fire-rate upgrade) |
| Hit | IMPLEMENTED | +`moneyPerHit` cash, −`damageLevel` HP, spark burst (6), destruction burst (18) |
| Level-up | IMPLEMENTED | all blocks destroyed (by hits or by the shatter wave) → level+1, new core; balls stay |
| Player input | IMPLEMENTED (NC-ORIGINAL-1) | shop buttons; click/tap on the field aims the volley; Space = volley at the core centre; M = sound on/off (no Esc, layout-independent `code`) |
| Balls despawn | NOT IMPLEMENTED | balls live forever (consequence: NC-10) |

## Levels (`qa/levels.mjs`)

| Rule | Status |
|---|---|
| Odd level → grid N×N, N = min(3 + ⌊(L−1)/2⌋, 7); block size from the canvas' short side, clamped 16–36 px, gap 5 | IMPLEMENTED |
| Even level → ring(s) of blocks, size 18–28 px; two rings from level 5 | IMPLEMENTED |
| Block HP = round(10 × 1.5^(L−1)); money per hit = max(1, round(1.5^(L−1))); heart and relays: see "Breach" | IMPLEMENTED |
| Turrets = min(1 + ⌊(L−1)/3⌋, 4) at N, E, S, W, at core extent + 44 px, at most min(w,h)/2 − 20 from the centre | IMPLEMENTED |
| Core fits the canvas: when turrets would come closer than 20 units to the core (with the world scale: from level 8 on every canvas, as before on 800×450) the whole core is scaled down — same shape, block count and HP; re-fitted on every resize, restored to its generated size when there is room again | IMPLEMENTED (NC-PHYS-1) |
| Colours cycle cyan / pink / green | IMPLEMENTED |
| **World scale** (NC-09): positions and sizes are world units; a canvas whose short side exceeds 250 px shows a 250-unit-high world enlarged by short/250 (same aspect), smaller canvases are drawn 1:1. The core therefore takes ~47 % of the field height at every CrazyGames size and the hit rate no longer falls on big screens. All level rules above (16–36, 0.55, 0.045, +44, −20) are in world units | IMPLEMENTED (NC-CORE-1A) |

## Economy (`qa/economy.mjs`)

| Upgrade | Cost | Effect | Status |
|---|---|---|---|
| New ball | ⌈10 × 1.5^(maxBalls−1)⌉ | `maxBalls` +1 (a cap the turrets refill to) | IMPLEMENTED |
| Volley charge (was Fire rate; saved as `fireRateLevel`) | ⌈15 × 1.5^(lvl−1)⌉ | volley charge time = max(2, 11 × 0.9^(lvl−1)) s; shop shows "Lvl n · s s" | IMPLEMENTED (NC-10 closed) |
| Hit power | ⌈15 × 1.5^(lvl−1)⌉ | ball damage = level (linear), applies to balls in flight; lance power 8 × and shockwave 6 × ball damage | IMPLEMENTED |

Prices, block HP and money per hit are unchanged. New income (NC-ORIGINAL-1):
one hit per block a lance or shockwave damages, relay bonus 4 ×, heart bonus
6 ×, 1 hit per shattered block. Lance and shockwave are linear in ball damage
on purpose: a first version scaled them with block HP and a greedy bot
reached level 221 in 10 minutes (the ×1.5 HP wall disappeared).

Measured pace (bots, simulated, not players; `qa/pace.mjs`, numbers in the
NC-ORIGINAL-1 PR): first purchase with no input (autopilot only) median
19–25 s on the four CrazyGames canvases (8 seeds); with NC-CORE-1A it was
20.5–29.5 s. Greedy buyer, 907×339, median level at 1/3/5/10 min: passive
(never touches the field) and active (aims every volley at the heart) — see
the PR table; base before NC-ORIGINAL-1: 1/3/5/9. Design targets: first
purchase 15–45 s and median < 60 s on every size; active play clearly ahead
of passive (`qa/economy.mjs` pins all three).

| Feature | Status |
|---|---|
| Offline / idle earnings while away | NOT IMPLEMENTED |
| Prestige / rebirth | NOT IMPLEMENTED |
| Goals, achievements, milestones beyond the level | NOT IMPLEMENTED |
| Active interaction (tap/click on the field) | IMPLEMENTED (NC-ORIGINAL-1: aimed volley) |

## Presentation

| Element | Status |
|---|---|
| Neon glow on every shape (`shadowBlur`, or a translucent underlay/halo where a batched blur is too costly: balls, plate rims) | IMPLEMENTED (NC-ART-1; cost: NC-13) |
| Particles (pool of 400), drawn as streaks | IMPLEMENTED |
| HUD: cash (number format of the UI language), level | IMPLEMENTED |
| English UI (default and fallback) + Polish UI; language from `?lang=en/pl`, else the browser's preferred languages | IMPLEMENTED (NC-BASIC-1); CrazyGames SDK locale: Full Launch |
| Audio | IMPLEMENTED (NC-ORIGINAL-1): synthesised Web Audio, no files — hit (min gap 70 ms), break, volley, ready, relay, shatter, buy, "not ready", level-up; master gain 0.5; AudioContext created/resumed only in a user gesture, suspended when the tab hides; sound toggle (♪ button in the top bar, M key) persisted under `neonCrusher.audio.v1`; listened to by a person: NOT VERIFIED |
| Onboarding / hint | IMPLEMENTED (NC-CORE-1A, NC-ORIGINAL-1): a pill over the bottom of the field (`pointer-events: none`). Every player, while a volley is ready and until their first hand-aimed volley of the session: "Click or tap the core to fire a volley" / "Kliknij lub dotknij rdzeń, by oddać salwę" (amber, pulsing). Fresh save (level 1, no upgrade) otherwise: "Hits pay cash · break the heart to shatter the core" / "Trafienia dają kasę · rozbij serce, by skruszyć rdzeń", then "Buy a new ball!" with the pulsing button; gone after the first purchase; nothing stored |
| Purchase feedback: one-shot button flash + sound; Hit power also flashes every ball white | IMPLEMENTED (NC-ORIGINAL-1) |
| Hit feedback: `+$n` label at the hit (money format of the UI language), rises and fades in 0.8 s; at most 10 at once; 12 px on screen (up to 18 px on big screens) | IMPLEMENTED (NC-CORE-1A) |
| Core progress: "Core n%" / "Rdzeń n%" + bar (destroyed HP ÷ core HP) in the field's top-left corner, CSS pixels | IMPLEMENTED (NC-CORE-1A) |
| Responsive layout (phone/desktop), safe areas (all sides), no text selection | IMPLEMENTED; smallest text 11.2 px at DPR 1; canvas share at 800×450 still 62 % (NC-17); notched device NOT VERIFIED |
| Save across reloads | IMPLEMENTED (`docs/SAVE.md`) |

## Design principles (for every future change)

1. **Fun in the first minute.** A new player must see a purchase and a visible
   power jump within ~60 s (CrazyGames counts a conversion at 1 min of play).
2. **Readable cause → effect.** Every upgrade must change something the player
   can see within seconds; an upgrade without visible effect is a bug (NC-10).
3. **Physics is the toy.** Exact, deterministic-feeling bounces; spectacle
   from physics and particles, not from text.
4. **Honest idle.** No energy, no timers in front of play, no paywall; ads
   (Full Launch only) never gate the core loop (`docs/CRAZYGAMES.md`).
5. **Originality.** The bouncing-balls-vs-bricks idle loop is an established
   genre; Neon Crusher's twist is the breach (aimed multi-turret volleys,
   heart, relays, shatter). Compared in words only with Idle Breakout (click
   breaks a brick; ball types, skill tree, prestige) and Neon Core Breaker
   (a click guides the ball), 2026-11-09; NC-12 stays open for the name.
   NC-ART-1 adds a visual identity built to differ from both (no HP numbers
   on blocks, scale-plate armour, heart sigil, relay conduits, fork turrets);
   the visual comparison could only use text sources (NOT VERIFIED, NC-12).
6. **Small and fast.** Zero external requests, tiny build, smooth on a 4 GB
   Chromebook and on phones.
7. **Progress is sacred.** Never reset or corrupt a player's save
   (`docs/SAVE.md`).

## Decisions log

Owner decisions that change this file are recorded here with a date.

- 2026-11-10 (NC-ART-ASSETS-INTEGRATION-1, PR pending GPT review + owner approval): the owner's candidate sprite pack NC-ART-ASSETS-1 (27 sprites, 2 backgrounds) was tried inside the running game and dropped for runtime — none clearly improved readability at 20–50 px (heart, turrets, armour, balls, icons became darker or less legible; relays lost brightness). The visual identity above stays procedural. Evidence and the MODIFY options: `docs/art/nc-art-assets-1/README.md`. No runtime change.

- 2026-11-09 (NC-ART-1, PR pending GPT review + owner approval; the stage prompt set the direction "Neon Breach — Signal Fracture", refined by the owner the same day to "Fractured Intelligence" (rogue AI, title unchanged), and the palette graphite/cyan/magenta/amber, green as an accent): visual identity above; drawing, colours, HUD/shop styling only. Simulation bit-identical to the base (same seeds, same inputs: `qa/sim-compare.mjs`); no change to mechanics, numbers, save, text or layout sizes.
- 2026-11-09 (NC-FOUNDATION-1): baseline documented; no gameplay change.
- 2026-11-09 (NC-ORIGINAL-1, PR pending GPT review + owner approval; the stage prompt authorised the concept choice and balance tuning): breach mechanic (heart, relays, aimed volley, autopilot, shatter), Fire rate → Volley charge (NC-10), ball refill fixed 700 ms, new income sources (above), audio + sound toggle, first-purchase target 20–45 s → 15–45 s. Prices, block HP, money per hit and the save format unchanged.
- 2026-11-09 (NC-CORE-1A, merged PR #6 with scale 250): first minute — world scale 250 (NC-09), turrets aim at the core, core progress bar, `+$n` labels, first-minute hint; no price, reward, HP or save change. Alternative for the owner: world scale 280 (800×450 unchanged 1:1, slower mid-game). Active-play twist (NC-10/11/12) proposed, not implemented.
- 2026-11-09 (NC-BASIC-1, fast track to Basic Launch): English UI added (Polish kept), save validation + backup; no gameplay, balance or canvas-size change. UI copy: Cash/Kasa, Level/Poziom, Buy new ball/Kup nową kulę, Balls: n/Kulki: n, Fire rate/Szybkość strzału, Hit power/Siła uderzenia, Lvl n.
