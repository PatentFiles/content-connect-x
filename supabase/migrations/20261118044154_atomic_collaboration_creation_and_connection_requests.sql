CREATE OR REPLACE FUNCTION public.ccx_create_collaboration(p_actor uuid,p_title text,p_description text,p_requires_clearance boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE created public.collaborations;
BEGIN
 IF p_actor IS NULL OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 3 AND 200 OR length(coalesce(p_description,''))>4000 THEN RAISE EXCEPTION 'Invalid collaboration';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.account_security s JOIN public.member_admissions a ON a.user_id=s.user_id WHERE s.user_id=p_actor AND NOT s.banned AND NOT s.suspended AND(s.admin OR EXISTS(SELECT 1 FROM public.member_subscriptions m WHERE m.user_id=p_actor AND m.status IN('active','trial') AND(m.period_end IS NULL OR m.period_end>now())))) THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';END IF;
 INSERT INTO public.collaborations(creator_id,title,description,status,requires_work_clearance) VALUES(p_actor,btrim(p_title),coalesce(p_description,''),'draft',coalesce(p_requires_clearance,false)) RETURNING * INTO created;
 INSERT INTO public.collaboration_members(collaboration_id,user_id,membership_role) VALUES(created.id,p_actor,'owner');
 INSERT INTO public.platform_action_audit(actor_id,action,target_type,target_id,metadata) VALUES(p_actor,'create_collaboration','collaboration',created.id,'{}');
 RETURN to_jsonb(created);
END $$;
REVOKE ALL ON FUNCTION public.ccx_create_collaboration(uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_create_collaboration(uuid,text,text,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.ccx_request_connection(p_actor uuid,p_target uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE req public.member_connection_requests;
BEGIN
 IF p_actor IS NULL OR p_target IS NULL OR p_actor=p_target THEN RAISE EXCEPTION 'Invalid connection';END IF;
 -- All requests for the same unordered pair serialize, including opposite directions.
 PERFORM pg_advisory_xact_lock(hashtextextended(least(p_actor::text,p_target::text)||':'||greatest(p_actor::text,p_target::text),0));
 IF(SELECT count(*) FROM public.account_security s JOIN public.member_admissions a ON a.user_id=s.user_id WHERE s.user_id IN(p_actor,p_target) AND NOT s.banned AND NOT s.suspended)<>2 OR EXISTS(SELECT 1 FROM public.member_blocks WHERE(blocker_id=p_actor AND blocked_id=p_target) OR(blocked_id=p_actor AND blocker_id=p_target)) THEN RAISE EXCEPTION 'Member unavailable' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM public.member_connection_requests WHERE status IN('pending','accepted') AND ((requester_id=p_actor AND recipient_id=p_target) OR(requester_id=p_target AND recipient_id=p_actor))) THEN RAISE EXCEPTION 'A connection or pending request already exists' USING ERRCODE='40001';END IF;
 INSERT INTO public.member_connection_requests(requester_id,recipient_id,status,requested_at,responded_at) VALUES(p_actor,p_target,'pending',now(),NULL)
 ON CONFLICT(requester_id,recipient_id) DO UPDATE SET status='pending',requested_at=now(),responded_at=NULL RETURNING * INTO req;
 INSERT INTO public.member_notifications(recipient_id,kind,title,details) VALUES(p_target,'connection_request','New professional connection request',jsonb_build_object('request_id',req.id));
 INSERT INTO public.platform_action_audit(actor_id,action,target_type,target_id,metadata) VALUES(p_actor,'request_connection','connection',req.id,'{}');
 RETURN to_jsonb(req);
END $$;
REVOKE ALL ON FUNCTION public.ccx_request_connection(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_request_connection(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
