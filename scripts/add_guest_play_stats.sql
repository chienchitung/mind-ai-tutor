-- Anonymous aggregate stats for guest (no login-code) play in game-engine.
--
-- Deliberately a SEPARATE table from learning_records/leaderboard, not a
-- relaxation of scripts/harden_game_student_data.sql's guardrails there.
-- Those tables (and their insert policy + BEFORE INSERT trigger) exist
-- specifically to guarantee every row is tied to a real, teacher-verified
-- roster entry - carving an anonymous-guest exception into them would
-- undermine that guarantee for real student data too. This table instead
-- captures the least amount of information that is still useful: no name,
-- no student id, no IP/user-agent - just "someone played this game/lesson
-- for this long" - visible only to the teacher who owns the game.
--
-- Run once in the Supabase SQL editor, after add_public_game_manifest.sql
-- (needs public.digital_games to already exist).

begin;

create table if not exists public.guest_play_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.digital_games(id) on delete cascade,
  lesson_id text not null,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  time_spent_seconds integer not null check (time_spent_seconds >= 0 and time_spent_seconds < 86400),
  answer_attempts integer not null default 0 check (answer_attempts >= 0),
  is_final_lesson boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists guest_play_stats_game_id_idx on public.guest_play_stats (game_id);

alter table public.guest_play_stats enable row level security;

-- The only write path anon ever gets. Scoped to games that are actually
-- active/public so this can't be used to probe for private game ids or
-- spam arbitrary game_id values.
drop policy if exists guest_play_stats_insert_active_game on public.guest_play_stats;
create policy guest_play_stats_insert_active_game
on public.guest_play_stats for insert to anon, authenticated
with check (
  exists (
    select 1 from public.digital_games dg
    where dg.id = game_id and dg.is_active = true
  )
);

-- Only the game's own creator can read its aggregate guest stats.
drop policy if exists guest_play_stats_select_owner on public.guest_play_stats;
create policy guest_play_stats_select_owner
on public.guest_play_stats for select to authenticated
using (
  exists (
    select 1 from public.digital_games dg
    where dg.id = game_id and dg.user_id = auth.uid()
  )
);

revoke all on public.guest_play_stats from public, anon, authenticated;
grant insert on public.guest_play_stats to anon, authenticated;
grant select on public.guest_play_stats to authenticated;

-- One row per game: count of guest completions and total/average time spent,
-- for the game's own creator only (SECURITY DEFINER so it can read across
-- all rows internally, but the WHERE clause + revoked direct table access
-- means a caller only ever gets rows for games they own).
create or replace function public.get_my_guest_play_summary()
returns table (game_id uuid, play_count bigint, total_time_seconds bigint, avg_time_seconds numeric)
language sql security definer set search_path = public stable as $$
  select gps.game_id, count(*), sum(gps.time_spent_seconds), avg(gps.time_spent_seconds)
  from public.guest_play_stats gps
  join public.digital_games dg on dg.id = gps.game_id
  where dg.user_id = auth.uid()
  group by gps.game_id;
$$;
revoke all on function public.get_my_guest_play_summary() from public, anon;
grant execute on function public.get_my_guest_play_summary() to authenticated;

commit;
