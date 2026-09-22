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

async function startFresh() {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.click('#startBtn');
  await page.waitForTimeout(220);
  const snap = await page.evaluate(() => window.__zirhovaTest?.snapshot());
  if (!snap?.p1) throw new Error('Navigation diagnostics unavailable');
  return snap;
}

async function tapMove(code, ms = 90) {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
  await page.waitForTimeout(45);
  return page.evaluate(() => window.__zirhovaTest.snapshot());
}

// Exact screenshot-like starting pocket: up, left and down must all be usable.
// Right is intentionally obstructed by the base-defense brick at [6,14].
let initial = await startFresh();
let moved = await tapMove('KeyW', 100);
if (!(moved.p1.y < initial.p1.y - 3)) {
  throw new Error(`Spawn pocket UP is blocked unexpectedly: ${JSON.stringify({ initial: initial.p1, moved: moved.p1 })}`);
}

initial = await startFresh();
moved = await tapMove('KeyA', 100);
if (!(moved.p1.x < initial.p1.x - 3)) {
  throw new Error(`Spawn pocket LEFT is blocked unexpectedly: ${JSON.stringify({ initial: initial.p1, moved: moved.p1 })}`);
}

initial = await startFresh();
moved = await tapMove('KeyS', 100);
if (!(moved.p1.y > initial.p1.y + 3)) {
  throw new Error(`Spawn pocket DOWN is blocked unexpectedly: ${JSON.stringify({ initial: initial.p1, moved: moved.p1 })}`);
}

// Move toward the brick on the right until collision, then turn upward.
// This reproduces the user-visible case where a nearby obstacle could make
// the single nearest navigation lane invalid and lock the turn.
initial = await startFresh();
await page.keyboard.down('KeyD');
await page.waitForTimeout(260);
await page.keyboard.up('KeyD');
await page.waitForTimeout(50);

const againstWall = await page.evaluate(() => window.__zirhovaTest.snapshot());
if (!(againstWall.p1.x > initial.p1.x + 2)) {
  throw new Error('Tank did not reach the right-side obstacle for turn-assist test');
}

await page.keyboard.down('KeyW');
await page.waitForTimeout(120);
await page.keyboard.up('KeyW');
await page.waitForTimeout(50);

const escapedCorner = await page.evaluate(() => window.__zirhovaTest.snapshot());
if (escapedCorner.p1.dir !== 'up' || !(escapedCorner.p1.y < againstWall.p1.y - 3)) {
  throw new Error(
    `Turn assist failed beside obstacle: ${JSON.stringify({ againstWall: againstWall.p1, escaped: escapedCorner.p1 })}`
  );
}
if (!escapedCorner.p1.navX) {
  throw new Error('Obstacle-side vertical turn did not finish on a 16px navigation lane');
}

// Original discrete firing-lane regression: a few pixels of lateral drift
// must collapse back to one stable line before the perpendicular turn.
initial = await startFresh();

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
  spawnDirections: 'up/left/down ok',
  obstacleTurnAssist: 'ok',
  initialX: initial.p1.x,
  driftedX: drifted.p1.x,
  snappedX: turned.p1.x,
  fireLineStable: true,
});

await context.close();
await browser.close();
