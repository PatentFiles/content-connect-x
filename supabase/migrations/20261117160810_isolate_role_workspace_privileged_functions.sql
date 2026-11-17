-- Keep privileged implementations out of the exposed API schema. Public RPCs
-- are invoker wrappers; each private implementation still validates auth.uid(),
-- verified age, current account state, actual role, feature gates and ownership.
CREATE SCHEMA ccx_workspace_private;
REVOKE ALL ON SCHEMA ccx_workspace_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA ccx_workspace_private TO authenticated,service_role;
ALTER FUNCTION public.ccx_workspace_allowed(text,text[]) SET SCHEMA ccx_workspace_private;
ALTER FUNCTION public.ccx_member_feature_flags() SET SCHEMA ccx_workspace_private;
ALTER FUNCTION public.ccx_save_professional_profile(jsonb,jsonb) SET SCHEMA ccx_workspace_private;
ALTER FUNCTION public.ccx_roster_action(text,jsonb) SET SCHEMA ccx_workspace_private;
ALTER FUNCTION public.ccx_portfolio_action(text,jsonb) SET SCHEMA ccx_workspace_private;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ccx_workspace_private FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ccx_workspace_private TO authenticated,service_role;
CREATE FUNCTION public.ccx_workspace_allowed(p_feature text DEFAULT NULL,p_roles text[] DEFAULT '{}'::text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT ccx_workspace_private.ccx_workspace_allowed(p_feature,p_roles) $$;
CREATE FUNCTION public.ccx_member_feature_flags()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT ccx_workspace_private.ccx_member_feature_flags() $$;
CREATE FUNCTION public.ccx_save_professional_profile(p_profile jsonb,p_details jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT ccx_workspace_private.ccx_save_professional_profile(p_profile,p_details) $$;
CREATE FUNCTION public.ccx_roster_action(p_action text,p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT ccx_workspace_private.ccx_roster_action(p_action,p_data) $$;
CREATE FUNCTION public.ccx_portfolio_action(p_action text,p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT ccx_workspace_private.ccx_portfolio_action(p_action,p_data) $$;
REVOKE ALL ON FUNCTION public.ccx_workspace_allowed(text,text[]),public.ccx_member_feature_flags(),public.ccx_save_professional_profile(jsonb,jsonb),public.ccx_roster_action(text,jsonb),public.ccx_portfolio_action(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ccx_workspace_allowed(text,text[]),public.ccx_member_feature_flags(),public.ccx_save_professional_profile(jsonb,jsonb),public.ccx_roster_action(text,jsonb),public.ccx_portfolio_action(text,jsonb) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
