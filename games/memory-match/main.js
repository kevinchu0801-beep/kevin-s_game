const cardSymbols = [
  { id: "ring", label: "R1", shape: "ring", color: "#5eead4" },
  { id: "diamond", label: "D2", shape: "diamond", color: "#fbbf24" },
  { id: "bars", label: "B3", shape: "bars", color: "#a78bfa" },
  { id: "cross", label: "C4", shape: "cross", color: "#fb7185" },
  { id: "triangle", label: "T5", shape: "triangle", color: "#38bdf8" },
  { id: "square", label: "S6", shape: "square", color: "#34d399" },
  { id: "split", label: "P7", shape: "split", color: "#f97316" },
  { id: "dotgrid", label: "G8", shape: "dotgrid", color: "#e879f9" },
  { id: "ring-alt", label: "R9", shape: "ring", color: "#93c5fd" },
  { id: "diamond-alt", label: "D0", shape: "diamond", color: "#fde68a" },
  { id: "bars-alt", label: "B1", shape: "bars", color: "#c4b5fd" },
  { id: "cross-alt", label: "C2", shape: "cross", color: "#fda4af" },
];

const gameBoard = document.getElementById("game-board");
const movesEl = document.getElementById("moves");
const pairsEl = document.getElementById("pairs");
const timerEl = document.getElementById("timer");
const restartBtn = document.getElementById("restart-btn");
const newGameBtn = document.getElementById("new-game-btn");
const peekBtn = document.getElementById("peek-btn");
const playAgainBtn = document.getElementById("play-again-btn");
const winScreen = document.getElementById("win-screen");
const finalMovesEl = document.getElementById("final-moves");
const finalTimeEl = document.getElementById("final-time");
const boardStatusEl = document.getElementById("board-status");

const PAIRS_TO_MATCH = 8;

let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let moves = 0;
let timer = 0;
let timerInterval = null;
let isLocked = false;
let peekTimeout = 0;

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    timer += 1;
    timerEl.textContent = formatTime(timer);
  }, 1000);
}

function stopTimer() {
  if (!timerInterval) return;
  clearInterval(timerInterval);
  timerInterval = null;
}

function updateStats() {
  movesEl.textContent = String(moves);
  pairsEl.textContent = `${matchedPairs}/${PAIRS_TO_MATCH}`;
}

function setBoardStatus(message) {
  boardStatusEl.textContent = message;
}

function createCard(symbol, index) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "card";
  card.dataset.symbol = symbol.id;
  card.dataset.index = String(index);
  card.style.setProperty("--shape-color", symbol.color);
  card.setAttribute("aria-label", `未翻开的卡片 ${index + 1}`);
  card.setAttribute("aria-pressed", "false");

  card.innerHTML = `
    <span class="card-inner">
      <span class="card-front"></span>
      <span class="card-back">
        <span class="shape shape-${symbol.shape}" aria-hidden="true"></span>
        <span class="card-code">${symbol.label}</span>
      </span>
    </span>
  `;

  card.addEventListener("click", () => flipCard(card));
  return card;
}

function flipCard(card) {
  if (isLocked) return;
  if (card.classList.contains("flipped")) return;
  if (card.classList.contains("matched")) return;
  if (flippedCards.length >= 2) return;

  startTimer();
  card.classList.add("flipped");
  card.setAttribute("aria-pressed", "true");
  card.setAttribute("aria-label", `已翻开卡片 ${Number(card.dataset.index) + 1}`);
  flippedCards.push(card);

  if (flippedCards.length === 2) {
    moves += 1;
    updateStats();
    checkMatch();
  }
}

function checkMatch() {
  isLocked = true;
  const [card1, card2] = flippedCards;
  const isMatch = card1.dataset.symbol === card2.dataset.symbol;

  if (isMatch) {
    card1.classList.add("matched");
    card2.classList.add("matched");
    card1.disabled = true;
    card2.disabled = true;
    matchedPairs += 1;
    updateStats();
    flippedCards = [];
    isLocked = false;
    setBoardStatus(`已找到 ${matchedPairs} 组，还差 ${PAIRS_TO_MATCH - matchedPairs} 组`);

    if (matchedPairs === PAIRS_TO_MATCH) {
      setTimeout(showWinScreen, 450);
    }
    return;
  }

  card1.classList.add("mismatch");
  card2.classList.add("mismatch");
  setBoardStatus("这两张不同，位置记一下");

  setTimeout(() => {
    card1.classList.remove("flipped", "mismatch");
    card2.classList.remove("flipped", "mismatch");
    card1.setAttribute("aria-pressed", "false");
    card2.setAttribute("aria-pressed", "false");
    card1.setAttribute("aria-label", `未翻开的卡片 ${Number(card1.dataset.index) + 1}`);
    card2.setAttribute("aria-label", `未翻开的卡片 ${Number(card2.dataset.index) + 1}`);
    flippedCards = [];
    isLocked = false;
    setBoardStatus("继续寻找相同图形");
  }, 760);
}

function showWinScreen() {
  stopTimer();
  finalMovesEl.textContent = String(moves);
  finalTimeEl.textContent = formatTime(timer);
  setBoardStatus("全部配对完成");
  winScreen.classList.add("overlay-visible");
}

function clearPeek() {
  window.clearTimeout(peekTimeout);
  cards.forEach((card) => {
    if (!card.classList.contains("matched") && !flippedCards.includes(card)) {
      card.classList.remove("previewing");
    }
  });
  peekBtn.disabled = false;
  isLocked = false;
}

function peekCards() {
  if (isLocked || matchedPairs === PAIRS_TO_MATCH) return;
  clearPeek();
  isLocked = true;
  peekBtn.disabled = true;
  setBoardStatus("短暂预览中");

  cards.forEach((card) => {
    if (!card.classList.contains("matched") && !card.classList.contains("flipped")) {
      card.classList.add("previewing");
    }
  });

  peekTimeout = window.setTimeout(() => {
    clearPeek();
    setBoardStatus("预览结束，开始配对");
  }, 1300);
}

function initGame() {
  stopTimer();
  window.clearTimeout(peekTimeout);
  gameBoard.innerHTML = "";
  cards = [];
  flippedCards = [];
  matchedPairs = 0;
  moves = 0;
  timer = 0;
  isLocked = false;
  peekBtn.disabled = false;
  updateStats();
  timerEl.textContent = "0:00";
  winScreen.classList.remove("overlay-visible");
  setBoardStatus("找到 8 组相同图形");

  const selectedSymbols = shuffle(cardSymbols).slice(0, PAIRS_TO_MATCH);
  const cardPairs = shuffle([...selectedSymbols, ...selectedSymbols]);

  cardPairs.forEach((symbol, index) => {
    const card = createCard(symbol, index);
    cards.push(card);
    gameBoard.appendChild(card);
  });
}

restartBtn.addEventListener("click", initGame);
newGameBtn.addEventListener("click", initGame);
peekBtn.addEventListener("click", peekCards);
playAgainBtn.addEventListener("click", initGame);

initGame();
