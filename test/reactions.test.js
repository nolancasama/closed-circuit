import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/game.js';
import { REACTIONS, SPEECH } from '../src/config.js';
import { reactions } from '../src/scenarios/three-chambers/dialogue.js';

function reactionGame(seed = 11, taskSpeed = 1) {
  const orders = [
    { id: 'work', label: 'Work', task: true, when: () => true,
      run: (api, p) => api.task(p.id, { kind: 'test', steps: [{ k: 'op', dur: 20 }] }) },
    { id: 'other', label: 'Other work', task: true, when: () => true,
      run: (api, p) => api.task(p.id, { kind: 'other', steps: [{ k: 'op', dur: 20 }] }) },
    { id: 'calm', label: 'Reassure', calm: true, when: () => true,
      run: (api, p) => api.stress(p.id, -20) },
  ];
  return createGame({
    id: 'reaction-fixture', capacity: 10, circuits: [], doors: [], hotspots: [], controls: [],
    prisoners: ['A', 'B', 'C'].map(id => ({ id, name: id, room: id, x: 100, stress: 10, baseline: 10, immortal: id === 'C' })),
    rooms: { A: {}, B: {}, C: {}, hall: {} },
    dialogue: { A: orders, B: orders, C: orders }, reactions,
    init() {}, update() {}, check() {}, ending: () => ({}),
    environment: () => ({ taskSpeed }), microFor: () => [], speedFor: () => 1,
  }, { seed });
}

function ask(g, pid, option) {
  g.advance(Math.max(0, g.api.prisoner(pid).talkLock - g.api.t) + 0.1);
  assert.equal(g.dispatch({ type: 'say', pid, option }).ok, true);
  g.advance(SPEECH.replyDelay + 0.1);
}

test('reactions are seeded, varied, cooldown limited and remember habituation', () => {
  const run = () => {
    const g = reactionGame();
    const p = g.api.prisoner('B');
    const lines = [];
    const initialTrust = p.trust;
    for (let i = 0; i < 9; i++) {
      g.api.stimulus({ kind: 'light', room: 'B', on: i % 2 === 0 });
      const reaction = g.drainEvents().find(e => e.type === 'reaction' && e.pid === 'B' && e.stimulus === 'light');
      if (reaction.line) lines.push(reaction.line);
      const stage = p.reactions.memory['light:B'].stage;
      assert.equal(stage, i === 0 ? 'first' : i + 1 >= REACTIONS.habituatedAfter ? 'habituated' : 'repeated');
      assert.ok(p.reaction.until > g.api.t);
      if (i === 0) {
        const count = g.state.lines.length;
        g.api.stimulus({ kind: 'door', room: 'B', open: true });
        assert.equal(g.state.lines.length, count, 'cooldown suppresses a second spoken response');
        assert.equal(p.reactions.memory['door:B'].count, 1, 'a silent reaction still remembers the stimulus');
      }
      g.advance(REACTIONS.cooldown + SPEECH.max);
    }
    assert.ok(p.trust < initialTrust);
    assert.equal(lines.length, REACTIONS.habituatedAfter, 'habituated speech happens only once');
    assert.ok(lines.every((line, i) => i === 0 || line !== lines[i - 1]));
    assert.ok(new Set(lines).size >= 4);
    return lines;
  };
  assert.deepEqual(run(), run());
});

test('forty light toggles over four minutes stay varied and become cue only', () => {
  const g = reactionGame(7);
  const lines = { A: [], B: [], C: [] };
  for (let i = 0; i < 40; i++) {
    g.api.stimulus({ kind: 'light', room: 'B', scope: 'all', on: i % 2 === 0 });
    for (const event of g.drainEvents()) {
      if (event.type === 'reaction' && event.line) lines[event.pid].push(event.line);
    }
    g.advance(6);
  }
  for (const id of ['A', 'B', 'C']) {
    assert.ok(lines[id].length >= 3 && lines[id].length <= REACTIONS.habituatedAfter);
    assert.ok(new Set(lines[id]).size >= 3, `${id} has varied spoken responses`);
    for (const line of new Set(lines[id])) assert.ok(lines[id].filter(text => text === line).length <= 2);
    assert.equal(g.api.prisoner(id).reactions.memory['light:B'].count, 40);
    assert.equal(g.api.prisoner(id).reactions.memory['light:B'].habituatedSpoken, true);
  }
});

test('a quiet stimulus resets habituation and remembers its own last spoken line', () => {
  const g = reactionGame();
  const p = g.api.prisoner('B');
  g.api.rng.pick = candidates => candidates[0];
  const heat = { kind: 'heat', room: 'B', cue: 'comfortable' };
  g.api.stimulus(heat);
  const first = p.reactions.memory['heat:B'].lastLine;
  g.advance(REACTIONS.cooldown + SPEECH.max);
  g.api.stimulus({ kind: 'door', room: 'B' });
  g.advance(REACTIONS.cooldown + SPEECH.max);
  g.api.stimulus(heat);
  assert.notEqual(p.reactions.memory['heat:B'].lastLine, first, 'interleaved speech cannot erase per-key memory');
  for (let i = 0; i < 4; i++) {
    g.advance(REACTIONS.cooldown + SPEECH.max);
    g.api.stimulus(heat);
  }
  assert.equal(p.reactions.memory['heat:B'].habituatedSpoken, true);
  const last = p.reactions.memory['heat:B'].lastLine;
  g.advance(REACTIONS.quietGap + 1);
  g.api.stimulus(heat);
  assert.equal(p.reactions.memory['heat:B'].count, 1);
  assert.equal(p.reactions.memory['heat:B'].stage, 'first');
  assert.equal(p.reactions.memory['heat:B'].habituatedSpoken, false);
  assert.notEqual(p.reactions.memory['heat:B'].lastLine, last);
});

test('every common stimulus has at least three lines in each speaking stage', () => {
  for (const character of Object.values(reactions)) {
    for (const kind of ['light', 'machine', 'door', 'klaxon', 'smoke', 'heat', 'heat:shiver', 'heat:comfortable']) {
      const bank = character[kind];
      for (const stage of ['first', 'repeated', 'habituated']) {
        const pool = Array.isArray(bank) ? bank : bank[stage];
        assert.ok(pool.length >= 3, `${kind}:${stage} has at least three lines`);
      }
    }
  }
});

test('low trust refuses an instruction once; reasking and reassurance both resolve it', () => {
  const g = reactionGame();
  const p = g.api.prisoner('B');
  p.trust = 0;
  ask(g, 'B', 'work');
  assert.equal(p.task, null);
  assert.equal(p.reactions.refused.work, true);
  ask(g, 'B', 'work');
  assert.equal(p.task.kind, 'test', 'same command is accepted while trust is still low');
  g.api.cancelTask('B');
  ask(g, 'B', 'other');
  assert.equal(p.task, null);
  ask(g, 'B', 'calm');
  assert.equal(p.trust, REACTIONS.reassureTrust);
  ask(g, 'B', 'other');
  assert.equal(p.task.kind, 'other');
});

test('distress can cause a refusal before panic, then the reask succeeds', () => {
  const g = reactionGame();
  const p = g.api.prisoner('B');
  p.stress = REACTIONS.distress + 2;
  ask(g, 'B', 'work');
  assert.equal(p.task, null);
  ask(g, 'B', 'work');
  assert.equal(p.task.kind, 'test');
});

test('local hazards affect their room and surviving prisoners hear a loss', () => {
  const g = reactionGame();
  g.api.stimulus({ kind: 'smoke', room: 'B', dense: true });
  assert.equal(g.api.prisoner('A').reactions.memory['smoke:B'], undefined);
  assert.equal(g.api.prisoner('B').reactions.memory['smoke:B'].count, 1);
  const trust = g.api.prisoner('C').trust;
  g.api.lose('A', 'environment heat', true);
  assert.equal(g.api.prisoner('A').alive, false);
  for (const id of ['B', 'C']) {
    const p = g.api.prisoner(id);
    assert.equal(p.reactions.memory['lost:A'].count, 1);
    assert.ok(p.stress > 10);
  }
  assert.ok(g.api.prisoner('C').trust < trust);
  assert.equal(g.state.over, false);
});

test('immortal collapse cancels a task, recovers, and allows the task to be reissued', () => {
  const g = reactionGame();
  const p = g.api.prisoner('C');
  let cancellation;
  g.api.task('C', { kind: 'test', steps: [{ k: 'op', dur: 10 }], onCancel: (_api, _p, why) => { cancellation = why; } });
  g.api.lose('C', 'heat', true);
  assert.equal(p.alive, true);
  assert.equal(p.collapsed, true);
  assert.equal(p.fsm, 'collapsed');
  assert.equal(p.task, null);
  assert.equal(cancellation, 'collapse');
  assert.equal(g.channel('C').ok, false);
  assert.equal(g.api.task('C', { steps: [] }), false);
  g.advance(2);
  assert.equal(p.fsm, 'collapsed');
  g.api.recover('C');
  assert.equal(p.collapsed, false);
  assert.equal(g.channel('C').ok, true);
  assert.equal(g.api.task('C', { kind: 'test', steps: [{ k: 'op', dur: 2 }] }), true);
  g.advance(3);
  assert.equal(p.task, null);
  assert.equal(g.state.events.some(e => e.type === 'lost' && e.pid === 'C'), false);
});

test('scenario environment task speed slows operations as well as movement', () => {
  const g = reactionGame(1, 0.5);
  const p = g.api.prisoner('C');
  g.api.task('C', { kind: 'test', steps: [{ k: 'op', dur: 2 }] });
  g.advance(2.2);
  assert.ok(p.task, 'two seconds of dark work is not two seconds of progress');
  g.advance(2);
  assert.equal(p.task, null);
});
