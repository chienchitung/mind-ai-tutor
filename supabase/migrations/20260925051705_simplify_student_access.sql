-- Let teachers identify account-free students with an existing school or
-- research identifier. The activity URL supplies the classroom context, so
-- teachers share one link with the whole class instead of distributing a
-- different generated code to every student.
begin;

alter table public.students
  add column if not exists external_id text;

alter table public.students
  alter column email drop not null;

alter table public.students
  drop constraint if exists students_external_id_length;
alter table public.students
  add constraint students_external_id_length
  check (external_id is null or char_length(btrim(external_id)) between 1 and 64);

create unique index if not exists students_user_external_id_key
  on public.students (user_id, upper(btrim(external_id)))
  where external_id is not null;

-- CREATE OR REPLACE cannot change a function's result columns, so replace the
-- RPC atomically inside this transaction. SECURITY DEFINER is required because
-- signed-out learners cannot read the protected roster table directly.
drop function if exists public.verify_student_game_login_code(text, uuid, uuid);

create function public.verify_student_game_login_code(
  p_code text,
  p_game_id uuid,
  p_assignment_id uuid default null
)
returns table (
  student_id uuid,
  student_name text,
  student_display_name text,
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
  v_identifier text := upper(btrim(p_code));
begin
  if v_identifier = '' or char_length(v_identifier) > 64 or p_game_id is null then return; end if;

  if p_assignment_id is not null then
    -- A school/research identifier is only accepted inside an exact active
    -- class activity. The assignment UUID is the classroom-scoping secret;
    -- generic game URLs continue to require the teacher-issued fallback code.
    select s.* into v_student
    from public.game_assignments ga
    join public.classrooms c
      on c.id = ga.classroom_id
     and c.user_id = ga.user_id
     and c.status = 'active'
    join public.classroom_students cs
      on cs.classroom_id = ga.classroom_id
     and cs.user_id = ga.user_id
     and cs.left_at is null
    join public.students s
      on s.id = cs.student_id
     and s.user_id = cs.user_id
     and s.status = 'active'
    where ga.id = p_assignment_id
      and ga.game_id = p_game_id
      and ga.status = 'active'
      and (
        upper(btrim(s.external_id)) = v_identifier
        or s.login_code = v_identifier
      )
    limit 1;
  else
    select s.* into v_student
    from public.students s
    where s.login_code = v_identifier
      and char_length(v_identifier) = 8
      and s.status = 'active'
    limit 1;
  end if;

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

  if p_assignment_id is not null and v_assignment_count <> 1 then return; end if;
  if v_assignment_count <> 1 then
    v_assignment_id := null;
    v_classroom_name := null;
  end if;

  update public.students set last_login = now() where id = v_student.id;

  return query select
    v_student.id,
    case
      when char_length(v_student.name) <= 1 then v_student.name
      else left(v_student.name, 1) || repeat('○', char_length(v_student.name) - 1)
    end,
    case
      when char_length(v_student.name) <= 1 then v_student.name
      else left(v_student.name, 1) || repeat('○', char_length(v_student.name) - 1)
    end,
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

commit;
