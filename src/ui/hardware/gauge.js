// Analog panel gauge: SVG dial, coloured range arcs, an eased needle and an
// optional secondary "drag" pointer. Knows nothing about the game.
//
//   const g = createGauge({ title: 'AMPS', min: 0, max: 15, major: 5, minor: 1,
//                           zones: [{ from: 10, to: 15, tone: 'red' }] });
//   g.set(value, { pointer, readout, tone });   // every frame
const NS = 'http://www.w3.org/2000/svg';
const SWEEP = 100;               // degrees either side of straight up
const CX = 60, CY = 60, R = 46;

const svg = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};
const pt = (a, r) => [CX + r * Math.sin(a * Math.PI / 180), CY - r * Math.cos(a * Math.PI / 180)];
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function createGauge({ title, unit = '', min = 0, max = 100, major = 10, minor = 0, labels = null, zones = [], legends = [] }) {
  const ang = v => -SWEEP + ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * SWEEP * 2;
  const dial = svg('svg', { viewBox: '0 0 120 84', class: 'gauge-dial', 'aria-hidden': 'true' });
  dial.append(svg('rect', { x: 2, y: 2, width: 116, height: 80, rx: 4, class: 'g-face' }));
  for (const z of zones) {
    const [x1, y1] = pt(ang(z.from), R - 3), [x2, y2] = pt(ang(z.to), R - 3);
    const large = ang(z.to) - ang(z.from) > 180 ? 1 : 0;
    dial.append(svg('path', { d: `M${x1} ${y1} A${R - 3} ${R - 3} 0 ${large} 1 ${x2} ${y2}`, class: `g-zone g-${z.tone}` }));
  }
  const step = minor || major;
  for (let v = min; v <= max + 1e-6; v += step) {
    const isMajor = Math.abs(((v - min) / major) - Math.round((v - min) / major)) < 1e-6;
    const [x1, y1] = pt(ang(v), R + (isMajor ? 4 : 2)), [x2, y2] = pt(ang(v), R - (isMajor ? 4 : 1));
    dial.append(svg('line', { x1, y1, x2, y2, class: isMajor ? 'g-tick major' : 'g-tick' }));
    if (isMajor) {
      const [tx, ty] = pt(ang(v), R - 12);
      const t = svg('text', { x: tx, y: ty + 3, class: 'g-num' });
      t.textContent = labels ? (labels[v] ?? '') : String(Math.round(v));
      dial.append(t);
    }
  }
  for (const l of legends) {
    const [tx, ty] = pt(ang(l.at), R - 22);
    const t = svg('text', { x: tx, y: ty + 2, class: `g-legend g-${l.tone || 'dim'}` });
    t.textContent = l.text;
    dial.append(t);
  }
  const unitText = svg('text', { x: CX, y: CY + 16, class: 'g-unit' });
  unitText.textContent = unit;
  dial.append(unitText);
  const drag = svg('polygon', { points: `${CX},${CY - R - 7} ${CX - 3.5},${CY - R - 13} ${CX + 3.5},${CY - R - 13}`, class: 'g-drag' });
  const needle = svg('g', { class: 'g-needle' });
  needle.append(svg('polygon', { points: `${CX - 1.6},${CY + 8} ${CX + 1.6},${CY + 8} ${CX + 0.5},${CY - R + 2} ${CX - 0.5},${CY - R + 2}` }));
  dial.append(drag, needle, svg('circle', { cx: CX, cy: CY, r: 5, class: 'g-hub' }), svg('circle', { cx: CX, cy: CY, r: 1.6, class: 'g-hub-dot' }));

  const readout = document.createElement('div');
  readout.className = 'gauge-read';
  const cap = document.createElement('div');
  cap.className = 'plate gauge-title';
  cap.textContent = title;
  const el = document.createElement('div');
  el.className = 'gauge';
  el.append(cap, dial, readout);

  let cur = null, velocity = 0, last = performance.now(), dragOn = null, txt = '', tone = '';
  return {
    el,
    // value: needle target; pointer: optional drag-pointer value (null hides it).
    set(value, { pointer = null, readout: text = '', tone: t = '' } = {}) {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const target = ang(value);
      if (cur == null || reduced()) { cur = target; velocity = 0; }
      else {
        // A lightly underdamped needle gives a small mechanical overshoot.
        // Substeps keep the spring stable after a slow browser frame.
        const steps = Math.max(1, Math.ceil(dt / 0.016));
        const step = dt / steps;
        for (let i = 0; i < steps; i++) {
          velocity += ((target - cur) * 170 - velocity * 21) * step;
          cur += velocity * step;
        }
      }
      needle.setAttribute('transform', `rotate(${cur.toFixed(2)} ${CX} ${CY})`);
      const show = pointer != null;
      if (show !== dragOn) { drag.style.display = show ? '' : 'none'; dragOn = show; }
      if (show) drag.setAttribute('transform', `rotate(${ang(pointer).toFixed(2)} ${CX} ${CY})`);
      if (text !== txt) { readout.textContent = text; txt = text; }
      if (t !== tone) { readout.className = `gauge-read${t ? ` tone-${t}` : ''}`; tone = t; }
    },
  };
}
