export const CHECKPOINT_STORAGE_KEY = 'zirhova-campaign-checkpoint-v1';
export const CHECKPOINT_VERSION = 1;
export const MAX_SELECTABLE_STAGE = 99;

const UPGRADE_ORDER = ['tracks', 'loader', 'velocity', 'armor', 'cannon'];
const UPGRADE_CAPS = Object.freeze({
  tracks: 3,
  loader: 3,
  velocity: 3,
  armor: 2,
  cannon: 2,
});

function finiteInt(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function finiteNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function normalizeStage(stage, maxStage = MAX_SELECTABLE_STAGE) {
  return finiteInt(stage, 1, 1, Math.max(1, maxStage));
}

export function stageStartWave(stage) {
  return (normalizeStage(stage) - 1) * 3 + 1;
}

export function selectableStages(bestStage) {
  const max = normalizeStage(bestStage);
  return Array.from({ length: max }, (_, index) => index + 1);
}

export function deploymentLoadout(stage, coop = false) {
  const safeStage = normalizeStage(stage);
  const upgradeLevels = Object.fromEntries(UPGRADE_ORDER.map(id => [id, 0]));
  let remaining = safeStage - 1;
  let cursor = 0;
  let safety = 0;

  while (remaining > 0 && safety < 80) {
    safety++;
    const id = UPGRADE_ORDER[cursor % UPGRADE_ORDER.length];
    cursor++;
    if (upgradeLevels[id] >= UPGRADE_CAPS[id]) continue;
    upgradeLevels[id]++;
    remaining--;
    if (Object.entries(UPGRADE_CAPS).every(([key, cap]) => upgradeLevels[key] >= cap)) break;
  }

  const modifiers = {
    speed: 1.10 ** upgradeLevels.tracks,
    fireRate: 0.86 ** upgradeLevels.loader,
    bulletSpeed: 1.12 ** upgradeLevels.velocity,
    armor: upgradeLevels.armor,
    shotPower: 1 + upgradeLevels.cannon,
  };

  return {
    stage: safeStage,
    wave: stageStartWave(safeStage),
    waveInStage: 1,
    score: 0,
    lives: coop ? 5 : 3,
    baseHp: 5,
    weaponTier: Math.min(3, 1 + Math.floor((safeStage - 1) / 3)),
    arsenalMisses: 0,
    modifiers,
    upgradeLevels,
    coop: Boolean(coop),
    runEnemiesDefeated: 0,
    runBossesDefeated: 0,
    runClass: safeStage === 1 ? 'campaign' : 'deployment',
    runStartStage: safeStage,
  };
}

export function createCheckpoint(source = {}) {
  const stage = normalizeStage(source.stage);
  if (stage < 2) return null;

  const defaults = deploymentLoadout(stage, Boolean(source.coop));
  return {
    version: CHECKPOINT_VERSION,
    stage,
    wave: finiteInt(source.wave, stageStartWave(stage), stageStartWave(stage)),
    waveInStage: 1,
    score: finiteInt(source.score, 0),
    lives: finiteInt(source.lives, defaults.lives, 0, 6),
    baseHp: finiteInt(source.baseHp, 5, 1, 5),
    weaponTier: finiteInt(source.weaponTier, 1, 1, 3),
    arsenalMisses: finiteInt(source.arsenalMisses, 0, 0, 10),
    coop: Boolean(source.coop),
    runEnemiesDefeated: finiteInt(source.runEnemiesDefeated, 0),
    runBossesDefeated: finiteInt(source.runBossesDefeated, 0),
    modifiers: {
      speed: finiteNumber(source.modifiers?.speed, 1, 0.7, 2),
      fireRate: finiteNumber(source.modifiers?.fireRate, 1, 0.35, 1.3),
      bulletSpeed: finiteNumber(source.modifiers?.bulletSpeed, 1, 0.7, 2),
      armor: finiteInt(source.modifiers?.armor, 0, 0, 4),
      shotPower: finiteInt(source.modifiers?.shotPower, 1, 1, 5),
    },
    upgradeLevels: Object.fromEntries(
      UPGRADE_ORDER.map(id => [
        id,
        finiteInt(source.upgradeLevels?.[id], 0, 0, UPGRADE_CAPS[id]),
      ])
    ),
  };
}

export function normalizeCheckpoint(raw, bestStage) {
  if (!raw || typeof raw !== 'object') return null;
  if (Number(raw.version) !== CHECKPOINT_VERSION) return null;

  const checkpoint = createCheckpoint(raw);
  if (!checkpoint) return null;

  const unlocked = normalizeStage(bestStage);
  if (checkpoint.stage > unlocked) return null;
  if (checkpoint.wave !== stageStartWave(checkpoint.stage)) return null;
  if (Number(raw.waveInStage) !== 1) return null;

  return checkpoint;
}

export function runRecordLabel(runClass, runStartStage = 1) {
  if (runClass === 'deployment') return `SERBEST · B${normalizeStage(runStartStage)}`;
  if (runClass === 'custom') return 'ÖZEL HARİTA';
  return 'TAM KOŞU';
}
