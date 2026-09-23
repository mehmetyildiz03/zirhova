export const ENVIRONMENT_VERSION = 1;
export const MUD_SPEED_MULTIPLIER = 0.62;
export const MUD_PATH_COST = 1.65;

const ENVIRONMENTS = Object.freeze({
  'yarik-ova': Object.freeze({
    id: 'mud-line',
    title: 'ÇAMUR HATTI',
    standardLabel: 'ÇAMUR HATTI',
    advancedLabel: 'DERİN ÇAMUR',
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
    shortLabel: advanced ? 'DERİN ÇAMUR' : 'ÇAMUR',
    advanced,
    cycle,
    mudCells: cloneCells(advanced ? spec.advancedMud : spec.standardMud),
  };
}

export function terrainSpeedMultiplier(tileType) {
  return tileType === 'mud' ? MUD_SPEED_MULTIPLIER : 1;
}

export function terrainPathCost(tileType) {
  return tileType === 'mud' ? MUD_PATH_COST : 1;
}
