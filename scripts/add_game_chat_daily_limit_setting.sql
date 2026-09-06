-- Makes the Ellis AI tutor's per-device daily message cap (previously a
-- hardcoded 30 in claim_game_chat_message, see
-- scripts/add_game_chat_device_quota.sql) an admin-editable setting instead
-- of something that needs a code change to adjust.
--
-- Run once in the Supabase SQL editor, after add_game_chat_device_quota.sql.

begin;

-- Singleton config row (id is always true) - simpler than a generic
-- key/value settings table for the one number this currently holds.
create table if not exists public.game_chat_config (
  id boolean primary key default true,
  daily_limit integer not null default 30,
  updated_at timestamptz not null default now(),
  constraint game_chat_config_singleton check (id)
);
insert into public.game_chat_config (id, daily_limit) values (true, 30)
  on conflict (id) do nothing;
alter table public.game_chat_config enable row level security;
revoke all on public.game_chat_config from public, anon, authenticated;

-- Read-only lookup, callable by anyone (including anonymous game players)
-- since claim_game_chat_message and the admin settings UI both need it.
create or replace function public.get_game_chat_daily_limit()
returns integer
language sql stable security definer set search_path = '' as $$
  select daily_limit from public.game_chat_config where id = true;
$$;
revoke all on function public.get_game_chat_daily_limit() from public;
grant execute on function public.get_game_chat_daily_limit() to anon, authenticated;

-- Admin-only write path for the settings page (app/admin/page.tsx).
create or replace function public.set_game_chat_daily_limit(p_limit integer)
returns integer
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100000 then raise exception 'INVALID_LIMIT'; end if;
  update public.game_chat_config set daily_limit = p_limit, updated_at = now() where id = true;
  return p_limit;
end;
$$;
revoke all on function public.set_game_chat_daily_limit(integer) from public, anon;
grant execute on function public.set_game_chat_daily_limit(integer) to authenticated;

-- Same anti-abuse logic as before, just reading the cap from the config
-- table instead of a hardcoded literal.
create or replace function public.claim_game_chat_message(p_device_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'Asia/Taipei')::date;
  v_row public.game_chat_device_usage%rowtype;
  v_limit integer := public.get_game_chat_daily_limit();
begin
  if p_device_id is null then return 'INVALID_DEVICE'; end if;

  select * into v_row from public.game_chat_device_usage
  where device_id = p_device_id and usage_day = v_day
  for update;

  if found then
    if v_row.message_count >= v_limit then return 'DAILY_LIMIT'; end if;
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

commit;
