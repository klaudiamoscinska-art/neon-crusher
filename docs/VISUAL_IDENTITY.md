# Visual identity — "Network Recovery" (NC-AI-RECOVERY-1)

Element-by-element look of the game. Direction, palette and meaning:
`docs/GAME_DESIGN.md` "Visual identity"; drawing conventions and cost rules:
`docs/ARCHITECTURE.md` "Neon rendering convention". Change this file with any
drawing change (`nc-visual-fx`, cost through `nc-performance`).

| Element | Look |
|---|---|
| Floor (background) | cached once per size: dark navy floor of large bevelled panels, a soft light behind the core, sparse dots, dim red AI cable routes from the edges, two containment rings with ticks, chamfered arena bezel. Live: a scanning arc and eight bezel light strips whose colour moves from AI red to recovery cyan with the sector's progress |
| Tiles (armour) | 2.5D hardware tiles: L-shaped floor shadow, side walls (bottom/right), raised top face with a lit bevel, one of three corrupted inlays (socket, memory bank, port) + circuit slots in red (outer) or ember (inner layer next to the core), thin outline on the collision edge. A slow light wave runs outward from the core through the inlays (the system is alive; 4 brightness steps, batched). Damage: cyan cracks with white cores grow (stages 1–3), the inlay dims, last stage flickers. Shatter pending: the tile turns cyan (recovered) before it breaks. Broken: four shards with cyan edges; a faint cyan outline + node stays on the floor (recovered cells) |
| Lattice | thin red links between neighbouring tiles' nodes, brighter red axons into the core, ember pulses flowing inward; reacts to hits (white), to damage (brighter, faster), cut links become cyan sparking stubs, links ahead of the recovery wave flicker white |
| AI core (heart) | a processor die on a socket — a square silhouette no tile has: floor shadow, socket with red pins running from the die to every edge, the die with a crimson glowing rim, a guard ring of six segments (one lost per sixth of HP), a four-facet red crystal whose facets drift apart as HP falls with cyan light in the gaps. Geometric, no eye, face or skull |
| Relays | the AI's power hubs: amber hexagonal capacitor on a tile, pulsing cell, three terminals, amber power pipe into the core, zigzag link to relays within shockwave reach, overload arcs when about to blow. Captured (destroyed): cyan arcs to every uplink, "RELAY CAPTURED" |
| Shield (AI reaction) | amber power line from the firewall node into the core with white energy flowing along it; amber hexagon around the core whose six sides go out as its 7 s run down; node: amber edge, lock glyph, magenta target brackets. HUD "AI SHIELD n s" (amber, draining bar). Broken: "SHIELD BROKEN +$n", magenta ring, cyan arc node → core; exposure: magenta breach line, magenta edges on exposed tiles, magenta brackets on the core, HUD "CORE EXPOSED n s" |
| Uplinks (turrets) | 2.5D pads (floor shadow, side wall, cyan rim) with a hexagonal base, two rails aimed at the core, magenta capacitor filling with the override charge, four-segment charge ring; ready: spark between the rail tips |
| Override pulse | magenta beam with a white core splitting into a cyan and an amber ghost as it fades; dashed magenta sync line between uplinks; X where it stops |
| Drones (balls) | floor shadow (they fly), short trail, soft halo, cyan hull, dark casing band, white-hot core |
| Sector recovery (finale) | the guard ring implodes, the four crystal facets fly apart, ten cyan recovery lines race outward, a cyan front at the exact radius of the shatter wave turns tiles cyan before they break, cyan corner brackets open around the whole sector; cyan-white veil (single, gentle); "SECTOR RECOVERED +$n" below the core, then "SECTOR n" banner with cyan rules |
| New sector | tiles appear outward from the core in 0.45 s (drawing only) |
| HUD on canvas | top-left "Recovered n%" (cyan), top-right override meter (magenta), top-centre AI alert (amber shield / magenta exposure; below the meters on narrow fields) |
| DOM HUD / shop | brand mark = the AI core die; Sector value cyan; upgrades: drones cyan, override charge magenta, breach power amber; shield hint amber |

`prefers-reduced-motion`: no shake, no assembly animation, no light wave,
static guard ring, scan, flows and sparks; flash much weaker. Nothing
flashes faster than 3 Hz over a large area (the alert label blinks 2.5 Hz,
text only).

Screens of every element in play: `qa/art-shots.mjs` (14 scenes, BEFORE/AFTER
sheets in the NC-AI-RECOVERY-1 PR). The rejected NC-ART-ASSETS-1 raster
sprites (PR #9, not merged) are not used anywhere.
