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
const runtimeErrors = [];
page.on('pageerror', error => runtimeErrors.push(error.message));
page.on('console', msg => {
  if (msg.type() === 'error') runtimeErrors.push(msg.text());
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

async function heap() {
  return page.evaluate(() => {
    const memory = performance.memory;
    return memory ? {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
    } : null;
  });
}

// Baseline: light but non-empty frame.
await call('seedStressLoad', {
  enemies: 1,
  particles: 30,
  powerups: 1,
});
const baselineHeap = await heap();
const baseline = await call('benchmarkStress', {
  frames: 120,
  dt: 1 / 60,
  targetBullets: 8,
  targetParticles: 30,
  drawFrames: true,
});
await call('clearStressLoad');

// Fresh game state before heavy run.
await page.evaluate(() => document.querySelector('#startBtn').click());
await page.waitForTimeout(80);

await call('seedStressLoad', {
  enemies: 4,
  particles: 600,
  powerups: 12,
});
const stressHeapBefore = await heap();

const stress = await call('benchmarkStress', {
  frames: 300,
  dt: 1 / 60,
  targetBullets: 64,
  targetParticles: 600,
  drawFrames: true,
});

const stressHeapAfter = await heap();
const snap = stress.snapshot;

// This is deliberately much heavier than normal gameplay. Thresholds are
// intentionally generous because GitHub-hosted runners vary; the test is for
// pathological algorithmic collapse, not device FPS certification.
assert(
  stress.averageMs < 20,
  'Average stressed update+draw cost is pathologically high',
  { baseline, stress }
);
assert(
  stress.p95Ms < 35,
  'P95 stressed update+draw cost is pathologically high',
  { baseline, stress }
);
assert(
  stress.maxMs < 140,
  'Single stressed update+draw frame stalled excessively',
  { baseline, stress }
);
assert(
  stress.averageMs < baseline.averageMs * 40 + 12,
  'Stress cost scaled disproportionately against baseline',
  { baselineAverage: baseline.averageMs, stressAverage: stress.averageMs }
);

assert(stress.peakBullets <= 80, 'Bullet collection escaped its stress target', stress);
assert(stress.peakParticles <= 950, 'Particle collection grew without a reasonable bound', stress);
assert(stress.peakPowerups <= 12, 'Power-up collection grew during stress run', stress);

assert(snap.enemyRects.length <= 4, 'Active enemy cap was exceeded under stress', snap);
assert(snap.bulletCount <= 64, 'Live bullets accumulated beyond sustained stress target', snap);
assert(snap.particleCount <= 850, 'Live particles accumulated excessively under sustained stress', snap);
assert(snap.powerupCount <= 12, 'Power-ups accumulated unexpectedly under stress', snap);
assert(snap.pendingRespawns.length === 0, 'Stress run created a stuck respawn queue', snap);

const cleaned = await call('clearStressLoad');
assert(cleaned.bulletCount === 0, 'Stress cleanup left bullets behind', cleaned);
assert(cleaned.particleCount === 0, 'Stress cleanup left particles behind', cleaned);
assert(cleaned.powerupCount === 0, 'Stress cleanup left power-ups behind', cleaned);
assert(cleaned.enemyRects.length === 0, 'Stress cleanup left enemies behind', cleaned);

// A second heavy cycle catches state that only grows after reuse.
await call('seedStressLoad', {
  enemies: 4,
  particles: 600,
  powerups: 12,
});
const second = await call('benchmarkStress', {
  frames: 180,
  dt: 1 / 60,
  targetBullets: 64,
  targetParticles: 600,
  drawFrames: true,
});
const cleanedAgain = await call('clearStressLoad');

assert(
  second.averageMs < Math.max(20, stress.averageMs * 1.8),
  'Second stress cycle degraded sharply compared with the first',
  { first: stress.averageMs, second: second.averageMs }
);
assert(cleanedAgain.bulletCount === 0, 'Second cleanup left bullets', cleanedAgain);
assert(cleanedAgain.particleCount === 0, 'Second cleanup left particles', cleanedAgain);
assert(cleanedAgain.powerupCount === 0, 'Second cleanup left power-ups', cleanedAgain);
assert(cleanedAgain.enemyRects.length === 0, 'Second cleanup left enemies', cleanedAgain);

if (runtimeErrors.length) {
  throw new Error(`Performance stress runtime errors:\n${runtimeErrors.join('\n')}`);
}

console.log('PASS performance stress', {
  baseline: {
    averageMs: Number(baseline.averageMs.toFixed(3)),
    p95Ms: Number(baseline.p95Ms.toFixed(3)),
    maxMs: Number(baseline.maxMs.toFixed(3)),
  },
  stress: {
    averageMs: Number(stress.averageMs.toFixed(3)),
    p95Ms: Number(stress.p95Ms.toFixed(3)),
    maxMs: Number(stress.maxMs.toFixed(3)),
    peakBullets: stress.peakBullets,
    peakParticles: stress.peakParticles,
    peakPowerups: stress.peakPowerups,
  },
  secondCycleAverageMs: Number(second.averageMs.toFixed(3)),
  heap: {
    baseline: baselineHeap,
    beforeStress: stressHeapBefore,
    afterStress: stressHeapAfter,
  },
  cleanup: 'ok',
  runtimeErrors: 0,
});

await context.close();
await browser.close();
