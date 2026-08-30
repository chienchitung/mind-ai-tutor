# AI 遊戲封面：實作與啟用

## 功能

- 封面來源只有「自行上傳」與「AI 生成」；舊 thumbnail_url 照常顯示，不強制更換。
- 上傳沿用 1280 × 720、16:9 裁切與 JPEG 匯出。
- AI 讀取目前遊戲標題、遊戲摘要，以及所選關卡名稱／學習目標（無目標時用關卡描述）。最多 20 個關卡主題，摘要最多 2400 字。使用者可在生成前檢閱並修改摘要。
- AI 只生成背景與右側主題視覺。原版 MindAiTutor logo、繁中標題與副標題由 Canvas 排版，沒有讓模型重畫品牌。
- AI 工作室開啟時才載入自管的 Noto Sans TC 字型（約 12 MB），避免不同裝置缺字；字型與 logo 載入成功後才可生成。
- 講師照片選填；先確認照片使用權，再選檔。本機使用 MediaPipe 去背；可恢復原照、調整大小／位置或改上傳透明 PNG。去背不重畫臉，但仍需人工檢查髮絲與邊緣。
- 照片與講師姓名不包含在圖片生成 API 的請求中。最後封面會公開顯示；原照只保留在編輯器記憶體。
- 「使用此封面」只建立待儲存檔案；按「儲存遊戲」才上傳到既有 game-covers。取消、請求失敗、重新生成失敗都不覆蓋原封面。
- 字體、文字或人物調整不會再次呼叫生成 API。

## 管理員啟用步驟

1. 確認既有 profiles 已建立，使用者 profile.role 為 teacher 或 admin。學生及沒有角色的帳號不能使用生成 API。
2. 在 Supabase SQL Editor 執行 scripts/add_game_cover_ai_quota.sql。它建立 game_cover_ai_usage 與 claim_game_cover_generation 函式，不修改現有課程、遊戲或封面。
3. 若從未啟用圖片上傳，先執行既有 scripts/add_game_cover_storage.sql。
4. 在後台主站的 Vercel 環境變數設定（不是 game-engine）：

```text
GEMINI_API_KEY=<有圖片生成權限的伺服器金鑰>
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
AI_GAME_COVERS_ENABLED=true
```

這些名稱不可加 NEXT_PUBLIC_。金鑰不要貼在聊天室或寫進版本庫。未啟用或缺少金鑰時端點回傳明確的設定提示，不會繞過限制。API 服務費由既有 Google 專案承擔；本次沒有開通金流、付費帳戶或執行真實生成。

5. 完成部署後，在實際教師帳號驗收：上傳／裁切、AI 生成、加入照片、去背、調整文字、取消、儲存再重開。

## 額度、安全與失敗語意

- 只接受同來源 POST、經伺服器驗證的登入者，以及 teacher/admin 角色。
- 實際讀取請求串流上限 20 KB；schema 不接受照片、遠端圖片 URL、userId 或任意模型配置。
- 資料庫列鎖原子計數：每位使用者每天 5 次，台北時區換日；間隔至少 60 秒。跨 Vercel 執行個體共用額度，不採用單機記憶體限流。
- 請求 UUID 去重，重複請求不再次呼叫模型。SDK retries 設為 1（只嘗試一次）。
- 模型服務逾時 85 秒，端點 maxDuration 120 秒，瀏覽器等候上限 100 秒。取消瀏覽器等候不保證取消服務端處理。
- 失敗或取消仍可能計入次數與供應商費用，介面有提示。刻意不自動重試、不自動退次數，避免網路結果不確定時重複付費。
- 額度表沒有一般使用者直接讀寫權限，沒有 service-role 金鑰出現在前端；RPC 以 auth.uid() 決定身分。
- 日額度是每帳號限制，不能取代 Google 專案總費用與配額監控。

## 驗證結果與待驗收

- 151 項測試通過（包含原有測試）。
- 新增 API：同來源、登入、教師權限、設定缺失、輸入限制、額度拒絕、無重試、錯誤不洩漏。
- PGlite 執行真實 PostgreSQL migration，測試每日上限、去重、冷卻、匿名禁止、不可直接改表、不同使用者隔離與換日。PGlite 為單連線執行，並不等同正式 Supabase 多執行個體壓力測試。
- 元件測試：同意、重複點擊、明確採用、取消後忽略遲到結果、失敗保留草稿、講師照片不傳送、保留舊網址。
- 去背單元測試使用模擬模型遮罩，驗證只以 alpha 合成與資源釋放；尚未以真實照片驗收模型效果。
- TypeScript、直接 ESLint 與正式建置（npm run build）均通過。
- 已用實際 Canvas 排版函式離線輸出檢查繁中與原版 logo；layout-preview.png 僅為排版預覽，沒有 AI 生成背景。
- Browser 工具封鎖 localhost，未改用其他瀏覽器繞過。桌面／手機視覺驗收、真實 AI 與儲存端到端驗收仍待補。
- 本機 GEMINI_API_KEY 與啟用開關均未設定，未對正式 Supabase 執行新 migration。程式尚未提交或部署。

## 技術與素材來源

- Google Gemini 圖片生成：https://ai.google.dev/gemini-api/docs/generate-content/image-generation
- MediaPipe Image Segmenter：https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js
- 去背 runtime：@mediapipe/tasks-vision 1.0.1（Apache-2.0），按下去背才从固定版本 jsDelivr 載入 WASM。網路請求只下載程式，圖片留在本機。
- Selfie 模型：https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite
- 模型 SHA-256：191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b
- Noto Sans TC：https://github.com/google/fonts/tree/main/ofl/notosanstc；授權全文隨附 public/fonts/OFL-NotoSansTC.txt。
