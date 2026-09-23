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
    bestStage: 12,
    bestScore: 12000,
    bestSoloScore: 12000,
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
  await page.waitForTimeout(40);
  return snapshot();
}

const expected = [
  [1, 'KIRIK HAT · KANAT', 'broken-line', 'KANAT', false],
  [2, 'DAR GEÇİT · KORİDOR', 'narrow-gate', 'KORİDOR', false],
  [3, 'SU KAPANI · BOĞAZ', 'water-trap', 'BOĞAZ', false],
  [4, 'ÇELİK KAVŞAK · AĞIR HAT', 'steel-crossroads', 'AĞIR HAT', false],
  [5, 'YARIK OVA · HAREKETLİ CEPHE', 'split-plain', 'HAREKETLİ CEPHE', false],
  [6, 'SON SİPER · KUŞATMA', 'last-bastion', 'KUŞATMA', false],
  [7, 'KIRIK HAT · İLERİ KANAT', 'broken-line', 'İLERİ KANAT', true],
  [8, 'DAR GEÇİT · DARBOĞAZ', 'narrow-gate', 'DARBOĞAZ', true],
  [9, 'SU KAPANI · SU KISKACI', 'water-trap', 'SU KISKACI', true],
  [10, 'ÇELİK KAVŞAK · ÇELİK KUŞATMA', 'steel-crossroads', 'ÇELİK KUŞATMA', true],
  [11, 'YARIK OVA · AÇIK AVCI', 'split-plain', 'AÇIK AVCI', true],
  [12, 'SON SİPER · SON KUŞATMA', 'last-bastion', 'SON KUŞATMA', true],
];

await page.click('#stageSelectBtn');
for (const [stage, cardText] of expected) {
  const text = await page.locator(`[data-stage="${stage}"]`).innerText();
  assert(text.includes(cardText), `B${stage} card identity mismatch`, { text, cardText });
}
await page.click('#stageSelectCloseBtn');

const runtime = [];
for (const [stage, , id, label, advanced] of expected) {
  const snap = await startStage(stage);
  runtime.push({ stage, doctrine: snap.doctrine });
  assert(
    snap.stage === stage &&
    snap.doctrine?.id === id &&
    snap.doctrine.label === label &&
    snap.doctrine.advanced === advanced,
    `B${stage} runtime doctrine mismatch`,
    snap
  );
}

assert(errors.length === 0, 'Stage doctrine runtime errors', errors);

console.log('PASS stage doctrine integration', {
  stagesChecked: expected.length,
  runtime,
  runtimeErrors: 0,
});

await context.close();
await browser.close();
