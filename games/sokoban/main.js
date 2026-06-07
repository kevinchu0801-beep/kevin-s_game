const LEVELS = [
  [
    "WWWWWW",
    "W    W",
    "W .@ W",
    "W $. W",
    "W    W",
    "WWWWWW",
  ],
  [
    "WWWWWWW",
    "W     W",
    "W .$. W",
    "W $@. W",
    "W .$. W",
    "W     W",
    "WWWWWWW",
  ],
  [
    "WWWWWWW",
    "W   W W",
    "W $.$ W",
    "W W@W W",
    "W .$. W",
    "W   W W",
    "WWWWWWW",
  ],
  [
    "WWWWWWWW",
    "W   W  W",
    "W $ .$ W",
    "W . W .W",
    "W $ @$ W",
    "W . $. W",
    "W   W  W",
    "WWWWWWWW",
  ],
  [
    "WWWWWWWWW",
    "W   W   W",
    "W $ .$  W",
    "W . W . WW",
    "W $ @$ W W",
    "W . $. . W",
    "W   W $ W W",
    "W   .$   W",
    "WWWWWWWWW",
  ],
];

const boardEl = document.getElementById("gameBoard");
const stepsEl = document.getElementById("steps");
const levelLabelEl = document.getElementById("levelLabel");
const statusTextEl = document.getElementById("statusText");
const winMessageEl = document.getElementById("winMessage");
const finalStepsEl = document.getElementById("finalSteps");
const soundBtn = document.getElementById("soundBtn");
const undoBtn = document.getElementById("undoBtn");
const restartBtn = document.getElementById("restartBtn");
const winRestartBtn = document.getElementById("winRestartBtn");
const nextLevelBtn = document.getElementById("nextLevelBtn");

const AUDIO_KEY = "sokoban-audio-enabled";

let currentLevel = 0;
let gameMap = [];
let playerPos = { x: 0, y: 0 };
let steps = 0;
let history = [];
let audioCtx = null;
let isMuted = readAudioSetting();

function normalizeLevel(level) {
  const width = Math.max(...level.map((row) => row.length));
  return level.map((row) => row.padEnd(width, " ").split(""));
}

function cloneMap(map) {
  return map.map((row) => [...row]);
}

function snapshot() {
  return {
    gameMap: cloneMap(gameMap),
    playerPos: { ...playerPos },
    steps,
  };
}

function restore(snapshotState) {
  gameMap = cloneMap(snapshotState.gameMap);
  playerPos = { ...snapshotState.playerPos };
  steps = snapshotState.steps;
}

function getCell(x, y) {
  if (y < 0 || y >= gameMap.length) return "W";
  if (x < 0 || x >= gameMap[y].length) return "W";
  return gameMap[y][x] || " ";
}

function setCell(x, y, value) {
  if (y < 0 || y >= gameMap.length) return;
  if (x < 0 || x >= gameMap[y].length) return;
  gameMap[y][x] = value;
}

function updateStatus(message) {
  statusTextEl.textContent = message;
}

function readAudioSetting() {
  try {
    return window.localStorage.getItem(AUDIO_KEY) !== "1";
  } catch {
    return true;
  }
}

function writeAudioSetting() {
  try {
    window.localStorage.setItem(AUDIO_KEY, isMuted ? "0" : "1");
  } catch {
    // Ignore storage failures in restricted browsers or file:// contexts.
  }
}

function ensureAudioContext() {
  if (isMuted) return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(frequency, duration, type = "sine", gain = 0.04, endFrequency = null) {
  const context = ensureAudioContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const volume = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  if (endFrequency !== null) {
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, context.currentTime + duration);
  }
  volume.gain.setValueAtTime(gain, context.currentTime);
  volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  oscillator.connect(volume);
  volume.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

function playStepSound() {
  playTone(480, 0.05, "triangle", 0.025, 620);
}

function playBlockedSound() {
  playTone(180, 0.09, "square", 0.03, 150);
}

function playWinSound() {
  playTone(523, 0.08, "sine", 0.035, 784);
  window.setTimeout(() => playTone(659, 0.08, "sine", 0.03, 988), 80);
}

function setSoundButton() {
  soundBtn.textContent = `音效：${isMuted ? "关" : "开"}`;
  soundBtn.setAttribute("aria-pressed", String(!isMuted));
}

function updateHud() {
  stepsEl.textContent = String(steps);
  levelLabelEl.textContent = `${currentLevel + 1}/${LEVELS.length}`;
  undoBtn.disabled = history.length === 0;
  nextLevelBtn.textContent = currentLevel === LEVELS.length - 1 ? "回到第一关" : "下一关";

  document.querySelectorAll(".level-btn").forEach((button) => {
    const level = Number(button.dataset.level);
    button.classList.toggle("active", level === currentLevel);
  });
}

function loadLevel(levelIndex) {
  currentLevel = levelIndex;
  gameMap = normalizeLevel(LEVELS[levelIndex]);
  playerPos = { x: 0, y: 0 };
  steps = 0;
  history = [];
  winMessageEl.classList.add("hidden");

  for (let y = 0; y < gameMap.length; y += 1) {
    for (let x = 0; x < gameMap[y].length; x += 1) {
      if (gameMap[y][x] === "@") {
        playerPos = { x, y };
        gameMap[y][x] = " ";
      }
      if (gameMap[y][x] === "+") {
        playerPos = { x, y };
        gameMap[y][x] = ".";
      }
    }
  }

  updateStatus("把所有方块推到目标点");
  updateHud();
  render();
}

function cellLabel(cell, isPlayer) {
  if (isPlayer) return cell === "." ? "玩家在目标点" : "玩家";
  if (cell === "W") return "墙";
  if (cell === ".") return "目标";
  if (cell === "$") return "方块";
  if (cell === "*") return "方块在目标点";
  return "地面";
}

function render() {
  const cols = gameMap[0]?.length || 0;
  boardEl.style.setProperty("--cols", String(cols));
  boardEl.innerHTML = "";

  for (let y = 0; y < gameMap.length; y += 1) {
    for (let x = 0; x < gameMap[y].length; x += 1) {
      const cell = gameMap[y][x];
      const isPlayer = playerPos.x === x && playerPos.y === y;
      const tile = document.createElement("div");
      const classes = ["cell"];

      if (cell === "W") classes.push("wall");
      else if (cell === ".") classes.push("target");
      else if (cell === "$") classes.push("box");
      else if (cell === "*") classes.push("box-on-target");
      else classes.push("floor");

      if (isPlayer) {
        classes.push(cell === "." ? "player-on-target" : "player");
      }

      tile.className = classes.join(" ");
      tile.setAttribute("role", "img");
      tile.setAttribute("aria-label", cellLabel(cell, isPlayer));
      boardEl.appendChild(tile);
    }
  }
}

function movePlayer(dx, dy) {
  if (!winMessageEl.classList.contains("hidden")) return;

  const newX = playerPos.x + dx;
  const newY = playerPos.y + dy;
  const targetCell = getCell(newX, newY);

  if (targetCell === "W") {
    updateStatus("这里被墙挡住了");
    playBlockedSound();
    return;
  }

  const beforeMove = snapshot();

  if (targetCell === "$" || targetCell === "*") {
    const boxNewX = newX + dx;
    const boxNewY = newY + dy;
    const boxTargetCell = getCell(boxNewX, boxNewY);

    if (boxTargetCell === "W" || boxTargetCell === "$" || boxTargetCell === "*") {
      updateStatus("方块前面没有空间");
      playBlockedSound();
      return;
    }

    setCell(boxNewX, boxNewY, boxTargetCell === "." ? "*" : "$");
    setCell(newX, newY, targetCell === "*" ? "." : " ");
  }

  history.push(beforeMove);
  playerPos = { x: newX, y: newY };
  steps += 1;
  playStepSound();
  updateStatus("继续规划下一步");
  updateHud();
  render();
  checkWin();
}

function checkWin() {
  const hasUnplacedBox = gameMap.some((row) => row.includes("$"));
  if (hasUnplacedBox) return;

  playWinSound();
  finalStepsEl.textContent = String(steps);
  updateStatus("关卡完成");
  winMessageEl.classList.remove("hidden");
}

function restartLevel() {
  loadLevel(currentLevel);
}

function undoMove() {
  const previous = history.pop();
  if (!previous) return;
  restore(previous);
  winMessageEl.classList.add("hidden");
  updateStatus("已撤回一步");
  updateHud();
  render();
}

function selectLevel(levelIndex) {
  if (levelIndex < 0 || levelIndex >= LEVELS.length) return;
  loadLevel(levelIndex);
}

function nextLevel() {
  if (currentLevel < LEVELS.length - 1) {
    selectLevel(currentLevel + 1);
    return;
  }

  selectLevel(0);
  updateStatus("全部关卡完成，已回到第一关");
}

function setMuted(nextMuted) {
  isMuted = nextMuted;
  writeAudioSetting();
  setSoundButton();
}

document.querySelectorAll(".level-btn").forEach((button) => {
  button.addEventListener("click", () => {
    selectLevel(Number(button.dataset.level));
  });
});

document.querySelectorAll(".dpad").forEach((button) => {
  button.addEventListener("click", () => {
    movePlayer(Number(button.dataset.dx), Number(button.dataset.dy));
  });
});

restartBtn.addEventListener("click", restartLevel);
winRestartBtn.addEventListener("click", restartLevel);
undoBtn.addEventListener("click", undoMove);
nextLevelBtn.addEventListener("click", nextLevel);
soundBtn.addEventListener("click", () => setMuted(!isMuted));

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (key === "r") {
    restartLevel();
    return;
  }

  if (key === "u" || key === "z") {
    undoMove();
    return;
  }

  const directions = {
    arrowup: [0, -1],
    w: [0, -1],
    arrowdown: [0, 1],
    s: [0, 1],
    arrowleft: [-1, 0],
    a: [-1, 0],
    arrowright: [1, 0],
    d: [1, 0],
  };

  const direction = directions[key];
  if (!direction) return;

  event.preventDefault();
  movePlayer(direction[0], direction[1]);
});

loadLevel(0);
setSoundButton();
