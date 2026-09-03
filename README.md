<p align="center">
  <img src="./public/brand/mindaitutor-cover-logo.svg" alt="MindAiTutor" width="280" />
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3FCF8E?logo=supabase&logoColor=white">
  <img alt="Tests" src="https://img.shields.io/badge/Tests-Vitest-6E9F18?logo=vitest&logoColor=white">
  <img alt="Deploy" src="https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/License-Private-lightgrey">
</p>

<p align="center">繁體中文（預設） ｜ <a href="#english">English</a></p>

給老師使用的教學管理平台：課程、數位遊戲、AI 出題、學生管理、行事曆、即時課堂互動、成效報表，並支援多位老師共用同一個工作區。前端是 Next.js（App Router），後端資料庫、驗證、即時通訊全部走 Supabase；另有一個獨立部署的遊戲引擎子專案（`game-engine/`），透過 Vercel 的 Multi-Zones rewrite 掛在同一個網域的 `/games` 底下。

> 這份 README 是依照目前實際的程式碼結構重新整理的（原本的版本內容已經過時，例如引用不存在的 `.env.example`、只提到 lesson-ordering 這一項小功能）。

## 專案結構

這是一個 monorepo，包含兩個各自獨立部署的 Next.js 專案：

```
mind-ai-tutor/
├── app/            # 主站（教師端）— App Router 頁面與 API routes
├── components/      hooks/  lib/  contexts/  types/  utils/   # 共用的舊路徑別名，實際多數程式碼在 app/ 底下
├── scripts/        # Supabase SQL migration（手動在 SQL Editor 執行，見下方）
├── docs/           # 設計文件、驗收紀錄、Email 樣板
├── middleware.ts   # 全站身份驗證守門
├── next.config.ts  # 安全性標頭（CSP 等）+ /games 的 Multi-Zones rewrite
└── game-engine/    # 獨立部署的遊戲引擎子專案，見 game-engine/README.md
```

`game-engine/` 是完全獨立的 Next.js 專案，在 Vercel 上是另一個 Project、另一個網域，`basePath` 設成 `/games`。主站透過 `next.config.ts` 的 `rewrites()` 把 `mindaitutor.com/games/*` 轉發過去，讓學生感覺是同一個網站；兩邊各自有各自的 `package.json`、部署流程、環境變數。詳細說明見 [`game-engine/README.md`](./game-engine/README.md)。

## 核心功能

- **身份驗證**：Email/密碼登入、Google OAuth、忘記密碼／重設密碼、Supabase Auth 管理
- **學生管理**：學生資料、進度、出席、作業紀錄
- **課程管理（Lessons）**：建立、編輯教材內容
- **數位遊戲（Digital Games）**：資料驅動的遊戲引擎，關卡內容、順序、AI 助教提示詞、獎勵設定都可在教師端調整，不用改遊戲引擎程式碼
- **AI 測驗（AI Quiz）**：用 Gemini 產生測驗題目、練習題、學習分析，可分享公開連結讓學生作答
- **課堂即時模式（Live Session）**：老師開一場即時課堂，投影片＋投票／問答／即時反應，學生用代碼加入，不需要帳號
- **行事曆（Events）**：活動排程，支援標籤、狀態、優先順序篩選
- **學生反饋（Feedback）**：老師與家長／學生之間的意見往來
- **活動紀錄（Activities）**：系統通知與異動紀錄
- **數據分析（Reports）**：學習時間分佈、完成率、學習時間軸、分類統計、AI 互動分佈
- **工作區（Team Workspace）**：一個帳號可以建立/加入一個工作區，邀請其他老師共用課程與活動；既有資料預設不共用，需要老師手動選擇分享
- **系統管理（Admin）**：管理員專用的後台
- **多語系**：繁體中文／English 切換
- **多裝置**：手機版與桌機版分開優化過的導覽/版面

## 技術棧

- **框架**：Next.js（App Router）、React、TypeScript
- **UI**：Tailwind CSS、Radix UI（shadcn/ui 風格元件）、lucide-react 圖示
- **後端／資料庫**：Supabase（Postgres + Auth + Row Level Security + Realtime）
- **AI**：Google Gemini（`@google/genai`），伺服器端呼叫，API 金鑰不外流到瀏覽器
- **狀態管理**：React Context、TanStack Query
- **資料視覺化**：Chart.js、Recharts、Nivo
- **文件匯出**：PDF（jsPDF/html2pdf）、DOCX、PPTX（pptxgenjs）、Excel（exceljs）
- **測試**：Vitest + Testing Library
- **部署**：Vercel（主站與 `game-engine/` 各自獨立部署）

## 快速開始

### 前置需求

- Node.js **24.x**（見 `package.json` 的 `engines` 欄位）
- npm（專案用的是 `package-lock.json`，不是 yarn/pnpm）
- 一個 Supabase 專案

### 安裝

```bash
git clone <repository-url>
cd mind-ai-tutor
npm install
```

### 環境變數

專案目前沒有附 `.env.example`，請在根目錄自行建立 `.env.local`，內容依需求包含：

```bash
# Supabase（必填）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # 僅伺服器端使用，例如 /api/team/invite 寄邀請信

# Gemini AI（AI 測驗／學習分析等功能需要）
GEMINI_API_KEY=
GEMINI_MODEL=                   # 選填，未設定則用程式內建預設值
GEMINI_IMAGE_MODEL=             # 選填，遊戲封面生成用

# 數位遊戲子專案（game-engine/）
NEXT_PUBLIC_GAME_ENGINE_URL=    # 教師端「開始遊戲」按鈕要連去的網域
GAME_ENGINE_ORIGIN=             # 選填，/games 的 rewrite 目標；未設定預設指向正式站

# 其他選填
AI_GAME_COVERS_ENABLED=         # 是否開放 AI 生成遊戲封面
LIVE_PREVIEW_DIR=
```

`SUPABASE_SERVICE_ROLE_KEY` 擁有繞過 RLS 的權限，絕對不能加 `NEXT_PUBLIC_` 前綴、也不能出現在任何 client component 裡。

### 開發

```bash
npm run dev
```

打開 [http://localhost:3000](http://localhost:3000)。

### 測試與檢查

```bash
npm test              # vitest run
npx tsc --noEmit -p . # TypeScript 型別檢查
npm run lint          # next lint
npm run build         # production build
```

## 資料庫設定

Supabase 沒有接 CLI/migration 工具，所有 schema 變更都是 `scripts/*.sql` 這個資料夾底下的獨立 SQL 檔，**手動貼到 Supabase SQL Editor 執行**。每個檔案都寫成可以重複執行（`create table if not exists`、`create or replace function`、`drop policy if exists` 再 `create policy` 之類的寫法），照檔名時間順序執行大致就是專案演進的順序；比較新的核心表格（profiles、students、events、team workspace 等）用得到的檔案包括：

- `create_profiles_table.sql`、`create_missing_tables.sql` — 基礎表格
- `add_owner_scoping_*.sql`、`fix_*_rls.sql` — 各表的 Row Level Security
- `add_team_workspaces.sql`、`add_team_scoping_events.sql`、`fix_team_function_privileges.sql` — 工作區共編功能
- `add_live_sessions.sql`、`add_live_session_phase2.sql` — 課堂即時模式
- `add_ai_quizzes.sql`、`add_ai_quiz_sharing.sql` — AI 測驗
- `add_public_game_manifest.sql`、`add_game_cover_*.sql` — 數位遊戲引擎（`game-engine/` 讀取用）
- `harden_game_student_data.sql`、`fix_ux_review_findings.sql` — 安全性強化

有幾個 `.test.ts` 是對應 SQL 檔的 Vitest 測試（測 SQL 字串內容，不是連正式資料庫跑），例如 `scripts/add_live_sessions.test.ts`。

## 部署

主站與 `game-engine/` 是 Vercel 上**兩個獨立的 Project**：

1. 主站（這個資料夾）：Root Directory 留空，`vercel.json` 裡有基本安全性標頭；更完整的 CSP 等標頭是在 `next.config.ts` 的 `headers()` 設定。
2. `game-engine/`：Vercel Root Directory 指向 `game-engine/`，`basePath` 設 `/games`，各自獨立網域。

主站的 `next.config.ts` 用 `rewrites()` 把 `/games/*` 轉發到 `GAME_ENGINE_ORIGIN`（未設定時預設指向正式站網址），讓兩個 Vercel 部署在使用者看起來像同一個網站。

## 文件

`docs/` 資料夾底下有各功能的設計文件與驗收紀錄，例如 `live-session-design.md`（課堂即時模式）、`team-workspace-design.md`（工作區共編）、`admin-overview.md`（後台）、`email-templates/`（Supabase Auth 信件樣板）等，改動相關功能前建議先看一下對應文件。

## 授權

`package.json` 標記為 `"private": true`，屬於內部專案，未對外開源。

---

## English

A teaching-management platform for teachers: lessons, digital games, AI-generated quizzes, student management, a calendar, live in-class interaction, and analytics — with support for multiple teachers sharing one workspace. The frontend is Next.js (App Router); the database, auth, and realtime layer run entirely on Supabase. A separately-deployed game engine sub-project (`game-engine/`) is mounted under `/games` on the same domain via a Vercel Multi-Zones rewrite.

> This README was rewritten from the actual current codebase — the previous version was out of date (it referenced a `.env.example` that doesn't exist and only documented one small feature, lesson ordering).

### Project layout

This is a monorepo with two independently-deployed Next.js projects:

```
mind-ai-tutor/
├── app/            # Main app (teacher-facing) - App Router pages and API routes
├── components/ hooks/ lib/ contexts/ types/ utils/   # Shared path aliases; most code lives under app/
├── scripts/        # Supabase SQL migrations (run manually in the SQL editor, see below)
├── docs/           # Design docs, acceptance notes, email templates
├── middleware.ts   # App-wide auth gate
├── next.config.ts  # Security headers (CSP, etc.) + the /games Multi-Zones rewrite
└── game-engine/    # Independently-deployed game engine sub-app, see game-engine/README.md
```

`game-engine/` is a fully separate Next.js project - its own Vercel project, its own domain, `basePath` set to `/games`. This app's `next.config.ts` `rewrites()` proxies `mindaitutor.com/games/*` to it, so it reads as one site to students; each side has its own `package.json`, deploy pipeline, and env vars. See [`game-engine/README.md`](./game-engine/README.md) for details.

### Core features

- **Auth**: email/password, Google OAuth, forgot/reset password, Supabase Auth
- **Students**: profiles, progress, attendance, assignments
- **Lessons**: create and edit teaching content
- **Digital Games**: a data-driven game engine - level content, order, the AI tutor's prompt, and rewards are all configured from the teacher app, no engine code changes needed
- **AI Quiz**: Gemini-generated quizzes, practice exercises, and learning analysis, with shareable public links for students to take them
- **Live Session**: a teacher runs a live class - slides plus polls/Q&A/live reactions; students join with a code, no account needed
- **Events**: a calendar with tag/status/priority filters
- **Feedback**: two-way notes between teachers and parents/students
- **Activities**: system notifications and change history
- **Reports**: time-spent distribution, completion rates, a learning timeline, category breakdowns, AI interaction distribution
- **Team Workspace**: an account can create or join one workspace to share lessons and events with other teachers; pre-existing data is not shared automatically - a teacher opts in per resource
- **Admin**: an admin-only back office
- **i18n**: Traditional Chinese / English
- **Responsive**: separately-tuned mobile and desktop navigation/layout

### Tech stack

- **Framework**: Next.js (App Router), React, TypeScript
- **UI**: Tailwind CSS, Radix UI (shadcn/ui-style components), lucide-react icons
- **Backend/DB**: Supabase (Postgres + Auth + Row Level Security + Realtime)
- **AI**: Google Gemini (`@google/genai`), called server-side only - the API key never reaches the browser
- **State**: React Context, TanStack Query
- **Data viz**: Chart.js, Recharts, Nivo
- **Document export**: PDF (jsPDF/html2pdf), DOCX, PPTX (pptxgenjs), Excel (exceljs)
- **Testing**: Vitest + Testing Library
- **Deployment**: Vercel (this app and `game-engine/` deployed as separate projects)

### Getting started

#### Prerequisites

- Node.js **24.x** (see `engines` in `package.json`)
- npm (the repo ships a `package-lock.json`, not a yarn/pnpm lockfile)
- A Supabase project

#### Install

```bash
git clone <repository-url>
cd mind-ai-tutor
npm install
```

#### Environment variables

There's no `.env.example` in the repo right now - create `.env.local` yourself at the project root with what you need:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-side only, e.g. /api/team/invite sending invite emails

# Gemini AI (needed for AI Quiz / learning analysis / etc.)
GEMINI_API_KEY=
GEMINI_MODEL=                   # optional, falls back to a built-in default
GEMINI_IMAGE_MODEL=             # optional, used for game cover generation

# Digital Games sub-app (game-engine/)
NEXT_PUBLIC_GAME_ENGINE_URL=    # domain the teacher app's "Start Game" button links to
GAME_ENGINE_ORIGIN=             # optional, the /games rewrite target; defaults to production if unset

# Optional
AI_GAME_COVERS_ENABLED=         # whether AI game-cover generation is enabled
LIVE_PREVIEW_DIR=
```

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely - never prefix it with `NEXT_PUBLIC_` and never let it reach a client component.

#### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

#### Tests and checks

```bash
npm test              # vitest run
npx tsc --noEmit -p . # TypeScript type-check
npm run lint           # next lint
npm run build          # production build
```

### Database setup

There's no Supabase CLI or migration tool wired up - every schema change is its own file under `scripts/*.sql`, **run manually in the Supabase SQL editor**. Each file is written to be idempotent (`create table if not exists`, `create or replace function`, `drop policy if exists` followed by `create policy`, and so on); running them roughly in filename/date order tracks the project's actual history. The ones behind the current core tables (profiles, students, events, team workspaces, etc.) include:

- `create_profiles_table.sql`, `create_missing_tables.sql` - base tables
- `add_owner_scoping_*.sql`, `fix_*_rls.sql` - Row Level Security per table
- `add_team_workspaces.sql`, `add_team_scoping_events.sql`, `fix_team_function_privileges.sql` - team co-editing
- `add_live_sessions.sql`, `add_live_session_phase2.sql` - Live Session
- `add_ai_quizzes.sql`, `add_ai_quiz_sharing.sql` - AI Quiz
- `add_public_game_manifest.sql`, `add_game_cover_*.sql` - the digital games engine (read by `game-engine/`)
- `harden_game_student_data.sql`, `fix_ux_review_findings.sql` - security hardening

A few `.test.ts` files are Vitest tests for their matching SQL file's content (testing the SQL text itself, not running against a real database) - e.g. `scripts/add_live_sessions.test.ts`.

### Deployment

The main app and `game-engine/` are **two separate Vercel projects**:

1. Main app (this folder): Root Directory left blank; `vercel.json` carries a baseline set of security headers, and the fuller CSP etc. lives in `next.config.ts`'s `headers()`.
2. `game-engine/`: Vercel Root Directory set to `game-engine/`, `basePath` set to `/games`, its own domain.

The main app's `next.config.ts` `rewrites()` proxies `/games/*` to `GAME_ENGINE_ORIGIN` (defaults to the production game-engine URL if unset), so the two separate Vercel deployments read as one site to users.

### Documentation

`docs/` has design docs and acceptance notes per feature - e.g. `live-session-design.md` (Live Session), `team-workspace-design.md` (Team Workspace), `admin-overview.md` (the admin back office), `email-templates/` (Supabase Auth email templates). Worth a read before touching the feature it covers.

### License

`package.json` is marked `"private": true` - this is an internal project, not open source.
