import {
  MAX_AUDIO_VOICES,
  cannonRecipe,
  impactRecipe,
  explosionRecipe,
  bossAlertRecipe,
  pickupRecipe,
} from '../src/audioSystem.js';

function assert(condition, message, data) {
  if (!condition) throw new Error(data ? `${message}: ${JSON.stringify(data)}` : message);
}

assert(MAX_AUDIO_VOICES === 24, 'Audio voice budget changed unexpectedly');

const p1 = cannonRecipe({ player: true, tier: 1 });
const p2 = cannonRecipe({ player: true, tier: 2 });
const p3 = cannonRecipe({ player: true, tier: 3, strong: true });
const enemy = cannonRecipe({ player: false, strong: false });
const boss = cannonRecipe({ boss: true });

assert(p1.tones.length >= 1 && p1.noise, 'Tier I cannon recipe incomplete', p1);
assert(p2.tones.length > p1.tones.length, 'Tier II cannon should gain a low-frequency layer', { p1, p2 });
assert(p3.tones[0].freq < p1.tones[0].freq, 'Tier III cannon should sound heavier than Tier I', { p1, p3 });
assert(enemy.tones[0].freq !== p1.tones[0].freq, 'Enemy cannon should not match player cannon');
assert(boss.tones.length >= 2 && boss.noise, 'Boss cannon must be multi-layered', boss);

const brick = impactRecipe('brick');
const steel = impactRecipe('steel');
const armor = impactRecipe('bossArmor');
assert(brick.noise.filter < steel.noise.filter, 'Brick impact should be duller than steel', { brick, steel });
assert(armor.tones[0].freq > steel.tones[0].freq, 'Boss armor impact should ring brighter than steel', { armor, steel });

const regularExplosion = explosionRecipe({});
const heavyExplosion = explosionRecipe({ heavy: true });
const bossExplosion = explosionRecipe({ boss: true });
assert(
  heavyExplosion.tones[0].duration > regularExplosion.tones[0].duration,
  'Heavy explosion should last longer than regular explosion'
);
assert(
  bossExplosion.tones.length > regularExplosion.tones.length &&
  bossExplosion.noise.duration > heavyExplosion.noise.duration,
  'Boss explosion should be the deepest/longest recipe'
);

const phase1 = bossAlertRecipe(1);
const phase2 = bossAlertRecipe(2);
assert(phase1.tones.length === 3, 'Boss entry alert should have three pulses');
assert(phase2.tones.length === 2, 'Boss phase-two alert should have two pulses');

const utility = pickupRecipe('repair');
const arsenal = pickupRecipe('arsenal');
assert(arsenal.tones.length === 2 && utility.tones.length === 2, 'Pickup recipes incomplete');
const arsenalPeak = Math.max(...arsenal.tones.map(tone => tone.endFreq));
const utilityPeak = Math.max(...utility.tones.map(tone => tone.endFreq));
assert(
  arsenalPeak > utilityPeak,
  'Arsenal pickup should reach a higher final pitch than utility pickup',
  { arsenalPeak, utilityPeak }
);

console.log('PASS audio recipes', {
  voiceBudget: MAX_AUDIO_VOICES,
  cannonLayers: {
    tier1: p1.tones.length,
    tier2: p2.tones.length,
    tier3: p3.tones.length,
    boss: boss.tones.length,
  },
  impacts: 'brick/steel/boss armor distinct',
  bossAlerts: 'entry/phase2 distinct',
});
