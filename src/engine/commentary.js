// Rare contextual PA observations. Event capture is independent of the
// presentation event queue, so drainEvents() cannot eat a pending observation.
import { COMMENTARY } from '../config.js';

export function init(api) {
  api.state.commentary = {
    used: [], pending: [], lastAt: null, bootPending: false,
    history: { trips: 0, danger: {}, steamASeen: false },
  };
}

export function observe(api, event, lines = []) {
  const voice = api.state.commentary;
  if (!voice) return;
  const history = voice.history;
  if (event.type === 'main-trip') history.trips++;
  if (event.type === 'facility-danger') history.danger[event.room] = true;
  if (event.type === 'heat-band' && ['dangerous', 'lethal'].includes(event.band)) {
    const occupied = api.state.prisonerOrder.some(id => {
      const p = api.state.prisoners[id];
      return p.alive && !p.escaped && p.loc === event.room;
    });
    if (occupied) history.danger[event.room] = true;
  }
  for (const line of lines) {
    if (voice.used.includes(line.id) || voice.pending.some(entry => entry.id === line.id)) continue;
    if (line.when(api.state, event, history)) voice.pending.push({ id: line.id, time: api.t });
  }
  if (event.type === 'steam-heat' && event.room === 'A') history.steamASeen = true;
  if (event.type === 'facility-defused') delete history.danger[event.room];
}

export function update(api, lines = []) {
  const state = api.state, voice = state.commentary;
  if (!voice || !voice.pending.length || state.over) return;
  if (voice.lastAt !== null && api.t - voice.lastAt < COMMENTARY.cooldown) return;
  if (voice.bootPending) return;
  if (state.scriptedUntil > 0 && api.t < state.scriptedUntil + COMMENTARY.scriptedGap) return;
  // Include queued replies: a contextual line must never jump ahead of speech
  // that belongs to a scripted beat or a player's instruction.
  if (state.lines.some(line => line.end > api.t)) return;
  const pending = voice.pending.find(entry => lines.find(line => line.id === entry.id)?.priority === 'lie') || voice.pending[0];
  voice.pending.splice(voice.pending.indexOf(pending), 1);
  const definition = lines.find(line => line.id === pending.id);
  if (!definition) return;
  voice.used.push(definition.id);
  voice.lastAt = api.t;
  api.say('pa', definition.text, { kind: 'commentary' });
  api.sfx('pa');
  api.emit({ type: 'interference', room: '*', strength: COMMENTARY.interference });
  api.emit({ type: 'commentary', id: definition.id });
}
