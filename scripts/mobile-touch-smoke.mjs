import { chromium } from 'playwright-core';

const executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';

const cases = [
  { name: 'phone portrait', width: 390, height: 844 },
  { name: 'phone landscape', width: 844, height: 390 },
];

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

function point(x, y, id) {
  return {
    x,
    y,
    id,
    radiusX: 6,
    radiusY: 6,
    rotationAngle: 0,
    force: 1,
  };
}

for (const testCase of cases) {
  const context = await browser.newContext({
    viewport: { width: testCase.width, height: testCase.height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.click('#startBtn');
  await page.waitForTimeout(300);

  const dpad = await page.locator('#directionPad').boundingBox();
  const fire = await page.locator('.fire').boundingBox();
  if (!dpad || !fire) throw new Error(`${testCase.name}: control boxes missing`);

  const session = await context.newCDPSession(page);

  const upPoint = point(
    dpad.x + dpad.width / 2,
    dpad.y + dpad.height * 0.14,
    1
  );

  const firePoint = point(
    fire.x + fire.width / 2,
    fire.y + fire.height / 2,
    2
  );

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [upPoint, firePoint],
  });

  await page.waitForTimeout(160);

  let snap = await page.evaluate(() => window.__zirhovaTest?.snapshot());
  if (!snap) throw new Error(`${testCase.name}: diagnostics missing`);

  if (!snap.touchInput.up || !snap.touchInput.fire) {
    throw new Error(
      `${testCase.name}: simultaneous move+fire failed: ${JSON.stringify(snap.touchInput)}`
    );
  }

  if (snap.p1?.dir !== 'up') {
    throw new Error(`${testCase.name}: tank did not face up under touch input`);
  }

  const bulletsAfterHold = snap.bullets;
  if (bulletsAfterHold < 1) {
    throw new Error(`${testCase.name}: holding fire did not create a projectile`);
  }

  const rightPoint = point(
    dpad.x + dpad.width * 0.86,
    dpad.y + dpad.height / 2,
    1
  );

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [rightPoint, firePoint],
  });

  await page.waitForTimeout(160);

  snap = await page.evaluate(() => window.__zirhovaTest.snapshot());
  if (!snap.touchInput.right || snap.touchInput.up || !snap.touchInput.fire) {
    throw new Error(
      `${testCase.name}: slide-to-turn while firing failed: ${JSON.stringify(snap.touchInput)}`
    );
  }

  if (snap.p1?.dir !== 'right') {
    throw new Error(`${testCase.name}: tank did not rotate right after D-pad slide`);
  }

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });

  await page.waitForTimeout(120);

  snap = await page.evaluate(() => window.__zirhovaTest.snapshot());
  if (Object.values(snap.touchInput).some(Boolean)) {
    throw new Error(
      `${testCase.name}: touch input remained stuck after release: ${JSON.stringify(snap.touchInput)}`
    );
  }

  const activeDirection = await page.locator('.dir-cap.active').count();
  const fireActive = await page.locator('.fire.active').count();
  if (activeDirection || fireActive) {
    throw new Error(`${testCase.name}: control visuals remained stuck after touch release`);
  }

  if (errors.length) {
    throw new Error(`${testCase.name}: runtime errors:\n${errors.join('\n')}`);
  }

  console.log(`PASS ${testCase.name} multi-touch`, {
    moveAndFire: 'ok',
    slideTurnWhileFiring: 'ok',
    releaseCleanup: 'ok',
    bulletsAfterHold,
  });

  await session.detach();
  await context.close();
}

await browser.close();
