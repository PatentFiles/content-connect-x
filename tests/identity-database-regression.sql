-- Requires identity-database-fixture.sql and the actual rollout SQL in an
-- isolated throwaway database. These are synthetic tests, not real approvals.
update public.ccx_idv_config set enabled=true,worker_origin='https://fixture.up.railway.app',security_approved_at=now(),privacy_approved_at=now(),notice_version='ci-only',notice_text=repeat('Synthetic CI notice. Not a production consent notice. ',3),retention_days=7;
create function public.ci_identity_finish(u uuid,birth date,read_name text,document_number text) returns jsonb language plpgsql as $$
declare s jsonb; sid uuid:=gen_random_uuid(); prefix text; parts jsonb;
begin
 s:=public.ccx_idv_transition(u,sid,'start',jsonb_build_object('legal_name','Synthetic Claim','document_type','passport','issuing_country','US','consent_version','ci-only','consent_hash',(select encode(extensions.digest(notice_text,'sha256'),'hex') from public.ccx_idv_config)));
 if s->>'status'='age_restricted' then return s;end if;
 sid:=(s->>'id')::uuid;prefix:=u::text||'/'||sid::text||'/';
 parts:=jsonb_build_object('front',jsonb_build_object('path',prefix||'front.jpg','sha256',repeat('a',64)),'selfie',jsonb_build_object('path',prefix||'selfie.jpg','sha256',repeat('b',64)),'capture',jsonb_build_object('path',prefix||'capture.json','sha256',repeat('c',64)));
 perform public.ccx_idv_transition(u,sid,'upload',jsonb_build_object('parts',parts));
 perform public.ccx_idv_transition(u,sid,'begin',jsonb_build_object('job_hash',repeat('d',64)));
 perform public.ccx_idv_transition(null,sid,'claim',jsonb_build_object('job_hash',repeat('d',64)));
 begin
  perform public.ccx_idv_transition(null,sid,'claim',jsonb_build_object('job_hash',repeat('d',64)));
  raise exception 'TEST_FAILURE: capability reused';
 exception when others then if SQLERRM<>'INVALID_CAPABILITY' then raise;end if;end;
 return public.ccx_idv_transition(u,sid,'finish',jsonb_build_object('job_hash',repeat('d',64),'report_hash',repeat('e',64),'checks_passed',true,'extracted_name',read_name,'dob',birth,'document_expiry',(current_date+365)::text,'document_number',document_number,'model_manifest','{}'::jsonb));
end $$;
set role service_role;
do $$
declare u uuid:='11111111-1111-4111-8111-111111111111'; v uuid:='22222222-2222-4222-8222-222222222222'; adult uuid:='33333333-3333-4333-8333-333333333333'; s jsonb; today date:=(now() at time zone 'UTC')::date;
begin
 if public.ccx_idv_eligible_on('2008-02-29')<>'2026-03-02'::date then raise exception 'TEST_FAILURE: leap birthday';end if;
 if public.ccx_idv_eligible_on('2008-11-18')<>'2026-11-19'::date then raise exception 'TEST_FAILURE: birthday plus one';end if;
 s:=public.ci_identity_finish(u,(today-interval '17 years')::date,'Synthetic Minor','CI-UNDERAGE-DOCUMENT');
 if s->>'status'<>'age_restricted' then raise exception 'TEST_FAILURE: minor admitted';end if;
 if exists(select 1 from public.member_admissions where user_id=u) then raise exception 'TEST_FAILURE: restricted admission exists';end if;
 s:=public.ccx_idv_transition(u,gen_random_uuid(),'start','{}');
 if s->>'status'<>'age_restricted' then raise exception 'TEST_FAILURE: age restriction lost on restart';end if;
 s:=public.ci_identity_finish(v,(today-interval '30 years')::date,'Synthetic Reuse','CI-UNDERAGE-DOCUMENT');
 if s->>'status'<>'age_restricted' then raise exception 'TEST_FAILURE: blocked document reused';end if;
 s:=public.ci_identity_finish(adult,(today-interval '30 years')::date,'Synthetic Adult','CI-ADULT-DOCUMENT');
 if s->>'status'<>'name_mismatch' then raise exception 'TEST_FAILURE: legal name mismatch ignored';end if;
 if exists(select 1 from public.member_admissions where user_id=adult) then raise exception 'TEST_FAILURE: name mismatch admitted';end if;
 begin
  perform public.ccx_idv_transition(adult,(s->>'id')::uuid,'confirm_name','{"legal_name":"Still Wrong"}');
  raise exception 'TEST_FAILURE: wrong name accepted';
 exception when others then if SQLERRM<>'NAME_DOES_NOT_MATCH' then raise;end if;end;
 s:=public.ccx_idv_transition(adult,(s->>'id')::uuid,'confirm_name','{"legal_name":"Synthetic Adult"}');
 if s->>'status'<>'name_mismatch' or exists(select 1 from public.member_admissions where user_id=adult)
 then raise exception 'TEST_FAILURE: account-name mismatch bypassed finalizer';end if;
 -- Fixture-only independent correction to the registered account legal name.
 -- Ordinary site users cannot change a verified identity through the browser.
 update public.member_profiles set real_name='Synthetic Adult' where id=adult;
 s:=public.ccx_idv_transition(adult,(s->>'id')::uuid,'confirm_name','{"legal_name":"Synthetic Adult"}');
 if s->>'status'<>'approved' or not exists(select 1 from public.member_admissions where user_id=adult) then raise exception 'TEST_FAILURE: trusted approval did not admit';end if;
 if (select real_name from public.member_profiles where id=adult)<>'Synthetic Adult' then raise exception 'TEST_FAILURE: legal name not updated';end if;
 if (select display_name from public.member_profiles where id=adult)<>'Public Stage Name' then raise exception 'TEST_FAILURE: public display name changed';end if;
 begin
  update public.member_profiles set real_name='Changed Outside Verification' where id=adult;
  raise exception 'TEST_FAILURE: verified name editable';
 exception when others then if SQLERRM<>'The verified legal name can only change through reverification' then raise;end if;end;
 begin
  insert into public.age_verification_requests(id,user_id,status,provider) values(gen_random_uuid(),adult,'approved','idswyft_self_hosted');
  raise exception 'TEST_FAILURE: unbound approval accepted';
 exception when others then if SQLERRM<>'Bound identity evidence required' then raise;end if;end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('authenticated','public.ccx_idv_transition(uuid,uuid,text,jsonb)','EXECUTE') then raise exception 'TEST_FAILURE: browser can call state machine';end if;
 if has_table_privilege('authenticated','public.ccx_idv_sessions','SELECT') then raise exception 'TEST_FAILURE: browser can read private identity';end if;
 if has_table_privilege('service_role','public.ccx_idv_events','UPDATE') then raise exception 'TEST_FAILURE: audit events editable';end if;
 if (select public from storage.buckets where id='ccx-identity-evidence') then raise exception 'TEST_FAILURE: evidence bucket public';end if;
end $$;
set role authenticated;
do $$ begin
 begin
  insert into storage.objects(bucket_id,name) values('ccx-identity-evidence','attacker-upload.jpg');
  raise exception 'TEST_FAILURE: broad storage policy bypasses restrictive policy';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'Identity database regression: 19 assertions passed in disposable database' as result;
