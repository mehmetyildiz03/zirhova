import { chromium } from 'playwright-core';

const executablePath =
  process.env.CHROME_PATH ||
  '/usr/bin/google-chrome';

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const cases = [
  { name: 'iPhone SE portrait', width: 375, height: 667, mobile: true },
  { name: 'iPhone 13 portrait', width: 390, height: 844, mobile: true },
  { name: 'phone landscape', width: 844, height: 390, mobile: true },
  { name: 'iPad portrait', width: 768, height: 1024, mobile: true },
  { name: 'iPad landscape', width: 1024, height: 768, mobile: true },
];

function overlap(a, b) {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y;
}

for (const testCase of cases) {
  const context = await browser.newContext({
    viewport: { width: testCase.width, height: testCase.height },
    isMobile: testCase.mobile,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });

  const metrics = await page.evaluate(() => {
    const box = selector => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };

    return {
      game: box('.game-wrap'),
      dpad: box('#directionPad'),
      fire: box('.fire'),
      hud: box('.hud'),
      controlsDisplay: getComputedStyle(document.querySelector('.controls')).display,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    };
  });

  const fail = message => {
    throw new Error(`${testCase.name}: ${message}\n${JSON.stringify(metrics, null, 2)}`);
  };

  if (metrics.controlsDisplay === 'none') fail('touch controls are hidden');
  if (!metrics.game || !metrics.dpad || !metrics.fire || !metrics.hud) fail('required UI box missing');

  for (const [name, rect] of [['game', metrics.game], ['dpad', metrics.dpad], ['fire', metrics.fire], ['hud', metrics.hud]]) {
    if (rect.x < -1 || rect.y < -1 || rect.right > metrics.innerWidth + 1 || rect.bottom > metrics.innerHeight + 1) {
      fail(`${name} is outside viewport`);
    }
  }

  if (metrics.dpad.width < 136 || metrics.dpad.height < 136) fail('direction pad too small');
  if (metrics.fire.width < 100 || metrics.fire.height < 100) fail('fire control too small');

  if (testCase.width > testCase.height) {
    if (overlap(metrics.game, metrics.dpad) > 4) fail('landscape D-pad overlaps game board');
    if (overlap(metrics.game, metrics.fire) > 4) fail('landscape fire control overlaps game board');
  }

  if (metrics.scrollWidth > metrics.innerWidth + 2) fail('horizontal overflow detected');

  console.log(`PASS ${testCase.name}`, metrics);
  await context.close();
}

await browser.close();
