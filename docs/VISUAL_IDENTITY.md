# Visual identity — "Network Recovery" (NC-AI-RECOVERY-1)

Element-by-element look of the game. Direction, palette and meaning:
`docs/GAME_DESIGN.md` "Visual identity"; drawing conventions and cost rules:
`docs/ARCHITECTURE.md` "Neon rendering convention". Change this file with any
drawing change (`nc-visual-fx`, cost through `nc-performance`).

| Element | Look |
|---|---|
| Floor (background) | toned down in R2 so it never competes with play: cached once per size: dark navy floor of large bevelled panels, a soft light behind the core, sparse dots, dim red AI cable routes from the edges, two containment rings with ticks, chamfered arena bezel. Live: a scanning arc and eight bezel light strips whose colour moves from AI red to recovery cyan with the sector's progress |
| Tiles (armour) | 2.5D hardware tiles (R2: stronger volume): L-shaped floor shadow, a dark right wall and a lighter bottom wall, raised top face with a sheen on its upper part, a lit bevel (top/left) and a dark crease where it meets the walls. AI-held tops are tinted by layer — wine red (outer) or rust (inner, next to the core) — and drain to neutral steel stage by stage as damage grows, so intact and damaged infrastructure differ at a glance. One of three corrupted inlays (socket, memory bank, port) + circuit slots, thin outline on the collision edge; a slow light wave runs outward from the core through the inlays (4 steps, batched). Damage also shows cyan cracks with white cores (stages 1–3). Shatter pending: cyan top. Broken: four shards with cyan edges; a cyan floor plate + outline + node stays (recovered cells: AI red vs recovered cyan) |
| Lattice | thin red links between neighbouring tiles' nodes, brighter red axons into the core, ember pulses flowing inward; reacts to hits (white), to damage (brighter, faster), cut links become cyan sparking stubs, links ahead of the recovery wave flicker white |
| AI core (heart) | a processor die on a socket — a square silhouette no tile has: floor shadow, wine socket with a lit bevel, bright pins running from the die to every edge, a crimson die with a glowing rim, a dashed data ring turning around the socket (light only, nothing solid outside the box), a guard ring of six segments (one lost per sixth of HP), a large four-facet red crystal whose facets drift apart as HP falls with cyan light in the gaps. Geometric, no eye, face or skull |
| Relays | the AI's power hubs: amber hexagonal capacitor on a tile, pulsing cell, three terminals, amber power pipe into the core, zigzag link to relays within shockwave reach, overload arcs when about to blow. Captured (destroyed): cyan arcs to every uplink, "RELAY CAPTURED" |
| Shield (AI reaction) | amber power line from the firewall node into the core with white energy flowing along it; amber hexagon around the core whose six sides go out as its 7 s run down; node: amber edge, a white lock on a dark plate (the only white glyph on the core) inside a rotating magenta reticle — four arcs and four ticks (R2: never reads as an amber relay). HUD "AI SHIELD n s" (amber, draining bar). Broken: "SHIELD BROKEN +$n", magenta ring, cyan arc node → core; exposure: magenta breach line, magenta edges on exposed tiles, magenta brackets on the core, HUD "CORE EXPOSED n s" |
| Uplinks (turrets) | 2.5D pads (floor shadow, side wall, cyan rim) with a hexagonal base, two rails aimed at the core, magenta capacitor filling with the override charge, four-segment charge ring; ready: spark between the rail tips |
| Override pulse | magenta beam with a white core splitting into a cyan and an amber ghost as it fades; dashed magenta sync line between uplinks; X where it stops |
| Drones (balls) | floor shadow (they fly), short trail, soft halo, cyan hull, white-hot core |
| Sector recovery (finale) | the guard ring implodes, the four crystal facets fly apart, ten cyan recovery lines race outward, a cyan front at the exact radius of the shatter wave turns tiles cyan before they break, cyan corner brackets open around the whole sector; cyan-white veil (single, gentle); "SECTOR RECOVERED +$n" below the core, then "SECTOR n" banner with cyan rules |
| New sector | tiles appear outward from the core in 0.45 s (drawing only) |
| HUD on canvas | text in the two top corners only (`docs/GAME_DESIGN.md` "Presentation"): left "Recovered n%" (cyan) + event toasts on a dark chamfered backing in their colour; right override meter (magenta) + AI alert (amber shield / magenta exposure) |
| DOM HUD / shop | brand mark = the AI core die; Sector value cyan; upgrades: drones cyan, override charge magenta, breach power amber; shield hint amber |

`prefers-reduced-motion`: no shake, no assembly animation, no light wave,
static guard ring, scan, flows and sparks; flash much weaker. Nothing
flashes faster than 3 Hz over a large area (the alert label blinks 2.5 Hz,
text only).

Screens of every element in play: `qa/art-shots.mjs` (14 scenes, BEFORE/AFTER
sheets in the NC-AI-RECOVERY-1 PR). The rejected NC-ART-ASSETS-1 raster
sprites (PR #9, not merged) are not used anywhere.
