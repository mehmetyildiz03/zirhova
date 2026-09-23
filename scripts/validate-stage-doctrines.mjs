import {
  stageDoctrine,
  doctrineSpawnPlan,
} from '../src/stageDoctrineSystem.js';
import {
  buildEnemyRoster,
  rosterThreat,
  waveEnemyCount,
} from '../src/balanceSystem.js';

function assert(condition, message, data) {
  if (!condition) {
    throw new Error(data ? `${message}: ${JSON.stringify(data)}` : message);
  }
}

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function sample({ stage, wave, waveInStage, doctrine, focusType, samples = 1200 }) {
  const count = waveEnemyCount(stage, waveInStage);
  let neutralFocus = 0;
  let doctrineFocus = 0;
  let neutralThreat = 0;
  let doctrineThreat = 0;

  for (let i = 0; i < samples; i++) {
    const seed = stage * 100000 + wave * 1000 + i + 1;
    const neutral = buildEnemyRoster({
      stage,
      wave,
      waveInStage,
      count,
      rng: seeded(seed),
    });
    const themed = buildEnemyRoster({
      stage,
      wave,
      waveInStage,
      count,
      rng: seeded(seed),
      weightMultipliers: doctrine.weightMultipliers,
    });

    neutralFocus += neutral.filter(type => type === focusType).length;
    doctrineFocus += themed.filter(type => type === focusType).length;
    neutralThreat += rosterThreat(neutral);
    doctrineThreat += rosterThreat(themed);
  }

  return {
    neutralFocus: neutralFocus / samples,
    doctrineFocus: doctrineFocus / samples,
    threatRatio: doctrineThreat / neutralThreat,
  };
}

const kirik1 = stageDoctrine('kirik-hat', 1, 6);
const kirik7 = stageDoctrine('kirik-hat', 7, 6);
const dar2 = stageDoctrine('dar-gecit', 2, 6);
const dar8 = stageDoctrine('dar-gecit', 8, 6);

assert(kirik1?.id === 'broken-line' && !kirik1.advanced, 'B1 KIRIK HAT doctrine mismatch', kirik1);
assert(kirik1.label === 'KANAT', 'B1 KIRIK HAT label mismatch', kirik1);
assert(kirik7?.advanced && kirik7.label === 'İLERİ KANAT', 'B7 advanced KIRIK HAT mismatch', kirik7);
assert(dar2?.id === 'narrow-gate' && !dar2.advanced, 'B2 DAR GEÇİT doctrine mismatch', dar2);
assert(dar8?.advanced && dar8.label === 'DARBOĞAZ', 'B8 advanced DAR GEÇİT mismatch', dar8);
assert(stageDoctrine('su-kapani', 3, 6) === null, 'Unimplemented map should remain doctrine-neutral');

const kirikSpawns = [[0,0], [7,0], [15,0]];
const darSpawns = [[1,0], [8,0], [14,0]];

assert(
  JSON.stringify(doctrineSpawnPlan({
    levelId: 'kirik-hat',
    stage: 1,
    levelCount: 6,
    enemySpawns: kirikSpawns,
    count: 6,
  })) === JSON.stringify([[0,0],[15,0],[7,0],[15,0],[0,0],[7,0]]),
  'KIRIK HAT standard spawn plan mismatch'
);

assert(
  JSON.stringify(doctrineSpawnPlan({
    levelId: 'kirik-hat',
    stage: 7,
    levelCount: 6,
    enemySpawns: kirikSpawns,
    count: 5,
  })) === JSON.stringify([[0,0],[15,0],[0,0],[15,0],[7,0]]),
  'KIRIK HAT advanced spawn plan mismatch'
);

assert(
  JSON.stringify(doctrineSpawnPlan({
    levelId: 'dar-gecit',
    stage: 2,
    levelCount: 6,
    enemySpawns: darSpawns,
    count: 6,
  })) === JSON.stringify([[8,0],[1,0],[8,0],[14,0],[8,0],[1,0]]),
  'DAR GEÇİT standard spawn plan mismatch'
);

assert(
  JSON.stringify(doctrineSpawnPlan({
    levelId: 'dar-gecit',
    stage: 8,
    levelCount: 6,
    enemySpawns: darSpawns,
    count: 6,
  })) === JSON.stringify([[8,0],[8,0],[1,0],[8,0],[8,0],[14,0]]),
  'DAR GEÇİT advanced spawn plan mismatch'
);

const kirikAdvancedSample = sample({
  stage: 7,
  wave: 19,
  waveInStage: 1,
  doctrine: kirik7,
  focusType: 'breacher',
});
assert(
  kirikAdvancedSample.doctrineFocus > kirikAdvancedSample.neutralFocus * 1.15,
  'Advanced KIRIK HAT should materially favor breachers',
  kirikAdvancedSample
);
assert(
  kirikAdvancedSample.threatRatio < 1.08,
  'Advanced KIRIK HAT doctrine adds too much hidden threat',
  kirikAdvancedSample
);

const darStandardSample = sample({
  stage: 2,
  wave: 4,
  waveInStage: 1,
  doctrine: dar2,
  focusType: 'hunter',
});
assert(
  darStandardSample.doctrineFocus > darStandardSample.neutralFocus * 1.30,
  'DAR GEÇİT should materially favor hunters',
  darStandardSample
);
assert(
  darStandardSample.threatRatio < 1.10,
  'DAR GEÇİT doctrine adds too much hidden threat',
  darStandardSample
);

const darAdvancedSample = sample({
  stage: 8,
  wave: 22,
  waveInStage: 1,
  doctrine: dar8,
  focusType: 'hunter',
});
assert(
  darAdvancedSample.doctrineFocus > darAdvancedSample.neutralFocus * 1.12,
  'Advanced DAR GEÇİT should retain hunter identity',
  darAdvancedSample
);
assert(
  darAdvancedSample.threatRatio < 1.10,
  'Advanced DAR GEÇİT doctrine adds too much hidden threat',
  darAdvancedSample
);

console.log('PASS stage doctrines', {
  kirik1: { label: kirik1.label, advanced: kirik1.advanced },
  kirik7: { label: kirik7.label, advanced: kirik7.advanced, sample: kirikAdvancedSample },
  dar2: { label: dar2.label, advanced: dar2.advanced, sample: darStandardSample },
  dar8: { label: dar8.label, advanced: dar8.advanced, sample: darAdvancedSample },
});
