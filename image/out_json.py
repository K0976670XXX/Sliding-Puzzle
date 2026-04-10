import json
# 設定當前工作路徑
import sys, os 
os.chdir(sys.path[0])#將當前環境位置設為當前"檔案位置"

image_num = 55
gif_num = 3

data = {
    "images": []
}

for i in range(0, image_num):
    data["images"].append({
        "id": f"image-{i}",
        "name": f"Image {i}",
        "file": f"image ({i}).jpg",
        "alt": f"Puzzle image {i} preview"
    })

for i in range(0, gif_num):
    data["images"].append({
        "id": f"gif-{i}",
        "name": f"gif {i}",
        "file": f"gif ({i}).gif",
        "alt": f"Puzzle gif {i} preview"
    })

with open("images.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("images.json 已輸出完成")