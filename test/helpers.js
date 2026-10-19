import { createGame } from '../src/engine/game.js';
import { threeChambers } from '../src/scenarios/three-chambers/index.js';
import { onPlate } from '../src/scenarios/three-chambers/mechanics.js';

export const newGame = (seed = 7) => createGame(threeChambers, { seed });

export function waitUntil(g, pred, max = 120, step = 0.1, what = 'condition') {
  let waited = 0;
  while (!pred() && waited < max) {
    if (g.state.over) break;
    g.advance(step);
    waited += step;
  }
  if (!pred()) throw new Error(`timed out after ${max}s waiting for ${what}`);
  return waited;
}

// Use an intercom option the way a player would: wait for the channel, speak, let the reply start.
export function say(g, pid, option) {
  const p = g.state.prisoners[pid];
  waitUntil(g, () => g.state.t >= p.talkLock, 10, 0.05, `${pid} channel`);
  const r = g.dispatch({ type: 'say', pid, option });
  if (!r.ok) throw new Error(`say ${pid}/${option} failed: ${r.msg} (options: ${g.options(pid).map(o => o.id).join(', ')})`);
  g.advance(0.7);
  return r;
}

export const idle = (g, pid, max = 40) => waitUntil(g, () => !g.state.prisoners[pid].task, max, 0.1, `${pid} idle`);
export const ctl = (g, id, payload) => g.dispatch({ type: 'control', id, payload });
export const power = (g, circuit, on, force = false) => g.dispatch({ type: 'power', circuit, on, force });
export const optionIds = (g, pid) => g.options(pid).map(o => o.id);

export function enterCode(g, code) {
  for (const symbol of code) {
    const r = ctl(g, 'restraint', { action: 'key', symbol });
    if (!r.ok) throw new Error(`key ${symbol}: ${r.msg}`);
  }
  return ctl(g, 'restraint', { action: 'submit' });
}

// Phase helpers built only from player actions.
export function freeNadia(g) {
  say(g, 'C', 'c-calm');
  say(g, 'C', 'c-look');
  say(g, 'A', 'a-calm');
  say(g, 'A', 'a-plate');
  say(g, 'C', 'c-iso-lightsA');
  idle(g, 'C');
  const r = power(g, 'lightsA', true);
  if (!r.ok) throw new Error(r.msg);
  waitUntil(g, () => g.state.s.symbols === 4, 5, 0.1, 'full symbols');
  const res = enterCode(g, g.state.s.code);
  if (!res.ok) throw new Error(res.msg);
}

export function nadiaJobs(g) {
  say(g, 'A', 'a-look');
  say(g, 'A', 'a-lever');
  idle(g, 'A');
  say(g, 'A', 'a-crank');
  idle(g, 'A');
}

export function prepFlood(g) {
  say(g, 'B', 'b-calm');
  say(g, 'B', 'b-sign');
  say(g, 'C', 'c-iso-pump');
  idle(g, 'C');
  power(g, 'incinerator', false);
  power(g, 'pump', true);
  power(g, 'lightsA', false);
  const r = power(g, 'vent', true);
  if (!r.ok) throw new Error(r.msg);
}

export function survivFlood(g) {
  say(g, 'B', 'b-intake');
  waitUntil(g, () => g.state.s.flood.intake === 'leaking', 30, 0.1, 'intake closed');
  say(g, 'C', 'c-damper');
  waitUntil(g, () => g.state.s.flood.damper, 30, 0.1, 'damper open');
  g.advance(0.2);
  const r = ctl(g, 'relief');
  if (!r.ok) throw new Error(r.msg);
  waitUntil(g, () => g.state.s.flood.phase === 'done', 30, 0.1, 'flood drained');
}

export function prepFinal(g) {
  if (g.state.prisoners.B.alive) {
    waitUntil(g, () => g.state.s.know.plate, 10, 0.1, 'plate known');
    say(g, 'B', 'b-plate');
    waitUntil(g, () => onPlate(g.api), 30, 0.1, 'Theo on the plate');
  }
  say(g, 'C', 'c-iso-exit');
  idle(g, 'C');
  power(g, 'pump', false);
  power(g, 'vent', false);
  const r = power(g, 'exit', true);
  if (!r.ok) throw new Error(r.msg);
}

// Pull the release and talk everyone who freezes out of the building.
export function escapeAll(g) {
  say(g, 'C', 'c-release');
  waitUntil(g, () => g.state.s.exit.open, 20, 0.1, 'exit open');
  waitUntil(g, () => g.state.over || ['A', 'B', 'C'].some(id => g.state.prisoners[id].hesitating || g.state.prisoners[id].task?.kind === 'escape'), 15, 0.1, 'reaction to the exit');
  for (let i = 0; i < 400 && !g.state.over; i++) {
    for (const id of ['A', 'B', 'C']) {
      const p = g.state.prisoners[id];
      if (p.alive && !p.escaped && p.hesitating && g.state.t >= p.talkLock) say(g, id, `${id.toLowerCase()}-calm`);
    }
    g.advance(0.1);
  }
}
