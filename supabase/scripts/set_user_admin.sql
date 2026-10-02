-- Promote one user to admin (role = 'admin' in public.profiles), so they
-- can access the /admin area gated by middleware.ts.
--
-- This upserts into `profiles` because signup does not currently create a
-- profiles row for new users - most accounts have none yet.
--
-- Replace the email below and run in the Supabase SQL editor.

do $$
declare
  v_email text := '<REPLACE_WITH_EMAIL>';
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = v_email;

  if v_user_id is null then
    raise exception 'No auth.users row found for email %', v_email;
  end if;

  if exists (select 1 from public.profiles where user_id = v_user_id) then
    update public.profiles set role = 'admin' where user_id = v_user_id;
  else
    insert into public.profiles (user_id, full_name, role)
    values (
      v_user_id,
      coalesce((select raw_user_meta_data->>'full_name' from auth.users where id = v_user_id), v_email),
      'admin'
    );
  end if;
end $$;
