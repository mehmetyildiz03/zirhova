import {
  NAV_STEP,
  NAV_OFFSET,
  nearestNavCenter,
  nearestNavStart,
  isNavAlignedStart,
  navLaneIndexFromStart,
} from '../src/navigationSystem.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const WORLD = 768;
const TANK = 34;

assert(NAV_STEP === 16, 'Navigation step must stay 16px');
assert(NAV_OFFSET === 8, 'Navigation offset must stay centered in the 16px sub-grid');

// Native spawn positions are already on legal navigation lanes.
const spawnStart = 5 * 48 + (48 - TANK) / 2;
assert(spawnStart === 247, 'Unexpected reference spawn start');
assert(isNavAlignedStart(spawnStart, TANK, WORLD), 'Reference spawn must be nav-aligned');

// Small free movement drift must collapse back to the same discrete lane on turn.
const smallDriftStart = 242;
const smallDriftCenter = smallDriftStart + TANK / 2;
assert(
  nearestNavStart(smallDriftCenter, TANK, WORLD) === 247,
  'Small drift should snap back to the current 16px lane'
);

// Crossing the half-step boundary should move to exactly one adjacent firing lane.
const largerDriftStart = 237;
const largerDriftCenter = largerDriftStart + TANK / 2;
assert(
  nearestNavStart(largerDriftCenter, TANK, WORLD) === 231,
  'Larger drift should snap to the adjacent 16px lane'
);

const laneA = nearestNavStart(259, TANK, WORLD);
const laneB = nearestNavStart(243, TANK, WORLD);
assert(Math.abs(laneA - laneB) === NAV_STEP, 'Adjacent tank firing lanes must differ by 16px');

// World edges must still resolve to legal lanes instead of arbitrary clamped positions.
const left = nearestNavStart(19, TANK, WORLD);
const right = nearestNavStart(749, TANK, WORLD);
assert(left === 7, `Unexpected left edge lane: ${left}`);
assert(right === 727, `Unexpected right edge lane: ${right}`);
assert(isNavAlignedStart(left, TANK, WORLD), 'Left edge start must remain nav-aligned');
assert(isNavAlignedStart(right, TANK, WORLD), 'Right edge start must remain nav-aligned');

assert(
  navLaneIndexFromStart(247, TANK) - navLaneIndexFromStart(231, TANK) === 1,
  'Adjacent nav lanes must have consecutive indices'
);

assert(
  nearestNavCenter(259, TANK, WORLD) === 264,
  'Nearest center for small drift should return the stable firing center'
);

console.log('Validated 16px tank navigation sub-grid.');
