// Static data for "The Three Chambers": geometry, waypoints, circuits,
// doors, prisoners, hotspots and the restraint codes. Pure data.

// Every location is a 1-D walkable span in logical room space (see config).
// Rooms connect to the hall only through their door.
export const rooms = {
  A: { id: 'A', cam: 'CAM 01', label: 'CHAMBER A', bounds: [46, 452], door: { id: 'A', x: 452, hallX: 92 } },
  B: { id: 'B', cam: 'CAM 02', label: 'CHAMBER B', bounds: [40, 452], door: { id: 'B', x: 452, hallX: 212 } },
  C: { id: 'C', cam: 'CAM 03', label: 'ROOM C', bounds: [46, 452], door: { id: 'C', x: 452, hallX: 332 } },
  hall: { id: 'hall', cam: 'CAM 04', label: 'EXIT CORRIDOR', bounds: [24, 452], exitX: 446, exitDoor: 'exit' },
};

export const feeds = ['A', 'B', 'C', 'hall'];

// Switchboard in Room C: isolator handles left to right, then the main breaker.
export const BOARD = { order: ['lightsA', 'lightsBC', 'incinerator', 'pump', 'vent', 'exit'], x0: 58, dx: 28, main: 228 };
const isoX = id => BOARD.x0 + BOARD.dx * BOARD.order.indexOf(id);

// Where a prisoner stands to use something (they face the mechanism).
export const spots = {
  A: { chair: 172, stand: 198, lever: 300, crank: 86, door: 452 },
  B: { valve: 98, ring: 196, plate: 387, door: 452 },
  C: { iso: Object.fromEntries(BOARD.order.map(id => [id, isoX(id) + 14])), main: BOARD.main + 14, release: 268, vent: 364, door: 452 },
  hall: { wait: 404 },
};

export const prisoners = [
  { id: 'A', name: 'Nadia', room: 'A', x: 172, facing: 1, stress: 88, baseline: 40, immobile: true, anim: 'seated' },
  { id: 'B', name: 'Theo', room: 'B', x: 214, facing: -1, stress: 50, baseline: 32, tether: [64, 300] },
  { id: 'C', name: 'Ruth', room: 'C', x: 330, facing: -1, stress: 38, baseline: 26 },
];

export const capacity = 10;

export const circuits = [
  { id: 'lightsA', label: 'Lighting — Chamber A', short: 'LIGHTS A', amps: 2, isolated: true },
  { id: 'lightsBC', label: 'Lighting — B / C / Hall', short: 'LIGHTS B·C·HALL', amps: 2, on: true },
  { id: 'incinerator', label: 'Incinerator', short: 'INCINERATOR', amps: 4, on: true },
  { id: 'pump', label: 'Drain pump — Chamber B', short: 'DRAIN PUMP', amps: 4, isolated: true },
  { id: 'vent', label: 'Ventilation fan', short: 'VENT FAN', amps: 3 },
  { id: 'exit', label: 'Exit door motor', short: 'EXIT MOTOR', amps: 5, isolated: true },
];

export const doors = [
  { id: 'A', label: 'CELL DOOR A' },
  { id: 'B', label: 'CELL DOOR B' },
  { id: 'C', label: 'CELL DOOR C' },
  { id: 'exit', label: 'EXIT' },
];

export const COLORS = ['red', 'blue', 'yellow'];
export const SHAPES = ['triangle', 'circle', 'square'];
export const SYMBOLS = COLORS.flatMap(c => SHAPES.map(s => `${c}-${s}`));

// Handcrafted; every code repeats a colour or a shape so both words matter.
export const CODES = [
  ['red-triangle', 'blue-circle', 'yellow-square', 'red-circle'],
  ['blue-square', 'yellow-triangle', 'blue-circle', 'red-square'],
  ['yellow-circle', 'red-square', 'blue-triangle', 'yellow-triangle'],
  ['red-circle', 'yellow-square', 'red-triangle', 'blue-square'],
  ['blue-triangle', 'red-circle', 'yellow-circle', 'blue-square'],
];

export const symbolName = sym => sym.replace('-', ' ').toUpperCase();

export const PLAQUE = [
  'CHAMBER B — DRAIN CYCLE',
  'REQUIRES: AUX PRESSURE STABLE (CHAMBER A)',
  'DRAIN PUMP + VENT FAN POWERED',
  'IF THE INTAKE FAULTS OPEN:',
  '1  CLOSE INTAKE VALVE (MANUAL, IN CHAMBER)',
  '2  OPEN VENT DAMPER (ROOM C)',
  '3  PRESSURE RELIEF (CONTROL ROOM)',
  'DO NOT ALTER THE SEQUENCE',
];

// Inspectable regions in logical room coordinates: [x, y, w, h].
export const hotspots = [
  { id: 'a-chair', room: 'A', rect: [128, 118, 96, 112], title: 'Restraint chair' },
  { id: 'a-box', room: 'A', rect: [88, 84, 62, 70], title: 'Restraint control box' },
  { id: 'a-lever', room: 'A', rect: [282, 66, 104, 112], title: 'Aux pressure lever' },
  { id: 'a-crank', room: 'A', rect: [46, 104, 62, 72], title: 'Exit bolt A' },
  { id: 'a-door', room: 'A', rect: [418, 88, 56, 110], title: 'Door A' },
  { id: 'b-plaque', room: 'B', rect: [150, 58, 104, 84], title: 'Maintenance plaque' },
  { id: 'b-valve', room: 'B', rect: [50, 26, 72, 150], title: 'Intake valve' },
  { id: 'b-gauge', room: 'B', rect: [264, 76, 44, 44], title: 'Level gauge' },
  { id: 'b-shackle', room: 'B', rect: [168, 206, 70, 32], title: 'Floor ring and shackle' },
  { id: 'b-plate', room: 'B', rect: [358, 112, 60, 126], title: 'Pressure plate' },
  { id: 'c-board', room: 'C', rect: [38, 44, 206, 140], title: 'Switchboard' },
  { id: 'c-release', room: 'C', rect: [256, 84, 58, 84], title: 'Final release' },
  { id: 'c-vent', room: 'C', rect: [322, 26, 92, 152], title: 'Vent fan and damper' },
  { id: 'h-exit', room: 'hall', rect: [408, 50, 72, 150], title: 'Exit door' },
  { id: 'h-graffiti', room: 'hall', rect: [124, 64, 176, 52], title: 'Graffiti' },
  { id: 'h-incinerator', room: 'hall', rect: [360, 128, 44, 56], title: 'Incinerator hatch' },
];
