const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const timerEl = document.getElementById("timer");
const messageEl = document.getElementById("message");
const shuffleBtn = document.getElementById("shuffleBtn");
const resetBtn = document.getElementById("resetBtn");
const sizeSelect = document.getElementById("sizeSelect");
const previewImage = document.getElementById("previewImage");

const imageSrc = "image.png";

let size = Number(sizeSelect.value);
let tiles = [];
let moves = 0;
let seconds = 0;
let timerId = null;
let started = false;
let initialShuffledState = [];

function buildSolvedState(n) {
  return [...Array(n * n - 1).keys()].map((i) => i + 1).concat(0);
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const secs = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function updateStatus() {
  movesEl.textContent = String(moves);
  timerEl.textContent = formatTime(seconds);
}

function getEmptyIndex() {
  return tiles.indexOf(0);
}

function getNeighbors(index) {
  const row = Math.floor(index / size);
  const col = index % size;
  const neighbors = [];

  if (row > 0) neighbors.push(index - size);
  if (row < size - 1) neighbors.push(index + size);
  if (col > 0) neighbors.push(index - 1);
  if (col < size - 1) neighbors.push(index + 1);

  return neighbors;
}

function canMove(index) {
  return getNeighbors(index).includes(getEmptyIndex());
}

function isSolved() {
  const solved = buildSolvedState(size);
  return tiles.every((tile, index) => tile === solved[index]);
}

function startTimer() {
  if (timerId) return;
  timerId = setInterval(() => {
    seconds += 1;
    updateStatus();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function moveTile(index) {
  if (!canMove(index)) return false;

  const emptyIndex = getEmptyIndex();
  [tiles[index], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[index]];
  moves += 1;

  if (!started) {
    started = true;
    startTimer();
  }

  renderBoard();

  if (isSolved()) {
    stopTimer();
    messageEl.textContent = `完成！共 ${moves} 步`;
  } else {
    messageEl.textContent = "";
  }

  return true;
}

function renderBoard() {
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

  tiles.forEach((value, index) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.setAttribute("role", "gridcell");

    if (value === 0) {
      tile.classList.add("empty");
      tile.setAttribute("aria-label", "空白格");
      tile.disabled = true;
    } else {
      const zeroBased = value - 1;
      const imgRow = Math.floor(zeroBased / size);
      const imgCol = zeroBased % size;
      const denom = Math.max(size - 1, 1);

      tile.setAttribute("aria-label", `拼圖片段 ${value}`);
      tile.style.backgroundImage = `url("${imageSrc}")`;
      tile.style.backgroundSize = `${size * 100}% ${size * 100}%`;
      tile.style.backgroundPosition = `${(imgCol / denom) * 100}% ${(imgRow / denom) * 100}%`;

      tile.addEventListener("click", () => moveTile(index));
      tile.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          moveTile(index);
        }
      });
    }

    boardEl.appendChild(tile);
  });

  updateStatus();
}

function shuffleByLegalMoves(steps = 200) {
  tiles = buildSolvedState(size);
  let emptyIndex = getEmptyIndex();
  let previousIndex = -1;

  for (let i = 0; i < steps; i += 1) {
    let choices = getNeighbors(emptyIndex).filter((idx) => idx !== previousIndex);
    if (choices.length === 0) choices = getNeighbors(emptyIndex);
    const nextIndex = choices[Math.floor(Math.random() * choices.length)];
    [tiles[emptyIndex], tiles[nextIndex]] = [tiles[nextIndex], tiles[emptyIndex]];
    previousIndex = emptyIndex;
    emptyIndex = nextIndex;
  }

  if (isSolved()) {
    shuffleByLegalMoves(steps + 20);
    return;
  }

  initialShuffledState = [...tiles];
}

function resetProgress() {
  stopTimer();
  moves = 0;
  seconds = 0;
  started = false;
  messageEl.textContent = "";
  updateStatus();
}

function newGame() {
  size = Number(sizeSelect.value);
  previewImage.src = imageSrc;
  resetProgress();
  shuffleByLegalMoves(size * size * 30);
  renderBoard();
}

function resetToShuffle() {
  if (!initialShuffledState.length) return;
  tiles = [...initialShuffledState];
  resetProgress();
  renderBoard();
}

shuffleBtn.addEventListener("click", newGame);
resetBtn.addEventListener("click", resetToShuffle);
sizeSelect.addEventListener("change", newGame);

document.addEventListener("keydown", (event) => {
  const emptyIndex = getEmptyIndex();
  const row = Math.floor(emptyIndex / size);
  const col = emptyIndex % size;
  let targetIndex = -1;

  if (event.key === "ArrowUp" && row < size - 1) targetIndex = emptyIndex + size;
  if (event.key === "ArrowDown" && row > 0) targetIndex = emptyIndex - size;
  if (event.key === "ArrowLeft" && col < size - 1) targetIndex = emptyIndex + 1;
  if (event.key === "ArrowRight" && col > 0) targetIndex = emptyIndex - 1;

  if (targetIndex !== -1) {
    event.preventDefault();
    moveTile(targetIndex);
  }
});

newGame();
