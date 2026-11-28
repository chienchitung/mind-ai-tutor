# 樣板畫面比對（visual snapshots）

每個 pull request 只要動到 `game-engine/`，CI 的「Template snapshots」就會：

1. 分別建置這個分支和 base 分支，在同一台機器上用軟體 WebGL 開啟固定的示範遊戲首頁（`/games/visual-qa`）。
2. 每個樣板拍 3 張：3D 島嶼（桌機、手機）和路線圖（桌機）。
3. 逐像素比對，在 job summary 列出哪些樣板的畫面變了，並把「改前｜改後｜差異」對照圖放進 `visual-diff` 成品（artifact）。

畫面有變化不會讓 CI 失敗，因為改動可能是刻意的，要由人看圖判斷。只有頁面出錯，或 3D 島嶼什麼都沒畫出來時，才會失敗。

`/games/visual-qa` 只在伺服器以 `VISUAL_QA=1` 啟動時存在；正式部署不設這個變數，所以會回 404。

## 在本機跑

```bash
cd game-engine
npm run build            # 需要 NEXT_PUBLIC_SUPABASE_URL 等變數，填 CI 用的佔位值即可
VISUAL_QA=1 npx next start -p 3300 &
cd visual && npm ci && npx playwright install chromium
node snapshots.mjs http://localhost:3300/games out/after
node diff.mjs out/before out/after out/diff   # 有另一份 before 時
```
