-- Run once in the target Supabase project's SQL Editor before deploying quiz storage.
-- This adds a private, per-teacher quiz library; existing lessons/games are unchanged.
begin;

create table if not exists public.ai_quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_quizzes_user_updated_idx on public.ai_quizzes (user_id, updated_at desc);
alter table public.ai_quizzes enable row level security;
revoke all on public.ai_quizzes from anon;
grant select, insert, update, delete on public.ai_quizzes to authenticated;

drop policy if exists ai_quizzes_owner_select on public.ai_quizzes;
create policy ai_quizzes_owner_select on public.ai_quizzes for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists ai_quizzes_owner_insert on public.ai_quizzes;
create policy ai_quizzes_owner_insert on public.ai_quizzes for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists ai_quizzes_owner_update on public.ai_quizzes;
create policy ai_quizzes_owner_update on public.ai_quizzes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists ai_quizzes_owner_delete on public.ai_quizzes;
create policy ai_quizzes_owner_delete on public.ai_quizzes for delete to authenticated using ((select auth.uid()) = user_id);

commit;
