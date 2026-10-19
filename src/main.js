// Boot: build presentation once, create a game per shift, run the frame loop.
import { createGame } from './engine/game.js';
import { threeChambers } from './scenarios/three-chambers/index.js';
import { createRenderer } from './render/renderer.js';
import { createAudio } from './audio/audio.js';
import { createApp } from './ui/app.js';

const renderer = createRenderer();
const audio = createAudio();
let game = null;

const app = createApp({ renderer, audio, onRestart: () => start(true) });

function seedFor() {
  const fixed = new URLSearchParams(location.search).get('seed');
  if (fixed && /^\d+$/.test(fixed)) return Number(fixed);
  return (Math.floor(Math.random() * 2 ** 31) ^ Date.now()) >>> 0;
}

// Restarting builds a brand-new game, so every timer, prisoner, door and circuit resets.
function start(immediately) {
  game = createGame(threeChambers, { seed: seedFor() });
  game.dispatch({ type: 'pause' });
  renderer.setGame(game);
  app.setGame(game, immediately);
}

let last = 0;
function frame(ts) {
  const now = ts / 1000;
  const dt = last ? now - last : 0;
  last = now;
  game.tick(dt);
  const events = game.drainEvents();
  if (events.length) {
    renderer.onEvents(events);
    audio.onEvents(events);
    app.onEvents(events);
  }
  audio.update(game, app.focus);
  renderer.render(now);
  app.update(now);
  requestAnimationFrame(frame);
}

start(false);
requestAnimationFrame(frame);

// Handle for automated checks and debugging.
window.__cc = { get game() { return game; }, app, renderer, audio };
