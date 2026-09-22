import { LEVELS } from './levels.js';
import { MAX_WEAPON_TIER, upgradeWeaponTier, weaponProfile, damageBreakableSteel } from './weaponSystem.js';
import { BRICK_GRID, BRICK_FULL_MASK, brickContainsPoint, damageBrick, brickBlocksRect, brickHasCell, countBrickCells } from './brickSystem.js';
import { validateCustomLevel } from './levelSchema.js';
import { freshActions, mergeActions, readGamepadActions, pickDirection } from './controllerSystem.js';
import { NAV_STEP, isNavAlignedStart, navStartCandidates } from './navigationSystem.js';
import { waveEnemyCount, buildEnemyRoster, carrierIndexForWave, shouldDropArsenal } from './balanceSystem.js';
import { BOSS_TYPE, isBossWave, bossStats, bossPhase, bossDamageResult } from './bossSystem.js';
import { createAudioSystem } from './audioSystem.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const UI = {
  score: document.querySelector('#score'),
  stage: document.querySelector('#stage'),
  wave: document.querySelector('#wave'),
  lives: document.querySelector('#lives'),
  baseHp: document.querySelector('#baseHp'),
  remaining: document.querySelector('#remaining'),
  weaponTier: document.querySelector('#weaponTier'),
  bestRun: document.querySelector('#bestRun'),
  intro: document.querySelector('#introOverlay'),
  gameOver: document.querySelector('#gameOverOverlay'),
  gameOverTitle: document.querySelector('#gameOverTitle'),
  gameOverText: document.querySelector('#gameOverText'),
  upgrade: document.querySelector('#upgradeOverlay'),
  upgradeTitle: document.querySelector('#upgradeTitle'),
  upgradeChoices: document.querySelector('#upgradeChoices'),
  pause: document.querySelector('#pauseOverlay'),
  pauseBtn: document.querySelector('#pauseBtn'),
  resumeBtn: document.querySelector('#resumeBtn'),
  coopBtn: document.querySelector('#coopBtn'),
  controllerStatus: document.querySelector('#controllerStatus'),
};

const TILE = 48;
const COLS = 16;
const ROWS = 16;
const WORLD = TILE * COLS;
const WAVES_PER_STAGE = 3;
const MAX_BASE_HP = 5;
const TANK_SIZE = 34;
const MAX_MOVE_STEP = 5;
const TURN_ASSIST_MAX = 12;
const MAX_ACTIVE_ENEMIES = 4;
const POWERUP_LIFETIME = 11;
const CUSTOM_LEVEL_KEY = 'zirhova-custom-level-v1';
const CUSTOM_MODE = new URLSearchParams(window.location.search).get('custom') === '1';

canvas.width = WORLD;
canvas.height = WORLD;

const COLORS = {
  floorA: '#101923',
  floorB: '#0c141c',
  grid: '#182532',
  brick: '#9a5f3c',
  brickLight: '#c18055',
  steel: '#5b6976',
  steelLight: '#9aabba',
  breakableSteel: '#66788a',
  breakableSteelWeak: '#d9b36b',
  water: '#17465f',
  waterLine: '#2c7797',
  ice: '#9dd8e8',
  iceLine: '#d9f6ff',
  brush: '#234f39',
  brushLight: '#397255',
  player: '#e8d35b',
  playerDark: '#8c7d2d',
  player2: '#68c9e8',
  player2Dark: '#2f6f86',
  bullet: '#fff4be',
  base: '#75c7a0',
  baseCore: '#e2fff1',
};

const ENEMY_TYPES = {
  raider: {
    name: 'AKINCI',
    speed: 92,
    hp: 1,
    color: '#dd6758',
    dark: '#743329',
    target: 'base',
    brickCost: 4,
    fireBase: 0.88,
    score: 100,
    mark: 'none',
  },
  scout: {
    name: 'İZCİ',
    speed: 132,
    hp: 1,
    color: '#58c6d8',
    dark: '#245c68',
    target: 'player',
    brickCost: 7,
    fireBase: 0.95,
    score: 130,
    mark: 'chevron',
  },
  hunter: {
    name: 'AVCI',
    speed: 105,
    hp: 2,
    color: '#e49b45',
    dark: '#70471f',
    target: 'player',
    brickCost: 5,
    fireBase: 0.68,
    score: 180,
    mark: 'cross',
  },
  breacher: {
    name: 'DELİCİ',
    speed: 84,
    hp: 2,
    color: '#d97598',
    dark: '#6d324c',
    target: 'base',
    brickCost: 1.45,
    fireBase: 0.62,
    score: 220,
    mark: 'bar',
    strongShot: true,
  },
  heavy: {
    name: 'AĞIR',
    speed: 72,
    hp: 4,
    color: '#a886e8',
    dark: '#4f3a78',
    target: 'base',
    brickCost: 2.2,
    fireBase: 0.78,
    score: 340,
    mark: 'box',
    strongShot: true,
  },
  bastion: {
    name: 'BURÇKIRAN',
    speed: 66,
    hp: 8,
    color: '#d6b85f',
    dark: '#6d5721',
    target: 'base',
    brickCost: 1.05,
    fireBase: 0.74,
    phase2Speed: 84,
    phase2FireBase: 0.49,
    score: 1100,
    mark: 'boss',
    strongShot: true,
    boss: true,
    frontalArmor: true,
  },
};

const DIRS = {
  up: { x: 0, y: -1, a: -Math.PI / 2, axis: 'v' },
  down: { x: 0, y: 1, a: Math.PI / 2, axis: 'v' },
  left: { x: -1, y: 0, a: Math.PI, axis: 'h' },
  right: { x: 1, y: 0, a: 0, axis: 'h' },
};

const DIR_NAMES = Object.keys(DIRS);
const MOVE_ACTIONS = ['up', 'down', 'left', 'right'];
const touchInput = freshActions();
const keyInput1 = freshActions();
const keyInput2 = freshActions();
let padInput1 = freshActions();
let padInput2 = freshActions();

const p1KeyMap = new Map([
  ['KeyW', 'up'],
  ['KeyS', 'down'],
  ['KeyA', 'left'],
  ['KeyD', 'right'],
  ['Space', 'fire'],
]);

let nextEnemyTrafficId = 1;

const p2KeyMap = new Map([
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['Enter', 'fire'],
]);

function defaultModifiers() {
  return {
    speed: 1,
    fireRate: 1,
    bulletSpeed: 1,
    armor: 0,
    shotPower: 1,
  };
}

const POWERUP_TYPES = {
  armor: { name: 'REAKTİF ZIRH', glyph: 'Z', color: '#64d8ff' },
  emp: { name: 'EMP DARBESİ', glyph: 'E', color: '#8cb8ff' },
  artillery: { name: 'TOPÇU DESTEĞİ', glyph: 'T', color: '#ff9b6a' },
  fortify: { name: 'İSTİHKÂM KİTİ', glyph: 'İ', color: '#75d5a7' },
  repair: { name: 'SAHA ONARIMI', glyph: '+', color: '#7ee0a5' },
  reserve: { name: 'YEDEK MÜRETTEBAT', glyph: '1', color: '#f0d96b' },
  arsenal: { name: 'NAMLU MODÜLÜ', glyph: 'N', color: '#ffd36b' },
};

const UPGRADES = [
  {
    id: 'tracks',
    title: 'HIZLI PALET',
    description: 'Hareket hızı +%10',
    max: 3,
    apply() { state.modifiers.speed *= 1.10; },
  },
  {
    id: 'loader',
    title: 'HIZLI DOLDURUCU',
    description: 'Atış aralığı %14 kısalır',
    max: 3,
    apply() { state.modifiers.fireRate *= 0.86; },
  },
  {
    id: 'velocity',
    title: 'YÜKSEK BASINÇ',
    description: 'Mermi hızı +%12',
    max: 3,
    apply() { state.modifiers.bulletSpeed *= 1.12; },
  },
  {
    id: 'armor',
    title: 'KOMPOZİT ZIRH',
    description: 'Her tank +1 darbe dayanır',
    max: 2,
    apply() { state.modifiers.armor += 1; },
  },
  {
    id: 'cannon',
    title: 'GÜÇLÜ NAMLU',
    description: 'Mermi hasarı +1',
    max: 2,
    apply() { state.modifiers.shotPower += 1; },
  },
  {
    id: 'repair',
    title: 'SAHA ONARIMI',
    description: 'Üs +2 can yeniler',
    repeatable: true,
    available() { return state.base && state.base.hp < MAX_BASE_HP; },
    apply() { state.base.hp = Math.min(MAX_BASE_HP, state.base.hp + 2); },
  },
  {
    id: 'reserve',
    title: 'YEDEK MÜRETTEBAT',
    description: '+1 yedek tank',
    repeatable: true,
    apply() { state.lives = Math.min(6, state.lives + 1); },
  },
];

const audio = createAudioSystem();

function tone(freq = 220, duration = 0.05, type = 'square', gain = 0.04) {
  audio.tone(freq, duration, type, gain);
}

function haptic(ms = 8) {
  try { navigator.vibrate?.(ms); } catch {}
}

class RectEntity {
  constructor(x, y, w, h) {
    Object.assign(this, { x, y, w, h, dead: false });
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
}

class Tank extends RectEntity {
  constructor(x, y, team, type = 'raider', playerSlot = 1) {
    super(x, y, TANK_SIZE, TANK_SIZE);
    this.team = team;
    this.playerSlot = team === 'player' ? playerSlot : 0;
    this.type = type;
    this.spec = team === 'player' ? null : ENEMY_TYPES[type];
    if (team === 'enemy' && type === BOSS_TYPE) {
      this.spec = { ...this.spec, ...bossStats(state.stage) };
    }
    this.dir = team === 'player' ? 'up' : 'down';
    this.speed = team === 'player' ? 162 * state.modifiers.speed : this.spec.speed;
    this.maxHp = team === 'player' ? 1 + state.modifiers.armor : this.spec.hp;
    this.hp = this.maxHp;
    this.fireCooldown = 0;
    this.decisionClock = 0;
    this.stuckClock = 0;
    this.rerouteClock = 0;
    this.directionHoldClock = 0;
    this.trafficWaitClock = 0;
    this.trafficYieldClock = 0;
    this.trafficYieldDir = null;
    this.trafficBlockedClock = 0;
    this.trafficYieldCount = 0;
    this.turnCount = 0;
    this.aiId = team === 'player' ? 0 : nextEnemyTrafficId++;
    this.spawnShield = team === 'player' ? 1.25 : 0.52;
    this.carrier = false;
    this.momentumDir = this.dir;
    this.muzzleFlash = 0;
    this.hitFlash = 0;
    this.armorFlash = 0;
    this.bossPhase = 1;
    this.recoil = 0;
  }

  update(dt) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.spawnShield = Math.max(0, this.spawnShield - dt);
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.armorFlash = Math.max(0, this.armorFlash - dt);
    this.recoil = Math.max(0, this.recoil - dt * 34);

    if (this.team === 'enemy' && this.spec?.boss) {
      const nextPhase = bossPhase(this.hp, this.maxHp);
      if (nextPhase !== this.bossPhase) {
        this.bossPhase = nextPhase;
        this.speed = nextPhase === 2 ? this.spec.phase2Speed : this.spec.speed;
        showNotice('BURÇKIRAN · SALDIRI FAZI', 1.0);
        addShake(4);
        audio.bossAlert(2);
      }
    }

    if (this.team !== 'player' && state.enemyFreeze > 0) return;

    if (this.team === 'player') this.updatePlayer(dt);
    else this.updateAI(dt);
  }

  updatePlayer(dt) {
    const actions = getPlayerActions(this.playerSlot);
    const dir = pickDirection(actions);
    const onIce = tileAt(this.cx, this.cy)?.type === 'ice';

    if (dir) {
      if (this.alignForTurn(dir)) {
        this.dir = dir;
        this.momentumDir = dir;
        const d = DIRS[dir];
        const moved = this.move(d.x * this.speed * dt, d.y * this.speed * dt);
        if (moved && !onIce) {
          audio.track(this.playerSlot, this.speed / 162);
        }
      }
    } else if (onIce && this.momentumDir) {
      const d = DIRS[this.momentumDir];
      this.move(d.x * this.speed * 0.72 * dt, d.y * this.speed * 0.72 * dt);
    }

    if (actions.fire) this.shoot();
  }

  updateAI(dt) {
    const target = this.spec.target === 'player'
      ? (nearestLivePlayer(this) || state.base)
      : state.base;

    this.rerouteClock = Math.max(0, this.rerouteClock - dt);
    this.directionHoldClock = Math.max(0, this.directionHoldClock - dt);
    this.trafficWaitClock = Math.max(0, this.trafficWaitClock - dt);

    if (this.trafficYieldClock > 0 && this.trafficYieldDir) {
      this.trafficYieldClock = Math.max(0, this.trafficYieldClock - dt);
      const yieldDir = this.trafficYieldDir;

      if (this.applyAIDirection(yieldDir, 0.08)) {
        const d = DIRS[yieldDir];
        const moved = this.move(d.x * this.speed * dt, d.y * this.speed * dt);
        if (moved) {
          this.stuckClock = 0;
          this.trafficBlockedClock = 0;
        }
      }

      if (this.trafficYieldClock <= 0) this.trafficYieldDir = null;
      return;
    }

    if (this.trafficWaitClock > 0) return;

    const shotDir = lineOfSightDirection(this, target);
    if (
      shotDir &&
      this.fireCooldown <= 0 &&
      this.applyAIDirection(shotDir, 0.12)
    ) {
      this.shoot();
    }

    const onIce = tileAt(this.cx, this.cy)?.type === 'ice';
    this.decisionClock -= dt * (onIce ? 0.28 : 1);

    if (this.decisionClock <= 0 && this.directionHoldClock <= 0) {
      this.decisionClock = 0.24 + Math.random() * 0.36;
      const nextDir = this.chooseDirection(target);
      this.applyAIDirection(nextDir, 0.16);
    }

    const ahead = blockingTerrainAhead(this, this.dir, 25);
    if (ahead?.type === 'brick' && this.fireCooldown <= 0) {
      this.shoot();
      return;
    }

    const d = DIRS[this.dir];
    const moved = this.move(d.x * this.speed * dt, d.y * this.speed * dt);

    if (moved) {
      this.stuckClock = 0;
      this.rerouteClock = 0;
      this.trafficBlockedClock = 0;
    } else {
      this.stuckClock += dt;
      this.trafficBlockedClock += dt;

      const tankBlocker = blockingTankAhead(this, this.dir, 10);
      if (tankBlocker) {
        if (tankBlocker.team === 'player') {
          if (this.fireCooldown <= 0) this.shoot();
          this.trafficWaitClock = 0.08;
          return;
        }

        if (tankBlocker.team === 'enemy') {
          if (this.handleEnemyTraffic(tankBlocker, target, dt)) return;
        }
      }

      if (this.rerouteClock <= 0 && this.stuckClock > 0.14) {
        const allowReverse = this.stuckClock > 0.55;
        const nextDir = this.chooseDirection(
          target,
          this.dir,
          { allowReverse }
        );

        if (nextDir && nextDir !== this.dir) {
          this.applyAIDirection(nextDir, 0.2);
        }

        this.rerouteClock = allowReverse ? 0.12 : 0.17;
      }
    }

    if (!shotDir && this.fireCooldown <= 0 && Math.random() < 0.0045) {
      this.shoot();
    }
  }

  applyAIDirection(nextDir, hold = 0.16) {
    if (!nextDir) return false;
    if (!this.alignForTurn(nextDir)) return false;

    if (this.dir !== nextDir) {
      this.dir = nextDir;
      this.turnCount++;
    }

    this.directionHoldClock = Math.max(this.directionHoldClock, hold);
    return true;
  }

  requestTrafficYield(dir, depth = 0, visited = new Set()) {
    if (!dir || depth > 4 || visited.has(this.aiId)) return false;
    visited.add(this.aiId);

    const blocker = blockingTankAhead(this, dir, 10);
    if (blocker?.team === 'enemy') {
      if (!blocker.requestTrafficYield(dir, depth + 1, visited)) return false;
    } else if (blocker) {
      return false;
    } else if (!this.canMove(dir, 9)) {
      return false;
    }

    this.trafficYieldDir = dir;
    this.trafficYieldClock = Math.max(this.trafficYieldClock, 0.66);
    this.trafficYieldCount++;
    this.trafficWaitClock = 0;
    return true;
  }

  handleEnemyTraffic(blocker, target, dt) {
    const sameDirection = blocker.dir === this.dir;
    const oppositeDirection = blocker.dir === oppositeDir(this.dir);

    if (sameDirection) {
      // Stable convoy: follow instead of jittering around the tank ahead.
      if (
        this.trafficBlockedClock > 0.75 &&
        this.rerouteClock <= 0
      ) {
        const alternate = this.chooseDirection(
          target,
          this.dir,
          { allowReverse: false }
        );

        if (alternate && alternate !== this.dir && this.canMove(alternate, 9)) {
          this.applyAIDirection(alternate, 0.24);
          this.rerouteClock = 0.3;
          this.trafficBlockedClock = 0;
          return false;
        }
      }

      this.trafficWaitClock = 0.1;
      return true;
    }

    // Deterministic right-of-way: earlier spawned enemy keeps the lane.
    const shouldYield = this.aiId > blocker.aiId;

    if (shouldYield) {
      const reverse = oppositeDir(this.dir);
      const perpendicular = DIRS[this.dir].axis === 'v'
        ? ['left', 'right']
        : ['up', 'down'];

      for (const escapeDir of [reverse, ...perpendicular]) {
        if (this.requestTrafficYield(escapeDir)) return true;
      }

      this.trafficWaitClock = 0.1;
      return true;
    }

    // Non-yielding tank holds its heading briefly while the other clears.
    this.trafficWaitClock = oppositeDirection ? 0.08 : 0.1;
    return true;
  }

  chooseDirection(target, avoidDir = null, { allowReverse = true } = {}) {
    const reverse = oppositeDir(this.dir);
    const pathDir = findPathDirection(this, target, this.spec.brickCost);

    if (
      pathDir &&
      pathDir !== avoidDir &&
      (allowReverse || pathDir !== reverse)
    ) {
      const ahead = blockingTerrainAhead(this, pathDir, 24);
      if (ahead?.type === 'brick' || this.canMove(pathDir, 9)) return pathDir;
    }

    const dx = target.cx - this.cx;
    const dy = target.cy - this.cy;
    const horizontal = dx >= 0 ? 'right' : 'left';
    const vertical = dy >= 0 ? 'down' : 'up';
    const preferred = Math.abs(dx) > Math.abs(dy)
      ? [horizontal, vertical]
      : [vertical, horizontal];

    const candidates = [...preferred, ...shuffle(DIR_NAMES)]
      .filter((name, index, arr) =>
        arr.indexOf(name) === index &&
        name !== avoidDir &&
        (allowReverse || name !== reverse)
      );

    for (const name of candidates) {
      const ahead = blockingTerrainAhead(this, name, 24);
      if (ahead?.type === 'brick' || this.canMove(name, 9)) return name;
    }

    if (allowReverse && this.canMove(reverse, 9)) return reverse;
    return this.dir;
  }

  findTurnAlignment(nextDir) {
    if (DIRS[nextDir].axis === DIRS[this.dir].axis) {
      return { x: this.x, y: this.y, distance: 0 };
    }

    const verticalTurn = DIRS[nextDir].axis === 'v';
    const center = verticalTurn ? this.cx : this.cy;
    const size = verticalTurn ? this.w : this.h;
    const candidates = navStartCandidates(center, size, WORLD, 2, 2);

    for (const candidate of candidates) {
      if (candidate.distance > TURN_ASSIST_MAX) continue;

      const x = verticalTurn ? candidate.start : this.x;
      const y = verticalTurn ? this.y : candidate.start;
      if (canShiftEntity(this, x, y)) {
        return { x, y, distance: candidate.distance };
      }
    }

    return null;
  }

  canMove(dir, distance = 8) {
    const d = DIRS[dir];
    const alignment = this.findTurnAlignment(dir);
    if (!alignment) return false;

    return canOccupy(
      this,
      alignment.x + d.x * distance,
      alignment.y + d.y * distance
    );
  }

  alignForTurn(nextDir) {
    const alignment = this.findTurnAlignment(nextDir);
    if (!alignment) return false;

    this.x = alignment.x;
    this.y = alignment.y;
    return true;
  }

  move(dx, dy) {
    if (!dx && !dy) return true;

    const startX = this.x;
    const startY = this.y;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    const steps = Math.max(1, Math.ceil(distance / MAX_MOVE_STEP));
    const stepX = dx / steps;
    const stepY = dy / steps;

    for (let i = 0; i < steps; i++) {
      const nextX = clamp(this.x + stepX, 2, WORLD - this.w - 2);
      const nextY = clamp(this.y + stepY, 2, WORLD - this.h - 2);
      if (stepX !== 0 && canOccupy(this, nextX, this.y)) this.x = nextX;
      if (stepY !== 0 && canOccupy(this, this.x, nextY)) this.y = nextY;
    }

    return Math.abs(this.x - startX) + Math.abs(this.y - startY) > 0.01;
  }

  shoot() {
    if (this.fireCooldown > 0 || this.dead || state.awaitingUpgrade || state.paused) return;

    const d = DIRS[this.dir];
    const playerShot = this.team === 'player';
    const profile = playerShot ? weaponProfile(state.weaponTier) : null;
    const damage = playerShot ? state.modifiers.shotPower : 1;
    const bulletSpeed = playerShot
      ? 410 * state.modifiers.bulletSpeed * profile.bulletSpeedMultiplier
      : (this.spec?.strongShot ? 430 : 395);

    state.bullets.push(
      new Bullet(
        this.cx + d.x * 24 - 4,
        this.cy + d.y * 24 - 4,
        d.x,
        d.y,
        this.team,
        {
          damage,
          speed: bulletSpeed,
          strong: playerShot ? (damage > 1 || state.weaponTier >= 2) : Boolean(this.spec?.strongShot),
          canBreakSteel: playerShot && profile.canBreakSteel,
        }
      )
    );

    const enemyFireBase =
      this.spec?.boss && this.bossPhase === 2
        ? this.spec.phase2FireBase
        : this.spec?.fireBase;

    this.fireCooldown = playerShot
      ? 0.265 * state.modifiers.fireRate * profile.reloadMultiplier
      : enemyFireBase + Math.random() * 0.22;

    this.muzzleFlash = 0.055;
    this.recoil = playerShot ? 4.5 : 3.2;
    addShake(playerShot ? 1.1 : 0.45);
    audio.cannon({
      player: playerShot,
      strong: playerShot ? (damage > 1 || state.weaponTier >= 2) : Boolean(this.spec?.strongShot),
      tier: playerShot ? state.weaponTier : 1,
      boss: Boolean(this.spec?.boss),
    });
    if (playerShot) haptic(5);
  }

  hit(damage = 1, source = null) {
    if (this.spawnShield > 0 || this.dead) return { blocked: true, damage: 0 };

    if (this.team === 'enemy' && this.spec?.boss && source?.team === 'player') {
      const result = bossDamageResult({
        facing: this.dir,
        bulletDx: source.dx,
        bulletDy: source.dy,
        damage,
      });

      if (result.blocked) {
        this.armorFlash = 0.12;
        addShake(1.6);
        audio.impact('bossArmor');
        return result;
      }

      damage = result.damage;
    }

    this.hp -= damage;
    this.hitFlash = 0.095;
    this.spawnShield = this.team === 'player' ? 0.22 : 0.08;

    if (this.team === 'player') {
      addShake(5);
      haptic(20);
      tone(125, 0.09, 'sawtooth', 0.04);
    } else {
      addShake(this.spec?.boss ? 3.4 : (this.maxHp >= 4 ? 2.6 : 1.5));
      tone(this.spec?.boss ? 145 : 170, 0.07, 'sawtooth', 0.028);
    }

    if (this.hp <= 0) this.dead = true;
    return { blocked: false, damage };
  }

  draw() {
    const color = this.team === 'player'
      ? (this.playerSlot === 2 ? COLORS.player2 : COLORS.player)
      : this.spec.color;
    const dark = this.team === 'player'
      ? (this.playerSlot === 2 ? COLORS.player2Dark : COLORS.playerDark)
      : this.spec.dark;

    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(DIRS[this.dir].a);
    ctx.translate(-this.recoil, 0);

    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(-15, 13, 32, 6);

    ctx.fillStyle = dark;
    ctx.fillRect(-17, -17, 34, 7);
    ctx.fillRect(-17, 10, 34, 7);

    ctx.fillStyle = color;
    ctx.fillRect(-13, -12, 26, 24);

    ctx.fillStyle = '#111820';
    ctx.fillRect(-7, -7, 14, 14);

    ctx.fillStyle = color;
    ctx.fillRect(0, -3, 26, 6);
    ctx.fillRect(17, -5, 10, 10);

    if (this.team === 'player' && state.weaponTier > 1) {
      ctx.fillStyle = state.weaponTier >= 3 ? '#fff0a1' : '#fff7cc';
      ctx.fillRect(8, -6, 4, 12);
      if (state.weaponTier >= 3) ctx.fillRect(14, -6, 4, 12);
    }

    if (this.team === 'enemy') this.drawEnemyMark();

    if (this.hitFlash > 0) {
      ctx.globalAlpha = Math.min(0.8, this.hitFlash * 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-13, -12, 26, 24);
      ctx.globalAlpha = 1;
    }

    if (this.team === 'enemy' && this.spec?.boss) {
      ctx.strokeStyle = this.armorFlash > 0 ? '#fff4b0' : '#d6b85f';
      ctx.lineWidth = this.armorFlash > 0 ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(12, -14);
      ctx.lineTo(19, -14);
      ctx.lineTo(19, 14);
      ctx.lineTo(12, 14);
      ctx.stroke();

      if (this.bossPhase === 2) {
        ctx.strokeStyle = '#ff9a6a';
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -14, 30, 28);
      }
    }

    if (this.muzzleFlash > 0) {
      ctx.fillStyle = '#fff2a6';
      ctx.beginPath();
      ctx.moveTo(30, 0);
      ctx.lineTo(38, -7);
      ctx.lineTo(35, 0);
      ctx.lineTo(38, 7);
      ctx.closePath();
      ctx.fill();
    }

    if (this.spawnShield > 0) {
      ctx.strokeStyle = `rgba(220,245,255,${0.26 + 0.42 * Math.sin(performance.now() / 70) ** 2})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.team === 'enemy' && this.carrier) {
      const pulse = 0.55 + 0.35 * Math.sin(performance.now() / 95) ** 2;
      ctx.strokeStyle = `rgba(255,230,105,${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 27, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffe669';
      ctx.fillRect(-3, -24, 6, 6);
    }

    ctx.restore();
    this.drawHealth();
  }

  drawEnemyMark() {
    ctx.strokeStyle = '#fff7';
    ctx.fillStyle = '#fff9';
    ctx.lineWidth = 2;

    if (this.spec.mark === 'chevron') {
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(2, 0);
      ctx.lineTo(-6, 6);
      ctx.stroke();
    } else if (this.spec.mark === 'cross') {
      ctx.fillRect(-2, -8, 4, 16);
      ctx.fillRect(-8, -2, 16, 4);
    } else if (this.spec.mark === 'bar') {
      ctx.fillRect(-7, -2, 14, 4);
    } else if (this.spec.mark === 'box') {
      ctx.strokeRect(-8, -8, 16, 16);
    } else if (this.spec.mark === 'boss') {
      ctx.strokeRect(-9, -9, 18, 18);
      ctx.fillRect(-3, -6, 6, 12);
      ctx.fillRect(-6, -3, 12, 6);
    }
  }

  drawHealth() {
    if (this.maxHp <= 1 || this.dead) return;
    const width = this.spec?.boss ? 44 : 28;
    const x = this.cx - width / 2;
    const y = this.y - 7;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(x, y, width, 4);
    ctx.fillStyle = this.team === 'player'
      ? (this.playerSlot === 2 ? COLORS.player2 : COLORS.player)
      : '#f1f4f6';
    ctx.fillRect(x, y, width * clamp(this.hp / this.maxHp, 0, 1), 4);
  }
}

class Bullet extends RectEntity {
  constructor(x, y, dx, dy, team, options = {}) {
    super(x, y, 8, 8);
    this.dx = dx;
    this.dy = dy;
    this.team = team;
    this.damage = options.damage ?? 1;
    this.speed = options.speed ?? 405;
    this.strong = Boolean(options.strong);
    this.canBreakSteel = Boolean(options.canBreakSteel);
  }

  update(dt) {
    const travel = this.speed * dt;
    const steps = Math.max(1, Math.ceil(travel / 6));
    const stepX = this.dx * travel / steps;
    const stepY = this.dy * travel / steps;

    for (let i = 0; i < steps && !this.dead; i++) {
      this.x += stepX;
      this.y += stepY;

      if (this.x < -10 || this.y < -10 || this.x > WORLD + 10 || this.y > WORLD + 10) {
        this.dead = true;
        break;
      }

      const tile = tileAt(this.cx, this.cy);
      const localX = ((this.cx % TILE) + TILE) % TILE;
      const localY = ((this.cy % TILE) + TILE) % TILE;
      const brickCollision =
        tile?.type === 'brick' &&
        brickContainsPoint(tile.mask, localX, localY, TILE);
      const terrainCollision =
        tile &&
        !['floor', 'water', 'brush', 'ice'].includes(tile.type) &&
        (tile.type !== 'brick' || brickCollision);

      if (terrainCollision) {
        if (tile.type === 'brick') {
          audio.impact('brick');
          const before = countBrickCells(tile.mask);
          tile.mask = damageBrick(
            tile.mask,
            localX,
            localY,
            this.dx,
            this.dy,
            this.strong ? Math.max(2, this.damage) : 1,
            TILE
          );
          const removed = before - countBrickCells(tile.mask);
          debris(this.cx, this.cy, COLORS.brickLight, Math.max(3, removed * 2));
          if (!tile.mask) {
            tile.type = 'floor';
            addShake(1.4);
          }
        } else if (tile.type === 'breakableSteel') {
          const result = damageBreakableSteel(
            tile.hp,
            this.team === 'player' && this.canBreakSteel
          );

          if (result.damaged) {
            tile.hp = result.hp;
            debris(this.cx, this.cy, COLORS.breakableSteelWeak, 6);
            addShake(result.destroyed ? 3.2 : 1.5);
            audio.impact('steel');
            if (result.destroyed) tile.type = 'floor';
          } else {
            debris(this.cx, this.cy, COLORS.steelLight, 3);
            audio.impact('steel');
          }
        } else {
          debris(this.cx, this.cy, COLORS.steelLight, 3);
          audio.impact('steel');
        }

        this.dead = true;
        break;
      }

      if (this.team === 'player') {
        for (const enemy of state.enemies) {
          if (!enemy.dead && hit(this, enemy)) {
            enemy.hit(this.damage, {
              team: this.team,
              dx: this.dx,
              dy: this.dy,
            });
            this.dead = true;
            break;
          }
        }
      } else {
        for (const player of activePlayers()) {
          if (hit(this, player)) {
            player.hit(1);
            this.dead = true;
            break;
          }
        }
        if (this.dead) break;

        if (state.base && hit(this, state.base)) {
          this.dead = true;
          damageBase();
          break;
        }
      }
    }
  }

  draw() {
    ctx.strokeStyle = this.strong ? '#ffffff' : '#d7d1a8';
    ctx.lineWidth = this.strong ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(this.cx - this.dx * 12, this.cy - this.dy * 12);
    ctx.lineTo(this.cx, this.cy);
    ctx.stroke();

    ctx.fillStyle = this.strong ? '#ffffff' : COLORS.bullet;
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}

class PowerUp extends RectEntity {
  constructor(x, y, type) {
    super(x - 15, y - 15, 30, 30);
    this.type = type;
    this.ttl = POWERUP_LIFETIME;
    this.phase = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const spec = POWERUP_TYPES[this.type];
    const pulse = 1 + Math.sin(performance.now() / 130 + this.phase) * 0.06;

    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.scale(pulse, pulse);

    ctx.fillStyle = 'rgba(7,12,18,.82)';
    ctx.strokeStyle = spec.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-15, -15, 30, 30, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = spec.color;
    ctx.font = '900 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.glyph, 0, 1);
    ctx.restore();
  }
}

class Base extends RectEntity {
  constructor(x, y, hp = MAX_BASE_HP) {
    super(x, y, 42, 42);
    this.hp = hp;
    this.hitFlash = 0;
  }

  update(dt) {
    this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  draw() {
    ctx.save();
    ctx.translate(this.cx, this.cy);

    ctx.fillStyle = COLORS.base;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(20, 0);
    ctx.lineTo(0, 20);
    ctx.lineTo(-20, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : COLORS.baseCore;
    ctx.fillRect(-8, -8, 16, 16);

    ctx.strokeStyle = '#1f4c3a';
    ctx.lineWidth = 4;
    ctx.strokeRect(-12, -12, 24, 24);

    if (state.baseShield > 0) {
      const pulse = 0.45 + 0.35 * Math.sin(performance.now() / 110) ** 2;
      ctx.strokeStyle = `rgba(117,213,167,${pulse})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 27, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

const progress = loadProgress();

function readCustomLevel() {
  if (!CUSTOM_MODE) return null;

  try {
    const raw = localStorage.getItem(CUSTOM_LEVEL_KEY);
    if (!raw) return null;
    const result = validateCustomLevel(JSON.parse(raw));
    return result.ok ? result.level : null;
  } catch {
    return null;
  }
}

const state = {
  running: false,
  gameOver: false,
  paused: false,
  awaitingUpgrade: false,
  score: 0,
  stage: 1,
  wave: 1,
  waveInStage: 1,
  lives: 3,
  grid: [],
  player: null,
  base: null,
  enemies: [],
  bullets: [],
  particles: [],
  waveTimer: 0,
  pendingSpawns: 0,
  notice: '',
  noticeTimer: 0,
  modifiers: defaultModifiers(),
  upgradeLevels: {},
  shake: 0,
  runToken: 0,
  weaponTier: 1,
  arsenalMisses: 0,
  powerups: [],
  enemyFreeze: 0,
  baseShield: 0,
  waveSpawnQueue: [],
  spawnClock: 0,
  spawnBlockedFor: 0,
  customLevel: null,
  coop: false,
  player2: null,
  player2Spawn: null,
  pendingRespawns: [],
  respawnClock: 0,
};

function currentLevel() {
  return state.customLevel || LEVELS[(state.stage - 1) % LEVELS.length];
}

function activePlayers() {
  return [state.player, state.player2].filter(player => player && !player.dead);
}

function nearestLivePlayer(source) {
  let best = null;
  let bestDistance = Infinity;

  for (const player of activePlayers()) {
    const distance = Math.abs(player.cx - source.cx) + Math.abs(player.cy - source.cy);
    if (distance < bestDistance) {
      best = player;
      bestDistance = distance;
    }
  }

  return best;
}

function pollGamepads() {
  const pads = Array.from(navigator.getGamepads?.() || []).filter(Boolean);
  padInput1 = readGamepadActions(pads[0]);
  padInput2 = readGamepadActions(pads[1]);

  if (UI.controllerStatus) {
    if (!pads.length) UI.controllerStatus.textContent = 'GAMEPAD: bağlı değil';
    else if (pads.length === 1) UI.controllerStatus.textContent = 'GAMEPAD: 1 bağlı';
    else UI.controllerStatus.textContent = `GAMEPAD: ${pads.length} bağlı`;
  }
}

function getPlayerActions(slot) {
  if (slot === 2) return mergeActions(keyInput2, padInput2);

  if (state.coop) {
    return mergeActions(touchInput, keyInput1, padInput1);
  }

  return mergeActions(touchInput, keyInput1, keyInput2, padInput1, padInput2);
}

function findSecondarySpawnCell(grid, primary, base) {
  const [px, py] = primary;
  const candidates = [
    [px + 1, py],
    [px - 1, py],
    [px + 2, py],
    [px - 2, py],
    [px, py - 1],
    [px + 1, py - 1],
    [px - 1, py - 1],
    [px + 2, py - 1],
    [px - 2, py - 1],
  ];

  for (const [x, y] of candidates) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
    if (x === base[0] && y === base[1]) continue;

    const pos = gridEntityPosition([x, y], TANK_SIZE);
    const candidate = new Tank(pos.x, pos.y, 'player', 'raider', 2);
    if (canOccupy(candidate, candidate.x, candidate.y)) return [x, y];
  }

  return null;
}

function makeTile(type = 'floor') {
  const hp = type === 'breakableSteel' ? 3 : 999;
  const mask = type === 'brick' ? BRICK_FULL_MASK : 0;
  return { type, hp, mask };
}

function buildMap(level) {
  const grid = Array.from(
    { length: ROWS },
    () => Array.from({ length: COLS }, () => makeTile('floor'))
  );

  for (const [x, y] of level.bricks) grid[y][x] = makeTile('brick');
  for (const [x, y] of level.steel) grid[y][x] = makeTile('steel');
  for (const [x, y] of level.breakableSteel || []) grid[y][x] = makeTile('breakableSteel');
  for (const [x, y] of level.water) grid[y][x] = makeTile('water');
  for (const [x, y] of level.ice || []) grid[y][x] = makeTile('ice');
  for (const [x, y] of level.brush || []) grid[y][x] = makeTile('brush');

  for (const [x, y] of level.enemySpawns) {
    grid[y][x] = makeTile('floor');
    if (y + 1 < ROWS) grid[y + 1][x] = makeTile('floor');
  }

  const [px, py] = level.playerSpawn;
  const [bx, by] = level.baseSpawn;
  grid[py][px] = makeTile('floor');
  grid[by][bx] = makeTile('floor');
  return grid;
}

function gridEntityPosition([tx, ty], size) {
  return {
    x: tx * TILE + (TILE - size) / 2,
    y: ty * TILE + (TILE - size) / 2,
  };
}

function resetGame(coopMode = state.coop) {
  audio.unlock();
  state.runToken++;
  nextEnemyTrafficId = 1;
  clearAllInput();
  const customLevel = readCustomLevel();
  const coop = Boolean(coopMode);

  Object.assign(state, {
    running: true,
    gameOver: false,
    paused: false,
    awaitingUpgrade: false,
    score: 0,
    stage: 1,
    wave: 1,
    waveInStage: 1,
    lives: coop ? 5 : 3,
    enemies: [],
    bullets: [],
    particles: [],
    waveTimer: 0,
    pendingSpawns: 0,
    notice: '',
    noticeTimer: 0,
    modifiers: defaultModifiers(),
    upgradeLevels: {},
    shake: 0,
    weaponTier: 1,
    arsenalMisses: 0,
    powerups: [],
    enemyFreeze: 0,
    baseShield: 0,
    waveSpawnQueue: [],
    spawnClock: 0,
    spawnBlockedFor: 0,
    customLevel,
    coop,
    player2: null,
    player2Spawn: null,
    pendingRespawns: [],
    respawnClock: 0,
  });

  document.body.dataset.playMode = coop ? 'coop' : 'solo';
  loadStage({ preserveBaseHp: false, announce: true });
  UI.gameOver.classList.remove('show');
  UI.upgrade.classList.remove('show');
  UI.pause.classList.remove('show');
  UI.intro.classList.remove('show');
}

function loadStage({ preserveBaseHp = true, announce = true } = {}) {
  const level = currentLevel();
  const previousHp = preserveBaseHp && state.base
    ? Math.min(MAX_BASE_HP, state.base.hp + 1)
    : MAX_BASE_HP;

  state.grid = buildMap(level);
  state.enemies = [];
  state.bullets = [];
  state.powerups = [];
  state.pendingSpawns = 0;
  state.waveSpawnQueue = [];
  state.spawnClock = 0;
  state.spawnBlockedFor = 0;
  state.enemyFreeze = 0;
  state.waveTimer = 0;
  state.pendingRespawns = [];
  state.respawnClock = 0;

  const bp = gridEntityPosition(level.baseSpawn, 42);
  const pp = gridEntityPosition(level.playerSpawn, TANK_SIZE);
  state.base = new Base(bp.x, bp.y, previousHp);
  state.player = new Tank(pp.x, pp.y, 'player', 'raider', 1);

  state.player2 = null;
  state.player2Spawn = null;
  if (state.coop) {
    const spawn2 = findSecondarySpawnCell(state.grid, level.playerSpawn, level.baseSpawn);
    if (spawn2) {
      const p2 = gridEntityPosition(spawn2, TANK_SIZE);
      state.player2Spawn = spawn2;
      state.player2 = new Tank(p2.x, p2.y, 'player', 'raider', 2);
    } else {
      state.player2Spawn = level.playerSpawn;
      state.pendingRespawns.push(2);
      state.respawnClock = 0.12;
    }
  }

  if (announce) {
    showNotice(
      state.customLevel
        ? `ÖZEL · ${level.name}`
        : `BÖLÜM ${state.stage} · ${level.name}`,
      1.4
    );
  }
  spawnWave();
  syncUI();
}

function spawnWave() {
  const level = currentLevel();
  const count = waveEnemyCount(state.stage, state.waveInStage);
  const roster = buildEnemyRoster({
    stage: state.stage,
    wave: state.wave,
    waveInStage: state.waveInStage,
    count,
  });
  const carrierIndex = carrierIndexForWave(count, state.waveInStage);

  state.waveSpawnQueue = roster.map((type, i) => ({
    spawn: level.enemySpawns[i % level.enemySpawns.length],
    type,
    carrier: i === carrierIndex,
  }));

  if (isBossWave(state.stage, state.waveInStage)) {
    const bossSpawn = level.enemySpawns[Math.floor(level.enemySpawns.length / 2)];
    state.waveSpawnQueue.push({
      spawn: bossSpawn,
      type: BOSS_TYPE,
      carrier: false,
    });
    showNotice('ÖZEL HEDEF · BURÇKIRAN', 1.25);
    audio.bossAlert(1);
  }
  state.pendingSpawns = state.waveSpawnQueue.length;
  state.spawnClock = 0;
  state.spawnBlockedFor = 0;
  syncUI();
}

function updateSpawnQueue(dt) {
  if (!state.waveSpawnQueue.length || !state.running || state.gameOver) return;

  state.spawnClock -= dt;
  if (state.spawnClock > 0) return;

  const activeCount = state.enemies.filter(enemy => !enemy.dead).length;
  if (activeCount >= MAX_ACTIVE_ENEMIES) {
    state.spawnClock = 0.14;
    return;
  }

  const next = state.waveSpawnQueue.shift();
  const pos = gridEntityPosition(next.spawn, TANK_SIZE);
  const enemy = new Tank(pos.x, pos.y, 'enemy', next.type);
  enemy.carrier = next.carrier;

  const placement = findSpawnPlacement(enemy, next.spawn, state.spawnBlockedFor);
  if (!placement) {
    state.waveSpawnQueue.unshift(next);
    state.pendingSpawns = state.waveSpawnQueue.length;
    state.spawnBlockedFor += 0.16;
    state.spawnClock = 0.16;
    return;
  }

  enemy.x = placement.x;
  enemy.y = placement.y;
  state.enemies.push(enemy);

  state.pendingSpawns = state.waveSpawnQueue.length;
  state.spawnBlockedFor = 0;
  state.spawnClock = 0.42;
  syncUI();
}

function findSpawnPlacement(enemy, preferredSpawn, blockedFor = 0) {
  const level = currentLevel();
  const anchors = [
    preferredSpawn,
    ...level.enemySpawns.filter(
      spawn => spawn[0] !== preferredSpawn[0] || spawn[1] !== preferredSpawn[1]
    ),
  ];

  for (const anchor of anchors) {
    const origin = gridEntityPosition(anchor, TANK_SIZE);
    for (const offset of [0, 8, 16, 24, 32, 40, 48]) {
      const y = origin.y + offset;
      if (canOccupy(enemy, origin.x, y)) return { x: origin.x, y };
    }
  }

  if (blockedFor < 1.2) return null;

  const livePlayers = activePlayers();
  const preferredPos = gridEntityPosition(preferredSpawn, TANK_SIZE);
  const candidates = [];

  const maxRow = blockedFor >= 4 ? ROWS - 1 : Math.floor(ROWS / 2);
  for (let ty = 0; ty <= maxRow; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const pos = gridEntityPosition([tx, ty], TANK_SIZE);
      if (!canOccupy(enemy, pos.x, pos.y)) continue;

      const cx = pos.x + TANK_SIZE / 2;
      const cy = pos.y + TANK_SIZE / 2;
      const playerDistance = livePlayers.length
        ? Math.min(...livePlayers.map(player => Math.abs(player.cx - cx) + Math.abs(player.cy - cy)))
        : WORLD;
      const baseDistance = state.base
        ? Math.abs(state.base.cx - cx) + Math.abs(state.base.cy - cy)
        : WORLD;
      const anchorDistance =
        Math.abs(preferredPos.x - pos.x) + Math.abs(preferredPos.y - pos.y);

      // Prefer safety first, then upper-map / original-spawn proximity.
      const score =
        playerDistance * 2 +
        Math.min(baseDistance, 240) -
        ty * 10 -
        anchorDistance * 0.08;

      candidates.push({ x: pos.x, y: pos.y, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function advanceWaveIfNeeded(dt) {
  if (state.pendingSpawns > 0 || state.enemies.some(enemy => !enemy.dead)) {
    state.waveTimer = 0;
    return;
  }

  state.waveTimer += dt;
  const transitionDelay = state.powerups.length ? 2.8 : 1.0;
  if (state.waveTimer <= transitionDelay) return;
  state.waveTimer = 0;

  if (state.waveInStage >= WAVES_PER_STAGE) {
    showUpgradeSelection();
    return;
  }

  state.wave++;
  state.waveInStage++;
  showNotice(`DALGA ${state.waveInStage}/${WAVES_PER_STAGE}`, 0.85);
  tone(640, 0.07, 'square', 0.026);
  spawnWave();
  syncUI();
}

function showUpgradeSelection() {
  state.awaitingUpgrade = true;
  clearAllInput();

  const completedStage = state.stage;
  UI.upgradeTitle.textContent = `BÖLÜM ${completedStage} TAMAMLANDI`;
  UI.upgradeChoices.replaceChildren();

  const choices = pickUpgradeChoices(3);
  for (const upgrade of choices) {
    const level = state.upgradeLevels[upgrade.id] || 0;
    const button = document.createElement('button');
    button.className = 'upgrade-card';
    button.type = 'button';

    const title = document.createElement('strong');
    title.textContent = upgrade.title;
    const desc = document.createElement('span');
    desc.textContent = upgrade.description;
    const rank = document.createElement('small');
    rank.textContent = upgrade.repeatable ? 'ANLIK' : `SEVİYE ${level + 1}`;

    button.append(title, desc, rank);
    button.addEventListener('click', () => chooseUpgrade(upgrade));
    UI.upgradeChoices.appendChild(button);
  }

  UI.upgrade.classList.add('show');
  addShake(2);
  tone(720, 0.08, 'square', 0.03);
  setTimeout(() => tone(900, 0.08, 'square', 0.025), 80);
}

function pickUpgradeChoices(count) {
  const available = UPGRADES.filter(upgrade => {
    if (upgrade.available && !upgrade.available()) return false;
    if (upgrade.repeatable) return true;
    return (state.upgradeLevels[upgrade.id] || 0) < upgrade.max;
  });

  const permanent = shuffle(available.filter(upgrade => !upgrade.repeatable));
  const choices = permanent.slice(0, Math.min(2, count));
  const remaining = available.filter(upgrade => !choices.includes(upgrade));

  choices.push(
    ...shuffle(remaining).slice(0, Math.max(0, count - choices.length))
  );

  return choices.slice(0, Math.min(count, available.length));
}

function chooseUpgrade(upgrade) {
  upgrade.apply();
  if (!upgrade.repeatable) {
    state.upgradeLevels[upgrade.id] = (state.upgradeLevels[upgrade.id] || 0) + 1;
  }

  UI.upgrade.classList.remove('show');
  state.awaitingUpgrade = false;
  state.stage++;
  state.wave++;
  state.waveInStage = 1;
  loadStage({ preserveBaseHp: true, announce: true });
}

function spawnPowerup(x, y) {
  const utilityTypes = Object.keys(POWERUP_TYPES).filter(type => type !== 'arsenal');
  const arsenalRoll = shouldDropArsenal({
    weaponTier: state.weaponTier,
    maxWeaponTier: MAX_WEAPON_TIER,
    misses: state.arsenalMisses,
  });
  state.arsenalMisses = arsenalRoll.nextMisses;

  const type = arsenalRoll.arsenal
    ? 'arsenal'
    : utilityTypes[Math.floor(Math.random() * utilityTypes.length)];

  state.powerups.push(new PowerUp(x, y, type));
  showNotice(`${POWERUP_TYPES[type].name} SAHADA`, 0.8);
  tone(760, 0.06, 'square', 0.022);
}

function applyPowerup(type) {
  const spec = POWERUP_TYPES[type];
  let notice = spec.name;

  if (type === 'arsenal') {
    if (state.weaponTier < MAX_WEAPON_TIER) {
      state.weaponTier = upgradeWeaponTier(state.weaponTier);
      notice = `NAMLU ${weaponProfile(state.weaponTier).label}`;
    } else {
      state.score += 250;
      showNotice('NAMLU MAKS · +250', 1.05);
      audio.pickup('arsenal');
      syncUI();
      return;
    }
  } else if (type === 'armor') {
    for (const player of activePlayers()) {
      player.spawnShield = Math.max(player.spawnShield, 8);
    }
  } else if (type === 'emp') {
    state.enemyFreeze = Math.max(state.enemyFreeze, 5);
  } else if (type === 'artillery') {
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      enemy.spawnShield = 0;
      enemy.hit(2);
    }
    addShake(8);
  } else if (type === 'fortify') {
    state.baseShield = Math.max(state.baseShield, 12);
  } else if (type === 'repair') {
    if (state.base) state.base.hp = Math.min(MAX_BASE_HP, state.base.hp + 2);
  } else if (type === 'reserve') {
    state.lives = Math.min(6, state.lives + 1);
  }

  showNotice(notice, 1.05);
  audio.pickup(type);
  haptic(14);
  syncUI();
}

function updatePowerups(dt) {
  if (!state.powerups.length) return;

  for (const powerup of state.powerups) {
    powerup.update(dt);
    if (powerup.dead) continue;

    for (const player of activePlayers()) {
      if (!hit(powerup, player)) continue;
      powerup.dead = true;
      applyPowerup(powerup.type);
      break;
    }
  }

  state.powerups = state.powerups.filter(powerup => !powerup.dead);
}

function resolveBulletCollisions() {
  for (let i = 0; i < state.bullets.length; i++) {
    const a = state.bullets[i];
    if (a.dead) continue;

    for (let j = i + 1; j < state.bullets.length; j++) {
      const b = state.bullets[j];
      if (b.dead || a.team === b.team) continue;
      if (!hit(a, b)) continue;

      a.dead = true;
      b.dead = true;
      const x = (a.cx + b.cx) / 2;
      const y = (a.cy + b.cy) / 2;
      debris(x, y, '#fff2a6', 5);
      tone(260, 0.025, 'square', 0.015);
      break;
    }
  }
}

function damageBase() {
  if (state.baseShield > 0) {
    state.base.hitFlash = 0.12;
    debris(state.base.cx, state.base.cy, '#75d5a7', 5);
    audio.impact('steel');
    return;
  }

  state.base.hp--;
  state.base.hitFlash = 0.18;
  addShake(7);
  debris(state.base.cx, state.base.cy, COLORS.baseCore, 8);
  audio.explosion({ heavy: true });
  haptic(24);
  syncUI();

  if (state.base.hp <= 0) endGame('Üs çekirdeği yok edildi');
}

function respawnPlayer(slot) {
  const spawnCell = slot === 2
    ? (
      state.player2Spawn ||
      findSecondarySpawnCell(state.grid, currentLevel().playerSpawn, currentLevel().baseSpawn) ||
      currentLevel().playerSpawn
    )
    : currentLevel().playerSpawn;

  const offsets = [];
  for (let radius = 0; radius <= 2; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) !== radius) continue;
        offsets.push([dx, dy]);
      }
    }
  }

  for (const [dx, dy] of offsets) {
    const x = spawnCell[0] + dx;
    const y = spawnCell[1] + dy;
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;

    const pos = gridEntityPosition([x, y], TANK_SIZE);
    const candidate = new Tank(pos.x, pos.y, 'player', 'raider', slot);
    if (canOccupy(candidate, candidate.x, candidate.y)) return candidate;
  }

  return null;
}

function handlePlayerDeath(slot) {
  const key = slot === 2 ? 'player2' : 'player';
  const player = state[key];
  if (!player?.dead) return;

  const color = slot === 2 ? COLORS.player2 : COLORS.player;
  burst(player.cx, player.cy, color, 22);
  addShake(8);
  state.lives = Math.max(0, state.lives - 1);

  state[key] = null;

  if (state.lives > 0) {
    const respawned = respawnPlayer(slot);
    if (respawned) {
      state[key] = respawned;
    } else if (!state.pendingRespawns.includes(slot)) {
      state.pendingRespawns.push(slot);
      state.respawnClock = 0.12;
    }
  }

  syncUI();
}

function handleDeaths() {
  for (const enemy of state.enemies) {
    if (!enemy.dead || enemy.counted) continue;
    enemy.counted = true;
    state.score += enemy.spec.score;
    if (enemy.carrier) spawnPowerup(enemy.cx, enemy.cy);
    burst(
      enemy.cx,
      enemy.cy,
      enemy.spec.color,
      enemy.spec?.boss ? 34 : (enemy.type === 'heavy' ? 22 : 15)
    );
    addShake(enemy.spec?.boss ? 10 : (enemy.type === 'heavy' ? 7 : 3.5));
    audio.explosion({
      boss: Boolean(enemy.spec?.boss),
      heavy: enemy.type === 'heavy',
    });
    if (enemy.spec?.boss) {
      showNotice('BURÇKIRAN İMHA EDİLDİ', 1.2);
    }
    syncUI();
  }

  state.enemies = state.enemies.filter(enemy => !enemy.dead);

  handlePlayerDeath(1);
  if (state.coop) handlePlayerDeath(2);

  if (!activePlayers().length && state.lives <= 0 && !state.pendingRespawns.length) {
    endGame('Son tank da kaybedildi');
  }
}

function burst(x, y, color, count = 14) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 45 + Math.random() * 130;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.42 + Math.random() * 0.38,
      size: 3 + Math.random() * 4,
      color,
    });
  }
}

function debris(x, y, color, count = 5) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 25 + Math.random() * 70;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.18 + Math.random() * 0.22,
      size: 2 + Math.random() * 2,
      color,
    });
  }
}

function updateParticles(dt) {
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vx *= 0.95;
    p.vy *= 0.95;
  }
  state.particles = state.particles.filter(p => p.life > 0);
}

function addShake(amount) {
  state.shake = Math.min(12, Math.max(state.shake, amount));
}

function canOccupy(entity, x, y, { ignoreTanks = false } = {}) {
  if (x < 2 || y < 2 || x + entity.w > WORLD - 2 || y + entity.h > WORLD - 2) return false;

  const left = Math.floor((x + 2) / TILE);
  const right = Math.floor((x + entity.w - 3) / TILE);
  const top = Math.floor((y + 2) / TILE);
  const bottom = Math.floor((y + entity.h - 3) / TILE);

  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      const tile = state.grid[ty]?.[tx];
      if (!tile || ['floor', 'brush', 'ice'].includes(tile.type)) continue;

      if (tile.type === 'brick') {
        const tileX = tx * TILE;
        const tileY = ty * TILE;
        const blocked = brickBlocksRect(
          tile.mask,
          x + 2 - tileX,
          y + 2 - tileY,
          x + entity.w - 2 - tileX,
          y + entity.h - 2 - tileY,
          TILE
        );
        if (blocked) return false;
        continue;
      }

      return false;
    }
  }

  if (state.base && entity !== state.base && rectOverlap(x, y, entity.w, entity.h, state.base)) {
    return false;
  }

  if (!ignoreTanks) {
    const tanks = [state.player, state.player2, ...state.enemies];
    for (const other of tanks) {
      if (!other || other === entity || other.dead) continue;
      if (rectOverlap(x, y, entity.w, entity.h, other, 2)) return false;
    }
  }

  return true;
}

function blockingTankAhead(entity, dir, distance = 10) {
  const d = DIRS[dir];
  const x = entity.x + d.x * distance;
  const y = entity.y + d.y * distance;
  const tanks = [state.player, state.player2, ...state.enemies];

  for (const other of tanks) {
    if (!other || other === entity || other.dead) continue;
    if (rectOverlap(x, y, entity.w, entity.h, other, 2)) return other;
  }

  return null;
}

function canShiftEntity(entity, targetX, targetY, { ignoreTanks = false } = {}) {
  const dx = targetX - entity.x;
  const dy = targetY - entity.y;
  const distance = Math.max(Math.abs(dx), Math.abs(dy));

  if (distance <= 0.01) {
    return canOccupy(entity, targetX, targetY, { ignoreTanks });
  }

  const steps = Math.max(1, Math.ceil(distance / 4));
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    const x = entity.x + dx * t;
    const y = entity.y + dy * t;
    if (!canOccupy(entity, x, y, { ignoreTanks })) return false;
  }

  return true;
}

function blockingTerrainAhead(entity, dir, distance = 24) {
  const d = DIRS[dir];
  const sampleX = entity.cx + d.x * distance;
  const sampleY = entity.cy + d.y * distance;
  const tile = tileAt(sampleX, sampleY);
  if (!tile) return null;

  if (tile.type === 'brick') {
    const localX = ((sampleX % TILE) + TILE) % TILE;
    const localY = ((sampleY % TILE) + TILE) % TILE;
    return brickContainsPoint(tile.mask, localX, localY, TILE) ? tile : null;
  }

  if (tile.type === 'steel' || tile.type === 'breakableSteel' || tile.type === 'water') {
    return tile;
  }

  return null;
}

function lineOfSightDirection(source, target) {
  if (!source || !target) return null;

  const dx = target.cx - source.cx;
  const dy = target.cy - source.cy;
  const tolerance = TILE * 0.4;

  if (Math.abs(dx) <= tolerance) {
    const dir = dy >= 0 ? 'down' : 'up';
    if (clearShot(source.cx, source.cy, target.cx, target.cy, 'v')) return dir;
  }

  if (Math.abs(dy) <= tolerance) {
    const dir = dx >= 0 ? 'right' : 'left';
    if (clearShot(source.cx, source.cy, target.cx, target.cy, 'h')) return dir;
  }

  return null;
}

function clearShot(x1, y1, x2, y2, axis) {
  const distance = axis === 'v' ? Math.abs(y2 - y1) : Math.abs(x2 - x1);
  const steps = Math.max(1, Math.ceil(distance / 16));

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sampleX = x1 + (x2 - x1) * t;
    const sampleY = y1 + (y2 - y1) * t;
    const tile = tileAt(sampleX, sampleY);

    if (tile?.type === 'brick') {
      const localX = ((sampleX % TILE) + TILE) % TILE;
      const localY = ((sampleY % TILE) + TILE) % TILE;
      if (brickContainsPoint(tile.mask, localX, localY, TILE)) return false;
    } else if (tile && (tile.type === 'steel' || tile.type === 'breakableSteel')) {
      return false;
    }
  }
  return true;
}

function findPathDirection(source, target, brickCost = 4) {
  if (!source || !target) return null;

  const start = {
    x: clamp(Math.floor(source.cx / TILE), 0, COLS - 1),
    y: clamp(Math.floor(source.cy / TILE), 0, ROWS - 1),
  };
  const goal = {
    x: clamp(Math.floor(target.cx / TILE), 0, COLS - 1),
    y: clamp(Math.floor(target.cy / TILE), 0, ROWS - 1),
  };

  const startKey = cellKey(start.x, start.y);
  const goalKey = cellKey(goal.x, goal.y);
  if (startKey === goalKey) return null;

  const open = [{ x: start.x, y: start.y, g: 0, f: manhattan(start, goal) }];
  const cameFrom = new Map();
  const gScore = new Map([[startKey, 0]]);
  const closed = new Set();

  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    const currentKey = cellKey(current.x, current.y);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    if (currentKey === goalKey) {
      let stepKey = goalKey;
      let previous = cameFrom.get(stepKey);

      while (previous && previous !== startKey) {
        stepKey = previous;
        previous = cameFrom.get(stepKey);
      }

      const [sx, sy] = stepKey.split(',').map(Number);
      if (sx > start.x) return 'right';
      if (sx < start.x) return 'left';
      if (sy > start.y) return 'down';
      if (sy < start.y) return 'up';
      return null;
    }

    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;

      const tile = state.grid[ny]?.[nx];
      if (!tile) continue;

      let cost = 1;
      if (tile.type === 'brick') {
        const fillRatio = countBrickCells(tile.mask) / (BRICK_GRID * BRICK_GRID);
        cost = Math.max(1, brickCost * fillRatio);
      } else if (tile.type === 'steel' || tile.type === 'breakableSteel' || tile.type === 'water') continue;
      else if (tile.type === 'brush') cost = 1.08;
      else if (tile.type === 'ice') cost = 1.04;

      const key = cellKey(nx, ny);
      cost += enemyTrafficCost(source, nx, ny);

      const tentative = current.g + cost;
      if (tentative >= (gScore.get(key) ?? Infinity)) continue;

      cameFrom.set(key, currentKey);
      gScore.set(key, tentative);
      open.push({
        x: nx,
        y: ny,
        g: tentative,
        f: tentative + manhattan({ x: nx, y: ny }, goal),
      });
    }
  }

  return null;
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function oppositeDir(dir) {
  if (dir === 'up') return 'down';
  if (dir === 'down') return 'up';
  if (dir === 'left') return 'right';
  return 'left';
}

function enemyTrafficCost(source, tx, ty) {
  let cost = 0;

  for (const enemy of state.enemies) {
    if (!enemy || enemy === source || enemy.dead) continue;

    const ex = clamp(Math.floor(enemy.cx / TILE), 0, COLS - 1);
    const ey = clamp(Math.floor(enemy.cy / TILE), 0, ROWS - 1);
    const distance = Math.abs(ex - tx) + Math.abs(ey - ty);

    if (distance === 0) cost += 6;
    else if (distance === 1) cost += 1.4;
  }

  return cost;
}

function tileAt(x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return null;
  return state.grid[ty]?.[tx] || null;
}

function rectOverlap(x, y, w, h, b, inset = 0) {
  return (
    x + inset < b.x + b.w - inset &&
    x + w - inset > b.x + inset &&
    y + inset < b.y + b.h - inset &&
    y + h - inset > b.y + inset
  );
}

function hit(a, b) {
  return rectOverlap(a.x, a.y, a.w, a.h, b);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shuffle(values) {
  const arr = [...values];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function showNotice(text, seconds = 1) {
  state.notice = text;
  state.noticeTimer = seconds;
}

function updatePendingRespawns(dt) {
  if (!state.pendingRespawns.length) return;

  state.respawnClock -= dt;
  if (state.respawnClock > 0) return;

  const stillPending = [];
  for (const slot of state.pendingRespawns) {
    const key = slot === 2 ? 'player2' : 'player';
    if (state[key] && !state[key].dead) continue;

    const respawned = respawnPlayer(slot);
    if (respawned) state[key] = respawned;
    else stillPending.push(slot);
  }

  state.pendingRespawns = stillPending;
  state.respawnClock = stillPending.length ? 0.16 : 0;
  syncUI();
}

function update(dt) {
  pollGamepads();
  if (!state.running || state.paused || state.awaitingUpgrade) return;

  state.noticeTimer = Math.max(0, state.noticeTimer - dt);
  state.shake = Math.max(0, state.shake - dt * 18);
  state.enemyFreeze = Math.max(0, state.enemyFreeze - dt);
  state.baseShield = Math.max(0, state.baseShield - dt);

  updateSpawnQueue(dt);
  updatePendingRespawns(dt);
  state.base?.update(dt);
  state.player?.update(dt);
  state.player2?.update(dt);
  for (const enemy of state.enemies) enemy.update(dt);
  for (const bullet of state.bullets) bullet.update(dt);
  resolveBulletCollisions();
  state.bullets = state.bullets.filter(bullet => !bullet.dead);

  updatePowerups(dt);
  updateParticles(dt);
  handleDeaths();
  advanceWaveIfNeeded(dt);
}

function drawFloor() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 ? COLORS.floorA : COLORS.floorB;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      ctx.strokeStyle = COLORS.grid;
      ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
    }
  }
}

function drawTerrain() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = state.grid[y]?.[x];
      if (!tile || tile.type === 'brush') continue;

      const px = x * TILE;
      const py = y * TILE;

      if (tile.type === 'brick') {
        const cell = TILE / BRICK_GRID;

        for (let row = 0; row < BRICK_GRID; row++) {
          const by = py + row * cell;

          for (let pair = 0; pair < 2; pair++) {
            const col = pair * 2;
            const leftAlive = brickHasCell(tile.mask, col, row);
            const rightAlive = brickHasCell(tile.mask, col + 1, row);
            if (!leftAlive && !rightAlive) continue;

            const bx = px + col * cell;

            // Full pair reads as one large brick instead of two tiny squares.
            if (leftAlive && rightAlive) {
              ctx.fillStyle = COLORS.brick;
              ctx.fillRect(bx + 1, by + 1, cell * 2 - 2, cell - 2);

              ctx.fillStyle = COLORS.brickLight;
              ctx.fillRect(bx + 4, by + 3, cell * 2 - 8, 3);
              ctx.fillStyle = '#6f3f29';
              ctx.fillRect(bx + cell - 1, by + 1, 2, cell - 2);
            } else {
              const aliveCol = leftAlive ? col : col + 1;
              const partX = px + aliveCol * cell;
              ctx.fillStyle = COLORS.brick;
              ctx.fillRect(partX + 1, by + 1, cell - 2, cell - 2);
              ctx.fillStyle = COLORS.brickLight;
              ctx.fillRect(partX + 3, by + 3, Math.max(3, cell - 6), 3);
            }
          }
        }
      } else if (tile.type === 'steel' || tile.type === 'breakableSteel') {
        const breakable = tile.type === 'breakableSteel';
        ctx.fillStyle = breakable ? COLORS.breakableSteel : COLORS.steel;
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.strokeStyle = COLORS.steelLight;
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 7, py + 7, TILE - 14, TILE - 14);
        ctx.fillStyle = '#c4d0da';
        [[10,10],[38,10],[10,38],[38,38]].forEach(([ox, oy]) => {
          ctx.beginPath();
          ctx.arc(px + ox, py + oy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        });

        if (breakable) {
          ctx.strokeStyle = COLORS.breakableSteelWeak;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px + 10, py + 12);
          ctx.lineTo(px + 22, py + 24);
          ctx.lineTo(px + 16, py + 36);
          ctx.moveTo(px + 37, py + 10);
          ctx.lineTo(px + 27, py + 22);
          ctx.lineTo(px + 36, py + 36);
          ctx.stroke();

          if (tile.hp < 3) {
            ctx.strokeStyle = '#2d3540';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(px + 7, py + 39);
            ctx.lineTo(px + 40, py + 8);
            if (tile.hp === 1) {
              ctx.moveTo(px + 8, py + 8);
              ctx.lineTo(px + 39, py + 39);
            }
            ctx.stroke();
          }
        }
      } else if (tile.type === 'ice') {
        ctx.fillStyle = COLORS.ice;
        ctx.globalAlpha = 0.82;
        ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        ctx.globalAlpha = 1;

        ctx.strokeStyle = COLORS.iceLine;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + 6, py + 34);
        ctx.lineTo(px + 18, py + 22);
        ctx.lineTo(px + 27, py + 26);
        ctx.lineTo(px + 42, py + 11);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,.42)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + 5, py + 12);
        ctx.lineTo(px + 18, py + 8);
        ctx.moveTo(px + 30, py + 39);
        ctx.lineTo(px + 42, py + 34);
        ctx.stroke();
      } else if (tile.type === 'water') {
        ctx.fillStyle = COLORS.water;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = COLORS.waterLine;
        ctx.lineWidth = 3;
        const offset = (performance.now() / 24 + x * 11 + y * 5) % 18;
        for (let ly = -18; ly < TILE + 18; ly += 18) {
          ctx.beginPath();
          ctx.moveTo(px, py + ly + offset);
          ctx.lineTo(px + TILE, py + ly + offset);
          ctx.stroke();
        }
      }
    }
  }
}

function drawBrushOverlay() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (state.grid[y]?.[x]?.type !== 'brush') continue;
      const px = x * TILE;
      const py = y * TILE;

      ctx.fillStyle = 'rgba(23,55,39,.72)';
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);

      for (let i = 0; i < 9; i++) {
        const ox = 6 + ((i * 17 + x * 7 + y * 3) % 36);
        const oy = 6 + ((i * 11 + x * 5 + y * 13) % 36);
        ctx.fillStyle = i % 2 ? COLORS.brush : COLORS.brushLight;
        ctx.beginPath();
        ctx.arc(px + ox, py + oy, 4 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life * 1.8);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawNotice() {
  if (state.noticeTimer <= 0 || !state.notice) return;

  const alpha = Math.min(1, state.noticeTimer * 2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(5,10,15,.84)';
  ctx.fillRect(WORLD / 2 - 190, WORLD / 2 - 36, 380, 72);
  ctx.strokeStyle = '#3d5065';
  ctx.lineWidth = 2;
  ctx.strokeRect(WORLD / 2 - 190, WORLD / 2 - 36, 380, 72);
  ctx.fillStyle = '#f3f6f8';
  ctx.font = '800 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.notice, WORLD / 2, WORLD / 2);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, WORLD, WORLD);

  const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
  const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawFloor();
  drawTerrain();
  state.base?.draw();
  for (const powerup of state.powerups) powerup.draw();
  for (const bullet of state.bullets) bullet.draw();
  for (const enemy of state.enemies) enemy.draw();
  state.player?.draw();
  state.player2?.draw();
  drawParticles();
  drawBrushOverlay();

  ctx.restore();
  drawNotice();
}

function syncUI() {
  document.body.dataset.activePlayers = String(activePlayers().length);
  document.body.dataset.playMode = state.coop ? 'coop' : 'solo';

  UI.score.textContent = state.score;
  if (UI.stage) UI.stage.textContent = state.stage;
  UI.wave.textContent = `${state.waveInStage}/${WAVES_PER_STAGE}`;
  UI.lives.textContent = state.lives;
  UI.baseHp.textContent = state.base?.hp ?? MAX_BASE_HP;
  if (UI.weaponTier) UI.weaponTier.textContent = weaponProfile(state.weaponTier).label;
  if (UI.remaining) {
    const active = state.enemies.filter(enemy => !enemy.dead).length;
    UI.remaining.textContent = active + state.pendingSpawns;
  }
  if (UI.bestRun) {
    UI.bestRun.textContent = `En iyi: B${progress.bestStage} · ${progress.bestScore} puan`;
  }
}

function endGame(reason) {
  state.running = false;
  state.gameOver = true;
  clearAllInput();

  progress.bestScore = Math.max(progress.bestScore, state.score);
  progress.bestStage = Math.max(progress.bestStage, state.stage);
  saveProgress(progress);

  UI.gameOverTitle.textContent = reason;
  UI.gameOverText.textContent =
    `Skor ${state.score} • Bölüm ${state.stage} • Dalga ${state.waveInStage}/${WAVES_PER_STAGE}`;
  UI.gameOver.classList.add('show');
  syncUI();
}

function togglePause(force) {
  if (!state.running || state.gameOver || state.awaitingUpgrade) return;

  state.paused = typeof force === 'boolean' ? force : !state.paused;
  clearAllInput();
  UI.pause.classList.toggle('show', state.paused);
}

function setTouchAction(action, on) {
  touchInput[action] = on;
  document
    .querySelectorAll(`[data-action="${action}"]`)
    .forEach(button => button.classList.toggle('active', on));
}

function setKeyAction(target, action, on) {
  if (!action) return;
  target[action] = on;
}

function setMoveDirection(dir) {
  for (const action of MOVE_ACTIONS) {
    setTouchAction(action, action === dir);
  }
}

function clearActionObject(target) {
  for (const action of Object.keys(target)) target[action] = false;
}

function clearAllInput() {
  clearActionObject(touchInput);
  clearActionObject(keyInput1);
  clearActionObject(keyInput2);
  padInput1 = freshActions();
  padInput2 = freshActions();

  document.querySelectorAll('[data-action]').forEach(button => {
    button.classList.remove('active');
  });
  resetMovePadVisual();
}

window.addEventListener('keydown', event => {
  if (event.code === 'Escape') {
    event.preventDefault();
    togglePause();
    return;
  }

  const p1Action = p1KeyMap.get(event.code);
  const p2Action = p2KeyMap.get(event.code);
  if (!p1Action && !p2Action) return;

  event.preventDefault();
  if (p1Action) setKeyAction(keyInput1, p1Action, true);
  if (p2Action) setKeyAction(keyInput2, p2Action, true);
});

window.addEventListener('keyup', event => {
  const p1Action = p1KeyMap.get(event.code);
  const p2Action = p2KeyMap.get(event.code);
  if (!p1Action && !p2Action) return;

  event.preventDefault();
  if (p1Action) setKeyAction(keyInput1, p1Action, false);
  if (p2Action) setKeyAction(keyInput2, p2Action, false);
});

window.addEventListener('blur', clearAllInput);
window.addEventListener('gamepadconnected', pollGamepads);
window.addEventListener('gamepaddisconnected', pollGamepads);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.running && !state.awaitingUpgrade && !state.gameOver) {
    togglePause(true);
  }
});

document.querySelectorAll('[data-action="fire"]').forEach(button => {
  const start = event => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    setTouchAction('fire', true);
  };
  const end = event => {
    event.preventDefault();
    setTouchAction('fire', false);
  };

  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', end);
  button.addEventListener('pointercancel', end);
  button.addEventListener('lostpointercapture', end);
});

const directionPad = document.querySelector('#directionPad');
let directionPointerId = null;
let touchMoveDir = null;

function directionFromPadPoint(event) {
  if (!directionPad) return null;

  const rect = directionPad.getBoundingClientRect();
  const x = event.clientX - rect.left - rect.width / 2;
  const y = event.clientY - rect.top - rect.height / 2;
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  const deadZone = Math.min(rect.width, rect.height) * 0.13;

  if (Math.hypot(x, y) < deadZone) return null;

  // Keep the current axis until the perpendicular axis clearly wins.
  // This prevents left/right ↔ up/down flicker around diagonal thumb positions.
  if (touchMoveDir === 'left' || touchMoveDir === 'right') {
    if (absY <= absX * 1.18) return x > 0 ? 'right' : 'left';
  } else if (touchMoveDir === 'up' || touchMoveDir === 'down') {
    if (absX <= absY * 1.18) return y > 0 ? 'down' : 'up';
  }

  return absX > absY
    ? (x > 0 ? 'right' : 'left')
    : (y > 0 ? 'down' : 'up');
}

function paintDirectionPad(dir) {
  document.querySelectorAll('.dir-cap[data-dir]').forEach(cap => {
    cap.classList.toggle('active', cap.dataset.dir === dir);
  });
  directionPad?.classList.toggle('engaged', Boolean(dir));
}

function updateDirectionPad(event) {
  if (directionPointerId !== event.pointerId) return;
  const dir = directionFromPadPoint(event);
  touchMoveDir = dir;
  setMoveDirection(dir);
  paintDirectionPad(dir);
}

function resetMovePadVisual() {
  paintDirectionPad(null);
  touchMoveDir = null;
  directionPointerId = null;
}

if (directionPad) {
  directionPad.addEventListener('contextmenu', event => event.preventDefault());

  directionPad.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (directionPointerId !== null) return;

    directionPointerId = event.pointerId;
    touchMoveDir = null;
    directionPad.setPointerCapture?.(event.pointerId);
    updateDirectionPad(event);
  });

  directionPad.addEventListener('pointermove', event => {
    if (directionPointerId !== event.pointerId) return;
    event.preventDefault();
    updateDirectionPad(event);
  });

  const endDirection = event => {
    if (directionPointerId !== event.pointerId) return;
    event.preventDefault();
    setMoveDirection(null);
    resetMovePadVisual();
  };

  directionPad.addEventListener('pointerup', endDirection);
  directionPad.addEventListener('pointercancel', endDirection);
  directionPad.addEventListener('lostpointercapture', endDirection);
}

document.querySelector('#startBtn').addEventListener('click', () => resetGame(false));
UI.coopBtn?.addEventListener('click', () => resetGame(true));
document.querySelector('#restartBtn').addEventListener('click', () => resetGame(state.coop));
UI.pauseBtn?.addEventListener('click', () => togglePause());
UI.resumeBtn?.addEventListener('click', () => togglePause(false));

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function loadProgress() {
  try {
    const raw = localStorage.getItem('zirhova-progress-v1');
    if (!raw) return { bestScore: 0, bestStage: 1 };
    const parsed = JSON.parse(raw);
    return {
      bestScore: Number(parsed.bestScore) || 0,
      bestStage: Math.max(1, Number(parsed.bestStage) || 1),
    };
  } catch {
    return { bestScore: 0, bestStage: 1 };
  }
}

function saveProgress(value) {
  try {
    localStorage.setItem('zirhova-progress-v1', JSON.stringify(value));
  } catch {}
}

// PWA installation helpers
let deferredInstallPrompt = null;
const installBtn = document.querySelector('#installBtn');
const installHint = document.querySelector('#installHint');
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

function showInstallHint(message) {
  if (!installHint) return;
  installHint.textContent = message;
  installHint.hidden = false;
}

if (installBtn && !isStandalone) {
  if (isIOS) {
    installBtn.hidden = false;
    installBtn.textContent = "IPHONE'A EKLE";
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installBtn.hidden = false;
    installBtn.textContent = 'TELEFONA YÜKLE';
  });

  installBtn.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choice.outcome === 'accepted') installBtn.hidden = true;
      return;
    }

    if (isIOS) {
      showInstallHint("Safari'de Paylaş simgesine dokun → Ana Ekrana Ekle → Ekle.");
      return;
    }

    showInstallHint("Tarayıcı menüsünden 'Uygulamayı yükle' veya 'Ana ekrana ekle' seçeneğini kullan.");
  });

  window.addEventListener('appinstalled', () => {
    installBtn.hidden = true;
    if (installHint) installHint.hidden = true;
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {
        updateViaCache: 'none',
      });
      registration.update().catch(() => {});
    } catch {}
  });
}

const customPreview = readCustomLevel();
document.body.dataset.gameMode = customPreview ? 'custom' : 'campaign';
document.body.dataset.playMode = 'solo';

if (CUSTOM_MODE) {
  const startButton = document.querySelector('#startBtn');
  if (customPreview) {
    startButton.textContent = '1 OYUNCU · ÖZEL';
    if (UI.coopBtn) UI.coopBtn.textContent = '2 OYUNCU · ÖZEL';
  } else {
    startButton.textContent = '1 OYUNCU';
    showInstallHint('Kayıtlı geçerli özel harita bulunamadı; normal kampanya açılacak.');
  }
}

pollGamepads();
state.grid = buildMap(currentLevel());
syncUI();

if (window.location.hostname === '127.0.0.1') {
  const testSnapshot = () => ({
    coop: state.coop,
    running: state.running,
    gameOver: state.gameOver,
    awaitingUpgrade: state.awaitingUpgrade,
    stage: state.stage,
    wave: state.wave,
    waveInStage: state.waveInStage,
    lives: state.lives,
    baseHp: state.base?.hp ?? null,
    score: state.score,
    activePlayers: activePlayers().length,
    pendingRespawns: [...state.pendingRespawns],
    pendingSpawns: state.pendingSpawns,
    waveQueue: state.waveSpawnQueue.length,
    bulletCount: state.bullets.length,
    powerupCount: state.powerups.length,
    particleCount: state.particles.length,
    enemyRects: state.enemies
      .filter(enemy => !enemy.dead)
      .map(enemy => ({ x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h })),
    enemyStates: state.enemies
      .filter(enemy => !enemy.dead)
      .map(enemy => ({
        aiId: enemy.aiId,
        type: enemy.type,
        x: enemy.x,
        y: enemy.y,
        dir: enemy.dir,
        stuckClock: enemy.stuckClock,
        trafficWaitClock: enemy.trafficWaitClock,
        trafficYieldClock: enemy.trafficYieldClock,
        trafficYieldDir: enemy.trafficYieldDir,
        trafficYieldCount: enemy.trafficYieldCount,
        turnCount: enemy.turnCount,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        boss: Boolean(enemy.spec?.boss),
        bossPhase: enemy.bossPhase,
        armorFlash: enemy.armorFlash,
      })),
    queuedEnemyTypes: state.waveSpawnQueue.map(entry => entry.type),
    p1: state.player ? {
      x: state.player.x,
      y: state.player.y,
      dir: state.player.dir,
      fireCooldown: state.player.fireCooldown,
      navX: isNavAlignedStart(state.player.x, state.player.w, WORLD),
      navY: isNavAlignedStart(state.player.y, state.player.h, WORLD),
      dead: state.player.dead,
    } : null,
    p2: state.player2 ? {
      x: state.player2.x,
      y: state.player2.y,
      dir: state.player2.dir,
      navX: isNavAlignedStart(state.player2.x, state.player2.w, WORLD),
      navY: isNavAlignedStart(state.player2.y, state.player2.h, WORLD),
      dead: state.player2.dead,
    } : null,
    navStep: NAV_STEP,
    touchInput: { ...touchInput },
    bullets: state.bullets.length,
  });

  window.__zirhovaTest = {
    snapshot: testSnapshot,

    sandbox() {
      state.paused = true;
      state.enemies = [];
      state.bullets = [];
      state.powerups = [];
      state.waveSpawnQueue = [];
      state.pendingSpawns = 0;
      state.pendingRespawns = [];
      state.enemyFreeze = 0;
      nextEnemyTrafficId = 1;
      state.grid = Array.from(
        { length: ROWS },
        () => Array.from({ length: COLS }, () => makeTile('floor'))
      );
      state.base = null;
      state.player2 = null;

      const pos = gridEntityPosition([5, 8], TANK_SIZE);
      state.player = new Tank(pos.x, pos.y, 'player', 'raider', 1);
      return testSnapshot();
    },

    setP1({ x, y, dir = 'up' }) {
      if (!state.player) state.player = new Tank(x, y, 'player', 'raider', 1);
      state.player.x = x;
      state.player.y = y;
      state.player.dir = dir;
      state.player.momentumDir = dir;
      return testSnapshot();
    },

    setP2({ x, y, dir = 'up' }) {
      state.coop = true;
      state.player2 = new Tank(x, y, 'player', 'raider', 2);
      state.player2.dir = dir;
      state.player2.momentumDir = dir;
      return testSnapshot();
    },

    clearP2() {
      state.player2 = null;
      return testSnapshot();
    },

    clearP1() {
      state.player = null;
      return testSnapshot();
    },

    setBase({ x, y }) {
      state.base = new Base(x, y, MAX_BASE_HP);
      return testSnapshot();
    },

    setTile(tx, ty, type, mask = BRICK_FULL_MASK) {
      const tile = makeTile(type);
      if (type === 'brick') tile.mask = mask;
      state.grid[ty][tx] = tile;
      return { ...tile };
    },

    driveP1(dir, distance = 8) {
      if (!state.player) return { moved: false, snapshot: testSnapshot() };
      const aligned = state.player.alignForTurn(dir);
      if (!aligned) return { moved: false, aligned: false, snapshot: testSnapshot() };

      state.player.dir = dir;
      state.player.momentumDir = dir;
      const d = DIRS[dir];
      const moved = state.player.move(d.x * distance, d.y * distance);
      return { moved, aligned: true, snapshot: testSnapshot() };
    },

    setP1Momentum(dir) {
      if (state.player) state.player.momentumDir = dir;
      return testSnapshot();
    },

    stepP1(dt = 0.1) {
      state.player?.update(dt);
      return testSnapshot();
    },

    canP1Move(dir, distance = 8) {
      return Boolean(state.player?.canMove(dir, distance));
    },

    blockingAheadP1(dir, distance = 24) {
      return blockingTerrainAhead(state.player, dir, distance)?.type || null;
    },

    addEnemy({
      x,
      y,
      type = 'raider',
      dir = 'down',
      decisionClock = 999,
      fireCooldown = 999,
    }) {
      const enemy = new Tank(x, y, 'enemy', type);
      enemy.spawnShield = 0;
      enemy.dir = dir;
      enemy.momentumDir = dir;
      enemy.decisionClock = decisionClock;
      enemy.fireCooldown = fireCooldown;
      state.enemies.push(enemy);
      return testSnapshot();
    },

    setEnemy(index, patch = {}) {
      const enemy = state.enemies[index];
      if (!enemy) return testSnapshot();
      Object.assign(enemy, patch);
      return testSnapshot();
    },

    stepEnemies(dt = 0.05) {
      for (const enemy of state.enemies) {
        if (!enemy.dead) enemy.updateAI(dt);
      }
      return testSnapshot();
    },

    stepEnemyUpdates(dt = 0.05) {
      for (const enemy of state.enemies) {
        if (!enemy.dead) enemy.update(dt);
      }
      return testSnapshot();
    },

    pathDirForEnemy(index, target) {
      const enemy = state.enemies[index];
      if (!enemy) return null;
      const targetEntity = {
        x: target.x,
        y: target.y,
        w: target.w || 34,
        h: target.h || 34,
        get cx() { return this.x + this.w / 2; },
        get cy() { return this.y + this.h / 2; },
      };
      return findPathDirection(enemy, targetEntity, enemy.spec.brickCost);
    },

    setLifecycle({ stage, wave, waveInStage }) {
      if (stage !== undefined) state.stage = stage;
      if (wave !== undefined) state.wave = wave;
      if (waveInStage !== undefined) state.waveInStage = waveInStage;
      return testSnapshot();
    },

    spawnWaveForTest() {
      state.waveSpawnQueue = [];
      state.enemies = [];
      state.pendingSpawns = 0;
      spawnWave();
      return testSnapshot();
    },

    hitEnemy(index, damage, source = null) {
      const enemy = state.enemies[index];
      if (!enemy) return { result: null, snapshot: testSnapshot() };
      enemy.spawnShield = 0;
      const result = enemy.hit(damage, source);
      return { result, snapshot: testSnapshot() };
    },

    setSpawnQueue(entries) {
      state.running = true;
      state.gameOver = false;
      state.waveSpawnQueue = entries.map(entry => ({
        spawn: [...entry.spawn],
        type: entry.type || 'raider',
        carrier: Boolean(entry.carrier),
      }));
      state.pendingSpawns = state.waveSpawnQueue.length;
      state.spawnBlockedFor = 0;
      state.spawnClock = 0;
      return testSnapshot();
    },

    stepSpawn(dt = 0.2) {
      updateSpawnQueue(dt);
      return {
        blockedFor: state.spawnBlockedFor,
        snapshot: testSnapshot(),
      };
    },

    clearEnemies() {
      state.enemies = [];
      return testSnapshot();
    },

    forceP1Death() {
      if (!state.player) return testSnapshot();
      state.player.spawnShield = 0;
      state.player.dead = true;
      handleDeaths();
      return testSnapshot();
    },

    retryRespawns(seconds = 0.2) {
      updatePendingRespawns(seconds);
      return testSnapshot();
    },

    clearCurrentWave() {
      let guard = 0;

      while ((state.waveSpawnQueue.length || state.enemies.length) && guard < 80) {
        guard++;

        if (state.waveSpawnQueue.length) {
          state.spawnClock = 0;
          updateSpawnQueue(1);
        }

        for (const enemy of state.enemies) enemy.dead = true;
        handleDeaths();
      }

      updatePowerups(POWERUP_LIFETIME + 1);
      updateParticles(2);
      state.bullets = [];
      syncUI();

      return {
        guard,
        snapshot: testSnapshot(),
      };
    },

    advanceLifecycle(seconds = 3.2) {
      advanceWaveIfNeeded(seconds);
      return testSnapshot();
    },

    chooseLifecycleUpgrade() {
      if (!state.awaitingUpgrade) return testSnapshot();

      const upgrade = UPGRADES.find(candidate => {
        if (candidate.available && !candidate.available()) return false;
        if (candidate.repeatable) return true;
        return (state.upgradeLevels[candidate.id] || 0) < candidate.max;
      });

      if (!upgrade) throw new Error('No upgrade available during lifecycle test');
      chooseUpgrade(upgrade);
      return testSnapshot();
    },

    ageTransientState(seconds = 5) {
      for (const bullet of state.bullets) bullet.update(seconds);
      state.bullets = state.bullets.filter(bullet => !bullet.dead);
      updatePowerups(seconds);
      updateParticles(seconds);
      return testSnapshot();
    },

    audioDebug() {
      return audio.debug();
    },

    exerciseAudio() {
      audio.unlock();

      for (let i = 0; i < 48; i++) {
        audio.track(1, 1);
        audio.cannon({
          player: i % 2 === 0,
          strong: i % 3 === 0,
          tier: (i % 3) + 1,
          boss: i % 11 === 0,
        });
        audio.impact(i % 3 === 0 ? 'brick' : 'steel');
      }

      audio.bossAlert(1);
      audio.bossAlert(2);
      audio.pickup('arsenal');
      audio.explosion({ boss: true });

      return audio.debug();
    },

    seedStressLoad({
      enemies = 4,
      particles = 600,
      powerups = 12,
    } = {}) {
      state.running = true;
      state.gameOver = false;
      state.awaitingUpgrade = false;
      state.paused = true;
      state.enemyFreeze = 999;
      state.waveSpawnQueue = [];
      // Keep lifecycle advancement disabled while benchmarking core frame work.
      state.pendingSpawns = 1;
      state.bullets = [];
      state.enemies = [];
      state.powerups = [];
      state.particles = [];

      if (!state.player) {
        const pp = gridEntityPosition([5, 14], TANK_SIZE);
        state.player = new Tank(pp.x, pp.y, 'player', 'raider', 1);
      }
      state.player.spawnShield = 999;

      const enemySlots = [
        [2, 2], [13, 2], [2, 10], [13, 10],
        [7, 4], [7, 10],
      ];
      const enemyTypes = ['raider', 'scout', 'hunter', 'heavy'];

      for (let i = 0; i < Math.min(enemies, enemySlots.length); i++) {
        const pos = gridEntityPosition(enemySlots[i], TANK_SIZE);
        const enemy = new Tank(pos.x, pos.y, 'enemy', enemyTypes[i % enemyTypes.length]);
        enemy.spawnShield = 999;
        enemy.fireCooldown = 999;
        enemy.decisionClock = 999;
        state.enemies.push(enemy);
      }

      const powerupTypes = Object.keys(POWERUP_TYPES);
      for (let i = 0; i < powerups; i++) {
        const x = 70 + (i % 6) * 110;
        const y = 90 + Math.floor(i / 6) * 90;
        const powerup = new PowerUp(x, y, powerupTypes[i % powerupTypes.length]);
        powerup.ttl = POWERUP_LIFETIME;
        state.powerups.push(powerup);
      }

      for (let i = 0; i < particles; i++) {
        const angle = (i % 64) / 64 * Math.PI * 2;
        const speed = 20 + (i % 9) * 7;
        state.particles.push({
          x: 384 + Math.cos(angle) * (30 + (i % 120)),
          y: 384 + Math.sin(angle) * (30 + (i % 120)),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.45 + (i % 8) * 0.06,
          size: 2 + (i % 3),
          color: i % 2 ? '#fff2a6' : '#c18055',
        });
      }

      syncUI();
      return testSnapshot();
    },

    benchmarkStress({
      frames = 240,
      dt = 1 / 60,
      targetBullets = 64,
      targetParticles = 600,
      drawFrames = true,
    } = {}) {
      const times = [];
      const previousPaused = state.paused;
      state.paused = false;
      state.running = true;
      state.gameOver = false;
      state.awaitingUpgrade = false;
      state.pendingSpawns = Math.max(1, state.pendingSpawns);

      const directions = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
      ];

      let peakBullets = state.bullets.length;
      let peakParticles = state.particles.length;
      let peakPowerups = state.powerups.length;

      for (let frameIndex = 0; frameIndex < frames; frameIndex++) {
        while (state.bullets.length < targetBullets) {
          const i = state.bullets.length + frameIndex;
          const dir = directions[i % directions.length];
          const lane = i % 12;
          const x = 250 + (lane % 6) * 45;
          const y = 250 + Math.floor(lane / 6) * 180;
          state.bullets.push(
            new Bullet(x, y, dir.dx, dir.dy, 'player', {
              speed: 405,
              damage: 1,
              strong: false,
            })
          );
        }

        while (state.particles.length < targetParticles) {
          const i = state.particles.length + frameIndex * 7;
          const angle = (i % 96) / 96 * Math.PI * 2;
          state.particles.push({
            x: 384 + Math.cos(angle) * (20 + (i % 180)),
            y: 384 + Math.sin(angle) * (20 + (i % 180)),
            vx: Math.cos(angle) * (18 + (i % 11) * 5),
            vy: Math.sin(angle) * (18 + (i % 11) * 5),
            life: 0.42 + (i % 7) * 0.05,
            size: 2 + (i % 3),
            color: i % 3 ? '#fff2a6' : '#c18055',
          });
        }

        const started = performance.now();
        update(dt);
        if (drawFrames) draw();
        times.push(performance.now() - started);

        peakBullets = Math.max(peakBullets, state.bullets.length);
        peakParticles = Math.max(peakParticles, state.particles.length);
        peakPowerups = Math.max(peakPowerups, state.powerups.length);
      }

      state.paused = previousPaused;

      const sorted = [...times].sort((a, b) => a - b);
      const averageMs = times.reduce((sum, value) => sum + value, 0) / times.length;
      const p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
      const maxMs = sorted[sorted.length - 1];

      return {
        frames,
        averageMs,
        p95Ms,
        maxMs,
        peakBullets,
        peakParticles,
        peakPowerups,
        snapshot: testSnapshot(),
      };
    },

    clearStressLoad() {
      state.bullets = [];
      state.powerups = [];
      state.particles = [];
      state.enemies = [];
      state.pendingSpawns = 0;
      state.enemyFreeze = 0;
      syncUI();
      return testSnapshot();
    },
  };
}
