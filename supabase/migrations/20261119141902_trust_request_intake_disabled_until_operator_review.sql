-- No public intake until the operator confirms identity, contacts, approved policies and review coverage.
CREATE TABLE public.ccx_trust_settings(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 legal_entity text NOT NULL DEFAULT '',postal_address text NOT NULL DEFAULT '',contact_email text NOT NULL DEFAULT '',
 policies_approved boolean NOT NULL DEFAULT false,reviewer_coverage_confirmed boolean NOT NULL DEFAULT false,
 intake_enabled boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT intake_enabled OR(policies_approved AND reviewer_coverage_confirmed AND length(trim(legal_entity))>1 AND length(trim(postal_address))>5 AND contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
);
INSERT INTO public.ccx_trust_settings(singleton) VALUES(true);
CREATE TABLE public.ccx_trust_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),idempotency_key uuid NOT NULL UNIQUE,
 kind text NOT NULL CHECK(kind IN('ncii','trafficking','csam','privacy','support','copyright','law_enforcement','accessibility','affiliate','appeal','other')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','reviewing','action_required','resolved')),
 priority text NOT NULL CHECK(priority IN('critical','high','normal')),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=16000),
 created_at timestamptz NOT NULL DEFAULT now(),due_at timestamptz,reviewed_at timestamptz,
 resolution_note text NOT NULL DEFAULT '' CHECK(length(resolution_note)<=2000)
);
CREATE INDEX ccx_trust_requests_queue ON public.ccx_trust_requests(status,priority,created_at);
CREATE TABLE public.ccx_trust_request_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,request_id uuid REFERENCES public.ccx_trust_requests(id),
 actor_id uuid REFERENCES auth.users(id),action text NOT NULL,from_status text,to_status text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ccx_trust_request_events_case ON public.ccx_trust_request_events(request_id,created_at);
CREATE TABLE public.ccx_trust_rate_limits(bucket_key text NOT NULL,window_start timestamptz NOT NULL,hits integer NOT NULL,PRIMARY KEY(bucket_key,window_start));
ALTER TABLE public.ccx_trust_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccx_trust_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccx_trust_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccx_trust_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ccx_trust_settings,public.ccx_trust_requests,public.ccx_trust_request_events,public.ccx_trust_rate_limits FROM PUBLIC,anon,authenticated,service_role;
-- Deliberately no browser table policies. Only the narrow routines below access these records.
CREATE FUNCTION public.ccx_trust_public_config() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('ready',intake_enabled,'legal_entity',legal_entity,'postal_address',postal_address,'contact_email',contact_email,'policies_approved',policies_approved) FROM public.ccx_trust_settings WHERE singleton;
$$;
REVOKE ALL ON FUNCTION public.ccx_trust_public_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ccx_trust_public_config() TO anon,authenticated,service_role;
CREATE FUNCTION ccx_workspace_private.ccx_trust_submit(p_payload jsonb,p_rate_key text,p_idempotency uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k text:=p_payload->>'kind';existing_id uuid;new_id uuid;n integer;v text;field_name text;field_limit integer;safe jsonb:='{}';
BEGIN
 IF NOT coalesce((SELECT intake_enabled FROM public.ccx_trust_settings WHERE singleton),false) THEN RAISE EXCEPTION 'Request intake is not activated' USING ERRCODE='55000';END IF;
 IF p_rate_key IS NULL OR p_rate_key !~ '^[a-f0-9]{64}$' OR p_idempotency IS NULL THEN RAISE EXCEPTION 'Invalid request';END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>16000 OR k IS NULL OR k NOT IN('ncii','trafficking','csam','privacy','support','copyright','law_enforcement','accessibility','affiliate','appeal','other') THEN RAISE EXCEPTION 'Invalid request';END IF;
 FOREACH field_name IN ARRAY ARRAY['kind','name','email','locator','details','signature','agency','jurisdiction','case_reference','legal_basis','scope'] LOOP
  IF p_payload ? field_name AND jsonb_typeof(p_payload->field_name)<>'string' THEN RAISE EXCEPTION 'Invalid field';END IF;
  v:=coalesce(p_payload->>field_name,'');
  field_limit:=CASE WHEN field_name IN('details','scope') THEN 4000 WHEN field_name='locator' THEN 3000 ELSE 254 END;
  IF length(v)>field_limit THEN RAISE EXCEPTION 'Field too long';END IF;
  safe:=safe||jsonb_build_object(field_name,trim(v));
 END LOOP;
 IF length(trim(safe->>'details'))<10 THEN RAISE EXCEPTION 'Describe the request';END IF;
 IF (safe->>'email')<>'' AND (safe->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid email';END IF;
 safe:=safe||jsonb_build_object('authorized',coalesce(p_payload->'authorized'='true'::jsonb,false),'good_faith',coalesce(p_payload->'good_faith'='true'::jsonb,false));
 IF k='ncii' AND(length(safe->>'locator')<3 OR length(safe->>'signature')<2 OR length(safe->>'email')<3 OR p_payload->'authorized' IS DISTINCT FROM 'true'::jsonb OR p_payload->'good_faith' IS DISTINCT FROM 'true'::jsonb) THEN RAISE EXCEPTION 'Removal requests need a locator, contact, signature and declarations';END IF;
 IF k='law_enforcement' AND(length(safe->>'email')<3 OR length(safe->>'agency')<2 OR length(safe->>'jurisdiction')<2 OR length(safe->>'case_reference')<2 OR length(safe->>'legal_basis')<5 OR length(safe->>'scope')<5) THEN RAISE EXCEPTION 'Provide agency, jurisdiction, official contact, case reference, legal basis and narrow scope';END IF;
 DELETE FROM public.ccx_trust_rate_limits WHERE window_start<now()-interval '2 days';
 INSERT INTO public.ccx_trust_rate_limits(bucket_key,window_start,hits) VALUES(p_rate_key,date_trunc('hour',now()),1)
 ON CONFLICT(bucket_key,window_start) DO UPDATE SET hits=ccx_trust_rate_limits.hits+1 RETURNING hits INTO n;
 IF n>30 THEN RAISE EXCEPTION 'Request limit reached; use the published contact channel' USING ERRCODE='54000';END IF;
 SELECT id INTO existing_id FROM public.ccx_trust_requests WHERE idempotency_key=p_idempotency;
 IF existing_id IS NOT NULL THEN RETURN jsonb_build_object('received',true,'reference',existing_id);END IF;
 INSERT INTO public.ccx_trust_requests(idempotency_key,kind,priority,payload,due_at)
 VALUES(p_idempotency,k,CASE WHEN k IN('csam','trafficking') THEN 'critical' WHEN k IN('ncii','law_enforcement') THEN 'high' ELSE 'normal' END,safe,CASE WHEN k='ncii' THEN now()+interval '48 hours' ELSE NULL END)
 ON CONFLICT(idempotency_key) DO NOTHING RETURNING id INTO new_id;
 IF new_id IS NULL THEN SELECT id INTO new_id FROM public.ccx_trust_requests WHERE idempotency_key=p_idempotency;
 ELSE INSERT INTO public.ccx_trust_request_events(request_id,action,to_status) VALUES(new_id,'received','pending');END IF;
 RETURN jsonb_build_object('received',true,'reference',new_id);
END;
$$;
REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_trust_submit(jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ccx_workspace_private.ccx_trust_submit(jsonb,text,uuid) TO service_role;
CREATE FUNCTION public.ccx_trust_submit(p_payload jsonb,p_rate_key text,p_idempotency uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT ccx_workspace_private.ccx_trust_submit(p_payload,p_rate_key,p_idempotency); $$;
REVOKE ALL ON FUNCTION public.ccx_trust_submit(jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_trust_submit(jsonb,text,uuid) TO service_role;
CREATE FUNCTION ccx_workspace_private.ccx_trust_review(p_action text DEFAULT 'list',p_id uuid DEFAULT NULL,p_status text DEFAULT NULL,p_note text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();item public.ccx_trust_requests;result jsonb;
BEGIN
 IF u IS NULL OR NOT EXISTS(SELECT 1 FROM public.account_security WHERE user_id=u AND admin AND NOT banned AND NOT suspended) OR coalesce(auth.jwt()->>'aal','')<>'aal2' THEN RAISE EXCEPTION 'A verified staff account with two-factor authentication is required' USING ERRCODE='42501';END IF;
 IF p_action='list' THEN
  INSERT INTO public.ccx_trust_request_events(actor_id,action) VALUES(u,'queue_viewed');
  SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) INTO result FROM(SELECT id,kind,status,priority,created_at,due_at FROM public.ccx_trust_requests ORDER BY CASE WHEN status='resolved' THEN 1 ELSE 0 END,CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,created_at LIMIT 100)q;
  RETURN jsonb_build_object('items',result);
 ELSIF p_action='read' THEN
  SELECT * INTO item FROM public.ccx_trust_requests WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found';END IF;
  INSERT INTO public.ccx_trust_request_events(request_id,actor_id,action) VALUES(p_id,u,'case_viewed');
  RETURN to_jsonb(item)-'idempotency_key';
 ELSIF p_action='update' THEN
  IF p_status IS NULL OR p_status NOT IN('reviewing','action_required','resolved') OR p_note IS NULL OR length(trim(p_note))<10 OR length(p_note)>2000 THEN RAISE EXCEPTION 'A valid status and review note are required';END IF;
  SELECT * INTO item FROM public.ccx_trust_requests WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found';END IF;
  UPDATE public.ccx_trust_requests SET status=p_status,resolution_note=p_note,reviewed_at=now() WHERE id=p_id;
  INSERT INTO public.ccx_trust_request_events(request_id,actor_id,action,from_status,to_status) VALUES(p_id,u,'status_changed',item.status,p_status);
  RETURN jsonb_build_object('updated',true);
 ELSE RAISE EXCEPTION 'Unknown review action';END IF;
END;
$$;
REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_trust_review(text,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION ccx_workspace_private.ccx_trust_review(text,uuid,text,text) TO authenticated;
CREATE FUNCTION public.ccx_trust_review(p_action text DEFAULT 'list',p_id uuid DEFAULT NULL,p_status text DEFAULT NULL,p_note text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT ccx_workspace_private.ccx_trust_review(p_action,p_id,p_status,p_note); $$;
REVOKE ALL ON FUNCTION public.ccx_trust_review(text,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ccx_trust_review(text,uuid,text,text) TO authenticated;
CREATE FUNCTION ccx_workspace_private.ccx_trust_events_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Trust audit events are append-only';END; $$;
REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_trust_events_append_only() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ccx_trust_events_immutable BEFORE UPDATE OR DELETE ON public.ccx_trust_request_events FOR EACH ROW EXECUTE FUNCTION ccx_workspace_private.ccx_trust_events_append_only();
COMMENT ON TABLE public.ccx_trust_requests IS 'Private report intake. A report does not establish wrongdoing. NCII due_at is an internal receipt-based triage target, not a determination of legal validity. No automated content removal or law-enforcement data access is granted.';
NOTIFY pgrst,'reload schema';
