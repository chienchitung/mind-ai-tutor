-- Run once in Supabase SQL Editor after add_ai_quizzes.sql. Adds an opt-in
-- public share link per quiz plus an attempts log; existing private quizzes
-- and their RLS are unchanged (is_public defaults to false).
begin;

alter table public.ai_quizzes add column if not exists is_public boolean not null default false;

create table if not exists public.ai_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.ai_quizzes(id) on delete cascade,
  student_name text not null check (char_length(student_name) between 1 and 100),
  score integer not null check (score >= 0),
  total integer not null check (total > 0 and score <= total),
  submitted_at timestamptz not null default now()
);

create index if not exists ai_quiz_attempts_quiz_idx on public.ai_quiz_attempts (quiz_id, submitted_at desc);
alter table public.ai_quiz_attempts enable row level security;
-- No direct table grants to anon/authenticated: reads and writes only go
-- through the two SECURITY DEFINER functions below, so an anonymous quiz
-- taker can never list other attempts and only the owning teacher can read
-- their own quiz's attempts.
revoke all on public.ai_quiz_attempts from anon, authenticated;

drop policy if exists ai_quiz_attempts_owner_select on public.ai_quiz_attempts;
create policy ai_quiz_attempts_owner_select on public.ai_quiz_attempts for select to authenticated
  using (exists (select 1 from public.ai_quizzes q where q.id = quiz_id and q.user_id = (select auth.uid())));
grant select on public.ai_quiz_attempts to authenticated;

-- Public, answer-key-stripped view of a shared quiz. Returns no rows when the
-- quiz does not exist or is not currently shared.
create or replace function public.get_public_quiz(p_quiz_id uuid)
returns table (id uuid, title text, questions jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  return query
    select q.id, q.title,
      (select coalesce(jsonb_agg(jsonb_build_object(
         'id', item->>'id',
         'questionText', item->>'questionText',
         'options', item->'options',
         'questionType', item->>'questionType'
       )), '[]'::jsonb)
       from jsonb_array_elements(q.questions) as item) as questions
    from public.ai_quizzes q
    where q.id = p_quiz_id and q.is_public = true;
end;
$$;
revoke all on function public.get_public_quiz(uuid) from public;
grant execute on function public.get_public_quiz(uuid) to anon, authenticated;

-- Scores a public submission server-side against the real answer key (never
-- exposed to the caller) and records the attempt.
create or replace function public.submit_public_quiz_attempt(p_quiz_id uuid, p_student_name text, p_answers jsonb)
returns table (score integer, total integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := trim(p_student_name);
  v_questions jsonb;
  v_total integer;
  v_score integer := 0;
  v_item jsonb;
  v_correct jsonb;
  v_given jsonb;
begin
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 100 then
    raise exception 'INVALID_NAME';
  end if;

  select questions into v_questions from public.ai_quizzes where id = p_quiz_id and is_public = true;
  if v_questions is null then
    raise exception 'QUIZ_NOT_FOUND';
  end if;
  v_total := jsonb_array_length(v_questions);

  for v_item in select * from jsonb_array_elements(v_questions) loop
    v_correct := v_item -> 'correctAnswer';
    v_given := p_answers -> (v_item ->> 'id');
    if v_given is not null then
      if jsonb_typeof(v_correct) = 'array' then
        if jsonb_typeof(v_given) = 'array' and v_given @> v_correct and v_correct @> v_given then
          v_score := v_score + 1;
        end if;
      elsif jsonb_typeof(v_given) = 'string' and trim(v_given #>> '{}') = trim(v_correct #>> '{}') then
        v_score := v_score + 1;
      end if;
    end if;
  end loop;

  insert into public.ai_quiz_attempts (quiz_id, student_name, score, total)
  values (p_quiz_id, v_name, v_score, v_total);

  return query select v_score, v_total;
end;
$$;
revoke all on function public.submit_public_quiz_attempt(uuid, text, jsonb) from public;
grant execute on function public.submit_public_quiz_attempt(uuid, text, jsonb) to anon, authenticated;

commit;
