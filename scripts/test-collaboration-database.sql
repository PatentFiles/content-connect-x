-- Disposable PostgreSQL fixture only. Never run against a real Supabase project.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA ccx_workspace_private;
CREATE SCHEMA cron;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
 $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
 $$ SELECT nullif(auth.jwt()->>'sub','')::uuid $$;
CREATE FUNCTION cron.schedule(text,text,text) RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;
CREATE FUNCTION public.ccx_workspace_allowed() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE TABLE public.member_profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),display_name text,role_type text,profile_complete boolean DEFAULT true);
CREATE TABLE public.member_admissions(user_id uuid REFERENCES auth.users(id),admitted_at timestamptz DEFAULT now());
CREATE TABLE public.account_security(user_id uuid REFERENCES auth.users(id),admin boolean DEFAULT false,banned boolean DEFAULT false,suspended boolean DEFAULT false);
CREATE TABLE public.member_blocks(blocker_id uuid,blocked_id uuid);
CREATE TABLE public.member_connection_requests(requester_id uuid,recipient_id uuid,status text);
CREATE TABLE public.conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),kind text);
CREATE TABLE public.conversation_members(conversation_id uuid,user_id uuid);
CREATE TABLE public.messages(conversation_id uuid,sender_id uuid,body text,deleted_at timestamptz);
CREATE TABLE public.collaborations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),creator_id uuid REFERENCES auth.users(id),status text DEFAULT 'draft');
CREATE TABLE public.collaboration_members(collaboration_id uuid REFERENCES public.collaborations(id),user_id uuid REFERENCES auth.users(id),membership_role text,PRIMARY KEY(collaboration_id,user_id));
CREATE TABLE public.collaboration_invitations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),collaboration_id uuid REFERENCES public.collaborations(id),invited_by uuid,invitee_id uuid,status text DEFAULT 'pending',created_at timestamptz DEFAULT now(),responded_at timestamptz);
CREATE TABLE public.properties(id uuid PRIMARY KEY,status text DEFAULT 'active',approved_at timestamptz);
CREATE TABLE public.member_notifications(recipient_id uuid,kind text,title text,details jsonb);
CREATE TABLE public.platform_action_audit(actor_id uuid,action text,target_type text,target_id uuid,metadata jsonb);
CREATE TABLE public.member_representations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 representative_id uuid REFERENCES auth.users(id),creator_id uuid REFERENCES auth.users(id),
 representative_role text,relationship_type text DEFAULT 'roster',
 status text DEFAULT 'pending',created_at timestamptz DEFAULT now(),
 responded_at timestamptz,ended_at timestamptz
);
CREATE UNIQUE INDEX member_rep_open_test ON public.member_representations(representative_id,creator_id,relationship_type) WHERE status IN('pending','active');
CREATE TABLE public.contracts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),collaboration_id uuid REFERENCES public.collaborations(id),locked_at timestamptz);

\i supabase/migrations/20261119181000_collaboration_plans_archive_and_invitation_cooldown.sql
\i supabase/migrations/20261119182000_mutual_professional_representation_agreements.sql
\i supabase/migrations/20261119234000_voluntary_collaboration_safety_checkins.sql
\i supabase/migrations/20261120001000_collaboration_actual_statements.sql
\i supabase/migrations/20261120065000_creator_travel_intro_project_notes.sql

DO $test$
DECLARE owner uuid:='10000000-0000-4000-8000-000000000001';
 friend uuid:='20000000-0000-4000-8000-000000000002';
 agent uuid:='30000000-0000-4000-8000-000000000003';
 cid uuid;rep uuid;terms text;res jsonb;count_versions int;
BEGIN
 INSERT INTO auth.users(id) VALUES(owner),(friend),(agent);
 INSERT INTO public.member_profiles(id,display_name,role_type) VALUES
  (owner,'Test Creator','creator'),(friend,'Test Photo','photographer'),(agent,'Test Agent','agent');
 INSERT INTO public.account_security(user_id) VALUES(owner),(friend),(agent);
 INSERT INTO public.member_admissions(user_id) VALUES(owner),(friend),(agent);
 INSERT INTO public.collaborations(creator_id) VALUES(owner) RETURNING id INTO cid;
 INSERT INTO public.collaboration_members(collaboration_id,user_id,membership_role) VALUES(cid,owner,'owner');
 -- Unsolicited collaboration requests are blocked even when a caller has DB credentials.
 BEGIN
  INSERT INTO public.collaboration_invitations(collaboration_id,invited_by,invitee_id,status) VALUES(cid,owner,friend,'pending');
  RAISE EXCEPTION 'Unsolicited invitation unexpectedly accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 INSERT INTO public.member_connection_requests(requester_id,recipient_id,status) VALUES(owner,friend,'accepted');
 -- A friend can receive a production invite. Five declines cause a hard 30-day cooldown.
 FOR idx IN 1..5 LOOP
  IF idx>1 THEN INSERT INTO public.collaborations(creator_id) VALUES(owner) RETURNING id INTO cid; END IF;
  INSERT INTO public.collaboration_invitations(collaboration_id,invited_by,invitee_id,status)
   VALUES(cid,owner,friend,'pending');
  UPDATE public.collaboration_invitations SET status='declined',responded_at=now()
    WHERE collaboration_id=cid AND invitee_id=friend;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.ccx_collaboration_invitation_cooldowns WHERE actor_id=owner AND until_at>now()+interval '29 days') THEN
  RAISE EXCEPTION 'Decline cooldown was not activated';
 END IF;
 INSERT INTO public.collaborations(creator_id) VALUES(owner) RETURNING id INTO cid;
 BEGIN
  INSERT INTO public.collaboration_invitations(collaboration_id,invited_by,invitee_id) VALUES(cid,owner,friend);
  RAISE EXCEPTION 'Cooldown bypassed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 -- Versioned plans and immutable evidence remain available after hiding.
 INSERT INTO public.ccx_collaboration_plans(collaboration_id,updated_by,city,scope_of_work)
   VALUES(cid,owner,'Test City','An agreed professional shoot');
 UPDATE public.ccx_collaboration_plans SET version=2,updated_by=owner,city='Another City' WHERE collaboration_id=cid;
 SELECT count(*) INTO count_versions FROM public.ccx_collaboration_plan_history WHERE collaboration_id=cid;
 IF count_versions<>2 THEN RAISE EXCEPTION 'Version history is incomplete'; END IF;
 INSERT INTO public.ccx_collaboration_hidden(user_id,collaboration_id) VALUES(owner,cid);
 IF NOT EXISTS(SELECT 1 FROM public.ccx_collaboration_plan_history WHERE collaboration_id=cid AND version=1) THEN
  RAISE EXCEPTION 'Hiding a collaboration erased an audit version';
 END IF;
 BEGIN
  DELETE FROM public.ccx_collaboration_plan_history WHERE collaboration_id=cid;
  RAISE EXCEPTION 'Immutable plan was deleted';
 EXCEPTION WHEN raise_exception THEN
  -- Both test assertion and trigger use this code; explicit marker would be unnecessary
  IF NOT EXISTS(SELECT 1 FROM public.ccx_collaboration_plan_history WHERE collaboration_id=cid) THEN RAISE; END IF;
 END;
 -- Agent offers fully specified terms. The requester accepts at proposal creation.
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',agent::text)::text,true);
 SELECT public.ccx_representation_agreement_action('request',
  jsonb_build_object('target_id',owner,'scope','Professional representation for scheduled filming','months','12','notice_days','30','commission_pct','10','exclusive',false)) INTO res;
 rep:=(res->'item'->>'id')::uuid;
 SELECT agreement_hash INTO terms FROM public.member_representations WHERE id=rep;
 IF NOT EXISTS(SELECT 1 FROM public.member_representations WHERE id=rep AND status='pending' AND agreed_by_representative_at IS NOT NULL AND agreed_by_professional_at IS NULL) THEN
  RAISE EXCEPTION 'Proposal was accepted without the professional';
 END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner::text)::text,true);
 PERFORM public.ccx_representation_agreement_action('accept',jsonb_build_object('id',rep,'terms_hash',terms));
 IF NOT EXISTS(SELECT 1 FROM public.member_representations WHERE id=rep AND status='active' AND expires_at>now()+interval '11 months' AND agreed_by_professional_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Mutual representation agreement not activated correctly';
 END IF;
 SELECT public.ccx_representation_agreement_action('profile_links',jsonb_build_object('target_id',owner)) INTO res;
 IF jsonb_array_length(res->'items')<>1 OR (res->'items'->0->>'display_name')<>'Test Agent'
    OR res->'items'->0 ? 'agreement_terms' THEN
  RAISE EXCEPTION 'Active profile representation should be public-scope only';
 END IF;
 PERFORM public.ccx_representation_agreement_action('give_notice',jsonb_build_object('id',rep));
 IF NOT EXISTS(SELECT 1 FROM public.member_representations WHERE id=rep AND termination_effective_at>now()+interval '29 days') THEN
  RAISE EXCEPTION 'Contract notice period missing';
 END IF;
 -- Legacy direct UPDATE cannot silently circumvent contractual notice.
 BEGIN
  UPDATE public.member_representations SET status='ended' WHERE id=rep;
  RAISE EXCEPTION 'Notice period was bypassed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM public.ccx_representation_agreement_action('end_for_safety',jsonb_build_object('id',rep));
 SELECT public.ccx_representation_agreement_action('profile_links',jsonb_build_object('target_id',owner)) INTO res;
 IF jsonb_array_length(res->'items')<>0 THEN RAISE EXCEPTION 'Ended representation remains public'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.member_representations WHERE id=rep AND status='ended') THEN
  RAISE EXCEPTION 'Immediate safety exit unavailable';
 END IF;
 IF (SELECT count(*) FROM public.ccx_representation_events WHERE representation_id=rep)<3 THEN
  RAISE EXCEPTION 'Representation audit events are incomplete';
 END IF;
END $test$;
SELECT 'PASS: private collaboration archives, cooldowns, mutual representation, notice and safety exit' AS verified;
\i scripts/test-collaboration-safety.sql
\i scripts/test-collaboration-actuals.sql
\i scripts/test-creator-extensions-database.sql
