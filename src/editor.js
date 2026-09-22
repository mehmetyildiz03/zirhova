import {
  LEVEL_SIZE,
  TERRAIN_KEYS,
  coordKey,
  normalizeCustomLevel,
  validateCustomLevel,
} from './levelSchema.js';

const STORAGE_KEY = 'zirhova-custom-level-v1';
const canvas = document.querySelector('#editorCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const UI = {
  palette: document.querySelector('#palette'),
  levelName: document.querySelector('#levelName'),
  statusTitle: document.querySelector('#statusTitle'),
  statusText: document.querySelector('#statusText'),
  undo: document.querySelector('#undoBtn'),
  redo: document.querySelector('#redoBtn'),
  save: document.querySelector('#saveBtn'),
  play: document.querySelector('#playBtn'),
  reset: document.querySelector('#resetBtn'),
  json: document.querySelector('#jsonBox'),
  export: document.querySelector('#exportBtn'),
  copy: document.querySelector('#copyBtn'),
  import: document.querySelector('#importBtn'),
};

const TILE = canvas.width / LEVEL_SIZE;
const TOOL_TO_KEY = {
  brick: 'bricks',
  steel: 'steel',
  breakableSteel: 'breakableSteel',
  water: 'water',
  ice: 'ice',
  brush: 'brush',
};

const COLORS = {
  floorA: '#111a22',
  floorB: '#0d161e',
  grid: '#22313f',
  brick: '#9a5f3c',
  brickLight: '#c18055',
  steel: '#5b6976',
  tactical: '#66788a',
  tacticalMark: '#d9b36b',
  water: '#17465f',
  waterLine: '#2c7797',
  ice: '#9dd8e8',
  brush: '#2a5f44',
  player: '#e8d35b',
  base: '#75c7a0',
  enemy: '#dd6758',
};

function defaultLevel() {
  return normalizeCustomLevel({
    id: 'ozel-harita',
    name: 'ÖZEL HARİTA',
    playerSpawn: [5, 14],
    baseSpawn: [7, 15],
    enemySpawns: [[0, 0], [7, 0], [15, 0]],
    bricks: [],
    steel: [],
    breakableSteel: [],
    water: [],
    ice: [],
    brush: [],
  });
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeCustomLevel(JSON.parse(raw)) : defaultLevel();
  } catch {
    return defaultLevel();
  }
}

let level = loadStored();
let selectedTool = 'brick';
let history = [serialize(level)];
let historyIndex = 0;
let pointerId = null;
let dragChanged = false;
let touchedCells = new Set();

UI.levelName.value = level.name;

function serialize(value) {
  return JSON.stringify(normalizeCustomLevel(value));
}

function cloneLevel(value) {
  return normalizeCustomLevel(JSON.parse(JSON.stringify(value)));
}

function setStatus(title, text, tone = 'normal') {
  UI.statusTitle.textContent = title;
  UI.statusText.textContent = text;
  UI.statusTitle.style.color =
    tone === 'error' ? '#ff9e9e' :
    tone === 'ok' ? '#8be0ae' :
    '#e6d35a';
}

function refreshStatus() {
  const result = validateCustomLevel(level);
  if (result.ok) {
    setStatus(
      'HARİTA GEÇERLİ',
      `${level.enemySpawns.length} düşman girişi · kayıt/oyun için hazır.`,
      'ok'
    );
  } else {
    setStatus('DÜZELTME GEREKİYOR', result.errors[0], 'error');
  }
  UI.undo.disabled = historyIndex <= 0;
  UI.redo.disabled = historyIndex >= history.length - 1;
  return result;
}

function recordHistory() {
  const snap = serialize(level);
  if (snap === history[historyIndex]) return;
  history = history.slice(0, historyIndex + 1);
  history.push(snap);
  historyIndex = history.length - 1;
  refreshStatus();
}

function restoreHistory(index) {
  if (index < 0 || index >= history.length) return;
  historyIndex = index;
  level = normalizeCustomLevel(JSON.parse(history[historyIndex]));
  UI.levelName.value = level.name;
  draw();
  refreshStatus();
}

function terrainAt(x, y) {
  const target = `${x},${y}`;
  for (const key of TERRAIN_KEYS) {
    if (level[key].some(coord => coordKey(coord) === target)) return key;
  }
  return null;
}

function removeTerrainAt(x, y) {
  const target = `${x},${y}`;
  let changed = false;

  for (const key of TERRAIN_KEYS) {
    const before = level[key].length;
    level[key] = level[key].filter(coord => coordKey(coord) !== target);
    if (level[key].length !== before) changed = true;
  }
  return changed;
}

function removeEnemyAt(x, y) {
  const target = `${x},${y}`;
  const before = level.enemySpawns.length;
  level.enemySpawns = level.enemySpawns.filter(coord => coordKey(coord) !== target);
  return level.enemySpawns.length !== before;
}

function sameCoord(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function isUniqueSpawn(x, y) {
  const coord = [x, y];
  return sameCoord(level.playerSpawn, coord) || sameCoord(level.baseSpawn, coord);
}

function placeTool(x, y, tool) {
  const before = serialize(level);
  const coord = [x, y];

  if (TOOL_TO_KEY[tool]) {
    if (isUniqueSpawn(x, y)) {
      setStatus('KORUNAN KARE', 'Oyuncu veya üs karesine arazi yerleştirilemez.', 'error');
      return false;
    }

    removeTerrainAt(x, y);
    removeEnemyAt(x, y);
    level[TOOL_TO_KEY[tool]].push(coord);
  } else if (tool === 'erase') {
    removeTerrainAt(x, y);
    removeEnemyAt(x, y);
  } else if (tool === 'player') {
    if (sameCoord(level.baseSpawn, coord)) {
      setStatus('KORUNAN KARE', 'Oyuncu başlangıcı üs ile aynı karede olamaz.', 'error');
      return false;
    }
    removeTerrainAt(x, y);
    removeEnemyAt(x, y);
    level.playerSpawn = coord;
  } else if (tool === 'base') {
    if (sameCoord(level.playerSpawn, coord)) {
      setStatus('KORUNAN KARE', 'Üs oyuncu başlangıcı ile aynı karede olamaz.', 'error');
      return false;
    }
    removeTerrainAt(x, y);
    removeEnemyAt(x, y);
    level.baseSpawn = coord;
  } else if (tool === 'enemy') {
    if (isUniqueSpawn(x, y)) {
      setStatus('KORUNAN KARE', 'Düşman girişi oyuncu veya üs karesine konamaz.', 'error');
      return false;
    }

    const exists = level.enemySpawns.some(item => sameCoord(item, coord));
    if (exists) {
      removeEnemyAt(x, y);
    } else {
      if (level.enemySpawns.length >= 4) {
        setStatus('SINIR', 'En fazla 4 düşman başlangıç noktası kullanılabilir.', 'error');
        return false;
      }
      removeTerrainAt(x, y);
      level.enemySpawns.push(coord);
    }
  }

  const changed = before !== serialize(level);
  if (changed) draw();
  return changed;
}

function cellFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const px = (event.clientX - rect.left) * (canvas.width / rect.width);
  const py = (event.clientY - rect.top) * (canvas.height / rect.height);
  return {
    x: Math.max(0, Math.min(LEVEL_SIZE - 1, Math.floor(px / TILE))),
    y: Math.max(0, Math.min(LEVEL_SIZE - 1, Math.floor(py / TILE))),
  };
}

function applyPointer(event) {
  const { x, y } = cellFromEvent(event);
  const key = `${x},${y}`;
  if (touchedCells.has(key)) return;
  touchedCells.add(key);

  const dragTool = Boolean(TOOL_TO_KEY[selectedTool]) || selectedTool === 'erase';
  if (!dragTool && touchedCells.size > 1) return;

  if (placeTool(x, y, selectedTool)) dragChanged = true;
}

canvas.addEventListener('pointerdown', event => {
  event.preventDefault();
  if (pointerId !== null) return;

  pointerId = event.pointerId;
  dragChanged = false;
  touchedCells = new Set();
  canvas.setPointerCapture?.(event.pointerId);
  applyPointer(event);
});

canvas.addEventListener('pointermove', event => {
  if (pointerId !== event.pointerId) return;
  event.preventDefault();
  applyPointer(event);
});

function endPointer(event) {
  if (pointerId !== event.pointerId) return;
  event.preventDefault();
  pointerId = null;
  touchedCells = new Set();
  if (dragChanged) recordHistory();
  else refreshStatus();
  dragChanged = false;
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('lostpointercapture', endPointer);
canvas.addEventListener('contextmenu', event => event.preventDefault());

UI.palette.addEventListener('click', event => {
  const button = event.target.closest('[data-tool]');
  if (!button) return;

  selectedTool = button.dataset.tool;
  UI.palette.querySelectorAll('[data-tool]').forEach(item => {
    item.classList.toggle('selected', item === button);
  });
  setStatus('ARAÇ SEÇİLDİ', button.textContent.trim());
});

UI.levelName.addEventListener('change', () => {
  level.name = UI.levelName.value.trim() || 'ÖZEL HARİTA';
  level.id = level.name
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'ozel-harita';
  UI.levelName.value = level.name;
  recordHistory();
});

UI.undo.addEventListener('click', () => restoreHistory(historyIndex - 1));
UI.redo.addEventListener('click', () => restoreHistory(historyIndex + 1));

UI.save.addEventListener('click', () => {
  const result = validateCustomLevel(level);
  if (!result.ok) {
    setStatus('KAYDEDİLMEDİ', result.errors[0], 'error');
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(result.level));
  setStatus('KAYDEDİLDİ', 'Özel harita bu cihazda saklandı.', 'ok');
});

UI.play.addEventListener('click', () => {
  const result = validateCustomLevel(level);
  if (!result.ok) {
    setStatus('OYUN BAŞLATILAMADI', result.errors[0], 'error');
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(result.level));
  window.location.href = './?custom=1';
});

UI.reset.addEventListener('click', () => {
  const confirmed = window.confirm('Haritayı temizlemek istediğine emin misin?');
  if (!confirmed) return;

  level = defaultLevel();
  UI.levelName.value = level.name;
  draw();
  recordHistory();
  setStatus('TEMİZLENDİ', 'Başlangıç noktaları korunarak boş harita oluşturuldu.', 'ok');
});

UI.export.addEventListener('click', () => {
  const result = validateCustomLevel(level);
  if (!result.ok) {
    setStatus('JSON OLUŞTURULAMADI', result.errors[0], 'error');
    return;
  }

  UI.json.value = JSON.stringify(result.level, null, 2);
  setStatus('JSON HAZIR', 'Metni kopyalayabilir veya başka cihazda içe aktarabilirsin.', 'ok');
});

UI.copy.addEventListener('click', async () => {
  if (!UI.json.value.trim()) UI.export.click();
  if (!UI.json.value.trim()) return;

  try {
    await navigator.clipboard.writeText(UI.json.value);
    setStatus('KOPYALANDI', 'Harita JSON verisi panoya kopyalandı.', 'ok');
  } catch {
    UI.json.focus();
    UI.json.select();
    setStatus('SEÇİLDİ', 'Tarayıcı otomatik kopyalayamadı; seçili metni kopyalayabilirsin.');
  }
});

UI.import.addEventListener('click', () => {
  try {
    const parsed = JSON.parse(UI.json.value);
    const result = validateCustomLevel(parsed);

    if (!result.ok) {
      setStatus('İÇE AKTARILAMADI', result.errors[0], 'error');
      return;
    }

    level = cloneLevel(result.level);
    UI.levelName.value = level.name;
    draw();
    recordHistory();
    setStatus('İÇE AKTARILDI', 'Harita doğrulandı ve editöre yüklendi.', 'ok');
  } catch {
    setStatus('JSON HATASI', 'Geçerli bir ZIRHOVA harita JSON verisi gir.', 'error');
  }
});

function drawFloor() {
  for (let y = 0; y < LEVEL_SIZE; y++) {
    for (let x = 0; x < LEVEL_SIZE; x++) {
      ctx.fillStyle = (x + y) % 2 ? COLORS.floorA : COLORS.floorB;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
}

function drawTerrainCell(type, x, y) {
  const px = x * TILE;
  const py = y * TILE;

  if (type === 'bricks') {
    ctx.fillStyle = COLORS.brick;
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = COLORS.brickLight;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        ctx.fillRect(px + 5 + col * 11, py + 6 + row * 11, 7, 4);
      }
    }
  } else if (type === 'steel' || type === 'breakableSteel') {
    ctx.fillStyle = type === 'breakableSteel' ? COLORS.tactical : COLORS.steel;
    ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
    ctx.strokeStyle = '#aab8c5';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 8, py + 8, TILE - 16, TILE - 16);

    if (type === 'breakableSteel') {
      ctx.strokeStyle = COLORS.tacticalMark;
      ctx.beginPath();
      ctx.moveTo(px + 10, py + 12);
      ctx.lineTo(px + 23, py + 25);
      ctx.lineTo(px + 17, py + 37);
      ctx.moveTo(px + 38, py + 10);
      ctx.lineTo(px + 28, py + 22);
      ctx.lineTo(px + 37, py + 37);
      ctx.stroke();
    }
  } else if (type === 'water') {
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.strokeStyle = COLORS.waterLine;
    ctx.lineWidth = 3;
    for (let i = 10; i < TILE; i += 13) {
      ctx.beginPath();
      ctx.moveTo(px + 4, py + i);
      ctx.lineTo(px + TILE - 4, py + i);
      ctx.stroke();
    }
  } else if (type === 'ice') {
    ctx.fillStyle = COLORS.ice;
    ctx.globalAlpha = .82;
    ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#e9fbff';
    ctx.beginPath();
    ctx.moveTo(px + 7, py + 35);
    ctx.lineTo(px + 19, py + 22);
    ctx.lineTo(px + 29, py + 27);
    ctx.lineTo(px + 41, py + 11);
    ctx.stroke();
  } else if (type === 'brush') {
    ctx.fillStyle = COLORS.brush;
    ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = '#4a835f';
    for (let i = 0; i < 7; i++) {
      const ox = 7 + ((i * 17 + x * 4) % 34);
      const oy = 7 + ((i * 11 + y * 7) % 34);
      ctx.beginPath();
      ctx.arc(px + ox, py + oy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawMarker([x, y], label, color) {
  const cx = x * TILE + TILE / 2;
  const cy = y * TILE + TILE / 2;

  ctx.fillStyle = 'rgba(5,10,15,.82)';
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = '900 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy + 1);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawFloor();

  for (const key of TERRAIN_KEYS) {
    for (const [x, y] of level[key]) drawTerrainCell(key, x, y);
  }

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= LEVEL_SIZE; i++) {
    const p = i * TILE + .5;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(canvas.width, p);
    ctx.stroke();
  }

  drawMarker(level.baseSpawn, 'Ü', COLORS.base);
  drawMarker(level.playerSpawn, 'O', COLORS.player);
  level.enemySpawns.forEach(coord => drawMarker(coord, 'D', COLORS.enemy));
}

draw();
refreshStatus();
