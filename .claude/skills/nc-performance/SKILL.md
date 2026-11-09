---
name: nc-performance
description: "Neon Crusher performance: frame time on phones and 4 GB Chromebooks, shadowBlur/glow cost, particle and ball counts, collision complexity, DPR, load size, profiling and quality fallbacks. Use when speed, draw cost or scaling to many balls is the topic."
---

# nc-performance

**Scope:** measuring and reducing frame cost and memory, load size, quality
levels.
**Elsewhere:** how effects look → `nc-visual-fx`; collision correctness →
`nc-physics`.

## Read first
- `docs/RISKS.md` NC-13 (numbers from the harness probe).
- `docs/ARCHITECTURE.md` "Frame loop" and "Neon rendering convention".

## Rules
- Measure before and after on the same machine; harness counters
  (`h.ctx.__calls`: shadowed draws, `save`/`restore`, `arc`, `fillRect`) are a
  proxy, not frame time. Real frame time needs a browser (Chromium trace) and,
  for a verdict, a device — otherwise NOT VERIFIED.
- Never change the look silently: a cached glow sprite must match the
  original in screenshots.
- Keep the build tiny (CrazyGames mobile homepage ≤ 20 MB; today ~26 KB) and
  zero external requests.

## Typical levers (in order of safety)
1. Pre-rendered glow sprites per colour/size (`drawImage` instead of
   `shadowBlur` per shape).
2. Batch by colour; skip `save`/`restore` where state is set explicitly.
3. Cap particles per burst under load; cap or merge balls at high counts
   (economy decision with `nc-economy`).
4. Spatial grid for ball-block checks when balls × blocks grows.
5. DPR cap (e.g. 2) on low-memory devices.

## Done when
Before/after numbers in the report (harness + browser trace), screenshots
equal, device results PASS or NOT RUN stated.

## Stop and ask
Any visible quality reduction, ball caps or other gameplay-affecting limits.
