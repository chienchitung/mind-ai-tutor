-- Monthly AI "points" allowance for teachers, spent on the four AI-generation
-- actions that already had per-day anti-abuse counters
-- (scripts/add_teacher_ai_quota.sql, scripts/add_game_cover_ai_quota.sql).
-- Those per-day counters stay exactly as they are - a coarse burst guard -
-- points become the tighter, user-visible "how much of this month do I have
-- left" constraint for free-plan accounts. Paid-plan differentiation (a
-- bigger or unlimited grant) is intentionally deferred - see
-- ai_points_monthly_grant() below, the one place that decision will land.
--
-- Run once in the Supabase SQL editor, after add_teacher_ai_quota.sql and
-- add_game_cover_ai_quota.sql.

begin;

-- Single source of truth for the monthly grant, so a future per-plan amount
-- (once paid plans are actually payable) is a one-line change here instead
-- of hunting through every function below.
create or replace function public.ai_points_monthly_grant()
returns integer
language sql immutable as $$ select 1000; $$;

create table if not exists public.teacher_ai_points (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 1000,
  period date not null default date_trunc('month', now() at time zone 'utc')::date,
  updated_at timestamptz not null default now()
);
alter table public.teacher_ai_points enable row level security;
revoke all on public.teacher_ai_points from public, anon, authenticated;
-- No select/insert/update policy - every read and write goes through the
-- SECURITY DEFINER functions below, matching teams/team_members' pattern.

-- Internal only (never granted to any client role): lazily rolls the
-- caller's balance over to a fresh monthly grant if a new UTC month has
-- started since their last activity, then deducts p_cost if the (possibly
-- just-reset) balance covers it. Returns the resulting balance on success,
-- null when insufficient - callers must treat null as "stop, do not also
-- consume the daily-count quota for this attempt".
create or replace function public.deduct_ai_points(p_user uuid, p_cost integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  v_grant integer := public.ai_points_monthly_grant();
  v_row public.teacher_ai_points%rowtype;
begin
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
revoke all on function public.deduct_ai_points(uuid, integer) from public, anon, authenticated;

-- Read-only preview for the UI (settings page / account menu). Deliberately
-- does not write - a new-month balance the user hasn't spent from yet is
-- correctly reported as a full grant without needing to touch the row.
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
  select * into v_row from public.teacher_ai_points where user_id = v_user;
  if not found or v_row.period < v_period then
    return query select v_grant, v_grant, v_period;
    return;
  end if;
  return query select v_row.balance, v_grant, v_row.period;
end;
$$;
revoke all on function public.get_ai_points_balance() from public, anon;
grant execute on function public.get_ai_points_balance() to authenticated;

-- Point cost per action, in one place so the API-route mapping
-- (app/api/gemini/security.ts) and this file don't drift silently.
-- quiz=20 (~$0.013 raw), practice=6 (~$0.0034), learning_analysis=12
-- (~$0.011), game_cover=100 (~$0.067) - see the point-budget analysis this
-- migration implements for the per-action cost estimates.
create or replace function public.claim_teacher_ai_generation(p_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.teacher_ai_usage%rowtype;
  v_day date := (now() at time zone 'utc')::date;
  v_cost integer;
  v_existing boolean;
begin
  if v_user is null then return 'UNAUTHORIZED'; end if;
  v_cost := case p_kind
    when 'quiz' then 20
    when 'practice' then 6
    when 'learning_analysis' then 12
    else null
  end;
  if v_cost is null then return 'INVALID_KIND'; end if;

  select * into v_row from public.teacher_ai_usage
  where user_id = v_user and usage_day = v_day
  for update;
  v_existing := found;

  if v_existing then
    if v_row.last_attempt_at > now() - interval '3 seconds' then return 'COOLDOWN'; end if;
    if v_row.request_count >= 100 then return 'DAILY_LIMIT'; end if;
  end if;

  if public.deduct_ai_points(v_user, v_cost) is null then return 'INSUFFICIENT_POINTS'; end if;

  if v_existing then
    update public.teacher_ai_usage
      set request_count = request_count + 1, last_attempt_at = now()
      where user_id = v_user and usage_day = v_day;
  else
    insert into public.teacher_ai_usage(user_id, usage_day, request_count, last_attempt_at)
    values (v_user, v_day, 1, now());
  end if;
  return 'OK';
end;
$$;
revoke all on function public.claim_teacher_ai_generation(text) from public, anon;
grant execute on function public.claim_teacher_ai_generation(text) to authenticated;

create or replace function public.claim_game_cover_generation(p_request_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz := now();
  v_day date := (now() at time zone 'Asia/Taipei')::date;
  v_row public.game_cover_ai_usage%rowtype;
begin
  if v_user is null or p_request_id is null then raise exception 'UNAUTHORIZED'; end if;
  insert into public.game_cover_ai_usage(user_id, usage_day) values (v_user, v_day)
  on conflict (user_id) do nothing;
  select * into v_row from public.game_cover_ai_usage where user_id = v_user for update;
  if p_request_id = any(v_row.request_ids) then return 'DUPLICATE'; end if;
  if v_row.last_attempt > v_now - interval '60 seconds' then return 'COOLDOWN'; end if;
  if v_row.usage_day = v_day and v_row.attempts >= 5 then return 'DAILY_LIMIT'; end if;
  if public.deduct_ai_points(v_user, 100) is null then return 'INSUFFICIENT_POINTS'; end if;
  update public.game_cover_ai_usage set
    usage_day = v_day,
    attempts = case when usage_day = v_day then attempts + 1 else 1 end,
    request_ids = case when usage_day = v_day then array_append(request_ids, p_request_id) else array[p_request_id] end,
    last_attempt = v_now
  where user_id = v_user;
  return 'OK';
end;
$$;
revoke all on function public.claim_game_cover_generation(uuid) from public, anon;
grant execute on function public.claim_game_cover_generation(uuid) to authenticated;

commit;
