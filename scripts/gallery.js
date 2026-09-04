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
const downloadAllBtn = document.getElementById("downloadAllBtn");
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
let isDownloadingAll = false;

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

async function shareMediaToLine(media) {
  // A File share lets mobile browsers hand the image to the native share
  // sheet (where LINE can be selected), but support varies by browser/OS.
  if (navigator.share && navigator.canShare) {
    try {
      const response = await fetch(media.src, { mode: "cors", cache: "no-store" });
      if (response.ok) {
        const blob = await response.blob();
        const file = new File([blob], media.file.split("/").pop() || media.name, {
          type: blob.type || "image/*",
        });
        const shareData = { files: [file] };
        if (navigator.canShare({ files: [file] })) {
          await navigator.share(shareData);
          return true;
        }
      }
    } catch (error) {
      // AbortError means the user dismissed the native sheet. Do not open a
      // second share UI in that case; other errors simply use the URL fallback.
      if (error?.name === "AbortError") return false;
      console.warn("Unable to share image file; using LINE URL sharing.", error);
    }
  }

  const lineWindow = window.open(buildLineShareUrl(media), "_blank", "noopener,noreferrer");
  // Popup blockers may reject a new tab after the asynchronous image fetch;
  // navigating the current tab still gives the user a dependable fallback.
  if (!lineWindow) window.location.assign(buildLineShareUrl(media));
  return true;
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function calculateCrc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function getZipDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

function createZipBlob(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  const { date, time } = getZipDateTime();
  let localOffset = 0;
  let centralSize = 0;

  entries.forEach(({ name, data }) => {
    const nameBytes = encoder.encode(name);
    const crc32 = calculateCrc32(data);
    const localHeader = new ArrayBuffer(30);
    const localView = new DataView(localHeader);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, time);
    writeUint16(localView, 12, date);
    writeUint32(localView, 14, crc32);
    writeUint32(localView, 18, data.byteLength);
    writeUint32(localView, 22, data.byteLength);
    writeUint16(localView, 26, nameBytes.byteLength);
    writeUint16(localView, 28, 0);
    localParts.push(localHeader, nameBytes, data);

    const centralHeader = new ArrayBuffer(46);
    const centralView = new DataView(centralHeader);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, time);
    writeUint16(centralView, 14, date);
    writeUint32(centralView, 16, crc32);
    writeUint32(centralView, 20, data.byteLength);
    writeUint32(centralView, 24, data.byteLength);
    writeUint16(centralView, 28, nameBytes.byteLength);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, localOffset);
    centralParts.push(centralHeader, nameBytes);

    localOffset += localHeader.byteLength + nameBytes.byteLength + data.byteLength;
    centralSize += centralHeader.byteLength + nameBytes.byteLength;
  });

  const endHeader = new ArrayBuffer(22);
  const endView = new DataView(endHeader);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, entries.length);
  writeUint16(endView, 10, entries.length);
  writeUint32(endView, 12, centralSize);
  writeUint32(endView, 16, localOffset);
  writeUint16(endView, 20, 0);

  return new Blob([...localParts, ...centralParts, endHeader], { type: "application/zip" });
}

function getUniqueZipName(media, usedNames) {
  const originalName = (media.file.split("/").pop() || media.name || "image")
    .replace(/[\\/:*?"<>|]/g, "_");
  const extensionIndex = originalName.lastIndexOf(".");
  const baseName = extensionIndex > 0 ? originalName.slice(0, extensionIndex) : originalName;
  const extension = extensionIndex > 0 ? originalName.slice(extensionIndex) : "";
  let name = originalName;
  let suffix = 2;

  while (usedNames.has(name.toLowerCase())) {
    name = `${baseName}-${suffix}${extension}`;
    suffix += 1;
  }

  usedNames.add(name.toLowerCase());
  return name;
}

async function fetchZipEntry(media, usedNames) {
  const response = await fetch(media.src, { mode: "cors", cache: "no-store" });
  if (!response.ok) throw new Error(`下載失敗：${response.status}`);

  return {
    name: getUniqueZipName(media, usedNames),
    data: new Uint8Array(await response.arrayBuffer()),
  };
}

async function downloadAllMedia() {
  if (isDownloadingAll || !mediaCatalog.length) return;
  isDownloadingAll = true;
  downloadAllBtn.disabled = true;
  const total = mediaCatalog.length;
  const entries = [];
  const usedNames = new Set();
  let failureCount = 0;
  galleryStatusEl.textContent = `準備壓縮 ${total} 個素材...`;

  try {
    for (let index = 0; index < mediaCatalog.length; index += 1) {
      const media = mediaCatalog[index];
      try {
        entries.push(await fetchZipEntry(media, usedNames));
      } catch (error) {
        failureCount += 1;
        console.warn(`Unable to add ${media.file} to the ZIP file.`, error);
      }
      galleryStatusEl.textContent = `建立壓縮檔：${index + 1}/${total}`;
    }

    if (!entries.length) {
      galleryStatusEl.textContent = "無法建立壓縮檔，請確認 R2 CORS 設定。";
      return;
    }

    const zipUrl = URL.createObjectURL(createZipBlob(entries));
    const link = document.createElement("a");
    link.href = zipUrl;
    link.download = "sliding-puzzle-images.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
    await wait(100);
    URL.revokeObjectURL(zipUrl);

    galleryStatusEl.textContent = failureCount
      ? `壓縮檔已下載：包含 ${entries.length} 個，失敗 ${failureCount} 個`
      : `壓縮檔已下載：共 ${entries.length} 個素材`;
  } finally {
    isDownloadingAll = false;
    downloadAllBtn.disabled = false;
  }
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
  if (downloadAllBtn) downloadAllBtn.disabled = mediaCatalog.length === 0;
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

shareLineBtn?.addEventListener("click", async (event) => {
  event.preventDefault();
  const media = getSelectedMedia();
  if (media) await shareMediaToLine(media);
});

downloadAllBtn?.addEventListener("click", () => {
  void downloadAllMedia();
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
