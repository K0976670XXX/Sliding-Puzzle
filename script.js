const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const timerEl = document.getElementById("timer");
const messageEl = document.getElementById("message");
const rankUpdateStatusEl = document.getElementById("rankUpdateStatus");
const shuffleBtn = document.getElementById("shuffleBtn");
const hintBtn = document.getElementById("hintBtn");
const solveBtn = document.getElementById("solveBtn");
const sizeSelect = document.getElementById("sizeSelect");
const previewImage = document.getElementById("previewImage");
const playerNameInput = document.getElementById("playerName");
const saveNameBtn = document.getElementById("saveNameBtn");
const leaderboardStatusEl = document.getElementById("leaderboardStatus");
const leaderboardListEl = document.getElementById("leaderboardList");
const refreshRankBtn = document.getElementById("refreshRankBtn");
const toggleLeaderboardModeBtn = document.getElementById("toggleLeaderboardModeBtn");
const replayControlsEl = document.getElementById("replayControls");
const replayPrevBtn = document.getElementById("replayPrevBtn");
const replayNextBtn = document.getElementById("replayNextBtn");
const replayStatusEl = document.getElementById("replayStatus");

const IMAGE_MANIFEST_PATH = "image/images.json";
const IMAGE_FALLBACK_FILE = "default-puzzle.png";
const STORAGE_KEYS = {
  playerName: "sliding-puzzle-player-name",
  imageId: "sliding-puzzle-image-id",
  leaderboardMode: "sliding-puzzle-leaderboard-mode",
};
const LEADERBOARD_URL = "https://jsonhosting.com/api/json/d6856351/raw";
const RANK_UPDATE_URL = "https://elaina-k0806-790289487246.asia-east1.run.app/webhook";
const LEADERBOARD_MODES = {
  steps: "steps",
  speed: "speed",
};
const SOLVER_LIMITS = {
  3: { maxExpanded: 50000, maxDurationMs: 3000 },
  4: { maxExpanded: 2500000, maxDurationMs: 30000 },
};

let size = Number(sizeSelect.value);
let tiles = [];
let moves = 0;
let elapsedMs = 0;
let timerId = null;
let timerStartedAtMs = 0;
let started = false;
let moveHistory = [];
let stateHistory = [];
let stateDepthByKey = new Map();
let replayStateKeys = [];
let replayIndex = -1;
let hintFlashTimeoutId = null;
let isAutoSolving = false;
let solveRunId = 0;
let gameCompleted = false;
let usedAutoSolve = false;
let imageCatalog = [];
let currentImageIndex = 0;
let leaderboardData = {};
let leaderboardMode = localStorage.getItem(STORAGE_KEYS.leaderboardMode) === LEADERBOARD_MODES.speed
  ? LEADERBOARD_MODES.speed
  : LEADERBOARD_MODES.steps;

function getAppBaseUrl() {
  const { origin, pathname } = window.location;
  if (pathname.endsWith("/")) {
    return new URL(origin + pathname);
  }

  const lastSlashIndex = pathname.lastIndexOf("/");
  const lastSegment = pathname.slice(lastSlashIndex + 1);
  const looksLikeFile = lastSegment.includes(".");
  const normalizedPath = looksLikeFile
    ? pathname.slice(0, lastSlashIndex + 1)
    : `${pathname}/`;

  return new URL(origin + normalizedPath);
}

function buildSolvedState(n) {
  return [...Array(n * n - 1).keys()].map((index) => index + 1).concat(0);
}

function formatTime(totalMilliseconds) {
  const normalizedMs = Math.max(0, Math.floor(Number(totalMilliseconds) || 0));
  const hours = Math.floor(normalizedMs / 3600000).toString().padStart(2, "0");
  const mins = Math.floor((normalizedMs % 3600000) / 60000).toString().padStart(2, "0");
  const secs = Math.floor((normalizedMs % 60000) / 1000).toString().padStart(2, "0");
  const ms = (normalizedMs % 1000).toString().padStart(3, "0");
  return `${hours}:${mins}:${secs}.${ms}`;
}

function parseTimeToMilliseconds(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return Number.MAX_SAFE_INTEGER;

  const parts = rawValue.split(":");
  if (parts.length < 1 || parts.length > 3) return Number.MAX_SAFE_INTEGER;

  const secondsPart = parts.pop();
  const [secondsText, millisecondsText = "0"] = secondsPart.split(".");

  const secondsValue = Number(secondsText);
  const millisecondsValue = Number(millisecondsText.padEnd(3, "0").slice(0, 3));

  if (!Number.isFinite(secondsValue) || !Number.isFinite(millisecondsValue)) {
    return Number.MAX_SAFE_INTEGER;
  }

  let hours = 0;
  let minutes = 0;

  if (parts.length === 2) {
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
  } else if (parts.length === 1) {
    minutes = Number(parts[0]);
  }

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return (hours * 3600000) + (minutes * 60000) + (secondsValue * 1000) + millisecondsValue;
}

class MinHeap {
  constructor(compare) {
    this.compare = compare;
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(value) {
    this.items.push(value);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) return null;
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  bubbleUp(index) {
    let currentIndex = index;
    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2);
      if (this.compare(this.items[currentIndex], this.items[parentIndex]) >= 0) break;
      [this.items[currentIndex], this.items[parentIndex]] = [this.items[parentIndex], this.items[currentIndex]];
      currentIndex = parentIndex;
    }
  }

  bubbleDown(index) {
    let currentIndex = index;
    const length = this.items.length;

    while (true) {
      const leftIndex = (currentIndex * 2) + 1;
      const rightIndex = leftIndex + 1;
      let smallestIndex = currentIndex;

      if (leftIndex < length && this.compare(this.items[leftIndex], this.items[smallestIndex]) < 0) {
        smallestIndex = leftIndex;
      }

      if (rightIndex < length && this.compare(this.items[rightIndex], this.items[smallestIndex]) < 0) {
        smallestIndex = rightIndex;
      }

      if (smallestIndex === currentIndex) break;

      [this.items[currentIndex], this.items[smallestIndex]] = [this.items[smallestIndex], this.items[currentIndex]];
      currentIndex = smallestIndex;
    }
  }
}

function updateStatus() {
  movesEl.textContent = String(moves);
  timerEl.textContent = formatTime(elapsedMs);
}

function setMessage(text = "") {
  messageEl.textContent = text;
}

function setRankUpdateStatus(text = "") {
  rankUpdateStatusEl.textContent = text;
}

function getRankType(mode = leaderboardMode) {
  return mode === LEADERBOARD_MODES.speed
    ? `${size}x${size}_Rank_speed`
    : `${size}x${size}_Rank`;
}

function getSubmissionRankType() {
  return `${size}x${size}_Rank`;
}

function getLeaderboardModeLabel(mode = leaderboardMode) {
  return mode === LEADERBOARD_MODES.speed ? "速度榜" : "步數榜";
}

function updateLeaderboardModeButton() {
  const nextModeLabel = leaderboardMode === LEADERBOARD_MODES.steps ? "速度榜" : "步數榜";
  toggleLeaderboardModeBtn.textContent = `查看${nextModeLabel}`;
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

function getNeighborsForSize(index, boardSize) {
  const row = Math.floor(index / boardSize);
  const col = index % boardSize;
  const neighbors = [];

  if (row > 0) neighbors.push(index - boardSize);
  if (row < boardSize - 1) neighbors.push(index + boardSize);
  if (col > 0) neighbors.push(index - 1);
  if (col < boardSize - 1) neighbors.push(index + 1);

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

  timerStartedAtMs = Date.now() - elapsedMs;
  timerId = setInterval(() => {
    elapsedMs = Date.now() - timerStartedAtMs;
    updateStatus();
  }, 33);
}

function stopTimer() {
  if (timerId) {
    elapsedMs = Date.now() - timerStartedAtMs;
  }
  clearInterval(timerId);
  timerId = null;
  timerStartedAtMs = 0;
  updateStatus();
}

function getPlayerName() {
  return playerNameInput.value.trim();
}

function getCurrentImage() {
  return imageCatalog[currentImageIndex] || null;
}

function serializeTiles() {
  return tiles.join(",");
}

function resetPathTracking() {
  const currentState = serializeTiles();
  moveHistory = [];
  stateHistory = [currentState];
  stateDepthByKey = new Map([[currentState, 0]]);
}

function clearReplayTracking() {
  replayStateKeys = [];
  replayIndex = -1;
}

function resetReplayTracking() {
  replayStateKeys = [serializeTiles()];
  replayIndex = replayStateKeys.length - 1;
}

function recordCurrentState(movedValue) {
  const stateKey = serializeTiles();
  const existingDepth = stateDepthByKey.get(stateKey);

  if (existingDepth !== undefined) {
    while (stateHistory.length - 1 > existingDepth) {
      const removedState = stateHistory.pop();
      stateDepthByKey.delete(removedState);
    }
    moveHistory.length = existingDepth;
    return;
  }

  moveHistory.push(movedValue);
  stateHistory.push(stateKey);
  stateDepthByKey.set(stateKey, stateHistory.length - 1);
}

function recordReplayState() {
  replayStateKeys.push(serializeTiles());
  replayIndex = replayStateKeys.length - 1;
}

function getReplayStepCount() {
  return Math.max(replayStateKeys.length - 1, 0);
}

function updateReplayControls() {
  if (!replayControlsEl) return;

  const hasReplay = gameCompleted && replayStateKeys.length > 1 && replayIndex >= 0;
  replayControlsEl.hidden = !hasReplay;

  if (!hasReplay) {
    replayPrevBtn.disabled = true;
    replayNextBtn.disabled = true;
    replayStatusEl.textContent = "0 / 0";
    return;
  }

  replayPrevBtn.disabled = replayIndex <= 0;
  replayNextBtn.disabled = replayIndex >= replayStateKeys.length - 1;
  replayStatusEl.textContent = `${replayIndex} / ${getReplayStepCount()}`;
}

function clearHintHighlight() {
  if (hintFlashTimeoutId) {
    clearTimeout(hintFlashTimeoutId);
    hintFlashTimeoutId = null;
  }

  const hintedTile = boardEl.querySelector(".tile.hint-target");
  if (hintedTile) {
    hintedTile.classList.remove("hint-target");
  }
}

function flashHintTile(tileValue) {
  clearHintHighlight();

  const tile = boardEl.querySelector(`.tile[data-tile-value="${tileValue}"]`);
  if (!tile) return;

  tile.classList.remove("hint-target");
  void tile.offsetWidth;
  tile.classList.add("hint-target");

  hintFlashTimeoutId = window.setTimeout(() => {
    tile.classList.remove("hint-target");
    hintFlashTimeoutId = null;
  }, 3000);
}

function updateSolveButtonVisibility() {
  if (solveBtn) {
    solveBtn.hidden = gameCompleted;
  }
  if (hintBtn) {
    hintBtn.hidden = gameCompleted || size !== 3;
  }
}

function applyReplayState(index) {
  if (!replayStateKeys.length) return;

  const nextIndex = Math.max(0, Math.min(index, replayStateKeys.length - 1));
  replayIndex = nextIndex;
  tiles = replayStateKeys[nextIndex].split(",").map(Number);
  renderBoard();
  updateReplayControls();
}

function captureReplayForFinishedGame(stateKeys = replayStateKeys) {
  replayStateKeys = [...stateKeys];
  replayIndex = replayStateKeys.length - 1;
  updateReplayControls();
}

function createGoalLookup(boardSize) {
  const total = boardSize * boardSize;
  const goalRows = new Array(total);
  const goalCols = new Array(total);

  for (let value = 1; value < total; value += 1) {
    goalRows[value] = Math.floor((value - 1) / boardSize);
    goalCols[value] = (value - 1) % boardSize;
  }

  goalRows[0] = boardSize - 1;
  goalCols[0] = boardSize - 1;

  return { goalRows, goalCols };
}

function getLinearConflict(state, boardSize, goalRows, goalCols) {
  let conflict = 0;

  for (let row = 0; row < boardSize; row += 1) {
    for (let colA = 0; colA < boardSize; colA += 1) {
      const tileA = state[(row * boardSize) + colA];
      if (tileA === 0 || goalRows[tileA] !== row) continue;

      for (let colB = colA + 1; colB < boardSize; colB += 1) {
        const tileB = state[(row * boardSize) + colB];
        if (tileB === 0 || goalRows[tileB] !== row) continue;
        if (goalCols[tileA] > goalCols[tileB]) conflict += 2;
      }
    }
  }

  for (let col = 0; col < boardSize; col += 1) {
    for (let rowA = 0; rowA < boardSize; rowA += 1) {
      const tileA = state[(rowA * boardSize) + col];
      if (tileA === 0 || goalCols[tileA] !== col) continue;

      for (let rowB = rowA + 1; rowB < boardSize; rowB += 1) {
        const tileB = state[(rowB * boardSize) + col];
        if (tileB === 0 || goalCols[tileB] !== col) continue;
        if (goalRows[tileA] > goalRows[tileB]) conflict += 2;
      }
    }
  }

  return conflict;
}

function getHeuristic(state, boardSize, goalRows, goalCols) {
  let distance = 0;

  for (let index = 0; index < state.length; index += 1) {
    const value = state[index];
    if (value === 0) continue;

    const row = Math.floor(index / boardSize);
    const col = index % boardSize;
    distance += Math.abs(goalRows[value] - row) + Math.abs(goalCols[value] - col);
  }

  return distance + getLinearConflict(state, boardSize, goalRows, goalCols);
}

function reconstructSolution(goalKey, parentByKey, moveByKey) {
  const solution = [];
  let currentKey = goalKey;

  while (parentByKey.get(currentKey) !== null) {
    solution.push(moveByKey.get(currentKey));
    currentKey = parentByKey.get(currentKey);
  }

  return solution.reverse();
}

function findShortestSolution(startState, boardSize) {
  if (boardSize > 4) {
    return {
      solution: null,
      reason: "oversize",
    };
  }

  const limits = SOLVER_LIMITS[boardSize] || SOLVER_LIMITS[4];
  const goalState = buildSolvedState(boardSize);
  const goalKey = goalState.join(",");
  const startKey = startState.join(",");

  if (startKey === goalKey) {
    return {
      solution: [],
      reason: "solved",
    };
  }

  const { goalRows, goalCols } = createGoalLookup(boardSize);
  const openSet = new MinHeap((left, right) => {
    if (left.f !== right.f) return left.f - right.f;
    return left.h - right.h;
  });
  const parentByKey = new Map([[startKey, null]]);
  const moveByKey = new Map();
  const bestCostByKey = new Map([[startKey, 0]]);
  const startedAt = performance.now();
  let expanded = 0;
  const startH = getHeuristic(startState, boardSize, goalRows, goalCols);

  openSet.push({
    state: [...startState],
    key: startKey,
    zeroIndex: startState.indexOf(0),
    g: 0,
    h: startH,
    f: startH,
  });

  while (openSet.size > 0) {
    const current = openSet.pop();
    if (!current) break;

    if (current.g !== bestCostByKey.get(current.key)) {
      continue;
    }

    if (current.key === goalKey) {
      return {
        solution: reconstructSolution(goalKey, parentByKey, moveByKey),
        reason: "shortest",
      };
    }

    expanded += 1;
    if (expanded > limits.maxExpanded || (performance.now() - startedAt) > limits.maxDurationMs) {
      return {
        solution: null,
        reason: "timeout",
      };
    }

    const neighborIndexes = getNeighborsForSize(current.zeroIndex, boardSize);
    for (const tileIndex of neighborIndexes) {
      const nextState = [...current.state];
      const movedTile = nextState[tileIndex];
      [nextState[current.zeroIndex], nextState[tileIndex]] = [nextState[tileIndex], nextState[current.zeroIndex]];

      const nextKey = nextState.join(",");
      const nextG = current.g + 1;
      if (nextG >= (bestCostByKey.get(nextKey) ?? Infinity)) {
        continue;
      }

      const nextH = getHeuristic(nextState, boardSize, goalRows, goalCols);
      bestCostByKey.set(nextKey, nextG);
      parentByKey.set(nextKey, current.key);
      moveByKey.set(nextKey, movedTile);
      openSet.push({
        state: nextState,
        key: nextKey,
        zeroIndex: tileIndex,
        g: nextG,
        h: nextH,
        f: nextG + nextH,
      });
    }
  }

  return {
    solution: null,
    reason: "unreachable",
  };
}

function applyCurrentImage({ rerender = true } = {}) {
  const currentImage = getCurrentImage();
  if (!currentImage) return;

  previewImage.src = currentImage.src;
  previewImage.alt = currentImage.alt;
  localStorage.setItem(STORAGE_KEYS.imageId, currentImage.id);

  if (rerender && tiles.length) {
    renderBoard();
  }
}

function setControlsDisabled(disabled) {
  shuffleBtn.disabled = disabled;
  sizeSelect.disabled = disabled;
  if (hintBtn) {
    hintBtn.disabled = disabled;
  }
  solveBtn.disabled = disabled;
}

function renderBoard() {
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  boardEl.dataset.size = String(size);

  const currentImage = getCurrentImage();
  const showIndexes = size >= 5;

  tiles.forEach((value, index) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.dataset.tileValue = String(value);
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

      tile.setAttribute("aria-label", `拼圖片 ${value}`);
      tile.style.backgroundImage = currentImage ? `url("${currentImage.src}")` : "none";
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

    if (showIndexes) {
      const indexBadge = document.createElement("span");
      indexBadge.className = "tile-index";
      indexBadge.textContent = String(value);
      tile.appendChild(indexBadge);
    }

    boardEl.appendChild(tile);
  });

  updateStatus();
}

function shuffleByLegalMoves(steps = 200) {
  tiles = buildSolvedState(size);
  resetPathTracking();
  let emptyIndex = getEmptyIndex();
  let previousIndex = -1;

  for (let index = 0; index < steps; index += 1) {
    let choices = getNeighbors(emptyIndex).filter((neighbor) => neighbor !== previousIndex);
    if (choices.length === 0) choices = getNeighbors(emptyIndex);

    const nextIndex = choices[Math.floor(Math.random() * choices.length)];
    const movedValue = tiles[nextIndex];
    [tiles[emptyIndex], tiles[nextIndex]] = [tiles[nextIndex], tiles[emptyIndex]];
    recordCurrentState(movedValue);
    previousIndex = emptyIndex;
    emptyIndex = nextIndex;
  }

  if (isSolved()) {
    shuffleByLegalMoves(steps + 20);
    return;
  }

  resetReplayTracking();
}

function resetProgress() {
  stopTimer();
  moves = 0;
  elapsedMs = 0;
  started = false;
  gameCompleted = false;
  clearHintHighlight();
  clearReplayTracking();
  updateSolveButtonVisibility();
  updateStatus();
  setMessage("");
  setRankUpdateStatus("");
  updateReplayControls();
}

function cancelAutoSolve() {
  solveRunId += 1;
  if (!isAutoSolving) return;

  isAutoSolving = false;
  setControlsDisabled(false);
}

function moveTile(index, options = {}) {
  const {
    trackHistory = true,
    trackReplay = true,
    updateMessage = true,
  } = options;

  if (isAutoSolving && trackHistory) return false;
  if (gameCompleted) return false;
  if (!canMove(index)) return false;

  const movedValue = tiles[index];
  const emptyIndex = getEmptyIndex();
  [tiles[index], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[index]];
  moves += 1;

  if (trackHistory) {
    recordCurrentState(movedValue);
  }

  if (trackReplay) {
    recordReplayState();
  }

  if (!started) {
    started = true;
    startTimer();
  }

  renderBoard();

  if (isSolved()) {
    if (updateMessage) {
      finishGame();
    }
  } else if (updateMessage) {
    setMessage("");
  }

  return true;
}

function newGame() {
  cancelAutoSolve();
  size = Number(sizeSelect.value);
  usedAutoSolve = false;
  resetProgress();
  shuffleByLegalMoves(size * size * 30);
  selectRandomImage({ rerender: false });
  renderBoard();
  renderLeaderboard();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function autoSolve() {
  if (isAutoSolving || gameCompleted || isSolved()) return;
  if (!moveHistory.length) return;

  usedAutoSolve = true;
  isAutoSolving = true;
  const runId = ++solveRunId;
  setControlsDisabled(true);
  setMessage("正在計算最短路徑...");
  setRankUpdateStatus("此局使用自動還原，不會送出榜單。");

  await wait(20);
  if (runId !== solveRunId) return;

  const shortestResult = findShortestSolution([...tiles], size);
  let solution = shortestResult.solution;
  let solvingMessage = "正在執行最短路徑還原...";

  if (!solution) {
    solution = [...moveHistory].reverse();
    if (shortestResult.reason === "oversize") {
      solvingMessage = "5x5 / 6x6 最短路徑搜尋成本過高，改用回溯還原。";
    } else if (shortestResult.reason === "timeout") {
      solvingMessage = "最短路徑計算時間過長，改用回溯還原。";
    } else {
      solvingMessage = "最短路徑計算失敗，改用回溯還原。";
    }
  }

  setMessage(solvingMessage);
  const stepDelay = solution.length >= 160 ? 15 : solution.length >= 80 ? 28 : 60;

  for (const tileValue of solution) {
    if (runId !== solveRunId) return;

    const tileIndex = tiles.indexOf(tileValue);
    const moved = moveTile(tileIndex, { trackHistory: false, updateMessage: false });
    if (!moved) {
      setMessage("自動還原失敗，請重新開始新局。");
      isAutoSolving = false;
      setControlsDisabled(false);
      return;
    }

    await wait(stepDelay);
  }

  if (runId !== solveRunId) return;

  moveHistory = [];
  stateHistory = [serializeTiles()];
  stateDepthByKey = new Map([[stateHistory[0], 0]]);
  isAutoSolving = false;
  setControlsDisabled(false);
  finishGame({
    allowRankSubmission: false,
    customMessage: `已完成自動還原，總步數 ${moves}，時間 ${formatTime(elapsedMs)}`,
  });
}

function showHint() {
  if (size !== 3 || gameCompleted || isAutoSolving || isSolved()) return;

  const hintResult = findShortestSolution([...tiles], size);
  const nextTileValue = hintResult.solution?.[0];

  if (!Number.isFinite(nextTileValue)) {
    setMessage("目前無法提供提示，請稍後再試。");
    return;
  }

  flashHintTile(nextTileValue);
  setMessage(`提示：下一步請移動 ${nextTileValue} 號方塊`);
}

function normalizeRankEntries(entries) {
  if (!Array.isArray(entries)) return [];

  return entries
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      name: String(entry.name || "").trim(),
      Steps: Number(entry.Steps),
      Time: String(entry.Time || "00:00:00.000"),
    }))
    .filter((entry) => entry.name && Number.isFinite(entry.Steps));
}

function sortRankEntries(entries, mode = leaderboardMode) {
  return [...entries].sort((left, right) => {
    if (mode === LEADERBOARD_MODES.speed) {
      const timeDifference = parseTimeToMilliseconds(left.Time) - parseTimeToMilliseconds(right.Time);
      if (timeDifference !== 0) return timeDifference;
      if (left.Steps !== right.Steps) return left.Steps - right.Steps;
      return left.name.localeCompare(right.name, "zh-Hant");
    }

    if (left.Steps !== right.Steps) return left.Steps - right.Steps;
    const timeDifference = parseTimeToMilliseconds(left.Time) - parseTimeToMilliseconds(right.Time);
    if (timeDifference !== 0) return timeDifference;
    return left.name.localeCompare(right.name, "zh-Hant");
  });
}

function renderLeaderboard() {
  const rankType = getRankType();
  const currentName = getPlayerName();
  const entries = sortRankEntries(normalizeRankEntries(leaderboardData[rankType]), leaderboardMode);

  leaderboardListEl.innerHTML = "";

  if (entries.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "leaderboard-empty";
    emptyItem.textContent = `${size}x${size} ${getLeaderboardModeLabel()}目前沒有資料`;
    leaderboardListEl.appendChild(emptyItem);
  } else {
    entries.forEach((entry, index) => {
      const item = document.createElement("li");
      item.className = "leaderboard-item";

      if (currentName && entry.name === currentName) {
        item.classList.add("current-player");
      }

      const rankBadge = document.createElement("span");
      rankBadge.className = "leaderboard-rank";
      rankBadge.textContent = String(index + 1);

      const infoWrap = document.createElement("div");
      const nameEl = document.createElement("div");
      const metaEl = document.createElement("div");

      nameEl.className = "leaderboard-name";
      nameEl.textContent = entry.name;

      metaEl.className = "leaderboard-meta";
      metaEl.textContent = `步數 ${entry.Steps} ｜ 時間 ${entry.Time}`;

      infoWrap.appendChild(nameEl);
      infoWrap.appendChild(metaEl);
      item.appendChild(rankBadge);
      item.appendChild(infoWrap);
      leaderboardListEl.appendChild(item);
    });
  }

  leaderboardStatusEl.textContent = `目前顯示 ${size}x${size} ${getLeaderboardModeLabel()}`;
  updateLeaderboardModeButton();
}

async function fetchLeaderboardData() {
  const response = await fetch(LEADERBOARD_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`排行榜讀取失敗：${response.status}`);
  }

  const payload = await response.json();
  return payload?.Sliding_Puzzle || {};
}

async function refreshLeaderboard({ silent = false } = {}) {
  if (!silent) {
    leaderboardStatusEl.textContent = "排行榜讀取中...";
  }

  try {
    leaderboardData = await fetchLeaderboardData();
    renderLeaderboard();
    return leaderboardData;
  } catch (error) {
    console.error(error);
    leaderboardStatusEl.textContent = "排行榜讀取失敗";
    renderLeaderboard();
    throw error;
  }
}

function getBestRankForName(entries, name, mode) {
  const sameNameEntries = normalizeRankEntries(entries).filter((entry) => entry.name === name);
  if (!sameNameEntries.length) return null;

  if (mode === LEADERBOARD_MODES.speed) {
    return Math.min(...sameNameEntries.map((entry) => parseTimeToMilliseconds(entry.Time)));
  }

  return Math.min(...sameNameEntries.map((entry) => entry.Steps));
}

async function maybeSubmitRank(result) {
  const {
    playerName,
    moves: finalMoves,
    time: finalTime,
  } = result;

  if (!playerName) {
    setRankUpdateStatus("未送出榜單：請先設定玩家名稱。");
    return;
  }

  setRankUpdateStatus("正在比對排行榜...");

  let latestLeaderboard;
  try {
    latestLeaderboard = await refreshLeaderboard({ silent: true });
  } catch (error) {
    setRankUpdateStatus("無法讀取最新榜單，這次未送出成績。");
    return;
  }

  const stepBest = getBestRankForName(
    latestLeaderboard[getRankType(LEADERBOARD_MODES.steps)],
    playerName,
    LEADERBOARD_MODES.steps,
  );
  const speedBest = getBestRankForName(
    latestLeaderboard[getRankType(LEADERBOARD_MODES.speed)],
    playerName,
    LEADERBOARD_MODES.speed,
  );
  const finalTimeMs = parseTimeToMilliseconds(finalTime);

  const improvedSteps = stepBest === null || finalMoves < stepBest;
  const improvedSpeed = speedBest === null || finalTimeMs < speedBest;

  if (!improvedSteps && !improvedSpeed) {
    setRankUpdateStatus(`未送出榜單：最佳步數 ${stepBest}，最佳時間 ${formatTime(speedBest)}。`);
    return;
  }

  const payload = {
    event: "Sliding.Puzzle",
    content: {
      type: getSubmissionRankType(),
      data: {
        name: playerName,
        Steps: finalMoves,
        Time: finalTime,
      },
    },
  };

  try {
    const response = await fetch(RANK_UPDATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`榜單更新失敗：${response.status}`);
    }

    const reasons = [];
    if (improvedSteps) reasons.push("步數榜");
    if (improvedSpeed) reasons.push("速度榜");

    setRankUpdateStatus(`已送出榜單更新：${reasons.join("、")}。`);
    await refreshLeaderboard({ silent: false });
  } catch (error) {
    console.error(error);
    setRankUpdateStatus("榜單更新失敗，請稍後再試。");
  }
}

function finishGame(options = {}) {
  const {
    allowRankSubmission = true,
    customMessage,
    replayStates,
  } = options;

  if (gameCompleted) return;

  gameCompleted = true;
  clearHintHighlight();
  stopTimer();
  updateSolveButtonVisibility();

  const result = {
    playerName: getPlayerName(),
    moves,
    time: formatTime(elapsedMs),
  };
  const message = customMessage || `完成！步數 ${result.moves}，時間 ${result.time}`;
  setMessage(message);
  captureReplayForFinishedGame(replayStates || replayStateKeys);

  if (allowRankSubmission && !usedAutoSolve) {
    void maybeSubmitRank(result);
  }
}

function normalizeImageManifest(manifest, manifestUrl) {
  const images = Array.isArray(manifest)
    ? manifest
    : Array.isArray(manifest?.images)
      ? manifest.images
      : [];

  return images
    .map((item, index) => {
      const file = String(item?.file || item?.src || "").trim();
      if (!file) return null;

      const id = String(item?.id || `image-${index + 1}`);
      const name = String(item?.name || `圖片 ${index + 1}`);
      const alt = String(item?.alt || `${name} 原圖預覽`);

      return {
        id,
        name,
        alt,
        src: new URL(file, manifestUrl).href,
      };
    })
    .filter(Boolean);
}

async function loadImageCatalog() {
  const manifestUrl = new URL(IMAGE_MANIFEST_PATH, getAppBaseUrl());
  const fallbackCatalog = normalizeImageManifest({
    images: [
      {
        id: "default-puzzle",
        name: "預設拼圖",
        file: IMAGE_FALLBACK_FILE,
        alt: "預設拼圖原圖預覽",
      },
    ],
  }, manifestUrl);

  try {
    const response = await fetch(manifestUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`圖片清單讀取失敗：${response.status}`);
    }

    const manifest = await response.json();
    imageCatalog = normalizeImageManifest(manifest, manifestUrl);

    if (!imageCatalog.length) {
      throw new Error("圖片清單中沒有可用圖片");
    }
  } catch (error) {
    console.error(error);
    imageCatalog = fallbackCatalog;
  }

  selectRandomImage({ rerender: false });
}

function savePlayerName() {
  const name = getPlayerName();

  if (name) {
    localStorage.setItem(STORAGE_KEYS.playerName, name);
    setRankUpdateStatus("玩家名稱已儲存。");
  } else {
    localStorage.removeItem(STORAGE_KEYS.playerName);
    setRankUpdateStatus("玩家名稱已清除。");
  }

  renderLeaderboard();
}

function loadSavedPlayerName() {
  const savedName = localStorage.getItem(STORAGE_KEYS.playerName);
  if (savedName) {
    playerNameInput.value = savedName;
  }
}

function selectRandomImage({ rerender = true } = {}) {
  if (!imageCatalog.length) return;

  currentImageIndex = Math.floor(Math.random() * imageCatalog.length);
  applyCurrentImage({ rerender });
}

function toggleLeaderboardMode() {
  leaderboardMode = leaderboardMode === LEADERBOARD_MODES.steps
    ? LEADERBOARD_MODES.speed
    : LEADERBOARD_MODES.steps;

  localStorage.setItem(STORAGE_KEYS.leaderboardMode, leaderboardMode);
  renderLeaderboard();
}

function showPreviousReplayStep() {
  if (!gameCompleted || replayIndex <= 0) return;
  applyReplayState(replayIndex - 1);
}

function showNextReplayStep() {
  if (!gameCompleted || replayIndex >= replayStateKeys.length - 1) return;
  applyReplayState(replayIndex + 1);
}

shuffleBtn.addEventListener("click", newGame);
hintBtn.addEventListener("click", showHint);
solveBtn.addEventListener("click", autoSolve);
sizeSelect.addEventListener("change", () => {
  newGame();
  void refreshLeaderboard().catch(() => {});
});
saveNameBtn.addEventListener("click", savePlayerName);
playerNameInput.addEventListener("change", savePlayerName);
refreshRankBtn.addEventListener("click", () => {
  void refreshLeaderboard().catch(() => {});
});
toggleLeaderboardModeBtn.addEventListener("click", toggleLeaderboardMode);
replayPrevBtn.addEventListener("click", showPreviousReplayStep);
replayNextBtn.addEventListener("click", showNextReplayStep);

document.addEventListener("keydown", (event) => {
  const tagName = document.activeElement?.tagName;
  if (tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA") return;

  if (gameCompleted) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPreviousReplayStep();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      showNextReplayStep();
    }
    return;
  }

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

async function initialize() {
  loadSavedPlayerName();
  await loadImageCatalog();
  newGame();
  updateLeaderboardModeButton();

  try {
    await refreshLeaderboard();
  } catch (error) {
    setRankUpdateStatus("目前無法讀取排行榜，稍後仍可手動重新整理。");
  }
}

void initialize();
