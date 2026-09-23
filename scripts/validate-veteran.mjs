import {
  buildEnemyRoster,
  rosterThreat,
  waveEnemyCount,
} from '../src/balanceSystem.js';
import { stageDoctrine } from '../src/stageDoctrineSystem.js';
import {
  veteranPressure,
  combineWeightMultipliers,
} from '../src/veteranSystem.js';

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

function sampleThreat({
  levelId,
  stage,
  wave,
  waveInStage = 1,
  veteran = null,
  samples = 1200,
}) {
  const doctrine = stageDoctrine(levelId, stage, 6);
  const count = waveEnemyCount(stage, waveInStage);

  let baselineThreat = 0;
  let veteranThreat = 0;
  let baselineBreacher = 0;
  let veteranBreacher = 0;
  let baselineHeavy = 0;
  let veteranHeavy = 0;

  for (let i = 0; i < samples; i++) {
    const seed = stage * 100000 + wave * 1000 + i + 1;

    const baseline = buildEnemyRoster({
      stage,
      wave,
      waveInStage,
      count,
      rng: seeded(seed),
      weightMultipliers: doctrine?.weightMultipliers,
    });

    const pressured = buildEnemyRoster({
      stage,
      wave,
      waveInStage,
      count,
      rng: seeded(seed),
      weightMultipliers: combineWeightMultipliers(
        doctrine?.weightMultipliers,
        veteran?.weightMultipliers
      ),
      capBonuses: veteran?.capBonuses,
    });

    baselineThreat += rosterThreat(baseline);
    veteranThreat += rosterThreat(pressured);
    baselineBreacher += baseline.filter(type => type === 'breacher').length;
    veteranBreacher += pressured.filter(type => type === 'breacher').length;
    baselineHeavy += baseline.filter(type => type === 'heavy').length;
    veteranHeavy += pressured.filter(type => type === 'heavy').length;
  }

  return {
    threatRatio: veteranThreat / baselineThreat,
    baselineBreacher: baselineBreacher / samples,
    veteranBreacher: veteranBreacher / samples,
    baselineHeavy: baselineHeavy / samples,
    veteranHeavy: veteranHeavy / samples,
  };
}

assert(veteranPressure(12, 6) === null, 'B12 must remain outside Veteran pressure');

const b13 = veteranPressure(13, 6);
const b18 = veteranPressure(18, 6);
const b19 = veteranPressure(19, 6);
const b25 = veteranPressure(25, 6);

assert(b13?.tier === 1 && b13.label === 'VETERAN I', 'B13 must begin Veteran I', b13);
assert(b18?.tier === 1, 'B18 must remain Veteran I', b18);
assert(b19?.tier === 2 && b19.label === 'VETERAN II', 'B19 must begin Veteran II', b19);
assert(b25?.tier === 2, 'Veteran pressure must cap at tier II', b25);
assert(b13.spawnInterval === 0.37, 'Veteran I spawn interval drifted', b13);
assert(b19.spawnInterval === 0.34, 'Veteran II spawn interval drifted', b19);
assert(b13.capBonuses.breacher === 1 && !b13.capBonuses.heavy, 'Veteran I cap bonuses mismatch', b13);
assert(
  b19.capBonuses.breacher === 1 && b19.capBonuses.heavy === 1,
  'Veteran II cap bonuses mismatch',
  b19
);

const combined = combineWeightMultipliers(
  { raider: 0.9, breacher: 1.5 },
  { raider: 0.8, heavy: 1.2 }
);
assert(Math.abs(combined.raider - 0.72) < 1e-9, 'Weight multiplier composition mismatch', combined);
assert(combined.breacher === 1.5 && combined.heavy === 1.2, 'Sparse multiplier composition mismatch', combined);

const levels = [
  ['kirik-hat', 13],
  ['dar-gecit', 14],
  ['su-kapani', 15],
  ['celik-kavsak', 16],
  ['yarik-ova', 17],
  ['son-siper', 18],
];

const tier1Samples = {};
for (const [levelId, stage] of levels) {
  const wave = (stage - 1) * 3 + 1;
  const result = sampleThreat({
    levelId,
    stage,
    wave,
    veteran: veteranPressure(stage, 6),
  });
  tier1Samples[levelId] = result;

  assert(
    result.threatRatio > 1.025 && result.threatRatio < 1.08,
    `Veteran I threat change out of band for ${levelId}`,
    result
  );
  assert(
    result.veteranBreacher > result.baselineBreacher,
    `Veteran I did not increase breacher pressure for ${levelId}`,
    result
  );
}

const tier2Samples = {};
for (const [index, [levelId]] of levels.entries()) {
  const stage = 19 + index;
  const wave = (stage - 1) * 3 + 1;
  const result = sampleThreat({
    levelId,
    stage,
    wave,
    veteran: veteranPressure(stage, 6),
  });
  tier2Samples[levelId] = result;

  assert(
    result.threatRatio > 1.05 && result.threatRatio < 1.12,
    `Veteran II threat change out of band for ${levelId}`,
    result
  );
  assert(
    result.veteranHeavy > result.baselineHeavy,
    `Veteran II did not increase heavy pressure for ${levelId}`,
    result
  );
}

console.log('PASS veteran pressure', {
  tiers: {
    b13: b13.label,
    b19: b19.label,
    b25: b25.label,
  },
  tier1Samples,
  tier2Samples,
});
