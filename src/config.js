// All tuning numbers. Pure data, shared by the headless sim and presentation.

export const SIM_HZ = 60;

// Logical room space every feed is drawn in.
export const ROOM_W = 480;
export const ROOM_H = 270;
export const FLOOR_Y = 228;

// In-game clock starts at 02:13:07.
export const CLOCK_START = 2 * 3600 + 13 * 60 + 7;

export const MOVE = {
  walk: 62,        // units/s (a prisoner is ~80 units tall)
  run: 118,
  wade: 36,        // knee-to-waist water
  swim: 28,
  shift: 20,       // idle weight-shifting
  arrive: 0.75,
  stuckAfter: 14,  // a goto step that has not finished by then is snapped
};

export const STRESS = {
  panic: 85,
  calmBelow: 68,       // panic ends below this (hysteresis)
  nervous: 55,
  reassure: 35,
  reassureWeak: 10,    // when reassured again within the cooldown
  reassureCooldown: 5,
  decay: 1.0,          // per second toward baseline when nothing is wrong
  recover: 0.4,        // per second back up to baseline after being reassured
  darkDrift: 0.8,      // per second while in the dark ...
  darkCap: 70,         // ... but darkness alone never causes panic
  alarmRate: 0.8,
  alarmCap: 90,
  trip: 15,            // main breaker trips
  pa: 4,               // the Voice speaks
};

export const SPEECH = {
  base: 1.4,
  perChar: 1 / 24,
  min: 1.8,
  max: 7.5,
  replyDelay: 0.55,
  lockCap: 2.0,        // a channel is busy at most this long after a reply starts
};

export const POWER = {
  capacity: 10,
  forceWindow: 3,      // seconds a "FORCE?" confirmation stays armed
  amps: { lightsA: 2, lightsB: 0.75, lightsC: 0.75, lightsHall: 0.5, incinerator: 4, pump: 4, exit: 5 },
  fanAmps: { OFF: 0, LOW: 2, MED: 3, HIGH: 4 },
  fanFlow: { OFF: 0, LOW: 0.45, MED: 1, HIGH: 1.5 },
};

export const FACILITY = {
  ambient: 22,
  heat: { uneasy: 35, dangerous: 50, lethal: 70, rate: 1, drift: 0.003, cooling: 0.025, airflowCooling: 0.018, floodCooling: 0.09, waterTemperature: 12, lethalTime: 14, exposureRecovery: 2, cold: 18, warmMin: 19, warmMax: 34, warmthCalm: 1.5 },
  smoke: { backdraftBelow: 0.7, emberBuild: 0.02, hotEmberBuild: 0.035, passiveClear: 0.003, passiveClearCold: 0.025, airflowClear: 0.07, spreadAbove: 0.35, spread: 0.006, cough: 0.25, dense: 0.75, retreat: 0.5, recoverBelow: 0.28, collapseTime: 22, exposureRecovery: 2, stress: 0.6, heatStress: 1.5 },
  embersTime: 45,
  hotEmbersTime: 90,
  emberHeatTime: 30,
  flueCutTime: 70,
  flueResetBelow: 35,
  flueCoolRate: 3,
  fixturesLevel: 0.5,
  waterContactLevel: 0.01,
  shockStress: 28,
  lethalShocks: 3,
  stopStress: 18,
  recoveryTime: 5,
  secretWarm: 38,
  darkWorkFactor: 0.6,
  smokeWorkFactor: 0.6,
  retreatCueTime: 4,
};

export const REACTIONS = {
  initialTrust: 65, trustMin: 0, trustMax: 100, hurtTrust: 9, frightTrust: 3,
  helpTrust: 4, reassureTrust: 14, lowTrust: 30, distress: 78, cooldown: 8,
  habituatedAfter: 4, quietGap: 90, cueTime: 3, refusalDelay: 1.4,
};

export const FLOOD = {
  fillTime: 90,        // seconds from dry to lethal with the intake open
  lethal: 0.96,
  leak: 0.3,           // inflow fraction after the intake is closed
  surge: 0.10,         // instant rise when vented with the intake open
  ventSurgeMul: 1.3,   // inflow multiplier while vented with the intake open
  forcedAuxMul: 1.35,  // inflow multiplier when aux pressure was overridden
  drainTime: 9,        // seconds to drain from full
  reliefLockout: 3,
  swimAbove: 0.34,     // level at which Theo floats
};

export const EXIT = {
  openTime: 40,
  hesitateThreshold: 60,
  hesitateMax: 45,     // an unattended hesitating prisoner moves on after this
  lieStress: 30,
};

export const DURATIONS = {
  isolator: 2.0,
  mainReset: 2.5,
  auxLever: 3.0,
  boltCrank: 5.0,
  intake: 5.0,
  damper: 3.5,
  release: 3.0,
  plate: 0.8,
};

export const RESTRAINT = {
  attempts: 3,
  codeLength: 4,
  shockStress: 45,
};

// Hold-to-confirm durations in seconds (UI).
export const HOLD = {
  start: 1.2,
  override: 2.0,
  leave: 2.5,
};

export const COMMENTARY = {
  scriptedGap: 10,
  cooldown: 90,       // global sim seconds between contextual Voice lines
  interference: 0.45,
};
