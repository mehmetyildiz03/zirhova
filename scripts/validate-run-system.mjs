import {
  CHECKPOINT_VERSION,
  deploymentLoadout,
  createCheckpoint,
  normalizeCheckpoint,
  selectableStages,
  stageStartWave,
  runRecordLabel,
} from '../src/runSystem.js';

function assert(condition, message, data) {
  if (!condition) {
    throw new Error(data ? `${message}: ${JSON.stringify(data)}` : message);
  }
}

assert(stageStartWave(1) === 1, 'Stage 1 must start at absolute wave 1');
assert(stageStartWave(2) === 4, 'Stage 2 must start at absolute wave 4');
assert(stageStartWave(4) === 10, 'Stage 4 must start at absolute wave 10');

const stages = selectableStages(4);
assert(JSON.stringify(stages) === JSON.stringify([1,2,3,4]), 'Selectable stages mismatch', stages);

const stage1 = deploymentLoadout(1, false);
assert(stage1.runClass === 'campaign', 'Stage 1 must remain a campaign run', stage1);
assert(stage1.weaponTier === 1, 'Stage 1 must start with weapon tier I', stage1);
assert(stage1.score === 0 && stage1.lives === 3, 'Stage 1 baseline loadout mismatch', stage1);

const stage4 = deploymentLoadout(4, false);
assert(stage4.runClass === 'deployment', 'Stage 4 select must be deployment class', stage4);
assert(stage4.wave === 10, 'Stage 4 absolute wave mismatch', stage4);
assert(stage4.weaponTier === 2, 'Stage 4 deployment should start with weapon tier II', stage4);
assert(stage4.modifiers.speed > 1, 'Stage 4 deployment loadout should include earned-equivalent upgrades', stage4);
assert(stage4.upgradeLevels.tracks + stage4.upgradeLevels.loader + stage4.upgradeLevels.velocity + stage4.upgradeLevels.armor + stage4.upgradeLevels.cannon === 3, 'Stage 4 loadout must represent three prior stage upgrades', stage4);

const stage7 = deploymentLoadout(7, true);
assert(stage7.weaponTier === 3, 'Stage 7 deployment should start with weapon tier III', stage7);
assert(stage7.lives === 5 && stage7.coop, 'Co-op deployment baseline mismatch', stage7);

const checkpoint = createCheckpoint({
  stage: 4,
  wave: 10,
  waveInStage: 1,
  score: 7650,
  lives: 2,
  baseHp: 3,
  weaponTier: 3,
  arsenalMisses: 1,
  coop: false,
  modifiers: {
    speed: 1.21,
    fireRate: 0.74,
    bulletSpeed: 1.12,
    armor: 1,
    shotPower: 2,
  },
  upgradeLevels: {
    tracks: 2,
    loader: 2,
    velocity: 1,
    armor: 1,
    cannon: 1,
  },
});

assert(checkpoint?.version === CHECKPOINT_VERSION, 'Checkpoint version mismatch', checkpoint);
assert(checkpoint.score === 7650, 'Checkpoint score was not preserved', checkpoint);
assert(checkpoint.baseHp === 3 && checkpoint.lives === 2, 'Checkpoint health/lives were not preserved', checkpoint);
assert(checkpoint.weaponTier === 3, 'Checkpoint weapon tier was not preserved', checkpoint);

const normalized = normalizeCheckpoint(checkpoint, 4);
assert(normalized?.stage === 4 && normalized.wave === 10, 'Valid checkpoint rejected', normalized);
assert(normalizeCheckpoint(checkpoint, 3) === null, 'Checkpoint beyond unlocked stage must be rejected');

const badWave = { ...checkpoint, wave: 11 };
assert(normalizeCheckpoint(badWave, 4) === null, 'Mid-stage checkpoint must be rejected');

const badVersion = { ...checkpoint, version: 99 };
assert(normalizeCheckpoint(badVersion, 4) === null, 'Unknown checkpoint version must be rejected');

assert(runRecordLabel('campaign', 4) === 'TAM KOŞU', 'Campaign record label mismatch');
assert(runRecordLabel('deployment', 4) === 'SERBEST · B4', 'Deployment record label mismatch');
assert(runRecordLabel('custom', 1) === 'ÖZEL HARİTA', 'Custom record label mismatch');

console.log('PASS run/checkpoint model', {
  selectableStages: stages,
  stage4: {
    wave: stage4.wave,
    weaponTier: stage4.weaponTier,
    upgradeLevels: stage4.upgradeLevels,
  },
  checkpoint: {
    stage: normalized.stage,
    score: normalized.score,
    baseHp: normalized.baseHp,
  },
});
