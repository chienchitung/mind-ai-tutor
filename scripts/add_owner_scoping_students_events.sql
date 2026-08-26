-- Tightens `events` from "any authenticated user" (set in the earlier
-- fix_events_rls.sql migration) down to "owner only" - every account was
-- able to see every other account's events because user_id was nullable
-- and never backfilled, and the RLS policies allowed any authenticated
-- user through regardless of ownership.
--
-- NOTE: this file originally also covered a `students` table. That table
-- does not exist in this database (confirmed via information_schema.tables)
-- - the /students page's shared-looking data is unrelated demo fallback
-- data in app/students/page.tsx, not a real per-account leak. Owner
-- scoping for a real students table is a separate decision (build it, or
-- leave that page as-is) - not included here.
--
-- Replace <REPLACE_WITH_EMAIL> below and run once in the Supabase SQL
-- editor.

do $$
declare
  v_email text := '<REPLACE_WITH_EMAIL>';
  v_admin_id uuid;
begin
  select id into v_admin_id from auth.users where email = v_email;
  if v_admin_id is null then
    raise exception 'No auth.users row found for email %', v_email;
  end if;

  -- events does not actually have user_id despite types/supabase.ts
  -- claiming it does (SupabaseSetup.sql's CREATE TABLE never included it)
  alter table public.events
    add column if not exists user_id uuid references auth.users(id) on delete cascade;
  update public.events set user_id = v_admin_id where user_id is null;
  alter table public.events alter column user_id set not null;
  alter table public.events alter column user_id set default auth.uid();
end $$;

-- events: replace the "any authenticated user" policies from
-- fix_events_rls.sql with owner-only ones
drop policy if exists events_select_policy on public.events;
create policy events_select_policy
  on public.events for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists events_insert_policy on public.events;
create policy events_insert_policy
  on public.events for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists events_update_policy on public.events;
create policy events_update_policy
  on public.events for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists events_delete_policy on public.events;
create policy events_delete_policy
  on public.events for delete to authenticated
  using (auth.uid() = user_id);
