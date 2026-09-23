import { LEVELS } from '../src/levels.js';
import {
  MUD_SPEED_MULTIPLIER,
  MUD_PATH_COST,
  stageEnvironment,
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

const standard = stageEnvironment('yarik-ova', 5, LEVELS.length);
const advanced = stageEnvironment('yarik-ova', 11, LEVELS.length);

assert(standard?.id === 'mud-line', 'B5 environment id mismatch', standard);
assert(standard.label === 'ÇAMUR HATTI' && !standard.advanced, 'B5 mud identity mismatch', standard);
assert(standard.mudCells.length === 8, 'B5 should use two compact mud banks', standard);

assert(advanced?.id === 'mud-line', 'B11 environment id mismatch', advanced);
assert(advanced.label === 'DERİN ÇAMUR' && advanced.advanced, 'B11 advanced mud identity mismatch', advanced);
assert(advanced.mudCells.length === 12, 'B11 should widen both mud banks', advanced);

for (const id of ['kirik-hat','dar-gecit','su-kapani','celik-kavsak','son-siper']) {
  assert(stageEnvironment(id, 1, LEVELS.length) === null, `${id} should remain environment-neutral in v0.17`);
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
  b5: { label: standard.label, mudCells: standard.mudCells.length },
  b11: { label: advanced.label, mudCells: advanced.mudCells.length },
  speedMultiplier: MUD_SPEED_MULTIPLIER,
  aiPathCost: MUD_PATH_COST,
});
