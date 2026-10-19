import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { newGame, say, ctl, waitUntil } from './helpers.js';

test('same seed, same game; restarting gives a clean state', () => {
  const a = newGame(99), b = newGame(99);
  assert.deepEqual(a.state.s.code, b.state.s.code);
  a.advance(30);
  b.advance(30);
  assert.equal(a.state.prisoners.B.x, b.state.prisoners.B.x);
  const fresh = newGame(99);
  assert.equal(fresh.state.t, 0);
  assert.equal(fresh.state.s.flood.phase, 'idle');
  assert.equal(fresh.state.power.tripped, false);
  assert.equal(fresh.state.doors.exit.open, false);
  assert.equal(fresh.state.prisoners.A.immobile, true);
});

test('pause freezes sim time, timers and commands', () => {
  const g = newGame(1);
  g.tick(1);
  const t = g.state.t;
  g.dispatch({ type: 'pause' });
  g.tick(5);
  assert.equal(g.state.t, t);
  assert.equal(g.dispatch({ type: 'say', pid: 'C', option: 'c-calm' }).ok, false);
  g.dispatch({ type: 'resume' });
  g.tick(0.5);
  assert.ok(g.state.t > t);
});

test('a huge frame is clamped (tab returning from the background)', () => {
  const g = newGame(1);
  g.tick(30);
  assert.ok(g.state.t <= 0.26);
});

test('rapid clicking does not duplicate intercom commands', () => {
  const g = newGame(2);
  const first = g.dispatch({ type: 'say', pid: 'C', option: 'c-calm' });
  const second = g.dispatch({ type: 'say', pid: 'C', option: 'c-calm' });
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  g.advance(1);
  const youLines = g.state.log.filter(l => l.kind === 'you');
  assert.equal(youLines.length, 1);
});

test('task commands are refused while a prisoner is busy; stop always works', () => {
  const g = newGame(3);
  say(g, 'C', 'c-iso-pump');
  waitUntil(g, () => g.state.t >= g.state.prisoners.C.talkLock, 5, 0.05, 'channel free');
  assert.ok(g.state.prisoners.C.task, 'still walking to the board');
  const opts = g.options('C');
  assert.equal(opts.find(o => o.id === 'c-iso-lightsA').enabled, false);
  assert.equal(opts.find(o => o.id === 'C-stop').enabled, true);
  say(g, 'C', 'C-stop');
  assert.equal(g.state.prisoners.C.task, null);
  assert.equal(g.state.power.circuits.pump.isolated, true);
});

test('panicked prisoners only get calming options', () => {
  const g = newGame(4);
  const a = g.state.prisoners.A;
  assert.equal(a.panicked, true);
  assert.ok(g.options('A').every(o => o.id === 'a-calm'));
  say(g, 'A', 'a-calm');
  assert.equal(a.panicked, false);
  assert.ok(g.options('A').length > 1);
});

test('every visible console control does something when pressed', () => {
  const g = newGame(5);
  for (const c of g.controls()) {
    if (c.kind === 'status') continue;
    const payload = c.kind === 'keypad' ? { action: 'clear' } : undefined;
    const r = ctl(g, c.id, payload);
    assert.equal(typeof r.ok, 'boolean', c.id);
    assert.equal(typeof r.msg, 'string', c.id);
    if (!r.ok) assert.ok(r.msg.length > 0, `${c.id} explains its refusal`);
  }
});

test('the restraint keypad never submits a short sequence and mirrors entry in state', () => {
  const g = newGame(6);
  ctl(g, 'restraint', { action: 'key', symbol: 'red-circle' });
  assert.deepEqual(g.state.s.restraint.entry, ['red-circle']);
  const r = ctl(g, 'restraint', { action: 'submit' });
  assert.equal(r.ok, false);
  assert.equal(g.state.s.restraint.attempts, 3);
  ctl(g, 'restraint', { action: 'back' });
  assert.deepEqual(g.state.s.restraint.entry, []);
});

test('unattended prisoners call out, and stall hints arrive', () => {
  const g = newGame(8);
  waitUntil(g, () => g.state.log.some(l => l.kind === 'C'), 40, 0.5, 'Ruth calls out');
  say(g, 'C', 'c-calm');
  say(g, 'A', 'a-calm');
  say(g, 'A', 'a-plate');
  waitUntil(g, () => g.state.log.some(l => l.kind === 'C' && /LIGHTS A is isolated/.test(l.text)), 60, 0.5, 'lights hint');
});

test('the sim and scenario stay headless (no DOM, Math.random or Date.now)', async () => {
  const dirs = ['src/engine', 'src/scenarios/three-chambers'];
  for (const dir of dirs) {
    for (const f of await readdir(new URL(`../${dir}/`, import.meta.url))) {
      const src = await readFile(new URL(`../${dir}/${f}`, import.meta.url), 'utf8');
      assert.ok(!/Math\.random|Date\.now|document\.|window\./.test(src), `${dir}/${f}`);
    }
  }
});
