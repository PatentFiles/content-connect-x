-- Restricted report follow-up and MFA-gated case claiming.
-- Does not activate public submissions or authorise automatic content removal.
ALTER TABLE public.ccx_trust_requests
 ADD COLUMN IF NOT EXISTS assigned_reviewer_id uuid REFERENCES auth.users(id),
 ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
CREATE INDEX IF NOT EXISTS ccx_trust_assigned_idx
 ON public.ccx_trust_requests(assigned_reviewer_id,status,due_at)
 WHERE status<>'resolved';

-- A reference number alone grants NO status access. The reporter must also
-- supply the separate v4 UUID idempotency key from the original receipt.
-- Only server-side Edge Functions hold EXECUTE. Nothing returns case payload,
-- reporter email, identity, review notes or evidence.
CREATE OR REPLACE FUNCTION ccx_workspace_private.ccx_trust_reporter_status(
 p_reference uuid,p_access_code uuid,p_rate_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE item public.ccx_trust_requests; n integer;
BEGIN
 IF p_reference IS NULL OR p_access_code IS NULL
    OR p_rate_key IS NULL OR p_rate_key !~ '^[a-f0-9]{64}$' THEN
   RAISE EXCEPTION 'Invalid private case lookup' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.ccx_trust_rate_limits(bucket_key,window_start,hits)
 VALUES('status:'||p_rate_key,date_trunc('hour',now()),1)
 ON CONFLICT (bucket_key,window_start) DO UPDATE SET hits=public.ccx_trust_rate_limits.hits+1
 RETURNING hits INTO n;
 IF n>12 THEN
   RAISE EXCEPTION 'Status check rate limit reached' USING ERRCODE='54000';
 END IF;
 SELECT * INTO item FROM public.ccx_trust_requests
 WHERE id=p_reference AND idempotency_key=p_access_code;
 IF NOT FOUND THEN
   RETURN jsonb_build_object('verified',false);
 END IF;
 INSERT INTO public.ccx_trust_request_events(request_id,action)
 VALUES(item.id,'reporter_status_checked');
 RETURN jsonb_build_object('verified',true,'status',item.status,
   'created_at',item.created_at,'updated_at',coalesce(item.reviewed_at,item.created_at),
   'message',CASE item.status
      WHEN 'pending' THEN 'Your report is recorded and waiting for review.'
      WHEN 'reviewing' THEN 'A reviewer is assessing your report.'
      WHEN 'action_required' THEN 'The case needs further action by the review team.'
      ELSE 'The case was marked resolved. Use the contact channel with your reference if you need clarification or wish to appeal.'
    END);
END $fn$;

REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_trust_reporter_status(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ccx_workspace_private.ccx_trust_reporter_status(uuid,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.ccx_trust_reporter_status(
 p_reference uuid,p_access_code uuid,p_rate_key text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$
 SELECT ccx_workspace_private.ccx_trust_reporter_status(p_reference,p_access_code,p_rate_key)
$fn$;
REVOKE ALL ON FUNCTION public.ccx_trust_reporter_status(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_trust_reporter_status(uuid,uuid,text) TO service_role;

-- Staff queue includes assignment and overdue indicators only; case contents
-- remain available through the existing audited MFA-gated read action.
CREATE OR REPLACE FUNCTION ccx_workspace_private.ccx_trust_triage(
 p_action text DEFAULT 'list', p_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE u uuid:=auth.uid();item public.ccx_trust_requests;rows jsonb;
BEGIN
 IF u IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.account_security
     WHERE user_id=u AND admin AND NOT banned AND NOT suspended
 ) OR coalesce(auth.jwt()->>'aal','')<>'aal2' THEN
  RAISE EXCEPTION 'Verified staff and two-factor authentication required'
    USING ERRCODE='42501';
 END IF;
 IF p_action='list' THEN
  INSERT INTO public.ccx_trust_request_events(actor_id,action)
  VALUES(u,'triage_queue_viewed');
  SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) INTO rows
  FROM (
    SELECT id,kind,status,priority,created_at,due_at,
      assigned_reviewer_id,assigned_at,
      (status<>'resolved' AND due_at IS NOT NULL AND due_at<now()) AS overdue
    FROM public.ccx_trust_requests
    ORDER BY CASE WHEN status='resolved' THEN 1 ELSE 0 END,
      CASE WHEN status<>'resolved' AND due_at<now() THEN 0 ELSE 1 END,
      CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
      created_at
    LIMIT 100
  ) q;
  RETURN jsonb_build_object('items',rows);
 ELSIF p_action IN('claim','release') THEN
  IF p_id IS NULL THEN RAISE EXCEPTION 'Case required' USING ERRCODE='22023';END IF;
  SELECT * INTO item FROM public.ccx_trust_requests WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case unavailable' USING ERRCODE='42501';END IF;
  IF item.status='resolved' THEN RAISE EXCEPTION 'Resolved cases cannot be claimed'
    USING ERRCODE='42501';END IF;
  IF p_action='claim' THEN
   IF item.assigned_reviewer_id IS NOT NULL AND item.assigned_reviewer_id<>u THEN
    RAISE EXCEPTION 'Case already assigned to another reviewer' USING ERRCODE='42501';END IF;
   IF item.assigned_reviewer_id IS NULL THEN
    UPDATE public.ccx_trust_requests
    SET assigned_reviewer_id=u,assigned_at=now() WHERE id=p_id;
    INSERT INTO public.ccx_trust_request_events(request_id,actor_id,action)
    VALUES(p_id,u,'case_claimed');
   END IF;
  ELSE
   IF item.assigned_reviewer_id IS DISTINCT FROM u THEN
    RAISE EXCEPTION 'Only the assigned reviewer can release a case' USING ERRCODE='42501';END IF;
   UPDATE public.ccx_trust_requests
    SET assigned_reviewer_id=NULL,assigned_at=NULL WHERE id=p_id;
   INSERT INTO public.ccx_trust_request_events(request_id,actor_id,action)
    VALUES(p_id,u,'case_released');
  END IF;
  RETURN jsonb_build_object('ok',true);
 END IF;
 RAISE EXCEPTION 'Unknown triage action' USING ERRCODE='22023';
END $fn$;
REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_trust_triage(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION ccx_workspace_private.ccx_trust_triage(text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.ccx_trust_triage(p_action text DEFAULT 'list',p_id uuid DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$
 SELECT ccx_workspace_private.ccx_trust_triage(p_action,p_id)
$fn$;
REVOKE ALL ON FUNCTION public.ccx_trust_triage(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ccx_trust_triage(text,uuid) TO authenticated;

COMMENT ON FUNCTION public.ccx_trust_reporter_status(uuid,uuid,text)
 IS 'Server-only reference PLUS private code lookup. Never exposes case details or accepts public account claims.';
COMMENT ON FUNCTION public.ccx_trust_triage(text,uuid)
 IS 'MFA-gated staff queue and claim/release. Case creation, review and lawful disclosures are independent.';
NOTIFY pgrst,'reload schema';
