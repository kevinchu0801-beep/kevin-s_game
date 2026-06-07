const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const comboEl = document.getElementById("combo");
const finalScoreEl = document.getElementById("final-score");
const finalBestEl = document.getElementById("final-best");
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const startCopyEl = startScreen.querySelector(".panel-copy");
const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");
const backButton = document.getElementById("back-button");
const muteButton = document.getElementById("mute-button");
const pauseButton = document.getElementById("pause-button");
const startCopyHtml =
  "键盘用 <code>A/D</code> 或方向键左右移动。手机上直接拖动角色。<br />护盾能挡一次撞击，连续吃金币会提升连击分。";
const pauseCopyText = "游戏已暂停。继续后会从当前进度恢复。";

const BEST_SCORE_KEY = "neon-arcade-best-score";
const GAME_WIDTH = 1024;
const GAME_HEIGHT = 768;
const PLAYER_RADIUS = 18;
const PLAYER_SPEED = 560;
const MAX_LIVES = 1;
const INITIAL_SPAWN_GAP = 0.95;
const INITIAL_SPEED = 230;
const GAME_DURATION = 90;

let isRunning = false;
let isMuted = true;
let animationId = 0;
let lastTimestamp = 0;
let elapsed = 0;
let score = 0;
let combo = 1;
let bestScore = readStoredBestScore();
let shakeTimer = 0;
let audioCtx = null;

const input = {
  left: false,
  right: false,
  pointerActive: false,
  targetX: GAME_WIDTH / 2,
};

const state = {
  player: {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 96,
    radius: PLAYER_RADIUS,
    shield: 1,
    lives: MAX_LIVES,
    flash: 0,
  },
  obstacles: [],
  coins: [],
  powerups: [],
  particles: [],
  stars: [],
  spawnTimer: 0,
  coinTimer: 0,
  powerTimer: 0,
};

const view = {
  dpr: 1,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function readStoredBestScore() {
  try {
    return Number(window.localStorage.getItem(BEST_SCORE_KEY) || 0);
  } catch {
    return 0;
  }
}

function writeStoredBestScore(value) {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(value));
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

function playCoinSound() {
  playTone(880, 0.08, "triangle", 0.03, 1320);
}

function playShieldSound() {
  playTone(660, 0.12, "sine", 0.04, 990);
}

function playMagnetSound() {
  playTone(520, 0.1, "square", 0.025, 780);
}

function playHitSound() {
  playTone(180, 0.16, "sawtooth", 0.05, 90);
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function circleHit(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const distance = Math.hypot(dx, dy);
  return distance < a.radius + b.radius;
}

function clientToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - view.offsetX) / view.scale,
    y: (clientY - rect.top - view.offsetY) / view.scale,
  };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  view.dpr = window.devicePixelRatio || 1;
  view.scale = Math.min(rect.width / GAME_WIDTH, rect.height / GAME_HEIGHT);
  view.offsetX = (rect.width - GAME_WIDTH * view.scale) / 2;
  view.offsetY = (rect.height - GAME_HEIGHT * view.scale) / 2;

  canvas.width = Math.round(rect.width * view.dpr);
  canvas.height = Math.round(rect.height * view.dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(
    view.dpr * view.scale,
    0,
    0,
    view.dpr * view.scale,
    view.dpr * view.offsetX,
    view.dpr * view.offsetY,
  );
}

function addParticles(x, y, color, amount = 10, speed = 160) {
  for (let index = 0; index < amount; index += 1) {
    state.particles.push({
      x,
      y,
      radius: rand(1.5, 4.2),
      vx: rand(-speed, speed),
      vy: rand(-speed, speed),
      life: rand(0.35, 0.8),
      color,
    });
  }
}

function spawnStarfield() {
  state.stars = Array.from({ length: 110 }, () => ({
    x: rand(0, GAME_WIDTH),
    y: rand(0, GAME_HEIGHT),
    radius: rand(0.8, 2.2),
    speed: rand(18, 72),
    alpha: rand(0.2, 0.95),
  }));
}

function resetGame() {
  elapsed = 0;
  score = 0;
  combo = 1;
  shakeTimer = 0;

  state.player.x = GAME_WIDTH / 2;
  state.player.y = GAME_HEIGHT - 96;
  state.player.shield = 1;
  state.player.lives = MAX_LIVES;
  state.player.flash = 0;

  state.obstacles.length = 0;
  state.coins.length = 0;
  state.powerups.length = 0;
  state.particles.length = 0;
  state.spawnTimer = 0;
  state.coinTimer = 0;
  state.powerTimer = 4;

  input.left = false;
  input.right = false;
  input.pointerActive = false;
  input.targetX = state.player.x;

  scoreEl.textContent = "0";
  comboEl.textContent = "x1";
  bestScoreEl.textContent = String(bestScore);
  finalScoreEl.textContent = "0";
  finalBestEl.textContent = String(bestScore);
}

function restoreStartCopy() {
  startCopyEl.innerHTML = startCopyHtml;
}

function setPauseButton(label, isDisabled = false) {
  pauseButton.textContent = label;
  pauseButton.disabled = isDisabled;
}

function startGame() {
  if (!isRunning) {
    resetGame();
    isRunning = true;
    setPauseButton("暂停", false);
    startScreen.classList.remove("overlay-visible");
    gameOverScreen.classList.remove("overlay-visible");
    lastTimestamp = performance.now();
    animationId = requestAnimationFrame(loop);
    return;
  }

  isRunning = true;
  setPauseButton("暂停", false);
  startScreen.classList.remove("overlay-visible");
  gameOverScreen.classList.remove("overlay-visible");
  lastTimestamp = performance.now();
  animationId = requestAnimationFrame(loop);
}

function finishGame() {
  isRunning = false;
  cancelAnimationFrame(animationId);
  setPauseButton("暂停", true);
  bestScore = Math.max(bestScore, Math.floor(score));
  writeStoredBestScore(bestScore);
  finalScoreEl.textContent = String(Math.floor(score));
  finalBestEl.textContent = String(bestScore);
  bestScoreEl.textContent = String(bestScore);
  gameOverScreen.classList.add("overlay-visible");
}

function spawnObstacle() {
  const size = rand(24, 52);
  state.obstacles.push({
    x: rand(size + 24, GAME_WIDTH - size - 24),
    y: -size,
    radius: size * 0.55,
    size,
    speed: rand(0.9, 1.4),
    wobble: rand(0, Math.PI * 2),
    type: Math.random() > 0.78 ? "spike" : "rock",
  });
}

function spawnCoin() {
  const size = 13;
  state.coins.push({
    x: rand(24, GAME_WIDTH - 24),
    y: -20,
    radius: size,
    size,
    speed: rand(0.95, 1.25),
    value: 10,
  });
}

function spawnPowerup() {
  state.powerups.push({
    x: rand(60, GAME_WIDTH - 60),
    y: -24,
    radius: 18,
    size: 18,
    speed: 0.92,
    type: Math.random() > 0.5 ? "shield" : "magnet",
    pulse: rand(0, Math.PI * 2),
  });
}

function updateInput(dt) {
  const target = input.pointerActive
    ? input.targetX
    : state.player.x + (input.right ? 1 : 0) * PLAYER_SPEED * dt - (input.left ? 1 : 0) * PLAYER_SPEED * dt;
  const smooth = input.pointerActive ? 0.18 : 0.14;
  state.player.x = lerp(state.player.x, target, smooth);
  state.player.x = clamp(state.player.x, 26, GAME_WIDTH - 26);
}

function updateSpawns(dt) {
  const speedFactor = 1 + elapsed / 34;
  const spawnGap = Math.max(0.35, INITIAL_SPAWN_GAP - elapsed / 120);
  const coinGap = Math.max(0.38, 0.88 - elapsed / 160);
  const powerGap = 16 + Math.max(0, 22 - elapsed / 5);

  state.spawnTimer += dt * speedFactor;
  state.coinTimer += dt * speedFactor;
  state.powerTimer += dt;

  while (state.spawnTimer >= spawnGap) {
    state.spawnTimer -= spawnGap;
    spawnObstacle();
    if (Math.random() > 0.5 && elapsed > 10) {
      spawnObstacle();
    }
  }

  while (state.coinTimer >= coinGap) {
    state.coinTimer -= coinGap;
    spawnCoin();
  }

  if (state.powerTimer >= powerGap) {
    state.powerTimer = 0;
    if (elapsed > 6 && Math.random() > 0.45) {
      spawnPowerup();
    }
  }
}

function updateParticles(dt) {
  for (let index = state.particles.length - 1; index >= 0; index -= 1) {
    const particle = state.particles[index];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
    if (particle.life <= 0) {
      state.particles.splice(index, 1);
    }
  }
}

function updateStars(dt) {
  for (const star of state.stars) {
    star.y += star.speed * dt;
    if (star.y > GAME_HEIGHT + 6) {
      star.y = -6;
      star.x = rand(0, GAME_WIDTH);
    }
  }
}

function updateObstacles(dt) {
  const baseSpeed = INITIAL_SPEED + elapsed * 8.5;

  for (let index = state.obstacles.length - 1; index >= 0; index -= 1) {
    const obstacle = state.obstacles[index];
    obstacle.y += baseSpeed * obstacle.speed * dt;
    obstacle.wobble += dt * 3;
    obstacle.x += Math.sin(obstacle.wobble) * 18 * dt;

    if (obstacle.y - obstacle.radius > GAME_HEIGHT + 40) {
      state.obstacles.splice(index, 1);
    }
  }
}

function updateCoins(dt) {
  const baseSpeed = INITIAL_SPEED * 0.9 + elapsed * 6;

  for (let index = state.coins.length - 1; index >= 0; index -= 1) {
    const coin = state.coins[index];
    coin.y += baseSpeed * coin.speed * dt;
    if (coin.y - coin.radius > GAME_HEIGHT + 40) {
      state.coins.splice(index, 1);
    }
  }
}

function updatePowerups(dt) {
  const baseSpeed = INITIAL_SPEED * 0.82 + elapsed * 5;

  for (let index = state.powerups.length - 1; index >= 0; index -= 1) {
    const powerup = state.powerups[index];
    powerup.y += baseSpeed * powerup.speed * dt;
    powerup.pulse += dt * 5;
    if (powerup.y - powerup.radius > GAME_HEIGHT + 40) {
      state.powerups.splice(index, 1);
    }
  }
}

function handleCollisions() {
  const player = {
    x: state.player.x,
    y: state.player.y,
    radius: state.player.radius + 3,
  };

  for (let index = state.coins.length - 1; index >= 0; index -= 1) {
    const coin = state.coins[index];
    if (!circleHit(player, coin)) continue;
    state.coins.splice(index, 1);
    combo += 1;
    const comboBonus = combo >= 5 ? 20 : combo >= 3 ? 15 : 10;
    score += comboBonus;
    score += 2;
    scoreEl.textContent = String(Math.floor(score));
    comboEl.textContent = `x${combo}`;
    addParticles(coin.x, coin.y, "#f8e16c", 8, 140);
    playCoinSound();
  }

  for (let index = state.powerups.length - 1; index >= 0; index -= 1) {
    const powerup = state.powerups[index];
    if (!circleHit(player, powerup)) continue;
    state.powerups.splice(index, 1);

    if (powerup.type === "shield") {
      state.player.shield = 1;
      addParticles(powerup.x, powerup.y, "#67e8f9", 14, 190);
      playShieldSound();
    } else {
      score += 18;
      combo = Math.max(combo, 2);
      addParticles(powerup.x, powerup.y, "#f472b6", 14, 170);
      playMagnetSound();
    }
    scoreEl.textContent = String(Math.floor(score));
    comboEl.textContent = `x${combo}`;
  }

  for (let index = state.obstacles.length - 1; index >= 0; index -= 1) {
    const obstacle = state.obstacles[index];
    if (!circleHit(player, obstacle)) continue;

    state.obstacles.splice(index, 1);
    addParticles(obstacle.x, obstacle.y, "#fb7185", 18, 200);
    shakeTimer = 0.25;
    combo = 1;
    comboEl.textContent = "x1";

    if (state.player.shield > 0) {
      state.player.shield = 0;
      state.player.flash = 0.35;
      score += 5;
      scoreEl.textContent = String(Math.floor(score));
      playShieldSound();
      continue;
    }

    state.player.lives -= 1;
    playHitSound();
    if (state.player.lives <= 0) {
      finishGame();
      return;
    }
  }
}

function updateScore(dt) {
  const survivalScore = dt * 10;
  score += survivalScore;
  scoreEl.textContent = String(Math.floor(score));
  elapsed += dt;

  if (Math.floor(score) > bestScore) {
    bestScore = Math.floor(score);
    bestScoreEl.textContent = String(bestScore);
  }

  if (elapsed >= GAME_DURATION) {
    finishGame();
  }
}

function update(dt) {
  if (!isRunning) return;

  updateInput(dt);
  updateStars(dt);
  updateSpawns(dt);
  updateObstacles(dt);
  updateCoins(dt);
  updatePowerups(dt);
  updateParticles(dt);
  handleCollisions();
  updateScore(dt);

  if (state.player.flash > 0) {
    state.player.flash = Math.max(0, state.player.flash - dt);
  }

  if (shakeTimer > 0) {
    shakeTimer = Math.max(0, shakeTimer - dt);
  }
}

function drawBackground() {
  const background = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  background.addColorStop(0, "#bdefff");
  background.addColorStop(0.58, "#f6f7ff");
  background.addColorStop(1, "#fff2b8");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.save();
  for (const star of state.stars) {
    ctx.globalAlpha = star.alpha * 0.42;
    ctx.fillStyle = star.speed > 50 ? "#ff7a7a" : "#5a8cff";
    ctx.fillRect(star.x, star.y, star.radius * 2.2, star.radius * 2.2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  const laneHeight = GAME_HEIGHT / 8;
  ctx.save();
  ctx.strokeStyle = "rgba(36, 48, 68, 0.16)";
  ctx.lineWidth = 2;
  for (let row = 1; row < 8; row += 1) {
    const y = row * laneHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(GAME_WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer() {
  const x = state.player.x;
  const y = state.player.y;
  const radius = state.player.radius;
  const flash = state.player.flash > 0;

  ctx.save();
  if (shakeTimer > 0) {
    ctx.translate(rand(-3, 3), rand(-3, 3));
  }

  ctx.shadowColor = flash ? "#67e8f9" : "rgba(103, 232, 249, 0.45)";
  ctx.shadowBlur = 10;

  const gradient = ctx.createRadialGradient(x - 6, y - 8, 4, x, y, radius + 16);
  gradient.addColorStop(0, flash ? "#ffffff" : "#7dd3fc");
  gradient.addColorStop(0.55, "#38bdf8");
  gradient.addColorStop(1, "#0ea5e9");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.beginPath();
  ctx.arc(x - 6, y - 5, 4, 0, Math.PI * 2);
  ctx.fill();

  if (state.player.shield > 0) {
    ctx.strokeStyle = "#243044";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius + 11 + Math.sin(performance.now() / 120) * 1.4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawObstacle(obstacle) {
  const { x, y, size, type } = obstacle;

  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "rgba(36, 48, 68, 0.35)";
  ctx.shadowBlur = 4;
  ctx.strokeStyle = "#243044";
  ctx.lineWidth = 4;

  if (type === "spike") {
    ctx.fillStyle = "#ff7a7a";
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.7);
    ctx.lineTo(size * 0.56, size * 0.5);
    ctx.lineTo(-size * 0.56, size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    const gradient = ctx.createLinearGradient(-size, -size, size, size);
    gradient.addColorStop(0, "#fff7e8");
    gradient.addColorStop(0.5, "#ff7a7a");
    gradient.addColorStop(1, "#ffd166");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(-size * 0.5, -size * 0.5, size, size, 8);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function drawCoin(coin) {
  ctx.save();
  ctx.translate(coin.x, coin.y);
  ctx.shadowColor = "rgba(36, 48, 68, 0.28)";
  ctx.shadowBlur = 4;
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(0, 0, coin.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#243044";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.beginPath();
  ctx.arc(-3, -3, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPowerup(powerup) {
  ctx.save();
  ctx.translate(powerup.x, powerup.y);
  const pulse = 1 + Math.sin(powerup.pulse) * 0.12;
  ctx.scale(pulse, pulse);

  const color = powerup.type === "shield" ? "#67e8f9" : "#f472b6";
  ctx.shadowColor = "rgba(36, 48, 68, 0.3)";
  ctx.shadowBlur = 4;
  ctx.strokeStyle = "#243044";
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, powerup.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#243044";
  ctx.font = "bold 16px Space Grotesk, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(powerup.type === "shield" ? "S" : "M", 0, 1);
  ctx.restore();
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawTopBanner() {
  ctx.save();
  ctx.fillStyle = "rgba(255, 247, 232, 0.92)";
  ctx.fillRect(0, 0, GAME_WIDTH, 48);
  ctx.strokeStyle = "#243044";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 48);
  ctx.lineTo(GAME_WIDTH, 48);
  ctx.stroke();
  ctx.fillStyle = "#243044";
  ctx.font = '700 13px "Space Grotesk", sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillText("点击顶部或按 P 可暂停 / 继续", 18, 24);
  ctx.restore();
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(
    view.dpr * view.scale,
    0,
    0,
    view.dpr * view.scale,
    view.dpr * view.offsetX,
    view.dpr * view.offsetY,
  );
  drawBackground();
  drawParticles();
  for (const obstacle of state.obstacles) drawObstacle(obstacle);
  for (const coin of state.coins) drawCoin(coin);
  for (const powerup of state.powerups) drawPowerup(powerup);
  drawPlayer();
  drawTopBanner();

  if (!isRunning && !startScreen.classList.contains("overlay-visible")) {
    ctx.save();
    ctx.fillStyle = "rgba(4, 10, 18, 0.36)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.restore();
  }
}

function loop(timestamp) {
  const dt = Math.min(0.033, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;

  update(dt);
  draw();

  if (isRunning) {
    animationId = requestAnimationFrame(loop);
  }
}

function togglePause() {
  if (!isRunning) return;
  isRunning = false;
  cancelAnimationFrame(animationId);
  setPauseButton("继续", false);
  startScreen.classList.add("overlay-visible");
  startButton.textContent = "继续游戏";
  startCopyEl.textContent = pauseCopyText;
}

function resumeFromPause() {
  if (gameOverScreen.classList.contains("overlay-visible")) {
    startGame();
    return;
  }

  isRunning = true;
  setPauseButton("暂停", false);
  startScreen.classList.remove("overlay-visible");
  startButton.textContent = "开始游戏";
  restoreStartCopy();
  lastTimestamp = performance.now();
  animationId = requestAnimationFrame(loop);
}

function setMutedState(nextMuted) {
  isMuted = nextMuted;
  muteButton.textContent = `音效：${isMuted ? "关" : "开"}`;
}

function handlePointerMove(clientX, clientY) {
  const { x } = clientToWorld(clientX, clientY);
  input.pointerActive = true;
  input.targetX = clamp(x, 26, GAME_WIDTH - 26);
}

function releasePointer() {
  input.pointerActive = false;
}

window.addEventListener("resize", () => {
  resizeCanvas();
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  ensureAudioContext();

  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    input.left = true;
  }
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    input.right = true;
  }
  if (event.key.toLowerCase() === "p") {
    if (isRunning) {
      togglePause();
    } else if (gameOverScreen.classList.contains("overlay-visible")) {
      startGame();
    } else {
      resumeFromPause();
    }
  }
  if (event.key === " " || event.key === "Enter") {
    if (!isRunning) {
      resumeFromPause();
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    input.left = false;
  }
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    input.right = false;
  }
});

canvas.addEventListener("pointerdown", (event) => {
  ensureAudioContext();
  const worldPoint = clientToWorld(event.clientX, event.clientY);
  if (worldPoint.y <= 48 && isRunning) {
    togglePause();
    return;
  }
  canvas.setPointerCapture(event.pointerId);
  handlePointerMove(event.clientX, event.clientY);
});

canvas.addEventListener("pointermove", (event) => {
  if (!event.buttons && !input.pointerActive) return;
  handlePointerMove(event.clientX, event.clientY);
});

canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", releasePointer);
canvas.addEventListener("pointerleave", releasePointer);

startButton.addEventListener("click", () => {
  ensureAudioContext();
  if (gameOverScreen.classList.contains("overlay-visible")) {
    resetGame();
    isRunning = true;
    startScreen.classList.remove("overlay-visible");
    gameOverScreen.classList.remove("overlay-visible");
    lastTimestamp = performance.now();
    animationId = requestAnimationFrame(loop);
    return;
  }

  if (startScreen.classList.contains("overlay-visible") && !isRunning) {
    resumeFromPause();
    return;
  }

  startGame();
});

restartButton.addEventListener("click", () => {
  ensureAudioContext();
  resetGame();
  isRunning = true;
  setPauseButton("暂停", false);
  startScreen.classList.remove("overlay-visible");
  gameOverScreen.classList.remove("overlay-visible");
  lastTimestamp = performance.now();
  animationId = requestAnimationFrame(loop);
});

backButton.addEventListener("click", () => {
  isRunning = false;
  cancelAnimationFrame(animationId);
  resetGame();
  setPauseButton("暂停", true);
  startButton.textContent = "开始游戏";
  restoreStartCopy();
  gameOverScreen.classList.remove("overlay-visible");
  startScreen.classList.add("overlay-visible");
});

muteButton.addEventListener("click", () => {
  setMutedState(!isMuted);
});

pauseButton.addEventListener("click", () => {
  if (isRunning) {
    togglePause();
    return;
  }

  if (startScreen.classList.contains("overlay-visible")) {
    resumeFromPause();
  }
});

startScreen.classList.add("overlay-visible");
setPauseButton("暂停", true);
setMutedState(true);
bestScoreEl.textContent = String(bestScore);
resizeCanvas();
spawnStarfield();
resetGame();
restoreStartCopy();
draw();
