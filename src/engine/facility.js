// Reusable, scenario-configured facility simulation. Pure and fixed-step.
import { FACILITY as F, POWER } from '../config.js';
import * as Power from './power.js';

const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const occupants = (api, room) => api.state.prisonerOrder.map(id => api.prisoner(id)).filter(p => p.alive && !p.escaped && p.loc === room);
export function temperatureBand(t) {
  return t >= F.heat.lethal ? 'lethal' : t >= F.heat.dangerous ? 'dangerous' : t >= F.heat.uneasy || t < F.heat.cold ? 'uneasy' : 'comfortable';
}

export function init(api, definition) {
  if (!definition) return;
  const fan = api.state.power.circuits[definition.fanCircuit];
  api.state.facility = {
    definition,
    fanSpeed: fan.on ? 'MED' : 'OFF', steamHeat: 'OFF', airflow: 0, extraction: 0,
    embers: Power.live(api.state.power, definition.heatCircuit) ? F.embersTime : 0, emberHeat: 0,
    flueExposure: 0, flueWarning: false, tripLostCount: 0, fireWasLive: Power.live(api.state.power, definition.heatCircuit),
    rooms: Object.fromEntries(definition.rooms.map(id => [id, { temperature: F.ambient, heatBand: 'comfortable', smoke: 0, coughing: false, dense: false, dangerous: false }])),
    secrets: Object.fromEntries((definition.secrets || []).map(secret => [secret.id, false])),
    facts: { steamWithoutFire: false, fanSpeedChanged: false, backdraft: false, embersAfterTrip: false, waterShort: false, emergencyStop: false, cleanRecovery: false, darkWork: false, highFloodVent: false, warmedTheo: false, warmWriting: false, irWriting: false },
  };
  fan.amps = POWER.fanAmps[api.state.facility.fanSpeed];
  for (const id of api.state.prisonerOrder) {
    const p = api.prisoner(id);
    p.heatExposure = 0;
    p.smokeExposure = 0;
    p.shocks = 0;
    p.retreating = false;
    p.recoveryExposure = 0;
  }
}

export function airflow(api) {
  const f = api.state.facility;
  return f && f.definition.damperOpen(api.state) ? extraction(api) : 0;
}

export function extraction(api) {
  const f = api.state.facility;
  return f && api.live(f.definition.fanCircuit) ? POWER.fanFlow[f.fanSpeed] : 0;
}

export function faultFor(api, id) {
  const f = api.state.facility;
  if (!f) return null;
  const d = f.definition;
  if (id === d.waterCircuit && d.waterLevel(api.state) >= F.fixturesLevel) return 'water-short';
  if (id === d.heatCircuit) {
    const branch = api.state.power.circuits[id];
    if (branch.fault === 'flue-overtemperature' && f.flueExposure >= F.flueResetBelow) return 'flue-overtemperature';
    if (f.flueExposure >= F.flueCutTime && api.live(id) && f.steamHeat !== 'OFF' && extraction(api) === 0) return 'flue-overtemperature';
  }
  return null;
}

export function onFault(api, id, fault) {
  const f = api.state.facility;
  if (!f || fault !== 'water-short') return;
  const d = f.definition;
  const circuit = api.state.power.circuits[id];
  if (!circuit.on || circuit.isolated || api.state.power.tripped) return;
  api.emit({ type: 'sparks', room: d.waterRoom, circuit: id });
  api.stimulus?.({ kind: 'sparks', room: d.waterRoom, harmful: true });
  api.emit({ type: 'interference', room: d.waterRoom, strength: 0.8 });
  api.sfx('shock', d.waterRoom);
  // A reset of an unpowered wet branch still re-trips, but cannot shock anyone.
  if (circuit.on && !circuit.isolated && !api.state.power.tripped && d.waterLevel(api.state) >= F.waterContactLevel) {
    for (const p of occupants(api, d.waterRoom)) {
      p.shocks++;
      p.flash = F.retreatCueTime;
      api.stress(p.id, F.shockStress);
      api.emit({ type: 'shock', room: d.waterRoom, pid: p.id, count: p.shocks });
      api.stimulus?.({ kind: 'shock', room: d.waterRoom, pid: p.id, harmful: true });
      if (p.shocks >= F.lethalShocks) api.lose(p.id, 'shock', true);
      else api.log('alert', `${p.name.toUpperCase()} SHOCKED — SWITCH THE WET LIGHT OFF. ANOTHER SHOCK CAN KILL.`);
    }
  }
  f.facts.waterShort = true;
}

export function setFanSpeed(api, speed, force = false) {
  const f = api.state.facility;
  if (!f || !Object.hasOwn(POWER.fanAmps, speed)) return { ok: false, msg: 'FAN SPEED MUST BE OFF, LOW, MED OR HIGH' };
  const c = api.state.power.circuits[f.definition.fanCircuit], oldAmps = c.amps, previous = f.fanSpeed;
  c.amps = POWER.fanAmps[speed];
  const result = Power.requestOn(api, c.id, speed !== 'OFF', force, oldAmps);
  if (!result.ok) { c.amps = oldAmps; return result; }
  f.fanSpeed = speed;
  f.airflow = airflow(api);
  if (speed !== previous) {
    f.facts.fanSpeedChanged = true;
    api.emit({ type: 'fan-speed', speed, previous, amps: c.amps });
  }
  return result;
}

export function control(api, id, payload = {}) {
  const f = api.state.facility;
  if (!f) return null;
  if (id === 'fan-speed') return setFanSpeed(api, payload.speed, !!payload.force);
  if (id === 'branch-reset') return Power.resetBranch(api, payload.circuit);
  if (id === 'steam-heat') {
    const room = payload.room;
    if (!['OFF', ...f.definition.rooms.filter(r => r !== 'hall')].includes(room)) return { ok: false, msg: 'STEAM HEAT MUST BE OFF, A, B OR C' };
    const previous = f.steamHeat;
    f.steamHeat = room;
    if (room !== 'OFF' && !api.live(f.definition.heatCircuit)) f.facts.steamWithoutFire = true;
    api.sfx('switch');
    api.emit({ type: 'steam-heat', room, previous });
    api.log('sys', `STEAM HEAT ${room}${room !== 'OFF' && !api.live(f.definition.heatCircuit) ? ' — NO INCINERATOR POWER' : ''}`);
    return { ok: true, msg: `STEAM HEAT ${room}` };
  }
  if (id === 'e-stop') {
    for (const circuit of api.state.power.order) {
      const c = api.state.power.circuits[circuit];
      const wasOn = c.on;
      c.on = false;
      if (wasOn) Power.changed(api, circuit);
    }
    api.state.power.armed = null;
    f.fanSpeed = 'OFF';
    api.state.power.circuits[f.definition.fanCircuit].amps = POWER.fanAmps.OFF;
    f.airflow = 0;
    f.facts.emergencyStop = true;
    api.stressAll(F.stopStress);
    api.emit({ type: 'e-stop' });
    api.emit({ type: 'klaxon', room: '*' });
    api.stimulus?.({ kind: 'klaxon', scope: 'all', harmful: true });
    api.sfx('alarm');
    api.log('alert', 'E-STOP — ALL OPERATOR CIRCUITS OFF. MAIN AND ISOLATORS UNCHANGED.');
    return { ok: true, msg: 'E-STOP — ALL CIRCUITS OFF' };
  }
  return null;
}

function updateRooms(api, dt, fire, source) {
  const f = api.state.facility, d = f.definition;
  const backdraft = !fire && source && f.extraction < F.smoke.backdraftBelow;
  const smokeFactor = backdraft ? 1 - f.extraction / F.smoke.backdraftBelow : 0;
  f.flueWarning = !!backdraft;
  if (backdraft) f.facts.backdraft = true;
  for (const room of d.rooms) {
    const env = f.rooms[room];
    const heating = fire && f.steamHeat === room;
    const cooling = (heating ? F.heat.drift : F.heat.cooling) + f.extraction * F.heat.airflowCooling;
    let rate = (F.ambient - env.temperature) * cooling + (heating ? F.heat.rate : 0);
    if (room === d.waterRoom) rate += (F.heat.waterTemperature - env.temperature) * d.waterLevel(api.state) * F.heat.floodCooling;
    env.temperature += rate * dt;
    const previous = env.heatBand;
    env.heatBand = temperatureBand(env.temperature);
    if (env.heatBand !== previous) {
      api.emit({ type: 'heat-band', room, band: env.heatBand, previous });
      api.stimulus?.({ kind: 'heat', room, band: env.heatBand, previous, cue: env.temperature < F.heat.cold ? 'shiver' : 'wipe sweat', harmful: ['dangerous', 'lethal'].includes(env.heatBand) });
      if (['dangerous', 'lethal'].includes(env.heatBand)) api.log('warn', `${room.toUpperCase()} TEMPERATURE ${env.heatBand.toUpperCase()} — SWITCH STEAM OFF TO COOL`);
    }
    const emberBuild = F.smoke.emberBuild + f.emberHeat * (F.smoke.hotEmberBuild - F.smoke.emberBuild);
    const build = room === d.smokeSourceRoom ? smokeFactor * emberBuild : room === d.smokeSpreadRoom ? Math.max(0, f.rooms[d.smokeSourceRoom].smoke - F.smoke.spreadAbove) * F.smoke.spread : 0;
    env.smoke = clamp(env.smoke + (build - (source ? F.smoke.passiveClear : F.smoke.passiveClearCold) - f.extraction * F.smoke.airflowClear) * dt);
    const coughing = env.smoke >= F.smoke.cough, dense = env.smoke >= F.smoke.dense;
    if (coughing !== env.coughing || dense !== env.dense) {
      env.coughing = coughing;
      env.dense = dense;
      api.emit({ type: 'smoke', room, dense, coughing });
      if (coughing) api.stimulus?.({ kind: 'smoke', room, dense, harmful: true });
    }
    const dangerous = dense || ['dangerous', 'lethal'].includes(env.heatBand);
    if (dangerous && !env.dangerous && occupants(api, room).length) {
      env.dangerous = true;
      api.emit({ type: 'facility-danger', room });
    } else if (!dangerous && env.dangerous) {
      env.dangerous = false;
      if (occupants(api, room).length) api.emit({ type: 'facility-defused', room });
    }
  }
}

function updatePrisoners(api, dt) {
  const f = api.state.facility, d = f.definition;
  for (const id of api.state.prisonerOrder) {
    const p = api.prisoner(id), env = f.rooms[p.loc];
    if (!p.alive || p.escaped || !env) continue;
    const lethal = env.heatBand === 'lethal';
    p.heatExposure = Math.max(0, p.heatExposure + (lethal ? dt : -dt * F.heat.exposureRecovery));
    p.smokeExposure = Math.max(0, p.smokeExposure + (env.dense ? dt : -dt * F.smoke.exposureRecovery));
    if (env.coughing) api.stress(id, env.smoke * F.smoke.stress * dt);
    if (['dangerous', 'lethal'].includes(env.heatBand)) api.stress(id, F.smoke.heatStress * dt);
    if (p.loc === d.waterRoom && d.floodActive(api.state) && env.temperature >= F.heat.warmMin && env.temperature <= F.heat.warmMax && f.steamHeat === p.loc && api.live(d.heatCircuit)) {
      api.stress(id, -F.heat.warmthCalm * dt);
      if (!f.facts.warmedTheo) api.stimulus?.({ kind: 'help', pid: id, helpful: true });
      f.facts.warmedTheo = true;
    }
    if (d.protectedPrisoners.includes(id)) {
      const retreat = env.smoke >= F.smoke.retreat || ['dangerous', 'lethal'].includes(env.heatBand);
      if (retreat && !p.retreating && !p.collapsed) {
        p.retreating = true;
        api.stimulus?.({ kind: env.smoke >= F.smoke.retreat ? 'smoke' : 'heat', room: p.loc, pid: id, cue: 'back away', harmful: true });
        api.log('warn', `${p.name.toUpperCase()} RETREATS FROM THE HAZARD — RESTORE AIRFLOW OR CUT HEAT`);
      }
      if ((env.dense && p.smokeExposure >= F.smoke.collapseTime) || (lethal && p.heatExposure >= F.heat.lethalTime)) api.collapse(id, env.dense ? 'smoke' : 'heat');
      const clear = env.smoke < F.smoke.recoverBelow && !['dangerous', 'lethal'].includes(env.heatBand);
      p.recoveryExposure = clear ? p.recoveryExposure + dt : 0;
      if (p.collapsed && p.recoveryExposure >= F.recoveryTime) api.recover(id);
      if (clear) p.retreating = false;
    } else if (p.heatExposure >= F.heat.lethalTime && (p.immobile || p.tether)) {
      api.lose(id, 'heat', true);
      api.emit({ type: 'interference', room: p.loc, strength: 1 });
      api.log('alert', `${p.name.toUpperCase()} — NO VITAL SIGNS AFTER SUSTAINED HEAT`);
    }
    if (d.protectedPrisoners.includes(id) && p.task && !api.live(d.lights[p.loc])) f.facts.darkWork = true;
  }
}

function updateSecrets(api) {
  const f = api.state.facility, d = f.definition;
  for (const secret of d.secrets || []) {
    const visible = secret.kind === 'warm' ? f.rooms[secret.room].temperature >= F.secretWarm : !api.live(d.lights[secret.room]);
    const previous = f.secrets[secret.id];
    f.secrets[secret.id] = visible;
    if (visible && !previous) {
      f.facts[secret.id] = true;
      api.emit({ type: 'secret', id: secret.id, room: secret.room });
      api.note(secret.id, secret.title, secret.text);
    }
  }
}

export function update(api, dt) {
  const f = api.state.facility;
  if (!f) return;
  const d = f.definition;
  f.airflow = airflow(api);
  f.extraction = extraction(api);
  let fire = api.live(d.heatCircuit);
  f.flueExposure = Math.max(0, f.flueExposure + (fire && f.steamHeat !== 'OFF' && f.extraction === 0 ? dt : -dt * F.flueCoolRate));
  if (fire) {
    f.emberHeat = clamp(f.emberHeat + (f.steamHeat !== 'OFF' ? dt : -dt) / F.emberHeatTime);
    f.embers = F.embersTime + f.emberHeat * (F.hotEmbersTime - F.embersTime);
  }
  else f.embers = Math.max(0, f.embers - dt);
  if (api.state.power.tripped && f.embers > 0) f.facts.embersAfterTrip = true;
  for (const id of [d.waterCircuit, d.heatCircuit]) Power.checkBranch(api, id);
  fire = api.live(d.heatCircuit);
  if (f.fireWasLive && !fire && f.embers > 0) api.emit({ type: 'embers', room: d.smokeSourceRoom, remaining: f.embers });
  updateRooms(api, dt, fire, fire || f.embers > 0);
  updatePrisoners(api, dt);
  updateSecrets(api);
  if (f.fanSpeed === 'HIGH' && f.airflow > 0 && d.floodActive(api.state)) f.facts.highFloodVent = true;
  f.fireWasLive = fire;
}
