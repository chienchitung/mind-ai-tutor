-- Adds per-user data isolation to `students`, and tightens `events`
-- (previously opened to "any authenticated user" in fix_events_rls.sql)
-- down to "owner only". Every account was seeing every other account's
-- students/events because neither table filtered by who created the row.
--
-- Existing rows with no owner are assigned to one bootstrap admin
-- account by email, since ownership has to be backfilled onto rows that
-- predate this column existing.
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

  -- students never had an owner column at all
  alter table public.students
    add column if not exists user_id uuid references auth.users(id) on delete cascade;
  update public.students set user_id = v_admin_id where user_id is null;
  alter table public.students alter column user_id set not null;
  alter table public.students alter column user_id set default auth.uid();

  -- events already has user_id, but it was nullable and never backfilled
  update public.events set user_id = v_admin_id where user_id is null;
  alter table public.events alter column user_id set not null;
  alter table public.events alter column user_id set default auth.uid();
end $$;

-- students: enable RLS, owner-only for every operation
alter table public.students enable row level security;

drop policy if exists students_select_own on public.students;
create policy students_select_own
  on public.students for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists students_insert_own on public.students;
create policy students_insert_own
  on public.students for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists students_update_own on public.students;
create policy students_update_own
  on public.students for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists students_delete_own on public.students;
create policy students_delete_own
  on public.students for delete to authenticated
  using (auth.uid() = user_id);

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
