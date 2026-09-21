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
await page.waitForTimeout(700);

const introVisible = await page.locator('#introOverlay').evaluate(el => el.classList.contains('show'));
if (introVisible) throw new Error('Intro overlay stayed open after starting game');

const remainingText = (await page.locator('#remaining').textContent())?.trim();
const remaining = Number(remainingText);
if (!Number.isFinite(remaining) || remaining <= 0) {
  throw new Error(`Invalid remaining enemy count: ${remainingText}`);
}

// Exercise fixed D-pad pointer handling.
const dpad = await page.locator('#directionPad').boundingBox();
if (!dpad) throw new Error('Direction pad missing');

await page.mouse.move(
  dpad.x + dpad.width / 2,
  dpad.y + dpad.height * 0.14
);
await page.mouse.down();
await page.waitForTimeout(80);

const upActive = await page.locator('.dir-up').evaluate(el => el.classList.contains('active'));
if (!upActive) throw new Error('D-pad UP direction did not activate');

await page.mouse.up();

// Exercise fire hold/release through a browser-generated pointer sequence.
const fireBox = await page.locator('.fire').boundingBox();
if (!fireBox) throw new Error('Fire control missing');

await page.mouse.move(
  fireBox.x + fireBox.width / 2,
  fireBox.y + fireBox.height / 2
);
await page.mouse.down();
await page.waitForTimeout(120);

const fireActive = await page.locator('.fire').evaluate(el => el.classList.contains('active'));
if (!fireActive) throw new Error('Fire control did not activate');

await page.mouse.up();

await page.waitForTimeout(1600);

if (errors.length) {
  throw new Error(`Runtime browser errors:\n${errors.join('\n')}`);
}

const finalRemaining = Number((await page.locator('#remaining').textContent())?.trim());
if (!Number.isFinite(finalRemaining) || finalRemaining < 0) {
  throw new Error(`Remaining enemy count became invalid: ${finalRemaining}`);
}

console.log('PASS gameplay smoke', {
  initialRemaining: remaining,
  finalRemaining,
  dpad: 'ok',
  fire: 'ok',
  runtimeErrors: 0,
});

await context.close();
await browser.close();
