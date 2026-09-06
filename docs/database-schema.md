# Supabase 資料庫結構說明

專案：MindAiTutor（`vuibtitfdhzoxsytzrjo`）。以下依功能分組列出 `public` schema 目前的所有資料表，說明每張表儲存什麼、由誰寫入/讀取，以及跟哪些表關聯。

> 產生時間：2026-09-06，直接查詢 Supabase 資料庫得出，若之後新增/移除資料表需要重新整理。

## 帳號與團隊

### `profiles`
每個 Supabase Auth 使用者（老師/管理員）對應一筆個人資料。`role`（`admin` / `teacher` / `student`）是全站權限判斷的核心欄位——`is_admin()` 這個 function 就是查這張表，`/admin` 頁面、老師後台的存取控制都靠它。

### `teams` / `team_members`
團隊工作區功能。一個 `teams` 有一個 `owner_id`；`team_members` 記錄誰屬於哪個團隊、角色是 `owner` 還是 `member`。`events`、`lessons`、`feedback`、`digital_games` 都有 `team_id` 欄位，讓同團隊成員可以共用這些資料，而不是各自獨立。

## 老師教學管理（主站 mindaitutor.com）

### `students`
老師的學生名冊。`login_code` 是學生在 game-engine（數位遊戲）裡輸入的登入代碼，用來把該台裝置「連結」到名冊裡的這一筆學生資料，之後的學習記錄、聊天記錄才會存到雲端並歸屬到這個學生身上。

### `lessons`
老師建立的課程內容（標題、教學內容、練習題、Genially 連結等），是數位遊戲讀取關卡內容的來源之一。

### `events`
老師個人的看板/行事曆任務（課程、工作坊、培訓、會議等），有狀態（待辦/進行中/完成）與優先度。

### `feedback`
學生對課程的意見回饋，含 1-5 星評分。

### `assignments`
指派給個別學生的作業（科目、標題、截止日、分數、狀態）。

### `attendance`
學生每日出缺席記錄（出席/缺席/遲到）。

### `progress`
單一學生在某科目的分數/備註記錄，是較簡易的進度追蹤（跟下面數位遊戲用的 `learning_records`是不同機制，這個較像傳統成績登記）。

## AI 測驗

### `ai_quizzes`
老師建立的 AI 測驗題組（標題、題目陣列、是否公開）。

### `ai_quiz_attempts`
學生作答某份公開測驗的紀錄（姓名、得分、總分、提交時間）。

## 數位遊戲（game-engine，`mindaitutor.com/games/*`）

### `digital_games`
老師建立的「數位遊戲」活動本身，`id` 就是遊戲網址列的 `gameId`。`settings`（jsonb）裡包含 `template`（目前 6 種視覺樣板：discovery / neo-brutal / arcade / forest-camp / arcane-archive / orbital-lab）、AI 助教的 `tutorPrompt`、獎勵設定等。**切換樣板只是改這裡的 `settings.template` 欄位，同一個 `digital_games.id` 不會變**，所以下面所有以 `game_id`追蹤的資料，換樣板不會被拆散成不同遊戲的紀錄。

### `learning_records`
**已連結身份**的學生完成某一關的紀錄（開始/完成時間、花費秒數、提交答案次數）。只有輸入過老師發的登入代碼的學生才會寫入這張表；訪客模式（沒輸入代碼）完全不會寫進來。

### `leaderboard`
遊戲排行榜，同樣只有已連結身份的學生完成關卡後才會寫入。

### `chat_messages`
學生與 Ellis AI 助教的對話紀錄，關聯到 `learning_record_id`。**寫入時機是「該關卡答對、產生 learning_records 之後」才會把暫存的對話一次寫入**，訪客模式或還沒答對就離開的學生，對話不會被儲存（詳見下方調查結果）。

### `question_counts`
已連結身份的學生在某次學習記錄裡，向 AI 助教提問的次數統計。

### `guest_play_stats`
**訪客模式（沒有登入代碼）**的匿名遊戲統計，不含學生姓名/ID，只有遊戲建立者（老師）看得到，是 `learning_records`/`leaderboard` 的匿名對應版本。

### `lesson_order_mappings`
老師自訂的關卡順序/Genially 連結對照表（JSON），用於特定渲染情境的排序設定。

### `game_chat_device_usage`
Ellis AI 助教的**每裝置每日提問上限**防濫用計數，用瀏覽器產生的裝置 UUID 當 key，跟學生身份完全無關，單純防止單一瀏覽器洗版。上限數字存在 `game_chat_config`（見下方）。

### `game_chat_config`
單一設定列，存放 `game_chat_device_usage` 的每日上限數字，可在主站 `/admin` 頁面直接調整。

## AI 用量與防濫用（老師端）

### `teacher_ai_usage`
老師使用 AI 生成功能（測驗/練習題/學習分析）的每日次數與冷卻時間計數器，純防爆量閘門，不限制總量。

### `teacher_ai_points`
每月 AI 點數帳本（餘額、當期月份），疊加在 `teacher_ai_usage` 之上，讓免費方案老師每月有固定點數額度可用（測驗/練習題/分析/遊戲封面各有不同點數成本）。

### `game_cover_ai_usage`
AI 生成遊戲封面圖片的每日次數/冷卻限制，並記錄已處理過的 request id 避免重複扣點。

## 課堂即時模式（Live Session）

### `live_sessions`
一場即時課堂的主表：加入代碼（6 碼）、狀態（開啟/暫停/關閉）、目前簡報頁碼與投影模式設定。

### `live_polls`
某場即時課堂建立的投票（題目、選項陣列、階段：草稿/開放/關閉/顯示結果）。

### `live_poll_votes`
學生對某個投票的作答紀錄。

### `live_pulse`
即時課堂的「心情/理解度」溫度計，學生即時回報 1-5 的數值。

### `live_questions`
即時課堂的學生提問（文字、分類 lens：釐清/共鳴/銜接/收藏、是否公開、按讚數、是否已回答）。

### `live_question_votes`
對某則即時提問的按讚紀錄。

---

## 附錄：關於 AI 助教對話未被記錄、以及樣板切換是否影響資料追蹤的調查結果

這兩個問題的調查結果請見對話回覆，這裡只記錄跟上面表格定義有關的重點：
- `chat_messages` 最新一筆資料是 2026-03-04，之後完全沒有新資料寫入。
- 樣板（`digital_games.settings.template`）只是同一列資料裡的一個欄位，**不會**產生新的 `game_id`，所以只要學生有連結身份，`learning_records`/`leaderboard`/`chat_messages`/`question_counts` 這些表在切換樣板後仍會正確歸屬到同一個 `game_id`，不會被拆散。
