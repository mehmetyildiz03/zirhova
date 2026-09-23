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
    version: 4,
    bestStage: 19,
    bestScore: 24000,
    bestSoloScore: 24000,
    selectedSkin: 'classic',
  }));
});

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });

function assert(condition, message, data) {
  if (!condition) {
    throw new Error(data ? `${message}: ${JSON.stringify(data)}` : message);
  }
}

async function call(method, ...args) {
  return page.evaluate(
    ({ method, args }) => window.__zirhovaTest[method](...args),
    { method, args }
  );
}

async function startStage(stage) {
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('#stageSelectBtn');
  await page.click(`[data-stage="${stage}"]`);
  await page.waitForTimeout(60);
  return call('snapshot');
}

await page.click('#stageSelectBtn');
const b12Text = await page.locator('[data-stage="12"]').innerText();
const b13Text = await page.locator('[data-stage="13"]').innerText();
const b19Text = await page.locator('[data-stage="19"]').innerText();

assert(!b12Text.includes('VETERAN'), 'B12 incorrectly entered Veteran pressure', b12Text);
assert(b13Text.includes('VETERAN I'), 'B13 card does not announce Veteran I', b13Text);
assert(b19Text.includes('VETERAN II'), 'B19 card does not announce Veteran II', b19Text);
await page.click('#stageSelectCloseBtn');

let snap = await startStage(13);
assert(
  snap.veteran?.tier === 1 &&
  snap.veteran.label === 'VETERAN I' &&
  snap.veteran.spawnInterval === 0.37,
  'B13 runtime Veteran I mismatch',
  snap.veteran
);
assert(snap.maxActiveEnemies === 4, 'Veteran I changed the active enemy cap', snap.maxActiveEnemies);
assert(
  snap.pendingSpawns + snap.enemyRects.length === 9,
  'B13 changed the saturated wave-1 total enemy count',
  { pending: snap.pendingSpawns, active: snap.enemyRects.length }
);

for (let i = 0; i < 10; i++) {
  const stepped = await call('stepSpawn', 1);
  snap = stepped.snapshot;
}
assert(
  snap.enemyRects.length <= 4,
  'Veteran I exceeded the four-enemy active cap during accelerated spawning',
  snap.enemyRects
);
assert(
  snap.enemyRects.length === 4,
  'Veteran I did not fill the normal four-enemy active pressure cap',
  snap.enemyRects
);

snap = await startStage(19);
assert(
  snap.veteran?.tier === 2 &&
  snap.veteran.label === 'VETERAN II' &&
  snap.veteran.spawnInterval === 0.34,
  'B19 runtime Veteran II mismatch',
  snap.veteran
);
assert(
  snap.veteran.capBonuses.breacher === 1 &&
  snap.veteran.capBonuses.heavy === 1,
  'Veteran II runtime cap bonuses mismatch',
  snap.veteran
);
assert(snap.maxActiveEnemies === 4, 'Veteran II changed the active enemy cap', snap.maxActiveEnemies);
assert(
  snap.pendingSpawns + snap.enemyRects.length === 9,
  'B19 changed the saturated wave-1 total enemy count',
  { pending: snap.pendingSpawns, active: snap.enemyRects.length }
);

assert(errors.length === 0, 'Veteran runtime errors', errors);

console.log('PASS veteran integration', {
  b12: 'normal advanced loop',
  b13: 'VETERAN I',
  b19: 'VETERAN II',
  activeEnemyCap: 4,
  b13SpawnInterval: 0.37,
  b19SpawnInterval: 0.34,
  runtimeErrors: 0,
});

await context.close();
await browser.close();
