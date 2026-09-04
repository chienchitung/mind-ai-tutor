-- Adjustable Q&A display, preserving frozen question selection and owner checks.
begin;
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
    'overview',jsonb_build_object('pageSize',coalesce((s.presentation->>'pageSize')::int,4),'sort',coalesce(s.presentation->>'sort','popular'),
      'offset',coalesce((s.presentation->>'offset')::int,0),
      'total',(select count(*) from public.live_questions where session_id=s.id and visibility='public' and not answered),
      'newCount',(select count(*) from public.live_questions where session_id=s.id and visibility='public' and not answered and created_at > coalesce((s.presentation->>'refreshedAt')::timestamptz,now()))),
    'answeredIds',(select coalesce(jsonb_agg(id),'[]'::jsonb) from public.live_questions where session_id=s.id and visibility='public' and answered),
    'poll',case when p.id is null then null else jsonb_build_object('pollId',p.id,'question',p.question,'options',p.options,'phase',p.phase,
      'voteCounts',coalesce(counts,array[]::integer[]),'voteTotal',(select count(*) from public.live_poll_votes where poll_id=p.id)) end);
end; $$;
revoke all on function public.get_live_presentation(text) from public;
grant execute on function public.get_live_presentation(text) to anon,authenticated;

-- A single serialized owner command prevents a close/reveal racing a vote.
create or replace function public.control_live_presentation(p_session_id uuid, p_command jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.live_sessions%rowtype; p public.live_polls%rowtype; q public.live_questions%rowtype; ids jsonb; mode text; v_phase text; v_size int; v_sort text; v_offset int; v_total int; next_id uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  select * into s from public.live_sessions where id=p_session_id and user_id=auth.uid() for update;
  if s.id is null then raise exception 'NOT_FOUND'; end if;
  if s.status='closed' then raise exception 'SESSION_CLOSED'; end if;
  v_size := coalesce((p_command->>'pageSize')::int,(s.presentation->>'pageSize')::int,4);
  v_sort := coalesce(p_command->>'sort',s.presentation->>'sort','popular');
  if v_size not in (3,4,6) or v_sort not in ('popular','newest','oldest') then raise exception 'INVALID_COMMAND'; end if;
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
      select count(*) into v_total from public.live_questions where session_id=s.id and visibility='public' and not answered;
      v_offset := least(greatest(0,least(10000,coalesce((p_command->>'offset')::int,0))),greatest(0,((v_total-1)/v_size)*v_size));
      select coalesce(jsonb_agg(x.id),'[]'::jsonb) into ids from (select id from public.live_questions where session_id=s.id and visibility='public' and not answered order by case when v_sort='popular' then upvotes end desc, case when v_sort='newest' then created_at end desc, created_at,id limit v_size offset v_offset) x;
    end if;
    update public.live_sessions set presentation=s.presentation || jsonb_build_object('mode',mode,'questionIds',ids,'pageSize',v_size,'sort',v_sort) || case when mode='questions' then jsonb_build_object('offset',v_offset,'refreshedAt',now()) else '{}'::jsonb end,updated_at=now() where id=s.id;
  when 'phase' then
    select * into p from public.live_polls where id=s.active_poll_id and id=(p_command->>'pollId')::uuid and session_id=s.id for update;
    if p.id is null then raise exception 'POLL_NOT_ACTIVE'; end if;
    v_phase := p_command->>'phase';
    if not ((p.phase='draft' and v_phase='open') or (p.phase='open' and v_phase='closed') or (p.phase='closed' and v_phase in ('open','results')) or (p.phase='results' and v_phase='open')) then raise exception 'INVALID_TRANSITION'; end if;
    if v_phase is null then raise exception 'INVALID_TRANSITION'; end if;
    update public.live_polls set phase=v_phase where id=p.id;
    update public.live_sessions set presentation=s.presentation || '{"mode":"poll"}'::jsonb,updated_at=now() where id=s.id;
  when 'answer' then
    update public.live_questions set answered=coalesce((p_command->>'answered')::boolean,true) where id=(p_command->>'questionId')::uuid and session_id=s.id;
    if not found then raise exception 'NOT_FOUND'; end if;
    if coalesce((p_command->>'advance')::boolean,false) then
      if (p_command->>'answered')::boolean is distinct from true then raise exception 'INVALID_COMMAND'; end if;
      select id into next_id from public.live_questions where session_id=s.id and visibility='public' and not answered order by case when v_sort='popular' then upvotes end desc, case when v_sort='newest' then created_at end desc, created_at,id limit 1;
      update public.live_sessions set presentation=s.presentation || jsonb_build_object('mode','question','questionIds',case when next_id is null then '[]'::jsonb else jsonb_build_array(next_id) end),updated_at=now() where id=s.id;
    end if;
  else raise exception 'INVALID_COMMAND';
  end case;
  return public.get_live_presentation(s.join_code);
end; $$;
revoke all on function public.control_live_presentation(uuid,jsonb) from public,anon;
grant execute on function public.control_live_presentation(uuid,jsonb) to authenticated;

commit;
