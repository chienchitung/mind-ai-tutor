-- First-class classroom cohorts and assignment-scoped game analytics.
-- Existing game records remain valid with a NULL game_assignment_id and are
-- intentionally not guessed into a classroom.
begin;

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  academic_year text,
  term text,
  description text,
  study_label text,
  study_arm text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

-- These composite keys make it impossible to attach another teacher's
-- student or game to a classroom even if a client submits a forged UUID.
create unique index if not exists students_id_user_id_key
  on public.students (id, user_id);
create unique index if not exists digital_games_id_user_id_key
  on public.digital_games (id, user_id);

create table public.classroom_students (
  classroom_id uuid not null,
  student_id uuid not null,
  user_id uuid not null default auth.uid(),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (classroom_id, student_id),
  foreign key (classroom_id, user_id)
    references public.classrooms(id, user_id) on delete cascade,
  foreign key (student_id, user_id)
    references public.students(id, user_id) on delete cascade,
  check (left_at is null or left_at >= joined_at)
);

create table public.game_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  classroom_id uuid not null,
  game_id uuid not null,
  title text,
  status text not null default 'active' check (status in ('draft', 'active', 'closed', 'archived')),
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (classroom_id, user_id)
    references public.classrooms(id, user_id) on delete cascade,
  foreign key (game_id, user_id)
    references public.digital_games(id, user_id) on delete cascade,
  check (due_at is null or due_at >= assigned_at)
);

create index classroom_students_user_class_idx
  on public.classroom_students (user_id, classroom_id);
create index classroom_students_student_idx
  on public.classroom_students (student_id);
create index game_assignments_user_class_idx
  on public.game_assignments (user_id, classroom_id, status);
create index game_assignments_game_idx
  on public.game_assignments (game_id);

alter table public.learning_records
  add column if not exists game_assignment_id uuid references public.game_assignments(id) on delete set null;
alter table public.leaderboard
  add column if not exists game_assignment_id uuid references public.game_assignments(id) on delete set null;
alter table public.chat_messages
  add column if not exists game_assignment_id uuid references public.game_assignments(id) on delete set null;
alter table public.question_counts
  add column if not exists game_assignment_id uuid references public.game_assignments(id) on delete set null;

create index if not exists learning_records_assignment_idx
  on public.learning_records (game_assignment_id, student_ref_id);
create index if not exists leaderboard_assignment_idx
  on public.leaderboard (game_assignment_id, student_ref_id);
create index if not exists chat_messages_assignment_idx
  on public.chat_messages (game_assignment_id, student_ref_id);
create index if not exists question_counts_assignment_idx
  on public.question_counts (game_assignment_id, student_ref_id);

alter table public.classrooms enable row level security;
alter table public.classroom_students enable row level security;
alter table public.game_assignments enable row level security;

revoke all on table public.classrooms, public.classroom_students, public.game_assignments
  from anon, authenticated;
grant select, insert, update, delete on table
  public.classrooms, public.classroom_students, public.game_assignments
  to authenticated;

create policy classrooms_select_own on public.classrooms for select to authenticated
  using ((select auth.uid()) = user_id);
create policy classrooms_insert_own on public.classrooms for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy classrooms_update_own on public.classrooms for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy classrooms_delete_own on public.classrooms for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy classroom_students_select_own on public.classroom_students for select to authenticated
  using ((select auth.uid()) = user_id);
create policy classroom_students_insert_own on public.classroom_students for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy classroom_students_update_own on public.classroom_students for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy classroom_students_delete_own on public.classroom_students for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy game_assignments_select_own on public.game_assignments for select to authenticated
  using ((select auth.uid()) = user_id);
create policy game_assignments_insert_own on public.game_assignments for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy game_assignments_update_own on public.game_assignments for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy game_assignments_delete_own on public.game_assignments for delete to authenticated
  using ((select auth.uid()) = user_id);

-- A class-specific login only succeeds when the code belongs to an active
-- member of the assignment's classroom. No roster rows are exposed.
create or replace function public.verify_student_assignment_login_code(
  p_code text,
  p_assignment_id uuid,
  p_game_id uuid
)
returns table (student_id uuid, student_name text, grade int, classroom_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(btrim(p_code)) <> 8 then return; end if;

  return query
  update public.students as student
  set last_login = now()
  from public.game_assignments ga
  join public.classrooms c on c.id = ga.classroom_id
  join public.classroom_students cs
    on cs.classroom_id = ga.classroom_id and cs.user_id = ga.user_id
  where ga.id = p_assignment_id
    and ga.game_id = p_game_id
    and ga.status = 'active'
    and student.id = cs.student_id
    and student.login_code = upper(btrim(p_code))
    and student.user_id = ga.user_id
    and cs.left_at is null
  returning student.id, student.name, student.grade, c.name;
end;
$$;
revoke all on function public.verify_student_assignment_login_code(text, uuid, uuid)
  from public, authenticated;
grant execute on function public.verify_student_assignment_login_code(text, uuid, uuid)
  to anon;

-- Keep assignment context honest on anonymous game writes. The trigger may
-- read protected roster tables but exposes no data and is not directly callable.
create or replace function public.validate_game_assignment_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_classroom_id uuid;
begin
  if new.game_assignment_id is null then return new; end if;

  select ga.classroom_id into v_classroom_id
  from public.game_assignments ga
  where ga.id = new.game_assignment_id
    and ga.game_id = new.game_id
    and ga.status = 'active';

  if v_classroom_id is null then raise exception 'INVALID_GAME_ASSIGNMENT'; end if;
  if new.student_ref_id is null or not exists (
    select 1 from public.classroom_students cs
    where cs.classroom_id = v_classroom_id
      and cs.student_id = new.student_ref_id
      and cs.left_at is null
  ) then
    raise exception 'STUDENT_NOT_IN_CLASSROOM';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_game_assignment_context() from public, anon, authenticated;

create trigger learning_records_validate_assignment
  before insert or update of game_assignment_id, game_id, student_ref_id on public.learning_records
  for each row execute function public.validate_game_assignment_context();
create trigger leaderboard_validate_assignment
  before insert or update of game_assignment_id, game_id, student_ref_id on public.leaderboard
  for each row execute function public.validate_game_assignment_context();
create trigger chat_messages_validate_assignment
  before insert or update of game_assignment_id, game_id, student_ref_id on public.chat_messages
  for each row execute function public.validate_game_assignment_context();
create trigger question_counts_validate_assignment
  before insert or update of game_assignment_id, game_id, student_ref_id on public.question_counts
  for each row execute function public.validate_game_assignment_context();

-- Assignment-scoped leaderboard prevents two classes using the same game from
-- seeing each other's rankings. NULL keeps legacy game links working.
create or replace function public.get_public_assignment_leaderboard(
  p_game_id uuid,
  p_game_assignment_id uuid default null
)
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
    where l.game_id = p_game_id
      and (
        (p_game_assignment_id is null and l.game_assignment_id is null)
        or l.game_assignment_id = p_game_assignment_id
      )
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
  from best order by completion_time_seconds asc;
$$;
revoke all on function public.get_public_assignment_leaderboard(uuid, uuid) from public;
grant execute on function public.get_public_assignment_leaderboard(uuid, uuid) to anon, authenticated;

create or replace function public.get_assignment_player_rank(
  p_student_ref_id uuid,
  p_game_id uuid,
  p_game_assignment_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with best as (
    select l.student_ref_id, min(l.completion_time_seconds) as completion_time_seconds
    from public.leaderboard l
    where l.student_ref_id is not null
      and l.game_id = p_game_id
      and (
        (p_game_assignment_id is null and l.game_assignment_id is null)
        or l.game_assignment_id = p_game_assignment_id
      )
    group by l.student_ref_id
  ), ranked as (
    select student_ref_id,
      row_number() over (order by completion_time_seconds asc)::integer as rank
    from best
  )
  select rank from ranked where student_ref_id = p_student_ref_id;
$$;
revoke all on function public.get_assignment_player_rank(uuid, uuid, uuid) from public;
grant execute on function public.get_assignment_player_rank(uuid, uuid, uuid) to anon, authenticated;

create or replace function public.get_latest_assignment_learning_record_id(
  p_student_ref_id uuid,
  p_lesson_id text,
  p_game_id uuid,
  p_game_assignment_id uuid default null
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
    and lr.game_id = p_game_id
    and (
      (p_game_assignment_id is null and lr.game_assignment_id is null)
      or lr.game_assignment_id = p_game_assignment_id
    )
  order by lr.completed_at desc
  limit 1;
$$;
revoke all on function public.get_latest_assignment_learning_record_id(uuid, text, uuid, uuid) from public;
grant execute on function public.get_latest_assignment_learning_record_id(uuid, text, uuid, uuid) to anon, authenticated;

-- Question counts inherit the assignment from the validated learning record.
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
    question_count, game_id, game_assignment_id, updated_at
  ) values (
    gen_random_uuid(), v_record.id, v_record.student_id, v_record.student_ref_id,
    v_record.lesson_id, p_increment, v_record.game_id, v_record.game_assignment_id, now()
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

commit;
