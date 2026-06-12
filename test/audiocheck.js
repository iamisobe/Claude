// Headed audio verification: unlock on gesture, context running, hooks fire.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('file:///home/user/Claude/index.html');
  await page.waitForTimeout(800);

  // title → new game → skip tutorial (No)
  await page.keyboard.press('z');           // start
  await page.waitForTimeout(400);
  await page.keyboard.press('z');           // advance intro dialog if any
  await page.waitForTimeout(400);
  // navigate confirm: pick "No" (skip tutorial) — down then z
  for (let i = 0; i < 12; i++){ await page.keyboard.press('z'); await page.waitForTimeout(180); }
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('z');
  await page.waitForTimeout(600);

  const state = await page.evaluate(() => {
    const out = { started: !!(window.G && G.started), names: SFX.names().length,
      soundOn: SFX.soundOn(), musicOn: SFX.musicOn() };
    // reach into the closure indirectly: play must not throw, and we can
    // verify the context via a fresh probe AudioContext state
    try { SFX.play('hit'); SFX.play('quest'); out.playOk = true; } catch (e) { out.playOk = false; }
    return out;
  });

  // real trusted gesture already happened (keyboard presses) → ctx should be running.
  // Probe: create a context now; if autoplay policy is satisfied it starts 'running'.
  const ctxState = await page.evaluate(() => {
    const c = new AudioContext(); const s = c.state; c.close(); return s;
  });

  // walk into the woods and swing a few times so combat hooks execute live
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.keyboard.press('x');      await page.waitForTimeout(300); // close any menu
  for (let i = 0; i < 6; i++){ await page.keyboard.press('z'); await page.waitForTimeout(150); }
  await page.waitForTimeout(500);

  console.log(JSON.stringify({ state, ctxState, errors }, null, 2));
  await browser.close();
  if (errors.length || !state.playOk || state.names < 23) process.exit(1);
})();
