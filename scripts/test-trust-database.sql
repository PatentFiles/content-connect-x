-- ONLY in the isolated CI database. All examples are synthetic.
BEGIN;
DO $$ BEGIN
 ASSERT NOT (public.ccx_trust_public_config()->>'ready')::boolean;
 ASSERT NOT has_table_privilege('anon','public.ccx_trust_requests','SELECT');
 ASSERT NOT has_table_privilege('authenticated','public.ccx_trust_requests','SELECT,INSERT,UPDATE,DELETE');
 ASSERT NOT has_function_privilege('anon','public.ccx_trust_submit(jsonb,text,uuid)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.ccx_trust_submit(jsonb,text,uuid)','EXECUTE');
 ASSERT NOT has_function_privilege('anon','public.ccx_trust_review(text,uuid,text,text)','EXECUTE');
 BEGIN PERFORM public.ccx_trust_submit('{"kind":"support","details":"Synthetic disabled check"}',repeat('a',64),gen_random_uuid());RAISE EXCEPTION 'Disabled intake accepted';EXCEPTION WHEN SQLSTATE '55000' THEN NULL;END;
 BEGIN UPDATE public.ccx_trust_settings SET intake_enabled=true;RAISE EXCEPTION 'Missing launch details accepted';EXCEPTION WHEN check_violation THEN NULL;END;
END $$;
UPDATE public.ccx_trust_settings SET legal_entity='Synthetic operator',postal_address='Synthetic test address',contact_email='review@example.invalid',policies_approved=true,reviewer_coverage_confirmed=true,intake_enabled=true;
CREATE TEMP TABLE result_ids(id uuid);
CREATE TEMP TABLE receipt_secrets(id uuid,access_code uuid);
DO $$ DECLARE key uuid:=gen_random_uuid();one jsonb;two jsonb;i integer;BEGIN
 one:=public.ccx_trust_submit('{"kind":"ncii","details":"Synthetic removal request","locator":"fixture/test","email":"example@example.invalid","signature":"Synthetic signer","authorized":true,"good_faith":true,"admin":true}',repeat('a',64),key);
 two:=public.ccx_trust_submit('{"kind":"ncii","details":"Synthetic removal request","locator":"fixture/test","email":"example@example.invalid","signature":"Synthetic signer","authorized":true,"good_faith":true}',repeat('a',64),key);
 ASSERT one=two;ASSERT (SELECT count(*) FROM public.ccx_trust_requests)=1;
 ASSERT (SELECT due_at-created_at FROM public.ccx_trust_requests)=interval '48 hours';
 ASSERT NOT (SELECT payload ? 'admin' FROM public.ccx_trust_requests);
 INSERT INTO result_ids VALUES((one->>'reference')::uuid);
 INSERT INTO receipt_secrets VALUES((one->>'reference')::uuid,key);
 BEGIN PERFORM public.ccx_trust_submit('{"kind":"ncii","details":"Synthetic invalid request"}',repeat('a',64),gen_random_uuid());RAISE EXCEPTION 'Incomplete removal accepted';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM<>'Incomplete removal accepted';END;
 FOR i IN 1..30 LOOP PERFORM public.ccx_trust_submit('{"kind":"support","details":"Synthetic rate limit fixture"}',repeat('b',64),gen_random_uuid());END LOOP;
 BEGIN PERFORM public.ccx_trust_submit('{"kind":"support","details":"Synthetic over limit"}',repeat('b',64),gen_random_uuid());RAISE EXCEPTION 'Rate limit bypassed';EXCEPTION WHEN SQLSTATE '54000' THEN NULL;END;
 BEGIN UPDATE public.ccx_trust_request_events SET action='tampered';RAISE EXCEPTION 'Audit mutation accepted';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM<>'Audit mutation accepted';END;
END $$;
INSERT INTO auth.users(id) VALUES('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
INSERT INTO public.account_security(user_id,admin,banned,suspended) VALUES('00000000-0000-4000-8000-000000000001',true,false,false),('00000000-0000-4000-8000-000000000002',false,false,false);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","aal":"aal2","user_metadata":{"admin":true}}',true);
DO $$ BEGIN BEGIN PERFORM public.ccx_trust_review('list');RAISE EXCEPTION 'Self-declared admin accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
DO $$ BEGIN BEGIN PERFORM public.ccx_trust_review('list');RAISE EXCEPTION 'MFA bypass accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
DO $$ DECLARE queue jsonb;id uuid;item jsonb;BEGIN
 queue:=public.ccx_trust_review('list');ASSERT jsonb_array_length(queue->'items')=31;
 ASSERT NOT ((queue->'items'->0) ? 'payload');id:=(queue->'items'->0->>'id')::uuid;
 item:=public.ccx_trust_review('read',id);ASSERT item ? 'payload';ASSERT NOT item ? 'idempotency_key';
 -- A status update without a claimed case must be rejected even for an MFA admin.
 BEGIN
  PERFORM public.ccx_trust_review('update',id,'reviewing','Synthetic review note only');
  RAISE EXCEPTION 'Unclaimed case was updated';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM public.ccx_trust_triage('claim',id);
 PERFORM public.ccx_trust_review('update',id,'reviewing','Synthetic review note only');
END $$;
RESET ROLE;
-- Status lookup requires BOTH the receipt number and the private access code.
DO $ DECLARE ref uuid;code uuid;data jsonb;wrong uuid:=gen_random_uuid();i integer;BEGIN
 SELECT id,access_code INTO ref,code FROM receipt_secrets;
 data:=public.ccx_trust_reporter_status(ref,wrong,repeat('c',64));
 ASSERT data->>'verified'='false';
 data:=public.ccx_trust_reporter_status(ref,code,repeat('c',64));
 ASSERT data->>'verified'='true';
 ASSERT data->>'status'='reviewing';
 ASSERT NOT data ? 'payload' AND NOT data ? 'resolution_note' AND NOT data ? 'email';
 ASSERT has_function_privilege('service_role','public.ccx_trust_reporter_status(uuid,uuid,text)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.ccx_trust_reporter_status(uuid,uuid,text)','EXECUTE');
 FOR i IN 1..10 LOOP PERFORM public.ccx_trust_reporter_status(ref,wrong,repeat('c',64));END LOOP;
 BEGIN
  PERFORM public.ccx_trust_reporter_status(ref,wrong,repeat('c',64));
  RAISE EXCEPTION 'Status brute-force limit bypassed';
 EXCEPTION WHEN SQLSTATE '54000' THEN NULL;END;
END $;
UPDATE public.account_security SET suspended=true WHERE user_id='00000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM public.ccx_trust_review('list');RAISE EXCEPTION 'Suspended reviewer accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS isolated trust permissions, activation guards, idempotency, validation, rate limits, audit immutability and MFA/admin checks' AS result;
