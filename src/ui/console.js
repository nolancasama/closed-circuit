// Facility console: power, chamber systems, doors, overrides and the
// restraint keypad drawer. Everything acts through dispatch().
import { h, setText, setClass, symbolSvg, symbolLabel } from './dom.js';
import { actionButton } from './hold.js';

const MSG_MS = 4200;

export function createConsole({ powerEl, systemsEl, doorsEl, overridesEl, keypadEl, dispatch, audio, onKeypad }) {
  let game = null;
  let power = null;
  let rows = { systems: new Map(), doors: new Map(), overrides: new Map() };
  let doorRows = new Map();
  let keypad = null;
  let sectionKeys = {};

  function setGame(g) {
    game = g;
    rows = { systems: new Map(), doors: new Map(), overrides: new Map() };
    doorRows = new Map();
    sectionKeys = {};
    buildPower();
    systemsEl.replaceChildren(h('h3', {}, 'CHAMBER SYSTEMS'));
    doorsEl.replaceChildren(h('h3', {}, 'DOORS'));
    overridesEl.replaceChildren(h('h3', {}, 'EMERGENCY OVERRIDES'));
    for (const id of Object.keys(game.state.doors)) {
      const r = makeRow({ id, kind: 'door' });
      doorRows.set(id, r);
      doorsEl.append(r.row);
    }
    closeKeypad();
  }

  function show(r, res) {
    if (!res || !res.msg) return;
    r.msgText = res.msg;
    r.msgOk = !!res.ok;
    r.msgUntil = performance.now() + MSG_MS;
    r.row.classList.remove('flash');
    void r.row.offsetWidth;
    r.row.classList.add('flash');
  }

  // ---------- power ----------
  function buildPower() {
    const st = game.state;
    const val = h('span', { class: 'val' });
    const bar = h('div', { class: 'loadbar', 'aria-hidden': 'true' }, Array.from({ length: st.power.capacity }, () => h('span')));
    const main = h('div', { class: 'mainline' });
    const msg = h('div', { class: 'msg' });
    const circs = new Map();
    const list = [];
    for (const id of st.power.order) {
      const c = st.power.circuits[id];
      const sw = h('button', { class: 'sw', type: 'button', 'aria-label': `${c.label} switch` });
      const row = h('div', { class: 'circ' }, h('span', { class: 'nm', title: c.label }, c.short), h('span', { class: 'amps' }, `${c.amps} A`), sw);
      sw.addEventListener('click', () => {
        const cur = game.state.power.circuits[id];
        const res = dispatch({ type: 'power', circuit: id, on: !cur.on });
        show(power, res);
      });
      circs.set(id, { row, sw });
      list.push(row);
    }
    powerEl.replaceChildren(h('h3', {}, 'POWER', val), bar, main, ...list, msg);
    power = { val, bar, main, circs, msg, row: powerEl };
  }

  function updatePower() {
    const pw = game.state.power;
    const load = game.api.load();
    setText(power.val, `${load} / ${pw.capacity} A`);
    setClass(power.bar, 'trip', pw.tripped);
    [...power.bar.children].forEach((seg, i) => {
      setClass(seg, 'on', i < Math.min(load, pw.capacity));
      setClass(seg, 'over', load > pw.capacity && i >= pw.capacity - (load - pw.capacity));
    });
    setText(power.main, pw.tripped ? 'MAIN BREAKER: TRIPPED — Ruth must reset it' : 'MAIN BREAKER: CLOSED');
    setClass(power.main, 'tone-alert', pw.tripped);
    setClass(power.main, 'tone-dim', !pw.tripped);
    for (const [id, r] of power.circs) {
      const c = pw.circuits[id];
      const armed = pw.armed && pw.armed.id === id && game.state.t <= pw.armed.until;
      const live = c.on && !c.isolated && !pw.tripped;
      setText(r.sw, c.isolated ? 'ISOLATED' : armed ? 'FORCE ON?' : c.on ? (live ? 'ON' : 'ON · DEAD') : 'OFF');
      setClass(r.sw, 'iso', c.isolated);
      setClass(r.sw, 'on', live);
      setClass(r.sw, 'dead', c.on && !c.isolated && pw.tripped);
      setClass(r.sw, 'armed', !!armed);
      r.sw.setAttribute('aria-pressed', c.on ? 'true' : 'false');
    }
    paintMsg(power);
  }

  // ---------- generic rows ----------
  function makeRow(c) {
    const lbl = h('div', { class: 'lbl' });
    const head = h('div', { class: 'row-head' }, lbl);
    const stt = h('div', { class: 'stt' });
    const det = h('div', { class: 'det' });
    const msg = h('div', { class: 'msg' });
    const row = h('div', { class: 'row', dataset: { control: c.id } }, head, stt, det, msg);
    const r = { row, lbl, stt, det, msg, btn: null, view: null, id: c.id, kind: c.kind };
    if (c.kind === 'door') {
      r.btn = h('button', { class: 'act', type: 'button' });
      r.btn.addEventListener('click', () => {
        const open = !game.state.doors[c.id].open;
        show(r, dispatch({ type: 'door', door: c.id, open }));
      });
      head.append(r.btn);
    } else if (c.kind === 'keypad') {
      r.btn = h('button', { class: 'act', type: 'button' });
      r.btn.addEventListener('click', () => { audio.ui('click'); openKeypad(c.id); });
      head.append(r.btn);
    } else if (c.kind !== 'status') {
      r.btn = h('button', { class: 'act', type: 'button' });
      if (c.kind === 'hold') {
        actionButton(r.btn, {
          isHold: () => !!r.view?.ready,
          seconds: () => r.view?.hold || 1.2,
          onFire: () => show(r, dispatch({ type: 'control', id: c.id })),
        });
      } else {
        r.btn.addEventListener('click', () => show(r, dispatch({ type: 'control', id: c.id })));
      }
      head.append(r.btn);
    }
    return r;
  }

  function paintMsg(r) {
    const live = r.msgUntil && performance.now() < r.msgUntil;
    setText(r.msg, live ? r.msgText : '');
    setClass(r.msg, 'bad', live && !r.msgOk);
    setClass(r.msg, 'good', live && r.msgOk);
  }

  function paintRow(r, v, hold = false) {
    r.view = v;
    setText(r.lbl, v.label);
    setText(r.stt, v.status || '');
    for (const t of ['ok', 'warn', 'alert', 'dim', 'info']) setClass(r.stt, `tone-${t}`, v.tone === t);
    setText(r.det, v.detail || '');
    r.det.hidden = !v.detail;
    if (r.btn) {
      const label = hold && v.ready ? `HOLD · ${v.action}` : v.action || '';
      setText(r.btn, label);
      setClass(r.btn, 'ready', !!v.ready);
      setClass(r.btn, 'hold', hold && !!v.ready);
      setClass(r.btn, 'danger', r.id === 'leave' || r.id === 'drain' || r.id.startsWith('ov-'));
    }
    paintMsg(r);
  }

  function syncSection(section, el, controls) {
    const map = rows[section];
    const list = controls.filter(c => c.section === section);
    const key = list.map(c => c.id).join(',');
    if (sectionKeys[section] !== key) {
      sectionKeys[section] = key;
      for (const [id, r] of map) if (!list.some(c => c.id === id)) { r.row.remove(); map.delete(id); }
      for (const c of list) {
        const fresh = !map.has(c.id);
        if (fresh) { const r = makeRow(c); map.set(c.id, r); }
        el.append(map.get(c.id).row);
        // A newly unlocked override is often the only way forward; never leave it below the fold.
        if (fresh && section === 'overrides') {
          const row = map.get(c.id).row;
          row.classList.add('fresh');
          row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }
    for (const c of list) paintRow(map.get(c.id), c, c.kind === 'hold');
    return list.length;
  }

  function update() {
    if (!game) return;
    updatePower();
    const controls = game.controls();
    syncSection('systems', systemsEl, controls);
    for (const [id, r] of doorRows) {
      const v = game.scenario.doorView(game.api, id);
      paintRow(r, { ...v, action: v.canToggle ? v.action : '' });
      if (r.btn) r.btn.hidden = !v.canToggle;
    }
    syncSection('doors', doorsEl, controls);
    const n = syncSection('overrides', overridesEl, controls);
    let empty = overridesEl.querySelector('.empty');
    if (!n && !empty) overridesEl.append(h('div', { class: 'empty' }, 'None available. Overrides unlock only if a prisoner can no longer act.'));
    if (n && empty) empty.remove();
    if (keypad && !keypadEl.hidden) updateKeypad();
  }

  // ---------- keypad drawer ----------
  function openKeypad(id) {
    const v = game.controls().find(c => c.id === id);
    if (!v) return;
    const slots = h('div', { class: 'slots', 'aria-label': 'Entered sequence' });
    const attempts = h('div', { class: 'attempts' });
    const msg = h('div', { class: 'msg keymsg' });
    const press = payload => {
      const res = dispatch({ type: 'control', id, payload });
      if (payload.action === 'submit' || !res.ok) {
        keypad.r.msgText = res.msg;
        keypad.r.msgOk = res.ok;
        keypad.r.msgUntil = performance.now() + MSG_MS;
      }
      return res;
    };
    const keys = h('div', { class: 'keys' }, v.symbols.map(sym => h('button', {
      class: 'key', type: 'button', 'aria-label': symbolLabel(sym), onclick: () => press({ action: 'key', symbol: sym }),
    }, symbolSvg(sym), h('small', {}, symbolLabel(sym)))));
    const submit = h('button', { class: 'submit', type: 'button', onclick: () => press({ action: 'submit' }) }, 'SUBMIT');
    const row = h('div', { class: 'key-row' },
      h('button', { type: 'button', onclick: () => press({ action: 'back' }), 'aria-label': 'Delete last symbol' }, '⌫'),
      h('button', { type: 'button', onclick: () => press({ action: 'clear' }) }, 'CLEAR'),
      submit);
    keypadEl.replaceChildren(
      h('h2', { id: 'keypadTitle' }, 'RESTRAINT RELEASE — A', h('button', { class: 'xbtn', type: 'button', onclick: closeKeypad }, 'CLOSE')),
      h('div', { class: 'warnline' }, 'Enter the four symbols in order. A wrong sequence punishes the prisoner. The third failure is final.'),
      slots, attempts, keys, row, msg,
    );
    keypad = { id, slots, attempts, submit, r: { msg, msgText: '', msgOk: true, msgUntil: 0 }, sig: '' };
    keypadEl.hidden = false;
    onKeypad?.(true);
    updateKeypad();
  }

  function closeKeypad() {
    keypadEl.hidden = true;
    keypad = null;
    onKeypad?.(false);
  }

  function updateKeypad() {
    const v = game.controls().find(c => c.id === keypad.id);
    if (!v || !v.open) {
      setText(keypad.attempts, v ? v.status : '');
      keypad.submit.disabled = true;
    }
    if (v) {
      const sig = v.entry.join(',') + '|' + v.attempts;
      if (sig !== keypad.sig) {
        keypad.sig = sig;
        keypad.slots.replaceChildren(...Array.from({ length: v.codeLength }, (_, i) => h('div', { class: 'slot' }, v.entry[i] ? symbolSvg(v.entry[i]) : null)));
        keypad.attempts.innerHTML = `ATTEMPTS LEFT: <b>${v.attempts}</b> / ${v.maxAttempts}${v.attempts === 1 ? ' — NEXT FAILURE IS FINAL' : ''}`;
        setClass(keypad.attempts, 'low', v.attempts === 1);
      }
      if (v.open) keypad.submit.disabled = v.entry.length < v.codeLength;
    }
    paintMsg(keypad.r);
  }

  return {
    setGame,
    update,
    openKeypad,
    closeKeypad,
    get keypadOpen() { return !!keypad && !keypadEl.hidden; },
  };
}
