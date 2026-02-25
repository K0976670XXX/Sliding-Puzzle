const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const timerEl = document.getElementById("timer");
const messageEl = document.getElementById("message");
const shuffleBtn = document.getElementById("shuffleBtn");
const resetBtn = document.getElementById("resetBtn");
const solveBtn = document.getElementById("solveBtn");
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
let shuffleHistory = [];
let moveHistory = [];
let isAutoSolving = false;
let solveRunId = 0;

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

function setControlsDisabled(disabled) {
  shuffleBtn.disabled = disabled;
  resetBtn.disabled = disabled;
  sizeSelect.disabled = disabled;
  solveBtn.disabled = disabled;
}

function moveTile(index, options = {}) {
  const {
    trackHistory = true,
    updateMessage = true,
  } = options;

  if (isAutoSolving && trackHistory) return false;
  if (!canMove(index)) return false;

  const movedValue = tiles[index];
  const emptyIndex = getEmptyIndex();
  [tiles[index], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[index]];
  moves += 1;
  if (trackHistory) {
    moveHistory.push(movedValue);
  }

  if (!started) {
    started = true;
    startTimer();
  }

  renderBoard();

  if (updateMessage && isSolved()) {
    stopTimer();
    messageEl.textContent = `完成！共 ${moves} 步`;
  } else if (updateMessage) {
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
  shuffleHistory = [];
  let emptyIndex = getEmptyIndex();
  let previousIndex = -1;

  for (let i = 0; i < steps; i += 1) {
    let choices = getNeighbors(emptyIndex).filter((idx) => idx !== previousIndex);
    if (choices.length === 0) choices = getNeighbors(emptyIndex);
    const nextIndex = choices[Math.floor(Math.random() * choices.length)];
    shuffleHistory.push(tiles[nextIndex]);
    [tiles[emptyIndex], tiles[nextIndex]] = [tiles[nextIndex], tiles[emptyIndex]];
    previousIndex = emptyIndex;
    emptyIndex = nextIndex;
  }

  if (isSolved()) {
    shuffleByLegalMoves(steps + 20);
    return;
  }

  initialShuffledState = [...tiles];
  moveHistory = [...shuffleHistory];
}

function resetProgress() {
  stopTimer();
  moves = 0;
  seconds = 0;
  started = false;
  messageEl.textContent = "";
  updateStatus();
}

function cancelAutoSolve() {
  solveRunId += 1;
  if (isAutoSolving) {
    isAutoSolving = false;
    setControlsDisabled(false);
  }
}

function newGame() {
  cancelAutoSolve();
  size = Number(sizeSelect.value);
  previewImage.src = imageSrc;
  resetProgress();
  shuffleByLegalMoves(size * size * 30);
  renderBoard();
}

function resetToShuffle() {
  cancelAutoSolve();
  if (!initialShuffledState.length) return;
  tiles = [...initialShuffledState];
  moveHistory = [...shuffleHistory];
  resetProgress();
  renderBoard();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function autoSolve() {
  if (isAutoSolving || isSolved()) return;
  if (!moveHistory.length) return;

  isAutoSolving = true;
  const runId = ++solveRunId;
  setControlsDisabled(true);
  messageEl.textContent = "解答中...";

  const solution = [...moveHistory].reverse();

  for (const tileValue of solution) {
    if (runId !== solveRunId) return;

    const tileIndex = tiles.indexOf(tileValue);
    const moved = moveTile(tileIndex, { trackHistory: false, updateMessage: false });
    if (!moved) {
      messageEl.textContent = "解答失敗，請重新打亂";
      isAutoSolving = false;
      setControlsDisabled(false);
      return;
    }

    await wait(120);
  }

  if (runId !== solveRunId) return;

  moveHistory = [];
  isAutoSolving = false;
  setControlsDisabled(false);
  stopTimer();
  messageEl.textContent = `完成！共 ${moves} 步`;
}

shuffleBtn.addEventListener("click", newGame);
resetBtn.addEventListener("click", resetToShuffle);
solveBtn.addEventListener("click", autoSolve);
sizeSelect.addEventListener("change", newGame);

document.addEventListener("keydown", (event) => {
  if (isAutoSolving) return;
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
