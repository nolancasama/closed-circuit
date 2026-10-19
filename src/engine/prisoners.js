// Prisoners: finite-state behaviour, scripted tasks, door-gated 1-D movement,
// stress, and idle micro-behaviours. Pure.
//
// A task is { kind, label, steps, onDone?, onFail?, waitBlocked? } where steps are
//   { k: 'goto', loc, x }                    walk (through open doors only)
//   { k: 'face', dir }
//   { k: 'op', dur, anim, check?, during?, start?, done? }   operate a mechanism
//   { k: 'hold', anim }                      stay until the task is cancelled
//   { k: 'wait', dur }
//   { k: 'call', fn }
// check/during return null or { line, log } to abort with an explanation.
import { MOVE, STRESS } from '../config.js';

export function createPrisoner(def) {
  return {
    id: def.id,
    name: def.name,
    room: def.room,
    loc: def.room,
    x: def.x,
    facing: def.facing || 1,
    alive: true,
    escaped: false,
    lostCause: null,
    stress: def.stress,
    baseline: def.baseline,
    panicked: def.stress >= STRESS.panic,
    immobile: !!def.immobile,
    tether: def.tether ? [...def.tether] : null,
    task: null,
    blocked: false,
    hesitating: false,
    hesitateUntil: 0,
    fsm: 'idle',
    anim: def.anim || 'stand',
    animT: 0,
    micro: { kind: 'none', t: 0, dur: 0, dir: 1 },
    nextMicro: 1.5 + def.x / 400,
    anchor: def.x,
    listenUntil: 0,
    talkLock: 0,
    lastReassure: -99,
    contacted: false,
    flash: 0,          // seconds of a shock/startle flash left (render)
    bob: 0,            // vertical offset (swimming), set by the scenario
  };
}

// Doing something that a new command should not silently replace.
// A 'hold' step (waiting on a plate, in the hall) can be replaced.
export const busy = p => !!p.task && p.task.steps[p.task.i]?.k !== 'hold';

export function startTask(api, p, task) {
  if (!p.alive || p.escaped) return false;
  if (p.task) cancelTask(api, p, 'replaced');
  p.task = { ...task, i: 0, stepT: 0, opT: 0, opStarted: false };
  p.blocked = false;
  p.micro = { kind: 'none', t: 0, dur: 0, dir: 1 };
  return true;
}

export function cancelTask(api, p, why = 'cancelled') {
  const task = p.task;
  if (!task) return;
  p.task = null;
  p.blocked = false;
  p.anchor = p.x;
  task.onCancel?.(api, p, why);
}

function nextStep(api, p) {
  const task = p.task;
  task.i++;
  task.stepT = 0;
  task.opT = 0;
  task.opStarted = false;
  if (task.i >= task.steps.length) {
    p.task = null;
    p.anchor = p.x;
    task.onDone?.(api, p);
  }
}

function failTask(api, p, reason) {
  const task = p.task;
  p.task = null;
  p.blocked = false;
  p.anchor = p.x;
  if (reason?.line) api.say(p.id, reason.line);
  if (reason?.log) api.log('warn', reason.log);
  task.onFail?.(api, p, reason);
}

function tetherClamp(p, bounds, x) {
  let lo = bounds[0], hi = bounds[1];
  if (p.tether) { lo = Math.max(lo, p.tether[0]); hi = Math.min(hi, p.tether[1]); }
  return Math.min(hi, Math.max(lo, x));
}

function approach(p, x, speed, dt) {
  const d = x - p.x;
  if (Math.abs(d) <= Math.max(MOVE.arrive, speed * dt)) { p.x = x; return true; }
  p.x += Math.sign(d) * speed * dt;
  p.facing = Math.sign(d);
  return false;
}

// Advance one goto step. Returns 'arrived', null (still walking) or a block reason.
function walk(api, scenario, p, step, dt) {
  const rooms = scenario.rooms;
  const doors = api.state.doors;
  if (p.immobile) return { code: 'immobile', line: scenario.lines?.immobile?.(p) };
  const speed = scenario.speedFor(api, p);

  if (p.loc === step.loc) {
    const x = tetherClamp(p, rooms[p.loc].bounds, step.x);
    const there = approach(p, x, speed, dt);
    if (!there) return null;
    return x === step.x || Math.abs(x - step.x) < 0.01 ? 'arrived' : { code: 'tether', line: scenario.lines?.tether?.(p) };
  }

  if (p.loc !== 'hall') {
    const door = rooms[p.loc].door;
    const reach = tetherClamp(p, rooms[p.loc].bounds, door.x);
    if (reach !== door.x) {
      return approach(p, reach, speed, dt) ? { code: 'tether', line: scenario.lines?.tether?.(p) } : null;
    }
    if (!approach(p, door.x, speed, dt)) return null;
    if (!doors[door.id].open) return { code: 'door', door: door.id, line: scenario.lines?.doorShut?.(p, door.id) };
    p.loc = 'hall';
    p.x = door.hallX;
    api.emit({ type: 'transit', pid: p.id, to: 'hall' });
    return null;
  }

  const hall = rooms.hall;
  if (step.loc === 'out') {
    if (!approach(p, hall.exitX, speed, dt)) return null;
    if (!doors[hall.exitDoor].open) return { code: 'door', door: hall.exitDoor, line: null };
    p.loc = 'out';
    return 'arrived';
  }
  const door = rooms[step.loc].door;
  if (!approach(p, door.hallX, speed, dt)) return null;
  if (!doors[door.id].open) return { code: 'door', door: door.id, line: scenario.lines?.doorShut?.(p, door.id) };
  p.loc = step.loc;
  p.x = door.x;
  api.emit({ type: 'transit', pid: p.id, to: step.loc });
  return null;
}

function runTask(api, scenario, p, dt) {
  const task = p.task;
  const step = task.steps[task.i];
  if (!step) { nextStep(api, p); return; }
  task.stepT += dt;
  switch (step.k) {
    case 'goto': {
      const r = walk(api, scenario, p, step, dt);
      if (r === 'arrived') { p.blocked = false; nextStep(api, p); return; }
      if (r) {
        if (task.waitBlocked && r.code === 'door') { p.blocked = true; return; }
        failTask(api, p, r);
        return;
      }
      p.blocked = false;
      // Failsafe: automatic movement always completes.
      if (task.stepT > MOVE.stuckAfter && p.loc === step.loc) {
        p.x = tetherClamp(p, scenario.rooms[p.loc].bounds, step.x);
        nextStep(api, p);
      }
      return;
    }
    case 'face':
      p.facing = step.dir;
      nextStep(api, p);
      return;
    case 'op': {
      if (!task.opStarted) {
        task.opStarted = true;
        const reason = step.check?.(api, p);
        if (reason) { failTask(api, p, reason); return; }
        if (step.face) p.facing = step.face;
        step.start?.(api, p);
      }
      const reason = step.during?.(api, p);
      if (reason) { failTask(api, p, reason); return; }
      task.opT += dt;
      if (task.opT >= step.dur) {
        step.done?.(api, p);
        if (p.task === task) nextStep(api, p);
      }
      return;
    }
    case 'hold':
      if (step.face) p.facing = step.face;
      return;
    case 'wait':
      if (task.stepT >= step.dur) nextStep(api, p);
      return;
    case 'call':
      step.fn(api, p);
      if (p.task === task) nextStep(api, p);
      return;
    default:
      nextStep(api, p);
  }
}

function updateStress(api, scenario, p, dt) {
  const env = scenario.environment(api, p);
  let rising = false;
  if (env.dark && p.stress < STRESS.darkCap) { p.stress = Math.min(STRESS.darkCap, p.stress + STRESS.darkDrift * dt); rising = true; }
  if (env.alarm && p.stress < STRESS.alarmCap) { p.stress = Math.min(STRESS.alarmCap, p.stress + STRESS.alarmRate * dt); rising = true; }
  if (env.rate) { p.stress += env.rate * dt; rising = true; }
  if (!rising && p.stress > p.baseline) p.stress = Math.max(p.baseline, p.stress - STRESS.decay * dt);
  else if (!rising && p.stress < p.baseline) p.stress = Math.min(p.baseline, p.stress + STRESS.recover * dt);
  p.stress = Math.max(0, Math.min(100, p.stress));
  if (!p.panicked && p.stress >= STRESS.panic) {
    p.panicked = true;
    api.emit({ type: 'panic', pid: p.id });
    api.log('warn', `${p.name.toUpperCase()} IS PANICKING`);
  } else if (p.panicked && p.stress < STRESS.calmBelow) {
    p.panicked = false;
  }
}

function updateMicro(api, scenario, p, dt) {
  const holding = p.task && p.task.steps[p.task.i]?.k === 'hold';
  if (p.task && !holding) return;
  const m = p.micro;
  if (m.kind !== 'none') {
    m.t += dt;
    if (m.kind === 'shift' && m.tx != null && !holding) approach(p, m.tx, MOVE.shift, dt);
    if (m.t >= m.dur) {
      p.micro = { kind: 'none', t: 0, dur: 0, dir: 1 };
      p.nextMicro = api.state.t + api.rng.range(2.2, 6) * (p.panicked ? 0.45 : 1);
    }
    return;
  }
  if (api.state.t < p.nextMicro) return;
  let kinds = scenario.microFor(api, p);
  if (holding) kinds = kinds.filter(k => k !== 'shift');
  if (!kinds.length) { p.nextMicro = api.state.t + 3; return; }
  const kind = api.rng.pick(kinds);
  p.micro = { kind, t: 0, dur: api.rng.range(1.2, 2.8), dir: api.rng.chance(0.5) ? 1 : -1 };
  if (kind === 'shift') {
    const bounds = scenario.rooms[p.loc]?.bounds;
    if (bounds) {
      const tx = tetherClamp(p, [bounds[0] + 8, bounds[1] - 14], p.anchor + api.rng.range(-22, 22));
      p.micro.tx = tx;
      p.micro.dur = Math.max(p.micro.dur, Math.abs(tx - p.x) / MOVE.shift + 0.3);
    }
  }
}

function fsmOf(api, p) {
  if (!p.alive) return 'incapacitated';
  if (p.escaped) return 'escaped';
  if (p.task) {
    const step = p.task.steps[p.task.i];
    if (p.task.kind === 'escape') return p.blocked ? 'waiting' : 'escaping';
    if (step?.k === 'goto') return p.blocked ? 'waiting' : 'moving';
    if (step?.k === 'op') return 'operating';
    if (step?.k === 'hold' || step?.k === 'wait') return 'waiting';
  }
  if (p.panicked || p.hesitating) return 'frightened';
  if (api.state.t < p.listenUntil) return 'listening';
  return 'idle';
}

export function updatePrisoners(api, scenario, dt) {
  for (const id of api.state.prisonerOrder) {
    const p = api.state.prisoners[id];
    p.animT += dt;
    if (p.flash > 0) p.flash = Math.max(0, p.flash - dt);
    if (!p.alive || p.escaped) { p.fsm = fsmOf(api, p); continue; }
    updateStress(api, scenario, p, dt);
    if (p.task) runTask(api, scenario, p, dt);
    if (p.alive && !p.escaped) updateMicro(api, scenario, p, dt);
    const fsm = fsmOf(api, p);
    if (fsm !== p.fsm) { p.fsm = fsm; api.emit({ type: 'fsm', pid: p.id, fsm }); }
  }
}

// Heart rate shown on the console; deterministic wobble from sim time.
export function heartRate(p, t) {
  if (!p.alive) return 0;
  return Math.round(60 + p.stress * 0.85 + Math.sin(t * 0.7 + p.x) * 2);
}
