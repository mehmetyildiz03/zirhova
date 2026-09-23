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
await page.waitForTimeout(120);

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

const history = [];
let lastScore = 0;

const TOTAL_WAVES = 36;

for (let completed = 1; completed <= TOTAL_WAVES; completed++) {
  const before = await call('snapshot');

  const expectedStage = Math.floor((completed - 1) / 3) + 1;
  const expectedWaveInStage = ((completed - 1) % 3) + 1;

  assert(
    before.wave === completed,
    `Unexpected absolute wave before clearing wave ${completed}`,
    before
  );
  assert(
    before.stage === expectedStage && before.waveInStage === expectedWaveInStage,
    `Unexpected stage/wave position before wave ${completed}`,
    before
  );
  assert(
    before.pendingSpawns > 0 || before.enemyRects.length > 0,
    `Wave ${completed} started without queued or active enemies`,
    before
  );

  const cleared = await call('clearCurrentWave');
  const afterClear = cleared.snapshot;

  assert(cleared.guard < 80, `Wave ${completed} drain hit safety guard`, cleared);
  assert(afterClear.pendingSpawns === 0, `Wave ${completed} left pending spawns`, afterClear);
  assert(afterClear.waveQueue === 0, `Wave ${completed} left spawn queue entries`, afterClear);
  assert(afterClear.enemyRects.length === 0, `Wave ${completed} left active enemies`, afterClear);
  assert(afterClear.bulletCount === 0, `Wave ${completed} left bullets`, afterClear);
  assert(afterClear.powerupCount === 0, `Wave ${completed} left powerups`, afterClear);
  assert(afterClear.particleCount === 0, `Wave ${completed} left particles after aging`, afterClear);
  assert(afterClear.pendingRespawns.length === 0, `Wave ${completed} left pending respawns`, afterClear);
  assert(afterClear.score > lastScore, `Wave ${completed} did not increase score`, afterClear);
  lastScore = afterClear.score;

  let advanced = await call('advanceLifecycle', 3.2);

  if (completed % 3 === 0) {
    assert(
      advanced.awaitingUpgrade,
      `Stage completion after wave ${completed} did not open upgrade state`,
      advanced
    );
    assert(
      advanced.stage === expectedStage && advanced.wave === completed,
      `Stage advanced before upgrade selection after wave ${completed}`,
      advanced
    );

    advanced = await call('chooseLifecycleUpgrade');

    assert(!advanced.awaitingUpgrade, 'Upgrade state did not close', advanced);
    assert(
      advanced.stage === expectedStage + 1 &&
      advanced.wave === completed + 1 &&
      advanced.waveInStage === 1,
      `Stage transition after wave ${completed} is inconsistent`,
      advanced
    );
    assert(
      advanced.pendingSpawns > 0 && advanced.waveQueue > 0,
      'New stage did not create the next wave spawn queue',
      advanced
    );
    assert(advanced.bulletCount === 0, 'Stage load retained bullets', advanced);
    assert(advanced.powerupCount === 0, 'Stage load retained powerups', advanced);
    assert(advanced.pendingRespawns.length === 0, 'Stage load retained pending respawns', advanced);
  } else {
    assert(
      !advanced.awaitingUpgrade,
      `Non-final wave ${completed} unexpectedly opened upgrade state`,
      advanced
    );
    assert(
      advanced.wave === completed + 1 &&
      advanced.stage === expectedStage &&
      advanced.waveInStage === expectedWaveInStage + 1,
      `Wave transition after ${completed} is inconsistent`,
      advanced
    );
    assert(
      advanced.pendingSpawns > 0 && advanced.waveQueue > 0,
      `Wave ${completed + 1} did not receive a spawn queue`,
      advanced
    );
  }

  history.push({
    completed,
    score: afterClear.score,
    nextStage: advanced.stage,
    nextWave: advanced.wave,
    nextWaveInStage: advanced.waveInStage,
  });
}

// Twelve complete stages exercise all six doctrines, the first advanced
// doctrine cycle, four boss finales, and land exactly where Veteran I begins.
// The next state must be B13 / wave 37.
const longRun = await call('snapshot');
assert(
  longRun.stage === 13 && longRun.wave === 37 && longRun.waveInStage === 1,
  '36-wave lifecycle did not land at stage 13 wave 1',
  longRun
);
assert(
  longRun.doctrine?.id === 'broken-line' &&
  longRun.doctrine.advanced &&
  longRun.doctrine.cycle >= 2,
  'Stage 13 did not retain advanced KIRIK HAT doctrine after the repeat cycle',
  longRun
);
assert(
  longRun.veteran?.tier === 1 &&
  longRun.veteran.label === 'VETERAN I' &&
  longRun.veteran.spawnInterval === 0.37,
  'Stage 13 did not enter Veteran I pressure',
  longRun
);
assert(
  longRun.maxActiveEnemies === 4,
  'Veteran pressure changed the four-enemy active cap',
  longRun
);
assert(longRun.running && !longRun.gameOver, 'Long run ended unexpectedly', longRun);
assert(longRun.activePlayers >= 1, 'Long run lost all players unexpectedly', longRun);

// Let any transient audiovisual debris age; core collections should remain bounded.
const aged = await call('ageTransientState', 20);
assert(aged.particleCount === 0, 'Particles survived far beyond their lifetime', aged);
assert(aged.powerupCount === 0, 'Powerups survived far beyond their lifetime', aged);
assert(aged.bulletCount === 0, 'Bullets survived far beyond their playable lifetime', aged);

// Restart after a long run must be a true clean slate.
// Use the same reset path as the 1-player start action without waiting for a hidden overlay button.
await page.evaluate(() => document.querySelector('#startBtn').click());
await page.waitForTimeout(100);

const restarted = await call('snapshot');
assert(restarted.stage === 1 && restarted.wave === 1 && restarted.waveInStage === 1, 'Restart did not reset progression', restarted);
assert(restarted.score === 0, 'Restart retained score', restarted);
assert(restarted.bulletCount === 0, 'Restart retained bullets', restarted);
assert(restarted.powerupCount === 0, 'Restart retained powerups', restarted);
assert(restarted.particleCount === 0, 'Restart retained particles', restarted);
assert(restarted.pendingRespawns.length === 0, 'Restart retained respawn queue', restarted);
assert(restarted.pendingSpawns > 0 && restarted.waveQueue > 0, 'Restart failed to create first wave queue', restarted);
assert(restarted.running && !restarted.gameOver, 'Restart state is not playable', restarted);

if (runtimeErrors.length) {
  throw new Error(`Long-run runtime errors:\n${runtimeErrors.join('\n')}`);
}

console.log('PASS long-run lifecycle', {
  wavesCompleted: TOTAL_WAVES,
  stagesCompleted: 12,
  nextState: { stage: longRun.stage, wave: longRun.wave, waveInStage: longRun.waveInStage },
  finalScoreBeforeRestart: lastScore,
  transientCleanup: 'ok',
  restartCleanup: 'ok',
  runtimeErrors: 0,
  history,
});

await context.close();
await browser.close();
