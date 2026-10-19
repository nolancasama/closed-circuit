// The operator's desk: feeds, intercom, console, log, subtitles, notes,
// inspection, overlays and keyboard. Talks to the game only via dispatch().
import { CLOCK_START } from '../config.js';
import { h, setText, setClass, fmtClock } from './dom.js';
import { createIntercom } from './intercom.js';
import { createConsole } from './console.js';
import { heartRate } from '../engine/prisoners.js';

const SPEAKER = { you: 'YOU', pa: 'THE VOICE' };
const COLOR = { A: 'var(--cA)', B: 'var(--cB)', C: 'var(--cC)', you: 'var(--cYou)', pa: 'var(--cPa)' };
const FEEDS = ['A', 'B', 'C', 'hall'];

export function createApp({ renderer, audio, onRestart }) {
  const $ = id => document.getElementById(id);
  const desk = $('desk'), monitors = $('monitors'), mainScreen = $('mainScreen'), mainCanvas = $('mainCanvas');
  const subtitles = $('subtitles'), logEl = $('log'), banner = $('banner'), clock = $('clock');
  const inspectEl = $('inspect'), notesEl = $('notes'), keypadEl = $('keypad');
  const titleScreen = $('titleScreen'), pauseScreen = $('pauseScreen'), endScreen = $('endScreen');
  const tiles = [...document.querySelectorAll('.tile')];

  let game = null;
  let mode = 'grid';
  let focus = null;
  let logSeq = 0;
  let subKey = '';
  let inspecting = null;
  let inspectRefresh = 0;
  let started = false;
  let paused = false;
  let ended = false;
  let notesSeen = 0;
  let notesKey = '';

  renderer.attach(mainCanvas, { feed: 'A', main: true });
  for (const t of tiles) {
    renderer.attach(t.querySelector('canvas'), { feed: t.dataset.feed });
    t.addEventListener('click', () => focusFeed(t.dataset.feed, true));
    t.setAttribute('aria-label', `Camera ${t.dataset.feed}`);
  }

  const act = cmd => {
    if (!game) return { ok: false, msg: '' };
    audio.unlock();
    return game.dispatch(cmd);
  };

  const intercom = createIntercom({
    channelsEl: $('channels'), statusEl: $('channelStatus'), optionsEl: $('options'),
    onSay: (pid, option) => act({ type: 'say', pid, option }),
    onSelect: pid => followPrisoner(pid),
  });
  const consoleUi = createConsole({
    powerEl: $('powerPanel'), systemsEl: $('systemsPanel'), doorsEl: $('doorsPanel'), overridesEl: $('overridesPanel'),
    keypadEl, dispatch: act, audio,
    onKeypad: open => { if (open) { closeNotes(); focusFeed('A'); } },
  });

  // ---------- feeds ----------
  function placeSubtitles() {
    const host = mode === 'focus' ? mainScreen : monitors;
    if (subtitles.parentElement !== host) host.append(subtitles);
  }

  function focusFeed(feed, fromUser = false) {
    if (fromUser) audio.ui('click');
    if (mode === 'focus' && focus === feed) return;
    closeInspect();
    mode = 'focus';
    focus = feed;
    desk.dataset.mode = 'focus';
    renderer.setFeed(mainCanvas, feed);
    for (const t of tiles) setClass(t, 'active', t.dataset.feed === feed);
    setClass($('btnGrid'), 'on', false);
    placeSubtitles();
    if (fromUser && game) {
      const st = game.state;
      if (feed !== 'hall') intercom.select(feed);
      else {
        const here = st.prisonerOrder.filter(id => st.prisoners[id].loc === 'hall');
        if (here.length && !here.includes(intercom.channel)) intercom.select(here[0]);
      }
    }
  }

  function showGrid() {
    closeInspect();
    mode = 'grid';
    focus = null;
    desk.dataset.mode = 'grid';
    for (const t of tiles) t.classList.remove('active');
    setClass($('btnGrid'), 'on', true);
    placeSubtitles();
  }

  function followPrisoner(pid) {
    audio.ui('click');
    const p = game.state.prisoners[pid];
    if (FEEDS.includes(p.loc)) focusFeed(p.loc);
  }

  // ---------- inspection ----------
  function inspect(id) {
    const res = act({ type: 'inspect', id });
    if (!res.ok) return;
    audio.ui('click');
    inspecting = res.view;
    inspectRefresh = performance.now();
    renderer.zoomTo(mainCanvas, res.view.rect);
    setText($('inspectTitle'), res.view.title);
    setText($('inspectText'), res.view.text);
    inspectEl.hidden = false;
    setClass(mainScreen, 'zoomed', true);
    setClass(mainScreen, 'pointer', false);
  }

  function closeInspect() {
    if (!inspecting) return;
    inspecting = null;
    renderer.zoomTo(mainCanvas, null);
    inspectEl.hidden = true;
    setClass(mainScreen, 'zoomed', false);
  }

  mainScreen.addEventListener('pointermove', e => {
    if (inspecting || !game) return;
    const hs = renderer.hotspotAt(mainCanvas, e.clientX, e.clientY);
    renderer.setHover(mainCanvas, hs ? hs.id : null);
    setClass(mainScreen, 'pointer', !!hs);
  });
  mainScreen.addEventListener('pointerleave', () => renderer.setHover(mainCanvas, null));
  mainCanvas.addEventListener('click', e => {
    if (!game) return;
    if (inspecting) { closeInspect(); return; }
    const hs = renderer.hotspotAt(mainCanvas, e.clientX, e.clientY);
    if (hs) inspect(hs.id);
  });
  $('inspectClose').addEventListener('click', closeInspect);
  $('btnAll').addEventListener('click', () => { audio.ui('click'); showGrid(); });
  $('btnGrid').addEventListener('click', () => { audio.ui('click'); if (mode === 'grid') focusFeed(focus || 'A'); else showGrid(); });

  // ---------- notes ----------
  function renderNotes() {
    const st = game.state;
    const list = [...st.noteOrder].reverse().map(id => st.notes[id]);
    notesEl.replaceChildren(
      h('h2', { id: 'notesTitle' }, 'NOTES', h('button', { class: 'xbtn', type: 'button', onclick: closeNotes }, 'CLOSE')),
      list.length
        ? list.map((n, i) => h('div', { class: `note${i < st.noteOrder.length - notesSeen ? ' fresh' : ''}` }, h('h4', {}, n.title.toUpperCase()), h('p', {}, n.text)))
        : h('div', { class: 'empty' }, 'Nothing yet. Facts you learn — from prisoners or by zooming in — are pinned here.'),
    );
  }
  function openNotes() {
    consoleUi.closeKeypad();
    renderNotes();
    notesEl.hidden = false;
    notesSeen = game.state.noteOrder.length;
    notesKey = game.state.noteOrder.join(',') + JSON.stringify(game.state.noteOrder.map(id => game.state.notes[id].text));
  }
  function closeNotes() { notesEl.hidden = true; }
  $('btnNotes').addEventListener('click', () => { audio.ui('click'); if (notesEl.hidden) openNotes(); else closeNotes(); });

  // ---------- overlays ----------
  function begin() {
    audio.unlock();
    started = true;
    paused = false;
    titleScreen.hidden = true;
    pauseScreen.hidden = true;
    endScreen.hidden = true;
    renderer.boot?.();
    game.dispatch({ type: 'resume' });
    audio.resume();
  }

  function pause() {
    if (!started || ended || paused) return;
    paused = true;
    game.dispatch({ type: 'pause' });
    audio.suspend();
    $('volMusic').value = Math.round(audio.settings.music * 100);
    $('volSfx').value = Math.round(audio.settings.sfx * 100);
    $('muteAll').checked = audio.settings.muted;
    pauseScreen.hidden = false;
    $('btnResume').focus();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    pauseScreen.hidden = true;
    game.dispatch({ type: 'resume' });
    audio.unlock();
    audio.resume();
  }

  function showEnding() {
    const e = game.state.ending;
    if (!e) return;
    ended = true;
    closeInspect();
    closeNotes();
    consoleUi.closeKeypad();
    setText($('endKicker'), e.kind === 'walked' ? 'SHIFT ABANDONED' : 'SHIFT REPORT');
    setText($('endTitle'), e.title);
    setText($('endEpilogue'), e.epilogue);
    $('endFates').replaceChildren(...e.fates.map(f => h('div', { class: `fate ${f.fate}` },
      h('span', { class: 'nm', style: `color:${COLOR[f.id]}` }, `${f.id} · ${f.name.toUpperCase()}`),
      h('span', { class: 'badge' }, { escaped: 'ESCAPED', lost: 'LOST', left: 'LEFT BEHIND' }[f.fate]),
      h('span', { class: 'tx' }, f.text))));
    const m = Math.floor(e.time / 60), s = Math.floor(e.time % 60);
    $('endStats').innerHTML = `RESCUED <b>${e.rescued} / 3</b> · SHIFT ${m}:${String(s).padStart(2, '0')} · WORDS SPOKEN ${e.stats.commands} · REASSURANCES ${e.stats.reassures} · OVERLOADS ${e.stats.overloads} · WRONG SEQUENCES ${e.stats.wrongCodes} · OBJECTS INSPECTED ${e.stats.inspected}`;
    endScreen.hidden = false;
    $('btnReplay').focus();
  }

  $('btnBegin').addEventListener('click', begin);
  $('btnPause').addEventListener('click', () => { audio.ui('click'); pause(); });
  $('btnResume').addEventListener('click', resume);
  $('btnRestart').addEventListener('click', () => { pauseScreen.hidden = true; onRestart(); });
  $('btnReplay').addEventListener('click', () => { endScreen.hidden = true; onRestart(); });
  $('volMusic').addEventListener('input', e => audio.setMusic(e.target.value / 100));
  $('volSfx').addEventListener('input', e => audio.setSfx(e.target.value / 100));
  $('muteAll').addEventListener('change', e => audio.setMuted(e.target.checked));
  for (const tab of document.querySelectorAll('.tab')) tab.addEventListener('click', () => { audio.ui('click'); desk.dataset.tab = tab.dataset.tab; });

  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  document.addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'Escape') {
      if (consoleUi.keypadOpen) consoleUi.closeKeypad();
      else if (!notesEl.hidden) closeNotes();
      else if (inspecting) closeInspect();
      else if (paused) resume();
      else pause();
      return;
    }
    if (!started || paused || ended || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 4) focusFeed(FEEDS[n - 1], true);
    else if (e.key === 'g' || e.key === 'G') mode === 'grid' ? focusFeed(focus || 'A', true) : showGrid();
    else if (e.key === 'n' || e.key === 'N') notesEl.hidden ? openNotes() : closeNotes();
  });

  // Title screen static.
  const noiseCanvas = $('titleNoise');
  const nctx = noiseCanvas.getContext('2d');
  noiseCanvas.width = 160;
  noiseCanvas.height = 90;
  noiseCanvas.style.imageRendering = 'pixelated';
  function titleNoise() {
    if (titleScreen.hidden) return;
    const img = nctx.createImageData(160, 90);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v * 0.8; img.data[i + 1] = v; img.data[i + 2] = v * 0.85; img.data[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
  }

  // ---------- per-frame ----------
  function updateLog() {
    const fresh = game.state.log.filter(e => e.id > logSeq);
    if (!fresh.length) return;
    const stick = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 40;
    for (const e of fresh) {
      logSeq = e.id;
      const who = SPEAKER[e.kind] || (game.state.prisoners[e.kind] ? game.state.prisoners[e.kind].name.toUpperCase() : null);
      logEl.append(h('div', { class: `e ${e.kind}` }, h('span', { class: 'ts' }, fmtClock(CLOCK_START + e.t)), who ? h('span', { class: 'sp' }, `${who}:`) : null, e.text));
    }
    while (logEl.childElementCount > 180) logEl.firstElementChild.remove();
    if (stick) logEl.scrollTop = logEl.scrollHeight;
  }

  function updateSubtitles() {
    const lines = game.activeLines().slice(-2);
    const key = lines.map(l => l.speaker + l.text).join('|');
    if (key === subKey) return;
    subKey = key;
    subtitles.replaceChildren(...lines.map(l => h('div', { class: 'sub' },
      h('b', { style: `color:${COLOR[l.speaker] || 'var(--text)'}` }, `${SPEAKER[l.speaker] || game.state.prisoners[l.speaker]?.name.toUpperCase() || l.speaker}:`),
      l.text)));
  }

  function updateTiles() {
    const st = game.state, api = game.api, sc = game.scenario;
    const talking = new Set(game.activeLines().map(l => l.speaker));
    for (const t of tiles) {
      const feed = t.dataset.feed;
      const chip = t.querySelector('.tile-chip');
      const fs = sc.feedStatus(api, feed);
      let html, alert = fs?.tone === 'alert';
      if (feed === 'hall') {
        const here = st.prisonerOrder.filter(id => st.prisoners[id].loc === 'hall' && !st.prisoners[id].escaped).map(id => st.prisoners[id].name.toUpperCase());
        html = `<span class="who">HALL</span> <span class="st">${fs ? fs.text : st.s.exit.released ? 'EXIT SEALED · LATCHED' : 'EXIT SEALED'}</span>${here.length ? ` <span class="st">· ${here.join(', ')}</span>` : ''}`;
      } else {
        const p = st.prisoners[feed];
        const ss = sc.subjectStatus(api, p);
        alert = alert || ss.tone === 'alert';
        const hr = p.alive && !p.escaped ? `<span class="hr">♥${heartRate(p, st.t)}</span> ` : '';
        html = `<span class="who" style="color:${COLOR[feed]}">${p.name.toUpperCase()}</span> ${hr}<span class="st">${p.loc === feed || !p.alive || p.escaped ? ss.text : 'IN HALL'}</span>${talking.has(feed) ? ' <span class="talk">◉ TALKING</span>' : ''}`;
      }
      if (chip.innerHTML !== html) chip.innerHTML = html;
      setClass(t, 'alert', alert && !(mode === 'focus' && focus === feed));
    }
  }

  function update() {
    if (!game) return;
    const st = game.state, api = game.api, sc = game.scenario;
    titleNoise();
    setText(clock, fmtClock(CLOCK_START + st.t));
    const b = sc.banner(api);
    banner.hidden = !b;
    if (b) { setText(banner, b.text); setClass(banner, 'warn', b.tone === 'warn'); }
    intercom.update();
    consoleUi.update();
    updateLog();
    updateSubtitles();
    updateTiles();
    const count = st.noteOrder.length;
    setText($('notesCount'), String(count));
    setClass($('notesCount'), 'fresh', count > notesSeen);
    if (!notesEl.hidden) {
      const key = st.noteOrder.join(',') + JSON.stringify(st.noteOrder.map(id => st.notes[id].text));
      if (key !== notesKey) { renderNotes(); notesSeen = count; notesKey = key; }
    }
    if (inspecting && performance.now() - inspectRefresh > 800) {
      inspectRefresh = performance.now();
      const res = game.dispatch({ type: 'inspect', id: inspecting.id, refresh: true });
      if (res.ok) setText($('inspectText'), res.view.text);
    }
  }

  function onEvents(events) {
    for (const ev of events) {
      if (ev.type === 'ending') setTimeout(showEnding, ev.kind === 'walked' ? 600 : 1400);
    }
  }

  function setGame(g, immediately) {
    game = g;
    logSeq = 0;
    subKey = '';
    notesSeen = 0;
    notesKey = '';
    ended = false;
    paused = false;
    logEl.replaceChildren();
    closeInspect();
    closeNotes();
    intercom.setGame(g);
    consoleUi.setGame(g);
    showGrid();
    desk.dataset.tab = 'intercom';
    if (immediately) begin();
    else { started = false; titleScreen.hidden = false; }
  }

  return {
    setGame,
    update,
    onEvents,
    get focus() { return focus; },
    get mode() { return mode; },
    focusFeed,
    showGrid,
    inspect,
    pause,
    resume,
  };
}
