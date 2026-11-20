-- Fail-closed account-name binding for first-party identity verification.
-- The signup real_name must match the ID-extracted legal name; typed form
-- corrections cannot silently rewrite an account or grant admission.
-- All existing audit/session/retention and service-role restrictions preserved.
CREATE OR REPLACE FUNCTION public.ccx_idv_transition(p_user uuid, p_session uuid, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 s public.ccx_idv_sessions%rowtype; cfg public.ccx_idv_config%rowtype;
 today date := (now() at time zone 'UTC')::date; eligible date; blocked date;
 k text; v jsonb; doc_fingerprint text; final_status text; final_reason text; actor uuid := p_user;
begin
 select * into strict cfg from public.ccx_idv_config where singleton;
 if p_user is not null then
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,7211));
  if not exists(select 1 from public.account_security where user_id=p_user and not banned and not suspended)
   then raise exception 'ACCOUNT_RESTRICTED'; end if;
 end if;
 if p_action='start' then
  if not cfg.enabled then raise exception 'VERIFICATION_UNAVAILABLE'; end if;
  if p_user is null then raise exception 'CONFIRM_EMAIL'; end if;
  select eligible_on into blocked from public.ccx_idv_accounts where user_id=p_user;
  if blocked>today then return jsonb_build_object('status','age_restricted','reason','under_18','eligible_on',blocked); end if;
  select * into s from public.ccx_idv_sessions where user_id=p_user and status in ('collecting','processing','name_mismatch') and expires_at>now() order by created_at desc limit 1;
  if found then return to_jsonb(s); end if;
  if (select count(*) from public.ccx_idv_sessions where user_id=p_user and created_at>now()-interval '24 hours')>=3 then raise exception 'DAILY_ATTEMPT_LIMIT'; end if;
  if p_data->>'consent_version' is distinct from cfg.notice_version or p_data->>'consent_hash' is distinct from encode(extensions.digest(cfg.notice_text,'sha256'),'hex') then raise exception 'NOTICE_CHANGED'; end if;
  if not ((p_data->>'issuing_country')=any(cfg.supported_countries)) then raise exception 'COUNTRY_UNSUPPORTED'; end if;
  insert into public.ccx_idv_accounts(user_id,legal_name) values(p_user,p_data->>'legal_name')
   on conflict(user_id) do update set legal_name=excluded.legal_name,updated_at=now() where ccx_idv_accounts.verified_at is null;
  insert into public.ccx_idv_sessions(id,user_id,document_type,issuing_country,legal_name,directions,consent_version,consent_hash,purge_after)
   values(p_session,p_user,p_data->>'document_type',p_data->>'issuing_country',p_data->>'legal_name',
    array[case when get_byte(extensions.gen_random_bytes(1),0)%2=0 then 'left' else 'right' end,case when get_byte(extensions.gen_random_bytes(1),0)%2=0 then 'left' else 'right' end],
    cfg.notice_version,p_data->>'consent_hash',now()+make_interval(days=>cfg.rejected_retention_days)) returning * into s;
 else
  select * into s from public.ccx_idv_sessions where id=p_session for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if p_action<>'claim' and (p_user is null or s.user_id is distinct from p_user) then raise exception 'SESSION_NOT_FOUND'; end if;
  if p_action in ('upload','begin','confirm_name') and (not cfg.enabled or s.expires_at<=now() or s.purged_at is not null) then raise exception 'SESSION_EXPIRED_OR_DISABLED'; end if;
  if p_action='upload' then
   if s.status<>'collecting' or jsonb_typeof(p_data->'parts') is distinct from 'object' then raise exception 'SESSION_LOCKED'; end if;
   for k,v in select key,value from jsonb_each(p_data->'parts') loop
    if jsonb_typeof(v) is distinct from 'object' or k not in ('front','back','selfie','capture') or coalesce(v->>'path','') not like s.user_id::text||'/'||s.id::text||'/%'
     or v->>'path' ~ '\.\.' or coalesce(v->>'sha256','') !~ '^[a-f0-9]{64}$' or not (v ? 'path' and v ? 'sha256') then raise exception 'INVALID_EVIDENCE'; end if;
    if s.evidence ? k and (s.evidence->k->>'sha256') is distinct from (v->>'sha256') then raise exception 'EVIDENCE_IMMUTABLE'; end if;
   end loop;
   update public.ccx_idv_sessions set evidence=evidence||(p_data->'parts'),updated_at=now() where id=s.id returning * into s;
  elsif p_action='begin' then
   if s.status not in ('collecting','retryable_error','processing') or (s.status='processing' and s.job_expires_at>now()) then raise exception 'SESSION_LOCKED'; end if;
   if s.process_attempts>=3 then raise exception 'ATTEMPT_LIMIT'; end if;
   if not (s.evidence ?& array['front','selfie','capture']) or (s.document_type<>'passport' and not (s.evidence ? 'back')) then raise exception 'EVIDENCE_INCOMPLETE'; end if;
   if coalesce(p_data->>'job_hash','') !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_CAPABILITY'; end if;
   update public.ccx_idv_sessions set status='processing',reason='processing',job_hash=p_data->>'job_hash',job_expires_at=now()+interval '3 minutes',claimed_at=null,process_attempts=process_attempts+1,updated_at=now() where id=s.id returning * into s;
  elsif p_action='claim' then
   if not cfg.enabled or s.status<>'processing' or s.claimed_at is not null or s.job_expires_at<=now() or s.job_hash is null or s.job_hash is distinct from (p_data->>'job_hash') then raise exception 'INVALID_CAPABILITY'; end if;
   update public.ccx_idv_sessions set claimed_at=now() where id=s.id returning * into s;
   insert into public.ccx_idv_events(session_id,action,reason) values(s.id,'worker_claim','capability_consumed');
   return to_jsonb(s);
  elsif p_action in ('finish','confirm_name') then
   if not cfg.enabled or s.purged_at is not null then raise exception 'VERIFICATION_UNAVAILABLE'; end if;
   if p_action='finish' then
    if s.status<>'processing' or s.claimed_at is null or s.job_expires_at<=now() or s.job_hash is distinct from (p_data->>'job_hash') then raise exception 'INVALID_CAPABILITY'; end if;
    if coalesce(p_data->>'report_hash','') !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_REPORT'; end if;
    if p_data->>'checks_passed'='true' then
     if coalesce(p_data->>'extracted_name','')='' or length(p_data->>'extracted_name')>160 or length(coalesce(p_data->>'document_number',''))<3 then raise exception 'INVALID_REPORT'; end if;
     if p_data->>'dob' is null or p_data->>'document_expiry' is null or (p_data->>'dob')::date>today or (p_data->>'dob')::date<today-interval '120 years' or (p_data->>'document_expiry')::date<today then raise exception 'INVALID_REPORT'; end if;
     select encode(extensions.hmac(s.issuing_country||':'||s.document_type||':'||upper(p_data->>'document_number'),encode(key,'hex'),'sha256'),'hex') into doc_fingerprint from ccx_internal.idv_keys where singleton;
     update public.ccx_idv_sessions set checks_passed=true,extracted_name=p_data->>'extracted_name',dob=(p_data->>'dob')::date,document_expiry=(p_data->>'document_expiry')::date,document_fingerprint=doc_fingerprint,report_hash=p_data->>'report_hash',model_manifest=p_data->'model_manifest' where id=s.id returning * into s;
    else
     update public.ccx_idv_sessions set checks_passed=false,report_hash=p_data->>'report_hash',status='review_required',reason=left(coalesce(p_data->>'reason','checks_incomplete'),100),job_hash=null,job_expires_at=null,updated_at=now() where id=s.id returning * into s;
    end if;
   else
    if s.status<>'name_mismatch' or not s.checks_passed or s.report_hash is null or lower(p_data->>'legal_name') is distinct from lower(s.extracted_name) then raise exception 'NAME_DOES_NOT_MATCH'; end if;
    update public.ccx_idv_sessions set legal_name=s.extracted_name where id=s.id returning * into s;
   end if;
   if s.checks_passed then
    eligible:=public.ccx_idv_eligible_on(s.dob);
    select max(d) into blocked from (
     select eligible_on as d from public.ccx_idv_accounts where user_id=s.user_id
     union all select eligible_on from public.ccx_idv_document_blocks where ccx_idv_document_blocks.fingerprint=s.document_fingerprint
    ) b;
    if greatest(eligible,blocked)>today then
     eligible:=greatest(eligible,blocked); final_status:='age_restricted'; final_reason:=case when today=eligible-1 then 'birthday_wait' else 'under_18' end;
     insert into public.ccx_idv_accounts(user_id,eligible_on) values(s.user_id,eligible)
      on conflict(user_id) do update set eligible_on=greatest(ccx_idv_accounts.eligible_on,excluded.eligible_on),updated_at=now();
     insert into public.ccx_idv_document_blocks(fingerprint,eligible_on,source_session) values(s.document_fingerprint,eligible,s.id)
      on conflict(fingerprint) do update set eligible_on=greatest(ccx_idv_document_blocks.eligible_on,excluded.eligible_on);
    elsif lower(s.legal_name) is distinct from lower(s.extracted_name)
       or not exists(
        select 1 from public.member_profiles p
        where p.id=s.user_id
         and p.real_name is not null
         and regexp_replace(lower(btrim(p.real_name)),'[[:space:]]+',' ','g')
          =regexp_replace(lower(btrim(s.extracted_name)),'[[:space:]]+',' ','g')
       )
      then final_status:='name_mismatch';final_reason:='registered_legal_name_mismatch';
    else final_status:='approved';final_reason:='checks_passed'; end if;
    update public.ccx_idv_sessions set status=final_status,reason=final_reason,eligible_on=eligible,job_hash=null,job_expires_at=null,updated_at=now(),
     purge_after=now()+make_interval(days=>case when final_status='approved' then cfg.retention_days else cfg.rejected_retention_days end) where id=s.id returning * into s;
    if final_status='approved' then
     insert into public.ccx_idv_accounts(user_id,legal_name,verified_name,verified_at,eligible_on) values(s.user_id,s.extracted_name,s.extracted_name,now(),eligible)
      on conflict(user_id) do update set legal_name=excluded.legal_name,verified_name=excluded.verified_name,verified_at=excluded.verified_at,eligible_on=excluded.eligible_on,updated_at=now();
     -- Verified account name already matches; never silently replace the member's registered legal identity.
     insert into public.age_verification_requests(id,user_id,status,provider,provider_session_id,verification_method,evidence_reference,id_document_path,selfie_document_path,verified_at,expires_at)
      values(s.id,s.user_id,'approved','idswyft_self_hosted',s.id::text,'DOCUMENT_SELFIE',s.report_hash,s.evidence->'front'->>'path',s.evidence->'selfie'->>'path',now(),(s.document_expiry+1)::timestamp at time zone 'UTC');
    end if;
   end if;
  elsif p_action='fail' then
   if s.status='processing' and s.job_hash is not distinct from (p_data->>'job_hash') then
    update public.ccx_idv_sessions set status='retryable_error',reason='worker_unavailable',job_hash=null,job_expires_at=null,updated_at=now() where id=s.id returning * into s;
   end if;
  elsif p_action='request_review' then
   if s.status not in ('age_restricted','name_mismatch','review_required','retryable_error') then raise exception 'REVIEW_UNAVAILABLE'; end if;
   update public.ccx_idv_sessions set review_requested_at=coalesce(review_requested_at,now()),updated_at=now() where id=s.id returning * into s;
  elsif p_action='cancel' then
   if s.status not in ('collecting','retryable_error','name_mismatch','review_required') then raise exception 'SESSION_LOCKED'; end if;
   update public.ccx_idv_sessions set status='cancelled',job_hash=null,job_expires_at=null,updated_at=now() where id=s.id returning * into s;
  else raise exception 'INVALID_ACTION'; end if;
 end if;
 insert into public.ccx_idv_events(session_id,actor_id,action,reason) values(s.id,actor,p_action,s.reason);
 return to_jsonb(s);
end $function$
