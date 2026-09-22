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
await page.click('#coopBtn');
await page.waitForTimeout(350);

let snap = await page.evaluate(() => window.__zirhovaTest?.snapshot());
if (!snap) throw new Error('Co-op diagnostic snapshot unavailable');
if (!snap.coop) throw new Error('2-player button did not enable co-op mode');
if (snap.activePlayers !== 2) {
  throw new Error(`Expected two active players, got ${snap.activePlayers}`);
}
if (documentMode(await page.evaluate(() => document.body.dataset.playMode)) !== 'coop') {
  throw new Error('Body play mode did not switch to coop');
}

const before = snap;

// P1: W should move upward.
await page.keyboard.down('KeyW');
await page.waitForTimeout(180);
await page.keyboard.up('KeyW');
await page.waitForTimeout(50);

snap = await page.evaluate(() => window.__zirhovaTest.snapshot());
if (!snap.p1 || !(snap.p1.y < before.p1.y - 2)) {
  throw new Error(`P1 did not move independently with W: ${JSON.stringify({ before: before.p1, after: snap.p1 })}`);
}

const beforeP2 = snap.p2;

// P2: left arrow should move left without moving P1 via the same key.
const p1BeforeP2Move = { ...snap.p1 };
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(180);
await page.keyboard.up('ArrowLeft');
await page.waitForTimeout(50);

snap = await page.evaluate(() => window.__zirhovaTest.snapshot());
if (!snap.p2 || !(snap.p2.x < beforeP2.x - 2)) {
  throw new Error(`P2 did not move independently with ArrowLeft: ${JSON.stringify({ before: beforeP2, after: snap.p2 })}`);
}
if (Math.abs(snap.p1.x - p1BeforeP2Move.x) > 1.5 || Math.abs(snap.p1.y - p1BeforeP2Move.y) > 1.5) {
  throw new Error('P2 arrow input unexpectedly moved P1 in co-op mode');
}

// Exercise independent firing keys and ensure runtime remains stable.
await page.keyboard.down('Space');
await page.keyboard.down('Enter');
await page.waitForTimeout(140);
await page.keyboard.up('Space');
await page.keyboard.up('Enter');
await page.waitForTimeout(500);

if (errors.length) {
  throw new Error(`Co-op runtime errors:\n${errors.join('\n')}`);
}

snap = await page.evaluate(() => window.__zirhovaTest.snapshot());
if (snap.activePlayers < 1) throw new Error('Both players disappeared during basic co-op smoke');

console.log('PASS co-op smoke', {
  activePlayers: snap.activePlayers,
  lives: snap.lives,
  p1: snap.p1,
  p2: snap.p2,
  keyboardSplit: 'ok',
  simultaneousFire: 'ok',
  runtimeErrors: 0,
});

await context.close();
await browser.close();

function documentMode(value) {
  return String(value || '');
}
