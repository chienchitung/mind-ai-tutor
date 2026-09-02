-- Keep anonymous play local, require a teacher-linked roster identity for new
-- cloud records, and expose only masked/aggregate leaderboard data.

create or replace function public._validate_game_student_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.student_ref_id is null
     or new.student_id <> new.student_ref_id::text
     or not exists (
       select 1 from public.students s
       where s.id = new.student_ref_id and s.name = new.student_name
     ) then
    raise exception 'INVALID_STUDENT_IDENTITY';
  end if;
  return new;
end;
$$;
revoke all on function public._validate_game_student_record() from public, anon, authenticated;

drop trigger if exists validate_learning_record_student on public.learning_records;
create trigger validate_learning_record_student
before insert or update on public.learning_records
for each row execute function public._validate_game_student_record();

drop trigger if exists validate_leaderboard_student on public.leaderboard;
create trigger validate_leaderboard_student
before insert or update on public.leaderboard
for each row execute function public._validate_game_student_record();

create or replace function public._validate_game_child_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.student_ref_id is null
     or new.student_id <> new.student_ref_id::text
     or not exists (
       select 1 from public.learning_records lr
       where lr.id = new.learning_record_id
         and lr.student_ref_id = new.student_ref_id
         and lr.student_id = new.student_id
         and lr.lesson_id = new.lesson_id
     ) then
    raise exception 'INVALID_LEARNING_RECORD';
  end if;
  return new;
end;
$$;
revoke all on function public._validate_game_child_record() from public, anon, authenticated;

drop trigger if exists validate_chat_message_student on public.chat_messages;
create trigger validate_chat_message_student
before insert or update on public.chat_messages
for each row execute function public._validate_game_child_record();

drop policy if exists learning_records_select_public on public.learning_records;
drop policy if exists leaderboard_select_public on public.leaderboard;
drop policy if exists chat_messages_select_public on public.chat_messages;
drop policy if exists question_counts_select_public on public.question_counts;
drop policy if exists question_counts_update_public on public.question_counts;

drop policy if exists learning_records_insert_public on public.learning_records;
create policy learning_records_insert_linked_student
on public.learning_records for insert to anon, authenticated
with check (student_ref_id is not null and student_id = student_ref_id::text);

drop policy if exists leaderboard_insert_public on public.leaderboard;
create policy leaderboard_insert_linked_student
on public.leaderboard for insert to anon, authenticated
with check (student_ref_id is not null and student_id = student_ref_id::text);

drop policy if exists chat_messages_insert_public on public.chat_messages;
create policy chat_messages_insert_linked_student
on public.chat_messages for insert to anon, authenticated
with check (
  student_ref_id is not null
  and student_id = student_ref_id::text
  and char_length(message_content) between 1 and 10000
);

drop policy if exists question_counts_insert_public on public.question_counts;

create or replace function public.get_public_game_leaderboard(p_game_id uuid default null)
returns table (
  student_id text,
  student_name text,
  completion_time_seconds integer,
  completion_time_string text,
  game_id uuid,
  rank bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with best as (
    select distinct on (coalesce(l.student_ref_id::text, l.student_id))
      l.student_id, l.student_name, l.completion_time_seconds,
      l.completion_time_string, l.game_id
    from public.leaderboard l
    where (p_game_id is null and l.game_id is null) or l.game_id = p_game_id
    order by coalesce(l.student_ref_id::text, l.student_id), l.completion_time_seconds asc
  )
  select
    case
      when char_length(student_id) >= 8 then left(student_id, 2) || '****' || right(student_id, 2)
      when char_length(student_id) > 4 then left(student_id, 1) || '****' || right(student_id, 1)
      else '****'
    end,
    case
      when char_length(student_name) >= 3 then left(student_name, 1) || '○' || right(student_name, 1)
      when char_length(student_name) = 2 then left(student_name, 1) || '○'
      else '○'
    end,
    completion_time_seconds,
    completion_time_string,
    game_id,
    row_number() over (order by completion_time_seconds asc)
  from best
  order by completion_time_seconds asc;
$$;
revoke all on function public.get_public_game_leaderboard(uuid) from public;
grant execute on function public.get_public_game_leaderboard(uuid) to anon, authenticated;

create or replace function public.get_game_player_rank(
  p_student_ref_id uuid,
  p_game_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with best as (
    select l.student_ref_id,
      min(l.completion_time_seconds) as completion_time_seconds
    from public.leaderboard l
    where l.student_ref_id is not null
      and ((p_game_id is null and l.game_id is null) or l.game_id = p_game_id)
    group by l.student_ref_id
  ), ranked as (
    select student_ref_id,
      row_number() over (order by completion_time_seconds asc)::integer as rank
    from best
  )
  select rank from ranked where student_ref_id = p_student_ref_id;
$$;
revoke all on function public.get_game_player_rank(uuid, uuid) from public;
grant execute on function public.get_game_player_rank(uuid, uuid) to anon, authenticated;

create or replace function public.get_latest_learning_record_id(
  p_student_ref_id uuid,
  p_lesson_id text,
  p_game_id uuid default null
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select lr.id
  from public.learning_records lr
  where lr.student_ref_id = p_student_ref_id
    and lr.student_id = p_student_ref_id::text
    and lr.lesson_id = p_lesson_id
    and ((p_game_id is null and lr.game_id is null) or lr.game_id = p_game_id)
  order by lr.completed_at desc
  limit 1;
$$;
revoke all on function public.get_latest_learning_record_id(uuid, text, uuid) from public;
grant execute on function public.get_latest_learning_record_id(uuid, text, uuid) to anon, authenticated;

create or replace function public.increment_game_question_count(
  p_learning_record_id uuid,
  p_student_ref_id uuid,
  p_increment integer default 1
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.learning_records%rowtype;
  v_count integer;
begin
  if p_increment < 1 or p_increment > 20 then raise exception 'INVALID_INCREMENT'; end if;
  select * into v_record from public.learning_records
  where id = p_learning_record_id and student_ref_id = p_student_ref_id;
  if v_record.id is null then raise exception 'FORBIDDEN'; end if;

  insert into public.question_counts (
    id, learning_record_id, student_id, student_ref_id, lesson_id,
    question_count, game_id, updated_at
  ) values (
    gen_random_uuid(), v_record.id, v_record.student_id, v_record.student_ref_id,
    v_record.lesson_id, p_increment, v_record.game_id, now()
  )
  on conflict (learning_record_id) do update
    set question_count = public.question_counts.question_count + excluded.question_count,
        updated_at = now()
  returning question_count into v_count;
  return v_count;
end;
$$;
revoke all on function public.increment_game_question_count(uuid, uuid, integer) from public;
grant execute on function public.increment_game_question_count(uuid, uuid, integer) to anon, authenticated;

-- Owner-only/internal helpers should never appear in the anonymous REST API.
revoke execute on function public._live_poll_tally(uuid, integer) from anon, authenticated;
revoke execute on function public.get_live_questions_for_owner(uuid) from anon;
revoke execute on function public.moderate_live_question(uuid, text) from anon;
revoke execute on function public.is_admin() from anon;

alter function public.resolve_game_id_for_lesson(text) set search_path = '';
alter function public.set_game_id_from_lesson() set search_path = '';
alter function public.update_updated_at_column() set search_path = '';
