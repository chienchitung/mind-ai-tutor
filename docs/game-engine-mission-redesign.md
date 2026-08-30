# Game-engine 任務模板改版

## 本次範圍

- Excel Master：新 SVG 橫式 Logo、小尺寸圖示。圖形為試算表與向上推進的任務路徑；字標使用系統字型（不是字形外框）。不修改 MindAiTutor 品牌。
- 自訂 `settings.theme.logoUrl` 優先；圖片載入失敗時回退品牌文字。非 Excel 遊戲使用通用探索圖示，不強制出現 Excel 字樣。
- 首頁：任務基地、學習地圖、下一個任務、AI 學習夥伴提示、已完成課程紀錄。排行榜保留於次要入口。
- 關卡：共享新頁首、任務目標／情境／導師開場白、學習資料與任務挑戰分頁、完成回饋。
- 終局：先呈現已完成課程，時間排名預設收合，保留原本星星兌換。
- 響應式斷點、可見鍵盤焦點、跳至內容連結、減少動態偏好支援；關閉的 AI 面板不接受鍵盤焦點。

## 老師操作

1. 原本的「課程管理」繼續維護名稱、摘要、Markdown、Genially、教學內容與練習题。
2. 在「數位遊戲」選取、排序課程。
3. 如需情境，展開該關的「任務情境（選填）」：情境 600 字、目標 200 字、導師開場白 300 字、完成回饋 300 字。
4. 查看學生端文字預覽，儲存遊戲。

不填情境時直接使用原課程摘要。這些欄位對學生公開，請勿放答案、個資或私密教學設定。完成回饋不應宣稱未經評量的技能精通。

## 資料契約

既有 `digital_games.settings.lessonOverrides[lessonId]` 擴充：

```json
{
  "number": 1,
  "role": "standard",
  "cardDescription": "原本的關卡摘要",
  "mission": {
    "scenario": "活動團隊需要核對支出。",
    "objective": "使用 SUM 計算完整支出範圍。",
    "mentorMessage": "先看看哪些資料需要納入計算。",
    "completionMessage": "你完成了本次支出核對任務。"
  }
}
```

不新增資料表、SQL 或環境變數。既有 `get_public_game_manifest` 已傳回 settings，新前端即可讀取。相同課程在不同遊戲可有不同 mission，不會更新 `lessons`。

儲存時清除空白情境欄位；讀取時防禦性驗證型別與文字長度。不將教師文字當成 HTML 執行，也不把情境文字加入 AI 系統提示。

## 相容性邊界

未變更課程 ID、順序來源、原教材與題目、評分與解鎖條件、進度儲存鍵、Genially 完成判定、既有奖励機制。`/` 舊版入口保留原課程載入路徑；`/games/[gameId]` 仍依遊戲 manifest 載入。

「探索紀錄」只是完成清單，不是新增技能評量或作品集系統。沒有加入 AI 自動編故事、分層提示引擎、同儕合作或獨立能力測驗。

## 驗證

- 單元測試：14 個檔案、89 項通過，包含新增的 23 項任務設定與 manifest 相容性測試。
- 主系統正式建置、TypeScript 與直接 ESLint 檢查通過。建置顯示既有 Gemini API key 未設定；本次未驗收 AI 真實回覆。
- game-engine 正式建置與 TypeScript 通過；ESLint 0 errors，既有 9 warnings（Hook dependencies、未使用參數／停用註解等）。
- Browser 首次檢查發現本地獨立引擎未載入 Supabase 公開環境設定；改用既有主專案設定啟動。後續導覽遭 Browser URL 安全政策阻擋，未改用其他瀏覽器或指令繞過。
- 因此桌面／手機視覺驗收、正式教師儲存後重新載入，以及登入／真實作答流程尚未完成。沒有寫入正式課程或學生成績。

## 部署

主後台與 game-engine 分屬兩個 Vercel 專案，皆由 GitHub 的 master 分支自動觸發正式部署。新 SVG 跟隨引擎的 public 目錄發佈。部署成功應以對應提交的兩個 Vercel Production deployment 狀態為準；發布不代表上述待驗收項已完成。
