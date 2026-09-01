# 活動、課程編輯與即時課堂體驗修正

日期：2026-09-01

## 活動紀錄

活動卡片原本以 `items-start` 對齊，且 `CardContent` 的 `md:pt-0` 覆蓋局部 padding。改為共用 ActivityItem：桌面三欄（圖示／內容／狀態）垂直置中，手機將標籤移到內容下方。每張卡片是原生按鈕，可用鍵盤開啟；長標題換行，保留品牌暖白背景與狀態色。

## 課程編輯

- 頁首提供儲存、取消和未儲存狀態；底部操作列固定在可視區底部。
- 將舊資料摘要卡改為可收合的學生卡片即時預覽，顯示正在編輯的名稱、摘要、時長、級別與主題。
- 摘要有 160 字計數；驗證失敗時顯示可跳到對應區塊的提示。
- 修正只載入第一道練習題的資料遺失風險，完整保留題組，支援新增／移除與逐欄位錯誤提示。
- AI 題目追加到既有題組；只有整個題組仍為一題全空白時才替換空白題目。
- 修改題目不再直接改動原始 lesson 物件；新增／移除同步表單髒狀態與驗證。
- 編輯儲存遇到資料表欄位錯誤時保留草稿並回報，不再只儲存基本欄位卻宣稱完整教材已儲存。
- 保留既有離開未儲存頁面的提醒，沒有新增自動發布或自動儲存。

## Emoji 回應

原本點擊者必須等 API 查詢、建立伺服器 WebSocket 訂閱、再廣播回來才看見 emoji；動畫本身也從透明開始。

現在點擊當下即在本機播放，400ms 的連點冷卻不再等待網路。反應攜帶 UUID，廣播回傳時去重，60 秒內相同事件不再播放。伺服器改用 Supabase SDK 已支援的 HTTP broadcast 路徑，免除每則訊息的 WebSocket 握手和 250ms teardown buffer。API 在廣播失敗時回報錯誤，畫面明確告知未能送到課堂。遠端講師端仍受實際網路／伺服器耗時影響，不宣稱零延遲。

新增動畫定時器清理、同時顯示數量上限與減少動態效果偏好。既有 public broadcast 存取模型未改動。

參考：[Supabase Broadcast](https://supabase.com/docs/guides/realtime/broadcast)。

## 已結束場次刪除

列表只對已結束場次顯示刪除。確認視窗列出永久刪除範圍，送出期間防重複操作，失敗保留列表與重試入口。伺服器驗證來源、UUID、登入者和擁有權；實際 DELETE 同時限制 owner、ID、closed，防止檢查後被另一視窗重新開啟的競態。

Supabase 使用既有外鍵 ON DELETE CASCADE，在同一筆資料庫交易中移除：

- live_sessions
- live_polls 和 live_poll_votes
- live_pulse
- live_questions 和 live_question_votes

課程和可重複使用的 Storage PDF 檔案保留；不以任意 deck_url 刪除共享檔案，也不假設資料庫 DELETE 會刪掉 Storage 物件。反應本來就不寫入資料表。通知已連線的講師和学生重新載入，顯示場次不存在。

Migration：`scripts/allow_closed_live_session_deletion.sql`。已透過 Supabase migration 套用至 MindAiTutor，增加 authenticated DELETE grant 與 owner + closed RLS 規則；anon 沒有 DELETE 權限。沒有刪除任何現有正式場次。已回查 policy 與 grant，安全 advisors 前後均為 44 項，沒有新增警告。

既有安全項目包含可變 function search_path、可執行 SECURITY DEFINER RPC、OTP 時效、外洩密碼保護與 PostgreSQL 版本；不在此次範圍內變更。[資料庫安全檢查說明](https://supabase.com/docs/guides/database/database-linter)。

## 驗證與界線

- 50 個測試檔，351 項測試通過。新增涵蓋 PostgreSQL RLS 與連動刪除、API 權限／錯誤／狀態競態、emoji 即時播放及去重、題組保留和 AI 追加。
- TypeScript、修改範圍 ESLint、Node 24 production build 通過。
- 真正 PostgreSQL 引擎（PGlite）驗證完整關聯資料刪除及跨使用者隔離；正式資料庫僅更新規則與查詢結構，沒有進行真人資料的刪除測試。
- 瀏覽器檢查 1280px 桌面與 390px 手機；活動卡片使用實際互動元件。課程／刪除視窗使用實際元件在測試中輸出的示範 HTML，行為由 jsdom 測試，不代表登入後完整導覽殼層驗收；Markdown 編輯器在 fixture 中替換為文字輸入。
- 尚未以真人課堂在兩台裝置量測端到端 emoji 傳輸耗時；不把本機即時動畫等同遠端已收到。
- 程式提交於新的 PR，尚未合併或部署；資料庫新增規則已就緒。
