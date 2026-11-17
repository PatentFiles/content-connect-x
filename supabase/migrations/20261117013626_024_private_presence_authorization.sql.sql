-- Private Supabase Realtime presence/typing for 18+ paid conversation members.
-- A narrowly scoped private helper sees cross-member blocks while returning only yes/no.
CREATE OR REPLACE FUNCTION ccx_internal.can_access_chat_topic(p_topic text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_uid uuid := auth.uid(); conversation_uuid uuid;
BEGIN
 IF current_uid IS NULL OR p_topic IS NULL OR p_topic !~
   '^ccx-chat:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
 conversation_uuid := split_part(p_topic,':',2)::uuid;
 IF NOT EXISTS (SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id=conversation_uuid AND cm.user_id=current_uid) THEN RETURN false; END IF;
 IF EXISTS (SELECT 1 FROM public.account_security s WHERE s.user_id=current_uid AND (s.banned OR s.suspended)) THEN RETURN false; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.member_subscriptions s WHERE s.user_id=current_uid
  AND s.status IN ('active','trial') AND (s.period_end IS NULL OR s.period_end>now())) THEN RETURN false; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.age_verification_requests av WHERE av.user_id=current_uid
  AND av.id=(SELECT newer.id FROM public.age_verification_requests newer
   WHERE newer.user_id=current_uid ORDER BY newer.created_at DESC LIMIT 1)
  AND av.status='approved' AND (av.expires_at IS NULL OR av.expires_at>now())) THEN RETURN false; END IF;
 IF EXISTS (
  SELECT 1 FROM public.conversation_members other
  JOIN public.member_blocks b ON (b.blocker_id=current_uid AND b.blocked_id=other.user_id)
    OR (b.blocked_id=current_uid AND b.blocker_id=other.user_id)
  WHERE other.conversation_id=conversation_uuid
 ) THEN RETURN false; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION ccx_internal.can_access_chat_topic(text) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA ccx_internal TO authenticated;
GRANT EXECUTE ON FUNCTION ccx_internal.can_access_chat_topic(text) TO authenticated;
CREATE POLICY ccx_private_chat_presence_receive ON realtime.messages
 FOR SELECT TO authenticated
 USING (extension IN ('broadcast','presence') AND
  (SELECT ccx_internal.can_access_chat_topic((SELECT realtime.topic()))));
CREATE POLICY ccx_private_chat_presence_send ON realtime.messages
 FOR INSERT TO authenticated
 WITH CHECK (extension IN ('broadcast','presence') AND
  (SELECT ccx_internal.can_access_chat_topic((SELECT realtime.topic()))));