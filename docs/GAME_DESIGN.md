# Game design — Neon Crusher

How the game works **today** (code after NC-AI-RECOVERY-1) and the principles for
changing it. Statuses: `IMPLEMENTED` (in code and checked by `qa/`),
`PARTIAL`, `NOT IMPLEMENTED`, `NOT VERIFIED` (in code, no evidence yet).
Change this file together with any gameplay/balance/text change.

## Identity

**Active idle about recovering a network taken over by a rogue AI**
(owner decision, NC-AI-RECOVERY-1). The player's autonomous **recovery
drones** (the balls) bounce around the canvas and break the AI's hardware
tiles (the core blocks); every hit pays cash; cash buys upgrades. Each
sector hides the **AI core** under its tiles; the player's **uplinks** (the
turrets) charge a synchronised **override** pulse the player aims at the
structure. The AI **reacts**: from sector 3 it reroutes power to shield its
core, and a breakable **firewall node** shows where to strike. Breaking the
core **recovers the sector** (it turns cyan and the next sector begins). The
story is told by play only: no dialogue, characters or story screens. One
screen, no menus. Title stays **Neon Crusher** until NC-ID-1. Target
portal: CrazyGames (`docs/CRAZYGAMES.md`).

Names in the UI (EN / PL): drones / drony, override / przejęcie, breach power
/ siła przełamania, sector / sektor, recovered / odzyskano, AI shield / osłona
AI, core exposed / rdzeń odsłonięty. Code names stay (`balls`, `volley`,
`heart`, `level`) so saves and tests keep their meaning.

## Breach (NC-ORIGINAL-1) — the core mechanic (now "override" in the UI)

| Element | Status | Rule / numbers |
|---|---|---|
| Heart | IMPLEMENTED | one per core at its centre, HP = 6 × the level's block HP; odd grid: replaces the centre block; even grid: one 2×2-cell heart replaces the 4 central blocks; ring levels: a heart 1.4 × block size inside the ring(s). Drawn as the AI core die ("Visual identity"); shielded by the AI from sector 3 ("Adaptive defense") |
| Relays | IMPLEMENTED | 0 on level 1, then min(1 + ⌊(L−2)/3⌋, 4) random armour blocks, drawn as amber hexagonal capacitors with a conduit to the heart. Destroyed → +4 × money per hit, **volley recharged at once**, shockwave (radius 1.6 block steps) dealing 6 × ball damage to every block it reaches (chains through relays) |
| Volley | IMPLEMENTED | charge time = max(2, 11 × 0.9^(lvl−1)) s (upgrade "Volley charge"); a fresh session starts at 70 % (first volley after ~3.3 s). When ready, a click/tap on the field (or Space = core centre) makes **every turret** fire a lance through that point to the field edge. Lance power = 8 × ball damage; blocks along the line (box + 3 units, so no gap is a hole) absorb it nearest first, each damaged block pays one hit; the lance stops where the power runs out. Input is queued and resolved on the next fixed step (refresh-rate independent) |
| Autopilot | IMPLEMENTED | a ready volley not fired within 5 s fires by itself at a random armour block (never the heart or a relay) — or, while the AI's shield is up, at its firewall node (NC-AI-RECOVERY-1): idle play progresses, aiming is clearly better |
| Shatter | IMPLEMENTED | heart destroyed → +6 × money per hit, every other block breaks in a wave from the centre (240 units/s), each paying 1 hit; flash, shake (reduced-motion aware), volley recharged; the level advances when the wave ends |
| Choices | — | where to aim (the heart's shortest armour line, or a relay for an instant recharge and a shockwave), when to spend a charge, and the upgrade mix (balls = steady chip, charge = more volleys, hit power = stronger balls **and** lances) |

Feedback (look: "Visual identity"): magenta pulses, rings (shockwave,
"not ready" tap), cyan relay-capture arcs to the uplinks, recovery finale,
`RELAY CAPTURED +$n` / `SHIELD BROKEN +$n` / `SECTOR RECOVERED +$n` /
`SECTOR n` toasts (HUD left column, see "Presentation"), one `+$n` per
pulse at its aim point, uplink capacitors fill while
charging and spark when ready, lock-on brackets on the heart when ready
(plus dashed lines from the turrets until the first hand-aimed volley), aim
preview (dashed lines + reticle) when a mouse hovers a ready field, volley
meter top-right ("Override n%" → "OVERRIDE READY"), crosshair cursor when ready.

## Adaptive defense (NC-AI-RECOVERY-1) — the AI reacts

One light, deterministic reaction of the rogue AI (`Game.updateDefense`).
Tests: `qa/recovery.mjs`; pace: `qa/idle-balance.mjs`.

| Element | Status | Rule / numbers |
|---|---|---|
| Start | IMPLEMENTED | sectors 1–2: none (sector 1 teaches drones + core, sector 2 relays). From sector 3: first shield 8 s after the sector starts |
| Reroute | IMPLEMENTED | the AI picks a **firewall node**: an alive armour tile that some uplink hits first on its line (nothing in front of it), chosen by `hash01(sector, reroute count)` — no simulation RNG. An amber power line runs from the node into the core, an amber hexagonal **shield** surrounds the core, the node shows an amber lock and magenta target brackets (breakable). HUD: "AI SHIELD n s" + draining bar; hint until the player's first own break |
| Shield | IMPLEMENTED | the core takes **× 0.5** damage from every source; lasts **7 s** at most, then ends by itself; never restores HP, never takes cash, never changes the sector |
| Break | IMPLEMENTED | the node is an ordinary tile with its normal HP; destroyed by anything (drone, override pulse, shockwave, autopilot) → shield collapses at once, **+3 × money per hit**, and the core plus every tile on the power line are **exposed for 5 s**: × 2.5 damage from override pulses and shockwaves (drones keep × 1). Broken by the **player's own pulse** → also **+50 % override charge** (the rerouted power spills into the uplinks). A pulse that breaks the node keeps going through the exposed line |
| Rhythm | IMPLEMENTED | next shield 10 s after the previous one ended (after the exposure when it was broken); no shield while exposed or while the sector is being recovered; no node possible → retry in 2 s |
| Autopilot | IMPLEMENTED | an unused pulse (5 s) goes to the firewall node while a shield is up (the autonomous units answer the AI by themselves), otherwise to a random armour tile as before |
| Choice | — | break the node first (one pulse, refund, exposed core) or spend the pulse on the core / a relay; idle players are never blocked (shield ends by itself, drones and the autopilot break nodes too) |

Not added (deliberately): a behaviour engine, HP regeneration, extra
currencies, timers in front of play. Session-only state: nothing is saved
(`docs/SAVE.md`).

## Visual identity (NC-AI-RECOVERY-1) — "Network Recovery", stylized 2.5D

Replaces NC-ART-1 "Fractured Intelligence" (its technique stays: batched
Canvas 2D passes, cached background, no `Math.random` in drawing). Premium
arcade sci-fi in a **true top-down view**: every object stands on the
network floor with a floor shadow offset down-right and visible side walls
(light from the top-left), but its top-down footprint is **exactly its
collision box** (closes NC-21). All art is procedural Canvas 2D / inline SVG
made in this repo; no imported assets, sprites or fonts (the rejected
NC-ART-ASSETS-1 sprites of PR #9 are not used). Built for 16–50 px objects:
strong silhouettes, few colours, light from one side, glow only on small
shapes. Colours carry meaning (`COLORS` in `game.js`, tokens in `style.css`):

| Colour | Meaning |
|---|---|
| gunmetal (`#10131d` sides, `#262d42` tops, `#56628a` bevel light) | the network's hardware |
| red `#ff3b4e` / ember `#ff7a2a` | the rogue AI: corrupted circuits of its outer / inner tiles, its lattice, its core |
| amber `#ffc400` | the AI's power: relays, power pipes, the shield and its power line, the firewall node's lock |
| cyan `#00f3ff` / ice | the player: recovery drones, uplink pads, cracks where recovery breaks in, recovered cells, the recovery finale, sector progress |
| magenta `#ff2bb0` | the player's override: pulses, uplink capacitors, aim, target brackets on breakable things, exposure |
| green `#39ff14` | money only |
| white | impacts, hot cores |

Element-by-element look (floor, tiles, lattice, AI core, relays, shield,
uplinks, pulse, drones, finale, HUD), reduced motion: `docs/VISUAL_IDENTITY.md`.

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
| Tile colours by meaning: outer layer red, inner layer (next to the core, cores with ≥ 2 layers) ember, relays amber, core red ("Visual identity") | IMPLEMENTED (NC-AI-RECOVERY-1) |
| **World scale** (NC-09): positions and sizes are world units; a canvas whose short side exceeds 250 px shows a 250-unit-high world enlarged by short/250 (same aspect), smaller canvases are drawn 1:1. The core therefore takes ~47 % of the field height at every CrazyGames size and the hit rate no longer falls on big screens. All level rules above (16–36, 0.55, 0.045, +44, −20) are in world units | IMPLEMENTED (NC-CORE-1A) |

## Economy (`qa/economy.mjs`)

| Upgrade | Cost | Effect | Status |
|---|---|---|---|
| New ball | ⌈10 × 1.5^(maxBalls−1)⌉ | `maxBalls` +1 (a cap the turrets refill to) | IMPLEMENTED |
| Volley charge (was Fire rate; saved as `fireRateLevel`) | ⌈15 × 1.5^(lvl−1)⌉ | volley charge time = max(2, 11 × 0.9^(lvl−1)) s; shop shows "Lvl n · s s" | IMPLEMENTED (NC-10 closed) |
| Hit power | ⌈15 × 1.5^(lvl−1)⌉ | ball damage = level (linear), applies to balls in flight; lance power 8 × and shockwave 6 × ball damage | IMPLEMENTED |

Prices, block HP and money per hit are unchanged (also in NC-AI-RECOVERY-1,
whose only new income is the firewall-node bonus, 3 × money per hit, see
"Adaptive defense"). New income (NC-ORIGINAL-1):
one hit per block a lance or shockwave damages, relay bonus 4 ×, heart bonus
6 ×, 1 hit per shattered block. Lance and shockwave are linear in ball damage
on purpose: a first version scaled them with block HP and a greedy bot
reached level 221 in 10 minutes (the ×1.5 HP wall disappeared).

Measured pace (bots, simulated, not players; `qa/pace.mjs`; tables in the
NC-ORIGINAL-1 and NC-AI-RECOVERY-1 PRs). Design targets: first purchase
15–45 s and median < 60 s on every size; active play clearly ahead of
passive (`qa/economy.mjs` pins all three).

NC-AI-RECOVERY-1 (`qa/idle-balance.mjs` vs `main`, PR table): passive
pace within 10 % of the base; breaking nodes beats passive play and play
that ignores shields (`qa/recovery.mjs` pins it).

| Feature | Status |
|---|---|
| Offline / idle earnings while away | NOT IMPLEMENTED |
| Prestige / rebirth | NOT IMPLEMENTED |
| Goals, achievements, milestones beyond the level | NOT IMPLEMENTED |
| Active interaction (tap/click on the field) | IMPLEMENTED (NC-ORIGINAL-1: aimed volley) |

## Presentation

| Element | Status |
|---|---|
| Glow on small shapes (`shadowBlur`), a translucent underlay/halo where a batched blur is too costly (drones, tile edges, the AI shield) | IMPLEMENTED (NC-ART-1, NC-AI-RECOVERY-1; cost: NC-13) |
| Particles (pool of 400), drawn as streaks | IMPLEMENTED |
| HUD: cash (number format of the UI language), sector | IMPLEMENTED |
| English UI (default and fallback) + Polish UI; language from `?lang=en/pl`, else the browser's preferred languages | IMPLEMENTED (NC-BASIC-1); CrazyGames SDK locale: Full Launch |
| Audio | IMPLEMENTED (NC-ORIGINAL-1): synthesised Web Audio, no files — hit (min gap 70 ms), break, volley, ready, relay, shatter, buy, "not ready", level-up; master gain 0.5; AudioContext created/resumed only in a user gesture, suspended when the tab hides; sound toggle (♪ button in the top bar, M key) persisted under `neonCrusher.audio.v1`; listened to by a person: NOT VERIFIED |
| Onboarding / hint | IMPLEMENTED (NC-CORE-1A, NC-ORIGINAL-1, NC-AI-RECOVERY-1): a pill over the bottom of the field (`pointer-events: none`). Priority: (1) while an override is ready, until the first hand-aimed one of the session: "Click or tap the core to fire an override" / "Kliknij lub dotknij rdzeń — impuls przejęcia" (magenta, pulsing); (2) while an AI shield is up, until the player breaks a node with their own pulse: "AI shield up · hit the marked node to break it" / "Osłona AI · traf oznaczony węzeł, by ją przełamać" (amber); (3) fresh save (level 1, no upgrade): "Drones break the AI's defences · reach its core" / "Drony łamią zabezpieczenia AI · dotrzyj do rdzenia", then "Deploy a new drone!" / "Wyślij nowego drona!" with the pulsing button; gone after the first purchase; nothing stored |
| Purchase feedback: one-shot button flash + sound; Hit power also flashes every ball white | IMPLEMENTED (NC-ORIGINAL-1) |
| Hit feedback: `+$n` label at the hit (money format of the UI language), rises and fades in 0.8 s; at most 10 at once; 12 px on screen (up to 18 px on big screens) | IMPLEMENTED (NC-CORE-1A) |
| Sector progress: "Recovered n%" / "Odzyskano n%" + cyan bar (destroyed HP ÷ core HP) in the field's top-left corner, CSS pixels; the arena light strips shift from red to cyan with it | IMPLEMENTED (NC-CORE-1A, NC-AI-RECOVERY-1) |
| AI alert: "AI SHIELD n s" / "OSŁONA AI n s" (amber) or "CORE EXPOSED n s" / "RDZEŃ ODSŁONIĘTY n s" (magenta) + draining bar, right column under the override meter | IMPLEMENTED (NC-AI-RECOVERY-1) |
| HUD safe areas (R2, `Game.hudLayout`): text only in the two top corners (an uplink sits at top centre, the core in the middle). Left: recovery meter, then up to 3 event toasts (newest last, 1.6–1.8 s). Right: override meter, then the AI alert. Toasts shrink to fit 42 % of the field. The DOM hint moves to the bottom-left corner in landscape once a bottom uplink exists. Never overlapping each other or the core / node / relays / uplinks: `qa/recovery.mjs` (EN + PL, 8 sizes, sectors 3–14) | IMPLEMENTED (NC-AI-RECOVERY-1 R2) |
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
   NC-AI-RECOVERY-1 moves the theme into play: an opponent that reacts
   (shield, firewall node, exposure), recovery instead of destruction,
   2.5D hardware tiles, a processor-die AI core. Still similar: bouncing
   balls breaking a block cluster for cash upgrades (the genre), neon look.
6. **Small and fast.** Zero external requests, tiny build, smooth on a 4 GB
   Chromebook and on phones.
7. **Progress is sacred.** Never reset or corrupt a player's save
   (`docs/SAVE.md`).

## Decisions log

Owner decisions that change this file are recorded here with a date.

- 2026-11-10 (NC-AI-RECOVERY-1, owner-approved stage prompt; PR pending GPT review + owner approval): direction change to **active idle about recovering a network from a rogue AI**. Adaptive defense (shield, firewall node, exposure, autopilot answer), UI names (drones, override, sector, recovered), new visual identity "Network Recovery" (stylized 2.5D, true top-down, footprints = collision boxes; NC-21 closed), EN + PL texts. Prices, block HP, money per hit, level count/shapes and the save format unchanged; new income only the node bonus (3 × money per hit). Title unchanged (NC-ID-1 open).
- 2026-11-09 (NC-ART-1, merged PR #8): visual identity "Fractured Intelligence" (rogue AI, title unchanged; replaced by "Network Recovery" in NC-AI-RECOVERY-1); drawing, colours, HUD/shop styling only, simulation bit-identical to its base.
- 2026-11-09 (NC-FOUNDATION-1): baseline documented; no gameplay change.
- 2026-11-09 (NC-ORIGINAL-1, merged PR #7): breach mechanic (heart, relays, aimed volley, autopilot, shatter), Fire rate → Volley charge (NC-10), ball refill fixed 700 ms, new income sources (above), audio + sound toggle, first-purchase target 20–45 s → 15–45 s. Prices, block HP, money per hit and the save format unchanged.
- 2026-11-09 (NC-CORE-1A, merged PR #6 with scale 250): first minute — world scale 250 (NC-09), turrets aim at the core, core progress bar, `+$n` labels, first-minute hint; no price, reward, HP or save change. Alternative for the owner: world scale 280 (800×450 unchanged 1:1, slower mid-game). Active-play twist (NC-10/11/12) proposed, not implemented.
- 2026-11-09 (NC-BASIC-1, fast track to Basic Launch): English UI added (Polish kept), save validation + backup; no gameplay, balance or canvas-size change. UI copy: Cash/Kasa, Level/Poziom, Buy new ball/Kup nową kulę, Balls: n/Kulki: n, Fire rate/Szybkość strzału, Hit power/Siła uderzenia, Lvl n.
