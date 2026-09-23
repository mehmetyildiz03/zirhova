export const PROFILE_VERSION = 3;
export const PROFILE_STORAGE_KEY = 'zirhova-profile-v2';
export const LEGACY_PROGRESS_KEY = 'zirhova-progress-v1';

function int(value, fallback = 0, min = 0) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? Math.max(min, parsed) : fallback;
}

export const ACHIEVEMENTS = Object.freeze([
  {
    id: 'first-contact',
    title: 'İLK TEMAS',
    description: 'İlk düşman tankını imha et.',
    earned: profile => profile.enemiesDefeated >= 1,
  },
  {
    id: 'line-holder',
    title: 'HAT MUHAFIZI',
    description: 'Bölüm 3’e ulaş.',
    earned: profile => profile.bestStage >= 3,
  },
  {
    id: 'bastion-breaker',
    title: 'BURÇ KIRICI',
    description: 'Bir BURÇKIRAN imha et.',
    earned: profile => profile.bossesDefeated >= 1,
  },
  {
    id: 'arsenal-master',
    title: 'ARSENAL USTASI',
    description: 'NAMLU III seviyesine ulaş.',
    earned: profile => profile.highestWeaponTier >= 3,
  },
  {
    id: 'ten-thousand',
    title: 'BEŞ HANELİ',
    description: 'Tek koşuda 10.000 puana ulaş.',
    earned: profile => Math.max(profile.bestScore, profile.bestDeploymentScore) >= 10000,
  },
  {
    id: 'centurion',
    title: 'YÜZLÜK HAT',
    description: 'Toplam 100 düşman tankı imha et.',
    earned: profile => profile.enemiesDefeated >= 100,
  },
  {
    id: 'wingman',
    title: 'KANAT ARKADAŞI',
    description: 'Bir co-op koşusu tamamla.',
    earned: profile => profile.coopRuns >= 1,
  },
  {
    id: 'veteran',
    title: 'VETERAN',
    description: '10 koşu tamamla.',
    earned: profile => profile.runs >= 10,
  },
]);

export const TANK_SKINS = Object.freeze([
  {
    id: 'classic',
    name: 'KLASİK',
    description: 'ZIRHOVA’nın standart sarı saha boyası.',
    primary: '#e8d35b',
    dark: '#8c7d2d',
    accent: '#fff3a4',
    unlocked: () => true,
  },
  {
    id: 'cobalt',
    name: 'KOBALT',
    description: 'Bölüm 3’e ulaşıldığında açılır.',
    primary: '#5aaed6',
    dark: '#285d78',
    accent: '#bfeaff',
    unlocked: profile => profile.bestStage >= 3,
  },
  {
    id: 'ember',
    name: 'KOR',
    description: 'İlk BURÇKIRAN imhasıyla açılır.',
    primary: '#dc7b4a',
    dark: '#713920',
    accent: '#ffd0a8',
    unlocked: profile => profile.bossesDefeated >= 1,
  },
  {
    id: 'ivory',
    name: 'FİLDİŞİ',
    description: '10.000 tek-koşu skorunda açılır.',
    primary: '#ddd7c8',
    dark: '#777267',
    accent: '#ffffff',
    unlocked: profile => Math.max(profile.bestScore, profile.bestDeploymentScore) >= 10000,
  },
  {
    id: 'obsidian',
    name: 'OBSİDYEN',
    description: 'Toplam 100 düşman imhasında açılır.',
    primary: '#69717e',
    dark: '#252a31',
    accent: '#c8d0dc',
    unlocked: profile => profile.enemiesDefeated >= 100,
  },
]);

export function createProfile(seed = {}) {
  const profile = {
    version: PROFILE_VERSION,
    bestScore: int(seed.bestScore, 0),
    bestSoloScore: int(seed.bestSoloScore, 0),
    bestCoopScore: int(seed.bestCoopScore, 0),
    bestDeploymentScore: int(seed.bestDeploymentScore, 0),
    bestStage: int(seed.bestStage, 1, 1),
    runs: int(seed.runs, 0),
    campaignRuns: int(seed.campaignRuns, 0),
    deploymentRuns: int(seed.deploymentRuns, 0),
    customRuns: int(seed.customRuns, 0),
    coopRuns: int(seed.coopRuns, 0),
    enemiesDefeated: int(seed.enemiesDefeated, 0),
    bossesDefeated: int(seed.bossesDefeated, 0),
    stagesCompleted: int(seed.stagesCompleted, 0),
    highestWeaponTier: int(seed.highestWeaponTier, 1, 1),
    achievementIds: Array.isArray(seed.achievementIds)
      ? [...new Set(seed.achievementIds.filter(id => ACHIEVEMENTS.some(item => item.id === id)))]
      : [],
    selectedSkin: typeof seed.selectedSkin === 'string' ? seed.selectedSkin : 'classic',
  };

  profile.achievementIds = resolveAchievementIds(profile);

  if (!isSkinUnlocked(profile, profile.selectedSkin)) {
    profile.selectedSkin = 'classic';
  }

  return profile;
}

export function migrateProfile(rawProfile, legacyProgress = null) {
  const raw = rawProfile && typeof rawProfile === 'object' ? rawProfile : {};
  const legacy = legacyProgress && typeof legacyProgress === 'object' ? legacyProgress : {};

  return createProfile({
    ...raw,
    bestScore: Math.max(int(raw.bestScore, 0), int(legacy.bestScore, 0)),
    bestStage: Math.max(int(raw.bestStage, 1, 1), int(legacy.bestStage, 1, 1)),
  });
}

export function resolveAchievementIds(profile) {
  const existing = new Set(
    Array.isArray(profile.achievementIds) ? profile.achievementIds : []
  );

  for (const achievement of ACHIEVEMENTS) {
    if (achievement.earned(profile)) existing.add(achievement.id);
  }

  return [...existing];
}

export function unlockedSkinIds(profile) {
  return TANK_SKINS
    .filter(skin => skin.unlocked(profile))
    .map(skin => skin.id);
}

export function isSkinUnlocked(profile, skinId) {
  const skin = TANK_SKINS.find(item => item.id === skinId);
  return Boolean(skin && skin.unlocked(profile));
}

export function skinById(skinId) {
  return TANK_SKINS.find(item => item.id === skinId) || TANK_SKINS[0];
}

export function selectSkin(profile, skinId) {
  const next = createProfile(profile);
  if (!isSkinUnlocked(next, skinId)) {
    return { profile: next, changed: false };
  }

  const changed = next.selectedSkin !== skinId;
  next.selectedSkin = skinId;
  return { profile: next, changed };
}

export function applyProfileEvent(profile, event = {}) {
  const before = createProfile(profile);
  const beforeAchievements = new Set(before.achievementIds);
  const beforeSkins = new Set(unlockedSkinIds(before));
  const next = { ...before, achievementIds: [...before.achievementIds] };

  switch (event.type) {
    case 'enemy-defeated':
      next.enemiesDefeated += 1;
      if (event.boss) next.bossesDefeated += 1;
      break;

    case 'stage-completed':
      next.stagesCompleted += 1;
      next.bestStage = Math.max(next.bestStage, int(event.nextStage, next.bestStage, 1));
      break;

    case 'weapon-tier':
      next.highestWeaponTier = Math.max(
        next.highestWeaponTier,
        int(event.tier, next.highestWeaponTier, 1)
      );
      break;

    case 'run-ended': {
      next.runs += 1;
      if (event.coop) next.coopRuns += 1;

      const score = int(event.score, 0);
      const runClass = event.runClass || 'campaign';

      if (runClass === 'deployment') {
        next.deploymentRuns += 1;
        next.bestDeploymentScore = Math.max(next.bestDeploymentScore, score);
      } else if (runClass === 'custom') {
        next.customRuns += 1;
      } else {
        next.campaignRuns += 1;
        next.bestScore = Math.max(next.bestScore, score);
        if (event.coop) {
          next.bestCoopScore = Math.max(next.bestCoopScore, score);
        } else {
          next.bestSoloScore = Math.max(next.bestSoloScore, score);
        }
      }

      next.bestStage = Math.max(next.bestStage, int(event.stage, 1, 1));
      break;
    }

    case 'score': {
      const score = int(event.score, 0);
      if (event.runClass === 'deployment') {
        next.bestDeploymentScore = Math.max(next.bestDeploymentScore, score);
      } else if (event.runClass !== 'custom') {
        next.bestScore = Math.max(next.bestScore, score);
      }
      break;
    }

    case 'stage-reached':
      next.bestStage = Math.max(next.bestStage, int(event.stage, 1, 1));
      break;

    default:
      break;
  }

  const normalized = createProfile(next);
  const afterAchievements = new Set(normalized.achievementIds);
  const afterSkins = new Set(unlockedSkinIds(normalized));

  return {
    profile: normalized,
    unlockedAchievements: [...afterAchievements].filter(id => !beforeAchievements.has(id)),
    unlockedSkins: [...afterSkins].filter(id => !beforeSkins.has(id)),
  };
}

export function achievementById(id) {
  return ACHIEVEMENTS.find(item => item.id === id) || null;
}
