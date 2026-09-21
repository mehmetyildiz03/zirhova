import { LEVELS } from './levels.js';

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
};

const TILE = 48;
const COLS = 16;
const ROWS = 16;
const WORLD = TILE * COLS;
const WAVES_PER_STAGE = 3;
const MAX_BASE_HP = 5;
const TANK_SIZE = 34;
const MAX_MOVE_STEP = 5;
const MAX_ACTIVE_ENEMIES = 4;
const POWERUP_LIFETIME = 11;

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
  water: '#17465f',
  waterLine: '#2c7797',
  ice: '#9dd8e8',
  iceLine: '#d9f6ff',
  brush: '#234f39',
  brushLight: '#397255',
  player: '#e8d35b',
  playerDark: '#8c7d2d',
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
};

const DIRS = {
  up: { x: 0, y: -1, a: -Math.PI / 2, axis: 'v' },
  down: { x: 0, y: 1, a: Math.PI / 2, axis: 'v' },
  left: { x: -1, y: 0, a: Math.PI, axis: 'h' },
  right: { x: 1, y: 0, a: 0, axis: 'h' },
};

const DIR_NAMES = Object.keys(DIRS);
const MOVE_ACTIONS = ['up', 'down', 'left', 'right'];
const input = { up: false, down: false, left: false, right: false, fire: false };
const keyMap = new Map([
  ['ArrowUp', 'up'], ['KeyW', 'up'],
  ['ArrowDown', 'down'], ['KeyS', 'down'],
  ['ArrowLeft', 'left'], ['KeyA', 'left'],
  ['ArrowRight', 'right'], ['KeyD', 'right'],
  ['Space', 'fire'], ['Enter', 'fire'],
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

let audioCtx = null;
function tone(freq = 220, duration = 0.05, type = 'square', gain = 0.04) {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.value = gain;
    osc.connect(amp).connect(audioCtx.destination);
    osc.start();
    amp.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
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
  constructor(x, y, team, type = 'raider') {
    super(x, y, TANK_SIZE, TANK_SIZE);
    this.team = team;
    this.type = type;
    this.spec = team === 'player' ? null : ENEMY_TYPES[type];
    this.dir = team === 'player' ? 'up' : 'down';
    this.speed = team === 'player' ? 162 * state.modifiers.speed : this.spec.speed;
    this.maxHp = team === 'player' ? 1 + state.modifiers.armor : this.spec.hp;
    this.hp = this.maxHp;
    this.fireCooldown = 0;
    this.decisionClock = 0;
    this.stuckClock = 0;
    this.spawnShield = team === 'player' ? 1.25 : 0.52;
    this.carrier = false;
    this.momentumDir = this.dir;
    this.muzzleFlash = 0;
    this.hitFlash = 0;
    this.recoil = 0;
  }

  update(dt) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.spawnShield = Math.max(0, this.spawnShield - dt);
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.recoil = Math.max(0, this.recoil - dt * 34);

    if (this.team !== 'player' && state.enemyFreeze > 0) return;

    if (this.team === 'player') this.updatePlayer(dt);
    else this.updateAI(dt);
  }

  updatePlayer(dt) {
    let dir = null;
    if (input.up) dir = 'up';
    else if (input.down) dir = 'down';
    else if (input.left) dir = 'left';
    else if (input.right) dir = 'right';

    const onIce = tileAt(this.cx, this.cy)?.type === 'ice';

    if (dir) {
      this.alignForTurn(dir);
      this.dir = dir;
      this.momentumDir = dir;
      const d = DIRS[dir];
      this.move(d.x * this.speed * dt, d.y * this.speed * dt);
    } else if (onIce && this.momentumDir) {
      const d = DIRS[this.momentumDir];
      this.move(d.x * this.speed * 0.72 * dt, d.y * this.speed * 0.72 * dt);
    }

    if (input.fire) this.shoot();
  }

  updateAI(dt) {
    const target = this.spec.target === 'player' && state.player && !state.player.dead
      ? state.player
      : state.base;

    const shotDir = lineOfSightDirection(this, target);
    if (shotDir && this.fireCooldown <= 0) {
      this.dir = shotDir;
      this.shoot();
    }

    const onIce = tileAt(this.cx, this.cy)?.type === 'ice';
    this.decisionClock -= dt * (onIce ? 0.28 : 1);
    if (this.decisionClock <= 0) {
      this.decisionClock = 0.24 + Math.random() * 0.36;
      this.dir = this.chooseDirection(target);
    }

    const ahead = tileAhead(this, this.dir, 25);
    if (ahead?.type === 'brick' && this.fireCooldown <= 0) {
      this.shoot();
      return;
    }

    const d = DIRS[this.dir];
    const moved = this.move(d.x * this.speed * dt, d.y * this.speed * dt);

    if (!moved) {
      this.stuckClock += dt;
      if (this.stuckClock > 0.09) {
        this.dir = this.chooseDirection(target, this.dir);
        this.stuckClock = 0;
        this.decisionClock = 0.12;
      }
    } else {
      this.stuckClock = 0;
    }

    if (!shotDir && this.fireCooldown <= 0 && Math.random() < 0.0045) this.shoot();
  }

  chooseDirection(target, avoidDir = null) {
    const pathDir = findPathDirection(this, target, this.spec.brickCost);
    if (pathDir && pathDir !== avoidDir) {
      const ahead = tileAhead(this, pathDir, 24);
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
      .filter((name, index, arr) => arr.indexOf(name) === index && name !== avoidDir);

    for (const name of candidates) {
      const ahead = tileAhead(this, name, 24);
      if (ahead?.type === 'brick' || this.canMove(name, 9)) return name;
    }
    return preferred[0];
  }

  canMove(dir, distance = 8) {
    const d = DIRS[dir];
    return canOccupy(this, this.x + d.x * distance, this.y + d.y * distance);
  }

  alignForTurn(nextDir) {
    if (DIRS[nextDir].axis === DIRS[this.dir].axis) return;

    if (DIRS[nextDir].axis === 'v') {
      const desiredX = nearestLaneStart(this.cx, this.w);
      if (Math.abs(desiredX - this.x) <= 10 && canOccupy(this, desiredX, this.y)) {
        this.x = desiredX;
      }
    } else {
      const desiredY = nearestLaneStart(this.cy, this.h);
      if (Math.abs(desiredY - this.y) <= 10 && canOccupy(this, this.x, desiredY)) {
        this.y = desiredY;
      }
    }
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
    const damage = playerShot ? state.modifiers.shotPower : 1;
    const bulletSpeed = playerShot
      ? 410 * state.modifiers.bulletSpeed
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
          strong: playerShot ? damage > 1 : Boolean(this.spec?.strongShot),
        }
      )
    );

    this.fireCooldown = playerShot
      ? 0.265 * state.modifiers.fireRate
      : this.spec.fireBase + Math.random() * 0.22;

    this.muzzleFlash = 0.055;
    this.recoil = playerShot ? 4.5 : 3.2;
    addShake(playerShot ? 1.1 : 0.45);
    tone(playerShot ? 410 : 225, 0.035, 'square', playerShot ? 0.028 : 0.02);
    if (playerShot) haptic(5);
  }

  hit(damage = 1) {
    if (this.spawnShield > 0 || this.dead) return;

    this.hp -= damage;
    this.hitFlash = 0.095;
    this.spawnShield = this.team === 'player' ? 0.22 : 0.08;

    if (this.team === 'player') {
      addShake(5);
      haptic(20);
      tone(125, 0.09, 'sawtooth', 0.04);
    } else {
      addShake(this.maxHp >= 4 ? 2.6 : 1.5);
      tone(170, 0.07, 'sawtooth', 0.028);
    }

    if (this.hp <= 0) this.dead = true;
  }

  draw() {
    const color = this.team === 'player' ? COLORS.player : this.spec.color;
    const dark = this.team === 'player' ? COLORS.playerDark : this.spec.dark;

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

    if (this.team === 'enemy') this.drawEnemyMark();

    if (this.hitFlash > 0) {
      ctx.globalAlpha = Math.min(0.8, this.hitFlash * 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-13, -12, 26, 24);
      ctx.globalAlpha = 1;
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
    }
  }

  drawHealth() {
    if (this.maxHp <= 1 || this.dead) return;
    const width = 28;
    const x = this.cx - width / 2;
    const y = this.y - 7;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(x, y, width, 4);
    ctx.fillStyle = this.team === 'player' ? '#e8d35b' : '#f1f4f6';
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
      if (tile && !['floor', 'water', 'brush', 'ice'].includes(tile.type)) {
        if (tile.type === 'brick') {
          tile.hp -= this.strong ? Math.max(2, this.damage) : 1;
          debris(this.cx, this.cy, COLORS.brickLight);
          if (tile.hp <= 0) {
            tile.type = 'floor';
            addShake(1.4);
          }
        } else {
          debris(this.cx, this.cy, COLORS.steelLight, 3);
        }

        this.dead = true;
        tone(95, 0.04, 'square', 0.018);
        break;
      }

      if (this.team === 'player') {
        for (const enemy of state.enemies) {
          if (!enemy.dead && hit(this, enemy)) {
            enemy.hit(this.damage);
            this.dead = true;
            break;
          }
        }
      } else {
        if (state.player && !state.player.dead && hit(this, state.player)) {
          state.player.hit(1);
          this.dead = true;
          break;
        }
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
  powerups: [],
  enemyFreeze: 0,
  baseShield: 0,
  waveSpawnQueue: [],
  spawnClock: 0,
};

function currentLevel() {
  return LEVELS[(state.stage - 1) % LEVELS.length];
}

function makeTile(type = 'floor') {
  return { type, hp: type === 'brick' ? 2 : 999 };
}

function buildMap(level) {
  const grid = Array.from(
    { length: ROWS },
    () => Array.from({ length: COLS }, () => makeTile('floor'))
  );

  for (const [x, y] of level.bricks) grid[y][x] = makeTile('brick');
  for (const [x, y] of level.steel) grid[y][x] = makeTile('steel');
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

function resetGame() {
  state.runToken++;
  clearAllInput();

  Object.assign(state, {
    running: true,
    gameOver: false,
    paused: false,
    awaitingUpgrade: false,
    score: 0,
    stage: 1,
    wave: 1,
    waveInStage: 1,
    lives: 3,
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
    powerups: [],
    enemyFreeze: 0,
    baseShield: 0,
    waveSpawnQueue: [],
    spawnClock: 0,
  });

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
  state.enemyFreeze = 0;
  state.waveTimer = 0;

  const bp = gridEntityPosition(level.baseSpawn, 42);
  const pp = gridEntityPosition(level.playerSpawn, TANK_SIZE);
  state.base = new Base(bp.x, bp.y, previousHp);
  state.player = new Tank(pp.x, pp.y, 'player');

  if (announce) showNotice(`BÖLÜM ${state.stage} · ${level.name}`, 1.4);
  spawnWave();
  syncUI();
}

function spawnWave() {
  const level = currentLevel();
  const difficulty = state.wave + Math.floor((state.stage - 1) * 0.8);
  const count = Math.min(3 + state.waveInStage + Math.floor(state.stage / 2), 11);
  const carrierIndex = Math.min(count - 1, Math.max(1, Math.floor(count * 0.55)));

  state.waveSpawnQueue = Array.from({ length: count }, (_, i) => ({
    spawn: level.enemySpawns[i % level.enemySpawns.length],
    type: chooseEnemyType(difficulty, i, count),
    carrier: i === carrierIndex,
  }));
  state.pendingSpawns = state.waveSpawnQueue.length;
  state.spawnClock = 0;
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

  const placement = findSpawnPlacement(enemy);
  enemy.x = placement.x;
  enemy.y = placement.y;
  state.enemies.push(enemy);

  state.pendingSpawns = state.waveSpawnQueue.length;
  state.spawnClock = 0.42;
  syncUI();
}

function findSpawnPlacement(enemy) {
  if (canOccupy(enemy, enemy.x, enemy.y)) return { x: enemy.x, y: enemy.y };

  for (const offset of [10, 20, 30, 40]) {
    if (canOccupy(enemy, enemy.x, enemy.y + offset)) {
      return { x: enemy.x, y: enemy.y + offset };
    }
  }
  return { x: enemy.x, y: enemy.y };
}

function chooseEnemyType(difficulty, index, count) {
  if (index === count - 1 && difficulty >= 7) return 'heavy';
  if (index === count - 1 && difficulty >= 4) return 'hunter';

  const pool = ['raider', 'raider'];
  if (difficulty >= 2) pool.push('scout');
  if (difficulty >= 3) pool.push('hunter');
  if (difficulty >= 5) pool.push('breacher');
  if (difficulty >= 7) pool.push('heavy');

  return pool[Math.floor(Math.random() * pool.length)];
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

  return shuffle(available).slice(0, Math.min(count, available.length));
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
  const keys = Object.keys(POWERUP_TYPES);
  const type = keys[Math.floor(Math.random() * keys.length)];
  state.powerups.push(new PowerUp(x, y, type));
  showNotice(`${POWERUP_TYPES[type].name} SAHADA`, 0.8);
  tone(760, 0.06, 'square', 0.022);
}

function applyPowerup(type) {
  const spec = POWERUP_TYPES[type];

  if (type === 'armor') {
    if (state.player) state.player.spawnShield = Math.max(state.player.spawnShield, 8);
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

  showNotice(spec.name, 1.05);
  tone(920, 0.07, 'square', 0.03);
  haptic(14);
  syncUI();
}

function updatePowerups(dt) {
  if (!state.powerups.length) return;

  for (const powerup of state.powerups) {
    powerup.update(dt);
    if (!powerup.dead && state.player && !state.player.dead && hit(powerup, state.player)) {
      powerup.dead = true;
      applyPowerup(powerup.type);
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
    tone(310, 0.055, 'square', 0.022);
    return;
  }

  state.base.hp--;
  state.base.hitFlash = 0.18;
  addShake(7);
  debris(state.base.cx, state.base.cy, COLORS.baseCore, 8);
  tone(72, 0.14, 'sawtooth', 0.05);
  haptic(24);
  syncUI();

  if (state.base.hp <= 0) endGame('Üs çekirdeği yok edildi');
}

function handleDeaths() {
  for (const enemy of state.enemies) {
    if (!enemy.dead || enemy.counted) continue;
    enemy.counted = true;
    state.score += enemy.spec.score;
    if (enemy.carrier) spawnPowerup(enemy.cx, enemy.cy);
    burst(enemy.cx, enemy.cy, enemy.spec.color, enemy.type === 'heavy' ? 22 : 15);
    addShake(enemy.type === 'heavy' ? 7 : 3.5);
    syncUI();
  }

  state.enemies = state.enemies.filter(enemy => !enemy.dead);

  if (state.player?.dead) {
    burst(state.player.cx, state.player.cy, COLORS.player, 22);
    addShake(8);
    state.lives--;
    syncUI();

    if (state.lives <= 0) {
      endGame('Son tank da kaybedildi');
    } else {
      const pos = gridEntityPosition(currentLevel().playerSpawn, TANK_SIZE);
      state.player = new Tank(pos.x, pos.y, 'player');
    }
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
      if (tile && !['floor', 'brush', 'ice'].includes(tile.type)) return false;
    }
  }

  if (state.base && entity !== state.base && rectOverlap(x, y, entity.w, entity.h, state.base)) {
    return false;
  }

  if (!ignoreTanks) {
    const tanks = [state.player, ...state.enemies];
    for (const other of tanks) {
      if (!other || other === entity || other.dead) continue;
      if (rectOverlap(x, y, entity.w, entity.h, other, 2)) return false;
    }
  }

  return true;
}

function nearestLaneStart(center, size) {
  const laneCenter = Math.round((center - TILE / 2) / TILE) * TILE + TILE / 2;
  return clamp(laneCenter - size / 2, 2, WORLD - size - 2);
}

function tileAhead(entity, dir, distance = 24) {
  const d = DIRS[dir];
  return tileAt(entity.cx + d.x * distance, entity.cy + d.y * distance);
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
    const tile = tileAt(
      x1 + (x2 - x1) * t,
      y1 + (y2 - y1) * t
    );
    if (tile && (tile.type === 'brick' || tile.type === 'steel')) return false;
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
      if (tile.type === 'brick') cost = brickCost;
      else if (tile.type === 'steel' || tile.type === 'water') continue;
      else if (tile.type === 'brush') cost = 1.08;
      else if (tile.type === 'ice') cost = 1.04;

      const key = cellKey(nx, ny);
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

function update(dt) {
  if (!state.running || state.paused || state.awaitingUpgrade) return;

  state.noticeTimer = Math.max(0, state.noticeTimer - dt);
  state.shake = Math.max(0, state.shake - dt * 18);
  state.enemyFreeze = Math.max(0, state.enemyFreeze - dt);
  state.baseShield = Math.max(0, state.baseShield - dt);

  updateSpawnQueue(dt);
  state.base?.update(dt);
  state.player?.update(dt);
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
        ctx.fillStyle = COLORS.brick;
        ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = COLORS.brickLight;
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 2; c++) {
            ctx.fillRect(px + 6 + c * 19 + (r % 2) * 7, py + 7 + r * 13, 14, 7);
          }
        }
        if (tile.hp === 1) {
          ctx.strokeStyle = '#2e1710';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(px + 6, py + 8);
          ctx.lineTo(px + 38, py + 40);
          ctx.stroke();
        }
      } else if (tile.type === 'steel') {
        ctx.fillStyle = COLORS.steel;
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
  drawParticles();
  drawBrushOverlay();

  ctx.restore();
  drawNotice();
}

function syncUI() {
  UI.score.textContent = state.score;
  if (UI.stage) UI.stage.textContent = state.stage;
  UI.wave.textContent = `${state.waveInStage}/${WAVES_PER_STAGE}`;
  UI.lives.textContent = state.lives;
  UI.baseHp.textContent = state.base?.hp ?? MAX_BASE_HP;
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

function setAction(action, on) {
  input[action] = on;
  document
    .querySelectorAll(`[data-action="${action}"]`)
    .forEach(button => button.classList.toggle('active', on));
}

function setMoveDirection(dir) {
  for (const action of MOVE_ACTIONS) setAction(action, action === dir);
}

function clearAllInput() {
  for (const action of Object.keys(input)) setAction(action, false);
  resetMovePadVisual();
}

window.addEventListener('keydown', event => {
  if (event.code === 'Escape') {
    event.preventDefault();
    togglePause();
    return;
  }

  const action = keyMap.get(event.code);
  if (!action) return;
  event.preventDefault();
  setAction(action, true);
});

window.addEventListener('keyup', event => {
  const action = keyMap.get(event.code);
  if (!action) return;
  event.preventDefault();
  setAction(action, false);
});

window.addEventListener('blur', () => {
  clearAllInput();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.running && !state.awaitingUpgrade && !state.gameOver) {
    togglePause(true);
  }
});

document.querySelectorAll('[data-action="fire"]').forEach(button => {
  const start = event => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    setAction('fire', true);
  };
  const end = event => {
    event.preventDefault();
    setAction('fire', false);
  };

  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', end);
  button.addEventListener('pointercancel', end);
  button.addEventListener('lostpointercapture', end);
});

const directionPad = document.querySelector('#directionPad');
let directionPointerId = null;

function directionFromPadPoint(event) {
  if (!directionPad) return null;

  const rect = directionPad.getBoundingClientRect();
  const x = event.clientX - rect.left - rect.width / 2;
  const y = event.clientY - rect.top - rect.height / 2;
  const deadZone = Math.min(rect.width, rect.height) * 0.13;

  if (Math.hypot(x, y) < deadZone) return null;
  return Math.abs(x) > Math.abs(y)
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
  setMoveDirection(dir);
  paintDirectionPad(dir);
}

function resetMovePadVisual() {
  paintDirectionPad(null);
  directionPointerId = null;
}

if (directionPad) {
  directionPad.addEventListener('contextmenu', event => event.preventDefault());

  directionPad.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (directionPointerId !== null) return;

    directionPointerId = event.pointerId;
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

document.querySelector('#startBtn').addEventListener('click', resetGame);
document.querySelector('#restartBtn').addEventListener('click', resetGame);
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
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

state.grid = buildMap(currentLevel());
syncUI();
