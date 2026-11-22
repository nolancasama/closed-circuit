import test from 'node:test';
import assert from 'node:assert/strict';
import { FACILITY, POWER } from '../src/config.js';
import { newGame, ctl, power, waitUntil, say, idle, prepFlood, survivFlood, prepFinal, escapeAll, freeNadia, nadiaJobs } from './helpers.js';

const fan = (g, speed) => ctl(g, 'fan-speed', { speed });
const steam = (g, room) => ctl(g, 'steam-heat', { room });
const branch = (g, circuit) => ctl(g, 'branch-reset', { circuit });

test('five idle minutes stay clear and safe without hazard warnings', () => {
  const g = newGame(7);
  for (let second = 0; second < 300; second++) {
    g.advance(1);
    for (const room of Object.values(g.state.facility.rooms)) {
      assert.ok(room.smoke < FACILITY.smoke.cough);
      assert.ok(!['dangerous', 'lethal'].includes(room.heatBand));
    }
    for (const p of Object.values(g.state.prisoners)) assert.ok(!p.collapsed && !p.retreating);
  }
  assert.equal(g.state.facility.flueExposure, 0);
  assert.ok(!g.state.events.some(e => ['facility-danger', 'branch-trip'].includes(e.type)));
  assert.ok(!g.state.log.some(e => e.kind === 'warn' || e.kind === 'alert'));
});

test('ordinary embers cough and retreat briefly without collapse; prompt extraction limits haze', () => {
  for (const extract of [false, true]) {
    const g = newGame();
    power(g, 'incinerator', false);
    let peak = 0, denseSeconds = 0, retreated = false, coughed = false;
    for (let second = 0; second < 120; second++) {
      if (extract && second === 15) fan(g, 'MED');
      g.advance(1);
      const room = g.state.facility.rooms.C;
      peak = Math.max(peak, room.smoke);
      denseSeconds += room.dense ? 1 : 0;
      retreated ||= g.state.prisoners.C.retreating;
      coughed ||= room.coughing;
      assert.equal(g.state.prisoners.C.collapsed, false);
    }
    assert.equal(g.state.s.flood.damper, false);
    assert.ok(coughed);
    if (extract) {
      assert.ok(peak < FACILITY.smoke.retreat);
      assert.equal(retreated, false);
      assert.equal(g.state.facility.airflow, 0, 'flood airflow still needs the damper');
      assert.equal(g.state.facility.extraction, POWER.fanFlow.MED);
    } else {
      assert.ok(retreated);
      assert.ok(peak > FACILITY.smoke.dense - 0.05 && peak < FACILITY.smoke.dense + 0.05);
      assert.ok(denseSeconds < FACILITY.smoke.collapseTime / 2);
    }
  }
});

test('hot main trip and E-STOP collapse Ruth within a minute; extractor clears and recovers her', () => {
  for (const stop of ['trip', 'e-stop']) {
    const g = newGame();
    steam(g, 'B');
    g.advance(FACILITY.emberHeatTime);
    if (stop === 'trip') g.api.trip();
    else ctl(g, 'e-stop');
    g.advance(60);
    assert.ok(g.state.facility.rooms.C.dense);
    assert.equal(g.state.prisoners.C.collapsed, true);
    assert.equal(g.state.prisoners.C.alive, true);
    power(g, 'incinerator', false);
    if (stop === 'trip') g.api.resetMain();
    fan(g, 'HIGH');
    g.advance(25);
    assert.equal(g.state.prisoners.C.collapsed, false);
    assert.equal(g.state.prisoners.C.retreating, false);
    assert.equal(g.state.facility.rooms.C.coughing, false);
  }
});

test('smoke slows Ruth operating tasks with lights on', () => {
  const g = newGame();
  g.state.facility.rooms.C.smoke = FACILITY.smoke.retreat;
  g.api.task('C', { kind: 'test', steps: [{ k: 'op', dur: 2 }] });
  g.advance(2.2);
  assert.ok(g.state.prisoners.C.task);
  g.advance(2);
  assert.equal(g.state.prisoners.C.task, null);
});

test('one blackout produces at most one line for each affected prisoner', () => {
  for (const id of ['A', 'B', 'C']) {
    const g = newGame();
    if (id === 'A') {
      g.api.closeIsolator('lightsA');
      power(g, 'lightsA', true);
    }
    g.advance(40);
    g.state.lines = [];
    power(g, `lights${id}`, false);
    g.advance(0.1);
    assert.ok(g.state.lines.filter(l => l.speaker === id).length <= 1);
  }
});

test('lighting branches split; a water short trips only B and reset re-trips until dry', () => {
  const g = newGame();
  assert.equal(g.api.load(), 6);
  g.state.s.flood.level = FACILITY.fixturesLevel;
  g.advance(0.1);
  assert.equal(g.state.power.tripped, false);
  assert.equal(g.state.power.circuits.lightsB.branchTripped, true);
  assert.equal(g.api.live('lightsB'), false);
  assert.equal(g.api.live('lightsC'), true);
  assert.equal(g.state.prisoners.B.alive, true);
  assert.ok(g.state.events.some(e => e.type === 'sparks'));
  branch(g, 'lightsB');
  assert.equal(g.state.power.circuits.lightsB.branchTripped, true);
  assert.equal(g.state.prisoners.B.alive, true, 'second shock is a warning');
  g.state.s.flood.level = 0;
  assert.equal(branch(g, 'lightsB').ok, true);
  assert.equal(g.api.live('lightsB'), true);
});

test('switching B lights off avoids the short; repeated live resets are lethal', () => {
  const g = newGame();
  power(g, 'lightsB', false);
  g.state.s.flood.level = FACILITY.fixturesLevel;
  g.advance(1);
  assert.equal(g.state.power.circuits.lightsB.branchTripped, false);
  power(g, 'lightsB', true);
  g.advance(0.1);
  for (let i = 1; i < FACILITY.lethalShocks; i++) branch(g, 'lightsB');
  assert.equal(g.state.prisoners.B.alive, false);
  assert.equal(g.state.prisoners.B.lostCause, 'shock');
  assert.equal(g.state.over, false);
  assert.ok(g.controls().some(c => c.id === 'ov-plateB'));
});

test('flue safety cuts only its branch and re-trips until airflow cools it', () => {
  const g = newGame();
  steam(g, 'B');
  g.advance(FACILITY.flueCutTime + 0.2);
  assert.equal(g.state.power.circuits.incinerator.branchTripped, true);
  assert.equal(g.state.power.tripped, false);
  branch(g, 'incinerator');
  assert.equal(g.state.power.circuits.incinerator.branchTripped, true);
  g.state.s.flood.damper = true;
  fan(g, 'HIGH');
  g.advance(FACILITY.flueCutTime / FACILITY.flueCoolRate + 2);
  branch(g, 'incinerator');
  assert.equal(g.api.live('incinerator'), true);
});

test('E-STOP drops handles, keeps isolators/main, and stalls a running drain', () => {
  const g = newGame();
  power(g, 'incinerator', false);
  g.api.closeIsolator('pump');
  power(g, 'pump', true);
  fan(g, 'MED');
  g.state.s.flood = { ...g.state.s.flood, phase: 'draining', intake: 'leaking', level: 0.3, damper: true };
  const isolation = Object.values(g.state.power.circuits).map(c => c.isolated);
  ctl(g, 'e-stop');
  g.advance(0.1);
  assert.equal(g.state.power.tripped, false);
  assert.ok(Object.values(g.state.power.circuits).every(c => !c.on));
  assert.deepEqual(Object.values(g.state.power.circuits).map(c => c.isolated), isolation);
  assert.match(g.state.s.flood.stall, /PUMP/);
  assert.ok(g.state.events.some(e => e.type === 'e-stop'));
  assert.ok(g.state.events.some(e => e.type === 'stimulus' && e.kind === 'klaxon'));
});

test('fan speed changes amps and higher airflow drains and clears faster', () => {
  const low = newGame(), high = newGame();
  for (const [g, speed] of [[low, 'LOW'], [high, 'HIGH']]) {
    power(g, 'incinerator', false);
    g.api.closeIsolator('pump');
    power(g, 'pump', true);
    fan(g, speed);
    g.state.s.flood = { ...g.state.s.flood, phase: 'draining', intake: 'leaking', level: 0.8, damper: true };
    g.state.facility.rooms.C.smoke = 0.6;
    g.advance(1);
    assert.equal(g.state.power.circuits.vent.amps, POWER.fanAmps[speed]);
  }
  assert.ok(high.state.s.flood.level < low.state.s.flood.level);
  assert.ok(high.state.facility.rooms.C.smoke < low.state.facility.rooms.C.smoke);
});

test('overload kills fan power; embers build smoke, Ruth collapses then recovers after reset', () => {
  const g = newGame();
  steam(g, 'B');
  g.advance(FACILITY.emberHeatTime);
  g.state.s.flood.damper = true;
  fan(g, 'MED');
  g.advance(5);
  g.api.closeIsolator('pump');
  assert.equal(power(g, 'pump', true, true).code, 'tripped');
  assert.equal(g.api.live('vent'), false);
  assert.ok(g.state.facility.embers > 0);
  waitUntil(g, () => g.state.prisoners.C.collapsed, 100, 0.1, 'Ruth collapse');
  assert.ok(g.state.facility.rooms.C.smoke > FACILITY.smoke.dense);
  assert.equal(g.state.prisoners.C.alive, true);
  assert.ok(g.state.events.some(e => e.type === 'stimulus' && e.kind === 'smoke'));
  power(g, 'incinerator', false);
  power(g, 'pump', false);
  // Reset is Ruth-only in dispatch. A collapsed Ruth recovers passively after embers cool.
  waitUntil(g, () => !g.state.prisoners.C.collapsed, 360, 0.2, 'passive recovery');
  const recoveries = g.state.events.filter(e => e.type === 'recovered').length;
  g.advance(5);
  assert.equal(g.state.prisoners.C.collapsed, false);
  assert.equal(g.state.events.filter(e => e.type === 'recovered').length, recoveries, 'safe air cannot repeatedly collapse and recover Ruth');
  say(g, 'C', 'c-calm');
  say(g, 'C', 'c-main');
  idle(g, 'C');
  assert.equal(g.state.power.tripped, false);
  assert.equal(g.api.live('vent'), true);
  assert.equal(g.state.prisoners.C.alive, true);
});

test('steam requires live incinerator; lethal heat gives warnings and cooling recovers exposure', () => {
  const g = newGame();
  power(g, 'incinerator', false);
  steam(g, 'A');
  g.advance(10);
  assert.equal(g.state.facility.rooms.A.temperature, FACILITY.ambient);
  power(g, 'incinerator', true);
  const began = g.state.t;
  waitUntil(g, () => g.state.facility.rooms.A.heatBand === 'lethal', 100, 0.1, 'lethal band');
  assert.ok(g.state.t - began > 45, 'there is about a minute to intervene');
  assert.equal(g.state.prisoners.A.alive, true);
  g.advance(2);
  steam(g, 'OFF');
  power(g, 'incinerator', false);
  fan(g, 'HIGH');
  g.state.s.flood.damper = true;
  g.advance(20);
  assert.equal(g.state.prisoners.A.alive, true);
  assert.equal(g.state.prisoners.A.heatExposure, 0);
  assert.notEqual(g.state.facility.rooms.A.heatBand, 'lethal');
});

test('sustained heat loses restrained Nadia, overrides allow the remaining two to escape', () => {
  const g = newGame();
  steam(g, 'A');
  waitUntil(g, () => !g.state.prisoners.A.alive, 110, 0.1, 'heat loss');
  assert.equal(g.state.prisoners.A.lostCause, 'heat');
  assert.equal(g.state.over, false);
  steam(g, 'OFF');
  power(g, 'incinerator', false);
  ctl(g, 'ov-aux');
  ctl(g, 'ov-boltA');
  say(g, 'C', 'c-calm');
  say(g, 'C', 'c-look');
  fan(g, 'MED');
  say(g, 'C', 'c-damper');
  waitUntil(g, () => g.state.s.flood.damper, 30);
  prepFlood(g);
  ctl(g, 'drain');
  say(g, 'B', 'b-intake');
  waitUntil(g, () => g.state.s.flood.intake === 'leaking', 30);
  assert.equal(ctl(g, 'relief').ok, true);
  waitUntil(g, () => g.state.s.flood.phase === 'done', 30);
  prepFinal(g);
  escapeAll(g);
  assert.equal(g.state.ending?.rescued, 2);
});

test('electrical loss of Theo unlocks plate override and remaining shift completes', () => {
  const g = newGame();
  freeNadia(g);
  nadiaJobs(g);
  g.state.s.flood.level = FACILITY.fixturesLevel;
  g.advance(0.1);
  for (let i = 1; i < FACILITY.lethalShocks; i++) branch(g, 'lightsB');
  assert.equal(g.state.prisoners.B.alive, false);
  power(g, 'incinerator', false);
  ctl(g, 'ov-plateB');
  prepFinal(g);
  escapeAll(g);
  assert.equal(g.state.ending?.rescued, 2);
});

test('Ruth is immortal under heat, smoke and explicit loss; collapse cancels work for reissue', () => {
  const g = newGame();
  say(g, 'C', 'c-iso-pump');
  assert.ok(g.state.prisoners.C.task);
  g.api.lose('C', 'heat');
  assert.equal(g.state.prisoners.C.alive, true);
  assert.equal(g.state.prisoners.C.collapsed, true);
  assert.equal(g.state.prisoners.C.task, null);
  const c = g.state.facility.rooms.C;
  c.temperature = FACILITY.heat.lethal + 10;
  c.smoke = 1;
  g.advance(FACILITY.smoke.collapseTime + 1);
  assert.equal(g.state.prisoners.C.alive, true);
  assert.equal(g.state.prisoners.C.fsm, 'collapsed');
  power(g, 'incinerator', false);
  c.temperature = FACILITY.ambient;
  c.smoke = 0;
  g.advance(FACILITY.recoveryTime + 1);
  assert.equal(g.state.prisoners.C.collapsed, false);
  say(g, 'C', 'c-calm');
  say(g, 'C', 'c-iso-pump');
  idle(g, 'C');
  assert.equal(g.state.power.circuits.pump.isolated, false);
});

test('secrets follow warmth and IR; discoveries persist when the writing disappears', () => {
  const g = newGame();
  steam(g, 'A');
  waitUntil(g, () => g.state.facility.secrets.warmWriting, 30);
  assert.ok(g.state.notes.warmWriting);
  assert.ok(g.state.discoveries.found.some(d => d.id === 'warm-writing'));
  steam(g, 'OFF');
  power(g, 'incinerator', false);
  power(g, 'lightsB', false);
  g.advance(1);
  assert.equal(g.state.facility.secrets.irWriting, true);
  power(g, 'lightsB', true);
  g.advance(30);
  assert.equal(g.state.facility.secrets.irWriting, false);
  assert.equal(g.state.facility.secrets.warmWriting, false);
  assert.ok(g.state.discoveries.found.some(d => d.id === 'infrared-writing'));
});

test('moderate steam warmth calms cold Theo and teaches a kind use during the flood', () => {
  const cold = newGame(), warm = newGame();
  for (const g of [cold, warm]) {
    g.state.s.flood = { ...g.state.s.flood, phase: 'filling', intake: 'leaking', level: 0.2 };
    g.state.facility.rooms.B.temperature = FACILITY.heat.warmMin;
    g.state.prisoners.B.stress = 60;
  }
  steam(warm, 'B');
  cold.advance(4);
  warm.advance(4);
  assert.ok(warm.state.prisoners.B.stress < cold.state.prisoners.B.stress);
  assert.ok(warm.state.discoveries.found.some(d => d.id === 'warmth-for-theo'));
});

test('a dispatched lethal short cannot grant discoveries on the next simulation step', () => {
  const g = newGame();
  g.state.s.flood.level = FACILITY.fixturesLevel;
  g.state.prisoners.B.shocks = FACILITY.lethalShocks - 1;
  // The first live fault occurs within update; the wet light discovery is never awarded.
  g.advance(1);
  assert.equal(g.state.prisoners.B.alive, false);
  assert.equal(g.state.discoveries.found.length, 0);
});
