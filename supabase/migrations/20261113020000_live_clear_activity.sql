-- Lets a teacher wipe their own session's Q&A and/or difficulty feedback
-- mid-class (e.g. before the next class reuses the same session), without
-- deleting the session itself. Question votes go with their questions
-- (on delete cascade). If a question slide is on screen, the projection goes
-- back to the deck so it is never left showing an empty question view.
begin;

create or replace function public.clear_live_session_activity(p_session_id uuid, p_questions boolean, p_pulse boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.live_sessions s where s.id = p_session_id and s.user_id = auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;
  if coalesce(p_questions, false) then
    delete from public.live_questions q where q.session_id = p_session_id;
    update public.live_sessions s
      set presentation = jsonb_build_object('mode', 'deck'), updated_at = now()
      where s.id = p_session_id and s.presentation->>'mode' in ('question', 'questions');
  end if;
  if coalesce(p_pulse, false) then
    delete from public.live_pulse p where p.session_id = p_session_id;
  end if;
end;
$$;

revoke all on function public.clear_live_session_activity(uuid, boolean, boolean) from public, anon;
grant execute on function public.clear_live_session_activity(uuid, boolean, boolean) to authenticated;

commit;
