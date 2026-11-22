// Scenario-driven learning rewards. Predicates are pure; the engine owns timing
// and suppresses every predicate edge that coincides with a loss.
export function init(api, entries = []) {
  api.state.discoveries = { found: [], total: entries.length };
  api.state.discoveryMemory = { matched: {}, deathAt: null, pendingLoss: false };
}

export function observe(api, event) {
  if (event.type === 'lost' && api.state.discoveryMemory) {
    api.state.discoveryMemory.deathAt = api.t;
    api.state.discoveryMemory.pendingLoss = true;
  }
}

export function update(api, entries = []) {
  const state = api.state;
  if (!state.discoveries) init(api, entries);
  const memory = state.discoveryMemory;
  const found = new Set(state.discoveries.found.map(entry => entry.id));
  for (const entry of entries) {
    if (found.has(entry.id)) continue;
    const matches = !!entry.when(state);
    const rising = matches && !memory.matched[entry.id];
    memory.matched[entry.id] = matches;
    // Consume the edge even when suppressed: a death cannot grant a delayed
    // reward on the next frame. A new, independently observed edge can qualify.
    if (!rising || memory.pendingLoss || memory.deathAt === api.t) continue;
    const discovery = { id: entry.id, title: entry.title, text: entry.text, time: api.t };
    state.discoveries.found.push(discovery);
    api.emit({ type: 'discovery', id: entry.id });
  }
  memory.pendingLoss = false;
}
