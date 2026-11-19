-- Isolated fixture only. The integration workflow supplies synthetic users,
-- collaborations and the actual production migration.
DO $$ BEGIN
 IF has_function_privilege('authenticated','public.ccx_collaboration_actual_action(uuid,uuid,text,uuid,text,text,text)','EXECUTE')
 OR has_table_privilege('authenticated','public.ccx_collaboration_actual_statements','SELECT')
 OR has_table_privilege('anon','public.ccx_collaboration_actual_statements','INSERT')
 THEN RAISE EXCEPTION 'FAIL browser could access private post-production accounts'; END IF;
END $$;

DO $actual$
DECLARE
 owner uuid:='10000000-0000-4000-8000-000000000001';
 friend uuid:='20000000-0000-4000-8000-000000000002';
 outsider uuid:='30000000-0000-4000-8000-000000000003';
 cid uuid;future_id uuid;cancel_id uuid;
 key1 uuid:=gen_random_uuid();key2 uuid:=gen_random_uuid();other_key uuid:=gen_random_uuid();
 result jsonb;oldid uuid;record_count int;
BEGIN
 INSERT INTO public.collaborations(creator_id,status) VALUES(owner,'completed') RETURNING id INTO cid;
 INSERT INTO public.collaboration_members(collaboration_id,user_id,membership_role)
 VALUES(cid,owner,'owner'),(cid,friend,'photographer');
 INSERT INTO public.ccx_collaboration_plans(collaboration_id,updated_by,starts_at,ends_at,
  timezone,scope_of_work,deliverables)
 VALUES(cid,owner,now()-interval '2 days',now()-interval '1 day',
  'America/Phoenix','Synthetic shoot brief','Synthetic photo delivery');

 BEGIN
  PERFORM public.ccx_collaboration_actual_action(outsider,cid,'list');
  RAISE EXCEPTION 'FAIL unrelated user read private work statements';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'ACTUALS_NOT_PARTICIPANT' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.ccx_collaboration_actual_action(outsider,cid,'submit',
    gen_random_uuid(),'Forged third-party account','','');
  RAISE EXCEPTION 'FAIL unrelated user wrote private statement';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'ACTUALS_NOT_PARTICIPANT' THEN RAISE; END IF;
 END;

 result:=public.ccx_collaboration_actual_action(owner,cid,'submit',
   key1,'I filmed the proposed material','Delivered still images','One deliverable differed');
 oldid:=(result->'statement'->>'id')::uuid;
 IF result->>'replayed'<>'false' OR
    (result->'statement'->>'plan_version')::integer<>1 OR
    (result->'statement'->>'revision')::integer<>1
    THEN RAISE EXCEPTION 'FAIL initial statement';END IF;
 result:=public.ccx_collaboration_actual_action(owner,cid,'submit',
   key1,'I filmed the proposed material','Delivered still images','One deliverable differed');
 IF result->>'replayed'<>'true' OR
    (result->'statement'->>'id')::uuid IS DISTINCT FROM oldid
    THEN RAISE EXCEPTION 'FAIL idempotent replay';END IF;

 BEGIN
  PERFORM public.ccx_collaboration_actual_action(owner,cid,'submit',
    key1,'Altered content for same idempotency key','','');
  RAISE EXCEPTION 'FAIL reused key modified testimony';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'ACTUALS_IDEMPOTENCY_REUSED' THEN RAISE; END IF;
 END;

 result:=public.ccx_collaboration_actual_action(friend,cid,'submit',
    other_key,'I delivered the equipment but no images','Equipment only','I disagree with the delivery report');
 IF (result->'statement'->>'actor_id')::uuid<>friend THEN
  RAISE EXCEPTION 'FAIL member authorship'; END IF;
 result:=public.ccx_collaboration_actual_action(owner,cid,'submit',
    key2,'Correction: I prepared but did not film','No final photos','Previous entry inaccurate');
 IF (result->'statement'->>'revision')::int<>2 THEN
  RAISE EXCEPTION 'FAIL correction must append new version'; END IF;
 result:=public.ccx_collaboration_actual_action(friend,cid,'list');
 IF jsonb_array_length(result->'statements')<>3 OR
    result::text NOT LIKE '%I filmed the proposed material%' OR
    result::text NOT LIKE '%I disagree with the delivery report%' THEN
  RAISE EXCEPTION 'FAIL conflicting and corrected participant accounts not preserved'; END IF;
 IF result::text LIKE '%idempotency_key%' THEN RAISE EXCEPTION 'FAIL replay token exposed to members'; END IF;
 BEGIN
  DELETE FROM public.ccx_collaboration_actual_statements WHERE id=oldid;
  RAISE EXCEPTION 'FAIL participant history could be deleted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%immutable%' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE public.ccx_collaboration_actual_statements SET work_completed='Overwritten' WHERE id=oldid;
  RAISE EXCEPTION 'FAIL participant history could be overwritten';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%immutable%' THEN RAISE; END IF;
 END;

 -- Neither posting nor a correction creates contract or consent changes.
 IF (SELECT count(*) FROM public.ccx_collaboration_actual_statements WHERE collaboration_id=cid)<>3
 THEN RAISE EXCEPTION 'FAIL immutable revisions missing'; END IF;

 INSERT INTO public.collaborations(creator_id,status) VALUES(owner,'active') RETURNING id INTO future_id;
 INSERT INTO public.collaboration_members(collaboration_id,user_id,membership_role) VALUES(future_id,owner,'owner');
 INSERT INTO public.ccx_collaboration_plans(collaboration_id,updated_by,starts_at,ends_at)
 VALUES(future_id,owner,now()+interval '1 month',now()+interval '1 month 2 hours');
 BEGIN
  PERFORM public.ccx_collaboration_actual_action(owner,future_id,'submit',
    gen_random_uuid(),'I already did the work','','');
  RAISE EXCEPTION 'FAIL premature completion report';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'ACTUALS_NOT_YET_AVAILABLE' THEN RAISE; END IF;
 END;

 INSERT INTO public.collaborations(creator_id,status) VALUES(owner,'cancelled') RETURNING id INTO cancel_id;
 INSERT INTO public.collaboration_members(collaboration_id,user_id,membership_role) VALUES(cancel_id,owner,'owner');
 INSERT INTO public.ccx_collaboration_plans(collaboration_id,updated_by,starts_at,ends_at)
 VALUES(cancel_id,owner,now()-interval '2 months',now()-interval '1 month');
 BEGIN
  PERFORM public.ccx_collaboration_actual_action(owner,cancel_id,'submit',
    gen_random_uuid(),'I falsely completed it','','');
  RAISE EXCEPTION 'FAIL cancelled project completion';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'ACTUALS_NOT_YET_AVAILABLE' THEN RAISE; END IF;
 END;
END $actual$;
SELECT 'PASS: individual append-only completion statements, preserved disputes, idempotency and member privacy' AS result;
