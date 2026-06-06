const LEVELS = [
  [
    'WWWWWW',
    'W    W',
    'W .@ W',
    'W $. W',
    'W    W',
    'WWWWWW'
  ],
  [
    'WWWWWWW',
    'W     W',
    'W .$. W',
    'W $@. W',
    'W .$. W',
    'W     W',
    'WWWWWWW'
  ],
  [
    'WWWWWWW',
    'W   W W',
    'W $.$ W',
    'W W@W W',
    'W .$. W',
    'W   W W',
    'WWWWWWW'
  ],
  [
    'WWWWWWWW',
    'W   W  W',
    'W $ .$ W',
    'W . W .W',
    'W $ @$ W',
    'W . $. W',
    'W   W  W',
    'WWWWWWWW'
  ],
  [
    'WWWWWWWWW',
    'W   W   W',
    'W $ .$  W',
    'W . W . WW',
    'W $ @$ W W',
    'W . $. . W',
    'W   W $ W W',
    'W   .$   W',
    'WWWWWWWWW'
  ]
];

let currentLevel = 0;
let gameMap = [];
let playerPos = { x: 0, y: 0 };
let steps = 0;

function initGame() {
  loadLevel(currentLevel);
  render();
}

function loadLevel(levelIndex) {
  currentLevel = levelIndex;
  gameMap = LEVELS[levelIndex].map(row => row.split(''));
  steps = 0;
  
  for (let y = 0; y < gameMap.length; y++) {
    for (let x = 0; x < gameMap[y].length; x++) {
      if (gameMap[y][x] === '@') {
        playerPos = { x, y };
        gameMap[y][x] = '.';
        break;
      }
    }
  }
  
  updateSteps();
}

function render() {
  const board = document.getElementById('gameBoard');
  let html = '';
  
  for (let y = 0; y < gameMap.length; y++) {
    html += '<div class="row">';
    for (let x = 0; x < gameMap[y].length; x++) {
      let cellClass = '';
      let content = '';
      
      const isPlayer = playerPos.x === x && playerPos.y === y;
      const cell = gameMap[y][x];
      
      if (cell === 'W') {
        cellClass = 'wall';
      } else if (cell === '.') {
        cellClass = isPlayer ? 'player-on-target' : 'target';
        content = isPlayer ? '😊' : '';
      } else if (cell === '$') {
        cellClass = 'box';
        content = '📦';
      } else if (cell === '*') {
        cellClass = isPlayer ? 'player-on-target' : 'box-on-target';
        content = isPlayer ? '😊' : '💎';
      } else {
        cellClass = isPlayer ? 'player' : 'floor';
        content = isPlayer ? '😊' : '';
      }
      
      html += `<div class="cell ${cellClass}">${content}</div>`;
    }
    html += '</div>';
  }
  
  board.innerHTML = html;
}

function movePlayer(dx, dy) {
  const newX = playerPos.x + dx;
  const newY = playerPos.y + dy;
  
  if (newY < 0 || newY >= gameMap.length || newX < 0 || newX >= gameMap[0].length) {
    return;
  }
  
  const targetCell = gameMap[newY][newX];
  
  if (targetCell === 'W') {
    return;
  }
  
  if (targetCell === '$' || targetCell === '*') {
    const boxNewX = newX + dx;
    const boxNewY = newY + dy;
    
    if (boxNewY < 0 || boxNewY >= gameMap.length || boxNewX < 0 || boxNewX >= gameMap[0].length) {
      return;
    }
    
    const boxTargetCell = gameMap[boxNewY][boxNewX];
    
    if (boxTargetCell === 'W' || boxTargetCell === '$' || boxTargetCell === '*') {
      return;
    }
    
    if (boxTargetCell === '.') {
      gameMap[boxNewY][boxNewX] = '*';
    } else {
      gameMap[boxNewY][boxNewX] = '$';
    }
    
    if (gameMap[newY][newX] === '*') {
      gameMap[newY][newX] = '.';
    } else {
      gameMap[newY][newX] = ' ';
    }
  }
  
  playerPos = { x: newX, y: newY };
  steps++;
  updateSteps();
  render();
  checkWin();
}

function updateSteps() {
  document.getElementById('steps').textContent = steps;
}

function checkWin() {
  for (let y = 0; y < gameMap.length; y++) {
    for (let x = 0; x < gameMap[y].length; x++) {
      if (gameMap[y][x] === '$') {
        return;
      }
    }
  }
  
  document.getElementById('finalSteps').textContent = steps;
  document.getElementById('winMessage').classList.remove('hidden');
}

function restartLevel() {
  document.getElementById('winMessage').classList.add('hidden');
  loadLevel(currentLevel);
  render();
}

function selectLevel(levelIndex) {
  if (levelIndex >= 0 && levelIndex < LEVELS.length) {
    document.getElementById('winMessage').classList.add('hidden');
    document.querySelectorAll('.level-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === levelIndex);
    });
    loadLevel(levelIndex);
    render();
  }
}

function nextLevel() {
  if (currentLevel < LEVELS.length - 1) {
    selectLevel(currentLevel + 1);
  } else {
    alert('恭喜你通关了所有关卡！');
    selectLevel(0);
  }
}

document.addEventListener('keydown', (e) => {
  if (document.getElementById('winMessage').classList.contains('hidden')) {
    switch(e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        movePlayer(0, -1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        movePlayer(0, 1);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        movePlayer(-1, 0);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        movePlayer(1, 0);
        break;
    }
  }
});

document.querySelectorAll('.level-btn').forEach((btn, i) => {
  btn.classList.toggle('active', i === 0);
});

initGame();