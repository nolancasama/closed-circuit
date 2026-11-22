// Facility console, built as a physical control desk: instruments, the power
// switch bank, chamber systems, door controls, the emergency-override bay and
// the restraint keypad drawer. Hardware pieces live in ./hardware/ and know
// nothing about the game; this file maps game state onto them every frame.
// Everything acts through dispatch() — the board never changes state itself.
//
// Test hooks: every control container carries data-control="<control id>"
// (doors use the door id); the restraint ACCESS key keeps class "act".
import { FLOOD, POWER, FACILITY } from '../config.js';
import { h, setText, setClass, symbolSvg, symbolLabel } from './dom.js';
import { createGauge } from './hardware/gauge.js';
import { createLamp, createToggle } from './hardware/switches.js';
import { createPushbutton, createGuard, createKeySwitch } from './hardware/buttons.js';
import { createRotary, createBranchBreaker } from './hardware/rotary.js';

const MSG_MS = 4200;
const TONE_LAMP = { ok: ['green', 'on'], warn: ['amber', 'on'], alert: ['red', 'blink'], info: ['white', 'on'], dim: ['green', 'off'] };

// Lamp clusters for status-only controls. Each entry: [legend, colour, (view) => state].
const STATUS_LAMPS = {
  aux: [
    ['UNSTABLE', 'red', v => (v.tone === 'alert' ? 'blink' : 'off')],
    ['OVERRIDE', 'amber', v => (v.tone === 'warn' ? 'on' : 'off')],
    ['STABLE', 'green', v => (v.tone === 'ok' ? 'on' : 'off')],
  ],
  vent: [
    ['DAMPER OPEN', 'green', v => (/DAMPER OPEN/.test(v.status) ? 'on' : 'off')],
    ['FAN POWER', 'green', v => (/FAN RUNNING/.test(v.status) ? 'on' : 'off')],
  ],
};

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function createConsole({ rootEl, instrumentsEl, powerEl, systemsEl, doorsEl, overridesEl, keypadEl, dispatch, audio, onKeypad }) {
  let game = null;
  let inst = null;
  let power = null;
  let mods = { systems: new Map(), doors: new Map(), overrides: new Map() };
  let doorMods = new Map();
  let exitPanel = null;
  let doorExtra = null;
  let bay = null;
  let keypad = null;
  let sectionKeys = {};
  let wasTripped = false;
  let environment = null, emergency = null, systemGrid = null;
  let requestedFan = null;

  const plate = (text, cls = '') => h('div', { class: `plate ${cls}`.trim() }, text);
  const header = (title, ...extra) => h('h3', {}, h('span', { class: 'engrave' }, title), ...extra);

  function setGame(g) {
    game = g;
    mods = { systems: new Map(), doors: new Map(), overrides: new Map() };
    doorMods = new Map();
    sectionKeys = {};
    requestedFan = null;
    wasTripped = g.state.power.tripped;
    buildInstruments();
    buildPower();
    systemGrid = h('div', { class: 'mod-grid' });
    systemsEl.replaceChildren(header('CHAMBER SYSTEMS'), h('div', { class: 'system-gauges' }, inst.aux.el, inst.water.el), systemGrid);
    buildDoors();
    buildBay();
    closeKeypad();
  }

  // Message feedback under a control; refusals also flash the module red.
  function show(m, res) {
    if (!res || !res.msg) return;
    // A forced switch-on "succeeds" but trips the main: present it as a fault.
    const good = !!res.ok && res.code !== 'tripped';
    m.msgText = res.msg;
    m.msgOk = good;
    m.msgUntil = performance.now() + MSG_MS;
    const cls = good ? 'flash' : 'deny';
    m.el.classList.remove('flash', 'deny');
    void m.el.offsetWidth;
    m.el.classList.add(cls);
  }

  function paintMsg(m) {
    const live = m.msgUntil && performance.now() < m.msgUntil;
    setText(m.msg, live ? m.msgText : '');
    m.msg.hidden = !live;
    setClass(m.msg, 'bad', live && !m.msgOk);
    setClass(m.msg, 'good', live && m.msgOk);
  }

  // ---------- instruments ----------
  function buildInstruments() {
    const cap = game.state.power.capacity;
    const amm = createGauge({
      title: 'MAIN LOAD', unit: 'AMPS', min: 0, max: cap * 1.5, major: 5, minor: 1,
      zones: [{ from: cap * 0.8, to: cap, tone: 'amber' }, { from: cap, to: cap * 1.5, tone: 'red' }],
    });
    const aux = createGauge({
      title: 'AUX PRESSURE · B', unit: 'BAR', min: 0, max: 10, major: 5, minor: 1,
      zones: [{ from: 4, to: 6, tone: 'green' }, { from: 6.4, to: 7.8, tone: 'amber' }, { from: 8, to: 10, tone: 'red' }],
    });
    const water = createGauge({
      title: 'CHAMBER B LEVEL', unit: '%', min: 0, max: 100, major: 25, minor: 5,
      zones: [{ from: 60, to: 80, tone: 'amber' }, { from: 80, to: 100, tone: 'red' }],
    });
    for (const g of [amm, aux, water]) g.el.classList.add('housing');
    amm.el.dataset.control = 'gauge-load';
    aux.el.dataset.control = 'gauge-aux';
    water.el.dataset.control = 'gauge-water';
    inst = { amm, aux, water };
    buildEnvironment();
  }

  function updateInstruments() {
    const st = game.state, pw = st.power, s = game.api.s;
    const load = game.api.load();
    const armed = pw.armed && st.t <= pw.armed.until ? pw.circuits[pw.armed.id] : null;
    const projected = armed?.id === 'vent' && requestedFan
      ? load - (pw.circuits.vent.on && !pw.circuits.vent.branchTripped ? pw.circuits.vent.amps : 0) + POWER.fanAmps[requestedFan]
      : armed ? load + armed.amps : load;
    // No current flows through a tripped main; the drag pointer still shows what is switched in.
    inst.amm.set(pw.tripped ? 0 : load, {
      pointer: armed ? projected : pw.tripped ? load : null,
      readout: pw.tripped ? `TRIPPED · ${load} A SWITCHED` : armed ? `${load} A → ${projected} A?` : `${load} / ${pw.capacity} A`,
      tone: pw.tripped || armed ? 'alert' : load >= pw.capacity * 0.8 ? 'warn' : '',
    });
    const t = performance.now() / 1000;
    const waver = reducedMotion() ? 0 : Math.sin(t * 7.1) * 0.35 + Math.sin(t * 2.3) * 0.45;
    const auxVal = s.aux === 'stable' ? 5 : s.aux === 'forced' ? 7.1 : 8.9 + waver;
    inst.aux.set(auxVal, {
      readout: s.aux === 'stable' ? 'STABLE' : s.aux === 'forced' ? 'FORCED · OVERRIDE' : 'UNSTABLE',
      tone: s.aux === 'stable' ? 'ok' : s.aux === 'forced' ? 'warn' : 'alert',
    });
    const f = s.flood;
    const pctLevel = Math.max(0, Math.min(100, (f.level / FLOOD.lethal) * 100));
    const drain = game.controls().find(c => c.id === 'drain');
    // Filling status reads "FILLING 42% · 0:59"; keep only the time left.
    const tail = f.phase === 'filling' ? (drain?.status.split(' · ')[1] || '') : f.phase === 'draining' ? (f.stall ? 'STALLED' : 'DRAINING') : f.phase === 'done' ? 'DRAINED' : '';
    inst.water.set(pctLevel, {
      readout: f.phase === 'idle' ? 'DRY' : `${Math.round(pctLevel)}%${tail ? ` · ${tail}` : ''}`,
      tone: f.phase === 'filling' ? 'alert' : f.phase === 'draining' ? 'warn' : f.phase === 'done' ? 'ok' : '',
    });
  }

  // ---------- environmental panel ----------
  function buildEnvironment() {
    const msg = h('div', { class: 'msg', hidden: true });
    environment = { el: instrumentsEl, msg, thermometers: new Map() };
    const select = (id, label, positions, field) => {
      const rotary = createRotary({ label, positions, onChange: value => {
        audio.ui('rotary');
        if (id === 'fan-speed') requestedFan = value;
        show(environment, dispatch({ type: 'control', id, payload: { [field]: value } }));
        // A second input can arrive before the next frame. Refresh from accepted
        // state now so relative detents start there, including after refusals.
        updateEnvironment();
      } });
      const lamp = createLamp('green');
      const el = h('div', { class: 'selector', dataset: { control: id } }, h('div', { class: 'selector-title' }, plate(label), lamp.el), rotary.el);
      return { rotary, lamp, el };
    };
    environment.fan = select('fan-speed', 'VENT FAN', ['OFF', 'LOW', 'MED', 'HIGH'], 'speed');
    environment.steam = select('steam-heat', 'STEAM HEAT', ['OFF', 'A', 'B', 'C'], 'room');
    const thermos = h('div', { class: 'thermometers' });
    for (const room of ['A', 'B', 'C']) {
      const g = createGauge({ title: `ROOM ${room}`, unit: '°C', min: 0, max: 100, major: 25, minor: 5,
        zones: [{ from: FACILITY.heat.uneasy, to: FACILITY.heat.dangerous, tone: 'amber' }, { from: FACILITY.heat.dangerous, to: 100, tone: 'red' }] });
      g.el.classList.add('housing', 'thermometer');
      g.el.dataset.control = `temperature-${room}`;
      environment.thermometers.set(room, g);
      thermos.append(g.el);
    }
    environment.flue = createLamp('red', 'FLUE');
    environment.damper = createLamp('green', 'DAMPER');
    const warning = h('div', { class: 'environment-status' }, environment.flue.el, environment.damper.el);
    instrumentsEl.replaceChildren(header('ENVIRONMENT'), h('div', { class: 'selector-bank' }, environment.fan.el, environment.steam.el), thermos, warning, msg);
  }

  function updateEnvironment() {
    const st = game.state, f = st.facility;
    environment.fan.rotary.set({ value: f.fanSpeed, armed: !!(st.power.armed?.id === 'vent' && st.t <= st.power.armed.until) });
    environment.steam.rotary.set({ value: f.steamHeat });
    environment.fan.lamp.set(game.api.live('vent') ? 'on' : 'off');
    environment.steam.lamp.set(f.steamHeat !== 'OFF' && game.api.live('incinerator') ? 'on' : 'off');
    environment.flue.set(f.flueWarning ? 'blink' : 'off');
    environment.damper.set(st.s.flood.damper ? 'on' : 'off');
    for (const [room, g] of environment.thermometers) {
      const r = f.rooms[room];
      const danger = ['dangerous', 'lethal'].includes(r.heatBand);
      g.set(r.temperature, { readout: `${r.temperature.toFixed(0)} °C`, tone: danger ? 'alert' : r.heatBand === 'uneasy' ? 'warn' : '' });
      g.el.title = `Room ${room}: ${r.temperature.toFixed(1)} °C — ${r.heatBand}`;
    }
    paintMsg(environment);
    paintMsg(emergency);
  }

  // ---------- power switch bank ----------
  function buildPower() {
    const st = game.state;
    const mainLamp = createLamp('red');
    const mainText = h('span', { class: 'main-text' });
    const main = h('span', { class: 'mainline' }, plate('MAIN BREAKER', 'small'), mainLamp.el, mainText);
    const circs = new Map();
    const bank = h('div', { class: 'bank' });
    st.power.order.forEach((id, i) => {
      if (id === 'vent') return; // Its commanded position lives on the fan rotary.
      const c = st.power.circuits[id];
      const tog = createToggle({
        label: `${c.label} switch`,
        onPress: () => {
          audio.ui('switch');
          const cur = game.state.power.circuits[id];
          show(power, dispatch({ type: 'power', circuit: id, on: !cur.on }));
        },
      });
      const lamp = createLamp('green');
      const reset = createBranchBreaker({ label: c.label, onPress: () => {
        audio.ui('breaker');
        show(power, dispatch({ type: 'control', id: 'branch-reset', payload: { circuit: id } }));
      } });
      const amps = h('div', { class: 'cct-amps' }, `${c.amps} A`);
      const name = h('div', { class: 'cct-name', title: c.label }, c.short);
      const cct = h('div', { class: 'cct', dataset: { control: `power-${id}` } },
        h('div', { class: 'cct-top' }, h('span', { class: 'cct-no' }, `CCT ${String(i + 1).padStart(2, '0')}`), lamp.el),
        tog.el, name, amps, reset.el);
      circs.set(id, { tog, lamp, name, cct, amps, reset, short: c.short });
      bank.append(cct);
    });
    const msg = h('div', { class: 'msg', hidden: true });
    powerEl.replaceChildren(header('POWER DISTRIBUTION'), h('div', { class: 'power-instrument' }, inst.amm.el, main), bank, msg);
    power = { el: powerEl, mainLamp, mainText, main, circs, msg };
  }

  function updatePower() {
    const pw = game.state.power;
    if (pw.tripped && !wasTripped && !reducedMotion()) {
      rootEl.classList.remove('flicker');
      void rootEl.offsetWidth;
      rootEl.classList.add('flicker');
    }
    wasTripped = pw.tripped;
    power.mainLamp.set(pw.tripped ? 'blink' : 'on', pw.tripped ? 'red' : 'green');
    setText(power.mainText, pw.tripped ? 'TRIPPED · RESET IN ROOM C' : 'CLOSED');
    setClass(power.main, 'tripped', pw.tripped);
    for (const [id, r] of power.circs) {
      const c = pw.circuits[id];
      const armed = !!(pw.armed && pw.armed.id === id && game.state.t <= pw.armed.until);
      const live = game.api.live(id);
      r.reset.set({ tripped: c.branchTripped, fault: c.fault });
      setText(r.amps, `${c.amps} A${c.branchTripped ? ' · TRIP' : ''}`);
      r.tog.set({ on: c.on, armed, tag: c.isolated ? 'ISOLATED · ROOM C' : '' });
      r.lamp.set(live ? 'on' : 'off', 'green');
      setText(r.name, armed ? 'FORCE ON?' : r.short);
      setClass(r.cct, 'armed', armed);
      setClass(r.cct, 'iso', c.isolated);
      setClass(r.cct, 'dead', c.on && !c.isolated && pw.tripped);
    }
    paintMsg(power);
  }

  // ---------- control modules (systems / doors / overrides) ----------
  function makeModule(c, section) {
    const m = { id: c.id, kind: c.kind, view: null, msgText: '', msgOk: true, msgUntil: 0, lamps: [] };
    const lampBox = h('div', { class: 'mod-lamps' });
    const defs = STATUS_LAMPS[c.id];
    if (defs) {
      for (const [legend, color, fn] of defs) {
        const l = createLamp(color, legend);
        m.lamps.push({ l, fn });
        lampBox.append(l.el);
      }
    } else {
      const l = createLamp('green');
      m.lamps.push({ l, fn: v => TONE_LAMP[v.tone] || TONE_LAMP.dim, tone: true });
      lampBox.append(l.el);
    }
    m.plate = plate('', 'mod-plate');
    m.stt = h('div', { class: 'stt' });
    m.msg = h('div', { class: 'msg', hidden: true });
    let act = null;
    if (c.kind === 'keypad') {
      const ks = createKeySwitch({ label: 'Open restraint keypad', caption: 'ACCESS', onPress: () => { audio.ui('key'); openKeypad(c.id); } });
      act = ks.el;
    } else if (c.kind === 'hold') {
      let guard = null;
      const pb = createPushbutton({
        label: c.id, color: section === 'doors' ? 'amber' : 'red', size: 'md',
        onMechanical: name => audio.ui(name),
        hold: { isHold: () => !!m.view?.ready, seconds: () => m.view?.hold || 1.2 },
        onFire: () => { show(m, dispatch({ type: 'control', id: c.id })); guard?.close(); },
      });
      m.pb = pb;
      if (section === 'overrides') act = pb.el; // the bay cover is the guard
      else {
        guard = createGuard({ label: c.id, inner: pb, onOpen: () => audio.ui('cover') });
        m.guard = guard;
        act = guard.el;
      }
      act = h('div', { class: 'act-wrap' }, act, m.holdCap = h('div', { class: 'hold-cap' }));
    } else if (c.kind === 'button') {
      const pb = createPushbutton({ label: c.id, color: 'red', size: 'lg', onMechanical: name => audio.ui(name), onFire: () => show(m, dispatch({ type: 'control', id: c.id })) });
      m.pb = pb;
      act = h('div', { class: 'act-wrap' }, pb.el, m.holdCap = h('div', { class: 'hold-cap' }));
    }
    m.el = h('div', { class: `module kind-${c.kind}`, dataset: { control: c.id } },
      h('div', { class: 'mod-head' }, m.plate, lampBox),
      h('div', { class: 'mod-body' }, m.stt, act),
      m.msg);
    return m;
  }

  function paintModule(m, v) {
    m.view = v;
    setText(m.plate, ({ drain: 'DRAIN START', relief: 'PRESSURE RELIEF', restraint: 'RESTRAINT KEYPAD', aux: 'AUX PRESSURE · B' })[m.id] || v.label);
    if (m.pb) m.pb.btn.setAttribute('aria-label', `${v.label}: ${v.action || ''}`);
    if (m.guard) m.guard.lid.setAttribute('aria-label', `Lift guard: ${v.label}`);
    // Keep the full interlock explanation in the tooltip; the panel face has
    // room for a short, complete instruction rather than a clipped sentence.
    const status = m.id === 'drain' ? ({
      'INHIBITED — DRAIN PUMP ISOLATED (ROOM C)': 'PUMP ISOLATED · C',
      'INHIBITED — MAIN BREAKER TRIPPED': 'MAIN TRIPPED',
      'INHIBITED — DRAIN PUMP SWITCHED OFF': 'PUMP OFF',
      'INHIBITED — AUX PRESSURE UNSTABLE (CHAMBER A)': 'AUX UNSTABLE · A',
      'READY — FILLS, THEN DRAINS. RELEASES SHACKLE B': 'READY · FILLS / DRAINS',
      'COMPLETE — SHACKLE RELEASED': 'SHACKLE RELEASED',
    })[v.status] || v.status : v.status;
    setText(m.stt, status || '');
    m.stt.title = v.status || '';
    for (const t of ['ok', 'warn', 'alert', 'dim', 'info']) setClass(m.stt, `tone-${t}`, v.tone === t);
    for (const { l, fn, tone } of m.lamps) {
      const r = fn(v);
      if (tone) l.set(r[1], r[0]); else l.set(r);
    }
    if (m.pb) {
      const hold = m.kind === 'hold' && !!v.ready;
      m.pb.set({ ready: !!v.ready, caption: v.action || '', holdable: hold });
      setText(m.holdCap, hold ? `HOLD ${v.hold || 1.2}s` : v.ready ? 'PRESS' : '');
    }
    paintMsg(m);
  }

  function syncSection(section, el, controls, onFresh) {
    const map = mods[section];
    const list = controls.filter(c => c.section === section && !['fan-speed', 'steam-heat', 'branch-reset', 'e-stop'].includes(c.id));
    const key = list.map(c => c.id).join(',');
    if (sectionKeys[section] !== key) {
      sectionKeys[section] = key;
      for (const [id, m] of map) if (!list.some(c => c.id === id)) { m.guard?.close(); m.el.remove(); map.delete(id); }
      for (const c of list) {
        const fresh = !map.has(c.id);
        if (fresh) map.set(c.id, makeModule(c, section));
        el.append(map.get(c.id).el);
        if (fresh) onFresh?.(map.get(c.id));
      }
    }
    for (const c of list) paintModule(map.get(c.id), c);
    return list.length;
  }

  // ---------- doors ----------
  function buildDoors() {
    const switches = h('div', { class: 'door-bank' });
    for (const id of Object.keys(game.state.doors)) {
      if (id === 'exit') continue;
      const d = game.state.doors[id];
      const m = { id, msgText: '', msgOk: true, msgUntil: 0 };
      m.tog = createToggle({
        label: `${d.label} door`, variant: 'rocker', legends: ['OPEN', 'LOCK'],
        onPress: () => { audio.ui('switch'); show(m, dispatch({ type: 'door', door: id, open: !game.state.doors[id].open })); },
      });
      m.open = createLamp('green', 'OPEN');
      m.lock = createLamp('amber', 'LOCK');
      m.stt = h('div', { class: 'stt' });
      m.msg = h('div', { class: 'msg', hidden: true });
      m.el = h('div', { class: 'door', dataset: { control: id } },
        plate(d.label, 'door-plate'), h('div', { class: 'door-lamps' }, m.open.el, m.lock.el), m.tog.el, m.stt, m.msg);
      doorMods.set(id, m);
      switches.append(m.el);
    }
    const exitLamps = h('div', { class: 'exit-lamps' });
    const exitStt = h('div', { class: 'stt' });
    exitPanel = game.state.doors.exit ? { lamps: new Map(), box: exitLamps, stt: exitStt } : null;
    doorExtra = h('div', { class: 'door-extra' });
    doorsEl.replaceChildren(header('DOORS'), switches,
      exitPanel ? h('div', { class: 'exit-panel', dataset: { control: 'exit' } }, plate(game.state.doors.exit.label, 'mod-plate'), exitLamps, exitStt) : '',
      doorExtra);
  }

  function updateDoors(controls) {
    for (const [id, m] of doorMods) {
      const v = game.scenario.doorView(game.api, id);
      const interlocked = !game.state.doors[id].open && !!v.detail && v.canToggle;
      m.tog.set({ on: game.state.doors[id].open, tag: v.canToggle ? '' : 'LATCHED OPEN' });
      m.open.set(game.state.doors[id].open ? 'on' : 'off');
      m.lock.set(game.state.doors[id].open ? 'off' : 'on', interlocked ? 'red' : 'amber');
      setText(m.stt, v.detail && v.canToggle ? v.detail : v.status);
      for (const t of ['ok', 'warn', 'alert', 'dim', 'info']) setClass(m.stt, `tone-${t}`, v.tone === t);
      paintMsg(m);
    }
    if (exitPanel) {
      const v = game.scenario.doorView(game.api, 'exit');
      // The exit view lists its interlock lamps as "NAME ●" / "NAME ○" tokens.
      const tokens = [...(v.detail || '').matchAll(/([A-Z][A-Z ]*?)\s*([●○])/g)].map(t => [t[1].trim(), t[2] === '●']);
      tokens.push(['OPEN', /^OPEN/.test(v.status)]);
      for (const [name, lit] of tokens) {
        if (!exitPanel.lamps.has(name)) {
          const l = createLamp('green', name);
          exitPanel.lamps.set(name, l);
          exitPanel.box.append(l.el);
        }
        exitPanel.lamps.get(name).set(lit ? 'on' : 'off');
      }
      setText(exitPanel.stt, v.status);
      for (const t of ['ok', 'warn', 'alert', 'dim', 'info']) setClass(exitPanel.stt, `tone-${t}`, v.tone === t);
    }
    syncSection('doors', doorExtra, controls);
  }

  // ---------- emergency override bay ----------
  function buildBay() {
    emergency = { el: overridesEl, msg: h('div', { class: 'msg', hidden: true }) };
    let stopGuard;
    const stop = createPushbutton({ label: 'Emergency stop', color: 'red', size: 'lg', caption: 'STOP',
      onMechanical: name => audio.ui(name),
      onFire: () => {
        audio.ui('e-stop');
        show(emergency, dispatch({ type: 'control', id: 'e-stop' }));
        stopGuard.close();
      } });
    stop.set({ ready: true, caption: 'STOP' });
    stop.el.classList.add('e-stop-mushroom');
    stopGuard = createGuard({ label: 'E-STOP', inner: stop, onOpen: () => audio.ui('cover') });
    const stopModule = h('div', { class: 'stop-module', dataset: { control: 'e-stop' } }, plate('E-STOP'), stopGuard.el,
      h('div', { class: 'stop-caption' }, 'ALL CIRCUITS OFF'), emergency.msg);
    const content = h('div', { class: 'bay-content' });
    const cover = h('div', { class: 'bay-cover', 'aria-hidden': 'true' },
      h('div', { class: 'bay-stencil' }, h('b', {}, 'EMERGENCY OVERRIDE'), h('span', {}, 'No overrides available. They unlock only if a prisoner can no longer act.')));
    const well = h('div', { class: 'bay' }, content, cover);
    overridesEl.replaceChildren(header('EMERGENCY'), stopModule, well);
    bay = { well, content, cover, open: false };
  }

  function updateBay(controls) {
    const n = syncSection('overrides', bay.content, controls, m => {
      // A newly unlocked override is often the only way forward; never leave it below the fold.
      m.el.classList.add('fresh');
      m.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    const open = n > 0;
    if (open !== bay.open) {
      bay.open = open;
      setClass(bay.well, 'open', open);
      if (open) audio.ui('lid');
    }
  }

  function update() {
    if (!game) return;
    updateInstruments();
    updatePower();
    updateEnvironment();
    const controls = game.controls();
    syncSection('systems', systemGrid, controls);
    updateDoors(controls);
    updateBay(controls);
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
      h('div', { class: 'kp-display' }, slots, attempts), keys, row, msg,
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
    const live = keypad.r.msgUntil && performance.now() < keypad.r.msgUntil;
    setText(keypad.r.msg, live ? keypad.r.msgText : '');
    setClass(keypad.r.msg, 'bad', live && !keypad.r.msgOk);
    setClass(keypad.r.msg, 'good', live && keypad.r.msgOk);
  }

  return {
    setGame,
    update,
    openKeypad,
    closeKeypad,
    get keypadOpen() { return !!keypad && !keypadEl.hidden; },
  };
}
