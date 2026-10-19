// Synthesised sound: an ambient music bus and an SFX bus, both under a
// compressor. One-shots come from sim events; loops follow game state.
const STORE = 'closed-circuit.audio';

function loadSettings() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (v && typeof v.music === 'number' && typeof v.sfx === 'number') return { music: v.music, sfx: v.sfx, muted: !!v.muted };
  } catch { /* storage unavailable */ }
  return { music: 0.6, sfx: 0.8, muted: false };
}

export function createAudio() {
  const settings = loadSettings();
  let ac = null, master, musicBus, sfxBus, noiseBuf, loops = null;
  let groanAt = 0;

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch { /* ignore */ }
  }

  function applyVolumes() {
    if (!ac) return;
    const t = ac.currentTime;
    master.gain.setTargetAtTime(settings.muted ? 0 : 0.9, t, 0.05);
    musicBus.gain.setTargetAtTime(settings.music * 0.9, t, 0.05);
    sfxBus.gain.setTargetAtTime(settings.sfx, t, 0.05);
  }

  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ac = new AC(); } catch { return false; }
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 18;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    master = ac.createGain();
    musicBus = ac.createGain();
    sfxBus = ac.createGain();
    musicBus.connect(master);
    sfxBus.connect(master);
    master.connect(comp);
    comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    buildLoops();
    return true;
  }

  // ---------- building blocks ----------
  function envGain(dest, t0, attack, peak, decay) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    g.connect(dest);
    return g;
  }

  function tone(freq, t0, dur, peak, { type = 'sine', to = null, dest = sfxBus, attack = 0.004 } = {}) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    o.connect(envGain(dest, t0, attack, peak, dur));
    o.start(t0);
    o.stop(t0 + attack + dur + 0.05);
  }

  function noise(t0, dur, peak, { type = 'bandpass', freq = 1000, q = 1, to = null, dest = sfxBus, attack = 0.003 } = {}) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    f.Q.value = q;
    src.connect(f);
    f.connect(envGain(dest, t0, attack, peak, dur));
    src.start(t0, Math.random());
    src.stop(t0 + attack + dur + 0.05);
  }

  function metal(t0, base, peak, dur) {
    for (const [k, a] of [[1, 1], [1.58, 0.6], [2.73, 0.4], [4.2, 0.25]]) tone(base * k, t0, dur * (1 / Math.sqrt(k)), peak * a);
  }

  const SFX = {
    key: t => tone(1050, t, 0.04, 0.06),
    click: t => { tone(1200, t, 0.03, 0.05); noise(t, 0.02, 0.05, { freq: 3000 }); },
    switch: t => { noise(t, 0.02, 0.12, { type: 'highpass', freq: 2200 }); tone(130, t, 0.07, 0.14, { to: 60 }); },
    breaker: t => { tone(95, t, 0.14, 0.22, { to: 45 }); noise(t, 0.05, 0.16, { freq: 800, q: 2 }); },
    trip: t => {
      noise(t, 0.45, 0.2, { freq: 3200, to: 300, q: 3 });
      tone(320, t, 0.9, 0.08, { type: 'sawtooth', to: 40 });
      tone(90, t, 0.18, 0.2, { to: 40 });
    },
    deny: t => { tone(240, t, 0.1, 0.06, { type: 'square' }); tone(180, t + 0.12, 0.12, 0.06, { type: 'square' }); },
    intercom: t => { tone(880, t, 0.05, 0.05); tone(1320, t + 0.06, 0.05, 0.05); noise(t, 0.14, 0.03, { freq: 2200, q: 0.8 }); },
    pa: t => { tone(70, t, 0.5, 0.05, { type: 'sawtooth' }); noise(t, 0.3, 0.05, { freq: 1600, q: 0.7 }); tone(660, t, 0.08, 0.035); tone(495, t + 0.09, 0.1, 0.035); },
    'door-open': t => { noise(t, 0.6, 0.08, { freq: 380, q: 1.2, attack: 0.08 }); metal(t + 0.55, 210, 0.07, 0.5); },
    'door-close': t => { noise(t, 0.5, 0.07, { freq: 320, q: 1.2, attack: 0.05 }); tone(70, t + 0.48, 0.2, 0.2, { to: 40 }); metal(t + 0.48, 180, 0.06, 0.4); },
    'door-unlock': t => { metal(t, 420, 0.05, 0.3); tone(110, t, 0.1, 0.12, { to: 60 }); },
    lever: t => { for (let i = 0; i < 6; i++) noise(t + i * 0.22, 0.03, 0.06, { freq: 1800, q: 4 }); tone(260, t, 1.2, 0.025, { to: 200 }); },
    crank: t => { for (let i = 0; i < 18; i++) noise(t + i * 0.26, 0.025, 0.05, { freq: 2400, q: 5 }); },
    valve: t => { tone(620, t, 0.9, 0.025, { to: 760 }); for (let i = 0; i < 14; i++) noise(t + i * 0.33, 0.04, 0.04, { freq: 900, q: 3 }); },
    clunk: t => { tone(80, t, 0.2, 0.22, { to: 40 }); noise(t, 0.06, 0.1, { freq: 600 }); },
    clank: t => metal(t, 310, 0.08, 0.5),
    bolt: t => { metal(t, 150, 0.09, 0.9); tone(60, t, 0.3, 0.2, { to: 35 }); },
    shock: t => {
      tone(118, t, 0.55, 0.07, { type: 'sawtooth' });
      tone(236, t, 0.5, 0.05, { type: 'square' });
      for (let i = 0; i < 9; i++) noise(t + Math.random() * 0.5, 0.03, 0.12, { type: 'highpass', freq: 2500 });
    },
    'chair-engage': t => {
      tone(55, t, 1.2, 0.25, { to: 30 });
      tone(118, t, 1.6, 0.06, { type: 'sawtooth', to: 50 });
      noise(t, 1.4, 0.06, { freq: 200, q: 0.8 });
    },
    'restraint-release': t => { metal(t, 380, 0.07, 0.4); noise(t + 0.05, 0.4, 0.05, { type: 'highpass', freq: 3000 }); },
    'intake-burst': t => { noise(t, 1.6, 0.16, { type: 'lowpass', freq: 900, attack: 0.25 }); tone(48, t, 0.8, 0.15, { to: 38 }); },
    surge: t => { noise(t, 0.9, 0.2, { type: 'lowpass', freq: 500, attack: 0.05 }); tone(50, t, 0.5, 0.2, { to: 34 }); },
    relief: t => { noise(t, 1.2, 0.1, { type: 'highpass', freq: 2500, attack: 0.05 }); noise(t + 0.3, 1.5, 0.1, { freq: 260, q: 2 }); },
    damper: t => noise(t, 0.6, 0.07, { freq: 1300, q: 3, to: 700 }),
    plate: t => { tone(180, t, 0.1, 0.12, { to: 90 }); tone(440, t + 0.08, 0.3, 0.03); },
    shackle: t => metal(t, 1150, 0.05, 0.35),
    flatline: t => tone(880, t, 2.4, 0.035, { attack: 0.02 }),
    override: t => { tone(300, t, 0.4, 0.05, { type: 'triangle', to: 900 }); tone(90, t + 0.4, 0.2, 0.18, { to: 45 }); },
    release: t => { metal(t, 240, 0.09, 0.8); tone(60, t, 1.5, 0.08, { type: 'sawtooth', to: 120 }); },
    'exit-open': t => { noise(t, 2.6, 0.14, { type: 'lowpass', freq: 160, attack: 0.3 }); tone(80, t, 2.4, 0.05, { type: 'sawtooth', to: 160 }); },
    escape: t => { tone(659, t, 0.6, 0.035, { attack: 0.03 }); tone(988, t + 0.18, 0.8, 0.03, { attack: 0.03 }); },
    static: t => noise(t, 0.25, 0.06, { type: 'highpass', freq: 1500 }),
  };

  const VOICE = { A: 920, B: 720, C: 560, you: 1050, pa: 380 };
  function murmur(speaker, dur) {
    const t = ac.currentTime;
    const f = VOICE[speaker] || 800;
    const n = Math.min(8, Math.max(2, Math.round(dur * 2.5)));
    for (let i = 0; i < n; i++) noise(t + i * 0.14 + Math.random() * 0.05, 0.08, speaker === 'pa' ? 0.02 : 0.014, { freq: f * (0.85 + Math.random() * 0.3), q: 6 });
  }

  // ---------- loops ----------
  function loopNoise(dest, type, freq, q = 1) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ac.createGain();
    g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(dest);
    src.start();
    return { g, f };
  }

  function loopOsc(dest, type, freq, filterFreq = 0) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.value = 0;
    if (filterFreq) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq;
      o.connect(f); f.connect(g);
    } else o.connect(g);
    g.connect(dest);
    o.start();
    return { g, o };
  }

  function buildLoops() {
    const droneA = loopOsc(musicBus, 'sawtooth', 55, 170);
    const droneB = loopOsc(musicBus, 'sawtooth', 55.35, 170);
    const room = loopNoise(musicBus, 'lowpass', 380);
    const pulse = loopOsc(musicBus, 'sine', 44);
    const pulseLfo = ac.createOscillator();
    pulseLfo.frequency.value = 1.15;
    const pulseDepth = ac.createGain();
    pulseDepth.gain.value = 0;
    pulseLfo.connect(pulseDepth);
    pulseDepth.connect(pulse.g.gain);
    pulseLfo.start();
    const high = loopOsc(musicBus, 'sine', 741);
    const high2 = loopOsc(musicBus, 'sine', 784);
    const alarm = loopOsc(sfxBus, 'sine', 620);
    const water = loopNoise(sfxBus, 'bandpass', 520, 0.7);
    const gurgle = loopNoise(sfxBus, 'bandpass', 240, 3);
    const fan = loopNoise(sfxBus, 'lowpass', 850);
    const pump = loopOsc(sfxBus, 'sawtooth', 50, 260);
    const hum = loopOsc(sfxBus, 'sawtooth', 120, 400);
    const furnace = loopNoise(sfxBus, 'lowpass', 180);
    loops = { droneA, droneB, room, pulse, pulseDepth, high, high2, alarm, water, gurgle, fan, pump, hum, furnace };
  }

  function set(node, value, tc = 0.4) {
    if (node.last !== undefined && Math.abs(node.last - value) < 1e-4) return;
    node.last = value;
    node.g.gain.setTargetAtTime(value, ac.currentTime, tc);
  }

  // Called every frame with the game and the focused feed.
  function update(game, focus) {
    if (!ac || !loops || ac.state !== 'running') return;
    const st = game.state, s = st.s, api = game.api;
    const t = ac.currentTime;
    const tense = st.alarm.on || st.power.tripped;
    set(loops.droneA, 0.05);
    set(loops.droneB, 0.05);
    set(loops.room, 0.025);
    if (loops.tense !== tense) {
      loops.tense = tense;
      loops.pulseDepth.gain.setTargetAtTime(tense ? 0.07 : 0, t, 1);
    }
    set(loops.high, tense ? 0.006 : 0, 1.5);
    set(loops.high2, tense ? 0.006 : 0, 1.5);
    if (st.alarm.on) {
      const phase = Math.floor(t / 0.45) % 2;
      if (loops.alarmPhase !== phase) {
        loops.alarmPhase = phase;
        loops.alarm.o.frequency.setValueAtTime(phase ? 500 : 620, t);
      }
      set(loops.alarm, 0.035, 0.05);
    } else set(loops.alarm, 0, 0.1);
    const near = room => (focus === room ? 1 : 0.35);
    const f = s.flood;
    const flowing = f.phase === 'filling' || f.phase === 'draining';
    set(loops.water, flowing ? (f.intake === 'open' ? 0.12 : f.intake === 'leaking' ? 0.035 : 0) * near('B') : 0);
    set(loops.gurgle, f.phase === 'draining' && !f.stall ? 0.08 * near('B') : 0);
    set(loops.fan, api.live('vent') ? 0.03 * near('C') : 0, 0.8);
    set(loops.pump, api.live('pump') ? (f.phase === 'draining' ? 0.05 : 0.012) * near('B') : 0, 0.6);
    const roomLit = focus && game.scenario.lit(api, focus);
    set(loops.hum, roomLit ? 0.006 : 0, 0.3);
    set(loops.furnace, api.live('incinerator') ? 0.02 * near('hall') : 0, 1);
    if (t > groanAt) {
      groanAt = t + 22 + Math.random() * 25;
      if (groanAt > 30) {
        tone(70 + Math.random() * 30, t, 2.5, 0.03, { type: 'triangle', to: 45, dest: musicBus, attack: 0.6 });
        noise(t, 2.2, 0.015, { freq: 300 + Math.random() * 400, q: 8, dest: musicBus, attack: 0.5 });
      }
    }
  }

  function onEvents(events) {
    if (!ac || ac.state !== 'running') return;
    const t = ac.currentTime + 0.01;
    let n = 0;
    for (const ev of events) {
      if (n > 6) break;
      if (ev.type === 'sfx' && SFX[ev.name]) { SFX[ev.name](t); n++; }
      else if (ev.type === 'line') { murmur(ev.speaker, ev.dur); n++; }
      else if (ev.type === 'interference' && ev.strength >= 0.8) { SFX.static(t); n++; }
    }
  }

  return {
    settings,
    unlock() { if (ensure() && ac.state === 'suspended') ac.resume().catch(() => {}); },
    suspend() { if (ac && ac.state === 'running') ac.suspend().catch(() => {}); },
    resume() { if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); },
    ui(name) { if (ac && ac.state === 'running' && SFX[name]) SFX[name](ac.currentTime + 0.005); },
    setMusic(v) { settings.music = v; applyVolumes(); save(); },
    setSfx(v) { settings.sfx = v; applyVolumes(); save(); },
    setMuted(m) { settings.muted = m; applyVolumes(); save(); },
    update,
    onEvents,
  };
}
