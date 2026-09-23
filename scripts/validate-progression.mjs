import {
  ACHIEVEMENTS,
  TANK_SKINS,
  createProfile,
  migrateProfile,
  applyProfileEvent,
  unlockedSkinIds,
  selectSkin,
} from '../src/progressionSystem.js';

function assert(condition, message, data) {
  if (!condition) {
    throw new Error(data ? `${message}: ${JSON.stringify(data)}` : message);
  }
}

const migrated = migrateProfile(null, { bestScore: 4321, bestStage: 4 });
assert(migrated.bestScore === 4321, 'Legacy best score was not migrated', migrated);
assert(migrated.bestStage === 4, 'Legacy best stage was not migrated', migrated);
assert(migrated.version === 4, 'Profile version is not v4', migrated);
assert(unlockedSkinIds(migrated).includes('cobalt'), 'Legacy stage should unlock cobalt', migrated);

let profile = createProfile();
let result = applyProfileEvent(profile, { type: 'enemy-defeated', score: 100 });
profile = result.profile;
assert(profile.enemiesDefeated === 1, 'Enemy counter did not increment', profile);
assert(profile.bestScore === 0, 'Enemy kill must not update a run record before record classification', profile);
assert(profile.achievementIds.includes('first-contact'), 'First-contact achievement missing', profile);

result = applyProfileEvent(profile, { type: 'stage-completed', nextStage: 3 });
profile = result.profile;
assert(profile.stagesCompleted === 1, 'Stage completion counter missing', profile);
assert(profile.bestStage === 3, 'Best stage did not advance', profile);
assert(profile.achievementIds.includes('line-holder'), 'Stage achievement missing', profile);
assert(unlockedSkinIds(profile).includes('cobalt'), 'Cobalt skin did not unlock', profile);

result = applyProfileEvent(profile, {
  type: 'enemy-defeated',
  boss: true,
  bossType: 'pincer',
  score: 2500,
});
profile = result.profile;
assert(profile.bossesDefeated === 1, 'Boss counter did not increment', profile);
assert(profile.pincersDefeated === 1, 'KISKAÇ counter did not increment', profile);
assert(profile.bastionsDefeated === 0, 'KISKAÇ contaminated BURÇKIRAN counter', profile);
assert(!profile.achievementIds.includes('bastion-breaker'), 'KISKAÇ incorrectly unlocked BURÇ KIRICI', profile);
assert(!unlockedSkinIds(profile).includes('ember'), 'KISKAÇ incorrectly unlocked KOR paint', profile);

result = applyProfileEvent(profile, {
  type: 'enemy-defeated',
  boss: true,
  bossType: 'bastion',
  score: 2500,
});
profile = result.profile;
assert(profile.bossesDefeated === 2, 'Second boss did not increment total boss counter', profile);
assert(profile.bastionsDefeated === 1, 'BURÇKIRAN counter did not increment', profile);
assert(profile.achievementIds.includes('bastion-breaker'), 'BURÇKIRAN achievement missing', profile);
assert(unlockedSkinIds(profile).includes('ember'), 'BURÇKIRAN did not unlock KOR paint', profile);

result = applyProfileEvent(profile, { type: 'weapon-tier', tier: 3 });
profile = result.profile;
assert(profile.highestWeaponTier === 3, 'Weapon tier was not persisted', profile);
assert(profile.achievementIds.includes('arsenal-master'), 'Arsenal achievement missing', profile);

result = applyProfileEvent(profile, { type: 'score', score: 10000, runClass: 'campaign' });
profile = result.profile;
assert(profile.bestScore === 10000, '10k score did not persist', profile);
assert(profile.achievementIds.includes('ten-thousand'), '10k achievement missing', profile);
assert(unlockedSkinIds(profile).includes('ivory'), 'Ivory skin did not unlock', profile);

for (let i = profile.enemiesDefeated; i < 100; i++) {
  profile = applyProfileEvent(profile, { type: 'enemy-defeated', score: profile.bestScore }).profile;
}
assert(profile.enemiesDefeated === 100, 'Centurion enemy total mismatch', profile);
assert(profile.achievementIds.includes('centurion'), 'Centurion achievement missing', profile);
assert(unlockedSkinIds(profile).includes('obsidian'), 'Obsidian skin did not unlock', profile);

result = applyProfileEvent(profile, {
  type: 'run-ended',
  score: 10500,
  stage: 5,
  coop: true,
  runClass: 'campaign',
});
profile = result.profile;
assert(profile.runs === 1 && profile.coopRuns === 1, 'Run/co-op counters did not persist', profile);
assert(profile.campaignRuns === 1, 'Campaign run counter did not persist', profile);
assert(profile.bestScore === 10500 && profile.bestCoopScore === 10500, 'Campaign/co-op records did not persist', profile);
assert(profile.achievementIds.includes('wingman'), 'Co-op achievement missing', profile);

const campaignRecord = profile.bestScore;
result = applyProfileEvent(profile, {
  type: 'run-ended',
  score: 16000,
  stage: 6,
  coop: false,
  runClass: 'deployment',
});
profile = result.profile;
assert(profile.deploymentRuns === 1, 'Deployment run counter did not persist', profile);
assert(profile.bestDeploymentScore === 16000, 'Deployment record did not persist', profile);
assert(profile.bestScore === campaignRecord, 'Deployment score contaminated campaign record', profile);

result = applyProfileEvent(profile, {
  type: 'run-ended',
  score: 99999,
  stage: 1,
  coop: false,
  runClass: 'custom',
});
profile = result.profile;
assert(profile.customRuns === 1, 'Custom run counter did not persist', profile);
assert(profile.bestScore === campaignRecord, 'Custom score contaminated campaign record', profile);
assert(profile.bestDeploymentScore === 16000, 'Custom score contaminated deployment record', profile);

for (let i = profile.runs; i < 10; i++) {
  profile = applyProfileEvent(profile, {
    type: 'run-ended',
    score: 5000,
    stage: profile.bestStage,
    coop: false,
    runClass: 'campaign',
  }).profile;
}
assert(profile.runs === 10, 'Veteran run count mismatch', profile);
assert(profile.achievementIds.includes('veteran'), 'Veteran achievement missing', profile);

const legacyBossProfile = migrateProfile({
  version: 3,
  bossesDefeated: 2,
  achievementIds: ['bastion-breaker'],
}, null);
assert(
  legacyBossProfile.bastionsDefeated === 2 &&
  legacyBossProfile.pincersDefeated === 0 &&
  unlockedSkinIds(legacyBossProfile).includes('ember'),
  'Legacy v3 boss progress was not preserved during v4 migration',
  legacyBossProfile
);

const fresh = createProfile();
const lockedSelect = selectSkin(fresh, 'ember');
assert(!lockedSelect.changed, 'Locked cosmetic was selectable', lockedSelect);
assert(lockedSelect.profile.selectedSkin === 'classic', 'Locked select changed current skin', lockedSelect);

const cobaltSelect = selectSkin(profile, 'cobalt');
assert(cobaltSelect.changed, 'Unlocked cobalt could not be selected', cobaltSelect);
assert(cobaltSelect.profile.selectedSkin === 'cobalt', 'Cobalt selection did not persist in profile object');

assert(ACHIEVEMENTS.length >= 8, 'Achievement catalog unexpectedly small');
assert(TANK_SKINS.length >= 5, 'Cosmetic catalog unexpectedly small');

console.log('PASS progression profile', {
  achievements: profile.achievementIds.length,
  skinsUnlocked: unlockedSkinIds(profile),
  runs: profile.runs,
  enemiesDefeated: profile.enemiesDefeated,
  bossesDefeated: profile.bossesDefeated,
});
