const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const timerEl = document.getElementById("timer");
const messageEl = document.getElementById("message");
const rankUpdateStatusEl = document.getElementById("rankUpdateStatus");
const shuffleBtn = document.getElementById("shuffleBtn");
const resetBtn = document.getElementById("resetBtn");
const solveBtn = document.getElementById("solveBtn");
const sizeSelect = document.getElementById("sizeSelect");
const previewImage = document.getElementById("previewImage");
const playerNameInput = document.getElementById("playerName");
const saveNameBtn = document.getElementById("saveNameBtn");
const imageSelect = document.getElementById("imageSelect");
const nextImageBtn = document.getElementById("nextImageBtn");
const imageStatusEl = document.getElementById("imageStatus");
const leaderboardStatusEl = document.getElementById("leaderboardStatus");
const leaderboardListEl = document.getElementById("leaderboardList");
const refreshRankBtn = document.getElementById("refreshRankBtn");

const IMAGE_MANIFEST_PATH = "image/images.json";
const IMAGE_FALLBACK_FILE = "default-puzzle.png";
const STORAGE_KEYS = {
  playerName: "sliding-puzzle-player-name",
  imageId: "sliding-puzzle-image-id",
};
const LEADERBOARD_URL = "https://jsonhosting.com/api/json/d6856351/raw";
const RANK_UPDATE_URL = "https://elaina-k0806-790289487246.asia-east1.run.app/webhook";

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
let gameCompleted = false;
let usedAutoSolve = false;
let imageCatalog = [];
let currentImageIndex = 0;
let leaderboardData = {};

function buildSolvedState(n) {
  return [...Array(n * n - 1).keys()].map((index) => index + 1).concat(0);
}

function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const secs = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${mins}:${secs}`;
}

function parseTimeToSeconds(value) {
  const parts = String(value || "")
    .split(":")
    .map((part) => Number(part));

  if (parts.some((part) => Number.isNaN(part))) return Number.MAX_SAFE_INTEGER;
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  if (parts.length === 1) return parts[0];
  return Number.MAX_SAFE_INTEGER;
}

function updateStatus() {
  movesEl.textContent = String(moves);
  timerEl.textContent = formatTime(seconds);
}

function setMessage(text = "") {
  messageEl.textContent = text;
}

function setRankUpdateStatus(text = "") {
  rankUpdateStatusEl.textContent = text;
}

function getCurrentRankType() {
  return `${size}x${size}_Rank`;
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

function getPlayerName() {
  return playerNameInput.value.trim();
}

function getCurrentImage() {
  return imageCatalog[currentImageIndex] || null;
}

function refreshImageControls(forceDisabled = false) {
  const shouldDisable = forceDisabled || imageCatalog.length <= 1 || isAutoSolving;
  imageSelect.disabled = shouldDisable;
  nextImageBtn.disabled = shouldDisable;
}

function applyCurrentImage({ rerender = true } = {}) {
  const currentImage = getCurrentImage();
  if (!currentImage) return;

  imageSelect.value = currentImage.id;
  previewImage.src = currentImage.src;
  previewImage.alt = currentImage.alt;
  localStorage.setItem(STORAGE_KEYS.imageId, currentImage.id);

  if (rerender && tiles.length) {
    renderBoard();
  }
}

function setControlsDisabled(disabled) {
  shuffleBtn.disabled = disabled;
  resetBtn.disabled = disabled;
  sizeSelect.disabled = disabled;
  solveBtn.disabled = disabled;
  refreshImageControls(disabled);
}

function renderBoard() {
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  boardEl.dataset.size = String(size);

  const currentImage = getCurrentImage();

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

    boardEl.appendChild(tile);
  });

  updateStatus();
}

function shuffleByLegalMoves(steps = 200) {
  tiles = buildSolvedState(size);
  shuffleHistory = [];
  let emptyIndex = getEmptyIndex();
  let previousIndex = -1;

  for (let index = 0; index < steps; index += 1) {
    let choices = getNeighbors(emptyIndex).filter((neighbor) => neighbor !== previousIndex);
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
  gameCompleted = false;
  updateStatus();
  setMessage("");
  setRankUpdateStatus("");
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
    moveHistory.push(movedValue);
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
  renderBoard();
  renderLeaderboard();
}

function resetToShuffle() {
  cancelAutoSolve();
  if (!initialShuffledState.length) return;

  usedAutoSolve = false;
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

  usedAutoSolve = true;
  isAutoSolving = true;
  const runId = ++solveRunId;
  setControlsDisabled(true);
  setMessage("自動還原中...");
  setRankUpdateStatus("此局使用自動還原，不會送出榜單。");

  const solution = [...moveHistory].reverse();

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

    await wait(90);
  }

  if (runId !== solveRunId) return;

  moveHistory = [];
  isAutoSolving = false;
  setControlsDisabled(false);
  finishGame({
    allowRankSubmission: false,
    customMessage: `已完成自動還原，總步數 ${moves}，時間 ${formatTime(seconds)}`,
  });
}

function normalizeRankEntries(entries) {
  if (!Array.isArray(entries)) return [];

  return entries
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      name: String(entry.name || "").trim(),
      Steps: Number(entry.Steps),
      Time: String(entry.Time || "00:00:00"),
    }))
    .filter((entry) => entry.name && Number.isFinite(entry.Steps));
}

function sortRankEntries(entries) {
  return [...entries].sort((left, right) => {
    if (left.Steps !== right.Steps) return left.Steps - right.Steps;

    const timeDifference = parseTimeToSeconds(left.Time) - parseTimeToSeconds(right.Time);
    if (timeDifference !== 0) return timeDifference;

    return left.name.localeCompare(right.name, "zh-Hant");
  });
}

function renderLeaderboard() {
  const rankType = getCurrentRankType();
  const currentName = getPlayerName();
  const entries = sortRankEntries(normalizeRankEntries(leaderboardData[rankType]));

  leaderboardListEl.innerHTML = "";

  if (entries.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "leaderboard-empty";
    emptyItem.textContent = `${rankType.replace("_Rank", "")} 目前沒有資料`;
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

  if (!leaderboardStatusEl.textContent) {
    leaderboardStatusEl.textContent = `目前顯示 ${rankType.replace("_Rank", "")} 排行榜`;
  }
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
    leaderboardStatusEl.textContent = `目前顯示 ${getCurrentRankType().replace("_Rank", "")} 排行榜`;
    renderLeaderboard();
    return leaderboardData;
  } catch (error) {
    console.error(error);
    leaderboardStatusEl.textContent = "排行榜讀取失敗";
    renderLeaderboard();
    throw error;
  }
}

async function maybeSubmitRank(result) {
  const {
    playerName,
    rankType,
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

  const entries = normalizeRankEntries(latestLeaderboard[rankType]);
  const sameNameEntries = entries.filter((entry) => entry.name === playerName);

  if (sameNameEntries.length === 0) {
    setRankUpdateStatus("未送出榜單：榜單中尚未找到此玩家名稱。");
    return;
  }

  const bestExistingSteps = Math.min(...sameNameEntries.map((entry) => entry.Steps));
  if (finalMoves >= bestExistingSteps) {
    setRankUpdateStatus(`未送出榜單：目前最佳步數為 ${bestExistingSteps}，這次沒有更低。`);
    return;
  }

  const payload = {
    event: "Sliding.Puzzle",
    content: {
      type: rankType,
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

    setRankUpdateStatus("已送出榜單更新。");
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
  } = options;

  if (gameCompleted) return;

  gameCompleted = true;
  stopTimer();

  const result = {
    playerName: getPlayerName(),
    rankType: getCurrentRankType(),
    moves,
    time: formatTime(seconds),
  };
  const message = customMessage || `完成！步數 ${result.moves}，時間 ${result.time}`;
  setMessage(message);

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

function renderImageOptions() {
  imageSelect.innerHTML = "";

  imageCatalog.forEach((image) => {
    const option = document.createElement("option");
    option.value = image.id;
    option.textContent = image.name;
    imageSelect.appendChild(option);
  });

  refreshImageControls();
}

async function loadImageCatalog() {
  const manifestUrl = new URL(IMAGE_MANIFEST_PATH, window.location.href);
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

    imageStatusEl.textContent = `已載入 ${imageCatalog.length} 張圖片`;
  } catch (error) {
    console.error(error);
    imageCatalog = fallbackCatalog;
    imageStatusEl.textContent = "圖片清單讀取失敗，已改用預設備援圖片。";
  }

  renderImageOptions();
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

function selectImageById(imageId) {
  const targetIndex = imageCatalog.findIndex((image) => image.id === imageId);
  if (targetIndex === -1) return;

  currentImageIndex = targetIndex;
  applyCurrentImage();
}

function selectRandomImage({ rerender = true } = {}) {
  if (!imageCatalog.length) return;

  currentImageIndex = Math.floor(Math.random() * imageCatalog.length);
  applyCurrentImage({ rerender });
}

function showNextImage() {
  if (imageCatalog.length <= 1) return;

  currentImageIndex = (currentImageIndex + 1) % imageCatalog.length;
  applyCurrentImage();
}

shuffleBtn.addEventListener("click", newGame);
resetBtn.addEventListener("click", resetToShuffle);
solveBtn.addEventListener("click", autoSolve);
sizeSelect.addEventListener("change", () => {
  newGame();
  void refreshLeaderboard().catch(() => {});
});
saveNameBtn.addEventListener("click", savePlayerName);
playerNameInput.addEventListener("change", savePlayerName);
imageSelect.addEventListener("change", (event) => {
  selectImageById(event.target.value);
});
nextImageBtn.addEventListener("click", showNextImage);
refreshRankBtn.addEventListener("click", () => {
  void refreshLeaderboard().catch(() => {});
});

document.addEventListener("keydown", (event) => {
  const tagName = document.activeElement?.tagName;
  if (tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA") return;
  if (isAutoSolving || gameCompleted) return;

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

  try {
    await refreshLeaderboard();
  } catch (error) {
    setRankUpdateStatus("目前無法讀取排行榜，稍後仍可手動重新整理。");
  }
}

void initialize();
