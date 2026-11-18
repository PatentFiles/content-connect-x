-- Enterprise integrity fixes. No account admissions, roles or provider gates change.
SET lock_timeout = '3s';
ALTER TABLE public.hosting_notification_outbox
 ADD COLUMN IF NOT EXISTS lease_token uuid,
 ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS hosting_outbox_expired_lease_idx
 ON public.hosting_notification_outbox(lease_expires_at) WHERE status='processing';

-- Service-only invoker functions; never allow a browser to choose p_actor.
CREATE OR REPLACE FUNCTION public.ccx_claim_hosting_notifications(p_channels text[],p_limit integer DEFAULT 3)
RETURNS SETOF public.hosting_notification_outbox LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF p_channels IS NULL OR NOT(p_channels <@ ARRAY['email','push']::text[]) OR p_limit NOT BETWEEN 1 AND 10 THEN
  RAISE EXCEPTION 'Invalid notification batch';
 END IF;
 RETURN QUERY WITH due AS (
  SELECT o.id FROM public.hosting_notification_outbox o
  WHERE o.channel=ANY(p_channels) AND o.attempts<5 AND (
    o.status IN('queued','failed') AND o.next_attempt_at<=now() OR
    o.status='processing' AND coalesce(o.lease_expires_at,o.created_at+interval '10 minutes')<=now()
  ) ORDER BY o.next_attempt_at,o.id FOR UPDATE SKIP LOCKED LIMIT p_limit
 ) UPDATE public.hosting_notification_outbox o SET status='processing',attempts=o.attempts+1,
   lease_token=gen_random_uuid(),lease_expires_at=now()+interval '5 minutes'
   FROM due WHERE o.id=due.id RETURNING o.*;
 -- An expired final attempt must not stay in an eternal processing state.
 UPDATE public.hosting_notification_outbox SET status='failed',lease_token=NULL,lease_expires_at=NULL,
  last_error='Delivery attempt interrupted; retry limit reached'
  WHERE status='processing' AND attempts>=5 AND lease_expires_at<now();
END $$;
REVOKE ALL ON FUNCTION public.ccx_claim_hosting_notifications(text[],integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_claim_hosting_notifications(text[],integer) TO service_role;

CREATE OR REPLACE FUNCTION public.ccx_finish_hosting_notification(p_id uuid,p_lease uuid,p_status text,p_remote text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE job public.hosting_notification_outbox;
BEGIN
 IF p_status NOT IN('delivered','failed','disabled') OR p_status IS NULL THEN RAISE EXCEPTION 'Invalid notification state';END IF;
 SELECT * INTO job FROM public.hosting_notification_outbox WHERE id=p_id AND status='processing'
  AND lease_token=p_lease AND lease_expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 UPDATE public.hosting_notification_outbox SET status=p_status,lease_token=NULL,lease_expires_at=NULL,
  sent_at=CASE WHEN p_status='delivered' THEN now() ELSE sent_at END,
  next_attempt_at=CASE WHEN p_status='failed' THEN now()+make_interval(mins=>least(60,power(2,job.attempts)::integer)) ELSE next_attempt_at END,
  last_error=CASE WHEN p_status='failed' THEN 'Delivery attempt failed' ELSE NULL END
 WHERE id=p_id;
 IF p_status='delivered' THEN
  INSERT INTO public.hosting_notification_delivery_log(outbox_id,delivery_provider,remote_message_id)
   VALUES(p_id,job.channel,left(p_remote,200));
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ccx_finish_hosting_notification(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_finish_hosting_notification(uuid,uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.ccx_respond_collaboration_invitation(p_actor uuid,p_invitation uuid,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE invite public.collaboration_invitations; project public.collaborations; sec public.account_security;
BEGIN
 IF p_actor IS NULL OR p_status IS NULL OR p_status NOT IN('accepted','declined') THEN RAISE EXCEPTION 'Invalid invitation response';END IF;
 SELECT * INTO sec FROM public.account_security WHERE user_id=p_actor;
 IF NOT FOUND OR sec.banned OR sec.suspended OR NOT EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=p_actor) THEN
  RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';
 END IF;
 SELECT * INTO invite FROM public.collaboration_invitations WHERE id=p_invitation FOR UPDATE;
 IF NOT FOUND OR invite.invitee_id<>p_actor THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='42501';END IF;
 IF invite.status<>'pending' THEN RAISE EXCEPTION 'Invitation already handled' USING ERRCODE='40001';END IF;
 IF p_status='accepted' THEN
  SELECT * INTO project FROM public.collaborations WHERE id=invite.collaboration_id FOR SHARE;
  IF NOT FOUND OR project.status IN('completed','cancelled','archived','closed') OR project.creator_id<>invite.invited_by THEN
   RAISE EXCEPTION 'Collaboration unavailable' USING ERRCODE='42501';END IF;
  IF NOT sec.admin AND NOT EXISTS(SELECT 1 FROM public.member_subscriptions WHERE user_id=p_actor
    AND status IN('active','trial') AND(period_end IS NULL OR period_end>now())) THEN
   RAISE EXCEPTION 'Membership required' USING ERRCODE='42501';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.account_security s JOIN public.member_admissions a ON a.user_id=s.user_id
    WHERE s.user_id=project.creator_id AND NOT s.banned AND NOT s.suspended) OR EXISTS(
    SELECT 1 FROM public.member_blocks WHERE(blocker_id=p_actor AND blocked_id=project.creator_id)
      OR(blocked_id=p_actor AND blocker_id=project.creator_id)) THEN
   RAISE EXCEPTION 'Collaboration unavailable' USING ERRCODE='42501';END IF;
  INSERT INTO public.collaboration_members(collaboration_id,user_id,membership_role)
   VALUES(invite.collaboration_id,p_actor,'participant') ON CONFLICT(collaboration_id,user_id) DO NOTHING;
 END IF;
 UPDATE public.collaboration_invitations SET status=p_status,responded_at=now() WHERE id=p_invitation;
 INSERT INTO public.member_notifications(recipient_id,kind,title,details)
  VALUES(invite.invited_by,'collaboration_invite','Collaboration invitation '||p_status,jsonb_build_object('collaboration_id',invite.collaboration_id));
 INSERT INTO public.platform_action_audit(actor_id,action,target_type,target_id,metadata)
  VALUES(p_actor,'respond_invitation','invitation',p_invitation,jsonb_build_object('status',p_status));
 RETURN jsonb_build_object('id',p_invitation,'status',p_status);
END $$;
REVOKE ALL ON FUNCTION public.ccx_respond_collaboration_invitation(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_respond_collaboration_invitation(uuid,uuid,text) TO service_role;

-- A small database can add missing FK indexes safely. Never block a large live
-- relation: leave it for a separately scheduled CREATE INDEX CONCURRENTLY run.
DO $indexes$
DECLARE fk record; columns_sql text; index_name text;
BEGIN
 FOR fk IN
  SELECT c.oid,c.conrelid,c.conkey,n.nspname,t.relname FROM pg_constraint c
  JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
  WHERE c.contype='f' AND n.nspname='public' AND NOT EXISTS(
   SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indisvalid AND i.indpred IS NULL
    AND i.indnkeyatts>=cardinality(c.conkey)
    AND ARRAY(SELECT unnest(i.indkey::smallint[]) LIMIT cardinality(c.conkey)) @> c.conkey
  )
 LOOP
  IF pg_relation_size(fk.conrelid)>10485760 THEN RAISE NOTICE 'Schedule concurrent index for %.%',fk.nspname,fk.relname;CONTINUE;END IF;
  SELECT string_agg(format('%I',a.attname),',' ORDER BY x.ordinality) INTO columns_sql
   FROM unnest(fk.conkey) WITH ORDINALITY x(attnum,ordinality)
   JOIN pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=x.attnum;
  index_name:='ccx_fk_'||substr(md5(fk.nspname||'.'||fk.relname||':'||columns_sql),1,20);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',index_name,fk.nspname,fk.relname,columns_sql);
 END LOOP;
END $indexes$;
NOTIFY pgrst,'reload schema';
