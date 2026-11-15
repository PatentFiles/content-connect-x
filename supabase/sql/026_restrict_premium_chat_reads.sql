-- Direct REST / Realtime database reads must obey the same subscription and age
-- requirements as Edge Functions. Restrictive policies AND with membership policies.
CREATE OR REPLACE FUNCTION ccx_internal.can_read_premium_chat()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL
 AND EXISTS (
   SELECT 1 FROM public.age_verification_requests v
   WHERE v.user_id=(SELECT auth.uid())
    AND v.id=(SELECT latest.id FROM public.age_verification_requests latest
       WHERE latest.user_id=(SELECT auth.uid()) ORDER BY latest.created_at DESC LIMIT 1)
    AND v.status='approved' AND (v.expires_at IS NULL OR v.expires_at>now())
 )
 AND NOT EXISTS (
   SELECT 1 FROM public.account_security s WHERE s.user_id=(SELECT auth.uid()) AND (s.banned OR s.suspended)
 )
 AND (
   EXISTS (SELECT 1 FROM public.member_subscriptions sub
     WHERE sub.user_id=(SELECT auth.uid()) AND sub.status IN ('active','trial')
       AND (sub.period_end IS NULL OR sub.period_end>now()))
   OR EXISTS (SELECT 1 FROM public.account_security s WHERE s.user_id=(SELECT auth.uid()) AND s.admin
     AND coalesce((SELECT auth.jwt())->>'aal','aal1')='aal2')
 );
$$;
REVOKE ALL ON FUNCTION ccx_internal.can_read_premium_chat() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION ccx_internal.can_read_premium_chat() TO authenticated;
CREATE POLICY restrict_premium_message_history AS RESTRICTIVE ON public.messages
 FOR SELECT TO authenticated USING ((SELECT ccx_internal.can_read_premium_chat()));
CREATE POLICY restrict_premium_conversation_metadata AS RESTRICTIVE ON public.conversations
 FOR SELECT TO authenticated USING ((SELECT ccx_internal.can_read_premium_chat()));
CREATE POLICY restrict_premium_conversation_members AS RESTRICTIVE ON public.conversation_members
 FOR SELECT TO authenticated USING ((SELECT ccx_internal.can_read_premium_chat()));
