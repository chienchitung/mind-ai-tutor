-- Poll questions a teacher prepares for a session ahead of class, launched
-- one by one during it. Kept on the session row, which only its owner can
-- read or update (live_sessions RLS); students never see an unlaunched one.
begin;

alter table public.live_sessions
  add column if not exists prepared_polls jsonb not null default '[]'::jsonb;

alter table public.live_sessions drop constraint if exists live_sessions_prepared_polls_shape;
alter table public.live_sessions add constraint live_sessions_prepared_polls_shape
  check (jsonb_typeof(prepared_polls) = 'array' and jsonb_array_length(prepared_polls) <= 30);

commit;
