// Procedural surfaces (concrete, tiles, floors) and camera-noise textures.
import { seeded, makeCanvas } from './util.js';

export function concrete(ctx, x, y, w, h, { base = '#59615b', seed = 1, ties = true, stains = 7, panelW = 96, panelH = 60 } = {}) {
  const r = seeded(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  for (let i = 0; i < 26; i++) {
    const bx = x + r() * w, by = y + r() * h, br = 18 + r() * 80;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, r() < 0.65 ? `rgba(0,0,0,${0.06 + r() * 0.08})` : `rgba(255,255,240,${0.03 + r() * 0.04})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(bx - br, by - br, br * 2, br * 2);
  }
  const n = Math.floor((w * h) / 14);
  for (let i = 0; i < n; i++) {
    const v = r();
    ctx.fillStyle = v < 0.55 ? `rgba(0,0,0,${0.05 + r() * 0.14})` : `rgba(255,255,235,${0.02 + r() * 0.07})`;
    ctx.fillRect(x + r() * w, y + r() * h, 0.5 + r() * 1.1, 0.5 + r() * 1.1);
  }
  if (ties) {
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 0.6;
    for (let px = x + panelW * 0.5; px < x + w; px += panelW) {
      ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + h); ctx.stroke();
    }
    for (let py = y + panelH; py < y + h; py += panelH) {
      ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + w, py); ctx.stroke();
    }
    for (let px = x + panelW * 0.5 - panelW * 0.25; px < x + w; px += panelW * 0.5) {
      for (let py = y + panelH * 0.5; py < y + h; py += panelH) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.arc(px, py, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,240,0.06)';
        ctx.beginPath(); ctx.arc(px + 0.5, py + 0.6, 1.4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  for (let i = 0; i < stains; i++) {
    const sx = x + r() * w, sw = 5 + r() * 26, sh = 24 + r() * h * 0.75;
    const g = ctx.createLinearGradient(0, y, 0, y + sh);
    g.addColorStop(0, `rgba(28,20,10,${0.18 + r() * 0.16})`);
    g.addColorStop(1, 'rgba(28,20,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx, y);
    ctx.lineTo(sx + sw, y);
    ctx.lineTo(sx + sw * 0.7, y + sh);
    ctx.lineTo(sx + sw * 0.25, y + sh * 0.9);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function tiles(ctx, x, y, w, h, { base = '#8c9a8f', grout = 'rgba(30,36,30,0.55)', size = 12, seed = 3 } = {}) {
  const r = seeded(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  for (let ty = y; ty < y + h; ty += size) {
    for (let tx = x; tx < x + w; tx += size) {
      const v = r();
      ctx.fillStyle = v < 0.3 ? `rgba(0,0,0,${0.05 + r() * 0.12})` : `rgba(255,255,255,${r() * 0.06})`;
      ctx.fillRect(tx, ty, size, size);
      if (r() < 0.05) {
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 0.4;
        ctx.beginPath();
        ctx.moveTo(tx + r() * size, ty);
        ctx.lineTo(tx + r() * size, ty + size);
        ctx.stroke();
      }
    }
  }
  ctx.strokeStyle = grout;
  ctx.lineWidth = 0.8;
  for (let ty = y; ty <= y + h; ty += size) { ctx.beginPath(); ctx.moveTo(x, ty); ctx.lineTo(x + w, ty); ctx.stroke(); }
  for (let tx = x; tx <= x + w; tx += size) { ctx.beginPath(); ctx.moveTo(tx, y); ctx.lineTo(tx, y + h); ctx.stroke(); }
  // Grime rising from the floor.
  const g = ctx.createLinearGradient(0, y + h, 0, y);
  g.addColorStop(0, 'rgba(40,34,20,0.55)');
  g.addColorStop(0.5, 'rgba(40,34,20,0.12)');
  g.addColorStop(1, 'rgba(40,34,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// Floor band with a little perspective: lighter at the back edge, seams converging.
export function floor(ctx, y0, y1, { base = '#3b403c', seed = 9, w = 480 } = {}) {
  const r = seeded(seed);
  ctx.save();
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, base);
  g.addColorStop(1, '#1d201e');
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, w, y1 - y0);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.08 + r() * 0.15})` : `rgba(255,255,240,${0.02 + r() * 0.05})`;
    ctx.fillRect(r() * w, y0 + r() * (y1 - y0), 0.6 + r(), 0.6 + r());
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 0.6;
  const vx = w / 2;
  for (let i = -6; i <= 6; i++) {
    const xb = vx + i * 44;
    const xf = vx + i * 70;
    ctx.beginPath(); ctx.moveTo(xb, y0); ctx.lineTo(xf, y1); ctx.stroke();
  }
  for (const t of [0.28, 0.62]) {
    const yy = y0 + (y1 - y0) * t;
    ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke();
  }
  // Skirting shadow where wall meets floor.
  const s = ctx.createLinearGradient(0, y0, 0, y0 + 10);
  s.addColorStop(0, 'rgba(0,0,0,0.45)');
  s.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = s;
  ctx.fillRect(0, y0, w, 10);
  ctx.restore();
}

// Darker side edges so a room reads as a box seen from the front.
export function roomShade(ctx, w = 480, h = 270) {
  const l = ctx.createLinearGradient(0, 0, 26, 0);
  l.addColorStop(0, 'rgba(0,0,0,0.5)');
  l.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = l;
  ctx.fillRect(0, 0, 26, h);
  const rr = ctx.createLinearGradient(w, 0, w - 26, 0);
  rr.addColorStop(0, 'rgba(0,0,0,0.5)');
  rr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rr;
  ctx.fillRect(w - 26, 0, 26, h);
}

export function ceiling(ctx, h = 18, w = 480) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#121513');
  g.addColorStop(1, '#262b28');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, h, w, 2);
}

// Camera grain tiles (presentation only; randomness here is cosmetic).
export function noiseTiles(count = 4, size = 160) {
  const tiles = [];
  for (let k = 0; k < count; k++) {
    const c = makeCanvas(size, size);
    const cx = c.getContext('2d');
    const img = cx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
}

export function scanlinePattern(ctx) {
  const c = makeCanvas(1, 3);
  const cx = c.getContext('2d');
  cx.fillStyle = 'rgba(0,0,0,1)';
  cx.fillRect(0, 2, 1, 1);
  return ctx.createPattern(c, 'repeat');
}
