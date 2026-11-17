-- Keep private presence membership checks in sync with REST premium-chat rules,
-- including admin accounts protected by AAL2.
CREATE OR REPLACE FUNCTION ccx_internal.can_access_chat_topic(p_topic text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_uid uuid:=auth.uid(); conversation_uuid uuid;
BEGIN
 IF current_uid IS NULL OR p_topic IS NULL OR p_topic !~
   '^ccx-chat:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
 IF NOT ccx_internal.can_read_premium_chat() THEN RETURN false; END IF;
 conversation_uuid:=split_part(p_topic,':',2)::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.conversation_members cm
   WHERE cm.conversation_id=conversation_uuid AND cm.user_id=current_uid) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.conversation_members other
   JOIN public.member_blocks b ON (b.blocker_id=current_uid AND b.blocked_id=other.user_id)
    OR (b.blocked_id=current_uid AND b.blocker_id=other.user_id)
   WHERE other.conversation_id=conversation_uuid) THEN RETURN false; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION ccx_internal.can_access_chat_topic(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION ccx_internal.can_access_chat_topic(text) TO authenticated;