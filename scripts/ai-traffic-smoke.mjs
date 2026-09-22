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

function deepOverlap(a, b, limit = 5) {
  const overlapX = Math.max(0, Math.min(a.x + 34, b.x + 34) - Math.max(a.x, b.x));
  const overlapY = Math.max(0, Math.min(a.y + 34, b.y + 34) - Math.max(a.y, b.y));
  return overlapX > limit && overlapY > limit;
}

async function stepMany(count, dt = 0.05) {
  let snap = null;
  for (let i = 0; i < count; i++) snap = await call('stepEnemies', dt);
  return snap;
}

// 1) Fast follower behind a slow tank should form a stable convoy, not jitter.
await call('sandbox');
await call('addEnemy', {
  x: 247, y: 260, type: 'heavy', dir: 'down',
  decisionClock: 999, fireCooldown: 999,
});
await call('addEnemy', {
  x: 247, y: 180, type: 'scout', dir: 'down',
  decisionClock: 999, fireCooldown: 999,
});
const convoyStart = await call('snapshot');
const convoyEnd = await stepMany(44, 0.05);
const convoyFront = convoyEnd.enemyStates[0];
const convoyRear = convoyEnd.enemyStates[1];

assert(
  convoyFront.y > convoyStart.enemyStates[0].y + 100,
  'Slow lead tank failed to make progress in convoy',
  { start: convoyStart.enemyStates[0], end: convoyFront }
);
assert(
  convoyRear.y > convoyStart.enemyStates[1].y + 90,
  'Fast following tank stopped making meaningful convoy progress',
  { start: convoyStart.enemyStates[1], end: convoyRear }
);
assert(
  !deepOverlap(convoyFront, convoyRear),
  'Fast follower overlapped the lead tank',
  { front: convoyFront, rear: convoyRear }
);
assert(
  convoyRear.turnCount <= 1 && convoyRear.dir === 'down',
  'Follower jittered directions instead of queueing behind slower traffic',
  convoyRear
);

// 2) Two enemies meeting head-on in a one-lane corridor must resolve by yield.
await call('sandbox');
for (let row = 3; row <= 10; row++) {
  await call('setTile', 4, row, 'steel');
  await call('setTile', 6, row, 'steel');
}
await call('addEnemy', {
  x: 247, y: 210, type: 'raider', dir: 'down',
  decisionClock: 999, fireCooldown: 999,
});
await call('addEnemy', {
  x: 247, y: 340, type: 'raider', dir: 'up',
  decisionClock: 999, fireCooldown: 999,
});
const headOnStart = await call('snapshot');
const headOnEnd = await stepMany(42, 0.05);
const h1 = headOnEnd.enemyStates[0];
const h2 = headOnEnd.enemyStates[1];

assert(
  h1.trafficYieldCount + h2.trafficYieldCount >= 1,
  'Head-on encounter never triggered deterministic yielding',
  headOnEnd.enemyStates
);
assert(
  !deepOverlap(h1, h2),
  'Head-on traffic resolution allowed enemy overlap',
  { h1, h2 }
);
assert(
  Math.abs(h1.y - h2.y) > 40,
  'Head-on enemies remained deadlocked nose-to-nose',
  { start: headOnStart.enemyStates, end: headOnEnd.enemyStates }
);

// 3) Three-tank chain: yield request must propagate to the tank behind.
await call('sandbox');
for (let row = 3; row <= 11; row++) {
  await call('setTile', 4, row, 'steel');
  await call('setTile', 6, row, 'steel');
}
await call('addEnemy', {
  x: 247, y: 210, type: 'raider', dir: 'down',
  decisionClock: 999, fireCooldown: 999,
});
await call('addEnemy', {
  x: 247, y: 340, type: 'raider', dir: 'up',
  decisionClock: 999, fireCooldown: 999,
});
await call('addEnemy', {
  x: 247, y: 376, type: 'raider', dir: 'up',
  decisionClock: 999, fireCooldown: 999,
});
const chainEnd = await stepMany(52, 0.05);
const chain = chainEnd.enemyStates;

assert(
  chain[1].trafficYieldCount >= 1,
  'Front tank of yielding convoy did not receive a yield order',
  chain
);
assert(
  chain[2].trafficYieldCount >= 1,
  'Yield request did not propagate backward through the convoy',
  chain
);
for (let i = 0; i < chain.length; i++) {
  for (let j = i + 1; j < chain.length; j++) {
    assert(
      !deepOverlap(chain[i], chain[j]),
      'Three-tank traffic resolution produced deep overlap',
      { a: chain[i], b: chain[j] }
    );
  }
}

// 4) Dead end: tank should reverse out once, not oscillate indefinitely.
await call('sandbox');
for (let row = 4; row <= 7; row++) {
  await call('setTile', 4, row, 'steel');
  await call('setTile', 6, row, 'steel');
}
await call('setTile', 5, 6, 'steel');
await call('setBase', { x: 243, y: 50 });
await call('addEnemy', {
  x: 247, y: 247, type: 'raider', dir: 'down',
  decisionClock: 999, fireCooldown: 999,
});
const deadEndStart = await call('snapshot');
const deadEndEnd = await stepMany(34, 0.05);
const escaped = deadEndEnd.enemyStates[0];

assert(
  escaped.y < deadEndStart.enemyStates[0].y - 20,
  'Enemy failed to reverse out of a dead end',
  { start: deadEndStart.enemyStates[0], end: escaped }
);
assert(
  escaped.dir === 'up',
  'Enemy escaped dead end in an unexpected direction',
  escaped
);
assert(
  escaped.turnCount <= 3,
  'Enemy oscillated excessively while escaping a dead end',
  escaped
);

// 5) Congestion-aware pathfinding should avoid an occupied cell if an open detour exists.
await call('sandbox');
await call('addEnemy', {
  x: 247, y: 247, type: 'raider', dir: 'down',
  decisionClock: 999, fireCooldown: 999,
});
await call('addEnemy', {
  x: 247, y: 295, type: 'heavy', dir: 'down',
  decisionClock: 999, fireCooldown: 999,
});
const trafficPath = await call('pathDirForEnemy', 0, { x: 247, y: 535, w: 34, h: 34 });
assert(
  trafficPath === 'left' || trafficPath === 'right',
  'Pathfinder ignored a congested cell despite an open side route',
  { trafficPath, enemies: (await call('snapshot')).enemyStates }
);

if (errors.length) {
  throw new Error(`AI traffic runtime errors:\n${errors.join('\n')}`);
}

console.log('PASS AI traffic audit', {
  stableConvoy: 'ok',
  headOnYield: 'ok',
  threeTankYieldPropagation: 'ok',
  deadEndEscape: 'ok',
  congestionAwarePath: trafficPath,
  runtimeErrors: 0,
});

await context.close();
await browser.close();
