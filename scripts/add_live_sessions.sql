-- Run once in Supabase SQL Editor. Adds the "課堂即時模式" (Live Classroom
-- Session) feature: a teacher opens a live poll + difficulty pulse alongside
-- their existing teaching content, students join anonymously via a 6-digit
-- code (no account), and the presenter/audience UIs sync over Supabase
-- Realtime Broadcast. Does not touch any existing table.
begin;

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  join_code text not null unique check (join_code ~ '^[0-9]{6}$'),
  status text not null default 'open' check (status in ('open', 'paused', 'closed')),
  active_poll_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_sessions_user_idx on public.live_sessions (user_id, created_at desc);
alter table public.live_sessions enable row level security;
revoke all on public.live_sessions from anon;
grant select, insert, update on public.live_sessions to authenticated;

drop policy if exists live_sessions_owner_select on public.live_sessions;
create policy live_sessions_owner_select on public.live_sessions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists live_sessions_owner_insert on public.live_sessions;
create policy live_sessions_owner_insert on public.live_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists live_sessions_owner_update on public.live_sessions;
create policy live_sessions_owner_update on public.live_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.live_polls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 500),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  created_at timestamptz not null default now()
);
create index if not exists live_polls_session_idx on public.live_polls (session_id, created_at desc);
alter table public.live_polls enable row level security;
revoke all on public.live_polls from anon;
grant select, insert on public.live_polls to authenticated;

drop policy if exists live_polls_owner_select on public.live_polls;
create policy live_polls_owner_select on public.live_polls for select to authenticated
  using (exists (select 1 from public.live_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
drop policy if exists live_polls_owner_insert on public.live_polls;
create policy live_polls_owner_insert on public.live_polls for insert to authenticated
  with check (exists (select 1 from public.live_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

-- Added after live_polls exists, to avoid a forward reference in live_sessions.
alter table public.live_sessions drop constraint if exists live_sessions_active_poll_fkey;
alter table public.live_sessions
  add constraint live_sessions_active_poll_fkey foreign key (active_poll_id) references public.live_polls(id) on delete set null;

-- One row per (poll, participant). participant_id is a random id the client
-- generates on join and keeps in tab-scoped storage - there is no student
-- account behind it, matching call-in's anonymous-audience model.
create table if not exists public.live_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.live_polls(id) on delete cascade,
  participant_id uuid not null,
  option_index integer not null check (option_index >= 0),
  created_at timestamptz not null default now(),
  unique (poll_id, participant_id)
);
create index if not exists live_poll_votes_poll_idx on public.live_poll_votes (poll_id);
alter table public.live_poll_votes enable row level security;
-- No direct grants at all, not even to authenticated: every read is an
-- aggregate tally via the RPCs below, never individual vote rows, and every
-- write is validated (session open, poll active, option in range) by
-- cast_live_poll_vote rather than a bare insert.
revoke all on public.live_poll_votes from anon, authenticated;

-- Continuous "how's the pace" pulse, one row per (session, participant); a
-- student can change it at any time, not just once per poll.
create table if not exists public.live_pulse (
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  participant_id uuid not null,
  value integer not null check (value between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (session_id, participant_id)
);
alter table public.live_pulse enable row level security;
revoke all on public.live_pulse from anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs. All SECURITY DEFINER with an empty search_path (fully-qualified
-- references only) so anon/authenticated never need direct table grants on
-- live_poll_votes / live_pulse.
-- ---------------------------------------------------------------------------

-- Private helper, not granted to anyone: zero-filled vote counts per option.
create or replace function public._live_poll_tally(p_poll_id uuid, p_option_count integer)
returns integer[]
language sql security definer set search_path = '' stable as $$
  select array(
    select count(v.id)::int
    from generate_series(0, p_option_count - 1) as idx
    left join public.live_poll_votes v on v.poll_id = p_poll_id and v.option_index = idx
    group by idx
    order by idx
  );
$$;
revoke all on function public._live_poll_tally(uuid, integer) from public;

create or replace function public.get_live_poll_tally(p_poll_id uuid)
returns table (vote_counts integer[], vote_total integer)
language plpgsql security definer set search_path = '' stable as $$
declare
  v_option_count integer;
begin
  select jsonb_array_length(options) into v_option_count from public.live_polls where id = p_poll_id;
  if v_option_count is null then
    return;
  end if;
  return query select public._live_poll_tally(p_poll_id, v_option_count),
    (select count(*)::int from public.live_poll_votes where poll_id = p_poll_id);
end;
$$;
revoke all on function public.get_live_poll_tally(uuid) from public;
grant execute on function public.get_live_poll_tally(uuid) to anon, authenticated;

create or replace function public.get_live_pulse_summary(p_session_id uuid)
returns table (pulse_counts integer[], pulse_total integer, pulse_average numeric)
language sql security definer set search_path = '' stable as $$
  select
    array(
      select count(v.session_id)::int
      from generate_series(1, 5) as lvl
      left join public.live_pulse v on v.session_id = p_session_id and v.value = lvl
      group by lvl
      order by lvl
    ),
    (select count(*)::int from public.live_pulse where session_id = p_session_id),
    (select round(avg(value)::numeric, 2) from public.live_pulse where session_id = p_session_id);
$$;
revoke all on function public.get_live_pulse_summary(uuid) from public;
grant execute on function public.get_live_pulse_summary(uuid) to anon, authenticated;

-- Public lookup by the 6-digit join code shown on the presenter screen. No
-- rows back means "no such code"; the session itself may be open, paused or
-- closed - the caller decides what to show for each status.
create or replace function public.get_live_session_by_code(p_code text)
returns table (
  session_id uuid, title text, status text,
  active_poll_id uuid, poll_question text, poll_options jsonb,
  vote_counts integer[], vote_total integer,
  pulse_counts integer[], pulse_total integer, pulse_average numeric
)
language plpgsql security definer set search_path = '' stable as $$
declare
  v_session public.live_sessions%rowtype;
  v_poll public.live_polls%rowtype;
  -- Plain "record" variables (unlike %rowtype ones) raise "record is not
  -- assigned yet" if referenced before their INTO ever runs, which happens
  -- here whenever there's no active poll - scalars default to NULL safely.
  v_vote_counts integer[];
  v_vote_total integer;
  v_pulse_counts integer[];
  v_pulse_total integer;
  v_pulse_average numeric;
begin
  select * into v_session from public.live_sessions where join_code = p_code;
  if v_session.id is null then
    return;
  end if;
  if v_session.active_poll_id is not null then
    select * into v_poll from public.live_polls where id = v_session.active_poll_id;
    -- Aliased: get_live_poll_tally()'s own output columns share names with
    -- this function's OUT parameters, which would make a bare reference
    -- ambiguous between the two.
    select t.vote_counts, t.vote_total into v_vote_counts, v_vote_total from public.get_live_poll_tally(v_poll.id) as t;
  end if;
  select p.pulse_counts, p.pulse_total, p.pulse_average into v_pulse_counts, v_pulse_total, v_pulse_average
    from public.get_live_pulse_summary(v_session.id) as p;
  return query select v_session.id, v_session.title, v_session.status,
    v_session.active_poll_id, v_poll.question, v_poll.options,
    coalesce(v_vote_counts, array[]::integer[]), coalesce(v_vote_total, 0),
    coalesce(v_pulse_counts, array[0, 0, 0, 0, 0]), coalesce(v_pulse_total, 0), v_pulse_average;
end;
$$;
revoke all on function public.get_live_session_by_code(text) from public;
grant execute on function public.get_live_session_by_code(text) to anon, authenticated;

-- Casts (or changes) one participant's vote and returns the fresh tally.
create or replace function public.cast_live_poll_vote(p_poll_id uuid, p_participant_id uuid, p_option_index integer)
returns table (vote_counts integer[], vote_total integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_poll public.live_polls%rowtype;
  v_session public.live_sessions%rowtype;
  v_option_count integer;
begin
  if p_participant_id is null then raise exception 'INVALID_PARTICIPANT'; end if;
  select * into v_poll from public.live_polls where id = p_poll_id;
  if v_poll.id is null then raise exception 'POLL_NOT_FOUND'; end if;
  select * into v_session from public.live_sessions where id = v_poll.session_id;
  if v_session.status <> 'open' then raise exception 'SESSION_NOT_OPEN'; end if;
  if v_session.active_poll_id is distinct from p_poll_id then raise exception 'POLL_NOT_ACTIVE'; end if;
  v_option_count := jsonb_array_length(v_poll.options);
  if p_option_index < 0 or p_option_index >= v_option_count then raise exception 'INVALID_OPTION'; end if;

  insert into public.live_poll_votes (poll_id, participant_id, option_index)
  values (p_poll_id, p_participant_id, p_option_index)
  on conflict (poll_id, participant_id) do update set option_index = excluded.option_index, created_at = now();

  return query select * from public.get_live_poll_tally(p_poll_id);
end;
$$;
revoke all on function public.cast_live_poll_vote(uuid, uuid, integer) from public;
grant execute on function public.cast_live_poll_vote(uuid, uuid, integer) to anon, authenticated;

-- Sets (or changes) one participant's difficulty pulse and returns the fresh summary.
create or replace function public.set_live_pulse(p_session_id uuid, p_participant_id uuid, p_value integer)
returns table (pulse_counts integer[], pulse_total integer, pulse_average numeric)
language plpgsql security definer set search_path = '' as $$
declare
  v_session public.live_sessions%rowtype;
begin
  if p_participant_id is null then raise exception 'INVALID_PARTICIPANT'; end if;
  if p_value < 1 or p_value > 5 then raise exception 'INVALID_VALUE'; end if;
  select * into v_session from public.live_sessions where id = p_session_id;
  if v_session.id is null then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status <> 'open' then raise exception 'SESSION_NOT_OPEN'; end if;

  insert into public.live_pulse (session_id, participant_id, value)
  values (p_session_id, p_participant_id, p_value)
  on conflict (session_id, participant_id) do update set value = excluded.value, updated_at = now();

  return query select * from public.get_live_pulse_summary(p_session_id);
end;
$$;
revoke all on function public.set_live_pulse(uuid, uuid, integer) from public;
grant execute on function public.set_live_pulse(uuid, uuid, integer) to anon, authenticated;

commit;
