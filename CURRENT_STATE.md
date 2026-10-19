# Current State

## Status
Scenario 01 "The Three Chambers" is fully playable end to end (boot → Chamber A
keypad → aux lever/crank → flood emergency → final release → escape → shift
report). `SPEC.md` is the authoritative design.

## What Exists
- Pure headless engine + scenario (`src/engine`, `src/scenarios/three-chambers`),
  Canvas 2D renderer with per-room painters, DOM UI (intercom, console, keypad,
  inspection, notes), synthesised WebAudio.
- 23 node tests (`npm test`) incl. full playthroughs; all pass. `npm run smoke`
  plays a full shift in headless Chromium and fails on browser errors or a bad ending.
- Debug handle `window.__cc` (`game`, `app`) used by Playwright scripts for
  screenshot playthroughs (Playwright lives in `C:/Users/nolan/ui-verify`).

## Recent Work (2026-10-20)
- Visual pass verified from rendered screenshots at 1366×657 and 412×860:
  unlit Chamber A readable, REC/timestamp no longer overlap.
- Newly unlocked overrides scroll into view and flash; the EXIT SEALED log line
  names the EXIT OVERRIDE when Ruth can no longer pull the release.
- Subtitles move above the inspection card (wide) / hide while it is open
  (narrow); narrow inspection card resized so ZOOM OUT is visible.

## Known Issues
- None known.

## Hosting
Public repo https://github.com/nolancasama/closed-circuit; GitHub Pages serves
`main` root (static, no build; `.nojekyll`) at
https://nolancasama.github.io/closed-circuit/ — pushing to `main` redeploys.

## Playtest findings (2026-10-20, scripted real-time UI runs, not a human)
- All real controls work (intercom, power switches, keypad clicks, hold buttons,
  keys 1–4); no browser errors. Optimal shift 4.4 min (3 s/decision) to 6.6 min
  (7 s/decision): both 3/3 escaped, well under the SPEC's 10–15 min target.
- Flood is lenient: knowing the steps, Theo survives even at 30 s per step
  (peak 61 %, lethal 96 %). After the intake closes the countdown jumps
  ~0:59 → ~2:43, so steps 2–3 carry little tension.
- START DRAIN is allowed with the vent fan off (plaque lists it as a
  prerequisite); the player learns only from the VACUUM LOCK refusal mid-flood.
  Intentional per SPEC "recoverable but costly" — open question for the user.

## Next Steps
- Decide flood tuning (see findings) and whether START should require the fan.
- A real human playtest is still worth doing for feel/confusion/audio.

## Codex / Delegated Work
None in flight.
