-- Run once in Supabase SQL Editor. Does not modify courses or existing covers.
-- Counts attempts (including provider errors/timeouts); no automatic refunds/retries.
begin;
create table if not exists public.game_cover_ai_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  usage_day date not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  last_attempt timestamptz,
  request_ids uuid[] not null default '{}'
);
alter table public.game_cover_ai_usage enable row level security;
revoke all on public.game_cover_ai_usage from anon, authenticated;

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
