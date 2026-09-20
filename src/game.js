const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const UI = {
  score: document.querySelector('#score'),
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
  up: { x: 0, y: -1, a: -Math.PI / 2 },
  down: { x: 0, y: 1, a: Math.PI / 2 },
  left: { x: -1, y: 0, a: Math.PI },
  right: { x: 1, y: 0, a: 0 },
};

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

class RectEntity {
  constructor(x, y, w, h) { Object.assign(this, { x, y, w, h, dead: false }); }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
}

class Tank extends RectEntity {
  constructor(x, y, team, elite = false) {
    super(x, y, 34, 34);
    this.team = team;
    this.elite = elite;
    this.dir = team === 'player' ? 'up' : 'down';
    this.speed = team === 'player' ? 150 : (elite ? 102 : 82);
    this.fireCooldown = 0;
    this.aiClock = 0;
    this.hp = elite ? 3 : 1;
    this.spawnShield = team === 'player' ? 1.6 : 0.6;
  }

  update(dt) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.spawnShield = Math.max(0, this.spawnShield - dt);
    if (this.team === 'player') this.updatePlayer(dt);
    else this.updateAI(dt);
  }

  updatePlayer(dt) {
    let dx = 0, dy = 0;
    if (input.up) { dy = -1; this.dir = 'up'; }
    else if (input.down) { dy = 1; this.dir = 'down'; }
    else if (input.left) { dx = -1; this.dir = 'left'; }
    else if (input.right) { dx = 1; this.dir = 'right'; }
    this.move(dx * this.speed * dt, dy * this.speed * dt);
    if (input.fire) this.shoot();
  }

  updateAI(dt) {
    this.aiClock -= dt;
    if (this.aiClock <= 0) {
      this.aiClock = 0.45 + Math.random() * 1.1;
      const baseBias = Math.random() < 0.46;
      const target = baseBias ? state.base : state.player;
      const dx = target.cx - this.cx;
      const dy = target.cy - this.cy;
      if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? 'right' : 'left';
      else this.dir = dy > 0 ? 'down' : 'up';
      if (Math.random() < 0.26) this.dir = ['up','down','left','right'][Math.floor(Math.random() * 4)];
    }
    const d = DIRS[this.dir];
    const moved = this.move(d.x * this.speed * dt, d.y * this.speed * dt);
    if (!moved && Math.random() < 0.14) {
      this.dir = ['up','down','left','right'][Math.floor(Math.random() * 4)];
    }
    const alignX = Math.abs(this.cx - state.player.cx) < TILE * 0.65 || Math.abs(this.cx - state.base.cx) < TILE * 0.65;
    const alignY = Math.abs(this.cy - state.player.cy) < TILE * 0.65 || Math.abs(this.cy - state.base.cy) < TILE * 0.65;
    if ((alignX || alignY || Math.random() < 0.018) && this.fireCooldown <= 0) this.shoot();
  }

  move(dx, dy) {
    if (!dx && !dy) return true;
    const ox = this.x, oy = this.y;
    this.x += dx;
    if (blocked(this, this.team)) this.x = ox;
    this.y += dy;
    if (blocked(this, this.team)) this.y = oy;
    this.x = clamp(this.x, 2, WORLD - this.w - 2);
    this.y = clamp(this.y, 2, WORLD - this.h - 2);
    return Math.abs(this.x - ox) + Math.abs(this.y - oy) > 0.01;
  }

  shoot() {
    if (this.fireCooldown > 0 || this.dead) return;
    const d = DIRS[this.dir];
    const bullet = new Bullet(this.cx + d.x * 23 - 4, this.cy + d.y * 23 - 4, d.x, d.y, this.team, this.elite);
    state.bullets.push(bullet);
    this.fireCooldown = this.team === 'player' ? 0.28 : (this.elite ? 0.58 : 0.9 + Math.random() * 0.5);
    tone(this.team === 'player' ? 390 : 220, 0.035, 'square', 0.025);
  }

  hit(damage = 1) {
    if (this.spawnShield > 0) return;
    this.hp -= damage;
    this.spawnShield = 0.22;
    tone(this.team === 'player' ? 130 : 170, 0.09, 'sawtooth', 0.035);
    if (this.hp <= 0) this.dead = true;
  }

  draw() {
    const color = this.team === 'player' ? COLORS.player : (this.elite ? COLORS.enemyElite : COLORS.enemy);
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
      ctx.strokeStyle = `rgba(220,245,255,${0.25 + 0.45 * Math.sin(performance.now()/70) ** 2})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  }
}

class Bullet extends RectEntity {
  constructor(x, y, dx, dy, team, strong = false) {
    super(x, y, 8, 8);
    Object.assign(this, { dx, dy, team, strong, speed: strong ? 420 : 390 });
  }
  update(dt) {
    this.x += this.dx * this.speed * dt;
    this.y += this.dy * this.speed * dt;
    if (this.x < -10 || this.y < -10 || this.x > WORLD + 10 || this.y > WORLD + 10) { this.dead = true; return; }

    const tile = tileAt(this.cx, this.cy);
    if (tile && tile.type !== 'floor' && tile.type !== 'water') {
      if (tile.type === 'brick') {
        tile.hp -= this.strong ? 2 : 1;
        if (tile.hp <= 0) tile.type = 'floor';
      }
      this.dead = true;
      tone(95, 0.045, 'square', 0.02);
      return;
    }

    if (this.team === 'player') {
      for (const enemy of state.enemies) {
        if (!enemy.dead && hit(this, enemy)) { enemy.hit(this.strong ? 2 : 1); this.dead = true; break; }
      }
    } else {
      if (state.player && !state.player.dead && hit(this, state.player)) { state.player.hit(); this.dead = true; return; }
      if (state.base && hit(this, state.base)) { this.dead = true; damageBase(); }
    }
  }
  draw() {
    ctx.fillStyle = this.strong ? '#ffffff' : COLORS.bullet;
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}

class Base extends RectEntity {
  constructor(x, y) { super(x, y, 42, 42); this.hp = 5; }
  draw() {
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.fillStyle = COLORS.base;
    ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(20,0); ctx.lineTo(0,20); ctx.lineTo(-20,0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLORS.baseCore;
    ctx.fillRect(-8,-8,16,16);
    ctx.strokeStyle = '#1f4c3a'; ctx.lineWidth = 4; ctx.strokeRect(-12,-12,24,24);
    ctx.restore();
  }
}

function makeTile(type = 'floor') { return { type, hp: type === 'brick' ? 2 : 999 }; }

function buildMap() {
  const grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => makeTile('floor')));
  const brick = (x,y) => grid[y][x] = makeTile('brick');
  const steel = (x,y) => grid[y][x] = makeTile('steel');
  const water = (x,y) => grid[y][x] = makeTile('water');

  // Özgün, asimetrik prototip haritası. Herhangi bir klasik oyunun bölüm dizilimini kopyalamaz.
  [[2,3],[3,3],[4,3],[11,3],[12,3],[13,3],[5,5],[6,5],[9,5],[10,5],[3,8],[4,8],[11,8],[12,8],[6,10],[9,10],[5,12],[10,12]].forEach(([x,y]) => brick(x,y));
  [[2,4],[13,4],[7,6],[8,6],[7,9],[8,9],[4,11],[11,11]].forEach(([x,y]) => steel(x,y));
  [[1,7],[2,7],[13,7],[14,7],[6,3],[7,3],[8,3],[9,3]].forEach(([x,y]) => water(x,y));

  // Üs çevresinde özgün kalkan hattı
  [[6,14],[7,14],[8,14],[9,14],[6,13],[9,13]].forEach(([x,y]) => brick(x,y));
  // Spawn koridorlarını açık bırak
  [0,1,2,13,14,15].forEach(x => { grid[0][x] = makeTile('floor'); grid[1][x] = makeTile('floor'); });
  return grid;
}

const state = {
  running: false,
  gameOver: false,
  score: 0,
  wave: 1,
  lives: 3,
  grid: buildMap(),
  player: null,
  base: null,
  enemies: [],
  bullets: [],
  particles: [],
  waveTimer: 0,
};

function resetGame() {
  Object.assign(state, {
    running: true,
    gameOver: false,
    score: 0,
    wave: 1,
    lives: 3,
    grid: buildMap(),
    enemies: [],
    bullets: [],
    particles: [],
    waveTimer: 0,
  });
  state.base = new Base(WORLD / 2 - 21, WORLD - 58);
  state.player = new Tank(WORLD / 2 - 100, WORLD - 86, 'player');
  spawnWave();
  syncUI();
  UI.gameOver.classList.remove('show');
  UI.intro.classList.remove('show');
}

function spawnWave() {
  const count = Math.min(4 + state.wave, 12);
  const spawnXs = [24, WORLD / 2 - 17, WORLD - 58];
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      if (!state.running) return;
      const x = spawnXs[i % spawnXs.length];
      const elite = state.wave >= 3 && (i === count - 1 || Math.random() < Math.min(0.1 + state.wave * 0.025, 0.28));
      state.enemies.push(new Tank(x, 18 + (i % 2) * 5, 'enemy', elite));
    }, i * 420);
  }
}

function advanceWaveIfNeeded(dt) {
  if (state.enemies.some(e => !e.dead)) { state.waveTimer = 0; return; }
  state.waveTimer += dt;
  if (state.waveTimer > 1.1) {
    state.wave++;
    state.waveTimer = 0;
    tone(640, 0.08, 'square', 0.03);
    setTimeout(() => tone(780, 0.08, 'square', 0.025), 90);
    spawnWave();
    syncUI();
  }
}

function damageBase() {
  state.base.hp--;
  tone(72, 0.14, 'sawtooth', 0.05);
  syncUI();
  if (state.base.hp <= 0) endGame('Üs çekirdeği yok edildi');
}

function handleDeaths() {
  for (const enemy of state.enemies) {
    if (enemy.dead && !enemy.scored) {
      enemy.scored = true;
      state.score += enemy.elite ? 350 : 100;
      burst(enemy.cx, enemy.cy, enemy.elite ? '#d28eff' : '#dc6656');
      syncUI();
    }
  }
  state.enemies = state.enemies.filter(e => !e.dead || !e.scoredDone);
  for (const e of state.enemies) if (e.scored) e.scoredDone = true;
  state.enemies = state.enemies.filter(e => !e.scoredDone);

  if (state.player.dead) {
    burst(state.player.cx, state.player.cy, '#e6d35a');
    state.lives--;
    syncUI();
    if (state.lives <= 0) endGame('Son tank da kaybedildi');
    else state.player = new Tank(WORLD / 2 - 100, WORLD - 86, 'player');
  }
}

function burst(x, y, color) {
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 50 + Math.random() * 110;
    state.particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: .55 + Math.random()*.35, color });
  }
}

function updateParticles(dt) {
  for (const p of state.particles) { p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt; p.vx *= .97; p.vy *= .97; }
  state.particles = state.particles.filter(p => p.life > 0);
}

function blocked(entity, team) {
  const points = [
    [entity.x+3, entity.y+3], [entity.x+entity.w-3, entity.y+3],
    [entity.x+3, entity.y+entity.h-3], [entity.x+entity.w-3, entity.y+entity.h-3],
  ];
  for (const [x,y] of points) {
    const tile = tileAt(x,y);
    if (tile && tile.type !== 'floor') return true;
  }
  if (state.base && entity !== state.base && hit(entity, state.base)) return true;
  const tanks = [state.player, ...state.enemies];
  for (const other of tanks) {
    if (!other || other === entity || other.dead) continue;
    if (hit(entity, other)) return true;
  }
  return false;
}

function tileAt(x,y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return null;
  return state.grid[ty][tx];
}

function hit(a,b) { return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }

function update(dt) {
  if (!state.running) return;
  state.player.update(dt);
  for (const enemy of state.enemies) enemy.update(dt);
  for (const bullet of state.bullets) bullet.update(dt);
  state.bullets = state.bullets.filter(b => !b.dead);
  updateParticles(dt);
  handleDeaths();
  advanceWaveIfNeeded(dt);
}

function drawFloor() {
  for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) {
    ctx.fillStyle = (x+y)%2 ? COLORS.floorA : COLORS.floorB;
    ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
    ctx.strokeStyle = COLORS.grid;
    ctx.strokeRect(x*TILE+.5,y*TILE+.5,TILE-1,TILE-1);
  }
}

function drawTiles() {
  for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) {
    const t = state.grid[y][x];
    const px=x*TILE, py=y*TILE;
    if (t.type === 'brick') {
      ctx.fillStyle = COLORS.brick; ctx.fillRect(px+3,py+3,TILE-6,TILE-6);
      ctx.fillStyle = COLORS.brickLight;
      for (let r=0;r<3;r++) for (let c=0;c<2;c++) ctx.fillRect(px+6+c*19+(r%2)*7, py+7+r*13, 14, 7);
      if (t.hp === 1) { ctx.strokeStyle='#2e1710';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(px+6,py+8);ctx.lineTo(px+38,py+40);ctx.stroke(); }
    } else if (t.type === 'steel') {
      ctx.fillStyle = COLORS.steel; ctx.fillRect(px+4,py+4,TILE-8,TILE-8);
      ctx.strokeStyle = COLORS.steelLight; ctx.lineWidth=2; ctx.strokeRect(px+7,py+7,TILE-14,TILE-14);
      ctx.fillStyle = '#b5c0c9'; [[10,10],[38,10],[10,38],[38,38]].forEach(([ox,oy])=>{ctx.beginPath();ctx.arc(px+ox,py+oy,2.2,0,Math.PI*2);ctx.fill();});
    } else if (t.type === 'water') {
      ctx.fillStyle = COLORS.water; ctx.fillRect(px,py,TILE,TILE);
      ctx.strokeStyle = COLORS.waterLine; ctx.lineWidth=3;
      const o = (performance.now()/22 + x*11 + y*5)%18;
      for(let ly=-18;ly<TILE+18;ly+=18){ctx.beginPath();ctx.moveTo(px,py+ly+o);ctx.lineTo(px+TILE,py+ly+o);ctx.stroke();}
    }
  }
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0,p.life*1.4); ctx.fillStyle=p.color; ctx.fillRect(p.x-3,p.y-3,6,6);
  }
  ctx.globalAlpha=1;
}

function draw() {
  ctx.clearRect(0,0,WORLD,WORLD);
  drawFloor();
  drawTiles();
  state.base?.draw();
  for (const bullet of state.bullets) bullet.draw();
  for (const enemy of state.enemies) enemy.draw();
  state.player?.draw();
  drawParticles();
}

function syncUI() {
  UI.score.textContent = state.score;
  UI.wave.textContent = state.wave;
  UI.lives.textContent = state.lives;
  UI.baseHp.textContent = state.base?.hp ?? 5;
}

function endGame(reason) {
  state.running = false;
  state.gameOver = true;
  UI.gameOverTitle.textContent = reason;
  UI.gameOverText.textContent = `Skor ${state.score} • Ulaşılan dalga ${state.wave}`;
  UI.gameOver.classList.add('show');
}

function setAction(action, on) {
  input[action] = on;
  document.querySelectorAll(`[data-action="${action}"]`).forEach(b => b.classList.toggle('active', on));
}

window.addEventListener('keydown', (e) => {
  const action = keyMap.get(e.code);
  if (!action) return;
  e.preventDefault();
  setAction(action, true);
});
window.addEventListener('keyup', (e) => {
  const action = keyMap.get(e.code);
  if (!action) return;
  e.preventDefault();
  setAction(action, false);
});
window.addEventListener('blur', () => Object.keys(input).forEach(k => setAction(k,false)));

document.querySelectorAll('[data-action]').forEach(btn => {
  const action = btn.dataset.action;
  const start = (e) => { e.preventDefault(); btn.setPointerCapture?.(e.pointerId); setAction(action,true); };
  const end = (e) => { e.preventDefault(); setAction(action,false); };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', end);
  btn.addEventListener('pointercancel', end);
  btn.addEventListener('pointerleave', (e) => { if (e.buttons === 0) end(e); });
});

document.querySelector('#startBtn').addEventListener('click', resetGame);
document.querySelector('#restartBtn').addEventListener('click', resetGame);

let last = performance.now();
function frame(now) {
  const dt = Math.min((now-last)/1000, 0.033);
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

  window.addEventListener('beforeinstallprompt', (event) => {
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

syncUI();
