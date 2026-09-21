import { LEVELS } from '../src/levels.js';

const SIZE = 16;
const terrainKeys = ['bricks', 'steel', 'water', 'ice', 'brush'];

function key([x, y]) {
  return `${x},${y}`;
}

function inBounds([x, y]) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < SIZE && y < SIZE;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function reachable(level, start, goal) {
  const blocked = new Set([
    ...(level.steel || []).map(key),
    ...(level.water || []).map(key),
  ]);

  const queue = [start];
  const seen = new Set([key(start)]);

  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === goal[0] && y === goal[1]) return true;

    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next = [x + dx, y + dy];
      const k = key(next);
      if (!inBounds(next) || seen.has(k) || blocked.has(k)) continue;
      seen.add(k);
      queue.push(next);
    }
  }
  return false;
}

for (const level of LEVELS) {
  assert(level.id && level.name, 'Every level needs id and name');
  assert(inBounds(level.playerSpawn), `${level.id}: invalid playerSpawn`);
  assert(inBounds(level.baseSpawn), `${level.id}: invalid baseSpawn`);
  assert(Array.isArray(level.enemySpawns) && level.enemySpawns.length >= 2, `${level.id}: needs enemy spawns`);

  const occupied = new Map();

  for (const terrain of terrainKeys) {
    for (const coord of level[terrain] || []) {
      assert(inBounds(coord), `${level.id}: ${terrain} out of bounds at ${coord}`);
      const k = key(coord);
      assert(!occupied.has(k), `${level.id}: overlapping terrain at ${k} (${occupied.get(k)} + ${terrain})`);
      occupied.set(k, terrain);
    }
  }

  for (const spawn of [...level.enemySpawns, level.playerSpawn, level.baseSpawn]) {
    assert(inBounds(spawn), `${level.id}: invalid spawn ${spawn}`);
    const terrain = occupied.get(key(spawn));
    assert(!terrain, `${level.id}: spawn ${spawn} overlaps ${terrain}`);
  }

  for (const enemySpawn of level.enemySpawns) {
    assert(
      reachable(level, enemySpawn, level.baseSpawn) || reachable(level, enemySpawn, level.playerSpawn),
      `${level.id}: enemy spawn ${enemySpawn} has no route to base or player (brick/brush may be traversed conceptually)`
    );
  }
}

const ids = LEVELS.map(level => level.id);
assert(new Set(ids).size === ids.length, 'Level ids must be unique');

console.log(`Validated ${LEVELS.length} ZIRHOVA levels.`);
