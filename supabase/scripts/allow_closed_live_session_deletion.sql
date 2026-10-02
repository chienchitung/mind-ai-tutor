-- Generated with Supabase CLI migration new; kept in scripts/ to match this repository.
-- Run after add_live_sessions.sql and add_live_session_phase2.sql.
-- No rows are deleted by this migration. Existing ON DELETE CASCADE foreign
-- keys remove all session interaction records in the same transaction.
begin;
grant delete on public.live_sessions to authenticated;
drop policy if exists live_sessions_owner_delete_closed on public.live_sessions;
create policy live_sessions_owner_delete_closed on public.live_sessions
  for delete to authenticated
  using ((select auth.uid()) = user_id and status = 'closed');
commit;
