-- Lecture recording -> transcript -> teaching notes (phase 1, audio only).
--
-- The presenter's browser records the microphone and, every five minutes,
-- uploads one 16 kHz mono WAV segment to the private live-recordings bucket.
-- The server transcribes each segment with Gemini as soon as it lands, then
-- deletes the audio and keeps only the text, so Storage never accumulates
-- lecture audio. Teaching notes are generated from the joined transcript.
begin;

create table public.live_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Kept when the session is deleted: the notes are worth more than the session.
  session_id uuid references public.live_sessions(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  status text not null default 'recording' check (status in ('recording', 'stopped')),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  -- [{ "t": seconds since start, "page": slide page }], appended on each page turn.
  slide_marks jsonb not null default '[]'::jsonb check (jsonb_typeof(slide_marks) = 'array'),
  notes jsonb,
  notes_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index live_recordings_owner_idx on public.live_recordings (user_id, created_at desc);
create index live_recordings_session_idx on public.live_recordings (session_id, created_at desc);

create table public.live_recording_segments (
  recording_id uuid not null references public.live_recordings(id) on delete cascade,
  idx integer not null check (idx between 0 and 287),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  start_seconds integer not null check (start_seconds >= 0),
  duration_seconds integer not null check (duration_seconds between 1 and 900),
  status text not null check (status in ('transcribed', 'failed')),
  transcript text check (transcript is null or char_length(transcript) <= 60000),
  error text check (error is null or char_length(error) <= 500),
  updated_at timestamptz not null default now(),
  primary key (recording_id, idx)
);

alter table public.live_recordings enable row level security;
alter table public.live_recording_segments enable row level security;

revoke all on table public.live_recordings from anon, authenticated;
revoke all on table public.live_recording_segments from anon, authenticated;
grant select, insert, update, delete on table public.live_recordings to authenticated;
grant select, insert, update, delete on table public.live_recording_segments to authenticated;

create policy live_recordings_owner on public.live_recordings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- A segment row must belong to a recording the same teacher owns.
create policy live_recording_segments_owner on public.live_recording_segments
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.live_recordings r where r.id = recording_id and r.user_id = (select auth.uid()))
  );

-- Private bucket: audio is only ever read back by the owner's own server
-- request (to transcribe it), never served publicly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('live-recordings', 'live-recordings', false, 15728640, array['audio/wav'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy live_recordings_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'live-recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy live_recordings_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'live-recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy live_recordings_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'live-recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Two new AI point costs: each five-minute segment transcribed, and one
-- teaching-notes generation. Everything else is unchanged from the live
-- definition (cooldown, 100 requests/day, points deducted atomically).
create or replace function public.claim_teacher_ai_generation(p_kind text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_row public.teacher_ai_usage%rowtype;
  v_day date := (now() at time zone 'utc')::date;
  v_cost integer;
  v_existing boolean;
begin
  if v_user is null then return 'UNAUTHORIZED'; end if;
  v_cost := case p_kind
    when 'quiz' then 20
    when 'practice' then 6
    when 'learning_analysis' then 12
    when 'transcription' then 5
    when 'lesson_notes' then 20
    else null
  end;
  if v_cost is null then return 'INVALID_KIND'; end if;

  select * into v_row from public.teacher_ai_usage
  where user_id = v_user and usage_day = v_day
  for update;
  v_existing := found;

  if v_existing then
    if v_row.last_attempt_at > now() - interval '3 seconds' then return 'COOLDOWN'; end if;
    if v_row.request_count >= 100 then return 'DAILY_LIMIT'; end if;
  end if;

  if public.deduct_ai_points(v_user, v_cost) is null then return 'INSUFFICIENT_POINTS'; end if;

  if v_existing then
    update public.teacher_ai_usage
      set request_count = request_count + 1, last_attempt_at = now()
      where user_id = v_user and usage_day = v_day;
  else
    insert into public.teacher_ai_usage(user_id, usage_day, request_count, last_attempt_at)
    values (v_user, v_day, 1, now());
  end if;
  return 'OK';
end;
$function$;

commit;
