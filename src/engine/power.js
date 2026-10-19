// Facility power grid: circuits with manual isolators, console switching,
// a capacity-limited main breaker. Pure.
import { POWER } from '../config.js';

export function createPower(circuits, capacity = POWER.capacity) {
  const power = { capacity, tripped: false, order: [], circuits: {}, armed: null };
  for (const c of circuits) {
    power.order.push(c.id);
    power.circuits[c.id] = { id: c.id, label: c.label, short: c.short, amps: c.amps, isolated: !!c.isolated, on: !!c.on };
  }
  return power;
}

// Amps drawn by switched-on, non-isolated circuits (what the main sees when closed).
export function load(power) {
  let sum = 0;
  for (const id of power.order) {
    const c = power.circuits[id];
    if (c.on && !c.isolated) sum += c.amps;
  }
  return sum;
}

export function live(power, id) {
  const c = power.circuits[id];
  return !!c && !power.tripped && c.on && !c.isolated;
}

// Console switch. Returns { ok, code, msg }.
export function toggle(api, id, on, force = false) {
  const power = api.state.power;
  const c = power.circuits[id];
  if (!c) return { ok: false, code: 'unknown', msg: 'NO SUCH CIRCUIT' };
  if (c.isolated) return { ok: false, code: 'isolated', msg: `${c.short} IS ISOLATED AT THE SWITCHBOARD (ROOM C)` };
  if (c.on === on) return { ok: true, code: 'nochange', msg: `${c.short} ALREADY ${on ? 'ON' : 'OFF'}` };
  if (!on) {
    c.on = false;
    power.armed = null;
    api.sfx('switch');
    api.log('sys', `${c.short} switched OFF`);
    return { ok: true, code: 'off', msg: `${c.short} OFF` };
  }
  const projected = load(power) + c.amps;
  if (!power.tripped && projected > power.capacity) {
    const armed = power.armed && power.armed.id === id && api.state.t <= power.armed.until;
    if (!force && !armed) {
      power.armed = { id, until: api.state.t + POWER.forceWindow };
      api.sfx('deny');
      return { ok: false, code: 'overload-risk', msg: `OVERLOAD RISK: ${projected} / ${power.capacity} A — PRESS AGAIN TO FORCE` };
    }
    power.armed = null;
    c.on = true;
    api.sfx('switch');
    api.log('alert', `${c.short} forced ON at ${projected} / ${power.capacity} A`);
    trip(api);
    return { ok: true, code: 'tripped', msg: 'OVERLOAD — MAIN BREAKER TRIPPED' };
  }
  power.armed = null;
  c.on = true;
  api.sfx('switch');
  api.log('sys', power.tripped ? `${c.short} switched ON (main is tripped — no power)` : `${c.short} switched ON`);
  return { ok: true, code: 'on', msg: `${c.short} ON` };
}

export function trip(api) {
  const power = api.state.power;
  if (power.tripped) return;
  power.tripped = true;
  api.state.stats.overloads++;
  api.sfx('trip');
  api.emit({ type: 'interference', room: '*', strength: 1 });
  api.log('alert', 'MAIN BREAKER TRIPPED — reset it at the switchboard in Room C');
  api.stressAll(15);
}

// Reset at the board. Returns true when the main stays closed.
export function resetMain(api) {
  const power = api.state.power;
  if (!power.tripped) return true;
  if (load(power) > power.capacity) {
    api.state.stats.overloads++;
    api.sfx('trip');
    api.emit({ type: 'interference', room: '*', strength: 0.7 });
    api.log('alert', `MAIN TRIPPED AGAIN — switched load ${load(power)} / ${power.capacity} A`);
    return false;
  }
  power.tripped = false;
  api.sfx('breaker');
  api.log('ok', 'MAIN BREAKER RESET — power restored');
  return true;
}

export function closeIsolator(api, id) {
  const c = api.state.power.circuits[id];
  if (!c || !c.isolated) return false;
  c.isolated = false;
  api.sfx('breaker');
  api.log('ok', `${c.short} isolator closed — switch it from the console`);
  return true;
}
