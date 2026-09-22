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

async function testCall(method, ...args) {
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

// 1) Open 48px corridor must remain comfortably traversable.
await testCall('sandbox');
for (let row = 4; row <= 11; row++) {
  await testCall('setTile', 4, row, 'steel');
  await testCall('setTile', 6, row, 'steel');
}
await testCall('setP1', { x: 247, y: 10 * 48 + 7, dir: 'up' });
const corridorBefore = await testCall('snapshot');
const corridorMove = await testCall('driveP1', 'up', 210);
const corridorAfter = corridorMove.snapshot;
assert(
  corridorAfter.p1.y < corridorBefore.p1.y - 190,
  'Tank failed to traverse a legal 48px corridor',
  { before: corridorBefore.p1, after: corridorAfter.p1 }
);
assert(
  Math.abs(corridorAfter.p1.x - corridorBefore.p1.x) < 0.2,
  'Corridor traversal drifted sideways',
  { before: corridorBefore.p1, after: corridorAfter.p1 }
);

// 2) A partial brick wall with a 36px clear opening must allow the 34px tank.
await testCall('sandbox');
const leftColumnMask = [0, 4, 8, 12].reduce((mask, bit) => mask | (1 << bit), 0);
await testCall('setTile', 5, 5, 'brick', leftColumnMask);
await testCall('setP1', { x: 5 * 48 + 13, y: 198, dir: 'down' });
const wideBefore = await testCall('snapshot');
const wideMove = await testCall('driveP1', 'down', 92);
const wideAfter = wideMove.snapshot;
assert(
  wideAfter.p1.y > wideBefore.p1.y + 80,
  'Tank could not pass a valid 36px partial-brick opening',
  { before: wideBefore.p1, after: wideAfter.p1 }
);

// 3) A 24px opening must correctly block the 34px tank.
await testCall('sandbox');
const edgeColumnsMask = [0,3,4,7,8,11,12,15].reduce((mask, bit) => mask | (1 << bit), 0);
await testCall('setTile', 5, 5, 'brick', edgeColumnsMask);
await testCall('setP1', { x: 5 * 48 + 7, y: 198, dir: 'down' });
const narrowBefore = await testCall('snapshot');
const narrowMove = await testCall('driveP1', 'down', 92);
const narrowAfter = narrowMove.snapshot;
assert(
  narrowAfter.p1.y < narrowBefore.p1.y + 30,
  'Tank incorrectly squeezed through a 24px brick opening',
  { before: narrowBefore.p1, after: narrowAfter.p1 }
);

// 4) Tank-to-tank contact must block overlap but still allow an escape turn.
await testCall('sandbox');
await testCall('setP1', { x: 247, y: 391, dir: 'right' });
await testCall('setP2', { x: 295, y: 391, dir: 'left' });
const contactBefore = await testCall('snapshot');
const contactMove = await testCall('driveP1', 'right', 48);
const contactAfter = contactMove.snapshot;
assert(
  contactAfter.p1.x < contactBefore.p2.x - 28,
  'P1 overlapped too deeply with P2',
  { before: contactBefore, after: contactAfter }
);
const escapeMove = await testCall('driveP1', 'up', 40);
assert(
  escapeMove.snapshot.p1.y < contactAfter.p1.y - 30,
  'Tank could not turn away after tank-to-tank contact',
  { contact: contactAfter.p1, escaped: escapeMove.snapshot.p1 }
);

// 5) Base collision must stop forward motion without locking an escape turn.
await testCall('sandbox');
await testCall('setBase', { x: 291, y: 387 });
await testCall('setP1', { x: 247, y: 391, dir: 'right' });
const baseBefore = await testCall('snapshot');
const baseContact = await testCall('driveP1', 'right', 40);
assert(
  baseContact.snapshot.p1.x < baseBefore.p1.x + 20,
  'Tank passed too far into the base collision box',
  { before: baseBefore.p1, after: baseContact.snapshot.p1 }
);
const baseEscape = await testCall('driveP1', 'up', 40);
assert(
  baseEscape.snapshot.p1.y < baseContact.snapshot.p1.y - 30,
  'Base-side collision incorrectly locked the perpendicular escape direction',
  { contact: baseContact.snapshot.p1, escaped: baseEscape.snapshot.p1 }
);

// 6) Ice momentum must stop after the tank center leaves ice.
await testCall('sandbox');
await testCall('setTile', 5, 8, 'ice');
await testCall('setP1', { x: 247, y: 391, dir: 'right' });
await testCall('setP1Momentum', 'right');
const iceStart = await testCall('snapshot');
await testCall('stepP1', 0.1);
await testCall('stepP1', 0.1);
const stillIce = await testCall('stepP1', 0.1);
assert(
  stillIce.p1.x > iceStart.p1.x + 30,
  'Tank did not preserve momentum while leaving ice',
  { start: iceStart.p1, after: stillIce.p1 }
);
const afterIceX = stillIce.p1.x;
const floorStep = await testCall('stepP1', 0.1);
assert(
  Math.abs(floorStep.p1.x - afterIceX) < 0.2,
  'Tank kept sliding after its center reached normal floor',
  { before: afterIceX, after: floorStep.p1.x }
);

// 7) Fully blocked player respawn must wait instead of spawning inside terrain.
await page.reload({ waitUntil: 'networkidle' });
await page.click('#startBtn');
await page.waitForTimeout(180);
const startSnap = await testCall('snapshot');
assert(startSnap.lives >= 2, 'Unexpected life count for respawn audit', startSnap);

const respawnCell = [5, 14];
const blockedCells = [];
for (let radius = 0; radius <= 2; radius++) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.abs(dx) + Math.abs(dy) !== radius) continue;
      const x = respawnCell[0] + dx;
      const y = respawnCell[1] + dy;
      if (x < 0 || y < 0 || x >= 16 || y >= 16) continue;
      blockedCells.push([x, y]);
      await testCall('setTile', x, y, 'steel');
    }
  }
}

let deathSnap = await testCall('forceP1Death');
assert(
  deathSnap.p1 === null && deathSnap.pendingRespawns.includes(1),
  'Blocked respawn did not enter a safe pending state',
  deathSnap
);

for (const [x, y] of blockedCells) {
  await testCall('setTile', x, y, 'floor');
}

const respawned = await testCall('retryRespawns', 0.3);
assert(
  respawned.p1 && !respawned.pendingRespawns.includes(1),
  'Player did not respawn after a safe area became available',
  respawned
);

// 8) Normal wave spawning must never stack live enemy rectangles significantly.
await page.reload({ waitUntil: 'networkidle' });
await page.click('#startBtn');
for (let sample = 0; sample < 24; sample++) {
  await page.waitForTimeout(90);
  const snap = await testCall('snapshot');
  const rects = snap.enemyRects;

  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      const overlapX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const overlapY = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      assert(
        !(overlapX > 5 && overlapY > 5),
        'Live enemies spawned or moved into an invalid deep overlap',
        { a, b, overlapX, overlapY, sample }
      );
    }
  }
}

if (errors.length) {
  throw new Error(`Movement audit runtime errors:\n${errors.join('\n')}`);
}

console.log('PASS movement audit', {
  corridor48px: 'ok',
  partialBrick36px: 'passable',
  partialBrick24px: 'blocked',
  tankContactEscape: 'ok',
  baseContactEscape: 'ok',
  iceExitMomentum: 'ok',
  blockedRespawnRetry: 'ok',
  enemySpawnOverlap: 'none',
});

await context.close();
await browser.close();
