import { chromium } from 'playwright-core';

const executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
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
await page.waitForTimeout(80);

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

const before = await call('audioDebug');
assert(before.maxVoices === 24, 'Unexpected audio voice budget', before);

const exercised = await call('exerciseAudio');
assert(
  exercised.peakVoices <= exercised.maxVoices,
  'Audio engine exceeded its simultaneous voice budget',
  exercised
);
assert(
  exercised.rateLimited > 0,
  'Rapid sound burst did not trigger rate limiting',
  exercised
);
assert(
  exercised.eventCount > 0,
  'Audio exercise emitted no sound events',
  exercised
);

await page.waitForTimeout(700);
const settled = await call('audioDebug');
assert(
  settled.activeVoices <= 2,
  'Audio voices did not settle after short effects ended',
  settled
);
assert(
  settled.peakVoices <= settled.maxVoices,
  'Peak audio voice count exceeded hard budget',
  settled
);

// Real player movement/firing path should also remain bounded.
await page.keyboard.down('KeyW');
await page.keyboard.down('Space');
await page.waitForTimeout(450);
await page.keyboard.up('Space');
await page.keyboard.up('KeyW');
await page.waitForTimeout(500);

const gameplay = await call('audioDebug');
assert(
  gameplay.peakVoices <= gameplay.maxVoices,
  'Real movement/fire audio exceeded voice budget',
  gameplay
);

if (runtimeErrors.length) {
  throw new Error(`Audio runtime errors:\n${runtimeErrors.join('\n')}`);
}

console.log('PASS audio smoke', {
  supported: gameplay.supported,
  state: gameplay.state,
  peakVoices: gameplay.peakVoices,
  maxVoices: gameplay.maxVoices,
  rateLimited: gameplay.rateLimited,
  eventCount: gameplay.eventCount,
  activeAfterSettling: gameplay.activeVoices,
  runtimeErrors: 0,
});

await context.close();
await browser.close();
