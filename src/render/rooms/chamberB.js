// Chamber B — the flood chamber.
import { concrete, tiles, floor, ceiling, roomShade } from '../textures.js';
import { pipe, flange, panel, sign, lamp, gauge, fluorescent, grille, cellDoor, speaking } from '../draw.js';
import { FLOOD, FLOOR_Y } from '../../config.js';
import { PLAQUE } from '../../scenarios/three-chambers/data.js';

const WHEEL = { x: 75, y: 158, r: 13 };
const SPOUT = { x: 108, y: 170 };
const RING = { x: 196, y: 233 };
const DRAIN = { x: 254, y: 233 };
const PLATE = { x: 370, w: 34 };
const DOOR = { x: 418, y: 92, w: 50, h: 104 };
const RED = { x: 132, y: 34 };

export const surfaceY = level => 232 - level * 206;
const wave = (x, t, k = 1) => Math.sin(x * 0.05 + t * 2.2) * 1.3 * k + Math.sin(x * 0.13 - t * 3.1) * 0.6 * k;

export const chamberB = {
  paintStatic(ctx) {
    ceiling(ctx);
    concrete(ctx, 0, 18, 480, 102, { base: '#56605c', seed: 21, stains: 14 });
    tiles(ctx, 0, 118, 480, 78, { base: '#7c8a81', seed: 22 });
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 117, 480, 2);
    floor(ctx, 196, 270, { base: '#343a37', seed: 23 });
    pipe(ctx, 0, 22, 120, 22, 6, { color: '#4b544e' });
    pipe(ctx, 140, 30, 480, 30, 2.2, { color: '#55504a' });
    pipe(ctx, 74, 22, 74, 146, 9, { color: '#4b544e' });
    flange(ctx, 74, 62, 9, true);
    flange(ctx, 74, 112, 9, true);
    panel(ctx, 58, 144, 34, 34, { color: '#3b433e' });
    pipe(ctx, 90, SPOUT.y, SPOUT.x, SPOUT.y, 5, { color: '#454d48' });
    ctx.fillStyle = '#121513';
    ctx.fillRect(SPOUT.x - 1, SPOUT.y - 5, 3, 10);

    // Maintenance plaque, legible when zoomed.
    panel(ctx, 152, 60, 102, 80, { color: '#a7a38d', edge: 'rgba(0,0,0,0.7)' });
    sign(ctx, 154, 62, 98, 76, PLAQUE, { size: 4.05, bg: '#b3ae95', fg: '#1d1c18', stripe: true, align: 'left', lineGap: 1.75 });

    panel(ctx, 270, 82, 32, 32, { color: '#393f3b' });
    sign(ctx, 360, 106, 54, 15, ['EXIT BOLT B', 'STAND TO HOLD'], { size: 4.4, bg: '#c4bea6' });
    panel(ctx, 381, 124, 12, 12, { color: '#2e3431', rivets: false });

    ctx.save();
    ctx.fillStyle = '#202422';
    ctx.beginPath(); ctx.ellipse(DRAIN.x, DRAIN.y, 18, 4.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#505852';
    ctx.lineWidth = 0.7;
    for (let i = -14; i <= 14; i += 4) { ctx.beginPath(); ctx.moveTo(DRAIN.x + i, DRAIN.y - 3.6); ctx.lineTo(DRAIN.x + i, DRAIN.y + 3.6); ctx.stroke(); }
    ctx.strokeStyle = '#2b302d';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(RING.x, RING.y, 4.5, 2, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#4c534f';
    ctx.fillRect(PLATE.x, 226, PLATE.w, 5);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.5;
    for (let i = 4; i < PLATE.w; i += 5) { ctx.beginPath(); ctx.moveTo(PLATE.x + i, 226); ctx.lineTo(PLATE.x + i - 3, 231); ctx.stroke(); }
    ctx.restore();
    roomShade(ctx);
  },

  feetY(p, env) {
    const f = env.s.flood;
    if (p.loc !== 'B' || f.phase === 'idle' || f.level < FLOOD.swimAbove) return FLOOR_Y;
    return Math.min(FLOOR_Y, surfaceY(f.level) + 66 + wave(p.x, env.t));
  },

  paintDynamic(ctx, env) {
    const { s, t, fx } = env;
    const f = s.flood;
    fluorescent(ctx, 182, 20, 70, env.lit, env.flicker);
    lamp(ctx, RED.x, RED.y, 3.2, '#ff3b2f', !env.dead, { cage: true });
    grille(ctx, 318, 42, 24, 14, env.speaking.B ? 1 : 0);
    if (env.speaking.B) speaking(ctx, 342, 49, t);

    // Intake wheel.
    const op = env.opProgress('B', 'intake');
    const rot = op != null ? op * Math.PI * 5 : f.intake === 'open' ? Math.sin(t * 9) * 0.06 : f.intake === 'leaking' ? Math.PI * 5 : 0;
    ctx.save();
    ctx.translate(WHEEL.x, WHEEL.y);
    ctx.rotate(rot);
    ctx.strokeStyle = '#8b2f25';
    ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.arc(0, 0, WHEEL.r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * WHEEL.r, Math.sin(a) * WHEEL.r); ctx.stroke();
    }
    ctx.fillStyle = '#5a1f18';
    ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Water pouring from the spout.
    if (f.intake !== 'closed' && (f.phase === 'filling' || f.phase === 'draining')) {
      const thick = f.intake === 'open' ? 6 : 1.6;
      const bottom = Math.max(SPOUT.y + 6, surfaceY(f.level));
      ctx.save();
      ctx.strokeStyle = 'rgba(150,200,205,0.55)';
      ctx.lineWidth = thick;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(SPOUT.x, SPOUT.y);
      ctx.quadraticCurveTo(SPOUT.x + thick * 2.2, SPOUT.y + 6, SPOUT.x + thick * 2.4, bottom);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(230,250,250,0.45)';
      ctx.lineWidth = thick * 0.35;
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = -t * 60;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    const lv = f.level / FLOOD.lethal;
    gauge(ctx, 286, 98, 12, f.phase === 'failed' ? 1 : lv, { zones: [[0, 0.5, '#2f6e3c'], [0.5, 0.8, '#b08a2a'], [0.8, 1, '#8a2b22']], label: 'LEVEL' });

    const b = env.st.prisoners.B;
    const plateOn = env.boltB;
    lamp(ctx, 387, 130, 3, plateOn ? '#3bd16a' : f.phase === 'done' ? '#e8a23a' : '#5a5a3a', plateOn || f.phase === 'done');
    if (f.phase === 'draining' && !f.stall) {
      ctx.fillStyle = '#060807';
      ctx.beginPath(); ctx.ellipse(DRAIN.x, DRAIN.y, 14, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    }
    cellDoor(ctx, DOOR.x, DOOR.y, DOOR.w, DOOR.h, fx.door.B, { lampOn: env.st.doors.B.open, beyondLight: env.hallLit ? 1 : 0.25 });
    if (b.tether && b.alive) {
      // Chain trails behind the prisoner (drawn before them so it reads as on the floor).
      const fy = this.feetY(b, env);
      const ax = b.x - b.facing * 2, ay = fy - 2;
      ctx.strokeStyle = '#1f2321';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([2, 1.2]);
      ctx.beginPath();
      ctx.moveTo(RING.x, RING.y);
      ctx.quadraticCurveTo((RING.x + ax) / 2, Math.max(RING.y, ay) + 3, ax, ay);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  },

  paintFront(ctx, env) {
    const { s, t } = env;
    const f = s.flood;
    if (f.level <= 0.002 && f.phase !== 'failed') return;
    const level = f.phase === 'failed' ? 1 : f.level;
    const sy = surfaceY(level);
    const dead = env.dead;
    ctx.save();
    const g = ctx.createLinearGradient(0, sy, 0, 270);
    g.addColorStop(0, dead ? 'rgba(14,30,28,0.9)' : 'rgba(70,118,120,0.5)');
    g.addColorStop(1, dead ? 'rgba(4,10,10,0.97)' : 'rgba(16,40,44,0.8)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 270);
    for (let x = 0; x <= 480; x += 6) ctx.lineTo(x, sy + wave(x, t, dead ? 0.3 : 1));
    ctx.lineTo(480, 270);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = dead ? 'rgba(90,120,110,0.2)' : 'rgba(205,245,240,0.45)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let x = 0; x <= 480; x += 6) (x === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, sy + wave(x, t, dead ? 0.3 : 1));
    ctx.stroke();
    if (!dead) {
      ctx.strokeStyle = 'rgba(190,240,235,0.08)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 10; i++) {
        const cx = ((i * 53 + t * 8) % 520) - 20;
        ctx.beginPath();
        ctx.moveTo(cx, sy + 4);
        ctx.lineTo(cx - 18, Math.min(268, sy + 60));
        ctx.stroke();
      }
      if (f.intake === 'open' && f.phase === 'filling') {
        ctx.fillStyle = 'rgba(220,250,250,0.5)';
        for (let i = 0; i < 14; i++) {
          const k = (t * 0.9 + i * 0.137) % 1;
          const bx = SPOUT.x + 10 + Math.sin(i * 12.9 + t * 3) * 10;
          const by = sy + 4 + (1 - k) * 40;
          if (by < 268) { ctx.beginPath(); ctx.arc(bx, by, 0.8 + (i % 3) * 0.4, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      if (f.phase === 'draining' && !f.stall) {
        ctx.strokeStyle = 'rgba(220,250,250,0.35)';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 3; i++) {
          const rr = 6 + i * 7 + ((t * 14) % 7);
          ctx.beginPath(); ctx.ellipse(DRAIN.x, sy + 1, rr, rr * 0.22, 0, t * 3 + i, t * 3 + i + 4.4); ctx.stroke();
        }
      }
    } else {
      ctx.fillStyle = 'rgba(120,140,120,0.18)';
      for (let i = 0; i < 40; i++) {
        const px = (i * 97.3 + t * 3) % 480, py = 30 + ((i * 53.1 + t * 2) % 230);
        ctx.fillRect(px, py, 1, 1);
      }
    }
    ctx.restore();
  },

  lights(env) {
    const { t } = env;
    const sources = [], glows = [];
    if (!env.dead) {
      const pulse = 0.62 + Math.sin(t * 2.4 + 1) * 0.12;
      sources.push({ x: RED.x + 40, y: RED.y + 50, r: 250, i: 0.75 * pulse });
      glows.push({ x: RED.x, y: RED.y, r: 90, color: 'rgba(255,45,30,0.5)', a: pulse });
    }
    if (env.lit) {
      sources.push({ x: 217, y: 28, r: 340, i: 0.95 * env.flicker });
      glows.push({ x: 217, y: 24, r: 55, color: 'rgba(215,255,235,0.3)', a: env.flicker });
    }
    if (env.boltB || env.s.flood.phase === 'done') sources.push({ x: 387, y: 130, r: 40, i: 0.4 });
    if (env.fx.door.B > 0.05 && env.hallLit) sources.push({ x: DOOR.x + 25, y: 160, r: 90, i: 0.5 * env.fx.door.B });
    if (env.alarmHere) glows.push({ x: 240, y: 40, r: 260, color: 'rgba(255,30,20,0.18)', a: Math.max(0, Math.sin(t * 5)) });
    return { dark: env.dead ? 0.93 : env.lit ? 0.14 : 0.72, sources, glows };
  },
};
