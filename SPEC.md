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

- Top bar: title, in-game clock, alarm/countdown banner, GRID, NOTES,
  DISCOVERIES with found/total count, pause.
- Monitor wall: focused 16:9 CRT + the other three live small CRTs. GRID shows
  a 2×2 multiplex inside the main bezel. Subject strips carry name, heart
  rate, state and room temperature. Subtitles stay on the main screen.
- Comms: hardware intercom at the right of the wall, printer-strip log below.
- Fixed full-width desk below: POWER DISTRIBUTION, ENVIRONMENT, CHAMBER
  SYSTEMS, DOORS, EMERGENCY. Keypad and unlocked overrides may overlay it.
- Narrow/portrait: main feed and row of three remain above DESK / INTERCOM /
  LOG tabs; the selected panel scrolls internally. No horizontal page scroll.
- Keyboard: 1–4 feeds, G grid, N notes, D discoveries, Esc pause/close.
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

---

# Control Room v2 — experimentation redesign (2026-11-22)

Supersedes the Interface section above and extends Systems. Everything above
still holds unless changed here. Central idea: **the board is the toy, the
facility is the simulation, the prisoners are the stakes, puzzles and
discoveries are the long-term reward.** Loop: Experiment → Observe → Discover →
Understand → Combine → React. Effects follow consistent rules, never arbitrary
surprises. Scope rule: fewer controls, deep interactions; no decorative
controls — every control changes simulation state.

## Out of scope (decided separately, do not build)
No new ending, chapter, speech or narrative for "every prisoner dead". Current
ending behaviour (ending fires when everyone has escaped or is lost, or the
Operator left) is kept unchanged.

## Layout (every screen size keeps the main CCTV feed and critical controls visible)
- **Monitor wall** — upper ~55–60% of the play area (below the top bar): one
  large main CRT monitor (16:9) plus the other three cameras as smaller live
  CRT monitors beside it. Clicking a small monitor (or keys 1–4) swaps it into
  the main. Grid view (G) stays, inside the main bezel. Monitors look like
  aging industrial CCTV: thick bezel, screws, cam ID plate ("CAM 02 · CHAMBER
  B"), blinking REC lamp, timestamp, subject status strip (name, heart rate,
  state, room temperature). Zoom, hotspots, inspection card, subtitles and
  interference preserved. Small monitors may render at a reduced frame rate
  (Chromebook performance) but are always live.
- **Comms unit** — on wide screens, a column at the right of the monitor wall
  styled as a hardware intercom (speaker grille, channel keys A/B/C) with the
  event log below as a printer strip. Never covers feeds or the desk.
- **Control desk** — lower ~40–45%, full width, fixed panel positions (no
  menus or tabs for common controls), worn metal, screws, engraved labels. At
  1366×657 (Chromebook with browser chrome) every desk control is visible
  without scrolling; the keypad drawer and override bay may open as overlays
  on the desk. The old BOARD/expanded toggle is removed (fixed positions).
- **Narrow/portrait**: monitor wall on top (main + a row of 3), then tabs
  DESK / INTERCOM / LOG; desk panels wrap vertically, no horizontal page scroll.
- NOTES (N) and DISCOVERIES (D) are clipboard overlays from the top bar.

## Desk panels (left → right)
1. **POWER DISTRIBUTION** — main ammeter (existing semantics: 0 A when tripped,
   drag pointer for switched/projected load), MAIN status lamp (reset stays
   Ruth's), and per circuit a bat-handle toggle + lamp + small **branch
   breaker** (pop-out button with a white trip flag): LIGHTS A, LIGHTS B,
   LIGHTS C, LIGHTS HALL, INCINERATOR, DRAIN PUMP, EXIT MOTOR. (VENT FAN moves
   to panel 2.)
2. **ENVIRONMENT** — VENT FAN rotary OFF/LOW/MED/HIGH with detents; STEAM HEAT
   rotary selector OFF/A/B/C; three analog thermometers (A, B, C) with red
   danger bands; FLUE lamp (backdraft warning).
3. **CHAMBER SYSTEMS** — aux pressure gauge, Chamber B level gauge, DRAIN START
   (guard + hold), PRESSURE RELIEF (spring pushbutton), restraint keypad drawer.
4. **DOORS** — Cell A / Cell B / Cell C rockers with OPEN/LOCK lamps (retains
   the existing Cell C console operation); exit lamp panel
   (BOLT A · BOLT B · POWER).
5. **EMERGENCY** — guarded E-STOP mushroom (flip cover, then press) and the
   existing override bay.

Switch handles always show the commanded position; lamps show whether power
actually flows (existing rule). Interaction is immediate: snap toggles,
detented rotaries, depressing/springing buttons, needles that overshoot
slightly and settle, a distinct synthesised mechanical sound per control type.

## Facility simulation (pure engine, deterministic, tuning in config.js)
**Power.** Existing capacity / overload / force / trip / Ruth-reset logic kept.
The old LIGHTS B·C·HALL circuit splits into LIGHTS B, LIGHTS C, LIGHTS HALL.
VENT FAN draw depends on speed (LOW < MED < HIGH). Retune so the original
lesson holds: running pump + fan still forces the player to shed load
(incinerator and/or a lighting circuit), and the exit motor still needs
pump/fan/incinerator off.

**Branch breakers** trip on a *fault* (not overload): that circuit de-energises
without affecting the main; the Operator resets it from the desk; resetting
while the fault persists re-trips immediately.
- *Water short:* LIGHTS B faults when Chamber B water reaches the fixtures
  with the circuit live → sparks, the branch trips, and Theo takes an electric
  shock if he is in the water (stress spike, injury). Re-energising into the
  fault shocks again; repeated shocks are lethal, with clear warnings (sparks,
  flicker, screams). Switching LIGHTS B off before the water rises avoids it.
- *Flue overtemperature:* INCINERATOR faults only after running with STEAM
  HEAT routed and the fan OFF long enough (a safety cut).

**E-STOP.** Drops every Operator-switched circuit to OFF (handles spring down)
instantly without tripping the main; klaxon; everyone's stress spikes; a
running drain cycle loses pump power. Ruth's isolators and main are untouched.

**Airflow.** Fan speed × Ruth's vent damper gives flood venting airflow.
Room extraction for smoke and heat clearance uses fan speed alone: the fan
is Room C's extractor, independent of the damper.

**Smoke.** A live INCINERATOR draws its own flue with a built-in induced-draft
blower and produces no backdraft. Losing power (switch OFF, main trip, E-STOP
or flue cut) leaves smouldering embers; smoke backs into Room C, then the hall,
unless the fan extracts it. Steam routed while live leaves hotter, longer
embers. Idling is safe. Ordinary shutdown causes coughing/retreat if ignored,
but no collapse; starting the fan within about 15 seconds limits it to light
haze/coughing. Ignoring a hot shutdown for about a minute causes dense smoke
and recoverable Ruth collapse. Smoke slows Ruth's work as darkness does.

**Temperature** per room (A, B, C, hall). Rooms drift toward ambient; airflow
cools faster; flood water chills Chamber B (Theo shivers). STEAM HEAT routes
boiler heat to the selected room and works only while the INCINERATOR is
energised. Bands: comfortable / uneasy / dangerous (gauge red zone, warning
behaviour) / lethal (exposure accumulates; sustained lethal heat kills a
prisoner who cannot leave — Nadia restrained, Theo shackled). Going from ambient
to lethal takes long enough to notice and intervene (~1 min); cooling recovers.
Moderately warming Chamber B during the flood calms a cold Theo — heat is not
only a weapon.

**Lighting.** Per-room lights; dark rooms switch cameras to IR (existing). Ruth
works slower in the dark. Sudden darkness or brightness provokes reactions.

**Ruth cannot die** (rule 4 above is kept: she is the hands for isolators,
main, damper and release, and the Operator must not gain her mechanisms).
Hazards in Room C make her retreat, then *collapse* (temporarily
incapacitated); she recovers once conditions clear. Nadia and Theo can die from
new hazards; a loss goes through the existing `lost` path, so existing
overrides unlock and the game continues.

**Secrets** (lore, never on the critical path): thermochromic writing in
Chamber A visible only above a warm threshold; writing in Chamber B visible
only on the IR camera (lights B off).

## Prisoner reactions
A scenario-agnostic reaction layer. The sim emits stimuli (light change per
room, machine start/stop/noise, door movement, klaxon, heat band change, smoke,
shock, sparks, a prisoner lost within earshot). Each prisoner keeps a
per-stimulus memory (first / repeated / habituated), a **trust** value toward
the Operator (falls when the Operator's actions hurt or frighten them, rises
with reassurance and help) and the existing stress. Reactions choose from
varied per-character line pools (seeded, no back-to-back repeats, per-prisoner
cooldown) and drive animation cues: look toward source, flinch, shield eyes,
back away, cough, wipe sweat, shiver, pound door, cower, collapse. Behaviours
include asking the Operator to stop, warning the others, and refusing an
instruction when trust is low or distressed. **Refusal only costs time** (they
accept after reassurance or a re-ask) — never a softlock. Survivors react to a
loss they could perceive (stress, trust, lines).

Deaths are horror through implication and aftermath: struggle, convulsion,
collapse, the body stays on the feed, camera interference, sound, then silence.
No gore effects.

## Discovery log
Scenario-data entries with pure predicates over state and events (≈10–14 in
Scenario 01). Undiscovered entries show only as unlabelled slots plus an
"n / N" count; found entries show a short engraved-style description. Rewards
learning, combinations, recovery, secrets and kindness — never killing (no
entry triggers on a death). Separate from NOTES and the event log. Examples:
steam needs the incinerator; fan speed costs amps; flue backdraft; embers
smoulder after a trip; water short on LIGHTS B; E-STOP sheds load without a
trip; clean recovery from a main trip; Ruth is slower in the dark; HIGH fan
vents the flood faster; warming Theo during the flood; the two secrets.

## The Voice (contextual commentary)
Event-driven and rare: a global cooldown of roughly 90 s of sim time, silent
during scripted beats and active speech, each line used once. Triggers include
the first main trip (mocking), repeated trips (criticism), a clean recovery
(grudging praise), finding a secret (surprise/curiosity), creating a dangerous
condition in an occupied room and then defusing it (curiosity), a death caused
by the environment (a cold remark; not an ending), and the first E-STOP. One
deliberate lie: the first time STEAM HEAT is set to A while Nadia is
restrained, the Voice says Chamber A "is rated for it" (it is not). Existing
beats and the climax lie are unchanged.

## Interface contract (v2)
Implemented by slice 1. Presentation reads `game.state`, scenario data and the
existing view helpers; every player action goes through `game.dispatch`.
All times below are absolute simulation seconds unless described as exposure
or remaining time. Pause freezes these systems. Room ids are `A`, `B`, `C`,
`hall`; prisoner ids are `A`, `B`, `C`. State is authoritative; events are
notifications, drained with `game.drainEvents()` by presentation. Draining
events does not affect reactions, discoveries or Voice trigger capture.

Slice 2 uses this contract without additional accessors or simulation changes.
The fan and steam controls are detented hardware selectors (click, drag,
arrow keys/Home/End); repeated selection confirms an armed FORCE. E-STOP is
cover then single press, reclosing immediately; DRAIN START is cover then
hold. A main trip retains rotary/handle positions, with lamps showing live
power and the ammeter showing zero current plus switched-load drag pointer.

### Power and environment state
- `state.power` retains `capacity`, `tripped`, `order`, `circuits`, `armed`.
  `order` is `lightsA, lightsB, lightsC, lightsHall, incinerator, pump, vent,
  exit`; `lightsBC` no longer exists. Each circuit has `id`, `label`, `short`,
  `room`, `amps`, `isolated`, `on`, **`branchTripped`**, **`fault`**. `fault` is
  `null`, `water-short` or `flue-overtemperature`, latched until a successful
  branch reset. Exit additionally has `requiresOff: ['pump','vent','incinerator']`.
  Handles show `on`; lamps use `game.api.live(id)` (main closed, branch closed,
  non-isolated and commanded on). Branch trips leave handles up and do not
  trip the main. `game.api.load()` sums switched, non-isolated, non-tripped
  branches even when the main is tripped; actual main current is zero then.
  `armed` remains `null` or `{id,until}` for the existing FORCE confirmation.
- Amps: LIGHTS A 2; B 0.75; C 0.75; HALL 0.5; INCINERATOR 4; PUMP 4; EXIT 5.
  Fan OFF/LOW/MED/HIGH draws 0/2/3/4 A, with airflow 0/0.45/1/1.5 when powered
  for room extraction regardless of Ruth's damper (`state.s.flood.damper`).
  Flood airflow additionally requires the damper open. MED preserves the existing nine-second drain rate; other
  speeds scale extraction by airflow. Existing fill, surge, relief order and
  START prerequisites are unchanged. EXIT MOTOR refuses ON until the three
  other machine handles are OFF, including when their branches are tripped.
- `state.facility.fanSpeed`: `OFF|LOW|MED|HIGH`, the requested setting; a main
  trip retains it. `steamHeat`: `OFF|A|B|C`, retained even without boiler power.
  `airflow`: flood airflow; `extraction`: powered fan flow, independent of
  damper. Both refresh each simulation step.
  `embers`: seconds of smouldering remaining (45 ordinary, up to 90 hot).
  `emberHeat`: 0–1 heat charge, rising over 30 seconds of live routed steam,
  falling over 30 seconds of live unrouted operation; retained after shutdown.
  `flueExposure`: seconds live with routed steam and fan OFF, cooling at 3/s
  otherwise. `flueWarning`: backdraft only from unpowered embers with
  extraction below 0.7. `fireWasLive` is an internal transition latch.
- `state.facility.rooms[room]` has `temperature` (degrees C), `heatBand`
  (`comfortable|uneasy|dangerous|lethal`), `smoke` (0–1), `coughing`, `dense`,
  `dangerous` (tracked occupied-room danger episode). Ambient is 22 C. Uneasy
  is below 18 or at least 35; dangerous starts at 50, lethal at 70. Steam
  heats only its selected room while INCINERATOR is live. With no airflow,
  lethal temperature starts after about 52 seconds; a further 14 seconds of
  sustained lethal exposure kills a restrained/shackled subject. Cooling
  below lethal removes exposure at 2 seconds per second. Floodwater chills B;
  live steam warming B within 19–34 C reduces Theo's stress during the flood.
- Smoke originates in C, then spreads into the hall. `coughing` starts at
  smoke 0.25, Ruth retreats at 0.5, `dense` starts at 0.75. Dense exposure for
  22 seconds collapses Ruth. HIGH clears smoke/heat faster. After embers burn
  out, passive smoke clearance accelerates, so recovery remains possible
  even if a main trip prevents Ruth reaching the damper or reset.
- Water at level 0.5 faults live LIGHTS B. A live fault shocks occupants of B
  in water; Theo survives two shocks with warnings and the third is lethal.
  Switching the wet light OFF avoids shocks. A wet branch reset re-trips
  immediately even with its handle OFF, but cannot spark/shock without main
  power and an ON handle. The flue cuts after 70 live, routed-steam seconds with fan OFF;
  its latched fault must cool below 35 exposure seconds before reset holds.
- `state.facility.secrets` is `{warmWriting:boolean,irWriting:boolean}`:
  current visibility (A at least 38 C; B lights unpowered, viewed in IR).
  Disappearance does not erase notes/discoveries. Scenario data
  `facility.secrets[]` holds `{id,room,kind,title,text}`; a reveal pins a note
  using the secret id. No renderer or hotspot is required to award it.
- `state.facility.definition` holds scenario wiring (`rooms`, `lights`,
  circuit/room ids, protected prisoners, water/damper/flood predicates and
  secret data). `facts` holds persistent learning flags: `steamWithoutFire`,
  `fanSpeedChanged`, `backdraft`, `embersAfterTrip`, `waterShort`,
  `emergencyStop`, `cleanRecovery`, `darkWork`, `highFloodVent`, `warmedTheo`,
  `warmWriting`, `irWriting`. Presentation should use discoveries for rewards,
  rather than awarding directly from these internal flags.

### Prisoners, discoveries and Voice state
- Each prisoner gains `trust` (0–100, initially 65); `reaction` is `null` or
  `{kind,until,room?,direction?}`. Cue kinds use these exact strings: `look`,
  `flinch`, `shield eyes`, `back away`, `cough`, `wipe sweat`, `shiver`,
  `pound door`, `cower`, `collapse`. Cues usually last three seconds; use
  `collapsed` for persistent collapse, rather than extending an expired cue.
- `p.reactions` is `{memory,cooldownUntil,lastLine,refused}`. `memory` maps
  stimulus keys (normally `kind:room`, with `*` for no room) to
  `{count,stage,lastAt,lastLine,habituatedSpoken}`; stages are `first` (1), `repeated` (2–3),
  `habituated` (4+). Memory and cues update even when speech is suppressed.
  Spoken reactions have an eight-second per-prisoner cooldown, skip that
  prisoner's/Operator's/Voice's current or queued speech, and never select
  the previous spoken line for that prisoner and stimulus key again
  immediately. Habituated speech occurs at most once per key, then cues only;
  90 seconds of quiet resets the stages and permits speech again. Common
  light, machine, door, klaxon, smoke and heat pools have at least three lines
  per speaking stage. Machine sounds,
  klaxons and losses are audible throughout this facility; local light,
  heat, smoke, shock and sparks affect occupants of their source room.
- Trust falls with fright/harm/loss, and rises with reassurance, release,
  draining and helpful warmth. A task may be refused once per option at
  trust below 30 or stress at least 78. The dispatch still returns `ok:true`
  because the instruction was heard; the reply and `refusal` event explain
  the delay. `p.reactions.refused[optionId]` remembers it; re-asking accepts.
  `reassuredForTask` permits the next task after reassurance regardless of
  remaining low trust. Existing panic/hesitation calming requirements remain.
- Prisoners additionally expose `immortal`, `collapsed`, `collapseCause`,
  `retreating`, `heatExposure`, `smokeExposure`, `shocks`, `recoveryExposure`.
  Exposure values are seconds. Ruth has `immortal:true`; collapse leaves
  `alive:true`, `fsm:'collapsed'`, `anim:'collapse'`, cancels her task and
  closes her intercom channel with `COLLAPSED — CLEAR THE HAZARD`. Recovery
  requires smoke below 0.28 and heat below dangerous for five seconds; she
  returns to idle, speaks and accepts re-issued tasks (no automatic resume).
  Her movement and operating steps run at 60% speed when her room is dark,
  and at 60% while coughing in smoke; these factors multiply together.
  Lost Nadia/Theo retain `alive:false`, `fsm:'incapacitated'`, a body at the
  last position, and `lostCause:'heat'|'shock'` for new hazards. Existing
  `chair`/`flood` causes and all overrides remain.
- `state.discoveries = {found,total}`; total is 12. `found` is an ordered array
  of `{id,title,text,time}`. Show only blank slots for unknown entries. IDs:
  `cold-boiler`, `fan-load`, `backdraft`, `embers`, `water-short`,
  `emergency-stop`, `clean-recovery`, `dark-work`, `high-vent`,
  `warmth-for-theo`, `warm-writing`, `infrared-writing`. Scenario definitions
  supply pure `when(state)` predicates. A loss suppresses all predicate
  edges in that update, including a loss dispatched between updates; those
  edges are consumed without delayed rewards. Independent later learning is
  still possible. `discoveryMemory` is internal predicate/loss bookkeeping.
- `state.commentary = {used,pending,lastAt,history,bootPending}`: `used` contains spoken
  line ids, `pending` contains `{id,time}` observations, `lastAt` is `null`
  before the first line. `history` tracks trips, occupied-room danger and
  the first steam-to-A selection. IDs: `steam-a-lie`, `first-trip`,
  `repeated-trips`, `clean-recovery`, `secret-found`, `danger-defused`,
  `environmental-loss`, `first-estop`. Comments queue independently of the
  presentation event queue; each speaks once, at least 90 seconds apart.
  They wait until the boot introduction has been queued (`bootPending:false`),
  all active/queued speech ends, and ten seconds after `state.scriptedUntil`.
  The steam lie takes priority over pending comments but obeys the
  same cooldown. Its eligibility is tested only on the first A selection
  while Nadia is alive and restrained. Contextual lines have speaker `pa`
  and `kind:'commentary'` in `state.lines`; use the existing subtitle/speech
  path. Scripted PA beats and the final exit lie are unchanged.

### Dispatch actions
All results retain `{ok,msg,code?}`. Existing intercom, inspection, keypad,
door, pause, leave and override commands retain their shapes and interlocks.
No dispatch grants the Operator a Ruth-only mechanism.

| Action | Exact dispatch | Semantics |
|---|---|---|
| Circuit toggle | `{type:'power',circuit,on,force?}` | Eight ids above. Isolators still require Ruth; main trips retain handles. Legacy `vent` ON chooses MED from OFF, OFF sets fan OFF. |
| Fan selector | `{type:'control',id:'fan-speed',payload:{speed,force?}}` | `speed` is OFF/LOW/MED/HIGH. Raises amps with speed; overload uses existing FORCE arming/second press. A rejected request preserves the old setting/draw. |
| Steam selector | `{type:'control',id:'steam-heat',payload:{room}}` | `room` is OFF/A/B/C. Selection succeeds without fire but produces no heat. |
| Branch reset | `{type:'control',id:'branch-reset',payload:{circuit}}` | Operator action; does not reset the main or change isolators/handles. Returns `code:'fault'`, `ok:false` if it immediately re-trips. A restored branch can overload the main. |
| Emergency stop | `{type:'control',id:'e-stop'}` | Immediately puts every circuit handle OFF, fan OFF/0 A, clears FORCE arming, spikes stress and sounds klaxon. Main, isolators and steam routing stay as set. Running drain stalls until power returns. Cover/button guarding is presentation responsibility. |
| Cell door | `{type:'door',door,open}` | Existing freedom/flood interlocks; exit remains release-only. |

### New/extended events
Events have exactly the fields below (in addition to `type`); no implicit
timestamp is added except on `stimulus`. Poll state for continuous gauges.

| `type` | Fields |
|---|---|
| `power-change` | `circuit,on,live` |
| `main-trip` / `main-reset` | `repeat` / `clean` |
| `branch-trip` / `branch-reset` | `circuit,fault` / `circuit` |
| `fan-speed` | `speed,previous,amps` (selector changes; legacy power toggles still emit `power-change`) |
| `steam-heat` | `room,previous` |
| `e-stop` / `klaxon` | none / `room:'*'` |
| `embers` | `room,remaining` (transition from live fire to embers) |
| `sparks` / `shock` | `room,circuit` / `room,pid,count` |
| `heat-band` | `room,band,previous` |
| `smoke` | `room,dense,coughing` (threshold transitions) |
| `facility-danger` / `facility-defused` | `room` (occupied-room danger episode/clearance) |
| `secret` | `id,room` (visibility rising edge; a matching existing `note` event follows) |
| `stimulus` | `kind,t` plus source fields when applicable: `room,pid,source,scope,on,open,band,previous,cue,direction,harmful,helpful,stress` |
| `reaction` | `pid,stimulus,stage,cue:{kind,until,room?,direction?},line` (`line` may be null) |
| `refusal` | `pid,option` |
| `collapse` / `recovered` | `pid,cause` / `pid` |
| `lost` (extended) | `pid,cause,environmental` (true for new heat/shock hazards) |
| `discovery` / `commentary` | `id` |

Existing `lights`, `door`, `fsm`, `line`, `sfx`, `interference`, `note`,
`alarm`, `panic`, `escaped`, `ending` events remain. Presentation must not
interpret `collapse` as `lost` or unlock death overrides for Ruth.

The ending check is unchanged: when every prisoner has escaped or is lost,
wait 2.5 seconds and show the existing `complete` shift report. If all were
lost it would show zero rescued and the existing generic report/epilogue;
no new ending or narrative was added. That state is unreachable in normal
Scenario 01 play because Ruth cannot die. Losing both Nadia and Theo leaves
the shift running until Ruth escapes or the Operator leaves.
