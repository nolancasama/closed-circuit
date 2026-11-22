# Design Decisions

This file records meaningful product, UX, visual, architectural, or behavioral decisions for this project.

For each significant decision, record:

- Date
- What was decided or changed
- Why
- Previous approach, if relevant
- Rejected alternatives, if useful

Only record decisions that may be useful to understand later.

Do NOT record:
- trivial UI adjustments
- routine bug fixes
- formatting changes
- mechanical refactors with no design consequence
- every individual code modification

Git is the source of truth for detailed code-change history.

A useful rule:

> If a future developer or AI could reasonably ask, "Why is it designed this way?", record the answer here.

## 2026-10-20 — Overrides announce themselves
- **What:** when an emergency override unlocks, the console scrolls it into view
  and flashes it; the EXIT SEALED log line names the EXIT OVERRIDE when Ruth is
  out (otherwise it points at the release in Room C).
- **Why:** overrides are the only way forward once a subject is lost, but the
  section sits below the fold at Chromebook sizes, and the old log message told
  the player to pull a release nobody could reach.
- **Rejected:** a modal prompt (interrupts an already-tense moment).

## 2026-11-22 — Operator console becomes a physical control desk
- **What:** the console is rebuilt as aging industrial hardware: analog gauges
  (main load, aux pressure, Chamber B level), a bat-handle toggle per circuit
  with its own lamp, guarded hold buttons, a spring pushbutton for pressure
  relief, rocker switches for the cell doors with OPEN/LOCK lamps, an exit
  lamp panel, and a striped hinged override bay. Hardware pieces live in
  `src/ui/hardware/` and know nothing about the game; `src/ui/console.js` maps
  state onto them and acts only through `dispatch`. No engine changes.
- **Switch position vs lamp:** the handle shows what the Operator commanded
  (`on`); the lamp shows whether power actually flows. A trip leaves handles
  where they were and puts the lamps out. Isolated circuits carry a red
  ISOLATED · ROOM C tag and still dispatch, so the engine's refusal is shown.
- **Ammeter reads 0 A when the main is tripped** (no current flows) and an
  amber drag pointer shows the load still switched in, plus the projected load
  while a FORCE ON is armed. Why: the player must see that a reset would
  re-trip. Rejected: showing switched load on the needle (lies about current).
- **Override bay cover opens itself** when an override unlocks (still scrolls
  into view and flashes); the override is then a plain hold button. Why: no
  extra step in an emergency. Rejected: a manual cover plus a per-control guard.
- **Drain start = lift the guard, then hold.** Rejected: rotary selector (more
  steps, conflicts with hold-to-confirm). Pressure relief stays a single press.
- **Expanded board** is a remembered toggle (BOARD / key B), **on by default**
  (user decision 2026-11-22; a saved "compact" choice still wins), that widens the console to ~55vw on wide screens; feeds and intercom stay visible.
  It fits 1366×768 without scrolling; at 1366×657 only the closed override bay
  is below the fold. Compact mode and the narrow CONSOLE tab use the same
  hardware. Rejected: always-expanded (shrinks CCTV for players who don't need it).
- **Hold buttons swallow the click that ends a completed hold.** Previously
  the release re-pressed the now not-ready control and showed a refusal.

## 2026-11-22 — Control Room v2: experimentation redesign (SPEC "Control Room v2")
- **What:** the user's redesign brief was accepted as the direction: monitor
  wall (1 main + 3 live small) above a full-width physical desk, free
  experimentation, interconnected facility sim (power, per-room lights, fan
  speed, smoke, temperature/steam heat, branch breakers, E-STOP), situational
  prisoner reactions with trust, a Discovery log, and rare contextual Voice
  comments. Detailed design lives in SPEC.md.
- **Modified — Ruth stays unkillable.** New hazards make her retreat and
  collapse temporarily, never die. Why: she is the only hands for isolators,
  main reset, damper and release, and the brief itself forbids giving the
  Operator her mechanisms; her death would softlock or force that.
- **Modified — R-rated by implication, not gore.** Deaths read through
  struggle, collapse, the body staying on the feed, interference and sound.
  Why: procedural Canvas gore looks cheap, and implication is scarier.
- **Modified — refusal costs time only.** Low-trust prisoners can refuse, but
  accept after reassurance or a re-ask. Why: no softlocks from mood.
- **Chosen hazards** (water short on LIGHTS B, steam heat, flue smoke/embers)
  each reuse existing systems (flood level, incinerator, vent fan/damper,
  main trip), so combinations matter more than control count. The incinerator
  gains a purpose (steam boiler) instead of being only load to shed.
- **Steam heat has a kind use** (warming a cold Theo during the flood), so
  heat is a tool, not just a weapon.
- **The Voice tells one new lie** (Chamber A "is rated for" steam), backed by
  the existing DON'T TRUST THE VOICE graffiti.
- **Removed — the BOARD/expanded toggle.** Fixed control positions are the
  point; one layout per screen class.
- **Discoveries never fire on a death.** Rewards understanding, recovery,
  secrets and kindness only.
- **Deferred (user decision pending):** all-prisoners-dead narrative; current
  ending behaviour kept. Flood tuning and "START needs the fan" also remain
  open from the 2026-10-20 playtest.
- **Rejected:** a large control count with one scripted effect each; multiple
  board pages/menus.

## 2026-11-22 — Control Room v2 slice 1: simulation and integration
- **Smoke correction:** a live incinerator draws its own flue; only unpowered
  embers backdraft. Routed steam leaves hotter, longer embers. Fan speed alone
  extracts room smoke/heat; the damper gates flood venting only. Rejected:
  damper-gated room airflow, which made idling deadly.
- **Power budget:** split B/C/HALL lighting into 0.75/0.75/0.5 A, retaining
  the previous combined 2 A and the original MED-fan full-playthrough loads.
  Fan LOW/MED/HIGH costs 2/3/4 A. EXIT MOTOR additionally checks that all
  three machine handles are OFF, so a tripped machine branch cannot bypass
  the original load-shedding lesson. Manual isolators and main reset remain
  Ruth's. The old Room C painter temporarily shows only its existing known
  manual mechanisms; the split lighting is exposed on the console.
- **Warning/recovery timing:** no-airflow steam reaches lethal in about 52
  seconds, then needs 14 seconds of lethal exposure to kill a restrained
  prisoner. The flue cuts at 70 no-airflow running seconds, with a lower
  reset threshold (35) so resetting a still-hot branch actually re-trips.
  Smoke warns with coughing, then retreat, then collapse after 22 seconds
  of dense exposure. The initial shorter collapse timer interrupted Ruth's
  damper task in the existing browser smoke route; the final timing lets
  an attentive Operator finish that intervention and clear the exposure.
- **No reset dependency cycle:** a power cut leaves 60 seconds of embers;
  after those die, passive smoke clearance accelerates. Ruth can therefore
  recover without powered ventilation if she collapsed before opening the
  damper or resetting the main. Recovery needs five seconds of safe air/heat;
  her canceled task must be issued again. Collapse is alive, recoverable and
  distinct from the existing dead `incapacitated` state.
- **Reactions:** memory/cues respond even when speech is busy; spoken lines
  use seeded pools and a per-person cooldown. Facility-wide machinery,
  klaxons and implied losses are audible across the chambers; physical
  stimuli are local. A scenario can override perception. Refusal costs one
  extra ask per instruction, or reassurance permits the next instruction;
  existing panic calming still applies. Release, drainage and helpful warmth
  raise trust. Loss stress is applied once through the shared loss stimulus,
  replacing duplicate scenario spikes. Smoke adds fear more slowly than its
  physical incapacitation effect, preserving the existing loss playthrough.
- **Observations survive UI event draining:** synchronous scenario event
  observation captures discoveries/Voice triggers before presentation drains
  events. Discovery predicate edges coinciding with a loss are consumed
  without a reward, including losses between fixed updates. Later independent
  learning remains possible. Contextual Voice lines queue until all speech
  and scripted PA are clear; cooldown starts on actual speech. The new steam
  lie has queue priority but obeys the same cooldown and once-only rule.
- **Scope:** the exact slice-2 contract is now in SPEC. Only compatibility
  toggles/selectors/reset buttons were added to the old console. Monitor
  wall, fixed desk layout, visual hazard/reaction effects, Discovery overlay
  and new audio presentation remain slice 2. Flood fill/surge tuning and
  whether START requires the fan remain unchanged/open. No all-lost ending
  was added; the old report check is retained (normally unreachable with
  everyone lost because Ruth is immortal).

## 2026-11-22 — Control Room v2 slice 2: presentation
- **Fixed workstation:** the monitor rack occupies 56% of the available wide
  play area and the five-panel desk 44%. The main CRT starts on Chamber A;
  the other three feeds stay live beside it. GRID multiplexes all four inside
  the main bezel, retaining the three external feeds and the current focus.
  Removed BOARD and key B, including the remembered layout preference.
- **Hardware reuse:** extend the existing steel panels, gauges, bat handles,
  rockers, guards and spring buttons. The ammeter belongs in POWER; aux and
  level gauges in CHAMBER SYSTEMS; three red-band temperature gauges in
  ENVIRONMENT. Selector handles show requested positions even after a trip;
  adjacent lamps show live power. Fan FORCE preview uses its requested draw.
- **Immediate but guarded:** E-STOP requires lifting its cover then one press;
  it recloses immediately. DRAIN retains guard plus hold. Rotaries accept
  direct detent clicks, dial cycling, dragging and keyboard arrows/Home/End.
  Re-pressing a rejected detent confirms FORCE. Branch reset buttons expose
  white pop-out trip collars independently of switch handles.
- **Preserve Cell C:** keep its existing Operator door rocker alongside A/B,
  because accepted scenario actions and inspection text already expose it.
  Ruth's isolators, main reset, damper and release remain hers; their desk
  indicators are read-only.
- **Fit without relocating controls:** desktop refusals and the unlocked
  override bay overlay the desk rather than increasing its height. On phones
  the main feed and three previews remain above tabs, while the selected
  panel scrolls internally. The override bay flows within that narrow desk.
- **Camera cost and hazard legibility:** cached procedural rooms, reduced
  small-feed resolution and 12 fps previews; the main focused feed retains
  normal animation. Smoke, heat and reaction motion use simulation time;
  camera static uses presentation time. IR exposes dark rooms and B's lore;
  A's thermochromic text fades in with warmth. Death bodies remain on camera;
  Ruth's persistent collapsed pose remains distinct from loss.
- **Discoveries:** a separate clipboard shows found entries and blank unknown
  slots. A short, non-blocking observation stamp announces new entries.
  Voice commentary uses the existing PA subtitles. Synthesised mechanical
  sounds and facility loops retain the existing buses/master compressor.
