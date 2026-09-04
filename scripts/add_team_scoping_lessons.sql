-- Extends team-based RLS (see docs/team-workspace-design.md and the
-- add_team_scoping_events.sql pilot) to `lessons`. Requires
-- scripts/add_team_workspaces.sql to already be run.
--
-- team_id stays nullable and defaults to whatever team the inserting
-- user currently belongs to (null if they're not in one), via
-- public.current_team_id() - so no application code needs to change to
-- start writing team_id. A lesson with team_id null keeps behaving
-- exactly like before (visible only to its own user_id); a lesson with
-- team_id set is visible to every member of that team, not just its
-- creator.
--
-- lessons_select_anon (scripts/fix_lessons_split_anon_authenticated.sql)
-- is deliberately left untouched below: it grants unconditional read to
-- the `anon` role for game-engine to load lesson/markdown_content for
-- students playing a game, and has nothing to do with owner/team
-- scoping - only lessons_select_own (the `authenticated` role policy)
-- gets swapped to the team-aware version here.
--
-- Run once in the Supabase SQL editor, after add_team_workspaces.sql.

begin;

alter table public.lessons add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.lessons alter column team_id set default public.current_team_id();

drop policy if exists lessons_select_own on public.lessons;
create policy lessons_select_own
  on public.lessons for select to authenticated
  using (
    (team_id is not null and public.is_team_member(team_id))
    or (team_id is null and auth.uid() = user_id)
  );

drop policy if exists lessons_insert_own on public.lessons;
create policy lessons_insert_own
  on public.lessons for insert to authenticated
  with check (
    (team_id is not null and public.is_team_member(team_id))
    or (team_id is null and auth.uid() = user_id)
  );

drop policy if exists lessons_update_own on public.lessons;
create policy lessons_update_own
  on public.lessons for update to authenticated
  using (
    (team_id is not null and public.is_team_member(team_id))
    or (team_id is null and auth.uid() = user_id)
  )
  with check (
    (team_id is not null and public.is_team_member(team_id))
    or (team_id is null and auth.uid() = user_id)
  );

drop policy if exists lessons_delete_own on public.lessons;
create policy lessons_delete_own
  on public.lessons for delete to authenticated
  using (
    (team_id is not null and public.is_team_member(team_id))
    or (team_id is null and auth.uid() = user_id)
  );

-- One-time bulk action for "share what I already have" - see
-- share_my_events_with_team() in add_team_scoping_events.sql for the
-- identical rationale. Any team member can run this on their own
-- lessons (not owner-only - it only ever touches rows the caller
-- already owns, so there's no privilege question).
create or replace function public.share_my_lessons_with_team()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_my_team_id uuid;
  v_count integer;
begin
  select tm.team_id into v_my_team_id from public.team_members tm where tm.user_id = auth.uid();
  if v_my_team_id is null then
    raise exception 'NO_TEAM';
  end if;

  update public.lessons
  set team_id = v_my_team_id
  where user_id = auth.uid() and team_id is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.share_my_lessons_with_team() from public, anon;
grant execute on function public.share_my_lessons_with_team() to authenticated;

commit;
