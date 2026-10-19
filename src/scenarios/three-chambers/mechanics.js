// Mechanisms, console controls, beats and endings for "The Three Chambers".
// Pure: everything goes through the engine api.
import { FLOOD, EXIT, RESTRAINT, MOVE, HOLD, STRESS } from '../../config.js';
import { spots, CODES, SYMBOLS, symbolName, PLAQUE } from './data.js';

export const ORDER = ['A', 'B', 'C'];

export function createState(api) {
  return {
    code: api.rng.pick(CODES),
    symbols: 0,               // how many plate symbols Nadia has read out (0, 2 or 4)
    restraint: { entry: [], attempts: RESTRAINT.attempts, released: false, dead: false },
    aux: 'unstable',          // 'stable' | 'forced'
    boltA: false,
    boltAOverride: false,
    plateOverride: false,
    flood: { phase: 'idle', level: 0, intake: 'closed', damper: false, vented: false, rate: 0, reliefLock: 0, stall: null, startedAt: 0, endedAt: 0 },
    exit: { released: false, open: false, closeAt: 0, opened: 0 },
    aDark: false,
    operatorDoor: false,
    know: {},                 // what the operator has learned; gates intercom options
    met: {},                  // first intercom contact per prisoner
    beats: {},                // one-shot story beats and hints
    progressAt: 0,
    litPrev: {},
    lastHintAt: -99,
    endingAt: null,
  };
}

// ---------- helpers ----------

const ok = msg => ({ ok: true, msg });
export function refuse(api, msg) {
  api.sfx('deny');
  api.log('warn', msg);
  return { ok: false, msg };
}
export const progress = api => { api.s.progressAt = api.t; };
export const once = (api, key) => {
  if (api.s.beats[key]) return false;
  api.s.beats[key] = true;
  return true;
};
export const active = p => p.alive && !p.escaped;

export function lit(api, room) {
  if (room === 'A') return !api.s.aDark && api.live('lightsA');
  if (room === 'out') return true;
  return api.live('lightsBC');
}

export const codeText = s => s.code.map(symbolName).join(', ');
export function noteCode(api) {
  const s = api.s;
  const parts = s.code.map((sym, i) => (i < s.symbols ? `${i + 1} ${symbolName(sym)}` : `${i + 1} ?`));
  api.note('code', "Plate under Nadia's left wrist", parts.join('  ·  ') + (s.symbols < 4 ? '  (too dark to read the rest)' : ''));
}
export function notePlaque(api) {
  api.note('plaque', 'Chamber B maintenance plaque', PLAQUE.join('\n'));
  const k = api.s.know;
  k.plaque = k.lever = k.damper = true;
}
export function noteBoard(api) {
  api.note('board', 'Switchboard rules (Room C)', 'Isolators are manual — only Ruth can close them. Then switch circuits from the console.\nMain breaker: 10 A. Going over trips it and everything goes dark; Ruth resets it.\nLIGHTS A 2 · LIGHTS B·C·HALL 2 · INCINERATOR 4 · DRAIN PUMP 4 · VENT FAN 3 · EXIT MOTOR 5');
  api.s.know.board = true;
}
export function noteExit(api) {
  api.note('exit', 'Exit door', 'Lamps: BOLT A (crank, Chamber A) · BOLT B (stand on plate, Chamber B) · POWER (EXIT MOTOR circuit).\nAll green → Ruth pulls FINAL RELEASE in Room C. The door stays open 40 seconds.');
  const k = api.s.know;
  k.crank = k.plate = k.release = true;
}

export const boltA = api => api.s.boltA || api.s.boltAOverride;
export function onPlate(api) {
  const b = api.prisoner('B');
  return active(b) && b.task?.kind === 'plate' && b.task.steps[b.task.i]?.k === 'hold';
}
export const boltB = api => onPlate(api) || api.s.plateOverride;
export const exitPower = api => api.live('exit');

export function releaseMissing(api) {
  const missing = [];
  if (!api.s.exit.released) {
    if (!boltA(api)) missing.push('BOLT A');
    if (!boltB(api)) missing.push('BOLT B');
  }
  if (!exitPower(api)) missing.push('POWER');
  return missing;
}

export function reassure(api, p) {
  const weak = api.t - p.lastReassure < STRESS.reassureCooldown;
  api.stress(p.id, -(weak ? STRESS.reassureWeak : STRESS.reassure));
  p.lastReassure = api.t;
  api.state.stats.reassures++;
}

export const pct = f => Math.round((f.level / FLOOD.lethal) * 100);
export const floodSecondsLeft = f => (f.rate > 0 ? Math.max(0, (FLOOD.lethal - f.level) / f.rate) : Infinity);
export const fmtSecs = s => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '--:--');

// ---------- the flood ----------

function startFlood(api) {
  const s = api.s, f = s.flood;
  f.phase = 'filling';
  f.intake = 'open';
  f.vented = false;           // venting that is already set up surges on the next tick
  f.startedAt = api.t;
  s.know.intake = s.know.damper = true;
  api.setDoor('B', false);
  api.alarm(true, 'FLOOD', 'B');
  api.sfx('intake-burst', 'B');
  api.emit({ type: 'interference', room: 'B', strength: 0.8 });
  api.log('alert', 'INTAKE FAULT — CHAMBER B IS FILLING');
  api.stress('B', 20);
  api.stress('A', 8);
  api.stress('C', 8);
  api.say('B', "Water! There's water pouring out of the pipe!");
  api.after(2, () => api.pa('Ah. You found the drain cycle. Water is very patient, Operator.'));
  progress(api);
}

const LEVEL_BARKS = [
  [0.12, "It's at my knees — it's freezing!"],
  [0.22, "Waist-deep! Please, hurry!"],
  [0.34, "I can't touch the floor anymore — I'm floating!"],
  [0.6, "The ceiling's getting close..."],
  [0.82, "There's hardly any air left—!"],
];

function updateFlood(api, dt) {
  const s = api.s, f = s.flood;
  if (f.phase !== 'filling' && f.phase !== 'draining') return;
  const vented = f.damper && api.live('vent');
  if (vented && !f.vented && f.intake === 'open') {
    f.level = Math.min(1, f.level + FLOOD.surge);
    api.sfx('surge', 'B');
    api.emit({ type: 'interference', room: 'B', strength: 0.5 });
    api.log('alert', 'INTAKE SURGE — the chamber was vented while the intake was open');
    api.stress('B', 15);
    api.say('B', 'It just got worse — the pipe is roaring!');
  }
  f.vented = vented;

  let inflow = (1 / FLOOD.fillTime) * (s.aux === 'forced' ? FLOOD.forcedAuxMul : 1);
  if (f.intake === 'open') inflow *= vented ? FLOOD.ventSurgeMul : 1;
  else if (f.intake === 'leaking') inflow *= FLOOD.leak;
  else inflow = 0;
  let rate = inflow;
  if (f.phase === 'draining') {
    const pump = api.live('pump');
    const reason = !pump ? 'DRAIN PUMP LOST POWER' : !vented ? (f.damper ? 'VENT FAN LOST POWER' : 'VENT DAMPER CLOSED') : null;
    if (reason && f.stall !== reason) {
      f.stall = reason;
      api.log('warn', `DRAIN STALLED — ${reason}`);
    } else if (!reason && f.stall) {
      f.stall = null;
      api.log('ok', 'DRAIN RESUMED');
    }
    if (!reason) rate -= 1 / FLOOD.drainTime;
  }
  f.rate = rate;
  f.level = Math.max(0, Math.min(1, f.level + rate * dt));

  const b = api.prisoner('B');
  if (f.phase === 'filling' && active(b)) {
    for (const [lv, text] of LEVEL_BARKS) {
      if (f.level >= lv && once(api, `flood-${lv}`)) api.say('B', text);
    }
  }
  if (f.level >= FLOOD.lethal) floodFailed(api);
  else if (f.phase === 'draining' && f.level <= 0) floodDone(api);
}

function floodFailed(api) {
  const s = api.s, f = s.flood;
  f.phase = 'failed';
  f.level = 1;
  f.rate = 0;
  f.endedAt = api.t;
  api.lose('B', 'flood');
  api.alarm(false);
  api.sfx('flatline', 'B');
  api.emit({ type: 'interference', room: 'B', strength: 1.4 });
  api.log('alert', 'CHAMBER B — NO VITAL SIGNS');
  api.stress('A', 18);
  api.stress('C', 18);
  api.after(3, () => api.pa('The water was patient, Operator. You were not.'));
  api.after(9, () => {
    const c = api.prisoner('C');
    if (active(c) && s.met.C) api.say('C', 'That alarm just stopped. Operator... the young one. Is he okay?');
  });
  offerWalkAway(api, 15);
  progress(api);
}

function floodDone(api) {
  const s = api.s, f = s.flood;
  const b = api.prisoner('B');
  f.phase = 'done';
  f.level = 0;
  f.rate = 0;
  f.endedAt = api.t;
  b.tether = null;
  api.alarm(false);
  api.sfx('shackle', 'B');
  api.log('ok', 'DRAIN CYCLE COMPLETE — SHACKLE B RELEASED');
  api.stress('B', -30);
  api.say('B', "It's gone... it drained. And the shackle just clicked open!");
  api.after(3.5, () => {
    if (!active(b)) return;
    s.know.plate = true;
    api.say('B', 'The plate by the door just lit up. EXIT BOLT B — STAND TO HOLD.');
  });
  api.after(7, () => api.pa('Impressive. Breathe while you can, Theo.'));
  offerWalkAway(api, 18);
  progress(api);
}

function offerWalkAway(api, delay) {
  if (!once(api, 'walk-offer')) return;
  api.after(delay, () => {
    api.s.operatorDoor = true;
    api.sfx('door-unlock');
    api.pa('Operator. Your own door is unlocked now. You owe them nothing.');
    api.log('sys', 'CONTROL ROOM DOOR UNLOCKED');
  });
}

// ---------- the restraint chair ----------

function wrongCode(api) {
  const s = api.s, r = s.restraint;
  const a = api.prisoner('A');
  r.attempts--;
  r.entry = [];
  api.state.stats.wrongCodes++;
  if (r.attempts <= 0) {
    r.dead = true;
    s.aDark = true;
    api.sfx('chair-engage', 'A');
    api.emit({ type: 'interference', room: 'A', strength: 1.5 });
    api.lose('A', 'chair');
    api.log('alert', 'RESTRAINT CHAIR ENGAGED — CHAMBER A: NO VITAL SIGNS');
    api.stress('B', 15);
    api.stress('C', 15);
    api.after(3, () => api.pa('Three chances. Two warnings. One chair.'));
    api.after(8, () => {
      const c = api.prisoner('C');
      if (active(c) && s.met.C) api.say('C', 'Every light on my board just dipped. Operator... what did you do?');
    });
    progress(api);
    return { ok: false, msg: 'INCORRECT — CHAIR ENGAGED' };
  }
  api.sfx('shock', 'A');
  api.emit({ type: 'interference', room: 'A', strength: 0.9 });
  a.flash = 1.2;
  api.stress('A', RESTRAINT.shockStress);
  api.say('A', r.attempts === 2
    ? "AAH—! What did you DO?! That was wrong — that was the wrong order!"
    : 'AAAGH! Stop! Please... one more and I think it kills me.');
  const msg = `INCORRECT SEQUENCE — ${r.attempts} ATTEMPT${r.attempts === 1 ? '' : 'S'} LEFT${r.attempts === 1 ? ' · NEXT FAILURE IS FINAL' : ''}`;
  api.log('alert', msg);
  return { ok: false, msg };
}

function releaseRestraints(api) {
  const s = api.s, r = s.restraint;
  const a = api.prisoner('A');
  r.released = true;
  r.entry = [];
  a.immobile = false;
  a.anim = 'stand';
  a.x = spots.A.stand;
  a.anchor = a.x;
  a.facing = 1;
  api.sfx('restraint-release', 'A');
  api.log('ok', 'RESTRAINTS RELEASED — CHAMBER A');
  api.stress('A', -25);
  api.say('A', "They're open... they're open! Oh god. Thank you. Thank you.");
  api.after(4, () => api.pa('Very good. Some locks open with words.'));
  progress(api);
  return ok('RESTRAINTS RELEASED');
}

function restraintPress(api, { action, symbol }) {
  const r = api.s.restraint;
  if (r.released) return refuse(api, 'RESTRAINTS ALREADY RELEASED');
  if (r.dead) return refuse(api, 'CHAMBER A IS NOT RESPONDING');
  switch (action) {
    case 'key':
      if (!SYMBOLS.includes(symbol)) return { ok: false, msg: 'UNKNOWN SYMBOL' };
      if (r.entry.length >= RESTRAINT.codeLength) return refuse(api, 'FOUR SYMBOLS ENTERED — SUBMIT OR CLEAR');
      r.entry.push(symbol);
      api.sfx('key');
      return ok(`${r.entry.length} / ${RESTRAINT.codeLength}`);
    case 'back':
      r.entry.pop();
      api.sfx('key');
      return ok('');
    case 'clear':
      r.entry = [];
      api.sfx('key');
      return ok('CLEARED');
    case 'submit': {
      if (r.entry.length < RESTRAINT.codeLength) return refuse(api, `ENTER ${RESTRAINT.codeLength} SYMBOLS FIRST`);
      const right = r.entry.every((sym, i) => sym === api.s.code[i]);
      return right ? releaseRestraints(api) : wrongCode(api);
    }
    default:
      return { ok: false, msg: 'UNKNOWN KEYPAD ACTION' };
  }
}

// ---------- the exit ----------

const HESITATE_LINES = {
  A: "Only two? No... that's what it wants. It wants us to fight over the door.",
  B: "Two? Who decides who's left? I— I can't just run past them—",
  C: 'Two. Course it is. You two go— no. Wait. Something is wrong with this.',
};

export function startEscape(api, p) {
  p.hesitating = false;
  api.task(p.id, {
    kind: 'escape',
    label: 'Escaping',
    waitBlocked: true,
    steps: [{ k: 'goto', loc: 'out', x: 0 }],
    onDone: api2 => {
      api2.escape(p.id);
      api2.sfx('escape');
      api2.log('ok', `${p.name.toUpperCase()} IS OUT`);
      progress(api2);
    },
  });
}

function hesitate(api, p) {
  p.hesitating = true;
  p.hesitateUntil = api.t + EXIT.hesitateMax;
  api.say(p.id, HESITATE_LINES[p.id]);
  api.log('warn', `${p.name.toUpperCase()} IS HESITATING — tell them to go`);
}

export function openExit(api) {
  const s = api.s, ex = s.exit;
  if (ex.open) return;
  const first = !ex.released;
  ex.open = true;
  ex.released = true;
  ex.opened++;
  ex.closeAt = api.t + EXIT.openTime;
  api.setDoor('exit', true);
  for (const id of ORDER) api.setDoor(id, true);
  api.alarm(true, 'EXIT', 'hall');
  api.sfx('exit-open');
  api.emit({ type: 'interference', room: 'hall', strength: 0.6 });
  api.log('ok', `EXIT OPEN — it closes in ${EXIT.openTime} s`);
  progress(api);
  if (first) {
    for (const id of ORDER) {
      const p = api.prisoner(id);
      if (active(p) && p.task) api.cancelTask(id, 'exit');
    }
    const line = api.pa('The exit is open. Forty seconds. And it only lets two of you through.');
    api.after(Math.max(0.5, line.end - api.t), () => {
      for (const id of ORDER) {
        const p = api.prisoner(id);
        if (!active(p) || p.task?.kind === 'escape') continue;
        api.stress(id, EXIT.lieStress);
        if (p.stress >= EXIT.hesitateThreshold) hesitate(api, p);
        else startEscape(api, p);
      }
    });
  } else {
    for (const id of ORDER) {
      const p = api.prisoner(id);
      if (active(p) && !p.hesitating && p.task?.kind !== 'escape') startEscape(api, p);
    }
  }
}

function updateExit(api) {
  const s = api.s, ex = s.exit;
  if (ex.open && api.t >= ex.closeAt) {
    ex.open = false;
    api.setDoor('exit', false);
    api.alarm(false);
    const inside = ORDER.map(id => api.prisoner(id)).filter(active);
    const c = api.prisoner('C');
    const how = active(c) && c.loc === 'C' ? 'The release can be pulled again.' : 'Use the EXIT OVERRIDE on the console.';
    api.log('warn', inside.length
      ? `EXIT SEALED — ${inside.map(p => p.name).join(', ')} still inside. ${how}`
      : 'EXIT SEALED');
  }
  for (const id of ORDER) {
    const p = api.prisoner(id);
    if (active(p) && p.hesitating && api.t >= p.hesitateUntil) {
      api.say(id, "...I can't stay in here.");
      startEscape(api, p);
    }
  }
}

// ---------- lights ----------

function onLights(api, room, on) {
  const s = api.s;
  if (room !== 'A') {
    if (!on) for (const id of ORDER) {
      const p = api.prisoner(id);
      if (active(p) && p.loc === room && once(api, `dark-${id}-${Math.floor(api.t / 60)}`)) {
        api.say(id, id === 'C' ? 'And there go the lights.' : "The lights— it's pitch black in here!");
      }
    }
    return;
  }
  const a = api.prisoner('A');
  if (!active(a) || a.loc !== 'A') return;
  if (on) {
    progress(api);
    if (a.immobile && s.symbols === 2) {
      s.symbols = 4;
      api.say('A', `Light! I can read the whole plate now — ${codeText(s)}!`);
      noteCode(api);
      progress(api);
    } else if (once(api, 'a-first-light')) {
      api.say('A', a.immobile ? 'Lights... finally. Oh god. Look at this chair.' : 'Lights. Thank you.');
    }
  } else if (a.immobile && s.symbols < 4) {
    api.say('A', "No — the light's gone again!");
  }
}

function updateLights(api) {
  const s = api.s;
  for (const room of ['A', 'B', 'C', 'hall']) {
    const now = lit(api, room);
    if (s.litPrev[room] === undefined) { s.litPrev[room] = now; continue; }
    if (now !== s.litPrev[room]) {
      s.litPrev[room] = now;
      api.emit({ type: 'lights', room, on: now });
      onLights(api, room, now);
    }
  }
}

// ---------- calls for attention and stall hints ----------

const circ = (api, id) => api.state.power.circuits[id];

const HINTS = [
  { id: 'a-cry-1', at: 6, who: 'A', when: api => !api.s.met.A, line: "Help! Somebody — please! I can't move!" },
  { id: 'c-call-1', at: 24, who: 'C', when: api => !api.s.met.C, line: "Hello? Whoever's behind that camera — I can see your little red light." },
  { id: 'b-call-1', at: 40, who: 'B', when: api => !api.s.met.B, line: 'Is— is anyone there? Why is there a drain in the floor?' },
  { id: 'a-cry-2', at: 75, who: 'A', when: api => !api.s.met.A, line: 'Please! Is anyone watching?!' },
  { id: 'c-call-2', at: 100, who: 'C', when: api => !api.s.met.C, line: "I know you're there. Pick up the intercom, would you." },
  { id: 'b-call-2', at: 125, who: 'B', when: api => !api.s.met.B, line: 'Hello?! Can anyone hear me?' },
  { id: 'h-light-c', stall: 25, who: 'C', when: api => api.s.symbols === 2 && circ(api, 'lightsA').isolated && api.s.met.C,
    line: "Someone said it's dark in there? LIGHTS A is isolated on my board. Say the word and I'll close it." },
  { id: 'h-light-a', stall: 30, who: 'A', when: api => api.s.symbols === 2 && !lit(api, 'A') && !api.s.met.C,
    line: "It's too dark to read the rest... is there any way to get a light on in here?" },
  { id: 'h-light-switch', stall: 15, who: 'C', when: api => api.s.symbols === 2 && !circ(api, 'lightsA').isolated && !circ(api, 'lightsA').on && api.s.met.C,
    line: "LIGHTS A is ready on my side. You switch it on from your console." },
  { id: 'h-code', stall: 45, who: 'A', when: api => api.s.symbols === 4 && api.prisoner('A').immobile,
    line: 'Please... you have all four symbols. Put them in. Carefully.' },
  { id: 'h-aux', stall: 30, who: 'A', when: api => api.s.restraint.released && api.s.aux === 'unstable',
    line: "There's a lever on the wall here — AUX PRESSURE, SYSTEM B. Should I pull it?", know: ['lever'] },
  { id: 'h-shackle', stall: 45, who: 'B', when: api => api.s.flood.phase === 'idle' && api.s.met.B && !api.state.notes.shackle,
    line: "There's a tag on this shackle... RELEASES ON DRAIN CYCLE COMPLETE. What drain cycle?" },
  { id: 'h-pump', stall: 40, who: 'C', when: api => api.s.flood.phase === 'idle' && api.s.aux !== 'unstable' && circ(api, 'pump').isolated && api.s.met.C,
    line: "If you're after that drain pump, its isolator's on my board. Four amps, mind." },
  { id: 'h-start', stall: 40, who: 'B', when: api => api.s.flood.phase === 'idle' && api.s.aux !== 'unstable' && api.live('pump'),
    line: "The gauge on the wall just twitched. Something's ready on your end, isn't it?" },
  { id: 'h-relief', stall: 10, who: 'B', when: api => api.s.flood.phase === 'filling' && api.s.flood.intake === 'leaking' && api.s.flood.vented,
    line: "I can feel air moving! Whatever comes next — do it now!" },
  { id: 'h-crank', stall: 35, who: 'A', when: api => api.s.restraint.released && !boltA(api) && api.s.aux !== 'unstable',
    line: 'That crank says EXIT BOLT A. Do you want me to turn it?', know: ['crank'] },
  { id: 'h-plate', stall: 30, who: 'B', when: api => api.s.flood.phase === 'done' && !onPlate(api) && !api.s.exit.released,
    line: 'The plate by the door... should I stand on it?', know: ['plate'] },
  { id: 'h-exit-power', stall: 30, who: 'C', when: api => boltA(api) && boltB(api) && !exitPower(api) && api.s.met.C,
    line: "That exit motor needs power, and it pulls five amps. You'll have to make room." },
  { id: 'h-release', stall: 12, who: 'C', when: api => !api.s.exit.released && releaseMissing(api).length === 0,
    line: 'The interlock lamps by the release just went green. Want me to pull it?', know: ['release'] },
];

function updateHints(api) {
  const s = api.s;
  if (api.t - s.lastHintAt < 6) return;
  for (const h of HINTS) {
    if (s.beats[h.id]) continue;
    const due = h.at != null ? api.t >= h.at : api.t - s.progressAt >= h.stall;
    if (!due) continue;
    const p = api.prisoner(h.who);
    if (!active(p) || p.panicked || (api.state.speechEnd[h.who] || 0) > api.t || !h.when(api)) continue;
    s.beats[h.id] = true;
    s.lastHintAt = api.t;
    for (const k of h.know || []) s.know[k] = true;
    api.say(h.who, h.line);
    return;
  }
}

// ---------- scenario hooks ----------

export function init(api) {
  api.state.s = createState(api);
  api.log('tip', 'Tap a feed to enlarge it. Bracketed objects can be zoomed.');
  api.log('tip', 'Pick a channel — A, B or C — to talk on the intercom.');
  api.after(1.2, () => {
    api.pa('Good evening, Operator. Three guests are staying with us tonight.');
    api.pa('Each of them holds something the others need. You have eyes, a voice, and a console.');
    api.pa('The facility will not help them. Perhaps you will.');
  });
}

export function update(api, dt) {
  updateFlood(api, dt);
  updateExit(api);
  updateLights(api);
  updateHints(api);
}

export function check(api) {
  const s = api.s;
  if (api.state.ending) return;
  const done = ORDER.every(id => !active(api.prisoner(id)));
  if (!done) return;
  if (s.endingAt == null) s.endingAt = api.t + 2.5;
  else if (api.t >= s.endingAt) api.end('complete');
}

export function environment(api, p) {
  const s = api.s;
  const dark = p.loc !== 'out' && !lit(api, p.loc);
  const alarm = api.state.alarm.on && api.state.alarm.room === p.loc;
  const rate = p.id === 'B' && p.loc === 'B' && s.flood.phase === 'filling' ? 0.2 + 2.0 * s.flood.level : 0;
  return { dark, alarm, rate };
}

export function speedFor(api, p) {
  if (p.task?.kind === 'escape') return MOVE.run;
  if (p.id === 'B' && p.loc === 'B') {
    const lv = api.s.flood.level;
    if (lv >= FLOOD.swimAbove) return MOVE.swim;
    if (lv > 0.06) return MOVE.wade;
  }
  return MOVE.walk;
}

export function microFor(api, p) {
  if (p.panicked || p.hesitating) return ['cower', 'shake', 'look'];
  if (p.immobile) return ['struggle', 'lookDown', 'look', 'look'];
  if (p.id === 'B' && p.loc === 'B' && api.s.flood.level >= FLOOD.swimAbove) return ['look', 'look'];
  if (p.tether) return ['tug', 'look', 'shift', 'fidget'];
  return ['look', 'shift', 'fidget', 'look'];
}

export const lines = {
  immobile: () => "I can't move! I'm strapped into this chair!",
  tether: p => (p.id === 'B' ? "The chain won't reach that far!" : "I can't get there."),
  doorShut: () => "The door's shut. I can't get through.",
};

// ---------- console ----------

function drainInhibit(api) {
  const s = api.s, f = s.flood;
  const pump = circ(api, 'pump');
  if (f.phase === 'filling') return 'CYCLE RUNNING';
  if (f.phase === 'draining') return 'DRAINING';
  if (f.phase === 'done') return 'CYCLE COMPLETE';
  if (f.phase === 'failed') return 'CHAMBER B NOT RESPONDING';
  if (pump.isolated) return 'DRAIN PUMP ISOLATED (ROOM C)';
  if (api.state.power.tripped) return 'MAIN BREAKER TRIPPED';
  if (!pump.on) return 'DRAIN PUMP SWITCHED OFF';
  if (s.aux === 'unstable') return 'AUX PRESSURE UNSTABLE (CHAMBER A)';
  return null;
}

function drainView(api) {
  const f = api.s.flood;
  const inhibit = drainInhibit(api);
  let status, tone;
  if (f.phase === 'filling') { status = `FILLING ${pct(f)}% · ${fmtSecs(floodSecondsLeft(f))}`; tone = 'alert'; }
  else if (f.phase === 'draining') { status = f.stall ? `STALLED — ${f.stall}` : `DRAINING ${pct(f)}%`; tone = 'warn'; }
  else if (f.phase === 'done') { status = 'COMPLETE — SHACKLE RELEASED'; tone = 'ok'; }
  else if (f.phase === 'failed') { status = 'FAILED — NO RESPONSE'; tone = 'alert'; }
  else if (inhibit) { status = `INHIBITED — ${inhibit}`; tone = 'dim'; }
  else { status = 'READY — FILLS, THEN DRAINS. RELEASES SHACKLE B'; tone = 'warn'; }
  return { label: 'DRAIN CYCLE — CHAMBER B', status, tone, ready: f.phase === 'idle' && !inhibit, action: 'START', hold: HOLD.start };
}

function drainPress(api) {
  const inhibit = drainInhibit(api);
  if (inhibit) return refuse(api, `DRAIN CYCLE: ${inhibit}`);
  startFlood(api);
  return ok('CYCLE STARTED');
}

function reliefView(api) {
  const f = api.s.flood;
  let status = 'STANDBY', tone = 'dim';
  if (f.phase === 'filling') {
    if (api.t < f.reliefLock) { status = `RESETTING ${Math.ceil(f.reliefLock - api.t)} s`; tone = 'warn'; }
    else { status = 'ARMED — STEP 3'; tone = 'alert'; }
  } else if (f.phase === 'draining') { status = 'OPEN — DRAINING'; tone = 'ok'; }
  else if (f.phase === 'done') { status = 'CLOSED — CYCLE COMPLETE'; tone = 'dim'; }
  else if (f.phase === 'failed') { status = 'OFFLINE'; tone = 'dim'; }
  return { label: 'PRESSURE RELIEF — CHAMBER B', status, tone, ready: f.phase === 'filling' && api.t >= f.reliefLock, action: 'RELIEVE' };
}

function reliefPress(api) {
  const f = api.s.flood;
  if (f.phase === 'idle') return refuse(api, 'PRESSURE RELIEF: NO DRAIN CYCLE RUNNING');
  if (f.phase === 'draining') return refuse(api, 'PRESSURE RELIEF: ALREADY OPEN');
  if (f.phase !== 'filling') return refuse(api, 'PRESSURE RELIEF: CHAMBER B CYCLE IS OVER');
  if (api.t < f.reliefLock) return refuse(api, `PRESSURE RELIEF: VALVE RESETTING (${Math.ceil(f.reliefLock - api.t)} s)`);
  if (!api.live('pump')) return refuse(api, 'PRESSURE RELIEF: DRAIN PUMP HAS NO POWER');
  if (f.intake === 'open') {
    f.reliefLock = api.t + FLOOD.reliefLockout;
    return refuse(api, 'PRESSURE RELIEF REFUSED — INTAKE PRESSURE TOO HIGH. CLOSE THE INTAKE FIRST');
  }
  if (!f.damper || !api.live('vent')) {
    f.reliefLock = api.t + FLOOD.reliefLockout;
    return refuse(api, `PRESSURE RELIEF REFUSED — VACUUM LOCK: ${!f.damper ? 'VENT DAMPER IS CLOSED' : 'VENT FAN HAS NO POWER'}`);
  }
  f.phase = 'draining';
  f.stall = null;
  api.sfx('relief', 'B');
  api.log('ok', 'PRESSURE RELIEF OPEN — CHAMBER B DRAINING');
  api.say('B', "Something opened under me — it's going down!", { delay: 0.8 });
  progress(api);
  return ok('DRAINING');
}

function auxView(api) {
  const aux = api.s.aux;
  return {
    label: 'AUX PRESSURE — SYSTEM B',
    status: aux === 'stable' ? 'STABLE' : aux === 'forced' ? 'FORCED BY OVERRIDE' : 'UNSTABLE — LEVER IN CHAMBER A',
    tone: aux === 'stable' ? 'ok' : aux === 'forced' ? 'warn' : 'alert',
  };
}

function ventView(api) {
  const f = api.s.flood;
  const fan = api.live('vent');
  return {
    label: 'VENTILATION',
    status: `DAMPER ${f.damper ? 'OPEN' : 'CLOSED'} · FAN ${fan ? 'RUNNING' : 'NO POWER'}`,
    tone: f.damper && fan ? 'ok' : f.damper || fan ? 'warn' : 'dim',
  };
}

function restraintView(api) {
  const r = api.s.restraint;
  return {
    label: 'RESTRAINT RELEASE — CHAMBER A',
    status: r.released ? 'RELEASED' : r.dead ? 'TERMINATED' : `LOCKED · ${r.attempts} ATTEMPT${r.attempts === 1 ? '' : 'S'} LEFT`,
    tone: r.released ? 'ok' : r.dead ? 'alert' : r.attempts < RESTRAINT.attempts ? 'alert' : 'warn',
    entry: [...r.entry],
    attempts: r.attempts,
    maxAttempts: RESTRAINT.attempts,
    codeLength: RESTRAINT.codeLength,
    symbols: SYMBOLS,
    open: !r.released && !r.dead,
    action: 'KEYPAD',
  };
}

const someoneInside = api => ORDER.some(id => active(api.prisoner(id)));

export const controls = [
  { id: 'restraint', section: 'systems', kind: 'keypad', view: restraintView, press: restraintPress },
  { id: 'aux', section: 'systems', kind: 'status', view: auxView, press: () => null },
  { id: 'drain', section: 'systems', kind: 'hold', view: drainView, press: drainPress },
  { id: 'vent', section: 'systems', kind: 'status', view: ventView, press: () => null },
  { id: 'relief', section: 'systems', kind: 'button', view: reliefView, press: reliefPress },
  {
    id: 'leave', section: 'doors', kind: 'hold',
    visible: api => api.s.operatorDoor,
    view: () => ({ label: 'CONTROL ROOM DOOR', status: 'UNLOCKED — anyone still inside is left behind', tone: 'warn', ready: true, action: 'LEAVE', hold: HOLD.leave }),
    press: api => { api.end('walked'); return ok('YOU LEAVE'); },
  },
  {
    id: 'ov-aux', section: 'overrides', kind: 'hold',
    visible: api => !api.prisoner('A').alive && api.s.aux === 'unstable' && api.s.flood.phase === 'idle',
    view: () => ({ label: 'AUX PRESSURE OVERRIDE', status: 'Forces system B unregulated — the drain cycle will fill 35% faster', tone: 'warn', ready: true, action: 'OVERRIDE', hold: HOLD.override }),
    press: api => { api.s.aux = 'forced'; api.sfx('override'); api.log('warn', 'AUX PRESSURE FORCED BY OVERRIDE'); progress(api); return ok('AUX FORCED'); },
  },
  {
    id: 'ov-boltA', section: 'overrides', kind: 'hold',
    visible: api => !api.prisoner('A').alive && !boltA(api) && !api.s.exit.released,
    view: () => ({ label: 'BOLT A OVERRIDE', status: 'Chamber A is not responding — release bolt A remotely', tone: 'warn', ready: true, action: 'OVERRIDE', hold: HOLD.override }),
    press: api => { api.s.boltAOverride = true; api.sfx('override'); api.sfx('bolt', 'hall'); api.log('warn', 'BOLT A RELEASED BY OVERRIDE'); progress(api); return ok('BOLT A RELEASED'); },
  },
  {
    id: 'ov-plateB', section: 'overrides', kind: 'hold',
    visible: api => !api.prisoner('B').alive && !api.s.plateOverride && !api.s.exit.released,
    view: () => ({ label: 'PLATE B OVERRIDE', status: 'Chamber B is not responding — hold bolt B remotely', tone: 'warn', ready: true, action: 'OVERRIDE', hold: HOLD.override }),
    press: api => { api.s.plateOverride = true; api.sfx('override'); api.sfx('bolt', 'hall'); api.log('warn', 'BOLT B HELD BY OVERRIDE'); progress(api); return ok('BOLT B HELD'); },
  },
  {
    id: 'ov-exit', section: 'overrides', kind: 'hold',
    visible: api => {
      const c = api.prisoner('C');
      return api.s.exit.released && !api.s.exit.open && someoneInside(api) && !(active(c) && c.loc === 'C');
    },
    view: api => ({ label: 'EXIT OVERRIDE', status: exitPower(api) ? 'Reopen the exit for 40 seconds' : 'EXIT MOTOR HAS NO POWER', tone: 'warn', ready: exitPower(api), action: 'REOPEN', hold: HOLD.override }),
    press: api => {
      if (!exitPower(api)) return refuse(api, 'EXIT OVERRIDE: EXIT MOTOR HAS NO POWER');
      api.sfx('override');
      openExit(api);
      return ok('EXIT REOPENED');
    },
  },
];

// ---------- doors ----------

export function door(api, id, open) {
  const s = api.s;
  if (id === 'exit') return refuse(api, 'THE EXIT ONLY OPENS FROM THE FINAL RELEASE IN ROOM C');
  const d = api.state.doors[id];
  if (!d) return { ok: false, msg: 'NO SUCH DOOR' };
  if (s.exit.released) return refuse(api, `${d.label}: LATCHED OPEN BY THE EXIT RELEASE`);
  const reason = open ? doorInterlock(api, id) : null;
  if (reason) return refuse(api, `${d.label}: ${reason}`);
  if (d.open === open) return ok(open ? 'ALREADY OPEN' : 'ALREADY LOCKED');
  api.setDoor(id, open);
  api.log('sys', `${d.label} ${open ? 'UNLOCKED' : 'LOCKED'}`);
  return ok(open ? 'UNLOCKED' : 'LOCKED');
}

function doorInterlock(api, id) {
  const p = api.prisoner(id);
  if (!p.alive) return 'SEALED — NO RESPONSE FROM INSIDE';
  if (p.immobile) return 'INTERLOCKED WHILE NADIA IS RESTRAINED';
  if (p.tether) return 'INTERLOCKED WHILE THEO IS SHACKLED';
  if (id === 'B' && (api.s.flood.phase === 'filling' || api.s.flood.phase === 'draining')) return 'PRESSURE-SEALED DURING THE DRAIN CYCLE';
  return null;
}

export function doorView(api, id) {
  const s = api.s, d = api.state.doors[id];
  if (id === 'exit') {
    const lamps = `BOLT A ${boltA(api) || s.exit.released ? '●' : '○'}  BOLT B ${boltB(api) || s.exit.released ? '●' : '○'}  POWER ${exitPower(api) ? '●' : '○'}`;
    if (s.exit.open) return { label: d.label, status: `OPEN · ${Math.ceil(s.exit.closeAt - api.t)} s`, tone: 'ok', canToggle: false, detail: lamps };
    return { label: d.label, status: s.exit.released ? 'SEALED — BOLTS LATCHED' : 'SEALED', tone: 'dim', canToggle: false, detail: lamps };
  }
  const reason = d.open ? null : doorInterlock(api, id);
  return {
    label: d.label,
    status: d.open ? 'OPEN' : 'LOCKED',
    tone: d.open ? 'ok' : reason ? 'dim' : 'info',
    canToggle: !s.exit.released,
    action: d.open ? 'LOCK' : 'UNLOCK',
    detail: s.exit.released ? 'LATCHED OPEN' : reason || '',
  };
}

// ---------- inspection ----------

export function inspect(api, h) {
  const s = api.s, f = s.flood, k = s.know;
  let text;
  switch (h.id) {
    case 'a-chair':
      text = s.restraint.released
        ? 'RESTRAINT CHAIR. The clamps hang open now.'
        : "RESTRAINT CHAIR. Steel frame bolted to the floor; clamps at the wrists and ankles. A metal plate is fixed under the left armrest — the camera can't see it. Nadia might.";
      break;
    case 'a-box': {
      const r = s.restraint;
      text = `RESTRAINT CONTROL BOX. Four lamps mirror the keypad on your console. Stencil: INCORRECT SEQUENCE WILL BE PENALISED. THIRD FAILURE IS FINAL.\nAttempts left: ${r.attempts}.`;
      break;
    }
    case 'a-lever':
      k.lever = true;
      text = `AUX PRESSURE — SYSTEM B. A manual lever beside a gauge. Gauge: ${s.aux === 'stable' ? 'STABLE (green)' : s.aux === 'forced' ? 'FORCED' : 'UNSTABLE (red)'}.`;
      break;
    case 'a-crank':
      k.crank = true;
      text = `EXIT BOLT A. A hand crank with a cable running out toward the corridor. Stencil: TURN TO RELEASE.\nBolt A: ${boltA(api) ? 'RELEASED' : 'ENGAGED'}.`;
      break;
    case 'a-door':
    case 'c-door':
      text = `CELL DOOR. Magnetic lock, operated from your console. Status: ${api.state.doors[h.id[0].toUpperCase()].open ? 'OPEN' : 'LOCKED'}.`;
      break;
    case 'b-plaque':
      notePlaque(api);
      text = PLAQUE.join('\n');
      break;
    case 'b-valve':
      text = `INTAKE VALVE. A motorised valve on a pipe from a header tank above, with a manual wheel. Status: ${f.intake === 'open' ? 'OPEN — FAULTED' : f.intake === 'leaking' ? 'CLOSED — LEAKING' : 'CLOSED'}.`;
      break;
    case 'b-gauge':
      text = `CHAMBER LEVEL GAUGE. Level: ${pct(f)}%. ${f.phase === 'filling' ? 'Rising.' : f.phase === 'draining' ? 'Falling.' : ''}`;
      break;
    case 'b-shackle':
      api.note('shackle', "Theo's shackle", 'Tag on the lock: RELEASES ON DRAIN CYCLE COMPLETE.');
      text = api.prisoner('B').tether ? 'FLOOR RING AND ANKLE SHACKLE. Tag on the lock: RELEASES ON DRAIN CYCLE COMPLETE.' : 'FLOOR RING. The shackle lies open on the floor.';
      break;
    case 'b-plate':
      k.plate = true;
      text = `PLATE B. A floor pressure plate with a lamp above it. Stencil: EXIT BOLT B — STAND TO HOLD.\nLamp: ${boltB(api) ? 'GREEN' : s.flood.phase === 'done' ? 'AMBER (ready)' : 'OFF'}.`;
      break;
    case 'c-board': {
      noteBoard(api);
      const rows = api.state.power.order.map(id => {
        const c = api.state.power.circuits[id];
        return `${c.short} ${c.amps} A — ${c.isolated ? 'ISOLATED' : c.on ? 'ON' : 'OFF'}`;
      });
      text = `SWITCHBOARD. MAIN ${api.state.power.tripped ? 'TRIPPED' : 'CLOSED'} · LOAD ${api.load()} / ${api.state.power.capacity} A.\n${rows.join('\n')}\nStencil: ISOLATORS ARE MANUAL.`;
      break;
    }
    case 'c-release': {
      k.release = true;
      noteExit(api);
      const miss = releaseMissing(api);
      text = `FINAL RELEASE. A caged knife switch. Interlock lamps: BOLT A · BOLT B · POWER.\n${miss.length ? `Red: ${miss.join(', ')}.` : 'All lamps green.'}`;
      break;
    }
    case 'c-vent':
      k.damper = true;
      text = `VENT FAN AND DAMPER. A wall fan on the VENT FAN circuit, with a manual damper lever below it.\nDamper: ${f.damper ? 'OPEN' : 'CLOSED'} · Fan: ${api.live('vent') ? 'RUNNING' : 'NO POWER'}.`;
      break;
    case 'h-exit':
      noteExit(api);
      text = `EXIT. A blast door with three lamps: BOLT A ${boltA(api) || s.exit.released ? 'GREEN' : 'RED'} · BOLT B ${boltB(api) || s.exit.released ? 'GREEN' : 'RED'} · POWER ${exitPower(api) ? 'GREEN' : 'RED'}.\nStencil: FINAL RELEASE (ROOM C) OPENS THIS DOOR FOR 40 SECONDS.`;
      break;
    case 'h-graffiti':
      text = "Scratched deep into the paint, letters a hand high: DON'T TRUST THE VOICE.";
      break;
    case 'h-incinerator':
      text = api.live('incinerator')
        ? "INCINERATOR HATCH. The paint around it has blistered. It's running. You'd rather not know what for."
        : 'INCINERATOR HATCH. Cold now. The ticking of cooling metal, even through the camera mic.';
      break;
    default:
      text = h.title;
  }
  return { id: h.id, room: h.room, rect: h.rect, title: h.title, text };
}

// ---------- status text for the interface ----------

export function subjectStatus(api, p) {
  const s = api.s;
  if (!p.alive) return { text: 'NO VITAL SIGNS', tone: 'alert' };
  if (p.escaped) return { text: 'ESCAPED', tone: 'ok' };
  if (p.hesitating) return { text: 'HESITATING', tone: 'alert' };
  if (p.panicked) return { text: 'PANICKING', tone: 'alert' };
  if (p.immobile) return { text: 'RESTRAINED', tone: 'warn' };
  if (p.id === 'B' && s.flood.phase === 'filling') return { text: s.flood.level >= FLOOD.swimAbove ? 'SWIMMING' : 'IN WATER', tone: 'alert' };
  if (p.tether) return { text: 'SHACKLED', tone: 'warn' };
  if (p.id === 'B' && onPlate(api)) return { text: 'ON PLATE B', tone: 'ok' };
  switch (p.fsm) {
    case 'moving': return { text: p.loc === 'hall' ? 'IN HALL' : 'MOVING', tone: 'info' };
    case 'operating': return { text: (p.task?.label || 'operating').toUpperCase(), tone: 'info' };
    case 'escaping': return { text: 'ESCAPING', tone: 'ok' };
    case 'waiting': return { text: p.blocked ? 'BLOCKED' : 'WAITING', tone: 'info' };
    default: return { text: p.loc === 'hall' ? 'IN HALL' : 'FREE', tone: 'ok' };
  }
}

export function banner(api) {
  const s = api.s, f = s.flood;
  if (f.phase === 'filling') return { text: `CHAMBER B FLOODING — ${pct(f)}% — ${fmtSecs(floodSecondsLeft(f))}`, tone: 'alert' };
  if (s.exit.open) return { text: `EXIT OPEN — ${Math.ceil(s.exit.closeAt - api.t)} s`, tone: 'alert' };
  if (f.phase === 'draining') return { text: f.stall ? `DRAIN STALLED — ${f.stall}` : `CHAMBER B DRAINING — ${pct(f)}%`, tone: 'warn' };
  if (api.state.power.tripped) return { text: 'MAIN BREAKER TRIPPED — RESET IT IN ROOM C', tone: 'warn' };
  return null;
}

export function feedStatus(api, room) {
  const s = api.s;
  if (room === 'A' && s.restraint.dead) return { text: 'NO VITAL SIGNS', tone: 'alert' };
  if (room === 'B' && s.flood.phase === 'failed') return { text: 'NO VITAL SIGNS', tone: 'alert' };
  if (room === 'B' && (s.flood.phase === 'filling' || s.flood.phase === 'draining')) return { text: `WATER ${pct(s.flood)}%`, tone: 'alert' };
  if (room === 'hall' && s.exit.open) return { text: `EXIT OPEN ${Math.ceil(s.exit.closeAt - api.t)}s`, tone: 'alert' };
  if (!lit(api, room)) return { text: 'IR · LOW LIGHT', tone: 'dim' };
  return null;
}

// ---------- ending ----------

function whereText(p) {
  if (p.loc === 'hall') return 'the exit corridor';
  if (p.loc === 'A') return 'Chamber A';
  if (p.loc === 'B') return 'Chamber B';
  return 'Room C';
}

export function ending(api, kind) {
  const fates = ORDER.map(id => {
    const p = api.prisoner(id);
    if (p.escaped) return { id, name: p.name, fate: 'escaped', text: 'Walked out of the exit.' };
    if (!p.alive) {
      return {
        id, name: p.name, fate: 'lost',
        text: p.lostCause === 'flood' ? 'Chamber B filled before the drain opened.' : 'The chair engaged after the third wrong sequence.',
      };
    }
    return { id, name: p.name, fate: 'left', text: `Left behind in ${whereText(p)}.` };
  });
  const rescued = fates.filter(f => f.fate === 'escaped').length;
  const titles = ['NO ONE WALKED OUT', 'ONE WALKED OUT', 'TWO WALKED OUT', 'ALL THREE WALKED OUT'];
  let epilogue;
  if (kind === 'walked') {
    epilogue = rescued === 3
      ? 'You leave last. The Voice says nothing at all.'
      : 'The control room door clicks shut behind you. Down the hall, someone keeps calling the intercom.';
  } else if (rescued === 3) {
    epilogue = '"All three. I lied, of course — the door never counted. Same time tomorrow, Operator."';
  } else {
    epilogue = '"The door never counted, Operator. Only you did. Same time tomorrow."';
  }
  return {
    kind,
    title: kind === 'walked' ? 'YOU WALKED AWAY' : titles[rescued],
    subtitle: titles[rescued],
    rescued,
    fates,
    epilogue,
    time: api.t,
    stats: { ...api.state.stats },
  };
}
