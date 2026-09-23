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
    bestStage: 11,
    bestScore: 12000,
    bestSoloScore: 12000,
    selectedSkin: 'classic',
  }));
});

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });

function assert(condition, message, data) {
  if (!condition) throw new Error(data ? `${message}: ${JSON.stringify(data)}` : message);
}

async function call(method, ...args) {
  return page.evaluate(({ method, args }) => window.__zirhovaTest[method](...args), { method, args });
}

async function startStage(stage) {
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('#stageSelectBtn');
  await page.click(`[data-stage="${stage}"]`);
  await page.waitForTimeout(50);
  return call('snapshot');
}

await page.click('#stageSelectBtn');
const b5Card = await page.locator('[data-stage="5"]').innerText();
const b11Card = await page.locator('[data-stage="11"]').innerText();
assert(b5Card.includes('ÇAMUR HATTI'), 'B5 stage card does not announce mud environment', b5Card);
assert(b11Card.includes('DERİN ÇAMUR'), 'B11 stage card does not announce advanced mud environment', b11Card);
await page.click('#stageSelectCloseBtn');

const b5 = await startStage(5);
assert(b5.environment?.id === 'mud-line' && b5.environment.label === 'ÇAMUR HATTI', 'B5 runtime environment mismatch', b5.environment);
assert(b5.terrainCounts.mud === 8, 'B5 mud tile count mismatch', b5.terrainCounts);

const b11 = await startStage(11);
assert(b11.environment?.advanced && b11.environment.label === 'DERİN ÇAMUR', 'B11 advanced mud environment mismatch', b11.environment);
assert(b11.terrainCounts.mud === 12, 'B11 mud tile count mismatch', b11.terrainCounts);

// Player movement: identical input and modifiers, mud should reduce displacement to ~62%.
await call('sandbox');
await call('setTile', 5, 8, 'floor');
await call('setTouchForTest', { up: true });
let snap = await call('snapshot');
const floorStartY = snap.p1.y;
snap = await call('stepP1', 0.1);
const floorDistance = floorStartY - snap.p1.y;

await call('sandbox');
await call('setTile', 5, 8, 'mud');
await call('setTouchForTest', { up: true });
snap = await call('snapshot');
const mudStartY = snap.p1.y;
snap = await call('stepP1', 0.1);
const mudDistance = mudStartY - snap.p1.y;
const playerRatio = mudDistance / floorDistance;

assert(floorDistance > 5, 'Floor movement baseline is invalid', { floorDistance, mudDistance });
assert(playerRatio > 0.58 && playerRatio < 0.66, 'Mud did not apply the expected player slowdown', {
  floorDistance,
  mudDistance,
  playerRatio,
});

// Enemy movement uses the same physical slowdown.
const enemyX = 5 * 48 + 7;
const enemyY = 8 * 48 + 7;

await call('sandbox');
await call('clearP1');
await call('setBase', { x: enemyX, y: 650 });
await call('setTile', 5, 8, 'floor');
await call('addEnemy', {
  x: enemyX,
  y: enemyY,
  type: 'raider',
  dir: 'down',
  decisionClock: 999,
  fireCooldown: 999,
});
snap = await call('snapshot');
const enemyFloorStartY = snap.enemyStates[0].y;
snap = await call('stepEnemies', 0.1);
const enemyFloorDistance = snap.enemyStates[0].y - enemyFloorStartY;

await call('sandbox');
await call('clearP1');
await call('setBase', { x: enemyX, y: 650 });
await call('setTile', 5, 8, 'mud');
await call('addEnemy', {
  x: enemyX,
  y: enemyY,
  type: 'raider',
  dir: 'down',
  decisionClock: 999,
  fireCooldown: 999,
});
snap = await call('snapshot');
const enemyMudStartY = snap.enemyStates[0].y;
snap = await call('stepEnemies', 0.1);
const enemyMudDistance = snap.enemyStates[0].y - enemyMudStartY;
const enemyRatio = enemyMudDistance / enemyFloorDistance;

assert(enemyFloorDistance > 4, 'Enemy floor movement baseline is invalid', { enemyFloorDistance, enemyMudDistance });
assert(enemyRatio > 0.58 && enemyRatio < 0.66, 'Mud did not apply equally to enemy movement', {
  enemyFloorDistance,
  enemyMudDistance,
  enemyRatio,
});

await call('setTouchForTest', {});

assert(errors.length === 0, 'Environment runtime errors', errors);

console.log('PASS environment integration', {
  b5MudTiles: b5.terrainCounts.mud,
  b11MudTiles: b11.terrainCounts.mud,
  playerSpeedRatio: Number(playerRatio.toFixed(3)),
  enemySpeedRatio: Number(enemyRatio.toFixed(3)),
  runtimeErrors: 0,
});

await context.close();
await browser.close();
