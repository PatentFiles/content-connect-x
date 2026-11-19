-- Targeted recovery for the disabled production ID flow. Does not enable identity
-- verification, modify admission, or grant browser access to protected evidence.
-- Apply after self_hosted_identity_v2.sql and retention hardening.
begin;

alter table public.ccx_idv_sessions
  add column if not exists evidence_revision integer not null default 0
  check (evidence_revision between 0 and 100);

-- Service-only, owner-bound operation. The old evidence remains in the private
-- deletion ledger, and the retention worker removes it on the original deadline.
create or replace function public.ccx_idv_request_retake(
  p_user uuid, p_session uuid, p_kind text
) returns jsonb language plpgsql security invoker set search_path='' as $retake$
declare
  s public.ccx_idv_sessions%rowtype;
  cfg public.ccx_idv_config%rowtype;
  next_evidence jsonb;
begin
  if p_user is null then raise exception 'SESSION_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,7211));
  if not exists(select 1 from public.account_security
    where user_id=p_user and not banned and not suspended)
    then raise exception 'ACCOUNT_RESTRICTED'; end if;
  select * into s from public.ccx_idv_sessions
    where id=p_session and user_id=p_user for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  select * into strict cfg from public.ccx_idv_config where singleton;
  if not cfg.enabled or s.expires_at<=now() or s.purged_at is not null
    or s.purge_started_at is not null then raise exception 'SESSION_EXPIRED_OR_DISABLED'; end if;
  if s.legal_hold or s.review_requested_at is not null then raise exception 'RETAKE_UNAVAILABLE'; end if;
  -- Only an inconclusive completed attempt qualifies. Never reset approved,
  -- age-restricted, name-mismatched, pending or still-processing evidence.
  if s.status<>'review_required' or not (s.evidence ? 'capture')
    or s.process_attempts>=3 or p_kind not in ('front','back','capture')
    then raise exception 'RETAKE_UNAVAILABLE'; end if;
  if (p_kind='back' and s.document_type='passport')
    or not (s.evidence ? p_kind) then raise exception 'RETAKE_UNAVAILABLE'; end if;
  next_evidence:=s.evidence-p_kind;
  if p_kind='capture' then next_evidence:=next_evidence-'selfie'; end if;

  update public.ccx_idv_sessions set
    evidence=next_evidence,
    evidence_revision=evidence_revision+1,
    status='collecting',
    reason='retake_requested',
    checks_passed=false,
    extracted_name=null,
    dob=null,
    eligible_on=null,
    document_expiry=null,
    document_fingerprint=null,
    report_hash=null,
    model_manifest=null,
    job_hash=null,
    job_expires_at=null,
    claimed_at=null,
    challenge_id=case when p_kind='capture' then gen_random_uuid() else challenge_id end,
    directions=case when p_kind='capture' then
       array[case when get_byte(extensions.gen_random_bytes(1),0)%2=0 then 'left' else 'right' end,
             case when get_byte(extensions.gen_random_bytes(1),0)%2=0 then 'left' else 'right' end]
       else directions end,
    updated_at=now()
  where id=s.id returning * into s;

  insert into public.ccx_idv_events(session_id,actor_id,action,reason)
    values(s.id,p_user,'selective_retake',p_kind);
  return to_jsonb(s);
end $retake$;
revoke all on function public.ccx_idv_request_retake(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ccx_idv_request_retake(uuid,uuid,text) to service_role;

-- One transactional compare-and-set boundary against late uploads from a
-- previous capture generation. The existing identity transition still performs
-- its full path/hash/status checks while this row lock is held.
create or replace function public.ccx_idv_upload_versioned(
  p_user uuid, p_session uuid, p_revision integer, p_parts jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $upload$
declare s public.ccx_idv_sessions%rowtype;
begin
  if p_user is null or p_revision is null then raise exception 'STALE_EVIDENCE_REVISION'; end if;
  -- Match the advisory-first lock order used by the existing transition.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,7211));
  select * into s from public.ccx_idv_sessions
    where id=p_session and user_id=p_user for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if s.evidence_revision<>p_revision then raise exception 'STALE_EVIDENCE_REVISION'; end if;
  return public.ccx_idv_transition(p_user,p_session,'upload',jsonb_build_object('parts',p_parts));
end $upload$;
revoke all on function public.ccx_idv_upload_versioned(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.ccx_idv_upload_versioned(uuid,uuid,integer,jsonb) to service_role;

commit;
