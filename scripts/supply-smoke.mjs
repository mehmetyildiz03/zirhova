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
  localStorage.setItem('zirhova-profile-v2', JSON.stringify({
    version: 4,
    bestStage: 13,
    bestScore: 18000,
    bestSoloScore: 18000,
    selectedSkin: 'classic',
  }));
  localStorage.setItem('zirhova-campaign-checkpoint-v1', JSON.stringify({
    version: 1,
    stage: 13,
    wave: 37,
    waveInStage: 1,
    score: 18000,
    lives: 6,
    baseHp: 5,
    weaponTier: 3,
    arsenalMisses: 0,
    coop: false,
    runEnemiesDefeated: 120,
    runBossesDefeated: 4,
    stageSupply: null,
    modifiers: {
      speed: 1.331,
      fireRate: 0.636,
      bulletSpeed: 1.405,
      armor: 2,
      shotPower: 3,
    },
    upgradeLevels: {
      tracks: 3,
      loader: 3,
      velocity: 3,
      armor: 2,
      cannon: 2,
    },
  }));
});

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.click('#continueBtn');
await page.waitForTimeout(50);

function assert(condition, message, data) {
  if (!condition) throw new Error(data ? `${message}: ${JSON.stringify(data)}` : message);
}

async function call(method, ...args) {
  return page.evaluate(({ method, args }) => window.__zirhovaTest[method](...args), { method, args });
}

async function choiceState() {
  return page.evaluate(() => ({
    title: document.querySelector('#upgradeTitle')?.textContent.trim(),
    choices: [...document.querySelectorAll('#upgradeChoices .upgrade-card')].map(button => ({
      id: button.dataset.choiceId,
      kind: button.dataset.choiceKind,
      title: button.querySelector('strong')?.textContent.trim(),
      rank: button.querySelector('small')?.textContent.trim(),
    })),
  }));
}

await call('setLifecycle', { stage: 13, wave: 39, waveInStage: 3 });
await call('setUpgradeLevels', { tracks: 3, loader: 3, velocity: 3, armor: 2, cannon: 2 });
await call('setResources', { lives: 6, baseHp: 5 });
await call('showUpgradeSelectionForTest');

let ui = await choiceState();
assert(ui.title.includes('TAKTİK İKMAL'), 'Maxed build did not enter tactical supply mode', ui);
assert(ui.choices.length === 3, 'Full-resource supply mode must show three choices', ui);
assert(ui.choices.every(item => item.kind === 'supply' && item.rank === 'SONRAKİ BÖLÜM'), 'Supply cards are not clearly identified', ui);
assert(!ui.choices.some(item => ['repair','reserve'].includes(item.id)), 'Full resources exposed a no-op contextual supply', ui);

// Base at 4/5 auto-heals to 5 on transition, so repair would still be a no-op and must stay hidden.
await call('setResources', { lives: 6, baseHp: 4 });
await call('showUpgradeSelectionForTest');
ui = await choiceState();
assert(!ui.choices.some(item => item.id === 'repair'), 'Repair appeared even though automatic stage heal already reaches full HP', ui);
assert(!ui.choices.some(item => item.id === 'reserve'), 'Reserve appeared at max lives', ui);

// At 3/5 base and 5 lives, both contextual supplies are genuinely useful and must be guaranteed.
await call('setResources', { lives: 5, baseHp: 3 });
await call('showUpgradeSelectionForTest');
ui = await choiceState();
assert(ui.choices.some(item => item.id === 'repair'), 'Useful repair supply was not guaranteed', ui);
assert(ui.choices.some(item => item.id === 'reserve'), 'Useful reserve supply was not guaranteed', ui);

// Restore full resources and choose EMP; it must apply after B14 loads and survive a campaign checkpoint reload.
await call('setResources', { lives: 6, baseHp: 5 });
await call('showUpgradeSelectionForTest');
await page.click('[data-choice-id="emp"]');
await page.waitForTimeout(30);

let snap = await call('snapshot');
assert(snap.stage === 14 && snap.wave === 40 && snap.waveInStage === 1, 'Supply selection did not advance to B14', snap);
assert(snap.stageSupply === 'emp' && snap.activeStageSupply?.effect === 'emp', 'EMP supply identity was not activated', snap);
assert(snap.enemyFreeze > 4.8, 'EMP supply did not freeze the opening of the next stage', snap);
assert(snap.checkpoint?.stage === 14 && snap.checkpoint?.stageSupply === 'emp', 'Campaign checkpoint did not persist the active supply', snap.checkpoint);

await page.reload({ waitUntil: 'networkidle' });
await page.click('#continueBtn');
await page.waitForTimeout(40);
snap = await call('snapshot');
assert(snap.stage === 14 && snap.stageSupply === 'emp', 'Checkpoint reload lost stage supply identity', snap);
assert(snap.enemyFreeze > 4.8, 'Checkpoint reload did not restore the stage-start EMP effect', snap);

assert(errors.length === 0, 'Supply runtime errors', errors);

console.log('PASS tactical stage supplies', {
  mode: 'TAKTİK İKMAL',
  noOpSuppression: 'ok',
  contextualPriority: 'ok',
  selected: 'emp',
  checkpointRestore: 'ok',
  runtimeErrors: 0,
});

await context.close();
await browser.close();
