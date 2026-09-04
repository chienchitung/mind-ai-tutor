-- Apply after scripts/add_live_sessions.sql and add_live_session_phase2.sql.
-- Additive: existing polls remain open; new UI polls explicitly start in draft.
begin;
alter table public.live_sessions add column if not exists presentation jsonb not null default '{"mode":"deck"}';
alter table public.live_polls add column if not exists phase text not null default 'open' check (phase in ('draft','open','closed','results'));
alter table public.live_questions add column if not exists answered boolean not null default false;

-- Code-scoped, deliberately public snapshot. Never includes private questions,
-- participant IDs, pulse data, or owner identifiers. IDs in stored presentation
-- are resolved afresh so subsequently hidden questions disappear immediately.
create or replace function public.get_live_presentation(p_code text)
returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare s public.live_sessions%rowtype; p public.live_polls%rowtype; qs jsonb; counts integer[];
begin
  select * into s from public.live_sessions where join_code = p_code;
  if s.id is null then return null; end if;
  select * into p from public.live_polls where id = s.active_poll_id and session_id = s.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'text',q.text,'upvotes',q.upvotes,'answered',q.answered) order by chosen.ord),'[]'::jsonb)
    into qs from jsonb_array_elements_text(coalesce(s.presentation->'questionIds','[]'::jsonb)) with ordinality chosen(id,ord)
    join public.live_questions q on q.id::text = chosen.id and q.session_id = s.id and q.visibility = 'public' and not q.answered;
  if p.id is not null and p.phase = 'results' then counts := public._live_poll_tally(p.id,jsonb_array_length(p.options)); end if;
  return jsonb_build_object('sessionId',s.id,'status',s.status,'title',s.title,'deckUrl',s.deck_url,'deckPage',s.deck_page,
    'mode',coalesce(s.presentation->>'mode','deck'),'questions',qs,
    'answeredIds',(select coalesce(jsonb_agg(id),'[]'::jsonb) from public.live_questions where session_id=s.id and visibility='public' and answered),
    'poll',case when p.id is null then null else jsonb_build_object('pollId',p.id,'question',p.question,'options',p.options,'phase',p.phase,
      'voteCounts',coalesce(counts,array[]::integer[]),'voteTotal',(select count(*) from public.live_poll_votes where poll_id=p.id)) end);
end; $$;
revoke all on function public.get_live_presentation(text) from public;
grant execute on function public.get_live_presentation(text) to anon,authenticated;

-- A single serialized owner command prevents a close/reveal racing a vote.
create or replace function public.control_live_presentation(p_session_id uuid, p_command jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.live_sessions%rowtype; p public.live_polls%rowtype; q public.live_questions%rowtype; ids jsonb; mode text; v_phase text;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  select * into s from public.live_sessions where id=p_session_id and user_id=auth.uid() for update;
  if s.id is null then raise exception 'NOT_FOUND'; end if;
  if s.status='closed' then raise exception 'SESSION_CLOSED'; end if;
  case p_command->>'action'
  when 'show' then
    mode := p_command->>'mode';
    if mode is null or mode not in ('deck','blank','poll','questions','question') then raise exception 'INVALID_COMMAND'; end if;
    if mode='poll' and s.active_poll_id is null then raise exception 'POLL_NOT_FOUND'; end if;
    ids := '[]'::jsonb;
    if mode='question' then
      select * into q from public.live_questions where id=(p_command->>'questionId')::uuid and session_id=s.id and visibility='public' and not answered;
      if q.id is null then raise exception 'QUESTION_NOT_PUBLIC'; end if;
      ids := jsonb_build_array(q.id);
    elsif mode='questions' then
      select coalesce(jsonb_agg(x.id),'[]'::jsonb) into ids from (select id from public.live_questions where session_id=s.id and visibility='public' and not answered order by upvotes desc,created_at,id limit 3 offset greatest(0,least(10000,coalesce((p_command->>'offset')::integer,0)))) x;
    end if;
    update public.live_sessions set presentation=jsonb_build_object('mode',mode,'questionIds',ids),updated_at=now() where id=s.id;
  when 'phase' then
    select * into p from public.live_polls where id=s.active_poll_id and id=(p_command->>'pollId')::uuid and session_id=s.id for update;
    if p.id is null then raise exception 'POLL_NOT_ACTIVE'; end if;
    v_phase := p_command->>'phase';
    if not ((p.phase='draft' and v_phase='open') or (p.phase='open' and v_phase='closed') or (p.phase='closed' and v_phase in ('open','results')) or (p.phase='results' and v_phase='open')) then raise exception 'INVALID_TRANSITION'; end if;
    if v_phase is null then raise exception 'INVALID_TRANSITION'; end if;
    update public.live_polls set phase=v_phase where id=p.id;
    update public.live_sessions set presentation='{"mode":"poll"}'::jsonb,updated_at=now() where id=s.id;
  when 'answer' then
    update public.live_questions set answered=coalesce((p_command->>'answered')::boolean,true) where id=(p_command->>'questionId')::uuid and session_id=s.id;
    if not found then raise exception 'NOT_FOUND'; end if;
  else raise exception 'INVALID_COMMAND';
  end case;
  return public.get_live_presentation(s.join_code);
end; $$;
revoke all on function public.control_live_presentation(uuid,jsonb) from public,anon;
grant execute on function public.control_live_presentation(uuid,jsonb) to authenticated;

-- Existing RPC remains the only write path; the trigger guards it as well as
-- future insert/upsert callers. Locks session first, matching owner commands.
create or replace function public.guard_live_poll_phase()
returns trigger language plpgsql security definer set search_path = '' as $$
declare sid uuid; s public.live_sessions%rowtype; phase text;
begin
  select session_id into sid from public.live_polls where id=new.poll_id;
  select * into s from public.live_sessions where id=sid for update;
  if s.status is distinct from 'open' then raise exception 'SESSION_NOT_OPEN'; end if;
  if s.active_poll_id is distinct from new.poll_id then raise exception 'POLL_NOT_ACTIVE'; end if;
  select p.phase into phase from public.live_polls p where id=new.poll_id;
  if phase is distinct from 'open' then raise exception 'POLL_NOT_OPEN'; end if;
  return new;
end; $$;
revoke all on function public.guard_live_poll_phase() from public,anon,authenticated;
drop trigger if exists live_poll_phase_guard on public.live_poll_votes;
create trigger live_poll_phase_guard before insert or update on public.live_poll_votes for each row execute function public.guard_live_poll_phase();
commit;
