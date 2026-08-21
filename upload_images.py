from __future__ import annotations

import mimetypes
import sys
from pathlib import Path

import requests


BASE_URL = "https://cloudrun-to-r2-790289487246.asia-east1.run.app"
UPLOAD_URL = f"{BASE_URL}/upload"
UPLOAD_FOLDER = "Sliding_Puzzle/images"
IMAGE_DIR = Path(__file__).resolve().parent / "image"
IMAGE_EXTENSIONS = {
    ".avif",
    ".bmp",
    ".gif",
    ".jpeg",
    ".jpg",
    ".png",
    ".webp",
}


def upload_image(session: requests.Session, image_path: Path) -> dict:
    content_type = mimetypes.guess_type(image_path.name)[0] or "application/octet-stream"

    with image_path.open("rb") as image_file:
        response = session.post(
            UPLOAD_URL,
            data={"folder": UPLOAD_FOLDER},
            files={
                "file": (
                    image_path.name,
                    image_file,
                    content_type,
                ),
            },
            timeout=60,
        )

    response.raise_for_status()
    return response.json()


def main() -> int:
    if not IMAGE_DIR.is_dir():
        print(f"找不到圖片資料夾：{IMAGE_DIR}", file=sys.stderr)
        return 1

    image_paths = sorted(
        path
        for path in IMAGE_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )

    if not image_paths:
        print(f"圖片資料夾中沒有可上傳的圖片：{IMAGE_DIR}", file=sys.stderr)
        return 1

    print(f"準備上傳 {len(image_paths)} 個檔案到 {UPLOAD_FOLDER}", flush=True)
    failed = []

    with requests.Session() as session:
        for index, image_path in enumerate(image_paths, start=1):
            try:
                result = upload_image(session, image_path)
                uploaded_key = result.get("key", image_path.name)
                print(f"[{index}/{len(image_paths)}] 完成：{uploaded_key}", flush=True)
            except (OSError, requests.RequestException, ValueError) as error:
                failed.append((image_path.name, error))
                print(
                    f"[{index}/{len(image_paths)}] 失敗：{image_path.name}：{error}",
                    file=sys.stderr,
                    flush=True,
                )

    if failed:
        print(f"\n有 {len(failed)} 個檔案上傳失敗：", file=sys.stderr, flush=True)
        for filename, error in failed:
            print(f"- {filename}: {error}", file=sys.stderr, flush=True)
        return 1

    print("\n全部圖片上傳完成。", flush=True)
    print("directory.json 會由上傳服務自動更新。", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
