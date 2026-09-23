import {
  BOSS_TYPE,
  SECOND_BOSS_TYPE,
  isBossWave,
  bossTier,
  bossTypeForStage,
  bossName,
  bossStats,
  bossPhase,
  isFrontalBossHit,
  bossDamageResult,
  pincerVolleyDirections,
  bossAbilityCooldown,
} from '../src/bossSystem.js';

function assert(condition, message, data) {
  if (!condition) {
    throw new Error(data ? `${message}: ${JSON.stringify(data)}` : message);
  }
}

assert(BOSS_TYPE === 'bastion', 'Primary boss type changed unexpectedly');
assert(SECOND_BOSS_TYPE === 'pincer', 'Second boss type mismatch');
assert(bossName(BOSS_TYPE) === 'BURÇKIRAN', 'Primary boss name mismatch');
assert(bossName(SECOND_BOSS_TYPE) === 'KISKAÇ', 'Second boss name mismatch');

for (let stage = 1; stage <= 12; stage++) {
  for (let local = 1; local <= 3; local++) {
    const expected = stage % 3 === 0 && local === 3;
    assert(
      isBossWave(stage, local) === expected,
      `Boss cadence mismatch at stage ${stage} wave ${local}`
    );
  }
}

assert(bossTier(3) === 1, 'Stage 3 must be boss encounter 1');
assert(bossTier(6) === 2, 'Stage 6 must be boss encounter 2');
assert(bossTier(9) === 3, 'Stage 9 must be boss encounter 3');
assert(bossTypeForStage(3) === BOSS_TYPE, 'B3 must use BURÇKIRAN');
assert(bossTypeForStage(6) === SECOND_BOSS_TYPE, 'B6 must use KISKAÇ');
assert(bossTypeForStage(9) === BOSS_TYPE, 'B9 must return to BURÇKIRAN');
assert(bossTypeForStage(12) === SECOND_BOSS_TYPE, 'B12 must return to KISKAÇ');

const bastion1 = bossStats(3, BOSS_TYPE);
const bastion2 = bossStats(9, BOSS_TYPE);
const pincer1 = bossStats(6, SECOND_BOSS_TYPE);
const pincer2 = bossStats(12, SECOND_BOSS_TYPE);

assert(bastion1.hp === 8, 'First BURÇKIRAN must start at 8 HP', bastion1);
assert(bastion2.hp > bastion1.hp, 'Later BURÇKIRAN must gain HP', { bastion1, bastion2 });
assert(pincer1.hp === 7, 'First KISKAÇ must start at 7 HP', pincer1);
assert(pincer1.speed > bastion1.speed, 'KISKAÇ must be faster than BURÇKIRAN', { pincer1, bastion1 });
assert(pincer2.hp > pincer1.hp, 'Later KISKAÇ must gain HP', { pincer1, pincer2 });

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
assert(!side.blocked && side.damage === 2, 'Side hit should damage armored boss', side);

assert(
  JSON.stringify(pincerVolleyDirections('up', 1)) === JSON.stringify(['up','left','right']),
  'KISKAÇ phase-1 up volley mismatch'
);
assert(
  JSON.stringify(pincerVolleyDirections('right', 2)) === JSON.stringify(['right','up','down','left']),
  'KISKAÇ phase-2 right volley mismatch'
);
assert(
  bossAbilityCooldown(6, SECOND_BOSS_TYPE, 2) <
  bossAbilityCooldown(6, SECOND_BOSS_TYPE, 1),
  'KISKAÇ phase 2 must shorten salvo cooldown'
);
assert(
  bossAbilityCooldown(3, BOSS_TYPE, 1) === Infinity,
  'BURÇKIRAN must not receive KISKAÇ salvo cooldown'
);

console.log('PASS boss mechanics', {
  cadence: 'every third-stage finale',
  rotation: ['B3 BURÇKIRAN', 'B6 KISKAÇ', 'B9 BURÇKIRAN', 'B12 KISKAÇ'],
  bastion1,
  pincer1,
  pincerVolley: {
    phase1: pincerVolleyDirections('up', 1),
    phase2: pincerVolleyDirections('right', 2),
  },
});
