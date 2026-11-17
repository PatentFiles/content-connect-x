-- Canonical CCX database regression. Run as owner in staging or the SQL editor.
-- Synthetic fixtures are scoped to this transaction. NEVER remove ROLLBACK.
BEGIN;
CREATE TEMP TABLE dash_fixtures(label text PRIMARY KEY,id uuid NOT NULL,role_type text) ON COMMIT DROP;
CREATE TEMP TABLE dash_checks(test text,passed boolean) ON COMMIT DROP;
GRANT SELECT ON dash_fixtures TO authenticated;
GRANT INSERT,SELECT ON dash_checks TO authenticated;
INSERT INTO dash_fixtures SELECT r,gen_random_uuid(),r FROM unnest(ARRAY['creator','agent','studio','photographer','videographer','video_editor'])r;
INSERT INTO dash_fixtures VALUES('other',gen_random_uuid(),'creator'),('unverified_admin',gen_random_uuid(),'creator');
INSERT INTO auth.users(id,aud,role,email,created_at,updated_at) SELECT id,'authenticated','authenticated','ccx-dashboard-probe-'||id||'@example.invalid',now(),now() FROM dash_fixtures;
INSERT INTO public.account_security(user_id,admin) SELECT id,label='unverified_admin' FROM dash_fixtures ON CONFLICT(user_id) DO UPDATE SET admin=excluded.admin;
INSERT INTO public.member_profiles(id,display_name,role_type,city,country,profile_complete) SELECT id,'Synthetic dashboard probe',role_type,'Phoenix','United States',true FROM dash_fixtures ON CONFLICT(id) DO UPDATE SET role_type=excluded.role_type,profile_complete=true;
INSERT INTO public.age_verification_requests(user_id,status,provider,verified_at) SELECT id,'approved','rollback_probe',now() FROM dash_fixtures WHERE label<>'unverified_admin';
INSERT INTO public.member_subscriptions(user_id,status,period_end) SELECT id,'active',now()+interval '1 day' FROM dash_fixtures WHERE label<>'unverified_admin' ON CONFLICT(user_id) DO UPDATE SET status='active',period_end=excluded.period_end;
INSERT INTO public.creator_favorites(user_id,creator_id) SELECT a.id,b.id FROM dash_fixtures a,dash_fixtures b WHERE a.label='creator' AND b.label='other';
INSERT INTO public.member_notifications(recipient_id,kind,title) SELECT id,'test','Synthetic owner-only notification' FROM dash_fixtures WHERE label='creator';
SET LOCAL ROLE authenticated;
DO $$
DECLARE f record; d jsonb; saved jsonb; bad boolean; x jsonb; uid uuid;
BEGIN
 FOR f IN SELECT * FROM dash_fixtures WHERE label NOT IN('other','unverified_admin') LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',f.id,'role','authenticated','aal','aal2')::text,true);
  d:=public.ccx_dashboard_action('load');
  INSERT INTO dash_checks VALUES('load_'||f.label,d->>'role'=f.role_type AND (SELECT count(*) FROM jsonb_object_keys(d->'metrics'))=15);
  saved:=public.ccx_dashboard_action('save',jsonb_build_array(jsonb_build_object('id','favorites','width','wide')),0);
  d:=public.ccx_dashboard_action('load');
  INSERT INTO dash_checks VALUES('persist_'||f.label,d->'layout'=saved->'layout' AND (d->>'revision')::int=1);
  bad:=false;BEGIN PERFORM public.ccx_dashboard_action('save','[]'::jsonb,0);EXCEPTION WHEN serialization_failure THEN bad:=true;END;
  INSERT INTO dash_checks VALUES('conflict_'||f.label,bad);
  PERFORM public.ccx_dashboard_action('save','[]'::jsonb,1);d:=public.ccx_dashboard_action('load');
  INSERT INTO dash_checks VALUES('empty_layout_'||f.label,d->'layout'='[]'::jsonb AND (d->>'revision')::int=2);
  INSERT INTO dash_checks SELECT 'owner_isolation_'||f.label,NOT EXISTS(SELECT 1 FROM public.member_dashboard_preferences WHERE user_id<>f.id);
 END LOOP;
 SELECT id INTO uid FROM dash_fixtures WHERE label='creator';
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','aal','aal2')::text,true);
 d:=public.ccx_dashboard_action('load');
 INSERT INTO dash_checks VALUES('real_favorites_count',d->'metrics'->'favorites'->>'value'='1'),('real_notification_count',d->'metrics'->'recent_activity'->>'value'='1'),('own_notification_payload',d->'metrics'->'recent_activity'->'items'->0->>'title'='Synthetic owner-only notification');
 FOR x IN SELECT value FROM(VALUES(jsonb_build_array(jsonb_build_object('id','bad','width','normal'))),(jsonb_build_array(jsonb_build_object('id','favorites','width','normal','sql','not allowed'))),(jsonb_build_array(jsonb_build_object('id','favorites','width','normal'),jsonb_build_object('id','favorites','width','wide'))),(jsonb_build_array(jsonb_build_object('id','favorites','width','invalid'))))cases(value) LOOP
  bad:=false;BEGIN PERFORM public.ccx_dashboard_action('save',x,2);EXCEPTION WHEN raise_exception THEN bad:=true;END;
  INSERT INTO dash_checks VALUES('reject_invalid_'||md5(x::text),bad);
 END LOOP;
 bad:=false;BEGIN PERFORM public.ccx_dashboard_action('save',jsonb_build_array(jsonb_build_object('id','roster','width','normal')),2);EXCEPTION WHEN insufficient_privilege THEN bad:=true;END;
 INSERT INTO dash_checks VALUES('reject_other_role_widget',bad);
 bad:=false;BEGIN UPDATE public.member_dashboard_preferences SET revision=99 WHERE user_id=uid;EXCEPTION WHEN insufficient_privilege THEN bad:=true;END;
 INSERT INTO dash_checks VALUES('deny_direct_layout_write',bad);
 SELECT id INTO uid FROM dash_fixtures WHERE label='unverified_admin';
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','aal','aal2')::text,true);
 d:=public.ccx_dashboard_action('load');
 INSERT INTO dash_checks VALUES('unverified_admin_not_approved',d->'account'->>'age_verified'='false'),('unavailable_is_not_zero',d->'metrics'->'favorites'->>'status'='verification_required' AND NOT(d->'metrics'->'favorites'?'value'));
 d:=public.ccx_member_feature_flags();
 INSERT INTO dash_checks VALUES('enabled_feature_explains_verification',d->'flags'->>'testing'='true' AND d->'access'->'testing'->>'reason'='verification_required'),('anonymous_rpc_denied',NOT has_function_privilege('anon','public.ccx_dashboard_action(text,jsonb,integer)','EXECUTE'));
END $$;
RESET ROLE;
DO $$BEGIN IF EXISTS(SELECT 1 FROM dash_checks WHERE passed IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Dashboard regression failed';END IF;END $$;
SELECT count(*) checks_run,bool_and(passed) all_passed,jsonb_agg(jsonb_build_object('test',test,'passed',passed) ORDER BY test) checks FROM dash_checks;
ROLLBACK;
