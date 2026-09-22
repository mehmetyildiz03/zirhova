import { chromium } from 'playwright-core';

const executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  hasTouch: false,
  deviceScaleFactor: 1,
});

const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.click('#startBtn');
await page.waitForTimeout(250);

const initial = await page.evaluate(() => window.__zirhovaTest?.snapshot());
if (!initial?.p1) throw new Error('Navigation diagnostics unavailable');
if (!initial.p1.navX || !initial.p1.navY) {
  throw new Error(`Spawn is not nav-aligned: ${JSON.stringify(initial.p1)}`);
}

// Move only a few pixels left so the tank is intentionally between nav lanes.
await page.keyboard.down('KeyA');
await page.waitForTimeout(32);
await page.keyboard.up('KeyA');
await page.waitForTimeout(40);

const drifted = await page.evaluate(() => window.__zirhovaTest.snapshot());
if (!(drifted.p1.x < initial.p1.x - 1)) {
  throw new Error(`Tank did not drift left before turn: ${JSON.stringify({ initial: initial.p1, drifted: drifted.p1 })}`);
}
if (drifted.p1.navX) {
  throw new Error(`Test did not produce an off-lane position before turning: ${JSON.stringify(drifted.p1)}`);
}

// Turning upward must quantize the perpendicular X coordinate to a 16px firing lane.
await page.keyboard.down('KeyW');
await page.waitForTimeout(70);
await page.keyboard.up('KeyW');
await page.waitForTimeout(40);

const turned = await page.evaluate(() => window.__zirhovaTest.snapshot());
if (turned.p1.dir !== 'up') {
  throw new Error(`Tank did not turn up: ${JSON.stringify(turned.p1)}`);
}
if (!turned.p1.navX) {
  throw new Error(`Vertical turn did not snap X to navigation lane: ${JSON.stringify(turned.p1)}`);
}
if (Math.abs(turned.p1.x - initial.p1.x) > 0.2) {
  throw new Error(
    `Small drift should snap back to original firing lane: ${JSON.stringify({ initial: initial.p1, turned: turned.p1 })}`
  );
}

// After the snap, firing must preserve that same discrete line.
await page.keyboard.down('Space');
await page.waitForTimeout(80);
await page.keyboard.up('Space');
await page.waitForTimeout(30);

const fired = await page.evaluate(() => window.__zirhovaTest.snapshot());
if (!(fired.p1.fireCooldown > 0)) throw new Error('Cannon did not fire after navigation snap');
if (!fired.p1.navX) throw new Error('Firing disturbed navigation alignment');

if (errors.length) {
  throw new Error(`Navigation runtime errors:\n${errors.join('\n')}`);
}

console.log('PASS navigation smoke', {
  navStep: fired.navStep,
  initialX: initial.p1.x,
  driftedX: drifted.p1.x,
  snappedX: turned.p1.x,
  fireLineStable: true,
});

await context.close();
await browser.close();
