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
const replayFirstBtn = document.getElementById("replayFirstBtn");
const replayPrevBtn = document.getElementById("replayPrevBtn");
const replayNextBtn = document.getElementById("replayNextBtn");
const replayLastBtn = document.getElementById("replayLastBtn");
const replayStatusEl = document.getElementById("replayStatus");
const autoReplayInfoEl = document.getElementById("autoReplayInfo");
const replayRouteToggleBtn = document.getElementById("replayRouteToggleBtn");
const reviewSolveBtn = document.getElementById("reviewSolveBtn");
const reviewModeBtn = document.getElementById("reviewModeBtn");

const IMAGE_MANIFEST_PATH = "image/images.json";
const IMAGE_FALLBACK_FILE = "default-puzzle.png";
const STORAGE_KEYS = {
  playerName: "sliding-puzzle-player-name",
  imageId: "sliding-puzzle-image-id",
  pendingImageId: "sliding-puzzle-pending-image-id",
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
  4: { maxExpanded: 8000000, maxDurationMs: 60000 },
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
let isReviewMode = false;
let reviewSourceReplayStateKeys = [];
let reviewSourceMoves = 0;
let reviewSourceElapsedMs = 0;
let reviewComparison = null;
let autoReplayStateKeys = [];
let autoReplayStepCount = null;
let replayRouteMode = "player";
let imageCatalog = [];
let currentImageIndex = 0;
let leaderboardData = {};
let leaderboardMode = localStorage.getItem(STORAGE_KEYS.leaderboardMode) === LEADERBOARD_MODES.speed
  ? LEADERBOARD_MODES.speed
  : LEADERBOARD_MODES.steps;
