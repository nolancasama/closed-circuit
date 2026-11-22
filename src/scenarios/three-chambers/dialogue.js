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

// Stimulus pools are data, independent of the intercom command trees. Habituation
// changes what they say without removing useful physical warning cues.
const pool = (first, repeated, habituated) => ({ first, repeated, habituated });

export const reactions = {
  A: {
    light: pool(
      ['The light! Was that you?', 'Please warn me before you change the lights.', 'What happened to the light? I cannot see you.'],
      ['I cannot even cover my eyes in this chair.', 'Stop playing with the switch. Please.', 'My eyes cannot keep up with you.'],
      ['Again. I heard the switch.', 'I am keeping my eyes closed this time.', 'I will wait for my eyes to adjust.']),
    machine: pool(
      ['What is that machinery for?', 'Something started behind the wall. Can you hear it?', 'There is a motor running somewhere.'],
      ['That sound changed again. Is it helping?', 'Theo? Ruth? Did you hear that too?', 'Tell me what that noise means.'],
      ['I know that motor now.', 'The machines again. I am listening for your voice.', 'Another motor. I can hear it.']),
    door: pool(
      ['A door moved. Is somebody coming?', 'Was that my lock?', 'I heard a latch. Can you reach me?'],
      ['Please leave me a way out.', 'I heard the door again. What are you doing?', 'Which door was that? Tell me.'],
      ['Another door. Still here.', 'I am listening for footsteps after it.', 'I heard it. Please remember my room.']),
    klaxon: pool(
      [{ text: 'Turn it off! I cannot get away from it!', cue: 'cower' }, 'Ruth! What does that alarm mean?', 'That alarm is right over my head!'],
      ['Please stop the alarm. I can barely hear you.', 'You keep doing that. You know we are in here.', 'Tell us why it keeps sounding!'],
      ['The alarm again. Breathe. Just breathe.', 'I know. Something is wrong again.', 'I am waiting for the noise to stop.']),
    heat: pool(
      ['It is getting hot against the straps. Is that supposed to happen?', 'My skin is burning where the metal touches. Stop the heat.', 'The air is too hot. Can you cool this room?'],
      ['I cannot move out of it! Please turn it down!', 'Theo, if your room gets hot, get away from the pipes.', 'The straps are getting hotter again.'],
      ['I am still strapped in. I still cannot get away.', 'Please. Watch the temperature, not just the switches.', 'Still too hot. I need you to act.']),
    'heat:shiver': ['It is cold in here. I cannot even rub my arms.', 'My hands are freezing under these straps.', 'I am shaking. Please warm the room.'],
    'heat:comfortable': ['The air feels easier now. Thank you.', 'That is better. Please keep it like this.', 'I can breathe more easily at this temperature.'],
    smoke: pool(
      ['I can smell something burning.', 'Ruth? Is that smoke coming from your room?', 'There is smoke in the air.'],
      ['The smell is back. Please check on Ruth.', 'Do not leave that burning. We share these walls.', 'My throat is stinging again.'],
      ['Smoke again. I am trying to breathe slowly.', 'I can still smell it.', 'I am keeping my head down. Clear the air.']),
    shock: pool(
      ['Ah! Please, no more electricity!', 'That hurt! I felt it through the chair!'],
      ['Stop! You know what that does now!', 'I cannot take another one. Please listen.'],
      ['No. Not again. Please.', 'I am still here. Stop hurting me.']),
    sparks: pool(
      ['Something is sparking!', 'Those wires are live. Please switch them off.'],
      ['Again! Get the power off before it hurts someone!', 'Do you hear that crackling? Stop it!'],
      ['The sparks again. You have to stop this.', 'That is not a safe sound.']),
    lost: pool(
      ['Why did they go quiet? Please answer me!', 'No. Tell me they got out. Tell me something.'],
      ['Not someone else. Please, not again.', 'I can hear the silence. Do not pretend it is alright.'],
      ['Is anyone still listening?', 'Please get whoever is left out of here.']),
    refusal: ['Wait. I am shaking too much. Ask me again in a moment.', 'You hurt us with that board. Tell me you are sure.', 'Give me a breath. Then tell me again.'],
  },
  B: {
    light: pool(
      ['Hey! My eyes were just getting used to that.', 'The lights changed. You can control those?', 'Was that you on the lights? Give me a warning.'],
      ['Could you pick a setting? I am trying to see the floor.', 'I do not find the light show reassuring.', 'It takes me a moment to see the chain again.'],
      ['Lights again. Still chained down here.', 'Yes, I noticed. I always notice.', 'Another switch. Same room.']),
    machine: pool(
      ['That motor is very close to my feet.', 'What did you just switch? Something moved in the pipe.', 'The floor is vibrating. Which machine is that?'],
      ['The pipe sounds different. Is that good?', 'Ruth, tell them if that noise is bad, alright?', 'Something changed in the motor again.'],
      ['I know that hum now. Unfortunately.', 'More machinery. Still hoping it is the helpful kind.', 'Heard it. Watching the pipe.']),
    door: pool(
      ['A door! Tell me that is an exit.', 'I heard a lock move. Can mine open?', 'Someone moved a door. Is the route open?'],
      [{ text: 'I am still in here! Do not lock me in!', cue: 'pound door' }, 'Please keep the way out clear.', 'Which door moved this time?'],
      ['Door again. I am waiting for my turn.', 'I heard it. I am ready when you are.', 'Another latch. Still waiting here.']),
    klaxon: pool(
      ['Oh, that is never a good noise!', 'Nadia! Ruth! Are you both alright?', 'What failed? Tell us what is happening!'],
      ['Stop pressing whatever makes that happen!', 'I cannot hear the pipe over that alarm!', 'Another alarm? Check before you switch!'],
      ['That alarm again. Of course.', 'I know, I know. Emergency. We are still here.', 'Waiting for the alarm to finish. Again.']),
    heat: pool(
      ['The pipes are getting hot. Is that deliberate?', 'My room is changing temperature. Watch that gauge, please.', 'That pipe is heating the whole room.'],
      ['I cannot get away from this chain! Turn it down!', 'Nadia, shout if it gets hot in there. Do not wait.', 'The heat is coming back. Please deal with it.'],
      ['Temperature again. Check mine before you leave it.', 'Still chained to the floor, remember?', 'Still watching those hot pipes.']),
    'heat:shiver': ['This water is freezing. I cannot stop shaking.', 'My teeth are chattering. Please hurry with the drain.', 'I cannot get warm standing in this.'],
    'heat:comfortable': ['Oh. That feels better. I can feel my feet again.', 'That is a better temperature. Thanks for watching it.', 'The pipes feel safe again. Thank you.'],
    smoke: pool(
      ['Is something on fire? Ruth?', 'That burning smell is coming through the vent.', 'Something is smoking on the other side of that wall.'],
      ['The smoke is back. Get some air moving!', 'Ruth, stay low! Can you hear me?', 'My throat is sore again. Clear that smoke!'],
      ['Still smells wrong in here.', 'Smoke again. Please sort the fan out.', 'Keeping low until the air clears.']),
    shock: pool(
      ['Aah! The water is live! Kill the lights!', 'My leg! Something shocked me through the water!'],
      ['NO! You just did it again! Switch it OFF!', 'Another one will finish me. Please stop resetting that thing!'],
      ['Stop. Please. No more.', 'The water is still live! Leave that switch alone!']),
    sparks: pool(
      ['Those lights are spitting sparks above the water!', 'That fixture is crackling. Electricity and water, remember?'],
      ['It is sparking again! Do not reset it!', 'You saw what happened. Leave LIGHTS B off!'],
      ['Still sparking. Still standing in water.', 'Do not try that switch again.']),
    lost: pool(
      ['Hello? Say something! Somebody answer!', 'No, no. They were just talking. What happened?'],
      ['Not again. Get the rest of us out.', 'I heard that. Do not tell me everything is fine.'],
      ['Who is left? Please answer me.', 'Just get us out. Whoever is left.']),
    refusal: ['Hold on. I need a second before I try that.', 'After what you just did? Ask me again when you mean it.', 'I am shaking. Give me a breath, then say it again.'],
  },
  C: {
    light: pool(
      ['Give my eyes a moment. I need to see this board.', 'Lights changed. Watch what you switch while I am working.', 'Light switch. Hold on while my eyes adjust.'],
      ['I work slower in the dark. Your choice.', 'Enough with the lights. There are exposed terminals here.', 'Keep the light steady while I read these labels.'],
      ['Another light change. I have the board memorised by now.', 'Yes, I noticed. Mind the meter.', 'Heard the switch. Still working.']),
    machine: pool(
      ['Hear the load change? That is your machinery.', 'A motor changed speed. Keep an eye on the amps.', 'That motor changes your power draw. Watch the meter.'],
      ['That is another load change. Plan the next one.', 'Give a motor time to settle before you switch it again.', 'Another motor change. Check your available capacity.'],
      ['Same old motor note.', 'I hear it. Watching the board.', 'Motor heard. Mind the load.']),
    door: pool(
      ['Door mechanism. Keep the route clear.', 'That latch moved. Who is going through?', 'Door motor. Make sure the passage is clear.'],
      ['Mind the doors. Someone may be moving.', 'Do not close one on a person. These motors will not care.', 'Another door cycle. Check the cameras.'],
      ['Door cycled. Heard it.', 'Another latch. Keep track of who is where.', 'Latch heard. Watch the route.']),
    klaxon: pool(
      ['Emergency stop? Tell me what failed.', 'Everyone stay clear of moving machinery!', 'Stop signal. Check the board before resetting.'],
      ['That stop is for emergencies. What is the fault?', 'You are frightening them. Read the board before you touch it.', 'Another stop? Find the cause first.'],
      ['Another stop. Start again, one circuit at a time.', 'Alarm heard. Now tell me what you need.', 'Heard it. Keep the circuits isolated until you know.']),
    heat: pool(
      ['Boiler heat. Watch the room gauges, not the selector.', 'That pipe is too hot. Reduce the steam.', 'Steam is heating this room. Check the gauge.'],
      [{ text: 'I am backing away from the pipe. Cut the heat.', cue: 'back away' }, 'Nadia cannot move away from that chair. Check her temperature.', 'Heat is rising again. Reduce it before someone gets hurt.'],
      ['Heat again. Do not leave it unattended.', 'You know the boiler runs hot. Act on it.', 'Still too hot by the board. Turn it down.']),
    'heat:shiver': ['Cold fingers and small switches. Give me time.', 'Temperature is dropping. Keep an eye on the others.', 'My hands are cold. This will take longer.'],
    'heat:comfortable': ['Temperature is back in range. Keep it there.', 'That is better. I can concentrate on the board.', 'Room temperature is safe again. Carry on.'],
    smoke: pool(
      [{ text: 'Flue is backing up. Run the extractor fan.', cue: 'cough' }, 'Smoke in the switch room. I need airflow.', 'Embers are smoking. Start the room extractor.'],
      [{ text: 'I cannot work in this. Clear the smoke first.', cue: 'back away' }, 'The boiler keeps smouldering with the power off. Run the fan.', 'Smoke is building again. Get the extractor running.'],
      ['Still smoke. Run the fan. You know the drill.', 'I need clean air before I touch that board again.', 'Keeping low. Clear the air before we continue.']),
    shock: pool(
      ['Live fault! Get that circuit off!', 'Keep clear of the metal! There is a fault here!'],
      ['Do not reset a breaker into the same fault!', 'It will keep doing that until you remove the cause.'],
      ['Same fault. Same answer. Isolate it.', 'Leave the branch off until it is safe.']),
    sparks: pool(
      ['Sparks. Branch fault. Leave that breaker out.', 'Theo, keep clear of the fittings! Operator, cut LIGHTS B.'],
      ['Resetting does not repair a short!', 'Stop feeding that fault. You will hurt someone.'],
      ['Still faulted. Leave it off.', 'The breaker is doing its job. Let it.']),
    lost: pool(
      ['Nadia? Theo? Answer me. ...Damn it.', 'We lost someone. Keep your head. The others still need you.'],
      ['Another one. Do not waste the time we have left.', 'Listen to me. Get the survivor out.'],
      ['Keep working. Whoever is left.', 'Do not abandon the people you can still reach.']),
    refusal: ['Not until you think about it. Take a breath and ask again.', 'You are rattling me. Give me a second, then repeat it.', 'I need my hands steady. One moment.'],
  },
};

export const recoveryLines = { C: 'Air is better. I can stand. Tell me what needs doing again.' };
