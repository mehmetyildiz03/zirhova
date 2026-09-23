import { chromium } from 'playwright-core';

const executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
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
  if (sessionStorage.getItem('zirhova-run-smoke-seeded')) return;
  localStorage.removeItem('zirhova-campaign-checkpoint-v1');
  localStorage.setItem('zirhova-profile-v2', JSON.stringify({
    version: 3,
    bestScore: 4321,
    bestStage: 4,
    runs: 1,
    campaignRuns: 1,
    achievementIds: ['line-holder'],
    selectedSkin: 'classic',
  }));
  sessionStorage.setItem('zirhova-run-smoke-seeded', '1');
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

// 1) Unlocked stage selection must start a separate deployment record.
assert(!(await page.locator('#stageSelectBtn').isHidden()), 'Stage-select button should be visible for bestStage=4');
await page.click('#stageSelectBtn');
await page.waitForTimeout(40);

const stagePanel = await page.locator('.stage-select-panel').boundingBox();
assert(
  stagePanel &&
  stagePanel.x >= 0 &&
  stagePanel.x + stagePanel.width <= 390 &&
  stagePanel.y >= 0 &&
  stagePanel.y < 844,
  'Stage-select panel escaped mobile viewport',
  stagePanel
);

const stageButtons = await page.locator('#stageSelectGrid [data-stage]').count();
assert(stageButtons === 4, 'Stage-select did not render exactly four unlocked stages', { stageButtons });

await page.click('[data-stage="4"]');
let snap = await call('snapshot');

assert(snap.runClass === 'deployment', 'B4 select did not create deployment run', snap);
assert(snap.runStartStage === 4 && snap.stage === 4, 'B4 deployment started at wrong stage', snap);
assert(snap.wave === 10 && snap.waveInStage === 1, 'B4 deployment absolute wave is wrong', snap);
assert(snap.weaponTier === 2, 'B4 deployment did not start with weapon tier II', snap);
const deploymentUpgradeCount = Object.values(snap.upgradeLevels).reduce((sum, value) => sum + value, 0);
assert(deploymentUpgradeCount === 3, 'B4 deployment did not receive three prior-stage equivalent upgrades', snap);
assert(snap.score === 0, 'Deployment did not start from zero score', snap);
assert(snap.checkpoint === null, 'Deployment unexpectedly created/overwrote campaign checkpoint', snap);

await call('setScore', 12000);
snap = await call('endRunForTest', 'SERBEST TEST');
assert(snap.profile.bestDeploymentScore === 12000, 'Deployment record was not saved', snap.profile);
assert(snap.profile.bestScore === 4321, 'Deployment score contaminated full-run record', snap.profile);
assert(snap.profile.deploymentRuns === 1, 'Deployment run counter mismatch', snap.profile);

// 2) Start a genuine B1 campaign and create a B2 checkpoint.
await page.reload({ waitUntil: 'networkidle' });
await page.click('#startBtn');
await page.waitForTimeout(50);

for (let wave = 1; wave <= 3; wave++) {
  const cleared = await call('clearCurrentWave');
  assert(cleared.snapshot.pendingSpawns === 0, `Campaign wave ${wave} did not clear`, cleared);
  const advanced = await call('advanceLifecycle', 3.2);

  if (wave < 3) {
    assert(advanced.wave === wave + 1, `Campaign failed to advance after wave ${wave}`, advanced);
  } else {
    assert(advanced.awaitingUpgrade, 'Stage 1 finale did not open upgrade selection', advanced);
  }
}

snap = await call('chooseLifecycleUpgrade');
assert(snap.stage === 2 && snap.wave === 4 && snap.waveInStage === 1, 'Stage 2 did not start after upgrade', snap);
assert(snap.runClass === 'campaign', 'Normal progression lost campaign class', snap);
assert(snap.checkpoint?.stage === 2, 'Stage 2 checkpoint was not persisted', snap);

const checkpoint = snap.checkpoint;
assert(checkpoint.score === snap.score, 'Checkpoint score does not match live score', { checkpoint, snap });
assert(checkpoint.lives === snap.lives, 'Checkpoint lives do not match live state', { checkpoint, snap });
assert(checkpoint.baseHp === snap.baseHp, 'Checkpoint base HP does not match live state', { checkpoint, snap });
assert(checkpoint.runEnemiesDefeated === snap.runEnemiesDefeated && checkpoint.runEnemiesDefeated > 0, 'Checkpoint did not preserve run kill count', { checkpoint, snap });
assert(checkpoint.runBossesDefeated === snap.runBossesDefeated, 'Checkpoint did not preserve run boss count', { checkpoint, snap });

// 3) Reload app and resume exact checkpoint through the actual DEVAM button.
await page.reload({ waitUntil: 'networkidle' });
assert(!(await page.locator('#continueBtn').isHidden()), 'Continue button is hidden despite valid checkpoint');
const continueText = await page.locator('#continueBtn').innerText();
assert(continueText.includes('B2'), 'Continue button does not identify checkpoint stage', { continueText });

await page.click('#continueBtn');
await page.waitForTimeout(50);
snap = await call('snapshot');

assert(snap.runClass === 'campaign', 'Checkpoint resume is not campaign-class', snap);
assert(snap.stage === checkpoint.stage && snap.wave === checkpoint.wave, 'Checkpoint stage/wave was not restored', { checkpoint, snap });
assert(snap.score === checkpoint.score, 'Checkpoint score was not restored', { checkpoint, snap });
assert(snap.lives === checkpoint.lives, 'Checkpoint lives were not restored', { checkpoint, snap });
assert(snap.baseHp === checkpoint.baseHp, 'Checkpoint base HP was not restored', { checkpoint, snap });
assert(snap.runEnemiesDefeated === checkpoint.runEnemiesDefeated, 'Run kill count was not restored with checkpoint', { checkpoint, snap });
assert(snap.runBossesDefeated === checkpoint.runBossesDefeated, 'Run boss count was not restored with checkpoint', { checkpoint, snap });

// 4) Continued campaign score must update full-run record, not deployment record.
await call('setScore', 15000);
snap = await call('endRunForTest', 'DEVAM TEST');
assert(snap.profile.bestScore === 15000, 'Continued campaign did not update full-run record', snap.profile);
assert(snap.profile.bestDeploymentScore === 12000, 'Campaign score contaminated deployment record', snap.profile);
assert(snap.profile.campaignRuns >= 2, 'Campaign run count did not include resumed run', snap.profile);

if (errors.length) {
  throw new Error(`Continue/stage-select runtime errors:\n${errors.join('\n')}`);
}

console.log('PASS continue and stage select', {
  deployment: {
    startStage: 4,
    record: snap.profile.bestDeploymentScore,
  },
  checkpoint: {
    stage: checkpoint.stage,
    score: checkpoint.score,
    lives: checkpoint.lives,
    baseHp: checkpoint.baseHp,
  },
  resumedCampaignRecord: snap.profile.bestScore,
  recordIsolation: 'ok',
  runtimeErrors: 0,
});

await context.close();
await browser.close();
