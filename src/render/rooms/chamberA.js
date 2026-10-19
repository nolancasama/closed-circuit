// Chamber A — the restraint chamber.
import { concrete, floor, ceiling, roomShade } from '../textures.js';
import { pipe, flange, panel, sign, lamp, gauge, fluorescent, grille, cellDoor, speaking, text } from '../draw.js';
import { lerp, clamp } from '../util.js';

const CHAIR = 172;
const BOX = { x: 92, y: 88, w: 54, h: 46 };
const LEVER = { x: 320, y: 142, len: 30 };
const GAUGE = { x: 357, y: 105, r: 12 };
const CRANK = { x: 66, y: 140, r: 15 };
const DOOR = { x: 418, y: 92, w: 50, h: 104 };
const RED = { x: 116, y: 34 };

export const SYMBOL_COLORS = { red: '#d8402f', blue: '#3d74d6', yellow: '#e2c234' };

export const chamberA = {
  paintStatic(ctx) {
    ceiling(ctx);
    concrete(ctx, 0, 18, 480, 178, { base: '#5a615b', seed: 11 });
    floor(ctx, 196, 270, { base: '#3b403c', seed: 12 });
    pipe(ctx, 0, 25, 480, 25, 3.4);
    pipe(ctx, 150, 33, 480, 33, 2.1, { color: '#57514a' });
    for (const x of [60, 180, 300, 420]) flange(ctx, x, 25, 3.4, false);
    pipe(ctx, 119, 25, 119, BOX.y, 1.3, { color: '#3d4540' });

    panel(ctx, BOX.x, BOX.y, BOX.w, BOX.h, { color: '#434b45' });
    text(ctx, 'RESTRAINT', BOX.x + BOX.w / 2, BOX.y + 9, { size: 5, color: '#cfc9b2', align: 'center' });
    sign(ctx, BOX.x - 3, BOX.y + BOX.h + 3, BOX.w + 6, 14, ['INCORRECT SEQUENCE: PENALTY', 'THIRD FAILURE IS FINAL'], { size: 3.4, bg: '#bdb59a', stripe: true });
    ctx.strokeStyle = '#161917';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(BOX.x + 8, BOX.y + BOX.h + 17);
    ctx.bezierCurveTo(BOX.x + 4, 206, 132, 218, 154, 216);
    ctx.stroke();

    sign(ctx, 290, 68, 100, 13, ['AUX PRESSURE — SYSTEM B'], { size: 5.6, bg: '#c4bea6' });
    panel(ctx, 310, 116, 22, 50, { color: '#3d4540' });
    panel(ctx, 341, 89, 32, 32, { color: '#393f3b' });
    pipe(ctx, 357, 121, 357, 196, 1.6, { color: '#49504b' });

    sign(ctx, 40, 102, 52, 11, ['EXIT BOLT A'], { size: 5.4, bg: '#c4bea6' });
    panel(ctx, 46, 120, 40, 40, { color: '#3d4540' });
    ctx.strokeStyle = '#2b302d';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(46, 154); ctx.lineTo(18, 154); ctx.lineTo(18, 26); ctx.stroke();

    const g = ctx.createRadialGradient(CHAIR, 232, 0, CHAIR, 232, 48);
    g.addColorStop(0, 'rgba(18,12,6,0.55)');
    g.addColorStop(1, 'rgba(18,12,6,0)');
    ctx.fillStyle = g;
    ctx.fillRect(CHAIR - 52, 204, 104, 60);
    ctx.fillStyle = '#1a1c1b';
    for (const bx of [150, 196]) { ctx.beginPath(); ctx.arc(bx, 229, 1.4, 0, Math.PI * 2); ctx.fill(); }
    roomShade(ctx);
  },

  paintDynamic(ctx, env) {
    const { s, t, fx } = env;
    const r = s.restraint;
    fluorescent(ctx, 205, 20, 70, env.lit, env.flicker);
    lamp(ctx, RED.x, RED.y, 3.2, '#ff3b2f', !env.dead || Math.sin(t * 1.3) > 0, { cage: true });
    grille(ctx, 398, 42, 24, 14, env.speaking.A ? 1 : 0);
    if (env.speaking.A) speaking(ctx, 422, 49, t);

    // Restraint box lamps mirror the console keypad.
    const wrong = fx.flash.A > 0 && Math.sin(t * 30) > 0;
    for (let i = 0; i < 4; i++) {
      const lx = BOX.x + 12 + i * 10, ly = BOX.y + 23;
      if (r.released) lamp(ctx, lx, ly, 2.6, '#3bd16a', true);
      else if (r.dead) lamp(ctx, lx, ly, 2.6, '#7a2a22', false);
      else if (wrong) lamp(ctx, lx, ly, 2.6, '#ff3b2f', true);
      else if (i < r.entry.length) {
        const [color] = r.entry[i].split('-');
        lamp(ctx, lx, ly, 2.6, { red: '#d8402f', blue: '#3d74d6', yellow: '#e2c234' }[color], true);
      } else lamp(ctx, lx, ly, 2.6, '#c2a03a', false);
    }
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < r.attempts ? '#e9e3cf' : '#2a2d2b';
      ctx.beginPath(); ctx.arc(BOX.x + 20 + i * 7, BOX.y + 36, 1.3, 0, Math.PI * 2); ctx.fill();
    }

    // Chair body (behind Nadia).
    ctx.fillStyle = '#2b2f2c';
    ctx.fillRect(148, 226, 52, 3.5);
    ctx.fillStyle = '#3c423e';
    ctx.fillRect(157, 160, 6, 53);
    ctx.fillRect(150, 158, 18, 9);
    ctx.fillRect(157, 207, 40, 6);
    ctx.fillRect(159, 213, 4, 14);
    ctx.fillRect(190, 213, 4, 14);
    ctx.fillRect(166, 197, 32, 3.5);
    ctx.fillRect(194, 200, 3, 8);
    ctx.fillStyle = 'rgba(255,255,240,0.12)';
    ctx.fillRect(157, 160, 1, 53);
    ctx.fillRect(157, 207, 40, 1);

    // Aux lever and gauge.
    const op = env.opProgress('A', 'lever');
    const up = -1.05, down = 1.0;
    const ang = op != null ? lerp(up, down, op) : s.aux === 'unstable' ? up : down;
    ctx.strokeStyle = '#1c1f1d';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    const lx = LEVER.x + Math.sin(ang) * LEVER.len, ly = LEVER.y - Math.cos(ang) * LEVER.len;
    ctx.beginPath(); ctx.moveTo(LEVER.x, LEVER.y); ctx.lineTo(lx, ly); ctx.stroke();
    ctx.fillStyle = '#b8402f';
    ctx.beginPath(); ctx.arc(lx, ly, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5b625d';
    ctx.beginPath(); ctx.arc(LEVER.x, LEVER.y, 3.6, 0, Math.PI * 2); ctx.fill();
    const gv = s.aux === 'unstable' ? 0.16 + Math.sin(t * 13) * 0.05 + Math.sin(t * 5.1) * 0.03
      : s.aux === 'forced' ? 0.92 + Math.sin(t * 17) * 0.04 : 0.7 + Math.sin(t * 1.7) * 0.01;
    gauge(ctx, GAUGE.x, GAUGE.y, GAUGE.r, gv, { zones: [[0, 0.45, '#8a2b22'], [0.45, 0.85, '#2f6e3c'], [0.85, 1, '#8a2b22']], label: 'AUX' });

    // Bolt crank.
    const cop = env.opProgress('A', 'crank');
    const rot = cop != null ? cop * Math.PI * 6 : s.boltA ? Math.PI * 6 : 0;
    ctx.save();
    ctx.translate(CRANK.x, CRANK.y);
    ctx.rotate(rot);
    ctx.strokeStyle = '#262a27';
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(0, 0, CRANK.r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * CRANK.r, Math.sin(a) * CRANK.r); ctx.stroke();
    }
    ctx.fillStyle = '#9a3326';
    ctx.beginPath(); ctx.arc(CRANK.r * 0.7, 0, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    lamp(ctx, 82, 126, 2, s.boltA || s.boltAOverride ? '#3bd16a' : '#e0362b', true);

    cellDoor(ctx, DOOR.x, DOOR.y, DOOR.w, DOOR.h, fx.door.A, { lampOn: env.st.doors.A.open, beyondLight: env.hallLit ? 1 : 0.25 });
  },

  paintFront(ctx, env) {
    const r = env.s.restraint;
    const a = env.st.prisoners.A;
    const closed = a.immobile || (!a.alive && r.dead);
    ctx.fillStyle = '#4a514c';
    ctx.strokeStyle = '#151716';
    ctx.lineWidth = 0.6;
    if (closed) {
      ctx.fillRect(181, 192.5, 8, 6);
      ctx.strokeRect(181, 192.5, 8, 6);
      ctx.fillRect(187, 216, 8, 5);
      ctx.strokeRect(187, 216, 8, 5);
      ctx.fillRect(160, 182, 6, 5);
    } else {
      ctx.save();
      ctx.translate(189, 197);
      ctx.rotate(-1.1);
      ctx.fillRect(-8, -6, 8, 3);
      ctx.restore();
      ctx.fillRect(194, 214, 6, 3);
    }
  },

  lights(env) {
    const { t } = env;
    const sources = [], glows = [];
    const pulse = 0.62 + Math.sin(t * 2.4) * 0.12;
    const red = env.dead ? 0.3 + Math.max(0, Math.sin(t * 1.3)) * 0.2 : pulse;
    sources.push({ x: RED.x + 30, y: RED.y + 40, r: 240, i: 0.78 * red });
    glows.push({ x: RED.x, y: RED.y, r: 95, color: 'rgba(255,45,30,0.5)', a: red });
    glows.push({ x: CHAIR, y: 190, r: 120, color: 'rgba(255,60,40,0.16)', a: red });
    if (env.lit) {
      sources.push({ x: 240, y: 28, r: 340, i: 0.95 * env.flicker });
      glows.push({ x: 240, y: 24, r: 55, color: 'rgba(215,255,235,0.3)', a: env.flicker });
    }
    const flash = env.st.prisoners.A.flash;
    if (flash > 0) {
      sources.push({ x: CHAIR, y: 180, r: 200, i: clamp(flash, 0, 1) });
      glows.push({ x: CHAIR, y: 182, r: 120, color: 'rgba(160,200,255,0.55)', a: clamp(flash, 0, 1) });
    }
    if (env.fx.door.A > 0.05 && env.hallLit) sources.push({ x: DOOR.x + 25, y: 160, r: 90, i: 0.5 * env.fx.door.A });
    sources.push({ x: BOX.x + 27, y: BOX.y + 23, r: 30, i: 0.3 });
    return { dark: env.lit ? 0.14 : env.dead ? 0.86 : 0.72, sources, glows };
  },
};
