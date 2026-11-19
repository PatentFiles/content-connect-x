-- Disposable collaboration CI only. All times are synthetic relative to NOW().
DO $$ BEGIN
 IF has_function_privilege('authenticated','public.ccx_collaboration_safety_action(uuid,uuid,text,boolean)','EXECUTE')
 OR has_table_privilege('authenticated','public.ccx_collaboration_safety_checkins','SELECT')
 OR has_table_privilege('anon','public.ccx_collaboration_safety_events','INSERT')
 THEN RAISE EXCEPTION 'FAIL browser can alter a private safety record'; END IF;
END $$;
-- A service-role session is represented with the same grants/RLS bypass as
-- Supabase service_role; the user ID is still checked independently by SQL.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.member_admissions,public.account_security,
 public.collaboration_members,public.collaborations,public.ccx_collaboration_plans TO service_role;

DO $test$
DECLARE
 owner uuid:='10000000-0000-4000-8000-000000000001';
 friend uuid:='20000000-0000-4000-8000-000000000002';
 outsider uuid:='30000000-0000-4000-8000-000000000003';
 cid uuid;future_cid uuid; r jsonb; first_time timestamptz;
BEGIN
 INSERT INTO public.collaborations(creator_id,status) VALUES(owner,'active') RETURNING id INTO cid;
 INSERT INTO public.collaboration_members(collaboration_id,user_id,membership_role)
 VALUES(cid,owner,'owner'),(cid,friend,'photographer');
 INSERT INTO public.ccx_collaboration_plans(collaboration_id,updated_by,starts_at,ends_at,timezone,city)
 VALUES(cid,owner,now()-interval '30 minutes',now()+interval '3 hours','America/Phoenix','CI synthetic city');

 r:=public.ccx_collaboration_safety_action(owner,cid,'status');
 IF r->>'status'<>'not_started' OR r->>'can_check_in'<>'true'
   OR r->>'monitored_emergency_response'<>'false'
 THEN RAISE EXCEPTION 'FAIL availability or misleading emergency claim'; END IF;

 BEGIN
  PERFORM public.ccx_collaboration_safety_action(outsider,cid,'status');
  RAISE EXCEPTION 'FAIL nonmember read attendance';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'SAFETY_NOT_PARTICIPANT' THEN RAISE; END IF;
 END;

 r:=public.ccx_collaboration_safety_action(owner,cid,'check_in',true);
 IF r->>'status'<>'checked_in' OR r->>'contact_informed_by_member'<>'true'
   OR (SELECT count(*) FROM public.ccx_collaboration_safety_events
       WHERE collaboration_id=cid AND actor_id=owner AND event_type='checked_in')<>1
 THEN RAISE EXCEPTION 'FAIL check-in record'; END IF;
 SELECT checked_in_at INTO first_time FROM public.ccx_collaboration_safety_checkins
  WHERE collaboration_id=cid AND user_id=owner;
 PERFORM public.ccx_collaboration_safety_action(owner,cid,'check_in',false);
 IF (SELECT checked_in_at FROM public.ccx_collaboration_safety_checkins
  WHERE collaboration_id=cid AND user_id=owner) IS DISTINCT FROM first_time
 THEN RAISE EXCEPTION 'FAIL duplicate check-in changed original time'; END IF;

 r:=public.ccx_collaboration_safety_action(friend,cid,'status');
 IF r->>'status'<>'not_started'
 THEN RAISE EXCEPTION 'FAIL different participant saw another user safety state'; END IF;
 BEGIN
  PERFORM public.ccx_collaboration_safety_action(friend,cid,'mark_safe');
  RAISE EXCEPTION 'FAIL unconfirmed member marked safe';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'SAFETY_NOT_CHECKED_IN' THEN RAISE; END IF;
 END;

 r:=public.ccx_collaboration_safety_action(owner,cid,'record_concern');
 IF r->>'status'<>'concern_recorded' OR r->>'concern_recorded_at' IS NULL OR r->>'monitored_emergency_response'<>'false'
 THEN RAISE EXCEPTION 'FAIL concern receipt distinction'; END IF;
 PERFORM public.ccx_collaboration_safety_action(owner,cid,'record_concern');
 IF (SELECT count(*) FROM public.ccx_collaboration_safety_events
   WHERE collaboration_id=cid AND actor_id=owner AND event_type='concern_recorded')<>1
 THEN RAISE EXCEPTION 'FAIL repeated concern duplicated event'; END IF;

 r:=public.ccx_collaboration_safety_action(owner,cid,'mark_safe');
 IF r->>'status'<>'safe' OR r->>'concern_recorded_at' IS NULL
 THEN RAISE EXCEPTION 'FAIL safe check-out erased prior concern'; END IF;
 r:=public.ccx_collaboration_safety_action(owner,cid,'leave');
 IF r->>'status'<>'left' OR r->>'left_at' IS NULL
 THEN RAISE EXCEPTION 'FAIL voluntary departure'; END IF;
 BEGIN
  PERFORM public.ccx_collaboration_safety_action(owner,cid,'mark_safe');
  RAISE EXCEPTION 'FAIL departure overwritten';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'SAFETY_NOT_CHECKED_IN' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.ccx_collaboration_safety_events
   WHERE collaboration_id=cid AND actor_id=owner AND event_type='left')<>1
 THEN RAISE EXCEPTION 'FAIL departure event'; END IF;
 IF (SELECT count(*) FROM information_schema.columns
   WHERE table_name='ccx_collaboration_safety_checkins'
   AND column_name IN('lat','lng','latitude','longitude','contact_email','contact_phone','gps'))<>0
 THEN RAISE EXCEPTION 'FAIL tracking or third-party contact fields found'; END IF;

 INSERT INTO public.collaborations(creator_id,status) VALUES(owner,'active') RETURNING id INTO future_cid;
 INSERT INTO public.collaboration_members(collaboration_id,user_id,membership_role)
 VALUES(future_cid,owner,'owner');
 INSERT INTO public.ccx_collaboration_plans(collaboration_id,updated_by,starts_at,ends_at)
 VALUES(future_cid,owner,now()+interval '2 months',now()+interval '2 months 4 hours');
 BEGIN
  PERFORM public.ccx_collaboration_safety_action(owner,future_cid,'check_in');
  RAISE EXCEPTION 'FAIL check-in accepted far outside schedule';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'SAFETY_OUTSIDE_SCHEDULE' THEN RAISE; END IF;
 END;
 r:=public.ccx_collaboration_safety_action(owner,future_cid,'leave');
 IF r->>'status'<>'left' THEN RAISE EXCEPTION 'FAIL participant could not leave'; END IF;

 BEGIN
  UPDATE public.ccx_collaboration_safety_events SET event_type='checked_in' WHERE collaboration_id=cid;
  RAISE EXCEPTION 'FAIL append-only safety event changed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%append-only%' THEN RAISE; END IF;
 END;
END $test$;
SELECT 'PASS: voluntary self reports, no GPS, no emergency claims, independent member auth, immutable events' AS result;
