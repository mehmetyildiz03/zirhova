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

const cases = [
  ['kirik-hat', 1, 'broken-line', 'KANAT', false],
  ['dar-gecit', 2, 'narrow-gate', 'KORİDOR', false],
  ['su-kapani', 3, 'water-trap', 'BOĞAZ', false],
  ['celik-kavsak', 4, 'steel-crossroads', 'AĞIR HAT', false],
  ['yarik-ova', 5, 'split-plain', 'HAREKETLİ CEPHE', false],
  ['son-siper', 6, 'last-bastion', 'KUŞATMA', false],
  ['kirik-hat', 7, 'broken-line', 'İLERİ KANAT', true],
  ['dar-gecit', 8, 'narrow-gate', 'DARBOĞAZ', true],
  ['su-kapani', 9, 'water-trap', 'SU KISKACI', true],
  ['celik-kavsak', 10, 'steel-crossroads', 'ÇELİK KUŞATMA', true],
  ['yarik-ova', 11, 'split-plain', 'AÇIK AVCI', true],
  ['son-siper', 12, 'last-bastion', 'SON KUŞATMA', true],
];

for (const [levelId, stage, id, label, advanced] of cases) {
  const doctrine = stageDoctrine(levelId, stage, 6);
  assert(
    doctrine?.id === id &&
    doctrine.label === label &&
    doctrine.advanced === advanced,
    `Doctrine identity mismatch for ${levelId} at B${stage}`,
    doctrine
  );
}

assert(stageDoctrine('unknown-map', 1, 6) === null, 'Unknown map must remain doctrine-neutral');

const spawns = [[0,0], [8,0], [15,0]];
const spawnExpectations = [
  ['su-kapani', 3, [[0,0],[15,0],[0,0],[15,0],[8,0],[8,0]]],
  ['su-kapani', 9, [[0,0],[15,0],[0,0],[15,0],[0,0],[15,0]]],
  ['celik-kavsak', 4, [[8,0],[0,0],[15,0],[8,0],[0,0],[15,0]]],
  ['celik-kavsak', 10, [[8,0],[8,0],[0,0],[15,0],[8,0],[8,0]]],
  ['yarik-ova', 5, [[0,0],[15,0],[8,0],[0,0],[15,0],[8,0]]],
  ['yarik-ova', 11, [[0,0],[15,0],[0,0],[15,0],[8,0],[0,0]]],
  ['son-siper', 6, [[8,0],[0,0],[15,0],[8,0],[15,0],[0,0]]],
  ['son-siper', 12, [[8,0],[0,0],[8,0],[15,0],[8,0],[15,0]]],
];

for (const [levelId, stage, expected] of spawnExpectations) {
  const actual = doctrineSpawnPlan({
    levelId,
    stage,
    levelCount: 6,
    enemySpawns: spawns,
    count: 6,
  });
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `Spawn doctrine mismatch for ${levelId} at B${stage}`,
    { actual, expected }
  );
}

const pressureChecks = [
  {
    name: 'advanced KIRIK HAT breacher bias',
    stage: 7, wave: 19, focusType: 'breacher',
    doctrine: stageDoctrine('kirik-hat', 7, 6),
    minFocusRatio: 1.15, minThreat: 0.92, maxThreat: 1.08,
  },
  {
    name: 'DAR GEÇİT hunter bias',
    stage: 2, wave: 4, focusType: 'hunter',
    doctrine: stageDoctrine('dar-gecit', 2, 6),
    minFocusRatio: 1.30, minThreat: 0.92, maxThreat: 1.10,
  },
  {
    name: 'SU KAPANI hunter bias',
    stage: 3, wave: 7, focusType: 'hunter',
    doctrine: stageDoctrine('su-kapani', 3, 6),
    minFocusRatio: 1.15, minThreat: 0.92, maxThreat: 1.08,
  },
  {
    name: 'advanced SU KAPANI hunter bias',
    stage: 9, wave: 25, focusType: 'hunter',
    doctrine: stageDoctrine('su-kapani', 9, 6),
    minFocusRatio: 1.10, minThreat: 0.92, maxThreat: 1.08,
  },
  {
    name: 'ÇELİK KAVŞAK heavy bias',
    stage: 4, wave: 10, focusType: 'heavy',
    doctrine: stageDoctrine('celik-kavsak', 4, 6),
    minFocusRatio: 1.18, minThreat: 0.92, maxThreat: 1.08,
  },
  {
    name: 'advanced ÇELİK KAVŞAK heavy bias',
    stage: 10, wave: 28, focusType: 'heavy',
    doctrine: stageDoctrine('celik-kavsak', 10, 6),
    minFocusRatio: 1.20, minThreat: 0.92, maxThreat: 1.09,
  },
  {
    name: 'YARIK OVA scout bias',
    stage: 5, wave: 13, focusType: 'scout',
    doctrine: stageDoctrine('yarik-ova', 5, 6),
    minFocusRatio: 1.20, minThreat: 0.90, maxThreat: 1.06,
  },
  {
    name: 'advanced YARIK OVA hunter bias',
    stage: 11, wave: 31, focusType: 'hunter',
    doctrine: stageDoctrine('yarik-ova', 11, 6),
    minFocusRatio: 1.10, minThreat: 0.90, maxThreat: 1.06,
  },
  {
    name: 'SON SİPER breacher bias',
    stage: 6, wave: 16, focusType: 'breacher',
    doctrine: stageDoctrine('son-siper', 6, 6),
    minFocusRatio: 1.15, minThreat: 0.92, maxThreat: 1.08,
  },
  {
    name: 'advanced SON SİPER heavy bias',
    stage: 12, wave: 34, focusType: 'heavy',
    doctrine: stageDoctrine('son-siper', 12, 6),
    minFocusRatio: 1.15, minThreat: 0.92, maxThreat: 1.09,
  },
];

const samples = {};
for (const check of pressureChecks) {
  const result = sample({
    stage: check.stage,
    wave: check.wave,
    waveInStage: 1,
    doctrine: check.doctrine,
    focusType: check.focusType,
  });
  samples[check.name] = result;

  assert(
    result.doctrineFocus > result.neutralFocus * check.minFocusRatio,
    `${check.name} is too weak`,
    result
  );
  assert(
    result.threatRatio >= check.minThreat && result.threatRatio < check.maxThreat,
    `${check.name} changes total threat too much`,
    result
  );
}

console.log('PASS stage doctrines', {
  identities: cases.map(([levelId, stage, , label]) => ({ stage, levelId, label })),
  samples,
});
