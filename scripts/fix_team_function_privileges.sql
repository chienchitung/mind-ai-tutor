-- Supabase grants EXECUTE on new functions to anon explicitly in addition to
-- PostgreSQL's PUBLIC grant. These workspace functions require an authenticated
-- auth.uid(), so revoke both paths and keep only the intended role.

REVOKE ALL ON FUNCTION public.is_team_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_team_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_team(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invite_team_member(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_team_member_by_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_team_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_team_members() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.share_my_events_with_team() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_team_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_team(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_team_member(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_team_member_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_team_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_my_events_with_team() TO authenticated;
