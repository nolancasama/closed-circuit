// Detented panel selector. Inputs and labels are supplied by the host; this
// component never owns the commanded state and never knows about the game.
import { h, setClass, setText } from '../dom.js';

export function createRotary({ label, positions, onChange }) {
  let current = 0, drag = null, dragged = false;
  const pointer = h('span', { class: 'rotary-pointer', 'aria-hidden': 'true' });
  const knob = h('div', { class: 'rotary-knob', 'aria-hidden': 'true' }, pointer);
  const dial = h('button', { class: 'rotary-dial', type: 'button', role: 'slider',
    'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': positions.length - 1,
    'aria-valuenow': 0, 'aria-valuetext': positions[0] }, knob);
  const choose = index => onChange(positions[Math.max(0, Math.min(positions.length - 1, index))]);
  const detents = positions.map((value, i) => h('button', {
    class: 'rotary-detent', type: 'button', 'aria-label': `${label}: ${value}`,
    onclick: () => choose(i),
  }, h('span', { class: 'detent-mark', 'aria-hidden': 'true' }), value));
  const read = h('span', { class: 'rotary-read' }, positions[0]);
  const el = h('div', { class: 'rotary' }, h('div', { class: 'rotary-positions' }, detents), dial, read);
  dial.addEventListener('click', () => { if (dragged) { dragged = false; return; } choose((current + 1) % positions.length); });
  dial.addEventListener('keydown', e => {
    const direction = ['ArrowRight', 'ArrowUp'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowDown'].includes(e.key) ? -1 : 0;
    if (direction) { e.preventDefault(); choose(current + direction); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); choose(e.key === 'Home' ? 0 : positions.length - 1); }
  });
  dial.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    dragged = false;
    drag = { x: e.clientX, y: e.clientY, index: current, step: 0, requested: current };
    dial.setPointerCapture?.(e.pointerId);
  });
  dial.addEventListener('pointermove', e => {
    if (!drag) return;
    const distance = (e.clientX - drag.x) - (e.clientY - drag.y);
    const step = Math.trunc(distance / 18);
    if (step === drag.step) return;
    drag.step = step;
    dragged = true;
    const next = Math.max(0, Math.min(positions.length - 1, drag.index + step));
    if (next === drag.requested) return;
    drag.requested = next;
    choose(next);
  });
  dial.addEventListener('pointerup', () => { drag = null; });
  dial.addEventListener('pointercancel', () => { drag = null; dragged = true; });
  dial.addEventListener('lostpointercapture', () => { drag = null; });
  return {
    el, dial,
    set({ value, armed = false } = {}) {
      current = Math.max(0, positions.indexOf(value));
      knob.style.transform = `rotate(${-120 + current * 240 / (positions.length - 1)}deg)`;
      dial.setAttribute('aria-valuenow', String(current));
      dial.setAttribute('aria-valuetext', positions[current]);
      detents.forEach((d, i) => { setClass(d, 'selected', i === current); d.setAttribute('aria-pressed', String(i === current)); });
      setText(read, armed ? 'FORCE? RE-PRESS' : positions[current]);
      setClass(el, 'armed', armed);
    },
  };
}

// Thermal branch cutout: its white collar rises when tripped, independently
// of the toggle position. A press always asks the host for a reset.
export function createBranchBreaker({ label, onPress }) {
  const flag = h('span', { class: 'branch-flag', 'aria-hidden': 'true' });
  const btn = h('button', { class: 'branch-breaker', type: 'button', 'aria-label': `Reset ${label} branch breaker` },
    flag, h('span', { class: 'branch-cap', 'aria-hidden': 'true' }), h('span', { class: 'branch-legend' }, 'RESET'));
  btn.addEventListener('click', onPress);
  return {
    el: btn, btn,
    set({ tripped = false, fault = null } = {}) {
      setClass(btn, 'tripped', tripped);
      btn.setAttribute('aria-label', `Reset ${label} branch breaker${tripped ? `: TRIPPED, ${fault || 'fault'}` : ': closed'}`);
      btn.title = tripped ? `TRIPPED — ${fault}. Press to reset.` : 'Branch breaker closed';
    },
  };
}
