export const LEVEL_SIZE = 16;
export const TERRAIN_KEYS = ['bricks', 'steel', 'breakableSteel', 'water', 'ice', 'brush'];

export function coordKey([x, y]) {
  return `${x},${y}`;
}

export function isCoord(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1]) &&
    value[0] >= 0 &&
    value[1] >= 0 &&
    value[0] < LEVEL_SIZE &&
    value[1] < LEVEL_SIZE
  );
}

function terrainAt(level, x, y) {
  for (const key of TERRAIN_KEYS) {
    if ((level[key] || []).some(([tx, ty]) => tx === x && ty === y)) return key;
  }
  return null;
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < LEVEL_SIZE && y < LEVEL_SIZE;
}

function immediateNeighbors([x, y]) {
  return [[1,0],[-1,0],[0,1],[0,-1]]
    .map(([dx, dy]) => [x + dx, y + dy])
    .filter(([nx, ny]) => inBounds(nx, ny));
}

function uniqueCoords(list = []) {
  const seen = new Set();
  const out = [];

  for (const coord of list) {
    if (!isCoord(coord)) continue;
    const key = coordKey(coord);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([coord[0], coord[1]]);
  }

  return out;
}

export function normalizeCustomLevel(input = {}) {
  const level = {
    id: String(input.id || 'ozel-harita').slice(0, 40),
    name: String(input.name || 'ÖZEL HARİTA').slice(0, 40),
    playerSpawn: isCoord(input.playerSpawn) ? [...input.playerSpawn] : [5, 14],
    baseSpawn: isCoord(input.baseSpawn) ? [...input.baseSpawn] : [7, 15],
    enemySpawns: uniqueCoords(input.enemySpawns || []).slice(0, 4),
  };

  for (const key of TERRAIN_KEYS) {
    level[key] = uniqueCoords(input[key] || []);
  }

  return level;
}

export function validateCustomLevel(input) {
  const level = normalizeCustomLevel(input);
  const errors = [];

  if (!isCoord(level.playerSpawn)) errors.push('Oyuncu başlangıcı geçersiz.');
  if (!isCoord(level.baseSpawn)) errors.push('Üs konumu geçersiz.');
  if (level.enemySpawns.length < 2) errors.push('En az 2 düşman başlangıç noktası gerekli.');

  const occupied = new Map();

  for (const key of TERRAIN_KEYS) {
    for (const coord of level[key]) {
      const k = coordKey(coord);
      if (occupied.has(k)) {
        errors.push(`${coord[0]},${coord[1]} karesinde arazi çakışması var.`);
      } else {
        occupied.set(k, key);
      }
    }
  }

  const protectedCells = [
    ['Oyuncu', level.playerSpawn],
    ['Üs', level.baseSpawn],
    ...level.enemySpawns.map((coord, index) => [`Düşman ${index + 1}`, coord]),
  ];

  const spawnSeen = new Map();
  for (const [label, coord] of protectedCells) {
    const k = coordKey(coord);
    if (occupied.has(k)) errors.push(`${label} başlangıcı bir arazi bloğuyla çakışıyor.`);
    if (spawnSeen.has(k)) errors.push(`${label} başlangıcı ${spawnSeen.get(k)} ile aynı karede.`);
    else spawnSeen.set(k, label);
  }

  if (coordKey(level.playerSpawn) === coordKey(level.baseSpawn)) {
    errors.push('Oyuncu başlangıcı üs ile aynı karede olamaz.');
  }

  const playerExitCount = immediateNeighbors(level.playerSpawn)
    .filter(coord => coordKey(coord) !== coordKey(level.baseSpawn))
    .filter(([x, y]) => {
      const terrain = terrainAt(level, x, y);
      return !terrain || terrain === 'brush' || terrain === 'ice';
    }).length;

  if (playerExitCount < 2) {
    errors.push('Oyuncu başlangıcında en az 2 doğrudan sürüş çıkışı gerekli.');
  }

  for (const spawn of level.enemySpawns) {
    const permanentExitCount = immediateNeighbors(spawn)
      .filter(coord => coordKey(coord) !== coordKey(level.baseSpawn))
      .filter(coord => coordKey(coord) !== coordKey(level.playerSpawn))
      .filter(([x, y]) => {
        const terrain = terrainAt(level, x, y);
        return !['steel', 'breakableSteel', 'water'].includes(terrain);
      }).length;

    if (permanentExitCount < 1) {
      errors.push(`Düşman başlangıcı ${spawn[0]},${spawn[1]} kalıcı engellerle tamamen kapalı.`);
    }

    const belowY = spawn[1] + 1;
    if (belowY < LEVEL_SIZE) {
      const belowTerrain = terrainAt(level, spawn[0], belowY);
      if (belowTerrain && !['brush', 'ice'].includes(belowTerrain)) {
        errors.push(
          `Düşman başlangıcı ${spawn[0]},${spawn[1]} altındaki kare spawn koridoru için boş bırakılmalı.`
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    level,
  };
}
