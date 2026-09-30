import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";

test("build variables override local values and preserve unconfigured public fields", async () => {
  const root = await mkdtemp(join(tmpdir(), "sliding-config-test-"));
  try {
    const scripts = join(root, "scripts");
    await mkdir(scripts);
    const script = join(scripts, "generate-config.mjs");
    await copyFile(new URL("./generate-config.mjs", import.meta.url), script);
    const runtime = join(scripts, "runtime-config.js");
    await writeFile(runtime, 'window.SLIDING_PUZZLE_CONFIG = Object.freeze({"apiBaseUrl": "https://old.example", "galleryUploadFolder": "Sliding_Puzzle/images"});');
    // Synthetic fixture only: never read the project's real .env.
    await writeFile(join(root, ".env"), "SLIDING_PUZZLE_API_BASE_URL=https://local.example\n");
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("SLIDING_PUZZLE_")));
    env.SLIDING_PUZZLE_API_BASE_URL = "https://worker.example";
    env.SECRET_TEST_TOKEN = "must-not-be-exported";
    execFileSync(process.execPath, [script], { env });
    const source = await readFile(runtime, "utf8");
    const context = { window: {} };
    runInNewContext(source, context);
    assert.equal(context.window.SLIDING_PUZZLE_CONFIG.apiBaseUrl, "https://worker.example");
    assert.equal(context.window.SLIDING_PUZZLE_CONFIG.galleryUploadFolder, "Sliding_Puzzle/images");
    assert.ok(!source.includes("must-not-be-exported"));
    delete env.SLIDING_PUZZLE_API_BASE_URL;
    execFileSync(process.execPath, [script, "--skip-env-file"], { env });
    const second = { window: {} };
    runInNewContext(await readFile(runtime, "utf8"), second);
    assert.equal(second.window.SLIDING_PUZZLE_CONFIG.apiBaseUrl, "https://worker.example");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
