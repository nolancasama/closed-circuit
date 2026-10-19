// Intercom: channel tabs, channel status and context-sensitive options.
import { h, setText, setClass } from './dom.js';
import { heartRate, busy } from '../engine/prisoners.js';

export function createIntercom({ channelsEl, statusEl, optionsEl, onSay, onSelect }) {
  let game = null;
  let channel = 'C';
  let lastKey = '';
  let chanEls = {};
  let note = null; // { text, until }

  function setGame(g) {
    game = g;
    channel = 'C';
    lastKey = '';
    note = null;
    chanEls = {};
    channelsEl.replaceChildren();
    for (const id of game.state.prisonerOrder) {
      const p = game.state.prisoners[id];
      const st = h('span', { class: 'st' });
      const b = h('button', { class: 'chan', type: 'button', role: 'tab', 'aria-label': `Channel ${id}, ${p.name}`, onclick: () => select(id, true) },
        h('span', { class: 'nm' }, `${id} · ${p.name.toUpperCase()}`), st);
      chanEls[id] = { b, st };
      channelsEl.append(b);
    }
  }

  function select(id, fromUser = false) {
    if (channel === id) return;
    channel = id;
    lastKey = '';
    note = null;
    if (fromUser) onSelect?.(id);
  }

  function say(optionId) {
    const res = onSay(channel, optionId);
    if (res && !res.ok) note = { text: res.msg, until: performance.now() + 2500 };
  }

  function statusLine(p, ch) {
    if (!ch.ok) return { text: `${p.name.toUpperCase()} — ${ch.status}`, alert: !p.escaped };
    if (p.hesitating) return { text: `${p.name.toUpperCase()} IS FROZEN — tell ${p.name} to go.`, alert: true };
    if (p.panicked) return { text: `${p.name.toUpperCase()} IS PANICKING — only calming words get through.`, alert: true };
    if (busy(p)) return { text: `${p.name.toUpperCase()}: ${p.task.label.toLowerCase()}…`, alert: false };
    if (!game.state.s.met?.[p.id]) return { text: `CHANNEL ${p.id} OPEN — ${p.name} has not heard from you yet.`, alert: false };
    return { text: `CHANNEL ${p.id} OPEN — ${p.name} can hear you.`, alert: false };
  }

  function update() {
    if (!game) return;
    const st = game.state, api = game.api, sc = game.scenario;
    for (const id of st.prisonerOrder) {
      const p = st.prisoners[id];
      const s = sc.subjectStatus(api, p);
      const hr = heartRate(p, st.t);
      const el = chanEls[id];
      const html = p.alive && !p.escaped ? `<span class="hr">♥ ${hr}</span> · ${s.text}` : s.text;
      if (el.st.innerHTML !== html) el.st.innerHTML = html;
      setClass(el.b, 'active', id === channel);
      setClass(el.b, 'alert', s.tone === 'alert');
      setClass(el.b, 'lost', !p.alive);
      el.b.setAttribute('aria-selected', id === channel ? 'true' : 'false');
    }
    const p = st.prisoners[channel];
    const ch = game.channel(channel);
    const line = note && performance.now() < note.until ? { text: note.text, alert: true } : statusLine(p, ch);
    setText(statusEl, line.text);
    setClass(statusEl, 'alert', line.alert);

    const opts = game.options(channel);
    const key = channel + '|' + opts.map(o => `${o.id}:${o.enabled ? 1 : 0}${o.urgent ? 'u' : ''}${o.reason || ''}:${o.label}`).join(';');
    if (key === lastKey) return;
    lastKey = key;
    optionsEl.replaceChildren(...opts.map(o => h('button', {
      type: 'button',
      class: `opt${o.urgent ? ' urgent' : ''}${o.calm ? ' calm' : ''}`,
      disabled: !o.enabled,
      dataset: { option: o.id },
      onclick: () => say(o.id),
    }, o.label, o.reason === 'busy' ? h('span', { class: 'why' }, 'BUSY') : null)));
    if (!opts.length) optionsEl.append(h('div', { class: 'empty' }, ch.ok ? '' : 'No one answers on this channel.'));
  }

  return { setGame, select, update, get channel() { return channel; } };
}
