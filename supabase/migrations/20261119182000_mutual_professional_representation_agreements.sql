-- Mutual, versioned professional representation agreements. No background consent.
-- Preserve old roster history; no automatic conversion into signed representation.
ALTER TABLE public.member_representations
 ADD COLUMN IF NOT EXISTS agreement_terms jsonb,
 ADD COLUMN IF NOT EXISTS agreement_hash text,
 ADD COLUMN IF NOT EXISTS offered_by uuid REFERENCES auth.users(id),
 ADD COLUMN IF NOT EXISTS agreed_by_representative_at timestamptz,
 ADD COLUMN IF NOT EXISTS agreed_by_professional_at timestamptz,
 ADD COLUMN IF NOT EXISTS starts_at timestamptz,
 ADD COLUMN IF NOT EXISTS expires_at timestamptz,
 ADD COLUMN IF NOT EXISTS notice_days integer NOT NULL DEFAULT 30,
 ADD COLUMN IF NOT EXISTS termination_notice_at timestamptz,
 ADD COLUMN IF NOT EXISTS termination_effective_at timestamptz,
 ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
 ADD COLUMN IF NOT EXISTS agreement_version integer NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS pending_renewal_terms jsonb,
 ADD COLUMN IF NOT EXISTS pending_renewal_hash text,
 ADD COLUMN IF NOT EXISTS pending_renewal_by uuid REFERENCES auth.users(id);
CREATE TABLE IF NOT EXISTS public.ccx_representation_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 representation_id uuid NOT NULL REFERENCES public.member_representations(id) ON DELETE RESTRICT,
 actor_id uuid REFERENCES auth.users(id), event_type text NOT NULL,
 agreement_hash text,metadata jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ccx_representation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ccx_representation_events FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.ccx_rep_event_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $f$
BEGIN RAISE EXCEPTION 'Representation audit history cannot be rewritten'; END $f$;
DROP TRIGGER IF EXISTS ccx_rep_event_lock ON public.ccx_representation_events;
CREATE TRIGGER ccx_rep_event_lock BEFORE UPDATE OR DELETE ON public.ccx_representation_events
 FOR EACH ROW EXECUTE FUNCTION public.ccx_rep_event_immutable();
-- ALL callers (including older roster RPCs) must have two accepted, hashed terms
-- before promoting a new roster request. Existing active relationships stay intact.
CREATE OR REPLACE FUNCTION public.ccx_rep_activation_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $f$
BEGIN
 IF OLD.status='active' AND NEW.status='ended' AND OLD.relationship_type='roster'
    AND OLD.agreement_hash IS NOT NULL AND OLD.expires_at>now()
    AND coalesce(OLD.termination_effective_at,OLD.expires_at)>now()
    AND coalesce(current_setting('ccx.representation_safety_exit',true),'') <> '1' THEN
  RAISE EXCEPTION 'Use the agreed notice period, or immediate safety exit' USING ERRCODE='42501';
 END IF;
 IF OLD.status <> 'active' AND NEW.status='active' AND NEW.relationship_type='roster' THEN
  IF NEW.agreement_terms IS NULL OR NEW.agreement_hash IS NULL
   OR NEW.agreed_by_representative_at IS NULL OR NEW.agreed_by_professional_at IS NULL
   OR NEW.expires_at IS NULL OR NEW.expires_at<=now() THEN
   RAISE EXCEPTION 'Both parties must accept the representation terms' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS ccx_rep_activation_required ON public.member_representations;
CREATE TRIGGER ccx_rep_activation_required BEFORE UPDATE OF status ON public.member_representations
 FOR EACH ROW EXECUTE FUNCTION public.ccx_rep_activation_guard();
-- Internal helper: compliance housekeeping runs without arbitrary user-originated data.
CREATE OR REPLACE FUNCTION ccx_workspace_private.ccx_representation_expiry_tick()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE item record;
BEGIN
 FOR item IN
   UPDATE public.member_representations
      SET status='ended',ended_at=now()
    WHERE status='active' AND ((expires_at IS NOT NULL AND expires_at<=now())
      OR (termination_effective_at IS NOT NULL AND termination_effective_at<=now()))
    RETURNING id,creator_id,representative_id,agreement_hash
 LOOP
   INSERT INTO public.ccx_representation_events(representation_id,event_type,agreement_hash)
   VALUES(item.id,'term_ended',item.agreement_hash);
   INSERT INTO public.member_notifications(recipient_id,kind,title,details) VALUES
     (item.creator_id,'representation_update','Your representation agreement ended',jsonb_build_object('representation_id',item.id)),
     (item.representative_id,'representation_update','Your representation agreement ended',jsonb_build_object('representation_id',item.id));
 END LOOP;
 FOR item IN
   UPDATE public.member_representations SET reminder_sent_at=now()
   WHERE status='active' AND expires_at IS NOT NULL
     AND expires_at>now() AND expires_at<=now()+interval '30 days' AND reminder_sent_at IS NULL
   RETURNING id,creator_id,representative_id,expires_at
 LOOP
   INSERT INTO public.member_notifications(recipient_id,kind,title,details) VALUES
     (item.creator_id,'representation_expiring','Representation expires within 30 days',jsonb_build_object('representation_id',item.id,'expires_at',item.expires_at)),
     (item.representative_id,'representation_expiring','Representation expires within 30 days',jsonb_build_object('representation_id',item.id,'expires_at',item.expires_at));
 END LOOP;
END $f$;
REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_representation_expiry_tick() FROM PUBLIC,anon,authenticated;
-- The public wrapper does not grant table access. The private function derives the
-- actor from auth.uid(), verifies role/membership, locks rows, and logs every action.
CREATE OR REPLACE FUNCTION ccx_workspace_private.ccx_representation_agreement_action(
 p_action text,p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE
 u uuid:=auth.uid(); own_role text; other_id uuid; other_role text;
 representative uuid; professional uuid; row public.member_representations;
 agreement jsonb; scope text; months int; notice int; pct numeric; exclusive_flag boolean;
 h text; result jsonb; effective timestamptz; ready boolean;
BEGIN
 IF u IS NULL OR NOT public.ccx_workspace_allowed() THEN
  RAISE EXCEPTION 'Verified account required' USING ERRCODE='42501';
 END IF;
 SELECT role_type INTO own_role FROM public.member_profiles WHERE id=u;
 IF p_action='list' THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object(
     'id',x.id,'status',case when x.status='active' AND (x.expires_at<=now() OR x.termination_effective_at<=now()) THEN 'ended' ELSE x.status END,
     'is_representative',x.representative_id=u,'requested_by_me',x.offered_by=u,
     'other_id',p.id,'other_name',p.display_name,'other_role',p.role_type,
     'agreement',x.agreement_terms,'agreement_hash',x.agreement_hash,'version',x.agreement_version,
     'my_accepted',CASE WHEN x.representative_id=u THEN x.agreed_by_representative_at IS NOT NULL ELSE x.agreed_by_professional_at IS NOT NULL END,
     'other_accepted',CASE WHEN x.representative_id=u THEN x.agreed_by_professional_at IS NOT NULL ELSE x.agreed_by_representative_at IS NOT NULL END,
     'starts_at',x.starts_at,'expires_at',x.expires_at,'notice_at',x.termination_notice_at,
     'notice_effective_at',x.termination_effective_at,'renewal_pending',x.pending_renewal_terms IS NOT NULL,
     'renewal_hash',x.pending_renewal_hash,'renewal_by_me',x.pending_renewal_by=u,'renewal_terms',x.pending_renewal_terms,'created_at',x.created_at)
     ORDER BY x.created_at DESC),'[]'::jsonb) INTO result
   FROM public.member_representations x JOIN public.member_profiles p
     ON p.id=CASE WHEN x.representative_id=u THEN x.creator_id ELSE x.representative_id END
   WHERE (x.representative_id=u OR x.creator_id=u) AND x.relationship_type='roster';
   RETURN jsonb_build_object('items',result);
 ELSIF p_action='request' THEN
   IF own_role IN('agent','studio') THEN
     representative:=u; professional:=(p_data->>'target_id')::uuid;
   ELSIF own_role IN('creator','photographer','videographer','video_editor') THEN
     professional:=u; representative:=(p_data->>'target_id')::uuid;
   ELSE RAISE EXCEPTION 'Role cannot request representation' USING ERRCODE='42501'; END IF;
   IF representative IS NULL OR professional IS NULL OR representative=professional THEN RAISE EXCEPTION 'Invalid representation target'; END IF;
   SELECT role_type INTO other_role FROM public.member_profiles WHERE id=CASE WHEN u=representative THEN professional ELSE representative END;
   IF (u=representative AND other_role NOT IN('creator','photographer','videographer','video_editor'))
     OR (u=professional AND other_role NOT IN('agent','studio')) THEN RAISE EXCEPTION 'Incompatible professional role'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=CASE WHEN u=representative THEN professional ELSE representative END)
      OR NOT EXISTS(SELECT 1 FROM public.account_security WHERE user_id=CASE WHEN u=representative THEN professional ELSE representative END AND NOT banned AND NOT suspended)
      OR EXISTS(SELECT 1 FROM public.member_blocks WHERE (blocker_id=representative AND blocked_id=professional) OR(blocked_id=representative AND blocker_id=professional))
      THEN RAISE EXCEPTION 'Professional unavailable' USING ERRCODE='42501'; END IF;
   scope:=trim(coalesce(p_data->>'scope',''));
   IF length(scope)<10 OR length(scope)>4000 THEN RAISE EXCEPTION 'Describe the scope of representation (10-4000 characters)'; END IF;
   IF coalesce(p_data->>'months','') !~ '^[0-9]{1,2}$'
      OR coalesce(p_data->>'notice_days','') !~ '^[0-9]{1,2}$'
      OR coalesce(p_data->>'commission_pct','') !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$'
   THEN RAISE EXCEPTION 'Invalid term, notice, or commission'; END IF;
   months:=(p_data->>'months')::int;notice:=(p_data->>'notice_days')::int;pct:=(p_data->>'commission_pct')::numeric;
   IF months<1 OR months>24 OR notice<0 OR notice>90 OR pct<0 OR pct>100 THEN RAISE EXCEPTION 'Representation terms out of range'; END IF;
   exclusive_flag:=p_data->>'exclusive'='true';
   agreement:=jsonb_build_object('scope',scope,'term_months',months,'notice_days',notice,'commission_pct',pct,'exclusive',exclusive_flag,
      'version',1,'changes_require_mutual_acceptance',true,'safety_and_consent_withdrawal_unrestricted',true);
   h:=encode(sha256(convert_to(agreement::text,'UTF8')),'hex');
   INSERT INTO public.member_representations(representative_id,creator_id,representative_role,relationship_type,status,offered_by,
      agreement_terms,agreement_hash,notice_days,agreed_by_representative_at,agreed_by_professional_at)
   VALUES(representative,professional,(SELECT role_type FROM public.member_profiles WHERE id=representative),
     'roster','pending',u,agreement,h,notice,
     CASE WHEN u=representative THEN now() END,CASE WHEN u=professional THEN now() END)
   RETURNING * INTO row;
   INSERT INTO public.ccx_representation_events(representation_id,actor_id,event_type,agreement_hash)
     VALUES(row.id,u,'offer',h);
   INSERT INTO public.member_notifications(recipient_id,kind,title,details)
     VALUES(CASE WHEN u=representative THEN professional ELSE representative END,'representation_update',
       'Representation terms awaiting your acceptance',jsonb_build_object('representation_id',row.id));
 ELSIF p_action IN('accept','decline','give_notice','end_for_safety','request_renewal','accept_renewal') THEN
   SELECT * INTO row FROM public.member_representations
    WHERE id=(p_data->>'id')::uuid AND (creator_id=u OR representative_id=u) AND relationship_type='roster' FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Representation unavailable' USING ERRCODE='42501'; END IF;
   IF p_action='accept' THEN
     IF row.status<>'pending' OR row.agreement_hash IS NULL OR p_data->>'terms_hash' IS DISTINCT FROM row.agreement_hash THEN
       RAISE EXCEPTION 'Agreement changed or no longer pending'; END IF;
     IF u=row.representative_id AND row.agreed_by_representative_at IS NOT NULL OR
        u=row.creator_id AND row.agreed_by_professional_at IS NOT NULL THEN
       RAISE EXCEPTION 'You already accepted these terms'; END IF;
     UPDATE public.member_representations SET
       agreed_by_representative_at=CASE WHEN u=representative_id THEN now() ELSE agreed_by_representative_at END,
       agreed_by_professional_at=CASE WHEN u=creator_id THEN now() ELSE agreed_by_professional_at END,
       status='active',
       starts_at=now(),expires_at=now()+make_interval(months=>(agreement_terms->>'term_months')::int)
     WHERE id=row.id AND
       ((u=representative_id AND agreed_by_professional_at IS NOT NULL) OR (u=creator_id AND agreed_by_representative_at IS NOT NULL))
     RETURNING * INTO row;
     IF NOT FOUND THEN RAISE EXCEPTION 'The other party has not accepted the terms'; END IF;
     -- Requester acceptance is recorded at offer creation; responder activates.
   ELSIF p_action='decline' THEN
     IF row.status<>'pending' THEN RAISE EXCEPTION 'Not awaiting acceptance'; END IF;
     UPDATE public.member_representations SET status='declined',responded_at=now()
      WHERE id=row.id RETURNING * INTO row;
   ELSIF p_action='request_renewal' THEN
     IF row.status<>'active' OR row.expires_at<=now() OR row.termination_notice_at IS NOT NULL THEN RAISE EXCEPTION 'Renewal is unavailable'; END IF;
     IF coalesce(p_data->>'months','') !~ '^[0-9]{1,2}
     IF row.status<>'active' OR row.termination_notice_at IS NOT NULL THEN RAISE EXCEPTION 'Not eligible for a new termination notice'; END IF;
     effective:=least(coalesce(row.expires_at,now()),now()+make_interval(days=>row.notice_days));
     UPDATE public.member_representations SET termination_notice_at=now(),termination_effective_at=effective
       WHERE id=row.id RETURNING * INTO row;
   ELSE
     IF row.status NOT IN('pending','active') THEN RAISE EXCEPTION 'Representation is already closed'; END IF;
     PERFORM set_config('ccx.representation_safety_exit','1',true);
     UPDATE public.member_representations SET status='ended',ended_at=now(),termination_notice_at=now(),
       termination_effective_at=now() WHERE id=row.id RETURNING * INTO row;
   END IF;
   INSERT INTO public.ccx_representation_events(representation_id,actor_id,event_type,agreement_hash)
    VALUES(row.id,u,p_action,row.agreement_hash);
   INSERT INTO public.member_notifications(recipient_id,kind,title,details)
     VALUES(CASE WHEN u=row.representative_id THEN row.creator_id ELSE row.representative_id END,
       'representation_update','Representation agreement updated',jsonb_build_object('representation_id',row.id,'action',p_action));
 ELSE RAISE EXCEPTION 'Unsupported representation action'; END IF;
 RETURN jsonb_build_object('item',jsonb_build_object('id',row.id,'status',row.status,'agreement_hash',row.agreement_hash,'expires_at',row.expires_at));
END $f$;
CREATE OR REPLACE FUNCTION public.ccx_representation_agreement_action(p_action text,p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $f$
 SELECT ccx_workspace_private.ccx_representation_agreement_action(p_action,p_data)
$f$;
REVOKE ALL ON FUNCTION public.ccx_representation_agreement_action(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ccx_representation_agreement_action(text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_representation_agreement_action(text,jsonb) FROM PUBLIC,anon,authenticated;
-- Real expiration and reminders; does not renew consent without both users.
SELECT cron.schedule('ccx-representation-expiry-v1','0 3 * * *',
 'SELECT ccx_workspace_private.ccx_representation_expiry_tick()');
 THEN RAISE EXCEPTION 'Invalid renewal term'; END IF;
     months:=(p_data->>'months')::int;
     IF months<1 OR months>24 THEN RAISE EXCEPTION 'Renewal term must be 1–24 months'; END IF;
     agreement:=(row.agreement_terms||jsonb_build_object('term_months',months,'version',row.agreement_version+1));
     h:=encode(sha256(convert_to(agreement::text,'UTF8')),'hex');
     UPDATE public.member_representations SET pending_renewal_terms=agreement,pending_renewal_hash=h,pending_renewal_by=u WHERE id=row.id RETURNING * INTO row;
   ELSIF p_action='accept_renewal' THEN
     IF row.status<>'active' OR row.pending_renewal_terms IS NULL OR row.pending_renewal_hash IS NULL OR row.pending_renewal_by=u
       OR p_data->>'terms_hash' IS DISTINCT FROM row.pending_renewal_hash THEN RAISE EXCEPTION 'No matching renewal proposal'; END IF;
     INSERT INTO public.ccx_representation_events(representation_id,actor_id,event_type,agreement_hash,metadata)
       VALUES(row.id,u,'prior_terms',row.agreement_hash,jsonb_build_object('version',row.agreement_version,'terms',row.agreement_terms));
     UPDATE public.member_representations SET agreement_terms=row.pending_renewal_terms,agreement_hash=row.pending_renewal_hash,
       agreement_version=row.agreement_version+1,starts_at=now(),expires_at=now()+make_interval(months=>(row.pending_renewal_terms->>'term_months')::int),
       agreed_by_professional_at=now(),agreed_by_representative_at=now(),reminder_sent_at=NULL,
       pending_renewal_terms=NULL,pending_renewal_hash=NULL,pending_renewal_by=NULL
       WHERE id=row.id RETURNING * INTO row;
   ELSIF p_action='give_notice' THEN
     IF row.status<>'active' OR row.termination_notice_at IS NOT NULL THEN RAISE EXCEPTION 'Not eligible for a new termination notice'; END IF;
     effective:=least(coalesce(row.expires_at,now()),now()+make_interval(days=>row.notice_days));
     UPDATE public.member_representations SET termination_notice_at=now(),termination_effective_at=effective
       WHERE id=row.id RETURNING * INTO row;
   ELSE
     IF row.status NOT IN('pending','active') THEN RAISE EXCEPTION 'Representation is already closed'; END IF;
     UPDATE public.member_representations SET status='ended',ended_at=now(),termination_notice_at=now(),
       termination_effective_at=now() WHERE id=row.id RETURNING * INTO row;
   END IF;
   INSERT INTO public.ccx_representation_events(representation_id,actor_id,event_type,agreement_hash)
    VALUES(row.id,u,p_action,row.agreement_hash);
   INSERT INTO public.member_notifications(recipient_id,kind,title,details)
     VALUES(CASE WHEN u=row.representative_id THEN row.creator_id ELSE row.representative_id END,
       'representation_update','Representation agreement updated',jsonb_build_object('representation_id',row.id,'action',p_action));
 ELSE RAISE EXCEPTION 'Unsupported representation action'; END IF;
 RETURN jsonb_build_object('item',jsonb_build_object('id',row.id,'status',row.status,'agreement_hash',row.agreement_hash,'expires_at',row.expires_at));
END $f$;
CREATE OR REPLACE FUNCTION public.ccx_representation_agreement_action(p_action text,p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$
 SELECT ccx_workspace_private.ccx_representation_agreement_action(p_action,p_data)
$f$;
REVOKE ALL ON FUNCTION public.ccx_representation_agreement_action(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ccx_representation_agreement_action(text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_representation_agreement_action(text,jsonb) FROM PUBLIC,anon,authenticated;
-- Real expiration and reminders; does not renew consent without both users.
SELECT cron.schedule('ccx-representation-expiry-v1','0 3 * * *',
 'SELECT ccx_workspace_private.ccx_representation_expiry_tick()');
