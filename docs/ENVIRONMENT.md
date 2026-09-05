# 環境設定

請複製前端目錄中的 `.env.example` 為 `.env`，再依部署環境修改端點。前端設定不能視為秘密，因為瀏覽器使用者仍可在開發者工具中看到它們；真正的金鑰或服務帳密不應放進前端。

修改 `.env` 後執行：

```bash
node scripts/generate-config.mjs
```

這會更新前端目錄的 `scripts/runtime-config.js`，靜態網站部署時會載入該檔案。`.env` 已加入 `.gitignore`，不會被提交；`runtime-config.js` 則保留目前可直接部署的公開預設值。

後端上傳工具會讀取自己的 `.env`；前端只設定 `SLIDING_PUZZLE_API_BASE_URL`，程式會自動呼叫該後端的 `/upload`。部署到正式環境時，請把它改成後端 API 的公開網址。
