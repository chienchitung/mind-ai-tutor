-- A countdown the teacher runs during a live class, shown on the projector
-- and on the students' pages. The teacher writes it through the owner-only
-- live_sessions update policy; joined-by-code pages read it through
-- get_live_timer, which returns nothing else about the session.
--
-- Shape: {"durationSeconds": int, "remainingSeconds": number,
--         "endsAt": timestamptz text | null}; running while endsAt is set.
-- null: no timer on screen.
begin;

alter table public.live_sessions add column if not exists timer jsonb;

create or replace function public.get_live_timer(p_code text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select s.timer from public.live_sessions s where s.join_code = p_code;
$$;

revoke all on function public.get_live_timer(text) from public;
grant execute on function public.get_live_timer(text) to anon, authenticated;

commit;
