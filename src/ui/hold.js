// Action buttons that either fire on click, or — when isHold() is true —
// need to be held down for seconds() to confirm. Mouse, touch and keyboard.
export function actionButton(button, { isHold, seconds, onFire }) {
  let start = 0, raf = 0, holding = false;

  const reset = () => {
    holding = false;
    cancelAnimationFrame(raf);
    button.style.setProperty('--p', '0');
    button.classList.remove('holding');
  };

  const tick = () => {
    if (!holding) return;
    const p = Math.min(1, (performance.now() - start) / (seconds() * 1000));
    button.style.setProperty('--p', String(p));
    if (p >= 1) { reset(); onFire(); return; }
    raf = requestAnimationFrame(tick);
  };

  const begin = () => {
    if (holding) return;
    holding = true;
    start = performance.now();
    button.classList.add('holding');
    raf = requestAnimationFrame(tick);
  };

  button.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !isHold()) return;
    e.preventDefault();
    button.setPointerCapture?.(e.pointerId);
    begin();
  });
  button.addEventListener('pointerup', reset);
  button.addEventListener('pointercancel', reset);
  button.addEventListener('lostpointercapture', reset);
  button.addEventListener('contextmenu', e => { if (isHold()) e.preventDefault(); });
  button.addEventListener('keydown', e => {
    if ((e.key === ' ' || e.key === 'Enter') && isHold()) {
      e.preventDefault();
      if (!e.repeat) begin();
    }
  });
  button.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') reset(); });
  button.addEventListener('click', e => {
    if (isHold()) { e.preventDefault(); return; }
    onFire();
  });
  button.style.touchAction = 'none';
  return reset;
}
