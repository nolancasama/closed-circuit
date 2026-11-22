import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, power } from './helpers.js';
import * as Discoveries from '../src/engine/discoveries.js';
import * as Voice from '../src/engine/commentary.js';
import { discoveries } from '../src/scenarios/three-chambers/discoveries.js';
import { commentary } from '../src/scenarios/three-chambers/commentary.js';
import { COMMENTARY } from '../src/config.js';

function quietGame() {
  const g = newGame();
  g.state.lines = [];
  g.state.timers = [];
  g.state.scriptedUntil = 0;
  g.state.events = [];
  Discoveries.init(g.api, discoveries);
  Voice.init(g.api);
  return g;
}

test('twelve data-driven discoveries expose metadata and fire once', () => {
  const g = quietGame();
  g.state.facility = { facts: { steamWithoutFire: true, warmedTheo: true, warmWriting: true } };
  Discoveries.update(g.api, discoveries);
  assert.equal(g.state.discoveries.total, 12);
  assert.deepEqual(g.state.discoveries.found.map(d => d.id), ['cold-boiler', 'warmth-for-theo', 'warm-writing']);
  assert.ok(g.state.discoveries.found.every(d => d.title && d.text && d.time === g.state.t));
  const events = g.state.events.filter(e => e.type === 'discovery');
  assert.equal(events.length, 3);
  Discoveries.update(g.api, discoveries);
  assert.equal(g.state.discoveries.found.length, 3);
});

test('all scenario discovery predicates are pure and correspond to their facility fact', () => {
  const g = quietGame();
  g.state.facility = { facts: {} };
  assert.ok(discoveries.every(d => !d.when(g.state)));
  Object.assign(g.state.facility.facts, {
    steamWithoutFire: true, fanSpeedChanged: true, backdraft: true,
    embersAfterTrip: true, waterShort: true, emergencyStop: true,
    cleanRecovery: true, darkWork: true, highFloodVent: true,
    warmedTheo: true, warmWriting: true, irWriting: true,
  });
  const before = JSON.stringify(g.state);
  assert.ok(discoveries.every(d => d.when(g.state)));
  assert.equal(JSON.stringify(g.state), before);
});

test('a death grants no discoveries in that step or as a delayed reward', () => {
  const g = quietGame();
  g.state.facility = { facts: { waterShort: true, emergencyStop: true } };
  g.state.prisoners.B.alive = false;
  Discoveries.observe(g.api, { type: 'lost', pid: 'B' });
  Discoveries.update(g.api, discoveries);
  assert.equal(g.state.discoveries.found.length, 0);
  g.state.t += 1;
  Discoveries.update(g.api, discoveries);
  assert.equal(g.state.discoveries.found.length, 0);
  // A fresh independent experiment remains eligible after someone was lost.
  g.state.facility.facts.fanSpeedChanged = true;
  Discoveries.update(g.api, discoveries);
  assert.deepEqual(g.state.discoveries.found.map(d => d.id), ['fan-load']);
});

test('Voice waits for all speech and scripted beats, obeys global cooldown and speaks each line once', () => {
  const g = quietGame();
  Voice.observe(g.api, { type: 'main-trip' }, commentary);
  g.state.lines.push({ start: 0, end: 2, speaker: 'B', text: 'Wait.' });
  Voice.update(g.api, commentary);
  assert.equal(g.state.commentary.used.length, 0);
  g.state.lines = [];
  g.state.scriptedUntil = 3;
  Voice.update(g.api, commentary);
  assert.equal(g.state.commentary.used.length, 0);
  g.state.t = 3 + COMMENTARY.scriptedGap - 0.1;
  Voice.update(g.api, commentary);
  assert.equal(g.state.commentary.used.length, 0);
  g.state.t = 3 + COMMENTARY.scriptedGap;
  Voice.update(g.api, commentary);
  assert.deepEqual(g.state.commentary.used, ['first-trip']);
  Voice.observe(g.api, { type: 'main-trip' }, commentary);
  Voice.observe(g.api, { type: 'main-trip' }, commentary);
  assert.equal(g.state.commentary.pending.filter(p => p.id === 'repeated-trips').length, 1);
  g.state.lines = [];
  g.state.t = 3 + COMMENTARY.scriptedGap + COMMENTARY.cooldown - 1;
  Voice.update(g.api, commentary);
  assert.equal(g.state.commentary.used.length, 1);
  g.state.t += 1;
  Voice.update(g.api, commentary);
  assert.deepEqual(g.state.commentary.used, ['first-trip', 'repeated-trips']);
  Voice.observe(g.api, { type: 'main-trip' }, commentary);
  assert.equal(g.state.commentary.pending.length, 0);
});

test('an opening blackout cannot put contextual Voice commentary ahead of the boot introduction', () => {
  const g = newGame();
  power(g, 'lightsB', false);
  g.advance(0.1);
  assert.ok(g.state.commentary.pending.some(entry => entry.id === 'secret-found'));
  assert.equal(g.state.commentary.used.length, 0);
  assert.ok(!g.state.lines.some(line => line.kind === 'commentary'));

  g.advance(1.2);
  const introduction = g.state.lines.filter(line => line.speaker === 'pa');
  assert.equal(introduction.length, 3);
  assert.match(introduction[0].text, /Good evening, Operator/);
  const end = introduction.at(-1).end;
  while (g.state.t < end + COMMENTARY.scriptedGap - 0.1) g.advance(0.05);
  assert.equal(g.state.commentary.used.length, 0);
  // Wait through any prisoner speech already queued by the opening beats.
  while (!g.state.commentary.used.length && g.state.t < end + COMMENTARY.scriptedGap + 20) g.advance(0.05);
  const comment = g.state.lines.find(line => line.kind === 'commentary');
  assert.ok(comment);
  assert.ok(comment.start >= end + COMMENTARY.scriptedGap);
  assert.ok(!g.state.lines.some(line => line !== comment && line.start <= comment.start && line.end > comment.start));
});

test('a pending comment waits for a later scripted PA beat and its quiet gap', () => {
  const g = quietGame();
  Voice.observe(g.api, { type: 'e-stop' }, commentary);
  const beat = g.api.pa('Operator. Your own door is unlocked now.');
  g.state.t = beat.end + COMMENTARY.scriptedGap - 0.1;
  Voice.update(g.api, commentary);
  assert.equal(g.state.commentary.used.length, 0);
  g.state.t = beat.end + COMMENTARY.scriptedGap;
  g.state.lines = [];
  g.api.say('B', 'Wait.');
  Voice.update(g.api, commentary);
  assert.equal(g.state.commentary.used.length, 0);
  g.state.t = g.state.lines.at(-1).end;
  Voice.update(g.api, commentary);
  assert.deepEqual(g.state.commentary.used, ['first-estop']);
});

test('Voice queues environmental observations and prioritises the single restrained-Nadia lie', () => {
  const g = quietGame();
  Voice.observe(g.api, { type: 'e-stop' }, commentary);
  Voice.observe(g.api, { type: 'steam-heat', room: 'A' }, commentary);
  Voice.observe(g.api, { type: 'steam-heat', room: 'A' }, commentary);
  Voice.update(g.api, commentary);
  assert.deepEqual(g.state.commentary.used, ['steam-a-lie']);
  assert.match(g.state.lines.at(-1).text, /rated for it/);
  Voice.observe(g.api, { type: 'facility-danger', room: 'B' }, commentary);
  Voice.observe(g.api, { type: 'facility-defused', room: 'B' }, commentary);
  Voice.observe(g.api, { type: 'facility-defused', room: 'C' }, commentary);
  g.state.prisoners.A.lostCause = 'heat';
  Voice.observe(g.api, { type: 'lost', pid: 'A' }, commentary);
  Voice.observe(g.api, { type: 'main-reset', clean: true }, commentary);
  Voice.observe(g.api, { type: 'discovery', id: 'infrared-writing' }, commentary);
  assert.deepEqual(g.state.commentary.pending.map(p => p.id), ['first-estop', 'danger-defused', 'environmental-loss', 'clean-recovery', 'secret-found']);
});

test('the steam lie is unavailable after the first A setting or after Nadia is free', () => {
  const g = quietGame();
  g.state.prisoners.A.immobile = false;
  Voice.observe(g.api, { type: 'steam-heat', room: 'A' }, commentary);
  g.state.prisoners.A.immobile = true;
  Voice.observe(g.api, { type: 'steam-heat', room: 'A' }, commentary);
  assert.ok(!g.state.commentary.pending.some(p => p.id === 'steam-a-lie'));
});
