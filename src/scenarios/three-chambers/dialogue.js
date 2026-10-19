// Intercom options for "The Three Chambers".
// Option: { id, label, say?, when(api, p), run(api, p), calm?, task?, interrupt?, urgent? }
//   calm      — offered even while the prisoner panics or hesitates
//   task      — starts a task; disabled while the prisoner is busy
//   interrupt — allowed while busy (stop)
import { DURATIONS, FLOOD } from '../../config.js';
import { busy } from '../../engine/prisoners.js';
import { spots, symbolName } from './data.js';
import {
  lit, reassure, startEscape, openExit, progress, noteCode, notePlaque, noteBoard, noteExit,
  codeText, boltA, boltB, onPlate, exitPower, releaseMissing,
} from './mechanics.js';

const lamp = on => (on ? 'green' : 'red');

function hallLook(api, p) {
  noteExit(api);
  const released = api.s.exit.released;
  api.say(p.id, `A long corridor. The exit's at the end — a blast door with lamps: BOLT A ${lamp(boltA(api) || released)}, BOLT B ${lamp(boltB(api) || released)}, POWER ${lamp(exitPower(api))}.`);
  api.say(p.id, "Someone scratched letters into the wall... DON'T TRUST THE VOICE.");
}

function goLine(api, p) {
  reassure(api, p);
  api.say(p.id, { A: "Okay. Okay — I'm going. I'm going!", B: 'Going — I trust you. Going!', C: "Right. Don't you dare close it on me." }[p.id]);
  startEscape(api, p);
}

// Movement commands every free prisoner shares.
function common(id) {
  const waitX = { A: 372, B: 392, C: 412 }[id];
  const homeX = { A: spots.A.stand, B: 340, C: 330 }[id];
  return [
    {
      id: `${id}-go`, calm: true, label: 'Go — get to the exit!', urgent: () => true,
      when: (api, p) => api.s.exit.open && !p.hesitating && p.task?.kind !== 'escape' && !p.immobile && !p.tether,
      run: (api, p) => goLine(api, p),
    },
    {
      id: `${id}-out`, task: true, label: 'Step out and wait by the exit.',
      when: (api, p) => !p.immobile && !p.tether && p.loc === id && api.state.doors[id].open && !api.s.exit.open,
      run(api) {
        api.say(id, 'Into the hall. Okay.');
        api.task(id, { kind: 'wait-hall', label: 'Waiting in hall', steps: [{ k: 'goto', loc: 'hall', x: waitX }, { k: 'hold', anim: 'stand' }] });
      },
    },
    {
      id: `${id}-back`, task: true, label: 'Go back into your room.',
      when: (api, p) => p.loc === 'hall' && !api.s.exit.open && p.task?.kind !== 'escape',
      run(api) {
        api.say(id, 'Going back in.');
        api.task(id, { kind: 'return', label: 'Returning', steps: [{ k: 'goto', loc: id, x: homeX }] });
      },
    },
    {
      id: `${id}-stop`, interrupt: true, label: 'Stop. Wait there.',
      when: (api, p) => busy(p) && p.task.kind !== 'escape',
      run(api) {
        api.cancelTask(id, 'stop');
        api.say(id, 'Stopping.');
      },
    },
  ];
}

// ---------------- Nadia (A) ----------------

const nadia = [
  {
    id: 'a-calm', calm: true,
    label: (api, p) => (p.hesitating ? "GO! It's a lie — run!" : !api.s.met.A ? "Can you hear me? You're not alone." : "Breathe. I'm right here."),
    when: () => true,
    run(api, p) {
      const s = api.s;
      if (p.hesitating) { goLine(api, p); return; }
      const first = !s.met.A;
      s.met.A = true;
      reassure(api, p);
      if (first) {
        api.stress('A', -10);
        api.say('A', "Who's there?! Where are you? I can't move — my arms are strapped down!");
        api.say('A', "...Okay. A voice. That's something. Please don't leave.");
        return;
      }
      if (p.immobile) api.say('A', lit(api, 'A') ? "I'm here. Not like I can go anywhere." : "Okay. Breathing. Just... don't leave me in the dark.");
      else api.say('A', api.rng.pick(["I'm okay. I'm okay. Let's just get out of here.", 'Still standing. Barely.']));
    },
  },
  {
    id: 'a-look', label: 'What can you see?',
    when: () => true,
    run(api, p) {
      const s = api.s;
      s.met.A = true;
      if (p.loc === 'hall') { hallLook(api, p); return; }
      if (p.immobile) {
        if (!lit(api, 'A')) {
          api.say('A', 'Almost nothing. A red lamp in the corner. A box on the wall with four little lights. And this chair — it is bolted to the floor.');
        } else {
          s.know.lever = s.know.crank = true;
          api.say('A', 'Concrete. A lever on the far wall with a gauge, and a big crank on the other side. The box on the wall has four little lights.');
        }
        return;
      }
      s.know.lever = s.know.crank = true;
      const gauge = s.aux === 'unstable' ? 'in the red' : 'in the green';
      const crank = boltA(api) ? 'I already turned the crank.' : 'The crank on the left says EXIT BOLT A.';
      api.say('A', `The lever says AUX PRESSURE — SYSTEM B. The gauge is ${gauge}. ${crank} The door is ${api.state.doors.A.open ? 'open' : 'locked'}.`);
    },
  },
  {
    id: 'a-plate', label: 'Is there anything under the straps?',
    when: (api, p) => p.immobile && api.s.symbols === 0,
    run(api) {
      const s = api.s;
      if (!lit(api, 'A')) {
        s.symbols = 2;
        api.say('A', "There's a metal plate under my left wrist — coloured symbols. I can only make out the first two...");
        api.say('A', `${symbolName(s.code[0])}... then ${symbolName(s.code[1])}. The rest is just shadow.`);
      } else {
        s.symbols = 4;
        api.say('A', `There's a plate under my left wrist. Four symbols, left to right: ${codeText(s)}.`);
      }
      noteCode(api);
      progress(api);
    },
  },
  {
    id: 'a-repeat', label: 'Read me the symbols again.',
    when: (api, p) => p.immobile && api.s.symbols >= 2,
    run(api) {
      const s = api.s;
      if (s.symbols < 4 && lit(api, 'A')) { s.symbols = 4; noteCode(api); progress(api); }
      if (s.symbols >= 4) api.say('A', `Left to right: ${codeText(s)}.`);
      else api.say('A', `Only the first two: ${symbolName(s.code[0])}, ${symbolName(s.code[1])}. I can't see the rest in this dark.`);
    },
  },
  {
    id: 'a-lever', task: true, label: 'Pull the AUX PRESSURE lever.',
    when: (api, p) => !p.immobile && api.s.know.lever && api.s.aux === 'unstable',
    run(api) {
      api.say('A', 'The lever. Okay.');
      api.task('A', {
        kind: 'lever', label: 'Pulling lever',
        steps: [
          { k: 'goto', loc: 'A', x: spots.A.lever },
          {
            k: 'op', dur: DURATIONS.auxLever, anim: 'lever', face: 1,
            check: api2 => (api2.s.aux !== 'unstable' ? { line: "It's already down." } : null),
            start: api2 => api2.sfx('lever', 'A'),
            done(api2) {
              api2.s.aux = 'stable';
              api2.sfx('clunk', 'A');
              api2.log('ok', 'AUX PRESSURE STABLE — SYSTEM B READY');
              api2.say('A', "It's stiff — got it. The needle's moving into the green.");
              progress(api2);
            },
          },
        ],
      });
    },
  },
  {
    id: 'a-crank', task: true, label: 'Turn the EXIT BOLT A crank.',
    when: (api, p) => !p.immobile && api.s.know.crank && !boltA(api) && !api.s.exit.released,
    run(api) {
      api.say('A', 'The crank. Going.');
      api.task('A', {
        kind: 'crank', label: 'Turning crank',
        steps: [
          { k: 'goto', loc: 'A', x: spots.A.crank },
          {
            k: 'op', dur: DURATIONS.boltCrank, anim: 'crank', face: -1,
            check: api2 => (boltA(api2) ? { line: 'The crank is already turned.' } : null),
            start: api2 => api2.sfx('crank', 'A'),
            done(api2) {
              api2.s.boltA = true;
              api2.sfx('bolt', 'hall');
              api2.log('ok', 'BOLT A RELEASED');
              api2.say('A', 'There — something just clanked out in the hall.');
              progress(api2);
            },
          },
        ],
      });
    },
  },
  ...common('A'),
];

// ---------------- Theo (B) ----------------

const theo = [
  {
    id: 'b-calm', calm: true,
    label: (api, p) => (p.hesitating ? "GO! It's a lie — run!" : !api.s.met.B ? 'Hello? Can you hear me?'
      : api.s.flood.phase === 'filling' ? "Keep your head up. I've got you." : "You're doing fine. Stay with me."),
    when: () => true,
    run(api, p) {
      const s = api.s;
      if (p.hesitating) { goLine(api, p); return; }
      const first = !s.met.B;
      s.met.B = true;
      reassure(api, p);
      if (first) {
        api.say('B', "Yes! Yes — who is this? I'm chained to the floor in here.");
        api.say('B', 'Please tell me you can get me out.');
        return;
      }
      if (s.flood.phase === 'filling') {
        api.say('B', s.flood.level >= FLOOD.swimAbove ? "I'm floating... keeping my head up. Hurry. Please." : "Okay... okay. I'm standing. Just hurry.");
      } else if (s.flood.phase === 'done') api.say('B', "I'm alive. I'm actually alive.");
      else api.say('B', "I'm trying. It's just... this chain.");
    },
  },
  {
    id: 'b-look', label: 'What can you see?',
    when: () => true,
    run(api, p) {
      const s = api.s, f = s.flood;
      s.met.B = true;
      if (p.loc === 'hall') { hallLook(api, p); return; }
      if (f.phase === 'filling') {
        const depth = f.level < 0.12 ? 'my ankles' : f.level < 0.22 ? 'my knees' : f.level < FLOOD.swimAbove ? 'my chest' : "over my head — I'm floating";
        api.say('B', `Water! It's pouring out of the big pipe — it's up to ${depth}!`);
        return;
      }
      if (f.phase === 'done' || f.phase === 'draining') {
        s.know.plate = true;
        api.say('B', "Everything's dripping. The plate by the door has a light now: EXIT BOLT B — STAND TO HOLD.");
        return;
      }
      s.know.plate = s.know.valve = true;
      api.say('B', 'A big pipe on the left with a valve wheel. A drain under my feet. A gauge and a sign on the wall.');
      api.say('B', "And a metal plate by the door — my chain won't reach it.");
    },
  },
  {
    id: 'b-sign', label: 'Read me the sign on the wall.',
    when: (api, p) => p.loc === 'B' && api.s.flood.phase !== 'filling',
    run(api) {
      notePlaque(api);
      api.say('B', '"Chamber B — drain cycle. Requires: aux pressure stable, from Chamber A. Drain pump and vent fan powered."');
      api.say('B', '"If the intake faults open: one, close the intake valve, by hand, in the chamber. Two, open the vent damper, Room C. Three, pressure relief, control room."');
      api.say('B', '"Do not alter the sequence." ...Faults open? As in, floods? Great.');
      progress(api);
    },
  },
  {
    id: 'b-shackle', label: 'Check the shackle.',
    when: (api, p) => !!p.tether,
    run(api) {
      api.note('shackle', "Theo's shackle", 'Tag on the lock: RELEASES ON DRAIN CYCLE COMPLETE.');
      api.say('B', "There's a tag on the lock: RELEASES ON DRAIN CYCLE COMPLETE. So something has to drain... but it's bone dry in here.");
    },
  },
  {
    id: 'b-valve', label: 'Look at the valve.',
    when: (api, p) => p.loc === 'B' && api.s.flood.phase === 'idle' && api.s.know.valve,
    run(api) {
      api.say('B', "It's shut tight. There's a motor on it — it won't budge by hand right now.");
    },
  },
  {
    id: 'b-intake', task: true, label: 'Close the intake valve!', urgent: () => true,
    when: (api, p) => api.s.flood.phase === 'filling' && api.s.flood.intake === 'open' && p.loc === 'B',
    run(api) {
      api.say('B', api.rng.pick(['Okay — okay, going for the wheel!', 'The wheel — got it!']));
      api.task('B', {
        kind: 'intake', label: 'Closing intake',
        steps: [
          { k: 'goto', loc: 'B', x: spots.B.valve },
          {
            k: 'op', dur: DURATIONS.intake, anim: 'valve', face: -1,
            check: api2 => (api2.s.flood.intake !== 'open' ? { line: "It's already shut!" } : null),
            start: api2 => api2.sfx('valve', 'B'),
            done(api2) {
              api2.s.flood.intake = 'leaking';
              api2.sfx('clank', 'B');
              api2.log('ok', 'INTAKE VALVE CLOSED — still leaking at 30%');
              api2.say('B', "It's shut! It's still leaking, but slower!");
              progress(api2);
            },
          },
        ],
      });
    },
  },
  {
    id: 'b-plate', task: true, label: 'Stand on the pressure plate.',
    when: (api, p) => api.s.flood.phase === 'done' && api.s.know.plate && !onPlate(api) && !api.s.exit.released,
    run(api) {
      api.say('B', 'The plate. On my way.');
      api.task('B', {
        kind: 'plate', label: 'On plate B',
        steps: [
          { k: 'goto', loc: 'B', x: spots.B.plate },
          {
            k: 'op', dur: DURATIONS.plate, anim: 'step',
            start: api2 => api2.sfx('plate', 'B'),
            done(api2) {
              api2.sfx('bolt', 'hall');
              api2.log('ok', 'PLATE B PRESSED — BOLT B HELD');
              api2.say('B', "I'm on it. Something clicked. I'll stay right here.");
              progress(api2);
            },
          },
          { k: 'hold', anim: 'stand' },
        ],
        onCancel(api2, p, why) {
          if (why !== 'exit' && why !== 'lost') api2.log('warn', 'THEO STEPPED OFF PLATE B — BOLT B ENGAGED');
        },
      });
    },
  },
  ...common('B'),
];

// ---------------- Ruth (C) ----------------

const ISOLATORS = [
  { cid: 'lightsA', short: 'LIGHTS A', done: "LIGHTS A isolator's closed. Switch it on at your end." },
  { cid: 'pump', short: 'DRAIN PUMP', done: "Drain pump isolator's closed. Four amps, that pump — watch your meter." },
  { cid: 'exit', short: 'EXIT MOTOR', done: "Exit motor isolator's closed. Five amps. You'll need room for it." },
];

const ruth = [
  {
    id: 'c-calm', calm: true,
    label: (api, p) => (p.hesitating ? "GO! It's a lie — run!" : !api.s.met.C ? 'Can you hear me?' : 'How are you holding up?'),
    when: () => true,
    run(api, p) {
      const s = api.s;
      if (p.hesitating) { goLine(api, p); return; }
      const first = !s.met.C;
      s.met.C = true;
      reassure(api, p);
      if (first) {
        api.say('C', 'Loud and clear. Took you long enough.');
        api.say('C', "I'm locked in some kind of switch room. Thirty years in maintenance and I end up inside one.");
        return;
      }
      api.say('C', api.state.power.tripped ? "Sitting in the dark. Wonderful. I'm fine." : api.rng.pick(["I'm alright. Just tell me what to flip.", 'Hands are steady. Yours?']));
    },
  },
  {
    id: 'c-look', label: 'What can you see?',
    when: () => true,
    run(api, p) {
      const s = api.s;
      s.met.C = true;
      if (p.loc === 'hall') { hallLook(api, p); return; }
      s.know.board = s.know.damper = s.know.release = true;
      api.say('C', 'A switchboard: six isolators, a main breaker and a load meter. MAX LOAD TEN AMPS, it says.');
      api.say('C', `A wall fan with a damper lever. And a caged switch marked FINAL RELEASE — the interlock lamps on it are ${releaseMissing(api).length ? 'red' : 'green'}.`);
    },
  },
  {
    id: 'c-board', label: 'How does the board work?',
    when: () => true,
    run(api) {
      noteBoard(api);
      api.s.met.C = true;
      api.say('C', "Every circuit's got an isolator here. Manual — nobody flips those remotely. Once I close one, you switch the circuit from your end.");
      api.say('C', 'Keep the total under ten amps. Go over and the main trips, everything goes dark, and I have to reset it.');
    },
  },
  ...ISOLATORS.map(iso => ({
    id: `c-iso-${iso.cid}`, task: true, label: `Close the ${iso.short} isolator.`,
    when: api => api.state.power.circuits[iso.cid].isolated,
    run(api) {
      api.say('C', `${iso.short}. On it.`);
      api.task('C', {
        kind: 'isolator', label: 'At the board', circuit: iso.cid,
        steps: [
          { k: 'goto', loc: 'C', x: spots.C.iso[iso.cid] },
          {
            k: 'op', dur: DURATIONS.isolator, anim: 'switch', face: -1,
            check: api2 => (api2.state.power.circuits[iso.cid].isolated ? null : { line: "That one's already closed." }),
            done(api2) {
              api2.closeIsolator(iso.cid);
              api2.say('C', iso.done);
              progress(api2);
            },
          },
        ],
      });
    },
  })),
  {
    id: 'c-main', task: true, label: 'Reset the main breaker.', urgent: () => true,
    when: api => api.state.power.tripped,
    run(api) {
      api.say('C', 'Resetting the main. Hang on.');
      api.task('C', {
        kind: 'main', label: 'Resetting main',
        steps: [
          { k: 'goto', loc: 'C', x: spots.C.main },
          {
            k: 'op', dur: DURATIONS.mainReset, anim: 'breaker', face: -1,
            check: api2 => (api2.state.power.tripped ? null : { line: "Main's already in." }),
            done(api2) {
              const held = api2.resetMain();
              api2.say('C', held ? "Main's back in." : `It kicked straight back out. You're switching ${api2.load()} amps — the limit's ten.`);
              if (held) progress(api2);
            },
          },
        ],
      });
    },
  },
  {
    id: 'c-damper', task: true, label: 'Open the vent damper.',
    urgent: api => api.s.flood.phase === 'filling' && api.s.flood.intake !== 'open',
    when: api => api.s.know.damper && !api.s.flood.damper,
    run(api) {
      api.say('C', api.live('vent') ? 'Damper. On it.' : "I'll open the damper — but that fan's got no power.");
      api.task('C', {
        kind: 'damper', label: 'Opening damper',
        steps: [
          { k: 'goto', loc: 'C', x: spots.C.vent },
          {
            k: 'op', dur: DURATIONS.damper, anim: 'lever', face: 1,
            check: api2 => (api2.s.flood.damper ? { line: "It's already open." } : null),
            start: api2 => api2.sfx('lever', 'C'),
            done(api2) {
              const f = api2.s.flood;
              f.damper = true;
              api2.sfx('damper', 'C');
              api2.log('ok', 'VENT DAMPER OPEN');
              if (!api2.live('vent')) api2.say('C', "Damper's open. The fan's dead, though — power VENT FAN from your end.");
              else if (f.phase === 'filling' && f.intake === 'open') api2.say('C', "Damper's open — wait. Listen to that pipe. That's pulling more water in!");
              else api2.say('C', "Damper's open. Air's moving.");
              progress(api2);
            },
          },
        ],
      });
    },
  },
  {
    id: 'c-damper-close', task: true, label: 'Close the vent damper.',
    when: api => api.s.flood.damper && api.s.flood.phase !== 'draining',
    run(api) {
      api.say('C', 'Closing the damper.');
      api.task('C', {
        kind: 'damper', label: 'Closing damper',
        steps: [
          { k: 'goto', loc: 'C', x: spots.C.vent },
          {
            k: 'op', dur: 2, anim: 'lever', face: 1,
            done(api2) {
              api2.s.flood.damper = false;
              api2.sfx('damper', 'C');
              api2.log('sys', 'VENT DAMPER CLOSED');
              api2.say('C', "Damper's shut.");
            },
          },
        ],
      });
    },
  },
  {
    id: 'c-release', task: true,
    label: api => (api.s.exit.released ? 'Pull the release again!' : 'Pull the FINAL RELEASE.'),
    urgent: api => releaseMissing(api).length === 0,
    when: api => api.s.know.release && !api.s.exit.open,
    run(api) {
      api.say('C', api.s.exit.released ? 'Again. Right.' : 'The big one. Here goes.');
      const blocked = api2 => {
        const miss = releaseMissing(api2);
        return miss.length ? { line: `It won't move. Interlock lamps are red: ${miss.join(', ')}.`, log: `FINAL RELEASE BLOCKED — ${miss.join(', ')}` } : null;
      };
      api.task('C', {
        kind: 'release', label: 'Pulling release',
        steps: [
          { k: 'goto', loc: 'C', x: spots.C.release },
          {
            k: 'op', dur: DURATIONS.release, anim: 'release', face: 1,
            check: blocked,
            during: blocked,
            start: api2 => api2.sfx('lever', 'C'),
            done(api2) {
              api2.sfx('release', 'C');
              openExit(api2);
            },
          },
        ],
      });
    },
  },
  ...common('C'),
];

export const dialogue = { A: nadia, B: theo, C: ruth };
