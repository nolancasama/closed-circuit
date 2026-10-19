// Game core: fixed-step sim clock, scheduler, speech queue, log, notes,
// command dispatch and the api scenarios are written against. Pure and headless.
import { SIM_HZ, SPEECH, STRESS } from '../config.js';
import { createRng } from './rng.js';
import * as Power from './power.js';
import { createPrisoner, startTask, cancelTask, updatePrisoners, busy } from './prisoners.js';

const STEP = 1 / SIM_HZ;
const MAX_FRAME = 0.25;
const LOG_CAP = 120;

export function createGame(scenario, { seed = 1 } = {}) {
  const rng = createRng(seed);
  const state = {
    scenarioId: scenario.id,
    seed,
    t: 0,
    acc: 0,
    paused: false,
    over: false,
    prisonerOrder: scenario.prisoners.map(p => p.id),
    prisoners: {},
    power: Power.createPower(scenario.circuits, scenario.capacity),
    doors: {},
    lines: [],
    speechEnd: {},
    log: [],
    logSeq: 0,
    notes: {},
    noteOrder: [],
    events: [],
    timers: [],
    alarm: { on: false, reason: '', room: null },
    ending: null,
    stats: { commands: 0, reassures: 0, overloads: 0, wrongCodes: 0, inspected: 0 },
    s: {},
  };
  for (const d of scenario.doors) state.doors[d.id] = { id: d.id, label: d.label, open: !!d.open };
  for (const def of scenario.prisoners) state.prisoners[def.id] = createPrisoner(def);

  const api = {
    state,
    rng,
    get s() { return state.s; },
    get t() { return state.t; },
    prisoner: id => state.prisoners[id],
    emit: ev => { state.events.push(ev); },
    sfx: (name, room = null) => { state.events.push({ type: 'sfx', name, room }); },
    log(kind, text) {
      state.log.push({ id: ++state.logSeq, t: state.t, kind, text });
      if (state.log.length > LOG_CAP) state.log.splice(0, state.log.length - LOG_CAP);
    },
    note(id, title, text) {
      const existing = state.notes[id];
      if (existing && existing.text === text) return;
      state.notes[id] = { id, title, text, t: state.t, fresh: true };
      if (!existing) state.noteOrder.push(id);
      state.events.push({ type: 'note', id });
    },
    after(delay, fn) {
      state.timers.push({ at: state.t + delay, fn });
      state.timers.sort((a, b) => a.at - b.at);
    },
    say(speaker, text, opts = {}) {
      const start = Math.max(state.t + (opts.delay || 0), state.speechEnd[speaker] || 0);
      const dur = Math.min(SPEECH.max, Math.max(SPEECH.min, SPEECH.base + text.length * SPEECH.perChar));
      const line = { speaker, text, start, end: start + dur, to: opts.to || null, logged: false, kind: opts.kind || null };
      state.lines.push(line);
      state.speechEnd[speaker] = start + dur;
      return line;
    },
    pa(text) {
      const line = api.say('pa', text);
      api.after(line.start - state.t, () => {
        api.sfx('pa');
        api.emit({ type: 'interference', room: '*', strength: 0.45 });
        for (const id of state.prisonerOrder) api.stress(id, STRESS.pa);
      });
      return line;
    },
    task: (id, task) => startTask(api, state.prisoners[id], task),
    cancelTask: (id, why) => cancelTask(api, state.prisoners[id], why),
    stress(id, delta) {
      const p = state.prisoners[id];
      if (!p.alive || p.escaped) return;
      p.stress = Math.max(0, Math.min(100, p.stress + delta));
      if (!p.panicked && p.stress >= STRESS.panic) {
        p.panicked = true;
        api.emit({ type: 'panic', pid: id });
        api.log('warn', `${p.name.toUpperCase()} IS PANICKING`);
      }
      if (p.panicked && p.stress < STRESS.calmBelow) p.panicked = false;
    },
    stressAll(delta) { for (const id of state.prisonerOrder) api.stress(id, delta); },
    live: id => Power.live(state.power, id),
    load: () => Power.load(state.power),
    trip: () => Power.trip(api),
    resetMain: () => Power.resetMain(api),
    closeIsolator: id => Power.closeIsolator(api, id),
    setDoor(id, open) {
      const d = state.doors[id];
      if (!d || d.open === open) return;
      d.open = open;
      api.sfx(open ? 'door-open' : 'door-close', id);
      api.emit({ type: 'door', id, open });
    },
    alarm(on, reason = '', room = null) {
      if (state.alarm.on === on && state.alarm.reason === reason) return;
      state.alarm = { on, reason, room };
      api.emit({ type: 'alarm', on, reason, room });
    },
    lose(id, cause) {
      const p = state.prisoners[id];
      if (!p.alive) return;
      if (p.task) cancelTask(api, p, 'lost');
      p.alive = false;
      p.panicked = false;
      p.hesitating = false;
      p.lostCause = cause;
      p.fsm = 'incapacitated';
      // Anything they had not said yet is never heard.
      state.lines = state.lines.filter(l => l.speaker !== id || l.start <= state.t);
      state.speechEnd[id] = state.t;
      api.emit({ type: 'lost', pid: id });
    },
    escape(id) {
      const p = state.prisoners[id];
      if (!p.alive || p.escaped) return;
      p.escaped = true;
      p.loc = 'out';
      p.task = null;
      p.hesitating = false;
      p.fsm = 'escaped';
      api.emit({ type: 'escaped', pid: id });
    },
    end(kind) {
      if (state.ending) return;
      state.ending = scenario.ending(api, kind);
      state.over = true;
      api.emit({ type: 'ending', kind });
    },
  };

  function runTimers() {
    while (state.timers.length && state.timers[0].at <= state.t + 1e-9) {
      const timer = state.timers.shift();
      timer.fn();
      if (state.over) return;
    }
  }

  function flushLines() {
    for (const line of state.lines) {
      if (!line.logged && line.start <= state.t + 1e-9) {
        line.logged = true;
        api.log(line.speaker, line.text);
        state.events.push({ type: 'line', speaker: line.speaker, text: line.text, dur: line.end - line.start });
      }
    }
    if (state.lines.length > 24) state.lines = state.lines.filter(l => l.end > state.t - 1);
  }

  function fixedStep() {
    state.t += STEP;
    runTimers();
    if (state.over) return;
    scenario.update(api, STEP);
    updatePrisoners(api, scenario, STEP);
    flushLines();
    if (!state.over) scenario.check(api);
  }

  function tick(dt) {
    if (state.paused || state.over) return;
    state.acc += Math.min(Math.max(dt, 0), MAX_FRAME);
    while (state.acc >= STEP && !state.over) {
      state.acc -= STEP;
      fixedStep();
    }
  }

  // Advance sim time exactly (tests). Ignores pause.
  function advance(seconds) {
    const steps = Math.round(seconds / STEP);
    for (let i = 0; i < steps && !state.over; i++) fixedStep();
  }

  function channel(id) {
    const p = state.prisoners[id];
    if (!p) return { ok: false, status: 'NO CHANNEL' };
    if (!p.alive) return { ok: false, status: 'NO RESPONSE' };
    if (p.escaped) return { ok: false, status: 'OUT OF RANGE — ESCAPED' };
    return { ok: true, status: '' };
  }

  // Context-sensitive intercom options for one prisoner.
  function options(id) {
    const p = state.prisoners[id];
    if (!channel(id).ok) return [];
    const locked = state.t < p.talkLock;
    const list = scenario.dialogue[id].filter(o => o.when(api, p));
    const shown = p.panicked || p.hesitating ? list.filter(o => o.calm) : list;
    return shown.map(o => {
      const blocked = !!o.task && busy(p) && !o.interrupt;
      return {
        id: o.id,
        label: typeof o.label === 'function' ? o.label(api, p) : o.label,
        calm: !!o.calm,
        urgent: !!(o.urgent && o.urgent(api, p)),
        enabled: !locked && !blocked,
        reason: locked ? 'speaking' : blocked ? 'busy' : null,
      };
    });
  }

  function hush(speaker) {
    state.lines = state.lines.filter(l => l.speaker !== speaker || l.start <= state.t);
    for (const l of state.lines) if (l.speaker === speaker && l.end > state.t + 0.2) l.end = state.t + 0.2;
    state.speechEnd[speaker] = Math.min(state.speechEnd[speaker] || 0, state.t + 0.2);
  }

  function talk(id, optionId) {
    const p = state.prisoners[id];
    if (!channel(id).ok) return { ok: false, msg: channel(id).status };
    if (state.t < p.talkLock) return { ok: false, msg: 'CHANNEL BUSY' };
    const opt = scenario.dialogue[id].find(o => o.id === optionId);
    if (!opt || !opt.when(api, p)) return { ok: false, msg: 'NOT AVAILABLE' };
    if ((p.panicked || p.hesitating) && !opt.calm) return { ok: false, msg: 'CALM THEM FIRST' };
    if (opt.task && busy(p) && !opt.interrupt) return { ok: false, msg: `${p.name.toUpperCase()} IS BUSY` };
    state.stats.commands++;
    api.sfx('intercom');
    // Talking over someone cuts them off: replies never queue behind old chatter.
    hush(id);
    hush('you');
    const said = typeof opt.say === 'function' ? opt.say(api, p) : (opt.say || (typeof opt.label === 'function' ? opt.label(api, p) : opt.label));
    api.say('you', said, { to: id });
    p.listenUntil = state.t + 1.8;
    p.talkLock = state.t + SPEECH.replyDelay + 0.6;
    api.after(SPEECH.replyDelay, () => {
      if (!p.alive || p.escaped) return;
      p.contacted = true;
      opt.run(api, p);
      const replyEnd = state.speechEnd[id] || state.t;
      p.talkLock = Math.max(state.t + 0.4, Math.min(replyEnd, state.t + SPEECH.lockCap));
    });
    return { ok: true, msg: '' };
  }

  function control(id, payload) {
    const c = scenario.controls.find(k => k.id === id);
    if (!c) return { ok: false, msg: 'UNKNOWN CONTROL' };
    if (c.visible && !c.visible(api)) return { ok: false, msg: 'NOT AVAILABLE' };
    return c.press(api, payload || {}) || { ok: true, msg: '' };
  }

  function inspect(id, refresh = false) {
    const h = scenario.hotspots.find(k => k.id === id);
    if (!h) return { ok: false, msg: 'NOTHING THERE' };
    if (!refresh) state.stats.inspected++;
    const view = scenario.inspect(api, h);
    return { ok: true, msg: '', view };
  }

  function dispatch(cmd) {
    if (!cmd || state.over) return { ok: false, msg: 'SHIFT OVER' };
    if (cmd.type === 'pause') { state.paused = true; return { ok: true }; }
    if (cmd.type === 'resume') { state.paused = false; return { ok: true }; }
    if (state.paused) return { ok: false, msg: 'PAUSED' };
    switch (cmd.type) {
      case 'say': return talk(cmd.pid, cmd.option);
      case 'power': return Power.toggle(api, cmd.circuit, !!cmd.on, !!cmd.force);
      case 'door': return scenario.door(api, cmd.door, !!cmd.open);
      case 'control': return control(cmd.id, cmd.payload);
      case 'inspect': return inspect(cmd.id, !!cmd.refresh);
      default: return { ok: false, msg: 'UNKNOWN COMMAND' };
    }
  }

  function drainEvents() {
    const out = state.events;
    state.events = [];
    return out;
  }

  // Lines currently being spoken.
  function activeLines() {
    return state.lines.filter(l => l.start <= state.t && l.end > state.t);
  }

  scenario.init(api);
  flushLines();

  return {
    state,
    api,
    scenario,
    tick,
    advance,
    dispatch,
    options,
    channel,
    drainEvents,
    activeLines,
    controls: () => scenario.controls.filter(c => !c.visible || c.visible(api)).map(c => ({ id: c.id, section: c.section, kind: c.kind, ...c.view(api) })),
  };
}
