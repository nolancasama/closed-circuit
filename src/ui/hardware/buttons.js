// Mechanical pushbuttons: spring-return push, hold-to-confirm mushroom heads,
// a flip-up safety guard and a key-switch style access button.
import { h, setText, setClass } from '../dom.js';
import { actionButton } from '../hold.js';

// Round pushbutton. colour: red | amber | black | green.
// hold: { isHold(), seconds() } makes it hold-to-confirm while isHold() is true.
export function createPushbutton({ label, color = 'black', size = 'md', hold = null, onFire, caption = '' }) {
  const cap = h('span', { class: 'pb-cap', 'aria-hidden': 'true' }, h('span', { class: 'pb-txt' }, caption));
  const btn = h('button', { class: `pb pb-${color} pb-${size}`, type: 'button', 'aria-label': label }, h('span', { class: 'pb-ring', 'aria-hidden': 'true' }), cap);
  // Brief "pressed" pose even for quick clicks, so the spring travel reads.
  const press = () => { btn.classList.remove('pressed'); void btn.offsetWidth; btn.classList.add('pressed'); };
  btn.addEventListener('pointerdown', press);
  btn.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') press(); });
  if (hold) actionButton(btn, { isHold: hold.isHold, seconds: hold.seconds, onFire });
  else btn.addEventListener('click', () => onFire());
  let prevCap = caption, prevReady = null;
  return {
    el: btn,
    btn,
    set({ ready = false, caption: c = prevCap, holdable = false } = {}) {
      if (c !== prevCap) { setText(cap.firstChild, c); prevCap = c; }
      if (ready !== prevReady) { setClass(btn, 'ready', ready); prevReady = ready; }
      setClass(btn, 'holdable', holdable);
    },
  };
}

// Hinged safety guard over a control. The first press lifts the guard; the
// control underneath is only reachable while it is up. Closes itself after
// `idle` seconds without use, or when close() is called.
export function createGuard({ label, inner, idle = 6, onOpen }) {
  const lid = h('button', { class: 'guard-lid', type: 'button', 'aria-expanded': 'false', 'aria-label': `Lift guard: ${label}` },
    h('span', { class: 'guard-legend' }, 'LIFT GUARD'));
  const el = h('div', { class: 'guard' }, h('div', { class: 'guard-seat' }, inner.el), lid);
  let open = false, timer = 0;
  const arm = () => { clearTimeout(timer); timer = setTimeout(() => { if (!inner.el.classList.contains('holding')) setOpen(false); else arm(); }, idle * 1000); };
  function setOpen(v) {
    if (open === v) return;
    open = v;
    setClass(el, 'open', v);
    lid.setAttribute('aria-expanded', v ? 'true' : 'false');
    setText(lid.firstChild, v ? '' : 'LIFT GUARD');
    inner.btn.tabIndex = v ? 0 : -1;
    inner.btn.setAttribute('aria-hidden', v ? 'false' : 'true');
    if (v) { arm(); onOpen?.(); } else clearTimeout(timer);
  }
  lid.addEventListener('click', () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    inner.btn.focus({ preventScroll: true });
  });
  inner.btn.addEventListener('pointerdown', arm);
  inner.btn.addEventListener('keydown', arm);
  setOpen(false);
  return { el, lid, get isOpen() { return open; }, close: () => setOpen(false), lift: () => setOpen(true) };
}

// Key-switch style access button (opens a sub-panel such as a keypad).
export function createKeySwitch({ label, caption = 'ACCESS', onPress }) {
  const btn = h('button', { class: 'keysw act', type: 'button', 'aria-label': label },
    h('span', { class: 'keysw-barrel', 'aria-hidden': 'true' }, h('span', { class: 'keysw-slot' })),
    h('span', { class: 'keysw-txt' }, caption));
  btn.addEventListener('click', () => onPress());
  return { el: btn, btn };
}
