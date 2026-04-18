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

function updateStatus() {
  if (reviewComparison && !isReviewMode) {
    movesEl.textContent = `${reviewComparison.reviewMoves}(${reviewComparison.originalMoves})`;
    timerEl.textContent = `${formatTime(reviewComparison.reviewElapsedMs)}(${formatTime(reviewComparison.originalElapsedMs)})`;
    if (reviewSolveBtn) {
      reviewSolveBtn.hidden = true;
      reviewSolveBtn.disabled = true;
    }
    if (reviewSolveBtn) {
      reviewSolveBtn.hidden = true;
      reviewSolveBtn.disabled = true;
    }
    if (reviewSolveBtn) {
      reviewSolveBtn.hidden = true;
      reviewSolveBtn.disabled = true;
    }
    if (reviewSolveBtn) {
      reviewSolveBtn.hidden = true;
      reviewSolveBtn.disabled = true;
    }
    return;
  }

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

function getRequestedImageId() {
  const params = new URLSearchParams(window.location.search);
  const queryImageId = params.get("image");
  if (queryImageId) return queryImageId.trim();

  const pendingImageId = localStorage.getItem(STORAGE_KEYS.pendingImageId);
  return pendingImageId ? pendingImageId.trim() : "";
}

function setCurrentImageById(imageId, { rerender = true } = {}) {
  const nextIndex = imageCatalog.findIndex((item) => item.id === imageId);
  if (nextIndex === -1) return false;

  currentImageIndex = nextIndex;
  applyCurrentImage({ rerender });
  return true;
}

function applyRequestedImageSelection({ rerender = true } = {}) {
  const requestedImageId = getRequestedImageId();
  localStorage.removeItem(STORAGE_KEYS.pendingImageId);

  if (!requestedImageId) return false;
  return setCurrentImageById(requestedImageId, { rerender });
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

function clearReviewState() {
  isReviewMode = false;
  reviewSourceReplayStateKeys = [];
  reviewSourceMoves = 0;
  reviewSourceElapsedMs = 0;
  reviewComparison = null;
  autoReplayStateKeys = [];
  autoReplayStepCount = null;
  replayRouteMode = "player";
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
  replayRouteMode = "player";
  if (replayIndex < replayStateKeys.length - 1) {
    replayStateKeys = replayStateKeys.slice(0, replayIndex + 1);
  }
  replayStateKeys.push(serializeTiles());
  replayIndex = replayStateKeys.length - 1;
}

function canUseAutoReplayReference() {
  return size === 3 || size === 4;
}

function getDisplayedReplayStateKeys() {
  if (replayRouteMode === "auto" && autoReplayStateKeys.length) {
    return autoReplayStateKeys;
  }

  return replayStateKeys;
}

function getReplayStepCount() {
  return Math.max(getDisplayedReplayStateKeys().length - 1, 0);
}

function applyTileMoveToState(state, boardSize, movedTile) {
  const nextState = [...state];
  const zeroIndex = nextState.indexOf(0);
  const tileIndex = nextState.indexOf(movedTile);

  if (zeroIndex === -1 || tileIndex === -1) return null;
  if (!getNeighborsForSize(zeroIndex, boardSize).includes(tileIndex)) return null;

  [nextState[zeroIndex], nextState[tileIndex]] = [nextState[tileIndex], nextState[zeroIndex]];
  return nextState;
}

function buildReplayStateKeysFromMoves(startState, moveSequence, boardSize) {
  const states = [startState.join(",")];
  let currentState = [...startState];

  for (const movedTile of moveSequence) {
    const nextState = applyTileMoveToState(currentState, boardSize, movedTile);
    if (!nextState) return [];
    currentState = nextState;
    states.push(currentState.join(","));
  }

  return states;
}

async function prepareAutoReplayReference() {
  autoReplayStateKeys = [];
  autoReplayStepCount = null;
  replayRouteMode = "player";

  if (!canUseAutoReplayReference() || !reviewSourceReplayStateKeys.length) {
    return false;
  }

  const startState = reviewSourceReplayStateKeys[0].split(",").map(Number);
  const result = findShortestSolution(startState, size);
  if (!result?.solution?.length && !(Array.isArray(result?.solution) && result.solution.length === 0)) {
    return false;
  }

  const nextReplayStateKeys = buildReplayStateKeysFromMoves(startState, result.solution, size);
  if (!nextReplayStateKeys.length) {
    return false;
  }

  autoReplayStateKeys = nextReplayStateKeys;
  autoReplayStepCount = Math.max(nextReplayStateKeys.length - 1, 0);
  return true;
}

function updateReplayControls() {
  if (!replayControlsEl) return;

  const displayedReplayStateKeys = getDisplayedReplayStateKeys();
  const hasReplay = (gameCompleted || isReviewMode) && replayIndex >= 0 && (displayedReplayStateKeys.length > 1 || isReviewMode);
  replayControlsEl.hidden = !hasReplay;

  if (!hasReplay) {
    if (replayFirstBtn) replayFirstBtn.disabled = true;
    replayPrevBtn.disabled = true;
    replayNextBtn.disabled = true;
    if (replayLastBtn) replayLastBtn.disabled = true;
    replayStatusEl.textContent = "0 / 0";
    if (autoReplayInfoEl) {
      autoReplayInfoEl.hidden = true;
      autoReplayInfoEl.textContent = "自動還原：-- 步";
    }
    if (replayRouteToggleBtn) {
      replayRouteToggleBtn.hidden = true;
      replayRouteToggleBtn.disabled = true;
      replayRouteToggleBtn.textContent = "查看自動還原";
    }
    if (reviewModeBtn) {
      reviewModeBtn.textContent = "開始復盤";
      reviewModeBtn.hidden = true;
      reviewModeBtn.disabled = true;
    }
    return;
  }

  if (replayFirstBtn) replayFirstBtn.disabled = replayIndex <= 0;
  replayPrevBtn.disabled = replayIndex <= 0;
  replayNextBtn.disabled = replayIndex >= displayedReplayStateKeys.length - 1;
  if (replayLastBtn) replayLastBtn.disabled = replayIndex >= displayedReplayStateKeys.length - 1;
  replayStatusEl.textContent = `${replayIndex} / ${getReplayStepCount()}`;
  if (autoReplayInfoEl) {
    autoReplayInfoEl.hidden = !canUseAutoReplayReference() || autoReplayStepCount === null;
    autoReplayInfoEl.textContent = autoReplayStepCount === null
      ? "自動還原：-- 步"
      : `自動還原：${autoReplayStepCount} 步`;
  }
  if (replayRouteToggleBtn) {
    const canToggleReplayRoute = canUseAutoReplayReference() && autoReplayStateKeys.length > 1;
    replayRouteToggleBtn.hidden = !canToggleReplayRoute;
    replayRouteToggleBtn.disabled = !canToggleReplayRoute;
    replayRouteToggleBtn.textContent = replayRouteMode === "auto" ? "查看玩家路徑" : "查看自動還原";
  }
  if (reviewSolveBtn) {
    reviewSolveBtn.hidden = !isReviewMode;
    reviewSolveBtn.disabled = !isReviewMode || isAutoSolving || replayRouteMode === "auto" || isSolved();
  }
  if (reviewModeBtn) {
    reviewModeBtn.textContent = isReviewMode ? "結束復盤" : "開始復盤";
    reviewModeBtn.hidden = !gameCompleted || isReviewMode;
    reviewModeBtn.disabled = isAutoSolving || !gameCompleted;
  }
  if (isReviewMode) {
    if (canUseAutoReplayReference() && autoReplayStepCount !== null) {
      setRankUpdateStatus(`復盤參考：自動還原最佳步數 ${autoReplayStepCount} 步，目前查看${replayRouteMode === "auto" ? "自動還原路徑" : "玩家路徑"}。`);
    } else {
      setRankUpdateStatus("復盤模式中的調整不會送出排行榜成績。");
    }
  }
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
    solveBtn.hidden = gameCompleted || isReviewMode;
  }
  if (hintBtn) {
    hintBtn.hidden = gameCompleted || isReviewMode || size !== 3;
  }
}

function applyReplayState(index) {
  const displayedReplayStateKeys = getDisplayedReplayStateKeys();
  if (!displayedReplayStateKeys.length) return;

  const nextIndex = Math.max(0, Math.min(index, displayedReplayStateKeys.length - 1));
  replayIndex = nextIndex;
  tiles = displayedReplayStateKeys[nextIndex].split(",").map(Number);
  if (isReviewMode && replayRouteMode === "player") {
    moves = nextIndex;
  }
  renderBoard();
  updateReplayControls();
}

function captureReplayForFinishedGame(stateKeys = replayStateKeys) {
  replayStateKeys = [...stateKeys];
  replayIndex = replayStateKeys.length - 1;
  updateReplayControls();
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
  if (reviewModeBtn) {
    reviewModeBtn.disabled = disabled || (!(gameCompleted || isReviewMode) && !replayStateKeys.length);
  }
  if (replayRouteToggleBtn) {
    replayRouteToggleBtn.disabled = disabled || replayRouteToggleBtn.hidden;
  }
  if (reviewSolveBtn) {
    reviewSolveBtn.disabled = disabled || reviewSolveBtn.hidden || replayRouteMode === "auto";
  }
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
  clearReviewState();
  clearHintHighlight();
  clearReplayTracking();
  if (autoReplayInfoEl) {
    autoReplayInfoEl.hidden = true;
    autoReplayInfoEl.textContent = "自動還原：-- 步";
  }
  if (replayRouteToggleBtn) {
    replayRouteToggleBtn.hidden = true;
    replayRouteToggleBtn.disabled = true;
  }
  if (reviewSolveBtn) {
    reviewSolveBtn.hidden = true;
    reviewSolveBtn.disabled = true;
  }
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
  if (isReviewMode && replayRouteMode === "auto") {
    if (updateMessage) {
      setMessage("目前正在查看自動還原路徑，切回玩家路徑後才能調整自己的走法。");
    }
    return false;
  }
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
      finishGame(isReviewMode
        ? {
            allowRankSubmission: false,
            customMessage: "復盤完成，這條調整後的路線不會送出成績。",
          }
        : {});
      if (isReviewMode) {
        finalizeCompletedReviewMode();
      }
    }
  } else if (updateMessage) {
    setMessage(isReviewMode ? "復盤模式：你可以從目前步數重新調整路線，這局不會送出成績。" : "");
  }

  return true;
}

function newGame(options = {}) {
  const { preserveImage = false } = options;

  cancelAutoSolve();
  size = Number(sizeSelect.value);
  usedAutoSolve = false;
  resetProgress();
  shuffleByLegalMoves(size * size * 30);
  if (!preserveImage || !getCurrentImage()) {
    selectRandomImage({ rerender: false });
  } else {
    applyCurrentImage({ rerender: false });
  }
  renderBoard();
  renderLeaderboard();
}

async function enterReviewMode() {
  if (!gameCompleted || replayIndex < 0 || isAutoSolving) return;

  reviewSourceReplayStateKeys = [...replayStateKeys];
  reviewSourceMoves = moves;
  reviewSourceElapsedMs = elapsedMs;
  reviewComparison = null;
  replayRouteMode = "player";
  if (reviewModeBtn) {
    reviewModeBtn.disabled = true;
  }
  if (canUseAutoReplayReference()) {
    await Promise.resolve();
    const prepared = await prepareAutoReplayReference();
    if (prepared) {
      setRankUpdateStatus(`復盤參考：自動還原最佳步數 ${autoReplayStepCount} 步，可切換路徑查看。`);
    } else {
      setRankUpdateStatus("復盤模式中的調整不會送出排行榜成績。");
    }
  } else {
    autoReplayStateKeys = [];
    autoReplayStepCount = null;
    setRankUpdateStatus("復盤模式中的調整不會送出排行榜成績。");
  }
  replayStateKeys = replayStateKeys.slice(0, replayIndex + 1);
  replayIndex = replayStateKeys.length - 1;
  tiles = replayStateKeys[replayIndex].split(",").map(Number);
  moves = replayIndex;
  stopTimer();
  started = true;
  gameCompleted = false;
  isReviewMode = true;
  resetPathTracking();
  if (canUseAutoReplayReference() && autoReplayStepCount !== null) {
    setRankUpdateStatus(`復盤參考：自動還原最佳步數 ${autoReplayStepCount} 步，可切換路徑查看。`);
  } else {
    setRankUpdateStatus("復盤模式中的調整不會送出排行榜成績。");
  }
  setMessage("復盤模式：你可以從目前步數重新調整路線，這局不會送出成績。");
  setRankUpdateStatus("復盤模式中的調整不會送出排行榜成績。");
  updateSolveButtonVisibility();
  renderBoard();
  updateReplayControls();
}

function exitReviewMode() {
  if (!isReviewMode) return;

  isReviewMode = false;
  gameCompleted = true;
  stopTimer();
  started = false;

  if (reviewSourceReplayStateKeys.length) {
    replayStateKeys = [...reviewSourceReplayStateKeys];
    replayIndex = replayStateKeys.length - 1;
    tiles = replayStateKeys[replayIndex].split(",").map(Number);
    moves = reviewSourceMoves;
    elapsedMs = reviewSourceElapsedMs;
  }

  setMessage("已回到原本的通關路線，你也可以再次選一步重新復盤。");
  setRankUpdateStatus("");
  renderBoard();
  if (reviewComparison) {
    setMessage(`復盤成績：${reviewComparison.reviewMoves} 步（原始 ${reviewComparison.originalMoves} 步），${formatTime(reviewComparison.reviewElapsedMs)}（原始 ${formatTime(reviewComparison.originalElapsedMs)}）。`);
    setRankUpdateStatus("復盤模式僅供檢討路線，調整後的成績不會送出排行榜。");
  }
  updateSolveButtonVisibility();
  updateReplayControls();
  reviewSourceReplayStateKeys = [];
  reviewSourceMoves = 0;
  reviewSourceElapsedMs = 0;
}

function finalizeCompletedReviewMode() {
  if (!isReviewMode || !reviewComparison) return;

  const shouldAdoptBetterPath = reviewComparison.reviewMoves < reviewComparison.originalMoves;

  isReviewMode = false;
  gameCompleted = true;
  stopTimer();
  started = false;

  if (shouldAdoptBetterPath) {
    replayIndex = replayStateKeys.length - 1;
    tiles = replayStateKeys[replayIndex].split(",").map(Number);
    moves = reviewComparison.reviewMoves;
    elapsedMs = reviewComparison.reviewElapsedMs;
    setMessage(`復盤成績：${reviewComparison.reviewMoves} 步（原始 ${reviewComparison.originalMoves} 步），已採用步數更少的新路線。`);
  } else {
    if (reviewSourceReplayStateKeys.length) {
      replayStateKeys = [...reviewSourceReplayStateKeys];
      replayIndex = replayStateKeys.length - 1;
      tiles = replayStateKeys[replayIndex].split(",").map(Number);
      moves = reviewSourceMoves;
      elapsedMs = reviewSourceElapsedMs;
    }
    setMessage(`復盤成績：${reviewComparison.reviewMoves} 步（原始 ${reviewComparison.originalMoves} 步），已保留原本較佳的路線。`);
  }

  setRankUpdateStatus("復盤模式僅供檢討路線，調整後的成績不會送出排行榜。");
  renderBoard();
  updateSolveButtonVisibility();
  updateReplayControls();
  reviewSourceReplayStateKeys = [];
  reviewSourceMoves = 0;
  reviewSourceElapsedMs = 0;
}

function toggleReplayRouteMode() {
  if (!canUseAutoReplayReference() || autoReplayStateKeys.length <= 1) return;

  replayRouteMode = replayRouteMode === "auto" ? "player" : "auto";
  const displayedReplayStateKeys = getDisplayedReplayStateKeys();
  replayIndex = Math.max(0, Math.min(replayIndex, displayedReplayStateKeys.length - 1));
  applyReplayState(replayIndex);
}

function solveCurrentReviewState() {
  if (!isReviewMode) return;
  if (replayRouteMode === "auto") {
    setMessage("目前正在查看自動還原路徑，切回玩家路徑後才能根據當前版面求解。");
    return;
  }

  void autoSolve();
}

function toggleReviewMode() {
  if (isReviewMode) {
    exitReviewMode();
    return;
  }

  void enterReviewMode();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function autoSolve() {
  if (isAutoSolving || gameCompleted || isSolved()) return;
  if (!moveHistory.length && !isReviewMode) return;

  usedAutoSolve = true;
  isAutoSolving = true;
  const runId = ++solveRunId;
  setControlsDisabled(true);
  setMessage("正在計算最短路徑...");
  setRankUpdateStatus("此局使用自動還原，不會送出榜單。");

  await wait(20);
  if (runId !== solveRunId) return;

  const fallbackSolution = [...moveHistory].reverse();
  const shortestResult = findShortestSolution([...tiles], size, { fallbackSolution });
  let solution = shortestResult.solution;
  let solvingMessage = "正在計算自動還原路徑...";

  if (solution) {
    if (shortestResult.method === "bfs") {
      solvingMessage = "3x3 使用 BFS 找到最佳解，正在自動還原...";
    } else if (shortestResult.method === "weighted-a*" && size === 5) {
      solvingMessage = "5x5 使用 Weighted A* + Linear Conflict 搜尋中，正在自動還原...";
    } else if (shortestResult.method === "weighted-a*") {
      solvingMessage = "4x4 使用 Weighted A* + Linear Conflict 搜尋中，正在自動還原...";
    } else if (shortestResult.method === "layered") {
      solvingMessage = "5x5 / 6x6 使用分階段解法，正在自動還原...";
    } else if (shortestResult.method === "layered-guided") {
      solvingMessage = "5x5 / 6x6 使用分階段解法 + 導引路徑補強，正在自動還原...";
    } else if (shortestResult.method === "rollback") {
      solvingMessage = "5x5 / 6x6 分階段搜尋未收斂，改用回溯路徑穩定還原...";
    }
  } else {
    solution = fallbackSolution;
    if (shortestResult.method === "layered") {
      solvingMessage = "分階段解法未完成，改用回溯還原。";
    } else if (shortestResult.reason === "timeout") {
      solvingMessage = "求解計算時間過長，改用回溯還原。";
    } else {
      solvingMessage = "求解計算失敗，改用回溯還原。";
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
  if (isReviewMode) {
    finalizeCompletedReviewMode();
  }
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
  if (isReviewMode) {
    reviewComparison = {
      originalMoves: reviewSourceMoves,
      originalElapsedMs: reviewSourceElapsedMs,
      reviewMoves: moves,
      reviewElapsedMs: elapsedMs,
    };
  }
  const message = customMessage || `完成！步數 ${result.moves}，時間 ${result.time}`;
  setMessage(message);
  captureReplayForFinishedGame(replayStates || replayStateKeys);

  if (allowRankSubmission && !usedAutoSolve && !isReviewMode) {
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
  if ((!gameCompleted && !isReviewMode) || replayIndex <= 0) return;
  applyReplayState(replayIndex - 1);
}

function showNextReplayStep() {
  const displayedReplayStateKeys = getDisplayedReplayStateKeys();
  if ((!gameCompleted && !isReviewMode) || replayIndex >= displayedReplayStateKeys.length - 1) return;
  applyReplayState(replayIndex + 1);
}

function showFirstReplayStep() {
  if ((!gameCompleted && !isReviewMode) || replayIndex <= 0) return;
  applyReplayState(0);
}

function showLastReplayStep() {
  const displayedReplayStateKeys = getDisplayedReplayStateKeys();
  if ((!gameCompleted && !isReviewMode) || replayIndex >= displayedReplayStateKeys.length - 1) return;
  applyReplayState(displayedReplayStateKeys.length - 1);
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
if (replayFirstBtn) {
  replayFirstBtn.addEventListener("click", showFirstReplayStep);
}
replayPrevBtn.addEventListener("click", showPreviousReplayStep);
replayNextBtn.addEventListener("click", showNextReplayStep);
if (replayLastBtn) {
  replayLastBtn.addEventListener("click", showLastReplayStep);
}
if (replayRouteToggleBtn) {
  replayRouteToggleBtn.addEventListener("click", toggleReplayRouteMode);
}
if (reviewSolveBtn) {
  reviewSolveBtn.addEventListener("click", solveCurrentReviewState);
}
if (reviewModeBtn) {
  reviewModeBtn.addEventListener("click", toggleReviewMode);
}

document.addEventListener("keydown", (event) => {
  const tagName = document.activeElement?.tagName;
  if (tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA") return;

  if (gameCompleted || isReviewMode) {
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
  const hasRequestedImage = applyRequestedImageSelection({ rerender: false });
  newGame({ preserveImage: hasRequestedImage });
  updateLeaderboardModeButton();

  try {
    await refreshLeaderboard();
  } catch (error) {
    setRankUpdateStatus("目前無法讀取排行榜，稍後仍可手動重新整理。");
  }
}

void initialize();
