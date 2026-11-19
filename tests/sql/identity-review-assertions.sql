-- Only run after disposable CI identity fixtures and the actual review migration.
DO $$ BEGIN
 IF has_function_privilege('authenticated','public.ccx_idv_review_case(uuid,uuid,text,text)','EXECUTE')
    OR has_table_privilege('authenticated','public.ccx_idv_review_cases','SELECT')
    OR has_table_privilege('anon','public.ccx_idv_review_events','SELECT')
   THEN RAISE EXCEPTION 'FAIL browser could see or change private identity review'; END IF;
END $$;

-- Synthetic CI account roles only. The live service cannot invent a reviewer
-- approval or use this test to grant an account admission.
UPDATE public.account_security SET admin=true
WHERE user_id=(SELECT uid FROM public.ci_cases WHERE kind='adult');

SET ROLE service_role;
DO $$
DECLARE
 reviewer uuid; case_owner uuid; cid uuid; own_cid uuid;
 r jsonb; before_events integer; first_claim timestamp with time zone;
BEGIN
 SELECT uid INTO reviewer FROM public.ci_cases WHERE kind='adult';
 SELECT uid INTO case_owner FROM public.ci_cases WHERE kind='failed';
 SELECT sid INTO cid FROM public.ci_cases WHERE kind='failed';
 SELECT sid INTO own_cid FROM public.ci_cases WHERE kind='adult';

 IF (SELECT status FROM public.ccx_idv_review_cases WHERE session_id=cid)<>'queued'
   THEN RAISE EXCEPTION 'FAIL qualified review not queued after request'; END IF;
 IF EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=case_owner)
   THEN RAISE EXCEPTION 'FAIL review granted account admission'; END IF;

 r:=public.ccx_idv_review_case(reviewer,NULL,'list');
 IF (SELECT count(*) FROM jsonb_array_elements(r->'cases') x WHERE x->>'id'=cid::text)<>1
    THEN RAISE EXCEPTION 'FAIL queued case not listed'; END IF;
 IF r::text LIKE '%Synthetic%' OR r::text LIKE '%document_number%'
    THEN RAISE EXCEPTION 'FAIL review list exposed identifying evidence'; END IF;

 BEGIN
  PERFORM public.ccx_idv_review_case(case_owner,cid,'claim');
  RAISE EXCEPTION 'FAIL unadmitted user claimed a review';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'REVIEW_FORBIDDEN' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.ccx_idv_review_case(reviewer,cid,'authorize_read');
  RAISE EXCEPTION 'FAIL unclaimed case exposed evidence';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'REVIEW_NOT_ASSIGNED' THEN RAISE; END IF;
 END;
 r:=public.ccx_idv_review_case(reviewer,cid,'claim');
 IF r->>'case_status'<>'claimed' OR r->>'assigned_reviewer_id'<>reviewer::text
   THEN RAISE EXCEPTION 'FAIL claim owner'; END IF;
 SELECT assigned_at INTO first_claim FROM public.ccx_idv_review_cases WHERE session_id=cid;
 PERFORM public.ccx_idv_review_case(reviewer,cid,'claim');
 IF (SELECT assigned_at FROM public.ccx_idv_review_cases WHERE session_id=cid) IS DISTINCT FROM first_claim
   THEN RAISE EXCEPTION 'FAIL repeated claim modified assignment'; END IF;
 PERFORM public.ccx_idv_review_case(reviewer,cid,'authorize_read');

 BEGIN
  PERFORM public.ccx_idv_review_case(reviewer,cid,'close','approved');
  RAISE EXCEPTION 'FAIL unsafe approval disposition accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'REVIEW_DISPOSITION_REQUIRED' THEN RAISE; END IF;
 END;

 -- A member with an approved adult account cannot review their own evidence.
 INSERT INTO public.ccx_idv_review_cases(session_id,requester_id)
 VALUES(own_cid,reviewer);
 BEGIN
  PERFORM public.ccx_idv_review_case(reviewer,own_cid,'claim');
  RAISE EXCEPTION 'FAIL self-review accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'INDEPENDENT_REVIEW_REQUIRED' THEN RAISE; END IF;
 END;

 r:=public.ccx_idv_review_case(reviewer,cid,'close','fresh_capture_required');
 IF r->>'case_status'<>'closed' THEN RAISE EXCEPTION 'FAIL close status'; END IF;
 IF EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=case_owner)
   THEN RAISE EXCEPTION 'FAIL closing a review granted identity approval'; END IF;
 BEGIN
  PERFORM public.ccx_idv_review_case(reviewer,cid,'authorize_read');
  RAISE EXCEPTION 'FAIL closed case still exposes evidence';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'REVIEW_NOT_ASSIGNED' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.ccx_idv_review_events
      WHERE session_id=cid AND action='case_claimed')<>1
     OR (SELECT count(*) FROM public.ccx_idv_review_events
      WHERE session_id=cid AND action='case_closed')<>1
   THEN RAISE EXCEPTION 'FAIL non-duplicate case audit events'; END IF;
 BEGIN
  UPDATE public.ccx_idv_review_events SET action='case_claimed' WHERE session_id=cid;
  RAISE EXCEPTION 'FAIL immutable review history edited';
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE<>'42501' AND SQLERRM NOT LIKE '%append-only%' THEN RAISE; END IF;
 END;
END $$;
RESET ROLE;
SELECT 'PASS: MFA-gated identity case authorization (Edge MFA separately unit-tested), independent case claims, non-admitting decisions, audit' AS result;
