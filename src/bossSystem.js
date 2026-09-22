export const BOSS_TYPE = 'bastion';

export function isBossWave(stage, waveInStage) {
  const s = Math.max(1, Math.floor(Number(stage) || 1));
  const local = Math.max(1, Math.floor(Number(waveInStage) || 1));
  return s % 3 === 0 && local === 3;
}

export function bossTier(stage) {
  const s = Math.max(1, Math.floor(Number(stage) || 1));
  return Math.max(1, Math.floor(s / 3));
}

export function bossStats(stage) {
  const tier = bossTier(stage);
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
