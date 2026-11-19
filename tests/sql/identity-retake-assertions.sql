-- Loaded only in disposable CI after the actual identity implementation and
-- before the retention fixture advances deadlines. No real accounts or ID images.
DO $$ BEGIN
 IF has_function_privilege('authenticated','public.ccx_idv_request_retake(uuid,uuid,text)','EXECUTE')
  OR has_function_privilege('anon','public.ccx_idv_upload_versioned(uuid,uuid,integer,jsonb)','EXECUTE')
  THEN RAISE EXCEPTION 'FAIL retake function reachable from browser'; END IF;
END $$;

SET ROLE service_role;
DO $$
DECLARE
 t record; another uuid; s jsonb; before jsonb; newfront jsonb;
 oldhash text:=repeat('a',64); replacement text:=repeat('b',64);
BEGIN
 SELECT * INTO t FROM public.ci_cases WHERE kind='failed';
 SELECT uid INTO another FROM public.ci_cases WHERE kind='adult';
 IF (SELECT status FROM public.ccx_idv_sessions WHERE id=t.sid)<>'review_required'
  THEN RAISE EXCEPTION 'FAIL missing fixture review result'; END IF;
 BEGIN
  PERFORM public.ccx_idv_request_retake(another,t.sid,'front');
  RAISE EXCEPTION 'FAIL another user retook protected evidence';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'SESSION_NOT_FOUND' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.ccx_idv_request_retake(t.uid,t.sid,'back');
  RAISE EXCEPTION 'FAIL passport gained back capture';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'RETAKE_UNAVAILABLE' THEN RAISE; END IF;
 END;
 before:=(SELECT evidence FROM public.ccx_idv_sessions WHERE id=t.sid);
 s:=public.ccx_idv_request_retake(t.uid,t.sid,'front');
 IF s->>'status'<>'collecting' OR (s->>'evidence_revision')::integer<>1
    OR (s->'evidence') ? 'front'
    OR (s->'evidence'->'selfie') IS DISTINCT FROM (before->'selfie')
    OR (s->'evidence'->'capture') IS DISTINCT FROM (before->'capture')
    OR s->>'report_hash' IS NOT NULL OR s->>'dob' IS NOT NULL
    OR (s->>'checks_passed')::boolean
    OR EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=t.uid)
  THEN RAISE EXCEPTION 'FAIL retake did not invalidate old verdict while preserving other evidence'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ccx_idv_events
   WHERE session_id=t.sid AND action='selective_retake' AND reason='front')
   THEN RAISE EXCEPTION 'FAIL missing retake audit event'; END IF;

 newfront:=jsonb_build_object('front',jsonb_build_object(
  'path',t.uid||'/'||t.sid||'/front-new.fixture','sha256',replacement));
 BEGIN
  PERFORM public.ccx_idv_upload_versioned(t.uid,t.sid,0,newfront);
  RAISE EXCEPTION 'FAIL stale upload repopulated superseded evidence';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'STALE_EVIDENCE_REVISION' THEN RAISE; END IF;
 END;
 s:=public.ccx_idv_upload_versioned(t.uid,t.sid,1,newfront);
 IF s->'evidence'->'front'->>'sha256'<>replacement THEN
  RAISE EXCEPTION 'FAIL fresh capture was not accepted'; END IF;
 BEGIN
  PERFORM public.ccx_idv_upload_versioned(another,t.sid,1,newfront);
  RAISE EXCEPTION 'FAIL other member uploaded evidence';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'SESSION_NOT_FOUND' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.ccx_idv_request_retake(t.uid,t.sid,'front');
  RAISE EXCEPTION 'FAIL collecting session allowed endless retakes';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'RETAKE_UNAVAILABLE' THEN RAISE; END IF;
 END;
 -- A review request locks out recapture to avoid racing a staff investigation.
 UPDATE public.ccx_idv_sessions SET status='review_required' WHERE id=t.sid;
 s:=public.ccx_idv_transition(t.uid,t.sid,'request_review');
 BEGIN
  PERFORM public.ccx_idv_request_retake(t.uid,t.sid,'capture');
  RAISE EXCEPTION 'FAIL pending human review was discarded';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'RETAKE_UNAVAILABLE' THEN RAISE; END IF;
 END;
 UPDATE public.ccx_idv_sessions SET review_requested_at=null WHERE id=t.sid;
 UPDATE public.ccx_idv_sessions SET legal_hold=true WHERE id=t.sid;
 BEGIN
  PERFORM public.ccx_idv_request_retake(t.uid,t.sid,'capture');
  RAISE EXCEPTION 'FAIL legal hold allowed selective retake';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'RETAKE_UNAVAILABLE' THEN RAISE; END IF;
 END;
 UPDATE public.ccx_idv_sessions SET legal_hold=false WHERE id=t.sid;
 -- The fixture leaves the case with no admission and the original purge ledger.
 IF EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=t.uid) THEN
  RAISE EXCEPTION 'FAIL selective retake admitted an unverified member'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: isolated identity retake authorization, revisions, audit and admission gates' AS result;
