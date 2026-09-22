import {
  BOSS_TYPE,
  isBossWave,
  bossTier,
  bossStats,
  bossPhase,
  isFrontalBossHit,
  bossDamageResult,
} from '../src/bossSystem.js';

function assert(condition, message, data) {
  if (!condition) {
    throw new Error(data ? `${message}: ${JSON.stringify(data)}` : message);
  }
}

assert(BOSS_TYPE === 'bastion', 'Boss type changed unexpectedly');

for (let stage = 1; stage <= 9; stage++) {
  for (let local = 1; local <= 3; local++) {
    const expected = stage % 3 === 0 && local === 3;
    assert(
      isBossWave(stage, local) === expected,
      `Boss cadence mismatch at stage ${stage} wave ${local}`
    );
  }
}

assert(bossTier(3) === 1, 'Stage 3 must be boss tier 1');
assert(bossTier(6) === 2, 'Stage 6 must be boss tier 2');
assert(bossTier(9) === 3, 'Stage 9 must be boss tier 3');

const tier1 = bossStats(3);
const tier2 = bossStats(6);
assert(tier1.hp === 8, 'First boss must start at 8 HP', tier1);
assert(tier2.hp > tier1.hp, 'Later boss tier must gain HP', { tier1, tier2 });
assert(tier2.score > tier1.score, 'Later boss tier must award more score', { tier1, tier2 });

assert(bossPhase(8, 8) === 1, 'Full-health boss should be phase 1');
assert(bossPhase(5, 8) === 1, 'Boss should stay phase 1 above 50% HP');
assert(bossPhase(4, 8) === 2, 'Boss should enter phase 2 at 50% HP');
assert(bossPhase(1, 8) === 2, 'Low-health boss should remain phase 2');

const frontalCases = [
  ['up', 0, 1],
  ['down', 0, -1],
  ['left', 1, 0],
  ['right', -1, 0],
];
for (const [facing, dx, dy] of frontalCases) {
  assert(
    isFrontalBossHit(facing, dx, dy),
    `Frontal hit not detected for ${facing}`
  );
  const result = bossDamageResult({ facing, bulletDx: dx, bulletDy: dy, damage: 3 });
  assert(result.blocked && result.damage === 0, 'Front armor failed to block', {
    facing, dx, dy, result,
  });
}

const side = bossDamageResult({
  facing: 'up',
  bulletDx: 1,
  bulletDy: 0,
  damage: 2,
});
assert(!side.blocked && side.damage === 2, 'Side hit should damage boss', side);

const rear = bossDamageResult({
  facing: 'up',
  bulletDx: 0,
  bulletDy: -1,
  damage: 2,
});
assert(!rear.blocked && rear.damage === 2, 'Rear hit should damage boss', rear);

const artillery = bossDamageResult({
  facing: 'up',
  bulletDx: 0,
  bulletDy: 1,
  damage: 2,
  bypassArmor: true,
});
assert(!artillery.blocked && artillery.damage === 2, 'Armor bypass should damage boss', artillery);

console.log('PASS boss mechanics', {
  cadence: 'every third-stage finale',
  tier1,
  tier2,
  frontalArmor: 'ok',
  phaseThreshold: '50%',
});
