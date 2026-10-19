// Minimal DOM helpers.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

const FILL = { red: '#d8402f', blue: '#3d74d6', yellow: '#e2c234' };
const NS = 'http://www.w3.org/2000/svg';

export function symbolSvg(sym) {
  const [color, shape] = sym.split('-');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('aria-hidden', 'true');
  let el;
  if (shape === 'circle') {
    el = document.createElementNS(NS, 'circle');
    el.setAttribute('cx', '20'); el.setAttribute('cy', '20'); el.setAttribute('r', '15');
  } else if (shape === 'square') {
    el = document.createElementNS(NS, 'rect');
    el.setAttribute('x', '6'); el.setAttribute('y', '6'); el.setAttribute('width', '28'); el.setAttribute('height', '28'); el.setAttribute('rx', '2');
  } else {
    el = document.createElementNS(NS, 'polygon');
    el.setAttribute('points', '20,4 37,35 3,35');
  }
  el.setAttribute('fill', FILL[color]);
  el.setAttribute('stroke', 'rgba(0,0,0,0.6)');
  el.setAttribute('stroke-width', '2');
  svg.append(el);
  return svg;
}

export const symbolLabel = sym => sym.replace('-', ' ').toUpperCase();

export function fmtClock(secs) {
  const s = Math.floor(secs);
  return `${String(Math.floor(s / 3600) % 24).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function setText(el, value) {
  if (el.textContent !== value) el.textContent = value;
}

export function setClass(el, cls, on) {
  if (el.classList.contains(cls) !== !!on) el.classList.toggle(cls, !!on);
}
