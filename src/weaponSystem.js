export const MAX_WEAPON_TIER = 3;

export function normalizeWeaponTier(value) {
  const tier = Number(value) || 1;
  return Math.max(1, Math.min(MAX_WEAPON_TIER, Math.floor(tier)));
}

export function upgradeWeaponTier(current) {
  return Math.min(MAX_WEAPON_TIER, normalizeWeaponTier(current) + 1);
}

export function weaponProfile(tier) {
  switch (normalizeWeaponTier(tier)) {
    case 3:
      return {
        tier: 3,
        label: 'III',
        bulletSpeedMultiplier: 1.28,
        reloadMultiplier: 0.70,
        canBreakSteel: true,
      };
    case 2:
      return {
        tier: 2,
        label: 'II',
        bulletSpeedMultiplier: 1.14,
        reloadMultiplier: 0.84,
        canBreakSteel: false,
      };
    default:
      return {
        tier: 1,
        label: 'I',
        bulletSpeedMultiplier: 1,
        reloadMultiplier: 1,
        canBreakSteel: false,
      };
  }
}

export function damageBreakableSteel(hp, canBreakSteel) {
  const safeHp = Math.max(0, Number(hp) || 0);

  if (!canBreakSteel || safeHp <= 0) {
    return { damaged: false, hp: safeHp, destroyed: safeHp <= 0 };
  }

  const nextHp = Math.max(0, safeHp - 1);
  return {
    damaged: true,
    hp: nextHp,
    destroyed: nextHp === 0,
  };
}
