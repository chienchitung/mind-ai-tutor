-- The profiles table referenced by middleware.ts (admin gating),
-- app/admin/page.tsx, and app/profile/page.tsx never actually existed in
-- this database - it only existed as a TypeScript type declaration that
-- was never backed by a real table. Every query against it errors, and
-- middleware.ts treats that error as "not an admin", so /admin currently
-- redirects everyone away, including the intended admin.
--
-- Run this BEFORE scripts/fix_profiles_rls.sql and the admin-bootstrap
-- SQL you were given earlier - both assume this table already exists.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  role text not null default 'teacher' check (role in ('admin', 'teacher', 'student'))
);

create unique index if not exists profiles_user_id_key on public.profiles (user_id);
