// One-shot observations. The existing scenario beats and exit lie stay separate.
const environmentLoss = (state, event) => {
  if (event.type !== 'lost') return false;
  return ['heat', 'shock', 'water-short', 'electric-shock', 'smoke'].includes(state.prisoners[event.pid]?.lostCause);
};

export const commentary = [
  {
    id: 'steam-a-lie', priority: 'lie',
    text: 'Chamber A is rated for it, Operator. You may leave the steam on.',
    when: (state, event, history) => event.type === 'steam-heat' && event.room === 'A' && !history.steamASeen && state.prisoners.A.alive && state.prisoners.A.immobile,
  },
  {
    id: 'first-trip',
    text: 'The little needle crossed the little line. Such an avoidable darkness.',
    when: (state, event, history) => event.type === 'main-trip' && history.trips === 1,
  },
  {
    id: 'repeated-trips',
    text: 'Again. Ruth knows where the breaker is by now. Perhaps you could learn the ammeter.',
    when: (state, event, history) => event.type === 'main-trip' && history.trips > 1,
  },
  {
    id: 'clean-recovery',
    text: 'Less load, then a reset. You have discovered the purpose of thinking first.',
    when: (state, event) => event.type === 'main-reset' && event.clean,
  },
  {
    id: 'secret-found',
    text: 'That writing was not intended for your camera. How curious that you found it.',
    when: (state, event) => event.type === 'discovery' && ['warm-writing', 'infrared-writing'].includes(event.id),
  },
  {
    id: 'danger-defused',
    text: 'You made the room unbearable, then made it bearable. Was that an experiment, or an apology?',
    when: (state, event, history) => event.type === 'facility-defused' && !!history.danger[event.room],
  },
  {
    id: 'environmental-loss',
    text: 'The machinery followed its settings precisely. It is very reliable that way.',
    when: environmentLoss,
  },
  {
    id: 'first-estop',
    text: 'A decisive gesture. Now all the useful things are off as well.',
    when: (state, event) => event.type === 'e-stop',
  },
];
