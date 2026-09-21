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
  intro: document.querySelector('#introOverlay'),
  gameOver: document.querySelector('#gameOverOverlay'),
  gameOverTitle: document.querySelector('#gameOverTitle'),
  gameOverText: document.querySelector('#gameOverText'),
};

const TILE = 48;
const COLS = 16;
const ROWS = 16;
const WORLD = TILE * COLS;
const WAVES_PER_STAGE = 3;
const MAX_BASE_HP = 5;
const TANK_SIZE = 34;
const MAX_MOVE_STEP = 5;

canvas.width = WORLD;
canvas.height = WORLD;

const COLORS = {
  floorA: '#111a22',
  floorB: '#0e161d',
  grid: '#18232d',
  brick: '#9a5f3c',
  brickLight: '#bd7950',
  steel: '#5b6976',
  steelLight: '#8595a3',
  water: '#224c62',
  waterLine: '#33718c',
  player: '#e6d35a',
  playerDark: '#887d2f',
  enemy: '#dc6656',
  enemyElite: '#d28eff',
  bullet: '#f5f1d2',
  base: '#79c6a3',
  baseCore: '#d9f2e6',
};

const DIRS = {
  up: { x: 0, y: -1, a: -Math.PI / 2, axis: 'v' },
  down: { x: 0, y: 1, a: Math.PI / 2, axis: 'v' },
  left: { x: -1, y: 0, a: Math.PI, axis: 'h' },
  right: { x: 1, y: 0, a: 0, axis: 'h' },
};

const DIR_NAMES = Object.keys(DIRS);
const input = { up: false, down: false, left: false, right: false, fire: false };
const keyMap = new Map([
  ['ArrowUp', 'up'], ['KeyW', 'up'],
  ['ArrowDown', 'down'], ['KeyS', 'down'],
  ['ArrowLeft', 'left'], ['KeyA', 'left'],
  ['ArrowRight', 'right'], ['KeyD', 'right'],
  ['Space', 'fire'], ['Enter', 'fire'],
]);

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
  constructor(x, y, team, elite = false) {
    super(x, y, TANK_SIZE, TANK_SIZE);
    this.team = team;
    this.elite = elite;
    this.dir = team === 'player' ? 'up' : 'down';
    this.speed = team === 'player' ? 162 : (elite ? 112 : 90);
    this.fireCooldown = 0;
    this.decisionClock = 0;
    this.stuckClock = 0;
    this.hp = elite ? 3 : 1;
    this.spawnShield = team === 'player' ? 1.35 : 0.55;
  }

  update(dt) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.spawnShield = Math.max(0, this.spawnShield - dt);
    if (this.team === 'player') this.updatePlayer(dt);
    else this.updateAI(dt);
  }

  updatePlayer(dt) {
    let dir = null;
    if (input.up) dir = 'up';
    else if (input.down) dir = 'down';
    else if (input.left) dir = 'left';
    else if (input.right) dir = 'right';

    if (dir) {
      this.alignForTurn(dir);
      this.dir = dir;
      const d = DIRS[dir];
      this.move(d.x * this.speed * dt, d.y * this.speed * dt);
    }
    if (input.fire) this.shoot();
  }

  updateAI(dt) {
    this.decisionClock -= dt;
    const target = this.pickTarget();

    const shotDir = lineOfSightDirection(this, target);
    if (shotDir && this.fireCooldown <= 0) {
      this.dir = shotDir;
      if (Math.random() < (this.elite ? 0.72 : 0.52)) this.shoot();
    }

    if (this.decisionClock <= 0) {
      this.decisionClock = (this.elite ? 0.28 : 0.42) + Math.random() * 0.55;
      this.dir = this.chooseDirection(target);
    }

    const d = DIRS[this.dir];
    const moved = this.move(d.x * this.speed * dt, d.y * this.speed * dt);

    if (!moved) {
      this.stuckClock += dt;
      if (this.stuckClock > 0.08) {
        this.dir = this.chooseDirection(target, this.dir);
        this.stuckClock = 0;
        this.decisionClock = 0.16;
      }
    } else {
      this.stuckClock = 0;
    }

    if (!shotDir && this.fireCooldown <= 0 && Math.random() < (this.elite ? 0.014 : 0.007)) {
      this.shoot();
    }
  }

  pickTarget() {
    if (!state.player || state.player.dead) return state.base;
    const baseBias = this.elite ? 0.58 : 0.46;
    return Math.random() < baseBias ? state.base : state.player;
  }

  chooseDirection(target, avoidDir = null) {
    const dx = target.cx - this.cx;
    const dy = target.cy - this.cy;
    const horizontal = dx >= 0 ? 'right' : 'left';
    const vertical = dy >= 0 ? 'down' : 'up';

    const preferred = Math.abs(dx) > Math.abs(dy)
      ? [horizontal, vertical]
      : [vertical, horizontal];

    const fallback = shuffle(DIR_NAMES.filter(name => !preferred.includes(name)));
    const candidates = [...preferred, ...fallback].filter(name => name !== avoidDir);

    for (const name of candidates) {
      if (this.canMove(name, 10)) return name;
    }
    return fallback[0] || preferred[0];
  }

  canMove(dir, distance = 8) {
    const d = DIRS[dir];
    return canOccupy(this, this.x + d.x * distance, this.y + d.y * distance);
  }

  alignForTurn(nextDir) {
    if (DIRS[nextDir].axis === DIRS[this.dir].axis) return;

    if (DIRS[nextDir].axis === 'v') {
      const desiredX = nearestLaneStart(this.cx, this.w);
      const delta = desiredX - this.x;
      if (Math.abs(delta) <= 8 && canOccupy(this, desiredX, this.y)) this.x = desiredX;
    } else {
      const desiredY = nearestLaneStart(this.cy, this.h);
      const delta = desiredY - this.y;
      if (Math.abs(delta) <= 8 && canOccupy(this, this.x, desiredY)) this.y = desiredY;
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
    if (this.fireCooldown > 0 || this.dead) return;
    const d = DIRS[this.dir];
    state.bullets.push(
      new Bullet(
        this.cx + d.x * 23 - 4,
        this.cy + d.y * 23 - 4,
        d.x,
        d.y,
        this.team,
        this.elite
      )
    );
    this.fireCooldown = this.team === 'player'
      ? 0.255
      : (this.elite ? 0.52 : 0.82 + Math.random() * 0.38);

    tone(this.team === 'player' ? 390 : 220, 0.035, 'square', 0.025);
    if (this.team === 'player') haptic(5);
  }

  hit(damage = 1) {
    if (this.spawnShield > 0) return;
    this.hp -= damage;
    this.spawnShield = 0.22;
    tone(this.team === 'player' ? 130 : 170, 0.09, 'sawtooth', 0.035);
    if (this.team === 'player') haptic(18);
    if (this.hp <= 0) this.dead = true;
  }

  draw() {
    const color = this.team === 'player'
      ? COLORS.player
      : (this.elite ? COLORS.enemyElite : COLORS.enemy);
    const dark = this.team === 'player' ? COLORS.playerDark : '#743329';

    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(DIRS[this.dir].a);
    ctx.fillStyle = dark;
    ctx.fillRect(-17, -17, 34, 7);
    ctx.fillRect(-17, 10, 34, 7);
    ctx.fillStyle = color;
    ctx.fillRect(-13, -12, 26, 24);
    ctx.fillStyle = '#111820';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = color;
    ctx.fillRect(0, -3, 25, 6);
    ctx.fillRect(16, -5, 10, 10);

    if (this.elite) {
      ctx.strokeStyle = '#f4dcff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-14, -13, 28, 26);
    }

    if (this.spawnShield > 0) {
      ctx.strokeStyle = `rgba(220,245,255,${0.25 + 0.45 * Math.sin(performance.now() / 70) ** 2})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

class Bullet extends RectEntity {
  constructor(x, y, dx, dy, team, strong = false) {
    super(x, y, 8, 8);
    Object.assign(this, { dx, dy, team, strong, speed: strong ? 440 : 405 });
  }

  update(dt) {
    const travel = this.speed * dt;
    const steps = Math.max(1, Math.ceil(travel / 7));
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
      if (tile && tile.type !== 'floor' && tile.type !== 'water') {
        if (tile.type === 'brick') {
          tile.hp -= this.strong ? 2 : 1;
          if (tile.hp <= 0) tile.type = 'floor';
        }
        this.dead = true;
        tone(95, 0.045, 'square', 0.02);
        break;
      }

      if (this.team === 'player') {
        for (const enemy of state.enemies) {
          if (!enemy.dead && hit(this, enemy)) {
            enemy.hit(this.strong ? 2 : 1);
            this.dead = true;
            break;
          }
        }
      } else {
        if (state.player && !state.player.dead && hit(this, state.player)) {
          state.player.hit();
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
    ctx.fillStyle = this.strong ? '#ffffff' : COLORS.bullet;
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}

class Base extends RectEntity {
  constructor(x, y, hp = MAX_BASE_HP) {
    super(x, y, 42, 42);
    this.hp = hp;
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
    ctx.fillStyle = COLORS.baseCore;
    ctx.fillRect(-8, -8, 16, 16);
    ctx.strokeStyle = '#1f4c3a';
    ctx.lineWidth = 4;
    ctx.strokeRect(-12, -12, 24, 24);
    ctx.restore();
  }
}

const state = {
  running: false,
  gameOver: false,
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
  Object.keys(input).forEach(key => setAction(key, false));

  Object.assign(state, {
    running: true,
    gameOver: false,
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
  });

  loadStage({ preserveBaseHp: false, announce: true });
  UI.gameOver.classList.remove('show');
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
  state.pendingSpawns = 0;
  state.waveTimer = 0;

  const bp = gridEntityPosition(level.baseSpawn, 42);
  const pp = gridEntityPosition(level.playerSpawn, TANK_SIZE);
  state.base = new Base(bp.x, bp.y, previousHp);
  state.player = new Tank(pp.x, pp.y, 'player');

  if (announce) showNotice(`BÖLÜM ${state.stage} · ${level.name}`, 1.45);
  spawnWave();
  syncUI();
}

function spawnWave() {
  const level = currentLevel();
  const difficulty = state.wave + Math.floor((state.stage - 1) * 0.7);
  const count = Math.min(3 + state.waveInStage + Math.floor(state.stage / 2), 10);
  state.pendingSpawns += count;

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      if (!state.running) {
        state.pendingSpawns = Math.max(0, state.pendingSpawns - 1);
        return;
      }

      const spawn = level.enemySpawns[i % level.enemySpawns.length];
      const pos = gridEntityPosition(spawn, TANK_SIZE);
      const eliteChance = Math.min(0.08 + difficulty * 0.028, 0.34);
      const elite = difficulty >= 3 && (i === count - 1 || Math.random() < eliteChance);

      const enemy = new Tank(pos.x, pos.y, 'enemy', elite);
      if (canOccupy(enemy, enemy.x, enemy.y, { ignoreTanks: false })) {
        state.enemies.push(enemy);
      } else {
        enemy.y += 8;
        state.enemies.push(enemy);
      }
      state.pendingSpawns = Math.max(0, state.pendingSpawns - 1);
    }, i * 360);
  }
}

function advanceWaveIfNeeded(dt) {
  if (state.pendingSpawns > 0 || state.enemies.some(enemy => !enemy.dead)) {
    state.waveTimer = 0;
    return;
  }

  state.waveTimer += dt;
  if (state.waveTimer <= 1.05) return;
  state.waveTimer = 0;

  if (state.waveInStage >= WAVES_PER_STAGE) {
    state.stage++;
    state.wave++;
    state.waveInStage = 1;
    tone(720, 0.08, 'square', 0.03);
    setTimeout(() => tone(860, 0.09, 'square', 0.025), 90);
    loadStage({ preserveBaseHp: true, announce: true });
    return;
  }

  state.wave++;
  state.waveInStage++;
  showNotice(`DALGA ${state.waveInStage}/${WAVES_PER_STAGE}`, 0.9);
  tone(640, 0.07, 'square', 0.026);
  spawnWave();
  syncUI();
}

function damageBase() {
  state.base.hp--;
  tone(72, 0.14, 'sawtooth', 0.05);
  haptic(22);
  syncUI();
  if (state.base.hp <= 0) endGame('Üs çekirdeği yok edildi');
}

function handleDeaths() {
  for (const enemy of state.enemies) {
    if (!enemy.dead || enemy.counted) continue;
    enemy.counted = true;
    state.score += enemy.elite ? 350 : 100;
    burst(enemy.cx, enemy.cy, enemy.elite ? '#d28eff' : '#dc6656');
    syncUI();
  }
  state.enemies = state.enemies.filter(enemy => !enemy.dead);

  if (state.player?.dead) {
    burst(state.player.cx, state.player.cy, '#e6d35a');
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

function burst(x, y, color) {
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 110;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.55 + Math.random() * 0.35,
      color,
    });
  }
}

function updateParticles(dt) {
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vx *= 0.97;
    p.vy *= 0.97;
  }
  state.particles = state.particles.filter(p => p.life > 0);
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
      if (tile && tile.type !== 'floor') return false;
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

function lineOfSightDirection(source, target) {
  if (!source || !target) return null;

  const dx = target.cx - source.cx;
  const dy = target.cy - source.cy;
  const tolerance = TILE * 0.42;

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
  const steps = Math.max(1, Math.ceil(distance / 18));

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    const tile = tileAt(x, y);
    if (tile && (tile.type === 'brick' || tile.type === 'steel')) return false;
  }
  return true;
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
  if (!state.running) return;

  state.noticeTimer = Math.max(0, state.noticeTimer - dt);
  state.player?.update(dt);
  for (const enemy of state.enemies) enemy.update(dt);
  for (const bullet of state.bullets) bullet.update(dt);
  state.bullets = state.bullets.filter(bullet => !bullet.dead);

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

function drawTiles() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = state.grid[y]?.[x];
      if (!tile) continue;
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
        ctx.fillStyle = '#b5c0c9';
        [[10,10],[38,10],[10,38],[38,38]].forEach(([ox, oy]) => {
          ctx.beginPath();
          ctx.arc(px + ox, py + oy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (tile.type === 'water') {
        ctx.fillStyle = COLORS.water;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = COLORS.waterLine;
        ctx.lineWidth = 3;
        const offset = (performance.now() / 22 + x * 11 + y * 5) % 18;
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

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life * 1.4);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
}

function drawNotice() {
  if (state.noticeTimer <= 0 || !state.notice) return;
  const alpha = Math.min(1, state.noticeTimer * 2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(5,10,15,.82)';
  ctx.fillRect(WORLD / 2 - 180, WORLD / 2 - 34, 360, 68);
  ctx.strokeStyle = '#3d5065';
  ctx.lineWidth = 2;
  ctx.strokeRect(WORLD / 2 - 180, WORLD / 2 - 34, 360, 68);
  ctx.fillStyle = '#f3f6f8';
  ctx.font = '800 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.notice, WORLD / 2, WORLD / 2);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, WORLD, WORLD);
  drawFloor();
  drawTiles();
  state.base?.draw();
  for (const bullet of state.bullets) bullet.draw();
  for (const enemy of state.enemies) enemy.draw();
  state.player?.draw();
  drawParticles();
  drawNotice();
}

function syncUI() {
  UI.score.textContent = state.score;
  if (UI.stage) UI.stage.textContent = state.stage;
  UI.wave.textContent = `${state.waveInStage}/${WAVES_PER_STAGE}`;
  UI.lives.textContent = state.lives;
  UI.baseHp.textContent = state.base?.hp ?? MAX_BASE_HP;
}

function endGame(reason) {
  state.running = false;
  state.gameOver = true;
  Object.keys(input).forEach(key => setAction(key, false));
  UI.gameOverTitle.textContent = reason;
  UI.gameOverText.textContent =
    `Skor ${state.score} • Bölüm ${state.stage} • Dalga ${state.waveInStage}/${WAVES_PER_STAGE}`;
  UI.gameOver.classList.add('show');
}

function setAction(action, on) {
  input[action] = on;
  document
    .querySelectorAll(`[data-action="${action}"]`)
    .forEach(button => button.classList.toggle('active', on));
}

window.addEventListener('keydown', event => {
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
  Object.keys(input).forEach(key => setAction(key, false));
});

document.querySelectorAll('[data-action]').forEach(button => {
  const action = button.dataset.action;

  const start = event => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    setAction(action, true);
  };

  const end = event => {
    event.preventDefault();
    setAction(action, false);
  };

  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', end);
  button.addEventListener('pointercancel', end);
  button.addEventListener('lostpointercapture', end);
});

document.querySelector('#startBtn').addEventListener('click', resetGame);
document.querySelector('#restartBtn').addEventListener('click', resetGame);

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

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
