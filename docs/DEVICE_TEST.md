# Device test of a branch (iPhone) without touching `main`

How the owner plays a stage branch on a real phone **before** a merge.
GitHub Pages publishes only `main`, so these routes never change production.
A different address (origin) also means a **separate save**: the test never
reads or writes the players' `neonCrusher.save.v1` on GitHub Pages.

## Route A — branch preview through raw.githack (no install)

The repository is public, so the free raw.githack proxy can serve a branch or
a fixed commit with the right file types:

- latest of the branch: `https://raw.githack.com/klaudiamoscinska-art/neon-crusher/<branch>/index.html`
- a fixed commit (recommended, what GPT reviewed):
  `https://raw.githack.com/klaudiamoscinska-art/neon-crusher/<full commit SHA>/index.html`

Open the link in Safari on the iPhone. raw.githack is a third-party service
(not run by this repo); it caches branch URLs for a few minutes. If it is
down or blocked, use route B. Status from the build machine: NOT VERIFIED
(the machine cannot reach the service).

## Route B — the owner's computer on the same Wi-Fi

1. On the computer: `git fetch origin && git switch <branch>` (or download
   the branch ZIP from GitHub and unpack it).
2. In that folder: `python3 -m http.server 8080 --bind 0.0.0.0`.
3. Find the computer's local address (macOS: System Settings → Wi-Fi →
   Details → IP address, e.g. `192.168.1.23`).
4. On the iPhone (same Wi-Fi), Safari: `http://192.168.1.23:8080/`.
5. Stop the server with Ctrl+C after the test; switch back with
   `git switch main` if needed.

## What to check (write PASS / FAIL / NOT RUN per line)

1. The game loads and lands in play; no blank screen; portrait and landscape.
2. First 10 seconds: the AI core, the red tiles and the uplink are readable;
   the hint pill is readable and does not cover the uplink.
3. Tap the core when "OVERRIDE READY": a pulse fires (touch works).
4. Sector 3+ (play or use a test save): "AI SHIELD" appears top right, the
   firewall node (white lock in a magenta reticle) is easy to find and to
   tap; tapping it shows "SHIELD BROKEN" top left and "CORE EXPOSED".
5. No text covers the core, the node or an uplink; Polish (`?lang=pl`) too.
6. Sound starts after the first tap; the ♪ button mutes it.
7. Reload: cash and sector are kept (this origin's own save).
8. Smoothness with many drones (feel; no stutter that hurts play).

Until this list is filled on a device, every device line stays NOT VERIFIED.
