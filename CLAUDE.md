# Closed Circuit

Browser 2D surveillance horror puzzle game (Canvas 2D, vanilla ES modules).

- **`SPEC.md` is the authoritative design.** Read it before changing behaviour.
  Record new meaningful decisions in `DESIGN_DECISIONS.md`.
- Run: `npm start` (or `start.bat`) → http://localhost:5181. Tests: `npm test`.
  Browser smoke: `npm run smoke` (plays a full shift headless; needs Playwright,
  or `PLAYWRIGHT_DIR` pointing at a folder that has it; `-- --shots dir` saves PNGs).
- `src/engine/`, `src/scenarios/`, `src/config.js` are pure and headless (no DOM,
  no `Math.random`, no `Date.now`). Rendering/UI/audio read state, drain
  `game.drainEvents()`, and change the game only through `game.dispatch`.
- All tuning numbers live in `src/config.js`.
- No external assets, CDNs or web fonts: graphics are procedural Canvas and
  audio is synthesised WebAudio.
