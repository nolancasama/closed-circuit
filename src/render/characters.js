// Prisoners drawn as simple jointed figures. Origin is the feet; units are room units.
import { FLOOD } from '../config.js';
import { glow } from './util.js';

const LOOKS = {
  A: { skin: '#b88a6a', hair: '#1d1613', top: '#a7a59a', pants: '#30323a', shoes: '#151515', scale: 1, hairStyle: 'bob' },
  B: { skin: '#d3ab8a', hair: '#7c5e36', top: '#2b3a57', pants: '#4d5157', shoes: '#222222', scale: 1.05, hairStyle: 'messy', hood: true },
  C: { skin: '#6c4733', hair: '#a19f99', top: '#5c5f3e', pants: '#5c5f3e', shoes: '#2b2420', scale: 0.95, hairStyle: 'bun' },
};

const DIM = { headR: 7, shoulder: 25, hipH: 36, thigh: 18, shin: 18, upper: 14, fore: 13 };

function stand(t, seed) {
  const b = Math.sin(t * 2.1 + seed) * 0.5;
  return {
    hipY: -DIM.hipH, lean: 0.03, bob: b * 0.4, shake: 0,
    legs: [{ a: 0.05, k: 0 }, { a: -0.06, k: 0 }],
    arms: [{ a: 0.1 + b * 0.02, e: 0.18 }, { a: -0.08, e: 0.22 }],
    head: { tilt: 0, back: false },
  };
}

function walk(t, run = false, slow = false) {
  const ph = t * (run ? 11 : slow ? 4.5 : 7.5);
  const s = Math.sin(ph);
  const amp = run ? 0.75 : slow ? 0.25 : 0.45;
  return {
    hipY: -DIM.hipH + Math.abs(Math.cos(ph)) * (run ? 2 : 1) - (run ? 2.5 : 1),
    lean: run ? 0.2 : 0.06, bob: 0, shake: 0,
    legs: [{ a: amp * s, k: -Math.max(0, -Math.cos(ph)) * (run ? 1.1 : 0.55) }, { a: -amp * s, k: -Math.max(0, Math.cos(ph)) * (run ? 1.1 : 0.55) }],
    arms: [{ a: -amp * 0.9 * s, e: run ? 1.3 : 0.35 }, { a: amp * 0.9 * s, e: run ? 1.3 : 0.35 }],
    head: { tilt: run ? 0.1 : 0, back: false },
  };
}

function seated(t, seed, mode) {
  const b = Math.sin(t * 2.1 + seed) * 0.5;
  const pose = {
    hipY: -21, lean: 0.02, bob: b * 0.3, shake: 0, seated: true,
    legs: [{ a: 1.5, k: -1.5 }, { a: 1.45, k: -1.45 }],
    arms: [{ a: 0.32, e: 1.2 }, { a: 0.28, e: 1.25 }],
    head: { tilt: 0, back: false },
  };
  if (mode === 'struggle' || mode === 'panic') {
    const j = Math.sin(t * (mode === 'panic' ? 23 : 17));
    pose.lean = 0.05 + j * 0.08;
    pose.arms[0].a += j * 0.1;
    pose.arms[1].a -= j * 0.1;
    pose.head.tilt = mode === 'panic' ? -0.2 + j * 0.15 : j * 0.1;
    pose.shake = mode === 'panic' ? 0.6 : 0.25;
  } else if (mode === 'lookDown') {
    pose.head.tilt = 0.55;
    pose.lean = 0.12;
  } else if (mode === 'slumped') {
    pose.head.tilt = 0.95;
    pose.lean = 0.32;
    pose.bob = 0;
  } else if (mode === 'listen') {
    pose.head.tilt = -0.3;
  }
  return pose;
}

function operate(t, anim, prog) {
  const pose = stand(t, 0);
  switch (anim) {
    case 'lever': {
      const pull = Math.min(1, prog * 1.2);
      pose.arms = [{ a: 2.2 - pull * 1.4, e: 0.2 }, { a: 2.1 - pull * 1.4, e: 0.3 }];
      pose.lean = -0.08 - Math.sin(t * 5) * 0.05;
      pose.legs = [{ a: 0.2, k: -0.15 }, { a: -0.25, k: 0 }];
      break;
    }
    case 'crank':
    case 'valve': {
      const c = t * 4.5;
      pose.arms = [{ a: 1.35 + Math.sin(c) * 0.28, e: 0.55 + Math.cos(c) * 0.35 }, { a: 1.3 - Math.sin(c) * 0.28, e: 0.55 - Math.cos(c) * 0.35 }];
      pose.lean = 0.12;
      pose.legs = [{ a: 0.25, k: -0.2 }, { a: -0.2, k: 0 }];
      break;
    }
    case 'switch':
    case 'breaker': {
      const jerk = (Math.sin(t * 6) > 0.6 ? 0.18 : 0);
      pose.arms = [{ a: 2.25 - jerk, e: 0.25 }, { a: 0.1, e: 0.3 }];
      pose.head.tilt = -0.2;
      break;
    }
    case 'release': {
      pose.arms = [{ a: 2.8 - prog * 1.3, e: 0.15 }, { a: 2.75 - prog * 1.3, e: 0.2 }];
      pose.lean = -0.1;
      pose.head.tilt = -0.15;
      break;
    }
    case 'step':
      pose.legs = [{ a: 0.35 * (1 - prog), k: -0.3 * (1 - prog) }, { a: -0.05, k: 0 }];
      break;
    default:
      pose.arms = [{ a: 1.2, e: 0.5 }, { a: 1.1, e: 0.5 }];
  }
  return pose;
}

function cower(t) {
  const j = Math.sin(t * 24) * 0.04;
  return {
    hipY: -19, lean: 0.55, bob: 0, shake: 0.5,
    legs: [{ a: 1.35, k: -2.3 }, { a: 1.2, k: -2.2 }],
    arms: [{ a: 2.5 + j, e: 2.0 }, { a: 2.35 - j, e: 2.1 }],
    head: { tilt: 0.55, back: false },
  };
}

function swim(t) {
  const c = t * 3.2;
  return {
    hipY: -DIM.hipH, lean: 0.05, bob: Math.sin(c * 0.7) * 1.4, shake: 0,
    legs: [{ a: 0.35 * Math.sin(c), k: -0.3 }, { a: -0.35 * Math.sin(c), k: -0.3 }],
    arms: [{ a: 1.4 + Math.sin(c) * 0.5, e: 0.5 }, { a: 1.3 - Math.sin(c) * 0.5, e: 0.5 }],
    head: { tilt: -0.25, back: false },
  };
}

// Work out what a prisoner is doing visually from sim state.
export function poseOf(p, s, t) {
  const seed = p.id.charCodeAt(0);
  const m = p.micro?.kind;
  const step = p.task?.steps[p.task.i];
  if (p.immobile || (!p.alive && p.id === 'A' && p.lostCause === 'chair')) {
    if (!p.alive) return seated(t, seed, 'slumped');
    if (p.panicked) return seated(t, seed, 'panic');
    if (m === 'struggle') return seated(t, seed, 'struggle');
    if (m === 'lookDown') return seated(t, seed, 'lookDown');
    if (p.fsm === 'listening') return seated(t, seed, 'listen');
    const pose = seated(t, seed);
    if (m === 'look') pose.head.back = true;
    return pose;
  }
  if (p.id === 'B' && p.loc === 'B' && s.flood.level >= FLOOD.swimAbove && s.flood.phase !== 'idle') return swim(t);
  if (step?.k === 'goto' && !p.blocked) return walk(p.animT, p.task.kind === 'escape');
  if (step?.k === 'op') {
    const prog = step.dur ? Math.min(1, p.task.opT / step.dur) : 0;
    return operate(t, step.anim, prog);
  }
  if (p.panicked || p.hesitating || m === 'cower') return cower(t);
  if (m === 'shift' && p.micro.tx != null && Math.abs(p.micro.tx - p.x) > 0.6) return walk(t, false, true);
  const pose = stand(t, seed);
  if (m === 'look') pose.head.back = true;
  if (m === 'fidget') {
    const r = Math.sin(t * 7) * 0.15;
    pose.arms = [{ a: 0.55, e: 1.7 + r }, { a: 0.5, e: 1.75 - r }];
    pose.head.tilt = 0.2;
  }
  if (m === 'tug') {
    pose.lean = -0.12;
    pose.legs = [{ a: 0.45 + Math.sin(t * 9) * 0.12, k: -0.3 }, { a: -0.1, k: 0 }];
    pose.head.tilt = 0.4;
  }
  if (m === 'shake') pose.shake = 0.5;
  if (p.fsm === 'listening') pose.head.tilt = -0.28;
  if (p.stress > 60) pose.shake = Math.max(pose.shake, (p.stress - 60) / 80);
  return pose;
}

function limb(ctx, x0, y0, a1, l1, a2rel, l2, f, w1, w2, color) {
  const x1 = x0 + Math.sin(a1) * l1 * f;
  const y1 = y0 + Math.cos(a1) * l1;
  const a2 = a1 + a2rel;
  const x2 = x1 + Math.sin(a2) * l2 * f;
  const y2 = y1 + Math.cos(a2) * l2;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = w1;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.lineWidth = w2;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  return { x1, y1, x2, y2, a2 };
}

function darker(hex, k = 0.72) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round((n >> 16) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}

function hair(ctx, look, hx, hy, r, face) {
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  switch (look.hairStyle) {
    case 'bob':
      ctx.arc(hx - face * 0.6, hy - 0.8, r + 1.2, Math.PI * 0.95, Math.PI * 2.08);
      ctx.lineTo(hx - face * (r + 0.5), hy + r * 0.9);
      ctx.lineTo(hx - face * (r - 3), hy + r * 0.85);
      ctx.closePath();
      break;
    case 'messy':
      ctx.arc(hx - face * 0.4, hy - 1, r + 0.8, Math.PI * 1.0, Math.PI * 2.0);
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (1.05 + i * 0.22);
        ctx.lineTo(hx + Math.cos(a) * (r + 2.6), hy - 1 + Math.sin(a) * (r + 2.6));
        ctx.lineTo(hx + Math.cos(a + 0.11) * (r + 0.6), hy - 1 + Math.sin(a + 0.11) * (r + 0.6));
      }
      ctx.closePath();
      break;
    default: // bun
      ctx.arc(hx - face * 0.5, hy - 0.6, r + 0.7, Math.PI * 0.98, Math.PI * 2.02);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx - face * (r + 1.2), hy - 2.5, 3, 0, Math.PI * 2);
  }
  ctx.fill();
}

// Draw a prisoner. env: { underwater: y of water surface or null }
export function drawPrisoner(ctx, p, s, t, x, feetY) {
  const look = LOOKS[p.id];
  const pose = poseOf(p, s, t);
  const sc = look.scale;
  const f = p.facing >= 0 ? 1 : -1;
  ctx.save();
  const jx = pose.shake ? Math.sin(t * 61 + x) * pose.shake : 0;
  ctx.translate(x + jx, feetY + pose.bob);
  ctx.scale(sc, sc);

  if (!pose.seated) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 0.5, 13, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (p.flash > 0) glow(ctx, 0, -40, 60, `rgba(170,210,255,${0.55 * Math.min(1, p.flash)})`);

  const hip = { x: 0, y: pose.hipY };
  const sh = { x: hip.x + Math.sin(pose.lean) * DIM.shoulder * f, y: hip.y - Math.cos(pose.lean) * DIM.shoulder };
  const farLegC = darker(look.pants), farArmC = darker(look.top);

  // Far arm, far leg.
  const fa = limb(ctx, sh.x - f * 2, sh.y + 1, pose.arms[1].a, DIM.upper, pose.arms[1].e, DIM.fore, f, 4.4, 4, farArmC);
  ctx.fillStyle = darker(look.skin);
  ctx.beginPath(); ctx.arc(fa.x2, fa.y2, 2.1, 0, Math.PI * 2); ctx.fill();
  const fl = limb(ctx, hip.x - f * 1.5, hip.y, pose.legs[1].a, DIM.thigh, pose.legs[1].k, DIM.shin, f, 6, 5, farLegC);
  ctx.fillStyle = darker(look.shoes);
  ctx.beginPath(); ctx.ellipse(fl.x2 + f * 2, fl.y2 - 1, 4, 2, 0, 0, Math.PI * 2); ctx.fill();

  // Torso.
  const tw = 7.5;
  ctx.fillStyle = look.top;
  ctx.beginPath();
  ctx.moveTo(sh.x - tw, sh.y);
  ctx.lineTo(sh.x + tw, sh.y);
  ctx.lineTo(hip.x + tw - 0.5, hip.y + 2);
  ctx.lineTo(hip.x - tw + 0.5, hip.y + 2);
  ctx.closePath();
  ctx.fill();
  const tg = ctx.createLinearGradient(sh.x - tw, 0, sh.x + tw, 0);
  tg.addColorStop(0, f > 0 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.08)');
  tg.addColorStop(1, f > 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.25)');
  ctx.fillStyle = tg;
  ctx.fill();
  if (look.hood) {
    ctx.fillStyle = darker(look.top, 0.85);
    ctx.beginPath(); ctx.ellipse(sh.x - f * 4, sh.y - 1, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (p.id === 'C') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(sh.x - 4, sh.y + 3, 8, 7);
  }

  // Near leg.
  const nl = limb(ctx, hip.x + f * 1.5, hip.y, pose.legs[0].a, DIM.thigh, pose.legs[0].k, DIM.shin, f, 6.4, 5.4, look.pants);
  ctx.fillStyle = look.shoes;
  ctx.beginPath(); ctx.ellipse(nl.x2 + f * 2, nl.y2 - 1, 4.2, 2.1, 0, 0, Math.PI * 2); ctx.fill();

  // Neck and head.
  const hx = sh.x + Math.sin(pose.lean + pose.head.tilt * 0.4) * 9 * f;
  const hy = sh.y - 9 + Math.max(0, pose.head.tilt) * 2.5;
  ctx.strokeStyle = look.skin;
  ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(hx, hy + 4); ctx.stroke();
  const face = pose.head.back ? -f : f;
  ctx.fillStyle = look.skin;
  ctx.beginPath(); ctx.arc(hx, hy, DIM.headR, 0, Math.PI * 2); ctx.fill();
  const nose = Math.max(-0.6, Math.min(0.8, pose.head.tilt));
  ctx.beginPath();
  ctx.moveTo(hx + face * 6.4, hy - 1 + nose * 2);
  ctx.lineTo(hx + face * 8.4, hy + 1 + nose * 3);
  ctx.lineTo(hx + face * 6.2, hy + 2 + nose * 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.beginPath(); ctx.arc(hx + face * 3.6, hy - 1 + nose * 2.2, 0.85, 0, Math.PI * 2); ctx.fill();
  const shadeG = ctx.createLinearGradient(hx - 7, 0, hx + 7, 0);
  shadeG.addColorStop(0, face > 0 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0)');
  shadeG.addColorStop(1, face > 0 ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.3)');
  ctx.fillStyle = shadeG;
  ctx.beginPath(); ctx.arc(hx, hy, DIM.headR, 0, Math.PI * 2); ctx.fill();
  hair(ctx, look, hx, hy, DIM.headR, face);

  // Near arm on top.
  const na = limb(ctx, sh.x + f * 2, sh.y + 1, pose.arms[0].a, DIM.upper, pose.arms[0].e, DIM.fore, f, 4.6, 4.2, look.top);
  ctx.fillStyle = look.skin;
  ctx.beginPath(); ctx.arc(na.x2, na.y2, 2.2, 0, Math.PI * 2); ctx.fill();

  if (p.flash > 0) {
    ctx.strokeStyle = `rgba(200,230,255,${Math.min(1, p.flash)})`;
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      let ax = (Math.sin(t * 50 + i) * 10), ay = -10 - i * 12;
      ctx.moveTo(ax, ay);
      for (let k = 0; k < 4; k++) { ax += Math.sin(t * 90 + i * 3 + k) * 6; ay -= 4; ctx.lineTo(ax, ay); }
      ctx.stroke();
    }
  }
  ctx.restore();
  return { hx: x + (hx * sc), hy: feetY + hy * sc, footX: x + nl.x2 * sc * 1, footY: feetY + nl.y2 * sc, hands: [{ x: x + na.x2 * sc, y: feetY + na.y2 * sc }] };
}
