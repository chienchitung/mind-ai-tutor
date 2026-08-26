-- scripts/fix_lessons_public_read.sql granted SELECT to `anon, authenticated`
-- in a single policy, using (true) for both - that made lessons fully
-- readable by anon (needed by excel-master-game) but ALSO by any
-- mind-ai-tutor login, not just the owner. Splitting it into two
-- separate per-role policies fixes this without touching
-- excel-master-game: anon still reads everything unconditionally,
-- authenticated is restricted back to the owner.
--
-- Run once in the Supabase SQL editor.

drop policy if exists lessons_select_public on public.lessons;

create policy lessons_select_anon
  on public.lessons for select to anon
  using (true);

drop policy if exists lessons_select_own on public.lessons;
create policy lessons_select_own
  on public.lessons for select to authenticated
  using (auth.uid() = user_id);
