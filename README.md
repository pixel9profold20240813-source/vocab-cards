# 單字卡複習

匯入 AI 整理的單字 JSON，用字卡滑動複習與拼字練習。可安裝成 PWA，離線也能使用。

- `index.html`：整個 App（單一檔案，沒有建置步驟）
- `manifest.json`、`sw.js`、`icons/`：PWA 安裝與離線快取。修改 `sw.js` 或快取清單時，請把 `sw.js` 裡的 `VER` 加一。
- `firestore.rules`：Firestore 安全規則（需要在 Firebase 主控台發布）
