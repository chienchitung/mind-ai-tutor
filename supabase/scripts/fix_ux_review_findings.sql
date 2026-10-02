-- Follow-up for the 2026-09 UX verification.
-- Safe to re-run: function replacement and targeted content correction are idempotent.

-- The game is intentionally unauthenticated. This narrowly scoped definer
-- function is its only roster lookup: exact eight-character code, one unique
-- student, three returned fields, and no result for an unknown code.
CREATE OR REPLACE FUNCTION public.verify_student_login_code(p_code text)
RETURNS TABLE (student_id uuid, student_name text, grade int)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.students AS student
  SET last_login = now()
  WHERE student.login_code = upper(btrim(p_code))
    AND char_length(btrim(p_code)) = 8
  RETURNING student.id, student.name, student.grade;
$$;

REVOKE ALL ON FUNCTION public.verify_student_login_code(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_student_login_code(text) TO anon;

-- Correct the known published lesson drift without replacing the teacher's
-- other content. New edits are also checked by the lesson editor warning.
UPDATE public.lessons
SET practice_exercises = CASE jsonb_typeof(practice_exercises)
  -- Some legacy lessons store the JSON array as a JSON string. Preserve that
  -- representation so old clients keep working while correcting its content.
  WHEN 'string' THEN to_jsonb(replace(
    practice_exercises #>> '{}',
    'iPhone 14的銷售量',
    'iPhone 16的銷售量'
  ))
  ELSE jsonb_set(
    practice_exercises,
    '{0,explanation}',
    to_jsonb(replace(
      practice_exercises #>> '{0,explanation}',
      'iPhone 14的銷售量',
      'iPhone 16的銷售量'
    )),
    false
  )
END
WHERE id = 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c'
  AND practice_exercises::text LIKE '%iPhone 14的銷售量%';
