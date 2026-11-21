-- The public representation entrypoint does not itself need definer rights.
-- Its private implementation has explicit auth.uid() and verified-workspace
-- checks, and remains a SECURITY DEFINER function in the unexposed schema.
GRANT EXECUTE ON FUNCTION ccx_workspace_private.ccx_representation_agreement_action(text,jsonb) TO authenticated;
ALTER FUNCTION public.ccx_representation_agreement_action(text,jsonb) SECURITY INVOKER;
-- Keep anonymous access disabled; only approved member claims may be used.
REVOKE ALL ON FUNCTION public.ccx_representation_agreement_action(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ccx_representation_agreement_action(text,jsonb) TO authenticated,service_role;
