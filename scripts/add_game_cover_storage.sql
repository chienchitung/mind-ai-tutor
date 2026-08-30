-- Run once in Supabase SQL Editor before using game cover uploads.
-- Public game artwork only: never upload personal/private documents here.
-- No service-role key is needed in the browser. Existing thumbnail URLs are unchanged.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-covers', 'game-covers', true, 5242880, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public buckets serve images by URL; no anonymous object-listing policy is needed.
drop policy if exists game_covers_insert_own on storage.objects;
create policy game_covers_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'game-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists game_covers_select_own on storage.objects;
create policy game_covers_select_own on storage.objects for select to authenticated
using (bucket_id = 'game-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists game_covers_delete_own on storage.objects;
create policy game_covers_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'game-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- No UPDATE policy: every new cover gets a new UUID, never overwrites an existing image.
commit;
