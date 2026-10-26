-- Lecture audio kept for playback next to the transcript.
--
-- Until now the private live-recordings bucket only ever held 16 kHz WAV
-- segments for the few seconds between upload and transcription. The whole
-- lesson's compressed audio (Opus in WebM/Ogg, or AAC in MP4 on Safari) is
-- now also kept there at <user>/<recording>/lecture-audio, so the teacher
-- can play it back alongside the transcript from any computer. It stays
-- private to its owner (existing policies), and deleting the recording
-- removes it with the rest of the folder.
--
-- About 15 MB an hour at 32 kbps; 50 MB covers a lesson of over three hours.

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4']
where id = 'live-recordings';

-- A failed upload is retried with upsert, which needs to overwrite.
drop policy if exists live_recordings_update_own on storage.objects;
create policy live_recordings_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'live-recordings' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'live-recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
