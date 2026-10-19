// CAM 04 — the shared exit corridor.
import { concrete, floor, ceiling, roomShade } from '../textures.js';
import { pipe, flange, panel, lamp, fluorescent, cellDoor, stripes, text, glow } from '../draw.js';
import { MONO, SANS } from '../util.js';

const CELLS = { A: 92, B: 212, C: 332 };
const EXIT = { x: 412, y: 58, w: 60, h: 138 };

function graffiti(ctx) {
  ctx.save();
  ctx.translate(152, 126);
  ctx.rotate(-0.06);
  ctx.font = `700 13px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = 'rgba(225,220,205,0.55)';
  for (const [dx, dy] of [[0, 0], [0.6, 0.4], [-0.4, 0.5]]) {
    ctx.strokeText("DON'T TRUST", dx, dy);
    ctx.strokeText('THE VOICE', dx + 3, dy + 16);
  }
  ctx.strokeStyle = 'rgba(225,220,205,0.35)';
  ctx.beginPath(); ctx.moveTo(-36, 21); ctx.lineTo(42, 19); ctx.stroke();
  ctx.restore();
}

export const hall = {
  paintStatic(ctx) {
    ceiling(ctx);
    concrete(ctx, 0, 18, 480, 178, { base: '#535b5d', seed: 41, panelW: 120 });
    floor(ctx, 196, 270, { base: '#363b3b', seed: 42 });
    ctx.fillStyle = 'rgba(201,162,39,0.55)';
    ctx.fillRect(0, 243, 392, 2.2);
    ctx.beginPath(); ctx.moveTo(392, 239); ctx.lineTo(404, 244); ctx.lineTo(392, 249); ctx.closePath(); ctx.fill();
    pipe(ctx, 0, 26, 480, 26, 3.2);
    pipe(ctx, 0, 36, 400, 36, 1.8, { color: '#57514a' });
    for (const x of [40, 160, 280, 400]) flange(ctx, x, 26, 3.2, false);
    for (const [id, x] of Object.entries(CELLS)) text(ctx, id, x, 94, { size: 11, color: '#cfc9b2', align: 'center' });
    graffiti(ctx);
    stripes(ctx, EXIT.x - 8, EXIT.y - 8, EXIT.w + 16, 8);
    stripes(ctx, EXIT.x - 8, EXIT.y, 8, EXIT.h);
    stripes(ctx, EXIT.x + EXIT.w, EXIT.y, 8, EXIT.h);
    panel(ctx, 356, 62, 46, 64, { color: '#323935' });
    ['BOLT A', 'BOLT B', 'POWER'].forEach((l, i) => text(ctx, l, 360, 78 + i * 18, { size: 4.6, color: '#cfc9b2' }));
    panel(ctx, 362, 134, 40, 40, { color: '#2e2b27' });
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(366, 138, 32, 32);
    text(ctx, 'INCINERATOR', 382, 182, { size: 3.6, color: '#bdb7a0', align: 'center' });
    roomShade(ctx);
  },

  paintDynamic(ctx, env) {
    const { st, s, t, fx } = env;
    fluorescent(ctx, 80, 18, 64, env.lit, env.flicker);
    fluorescent(ctx, 270, 18, 64, env.lit, env.flicker2);
    lamp(ctx, 236, 46, 3, '#ff3b2f', true, { cage: true });

    for (const [id, x] of Object.entries(CELLS)) {
      cellDoor(ctx, x - 20, 100, 40, 96, fx.door[id], { lampOn: st.doors[id].open, beyond: '#101312', beyondLight: env.roomLit[id] ? 0.8 : 0.15 });
    }

    // Exit: bright beyond, a heavy door that rises.
    const open = fx.exitOpen;
    ctx.save();
    ctx.beginPath(); ctx.rect(EXIT.x, EXIT.y, EXIT.w, EXIT.h); ctx.clip();
    const g = ctx.createLinearGradient(EXIT.x, 0, EXIT.x + EXIT.w, 0);
    g.addColorStop(0, '#d9d4bf');
    g.addColorStop(1, '#fbf6e2');
    ctx.fillStyle = g;
    ctx.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    const dy = -open * (EXIT.h - 6);
    panel(ctx, EXIT.x, EXIT.y + dy, EXIT.w, EXIT.h, { color: '#4d5550' });
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 0.8;
    for (let yy = EXIT.y + dy + 14; yy < EXIT.y + dy + EXIT.h; yy += 18) { ctx.beginPath(); ctx.moveTo(EXIT.x + 4, yy); ctx.lineTo(EXIT.x + EXIT.w - 4, yy); ctx.stroke(); }
    stripes(ctx, EXIT.x, EXIT.y + dy + EXIT.h - 10, EXIT.w, 10);
    ctx.restore();

    const latched = s.exit.released;
    lamp(ctx, 396, 76, 2.6, env.boltA || latched ? '#45d16e' : '#e0362b', true);
    lamp(ctx, 396, 94, 2.6, env.boltB || latched ? '#45d16e' : '#e0362b', true);
    lamp(ctx, 396, 112, 2.6, env.exitPower ? '#45d16e' : '#e0362b', true);

    panel(ctx, 418, 32, 48, 18, { color: '#1a1d1b', rivets: false });
    if (s.exit.open) {
      const left = Math.max(0, Math.ceil(s.exit.closeAt - env.simT));
      text(ctx, `00:${String(left).padStart(2, '0')}`, 442, 46, { size: 12, color: left <= 10 && Math.sin(t * 10) > 0 ? '#ffd0c8' : '#ff4a3a', align: 'center', font: MONO });
    } else {
      text(ctx, 'EXIT', 442, 45.5, { size: 11, color: s.exit.released ? '#7a2b22' : '#4a2420', align: 'center' });
    }

    if (env.incinerator) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,140,40,${0.55 + Math.sin(t * 7) * 0.2})`;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(366, 138, 32, 32);
      ctx.strokeStyle = 'rgba(255,200,140,0.12)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        const x0 = 370 + i * 8;
        ctx.moveTo(x0, 134);
        for (let k = 0; k < 6; k++) ctx.lineTo(x0 + Math.sin(t * 4 + k + i) * 2, 134 - k * 5);
        ctx.stroke();
      }
      ctx.restore();
    }
  },

  paintFront() {},

  lights(env) {
    const { t } = env;
    const sources = [], glows = [];
    const pulse = 0.62 + Math.sin(t * 2.4 + 3) * 0.12;
    sources.push({ x: 236, y: 90, r: 250, i: 0.7 * pulse });
    glows.push({ x: 236, y: 46, r: 85, color: 'rgba(255,45,30,0.5)', a: pulse });
    if (env.lit) {
      sources.push({ x: 112, y: 26, r: 250, i: 0.9 * env.flicker });
      sources.push({ x: 302, y: 26, r: 250, i: 0.9 * env.flicker2 });
      glows.push({ x: 112, y: 22, r: 45, color: 'rgba(215,255,235,0.3)', a: env.flicker });
      glows.push({ x: 302, y: 22, r: 45, color: 'rgba(215,255,235,0.3)', a: env.flicker2 });
    }
    const open = env.fx.exitOpen;
    if (open > 0.02) {
      sources.push({ x: 442, y: 140, r: 260, i: open });
      glows.push({ x: 442, y: 140, r: 160, color: 'rgba(255,250,225,0.5)', a: open });
    }
    if (env.incinerator) {
      sources.push({ x: 382, y: 154, r: 70, i: 0.4 });
      glows.push({ x: 382, y: 154, r: 46, color: 'rgba(255,120,30,0.45)', a: 0.7 + Math.sin(t * 7) * 0.2 });
    }
    for (const [id, x] of Object.entries(CELLS)) {
      const d = env.fx.door[id];
      if (d > 0.05 && env.roomLit[id]) sources.push({ x, y: 160, r: 70, i: 0.45 * d });
    }
    if (env.alarmHere) glows.push({ x: 240, y: 40, r: 280, color: 'rgba(255,30,20,0.16)', a: Math.max(0, Math.sin(t * 5)) });
    return { dark: env.lit ? 0.18 : 0.74, sources, glows };
  },
};

export { glow };
