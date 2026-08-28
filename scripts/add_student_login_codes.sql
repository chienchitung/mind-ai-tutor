-- Student login-code architecture (teacher-provisioned, code-based linking)
--
-- Lets a student optionally link their anonymous game play to their real
-- students.id row via a short code the teacher generates and hands out.
-- Anonymous play (just typing 學號/姓名) keeps working exactly as before -
-- this is purely additive. Historical anonymous records are NOT
-- retroactively linked; only future writes made after a code is verified
-- carry student_ref_id.
--
-- Safe to re-run: every statement is idempotent.

-- 1. Teacher-provisioned login code on the real student roster.
--    Multiple NULLs are allowed by a UNIQUE constraint in Postgres, so
--    students who were never issued a code are unaffected.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS login_code text UNIQUE;

-- 2. Ensure game_id / student_ref_id exist on all 4 anonymous game tables.
--    (game_id was added in an earlier migration; student_ref_id is new.
--    Both are re-stated here idempotently in case this is the first time
--    running against a given environment.)
ALTER TABLE public.learning_records
  ADD COLUMN IF NOT EXISTS game_id uuid REFERENCES public.digital_games(id),
  ADD COLUMN IF NOT EXISTS student_ref_id uuid REFERENCES public.students(id);

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS game_id uuid REFERENCES public.digital_games(id),
  ADD COLUMN IF NOT EXISTS student_ref_id uuid REFERENCES public.students(id);

ALTER TABLE public.question_counts
  ADD COLUMN IF NOT EXISTS game_id uuid REFERENCES public.digital_games(id),
  ADD COLUMN IF NOT EXISTS student_ref_id uuid REFERENCES public.students(id);

ALTER TABLE public.leaderboard
  ADD COLUMN IF NOT EXISTS game_id uuid REFERENCES public.digital_games(id),
  ADD COLUMN IF NOT EXISTS student_ref_id uuid REFERENCES public.students(id);

-- 3. SECURITY DEFINER RPC to verify a login code.
--    game-engine has zero auth session (anon key only) and RLS on
--    `students` only allows the owning teacher to read their own rows -
--    so a plain `select * from students where login_code = ...` from the
--    game would return nothing. This function runs with elevated
--    privileges internally, but only ever returns the single matching
--    student's id/name/grade for an exact code match - never the roster.
--    It also stamps last_login as a side effect of a successful check-in.
CREATE OR REPLACE FUNCTION public.verify_student_login_code(p_code text)
RETURNS TABLE (student_id uuid, student_name text, grade int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.students
  SET last_login = now()
  WHERE login_code = upper(trim(p_code))
  RETURNING id, name, grade;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_student_login_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_student_login_code(text) TO anon, authenticated;

-- 4. Verification queries (run after the above):
--    select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'students' and column_name = 'login_code';
--
--    select routine_name, security_type from information_schema.routines
--    where routine_schema = 'public' and routine_name = 'verify_student_login_code';
