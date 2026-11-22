// Pure facility grid: faults trip branches, overload trips the main.
import { POWER, STRESS } from '../config.js';
import { faultFor, onFault } from './facility.js';

export function createPower(circuits, capacity = POWER.capacity) {
  const power = { capacity, tripped: false, order: [], circuits: {}, armed: null };
  for (const c of circuits) {
    power.order.push(c.id);
    power.circuits[c.id] = { ...c, isolated: !!c.isolated, on: !!c.on, branchTripped: false, fault: null };
  }
  return power;
}
export function load(power) {
  return power.order.reduce((sum, id) => {
    const c = power.circuits[id];
    return sum + (c.on && !c.isolated && !c.branchTripped ? c.amps : 0);
  }, 0);
}
export function live(power, id) {
  const c = power.circuits[id];
  return !!c && !power.tripped && c.on && !c.isolated && !c.branchTripped;
}
export function changed(api, id) {
  const c = api.state.power.circuits[id];
  api.emit({ type: 'power-change', circuit: id, on: c.on, live: live(api.state.power, id) });
  if (!id.startsWith('lights')) api.stimulus?.({ kind: 'machine', room: c.room, on: live(api.state.power, id) });
}
export function checkBranch(api, id) {
  if (!live(api.state.power, id)) return false;
  const fault = faultFor(api, id);
  return fault ? tripBranch(api, id, fault) : false;
}
export function tripBranch(api, id, fault) {
  const c = api.state.power.circuits[id];
  if (!c || c.branchTripped) return false;
  c.branchTripped = true;
  c.fault = fault;
  api.sfx('breaker', c.room);
  api.log('warn', `${c.short} BRANCH TRIPPED — ${fault === 'water-short' ? 'WATER AT LIVE FIXTURES; LEAVE THE LIGHT OFF' : 'FLUE OVERTEMPERATURE; RESTORE AIRFLOW'}`);
  api.emit({ type: 'branch-trip', circuit: id, fault });
  changed(api, id);
  onFault(api, id, fault);
  return true;
}
export function resetBranch(api, id) {
  const c = api.state.power.circuits[id];
  if (!c) return { ok: false, code: 'unknown', msg: 'NO SUCH CIRCUIT' };
  if (!c.branchTripped) return { ok: true, code: 'nochange', msg: 'BRANCH ALREADY CLOSED' };
  const fault = faultFor(api, id);
  c.branchTripped = false;
  c.fault = null;
  api.emit({ type: 'branch-reset', circuit: id });
  if (fault) {
    tripBranch(api, id, fault);
    return { ok: false, code: 'fault', msg: `${c.short} RE-TRIPPED — FAULT PERSISTS` };
  }
  api.sfx('breaker', c.room);
  api.log('ok', `${c.short} BRANCH RESET`);
  if (!api.state.power.tripped && load(api.state.power) > api.state.power.capacity) trip(api);
  changed(api, id);
  return { ok: true, code: 'reset', msg: `${c.short} BRANCH RESET` };
}
export function requestOn(api, id, on, force = false, previousAmps = null) {
  const power = api.state.power, c = power.circuits[id];
  if (!c) return { ok: false, code: 'unknown', msg: 'NO SUCH CIRCUIT' };
  if (c.isolated) return { ok: false, code: 'isolated', msg: `${c.short} IS ISOLATED AT THE SWITCHBOARD (ROOM C)` };
  if (on && c.requiresOff?.some(other => power.circuits[other]?.on)) return { ok: false, code: 'interlock', msg: `${c.short} NEEDS DRAIN PUMP, VENT FAN AND INCINERATOR OFF` };
  const changingCurrent = previousAmps != null && previousAmps !== c.amps;
  if (c.on === on && !changingCurrent) return { ok: true, code: 'nochange', msg: `${c.short} ALREADY ${on ? 'ON' : 'OFF'}` };
  const projected = load(power) + (on && !c.on && !c.branchTripped ? c.amps : 0);
  if (on && !power.tripped && projected > power.capacity) {
    const armed = power.armed && power.armed.id === id && api.state.t <= power.armed.until;
    if (!force && !armed) {
      power.armed = { id, until: api.state.t + POWER.forceWindow };
      api.sfx('deny');
      return { ok: false, code: 'overload-risk', msg: `OVERLOAD RISK: ${projected} / ${power.capacity} A — PRESS AGAIN TO FORCE` };
    }
    c.on = true;
    power.armed = null;
    changed(api, id);
    trip(api);
    return { ok: true, code: 'tripped', msg: 'OVERLOAD — MAIN BREAKER TRIPPED' };
  }
  c.on = on;
  power.armed = null;
  api.sfx('switch');
  api.log('sys', `${c.short} switched ${on ? 'ON' : 'OFF'}${power.tripped ? ' (main is tripped — no power)' : ''}`);
  changed(api, id);
  if (on) checkBranch(api, id);
  return { ok: true, code: c.branchTripped && on ? 'branch-tripped' : on ? 'on' : 'off', msg: `${c.short} ${on ? 'ON' : 'OFF'}${c.branchTripped ? ' — BRANCH TRIPPED' : ''}` };
}
export function toggle(api, id, on, force = false) {
  const f = api.state.facility;
  if (f && id === f.definition.fanCircuit) {
    const c = api.state.power.circuits[id], oldAmps = c.amps;
    const speed = on ? (f.fanSpeed === 'OFF' ? 'MED' : f.fanSpeed) : 'OFF';
    c.amps = POWER.fanAmps[speed];
    const result = requestOn(api, id, on, force, oldAmps);
    if (!result.ok) c.amps = oldAmps;
    else f.fanSpeed = speed;
    return result;
  }
  return requestOn(api, id, on, force);
}
export function trip(api) {
  const power = api.state.power;
  if (power.tripped) return;
  const powered = power.order.filter(id => live(power, id));
  power.tripped = true;
  if (api.state.facility) api.state.facility.tripLostCount = api.state.prisonerOrder.filter(id => !api.prisoner(id).alive).length;
  api.state.stats.overloads++;
  api.sfx('trip');
  api.emit({ type: 'main-trip', repeat: api.state.stats.overloads > 1 });
  api.emit({ type: 'interference', room: '*', strength: 1 });
  api.log('alert', 'MAIN BREAKER TRIPPED — reset it at the switchboard in Room C');
  api.stressAll(STRESS.trip);
  for (const id of powered) changed(api, id);
}
export function resetMain(api) {
  const power = api.state.power;
  if (!power.tripped) return true;
  if (load(power) > power.capacity) {
    api.state.stats.overloads++;
    api.sfx('trip');
    api.emit({ type: 'main-trip', repeat: true });
    api.emit({ type: 'interference', room: '*', strength: 0.7 });
    api.log('alert', `MAIN TRIPPED AGAIN — switched load ${load(power)} / ${power.capacity} A`);
    return false;
  }
  power.tripped = false;
  api.sfx('breaker');
  api.log('ok', 'MAIN BREAKER RESET — power restored');
  const f = api.state.facility;
  const clean = !f || f.tripLostCount === api.state.prisonerOrder.filter(id => !api.prisoner(id).alive).length;
  if (f && clean) f.facts.cleanRecovery = true;
  api.emit({ type: 'main-reset', clean });
  for (const id of power.order) if (live(power, id)) { changed(api, id); checkBranch(api, id); }
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
