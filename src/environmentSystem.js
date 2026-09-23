export const ENVIRONMENT_VERSION = 2;
export const MUD_SPEED_MULTIPLIER = 0.62;
export const MUD_PATH_COST = 1.65;

const ENVIRONMENTS = Object.freeze({
  'celik-kavsak': Object.freeze({
    id: 'steel-gates',
    title: 'TAKTİK BARİYER',
    standardLabel: 'TAKTİK BARİYER',
    advancedLabel: 'KİLİTLİ KAVŞAK',
    standardShortLabel: 'BARİYER',
    advancedShortLabel: 'KİLİTLİ KAVŞAK',
    barrierCells: Object.freeze([[5,7],[10,7]]),
    standardBarrierWaves: Object.freeze([
      Object.freeze({ label: 'SOL KİLİT', closed: Object.freeze([[5,7]]) }),
      Object.freeze({ label: 'SAĞ KİLİT', closed: Object.freeze([[10,7]]) }),
      Object.freeze({ label: 'KAVŞAK AÇIK', closed: Object.freeze([]) }),
    ]),
    advancedBarrierWaves: Object.freeze([
      Object.freeze({ label: 'SOL KİLİT', closed: Object.freeze([[5,7]]) }),
      Object.freeze({ label: 'SAĞ KİLİT', closed: Object.freeze([[10,7]]) }),
      Object.freeze({ label: 'ÇİFT KİLİT', closed: Object.freeze([[5,7],[10,7]]) }),
    ]),
  }),
  'yarik-ova': Object.freeze({
    id: 'mud-line',
    title: 'ÇAMUR HATTI',
    standardLabel: 'ÇAMUR HATTI',
    advancedLabel: 'DERİN ÇAMUR',
    standardShortLabel: 'ÇAMUR',
    advancedShortLabel: 'DERİN ÇAMUR',
    standardMud: Object.freeze([
      [1,10],[2,10],[13,10],[14,10],
      [1,11],[2,11],[13,11],[14,11],
    ]),
    advancedMud: Object.freeze([
      [1,10],[2,10],[3,10],[12,10],[13,10],[14,10],
      [1,11],[2,11],[3,11],[12,11],[13,11],[14,11],
    ]),
  }),
});

function normalizeStage(stage) {
  return Math.max(1, Math.floor(Number(stage) || 1));
}

function normalizeLevelCount(levelCount) {
  return Math.max(1, Math.floor(Number(levelCount) || 1));
}

function normalizeWaveInStage(waveInStage) {
  return Math.max(1, Math.min(3, Math.floor(Number(waveInStage) || 1)));
}

function cloneCells(cells = []) {
  return cells.map(([x, y]) => [x, y]);
}

export function stageEnvironment(levelId, stage, levelCount = 6) {
  const spec = ENVIRONMENTS[levelId];
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
    shortLabel: advanced
      ? (spec.advancedShortLabel || spec.advancedLabel)
      : (spec.standardShortLabel || spec.standardLabel),
    advanced,
    cycle,
    mudCells: cloneCells(
      advanced ? (spec.advancedMud || []) : (spec.standardMud || [])
    ),
    barrierCells: cloneCells(spec.barrierCells || []),
  };
}

export function environmentBarrierState(
  levelId,
  stage,
  waveInStage,
  levelCount = 6
) {
  const spec = ENVIRONMENTS[levelId];
  if (!spec?.barrierCells?.length) return null;

  const environment = stageEnvironment(levelId, stage, levelCount);
  const safeWave = normalizeWaveInStage(waveInStage);
  const schedule = environment.advanced
    ? spec.advancedBarrierWaves
    : spec.standardBarrierWaves;
  const waveState = schedule?.[safeWave - 1] || { label: 'KAVŞAK AÇIK', closed: [] };
  const closedCells = cloneCells(waveState.closed || []);
  const closedKeys = new Set(closedCells.map(([x, y]) => `${x},${y}`));

  return {
    id: environment.id,
    levelId,
    label: waveState.label,
    waveInStage: safeWave,
    advanced: environment.advanced,
    barrierCells: cloneCells(spec.barrierCells),
    closedCells,
    openCells: cloneCells(spec.barrierCells)
      .filter(([x, y]) => !closedKeys.has(`${x},${y}`)),
  };
}

export function terrainSpeedMultiplier(tileType) {
  return tileType === 'mud' ? MUD_SPEED_MULTIPLIER : 1;
}

export function terrainPathCost(tileType) {
  return tileType === 'mud' ? MUD_PATH_COST : 1;
}
