// Reusable, deterministic stimulus memory, trust, speech and animation cues.
// Scenarios supply character line pools; facilities supply perceivable stimuli.
import { REACTIONS } from '../config.js';

export function createReactionState() {
  return { memory: {}, cooldownUntil: 0, lastLine: null, refused: {} };
}

export function changeTrust(p, amount) {
  p.trust = Math.max(REACTIONS.trustMin, Math.min(REACTIONS.trustMax, p.trust + amount));
}

function cueFor(s) {
  if (s.cue) return s.cue;
  switch (s.kind) {
    case 'light': return s.on ? 'shield eyes' : 'flinch';
    case 'klaxon': return 'cower';
    case 'shock': return 'flinch';
    case 'sparks': return 'back away';
    case 'smoke': return 'cough';
    case 'heat': return s.band === 'cold' ? 'shiver' : 'wipe sweat';
    case 'lost': return 'cower';
    default: return 'look';
  }
}

export function setReactionCue(api, p, kind, stimulus = {}) {
  p.reaction = { kind, until: api.t + REACTIONS.cueTime };
  if (stimulus.room != null) p.reaction.room = stimulus.room;
  if (stimulus.direction != null) p.reaction.direction = stimulus.direction;
}

function audible(api, scenario, p, s) {
  if (s.pid) return p.id === s.pid;
  if (scenario.perceives) return scenario.perceives(api, p, s);
  // Machines, klaxons and losses carry through the facility; local physical
  // effects require the subject to be in that room.
  return !s.room || s.room === p.loc || s.scope === 'all'
    || ['machine', 'klaxon', 'lost'].includes(s.kind);
}

function pickLine(api, scenario, p, kind, stage, stimulus = {}, lastLine = p.reactions.lastLine) {
  const pools = scenario.reactions?.[p.id];
  const bank = pools?.[`${kind}:${stimulus.variant}`] || pools?.[`${kind}:${stimulus.band}`]
    || pools?.[`${kind}:${stimulus.cue}`] || pools?.[kind];
  const pool = Array.isArray(bank) ? bank : bank?.[stage];
  if (!pool?.length) return null;
  const candidates = pool.filter(line => (typeof line === 'string' ? line : line.text) !== lastLine);
  if (!candidates.length) return null;
  const picked = api.rng.pick(candidates);
  return typeof picked === 'string' ? { text: picked } : picked;
}

export function react(api, scenario, stimulus) {
  const s = { ...stimulus };
  api.emit({ ...s, type: 'stimulus', t: api.t });
  for (const id of api.state.prisonerOrder) {
    const p = api.prisoner(id);
    if (!p.alive || p.escaped || p.collapsed || !audible(api, scenario, p, s)) continue;
    const key = s.key || `${s.kind}:${s.room || '*'}`;
    const previous = p.reactions.memory[key];
    const quiet = previous && api.t - previous.lastAt >= REACTIONS.quietGap;
    const count = (quiet ? 0 : previous?.count || 0) + 1;
    const stage = count === 1 ? 'first' : count >= REACTIONS.habituatedAfter ? 'habituated' : 'repeated';
    const memory = { count, stage, lastAt: api.t, lastLine: previous?.lastLine || null,
      habituatedSpoken: quiet ? false : previous?.habituatedSpoken || false };
    p.reactions.memory[key] = memory;
    const harmful = s.harmful || ['shock', 'lost'].includes(s.kind);
    if (harmful) changeTrust(p, -REACTIONS.hurtTrust);
    else if (['light', 'klaxon', 'sparks'].includes(s.kind)) changeTrust(p, -REACTIONS.frightTrust);
    if (s.helpful) changeTrust(p, REACTIONS.helpTrust);
    if (s.stress) api.stress(id, s.stress);
    let cue = cueFor(s);
    let line = null;
    const speaking = api.state.lines.some(l => l.end > api.t && (l.speaker === id || l.speaker === 'you' || l.speaker === 'pa'));
    if (api.t >= p.reactions.cooldownUntil && !speaking && !(stage === 'habituated' && memory.habituatedSpoken)) {
      const picked = pickLine(api, scenario, p, s.kind, stage, s, memory.lastLine);
      if (picked) {
        line = picked.text;
        cue = picked.cue || cue;
        api.say(id, line, { kind: 'reaction' });
        p.reactions.lastLine = line;
        memory.lastLine = line;
        if (stage === 'habituated') memory.habituatedSpoken = true;
        p.reactions.cooldownUntil = api.t + REACTIONS.cooldown;
      }
    }
    setReactionCue(api, p, cue, s);
    api.emit({ type: 'reaction', pid: id, stimulus: s.kind, stage, cue: { ...p.reaction }, line });
  }
}

// Each instruction can cost one extra ask, even if trust stays low. Reassuring
// also clears the refusal immediately. A mood can therefore never block a task.
export function shouldRefuse(p, option) {
  if (!option.task || option.interrupt) return false;
  if (p.reassuredForTask) { p.reassuredForTask = false; return false; }
  if (p.reactions.refused[option.id]) return false;
  if (p.trust >= REACTIONS.lowTrust && p.stress < REACTIONS.distress) return false;
  p.reactions.refused[option.id] = true;
  return true;
}

export function refusalLine(api, scenario, p) {
  const picked = pickLine(api, scenario, p, 'refusal', 'first');
  if (!picked) return 'Give me a moment. Ask me again.';
  p.reactions.lastLine = picked.text;
  return picked.text;
}

export function reassureTrust(p) {
  changeTrust(p, REACTIONS.reassureTrust);
  // Reassurance is explicit permission for the next task, including when one
  // reassurance cannot yet repair severely damaged trust.
  p.reassuredForTask = true;
}
