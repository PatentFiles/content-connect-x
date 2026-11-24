-- No real approvals or money are created: every fixture is rolled back.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='20s';
CREATE TEMP TABLE provider_check_results(name text,passed boolean);
DO $$
DECLARE u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();s uuid;ps text:=gen_random_uuid()::text;
 a jsonb;e jsonb;outcome jsonb;denied boolean;until_at timestamptz:=now()+interval '30 days';at_time timestamptz:=now();
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(u,'provider-test-'||u||'@example.invalid','{"display_name":"Fixture host","admin":true,"age_verified":true}'::jsonb),(v,'provider-test-'||v||'@example.invalid','{}'::jsonb);
 INSERT INTO provider_check_results SELECT 'signup_cannot_self_admit_or_make_admin',NOT EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=u) AND NOT (SELECT admin FROM public.account_security WHERE user_id=u);
 INSERT INTO provider_check_results SELECT 'display_name_saved_without_identity_claim',(SELECT display_name='Fixture host' FROM public.member_profiles WHERE id=u);
 denied:=false;BEGIN INSERT INTO public.age_verification_requests(user_id,status,provider,verified_at) VALUES(u,'approved','manual',now());EXCEPTION WHEN OTHERS THEN denied:=true;END;
 INSERT INTO provider_check_results VALUES('manual_age_approval_rejected',denied);
 -- Retired Yoti must never grant an admission, even via the former service RPC.
 INSERT INTO public.ccx_age_provider_sessions(user_id,provider_session_id,mode,status,expires_at,policy_version)
 VALUES(u,ps,'age_gate','pending',now()+interval '15 minutes','document_selfie_v1') RETURNING id INTO s;
 denied:=false;BEGIN
  PERFORM public.ccx_finish_yoti_session(u,s,'age_confirmed','DOC_SCAN','fixture-evidence',repeat('a',64));
 EXCEPTION WHEN OTHERS THEN denied:=true;END;
 INSERT INTO provider_check_results SELECT 'retired_vendor_cannot_admit',denied AND NOT EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=u);
 -- Checkout must reject the unadmitted user. Only then seed the synthetic test
 -- admission inside this rollback-only billing fixture; no live identity claim.
 denied:=false;BEGIN PERFORM public.ccx_start_membership_checkout(v,'creator_pro','900100','0001');EXCEPTION WHEN OTHERS THEN denied:=true;END;
 INSERT INTO provider_check_results VALUES('unadmitted_user_cannot_checkout',denied);
 INSERT INTO public.member_admissions(user_id,source) VALUES(u,'legacy_admin');
 denied:=false;BEGIN PERFORM public.ccx_start_membership_checkout(u,'agent_25','900100','0001');EXCEPTION WHEN OTHERS THEN denied:=true;END;
 INSERT INTO provider_check_results VALUES('plan_must_match_actual_role',denied);
 a:=public.ccx_start_membership_checkout(u,'creator_pro','900100','0001');
 INSERT INTO provider_check_results VALUES('checkout_nonce_reused',a->>'checkout_nonce'=public.ccx_start_membership_checkout(u,'creator_pro','900100','0001')->>'checkout_nonce');
 e:=jsonb_build_object('event_id',encode(extensions.digest(u::text||':sale','sha256'),'hex'),'event_type','NewSaleSuccess','account','900100','subaccount','0001','subscription_id','fixture-'||u,'transaction_id','fixture-tx-'||u,'checkout_nonce',a->>'checkout_nonce','occurred_at',at_time,'period_end',until_at,'amount_cents',(a->>'amount_cents')::integer,'currency','USD');
 outcome:=public.ccx_apply_membership_event(e,repeat('b',64));
 INSERT INTO provider_check_results SELECT 'validated_sale_activates_correct_plan',outcome->>'status'='applied' AND EXISTS(SELECT 1 FROM public.member_subscriptions WHERE user_id=u AND status='active' AND plan_id='creator_pro' AND period_end=until_at);
 outcome:=public.ccx_apply_membership_event(e,repeat('b',64));
 INSERT INTO provider_check_results VALUES('duplicate_sale_idempotent',(outcome->>'duplicate')::boolean);
 denied:=false;BEGIN PERFORM public.ccx_apply_membership_event(e,repeat('c',64));EXCEPTION WHEN OTHERS THEN denied:=true;END;
 INSERT INTO provider_check_results VALUES('conflicting_duplicate_denied',denied);
 denied:=false;BEGIN PERFORM public.ccx_start_membership_checkout(u,'creator_pro','900100','0001');EXCEPTION WHEN OTHERS THEN denied:=true;END;
 INSERT INTO provider_check_results VALUES('active_membership_blocks_duplicate_checkout',denied);
 e:=e||jsonb_build_object('event_id',encode(extensions.digest(u::text||':cancel','sha256'),'hex'),'event_type','Cancellation','occurred_at',at_time+interval '1 second','period_end',NULL,'amount_cents',NULL,'currency',NULL);
 PERFORM public.ccx_apply_membership_event(e,repeat('d',64));
 INSERT INTO provider_check_results SELECT 'cancel_preserves_paid_period',(SELECT status='active' AND period_end=until_at FROM public.member_subscriptions WHERE user_id=u) AND (SELECT cancel_at_period_end FROM public.ccx_membership_contracts WHERE user_id=u);
 e:=e||jsonb_build_object('event_id',encode(extensions.digest(u::text||':expire','sha256'),'hex'),'event_type','Expiration','occurred_at',at_time-interval '1 second');
 outcome:=public.ccx_apply_membership_event(e,repeat('e',64));
 INSERT INTO provider_check_results SELECT 'old_expiration_cannot_overwrite_newer_state',outcome->>'status'='ignored' AND (SELECT status='active' FROM public.member_subscriptions WHERE user_id=u);
 e:=e||jsonb_build_object('event_id',encode(extensions.digest(u::text||':refund','sha256'),'hex'),'event_type','Refund','occurred_at',at_time+interval '2 seconds');
 PERFORM public.ccx_apply_membership_event(e,repeat('f',64));
 INSERT INTO provider_check_results SELECT 'verified_latest_refund_revokes_entitlement',(SELECT status='cancelled' FROM public.member_subscriptions WHERE user_id=u);
 INSERT INTO provider_check_results SELECT 'browser_cannot_spoof_provider_rpc',NOT has_function_privilege('authenticated','public.ccx_apply_membership_event(jsonb,text)','EXECUTE') AND NOT has_function_privilege('anon','public.ccx_finish_yoti_session(uuid,uuid,text,text,text,text)','EXECUTE') AND NOT has_function_privilege('anon','public.ccx_apply_membership_event(jsonb,text)','EXECUTE') AND NOT has_function_privilege('authenticated','public.ccx_finish_yoti_session(uuid,uuid,text,text,text,text)','EXECUTE');
 IF EXISTS(SELECT 1 FROM provider_check_results WHERE NOT passed OR passed IS NULL) THEN RAISE EXCEPTION 'A provider regression failed';END IF;
END $$;

-- Synthetic prepaid scenarios. All merchant approvals below are uncommitted
-- fixture changes and are rolled back; no processor request is sent.
DO $prepaid$
DECLARE u uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); w uuid:=gen_random_uuid();
 a jsonb; e jsonb; result jsonb; denied boolean; days integer; expected integer;
 at_time timestamptz:=now(); until_at timestamptz; p record; checks integer:=0; sid text;
BEGIN
 FOR p IN SELECT plan_code,monthly_cents FROM public.membership_plan_catalog WHERE active LOOP
  IF public.ccx_membership_term_price(p.monthly_cents,30)<>p.monthly_cents
   OR public.ccx_membership_term_price(p.monthly_cents,180)<>round(p.monthly_cents::numeric*6*0.90)
   OR public.ccx_membership_term_price(p.monthly_cents,365)<>round(p.monthly_cents::numeric*12*0.80)
  THEN RAISE EXCEPTION 'Incorrect plan price %',p.plan_code; END IF;
  checks:=checks+1;
 END LOOP;
 INSERT INTO provider_check_results VALUES('every_professional_role_has_prepaid_prices',checks=13 AND (SELECT count(DISTINCT role_type) FROM public.membership_plan_catalog WHERE active)=11);
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 (u,'prepaid-six-'||u||'@example.invalid','{}'::jsonb),
 (v,'prepaid-year-'||v||'@example.invalid','{}'::jsonb),
 (w,'prepaid-wrong-'||w||'@example.invalid','{}'::jsonb);
 INSERT INTO public.member_admissions(user_id,source) VALUES(u,'legacy_admin'),(v,'legacy_admin'),(w,'legacy_admin');
 UPDATE public.ccx_integrations SET membership_prepaid_max_cents=0 WHERE provider='ccbill';
 denied:=false;
 BEGIN PERFORM public.ccx_start_membership_checkout_term(u,'creator_pro','900100','0001',180,10795);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 INSERT INTO provider_check_results VALUES('unapproved_prepaid_checkout_denied',denied);
 UPDATE public.ccx_integrations SET enabled=true,membership_prepaid_max_cents=1000000 WHERE provider='ccbill';
 denied:=false;
 BEGIN PERFORM public.ccx_start_membership_checkout_term(u,'creator_pro','900100','0001',180,1);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 INSERT INTO provider_check_results VALUES('client_price_tampering_denied',denied);
 FOR days IN SELECT unnest(ARRAY[180,365]) LOOP
  expected:=public.ccx_membership_term_price(1999,days);
  IF days=180 THEN sid:='prepaid-fixture-'||u; ELSE sid:='prepaid-fixture-'||v; END IF;
  a:=public.ccx_start_membership_checkout_term(CASE WHEN days=180 THEN u ELSE v END,'creator_pro','900100','0001',days,expected);
  until_at:=at_time+make_interval(secs=>days::double precision*86400);
  e:=jsonb_build_object('event_id',encode(extensions.digest(sid||':sale','sha256'),'hex'),'event_type','NewSaleSuccess','account','900100','subaccount','0001','subscription_id',sid,'transaction_id',sid||'-tx','checkout_nonce',a->>'checkout_nonce','occurred_at',at_time,'period_end',until_at,'amount_cents',expected,'currency','USD','period_days',days,'billing_mode','prepaid');
  result:=public.ccx_apply_membership_event(e,encode(extensions.digest(e::text,'sha256'),'hex'));
  INSERT INTO provider_check_results SELECT 'prepaid_'||days||'_exact_paid_period',result->>'status'='applied' AND EXISTS(
   SELECT 1 FROM public.ccx_membership_contracts c JOIN public.member_subscriptions m ON m.user_id=c.user_id WHERE c.subscription_id=sid AND c.period_days=days AND c.cancel_at_period_end AND c.amount_cents=expected AND m.status='active' AND m.period_end=until_at);
  result:=public.ccx_apply_membership_event(e,encode(extensions.digest(e::text,'sha256'),'hex'));
  INSERT INTO provider_check_results VALUES('prepaid_'||days||'_duplicate_idempotent',(result->>'duplicate')::boolean);
  e:=e||jsonb_build_object('event_id',encode(extensions.digest(sid||':renewal','sha256'),'hex'),'event_type','RenewalSuccess','occurred_at',at_time+interval '1 second','period_end',until_at+interval '30 days','transaction_id',sid||'-rebill');
  result:=public.ccx_apply_membership_event(e,encode(extensions.digest(e::text,'sha256'),'hex'));
  INSERT INTO provider_check_results SELECT 'prepaid_'||days||'_rebill_cannot_extend',result->>'status'='reconciliation_required' AND EXISTS(SELECT 1 FROM public.ccx_membership_contracts c WHERE c.subscription_id=sid AND c.period_end=until_at);
 END LOOP;
 a:=public.ccx_start_membership_checkout_term(w,'creator_pro','900100','0001',180,10795);
 e:=jsonb_build_object('event_id',encode(extensions.digest(w::text||':wrong','sha256'),'hex'),'event_type','NewSaleSuccess','account','900100','subaccount','0001','subscription_id','wrong-fixture-'||w,'transaction_id','wrong-fixture-tx-'||w,'checkout_nonce',a->>'checkout_nonce','occurred_at',at_time,'period_end',at_time+interval '365 days','amount_cents',10795,'currency','USD','period_days',365,'billing_mode','prepaid');
 result:=public.ccx_apply_membership_event(e,encode(extensions.digest(e::text,'sha256'),'hex'));
 INSERT INTO provider_check_results VALUES('wrong_prepaid_duration_never_grants_access',result->>'status'='reconciliation_required' AND NOT EXISTS(SELECT 1 FROM public.member_subscriptions WHERE user_id=w AND status='active'));
 INSERT INTO provider_check_results VALUES('browser_cannot_call_prepaid_checkout_or_modify_limit',NOT has_function_privilege('authenticated','public.ccx_start_membership_checkout_term(uuid,text,text,text,integer,integer)','EXECUTE') AND NOT has_function_privilege('anon','public.ccx_start_membership_checkout_term(uuid,text,text,text,integer,integer)','EXECUTE') AND NOT has_table_privilege('authenticated','public.ccx_integrations','UPDATE'));
 IF EXISTS(SELECT 1 FROM provider_check_results WHERE passed IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Prepaid regression failed'; END IF;
END $prepaid$;

SELECT jsonb_agg(jsonb_build_object('test',name,'passed',passed)) AS checks FROM provider_check_results;
ROLLBACK;
