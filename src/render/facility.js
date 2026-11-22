// Procedural room effects, driven only by the slice-1 facility contract.
import { FACILITY, ROOM_W, ROOM_H } from '../config.js';
import { clamp, text, MONO, glow } from './util.js';

export function writing(ctx, room, env) {
  const key = room === 'A' ? 'warmWriting' : room === 'B' ? 'irWriting' : null;
  if (!key || !env.st.facility.secrets[key] || (room === 'B' && env.lit)) return;
  const secret = env.st.facility.definition.secrets.find(s => s.id === key);
  if (!secret) return;
  const message = secret.text.slice(secret.text.indexOf(':') + 1).trim();
  const words = message.split(' '), lines = [''];
  for (const word of words) {
    if ((lines[lines.length - 1] + word).length > (room === 'A' ? 34 : 28)) lines.push('');
    lines[lines.length - 1] += `${lines[lines.length - 1] ? ' ' : ''}${word}`;
  }
  ctx.save();
  ctx.translate(room === 'A' ? 226 : 267, room === 'A' ? 169 : 151);
  ctx.rotate(-0.035);
  const alpha = room === 'A' ? clamp(0.65 + (env.room.temperature - FACILITY.secretWarm) / 12, 0.65, 1) : 1;
  // A dark stain around the pale pigment preserves lettering in both lamp
  // light and the camera's IR return, including at the unzoomed main-feed size.
  ctx.font = `700 8px ${MONO}`;
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = `rgba(25,23,18,${alpha * 0.9})`;
  lines.forEach((line, i) => {
    ctx.strokeText(line, 0, i * 11);
    text(ctx, line, 0, i * 11, {
      size: 8, font: MONO, color: room === 'A' && env.lit ? '#ead7ae' : '#dcebd4', alpha,
    });
  });
  ctx.restore();
}

export function atmosphere(ctx, room, env) {
  const { temperature, smoke } = env.room;
  const t = env.simT;
  ctx.save();
  // Steam seeps from the overhead distribution pipe only while heat is supplied.
  if (env.incinerator && env.st.facility.steamHeat === room) {
    for (let i = 0; i < 6; i++) {
      const age = (t * 0.31 + i / 6) % 1;
      const x = 150 + i * 39 + Math.sin(t * 0.6 + i) * age * 15;
      const y = 34 + age * 80;
      const r = 4 + age * 19;
      glow(ctx, x, y, r, `rgba(210,220,215,${(1 - age) * 0.13})`);
    }
  }
  if (temperature > FACILITY.heat.uneasy) {
    const intensity = clamp((temperature - FACILITY.heat.uneasy) / (FACILITY.heat.dangerous - FACILITY.heat.uneasy), 0, 1);
    ctx.strokeStyle = `rgba(230,225,198,${0.23 * intensity})`;
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 10; i++) {
      const x = 28 + i * 47;
      ctx.beginPath();
      for (let y = 45; y < 220; y += 9) {
        const dx = Math.sin(y * 0.06 + t * 3 + i) * 4 * intensity;
        if (y === 45) ctx.moveTo(x + dx, y); else ctx.lineTo(x + dx, y);
      }
      ctx.stroke();
    }
  }
  if (smoke > 0.005) {
    // Broad cheap gradient banks obscure people and mechanisms as smoke rises.
    ctx.fillStyle = `rgba(145,151,139,${smoke * 0.42})`;
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);
    for (let i = 0; i < 7; i++) {
      const x = ((i * 91 + t * (3 + i % 3)) % 670) - 90;
      const y = 37 + i * 25 + Math.sin(t * 0.4 + i) * 13;
      const r = 105 + i * 4;
      // IR backscatter is pale as well: darkness must not make smoke vanish.
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1.65, 0.48);
      glow(ctx, 0, 0, r, `rgba(200,204,185,${smoke * 0.55})`);
      ctx.restore();
    }
    const ceiling = ctx.createLinearGradient(0, 0, 0, ROOM_H);
    ceiling.addColorStop(0, `rgba(173,179,161,${smoke * 0.55})`);
    ceiling.addColorStop(0.6, `rgba(116,125,111,${smoke * 0.2})`);
    ceiling.addColorStop(1, 'rgba(116,125,111,0)');
    ctx.fillStyle = ceiling;
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);
  }
  ctx.restore();
}

export function electrical(ctx, env) {
  const burst = env.fx.sparks.B;
  const flash = env.fx.flash.B;
  if (burst <= 0 && flash <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, 286, 112, 150, `rgba(135,190,255,${Math.min(0.45, burst * 0.45 + flash * 0.3)})`);
  ctx.lineCap = 'round';
  const t = env.simT;
  for (let i = 0; i < 10 && burst > 0; i++) {
    const angle = i * 2.4 + t * 18;
    const length = (12 + ((i * 17) % 34)) * Math.min(1, burst * 2);
    ctx.strokeStyle = i % 3 === 0 ? '#ffe4a2' : '#c4e5ff';
    ctx.lineWidth = i % 3 === 0 ? 1.25 : 0.6;
    ctx.beginPath(); ctx.moveTo(286, 112);
    ctx.lineTo(286 + Math.cos(angle) * length * 0.4, 112 + Math.sin(angle) * length * 0.4);
    ctx.lineTo(286 + Math.cos(angle + 0.28) * length, 112 + Math.sin(angle + 0.28) * length + length * 0.2);
    ctx.stroke();
  }
  if (flash > 0) {
    ctx.fillStyle = `rgba(150,205,255,${flash * 0.12})`;
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);
  }
  ctx.restore();
}
