// Draws every attached CCTV canvas from game state: room, prisoners, lighting,
// camera effects and on-screen display. Reads state only.
import { ROOM_W, ROOM_H, FLOOR_Y, CLOCK_START } from '../config.js';
import { makeCanvas, clamp, MONO } from './util.js';
import { noiseTiles, scanlinePattern } from './textures.js';
import { drawPrisoner } from './characters.js';
import { chamberA } from './rooms/chamberA.js';
import { chamberB } from './rooms/chamberB.js';
import { chamberC } from './rooms/chamberC.js';
import { hall } from './rooms/hall.js';
import { boltA, boltB, exitPower } from '../scenarios/three-chambers/mechanics.js';

const PAINTERS = { A: chamberA, B: chamberB, C: chamberC, hall };
const BG_SCALE = 2;
const NOISE = 160;

export function createRenderer() {
  const bgCache = {};
  const noise = noiseTiles(4, NOISE);
  const views = new Map();
  let game = null;
  let fx = null;
  let frame = 0;
  let last = 0;
  const date = new Date();
  const dateText = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${date.getFullYear()}`;

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(entries => {
    for (const e of entries) { const v = views.get(e.target); if (v) v.dirty = true; }
  }) : null;

  function freshFx() {
    return {
      glitch: { A: 0, B: 0, C: 0, hall: 0 },
      boot: { A: 0.5, B: 0.95, C: 1.4, hall: 1.85 },
      startup: { A: 0, B: 0, C: 0, hall: 0 },
      dip: { A: 0, B: 0, C: 0, hall: 0, hall2: 0 },
      door: { A: 0, B: 0, C: 0 },
      exitOpen: 0,
      fanAngle: 0,
      fanSpeed: 0,
      flash: { A: 0 },
    };
  }

  function setGame(g) {
    game = g;
    fx = freshFx();
    for (const v of views.values()) { v.zoom = { x: ROOM_W / 2, y: ROOM_H / 2, z: 1 }; v.target = { ...v.zoom }; v.hover = null; }
  }

  function background(room) {
    if (!bgCache[room]) {
      const c = makeCanvas(ROOM_W * BG_SCALE, ROOM_H * BG_SCALE);
      const x = c.getContext('2d');
      x.scale(BG_SCALE, BG_SCALE);
      PAINTERS[room].paintStatic(x);
      bgCache[room] = c;
    }
    return bgCache[room];
  }

  function attach(canvas, { feed, main = false }) {
    const view = {
      canvas, ctx: canvas.getContext('2d'), feed, main, dirty: true,
      zoom: { x: ROOM_W / 2, y: ROOM_H / 2, z: 1 }, target: { x: ROOM_W / 2, y: ROOM_H / 2, z: 1 },
      hover: null, light: null, scan: null, cam: { scale: 1, ox: 0, oy: 0 },
    };
    views.set(canvas, view);
    ro?.observe(canvas);
    return view;
  }

  function setFeed(canvas, feed) {
    const v = views.get(canvas);
    if (!v || v.feed === feed) return;
    v.feed = feed;
    v.zoom = { x: ROOM_W / 2, y: ROOM_H / 2, z: 1 };
    v.target = { ...v.zoom };
    v.hover = null;
    if (fx) fx.glitch[feed] = Math.max(fx.glitch[feed], 0.35);
  }

  function zoomTo(canvas, rect) {
    const v = views.get(canvas);
    if (!v) return;
    if (!rect) { v.target = { x: ROOM_W / 2, y: ROOM_H / 2, z: 1 }; return; }
    const [x, y, w, h] = rect;
    const z = clamp(Math.min((ROOM_W * 0.62) / w, (ROOM_H * 0.62) / h), 1.4, 3.2);
    v.target = { x: x + w / 2, y: y + h / 2, z };
    v.hover = null;
  }

  function resize(v) {
    const r = v.canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, v.main ? 1.6 : 1.25);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (v.canvas.width !== w || v.canvas.height !== h) {
      v.canvas.width = w;
      v.canvas.height = h;
      v.light = null;
      v.scan = null;
    }
    v.dirty = false;
    return true;
  }

  function toRoom(v, clientX, clientY) {
    const r = v.canvas.getBoundingClientRect();
    const px = ((clientX - r.left) * v.canvas.width) / r.width;
    const py = ((clientY - r.top) * v.canvas.height) / r.height;
    return { x: (px - v.cam.ox) / v.cam.scale, y: (py - v.cam.oy) / v.cam.scale };
  }

  function hotspotAt(canvas, clientX, clientY) {
    const v = views.get(canvas);
    if (!v || !game) return null;
    const { x, y } = toRoom(v, clientX, clientY);
    const list = game.scenario.hotspots.filter(h => h.room === v.feed);
    let best = null, bestArea = Infinity;
    for (const h of list) {
      const [hx, hy, hw, hh] = h.rect;
      if (x >= hx && x <= hx + hw && y >= hy && y <= hy + hh && hw * hh < bestArea) { best = h; bestArea = hw * hh; }
    }
    return best;
  }

  function setHover(canvas, id) {
    const v = views.get(canvas);
    if (v) v.hover = id;
  }

  function onEvents(events) {
    if (!fx) return;
    for (const ev of events) {
      if (ev.type === 'interference') {
        const rooms = ev.room === '*' ? Object.keys(fx.glitch) : [ev.room];
        for (const r of rooms) if (r in fx.glitch) fx.glitch[r] = Math.max(fx.glitch[r], ev.strength);
      } else if (ev.type === 'lights' && ev.on) {
        fx.startup[ev.room] = 1.1;
      } else if (ev.type === 'lost') {
        const room = game.state.prisoners[ev.pid].loc;
        if (room in fx.glitch) fx.glitch[room] = Math.max(fx.glitch[room], 1.6);
      } else if (ev.type === 'sfx' && ev.name === 'shock') {
        fx.flash.A = 1;
      }
    }
  }

  function flickerOf(key, dt) {
    if (fx.startup[key] > 0) {
      fx.startup[key] -= dt;
      return Math.random() < 0.55 ? 1 : 0.08;
    }
    if (fx.dip[key] > 0) { fx.dip[key] -= dt; return 0.45; }
    if (Math.random() < dt * 0.35) fx.dip[key] = 0.05 + Math.random() * 0.18;
    return 1;
  }

  function opProgress(pid, kind) {
    const p = game.state.prisoners[pid];
    const step = p.task?.steps[p.task.i];
    if (!p.task || p.task.kind !== kind || step?.k !== 'op') return null;
    return Math.min(1, p.task.opT / step.dur);
  }

  function makeEnvs(now, dt) {
    const st = game.state, s = st.s, api = game.api, sc = game.scenario;
    const speaking = {};
    for (const l of game.activeLines()) speaking[l.speaker] = true;
    const roomLit = { A: sc.lit(api, 'A'), B: sc.lit(api, 'B'), C: sc.lit(api, 'C') };
    const hallLit = sc.lit(api, 'hall');
    const flick = {
      A: flickerOf('A', dt), B: flickerOf('B', dt), C: flickerOf('C', dt), hall: flickerOf('hall', dt), hall2: flickerOf('hall2', dt),
    };
    const shared = {
      st, s, t: now, simT: st.t, fx, speaking, roomLit, hallLit, opProgress,
      boltA: boltA(api), boltB: boltB(api), exitPower: exitPower(api), incinerator: api.live('incinerator'),
    };
    const envs = {};
    for (const room of ['A', 'B', 'C', 'hall']) {
      envs[room] = {
        ...shared,
        lit: room === 'hall' ? hallLit : roomLit[room],
        flicker: flick[room],
        flicker2: flick.hall2,
        dead: (room === 'A' && s.restraint.dead) || (room === 'B' && s.flood.phase === 'failed'),
        alarmHere: st.alarm.on && st.alarm.room === room,
      };
    }
    return envs;
  }

  function stepFx(dt) {
    const st = game.state;
    for (const k of Object.keys(fx.glitch)) {
      fx.glitch[k] = Math.max(0, fx.glitch[k] - dt * 1.1);
      if (Math.random() < dt / 28) fx.glitch[k] = Math.max(fx.glitch[k], 0.15 + Math.random() * 0.2);
      if (fx.boot[k] > 0) fx.boot[k] -= dt;
    }
    for (const id of ['A', 'B', 'C']) {
      const target = st.doors[id].open ? 1 : 0;
      fx.door[id] += clamp(target - fx.door[id], -dt * 1.8, dt * 1.8);
    }
    const exitTarget = st.doors.exit.open ? 1 : 0;
    fx.exitOpen += clamp(exitTarget - fx.exitOpen, -dt * 0.8, dt * 0.8);
    const fanTarget = game.api.live('vent') ? 9 : 0;
    fx.fanSpeed += clamp(fanTarget - fx.fanSpeed, -dt * 3, dt * 5);
    fx.fanAngle += fx.fanSpeed * dt;
    fx.flash.A = Math.max(0, fx.flash.A - dt * 0.7);
  }

  function drawRoom(v, env, dt) {
    const { ctx, canvas, feed } = v;
    const W = canvas.width, H = canvas.height;
    const painter = PAINTERS[feed];
    const ease = Math.min(1, dt * 5);
    v.zoom.z += (v.target.z - v.zoom.z) * ease;
    v.zoom.x += (v.target.x - v.zoom.x) * ease;
    v.zoom.y += (v.target.y - v.zoom.y) * ease;
    const base = Math.max(W / ROOM_W, H / ROOM_H);
    const scale = base * v.zoom.z;
    const halfW = W / scale / 2, halfH = H / scale / 2;
    const cx = clamp(v.zoom.x, halfW, ROOM_W - halfW);
    const cy = clamp(v.zoom.y, halfH, ROOM_H - halfH);
    const ox = W / 2 - cx * scale, oy = H / 2 - cy * scale;
    v.cam = { scale, ox, oy };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(background(feed), 0, 0, ROOM_W, ROOM_H);
    painter.paintDynamic(ctx, env);
    for (const id of game.state.prisonerOrder) {
      const p = game.state.prisoners[id];
      if (p.loc !== feed || p.escaped) continue;
      if (!p.alive && p.lostCause === 'flood') continue;
      const feetY = painter.feetY ? painter.feetY(p, env) : FLOOR_Y;
      drawPrisoner(ctx, p, env.s, env.t, p.x, feetY);
    }
    painter.paintFront(ctx, env);
    light(v, painter.lights(env), scale, ox, oy);
    if (v.main && v.zoom.z < 1.08 && v.target.z === 1) hotspots(v, env);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function light(v, L, scale, ox, oy) {
    const { ctx, canvas } = v;
    const W = canvas.width, H = canvas.height;
    const lw = Math.ceil(W / 2), lh = Math.ceil(H / 2);
    if (!v.light || v.light.width !== lw || v.light.height !== lh) v.light = makeCanvas(lw, lh);
    const lc = v.light.getContext('2d');
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, lw, lh);
    lc.fillStyle = `rgba(2,4,5,${L.dark})`;
    lc.fillRect(0, 0, lw, lh);
    lc.setTransform(scale / 2, 0, 0, scale / 2, ox / 2, oy / 2);
    lc.globalCompositeOperation = 'destination-out';
    for (const s of L.sources) {
      if (s.i <= 0) continue;
      const g = lc.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, `rgba(0,0,0,${clamp(s.i, 0, 1)})`);
      g.addColorStop(0.55, `rgba(0,0,0,${clamp(s.i, 0, 1) * 0.45})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g;
      lc.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(v.light, 0, 0, W, H);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const gl of L.glows) {
      if (!gl.a || gl.a <= 0) continue;
      const g = ctx.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, gl.r);
      g.addColorStop(0, gl.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = clamp(gl.a, 0, 1);
      ctx.fillStyle = g;
      ctx.fillRect(gl.x - gl.r, gl.y - gl.r, gl.r * 2, gl.r * 2);
    }
    ctx.restore();
  }

  function hotspots(v, env) {
    const { ctx } = v;
    const pulse = 0.55 + Math.sin(env.t * 2.5) * 0.2;
    for (const h of game.scenario.hotspots) {
      if (h.room !== v.feed) continue;
      const [x, y, w, hh] = h.rect;
      const hot = v.hover === h.id;
      const c = Math.min(7, w * 0.25, hh * 0.25);
      ctx.strokeStyle = hot ? 'rgba(170,255,200,0.95)' : `rgba(150,240,180,${0.32 * pulse})`;
      ctx.lineWidth = hot ? 1.1 : 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y);
      ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + c);
      ctx.moveTo(x + w, y + hh - c); ctx.lineTo(x + w, y + hh); ctx.lineTo(x + w - c, y + hh);
      ctx.moveTo(x + c, y + hh); ctx.lineTo(x, y + hh); ctx.lineTo(x, y + hh - c);
      ctx.stroke();
      if (hot) {
        ctx.font = `700 6px ${MONO}`;
        const tw = ctx.measureText(h.title.toUpperCase()).width;
        const ty = y > 14 ? y - 3 : y + hh + 8;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(x - 1, ty - 6.5, tw + 4, 8.5);
        ctx.fillStyle = 'rgba(180,255,205,0.95)';
        ctx.fillText(h.title.toUpperCase(), x + 1, ty);
      }
    }
  }

  function post(v, env) {
    const { ctx, canvas, feed } = v;
    const W = canvas.width, H = canvas.height;
    const g = fx.glitch[feed];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(30,62,46,0.08)';
    ctx.fillRect(0, 0, W, H);

    const tile = noise[(frame + feed.length) % noise.length];
    const gs = Math.max(1, W / 520) * 1.6;
    const size = NOISE * gs;
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = Math.min(0.9, (env.lit ? 0.08 : 0.2) + g * 0.35 + (env.dead ? 0.18 : 0));
    const nx = -Math.random() * size, ny = -Math.random() * size;
    for (let y = ny; y < H; y += size) for (let x = nx; x < W; x += size) ctx.drawImage(tile, x, y, size, size);

    ctx.globalCompositeOperation = 'source-over';
    if (!v.scan) v.scan = scanlinePattern(ctx);
    ctx.globalAlpha = v.main ? 0.16 : 0.12;
    ctx.fillStyle = v.scan;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = 1;
    const bandY = ((env.t * 0.09 * H) % (H * 1.4)) - H * 0.2;
    const band = ctx.createLinearGradient(0, bandY - H * 0.08, 0, bandY + H * 0.08);
    band.addColorStop(0, 'rgba(255,255,255,0)');
    band.addColorStop(0.5, 'rgba(220,255,230,0.035)');
    band.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, bandY - H * 0.08, W, H * 0.16);

    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    if (g > 0.03) {
      const n = 2 + Math.floor(g * 7);
      for (let i = 0; i < n; i++) {
        const y = Math.random() * H;
        const h = Math.max(2, (2 + Math.random() * 16 * g) * (H / ROOM_H));
        const dx = (Math.random() - 0.5) * W * 0.07 * Math.min(1.5, g);
        ctx.drawImage(canvas, 0, y, W, h, dx, y, W, h);
      }
      ctx.fillStyle = `rgba(235,245,240,${Math.min(0.5, 0.12 * g)})`;
      for (let i = 0; i < 1 + g * 3; i++) ctx.fillRect(0, Math.random() * H, W, Math.max(1, H * 0.004));
    }
    if (g > 1 || fx.boot[feed] > 0) {
      ctx.globalAlpha = fx.boot[feed] > 0 ? 1 : Math.min(1, g - 0.6);
      ctx.fillStyle = '#0a0c0b';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= 0.55;
      const bx = -Math.random() * size, by = -Math.random() * size;
      for (let y = by; y < H; y += size) for (let x = bx; x < W; x += size) ctx.drawImage(tile, x, y, size, size);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      const fs = Math.round(H * (v.main ? 0.05 : 0.1));
      ctx.font = `700 ${fs}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(fx.boot[feed] > 0 ? 'CONNECTING…' : 'SIGNAL LOST', W / 2 + 2, H / 2 + 2);
      ctx.fillStyle = '#e9f2ec';
      ctx.fillText(fx.boot[feed] > 0 ? 'CONNECTING…' : 'SIGNAL LOST', W / 2, H / 2);
    }
    ctx.restore();
  }

  function osd(v, env) {
    const { ctx, canvas, feed } = v;
    const W = canvas.width, H = canvas.height;
    const sc = game.scenario;
    const room = sc.rooms[feed];
    const fs = Math.max(10, Math.round(H * (v.main ? 0.036 : 0.085)));
    const pad = Math.round(fs * 0.7);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `700 ${fs}px ${MONO}`;
    ctx.textBaseline = 'top';
    const put = (str, x, y, align = 'left', color = '#e8f0ea') => {
      ctx.textAlign = align;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(str, x + Math.max(1, fs * 0.08), y + Math.max(1, fs * 0.08));
      ctx.fillStyle = color;
      ctx.fillText(str, x, y);
    };
    if (!v.main) {
      put(room.cam, pad * 0.7, pad * 0.6);
      if (Math.floor(env.t * 1.2) % 2 === 0) { ctx.fillStyle = '#ff3b2f'; ctx.beginPath(); ctx.arc(W - pad, pad * 0.6 + fs * 0.5, fs * 0.28, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      return;
    }
    put(`${room.cam}  ${room.label}`, pad, pad);
    const secs = CLOCK_START + Math.floor(game.state.t);
    const hh = String(Math.floor(secs / 3600) % 24).padStart(2, '0');
    const mm = String(Math.floor(secs / 60) % 60).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    const stamp = `${dateText}  ${hh}:${mm}:${ss}`;
    put(stamp, W - pad, pad, 'right');
    const recX = W - pad - ctx.measureText(stamp).width - fs * 0.9 - ctx.measureText('REC').width;
    put('REC', recX, pad, 'left', '#ff6a5c');
    if (Math.floor(env.t * 1.2) % 2 === 0) {
      ctx.fillStyle = '#ff3b2f';
      ctx.beginPath(); ctx.arc(recX - fs * 0.55, pad + fs * 0.5, fs * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    const status = sc.feedStatus(game.api, feed);
    const bottom = H - pad - fs;
    if (status) put(status.text, pad, bottom, 'left', status.tone === 'alert' ? '#ff8a7a' : '#e8f0ea');
    else if (!env.lit) put('LOW LIGHT  GAIN +18dB', pad, bottom, 'left', '#c9d4cc');
    if (v.zoom.z > 1.05) put(`DIGITAL ZOOM ${v.zoom.z.toFixed(1)}×`, W - pad, bottom, 'right', '#bff5cf');
    ctx.restore();
  }

  function render(now) {
    if (!game) return;
    const dt = last ? Math.min(0.1, Math.max(0, now - last)) : 0.016;
    last = now;
    frame++;
    stepFx(dt);
    const envs = makeEnvs(now, dt);
    for (const v of views.values()) {
      if (!v.canvas.isConnected || v.canvas.offsetParent === null) continue;
      if (!v.main && frame % 2 === 1 && !v.dirty) continue;
      if (v.dirty && !resize(v)) continue;
      const env = envs[v.feed];
      drawRoom(v, env, v.main ? dt : dt * 2);
      post(v, env);
      osd(v, env);
    }
  }

  // Feeds come online one by one at the start of a shift.
  function boot() {
    if (fx) fx.boot = { A: 0.5, B: 0.95, C: 1.4, hall: 1.85 };
  }

  return { attach, setFeed, setGame, render, zoomTo, hotspotAt, setHover, onEvents, boot, views };
}
