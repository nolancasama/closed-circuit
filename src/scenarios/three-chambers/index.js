// Scenario 01 — The Three Chambers. Assembles data, dialogue and mechanics
// into the shape the engine and presentation expect.
import * as data from './data.js';
import * as M from './mechanics.js';
import { dialogue } from './dialogue.js';

export const threeChambers = {
  id: 'three-chambers',
  title: 'The Three Chambers',
  number: '01',
  rooms: data.rooms,
  feeds: data.feeds,
  spots: data.spots,
  prisoners: data.prisoners,
  circuits: data.circuits,
  capacity: data.capacity,
  doors: data.doors,
  hotspots: data.hotspots,
  symbols: data.SYMBOLS,
  dialogue,
  controls: M.controls,
  init: M.init,
  update: M.update,
  check: M.check,
  environment: M.environment,
  speedFor: M.speedFor,
  microFor: M.microFor,
  lines: M.lines,
  door: M.door,
  doorView: M.doorView,
  inspect: M.inspect,
  ending: M.ending,
  subjectStatus: M.subjectStatus,
  banner: M.banner,
  feedStatus: M.feedStatus,
  lit: M.lit,
};
