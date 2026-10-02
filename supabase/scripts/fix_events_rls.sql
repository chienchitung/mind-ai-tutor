-- Fix: the `events` table was created without Row Level Security, so anyone
-- with the project's anon key (i.e. anyone with the site URL) could read,
-- insert, update, or delete every event, regardless of login state. This is
-- what Supabase's Security Advisor flagged as `rls_disabled_in_public`.
--
-- The app queries `events` with no per-user filter (see
-- app/contexts/EventContext.tsx), so it's a shared, team-wide resource, not
-- a per-user one. Policies below are scoped to any authenticated user
-- rather than `auth.uid() = user_id`, to match that existing behavior
-- instead of silently hiding events from users who didn't create them.
--
-- Run this once in the Supabase SQL editor against the project used by
-- this app.

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_select_policy ON public.events;
CREATE POLICY events_select_policy
  ON public.events
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS events_insert_policy ON public.events;
CREATE POLICY events_insert_policy
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS events_update_policy ON public.events;
CREATE POLICY events_update_policy
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS events_delete_policy ON public.events;
CREATE POLICY events_delete_policy
  ON public.events
  FOR DELETE
  TO authenticated
  USING (true);
