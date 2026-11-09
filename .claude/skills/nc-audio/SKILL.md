---
name: nc-audio
description: "Neon Crusher audio: synthesised Web Audio SFX and music (hits, block breaks, purchases, level-up), mixing and rate limiting, mute/volume setting, autoplay unlock, iOS AudioContext resume, muting during portal ads. Use when adding or changing sound."
---

# nc-audio

**Scope:** an audio engine in the runtime (none exists yet — NC-11), sound
design, mix, settings toggle, platform audio rules.
**Elsewhere:** the settings UI → `nc-ux`; when ads start/stop →
`nc-crazygames`; saving the mute setting → `nc-save`.

## Read first
- `docs/RISKS.md` NC-11; `docs/CRAZYGAMES.md` "Rules to respect in design now"
  (iOS resume, mute only when an ad really starts).

## Rules
- Synthesise with Web Audio (oscillators, noise, envelopes); no audio files
  unless the owner approves size and licences.
- Create/resume the `AudioContext` only inside a user gesture; resume on
  `touchend`/`click` after iOS interruptions.
- Hit sounds are rate-limited and pitch-varied (many balls = many hits per
  second); a master gain and a persistent mute toggle exist from day one.
- No sound before the first interaction; audio never blocks gameplay start.

## Procedure
1. Define events → sounds table (event, frequency cap, volume) in
   `docs/GAME_DESIGN.md` "Presentation".
2. Implement behind one small `Sound` API; the harness must load without an
   `AudioContext` (guard `typeof AudioContext`).
3. Measure CPU in late game (many hits) and test mute persistence.

## Done when
Events table in the GDD, mute persists across reload, no errors where audio is
unavailable (harness, iOS before a gesture), owner listened (device NOT RUN
otherwise).

## Stop and ask
Music with a licence question, audio files, anything that autoplays.
