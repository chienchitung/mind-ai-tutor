-- Admin accounts get unlimited AI points instead of the flat monthly grant
-- everyone else gets, the same is_admin() bypass already used for the
-- game-engine device chat cap (see game-engine/src/lib/supabase-server.ts).
-- Layered on top of add_teacher_ai_points.sql - redefines its two
-- functions rather than touching ai_points_monthly_grant() itself, which
-- stays the one place the free-plan grant amount lives.
--
-- Run once in the Supabase SQL editor, after add_teacher_ai_points.sql.

begin;

create or replace function public.deduct_ai_points(p_user uuid, p_cost integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  v_grant integer := public.ai_points_monthly_grant();
  v_row public.teacher_ai_points%rowtype;
begin
  -- Unlimited: skip the ledger entirely rather than writing a fake balance
  -- that would need to be kept in sync with "unlimited" everywhere else.
  if public.is_admin() then return 2147483647; end if;

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
  -- Both columns null signals "unlimited" to the caller (AccountMenu.tsx
  -- renders a badge instead of an X/Y progress bar) rather than reporting
  -- some large fake balance that would need explaining.
  if public.is_admin() then
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
