-- Security advisor follow-ups (2026-10-24).
--
-- prevent_profile_role_change is a trigger function (profiles_prevent_role_escalation).
-- Triggers fire regardless of EXECUTE grants, so nobody needs to call it
-- directly - but as a SECURITY DEFINER function it was reachable by anon and
-- authenticated through /rest/v1/rpc. Revoke that.
revoke execute on function public.prevent_profile_role_change() from public, anon, authenticated;

-- ai_points_monthly_grant had no fixed search_path, so its unqualified
-- names resolve against whatever search_path the caller has.
alter function public.ai_points_monthly_grant() set search_path = public;
