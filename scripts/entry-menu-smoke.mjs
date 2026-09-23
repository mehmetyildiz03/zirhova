import { chromium } from 'playwright-core';

const executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const checkpoint = {
  version: 1,
  stage: 2,
  wave: 4,
  waveInStage: 1,
  score: 1560,
  lives: 3,
  baseHp: 5,
  weaponTier: 1,
  arsenalMisses: 0,
  coop: false,
  modifiers: {
    speed: 1,
    fireRate: 1,
    bulletSpeed: 1,
    armor: 0,
    shotPower: 1,
  },
  upgradeLevels: {
    tracks: 1,
    loader: 0,
    velocity: 0,
    armor: 0,
    cannon: 0,
  },
};

const cases = [
  { name: 'iPhone SE portrait', width: 375, height: 667, mobile: true },
  { name: 'iPhone 13 portrait', width: 390, height: 844, mobile: true },
  { name: 'phone landscape', width: 844, height: 390, mobile: true },
  { name: 'desktop', width: 1280, height: 900, mobile: false },
];

function fail(name, message, data) {
  throw new Error(`${name}: ${message}${data ? `\n${JSON.stringify(data, null, 2)}` : ''}`);
}

for (const testCase of cases) {
  const context = await browser.newContext({
    viewport: { width: testCase.width, height: testCase.height },
    isMobile: testCase.mobile,
    hasTouch: testCase.mobile,
    deviceScaleFactor: testCase.mobile ? 2 : 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.addInitScript(seed => {
    localStorage.setItem('zirhova-profile-v2', JSON.stringify({
      version: 3,
      bestScore: 4321,
      bestStage: 4,
      runs: 1,
      campaignRuns: 1,
      achievementIds: ['line-holder'],
      selectedSkin: 'classic',
    }));
    localStorage.setItem('zirhova-campaign-checkpoint-v1', JSON.stringify(seed));
  }, checkpoint);

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });

  const state = await page.evaluate(() => {
    const box = selector => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const style = selector => getComputedStyle(document.querySelector(selector));
    return {
      innerWidth,
      innerHeight,
      bodyMenuOpen: document.body.classList.contains('menu-open'),
      intro: box('#introOverlay'),
      panel: box('.entry-panel'),
      hudDisplay: style('.hud').display,
      controlsDisplay: style('.controls').display,
      continueHidden: document.querySelector('#continueBtn').hidden,
      continueText: document.querySelector('#continueBtn').textContent.trim(),
      continueSecondary: document.querySelector('#continueBtn').classList.contains('secondary'),
      startText: document.querySelector('#startBtn').textContent.trim(),
      startSecondary: document.querySelector('#startBtn').classList.contains('secondary'),
      warningHidden: document.querySelector('#checkpointWarning').hidden,
      warningText: document.querySelector('#checkpointWarning').textContent.trim(),
    };
  });

  if (!state.bodyMenuOpen) fail(testCase.name, 'body is not marked menu-open', state);
  if (!state.intro || state.intro.x < -1 || state.intro.y < -1 ||
      state.intro.right > state.innerWidth + 1 || state.intro.bottom > state.innerHeight + 1) {
    fail(testCase.name, 'entry overlay is not viewport-bound', state);
  }
  if (!state.panel || state.panel.x < -1 || state.panel.y < -1 ||
      state.panel.right > state.innerWidth + 1 || state.panel.bottom > state.innerHeight + 1) {
    fail(testCase.name, 'entry panel escaped viewport', state);
  }
  if (state.hudDisplay !== 'none' || state.controlsDisplay !== 'none') {
    fail(testCase.name, 'gameplay HUD/controls are visible behind the entry menu', state);
  }
  if (state.continueHidden || state.continueText !== 'DEVAM · B2' || state.continueSecondary) {
    fail(testCase.name, 'checkpoint resume is not the primary CTA', state);
  }
  if (state.startText !== 'YENİ TAM KOŞU' || !state.startSecondary) {
    fail(testCase.name, 'new campaign is not demoted while checkpoint exists', state);
  }
  if (state.warningHidden || !state.warningText.includes('DEVAM')) {
    fail(testCase.name, 'destructive new-run warning is missing', state);
  }

  await page.click('#stageSelectBtn');
  const stageState = await page.evaluate(() => ({
    mode: document.querySelector('#stageSelectModeText').textContent.trim(),
    warningHidden: document.querySelector('#stageSelectWarning').hidden,
    warning: document.querySelector('#stageSelectWarning').textContent.trim(),
    b1: document.querySelector('[data-stage="1"]').innerText,
    b2: document.querySelector('[data-stage="2"]').innerText,
  }));

  if (stageState.mode !== '1 OYUNCU · BÖLÜM SEÇİMİ') {
    fail(testCase.name, 'stage selector still mislabels the whole screen as deployment', stageState);
  }
  if (stageState.warningHidden || !stageState.warning.includes('B2')) {
    fail(testCase.name, 'checkpoint preservation warning is missing in stage selector', stageState);
  }
  if (!stageState.b1.includes('YENİ TAM KOŞU') || !stageState.b1.includes('DEVAM SİLİNİR')) {
    fail(testCase.name, 'B1 destructive semantics are not explicit', stageState);
  }
  if (!stageState.b2.includes('SERBEST')) {
    fail(testCase.name, 'B2 deployment classification is missing', stageState);
  }

  await page.click('#stageSelectCloseBtn');
  await page.click('#continueBtn');
  await page.waitForTimeout(80);

  const started = await page.evaluate(() => ({
    menuOpen: document.body.classList.contains('menu-open'),
    introOpen: document.querySelector('#introOverlay').classList.contains('show'),
    hudDisplay: getComputedStyle(document.querySelector('.hud')).display,
  }));
  if (started.menuOpen || started.introOpen || started.hudDisplay === 'none') {
    fail(testCase.name, 'resume did not transition cleanly from menu to gameplay', started);
  }

  if (errors.length) fail(testCase.name, 'runtime errors', errors);
  console.log(`PASS entry menu UX ${testCase.name}`);
  await context.close();
}

// Fresh profile: the normal solo start must remain the sole primary CTA.
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.removeItem('zirhova-campaign-checkpoint-v1');
    localStorage.setItem('zirhova-profile-v2', JSON.stringify({
      version: 3,
      bestStage: 1,
      selectedSkin: 'classic',
    }));
  });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });

  const fresh = await page.evaluate(() => ({
    startText: document.querySelector('#startBtn').textContent.trim(),
    startSecondary: document.querySelector('#startBtn').classList.contains('secondary'),
    continueHidden: document.querySelector('#continueBtn').hidden,
    stageHidden: document.querySelector('#stageSelectBtn').hidden,
    warningHidden: document.querySelector('#checkpointWarning').hidden,
  }));

  if (fresh.startText !== '1 OYUNCU' || fresh.startSecondary ||
      !fresh.continueHidden || !fresh.stageHidden || !fresh.warningHidden) {
    fail('fresh profile', 'fresh-player entry hierarchy is incorrect', fresh);
  }

  console.log('PASS entry menu UX fresh profile');
  await context.close();
}

await browser.close();
