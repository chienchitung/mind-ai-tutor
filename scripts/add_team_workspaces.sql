-- Foundation for team/workspace co-editing (see docs/team-workspace-design.md).
--
-- Deliberately additive and opt-in: nothing here changes any existing
-- table's RLS, and no existing user gets a team created for them
-- automatically. A user only gets a row in team_members when they
-- explicitly create a workspace (create_team) or accept an invite
-- (invite_team_member on the inviter's side). Every existing resource
-- keeps working exactly as it does today until a later migration (see
-- scripts/add_team_scoping_events.sql for the first one) adds a nullable
-- team_id to it - team_id is null for everyone until then.
--
-- One team per user, enforced by team_members.user_id being UNIQUE
-- (see docs/team-workspace-design.md's "V1 決策 1"). All writes to
-- teams/team_members happen through the SECURITY DEFINER functions
-- below (own ownership/role checks baked in), not through direct
-- client inserts/updates/deletes - matches the live_questions pattern
-- in add_live_session_phase2.sql.
--
-- Run once in the Supabase SQL editor.

begin;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade unique,
  role text not null default 'member' check (role in ('owner', 'member')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;

alter table public.teams enable row level security;
drop policy if exists teams_select_members on public.teams;
create policy teams_select_members on public.teams
  for select to authenticated
  using (public.is_team_member(id));
-- No insert/update/delete policy: all writes go through create_team()
-- below. Renaming/deleting a team is not part of V1.

alter table public.team_members enable row level security;
drop policy if exists team_members_select_own_team on public.team_members;
create policy team_members_select_own_team on public.team_members
  for select to authenticated
  using (public.is_team_member(team_id));
-- No insert/update/delete policy: all writes go through the RPCs below.

-- Creates a new workspace with the caller as its owner. Fails if the
-- caller is already in a team (own or someone else's) - V1 is one team
-- per user, so this is the explicit "start my own workspace" action,
-- separate from being invited into someone else's.
create or replace function public.create_team(p_name text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
begin
  if exists (select 1 from public.team_members where user_id = auth.uid()) then
    raise exception 'ALREADY_IN_A_TEAM';
  end if;

  insert into public.teams (owner_id, name)
  values (auth.uid(), coalesce(nullif(trim(p_name), ''), '我的工作區'))
  returning id into v_team_id;

  insert into public.team_members (team_id, user_id, role)
  values (v_team_id, auth.uid(), 'owner');

  return v_team_id;
end;
$$;
revoke all on function public.create_team(text) from public;
grant execute on function public.create_team(text) to authenticated;

-- Owner-only: add an existing account (by email) to the caller's team.
-- The invitee must not already belong to any team - V1 has no "leave
-- your team to join another" flow beyond remove_team_member below.
create or replace function public.invite_team_member(p_email text)
returns table (user_id uuid, role text)
language plpgsql security definer set search_path = public as $$
declare
  v_my_team_id uuid;
  v_my_role text;
  v_invitee_id uuid;
begin
  select tm.team_id, tm.role into v_my_team_id, v_my_role
  from public.team_members tm where tm.user_id = auth.uid();

  if v_my_team_id is null then
    raise exception 'NO_TEAM';
  end if;
  if v_my_role <> 'owner' then
    raise exception 'FORBIDDEN';
  end if;

  select id into v_invitee_id from auth.users where lower(email) = lower(trim(p_email));
  if v_invitee_id is null then
    raise exception 'USER_NOT_FOUND';
  end if;
  if v_invitee_id = auth.uid() then
    raise exception 'CANNOT_INVITE_SELF';
  end if;
  if exists (select 1 from public.team_members where user_id = v_invitee_id) then
    raise exception 'ALREADY_IN_A_TEAM';
  end if;

  insert into public.team_members (team_id, user_id, role, invited_by)
  values (v_my_team_id, v_invitee_id, 'member', auth.uid());

  return query select v_invitee_id, 'member'::text;
end;
$$;
revoke all on function public.invite_team_member(text) from public;
grant execute on function public.invite_team_member(text) to authenticated;

-- Owner removes a member, or a member removes themself (leave). The
-- owner can't remove themself this way - V1 has no "delete team" or
-- "transfer ownership" flow, so an owner leaving would orphan the team.
create or replace function public.remove_team_member(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_my_team_id uuid;
  v_my_role text;
  v_target_team_id uuid;
begin
  select tm.team_id, tm.role into v_my_team_id, v_my_role
  from public.team_members tm where tm.user_id = auth.uid();
  if v_my_team_id is null then
    raise exception 'NO_TEAM';
  end if;

  select tm.team_id into v_target_team_id
  from public.team_members tm where tm.user_id = p_user_id;
  if v_target_team_id is null or v_target_team_id <> v_my_team_id then
    raise exception 'NOT_IN_YOUR_TEAM';
  end if;

  if p_user_id = auth.uid() then
    if v_my_role = 'owner' then
      raise exception 'OWNER_CANNOT_LEAVE';
    end if;
  elsif v_my_role <> 'owner' then
    raise exception 'FORBIDDEN';
  end if;

  delete from public.team_members where team_id = v_target_team_id and user_id = p_user_id;
end;
$$;
revoke all on function public.remove_team_member(uuid) from public;
grant execute on function public.remove_team_member(uuid) to authenticated;

-- Member list with email - authenticated/anon have no direct grant on
-- auth.users, so this has to go through a SECURITY DEFINER function
-- rather than a client-side join.
create or replace function public.list_team_members()
returns table (member_user_id uuid, email text, role text, joined_at timestamptz)
language plpgsql security definer set search_path = public stable as $$
declare
  v_my_team_id uuid;
begin
  select tm.team_id into v_my_team_id from public.team_members tm where tm.user_id = auth.uid();
  if v_my_team_id is null then
    return;
  end if;
  return query
    select tm.user_id, u.email::text, tm.role, tm.created_at
    from public.team_members tm
    join auth.users u on u.id = tm.user_id
    where tm.team_id = v_my_team_id
    order by (tm.role = 'owner') desc, tm.created_at asc;
end;
$$;
revoke all on function public.list_team_members() from public;
grant execute on function public.list_team_members() to authenticated;

commit;
