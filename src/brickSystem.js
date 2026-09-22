export const BRICK_GRID = 4;
export const BRICK_FULL_MASK = 0xffff;

function clampCell(value) {
  return Math.max(0, Math.min(BRICK_GRID - 1, value));
}

export function brickCellAt(localX, localY, tileSize) {
  const cellSize = tileSize / BRICK_GRID;
  return {
    col: clampCell(Math.floor(localX / cellSize)),
    row: clampCell(Math.floor(localY / cellSize)),
  };
}

export function brickBit(col, row) {
  return 1 << (row * BRICK_GRID + col);
}

export function brickHasCell(mask, col, row) {
  if (col < 0 || row < 0 || col >= BRICK_GRID || row >= BRICK_GRID) return false;
  return Boolean(mask & brickBit(col, row));
}

export function brickContainsPoint(mask, localX, localY, tileSize) {
  const { col, row } = brickCellAt(localX, localY, tileSize);
  return brickHasCell(mask, col, row);
}

function pairedBand(index) {
  return index < BRICK_GRID / 2 ? [0, 1] : [2, 3];
}

export function damageBrick(mask, localX, localY, dx, dy, power, tileSize) {
  let nextMask = mask;
  const { col, row } = brickCellAt(localX, localY, tileSize);
  const strength = Math.max(1, Math.floor(Number(power) || 1));

  // Keep 4x4 collision precision internally, but destroy in large readable chunks:
  // standard = 2x2 quarter-wall, strong = 3x2, maximum = 4x2 half-wall.
  const depth = Math.min(BRICK_GRID, strength + 1);
  const cells = [];

  if (dx !== 0) {
    const rows = pairedBand(row);
    const step = Math.sign(dx) || 1;

    for (let distance = 0; distance < depth; distance++) {
      const targetCol = col + step * distance;
      for (const targetRow of rows) cells.push([targetCol, targetRow]);
    }
  } else {
    const cols = pairedBand(col);
    const step = Math.sign(dy) || 1;

    for (let distance = 0; distance < depth; distance++) {
      const targetRow = row + step * distance;
      for (const targetCol of cols) cells.push([targetCol, targetRow]);
    }
  }

  for (const [c, r] of cells) {
    if (c < 0 || r < 0 || c >= BRICK_GRID || r >= BRICK_GRID) continue;
    nextMask &= ~brickBit(c, r);
  }

  return nextMask >>> 0;
}

export function brickBlocksRect(mask, localLeft, localTop, localRight, localBottom, tileSize) {
  if (!mask) return false;

  const cellSize = tileSize / BRICK_GRID;

  for (let row = 0; row < BRICK_GRID; row++) {
    for (let col = 0; col < BRICK_GRID; col++) {
      if (!brickHasCell(mask, col, row)) continue;

      const left = col * cellSize;
      const top = row * cellSize;
      const right = left + cellSize;
      const bottom = top + cellSize;

      if (
        localLeft < right &&
        localRight > left &&
        localTop < bottom &&
        localBottom > top
      ) {
        return true;
      }
    }
  }

  return false;
}

export function countBrickCells(mask) {
  let count = 0;
  let value = mask >>> 0;
  while (value) {
    count += value & 1;
    value >>>= 1;
  }
  return count;
}
