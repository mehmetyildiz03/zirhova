import { chromium } from 'playwright-core';

const executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

function assert(condition, message, data) {
  if (!condition) throw new Error(data ? `${message}: ${JSON.stringify(data)}` : message);
}

async function createPage(seed) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.addInitScript(profile => {
    localStorage.removeItem('zirhova-campaign-checkpoint-v1');
    localStorage.setItem('zirhova-profile-v2', JSON.stringify(profile));
  }, seed);
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  return { context, page, errors };
}

async function call(page, method, ...args) {
  return page.evaluate(({ method, args }) => window.__zirhovaTest[method](...args), { method, args });
}

{
  const { context, page, errors } = await createPage({
    version: 3, bestScore: 0, bestSoloScore: 0, bestStage: 1, selectedSkin: 'classic',
  });
  await page.click('#startBtn');
  await page.waitForTimeout(50);
  const cleared = await call(page, 'clearCurrentWave');
  assert(cleared.snapshot.runEnemiesDefeated > 0, 'Run kill counter did not advance', cleared.snapshot);
  await call(page, 'setScore', 12000);
  const ended = await call(page, 'endRunForTest', 'TEST HATTI DÜŞTÜ');
  assert(ended.profile.bestScore === 12000 && ended.profile.bestSoloScore === 12000, 'Campaign records wrong', ended.profile);

  const s = await page.evaluate(() => ({
    visible: document.querySelector('#gameOverOverlay').classList.contains('show'),
    type: document.querySelector('#gameOverRunType').textContent.trim(),
    start: document.querySelector('[data-summary="start"] strong')?.textContent.trim(),
    stage: document.querySelector('[data-summary="stage"] strong')?.textContent.trim(),
    score: document.querySelector('[data-summary="score"] strong')?.textContent.trim(),
    kills: document.querySelector('[data-summary="kills"] strong')?.textContent.trim(),
    bosses: document.querySelector('[data-summary="bosses"] strong')?.textContent.trim(),
    record: document.querySelector('#gameOverRecord').textContent.trim(),
    isNew: document.querySelector('#gameOverRecord').classList.contains('new-record'),
    context: document.querySelector('#gameOverText').textContent.trim(),
    unlocksHidden: document.querySelector('#gameOverUnlocks').hidden,
    unlocks: document.querySelector('#gameOverUnlockList').innerText,
    panel: (() => { const r=document.querySelector('.game-over-panel').getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}; })(),
    viewport: {width:innerWidth,height:innerHeight},
  }));
  assert(s.visible && s.type === 'TAM KOŞU · 1 OYUNCU', 'Campaign summary type wrong', s);
  assert(s.start === 'B1' && s.stage === 'B1' && s.score === '12000', 'Campaign summary values wrong', s);
  assert(Number(s.kills) > 0 && s.bosses === '0', 'Campaign kill summary wrong', s);
  assert(s.isNew && s.record.includes('YENİ TAM KOŞU REKORU') && s.record.includes('YENİ SOLO REKORU'), 'Campaign new record missing', s);
  assert(s.context.includes('TAM KOŞU') && s.context.includes('SOLO'), 'Campaign record context unclear', s);
  assert(!s.unlocksHidden && s.unlocks.includes('İLK TEMAS') && s.unlocks.includes('BEŞ HANELİ') && s.unlocks.includes('FİLDİŞİ'), 'Run unlocks missing', s);
  assert(s.panel.x >= 0 && s.panel.y >= 0 && s.panel.right <= s.viewport.width + 1 && s.panel.bottom <= s.viewport.height + 1, 'Summary escaped mobile viewport', s);
  assert(errors.length === 0, 'Campaign runtime errors', errors);
  console.log('PASS run summary campaign');
  await context.close();
}

{
  const { context, page, errors } = await createPage({
    version: 3, bestScore: 4321, bestSoloScore: 4321, bestDeploymentScore: 1000,
    bestStage: 4, campaignRuns: 1, selectedSkin: 'classic',
  });
  await page.click('#stageSelectBtn');
  await page.click('[data-stage="4"]');
  await page.waitForTimeout(50);
  await call(page, 'setScore', 12000);
  const ended = await call(page, 'endRunForTest', 'SERBEST TEST');
  assert(ended.profile.bestDeploymentScore === 12000, 'Deployment record missing', ended.profile);
  assert(ended.profile.bestScore === 4321, 'Deployment contaminated campaign record', ended.profile);
  const s = await page.evaluate(() => ({
    type: document.querySelector('#gameOverRunType').textContent.trim(),
    start: document.querySelector('[data-summary="start"] strong')?.textContent.trim(),
    record: document.querySelector('#gameOverRecord').textContent.trim(),
    context: document.querySelector('#gameOverText').textContent.trim(),
  }));
  assert(s.type === 'SERBEST · B4 · 1 OYUNCU' && s.start === 'B4', 'Deployment summary identity wrong', s);
  assert(s.record.includes('YENİ SERBEST REKORU'), 'Deployment record banner missing', s);
  assert(s.context.includes('SERBEST') && s.context.includes('TAM KOŞU rekorunu etkilemez'), 'Deployment isolation copy missing', s);
  assert(errors.length === 0, 'Deployment runtime errors', errors);
  console.log('PASS run summary deployment');
  await context.close();
}

await browser.close();
