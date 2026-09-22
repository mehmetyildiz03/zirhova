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

export function damageBrick(mask, localX, localY, dx, dy, power, tileSize) {
  let nextMask = mask;
  const { col, row } = brickCellAt(localX, localY, tileSize);
  const strength = Math.max(1, Math.floor(Number(power) || 1));

  const cells = [[col, row]];

  // Shell width removes a second micro-brick perpendicular to travel.
  if (dx !== 0) {
    cells.push([col, row < BRICK_GRID - 1 ? row + 1 : row - 1]);
  } else {
    cells.push([col < BRICK_GRID - 1 ? col + 1 : col - 1, row]);
  }

  // Stronger rounds penetrate further into the wall.
  for (let step = 1; step < strength; step++) {
    const forwardCol = col + Math.sign(dx) * step;
    const forwardRow = row + Math.sign(dy) * step;
    cells.push([forwardCol, forwardRow]);

    if (dx !== 0) {
      cells.push([
        forwardCol,
        row < BRICK_GRID - 1 ? row + 1 : row - 1,
      ]);
    } else {
      cells.push([
        col < BRICK_GRID - 1 ? col + 1 : col - 1,
        forwardRow,
      ]);
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
