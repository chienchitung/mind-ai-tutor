-- URGENT correction to scripts/add_owner_scoping_lessons_feedback.sql:
-- that migration restricted lessons SELECT to the owning teacher only,
-- but excel-master-game (a separate, unauthenticated Next.js app - see
-- https://github.com/chienchitung/excel-master-game/blob/main/src/lib/supabase.ts
-- and src/app/lessons/[id]/page.tsx) reads lessons.genially_link,
-- lessons.markdown_content, and lessons.practice_exercises via the anon
-- key with no login at all, to render lesson content for students
-- playing the game. The owner-only SELECT policy would have blocked
-- every one of those reads (RLS denies unmatched roles by default),
-- breaking lesson content loading in the live game.
--
-- Run this once in the Supabase SQL editor. Safe to run whether or not
-- you already ran add_owner_scoping_lessons_feedback.sql.

drop policy if exists lessons_select_own on public.lessons;

-- Reading lesson content stays public (needed by the game); only
-- writing is restricted to the owning teacher.
create policy lessons_select_public
  on public.lessons for select to anon, authenticated
  using (true);
