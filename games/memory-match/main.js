const cardSymbols = [
  '🎮', '🎯', '🎨', '🎭',
  '🚀', '🌟', '💎', '🔮',
  '🎪', '🎢', '🎡', '🎠',
  '🏆', '⚡', '🔥', '💫'
];

const gameBoard = document.getElementById('game-board');
const movesEl = document.getElementById('moves');
const pairsEl = document.getElementById('pairs');
const timerEl = document.getElementById('timer');
const restartBtn = document.getElementById('restart-btn');
const newGameBtn = document.getElementById('new-game-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const winScreen = document.getElementById('win-screen');
const finalMovesEl = document.getElementById('final-moves');
const finalTimeEl = document.getElementById('final-time');

let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let moves = 0;
let timer = 0;
let timerInterval = null;
let isLocked = false;

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    timer++;
    timerEl.textContent = formatTime(timer);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateStats() {
  movesEl.textContent = moves;
  pairsEl.textContent = `${matchedPairs}/8`;
}

function createCard(symbol, index) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.symbol = symbol;
  card.dataset.index = index;

  card.innerHTML = `
    <div class="card-inner">
      <div class="card-front"></div>
      <div class="card-back">${symbol}</div>
    </div>
  `;

  card.addEventListener('click', () => flipCard(card));
  return card;
}

function flipCard(card) {
  if (isLocked) return;
  if (card.classList.contains('flipped')) return;
  if (card.classList.contains('matched')) return;
  if (flippedCards.length >= 2) return;

  startTimer();
  card.classList.add('flipped');
  flippedCards.push(card);

  if (flippedCards.length === 2) {
    moves++;
    updateStats();
    checkMatch();
  }
}

function checkMatch() {
  isLocked = true;
  const [card1, card2] = flippedCards;
  const isMatch = card1.dataset.symbol === card2.dataset.symbol;

  if (isMatch) {
    card1.classList.add('matched');
    card2.classList.add('matched');
    matchedPairs++;
    updateStats();
    flippedCards = [];
    isLocked = false;

    if (matchedPairs === 8) {
      setTimeout(showWinScreen, 600);
    }
  } else {
    setTimeout(() => {
      card1.classList.remove('flipped');
      card2.classList.remove('flipped');
      flippedCards = [];
      isLocked = false;
    }, 1000);
  }
}

function showWinScreen() {
  stopTimer();
  finalMovesEl.textContent = moves;
  finalTimeEl.textContent = formatTime(timer);
  winScreen.classList.add('overlay-visible');
}

function initGame() {
  stopTimer();
  gameBoard.innerHTML = '';
  flippedCards = [];
  matchedPairs = 0;
  moves = 0;
  timer = 0;
  isLocked = false;
  updateStats();
  timerEl.textContent = '0:00';
  winScreen.classList.remove('overlay-visible');

  const selectedSymbols = shuffle(cardSymbols).slice(0, 8);
  const cardPairs = shuffle([...selectedSymbols, ...selectedSymbols]);

  cardPairs.forEach((symbol, index) => {
    const card = createCard(symbol, index);
    gameBoard.appendChild(card);
    cards.push(card);
  });
}

restartBtn.addEventListener('click', initGame);
newGameBtn.addEventListener('click', initGame);
playAgainBtn.addEventListener('click', initGame);

initGame();
