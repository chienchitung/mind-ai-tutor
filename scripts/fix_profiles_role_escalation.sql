-- CRITICAL: scripts/fix_profiles_rls.sql's profiles_update_own policy lets
-- any authenticated user update their own profiles row with no restriction
-- on which columns change:
--
--   create policy profiles_update_own on public.profiles for update
--     to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
--
-- Nothing stops a normal logged-in user from running, straight from the
-- browser with the public anon key and their own session:
--
--   supabase.from('profiles').update({ role: 'admin' }).eq('user_id', user.id)
--
-- middleware.ts's ADMIN_ONLY_PATHS check and every is_admin()-gated RLS
-- policy (profiles_select_admin, learning_records_select_admin, etc. in
-- scripts/restrict_game_data_to_admin.sql) trust profiles.role - so this
-- is a full privilege escalation to admin, no exploit needed beyond one
-- authenticated account.
--
-- Today, promoting someone to admin is only ever done out-of-band via
-- scripts/set_user_admin.sql, run directly in the Supabase SQL editor
-- (a session with no auth.uid() - see the branch below). There is no
-- in-app path where an admin edits another user's role, so this trigger
-- can safely lock role changes out of the RLS/PostgREST path entirely
-- for now; if an admin UI for role management is added later, give it
-- an is_admin()-gated path and this trigger will allow it through.
--
-- Run once in the Supabase SQL editor. Requires public.is_admin() from
-- scripts/fix_profiles_rls.sql to already exist.

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for a direct SQL-editor/service-role session (no
  -- PostgREST JWT context), which is how set_user_admin.sql promotes
  -- someone today - let that through unconditionally. Any request that
  -- does carry a JWT (i.e. came through the app) may only change role if
  -- the actor is already an admin.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_profile_role_change();
