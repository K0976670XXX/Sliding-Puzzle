# R2 圖片 CORS 設定

圖庫的圖片存放在 Cloudflare R2，LINE 原生檔案分享與「一鍵全部下載」需要瀏覽器以 `fetch()` 讀取圖片 Blob。因此 R2 bucket 必須回傳 `Access-Control-Allow-Origin`。

`config/r2-cors.json` 是本專案使用的 R2 CORS 規則，已限制為 GitHub Pages 正式來源與常用的 localhost 開發來源。請在 Cloudflare Dashboard 的 R2 bucket（目前公開網址為 `pub-537ae23becb047dcb52311606e7a8af3.r2.dev`）的 Settings → CORS policy 貼上該檔案內容並儲存。

設定生效後，從正式網站或 localhost 重新整理圖庫即可。若尚未設定或瀏覽器仍遇到 CORS，前端會讓 LINE 分享回退到 LINE URL 分享；批次下載則逐檔回退到原始圖片 URL，並在完成狀態中分開顯示 Blob 成功、fallback 與失敗數量，不會因單一檔案中止整批下載。
