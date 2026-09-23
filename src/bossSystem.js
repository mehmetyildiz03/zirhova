export const BOSS_TYPE = 'bastion';
export const SECOND_BOSS_TYPE = 'pincer';

export function isBossWave(stage, waveInStage) {
  const s = Math.max(1, Math.floor(Number(stage) || 1));
  const local = Math.max(1, Math.floor(Number(waveInStage) || 1));
  return s % 3 === 0 && local === 3;
}

export function bossTier(stage) {
  const s = Math.max(1, Math.floor(Number(stage) || 1));
  return Math.max(1, Math.floor(s / 3));
}

export function bossTypeForStage(stage) {
  const encounter = bossTier(stage);
  return encounter % 2 === 0 ? SECOND_BOSS_TYPE : BOSS_TYPE;
}

export function bossName(type) {
  return type === SECOND_BOSS_TYPE ? 'KISKAÇ' : 'BURÇKIRAN';
}

function variantTier(stage) {
  return Math.max(1, Math.ceil(bossTier(stage) / 2));
}

export function bossStats(stage, type = bossTypeForStage(stage)) {
  const tier = variantTier(stage);

  if (type === SECOND_BOSS_TYPE) {
    return {
      hp: Math.min(11, 7 + (tier - 1) * 2),
      speed: Math.min(128, 112 + (tier - 1) * 5),
      phase2Speed: Math.min(148, 136 + (tier - 1) * 4),
      fireBase: Math.max(0.54, 0.68 - (tier - 1) * 0.04),
      phase2FireBase: Math.max(0.38, 0.47 - (tier - 1) * 0.03),
      score: 1250 + (tier - 1) * 400,
    };
  }

  return {
    hp: Math.min(14, 8 + (tier - 1) * 2),
    speed: Math.min(82, 66 + (tier - 1) * 4),
    phase2Speed: Math.min(98, 84 + (tier - 1) * 4),
    fireBase: Math.max(0.56, 0.74 - (tier - 1) * 0.04),
    phase2FireBase: Math.max(0.38, 0.49 - (tier - 1) * 0.03),
    score: 1100 + (tier - 1) * 350,
  };
}

export function bossPhase(hp, maxHp) {
  const safeMax = Math.max(1, Number(maxHp) || 1);
  const safeHp = Math.max(0, Number(hp) || 0);
  return safeHp / safeMax <= 0.5 ? 2 : 1;
}

export function isFrontalBossHit(facing, bulletDx, bulletDy) {
  const dirs = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const front = dirs[facing];
  if (!front) return false;

  const dx = Math.sign(Number(bulletDx) || 0);
  const dy = Math.sign(Number(bulletDy) || 0);
  return dx === -front.x && dy === -front.y;
}

export function bossDamageResult({
  facing,
  bulletDx,
  bulletDy,
  damage = 1,
  bypassArmor = false,
} = {}) {
  const incoming = Math.max(0, Number(damage) || 0);
  const blocked =
    !bypassArmor &&
    isFrontalBossHit(facing, bulletDx, bulletDy);

  return {
    blocked,
    damage: blocked ? 0 : incoming,
  };
}

const FLANK_DIRS = Object.freeze({
  up: ['left', 'right'],
  right: ['up', 'down'],
  down: ['right', 'left'],
  left: ['down', 'up'],
});

const OPPOSITE_DIR = Object.freeze({
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
});

export function pincerVolleyDirections(facing = 'down', phase = 1) {
  const primary = FLANK_DIRS[facing] ? facing : 'down';
  const flanks = FLANK_DIRS[primary];
  const dirs = [primary, ...flanks];
  if (Number(phase) >= 2) dirs.push(OPPOSITE_DIR[primary]);
  return dirs;
}

export function bossAbilityCooldown(stage, type, phase = 1) {
  if (type !== SECOND_BOSS_TYPE) return Infinity;
  const tier = variantTier(stage);
  if (Number(phase) >= 2) {
    return Math.max(1.25, 1.75 - (tier - 1) * 0.10);
  }
  return Math.max(1.90, 2.55 - (tier - 1) * 0.12);
}
