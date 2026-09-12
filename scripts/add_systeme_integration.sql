-- Systeme.io course-progress integration
--
-- systeme.io is single-tenant per account; this app is multi-tenant (many
-- teachers, each with their own student roster). So each teacher gets an
-- opaque webhook token that goes in their own webhook URL - that token is
-- what tells the receiver (app/api/webhooks/systeme/[token]/route.ts)
-- which teacher's roster a given delivery belongs to, and is itself the
-- main access control (unguessable, same trade-off as a Slack/Discord
-- incoming webhook URL). webhook_secret verifies systeme.io's
-- `x-systeme-signature` HMAC-SHA256 header when a delivery carries one -
-- the Workflow "Send Webhook" action (the only path with lecture/module/
-- course-completed granularity) does not appear to offer a secret field,
-- so this is best-effort, not a hard requirement.
--
-- Safe to re-run.

create table if not exists public.systeme_integrations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  webhook_token uuid not null unique default gen_random_uuid(),
  webhook_secret text not null,
  created_at timestamptz not null default now()
);

alter table public.systeme_integrations enable row level security;

drop policy if exists systeme_integrations_select_own on public.systeme_integrations;
create policy systeme_integrations_select_own on public.systeme_integrations
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists systeme_integrations_insert_own on public.systeme_integrations;
create policy systeme_integrations_insert_own on public.systeme_integrations
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists systeme_integrations_update_own on public.systeme_integrations;
create policy systeme_integrations_update_own on public.systeme_integrations
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists systeme_integrations_delete_own on public.systeme_integrations;
create policy systeme_integrations_delete_own on public.systeme_integrations
  for delete to authenticated using (auth.uid() = user_id);

-- Raw event log - one row per accepted webhook delivery (Enrolled in
-- course / Lecture completed / Module completed / Course completed,
-- configured as separate systeme.io Workflows, each posting to this
-- teacher's webhook URL with a matching `event` query param - see
-- app/api/webhooks/systeme/[token]/route.ts for why the event type comes
-- from the URL rather than the payload body).
--
-- student_id is resolved by matching contact_email against this teacher's
-- own students.email at insert time; null when there's no roster match
-- yet (teacher can add the student later - historical events are not
-- retroactively linked, same convention as add_student_login_codes.sql).
create table if not exists public.systeme_course_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  contact_email text,
  course_id text,
  course_name text,
  event_type text not null check (event_type in (
    'enrolled_in_course', 'lecture_completed', 'module_completed', 'course_completed'
  )),
  event_occurred_at timestamptz,
  raw_payload jsonb not null
);

create index if not exists systeme_course_events_user_student_idx
  on public.systeme_course_events (user_id, student_id);

alter table public.systeme_course_events enable row level security;

drop policy if exists systeme_course_events_select_own on public.systeme_course_events;
create policy systeme_course_events_select_own on public.systeme_course_events
  for select to authenticated using (auth.uid() = user_id);

-- No insert/update/delete policy for `authenticated` on purpose - these
-- rows are only ever written by the webhook route using the service role
-- key (bypasses RLS), never directly by a logged-in teacher.
