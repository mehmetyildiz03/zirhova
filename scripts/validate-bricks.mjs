import {
  BRICK_GRID,
  BRICK_FULL_MASK,
  brickBit,
  brickContainsPoint,
  damageBrick,
  brickBlocksRect,
  countBrickCells,
} from '../src/brickSystem.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(BRICK_GRID === 4, 'Brick grid must stay 4x4');
assert(countBrickCells(BRICK_FULL_MASK) === 16, 'Full brick wall must have 16 micro-cells');

const tileSize = 48;

// Standard right-moving shell entering top-left removes a two-cell vertical slice.
const standard = damageBrick(BRICK_FULL_MASK, 3, 3, 1, 0, 1, tileSize);
assert(countBrickCells(standard) === 14, 'Standard shell should remove two micro-bricks');
assert(!brickContainsPoint(standard, 3, 3, tileSize), 'Impact cell should be empty after hit');

// Strong shot must penetrate deeper than a standard shot.
const strong = damageBrick(BRICK_FULL_MASK, 3, 3, 1, 0, 2, tileSize);
assert(countBrickCells(strong) < countBrickCells(standard), 'Strong shot must remove more wall');
assert(!brickContainsPoint(strong, 15, 3, tileSize), 'Strong shot must penetrate forward');

// Collision must respect the actual remaining micro-bricks.
const onlyBottomRight = brickBit(3, 3);
assert(
  !brickBlocksRect(onlyBottomRight, 0, 0, 20, 20, tileSize),
  'Entity in cleared top-left must not collide'
);
assert(
  brickBlocksRect(onlyBottomRight, 34, 34, 47, 47, tileSize),
  'Entity over remaining bottom-right brick must collide'
);

// Repeated strong shots from the left should eventually carve the whole top band.
let mask = BRICK_FULL_MASK;
for (const y of [3, 15, 27, 39]) {
  mask = damageBrick(mask, 3, y, 1, 0, 4, tileSize);
}
assert(countBrickCells(mask) === 0, 'Repeated penetrating shots must be able to clear the wall');

console.log('Validated directional micro-brick destruction.');
