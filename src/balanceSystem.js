export const BALANCE_VERSION = 2;

const TYPE_ORDER = ['raider', 'scout', 'hunter', 'breacher', 'heavy'];

export const ENEMY_UNLOCK_WAVE = Object.freeze({
  raider: 1,
  scout: 2,
  hunter: 4,
  breacher: 6,
  heavy: 8,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function waveEnemyCount(stage, waveInStage) {
  const stagePressure = clamp((Number(stage) || 1) - 1, 0, 5);
  return clamp(3 + (Number(waveInStage) || 1) + stagePressure, 4, 11);
}

export function waveDifficulty(wave) {
  return Math.max(1, Math.floor(Number(wave) || 1));
}

export function enemyCaps(wave, count, capBonuses = null) {
  const w = waveDifficulty(wave);
  const caps = {
    raider: count,
    scout: Math.max(1, Math.ceil(count * 0.45)),
    hunter: w >= 4 ? Math.max(1, Math.ceil(count * 0.30)) : 0,
    breacher: w >= 6 ? (w >= 10 ? 2 : 1) : 0,
    heavy: w >= 8 ? (w >= 13 ? 2 : 1) : 0,
  };

  if (capBonuses) {
    for (const type of TYPE_ORDER) {
      const raw = Number(capBonuses[type]);
      if (!Number.isFinite(raw) || raw <= 0) continue;
      caps[type] = Math.min(count, caps[type] + Math.floor(raw));
    }
  }

  return caps;
}

export function enemyWeights(wave) {
  const w = waveDifficulty(wave);
  return {
    raider: Math.max(1.35, 4.6 - w * 0.22),
    scout: w >= 2 ? 1.15 + Math.min(0.55, (w - 2) * 0.07) : 0,
    hunter: w >= 4 ? 0.72 + Math.min(0.72, (w - 4) * 0.09) : 0,
    breacher: w >= 6 ? 0.42 + Math.min(0.58, (w - 6) * 0.08) : 0,
    heavy: w >= 8 ? 0.24 + Math.min(0.56, (w - 8) * 0.07) : 0,
  };
}

export function stageFinaleAnchor(stage, waveInStage) {
  if (Number(waveInStage) !== 3) return null;
  const s = Math.max(1, Math.floor(Number(stage) || 1));
  if (s === 1) return 'scout';
  if (s === 2) return 'hunter';
  if (s === 3) return 'breacher';
  return 'heavy';
}

function weightedPick(types, weights, rng) {
  const total = types.reduce((sum, type) => sum + Math.max(0, weights[type] || 0), 0);
  if (total <= 0) return 'raider';

  let roll = clamp(Number(rng()) || 0, 0, 0.999999999) * total;
  for (const type of types) {
    roll -= Math.max(0, weights[type] || 0);
    if (roll < 0) return type;
  }
  return types[types.length - 1] || 'raider';
}

export function buildEnemyRoster({
  stage,
  wave,
  waveInStage,
  count = waveEnemyCount(stage, waveInStage),
  rng = Math.random,
  weightMultipliers = null,
  capBonuses = null,
} = {}) {
  const w = waveDifficulty(wave);
  const safeCount = clamp(Math.floor(Number(count) || 0), 1, 11);
  const baseWeights = enemyWeights(w);
  const weights = Object.fromEntries(
    TYPE_ORDER.map(type => {
      const rawMultiplier = Number(weightMultipliers?.[type]);
      const multiplier = Number.isFinite(rawMultiplier)
        ? Math.max(0, rawMultiplier)
        : 1;
      return [type, baseWeights[type] * multiplier];
    })
  );
  const caps = enemyCaps(w, safeCount, capBonuses);
  const roster = [];
  const counts = Object.fromEntries(TYPE_ORDER.map(type => [type, 0]));

  const anchor = stageFinaleAnchor(stage, waveInStage);
  const reservedAnchor = Boolean(
    anchor &&
    ENEMY_UNLOCK_WAVE[anchor] <= w &&
    (caps[anchor] || 0) > 0
  );
  const randomCaps = { ...caps };

  if (reservedAnchor) {
    randomCaps[anchor] = Math.max(0, (randomCaps[anchor] || 0) - 1);
  }

  const randomSlots = safeCount - (reservedAnchor ? 1 : 0);

  for (let i = 0; i < randomSlots; i++) {
    const eligible = TYPE_ORDER.filter(type =>
      ENEMY_UNLOCK_WAVE[type] <= w &&
      counts[type] < (randomCaps[type] || 0) &&
      (weights[type] || 0) > 0
    );

    let type = weightedPick(eligible.length ? eligible : ['raider'], weights, rng);
    if (counts[type] >= (randomCaps[type] || 0)) type = 'raider';

    roster.push(type);
    counts[type]++;
  }

  if (reservedAnchor) {
    roster.push(anchor);
    counts[anchor]++;
  }

  return roster;
}

export function waveHasCarrier(waveInStage) {
  const local = Math.max(1, Math.min(3, Math.floor(Number(waveInStage) || 1)));
  return local >= 2;
}

export function carrierIndexForWave(count, waveInStage) {
  if (!waveHasCarrier(waveInStage)) return -1;
  const safeCount = Math.max(1, Math.floor(Number(count) || 1));
  const ratio = Number(waveInStage) === 3 ? 0.68 : 0.56;
  return clamp(Math.floor(safeCount * ratio), 1, safeCount - 1);
}

export function shouldDropArsenal({
  weaponTier,
  maxWeaponTier = 3,
  misses = 0,
  rng = Math.random,
} = {}) {
  if ((Number(weaponTier) || 1) >= maxWeaponTier) {
    return { arsenal: false, nextMisses: 0 };
  }

  const pity = Math.max(0, Math.floor(Number(misses) || 0));
  const arsenal = pity >= 2 || rng() < 0.34;

  return {
    arsenal,
    nextMisses: arsenal ? 0 : pity + 1,
  };
}

export function threatValue(type) {
  return ({
    raider: 1,
    scout: 1.18,
    hunter: 1.75,
    breacher: 2.1,
    heavy: 3.15,
  })[type] || 1;
}

export function rosterThreat(roster = []) {
  return roster.reduce((sum, type) => sum + threatValue(type), 0);
}
