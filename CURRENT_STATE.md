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

## Next Steps
- Human playtest of a full shift for pacing/difficulty (flood timer, hesitation).

## Codex / Delegated Work
None in flight.
