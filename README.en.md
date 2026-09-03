<p align="center">
  <img src="./public/brand/mindaitutor-cover-logo.svg" alt="MindAiTutor" width="280" />
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3FCF8E?logo=supabase&logoColor=white">
  <img alt="Tests" src="https://img.shields.io/badge/Tests-Vitest-6E9F18?logo=vitest&logoColor=white">
  <img alt="Deploy" src="https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel&logoColor=white">
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-green"></a>
</p>

<p align="center"><a href="./README.md">繁體中文</a> ｜ English (this file)</p>

A teaching-management platform for teachers: lessons, digital games, AI-generated quizzes, student management, a calendar, live in-class interaction, and analytics — with support for multiple teachers sharing one workspace. The frontend is Next.js (App Router); the database, auth, and realtime layer run entirely on Supabase. A separately-deployed game engine sub-project (`game-engine/`) is mounted under `/games` on the same domain via a Vercel Multi-Zones rewrite.

> This README was rewritten from the actual current codebase — the previous version was out of date (it referenced a `.env.example` that doesn't exist and only documented one small feature, lesson ordering).

## Project layout

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

## Core features

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

## Tech stack

- **Framework**: Next.js (App Router), React, TypeScript
- **UI**: Tailwind CSS, Radix UI (shadcn/ui-style components), lucide-react icons
- **Backend/DB**: Supabase (Postgres + Auth + Row Level Security + Realtime)
- **AI**: Google Gemini (`@google/genai`), called server-side only - the API key never reaches the browser
- **State**: React Context, TanStack Query
- **Data viz**: Chart.js, Recharts, Nivo
- **Document export**: PDF (jsPDF/html2pdf), DOCX, PPTX (pptxgenjs), Excel (exceljs)
- **Testing**: Vitest + Testing Library
- **Deployment**: Vercel (this app and `game-engine/` deployed as separate projects)

## Getting started

### Prerequisites

- Node.js **24.x** (see `engines` in `package.json`)
- npm (the repo ships a `package-lock.json`, not a yarn/pnpm lockfile)
- A Supabase project

### Install

```bash
git clone <repository-url>
cd mind-ai-tutor
npm install
```

### Environment variables

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

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Tests and checks

```bash
npm test              # vitest run
npx tsc --noEmit -p . # TypeScript type-check
npm run lint           # next lint
npm run build          # production build
```

## Database setup

There's no Supabase CLI or migration tool wired up - every schema change is its own file under `scripts/*.sql`, **run manually in the Supabase SQL editor**. Each file is written to be idempotent (`create table if not exists`, `create or replace function`, `drop policy if exists` followed by `create policy`, and so on); running them roughly in filename/date order tracks the project's actual history. The ones behind the current core tables (profiles, students, events, team workspaces, etc.) include:

- `create_profiles_table.sql`, `create_missing_tables.sql` - base tables
- `add_owner_scoping_*.sql`, `fix_*_rls.sql` - Row Level Security per table
- `add_team_workspaces.sql`, `add_team_scoping_events.sql`, `fix_team_function_privileges.sql` - team co-editing
- `add_live_sessions.sql`, `add_live_session_phase2.sql` - Live Session
- `add_ai_quizzes.sql`, `add_ai_quiz_sharing.sql` - AI Quiz
- `add_public_game_manifest.sql`, `add_game_cover_*.sql` - the digital games engine (read by `game-engine/`)
- `harden_game_student_data.sql`, `fix_ux_review_findings.sql` - security hardening

A few `.test.ts` files are Vitest tests for their matching SQL file's content (testing the SQL text itself, not running against a real database) - e.g. `scripts/add_live_sessions.test.ts`.

## Deployment

The main app and `game-engine/` are **two separate Vercel projects**:

1. Main app (this folder): Root Directory left blank; `vercel.json` carries a baseline set of security headers, and the fuller CSP etc. lives in `next.config.ts`'s `headers()`.
2. `game-engine/`: Vercel Root Directory set to `game-engine/`, `basePath` set to `/games`, its own domain.

The main app's `next.config.ts` `rewrites()` proxies `/games/*` to `GAME_ENGINE_ORIGIN` (defaults to the production game-engine URL if unset), so the two separate Vercel deployments read as one site to users.

## Documentation

`docs/` has design docs and acceptance notes per feature - e.g. `live-session-design.md` (Live Session), `team-workspace-design.md` (Team Workspace), `admin-overview.md` (the admin back office), `email-templates/` (Supabase Auth email templates). Worth a read before touching the feature it covers.

## License

[MIT License](./LICENSE).
