// Browser smoke test: serves the game, plays a full shift in headless Chromium
// through the UI and the window.__cc debug handle, and fails on any page error,
// console error, or an ending other than all three prisoners escaping.
//
// Needs Playwright (not a project dependency). Resolved from this project, or
// from the folder in PLAYWRIGHT_DIR (any folder with playwright installed).
//   npm run smoke                  # headless
//   npm run smoke -- --shots out   # also save screenshots to ./out
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.SMOKE_PORT || 5191);
const shotsArg = process.argv.indexOf('--shots');
const shotsDir = shotsArg > 0 ? resolve(process.argv[shotsArg + 1] || 'smoke-shots') : null;

function loadPlaywright() {
  const bases = [root, process.env.PLAYWRIGHT_DIR].filter(Boolean);
  for (const base of bases) {
    try { return createRequire(resolve(base) + '/')('playwright'); } catch { /* try next */ }
  }
  console.error('Playwright not found. Install it (npm i -D playwright && npx playwright install chromium)\n' +
    'or set PLAYWRIGHT_DIR to a folder where it is installed.');
  process.exit(2);
}

async function waitForServer(url, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error(`server did not start at ${url}`);
}

const { chromium } = loadPlaywright();
const server = spawn(process.execPath, ['serve.js'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
const url = `http://localhost:${port}/?seed=7`;
let browser;
let failed = false;

try {
  await waitForServer(url);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 657 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
  if (shotsDir) mkdirSync(shotsDir, { recursive: true });
  const shot = async name => { if (shotsDir) await page.screenshot({ path: `${shotsDir}/${name}.png` }); };
  const step = async (name, fn) => {
    try { await page.evaluate(fn); } catch (e) { throw new Error(`${name}: ${e.message.split('\n')[0]}`); }
    await page.waitForTimeout(150);
    await shot(name);
    console.log(`  ok  ${name}`);
  };

  await page.goto(url);
  await page.click('#btnBegin');
  await page.waitForTimeout(1500);
  await shot('00-boot');

  // Sim-time helpers: advance the fixed-step game directly instead of waiting in real time.
  await page.evaluate(() => {
    const cc = window.__cc;
    window.__t = {
      say(pid, opt) {
        const g = cc.game, p = g.state.prisoners[pid];
        let n = 0; while (g.state.t < p.talkLock && n++ < 600) g.advance(0.05);
        const r = g.dispatch({ type: 'say', pid, option: opt }); g.advance(0.7);
        if (!r.ok) throw new Error(`${pid}/${opt}: ${r.msg}`);
      },
      idle(pid) { const g = cc.game; let n = 0; while (g.state.prisoners[pid].task && n++ < 4000) g.advance(0.05); },
      until(fn, max = 200) { const g = cc.game; let n = 0; while (!fn(g) && n++ < max * 20) g.advance(0.05); if (!fn(g)) throw new Error('timed out waiting'); },
      power(c, on) { const r = cc.game.dispatch({ type: 'power', circuit: c, on }); if (!r.ok) throw new Error(`power ${c}: ${r.msg}`); },
      ctl(id, payload) { const r = cc.game.dispatch({ type: 'control', id, payload }); if (!r.ok) throw new Error(`${id}: ${r.msg}`); },
    };
  });

  await step('01-lights-a', () => {
    __t.say('C', 'c-calm'); __t.say('C', 'c-look'); __t.say('A', 'a-calm'); __t.say('A', 'a-plate');
    __t.say('C', 'c-iso-lightsA'); __t.idle('C'); __t.power('lightsA', true); __cc.game.advance(2.5);
    __cc.app.focusFeed('A');
  });
  await page.click('[data-control="restraint"] .act');
  await step('02-keypad', () => {
    const code = __cc.game.state.s.code;
    for (const symbol of code) __t.ctl('restraint', { action: 'key', symbol });
    __t.ctl('restraint', { action: 'submit' }); __cc.game.advance(1.5);
    if (!__cc.game.state.s.restraint?.released && __cc.game.state.prisoners.A.immobile) throw new Error('Nadia still restrained');
  });
  await page.keyboard.press('Escape');
  await step('03-aux-and-bolt', () => {
    __t.say('A', 'a-look'); __t.say('A', 'a-lever'); __t.idle('A'); __t.say('A', 'a-crank'); __t.idle('A');
    __cc.app.focusFeed('B'); __cc.app.inspect('b-plaque');
  });
  await page.keyboard.press('Escape');
  await step('04-flood', () => {
    __t.say('B', 'b-calm'); __t.say('B', 'b-sign'); __t.say('C', 'c-iso-pump'); __t.idle('C');
    __t.power('incinerator', false); __t.power('pump', true); __t.power('lightsA', false); __t.power('vent', true);
    __t.ctl('drain'); __cc.game.advance(20);
    if (!__cc.game.state.s.flood || __cc.game.state.s.flood.phase === 'done') throw new Error('flood did not start');
  });
  await step('05-drained', () => {
    __t.say('B', 'b-intake'); __t.until(g => g.state.s.flood.intake === 'leaking');
    __t.say('C', 'c-damper'); __t.until(g => g.state.s.flood.damper);
    __t.ctl('relief'); __t.until(g => g.state.s.flood.phase === 'done');
    if (!__cc.game.state.prisoners.B.alive) throw new Error('Theo drowned');
  });
  await step('06-exit-open', () => {
    __t.until(g => g.state.s.know.plate); __t.say('B', 'b-plate');
    __t.until(g => { const t = g.state.prisoners.B.task; return t && t.steps[t.i].k === 'hold'; });
    __t.say('C', 'c-iso-exit'); __t.idle('C');
    __t.power('pump', false); __t.power('vent', false); __t.power('exit', true);
    __t.say('C', 'c-release'); __t.until(g => g.state.s.exit.open);
    __cc.app.focusFeed('hall');
  });
  await step('07-escape', () => {
    // The Voice's lie makes stressed prisoners hesitate; the calm slot becomes "GO!".
    __t.until(g => {
      for (const id of ['A', 'B', 'C']) {
        const p = g.state.prisoners[id];
        if (p.hesitating && g.state.t >= p.talkLock) g.dispatch({ type: 'say', pid: id, option: `${id.toLowerCase()}-calm` });
      }
      return g.state.over;
    }, 120);
  });
  await page.waitForTimeout(1500);
  await shot('08-ending');

  const result = await page.evaluate(() => {
    const ps = Object.values(__cc.game.state.prisoners);
    return { over: !!__cc.game.state.over, escaped: ps.filter(p => p.escaped).map(p => p.name) };
  });
  const reportShown = await page.locator('text=SHIFT REPORT').first().isVisible().catch(() => false);
  if (!result.over) throw new Error('game did not end');
  if (result.escaped.length !== 3) throw new Error(`expected 3 escaped, got: ${result.escaped.join(', ') || 'none'}`);
  if (!reportShown) throw new Error('shift report not visible');
  if (errors.length) throw new Error(`browser errors:\n${errors.join('\n')}`);
  console.log(`PASS — all three escaped (${result.escaped.join(', ')}), no browser errors`);
} catch (e) {
  failed = true;
  console.error(`FAIL — ${e.message}`);
} finally {
  await browser?.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
