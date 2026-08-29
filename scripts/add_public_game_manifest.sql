-- Data-driven game-engine manifest.
--
-- The student game uses the anon role, while digital_games and lessons are
-- teacher-owned. This narrow SECURITY DEFINER function exposes only an active
-- game's playable fields and only lessons owned by the same teacher. It does
-- not expose user_id or any other teacher/account data.

alter table public.digital_games
  add column if not exists settings jsonb not null default '{}'::jsonb;

update public.digital_games set is_active = true where is_active is null;
alter table public.digital_games alter column is_active set default true;

-- The new engine writes game_id explicitly instead of inferring it from a
-- lesson after the fact. Keep this migration self-contained for environments
-- that have not run add_student_login_codes.sql yet.
alter table public.learning_records
  add column if not exists game_id uuid references public.digital_games(id);
alter table public.leaderboard
  add column if not exists game_id uuid references public.digital_games(id);
alter table public.chat_messages
  add column if not exists game_id uuid references public.digital_games(id);
alter table public.question_counts
  add column if not exists game_id uuid references public.digital_games(id);

create index if not exists learning_records_game_id_idx on public.learning_records(game_id);
create index if not exists leaderboard_game_id_idx on public.leaderboard(game_id);
create index if not exists chat_messages_game_id_idx on public.chat_messages(game_id);
create index if not exists question_counts_game_id_idx on public.question_counts(game_id);

create or replace function public.get_public_game_manifest(p_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', g.id,
    'title', g.title,
    'description', g.description,
    'thumbnail_url', g.thumbnail_url,
    'settings', coalesce(g.settings, '{}'::jsonb),
    'lessons', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'title', l.title,
          'description', l.description,
          'duration', l.duration,
          'level', l.level,
          'teaching_content', l.teaching_content,
          'markdown_content', l.markdown_content,
          'practice_exercises', l.practice_exercises,
          'genially_link', l.genially_link,
          'metadata', l.metadata,
          'position', ordered.position
        ) order by ordered.position
      )
      from jsonb_array_elements_text(
        coalesce(to_jsonb(g.lesson_ids), '[]'::jsonb)
      ) with ordinality as ordered(lesson_id, position)
      join public.lessons l
        on l.id::text = ordered.lesson_id
       and l.user_id = g.user_id
    ), '[]'::jsonb)
  )
  from public.digital_games g
  where g.id = p_game_id
    and coalesce(g.is_active, false) = true;
$$;

revoke all on function public.get_public_game_manifest(uuid) from public;
grant execute on function public.get_public_game_manifest(uuid) to anon, authenticated;

comment on function public.get_public_game_manifest(uuid) is
  'Returns the public, ordered manifest for one active digital game.';
