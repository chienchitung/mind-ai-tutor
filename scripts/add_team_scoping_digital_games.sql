-- Extends team-based RLS (see docs/team-workspace-design.md and the
-- add_team_scoping_events.sql pilot) to `digital_games`. Requires
-- scripts/add_team_workspaces.sql to already be run.
--
-- team_id stays nullable and defaults to whatever team the inserting
-- user currently belongs to (null if they're not in one), via
-- public.current_team_id() - so no application code needs to change to
-- start writing team_id. A game row with team_id null keeps behaving
-- exactly like before (visible only to its own user_id); a row with
-- team_id set is visible to every member of that team, not just its
-- creator.
--
-- excel-master-game never reads digital_games directly (confirmed in
-- add_owner_scoping_digital_games.sql), so there's no anon carve-out to
-- preserve here - unlike lessons.
--
-- Run once in the Supabase SQL editor, after add_team_workspaces.sql.

begin;

alter table public.digital_games add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.digital_games alter column team_id set default public.current_team_id();

drop policy if exists digital_games_select_own on public.digital_games;
create policy digital_games_select_own
  on public.digital_games for select to authenticated
  using (
    (team_id is not null and public.is_team_member(team_id))
    or (team_id is null and auth.uid() = user_id)
  );

drop policy if exists digital_games_insert_own on public.digital_games;
create policy digital_games_insert_own
  on public.digital_games for insert to authenticated
  with check (
    (team_id is not null and public.is_team_member(team_id))
    or (team_id is null and auth.uid() = user_id)
  );

drop policy if exists digital_games_update_own on public.digital_games;
create policy digital_games_update_own
  on public.digital_games for update to authenticated
  using (
    (team_id is not null and public.is_team_member(team_id))
    or (team_id is null and auth.uid() = user_id)
  )
  with check (
    (team_id is not null and public.is_team_member(team_id))
    or (team_id is null and auth.uid() = user_id)
  );

drop policy if exists digital_games_delete_own on public.digital_games;
create policy digital_games_delete_own
  on public.digital_games for delete to authenticated
  using (
    (team_id is not null and public.is_team_member(team_id))
    or (team_id is null and auth.uid() = user_id)
  );

-- One-time bulk action for "share what I already have" - see
-- share_my_events_with_team() in add_team_scoping_events.sql for the
-- identical rationale. Any team member can run this on their own
-- games (not owner-only - it only ever touches rows the caller already
-- owns, so there's no privilege question).
create or replace function public.share_my_digital_games_with_team()
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

  update public.digital_games
  set team_id = v_my_team_id
  where user_id = auth.uid() and team_id is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.share_my_digital_games_with_team() from public, anon;
grant execute on function public.share_my_digital_games_with_team() to authenticated;

commit;
