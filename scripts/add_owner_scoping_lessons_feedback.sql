-- Adds per-user data isolation to `lessons` and `feedback` - both are
-- written directly by this app (app/lessons/page.tsx, app/feedback/page.tsx)
-- using the logged-in user's own session, so this is the same safe
-- pattern already applied to events: add user_id if missing, backfill
-- existing rows to one bootstrap admin account (confirmed to be
-- temporary/placeholder data, not real production data), then owner-only
-- RLS.
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

  alter table public.lessons
    add column if not exists user_id uuid references auth.users(id) on delete cascade;
  update public.lessons set user_id = v_admin_id where user_id is null;
  alter table public.lessons alter column user_id set not null;
  alter table public.lessons alter column user_id set default auth.uid();

  alter table public.feedback
    add column if not exists user_id uuid references auth.users(id) on delete cascade;
  update public.feedback set user_id = v_admin_id where user_id is null;
  alter table public.feedback alter column user_id set not null;
  alter table public.feedback alter column user_id set default auth.uid();
end $$;

-- lessons
alter table public.lessons enable row level security;

drop policy if exists lessons_select_own on public.lessons;
create policy lessons_select_own on public.lessons
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists lessons_insert_own on public.lessons;
create policy lessons_insert_own on public.lessons
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists lessons_update_own on public.lessons;
create policy lessons_update_own on public.lessons
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists lessons_delete_own on public.lessons;
create policy lessons_delete_own on public.lessons
  for delete to authenticated using (auth.uid() = user_id);

-- feedback
alter table public.feedback enable row level security;

drop policy if exists feedback_select_own on public.feedback;
create policy feedback_select_own on public.feedback
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists feedback_update_own on public.feedback;
create policy feedback_update_own on public.feedback
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists feedback_delete_own on public.feedback;
create policy feedback_delete_own on public.feedback
  for delete to authenticated using (auth.uid() = user_id);
