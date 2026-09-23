export const SUPPLY_VERSION = 1;
export const MAX_STAGE_LIVES = 6;

export const STAGE_SUPPLIES = Object.freeze([
  Object.freeze({
    id: 'shield',
    title: 'ÜS KALKANI',
    description: 'Yeni bölümde üs 14 sn korunur',
    shortLabel: 'KALKAN',
    effect: 'fortify',
  }),
  Object.freeze({
    id: 'emp',
    title: 'EMP ÖNCÜSÜ',
    description: 'Yeni bölüm başında düşmanlar 5 sn donar',
    shortLabel: 'EMP',
    effect: 'emp',
  }),
  Object.freeze({
    id: 'armor',
    title: 'REAKTİF ZIRH',
    description: 'Yeni bölümde tanklar 8 sn koruma alır',
    shortLabel: 'ZIRH',
    effect: 'armor',
  }),
  Object.freeze({
    id: 'repair',
    title: 'SAHA ONARIMI',
    description: 'Yeni bölümde üs +2 can alır (maks 5)',
    shortLabel: 'ONARIM',
    effect: 'repair',
    contextual: 'base',
  }),
  Object.freeze({
    id: 'reserve',
    title: 'YEDEK MÜRETTEBAT',
    description: 'Yeni bölüm için +1 yedek tank',
    shortLabel: 'YEDEK',
    effect: 'reserve',
    contextual: 'lives',
  }),
]);

const SUPPLY_BY_ID = new Map(STAGE_SUPPLIES.map(item => [item.id, item]));

export function normalizeStageSupplyId(value) {
  const id = String(value || '');
  return SUPPLY_BY_ID.has(id) ? id : null;
}

export function stageSupplyById(value) {
  const id = normalizeStageSupplyId(value);
  return id ? SUPPLY_BY_ID.get(id) : null;
}

function shuffle(items, rng) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const raw = Number(rng());
    const roll = Number.isFinite(raw) ? Math.max(0, Math.min(0.999999999, raw)) : 0;
    const j = Math.floor(roll * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function stageSupplyChoices({
  baseHp = 5,
  maxBaseHp = 5,
  lives = 3,
  maxLives = MAX_STAGE_LIVES,
  count = 3,
  rng = Math.random,
} = {}) {
  const safeCount = Math.max(1, Math.min(3, Math.floor(Number(count) || 3)));
  const safeBaseHp = Math.max(0, Number(baseHp) || 0);
  const safeMaxBaseHp = Math.max(1, Number(maxBaseHp) || 5);
  const safeLives = Math.max(0, Number(lives) || 0);
  const safeMaxLives = Math.max(1, Number(maxLives) || MAX_STAGE_LIVES);

  const contextual = [];
  if (safeBaseHp < safeMaxBaseHp) contextual.push(SUPPLY_BY_ID.get('repair'));
  if (safeLives < safeMaxLives) contextual.push(SUPPLY_BY_ID.get('reserve'));

  const core = shuffle(
    ['shield', 'emp', 'armor'].map(id => SUPPLY_BY_ID.get(id)),
    rng
  );

  return [...contextual, ...core]
    .filter(Boolean)
    .slice(0, safeCount)
    .map(item => ({ ...item }));
}
