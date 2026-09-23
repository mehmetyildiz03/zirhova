import { chromium } from 'playwright-core';

const executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.addInitScript(() => {
  localStorage.removeItem('zirhova-campaign-checkpoint-v1');
  localStorage.setItem('zirhova-profile-v2', JSON.stringify({
    version: 3,
    bestStage: 8,
    bestScore: 5000,
    bestSoloScore: 5000,
    selectedSkin: 'classic',
  }));
});

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });

function assert(condition, message, data) {
  if (!condition) {
    throw new Error(data ? `${message}: ${JSON.stringify(data)}` : message);
  }
}

async function snapshot() {
  return page.evaluate(() => window.__zirhovaTest.snapshot());
}

async function startStage(stage) {
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('#stageSelectBtn');
  await page.click(`[data-stage="${stage}"]`);
  await page.waitForTimeout(50);
  return snapshot();
}

await page.click('#stageSelectBtn');
const cards = {
  b1: await page.locator('[data-stage="1"]').innerText(),
  b2: await page.locator('[data-stage="2"]').innerText(),
  b7: await page.locator('[data-stage="7"]').innerText(),
  b8: await page.locator('[data-stage="8"]').innerText(),
};
assert(cards.b1.includes('KIRIK HAT · KANAT'), 'B1 card missing KIRIK HAT identity', cards);
assert(cards.b2.includes('DAR GEÇİT · KORİDOR'), 'B2 card missing DAR GEÇİT identity', cards);
assert(cards.b7.includes('KIRIK HAT · İLERİ KANAT'), 'B7 card missing advanced KIRIK HAT identity', cards);
assert(cards.b8.includes('DAR GEÇİT · DARBOĞAZ'), 'B8 card missing advanced DAR GEÇİT identity', cards);
await page.click('#stageSelectCloseBtn');

const b1 = await startStage(1);
assert(
  b1.stage === 1 && b1.doctrine?.id === 'broken-line' &&
  !b1.doctrine.advanced && b1.doctrine.label === 'KANAT',
  'B1 runtime doctrine mismatch',
  b1
);

const b2 = await startStage(2);
assert(
  b2.stage === 2 && b2.doctrine?.id === 'narrow-gate' &&
  !b2.doctrine.advanced && b2.doctrine.label === 'KORİDOR',
  'B2 runtime doctrine mismatch',
  b2
);

const b7 = await startStage(7);
assert(
  b7.stage === 7 && b7.doctrine?.id === 'broken-line' &&
  b7.doctrine.advanced && b7.doctrine.label === 'İLERİ KANAT',
  'B7 advanced runtime doctrine mismatch',
  b7
);

const b8 = await startStage(8);
assert(
  b8.stage === 8 && b8.doctrine?.id === 'narrow-gate' &&
  b8.doctrine.advanced && b8.doctrine.label === 'DARBOĞAZ',
  'B8 advanced runtime doctrine mismatch',
  b8
);

assert(errors.length === 0, 'Stage doctrine runtime errors', errors);

console.log('PASS stage doctrine integration', {
  cards,
  b1: b1.doctrine,
  b2: b2.doctrine,
  b7: b7.doctrine,
  b8: b8.doctrine,
  runtimeErrors: 0,
});

await context.close();
await browser.close();
