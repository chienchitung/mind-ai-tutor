-- Run once in Supabase SQL Editor after add_live_sessions.sql. Adds:
-- 1) PDF deck projection (storage bucket + two columns on live_sessions)
-- 2) Phase 2: live Q&A with upvoting and teacher moderation
-- Reactions (Phase 3) need no schema - they are ephemeral broadcasts only.
begin;

-- ---------------------------------------------------------------------------
-- 1. PDF deck projection
-- ---------------------------------------------------------------------------
alter table public.live_sessions add column if not exists deck_url text;
alter table public.live_sessions add column if not exists deck_page integer not null default 1 check (deck_page >= 1);

-- get_live_session_by_code's TABLE columns are changing (adding deck_url/
-- deck_page), which CREATE OR REPLACE cannot do - drop and recreate.
drop function if exists public.get_live_session_by_code(text);
create or replace function public.get_live_session_by_code(p_code text)
returns table (
  session_id uuid, title text, status text,
  active_poll_id uuid, poll_question text, poll_options jsonb,
  vote_counts integer[], vote_total integer,
  pulse_counts integer[], pulse_total integer, pulse_average numeric,
  deck_url text, deck_page integer
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
    coalesce(v_pulse_counts, array[0, 0, 0, 0, 0]), coalesce(v_pulse_total, 0), v_pulse_average,
    v_session.deck_url, v_session.deck_page;
end;
$$;
revoke all on function public.get_live_session_by_code(text) from public;
grant execute on function public.get_live_session_by_code(text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('live-decks', 'live-decks', true, 20971520, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists live_decks_insert_own on storage.objects;
create policy live_decks_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'live-decks' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists live_decks_select_own on storage.objects;
create policy live_decks_select_own on storage.objects for select to authenticated
using (bucket_id = 'live-decks' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists live_decks_delete_own on storage.objects;
create policy live_decks_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'live-decks' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- 2. Live Q&A
-- ---------------------------------------------------------------------------
create table if not exists public.live_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  participant_id uuid not null,
  text text not null check (char_length(text) between 1 and 500),
  lens text not null check (lens in ('clarify', 'chorus', 'bridge', 'keeper')),
  visibility text not null default 'public' check (visibility in ('public', 'author_only')),
  upvotes integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists live_questions_session_idx on public.live_questions (session_id, upvotes desc, created_at desc);
alter table public.live_questions enable row level security;
-- No anon/authenticated table grants at all: students read/write only
-- through the RPCs below (which filter hidden questions to their author),
-- and the teacher's moderation UI also goes through get_live_questions plus
-- moderate_live_question - never a bare select/update on this table.
revoke all on public.live_questions from anon, authenticated;

create table if not exists public.live_question_votes (
  question_id uuid not null references public.live_questions(id) on delete cascade,
  participant_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (question_id, participant_id)
);
alter table public.live_question_votes enable row level security;
revoke all on public.live_question_votes from anon, authenticated;

-- Public + owner-aware read: 'public' questions for everyone, plus the
-- caller's own questions regardless of visibility (so an author can see
-- their own question was hidden, without seeing anyone else's hidden ones).
-- Passing the teacher's own participant_id as null returns only public rows.
create or replace function public.get_live_questions(p_session_id uuid, p_participant_id uuid default null)
returns table (id uuid, text text, lens text, visibility text, upvotes integer, created_at timestamptz, is_mine boolean)
language sql security definer set search_path = '' stable as $$
  select q.id, q.text, q.lens, q.visibility, q.upvotes, q.created_at, (q.participant_id = p_participant_id) as is_mine
  from public.live_questions q
  where q.session_id = p_session_id
    and (q.visibility = 'public' or q.participant_id = p_participant_id)
  order by q.upvotes desc, q.created_at asc;
$$;
revoke all on function public.get_live_questions(uuid, uuid) from public;
grant execute on function public.get_live_questions(uuid, uuid) to anon, authenticated;

-- Teacher-only: every question for their own session, moderation status included.
create or replace function public.get_live_questions_for_owner(p_session_id uuid)
returns table (id uuid, text text, lens text, visibility text, upvotes integer, created_at timestamptz)
language plpgsql security definer set search_path = '' stable as $$
begin
  if not exists (select 1 from public.live_sessions s where s.id = p_session_id and s.user_id = auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;
  return query
    select q.id, q.text, q.lens, q.visibility, q.upvotes, q.created_at
    from public.live_questions q
    where q.session_id = p_session_id
    order by q.upvotes desc, q.created_at asc;
end;
$$;
revoke all on function public.get_live_questions_for_owner(uuid) from public;
grant execute on function public.get_live_questions_for_owner(uuid) to authenticated;

create or replace function public.submit_live_question(p_session_id uuid, p_participant_id uuid, p_text text, p_lens text)
returns table (id uuid, text text, lens text, visibility text, upvotes integer, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_session public.live_sessions%rowtype;
  v_text text := trim(p_text);
  v_row public.live_questions%rowtype;
begin
  if p_participant_id is null then raise exception 'INVALID_PARTICIPANT'; end if;
  if v_text = '' or char_length(v_text) > 500 then raise exception 'INVALID_TEXT'; end if;
  if p_lens not in ('clarify', 'chorus', 'bridge', 'keeper') then raise exception 'INVALID_LENS'; end if;
  -- Aliased: this function's own OUT parameter is also named "id", which
  -- would otherwise make a bare "id" ambiguous against live_sessions.id.
  select * into v_session from public.live_sessions ls where ls.id = p_session_id;
  if v_session.id is null then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.status <> 'open' then raise exception 'SESSION_NOT_OPEN'; end if;

  insert into public.live_questions (session_id, participant_id, text, lens)
  values (p_session_id, p_participant_id, v_text, p_lens)
  returning * into v_row;

  return query select v_row.id, v_row.text, v_row.lens, v_row.visibility, v_row.upvotes, v_row.created_at;
end;
$$;
revoke all on function public.submit_live_question(uuid, uuid, text, text) from public;
grant execute on function public.submit_live_question(uuid, uuid, text, text) to anon, authenticated;

create or replace function public.upvote_live_question(p_question_id uuid, p_participant_id uuid)
returns table (upvotes integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_session_id uuid;
  v_status text;
begin
  if p_participant_id is null then raise exception 'INVALID_PARTICIPANT'; end if;
  select q.session_id, s.status into v_session_id, v_status
  from public.live_questions q join public.live_sessions s on s.id = q.session_id
  where q.id = p_question_id;
  if v_session_id is null then raise exception 'QUESTION_NOT_FOUND'; end if;
  if v_status <> 'open' then raise exception 'SESSION_NOT_OPEN'; end if;

  insert into public.live_question_votes (question_id, participant_id) values (p_question_id, p_participant_id)
  on conflict (question_id, participant_id) do nothing;

  -- Aliased: this function's own OUT parameter is also named "upvotes"/
  -- implicitly shadows plain "id" too, so qualify the target row explicitly.
  update public.live_questions lq set upvotes = (select count(*) from public.live_question_votes where question_id = p_question_id)
  where lq.id = p_question_id;

  return query select q.upvotes from public.live_questions q where q.id = p_question_id;
end;
$$;
revoke all on function public.upvote_live_question(uuid, uuid) from public;
grant execute on function public.upvote_live_question(uuid, uuid) to anon, authenticated;

-- Teacher-only moderation: toggle a question's visibility on their own session.
create or replace function public.moderate_live_question(p_question_id uuid, p_visibility text)
returns table (id uuid, visibility text)
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
begin
  if p_visibility not in ('public', 'author_only') then raise exception 'INVALID_VISIBILITY'; end if;
  select s.user_id into v_owner
  from public.live_questions q join public.live_sessions s on s.id = q.session_id
  where q.id = p_question_id;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'FORBIDDEN'; end if;

  -- Aliased for the same reason as above: this function's OUT parameters
  -- include "id", which would make a bare "id" ambiguous.
  update public.live_questions lq set visibility = p_visibility where lq.id = p_question_id;
  return query select q.id, q.visibility from public.live_questions q where q.id = p_question_id;
end;
$$;
revoke all on function public.moderate_live_question(uuid, text) from public;
grant execute on function public.moderate_live_question(uuid, text) to authenticated;

commit;
