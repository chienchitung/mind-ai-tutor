-- De-identified Ellis AI tutor conversation log for guest play (no
-- teacher-issued login code) - the counterpart to chat_messages the same
-- way guest_play_stats is the counterpart to learning_records. Chat for a
-- linked student is only saved once their lesson attempt is scored (see
-- lessons/[id]/page.tsx's savePendingChatData), so it was already
-- reasonably captured; guest play - most of current traffic - was not
-- captured at all, since saveChatMessage() short-circuits on
-- hasLinkedStudent(). This table intentionally carries no student name or
-- id, only which game/lesson the exchange happened in.
--
-- Run once in the Supabase SQL editor.

begin;

create table if not exists public.guest_chat_messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.digital_games(id),
  lesson_id text not null,
  message_content text not null check (char_length(message_content) <= 8000),
  is_user boolean not null,
  created_at timestamptz not null default now()
);
alter table public.guest_chat_messages enable row level security;

-- Matches guest_play_stats' policy shape exactly: anyone can log a message
-- against an active game (there is no student session to check), but only
-- that game's own creator can ever read the log back.
create policy guest_chat_messages_insert_active_game
  on public.guest_chat_messages for insert
  with check (exists (
    select 1 from public.digital_games dg
    where dg.id = guest_chat_messages.game_id and dg.is_active = true
  ));

create policy guest_chat_messages_select_owner
  on public.guest_chat_messages for select
  using (exists (
    select 1 from public.digital_games dg
    where dg.id = guest_chat_messages.game_id and dg.user_id = auth.uid()
  ));

grant insert on public.guest_chat_messages to anon, authenticated;
grant select on public.guest_chat_messages to authenticated;

commit;
