-- Creates students, assignments, attendance, and progress - these tables
-- never existed in the database even though the frontend
-- (app/students/*, AssignmentTracker.tsx, AttendanceTracker.tsx,
-- lib/analytics.ts) already queries them, so those features have been
-- silently erroring (or, on the /students list page, silently falling
-- back to hardcoded demo data) in production.
--
-- Since there's no existing data to migrate, each table gets user_id
-- with RLS from the start - no backfill step needed, unlike the
-- events/students-that-never-existed situation earlier.
--
-- Run this once in the Supabase SQL editor.

-- ── students ────────────────────────────────────────────────────────
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  grade integer,
  subjects text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'inactive')),
  last_login timestamp with time zone,
  unique (user_id, email)
);

alter table public.students enable row level security;

drop policy if exists students_select_own on public.students;
create policy students_select_own on public.students
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists students_insert_own on public.students;
create policy students_insert_own on public.students
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists students_update_own on public.students;
create policy students_update_own on public.students
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists students_delete_own on public.students;
create policy students_delete_own on public.students
  for delete to authenticated using (auth.uid() = user_id);

-- ── assignments ─────────────────────────────────────────────────────
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject text not null,
  title text not null,
  description text,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'overdue')),
  score numeric,
  feedback text
);

alter table public.assignments enable row level security;

drop policy if exists assignments_select_own on public.assignments;
create policy assignments_select_own on public.assignments
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists assignments_insert_own on public.assignments;
create policy assignments_insert_own on public.assignments
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists assignments_update_own on public.assignments;
create policy assignments_update_own on public.assignments
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists assignments_delete_own on public.assignments;
create policy assignments_delete_own on public.assignments
  for delete to authenticated using (auth.uid() = user_id);

-- ── attendance ──────────────────────────────────────────────────────
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent', 'late')),
  notes text
);

alter table public.attendance enable row level security;

drop policy if exists attendance_select_own on public.attendance;
create policy attendance_select_own on public.attendance
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists attendance_insert_own on public.attendance;
create policy attendance_insert_own on public.attendance
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists attendance_update_own on public.attendance;
create policy attendance_update_own on public.attendance
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists attendance_delete_own on public.attendance;
create policy attendance_delete_own on public.attendance
  for delete to authenticated using (auth.uid() = user_id);

-- ── progress ────────────────────────────────────────────────────────
create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject text not null,
  score numeric not null,
  notes text
);

alter table public.progress enable row level security;

drop policy if exists progress_select_own on public.progress;
create policy progress_select_own on public.progress
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists progress_insert_own on public.progress;
create policy progress_insert_own on public.progress
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists progress_update_own on public.progress;
create policy progress_update_own on public.progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists progress_delete_own on public.progress;
create policy progress_delete_own on public.progress
  for delete to authenticated using (auth.uid() = user_id);
