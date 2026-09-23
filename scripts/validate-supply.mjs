import {
  MAX_STAGE_LIVES,
  STAGE_SUPPLIES,
  normalizeStageSupplyId,
  stageSupplyById,
  stageSupplyChoices,
} from '../src/supplySystem.js';

function assert(condition, message, data) {
  if (!condition) throw new Error(data ? `${message}: ${JSON.stringify(data)}` : message);
}

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

assert(STAGE_SUPPLIES.length === 5, 'Supply catalog size mismatch');
assert(MAX_STAGE_LIVES === 6, 'Max stage lives drifted');
assert(normalizeStageSupplyId('emp') === 'emp', 'Valid supply id rejected');
assert(normalizeStageSupplyId('unknown') === null, 'Unknown supply id accepted');
assert(stageSupplyById('shield')?.effect === 'fortify', 'Shield supply effect mismatch');

const full = stageSupplyChoices({
  baseHp: 5,
  maxBaseHp: 5,
  lives: 6,
  maxLives: 6,
  rng: seeded(1),
});
assert(full.length === 3, 'Full-resource supply choice count mismatch', full);
assert(
  full.every(item => ['shield','emp','armor'].includes(item.id)),
  'Full-resource choices included a no-op contextual supply',
  full
);
assert(new Set(full.map(item => item.id)).size === 3, 'Full-resource supply choices are not unique', full);

const damaged = stageSupplyChoices({
  baseHp: 4,
  maxBaseHp: 5,
  lives: 6,
  maxLives: 6,
  rng: seeded(2),
});
assert(damaged[0]?.id === 'repair', 'Repair must be prioritized when next-stage base HP is below max', damaged);

const lowLives = stageSupplyChoices({
  baseHp: 5,
  maxBaseHp: 5,
  lives: 4,
  maxLives: 6,
  rng: seeded(3),
});
assert(lowLives[0]?.id === 'reserve', 'Reserve must be prioritized when lives are below max', lowLives);

const both = stageSupplyChoices({
  baseHp: 3,
  maxBaseHp: 5,
  lives: 5,
  maxLives: 6,
  rng: seeded(4),
});
assert(
  both[0]?.id === 'repair' && both[1]?.id === 'reserve' && both.length === 3,
  'Both contextual supplies must be guaranteed when both resources are missing',
  both
);

console.log('PASS stage supplies', {
  full: full.map(item => item.id),
  damaged: damaged.map(item => item.id),
  lowLives: lowLives.map(item => item.id),
  both: both.map(item => item.id),
});
