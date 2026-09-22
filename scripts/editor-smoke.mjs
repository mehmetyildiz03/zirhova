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

await page.goto('http://127.0.0.1:4173/editor.html', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('zirhova-custom-level-v1'));
await page.reload({ waitUntil: 'networkidle' });

const metrics = await page.evaluate(() => {
  const canvas = document.querySelector('#editorCanvas').getBoundingClientRect();
  return {
    canvas: { x: canvas.x, y: canvas.y, right: canvas.right, bottom: canvas.bottom, width: canvas.width, height: canvas.height },
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  };
});

if (metrics.canvas.x < -1 || metrics.canvas.right > metrics.innerWidth + 1) {
  throw new Error(`Editor canvas outside viewport: ${JSON.stringify(metrics)}`);
}
if (metrics.scrollWidth > metrics.innerWidth + 2) {
  throw new Error(`Editor horizontal overflow: ${JSON.stringify(metrics)}`);
}

const box = await page.locator('#editorCanvas').boundingBox();
if (!box) throw new Error('Editor canvas missing');

const cell = 3;
const cellSize = box.width / 16;
await page.mouse.click(
  box.x + (cell + 0.5) * cellSize,
  box.y + (cell + 0.5) * cellSize
);

await page.click('#exportBtn');
const jsonText = await page.locator('#jsonBox').inputValue();
const exported = JSON.parse(jsonText);

if (!exported.bricks.some(([x, y]) => x === cell && y === cell)) {
  throw new Error('Painted brick did not appear in exported map JSON');
}
if (exported.enemySpawns.length < 2) {
  throw new Error('Default editor map lost required enemy spawns');
}

await page.click('#undoBtn');
await page.click('#exportBtn');
const undone = JSON.parse(await page.locator('#jsonBox').inputValue());
if (undone.bricks.some(([x, y]) => x === cell && y === cell)) {
  throw new Error('Undo did not remove painted brick');
}

await page.click('#redoBtn');
await page.click('#saveBtn');

const stored = await page.evaluate(() => localStorage.getItem('zirhova-custom-level-v1'));
if (!stored) throw new Error('Editor save did not persist custom map');
const parsedStored = JSON.parse(stored);
if (!parsedStored.bricks.some(([x, y]) => x === cell && y === cell)) {
  throw new Error('Saved map is missing painted brick');
}

await page.goto('http://127.0.0.1:4173/?custom=1', { waitUntil: 'networkidle' });

const mode = await page.evaluate(() => document.body.dataset.gameMode);
if (mode !== 'custom') throw new Error(`Game did not enter custom mode: ${mode}`);

const startLabel = (await page.locator('#startBtn').textContent())?.trim();
if (startLabel !== 'ÖZEL HARİTAYI BAŞLAT') {
  throw new Error(`Custom start label invalid: ${startLabel}`);
}

await page.click('#startBtn');
await page.waitForTimeout(900);

if (errors.length) {
  throw new Error(`Editor/custom-map runtime errors:\n${errors.join('\n')}`);
}

console.log('PASS editor smoke', {
  paint: 'ok',
  undoRedo: 'ok',
  save: 'ok',
  customLaunch: 'ok',
  runtimeErrors: 0,
});

await context.close();
await browser.close();
