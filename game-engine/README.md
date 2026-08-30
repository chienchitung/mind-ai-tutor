> **這個資料夾的位置**：這是獨立部署的 Next.js 遊戲引擎。Vercel Root Directory 指向 `game-engine/`，和教師端各自部署、各自網域。
>
> 新遊戲共用同一套引擎，以 `/games/[gameId]` 開啟。遊戲名稱、說明、關卡內容與順序由 `digital_games`／`lessons` 動態載入；原本的 `/` 和 `/lessons/[id]` 保留作為 Excel Master 的舊版相容入口。

# Data-driven Game Engine

## 啟用方式

1. 在 Supabase SQL Editor 執行 `scripts/add_public_game_manifest.sql`。
2. 確認 `digital_games.is_active = true`，並依照遊玩順序設定 `lesson_ids`。
3. 以 `https://<game-engine-domain>/games/<digital_games.id>` 開啟遊戲。
4. 教師端設定 `NEXT_PUBLIC_GAME_ENGINE_URL=https://<game-engine-domain>` 後，「開始遊戲」會自動連到共用引擎。

`digital_games.lesson_ids` 是關卡成員與順序的唯一來源。舊的 `lesson_order_mappings` 只供舊版 Excel 入口相容，不再供新遊戲使用。

教師端不再限制每款遊戲只能選 5 關。編輯遊戲時可為各關設定「前導課程／一般關卡／最終挑戰」以及學習路線圖短摘要；這些遊戲專屬設定會存入 `digital_games.settings.lessonOverrides`，因此同一堂課可在不同遊戲中使用不同編號、角色與摘要。

可在 `digital_games.settings` 設定：

```json
{
  "tutorPrompt": "你是這款遊戲的繁體中文學習助教……",
  "theme": {
    "brandLabel": "第二款遊戲"
  },
  "rewards": {
    "starsPerLesson": 10,
    "xpPerLesson": 20,
    "claimCost": 50,
    "completionUrl": "https://example.com/complete"
  },
  "lessonOverrides": {
    "<lesson-id>": {
      "number": 0,
      "role": "intro",
      "cardDescription": "這一關顯示在學習路線圖的短摘要"
    }
  }
}
```

`lessons.metadata` 的 `game_role`、`game_number`、`card_description` 仍作為舊資料的 fallback；新設定以遊戲本身的 `settings.lessonOverrides` 為優先。最後一堂課若未明確設定角色，仍會預設為最終關。

既有 Excel Master 若是在資料驅動改版前建立，請執行 `scripts/restore_excel_master_manifest.sql`。它會補回第 0 關、恢復原本六關順序與短摘要，而且可安全重複執行。

# Excel Master Game 互動式學習平台

這是一個基於 Next.js 開發的互動式 Excel 學習平台，旨在通過遊戲化的方式幫助用戶學習 Excel 的各種函數和數據分析技巧。

## 功能特點

- 🎮 遊戲化學習體驗
  - 關卡式學習進度
  - 星星獎勵系統
  - 經驗值和等級提升
  - 每日學習目標
  - 學習連續打卡

- 🤖 AI 助教支援
  - 即時問答功能
  - 智能學習指導
  - 隨時可用的懸浮按鈕

- 📚 完整的課程內容
  - 基礎函數入門
  - VLOOKUP 函數應用
  - IF 條件函數
  - 樞紐分析表
  - 綜合測驗

- 💫 響應式設計
  - 支援桌面、平板和手機
  - 優化的使用者介面
  - 流暢的動畫效果

## 專案結構

```
src/
├── app/                    # Next.js 應用程式主要目錄
│   ├── layout.tsx         # 全局布局組件
│   ├── page.tsx           # 首頁組件
│   └── lessons/[id]/      # 課程頁面
├── components/            # UI 組件
│   └── ui/
│       ├── button.tsx     # 按鈕組件
│       └── ...           # 其他 UI 組件
├── data/                  # 數據文件
│   └── lessons.ts        # 課程內容配置
├── lib/                   # 工具函數
│   └── progress.ts       # 進度管理邏輯
└── types/                # TypeScript 類型定義
    └── lesson.ts         # 課程相關類型
```

## 技術棧

- **框架**: Next.js 14
- **語言**: TypeScript
- **樣式**: Tailwind CSS
- **字體**: Geist Font
- **圖標**: Lucide Icons
- **狀態管理**: React Hooks + LocalStorage

## 開始使用

1. 安裝依賴：
```bash
npm install
```

2. 運行開發服務器：
```bash
npm run dev
```

3. 打開瀏覽器訪問 [http://localhost:3000](http://localhost:3000)

## 學習路徑

1. **基礎函數入門**
   - SUM、AVERAGE、COUNT 等基礎函數
   - 實際應用場景
   - 互動練習

2. **VLOOKUP 函數應用**
   - 函數語法和參數
   - 查找技巧
   - 實戰練習

3. **IF 條件函數**
   - 條件判斷
   - 巢狀 IF 函數
   - 實例演練

4. **樞紐分析表**
   - 創建和使用方法
   - 數據分析技巧
   - 實務應用

5. **綜合測驗**
   - 知識整合
   - 實戰挑戰
   - 技能驗證

## 部署

本專案可以輕鬆部署到 Vercel 平台：

1. Fork 本專案到你的 GitHub
2. 在 Vercel 中導入專案
3. 自動部署完成

## 開發團隊

- 設計與開發：Jackie Tung
- 技術支援：Cursor AI

## 授權

本專案採用 MIT 授權條款
