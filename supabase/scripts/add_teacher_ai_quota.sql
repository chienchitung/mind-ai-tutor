create table if not exists public.teacher_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null default (now() at time zone 'utc')::date,
  request_count integer not null default 0,
  last_attempt_at timestamptz not null default now(),
  primary key (user_id, usage_day)
);
alter table public.teacher_ai_usage enable row level security;
revoke all on table public.teacher_ai_usage from public, anon, authenticated;

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
begin
  if v_user is null then return 'UNAUTHORIZED'; end if;
  if p_kind not in ('quiz', 'practice', 'learning_analysis') then return 'INVALID_KIND'; end if;

  select * into v_row from public.teacher_ai_usage
  where user_id = v_user and usage_day = v_day
  for update;

  if found then
    if v_row.last_attempt_at > now() - interval '3 seconds' then return 'COOLDOWN'; end if;
    if v_row.request_count >= 100 then return 'DAILY_LIMIT'; end if;
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
