# CLOSED CIRCUIT — Scenario 01: The Three Chambers

Authoritative design. Derived from the original MVP brief (2026-10-19), with the
changes listed in "Changes from the brief". Record later changes in
`DESIGN_DECISIONS.md` and update this file.

## Concept

The player is the Operator at a surveillance workstation. Three prisoners are
locked in separate chambers of an abandoned industrial facility. The player can
never enter a room: they watch four CCTV feeds, zoom the cameras to inspect
objects, talk to prisoners over the intercom and run the facility console.

Loop: **Observe → Investigate → Deduce → Intervene → React.**

A faceless PA voice ("the Voice") taunts at a few key moments. Graffiti in the
hall reads DON'T TRUST THE VOICE; the Voice lies once, at the climax.

| | Prisoner | Chamber | Situation |
|---|---|---|---|
| A | Nadia | Restraint chamber | Strapped in a chair, room dark |
| B | Theo | Flood chamber | Ankle-shackled to a floor ring |
| C | Ruth | Switch room | Free to move; ex-maintenance worker |

## Scenario walkthrough (first playthrough ≈ 10–15 min)

1. **Boot.** Feeds come online. The Voice introduces the "game". C calls out
   if ignored; A cries for help; B asks who's there.
2. **Chamber A (C ↔ A cooperation).** A is panicking — reassure first. A can
   feel a plate of colored symbols under the left wrist but the room is lit
   only by a red emergency lamp: A can read the first two of four. The
   LIGHTS A circuit is *isolated* at C's switchboard; C closes the isolator,
   the player switches the circuit on (watching load), A reads all four.
   The player enters them on the restraint keypad.
   - 3 attempts. Wrong entries shock A (non-lethal, explained); the third
     failure is fatal. Stated on the keypad and the wall box before entry.
   - Entry is staged (⌫ / CLEAR / SUBMIT) so a misclick never costs an attempt.
3. **A frees up.** A can pull the AUX PRESSURE lever (stabilises system B —
   required to start the drain cycle) and turn the EXIT BOLT A crank.
4. **Chamber B — the drain cycle.** B's shackle tag: RELEASES ON DRAIN CYCLE
   COMPLETE. The wall plaque (zoom, or ask B to read it) explains everything
   before anything is dangerous:
   ```
   PREREQUISITES: AUX PRESSURE STABLE (CHAMBER A) · DRAIN PUMP + VENT FAN POWERED
   IF THE INTAKE FAULTS OPEN:
     1 CLOSE INTAKE VALVE (MANUAL, IN CHAMBER)
     2 OPEN VENT DAMPER (ROOM C)
     3 PRESSURE RELIEF (CONTROL ROOM)
   DO NOT ALTER THE SEQUENCE.
   ```
   Power must be planned: pump 4 A + fan 3 A with a 10 A cap means switching
   off the incinerator and one lighting circuit.
5. **Flood emergency** (starts only when the player *holds* START DRAIN CYCLE):
   the intake faults open; ~90 s until the chamber is full.
   - B closes the intake (wading, 5 s). It still leaks at 30 % flow.
   - C opens the vent damper (needs the fan powered to actually vent).
   - Player presses PRESSURE RELIEF → drain (~9 s) → shackle releases.
   - Wrong order is recoverable but costly: venting with the intake open causes
     an inflow surge (+10 %, faster fill); relief refuses with the specific
     reason (INTAKE PRESSURE / VACUUM LOCK / NO PUMP POWER) and resets for 3 s.
   - Failure: the chamber fills; B is lost (signal loss, silence — no gore).
     The game continues; the PLATE B override becomes available.
6. **Walk-away offer.** After the flood resolves either way, the Voice unlocks
   the Operator's own door. Holding LEAVE ends the shift; everyone still
   inside is left behind. (This is what makes "nobody rescued" reachable.)
7. **Final release.** The hall camera shows the exit door's lamps:
   BOLT A · BOLT B · POWER, and the release in Room C.
   - BOLT A: A's crank (or override if A was lost).
   - BOLT B: B standing on PLATE B (or override if B was lost).
   - POWER: EXIT MOTOR circuit (5 A) — isolated at the board, then switched on;
     needs pump/fan/incinerator off.
   - C pulls FINAL RELEASE (refuses with exactly what is missing).
8. **Escape.** Exit opens for 40 s, cell doors open, bolts latch. The Voice
   lies ("only two may pass"); prisoners above a stress threshold hesitate
   until told GO. Survivors run out along fixed paths. If the door closes on
   anyone, C pulls the release again (or the console override if C is out).
   Never an instant loss.
9. **Ending** when every prisoner has escaped or been lost (or the player left):
   per-prisoner fate, rescued count, a few shift stats, REPLAY.

## Systems and rules

**Power.** Capacity 10 A. Circuits: LIGHTS A 2 A (isolated), LIGHTS B·C·HALL
2 A (on), INCINERATOR 4 A (on), DRAIN PUMP 4 A (isolated), VENT FAN 3 A (off),
EXIT MOTOR 5 A (isolated). Isolators are manual at the board in Room C (only C
can close them); the console switches non-isolated circuits. Switching on a
circuit that would exceed capacity asks for a second press ("FORCE?"); forcing
trips the main: everything de-energises (rooms go dark, IR cameras), prisoners
get scared, and C must reset the main. Resetting under overload trips again.

**Composure.** Each prisoner has stress 0–100, shown as heart rate. Darkness
and alarms push it up (darkness caps at nervous), acute events spike it.
Panicked (≥ 85, recovers below 68) prisoners only respond to calming lines;
the intercom says so. Reassure lowers stress by 35 (10 within 5 s of the last).

**Intercom.** One channel per prisoner (A/B/C tabs, synced with the focused
feed). Options are context-sensitive and knowledge-gated (a mechanism's command
appears once someone has seen or described it). Prisoners acknowledge, then act;
impossible commands get an in-character explanation. A channel is busy while
its reply plays; task commands are disabled while that prisoner is working
(STOP stays available).

**Investigation.** Enlarged feeds show bracketed hotspots. Clicking one zooms the
camera and opens an inspection card with a transcription. Key facts are
pinned to NOTES automatically (also when a prisoner reports them).

**Prisoner FSM.** idle, frightened, listening, moving, operating, waiting,
escaping, incapacitated, escaped. Tasks are step lists (goto, op, hold, wait).
Movement is 1-D per location (rooms, hall) with doors as the only links; a
closed door blocks. Idle micro-behaviours: look, shift, fidget, struggle (A),
tug chain (B), cower when panicked.

**Overrides** (hold to confirm), only when a subject can no longer act:
AUX PRESSURE (A lost; flood fills 35 % faster), BOLT A (A lost), PLATE B
(B lost), REOPEN EXIT (exit closed with people inside and C not in Room C).

**Doors.** Cell doors can be opened from the console once their occupant is
free (B's is pressure-sealed during the flood); all open with the exit
release. Exit is release-only. Operator door: see walk-away.

## Interface

- Top bar: title, in-game clock, alarm/countdown banner, GRID, NOTES, pause.
- Monitors: focused feed (16:9) + 4 live thumbnails, or 2×2 grid. Thumbnails
  carry subject name, heart rate and state. Subtitles over the focused feed.
- Comms: intercom (channel tabs + options) and a short event log.
- Console: POWER, CHAMBER SYSTEMS (restraint keypad drawer, aux, drain cycle,
  vent, relief), DOORS, OVERRIDES (hidden until available).
- Narrow/portrait: feed on top, thumbnails row, tabs for Intercom/Console/Log.
- Keyboard: 1–4 feeds, G grid, N notes, Esc pause/close.
- Auto-pause when the tab is hidden. Pause menu: resume, restart, volume.

## Audio

All WebAudio synthesis, no files: ambient drone (music bus), tension layer
during emergencies; SFX bus for UI, breakers, doors, mechanisms, water, pump,
fan, alarm, static, intercom. Music/SFX sliders and mute, persisted locally.
Master compressor; nothing abrupt or loud.

## Technical

- Vanilla ES modules, no build, no dependencies, no external assets or fonts
  (school/Chromebook networks block CDNs). `npm start` → http://localhost:5181.
- `src/engine/` and `src/scenarios/` are pure and headless: no DOM, no
  `Math.random`, no `Date.now`. Fixed 60 Hz sim; all timers are sim time, so
  pausing pauses everything. Seeded RNG (the A code is picked per seed).
- Presentation (`src/render`, `src/ui`, `src/audio`) reads state, drains the
  event queue, and only changes the game through `game.dispatch`.
- A scenario is a module: rooms/props/hotspots data, circuits, doors, dialogue,
  controls, beats and mechanics. The engine owns time, speech, tasks, movement,
  stress, power, doors, notes, log and endings.

## Changes from the brief (2026-10-19)

Accepted as written: the four feeds, enlarge-with-previews, the three rooms and
their roles, the flood emergency and its three-step order, the final
interconnected release, FSM prisoners with waypoint movement, contextual
intercom, safeguards, replay/reset, mouse + touch, Canvas 2D, no backend.

Modified / added:
1. **Power ownership** — the brief puts power both on the console and on C's
   switchboard. Split: isolators + main breaker are physical (C), circuit
   switching + load monitoring are on the console. Keeps C essential without
   making every toggle an intercom round-trip.
2. **Pump motive** — starting the pump had no reason. The drain cycle is what
   releases B's shackle; the plaque warns about the intake fault in advance.
3. **Order enforcement** — wrong order costs time or water, never an instant
   death; the intake leaks after closing so all three steps stay urgent.
4. **Outcomes 0–3** — only B had a lethal hazard. Added A's three-attempt keypad
   (explicitly warned) and the Operator walk-away. C is deliberately unkillable:
   C is the hands for power, vent and release, and losing C would cascade.
5. **Overrides** for every step that depends on a lost subject (no softlocks),
   each with a cost or limit.
6. **Final timer** made meaningful through hesitation after the Voice's lie,
   resolved by the intercom; reopening is always possible.
7. **Camera zoom + NOTES** so clues are readable on a Chromebook screen instead
   of relying on tiny canvas text.
8. **Darkness puzzle** in A introduces the power system and C ↔ A cooperation.
9. **Composure/heart rate** gives "reassure" a real job and powers the
   frightened state.
10. **Grid view** in addition to enlarge; **knowledge-gated** intercom options.
11. Not done (out of MVP scope or rejected by the brief): voice input, a second
    full timed emergency, procedural puzzles, pathfinding, save games.
