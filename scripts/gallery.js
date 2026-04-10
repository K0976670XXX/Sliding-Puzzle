const GALLERY_MANIFEST_PATH = "image/images.json";
const GALLERY_PENDING_IMAGE_KEY = "sliding-puzzle-pending-image-id";

const mediaGridEl = document.getElementById("mediaGrid");
const mediaDetailCardEl = document.getElementById("mediaDetailCard");
const galleryStatusEl = document.getElementById("galleryStatus");
const selectedPreviewEl = document.getElementById("selectedPreview");
const selectedTypeEl = document.getElementById("selectedType");
const selectedTitleEl = document.getElementById("selectedTitle");
const selectedDescriptionEl = document.getElementById("selectedDescription");
const playSelectedBtn = document.getElementById("playSelectedBtn");
const downloadSelectedBtn = document.getElementById("downloadSelectedBtn");

let mediaCatalog = [];
let selectedMediaId = "";
let resizeRafId = 0;

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

function getMediaType(file) {
  return String(file).toLowerCase().endsWith(".gif") ? "GIF" : "IMAGE";
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

      const id = String(item?.id || `media-${index + 1}`);
      const name = String(item?.name || `素材 ${index + 1}`);
      const alt = String(item?.alt || `${name} 預覽`);

      return {
        id,
        name,
        alt,
        file,
        type: getMediaType(file),
        src: new URL(file, manifestUrl).href,
      };
    })
    .filter(Boolean);
}

function getSelectedMedia() {
  return mediaCatalog.find((item) => item.id === selectedMediaId) || null;
}

function buildPlayUrl(media) {
  const playUrl = new URL("index.html", getAppBaseUrl());
  playUrl.searchParams.set("image", media.id);
  return playUrl.href;
}

function getGridColumnCount() {
  const computedColumns = getComputedStyle(mediaGridEl).gridTemplateColumns;
  if (!computedColumns) return 1;

  const columns = computedColumns.split(" ").filter(Boolean).length;
  return Math.max(columns, 1);
}

function positionDetailCard() {
  if (!selectedMediaId || mediaDetailCardEl.hidden) return;

  const cards = [...mediaGridEl.querySelectorAll(".media-card")];
  const selectedIndex = cards.findIndex((card) => card.dataset.mediaId === selectedMediaId);
  if (selectedIndex === -1) return;

  const columnCount = getGridColumnCount();
  const rowEndIndex = Math.min(
    cards.length - 1,
    (Math.floor(selectedIndex / columnCount) * columnCount) + columnCount - 1,
  );

  const insertBeforeNode = cards[rowEndIndex + 1] || null;
  mediaGridEl.insertBefore(mediaDetailCardEl, insertBeforeNode);
}

function updateSelectedMedia() {
  const media = getSelectedMedia();
  if (!media) {
    mediaDetailCardEl.hidden = true;
    selectedPreviewEl.removeAttribute("src");
    selectedPreviewEl.alt = "尚未選取素材";
    selectedTypeEl.textContent = "尚未選取";
    selectedTitleEl.textContent = "請先選擇一張圖片或 GIF";
    selectedDescriptionEl.textContent = "點選上方縮圖後，會在目前這一排的下方直接展開。";
    playSelectedBtn.href = "index.html";
    downloadSelectedBtn.removeAttribute("href");
    downloadSelectedBtn.removeAttribute("download");
    return;
  }

  selectedPreviewEl.src = media.src;
  selectedPreviewEl.alt = media.alt;
  selectedTypeEl.textContent = media.type;
  selectedTitleEl.textContent = media.name;
  selectedDescriptionEl.textContent = `檔案：${media.file}`;
  playSelectedBtn.href = buildPlayUrl(media);
  downloadSelectedBtn.href = media.src;
  downloadSelectedBtn.download = media.file;
  mediaDetailCardEl.hidden = false;
  positionDetailCard();
}

function selectMedia(mediaId) {
  selectedMediaId = mediaId;

  mediaGridEl.querySelectorAll(".media-card").forEach((button) => {
    button.classList.toggle("active", button.dataset.mediaId === mediaId);
  });

  updateSelectedMedia();
}

function renderMediaGrid() {
  mediaGridEl.querySelectorAll(".media-card").forEach((card) => card.remove());

  if (!mediaCatalog.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "leaderboard-empty";
    emptyState.textContent = "目前沒有可顯示的素材。";
    mediaGridEl.appendChild(emptyState);
    mediaDetailCardEl.hidden = true;
    return;
  }

  const fragment = document.createDocumentFragment();

  mediaCatalog.forEach((media) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "media-card";
    card.dataset.mediaId = media.id;

    const thumb = document.createElement("img");
    thumb.className = "media-thumb";
    thumb.src = media.src;
    thumb.alt = media.alt;
    thumb.loading = "lazy";

    const meta = document.createElement("div");
    meta.className = "media-card-meta";

    const title = document.createElement("strong");
    title.textContent = media.name;

    const type = document.createElement("span");
    type.className = "media-type-badge";
    type.textContent = media.type;

    meta.appendChild(title);
    meta.appendChild(type);
    card.appendChild(thumb);
    card.appendChild(meta);
    card.addEventListener("click", () => selectMedia(media.id));
    fragment.appendChild(card);
  });

  mediaGridEl.prepend(fragment);

  const initialMedia = mediaCatalog[0];
  if (initialMedia) {
    selectMedia(initialMedia.id);
  }
}

async function loadMediaCatalog() {
  const manifestUrl = new URL(GALLERY_MANIFEST_PATH, getAppBaseUrl());
  const response = await fetch(manifestUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`素材清單讀取失敗：${response.status}`);
  }

  const manifest = await response.json();
  mediaCatalog = normalizeImageManifest(manifest, manifestUrl);
}

playSelectedBtn.addEventListener("click", () => {
  const media = getSelectedMedia();
  if (!media) return;
  localStorage.setItem(GALLERY_PENDING_IMAGE_KEY, media.id);
});

window.addEventListener("resize", () => {
  if (resizeRafId) cancelAnimationFrame(resizeRafId);
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = 0;
    positionDetailCard();
  });
});

async function initializeGallery() {
  try {
    await loadMediaCatalog();
    galleryStatusEl.textContent = `共載入 ${mediaCatalog.length} 個素材`;
    renderMediaGrid();
  } catch (error) {
    console.error(error);
    galleryStatusEl.textContent = "素材載入失敗";
    renderMediaGrid();
  }
}

void initializeGallery();
