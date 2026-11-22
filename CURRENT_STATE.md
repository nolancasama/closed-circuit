# Current State

## Status
Scenario 01 "The Three Chambers" is fully playable end to end (boot → Chamber A
keypad → aux lever/crank → flood emergency → final release → escape → shift
report). `SPEC.md` is the authoritative design.
Control Room v2 slices 1 and 2 are implemented: the headless facility/reaction/
discovery/Voice systems now drive the fixed workstation, hazard/reaction
rendering, hardware audio and Discoveries clipboard.

## What Exists
- Pure headless engine + scenario (`src/engine`, `src/scenarios/three-chambers`),
  Canvas 2D renderer with per-room painters, DOM UI (intercom, console, keypad,
  inspection, notes, discoveries), synthesised WebAudio.
- Console is a physical control desk (`src/ui/console.js` + reusable
  `src/ui/hardware/` gauges/toggles/lamps/buttons, styles in `board.css`), with
  five fixed panels below the monitor rack. No BOARD toggle or key B.
- Main 16:9 CRT plus three always-live small CRTs (12 fps). GRID multiplexes
  inside the main bezel. Wide intercom with speaker grille and printer-strip
  log; portrait DESK / INTERCOM / LOG tabs below the persistent monitor wall.
- 58 node tests (`npm test`) incl. hazards, recovery, reactions, discoveries,
  Voice and full playthroughs; all pass. `npm run smoke`
  plays a full shift in headless Chromium and fails on browser errors or a bad ending.
- Split room lights, fan speed/draw, branch faults/reset, E-STOP, room heat/
  smoke, embers, steam routing, recoverable Ruth collapse, IR/warm secrets,
  trust/refusal/reaction cues, 12 discoveries and contextual Voice are pure
  simulation state. Exact fields/actions/events are in SPEC's v2 contract.
- Detented fan/steam rotaries support direct clicks, dragging and keyboard;
  branch cutouts expose white trip flags; guarded E-STOP is cover then press,
  DRAIN remains cover then hold. Gauges have red bands and spring needles.
  Handles show commands, lamps show live power. Cell C's existing door rocker
  is retained; Ruth-only switchboard mechanisms remain hers.
- Room smoke, steam/heat shimmer, sweating/shivering, IR/warm writing,
  electrical sparks/shock flashes, reaction poses and persistent collapse/
  death bodies are rendered from contract state. Distinct mechanical sound,
  variable-speed fan, boiler/steam/ember loops use existing audio buses.
- NOTES (N) and DISCOVERIES (D) are separate clipboard overlays; discoveries
  show blank unfound slots and a non-blocking observation stamp. PA commentary
  follows the existing subtitle path. No external assets or dependencies.
- Debug handle `window.__cc` (`game`, `app`) used by Playwright scripts for
  screenshot playthroughs (Playwright lives in `C:/Users/nolan/ui-verify`).

## Slice-2 files
- Layout: `index.html`, `styles.css`, `board.css`.
- UI: `src/ui/app.js`, `src/ui/console.js`, `src/ui/hardware/buttons.js`,
  `src/ui/hardware/gauge.js`, new `src/ui/hardware/rotary.js`.
- Rendering: `src/render/renderer.js`, `src/render/characters.js`, new
  `src/render/facility.js`, `src/render/rooms/chamberC.js`,
  `src/render/rooms/hall.js`. Audio: `src/audio/audio.js`.
- Tooling: `tools/browser-smoke.mjs`; focused local evidence probe
  `.ai/layout-probe.mjs`. Docs: `SPEC.md`, `DESIGN_DECISIONS.md`,
  `CURRENT_STATE.md`. Existing slice-1 engine/scenario/config/tests preserved.

## Recent Work (2026-11-22)
- Slice 2 presentation built without changes to engine, scenario or config,
  or additional read-only accessors. `npm test`: 58/58 passed. Focused viewport
  probes found and corrected intrinsic grid sizing: the desktop desk stays
  inside its allocated row; portrait desk panels retain full height and scroll
  internally without overlapping.
- `npm run smoke`: PASS, full shift rescued Nadia/Theo/Ruth, no browser
  errors. Presentation fixtures PASS at 1920×1080, 1366×657 and 412×860:
  main-feed/page/desk fit, three live previews after swaps, 1–4/G/N/D/Esc,
  touch NOTES, rotary click/drag/keyboard, branch reset/re-trip, E-STOP cover
  and load shedding. The full shift uses a real guard + hold on DRAIN START.
  Closed guards disable their inner buttons and restore keyboard focus to
  the lid; the screenshot run also checks this after E-STOP.
- `npm run smoke -- --presentation-only --shots .ai/shots`: PASS, all six
  requested states at all three sizes. Captures settle CSS transitions;
  phone fixtures scroll only the desk to frame the relevant instruments.
  Automated actions use real dispatch and elapsed sim time, never state
  mutation. Visual evidence is listed below. No build step exists.
- Slice-1 review corrections: live incinerator self-drafts; ordinary/hot
  embers have distinct smoke profiles, with damper-independent room extraction
  and smoke-slowed Ruth work. Habituated speech is bounded per stimulus key;
  duplicate blackout lines removed; contextual Voice waits for boot and a
  ten-second scripted-PA quiet gap. Prolonged smoke recovery no longer causes
  repeated collapse in safe air. Headless repro probes and `npm test` passed
  (58/58); no visual evidence produced for these simulation-only corrections.
- Control Room v2 slice 1 verified with `npm test` (48/48) and `npm run smoke`
  (all three rescued; no browser errors). Smoke uses
  `PLAYWRIGHT_DIR=C:/Users/nolan/ui-verify`; the first unconfigured invocation
  could not locate Playwright. Smoke tracing led to a longer dense-smoke
  warning window so Ruth can finish the existing damper intervention.
  No screenshots produced in this headless slice, and no aesthetic review.
- New hazard losses go through the shared lost/override path; tests complete
  shifts after Nadia's heat death and Theo's electrical death. Ruth never
  dies, cancels work on collapse and recovers for re-issued instructions.
- Industrial control-desk redesign of the Operator console (see
  DESIGN_DECISIONS). Verified: `npm test`, `npm run smoke`, and a scripted
  real-click pass (toggles, isolator refusal, force-on arm → trip, guard+hold
  drain, relief refusal, door interlock, override bay) at 1366×657 compact and
  expanded, plus screenshots at 1366×768 and 412×860. Not yet human-played.
- Fixed: completing a hold no longer re-presses the control on release.
- Smoke needs Playwright's own Chromium build; `npx playwright install chromium`
  in `C:/Users/nolan/ui-verify` if it reports a missing executable.

## Earlier Work (2026-10-20)
- Visual pass verified from rendered screenshots at 1366×657 and 412×860:
  unlit Chamber A readable, REC/timestamp no longer overlap.
- Newly unlocked overrides scroll into view and flash; the EXIT SEALED log line
  names the EXIT OVERRIDE when Ruth can no longer pull the release.
- Subtitles move above the inspection card (wide) / hide while it is open
  (narrow); narrow inspection card resized so ZOOM OUT is visible.

## Known Issues
- Final aesthetic judgment and listening review remain with Claude/the user.
  Performance optimisations are implemented, but not measured on a physical
  school Chromebook. No simulation-rule changes were made in slice 2.

## Slice-2 visual evidence
All PNGs are under `.ai/shots/`; additional initial layout probes are in
`.ai/shots/probes/`. Screenshot coverage (final aesthetic review pending):

| State | 1920×1080 | 1366×657 | 412×860 |
|---|---|---|---|
| Start | [00-start](.ai/shots/1920x1080/00-start.png) | [00-start](.ai/shots/1366x657/00-start.png) | [00-start](.ai/shots/412x860/00-start.png) |
| Main trip / smoke C | [01-main-trip-smoke-c](.ai/shots/1920x1080/01-main-trip-smoke-c.png) | [01-main-trip-smoke-c](.ai/shots/1366x657/01-main-trip-smoke-c.png) | [01-main-trip-smoke-c](.ai/shots/412x860/01-main-trip-smoke-c.png) |
| Steam A / red band | [02-steam-a-red-band](.ai/shots/1920x1080/02-steam-a-red-band.png) | [02-steam-a-red-band](.ai/shots/1366x657/02-steam-a-red-band.png) | [02-steam-a-red-band](.ai/shots/412x860/02-steam-a-red-band.png) |
| Flood B / sparks | [03-flood-b-sparks](.ai/shots/1920x1080/03-flood-b-sparks.png) | [03-flood-b-sparks](.ai/shots/1366x657/03-flood-b-sparks.png) | [03-flood-b-sparks](.ai/shots/412x860/03-flood-b-sparks.png) |
| Discoveries | [04-discoveries](.ai/shots/1920x1080/04-discoveries.png) | [04-discoveries](.ai/shots/1366x657/04-discoveries.png) | [04-discoveries](.ai/shots/412x860/04-discoveries.png) |
| E-STOP cover open | [05-estop-cover-open](.ai/shots/1920x1080/05-estop-cover-open.png) | [05-estop-cover-open](.ai/shots/1366x657/05-estop-cover-open.png) | [05-estop-cover-open](.ai/shots/412x860/05-estop-cover-open.png) |

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
- Screenshot review done by Claude (2026-11-22, after one visual correction
  pass). Still unverified: the audio mix by ear, and performance on a physical
  Chromebook.
- User decision pending: what happens when every prisoner is dead (no new
  ending was built; currently unreachable because Ruth cannot die).
- Control Room v2 slices 1–2 committed and pushed to `main` (2026-11-22);
  Pages redeploys from `main`.
- Decide flood tuning (see findings) and whether START should require the fan.
- A real human playtest is still worth doing for feel/confusion/audio — now
  including the fixed desk and guard + hold friction during the flood.

## Codex / Delegated Work
None in flight.
