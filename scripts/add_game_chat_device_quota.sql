-- Daily anti-abuse cap for the Ellis AI tutor chat inside game-engine
-- (game-engine/src/app/api/chat/route.ts). Deliberately separate from the
-- teacher point ledger (scripts/add_teacher_ai_points.sql): students in
-- game-engine are never logged in (see saveLearningRecord et al. treating a
-- "student_ref_id" as optional, local-only unless a teacher-issued login
-- code links it), so there is no teacher account to charge, and charging
-- one anyway would let one enthusiastic class exhaust a teacher's whole
-- monthly grant mid-lesson. This table exists purely to stop a single
-- browser from hammering the endpoint - it is a rate limit, not a ledger.
--
-- Keyed by a client-generated random device id (localStorage, global - not
-- per game), the same anonymous-trust model already used for
-- student_ref_id elsewhere in this schema. Run once in the Supabase SQL
-- editor - same project game-engine already reads lessons/leaderboard data
-- from via its anon key.

begin;

create table if not exists public.game_chat_device_usage (
  device_id uuid not null,
  usage_day date not null,
  message_count integer not null default 0,
  last_message_at timestamptz not null default now(),
  primary key (device_id, usage_day)
);
alter table public.game_chat_device_usage enable row level security;
revoke all on public.game_chat_device_usage from public, anon, authenticated;

-- No auth.uid() check (there is none to check) - the device id is simply
-- trusted, exactly like p_student_ref_id elsewhere. A student clearing
-- localStorage resets their own count, which is an acceptable ceiling for
-- an anti-spam guard, not a security boundary.
create or replace function public.claim_game_chat_message(p_device_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'Asia/Taipei')::date;
  v_row public.game_chat_device_usage%rowtype;
begin
  if p_device_id is null then return 'INVALID_DEVICE'; end if;

  select * into v_row from public.game_chat_device_usage
  where device_id = p_device_id and usage_day = v_day
  for update;

  if found then
    if v_row.message_count >= 30 then return 'DAILY_LIMIT'; end if;
    update public.game_chat_device_usage
      set message_count = message_count + 1, last_message_at = now()
      where device_id = p_device_id and usage_day = v_day;
  else
    insert into public.game_chat_device_usage(device_id, usage_day, message_count, last_message_at)
    values (p_device_id, v_day, 1, now());
  end if;
  return 'OK';
end;
$$;
revoke all on function public.claim_game_chat_message(uuid) from public;
grant execute on function public.claim_game_chat_message(uuid) to anon, authenticated;

commit;
