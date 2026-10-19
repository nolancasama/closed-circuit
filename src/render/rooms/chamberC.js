// Room C — the switch room.
import { concrete, floor, ceiling, roomShade } from '../textures.js';
import { pipe, panel, sign, lamp, gauge, fluorescent, grille, cellDoor, speaking, text } from '../draw.js';
import { seeded, lerp, MONO } from '../util.js';
import { BOARD } from '../../scenarios/three-chambers/data.js';

const LABELS = { lightsA: ['LIGHTS', 'A · 2A'], lightsBC: ['LIGHTS', 'BC · 2A'], incinerator: ['INCIN.', '4A'], pump: ['PUMP B', '4A'], vent: ['VENT', 'FAN · 3A'], exit: ['EXIT', 'MTR · 5A'] };
const SLOT = { y0: 98, y1: 130 };
const RELEASE = { x: 284, y: 112 };
const FAN = { x: 370, y: 66, r: 27 };
const DAMPER = { x: 381, y: 152 };
const DOOR = { x: 418, y: 92, w: 50, h: 104 };
const RED = { x: 250, y: 34 };

export const chamberC = {
  paintStatic(ctx) {
    ceiling(ctx);
    concrete(ctx, 0, 18, 480, 124, { base: '#58605a', seed: 31 });
    const r = seeded(32);
    ctx.fillStyle = '#2d4639';
    ctx.fillRect(0, 140, 480, 56);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(150,150,130,${0.08 + r() * 0.2})`;
      ctx.fillRect(r() * 480, 140 + r() * 56, 1 + r() * 4, 0.6 + r() * 2);
    }
    ctx.fillStyle = '#1f3027';
    ctx.fillRect(0, 139, 480, 2);
    floor(ctx, 196, 270, { base: '#373c39', seed: 33 });
    pipe(ctx, 0, 24, 480, 24, 2.6, { color: '#4b524d' });
    for (const x of [70, 120, 180, 232]) pipe(ctx, x, 24, x, 46, 1.6, { color: '#3d4540' });

    panel(ctx, 40, 46, 204, 138, { color: '#394039' });
    text(ctx, 'DISTRIBUTION BOARD', 46, 58, { size: 5.4, color: '#cfc9b2' });
    sign(ctx, 168, 50, 70, 12, ['MAX LOAD 10 A'], { size: 5.6, bg: '#d6bf55', stripe: false });
    text(ctx, 'LOAD', 70, 92, { size: 3.6, color: '#bdb7a0', align: 'center', font: MONO });
    BOARD.order.forEach((id, i) => {
      const x = BOARD.x0 + BOARD.dx * i;
      ctx.fillStyle = '#141715';
      ctx.fillRect(x - 4, SLOT.y0, 8, SLOT.y1 - SLOT.y0);
      ctx.fillStyle = 'rgba(255,255,240,0.1)';
      ctx.fillRect(x - 4, SLOT.y1, 8, 0.8);
      const [a, b] = LABELS[id];
      text(ctx, a, x, 140, { size: 3.4, color: '#d9d3bb', align: 'center' });
      text(ctx, b, x, 145, { size: 3.1, color: '#a9a38c', align: 'center' });
    });
    ctx.fillStyle = '#141715';
    ctx.fillRect(BOARD.main - 7, 92, 14, 44);
    text(ctx, 'MAIN', BOARD.main, 145, { size: 4, color: '#d9d3bb', align: 'center' });
    text(ctx, 'ISOLATORS ARE MANUAL — DO NOT WORK LIVE', 142, 176, { size: 3.6, color: '#bdb7a0', align: 'center' });

    sign(ctx, 258, 72, 52, 11, ['FINAL RELEASE'], { size: 5.4, bg: '#b9533a', fg: '#f2ead6' });
    panel(ctx, 262, 85, 44, 11, { color: '#2f3531', rivets: false });
    ['A', 'B', 'P'].forEach((l, i) => text(ctx, l, 268 + i * 15, 94.5, { size: 3.4, color: '#cfc9b2' }));
    ctx.fillStyle = '#151816';
    ctx.fillRect(264, 98, 40, 64);

    ctx.fillStyle = '#2d332f';
    ctx.fillRect(354, 0, 32, 40);
    ctx.fillStyle = '#1b1f1c';
    ctx.beginPath(); ctx.arc(FAN.x, FAN.y, FAN.r + 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0c0e0d';
    ctx.beginPath(); ctx.arc(FAN.x, FAN.y, FAN.r, 0, Math.PI * 2); ctx.fill();
    sign(ctx, 346, 118, 52, 11, ['VENT DAMPER'], { size: 5, bg: '#c4bea6' });
    panel(ctx, 374, 132, 14, 42, { color: '#3d4540' });
    roomShade(ctx);
  },

  paintDynamic(ctx, env) {
    const { st, s, t, fx } = env;
    const power = st.power;
    fluorescent(ctx, 108, 20, 70, env.lit, env.flicker);
    lamp(ctx, RED.x, RED.y, 3.2, '#ff3b2f', true, { cage: true });
    grille(ctx, 300, 38, 24, 14, env.speaking.C ? 1 : 0);
    if (env.speaking.C) speaking(ctx, 324, 45, t);

    const load = Object.values(power.circuits).reduce((a, c) => a + (c.on && !c.isolated ? c.amps : 0), 0);
    gauge(ctx, 70, 74, 12, power.tripped ? 0 : Math.min(1.08, load / power.capacity) * (1 + Math.sin(t * 9) * 0.004), { zones: [[0, 0.8, '#2f6e3c'], [0.8, 1, '#8a2b22']] });

    const c = st.prisoners.C;
    const step = c.task?.steps[c.task.i];
    const opIso = step?.k === 'op' && c.task.kind === 'isolator' ? c.task.circuit : null;
    BOARD.order.forEach((id, i) => {
      const x = BOARD.x0 + BOARD.dx * i;
      const circ = power.circuits[id];
      let up = circ.isolated ? 0 : 1;
      if (opIso === id) up = Math.min(1, c.task.opT / step.dur);
      const hy = lerp(SLOT.y1 - 5, SLOT.y0 + 5, up);
      ctx.fillStyle = '#5d635f';
      ctx.fillRect(x - 3, hy - 2, 6, 4);
      ctx.fillStyle = circ.isolated ? '#9a3326' : '#2a2e2b';
      ctx.fillRect(x - 5, hy - 1, 10, 2.2);
      const live = !power.tripped && circ.on && !circ.isolated;
      lamp(ctx, x, 92, 2, live ? '#45d16e' : circ.on && !circ.isolated ? '#e8a23a' : '#c2a03a', live || (circ.on && !circ.isolated));
    });
    const mainOp = step?.k === 'op' && c.task.kind === 'main' ? Math.min(1, c.task.opT / step.dur) : null;
    const mainUp = mainOp != null ? mainOp : power.tripped ? 0 : 1;
    const my = lerp(128, 100, mainUp);
    ctx.fillStyle = '#6a706b';
    ctx.fillRect(BOARD.main - 5, my - 4, 10, 8);
    ctx.fillStyle = power.tripped ? '#d8402f' : '#1f2321';
    ctx.fillRect(BOARD.main - 8, my - 1.5, 16, 3);

    // Final release knife switch and interlock lamps.
    const relOp = env.opProgress('C', 'release');
    const down = relOp != null ? relOp : s.exit.released ? 1 : 0;
    const ang = lerp(-1.25, 0.35, down);
    ctx.save();
    ctx.translate(RELEASE.x - 8, RELEASE.y + 30);
    ctx.strokeStyle = '#b9b4a0';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * 26, Math.sin(ang) * 26); ctx.stroke();
    ctx.fillStyle = '#1c1f1d';
    ctx.beginPath(); ctx.arc(Math.cos(ang) * 26, Math.sin(ang) * 26, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a605b';
    ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(160,165,150,0.55)';
    ctx.lineWidth = 0.7;
    for (let gx = 264; gx <= 304; gx += 6.6) { ctx.beginPath(); ctx.moveTo(gx, 98); ctx.lineTo(gx, 162); ctx.stroke(); }
    for (let gy = 98; gy <= 162; gy += 8) { ctx.beginPath(); ctx.moveTo(264, gy); ctx.lineTo(304, gy); ctx.stroke(); }
    const latched = s.exit.released;
    lamp(ctx, 275, 90.5, 1.9, env.boltA || latched ? '#45d16e' : '#e0362b', true);
    lamp(ctx, 290, 90.5, 1.9, env.boltB || latched ? '#45d16e' : '#e0362b', true);
    lamp(ctx, 305, 90.5, 1.9, env.exitPower ? '#45d16e' : '#e0362b', true);

    // Vent fan and damper.
    ctx.save();
    ctx.translate(FAN.x, FAN.y);
    ctx.rotate(fx.fanAngle);
    ctx.fillStyle = '#4b524e';
    for (let i = 0; i < 5; i++) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.ellipse(FAN.r * 0.5, 0, FAN.r * 0.45, 5, 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(130,140,130,0.6)';
    ctx.lineWidth = 0.7;
    for (let gx = FAN.x - FAN.r; gx <= FAN.x + FAN.r; gx += 4) {
      const hh = Math.sqrt(Math.max(0, FAN.r * FAN.r - (gx - FAN.x) ** 2));
      ctx.beginPath(); ctx.moveTo(gx, FAN.y - hh); ctx.lineTo(gx, FAN.y + hh); ctx.stroke();
    }
    const dOp = env.opProgress('C', 'damper');
    const open = dOp != null ? (s.flood.damper ? 1 - dOp : dOp) : s.flood.damper ? 1 : 0;
    const da = lerp(-0.9, 0.9, open);
    ctx.strokeStyle = '#1c1f1d';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(DAMPER.x, DAMPER.y); ctx.lineTo(DAMPER.x + Math.sin(da) * 18, DAMPER.y - Math.cos(da) * 18); ctx.stroke();
    ctx.fillStyle = '#c9a227';
    ctx.beginPath(); ctx.arc(DAMPER.x + Math.sin(da) * 18, DAMPER.y - Math.cos(da) * 18, 2.8, 0, Math.PI * 2); ctx.fill();

    cellDoor(ctx, DOOR.x, DOOR.y, DOOR.w, DOOR.h, fx.door.C, { lampOn: st.doors.C.open, beyondLight: env.hallLit ? 1 : 0.25 });
  },

  paintFront() {},

  lights(env) {
    const { t, st } = env;
    const sources = [], glows = [];
    const pulse = 0.62 + Math.sin(t * 2.4 + 2) * 0.12;
    sources.push({ x: RED.x, y: RED.y + 50, r: 250, i: 0.75 * pulse });
    glows.push({ x: RED.x, y: RED.y, r: 90, color: 'rgba(255,45,30,0.5)', a: pulse });
    if (env.lit) {
      sources.push({ x: 143, y: 28, r: 330, i: 0.95 * env.flicker });
      glows.push({ x: 143, y: 24, r: 55, color: 'rgba(215,255,235,0.3)', a: env.flicker });
    }
    sources.push({ x: 142, y: 100, r: 70, i: 0.25 });
    if (st.power.tripped) glows.push({ x: BOARD.main, y: 120, r: 22, color: 'rgba(255,60,40,0.6)', a: 0.6 + Math.sin(t * 8) * 0.3 });
    if (env.fx.door.C > 0.05 && env.hallLit) sources.push({ x: DOOR.x + 25, y: 160, r: 90, i: 0.5 * env.fx.door.C });
    return { dark: env.lit ? 0.14 : 0.72, sources, glows };
  },
};
