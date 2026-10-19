// Shared industrial props drawn in logical room units.
import { roundRect, glow, text, MONO, SANS } from './util.js';

export function pipe(ctx, x1, y1, x2, y2, r, { color = '#4d5650', light = 'rgba(255,255,240,0.18)', dark = 'rgba(0,0,0,0.45)' } = {}) {
  const horizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1);
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 2;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const o = r * 0.45;
  ctx.lineWidth = r * 0.5;
  ctx.strokeStyle = light;
  ctx.beginPath();
  if (horizontal) { ctx.moveTo(x1, y1 - o); ctx.lineTo(x2, y2 - o); } else { ctx.moveTo(x1 - o, y1); ctx.lineTo(x2 - o, y2); }
  ctx.stroke();
  ctx.strokeStyle = dark;
  ctx.lineWidth = r * 0.6;
  ctx.beginPath();
  if (horizontal) { ctx.moveTo(x1, y1 + r * 0.7); ctx.lineTo(x2, y2 + r * 0.7); } else { ctx.moveTo(x1 + r * 0.7, y1); ctx.lineTo(x2 + r * 0.7, y2); }
  ctx.stroke();
  ctx.restore();
}

export function flange(ctx, x, y, r, vertical = true) {
  ctx.save();
  ctx.fillStyle = '#3a423d';
  if (vertical) ctx.fillRect(x - r - 2, y - 2, (r + 2) * 2, 4);
  else ctx.fillRect(x - 2, y - r - 2, 4, (r + 2) * 2);
  ctx.fillStyle = 'rgba(255,255,240,0.15)';
  if (vertical) ctx.fillRect(x - r - 2, y - 2, (r + 2) * 2, 1);
  else ctx.fillRect(x - 2, y - r - 2, 1, (r + 2) * 2);
  ctx.restore();
}

export function panel(ctx, x, y, w, h, { color = '#3f4741', edge = 'rgba(0,0,0,0.6)', rivets = true, radius = 1.5 } = {}) {
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, shade(color, 14));
  g.addColorStop(1, shade(color, -14));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = edge;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,240,0.12)';
  ctx.beginPath(); ctx.moveTo(x + 1, y + h - 1); ctx.lineTo(x + 1, y + 1); ctx.lineTo(x + w - 1, y + 1); ctx.stroke();
  if (rivets) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (const [rx, ry] of [[x + 2.5, y + 2.5], [x + w - 2.5, y + 2.5], [x + 2.5, y + h - 2.5], [x + w - 2.5, y + h - 2.5]]) {
      ctx.beginPath(); ctx.arc(rx, ry, 0.9, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

export function stripes(ctx, x, y, w, h, { a = '#c9a227', b = '#1b1b18', step = 6 } = {}) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = b; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = a;
  for (let i = -h; i < w + h; i += step * 2) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + step, y + h); ctx.lineTo(x + i + step + h, y); ctx.lineTo(x + i + h, y);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// A stencilled sign: lines of text on a plate.
export function sign(ctx, x, y, w, h, lines, { bg = '#c8c2ab', fg = '#1d1d1a', size = 5.2, stripe = false, align = 'center', font = SANS, lineGap = 1.25 } = {}) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x + 1, y + 1.2, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  let top = y;
  if (stripe) { stripes(ctx, x, y, w, 3.2); top += 3.2; }
  const lh = size * lineGap;
  const total = lines.length * lh;
  let ty = top + (y + h - top - total) / 2 + size * 0.95;
  for (const line of lines) {
    const tx = align === 'left' ? x + 3 : x + w / 2;
    text(ctx, line, tx, ty, { size, color: fg, align, font });
    ty += lh;
  }
  ctx.fillStyle = 'rgba(60,40,20,0.18)';
  ctx.fillRect(x, y + h * 0.6, w, h * 0.4);
  ctx.restore();
}

export function lamp(ctx, x, y, r, color, on, { cage = false } = {}) {
  ctx.save();
  ctx.fillStyle = '#1b1e1c';
  ctx.beginPath(); ctx.arc(x, y, r + 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = on ? color : shade(color, -75);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  if (on) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
  }
  if (cage) {
    ctx.strokeStyle = 'rgba(20,20,20,0.9)';
    ctx.lineWidth = 0.7;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * r * 0.6, y - r - 1); ctx.lineTo(x + i * r * 0.6, y + r + 1); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x - r - 1, y); ctx.lineTo(x + r + 1, y); ctx.stroke();
  }
  ctx.restore();
}

export function gauge(ctx, x, y, r, value, { zones = [[0, 0.5, '#7a2a22'], [0.5, 1, '#2f6b3a']], label = '' } = {}) {
  ctx.save();
  ctx.fillStyle = '#20231f';
  ctx.beginPath(); ctx.arc(x, y, r + 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d9d4c3';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5;
  for (const [s, e, c] of zones) {
    ctx.strokeStyle = c;
    ctx.lineWidth = r * 0.22;
    ctx.beginPath(); ctx.arc(x, y, r * 0.78, a0 + span * s, a0 + span * e); ctx.stroke();
  }
  ctx.strokeStyle = '#2a2a26';
  ctx.lineWidth = 0.4;
  for (let i = 0; i <= 10; i++) {
    const a = a0 + span * (i / 10);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62);
    ctx.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
    ctx.stroke();
  }
  const a = a0 + span * Math.min(1, Math.max(0, value));
  ctx.strokeStyle = '#b3281f';
  ctx.lineWidth = Math.max(0.7, r * 0.09);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82); ctx.stroke();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(x, y, r * 0.12, 0, Math.PI * 2); ctx.fill();
  if (label) text(ctx, label, x, y + r * 0.55, { size: r * 0.28, color: '#2a2a26', align: 'center', font: MONO });
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.55, Math.PI, Math.PI * 1.7); ctx.fill();
  ctx.restore();
}

// Ceiling fluorescent fixture.
export function fluorescent(ctx, x, y, w, on, flicker = 1) {
  ctx.save();
  ctx.fillStyle = '#2b302d';
  ctx.fillRect(x - 2, y - 3, w + 4, 5);
  ctx.strokeStyle = '#151816';
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(x + 6, y - 3); ctx.lineTo(x + 6, y - 14); ctx.moveTo(x + w - 6, y - 3); ctx.lineTo(x + w - 6, y - 14); ctx.stroke();
  ctx.fillStyle = on ? `rgba(225,240,232,${0.55 + 0.45 * flicker})` : '#4a524d';
  roundRect(ctx, x, y + 1.2, w, 3, 1.5);
  ctx.fill();
  ctx.restore();
}

export function grille(ctx, x, y, w, h, active = 0) {
  ctx.save();
  panel(ctx, x, y, w, h, { color: '#3a403b', rivets: false });
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  for (let gy = y + 2.5; gy < y + h - 1.5; gy += 2.2) ctx.fillRect(x + 2.5, gy, w - 5, 1);
  if (active > 0) {
    ctx.fillStyle = `rgba(120,255,160,${0.35 * active})`;
    ctx.beginPath(); ctx.arc(x + w - 2, y + 2, 1.1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// A cell door seen head-on in the back wall. open: 0..1 (slides right).
export function cellDoor(ctx, x, y, w, h, open, { label = '', lampOn = false, beyond = '#0b0d0c', beyondLight = 0 } = {}) {
  ctx.save();
  ctx.fillStyle = '#1a1d1b';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 3);
  ctx.fillStyle = beyond;
  ctx.fillRect(x, y, w, h);
  if (beyondLight > 0) glow(ctx, x + w / 2, y + h * 0.65, h * 0.8, `rgba(210,200,170,${0.35 * beyondLight})`);
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const dx = open * (w - 4);
  panel(ctx, x + dx, y, w, h, { color: '#4b544e' });
  ctx.fillStyle = '#121513';
  ctx.fillRect(x + dx + w * 0.3, y + h * 0.16, w * 0.4, h * 0.2);
  ctx.strokeStyle = 'rgba(160,170,160,0.35)';
  ctx.lineWidth = 0.4;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(x + dx + w * 0.3 + (w * 0.4 * i) / 4, y + h * 0.16); ctx.lineTo(x + dx + w * 0.3 + (w * 0.4 * i) / 4, y + h * 0.36); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + dx + w * 0.78, y + h * 0.5, w * 0.1, h * 0.06);
  ctx.restore();
  lamp(ctx, x + w + 6, y + h * 0.42, 1.8, lampOn ? '#3bd16a' : '#e0362b', true);
  if (label) text(ctx, label, x + w / 2, y - 6, { size: 7, color: '#c8c2ab', align: 'center' });
}

// Speech/activity ripple over a speaker grille (render cue that someone is talking).
export function speaking(ctx, x, y, t, color = 'rgba(140,255,170,0.6)') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 3; i++) {
    const k = (t * 1.6 + i / 3) % 1;
    ctx.globalAlpha = 1 - k;
    ctx.beginPath(); ctx.arc(x, y, 3 + k * 9, -0.9, 0.9); ctx.stroke();
  }
  ctx.restore();
}

// Lighten (+) or darken (-) a #rrggbb colour by an amount 0..255.
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

export { glow, text, MONO, SANS };
