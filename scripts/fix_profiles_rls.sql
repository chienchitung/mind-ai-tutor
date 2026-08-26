-- Enable RLS on `profiles` and give it two policies:
--   1. any authenticated user can read/update their OWN profile row
--      (needed so middleware.ts can check the current user's own role,
--      and so /profile keeps working)
--   2. a user whose own profile has role = 'admin' can read EVERY
--      profile row (needed for the /admin page's user list)
--
-- The admin check is wrapped in a SECURITY DEFINER function so the
-- policy's subquery isn't itself blocked by the very RLS it's part of.
--
-- Run this once in the Supabase SQL editor against the project used by
-- this app.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
