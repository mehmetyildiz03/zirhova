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

// Stage 2 finale is not a boss encounter.
await call('setLifecycle', { stage: 2, wave: 6, waveInStage: 3 });
let snap = await call('spawnWaveForTest');
assert(
  !snap.queuedEnemyTypes.includes('bastion'),
  'Boss appeared before the first special finale',
  snap.queuedEnemyTypes
);

// Stage 3 finale must append exactly one Burckiran boss to the normal roster.
await call('setLifecycle', { stage: 3, wave: 9, waveInStage: 3 });
snap = await call('spawnWaveForTest');
const bosses = snap.queuedEnemyTypes.filter(type => type === 'bastion');
assert(
  bosses.length === 1,
  'Stage 3 finale must queue exactly one boss',
  snap.queuedEnemyTypes
);
assert(
  snap.queuedEnemyTypes[snap.queuedEnemyTypes.length - 1] === 'bastion',
  'Boss must arrive as the finale threat',
  snap.queuedEnemyTypes
);

// Isolated boss combat sandbox.
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
assert(boss?.boss, 'Spawned bastion is not marked as a boss', boss);
assert(boss.hp === 8 && boss.maxHp === 8, 'First Burckiran must have 8 HP', boss);
assert(boss.bossPhase === 1, 'Boss must start in phase 1', boss);

// Facing up: a downward-moving player shell hits the front armor.
let hit = await call('hitEnemy', 0, 2, {
  team: 'player',
  dx: 0,
  dy: 1,
});
boss = hit.snapshot.enemyStates[0];
assert(hit.result?.blocked, 'Frontal player shell was not blocked', hit);
assert(boss.hp === 8, 'Frontal armor allowed HP damage', boss);
assert(boss.armorFlash > 0, 'Frontal block did not trigger armor feedback', boss);

// Side hit must damage.
hit = await call('hitEnemy', 0, 2, {
  team: 'player',
  dx: 1,
  dy: 0,
});
boss = hit.snapshot.enemyStates[0];
assert(!hit.result?.blocked, 'Side player shell was incorrectly blocked', hit);
assert(boss.hp === 6, 'Side hit did not deal expected damage', boss);

// Another side hit takes boss to exactly 50%; full enemy update must enter phase 2.
hit = await call('hitEnemy', 0, 2, {
  team: 'player',
  dx: 1,
  dy: 0,
});
boss = hit.snapshot.enemyStates[0];
assert(boss.hp === 4, 'Boss did not reach phase threshold HP', boss);

snap = await call('stepEnemyUpdates', 0.01);
boss = snap.enemyStates[0];
assert(boss.bossPhase === 2, 'Boss did not enter phase 2 at 50% HP', boss);

// Rear hit remains vulnerable in phase 2.
hit = await call('hitEnemy', 0, 2, {
  team: 'player',
  dx: 0,
  dy: -1,
});
boss = hit.snapshot.enemyStates[0];
assert(!hit.result?.blocked && boss.hp === 2, 'Rear hit failed in phase 2', { hit, boss });

if (errors.length) {
  throw new Error(`Boss runtime errors:\n${errors.join('\n')}`);
}

console.log('PASS boss encounter', {
  cadence: 'stage 3 finale',
  queuedBosses: bosses.length,
  frontalArmor: 'blocked',
  sideDamage: 'ok',
  phase2AtHalfHp: 'ok',
  rearDamage: 'ok',
  runtimeErrors: 0,
});

await context.close();
await browser.close();
