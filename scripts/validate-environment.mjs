import { LEVELS } from '../src/levels.js';
import {
  MUD_SPEED_MULTIPLIER,
  MUD_PATH_COST,
  stageEnvironment,
  environmentBarrierState,
  terrainSpeedMultiplier,
  terrainPathCost,
} from '../src/environmentSystem.js';

function assert(condition, message, data) {
  if (!condition) {
    throw new Error(data ? `${message}: ${JSON.stringify(data)}` : message);
  }
}

function key([x, y]) {
  return `${x},${y}`;
}

function hasRouteWithBarriers(level, start, goals, barrierCells = []) {
  const blocked = new Set();

  for (const terrain of ['steel','breakableSteel','water']) {
    for (const coord of level[terrain] || []) blocked.add(key(coord));
  }
  for (const coord of barrierCells) blocked.add(key(coord));

  const goalKeys = new Set(goals.map(key));
  const queue = [start];
  const seen = new Set([key(start)]);

  while (queue.length) {
    const [x, y] = queue.shift();
    if (goalKeys.has(key([x, y]))) return true;

    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next = [x + dx, y + dy];
      const nextKey = key(next);
      if (
        next[0] < 0 || next[1] < 0 ||
        next[0] >= 16 || next[1] >= 16 ||
        seen.has(nextKey) || blocked.has(nextKey)
      ) continue;
      seen.add(nextKey);
      queue.push(next);
    }
  }

  return false;
}

const standard = stageEnvironment('yarik-ova', 5, LEVELS.length);
const advanced = stageEnvironment('yarik-ova', 11, LEVELS.length);
const gateStandard = stageEnvironment('celik-kavsak', 4, LEVELS.length);
const gateAdvanced = stageEnvironment('celik-kavsak', 10, LEVELS.length);

assert(standard?.id === 'mud-line', 'B5 environment id mismatch', standard);
assert(standard.label === 'ÇAMUR HATTI' && !standard.advanced, 'B5 mud identity mismatch', standard);
assert(standard.mudCells.length === 8, 'B5 should use two compact mud banks', standard);

assert(advanced?.id === 'mud-line', 'B11 environment id mismatch', advanced);
assert(advanced.label === 'DERİN ÇAMUR' && advanced.advanced, 'B11 advanced mud identity mismatch', advanced);
assert(advanced.mudCells.length === 12, 'B11 should widen both mud banks', advanced);

for (const id of ['kirik-hat','dar-gecit','su-kapani','son-siper']) {
  assert(stageEnvironment(id, 1, LEVELS.length) === null, `${id} should remain environment-neutral in v0.17`);
}

assert(gateStandard?.id === 'steel-gates' && !gateStandard.advanced, 'B4 barrier environment mismatch', gateStandard);
assert(gateStandard.label === 'TAKTİK BARİYER', 'B4 barrier label mismatch', gateStandard);
assert(gateStandard.barrierCells.length === 2, 'B4 must have two tactical gate cells', gateStandard);
assert(gateAdvanced?.advanced && gateAdvanced.label === 'KİLİTLİ KAVŞAK', 'B10 advanced barrier mismatch', gateAdvanced);

const gateWaveExpectations = [
  [4, 1, 'SOL KİLİT', [[5,7]]],
  [4, 2, 'SAĞ KİLİT', [[10,7]]],
  [4, 3, 'KAVŞAK AÇIK', []],
  [10, 1, 'SOL KİLİT', [[5,7]]],
  [10, 2, 'SAĞ KİLİT', [[10,7]]],
  [10, 3, 'ÇİFT KİLİT', [[5,7],[10,7]]],
];

const steelCrossroads = LEVELS.find(item => item.id === 'celik-kavsak');

for (const [stage, waveInStage, label, closed] of gateWaveExpectations) {
  const state = environmentBarrierState('celik-kavsak', stage, waveInStage, LEVELS.length);
  assert(state?.label === label, `B${stage} wave ${waveInStage} barrier label mismatch`, state);
  assert(
    JSON.stringify(state.closedCells) === JSON.stringify(closed),
    `B${stage} wave ${waveInStage} closed barrier cells mismatch`,
    state
  );

  for (const spawn of steelCrossroads.enemySpawns) {
    assert(
      hasRouteWithBarriers(
        steelCrossroads,
        spawn,
        [steelCrossroads.playerSpawn, steelCrossroads.baseSpawn],
        closed
      ),
      `B${stage} wave ${waveInStage} barrier plan blocks all routes from spawn ${spawn}`,
      { stage, waveInStage, closed, spawn }
    );
  }
}

assert(MUD_SPEED_MULTIPLIER === 0.62, 'Mud speed multiplier drifted');
assert(MUD_PATH_COST === 1.65, 'Mud path cost drifted');
assert(terrainSpeedMultiplier('mud') === 0.62, 'Mud speed helper mismatch');
assert(terrainSpeedMultiplier('ice') === 1, 'Mud helper affected non-mud terrain');
assert(terrainPathCost('mud') > terrainPathCost('floor'), 'AI should prefer clean ground when route lengths are comparable');

const level = LEVELS.find(item => item.id === 'yarik-ova');
const occupied = new Set();
for (const terrain of ['bricks','steel','breakableSteel','water','ice','brush']) {
  for (const coord of level[terrain] || []) occupied.add(key(coord));
}
const protectedCells = new Set([
  key(level.playerSpawn),
  key(level.baseSpawn),
  ...level.enemySpawns.map(key),
]);

for (const env of [standard, advanced]) {
  const seen = new Set();
  for (const cell of env.mudCells) {
    const [x, y] = cell;
    assert(Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < 16 && y < 16, 'Mud cell out of bounds', cell);
    assert(!seen.has(key(cell)), 'Duplicate mud cell', cell);
    assert(!occupied.has(key(cell)), 'Mud overlaps permanent terrain', cell);
    assert(!protectedCells.has(key(cell)), 'Mud overlaps a protected spawn/base cell', cell);
    seen.add(key(cell));
  }
}

const standardKeys = new Set(standard.mudCells.map(key));
assert(
  [...standardKeys].every(cell => new Set(advanced.mudCells.map(key)).has(cell)),
  'Advanced mud must preserve the readable standard mud footprint'
);

console.log('PASS environment mechanics', {
  b4: { label: gateStandard.label, barrierCells: gateStandard.barrierCells.length },
  b5: { label: standard.label, mudCells: standard.mudCells.length },
  b10: { label: gateAdvanced.label, finalWave: 'ÇİFT KİLİT' },
  b11: { label: advanced.label, mudCells: advanced.mudCells.length },
  speedMultiplier: MUD_SPEED_MULTIPLIER,
  aiPathCost: MUD_PATH_COST,
});
