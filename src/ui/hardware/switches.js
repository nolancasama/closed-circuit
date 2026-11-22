// Panel switchgear: indicator lamps and two-position toggles/rockers.
// Pure presentation — callers pass state in and receive presses out.
import { h, setText, setClass } from '../dom.js';

const LAMP_STATES = ['on', 'blink', 'flash'];

// Indicator lamp. colour: green | amber | red | white. state: off | on | blink.
export function createLamp(color = 'green', legend = '') {
  const glass = h('span', { class: `lamp lamp-${color}`, 'aria-hidden': 'true' });
  const el = legend ? h('span', { class: 'lamp-wrap' }, glass, h('span', { class: 'lamp-legend' }, legend)) : glass;
  let st = 'off', col = color;
  return {
    el,
    glass,
    set(state = 'off', color2 = col) {
      if (color2 !== col) { glass.classList.replace(`lamp-${col}`, `lamp-${color2}`); col = color2; }
      if (state === st) return;
      st = state;
      for (const s of LAMP_STATES) setClass(glass, s, s === state);
    },
  };
}

// Two-position switch. variant: 'bat' (toggle) | 'rocker'. legends: [up, down].
// set({ on, armed, tagged, tag, disabled }) — on = handle up.
export function createToggle({ label, variant = 'bat', legends = ['ON', 'OFF'], onPress }) {
  const handle = h('span', { class: 'tog-handle', 'aria-hidden': 'true' });
  const btn = h('button', { class: `tog tog-${variant}`, type: 'button', role: 'switch', 'aria-checked': 'false', 'aria-label': label },
    h('span', { class: 'tog-leg up' }, legends[0]),
    h('span', { class: 'tog-well', 'aria-hidden': 'true' }, h('span', { class: 'tog-nut' }), handle),
    h('span', { class: 'tog-leg down' }, legends[1]));
  const tag = h('span', { class: 'lockout', hidden: true, 'aria-hidden': 'true' });
  const el = h('span', { class: 'tog-mount' }, btn, tag);
  btn.addEventListener('click', () => onPress?.());
  let prev = {};
  return {
    el,
    btn,
    set({ on = false, armed = false, tag: tagText = '', disabled = false } = {}) {
      if (prev.on !== on) { setClass(btn, 'is-on', on); btn.setAttribute('aria-checked', on ? 'true' : 'false'); }
      if (prev.armed !== armed) setClass(btn, 'armed', armed);
      if (prev.tag !== tagText) { tag.hidden = !tagText; setText(tag, tagText); setClass(btn, 'tagged', !!tagText); }
      if (prev.disabled !== disabled) setClass(btn, 'inert', disabled);
      prev = { on, armed, tag: tagText, disabled };
    },
  };
}
