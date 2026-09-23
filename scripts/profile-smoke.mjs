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
  if (sessionStorage.getItem('zirhova-profile-smoke-seeded')) return;
  localStorage.removeItem('zirhova-profile-v2');
  localStorage.setItem('zirhova-progress-v1', JSON.stringify({
    bestScore: 4321,
    bestStage: 4,
  }));
  sessionStorage.setItem('zirhova-profile-smoke-seeded', '1');
});

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });

async function snapshot() {
  return page.evaluate(() => window.__zirhovaTest.snapshot());
}

let snap = await snapshot();
if (snap.profile.bestScore !== 4321 || snap.profile.bestStage !== 4) {
  throw new Error(`Legacy profile migration failed: ${JSON.stringify(snap.profile)}`);
}
if (!snap.profile.unlockedSkins.includes('cobalt')) {
  throw new Error(`Migrated best stage did not unlock cobalt: ${JSON.stringify(snap.profile)}`);
}
if (!snap.profile.achievementIds.includes('line-holder')) {
  throw new Error(`Migrated stage achievement missing: ${JSON.stringify(snap.profile)}`);
}

await page.click('#profileBtn');
await page.waitForTimeout(50);

const overlayVisible = await page.locator('#profileOverlay.show').count();
if (!overlayVisible) throw new Error('Profile overlay did not open');

const statsText = await page.locator('#profileStats').innerText();
if (!statsText.includes('4321') || !statsText.includes('B4')) {
  throw new Error(`Profile UI did not render migrated records: ${statsText}`);
}

const panelBox = await page.locator('.profile-panel').boundingBox();
if (!panelBox || panelBox.x < 0 || panelBox.x + panelBox.width > 390 || panelBox.y < 0 || panelBox.y >= 844) {
  throw new Error(`Profile panel escaped mobile viewport: ${JSON.stringify(panelBox)}`);
}

const cobalt = page.locator('[data-skin="cobalt"]');
const ember = page.locator('[data-skin="ember"]');
if (await cobalt.isDisabled()) throw new Error('Unlocked cobalt skin is disabled');
if (!(await ember.isDisabled())) throw new Error('Locked ember skin is unexpectedly selectable');

await cobalt.click();
snap = await snapshot();
if (snap.profile.selectedSkin !== 'cobalt') {
  throw new Error(`Cobalt selection did not update profile: ${JSON.stringify(snap.profile)}`);
}

await page.click('#profileCloseBtn');
if (await page.locator('#profileOverlay.show').count()) {
  throw new Error('Profile overlay did not close');
}

// Selection must survive a full reload.
await page.reload({ waitUntil: 'networkidle' });
snap = await snapshot();
if (snap.profile.selectedSkin !== 'cobalt') {
  throw new Error(`Selected cosmetic did not survive reload: ${JSON.stringify(snap.profile)}`);
}

await page.click('#profileBtn');
const selectedPressed = await page.locator('[data-skin="cobalt"]').getAttribute('aria-pressed');
if (selectedPressed !== 'true') {
  throw new Error('Persisted cobalt skin is not marked selected in profile UI');
}

const earnedCount = await page.locator('.achievement-card.earned').count();
if (earnedCount < 1) {
  throw new Error('Migrated profile rendered no earned achievements');
}

if (errors.length) {
  throw new Error(`Profile runtime errors:\n${errors.join('\n')}`);
}

console.log('PASS profile persistence', {
  migratedBestScore: snap.profile.bestScore,
  migratedBestStage: snap.profile.bestStage,
  selectedSkin: snap.profile.selectedSkin,
  unlockedSkins: snap.profile.unlockedSkins,
  earnedAchievements: earnedCount,
  runtimeErrors: 0,
});

await context.close();
await browser.close();
