export const DOCTRINE_VERSION = 1;

const DOCTRINES = Object.freeze({
  'kirik-hat': Object.freeze({
    id: 'broken-line',
    title: 'KANAT BASKISI',
    standardLabel: 'KANAT',
    advancedLabel: 'İLERİ KANAT',
    standardWeights: Object.freeze({
      raider: 1.18,
      scout: 0.82,
    }),
    advancedWeights: Object.freeze({
      raider: 0.90,
      scout: 0.80,
      hunter: 0.95,
      breacher: 1.55,
      heavy: 0.90,
    }),
    standardSpawnPattern: Object.freeze([0, 2, 1, 2, 0, 1]),
    advancedSpawnPattern: Object.freeze([0, 2, 0, 2, 1]),
  }),
  'dar-gecit': Object.freeze({
    id: 'narrow-gate',
    title: 'KORİDOR AVI',
    standardLabel: 'KORİDOR',
    advancedLabel: 'DARBOĞAZ',
    standardWeights: Object.freeze({
      raider: 0.85,
      scout: 0.80,
      hunter: 1.55,
      breacher: 1.00,
      heavy: 1.00,
    }),
    advancedWeights: Object.freeze({
      raider: 0.78,
      scout: 0.82,
      hunter: 1.45,
      breacher: 0.95,
      heavy: 1.20,
    }),
    standardSpawnPattern: Object.freeze([1, 0, 1, 2, 1, 0]),
    advancedSpawnPattern: Object.freeze([1, 1, 0, 1, 1, 2]),
  }),
  'su-kapani': Object.freeze({
    id: 'water-trap',
    title: 'SU KISKACI',
    standardLabel: 'BOĞAZ',
    advancedLabel: 'SU KISKACI',
    standardWeights: Object.freeze({
      raider: 0.90,
      scout: 1.25,
      hunter: 1.35,
      breacher: 0.95,
      heavy: 0.95,
    }),
    advancedWeights: Object.freeze({
      raider: 0.85,
      scout: 1.10,
      hunter: 1.30,
      breacher: 1.25,
      heavy: 1.00,
    }),
    standardSpawnPattern: Object.freeze([0, 2, 0, 2, 1, 1]),
    advancedSpawnPattern: Object.freeze([0, 2, 0, 2, 0, 2, 1]),
  }),
  'celik-kavsak': Object.freeze({
    id: 'steel-crossroads',
    title: 'AĞIR KAVŞAK',
    standardLabel: 'AĞIR HAT',
    advancedLabel: 'ÇELİK KUŞATMA',
    standardWeights: Object.freeze({
      raider: 0.82,
      scout: 0.82,
      hunter: 0.92,
      breacher: 1.28,
      heavy: 1.35,
    }),
    advancedWeights: Object.freeze({
      raider: 0.76,
      scout: 0.82,
      hunter: 0.90,
      breacher: 1.30,
      heavy: 1.45,
    }),
    standardSpawnPattern: Object.freeze([1, 0, 2, 1, 0, 2]),
    advancedSpawnPattern: Object.freeze([1, 1, 0, 2, 1, 1]),
  }),
  'yarik-ova': Object.freeze({
    id: 'split-plain',
    title: 'HAREKETLİ CEPHE',
    standardLabel: 'HAREKETLİ CEPHE',
    advancedLabel: 'AÇIK AVCI',
    standardWeights: Object.freeze({
      raider: 0.85,
      scout: 1.55,
      hunter: 1.35,
      breacher: 0.80,
      heavy: 0.72,
    }),
    advancedWeights: Object.freeze({
      raider: 0.78,
      scout: 1.45,
      hunter: 1.40,
      breacher: 0.85,
      heavy: 0.78,
    }),
    standardSpawnPattern: Object.freeze([0, 2, 1, 0, 2, 1]),
    advancedSpawnPattern: Object.freeze([0, 2, 0, 2, 1, 0, 2]),
  }),
  'son-siper': Object.freeze({
    id: 'last-bastion',
    title: 'SON SİPER KUŞATMASI',
    standardLabel: 'KUŞATMA',
    advancedLabel: 'SON KUŞATMA',
    standardWeights: Object.freeze({
      raider: 0.80,
      scout: 0.75,
      hunter: 0.90,
      breacher: 1.40,
      heavy: 1.30,
    }),
    advancedWeights: Object.freeze({
      raider: 0.75,
      scout: 0.75,
      hunter: 0.86,
      breacher: 1.40,
      heavy: 1.40,
    }),
    standardSpawnPattern: Object.freeze([1, 0, 2, 1, 2, 0]),
    advancedSpawnPattern: Object.freeze([1, 0, 1, 2, 1, 2]),
  }),
});

function normalizeStage(stage) {
  return Math.max(1, Math.floor(Number(stage) || 1));
}

function normalizeLevelCount(levelCount) {
  return Math.max(1, Math.floor(Number(levelCount) || 1));
}

export function stageDoctrine(levelId, stage, levelCount = 6) {
  const spec = DOCTRINES[levelId];
  if (!spec) return null;

  const safeStage = normalizeStage(stage);
  const safeLevelCount = normalizeLevelCount(levelCount);
  const cycle = Math.floor((safeStage - 1) / safeLevelCount);
  const advanced = cycle >= 1;

  return {
    id: spec.id,
    levelId,
    title: spec.title,
    label: advanced ? spec.advancedLabel : spec.standardLabel,
    advanced,
    cycle,
    weightMultipliers: {
      ...(advanced ? spec.advancedWeights : spec.standardWeights),
    },
    spawnPattern: [
      ...(advanced ? spec.advancedSpawnPattern : spec.standardSpawnPattern),
    ],
  };
}

export function doctrineSpawnPlan({
  levelId,
  stage,
  levelCount = 6,
  enemySpawns = [],
  count = 0,
} = {}) {
  if (!Array.isArray(enemySpawns) || !enemySpawns.length) return [];

  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  const doctrine = stageDoctrine(levelId, stage, levelCount);
  const fallbackPattern = enemySpawns.map((_, index) => index);
  const pattern = doctrine?.spawnPattern?.length
    ? doctrine.spawnPattern
    : fallbackPattern;

  return Array.from({ length: safeCount }, (_, index) => {
    const rawLane = pattern[index % pattern.length];
    const lane = ((rawLane % enemySpawns.length) + enemySpawns.length) % enemySpawns.length;
    return [...enemySpawns[lane]];
  });
}
