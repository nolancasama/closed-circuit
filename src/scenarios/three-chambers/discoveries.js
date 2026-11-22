// Learning milestones are facility facts, rather than awards for loss or harm.
const fact = name => state => !!state.facility?.facts[name];
const livingFact = (name, pid) => state => !!state.prisoners[pid]?.alive && fact(name)(state);

export const discoveries = [
  {
    id: 'cold-boiler', title: 'A cold boiler gives no steam',
    text: 'The heat selector routes steam. The incinerator must have power to make it.',
    when: fact('steamWithoutFire'),
  },
  {
    id: 'fan-load', title: 'Air has a price',
    text: 'Each higher fan setting draws more current. Airflow and spare amps share the same board.',
    when: fact('fanSpeedChanged'),
  },
  {
    id: 'backdraft', title: 'The flue breathes into Room C',
    text: 'Without enough airflow, the incinerator backs smoke into Room C and the corridor.',
    when: fact('backdraft'),
  },
  {
    id: 'embers', title: 'Power off is not fire out',
    text: 'A tripped main stops the fan. The incinerator embers keep making smoke.',
    when: fact('embersAfterTrip'),
  },
  {
    id: 'water-short', title: 'Water reaches the wiring',
    text: 'Floodwater at the lights faults the branch. Leave LIGHTS B off until the fixtures are dry.',
    when: livingFact('waterShort', 'B'),
  },
  {
    id: 'emergency-stop', title: 'Everything down, main still closed',
    text: 'E-STOP drops the Operator switches. The main and Ruth\'s isolators keep their positions.',
    when: fact('emergencyStop'),
  },
  {
    id: 'clean-recovery', title: 'A considered reset',
    text: 'Shed the excess load before Ruth resets the main, and the power stays on.',
    when: fact('cleanRecovery'),
  },
  {
    id: 'dark-work', title: 'Hands need light too',
    text: 'Ruth can work in darkness, but finding the switchboard by touch takes longer.',
    when: livingFact('darkWork', 'C'),
  },
  {
    id: 'high-vent', title: 'Give the water room to fall',
    text: 'With the damper open, HIGH fan vents pressure and helps the drain empty Chamber B faster.',
    when: fact('highFloodVent'),
  },
  {
    id: 'warmth-for-theo', title: 'A little warmth',
    text: 'Moderate steam heat takes the chill out of the flood. Theo can breathe a little easier.',
    when: livingFact('warmedTheo', 'B'),
  },
  {
    id: 'warm-writing', title: 'The wall remembers heat',
    text: 'Warm paint in Chamber A reveals writing that cold paint conceals.',
    when: livingFact('warmWriting', 'A'),
  },
  {
    id: 'infrared-writing', title: 'Words in the dark',
    text: 'Chamber B has a message visible to the infrared camera only when its lights are off.',
    when: fact('irWriting'),
  },
];
