-- Restricts learning_records, leaderboard, chat_messages, and
-- question_counts so only the admin account can read them from inside
-- mind-ai-tutor - other mind-ai-tutor accounts currently see this data
-- because these tables have no RLS at all.
--
-- excel-master-game (https://github.com/chienchitung/excel-master-game)
-- writes into these tables with the anon key and no login, so it has no
-- auth.uid() to scope ownership by - the owner-only pattern used for
-- events/lessons/feedback doesn't apply here. This migration takes a
-- different, narrower approach instead of the multi-tenant fix (which
-- would require changes in that other repo, deferred for now):
--   - anon keeps full read/write access, completely unchanged, so the
--     live game keeps working exactly as it does today
--   - authenticated (i.e. any mind-ai-tutor login) is restricted to
--     admin-role accounts only, via the is_admin() function already
--     created in scripts/fix_profiles_rls.sql
--
-- This does not give each teacher their own slice of this data (that
-- still needs a real class/teacher identifier threaded through
-- excel-master-game's writes) - it only stops OTHER mind-ai-tutor
-- accounts from seeing it. Run scripts/fix_profiles_rls.sql first if
-- you haven't (this depends on public.is_admin()).
--
-- Run once in the Supabase SQL editor.

-- ── learning_records ────────────────────────────────────────────────
alter table public.learning_records enable row level security;

drop policy if exists learning_records_select_admin on public.learning_records;
create policy learning_records_select_admin
  on public.learning_records for select to authenticated
  using (public.is_admin());

drop policy if exists learning_records_select_public on public.learning_records;
create policy learning_records_select_public
  on public.learning_records for select to anon
  using (true);

drop policy if exists learning_records_insert_public on public.learning_records;
create policy learning_records_insert_public
  on public.learning_records for insert to anon, authenticated
  with check (true);

-- ── leaderboard ─────────────────────────────────────────────────────
alter table public.leaderboard enable row level security;

drop policy if exists leaderboard_select_admin on public.leaderboard;
create policy leaderboard_select_admin
  on public.leaderboard for select to authenticated
  using (public.is_admin());

drop policy if exists leaderboard_select_public on public.leaderboard;
create policy leaderboard_select_public
  on public.leaderboard for select to anon
  using (true);

drop policy if exists leaderboard_insert_public on public.leaderboard;
create policy leaderboard_insert_public
  on public.leaderboard for insert to anon, authenticated
  with check (true);

-- ── chat_messages ───────────────────────────────────────────────────
alter table public.chat_messages enable row level security;

drop policy if exists chat_messages_select_admin on public.chat_messages;
create policy chat_messages_select_admin
  on public.chat_messages for select to authenticated
  using (public.is_admin());

drop policy if exists chat_messages_select_public on public.chat_messages;
create policy chat_messages_select_public
  on public.chat_messages for select to anon
  using (true);

drop policy if exists chat_messages_insert_public on public.chat_messages;
create policy chat_messages_insert_public
  on public.chat_messages for insert to anon, authenticated
  with check (true);

-- ── question_counts ─────────────────────────────────────────────────
alter table public.question_counts enable row level security;

drop policy if exists question_counts_select_admin on public.question_counts;
create policy question_counts_select_admin
  on public.question_counts for select to authenticated
  using (public.is_admin());

drop policy if exists question_counts_select_public on public.question_counts;
create policy question_counts_select_public
  on public.question_counts for select to anon
  using (true);

drop policy if exists question_counts_insert_public on public.question_counts;
create policy question_counts_insert_public
  on public.question_counts for insert to anon, authenticated
  with check (true);

-- getOrCreateQuestionCount/incrementQuestionCount in excel-master-game
-- update question_counts via the anon key
drop policy if exists question_counts_update_public on public.question_counts;
create policy question_counts_update_public
  on public.question_counts for update to anon, authenticated
  using (true) with check (true);

-- ── views: make them respect the base tables' RLS ──────────────────
-- Views run with their owner's privileges by default, which can bypass
-- RLS entirely unless security_invoker is set - without this, the
-- policies above may not actually apply when reading through the view.
alter view public.leaderboard_view set (security_invoker = true);
alter view public.leaderboard_best_scores set (security_invoker = true);
alter view public.learning_records_view set (security_invoker = true);
