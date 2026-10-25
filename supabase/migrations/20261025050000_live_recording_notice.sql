-- Lets the students' page (anonymous, joined by code) know the teacher is
-- recording, without exposing anything else about the recording.
--
-- A recording counts as active while its row says 'recording' and the
-- presenter's browser has touched it recently: the recorder saves its
-- progress every two minutes, so a tab that crashed or was closed without
-- pressing stop stops showing the notice within five minutes.
begin;

create or replace function public.is_live_session_recording(p_code text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.live_recordings r
    join public.live_sessions s on s.id = r.session_id
    where s.join_code = p_code
      and r.status = 'recording'
      and r.updated_at > now() - interval '5 minutes'
  );
$$;

revoke all on function public.is_live_session_recording(text) from public;
grant execute on function public.is_live_session_recording(text) to anon, authenticated;

commit;
