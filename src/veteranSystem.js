export const VETERAN_VERSION = 1;

const VETERAN_TIERS = Object.freeze({
  1: Object.freeze({
    label: 'VETERAN I',
    weightMultipliers: Object.freeze({
      raider: 0.82,
      scout: 0.95,
      hunter: 1.08,
      breacher: 1.16,
      heavy: 1.14,
    }),
    capBonuses: Object.freeze({
      breacher: 1,
    }),
    spawnInterval: 0.37,
  }),
  2: Object.freeze({
    label: 'VETERAN II',
    weightMultipliers: Object.freeze({
      raider: 0.72,
      scout: 0.92,
      hunter: 1.12,
      breacher: 1.24,
      heavy: 1.22,
    }),
    capBonuses: Object.freeze({
      breacher: 1,
      heavy: 1,
    }),
    spawnInterval: 0.34,
  }),
});

function normalizeStage(stage) {
  return Math.max(1, Math.floor(Number(stage) || 1));
}

function normalizeLevelCount(levelCount) {
  return Math.max(1, Math.floor(Number(levelCount) || 1));
}

export function veteranPressure(stage, levelCount = 6) {
  const safeStage = normalizeStage(stage);
  const safeLevelCount = normalizeLevelCount(levelCount);
  const cycle = Math.floor((safeStage - 1) / safeLevelCount);

  if (cycle < 2) return null;

  const tier = Math.min(2, cycle - 1);
  const spec = VETERAN_TIERS[tier];

  return {
    tier,
    label: spec.label,
    cycle,
    weightMultipliers: { ...spec.weightMultipliers },
    capBonuses: { ...spec.capBonuses },
    spawnInterval: spec.spawnInterval,
  };
}

export function combineWeightMultipliers(...sets) {
  const types = ['raider', 'scout', 'hunter', 'breacher', 'heavy'];
  const result = {};

  for (const type of types) {
    let multiplier = 1;
    let touched = false;

    for (const set of sets) {
      if (!set) continue;
      const raw = Number(set[type]);
      if (!Number.isFinite(raw)) continue;
      multiplier *= Math.max(0, raw);
      touched = true;
    }

    if (touched) result[type] = multiplier;
  }

  return result;
}
