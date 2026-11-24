BEGIN;
CREATE TEMP TABLE enterprise_checks(name text,passed boolean);
DO $test$
DECLARE owner_id uuid:=gen_random_uuid(); member_id uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); cid uuid:=gen_random_uuid(); iid uuid:=gen_random_uuid(); claim public.hosting_notification_outbox; jobid uuid; other uuid; result jsonb;
BEGIN
 INSERT INTO auth.users(id,email,created_at,updated_at) VALUES(owner_id,'audit-owner-'||owner_id||'@example.invalid',now(),now()),(member_id,'audit-member-'||member_id||'@example.invalid',now(),now()),(outsider,'audit-outside-'||outsider||'@example.invalid',now(),now());
 INSERT INTO public.account_security(user_id,admin,banned,suspended) VALUES(owner_id,true,false,false),(member_id,true,false,false),(outsider,false,false,false) ON CONFLICT(user_id) DO UPDATE SET admin=excluded.admin;
 INSERT INTO public.member_admissions(user_id,source) VALUES(owner_id,'legacy_admin'),(member_id,'legacy_admin') ON CONFLICT(user_id) DO NOTHING;
 INSERT INTO public.collaborations(id,creator_id,title,status) VALUES(cid,owner_id,'Rollback-only integrity audit','draft');
 -- A stranger invitation must be rejected by the current mutual-connection gate.
 BEGIN
  INSERT INTO public.collaboration_invitations(id,collaboration_id,invited_by,invitee_id) VALUES(iid,cid,owner_id,member_id);
 INSERT INTO enterprise_checks VALUES('stranger_invitation_rejected',false);
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO enterprise_checks VALUES('stranger_invitation_rejected',true); END;
 -- Create only synthetic, transaction-scoped accepted connection data.
 INSERT INTO public.member_connection_requests(requester_id,recipient_id,status,responded_at) VALUES(owner_id,member_id,'accepted',now());
 INSERT INTO public.collaboration_invitations(id,collaboration_id,invited_by,invitee_id) VALUES(iid,cid,owner_id,member_id);
 BEGIN
  PERFORM public.ccx_respond_collaboration_invitation(outsider,iid,'accepted');
  INSERT INTO enterprise_checks VALUES('nonmember_cannot_accept',false);
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO enterprise_checks VALUES('nonmember_cannot_accept',true); END;
 INSERT INTO public.member_blocks(blocker_id,blocked_id) VALUES(owner_id,member_id);
 BEGIN
  PERFORM public.ccx_respond_collaboration_invitation(member_id,iid,'accepted');
  INSERT INTO enterprise_checks VALUES('blocked_member_cannot_accept',false);
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO enterprise_checks VALUES('blocked_member_cannot_accept',true); END;
 INSERT INTO enterprise_checks SELECT 'failed_acceptance_is_atomic',NOT EXISTS(SELECT 1 FROM public.collaboration_members WHERE collaboration_id=cid AND user_id=member_id) AND EXISTS(SELECT 1 FROM public.collaboration_invitations WHERE id=iid AND status='pending');
 DELETE FROM public.member_blocks WHERE blocker_id=owner_id AND blocked_id=member_id;
 result:=public.ccx_respond_collaboration_invitation(member_id,iid,'accepted');
 INSERT INTO enterprise_checks SELECT 'acceptance_membership_status_consistent',result->>'status'='accepted' AND EXISTS(SELECT 1 FROM public.collaboration_members WHERE collaboration_id=cid AND user_id=member_id) AND EXISTS(SELECT 1 FROM public.collaboration_invitations WHERE id=iid AND status='accepted');
 BEGIN
  PERFORM public.ccx_respond_collaboration_invitation(member_id,iid,'declined');
  INSERT INTO enterprise_checks VALUES('conflicting_second_response_rejected',false);
 EXCEPTION WHEN serialization_failure THEN INSERT INTO enterprise_checks VALUES('conflicting_second_response_rejected',true); END;
 INSERT INTO public.hosting_notification_outbox(event_key,recipient_id,channel,template) VALUES('audit-'||gen_random_uuid(),member_id,'email','hosting_booking') RETURNING id INTO jobid;
 SELECT * INTO claim FROM public.ccx_claim_hosting_notifications(ARRAY['email'],1) WHERE id=jobid;
 INSERT INTO enterprise_checks VALUES('claim_has_lease',claim.lease_token IS NOT NULL AND claim.status='processing' AND claim.attempts=1);
 INSERT INTO enterprise_checks SELECT 'second_claim_excludes_live_lease',NOT EXISTS(SELECT 1 FROM public.ccx_claim_hosting_notifications(ARRAY['email'],10) WHERE id=jobid);
 INSERT INTO enterprise_checks SELECT 'stale_token_cannot_finalize',NOT public.ccx_finish_hosting_notification(jobid,gen_random_uuid(),'delivered','fixture');
 UPDATE public.hosting_notification_outbox SET lease_expires_at=now()-interval '1 minute' WHERE id=jobid;
 other:=claim.lease_token;
 SELECT * INTO claim FROM public.ccx_claim_hosting_notifications(ARRAY['email'],10) WHERE id=jobid;
 INSERT INTO enterprise_checks VALUES('abandoned_claim_recovered',claim.lease_token IS NOT NULL AND claim.lease_token<>other AND claim.attempts=2);
 INSERT INTO enterprise_checks SELECT 'old_worker_cannot_complete_new_lease',NOT public.ccx_finish_hosting_notification(jobid,other,'delivered','fixture');
 INSERT INTO enterprise_checks SELECT 'provider_acceptance_persisted',public.ccx_finish_hosting_notification(jobid,claim.lease_token,'delivered','fixture');
 INSERT INTO enterprise_checks SELECT 'one_delivery_log',count(*)=1 FROM public.hosting_notification_delivery_log WHERE outbox_id=jobid;
 INSERT INTO enterprise_checks SELECT 'second_finalize_idempotent',NOT public.ccx_finish_hosting_notification(jobid,claim.lease_token,'delivered','fixture');
 IF EXISTS(SELECT 1 FROM enterprise_checks WHERE passed IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Enterprise regression failure';END IF;
END $test$;
SELECT jsonb_agg(jsonb_build_object('test',name,'passed',passed)) AS checks FROM enterprise_checks;
ROLLBACK;
