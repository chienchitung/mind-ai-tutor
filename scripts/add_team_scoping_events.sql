-- First table to switch from owner-only to team-aware RLS (the "events"
-- pilot from docs/team-workspace-design.md). Requires
-- scripts/add_team_workspaces.sql to already be run.
--
-- team_id stays nullable and defaults to whatever team the inserting
-- user currently belongs to (null if they're not in one), via a
-- subquery default - same mechanism events.user_id already uses for
-- auth.uid(), so no application code needs to change to start writing
-- team_id. An event with team_id null keeps behaving exactly like
-- before (visible only to its own user_id); an event with team_id set
-- is visible to every member of that team, not just its creator.
--
-- Run once in the Supabase SQL editor, after add_team_workspaces.sql.

begin;

alter table public.events add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.events alter column team_id set default (
  select team_id from public.team_members where user_id = auth.uid()
);

drop policy if exists events_select_policy on public.events;
create policy events_select_policy
  on public.events for select to authenticated
  using (
    (team_id is not null and public.is_team_member(team_id))
    or (team_id is null and auth.uid() = user_id)
  );

drop policy if exists events_insert_policy on public.events;
create policy events_insert_policy
  on public.events for insert to authenticated
  with check (
    (team_id is not null and public.is_team_member(team_id))
    or (team_id is null and auth.uid() = user_id)
  );

drop policy if exists events_update_policy on public.events;
create policy events_update_policy
  on public.events for update to authenticated
  using (
    (team_id is not null and public.is_team_member(team_id))
    or (team_id is null and auth.uid() = user_id)
  )
  with check (
    (team_id is not null and public.is_team_member(team_id))
    or (team_id is null and auth.uid() = user_id)
  );

drop policy if exists events_delete_policy on public.events;
create policy events_delete_policy
  on public.events for delete to authenticated
  using (
    (team_id is not null and public.is_team_member(team_id))
    or (team_id is null and auth.uid() = user_id)
  );

commit;
