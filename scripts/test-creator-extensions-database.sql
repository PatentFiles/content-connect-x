-- Isolated ccx_collab_test only; no real accounts, medical or identity records.
DO $$ BEGIN IF current_database()<>'ccx_collab_test' THEN RAISE EXCEPTION 'Disposable CI database only'; END IF; END $$;
DO $$ BEGIN
 IF has_table_privilege('authenticated','public.ccx_friend_introductions','SELECT')
  OR has_table_privilege('authenticated','public.ccx_friend_intro_messages','SELECT')
  OR has_table_privilege('authenticated','public.ccx_collaboration_notes','SELECT')
  OR has_table_privilege('authenticated','public.ccx_profile_travel','SELECT')
  OR has_function_privilege('authenticated','public.ccx_friend_intro(uuid,text,uuid,uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'FAIL private workflow accessible to browser role';END IF;
END $$;

SET ROLE service_role;
DO $test$
DECLARE
 owner uuid:='10000000-0000-4000-8000-000000000001';
 friend uuid:='20000000-0000-4000-8000-000000000002';
 outsider uuid:='30000000-0000-4000-8000-000000000003';
 result jsonb; intro_id uuid; cid uuid; note_id uuid;
BEGIN
 INSERT INTO public.ccx_friend_preferences(user_id) VALUES(friend);
 result:=public.ccx_friend_intro(owner,'start',friend,NULL,'Hello! I am a verified creator and would like to discuss work together.');
 intro_id:=(result->>'id')::uuid;
 IF result->>'status'<>'awaiting_reply' THEN RAISE EXCEPTION 'FAIL intro not awaiting reply';END IF;
 BEGIN
  PERFORM public.ccx_friend_intro(outsider,'reply',NULL,intro_id,'Forged message');
  RAISE EXCEPTION 'FAIL unrelated person replied';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'INTRO_UNAVAILABLE' THEN RAISE;END IF;END;
 result:=public.ccx_friend_intro(friend,'reply',NULL,intro_id,'Hi, happy to discuss possible projects.');
 IF result->>'status'<>'completed' THEN RAISE EXCEPTION 'FAIL consented two-way introduction';END IF;
 result:=public.ccx_friend_intro(owner,'list');
 IF (result::text NOT LIKE '%happy to discuss%') THEN RAISE EXCEPTION 'FAIL intro response missing';END IF;
 BEGIN
  PERFORM public.ccx_friend_intro(owner,'start',friend,NULL,'Another unsolicited introduction');
  RAISE EXCEPTION 'FAIL duplicate intro';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'INTRO_EXISTS' THEN RAISE;END IF;END;
 UPDATE public.ccx_friend_preferences SET request_policy='no_one' WHERE user_id=friend;
 BEGIN
  PERFORM public.ccx_friend_intro(outsider,'start',friend,NULL,'This is an unwanted introduction after opt out.');
  RAISE EXCEPTION 'FAIL no-contact preference bypassed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'INTRO_UNAVAILABLE' THEN RAISE;END IF;END;

 INSERT INTO public.collaborations(creator_id,status) VALUES(owner,'active') RETURNING id INTO cid;
 INSERT INTO public.collaboration_members(collaboration_id,user_id,membership_role)
  VALUES(cid,owner,'owner'),(cid,friend,'creator');
 INSERT INTO public.ccx_collaboration_notes(collaboration_id,author_id,note_kind,note_text)
 VALUES(cid,owner,'manual','Scope needs an overnight access discussion') RETURNING id INTO note_id;
 BEGIN
  UPDATE public.ccx_collaboration_notes SET note_text='Changed history' WHERE id=note_id;
  RAISE EXCEPTION 'FAIL immutable notes modified';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%append-only%' THEN RAISE;END IF;END;
 BEGIN
  DELETE FROM public.ccx_collaboration_notes WHERE id=note_id;
  RAISE EXCEPTION 'FAIL immutable notes erased';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%append-only%' THEN RAISE;END IF;END;
 INSERT INTO public.ccx_collaboration_testing_policy(collaboration_id,required,verification_deadline,freshness_days,updated_by)
 VALUES(cid,true,now()+interval '2 days',14,owner);
 IF NOT EXISTS(SELECT 1 FROM public.ccx_collaboration_testing_policy
  WHERE collaboration_id=cid AND required AND freshness_days=14)
 THEN RAISE EXCEPTION 'FAIL collaboration credential policy';END IF;
 INSERT INTO public.ccx_profile_travel(user_id,entry_type,city,country,starts_on,ends_on,visibility)
 VALUES(owner,'travel','Los Angeles','United States',current_date+7,current_date+10,'friends');
 IF NOT EXISTS(SELECT 1 FROM public.ccx_profile_travel WHERE user_id=owner AND visibility='friends')
 THEN RAISE EXCEPTION 'FAIL owner travel calendar';END IF;
END $test$;
RESET ROLE;
SET ROLE authenticated;
DO $access$
DECLARE seen integer;
BEGIN
 BEGIN
  SELECT count(*) INTO seen FROM public.ccx_collaboration_notes;
  RAISE EXCEPTION 'FAIL browser read collaborator notes';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $access$;
RESET ROLE;
SELECT 'PASS: message-first private intros, no-contact preference, immutable notes, private travel and testing deadlines' AS result;
