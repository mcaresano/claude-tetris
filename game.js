'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKINS = {
  retro: {
    id: 'retro',
    name: 'Retro',
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#64b5f6', '#ffb74d', '#f0a500'],
  },
  neon: {
    id: 'neon',
    name: 'Neon',
    colors: [null, '#00e5ff', '#ffee00', '#e000ff', '#00ff85', '#ff1744', '#2979ff', '#ff9100', '#ffab00'],
  },
  pastel: {
    id: 'pastel',
    name: 'Pastel',
    colors: [null, '#b3e5fc', '#fff9c4', '#e1bee7', '#c8e6c9', '#ffcdd2', '#bbdefb', '#ffe0b2', '#ffcc80'],
  },
  pixel: {
    id: 'pixel',
    name: 'Pixel Art',
    colors: [null, '#00d8ff', '#f8d800', '#ac32ac', '#00d800', '#d80000', '#3060f0', '#f09000', '#c06000'],
  },
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Tuerca
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const pauseMenu = document.getElementById('pause-menu');
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const backBtn = document.getElementById('back-btn');
const startLevelSelect = document.getElementById('start-level-select');
const recordsListEl = document.getElementById('records-list');
const overlayRecordsListEl = document.getElementById('overlay-records-list');
const bestComboEl = document.getElementById('best-combo');
const bestLinesEl = document.getElementById('best-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const newRecordForm = document.getElementById('new-record-form');
const playerNameInput = document.getElementById('player-name');
const saveRecordBtn = document.getElementById('save-record-btn');
const skinSelect = document.getElementById('skin-select');

const THEME_KEY = 'tetris-theme';
let gridColor = '#22222e';

function refreshGridColor() {
  gridColor = getComputedStyle(document.body).getPropertyValue('--grid-color').trim();
}

function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  refreshGridColor();
  themeToggle.checked = theme === 'light';
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
});

initTheme();

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, comboThisGame, pendingRecord;

const START_LEVEL_KEY = 'tetris-start-level';
let startLevel = 1;

function initStartLevel() {
  const saved = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
  startLevel = Number.isInteger(saved) && saved >= 1 && saved <= 10 ? saved : 1;
  startLevelSelect.value = String(startLevel);
}

startLevelSelect.addEventListener('change', () => {
  startLevel = parseInt(startLevelSelect.value, 10);
  localStorage.setItem(START_LEVEL_KEY, String(startLevel));
});

initStartLevel();

const RECORDS_KEY = 'tetris-records';
const STATS_KEY = 'tetris-stats';
const MAX_RECORDS = 5;
const COMBO_NAMES = { 1: 'Simple', 2: 'Doble', 3: 'Triple', 4: 'Tetris' };

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(RECORDS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecordsToStorage(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function loadStats() {
  try {
    return Object.assign({ bestCombo: 0, maxLines: 0 }, JSON.parse(localStorage.getItem(STATS_KEY)));
  } catch {
    return { bestCombo: 0, maxLines: 0 };
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function updateStats(combo, totalLines) {
  const stats = loadStats();
  let changed = false;
  if (combo > stats.bestCombo) { stats.bestCombo = combo; changed = true; }
  if (totalLines > stats.maxLines) { stats.maxLines = totalLines; changed = true; }
  if (changed) saveStats(stats);
}

function qualifiesForRecords(s, records) {
  return s > 0 && (records.length < MAX_RECORDS || s > records[records.length - 1].score);
}

function addRecord(name, s, l, combo) {
  const records = loadRecords();
  const id = Date.now();
  records.push({ id, name: name || 'AAA', score: s, lines: l, combo });
  records.sort((a, b) => b.score - a.score);
  records.length = Math.min(records.length, MAX_RECORDS);
  saveRecordsToStorage(records);
  return id;
}

function comboLabel(n) {
  return `${COMBO_NAMES[n] || n} (${n})`;
}

function renderRecordsList(listEl, records, highlightId) {
  listEl.innerHTML = '';
  if (records.length === 0) {
    const li = document.createElement('li');
    li.className = 'records-empty';
    li.textContent = 'Sin records aún';
    listEl.appendChild(li);
    return;
  }
  records.forEach(r => {
    const li = document.createElement('li');
    if (r.id === highlightId) li.classList.add('record-highlight');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'record-name';
    nameSpan.textContent = r.name;
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'record-score';
    scoreSpan.textContent = r.score.toLocaleString();
    li.appendChild(nameSpan);
    li.appendChild(scoreSpan);
    listEl.appendChild(li);
  });
}

function renderRecordsStats() {
  const stats = loadStats();
  bestComboEl.textContent = stats.bestCombo ? comboLabel(stats.bestCombo) : '-';
  bestLinesEl.textContent = stats.maxLines || '-';
}

function renderAllRecords(highlightId) {
  const records = loadRecords();
  renderRecordsList(recordsListEl, records, highlightId);
  renderRecordsList(overlayRecordsListEl, records, highlightId);
  renderRecordsStats();
}

const SKIN_KEY = 'tetris-skin';
let currentSkin = SKINS.retro;

function applySkin(id) {
  currentSkin = SKINS[id] || SKINS.retro;
  document.body.classList.remove('skin-retro', 'skin-neon', 'skin-pastel', 'skin-pixel');
  document.body.classList.add(`skin-${currentSkin.id}`);
  skinSelect.value = currentSkin.id;
  refreshGridColor();
  if (typeof board !== 'undefined' && board) {
    draw();
    drawNext();
  }
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_KEY);
  applySkin(SKINS[saved] ? saved : 'retro');
}

skinSelect.addEventListener('change', () => {
  localStorage.setItem(SKIN_KEY, skinSelect.value);
  applySkin(skinSelect.value);
});

initSkin();

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    comboThisGame = Math.max(comboThisGame, cleared);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(255 * percent / 100);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

function drawBlockRetro(context, x, y, color, size) {
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
}

function drawBlockNeon(context, x, y, color, size) {
  const px = x * size, py = y * size;
  context.save();
  context.shadowBlur = 12;
  context.shadowColor = color;
  context.fillStyle = color;
  context.fillRect(px + 3, py + 3, size - 6, size - 6);
  context.shadowBlur = 0;
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
  context.restore();
}

function drawBlockPastel(context, x, y, color, size) {
  const px = x * size + 2, py = y * size + 2, s = size - 4, r = 6;
  context.fillStyle = color;
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(px, py, s, s, r);
  } else {
    context.moveTo(px + r, py);
    context.arcTo(px + s, py, px + s, py + s, r);
    context.arcTo(px + s, py + s, px, py + s, r);
    context.arcTo(px, py + s, px, py, r);
    context.arcTo(px, py, px + s, py, r);
    context.closePath();
  }
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.4)';
  context.beginPath();
  context.arc(px + s * 0.28, py + s * 0.28, s * 0.14, 0, Math.PI * 2);
  context.fill();
}

function drawBlockPixel(context, x, y, color, size) {
  const px = x * size, py = y * size;
  const dark = shadeColor(color, -35);
  const light = shadeColor(color, 25);
  const n = 4;
  const cell = size / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const edge = i === 0 || j === 0 || i === n - 1 || j === n - 1;
      context.fillStyle = edge ? dark : ((i + j) % 2 === 0 ? color : light);
      context.fillRect(px + i * cell, py + j * cell, cell, cell);
    }
  }
  context.strokeStyle = 'rgba(0,0,0,0.5)';
  context.lineWidth = 2;
  context.strokeRect(px + 1, py + 1, size - 2, size - 2);
}

const SKIN_DRAWERS = {
  retro: drawBlockRetro,
  neon: drawBlockNeon,
  pastel: drawBlockPastel,
  pixel: drawBlockPixel,
};

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = currentSkin.colors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  const drawer = SKIN_DRAWERS[currentSkin.id] || drawBlockRetro;
  drawer(context, x, y, color, size);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  updateStats(comboThisGame, lines);

  const records = loadRecords();
  if (qualifiesForRecords(score, records)) {
    pendingRecord = { score, lines, combo: comboThisGame };
    newRecordForm.classList.remove('hidden');
    playerNameInput.value = '';
    renderAllRecords(null);
    playerNameInput.focus();
  } else {
    pendingRecord = null;
    newRecordForm.classList.add('hidden');
    renderAllRecords(null);
  }

  overlay.classList.remove('hidden');
}

function showPauseMainView() {
  pauseControls.classList.add('hidden');
  pauseMain.classList.remove('hidden');
}

function openPauseMenu() {
  paused = true;
  cancelAnimationFrame(animId);
  startLevelSelect.value = String(startLevel);
  showPauseMainView();
  pauseMenu.classList.remove('hidden');
}

function closePauseMenu() {
  paused = false;
  pauseMenu.classList.add('hidden');
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function togglePause() {
  if (gameOver) return;
  if (paused) {
    if (!pauseControls.classList.contains('hidden')) {
      showPauseMainView();
      return;
    }
    closePauseMenu();
  } else {
    openPauseMenu();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  comboThisGame = 0;
  pendingRecord = null;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  newRecordForm.classList.add('hidden');
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  renderAllRecords(null);
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (document.activeElement === playerNameInput) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

resumeBtn.addEventListener('click', closePauseMenu);
pauseRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => {
  pauseMain.classList.add('hidden');
  pauseControls.classList.remove('hidden');
});
backBtn.addEventListener('click', showPauseMainView);

saveRecordBtn.addEventListener('click', () => {
  if (!pendingRecord) return;
  const name = (playerNameInput.value || '').trim().slice(0, 10).toUpperCase() || 'AAA';
  const id = addRecord(name, pendingRecord.score, pendingRecord.lines, pendingRecord.combo);
  pendingRecord = null;
  newRecordForm.classList.add('hidden');
  renderAllRecords(id);
});

playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveRecordBtn.click();
});

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los records?')) return;
  localStorage.removeItem(RECORDS_KEY);
  localStorage.removeItem(STATS_KEY);
  renderAllRecords(null);
});

init();
