import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const envPath = new URL(".env", root);
const outputPath = new URL("./runtime-config.js", import.meta.url);
const env = {};

try {
  const source = await readFile(envPath, "utf8");
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  console.warn("找不到 .env，保留目前 runtime-config.js 的值。");
}

const values = {
  imageManifestUrl: env.SLIDING_PUZZLE_IMAGE_MANIFEST_URL,
  imagePublicBaseUrl: env.SLIDING_PUZZLE_IMAGE_PUBLIC_BASE_URL,
  leaderboardUrl: env.SLIDING_PUZZLE_LEADERBOARD_URL,
  playCountLeaderboardUrl: env.SLIDING_PUZZLE_PLAY_COUNT_LEADERBOARD_URL,
  apiBaseUrl: env.SLIDING_PUZZLE_API_BASE_URL,
  galleryUploadFolder: env.SLIDING_PUZZLE_GALLERY_UPLOAD_FOLDER,
};

const current = await readFile(outputPath, "utf8").catch(() => "");
const existing = {};
for (const match of current.matchAll(/\s([A-Za-z][A-Za-z0-9]*):\s*("(?:\\.|[^"\\])*")/g)) {
  existing[match[1]] = JSON.parse(match[2]);
}
for (const [key, value] of Object.entries(values)) {
  if (value !== undefined && value !== "") existing[key] = value;
}

const output = `// Generated from .env by: node scripts/generate-config.mjs\n// This file contains public browser configuration, not secrets.\nwindow.SLIDING_PUZZLE_CONFIG = Object.freeze(${JSON.stringify(existing, null, 2)});\n`;
await writeFile(outputPath, output, "utf8");
console.log(`已產生 ${outputPath.pathname}`);
