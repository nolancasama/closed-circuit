import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOOD, EXIT } from '../src/config.js';
import { onPlate } from '../src/scenarios/three-chambers/mechanics.js';
import {
  newGame, say, idle, ctl, power, waitUntil, enterCode, optionIds,
  freeNadia, nadiaJobs, prepFlood, survivFlood, prepFinal, escapeAll,
} from './helpers.js';

test('full rescue: all three walk out', () => {
  const g = newGame(7);
  freeNadia(g);
  assert.equal(g.state.s.restraint.released, true);
  assert.equal(g.state.prisoners.A.immobile, false);
  nadiaJobs(g);
  assert.equal(g.state.s.aux, 'stable');
  assert.equal(g.state.s.boltA, true);
  prepFlood(g);
  assert.equal(g.api.load(), 9);
  const start = ctl(g, 'drain');
  assert.equal(start.ok, true, start.msg);
  assert.equal(g.state.s.flood.phase, 'filling');
  survivFlood(g);
  assert.equal(g.state.prisoners.B.alive, true);
  assert.equal(g.state.prisoners.B.tether, null);
  prepFinal(g);
  assert.equal(g.api.load(), 7);
  escapeAll(g);
  assert.equal(g.state.over, true);
  assert.equal(g.state.ending.kind, 'complete');
  assert.equal(g.state.ending.rescued, 3);
  assert.deepEqual(g.state.ending.fates.map(f => f.fate), ['escaped', 'escaped', 'escaped']);
});

test('the flood starts only when the drain cycle is started, and only once', () => {
  const g = newGame(3);
  freeNadia(g);
  nadiaJobs(g);
  prepFlood(g);
  g.advance(20);
  assert.equal(g.state.s.flood.phase, 'idle');
  assert.equal(g.state.s.flood.level, 0);
  g.drainEvents();
  assert.equal(ctl(g, 'drain').ok, true);
  const again = ctl(g, 'drain');
  assert.equal(again.ok, false);
  const alarms = g.drainEvents().filter(e => e.type === 'alarm' && e.on);
  assert.equal(alarms.length, 1);
});

test('drain cycle is inhibited until aux pressure and pump power are ready', () => {
  const g = newGame(5);
  assert.match(ctl(g, 'drain').msg, /ISOLATED/);
  say(g, 'C', 'c-iso-pump');
  idle(g, 'C');
  assert.match(ctl(g, 'drain').msg, /SWITCHED OFF/);
  power(g, 'incinerator', false);
  power(g, 'pump', true);
  assert.match(ctl(g, 'drain').msg, /AUX PRESSURE/);
  assert.equal(g.state.s.flood.phase, 'idle');
});

test('flood failure: Theo is lost after ~90 s, the game continues, and plate B can be overridden', () => {
  const g = newGame(11);
  freeNadia(g);
  nadiaJobs(g);
  prepFlood(g);
  ctl(g, 'drain');
  const t0 = g.state.t;
  waitUntil(g, () => g.state.s.flood.phase === 'failed', 120, 0.1, 'flood failure');
  const took = g.state.t - t0;
  assert.ok(Math.abs(took - FLOOD.fillTime * FLOOD.lethal) < 1.5, `took ${took}`);
  assert.equal(g.state.prisoners.B.alive, false);
  assert.equal(g.state.over, false);
  assert.ok(g.controls().some(c => c.id === 'ov-plateB'));
  waitUntil(g, () => g.state.s.operatorDoor, 30, 0.1, 'walk-away offer');
  assert.equal(ctl(g, 'ov-plateB').ok, true);
  prepFinal(g);
  escapeAll(g);
  assert.equal(g.state.ending.rescued, 2);
  assert.equal(g.state.ending.fates.find(f => f.id === 'B').fate, 'lost');
});

test('three wrong sequences lose Nadia; overrides keep the scenario solvable', () => {
  const g = newGame(13);
  const wrong = ['blue-circle', 'blue-circle', 'blue-circle', 'blue-circle'];
  assert.notDeepEqual(g.state.s.code, wrong);
  const r1 = enterCode(g, wrong);
  assert.equal(r1.ok, false);
  assert.equal(g.state.s.restraint.attempts, 2);
  assert.equal(g.state.prisoners.A.alive, true);
  enterCode(g, wrong);
  assert.match(enterCode(g, wrong).msg, /CHAIR ENGAGED/);
  assert.equal(g.state.prisoners.A.alive, false);
  assert.ok(g.controls().some(c => c.id === 'ov-aux'));
  assert.ok(g.controls().some(c => c.id === 'ov-boltA'));
  assert.equal(ctl(g, 'ov-aux').ok, true);
  assert.equal(g.state.s.aux, 'forced');
  assert.equal(ctl(g, 'ov-boltA').ok, true);
  say(g, 'C', 'c-calm');
  say(g, 'C', 'c-look');
  prepFlood(g);
  ctl(g, 'drain');
  const t0 = g.state.t;
  // Forced aux fills faster: check the rate rather than drowning Theo.
  g.advance(1);
  const expected = (1 / FLOOD.fillTime) * FLOOD.forcedAuxMul;
  assert.ok(Math.abs(g.state.s.flood.rate - expected) < 1e-9);
  assert.ok(g.state.t > t0);
  survivFlood(g);
  prepFinal(g);
  escapeAll(g);
  assert.equal(g.state.ending.rescued, 2);
  assert.equal(g.state.ending.fates.find(f => f.id === 'A').fate, 'lost');
});

test('wrong order costs time, never instant death: relief refusals and the vent surge', () => {
  const g = newGame(17);
  freeNadia(g);
  nadiaJobs(g);
  prepFlood(g);
  ctl(g, 'drain');
  let r = ctl(g, 'relief');
  assert.equal(r.ok, false);
  assert.match(r.msg, /INTAKE PRESSURE/);
  r = ctl(g, 'relief');
  assert.match(r.msg, /RESETTING/);
  // Damper before intake: surge.
  say(g, 'C', 'c-damper');
  const before = g.state.s.flood.level;
  waitUntil(g, () => g.state.s.flood.damper, 30, 0.05, 'damper');
  g.advance(0.05);
  assert.ok(g.state.s.flood.level - before >= FLOOD.surge, 'surge applied');
  assert.equal(g.state.prisoners.B.alive, true);
  // Close the damper again, close the intake: relief refuses with VACUUM LOCK.
  say(g, 'C', 'c-damper-close');
  idle(g, 'C');
  say(g, 'B', 'b-intake');
  waitUntil(g, () => g.state.s.flood.intake === 'leaking', 30);
  g.advance(3.1);
  r = ctl(g, 'relief');
  assert.match(r.msg, /VACUUM LOCK/);
  assert.equal(g.state.s.flood.phase, 'filling');
});

test('overload: force trips the main; resetting under load trips again; reset holds after shedding load', () => {
  const g = newGame(19);
  say(g, 'C', 'c-iso-pump');
  idle(g, 'C');
  power(g, 'pump', true); // 2 + 4 + 4 = 10, fine
  let r = power(g, 'vent', true);
  assert.equal(r.code, 'overload-risk');
  assert.equal(g.state.power.tripped, false);
  r = power(g, 'vent', true);
  assert.equal(r.code, 'tripped');
  assert.equal(g.state.power.tripped, true);
  assert.equal(g.api.live('lightsBC'), false);
  say(g, 'C', 'c-main');
  idle(g, 'C');
  assert.equal(g.state.power.tripped, true, 'still overloaded');
  power(g, 'incinerator', false);
  say(g, 'C', 'c-main');
  idle(g, 'C');
  assert.equal(g.state.power.tripped, false);
  assert.equal(g.api.live('vent'), true);
  assert.equal(g.state.stats.overloads, 2);
});

test('walk away ends the shift and leaves everyone inside behind', () => {
  const g = newGame(23);
  freeNadia(g);
  nadiaJobs(g);
  prepFlood(g);
  ctl(g, 'drain');
  survivFlood(g);
  assert.ok(!g.controls().some(c => c.id === 'leave'));
  waitUntil(g, () => g.state.s.operatorDoor, 40, 0.1, 'walk-away offer');
  assert.equal(ctl(g, 'leave').ok, true);
  assert.equal(g.state.over, true);
  assert.equal(g.state.ending.kind, 'walked');
  assert.equal(g.state.ending.rescued, 0);
  assert.ok(g.state.ending.fates.every(f => f.fate === 'left'));
});

test('if the exit closes on someone, it can be reopened', () => {
  const g = newGame(29);
  freeNadia(g);
  nadiaJobs(g);
  prepFlood(g);
  ctl(g, 'drain');
  survivFlood(g);
  prepFinal(g);
  say(g, 'C', 'c-release');
  waitUntil(g, () => g.state.s.exit.open, 20, 0.1, 'exit open');
  // Nobody talks anyone down: hesitators wait out the door.
  waitUntil(g, () => !g.state.s.exit.open, EXIT.openTime + 2, 0.1, 'exit closed');
  const inside = ['A', 'B', 'C'].filter(id => !g.state.prisoners[id].escaped);
  assert.ok(inside.length > 0, 'someone hesitated past the timer');
  assert.equal(g.state.over, false);
  waitUntil(g, () => inside.every(id => g.state.prisoners[id].task?.kind === 'escape'), EXIT.hesitateMax, 0.1, 'hesitation ends');
  g.advance(3);
  for (const id of inside) assert.equal(g.state.prisoners[id].escaped, false, `${id} did not pass a closed door`);
  const c = g.state.prisoners.C;
  if (!c.escaped && c.loc === 'C') {
    say(g, 'C', 'c-release');
  } else {
    assert.ok(g.controls().some(k => k.id === 'ov-exit'));
    assert.equal(ctl(g, 'ov-exit').ok, true);
  }
  waitUntil(g, () => g.state.over, 60, 0.1, 'ending');
  assert.equal(g.state.ending.rescued, 3);
});

test('cell doors: interlocked while restrained, and prisoners never pass a closed door', () => {
  const g = newGame(31);
  let r = g.dispatch({ type: 'door', door: 'A', open: true });
  assert.equal(r.ok, false);
  assert.match(r.msg, /RESTRAINED/);
  freeNadia(g);
  assert.ok(!optionIds(g, 'A').includes('A-out'), 'no hall option while the door is shut');
  r = g.dispatch({ type: 'door', door: 'A', open: true });
  assert.equal(r.ok, true);
  say(g, 'A', 'A-out');
  const a = g.state.prisoners.A;
  waitUntil(g, () => a.loc === 'hall' && a.task?.steps[a.task.i]?.k === 'hold', 20, 0.1, 'Nadia waiting in the hall');
  g.dispatch({ type: 'door', door: 'A', open: false });
  // Back to the room: the door is shut, so the task fails with an explanation.
  say(g, 'A', 'A-back');
  waitUntil(g, () => !g.state.prisoners.A.task, 20, 0.1, 'task ends');
  assert.equal(g.state.prisoners.A.loc, 'hall');
  assert.ok(g.state.log.some(l => l.kind === 'A' && /door/i.test(l.text)));
  assert.equal(g.dispatch({ type: 'door', door: 'exit', open: true }).ok, false);
});

test('knowledge gates intercom options; Theo cannot leave the chain radius', () => {
  const g = newGame(37);
  freeNadia(g);
  assert.ok(!optionIds(g, 'A').includes('a-lever'), 'nobody has mentioned the lever yet');
  say(g, 'A', 'a-look');
  assert.ok(optionIds(g, 'A').includes('a-lever'));
  const g2 = newGame(37);
  assert.ok(!optionIds(g2, 'C').includes('c-release'));
  say(g2, 'C', 'c-look');
  assert.ok(optionIds(g2, 'C').includes('c-release'));
  assert.ok(!optionIds(g2, 'B').includes('b-plate'));
  for (let i = 0; i < 600; i++) {
    g2.advance(0.1);
    const b = g2.state.prisoners.B;
    assert.ok(b.x >= 64 - 0.01 && b.x <= 300 + 0.01, `Theo at ${b.x}`);
  }
});

test('impossible commands are explained by the prisoner', () => {
  const g = newGame(41);
  say(g, 'C', 'c-look');
  say(g, 'C', 'c-release');
  idle(g, 'C');
  waitUntil(g, () => g.state.log.some(l => l.kind === 'C' && /won't move/.test(l.text)), 10, 0.1, "Ruth's explanation");
  assert.ok(g.state.log.some(l => /FINAL RELEASE BLOCKED — BOLT A, BOLT B, POWER/.test(l.text)));
});

test('Theo on the plate holds bolt B only while standing on it', () => {
  const g = newGame(43);
  freeNadia(g);
  nadiaJobs(g);
  prepFlood(g);
  ctl(g, 'drain');
  survivFlood(g);
  waitUntil(g, () => g.state.s.know.plate, 10);
  say(g, 'B', 'b-plate');
  waitUntil(g, () => onPlate(g.api), 30);
  assert.ok(optionIds(g, 'B').every(id => id !== 'B-stop'));
  say(g, 'B', 'b-look');
  assert.equal(onPlate(g.api), true, 'talking does not move Theo');
});
