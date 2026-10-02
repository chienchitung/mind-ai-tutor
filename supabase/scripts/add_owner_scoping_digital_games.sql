-- digital_games is only touched by this app (app/digital-games/page.tsx)
-- - confirmed excel-master-game never references it - so this is safe
-- to fully owner-scope like events/lessons(write)/feedback, no public
-- read carve-out needed.
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

  alter table public.digital_games
    add column if not exists user_id uuid references auth.users(id) on delete cascade;
  update public.digital_games set user_id = v_admin_id where user_id is null;
  alter table public.digital_games alter column user_id set not null;
  alter table public.digital_games alter column user_id set default auth.uid();
end $$;

alter table public.digital_games enable row level security;

drop policy if exists digital_games_select_own on public.digital_games;
create policy digital_games_select_own on public.digital_games
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists digital_games_insert_own on public.digital_games;
create policy digital_games_insert_own on public.digital_games
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists digital_games_update_own on public.digital_games;
create policy digital_games_update_own on public.digital_games
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists digital_games_delete_own on public.digital_games;
create policy digital_games_delete_own on public.digital_games
  for delete to authenticated using (auth.uid() = user_id);
