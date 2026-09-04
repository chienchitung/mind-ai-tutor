-- Supabase grants EXECUTE on new functions to anon explicitly in addition to
-- PostgreSQL's PUBLIC grant. These workspace functions require an authenticated
-- auth.uid(), so revoke both paths and keep only the intended role.
--
-- The add_team_scoping_*.sql scripts already do this same revoke/grant
-- inline for the share_my_*_with_team() function each of them creates -
-- the entries below for those three are redundant re-statements kept
-- here so this file stays the one place that lists every team-related
-- function's intended privileges in one shot.

REVOKE ALL ON FUNCTION public.is_team_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_team_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_team(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invite_team_member(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_team_member_by_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_team_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_team_members() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.share_my_events_with_team() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.share_my_lessons_with_team() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.share_my_feedback_with_team() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.share_my_digital_games_with_team() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_team_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_team(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_team_member(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_team_member_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_team_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_my_events_with_team() TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_my_lessons_with_team() TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_my_feedback_with_team() TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_my_digital_games_with_team() TO authenticated;
