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
