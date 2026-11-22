// Browser smoke test: serves the game, plays a full shift in headless Chromium
// through the UI and the window.__cc debug handle, and fails on any page error,
// console error, or an ending other than all three prisoners escaping.
//
// Needs Playwright (not a project dependency). Resolved from this project, or
// from the folder in PLAYWRIGHT_DIR (any folder with playwright installed).
//   npm run smoke                  # headless
//   npm run smoke -- --shots out   # also save screenshots to ./out
//   npm run smoke -- --presentation-only  # viewport / hardware fixtures only
//   npm run smoke -- --rotary-only  # 10 keyboard runs, including between paints
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.SMOKE_PORT || 5191);
const shotsArg = process.argv.indexOf('--shots');
const shotsDir = shotsArg > 0 ? resolve(process.argv[shotsArg + 1] || 'smoke-shots') : process.env.SMOKE_SHOTS ? resolve(process.env.SMOKE_SHOTS) : null;
const presentationOnly = process.argv.includes('--presentation-only');
const rotaryOnly = process.argv.includes('--rotary-only');

async function rotaryFixtures(page) {
  for (let run = 1; run <= 10; run++) {
    await page.goto(url);
    await page.click('#btnBegin');
    await page.waitForTimeout(2100);
    await page.evaluate(() => {
      window.__rotaryTrace = [];
      const game = __cc.game, dispatch = game.dispatch.bind(game);
      game.dispatch = cmd => {
        const before = game.state.facility.fanSpeed;
        const result = dispatch(cmd);
        if (cmd.id === 'fan-speed') __rotaryTrace.push({ cmd, before, after: game.state.facility.fanSpeed, result });
        return result;
      };
      document.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') __rotaryTrace.push({ key: e.key, target: e.target.getAttribute('aria-label'), displayed: e.target.getAttribute('aria-valuetext'), actual: game.state.facility.fanSpeed });
      }, true);
    });
    await page.getByRole('button', { name: 'VENT FAN: LOW', exact: true }).click();
    await page.getByRole('slider', { name: 'VENT FAN', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    try {
      await page.waitForFunction(() => __cc.game.state.facility.fanSpeed === 'MED', null, { timeout: 1500, polling: 50 });
    } catch {
      throw new Error(`rotary run ${run}: ${JSON.stringify(await page.evaluate(() => __rotaryTrace))}`);
    }
    // Put both inputs between paints to cover the timing window deterministically.
    await page.evaluate(() => {
      document.querySelector('[aria-label="VENT FAN: OFF"]').click();
      __cc.app.update();
      __rotaryTrace.length = 0;
      document.querySelector('[aria-label="VENT FAN: LOW"]').click();
      const dial = document.querySelector('[role="slider"][aria-label="VENT FAN"]');
      dial.focus();
      dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      if (__cc.game.state.facility.fanSpeed !== 'MED') throw new Error(`between-paints rotary: ${JSON.stringify(__rotaryTrace)}`);
    });
    console.log(`  ok  rotary run ${run} (keyboard and between paints)`);
  }
}

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

// Helpers use actions and elapsed simulation time only. No fixture writes state.
async function installHelpers(page) {
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
}

async function assertFit(page, width) {
  const issues = await page.evaluate(desktop => {
    const problems = [];
    const within = (el, name) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) problems.push(`${name} outside viewport`);
    };
    if (document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1) problems.push('horizontal page overflow');
    within(document.querySelector('#mainScreen'), 'main feed');
    if (desktop) {
      const face = document.querySelector('#mainScreen').getBoundingClientRect();
      const image = document.querySelector('#mainCanvas').getBoundingClientRect();
      if (Math.abs(image.width / image.height - 16 / 9) > 0.025) problems.push('main camera must have a 16:9 face');
      if (Math.abs(image.width - face.width) > 3 || Math.abs(image.height - face.height) > 3) problems.push('main camera must fill its screen');
      if (document.documentElement.scrollHeight > innerHeight + 1) problems.push('vertical page overflow');
      const console = document.querySelector('#console');
      if (console.scrollHeight > console.clientHeight + 2) problems.push('desk requires scrolling');
      for (const el of document.querySelectorAll('#console button')) {
        if (!el.getClientRects().length || el.closest('[hidden]') || el.closest('.bay:not(.open)')) continue;
        within(el, el.getAttribute('aria-label') || el.textContent.trim());
      }
    } else {
      const main = document.querySelector('#feedMain').getBoundingClientRect();
      const tabs = document.querySelector('.tabs').getBoundingClientRect();
      if (main.bottom > tabs.top + 1 || tabs.bottom > innerHeight) problems.push('main feed must remain above visible tabs');
      const panels = [...document.querySelectorAll('#console > .panel')];
      for (let i = 1; i < panels.length; i++) {
        if (panels[i].getBoundingClientRect().top < panels[i - 1].getBoundingClientRect().bottom) problems.push('desk panels overlap');
      }
    }
    return problems;
  }, width > 980);
  if (issues.length) throw new Error(`${width}px fit: ${issues.join('; ')}`);
}

async function presentationFixtures(page) {
  // Poll briefly: controls apply on the next animation frame, not synchronously with the input event.
  const check = async (fn, message) => {
    try { await page.waitForFunction(fn, null, { timeout: 1500, polling: 50 }); }
    catch { throw new Error(message); }
  };
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 657 }, { width: 412, height: 860 }]) {
    const size = `${viewport.width}x${viewport.height}`;
    console.log(`  checking presentation ${size}`);
    await page.setViewportSize(viewport);
    const boot = async () => {
      await page.goto(url);
      await page.click('#btnBegin');
      await installHelpers(page);
      await page.waitForTimeout(2100);
    };
    const snap = async name => {
      if (!shotsDir) return;
      const dir = resolve(shotsDir, size);
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: resolve(dir, `${name}.png`), animations: 'disabled' });
    };
    await boot();
    await assertFit(page, viewport.width);
    await snap('00-start');

    await page.locator('.tile[data-feed="B"]').click();
    await check(() => __cc.app.focus === 'B' && document.querySelectorAll('.tile:not([hidden])').length === 3, `${size}: thumbnail swap must retain three previews`);
    if (viewport.width < 981) {
      const notes = await page.locator('#btnNotes').boundingBox();
      await page.touchscreen.tap(notes.x + notes.width / 2, notes.y + notes.height / 2);
      await check(() => !document.querySelector('#notes').hidden, `${size}: touch NOTES`);
      await page.keyboard.press('Escape');
    }

    // Exercise the actual controls, including keyboard and pointer detents.
    for (const [key, feed] of [['1', 'A'], ['2', 'B'], ['3', 'C'], ['4', 'hall']]) {
      await page.keyboard.press(key);
      if (await page.evaluate(() => __cc.app.focus) !== feed) throw new Error(`${size}: camera key ${key}`);
    }
    await page.keyboard.press('g');
    await check(() => document.querySelector('#desk').dataset.mode === 'grid', `${size}: G did not open grid`);
    await page.keyboard.press('1');
    await page.keyboard.press('n');
    await check(() => !document.querySelector('#notes').hidden, `${size}: N did not open notes`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('d');
    await check(() => !document.querySelector('#discoveries').hidden && document.querySelector('#notes').hidden, `${size}: D did not open discoveries`);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'VENT FAN: LOW', exact: true }).click();
    const fan = page.getByRole('slider', { name: 'VENT FAN', exact: true });
    await fan.focus();
    await page.keyboard.press('ArrowRight');
    await check(() => __cc.game.state.facility.fanSpeed === 'MED', `${size}: rotary keyboard detent`);
    const dial = await fan.boundingBox();
    await page.mouse.move(dial.x + dial.width / 2, dial.y + dial.height / 2);
    await page.mouse.down();
    await page.mouse.move(dial.x + dial.width / 2 + 22, dial.y + dial.height / 2, { steps: 3 });
    await page.mouse.up();
    await check(() => __cc.game.state.facility.fanSpeed === 'HIGH', `${size}: rotary drag detent`);
    await fan.focus();
    await page.keyboard.press('Home');
    await check(() => __cc.game.state.facility.fanSpeed === 'OFF', `${size}: rotary Home detent`);
    await page.locator('[data-control="power-lightsB"] .branch-breaker').click();

    // Force a genuine main trip, then let the unpowered embers backdraft.
    await page.evaluate(() => {
      __t.say('C', 'c-calm'); __t.say('C', 'c-look');
      __t.say('C', 'c-iso-lightsA'); __t.idle('C');
      __t.ctl('fan-speed', { speed: 'HIGH' });
      const first = __cc.game.dispatch({ type: 'power', circuit: 'lightsA', on: true });
      if (first.code !== 'overload-risk') throw new Error('main-trip fixture did not arm FORCE');
      __t.power('lightsA', true);
      __cc.app.focusFeed('C'); __cc.game.advance(28);
    });
    await page.waitForTimeout(1200);
    await check(() => __cc.game.state.power.tripped && __cc.game.state.facility.rooms.C.smoke > 0.1, `${size}: expected main trip and Room C smoke`);
    if (viewport.width < 981) await page.evaluate(() => { document.querySelector('#console').scrollTop = 0; });
    await assertFit(page, viewport.width);
    await snap('01-main-trip-smoke-c');

    await boot();
    await page.getByRole('button', { name: 'STEAM HEAT: A', exact: true }).click();
    await page.evaluate(() => __t.until(g => g.state.facility.rooms.A.temperature >= 55, 70));
    await page.waitForTimeout(900);
    await check(() => __cc.game.state.facility.rooms.A.heatBand === 'dangerous' && __cc.game.state.prisoners.A.alive, `${size}: steam fixture must reach red band with Nadia alive`);
    if (viewport.width < 981) await page.locator('#instrumentsPanel').scrollIntoViewIfNeeded();
    await snap('02-steam-a-red-band');
    await page.keyboard.press('d');
    await check(() => document.querySelectorAll('.discovery-entry').length > 0 && document.querySelectorAll('.discovery-entry,.discovery-slot').length === __cc.game.state.discoveries.total, `${size}: discovery slots/count`);
    await snap('04-discoveries');
    await page.keyboard.press('Escape');
    await page.locator('[data-control="e-stop"] .guard-lid').click();
    await check(() => document.querySelector('[data-control="e-stop"] .guard').classList.contains('open'), `${size}: E-STOP cover did not open`);
    await snap('05-estop-cover-open');
    await page.locator('[data-control="e-stop"] .pb').click();
    await check(() => __cc.game.state.power.order.every(id => !__cc.game.state.power.circuits[id].on) && !__cc.game.state.power.tripped && !document.querySelector('[data-control="e-stop"] .guard').classList.contains('open'), `${size}: E-STOP must shed handles, preserve main and close cover`);
    await check(() => document.querySelector('[data-control="e-stop"] .pb').disabled && document.activeElement === document.querySelector('[data-control="e-stop"] .guard-lid'), `${size}: reclosed E-STOP must restore keyboard guard`);

    await boot();
    await page.evaluate(() => {
      __t.say('C', 'c-calm'); __t.say('C', 'c-look'); __t.say('A', 'a-calm'); __t.say('A', 'a-plate');
      __t.say('C', 'c-iso-lightsA'); __t.idle('C'); __t.power('lightsA', true); __cc.game.advance(2.5);
      for (const symbol of __cc.game.state.s.code) __t.ctl('restraint', { action: 'key', symbol });
      __t.ctl('restraint', { action: 'submit' }); __cc.game.advance(1.5);
      __t.say('A', 'a-look'); __t.say('A', 'a-lever'); __t.idle('A');
      __t.say('B', 'b-calm'); __t.say('B', 'b-sign'); __t.say('C', 'c-iso-pump'); __t.idle('C');
      __t.power('incinerator', false); __t.power('pump', true); __t.power('lightsA', false); __t.power('vent', true);
      __t.ctl('drain'); __cc.app.focusFeed('B');
      __t.until(g => g.state.power.circuits.lightsB.branchTripped, 70);
    });
    // Wait only for the queued real spark event to reach the renderer.
    await page.waitForTimeout(100);
    await check(() => __cc.game.state.s.flood.phase === 'filling' && __cc.game.state.prisoners.B.shocks === 1, `${size}: flood fixture did not produce water short`);
    await snap('03-flood-b-sparks');
    await page.locator('[data-control="power-lightsB"] .branch-breaker').click();
    await check(() => __cc.game.state.power.circuits.lightsB.branchTripped && __cc.game.state.prisoners.B.shocks === 2, `${size}: wet branch reset must immediately re-trip`);
    await assertFit(page, viewport.width);
    console.log(`  ok  presentation ${size}: fit, controls and six fixtures`);
    if (shotsDir) await effectFixtures(page, size, boot);
  }
}

// Evidence uses real environmental transitions. Crops retain the main camera's
// full image and the actual dial needles, rather than synthesising a fixture.
async function effectFixtures(page, size, boot) {
  const dir = resolve(shotsDir, 'effects', size);
  mkdirSync(dir, { recursive: true });
  const close = async (name, selector = '#mainScreen') => {
    // Needles ease in real time even when simulation time was advanced at once.
    await page.waitForTimeout(900);
    await page.locator(selector).screenshot({ path: resolve(dir, `${name}.png`), animations: 'disabled' });
  };
  const thermometers = name => close(name, '.thermometers');
  await boot();
  await thermometers('thermometers-22c');
  await page.evaluate(() => {
    __t.say('C', 'c-calm'); __t.say('C', 'c-look');
    __t.say('C', 'c-iso-lightsA'); __t.idle('C');
    __t.power('lightsA', true);
    __t.ctl('steam-heat', { room: 'A' });
    __cc.app.focusFeed('A');
    __t.until(g => g.state.facility.rooms.A.temperature >= 40, 70);
  });
  await thermometers('thermometers-40c');
  await page.evaluate(() => __t.until(g => g.state.facility.rooms.A.temperature >= 55, 70));
  await thermometers('thermometers-55c');
  await close('chamber-a-warm-lit');
  await page.evaluate(() => __t.power('lightsA', false));
  await close('chamber-a-warm-ir');
  await page.evaluate(() => {
    __t.power('lightsA', true);
    __t.until(g => g.state.facility.rooms.A.temperature >= 72, 70);
  });
  await thermometers('thermometers-72c');
  await page.evaluate(() => {
    if (!__cc.game.state.prisoners.A.alive) throw new Error('temperature evidence must precede lethal exposure');
  });

  await boot();
  await page.evaluate(() => {
    __t.power('lightsB', false); __cc.app.focusFeed('B'); __cc.game.advance(0.2);
    if (!__cc.game.state.facility.secrets.irWriting) throw new Error('IR writing not revealed');
  });
  await close('chamber-b-ir-writing');

  await boot();
  await page.evaluate(() => {
    __t.say('C', 'c-calm'); __t.say('C', 'c-look');
    __t.say('C', 'c-iso-lightsA'); __t.idle('C');
    __t.ctl('fan-speed', { speed: 'OFF' });
    __t.ctl('steam-heat', { room: 'C' });
    __cc.game.advance(35);
    __t.power('incinerator', false); __cc.app.focusFeed('C');
    __t.until(g => g.state.facility.rooms.C.smoke >= 0.8, 90);
    if (!__cc.game.api.live('lightsC')) throw new Error('dense smoke lit fixture needs LIGHTS C');
  });
  await close('chamber-c-dense-smoke-lit');
  await page.evaluate(() => {
    // No simulation time between these actions: the extractor cannot clear
    // the dense smoke before the restored boiler overloads the main.
    __t.ctl('fan-speed', { speed: 'HIGH' });
    __t.power('lightsA', true);
    const first = __cc.game.dispatch({ type: 'power', circuit: 'incinerator', on: true });
    if (first.code !== 'overload-risk') throw new Error('dense smoke fixture did not arm FORCE');
    __t.power('incinerator', true);
    __cc.game.advance(0.1);
    if (!__cc.game.state.power.tripped || __cc.game.state.facility.rooms.C.smoke < 0.75) throw new Error('dense smoke IR fixture needs main trip and dense smoke');
  });
  await close('chamber-c-dense-smoke-main-trip-ir');
  console.log(`  ok  effects ${size}: lit/IR smoke, writing, heat and four thermometer readings`);
}

try {
  await waitForServer(url);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 657 }, hasTouch: true });
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

  if (!presentationOnly && !rotaryOnly) {
  await page.goto(url);
  await page.click('#btnBegin');
  await page.waitForTimeout(1500);
  await shot('00-boot');

  await installHelpers(page);

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
  await page.evaluate(() => {
    __t.say('B', 'b-calm'); __t.say('B', 'b-sign'); __t.say('C', 'c-iso-pump'); __t.idle('C');
    __t.power('incinerator', false); __t.power('pump', true); __t.power('lightsA', false); __t.power('vent', true);
  });
  await page.locator('[data-control="drain"] .guard-lid').click();
  const drainButton = await page.locator('[data-control="drain"] .pb').boundingBox();
  await page.mouse.move(drainButton.x + drainButton.width / 2, drainButton.y + drainButton.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await step('04-flood', () => {
    if (__cc.game.state.s.flood.phase !== 'filling') throw new Error('guard + hold did not start drain');
    __cc.game.advance(20);
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
  console.log(`  ok  full shift: all three escaped (${result.escaped.join(', ')})`);
  }
  if (rotaryOnly) await rotaryFixtures(page);
  else await presentationFixtures(page);
  if (errors.length) throw new Error(`browser errors:\n${errors.join('\n')}`);
  console.log(`PASS — ${rotaryOnly ? '10 rotary checks' : presentationOnly ? 'presentation checks' : 'full shift and presentation checks'}, no browser errors`);
} catch (e) {
  failed = true;
  console.error(`FAIL — ${e.message}`);
} finally {
  await browser?.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
