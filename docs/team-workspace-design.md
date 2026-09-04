# 團隊共編（Team Workspace）設計方案

日期：2026-09-02
狀態：草案，尚未實作 — 需要確認下方「待決策問題」後才開始動工

## 背景與目標

目前系統裡每個帳號的資料（`lessons`、`events`、`feedback`、`digital_games`、`live_sessions`…）都是 owner-only：RLS 用 `auth.uid() = user_id` 隔離，一個帳號看不到、也改不到別人的資料。這是先前修資料外洩問題時刻意做的設計，本身沒有錯，但也代表**目前系統完全沒有「多人共用同一批課程/學生資料」的能力**。

目標：讓一個老師可以邀請同事（例如助教、同科目的其他老師）加入自己的「工作區」，加入後對方可以直接讀寫同一批課程、學生、活動資料，不需要重新輸入一次。

非目標（V1 不做）：
- 不做「單筆資料個別分享」（例如只分享某一堂課給某人）。這次要的是整組帳號共編，per-resource 分享是完全不同的資料模型，之後真的有需求再談。
- 不做細緻的權限分級（例如「只能看不能改」「只能編輯課程不能刪學生」）。V1 只分「工作區擁有者」跟「成員」兩種角色。
- 不取代 `profiles.role`（admin/teacher/student）那套系統層級角色。工作區成員身份跟你是不是系統 admin 是兩件事，互不影響。

## 資料模型

### 新增兩張表

```sql
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
```

`teams.owner_id` 是給「誰能刪除整個工作區」這種不可轉移的操作用的；`team_members` 裡的 `role = 'owner'` 那筆是給「誰能邀請/移除成員」這種可能之後想開放給多人做的操作用的。兩者現階段會是同一人，但分開存比較不會綁死未來的彈性（例如以後想讓 owner 把管理權轉移給別人）。

### 既有資料表怎麼接上

每個既有的 owner-scoped 表（`lessons`、`events`、`feedback`、`digital_games`、`live_sessions`，之後有需要可以再擴充）都加一個欄位：

```sql
alter table public.lessons add column if not exists team_id uuid references public.teams(id);
-- events / feedback / digital_games / live_sessions 依此類推
```

`user_id` 保留不動，繼續代表「這筆資料是誰建立的」（稽核用途）；`team_id` 是另外加的欄位，決定「除了建立者以外，還有誰看得到、改得到」。

**實作時修正的一個設計**（草案原本寫「幫每個帳號自動建立個人工作區」，實作 `events` 試點時發現這樣行不通，改成下面這版）：`team_id` 保持**可為 null，且不強制遷移既有資料**。原因是「一人只能屬於一個工作區」這條規則（見待決策問題 1）如果搭配「每個帳號都自動有個人工作區」，會變成每個既有帳號一開始就「已經在一個 team 裡」——那之後想邀請任何一個既有用戶加入別人的工作區，都會直接被 `ALREADY_IN_A_TEAM` 擋掉，等於邀請功能對所有既有帳號都失效。改成**完全 opt-in**：
- `team_id` 預設值是「目前使用者現在所屬工作區的 id」，沒有工作區的人就是 `null`。實作上**不能**直接把查 `team_members` 的 subquery 塞進 `DEFAULT`（Postgres 會噴 `0A000: cannot use subquery in DEFAULT expression`——這是實際跑 SQL 才發現的，跟 `user_id default auth.uid()` 不是同一種機制，因為 `auth.uid()` 是單純的函式呼叫，不是 subquery）。改成先包一個 `public.current_team_id()` 函式（定義在 `add_team_workspaces.sql`），欄位預設值設成 `default public.current_team_id()`——函式呼叫本身可以放進 `DEFAULT`，即使函式內部跑的是同一條查詢。之後每張表比照辦理，直接重用同一個函式即可，不用每張表各寫一次。
- 沒有人會被自動塞進工作區。使用者必須明確按下「建立工作區」（`create_team()`）才會第一次出現在 `team_members` 裡；在那之前，他所有資料的 `team_id` 都是 `null`，RLS 退回原本的 owner-only 判斷，行為跟現在完全一樣。
- 這樣不需要對任何既有資料跑 backfill，上線當下零風險、零行為改變，只有使用者自己主動建立/加入工作區之後才會開始有共用行為。

RLS policy 因此要同時涵蓋兩種情況（見下方範例）：`team_id` 有值時看 `is_team_member(team_id)`，`team_id` 是 `null` 時退回 `auth.uid() = user_id`。

```sql
using (
  (team_id is not null and public.is_team_member(team_id))
  or (team_id is null and auth.uid() = user_id)
)
```

## RLS 策略

比照現有 `is_admin()` 的作法，寫一個 `SECURITY DEFINER` 輔助函式：

```sql
create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;
```

然後每張表的 policy 從：

```sql
using (auth.uid() = user_id)
```

換成：

```sql
using (public.is_team_member(team_id))
```

`with check` 也一樣換掉，這樣新增資料時也會檢查「你是不是這個 team 的成員」而不是只看你是不是原始建立者。

## 邀請流程

**建議 V1：只能邀請「已經有帳號」的 email**，不做寄邀請信給未註冊使用者的流程，也沒有「建立工作區」以外的預設狀態——使用者要先透過 `create_team()` 自己建立一個工作區（自己就是 owner），才能開始邀請別人；理由：
- 系統目前的 email 只用在 Supabase Auth 內建的密碼重設/驗證信，沒有自建的 transactional email 機制，要做「寄邀請連結給還沒註冊的人」等於要多接一套 email 服務（或濫用 Supabase 的邀請 API），複雜度不成比例。
- 大部分情境（找同校同事共編）對方本來就會有帳號，先滿足這個情境，之後真的常有「對方還沒註冊」的需求再擴充。

流程：
1. 工作區擁有者在「設定」頁輸入同事的 email。
2. 一個 `SECURITY DEFINER` RPC（例如 `invite_team_member(p_team_id uuid, p_email text)`）查 `auth.users` 有沒有這個 email：
   - 找不到 → 回傳明確錯誤，前端顯示「這個 email 還沒註冊，請先請對方註冊帳號」。
   - 找到但已經是某個 team 的成員 → 回傳錯誤（V1 每人只能屬於一個工作區，見下方待決策）。
   - 找到且可加入 → 直接 insert 進 `team_members`，不需要對方「接受」這一步（比照多數協作工具的「直接加入」而非「寄信等對方按確認」，可以之後再加確認步驟）。
3. 成員自己可以在設定頁「離開工作區」；擁有者可以移除成員。

## 前端變更

- **設定頁**新增「工作區成員」區塊：目前成員清單、邀請輸入框、（擁有者限定）移除按鈕。
- 側邊欄/頂端不需要新增「切換工作區」這種 UI——V1 假設一人只屬於一個工作區（見下方待決策），不需要切換。
- 現有「新增課程/活動/回饋」的表單邏輯**不需要改**：`team_id` 欄位的 `default public.current_team_id()`（見上方「既有資料表怎麼接上」）會在 insert 時自動代入目前使用者所屬工作區的 id（沒有工作區就是 `null`），跟 `user_id` 一直以來用 `default auth.uid()` 是同一個道理，前端完全不用碰。

## 待決策問題（需要你決定，不是我能替你決定的）

1. **一人可以同時屬於多個工作區嗎？**
   建議 V1 先限制「一人只能屬於一個工作區」（自己的個人工作區，或被邀請加入的那個），避免一開始就要做「切換工作區」的 UI 跟「這筆新資料要算誰的」這類判斷。之後如果真的有人需要同時待在兩個工作區（例如身兼兩校），再擴充成多對多。
2. **加入別人的工作區後，我原本自己建立的課程/學生資料怎麼辦？**
   建議：**不合併**。加入別人的工作區只代表你現在對「那個工作區」的資料有讀寫權，你自己原本的個人工作區資料維持原樣、繼續只有你看得到（除非你把它們手動搬過去，V1 不做批次搬移功能）。這樣最不容易出錯，也最接近「我被拉去幫忙帶別人的班」而不是「兩人的東西合併成一個大帳號」的直覺。
3. **要不要保留「離開工作區」跟「移除成員」後的資料歸屬？**
   例如某成員在別人的工作區建立了幾堂課，之後被移除，那些課要留在工作區裡（歸屬工作區本身）還是跟著他走？建議留在工作區（因為 `team_id` 才是資料的歸屬依據），這也是多數協作工具的預設行為，但確認一下是否符合你的預期。
4. **要不要限制工作區人數上限？**
   目前沒有訂閱方案跟人數的關聯設計，如果之後要跟 `app/subscription` 的方案綁定（例如免費方案最多 2 人），這會影響 `invite_team_member` 這支 RPC 要不要加人數檢查，現在先不做，但先問一下是不是之後的規劃方向。

## 風險與工作量估計

- **資料庫遷移**：中等風險。要動到 5 張左右既有表的 schema 跟 RLS policy，照現有 `scripts/*.sql` 的模式一次一張表做、每張都可獨立驗證，風險可控，但因為要跑在正式 Supabase 上，仍然只能由你手動執行、我沒辦法在這個環境直接跑。
- **前端**：中等工作量。設定頁新增成員管理 UI、所有「新增資料」的表單要改成寫入 `team_id` 而不是 `user_id`，這部分改動面比較廣（觸及 lessons/events/feedback/digital_games/live-session 好幾個頁面的建立邏輯），建議拆成多個小 PR 一張表一張表做，而不是一次全部改完。
- **不影響**：`admin` 角色、game-engine 那邊讀 `lessons`/`markdown_content` 給學生玩遊戲用的 anon 讀取（`lessons_select_anon` policy）完全不受影響，因為那條 policy 本來就跟 owner/team 無關。

## 建議實作順序

1. ~~先確認上面 4 個待決策問題~~ — 已確認，照本文件的建議值進行。
2. ~~`teams`/`team_members` 表 + `is_team_member()` 函式 + migration 腳本~~ — 已寫成 `scripts/add_team_workspaces.sql`（純新增，不動任何既有表，上線零風險），還多加了 `create_team`/`invite_team_member`/`remove_team_member`/`list_team_members` 四支 RPC，成員管理全部走這幾支函式，不開放直接寫 `teams`/`team_members`。**這個腳本需要你手動到 Supabase SQL editor 執行一次**，我在這個環境沒有資料庫存取權限。
3. ~~選 `events` 當試點~~ — `scripts/add_team_scoping_events.sql` 已完成（加 `team_id` 欄位 + 換 RLS policy + `share_my_events_with_team()`）。設定頁的成員管理 UI 也已完成（列出成員、邀請、移除、離開）。
4. **已完成**：確認 `events` 這條路徑沒問題後，`lessons`/`feedback`/`digital_games` 依樣比照辦理，寫成 `scripts/add_team_scoping_lessons.sql`／`add_team_scoping_feedback.sql`／`add_team_scoping_digital_games.sql`，同樣的三步驟（加 `team_id` 欄位 + subquery default + 換 RLS policy + `share_my_X_with_team()`）。`lessons` 多一個例外：`lessons_select_anon`（開放給 `anon` 角色，game-engine 讀取課程內容用）完全不動，只換 `authenticated` 角色的 select policy。設定頁的「分享我的活動」按鈕也擴充成「分享我的舊資料」，一次呼叫全部 4 支 `share_my_*_with_team()`，回報各類型分享了幾筆。**這三個腳本一樣需要你手動到 Supabase SQL editor 各自執行一次**。
5. `live_sessions` 尚未比照辦理——是否需要，以及要不要連同 live session 底下的問題/投票/回饋一起納入工作區共用，留待之後有需求再談。
