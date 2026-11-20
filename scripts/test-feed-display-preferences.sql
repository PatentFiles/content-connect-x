-- Disposable Supabase RLS fixture. Run only in ccx_feed_test after creating
-- synthetic auth.users, anon/authenticated roles, and the preferences migration.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'ccx_feed_test' THEN RAISE EXCEPTION 'Disposable test database only'; END IF; END $$;
-- Service role can seed synthetic account B so RLS reads have real rows to deny.
set role service_role;
insert into public.ccx_feed_display_preferences(user_id,default_audience,feed_view)
 values('20000000-0000-4000-8000-000000000002','friends','following');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
insert into public.ccx_feed_display_preferences(user_id,default_audience,feed_view)
 values('10000000-0000-4000-8000-000000000001','verified','discover');
DO $test$
DECLARE b integer;
BEGIN
 IF (SELECT count(*) FROM public.ccx_feed_display_preferences)<>1 THEN
   RAISE EXCEPTION 'FAIL another user preferences leaked'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ccx_feed_display_preferences WHERE user_id='10000000-0000-4000-8000-000000000001' AND feed_view='discover')
 THEN RAISE EXCEPTION 'FAIL owner could not read settings'; END IF;
 BEGIN
  INSERT INTO public.ccx_feed_display_preferences(user_id,default_audience,feed_view)
   values('30000000-0000-4000-8000-000000000003','verified','discover');
  RAISE EXCEPTION 'FAIL caller forged another account preference';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.ccx_feed_display_preferences SET user_id='20000000-0000-4000-8000-000000000002'
   WHERE user_id='10000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'FAIL owner changed row to another account';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.ccx_feed_display_preferences SET feed_view='friends',default_audience='only_me'
 WHERE user_id='10000000-0000-4000-8000-000000000001';
 IF NOT EXISTS(SELECT 1 FROM public.ccx_feed_display_preferences WHERE feed_view='friends' AND default_audience='only_me')
 THEN RAISE EXCEPTION 'FAIL owner update'; END IF;
 UPDATE public.ccx_feed_display_preferences SET feed_view='discover'
 WHERE user_id='20000000-0000-4000-8000-000000000002';
 GET DIAGNOSTICS b=ROW_COUNT;
 IF b<>0 THEN RAISE EXCEPTION 'FAIL cross-account update'; END IF;
 BEGIN
  UPDATE public.ccx_feed_display_preferences SET feed_view='unapproved'
   WHERE user_id='10000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'FAIL invalid feed mode accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $test$;
reset role;
set role anon;
DO $anon$
BEGIN
 BEGIN
  PERFORM 1 FROM public.ccx_feed_display_preferences LIMIT 1;
  RAISE EXCEPTION 'FAIL anonymous preferences read';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $anon$;
reset role;
SELECT 'PASS: per-member feed preferences, no cross-account read/write, invalid mode and anonymous access rejected' AS result;
