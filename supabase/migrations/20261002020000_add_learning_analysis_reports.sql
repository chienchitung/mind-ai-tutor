-- Saved AI learning-analysis reports, so teachers can revisit and compare
-- earlier analyses instead of regenerating (and spending AI points) each time.
begin;

create table public.learning_analysis_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null,
  analysis text not null check (char_length(analysis) between 1 and 50000),
  language text not null check (language in ('en', 'zh-TW')),
  -- Human-readable scope the report was generated for (game / period), shown
  -- next to history entries so two reports can be told apart.
  scope_label text check (scope_label is null or char_length(scope_label) <= 200),
  record_count integer not null default 0 check (record_count >= 0),
  created_at timestamptz not null default now(),
  -- Composite key: a report can only reference a student the same teacher
  -- owns, even if a client submits another teacher's student UUID.
  foreign key (student_id, user_id)
    references public.students(id, user_id) on delete cascade
);

create index learning_analysis_reports_student_idx
  on public.learning_analysis_reports (user_id, student_id, created_at desc);

alter table public.learning_analysis_reports enable row level security;

revoke all on table public.learning_analysis_reports from anon, authenticated;
-- Reports are immutable records of what the AI produced; no update grant.
grant select, insert, delete on table public.learning_analysis_reports to authenticated;

create policy learning_analysis_reports_select_own on public.learning_analysis_reports
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy learning_analysis_reports_insert_own on public.learning_analysis_reports
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy learning_analysis_reports_delete_own on public.learning_analysis_reports
  for delete to authenticated
  using ((select auth.uid()) = user_id);

commit;
