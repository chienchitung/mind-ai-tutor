-- Generalizes unlimited AI points beyond "is admin" to "is admin OR is on a
-- plan that grants unlimited points" (Enterprise, per the marketing copy
-- on app/subscription/page.tsx), via a new profiles.plan column - so a
-- future paid-plan upgrade flow can grant unlimited points to a specific
-- teacher account without any further schema/code change.
--
-- IMPORTANT - this migration also fixes a CRITICAL gap discovered while
-- building this: scripts/fix_profiles_role_escalation.sql (the
-- role-self-escalation trigger) was written but was NEVER actually applied
-- to this database - `select * from pg_trigger` on public.profiles came
-- back with no such trigger. Any authenticated user could currently run
-- `supabase.from('profiles').update({ role: 'admin' }).eq('user_id', me)`
-- from the browser and grant themselves admin. This migration recreates
-- that trigger from scratch (so it does not depend on the old script ever
-- having been run) and extends it to guard the new `plan` column the same
-- way, so a normal user can't self-grant Enterprise-tier unlimited points
-- either.
--
-- Run once in the Supabase SQL editor. Requires public.is_admin() from
-- scripts/fix_profiles_rls.sql to already exist.

begin;

alter table public.profiles add column if not exists plan text not null default 'free'
  check (plan = any (array['free', 'pro', 'enterprise']));

-- Guards both privilege-bearing columns on profiles: role (admin access)
-- and plan (unlimited AI points once plan = 'enterprise'). auth.uid() is
-- null for a direct SQL-editor/service-role session - that path (how
-- scripts/set_user_admin.sql promotes someone today) is left unrestricted.
-- Any request carrying a JWT (i.e. came through the app) may only change
-- either column if the actor is already an admin.
create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.plan is distinct from old.plan)
     and auth.uid() is not null
     and not public.is_admin() then
    new.role := old.role;
    new.plan := old.plan;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_profile_role_change();

create or replace function public.has_unlimited_ai_points()
returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.profiles where user_id = auth.uid() and plan = 'enterprise'
  );
$$;
revoke all on function public.has_unlimited_ai_points() from public, anon;
grant execute on function public.has_unlimited_ai_points() to authenticated;

create or replace function public.deduct_ai_points(p_user uuid, p_cost integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  v_grant integer := public.ai_points_monthly_grant();
  v_row public.teacher_ai_points%rowtype;
begin
  if public.has_unlimited_ai_points() then return 2147483647; end if;

  insert into public.teacher_ai_points(user_id, balance, period)
  values (p_user, v_grant, v_period)
  on conflict (user_id) do nothing;

  select * into v_row from public.teacher_ai_points where user_id = p_user for update;

  if v_row.period < v_period then
    update public.teacher_ai_points set balance = v_grant, period = v_period, updated_at = now()
      where user_id = p_user
      returning * into v_row;
  end if;

  if v_row.balance < p_cost then
    return null;
  end if;

  update public.teacher_ai_points set balance = balance - p_cost, updated_at = now()
    where user_id = p_user
    returning * into v_row;

  return v_row.balance;
end;
$$;

create or replace function public.get_ai_points_balance()
returns table(balance integer, monthly_grant integer, period date)
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  v_grant integer := public.ai_points_monthly_grant();
  v_row public.teacher_ai_points%rowtype;
begin
  if v_user is null then return; end if;
  if public.has_unlimited_ai_points() then
    return query select null::integer, null::integer, v_period;
    return;
  end if;
  select * into v_row from public.teacher_ai_points where user_id = v_user;
  if not found or v_row.period < v_period then
    return query select v_grant, v_grant, v_period;
    return;
  end if;
  return query select v_row.balance, v_grant, v_row.period;
end;
$$;

commit;
