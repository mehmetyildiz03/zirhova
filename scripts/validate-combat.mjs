import { LEVELS } from '../src/levels.js';
import {
  MAX_WEAPON_TIER,
  normalizeWeaponTier,
  upgradeWeaponTier,
  weaponProfile,
  damageBreakableSteel,
} from '../src/weaponSystem.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(MAX_WEAPON_TIER === 3, 'Weapon tier cap must stay at III');
assert(normalizeWeaponTier(0) === 1, 'Weapon tier must clamp low values to I');
assert(normalizeWeaponTier(99) === 3, 'Weapon tier must clamp high values to III');
assert(upgradeWeaponTier(1) === 2, 'Tier I must upgrade to II');
assert(upgradeWeaponTier(2) === 3, 'Tier II must upgrade to III');
assert(upgradeWeaponTier(3) === 3, 'Tier III must stay capped');

const tier1 = weaponProfile(1);
const tier2 = weaponProfile(2);
const tier3 = weaponProfile(3);

assert(tier1.label === 'I' && !tier1.canBreakSteel, 'Tier I profile invalid');
assert(tier2.label === 'II' && !tier2.canBreakSteel, 'Tier II must not break tactical steel');
assert(tier3.label === 'III' && tier3.canBreakSteel, 'Tier III must break tactical steel');
assert(tier2.bulletSpeedMultiplier > tier1.bulletSpeedMultiplier, 'Tier II must accelerate shells');
assert(tier3.bulletSpeedMultiplier > tier2.bulletSpeedMultiplier, 'Tier III must further accelerate shells');
assert(tier2.reloadMultiplier < tier1.reloadMultiplier, 'Tier II must reload faster');
assert(tier3.reloadMultiplier < tier2.reloadMultiplier, 'Tier III must reload faster than II');

const blocked = damageBreakableSteel(3, false);
assert(!blocked.damaged && blocked.hp === 3, 'Lower tiers must not damage tactical steel');

const hit1 = damageBreakableSteel(3, true);
const hit2 = damageBreakableSteel(hit1.hp, true);
const hit3 = damageBreakableSteel(hit2.hp, true);
assert(hit1.damaged && hit1.hp === 2 && !hit1.destroyed, 'First tactical steel hit invalid');
assert(hit2.hp === 1 && !hit2.destroyed, 'Second tactical steel hit invalid');
assert(hit3.hp === 0 && hit3.destroyed, 'Third tactical steel hit must destroy the block');

for (const level of LEVELS) {
  assert(
    Array.isArray(level.breakableSteel) && level.breakableSteel.length >= 2,
    `${level.id}: needs tactical steel gates`
  );

  const normalSteel = new Set((level.steel || []).map(([x, y]) => `${x},${y}`));
  for (const [x, y] of level.breakableSteel) {
    assert(!normalSteel.has(`${x},${y}`), `${level.id}: tactical steel overlaps normal steel at ${x},${y}`);
  }
}

console.log(`Validated weapon tiers and tactical steel across ${LEVELS.length} levels.`);
