import { validateCustomLevel } from '../src/levelSchema.js';

function assert(condition, message, data) {
  if (!condition) {
    throw new Error(data ? `${message}: ${JSON.stringify(data)}` : message);
  }
}

function baseLevel() {
  return {
    id: 'test-map',
    name: 'TEST MAP',
    playerSpawn: [5, 14],
    baseSpawn: [7, 15],
    enemySpawns: [[0, 0], [7, 0], [15, 0]],
    bricks: [],
    steel: [],
    breakableSteel: [],
    water: [],
    ice: [],
    brush: [],
  };
}

let result = validateCustomLevel(baseLevel());
assert(result.ok, 'Baseline custom map should be valid', result.errors);

const oneExit = baseLevel();
oneExit.steel = [[4,14], [5,13], [5,15]];
result = validateCustomLevel(oneExit);
assert(
  !result.ok && result.errors.some(error => error.includes('en az 2 doğrudan sürüş çıkışı')),
  'Custom player spawn with only one driveable exit must be rejected',
  result.errors
);

const blockedEnemy = baseLevel();
blockedEnemy.steel = [[1,0]];
blockedEnemy.water = [[0,1]];
result = validateCustomLevel(blockedEnemy);
assert(
  !result.ok && result.errors.some(error => error.includes('kalıcı engellerle tamamen kapalı')),
  'Permanently enclosed enemy spawn must be rejected',
  result.errors
);

const occupiedSpawnCorridor = baseLevel();
occupiedSpawnCorridor.bricks = [[0,1]];
result = validateCustomLevel(occupiedSpawnCorridor);
assert(
  !result.ok && result.errors.some(error => error.includes('spawn koridoru için tamamen boş')),
  'Terrain directly below an enemy spawn must be rejected',
  result.errors
);

const noRoute = baseLevel();
noRoute.steel = Array.from({ length: 16 }, (_, x) => [x, 2]);
result = validateCustomLevel(noRoute);
assert(
  !result.ok && result.errors.some(error => error.includes('ulaşan bir rota içermiyor')),
  'Enemy spawn with no conceptual route to player/base must be rejected',
  result.errors
);

const destructibleRoute = baseLevel();
destructibleRoute.bricks = Array.from({ length: 16 }, (_, x) => [x, 2]);
result = validateCustomLevel(destructibleRoute);
assert(
  result.ok,
  'A brick barrier should remain conceptually traversable because enemies can breach it',
  result.errors
);

const malformedPlayer = baseLevel();
malformedPlayer.playerSpawn = [99, 99];
result = validateCustomLevel(malformedPlayer);
assert(
  !result.ok && result.errors.some(error => error.includes('Oyuncu başlangıcı geçersiz')),
  'Out-of-bounds player spawn must be rejected instead of normalized',
  result.errors
);

const malformedTerrain = baseLevel();
malformedTerrain.steel = [[2, 2], [-1, 4]];
result = validateCustomLevel(malformedTerrain);
assert(
  !result.ok && result.errors.some(error => error.includes('harita sınırı dışında')),
  'Out-of-bounds terrain must be rejected instead of silently dropped',
  result.errors
);

const duplicateEnemy = baseLevel();
duplicateEnemy.enemySpawns = [[0,0], [0,0], [7,0]];
result = validateCustomLevel(duplicateEnemy);
assert(
  !result.ok && result.errors.some(error => error.includes('birden fazla kez')),
  'Duplicate enemy spawns must be rejected',
  result.errors
);

console.log('Validated custom-map spawn safety and malformed input rules.');
