-- Resolve a student's class assignment from their login code and the game.
-- A generic game URL is safe to auto-resolve only when exactly one active
-- assignment matches. Multiple matches are reported to the client instead of
-- guessing and attributing learning data to the wrong class.
create or replace function public.verify_student_game_login_code(
  p_code text,
  p_game_id uuid,
  p_assignment_id uuid default null
)
returns table (
  student_id uuid,
  student_name text,
  grade integer,
  classroom_name text,
  game_assignment_id uuid,
  assignment_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
  v_assignment_count integer := 0;
  v_assignment_id uuid;
  v_classroom_name text;
begin
  if char_length(btrim(p_code)) <> 8 or p_game_id is null then return; end if;

  select * into v_student
  from public.students s
  where s.login_code = upper(btrim(p_code))
  limit 1;

  if v_student.id is null then return; end if;

  select
    count(*)::integer,
    (array_agg(ga.id order by ga.assigned_at desc))[1],
    (array_agg(c.name order by ga.assigned_at desc))[1]
  into v_assignment_count, v_assignment_id, v_classroom_name
  from public.classroom_students cs
  join public.classrooms c
    on c.id = cs.classroom_id
   and c.user_id = cs.user_id
   and c.status = 'active'
  join public.game_assignments ga
    on ga.classroom_id = cs.classroom_id
   and ga.user_id = cs.user_id
   and ga.game_id = p_game_id
   and ga.status = 'active'
  where cs.student_id = v_student.id
    and cs.user_id = v_student.user_id
    and cs.left_at is null
    and (p_assignment_id is null or ga.id = p_assignment_id);

  -- A supplied assignment must match exactly. Generic links may continue as
  -- ungrouped when no class activity exists, but never guess among duplicates.
  if p_assignment_id is not null and v_assignment_count <> 1 then return; end if;
  if v_assignment_count <> 1 then
    v_assignment_id := null;
    v_classroom_name := null;
  end if;

  update public.students set last_login = now() where id = v_student.id;

  return query select
    v_student.id,
    v_student.name,
    v_student.grade,
    v_classroom_name,
    v_assignment_id,
    v_assignment_count;
end;
$$;

revoke all on function public.verify_student_game_login_code(text, uuid, uuid)
  from public, authenticated;
grant execute on function public.verify_student_game_login_code(text, uuid, uuid)
  to anon;
