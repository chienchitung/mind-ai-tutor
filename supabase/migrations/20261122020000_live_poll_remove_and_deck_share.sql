-- 1) A teacher can remove the session's current poll: it is deleted with its
--    votes, students stop seeing it, and a projected poll goes back to the
--    slides. Earlier (non-active) polls are untouched.
-- 2) Whether students may still open the slides once the class has ended.
--    Off by default; the teacher chooses when ending the class.
begin;

alter table public.live_sessions add column if not exists share_deck_after_close boolean not null default false;

create or replace function public.remove_live_poll(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll_id uuid;
begin
  select s.active_poll_id into v_poll_id
  from public.live_sessions s
  where s.id = p_session_id and s.user_id = auth.uid()
  for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  if v_poll_id is null then return; end if;

  -- live_sessions.active_poll_id is ON DELETE SET NULL; votes cascade.
  delete from public.live_polls p where p.id = v_poll_id and p.session_id = p_session_id;
  update public.live_sessions s
    set presentation = jsonb_build_object('mode', 'deck'), updated_at = now()
    where s.id = p_session_id and s.presentation->>'mode' = 'poll';
end;
$$;

revoke all on function public.remove_live_poll(uuid) from public, anon;
grant execute on function public.remove_live_poll(uuid) to authenticated;

-- Joined-by-code pages are anonymous and cannot read live_sessions, so the
-- setting is exposed on its own, like is_live_session_recording.
create or replace function public.live_session_shares_deck(p_code text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce((select s.share_deck_after_close from public.live_sessions s where s.join_code = p_code), false);
$$;

revoke all on function public.live_session_shares_deck(text) from public;
grant execute on function public.live_session_shares_deck(text) to anon, authenticated;

commit;
