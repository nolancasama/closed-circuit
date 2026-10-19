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
