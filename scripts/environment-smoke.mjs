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
const b4Card = await page.locator('[data-stage="4"]').innerText();
const b5Card = await page.locator('[data-stage="5"]').innerText();
const b10Card = await page.locator('[data-stage="10"]').innerText();
const b11Card = await page.locator('[data-stage="11"]').innerText();
assert(b4Card.includes('TAKTİK BARİYER'), 'B4 stage card does not announce tactical barriers', b4Card);
assert(b5Card.includes('ÇAMUR HATTI'), 'B5 stage card does not announce mud environment', b5Card);
assert(b10Card.includes('KİLİTLİ KAVŞAK'), 'B10 stage card does not announce advanced barriers', b10Card);
assert(b11Card.includes('DERİN ÇAMUR'), 'B11 stage card does not announce advanced mud environment', b11Card);
await page.click('#stageSelectCloseBtn');

const b4 = await startStage(4);
assert(b4.environment?.id === 'steel-gates', 'B4 runtime barrier environment mismatch', b4.environment);
assert(b4.environmentBarrier?.label === 'SOL KİLİT', 'B4 wave 1 did not close the left gate', b4.environmentBarrier);
assert(b4.terrainCounts.barrier === 1, 'B4 wave 1 barrier count mismatch', b4.terrainCounts);

await call('setLifecycle', { wave: 11, waveInStage: 2 });
let gateSnap = await call('spawnWaveForTest');
assert(gateSnap.environmentBarrier?.label === 'SAĞ KİLİT', 'B4 wave 2 did not swap gates', gateSnap.environmentBarrier);
assert(gateSnap.terrainCounts.barrier === 1, 'B4 wave 2 barrier count mismatch', gateSnap.terrainCounts);

await call('setLifecycle', { wave: 12, waveInStage: 3 });
gateSnap = await call('spawnWaveForTest');
assert(gateSnap.environmentBarrier?.label === 'KAVŞAK AÇIK', 'B4 wave 3 should open the crossing', gateSnap.environmentBarrier);
assert(!gateSnap.terrainCounts.barrier, 'B4 wave 3 retained a barrier', gateSnap.terrainCounts);

const b10 = await startStage(10);
assert(b10.environment?.advanced && b10.environment.label === 'KİLİTLİ KAVŞAK', 'B10 advanced barrier environment mismatch', b10.environment);
await call('setLifecycle', { wave: 30, waveInStage: 3 });
gateSnap = await call('spawnWaveForTest');
assert(gateSnap.environmentBarrier?.label === 'ÇİFT KİLİT', 'B10 wave 3 did not enter double lock', gateSnap.environmentBarrier);
assert(gateSnap.terrainCounts.barrier === 2, 'B10 double lock barrier count mismatch', gateSnap.terrainCounts);

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

// Safety: a gate never closes underneath a tank.
await startStage(4);
const rightGateX = 10 * 48 + 7;
const rightGateY = 7 * 48 + 7;
await call('setP1', { x: rightGateX, y: rightGateY, dir: 'up' });
await call('setLifecycle', { wave: 11, waveInStage: 2 });
gateSnap = await call('spawnWaveForTest');
assert(gateSnap.environmentBarrier?.skippedClosedCells.length === 1, 'Occupied gate did not use safe-open behavior', gateSnap.environmentBarrier);
assert(!gateSnap.terrainCounts.barrier, 'Occupied gate still closed on the player', gateSnap.terrainCounts);

// Terrain collision distinction: mud is passable to bullets, a tactical barrier is not.
await call('sandbox');
await call('setTile', 5, 7, 'mud');
await call('addBullet', { x: 5 * 48 + 20, y: 8 * 48 + 2, dx: 0, dy: -1, speed: 405 });
let bulletSnap = await call('stepBullets', 0.14);
assert(bulletSnap.bulletCount === 1, 'Mud incorrectly stopped a projectile', bulletSnap);

await call('sandbox');
await call('setTile', 5, 7, 'barrier');
await call('addBullet', { x: 5 * 48 + 20, y: 8 * 48 + 2, dx: 0, dy: -1, speed: 405 });
bulletSnap = await call('stepBullets', 0.14);
assert(bulletSnap.bulletCount === 0, 'Tactical barrier failed to stop a projectile', bulletSnap);

assert(errors.length === 0, 'Environment runtime errors', errors);

console.log('PASS environment integration', {
  b4BarrierWave1: 'SOL KİLİT',
  b4BarrierWave2: 'SAĞ KİLİT',
  b4BarrierWave3: 'KAVŞAK AÇIK',
  b10FinalWave: 'ÇİFT KİLİT',
  safeClose: 'ok',
  mudBulletPassThrough: 'ok',
  barrierBulletBlock: 'ok',
  b5MudTiles: b5.terrainCounts.mud,
  b11MudTiles: b11.terrainCounts.mud,
  playerSpeedRatio: Number(playerRatio.toFixed(3)),
  enemySpeedRatio: Number(enemyRatio.toFixed(3)),
  runtimeErrors: 0,
});

await context.close();
await browser.close();
