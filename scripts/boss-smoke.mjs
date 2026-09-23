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
await page.waitForTimeout(100);

async function call(method, ...args) {
  return page.evaluate(
    ({ method, args }) => window.__zirhovaTest[method](...args),
    { method, args }
  );
}

function assert(condition, message, data) {
  if (!condition) {
    throw new Error(data ? `${message}: ${JSON.stringify(data)}` : message);
  }
}

// Boss cadence and rotation.
await call('setLifecycle', { stage: 2, wave: 6, waveInStage: 3 });
let snap = await call('spawnWaveForTest');
assert(
  !snap.queuedEnemyTypes.includes('bastion') && !snap.queuedEnemyTypes.includes('pincer'),
  'Boss appeared before the first special finale',
  snap.queuedEnemyTypes
);

await call('setLifecycle', { stage: 3, wave: 9, waveInStage: 3 });
snap = await call('spawnWaveForTest');
assert(
  snap.queuedEnemyTypes.filter(type => type === 'bastion').length === 1 &&
  snap.queuedEnemyTypes.at(-1) === 'bastion',
  'B3 must end with exactly one BURÇKIRAN',
  snap.queuedEnemyTypes
);

await call('setLifecycle', { stage: 6, wave: 18, waveInStage: 3 });
snap = await call('spawnWaveForTest');
assert(
  snap.queuedEnemyTypes.filter(type => type === 'pincer').length === 1 &&
  snap.queuedEnemyTypes.at(-1) === 'pincer',
  'B6 must end with exactly one KISKAÇ',
  snap.queuedEnemyTypes
);

await call('setLifecycle', { stage: 9, wave: 27, waveInStage: 3 });
snap = await call('spawnWaveForTest');
assert(
  snap.queuedEnemyTypes.at(-1) === 'bastion',
  'B9 must rotate back to BURÇKIRAN',
  snap.queuedEnemyTypes
);

// BURÇKIRAN retains frontal armor and phase behavior.
await call('sandbox');
await call('setLifecycle', { stage: 3, wave: 9, waveInStage: 3 });
await call('setBase', { x: 350, y: 650 });
await call('addEnemy', {
  x: 350,
  y: 300,
  type: 'bastion',
  dir: 'up',
  decisionClock: 999,
  fireCooldown: 999,
});

let boss = (await call('snapshot')).enemyStates[0];
assert(boss?.boss && boss.hp === 8, 'BURÇKIRAN sandbox setup failed', boss);

let hit = await call('hitEnemy', 0, 2, {
  team: 'player',
  dx: 0,
  dy: 1,
});
boss = hit.snapshot.enemyStates[0];
assert(hit.result?.blocked && boss.hp === 8, 'BURÇKIRAN frontal armor regressed', hit);

hit = await call('hitEnemy', 0, 2, {
  team: 'player',
  dx: 1,
  dy: 0,
});
boss = hit.snapshot.enemyStates[0];
assert(!hit.result?.blocked && boss.hp === 6, 'BURÇKIRAN side damage regressed', hit);

// KISKAÇ: fast, unarmored, phase-1 three-way salvo.
await call('sandbox');
await call('setLifecycle', { stage: 6, wave: 18, waveInStage: 3 });
await call('setBase', { x: 350, y: 650 });
await call('addEnemy', {
  x: 350,
  y: 300,
  type: 'pincer',
  dir: 'up',
  decisionClock: 999,
  fireCooldown: 999,
});
await call('setEnemy', 0, { bossAbilityCooldown: 0 });

boss = (await call('snapshot')).enemyStates[0];
assert(boss?.boss && boss.type === 'pincer', 'KISKAÇ sandbox setup failed', boss);
assert(boss.hp === 7 && boss.maxHp === 7, 'First KISKAÇ must have 7 HP', boss);

hit = await call('hitEnemy', 0, 2, {
  team: 'player',
  dx: 0,
  dy: 1,
});
boss = hit.snapshot.enemyStates[0];
assert(!hit.result?.blocked && boss.hp === 5, 'KISKAÇ incorrectly inherited frontal armor', hit);

snap = await call('stepEnemyUpdates', 0.01);
boss = snap.enemyStates[0];
assert(snap.bulletStates.length === 3, 'KISKAÇ phase 1 did not fire a three-way salvo', snap.bulletStates);
assert(new Set(snap.bulletStates.map(b => `${b.dx},${b.dy}`)).size === 3, 'KISKAÇ phase-1 salvo directions are not distinct', snap.bulletStates);
assert(boss.bossAbilityCooldown > 1, 'KISKAÇ salvo cooldown was not reset', boss);

// Push below 50% HP; phase 2 must accelerate and add the rear lane.
hit = await call('hitEnemy', 0, 2, {
  team: 'player',
  dx: 1,
  dy: 0,
});
boss = hit.snapshot.enemyStates[0];
assert(boss.hp === 3, 'KISKAÇ did not reach phase threshold HP', boss);

snap = await call('stepEnemyUpdates', 0.01);
boss = snap.enemyStates[0];
assert(boss.bossPhase === 2, 'KISKAÇ did not enter phase 2 at half HP', boss);

await call('setEnemy', 0, { bossAbilityCooldown: 0 });
snap = await call('stepEnemyUpdates', 0.01);
assert(
  snap.bulletStates.length === 7,
  'KISKAÇ phase 2 did not add a four-way salvo',
  snap.bulletStates
);
const phase2Bullets = snap.bulletStates.slice(-4);
assert(
  new Set(phase2Bullets.map(b => `${b.dx},${b.dy}`)).size === 4,
  'KISKAÇ phase-2 salvo must cover all four cardinal directions',
  phase2Bullets
);

if (errors.length) {
  throw new Error(`Boss runtime errors:\n${errors.join('\n')}`);
}

console.log('PASS boss encounters', {
  rotation: 'B3 BURÇKIRAN / B6 KISKAÇ / B9 BURÇKIRAN',
  burckiranArmor: 'ok',
  pincerHp: 7,
  pincerPhase1Volley: 3,
  pincerPhase2Volley: 4,
  pincerFrontalArmor: 'none',
  runtimeErrors: 0,
});

await context.close();
await browser.close();
