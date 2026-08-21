const GALLERY_MANIFEST_PATH = "https://pub-537ae23becb047dcb52311606e7a8af3.r2.dev/Sliding_Puzzle/images/directory.json";
const GALLERY_PUBLIC_BASE_URL = "https://pub-537ae23becb047dcb52311606e7a8af3.r2.dev/";
const GALLERY_UPLOAD_URL = "https://cloudrun-to-r2-790289487246.asia-east1.run.app/upload";
const GALLERY_UPLOAD_FOLDER = "Sliding_Puzzle/images";
const GALLERY_PENDING_IMAGE_KEY = "sliding-puzzle-pending-image-id";
const GALLERY_PENDING_SIZE_KEY = "sliding-puzzle-pending-size";

const imageMediaGridEl = document.getElementById("imageMediaGrid");
const gifMediaGridEl = document.getElementById("gifMediaGrid");
const mediaGridEls = [imageMediaGridEl, gifMediaGridEl];
const imageMediaCountEl = document.getElementById("imageMediaCount");
const gifMediaCountEl = document.getElementById("gifMediaCount");
const mediaDetailCardEl = document.getElementById("mediaDetailCard");
const galleryStatusEl = document.getElementById("galleryStatus");
const galleryUploadForm = document.getElementById("galleryUploadForm");
const galleryImageInput = document.getElementById("galleryImageInput");
const galleryUploadBtn = document.getElementById("galleryUploadBtn");
const galleryUploadStatusEl = document.getElementById("galleryUploadStatus");
const selectedPreviewEl = document.getElementById("selectedPreview");
const selectedTypeEl = document.getElementById("selectedType");
const selectedTitleEl = document.getElementById("selectedTitle");
const selectedDescriptionEl = document.getElementById("selectedDescription");
const playSizeSelect = document.getElementById("playSizeSelect");
const playSelectedBtn = document.getElementById("playSelectedBtn");
const downloadSelectedBtn = document.getElementById("downloadSelectedBtn");
const shareLineBtn = document.getElementById("shareLineBtn");

const scriptUrl = document.currentScript?.src
  ? new URL(document.currentScript.src, window.location.href)
  : new URL(window.location.href);
const appRootUrl = new URL("../", scriptUrl);

let mediaCatalog = [];
let selectedMediaId = "";
let resizeRafId = 0;

function getMediaType(file) {
  return String(file).toLowerCase().endsWith(".gif") ? "GIF" : "IMAGE";
}

function normalizeImageManifest(manifest, manifestUrl) {
  const images = Array.isArray(manifest?.files)
    ? manifest.files
    : Array.isArray(manifest)
    ? manifest
    : Array.isArray(manifest?.images)
      ? manifest.images
      : [];

  return images
    .map((item, index) => {
      const indexedPath = String(item?.key || item?.path || "").trim();
      const file = String(item?.file || item?.path || item?.src || item?.name || "").trim();
      if (!file) return null;

      const id = String(item?.id || indexedPath || file || `media-${index + 1}`);
      const name = String(item?.name || `素材 ${index + 1}`);
      const alt = String(item?.alt || `${name} 預覽`);
      const imagePath = indexedPath || file;
      const src = item?.src
        ? new URL(item.src, manifestUrl).href
        : new URL(imagePath, GALLERY_PUBLIC_BASE_URL).href;

      return {
        id,
        name,
        alt,
        file,
        type: getMediaType(file),
        src,
      };
    })
    .filter(Boolean);
}

function getSelectedMedia() {
  return mediaCatalog.find((item) => item.id === selectedMediaId) || null;
}

function getSelectedPlaySize() {
  const selectedSize = Number(playSizeSelect?.value);
  return [3, 4, 5, 6].includes(selectedSize) ? selectedSize : 3;
}

function buildPlayUrl(media) {
  const playUrl = new URL("index.html", appRootUrl);
  playUrl.searchParams.set("image", media.id);
  playUrl.searchParams.set("size", String(getSelectedPlaySize()));
  return playUrl.href;
}

function buildLineShareUrl(media) {
  const shareUrl = new URL("https://social-plugins.line.me/lineit/share");
  shareUrl.searchParams.set("url", media.src);
  return shareUrl.href;
}

function getGridColumnCount(gridEl) {
  const computedColumns = getComputedStyle(gridEl).gridTemplateColumns;
  if (!computedColumns) return 1;

  const columns = computedColumns.split(" ").filter(Boolean).length;
  return Math.max(columns, 1);
}

function positionDetailCard() {
  if (!selectedMediaId || mediaDetailCardEl.hidden) return;
  const selectedMedia = getSelectedMedia();
  const selectedGrid = selectedMedia?.type === "GIF" ? gifMediaGridEl : imageMediaGridEl;
  if (!selectedGrid) return;

  const cards = [...selectedGrid.querySelectorAll(".media-card")];
  const selectedIndex = cards.findIndex((card) => card.dataset.mediaId === selectedMediaId);
  if (selectedIndex === -1) return;

  const columnCount = getGridColumnCount(selectedGrid);
  const rowEndIndex = Math.min(
    cards.length - 1,
    (Math.floor(selectedIndex / columnCount) * columnCount) + columnCount - 1,
  );

  const insertBeforeNode = cards[rowEndIndex + 1] || null;
  selectedGrid.insertBefore(mediaDetailCardEl, insertBeforeNode);
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
    playSelectedBtn.href = new URL("index.html", appRootUrl).href;
    downloadSelectedBtn.removeAttribute("href");
    downloadSelectedBtn.removeAttribute("download");
    shareLineBtn.href = "#";
    shareLineBtn.hidden = true;
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
  shareLineBtn.href = buildLineShareUrl(media);
  shareLineBtn.hidden = false;
  mediaDetailCardEl.hidden = false;
  positionDetailCard();
}

function selectMedia(mediaId) {
  selectedMediaId = mediaId;

  mediaGridEls.forEach((gridEl) => {
    gridEl.querySelectorAll(".media-card").forEach((button) => {
      button.classList.toggle("active", button.dataset.mediaId === mediaId);
    });
  });

  updateSelectedMedia();
}

function createMediaCard(media) {
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
  return card;
}

function renderMediaCategory(gridEl, mediaItems, countEl) {
  mediaItems.forEach((media) => gridEl.appendChild(createMediaCard(media)));
  countEl.textContent = String(mediaItems.length) + " 個";

  if (mediaItems.length) return;

  const emptyState = document.createElement("p");
  emptyState.className = "leaderboard-empty";
  emptyState.textContent = "目前沒有可顯示的素材。";
  gridEl.appendChild(emptyState);
}

function renderMediaGrid() {
  mediaGridEls.forEach((gridEl) => {
    gridEl.querySelectorAll(".media-card").forEach((card) => card.remove());
    gridEl.querySelectorAll(".leaderboard-empty").forEach((emptyState) => emptyState.remove());
  });

  const imageMedia = mediaCatalog.filter((media) => media.type !== "GIF");
  const gifMedia = mediaCatalog.filter((media) => media.type === "GIF");
  renderMediaCategory(imageMediaGridEl, imageMedia, imageMediaCountEl);
  renderMediaCategory(gifMediaGridEl, gifMedia, gifMediaCountEl);

  if (!mediaCatalog.length) {
    mediaDetailCardEl.hidden = true;
    return;
  }

  const initialMedia = getSelectedMedia() || mediaCatalog[0];
  selectMedia(initialMedia.id);
}

async function loadMediaCatalog() {
  const manifestUrl = new URL(GALLERY_MANIFEST_PATH);
  manifestUrl.searchParams.set("t", String(Date.now()));
  const response = await fetch(manifestUrl, { cache: "no-store" });
  const payloadText = await response.text();

  if (!response.ok) {
    throw new Error(`素材清單讀取失敗：${response.status}`);
  }

  const trimmedPayload = payloadText.trim();
  if (!trimmedPayload.startsWith("{") && !trimmedPayload.startsWith("[")) {
    throw new Error(`素材清單不是 JSON：${manifestUrl.href}`);
  }

  const manifest = JSON.parse(payloadText);
  mediaCatalog = normalizeImageManifest(manifest, manifestUrl);
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("folder", GALLERY_UPLOAD_FOLDER);
  formData.append("file", file, file.name);

  const response = await fetch(GALLERY_UPLOAD_URL, {
    method: "POST",
    body: formData,
    // The upload service currently does not expose CORS response headers.
    // The request remains a simple multipart POST, so the browser can send it.
    mode: "no-cors",
  });

  if (response.type === "opaque") return null;

  const responseText = await response.text();
  let payload = null;

  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    // Keep the HTTP status as the useful error when the service returns plain text.
  }

  if (!response.ok) {
    const detail = payload?.error || payload?.message || responseText.trim();
    throw new Error(`圖片上傳失敗：${detail || response.status}`);
  }

  return payload;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function refreshCatalogUntilUploaded(fileName) {
  const normalizedFileName = String(fileName).trim();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    await loadMediaCatalog();
    const uploadedMedia = mediaCatalog.find((media) => {
      const file = String(media.file).trim();
      return file === normalizedFileName || file.endsWith(`/${normalizedFileName}`);
    });

    if (uploadedMedia) return uploadedMedia;
    if (attempt < 5) await wait(600);
  }

  return null;
}

galleryUploadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = galleryImageInput?.files?.[0];
  if (!file) {
    galleryUploadStatusEl.textContent = "請先選擇圖片。";
    return;
  }
  if (!file.type.startsWith("image/")) {
    galleryUploadStatusEl.textContent = "請選擇圖片或 GIF 檔案。";
    return;
  }

  galleryUploadBtn.disabled = true;
  galleryUploadStatusEl.textContent = "圖片上傳中...";

  try {
    const result = await uploadImage(file);
    const uploadedMedia = await refreshCatalogUntilUploaded(file.name);
    renderMediaGrid();
    galleryUploadForm.reset();
    const uploadedPath = result?.key || result?.url || file.name;
    galleryUploadStatusEl.textContent = uploadedMedia
      ? `上傳完成：${uploadedPath}`
      : "已送出上傳，但索引尚未更新；請稍後重新整理圖庫。";
    galleryStatusEl.textContent = `共載入 ${mediaCatalog.length} 個素材`;
  } catch (error) {
    console.error(error);
    galleryUploadStatusEl.textContent = error.message || "圖片上傳失敗，請稍後再試。";
  } finally {
    galleryUploadBtn.disabled = false;
  }
});

playSelectedBtn.addEventListener("click", () => {
  const media = getSelectedMedia();
  if (!media) return;
  localStorage.setItem(GALLERY_PENDING_IMAGE_KEY, media.id);
  localStorage.setItem(GALLERY_PENDING_SIZE_KEY, String(getSelectedPlaySize()));
});

playSizeSelect?.addEventListener("change", () => {
  const media = getSelectedMedia();
  if (!media) return;
  playSelectedBtn.href = buildPlayUrl(media);
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
